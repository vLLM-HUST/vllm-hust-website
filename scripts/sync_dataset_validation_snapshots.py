#!/usr/bin/env python3
"""Sync the canonical benchmark Dataset Matrix publication into website data/."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


INDEX_FILE = "dataset_validation_index_v1.json"
PROGRAM_FILE = "dataset_program_v1.json"
CHECKSUM_FILE = "SHA256SUMS"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir",
        default="../vllm-hust-benchmark/leaderboard-data/dataset-validation",
    )
    parser.add_argument("--target-dir", default="data")
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def load_json(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"cannot load JSON {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise SystemExit(f"JSON document must be an object: {path}")
    return payload


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_source(source_dir: Path) -> tuple[dict, list[str]]:
    index = load_json(source_dir / INDEX_FILE)
    if index.get("contract_version") != "dataset-validation-index-v1":
        raise SystemExit("unsupported dataset-validation index contract")
    if index.get("program_file") != PROGRAM_FILE:
        raise SystemExit("dataset-validation program is not declared")
    program = load_json(source_dir / PROGRAM_FILE)
    if program.get("contract_version") != "dataset-program-v1":
        raise SystemExit("unsupported dataset program contract")
    primary_ids = [item.get("id") for item in program.get("primary_datasets", [])]
    if primary_ids != [
        "mmlu-pro",
        "hle-verified",
        "swe-bench-pro",
        "frontierscience",
        "terminal-bench-2.1",
    ]:
        raise SystemExit("dataset program does not declare the expected primary set")
    scenarios = index.get("scenarios")
    if not isinstance(scenarios, list) or not scenarios:
        raise SystemExit("dataset-validation index has no scenarios")

    scenario_ids: set[str] = set()
    data_files: list[str] = []
    for scenario in scenarios:
        scenario_id = scenario.get("id") if isinstance(scenario, dict) else None
        data_file = scenario.get("data_file") if isinstance(scenario, dict) else None
        if (
            not isinstance(scenario_id, str)
            or not scenario_id
            or scenario_id in scenario_ids
        ):
            raise SystemExit(f"invalid or duplicate scenario id: {scenario_id}")
        if (
            not isinstance(data_file, str)
            or not data_file.endswith(".json")
            or Path(data_file).name != data_file
            or data_file in data_files
        ):
            raise SystemExit(f"invalid or duplicate scenario data_file: {data_file}")
        artifact = load_json(source_dir / data_file)
        if artifact.get("scenario", {}).get("id") != scenario_id:
            raise SystemExit(f"scenario identity mismatch: {data_file}")
        scenario_ids.add(scenario_id)
        data_files.append(data_file)
    if index.get("default_scenario_id") not in scenario_ids:
        raise SystemExit("dataset-validation default scenario is not declared")

    expected = {INDEX_FILE, PROGRAM_FILE, *data_files}
    try:
        lines = (source_dir / CHECKSUM_FILE).read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise SystemExit(f"missing {CHECKSUM_FILE}") from exc
    checksums: dict[str, str] = {}
    for line in lines:
        parts = line.split(maxsplit=1)
        if len(parts) != 2:
            raise SystemExit(f"invalid checksum line: {line}")
        digest, name = parts[0], parts[1].lstrip("*")
        if len(digest) != 64 or Path(name).name != name or name in checksums:
            raise SystemExit(f"invalid checksum entry: {line}")
        checksums[name] = digest
    if set(checksums) != expected:
        raise SystemExit("SHA256SUMS does not cover the exact publication set")
    for name, digest in checksums.items():
        if sha256(source_dir / name) != digest:
            raise SystemExit(f"checksum mismatch: {name}")
    return index, data_files


def render_website_index(index: dict) -> bytes:
    rendered = dict(index)
    rendered.pop("program_file")
    rendered["program_url"] = f"./data/{PROGRAM_FILE}"
    rendered["scenarios"] = []
    for source in index["scenarios"]:
        scenario = {key: value for key, value in source.items() if key != "data_file"}
        scenario["data_url"] = f"./data/{source['data_file']}"
        rendered["scenarios"].append(scenario)
    return (json.dumps(rendered, indent=2, ensure_ascii=False) + "\n").encode()


def sync_publication(source_dir: Path, target_dir: Path, *, check: bool) -> int:
    source_dir = source_dir.resolve()
    target_dir = target_dir.resolve()
    index, data_files = validate_source(source_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    projections = {
        INDEX_FILE: render_website_index(index),
        PROGRAM_FILE: (source_dir / PROGRAM_FILE).read_bytes(),
    }
    projections.update({name: (source_dir / name).read_bytes() for name in data_files})
    changed: list[str] = []
    for name, content in projections.items():
        target = target_dir / name
        if target.is_file() and target.read_bytes() == content:
            continue
        changed.append(name)
        if not check:
            target.write_bytes(content)
            target.chmod(0o644)

    if check and changed:
        print("website dataset-validation mirror is out of sync:")
        for name in changed:
            print(f"  {name}")
        return 1
    if changed:
        print("synced dataset-validation publication file(s):")
        for name in changed:
            print(f"  {name}")
    else:
        print("dataset-validation publication already in sync")
    return 0


def main() -> int:
    args = parse_args()
    return sync_publication(
        Path(args.source_dir), Path(args.target_dir), check=args.check
    )


if __name__ == "__main__":
    raise SystemExit(main())
