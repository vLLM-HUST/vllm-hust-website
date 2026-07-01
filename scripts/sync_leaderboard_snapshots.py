#!/usr/bin/env python3
"""Sync website leaderboard mirror files from benchmark snapshots."""

from __future__ import annotations

import argparse
import filecmp
import json
import shutil
from pathlib import Path


SNAPSHOT_FILES = (
    "leaderboard_single.json",
    "leaderboard_multi.json",
    "leaderboard_compare.json",
    "last_updated.json",
)


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


def validate_snapshot_set(source_dir: Path) -> None:
    missing = [name for name in SNAPSHOT_FILES if not (source_dir / name).is_file()]
    if missing:
        raise SystemExit(
            "missing benchmark snapshot file(s): " + ", ".join(sorted(missing))
        )

    single = load_json(source_dir / "leaderboard_single.json")
    multi = load_json(source_dir / "leaderboard_multi.json")
    compare = load_json(source_dir / "leaderboard_compare.json")
    marker = load_json(source_dir / "last_updated.json")

    if not isinstance(single, list):
        raise SystemExit("leaderboard_single.json must be a JSON array")
    if not isinstance(multi, list):
        raise SystemExit("leaderboard_multi.json must be a JSON array")
    if not isinstance(compare, dict) or "groups" not in compare:
        raise SystemExit("leaderboard_compare.json must contain groups")
    if not isinstance(marker, dict) or not marker.get("last_updated"):
        raise SystemExit("last_updated.json must contain last_updated")


def sync_snapshots(source_dir: Path, target_dir: Path, *, check: bool) -> int:
    validate_snapshot_set(source_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    changed: list[str] = []
    for name in SNAPSHOT_FILES:
        source = source_dir / name
        target = target_dir / name
        if target.is_file() and filecmp.cmp(source, target, shallow=False):
            continue
        changed.append(name)
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
