"""Import independently auditable 910C native measurements; never alter old cohorts."""

import argparse
import hashlib
import importlib.util
import json
import math
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COHORT = "910c-native-dsv4-flash-w8a8-random8k1k-20261014"
COMMIT = "d2fee2579f34723c3e0bac40a744a9dcc5caceb5"  # pragma: allowlist secret (public source commit)
URL = f"https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/{COMMIT}/reports/deepseek-v4-flash-910c-20261014"


def percentile(values, q):
    values = sorted(values)
    index = (len(values) - 1) * q
    lo = math.floor(index)
    hi = math.ceil(index)
    return values[lo] + (values[hi] - values[lo]) * (index - lo)


def main(source):
    for line in (source / "SHA256SUMS").read_text().splitlines():
        digest, name = line.split("  ", 1)
        assert hashlib.sha256((source / name).read_bytes()).hexdigest() == digest
    spec = importlib.util.spec_from_file_location(
        "native_results", source / "read_result.py"
    )
    reader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reader)
    manifest = json.loads((source / "manifest.json").read_text())
    snapshot = ROOT / "data/leaderboard_frontier.json"
    data = json.loads(snapshot.read_text())
    assert not any(c["id"] == COHORT for c in data["cohorts"]), "Already imported"
    contract = {
        "family": "910C Native vLLM Performance",
        "measurement_note": {
            "label_en": "Random-token engineering measurement · Target graph + eager DSpark draft · 16 logical dies / 8 physical packages · Not business capacity",
            "label_zh": "随机 token 工程测量 · Target graph + DSpark draft eager · 16 逻辑 die / 8 物理封装 · 非业务产能",
        },
        "hardware_unit": "logical-die",
        "repository_url": "https://github.com/vLLM-HUST/vllm-hust-benchmark",
        "measurement_scope": "engineering-measurement",
        "dataset": "Native vLLM random tokens, seed42, fixed8192 input/1024 output, range ratio0",
        "arrival": "Infinite offered rate, bounded client concurrency; requests=max(8,4*C), initial C32-256=max(128,4*C)",
        "warmup": "8 requests excluded per point",
        "cache": "Prefix cache disabled",
        "output_policy": "ignore_eos; exactly1024 output tokens; no quality evaluation",
        "x_axis": "P90 of (output_tokens-1)/sum(per-request ITLs); linear quantile, not inverse P90 TPOT",
        "y_axis": "All completed output tokens / measured duration /16 allocated logical dies (8 physical910C packages)",
        "limitations": "Random-token diagnostic. Target FULL_DECODE_ONLY graph; DSpark K7 eager draft. Not natural-language capacity or an official baseline. Hosts are separate groups; no pooling or causal cross-host claim.",
        "acceptance": "Zero failed requests; exact8192/1024 totals; semantic raw-result hash verified. One observation per point, not repeat confidence intervals.",
    }
    data["cohorts"].append(
        {
            "id": COHORT,
            "model": {
                "id": "deepseek-v4-flash-0731-w8a8",
                "label": "DeepSeek V4 Flash",
                "revision": manifest["model_revision"],
            },
            "precision": {
                "id": "int8-w8a8-bf16-activations",
                "label": "INT8",
                "contract": "W8A8 weights; default BF16 indexer cache",
            },
            "context_tokens": 32768,
            "workload": {
                "id": COHORT,
                "label": "910C · Native vLLM Performance · Random 8K→1K",
                "contract": contract,
            },
        }
    )
    evidence = []
    rows = json.loads((source / "summary.json").read_text())
    assert len(rows) == 11
    for row in rows:
        raw = reader.read_result(source / row["raw_result"])
        assert raw["failed"] == 0 and raw["completed"] == row["requests"]
        assert raw["total_input_tokens"] == 8192 * raw["completed"]
        assert raw["total_output_tokens"] == 1024 * raw["completed"]
        tpots = [
            sum(itls) / (length - 1)
            for itls, length in zip(raw["itls"], raw["output_lens"], strict=True)
        ]
        assert all(t > 0 for t in tpots)
        assert math.isclose(
            statistics.mean(tpots) * 1000, raw["mean_tpot_ms"], abs_tol=0.0001
        )
        p90 = percentile([1 / t for t in tpots], 0.9)
        host, c = row["host"], row["concurrency"]
        ident = f"{COHORT}-host{host}-c{c}"
        parameters = {
            **manifest["deployment"],
            "tensor_parallel_size": 4,
            "data_parallel_size": 4,
            "expert_parallel_size": 16,
            "pipeline_parallel_size": 1,
            "mtp_draft_tokens": 7,
            "graph_mode": "FULL_DECODE_ONLY",
            "max_num_seqs": 64,
            "global_seats": 256,
            "execution_host": f"host{host}",
            "physical_packages": 8,
            "logical_dies": 16,
            "checkpoint_revision": manifest["model_revision"],
            "runtime_pins": manifest["runtime"],
            "comparison_scope": contract["limitations"],
        }
        data["points"].append(
            {
                "id": ident,
                "cohort_id": COHORT,
                "label": f"Native 910C · host{host} · C{c}",
                "configuration": {
                    "engine": "vLLM + vLLM-Ascend",
                    "engine_version": "0.25.1 /0.25.1rc1 A3",
                    "mods": [],
                    "hardware": {
                        "label": "Ascend 910C (logical die)",
                        "accelerator_count": 16,
                    },
                    "context_capacity_tokens": 32768,
                    "parameters": parameters,
                },
                "load": {
                    "concurrency": c,
                    "concurrency_series": f"910c-native-host{host}-20261014",
                    "presentation_group": {
                        "id": f"910c-native-host{host}",
                        "label_en": f"Native vLLM · host{host}",
                        "label_zh": f"Native vLLM · host{host}",
                    },
                },
                "metrics": {
                    "decode_p90_tps": p90,
                    "output_tps": raw["output_throughput"],
                    "tpot_ms": raw["mean_tpot_ms"],
                    "ttft_p95_ms": raw["p95_ttft_ms"],
                    "tpot_p95_ms": raw["p95_tpot_ms"],
                },
                "evidence": {
                    "status": "measured",
                    "url": URL,
                    "run_ids": [row["run_id"]],
                    "sampling_date_utc": "2026-10-14",
                    "sampling_date_source": "Recorded client started_unix timestamp, UTC",
                    "aggregation": "One complete run; host identities preserved; no best-of selection",
                    "metric_extract": "./data/leaderboard_910c_native_evidence.json",
                    "benchmark_protocol": {
                        "protocol_id": COHORT,
                        "measurement_seconds": raw["duration"],
                        "requests": raw["completed"],
                        "warmup_requests": 8,
                        "source_result_index": row["raw_result"],
                    },
                },
            }
        )
        evidence.append(
            {
                "id": ident,
                "summary": row,
                "decode_p90_tps": p90,
                "mean_tpot_reconstructed_ms": statistics.mean(tpots) * 1000,
                "result_identity": json.loads((source / row["raw_result"]).read_text()),
            }
        )
    # Preserve the explicit presentation withdrawal when rebuilding this cohort.
    withdrawn = next(p for p in data["points"] if p["id"] == f"{COHORT}-host06-c1")
    withdrawn["display_withdrawal"] = {
        "reason": "User requested hiding C1 from the presentation curve; measurement remains valid",
        "date": "2026-10-14",
        "policy": "Display-only withdrawal; preserve original metrics and source evidence",
    }
    data["points"].remove(withdrawn)
    data.setdefault("archived_points", []).append(withdrawn)
    snapshot.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "data/leaderboard_910c_native_evidence.json").write_text(
        json.dumps(
            {
                "source_commit": COMMIT,
                "source_url": URL,
                "manifest": manifest,
                "points": evidence,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    main(parser.parse_args().source)
