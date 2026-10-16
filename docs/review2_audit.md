# Review 2 repository audit

Audited source snapshot: `ad24e3dc045fadacca75f796b99107b7072a60a6` on main, retrieved through the GitHub connector into a cloud Linux container. The repository tree contained no AGENTS.md, dependency specification or tests. README.md was empty. All original data and docs/review1.md are retained byte-for-byte.

| Original path | Finding | Resolution |
|---|---|---|
| src/import_nl2bash.py | Top-level import side effects; zip silently truncated mismatched files; fixed 100 record limit; substring risk labels | Guarded CLI, count check before pairing, full-corpus default and separate output |
| src/build_pilot_dataset.py | Legacy 120-row builder; top-level execution; substring category inference | Preserved as legacy pilot reproduction; not imported or used in Review 2 |
| src/preprocess_dataset.py | Pair-only deduplication; unchecked field types; empty strings accepted; shared instructions/commands across random splits | Typed/empty/NUL validation, syntax rejection, connected equivalence groups and deterministic group split |
| src/safety_validator.py | Case-insensitive substring policy confused quoted text with executable actions; missed reordered flags and find deletion | Bash AST policy, syntax-only validation, conservative unknown behavior and validated literal previews |
| docs/review1.md | Proposed fine-tuning and comparison, not completed evidence; claims manual verification but no adjudication records | Preserved original; original annotations tagged unverified rather than promoted to independent labels |
| data/sample_dataset.jsonl | 20 records despite 19 newline characters; curated metadata | Preserved and merged with source lineage; no blanket independent verification claim |
| data/nl2bash_sample.jsonl | 100 imported rows | Preserved; deduplicated when merging full corpus |
| data/pilot_dataset.jsonl | 120 pilot rows | Preserved |
| data/processed/*.jsonl | Old 96/12/12 split does not isolate instructions/commands | Preserved; new artifacts in data/review2 |
| data/nl2bash/all.nl + all.cm | Both have 12,607 lines | Verified count equality and hashes; global semantic alignment remains unproven |

The full-corpus pipeline audits every original dataset and imports full NL2Bash plus all original JSONL occurrences, retaining merged provenance for duplicates. Generated Review 2 outputs are excluded from re-ingestion. Commands are never executed; bash -n receives command text via stdin in a clean environment. Risk/category statistics are heuristic rather than accuracy claims. Benchmark labels were independently authored from operation semantics, but lack external human adjudication. Group fingerprints cover shared instructions/commands, literal quote/spacing differences and known additive ls/rm flag variants; arbitrary Bash semantic equivalence and paraphrase leakage remain unsolved.

## Observed implementation issues

Direct cloud git clone failed because GitHub authentication was unavailable to git; connector reads and Git data writes were used instead. Initial model access with a newly installed Hugging Face client failed on an unavailable SOCKS dependency; compatible Transformers/PEFT versions resolved access. An initial training run was intentionally interrupted while tightening split equivalence; final training/evaluation must use the final split hashes. Initial safety benchmark found missed date setting and equals-style broad chmod, saved in reports/metrics/safety_initial.json; both were fixed before final evaluation. None of these issues is presented as a successful experiment.
