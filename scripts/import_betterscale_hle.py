"""Export payload-free HLE aggregates from the completed BetterScale capsule."""

import argparse
import hashlib
import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data/betterscale-hle-20261015/report.json"


def export(archive):
    bindings = {}
    with tarfile.open(archive) as capsule:

        def read(name):
            raw = capsule.extractfile(name).read()
            bindings[name] = hashlib.sha256(raw).hexdigest()
            return json.loads(raw)

        summaries = {
            subset: read(f"runs/{subset}/full/report/summary.json")
            for subset in ("gold", "revision")
        }
        performance = {}
        for scope in ("gold-text", "revision-text", "gold-image", "revision-image"):
            raw = read(f"bench/{scope}/outputs/{scope}.json")
            accounting = read(f"bench/{scope}/token-accounting.json")
            assert accounting["exact_match"]
            assert accounting["server_tokenize_counts"] == raw["input_lens"]
            assert raw["completed"] == raw["num_prompts"] and raw["failed"] == 0
            performance[scope] = {
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
            performance[scope]["input_token_accounting_verified"] = True
        deployment = read("service/deployment.json")
        manifests = {s: read(f"runs/{s}/MANIFEST.json") for s in summaries}
        for s, summary in summaries.items():
            stats = summary["tracks"][s]
            assert stats["solver_failures"] == stats["judge_transport_failures"] == 0
            assert stats["accuracy"] == stats["successes"] / stats["total"]
        return {
            "schema": 1,
            "date": "2026-10-15",
            "summaries": summaries,
            "performance": performance,
            "runtime": {
                "source_commit": deployment["source_commit"],
                "model": "Qwen3.5-35B-A3B",
                "dtype": "BF16",
                "hardware": "2 x Ascend 910B2",
                "vllm": "0.25.1",
                "cann": "9.1",
                "engine": deployment["engine"],
                "max_model_len": 65536,
                "max_num_seqs": 16,
                "max_num_batched_tokens": 4096,
                "state_bytes_per_rank": deployment["state_bytes_per_rank"],
                "prefix_caching": True,
                "async_scheduling": True,
                "image_limit": 4,
                "host_memory_bytes": 68719476736,
                "cpu_quota_cores": 8,
            },
            "generation": {
                "solver_concurrency": 16,
                "judge_concurrency": 16,
                "solver_max_tokens": 16384,
                "judge_max_tokens": 8192,
                "temperature": 0,
                "seed": 17,
                "enable_thinking": False,
                "scoring_policy": "strict_json",
                "retries": 0,
                "dataset_revision": "b705e0fb541c025a1532ce0d60d70ae2f53b00e0",  # pragma: allowlist secret
            },
            "limitations": [
                "Single trial; same-model Qwen judge, not official leaderboard replication or formal acceptance.",
                "Gold/Revision unresolved judges: 20/27, all length-ended. Retained in denominator as nonsuccess, not confirmed incorrect; no retries.",
                "Client prompts/schema match the website protocol; engine versions, MTP, graph mode, hardware allocation and cache settings differ. Not an isolated optimization ablation.",
                "HLE uses BetterScale main 33ccc94; MMLU-Pro/FrontierScience use the earlier 31fe12b deployment.",
                "Text load tests select 200 tasks by floor(i*N/200); image tests include all 93/118 tasks. Output cap 256, EOS allowed, request-rate inf, temperature 0, seed 0, thinking disabled, no system prompt.",
                "Service reused after smoke and accuracy, not cold cache. Zero warmups; vLLM initial test request outside measured N. TTFT includes burst queueing.",
                "Recovered published HLE pipeline/prompts/bench client, with reused frozen hash/seal helpers; not the original full client checkout. Raw prompts, images and responses remain private.",
            ],
            "evidence": {
                "source_files_sha256": bindings,
                "sealed_evidence_bundles": {
                    s: m["evidence_bundle_sha256"] for s, m in manifests.items()
                },
                "note": "Aggregate projection; SHA-256 integrity bindings are not signatures. Independent regrading requires private raw responses.",
            },
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    report = export(args.archive)
    DEST.parent.mkdir(exist_ok=True)
    DEST.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
