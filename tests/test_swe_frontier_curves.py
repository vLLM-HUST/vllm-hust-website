import json
import runpy
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_published_swe_curves_match_only_capacity16_observations():
    renderer = runpy.run_path(str(ROOT / "scripts/render_swe_frontier_curves.py"))
    data = json.loads((ROOT / "data/leaderboard_frontier.json").read_text())
    rendered = renderer["render"](data)
    assert rendered == (ROOT / "assets/frontier-qwen35-swe-concurrency.svg").read_text()
    ids = {
        node.attrib["data-point"]
        for node in ET.fromstring(rendered).iter()
        if "data-point" in node.attrib
    }
    expected = {
        point["id"]
        for point in data["points"]
        if point["cohort_id"] == renderer["COHORT"]
        and point["configuration"]["parameters"].get("max_num_seqs") == 16
        and point["load"].get("concurrency_series")
        in ("swe-capacity16-native", "swe-capacity16-full")
        and point["configuration"]["hardware"]["accelerator_count"] == 2
    }
    assert ids == expected
    assert len(ids) >= 4
