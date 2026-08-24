from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Callable

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "prepare_leaderboard_sync", ROOT / "scripts" / "prepare_leaderboard_sync.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def dump(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def registry(tmp_path: Path) -> tuple[Path, Path, object]:
    path = tmp_path / "official-targets.json"
    checksum = tmp_path / "official-targets.sha256"
    dump(
        path,
        {
            "registry_version": "1.0.0",
            "targets": [
                {
                    "target_id": "official-target",
                    "target_version": "1.0.0",
                    "status": "active",
                    "intended_use": "public-leaderboard",
                }
            ],
        },
    )
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    checksum.write_text(f"{digest}  official-targets.json\n", encoding="utf-8")
    return path, checksum, MODULE.load_registry(path, checksum)


def entry(registry_info: object) -> dict:
    return {
        "entry_id": "entry-1",
        "metadata": {
            "verified": True,
            "target_id": "official-target",
            "target_version": "1.0.0",
            "target_registry_sha256": registry_info.sha256,
        },
        "same_spec": {"spec_id": "official-target"},
    }


def exact_target_entry(registry_info: object) -> dict:
    registry_info.targets["official-target"].update(
        {
            "profile": "production-trace",
            "baseline_runtime": {"engine": "vllm", "engine_version": "0.18.0"},
            "model": {
                "id": "zai-org/GLM-4.7-Flash",
                "parameters": "30B-A3B",
                "precision": "BF16",
            },
            "hardware": {
                "vendor": "Huawei",
                "chip_model": "910B2",
                "chip_count": 2,
            },
            "server_parameters": {"tensor_parallel_size": 2, "max_model_len": 131072},
            "workload": {
                "client_parameters": {"max_requests": 1000, "max_concurrency": 64}
            },
        }
    )
    payload = entry(registry_info)
    payload.update(
        {
            "engine": "vllm",
            "engine_version": "0.18.0",
            "model": {
                "repo_id": "zai-org/GLM-4.7-Flash",
                "parameters": "30B-A3B",
                "precision": "BF16",
            },
            "hardware": {"vendor": "Huawei", "chip_model": "910B2", "chip_count": 2},
        }
    )
    payload["metadata"]["profile_id"] = "production-trace"
    payload["same_spec"].update(
        {
            "resolved_server_parameters": {
                "tensor_parallel_size": 2,
                "max_model_len": 131072,
            },
            "resolved_client_parameters": {
                "max_requests": 1000,
                "max_concurrency": 64,
            },
        }
    )
    return payload


def snapshot_dir(tmp_path: Path, registry_info: object) -> Path:
    root = tmp_path / "snapshots"
    root.mkdir()
    dump(root / "leaderboard_single.json", [entry(registry_info)])
    dump(root / "leaderboard_multi.json", [])
    dump(root / "leaderboard_historical.json", [])
    dump(root / "leaderboard_compare.json", {"group_count": 0, "groups": []})
    dump(root / "last_updated.json", {"last_updated": "2026-07-31T00:00:00Z"})
    return root


def test_valid_snapshot_and_declared_empty_compare_pass(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    assert MODULE.validate_snapshot_set(source, info) == {
        "single": 1,
        "multi": 0,
        "compare": 0,
        "historical": 0,
        "historical_unverified": 0,
    }


def test_recovered_history_is_admitted_without_formal_verification(
    tmp_path: Path,
) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    recovered = entry(info)
    recovered["metadata"]["verified"] = None
    recovered["historical_recovery"] = {
        "admitted_for_historical_trend": True,
        "spec_resolution": "derived",
    }
    dump(source / "leaderboard_historical.json", [recovered])

    assert MODULE.validate_snapshot_set(source, info)["historical"] == 1


@pytest.mark.parametrize(
    "missing", ["target_id", "target_version", "target_registry_sha256"]
)
def test_missing_target_binding_fails_closed(tmp_path: Path, missing: str) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    payload = json.loads((source / "leaderboard_single.json").read_text())
    del payload[0]["metadata"][missing]
    dump(source / "leaderboard_single.json", payload)
    with pytest.raises(ValueError, match=missing):
        MODULE.validate_snapshot_set(source, info)


def test_unverified_entry_fails_closed(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    payload = json.loads((source / "leaderboard_single.json").read_text())
    payload[0]["metadata"]["verified"] = False
    dump(source / "leaderboard_single.json", payload)
    with pytest.raises(ValueError, match="metadata.verified"):
        MODULE.validate_snapshot_set(source, info)


def test_explicit_historical_unverified_entry_is_retained_but_not_admitted(
    tmp_path: Path,
) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    payload = json.loads((source / "leaderboard_single.json").read_text())
    payload[0]["metadata"] = {
        "verified": False,
        "official_admission_status": "historical-unverified",
        "official_admission_reason": "Pre-attestation historical record.",
    }
    dump(source / "leaderboard_single.json", payload)

    assert MODULE.validate_snapshot_set(source, info)["single"] == 1
    assert MODULE.admitted_entry_ids(source, info) == set()


def test_historical_unverified_marker_rejects_target_claim(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    payload = json.loads((source / "leaderboard_single.json").read_text())
    payload[0]["metadata"].update(
        verified=False,
        official_admission_status="historical-unverified",
        official_admission_reason="Pre-attestation historical record.",
    )
    dump(source / "leaderboard_single.json", payload)

    with pytest.raises(ValueError, match="cannot declare target_id"):
        MODULE.validate_snapshot_set(source, info)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda item: item["metadata"].update(profile_id="core-text"), "profile_id"),
        (lambda item: item["model"].update(repo_id="wrong/model"), "model.repo_id"),
        (lambda item: item["hardware"].update(chip_count=1), "hardware.chip_count"),
        (
            lambda item: item["same_spec"]["resolved_server_parameters"].update(
                tensor_parallel_size=1
            ),
            "tensor_parallel_size",
        ),
        (
            lambda item: item["same_spec"]["resolved_client_parameters"].update(
                max_concurrency=32
            ),
            "max_concurrency",
        ),
    ],
)
def test_exact_official_target_fields_fail_closed(
    tmp_path: Path, mutate: Callable[[dict], None], message: str
) -> None:
    _, _, info = registry(tmp_path)
    payload = exact_target_entry(info)
    mutate(payload)
    errors = MODULE.require_public_entry_contract(payload, "entry", info)
    assert any(message in error for error in errors)


def test_empty_snapshot_replacement_fails_closed(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    dump(source / "leaderboard_single.json", [])
    with pytest.raises(ValueError, match="refusing an empty replacement"):
        MODULE.validate_snapshot_set(source, info)


def test_sync_cannot_silently_remove_existing_admitted_entry(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    target = snapshot_dir(tmp_path, info)
    source = tmp_path / "incoming"
    source.mkdir()
    incoming = entry(info)
    incoming["entry_id"] = "entry-2"
    dump(source / "leaderboard_single.json", [incoming])
    dump(source / "leaderboard_multi.json", [])
    with pytest.raises(ValueError, match="entry-1"):
        MODULE.validate_preserves_admitted_entries(
            source, target, info, allow_entry_removal=False
        )


def test_reviewed_entry_removal_can_be_explicitly_allowed(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    target = snapshot_dir(tmp_path, info)
    source = tmp_path / "incoming"
    source.mkdir()
    incoming = entry(info)
    incoming["entry_id"] = "entry-2"
    dump(source / "leaderboard_single.json", [incoming])
    dump(source / "leaderboard_multi.json", [])
    MODULE.validate_preserves_admitted_entries(
        source, target, info, allow_entry_removal=True
    )


def test_registry_hash_mismatch_fails_closed(tmp_path: Path) -> None:
    path, checksum, _ = registry(tmp_path)
    path.write_text(path.read_text() + " ", encoding="utf-8")
    with pytest.raises(ValueError, match="checksum mismatch"):
        MODULE.load_registry(path, checksum)


def test_pr_body_contains_provenance_counts_and_checksums(tmp_path: Path) -> None:
    _, _, info = registry(tmp_path)
    source = snapshot_dir(tmp_path, info)
    target = tmp_path / "target"
    target.mkdir()
    body = tmp_path / "body.md"
    MODULE.write_pr_body(
        body,
        benchmark_commit="a" * 40,
        registry=info,
        counts=MODULE.validate_snapshot_set(source, info),
        checksums=MODULE.checksum_rows(source, target),
    )
    text = body.read_text()
    assert "Target registry version: `1.0.0`" in text
    assert f"Target registry SHA256: `{info.sha256}`" in text
    assert "Single-chip snapshot | passed | 1" in text
    assert "Previous SHA256" in text
