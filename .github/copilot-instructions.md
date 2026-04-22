# GitHub Copilot Instructions

## Version Source of Truth (Mandatory)

For Python packages in this repository, version must have exactly one hardcoded source:

1. Only one hardcoded version location is allowed: `src/<package>/_version.py`
1. `pyproject.toml` must use dynamic version:
   - `[project] dynamic = ["version"]`
   - `[tool.setuptools.dynamic] version = {attr = "<package>._version.__version__"}`
1. `src/<package>/__init__.py` must import version from `_version.py`:
   - `from <package>._version import __version__`
1. Do not hardcode version in `pyproject.toml` (`project.version`) or `__init__.py`
1. For version bump, update only `_version.py`

## Reminder

When asked to update package version, change only `_version.py`.

## Git Hooks（强制 - Mandatory）

🚨 **所有开发者必须安装 pre-commit 和 pre-push hooks，绝对不允许跳过。**

### 安装要求

1. 克隆仓库后，**第一件事**必须运行 `./quickstart.sh` 安装 Git hooks
1. 如果仓库提供 `hooks/` 目录，必须确保 `.git/hooks/pre-commit` 和 `.git/hooks/pre-push` 已正确链接或复制
1. 每次 `git commit` 和 `git push` 都必须经过 hooks 检查（ruff format / ruff check / pytest 等）

### 禁止绕过 Hooks

- ❌ **禁止** 使用 `git commit --no-verify` 或 `git push --no-verify` 跳过 hooks
- ❌ **禁止** 删除、禁用或修改 `.git/hooks/pre-commit` / `.git/hooks/pre-push`
- ❌ **禁止** 通过任何方式（环境变量、配置等）绕过 hooks 检查
- ⚠️ `--no-verify` 仅在极端特殊情况下允许（如修复 CI 基础设施本身），且必须在 commit message 中注明原因

### Copilot Agent 行为规范

- ✅ 执行 `git commit` 或 `git push` 时，**永远不要**添加 `--no-verify` 标志
- ✅ 如果 hooks 检查失败，必须先修复问题再提交，而不是绕过 hooks
- ✅ 帮助开发者设置 hooks 时，推荐运行 `./quickstart.sh`
- ✅ 默认 `git push` **不会自动发布**，发布必须显式触发
- ✅ 如需在推送 `main-dev` 时发布，使用 `git push -o vllm-hust-publish origin main-dev`；若当前 Git 客户端不支持 push
  option，则使用 `VLLM_HUST_PUBLISH_ON_PUSH=1 git push origin main-dev`

## 🚫 NEVER_CREATE_DOT_VENV_MANDATORY

- 永远不要创建 `.venv` 或 `venv`（无任何例外）。
- NEVER create `.venv`/`venv` in this repository under any circumstance.
- 必须复用当前已配置的非-venv Python 环境（如现有 conda 环境）。
- 所有测试、lint、脚本执行都必须使用当前已配置的 conda 环境；禁止为了运行命令而新建或激活仓库内虚拟环境。
- 禁止建议或执行 `python -m venv`、`uv venv`、`virtualenv`、`source .venv/bin/activate` 等命令。
- If any script/task suggests creating a virtualenv, skip that step and continue with the existing
  environment.
