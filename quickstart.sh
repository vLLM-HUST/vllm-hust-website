#!/usr/bin/env bash
# sagellm-website: Quick Start
# 统一 standard/dev 安装语义：
# - standard: 依赖优先从 PyPI 安装（若本仓库含可安装 Python 项目）
# - dev:      在 standard 基础上，尽量使用本地 editable 覆盖

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
TEMPLATE_DIR="$PROJECT_ROOT/hooks"

INSTALL_MODE="dev"
SKIP_HOOKS="false"
SKIP_CLEANUP="false"
CLEANUP_PREFIX="${QUICKSTART_CLEANUP_PREFIX:-isagellm-website}"

show_help() {
    echo "sagellm-website Quick Start"
    echo ""
    echo "用法:"
    echo "  ./quickstart.sh                 默认开发安装 (--dev)"
    echo "  ./quickstart.sh --dev           开发模式：先走 standard，再尝试本地 editable 覆盖(--no-deps)"
    echo "  ./quickstart.sh --standard      标准模式：依赖优先从 PyPI 安装（稳定/发布导向）"
    echo "  ./quickstart.sh --skip-cleanup  跳过同前缀已安装包清理"
    echo "  ./quickstart.sh --skip-hooks    跳过 Git hooks 安装"
    echo "  ./quickstart.sh --help          显示帮助"
    echo ""
    echo "环境变量:"
    echo "  QUICKSTART_CLEANUP_PREFIX       清理前缀（默认: isagellm-website）"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dev)
                INSTALL_MODE="dev"
                ;;
            --standard)
                INSTALL_MODE="standard"
                ;;
            --skip-hooks)
                SKIP_HOOKS="true"
                ;;
            --skip-cleanup)
                SKIP_CLEANUP="true"
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}❌ 未知参数: $1${NC}"
                echo ""
                show_help
                exit 1
                ;;
        esac
        shift
    done
}

detect_python() {
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_CMD="python3"
    elif command -v python >/dev/null 2>&1; then
        PYTHON_CMD="python"
    else
        echo -e "${RED}❌ 未找到可用 Python 命令（python3/python）${NC}"
        exit 1
    fi
    PIP_CMD=("$PYTHON_CMD" -m pip)
}

run_with_diagnostics() {
    local label="$1"
    shift
    local log_file
    log_file=$(mktemp)

    if "$@" >"$log_file" 2>&1; then
        rm -f "$log_file"
        return 0
    fi

    echo -e "${RED}❌ ${label} 失败${NC}"
    echo -e "${YELLOW}--- 详细错误日志开始 ---${NC}"
    cat "$log_file"
    echo -e "${YELLOW}--- 详细错误日志结束 ---${NC}"
    rm -f "$log_file"
    return 1
}

check_environment() {
    if [ -n "${VIRTUAL_ENV:-}" ]; then
        echo -e "${RED}❌ 检测到 venv: ${VIRTUAL_ENV}${NC}"
        echo -e "${YELLOW}👉 请退出 venv，改用已存在的非-venv Python 环境（建议 conda）${NC}"
        exit 1
    fi

    if [ -n "${CONDA_DEFAULT_ENV:-}" ]; then
        echo -e "${GREEN}✅ 已检测到 conda 环境: ${CONDA_DEFAULT_ENV}${NC}"
    else
        echo -e "${YELLOW}⚠️ 未检测到 conda 环境，请确认当前为已配置的非-venv Python 环境${NC}"
    fi
}

cleanup_prefixed_packages() {
    local prefix
    prefix="$(echo "$CLEANUP_PREFIX" | tr '[:upper:]' '[:lower:]')"

    mapfile -t installed_packages < <(
        "$PYTHON_CMD" - <<'PY' "$prefix"
from __future__ import annotations

import importlib.metadata as metadata
import sys

target_prefix = sys.argv[1].strip().lower()
names: set[str] = set()
for dist in metadata.distributions():
    name = dist.metadata.get("Name")
    if not name:
        continue
    normalized = name.strip().lower()
    if normalized.startswith(target_prefix):
        names.add(normalized)

for item in sorted(names):
    print(item)
PY
    )

    if [ "${#installed_packages[@]}" -eq 0 ]; then
        echo -e "${GREEN}✓ 无需清理（未发现 ${prefix}* 已安装包）${NC}"
        return 0
    fi

    echo -e "${BLUE}🧹 发现 ${#installed_packages[@]} 个 ${prefix}* 包，开始清理...${NC}"
    local pkg
    for pkg in "${installed_packages[@]}"; do
        echo -e "  ${CYAN}- uninstall ${pkg}${NC}"
        run_with_diagnostics "卸载 ${pkg}" "${PIP_CMD[@]}" uninstall -y "$pkg"
    done
    echo -e "${GREEN}✓ ${prefix}* 包清理完成${NC}"
}

has_local_python_project() {
    if [ -f "$PROJECT_ROOT/pyproject.toml" ] || [ -f "$PROJECT_ROOT/setup.py" ]; then
        return 0
    fi
    return 1
}

install_from_pypi() {
    if has_local_python_project; then
        echo -e "${BLUE}📦 检测到 Python 项目，执行 PyPI 基线安装${NC}"
        run_with_diagnostics "PyPI 基线安装" "${PIP_CMD[@]}" install .
        echo -e "${GREEN}✓ PyPI 基线安装完成${NC}"
        return 0
    fi

    echo -e "${YELLOW}⚠️ 当前仓库无 pyproject.toml/setup.py，跳过 Python 依赖安装${NC}"
}

install_dev_editable_overlay() {
    if has_local_python_project; then
        echo -e "${BLUE}🔁 开发模式覆盖：本地 editable 安装（--no-deps）${NC}"
        run_with_diagnostics "本地 editable 覆盖" "${PIP_CMD[@]}" install -e . --no-deps
        echo -e "${GREEN}✓ 本地 editable 覆盖完成${NC}"
        return 0
    fi

    echo -e "${YELLOW}⚠️ 当前仓库无可 editable 的 Python 包，dev 模式等同 standard${NC}"
}

install_hooks() {
    if [ -d "$HOOKS_DIR" ]; then
        if [ -f "$TEMPLATE_DIR/pre-commit" ]; then
            ln -sf "../../hooks/pre-commit" "$HOOKS_DIR/pre-commit"
            chmod +x "$HOOKS_DIR/pre-commit"
            echo -e "${GREEN}✓ Installed pre-commit hook${NC}"
        else
            echo -e "${YELLOW}⚠️ pre-commit template not found, skipping${NC}"
        fi

        if [ -f "$TEMPLATE_DIR/pre-push" ]; then
            ln -sf "../../hooks/pre-push" "$HOOKS_DIR/pre-push"
            chmod +x "$HOOKS_DIR/pre-push"
            echo -e "${GREEN}✓ Installed pre-push hook${NC}"
        else
            echo -e "${YELLOW}⚠️ pre-push template not found, skipping${NC}"
        fi

        if [ -f "$TEMPLATE_DIR/post-commit" ]; then
            ln -sf "../../hooks/post-commit" "$HOOKS_DIR/post-commit"
            chmod +x "$HOOKS_DIR/post-commit"
            echo -e "${GREEN}✓ Installed post-commit hook${NC}"
        else
            echo -e "${YELLOW}⚠️ post-commit template not found, skipping${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ .git directory not found, skipping hooks installation${NC}"
    fi
}

main() {
    parse_args "$@"
    detect_python

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${BLUE}sagellm-website Quick Start${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📂 Project root: ${NC}${PROJECT_ROOT}"
    echo -e "${BLUE}🔧 Install mode: ${NC}${INSTALL_MODE}"
    echo ""

    echo -e "${YELLOW}${BOLD}Step 1/5: Checking environment${NC}"
    check_environment
    echo ""

    echo -e "${YELLOW}${BOLD}Step 2/5: Cleaning existing prefixed packages${NC}"
    if [ "$SKIP_CLEANUP" = "true" ]; then
        echo -e "${YELLOW}⚠️ 已跳过清理（--skip-cleanup）${NC}"
    else
        cleanup_prefixed_packages
    fi
    echo ""

    echo -e "${YELLOW}${BOLD}Step 3/5: Installing PyPI baseline${NC}"
    install_from_pypi
    echo ""

    echo -e "${YELLOW}${BOLD}Step 4/5: Installing editable overlay (dev only)${NC}"
    if [ "$INSTALL_MODE" = "dev" ]; then
        install_dev_editable_overlay
    else
        echo -e "${GREEN}✓ standard 模式跳过 editable 覆盖${NC}"
    fi
    echo ""

    echo -e "${YELLOW}${BOLD}Step 5/5: Installing Git hooks${NC}"
    if [ "$SKIP_HOOKS" = "true" ]; then
        echo -e "${YELLOW}⚠️ 已跳过 hooks 安装（--skip-hooks）${NC}"
    else
        install_hooks
    fi
    echo ""

    echo -e "${YELLOW}${BOLD}Next: Local preview${NC}"
    echo -e "${BLUE}Run:${NC} python3 -m http.server 8000"
    echo -e "${BLUE}Then open:${NC} http://localhost:8000"
    echo ""
    echo -e "${GREEN}${BOLD}✓ Setup Complete${NC}"
}

main "$@"
