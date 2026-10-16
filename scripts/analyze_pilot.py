"""Analyze archived pilot outputs only; never regenerate or optimize against test."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.generation_analysis import paired_comparison, wilson
from src.preprocess_dataset import write_json


def main():
    def rows(path):
        return [json.loads(line) for line in (ROOT / path).read_text().splitlines()]
    base = rows('reports/metrics/base/generation_examples.jsonl')
    tuned = rows('reports/metrics/tuned/generation_examples.jsonl')
    manifest = json.loads((ROOT / 'artifacts/qwen-lora/training_manifest.json').read_text())
    result = {'source': 'Archived 20-step pilot; no new training or model inference',
              'paired': paired_comparison(base, tuned),
              'base_wilson_95': wilson(sum(r['exact_match'] for r in base), len(base)),
              'tuned_wilson_95': wilson(sum(r['exact_match'] for r in tuned), len(tuned)),
              'optimizer_steps': 20, 'example_presentations': 80,
              'selected_training_examples': manifest['train_stats']['used'],
              'completed_epochs': manifest['train_metrics']['epoch'],
              'train_loss': manifest['train_metrics']['train_loss'],
              'validation_loss': manifest['validation_metrics']['eval_loss'],
              'new_full_data_training_completed': False,
              'caution': 'Historical test evidence informs scope and limitations only, not new hyperparameter selection.'}
    write_json(ROOT / 'reports/pilot_diagnosis.json', result)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
