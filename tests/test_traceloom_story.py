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
    # Every measured event is rendered once, alongside its structural context.
    ns = {"svg": "http://www.w3.org/2000/svg"}
    svg = ET.parse(ROOT / "assets/traceloom-deepseek-structure.svg")
    rects = svg.findall(".//svg:rect", ns)
    labels = [r for r in rects if r.find("svg:title", ns) is not None]
    assert len(labels) == len(data["events"]) + len(data["structure"])
    colors = defaultdict(set)
    for rect in labels[len(data["structure"]) :]:
        title = rect.find("svg:title", ns).text
        colors[title.rsplit(": ", 1)[0]].add(rect.attrib["fill"])
    assert all(len(fills) == 1 for fills in colors.values())
    assert len({next(iter(fills)) for fills in colors.values()}) > 10


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
