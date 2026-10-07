# OP01 Ascend 注意力边界 · Frontier PR 报告

本 PR（#354）包含 10 次有效的 900 秒测试：C1、C2、C4、C8 和 C16 各包含 OFF/ON 一组。

实测宿主环境为 vLLM 0.23.0+empty 和 vLLM-Ascend 0.23.0.post1，与操作记录一致。
导入的每份正式测试摘要均有效，且没有失败请求。

## 限制与说明

- 实测 workload 文件哈希为 `dff300…`。由于元数据规范化后会重建出标准的 `804456…` 哈希，本 PR 采用了内容等价的变体；这不能单独证明 tokenizer 身份完全一致。
- 每次重启都会轮换服务器日志。当前保留的 ON/OFF 日志是整个测试活动级别的日志，不是逐测试点隔离的激活日志，因此暂不把性能提升标记为已由 OP01 证明。
- C8 的每种模式各有 5 次有效正式测试。公开的 C8 测试点选择每种模式输出吞吐量的中位数；选中的正式测试已发布在 `op01-evidence` 下，其余 4 次重复测试作为本地辅助证据保留。
- 服务器使用的 benchmark 快照对应公开的 swe-prefix-reuse commit `695dd8b1ab280145627a108b434f7a54cca05810`；远端的 pyproject、README、包初始化文件、runner、CLI、client 和 prepare 源文件哈希均与该 commit 匹配。
- MOD 源码已公开在 [xmdhb/vllm-hust-ascend-attention-boundary](https://github.com/xmdhb/vllm-hust-ascend-attention-boundary)，并固定到 package commit [3572713e7944ea877b22f2a8a6bb053f348bfd25](https://github.com/xmdhb/vllm-hust-ascend-attention-boundary/commit/3572713e7944ea877b22f2a8a6bb053f348bfd25)。已安装宿主源码的 commit `f4eacc39cb85ec39024278fbaba1fbc23cbe981f` 单独记录，不与 MOD package revision 混用；点级别的 `mod_sources` 字段记录的是 MOD package 仓库 commit。
- PR 当前为 open，尚未合并。原始 config/summary/requests 文件和逐测试点服务器日志仍属于本 PR 的公开证据；当前日志本身仍不是逐测试点隔离的激活证据。
