import json
import runpy
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# 站点曲线要求五档齐全: C16 是 max-num-seqs=16 的饱和档, 不能被 C8 顶替。
LEVELS = (1, 2, 4, 8, 16)
# 已发布的 W8A8 TP2 cohort —— 本 cohort 必须与它共用 workload 而区分于 precision。
PUBLISHED_W8A8_COHORT = (
    "qwen35-35b-a3b-w8a8-tp2-2x910b3-full-decode-only-sweprefix-900s-v1"
)


def load_renderer():
    return runpy.run_path(str(ROOT / "scripts/render_swe_w8a8_gdn_curves.py"))


def frontier():
    return json.loads((ROOT / "data/leaderboard_frontier.json").read_text())


def swe_evidence():
    return json.loads(
        (ROOT / "data/leaderboard_frontier_swe_evidence.json").read_text()
    )


def gdn_points(data, renderer):
    return [
        p
        for p in data["points"]
        if p["cohort_id"] == renderer["COHORT"]
        and p["configuration"]["parameters"].get("max_num_seqs") == 16
        and p["load"].get("concurrency_series") == renderer["SERIES"]
        and p["configuration"]["hardware"]["accelerator_count"] == 2
    ]


def test_published_w8a8_gdn_swe_curve_matches_the_measured_series():
    renderer = load_renderer()
    data = frontier()
    rendered = renderer["render"](data)
    assert (
        rendered
        == (ROOT / "assets/frontier-qwen35-w8a8-gdn-swe-concurrency.svg").read_text()
    )
    ids = {
        node.attrib["data-point"]
        for node in ET.fromstring(rendered).iter()
        if "data-point" in node.attrib
    }
    assert ids == {point["id"] for point in gdn_points(data, renderer)}


def test_w8a8_gdn_curve_declares_its_svg_on_the_cohort_contract():
    renderer = load_renderer()
    cohort = next(c for c in frontier()["cohorts"] if c["id"] == renderer["COHORT"])
    url = cohort["workload"]["contract"]["concurrency_curves_url"]
    assert url.startswith("./assets/frontier-qwen35-w8a8-gdn-swe-concurrency.svg?v=")
    assert (ROOT / url.split("?")[0].lstrip("./")).is_file()


def test_w8a8_gdn_swe_curve_covers_c1_through_c16_on_one_series():
    """五档必须在同一 cohort + 同一 concurrency_series 内, 且只由客户端 C 区分。"""
    renderer = load_renderer()
    points = gdn_points(frontier(), renderer)
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


def test_w8a8_gdn_cohort_is_distinguished_from_published_w8a8_by_precision_only():
    """新配方 cohort 与已发布 W8A8 TP2 cohort 的关系必须是"同 workload + 同口径,
    仅配方不同" —— 这是本批次唯一要证明的事, 必须在站点数据里可见。

    站点 cohort 唯一性 key 是 [model.id, precision.id, workload.id, context_tokens]
    (assets/leaderboard-frontier-model.js), 三个 cohort 字段一起决定可读性。
    """
    renderer = load_renderer()
    data = frontier()
    new = next(c for c in data["cohorts"] if c["id"] == renderer["COHORT"])
    old = next(c for c in data["cohorts"] if c["id"] == PUBLISHED_W8A8_COHORT)

    # 同模型 / 同上下文 / 同 workload —— 唯一变量不是这三项
    assert new["model"]["id"] == old["model"]["id"]
    assert new["model"]["revision"] == old["model"]["revision"]
    assert new["context_tokens"] == old["context_tokens"]
    assert new["workload"]["id"] == old["workload"]["id"]
    assert (
        new["workload"]["contract"]["prepared_workload_sha256"]
        == old["workload"]["contract"]["prepared_workload_sha256"]
    )
    assert (
        new["workload"]["contract"]["tokenizer_fingerprint"]
        == old["workload"]["contract"]["tokenizer_fingerprint"]
    )
    # 区分只在 precision
    assert new["precision"]["id"] == renderer["PRECISION"]
    assert new["precision"]["id"] != old["precision"]["id"]
    assert new["precision"]["note"] and old["precision"]["note"]
    assert "W8A16" in new["precision"]["label"]

    # 唯一性 key 不冲突 (这就是 workload.id 可以复用而 precision.id 必须换的原因)
    keys = [
        json.dumps(
            [
                c["model"]["id"],
                c["precision"]["id"],
                c["workload"]["id"],
                c["context_tokens"],
            ]
        )
        for c in data["cohorts"]
    ]
    assert len(keys) == len(set(keys))

    # 两条曲线各自着色, 不混画
    assert (
        new["workload"]["contract"]["concurrency_curves_url"]
        != old["workload"]["contract"]["concurrency_curves_url"]
    )
    assert (
        new["workload"]["contract"]["display_scope"]
        != old["workload"]["contract"]["display_scope"]
    )


def test_w8a8_gdn_serving_flags_match_the_published_w8a8_point_verbatim():
    """本批次的全部意义在于"同一口径只换配方", 所以服务参数必须与已发布点逐字相同。"""
    renderer = load_renderer()
    data = frontier()
    new = gdn_points(data, renderer)[0]["configuration"]["parameters"]
    old = next(p for p in data["points"] if p["cohort_id"] == PUBLISHED_W8A8_COHORT)[
        "configuration"
    ]["parameters"]

    for key in (
        "tensor_parallel_size",
        "pipeline_parallel_size",
        "data_parallel_size",
        "expert_parallel",
        "max_num_seqs",
        "max_model_len",
        "gpu_memory_utilization",
        "kv_cache_memory_bytes",
        "max_num_batched_tokens",
        "quantization",
        "prefix_caching",
        "enable_chunked_prefill",
        "mamba_cache_mode",
        "mtp_draft_tokens",
        "max_cudagraph_capture_size",
        "cudagraph_mode",
        "thinking",
        "generation_temperature",
        "benchmark_repository",
        "benchmark_revision",
        "base_checkpoint_revision",
        "runtime_base_commits",
        "runtime_versions",
    ):
        assert new[key] == old[key], key

    # 精度块是唯一**允许且必须**不同的地方: GDN 三个投影 W8A16
    assert new["weight_precision"] != old["weight_precision"]
    assert new["activation_precision"] != old["activation_precision"]
    assert "W8A16" in new["weight_precision"]
    assert "W8A16" in new["activation_precision"]
    assert new["kv_cache_dtype"] == old["kv_cache_dtype"]
    # 量化产物指纹必须不同 (不同配方 -> 不同权重)
    assert new["weight_artifacts"] != old["weight_artifacts"]
    # engine 补丁多了一个 (W8A16 触发的 npugraph_ex 垫片)
    assert new["mods"] != old["mods"]
    assert old["mods"] == ["ascend-mtp-contract-2patch"]
    assert new["mods"] == [renderer["MTP_MOD"]]


def test_w8a8_gdn_c16_point_is_its_own_saturated_900s_window():
    """C16 档专项: 一个独立 run_id 的真实满载窗口, 不是 C8 的复制或标签。

    workload 只有 8 条轨迹, 客户端按全局 session 轮转 + 每 lane 独立 cache_salt
    供给 16 路并发 (swe-prefix-reuse runner.py). 因此必须由证据证明 16 路确实
    叠满, 而不是 8 路空转被标成 C16。
    """
    renderer = load_renderer()
    points = {p["load"]["concurrency"]: p for p in gdn_points(frontier(), renderer)}
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

    # 五档各有一个独立 run, 且都与点内联的 metrics 一致; per-chip 口径按 2 卡。
    seen = set()
    for level, point in points.items():
        assert len(point["evidence"]["run_ids"]) == 1
        run_id = point["evidence"]["run_ids"][0]
        assert run_id not in seen
        seen.add(run_id)
        row = runs[run_id]
        assert row["client"]["concurrency"] == level
        assert row["client"]["chips"] == 2
        assert row["summary"]["measurement_seconds"] == 900
        assert row["summary"]["failed_requests"] == 0
        assert row["metrics"] == point["metrics"]
        assert point["metrics"]["output_tps"] == (
            row["summary"]["observed_output_tokens_in_window"] / 900
        )
        assert (
            point["metrics"]["output_tps"] / 2
            == row["summary"]["output_tokens_per_second_per_chip"]
        )
