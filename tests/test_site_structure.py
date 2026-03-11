from __future__ import annotations

from pathlib import Path


def test_required_entry_files_exist() -> None:
    root = Path(__file__).resolve().parents[1]
    required = [
        root / "index.html",
        root / "versions.html",
        root / "README.md",
        root / "CHANGELOG.md",
        root / "downloads" / "changzheng" / "windows" / "index.html",
        root / "data" / "changzheng_release.json",
        root / "scripts" / "sync_changzheng_release.py",
    ]
    for path in required:
        assert path.exists(), f"missing required file: {path.name}"


def test_index_contains_expected_project_markers() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "index.html").read_text(encoding="utf-8")

    assert "sageLLM" in text
    assert "leaderboard" in text.lower()
    assert "长征 Desktop 下载" in text


def test_data_directory_has_sync_marker() -> None:
    root = Path(__file__).resolve().parents[1]
    marker = root / "data" / "last_updated.json"
    assert marker.exists(), "data sync marker is required for website freshness"


def test_changzheng_manifest_has_public_download_shape() -> None:
    root = Path(__file__).resolve().parents[1]
    manifest_text = (root / "data" / "changzheng_release.json").read_text(
        encoding="utf-8"
    )

    assert '"download_url"' in manifest_text
    assert '"release_url"' in manifest_text
    assert '"artifacts"' in manifest_text
    assert "/downloads/changzheng/windows/" in manifest_text
