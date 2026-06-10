#!/usr/bin/env python3
"""Aggregate standard benchmark leaderboard exports into website snapshot files."""

from __future__ import annotations

import argparse
import json
import re
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
RENDER_CATEGORY_SINGLE_CHIP = "single_chip"
RENDER_CATEGORY_MULTI_CHIP = "multi_chip"
RENDER_CATEGORY_MULTI_NODE = "multi_node"
RENDER_CATEGORIES = (
    RENDER_CATEGORY_SINGLE_CHIP,
    RENDER_CATEGORY_MULTI_CHIP,
    RENDER_CATEGORY_MULTI_NODE,
)

HARD_CONSTRAINTS_SCHEMA_VERSION = "leaderboard-hard-constraints/v1"
BASELINE_STATUS_OFFICIAL_COVERED = "official-covered"
BASELINE_STATUS_PENDING = "pending-baseline"
BASELINE_STATUS_NONE = "no-baseline-declared"
DIRTY_ENGINE_VERSION_MARKERS = ("path string is null",)
ENGINE_VERSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]*$")
KNOWN_MEMORY_PER_CHIP_GB = {
    # Ascend 910B3 cards in the benchmark fleet expose 64 GB HBM.
    "910b3": 64.0,
    "ascend-910b3": 64.0,
    "ascend 910b3": 64.0,
}
VALID_BASELINE_STATUSES = {
    BASELINE_STATUS_OFFICIAL_COVERED,
    BASELINE_STATUS_PENDING,
    BASELINE_STATUS_NONE,
}
CANONICAL_MODEL_ID_PATTERN = re.compile(
    r"^(?P<registry>[a-z0-9][a-z0-9_-]*):(?P<repo_id>.+)$"
)

GOAL_BASELINE_TARGET = {
    "id": "official-ascend-jan-2026-v0.18.0",
    "label": "Official vLLM 0.18.0 + vllm-ascend v0.18.0",
    "engine": "vllm",
    "engine_version_prefix": "0.18.0",
    "github_repository": "vllm-project/vllm-ascend",
    "vllm_commit": "bcf2be96120005e9aea171927f85055a6a5c0cf6",  # pragma: allowlist secret
    "vllm_ascend_ref": "v0.18.0",
    "vllm_ascend_commit": "e18643f8a4d5bd9990727654318ad069ea0b56e2",  # pragma: allowlist secret
}

HARD_CONSTRAINT_THRESHOLDS = {
    "single_chip_effective_utilization_pct": 90.0,
    "typical_throughput_ratio_vs_baseline": 2.0,
    "typical_ttft_reduction_pct_vs_baseline": 20.0,
    "typical_tpot_reduction_pct_vs_baseline": 20.0,
    "long_context_length": 32768,
    "unit_token_cost_reduction_pct": 30.0,
}


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
    normalize_entry_engine_version(entry)
    normalize_entry_hardware(entry)
    normalize_entry_model(entry)
    normalize_entry_accountable_scope(entry)
    return entry


def short_commit(value: Any) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        return ""
    normalized = normalized.removeprefix("g")
    return normalized[:8]


def sanitize_engine_version(value: Any, *, git_commit: Any = None) -> str:
    raw = str(value or "")
    saw_multiline = "\n" in raw or "\r" in raw
    saw_dirty_marker = any(
        marker in raw.lower() for marker in DIRTY_ENGINE_VERSION_MARKERS
    )

    candidates: list[str] = []
    for line in raw.splitlines() or [raw]:
        normalized = " ".join(str(line).split()).strip()
        if not normalized:
            continue
        if any(marker in normalized.lower() for marker in DIRTY_ENGINE_VERSION_MARKERS):
            saw_dirty_marker = True
            continue
        candidates.append(normalized)

    for candidate in candidates:
        if any(ch.isdigit() for ch in candidate) and ENGINE_VERSION_PATTERN.match(
            candidate
        ):
            return candidate

    if candidates:
        primary = candidates[0]
        if ENGINE_VERSION_PATTERN.match(primary) and not (
            saw_multiline or saw_dirty_marker
        ):
            return primary

    commit_fallback = short_commit(git_commit)
    if commit_fallback:
        return f"g{commit_fallback}"
    return "unknown"


def get_entry_engine_version(entry: dict[str, Any]) -> str:
    metadata = entry.get("metadata") or {}
    return sanitize_engine_version(
        entry.get("engine_version") or metadata.get("engine_version") or "",
        git_commit=metadata.get("git_commit"),
    )


def normalize_entry_engine_version(entry: dict[str, Any]) -> dict[str, Any]:
    metadata = entry.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
        entry["metadata"] = metadata

    normalized = get_entry_engine_version(entry)
    entry["engine_version"] = normalized
    metadata["engine_version"] = normalized
    return entry


def normalize_chip_model_key(chip_model: Any) -> str:
    return str(chip_model or "").strip().lower()


def infer_memory_per_chip_gb(
    chip_model: Any,
    chip_count: Any,
    total_memory_gb: Any,
    memory_per_chip_gb: Any,
) -> float | None:
    if memory_per_chip_gb is not None:
        return float(memory_per_chip_gb)

    try:
        normalized_chip_count = int(chip_count)
    except (TypeError, ValueError):
        normalized_chip_count = 0

    if total_memory_gb is not None and normalized_chip_count > 0:
        return float(total_memory_gb) / normalized_chip_count

    return KNOWN_MEMORY_PER_CHIP_GB.get(normalize_chip_model_key(chip_model))


def infer_total_memory_gb(
    chip_model: Any,
    chip_count: Any,
    total_memory_gb: Any,
    memory_per_chip_gb: Any,
) -> float | None:
    if total_memory_gb is not None:
        return float(total_memory_gb)

    try:
        normalized_chip_count = int(chip_count)
    except (TypeError, ValueError):
        normalized_chip_count = 0

    resolved_memory_per_chip_gb = infer_memory_per_chip_gb(
        chip_model,
        normalized_chip_count,
        total_memory_gb,
        memory_per_chip_gb,
    )
    if resolved_memory_per_chip_gb is None or normalized_chip_count <= 0:
        return None
    return resolved_memory_per_chip_gb * normalized_chip_count


def normalize_entry_hardware(entry: dict[str, Any]) -> dict[str, Any]:
    hardware = entry.get("hardware")
    if not isinstance(hardware, dict):
        return entry

    chip_model = hardware.get("chip_model")
    chip_count = hardware.get("chip_count")
    memory_per_chip_gb = hardware.get("memory_per_chip_gb")
    total_memory_gb = hardware.get("total_memory_gb")

    resolved_memory_per_chip_gb = infer_memory_per_chip_gb(
        chip_model,
        chip_count,
        total_memory_gb,
        memory_per_chip_gb,
    )
    resolved_total_memory_gb = infer_total_memory_gb(
        chip_model,
        chip_count,
        total_memory_gb,
        memory_per_chip_gb,
    )

    hardware["memory_per_chip_gb"] = resolved_memory_per_chip_gb
    hardware["total_memory_gb"] = resolved_total_memory_gb
    return entry


def normalize_baseline_engine(value: Any) -> str:
    return str(value or "").strip().lower()


def normalize_accountable_scope(accountable_scope: dict[str, Any]) -> dict[str, Any]:
    baseline_engine = normalize_baseline_engine(
        accountable_scope.get("baseline_engine")
    )
    declared_baseline_engine = normalize_baseline_engine(
        accountable_scope.get("declared_baseline_engine") or baseline_engine
    )
    baseline_status = str(accountable_scope.get("baseline_status") or "").strip()

    if baseline_status not in VALID_BASELINE_STATUSES:
        if baseline_engine:
            baseline_status = BASELINE_STATUS_OFFICIAL_COVERED
        elif declared_baseline_engine:
            baseline_status = BASELINE_STATUS_PENDING
        else:
            baseline_status = BASELINE_STATUS_NONE

    if baseline_status == BASELINE_STATUS_OFFICIAL_COVERED:
        baseline_engine = baseline_engine or declared_baseline_engine
    else:
        baseline_engine = ""

    accountable_scope["baseline_engine"] = baseline_engine
    accountable_scope["declared_baseline_engine"] = declared_baseline_engine
    accountable_scope["baseline_status"] = baseline_status
    return accountable_scope


def normalize_entry_accountable_scope(entry: dict[str, Any]) -> dict[str, Any]:
    constraints = entry.get("constraints")
    if not isinstance(constraints, dict):
        return entry

    accountable_scope = constraints.get("accountable_scope")
    if not isinstance(accountable_scope, dict):
        return entry

    normalize_accountable_scope(accountable_scope)
    return entry


def parse_canonical_model_id(value: Any) -> tuple[str, str] | None:
    normalized = str(value or "").strip()
    if not normalized:
        return None
    match = CANONICAL_MODEL_ID_PATTERN.match(normalized)
    if not match:
        return None
    return match.group("registry"), match.group("repo_id")


def resolve_model_identity(model_payload: dict[str, Any]) -> dict[str, str]:
    resolved = {
        "canonical_id": str(model_payload.get("canonical_id") or "").strip(),
        "repo_id": str(model_payload.get("repo_id") or "").strip(),
        "short_name": str(model_payload.get("short_name") or "").strip(),
        "display_name": str(model_payload.get("display_name") or "").strip(),
        "name": str(model_payload.get("name") or "").strip(),
    }
    missing = [field for field, value in resolved.items() if not value]
    if missing:
        raise ValueError(
            "leaderboard entry model payload missing normalized identity fields: "
            + ", ".join(missing)
        )

    parsed_canonical = parse_canonical_model_id(resolved["canonical_id"])
    if parsed_canonical is None:
        raise ValueError(
            "leaderboard entry model.canonical_id must match <registry>:<repo_id>"
        )
    if parsed_canonical[1] != resolved["repo_id"]:
        raise ValueError(
            "leaderboard entry model.canonical_id must embed model.repo_id"
        )
    if resolved["name"] != resolved["repo_id"]:
        raise ValueError("leaderboard entry model.name must equal model.repo_id")

    return resolved


def normalize_entry_model(entry: dict[str, Any]) -> dict[str, Any]:
    model = entry.get("model")
    if not isinstance(model, dict):
        return entry

    model.update(resolve_model_identity(model))
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


def sort_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def sort_key(item: dict[str, Any]) -> tuple[str, str, str, str]:
        return (
            str(item.get("engine") or ""),
            str(item.get("model", {}).get("name") or ""),
            str(item.get("workload", {}).get("name") or ""),
            str(item.get("metadata", {}).get("submitted_at") or ""),
        )

    return sorted(entries, key=sort_key)


def dedupe_entries_by_entry_id(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for entry in entries:
        entry_id = str(entry.get("entry_id") or "").strip()
        if not entry_id:
            raise ValueError("leaderboard entry is missing entry_id")
        existing = deduped.get(entry_id)
        deduped[entry_id] = (
            prefer_newer_entry(existing, entry) if existing is not None else entry
        )
    return list(deduped.values())


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


def get_same_spec_payload(entry: dict[str, Any]) -> dict[str, Any]:
    payload = entry.get("same_spec")
    return payload if isinstance(payload, dict) else {}


def get_same_spec_id(entry: dict[str, Any]) -> str | None:
    spec_id = str(get_same_spec_payload(entry).get("spec_id") or "").strip()
    return spec_id or None


def get_same_spec_hash(entry: dict[str, Any]) -> str | None:
    spec_hash = str(
        get_same_spec_payload(entry).get("resolved_spec_hash") or ""
    ).strip()
    return spec_hash or None


def build_setting_signature(entry: dict[str, Any]) -> str:
    same_spec_id = get_same_spec_id(entry)
    if same_spec_id:
        return same_spec_id

    same_spec_hash = get_same_spec_hash(entry)
    if same_spec_hash:
        return same_spec_hash

    workload = entry.get("workload") or {}
    same_spec = get_same_spec_payload(entry)
    server = same_spec.get("resolved_server_parameters") or {}
    client = same_spec.get("resolved_client_parameters") or {}

    input_length = workload.get("input_length")
    output_length = workload.get("output_length")
    tensor_parallel = server.get("tensor_parallel_size")
    pipeline_parallel = server.get("pipeline_parallel_size")
    dtype = server.get("dtype")
    request_rate = client.get("request_rate")
    return "|".join(
        [
            str(input_length if input_length is not None else "unknown-input"),
            str(output_length if output_length is not None else "unknown-output"),
            str(tensor_parallel if tensor_parallel is not None else "unknown-tp"),
            str(pipeline_parallel if pipeline_parallel is not None else "unknown-pp"),
            str(dtype or "unknown-dtype"),
            str(request_rate if request_rate is not None else "unknown-rps"),
        ]
    )


def format_setting_dtype(value: Any) -> str:
    normalized = str(value or "").strip()
    lower = normalized.lower()
    if lower == "float16":
        return "FP16"
    if lower == "bfloat16":
        return "BF16"
    return normalized


def get_compact_spec_label(spec_id: str | None) -> str:
    normalized = str(spec_id or "").strip()
    if not normalized:
        return ""
    if normalized.startswith("official-ascend"):
        return "official spec"
    if len(normalized) > 32:
        return f"spec {normalized[:29]}..."
    return f"spec {normalized}"


def build_setting_summary(entry: dict[str, Any]) -> str:
    workload = entry.get("workload") or {}
    same_spec = get_same_spec_payload(entry)
    server = same_spec.get("resolved_server_parameters") or {}
    client = same_spec.get("resolved_client_parameters") or {}

    parts: list[str] = []

    input_length = workload.get("input_length")
    output_length = workload.get("output_length")
    if input_length is not None or output_length is not None:
        parts.append(
            "IO "
            f"{input_length if input_length is not None else '?'}"
            "/"
            f"{output_length if output_length is not None else '?'}"
        )

    tensor_parallel = server.get("tensor_parallel_size")
    pipeline_parallel = server.get("pipeline_parallel_size")
    parallel_parts: list[str] = []
    if tensor_parallel is not None:
        parallel_parts.append(f"TP{tensor_parallel}")
    if pipeline_parallel is not None:
        parallel_parts.append(f"PP{pipeline_parallel}")
    if parallel_parts:
        parts.append(" ".join(parallel_parts))

    dtype = server.get("dtype")
    dtype_label = format_setting_dtype(dtype)
    if dtype_label:
        parts.append(dtype_label)

    request_rate = client.get("request_rate")
    if request_rate is not None:
        parts.append(f"RPS {request_rate}")

    batch_size = workload.get("batch_size")
    if batch_size not in (None, ""):
        parts.append(f"BS {batch_size}")

    concurrency = workload.get("concurrent_requests")
    if concurrency not in (None, ""):
        parts.append(f"CC {concurrency}")

    spec_id = get_same_spec_id(entry)
    spec_label = get_compact_spec_label(spec_id)
    if spec_label:
        parts.append(spec_label)

    return " • ".join(parts) if parts else "default settings"


def same_spec_hashes_match(
    left_entry: dict[str, Any], right_entry: dict[str, Any]
) -> bool:
    left_hash = get_same_spec_hash(left_entry)
    right_hash = get_same_spec_hash(right_entry)
    if left_hash and right_hash and left_hash == right_hash:
        return True

    left_spec_id = get_same_spec_id(left_entry)
    right_spec_id = get_same_spec_id(right_entry)
    return bool(left_spec_id and right_spec_id and left_spec_id == right_spec_id)


def build_compare_scope_key(entry: dict[str, Any]) -> str:
    model = str((entry.get("model") or {}).get("canonical_id") or "unknown-model")
    hardware = str(
        (entry.get("hardware") or {}).get("chip_model") or "unknown-hardware"
    )
    precision = str((entry.get("model") or {}).get("precision") or "unknown-precision")
    workload = extract_workload_name(entry)
    config_type = str(entry.get("config_type") or "unknown-config")
    chip_count = int((entry.get("hardware") or {}).get("chip_count") or 0)
    node_count = int((entry.get("cluster") or {}).get("node_count") or 1)
    setting_signature = build_setting_signature(entry)
    return "|".join(
        [
            model,
            hardware,
            precision,
            workload,
            config_type,
            str(chip_count),
            str(node_count),
            setting_signature,
        ]
    )


def build_goal_scope_key(entry: dict[str, Any]) -> str:
    return build_compare_scope_key(entry)


def build_compare_engine_summary(entry: dict[str, Any]) -> dict[str, Any]:
    metrics = entry.get("metrics") or {}
    constraints = (entry.get("constraints") or {}).get("metrics") or {}
    metadata = entry.get("metadata") or {}
    return {
        "engine": str(entry.get("engine") or metadata.get("engine") or "unknown"),
        "engine_version": get_entry_engine_version(entry),
        "entry_id": str(entry.get("entry_id") or ""),
        "submitted_at": metadata.get("submitted_at"),
        "canonical_path": entry.get("canonical_path"),
        "github_repository": metadata.get("github_repository"),
        "git_commit": metadata.get("git_commit"),
        "same_spec": {
            "spec_id": get_same_spec_id(entry),
            "resolved_spec_hash": get_same_spec_hash(entry),
        },
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
        "constraints": {
            "single_chip_effective_utilization_pct": safe_float(
                constraints.get("single_chip_effective_utilization_pct")
            ),
            "typical_throughput_ratio_vs_baseline": safe_float(
                constraints.get("typical_throughput_ratio_vs_baseline")
            ),
            "typical_ttft_reduction_pct_vs_baseline": safe_float(
                constraints.get("typical_ttft_reduction_pct_vs_baseline")
            ),
            "typical_tpot_reduction_pct_vs_baseline": safe_float(
                constraints.get("typical_tpot_reduction_pct_vs_baseline")
            ),
            "long_context_length": safe_float(constraints.get("long_context_length")),
            "long_context_throughput_stable": safe_bool(
                constraints.get("long_context_throughput_stable")
            ),
            "long_context_ttft_p95_ms": safe_float(
                constraints.get("long_context_ttft_p95_ms")
            ),
            "long_context_ttft_p99_ms": safe_float(
                constraints.get("long_context_ttft_p99_ms")
            ),
            "long_context_tpot_p95_ms": safe_float(
                constraints.get("long_context_tpot_p95_ms")
            ),
            "long_context_tpot_p99_ms": safe_float(
                constraints.get("long_context_tpot_p99_ms")
            ),
            "long_context_ttft_p95_stable": safe_bool(
                constraints.get("long_context_ttft_p95_stable")
            ),
            "long_context_ttft_p99_stable": safe_bool(
                constraints.get("long_context_ttft_p99_stable")
            ),
            "long_context_tpot_p95_stable": safe_bool(
                constraints.get("long_context_tpot_p95_stable")
            ),
            "long_context_tpot_p99_stable": safe_bool(
                constraints.get("long_context_tpot_p99_stable")
            ),
            "unit_token_cost_reduction_pct": safe_float(
                constraints.get("unit_token_cost_reduction_pct")
            ),
            "multi_tenant_high_utilization": safe_bool(
                constraints.get("multi_tenant_high_utilization")
            ),
        },
    }


def parse_entry_timestamp(entry: dict[str, Any]) -> int:
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


def classify_render_category(entry: dict[str, Any]) -> str:
    config_type = str(entry.get("config_type") or "")
    chip_count = int((entry.get("hardware") or {}).get("chip_count") or 1)
    node_count = int((entry.get("cluster") or {}).get("node_count") or 1)
    if node_count > 1 or config_type == "multi_node":
        return RENDER_CATEGORY_MULTI_NODE
    if chip_count > 1 or config_type == "multi_gpu":
        return RENDER_CATEGORY_MULTI_CHIP
    return RENDER_CATEGORY_SINGLE_CHIP


def bucket_entries_by_render_category(
    entries: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    bucketed: dict[str, list[dict[str, Any]]] = {
        category: [] for category in RENDER_CATEGORIES
    }
    for entry in dedupe_entries_by_entry_id(entries):
        bucketed[classify_render_category(entry)].append(entry)

    for category in RENDER_CATEGORIES:
        bucketed[category] = sort_entries(bucketed[category])
    return bucketed


def load_existing_snapshot_entries(
    output_dir: Path, validator: Draft7Validator
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for file_name in ("leaderboard_single.json", "leaderboard_multi.json"):
        snapshot_path = output_dir / file_name
        if not snapshot_path.is_file():
            continue

        payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise ValueError(f"{snapshot_path}: snapshot payload must be a list")

        for index, item in enumerate(payload):
            if not isinstance(item, dict):
                raise ValueError(
                    f"{snapshot_path}: entries[{index}] must be a JSON object"
                )
            entries.append(validate_entry(item, validator, source=snapshot_path))
    return entries


def merge_snapshot_entries_by_category(
    existing_entries: list[dict[str, Any]],
    incoming_entries: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], set[str]]:
    existing_bucketed = bucket_entries_by_render_category(existing_entries)
    incoming_bucketed = bucket_entries_by_render_category(incoming_entries)
    touched_categories = {
        category
        for category, category_entries in incoming_bucketed.items()
        if category_entries
    }

    merged_bucketed: dict[str, list[dict[str, Any]]] = {}
    for category in RENDER_CATEGORIES:
        if category in touched_categories:
            merged_bucketed[category] = sort_entries(
                dedupe_entries_by_entry_id(
                    existing_bucketed[category] + incoming_bucketed[category]
                )
            )
        else:
            merged_bucketed[category] = existing_bucketed[category]

    single_entries = sort_entries(merged_bucketed[RENDER_CATEGORY_SINGLE_CHIP])
    multi_entries = sort_entries(
        merged_bucketed[RENDER_CATEGORY_MULTI_CHIP]
        + merged_bucketed[RENDER_CATEGORY_MULTI_NODE]
    )
    return single_entries, multi_entries, touched_categories


def safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    return None


def build_hard_constraint_scope_key(entry: dict[str, Any]) -> str:
    constraints = entry.get("constraints") or {}
    accountable_scope = constraints.get("accountable_scope") or {}
    accountable_scope = normalize_accountable_scope(accountable_scope)
    model = str((entry.get("model") or {}).get("name") or "unknown-model")
    hardware = str(
        (entry.get("hardware") or {}).get("chip_model") or "unknown-hardware"
    )
    workload = extract_workload_name(entry)
    config_type = str(entry.get("config_type") or "unknown-config")
    representative_business_scenario = str(
        accountable_scope.get("representative_business_scenario")
        or "unknown-business-scenario"
    )
    baseline_engine = str(
        accountable_scope.get("declared_baseline_engine")
        or accountable_scope.get("baseline_engine")
        or "unknown-baseline"
    )
    return "|".join(
        [
            str(entry.get("engine") or "unknown-engine"),
            model,
            hardware,
            workload,
            config_type,
            representative_business_scenario,
            baseline_engine,
        ]
    )


def evaluate_hard_constraints(entry: dict[str, Any]) -> dict[str, Any]:
    constraints = entry.get("constraints") or {}
    metrics = constraints.get("metrics") or {}

    utilization = safe_float(metrics.get("single_chip_effective_utilization_pct"))
    throughput_ratio = safe_float(metrics.get("typical_throughput_ratio_vs_baseline"))
    ttft_reduction = safe_float(metrics.get("typical_ttft_reduction_pct_vs_baseline"))
    tpot_reduction = safe_float(metrics.get("typical_tpot_reduction_pct_vs_baseline"))
    long_context_length = safe_float(metrics.get("long_context_length"))
    long_context_throughput_stable = safe_bool(
        metrics.get("long_context_throughput_stable")
    )
    long_context_ttft_p95_stable = safe_bool(
        metrics.get("long_context_ttft_p95_stable")
    )
    long_context_ttft_p99_stable = safe_bool(
        metrics.get("long_context_ttft_p99_stable")
    )
    long_context_tpot_p95_stable = safe_bool(
        metrics.get("long_context_tpot_p95_stable")
    )
    long_context_tpot_p99_stable = safe_bool(
        metrics.get("long_context_tpot_p99_stable")
    )
    unit_token_cost_reduction = safe_float(metrics.get("unit_token_cost_reduction_pct"))
    multi_tenant_high_utilization = safe_bool(
        metrics.get("multi_tenant_high_utilization")
    )

    checks = {
        "effective_utilization_ge_90": (
            utilization is not None
            and utilization
            >= HARD_CONSTRAINT_THRESHOLDS["single_chip_effective_utilization_pct"]
        ),
        "typical_scene_ge_2x_and_ttft_tpot_reduction_gt_20": (
            throughput_ratio is not None
            and throughput_ratio
            >= HARD_CONSTRAINT_THRESHOLDS["typical_throughput_ratio_vs_baseline"]
            and ttft_reduction is not None
            and ttft_reduction
            > HARD_CONSTRAINT_THRESHOLDS["typical_ttft_reduction_pct_vs_baseline"]
            and tpot_reduction is not None
            and tpot_reduction
            > HARD_CONSTRAINT_THRESHOLDS["typical_tpot_reduction_pct_vs_baseline"]
        ),
        "long_context_ge_32k_and_p95_p99_stable": (
            long_context_length is not None
            and long_context_length >= HARD_CONSTRAINT_THRESHOLDS["long_context_length"]
            and long_context_throughput_stable is True
            and long_context_ttft_p95_stable is True
            and long_context_ttft_p99_stable is True
            and long_context_tpot_p95_stable is True
            and long_context_tpot_p99_stable is True
        ),
        "single_business_cost_down_ge_30_and_multi_tenant_high_utilization": (
            unit_token_cost_reduction is not None
            and unit_token_cost_reduction
            >= HARD_CONSTRAINT_THRESHOLDS["unit_token_cost_reduction_pct"]
            and multi_tenant_high_utilization is True
        ),
    }

    return {
        "checks": checks,
        "overall_pass": all(checks.values()),
        "metrics": {
            "single_chip_effective_utilization_pct": utilization,
            "typical_throughput_ratio_vs_baseline": throughput_ratio,
            "typical_ttft_reduction_pct_vs_baseline": ttft_reduction,
            "typical_tpot_reduction_pct_vs_baseline": tpot_reduction,
            "long_context_length": long_context_length,
            "long_context_throughput_stable": long_context_throughput_stable,
            "long_context_ttft_p95_ms": safe_float(
                metrics.get("long_context_ttft_p95_ms")
            ),
            "long_context_ttft_p99_ms": safe_float(
                metrics.get("long_context_ttft_p99_ms")
            ),
            "long_context_tpot_p95_ms": safe_float(
                metrics.get("long_context_tpot_p95_ms")
            ),
            "long_context_tpot_p99_ms": safe_float(
                metrics.get("long_context_tpot_p99_ms")
            ),
            "long_context_ttft_p95_stable": long_context_ttft_p95_stable,
            "long_context_ttft_p99_stable": long_context_ttft_p99_stable,
            "long_context_tpot_p95_stable": long_context_tpot_p95_stable,
            "long_context_tpot_p99_stable": long_context_tpot_p99_stable,
            "unit_token_cost_reduction_pct": unit_token_cost_reduction,
            "multi_tenant_high_utilization": multi_tenant_high_utilization,
        },
        "thresholds": HARD_CONSTRAINT_THRESHOLDS,
    }


def summarize_hard_constraint_entry(entry: dict[str, Any]) -> dict[str, Any]:
    metadata = entry.get("metadata") or {}
    constraints = entry.get("constraints") or {}
    evaluated = evaluate_hard_constraints(entry)
    return {
        "entry_id": str(entry.get("entry_id") or ""),
        "engine": str(entry.get("engine") or metadata.get("engine") or "unknown"),
        "engine_version": get_entry_engine_version(entry),
        "submitted_at": metadata.get("submitted_at"),
        "git_commit": metadata.get("git_commit"),
        "scenario_source": constraints.get("scenario_source"),
        "accountable_scope": constraints.get("accountable_scope"),
        "evaluation": evaluated,
    }


def is_hard_constraint_subject_entry(entry: dict[str, Any]) -> bool:
    return str(entry.get("engine") or "").strip().lower() == "vllm-hust"


def compute_metric_delta(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return round(current - previous, 4)


def count_passed_hard_constraint_checks(evaluation: dict[str, Any]) -> int:
    checks = evaluation.get("checks") or {}
    return sum(1 for value in checks.values() if value is True)


def count_known_hard_constraint_signals(metrics: dict[str, Any]) -> int:
    numeric_fields = (
        "single_chip_effective_utilization_pct",
        "typical_throughput_ratio_vs_baseline",
        "typical_ttft_reduction_pct_vs_baseline",
        "typical_tpot_reduction_pct_vs_baseline",
        "long_context_length",
        "unit_token_cost_reduction_pct",
    )
    boolean_fields = (
        "long_context_throughput_stable",
        "long_context_ttft_p95_stable",
        "long_context_ttft_p99_stable",
        "long_context_tpot_p95_stable",
        "long_context_tpot_p99_stable",
        "multi_tenant_high_utilization",
    )
    numeric_count = sum(1 for field in numeric_fields if metrics.get(field) is not None)
    boolean_count = sum(
        1 for field in boolean_fields if isinstance(metrics.get(field), bool)
    )
    return numeric_count + boolean_count


def _hard_constraint_numeric_sort_value(value: Any) -> float:
    return float(value) if value is not None else -1.0


def _parse_hard_constraint_summary_timestamp(summary: dict[str, Any]) -> int:
    raw = summary.get("submitted_at")
    if not isinstance(raw, str) or not raw:
        return 0
    try:
        return int(datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp())
    except ValueError:
        return 0


def build_hard_constraint_scope_sort_key(
    scope_payload: dict[str, Any],
) -> tuple[Any, ...]:
    latest = scope_payload.get("latest") or {}
    evaluation = latest.get("evaluation") or {}
    metrics = evaluation.get("metrics") or {}
    stability_score = sum(
        1
        for field in (
            "long_context_throughput_stable",
            "long_context_ttft_p95_stable",
            "long_context_ttft_p99_stable",
            "long_context_tpot_p95_stable",
            "long_context_tpot_p99_stable",
        )
        if metrics.get(field) is True
    )
    return (
        int(bool(scope_payload.get("overall_pass"))),
        count_passed_hard_constraint_checks(evaluation),
        count_known_hard_constraint_signals(metrics),
        _hard_constraint_numeric_sort_value(
            metrics.get("typical_throughput_ratio_vs_baseline")
        ),
        _hard_constraint_numeric_sort_value(
            metrics.get("typical_ttft_reduction_pct_vs_baseline")
        ),
        _hard_constraint_numeric_sort_value(
            metrics.get("typical_tpot_reduction_pct_vs_baseline")
        ),
        _hard_constraint_numeric_sort_value(
            metrics.get("single_chip_effective_utilization_pct")
        ),
        _hard_constraint_numeric_sort_value(
            metrics.get("unit_token_cost_reduction_pct")
        ),
        _hard_constraint_numeric_sort_value(metrics.get("long_context_length")),
        stability_score,
        int(metrics.get("multi_tenant_high_utilization") is True),
        _parse_hard_constraint_summary_timestamp(latest),
    )


def build_hard_constraint_snapshot(entries: list[dict[str, Any]]) -> dict[str, Any]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        if not is_hard_constraint_subject_entry(entry):
            continue
        key = build_hard_constraint_scope_key(entry)
        grouped.setdefault(key, []).append(entry)

    scopes_payload: list[dict[str, Any]] = []
    for scope_key, scope_entries in grouped.items():
        ordered = sorted(scope_entries, key=parse_entry_timestamp, reverse=True)
        latest = ordered[0]
        previous = ordered[1] if len(ordered) > 1 else None
        latest_summary = summarize_hard_constraint_entry(latest)
        previous_summary = (
            summarize_hard_constraint_entry(previous) if previous else None
        )

        latest_metrics = latest_summary["evaluation"]["metrics"]
        previous_metrics = (
            previous_summary["evaluation"]["metrics"] if previous_summary else {}
        )
        metric_deltas = {
            "single_chip_effective_utilization_pct": compute_metric_delta(
                latest_metrics.get("single_chip_effective_utilization_pct"),
                previous_metrics.get("single_chip_effective_utilization_pct"),
            ),
            "typical_throughput_ratio_vs_baseline": compute_metric_delta(
                latest_metrics.get("typical_throughput_ratio_vs_baseline"),
                previous_metrics.get("typical_throughput_ratio_vs_baseline"),
            ),
            "typical_ttft_reduction_pct_vs_baseline": compute_metric_delta(
                latest_metrics.get("typical_ttft_reduction_pct_vs_baseline"),
                previous_metrics.get("typical_ttft_reduction_pct_vs_baseline"),
            ),
            "typical_tpot_reduction_pct_vs_baseline": compute_metric_delta(
                latest_metrics.get("typical_tpot_reduction_pct_vs_baseline"),
                previous_metrics.get("typical_tpot_reduction_pct_vs_baseline"),
            ),
            "unit_token_cost_reduction_pct": compute_metric_delta(
                latest_metrics.get("unit_token_cost_reduction_pct"),
                previous_metrics.get("unit_token_cost_reduction_pct"),
            ),
        }

        constraints = latest.get("constraints") or {}
        scope = {
            "engine": str(latest.get("engine") or "unknown"),
            "model": str((latest.get("model") or {}).get("name") or "unknown-model"),
            "model_canonical_id": str(
                (latest.get("model") or {}).get("canonical_id") or ""
            ),
            "model_short_name": str(
                (latest.get("model") or {}).get("short_name") or ""
            ),
            "model_display_name": str(
                (latest.get("model") or {}).get("display_name") or ""
            ),
            "hardware": str(
                (latest.get("hardware") or {}).get("chip_model") or "unknown-hardware"
            ),
            "workload": extract_workload_name(latest),
            "config_type": str(latest.get("config_type") or "unknown-config"),
            "accountable_scope": constraints.get("accountable_scope"),
        }

        scopes_payload.append(
            {
                "scope_key": scope_key,
                "scope": scope,
                "latest": latest_summary,
                "previous": previous_summary,
                "metric_deltas": metric_deltas,
                "overall_pass": bool(latest_summary["evaluation"]["overall_pass"]),
            }
        )

    scopes_payload = sorted(
        scopes_payload,
        key=lambda item: (
            build_hard_constraint_scope_sort_key(item),
            str(item.get("scope_key") or ""),
        ),
        reverse=True,
    )
    for index, item in enumerate(scopes_payload, start=1):
        item["selection_rank"] = index

    total = len(scopes_payload)
    pass_count = sum(1 for item in scopes_payload if item.get("overall_pass"))
    return {
        "schema_version": HARD_CONSTRAINTS_SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).isoformat(),
        "scope_count": total,
        "pass_count": pass_count,
        "fail_count": max(total - pass_count, 0),
        "best_scope_key": scopes_payload[0]["scope_key"] if scopes_payload else None,
        "scopes": scopes_payload,
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

    same_spec_entries = [
        entry for entry in entries if get_same_spec_hash(entry) is not None
    ]
    if same_spec_entries:
        cross_engine_pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
        same_engine_pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
        ordered_same_spec = sorted(
            same_spec_entries,
            key=lambda item: (
                parse_entry_timestamp(item),
                float((item.get("metrics") or {}).get("throughput_tps") or 0.0),
            ),
            reverse=True,
        )
        for left_index, left_entry in enumerate(ordered_same_spec):
            for right_entry in ordered_same_spec[left_index + 1 :]:
                if same_spec_hashes_match(left_entry, right_entry):
                    left_engine = str(
                        left_entry.get("engine")
                        or (left_entry.get("metadata") or {}).get("engine")
                        or "unknown"
                    )
                    right_engine = str(
                        right_entry.get("engine")
                        or (right_entry.get("metadata") or {}).get("engine")
                        or "unknown"
                    )
                    if left_engine != right_engine:
                        cross_engine_pairs.append((left_entry, right_entry))
                    else:
                        same_engine_pairs.append((left_entry, right_entry))
        matching_pairs = cross_engine_pairs or same_engine_pairs
        if not matching_pairs:
            return None

        entries = list(matching_pairs[0])

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


def is_goal_baseline_entry(entry: dict[str, Any]) -> bool:
    metadata = entry.get("metadata") or {}
    engine = (
        str(entry.get("engine") or metadata.get("engine") or "unknown").strip().lower()
    )
    engine_version = get_entry_engine_version(entry)
    github_repository = str(metadata.get("github_repository") or "").strip().lower()
    return (
        engine == GOAL_BASELINE_TARGET["engine"]
        and engine_version.startswith(GOAL_BASELINE_TARGET["engine_version_prefix"])
        and github_repository == GOAL_BASELINE_TARGET["github_repository"]
    )


def compute_remaining_gap(
    current_value: float | int | None,
    baseline_value: float | int | None,
    *,
    higher_is_better: bool,
) -> float | None:
    if current_value is None or baseline_value in (None, 0):
        return None

    current = float(current_value)
    baseline = float(baseline_value)
    if higher_is_better:
        if current >= baseline:
            return 0.0
        return round(((baseline - current) / abs(baseline)) * 100.0, 4)

    if current <= baseline:
        return 0.0
    return round(((current - baseline) / abs(baseline)) * 100.0, 4)


def select_goal_pair(
    entries: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    current_candidates = [
        entry
        for entry in entries
        if str(entry.get("engine") or "").strip().lower() == "vllm-hust"
    ]
    baseline_candidates = [entry for entry in entries if is_goal_baseline_entry(entry)]

    if not current_candidates or not baseline_candidates:
        return None

    current_with_same_spec = [
        entry for entry in current_candidates if get_same_spec_hash(entry) is not None
    ]
    baseline_by_hash: dict[str, dict[str, Any]] = {}
    for entry in sorted(baseline_candidates, key=parse_entry_timestamp, reverse=True):
        spec_hash = get_same_spec_hash(entry)
        if spec_hash is None or spec_hash in baseline_by_hash:
            continue
        baseline_by_hash[spec_hash] = entry

    if current_with_same_spec and baseline_by_hash:
        for entry in sorted(
            current_with_same_spec, key=parse_entry_timestamp, reverse=True
        ):
            spec_hash = get_same_spec_hash(entry)
            if spec_hash is None:
                continue
            baseline_entry = baseline_by_hash.get(spec_hash)
            if baseline_entry is not None:
                return entry, baseline_entry
        return None

    current_entry = sorted(current_candidates, key=parse_entry_timestamp, reverse=True)[
        0
    ]
    baseline_entry = sorted(
        baseline_candidates, key=parse_entry_timestamp, reverse=True
    )[0]
    return current_entry, baseline_entry


def validate_same_spec_goal_pairs(entries: list[dict[str, Any]]) -> None:
    grouped: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for entry in entries:
        is_current = str(entry.get("engine") or "").strip().lower() == "vllm-hust"
        is_baseline = is_goal_baseline_entry(entry)
        if not is_current and not is_baseline:
            continue

        spec_id = get_same_spec_id(entry)
        if spec_id is None:
            continue

        role = "baseline" if is_baseline else "current"
        grouped.setdefault(spec_id, {}).setdefault(role, []).append(entry)

    for spec_id, role_entries in grouped.items():
        current_entries = role_entries.get("current") or []
        baseline_entries = role_entries.get("baseline") or []
        if not current_entries or not baseline_entries:
            continue

        current_entry = sorted(
            current_entries, key=parse_entry_timestamp, reverse=True
        )[0]
        baseline_entry = sorted(
            baseline_entries, key=parse_entry_timestamp, reverse=True
        )[0]
        if not same_spec_hashes_match(current_entry, baseline_entry):
            current_hash = get_same_spec_hash(current_entry)
            baseline_hash = get_same_spec_hash(baseline_entry)
            raise ValueError(
                "same-spec goal pair signature mismatch: "
                f"spec_id={spec_id} current_hash={current_hash} "
                f"baseline_hash={baseline_hash}"
            )


def validate_same_spec_compare_pairs(entries: list[dict[str, Any]]) -> None:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        if get_same_spec_hash(entry) is None:
            continue
        scope_key = build_compare_scope_key(entry)
        grouped.setdefault(scope_key, []).append(entry)

    for scope_key, scope_entries in grouped.items():
        engines = {
            str(
                entry.get("engine")
                or (entry.get("metadata") or {}).get("engine")
                or "unknown"
            )
            for entry in scope_entries
        }
        if len(engines) < 2:
            continue
        if select_preferred_pair(scope_entries) is None:
            hashes = sorted(
                {
                    get_same_spec_hash(entry)
                    for entry in scope_entries
                    if get_same_spec_hash(entry) is not None
                }
            )
            raise ValueError(
                "same-spec compare pair resolved_spec_hash mismatch: "
                f"scope_key={scope_key} hashes={hashes}"
            )


def build_goal_progress_snapshot(entries: list[dict[str, Any]]) -> dict[str, Any]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        scope_key = build_goal_scope_key(entry)
        grouped.setdefault(scope_key, []).append(entry)

    pairs: list[dict[str, Any]] = []
    for scope_key, scope_entries in grouped.items():
        goal_pair = select_goal_pair(scope_entries)
        if goal_pair is None:
            continue

        current_entry, baseline_entry = goal_pair
        current_summary = build_compare_engine_summary(current_entry)
        baseline_summary = build_compare_engine_summary(baseline_entry)
        payload = {
            "scope_key": scope_key,
            "category": "multi"
            if int((current_entry.get("cluster") or {}).get("node_count") or 1) > 1
            else "single",
            "scope": {
                "model": str(
                    (current_entry.get("model") or {}).get("name") or "unknown-model"
                ),
                "model_canonical_id": str(
                    (current_entry.get("model") or {}).get("canonical_id") or ""
                ),
                "model_short_name": str(
                    (current_entry.get("model") or {}).get("short_name") or ""
                ),
                "model_display_name": str(
                    (current_entry.get("model") or {}).get("display_name") or ""
                ),
                "hardware": str(
                    (current_entry.get("hardware") or {}).get("chip_model")
                    or "unknown-hardware"
                ),
                "precision": str(
                    (current_entry.get("model") or {}).get("precision")
                    or "unknown-precision"
                ),
                "workload": extract_workload_name(current_entry),
                "config_type": str(
                    current_entry.get("config_type") or "unknown-config"
                ),
                "chip_count": int(
                    (current_entry.get("hardware") or {}).get("chip_count") or 0
                ),
                "node_count": int(
                    (current_entry.get("cluster") or {}).get("node_count") or 1
                ),
                "setting_signature": build_setting_signature(current_entry),
                "setting_summary": build_setting_summary(current_entry),
            },
            "current": current_summary,
            "baseline": baseline_summary,
            "baseline_target": GOAL_BASELINE_TARGET,
            "deltas": {
                "throughput_pct_current_vs_baseline": compute_relative_delta(
                    current_summary["metrics"]["throughput_tps"],
                    baseline_summary["metrics"]["throughput_tps"],
                ),
                "ttft_pct_current_vs_baseline": compute_relative_delta(
                    current_summary["metrics"]["ttft_ms"],
                    baseline_summary["metrics"]["ttft_ms"],
                ),
                "tbt_pct_current_vs_baseline": compute_relative_delta(
                    current_summary["metrics"]["tbt_ms"],
                    baseline_summary["metrics"]["tbt_ms"],
                ),
            },
            "remaining_gap_pct": {
                "throughput": compute_remaining_gap(
                    current_summary["metrics"]["throughput_tps"],
                    baseline_summary["metrics"]["throughput_tps"],
                    higher_is_better=True,
                ),
                "ttft": compute_remaining_gap(
                    current_summary["metrics"]["ttft_ms"],
                    baseline_summary["metrics"]["ttft_ms"],
                    higher_is_better=False,
                ),
                "tbt": compute_remaining_gap(
                    current_summary["metrics"]["tbt_ms"],
                    baseline_summary["metrics"]["tbt_ms"],
                    higher_is_better=False,
                ),
            },
        }
        payload["meets_goal"] = all(
            gap == 0.0
            for gap in payload["remaining_gap_pct"].values()
            if gap is not None
        )
        pairs.append(payload)

    pairs.sort(
        key=lambda item: (
            -parse_entry_timestamp(
                {"metadata": {"submitted_at": item["current"].get("submitted_at")}}
            ),
            str(item.get("scope_key") or ""),
        )
    )

    return {
        "baseline": GOAL_BASELINE_TARGET,
        "pair_count": len(pairs),
        "headline_pair": pairs[0] if pairs else None,
        "pairs": pairs,
    }


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
                    "model_canonical_id": str(
                        (entry.get("model") or {}).get("canonical_id") or ""
                    ),
                    "model_short_name": str(
                        (entry.get("model") or {}).get("short_name") or ""
                    ),
                    "model_display_name": str(
                        (entry.get("model") or {}).get("display_name") or ""
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
                    "setting_signature": build_setting_signature(entry),
                    "setting_summary": build_setting_summary(entry),
                },
                "category": "multi"
                if int((entry.get("cluster") or {}).get("node_count") or 1) > 1
                else "single",
                "all_entries": [],
                "entries_by_engine": {},
            },
        )
        group["all_entries"].append(entry)
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
        preferred_pair_entries = group["all_entries"]
        if not any(
            get_same_spec_hash(entry) is not None for entry in preferred_pair_entries
        ):
            preferred_pair_entries = representative_entries
        preferred_pair = select_preferred_pair(preferred_pair_entries)
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
    hard_constraints = build_hard_constraint_snapshot(entries)
    goal_progress = build_goal_progress_snapshot(entries)
    return {
        "schema_version": COMPARE_SNAPSHOT_SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).isoformat(),
        "group_count": len(groups_payload),
        "preferred_pair_count": len(preferred_pairs),
        "groups": groups_payload,
        "preferred_pairs": preferred_pairs,
        "goal_progress": goal_progress,
        "hard_constraints": hard_constraints,
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
    bucketed = bucket_entries_by_render_category(entries)
    single_entries = sort_entries(bucketed[RENDER_CATEGORY_SINGLE_CHIP])
    multi_entries = sort_entries(
        bucketed[RENDER_CATEGORY_MULTI_CHIP] + bucketed[RENDER_CATEGORY_MULTI_NODE]
    )
    return single_entries, multi_entries


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
        "--replace-all",
        action="store_true",
        help=(
            "Rebuild all website snapshot categories from the current source-dir "
            "instead of preserving untouched categories from the existing output-dir."
        ),
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
    incoming_entries = load_manifest_entries(args.source_dir, validator)
    existing_entries = []
    touched_categories: set[str] = set(RENDER_CATEGORIES)
    if args.replace_all:
        single, multi = split_entries(incoming_entries)
    else:
        existing_entries = load_existing_snapshot_entries(args.output_dir, validator)
        single, multi, touched_categories = merge_snapshot_entries_by_category(
            existing_entries, incoming_entries
        )

    merged_entries = single + multi
    validate_same_spec_goal_pairs(merged_entries)
    validate_same_spec_compare_pairs(merged_entries)
    compare = build_compare_snapshot(single + multi)
    write_outputs(args.output_dir, single, multi, compare)

    print("✅ Aggregation complete")
    print(f"  source manifests: {args.source_dir}")
    if args.replace_all:
        print("  update mode: replace-all")
    else:
        print(
            "  update mode: merge-by-category "
            f"({', '.join(sorted(touched_categories)) or 'no categories updated'})"
        )
    print(f"  leaderboard_single.json: {len(single)} entries")
    print(f"  leaderboard_multi.json: {len(multi)} entries")
    print(f"  leaderboard_compare.json: {compare['group_count']} compare groups")
    print(f"  output dir: {args.output_dir}")


if __name__ == "__main__":
    main()
