import json
import runpy
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# 站点 W8A8 曲线要求五档齐全: C16 是 max-num-seqs=16 的饱和档, 不能被 C8 顶替。
LEVELS = (1, 2, 4, 8, 16)


def load_renderer():
    return runpy.run_path(str(ROOT / "scripts/render_swe_w8a8_curves.py"))


def frontier():
    return json.loads((ROOT / "data/leaderboard_frontier.json").read_text())


def swe_evidence():
    return json.loads(
        (ROOT / "data/leaderboard_frontier_swe_evidence.json").read_text()
    )


def w8a8_points(data, renderer):
    return [
        p
        for p in data["points"]
        if p["cohort_id"] == renderer["COHORT"]
        and p["configuration"]["parameters"].get("max_num_seqs") == 16
        and p["load"].get("concurrency_series") == renderer["SERIES"]
        and p["configuration"]["hardware"]["accelerator_count"] == 2
    ]


def test_published_w8a8_swe_curve_matches_the_measured_series():
    renderer = load_renderer()
    data = frontier()
    rendered = renderer["render"](data)
    assert (
        rendered
        == (ROOT / "assets/frontier-qwen35-w8a8-swe-concurrency.svg").read_text()
    )
    ids = {
        node.attrib["data-point"]
        for node in ET.fromstring(rendered).iter()
        if "data-point" in node.attrib
    }
    assert ids == {point["id"] for point in w8a8_points(data, renderer)}


def test_w8a8_curve_declares_its_svg_on_the_cohort_contract():
    renderer = load_renderer()
    cohort = next(c for c in frontier()["cohorts"] if c["id"] == renderer["COHORT"])
    url = cohort["workload"]["contract"]["concurrency_curves_url"]
    assert url.startswith("./assets/frontier-qwen35-w8a8-swe-concurrency.svg?v=")
    assert (ROOT / url.split("?")[0].lstrip("./")).is_file()


def test_w8a8_swe_curve_covers_c1_through_c16_on_one_series():
    """五档必须在同一 cohort + 同一 concurrency_series 内, 且只由客户端 C 区分。"""
    renderer = load_renderer()
    points = w8a8_points(frontier(), renderer)
    assert sorted(p["load"]["concurrency"] for p in points) == list(LEVELS)
    assert {p["load"]["concurrency_series"] for p in points} == {renderer["SERIES"]}
    assert {p["cohort_id"] for p in points} == {renderer["COHORT"]}
    assert {p["load"]["session_rotation_depth"] for p in points} == {1}
    mods = {json.dumps(p["configuration"]["mods"]) for p in points}
    assert mods == {json.dumps([renderer["MTP_MOD"]])}
    for point in points:
        params = point["configuration"]["parameters"]
        assert params["mtp_draft_tokens"] == 2
        assert params["max_num_seqs"] == 16
        assert params["quantization"] == "ascend"
        for key, expected in renderer["CALIBER"].items():
            assert params[key] == expected, (key, params[key], expected)
        assert params["qualification"]["concurrency"] == point["load"]["concurrency"]
        assert params["qualification"]["measurement_seconds"] == 60


def test_w8a8_c16_point_is_its_own_saturated_900s_window():
    """C16 档专项: 一个独立 run_id 的真实满载窗口, 不是 C8 的复制或标签。

    workload 只有 8 条轨迹, 客户端按全局 session 轮转 + 每 lane 独立 cache_salt
    供给 16 路并发 (swe-prefix-reuse runner.py). 因此必须由证据证明 16 路确实
    叠满, 而不是 8 路空转被标成 C16。
    """
    renderer = load_renderer()
    points = {p["load"]["concurrency"]: p for p in w8a8_points(frontier(), renderer)}
    assert set(points) == set(LEVELS)
    c16, c8 = points[16], points[8]

    runs = {r["run_id"]: r for r in swe_evidence()["runs"]}
    run = runs[c16["evidence"]["run_ids"][0]]

    assert run["client"]["concurrency"] == 16
    assert run["summary"]["valid"] is True
    assert run["summary"]["aborted"] is False
    assert run["summary"]["failed_requests"] == 0
    assert run["summary"]["measurement_seconds"] == 900
    assert run["summary"]["planned_measurement_seconds"] == 900
    assert run["summary"]["decode_speed_samples"] > 0
    assert run["summary"]["full_concurrency_fraction"] > 0.9
    assert run["summary"]["mean_client_inflight"] > 15

    # 60s 资格窗口与 900s 正式窗口都属 C16, 且没有失败请求。
    qualification = run["qualification_run"]
    assert qualification["concurrency"] == 16
    assert qualification["duration"] == 60
    assert qualification["summary"]["failed_requests"] == 0
    assert run["validation"]["protocol_qualification_passed"] is True
    assert run["validation"]["protocol_qualification_run_id"] == qualification["run_id"]

    # C16 与 C8 是两个独立测量点: 各自的 run_id 与数值都不重合。
    assert c16["evidence"]["run_ids"] != c8["evidence"]["run_ids"]
    assert c16["metrics"] != c8["metrics"]
    assert c16["metrics"] == run["metrics"]
    assert c16["metrics"]["output_tps"] == (
        run["summary"]["observed_output_tokens_in_window"] / 900
    )

    # 五档各有一个独立 run, 且都与点内联的 metrics 一致。
    seen = set()
    for level, point in points.items():
        assert len(point["evidence"]["run_ids"]) == 1
        run_id = point["evidence"]["run_ids"][0]
        assert run_id not in seen
        seen.add(run_id)
        row = runs[run_id]
        assert row["client"]["concurrency"] == level
        assert row["summary"]["measurement_seconds"] == 900
        assert row["summary"]["failed_requests"] == 0
        assert row["metrics"] == point["metrics"]


def test_w8a8_r1_caliber_broken_series_is_no_longer_published():
    """r1 曲线 (服务端每步只跑 1 个请求) 的 5 档数值不得留在站点数据里。"""
    stale = [
        point["id"]
        for point in frontier()["points"]
        if point["load"].get("concurrency_series") == "swe-w8a8-tp2-20260929-mtp2-r1"
    ]
    assert stale == []
