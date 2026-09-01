#!/usr/bin/env python3
"""Sync website leaderboard mirror files from benchmark snapshots."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


SNAPSHOT_FILES = (
    "leaderboard_single.json",
    "leaderboard_multi.json",
    "leaderboard_historical.json",
    "leaderboard_compare.json",
    "last_updated.json",
)

# Official fixed-target registry mirror. The benchmark repo publishes these under
# hyphens; the website mirror uses underscores to match our data/ naming style.
REGISTRY_MIRROR = {
    "official-targets.json": "official_targets.json",
    "official-targets.sha256": "official_targets.sha256",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy canonical benchmark leaderboard snapshots into website data/."
    )
    parser.add_argument(
        "--source-dir",
        default="../vllm-hust-benchmark/leaderboard-data/snapshots",
        help="Directory containing canonical benchmark snapshot JSON files.",
    )
    parser.add_argument(
        "--target-dir",
        default="data",
        help="Website data directory to update.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Only verify that target files already match source files.",
    )
    return parser.parse_args()


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid JSON: {path}: {exc}") from exc


def sanitize_public_string(value: str) -> str:
    """Remove workstation-specific absolute paths from published snapshots."""
    if not value.startswith("/home/"):
        return value
    markers = (
        ("/vllm-hust-benchmark/", "vllm-hust-benchmark/"),
        ("/vllm-hust-benchmark-single-npu/", "vllm-hust-benchmark-single-npu/"),
        ("/.cache/huggingface/hub/", "<huggingface-cache>/"),
    )
    for marker, replacement in markers:
        if marker in value:
            return replacement + value.split(marker, 1)[1]
    if "/envs/" in value and value.endswith("/bin/python"):
        return "<python-environment>/bin/python"
    return f"<local-path>/{Path(value).name}"


def sanitize_public_payload(value: object) -> object:
    if isinstance(value, dict):
        return {key: sanitize_public_payload(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_public_payload(item) for item in value]
    if isinstance(value, str):
        return sanitize_public_string(value)
    return value


def render_public_snapshot(path: Path) -> bytes:
    payload = sanitize_public_payload(load_json(path))
    return (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode()


def validate_snapshot_set(source_dir: Path) -> None:
    missing = [name for name in SNAPSHOT_FILES if not (source_dir / name).is_file()]
    if missing:
        raise SystemExit(
            "missing benchmark snapshot file(s): " + ", ".join(sorted(missing))
        )

    single = load_json(source_dir / "leaderboard_single.json")
    multi = load_json(source_dir / "leaderboard_multi.json")
    historical = load_json(source_dir / "leaderboard_historical.json")
    compare = load_json(source_dir / "leaderboard_compare.json")
    marker = load_json(source_dir / "last_updated.json")

    if not isinstance(single, list):
        raise SystemExit("leaderboard_single.json must be a JSON array")
    if not isinstance(multi, list):
        raise SystemExit("leaderboard_multi.json must be a JSON array")
    if not isinstance(historical, list):
        raise SystemExit("leaderboard_historical.json must be a JSON array")
    if any(
        not isinstance(entry, dict)
        or entry.get("historical_recovery", {}).get("admitted_for_historical_trend")
        is not True
        for entry in historical
    ):
        raise SystemExit(
            "leaderboard_historical.json entries must be admitted historical records"
        )
    if not isinstance(compare, dict) or "groups" not in compare:
        raise SystemExit("leaderboard_compare.json must contain groups")
    if not isinstance(marker, dict) or not marker.get("last_updated"):
        raise SystemExit("last_updated.json must contain last_updated")

    registry_source_dir = get_registry_source_dir(source_dir)
    missing_mirror = [
        name for name in REGISTRY_MIRROR if not (registry_source_dir / name).is_file()
    ]
    if missing_mirror:
        raise SystemExit(
            "missing benchmark registry mirror file(s): "
            + ", ".join(sorted(missing_mirror))
        )
    registry = load_json(registry_source_dir / "official-targets.json")
    if not isinstance(registry, dict) or not isinstance(registry.get("targets"), list):
        raise SystemExit("official-targets.json must contain a targets array")


def get_registry_source_dir(source_dir: Path) -> Path:
    """Support the benchmark layout where registries sit beside snapshots/."""
    if all((source_dir / name).is_file() for name in REGISTRY_MIRROR):
        return source_dir
    return source_dir.parent


def sync_snapshots(source_dir: Path, target_dir: Path, *, check: bool) -> int:
    validate_snapshot_set(source_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    changed: list[str] = []
    for name in SNAPSHOT_FILES:
        source = source_dir / name
        target = target_dir / name
        rendered = render_public_snapshot(source)
        if target.is_file() and target.read_bytes() == rendered:
            continue
        changed.append(name)
        if not check:
            target.write_bytes(rendered)
            target.chmod(0o644)

    registry_source_dir = get_registry_source_dir(source_dir)
    for source_name, target_name in REGISTRY_MIRROR.items():
        source = registry_source_dir / source_name
        target = target_dir / target_name
        if target.is_file() and target.read_bytes() == source.read_bytes():
            continue
        changed.append(target_name)
        if not check:
            shutil.copy2(source, target)
            target.chmod(0o644)

    if check and changed:
        print("website leaderboard mirror is out of sync:")
        for name in changed:
            print(f"  {name}")
        return 1

    if changed:
        print("synced leaderboard snapshot file(s):")
        for name in changed:
            print(f"  {name}")
    else:
        print("leaderboard snapshots already in sync")
    return 0


def main() -> int:
    args = parse_args()
    return sync_snapshots(
        Path(args.source_dir).resolve(),
        Path(args.target_dir).resolve(),
        check=args.check,
    )


if __name__ == "__main__":
    raise SystemExit(main())
