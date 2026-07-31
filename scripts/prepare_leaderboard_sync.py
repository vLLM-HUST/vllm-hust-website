#!/usr/bin/env python3
"""Validate a benchmark snapshot set and prepare the website sync evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SNAPSHOT_FILES = (
    "leaderboard_single.json",
    "leaderboard_multi.json",
    "leaderboard_compare.json",
    "last_updated.json",
)


@dataclass(frozen=True)
class RegistryInfo:
    version: str
    sha256: str
    targets: dict[str, dict[str, Any]]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot load {path}: {exc}") from exc


def load_registry(path: Path, checksum_path: Path) -> RegistryInfo:
    actual_hash = sha256_file(path)
    declared_hash = checksum_path.read_text(encoding="utf-8").split()[0]
    if actual_hash != declared_hash:
        raise ValueError(
            "target registry checksum mismatch: "
            f"declared={declared_hash} actual={actual_hash}"
        )

    payload = load_json(path)
    if not isinstance(payload, dict) or not payload.get("registry_version"):
        raise ValueError("target registry must declare registry_version")
    raw_targets = payload.get("targets")
    if not isinstance(raw_targets, list):
        raise ValueError("target registry targets must be an array")

    targets: dict[str, dict[str, Any]] = {}
    for target in raw_targets:
        if not isinstance(target, dict) or not target.get("target_id"):
            raise ValueError("every target registry entry must declare target_id")
        target_id = str(target["target_id"])
        if target_id in targets:
            raise ValueError(f"duplicate target_id in registry: {target_id}")
        targets[target_id] = target
    return RegistryInfo(str(payload["registry_version"]), actual_hash, targets)


def require_public_entry_contract(
    entry: dict[str, Any], source: str, registry: RegistryInfo
) -> list[str]:
    errors: list[str] = []
    entry_id = str(entry.get("entry_id") or "<missing-entry-id>")
    prefix = f"{source}:{entry_id}"
    metadata = entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
    same_spec = (
        entry.get("same_spec") if isinstance(entry.get("same_spec"), dict) else {}
    )

    if metadata.get("verified") is not True:
        errors.append(f"{prefix}: metadata.verified must be true")

    target_id = str(metadata.get("target_id") or "")
    target_version = str(metadata.get("target_version") or "")
    target_registry_sha256 = str(metadata.get("target_registry_sha256") or "")
    if not target_id:
        errors.append(f"{prefix}: metadata.target_id is required")
        return errors
    if not target_version:
        errors.append(f"{prefix}: metadata.target_version is required")
    if not target_registry_sha256:
        errors.append(f"{prefix}: metadata.target_registry_sha256 is required")
    elif target_registry_sha256 != registry.sha256:
        errors.append(
            f"{prefix}: target registry hash mismatch; "
            f"entry={target_registry_sha256} expected={registry.sha256}"
        )

    target = registry.targets.get(target_id)
    if target is None:
        errors.append(f"{prefix}: target_id {target_id!r} is not in the registry")
        return errors
    if (
        target.get("status") != "active"
        or target.get("intended_use") != "public-leaderboard"
    ):
        errors.append(
            f"{prefix}: target_id {target_id!r} is not an active public target"
        )
    if target_version and target_version != str(target.get("target_version") or ""):
        errors.append(
            f"{prefix}: target_version mismatch; entry={target_version!r} "
            f"expected={target.get('target_version')!r}"
        )
    spec_id = str(same_spec.get("spec_id") or "")
    if spec_id != target_id:
        errors.append(
            f"{prefix}: same_spec.spec_id must equal metadata.target_id; "
            f"same_spec={spec_id!r} target_id={target_id!r}"
        )
    return errors


def validate_compare(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["leaderboard_compare.json must be an object"]
    groups = payload.get("groups")
    if not isinstance(groups, list):
        return ["leaderboard_compare.json groups must be an array"]
    declared = payload.get("group_count")
    if not isinstance(declared, int) or declared != len(groups):
        return [
            "leaderboard_compare.json group_count must equal groups length; "
            f"declared={declared!r} actual={len(groups)}"
        ]
    return []


def validate_snapshot_set(source_dir: Path, registry: RegistryInfo) -> dict[str, Any]:
    missing = [name for name in SNAPSHOT_FILES if not (source_dir / name).is_file()]
    if missing:
        raise ValueError("missing snapshot file(s): " + ", ".join(missing))

    single = load_json(source_dir / "leaderboard_single.json")
    multi = load_json(source_dir / "leaderboard_multi.json")
    compare = load_json(source_dir / "leaderboard_compare.json")
    marker = load_json(source_dir / "last_updated.json")
    errors: list[str] = []
    for name, payload in (
        ("leaderboard_single.json", single),
        ("leaderboard_multi.json", multi),
    ):
        if not isinstance(payload, list):
            errors.append(f"{name} must be an array")
            continue
        for entry in payload:
            if not isinstance(entry, dict):
                errors.append(f"{name}: every entry must be an object")
                continue
            errors.extend(require_public_entry_contract(entry, name, registry))
    errors.extend(validate_compare(compare))
    if not isinstance(marker, dict) or not marker.get("last_updated"):
        errors.append("last_updated.json must declare last_updated")
    if errors:
        raise ValueError(
            "snapshot admission failed:\n" + "\n".join(f"- {item}" for item in errors)
        )
    return {
        "single": len(single),
        "multi": len(multi),
        "compare": len(compare["groups"]),
    }


def checksum_rows(source_dir: Path, target_dir: Path) -> list[tuple[str, str, str]]:
    rows: list[tuple[str, str, str]] = []
    for name in SNAPSHOT_FILES:
        source_hash = sha256_file(source_dir / name)
        target = target_dir / name
        old_hash = sha256_file(target) if target.is_file() else "missing"
        rows.append((name, old_hash, source_hash))
    return rows


def write_pr_body(
    path: Path,
    *,
    benchmark_commit: str,
    registry: RegistryInfo,
    counts: dict[str, Any],
    checksums: list[tuple[str, str, str]],
) -> None:
    lines = [
        "Automated sync of admitted leaderboard snapshots from `vllm-hust-benchmark`.",
        "",
        "## Provenance",
        "",
        f"- Benchmark source commit: `{benchmark_commit}`",
        f"- Target registry version: `{registry.version}`",
        f"- Target registry SHA256: `{registry.sha256}`",
        "",
        "## Validation matrix",
        "",
        "| Artifact | Result | Records |",
        "| --- | --- | ---: |",
        f"| Single-chip snapshot | passed | {counts['single']} |",
        f"| Multi-chip snapshot | passed | {counts['multi']} |",
        f"| Compare snapshot | passed | {counts['compare']} groups |",
        "| Entry verification and fixed-target binding | passed | all entries |",
        "",
        "## Checksums",
        "",
        "| Artifact | Previous SHA256 | Incoming SHA256 |",
        "| --- | --- | --- |",
    ]
    for name, old_hash, new_hash in checksums:
        lines.append(f"| `{name}` | `{old_hash}` | `{new_hash}` |")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--target-dir", type=Path, required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--registry-checksum", type=Path, required=True)
    parser.add_argument("--benchmark-commit", required=True)
    parser.add_argument("--pr-body", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        registry = load_registry(args.registry, args.registry_checksum)
        counts = validate_snapshot_set(args.source_dir, registry)
        checksums = checksum_rows(args.source_dir, args.target_dir)
        write_pr_body(
            args.pr_body,
            benchmark_commit=args.benchmark_commit,
            registry=registry,
            counts=counts,
            checksums=checksums,
        )
    except (OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
    print(
        "snapshot admission passed: "
        f"single={counts['single']} multi={counts['multi']} compare={counts['compare']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
