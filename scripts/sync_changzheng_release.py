from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = REPO_ROOT.parent / "changzheng-desktop" / "release" / "windows"
DEFAULT_DEST_DIR = REPO_ROOT / "downloads" / "changzheng" / "windows"
DEFAULT_SITE_DATA_PATH = REPO_ROOT / "data" / "changzheng_release.json"
KEEP_DEST_FILES = {"index.html"}


@dataclass(frozen=True)
class ReleaseArtifact:
    file_name: str
    source_name: str
    extension: str
    sha256: str
    size: int
    archived_at: str

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ReleaseArtifact":
        required = {
            "fileName",
            "sourceName",
            "extension",
            "sha256",
            "size",
            "archivedAt",
        }
        missing = sorted(required - payload.keys())
        if missing:
            raise ValueError(f"artifact 缺少字段: {', '.join(missing)}")
        return cls(
            file_name=str(payload["fileName"]),
            source_name=str(payload["sourceName"]),
            extension=str(payload["extension"]),
            sha256=str(payload["sha256"]),
            size=int(payload["size"]),
            archived_at=str(payload["archivedAt"]),
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="同步 changzheng-desktop Windows 安装包到 sagellm-website 公共下载目录。"
    )
    parser.add_argument(
        "--source-dir",
        default=str(DEFAULT_SOURCE_DIR),
        help="changzheng-desktop release/windows 目录，默认使用相邻仓库路径。",
    )
    parser.add_argument(
        "--dest-dir",
        default=str(DEFAULT_DEST_DIR),
        help="website 公共下载目录，默认写入 downloads/changzheng/windows。",
    )
    parser.add_argument(
        "--site-data",
        default=str(DEFAULT_SITE_DATA_PATH),
        help="website 站点 manifest 路径，默认写入 data/changzheng_release.json。",
    )
    parser.add_argument(
        "--base-url",
        default="/downloads/changzheng/windows",
        help="站点公开下载前缀，默认 /downloads/changzheng/windows。",
    )
    return parser.parse_args()


def load_release_manifest(
    source_dir: Path,
) -> tuple[dict[str, Any], list[ReleaseArtifact]]:
    manifest_path = source_dir / "LATEST.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"未找到 Changzheng 发布清单: {manifest_path}")

    payload = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    artifacts_raw = payload.get("artifacts")
    if not isinstance(artifacts_raw, list) or not artifacts_raw:
        raise ValueError("LATEST.json 缺少 artifacts 列表，无法同步公开下载包")

    artifacts = [ReleaseArtifact.from_dict(item) for item in artifacts_raw]
    return payload, artifacts


def clean_destination(dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    for path in dest_dir.iterdir():
        if path.name in KEEP_DEST_FILES:
            continue
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()


def copy_release_assets(
    source_dir: Path, dest_dir: Path, artifacts: list[ReleaseArtifact]
) -> None:
    required_names = {"LATEST.json", "RELEASES.json"}
    required_names.update(artifact.file_name for artifact in artifacts)
    required_names.update(f"{artifact.file_name}.sha256" for artifact in artifacts)

    missing = sorted(
        name for name in required_names if not (source_dir / name).exists()
    )
    if missing:
        raise FileNotFoundError(f"source release 缺少文件: {', '.join(missing)}")

    clean_destination(dest_dir)

    for file_name in sorted(required_names):
        shutil.copy2(source_dir / file_name, dest_dir / file_name)


def build_site_metadata(
    manifest: dict[str, Any],
    artifacts: list[ReleaseArtifact],
    base_url: str,
) -> dict[str, Any]:
    normalized_base = base_url.rstrip("/")

    artifacts_payload = []
    for artifact in artifacts:
        artifacts_payload.append(
            {
                "file_name": artifact.file_name,
                "source_name": artifact.source_name,
                "kind": artifact.extension.lstrip(".").lower(),
                "url": f"{normalized_base}/{artifact.file_name}",
                "sha256": artifact.sha256,
                "sha256_url": f"{normalized_base}/{artifact.file_name}.sha256",
                "size": artifact.size,
                "archived_at": artifact.archived_at,
            }
        )

    primary_artifact = next(
        (artifact for artifact in artifacts_payload if artifact["kind"] == "msi"),
        artifacts_payload[0],
    )

    version = str(manifest.get("version", "unknown"))
    generated_at = str(manifest.get("generatedAt", ""))
    product = str(manifest.get("product", "长征"))

    return {
        "title": f"{product} Windows 安装包",
        "description": "面向科学发现大模型的桌面工作台，提供本地 gateway 管理、内嵌 workstation、日志诊断与公开下载链路。",
        "version": version,
        "channel": "Public Preview",
        "platform": "Windows x64",
        "distribution": "Public website static hosting",
        "download_url": primary_artifact["url"],
        "release_url": f"{normalized_base}/",
        "docs_url": "https://github.com/intellistream/changzheng-desktop/blob/main-dev/docs/WINDOWS_RELEASE.md",
        "note": "官网仓库是 public，因此可以直接托管 .msi/.exe 与 SHA256 文件；首页展示摘要，完整文件列表放在独立下载页。",
        "published_at": generated_at,
        "latest_artifact_name": primary_artifact["file_name"],
        "latest_artifact_url": primary_artifact["url"],
        "artifacts": artifacts_payload,
    }


def write_site_metadata(site_data_path: Path, payload: dict[str, Any]) -> None:
    site_data_path.parent.mkdir(parents=True, exist_ok=True)
    site_data_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    source_dir = Path(args.source_dir).resolve()
    dest_dir = Path(args.dest_dir).resolve()
    site_data_path = Path(args.site_data).resolve()

    manifest, artifacts = load_release_manifest(source_dir)
    copy_release_assets(source_dir, dest_dir, artifacts)
    site_metadata = build_site_metadata(manifest, artifacts, args.base_url)
    write_site_metadata(site_data_path, site_metadata)

    print(f"[changzheng-release] synced {len(artifacts)} artifacts -> {dest_dir}")
    print(f"[changzheng-release] updated manifest -> {site_data_path}")


if __name__ == "__main__":
    main()
