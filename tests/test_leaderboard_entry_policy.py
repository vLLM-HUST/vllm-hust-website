"""New deployment scope must not impersonate or weaken an old fixed target."""

import importlib.util
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/leaderboard_entry_policy.py"
spec = importlib.util.spec_from_file_location("entry_policy", path)
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def entry(*, chips=2, spec_id="qwen27-tp2-sharegpt-online", version="0.25.1"):
    return {
        "engine": "vllm",
        "engine_version": version,
        "hardware": {"chip_model": "910B2", "chip_count": chips},
        "workload": {"name": "sharegpt-online"},
        "same_spec": {"spec_id": spec_id},
    }


def test_new_tp2_dataset_scope_accepts_its_actual_native_runtime():
    assert not policy.is_public_official_candidate(entry())
    assert policy.public_snapshot_rejection_reason(entry()) is None


def test_single_card_legacy_scope_still_requires_its_baseline():
    assert "not 0.18.0" in policy.public_snapshot_rejection_reason(entry(chips=1))


def test_tp2_cannot_bypass_explicit_official_target_admission():
    row = entry(
        spec_id="official-ascend-jan-2026-v0.18.0-sharegpt-online-qwen25-14b-910b2"
    )
    assert "not 0.18.0" in policy.public_snapshot_rejection_reason(row)


def test_retired_baselines_still_rejected_on_new_hardware_shapes():
    assert "retired baseline" in policy.public_snapshot_rejection_reason(
        entry(version="0.11.0")
    )
