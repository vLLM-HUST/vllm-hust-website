#!/usr/bin/env python3
"""Render the measured single-chip (TP1) W4A8 (experts int4 + GDN W8A8) SWE
prefix-reuse concurrency tradeoff.

与 scripts/render_swe_w8a8_tp1_curves.py 的区别: 那条是同一 workload 上的 W8A8
权重 (experts 与 attn q/k/v 均为 int8); 本脚本渲染 W4A8 变体 —— 专家层 int4, 且
把 30 层 GDN 的 in_proj_qkv / in_proj_z / out_proj 也量化成 int8 (W8A8)。权重降到
22.38 GiB 后, 单卡 KV 预算按同一条公式重推到 33.49 GiB, 于是 262144 上下文下有
5.46 路等价通道 (W8A8 单卡为 3.07), 前缀复用在 C16 未被冲掉 —— 曲线因此单调上升,
C16 是本 cohort 的峰值, 而不是 W8A8 单卡那样的 C8 见顶后回落。

cohort 唯一性 key 见 assets/leaderboard-frontier-model.js:
[model.id, precision.id, workload.id, context_tokens]。本 cohort 与 W4A8 条目 (GDN
保持 bf16, KV 32.55 GiB) 跑同一份 prepared workload, 但按站点惯例各自持有自己的
workload.id 与 precision.id。

CALIBER 是同一曲线内的服务恒定量; FIXED 是同一 series 内必须逐项一致的其余设置。
"""

import json
import math
from html import escape
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
COHORT = "qwen35-35b-a3b-w4a8-gdnw8a8-tp1-1x910b3-full-decode-only-sweprefix-900s-v1"  # pragma: allowlist secret
SERIES = "swe-w4a8-gdnw8a8-tp1-20261023-mtp2"  # pragma: allowlist secret
MODS = ["ascend-mtp-contract-2patch", "ascend-npugraph-ex-attr-shim"]
# 本曲线的服务恒定量: 单卡 util 0.95 + 为本产物显式设定的 KV pin (33.49 GiB)。
CALIBER = {
    "gpu_memory_utilization": 0.95,
    "kv_cache_memory_bytes": 35956596497,
    "max_num_batched_tokens": 4096,
}

# 同一 concurrency_series 内必须逐项相同的服务/口径设置
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


def output_tps_per_chip(point):
    count = point["configuration"]["hardware"]["accelerator_count"]
    if not isinstance(count, int) or count <= 0:
        raise ValueError("accelerator_count must be a positive integer")
    return point["metrics"]["output_tps"] / count


def render(snapshot):
    points = [
        p
        for p in snapshot["points"]
        if p["cohort_id"] == COHORT
        and p["configuration"]["parameters"].get("max_num_seqs") == 16
        and p["load"].get("concurrency_series") == SERIES
        and p["configuration"]["hardware"]["accelerator_count"] == 1
    ]
    if not points:
        raise ValueError("No measured W4A8 (GDN W8A8) SWE concurrency observations")
    xmax = math.ceil(max(p["metrics"]["decode_p90_tps"] for p in points) / 20) * 20
    ymax = math.ceil(max(output_tps_per_chip(p) for p in points) / 40) * 40

    def x(value):
        return 90 + value / xmax * 810

    def y(value):
        return 440 - value / ymax * 320

    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" role="img" aria-labelledby="title desc">',
        '<title id="title">Qwen3.5-35B-A3B W4A8 (experts int4, GDN W8A8) single-chip SWE concurrency speed-throughput tradeoff</title>',
        '<desc id="desc">Only client concurrency changes within the single-chip W4A8 real-MTP2 series. Every point is one 900s closed-loop observation on one Ascend 910B3 chip at max-num-seqs 16.</desc>',
        '<rect width="1000" height="580" fill="#fff"/>',
        '<g font-family="system-ui,sans-serif" fill="#172033">',
        '<text x="60" y="40" font-size="23" font-weight="700">Qwen3.5-35B-A3B W4A8 · single-chip SWE prefix reuse</text>',
        '<text x="60" y="68" font-size="15">TP1 · 1×910B3 · FULL_DECODE_ONLY · MNS16 · real MTP2 · int4 experts + GDN W8A8 · 900s/point</text>',
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
    color = "#0f766e"
    label = "W4A8 (GDN W8A8) + real MTP2"
    rows = sorted(points, key=lambda p: p["load"]["concurrency"])
    # 同一 series 内只有客户端 C 变化; 其余服务设置必须逐项一致。
    reference = rows[0]["configuration"]["parameters"]
    for p in rows:
        params = p["configuration"]["parameters"]
        assert all(params.get(key) == reference.get(key) for key in FIXED), (
            "Mixed serving settings within a W4A8 (GDN W8A8) TP1 concurrency line"
        )
        assert params["tensor_parallel_size"] == 1 and params["mtp_draft_tokens"] == 2
        assert params["max_num_seqs"] == 16
        for key, expected in CALIBER.items():
            assert params[key] == expected, (key, params[key], expected)
        assert params["quantization"] == "ascend"
        assert p["configuration"]["mods"] == MODS
        assert params["mods"] == MODS
        assert p["configuration"]["hardware"]["accelerator_count"] == 1
        assert p["load"]["session_rotation_depth"] == 1
    coords = [
        (x(p["metrics"]["decode_p90_tps"]), y(output_tps_per_chip(p))) for p in rows
    ]
    positions = " ".join(f"{px:.2f},{py:.2f}" for px, py in coords)
    svg.append(
        f'<polyline points="{positions}" fill="none" stroke="{color}" stroke-width="2.5"/>'
    )
    for p, (px, py) in zip(rows, coords):
        description = escape(
            f"{label} C{p['load']['concurrency']}: P90 {p['metrics']['decode_p90_tps']:.2f} tokens/s; {output_tps_per_chip(p):.2f} tokens/s/chip"
        )
        svg.append(
            f'<circle data-point="{escape(p["id"])}" cx="{px:.2f}" cy="{py:.2f}" r="5" fill="{color}"><title>{description}</title></circle>'
        )
        svg.append(
            f'<text x="{px + 9:.2f}" y="{py - 12:.2f}" fill="{color}" font-size="14">C{p["load"]["concurrency"]}</text>'
        )
    svg.append(
        f'<text x="90" y="99" fill="{color}" font-size="15">{label} · int4 experts / int8 rest · bf16 KV</text>'
    )
    svg.extend(
        [
            '<text x="495" y="496" text-anchor="middle" font-size="16">P90 request decode speed · output tokens/s</text>',
            '<text transform="translate(25 280) rotate(-90)" text-anchor="middle" font-size="16">Output tokens/s/chip</text>',
            '<text x="60" y="532" font-size="13">The line connects all five measured client C levels (C1/C2/C4/C8/C16); it is not a fitted curve or a cross-setting Pareto envelope.</text>',
            '<text x="60" y="554" font-size="13">One server instance, 33.49 GiB KV set explicitly for this artifact (5.46 lanes at 262144 tokens), so prefix reuse survives C16 and C16 is the measured peak. The KV budget is a deployment choice, not an int4 property; W4A8 vs W8A8/BF16 differs in precision and KV budget, so no cross-precision speedup claim.</text>',
            "</g></svg>",
        ]
    )
    return "\n".join(svg) + "\n"


if __name__ == "__main__":
    snapshot = json.loads((SITE / "data/leaderboard_frontier.json").read_text())
    (SITE / "assets/frontier-qwen35-w4a8-gdnw8a8-tp1-swe-concurrency.svg").write_text(
        render(snapshot)
    )
