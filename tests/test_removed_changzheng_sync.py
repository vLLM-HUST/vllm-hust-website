from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_obsolete_changzheng_sync_chain_is_removed():
    obsolete_paths = (
        ".github/workflows/sync-changzheng-hf-release.yml",
        "data/changzheng_release.json",
        "scripts/sync_changzheng_release.py",
    )

    assert all(not (ROOT / path).exists() for path in obsolete_paths)


def test_readme_no_longer_advertises_removed_download_flow():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    assert "Changzheng Public Download Sync" not in readme
    assert "downloads/changzheng" not in readme
    assert "sync_changzheng_release.py" not in readme
