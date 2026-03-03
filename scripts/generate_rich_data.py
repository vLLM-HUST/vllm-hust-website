#!/usr/bin/env python3
"""生成丰富的测试数据，包括性能回退和多种配置组合"""

import json
import random
from pathlib import Path

# 配置参数
HARDWARE_CONFIGS = {
    "single_chip": [
        {
            "chip_model": "NVIDIA A100-80GB",
            "chip_count": 1,
            "memory": 80,
            "cuda_version": "12.1",
        },
        {
            "chip_model": "Huawei Ascend 910B",
            "chip_count": 1,
            "memory": 64,
            "cann_version": "8.0.RC3",
        },
        {
            "chip_model": "Kunlun XPU R200",
            "chip_count": 1,
            "memory": 32,
            "xre_version": "3.2.0",
        },
    ],
    "multi_chip": [
        {
            "chip_model": "NVIDIA A100-80GB",
            "chip_count": 4,
            "memory": 320,
            "cuda_version": "12.1",
        },
        {
            "chip_model": "Huawei Ascend 910B",
            "chip_count": 8,
            "memory": 512,
            "cann_version": "8.0.RC3",
        },
        {
            "chip_model": "NVIDIA H100-80GB",
            "chip_count": 4,
            "memory": 320,
            "cuda_version": "12.3",
        },
    ],
    "multi_node": [
        {
            "chip_model": "Huawei Ascend 910B",
            "chip_count": 8,
            "node_count": 2,
            "memory": 512,
            "interconnect": "HCCL",
        },
        {
            "chip_model": "NVIDIA A100-80GB",
            "chip_count": 8,
            "node_count": 4,
            "memory": 640,
            "interconnect": "NCCL",
        },
        {
            "chip_model": "Kunlun XPU R300",
            "chip_count": 8,
            "node_count": 2,
            "memory": 512,
            "interconnect": "XCCL",
        },
    ],
}

MODELS = [
    {"name": "Qwen2-7B", "size": 7},
    {"name": "Qwen2-14B", "size": 14},
    {"name": "Llama-3-8B", "size": 8},
    {"name": "Llama-3-70B", "size": 70},
]

WORKLOADS = [
    {"type": "short_input", "prompt": 128, "output": 128},
    {"type": "long_input", "prompt": 2048, "output": 512},
    {"type": "pressure_test", "prompt": 512, "output": 256},
]

PRECISIONS = ["FP16", "BF16", "INT8", "INT4"]

VERSIONS = ["0.3.2", "0.3.1", "0.3.0", "0.2.5"]


def generate_base_metrics(hardware, model, workload, precision):
    """生成基础性能指标"""
    # 基础值（单卡 FP16 Qwen2-7B short_input）
    base_ttft = 45.0
    base_throughput = 80.0
    base_memory = 15360

    # 硬件因子
    chip_factor = hardware["chip_count"]

    # 模型因子
    model_factor = model["size"] / 7.0

    # 工作负载因子
    workload_factor = workload["prompt"] / 128.0

    # 精度因子
    precision_factors = {"FP16": 1.0, "BF16": 1.05, "INT8": 1.8, "INT4": 2.5}
    precision_factor = precision_factors.get(precision, 1.0)

    # 计算指标
    ttft = base_ttft / (chip_factor**0.7) * workload_factor * (1.0 / precision_factor)
    throughput = base_throughput * chip_factor * precision_factor / model_factor
    memory = (
        base_memory * model_factor / (2.0 if precision in ["INT8", "INT4"] else 1.0)
    )

    return {
        "ttft_ms": round(ttft + random.uniform(-5, 5), 1),
        "throughput_tps": round(throughput + random.uniform(-10, 10), 1),
        "peak_mem_mb": int(memory * chip_factor),
    }


def apply_version_delta(metrics, version, is_regression=False):
    """应用版本差异，包括性能回退"""
    version_factors = {
        "0.3.2": 1.0,
        "0.3.1": 0.95 if not is_regression else 1.03,  # 有些版本会回退
        "0.3.0": 0.90,
        "0.2.5": 0.85,
    }

    factor = version_factors.get(version, 1.0)

    result = metrics.copy()
    result["ttft_ms"] = round(metrics["ttft_ms"] / factor, 1)
    result["throughput_tps"] = round(metrics["throughput_tps"] * factor, 1)
    result["peak_mem_mb"] = int(
        metrics["peak_mem_mb"] * (1.05 if is_regression else 0.98)
    )

    # 添加其他指标
    result["tbt_ms"] = round(1000.0 / result["throughput_tps"] * 10, 1)
    result["tpot_ms"] = result["tbt_ms"]
    result["error_rate"] = round(random.uniform(0.005, 0.02), 3)
    result["prefix_hit_rate"] = round(random.uniform(0.82, 0.93), 2)
    result["kv_used_tokens"] = 2048 * (2 if "long" in str(metrics) else 1)
    result["kv_used_bytes"] = result["kv_used_tokens"] * 32768
    result["evict_count"] = random.randint(1, 5)
    result["evict_ms"] = round(random.uniform(0.8, 3.5), 1)
    result["spec_accept_rate"] = (
        round(random.uniform(0.70, 0.82), 2) if random.random() > 0.3 else None
    )

    return result


def generate_entry(
    entry_id,
    category,
    hardware,
    model,
    workload,
    precision,
    version,
    is_regression=False,
):
    """生成单条数据"""
    base_metrics = generate_base_metrics(hardware, model, workload, precision)
    metrics = apply_version_delta(base_metrics, version, is_regression)

    entry = {
        "entry_id": entry_id,
        "sagellm_version": version,
        "config_type": "multi_gpu"
        if category == "multi_chip"
        else ("multi_node" if category == "multi_node" else "single_gpu"),
        "hardware": {},
        "model": {
            "name": model["name"],
            "parameters": f"{model['size']}B",
            "precision": precision,
            "quantization": "None" if precision in ["FP16", "BF16"] else precision,
        },
        "workload": {
            "input_length": workload["prompt"],
            "output_length": workload["output"],
            "batch_size": 1,
            "concurrent_requests": 1,
            "dataset": workload["type"],
        },
        "metrics": metrics,
        "cluster": None,
        "versions": {
            "protocol": "0.1.1.0",
            "backend": "0.3.0.6" if version == "0.3.2" else "0.3.0.5",
            "core": "0.3.0.5" if version in ["0.3.2", "0.3.1"] else "0.3.0.4",
            "control_plane": "0.1.1.5",
            "gateway": "0.1.1.5",
            "kv_cache": "0.1.1.6",
            "comm": "0.1.1.7",
            "compression": "0.1.1.7",
            "benchmark": "0.3.0.3",
        },
        "environment": {
            "os": "Ubuntu 22.04",
            "python_version": "3.10.12",
            "pytorch_version": "2.1.0",
            "cuda_version": None,
            "cann_version": None,
            "driver_version": None,
        },
        "kv_cache_config": {
            "enabled": True,
            "eviction_policy": "LRU",
            "budget_tokens": 8192,
            "prefix_cache_enabled": True,
        },
        "metadata": {
            "submitted_at": f"2026-01-{random.randint(15, 28):02d}T10:30:00Z",
            "submitter": "IntelliStream Team",
            "data_source": "automated-benchmark",
            "reproducible_cmd": f"sage-llm benchmark --model {model['name']} --backend {'cuda' if 'NVIDIA' in hardware['chip_model'] else 'ascend'} --precision {precision}",
            "git_commit": f"{'abcdef'[random.randint(0, 5)]}{random.randint(1, 9)}{'xyz'[random.randint(0, 2)]}{random.randint(0, 9)}abcd1234",
            "release_date": f"2026-01-{random.randint(15, 28):02d}",
            "changelog_url": f"https://github.com/intellistream/sagellm/blob/main/CHANGELOG.md#v{version}",
            "notes": f"Version {version} {'优化' if not is_regression else '修复问题，性能略有下降'}",
            "verified": True,
        },
    }

    # 填充硬件信息
    if category == "multi_node":
        entry["hardware"] = {
            "vendor": "NVIDIA"
            if "NVIDIA" in hardware["chip_model"]
            else ("Huawei" if "Ascend" in hardware["chip_model"] else "Kunlun"),
            "chip_model": hardware["chip_model"],
            "chip_count": hardware["chip_count"],
            "chips_per_node": hardware["chip_count"] // hardware["node_count"],
            "intra_node_interconnect": "NVLink"
            if "NVIDIA" in hardware["chip_model"]
            else "HCCL",
            "memory_per_chip_gb": hardware["memory"] / hardware["chip_count"],
            "total_memory_gb": hardware["memory"],
        }
        entry["cluster"] = {
            "node_count": hardware["node_count"],
            "chip_per_node": hardware["chip_count"] // hardware["node_count"],
            "interconnect": hardware["interconnect"],
            "topology": "ring",
            "network_bandwidth_gbps": 400,
        }
    else:
        entry["hardware"] = {
            "vendor": "NVIDIA"
            if "NVIDIA" in hardware["chip_model"]
            else ("Huawei" if "Ascend" in hardware["chip_model"] else "Kunlun"),
            "chip_model": hardware["chip_model"],
            "chip_count": hardware["chip_count"],
            "chips_per_node": hardware["chip_count"],
            "intra_node_interconnect": "NVLink"
            if hardware["chip_count"] > 1 and "NVIDIA" in hardware["chip_model"]
            else "None",
            "memory_per_chip_gb": hardware["memory"] / hardware["chip_count"],
            "total_memory_gb": hardware["memory"],
        }

    # 添加驱动版本到 environment
    if "NVIDIA" in hardware["chip_model"]:
        entry["environment"]["cuda_version"] = hardware.get("cuda_version", "12.1")
        entry["environment"]["driver_version"] = "535.104.05"
    elif "Ascend" in hardware["chip_model"]:
        entry["environment"]["cann_version"] = hardware.get("cann_version", "8.0.RC3")
        entry["environment"]["driver_version"] = "24.1.rc3"
    elif "Kunlun" in hardware["chip_model"]:
        entry["environment"]["driver_version"] = "3.2.1"

    return entry


def main():
    single_data = []
    multi_data = []

    # 生成单机单卡数据 (丰富配置)
    configs = [
        # NVIDIA A100 + Qwen2-7B (多种工作负载和精度)
        ("NVIDIA A100-80GB", "Qwen2-7B", "short_input", "FP16"),
        ("NVIDIA A100-80GB", "Qwen2-7B", "long_input", "FP16"),
        ("NVIDIA A100-80GB", "Qwen2-7B", "short_input", "INT8"),
        ("NVIDIA A100-80GB", "Qwen2-7B", "pressure_test", "FP16"),
        # Ascend + Qwen2-7B
        ("Huawei Ascend 910B", "Qwen2-7B", "short_input", "FP16"),
        ("Huawei Ascend 910B", "Qwen2-7B", "long_input", "BF16"),
        # 昆仑芯 + Qwen2-7B
        ("Kunlun XPU R200", "Qwen2-7B", "short_input", "FP16"),
        # NVIDIA A100 + Llama-3-8B
        ("NVIDIA A100-80GB", "Llama-3-8B", "short_input", "FP16"),
        ("NVIDIA A100-80GB", "Llama-3-8B", "long_input", "INT8"),
        # Ascend + Llama-3-8B
        ("Huawei Ascend 910B", "Llama-3-8B", "short_input", "BF16"),
        # NVIDIA A100 + Qwen2-14B
        ("NVIDIA A100-80GB", "Qwen2-14B", "short_input", "FP16"),
        ("NVIDIA A100-80GB", "Qwen2-14B", "short_input", "INT8"),
    ]

    for chip_model, model_name, workload_type, precision in configs:
        hardware = next(
            h for h in HARDWARE_CONFIGS["single_chip"] if h["chip_model"] == chip_model
        )
        model = next(m for m in MODELS if m["name"] == model_name)
        workload = next(w for w in WORKLOADS if w["type"] == workload_type)

        for version in VERSIONS:
            # v0.3.1 有 20% 概率性能回退
            is_regression = version == "0.3.1" and random.random() < 0.2

            entry_id = f"single_{version.replace('.', '_')}_{chip_model.split()[0].lower()}_{model_name.replace('-', '').lower()}_{workload_type}_{precision.lower()}"
            entry = generate_entry(
                entry_id,
                "single_chip",
                hardware,
                model,
                workload,
                precision,
                version,
                is_regression,
            )
            single_data.append(entry)

    # 生成单机多卡数据
    multi_chip_configs = [
        # NVIDIA A100 4卡
        ("NVIDIA A100-80GB", 4, "Qwen2-7B", "short_input", "FP16"),
        ("NVIDIA A100-80GB", 4, "Qwen2-7B", "long_input", "FP16"),
        ("NVIDIA A100-80GB", 4, "Qwen2-14B", "short_input", "FP16"),
        ("NVIDIA A100-80GB", 4, "Llama-3-8B", "short_input", "INT8"),
        # Ascend 8卡
        ("Huawei Ascend 910B", 8, "Qwen2-14B", "short_input", "BF16"),
        ("Huawei Ascend 910B", 8, "Llama-3-8B", "long_input", "BF16"),
        # H100 4卡
        ("NVIDIA H100-80GB", 4, "Qwen2-7B", "short_input", "FP16"),
        ("NVIDIA H100-80GB", 4, "Qwen2-14B", "pressure_test", "INT8"),
    ]

    for (
        chip_model,
        chip_count,
        model_name,
        workload_type,
        precision,
    ) in multi_chip_configs:
        hardware = next(
            h
            for h in HARDWARE_CONFIGS["multi_chip"]
            if h["chip_model"] == chip_model and h["chip_count"] == chip_count
        )
        model = next(m for m in MODELS if m["name"] == model_name)
        workload = next(w for w in WORKLOADS if w["type"] == workload_type)

        for version in VERSIONS:
            is_regression = version == "0.3.1" and random.random() < 0.15

            entry_id = f"multichip_{version.replace('.', '_')}_{chip_model.split()[0].lower()}_{chip_count}x_{model_name.replace('-', '').lower()}_{workload_type}_{precision.lower()}"
            entry = generate_entry(
                entry_id,
                "multi_chip",
                hardware,
                model,
                workload,
                precision,
                version,
                is_regression,
            )
            single_data.append(entry)

    # 生成多机多卡数据
    cluster_configs = [
        # Ascend 2节点
        ("Huawei Ascend 910B", 8, 2, "Llama-3-70B", "long_input", "BF16"),
        ("Huawei Ascend 910B", 8, 2, "Qwen2-14B", "short_input", "BF16"),
        ("Huawei Ascend 910B", 8, 2, "Llama-3-70B", "pressure_test", "BF16"),
        # NVIDIA A100 4节点
        ("NVIDIA A100-80GB", 8, 4, "Llama-3-70B", "long_input", "FP16"),
        ("NVIDIA A100-80GB", 8, 4, "Llama-3-70B", "short_input", "INT8"),
        # 昆仑芯 2节点
        ("Kunlun XPU R300", 8, 2, "Qwen2-14B", "long_input", "FP16"),
        ("Kunlun XPU R300", 8, 2, "Llama-3-8B", "pressure_test", "FP16"),
    ]

    for (
        chip_model,
        chip_count,
        node_count,
        model_name,
        workload_type,
        precision,
    ) in cluster_configs:
        hardware_base = next(
            h
            for h in HARDWARE_CONFIGS["multi_node"]
            if h["chip_model"] == chip_model and h["node_count"] == node_count
        )
        hardware = hardware_base.copy()
        hardware["chip_count"] = chip_count

        model = next(m for m in MODELS if m["name"] == model_name)
        workload = next(w for w in WORKLOADS if w["type"] == workload_type)

        for version in VERSIONS:
            is_regression = (
                version == "0.3.0" and random.random() < 0.25
            )  # v0.3.0 分布式有更多问题

            entry_id = f"multinode_{version.replace('.', '_')}_{chip_model.split()[0].lower()}_{node_count}n{chip_count}c_{model_name.replace('-', '').lower()}_{workload_type}_{precision.lower()}"
            entry = generate_entry(
                entry_id,
                "multi_node",
                hardware,
                model,
                workload,
                precision,
                version,
                is_regression,
            )
            multi_data.append(entry)

    # 保存数据
    output_dir = Path(__file__).parent.parent / "data"
    output_dir.mkdir(exist_ok=True)

    with open(output_dir / "leaderboard_single.json", "w", encoding="utf-8") as f:
        json.dump(single_data, f, indent=4, ensure_ascii=False)

    with open(output_dir / "leaderboard_multi.json", "w", encoding="utf-8") as f:
        json.dump(multi_data, f, indent=4, ensure_ascii=False)

    print("✅ 生成完成！")
    print(f"  单机数据：{len(single_data)} 条")
    print(f"  多机数据：{len(multi_data)} 条")
    print("  包含性能回退样本（绿色箭头）")


if __name__ == "__main__":
    main()
