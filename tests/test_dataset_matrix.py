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
    assert len(frontier) == 5  # Historical records plus the dated matched pair.
    assert all(r["performance"]["num_prompts"] == 160 for r in frontier)
    assert all(len(r["quality"]) == 2 for r in frontier)
    hle = [r for r in rows if r["dataset"] == "hle-verified"]
    assert len(hle) == 18
    bs_hle = [r for r in hle if r["solution"] == "betterscale"]
    assert len(bs_hle) == 4
    assert all(r["performance"]["input_token_accounting_verified"] for r in bs_hle)
    assert [
        p["scores"]["betterscale"]["correct"] for p in datasets["hle-verified"]["parts"]
    ] == [173, 316]
    assert [
        p["scores"]["betterscale"]["audit"]["unresolved"]
        for p in datasets["hle-verified"]["parts"]
    ] == [18, 28]
    bs = next(r for r in rows if r["id"] == "mmlu-pro-betterscale-test-200")
    assert bs["quality"][0]["correct"] == 9589
    assert bs["performance"]["output_throughput"] == 631.588934632666
    assert (
        bs["performance"]["mean_ttft_ms"]
        != bs["quality"][0]["audit"]["mean_ttft_s"] * 1000
    )
    for d in data["datasets"]:
        for p in d["parts"]:
            for s in p["scores"].values():
                if p["metric"] == "programs_per_minute":
                    assert s["value"] > 0 and s["unit"] == "programs/min"
                elif p["metric"] == "engine_output_tokens_per_second":
                    assert s["value"] > 0 and s["unit"] == "token/s"
                    assert s["repetitions"] == 1
                elif p["metric"] == "output_throughput_gain":
                    assert s["value"] >= 0 and s["unit"] == "relative_gain"
                else:
                    assert s["value"] == s["correct"] / s["total"]


def test_trajectory_receipt_uses_completion_rate_without_accuracy(tmp_path):
    import pytest

    path = tmp_path / "data/swe-smith-qwen35-tp2/report.json"
    path.parent.mkdir(parents=True)
    value = {
        "status": "PASS",
        "quality": None,
        "cohort": {
            "model": "Qwen3.5-35B-A3B",
            "precision": "BF16",
            "hardware": "Ascend 910B2",
            "parallel": "TP2",
        },
        "aggregate": [
            {"concurrency": 32, "repetitions": 1, "median_completion_rate_ratio": 1.25}
        ],
        "records": [
            {
                "strategy": strategy,
                "seed": 11,
                "concurrency": 32,
                "programs": 2,
                "programs_per_minute": rate,
            }
            for strategy, rate in (("vllm", 1.2), ("Our-Controller", 1.5))
        ],
        "paired_comparisons": [
            {"concurrency": 32, "seed": 11, "completion_rate_ratio": 1.25}
        ],
        "packages": {},
        "plan_sha256": "test-only",
        "limitations": ["test fixture"],
    }
    path.write_text(json.dumps(value))
    solutions, datasets, records, sources = [], [], [], {}
    module.append_trajectory(tmp_path, solutions, datasets, records, sources)
    assert datasets[0]["name"] == "SWE-smith-tranjactory"
    score = datasets[0]["parts"][0]["scores"]["request-throttling-controller"]
    assert score["value"] == 1.5 and score["speedup"] == 1.25
    assert "correct" not in score
    assert len(records) == 2 and all(r["quality"] == [] for r in records)
    value["status"] = "FAIL"
    path.write_text(json.dumps(value))
    with pytest.raises(ValueError, match="verified"):
        module.append_trajectory(tmp_path, [], [], [], {})


def test_failed_admission_is_not_a_zero_score_or_performance_row():
    data = module.build()
    failed = {a["solution"] for a in data["attempts"]}
    assert {"bidkv", "kvcompress-ascend"} <= failed
    for dataset in data["datasets"]:
        for part in dataset["parts"]:
            for solution, attempt in part["statuses"].items():
                assert solution not in part["scores"]
                assert attempt["measurements"] is None
                assert not any(
                    row["solution"] == solution and row["dataset"] == dataset["id"]
                    for row in data["records"]
                )


def test_campaign_mmlu_completed_scores_and_separate_load_tests():
    data = module.build()
    part = next(d for d in data["datasets"] if d["id"] == "mmlu-pro")["parts"][0]
    for solution, correct in [
        ("core-attention-boundary", 9619),
        ("ascend-attention-boundary", 9582),
    ]:
        assert part["scores"][solution]["correct"] == correct
        assert part["scores"][solution]["total"] == 12032
        row = next(
            r for r in data["records"] if r["id"] == f"mmlu-pro-{solution}-test-200"
        )
        assert row["performance"]["completed"] == 200
        assert row["performance"]["failed"] == 0
        assert row["configuration"]["mtp"] == 0
        assert row["quality"] == [part["scores"][solution]]


def test_campaign_gold_keeps_unresolved_and_cancelled_revision_unscored():
    data = module.build()
    parts = next(d for d in data["datasets"] if d["id"] == "hle-verified")["parts"]
    gold = parts[0]["scores"]["core-attention-boundary"]
    assert gold["correct"] == 77 and gold["total"] == 668
    assert gold["audit"]["unresolved"] == 333
    assert "core-attention-boundary" not in parts[1]["scores"]
    rows = [
        r
        for r in data["records"]
        if r["dataset"] == "hle-verified" and r["solution"] == "core-attention-boundary"
    ]
    assert {r["scope"] for r in rows} == {"gold-text", "gold-image"}
    assert all(r["performance"]["input_token_accounting_verified"] for r in rows)


def test_latest_betterscale_replaces_default_and_is_complete():
    data = module.build()
    sid = "betterscale"
    assert next(s for s in data["solutions"] if s["id"] == sid)["name"] == "BetterScale"
    scores = [
        part["scores"][sid]
        for dataset in data["datasets"]
        for part in dataset["parts"]
        if sid in part["scores"]
    ]
    assert [(s["correct"], s["total"]) for s in scores] == [
        (9589, 12032),
        (60, 100),
        (3, 60),
        (173, 668),
        (316, 1143),
    ]
    rows = [r for r in data["records"] if r["solution"] == sid]
    assert len(rows) == 6
    assert all(r["performance"]["failed"] == 0 for r in rows)
    assert all(r["configuration"]["source_tag"] == "v1" for r in rows)
    assert all(
        r["configuration"]["mtp"] == 2 and r["configuration"]["graph"] == "FULL"
        for r in rows
    )
    assert all(
        r["performance"]["input_token_accounting_verified"]
        for r in rows
        if r["dataset"] == "hle-verified"
    )
    assert [s["audit"]["unresolved"] for s in scores[-2:]] == [18, 28]


def test_previous_betterscale_reports_remain_archived():
    previous = json.loads((ROOT / f"data/{module.BS}/report.json").read_text())
    assert previous["mmlu"]["correct"] == 9611
    assert not any(s["id"] == "betterscale-school" for s in module.build()["solutions"])


def test_offline_window_has_explicit_profile_and_paired_seed_median():
    import statistics

    data = module.build()
    dataset = next(
        d for d in data["datasets"] if d["id"] == "swe-smith-tranjactory-offline-window"
    )
    assert dataset["evidence_type"] == "fixed-window-replay"
    part = dataset["parts"][0]
    assert part["metric"] == "output_throughput_gain"
    assert part["scores"]["native"]["value"] == 0
    assert part["scores"]["request-throttling-controller"]["repetitions"] == 3
    raw = json.loads(
        (
            ROOT / "data/request-throttling-offline-window-20261017/report.json"
        ).read_text()
    )
    primary = [r for r in raw["records"] if not r["order_repeat"]]
    ratio = statistics.median(
        r["on"]["engine_output_tokens_per_second"]
        / r["off"]["engine_output_tokens_per_second"]
        for r in primary
    )
    assert part["scores"]["request-throttling-controller"]["speedup"] == ratio
    assert part["scores"]["request-throttling-controller"]["value"] == ratio - 1
    assert "request-throttling-off" not in {s["id"] for s in data["solutions"]}
    assert all(
        "seed" not in r["scope_label"]
        for r in data["records"]
        if r["dataset"] == dataset["id"]
    )
    rows = [r for r in data["records"] if r["dataset"] == dataset["id"]]
    assert len(rows) == 8
    assert all(
        r["protocol"]["client_concurrency_limit"] is None
        and r["protocol"]["finite_makespan_claim"] is False
        for r in rows
    )
    assert all(
        r["configuration"]["configured_kv_cache_memory_bytes"] == 536870912
        for r in rows
    )
    assert all(r["quality"] == [] for r in rows)


def test_offline_window_report_contains_only_public_evidence():
    import re

    path = ROOT / "data/request-throttling-offline-window-20261017/report.json"
    body = path.read_text()
    assert not re.search(r"10\.244\.|192\.168\.|Bearer\s", body)
    forbidden = {
        "api_key",
        "access_token",
        "authorization",
        "prompt_token_ids",
        "output_token_ids",
        "endpoint",
        "backend",
    }

    def check(value):
        if isinstance(value, dict):
            assert not forbidden.intersection(value)
            for key, child in value.items():
                if key.endswith("sha256"):
                    assert re.fullmatch("[a-f0-9]{64}", child)
                check(child)
        elif isinstance(value, list):
            for child in value:
                check(child)

    check(json.loads(body))


def test_controller_uses_existing_dataset_rows_and_preserves_matching_baseline():
    data = module.build()
    assert len(data["datasets"]) == 5
    assert not any(d.get("runtime_profile") for d in data["datasets"])
    frontier = next(d for d in data["datasets"] if d["id"] == "frontierscience")
    assert [
        (
            p["scores"]["native"]["correct"],
            p["scores"]["request-throttling-controller"]["correct"],
        )
        for p in frontier["parts"]
    ] == [(57, 58), (5, 4)]
    rows = [
        r
        for r in data["records"]
        if r["id"].startswith("frontierscience-controller-20261018-")
    ]
    assert len(rows) == 2
    for row in rows:
        assert row["dataset"] == "frontierscience"
        assert row["performance"]["repetitions"] == 3
        assert {r["repetition"] for r in row["performance"]["formal_runs"]} == {1, 2, 3}
        assert row["protocol"]["quality_budget"]["passed"] is False
        assert row["configuration"]["core_version"] == "0.23.0"
    native = next(r for r in rows if r["solution"] == "native")
    controller = next(
        r for r in rows if r["solution"] == "request-throttling-controller"
    )
    assert [q["correct"] for q in native["quality"]] == [60, 5]
    assert (
        controller["performance"]["output_throughput"]
        < native["performance"]["output_throughput"]
    )
    assert native["configuration_label"] == "本轮配对基线"


def test_controller_gold_uses_existing_row_with_matched_modality_performance():
    data = module.build()
    dataset = next(d for d in data["datasets"] if d["id"] == "hle-verified")
    gold = next(p for p in dataset["parts"] if p["id"] == "gold")
    assert gold["scores"]["native"]["correct"] == 156
    score = gold["scores"]["request-throttling-controller"]
    assert (score["correct"], score["total"], score["audit"]["unresolved"]) == (
        159,
        668,
        25,
    )
    rows = [
        r
        for r in data["records"]
        if r["id"].startswith("hle-gold-controller-20261018-")
    ]
    assert len(rows) == 4
    assert (
        sum(r["quality"][0]["correct"] for r in rows if r["solution"] == "native")
        == 164
    )
    assert (
        sum(
            r["quality"][0]["correct"]
            for r in rows
            if r["solution"] == "request-throttling-controller"
        )
        == 159
    )
    for row in rows:
        perf = row["performance"]
        assert perf["repetitions"] == 3 and len(perf["formal_runs"]) == 3
        assert all(
            p["repetition"] != "warmup" and p["failed"] == 0
            for p in perf["formal_runs"]
        )
        assert row["configuration"]["prefix_caching"] is False
        assert row["protocol"]["quality_budget"]["passed"] is False


def test_controller_gold_public_report_has_no_private_payload():
    import re

    body = (
        ROOT / "data/request-throttling-dataset-matrix-20261018/hle-gold.json"
    ).read_text()
    assert not re.search(
        r'10\.244\.|192\.168\.|Bearer\s|"(?:base_url|raw_response|prompt_token_ids)"\s*:',
        body,
    )


def test_controller_mmlu_preserves_original_row_and_matching_baseline():
    import statistics

    data = module.build()
    assert len(data["datasets"]) == 5
    part = next(d for d in data["datasets"] if d["id"] == "mmlu-pro")["parts"][0]
    assert part["scores"]["native"]["correct"] == 9609
    measured = part["scores"]["request-throttling-controller"]
    assert (measured["correct"], measured["total"]) == (9599, 12032)
    assert measured["audit"]["invalid_answers"] == 66
    rows = [
        r
        for r in data["records"]
        if r["id"].startswith("mmlu-pro-controller-20261018-")
    ]
    assert len(rows) == 2
    assert {r["quality"][0]["correct"] for r in rows} == {9632, 9599}
    for row in rows:
        assert row["performance"]["repetitions"] == 3
        for key in ["output_throughput", "mean_ttft_ms", "mean_tpot_ms"]:
            assert row["performance"][key] == statistics.median(
                r[key] for r in row["performance"]["formal_runs"]
            )


def test_controller_revision_uses_existing_row_with_matched_modality_performance():
    data = module.build()
    dataset = next(d for d in data["datasets"] if d["id"] == "hle-verified")
    revision = next(p for p in dataset["parts"] if p["id"] == "revision")
    assert revision["scores"]["native"]["correct"] == 313
    score = revision["scores"]["request-throttling-controller"]
    assert (score["correct"], score["total"], score["audit"]["unresolved"]) == (
        308,
        1143,
        32,
    )
    rows = [
        r
        for r in data["records"]
        if r["id"].startswith("hle-revision-controller-20261018-")
    ]
    assert len(rows) == 4
    assert (
        sum(r["quality"][0]["correct"] for r in rows if r["solution"] == "native")
        == 303
    )
    assert (
        sum(
            r["quality"][0]["correct"]
            for r in rows
            if r["solution"] == "request-throttling-controller"
        )
        == 308
    )
    for row in rows:
        perf = row["performance"]
        assert perf["repetitions"] == 3 and len(perf["formal_runs"]) == 3
        assert all(
            p["repetition"] != "warmup" and p["failed"] == 0
            for p in perf["formal_runs"]
        )
        assert row["configuration"]["prefix_caching"] is False
        assert row["protocol"]["quality_budget"]["passed"] is True


def test_controller_revision_public_report_has_no_private_payload():
    import re

    body = (
        ROOT / "data/request-throttling-dataset-matrix-20261018/hle-revision.json"
    ).read_text()
    assert not re.search(
        r'10\.244\.|192\.168\.|Bearer\s|"(?:base_url|raw_response|prompt_token_ids)"\s*:',
        body,
    )


def test_real_agent_system_window_shows_only_native_and_controller():
    data = module.build()
    dataset = next(d for d in data["datasets"] if d["id"] == "swe-bench-pro")
    assert dataset["evidence_type"] == "real-agent-system-window"
    assert dataset["parts"][0]["metric"] == "engine_output_tokens_per_second"
    rows = {r["solution"]: r for r in data["records"] if r["dataset"] == dataset["id"]}
    assert set(rows) == {
        "native",
        "request-throttling-controller",
    }
    for row in rows.values():
        assert row["quality"] == [] and row["protocol"]["quality_gate"] is False
        assert row["configuration"]["client_concurrency_limit"] is None
        assert row["configuration"]["agent_wall_seconds"] == 3600
        assert row["protocol"]["complete_batch_makespan_claim"] is False
        assert row["protocol"]["client_boundary"]["pending"] > 0
    n, c = (
        rows["native"]["performance"],
        rows["request-throttling-controller"]["performance"],
    )
    assert c["engine_output_tokens_per_s"] > n["engine_output_tokens_per_s"]
    assert c["p95_latency_s"] > n["p95_latency_s"]  # Preserve adverse tails.
    assert not any(s["id"] == "thunderagent-original" for s in data["solutions"])


def test_real_agent_window_refuses_quality_or_makespan_reclassification(tmp_path):
    import pytest

    source = ROOT / "data/swe-bench-pro-real-agent-threeway-20261022/report.json"
    path = tmp_path / source.relative_to(ROOT)
    path.parent.mkdir(parents=True)
    report = json.loads(source.read_text())
    report["quality_gate"] = True
    path.write_text(json.dumps(report))
    with pytest.raises(AssertionError):
        module.append_real_agent_system_window(tmp_path, [], [], [], {})


def test_pair_table_does_not_add_a_page_section_or_change_existing_content():
    page = (ROOT / "dataset-validation.html").read_text()
    assert 'id="dataset-results" class="matrix-shell runs-shell"' in page
    assert "./assets/dataset-matrix-v1.js?v=measured-first-20261024" in page
    assert 'id="mmlu-pro-handoff"' in page
    assert "./assets/midterm-report.js?v=midterm-v086-quality-20261026" in page
    js = (ROOT / "assets/dataset-matrix-v1.js").read_text()
    pair = js.split("function realAgentDetail(d)", 1)[1].split("function detail(d)", 1)[
        0
    ]
    assert "ThunderAgent" not in pair and "data-expand" not in pair
    assert "<caption>" in pair and "p95_latency_s" in pair and "p99_latency_s" in pair
