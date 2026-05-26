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
            "git_commit": "test-commit-123",
            "github_user": "octocat",
            "github_commit_url": "https://github.com/vLLM-HUST/vllm-hust/commit/test-commit-123",
            "github_repository": "vLLM-HUST/vllm-hust",
            "github_ref": "feature/bench-provenance",
            "github_event_name": "pull_request",
            "github_pr_number": 42,
            "github_pr_url": "https://github.com/vLLM-HUST/vllm-hust/pull/42",
            "release_date": "2026-03-14",
            "changelog_url": "https://example.com/changelog",
            "notes": "Benchmark run: short",
            "verified": True,
            "idempotency_key": "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu",  # pragma: allowlist secret
        },
        "canonical_path": "canonical/test_leaderboard.json",
    }


def _same_spec_payload(spec_id: str, spec_hash: str) -> dict:
    return {
        "schema_version": "benchmark-same-spec/v1",
        "spec_id": spec_id,
        "resolved_spec_hash": spec_hash,
        "resolved_server_parameters": {
            "tensor_parallel_size": 1,
            "dtype": "float16",
        },
        "resolved_client_parameters": {
            "dataset_name": "random",
            "random_input_len": 1024,
            "random_output_len": 256,
            "request_rate": 1,
        },
    }


def _load_compare_payload(script: Path, source_dir: Path, output_dir: Path) -> dict:
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
    return json.loads(
        (output_dir / "leaderboard_compare.json").read_text(encoding="utf-8")
    )


def _write_manifest_entries(source_dir: Path, entries: list[dict]) -> None:
    manifest_entries = []
    for index, entry in enumerate(entries, start=1):
        artifact_name = f"entry_{index}.json"
        (source_dir / artifact_name).write_text(
            json.dumps(entry, indent=2) + "\n", encoding="utf-8"
        )
        config_type = str(entry.get("config_type") or "single_gpu")
        manifest_entries.append(
            {
                "entry_id": entry["entry_id"],
                "idempotency_key": entry["metadata"]["idempotency_key"],
                "canonical_path": entry["canonical_path"],
                "leaderboard_artifact": artifact_name,
                "canonical_artifact": f"entry_{index}.canonical.json",
                "engine": entry["engine"],
                "workload": entry["workload"]["name"],
                "config_type": config_type,
                "category": "multi"
                if config_type in {"multi_gpu", "multi_node"}
                else "single",
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


def _run_aggregate(
    script: Path, source_dir: Path, output_dir: Path, *extra_args: str
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(script),
            "--source-dir",
            str(source_dir),
            "--output-dir",
            str(output_dir),
            *extra_args,
        ],
        capture_output=True,
        text=True,
        check=False,
    )


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
    assert single_payload[0]["model"]["canonical_id"] == "hf:Qwen/Qwen2.5-0.5B-Instruct"
    assert single_payload[0]["model"]["repo_id"] == "Qwen/Qwen2.5-0.5B-Instruct"
    assert single_payload[0]["model"]["short_name"] == "Qwen2.5-0.5B-Instruct"
    assert single_payload[0]["model"]["display_name"] == "Qwen2.5-0.5B-Instruct"
    assert single_payload[0]["metadata"]["github_user"] == "octocat"
    assert single_payload[0]["metadata"]["git_commit"] == "test-commit-123"


def test_aggregate_results_places_multi_gpu_entry_in_multi_snapshot(
    tmp_path: Path,
) -> None:
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
    result = _run_aggregate(script, source_dir, output_dir)

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


def test_aggregate_results_sanitizes_dirty_engine_version(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    dirty_entry = _valid_entry()
    dirty_entry["engine_version"] = "dev\npath string is NULLpath string is NULL"
    dirty_entry["metadata"]["engine_version"] = dirty_entry["engine_version"]
    dirty_entry["metadata"]["git_commit"] = "1111111111111111111111111111111111111111"

    artifact = source_dir / "dirty_leaderboard.json"
    artifact.write_text(json.dumps(dirty_entry, indent=2) + "\n", encoding="utf-8")
    _write_manifest_entries(source_dir, [dirty_entry])

    output_dir = tmp_path / "website_data"
    result = _run_aggregate(script, source_dir, output_dir)

    assert result.returncode == 0, result.stderr or result.stdout
    single_payload = json.loads(
        (output_dir / "leaderboard_single.json").read_text(encoding="utf-8")
    )
    assert single_payload[0]["engine_version"] == "g11111111"
    assert single_payload[0]["metadata"]["engine_version"] == "g11111111"


def test_aggregate_results_backfills_missing_910b3_memory_for_existing_and_incoming_entries(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()
    output_dir = tmp_path / "website_data"
    output_dir.mkdir()

    existing_entry = _valid_entry()
    existing_entry["entry_id"] = "11111111-1111-1111-1111-111111111111"
    existing_entry["engine"] = "vllm-hust"
    existing_entry["engine_version"] = "0.20.1"
    existing_entry["metadata"]["engine"] = "vllm-hust"
    existing_entry["metadata"]["engine_version"] = "0.20.1"
    existing_entry["hardware"]["vendor"] = "Huawei"
    existing_entry["hardware"]["chip_model"] = "910B3"
    existing_entry["hardware"]["chip_count"] = 4
    existing_entry["hardware"].pop("memory_per_chip_gb")
    existing_entry["hardware"].pop("total_memory_gb")
    existing_entry["metadata"]["idempotency_key"] = (
        "existing|0.20.1|short|qwen-qwen2.5-0.5b-instruct|fp16|910b3|4|1|multi_gpu"
    )
    existing_entry["config_type"] = "multi_gpu"

    (output_dir / "leaderboard_single.json").write_text(
        "[]\n",
        encoding="utf-8",
    )
    (output_dir / "leaderboard_multi.json").write_text(
        json.dumps([existing_entry], indent=2) + "\n",
        encoding="utf-8",
    )

    incoming_entry = _valid_entry()
    incoming_entry["entry_id"] = "22222222-2222-2222-2222-222222222222"
    incoming_entry["engine"] = "vllm-hust"
    incoming_entry["engine_version"] = "0.20.2"
    incoming_entry["metadata"]["engine"] = "vllm-hust"
    incoming_entry["metadata"]["engine_version"] = "0.20.2"
    incoming_entry["hardware"]["vendor"] = "Huawei"
    incoming_entry["hardware"]["chip_model"] = "910B3"
    incoming_entry["hardware"]["chip_count"] = 2
    incoming_entry["hardware"].pop("memory_per_chip_gb")
    incoming_entry["hardware"].pop("total_memory_gb")
    incoming_entry["metadata"]["idempotency_key"] = (
        "incoming|0.20.2|short|qwen-qwen2.5-0.5b-instruct|fp16|910b3|2|1|multi_gpu"
    )
    incoming_entry["config_type"] = "multi_gpu"

    _write_manifest_entries(source_dir, [incoming_entry])
    result = _run_aggregate(script, source_dir, output_dir)

    assert result.returncode == 0, result.stderr or result.stdout
    multi_payload = json.loads(
        (output_dir / "leaderboard_multi.json").read_text(encoding="utf-8")
    )
    payload_by_id = {entry["entry_id"]: entry for entry in multi_payload}

    assert (
        payload_by_id["11111111-1111-1111-1111-111111111111"]["hardware"][
            "memory_per_chip_gb"
        ]
        == 64.0
    )
    assert (
        payload_by_id["11111111-1111-1111-1111-111111111111"]["hardware"][
            "total_memory_gb"
        ]
        == 256.0
    )
    assert (
        payload_by_id["22222222-2222-2222-2222-222222222222"]["hardware"][
            "memory_per_chip_gb"
        ]
        == 64.0
    )
    assert (
        payload_by_id["22222222-2222-2222-2222-222222222222"]["hardware"][
            "total_memory_gb"
        ]
        == 128.0
    )


def test_aggregate_results_merge_updates_only_touched_categories(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()
    output_dir = tmp_path / "website_data"
    output_dir.mkdir()

    existing_single = _valid_entry()
    existing_single["entry_id"] = "11111111-1111-1111-1111-111111111111"
    existing_single["metadata"]["submitted_at"] = "2026-03-13T12:00:00Z"
    existing_single["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    existing_multi_chip = _valid_entry()
    existing_multi_chip["entry_id"] = "22222222-2222-2222-2222-222222222222"
    existing_multi_chip["config_type"] = "multi_gpu"
    existing_multi_chip["hardware"]["chip_count"] = 4
    existing_multi_chip["hardware"]["chips_per_node"] = 4
    existing_multi_chip["hardware"]["total_memory_gb"] = 320
    existing_multi_chip["metadata"]["submitted_at"] = "2026-03-13T12:05:00Z"
    existing_multi_chip["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|4|1|multi_gpu"
    )

    existing_multi_node = _valid_entry()
    existing_multi_node["entry_id"] = "33333333-3333-3333-3333-333333333333"
    existing_multi_node["config_type"] = "multi_node"
    existing_multi_node["hardware"]["chip_count"] = 8
    existing_multi_node["hardware"]["chips_per_node"] = 4
    existing_multi_node["hardware"]["total_memory_gb"] = 640
    existing_multi_node["cluster"] = {
        "node_count": 2,
        "comm_backend": "HCCL",
        "inter_node_network": "RoCE",
        "network_bandwidth_gbps": 200,
        "topology_type": "Ring",
    }
    existing_multi_node["metadata"]["submitted_at"] = "2026-03-13T12:10:00Z"
    existing_multi_node["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|8|2|multi_node"
    )

    (output_dir / "leaderboard_single.json").write_text(
        json.dumps([existing_single, existing_multi_chip], indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "leaderboard_multi.json").write_text(
        json.dumps([existing_multi_node], indent=2) + "\n",
        encoding="utf-8",
    )

    incoming_single = _valid_entry()
    incoming_single["entry_id"] = "44444444-4444-4444-4444-444444444444"
    incoming_single["metadata"]["submitted_at"] = "2026-03-14T12:00:00Z"
    incoming_single["metadata"]["idempotency_key"] = (
        "engine-b|9.9.9|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    incoming_single["engine"] = "engine-b"
    incoming_single["engine_version"] = "9.9.9"
    incoming_single["metadata"]["engine"] = "engine-b"
    incoming_single["metadata"]["engine_version"] = "9.9.9"

    _write_manifest_entries(source_dir, [incoming_single])
    result = _run_aggregate(script, source_dir, output_dir)

    assert result.returncode == 0, result.stderr or result.stdout
    single_payload = json.loads(
        (output_dir / "leaderboard_single.json").read_text(encoding="utf-8")
    )
    multi_payload = json.loads(
        (output_dir / "leaderboard_multi.json").read_text(encoding="utf-8")
    )

    assert {entry["entry_id"] for entry in single_payload} == {
        "44444444-4444-4444-4444-444444444444",
        "11111111-1111-1111-1111-111111111111",
    }
    assert {entry["entry_id"] for entry in multi_payload} == {
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
    }


def test_aggregate_results_merge_preserves_single_node_data_on_multi_node_update(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()
    output_dir = tmp_path / "website_data"
    output_dir.mkdir()

    existing_single = _valid_entry()
    existing_single["entry_id"] = "55555555-5555-5555-5555-555555555555"
    existing_single["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )

    existing_multi_chip = _valid_entry()
    existing_multi_chip["entry_id"] = "66666666-6666-6666-6666-666666666666"
    existing_multi_chip["config_type"] = "multi_gpu"
    existing_multi_chip["hardware"]["chip_count"] = 2
    existing_multi_chip["hardware"]["chips_per_node"] = 2
    existing_multi_chip["hardware"]["total_memory_gb"] = 160
    existing_multi_chip["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|2|1|multi_gpu"
    )

    existing_multi_node = _valid_entry()
    existing_multi_node["entry_id"] = "77777777-7777-7777-7777-777777777777"
    existing_multi_node["config_type"] = "multi_node"
    existing_multi_node["hardware"]["chip_count"] = 8
    existing_multi_node["hardware"]["chips_per_node"] = 4
    existing_multi_node["hardware"]["total_memory_gb"] = 640
    existing_multi_node["cluster"] = {
        "node_count": 2,
        "comm_backend": "HCCL",
        "inter_node_network": "RoCE",
        "network_bandwidth_gbps": 200,
        "topology_type": "Ring",
    }
    existing_multi_node["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|8|2|multi_node"
    )

    (output_dir / "leaderboard_single.json").write_text(
        json.dumps([existing_single, existing_multi_chip], indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "leaderboard_multi.json").write_text(
        json.dumps([existing_multi_node], indent=2) + "\n",
        encoding="utf-8",
    )

    incoming_multi_node = _valid_entry()
    incoming_multi_node["entry_id"] = "88888888-8888-8888-8888-888888888888"
    incoming_multi_node["engine"] = "engine-b"
    incoming_multi_node["engine_version"] = "9.9.9"
    incoming_multi_node["metadata"]["engine"] = "engine-b"
    incoming_multi_node["metadata"]["engine_version"] = "9.9.9"
    incoming_multi_node["config_type"] = "multi_node"
    incoming_multi_node["hardware"]["chip_count"] = 16
    incoming_multi_node["hardware"]["chips_per_node"] = 8
    incoming_multi_node["hardware"]["total_memory_gb"] = 1280
    incoming_multi_node["cluster"] = {
        "node_count": 2,
        "comm_backend": "HCCL",
        "inter_node_network": "RoCE",
        "network_bandwidth_gbps": 400,
        "topology_type": "Mesh",
    }
    incoming_multi_node["metadata"]["idempotency_key"] = (
        "engine-b|9.9.9|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|16|2|multi_node"
    )

    _write_manifest_entries(source_dir, [incoming_multi_node])
    result = _run_aggregate(script, source_dir, output_dir)

    assert result.returncode == 0, result.stderr or result.stdout
    single_payload = json.loads(
        (output_dir / "leaderboard_single.json").read_text(encoding="utf-8")
    )
    multi_payload = json.loads(
        (output_dir / "leaderboard_multi.json").read_text(encoding="utf-8")
    )

    assert {entry["entry_id"] for entry in single_payload} == {
        "55555555-5555-5555-5555-555555555555",
    }
    assert {entry["entry_id"] for entry in multi_payload} == {
        "66666666-6666-6666-6666-666666666666",
        "77777777-7777-7777-7777-777777777777",
        "88888888-8888-8888-8888-888888888888",
    }


def test_aggregate_results_merge_dedupes_reprocessed_entry_by_entry_id(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()
    output_dir = tmp_path / "website_data"
    output_dir.mkdir()

    existing_entry = _valid_entry()
    existing_entry["entry_id"] = "99999999-9999-9999-9999-999999999999"
    existing_entry["metadata"]["submitted_at"] = "2026-03-14T12:00:00Z"

    (output_dir / "leaderboard_single.json").write_text(
        json.dumps([existing_entry], indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "leaderboard_multi.json").write_text(
        json.dumps([], indent=2) + "\n",
        encoding="utf-8",
    )

    incoming_entry = _valid_entry()
    incoming_entry["entry_id"] = "99999999-9999-9999-9999-999999999999"
    incoming_entry["metadata"]["submitted_at"] = "2026-03-14T12:00:00Z"

    _write_manifest_entries(source_dir, [incoming_entry])
    result = _run_aggregate(script, source_dir, output_dir)

    assert result.returncode == 0, result.stderr or result.stdout
    single_payload = json.loads(
        (output_dir / "leaderboard_single.json").read_text(encoding="utf-8")
    )

    assert len(single_payload) == 1
    assert single_payload[0]["entry_id"] == "99999999-9999-9999-9999-999999999999"


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


def test_aggregate_results_builds_goal_progress_for_official_baseline(
    tmp_path: Path,
) -> None:
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
    current_entry["same_spec"] = _same_spec_payload("spec-1", "hash-1")

    baseline_entry = _valid_entry()
    baseline_entry["entry_id"] = "22222222-2222-2222-2222-222222222222"
    baseline_entry["engine"] = "vllm"
    baseline_entry["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["engine"] = "vllm"
    baseline_entry["metadata"]["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["github_repository"] = "vllm-project/vllm-ascend"
    baseline_entry["metadata"]["github_commit_url"] = (
        "https://github.com/vllm-project/vllm-ascend/commit/def456"
    )
    baseline_entry["metadata"]["git_commit"] = "def456"
    baseline_entry["metrics"]["ttft_ms"] = 100.0
    baseline_entry["metrics"]["tbt_ms"] = 8.0
    baseline_entry["metrics"]["throughput_tps"] = 240.0
    baseline_entry["metadata"]["idempotency_key"] = (
        "vllm|0.11.0|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    baseline_entry["same_spec"] = _same_spec_payload("spec-1", "hash-1")

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
    assert (
        goal_progress["headline_pair"]["baseline_target"]["id"]
        == "official-ascend-jan-2026-v0.11.0"
    )
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
    current_entry["same_spec"] = _same_spec_payload("spec-2", "hash-2")

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
    baseline_entry["same_spec"] = _same_spec_payload("spec-2", "hash-2")

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

    single_payload = json.loads(
        (output_dir / "leaderboard_single.json").read_text(encoding="utf-8")
    )
    payload_by_id = {entry["entry_id"]: entry for entry in single_payload}

    assert (
        payload_by_id["44444444-4444-4444-4444-444444444444"]["model"]["name"]
        == "Qwen/Qwen2.5-0.5B-Instruct"
    )
    assert (
        payload_by_id["44444444-4444-4444-4444-444444444444"]["model"]["canonical_id"]
        == "hf:Qwen/Qwen2.5-0.5B-Instruct"
    )
    assert (
        goal_progress["headline_pair"]["scope"]["model"] == "Qwen/Qwen2.5-0.5B-Instruct"
    )
    assert (
        goal_progress["headline_pair"]["scope"]["model_short_name"]
        == "Qwen2.5-0.5B-Instruct"
    )
    assert (
        goal_progress["headline_pair"]["scope"]["model_display_name"]
        == "Qwen2.5-0.5B-Instruct"
    )

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
    assert (
        hard_constraints["best_scope_key"] == hard_constraints["scopes"][0]["scope_key"]
    )
    assert hard_constraints["scopes"][0]["selection_rank"] == 1
    assert hard_constraints["scopes"][0]["scope"]["engine"] == "vllm-hust"
    assert hard_constraints["scopes"][0]["latest"]["engine"] == "vllm-hust"


def test_aggregate_results_hard_constraints_rank_best_scope_first(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    stronger_entry = _valid_entry()
    stronger_entry["entry_id"] = "10101010-1010-1010-1010-101010101010"
    stronger_entry["engine"] = "vllm-hust"
    stronger_entry["engine_version"] = "0.20.1"
    stronger_entry["metadata"]["engine"] = "vllm-hust"
    stronger_entry["metadata"]["engine_version"] = "0.20.1"
    stronger_entry["metadata"]["submitted_at"] = "2026-05-14T09:00:00Z"
    stronger_entry["metadata"]["idempotency_key"] = (
        "vllm-hust|0.20.1|sharegpt-online|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    stronger_entry["workload"]["name"] = "sharegpt-online"
    stronger_entry["constraints"]["metrics"].update(
        {
            "single_chip_effective_utilization_pct": 95.0,
            "typical_throughput_ratio_vs_baseline": 2.45,
            "typical_ttft_reduction_pct_vs_baseline": 28.0,
            "typical_tpot_reduction_pct_vs_baseline": 27.0,
            "long_context_length": 65536,
            "unit_token_cost_reduction_pct": 41.0,
            "multi_tenant_high_utilization": True,
        }
    )

    weaker_entry = _valid_entry()
    weaker_entry["entry_id"] = "20202020-2020-2020-2020-202020202020"
    weaker_entry["engine"] = "vllm-hust"
    weaker_entry["engine_version"] = "0.19.9"
    weaker_entry["metadata"]["engine"] = "vllm-hust"
    weaker_entry["metadata"]["engine_version"] = "0.19.9"
    weaker_entry["metadata"]["submitted_at"] = "2026-05-14T08:00:00Z"
    weaker_entry["metadata"]["idempotency_key"] = (
        "vllm-hust|0.19.9|random-online|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    weaker_entry["workload"]["name"] = "random-online"
    weaker_entry["constraints"]["metrics"].update(
        {
            "single_chip_effective_utilization_pct": 90.5,
            "typical_throughput_ratio_vs_baseline": 2.05,
            "typical_ttft_reduction_pct_vs_baseline": 21.0,
            "typical_tpot_reduction_pct_vs_baseline": 20.5,
            "long_context_length": 32768,
            "unit_token_cost_reduction_pct": 31.0,
            "multi_tenant_high_utilization": True,
        }
    )

    _write_manifest_entries(source_dir, [weaker_entry, stronger_entry])
    output_dir = tmp_path / "website_data"
    compare_payload = _load_compare_payload(script, source_dir, output_dir)
    hard_constraints = compare_payload["hard_constraints"]

    assert hard_constraints["scope_count"] == 2
    assert (
        hard_constraints["best_scope_key"] == hard_constraints["scopes"][0]["scope_key"]
    )
    assert hard_constraints["scopes"][0]["selection_rank"] == 1
    assert hard_constraints["scopes"][1]["selection_rank"] == 2
    assert hard_constraints["scopes"][0]["scope"]["workload"] == "sharegpt-online"
    assert hard_constraints["scopes"][1]["scope"]["workload"] == "random-online"


def test_aggregate_results_fails_on_same_spec_hash_mismatch(tmp_path: Path) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    current_entry = _valid_entry()
    current_entry["entry_id"] = "88888888-8888-8888-8888-888888888888"
    current_entry["engine"] = "vllm-hust"
    current_entry["engine_version"] = "0.20.1rc1.dev314"
    current_entry["metadata"]["engine"] = "vllm-hust"
    current_entry["metadata"]["engine_version"] = "0.20.1rc1.dev314"
    current_entry["metadata"]["github_repository"] = "vLLM-HUST/vllm-ascend-hust"
    current_entry["metadata"]["idempotency_key"] = (
        "vllm-hust|0.20.1rc1.dev314|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    current_entry["same_spec"] = _same_spec_payload("spec-3", "hash-current")

    baseline_entry = _valid_entry()
    baseline_entry["entry_id"] = "99999999-9999-9999-9999-999999999999"
    baseline_entry["engine"] = "vllm"
    baseline_entry["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["engine"] = "vllm"
    baseline_entry["metadata"]["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["github_repository"] = "vllm-project/vllm-ascend"
    baseline_entry["metadata"]["idempotency_key"] = (
        "vllm|0.11.0|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    baseline_entry["same_spec"] = _same_spec_payload("spec-3", "hash-baseline")

    entries = [current_entry, baseline_entry]
    manifest_entries = []
    for index, entry in enumerate(entries, start=1):
        artifact_name = f"mismatch_entry_{index}.json"
        (source_dir / artifact_name).write_text(
            json.dumps(entry, indent=2) + "\n", encoding="utf-8"
        )
        manifest_entries.append(
            {
                "entry_id": entry["entry_id"],
                "idempotency_key": entry["metadata"]["idempotency_key"],
                "canonical_path": entry["canonical_path"],
                "leaderboard_artifact": artifact_name,
                "canonical_artifact": f"mismatch_entry_{index}.canonical.json",
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

    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--source-dir",
            str(source_dir),
            "--output-dir",
            str(tmp_path / "website_data"),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "resolved_spec_hash mismatch" in (result.stderr + result.stdout)


def test_aggregate_results_separates_compare_groups_by_same_spec_hash(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    left_entry = _valid_entry()
    left_entry["entry_id"] = "10101010-1010-1010-1010-101010101010"
    left_entry["engine"] = "engine-a"
    left_entry["metadata"]["engine"] = "engine-a"
    left_entry["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu|compare-hash-a"
    )
    left_entry["same_spec"] = _same_spec_payload("spec-compare", "hash-left")

    right_entry = _valid_entry()
    right_entry["entry_id"] = "20202020-2020-2020-2020-202020202020"
    right_entry["engine"] = "engine-b"
    right_entry["metadata"]["engine"] = "engine-b"
    right_entry["metadata"]["idempotency_key"] = (
        "engine-b|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu|compare-hash-b"
    )
    right_entry["same_spec"] = _same_spec_payload("spec-compare", "hash-right")

    entries = [left_entry, right_entry]
    manifest_entries = []
    for index, entry in enumerate(entries, start=1):
        artifact_name = f"compare_mismatch_{index}.json"
        (source_dir / artifact_name).write_text(
            json.dumps(entry, indent=2) + "\n", encoding="utf-8"
        )
        manifest_entries.append(
            {
                "entry_id": entry["entry_id"],
                "idempotency_key": entry["metadata"]["idempotency_key"],
                "canonical_path": entry["canonical_path"],
                "leaderboard_artifact": artifact_name,
                "canonical_artifact": f"compare_mismatch_{index}.canonical.json",
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

    compare_payload = _load_compare_payload(
        script, source_dir, tmp_path / "website_data"
    )

    assert compare_payload["group_count"] == 0
    assert compare_payload["preferred_pair_count"] == 0


def test_compare_snapshot_prefers_matching_same_spec_pair(tmp_path: Path) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    engine_a_newer = _valid_entry()
    engine_a_newer["entry_id"] = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    engine_a_newer["engine"] = "engine-a"
    engine_a_newer["metadata"]["engine"] = "engine-a"
    engine_a_newer["metadata"]["submitted_at"] = "2026-03-14T12:10:00Z"
    engine_a_newer["metrics"]["throughput_tps"] = 120.0
    engine_a_newer["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu|hash-a"
    )
    engine_a_newer["same_spec"] = _same_spec_payload("spec-4", "hash-a")

    engine_a_matching = _valid_entry()
    engine_a_matching["entry_id"] = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    engine_a_matching["engine"] = "engine-a"
    engine_a_matching["metadata"]["engine"] = "engine-a"
    engine_a_matching["metadata"]["submitted_at"] = "2026-03-14T12:05:00Z"
    engine_a_matching["metrics"]["throughput_tps"] = 110.0
    engine_a_matching["metadata"]["idempotency_key"] = (
        "engine-a|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu|hash-shared-a"
    )
    engine_a_matching["same_spec"] = _same_spec_payload("spec-4", "hash-shared")

    engine_b_matching = _valid_entry()
    engine_b_matching["entry_id"] = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    engine_b_matching["engine"] = "engine-b"
    engine_b_matching["metadata"]["engine"] = "engine-b"
    engine_b_matching["metadata"]["submitted_at"] = "2026-03-14T12:08:00Z"
    engine_b_matching["metrics"]["throughput_tps"] = 105.0
    engine_b_matching["metadata"]["idempotency_key"] = (
        "engine-b|1.2.3|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu|hash-shared-b"
    )
    engine_b_matching["same_spec"] = _same_spec_payload("spec-4", "hash-shared")

    entries = [engine_a_newer, engine_a_matching, engine_b_matching]
    manifest_entries = []
    for index, entry in enumerate(entries, start=1):
        artifact_name = f"compare_pair_{index}.json"
        (source_dir / artifact_name).write_text(
            json.dumps(entry, indent=2) + "\n", encoding="utf-8"
        )
        manifest_entries.append(
            {
                "entry_id": entry["entry_id"],
                "idempotency_key": entry["metadata"]["idempotency_key"],
                "canonical_path": entry["canonical_path"],
                "leaderboard_artifact": artifact_name,
                "canonical_artifact": f"compare_pair_{index}.canonical.json",
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
    preferred_pair = compare_payload["preferred_pairs"][0]["preferred_pair"]

    assert preferred_pair["left"]["same_spec"]["resolved_spec_hash"] == "hash-shared"
    assert preferred_pair["right"]["same_spec"]["resolved_spec_hash"] == "hash-shared"


def test_aggregate_results_prefers_cross_engine_same_spec_pair(
    tmp_path: Path,
) -> None:
    website_root = Path(__file__).resolve().parents[1]
    script = website_root / "scripts" / "aggregate_results.py"
    source_dir = tmp_path / "benchmark_outputs"
    source_dir.mkdir()

    latest_current_entry = _valid_entry()
    latest_current_entry["entry_id"] = "aaaa1111-1111-1111-1111-111111111111"
    latest_current_entry["engine"] = "vllm-hust"
    latest_current_entry["engine_version"] = "0.20.1rc1.dev314"
    latest_current_entry["metadata"]["engine"] = "vllm-hust"
    latest_current_entry["metadata"]["engine_version"] = "0.20.1rc1.dev314"
    latest_current_entry["metadata"]["github_repository"] = "vLLM-HUST/vllm-hust"
    latest_current_entry["metadata"]["submitted_at"] = "2026-05-12T13:34:13Z"
    latest_current_entry["metadata"]["git_commit"] = "latest-current"
    latest_current_entry["metrics"]["ttft_ms"] = 381.71
    latest_current_entry["metrics"]["tbt_ms"] = 115.68
    latest_current_entry["metrics"]["throughput_tps"] = 224.82
    latest_current_entry["metadata"]["idempotency_key"] = (
        "vllm-hust|latest|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    latest_current_entry["same_spec"] = _same_spec_payload("spec-1", "hash-shared")

    older_current_entry = _valid_entry()
    older_current_entry["entry_id"] = "bbbb2222-2222-2222-2222-222222222222"
    older_current_entry["engine"] = "vllm-hust"
    older_current_entry["engine_version"] = "0.20.1rc1.dev314"
    older_current_entry["metadata"]["engine"] = "vllm-hust"
    older_current_entry["metadata"]["engine_version"] = "0.20.1rc1.dev314"
    older_current_entry["metadata"]["github_repository"] = "vLLM-HUST/vllm-hust"
    older_current_entry["metadata"]["submitted_at"] = "2026-05-12T10:53:48Z"
    older_current_entry["metadata"]["git_commit"] = "older-current"
    older_current_entry["metrics"]["ttft_ms"] = 389.21
    older_current_entry["metrics"]["tbt_ms"] = 120.80
    older_current_entry["metrics"]["throughput_tps"] = 223.27
    older_current_entry["metadata"]["idempotency_key"] = (
        "vllm-hust|older|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    older_current_entry["same_spec"] = _same_spec_payload("spec-1", "hash-shared")

    baseline_entry = _valid_entry()
    baseline_entry["entry_id"] = "cccc3333-3333-3333-3333-333333333333"
    baseline_entry["engine"] = "vllm"
    baseline_entry["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["engine"] = "vllm"
    baseline_entry["metadata"]["engine_version"] = "0.11.0"
    baseline_entry["metadata"]["github_repository"] = "vllm-project/vllm-ascend"
    baseline_entry["metadata"]["submitted_at"] = "2026-05-08T07:28:09Z"
    baseline_entry["metadata"]["git_commit"] = "baseline"
    baseline_entry["metrics"]["ttft_ms"] = 271.10
    baseline_entry["metrics"]["tbt_ms"] = 72.78
    baseline_entry["metrics"]["throughput_tps"] = 227.14
    baseline_entry["metadata"]["idempotency_key"] = (
        "vllm|0.11.0|short|qwen-qwen2.5-0.5b-instruct|fp16|a100|1|1|single_gpu"
    )
    baseline_entry["same_spec"] = _same_spec_payload("spec-1", "hash-shared")

    entries = [latest_current_entry, older_current_entry, baseline_entry]
    manifest_entries = []
    for index, entry in enumerate(entries, start=1):
        artifact_name = f"cross_engine_pair_{index}.json"
        (source_dir / artifact_name).write_text(
            json.dumps(entry, indent=2) + "\n", encoding="utf-8"
        )
        manifest_entries.append(
            {
                "entry_id": entry["entry_id"],
                "idempotency_key": entry["metadata"]["idempotency_key"],
                "canonical_path": entry["canonical_path"],
                "leaderboard_artifact": artifact_name,
                "canonical_artifact": f"cross_engine_pair_{index}.canonical.json",
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
    preferred_pair = compare_payload["preferred_pairs"][0]["preferred_pair"]

    assert preferred_pair["left"]["engine"] == "vllm"
    assert preferred_pair["right"]["engine"] == "vllm-hust"
    assert preferred_pair["right"]["entry_id"] == latest_current_entry["entry_id"]
