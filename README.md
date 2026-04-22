# vllm-hust-website (Website Demo Kit)

<!-- BEGIN:VERSION_META -->

**vllm-hust 项目概览** vllm-hust 围绕上游 vLLM 展开，聚焦国产算力适配、AGI4S 服务场景和 benchmark 驱动验证。

## Project Highlights

- ✅ **上游兼容入口**：围绕 vLLM 兼容接口组织 CLI、服务与 benchmark 链路
- ✅ **国产算力使能**：面向 Ascend 等国产硬件扩展后端与部署能力
- ✅ **AGI4S 服务优化**：关注长上下文、工具调用与结构化输出场景
- ✅ **OpenAI 兼容 API**：完整支持 `/v1/chat/completions` 和流式响应
- ✅ **安装与依赖治理增强**：发布链路与版本一致性检查更稳健
- ✅ **Benchmark 驱动优化**：通过对比数据持续验证服务性能与稳定性

## Quick Start

```bash
# 安装
pip install vllm-hust

# Hello World
vllm-hust hello

# 运行推理 (CPU 默认)
vllm-hust run -p "Hello, world!" --max-tokens 32

# 运行推理 (Ascend NPU)
vllm-hust run -p "Hello AI" --backend cuda

# 启动 OpenAI 兼容服务器
vllm-hust serve --port 8000
```

_该区块由 `data/version_meta.json` 驱动，运行 `python scripts/sync_version_meta.py` 自动更新。_

<!-- END:VERSION_META -->

## Version Metadata Maintenance

- Source of truth: `data/version_meta.json`
- Sync command: `python scripts/sync_version_meta.py`
- Auto sync workflow: `.github/workflows/sync-version-meta.yml`
- Consistency/stale check: `bash scripts/check_stale_versions.sh`
- 维护说明：`docs/VERSION_METADATA.md`

## Website Workstation Embed

首页现在支持把远端 `vllm-hust-workstation` 作为一个可配置面板展示出来，适合把部署在远端算力节点上的 workstation 直接呈现到 website 界面。

- 配置文件：`data/workstation_embed.json`
- 加载脚本：`assets/workstation-embed.js`
- 展示方式：`embed`（iframe 内嵌）或 `link`（仅提供打开入口）

示例：

```json
{
	"enabled": true,
	"mode": "embed",
	"workstation_url": "https://ws.sage.org.ai",
	"backend_url": "https://api.sage.org.ai",
	"docs_url": "./docs/CLOUDFLARE_SETUP.md",
	"label_zh": "Sage 工作站",
	"label_en": "Sage Workstation"
}
```

注意：

- `website` 是静态站点，不代理 workstation API；要展示远端控制台，需要 workstation 自己对外可访问。
- 若 website 走 HTTPS，则 workstation 也必须走 HTTPS，否则浏览器会阻止 iframe 混合内容。
- 如果生产环境要限制可嵌入来源，请在 workstation 侧配置 `APP_FRAME_ANCESTORS`。

推荐的 `sage.org.ai` 域名拆分：

- `vllm-hust.sage.org.ai`：GitHub Pages 静态官网
- `ws.sage.org.ai`：远端节点上的 `vllm-hust-workstation`
- `api.sage.org.ai`：远端节点上的 `vllm-hust` OpenAI 兼容接口

## Architecture And Planning Notes

- vLLM 实际运行时架构与 9 个子任务映射：`docs/ARCHITECTURE_TASK_MAPPING.md`
- 首阶段实施优先级与验证清单：`docs/IMPLEMENTATION_PRIORITIES.md`

## Benchmark Data Chain

website does not ingest raw compare directories and does not hand-edit benchmark rows.

The only supported leaderboard data chain is:

1. Any benchmark pipeline that exports standard leaderboard artifacts (`leaderboard_manifest.json` + `*_leaderboard.json`)
2. Snapshot publish to Hugging Face dataset `intellistream/llm-engine-benchmark-results`
3. Website sync workflow fetches HF snapshot files directly:
	- `data/leaderboard_single.json`
	- `data/leaderboard_multi.json`
	- `data/leaderboard_compare.json`
	- `data/last_updated.json`

Homepage rendering consumes only those snapshot files, with `leaderboard_compare.json` providing neutral engine-vs-engine head-to-head views.

`leaderboard_compare.json` now also carries a mandatory hard-constraint snapshot derived from validated entries:

- single-chip effective utilization >= 90%
- typical scene throughput >= 2x baseline and TTFT/TPOT reduction > 20%
- long-context (>=32K) throughput + TTFT/TPOT P95/P99 stability
- single-business token-cost reduction >= 30% with high multi-tenant utilization

All hard-constraint records must declare `constraints.scenario_source = vllm-benchmark`, using the vLLM benchmark inheritance path as the accountable scenario and dataset source.

## Repository Quickstart

本仓库提供统一的 `quickstart.sh` 模式入口：

- `--standard`：标准模式，依赖优先从 PyPI 安装（稳定/发布导向）
- `--dev`：开发模式，在 standard 基础上尝试本地 editable 覆盖（使用 `--no-deps`）
- 安装前会执行同前缀包动态清理（默认前缀：`ivllm-hust-website`）

```bash
# 查看帮助
./quickstart.sh --help

# 标准模式
./quickstart.sh --standard

# 开发模式（默认）
./quickstart.sh --dev

# 可选：跳过清理或 hooks
./quickstart.sh --dev --skip-cleanup --skip-hooks
```

> 注意：脚本不会创建 `venv/.venv`，请使用当前已配置的非-venv Python 环境。

## systemd --user 本地常驻

如果要把静态站点在本机以 `systemd --user` 常驻方式挂起来，而不是手动执行 `python3 -m http.server 8000`，仓库现在内置了最小管理脚本：

```bash
# 一次性安装 / 更新 service
./scripts/deploy_website_service.sh install-service

# 安装并立即重启到最新配置
./scripts/deploy_website_service.sh deploy

# 查看状态 / 日志
./scripts/deploy_website_service.sh status
./scripts/deploy_website_service.sh logs
```

默认行为：

- 绑定地址：`127.0.0.1`
- 端口：`8000`
- 根目录：当前仓库根目录
- systemd 服务名：`vllm-hust-website`

可选环境变量：

```bash
export WEBSITE_HOST=127.0.0.1
export WEBSITE_PORT=8000
export WEBSITE_ROOT_DIR=/home/shuhao/vllm-hust-website
export WEBSITE_SYSTEMD_SERVICE_NAME=vllm-hust-website
```

## Changzheng Public Download Sync

`changzheng-desktop` 在 Windows 构建机完成安装包归档后，会先上传到 Hugging Face dataset，再由 website 定时拉取并发布：

- `release/windows/LATEST.json`
- `release/windows/RELEASES.json`
- 版本化 `.msi` / `.exe`
- 对应 `.sha256`

website 仓库是 public，因此可直接把这些文件同步到站点静态目录：

- Hugging Face 路径：`intellistream/llm-engine-benchmark-results/changzheng/windows`
- 目标目录：`downloads/changzheng/windows/`
- 首页摘要数据：`data/changzheng_release.json`
- 本地同步脚本：`scripts/sync_changzheng_release.py`
- 自动拉取 workflow：`.github/workflows/sync-changzheng-hf-release.yml`

同步完成后：

- 首页长征区块会直接指向公开 `.msi/.exe`
- 独立下载页位于 `downloads/changzheng/windows/index.html`
- 下载页会展示全部产物与 SHA256 校验信息
