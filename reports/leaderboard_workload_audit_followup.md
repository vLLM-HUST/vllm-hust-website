# 性能排行榜 workload 数据审计 — Followup

> 原始报告：`reports/leaderboard_workload_audit.md`（2026-07-22 快照，记录了当时 `a46abb7ae` 因 plugin commit
> 不一致被拆成两段的状况）。本 followup 报告 描述 2026-07-25 修复后的状态，原文件保留不动作为历史归档。

- 数据来源：`data/leaderboard_single.json` + `data/leaderboard_multi.json`
- 快照生成时间：`data/last_updated.json`（2026-07-25T14:16+00:00 之后）
- 检查口径：同原报告——按折线图的版本轴和 series 分组逻辑审计，重点关注 「同一 `metadata.git_commit` 被拆到多个 x 轴点」的 split 情况。

## a46abb7ae 现状

修复后，commit `a46abb7ae68acc13a4fc5870db98619b3f97c6e0` 的 6 条 single-gpu 记录**全部归入同一个 runtime
revision**：

| 字段                                        | 值                                         |
| ------------------------------------------- | ------------------------------------------ |
| `metadata.git_commit`                       | `a46abb7ae68acc13a4fc5870db98619b3f97c6e0` |
| `metadata.runtime_provenance.plugin.commit` | `f430530ada2c0c2ec2f925606494bc95a474d9c8` |
| `engine_version`                            | `v0.17.2rc0-2810-ga46abb7ae`               |

对应 6 个 workload（按原审计报告列）：

- `prefix-repetition-online`
- `random-latency`
- `random-online`
- `sharegpt-online`
- `sharegpt-throughput`
- `sonnet-throughput`

在 website 趋势图 x 轴上对应单个 key： `current|a46abb7ae6+f430530ad`

## 仍然缺失的 cell

`a46abb7ae (6/7 present)` —— `instructcoder-online` 真正没跑过该 commit，这不是 数据一致性问题，无法靠对齐 plugin commit
来修。补流程：

```bash
cd vllm-hust-benchmark
python3 scripts/backfill_single_gpu.py run \
  --commit a46abb7ae68acc13a4fc5870db98619b3f97c6e0 \
  --workload instructcoder-online
```

`cmd_run` 修复后的 resolve 链会自动通过 `_lookup_ascend_commit_from_snapshot` 拿到 plugin `f430530ad`（snapshot
canonical），与既有 6 条共线。

## 修复涉及的脚本与文档

| 位置                                                            | 改动                                                                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vllm-hust-benchmark/scripts/backfill_single_gpu.py`            | 新增 `PluginCommitMismatch`、`assert_plugin_commit_consistent`、`record_plugin_override`；`cmd_run` / `run_cell` / `cmd_plan` 接上；`run` 子命令加 `--force-mismatched-plugin-commit` |
| `vllm-hust-benchmark/docs/HISTORICAL_PR_BACKFILL.md`            | 新增 "Plugin commit alignment rule" 章节，记录 a46 案例与新规则                                                                                                                       |
| `vllm-hust-benchmark/scripts/backfill_single_gpu.md`            | 新增 "Plugin commit consistency guard" 章节，含 `--force-mismatched-plugin-commit` 用法与 `plan` ⚠ 警告读法                                                                           |
| `vllm-hust-benchmark/tests/test_backfill_plugin_consistency.py` | 5 个测试覆盖：snapshot 命中一致 / snapshot 命中不一致 / snapshot miss / override + audit / 错误消息格式                                                                               |
| `vllm-hust-website/scripts/aggregate_results.py`                | `compute_canonical_plugin_commit_map` 升级为返回 `(commit, source_entry_id)`；reject message 包含 source entry_id                                                                     |
| `vllm-hust-website/scripts/check_engine_version_consistency.py` | CI sentinel：dev-build sha 与 git_commit 不一致硬 fail；release 与 dev-build 同 commit 共存 warn                                                                                      |
| `vllm-hust-website/.github/workflows/ci.yml`                    | 新增 "Validate engine_version vs. git_commit consistency" step                                                                                                                        |
| `vllm-hust-website/data/FIELD_SPECIFICATION.md`                 | 新增 `metadata.runtime_provenance` 字段语义与 plugin commit alignment rule                                                                                                            |

## 仍需操作

1. 跑 `run --workload instructcoder-online --commit a46abb7ae…` 补 7/7。
1. 把两个仓的修复 commit 推到 `main` 触发 GitHub Pages / HF 数据同步，否则 线上 UI 看不到任何变化（当前两条 fix 提交都还在本地 feature
   分支上）。
