# Selected model integration

The selected full-data trial-2 adapter was retrieved from the user's existing
Drive folder, validated and run on 2026-10-22. No weights or credentials are
committed. `evidence/selected-training-manifest.json` and
`evidence/selected-adapter-config.json` are actual downloaded metadata.

- Base: Qwen/Qwen2.5-0.5B-Instruct at `7ae557604adf67be50417f59c2c2f167def9a775`.
- Adapter: rank 16; all seven attention/MLP projection modules; 336 tensors.
- SHA-256: `afff8a917b26c0443053a45b04fff6328cf351e2eb455e3b3195b3af2512c8fc`, identical to the completed training manifest.
- Tokenizer: pinned base tokenizer; selected adapter's Qwen2Tokenizer class and EOS checked.
- Real CPU smoke: `evidence/selected-model-smoke.json`. Both base (adapter disabled)
  and tuned generated a complete output. This is a smoke test, not an accuracy
  experiment. The UI labels its preserved results as saved evidence.

## Boundaries

Browser → same-origin product API → authenticated isolated inference runtime →
pinned model and selected adapter. The product API independently performs
syntax-only Bash checking and static AST analysis. Generated commands are never
executed. The virtual filesystem is a separate pure TypeScript interpreter.

The free Render service remains lightweight: no torch, model weights or local
adapter configuration. It only uses a remote runtime when explicitly configured.
No paid services were created. There is no always-on inference endpoint by default.
An unavailable or incomplete runtime returns an error; saved predictions are never
silently substituted. `/api/model/status` reports actual reachability separately
from configuration. Live results are not semantically verified.

## Reproduce on an adequately provisioned machine

Install the pinned `requirements-model.txt` and `services/api/requirements.txt`.
Use an adapter directory containing the original `adapter_config.json`,
`adapter_model.safetensors`, `tokenizer_config.json`, and the trial directory's
`training_manifest.json`. Never deserialize `training_args.bin`.

```bash
PYTHONPATH=. python scripts/smoke_selected_model.py --adapter /private/path/to/adapter --output /private/path/to/smoke.json
```

The local smoke was verified with 8 GB system RAM on CPU; this does not imply the
512 MB Render container can serve the model. CUDA is automatically used by the
existing HFGenerator when available. The inference notebook provides the Colab GPU
path. A GPU run of that new notebook has not been claimed.

## Serve a real runtime

Set `SHELLFORGE_INFERENCE_ADAPTER` to that validated directory and
`SHELLFORGE_INFERENCE_TOKEN` to a private random token of at least 32 characters.
Run a single worker on the separate machine:

```bash
python -m uvicorn services.inference.main:create_app --factory --host 127.0.0.1 --port 8034 --no-access-log
```

Expose it only through an authenticated HTTPS origin appropriate to the host.
Set the product API's `SHELLFORGE_INFERENCE_ORIGIN` to that origin and its
`SHELLFORGE_INFERENCE_TOKEN` to the same private token. Neither variable is public
or NEXT_PUBLIC. HTTP is accepted only for literal loopback addresses during local
QA. Redirects are rejected so authorization cannot follow another origin.

Generation accepts only base/tuned, 2,000 input characters, 512 encoded tokens,
128 output tokens and one active generation. HF max_time is a best-effort stopping
budget checked between decoding iterations, not a process-level hard kill. The
product connection has a 45 second network timeout and a 64 KiB response cap.
An incomplete/non-EOS output is rejected. Runtime requests are limited to six
per transport client per minute and twelve globally; public product API limits
also apply. Use a dedicated process that can be restarted for a wedged accelerator.

## Saved evaluation provenance

`reports/metrics/full-data-v1/` contains the actual complete Drive exports, including
1,254 test records. The exporter excludes the 32 previously exposed pilot IDs and
asserts 1,222 primary pairs: base 28, tuned 84. The full export totals (31 and 86)
are not the primary result. Raw outputs, failures and source hashes are preserved.
The historical pilot files remain untouched. `scripts/export_final_research.py`
reproduces the public artifact and tests compare every exported field to source.
