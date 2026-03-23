# Leaderboard MVP Validation Rules

## Validation command

```bash
python data/validate_schema.py \
  data/leaderboard_single.json \
  data/leaderboard_multi.json \
  data/examples/single_node_example.json \
  data/examples/multi_node_example.json
```

## Rule set (MVP)

1. **Payload shape**
   - accepts entry object or entry array
1. **Entry required keys**
   - `entry_id`, `engine`, `engine_version`, `config_type`, `hardware`, `model`, `workload`, `metrics`,
     `versions`, `environment`, `metadata`
1. **Hardware minimum**
   - `vendor`, `chip_model`, `chip_count`
   - at least one of `interconnect` / `intra_node_interconnect`
1. **Metrics minimum**
   - `ttft_ms`, `throughput_tps`, `peak_mem_mb`, `error_rate`
   - all non-negative, and `error_rate` in `[0,1]`
1. **Cluster rules**
   - single-node: `cluster = null`
   - multi-node: object with `node_count>=2`, `comm_backend`, `topology_type`
1. **Version rules**
   - required `protocol`, `backend`, `core`
   - semver-like `X.Y.Z(.W)` or `N/A`

## Fail-fast policy

- Schema mismatch = invalid data, do not publish to website data files.
- Missing required metrics = reject record.
- Multi-node record without valid `cluster` = reject record.
