# Frontier 成绩提交指南：从跑测试到看到榜单上的点

这份 guide 用一次真实的 **BetterScale / Qwen3.5-35B-A3B BF16 / TP2 / C4** 测量， 演示怎样测试性能、整理成绩、提交 PR，以及在哪里查看结果。

本目录的 [snapshot.json](snapshot.json) 是完整配置和成绩， [evidence.json](evidence.json)
是对应的官方指标摘录。这条记录已发布，副本用于学习， 不应重复上榜。按下面的流程提交时，请使用你自己测得的新 run。

整个流程是：

```text
准备推理服务 → AgentX 测试 → 本地检查结果 → 整理成绩与证据
→ website 数据 PR → 审查与合并 → 部署完成 → Frontier 查看与下载配置
```

## 1. 准备一个可以测的推理服务

先在获准使用的设备上部署模型，保留完整启动配置。AgentX 是压测客户端， 不会替你下载模型、启动 engine 或分配加速卡。

本指南使用 [agentx-bench](https://github.com/vLLM-HUST/agentx-bench) 的 AgentX 256K workload。 服务需满足：

- 提供 OpenAI 兼容 chat 接口，支持流式输出、token usage 和 `ignore_eos`。
- 支持语料的输入＋输出长度上限 256,000 tokens，并为模板和标记留余量；通常需要 至少 262,144 的上下文容量。不能通过截断或丢弃长请求来凑这个 workload。
- 准备与模型匹配的本地 tokenizer，记录模型、tokenizer、engine、后端及 MOD 的版本或 commit。
- 明确精度、总卡数、TP/PP/DP、批处理、KV/host memory 预算、prefix cache、graph 和 MTP 设置。 engine 与 MOD 分开填写；仅记录实际启用的
  MOD。

如果使用投机解码，先按 benchmark 的
[协议说明](https://github.com/vLLM-HUST/agentx-bench#protocol-choices-and-comparison-boundaries)
准备匹配模型、draft 长度和 thinking 模式的 acceptance 校准及服务端设置。 **不能直接把样例的 AL2.63 搬到自己的模型上**；没有相应证据时禁用投机解码并如实记录。

## 2. 安装客户端，先检查计划，再跑 smoke

安装 `uv` 后，在运行压测客户端的机器执行：

```bash
git clone https://github.com/vLLM-HUST/agentx-bench.git
cd agentx-bench
uv sync --locked
uv run --frozen python prepare.py

mkdir -p .cache
cp examples/target.json .cache/target.json
```

编辑 `.cache/target.json`，将所有 `REPLACE_WITH_...` 替换为真实值，尤其是：

| 配置                                   | 应填写什么                                                  |
| -------------------------------------- | ----------------------------------------------------------- |
| `url`                                  | 已获授权的服务 origin，例如本机服务 `http://127.0.0.1:8000` |
| `model` / `model_revision`             | 实际 served model 名称及固定权重 revision                   |
| `tokenizer` / `tokenizer_revision`     | 本地 tokenizer 目录及其固定 revision                        |
| `engine`                               | 名称、源码 revision、去除密钥后的完整启动命令               |
| `hardware`                             | 设备型号、全部分配卡数、按分配比例计算的 host DRAM          |
| `max_model_len` / `host_kv_budget_gib` | 实际上下文容量及 host KV 预算                               |
| `speculative_decoding`                 | 实际投机配置及所需校准信息；不用时保持 disabled             |

初始客户端仅支持无凭据的受信任服务 origin。不要把密钥写进文件或命令，也不要拿付费 API 试跑。目标配置只声明服务状态，不会替你修改服务端参数。

```bash
# 只打印计划，不向服务发送压测请求
uv run --frozen python bench.py plan --target .cache/target.json \
  --profile smoke --concurrency 4

# 确认目标与配置无误后，开始实际压测
uv run --frozen python bench.py run --target .cache/target.json \
  --profile smoke --concurrency 4
```

`C4` 表示 4 棵活跃 agent 会话树，不是固定 4 个 HTTP 请求。并发应根据资源选择， 需要曲线时分别跑 C1/C2/C4/C8 等点，保留各自结果，不只提交最好看的点。

`smoke` 是**预热之后测量 900 秒**；数据准备、请求重建、预热、排空与导出另计， 所以总耗时会超过 15 分钟。先用 smoke 调通，确认配置和资源后才考虑
`--profile formal` 的 3600 秒测量；smoke 与 formal 是不同 workload 身份，不能混成同一组成绩。 不修改固定语料、输出长度、预热或回放时序来缩短测试。

## 3. 跑完之后，先在本地看结果

命令会打印本次输出目录 `artifacts/<run>/`，其中：

| 文件                                   | 看什么                                                 |
| -------------------------------------- | ------------------------------------------------------ |
| `harness.log`                          | 请求准备、预热、测量进度与错误                         |
| `run.json`                             | 固定协议、目标配置、wrapper commit、最终状态及报告位置 |
| `aiperf/**/profile_export_aiperf.json` | 官方吞吐、延迟、有效性及失败原因                       |

将下面的 `<run>` 替换为刚刚打印的目录名：

```bash
cat artifacts/<run>/run.json
find artifacts/<run>/aiperf -name profile_export_aiperf.json -print
# 运行期间也可以查看进度：
tail -f artifacts/<run>/harness.log
```

先检查 `run.json` 的 `status` 是否为 `completed`、退出码是否为 0，再核对唯一官方报告的 `metadata.submission_valid` 是否为
true，并检查错误和输出长度等信息。 `failed_or_invalid`、取消或报告缺失的 run 不能当作成功成绩；保留 `submission_invalid_reasons`
排查，而不是改有效性标记。

有效性通过不代表模型质量或官方认证：AgentX 回放的是合成内容，不评价答案正确性。 **运行结束也不会自动上传到网站**，此时结果只在你的本地目录。

## 4. 把报告整理成 Frontier 数据

参照同目录两份 JSON，保留自己的原始 run ID、完整配置和测量限制，清理凭据、内网地址、 机器绝对路径及私有请求内容后再公开。不要把整个本地 `artifacts/` 直接提交。

### 图上两个坐标怎样对应报告？

| Frontier 字段或坐标                         | 本例使用的官方字段                                    |
| ------------------------------------------- | ----------------------------------------------------- |
| `metrics.decode_p90_tps`，横轴 P90 解码速度 | `output_token_throughput_per_user.p90`                |
| `metrics.output_tps`，部署总输出吞吐        | `output_token_throughput.avg`                         |
| 纵轴 output tokens/s/chip                   | 网页将 `output_tps` 除以 `hardware.accelerator_count` |
| `metrics.ttft_p95_ms`                       | `time_to_first_token.p95`                             |
| `metrics.tpot_ms` / `tpot_p95_ms`           | `inter_token_latency.avg` / `.p95`                    |

本例总吞吐为 **84.62433838849498 tokens/s**，分配 2 张卡，所以纵轴为 **42.31216919424749 tokens/s/chip**；横轴为
**97.66183282742962 tokens/s/user**。 保存 JSON 时保留原始数值，不用页面四舍五入后的显示值。 不要把纵轴的每卡吞吐填入
`output_tps`，否则会再被除一次；也不要用 `1000 / TPOT P90` 替代 P90 解码速度，或用输出 token 数 / 900 重算官方吞吐。

### 一条成绩还需要什么？

- **cohort**：模型及 revision、精度、固定 workload 合约、上下文要求。完全相同的合约复用 已有 cohort；模型/精度/workload 合约改变时建立对应的新身份。
- **point**：唯一 ID、所属 cohort、engine/MOD、硬件总卡数、完整服务配置、并发及指标。
- **evidence**：原始 run ID、可访问的 HTTPS 报告链接、有效性、smoke/formal、窗口时长、 聚合方法与已知限制。优先提供固定 revision
  的链接；缺失指标不编造为零。

字段含义可查 [Frontier 数据契约](../../../docs/LEADERBOARD-FRONTIER.md)。 本例的公开 evidence
是指标摘录，不代表完整原始日志和实验源码已公开。

## 5. Fork website，提交自己的数据 PR

在 GitHub Fork [vllm-hust-website](https://github.com/vLLM-HUST/vllm-hust-website)， 把下面的
`YOUR_GITHUB_NAME` 换成自己的用户名：

```bash
git clone https://github.com/YOUR_GITHUB_NAME/vllm-hust-website.git
cd vllm-hust-website
git switch -c frontier/my-measurement
```

真实上榜提交修改的是生产数据，而不是把新成绩留在本示例目录：

1. 在 `data/leaderboard_frontier.json` 的 `points` 追加新 point，必要时在 `cohorts` 追加新合约。保留已有点，不整份替换成只有自己成绩的
   snapshot。
1. 对本指南的 AgentX 协议，在 `data/leaderboard_frontier_evidence.json` 中追加对应 run 的指标摘录，并保留本次实际协议、runtime
   与校准关联。不要让新结果错误继承旧配置； 若与现有公共元数据不同，在 run 中明确保留差异并在 PR 中说明。
1. 检查 point/run ID 唯一、证据与成绩一一对应，且不是把本目录的已发布 run 再加一遍。

安装 Node.js 后，可以直接复用网站现有的结构校验：

```bash
node - <<'JS'
const model = require('./assets/leaderboard-frontier-model.js');
const data = require('./data/leaderboard_frontier.json');
model.validate(data);
const runs = data.points.flatMap(p => p.evidence.run_ids);
if (new Set(runs).size !== runs.length) throw new Error('重复 run ID，请核对');
console.log('结构及 run ID 检查通过；仍需核对原始报告和配置');
JS

git diff --check
git diff --stat
git add data/leaderboard_frontier.json data/leaderboard_frontier_evidence.json
git commit -m "data: submit Frontier measurement"
git push -u origin frontier/my-measurement
```

在 GitHub 点击 **Compare & pull request**，选择上游 `vLLM-HUST/vllm-hust-website` 的 `main` 为 base，先打开 Draft
PR。正文可以按下面填写：

```text
模型与精度：
workload / smoke 或 formal：
硬件、总卡数、并发：
engine / 后端 / MOD 版本：
point ID / run ID：
P90 解码速度、总输出吞吐、每卡输出吞吐：
报告和复现配置链接：
有效性与本地检查结果：
已知限制或与已有配置的差异：
```

检查 PR 的 Files changed 和 CI 结果，回答审查问题后等待维护者合并。 结构校验通过不等于证据审查通过，PR 创建成功也不代表已经上榜。 维护者负责核对 workload
归属、指标与配置，并完成发布所需的缓存版本更新。

## 6. 在哪里看到自己的成绩？

- **测试刚结束**：在客户端 `artifacts/<run>/` 查看报告，网站还没有变化。
- **PR 审查中**：在 GitHub PR 查看数据 diff、检查结果及讨论。想先看效果，可在 website 仓库运行
  `python3 -m http.server 8774 --bind 127.0.0.1`，打开
  `http://127.0.0.1:8774/leaderboard-runs.html#frontier`。
- **合并并部署完成后**：打开 [官网 Frontier](https://vllm-hust.sage.org.ai/leaderboard-runs.html#frontier)，选择对应的
  **模型＋精度**及 **workload**，找到自己的点。点击点查看硬件、engine、并发和指标， 再点击下载配置，核对 point/run ID 与提交内容一致。

合并不等于部署已完成。若没有看到新增点，先确认部署状态，再使用 `leaderboard-runs.html?v=<合并提交SHA>#frontier` 这样的新页面 URL，避免旧 HTML 缓存。
还应核对 cohort 选择和数据是否进入生产 snapshot；仅提交到 `data/examples/` 的样例 不会被页面读取，也不会因合并而产生新的榜单点。
