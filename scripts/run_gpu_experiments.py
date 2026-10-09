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

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.experiment_data import restore_splits, audit_training, sha256
from src.generation_analysis import paired_comparison, summarize
from src.inference import MODEL_ID, MAX_INPUT_TOKENS, MAX_NEW_TOKENS
from src.preprocess_dataset import read_jsonl, write_json, write_jsonl
from src.train import REVISION


def run(command, directory, label):
    with (directory / 'commands.jsonl').open('a') as stream:
        stream.write(json.dumps({'argv': command, 'started_unix': time.time()}) + '\n')
    with (directory / f'{label}.log').open('w') as log:
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
               '--revision', REVISION, '--test', str(path), '--output', str(output)]
    if adapter:
        command += ['--adapter', str(adapter)]
    run(command, logs, label)
    return json.loads((output / 'generation.json').read_text())


def main():
    import torch
    p = argparse.ArgumentParser()
    p.add_argument('--output', default='/content/ShellForge-runs/full-data-v1')
    p.add_argument('--epochs', type=float, default=3)
    p.add_argument('--batch-size', type=int, default=2)
    p.add_argument('--accumulation', type=int, default=8)
    p.add_argument('--learning-rates', type=float, nargs='+', default=[1e-4, 5e-5])
    a = p.parse_args()
    if not torch.cuda.is_available():
        raise RuntimeError('No CUDA GPU. In Colab select Runtime > Change runtime type > T4 GPU.')
    if len(a.learning_rates) > 2:
        raise ValueError('Protocol permits at most two validation-guided trials')
    output = Path(a.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError('Run directory is not empty. Preserve existing results; do not rerun test for tuning.')
    logs = output / 'logs'
    logs.mkdir()
    compute = {'platform': platform.platform(), 'device': torch.cuda.get_device_name(0),
               'cuda_available': True, 'gpu_memory_bytes': torch.cuda.get_device_properties(0).total_memory,
               'torch': torch.__version__, 'cuda': torch.version.cuda,
               'versions': {m: importlib.metadata.version(m) for m in ['transformers', 'peft', 'accelerate', 'bashlex']},
               'git_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
               'arguments': vars(a)}
    write_json(output / 'compute.json', compute)
    hashes = restore_splits()
    audit = audit_training(output=output / 'quality')
    write_json(output / 'source_hashes.json', hashes)
    # No held-out test metrics are used in this phase. Validation includes all records.
    validation = ROOT / 'data/review2/validation.jsonl'
    baseline = evaluate(validation, output / 'validation/base', logs, 'validation_base')
    trials = []
    for index, lr in enumerate(a.learning_rates):
        directory = output / f'trial-{index + 1}'
        run([sys.executable, '-u', '-m', 'src.train', '--require-cuda', '--revision', REVISION,
             '--train', str(output / 'quality/train.jsonl'), '--output', str(directory),
             '--epochs', str(a.epochs), '--learning-rate', str(lr), '--batch-size', str(a.batch_size),
             '--accumulation', str(a.accumulation)], logs, f'training_{index + 1}')
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
    # Exclusive write freezes settings before loading test examples or running final generation.
    with (output / 'selection.json').open('x') as stream:
        json.dump(selection, stream, indent=2)
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
    write_json(output / 'comparison.json', comparison)
    review = [dict(r, review_status='unreviewed', semantics_proven=False)
              for r in tuned_examples if not r['exact_match']]
    write_jsonl(output / 'semantic_review.jsonl', review)
    write_json(output / 'completion.json', {'completed': True, 'selected_adapter': str(adapter),
               'new_training_executed': True, 'test_evaluated_once': True,
               'validation_improved': selection['improved_validation_exact_match'],
               'primary_test_improved': comparison['primary_unexposed_test']['paired']['exact_match_delta'] > 0,
               'promotion': 'Manual review required; no production promotion solely from text or AST metrics.'})
    print(json.dumps(comparison, indent=2))


if __name__ == '__main__':
    main()
