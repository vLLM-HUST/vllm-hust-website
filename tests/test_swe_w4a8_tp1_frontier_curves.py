import json
import runpy
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# 五档齐全, C16 是 max-num-seqs=16 的饱和档, 不能被 C8 顶替。
LEVELS = (1, 2, 4, 8, 16)


def load_renderer():
    return runpy.run_path(str(ROOT / "scripts/render_swe_w4a8_tp1_curves.py"))


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


def test_published_w4a8_tp1_swe_curve_matches_the_measured_series():
    renderer = load_renderer()
    data = frontier()
    rendered = renderer["render"](data)
    assert (
        rendered
        == (ROOT / "assets/frontier-qwen35-w4a8-tp1-swe-concurrency.svg").read_text()
    )
    ids = {
        node.attrib["data-point"]
        for node in ET.fromstring(rendered).iter()
        if "data-point" in node.attrib
    }
    assert ids == {point["id"] for point in tp1_points(data, renderer)}
    # 本 cohort 只有一条 real-MTP2 线, 五个点必须全部被画出来。
    assert len(ids) == len(LEVELS)


def test_w4a8_tp1_curve_declares_its_svg_on_the_cohort_contract():
    renderer = load_renderer()
    cohort = next(c for c in frontier()["cohorts"] if c["id"] == renderer["COHORT"])
    url = cohort["workload"]["contract"]["concurrency_curves_url"]
    assert url.startswith("./assets/frontier-qwen35-w4a8-tp1-swe-concurrency.svg?v=")
    assert (ROOT / url.split("?")[0].lstrip("./")).is_file()


def test_w4a8_tp1_cohort_does_not_collide_with_any_other_cohort():
    """cohort 唯一性 key 是 [model, precision, workload, context]

    (assets/leaderboard-frontier-model.js)。本 cohort 与同一 model 下的其它
    cohort 共用 model 与 context, 靠自有的 precision.id 与 workload.id 重开这个键,
    否则站点 validate() 抛 duplicate。

    这里只对本 cohort 自己作断言 —— 不依赖任何别的 cohort 在不在基线里。
    """
    renderer = load_renderer()
    cohorts = frontier()["cohorts"]
    w4a8 = next(c for c in cohorts if c["id"] == renderer["COHORT"])

    def key(c):
        return (
            c["model"]["id"],
            c["precision"]["id"],
            c["workload"]["id"],
            c["context_tokens"],
        )

    assert sum(1 for c in cohorts if key(c) == key(w4a8)) == 1
    # 同 model 下不得有第二条 cohort 复用我们的 precision.id 或 workload.id。
    same_model = [c for c in cohorts if c["model"]["id"] == w4a8["model"]["id"]]
    assert sum(1 for c in same_model if c["id"] == w4a8["id"]) == 1
    assert (
        sum(1 for c in same_model if c["precision"]["id"] == w4a8["precision"]["id"])
        == 1
    )
    assert (
        sum(1 for c in same_model if c["workload"]["id"] == w4a8["workload"]["id"]) == 1
    )


def test_w4a8_tp1_swe_curve_covers_c1_through_c16_on_one_series():
    """五档必须在同一 cohort + 同一 concurrency_series 内, 且只由客户端 C 区分。"""
    renderer = load_renderer()
    points = tp1_points(frontier(), renderer)
    assert sorted(p["load"]["concurrency"] for p in points) == list(LEVELS)
    assert {p["load"]["concurrency_series"] for p in points} == {renderer["SERIES"]}
    assert {p["cohort_id"] for p in points} == {renderer["COHORT"]}
    assert {p["load"]["session_rotation_depth"] for p in points} == {1}
    mods = {json.dumps(p["configuration"]["mods"]) for p in points}
    assert mods == {json.dumps(renderer["MODS"])}
    for point in points:
        params = point["configuration"]["parameters"]
        assert params["mtp_draft_tokens"] == 2
        assert params["max_num_seqs"] == 16
        assert params["quantization"] == "ascend"
        # 本曲线是单卡: 并行规模与卡数都要落在 TP1 上。
        assert params["tensor_parallel_size"] == 1
        assert point["configuration"]["hardware"]["accelerator_count"] == 1
        # 本次测量固定在卡 7 上完成 (卡 0/2/3 上当时有别的常驻服务, 未动)。
        assert params["physical_devices"] == [7]
        # 专家层 int4 是本 cohort 的 precision 主张, 必须逐点写明。
        assert "int4" in params["weight_precision"]
        for key, expected in renderer["CALIBER"].items():
            assert params[key] == expected, (key, params[key], expected)
        assert params["qualification"]["concurrency"] == point["load"]["concurrency"]
        assert params["qualification"]["measurement_seconds"] == 60


def test_w4a8_tp1_kv_budget_is_declared_per_point():
    """本 cohort 的实质口径: 服务端为本产物显式设定 KV 预算, 且逐点自述。

    kv_cache_memory_bytes 是 deepcopy 造新 cohort 时最容易带错的一处 —— 值必须与
    渲染器声明的 CALIBER 逐点一致, 且每个点都要在 caliber_note 里自述这个值。
    """
    renderer = load_renderer()
    points = tp1_points(frontier(), renderer)
    declared = renderer["CALIBER"]["kv_cache_memory_bytes"]
    for point in points:
        params = point["configuration"]["parameters"]
        assert params["kv_cache_memory_bytes"] == declared
        # caliber_note 必须自述本 cohort 的预算, 而不是别的口径。
        assert str(declared) in params["caliber_note"]
        assert "32.55" in params["caliber_note"]
    # cohort 级 limitations 必须自述本 cohort 的实况: 5.31 路并发, C16 是峰值。
    cohort = next(c for c in frontier()["cohorts"] if c["id"] == renderer["COHORT"])
    limitations = cohort["workload"]["contract"]["limitations"]
    assert "measured collapse" not in limitations
    assert "5.31" in limitations
    # 本 cohort 的峰值是 C16, 不得残留"C8 是峰值"之类的说法。
    assert "C8 remains the throughput peak" not in limitations
    assert "C16 is the peak of this cohort" in limitations


def test_w4a8_tp1_c16_point_is_its_own_saturated_900s_window():
    """C16 档专项: 一个独立 run_id 的真实满载窗口, 不是 C8 的复制或标签。"""
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

    qualification = run["qualification_run"]
    assert qualification["concurrency"] == 16
    assert qualification["duration"] == 60
    assert qualification["summary"]["failed_requests"] == 0
    assert run["validation"]["protocol_qualification_passed"] is True
    assert run["validation"]["protocol_qualification_run_id"] == qualification["run_id"]

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


def test_w4a8_tp1_curve_peaks_at_c16():
    """本曲线的实质结论: 吞吐单调升到 C16, C16 就是峰值。

    服务端显式给的 32.55 GiB KV 预算 (262144 下 5.31 路并发) 足以让 SWE 前缀在
    C16 仍然留在缓存里, 所以这里没有高并发回落。把它钉在测试里, 避免以后被照着
    别的曲线的形状"顺手抹平"。这里只引用本 cohort 自己的点。
    """
    renderer = load_renderer()
    points = {p["load"]["concurrency"]: p for p in tp1_points(frontier(), renderer)}
    per_chip = {c: p["metrics"]["output_tps"] for c, p in points.items()}
    # 五档单调不减, 且 C16 是严格最大值。
    ordered = [per_chip[c] for c in LEVELS]
    assert ordered == sorted(ordered), ordered
    assert per_chip[16] == max(per_chip.values()), per_chip
    assert per_chip[16] > per_chip[8], per_chip
    # 单卡时每卡吞吐 == 总吞吐, 所以这条断言同时说明总量也在 C16 继续上升。
    assert points[16]["configuration"]["hardware"]["accelerator_count"] == 1
    # 尾延迟在 C16 仍是秒级排队, 没有出现十秒级的拥塞。
    assert points[16]["metrics"]["ttft_p95_ms"] < 5000


def test_w4a8_tp1_runtime_evidence_is_this_cohorts_own():
    """运行期证据必须来自本 cohort 自己的采样, 不能是造 cohort 时继承来的。

    runtime_evidence 是深拷贝母本时最隐蔽的一处: counters 与 sources 都会
    原样继承, 从而把别的点的计数器与日志路径当成这里的证据提交。
    """
    renderer = load_renderer()
    points = tp1_points(frontier(), renderer)
    runs = {
        r["run_id"]: r
        for r in swe_evidence()["runs"]
        if r.get("point_id", "").startswith("qwen35-sweprefix-w4a8")
    }
    assert len(runs) == len(LEVELS)
    for point in points:
        run = runs[point["evidence"]["run_ids"][0]]
        evidence = run["runtime_evidence"]
        sources = evidence["sources"]
        # 三条来源路径都必须指向本产物自己的采样文件 (服务端日志的 label 是 w4a8,
        # 编排与采样日志是 ab-w4a8max), 且不得残留任何别的批次的时间戳。
        assert set(sources) == {"orchestration_log", "metrics_tsv", "server_log"}
        assert all("w4a8" in path for path in sources.values()), sources
        assert all("/data/gcy/" in path for path in sources.values()), sources
        assert all("20261014" not in path for path in sources.values()), sources
        counters = evidence["prefix_cache_counters"]
        assert counters["prefix_cache_queries_total"]
        assert counters["prefix_cache_hits_total"]
        assert evidence["prefix_cache_observed"] is True
        assert evidence["spec_decode_metrics_seen"] is True
        assert evidence["campaign_finished_ok"] is True
