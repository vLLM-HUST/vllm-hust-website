# Website Demo Kit (SageLLM Inference)

<!-- BEGIN:VERSION_META -->

**🎉 sageLLM 0.5 正式发布！** v0.5 的发布标志着 sageLLM 从“功能可用”进入“工程可用”阶段：命令入口统一、推理链路更完整、安装与依赖管理更稳定、发布与版本治理更可靠。

## 0.5 Release Highlights

- ✅ **统一 CLI 工具**：`sagellm` 主命令（保留 `sage-llm` 兼容）
- ✅ **CPU-First 设计**：所有功能默认 CPU，可选 GPU/NPU 加速
- ✅ **Ascend NPU 原生支持**：Ascend 后端引擎可用，支持异构部署
- ✅ **OpenAI 兼容 API**：完整支持 `/v1/chat/completions` 和流式响应
- ✅ **安装与依赖治理增强**：发布链路与版本一致性检查更稳健
- ✅ **模块化架构**：Protocol-first, Fail-fast, Observable

## Quick Start (v0.5)

```bash
# 安装
pip install isagellm

# Hello World
sagellm hello

# 运行推理 (CPU 默认)
sagellm run -p "Hello, world!" --max-tokens 32

# 运行推理 (Ascend NPU)
sagellm run -p "Hello AI" --backend cuda

# 启动 OpenAI 兼容服务器
sagellm serve --port 8000
```

_该区块由 `data/version_meta.json` 驱动，运行 `python scripts/sync_version_meta.py` 自动更新。_

<!-- END:VERSION_META -->

## Version Metadata Maintenance

- Source of truth: `data/version_meta.json`
- Sync command: `python scripts/sync_version_meta.py`
- Auto sync workflow: `.github/workflows/sync-version-meta.yml`
- Consistency/stale check: `bash scripts/check_stale_versions.sh`
- 维护说明：`docs/VERSION_METADATA.md`

## Repository Quickstart

本仓库提供统一的 `quickstart.sh` 模式入口：

- `--standard`：标准模式，依赖优先从 PyPI 安装（稳定/发布导向）
- `--dev`：开发模式，在 standard 基础上尝试本地 editable 覆盖（使用 `--no-deps`）
- 安装前会执行同前缀包动态清理（默认前缀：`isagellm-website`）

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
