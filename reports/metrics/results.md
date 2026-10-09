# Actual evaluation results

Generation backend: baseline; n=1254; exact match=0.0000; Bash syntax validity=1.0000.

| Class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| SAFE | 1.0000 | 0.9333 | 0.9655 | 30 |
| CAUTION | 1.0000 | 1.0000 | 1.0000 | 24 |
| DANGEROUS | 0.9600 | 1.0000 | 0.9796 | 48 |

Dangerous false negatives: 0.

Exact match is strict and can underestimate equivalent commands; no semantic correctness score is claimed. Retrieval copies a valid training command, so syntax validity says little about intent accuracy. Safety labels are authored independently but are not externally adjudicated. No base-vs-tuned comparison unless both actually run.
