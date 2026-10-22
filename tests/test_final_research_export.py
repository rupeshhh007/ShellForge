import hashlib
import json
from pathlib import Path
from scripts.export_final_research import ROOT


def test_primary_export_contains_real_paired_outputs_excludes_pilot():
    saved = json.loads((ROOT / "apps/web/public/research/final.json").read_text())
    pilot = json.loads((ROOT / "apps/web/lib/research-pilot.json").read_text())
    assert len(saved["pairs"]) == 1222
    assert set(saved["excluded_pilot_ids"]) == {p["id"] for p in pilot["pairs"]}
    assert saved["live_inference"] is False
    for kind, expected in [("base", 28), ("tuned", 84)]:
        source = saved["sources"][0 if kind == "base" else 1]
        raw = ROOT / source["path"]
        assert hashlib.sha256(raw.read_bytes()).hexdigest() == source["sha256"]
        records = {r["id"]: r for r in map(json.loads, raw.read_text().splitlines())}
        assert sum(p[kind]["exact_match"] for p in saved["pairs"]) == expected
        for pair in saved["pairs"]:
            assert pair["id"] not in saved["excluded_pilot_ids"]
            original = records[pair["id"]]
            assert pair["reference"] == original["reference"]
            assert pair["instruction"] == original["instruction"]
            for field, value in pair[kind].items():
                assert value == original[field]


def test_actual_smoke_copy_is_identical_and_selected_hash_matches_manifest():
    original = ROOT / "docs/product/evidence/selected-model-smoke.json"
    assert (
        original.read_bytes() == (ROOT / "apps/web/lib/model-smoke.json").read_bytes()
    )
    data = json.loads(original.read_text())
    manifest = json.loads(
        (ROOT / "docs/product/evidence/selected-training-manifest.json").read_text()
    )
    assert data["live_inference"] is False
    for record in data["records"]:
        assert record["executed"] is False and record["complete"] is True
        assert record["identity"]["adapter_sha256"] == manifest["adapter_sha256"]
        assert record["identity"]["rank"] == 16
        assert (
            record["raw_output"] == record["command"] and record["elapsed_seconds"] > 0
        )
