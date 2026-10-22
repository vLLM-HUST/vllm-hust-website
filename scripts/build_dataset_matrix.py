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
    off_id = "native"
    for sid, name in [
        (off_id, "Native vLLM · Ascend"),
        (on_id, "request-throttling-controller"),
    ]:
        if not any(s["id"] == sid for s in solutions):
            solutions.append({"id": sid, "name": name})
    scores = {}
    for key, sid in [("off", off_id), ("on", on_id)]:
        scores[sid] = {
            "value": 0 if key == "off" else ratio - 1,
            "unit": "relative_gain",
            "output_tokens_per_second": statistics.median(
                r[key]["engine_output_tokens_per_second"] for r in primary
            ),
            "repetitions": 3,
            "speedup": 1 if key == "off" else ratio,
        }
    dataset_id = "swe-smith-tranjactory-offline-window"
    datasets.append(
        {
            "id": dataset_id,
            "name": "SWE-smith-tranjactory",
            "evidence_type": "fixed-window-replay",
            "paired_gains": [r["paired_output_rate_ratio"] - 1 for r in primary],
            "parts": [
                {
                    "id": "offline96-180s-apc512m",
                    "name": "离线批量回放",
                    "name_en": "Offline batch replay",
                    "metric": "output_throughput_gain",
                    "scores": scores,
                    "statuses": {},
                }
            ],
        }
    )
    repeat_numbers = {r["seed"]: index + 1 for index, r in enumerate(primary)}
    for record in report["records"]:
        for key, sid in [("off", off_id), ("on", on_id)]:
            point = record[key]
            records.append(
                {
                    "id": f"offline-window-{record['run']}-{key}",
                    "dataset": dataset_id,
                    "solution": sid,
                    "scope": "offline-window",
                    "scope_label": f"重复{repeat_numbers[record['seed']]} · 3分钟"
                    + (" · 顺序复核" if record["order_repeat"] else ""),
                    "quality": [],
                    "performance": point,
                    "configuration": report["runtime_profile"],
                    "report": path,
                    "protocol": report["protocol"]
                    | {
                        "seed": record["seed"],
                        "repeat_index": repeat_numbers[record["seed"]],
                        "comparison_baseline": "Native vLLM through the same transport, scheduling disabled",
                        "order": record["order"],
                        "order_repeat": record["order_repeat"],
                        "finite_makespan_claim": False,
                    },
                    "limitations": report["limitations"],
                }
            )


def append_real_agent_system_window(root, solutions, datasets, records, sources):
    """Project the archived real-Agent system window without a quality gate."""
    path = "data/swe-bench-pro-real-agent-threeway-20261022/report.json"
    if not (root / path).exists():
        return
    raw = (root / path).read_bytes()
    report = json.loads(raw)
    assert report["status"] == "VERIFIED_SYSTEM_WINDOW"
    assert report["quality_gate"] is False
    assert report["complete_batch_makespan_claim"] is False
    config = report["configuration"]
    assert config["arrival_time"] == 0 and config["client_concurrency_limit"] is None
    sources[path] = hashlib.sha256(raw).hexdigest()
    arms = [
        ("native", "native", "Native"),
        ("controller_original", "request-throttling-controller", "Controller original"),
    ]
    scores = {}
    baseline = report["full_window"]["native"]["engine_output_tokens_per_s"]
    for arm, sid, label in arms:
        if not any(s["id"] == sid for s in solutions):
            solutions.append({"id": sid, "name": label})
        point = report["full_window"][arm]
        scores[sid] = {
            "value": point["engine_output_tokens_per_s"],
            "unit": "token/s",
            "repetitions": 1,
            "speedup": point["engine_output_tokens_per_s"] / baseline,
        }
        records.append(
            {
                "id": "swe-pro-real-hour-" + arm,
                "dataset": "swe-bench-pro",
                "solution": sid,
                "scope": "real-agent-hour",
                "scope_label": "128 programs · 3600s · single run",
                "quality": [],
                "performance": point,
                "configuration": report["cohort"] | config,
                "report": path,
                "protocol": {
                    "evidence_type": "real-agent-system-window",
                    "window_seconds": config["agent_wall_seconds"],
                    "quality_gate": False,
                    "complete_batch_makespan_claim": False,
                    "ray_status": report["arm_ray_status"][arm],
                    "client_boundary": report["client_boundary"][arm],
                    "archive": report["archive"],
                    "source_report": "https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/main/"
                    + report["report_path"],
                },
                "limitations": report["limitations"],
            }
        )
    datasets.append(
        {
            "id": "swe-bench-pro",
            "name": "SWE-bench Pro V1",
            "evidence_type": "real-agent-system-window",
            "parts": [
                {
                    "id": "real-agent128-3600s",
                    "name": "真实Agent · 128 programs · 单轮1小时",
                    "name_en": "Real Agent · 128 programs · one hour, one run",
                    "metric": "engine_output_tokens_per_second",
                    "scores": scores,
                    "statuses": {},
                }
            ],
        }
    )


def append_controller_dataset_profiles(root, solutions, datasets, records, sources):
    """Add the MOD to existing dataset rows; preserve each baseline receipt."""
    path = "data/request-throttling-dataset-matrix-20261018/frontierscience.json"
    if not (root / path).exists():
        return
    raw = (root / path).read_bytes()
    report = json.loads(raw)
    assert report["status"] == "DATASET_PAIR_COMPLETE"
    performance = report["performance"]
    assert performance["state"] == "THREE_REPEAT_PERFORMANCE_COMPLETE"
    sources[path] = hashlib.sha256(raw).hexdigest()
    dataset_id = "frontierscience"
    parts = []
    for track, metric in [("olympiad", "success"), ("research", "score7")]:
        scores = {}
        for arm, sid in [
            ("native", "native"),
            ("controller", "request-throttling-controller"),
        ]:
            audit = report["quality_pair"]["arms"][arm]["summary"]["tracks"][track]
            scores[sid] = {
                "label": track.title(),
                "correct": audit["successes"],
                "total": audit["total"],
                "value": audit["successes"] / audit["total"],
                "audit": audit,
            }
        parts.append(
            {
                "id": track,
                "name": track.title(),
                "metric": metric,
                "scores": scores,
                "statuses": {},
            }
        )
    existing = next(d for d in datasets if d["id"] == dataset_id)
    for part in parts:
        target = next(p for p in existing["parts"] if p["id"] == part["id"])
        assert "request-throttling-controller" not in target["scores"]
        target["scores"]["request-throttling-controller"] = part["scores"][
            "request-throttling-controller"
        ]
    # Historical Native stays in the overview. The new matching Native remains
    # a dated detail record so readers can inspect the actual paired baseline.
    for arm, sid in [
        ("native", "native"),
        ("controller", "request-throttling-controller"),
    ]:
        points = [
            r
            for r in performance["records"]
            if r["arm"] == arm and r["repetition"] != "warmup"
        ]
        assert len(points) == 3 and {r["repetition"] for r in points} == {1, 2, 3}
        assert all(r["completed"] == 160 and r["failed"] == 0 for r in points)
        aggregate = performance["aggregate"][arm]
        for key, value in aggregate.items():
            assert statistics.median(r[key] for r in points) == value
        records.append(
            {
                "id": f"frontierscience-controller-20261018-{sid}",
                "dataset": dataset_id,
                "solution": sid,
                "scope": "full-160",
                "measured_at": "2026-10-18",
                "configuration_label": "本轮配对基线"
                if arm == "native"
                else "本轮评测",
                "configuration_label_en": "Matched baseline"
                if arm == "native"
                else "Current evaluation",
                "quality": [p["scores"][sid] for p in parts],
                "performance": dict(
                    aggregate,
                    completed=160,
                    failed=0,
                    num_prompts=160,
                    repetitions=3,
                    aggregation="median of three formal values per metric",
                    formal_runs=points,
                ),
                "configuration": report["configuration"],
                "report": path,
                "protocol": {
                    "quality": "One full task pass; Qwen substitute judge; unresolved retained in full denominator",
                    "performance": "160 fixed prompts; output cap256; natural EOS; temperature0; request seed0; all arrive together; no client cap; one warmup plus three formal runs per arm",
                    "source": "https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/0ca30f4/reports/request-throttling-controller/dataset-matrix-20261018-r2/frontierscience",
                    "quality_budget": report["quality_budget"],
                },
                "limitations": report["limitations"],
            }
        )


def append_controller_gold_profile(root, datasets, records, sources):
    """Use the existing Gold row and text/image detail format."""
    path = "data/request-throttling-dataset-matrix-20261018/hle-gold.json"
    if not (root / path).exists():
        return
    raw = (root / path).read_bytes()
    report = json.loads(raw)
    assert report["status"] == "DATASET_PAIR_COMPLETE"
    assert report["quality_pair"]["pair_input_check"][
        "all_contract_fields_equal_except_solver_base_url"
    ]
    sources[path] = hashlib.sha256(raw).hexdigest()
    dataset = next(d for d in datasets if d["id"] == "hle-verified")
    gold = next(p for p in dataset["parts"] if p["id"] == "gold")
    audit = report["quality_pair"]["arms"]["controller"]["summary"]["tracks"]["gold"]
    assert (
        audit["total"] == 668 and "request-throttling-controller" not in gold["scores"]
    )
    gold["scores"]["request-throttling-controller"] = {
        "label": "Gold",
        "correct": audit["successes"],
        "total": audit["total"],
        "value": audit["accuracy"],
        "audit": audit,
    }
    performance = report["performance"]
    assert performance["state"] == "THREE_REPEAT_PERFORMANCE_COMPLETE"
    for arm, sid in [
        ("native", "native"),
        ("controller", "request-throttling-controller"),
    ]:
        for modality, count in [("text", 200), ("image", 93)]:
            points = [
                r
                for r in performance["records"]
                if r["arm"] == arm
                and r["modality"] == modality
                and r["repetition"] != "warmup"
            ]
            assert len(points) == 3 and {r["repetition"] for r in points} == {1, 2, 3}
            assert all(r["completed"] == count and r["failed"] == 0 for r in points)
            aggregate = performance["aggregate"][modality][arm]
            for key, value in aggregate.items():
                assert statistics.median(r[key] for r in points) == value
            quality = report["quality_pair"]["arms"][arm]["summary"]["groups"][
                f"gold/{modality}"
            ]
            records.append(
                {
                    "id": f"hle-gold-controller-20261018-{sid}-{modality}",
                    "dataset": "hle-verified",
                    "solution": sid,
                    "scope": f"gold-{modality}",
                    "measured_at": "2026-10-18",
                    "configuration_label": "本轮配对基线"
                    if arm == "native"
                    else "本轮评测",
                    "configuration_label_en": "Matched baseline"
                    if arm == "native"
                    else "Current evaluation",
                    "quality": [
                        {
                            "label": f"Gold · {modality}",
                            "correct": quality["successes"],
                            "total": quality["total"],
                            "value": quality["accuracy"],
                            "audit": quality,
                        }
                    ],
                    "performance": dict(
                        aggregate,
                        completed=count,
                        failed=0,
                        num_prompts=count,
                        repetitions=3,
                        aggregation="median of three formal values per metric",
                        formal_runs=points,
                    ),
                    "configuration": report["configuration"],
                    "report": path,
                    "protocol": {
                        "quality": "One complete Gold668 pass; strict JSON Qwen substitute judge; all unresolved retained",
                        "performance": f"Separate {modality} test: {count} prompts; output cap256; natural EOS; temperature0; seed0; rate inf; no client cap; one warmup plus three formal runs per arm",
                        "source": "https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/1d1a287/reports/request-throttling-controller/dataset-matrix-20261018-r2/hle-gold",
                        "quality_budget": report["quality_budget"],
                    },
                    "limitations": report["limitations"],
                }
            )


def append_controller_revision_profile(root, datasets, records, sources):
    """Use the existing Revision row and text/image detail format."""
    path = "data/request-throttling-dataset-matrix-20261018/hle-revision.json"
    if not (root / path).exists():
        return
    raw = (root / path).read_bytes()
    report = json.loads(raw)
    assert report["status"] == "DATASET_PAIR_COMPLETE"
    assert report["quality_pair"]["pair_input_check"][
        "all_contract_fields_equal_except_solver_base_url"
    ]
    sources[path] = hashlib.sha256(raw).hexdigest()
    dataset = next(d for d in datasets if d["id"] == "hle-verified")
    revision = next(p for p in dataset["parts"] if p["id"] == "revision")
    audit = report["quality_pair"]["arms"]["controller"]["summary"]["tracks"][
        "revision"
    ]
    assert (
        audit["total"] == 1143
        and "request-throttling-controller" not in revision["scores"]
    )
    revision["scores"]["request-throttling-controller"] = {
        "label": "Revision",
        "correct": audit["successes"],
        "total": audit["total"],
        "value": audit["accuracy"],
        "audit": audit,
    }
    performance = report["performance"]
    assert performance["state"] == "THREE_REPEAT_PERFORMANCE_COMPLETE"
    for arm, sid in [
        ("native", "native"),
        ("controller", "request-throttling-controller"),
    ]:
        for modality, count in [("text", 200), ("image", 118)]:
            points = [
                r
                for r in performance["records"]
                if r["arm"] == arm
                and r["modality"] == modality
                and r["repetition"] != "warmup"
            ]
            assert len(points) == 3 and {r["repetition"] for r in points} == {1, 2, 3}
            assert all(r["completed"] == count and r["failed"] == 0 for r in points)
            aggregate = performance["aggregate"][modality][arm]
            for key, value in aggregate.items():
                assert statistics.median(r[key] for r in points) == value
            quality = report["quality_pair"]["arms"][arm]["summary"]["groups"][
                f"revision/{modality}"
            ]
            records.append(
                {
                    "id": f"hle-revision-controller-20261018-{sid}-{modality}",
                    "dataset": "hle-verified",
                    "solution": sid,
                    "scope": f"revision-{modality}",
                    "measured_at": "2026-10-18",
                    "configuration_label": "本轮配对基线"
                    if arm == "native"
                    else "本轮评测",
                    "configuration_label_en": "Matched baseline"
                    if arm == "native"
                    else "Current evaluation",
                    "quality": [
                        {
                            "label": f"Revision · {modality}",
                            "correct": quality["successes"],
                            "total": quality["total"],
                            "value": quality["accuracy"],
                            "audit": quality,
                        }
                    ],
                    "performance": dict(
                        aggregate,
                        completed=count,
                        failed=0,
                        num_prompts=count,
                        repetitions=3,
                        aggregation="median of three formal values per metric",
                        formal_runs=points,
                    ),
                    "configuration": report["configuration"],
                    "report": path,
                    "protocol": {
                        "quality": "One complete Revision1143 pass; strict JSON Qwen substitute judge; all unresolved retained",
                        "performance": f"Separate {modality} test: {count} prompts; output cap256; natural EOS; temperature0; seed0; rate inf; no client cap; one warmup plus three formal runs per arm",
                        "source": "https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/36fc645/reports/request-throttling-controller/dataset-matrix-20261018-r3/hle-revision",
                        "quality_budget": report["quality_budget"],
                    },
                    "limitations": report["limitations"],
                }
            )


def append_controller_mmlu_profile(root, datasets, records, sources):
    """Append the dated matched pair to the existing MMLU row and details."""
    path = "data/request-throttling-dataset-matrix-20261018/mmlu-pro.json"
    if not (root / path).exists():
        return
    raw = (root / path).read_bytes()
    report = json.loads(raw)
    assert report["status"] == "DATASET_PAIR_COMPLETE"
    pair = report["quality_pair"]
    assert all(pair["pair_input_check"].values())
    sources[path] = hashlib.sha256(raw).hexdigest()
    dataset = next(d for d in datasets if d["id"] == "mmlu-pro")
    part = next(p for p in dataset["parts"] if p["id"] == "test")
    audit = pair["arms"]["controller"]["summary"]
    assert (
        audit["cases"] == 12032
        and "request-throttling-controller" not in part["scores"]
    )

    def quality(value):
        return {
            "label": "Test",
            "correct": value["correct"],
            "total": value["cases"],
            "value": value["accuracy"],
            "audit": value,
        }

    part["scores"]["request-throttling-controller"] = quality(audit)
    performance = report["performance"]
    assert performance["state"] == "THREE_REPEAT_PERFORMANCE_COMPLETE"
    for arm, sid in [
        ("native", "native"),
        ("controller", "request-throttling-controller"),
    ]:
        points = [
            r
            for r in performance["records"]
            if r["arm"] == arm and r["repetition"] != "warmup"
        ]
        assert len(points) == 3 and {r["repetition"] for r in points} == {1, 2, 3}
        assert all(r["completed"] == 200 and r["failed"] == 0 for r in points)
        aggregate = performance["aggregate"][arm]
        for key, value in aggregate.items():
            assert statistics.median(r[key] for r in points) == value
        records.append(
            {
                "id": f"mmlu-pro-controller-20261018-{sid}",
                "dataset": "mmlu-pro",
                "solution": sid,
                "scope": "test-200",
                "measured_at": "2026-10-18",
                "configuration_label": "本轮配对基线"
                if arm == "native"
                else "本轮评测",
                "configuration_label_en": "Matched baseline"
                if arm == "native"
                else "Current evaluation",
                "quality": [quality(pair["arms"][arm]["summary"])],
                "performance": dict(
                    aggregate,
                    completed=200,
                    failed=0,
                    num_prompts=200,
                    repetitions=3,
                    aggregation="median of three formal values per metric",
                    formal_runs=points,
                ),
                "configuration": report["configuration"],
                "report": path,
                "protocol": {
                    "quality": "One complete12032 pass;5shot/max2048/client16; invalid answers and truncations retained",
                    "performance": "Separate200 prompts; outputcap256/naturalEOS/temp0/seed0/rateinf/no client cap; one warmup plus three formal runs each arm",
                    "source": "https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/4b3f318/reports/request-throttling-controller/dataset-matrix-20261018-r3/mmlu-pro",
                    "quality_retention": pair["quality_retention"],
                    "quality_retention_budget": pair["quality_retention_budget"],
                },
                "limitations": report["boundaries"],
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
    append_controller_dataset_profiles(root, solutions, datasets, records, sources)
    append_controller_gold_profile(root, datasets, records, sources)
    append_controller_mmlu_profile(root, datasets, records, sources)
    append_controller_revision_profile(root, datasets, records, sources)
    append_real_agent_system_window(root, solutions, datasets, records, sources)
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
