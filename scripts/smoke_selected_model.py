"""Real base/tuned smoke evidence. No command execution (syntax-only inspection)."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from services.inference.runtime import Runtime
from src.safety_validator import check_command


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--request", default="Find all regular files larger than 100 MiB in ./data"
    )
    args = parser.parse_args()
    runtime = Runtime(args.adapter)
    records = []
    for model in ("base", "tuned"):
        result = runtime.generate(args.request, model)
        result["inspection"] = check_command(result["command"])
        records.append(result)
    evidence = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "request": args.request,
        "source": "scripts/smoke_selected_model.py; real local inference, not held-out evaluation",
        "records": records,
        "live_inference": False,
        "display_mode": "saved-smoke-evidence",
        "semantic_correctness": "not verified",
    }
    Path(args.output).write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    main()
