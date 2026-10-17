"""Build the additive dataset matrix from public, locally archived reports.

Optionally import BetterScale's published report byte-for-byte from a benchmark
checkout. No private archives, prompts or model answers are consumed.
"""

import argparse
import hashlib
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BS = "betterscale-dataset-validation-20261015"
CURRENT = "betterscale-school-runtime-20261016"
COMMIT = "2d90b460cf92645214bd6bc325bff0562c395ba6"  # pragma: allowlist secret


def append_trajectory(root, solutions, datasets, records, sources):
    """Optional complete finite-program receipts, distinct from task accuracy."""
    path = "data/swe-smith-qwen35-tp2/report.json"
    if not (root / path).exists():
        return
    raw = (root / path).read_bytes()
    report = json.loads(raw)
    expected = {
        "model": "Qwen3.5-35B-A3B",
        "precision": "BF16",
        "hardware": "Ascend 910B2",
        "parallel": "TP2",
    }
    if (
        report["status"] != "PASS"
        or report["cohort"] != expected
        or report["quality"] is not None
    ):
        raise ValueError(
            "Trajectory report must be a verified current-cohort performance result"
        )
    sources[path] = hashlib.sha256(raw).hexdigest()
    solution = "request-throttling-controller"
    solutions.append({"id": solution, "name": solution})
    dataset = {
        "id": "swe-smith-tranjactory",
        "name": "SWE-smith-tranjactory",
        "evidence_type": "replay",
        "parts": [],
    }
    for aggregate in report["aggregate"]:
        concurrency = aggregate["concurrency"]
        selected = [r for r in report["records"] if r["concurrency"] == concurrency]
        scores = {}
        for strategy, sid in (("vllm", "native"), ("Our-Controller", solution)):
            points = [r for r in selected if r["strategy"] == strategy]
            if len(points) != aggregate["repetitions"] or not points:
                raise ValueError("Missing paired trajectory repetitions")
            scores[sid] = {
                "value": statistics.median(r["programs_per_minute"] for r in points),
                "unit": "programs/min",
                "repetitions": len(points),
                "speedup": 1
                if sid == "native"
                else aggregate["median_completion_rate_ratio"],
            }
        dataset["parts"].append(
            {
                "id": f"concurrency-{concurrency}",
                "name": f"Concurrency {concurrency}",
                "metric": "programs_per_minute",
                "scores": scores,
                "statuses": {},
            }
        )
        for record in selected:
            sid = "native" if record["strategy"] == "vllm" else solution
            pair = next(
                p
                for p in report["paired_comparisons"]
                if p["concurrency"] == concurrency and p["seed"] == record["seed"]
            )
            records.append(
                {
                    "id": f"swe-smith-{sid}-c{concurrency}-seed{record['seed']}",
                    "dataset": dataset["id"],
                    "solution": sid,
                    "scope": f"c{concurrency}-seed{record['seed']}",
                    "scope_label": f"{record['programs']} programs · C={concurrency} · seed={record['seed']}",
                    "quality": [],
                    "performance": record
                    | {
                        "completion_rate_ratio": 1
                        if sid == "native"
                        else pair["completion_rate_ratio"]
                    },
                    "configuration": report["cohort"]
                    | {"packages": report["packages"], "backend_count": 1},
                    "report": path,
                    "protocol": {
                        "evidence_type": "replay",
                        "plan_sha256": report["plan_sha256"],
                    },
                    "limitations": report["limitations"],
                }
            )
    datasets.append(dataset)


def append_offline_window(root, solutions, datasets, records, sources):
    path = "data/request-throttling-offline-window-20261017/report.json"
    if not (root / path).exists():
        return
    raw = (root / path).read_bytes()
    report = json.loads(raw)
    assert report["status"] == "VERIFIED_WINDOW_PAIRS"
    assert report["finite_makespan_claim"] is False and report["quality"] is None
    assert report["protocol"]["arrival_mode"] == "offline-burst"
    assert report["protocol"]["client_concurrency_limit"] is None
    primary = [r for r in report["records"] if not r["order_repeat"]]
    assert len(primary) == 3 and len({r["seed"] for r in primary}) == 3
    ratio = statistics.median(
        r["on"]["engine_output_tokens_per_second"]
        / r["off"]["engine_output_tokens_per_second"]
        for r in primary
    )
    assert ratio == report["aggregate"]["median_paired_output_rate_ratio"]
    sources[path] = hashlib.sha256(raw).hexdigest()
    on_id = "request-throttling-controller"
    off_id = "request-throttling-off"
    for sid, name in [
        (off_id, "Controller · 调度关闭"),
        (on_id, "request-throttling-controller"),
    ]:
        if not any(s["id"] == sid for s in solutions):
            solutions.append({"id": sid, "name": name})
    scores = {}
    for key, sid in [("off", off_id), ("on", on_id)]:
        scores[sid] = {
            "value": statistics.median(
                r[key]["engine_output_tokens_per_second"] for r in primary
            ),
            "unit": "tokens/s",
            "repetitions": 3,
            "speedup": 1 if key == "off" else ratio,
        }
    dataset_id = "swe-smith-tranjactory-offline-window"
    datasets.append(
        {
            "id": dataset_id,
            "name": "SWE-smith-tranjactory",
            "evidence_type": "fixed-window-replay",
            "parts": [
                {
                    "id": "offline96-180s-apc512m",
                    "name": "离线96条 · 180秒窗口 · APC · KV512MiB",
                    "metric": "engine_output_tokens_per_second",
                    "scores": scores,
                    "statuses": {},
                }
            ],
        }
    )
    for record in report["records"]:
        for key, sid in [("off", off_id), ("on", on_id)]:
            point = record[key]
            records.append(
                {
                    "id": f"offline-window-{record['run']}-{key}",
                    "dataset": dataset_id,
                    "solution": sid,
                    "scope": "offline-window",
                    "scope_label": f"seed{record['seed']} · 180s"
                    + (" · 顺序复测" if record["order_repeat"] else ""),
                    "quality": [],
                    "performance": point,
                    "configuration": report["runtime_profile"],
                    "report": path,
                    "protocol": report["protocol"]
                    | {
                        "seed": record["seed"],
                        "order": record["order"],
                        "order_repeat": record["order_repeat"],
                        "finite_makespan_claim": False,
                    },
                    "limitations": report["limitations"],
                }
            )


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
    bh = read("data/betterscale-hle-20261015/report.json")
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
                        "native": score(
                            h["summaries"][key]["tracks"][key], key.title()
                        ),
                        "betterscale": score(
                            bh["summaries"][key]["tracks"][key], key.title()
                        ),
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
    for solution, report, path in (
        ("native", h, "data/hle-verified-20261015/report.json"),
        ("betterscale", bh, "data/betterscale-hle-20261015/report.json"),
    ):
        for scope, perf in report["performance"].items():
            subset, modality = scope.split("-")
            add(
                "hle-verified",
                solution,
                scope,
                [
                    score(
                        report["summaries"][subset]["groups"][f"{subset}/{modality}"],
                        f"{subset.title()} · {modality}",
                    )
                ],
                perf,
                report["runtime"],
                path,
                {
                    "generation": report["generation"],
                    "scoring": report["summaries"][subset]["protocol"],
                    "load_test": "Separate text/image tests; output cap 256; request-rate inf; temperature 0; seed 0",
                },
                report["limitations"],
            )
    campaign_path = "data/dataset-matrix-campaign-20261016/report.json"
    campaign = read(campaign_path)
    solutions.extend(campaign["solutions"])
    attempts = [{**a, "report": campaign_path} for a in campaign["attempts"]]
    for d in datasets:
        for part in d["parts"]:
            part["statuses"] = {
                a["solution"]: a for a in attempts if d["id"] in a["datasets"]
            }
    for observation in campaign.get("quality_results", []):
        dataset = next(d for d in datasets if d["id"] == observation["dataset"])
        part = next(p for p in dataset["parts"] if p["id"] == observation["part"])
        solution = observation["solution"]
        assert solution not in part["scores"], "Duplicate quality observation"
        measured = observation["score"]
        assert measured["value"] == measured["correct"] / measured["total"]
        part["scores"][solution] = measured
    records.extend(campaign["results"])
    # The latest accepted run replaces the default BetterScale observations.
    # Original reports remain archived, not displayed as a second solution.
    school_path = f"data/{CURRENT}/report.json"
    school = read(school_path)
    sid = "betterscale"
    records = [record for record in records if record["solution"] != sid]
    accuracy = school["accuracy"]
    for dataset in datasets:
        for part in dataset["parts"]:
            raw = (
                accuracy["mmlu"]
                if dataset["id"] == "mmlu-pro"
                else accuracy["frontier"]["tracks"][part["id"]]
                if dataset["id"] == "frontierscience"
                else accuracy[part["id"]]["tracks"][part["id"]]
            )
            part["scores"][sid] = score(raw, part["name"])
    for dataset, key, scope, protocol in (
        (datasets[0], "mmlu", "test-200", m_protocol),
        (datasets[1], "frontier", "full-160", f_protocol),
    ):
        add(
            dataset["id"],
            sid,
            scope,
            [part["scores"][sid] for part in dataset["parts"]],
            school["performance"][key],
            school["runtime"],
            school_path,
            protocol,
            school["limitations"],
        )
    for scope in ("gold-text", "revision-text", "gold-image", "revision-image"):
        subset, modality = scope.split("-")
        add(
            "hle-verified",
            sid,
            scope,
            [
                score(
                    accuracy[subset]["groups"][f"{subset}/{modality}"],
                    f"{subset.title()} · {modality}",
                )
            ],
            school["performance"][scope],
            school["runtime"],
            school_path,
            {
                "generation": bh["generation"],
                "scoring": accuracy[subset]["protocol"],
                "load_test": "Separate text/image tests; output cap 256; request-rate inf; temperature 0; seed 0",
            },
            school["limitations"],
        )
    append_trajectory(root, solutions, datasets, records, sources)
    append_offline_window(root, solutions, datasets, records, sources)
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
        "attempts": attempts,
        "source_files_sha256": sources,
        "betterscale_publication": {
            "commit": COMMIT,
            "url": f"https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/{COMMIT}/reports/{CURRENT}",
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
        source = args.benchmark / "reports" / CURRENT
        raw = (source / "report.json").read_bytes()
        checksums = {
            line.split()[1]: line.split()[0]
            for line in (source / "SHA256SUMS").read_text().splitlines()
        }
        assert hashlib.sha256(raw).hexdigest() == checksums["report.json"]
        out = ROOT / "data" / CURRENT
        out.mkdir(exist_ok=True)
        (out / "report.json").write_bytes(raw)
    (ROOT / "data/dataset-matrix-v1.json").write_text(
        json.dumps(build(), indent=2, ensure_ascii=False) + "\n"
    )


if __name__ == "__main__":
    main()
