# Qwen MTP2: device continuation / 设备端异步续跑

## Original path and intervention / 原始路径与介入点

Native execution already captures target and merged draft separately. The remaining dependency was
between iterations: receive accepted-token counts on CPU, remap them, decide APC state placement,
correct CPU sequence lengths, then prepare the next target. Merely recording more forward operators
does not remove that feedback dependency.

原生路径已有独立的 target 与合并 draft 图。剩余依赖在轮次之间：CPU 回收接受数量、重排请求、决定 APC 状态位置、修正 CPU 序列长度，然后才能准备下一轮 target。
只把更多 forward 算子录进图，不能消除这个反馈依赖。

The prototype retains native admission, sampling and the two-outstanding-batch async queue. At the
existing runner preparation/postprocess seams, device tensors own accepted-state selection and
actual token progress. GDN operates directly on its state pool. Target and draft FIA receive actual
device sequence lengths; CPU metadata describes the planning envelope, not the authoritative length.
Draft resources are indexed by shape, bank and draft position. Pinned metadata publication and
device events protect reuse without waiting for an accepted-count CPU round trip.

原型保留原生请求准入、采样与最多两批在途的异步队列，在 runner 已有准备／后处理接口接管设备端状态选择和真实 token 进度。GDN 直接操作状态池；target 与 draft FIA
读取设备端真实长度，CPU 元数据只描述规划包络。Draft 资源按形状、bank 和 draft 位置区分，固定页元数据发布及设备事件保障复用，不再依赖接受数量的 CPU 往返。

Raw accepted progress, APC-reset state selection and emitted-token count are distinct quantities.
Migration must not reset logical progress. Canonical request state is separate from ping-pong
metadata banks. The pinned Ascend backend's field named `seq_lens` is a CPU mirror: the prototype
explicitly carries the genuine device tensor from `CommonAttentionMetadata` instead.

真实接受进度、APC 迁移后重置的状态选择、实际输出数量是不同的量，不能混用。请求的正式状态也不等于双 bank 元数据。固定版本 Ascend 后端的 `seq_lens` 字段实际是 CPU
镜像；原型显式传递 `CommonAttentionMetadata` 的设备张量，避免名称相同导致错用。

## Short-profile attribution / 短 profile 归因

Same TP2/MTP2 candidate, before versus after removing CPU length feedback; **not native baseline**.
Six captured steps per rank, five draft-to-next-target seams, synthetic C8 workload. Values below
are rank0 means; both ranks and observations are retained in the measurement snapshot.

同一 TP2／MTP2 candidate，移除 CPU 长度反馈前后对照，**不是原生 baseline**。合成 C8 负载，每 rank 捕获六步、五个 draft 至下一轮 target
接缝；表中为 rank0 均值，数据摘要保留双 rank 和各次观测。

| Phase / 阶段 | Before seam / 改前接缝 (ms) | After seam / 改后接缝 (ms) | Target-start period / target 起点周期 (ms) |
| ------------ | --------------------------: | -------------------------: | -----------------------------------------: |
| Decode       |                       8.947 |                      1.042 |                            59.133 → 51.116 |
| Mixed        |                       8.972 |                      1.121 |                            77.414 → 70.045 |

Target/draft graph duration stays approximately unchanged. Native task-update begin/end pairs fall
from 12 to zero in each six-step profile. Wave FIA planning APIs remain. The remaining seam is
largely covered by kernels/copies; coverage does not establish that all of it is unavoidable.
Profiled intervals are not unprofiled throughput, and their percentages must not be added to
end-to-end gains.

Target／draft 图本体耗时基本不变；每组六步 profile 的原生 task-update begin/end 从 12 对降为零。Wave FIA 规划调用仍存在。剩余接缝主要被
kernel／copy 覆盖，但这不证明所有开销都不可优化。Profile 区间不是无 profiler 的服务吞吐，百分比不能与端到端收益相加。

## End-to-end acceptance method / 端到端验收方法

Qwen3.8-27B, Ascend 910B2 TP2, BF16, MTP2, prefix caching on, native AIV on both arms, 6 GiB KV
budget, 2048-token scheduling budget, eight request seats and 8192-token context. Donors: vLLM
`752a3a504485790a2e8491cacbb35c137339ad34`, vLLM-Ascend `9bf964cb4b87c8cd0d6852c41a55b3c29711fa95`.

Native baseline includes only the required SD/V1 Mamba ABI bridge. Candidate includes the
accumulated BetterScale execution changes, lookahead-aware APC and device continuation; this is a
full-stack comparison, **not the isolated causal effect of async scheduling**. Native and candidate
can reuse different prefix amounts; report observed cached tokens rather than implying identical
prefill work.

原生 baseline 只补充必需的 SD／V1 Mamba ABI 桥接。Candidate 包含累积的 BetterScale 执行优化、前瞻感知 APC
和设备端续跑；这是整套方案对比，**不是异步调度单项的因果增益**。 两臂可能复用不同数量的前缀，必须报告实际命中数，而不能暗示 prefill 工作量相同。

Reuse eight complete selected Open-SWE-Traces sessions (78 requests / 20,648 output tokens per
cohort), recorded original histories and response-token budgets. Tool calls stay inert, no recorded
arrival timing is inferred, and generated responses do not replace the next recorded history. Same
physical pair, ABBA service order, C1/C2/C4/C8 then reversed concurrency order on the second repeat.
Warm complete first turns before measurements; clear caches before every cohort. No profiler in
timing. Output tokens/s divides output tokens only by whole-cohort wall time, including prefill and
queueing. TTFT and per-request average TPOT are HTTP measurements, not SSE-gap percentiles.

复用八条完整的已选 Open-SWE-Traces 轨迹，每组 78 请求、20,648 输出 tokens；使用原始历史和记录的回复长度，不执行工具，也不把生成回复替换进后续历史。 同一对卡按
ABBA 顺序启动服务，测 C1／C2／C4／C8，第二轮逆序；先预热完整首轮请求，每组测量前清缓存，测速不启 profiler。吞吐分子仅为输出 tokens，分母含 prefill
与排队的整组耗时。TTFT 与每请求平均 TPOT 来自 HTTP，不是 SSE chunk 间隔分位数。

## End-to-end results / 端到端结果

All four services pass and exit0. Every cohort completes all78requests/20,648outputs;1248timed
requests total. Throughput below is pooled across two observations (sum outputs / sum elapsed), not
the arithmetic mean of rates. Native variability remains visible. This comparison is MTP2 on BOTH
arms; it does not establish that MTP2 beats MTP-off at every concurrency.

四次服务均通过并正常退出，每组全部78请求／20,648输出完成，共1248个计时请求。吞吐按两次总输出除以总耗时合并，非两次速率的算术平均。保留原生波动；两臂均启用MTP2，不证明每个并发下MTP2都优于关闭MTP。

| C   | Native output tok/s | Candidate |    Gain | Native repeats  | Candidate repeats |
| --- | ------------------: | --------: | ------: | --------------- | ----------------- |
| 1   |               51.30 |     69.61 | +35.70% | 52.21 / 50.41   | 69.63 / 69.58     |
| 2   |               76.60 |    111.49 | +45.54% | 79.49 / 73.92   | 111.55 / 111.43   |
| 4   |              107.81 |    170.60 | +58.24% | 104.82 / 110.96 | 170.65 / 170.54   |
| 8   |              107.42 |    140.64 | +30.92% | 99.56 / 116.63  | 140.53 / 140.74   |

| C   | Mean TTFT native → candidate (ms) | Mean per-request TPOT (ms) | Cached tokens native / candidate (both repeats) |
| --- | --------------------------------- | -------------------------- | ----------------------------------------------- |
| 1   | 1076.97 → 502.31                  | 15.51 → 12.51              | 294912 / 494592                                 |
| 2   | 1365.14 → 612.69                  | 20.20 → 14.98              | 294912 / 494592                                 |
| 4   | 1453.98 → 691.34                  | 30.27 → 19.86              | 294912 / 494592                                 |
| 8   | 2374.87 → 1786.52                 | 56.06 → 42.67              | 84480 / 136704                                  |

[Measurement snapshot / 测量摘要](../data/betterscale-qwen-mtp-async.json) retains both ranks’ profile
seams, all service repetitions, latency percentiles and fixture identities. Service capsule:
`mtp-swe-acceptance-20260921`; profile controls: `mtp-device-apc-service-20260921-v4` →
`mtp-device-length-service-20260921-v3`. These are frozen experiment identities, not released Git
commits. Dataset: [NVIDIA Open-SWE-Traces](https://huggingface.co/datasets/nvidia/Open-SWE-Traces),
CC-BY-4.0, revision `fb0c0dccc7a5cce79b3f6de891848acdede36685`, `data/minisweagent/qwen38_27b`.

## Scope / 边界

This remains an explicit MTP2 prototype, not a released-wheel/default-path claim. Target and merged
draft are separate FULL graphs; sampling, logits and metadata are not one monolithic captured
transaction. The prior strict cold/warm and divergent-continuation checks passed at 1536/3072 cache
boundaries; 123 CPU tests passed. These are bounded checks, not exhaustive numerical equivalence.
K3/K4, multimodal, LoRA, external cache connectors, cancellation and preemption are not qualified.
This is serving performance, not SWE task accuracy, a universal speedup or official leaderboard
data. Existing non-MTP curves and installation commands retain their original meaning.

仍是显式 MTP2 原型，不代表已发布 wheel 或默认路径。Target 与合并 draft 分别 FULL capture，采样、logits 和元数据并未成为一张整体图。此前
1536／3072 缓存边界的冷／热与分叉续写对照通过，123 项 CPU 测试通过，但不构成穷尽数值等价证明。不覆盖 K3／K4、多模态、LoRA、外部缓存连接、取消或抢占。 这是服务性能，不是
SWE 任务准确率、普遍加速承诺或官方榜单成绩；既有非 MTP 曲线与安装命令的含义不变。

## C8 observation, outside this increment / C8 观察，不在本轮修复范围

Both arms show fewer prefix hits at C8; candidate throughput is lower than at C4, while native C8
repeats vary. A candidate explanation is request eviction followed by rescheduling without restored
reusable cache state, requiring more recomputation. The throughput/hit counters alone do not
establish that sequence or diagnose a KV restore defect. Retain the observation, but defer
eviction/recovery investigation to a separate study.

两臂在 C8 均出现前缀命中减少；candidate 吞吐低于 C4，原生 C8
两次观测有波动。一个待查解释是请求被驱逐后，重调度时尚未恢复可复用缓存状态，因而增加重算。单凭吞吐和命中计数不能证明这条事件链，也不能断定 KV
恢复有缺陷。本轮记录现象，不展开驱逐／恢复问题的调查或优化。
