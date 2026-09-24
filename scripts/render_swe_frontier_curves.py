#!/usr/bin/env python3
"""Render measured capacity16 concurrency tradeoffs, never the mixed Pareto envelope."""

import json
import math
from html import escape
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
COHORT = "qwen35-35b-a3b-bf16-sweprefix-smoke-v1"


def render(snapshot):
    points = [
        p
        for p in snapshot["points"]
        if p["cohort_id"] == COHORT
        and p["configuration"]["parameters"].get("max_num_seqs") == 16
        and p["load"].get("concurrency_series")
        in ("swe-capacity16-native", "swe-capacity16-full")
        and p["configuration"]["hardware"]["accelerator_count"] == 2
    ]
    if not points:
        raise ValueError("No measured SWE capacity16 observations")
    xmax = math.ceil(max(p["metrics"]["decode_p90_tps"] for p in points) / 20) * 20
    ymax = math.ceil(max(p["metrics"]["output_tps"] / 2 for p in points) / 40) * 40

    def x(value):
        return 90 + value / xmax * 810

    def y(value):
        return 440 - value / ymax * 320

    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" role="img" aria-labelledby="title desc">',
        '<title id="title">Qwen3.5 SWE concurrency speed-throughput tradeoff</title>',
        '<desc id="desc">Only concurrency changes within each capacity16 series. Legacy max-seqs8 points and eight-chip topologies are excluded.</desc>',
        '<rect width="1000" height="580" fill="#fff"/>',
        '<g font-family="system-ui,sans-serif" fill="#172033">',
        '<text x="60" y="40" font-size="23" font-weight="700">Qwen3.5-35B-A3B BF16 · SWE prefix reuse</text>',
        '<text x="60" y="68" font-size="15">TP2 · max-num-seqs 16 · real MTP2 · one 15-minute smoke per point</text>',
    ]
    for i in range(6):
        xv, yv = xmax * i / 5, ymax * i / 5
        svg.extend(
            [
                f'<path d="M{x(xv):.2f} 120V440 M90 {y(yv):.2f}H900" stroke="#e2e8f0" fill="none"/>',
                f'<text x="{x(xv):.2f}" y="464" text-anchor="middle" font-size="13">{xv:g}</text>',
                f'<text x="78" y="{y(yv) + 4:.2f}" text-anchor="end" font-size="13">{yv:g}</text>',
            ]
        )
    for index, (mods, label, color, kv) in enumerate(
        [
            ([], "Native", "#2563eb", 24.25),
            (["betterscale"], "BetterScale", "#16a34a", 20.25),
        ]
    ):
        rows = sorted(
            (p for p in points if p["configuration"]["mods"] == mods),
            key=lambda p: p["load"]["concurrency"],
        )
        if not rows:
            continue
        # Each line holds these serving settings constant; it is not an equal-KV cross-MOD ablation.
        fixed = (
            "tensor_parallel_size",
            "pipeline_parallel_size",
            "data_parallel_size",
            "expert_parallel",
            "max_num_seqs",
            "max_num_batched_tokens",
            "async_scheduling",
            "prefix_caching",
            "mamba_cache_mode",
            "gpu_memory_utilization",
            "host_kv_budget_gib",
            "mtp_draft_tokens",
            "thinking",
            "generation_temperature",
            "task_queue_enable",
            "graph_mode",
            "graph_capture_sizes",
            "max_cudagraph_capture_size",
            "runtime_base_commits",
            "source_capsule",
            "kv_cache_memory_bytes",
            "checkpoint_revision",
            "worker_class",
            "warmup_policy",
            "benchmark_revision",
            "prefix_cache_scope",
        )
        reference = rows[0]["configuration"]["parameters"]
        for p in rows:
            params = p["configuration"]["parameters"]
            assert all(params.get(key) == reference.get(key) for key in fixed), (
                "Mixed serving settings within a concurrency line"
            )
            assert (
                params["tensor_parallel_size"] == 2 and params["mtp_draft_tokens"] == 2
            )
            assert params["kv_cache_memory_bytes"] == int(kv * 1024**3)
        coords = [
            (x(p["metrics"]["decode_p90_tps"]), y(p["metrics"]["output_tps"] / 2))
            for p in rows
        ]
        positions = " ".join(f"{px:.2f},{py:.2f}" for px, py in coords)
        svg.append(
            f'<polyline points="{positions}" fill="none" stroke="{color}" stroke-width="2.5"/>'
        )
        for p, (px, py) in zip(rows, coords):
            description = escape(
                f"{label} C{p['load']['concurrency']}: P90 {p['metrics']['decode_p90_tps']:.2f} tokens/s; {p['metrics']['output_tps'] / 2:.2f} tokens/s/chip"
            )
            svg.append(
                f'<circle data-point="{escape(p["id"])}" cx="{px:.2f}" cy="{py:.2f}" r="5" fill="{color}"><title>{description}</title></circle>'
            )
            svg.append(
                f'<text x="{px + 9:.2f}" y="{py - 10 if index == 0 else py + 20:.2f}" fill="{color}" font-size="14">C{p["load"]["concurrency"]}</text>'
            )
        svg.append(
            f'<text x="{90 + index * 330}" y="99" fill="{color}" font-size="15">{label} · KV {kv:g} GiB/chip</text>'
        )
    svg.extend(
        [
            '<text x="495" y="496" text-anchor="middle" font-size="16">P90 request decode speed · output tokens/s</text>',
            '<text transform="translate(25 280) rotate(-90)" text-anchor="middle" font-size="16">Output tokens/s/chip</text>',
            '<text x="60" y="532" font-size="13">Lines connect measured C levels, not a fitted curve or the combined Pareto frontier. Missing points are pending.</text>',
            '<text x="60" y="554" font-size="13">Finite-window request mixes differ. Separate series have different tuned KV budgets; no equal-KV speedup claim.</text>',
            "</g></svg>",
        ]
    )
    return "\n".join(svg) + "\n"


if __name__ == "__main__":
    snapshot = json.loads((SITE / "data/leaderboard_frontier.json").read_text())
    (SITE / "assets/frontier-qwen35-swe-concurrency.svg").write_text(render(snapshot))
