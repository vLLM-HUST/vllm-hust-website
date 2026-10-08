from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "refresh_leadership_target_pin",
    ROOT / "scripts" / "refresh_leadership_target_pin.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def write_registry(
    root: Path,
    *,
    registry_version: str,
    target_version: str = "1.2.3",
    server_value: int = 1,
    extra_target: bool = False,
) -> tuple[Path, Path]:
    root.mkdir()
    registry = root / "official-targets.json"
    targets = [
        {
            "target_id": "official-example",
            "target_version": target_version,
            "profile": "core-text",
            "status": "active",
            "intended_use": "public-leaderboard",
            "workload": {"name": "random-online"},
            "server_parameters": {"max_num_seqs": server_value},
        }
    ]
    if extra_target:
        targets.append({"target_id": "unrelated", "status": "provisional"})
    registry.write_text(
        json.dumps({"registry_version": registry_version, "targets": targets}, indent=2)
        + "\n",
        encoding="utf-8",
    )
    checksum = root / "official-targets.sha256"
    checksum.write_text(
        f"{hashlib.sha256(registry.read_bytes()).hexdigest()}  {registry.name}\n",
        encoding="utf-8",
    )
    return registry, checksum


def write_pin(tmp_path: Path, current_registry: Path) -> Path:
    pin = tmp_path / "leadership_performance_targets.json"
    pin.write_text(
        json.dumps(
            {
                "schema_version": "leadership-performance-target-pin/v1",
                "registry_version": "1.0.0",
                "registry_sha256": hashlib.sha256(
                    current_registry.read_bytes()
                ).hexdigest(),
                "targets": [
                    {
                        "workload": "random-online",
                        "target_id": "official-example",
                        "target_version": "1.2.3",
                        "profile_id": "core-text",
                    }
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return pin


def registries(tmp_path: Path) -> tuple[Path, Path, Path, Path]:
    current_registry, current_checksum = write_registry(
        tmp_path / "current", registry_version="1.0.0"
    )
    registry, checksum = write_registry(
        tmp_path / "incoming", registry_version="9.9.9", extra_target=True
    )
    return current_registry, current_checksum, registry, checksum


def test_refresh_updates_only_registry_identity(tmp_path: Path) -> None:
    current_registry, current_checksum, registry, checksum = registries(tmp_path)
    pin = write_pin(tmp_path, current_registry)
    original_targets = json.loads(pin.read_text())["targets"]

    assert (
        MODULE.refresh_pin(
            pin,
            registry,
            checksum,
            current_registry,
            current_checksum,
            check=False,
        )
        == 0
    )

    refreshed = json.loads(pin.read_text())
    assert refreshed["registry_version"] == "9.9.9"
    assert (
        refreshed["registry_sha256"]
        == hashlib.sha256(registry.read_bytes()).hexdigest()
    )
    assert refreshed["targets"] == original_targets
    assert (
        MODULE.refresh_pin(pin, registry, checksum, registry, checksum, check=True) == 0
    )


def test_check_reports_stale_registry_identity_without_writing(tmp_path: Path) -> None:
    current_registry, current_checksum, registry, checksum = registries(tmp_path)
    pin = write_pin(tmp_path, current_registry)
    before = pin.read_bytes()

    assert (
        MODULE.refresh_pin(
            pin,
            registry,
            checksum,
            current_registry,
            current_checksum,
            check=True,
        )
        == 1
    )
    assert pin.read_bytes() == before


@pytest.mark.parametrize(
    ("target_version", "server_value"), [("2.0.0", 1), ("1.2.3", 2)]
)
def test_refresh_rejects_any_pinned_target_object_change(
    tmp_path: Path, target_version: str, server_value: int
) -> None:
    current_registry, current_checksum = write_registry(
        tmp_path / "current", registry_version="1.0.0"
    )
    registry, checksum = write_registry(
        tmp_path / "incoming",
        registry_version="2.0.0",
        target_version=target_version,
        server_value=server_value,
    )
    pin = write_pin(tmp_path, current_registry)

    with pytest.raises(ValueError, match="pinned target object changed"):
        MODULE.refresh_pin(
            pin,
            registry,
            checksum,
            current_registry,
            current_checksum,
            check=False,
        )


def test_refresh_rejects_registry_checksum_mismatch(tmp_path: Path) -> None:
    current_registry, current_checksum, registry, checksum = registries(tmp_path)
    pin = write_pin(tmp_path, current_registry)
    checksum.write_text(f"{'f' * 64}  {registry.name}\n", encoding="utf-8")

    with pytest.raises(ValueError, match="registry checksum mismatch"):
        MODULE.refresh_pin(
            pin,
            registry,
            checksum,
            current_registry,
            current_checksum,
            check=False,
        )
