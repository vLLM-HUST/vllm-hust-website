from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest

SCRIPT_PATH = (
    Path(__file__).resolve().parents[1] / "scripts" / "sync_changzheng_release.py"
)
SPEC = importlib.util.spec_from_file_location("sync_changzheng_release", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
copy_release_assets = MODULE.copy_release_assets
load_release_manifest = MODULE.load_release_manifest


def _write_release(root: Path, *, checksum: str | None = None) -> None:
    artifact = root / "changzheng.exe"
    artifact.write_bytes(b"release")
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    (root / "LATEST.json").write_text(
        json.dumps(
            {
                "version": "1.0",
                "artifacts": [
                    {
                        "fileName": artifact.name,
                        "sourceName": artifact.name,
                        "extension": ".exe",
                        "sha256": digest,
                        "size": artifact.stat().st_size,
                        "archivedAt": "2026-07-30T00:00:00Z",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    (root / "RELEASES.json").write_text("[]\n", encoding="utf-8")
    (root / f"{artifact.name}.sha256").write_text(
        f"{checksum or digest}  {artifact.name}\n", encoding="utf-8"
    )


def test_copy_release_assets_validates_then_replaces_destination(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source"
    destination = tmp_path / "destination"
    source.mkdir()
    destination.mkdir()
    (destination / "index.html").write_text("keep", encoding="utf-8")
    (destination / "obsolete.exe").write_bytes(b"old")
    _write_release(source)

    _, artifacts = load_release_manifest(source)
    copy_release_assets(source, destination, artifacts)

    assert (destination / "changzheng.exe").read_bytes() == b"release"
    assert (destination / "index.html").read_text(encoding="utf-8") == "keep"
    assert not (destination / "obsolete.exe").exists()


def test_checksum_failure_preserves_previous_destination(tmp_path: Path) -> None:
    source = tmp_path / "source"
    destination = tmp_path / "destination"
    source.mkdir()
    destination.mkdir()
    previous = destination / "previous.exe"
    previous.write_bytes(b"previous")
    _write_release(source, checksum="0" * 64)

    _, artifacts = load_release_manifest(source)
    with pytest.raises(ValueError, match="与 manifest 不一致"):
        copy_release_assets(source, destination, artifacts)

    assert previous.read_bytes() == b"previous"
