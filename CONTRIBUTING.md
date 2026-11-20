# 贡献规则

## 数据只提交到 benchmark

**禁止向 vllm-hust-website 提交数据 PR。**

请将实测结果、曲线数据、数据集矩阵、B0/B1、配置元数据、价格依据、实验报告及原始证据 PR 到
[vllm-hust-benchmark](https://github.com/vLLM-HUST/vllm-hust-benchmark)。
修正、删除和移动已有数据也适用这条规则。先合并源数据，再更新网站展示。

网站仓库只接收展示、交互、代码、测试和文档变更。不得将结果写进 HTML / JavaScript 或图片来绕过检查。合成测试 fixture 不属于已发布实验结果，但不得用 fixture
发布结果。

`No data PRs in website` 检查禁止修改 `data/`、`reports/`、`docs/evidence/`、 `op01-evidence/`，并检查其他目录下的
CSV、TSV、JSONL、Parquet 和 Arrow 文件。 检查同时覆盖 rename 的原路径，没有作者、标签或机器人豁免。

网站的数据副本应在发布阶段从 benchmark 的固定已合并 commit 生成，不再通过数据 PR 同步。现有自动生成网站数据 PR 的同步任务必须迁移到发布产物流程。

## 管理员启用

工作流合并后，将 `No data PRs in website` 设置为 main 的必需状态检查，并禁止绕过。 仅有工作流失败、但没有分支保护或 ruleset，不能保证管理员或维护者无法合并。
在启用前，不得宣称仓库已经具备不可绕过的拦截。

## Agent 与跨仓库流程

Agent 开始修改前阅读 [AGENTS.md](AGENTS.md) 和 benchmark 的
[统一协作流程](https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/main/AGENT_WORKFLOW.md)。
所有版本共用页面组件；缺数据保留相同位置并明确缺项。数据来源合并、固定提交发布、 PR 当前 head 检查、部署和正式域名验收是不同步骤，不能用其中一步代替完整交付。

## 最新正式版与自动发布

`b0-b1.html` 和 `b0-b1.html?release=latest` 默认选择已校验目录中编号最大的正式冻结 r 版本。`?release=r6` 等明确参数保留历史结果；SR
从独立目录生成菜单。B1 结果按本版证据展示；固定 B0 的已验证原测记录独立保存，发布新 B1 不得清空。新版 B1 缺项时保留 B0 原值、模型、工况和来源，只标注 B1 缺项；单独展示 B0
不构成新的配对或验收结果。

实验报告进入 benchmark 后，将本版性能、质量、有效算力参考及其分母、上下文和租户资料接入 Release 目录。附件上传或目录登记不能代替结果接入。

`Sync Reviewed Benchmark Publication` 每15分钟、手动或收到 `benchmark-publication` 事件时检查 benchmark main。源提交的
lint、tests 及所有适用的 push 校验工作流均成功后（CPU smoke 按路径触发），自动更新来源及策略锁定的 PR；网站当前 head
的检查全部通过后合并，再触发生产部署。写入使用已有 `PAT_TOKEN`，不向网站提交数据副本。源检查未完成时保持现有锁定。
