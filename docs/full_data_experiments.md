# Full-data continuation: diagnosis and cloud execution

Status: workflow prepared; new GPU training and final evaluation have **not** executed. The shipped adapter remains the original negative pilot. Do not report a new accuracy, loss, step count, epoch count, or adapter as measured until `completion.json` and its training manifest exist.

## Evidence and diagnosis

The preserved `artifacts/qwen-lora/training_manifest.json` records 128 selected/encoded training examples, 20 optimizer steps, accumulation 4, batch 1, and 0.625 epoch: **80 presentations**, under 0.8% of a 10,036-example epoch. The mean training loss was 1.4333 and final validation loss 1.3759 on 128 selected validation rows. There is no pre-training loss on the same validation rows, periodic validation history, or validation-selected checkpoint; the loss alone does not establish improvement.

Archived generation outputs compare identical first-32 test requests and greedy decoding: base 3/32, pilot 2/32, both syntactically valid. One example changes the score by 3.125 percentage points. `scripts/analyze_pilot.py` calculates Wilson intervals and the exact paired McNemar test from those saved outputs; these quantify uncertainty rather than turn a one-example regression into a causal conclusion. The test was already exposed; new selection must use validation only.

Code inspection found consistent system/user generation prompts between `encode_example` and `HFGenerator`, answer-only labels, and an appended tokenizer EOS. There is **no demonstrated masking/EOS bug** responsible for the original decline. New real-tokenizer and padding regression tests check the chat-template prefix and distinguish supervised EOS from ignored EOS-valued padding. The original inference silently truncated prompts at 512 tokens and capped outputs at 96 new tokens. The new shared comparison budget is 256 output tokens; overlength input abstains explicitly and is scored as a failure. This is a new decoding protocol for both models, not a retroactive change to pilot results.

The pilot trains only q_proj/v_proj with rank 8 (540,672 trainable parameters). A small 0.5B model and limited adapter capacity are plausible constraints, **not experimentally isolated causes**. The original LR 2e-4 is also not proven responsible. The prepared trials keep the same pinned base model and compare LR 1e-4/5e-5, rank 16 attention + MLP targets, full-data training and validation selection. A larger Coder model is deferred so model-upgrade gains cannot be confused with fine-tuning gains.

The original preprocessing already removed 348 duplicate occurrences and 74 syntax-invalid occurrences before producing the 10,036/1,255/1,254 split. Connected groups exclude shared instructions, command fingerprints and known additive flag variants across splits. This deliberately tests novel commands more strictly than a random example split. It prevents retrieval from copying an identical held-out command (0/1,254 exact matches), but does not establish that the split is representative of deployment or that all paraphrase leakage is eliminated. We preserve it for comparability rather than weakening it to improve scores.

## Training-only data audit

Restore archived gzip splits and verify each against the pilot's recorded SHA-256. Do not rerun preprocessing to choose easier groups. `src.experiment_data` audits **only training** and records exact removal counts for malformed fields, duplicate pairs and invalid Bash syntax. It flags multiple targets for the same instruction, structural target duplicates, commands longer than 512 characters, and 100 seeded alignment-review pairs. Alternative valid commands are not automatically discarded as conflicts. A seeded 100-pair static review found ten clear mismatches or unsupported tasks, now byte-verified in `benchmarks/train_pair_exclusions.json`: wrong path, missing scp destination, modification/access/status-time confusion, invalid find predicates, unintended deletion, broken-link restriction, ownership/precedence mismatch, and a ksh-only request. These are assistant-reviewed exclusions, not independent human labels. The remaining 90 sample pairs have no definite error established by this limited review; they are not certified correct. Semantic alignment, embedded awk/sed program validity, ambiguous instructions and unsupported tasks still need human review; syntax validity is not semantic certification. Token-budget exclusions and IDs are recorded separately by each training run. Validation/test command bytes and membership are unchanged.

## Cloud-only workflow

Open `notebooks/ShellForge_Colab.ipynb` in Colab, connect a CUDA GPU, and run all cells. All installs, weights, data processing, training, inference, tests and report generation run in Colab. Mount Drive to preserve run outputs; the default is `/content/drive/MyDrive/ShellForge/full-data-v1`. No paid resource is provisioned by this repository.

Proposed starting protocol (not measured training):

- Qwen/Qwen2.5-0.5B-Instruct revision `7ae557604adf67be50417f59c2c2f167def9a775`.
- All audited training examples; all 1,255 validation examples for generation selection. No training example cap.
- Maximum 3 epochs, rank 16 / alpha 32, q/k/v/o + gate/up/down targets, dropout 0.05.
- Batch 2, accumulation 8, effective single-GPU batch 16. Approximately 628 steps/epoch before token exclusions; actual counts come from Trainer state.
- 512-token supervised budget; no truncation of labels or prompts. Log exclusions explicitly.
- LR trials 1e-4 and 5e-5, cosine schedule, 5% warmup, weight decay 0.01, seed 42.
- FP16 on T4, BF16 when CUDA supports it. Ordinary LoRA for 0.5B; CLI QLoRA requires a separate bitsandbytes install on CUDA.
- Initial validation loss; loss/checkpoint every 100 steps, two retained checkpoints, early-stopping patience 3. Save the best validation-loss adapter.
- Choose the trial by full-validation strict match, then validation loss. Loss-selected checkpoints are a practical proxy and may differ from generation-optimal checkpoints.

These are justified starting settings, not claims of optimality. Check the printed GPU memory and encoded length distribution. If OOM occurs before test, preserve the failed logs and reduce batch while increasing accumulation to retain the effective batch. The workflow raises rather than silently falling back to the user's CPU. The notebook accepts a repository ZIP without a GitHub token, records its SHA-256 and an explicitly unverified archive commit label, and resumes the same Google Drive run automatically. Resume verifies settings, source/data hashes and complete optimizer/scheduler/RNG checkpoints; completed runs are preserved. Each held-out prediction is journaled durably, so reconnecting continues only unfinished examples. Use the same ZIP and GPU type when reconnecting. The two trials are a bounded comparison, not an endless search; if neither improves validation, completion explicitly records that failure and does not promote the adapter as improved.

Exact cloud command:

```bash
python -u scripts/run_gpu_experiments.py --output /content/drive/MyDrive/ShellForge/full-data-v1
```

The runner saves exact argv and live logs, GPU/package/git metadata, source hashes, quality audit, train manifests, step/epoch counts, train/initial/final validation losses, checkpoint history, selected adapter hashes, and frozen selection settings. Driver subprocess failures propagate. Interrupted runs are not declared completed; Drive retains their intermediate evidence.

## Evaluation integrity

Only after `selection.json` is frozen does the driver read and evaluate final test requests. It evaluates base and selected tuned model on the exact same full 1,254 examples, same model revision/system prompt and greedy 256-token decoding. The primary comparison excludes the **32 IDs already exposed by the pilot**, leaving **1,222 previously unexposed cases**; the all-1,254 comparison is supplemental and discloses that exposure. Do not tune after either test result is known.

Metrics: strict match, Wilson 95% intervals, paired exact McNemar test, Bash parse-only syntax validity, AST trivia-normalized match preserving literal quoting/expansions/arguments, node-kind Dice overlap with parse-supported denominator, heuristic per-category results and descriptive failure categories. Correlated corpus groups can make binomial intervals optimistic. AST node overlap can be 1 even for `cat a` versus `rm a`; it is expressly **not** command equivalence. Every nonexact prediction is exported for human semantic review, without fabricated equivalence labels. The separate 102-case authored safety benchmark remains a development benchmark, not independent adversarial generalization evidence. Execution stays disabled.

## Deliverables after execution

`completion.json`, `comparison.json`, `selection.json`, `compute.json`, `logs/commands.jsonl`, `trial-*/history.json`, `trial-*/training_manifest.json`, and the selected `trial-*/adapter/`. Load with:

```bash
python -m src.inference 'Show the current working directory' --backend hf \
  --revision 7ae557604adf67be50417f59c2c2f167def9a775 \
  --adapter /content/drive/MyDrive/ShellForge/full-data-v1/trial-1/adapter
```

Use the **actual selected adapter** from `selection.json`, not an assumed trial number. The original adapter remains in `artifacts/qwen-lora/` unchanged. Adapter/model IDs and revisions are checked at loading.

```bash
python scripts/build_report.py --experiment /content/drive/MyDrive/ShellForge/full-data-v1
```

The report keeps all six teacher sections and all negative pilot scores, then adds completed measured results. It rejects incomplete evidence. The notebook checks four A4 pages and displays the PDF in the cloud for visual review. Without an experiment, the report states full-data GPU training is pending. Do not publish it as a completed full-data experiment.

Implementation references: [Transformers Trainer](https://huggingface.co/docs/transformers/v4.57.1/en/main_classes/trainer), [PEFT LoRA](https://huggingface.co/docs/peft/en/developer_guides/lora). These APIs inform implementation, not experimental outcomes.

Utility evidence for the static review: [GNU findutils predicates and expression precedence](https://www.gnu.org/software/findutils/manual/html_mono/find.html), [OpenBSD scp operands](https://man.openbsd.org/scp), [Bash pipeline subshell behavior](https://www.gnu.org/software/bash/manual/html_node/Pipelines.html). No corpus command was executed to obtain this evidence.
