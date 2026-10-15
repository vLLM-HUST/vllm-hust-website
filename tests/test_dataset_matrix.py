"""The presentation remains a faithful projection of public measured reports."""

import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "matrix", ROOT / "scripts/build_dataset_matrix.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_snapshot_rebuild_and_source_identity():
    data = json.loads((ROOT / "data/dataset-matrix-v1.json").read_text())
    assert data == module.build()
    for name, expected in data["source_files_sha256"].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected
    assert data["formal_acceptance"] is False


def test_scope_and_metrics():
    data = module.build()
    datasets = {d["id"]: d for d in data["datasets"]}
    assert [p["name"] for p in datasets["hle-verified"]["parts"]] == [
        "Gold",
        "Revision",
    ]
    assert all("betterscale" in p["scores"] for p in datasets["hle-verified"]["parts"])
    rows = data["records"]
    frontier = [r for r in rows if r["dataset"] == "frontierscience"]
    assert len(frontier) == 2  # One combined benchmark per solution, not per track.
    assert all(r["performance"]["num_prompts"] == 160 for r in frontier)
    assert all(len(r["quality"]) == 2 for r in frontier)
    hle = [r for r in rows if r["dataset"] == "hle-verified"]
    assert len(hle) == 8
    bs_hle = [r for r in hle if r["solution"] == "betterscale"]
    assert len(bs_hle) == 4
    assert all(r["performance"]["input_token_accounting_verified"] for r in bs_hle)
    assert [
        p["scores"]["betterscale"]["correct"] for p in datasets["hle-verified"]["parts"]
    ] == [168, 320]
    assert [
        p["scores"]["betterscale"]["audit"]["unresolved"]
        for p in datasets["hle-verified"]["parts"]
    ] == [20, 27]
    bs = next(r for r in rows if r["id"] == "mmlu-pro-betterscale-test-200")
    assert bs["quality"][0]["correct"] == 9611
    assert bs["performance"]["output_throughput"] == 624.8240870647068
    assert (
        bs["performance"]["mean_ttft_ms"]
        != bs["quality"][0]["audit"]["mean_ttft_s"] * 1000
    )
    for d in data["datasets"]:
        for p in d["parts"]:
            for s in p["scores"].values():
                assert s["value"] == s["correct"] / s["total"]


def test_failed_admission_is_not_a_zero_score_or_performance_row():
    data = module.build()
    failed = {a["solution"] for a in data["attempts"]}
    assert {"bidkv", "kvcompress-ascend"} <= failed
    for dataset in data["datasets"]:
        for part in dataset["parts"]:
            for solution in failed:
                assert solution not in part["scores"]
                if solution in part["statuses"]:
                    assert part["statuses"][solution]["measurements"] is None
    assert not any(row["solution"] in failed for row in data["records"])
