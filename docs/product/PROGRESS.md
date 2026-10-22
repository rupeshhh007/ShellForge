# Current sprint checkpoint — 2026-10-22

- Selected rank-16 adapter weights and manifest validated; SHA-256 identical.
- Genuine CPU base/tuned smoke and real browser → API → model → analysis verified.
- Separate authenticated, rate-limited inference service implemented. Public
  always-on serving remains unavailable; free Render does not load weights.
- Real final exports recovered: 1,254 raw rows; 1,222 primary pairs excluding the
  32 pilot-exposed IDs; 28 base and 84 tuned strict matches verified from raw data.
- Real interpreter event playback, bitwise permissions, state diffs and five
  deterministic CPU scheduling policies implemented and tested.
- Cream/evergreen creative studio replaces the rejected graphite/lime direction.
- 123 frontend unit, 100 focused Python and 33 production browser tests pass.
- New desktop/mobile captures, actual browser recording, inference provenance,
  Colab serving path and faculty demonstration guide included.
- PR #2 remains open and unmerged; deployment revisions are reconciled at release.

The following is the preserved earlier implementation log; its earlier design
and model-access statements are superseded by this checkpoint and INFERENCE.md.

# ShellForge product v2

Branch: `feat/shellforge-product-v2`, based on merged main `b508789`.

- [x] Audit research architecture and preserved artifacts.
- [x] Inspect creative references; record component licensing limits.
- [x] Discover full-data experiment in connected Drive (no inference provisioned).
- [x] Foundation: Next.js + FastAPI and validated, non-executing contracts.
- [x] Deterministic intent templates, existing static policy, token anatomy.
- [x] Original artwork and responsive editorial landing.
- [x] Forge, X-Ray, searchable Field Manual, authentic Bench.
- [x] API regression tests and existing research checks.
- [x] Browser flows, responsive screenshots, reduced motion and keyboard QA.
- [x] Production build, delivery docs, milestone commits and pull request.

## Implementation order

1. Reuse `src/safety_validator.py` through a bounded FastAPI service; add typed contracts,
   a deliberately narrow full-request grammar and structured recipe parameters. No
   default model loading, shell execution, filesystem inspection or automatic previews.
2. Build five Next.js routes around an editorial instrument design. One motion runtime
   (Motion for React), original artwork, local fonts, accessible native controls.
3. Verify request-to-proposal-to-inspection with real HTTP, then error, unsupported,
   clipboard and responsive states. Preserve screenshots as requested evidence.
4. Document deployment and limitations; push the feature branch and open a PR.

## Boundaries

The rank-8 pilot on disk is not the final rank-16 adapter. The final Drive run was
found under ShellForge/full-data-v1. No GPU or paid hosting is authorized. All
commands are proposals; Bash is invoked only with `-n`, with command text on stdin.
Syntax and static classification are never semantic or runtime guarantees.

## Visual revision

The first bone/copper UI was rejected by the user. The active design uses graphite,
acid signal color, readable Manrope controls, a native 3D command assembly and
state-driven token motion. See DESIGN.md and the current visual QA report.

PR: https://github.com/rupeshhh007/ShellForge/pull/2 (not merged).

## Operating Systems Impact Lab

Strict in-memory interpreter, immutable fixture, predicate trace, permission-aware
mutation previews, apply/undo, cross-route session and saved pilot comparison are
implemented. 96 unit/research tests, 82 API/safety tests and 27 production browser
tests pass. See IMPACT-LAB.md for grammar, limitations, review and demonstration.
Deployment reconciliation is performed from a clean committed revision.
