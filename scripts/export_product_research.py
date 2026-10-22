"""Export preserved pilot predictions for the web comparison; never infer outputs."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ["reports/metrics/base/generation_examples.jsonl", "reports/metrics/tuned/generation_examples.jsonl"]


def export():
    datasets = []
    sources = []
    for name in SOURCES:
        raw = (ROOT / name).read_bytes()
        rows = [json.loads(line) for line in raw.decode().splitlines() if line]
        if len(rows) != 32 or len({r["id"] for r in rows}) != 32:
            raise ValueError("Expected the preserved unique 32-case pilot.")
        sources.append({"path": name, "sha256": hashlib.sha256(raw).hexdigest()})
        datasets.append({r["id"]: r for r in rows})
    base, tuned = datasets
    if base.keys() != tuned.keys():
        raise ValueError("Unpaired prediction records.")
    pairs = []
    for identity, b in base.items():
        t = tuned[identity]
        if b["instruction"] != t["instruction"] or b["reference"] != t["reference"]:
            raise ValueError("Mismatched paired instruction/reference.")
        for row in (b, t):
            if row["executed"] is not False or row["exact_match"] != (row["prediction"] == row["reference"]):
                raise ValueError("Prediction metadata does not match saved bytes.")
        pairs.append({"id": identity, "instruction": b["instruction"], "reference": b["reference"],
                      "base": {k: b[k] for k in ("prediction", "exact_match", "syntax_valid", "risk", "backend")},
                      "tuned": {k: t[k] for k in ("prediction", "exact_match", "syntax_valid", "risk", "backend")}})
    output = {"experiment": "Historical 20-step CPU pilot; rank-8 LoRA; first 32 exposed test cases",
              "live_inference": False, "sources": sources, "pairs": pairs}
    destination = ROOT / "apps/web/lib/research-pilot.json"
    destination.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    export()
