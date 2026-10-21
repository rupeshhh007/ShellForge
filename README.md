# ShellForge — The Command Workshop

Describe the operation. Understand the command. Inspect the consequences.

A Next.js + FastAPI web product around the preserved Python research implementation.
Commands are **proposals only**. ShellForge never executes them or connects to your
filesystem. Bounded deterministic templates power supported operations; arbitrary
requests abstain clearly when no model is configured.

## Run the product locally

Node.js 22+ and Python 3.12+ with `/bin/bash` are required. No model key, GPU,
dataset, database or cloud account is needed for the default workbench.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r services/api/requirements-dev.txt
python -m uvicorn services.api.main:app --host 127.0.0.1 --port 8010 --no-proxy-headers
```

In a second terminal:

```bash
cd apps/web
npm ci
npm run dev
```

Open [the local workshop](http://127.0.0.1:3000).

| Route | Working experience |
| --- | --- |
| `/` | Original artwork, editorial motion, interactive GNU find comparison, live API example |
| `/forge` | Validated template proposal, structured intent, token anatomy, copy and review receipt |
| `/xray` | Bash syntax-only checking and existing deterministic static AST policy |
| `/manual` | 12 searchable, filterable recipes with editable, API-validated parameters |
| `/bench` | Authentic generation results, separate authored safety evaluation and limits |

For example: **Find files larger than 100 MiB in the current directory**.
Try **Show disk space** or an exact language form from the Field Manual. The language
parser deliberately matches entire supported forms; it does not silently discard
extra qualifiers. Templates label OS assumptions and size semantics. The main
workbench always uses the actual API. No generic chatbot or fake fallback results.

The optional provider interface wraps existing Qwen/LoRA inference only when
`SHELLFORGE_MODEL_ADAPTER` is explicitly configured with verified weights and the
model dependencies/resources are installed. The final Drive binary was not available
through the inspected connector listing; the rank-8 pilot is not substituted for it.

Production frontend: `cd apps/web && npm run build && npm run start`. The server-only
`SHELLFORGE_API_ORIGIN` defaults to `http://127.0.0.1:8010`; set it **before building**
to proxy a hosted API. No credential belongs in a `NEXT_PUBLIC_` variable.

- [Architecture, contracts and safeguards](docs/product/ARCHITECTURE.md)
- [Design system and reference investigation](docs/product/DESIGN.md)
- [Original artwork, prompts and license acknowledgments](docs/product/ASSETS-AND-CREDITS.md)
- [Browser and visual QA evidence](docs/visual-qa/REPORT.md)
- [Deployment instructions and status](docs/product/DEPLOYMENT.md)
- [Resumable progress](docs/product/PROGRESS.md)

## Completed research experiment

Review 2 was merged into main in PR #1. The completed Colab T4 experiment selected
the rank-16 adapter after training on **10,026** examples. Full validation: base
36/1,255; trial 1 97/1,255; trial 2 98/1,255. Primary final test excludes the 32
pilot-exposed cases: **base 28/1,222 (2.29%), tuned 84/1,222 (6.87%) strict exact match**.
This measures command-byte agreement under the saved protocol, not semantic
correctness, real-world task success or production reliability.

The separate 102-case authored static safety benchmark scored macro F1 approximately
0.9817. It was used during policy development and is not the model's generation
accuracy. Read the [completed research report](reports/ShellForge_Review2.md).
The final adapter and full run artifacts remain in Google Drive. The repository's
`artifacts/qwen-lora` remains the historical negative CPU pilot. Original datasets,
experiments, scores and reports are preserved. Some archived workflow/status files
still describe preparation before the completed run; the completed report supersedes
those status claims without rewriting historical artifacts.

[Open the preserved Colab workflow](https://colab.research.google.com/github/rupeshhh007/ShellForge/blob/main/notebooks/ShellForge_Colab.ipynb).
For a private repository, download the notebook while signed into GitHub, upload it
to Colab, and supply a repository ZIP. Training/evaluation should run in the cloud;
this product sprint does not initiate new training or provision GPUs.

## Review 2 submission

- Academic report: [reports/ShellForge_Review2.pdf](reports/ShellForge_Review2.pdf) (four A4 pages), with [Markdown source](reports/ShellForge_Review2.md).
- Repository audit: [docs/review2_audit.md](docs/review2_audit.md).
- Full-corpus statistics/provenance: `data/review2/stats.json`, `discards.jsonl`, source SHA-256 hashes and per-record lineage.
- Actual results: `reports/metrics/`, including authored safety labels, confusion matrices, exact match, syntax validity and every generated example.
- Evidence: `reports/logs/`, `reports/compute.json`, real rendered source excerpts in `reports/figures/` (not UI screenshots).
- Small trained adapter and completion manifest: `artifacts/qwen-lora/`. Read its manifest before interpreting training scope.
- GPU continuation: [notebooks/ShellForge_Colab.ipynb](notebooks/ShellForge_Colab.ipynb).

The original measured pilot was performed in a cloud Linux CPU container. The full-data T4 continuation is completed and Review 2 is merged. Historical pilot artifacts and original datasets/splits remain preserved; product work lives on `feat/shellforge-product-v2`.

## Measured results

| Experiment | Held-out n | Exact match | Bash syntax validity |
|---|---:|---:|---:|
| TF-IDF 1-NN baseline | 1,254 | 0.00% | 100.00% |
| Qwen2.5 base | 32 | 9.38% (3/32) | 100.00% |
| Qwen2.5 + LoRA pilot | same 32 | 6.25% (2/32) | 100.00% |
| Final T4 base · unexposed | 1,222 | 2.29% (28/1,222) | 98.20% |
| Final T4 rank-16 LoRA · unexposed | 1,222 | 6.87% (84/1,222) | 99.35% |

The 20-step CPU LoRA pilot **completed but did not improve exact match**. It trained 540,672 parameters, using 128 prepared examples and 80 example presentations (0.625 epoch). Training loss was 1.4333; validation loss 1.3759 on 128 validation examples. This is not a full-data training claim. The final authored safety benchmark has 102 cases, macro F1 0.9817, zero dangerous false negatives and two benign compound-command false positives. It was used during policy development and does not prove general safety.

Full preprocessing retained 12,545 records from 12,967 ingested occurrences: 348 duplicate occurrences and 74 invalid-syntax occurrences discarded. Splits: 10,036 / 1,255 / 1,254; 9,328 equivalence groups, largest 45, zero checked cross-split overlaps. Heuristic labels: SAFE 4,128 / CAUTION 2,368 / DANGEROUS 6,049. Independent verified corpus labels: zero. All 37 tests, Python compilation and focused lint passed.

## Install and reproduce on cloud CPU

Python 3.12 and `/bin/bash` are required. Do these steps in a cloud runtime, not on the user's PC.

```bash
git clone --branch main https://github.com/rupeshhh007/ShellForge.git
cd ShellForge
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m src.preprocess_dataset
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python -m pytest -vv -s
python -m src.evaluate
python -m src.inference "Show the current working directory"
python -m src.safety_validator 'rm -fr /tmp/cache'
python scripts/build_report.py
```

Alternatively `bash scripts/reproduce.sh` rebuilds full-corpus preprocessing, tests, baseline metrics and the report after dependencies are installed. Shell syntax validation uses `/bin/bash --noprofile --norc -n` with clean environment and stdin input. It does not source BASH_ENV or execute command text. Tests verify this using marker files that remain absent.

Processed `.jsonl` outputs are generated deterministically in `data/review2`; archived `.jsonl.gz` files, if supplied, preserve the measured snapshot. Original `data/processed` is the Review 1 pilot and must not be used for Review 2 training/evaluation. The legacy `src/build_pilot_dataset.py` remains unchanged for historical reproduction and is not part of the new pipeline.

## Real Qwen base and LoRA experiment

The base model is `Qwen/Qwen2.5-0.5B-Instruct`, pinned to revision `7ae557604adf67be50417f59c2c2f167def9a775`. The shipped experiment uses ordinary LoRA on CPU, not QLoRA. Install torch from the CPU index first to avoid unnecessary CUDA dependencies.

```bash
python -m pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements-model.txt
python -m src.evaluate --backend hf --revision 7ae557604adf67be50417f59c2c2f167def9a775 --limit 32 --output reports/metrics/base
# Archived pilot configuration is recorded in its manifest. New trainer uses validation checkpoints.
python -m src.experiment_data --restore
python -u scripts/run_gpu_experiments.py --output /content/drive/MyDrive/ShellForge/full-data-v1
python -m src.evaluate --backend hf --revision 7ae557604adf67be50417f59c2c2f167def9a775 --adapter models/qwen-lora --limit 32 --output reports/metrics/tuned
python -m src.inference "Show the current working directory" --backend hf --revision 7ae557604adf67be50417f59c2c2f167def9a775 --adapter artifacts/qwen-lora
```

The base and tuned model must use identical test hashes, selection and decoding settings. `--limit 32` is a deterministic convenience subset, not a full test claim. Use no limit to evaluate all 1,254 held-out records. The archived pilot used a seed-42 shuffled selection of 128 training examples, masked prompt labels, rank-8 q_proj/v_proj adapters and 20 optimizer steps with gradient accumulation 4. This is a tiny feasibility pilot; 128 prepared examples does not imply a full epoch was trained. The completion manifest contains actual loss, runtime, selected/used/discarded examples, model revision and dataset hashes. CLI inference works with the included adapter; base weights are downloaded from Hugging Face.

For the full-data continuation, use the Colab notebook and [research protocol](docs/full_data_experiments.md). It trains without an example cap, saves validation-selected checkpoints, compares two learning rates on validation, then freezes selection before final testing. The primary test has 1,222 cases unexposed to the old pilot; the supplemental 1,254-case comparison discloses the 32 previously used cases. All compute and model storage remain in Colab/Drive. Optional QLoRA requires installing bitsandbytes on CUDA and passing `--qlora`; it was not run in this submission.

## Data integrity and policy limits

Both corpus files contain 12,607 lines. Count equality verifies positional alignment only; it does not establish semantic correctness of every pair. Core JSON fields are checked for types, emptiness and NULs, and command syntax is checked without execution. Command bytes are preserved. Duplicate sources are retained as lineage. Connected-component splits group shared normalized instructions, literal Bash AST quote/spacing equivalents and known additive ls/rm option equivalents; arbitrary semantic paraphrases and all shell equivalences are not solved.

Corpus risk/category labels are heuristic, with no independent verified-risk claim. Original annotations are tagged unverified. The authored 102-case safety benchmark provides separate operation-based labels and justifications; it is assistant-authored, lacks external adjudication and was used during policy development. It is not an untouched adversarial generalization benchmark.

`SAFE` means the static policy recognized allowlisted behavior; it is not a security guarantee or authorization to execute. Unknown utilities require review. Shell control flow, embedded languages, substitutions and execution wrappers are conservatively rejected or reviewed. Results always include `executed: false` and require manual review. Previews are limited to literal simple recursive `rm` targets and use a validated `ls -ld -- ...`; no generic safe alternative is invented.

Exact command-byte match can underestimate equivalent commands. Bash syntax validity cannot establish intent correctness. A retrieval baseline copies valid commands and cannot synthesize unseen commands; its syntax score should not be mistaken for translation accuracy. Small base/tuned experiments do not establish production suitability.

## Validation

```bash
python -m compileall -q src tests scripts
python -m pip install ruff
python -m ruff check --select E9,F63,F7,F82 src tests scripts
git diff --check
```

Product checks:

```bash
python -m pytest tests/test_product_api.py tests/test_safety.py -q
python -m ruff check --select E9,F63,F7,F82 services tests/test_product_api.py
cd apps/web
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Run the API and frontend before the browser suite. Set `PLAYWRIGHT_BASE_URL` to test a
production server on another port. The suite saves actual screenshots under
`docs/visual-qa/screenshots`. The full research suite also needs the existing research
requirements, notebook test dependencies (nbformat, pypdf, IPython), and immutable
splits restored via `src.experiment_data.restore_splits()`. Model integration tests
skip when optional torch/Transformers/PEFT dependencies are absent; no new training
is claimed. Historical compute logs remain under `reports/`.

Known limits: narrow grammar, curated token coverage, incomplete static policy,
per-process in-memory rate limits, no runtime environment access, no persistent
history, and no configured production inference. See the architecture and QA report
for practical boundaries. The runtime npm audit is clean at delivery; development
lint tooling reports the unpatched braces advisory GHSA-vfj7-8cjw-p6xm.
