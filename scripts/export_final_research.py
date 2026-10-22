"""Export genuine final predictions, excluding the previously exposed pilot IDs."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def export():
    pilot = json.loads((ROOT / "apps/web/lib/research-pilot.json").read_text())
    exposed = {p["id"] for p in pilot["pairs"]}
    sources = []
    groups = {}
    for kind in ("base", "tuned"):
        path = ROOT / f"reports/metrics/full-data-v1/{kind}/generation_examples.jsonl"
        sources.append(
            {
                "path": str(path.relative_to(ROOT)),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )
        rows = [json.loads(line) for line in path.read_text().splitlines()]
        assert len(rows) == 1254 and len({r["id"] for r in rows}) == 1254
        assert all(
            r["executed"] is False
            and r["exact_match"] == (r["prediction"] == r["reference"])
            for r in rows
        )
        groups[kind] = {r["id"]: r for r in rows if r["id"] not in exposed}
    assert groups["base"].keys() == groups["tuned"].keys()
    pairs = []
    for key, b in groups["base"].items():
        t = groups["tuned"][key]
        assert b["reference"] == t["reference"] and b["instruction"] == t["instruction"]
        pairs.append(
            {
                "id": key,
                "instruction": b["instruction"],
                "reference": b["reference"],
                **{
                    kind: {
                        f: groups[kind][key][f]
                        for f in (
                            "prediction",
                            "raw_generation",
                            "exact_match",
                            "syntax_valid",
                            "risk",
                            "backend",
                            "failure_category",
                            "generation_truncated",
                        )
                    }
                    for kind in ("base", "tuned")
                },
            }
        )
    assert (
        len(pairs) == 1222
        and sum(p["base"]["exact_match"] for p in pairs) == 28
        and sum(p["tuned"]["exact_match"] for p in pairs) == 84
    )
    result = {
        "experiment": "Primary held-out test; selected full-data trial-2 rank-16 LoRA",
        "live_inference": False,
        "excluded_pilot_ids": sorted(exposed),
        "sources": sources,
        "model_revision": "7ae557604adf67be50417f59c2c2f167def9a775",
        "adapter_sha256": "afff8a917b26c0443053a45b04fff6328cf351e2eb455e3b3195b3af2512c8fc",
        "pairs": pairs,
    }
    (ROOT / "apps/web/public/research/final.json").write_text(
        json.dumps(result, separators=(",", ":")) + "\n"
    )
    return result


if __name__ == "__main__":
    result = export()
    print(f"Exported {len(result['pairs'])} authentic primary pairs")
