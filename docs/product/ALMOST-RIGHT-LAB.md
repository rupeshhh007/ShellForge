# ShellForge — The Almost Right Lab

The new primary experience is **Predict. Investigate. Prove.** It extends the
existing virtual interpreter; it does not introduce another command executor.
The cream/evergreen design, Forge, X-Ray, original workshop, scheduler, selected
Qwen inference path and historical research remain available.

## Finished teaching cases

| Direct route | Investigation | Independently expected answer for A | Transfer answer for A |
| --- | --- | --- | --- |
| `/cases/missing-100` | GNU rounded size equality versus `+` | `almost.bin` (99 MiB + 1 byte) and `exact.bin` (100 MiB); ok | `grain.bin` (1 byte) and `edge.bin` (1 MiB) match `1M`; ok |
| `/cases/locked-room` | Student-owned directory, `chmod 600` versus `700` | No regular-file paths; partial traversal | Mode **0111**, no owner read bit: cannot enumerate; partial. B can resolve the known child using ancestor x |
| `/cases/sticky-file` | Root-owned 1777 directory and root-owned writable file | No removal; error, including with `-f` | Student-owned read-only file can be unlinked; ok |
| `/beat` or `/cases/beat-model` | Genuine saved rank-16 prediction versus its explicit reference | Model `+10M` selects only `over.bin`; ok | Repaired `10M` selects `new-boundary.bin`; ok |

The first answer is immutable after locking. The result is computed by the same
interpreter used in the free-form lab. Playback uses its actual parse, resolution,
permission, visit, predicate, match, mutation and completion events. Pass/fail/skip
colors, active paths and removal stamps reflect those events. The initial evidence
board is explicitly an initial-state view; final A/B metadata is displayed separately.
Pause, step, rewind, scrub, speed and complete-trace controls work. A compact control
surface remains beside the files on desktop. Clicking a file pauses playback and
allows manual inspection until the next event.

A changed modifier is directly clickable after reveal. Its lens shows the rule and
actual path traces. Selected predictions move to a locked hypothesis tray through
shared layout animation. Native dialogs expand gallery dossiers, trap focus, close
with Escape, and restore focus. Essential information requires no hover. Reduced
motion removes transforms and all outcomes remain immediately inspectable.

## Evaluator and persistence

`lib/learning/cases.ts` owns the bounded case schema and validates all authored
operations at module load. `session.ts` owns transitions, exact path-set/status
scoring, repair constraints and transfer scoring. `shellforge-learning-v1` and each
case revision version the action log. Unsupported repairs cannot pass. The model
case repair must satisfy the explicit parsed reference constraints; a semantically
creative alternative outside that contract is not silently accepted.

Local storage contains action logs, not trusted scores. Recovery replays validated
transitions. Logs are bounded to 64 actions/case, 12 attempts, 12 case records and
200,000 serialized characters. Stale case revisions are discarded; corrupt or
unavailable storage produces an honest warning. Reset explicitly clears that case's
first answer and history. Export before resetting to preserve it. Cross-tab storage
changes update the displayed state. There is no account or cloud persistence.

Transfer is an unseen *interface* fixture, not a secure examination: all case data
ships in client code and can be inspected. It is independently scored once per
investigation. Practice counts describe attempts and correct follow-ups. They are
not evidence of mastery or measured educational improvement. No participant study
has been performed.

Completed JSON Investigation Records contain the first and revised predictions,
actual fixtures, both scenarios, complete results/events, counterexample certificate,
rule, hints, transfer question/outcome, genuine model provenance where applicable,
validated actions, evaluator/case revision and deployed source commit. `verifyRecord`
replays the action log and evaluator and compares the full artifact. It detects
inconsistent derived results; it is not a signature, identity system or tamper-proof
exam certificate. Export and print work without an AI request.

## Bounded counterexample algorithm

Implementation: `lib/counterexamples/search.ts`, version `bounded-witness-v1`.

1. Parse both commands using the existing strict grammar. An optional preparation
   may contain **one modeled chmod**, shown explicitly. Each scenario starts from
   the same immutable fixture; preparation events are included in its trace.
2. Derive required ancestor skeletons and optional probe paths. Names include
   `evidence.bin` and bounded literal/glob-derived candidates. Both file/directory
   probe kinds are considered; a starting path need not be a directory unless an
   explicit constraint requires it. The Locked Room declares that constraint.
3. Construct file byte sizes from `0,1,511,512,1024`, plus values adjacent to the
   command's `N*u` and `(N-1)*u` boundaries. Units are GNU `c,w,b,k,M,G`; default b.
   Reject unsafe integers and sizes beyond 1 TiB. Use at most 32 sizes and 4 names.
4. Enumerate nine declared parent-mode/owner and file-mode/owner profiles, including
   search-only, unreadable root-owned, sticky and student-owned cases. Add empty
   required skeletons as well. No profile contains a precomputed command answer.
5. Deduplicate canonical fixtures. Construction stops at 4,096 unique candidates;
   each contains at most 12 entries. This is a deliberately limited construction,
   **not the Cartesian product of all filesystems under those bounds**.
6. Sort the constructed domain by entry count, summed path depth, non-default
   mode/owner count, total logical bytes (including directory metadata), and
   canonical JSON as the final deterministic tie-break.
7. Independently run A and B on each candidate. Compare status, sorted reported
   paths, sorted error strings and final entry metadata, including logical modified
   counters. Exclude snapshot revision and traversal order. Return the first witness.

A found certificate means **minimal within the constructed finite domain under
that ordering**. It is not globally smallest, nor necessarily minimal for a different
observable definition. For example, an empty locked directory can distinguish final
status/metadata without containing a child. A size witness may use a regular file
as the starting path because GNU find supports that. The generated fixture shows
its kind explicitly.

A missing `rm` operand is a valid small witness for `rm` versus `rm -f`. It does
**not** bypass the sticky protection in the original scene; the interface says so.

No witness returns exactly “No distinguishing witness found within these bounds.”
The certificate reports candidate/evaluation counts and whether the constructed
domain was exhausted. A caller may lower the evaluation budget; a prefix with no
witness is not proof of equivalence. Unsupported grammar yields `unsupported`;
invalid bounds/constraints yield `out-of-domain`. Every witness can be stepped
through in the interface and is independently replayed in tests and record export.

## Optional grounded Gemini question selector

`services/api/tutor/` exposes `POST /api/tutor/question`. Its canonical fixture,
reference outcomes, rules and question choices are generated **from the TypeScript
evaluator** by `lib/learning/export-tutor.mjs`. `npm run test:unit` checks the saved
export is byte-identical; regenerate it when case semantics change. The browser
sends only a known case/revision and bounded prediction, never an arbitrary command
or free prompt. Unknown paths, repeated paths and stale cases are rejected.

Gemini can select an integer ID from three reviewed Socratic questions. The server
renders its canonical question, never model-provided prose or a model-generated
grade. Structured JSON, strict ID validation, complete-output checking and fixed
HTTPS host prevent a response from changing facts, files, commands or scores.
Curated hints and a local browser fallback always work.

By default **no external request can occur**, even if a key exists. To enable it,
the owner can set `GEMINI_API_KEY` directly in Render and explicitly set
`SHELLFORGE_TUTOR_BUDGET` to 1–20. Never paste keys into chat, Git or a browser
variable. The default model is `gemini-3.5-flash-lite`. There is one active slot,
at least 30 seconds between requests, at most 20 attempted outbound requests per
process lifetime, 12-second timeout, no retries/tools/redirects, 12 KB context,
64 output tokens and 8 KiB response cap. Failures consume a request reservation.

The budget is an in-memory process limit, **not a durable account-wide spending
cap**: restarts/multiple workers reset/multiply it. This release does not enable it
or change billing. Use a free-tier project and inspect provider quotas before
turning it on. No live Gemini success is claimed without an operator-owned key.
Provider outage, missing configuration, invalid output, rate and budget limits all
return an explicitly labeled deterministic question.

Official resources checked 2026-10-22: [model catalogue](https://ai.google.dev/gemini-api/docs/models),
[pricing](https://ai.google.dev/gemini-api/docs/pricing),
[structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output),
[GenerateContent API](https://ai.google.dev/api/generate-content), and
[rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). At inspection,
3.5 Flash-Lite offered free-tier input/output; standard paid prices were $0.30/$2.50
per million input/output tokens. Actual quota depends on project/tier in AI Studio.
No fixed RPM entitlement, free-tier availability or pricing is promised indefinitely.

## Preserved research and limits

The selected adapter and original final evaluation remain unchanged. Primary
strict exact match is base 28/1,222 and tuned 84/1,222 (6.87%); pilot results remain
separate. Beat the Model uses actual primary record `9150c88d558a05a3a2c0`, whose
saved prediction/reference are verified byte-for-byte against the preserved export.
The original request's MB wording is ambiguous. This reviewed challenge checks the
explicit saved GNU `10M` contract only; nonexact output in general is not thereby
proved semantically wrong. Saved Evaluation is not live model inference.

The free Render API never loads model weights. The separate authenticated Qwen
runtime and genuine saved CPU smoke evidence remain available; an always-on public
runtime is not configured. This release neither retrains nor fabricates model output.

Filesystem limits remain documented in `IMPACT-LAB.md`: metadata-only, fixed student
identity, no symlinks/ACLs/capabilities/mounts, modeled rather than full POSIX utility
behavior, no interactive rm prompts, no shell expansion/pipes/redirection/exec,
bounded atomic mutations. The unlink case demonstrates permission semantics,
not a terminal prompt protocol.
Scheduling stays in the existing free-form lab; no scheduling lesson, participant
study, secure examination, cloud progress, account or additional marketing section
was added. Four finished cases were preferred over six insufficiently tested ones.
