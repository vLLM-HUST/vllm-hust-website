#!/usr/bin/env python3
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

VERSION_META_PATH = Path(__file__).resolve().parents[1] / "data" / "version_meta.json"
README_PATH = Path(__file__).resolve().parents[1] / "README.md"
PYPI_URL = "https://pypi.org/pypi/{package}/json"
README_BLOCK_START = "<!-- BEGIN:VERSION_META -->"
README_BLOCK_END = "<!-- END:VERSION_META -->"


def _fetch_latest_version(package_name: str) -> str:
    url = PYPI_URL.format(package=package_name)
    context = ssl.create_default_context()
    request = urllib.request.Request(
        url, headers={"User-Agent": "vllm-hust-website-version-sync/1.0"}
    )

    try:
        with urllib.request.urlopen(request, timeout=20, context=context) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        raise RuntimeError(
            f"Failed to fetch {package_name} from PyPI: {error}"
        ) from error

    version = payload.get("info", {}).get("version")
    if not isinstance(version, str) or not version.strip():
        raise RuntimeError(f"Invalid version payload for {package_name}")
    return version.strip()


def _load_meta() -> dict[str, Any]:
    return json.loads(VERSION_META_PATH.read_text(encoding="utf-8"))


def _write_meta(meta: dict[str, Any]) -> None:
    VERSION_META_PATH.write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _render_readme_block(meta: dict[str, Any]) -> str:
    release = meta.get("release", {}) if isinstance(meta, dict) else {}
    quickstart = meta.get("quickstart", {}) if isinstance(meta, dict) else {}

    headline = release.get("headline_zh", "vllm-hust 项目概览")
    message = release.get(
        "message_zh",
        "vllm-hust 围绕上游 vLLM 展开，聚焦国产算力适配、AGI4S 服务场景和 benchmark 驱动验证。",
    )
    quickstart_title = quickstart.get("title_zh", "🚀 Quick Start")
    install_command = quickstart.get("install_command", "pip install vllm-hust")
    run_command = quickstart.get(
        "run_command", 'vllm-hust run -p "Hello AI" --backend cuda'
    )

    return "\n".join(
        [
            f"**{headline}** {message}",
            "",
            "## Project Highlights",
            "",
            "- ✅ **上游兼容入口**：围绕 vLLM 兼容接口组织 CLI、服务与 benchmark 链路",
            "- ✅ **国产算力使能**：面向 Ascend 等国产硬件扩展后端与部署能力",
            "- ✅ **AGI4S 服务优化**：关注长上下文、工具调用与结构化输出场景",
            "- ✅ **OpenAI 兼容 API**：完整支持 `/v1/chat/completions` 和流式响应",
            "- ✅ **安装与依赖治理增强**：发布链路与版本一致性检查更稳健",
            "- ✅ **Benchmark 驱动优化**：通过对比数据持续验证服务性能与稳定性",
            "",
            f"## {quickstart_title.replace('🚀 ', '')}",
            "",
            "```bash",
            "# 安装",
            install_command,
            "",
            "# Hello World",
            "vllm-hust hello",
            "",
            "# 运行推理 (CPU 默认)",
            'vllm-hust run -p "Hello, world!" --max-tokens 32',
            "",
            "# 运行推理 (Ascend NPU)",
            run_command,
            "",
            "# 启动 OpenAI 兼容服务器",
            "vllm-hust serve --port 8000",
            "```",
            "",
            "_该区块由 `data/version_meta.json` 驱动，运行 `python scripts/sync_version_meta.py` 自动更新。_",
        ]
    )


def _sync_readme(meta: dict[str, Any]) -> bool:
    content = README_PATH.read_text(encoding="utf-8")
    start = content.find(README_BLOCK_START)
    end = content.find(README_BLOCK_END)

    if start == -1 or end == -1 or end < start:
        raise RuntimeError("README.md is missing VERSION_META markers")

    generated = _render_readme_block(meta)
    new_content = (
        content[: start + len(README_BLOCK_START)]
        + "\n\n"
        + generated
        + "\n\n"
        + content[end:]
    )

    if new_content != content:
        README_PATH.write_text(new_content, encoding="utf-8")
        return True
    return False


def sync_version_meta() -> bool:
    meta = _load_meta()
    packages = meta.get("packages")

    if not isinstance(packages, list):
        raise RuntimeError("version_meta.json is missing a valid 'packages' array")

    changed = False
    for package in packages:
        if not isinstance(package, dict):
            continue

        pypi_name = package.get("pypi_name")
        current_version = package.get("version")
        if not isinstance(pypi_name, str) or not isinstance(current_version, str):
            continue

        try:
            latest_version = _fetch_latest_version(pypi_name)
        except RuntimeError as error:
            print(f"warning: {error}")
            continue
        if latest_version != current_version:
            package["version"] = latest_version
            changed = True

    if changed:
        meta["updated_at"] = datetime.now(UTC).date().isoformat()
        _write_meta(meta)

    readme_changed = _sync_readme(meta)

    return changed or readme_changed


def main() -> None:
    changed = sync_version_meta()
    if changed:
        print("version_meta.json updated")
    else:
        print("version_meta.json already up to date")


if __name__ == "__main__":
    main()
