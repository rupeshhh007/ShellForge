# Product architecture and API contract

`apps/web` is a strict TypeScript Next.js App Router application. `/` tells the
story, `/forge` proposes commands, `/xray` analyzes supplied Bash, `/manual` fetches
the recipe catalog, and `/bench` publishes the authentic research. Content routes
are statically rendered; Forge reads optional recipe search parameters on the server.
Fonts and artwork are local. React renders all command and explanation text as text;
there is no HTML or Markdown renderer for API content.

`services/api` is FastAPI. It imports the existing `src/safety_validator.py`, which
remains unchanged. Research training, evaluation and CLI entry points are preserved.
Product installs need only FastAPI, uvicorn and bashlex; no torch, GPU, model key,
dataset or database is needed for the bounded template workflow.

## HTTP surface

| Endpoint | Body | Result |
| --- | --- | --- |
| GET `/api/health` | — | Status, model configuration flag, execution disabled |
| GET `/api/recipes` | — | Typed recipe catalog with compatibility and parameters |
| POST `/api/commands/propose` | `request`, `profile`; optional `recipe_id`, `parameters` | Proposal, unsupported or clarification receipt |
| POST `/api/commands/analyze` | `command`, `profile` | Syntax, policy findings and curated token receipt |

FastAPI exposes the authoritative JSON Schema at `/openapi.json` and interactive
documentation at `/docs`. `schemas.py` forbids extra request fields and coerced types.
The frontend mirrors these contracts and validates returned receipts/catalogs before
display. Token offsets count Unicode code points, not UTF-16 code units.

```json
{"request":"Find files larger than 100 MiB in the current directory","profile":"linux"}
```

A supported response has `status: "proposed"`,
`command: "find . -type f -size +100M"`, `backend: "deterministic-templates"`,
structured intent, `safety` (`syntax_valid`, `risk`, `reasons`, `policy`), curated
tokens (`text`, `start`, `end`, `role`, `explanation`, `implication`, `constraint`,
`supported`), assumptions, limitations, `executed: false` and
`requires_manual_review: true`. These last two values are literal types.

Unsupported/clarification responses use HTTP 200 with `command: null` and a readable
`clarification`. They do not fabricate a command. Bad payloads return 422, oversized
bodies 413, slow body delivery 408, limits 429 (`Retry-After: 60`), busy analysis/model
slots 503, and invalid configured-provider output 502.

## Intent boundaries

The language grammar uses anchored full matches. See each recipe's `request` for
an exact supported form. Quoted paths and numeric thresholds can be changed; extra
qualifiers abstain. `MB` and `bytes` in the larger-than-MiB form require clarification.
The byte-size recipe matches an exact **positive** whole byte count. The size recipes
require the GNU/Linux profile. No semantic verification is claimed for arbitrary NL.

Field Manual parameters take an explicit, separate recipe path. The API validates
the recipe ID, profile, allowed parameter names, count bounds and literal paths.
Strings use `shlex.quote`. Traversal paths get a relative `./` prefix when needed so
GNU find cannot interpret a filename such as `!` as an expression. Editing the Forge
request clears the recipe binding rather than silently ignoring the edited text.

Only common read-oriented tasks ship: file size/name/type searches, directory
listing, pwd, disk capacity/usage, head, literal grep, processes and user/group IDs.
There are no mutation templates. X-Ray accepts arbitrary bounded Bash for inspection.

## Generator interface

`ModelProvider.generate(request) -> GeneratedCommand(command, backend)` is the
optional provider boundary. An explicitly configured `SHELLFORGE_MODEL_ADAPTER`
enables `QwenAdapterProvider`, wrapping the existing HFGenerator at the pinned base
revision. Install the model requirements and provision appropriate resources first.
Nothing automatically loads or downloads model weights on the default product path.
Template constraints always run before the provider. Provider failures/truncation
abstain; output passes the same length checks and static inspection. Model output
has no inferred structured intent or semantic certification. A single model slot
prevents concurrent calls through the shared research generator.

Drive discovery found the `ShellForge/full-data-v1/trial-2/adapter` folder and textual
adapter metadata. The connector did not surface the final safetensors binary in that
listing. No trained weights were downloaded or inference environment provisioned.
The repository's rank-8 pilot is not silently substituted for the final rank-16 run.

## Request and execution controls

- 2,000-character NL, 4,000-character Bash, 16 KiB streaming body bound; 5-second
  receive deadline, 3-second existing Bash syntax timeout.
- 30 POSTs/minute per transport client and 120/minute total per process; bounded
  client bookkeeping; four concurrent analysis slots. Limits are in-memory and
  reset on restart. Multi-instance hosting needs a shared gateway limiter.
- Forwarded identity is not trusted by the app. Run uvicorn with
  `--no-proxy-headers`; a frontend proxy may therefore share one conservative
  per-client budget. Do not enable arbitrary forwarded headers to bypass this.
- Explicit CORS origins only; default `http://localhost:3000`. Same-origin Next.js
  rewrites use a server-only origin. CORS controls browser reads, not API access.
- No command execution, shell interpolation, execution endpoint, local filesystem
  browsing, command history, secret collection or runtime preview. Bash is only
  invoked with `--noprofile --norc -n`, command on stdin, and a clean environment.
- Existing `SAFE` means allowlisted behavior recognized by static-v2. Risk scores
  are not invented. No statement establishes safety, utility compatibility or intent
  correctness in the user's environment. Unknown token explanations say unverified.

## Client state

The latest request owns the receipt. Editing, profile changes, reset and cancel abort
the request and invalidate its serial ID. Late responses cannot overwrite new work.
Copy has real clipboard success/failure feedback. Desktop panes resize with pointer
capture or arrow keys. Mobile Command/Inspector panels use keyboard-ready tabs.
Reduced motion disables transform entrances and smooth scrolling. No API state is
presented as fictional model computation.
