# BetterScale resident State + balanced decode attention

2026-09-27（UTC），Qwen3.5-35B-A3B BF16，Ascend 910B2 × 2，TP2/MTP2，C16， 会话轮转深度 1。SWE Prefix Reuse 测量窗口
900 秒，独立校验，测量会话冷 KV。

配置：LiveStateScheduler，E16/R20 resident State，balanced decode attention； 服务端上限 16，query budget
4096，最大上下文 262144；每卡总 State + attention 预算 24.25 GiB。单请求、prefill/mixed 和 draft 保留原 attention 路径。

| 指标                              |              本次结果 |
| --------------------------------- | --------------------: |
| 每卡输出吞吐（tokens/s/chip）     |              442.9806 |
| P90 请求解码速度（tokens/s/user） |               62.9063 |
| TTFT P95（ms）                    |                588.66 |
| TPOT 中位数 / P95 / P99（ms）     | 17.39 / 22.83 / 30.02 |
| 窗口内完成请求                    |                  1280 |
| 请求失败 / 观测抢占               |                 0 / 0 |

本次仅测一个组合点，没有新增配对对照或重复。历史 resident State 点吞吐为 414.8011 tokens/s/chip，本次高 6.79%；历史 TTFT P95 为 462.25
ms，本次更高。 历史点与本次使用不同主机，不能据此归因独立 attention 增益或宣称统计显著性。 这不是 SWE 答题质量评测，也不是 C16 全部 256K 上下文的吞吐测量。

长上下文热续写校验确认 resident State 精确命中，两边 rank 均实际执行 attention 切分。服务与监督程序正常退出，所用卡已释放。保留原有历史点，不合并不同配置。

- [主线集成源码：eee35fd](https://github.com/vLLM-HUST/BetterScale/commit/eee35fd6b50fca73385ad8f8af714fcd7e5c2684)
- [公开指标与配置](../data/leaderboard_frontier_swe_evidence.json)，run `fa0e01a32eef456bab4bebe51e4aa7dd`。

源码部署快照与单独构建的 CANN 9.0.1 attention 库，不代表已发布的 PyPI wheel。 完整原始请求和运行日志保留在本地；公开摘录不声称包含这些原始材料。

主线默认入口现已组合 resident State 与 balanced attention，无需手动启用两条路径。 实际测量保留在原始 `283e06d` 快照；集成版仅改变默认选择、库打包与校验，
数值实现和内核二进制未变。安装包默认参数已核对为被测组合，不代表重新测量。
