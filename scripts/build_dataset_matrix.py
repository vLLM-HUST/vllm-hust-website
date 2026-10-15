"""Build the additive dataset matrix from public, locally archived reports.

Optionally import BetterScale's published report byte-for-byte from a benchmark
checkout. No private archives, prompts or model answers are consumed.
"""

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BS = "betterscale-dataset-validation-20261015"
COMMIT = "5714be9e9b032f9aaef13df229aaa96dc8ef7c3b"  # pragma: allowlist secret


def build(root=ROOT):
    sources = {}

    def read(path):
        raw = (root / path).read_bytes()
        sources[path] = hashlib.sha256(raw).hexdigest()
        return json.loads(raw)

    m = read("data/mmlu-pro-20261012/report.json")
    mp = read("data/mmlu-pro-20261012/performance.json")
    mr = read("data/mmlu-pro-20261012/runtime.json")
    f = read("data/frontierscience-20261013/report.json")
    h = read("data/hle-verified-20261015/report.json")
    b = read(f"data/{BS}/report.json")
    solutions = [
        {"id": "native", "name": "Native vLLM · Ascend"},
        {"id": "betterscale", "name": "BetterScale"},
    ]

    def score(raw, label):
        total = raw.get("cases", raw.get("total"))
        correct = raw.get("correct", raw.get("successes"))
        assert 0 <= correct <= total and total > 0
        return {
            "label": label,
            "correct": correct,
            "total": total,
            "value": correct / total,
            "audit": raw,
        }

    datasets = [
        {
            "id": "mmlu-pro",
            "name": "MMLU-Pro",
            "parts": [
                {
                    "id": "test",
                    "name": "Test",
                    "metric": "accuracy",
                    "scores": {
                        "native": score(m["accuracy"], "Test"),
                        "betterscale": score(b["mmlu"], "Test"),
                    },
                }
            ],
        },
        {
            "id": "frontierscience",
            "name": "FrontierScience",
            "parts": [
                {
                    "id": key,
                    "name": key.title(),
                    "metric": "success" if key == "olympiad" else "score7",
                    "scores": {
                        "native": score(f["summary"]["tracks"][key], key.title()),
                        "betterscale": score(b["frontier"]["tracks"][key], key.title()),
                    },
                }
                for key in ("olympiad", "research")
            ],
        },
        {
            "id": "hle-verified",
            "name": "HLE-Verified",
            "parts": [
                {
                    "id": key,
                    "name": key.title(),
                    "metric": "accuracy",
                    "scores": {
                        "native": score(h["summaries"][key]["tracks"][key], key.title())
                    },
                }
                for key in ("gold", "revision")
            ],
        },
    ]
    records = []

    def add(dataset, solution, scope, quality, perf, config, path, protocol, limits):
        assert perf["completed"] + perf["failed"] == perf.get(
            "num_prompts", perf.get("n")
        )
        records.append(
            {
                "id": f"{dataset}-{solution}-{scope}",
                "dataset": dataset,
                "solution": solution,
                "scope": scope,
                "quality": quality,
                "performance": perf,
                "configuration": config,
                "report": path,
                "protocol": protocol,
                "limitations": limits,
            }
        )

    m_protocol = {
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
        "load_test": "200 prompts; output cap 256; request-rate inf; temperature 0; seed 0; default server chat template",
    }
    f_protocol = {
        "generation": f["generation"],
        "scoring": f["summary"]["protocol"],
        "load_test": "160 prompts (both tracks together); output cap 256; request-rate inf; temperature 0; seed 0; default server chat template",
    }
    for solution, report, config in [
        ("native", "data/mmlu-pro-20261012/report.json", mr),
        (
            "betterscale",
            f"data/{BS}/report.json",
            {"source_commit": b["betterscale_commit"], **b["engine_configuration"]},
        ),
    ]:
        add(
            "mmlu-pro",
            solution,
            "test-200",
            [datasets[0]["parts"][0]["scores"][solution]],
            mp if solution == "native" else b["mmlu_bench"],
            config,
            report,
            m_protocol,
            ["Single run; legacy extraction; accuracy and load test are separate."]
            if solution == "native"
            else b["limits"],
        )
        add(
            "frontierscience",
            solution,
            "full-160",
            [p["scores"][solution] for p in datasets[1]["parts"]],
            f["performance"] if solution == "native" else b["frontier_bench"],
            f["runtime"] if solution == "native" else config,
            "data/frontierscience-20261013/report.json"
            if solution == "native"
            else report,
            f_protocol,
            f["limitations"] if solution == "native" else b["limits"],
        )
    for scope, perf in h["performance"].items():
        subset, modality = scope.split("-")
        add(
            "hle-verified",
            "native",
            scope,
            [
                score(
                    h["summaries"][subset]["groups"][f"{subset}/{modality}"],
                    f"{subset.title()} · {modality}",
                )
            ],
            perf,
            h["runtime"],
            "data/hle-verified-20261015/report.json",
            {
                "generation": h["generation"],
                "scoring": h["summaries"][subset]["protocol"],
                "load_test": "Separate text/image tests; output cap 256; request-rate inf; temperature 0; seed 0",
            },
            h["limitations"],
        )
    return {
        "schema": 1,
        "cohort": {
            "model": "Qwen3.5-35B-A3B",
            "precision": "BF16",
            "hardware": "Ascend 910B2",
            "parallel": "TP2",
        },
        "solutions": solutions,
        "datasets": datasets,
        "records": records,
        "source_files_sha256": sources,
        "betterscale_publication": {
            "commit": COMMIT,
            "url": f"https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/{COMMIT}/reports/{BS}",
        },
        "formal_acceptance": False,
        "repeats": 1,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--benchmark",
        type=Path,
        help="Import BetterScale public report from this benchmark checkout",
    )
    args = parser.parse_args()
    if args.benchmark:
        source = args.benchmark / "reports" / BS
        raw = (source / "report.json").read_bytes()
        checksums = {
            line.split()[1]: line.split()[0]
            for line in (source / "SHA256SUMS").read_text().splitlines()
        }
        assert hashlib.sha256(raw).hexdigest() == checksums["report.json"]
        out = ROOT / "data" / BS
        out.mkdir(exist_ok=True)
        (out / "report.json").write_bytes(raw)
    (ROOT / "data/dataset-matrix-v1.json").write_text(
        json.dumps(build(), indent=2, ensure_ascii=False) + "\n"
    )


if __name__ == "__main__":
    main()
