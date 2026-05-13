from __future__ import annotations

from pathlib import Path


def test_required_entry_files_exist() -> None:
    root = Path(__file__).resolve().parents[1]
    required = [
        root / "index.html",
        root / "versions.html",
        root / "README.md",
        root / "CHANGELOG.md",
    ]
    for path in required:
        assert path.exists(), f"missing required file: {path.name}"


def test_index_contains_expected_project_markers() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "index.html").read_text(encoding="utf-8")

    assert "vllm-hust" in text
    assert "leaderboard" in text.lower()
    assert "长征 Desktop 下载" not in text


def test_data_directory_has_sync_marker() -> None:
    root = Path(__file__).resolve().parents[1]
    marker = root / "data" / "last_updated.json"
    assert marker.exists(), "data sync marker is required for website freshness"


def test_hard_constraints_selection_prefers_passed_scope() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    assert "function isPinnedHardConstraintScope(scope)" in text
    assert "scoped.model === 'Qwen2.5-7B-Instruct'" in text
    assert "scoped.hardware === '910B3'" in text
    assert "scoped.workload === 'sharegpt-online'" in text
    assert "accountable.representative_business_scenario === 'online-chat'" in text
    assert "accountable.baseline_engine === 'vllm'" in text
    assert "scope?.overall_pass === true" in text
    assert (
        "return scopes.find((scope) => isPinnedHardConstraintScope(scope)) || null;"
        in text
    )
    assert "function isPinnedHardConstraintScope(scope)" in text
    assert "scoped.model === 'Qwen2.5-7B-Instruct'" in text
    assert "scoped.hardware === '910B3'" in text
    assert "scoped.workload === 'sharegpt-online'" in text
    assert "accountable.representative_business_scenario === 'online-chat'" in text
    assert "accountable.baseline_engine === 'vllm'" in text
    assert (
        "return scopes.find((scope) => isPinnedHardConstraintScope(scope)) || null;"
        in text
    )


def test_hard_constraints_selection_uses_tab_dataset_not_visible_rows() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    assert "function getHardConstraintConfigTypesForCurrentTab()" in text
    assert "const sourceEntries = getDataByTab(state.currentTab).filter(" in text
    assert "scopeKeys.has(scope.scope_key)" in text


def test_hard_constraints_baseline_block_is_rendered() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "leaderboard.css").read_text(encoding="utf-8")

    assert "hardConstraintsBaselineLabel" in js_text
    assert "hardConstraintsBaselineValue" in js_text
    assert '<div class="hard-constraints-baseline">' in js_text
    assert ".hard-constraints-baseline {" in css_text


def test_hf_loader_rejects_incomplete_compare_snapshots() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "hf-data-loader.js").read_text(encoding="utf-8")

    assert "function isCompareSnapshotUsable(compareSnapshot)" in text
    assert "Incomplete compare snapshot from ${source}" in text
    assert "return hardConstraintScopes.length === 0;" in text
    assert "assertUsableLeaderboardPayload(result, source);" in text


def test_index_cache_busts_leaderboard_script() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "index.html").read_text(encoding="utf-8")

    assert "./assets/hf-data-loader.js?v=compare-source-guard-20260513" in text
    assert "./assets/leaderboard.js?v=hc-baseline-banner-20260513" in text
