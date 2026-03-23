#!/usr/bin/env python3
"""Aggregate standard benchmark leaderboard exports into website snapshot files."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

try:
    from jsonschema import Draft7Validator
except ImportError as exc:  # pragma: no cover - environment dependent
    raise SystemExit("jsonschema is required: pip install jsonschema") from exc


SUPPORTED_MANIFEST_SCHEMA_VERSIONS = {
    "leaderboard-export-manifest/v1",
    "leaderboard-export-manifest/v2",
}
COMPARE_SNAPSHOT_SCHEMA_VERSION = "leaderboard-compare-snapshot/v1"


def load_schema(schema_path: Path) -> dict[str, Any]:
    return json.loads(schema_path.read_text(encoding="utf-8"))


def validate_entry(
    entry: dict[str, Any], validator: Draft7Validator, *, source: Path
) -> dict[str, Any]:
    errors = sorted(validator.iter_errors(entry), key=lambda error: list(error.path))
    if errors:
        first = errors[0]
        raise ValueError(
            f"{source}: schema validation failed: {first.message} @ {list(first.path)}"
        )
    return entry


def prefer_newer_entry(
    current: dict[str, Any], candidate: dict[str, Any]
) -> dict[str, Any]:
    def parse_timestamp(entry: dict[str, Any]) -> int:
        metadata = entry.get("metadata") or {}
        for field in ("submitted_at", "release_date"):
            raw = metadata.get(field)
            if isinstance(raw, str) and raw:
                try:
                    return int(
                        datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
                    )
                except ValueError:
                    continue
        return 0

    current_ts = parse_timestamp(current)
    candidate_ts = parse_timestamp(candidate)
    if candidate_ts != current_ts:
        return candidate if candidate_ts > current_ts else current

    current_tps = float(current.get("metrics", {}).get("throughput_tps") or 0.0)
    candidate_tps = float(candidate.get("metrics", {}).get("throughput_tps") or 0.0)
    if candidate_tps != current_tps:
        return candidate if candidate_tps > current_tps else current
    return current


def build_idempotency_key(entry: dict[str, Any]) -> str:
    metadata = entry.get("metadata") or {}
    key = metadata.get("idempotency_key")
    if not isinstance(key, str) or not key.strip():
        raise ValueError("leaderboard entry is missing metadata.idempotency_key")
    return key


def extract_workload_name(entry: dict[str, Any]) -> str:
    workload = entry.get("workload") or {}
    if isinstance(workload, dict):
        for key in ("name", "workload_id", "suite_id"):
            value = workload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return "UNKNOWN"


def build_compare_scope_key(entry: dict[str, Any]) -> str:
    model = str((entry.get("model") or {}).get("name") or "unknown-model")
    hardware = str(
        (entry.get("hardware") or {}).get("chip_model") or "unknown-hardware"
    )
    precision = str((entry.get("model") or {}).get("precision") or "unknown-precision")
    workload = extract_workload_name(entry)
    config_type = str(entry.get("config_type") or "unknown-config")
    chip_count = int((entry.get("hardware") or {}).get("chip_count") or 0)
    node_count = int((entry.get("cluster") or {}).get("node_count") or 1)
    return "|".join(
        [
            model,
            hardware,
            precision,
            workload,
            config_type,
            str(chip_count),
            str(node_count),
        ]
    )


def build_compare_engine_summary(entry: dict[str, Any]) -> dict[str, Any]:
    metrics = entry.get("metrics") or {}
    metadata = entry.get("metadata") or {}
    return {
        "engine": str(entry.get("engine") or metadata.get("engine") or "unknown"),
        "engine_version": str(
            entry.get("engine_version") or metadata.get("engine_version") or "unknown"
        ),
        "entry_id": str(entry.get("entry_id") or ""),
        "submitted_at": metadata.get("submitted_at"),
        "canonical_path": entry.get("canonical_path"),
        "metrics": {
            "ttft_ms": float(metrics.get("ttft_ms") or 0.0),
            "tbt_ms": float(metrics.get("tbt_ms") or 0.0),
            "throughput_tps": float(metrics.get("throughput_tps") or 0.0),
            "output_throughput_tps": float(
                metrics.get("output_throughput_tps")
                or metrics.get("throughput_tps")
                or 0.0
            ),
            "error_rate": float(metrics.get("error_rate") or 0.0),
        },
    }


def compute_relative_delta(
    left_value: float | int | None, right_value: float | int | None
) -> float | None:
    if left_value is None or right_value in (None, 0):
        return None
    return round(
        ((float(left_value) - float(right_value)) / abs(float(right_value))) * 100.0, 4
    )


def metric_winner(
    left_value: float | int | None,
    right_value: float | int | None,
    *,
    higher_is_better: bool,
) -> str:
    if left_value is None or right_value is None:
        return "unknown"
    if float(left_value) == float(right_value):
        return "parity"
    if higher_is_better:
        return "left" if float(left_value) > float(right_value) else "right"
    return "left" if float(left_value) < float(right_value) else "right"


def select_preferred_pair(
    entries: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    if len(entries) < 2:
        return None

    ordered = sorted(
        entries,
        key=lambda item: (
            -float((item.get("metrics") or {}).get("throughput_tps") or 0.0),
            float((item.get("metrics") or {}).get("ttft_ms") or float("inf")),
            float((item.get("metrics") or {}).get("tbt_ms") or float("inf")),
            str(
                item.get("engine")
                or (item.get("metadata") or {}).get("engine")
                or "unknown"
            ),
            str(
                item.get("engine_version")
                or (item.get("metadata") or {}).get("engine_version")
                or "unknown"
            ),
        ),
    )
    return ordered[0], ordered[1]


def build_compare_snapshot(entries: list[dict[str, Any]]) -> dict[str, Any]:
    grouped: dict[str, dict[str, Any]] = {}
    for entry in entries:
        scope_key = build_compare_scope_key(entry)
        group = grouped.setdefault(
            scope_key,
            {
                "scope_key": scope_key,
                "scope": {
                    "model": str(
                        (entry.get("model") or {}).get("name") or "unknown-model"
                    ),
                    "hardware": str(
                        (entry.get("hardware") or {}).get("chip_model")
                        or "unknown-hardware"
                    ),
                    "precision": str(
                        (entry.get("model") or {}).get("precision")
                        or "unknown-precision"
                    ),
                    "workload": extract_workload_name(entry),
                    "config_type": str(entry.get("config_type") or "unknown-config"),
                    "chip_count": int(
                        (entry.get("hardware") or {}).get("chip_count") or 0
                    ),
                    "node_count": int(
                        (entry.get("cluster") or {}).get("node_count") or 1
                    ),
                },
                "category": "multi"
                if int((entry.get("cluster") or {}).get("node_count") or 1) > 1
                else "single",
                "entries_by_engine": {},
            },
        )
        engine = str(
            entry.get("engine")
            or (entry.get("metadata") or {}).get("engine")
            or "unknown"
        )
        existing = group["entries_by_engine"].get(engine)
        group["entries_by_engine"][engine] = (
            prefer_newer_entry(existing, entry) if existing is not None else entry
        )

    groups_payload: list[dict[str, Any]] = []
    preferred_pairs: list[dict[str, Any]] = []
    for group in grouped.values():
        representative_entries = list(group["entries_by_engine"].values())
        if len(representative_entries) < 2:
            continue
        preferred_pair = select_preferred_pair(representative_entries)
        if preferred_pair is None:
            continue

        left_entry, right_entry = preferred_pair
        left_summary = build_compare_engine_summary(left_entry)
        right_summary = build_compare_engine_summary(right_entry)
        payload = {
            "scope_key": group["scope_key"],
            "category": group["category"],
            "scope": group["scope"],
            "engines": [
                build_compare_engine_summary(item) for item in representative_entries
            ],
            "preferred_pair": {
                "left": left_summary,
                "right": right_summary,
                "deltas": {
                    "throughput_pct_left_vs_right": compute_relative_delta(
                        left_summary["metrics"]["throughput_tps"],
                        right_summary["metrics"]["throughput_tps"],
                    ),
                    "ttft_pct_left_vs_right": compute_relative_delta(
                        left_summary["metrics"]["ttft_ms"],
                        right_summary["metrics"]["ttft_ms"],
                    ),
                    "tbt_pct_left_vs_right": compute_relative_delta(
                        left_summary["metrics"]["tbt_ms"],
                        right_summary["metrics"]["tbt_ms"],
                    ),
                },
                "winners": {
                    "throughput": metric_winner(
                        left_summary["metrics"]["throughput_tps"],
                        right_summary["metrics"]["throughput_tps"],
                        higher_is_better=True,
                    ),
                    "ttft": metric_winner(
                        left_summary["metrics"]["ttft_ms"],
                        right_summary["metrics"]["ttft_ms"],
                        higher_is_better=False,
                    ),
                    "tbt": metric_winner(
                        left_summary["metrics"]["tbt_ms"],
                        right_summary["metrics"]["tbt_ms"],
                        higher_is_better=False,
                    ),
                },
            },
        }
        groups_payload.append(payload)
        preferred_pairs.append(payload)

    groups_payload.sort(key=lambda item: str(item.get("scope_key") or ""))
    preferred_pairs.sort(key=lambda item: str(item.get("scope_key") or ""))
    return {
        "schema_version": COMPARE_SNAPSHOT_SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).isoformat(),
        "group_count": len(groups_payload),
        "preferred_pair_count": len(preferred_pairs),
        "groups": groups_payload,
        "preferred_pairs": preferred_pairs,
    }


def load_manifest_entries(
    source_dir: Path, validator: Draft7Validator
) -> list[dict[str, Any]]:
    manifest_files = sorted(source_dir.rglob("leaderboard_manifest.json"))
    if not manifest_files:
        raise ValueError(f"No leaderboard_manifest.json found under: {source_dir}")

    entries: list[dict[str, Any]] = []
    for manifest_path in manifest_files:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        if payload.get("schema_version") not in SUPPORTED_MANIFEST_SCHEMA_VERSIONS:
            raise ValueError(
                f"{manifest_path}: unsupported schema_version {payload.get('schema_version')!r}"
            )

        records = payload.get("entries")
        if not isinstance(records, list):
            raise ValueError(f"{manifest_path}: entries must be a list")

        for index, record in enumerate(records):
            if not isinstance(record, dict):
                raise ValueError(f"{manifest_path}: entries[{index}] must be an object")
            artifact_rel = record.get("leaderboard_artifact")
            if not isinstance(artifact_rel, str) or not artifact_rel.strip():
                raise ValueError(
                    f"{manifest_path}: entries[{index}].leaderboard_artifact is required"
                )

            artifact_path = manifest_path.parent / artifact_rel
            if not artifact_path.is_file():
                raise ValueError(
                    f"{manifest_path}: missing leaderboard artifact {artifact_path}"
                )

            payload = json.loads(artifact_path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                raise ValueError(
                    f"{artifact_path}: standard leaderboard artifact must be a JSON object"
                )

            validated = validate_entry(payload, validator, source=artifact_path)

            expected_key = record.get("idempotency_key")
            if expected_key != build_idempotency_key(validated):
                raise ValueError(
                    f"{artifact_path}: metadata.idempotency_key mismatch with {manifest_path}"
                )

            entries.append(validated)
    return entries


def split_entries(
    entries: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    deduped: dict[str, dict[str, Any]] = {}
    for entry in entries:
        key = build_idempotency_key(entry)
        current = deduped.get(key)
        deduped[key] = (
            prefer_newer_entry(current, entry) if current is not None else entry
        )

    single: list[dict[str, Any]] = []
    multi: list[dict[str, Any]] = []
    for entry in deduped.values():
        node_count = int((entry.get("cluster") or {}).get("node_count") or 1)
        if node_count > 1:
            multi.append(entry)
        else:
            single.append(entry)

    def sort_key(item: dict[str, Any]) -> tuple[str, str, str, str]:
        return (
            str(item.get("engine") or ""),
            str(item.get("model", {}).get("name") or ""),
            str(item.get("workload", {}).get("name") or ""),
            str(item.get("metadata", {}).get("submitted_at") or ""),
        )

    single.sort(key=sort_key)
    multi.sort(key=sort_key)
    return single, multi


def write_outputs(
    output_dir: Path,
    single: list[dict[str, Any]],
    multi: list[dict[str, Any]],
    compare: dict[str, Any],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "leaderboard_single.json").write_text(
        json.dumps(single, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output_dir / "leaderboard_multi.json").write_text(
        json.dumps(multi, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output_dir / "leaderboard_compare.json").write_text(
        json.dumps(compare, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output_dir / "last_updated.json").write_text(
        json.dumps(
            {"last_updated": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")}, indent=2
        )
        + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aggregate standard benchmark leaderboard manifests into website data snapshots."
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        required=True,
        help="Benchmark output directory containing leaderboard_manifest.json files.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data",
        help="Website data output directory.",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "data"
        / "schemas"
        / "leaderboard_v1.schema.json",
        help="Path to the website leaderboard schema.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    validator = Draft7Validator(load_schema(args.schema))
    entries = load_manifest_entries(args.source_dir, validator)
    single, multi = split_entries(entries)
    compare = build_compare_snapshot(single + multi)
    write_outputs(args.output_dir, single, multi, compare)

    print("✅ Aggregation complete")
    print(f"  source manifests: {args.source_dir}")
    print(f"  leaderboard_single.json: {len(single)} entries")
    print(f"  leaderboard_multi.json: {len(multi)} entries")
    print(f"  leaderboard_compare.json: {compare['group_count']} compare groups")
    print(f"  output dir: {args.output_dir}")


if __name__ == "__main__":
    main()
