## 变更说明

## 数据提交规则

**本仓库不接受数据 PR。数据必须 PR 到 [vllm-hust-benchmark](https://github.com/vLLM-HUST/vllm-hust-benchmark)。**

- 网站 PR 只修改展示、交互、代码、测试或文档。
- 实测结果、曲线点、矩阵单元格、基线、价格依据、实验元数据和原始证据均提交到 benchmark。
- 不要在 HTML / JavaScript 中硬编码结果来绕过数据目录检查。
- 数据源更新后，网站通过发布流程读取 benchmark 中已合并、可校验的版本。
- 机器人、同步 PR 和维护者没有数据 PR 豁免。

关联 benchmark PR / commit：

## 验证

- [ ] 本 PR 不新增、修改、删除或移动已发布数据及证据。
- [ ] 展示数值有 benchmark 中的唯一可追溯来源。
- [ ] 已验证受影响页面及移动端。
