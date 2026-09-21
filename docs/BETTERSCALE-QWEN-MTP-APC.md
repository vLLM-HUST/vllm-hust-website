# Qwen MTP2: lookahead-aware prefix reuse / 前瞻感知前缀复用

## Mechanism / 机制

Draft KV at position `i` depends on target `hidden[i]` and `token[i+1]`. An ordinary block hash
ending at boundary `B` does not cover `token[B]`. Removing the inherited EAGLE/MTP last-block
retreat without changing cache identity could reuse draft state across different continuations.

The BetterScale prototype adds one tagged lookahead token to the chained cache identity, preserving
native extra keys including cache salt. A block is published only when that token is known. It uses
this stricter identity across cache groups, removes the corresponding whole-block lookup and
prefill-split retreat, and explicitly feeds the next known prompt token to draft at
incomplete-prefill boundaries. Ordinary speculative scheduling remains enabled. No hidden-state side
cache or arbitrary-token GDN rollback is introduced.

位置 `i` 的 draft KV 同时依赖 target `hidden[i]` 和 `token[i+1]`。在 `B` 结束的普通块 hash 没覆盖 `token[B]`，因此不能直接删除
EAGLE／MTP 的退块保护。原型把一个带标记的前瞻 token 加入链式缓存身份，保留 cache salt 等原生附加键，等前瞻 token 已知后才发布缓存。
各缓存组采用这个更严格的身份，移除相应的整块查找／prefill 分块回退，并显式补齐分块 prefill 边界的 draft 输入。没有新增 hidden-state 旁路缓存，也不支持任意
token 位置的 GDN 状态回滚。后续 token 不同的请求仍回退至更早 checkpoint。

## Measurements / 测量

Both arms are BetterScale TP2 MTP2 candidates, not native vLLM. Qwen3.8-27B, APC align on, 6 GiB KV
budget, 2048 scheduled-token budget, 4096 context ceiling and eight request seats. Same hardware
pair, separate runs on September 20, 2026; not interleaved. Synthetic shared prefixes have
`3073 + 8*i` input tokens and 64 output tokens per request. Each C1/C4/C8 has one warm-up cohort and
three measured cohorts, with no profiler during timing. Throughput is total output tokens divided by
cohort elapsed time, including prefill; reported values are medians. TTFT is the median across
measured requests.

两臂均为 BetterScale TP2 MTP2 candidate，并非原生 vLLM。配置与请求相同，在同一对卡上 同日先后测量，非交错控制。每个并发预热一组、测量三组；测速期间不开
profiler。输出 吞吐是整组输出 token 数除以整组耗时，包含 prefill；TTFT 为所测请求的中位数。

| Concurrency / 并发 | Before / 修复前 (output tok/s) | After / 修复后 | Ratio / 倍率 | TTFT before → after (ms) |
| ------------------ | -----------------------------: | -------------: | -----------: | -----------------------: |
| 1                  |                          41.07 |          58.51 |        1.42× |          585.68 → 111.41 |
| 4                  |                          79.30 |         193.36 |        2.44× |         1444.43 → 172.04 |
| 8                  |                         104.38 |         305.92 |        2.93× |         2511.82 → 269.56 |

The intended change is cached work: each cohort request reuses 3072 rather than 1536 prefix tokens.
This is a service-configuration improvement, not isolated MTP kernel speedup. These numbers do not
revise the existing step curves or SWE study.

减少未命中的 prefill 工作正是本次优化目标：每个 cohort 请求复用 3072，而非 1536 个前缀 token。这是服务配置的改善，不是孤立 MTP 算子的加速；不修改既有 step
曲线或 SWE 实验。

## Validation and limits / 验收与边界

At each boundary, test cold, identical warm, changed first suffix token warm, then changed suffix
cold. Observed prefix-hit sequences are `[0,1536,0,0]` and `[0,3072,1536,0]`. Cold/warm generated
text matches for both identical and divergent continuations. All 52 warm-up/measured cohort requests
then hit 3072 tokens. The service exits successfully and 109 CPU tests pass, including delayed hash
publication, lookahead isolation, incremental chaining and salt isolation.

两个边界分别测试冷缓存、相同后续热缓存、改变首个后续 token 的热缓存、以及分叉后的冷 缓存。命中序列分别为 `[0,1536,0,0]` 与
`[0,3072,1536,0]`；相同与分叉后续的冷／热生成 文本均一致。之后全部 52 个预热／测速请求命中 3072 tokens。服务正常退出，109 项 CPU
测试通过，包括延迟发布、前瞻隔离、增量链和 salt 隔离。

This is a bounded, explicit opt-in MTP2 prototype, not released product admission. Text equality is
not exhaustive numerical-state equivalence. Multimodal, LoRA, resumable input, external cache
connectors, cancellation and preemption are not qualified here. Larger MTP counts are not admitted
by this result; a separate K3 FIA service failure remains unresolved. No SWE accuracy, official
leaderboard or universal speedup claim is made.

这是有界、显式 opt-in 的 MTP2 原型，并非已发布产品的验收。文本一致不能代替穷尽的 数值状态等价验证。本次不覆盖多模态、LoRA、可续传输入、外部缓存连接、取消或抢占。 更大 MTP
数量不在本次结论内；独立的 K3 FIA 服务故障尚未解决。不作 SWE 准确率、官方 排行榜或普遍加速承诺。

## Evidence / 证据

[Public measurement snapshot / 测量摘要](../data/betterscale-qwen-mtp-apc.json) includes all nine
measured cohorts per arm, ranges and checks. Retained capsule IDs:
`mtp-count-service-20260920-v2/candidate-k2` → `mtp-apc-20260920-v4/candidate-k2`. These are
experiment identities, not released Git commits or download links.
