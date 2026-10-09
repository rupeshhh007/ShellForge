"""Cloud-only bounded experiments: validation selection precedes a single test run."""
import argparse
from collections import Counter
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.experiment_data import restore_splits, audit_training, sha256
from src.generation_analysis import paired_comparison, summarize
from src.inference import MODEL_ID, MAX_INPUT_TOKENS, MAX_NEW_TOKENS
from src.preprocess_dataset import read_jsonl, write_json, write_jsonl
from src.train import REVISION
from src.archive_source import source_provenance
from src.run_state import atomic_json, frozen_json


def run(command, directory, label):
    with (directory / 'commands.jsonl').open('a') as stream:
        stream.write(json.dumps({'argv': command, 'started_unix': time.time()}) + '\n')
    with (directory / f'{label}.log').open('a') as log:
        log.write(f'\n=== Invocation at {time.time()} ===\n');log.flush()
        process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in process.stdout:
            print(line, end='', flush=True)
            log.write(line)
            log.flush()
        code = process.wait()
    if code:
        raise RuntimeError(f'{label} exited {code}; inspect its cloud log. No success is claimed.')


def load_predictions(path):
    # Prediction artifacts have reference/prediction fields, not training command fields.
    rows = [json.loads(line) for line in Path(path).read_text().splitlines()]
    if not rows or any(not isinstance(r, dict) or not all(k in r for k in
                      ['id', 'instruction', 'reference', 'prediction', 'exact_match']) for r in rows):
        raise ValueError('Malformed prediction artifact; refusing silent record loss')
    return rows


def evaluate(path, output, logs, label, adapter=None):
    command = [sys.executable, '-u', '-m', 'src.evaluate', '--backend', 'hf',
               '--revision', REVISION, '--resume', '--test', str(path), '--output', str(output)]
    if adapter:
        command += ['--adapter', str(adapter)]
    run(command, logs, label)
    return json.loads((output / 'generation.json').read_text())


def initialize_run(output, contract, resume):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    path = output / 'run_contract.json'
    if any(output.iterdir()) and not resume:
        raise ValueError('Run exists. Use --resume; completed experiments are never overwritten.')
    if (output / 'completion.json').exists():
        completion = json.loads((output / 'completion.json').read_text())
        if completion.get('completed'):
            if path.exists():
                frozen_json(path, contract)
            return True
    if any(output.iterdir()) and not path.exists():
        compute = output / 'compute.json'
        if not compute.exists():
            raise ValueError('Unrecognized nonempty directory; no evidence was overwritten')
        original = json.loads(compute.read_text())
        old_settings = {k: original.get('arguments', {}).get(k) for k in contract['settings']}
        if old_settings != contract['settings']:
            raise ValueError('Legacy run settings differ; preserving its checkpoints and results')
        hashes = output / 'source_hashes.json'
        if hashes.exists() and json.loads(hashes.read_text()) != contract['split_hashes']:
            raise ValueError('Legacy split hashes differ')
        atomic_json(output / 'resume_migration.json', {
            'original_compute': original, 'current_source': contract['source'],
            'notice': 'Original source provenance retained; current ZIP provenance is not assigned retroactively.',
            'settings_and_available_split_hashes_verified': True})
    frozen_json(path, contract)
    return False


def main():
    import torch
    p = argparse.ArgumentParser()
    p.add_argument('--output', default='/content/ShellForge-runs/full-data-v1')
    p.add_argument('--epochs', type=float, default=3)
    p.add_argument('--batch-size', type=int, default=2)
    p.add_argument('--accumulation', type=int, default=8)
    p.add_argument('--resume', action='store_true')
    p.add_argument('--learning-rates', type=float, nargs='+', default=[1e-4, 5e-5])
    a = p.parse_args()
    if not torch.cuda.is_available():
        raise RuntimeError('No CUDA GPU. In Colab select Runtime > Change runtime type > T4 GPU.')
    if len(a.learning_rates) > 2:
        raise ValueError('Protocol permits at most two validation-guided trials')
    output = Path(a.output).resolve()
    hashes = restore_splits()
    provenance = source_provenance(ROOT)
    contract = {'protocol_version': 2, 'source': {'content_sha256': provenance['content_sha256']},
                'split_hashes': hashes, 'model': MODEL_ID, 'revision': REVISION,
                'settings': {k:v for k,v in vars(a).items() if k not in {'output','resume'}},
                'decoding': {'do_sample': False, 'max_input_tokens': MAX_INPUT_TOKENS,
                             'max_new_tokens': MAX_NEW_TOKENS}}
    if initialize_run(output, contract, a.resume):
        print('Completed experiment preserved. No training or held-out evaluation rerun.')
        print((output / 'completion.json').read_text())
        return
    logs = output / 'logs'
    logs.mkdir(exist_ok=True)
    compute = {'platform': platform.platform(), 'device': torch.cuda.get_device_name(0),
               'cuda_available': True, 'gpu_memory_bytes': torch.cuda.get_device_properties(0).total_memory,
               'torch': torch.__version__, 'cuda': torch.version.cuda,
               'versions': {m: importlib.metadata.version(m) for m in ['transformers', 'peft', 'accelerate', 'bashlex']},
               'git_commit': provenance.get('git_commit'), 'source_provenance': provenance,
               'arguments': vars(a)}
    compute_path = output / 'compute.json'
    atomic_json(compute_path if not compute_path.exists() else output / f'compute_attempt-{uuid.uuid4().hex}.json', compute)
    audit_path = output / 'quality/audit.json'
    if audit_path.exists():
        audit = json.loads(audit_path.read_text())
        if sha256(output / 'quality/train.jsonl') != audit['filtered_sha256'] or audit['source_sha256'] != hashes['train']:
            raise ValueError('Filtered training evidence changed')
    else:
        audit = audit_training(output=output / 'quality')
    frozen_json(output / 'source_hashes.json', hashes)
    # No held-out test metrics are used in this phase. Validation includes all records.
    validation = ROOT / 'data/review2/validation.jsonl'
    if (output / 'selection.json').exists():
        selection = json.loads((output / 'selection.json').read_text())
        adapter = Path(selection['selected_adapter'])
    else:
        if (output / 'test').exists():
            raise ValueError('Test evidence exists without frozen selection; refusing to reselect or retrain')
        baseline = evaluate(validation, output / 'validation/base', logs, 'validation_base')
        trials = []
        for index, lr in enumerate(a.learning_rates):
            directory = output / f'trial-{index + 1}'
            run([sys.executable, '-u', '-m', 'src.train', '--require-cuda', '--revision', REVISION,
                 '--train', str(output / 'quality/train.jsonl'), '--output', str(directory),
                 '--epochs', str(a.epochs), '--learning-rate', str(lr), '--batch-size', str(a.batch_size),
                 '--accumulation', str(a.accumulation), '--resume'], logs, f'training_{index + 1}')
            manifest = json.loads((directory / 'training_manifest.json').read_text())
            if not manifest['completed']:
                raise RuntimeError('Incomplete training manifest')
            metrics = evaluate(validation, directory / 'validation', logs, f'validation_trial_{index + 1}',
                               directory / 'adapter')
            trials.append({'path': str(directory), 'validation': metrics,
                           'validation_loss': manifest['validation_metrics']['eval_loss']})
        chosen = max(trials, key=lambda t: (t['validation']['exact_match'], -t['validation_loss']))
        adapter = Path(chosen['path']) / 'adapter'
        selection = {'model': MODEL_ID, 'revision': REVISION, 'trials': trials,
                     'selected_adapter': str(adapter), 'base_validation': baseline,
                     'improved_validation_exact_match': chosen['validation']['exact_match'] > baseline['exact_match'],
                     'selection_rule': 'Highest validation strict exact match, then lowest validation loss; checkpoints selected by validation loss.',
                     'adapter_sha256': sha256(adapter / 'adapter_model.safetensors'),
                     'decoding': {'do_sample': False, 'max_input_tokens': MAX_INPUT_TOKENS,
                                  'max_new_tokens': MAX_NEW_TOKENS},
                     'test_protocol': 'Evaluate all 1254 once; primary analysis excludes the 32 pilot-exposed IDs. No further tuning after test.'}
        atomic_json(output / 'selection.json', selection)
    if (selection['model'] != MODEL_ID or selection['revision'] != REVISION or
            selection['decoding'] != contract['decoding'] or
            sha256(adapter / 'adapter_model.safetensors') != selection['adapter_sha256']):
        raise ValueError('Frozen selection changed; refusing retraining or new test settings')
    frozen_json(output / 'selection_lock.json', {'sha256': sha256(output / 'selection.json')})
    old = load_predictions(ROOT / 'reports/metrics/base/generation_examples.jsonl')
    exposed_ids = {r['id'] for r in old}
    test = ROOT / 'data/review2/test.jsonl'
    test_rows = [r for r, _ in read_jsonl(test)]
    if len(test_rows) != 1254 or len(exposed_ids) != 32 or not exposed_ids <= {r['id'] for r in test_rows}:
        raise ValueError('Historical test exposure does not match protocol')
    if Counter(r['id'] for r in test_rows).most_common(1)[0][1] != 1:
        raise ValueError('Duplicate test IDs')
    base_final = evaluate(test, output / 'test/base', logs, 'test_base')
    tuned_final = evaluate(test, output / 'test/tuned', logs, 'test_tuned', adapter)
    if base_final['test_sha256'] != hashes['test'] or tuned_final['test_sha256'] != hashes['test']:
        raise ValueError('Final test bytes differ from frozen split')
    base_examples = load_predictions(output / 'test/base/generation_examples.jsonl')
    tuned_examples = load_predictions(output / 'test/tuned/generation_examples.jsonl')
    unseen_base = [r for r in base_examples if r['id'] not in exposed_ids]
    unseen_tuned = [r for r in tuned_examples if r['id'] not in exposed_ids]
    comparison = {'full_test': paired_comparison(base_examples, tuned_examples),
                  'primary_unexposed_test': {'n': len(unseen_base),
                      'base': summarize(unseen_base), 'tuned': summarize(unseen_tuned),
                      'paired': paired_comparison(unseen_base, unseen_tuned)},
                  'full_base': base_final, 'full_tuned': tuned_final,
                  'pilot_exposed_count': len(exposed_ids), 'split_hashes': hashes,
                  'quality_audit': audit, 'selection_sha256': sha256(output / 'selection.json')}
    atomic_json(output / 'comparison.json', comparison)
    review = [dict(r, review_status='unreviewed', semantics_proven=False)
              for r in tuned_examples if not r['exact_match']]
    write_jsonl(output / 'semantic_review.jsonl', review)
    atomic_json(output / 'completion.json', {'completed': True, 'selected_adapter': str(adapter),
               'new_training_executed': True, 'test_evaluated_once': True,
               'validation_improved': selection['improved_validation_exact_match'],
               'primary_test_improved': comparison['primary_unexposed_test']['paired']['exact_match_delta'] > 0,
               'promotion': 'Manual review required; no production promotion solely from text or AST metrics.'})
    print(json.dumps(comparison, indent=2))


if __name__ == '__main__':
    main()
