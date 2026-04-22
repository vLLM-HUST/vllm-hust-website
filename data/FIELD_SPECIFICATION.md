# LLM Engine Leaderboard MVP Field Specification

This document defines the MVP leaderboard data contract used by the website.

## Source of Truth

- Schema: `data/schemas/leaderboard_v1.schema.json`
- Display data: `data/leaderboard_single.json`, `data/leaderboard_multi.json`
- Derived compare snapshot: `data/leaderboard_compare.json`
- Samples: `data/examples/single_node_example.json`, `data/examples/multi_node_example.json`

## Top-level format

Schema accepts both:

1. **single entry object** (for example files)
1. **entry array** (for website data files)

## Required fields per entry

| Field            | Type         | Notes                                       |
| ---------------- | ------------ | ------------------------------------------- |
| `entry_id`       | string(UUID) | unique record id                            |
| `engine`         | string       | inference engine id (e.g. vllm, sglang)     |
| `engine_version` | string       | engine version string                       |
| `config_type`    | string       | `single_gpu` / `multi_gpu` / `multi_node`   |
| `hardware`       | object       | hardware metadata                           |
| `model`          | object       | model metadata                              |
| `workload`       | object       | workload shape                              |
| `metrics`        | object       | benchmark metrics                           |
| `constraints`    | object       | mandatory hard-constraint context + metrics |
| `versions`       | object       | component versions                          |
| `environment`    | object       | runtime env                                 |
| `metadata`       | object       | provenance and reproducibility              |

## Key nested fields used by website MVP

### `hardware`

- Required: `vendor`, `chip_model`, `chip_count`
- Must provide one of: `interconnect` or `intra_node_interconnect`
- `vendor` supports `Intel/AMD/NVIDIA/Huawei/Unknown/Other`

### `metrics`

- Required: `ttft_ms`, `throughput_tps`, `peak_mem_mb`, `error_rate`
- Optional: `prefix_hit_rate`, `tbt_ms`, `tpot_ms`, KV/evict metrics
- Numeric values are non-negative (`error_rate` in `[0,1]`)

### `constraints` (Hard constraints)

- Required `scenario_source = "vllm-benchmark"`
- Required `accountable_scope`:
  - `domestic_chip_class`
  - `representative_model_band` (fixed to `7B-13B`)
  - `representative_business_scenario`
  - `baseline_engine`
- Required `constraints.metrics`:
  - `single_chip_effective_utilization_pct`
  - `typical_throughput_ratio_vs_baseline`
  - `typical_ttft_reduction_pct_vs_baseline`
  - `typical_tpot_reduction_pct_vs_baseline`
  - `long_context_length`
  - `long_context_throughput_stable`
  - `long_context_ttft_p95_ms`, `long_context_ttft_p99_ms`
  - `long_context_tpot_p95_ms`, `long_context_tpot_p99_ms`
  - `long_context_ttft_p95_stable`, `long_context_ttft_p99_stable`
  - `long_context_tpot_p95_stable`, `long_context_tpot_p99_stable`
  - `unit_token_cost_reduction_pct`
  - `multi_tenant_high_utilization`

### `cluster`

- `null` for single-node configs
- object for multi-node, with required:
  - `node_count >= 2`
  - `comm_backend`
  - `topology_type`

### `versions`

- Required: `protocol`, `backend`, `core`
- Optional: `control_plane`, `gateway`, `kv_cache`, `comm`, `compression`, `benchmark`
- Version format accepts semver-like string or `N/A`

## MVP consistency rule

Website render fields must be present in schema and examples:

- version: `engine_version`
- config filters: `hardware.chip_model`, `model.name`, `model.precision`, `workload.name`
- trend metrics: `metrics.ttft_ms`, `metrics.throughput_tps`, `metrics.peak_mem_mb`,
  `metrics.error_rate`, `metrics.prefix_hit_rate`

## Derived compare snapshot

`leaderboard_compare.json` is generated from validated leaderboard entries after deduplication. It
is not covered by `leaderboard_v1.schema.json` because it is a website-facing derived view, not a
primary benchmark result contract.

Expected top-level fields:

- `schema_version = leaderboard-compare-snapshot/v1`
- `generated_at`
- `group_count`
- `preferred_pair_count`
- `groups[]`

Each compare group carries:

- `scope_key`: exact compare scope key used by the website
  (`model|hardware|precision|workload|config_type|chip_count|node_count`)
- `scope`: human-readable decomposition of that same compare scope
- `engines[]`: one preferred row per engine after deduplication
- `preferred_pair`: the head-to-head pair the website should render first, selected by score
  ordering (throughput first, then latency)
