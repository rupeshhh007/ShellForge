import gzip
import hashlib
import json
from pathlib import Path

import pytest
from src.experiment_data import audit_training, restore_splits
from src.generation_analysis import compare_command, paired_comparison, wilson
from src.preprocess_dataset import write_jsonl


def test_audit_is_conservative_and_preserves_source(tmp_path):
    path = tmp_path / 'train.jsonl'
    rows = [{'id': 'a', 'instruction': 'list files', 'command': 'ls'},
            {'id': 'b', 'instruction': 'list files', 'command': 'ls'},
            {'id': 'c', 'instruction': 'list files', 'command': 'ls -a'},
            {'id': 'd', 'instruction': 'broken', 'command': 'echo "'}]
    write_jsonl(path, rows)
    before = path.read_bytes()
    result = audit_training(path, tmp_path / 'quality')
    assert result['removal_counts'] == {'duplicate_pair': 1, 'invalid_bash_syntax': 1}
    assert result['retained'] == 2 and result['multiple_target_instruction_groups'] == 1
    assert result['semantic_alignment_certified'] is False
    assert path.read_bytes() == before


def test_restored_splits_match_pilot_and_refuse_overwrite(tmp_path):
    for split in ['train', 'validation', 'test']:
        source = Path('data/review2') / f'{split}.jsonl.gz'
        (tmp_path / source.name).write_bytes(source.read_bytes())
    hashes = restore_splits(tmp_path)
    for split, digest in hashes.items():
        assert hashlib.sha256((tmp_path / f'{split}.jsonl').read_bytes()).hexdigest() == digest
    (tmp_path / 'test.jsonl').write_text('changed')
    with pytest.raises(ValueError, match='overwrite'):
        restore_splits(tmp_path)


def test_structural_metrics_do_not_erase_semantics():
    assert compare_command('ls   -l', 'ls -l')['normalized_match']
    for prediction, reference in [("echo '$HOME'", 'echo "$HOME"'),
                                  ('ls -a', 'ls -l'), ('echo "a  b"', 'echo "a b"'),
                                  ('cat a', 'cat b'), ('printf x > a', 'printf x > b')]:
        assert not compare_command(prediction, reference)['normalized_match']
    assert not compare_command('echo "', 'ls')['ast_parse_supported']
    assert compare_command('cat a', 'rm a')['ast_node_kind_dice'] == 1


def test_pairing_and_uncertainty():
    def row(id, matched):
        return {'id': id, 'instruction': id, 'reference': 'ls', 'exact_match': matched}
    result = paired_comparison([row('a', True), row('b', False)],
                               [row('a', False), row('b', True)])
    assert result['tuned_only_correct'] == result['base_only_correct'] == 1
    assert result['mcnemar_exact_p'] == 1 and result['exact_match_delta'] == 0
    with pytest.raises(ValueError, match='order'):
        paired_comparison([row('a', True)], [row('b', True)])
    low, high = wilson(3, 32)
    assert low < 3 / 32 < high
    assert wilson(0, 10)[0] >= 0


def test_protocol_notebook_valid_and_cloud_only():
    notebook = json.loads(Path('notebooks/ShellForge_Colab.ipynb').read_text())
    cells = '\n'.join(''.join(c['source']) for c in notebook['cells'])
    assert 'run_gpu_experiments.py' in cells and 'cuda.is_available' in cells
    assert all(c.get('execution_count') is None for c in notebook['cells'] if c['cell_type'] == 'code')
    assert all(not c.get('outputs') for c in notebook['cells'])


def test_review_exclusions_are_training_only_and_byte_verified():
    review = json.loads(Path('benchmarks/train_pair_exclusions.json').read_text())
    from src.preprocess_dataset import read_jsonl
    train = {r['id']: r for r, _ in read_jsonl('data/review2/train.jsonl')}
    heldout = {r['id'] for split in ['validation','test']
               for r, _ in read_jsonl(f'data/review2/{split}.jsonl')}
    assert len(review['exclusions']) == 10 and review['reviewed_sample_count'] == 100
    assert review['source_train_sha256'] == hashlib.sha256(Path('data/review2/train.jsonl').read_bytes()).hexdigest()
    for excluded in review['exclusions']:
        assert excluded['id'] not in heldout
        assert train[excluded['id']]['instruction'] == excluded['instruction']
        assert train[excluded['id']]['command'] == excluded['command']
        assert excluded['reason'] and 'assistant' in excluded['reviewer']


def test_prediction_artifact_loader_keeps_historical_exposure(tmp_path):
    from scripts.run_gpu_experiments import load_predictions
    rows = load_predictions('reports/metrics/base/generation_examples.jsonl')
    assert len(rows) == 32 and len({r['id'] for r in rows}) == 32
    malformed = tmp_path / 'predictions.jsonl'
    malformed.write_text('{"instruction":"a","command":"ls"}\n')
    with pytest.raises(ValueError, match='Malformed'):
        load_predictions(malformed)
