"""Project completed campaign receipts without publishing task payloads."""

import argparse
import hashlib
import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = "data/dataset-matrix-campaign-20261016/report.json"


def import_mmlu(archive):
    destination = ROOT / REPORT
    report = json.loads(destination.read_text())
    with tarfile.open(archive) as capsule:
        for solution, name in (
            ("core-attention-boundary", "Core Attention Boundary"),
            ("ascend-attention-boundary", "Ascend Attention Boundary"),
        ):
            bindings = {}

            def read(relative, raw=False):
                path = f"runs/{solution}/{relative}"
                data = capsule.extractfile(path).read()
                bindings[relative] = hashlib.sha256(data).hexdigest()
                return data if raw else json.loads(data)

            read("mmlu/completed.json")
            assert read("finished.json")["server_exit"] == 0
            config = read("configuration.json")
            log = read("server.log", raw=True)
            assert b"runtime_effective" in log
            summary = read("mmlu/full/summary.json")
            assert summary["cases"] == 12032 and not summary["smoke_only"]
            raw = read("mmlu/bench/outputs/mmlu-pro.json")
            assert raw["num_prompts"] == raw["completed"] + raw["failed"] == 200
            quality = {
                "label": "Test",
                "correct": summary["correct"],
                "total": summary["cases"],
                "value": summary["correct"] / summary["cases"],
                "audit": summary,
            }
            performance = {
                k: raw[k]
                for k in (
                    "num_prompts",
                    "completed",
                    "failed",
                    "duration",
                    "request_throughput",
                    "output_throughput",
                    "total_token_throughput",
                    "mean_ttft_ms",
                    "mean_tpot_ms",
                    "total_input_tokens",
                    "total_output_tokens",
                )
            }
            row = {
                "id": f"mmlu-pro-{solution}-test-200",
                "dataset": "mmlu-pro",
                "solution": solution,
                "scope": "test-200",
                "quality": [quality],
                "performance": performance,
                "configuration": {
                    "source_commit": config["source_commit"],
                    "model": "Qwen3.5-35B-A3B",
                    "dtype": "BF16",
                    "hardware": "2 x Ascend 910B2",
                    "tensor_parallel_size": 2,
                    "expert_parallel": True,
                    "mtp": 0,
                    "prefix_caching": False,
                    "graph_mode": "FULL_DECODE_ONLY",
                    "max_model_len": 65536,
                    "max_num_seqs": 16,
                    "max_num_batched_tokens": 8192,
                    "gpu_memory_utilization": 0.85,
                    "block_size": 128,
                    "vllm": "0.23.0+empty",
                    "vllm_ascend": "0.23.0.post1",
                    "vllm_commit": "0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665",  # pragma: allowlist secret
                    "ascend_commit": "1cdb8c4db6e50f36f1fb3283b3e3dd618f6821e8",  # pragma: allowlist secret
                    "cann": "9.1",
                    "activation": "installed and runtime_effective observed",
                    "co_location": "Two TP2 services shared one four-card host; runs overlapped. Independent chip sets, shared CPU/memory resources.",
                },
                "report": REPORT,
                "protocol": {
                    "accuracy": {
                        "shots": 5,
                        "input": "token IDs via completions",
                        "concurrency": 16,
                        "max_tokens": 2048,
                        "thinking": False,
                        "temperature": 0,
                        "seed": 17,
                        "retries": 0,
                    },
                    "load_test": "Original 200 frozen prompts; output cap 256; request-rate inf; temperature 0; seed 0; default server chat template; separate from accuracy timing",
                },
                "limitations": [
                    "Single run; different runtime, MTP and cache configuration from BetterScale. Not an isolated optimization comparison or SLO-qualified goodput.",
                    "Core uses measured public source; Ascend uses current public head because the historical curve commit was unavailable. Exact revisions retained.",
                    "No candidate repair, rerun or regrading. Invalid and length-limited answers remain in the original denominator.",
                    "Total-input accounting is the original benchmark client's value; per-request server tokenization verification was not captured for these runs.",
                ],
                "evidence": {"source_files_sha256": bindings},
            }
            assert not any(r["id"] == row["id"] for r in report["results"])
            if not any(s["id"] == solution for s in report["solutions"]):
                report["solutions"].append({"id": solution, "name": name})
            report.setdefault("quality_results", []).append(
                {
                    "dataset": "mmlu-pro",
                    "part": "test",
                    "solution": solution,
                    "score": quality,
                }
            )
            report["results"].append(row)
    destination.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")


def import_frontier(archive):
    destination = ROOT / REPORT
    report = json.loads(destination.read_text())
    solution = "core-attention-boundary"
    bindings = {}
    with tarfile.open(archive) as capsule:

        def read(relative, raw=False):
            data = capsule.extractfile(f"runs/{solution}-frontier/{relative}").read()
            bindings[relative] = hashlib.sha256(data).hexdigest()
            return data if raw else json.loads(data)

        read("frontier/completed.json")
        assert read("finished.json")["server_exit"] == 0
        config = read("configuration.json")
        assert b"runtime_effective" in read("server.log", raw=True)
        summary = read("frontier/report/summary.json")
        perf = read("frontier/bench/outputs/frontierscience.summary.json")
        assert perf["num_prompts"] == perf["completed"] + perf["failed"] == 160
        quality = []
        for track, total in [("olympiad", 100), ("research", 60)]:
            raw = summary["tracks"][track]
            assert raw["total"] == total
            score = {
                "label": track.title(),
                "correct": raw["successes"],
                "total": total,
                "value": raw["successes"] / total,
                "audit": raw,
            }
            quality.append(score)
            report.setdefault("quality_results", []).append(
                {
                    "dataset": "frontierscience",
                    "part": track,
                    "solution": solution,
                    "score": score,
                }
            )
        reference = next(
            r for r in report["results"] if r["id"] == f"mmlu-pro-{solution}-test-200"
        )
        runtime = {
            **reference["configuration"],
            "source_commit": config["source_commit"],
            "vllm_ascend": "0.23.0",
            "ascend_commit": "5cb98caaadeff42b5b62b996e34bb2aaa29d20fd",  # pragma: allowlist secret
            "co_location": "Frontier TP2 shared a host with HLE TP2 on independent same-NUMA pairs; CPU/memory resources shared.",
        }
        row = {
            "id": f"frontierscience-{solution}-full-160",
            "dataset": "frontierscience",
            "solution": solution,
            "scope": "full-160",
            "quality": quality,
            "performance": perf,
            "configuration": runtime,
            "report": REPORT,
            "protocol": {
                "generation": {
                    "solver_concurrency": 1,
                    "judge_concurrency": 1,
                    "solver_max_tokens": 16384,
                    "judge_max_tokens": 8192,
                    "temperature": 0,
                    "seed": 17,
                    "enable_thinking": False,
                    "retries": 0,
                },
                "scoring": summary["protocol"],
                "load_test": "Combined 160 prompts; output cap 256; request-rate inf; temperature 0; seed 0; separate from solver/judge timing",
            },
            "limitations": [
                "Single run, same-model Qwen judge; not official replication or SLO-qualified goodput.",
                "Two unresolved judges per track retained as nonsuccess in the full denominator; not confirmed incorrect answers. No repair, regrading or retry.",
                "Frontier runtime is Ascend 0.23.0, unlike this solution's MMLU 0.23.0.post1 host. BetterScale also differs in runtime, MTP and cache configuration; not an isolated mechanism comparison.",
                "Native load-test token accounting; per-request server tokenization verification not captured. HLE judging was running on the other TP2 pair.",
            ],
            "evidence": {"source_files_sha256": bindings, "summary": summary},
        }
        assert not any(r["id"] == row["id"] for r in report["results"])
        report["results"].append(row)
    destination.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--task", choices=["mmlu", "frontier"], default="mmlu")
    args = parser.parse_args()
    {"mmlu": import_mmlu, "frontier": import_frontier}[args.task](args.archive)
