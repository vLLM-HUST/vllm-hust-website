import json
import runpy
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# TP1 曲线同样要求五档齐全: C16 是 max-num-seqs=16 的饱和档, 不能被 C8 顶替。
LEVELS = (1, 2, 4, 8, 16)


def load_renderer():
    return runpy.run_path(str(ROOT / "scripts/render_swe_w8a8_tp1_curves.py"))


def frontier():
    return json.loads((ROOT / "data/leaderboard_frontier.json").read_text())


def swe_evidence():
    return json.loads(
        (ROOT / "data/leaderboard_frontier_swe_evidence.json").read_text()
    )


def tp1_points(data, renderer):
    return [
        p
        for p in data["points"]
        if p["cohort_id"] == renderer["COHORT"]
        and p["configuration"]["parameters"].get("max_num_seqs") == 16
        and p["load"].get("concurrency_series") == renderer["SERIES"]
        and p["configuration"]["hardware"]["accelerator_count"] == 1
    ]


def test_published_tp1_swe_curve_matches_the_measured_series():
    renderer = load_renderer()
    data = frontier()
    rendered = renderer["render"](data)
    assert (
        rendered
        == (ROOT / "assets/frontier-qwen35-w8a8-tp1-swe-concurrency.svg").read_text()
    )
    ids = {
        node.attrib["data-point"]
        for node in ET.fromstring(rendered).iter()
        if "data-point" in node.attrib
    }
    assert ids == {point["id"] for point in tp1_points(data, renderer)}


def test_tp1_curve_declares_its_svg_on_the_cohort_contract():
    renderer = load_renderer()
    cohort = next(c for c in frontier()["cohorts"] if c["id"] == renderer["COHORT"])
    url = cohort["workload"]["contract"]["concurrency_curves_url"]
    assert url.startswith("./assets/frontier-qwen35-w8a8-tp1-swe-concurrency.svg?v=")
    assert (ROOT / url.split("?")[0].lstrip("./")).is_file()


def test_tp1_cohort_does_not_collide_with_the_tp2_w8a8_cohort():
    """cohort 唯一性 key 是 [model, precision, workload, context]; TP1 与 TP2 共用前三个,
    必须靠独立的 workload.id 区分, 否则站点 validate() 抛 duplicate。"""
    renderer = load_renderer()
    cohorts = frontier()["cohorts"]
    tp1 = next(c for c in cohorts if c["id"] == renderer["COHORT"])

    def key(c):
        return (
            c["model"]["id"],
            c["precision"]["id"],
            c["workload"]["id"],
            c["context_tokens"],
        )

    assert sum(1 for c in cohorts if key(c) == key(tp1)) == 1
    tp2 = next(
        c
        for c in cohorts
        if c["id"]
        == "qwen35-35b-a3b-w8a8-tp2-2x910b3-full-decode-only-sweprefix-900s-v1"
    )
    assert tp1["model"]["id"] == tp2["model"]["id"]
    assert tp1["precision"]["id"] == tp2["precision"]["id"]
    assert tp1["context_tokens"] == tp2["context_tokens"]
    assert tp1["workload"]["id"] != tp2["workload"]["id"]


def test_tp1_swe_curve_covers_c1_through_c16_on_one_series():
    """五档必须在同一 cohort + 同一 concurrency_series 内, 且只由客户端 C 区分。"""
    renderer = load_renderer()
    points = tp1_points(frontier(), renderer)
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
        # 本曲线是单卡: 并行规模与卡数都要落在 TP1 上。
        assert params["tensor_parallel_size"] == 1
        assert point["configuration"]["hardware"]["accelerator_count"] == 1
        assert params["physical_devices"] == [0]
        for key, expected in renderer["CALIBER"].items():
            assert params[key] == expected, (key, params[key], expected)
        assert params["qualification"]["concurrency"] == point["load"]["concurrency"]
        assert params["qualification"]["measurement_seconds"] == 60


def test_tp1_c16_point_is_its_own_saturated_900s_window():
    """C16 档专项: 一个独立 run_id 的真实满载窗口, 不是 C8 的复制或标签。

    workload 只有 8 条轨迹, 客户端按全局 session 轮转 + 每 lane 独立 cache_salt
    供给 16 路并发 (swe-prefix-reuse runner.py). 因此必须由证据证明 16 路确实
    叠满, 而不是 8 路空转被标成 C16。
    """
    renderer = load_renderer()
    points = {p["load"]["concurrency"]: p for p in tp1_points(frontier(), renderer)}
    assert set(points) == set(LEVELS)
    c16, c8 = points[16], points[8]

    runs = {r["run_id"]: r for r in swe_evidence()["runs"]}
    run = runs[c16["evidence"]["run_ids"][0]]

    assert run["client"]["concurrency"] == 16
    assert run["client"]["chips"] == 1
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


def test_tp1_curve_publishes_the_measured_c16_collapse():
    """本曲线的实质结论: C8 是每卡吞吐峰值, C16 在单卡上回落。

    这不是要隐藏的缺陷, 而是曲线要表达的结论 —— 单卡 KV 预算在 262144 上下文下
    只容 3.07 路并发, C16 的 prompt 流冲掉了前缀复用。把它钉在测试里, 避免以后
    被"顺手抹平"成单调曲线。
    """
    renderer = load_renderer()
    points = {p["load"]["concurrency"]: p for p in tp1_points(frontier(), renderer)}
    per_chip = {c: p["metrics"]["output_tps"] for c, p in points.items()}
    assert per_chip[8] == max(per_chip.values()), per_chip
    assert per_chip[16] < per_chip[8], per_chip
    # 单卡时每卡吞吐 == 总吞吐, 所以这条断言同时说明总量也在 C16 回落。
    assert points[16]["configuration"]["hardware"]["accelerator_count"] == 1
    # 回落同时体现在尾延迟上。
    assert points[16]["metrics"]["ttft_p95_ms"] > points[8]["metrics"]["ttft_p95_ms"]
