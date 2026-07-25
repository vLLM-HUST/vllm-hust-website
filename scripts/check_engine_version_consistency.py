#!/usr/bin/env python3
"""Sanity-check engine_version vs. git_commit consistency in website snapshots.

Reads ``data/leaderboard_single.json`` and ``data/leaderboard_multi.json`` and
verifies that the ``engine_version`` of every ``vllm-hust`` entry is consistent
with that entry's ``metadata.git_commit``:

* Dev-build ``engine_version`` of the form ``...-g<short_sha>`` must contain
  the short SHA of ``metadata.git_commit`` (first 9 chars). ``vllm`` baselines
  are not checked because their ``git_commit`` field is upstream vLLM's commit
  while their ``engine_version`` is the published wheel version, which need
  not embed a commit SHA.
* Pure-release ``engine_version`` (``0.x.y`` or ``0.x.y.postN``) co-existing
  with a dev-build ``engine_version`` for the same ``metadata.git_commit`` is
  reported as a WARNING (exit code 0): it usually means the same vllm-hust
  commit was benchmarked once against a release wheel and once against a dev
  build, which may be intentional but is worth surfacing on the CI dashboard.

A hard FAILURE (exit code 1) is raised only for the dev-build-vs-commit
mismatch above. Reports are written to stdout in a ``<file>:<entry_id>:
<severity>: <message>`` format so the CI log surfaces each problem entry.

Usage::

    python scripts/check_engine_version_consistency.py [--data-dir DIR]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = REPO_ROOT / "data"
SNAPSHOT_FILES = ("leaderboard_single.json", "leaderboard_multi.json")
ENGINE_VLLM_HUST = "vllm-hust"
DEV_BUILD_SHA_PATTERN = re.compile(r"-g([0-9a-f]{7,40})(?:\.d\d{8})?$", re.IGNORECASE)
RELEASE_VERSION_PATTERN = re.compile(
    r"^\d+\.\d+\.\d+(?:\.post\d+)?(?:\+[A-Za-z0-9._+-]+)?$"
)


def _load_entries(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    except json.JSONDecodeError as exc:
        print(f"{path}: ERROR: invalid JSON: {exc}", file=sys.stderr)
        return []
    if isinstance(payload, list):
        return payload
    return []


def _classify_engine_version(engine_version: str) -> str:
    """Return ``"dev"``, ``"release"``, or ``"unknown"``."""
    if DEV_BUILD_SHA_PATTERN.search(engine_version):
        return "dev"
    if RELEASE_VERSION_PATTERN.match(engine_version):
        return "release"
    return "unknown"


def _extract_short_sha(engine_version: str) -> str:
    match = DEV_BUILD_SHA_PATTERN.search(engine_version)
    return match.group(1).lower() if match else ""


def _entry_engine(entry: dict[str, Any]) -> str:
    return (
        str(entry.get("engine") or (entry.get("metadata") or {}).get("engine") or "")
        .strip()
        .lower()
    )


def _entry_engine_version(entry: dict[str, Any]) -> str:
    metadata = entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
    return str(
        entry.get("engine_version") or metadata.get("engine_version") or ""
    ).strip()


def _entry_git_commit(entry: dict[str, Any]) -> str:
    metadata = entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
    return str(metadata.get("git_commit") or "").strip()


def check_file(
    path: Path, entries: list[dict[str, Any]]
) -> tuple[list[tuple[str, str, str]], list[tuple[str, str, str]]]:
    """Return ``(errors, warnings)`` for *entries* under *path*.

    Each item is ``(entry_id, severity, message)``.
    """
    errors: list[tuple[str, str, str]] = []
    warnings: list[tuple[str, str, str]] = []

    # First pass: bucket git_commit → set of classified engine_version shapes,
    # so we can detect dev-build/release co-existence for the same commit.
    shapes_by_commit: dict[str, set[str]] = {}
    for entry in entries:
        if _entry_engine(entry) != ENGINE_VLLM_HUST:
            continue
        git_commit = _entry_git_commit(entry)
        if len(git_commit) < 9:
            continue
        ev = _entry_engine_version(entry)
        shape = _classify_engine_version(ev)
        if shape == "unknown":
            continue
        shapes_by_commit.setdefault(git_commit[:9], set()).add(shape)

    dev_release_mixed = {
        short: True
        for short, shapes in shapes_by_commit.items()
        if {"dev", "release"}.issubset(shapes)
    }

    for entry in entries:
        if _entry_engine(entry) != ENGINE_VLLM_HUST:
            continue
        entry_id = str(entry.get("entry_id") or "<missing-entry-id>")
        ev = _entry_engine_version(entry)
        git_commit = _entry_git_commit(entry)
        if not ev:
            continue
        if len(git_commit) < 9:
            continue
        short = git_commit[:9].lower()
        shape = _classify_engine_version(ev)

        if shape == "dev":
            short_in_version = _extract_short_sha(ev)
            if short_in_version:
                # git_commit uses --abbrev=9 short form, engine_version uses
                # whatever ``git describe`` produced (often 10 chars), so a
                # match where one is a prefix of the other is legitimate.
                # Reject only when the two disagree on the shared prefix.
                common_len = min(len(short), len(short_in_version))
                if short[:common_len].lower() != short_in_version[:common_len].lower():
                    errors.append(
                        (
                            entry_id,
                            "ERROR",
                            (
                                f"dev-build engine_version {ev!r} embeds "
                                f"git sha {short_in_version!r} but "
                                f"metadata.git_commit is {git_commit[:9]!r}"
                            ),
                        )
                    )
            if dev_release_mixed.get(short):
                warnings.append(
                    (
                        entry_id,
                        "WARNING",
                        (
                            f"dev-build engine_version {ev!r} co-exists with a "
                            f"release engine_version for git_commit "
                            f"{git_commit[:9]!r}; check that this mixture "
                            f"is intentional"
                        ),
                    )
                )
            elif not short_in_version:
                errors.append(
                    (
                        entry_id,
                        "ERROR",
                        (
                            f"engine_version {ev!r} looks dev-build-shaped but no "
                            f"extractable sha; metadata.git_commit={git_commit[:9]!r}"
                        ),
                    )
                )
        elif shape == "release":
            if dev_release_mixed.get(short):
                warnings.append(
                    (
                        entry_id,
                        "WARNING",
                        (
                            f"release engine_version {ev!r} co-exists with a "
                            f"dev-build for git_commit {git_commit[:9]!r}; "
                            f"check that this mixture is intentional"
                        ),
                    )
                )

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        default=str(DEFAULT_DATA_DIR),
        help="Website data directory containing leaderboard_single.json and "
        "leaderboard_multi.json (default: ./data).",
    )
    args = parser.parse_args()
    data_dir = Path(args.data_dir).resolve()

    if not data_dir.is_dir():
        print(f"data dir not found: {data_dir}", file=sys.stderr)
        return 2

    total_errors = 0
    total_warnings = 0
    for filename in SNAPSHOT_FILES:
        path = data_dir / filename
        entries = _load_entries(path)
        if not entries:
            continue
        errors, warnings = check_file(path, entries)
        for entry_id, severity, message in errors:
            print(f"{path}:{entry_id}: {severity}: {message}")
            total_errors += 1
        for entry_id, severity, message in warnings:
            print(f"{path}:{entry_id}: {severity}: {message}")
            total_warnings += 1

    print(
        f"checked {len(SNAPSHOT_FILES)} snapshot file(s); "
        f"errors={total_errors} warnings={total_warnings}"
    )
    return 1 if total_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
