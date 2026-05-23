from __future__ import annotations

import re
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

    assert "function countPassedHardConstraintChecks(scope)" in text
    assert "function countKnownHardConstraintSignals(scope)" in text
    assert "function buildHardConstraintScopeSortKey(scope)" in text
    assert "function compareHardConstraintScopes(left, right)" in text
    assert "const leftRank = Number(left?.selection_rank);" in text
    assert "const rightRank = Number(right?.selection_rank);" in text
    assert "return [...scopes].sort(compareHardConstraintScopes)[0] || null;" in text
    assert "metrics.typical_throughput_ratio_vs_baseline" in text
    assert "metrics.unit_token_cost_reduction_pct" in text
    assert "Date.parse(scope?.latest?.submitted_at || '') || 0;" in text


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
    assert "const CACHE_KEY = 'llm_engine_hf_leaderboard_cache_v2';" in text
    assert "function clearCache()" in text
    assert "Ignoring unusable session cache" in text


def test_index_cache_busts_leaderboard_script() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "index.html").read_text(encoding="utf-8")

    assert re.search(r'\.\/assets\/hf-data-loader\.js\?v=[^"\']+', text)
    assert re.search(r'\.\/assets\/leaderboard\.js\?v=[^"\']+', text)


def test_contributor_loader_prefers_org_profile_json_with_local_fallback() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "index.html").read_text(encoding="utf-8")

    assert "const CONTRIBUTOR_DATA_SOURCES = [" in text
    assert (
        "https://raw.githubusercontent.com/vLLM-HUST/vllm-hust-org-profile/main/profile/core_contributors.json"
        in text
    )
    assert '"./data/core_contributors.json"' in text
    assert "async function fetchContributorPayload()" in text
    assert (
        'console.warn("Failed to load contributor data source", source, error);' in text
    )
