from __future__ import annotations

import json
import re
from pathlib import Path


def test_required_entry_files_exist() -> None:
    root = Path(__file__).resolve().parents[1]
    required = [
        root / "index.html",
        root / "leaderboard.html",
        root / "achievements.html",
        root / "contributors.html",
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


def test_site_uses_vllm_hust_brand_icon() -> None:
    root = Path(__file__).resolve().parents[1]
    icon = root / "assets" / "brand" / "vllm-hust-icon.png"
    assert icon.exists(), "official vLLM-HUST brand icon should be bundled"
    assert icon.stat().st_size > 1000
    for name in (
        "index.html",
        "leaderboard.html",
        "achievements.html",
        "contributors.html",
        "versions.html",
    ):
        text = (root / name).read_text(encoding="utf-8")
        assert "assets/brand/vllm-hust-icon.png" in text, (
            f"{name} should reference the brand icon"
        )


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


def test_leaderboard_uses_normalized_model_identity_helpers() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    assert "function getEntryModelIdentity(entry)" in text
    assert "function getEntryModelCanonicalId(entry)" in text
    assert "function getEntryModelDisplayName(entry)" in text
    assert "const modelOptionsMap = new Map();" in text
    assert "getEntryModelCanonicalId(entry) === filters.model" in text
    assert "function getScopeModelIdentity(scope)" in text
    assert "function getScopeModelDisplayName(scope)" in text
    assert "function createCompareScopeKey(entry)" in text


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
    assert "sources: ['github', 'hf', 'local']" in text
    assert "backgroundRemoteSync: true" in text
    assert "cacheMarkerTimeoutMs: 1200" in text
    assert "const BACKGROUND_SYNC_EVENT = 'vllm-hust:leaderboard-data-updated';" in text
    assert "const PROGRESS_EVENT = 'vllm-hust:leaderboard-data-progress';" in text
    assert "const markerPromise = getLatestMarker(markerPriority);" in text
    assert "function dispatchProgress(payload, onProgress)" in text
    assert "function startBackgroundSync()" in text
    assert "startBackgroundSync," in text
    assert "llm_engine_hf_leaderboard_cache_v6" in text
    assert "const LOCAL_DATA_CACHE_BUST = 'leaderboard-data-20260701-3';" in text
    assert (
        "const url = `${HF_CONFIG.localPath}${filename}${separator}v=${LOCAL_DATA_CACHE_BUST}`;"
        in text
    )
    assert "function clearCache()" in text
    assert "Ignoring unusable session cache" in text


def test_leaderboard_data_excludes_retired_v0110_baselines() -> None:
    root = Path(__file__).resolve().parents[1]
    single = json.loads((root / "data" / "leaderboard_single.json").read_text())

    ids = {entry["entry_id"] for entry in single}
    assert (
        "36551323-7a0b-4832-b14b-98bf4edfd271" not in ids
    )  # vllm-hust #41, retired v0110 baseline
    assert (
        "fd20fab5-1733-4bf0-b79b-9c41d09b53db" not in ids
    )  # vllm-hust #45, retired v0110 baseline
    assert (
        "e851c419-0115-440d-9304-2175859494b8" not in ids
    )  # vllm-hust #46, retired v0110 baseline
    assert (
        "b78295f6-3ad4-4a56-9c85-175165e5d347" not in ids
    )  # vllm-hust #49, retired v0110 baseline

    for entry in single:
        same_spec = entry.get("same_spec") or {}
        spec_id = str(same_spec.get("spec_id") or "")
        engine_version = str(entry.get("engine_version") or "")
        assert "v0.11.0" not in spec_id
        assert "v0110" not in spec_id
        assert engine_version != "0.11.0"
        if entry.get("engine") == "vllm":
            assert engine_version == "0.18.0"


def test_leaderboard_data_is_benchmark_snapshot_mirror() -> None:
    root = Path(__file__).resolve().parents[1]
    benchmark_snapshots = (
        root.parent / "vllm-hust-benchmark" / "leaderboard-data" / "snapshots"
    )
    if not benchmark_snapshots.is_dir():
        return

    for name in (
        "leaderboard_single.json",
        "leaderboard_multi.json",
        "leaderboard_compare.json",
        "last_updated.json",
    ):
        assert (root / "data" / name).read_bytes() == (
            benchmark_snapshots / name
        ).read_bytes(), f"{name} is not synced from benchmark snapshots"


def test_leaderboard_sync_workflow_uses_snapshot_sync_script() -> None:
    root = Path(__file__).resolve().parents[1]
    workflow = (root / ".github" / "workflows" / "sync-leaderboard-data.yml").read_text(
        encoding="utf-8"
    )
    script = (root / "scripts" / "sync_leaderboard_snapshots.py").read_text(
        encoding="utf-8"
    )

    assert "python scripts/sync_leaderboard_snapshots.py" in workflow
    assert "vLLM-HUST/vllm-hust-benchmark" in workflow
    assert "SNAPSHOT_FILES = (" in script
    assert "--check" in script


def test_index_cache_busts_leaderboard_script() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "leaderboard.html").read_text(encoding="utf-8")

    assert re.search(r'\.\/assets\/hf-data-loader\.js\?v=[^"\']+', text)
    assert re.search(r'\.\/assets\/leaderboard\.js\?v=[^"\']+', text)
    assert re.search(r'\.\/assets\/leaderboard\.css\?v=[^"\']+', text)


def test_homepage_exposes_multi_page_navigation_and_workstation() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "index.html").read_text(encoding="utf-8")

    assert 'data-page="home"' in text
    assert 'href="./leaderboard.html"' in text
    assert 'href="./achievements.html"' in text
    assert 'href="./contributors.html"' in text
    assert 'id="workstation-section"' in text
    assert 'id="workstation-embed-frame"' in text
    assert "./assets/workstation-embed.js?v=" in text


def test_validation_dependencies_have_single_source_of_truth() -> None:
    root = Path(__file__).resolve().parents[1]
    requirements_text = (root / "requirements-dev.txt").read_text(encoding="utf-8")
    ci_text = (root / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    quickstart_text = (root / "quickstart.sh").read_text(encoding="utf-8")
    validate_text = (root / "scripts" / "validate-local.sh").read_text(encoding="utf-8")
    readme_text = (root / "README.md").read_text(encoding="utf-8")

    assert "pre-commit" in requirements_text
    assert "pytest" in requirements_text
    assert "jsonschema" in requirements_text
    assert "python -m pip install -r requirements-dev.txt" in ci_text
    assert "requirements-dev.txt" in quickstart_text
    assert '--with-requirements "$DEV_REQUIREMENTS_FILE"' in validate_text
    assert 'find_spec("jsonschema")' in validate_text
    assert "if command -v pytest >/dev/null 2>&1; then" not in validate_text
    assert "uvx --python 3.11 pytest" not in validate_text
    assert "uvx --python 3.11 pre-commit" not in validate_text
    assert "python3.11 -m pip install -r requirements-dev.txt" in readme_text
    assert (
        "uv run --python 3.11 --with-requirements requirements-dev.txt" in readme_text
    )


def test_engine_summary_cards_use_composite_version_components() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "leaderboard.css").read_text(encoding="utf-8")

    assert "function formatOverviewComponentVersion(component)" in text
    assert "function getOverviewSummaryChipText(summary)" in text
    assert "function getOverviewSummaryVersionText(summary)" in text
    assert "return resolvedVersion;" in text
    assert (
        "overviewComponents: buildTableVersionComponents(bestEntry || coverageBestEntry)"
        in text
    )
    assert "const chipText = getOverviewSummaryChipText(summary);" in text
    assert "const versionText = getOverviewSummaryVersionText(summary);" in text
    assert "const bestVisibleRunText =" in text
    assert "function selectOverviewRepresentativeGroup(comparisonView)" in text
    assert "const representativeGroup = overviewScopeLocked" in text
    assert (
        "representativeGroup?.summaryLabel || getOverviewAggregateScopeText(comparisonView)"
        in text
    )
    assert "getBestEntryForEngine(group.entries, 'vllm-hust')" in text
    assert "function getOfficialVllmBaselineEntry(entries)" in text
    assert "function getThroughputImprovementScore(currentEntry, baselineEntry)" in text
    assert "const displayEntry = representativeEntry;" in text
    assert "averageMetric(" not in text
    assert "avgTTFT" not in text
    assert "平均 TTFT" not in text
    assert "displayTTFT:" in text
    assert "sampleTTFT" in text
    assert "currentBestVersionLabel" in text
    assert "baselineVersionLabel" in text
    assert (
        "const isBaselineCard = !isLeader && cardCount === 2 && cardIndex === 1;"
        in text
    )
    assert "const versionPrefix = isLeader" in text
    assert '<div class="engine-summary-meta">' in text
    assert '<span class="engine-summary-version-label">${versionPrefix}</span>' in text
    assert '<span class="engine-summary-version-value">${versionText}</span>' in text
    assert '<span class="engine-summary-footer-label">${footerLabel}:</span>' in text
    assert '<span class="engine-summary-footer-value">${footerValue}</span>' in text
    metrics_index = text.index('<div class="engine-summary-metrics">')
    meta_index = text.index('<div class="engine-summary-meta">')
    version_index = text.index('<div class="engine-summary-version">')
    footer_index = text.index('<div class="engine-summary-footer">')
    assert metrics_index < meta_index < version_index < footer_index
    assert ".engine-summary-meta {" in css_text
    assert ".engine-summary-version-label {" in css_text
    assert ".engine-summary-version-value {" in css_text
    assert ".engine-summary-footer-label {" in css_text
    assert ".engine-summary-footer-value {" in css_text
    assert "font-size: 0.94rem;" in css_text
    assert "font-weight: 600;" in css_text


def test_achievements_page_omits_ambiguous_workload_evidence_cards() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert "achievement-evidence" not in html_text
    assert "achievements-evidence" not in html_text
    assert "renderEvidence" not in js_text
    assert "achievements-timeline-20260702" in html_text


def test_achievements_page_uses_reverse_chronological_timeline() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")

    assert 'id="achievement-timeline"' in html_text
    assert 'class="achievement-timeline"' in html_text
    assert "achievement-artifacts" not in html_text
    assert "achievement-milestones" not in html_text
    assert "const ACHIEVEMENTS = [" in js_text
    assert "sortDate: '2026-07-02'" in js_text
    assert "].sort((left, right) => right.sortDate.localeCompare(left.sortDate));" in js_text
    assert "achievement-item" in css_text
    assert "achievement-time" in css_text


def test_bidkv_achievement_links_to_pdf_not_repository() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")
    pdf_path = root / "assets" / "papers" / "bidkv-sc2026.pdf"

    assert "BidKV at SC 2026" in js_text
    assert "./assets/papers/bidkv-sc2026.pdf" in js_text
    assert "github.com/ShuhaoZhangTony/bidkv" not in js_text
    assert pdf_path.is_file()
    assert pdf_path.stat().st_size > 100_000


def test_achievements_page_omits_package_version_cards() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert "achievement-packages" not in html_text
    assert "achievements-packages" not in html_text
    assert "renderPackages" not in js_text


def test_version_metadata_excludes_sagellm_package_family() -> None:
    root = Path(__file__).resolve().parents[1]
    meta_text = (root / "data" / "version_meta.json").read_text(encoding="utf-8")
    meta = json.loads(meta_text)
    package_names = {package["name"] for package in meta.get("packages", [])}

    assert "vllm-hust" in package_names
    assert "vllm-hust-protocol" not in package_names
    assert "ivllm-hust" not in meta_text
    assert "0.17.2.post1" not in meta_text


def test_public_docs_do_not_use_ivllm_hust_prefix() -> None:
    root = Path(__file__).resolve().parents[1]
    checked_paths = [
        root / "README.md",
        root / "quickstart.sh",
        root / "data" / "README.md",
        root / "data" / "version_meta.json",
    ]

    for path in checked_paths:
        assert "ivllm-hust" not in path.read_text(encoding="utf-8"), path


def test_leaderboard_overview_compare_scope_includes_precision() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    assert "const precision = entry?.model?.precision || t('unknown');" in text
    assert (
        "return `${model} • ${hardware} • ${precision} • ${workload} • ${settingSummary}`;"
        in text
    )
    assert "activeGroups," in text
    assert "function getSingleCompleteOverviewGroup(comparisonView)" in text
    assert (
        "const precisions = getUniqueValues(entries, (entry) => entry?.model?.precision);"
        in text
    )
    assert (
        "const precisionText = precisions.length === 1 ? precisions[0] : `${precisions.length} ${t('precision')}`;"
        in text
    )


def test_leaderboard_renders_interactive_trend_chart() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "leaderboard.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "leaderboard.css").read_text(encoding="utf-8")

    assert (
        "https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js" in html_text
    )
    assert 'id="leaderboard-trend-panel"' in html_text
    assert 'id="leaderboard-trend-chart"' in html_text
    assert (
        'id="leaderboard-table-details" class="leaderboard-table-details is-collapsed" hidden'
        in html_text
    )
    assert 'data-trend-metric="throughput_tps"' in html_text
    assert 'data-trend-axis="auto"' in html_text
    assert 'data-trend-axis="log"' in html_text
    assert 'data-trend-axis="linear"' in html_text
    assert "leaderboard-cache-v7-20260702" in html_text
    assert "leaderboard-public-20260703-logscale5" in html_text
    assert "function buildTrendChartModel(entries, metricConfig)" in js_text
    assert "const model = getEntryModelCanonicalId(entry)" in js_text
    assert "function startBackgroundDataSync()" in js_text
    assert "const renderPartialData = (progress) => {" in js_text
    assert "onProgress: renderPartialData" in js_text
    assert "function ensureCurrentTabHasData()" in js_text
    assert "statsLoadingMore" in js_text
    assert "vllm-hust:leaderboard-data-updated" in js_text
    assert "window.HFDataLoader.startBackgroundSync();" in js_text
    assert (
        "const hardware = entry?.hardware?.chip_model || 'unknown-hardware';" in js_text
    )
    assert (
        "return [workload, model, hardware, chipCount, nodeCount, precision, settingSignature].join('|');"
        in js_text
    )
    assert "每条折线使用对齐的 workload、模型、硬件与精度设置。" in js_text
    assert "function renderPerformanceTrendChart(entries)" in js_text
    assert "new Chart(canvas" in js_text
    assert "pointDetails" in js_text
    assert "spanGaps: true" in js_text
    assert "Keep one series continuous across x-axis slots" in js_text
    assert "function getTrendAxisValues(datasets)" in js_text
    assert "function shouldUseLogTrendAxis(metricConfig, datasets)" in js_text
    assert "trendAxisScale: 'auto'" in js_text
    assert "const LOG_TREND_AXIS_RATIO_THRESHOLD = 20;" in js_text
    assert "state.trendAxisScale === 'log'" in js_text
    assert "state.trendAxisScale === 'linear'" in js_text
    assert "const minValue = Math.min(...values);" in js_text
    assert "const maxValue = Math.max(...values);" in js_text
    assert "return maxValue / minValue >= LOG_TREND_AXIS_RATIO_THRESHOLD;" in js_text
    assert "document.querySelectorAll('[data-trend-axis]')" in js_text
    assert "data: dataset.data.map((value) => {" in js_text
    assert "Number.isFinite(number) && number > 0 ? number : null" in js_text
    assert "function getLogTrendAxisBounds(datasets)" in js_text
    assert "const yAxisBounds = useLogYAxis ? getLogTrendAxisBounds(datasets) : {};" in js_text
    assert "type: useLogYAxis ? 'logarithmic' : 'linear'" in js_text
    assert "min: yAxisBounds.min" in js_text
    assert "renderPerformanceTrendChart(sortedFiltered);" in js_text
    assert ".leaderboard-trend-panel {" in css_text
    assert ".trend-chart-wrap {" in css_text
    assert ".trend-axis-row {" in css_text
    assert ".trend-axis-toggle {" in css_text
    assert ".trend-axis-button.active {" in css_text


def test_detail_sections_use_detail_only_version_formatting_and_memory_fallback() -> (
    None
):
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "leaderboard.css").read_text(encoding="utf-8")

    assert "function getEntryCompositeVersionText(entry)" in text
    assert "function normalizeDetailedPackageVersion(value)" in text
    assert (
        "function formatDetailedVersion(version, commit, { includeCommit = true } = {})"
        in text
    )
    assert "function getEntryDetailedVersionText(entry)" in text
    assert "function getVersionFieldCommit(entry, key)" in text
    assert "function getEntryTotalMemoryGb(entry)" in text
    assert "function formatMemoryGb(value)" in text
    assert "const totalMemoryGb = getEntryTotalMemoryGb(entry);" in text
    assert "${formatMemoryGb(totalMemoryGb)} GB" in text
    assert "const displayedVersion = getEntryDetailedVersionText(entry);" in text
    assert "const variantVersion = getEntryDetailedVersionText(variant);" in text
    assert "const engineVersion = getEntryDetailedVersionText(entry);" in text
    assert (
        "formatDetailedVersion(value, getVersionFieldCommit(entry, key)) || value"
        in text
    )
    assert "getShortCommit(extractCommitFromVersion(version) || commit)" in text
    assert '<span class="build-version-summary">${variantVersion}</span>' in text
    assert ".build-version-summary {" in css_text
    assert ".build-version-marker {" in css_text


def test_leaderboard_version_display_contract_is_documented_and_split() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    readme_text = (root / "README.md").read_text(encoding="utf-8")
    docs_text = (root / "docs" / "VERSION_METADATA.md").read_text(encoding="utf-8")

    assert "## Leaderboard Version Display Contract" in docs_text
    assert (
        "Main leaderboard table version cells are intentionally compact summaries."
        in docs_text
    )
    assert (
        "Expanded leaderboard details are intentionally more detailed than the table."
        in docs_text
    )
    assert "Only version substrings should change" in docs_text
    assert "tests/test_site_structure.py" in docs_text
    assert "Leaderboard version rendering follows a split UI contract:" in readme_text
    assert (
        "docs/VERSION_METADATA.md#leaderboard-version-display-contract" in readme_text
    )

    render_data_row_start = text.index(
        "function renderDataRow(entry, isLatest, isExpanded, showVersion, isSparse, versionRowSpan = 1) {"
    )
    render_details_row_start = text.index(
        "function renderDetailsRow(entry, isExpanded) {"
    )
    render_data_row_text = text[render_data_row_start:render_details_row_start]
    assert (
        "const tableVersionSummary = formatTableVersionSummary(entry, dateLabel);"
        in render_data_row_text
    )
    assert "const versionMainText = tableVersionSummary" in render_data_row_text
    assert 'rowspan="${Math.max(1, versionRowSpan)}"' in render_data_row_text
    assert "getEntryDetailedVersionText" not in render_data_row_text
    assert "formatDetailedVersion" not in render_data_row_text
    assert "function getTableVersionRowSpanKey(entry)" in text
    assert "return getTableVersionVisibilityKey(entry);" in text
    assert "const key = getTableVersionRowSpanKey(entry);" in text
    assert (
        "const showVersionForEveryRow = showVersionAllParam\n"
        "            || Boolean(sortState.column)\n"
        "            || filters.version !== 'all';" in text
    )
    assert "forceEveryRow: showVersionForEveryRow," in text
    assert (
        "${renderDataRow(entry, isLatest, isExpanded, rowSpan.showVersion, isSparse, rowSpan.span)}"
        in text
    )

    render_versions_start = text.index("function renderVersionsSection(entry) {")
    render_build_start = text.index("function renderBuildVariantsSection(entry) {")
    render_versions_text = text[render_versions_start:render_build_start]
    assert (
        "const engineVersion = getEntryDetailedVersionText(entry);"
        in render_versions_text
    )
    assert (
        "formatDetailedVersion(value, getVersionFieldCommit(entry, key)) || value"
        in render_versions_text
    )
    assert "getEntryCompositeVersionText(entry)" not in render_versions_text

    render_build_end = text.index(
        "function formatMetric(value, isPercentage = false) {"
    )
    render_build_text = text[render_build_start:render_build_end]
    assert (
        "const displayedVersion = getEntryDetailedVersionText(entry);"
        in render_build_text
    )
    assert (
        "const variantVersion = getEntryDetailedVersionText(variant);"
        in render_build_text
    )
    assert "getEntryCompositeVersionText(" not in render_build_text


def test_version_filter_reuses_aligned_composite_version_summary() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    assert "function getEntryFilterVersionParts(entry)" in text
    assert "function getEntryFilterVersionText(entry)" in text
    assert "function buildVersionFilterOption(entry)" in text
    assert "function compareVersionFilterOptions(left, right)" in text
    assert "function compareEntriesByCompositeVersion(left, right)" in text
    assert "function matchesVersionFilter(entry, selectedVersion)" in text
    assert ".map((component) => `${component.label} ${component.version}`)" in text
    assert "optionMap.set(label, {" in text
    assert ".sort(compareVersionFilterOptions)" in text
    assert ".map((option) => option.label);" in text
    assert "matchesVersionFilter(entry, filters.version)" in text
    assert (
        "normalizeDisplayVersion(getEngineVersion(entry)) === normalizedFilter" in text
    )
    assert "const baseVersion = getEntryFilterVersionText(entry);" in text
    assert "return compareEntriesByCompositeVersion(a, b);" in text
    assert ".replace(/\\.dev\\d+\\b/i, '')" in text
    assert ".replace(/(?:[.+-])d\\d{8}$/i, '')" in text
    assert "while (parts.length < 3) {" in text
    assert "parts.push('0');" in text
    assert ".replace(/(?:[._-]?(?:a|b|rc|pre|preview)\\d+)\\b/i, '')" not in text
    assert (
        "formatComponentVersion(candidate, component.commit, { includeCommit: false })"
        in text
    )


def test_local_validation_script_and_hook_templates_track_ci() -> None:
    root = Path(__file__).resolve().parents[1]
    ci_text = (root / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    hook_text = (root / "hooks" / "pre-commit").read_text(encoding="utf-8")
    script_text = (root / "scripts" / "validate-local.sh").read_text(encoding="utf-8")
    readme_text = (root / "README.md").read_text(encoding="utf-8")

    assert "pre-commit run --all-files" in ci_text
    assert "pytest tests/ -v" in ci_text
    assert '"${PRE_COMMIT_CMD[@]}" run --files "${staged_paths[@]}"' in hook_text
    assert "resolve_pre_commit_cmd" in hook_text
    assert "./scripts/validate-local.sh" in hook_text
    assert "pre-commit run --all-files" in script_text
    assert '"${PYTEST_CMD[@]}" tests/ -v' in script_text
    assert "grep -q 'ln -sf \"../../hooks/pre-commit\"' quickstart.sh" in script_text
    assert "grep -q 'ln -sf \"../../hooks/pre-push\"' quickstart.sh" in script_text
    assert "./scripts/validate-local.sh" in readme_text


def test_contributor_loader_prefers_org_profile_json_with_local_fallback() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "contributors-page.js").read_text(encoding="utf-8")

    assert "const SOURCES = [" in text
    assert (
        "https://raw.githubusercontent.com/vLLM-HUST/vllm-hust-org-profile/main/profile/core_contributors.json"
        in text
    )
    assert "'./data/core_contributors.json'" in text
    assert "async function fetchPayload()" in text
    assert "console.warn('[contributors] source failed', source, err);" in text
