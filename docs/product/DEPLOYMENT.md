# Deployment

The default product is CPU-only and non-executing. No paid plan or GPU is required.
Production builds have a real FastAPI dependency; publishing the frontend alone
without its API origin does not make a functional workbench.

## Backend on Render (free web service)

Use the feature branch `feat/shellforge-product-v2` until the PR is approved. Do not
merge main just to deploy. Create only the API service; no database, disk, worker,
cache or model inference resource is needed.

- Source: the existing GitHub ShellForge repository, feature branch.
- Runtime: Python 3.12; repository root stays at the repository root so `src` imports work.
- Build: `pip install -r services/api/requirements.txt`.
- Start: `python -m services.api.serve` (binds `0.0.0.0` and validated `$PORT`).
- Health path: `/api/health`.
- Plan: explicitly **free**; do not accept a paid fallback.
- Set `SHELLFORGE_CORS_ORIGINS` to the exact intended frontend origin(s), comma-separated.
- Leave `SHELLFORGE_MODEL_ADAPTER` unset. No model weights are needed or bundled.
- With auto deploy enabled, feature-branch updates build automatically. Do not
  enable production-main release or merge without approval.

If native Python hosting is unsuitable, the root build context supports
`docker build -f services/api/Dockerfile -t shellforge-api .` and
`docker run --rm -p 8010:8010 shellforge-api`. The Docker image runs as a non-root
user and includes only the product service plus the unchanged static validator.
The Docker build is a prepared alternative; it is not claimed tested without a
Docker engine. Optional Qwen serving requires a separate image/dependency and
resource decision, not simply setting an adapter path in this slim image.

## Frontend on Vercel

- Root Directory: `apps/web`.
- Framework: Next.js; Node.js 22.x.
- Install: `npm ci`; build: `npm run build`.
- Set server-only `SHELLFORGE_API_ORIGIN` to the verified Render HTTPS **origin**,
  with no credentials, path or query. This is read during build for the rewrite.
- Deploy a preview of `feat/shellforge-product-v2`; verify it before a production
  release. No API secret belongs in client variables.

The app uses same-origin `/api/*` requests. Its rewrite forwards to FastAPI, avoiding
cross-origin client configuration and keeping provider secrets server-side. CORS
is restricted for clients that access the API directly. An HTTPS origin is required
for reliable Clipboard API operation outside localhost.

## Verification after any deployment

1. Confirm `/api/health` directly and through the frontend; `execution_enabled` is false.
2. Submit a supported proposal and inspect actual output; try an unsupported request.
3. Analyze `rm -rf /tmp/cache` and an unclosed quote; inspect policy/syntax differences.
4. Exercise token selection, clipboard, Field Manual parameter editing, mobile menu
   and mobile inspector. Check browser console and rendered screenshots.
5. Monitor build/runtime errors and verify the deployed commit matches the tested commit.

The in-process rate limits are appropriate for this small single-process release:
30 POSTs/minute per transport client, 120 total, 4 analysis slots. A Vercel proxy may
share a conservative budget. Scaling needs a trusted gateway/shared rate limiter;
do not simply trust arbitrary forwarded addresses. A free backend can sleep and
take time to wake; the UI reports real timeout/error states and supports retry.

## Provisioning status

- Render: `shellforge-workshop-api`, `srv-dbc60prncjis738g89r0`, free Python service
  in the user-selected My Workspace. URL: https://shellforge-workshop-api.onrender.com.
  Feature-branch auto-deploy is enabled. The running Python version is 3.13.5.
- Vercel: `shellforge-workshop`, `prj_Ijg9VbckN3kTrFD96cVMQE8ofzwK`, existing free
  Hobby team. URL: https://shellforge-workshop.vercel.app. Root `apps/web`, Next.js,
  Node 22.x, server-only API origin configured for preview and production.
- The team's existing Vercel authentication protection remains enabled. No paid
  service, model inference, database, disk or GPU was provisioned.
- Cloud build succeeded. Final HTTP verification encountered a Render free-service
  cold start; consult the current QA report for the exact verification limit.

## Impact Lab revision reconciliation

The earlier production upload carried stale Git metadata and a dirty-tree marker.
The lab release must be uploaded from a clean committed feature-branch checkout,
with its exact SHA supplied as build-time SHELLFORGE_BUILD_COMMIT. Next.js exposes
this non-secret build identity at `/api/version`; it is prerendered at build time.
Render exposes its platform-provided RENDER_GIT_COMMIT through `/api/health`.

After deployment, compare PR head, Vercel deployment metadata, `/api/version.commit`
and both direct/proxied `/api/health.build_commit`. Check anonymous HTTP separately
from authenticated CLI requests: configured protection on an immutable deployment
URL does not establish whether its production alias is publicly reachable. Never
disable protection merely to pass QA. The Impact Lab simulates locally even if the
static-analyzer API is temporarily cold or unavailable; it reports API errors
separately and never substitutes a fabricated risk result.

Repeat browser QA with PLAYWRIGHT_BASE_URL set to the actual hosted alias. Set
PLAYWRIGHT_EVIDENCE_DIR to an external directory when checking a clean deployed
revision so screenshot writes cannot make deployment provenance dirty.
