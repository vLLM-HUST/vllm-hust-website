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
        root / "conferences.html",
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
        "conferences.html",
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
    assert 'href="./conferences.html"' in text
    assert 'id="workstation-section"' in text
    assert 'id="workstation-embed-frame"' in text
    assert "./assets/workstation-embed.js?v=" in text


def test_homepage_does_not_duplicate_nav_links_below_hero() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "index.html").read_text(encoding="utf-8")
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")

    assert 'id="nav-home"' in html_text
    assert 'id="nav-leaderboard"' in html_text
    assert 'id="nav-achievements"' in html_text
    assert 'id="nav-conferences"' in html_text
    assert 'class="cosmic-links"' not in html_text
    assert "home-card-leaderboard-title" not in html_text
    assert ".cosmic-links" not in css_text


def test_conference_navigation_is_general_not_event_specific() -> None:
    root = Path(__file__).resolve().parents[1]
    site_js = (root / "assets" / "site.js").read_text(encoding="utf-8")
    conferences_html = (root / "conferences.html").read_text(encoding="utf-8")

    for name in (
        "index.html",
        "leaderboard.html",
        "achievements.html",
        "contributors.html",
    ):
        text = (root / name).read_text(encoding="utf-8")
        assert 'id="nav-conferences"' in text
        assert 'href="./conferences.html"' in text

    assert "navConferences: 'Conferences'" in site_js
    assert "navConferences: '会议'" in site_js
    assert "navWorkshop" not in site_js
    assert "StateSys 2026" not in (root / "index.html").read_text(encoding="utf-8")
    assert "StateSys 2026" in conferences_html
    assert "https://workshop.sage.org.ai" in conferences_html


def test_language_toggle_is_separate_from_primary_navigation() -> None:
    root = Path(__file__).resolve().parents[1]
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")

    for name in (
        "index.html",
        "leaderboard.html",
        "achievements.html",
        "contributors.html",
        "conferences.html",
    ):
        text = (root / name).read_text(encoding="utf-8")
        nav_start = text.index('<div class="nav-links">')
        nav_end = text.index("</div>", nav_start)
        toggle_pos = text.index('id="langToggle"')
        close_nav_pos = text.index("</nav>")
        assert toggle_pos > close_nav_pos
        assert 'id="langToggle"' not in text[nav_start:nav_end]

    assert ".lang-toggle {" in css_text
    assert "position: fixed;" in css_text
    assert "top: 88px;" in css_text
    assert "right: max(" in css_text
    assert "中 / EN" in (root / "assets" / "site.js").read_text(encoding="utf-8")


def test_shared_visual_styles_use_current_cache_key_and_non_negative_tracking() -> None:
    root = Path(__file__).resolve().parents[1]
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")

    assert "letter-spacing: -" not in css_text
    assert "font-size: clamp(" not in css_text
    assert ".cosmic-card::before" in css_text
    assert ".feature-card:hover" in css_text

    for name in ("index.html", "leaderboard.html", "achievements.html", "contributors.html", "conferences.html"):
        text = (root / name).read_text(encoding="utf-8")
        assert "assets/site.css?v=visual-polish-20260706" in text
        assert "assets/site.js?v=visual-polish-20260706" in text


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
    assert "achievements-timeline-20260705" in html_text


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
    assert "sortDate: '2026-07-05'" in js_text
    assert (
        "].sort((left, right) => right.sortDate.localeCompare(left.sortDate));"
        in js_text
    )
    assert "achievement-item" in css_text
    assert "achievement-time" in css_text


def test_achievements_page_records_upstream_prs() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert "Official upstream PR portfolio for vLLM and vLLM-Ascend" in js_text
    assert "https://github.com/vllm-project/vllm/pull/41449" in js_text
    assert "https://github.com/vllm-project/vllm/pull/41507" in js_text
    assert "https://github.com/vllm-project/vllm/pull/47622" in js_text
    assert "https://github.com/vllm-project/vllm/pull/47623" in js_text
    assert "https://github.com/vllm-project/vllm-ascend/pull/8958" in js_text
    assert "https://github.com/vllm-project/vllm-ascend/pull/10735" in js_text
    assert "https://github.com/vllm-project/vllm-ascend/pull/11417" in js_text
    assert "https://github.com/vllm-project/vllm-ascend/pull/11422" in js_text
    assert "https://github.com/vllm-project/vllm-ascend/pull/11449" in js_text
    assert "vLLM-Ascend #8958 · CI passed" in js_text
    assert "vLLM-Ascend #10735 · CI passed" in js_text
    assert "vLLM-Ascend #11449 · CI passed" in js_text
    assert "vLLM #41449 · label gate" in js_text
    assert "vLLM #41507 · label gate" in js_text
    assert "vLLM #47622 · label gate" in js_text


def test_achievements_page_does_not_treat_upstream_sync_as_achievement() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert "triton-ascend-hust aligned with upstream Triton Ascend" not in js_text
    assert "vllm-ascend-hust #105 · compatibility" not in js_text


def test_achievements_page_records_qwen_accepted_pr() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert "Jingyuan Tian PR accepted by the Qwen community" in js_text
    assert "恭喜 Jingyuan 同学的 PR 被 Qwen 社区正式接收" in js_text
    assert "https://github.com/QwenLM/qwen-code/pull/5185" in js_text


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
    assert "triton-ascend-hust" in package_names
    assert any(
        package.get("name") == "triton-ascend-hust"
        and package.get("group") == "core"
        and package.get("version") == "3.5.0-line"
        for package in meta.get("packages", [])
    )
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
    assert "leaderboard-public-20260706-broken-axis2" in html_text
    assert "function buildTrendChartModel(entries, metricConfig)" in js_text
    assert (
        "const sortValue = baseline ? Number.NEGATIVE_INFINITY : (timestamp || 0);"
        in js_text
    )
    assert "sortValue > existingVersion.sortValue" in js_text
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
    assert "const quantization = getEntryQuantization(entry);" in js_text
    assert (
        "return [workload, model, hardware, chipCount, nodeCount, precision, quantization, settingSignature].join('|');"
        in js_text
    )
    assert "默认全部视图只展示 mainline online serving 版本" in js_text
    assert "function isMainlineTrendEntry(entry)" in js_text
    assert "function getSelectOptionLabel(value, option, labelMapper = null)" in js_text
    assert "if (value === 'all')" in js_text
    assert "function isServingTrendWorkload(entry)" in js_text
    assert (
        "const SERVING_TREND_WORKLOAD_SUFFIXES = ['online', 'throughput', 'latency'];"
        in js_text
    )
    assert "function getServingTrendWorkloadBase(entry)" in js_text
    assert "replace(/-\\d+chip$/, '')" in js_text
    assert "function getTrendRefTokens(entry)" in js_text
    assert "function hasPullRequestMetadata(entry)" in js_text
    assert "getTrendRefTokens(entry).includes('main')" in js_text
    assert "current-main" not in js_text
    assert "isServingTrendWorkload(entry) && isMainlineTrendEntry(entry)" in js_text
    assert "function renderPerformanceTrendChart(entries)" in js_text
    assert "new Chart(canvas" in js_text
    assert "pointDetails" in js_text
    assert "spanGaps: true" in js_text
    assert "Keep one series continuous across x-axis slots" in js_text
    assert "function getTrendAxisValues(datasets)" in js_text
    assert "function shouldUseLogTrendAxis()" in js_text
    assert "trendAxisScale: 'auto'" in js_text
    assert "const BROKEN_TREND_AXIS_RATIO_THRESHOLD = 8;" in js_text
    assert "function isMissingTrendValue(value)" in js_text
    assert "!isMissingTrendValue(value) && Number.isFinite(Number(value))" in js_text
    assert "function getSortedPositiveTrendValues(datasets)" in js_text
    assert "function getTrendMedian(values)" in js_text
    assert "function getBrokenTrendAxisConfig(metricConfig, datasets)" in js_text
    assert "BROKEN_TREND_AXIS_MEDIAN_MULTIPLIER" in js_text
    assert "max / median < BROKEN_TREND_AXIS_RATIO_THRESHOLD" in js_text
    assert (
        "const brokenYAxisConfig = getBrokenTrendAxisConfig(metricConfig, datasets);"
        in js_text
    )
    assert "rawData: dataset.data" in js_text
    assert "brokenAxisData: dataset.data.map((value) => {" in js_text
    assert "state.trendAxisScale === 'log'" in js_text
    assert "document.querySelectorAll('[data-trend-axis]')" in js_text
    assert "data: dataset.data.map((value) => {" in js_text
    assert "mapBrokenTrendAxisValue(number, brokenYAxisConfig)" in js_text
    assert "if (isMissingTrendValue(value))" in js_text
    assert "const sourceValue = context.dataset.rawData?.[context.dataIndex]" in js_text
    assert (
        "const rawValue = isMissingTrendValue(sourceValue) ? NaN : Number(sourceValue)"
        in js_text
    )
    assert "function getLogTrendAxisBounds(datasets)" in js_text
    assert "brokenYAxisConfig || {}" in js_text
    assert "function mapBrokenTrendAxisValue(value, axisConfig)" in js_text
    assert "function unmapBrokenTrendAxisValue(value, axisConfig)" in js_text
    assert "trendAxisBreak" in js_text
    assert "ctx.fillText(t('trendAxisBreak')" in js_text
    assert "const brokenTrendAxisPlugin = {" in js_text
    assert "plugins: brokenYAxisConfig ? [brokenTrendAxisPlugin] : []" in js_text
    assert "min: 0," in js_text
    assert "tension: brokenYAxisConfig ? 0 : dataset.tension" in js_text
    assert "type: useLogYAxis ? 'logarithmic' : 'linear'" in js_text
    assert "min: yAxisBounds.min" in js_text
    assert "function getPerformanceTrendEntries(entries, selectedWorkload)" in js_text
    assert "if (selectedWorkload !== 'all')" in js_text
    assert "return true;" in js_text
    assert (
        "renderPerformanceTrendChart(getPerformanceTrendEntries(sortedFiltered, filters.workload));"
        in js_text
    )
    assert ".leaderboard-trend-panel {" in css_text
    assert ".trend-chart-wrap {" in css_text
    assert ".trend-axis-row {" in css_text
    assert ".trend-axis-toggle {" in css_text
    assert ".trend-axis-button.active {" in css_text


def test_single_chip_all_workload_auto_axis_uses_broken_axis_for_outliers() -> None:
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / "data" / "leaderboard_single.json").read_text())

    values = [
        float(entry.get("metrics", {}).get("throughput_tps") or 0)
        for entry in data
        if entry.get("workload", {}).get("name")
        and float(entry.get("metrics", {}).get("throughput_tps") or 0) > 0
    ]
    values.sort()
    assert len(values) >= 4

    median_index = len(values) // 2
    median = (
        (values[median_index - 1] + values[median_index]) / 2
        if len(values) % 2 == 0
        else values[median_index]
    )
    focused_max = median * 3
    in_focus_values = [value for value in values if value <= focused_max]

    assert values[-1] / median >= 8
    assert len(in_focus_values) < len(values)
    assert max(in_focus_values) < values[-1]


def test_multichip_trend_filter_covers_mainline_online_workloads() -> None:
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / "data" / "leaderboard_multi.json").read_text())

    def workload(entry: dict) -> str:
        return entry.get("workload", {}).get("name", "")

    def is_baseline(entry: dict) -> bool:
        return bool(entry.get("isBaseline")) or entry.get("engine") != "vllm-hust"

    def ref_tokens(entry: dict) -> set[str]:
        ref = str(entry.get("metadata", {}).get("github_ref") or "").lower()
        return {token for token in re.split(r"[^a-z0-9]+", ref) if token}

    def has_pr_metadata(entry: dict) -> bool:
        metadata = entry.get("metadata", {})
        return bool(metadata.get("github_pr_number") or metadata.get("github_pr_url"))

    def is_mainline(entry: dict) -> bool:
        return is_baseline(entry) or (
            not has_pr_metadata(entry) and "main" in ref_tokens(entry)
        )

    def is_serving_workload(entry: dict) -> bool:
        base = re.sub(r"-\d+chip$", "", workload(entry))
        return base.endswith(("-online", "-throughput", "-latency"))

    rows = [
        entry for entry in data if is_serving_workload(entry) and is_mainline(entry)
    ]
    online_chip_workloads = sorted(
        {
            workload(entry)
            for entry in data
            if re.search(r"-online-\d+chip$", workload(entry))
        }
    )
    assert online_chip_workloads

    refs_by_workload: dict[str, set[str]] = {
        name: set() for name in online_chip_workloads
    }
    for entry in rows:
        name = workload(entry)
        if name in refs_by_workload:
            refs_by_workload[name].add(entry.get("metadata", {}).get("github_ref", ""))

    for name, refs in refs_by_workload.items():
        assert "v0.18.0" in refs, f"{name} should include the baseline point"
        assert any(
            "main" in {token for token in re.split(r"[^a-z0-9]+", ref.lower()) if token}
            for ref in refs
        ), f"{name} should include at least one non-PR mainline point"


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
