# 性能排行榜 workload 数据审计

- 数据来源：`data/leaderboard_single.json` + `data/leaderboard_multi.json`（当前本地快照）
- compare 快照生成时间：`2026-07-02T13:29:54.320426+00:00`
- 记录数：single=77，multi=28，合计=105
- 检查口径：按排行榜折线图的版本轴和 series 分组逻辑审计；throughput 相邻有效点下降 ≥ 15% 记为“突然掉点”。
- 缺点口径：同一条折线在第一个点和最后一个点之间缺少版本点会造成折线断开；同时单独标出缺少 `vllm` baseline 或 `vllm-hust` 对照的数据组。

## 总览

- Workload 数：19
- 版本轴有效点数：10
- 突然掉点：9 处，其中严重掉点（≥25%）：7 处
- 缺点/断线风险：19 处
- 指标为空导致不可见/断线：10 处

## 原因分析

### 结论先行

- 当前看到的严重掉点不太像是 `--enforce-eager` 引起的。所有严重掉点对应的 `same_spec.resolved_server_parameters.enforce_eager`
  都是空字符串，baseline 和 vllm-hust 异常点之间没有出现一边 enforce eager、一边非 eager 的情况。
- 确实存在参数/元数据不统一问题。最明显的是 `prefix-repetition-online` 里 2026-05-06 的 vllm-hust 点：外层 `workload` 写成
  `input_length=512`、`output_length=238`、`concurrent_requests=2`，但它挂载的 same-spec client 参数实际是
  `prefix_repetition_prefix_len=3840`、`suffix_len=256`、`output_len=256`、`request_rate=1`。这类点不适合和 6
  月/7 月的 4096/256 official baseline 放在一条趋势线上解释。
- 7 月 1 日到 7 月 2 日的新 vllm-hust 点基本采用了统一 official
  same-spec：`num_prompts=200`、`request_rate=1`、`dtype=float16`、`tensor_parallel_size` 与 chip 数一致，且
  `random_input_len=1024/random_output_len=256` 或
  `prefix_repetition_prefix_len=3840/suffix_len=256/output_len=256`。这些点的掉速更像真实性能/调度退化，而不是 token size
  配错。
- 一个横向信号很强：7 月的新 vllm-hust online 点普遍 TTFT 从几百毫秒或几秒级暴涨到数万到十几万毫秒，而 TPOT 变化相对小很多。这说明主要问题更像
  admission/scheduling/排队/首 token 路径，而不是纯 decode token 速率。
- 多卡 `random-online-*`、`prefix-repetition-online-*`、`sharegpt-online-*` 的 vllm-hust 点与 vllm baseline
  使用同一个 resolved spec hash，除了端口不同外关键 server/client 参数一致。因此这些多卡掉点应优先作为性能问题复现实验，而不是先归因于 benchmark
  参数不统一。

### 参数不统一或元数据可疑的点

- `prefix-repetition-online`，vllm-hust `0.20.1rc1.dev314+g64ff561c7` / commit `7fa0e3ed4b`：
  - 外层 workload：`input_length=512`、`output_length=238`、`concurrent_requests=2`。
  - same-spec
    client：`prefix_repetition_prefix_len=3840`、`prefix_repetition_suffix_len=256`、`prefix_repetition_output_len=256`、`request_rate=1`。
  - 结论：这是明显的 workload 元数据不一致。该点造成 `prefix-repetition-online` baseline `199.7 tok/s` 到 `25.26 tok/s`
    的 -87.3% “掉点”在解释上不可靠，应重新采集或从趋势分析里标记为 invalid/suspect。
- `random-online`，vllm-hust `7a63f81` 的早期点：
  - 有一条记录使用 `model=aly16/Qwen2.5-14B-W8A8`、`dtype=auto`，而 official baseline 是
    `Qwen/Qwen2.5-14B-Instruct`、`dtype=float16`。
  - 后续同 commit 的记录又切回 `Qwen/Qwen2.5-14B-Instruct`、`dtype=float16`。
  - 结论：早期 W8A8/auto 点不应和 FP16 official baseline 混在同一条趋势线上；当前报告中的严重 `random-online` 掉点是从 FP16 7a63f81
    到 7 月 1 日 ceec19abb0 的下降，仍需要复测确认。
- 6 月 official baseline 与 7 月 vllm-hust 单卡记录的 `resolved_spec_hash` 有差异，主要来自模型路径、端口和部分 server
  参数显式性变化：
  - 6 月 baseline 常见模型路径是 HuggingFace cache snapshot，并显式包含 `gpu_memory_utilization=0.6`。
  - 7 月 vllm-hust 常见模型路径是 `/data/shared_models/Qwen--Qwen2.5-14B-Instruct`，`gpu_memory_utilization`
    在 resolved server 参数中未出现。
  - 结论：client token 参数通常一致，但 server 参数记录不完全一致。单卡 baseline-vs-current 结论需要补一组同一 dev-hub 环境、同一模型路径、同一
    server 参数显式化的复测。

### 更像真实性能退化的点

- `random-online-2chip` / `random-online-4chip`：
  - baseline 与 vllm-hust 使用相同 same-spec hash。
  - 关键参数一致：`tensor_parallel_size=2/4`、`dtype=float16`、`random_input_len=1024`、`random_output_len=256`、`num_prompts=200`、`request_rate=1`。
  - vllm-hust TTFT 升到 `82,787 ms` / `83,972 ms`，吞吐分别下降 -43.3% / -40.1%。
  - 结论：优先怀疑 vllm-hust 在多卡 online admission/scheduling 或 prefill 首 token 路径有退化。
- `prefix-repetition-online-2chip` / `prefix-repetition-online-4chip`：
  - baseline 与 vllm-hust 使用相同 same-spec hash。
  - 关键参数一致：`prefix_len=3840`、`suffix_len=256`、`output_len=256`、`request_rate=1`，TP 与 chip 数一致。
  - vllm-hust TTFT 升到 `107,559 ms` / `88,196 ms`，吞吐分别下降 -50.3% / -45.3%。
  - 结论：这是最需要复现的多卡长前缀场景，参数层面没有看到 `enforce-eager` 或 token size 差异。
- `sharegpt-online-2chip` / `sharegpt-online-4chip`：
  - same-spec hash 一致，dataset path、`num_prompts=200`、`request_rate=1`、TP 设置一致。
  - TTFT 从 baseline 的约 `296-307 ms` 升到 `40-48 s`，吞吐下降 -23.7% / -26.4%。
  - 结论：不是 token size 参数错配，倾向于线上请求排队/调度行为退化。
- `agent-research-online-2chip`：
  - same-spec hash 一致，`num_prompts=32`、`request_rate=1`、dataset path 一致。
  - TTFT 从 `295 ms` 升到约 `6.4-7.1 s`，吞吐下降 -16.5%。
  - 结论：掉幅较小但方向一致，建议作为较短 trace 的快速复现入口。

### 建议的补实验顺序

1. 先重跑 `prefix-repetition-online-2chip`、`random-online-2chip`、`sharegpt-online-2chip`，因为它们 same-spec
   完全对齐但 TTFT 爆炸，最能判断是否是真回归。
1. 再重跑对应 4chip workload，确认是否是多卡规模放大问题。
1. 对 `prefix-repetition-online` 单卡历史点 `7fa0e3ed4b` 标记 suspect，并用 official 4096/256 same-spec 重新采一条。
1. 对 `random-online` 早期 W8A8/auto 记录从趋势线中隔离，或者用 FP16 official spec 重新补数据。
1. 所有复测都应显式记录 `enforce_eager`、`gpu_memory_utilization`、`max_model_len`、`max_num_seqs`、模型路径、TP、输入/输出
   token 参数，避免后续只能靠推断。

## 严重掉点优先列表

- `prefix-repetition-online` (1 chip): baseline 0.18.0 (e18643f8a4) →
  0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b), 199.7 tok/s → 25.26 tok/s (-87.3%), commit
  e18643f8a4 → 7fa0e3ed4b
- `prefix-repetition-online-2chip` (2 chip): baseline 0.18.0 (e18643f8a4) →
  v0.20.1rc0-535-gceec19abb0, 218.1 tok/s → 108.5 tok/s (-50.3%), commit e18643f8a4 → ceec19abb0
- `prefix-repetition-online-4chip` (4 chip): baseline 0.18.0 (e18643f8a4) →
  v0.20.1rc0-535-gceec19abb0, 216.2 tok/s → 118.3 tok/s (-45.3%), commit e18643f8a4 → ceec19abb0
- `random-online-2chip` (2 chip): baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0, 223.8
  tok/s → 126.9 tok/s (-43.3%), commit e18643f8a4 → ceec19abb0
- `random-online-4chip` (4 chip): baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0, 213.9
  tok/s → 128.1 tok/s (-40.1%), commit e18643f8a4 → ceec19abb0
- `random-online` (1 chip): 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86) →
  v0.20.1rc0-535-gceec19abb0, 229.2 tok/s → 166.9 tok/s (-27.2%), commit 7a63f81e86 → ceec19abb0
- `sharegpt-online-4chip` (4 chip): baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0, 157.7
  tok/s → 116.0 tok/s (-26.4%), commit e18643f8a4 → ceec19abb0

## 按 workload 逐项检查

### agent-research-online

- Records: 9; engines: vllm=1, vllm-hust=8
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - 1 chip / single_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### agent-research-online-2chip

- Records: 3; engines: vllm=1, vllm-hust=2
- Sudden performance drops:
  - 2 chip / multi_gpu: baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0; throughput 132.7
    tok/s → 110.8 tok/s (-16.5%); commits e18643f8a4 → ceec19abb0; TTFT 294.8 ms → 7,076.8 ms.
- Missing data / broken-line risks:
  - 2 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### agent-research-online-4chip

- Records: 2; engines: vllm=1, vllm-hust=1
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - 4 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### instructcoder-online

- Records: 8; engines: vllm=1, vllm-hust=7
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - 1 chip / single_gpu: missing 3 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); 7a63f81 (7a63f81e86);
    0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### prefix-repetition-online

- Records: 10; engines: vllm=1, vllm-hust=9
- Sudden performance drops:
  - 1 chip / single_gpu: baseline 0.18.0 (e18643f8a4) → 0.20.1rc1.dev314+g64ff561c7.d20260505
    (7fa0e3ed4b); throughput 199.7 tok/s → 25.26 tok/s (-87.3%); commits e18643f8a4 → 7fa0e3ed4b.
- Missing data / broken-line risks:
  - 1 chip / single_gpu: missing 3 intermediate version point(s): v0.20.1rc0-441-g2206f1f7b
    (2206f1f7b7); 7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### prefix-repetition-online-2chip

- Records: 3; engines: vllm=1, vllm-hust=2
- Sudden performance drops:
  - 2 chip / multi_gpu: baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0; throughput 218.1
    tok/s → 108.5 tok/s (-50.3%); commits e18643f8a4 → ceec19abb0; TTFT 344.8 ms → 107,559.0 ms.
- Missing data / broken-line risks:
  - 2 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### prefix-repetition-online-4chip

- Records: 2; engines: vllm=1, vllm-hust=1
- Sudden performance drops:
  - 4 chip / multi_gpu: baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0; throughput 216.2
    tok/s → 118.3 tok/s (-45.3%); commits e18643f8a4 → ceec19abb0; TTFT 354.6 ms → 88,196.3 ms.
- Missing data / broken-line risks:
  - 4 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### random-latency

- Records: 6; engines: vllm=1, vllm-hust=5
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - Metric-null gap: `throughput` is missing in 5/6 record(s); affected engines: {'vllm': 1,
    'vllm-hust': 4}.
  - Metric-null gap: `TPOT` is missing in 6/6 record(s); affected engines: {'vllm': 1, 'vllm-hust':
    5}.

### random-online

- Records: 12; engines: vllm=1, vllm-hust=11
- Sudden performance drops:
  - 1 chip / single_gpu: 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86) →
    v0.20.1rc0-535-gceec19abb0; throughput 229.2 tok/s → 166.9 tok/s (-27.2%); commits 7a63f81e86 →
    ceec19abb0; TTFT 317.9 ms → 40,885.2 ms.
- Missing data / broken-line risks:
  - 1 chip / single_gpu: missing 3 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86).
  - 1 chip / single_gpu: incomplete engine pair; missing vllm baseline (present: {'vllm-hust': 1}).

### random-online-2chip

- Records: 3; engines: vllm=1, vllm-hust=2
- Sudden performance drops:
  - 2 chip / multi_gpu: baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0; throughput 223.8
    tok/s → 126.9 tok/s (-43.3%); commits e18643f8a4 → ceec19abb0; TTFT 338.3 ms → 82,787.1 ms.
- Missing data / broken-line risks:
  - 2 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### random-online-4chip

- Records: 2; engines: vllm=1, vllm-hust=1
- Sudden performance drops:
  - 4 chip / multi_gpu: baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0; throughput 213.9
    tok/s → 128.1 tok/s (-40.1%); commits e18643f8a4 → ceec19abb0; TTFT 338.3 ms → 83,971.9 ms.
- Missing data / broken-line risks:
  - 4 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### sharegpt-online

- Records: 9; engines: vllm=1, vllm-hust=8
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - 1 chip / single_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### sharegpt-online-2chip

- Records: 3; engines: vllm=1, vllm-hust=2
- Sudden performance drops:
  - 2 chip / multi_gpu: baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0; throughput 157.3
    tok/s → 120.1 tok/s (-23.7%); commits e18643f8a4 → ceec19abb0; TTFT 295.8 ms → 40,394.0 ms.
- Missing data / broken-line risks:
  - 2 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### sharegpt-online-4chip

- Records: 2; engines: vllm=1, vllm-hust=1
- Sudden performance drops:
  - 4 chip / multi_gpu: baseline 0.18.0 (e18643f8a4) → v0.20.1rc0-535-gceec19abb0; throughput 157.7
    tok/s → 116.0 tok/s (-26.4%); commits e18643f8a4 → ceec19abb0; TTFT 307.2 ms → 44,291.4 ms.
- Missing data / broken-line risks:
  - 4 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### sharegpt-throughput

- Records: 8; engines: vllm=1, vllm-hust=7
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - Metric-null gap: `TTFT` is missing in 8/8 record(s); affected engines: {'vllm': 1, 'vllm-hust':
    7}.
  - Metric-null gap: `TPOT` is missing in 8/8 record(s); affected engines: {'vllm': 1, 'vllm-hust':
    7}.
  - 1 chip / single_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### sonnet-throughput

- Records: 10; engines: vllm=1, vllm-hust=9
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - Metric-null gap: `TTFT` is missing in 9/10 record(s); affected engines: {'vllm': 1, 'vllm-hust':
    8}.
  - Metric-null gap: `TPOT` is missing in 10/10 record(s); affected engines: {'vllm': 1,
    'vllm-hust': 9}.
  - 1 chip / single_gpu: missing 3 intermediate version point(s): v0.20.1rc0-441-g2206f1f7b
    (2206f1f7b7); 7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### sonnet-throughput-2chip

- Records: 4; engines: vllm=1, vllm-hust=3
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - Metric-null gap: `TTFT` is missing in 4/4 record(s); affected engines: {'vllm': 1, 'vllm-hust':
    3}.
  - Metric-null gap: `TPOT` is missing in 4/4 record(s); affected engines: {'vllm': 1, 'vllm-hust':
    3}.
  - 2 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### sonnet-throughput-4chip

- Records: 4; engines: vllm=1, vllm-hust=3
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - Metric-null gap: `TTFT` is missing in 4/4 record(s); affected engines: {'vllm': 1, 'vllm-hust':
    3}.
  - Metric-null gap: `TPOT` is missing in 4/4 record(s); affected engines: {'vllm': 1, 'vllm-hust':
    3}.
  - 4 chip / multi_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).

### visionarena-online

- Records: 5; engines: vllm=1, vllm-hust=4
- Sudden performance drops: none found at the 15% throughput-drop threshold.
- Missing data / broken-line risks:
  - 1 chip / single_gpu: missing 4 intermediate version point(s):
    0.20.1rc1.dev314+g64ff561c7.d20260505 (7fa0e3ed4b); v0.20.1rc0-441-g2206f1f7b (2206f1f7b7);
    7a63f81 (7a63f81e86); 0.20.1.post1.dev893+g0449311c.dirty (7a63f81e86).
