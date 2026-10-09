#!/usr/bin/env python3
"""Add the qualified DSV4 capsule without replacing other published campaigns."""

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COHORT = "dsv4-flash-int8-sweprefix-smoke-v1"
REV = "76709dba52af7e81ac8f0280ae7e007ed50b2bd5"  # pragma: allowlist secret
URL = (
    "https://github.com/vLLM-HUST/vllm-hust-website/blob/main/docs/FRONTIER-DSV4-SWE.md"
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capsule", type=Path)
    args = parser.parse_args()
    root = args.capsule
    snapshot = ROOT / "data/leaderboard_frontier.json"
    data = json.loads(snapshot.read_text())
    assert not any(c["id"] == COHORT for c in data["cohorts"]), "Already imported"
    workload = json.loads((root / "workload.json").read_text())
    accepted = json.loads((root / "accepted-results.json").read_text())
    contract = {
        "profile": "smoke",
        "measurement_seconds": 900,
        "repository_url": "https://github.com/vLLM-HUST/swe-prefix-reuse",
        "source_pool": {
            "dataset": workload["source"]["dataset"],
            "revision": workload["source"]["revision"],
            "sessions": 8,
            "assistant_turns": 360,
            "bundle_sha256": workload["source_sha256"],
        },
        "prepared_workload_sha256": hashlib.sha256(
            (root / "workload.json").read_bytes()
        ).hexdigest(),
        "tokenizer_fingerprint": workload["tokenizer"]["fingerprint"],
        "encoder_revision": workload["tokenizer"]["encoder_revision"],
        "chat_template": "Official DSV4 Python encoder, thinking on, keep reasoning; independent fixed input deltas/output budgets; no Jinja template",
        "history": "Append actual generated IDs then next source delta; no history rerendering or generated-text retokenization",
        "output_policy": "Exact source-derived per-turn output budgets; greedy ignore_eos, native DSpark K5 natural rejection, no forced acceptance",
        "arrival": "Closed-loop C sequential lanes; whole-session replacement; no original tool/human delays",
        "cache": "Fresh unique salt per session play; same salt within play; same byte-preserving relay in every arm, sticky native DP header = lane modulo DP",
        "warmup": "Separate cold/warm cache check plus 60s protocol qualification; measured sessions use fresh salts",
        "aggregation": "One 900s observation per point; count only outputs received inside window; drain in-flight work without post-window token credit",
        "x_axis": "P90 in-window-complete request (N-1)/(last-first token time); grouped SSE arrival timestamps",
        "y_axis": "In-window output tokens / 900 seconds / 8 allocated chips",
        "acceptance": "Exact prompt-ID echo, output count/usage/length/DONE, zero request errors, positive APC and DSpark counters, clean exit and owned release. Not SWE answer accuracy or numerical equivalence.",
        "context_scope": "262144 configured; not a full-256K qualification. Observed maximum prompts remain per-point.",
        "limitations": "Single-run finite-window trajectories differ by speed/concurrency. Fixed 4 TP seats or 2 per DP rank (16 total); not tuned peak capacity. C64 omitted after C32 saturation review; all 24 completed points retained.",
        "session_rotation": {
            "policy": "per-lane-round-robin",
            "depth_field": "load.session_rotation_depth",
            "status": "measured",
            "semantics": "Depth1 only; each lane advances one session consecutively before replacement",
        },
        "concurrency_curves_url": "./assets/frontier-dsv4-swe-concurrency.svg?v=dsv4-int8-20260927",
    }
    data["cohorts"].append(
        {
            "id": COHORT,
            "model": {
                "id": "deepseek-v4-flash-0731-w8a8",
                "label": "DeepSeek V4 Flash",
                "revision": "DeepSeek-V4-Flash-0731-w8a8-local-checkpoint",
            },
            "precision": {
                "id": "int8-w8a8-bf16-activations",
                "label": "INT8",
                "contract": "Ascend W8A8 quantized checkpoint; BF16 activation dtype; not BF16 weights. Weight artifact revision not independently attested.",
            },
            "context_tokens": 262144,
            "workload": {
                "id": "sweprefix-dsv4-eight-traces-900s-v1",
                "label": "SWE prefix reuse · 15 min smoke",
                "contract": contract,
            },
        }
    )
    evidence = []
    for row in accepted["points"]:
        arm, c = row["arm"], row["concurrency"]
        directory = root / "points" / f"{arm}-c{c}"
        receipt = json.loads((directory / "receipt.json").read_text())
        metadata = json.loads((directory / "metadata.json").read_text())
        summary = receipt["measurement"]
        assert (
            receipt["status"] == "PASS"
            and summary["valid"]
            and summary["measurement_seconds"] == 900
            and not summary["failed_requests"]
        )
        assert (
            receipt["released_to_idle"]
            and not receipt["cleanup_errors"]
            and receipt["server_exit_code"] == 0
        )
        assert (
            row["dspark_drafts"] > 0
            and row["draft_tokens"] == row["dspark_drafts"] * 5
            and row["accepted_draft_tokens"] > 0
            and row["prefix_hit_tokens"] > 0
        )
        better = arm.startswith("better")
        ident = f"dsv4-sweprefix-{arm}-c{c}-20260927"
        command = metadata["command"][:]
        command[0] = "python"
        command[command.index("serve") + 1] = "$MODEL"
        parameters = {
            "tensor_parallel_size": metadata["tp"],
            "data_parallel_size": metadata["dp"],
            "expert_parallel_size": 8,
            "pipeline_parallel_size": 1,
            "max_num_seqs": metadata["seats_per_rank"],
            "max_num_seqs_per_rank": metadata["seats_per_rank"],
            "global_seats": metadata["global_seats"],
            "max_num_batched_tokens": metadata["prefill_budget_per_rank"],
            "kv_cache_memory_bytes": metadata["kv_bytes_per_rank"],
            "mtp_draft_tokens": 5,
            "speculative_method": "dspark",
            "sampler": "Native standard rejection; never synthetic acceptance",
            "quantization": "ascend W8A8",
            "dtype": "bfloat16",
            "prefix_caching": True,
            "async_scheduling": True,
            "graph_mode": "FULL" if better else "FULL_DECODE_ONLY",
            "graph_capture_sizes": metadata["graph_capture_sizes"],
            "worker": metadata["worker"],
            "baseline_bridge": "TP only: required K5 LCM startup compatibility; no BetterScale treatment",
            "benchmark_revision": metadata["swe_revision"],
            "runtime_pins": metadata["runtime_pins"]["pins"],
            "server_commands": [command],
            "observed_max_prompt_tokens": summary["max_prompt_tokens_observed"],
            "full_client_concurrency_fraction": summary["full_concurrency_fraction"],
            "comparison_scope": contract["limitations"],
            "source_capsule": root.name,
            "execution_host": "local 910B2 eight-card host; all 24 points matched on one host",
        }
        configuration = {
            "engine": "vLLM + vLLM-Ascend",
            "engine_version": "0.25.1 / 0.25.1rc1",
            "mods": ["betterscale"] if better else [],
            "hardware": {"label": "Ascend 910B2", "accelerator_count": 8},
            "context_capacity_tokens": 262144,
            "parameters": parameters,
        }
        if better:
            configuration["mod_sources"] = [
                {
                    "id": "betterscale",
                    "repository": "https://github.com/vLLM-HUST/BetterScale",
                    "revision": REV,
                    "source_capsule": root.name,
                    "scope": "Frozen v0.5.1 source capsule; not an additional installed-wheel qualification",
                }
            ]
        data["points"].append(
            {
                "id": ident,
                "cohort_id": COHORT,
                "label": f"{arm} / C{c} / DSpark K5",
                "configuration": configuration,
                "load": {
                    "concurrency": c,
                    "session_rotation_depth": 1,
                    "concurrency_series": f"dsv4-fixed-{arm}-20260927",
                },
                "metrics": {
                    "decode_p90_tps": summary["decode_tokens_per_second_p90"],
                    "output_tps": summary["output_tokens_per_second"],
                    "ttft_p95_ms": 1000 * summary["ttft_seconds_p95"],
                },
                "evidence": {
                    "status": "measured",
                    "url": URL,
                    "run_ids": [ident],
                    "sampling_date_utc": "2026-09-27",
                    "sampling_date_source": "Point receipt started_utc, UTC",
                    "aggregation": "Single complete 900s window; no pooling or repeat selection",
                    "benchmark_protocol": {
                        "protocol_id": "swe-prefix-reuse/v1",
                        "client_revision": metadata["swe_revision"],
                        "measurement_seconds": 900,
                    },
                    "metric_extract": "./data/leaderboard_frontier_dsv4_evidence.json",
                },
            }
        )
        evidence.append(
            {
                "run_id": ident,
                "summary": summary,
                "counter_deltas_including_drain": {
                    k: row[k]
                    for k in [
                        "dspark_drafts",
                        "draft_tokens",
                        "accepted_draft_tokens",
                        "prefix_hit_tokens",
                    ]
                },
                "acceptance": {
                    "status": receipt["status"],
                    "server_exit_code": 0,
                    "released_to_idle": True,
                    "cleanup_errors": [],
                },
            }
        )
    assert len(evidence) == 24
    snapshot.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "data/leaderboard_frontier_dsv4_evidence.json").write_text(
        json.dumps(
            {
                "source_capsule": root.name,
                "scope": "Curated metric-only extract; private raw requests, logs and source capsule are not published",
                "runs": evidence,
                "omitted": accepted["omitted"],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )


if __name__ == "__main__":
    main()
