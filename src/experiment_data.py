"""Train-only conservative audit and immutable split restoration, without execution."""
import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import random

from .preprocess_dataset import command_key, instruction_key, read_jsonl, write_json, write_jsonl
from .safety_validator import syntax_check


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def restore_splits(directory='data/review2'):
    directory = Path(directory)
    pilot = json.loads(Path('artifacts/qwen-lora/training_manifest.json').read_text())
    expected = {'train': pilot['train_sha256'], 'validation': pilot['validation_sha256'],
                'test': json.loads(Path('reports/metrics/base/generation.json').read_text())['test_sha256']}
    for split, digest in expected.items():
        path = directory / f'{split}.jsonl'
        content = gzip.decompress(path.with_suffix('.jsonl.gz').read_bytes())
        if hashlib.sha256(content).hexdigest() != digest:
            raise ValueError(f'Archived {split} differs from measured pilot split')
        if path.exists() and path.read_bytes() != content:
            raise ValueError(f'Refusing to overwrite changed {split}')
        if not path.exists():
            path.write_bytes(content)
    return expected


def audit_training(path='data/review2/train.jsonl', output='data/quality'):
    """Never inspect held-out records or drop valid alternative references as conflicts."""
    invalid = []
    loaded = read_jsonl(path, invalid)
    review_path = Path(__file__).resolve().parents[1] / 'benchmarks/train_pair_exclusions.json'
    review_manifest = json.loads(review_path.read_text()) if review_path.exists() else {'exclusions': []}
    exclusions = {r['id']: r for r in review_manifest['exclusions']}
    source_hash = sha256(path)
    if source_hash != review_manifest.get('source_train_sha256'):
        exclusions = {}
    seen = set()
    kept, removed = [], list(invalid)
    by_instruction = defaultdict(list)
    fingerprints = defaultdict(list)
    for row, source in loaded:
        key = (instruction_key(row['instruction']), row['command'])
        entry = exclusions.get(row.get('id'))
        if entry and (entry['instruction'], entry['command']) != (row['instruction'], row['command']):
            raise ValueError('Reviewed exclusion does not match source bytes')
        reason = ('reviewed_pair_mismatch_or_unsupported_task' if entry else 'duplicate_pair' if key in seen else
                  'invalid_bash_syntax' if not syntax_check(row['command']) else None)
        seen.add(key)
        if reason:
            removed.append({**source, 'id': row.get('id'), 'reason': reason, 'review_reason': entry['reason'] if entry else None})
            continue
        kept.append(row)
        by_instruction[key[0]].append(row)
        fingerprints[command_key(row['command'])].append(row.get('id'))
    conflicts = [rows for rows in by_instruction.values() if len({r['command'] for r in rows}) > 1]
    long_rows = [r for r in kept if len(r['command']) > 512]
    review = random.Random(42).sample(kept, min(100, len(kept)))
    out = Path(output)
    write_jsonl(out / 'train.jsonl', kept)
    write_jsonl(out / 'removed.jsonl', removed)
    write_jsonl(out / 'alignment_review.jsonl', [{**r, 'review_status': 'unreviewed'} for r in review])
    write_json(out / 'audit.json', {
        'source_sha256': sha256(path), 'filtered_sha256': sha256(out / 'train.jsonl'),
        'input_records': len(loaded) + len(invalid), 'retained': len(kept),
        'removal_counts': dict(Counter(r['reason'] for r in removed)), 'removed': len(removed),
        'multiple_target_instruction_groups': len(conflicts),
        'multiple_target_examples': sum(map(len, conflicts)),
        'conflict_review': [{'instruction': rows[0]['instruction'], 'targets': [r['command'] for r in rows]} for rows in conflicts],
        'structurally_shared_target_groups': sum(len(ids) > 1 for ids in fingerprints.values()),
        'long_commands_over_512_chars': len(long_rows), 'long_command_ids': [r.get('id') for r in long_rows],
        'semantic_alignment_certified': False,
        'limitations': ['Invalid syntax, identical pairs and byte-verified training-only static-review exclusions are removed.',
                       'Multiple targets can be valid alternatives; retained pending human review.',
                       'Shared AST targets and long commands are audit flags, not automatic rejection.',
                       '100 original seeded training pairs received limited assistant static review; ten clear mismatches/unsupported tasks are excluded. Remaining semantics are not certified.',
                       'Existing grouped split isolates shared commands; this is a stricter novel-command task than random NL2Bash splits.']})
    return json.loads((out / 'audit.json').read_text())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    if args.restore:
        restore_splits()
    print(json.dumps(audit_training(), indent=2))


if __name__ == '__main__':
    main()
