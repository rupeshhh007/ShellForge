# Six-minute faculty demonstration

Public start: [flagship case](https://shellforge-workshop.vercel.app/cases/missing-100).
No login, API key or Gemini request is required. To show the gallery expansion,
start at [the case gallery](https://shellforge-workshop.vercel.app/). Use a fresh
browser profile, or the explicit “Start a new investigation” reset for each case.

| Time | Demonstration and exact actions |
| --- | --- |
| 0:00–0:40 | Open the 100 MiB dossier. Click `almost.bin`: **103,809,025 bytes**, one byte over 99 MiB. Inspect `exact.bin` and `over.bin`. Both commands differ by `+`. All entries are synthetic metadata |
| 0:40–1:20 | Make a prediction. Select only `/lab/evidence/exact.bin`, choose **Completes**, and lock. Reload once: the first hypothesis stays locked. Run both commands |
| 1:20–2:00 | Step events beside the files. Show a size predicate's actual ceil calculation, a failed predicate and a skipped predicate. Play/pause/rewind or scrub to the end. A reports almost + exact; B reports over. The first answer is honestly marked different |
| 2:00–3:00 | Dissect. Click the `+` modifier; inspect the real discrepancy. Find a counterexample. The constructor's small fixture may be a regular file at `/lab/evidence`, **103,809,025 B**. GNU find accepts a file starting path. Show independently computed A/B results, witness step controls, counts and bounded minimality statement |
| 3:00–3:50 | Revise: select almost + exact and **Completes**. Verify. Try the unseen `1M` boundary. Select grain + edge, **Completes**, commit. One-byte grain matches because ceil(1/1,048,576)=1. The exact-byte B predicate selects only edge |
| 3:50–4:20 | Export Investigation Record. It contains the original wrong first answer, corrected attempt, full fixture/trace/witness, separate transfer outcome and source versions. Open/print it. Local evidence is not a mastery certificate |
| 4:20–5:10 | Open [Locked Room](https://shellforge-workshop.vercel.app/cases/locked-room). Predict no paths and **Partial traversal**. Run, finish trace, dissect. Owner 0600 has r+w but lacks x; 0700 permits traversal. In the transfer, 0111 has x but no r: find cannot enumerate, while the known-child B path succeeds |
| 5:10–6:10 | Open [Beat the Model](https://shellforge-workshop.vercel.app/beat). Show the actual preserved Qwen prediction `+10M`, reference `10M`, provenance and ambiguous MB caveat. Predict over only, Completes; run/dissect; repair to `find . -size 10M`. Explain primary 6.87% is strict exact match, not semantic success. Saved Evaluation is not live inference |

If asked about sticky deletion: root owns `/lab/drop` (1777) and `report.txt`
(0666). Neither plain rm nor rm -f removes it as student. The computed rm/rm-f
witness instead distinguishes a missing operand, not a permission bypass. Transfer
uses a student-owned **0444** file: parent w+x and sticky ownership allow unlink.

If asked about safety: interpreter/witness/lesson modules manipulate bounded data
structures and never import a filesystem or process executor. Existing API AST
analysis remains separate. Bash syntax checking uses syntax-only mode; no submitted
command runs on the host.

If asked about novelty: refer to `TEACHING-TOOLS-COMPARISON.md`. Prediction,
stepwise visualization, scheduling tools and command explanations have prior art.
The project-specific contribution is their integration with deterministic small
witness construction, immutable first-answer evidence, transfer scoring and real
preserved model mistakes under reviewed contracts.

If asked about proof: show unit tests, the browser tests completing all four
investigations and exporting records, the exact bounded search definition, and
`verifyRecord`. No witness is not equivalence. No software test establishes that
students learned more; no participant evaluation has been conducted.
