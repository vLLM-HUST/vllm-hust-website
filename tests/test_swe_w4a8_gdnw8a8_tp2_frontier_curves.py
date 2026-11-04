"""The TP2 chart must preserve measured values and their observation scope."""

import copy
import json
import runpy
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def inputs():
    renderer = runpy.run_path(
        str(ROOT / "scripts/render_swe_w4a8_gdnw8a8_tp2_curves.py")
    )
    data = json.loads((ROOT / "data/leaderboard_frontier.json").read_text())
    points = [p for p in data["points"] if p["cohort_id"] == renderer["COHORT"]]
    return renderer, data, points


def test_chart_matches_all_five_observations_and_normalizes_two_chips():
    renderer, data, points = inputs()
    svg = renderer["render"](data)
    assert (
        svg
        == (
            ROOT / "assets/frontier-qwen35-w4a8-gdnw8a8-tp2-swe-concurrency.svg"
        ).read_text()
    )
    nodes = {
        node.attrib["data-point"]: node
        for node in ET.fromstring(svg).iter()
        if "data-point" in node.attrib
    }
    assert len(nodes) == 5
    assert set(nodes) == {p["id"] for p in points}
    for point in points:
        per_chip = point["metrics"]["output_tps"] / 2
        assert renderer["output_tps_per_chip"](point) == per_chip
        assert f"{per_chip:.2f} tokens/s/chip" in "".join(nodes[point["id"]].itertext())
        assert "/vllm-hust-benchmark/blob/main/reports/" in point["evidence"]["url"]
        assert point["evidence"]["profile"] == "smoke"
    assert "order effects are not controlled" in svg
    assert "Public summaries only" in svg


@pytest.mark.parametrize("mutation", ["missing", "duplicate", "changed_setting"])
def test_incomplete_or_mixed_series_is_rejected(mutation):
    renderer, data, points = inputs()
    if mutation == "missing":
        data["points"].remove(points[0])
    elif mutation == "duplicate":
        data["points"].append(copy.deepcopy(points[0]))
    else:
        points[0]["configuration"]["parameters"]["kv_cache_memory_bytes"] += 1
    with pytest.raises((ValueError, AssertionError)):
        renderer["render"](data)


def test_summary_metrics_and_chart_link_remain_consistent():
    renderer, data, points = inputs()
    cohort = next(c for c in data["cohorts"] if c["id"] == renderer["COHORT"])
    chart = cohort["workload"]["contract"]["concurrency_curves_url"]
    assert (ROOT / chart.split("?", 1)[0]).is_file()
    evidence = json.loads(
        (ROOT / "data/leaderboard_frontier_swe_evidence.json").read_text()
    )
    runs = {r["point_id"]: r for r in evidence["runs"] if "point_id" in r}
    for point in points:
        run = runs[point["id"]]
        summary = run["summary"]
        expected = summary["observed_output_tokens_in_window"] / 900
        assert point["metrics"]["output_tps"] == pytest.approx(expected)
        assert (
            point["metrics"]["decode_p90_tps"]
            == summary["decode_tokens_per_second_p90"]
        )
        assert any(
            "cannot be independently recomputed" in s for s in run["limitations"]
        )
