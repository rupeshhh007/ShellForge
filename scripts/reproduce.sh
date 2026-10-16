#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p reports/logs
python -m src.preprocess_dataset > reports/logs/preprocessing.log 2>&1
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python -m pytest -q > reports/logs/tests.log 2>&1
python -m src.evaluate > reports/logs/evaluation_baseline.log 2>&1
python -m compileall -q src tests scripts > reports/logs/compile.log 2>&1
python scripts/build_report.py
printf '%s\n' 'Baseline, tests and report regenerated. Optional model training is documented in README.md.'
