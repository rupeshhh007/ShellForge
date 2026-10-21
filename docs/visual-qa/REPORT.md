# ShellForge v2 verification — 21 October 2026

## Product result

The production Next.js build passes all **14 Playwright Chromium tests** against the
actual FastAPI service. Default model serving and command execution are disabled.
The standalone API/product regression suite plus existing safety tests passes
**81 tests**. TypeScript strict checking, ESLint, Python compilation and focused
Ruff checks pass. The runtime npm dependency audit reports zero vulnerabilities.

## Environment and evidence

Local macOS, Python 3.13.5, Node 26.12.0, Next.js 16.4.2, React 19.3.1, Motion 14.5.0,
Playwright 1.64.1 / Chromium. API `http://127.0.0.1:8010`; development UI port 3000;
production verification UI `http://127.0.0.1:3010`. The dedicated Browser plugin/skill
was not listed. The in-app browser was used for initial real navigation, proposal,
token, clipboard and screenshot inspection. The explicitly requested Playwright
suite provides repeatable viewport, error and screenshot coverage.

Actual full-page browser captures are in `screenshots/`. There is one capture of each
of the five routes at **390×844, 768×1024, 1024×768, 1440×900 and 1920×1080** (25 total),
plus the mobile Inspector state. Review sheets and viewport crops are derivatives of
those actual captures; they are not generated mockups. Concept images remain in
`docs/product/concepts/` and are separately identified.

The concept and final browser images were opened with `view_image`. Review covered
the five viewport sheets for all routes, desktop hero and workbench at readable size,
mobile inspector, and downstream landing chapters. The implementation retains the
concept's material palette, editorial scale and dark-command/bone-inspector split;
the separate generated sculpture, original diagrams and truthful policy copy are
intentional adaptations documented in the design notes.

## Verified flows

| Check | Result / evidence |
| --- | --- |
| Page identity and meaningful render | Five routes render correct titles/headings; no blank pages |
| Landing → Forge | First-view invitation opens the functional workbench |
| Supported NL → proposal | Actual HTTP response equals rendered command, constraints and static classification |
| Unsupported / ambiguous request | Clear abstention; MB vs MiB and macOS size-recipe constraints ask for clarification |
| X-Ray | Recursive deletion is DANGEROUS; malformed quotes report invalid syntax |
| Token anatomy | Selecting +100M explains GNU rounding; arrow keys change selection/focus |
| Copy | Actual clipboard bytes equal the API command; copy feedback appears |
| Manual | Search/filter, no-results reset and edited path/threshold reach the real template |
| API failure and cancel | 503 renders an error; cancellation invalidates pending work and prevents a receipt |
| Input rendering | HTML-like command data produces no HTML element; Unicode token offsets remain correct |
| Keyboard | Skip link → request → profile → submit → command tokens; divider arrow resizing |
| Mobile | Menu navigation, touch token selection and Command/Inspector switching |
| Reduced motion | No smooth scrolling; transform entrances disabled; no hydration mismatch |
| Responsive overflow | Document width stays within every requested viewport; code/table regions own their overflow |
| Console / framework overlays | No app warning/error or visible framework error overlay in the production viewport matrix |
| Historical claims | 6.87% strict exact match and separate 0.9817 safety macro F1 remain explicitly distinguished |

## Corrections driven by real QA

- Tablet hero artwork extended the document horizontally. Its right inset is now
  bounded and the hero clips only its decorative motion region.
- Reading the browser preference directly during SSR hydration changed Motion's
  initial styles for reduced-motion users. A hydration-consistent external-store
  preference plus pre-JS reduced-motion CSS fixes the mismatch.
- Unicode offsets originally used JavaScript UTF-16 slicing against Python code-point
  indices. Receipt validation/rendering now slices code points; a real emoji command
  is covered by the browser suite.
- Added Next's `data-scroll-behavior` declaration after the initial IAB console warning.
- Narrowed an error test to the app alert rather than also matching the framework's
  route announcer. Visible-overlay checks test visibility instead of hidden dev DOM.
- The command resizer has pointer capture and keyboard semantics; mobile avoids a
  compressed split by explicitly switching panels.

## Performance observations

See `performance.json` for the recorded unthrottled localhost production sample:
DOMContentLoaded 408 ms, load 647 ms, resource transfer approximately 345 KB, script
transfer approximately 215 KB, optimized image transfer approximately 21 KB. A
90-frame observation reported 16.7 ms median and 16.8 ms p95 intervals. These are
local observations, not mobile field measurements or a 60 FPS promise. The hero
source is approximately 66 KB WebP. No WebGL, third-party analytics, external runtime
font loading or overlapping animation runtimes are included.

## Research checks and remaining limits

The unchanged full Python suite on this Mac reports **107 passed, 6 skipped, 1 failed**.
The failure is `test_every_notebook_cell_in_order`: the preserved report builder
requires `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`, a Linux path absent here.
The six skips are optional torch/Transformers/PEFT model integrations. Initial missing
notebook packages and decompressed splits were resolved by installing the existing
test prerequisites and hash-verified immutable restoration; original archives were
not changed. Research modules, datasets, reports and notebook sources have no diff.
The added Ubuntu product CI installs the Linux font/Poppler prerequisites and runs
the full CPU suite; remote results must be checked separately from local results.

Docker CLI exists but its daemon socket is unavailable. The API Dockerfile is
prepared, not claimed container-tested. Deployment requires the pending Render
workspace selection; no live URL or paid provisioning is claimed. Final model
binary/serving resources remain unconfigured. Only Chromium is covered here; Safari,
Firefox, real-device touch and throttled mobile performance remain unmeasured.

`npm audit` reports the unpatched development-only `braces` advisory
GHSA-vfj7-8cjw-p6xm through Next's lint tooling. The runtime audit is clean. No
framework downgrade or test suppression was applied to hide that advisory.

## Reproduce

```bash
# Repository root; run the API separately.
.venv/bin/python -m pytest tests/test_product_api.py tests/test_safety.py -q
.venv/bin/python -m compileall -q src tests scripts services
.venv/bin/python -m ruff check --select E9,F63,F7,F82 src tests scripts services
cd apps/web
npm run lint
npm run typecheck
npm run build
npm run start -- --port 3010
# In another terminal, from apps/web:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 npm run test:e2e
```
