# Almost Right Lab — implementation and browser QA

Verified 2026-10-22 on macOS/Chromium. Browser plugin/skill was not available;
regular Playwright from the existing project dependency was used. No simulated
interpreter result, network receipt, research prediction or screenshot was mocked.

The flow under test was: gallery/direct case → inspect metadata → lock first
prediction → real trace → modifier focus → computed witness/replay → corrected
prediction → independent transfer → downloadable Investigation Record.

## Results

| Check | Actual result |
| --- | --- |
| Node unit tests | **146 passed**, including existing interpreter/scheduler/diff tests and new witness/learning tests |
| Focused Python suite | **120 passed**, including 20 optional-tutor tests, API, runtime, safety and genuine final-export checks |
| Lint / TypeScript / optimized Next build | Passed; all four case routes statically generated |
| Development browser regression | **41 passed** |
| Optimized production browser regression | **41 passed** at `http://127.0.0.1:3007`, real local API on 8016 |
| New full teaching episodes | All four completed and exported; expected file choices/statuses asserted independently |
| First prediction persistence | Locked through refresh; a deliberate wrong first answer stays wrong after a correct revision |
| Witness | Constructed fixtures, independent A/B results, bounded certificate, branch selection and event stepping verified |
| Model repair | Unsupported shell suffix rejected; reviewed `find . -size 10M` accepted |
| Transfer | Separate one-shot fixture, expected outcomes asserted; incorrect transfer cannot be replaced in the same investigation |
| Actual downloaded record | Independently replayed against source `verifyRecord`; inconsistent derived results rejected |
| Keyboard | Native dialog focus trap, Shift+Tab, Escape and restoration; keyboard range controls |
| Responsive / reduced motion | New flow at 390×844; desktop 1440×1000; existing product checks also cover 768, 1024, 1440 and 1920 widths |
| API tutor fallback | Actual browser → same-origin API → labeled deterministic question; explicit clue opening recorded |
| Runtime/page health | Correct title and meaningful content, no framework overlay; no relevant errors in verified flow |

The optimized build and the recorded artifacts were captured before the UI commit,
so the record correctly labels its build source `local`. Do not infer a deployed
Git SHA from these local screenshots. Final public identity is independently
checked via `/api/version`, direct/proxied `/api/health` and the PR head after release.
Full Linux research/model-dependency testing runs separately in GitHub Actions.

## Concrete issues found and fixed

- The initial transfer mode 0711 accidentally granted owner read. Changed to **0111**
  and added explicit independent checks: enumeration partial, known child succeeds.
- Manual object inspection during playback was overridden by the active event.
  Clicking now pauses and holds that object until the next event.
- Pass, fail, skipped and denied states initially looked too similar. They now use
  distinct state-derived borders, colors, opacity/stamps; no decorative timeline.
- The witness result footer inherited dark text over evergreen. Its final style
  uses a cream surface. Screenshots wait for the actual reveal to settle.
- Mobile inspection now fills available width. Permission metadata keeps a stable
  font when event stamps appear. Reduced-motion styling no longer exposes the skip
  link except when focused.
- An early test assumed a child filename. The computed minimum valid witness uses
  a regular file at the starting path; its kind is now explicitly displayed.

## Evidence and reproduction

These are actual browser captures from the optimized build:

- `gallery-desktop.png`, `gallery-mobile.png`: retained material/palette and new cases.
- `trace-desktop.png`: actual ceil predicate, highlighted path and adjacent controls.
- `witness-desktop.png`: actual fixture, independent outcomes and replay controls.
- `evidence-mobile.png`: full-width metadata inspection at native 390-pixel width.
- `learning-walkthrough.webm`: actual complete flagship interaction and export.
- `shellforge-missing-100-investigation.json`: real downloaded record, not a fixture
  authored to look like user activity. The first prediction intentionally differs.
- `browser-evidence.json`: capture URL/time, viewports and error collection.

```bash
npm --prefix apps/web run test:unit
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
SHELLFORGE_API_ORIGIN=http://127.0.0.1:8016 npm --prefix apps/web run build
# Run API on 8016 and optimized frontend on 3007, then:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3007 \
  PLAYWRIGHT_EVIDENCE_DIR=/tmp/shellforge-qa npm --prefix apps/web run test:e2e
QA_BASE_URL=http://127.0.0.1:3007 \
  PLAYWRIGHT_EVIDENCE_DIR=/tmp/shellforge-recording node scripts/record_learning_qa.cjs
```

No participant evaluation, Safari/Firefox QA, live Gemini call or new public
always-on Qwen runtime was performed. The optional tutor's provider transport and
failure cases were tested with bounded fake providers; they are not presented as a
successful real Gemini response. All central lessons work without it.
