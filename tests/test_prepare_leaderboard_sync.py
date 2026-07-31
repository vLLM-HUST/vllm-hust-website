from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "prepare_leaderboard_sync", ROOT / "scripts" / "prepare_leaderboard_sync.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def dump(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def registry(tmp_path: Path) -> tuple[Path, Path, object]:
    path = tmp_path / "official-targets.json"
    checksum = tmp_path / "official-targets.sha256"
    dump(
        path,
        {
            "registry_version": "1.0.0",
            "targets": [
                {
                    "target_id": "official-target",
                    "target_version": "1.0.0",
                    "status": "active",
                    "intended_use": "public-leaderboard",
                }
            ],
        },
    )
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    checksum.write_text(f"{digest}  official-targets.json\n", encoding="utf-8")
    return path, checksum, MODULE.load_registry(path, checksum)


def entry(registry_info: object) -> dict:
    return {
        "entry_id": "entry-1",
        "metadata": {
            "verified": True,
            "target_id": "official-target",
            "target_version": "1.0.0",
            "target_registry_sha256": registry_info.sha256,
        },
        "same_spec": {"spec_id": "official-target"},
    }


def snapshot_dir(tmp_path: Path, registry_info: object) -> Path:
    root = tmp_path / "snapshots"
    root.mkdir()
    dump(root / "leaderboard_single.json", [entry(registry_info)])
    dump(root / "leaderboard_multi.json", [])
    dump(root / "leaderboard_compare.json", {"group_count": 0, "groups": []})
    dump(root / "last_updated.json", {"last_updated": "2026-07-31T00:00:00Z"})
    return root


def test_valid_snapshot_and_declared_empty_compare_pass(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    assert MODULE.validate_snapshot_set(source, info) == {
        "single": 1,
        "multi": 0,
        "compare": 0,
    }


@pytest.mark.parametrize("missing", ["target_id", "target_version", "target_registry_sha256"])
def test_missing_target_binding_fails_closed(tmp_path: Path, missing: str) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    payload = json.loads((source / "leaderboard_single.json").read_text())
    del payload[0]["metadata"][missing]
    dump(source / "leaderboard_single.json", payload)
    with pytest.raises(ValueError, match=missing):
        MODULE.validate_snapshot_set(source, info)


def test_unverified_entry_fails_closed(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    payload = json.loads((source / "leaderboard_single.json").read_text())
    payload[0]["metadata"]["verified"] = False
    dump(source / "leaderboard_single.json", payload)
    with pytest.raises(ValueError, match="metadata.verified"):
        MODULE.validate_snapshot_set(source, info)


def test_registry_hash_mismatch_fails_closed(tmp_path: Path) -> None:
    path, checksum, _ = registry(tmp_path)
    path.write_text(path.read_text() + " ", encoding="utf-8")
    with pytest.raises(ValueError, match="checksum mismatch"):
        MODULE.load_registry(path, checksum)


def test_pr_body_contains_provenance_counts_and_checksums(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    target = tmp_path / "target"
    target.mkdir()
    body = tmp_path / "body.md"
    MODULE.write_pr_body(
        body,
        benchmark_commit="a" * 40,
        registry=info,
        counts=MODULE.validate_snapshot_set(source, info),
        checksums=MODULE.checksum_rows(source, target),
    )
    text = body.read_text()
    assert "Target registry version: `1.0.0`" in text
    assert f"Target registry SHA256: `{info.sha256}`" in text
    assert "Single-chip snapshot | passed | 1" in text
    assert "Previous SHA256" in text
