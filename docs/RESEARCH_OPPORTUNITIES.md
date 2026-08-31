# vLLM-HUST / vLLM-Ascend-HUST 研究机会总表

> 更新时间：2026-07-30\
> 范围：此前在性能排行榜、真实 NPU 实验、PR 审核、回归定位、KV/状态管理和 Ascend 运行时适配中发现的问题。\
> 注意：这里的“研究机会”表示问题具备形成论文或独立研究项目的潜力，不表示 新颖性已经通过完整文献检索，也不表示当前性能现象已经完成因果归因。
>
> 组织边界：`vLLM-HUST` 公开站点只展示工程缺陷、成熟机制集成、历史来源和已经公开的研究入口。尚处于内部孵化阶段的课题保留名称与研究范围，但不公开仓库地址。

## 1. 如何使用这份表

每个候选都按以下问题筛选：

1. **问题是否可界定、可证伪？**
1. **是否对应真实瓶颈，而非页面或配置错误？**
1. **现有实现是否存在共同的隐藏假设？**
1. **能否提出一般化机制，而非只修一个版本的 bug？**
1. **能否在 vllm-hust / vllm-ascend-hust 或独立插件中实现最小原型？**
1. **能否设计 baseline、机制指标、消融和负结果边界？**
1. **成功后能否形成一句明确的知识增量？**

优先级含义：

- **P0：研究就绪。** 已有直接观测、代码入口和明确实验路径。
- **P1：高潜力。** 问题重要，但需要先完成 M0 复现或机制 profiling。
- **P2：探索型。** 可能形成工作，但必须先做文献去重和小规模可行性验证。

成熟度含义：

- **已有研究 issue**：已经建立研究级 GitHub issue。
- **有机制/故障证据**：已经有 audit、trace、PR 或真实 NPU 现象。
- **概念候选**：尚未建立专门研究 issue。

## 2. 总体判断

当前最有价值的研究线索不是“某个算子再快几个百分点”，而是以下五类系统性 矛盾：

1. **Ascend 图执行与动态服务形态冲突。** LLM serving 的 batch、prefill/decode、 KV 状态和并行拓扑持续变化，而图捕获、算子融合和静态
   workspace 偏好稳定形态。
1. **多卡扩展受控制面、元数据和拓扑共同限制。** 单卡 kernel 变快后，host、 collective、metadata 和 rank skew 更容易成为主导瓶颈。
1. **KV 不再只是显存数组，而是带生命周期、精度、所有权和未来价值的状态。** 量化、复制、前缀共享、offload 和恢复若没有统一状态契约，会出现正确性与性能 同时失效。
1. **Agent/workflow 的未来执行结构没有进入 serving 决策。** 传统 request-level FCFS、LRU 和静态 batching
   无法利用暂停、恢复、分支、共享前缀和工具等待。
1. **稀疏性能历史无法支持可靠因果结论。** 需要状态反馈、机制不变量、统计门禁 和研究型 benchmark，而不仅是补更多折线点。

## 3. 优先推荐的研究组合

| 组合 | 建议题目                                    | 可合并的候选        | 适合形成的成果                          |
| ---- | ------------------------------------------- | ------------------- | --------------------------------------- |
| R1   | 面向动态 LLM Serving 的 Ascend 图执行运行时 | A4、A5、A16、A17    | 图执行/动态 shape/能力感知的完整系统    |
| R2   | 面向 Ascend 多卡推理的分阶段拓扑与通信协同  | A1、A2、A3、A10     | 多卡扩展系统与可解释 scaling model      |
| R3   | 面向国产算力的 KV 状态平面                  | A7、A8、A9、A12、B3 | 量化、传输、分层、生命周期联合系统      |
| R4   | Ascend MoE 动态执行与控制面                 | A13、A15、A6        | EPLB、专家卸载、图重放与 workspace 协同 |
| R5   | 面向 Agent 工作流的状态感知推理服务         | B1、B2、B3、B6、B7  | workflow-aware scheduler/state manager  |
| R6   | 可证伪的推理性能工程方法学                  | C1、C2、C3、C4      | benchmark、归因与统计门禁方法           |

不建议把一个组合内的所有机制一次性打包实现。正确做法是先完成共同的 M0/M1 测量契约，再选择最强的一个因果链进入 M2 原型。

______________________________________________________________________

# 第一部分：Ascend 架构与运行时

## A1. 经真实测量校准的 Ascend Serving Roofline

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **现象：** 单卡 online TBT 聚集在约 31–36 ms；Sonnet 从 1 卡到 2 卡几乎不扩展， 4 卡线性效率一度只有约
  34%；当前无法区分算力、HBM、互联、host、图编译和 workload generator 上限。
- **研究问题：** 能否建立按 prefill、decode、collective、host 和 arrival 分阶段 的可校准 cost model，并用预测残差发现隐藏同步和实现缺陷？
- **核心机制：** kernel/内存/collective microbench 参数化，结合 phase trace 和 workload arrival model 形成带置信区间的
  serving roofline。
- **关键实验：** Qwen 7B/14B，1/2/4/8 卡；不同 ISL/OSL、batch、并发与 request rate；out-of-sample 预测误差和残差诊断。
- **成功条件：** 主要 workload 的阶段耗时和扩展趋势可被模型解释；模型能提前 判断优化应落在 kernel、内存、通信还是 host。
- **预期知识增量：** Ascend LLM serving 的瓶颈不能只用 FLOPs roofline 解释， 必须联合动态批处理、图执行和通信阶段建模。

## A2. 拓扑感知的多卡并行与分阶段通信策略

- **优先级/成熟度：** P0；研究入口（链接未公开）， 直接回归证据见
  [#145](https://github.com/vLLM-HUST/vllm-ascend-hust/issues/145)。
- **现象：** 2 卡 online workload 曾出现 41.5%–47.7% 吞吐下降，4 卡 TTFT 达到数秒至数十秒；固定 TP 和 rank placement 很可能与实际
  HCCS/PCIe 拓扑、 消息尺寸和 prefill/decode 阶段不匹配。
- **研究问题：** 能否按硬件拓扑、消息规模和请求阶段动态选择 TP/PP/DP、rank placement、collective 与 overlap 策略？
- **核心机制：** topology detector、分阶段通信 cost model、消息分桶与策略选择器。
- **关键实验：** all-reduce/all-gather/all-to-all/P2P；TP/PP/DP 及混合并行； arrival-unlimited 与 production-rate
  两类 workload。
- **成功条件：** 至少两类 workload 的 4 卡效率显著提高，或用机制证据证明已接近 物理上限；不能靠减少请求或改变有效配置换取数字。
- **预期知识增量：** LLM serving 的最佳并行策略是 phase- and topology-dependent， 而不是模型级静态配置。

## A3. 分布式元数据的增量同步、压缩与计算重叠

- **优先级/成熟度：** P0；研究入口（链接未公开）， 相关入口包括 Ascend
  [PR #33](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/33)。
- **现象：** DP、scheduler、KV block table、EPLB 等小型控制元数据需要频繁同步； 它们带宽不大，却容易制造 host/device barrier 和尾延迟。
- **研究问题：** 能否只同步变化量，并将序列化、传输和应用与 device execution 重叠，同时保持 rank 间一致性？
- **核心机制：** versioned delta、结构化压缩、异步 apply、staleness budget 和 correctness invariant。
- **关键实验：** DP2/DP4/DP8、不同请求 churn、block-table 变化率和 MoE rebalance 频率；报告 bytes/step、barrier time、rank
  skew 与 p99。
- **成功条件：** metadata stall 明显降低，且任何 rank 不产生状态分叉。
- **预期知识增量：** 小控制消息的关键成本是同步语义和 barrier，而非原始带宽。

## A4. 图安全的动态执行：捕获、重放与状态突变

- **优先级/成熟度：** P0；有多次故障证据，尚应建立统一研究 issue。
- **现象：** FULL graph 曾因 `ContextVar.get()`、Python 容器状态、动态 shape、 residual mutation 和可选算子路径失败；历史问题散落在
  core [PR #123](https://github.com/intellistream/vllm-hust-legacy-20260831/pull/123)、 Ascend
  [PR #125](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/125)、
  [PR #131](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/131) 等工作中。
- **研究问题：** 能否把动态 serving 状态转换成可捕获的显式 tensor/state machine， 并在 shape、batch role 和 KV
  生命周期变化时选择安全的图粒度？
- **核心机制：** graph-safe state IR、capture eligibility predicate、bucket lifecycle、 selective recapture
  和 correctness-preserving fallback；正式结果不得回退 eager。
- **关键实验：** prefill/decode 混合、empty/padded batch、256/257 等 shape 边界、 prefix hit、offload、spec
  decode、DP/PP。
- **成功条件：** 扩大 graph coverage，同时把 recapture、compile 和错误恢复成本 控制在可解释范围；对不安全状态 fail closed。
- **预期知识增量：** 动态 LLM serving 的图执行需要状态语义感知，而非只按 tensor shape 建 bucket。

## A5. Shape-Adaptive Attention Boundary 与 Dispatch

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **现象：** host helper 在小 batch 可有数倍微基准收益，但真实 NPU serving 可能 反而下降；256/257、PCP full lengths 和 graph
  padding 还存在不同边界行为。
- **研究问题：** 能否根据 batch shape、prefill/decode composition、graph bucket 和 host/device 开销，动态选择 attention
  metadata 与 dispatch 路径？
- **核心机制：** shape classifier、低开销特征、路径 cost model 和边界一致性校验。
- **关键实验：** request count 1–4096、混合 prefill/decode、PCP/DCP/DP、图 padding； helper microbench 与端到端
  serving 必须同时报告。
- **成功条件：** 不仅 helper 变快，而且至少两个真实 shape 区间端到端收益稳定； 边界正确性 100%。
- **预期知识增量：** host-side 快路径只有在跨越完整 dispatch 边界后才可能成为 serving 优化，静态阈值通常不足。

## A6. Persistent Workspace、Buffer Lifetime 与自适应复用

- **优先级/成熟度：** P1；研究入口（链接未公开）。
- **现象：** 反复分配/清零 workspace 可能浪费时间，但 OProj receive-buffer reuse 在当前 main 的 4-NPU A/B 中曾出现 6%–12%
  负优化，说明“复用一定更快”不成立。
- **研究问题：** 哪些 operator、shape 和并发条件下 workspace 复用有净收益？如何 同时处理初始化语义、跨 stream 生命周期、峰值内存和并发冲突？
- **核心机制：** lifetime-aware workspace pool、zero-initialization contract、 shape/version tagging 和
  cost-based reuse admission。
- **关键实验：** attention、MoE、all-to-all、quant kernel；不同 shape churn、 stream 数、复用距离和内存压力。
- **成功条件：** 给出收益/负收益边界和自动决策规则，而不是永久开启一个缓存。
- **预期知识增量：** accelerator workspace reuse 是带生命周期与机会成本的决策， 不是简单内存池问题。

## A7. 融合量化 KV Decode，突破带宽型 TBT 下限

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **现象：** decode TBT 形成 31–36 ms 平台；分离的 KV 反量化、layout conversion 和 attention 可能重复搬运并产生 graph
  boundary。
- **研究问题：** 能否把 packed KV 读取、scale/min 应用、layout 变换和 attention 融合为 Ascend 原生 decode 路径？
- **核心机制：** quantized-cache-native attention layout、on-the-fly dequant、 vectorized scale metadata 和
  graph-safe fused kernel。
- **关键实验：** FP16/INT8/INT4，不同 head size、context、batch、GQA/MLA； HBM bytes/token、kernel 数、TBT、质量。
- **成功条件：** 相同质量约束下显著减少 KV bytes/token 和 kernel launch，端到端 TBT 稳定改善。
- **预期知识增量：** KV 量化的主要价值只有在 decode kernel 原生消费 packed layout 时才能兑现。

## A8. SLO/质量约束下的自适应混合精度 KV

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **现象：** FP16/INT8/INT4/FP4 统一精度忽略 layer、token age、reuse probability 和内存压力差异。
- **研究问题：** 能否在线选择 per-layer/per-block KV 精度，在质量、容量、 带宽和 SLO 间形成更优 Pareto？
- **核心机制：** sensitivity profile、age/reuse-aware precision controller、 migration policy 与质量
  guardrail。
- **关键实验：** 32K/128K、prefix、agent session、内存压力阶梯；质量、容量、 TTFT/TPOT 和 migration cost。
- **成功条件：** 相同质量下容量显著提升，且 TPOT 不出现不可接受回退。
- **预期知识增量：** KV 精度应作为运行时状态决策，而不是模型加载时常量。

## A9. KIVI/分组量化的块级残差所有权与可迁移生命周期

- **优先级/成熟度：** P0；有固定 pair audit 证据，尚未建立独立研究 issue。
- **现象：** KIVI 新est residual 当前可能是 request-local；block 被 prefix sharing、 copy 或 offload 后，packed
  page 与 residual 所有权分离，产生正确性风险。残差 还未计入 page sizing，并包含 graph-unsafe Python/host decisions。
- **研究问题：** 如何把量化残差建模为 block-owned、可复制、可 offload、可恢复且 可进入图执行的一级状态？
- **核心机制：** block-owned residual descriptor、publish-before-flush protocol、 transferable residual
  layout、memory accounting 和 graph-safe mutation。
- **关键实验：** prefix hit、block copy、CPU offload、sliding window、hybrid KV、
  TP/DP、capture/replay；continuation/teacher-forced 质量评测。
- **成功条件：** 所有状态迁移路径保持数值正确，memory sizing 无隐藏 OOM，量化 性能收益在正式 graph mode 成立。
- **预期知识增量：** 增量量化缓存的 residual 是分布式状态协议的一部分，而不是 request 私有临时量。

## A10. Pipeline Parallel Microbatch 的状态一致性与通信协同

- **优先级/成熟度：** P0；有 scheduler/worker block-table mismatch 和 alias 诊断证据，关联 core
  [PR #145](https://github.com/intellistream/vllm-hust-legacy-20260831/pull/145) 与 Ascend
  [PR #144](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/144)。
- **现象：** scheduler 回收/置空 external KV block 后，worker 可能保留旧表； microbatch layout 变化进一步影响状态同步、输出一致性和
  pipeline bubble。
- **研究问题：** 能否建立 scheduler-authoritative、增量同步的 PP 状态协议，并 联合决定 microbatch 大小、KV 生命周期和通信时机？
- **核心机制：** versioned block-table state machine、allocation/release event、 strict
  invariant、layout-aware verifier 和 pipeline schedule。
- **关键实验：** PP2/PP4、TP2、长输出、并发回收、external KV、不同 microbatch； token oracle、state trace、bubble 和吞吐。
- **成功条件：** 严格状态 invariant 全程成立，输出一致，并获得可解释的 pipeline 利用率改善。
- **预期知识增量：** PP serving 优化必须把调度布局与 KV 状态一致性作为同一个 协议问题处理。

## A11. Ascend 推测解码的 Draft/Verify/Accept 阶段协同

- **优先级/成熟度：** P0；Ngram 研究入口（链接未公开）， 历史工程回归见
  [core #58](https://github.com/vLLM-HUST/vllm-hust/issues/58)， 关联 core
  [PR #121](https://github.com/intellistream/vllm-hust-legacy-20260831/pull/121)、 Ascend
  [PR #123](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/123) 和
  [PR #135](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/135)。
- **现象：** Ngram/spec decode 曾出现约 3× TPOT 回退；接口可用不代表 draft、 verify、shape registration、accept 和
  fallback 的总成本有收益。
- **研究问题：** 能否按 acceptance、batch、draft length、graph shape 和设备 utilization 自适应选择 proposer 与阶段重叠策略？
- **核心机制：** online acceptance estimator、stage pipeline、shape registry、 fallback threshold 和
  target/draft resource allocation。
- **关键实验：** baseline/ngram/EAGLE/EAGLE3，多种 draft token、acceptance 和 workload；分解
  draft/verify/accept/sync 时间。
- **成功条件：** 在明确 acceptance 区间取得端到端收益，并公开无收益/负收益边界。
- **预期知识增量：** NPU 推测解码的收益条件由阶段协同和图形态共同决定，而不只是 少算 target token。

## A12. KV Transfer/Offload 的异步生命周期与调度协同

- **优先级/成熟度：** P0；关联 core [PR #49](https://github.com/intellistream/vllm-hust-legacy-20260831/pull/49)、
  [PR #124](https://github.com/intellistream/vllm-hust-legacy-20260831/pull/124)，Ascend
  [PR #67](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/67) 和 多个 transfer/offload PR。
- **现象：** event 被跨 step 复用、后台异常不可见、shutdown 未 drain、状态传输 与调度互不知情，会造成陈旧状态、隐藏失败和不可预测 stall。
- **研究问题：** 能否把 transfer event、ownership、completion、failure 和 reuse 统一成可观测状态机，并让 scheduler
  联合选择传输、重算和等待？
- **核心机制：** per-submission event、fail-fast health channel、draining shutdown、 transfer/recompute cost
  model 和 prefetch scheduling。
- **关键实验：** CPU↔NPU、不同 block 数、hit/miss、并发 store/load、取消/失败/ shutdown、不同带宽与 HBM 压力。
- **成功条件：** 正确性和资源回收 invariant 全部成立；可见 stall 和 tail latency 显著降低。
- **预期知识增量：** KV offload 是异步状态所有权协议与调度问题，不是单纯 memcpy。

## A13. Ascend MoE：EPLB 控制面、动态专家放置与图重放

- **优先级/成熟度：** P0；有强组件证据和 draft upstream PR，关联 Ascend
  [PR #36](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/36) 及 LatchMoE/专家卸载方向。
- **现象：** EPLB planner 和 `log2phy` 生成曾包含大量 Python/scalar 工作； tensorized 组件可获得数十倍提升，但端到端收益取决于
  rebalance 频率、专家迁移、 graph replay 和负载变化。
- **研究问题：** 能否联合优化专家放置、迁移计划、控制面计算和图重放，使动态 MoE serving 在负载漂移下保持低尾延迟？
- **核心机制：** incremental EPLB planning、vectorized mapping、migration budget、 expert hotness
  predictor、graph-compatible replay。
- **关键实验：** 不同 rank/expert/replica、真实 rebalance event、热点漂移、 专家卸载、graph on/off；update latency、step
  time、迁移量和 p99。
- **成功条件：** 控制面收益能穿透到真实 MoE workload，且没有迁移风暴或质量/ 正确性问题。
- **预期知识增量：** 动态 MoE 的主要瓶颈可能位于“控制面—迁移—图重放”闭环， 而非单个专家 kernel。

## A14. Vision-Language Serving 的异构流水重叠

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **现象：** VisionArena TTFT/TBT 可明显改善，但吞吐仍低于历史最好，提示 CPU preprocess、vision encoder、projector/prefill 和
  language decode 间存在 bubble。
- **研究问题：** 能否通过跨请求 overlap、shape-aware batching、双缓冲和视觉 embedding cache 提高混合图文吞吐？
- **核心机制：** phase pipeline、heterogeneous queue、分阶段 batching 和 cache。
- **关键实验：** 单图/多图、分辨率阶梯、纯文本混流、重复图像、不同并发。
- **成功条件：** 至少一类真实混合 workload 吞吐显著提高，p99 TTFT 不恶化。
- **预期知识增量：** VLM serving 的优化对象是异构阶段流水，而不是仅语言 token。

## A15. 稀疏—量化—MoE 的协同执行与 Ascend 原生算子

- **优先级/成熟度：** P1；关联 activation sparsity、量化仓库、Ascend
  [PR #150](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/150) 等工作。
- **现象：** 单独启用 sparsity 或 quantization 可能增加 layout conversion、 scale
  metadata、编译分支和负载不均衡；稀疏率不等于硬件有效加速。
- **研究问题：** 哪种 sparsity/precision/layout 组合能在 Ascend 上形成可融合、 可负载均衡的真实执行收益？
- **核心机制：** hardware-aligned sparse layout、mixed-precision expert/kernel selection、fused
  dequant-sparse compute 和 quality controller。
- **关键实验：** dense/TEAL/La RoSA、INT8/INT4、多档 sparsity、MoE expert skew； 质量、有效带宽、kernel utilization
  和端到端。
- **成功条件：** 形成完整质量—显存—吞吐 Pareto，证明收益来自硬件执行而非减少 有效工作量口径。
- **预期知识增量：** 稀疏与量化只有共同匹配硬件 layout 和动态负载时才可叠加。

## A16. 跨 Core/Ascend 的统一执行抽象与执行图建模

- **优先级/成熟度：** P1；关联 core [PR #42](https://github.com/intellistream/vllm-hust-legacy-20260831/pull/42) 和统一通信/执行工作。
- **现象：** executor、worker、model runner、parallel backend、graph capture 和 state transfer 的接口分散；硬件插件需要
  patch 共享路径才能表达新执行机制。
- **研究问题：** 能否建立显式 execution graph/contract，使设备能力、并行阶段、 状态依赖和异步事件成为可组合节点？
- **核心机制：** execution IR、capability interface、event/dependency graph、 backend lowering 和 runtime
  adaptation。
- **关键实验：** 至少承载图执行、KV transfer、spec decode 或 PP 中两种机制； 比较侵入性、调度开销和可移植性。
- **成功条件：** 新机制无需持续修改共享热路径，且抽象开销可忽略。
- **预期知识增量：** LLM serving 硬件适配需要状态与异步依赖感知的执行抽象， 传统 operator dispatch 不足。

## A17. 能力感知的图重写与算子可用性治理

- **优先级/成熟度：** P1；AddRMSNormBias 故障和
  [Ascend issue #149](https://github.com/vLLM-HUST/vllm-ascend-hust/issues/149) 提供直接证据。
- **现象：** 编译 pass 可能注册当前 CANN/opapi 不支持的 pattern；失败后不能用 eager fallback 掩盖。版本号本身也不能准确表达符号、custom
  extension 和 shape 能力。
- **研究问题：** 能否用细粒度 capability graph 驱动 pattern registration、 fusion selection 和安全降级？
- **核心机制：** symbol/kernel/shape capability probe、dependency predicate、 proof-carrying pass
  registration 和 fail-closed selection。
- **关键实验：** 不同 CANN/torch_npu/设备、符号组合、custom extension 和 graph mode；测 coverage、编译成功率、性能与误选择率。
- **成功条件：** 跨版本图编译成功率提高，且不因保守禁用损失大量性能。
- **预期知识增量：** 编译优化的可移植性需要 capability-level contract，而非粗粒度 版本白名单。

______________________________________________________________________

# 第二部分：状态、Agent 与服务调度

## B1. 低开销推理状态反馈面

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **问题：** TTFT/TBT/吞吐无法说明 queue、KV、batch shape、graph bucket、 transfer 和 device busy 中哪层发生变化。
- **假设/机制：** 稳定 state schema、correlation id、采样/聚合和 privacy-safe event stream，可在低于 1% 吞吐开销下支撑多个控制器。
- **实验：** telemetry off/counters/sampled/full trace；用 prefix #163、多卡 #145 做盲定位。
- **知识增量：** 自适应 serving 首先需要跨层状态契约，而不是每个策略各自插桩。

## B2. Agent-Aware KV 驱逐

- **优先级/成熟度：** P0；研究入口（链接未公开）， 机制入口为 BidKV。
- **问题：** LRU/LFU 不理解 tool pause、branch rollback、共享前缀和未来恢复。
- **假设/机制：** 用 workflow state、future reuse、recompute/transfer cost 和 SLO 联合估值，能减少错误驱逐和重复 prefill。
- **实验：** multi-turn agent、pause/resume、fork/join、memory pressure；offline oracle、online
  predictor、regret 和 p99。
- **知识增量：** Agent 场景的缓存价值是未来程序路径相关的，不等于 recency。

## B3. Agentic 状态的硬件感知分层与预取

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **问题：** KV、tool result、session state 和中间表示在 HBM/CPU/SSD 之间缺少 统一 placement/prefetch 决策。
- **假设/机制：** workflow phase 可比 recency 更好预测访问；联合 transfer、 recompute 和 wait cost 可优化状态放置。
- **实验：** HBM budget、带宽、prefetch depth、pause duration、并发与状态类型。
- **知识增量：** Agentic inference 的内存层次应由工作流状态和重算代价驱动。

## B4. Prefix/Chunk/共享状态索引与跨请求复用

- **优先级/成熟度：** P0；关联 Ascend [PR #66](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/66)、
  [#70](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/70)、
  [#80](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/80)，以及 prefix 回归
  [core #163](https://github.com/vLLM-HUST/vllm-hust/issues/163)。
- **问题：** exact full-prefix hash 难以表达 chunk reuse、分支共享、跨节点 ownership 和语义相关但非完全相同的上下文。
- **假设/机制：** 分层索引（exact block/chunk/semantic candidate）与成本感知验证， 可扩大安全复用范围。
- **实验：** repeated prefix、RAG chunks、agent branches、跨节点 routing；hit rate、 false reuse、验证成本、TTFT 和吞吐。
- **知识增量：** 共享状态选择层可以独立于底层 KV 存储，并支持多粒度复用。

## B5. KV Delta / 状态差分传输

- **优先级/成熟度：** P1；已有独立 `vllm-kvdelta-plugin`/segment reuse 探索。
- **问题：** 跨节点或跨层传输完整 KV 会重复搬运共享历史；量化、prefix 和 branch 让可复用部分更复杂。
- **假设/机制：** 以 versioned state lineage 计算 delta，只传新增/变化 chunk， 并将验证与传输流水化。
- **实验：** multi-turn、branch、RAG、跨节点 migration；delta ratio、hash/verify overhead、bytes、恢复 latency
  和错误传播。
- **知识增量：** KV 传输可以从“复制缓存”转化为“同步版本化推理状态”。

## B6. Workflow-Aware Serving

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **问题：** 把 Agent DAG 拆成独立 FCFS 请求，会忽略 critical path、pause/resume、 fork/join 和 shared state。
- **假设/机制：** 暴露 runnable node、critical path 和暂停状态，联合调度请求与 状态保留，可降低 workflow makespan。
- **实验：** chain、fork/join、tool wait、rollback；makespan、SLO、fairness、 state reuse 和 utilization。
- **知识增量：** Agent serving 的调度单位应从 request 扩展到程序/workflow。

## B7. SLO-Aware Admission 与多 GPU 资源分配

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **问题：** 混合 agent/interactive/batch workload 的 prompt、decode、state 和 deadline
  差异巨大，静态并发与统一队列无法兼顾利用率和 SLO。
- **假设/机制：** phase-aware service-time prediction、SLO slack、KV footprint 和 GPU/NPU allocation 联合
  admission。
- **实验：** 不同 SLO、burst、长短请求、多卡配置；SLO attainment、goodput、 fairness 和资源碎片。
- **知识增量：** serving resource allocation 必须联合 token 阶段和状态占用。

## B8. 输出语义感知的延迟物化与 Host/Device 边界

- **优先级/成熟度：** P1；来源包括 logprobs、pooling、sampled-token materialization 的正负实验。
- **问题：** 推迟 `.tolist()`、批量 materialize 或缓存 Python 对象在微基准上可能 更快，却可能增加生命周期、复制量或真实 serving 延迟。
- **假设/机制：** 根据 output consumer、宽度、batch、streaming 与 device residency 选择 eager/lazy/batched
  materialization。
- **实验：** logprobs 1/5/20、混合宽度、pooling batch 1–512、stream/non-stream； host memory、Python
  time、TTFT/p99。
- **知识增量：** 输出物化策略应由消费语义和跨设备成本决定，不能固定延迟或批量化。

## B9. 结构化输出的程序感知编译与缓存

- **优先级/成熟度：** P1；关联 core [PR #37](https://github.com/intellistream/vllm-hust-legacy-20260831/pull/37) 等工作。
- **问题：** grammar/schema compilation、prefix scan 和 cache key 在 tool-calling workload 中可能支配首请求延迟，并产生
  cache pollution。
- **假设/机制：** 规范化 program IR、跨请求编译缓存、增量 grammar 和 workload-aware cache admission。
- **实验：** 重复/相似 JSON schema、tool chains、冷/热 cache、多租户；compile latency、hit、memory、TTFT 和错误隔离。
- **知识增量：** 结构化推理的可复用对象不仅是 KV，也包括程序/grammar 状态。

______________________________________________________________________

# 第三部分：性能研究方法与 Benchmark

## C1. 跨 Batch Shape 与 Scheduler Mode 的性能变形不变量

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **问题：** 单点吞吐无法发现 empty batch、padding、batch reorder、streaming、 graph/eager 等组合下的非线性错误。
- **假设/机制：** 定义 correctness/performance metamorphic relations，并用 host replay 生成边界组合。
- **实验：** batch permutation/split/merge、256/257、prefill/decode mix、graph mode 和 scheduler variants。
- **知识增量：** 性能正确性可以用跨配置不变量验证，而不依赖每个点的 golden 数字。

## C2. 在线推理回归的因果阶段归因

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **问题：** commit 间 TTFT/TBT/吞吐变化可能来自 queue、prefill、decode、KV、 communication、client 或配置，而不是相邻 PR。
- **假设/机制：** phase signature、change-point、controlled intervention 和 counterfactual replay 可以缩小归因范围。
- **实验：** 用已知回归/伪回归做盲测，比较 bisect、trace rule 和 causal model。
- **知识增量：** 推理回归定位应从“commit 差值”升级为“阶段机制干预”。

## C3. 稀疏、噪声性能历史的统计门禁

- **优先级/成熟度：** P0；研究入口（链接未公开）。
- **问题：** 单次点、不同重复数、设备噪声和历史 best-of 使固定百分比阈值不可靠。
- **假设/机制：** 层次方差模型、SPRT/Bayesian sequential test、effect size 和 change-point 可减少误报及 NPU 小时。
- **实验：** 历史 raw repeats、已知正常/回归提交、不同运行预算。
- **知识增量：** 性能 CI 应输出置信度和继续采样建议，而不是一次 pass/fail。

## C4. 面向状态复用与 Agent 工作流的 Benchmark Suite

- **优先级/成熟度：** P0；需要作为独立 benchmark contribution 规划。
- **问题：** ShareGPT/random 等请求级 workload 不能表达 pause/resume、fork/join、 shared prefix、state
  migration、memory pressure 和 future reuse。
- **假设/机制：** 用可控状态图、访问温度、分支宽度、工具等待和迁移频率构造 workload axes，并同时保留真实 trace。
- **实验：** 合成可控轴 + Agent/RAG 真实 trace；验证 workload 是否能区分 LRU、 cost-aware、workflow-aware、tiering 和
  quantization 策略。
- **知识增量：** Agent serving benchmark 的核心单位是状态演化和工作流关键路径， 不是独立 prompt 分布。

## C5. 固定靶、Provenance 与可比较性作为实验系统

- **优先级/成熟度：** P2；工程基础已由 benchmark #95/#96/#104/#105 建设。
- **问题：** 缺配置字段、错误默认值、跨版本环境、best-of 和手改 snapshot 会让 性能结论失去因果意义。
- **研究化条件：** 不能只做 JSON validator；必须提出形式化 experiment identity、 provenance completeness、target
  evolution 和 admission semantics，并量化其对 误归因率、复现率和实验成本的影响。
- **实验：** 历史排行榜重放、故意注入 config drift/provenance loss、跨站点复现。
- **知识增量：** 可比较性不是绘图过滤器，而是分布式实验数据系统中的一级约束。

## C6. Workload Generator 上限与开放/闭环服务评测

- **优先级/成熟度：** P1；多卡 `request_rate=1` 几乎无法证明 scaling。
- **问题：** client arrival ceiling、closed-loop backpressure 和 server capacity
  被混为一个吞吐数字，会造成“多卡无扩展”或“优化有效”的错误判断。
- **假设/机制：** 分离 offered load、admitted load、completed goodput 和 SLO， 自动搜索 saturation knee。
- **实验：** open-loop Poisson/bursty、closed-loop、arrival-unlimited、多 client； queue growth、goodput、tail
  和 server utilization。
- **知识增量：** serving scaling 必须在明确 arrival semantics 和 saturation 区域下定义。

______________________________________________________________________

# 第四部分：不应单独包装成研究的事项

以下问题必须修，但单独看通常只是工程治理，不足以形成论文：

| 问题                                            | 正确定位              | 可作为哪些研究的基础                  |
| ----------------------------------------------- | --------------------- | ------------------------------------- |
| `gpu_memory_utilization=0.9/0.92` 混入 0.6 曲线 | 数据清理与准入 bug    | C3、C5                                |
| 缺字段被当作默认配置                            | provenance/schema bug | C5                                    |
| missing/N/A 被显示为 0.0                        | 数据语义与前端 bug    | C4、C5                                |
| 排行榜配色、文字对比度                          | UI 可用性             | 无需研究化                            |
| HF 分支、manifest、fallback 不同步              | 发布链路 bug          | C5                                    |
| NPU runner 残留进程、超时和错误设备选择         | CI 资源治理           | C3、C5                                |
| 某个 helper 的 CPU 微基准加速                   | 组件证据              | A5、B8；必须证明端到端                |
| 单个算子 capability gate                        | 兼容性修复            | 若一般化为 capability graph，进入 A17 |
| 单一 PR 缺三次复测                              | 证据缺口              | C3/C5，不是研究结论                   |
| 把历史相邻点差值归因给 PR                       | 错误方法              | C2、C3                                |

同样，已经出现过两类重要负结果：

- receive-buffer/workspace 复用在当前 main 上可能负优化；
- host helper 有数倍微基准收益，但真实 NPU serving 可能下降。

这些负结果不应删除。它们恰好支持 A5/A6/B8 的核心观点：局部优化能否转化为 服务收益，取决于完整生命周期、shape、并发和跨设备边界。

## 5. 统一实验要求

所有进入论文候选阶段的工作至少满足：

1. 固定 core、Ascend plugin、model revision、CANN、torch_npu、设备和 workload。
1. 正式 Ascend 结果使用 graph mode；graph 失败记为 blocked，不使用 eager fallback。
1. base/head 同机交替，至少三次独立服务启动；保留全部原始样本。
1. 同时报告 TTFT、TPOT/TBT、吞吐/goodput、P95/P99、错误率、峰值显存和课题特有 的机制指标。
1. 先通过正确性 oracle，再讨论性能；量化/稀疏/推测解码还必须报告质量或 acceptance。
1. 必须有最强合理 baseline、关键组件消融和至少一个负结果/无收益边界。
1. 不允许用烟雾测试、单次 probe、模拟值、derived artifact 或截图冒充正式结果。
1. 实验 artifact 必须带完整 provenance、有效配置和 base/head 对应关系。

## 6. 建议立项顺序

### 第一批：立即进入 M0/M1

1. A1 Ascend serving roofline
1. A2 拓扑感知多卡并行
1. A4 图安全动态执行
1. A7 融合量化 KV decode
1. A9 KIVI 块级残差生命周期
1. A10 PP 状态一致性
1. A11 推测解码阶段协同
1. A13 MoE/EPLB 控制面
1. B1 状态反馈面
1. C4 Agent/state benchmark suite

### 第二批：依赖第一批接口

1. A3 分布式 metadata overlap
1. A8 自适应 KV 精度
1. A12 KV transfer/offload
1. B2 Agent-aware eviction
1. B3 状态分层与预取
1. B6 Workflow-aware serving
1. C2 因果归因
1. C3 统计门禁

### 第三批：先做文献去重和 feasibility probe

1. A15 稀疏—量化协同
1. A16 统一执行抽象
1. A17 capability-aware graph rewrite
1. B5 KV delta
1. B8 输出物化
1. B9 结构化输出编译缓存
1. C5 provenance 实验系统

## 7. 与仓库组织的建议映射

| 工作类型                                               | 推荐承载位置                        |
| ------------------------------------------------------ | ----------------------------------- |
| 通用 scheduler、KV policy、workflow/state contract     | `vllm-hust` 或独立插件仓库          |
| Ascend kernel、图执行、模型 runner、通信、量化 backend | `vllm-ascend-hust`                  |
| 能形成独立系统/论文且需保持清晰边界的机制              | 独立优化仓库，随后以插件接入        |
| workload、target、artifact、统计与发布                 | `vllm-hust-benchmark`               |
| 排行榜与成果展示                                       | `vllm-hust-website`，不承载研究机制 |

研究代码是否直接进入主仓，不决定它是不是核心成果；判断标准应是：机制是否通用、 接口是否稳定、是否有独立实验闭环，以及是否已经通过正确性和端到端证据。
