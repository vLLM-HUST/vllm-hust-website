"""Leaderboard entry normalization and public-admission policy.

This boundary does not load artifacts, choose comparison pairs or render snapshots.
Keeping admission here lets new deployment scopes preserve historical rules.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

BASELINE_STATUS_OFFICIAL_COVERED = "official-covered"

BASELINE_STATUS_PENDING = "pending-baseline"

BASELINE_STATUS_NONE = "no-baseline-declared"

DIRTY_ENGINE_VERSION_MARKERS = ("path string is null",)

ENGINE_VERSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]*$")

KNOWN_MEMORY_PER_CHIP_GB = {
    # Ascend 910B series cards in the benchmark fleet expose 64 GB HBM.
    "910b2": 64.0,
    "910b3": 64.0,
    "ascend-910b2": 64.0,
    "ascend-910b3": 64.0,
    "ascend 910b2": 64.0,
    "ascend 910b3": 64.0,
}

VALID_BASELINE_STATUSES = {
    BASELINE_STATUS_OFFICIAL_COVERED,
    BASELINE_STATUS_PENDING,
    BASELINE_STATUS_NONE,
}

PUBLIC_BASELINE_ENGINE = "vllm"

PUBLIC_BASELINE_VERSION = "0.18.0"

PUBLIC_PRODUCTION_TRACE_BASELINE_VERSION = "0.22.1rc1"

PUBLIC_CURRENT_ENGINE = "vllm-hust"

RETIRED_BASELINE_TOKENS = ("v0.11.0", "v0110", "0.11.0")

OFFICIAL_PUBLIC_WORKLOADS = {
    "burstgpt-production-replay",
    "instructcoder-online",
    "prefix-repetition-online",
    "random-latency",
    "random-online",
    "sharegpt-online",
    "sharegpt-throughput",
    "sonnet-throughput",
    "tracelab-coding-agent-replay",
    "visionarena-online",
}

OFFICIAL_V0180_SPEC_PREFIX = "official-ascend-jan-2026-v0.18.0-"

OFFICIAL_PRODUCTION_TRACE_SPEC_PREFIX = "official-ascend-jan-2026-v0.22.1rc1-"

OFFICIAL_CURRENT_SPEC_PREFIXES = (
    OFFICIAL_V0180_SPEC_PREFIX,
    OFFICIAL_PRODUCTION_TRACE_SPEC_PREFIX,
)

CANONICAL_MODEL_ID_PATTERN = re.compile(
    r"^(?P<registry>[a-z0-9][a-z0-9_-]*):(?P<repo_id>.+)$"
)


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


def contains_retired_baseline_token(value: Any) -> bool:
    normalized = str(value or "")
    return any(token in normalized for token in RETIRED_BASELINE_TOKENS)


def is_910b_chip(value: Any) -> bool:
    normalized = normalize_chip_model_key(value).replace(" ", "").replace("-", "")
    return normalized.startswith("910b") or normalized.startswith("ascend910b")


def is_public_official_candidate(entry: dict[str, Any]) -> bool:
    workload = extract_workload_name(entry)
    hardware = entry.get("hardware") if isinstance(entry.get("hardware"), dict) else {}
    same_spec = get_same_spec_payload(entry)
    spec_id = str(same_spec.get("spec_id") or "")
    return workload in OFFICIAL_PUBLIC_WORKLOADS and (
        # Historical public fixed targets are single-card deployments. Dataset
        # reuse on TP2 is not a claim to satisfy those fixed-target contracts.
        # Explicit official target IDs remain subject to the old checks at any size.
        (is_910b_chip(hardware.get("chip_model")) and hardware.get("chip_count") == 1)
        or spec_id.startswith("official-ascend")
    )


def _get_entry_runtime_plugin_commit(entry: dict[str, Any]) -> str:
    metadata = entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
    provenance = (
        metadata.get("runtime_provenance")
        if isinstance(metadata.get("runtime_provenance"), dict)
        else {}
    )
    plugin = (
        provenance.get("plugin") if isinstance(provenance.get("plugin"), dict) else {}
    )
    return str(plugin.get("commit") or "").strip()


def _parse_entry_sort_timestamp(entry: dict[str, Any]) -> float:
    metadata = entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
    for field in ("submitted_at", "release_date"):
        raw = metadata.get(field)
        if not raw:
            continue
        try:
            return datetime.fromisoformat(str(raw)).timestamp()
        except ValueError:
            continue
    return 0.0


def compute_canonical_plugin_commit_map(
    entries: list[dict[str, Any]],
) -> dict[str, tuple[str, str]]:
    """Build a ``{git_commit_ish: (canonical_plugin_commit, source_entry_id)}`` map.

    For each ``metadata.git_commit`` group among ``vllm-hust`` entries whose
    ``runtime_provenance.plugin.commit`` is a real 40-char SHA, the canonical
    plugin commit is the one from the **earliest-submitted** entry of that
    group.  The earliest-submitted rule mirrors "what plugin was actually
    installed the first time this vllm-hust commit was benchmarked" — later
    backfills that pair the same core commit with a different plugin commit
    would otherwise split a single runtime revision across multiple x-axis
    points on the trend chart, even though the benchmarked binary is the same.

    The returned tuple also carries the entry_id of the canonical-side entry,
    so rejection logs can attribute the canonical choice to a concrete
    leaderboard row instead of leaving an operator to rediscover it by hand.

    Groups that contain no entry with a usable 40-char plugin commit are
    omitted from the map entirely; this lets callers fall back to "no
    canonical known" rather than reject every entry in that group.
    """
    SHORT_LEN = 9
    FULL_LEN = 40

    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        engine = str(entry.get("engine") or "").strip().lower()
        if engine != PUBLIC_CURRENT_ENGINE:
            continue
        metadata = (
            entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
        )
        git_commit = str(metadata.get("git_commit") or "").strip()
        if len(git_commit) < SHORT_LEN:
            continue
        plugin_commit = _get_entry_runtime_plugin_commit(entry)
        if len(plugin_commit) != FULL_LEN:
            continue
        # Key by the stable short prefix so 40-char and 9-char references to
        # the same commit collapse together.
        key = git_commit[:SHORT_LEN].lower()
        grouped.setdefault(key, []).append(entry)

    canonical: dict[str, tuple[str, str]] = {}
    for key, members in grouped.items():
        earliest = min(
            members,
            key=lambda e: (
                _parse_entry_sort_timestamp(e),
                -_get_entry_sort_throughput(e),
            ),
        )
        canonical[key] = (
            _get_entry_runtime_plugin_commit(earliest).lower(),
            str(earliest.get("entry_id") or "<missing-entry-id>"),
        )
    return canonical


def _get_entry_sort_throughput(entry: dict[str, Any]) -> float:
    metrics = entry.get("metrics") if isinstance(entry.get("metrics"), dict) else {}
    try:
        return float(metrics.get("throughput_tps") or 0.0)
    except (TypeError, ValueError):
        return 0.0


HISTORICAL_PR_BACKFILL_DATA_SOURCE = "real-online-historical-pr-backfill"


def plugin_commit_mismatch_rejection_reason(
    entry: dict[str, Any], canonical_map: dict[str, tuple[str, str]]
) -> str | None:
    """Reject vllm-hust entries whose plugin commit differs from the canonical.

    The canonical plugin commit for a given ``metadata.git_commit`` is the
    one carried by the earliest-submitted entry of that commit group (see
    :func:`compute_canonical_plugin_commit_map`).  A mismatch means the same
    vllm-hust commit was benchmarked against two different vllm-ascend-hust
    plugin revisions, which would render as two separate x-axis positions on
    the trend chart even though ``metadata.git_commit`` is identical — i.e.
    the same binary shown twice.  We drop the non-canonical side to keep the
    trend chart honest.

    The rejection message embeds the entry_id of the canonical-side row so
    a post-hoc audit can attribute the canonical choice to a concrete
    leaderboard entry instead of leaving an operator to rediscover it.

    Entries without ``runtime_provenance.plugin.commit`` are not rejected
    here (older snapshots may predate the field), and groups without a
    canonical entry are likewise skipped.

    **Historical-PR-backfill exemption**: entries whose
    ``metadata.data_source`` is ``"real-online-historical-pr-backfill"`` are
    intentional cross-PR comparison runs (e.g. PR#66 / PR#70 / PR#77 each
    testing a different plugin commit against the same engine commit).  They
    are *not* backfill mistakes and must coexist on the public snapshot so
    the compare cards can render the cross-PR delta.  Such entries bypass
    the canonical-plugin-commit check.
    """
    engine = str(entry.get("engine") or "").strip().lower()
    if engine != PUBLIC_CURRENT_ENGINE:
        return None
    metadata = entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
    # Historical-PR-backfill entries are intentional cross-PR comparison
    # runs and must not be rejected by the canonical-plugin-commit rule.
    data_source = str(metadata.get("data_source") or "").strip()
    if data_source == HISTORICAL_PR_BACKFILL_DATA_SOURCE:
        return None
    git_commit = str(metadata.get("git_commit") or "").strip()
    entry_plugin = _get_entry_runtime_plugin_commit(entry)
    if len(git_commit) < 9 or not entry_plugin:
        return None
    key = git_commit[:9].lower()
    canonical_entry = canonical_map.get(key)
    if not canonical_entry:
        return None
    canonical_commit, canonical_entry_id = canonical_entry
    if entry_plugin.lower() != canonical_commit:
        return (
            f"plugin commit mismatch for git_commit {git_commit[:9]}: "
            f"canonical={canonical_commit[:9]} (entry {canonical_entry_id}) "
            f"entry={entry_plugin[:9]}"
        )
    return None


def public_snapshot_rejection_reason(entry: dict[str, Any]) -> str | None:
    """Return a rejection reason for entries that must not reach public data.

    Historical backfills are only comparable when they are anchored to the
    official vLLM 0.18.0 / 910B2 same-spec baseline. Older v0.11.0, 910B3,
    missing same_spec, or side-experiment entries must be kept out of the
    canonical website snapshots even if their raw submissions remain archived.
    """
    metadata = entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
    engine = str(entry.get("engine") or metadata.get("engine") or "").strip().lower()
    engine_version = get_entry_engine_version(entry)
    model = entry.get("model") if isinstance(entry.get("model"), dict) else {}
    hardware = entry.get("hardware") if isinstance(entry.get("hardware"), dict) else {}
    same_spec = get_same_spec_payload(entry)
    spec_id = str(same_spec.get("spec_id") or "")
    official_public_candidate = is_public_official_candidate(entry)

    if official_public_candidate and engine == PUBLIC_BASELINE_ENGINE:
        expected_version = (
            PUBLIC_PRODUCTION_TRACE_BASELINE_VERSION
            if spec_id.startswith(OFFICIAL_PRODUCTION_TRACE_SPEC_PREFIX)
            else PUBLIC_BASELINE_VERSION
        )
        if engine_version != expected_version:
            return f"public vllm baseline is {engine_version!r}, not {expected_version}"

    if contains_retired_baseline_token(engine_version):
        return f"retired baseline token in engine_version {engine_version!r}"

    if contains_retired_baseline_token(spec_id):
        return f"retired baseline token in same_spec.spec_id {spec_id!r}"

    if engine == PUBLIC_CURRENT_ENGINE and official_public_candidate:
        if not spec_id:
            return "official vllm-hust workload is missing same_spec"
        if not spec_id.startswith(OFFICIAL_CURRENT_SPEC_PREFIXES):
            return f"official vllm-hust workload uses unadmitted spec {spec_id!r}"

    if spec_id.startswith(OFFICIAL_CURRENT_SPEC_PREFIXES):
        expected_chip = "910B2" if spec_id.endswith("-910b2") else None
        entry_precision = str(model.get("precision") or "")
        spec_precision = str(same_spec.get("model_precision") or "")
        entry_chip = str(hardware.get("chip_model") or "")
        spec_chip = str(same_spec.get("hardware_chip_model") or "")
        if not spec_precision or entry_precision != spec_precision:
            return (
                "official target precision mismatch: "
                f"entry={entry_precision!r} same_spec={spec_precision!r}"
            )
        if expected_chip and (
            entry_chip != expected_chip or spec_chip != expected_chip
        ):
            return (
                "official target hardware mismatch: "
                f"entry={entry_chip!r} same_spec={spec_chip!r} expected={expected_chip!r}"
            )

    return None


def filter_public_snapshot_entries(
    entries: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[tuple[str, str]]]:
    accepted: list[dict[str, Any]] = []
    rejected: list[tuple[str, str]] = []
    # Compute the canonical plugin commit per vllm-hust git_commit BEFORE
    # the per-entry rejectors: the canonical-side filter needs to see the
    # full population of the same commit group, including entries that the
    # per-entry rejectors below would otherwise accept individually.
    canonical_plugin_map = compute_canonical_plugin_commit_map(entries)
    for entry in entries:
        reason = public_snapshot_rejection_reason(entry)
        if reason is None:
            reason = plugin_commit_mismatch_rejection_reason(
                entry, canonical_plugin_map
            )
        if reason is None:
            accepted.append(entry)
        else:
            rejected.append(
                (str(entry.get("entry_id") or "<missing-entry-id>"), reason)
            )
    return accepted, rejected


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


def short_commit(value: Any) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        return ""
    normalized = normalized.removeprefix("g")
    return normalized[:8]
