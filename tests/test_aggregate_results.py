from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def _valid_entry() -> dict:
    return {
        "entry_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "engine": "engine-a",
        "engine_version": "1.2.3",
        "config_type": "single_gpu",
        "hardware": {
            "vendor": "NVIDIA",
            "chip_model": "A100",
            "chip_count": 1,
            "interconnect": "None",
            "chips_per_node": 1,
            "intra_node_interconnect": "None",
            "memory_per_chip_gb": 80,
            "total_memory_gb": 80,
        },
        "model": {
            "name": "Qwen/Qwen2.5-0.5B-Instruct",
            "parameters": "unknown",
            "precision": "FP16",
            "quantization": "None",
        },
        "workload": {
            "name": "short",
            "input_length": 32,
            "output_length": 64,
            "batch_size": 1,
            "concurrent_requests": 1,
            "dataset": "default",
        },
        "metrics": {
            "ttft_ms": 10.0,
            "tbt_ms": 2.0,
            "tpot_ms": 3.0,
            "throughput_tps": 100.0,
            "peak_mem_mb": 1024,
            "error_rate": 0.0,
            "prefix_hit_rate": 0.0,
            "kv_used_tokens": 1024,
            "kv_used_bytes": 4096,
            "evict_count": 0,
            "evict_ms": 0.0,
            "spec_accept_rate": 0.0,
        },
        "constraints": {
            "scenario_source": "vllm-benchmark",
            "accountable_scope": {
                "domestic_chip_class": "Huawei Ascend 910B",
                "representative_model_band": "7B-13B",
                "representative_business_scenario": "multi-turn-dialogue",
                "baseline_engine": "vllm",
                "owner_confirmed": True,
            },
            "metrics": {
                "single_chip_effective_utilization_pct": 91.2,
                "typical_throughput_ratio_vs_baseline": 2.12,
                "typical_ttft_reduction_pct_vs_baseline": 22.4,
                "typical_tpot_reduction_pct_vs_baseline": 21.1,
                "long_context_length": 32768,
                "long_context_throughput_stable": True,
                "long_context_ttft_p95_ms": 45.0,
                "long_context_ttft_p99_ms": 58.0,
                "long_context_tpot_p95_ms": 12.0,
                "long_context_tpot_p99_ms": 16.0,
                "long_context_ttft_p95_stable": True,
                "long_context_ttft_p99_stable": True,
                "long_context_tpot_p95_stable": True,
                "long_context_tpot_p99_stable": True,
                "unit_token_cost_reduction_pct": 31.5,
                "multi_tenant_high_utilization": True,
            },
        },
        "cluster": None,
        "versions": {
            "protocol": "0.6.0.0",
            "backend": "0.6.0.0",
            "core": "0.6.0.0",
            "control_plane": "0.6.0.0",
            "gateway": "0.6.0.0",
            "kv_cache": "0.6.0.0",
            "comm": "0.6.0.0",
            "compression": "0.6.0.0",
            "benchmark": "0.6.0.0",
        },
        "environment": {
            "os": "Linux",
            "python_version": "3.11.0",
            "pytorch_version": "2.7.1",
            "cuda_version": "12.4",
            "driver_version": "550.0",
        },
        "kv_cache_config": {
            "enabled": True,
            "eviction_policy": "LRU",
            "budget_tokens": 8192,
            "prefix_cache_enabled": True,
        },
        "metadata": {
            "submitted_at": "2026-03-14T12:00:00Z",
            "submitter": "test",
            "data_source": "compare",
            "engine": "engine-a",
            "engine_version": "1.2.3",
            "hardware_family": "cuda",
            "reproducible_cmd": "vllm bench serve --endpoint http://127.0.0.1:8901/v1 --model Qwen/Qwen2.5-0.5B-Instruct",
            "git_commit": "abc123def456",
            "github_user": "octocat",
            "github_commit_url": "https://github.com/vLLM-HUST/vllm-hust/commit/abc123def456",
            "github_repository": "vLLM-HUST/vllm-hust",
            "github_ref": "feature/bench-provenance",
            "github_event_name": "pull_request",
            "github_pr_number": 42,
            "github_pr_url": "https://github.com/vLLM-HUST/vllm-hust/pull/42",
            "release_date": "2026-03-14",
            "changelog_url": "https://example.com/changelog",
            "notes": "Benchmark run: short",
            "verified": True,
            "idempotency_key": "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu",
        },
        "canonical_path": "canonical/test_leaderboard.json",
    }


def test_aggregate_results_from_standard_manifest(tmp_path: Path) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()
    artifact = source_dir / "short_leaderboard.json"
    artifact.write_text(json.dumps(_valid_entry(), indent=2) + "\n", encoding="utf-8")
    manifest = source_dir / "leaderboard_manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": "leaderboard-export-manifest/v1",
                "generated_at": "2026-03-14T12:00:00Z",
                "entries": [
                    {
                        "entry_id": _valid_entry()["entry_id"],
                        "idempotency_key": _valid_entry()["metadata"][
                            "idempotency_key"
                        ],
                        "canonical_path": _valid_entry()["canonical_path"],
                        "leaderboard_artifact": "short_leaderboard.json",
                        "canonical_artifact": "short.canonical.json",
                        "engine": "engine-a",
                        "workload": "short",
                        "config_type": "single_gpu",
                        "category": "single",
                    }
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    output_dir = tmp_path / "website_data"
    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--source-dir",
            str(source_dir),
            "--output-dir",
            str(output_dir),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    assert (output_dir / "leaderboard_single.json").exists()
    assert (output_dir / "leaderboard_multi.json").exists()
    assert (output_dir / "last_updated.json").exists()

    single_payload = json.loads(
        (output_dir / "leaderboard_single.json").read_text(encoding="utf-8")
    )
    assert len(single_payload) == 1
    assert single_payload[0]["workload"]["name"] == "short"
    assert single_payload[0]["metadata"]["github_user"] == "octocat"
    assert single_payload[0]["metadata"]["git_commit"] == "abc123def456"


def test_aggregate_results_places_multi_gpu_entry_in_multi(tmp_path: Path) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    multi_entry = _valid_entry()
    multi_entry["entry_id"] = "12345678-1234-1234-1234-1234567890ab"
    multi_entry["config_type"] = "multi_gpu"
    multi_entry["hardware"]["chip_count"] = 2
    multi_entry["hardware"]["chips_per_node"] = 2
    multi_entry["hardware"]["total_memory_gb"] = 160
    multi_entry["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|2|1|multi_gpu"
    )

    artifact = source_dir / "multi_leaderboard.json"
    artifact.write_text(json.dumps(multi_entry, indent=2) + "\n", encoding="utf-8")
    manifest = source_dir / "leaderboard_manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": "leaderboard-export-manifest/v1",
                "generated_at": "2026-03-14T12:00:00Z",
                "entries": [
                    {
                        "entry_id": multi_entry["entry_id"],
                        "idempotency_key": multi_entry["metadata"]["idempotency_key"],
                        "canonical_path": multi_entry["canonical_path"],
                        "leaderboard_artifact": "multi_leaderboard.json",
                        "canonical_artifact": "multi.canonical.json",
                        "engine": "engine-a",
                        "workload": "short",
                        "config_type": "multi_gpu",
                        "category": "multi",
                    }
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    output_dir = tmp_path / "website_data"
    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--source-dir",
            str(source_dir),
            "--output-dir",
            str(output_dir),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    single_payload = json.loads(
        (output_dir / "leaderboard_single.json").read_text(encoding="utf-8")
    )
    multi_payload = json.loads(
        (output_dir / "leaderboard_multi.json").read_text(encoding="utf-8")
    )

    assert single_payload == []
    assert len(multi_payload) == 1
    assert multi_payload[0]["entry_id"] == "12345678-1234-1234-1234-1234567890ab"


def test_aggregate_results_fails_on_invalid_schema(tmp_path: Path) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()
    invalid_entry = _valid_entry()
    del invalid_entry["metrics"]["throughput_tps"]
    artifact = source_dir / "bad_leaderboard.json"
    artifact.write_text(json.dumps(invalid_entry, indent=2) + "\n", encoding="utf-8")
    manifest = source_dir / "leaderboard_manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": "leaderboard-export-manifest/v1",
                "generated_at": "2026-03-14T12:00:00Z",
                "entries": [
                    {
                        "entry_id": invalid_entry["entry_id"],
                        "idempotency_key": invalid_entry["metadata"]["idempotency_key"],
                        "canonical_path": invalid_entry["canonical_path"],
                        "leaderboard_artifact": "bad_leaderboard.json",
                        "canonical_artifact": "bad.canonical.json",
                        "engine": "engine-a",
                        "workload": "short",
                        "config_type": "single_gpu",
                        "category": "single",
                    }
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--source-dir",
            str(source_dir),
            "--output-dir",
            str(tmp_path / "out"),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "schema validation failed" in (result.stderr + result.stdout)


def test_aggregate_results_builds_goal_progress_for_official_baseline(tmp_path: Path) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    current_entry = _valid_entry()
    current_entry["entry_id"] = "11111111-1111-1111-1111-111111111111"
    current_entry["engine"] = "vllm-hust"
    current_entry["engine_version"] = "0.20.1rc1.dev314"
    current_entry["metadata"]["engine"] = "vllm-hust"
    current_entry["metadata"]["engine_version"] = "0.20.1rc1.dev314"
    current_entry["metadata"]["github_repository"] = "vLLM-HUST/vllm-ascend-hust"
    current_entry["metrics"]["ttft_ms"] = 120.0
    current_entry["metrics"]["tbt_ms"] = 10.0
    current_entry["metrics"]["throughput_tps"] = 210.0
    current_entry["metadata"]["idempotency_key"] = (
        "vllm-hust|0.20.1rc1.dev314|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    baseline_entry = _valid_entry()
    baseline_entry["entry_id"] = "22222222-2222-2222-2222-222222222222"
    baseline_entry["engine"] = "vllm"
    baseline_entry["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["engine"] = "vllm"
    baseline_entry["metadata"]["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["github_repository"] = "vllm-project/vllm-ascend"
    baseline_entry["metadata"]["github_commit_url"] = "https://github.com/vllm-project/vllm-ascend/commit/def456"
    baseline_entry["metadata"]["git_commit"] = "def456"
    baseline_entry["metrics"]["ttft_ms"] = 100.0
    baseline_entry["metrics"]["tbt_ms"] = 8.0
    baseline_entry["metrics"]["throughput_tps"] = 240.0
    baseline_entry["metadata"]["idempotency_key"] = (
        "vllm|0.11.0|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    other_entry = _valid_entry()
    other_entry["entry_id"] = "33333333-3333-3333-3333-333333333333"
    other_entry["engine"] = "sglang"
    other_entry["engine_version"] = "0.4.0"
    other_entry["metadata"]["engine"] = "sglang"
    other_entry["metadata"]["engine_version"] = "0.4.0"
    other_entry["metadata"]["github_repository"] = "sgl-project/sglang"
    other_entry["metadata"]["idempotency_key"] = (
        "sglang|0.4.0|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    entries = [current_entry, baseline_entry, other_entry]
    manifest_entries = []
    for index, entry in enumerate(entries, start=1):
        artifact_name = f"entry_{index}.json"
        (source_dir / artifact_name).write_text(
            json.dumps(entry, indent=2) + "\n", encoding="utf-8"
        )
        manifest_entries.append(
            {
                "entry_id": entry["entry_id"],
                "idempotency_key": entry["metadata"]["idempotency_key"],
                "canonical_path": entry["canonical_path"],
                "leaderboard_artifact": artifact_name,
                "canonical_artifact": f"entry_{index}.canonical.json",
                "engine": entry["engine"],
                "workload": entry["workload"]["name"],
                "config_type": entry["config_type"],
                "category": "single",
            }
        )

    (source_dir / "leaderboard_manifest.json").write_text(
        json.dumps(
            {
                "schema_version": "leaderboard-export-manifest/v1",
                "generated_at": "2026-03-14T12:00:00Z",
                "entries": manifest_entries,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    output_dir = tmp_path / "website_data"
    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--source-dir",
            str(source_dir),
            "--output-dir",
            str(output_dir),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    compare_payload = json.loads(
        (output_dir / "leaderboard_compare.json").read_text(encoding="utf-8")
    )
    goal_progress = compare_payload["goal_progress"]

    assert goal_progress["pair_count"] == 1
    assert goal_progress["headline_pair"]["current"]["engine"] == "vllm-hust"
    assert goal_progress["headline_pair"]["baseline"]["engine"] == "vllm"
    assert goal_progress["headline_pair"]["baseline_target"]["id"] == "official-ascend-jan-2026-v0.11.0"
    assert goal_progress["headline_pair"]["remaining_gap_pct"]["throughput"] == 12.5


def test_aggregate_results_goal_progress_matches_prefixed_model_names(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    current_entry = _valid_entry()
    current_entry["entry_id"] = "44444444-4444-4444-4444-444444444444"
    current_entry["engine"] = "vllm-hust"
    current_entry["engine_version"] = "0.20.1rc1.dev314"
    current_entry["model"]["name"] = "Qwen2.5-0.5B-Instruct"
    current_entry["metadata"]["engine"] = "vllm-hust"
    current_entry["metadata"]["engine_version"] = "0.20.1rc1.dev314"
    current_entry["metadata"]["github_repository"] = "vLLM-HUST/vllm-ascend-hust"
    current_entry["metadata"]["idempotency_key"] = (
        "vllm-hust|0.20.1rc1.dev314|short|qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    baseline_entry = _valid_entry()
    baseline_entry["entry_id"] = "55555555-5555-5555-5555-555555555555"
    baseline_entry["engine"] = "vllm"
    baseline_entry["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["engine"] = "vllm"
    baseline_entry["metadata"]["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["github_repository"] = "vllm-project/vllm-ascend"
    baseline_entry["metrics"]["throughput_tps"] = 90.0
    baseline_entry["metadata"]["idempotency_key"] = (
        "vllm|0.11.0|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    entries = [current_entry, baseline_entry]
    manifest_entries = []
    for index, entry in enumerate(entries, start=1):
        artifact_name = f"prefixed_entry_{index}.json"
        (source_dir / artifact_name).write_text(
            json.dumps(entry, indent=2) + "\n", encoding="utf-8"
        )
        manifest_entries.append(
            {
                "entry_id": entry["entry_id"],
                "idempotency_key": entry["metadata"]["idempotency_key"],
                "canonical_path": entry["canonical_path"],
                "leaderboard_artifact": artifact_name,
                "canonical_artifact": f"prefixed_entry_{index}.canonical.json",
                "engine": entry["engine"],
                "workload": entry["workload"]["name"],
                "config_type": entry["config_type"],
                "category": "single",
            }
        )

    (source_dir / "leaderboard_manifest.json").write_text(
        json.dumps(
            {
                "schema_version": "leaderboard-export-manifest/v1",
                "generated_at": "2026-03-14T12:00:00Z",
                "entries": manifest_entries,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    output_dir = tmp_path / "website_data"
    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--source-dir",
            str(source_dir),
            "--output-dir",
            str(output_dir),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    compare_payload = json.loads(
        (output_dir / "leaderboard_compare.json").read_text(encoding="utf-8")
    )
    goal_progress = compare_payload["goal_progress"]

    assert goal_progress["pair_count"] == 1
    assert goal_progress["headline_pair"]["current"]["engine"] == "vllm-hust"
    assert goal_progress["headline_pair"]["baseline"]["engine"] == "vllm"


def test_aggregate_results_hard_constraints_only_include_vllm_hust(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    current_entry = _valid_entry()
    current_entry["entry_id"] = "66666666-6666-6666-6666-666666666666"
    current_entry["engine"] = "vllm-hust"
    current_entry["engine_version"] = "0.20.1rc1.dev314"
    current_entry["metadata"]["engine"] = "vllm-hust"
    current_entry["metadata"]["engine_version"] = "0.20.1rc1.dev314"
    current_entry["metadata"]["idempotency_key"] = (
        "vllm-hust|0.20.1rc1.dev314|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    baseline_entry = _valid_entry()
    baseline_entry["entry_id"] = "77777777-7777-7777-7777-777777777777"
    baseline_entry["engine"] = "vllm"
    baseline_entry["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["engine"] = "vllm"
    baseline_entry["metadata"]["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["idempotency_key"] = (
        "vllm|0.11.0|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    entries = [current_entry, baseline_entry]
    manifest_entries = []
    for index, entry in enumerate(entries, start=1):
        artifact_name = f"hard_constraints_entry_{index}.json"
        (source_dir / artifact_name).write_text(
            json.dumps(entry, indent=2) + "\n", encoding="utf-8"
        )
        manifest_entries.append(
            {
                "entry_id": entry["entry_id"],
                "idempotency_key": entry["metadata"]["idempotency_key"],
                "canonical_path": entry["canonical_path"],
                "leaderboard_artifact": artifact_name,
                "canonical_artifact": f"hard_constraints_entry_{index}.canonical.json",
                "engine": entry["engine"],
                "workload": entry["workload"]["name"],
                "config_type": entry["config_type"],
                "category": "single",
            }
        )

    (source_dir / "leaderboard_manifest.json").write_text(
        json.dumps(
            {
                "schema_version": "leaderboard-export-manifest/v1",
                "generated_at": "2026-03-14T12:00:00Z",
                "entries": manifest_entries,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    output_dir = tmp_path / "website_data"
    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--source-dir",
            str(source_dir),
            "--output-dir",
            str(output_dir),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    compare_payload = json.loads(
        (output_dir / "leaderboard_compare.json").read_text(encoding="utf-8")
    )
    hard_constraints = compare_payload["hard_constraints"]

    assert hard_constraints["scope_count"] == 1
    assert hard_constraints["fail_count"] == 0
    assert hard_constraints["scopes"][0]["scope"]["engine"] == "vllm-hust"
    assert hard_constraints["scopes"][0]["latest"]["engine"] == "vllm-hust"
