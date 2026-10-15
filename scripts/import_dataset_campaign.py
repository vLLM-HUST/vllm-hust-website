"""Project completed campaign MMLU receipts without publishing task payloads."""

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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    import_mmlu(parser.parse_args().archive)
