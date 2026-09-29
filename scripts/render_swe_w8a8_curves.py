#!/usr/bin/env python3
"""Render the measured W8A8 SWE prefix-reuse concurrency tradeoff (C1..C16).

与 scripts/render_swe_frontier_curves.py 的区别: 该脚本按 BF16 cohort 渲染并使用
`kv_cache_memory_bytes` 作为恒定量断言。W8A8 曲线是口径修复后的重跑 (series r2):
r1 批次的服务命令只显式给了 gpu_memory_utilization 0.85, kv_cache_memory_bytes 与
max_num_batched_tokens 走引擎默认, 服务端每步只跑 1 个请求, 5 档数值不构成并发曲线结论。
因此本脚本独立渲染 W8A8 cohort, 并把修复后的 3 个 flag 与量化/权重身份、MTP 档位、
startx 命令一起作为"同一曲线内服务设置逐项一致"的断言 (CALIBER + FIXED)。
"""

import json
import math
from html import escape
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
COHORT = "qwen35-35b-a3b-w8a8-sweprefix-smoke-v1"
SERIES = "swe-w8a8-tp2-20260929-mtp2-r2"
MTP_MOD = "ascend-mtp-contract-2patch"
# 口径修复后的 W8A8 服务恒定量: r1 批次的服务命令显式给了 gpu-memory-utilization 0.85,
# 但未显式指定 kv-cache-memory-bytes 与 max-num-batched-tokens (走引擎默认), 实测服务端
# num_requests_running ≡ 1 / num_requests_waiting = C-1; r2 把这三个量固化为同一曲线内的显式常量。
CALIBER = {
    "gpu_memory_utilization": 0.95,
    "kv_cache_memory_bytes": 26038239232,
    "max_num_batched_tokens": 4096,
}

# 同一 concurrency_series 内必须逐项相同的服务/口径设置 (W8A8 cohort 的实际键)
FIXED = (
    "tensor_parallel_size",
    "pipeline_parallel_size",
    "data_parallel_size",
    "expert_parallel",
    "max_num_seqs",
    "quantization",
    "weight_precision",
    "activation_precision",
    "kv_cache_dtype",
    "max_model_len",
    "prefix_caching",
    "enable_chunked_prefill",
    "mamba_cache_mode",
    "gpu_memory_utilization",
    "cudagraph_mode",
    "max_cudagraph_capture_size",
    "graph_note",
    "mtp_draft_tokens",
    "thinking",
    "generation_temperature",
    "runtime_base_commits",
    "runtime_versions",
    "mods",
    "mod_activation",
    "weight_artifacts",
    "weight_revision_note",
    "base_checkpoint_revision",
    "benchmark_repository",
    "benchmark_revision",
    "warmup_policy",
    "prefix_cache_scope",
    "execution_host",
    "physical_devices",
    "transport",
    "kv_cache_memory_bytes",
    "max_num_batched_tokens",
    "caliber_note",
    "server_command",
)


def render(snapshot):
    points = [
        p
        for p in snapshot["points"]
        if p["cohort_id"] == COHORT
        and p["configuration"]["parameters"].get("max_num_seqs") == 16
        and p["load"].get("concurrency_series") == SERIES
        and p["configuration"]["hardware"]["accelerator_count"] == 2
    ]
    if not points:
        raise ValueError("No measured W8A8 SWE concurrency observations")
    xmax = math.ceil(max(p["metrics"]["decode_p90_tps"] for p in points) / 20) * 20
    ymax = math.ceil(max(p["metrics"]["output_tps"] / 2 for p in points) / 40) * 40

    def x(value):
        return 90 + value / xmax * 810

    def y(value):
        return 440 - value / ymax * 320

    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" role="img" aria-labelledby="title desc">',
        '<title id="title">Qwen3.5-35B-A3B W8A8 SWE concurrency speed-throughput tradeoff</title>',
        '<desc id="desc">Only client concurrency changes within the W8A8 real-MTP2 series. Every point is one 900s closed-loop smoke observation on two Ascend 910B3 chips at max-num-seqs 16.</desc>',
        '<rect width="1000" height="580" fill="#fff"/>',
        '<g font-family="system-ui,sans-serif" fill="#172033">',
        '<text x="60" y="40" font-size="23" font-weight="700">Qwen3.5-35B-A3B W8A8 · SWE prefix reuse</text>',
        '<text x="60" y="68" font-size="15">TP2 · max-num-seqs 16 · real MTP2 · int8 W/A · bf16 KV · one 15-minute smoke per point</text>',
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
    for index, (mods, label, color) in enumerate(
        [
            ([MTP_MOD], "W8A8 + real MTP2", "#7c3aed"),
            ([], "W8A8 native", "#2563eb"),
        ]
    ):
        rows = sorted(
            (p for p in points if p["configuration"]["mods"] == mods),
            key=lambda p: p["load"]["concurrency"],
        )
        if not rows:
            continue
        # 同一 series 内只有客户端 C 变化; 其余服务设置必须逐项一致。
        reference = rows[0]["configuration"]["parameters"]
        for p in rows:
            params = p["configuration"]["parameters"]
            assert all(params.get(key) == reference.get(key) for key in FIXED), (
                "Mixed serving settings within a W8A8 concurrency line"
            )
            assert (
                params["tensor_parallel_size"] == 2 and params["mtp_draft_tokens"] == 2
            )
            assert params["max_num_seqs"] == 16
            for key, expected in CALIBER.items():
                assert params[key] == expected, (key, params[key], expected)
            assert params["quantization"] == "ascend"
            assert params["mods"] == mods
            assert p["configuration"]["hardware"]["accelerator_count"] == 2
            assert p["load"]["session_rotation_depth"] == 1
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
                f'<text x="{px + 9:.2f}" y="{py - 12:.2f}" fill="{color}" font-size="14">C{p["load"]["concurrency"]}</text>'
            )
        svg.append(
            f'<text x="{90 + index * 330}" y="99" fill="{color}" font-size="15">{label} · int8 W/A · bf16 KV</text>'
        )
    svg.extend(
        [
            '<text x="495" y="496" text-anchor="middle" font-size="16">P90 request decode speed · output tokens/s</text>',
            '<text transform="translate(25 280) rotate(-90)" text-anchor="middle" font-size="16">Output tokens/s/chip</text>',
            '<text x="60" y="532" font-size="13">Lines connect measured client C levels, not a fitted curve or the combined Pareto frontier. Missing points are pending.</text>',
            '<text x="60" y="554" font-size="13">One server instance per line; max-num-seqs 16 equals the C16 offered load, so C16 is the saturation seat count, not beyond-capacity. This series is the r2 re-run with explicit gpu-memory-utilization / kv-cache-memory-bytes / max-num-batched-tokens; W8A8 vs BF16 differs in precision, so no cross-precision speedup claim.</text>',
            "</g></svg>",
        ]
    )
    return "\n".join(svg) + "\n"


if __name__ == "__main__":
    snapshot = json.loads((SITE / "data/leaderboard_frontier.json").read_text())
    (SITE / "assets/frontier-qwen35-w8a8-swe-concurrency.svg").write_text(
        render(snapshot)
    )
