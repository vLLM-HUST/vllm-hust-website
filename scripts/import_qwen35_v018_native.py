#!/usr/bin/env python3
"""Import the measured Qwen3.5 vLLM 0.18 native concurrency series."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

CONCURRENCIES = (1, 2, 4, 8, 16)
COHORT_ID = "qwen35-35b-a3b-bf16-sweprefix-smoke-v1"
SERIES_ID = "swe-v018-native-text-only-backport-20261001"
GROUP_ID = "native-runtime-v018-qwen35-backports-piecewise"
OFFICIAL_BASELINE_ID = "vllm-0.18.0-vllm-ascend-0.18.0"
GROUP_LABEL = (
    "Native · vLLM 0.18.0 + Qwen3.5 backports (9878e04) / "
    "Ascend 0.18.0 + Qwen3.5 backport (0f40ff0) · PIECEWISE"
)


def read_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def point_id(concurrency: int) -> str:
    return f"qwen35-v018-native-textonly-tp2-c{concurrency}-20261001"


def client_extract(config: dict) -> dict:
    keys = (
        "tool_version",
        "schema",
        "run_id",
        "started_at_unix",
        "model",
        "workload_sha256",
        "tokenizer",
        "concurrency",
        "duration",
        "chips",
        "seed",
        "timeout",
        "server_max_context",
        "cache_policy",
        "window_policy",
    )
    return {key: config[key] for key in keys}


def make_metrics(summary: dict) -> dict:
    return {
        "output_tps": summary["output_tokens_per_second"],
        "decode_p90_tps": summary["decode_tokens_per_second_p90"],
        "ttft_p95_ms": summary["ttft_seconds_p95"] * 1000,
        "completed_requests": summary["requests_completed_in_window"],
    }


def make_point(concurrency: int, summary: dict, config: dict) -> dict:
    metrics = make_metrics(summary)
    return {
        "id": point_id(concurrency),
        "cohort_id": COHORT_ID,
        "label": f"Native 0.18 + Qwen3.5 backports · C{concurrency}",
        "configuration": {
            "engine": "vLLM + vLLM-Ascend",
            "engine_version": "0.18.0+qwen35-backports / 0.18.0+qwen35-backport",
            "official_baseline_id": OFFICIAL_BASELINE_ID,
            "mods": [],
            "hardware": {"label": "Ascend 910B2", "accelerator_count": 2},
            "context_capacity_tokens": 262144,
            "parameters": {
                "tensor_parallel_size": 2,
                "pipeline_parallel_size": 1,
                "data_parallel_size": 1,
                "expert_parallel": False,
                "dtype": "bfloat16",
                "max_model_len": 262144,
                "max_num_seqs": 16,
                "max_num_batched_tokens": 4096,
                "async_scheduling": True,
                "prefix_caching": True,
                "mamba_cache_mode": "align",
                "gpu_memory_utilization": 0.95,
                "mtp_draft_tokens": 2,
                "thinking": True,
                "generation_temperature": 0,
                "task_queue_enable": 1,
                "graph_mode": "PIECEWISE",
                "requested_graph_mode": "FULL_AND_PIECEWISE",
                "graph_capture_sizes": [3, 6, 12, 24, 48],
                "max_cudagraph_capture_size": 48,
                "kv_cache_memory_bytes": 26038239232,
                "kv_cache_memory_bytes_scope": "Requested per chip",
                "effective_available_kv_cache_gib_per_chip": 23.37,
                "effective_gpu_kv_cache_tokens": 544768,
                "runtime_release_versions": {
                    "vllm": "0.18.0",
                    "vllm-ascend": "0.18.0",
                    "cann": "8.5.1",
                },
                "runtime_release_commits": {
                    "vllm": "bcf2be96120005e9aea171927f85055a6a5c0cf6",  # pragma: allowlist secret
                    "vllm-ascend": "e18643f8a4d5bd9990727654318ad069ea0b56e2",  # pragma: allowlist secret
                },
                "runtime_applied_commits": {
                    "vllm": "9878e0432107e69082f8837b1f275d3aad71fd4e",  # pragma: allowlist secret
                    "vllm-ascend": "0f40ff06f1c6b7e6efb8ae4850eb72bd35a47762",  # pragma: allowlist secret
                },
                "compatibility_scope": (
                    "Upstream-derived Qwen3.5 text-only registration/MTP config and "
                    "conditional multimodal-RoPE backports; not an untouched 0.18 binary"
                ),
                "official_image": "quay.io/ascend/vllm-ascend:v0.18.0",
                "official_image_index_digest": (
                    "sha256:697175418772c65b56afc04a7ccde7c24e7ad15a988a852eb8239fa9b6298e24"
                ),
                "official_image_arm64_digest": (
                    "sha256:2467d259ff068ca4edd7b50b849152910f3c05e435f314639fc06bcc7a00f9fa"
                ),
                "checkpoint_revision": "59d61f3ce65a6d9863b86d2e96597125219dc754",  # pragma: allowlist secret
                "checkpoint_provenance": (
                    "Hugging Face source identity retained; the cohort records its accepted "
                    "equivalence to the canonical ModelScope Qwen3.5 checkpoint without a byte-equality claim"
                ),
                "text_only_config_sha256": (
                    "5abb937cfa1f8a4089e37e34b25a7a3d7a5567bbde471875cf5734a19dd08521"  # pragma: allowlist secret
                ),
                "text_only_config_scope": (
                    "Derived from checkpoint text_config; tokenizer and weights remain symlinks to the source checkpoint"
                ),
                "benchmark_repository": "https://github.com/vLLM-HUST/swe-prefix-reuse",
                "benchmark_revision": "6861242dbd9f17b707003191e4200b7752911d7c",  # pragma: allowlist secret
                "observed_max_prompt_tokens": summary["max_prompt_tokens_observed"],
                "measured_mean_client_inflight": summary["mean_client_inflight"],
                "full_client_concurrency_fraction": summary[
                    "full_concurrency_fraction"
                ],
                "warmup_policy": (
                    "Separate 60s warm qualification after first-request ACL/Triton JIT; "
                    "formal windows use fresh measured session salts on one serially retained server"
                ),
                "execution_host": "isolated four-NPU evaluation container",
                "physical_devices": [4, 5],
                "runtime_visible_device_indices": [2, 3],
                "transport": "Client and server on execution-host loopback",
                "worker_class": "native_worker.Worker",
                "participating_deployment_chips": 2,
                "pod_npu_quota": 4,
            },
            "mod_sources": [],
        },
        "load": {
            "concurrency": concurrency,
            "unit": "continuously replenished in-flight HTTP request lanes",
            "concurrency_series": SERIES_ID,
            "presentation_group": {
                "id": GROUP_ID,
                "label_en": GROUP_LABEL,
                "label_zh": GROUP_LABEL,
            },
            "session_rotation_depth": 1,
        },
        "metrics": metrics,
        "evidence": {
            "execution_kind": "real-online",
            "sampling_date_utc": "2026-10-01",
            "sampling_date_source": "Recorded SWE client started_at_unix (UTC)",
            "status": "measured",
            "profile": "formal",
            "measurement_seconds": 900,
            "tuning_complete": False,
            "url": (
                "https://github.com/vLLM-HUST/vllm-hust-website/blob/main/"
                "docs/FRONTIER-QWEN35-NATIVE-RUNTIMES.md"
            ),
            "run_ids": [config["run_id"]],
            "aggregation": "One unpooled 900s observation; drain excluded",
            "benchmark_protocol": {
                "protocol_id": "swe-prefix-reuse/v1",
                "campaign": "qwen35-v018-native-text-only-20261001",
                "repository": "https://github.com/vLLM-HUST/swe-prefix-reuse",
                "revision": "6861242dbd9f17b707003191e4200b7752911d7c",  # pragma: allowlist secret
                "prepared_workload_sha256": (
                    "8044561ffa1bb430bea8f778ef814d96649321e1a92654b95f64263b996d5e85"  # pragma: allowlist secret
                ),
                "tokenizer_fingerprint": (
                    "3f9ca78537850303ee04bfa6640c020be89723c62f37121c0f27a4c0babc53e0"  # pragma: allowlist secret
                ),
            },
            "original_cohort_id": COHORT_ID,
        },
    }


def make_evidence_run(
    concurrency: int, summary: dict, config: dict, requests: Path
) -> dict:
    return {
        "run_id": config["run_id"],
        "point_id": point_id(concurrency),
        "summary": summary,
        "metrics": make_metrics(summary),
        "requests_artifact_sha256": sha256(requests),
        "validation": {
            "real_online": True,
            "failed_requests": 0,
            "prefix_cache_observed": True,
            "native_mtp_observed": True,
            "effective_graph_mode": "PIECEWISE ACL Graph",
            "series_devices_released": True,
            "source_and_runtime_sha256_manifest_verified": True,
        },
        "client": client_extract(config),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence_root", type=Path)
    parser.add_argument("--data-root", type=Path, default=Path("data"))
    args = parser.parse_args()

    frontier_path = args.data_root / "leaderboard_frontier.json"
    evidence_path = args.data_root / "leaderboard_frontier_swe_evidence.json"
    frontier = read_json(frontier_path)
    evidence = read_json(evidence_path)

    if any(
        point["load"].get("concurrency_series") == SERIES_ID
        for point in frontier["points"]
    ):
        raise SystemExit(f"series already exists: {SERIES_ID}")

    new_points = []
    new_runs = []
    for concurrency in CONCURRENCIES:
        run_root = args.evidence_root / f"C{concurrency}-900s" / "workload-result"
        summary = read_json(run_root / "summary.json")
        config = read_json(run_root / "config.json")
        if not summary["valid"] or summary["measurement_seconds"] != 900:
            raise SystemExit(f"invalid formal window C{concurrency}")
        if summary["failed_requests"] != 0 or config["concurrency"] != concurrency:
            raise SystemExit(f"failed or mismatched formal window C{concurrency}")
        if (
            summary["output_tokens_per_second"] <= 0
            or summary["decode_tokens_per_second_p90"] is None
        ):
            raise SystemExit(f"missing measured metrics C{concurrency}")
        new_points.append(make_point(concurrency, summary, config))
        new_runs.append(
            make_evidence_run(concurrency, summary, config, run_root / "requests.jsonl")
        )

    cohort = next(cohort for cohort in frontier["cohorts"] if cohort["id"] == COHORT_ID)
    display_series = cohort["workload"]["contract"]["display_series_ids"]
    display_series.insert(0, SERIES_ID)
    defaults = cohort["workload"]["contract"]["default_groups"]
    defaults.insert(0, GROUP_ID)
    frontier["official_baseline"]["measurement_note"] = (
        "Qwen3.5 requires the disclosed text-only compatibility backports on the 0.18 release line. "
        "The measured baseline uses effective PIECEWISE ACL Graph mode and the runtime's available "
        "23.37 GiB/chip KV capacity; it is a visible runtime reference, not a matched comparator for "
        "the separate 0.25 Native configurations."
    )
    frontier["points"].extend(new_points)
    evidence["runs"].extend(new_runs)
    write_json(frontier_path, frontier)
    write_json(evidence_path, evidence)


if __name__ == "__main__":
    main()
