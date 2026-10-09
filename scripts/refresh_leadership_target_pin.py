#!/usr/bin/env python3
"""Refresh a leadership target pin against an incoming official registry."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


PIN_SCHEMA = "leadership-performance-target-pin/v1"
PIN_KEYS = {"schema_version", "registry_version", "registry_sha256", "targets"}
PIN_TARGET_KEYS = {"workload", "target_id", "target_version", "profile_id"}


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot load {path}: {exc}") from exc


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_registry(path: Path, checksum_path: Path) -> tuple[str, str, dict[str, Any]]:
    actual_hash = sha256_file(path)
    try:
        declared_hash = checksum_path.read_text(encoding="utf-8").split()[0]
    except (OSError, IndexError) as exc:
        raise ValueError(
            f"cannot load registry checksum {checksum_path}: {exc}"
        ) from exc
    if declared_hash != actual_hash:
        raise ValueError(
            "official-target registry checksum mismatch: "
            f"declared={declared_hash!r} actual={actual_hash}"
        )

    payload = load_json(path)
    if not isinstance(payload, dict) or not payload.get("registry_version"):
        raise ValueError("official-target registry must declare registry_version")
    raw_targets = payload.get("targets")
    if not isinstance(raw_targets, list):
        raise ValueError("official-target registry targets must be an array")

    targets: dict[str, Any] = {}
    for target in raw_targets:
        if not isinstance(target, dict) or not target.get("target_id"):
            raise ValueError("every official target must declare target_id")
        target_id = str(target["target_id"])
        if target_id in targets:
            raise ValueError(f"duplicate official target_id: {target_id}")
        targets[target_id] = target
    return str(payload["registry_version"]), actual_hash, targets


def render_refreshed_pin(
    pin_path: Path,
    registry_path: Path,
    checksum_path: Path,
    current_registry_path: Path,
    current_checksum_path: Path,
) -> bytes:
    registry_version, registry_hash, registry_targets = load_registry(
        registry_path, checksum_path
    )
    current_version, current_hash, current_targets = load_registry(
        current_registry_path, current_checksum_path
    )
    pin = load_json(pin_path)
    if not isinstance(pin, dict) or pin.get("schema_version") != PIN_SCHEMA:
        raise ValueError("unsupported leadership performance target-pin schema")
    if set(pin) != PIN_KEYS:
        raise ValueError(
            "leadership target pin must contain exactly: " + ", ".join(sorted(PIN_KEYS))
        )
    if pin.get("registry_version") != current_version:
        raise ValueError(
            "leadership target pin does not match the current registry version"
        )
    if pin.get("registry_sha256") != current_hash:
        raise ValueError(
            "leadership target pin does not match the current registry checksum"
        )
    raw_pins = pin.get("targets")
    if not isinstance(raw_pins, list) or not raw_pins:
        raise ValueError("leadership target pin targets must be a non-empty array")

    workloads: set[str] = set()
    for raw_pin in raw_pins:
        if not isinstance(raw_pin, dict) or set(raw_pin) != PIN_TARGET_KEYS:
            raise ValueError(
                "every leadership target pin must contain exactly: "
                + ", ".join(sorted(PIN_TARGET_KEYS))
            )
        values = {key: str(raw_pin.get(key) or "") for key in PIN_TARGET_KEYS}
        if not all(values.values()):
            raise ValueError("leadership target pin fields must be non-empty")
        if values["workload"] in workloads:
            raise ValueError(
                f"duplicate leadership target workload: {values['workload']}"
            )
        workloads.add(values["workload"])

        target = registry_targets.get(values["target_id"])
        if target is None:
            raise ValueError(f"pinned target does not exist: {values['target_id']}")
        current_target = current_targets.get(values["target_id"])
        if current_target is None:
            raise ValueError(
                f"pinned target is absent from the current registry: {values['target_id']}"
            )
        if target != current_target:
            raise ValueError(f"pinned target object changed: {values['target_id']}")
        expected = {
            "workload": str((target.get("workload") or {}).get("name") or ""),
            "target_version": str(target.get("target_version") or ""),
            "profile_id": str(target.get("profile") or ""),
        }
        for field, expected_value in expected.items():
            if values[field] != expected_value:
                raise ValueError(
                    f"pinned target contract changed for {values['target_id']}: "
                    f"{field}={values[field]!r} registry={expected_value!r}"
                )
        if target.get("status") != "active" or target.get("intended_use") != (
            "public-leaderboard"
        ):
            raise ValueError(
                f"pinned target is not active/public: {values['target_id']}"
            )

    refreshed = dict(pin)
    refreshed["registry_version"] = registry_version
    refreshed["registry_sha256"] = registry_hash
    return (json.dumps(refreshed, indent=2, ensure_ascii=False) + "\n").encode()


def refresh_pin(
    pin_path: Path,
    registry_path: Path,
    checksum_path: Path,
    current_registry_path: Path,
    current_checksum_path: Path,
    *,
    check: bool,
) -> int:
    rendered = render_refreshed_pin(
        pin_path,
        registry_path,
        checksum_path,
        current_registry_path,
        current_checksum_path,
    )
    if pin_path.read_bytes() == rendered:
        print("leadership target pin already matches the official registry")
        return 0
    if check:
        print("leadership target pin registry identity is stale")
        return 1
    pin_path.write_bytes(rendered)
    pin_path.chmod(0o644)
    print("refreshed leadership target pin registry identity")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Refresh only the registry identity in the leadership target pin; "
            "reject any pinned target contract change."
        )
    )
    parser.add_argument("--pin", type=Path, required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--registry-checksum", type=Path, required=True)
    parser.add_argument("--current-registry", type=Path, required=True)
    parser.add_argument("--current-registry-checksum", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return refresh_pin(
            args.pin.resolve(),
            args.registry.resolve(),
            args.registry_checksum.resolve(),
            args.current_registry.resolve(),
            args.current_registry_checksum.resolve(),
            check=args.check,
        )
    except (OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    raise SystemExit(main())
