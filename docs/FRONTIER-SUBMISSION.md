# 向 Frontier 提交一次实测成绩

本示例展示 website PR 需要提供的成绩、配置、证据及校验步骤，不启动 benchmark。 适用于 `leaderboard-runs.html#frontier`，不替代普通排行榜的
benchmark 快照同步流程。

## 1. 看一个真实提交包

- [snapshot.json](examples/frontier-submission/snapshot.json)：一个完整 cohort 和一个实测 point。
- [evidence.json](examples/frontier-submission/evidence.json)：对应 run 的官方指标摘录、协议、运行时与校准信息。
- [测量说明](FRONTIER-QWEN35-AGENTX-SMOKE.md)：配置、方法和适用范围。

样例直接摘自已发布的 BetterScale TP2 / C4 记录，run ID 为
`20260923T103407Z-smoke-c4-90c340f1`。它不是新成绩，不修改生产数据，也不应再次上榜。 样例是 900 秒 smoke，使用 benchmark 专用
synthetic acceptance；不是正式认证或模型质量成绩。 公开证据是指标摘录，不代表全部原始日志及实验源码已公开。

## 2. 准备自己的实测记录

Fork 本仓库，从最新 `main` 新建提交分支。先保存 benchmark 的原始报告、有效性结论和 可复现配置；失败、无效或缺少坐标的测量不能改标为有效成绩。

参照样例，但必须替换为自己的真实结果：

- **cohort**：模型及 revision、权重/计算/KV 精度、固定 workload 合约、上下文要求。 完全相同的合约复用已有 cohort；模型、精度或 workload
  合约改变时使用新的对应身份。 smoke 与正式窗口必须分开，不能只换一个显示名称。
- **configuration**：engine 与版本、实际启用的 MOD ID/版本、硬件与全部分配卡数、并行方式、 MTP、调度/批处理、KV 预算、graph 设置、源码
  revision，以及生效的启动参数。 MOD ID 对照 `data/ecosystem.json`；native 使用空 MOD 数组，未知身份不能假装 native。
- **load**：本次测量的并发及单位，不能把 agent session 并发误写成 HTTP 请求并发。
- **metrics**：保留原始精度和单位，未知值省略或填 null，不填零。AgentX 示例中：
  `decode_p90_tps = output_token_throughput_per_user.p90`；
  `output_tps = output_token_throughput.avg`。网页自行除以全部分配卡数得到每卡吞吐。 不用 `1000 / TPOT P90` 代替解码速度
  P90，也不自行用 output tokens / 900 重算吞吐。
- **evidence**：唯一 point ID、原始 run ID、可访问的 HTTPS 证据链接、窗口类型和时长、 聚合方式、有效性结果与限制。优先使用不可变 revision
  链接；不要平均多个 run 的 P95 后声称它是合并请求分布的 P95。重复 run 不作为新的独立测量点。

对外发布前移除凭据、内网地址、机器绝对路径和私有请求内容，同时保留复现所需的非敏感配置。

## 3. 在 PR 中体现上榜变更

真实的新成绩需要修改以下生产文件；本演示故意只在 `docs/examples/` 放副本：

1. 在 `data/leaderboard_frontier.json` 的 `points` 追加新 point；仅当合约确实新增时追加 cohort。
   不替换已有榜单，不删除较慢点，不重复添加本示例 run。
1. 对当前 AgentX 协议，在 `data/leaderboard_frontier_evidence.json` 增加对应官方指标摘录。 其他 benchmark 不要伪装成
   AgentX；提供其独立证据，并补充相应的核验映射。
1. 添加简短测量说明，记录范围、失败项及比较限制。相同 cohort 不保证相同 KV 预算或隔离硬件。
1. 更新 `assets/leaderboard-frontier.js` 的 snapshot fetch URL 版本，以及 `leaderboard-runs.html`
   的资源版本，避免旧缓存掩盖新增点。无需修改绘图算法。

完整字段约束见 [Frontier 数据契约](LEADERBOARD-FRONTIER.md)。当前生产测试还包含已发布 Qwen35 campaign 的回归断言；新增 campaign
应补充相应检查，而不是删除旧证据检查来过 CI。

## 4. 本地校验和预览

安装 Node.js 和仓库开发依赖后，在仓库根目录运行：

```bash
# 验证这个独立样例的结构及官方指标映射，不修改生产快照
node --test tests/leaderboard_frontier_submission.test.cjs
# 真实上榜改动还需校验生产数据及 UI model
node --test tests/leaderboard_frontier_model.test.cjs tests/leaderboard_runs_model.test.cjs
./scripts/validate-local.sh
```

真实上榜 PR 再启动本地预览，并在另一个终端运行浏览器检查：

```bash
python -m http.server 8774 --bind 127.0.0.1
# 另一个终端；需先安装 playwright 及 Chromium
python scripts/verify_leaderboard_frontier_browser.py
```

打开 `http://127.0.0.1:8774/leaderboard-runs.html#frontier`，检查点的位置、engine/MOD 身份、 弹窗配置和下载
JSON；确认旧点仍在。静态网站只读取生产 snapshot，不会自动扫描样例目录。 结构校验成功不等于测量有效，CI 也不替代证据审查。

## 5. 打开 Draft PR → 审查 → 发布

推送分支，在本仓库向 `main` 打开 Draft PR。正文至少写清：

- 新增哪些 point/run，属于哪个模型+精度及 workload，smoke 还是正式窗口。
- 硬件、总卡数、并发、engine/MOD 版本，以及关键配置。
- 官方报告/指标与复现配置在哪里，已知限制是什么。
- 本地检查结果，是否改变 cohort 合约或已有点。

维护者核对证据和 CI 后再决定合并。真实数据 PR 合并并部署后，使用带新版本参数的页面 URL 确认新增点及下载内容；提交 PR 本身不代表成绩已被接纳或已上线。
