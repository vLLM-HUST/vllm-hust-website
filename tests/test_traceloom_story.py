"""Protect the public measured-figure contract, not incidental page wording."""

import json
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from itertools import pairwise
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data/traceloom-story.json").read_text())


def test_deepseek_window_preserves_structure_and_overlap():
    data = DATA["deepseek"]
    assert Counter(e["label"].split(" · ")[0] for e in data["structure"]) == {
        "layer": 3,
        "attention": 3,
        "moe": 3,
    }
    lanes = defaultdict(list)
    for e in data["events"]:
        assert 0 <= e["start_us"] <= data["span_us"]
        assert e["start_us"] + e["duration_us"] <= data["span_us"] + 1e-6
        lanes[e["lane"]].append(e)
    assert len(lanes) == 2
    for lane in lanes.values():
        lane.sort(key=lambda e: e["start_us"])
        assert all(
            a["start_us"] + a["duration_us"] <= b["start_us"] + 1e-6
            for a, b in pairwise(lane)
        )
    # Both figures contain exactly the same measured device intervals.
    ns = {"svg": "http://www.w3.org/2000/svg"}
    counts = []
    for name in ["before", "after"]:
        svg = ET.parse(ROOT / f"assets/traceloom-deepseek-{name}.svg")
        counts.append(len(svg.findall(".//svg:rect/svg:title", ns)))
    assert counts == [len(data["events"]), len(data["events"]) + len(data["structure"])]


def test_replay_sample_is_separate_and_has_exact_member_populations():
    data = DATA["qwen"]
    assert len(data["steps"]) == len(data["launches"]) == 3
    assert len({e["ordinal"] for e in data["steps"]}) == 3
    assert Counter(e["launch_index"] for e in data["members"]) == {
        0: 339,
        1: 339,
        2: 339,
    }
    for key in ["steps", "launches", "members", "bodies"]:
        for e in data[key]:
            assert e["start_us"] >= 0
            assert e["start_us"] + e["duration_us"] <= data["span_us"] + 1e-6
    text = json.dumps(DATA)
    for private in [
        "step_id",
        "request_id",
        "prompt",
        "/root/",
        "/workspace/",
        "time_origin_ns",
    ]:
        assert private not in text
