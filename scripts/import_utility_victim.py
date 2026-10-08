#!/usr/bin/env python3
"""Import the six retained C16 utility-victim observations, never a C sweep."""

import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
COHORT = "utility-victim-qwen35-bf16-swe-c16-m65-20261002"
REPORT = "https://github.com/vLLM-HUST/vllm-hust-website/blob/main/docs/UTILITY-VICTIM-C16.md"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def percentile(values, q):
    values = sorted(values)
    if not values:
        return None
    index = (len(values) - 1) * q
    lo, hi = math.floor(index), math.ceil(index)
    return values[lo] + (values[hi] - values[lo]) * (index - lo)


def import_run(source, arm, repeat):
    name = f"{arm}-m65-c16-r{repeat}"
    root = source / "results"
    run = root / name
    summary, client = read(run / "summary.json"), read(run / "config.json")
    assert summary["valid"] and not summary["aborted"]
    assert summary["failed_requests"] == 0
    assert summary["measurement_seconds"] == client["duration"] == 900
    assert (client["concurrency"], client["chips"], client["server_max_context"]) == (
        16,
        2,
        262144,
    )
    records = [
        json.loads(line)
        for line in (run / "requests.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert len(records) == summary["requests_started"]
    assert all(
        r["success"] and len(r["token_ids"]) == r["expected_output_tokens"]
        for r in records
    )
    completed = [r for r in records if r["end"] <= 900]
    tokens = sum(n for r in records for t, n in r["chunks"] if 0 <= t < 900)
    assert len(completed) == summary["requests_completed_in_window"]
    assert tokens == summary["observed_output_tokens_in_window"]
    assert tokens / 900 == summary["output_tokens_per_second"]
    speeds = [
        r["decode_tokens_per_second"]
        for r in completed
        if r["decode_tokens_per_second"] is not None
    ]
    assert math.isclose(
        percentile(speeds, 0.9), summary["decode_tokens_per_second_p90"], rel_tol=1e-9
    )
    assert math.isclose(
        percentile([r["ttft_seconds"] for r in completed], 0.95),
        summary["ttft_seconds_p95"],
        rel_tol=1e-9,
    )
    metrics = {
        "output_tps": summary["output_tokens_per_second"],
        "decode_p90_tps": summary["decode_tokens_per_second_p90"],
        "ttft_p95_ms": summary["ttft_seconds_p95"] * 1000,
        "completed_requests": len(completed),
    }
    log = (root / f"{name}.server.log").read_text(encoding="utf-8", errors="replace")
    on = arm == "on"
    assert f"SWE_AB mode={arm} kill_switch={0 if on else 1} memory_fraction=0.65" in log
    command = next(
        line.removeprefix("SWE_AB command: ")
        for line in log.splitlines()
        if line.startswith("SWE_AB command:")
    )
    for flag in [
        "--tensor-parallel-size 2",
        "--enable-expert-parallel",
        "--max-model-len 262144",
        "--max-num-seqs 16",
        "--max-num-batched-tokens 8192",
        "--no-enable-prefix-caching",
        "--no-async-scheduling",
        "FULL_DECODE_ONLY",
    ]:
        assert flag in command
    events = [
        line.split("LEGACY017_EVIDENCE ", 1)[1]
        for line in log.splitlines()
        if "LEGACY017_EVIDENCE " in line
    ]
    installed = sum(line.startswith("installed ") for line in events)
    effective = [
        json.loads(line.split(" ", 1)[1])
        for line in events
        if line.startswith("runtime_effective ")
    ]
    assert bool(installed) == bool(effective) == on
    counters = {}
    for when in ["before", "after"]:
        text = (root / f"{name}.{when}.prom").read_text(encoding="utf-8")
        lines = re.findall(r"^vllm:num_preemptions_total\{[^\n]+", text, re.MULTILINE)
        assert len(lines) == 1
        counters[when] = float(lines[0].rsplit(" ", 1)[1])
    counters["delta"] = counters["after"] - counters["before"]
    counters["scope"] = (
        "Before/after client invocation, including drain; not a strict 900s counter"
    )
    counters["status"] = (
        "unverified-zero-snapshot" if name == "off-m65-c16-r2" else "recorded"
    )
    paths = (
        list(run.glob("*.json"))
        + [run / "requests.jsonl"]
        + sorted(root.glob(f"{name}.*"))
    )
    artifacts = [
        {
            "path": p.relative_to(source).as_posix(),
            "sha256": digest(p),
            "bytes": p.stat().st_size,
        }
        for p in paths
    ]
    versions_path = root / f"{name}.versions.txt"
    versions = None
    if versions_path.exists():
        versions = dict(
            re.findall(
                r"Name: ([^\n]+)\nVersion: ([^\n]+)",
                versions_path.read_text(encoding="utf-8"),
            )
        )
        assert versions["vllm"] == "0.23.0+empty"
        assert versions["vllm_ascend"] == "0.23.0.post1"
        assert versions["vllm-hust-utility-victim"] == "0.1.0.dev2"
    hardware_path = root / f"{name}.hardware.txt"
    if hardware_path.exists():
        assert "910B2" in hardware_path.read_text(encoding="utf-8")
    # Original paths/endpoints remain with the measurement owner; public hashes refer to originals.
    public_client = dict(client)
    public_client.pop("endpoint", None)
    public_client["tokenizer"] = {
        k: v for k, v in client["tokenizer"].items() if k != "path"
    }
    point_id = f"utility-victim-{name}-20261002"
    params = {
        "tensor_parallel_size": 2,
        "pipeline_parallel_size": 1,
        "data_parallel_size": 1,
        "expert_parallel": True,
        "dtype": "bfloat16",
        "kv_cache_dtype": "auto",
        "block_size": 128,
        "max_model_len": 262144,
        "max_num_seqs": 16,
        "max_num_batched_tokens": 8192,
        "gpu_memory_utilization": 0.65,
        "prefix_caching": False,
        "chunked_prefill": True,
        "async_scheduling": False,
        "mtp_draft_tokens": 0,
        "graph_mode": "FULL_DECODE_ONLY",
        "graph_capture_sizes": [1, 2, 4, 8, 16],
        "thinking": True,
        "generation_temperature": 0,
        "scheduling_policy": "fcfs",
        "checkpoint_revision": None,
        "runtime_base_commits": None,
        "benchmark_revision": None,
        "cann_version": None,
        "launch_command_redacted": command.replace(
            "/models/Qwen3.5-35B-A3B", "<MODEL_PATH>"
        ),
        "utility_victim": {
            "package_version": "0.1.0.dev2",
            "backend": "core-contract-v1",
            "extension_id": "org.vllm-hust.utility-victim",
            "kill_switch": not on,
            "patch_installed_events": installed,
            "runtime_effective_events": len(effective),
            "actual_kv_freed_verified": False,
            "host_requirement": "Local core victim-selector API v1 patch; not an upstream API",
        },
        "provenance_limitations": "No model revision, measured source commits, CANN version or ownership-release receipt retained. Client server_metadata is null. OFF-r1 lacks separate package/hardware snapshots; its engine log records v0.23.0 and TP2, and hardware/backend labels use the other five campaign snapshots.",
    }
    point = {
        "id": point_id,
        "cohort_id": COHORT,
        "label": f"utility-victim {arm.upper()} · C16 · repeat {repeat}",
        "configuration": {
            "engine": "vLLM + vLLM-Ascend",
            "engine_version": "0.23.0+empty / 0.23.0.post1"
            if versions
            else "0.23.0 (server log); Ascend version not separately recorded",
            "mods": ["utility-victim"] if on else [],
            "hardware": {"label": "Ascend 910B2", "accelerator_count": 2},
            "context_capacity_tokens": 262144,
            "parameters": params,
        },
        "load": {
            "concurrency": 16,
            "session_rotation_depth": 1,
            "repeat": repeat,
            "presentation_group": {
                "id": f"utility-victim-{arm}",
                "label_en": f"utility-victim {arm.upper()}",
                "label_zh": f"utility-victim {'开启' if on else '关闭'}",
            },
        },
        "metrics": metrics,
        "evidence": {
            "status": "measured",
            "profile": "smoke",
            "execution_kind": "real-online",
            "measurement_seconds": 900,
            "tuning_complete": False,
            "url": REPORT,
            "run_ids": [client["run_id"]],
            "aggregation": "One complete 900s observation; repeats retained separately, no best-of selection or pooled percentile",
            "sampling_date_utc": datetime.fromtimestamp(
                client["started_at_unix"], timezone.utc
            )
            .date()
            .isoformat(),
            "sampling_date_source": "SWE config.started_at_unix (UTC)",
            "benchmark_protocol": {
                "protocol_id": "swe-prefix-reuse/v1",
                "campaign": COHORT,
                "prepared_workload_sha256": client["workload_sha256"],
                "tokenizer_fingerprint": client["tokenizer"]["fingerprint"],
            },
        },
    }
    evidence = {
        "run_id": client["run_id"],
        "point_id": point_id,
        "summary": summary,
        "client": public_client,
        "metrics": metrics,
        "package_versions": versions,
        "hardware_snapshot_present": hardware_path.exists(),
        "requests_artifact_sha256": digest(run / "requests.jsonl"),
        "source_artifacts": artifacts,
        "plugin_events": events,
        "preemption_counter": counters,
        "validation": {
            "raw_window_tokens_verified": True,
            "raw_request_budgets_verified": True,
            "raw_percentiles_verified": True,
            "prefix_cache_enabled": False,
            "owned_devices_released": None,
            "model_quality_evaluated": False,
        },
    }
    return point, evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        required=True,
        help="utility-victim package root containing results/",
    )
    args = parser.parse_args()
    pairs = [
        import_run(args.source, arm, repeat)
        for repeat in [1, 2, 3]
        for arm in ["off", "on"]
    ]
    clients = [r["client"] for _, r in pairs]
    for key in [
        "workload_sha256",
        "tokenizer",
        "concurrency",
        "duration",
        "chips",
        "seed",
        "server_max_context",
    ]:
        assert all(c[key] == clients[0][key] for c in clients), key
    cohort = {
        "id": COHORT,
        "model": {
            "id": "qwen35-35b-a3b-utility-local-unpinned",
            "label": "Qwen3.5-35B-A3B (local checkpoint)",
            "revision": "unrecorded-local-checkpoint",
        },
        "precision": {"id": "bf16-weights-compute-kv", "label": "BF16"},
        "context_tokens": 262144,
        "workload": {
            "id": "utility-victim-swe-c16-m65-900s-v1",
            "label": "utility-victim OFF/ON · C16 · 3 repeats",
            "contract": {
                "presentation": "fixed-comparison",
                "profile": "smoke",
                "measurement_seconds": 900,
                "repository_url": "https://github.com/vLLM-HUST/swe-prefix-reuse",
                "prepared_workload_sha256": clients[0]["workload_sha256"],
                "tokenizer_fingerprint": clients[0]["tokenizer"]["fingerprint"],
                "session_rotation": {
                    "status": "measured",
                    "policy": "per-lane-round-robin",
                    "depth_field": "load.session_rotation_depth",
                },
                "arrival": "16 closed-loop lanes, depth1; cyclic complete-session replay",
                "output_policy": "Exact source-derived budgets; actual output token continuation; greedy ignore_eos",
                "cache": "Prefix caching disabled; unique salts per session play",
                "warmup": "No separate per-run qualification receipt retained; fresh salts in measurement",
                "aggregation": "Six independent 900s windows; report arithmetic mean throughput per arm, never average coordinates or pool run percentiles",
                "acceptance": "All six summaries valid with zero failed requests; raw budgets, window tokens and axis percentiles cross-checked. Not answer-quality certification.",
                "display_scope": "Fixed C16 OFF/ON repeats, not a concurrency sweep. No invented C1/C2/C4/C8 points or connecting lines.",
                "limitations": "Local model revision and measured source commits unrecorded; separate from the canonical checkpoint cohort. OFF-r2 preemption snapshot is unverified. No strict-window preemption or verified KV-bytes-freed claim.",
                "report_url": REPORT,
            },
        },
    }
    snapshot_path = SITE / "data/leaderboard_frontier.json"
    snapshot = read(snapshot_path)
    snapshot["cohorts"] = [c for c in snapshot["cohorts"] if c["id"] != COHORT] + [
        cohort
    ]
    snapshot["points"] = [p for p in snapshot["points"] if p["cohort_id"] != COHORT] + [
        p for p, _ in pairs
    ]
    public = {
        "protocol": "swe-prefix-reuse/v1",
        "campaign": COHORT,
        "scope": "Public metric/configuration extracts. Original generated-token streams and server logs retained by measurement owner; hashes identify originals.",
        "runs": [r for _, r in pairs],
    }
    for path, value in [
        (snapshot_path, snapshot),
        (SITE / "data/leaderboard_utility_victim_evidence.json", public),
    ]:
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    print("Imported six verified observations; no concurrency series created.")


if __name__ == "__main__":
    main()
