# Interactive laboratory QA — 2026-10-22

The user-supplied Scribo reference was inspected with view_image. Built-in ImageGen
produced two complete design boards and original transparent terminal art. Real
browser captures were also inspected with view_image. Playwright was used because
the in-app browser was unreliable in the earlier QA session.

Compared: cream/evergreen palette; expressive headings/body/mono hierarchy;
terminal material, transparency and crop; asymmetric experience entrances; native
readability of selected files, exact byte values, permission bits and actual model
outputs. Intentional concept deviations replace invented files, outputs, “confidence”
claims and inaccurate find examples with actual evidence and documented boundaries.
Screenshots are product renders, not flattened concept images. Desktop 1440×1000
and mobile 390×844 were captured; the full browser suite also covers 768, 1024 and
1920 widths. No horizontal overflow or browser errors remain in those checks.

## Verified

```bash
cd apps/web
npm run test:unit  # 123 tests
npm run lint
npm run typecheck
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3014 npm run test:e2e  # 33 production browser tests
```

```bash
.venv/bin/python -m pytest tests/test_product_api.py tests/test_safety.py tests/test_model_runtime.py tests/test_final_research_export.py -q  # 100 tests
.venv/bin/python -m ruff check --select E9,F63,F7,F82 services scripts tests
.venv/bin/python -m compileall -q services scripts tests
```

Full historical research verification remains in Linux GitHub CI, where the report
fonts and optional model dependencies are provisioned. These focused local totals
do not claim that every historical report-building test passed on macOS.

Browser regression includes all original API, unsupported grammar, XSS/inert text,
keyboard/copy, cancellation, viewport and simulator cases. Added checks cover final
research cohort/provenance, separate pilot, honest unavailable-live mode, templates,
permission bit application/undo, native focus trap/Escape/restoration, actual CPU
policies and invalid inputs, trace playback and reduced-motion/mobile layouts.
A stale expected dark match color and removed nav label were updated without
removing their behavior assertions. Next's research-diagram loading warning and
real hero overflow were fixed rather than ignored.

## Actual inference evidence

`docs/product/evidence/selected-model-smoke.json` is genuine CPU base/tuned inference.
`browser-live-model-response.json` records a real browser → product API → privately
authenticated loopback runtime → selected adapter → independent static analysis.
The recorded response was complete and never executed. The saved artifact does
not claim the public site has an always-on runtime.

`studio/product-walkthrough.webm` records the actual live model response, filesystem
handoff, GNU size change, interpreter events, preview/apply/undo, permission change
and scheduling. `scripts/record_product_qa.cjs` reproduces the recording; set
QA_LIVE_MODEL=1 only when an actual runtime is configured. It has no mocked outputs.

## Limits

No page replacement module, real kernel/process execution, symlinks, ACLs, file
contents, multi-user contexts or always-on free model host are claimed. The new
Colab inference path is prepared; the verified run in this sprint used CPU.
Render cold starts and network/authentication failures are shown as errors.
No credentials or model weights are stored in QA artifacts or Git.
