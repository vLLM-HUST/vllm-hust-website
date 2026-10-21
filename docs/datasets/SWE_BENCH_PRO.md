# SWE-bench Pro：真实软件工程 Agent 数据集

[前端介绍页](../../dataset-introductions.html#swe-bench-pro) · [数据集矩阵](../../dataset-validation.html)

## 任务是什么

SWE-bench Pro 要求 Agent 在真实软件仓库中解决代码问题。每道任务指定问题描述、代码起点， 并提供独立测试/评分材料。Agent 需要读取代码、修改实现、运行测试并提交补丁，
不是直接生成一道问答题的答案。

官方来源：[数据集](https://huggingface.co/datasets/ScaleAI/SWE-bench_Pro) ·
[评测代码](https://github.com/scaleapi/SWE-bench_Pro-os)。

## 本项目如何运行

通用环境和执行代码由 [vllm-hust-benchmark](https://github.com/vLLM-HUST/vllm-hust-benchmark) 维护。 入口负责固定版本源码、V1
数据和 ARM 镜像校验，启动官方 Agent，并保存完整执行证据。 Agent 调用已有的兼容模型 API，在独立 ARM Docker 容器中执行工具。Controller 是可选接入，
不是使用环境的前提。

当前锁定清单覆盖 8 道 NodeBB V1 任务，示例只运行其中 1 道、1 个 Agent。 这不代表已验证全部 V1/V2 任务、全部语言或全部 ARM 镜像。

开始试用请看
[用户指南](https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/main/docs/SWE_BENCH_PRO.zh-CN.md)：
准备源码与私有数据 → 编辑自己的模型 API 和 Docker 配置 → 检查与准备 → 运行一个 Agent → 查看逐步轨迹、工具输出、补丁和退出原因 → 可选独立评分。

网站只介绍数据集和展示已有证据，不在浏览器里启动 Agent 或管理模型。 请勿把私有题目、参考答案、补丁、服务地址或凭据提交到前端仓库。

## 怎样判断是否成功

- 环境验收：入口、模型调用、任务容器、工具执行、轨迹与清理链路真实可用。
- Agent 提交：`Submitted` 表示 Agent 主动结束并交付补丁，不代表修复正确。
- 修复成绩：独立官方评分器输出完整后，才能判断任务是否通过测试。
- 性能对照：需要相同输入、模型、预算与传输路径，不能把少做工作或提前报错当作收益。

独立入口已通过真实 Agent 执行验证；完整修题结果以
[benchmark 验收记录](https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/main/reports/swe-bench-pro-environment-migration-20261020)
为准。上下文上限包含输入历史和预留输出；预算耗尽、上下文超限、测试失败和未评分分别保留， 未评分不是零分。介绍页不会据此添加未测量的矩阵成绩。

## 与 SWE-smith 轨迹回放的区别

本入口运行实时 Agent：每次模型回复决定下一次工具动作和后续输入。 矩阵中的 SWE-smith 轨迹回放使用已保存的调用序列，它适合研究引擎负载与调度， 其吞吐和 program 完成率不能替代
SWE-bench Pro 的修题成功率。
