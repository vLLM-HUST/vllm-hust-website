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
        root / "courses.html",
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


def test_contributors_page_lists_project_leadership() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "contributors.html").read_text(encoding="utf-8")

    leadership_pos = text.index('class="content-panel leadership-panel"')
    footprint_pos = text.index("Contributor footprint")
    assert leadership_pos < footprint_pos

    portrait_names = ("金海", "廖小飞", "张书豪")
    portrait_files = ("jin-hai.jpg", "liao-xiaofei.jpg", "zhang-shuhao.jpg")
    for name, file_name in zip(portrait_names, portrait_files, strict=True):
        portrait = root / "assets" / "contributors" / file_name
        assert portrait.exists() and portrait.stat().st_size > 1000
        assert f'alt="{name}"' in text
        assert f"assets/contributors/{file_name}" in text

    for role in ("实验室主任", "院长", "课题负责人"):
        assert role in text

    subproject_block = text.split('class="subproject-lead-list"', 1)[1].split(
        "</ul>", 1
    )[0]
    for name in (
        "王雄",
        "郑龙",
        "王庆刚",
        "罗瑞坤",
        "赵进",
        "刘海坤",
        "项翔",
        "姚鹏程",
        "万瑶",
    ):
        assert f"<li>{name}</li>" in subproject_block


def test_contributors_page_has_contribution_driven_member_profiles() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "contributors.html").read_text(encoding="utf-8")
    css = (root / "assets" / "site.css").read_text(encoding="utf-8")
    script = (root / "assets" / "contributors-page.js").read_text(encoding="utf-8")

    details_start = text.index('<details class="research-members-menu">')
    details_end = text.index("</details>", details_start)
    details = text[details_start:details_end]
    assert " open" not in details.split(">", 1)[0]
    assert 'id="contributors-members-menu-title"' in details
    assert 'id="contributors-core-member-list"' in details
    assert 'id="contributors-participant-list"' in details
    assert 'id="contributors-staff-list"' in details
    assert 'id="contributors-external-list"' in details
    assert 'id="contributors-profile-core-title"' in details
    assert 'id="contributors-profile-participant-title"' in details
    assert 'id="contributors-profile-staff-title"' in details
    assert 'id="contributors-profile-external-title"' in details
    assert "payload?.member_profiles" in script
    assert "profiles.core_members" in script
    assert "profiles.participants" in script
    assert "profiles.staff_members" in script
    assert "profiles.external_contributors" in script
    assert "CURATED_PROFILES" not in script
    assert "vllm-hust developer" in script
    assert "research_direction" in script
    assert "研究特长或兴趣方向" in text
    assert "Research strengths or interests" in text
    assert "contribution_areas" in script
    assert "participation_direction" in script
    assert "Identity pending" in script
    assert "function memberContextMarkup(item, lang)" in script
    assert "contributor-member-context" in script
    assert "contributors-page.js?v=member-interests-20260728-github-status" in text
    assert ".research-members-menu[open] summary::after" in css
    assert ".research-member-detail-row" in css
    assert ".research-member-group + .research-member-group" in css
    assert "@media (max-width: 860px)" in css


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


def test_trend_dataset_keeps_pr_and_historical_revisions() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    trend_filter = text.split("function getPerformanceTrendEntries", 1)[1].split(
        "function getScopeModelIdentity", 1
    )[0]

    assert "return isServingTrendWorkload(entry);" in trend_filter
    assert "github_pr_number" not in trend_filter
    assert "github_pr_url" not in trend_filter
    assert "isMainlineTrendEntry" not in text


def test_trend_version_key_includes_core_and_backend_commits() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    version_key = text.split("function getTrendVersionKey", 1)[1].split(
        "function getTrendVersionLabel", 1
    )[0]

    assert "getVersionFieldCommit(entry, 'core')" in version_key
    assert "getVersionFieldCommit(entry, 'backend')" in version_key
    assert "runtime_provenance?.plugin?.commit" in version_key
    assert "[coreCommit, backendCommit].filter(Boolean).join('+')" in version_key


def test_ci_runs_engine_version_consistency_sentinel() -> None:
    """The CI workflow must invoke the engine_version vs. git_commit sentinel.

    Catches the ``v0.17.2rc0-2810-ga46abb7ae`` / ``0.18.0.post1`` kind of
    split documented for the ``a46abb7ae`` backfill batch: two records for
    the same vllm-hust core+plugin pair rendered as two separate x-axis
    points because ``engine_version`` came from different sources.
    """
    root = Path(__file__).resolve().parents[1]
    workflow = (root / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    script = root / "scripts" / "check_engine_version_consistency.py"
    assert script.is_file(), f"missing sentinel script: {script}"
    assert "check_engine_version_consistency.py" in workflow
    assert "vllm-hust" in script.read_text(encoding="utf-8")


def test_trend_series_uses_versioned_semantic_spec_before_stored_hash() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    setting_signature = text.split("function getSettingSignature", 1)[1].split(
        "function getCompactSpecLabel", 1
    )[0]

    assert "const TREND_SEMANTIC_SPEC_VERSION = 'same-spec-semantic/v2';" in text
    assert "new Set(['host', 'port', 'model'])" in text
    assert "function normalizeSemanticSpecValue(value)" in text
    assert "function buildTrendSpecDefaults(entries)" in text
    assert "entries.filter((entry) => isTrendBaselineEntry(entry))" in text
    assert "function getEffectiveSemanticSpecParameters(" in text
    assert "function getEffectiveTrendWorkloadSemanticConfig(" in text
    assert "...(defaults.server || {}), ...parameters.server" in text
    assert "...(defaults.client || {}), ...parameters.client" in text
    assert (
        "workload: getEffectiveTrendWorkloadSemanticConfig(entry, specDefaults)" in text
    )
    assert "delete client.input_len;" in text
    assert "delete client.output_len;" in text
    assert setting_signature.index(
        "getSemanticSpecSignature"
    ) < setting_signature.index("resolved_spec_hash")
    assert "return semanticSignature;" in setting_signature
    assert "return `hash:${sameSpecHash}`;" in setting_signature
    assert "return `spec:${sameSpecId}`;" in setting_signature


def test_trend_series_discloses_real_configuration_overrides() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    assert "trendSeriesBaselineOnly: 'baseline result · 1 point'" in text
    assert "trendSeriesSinglePoint: 'current result · 1 point'" in text
    assert "trendSeriesBaselineOnly: '基线结果 · 1 个点'" in text
    assert "trendSeriesSinglePoint: '当前结果 · 1 个点'" in text
    assert "add matching baseline result" not in text
    assert "待补同配置基线结果" not in text
    assert "showLine: series.pointCount > 1" in text
    assert "pointRadius: series.pointCount === 1 ? 5 : 3" in text
    assert "item.evidenceLabel = formatTrendSeriesEvidence(item);" in text
    assert "evidence.className = 'trend-series-evidence';" in text
    assert "function getDifferingTrendConfigKeys(seriesGroup)" in text
    assert "function getRelevantTrendConfigKeys(series)" in text
    assert "isUnpaired ? getRelevantTrendConfigKeys(item) : []" in text
    assert "function getTrendConfigDifferenceItems(series, differingKeys)" in text
    assert "config.className = 'trend-series-config';" in text
    assert "chip.className = 'trend-series-config-chip';" in text
    assert "trendSeriesConfigDefault: '默认值（与基线一致）'" in text
    assert "trendSeriesConfigDetails: '相关配置'" in text
    assert "trendSeriesConfigMissing" not in text


def test_trend_defaults_collapse_omissions_but_keep_real_workload_drift() -> None:
    root = Path(__file__).resolve().parents[1]
    entries = []
    for name in ("leaderboard_single.json", "leaderboard_multi.json"):
        entries.extend(json.loads((root / "data" / name).read_text(encoding="utf-8")))

    ignored = {"host", "port", "model"}

    def normalize(value):
        if isinstance(value, dict):
            return {key: normalize(value[key]) for key in sorted(value)}
        if isinstance(value, list):
            return [normalize(item) for item in value]
        if isinstance(value, str):
            stripped = value.strip()
            if re.fullmatch(r"-?\d+(?:\.\d+)?", stripped):
                return float(stripped)
            if stripped.lower() in {"true", "false"}:
                return stripped.lower() == "true"
        return value

    def parameters(entry):
        same_spec = entry.get("same_spec") or {}
        resolved = {}
        for scope, source_key in (
            ("server", "resolved_server_parameters"),
            ("client", "resolved_client_parameters"),
        ):
            resolved[scope] = {
                key: normalize(value)
                for key, value in (same_spec.get(source_key) or {}).items()
                if key not in ignored
            }
        workload = entry.get("workload") or {}
        if resolved["client"].get("input_len") == normalize(
            workload.get("input_length")
        ):
            resolved["client"].pop("input_len")
        if resolved["client"].get("output_len") == normalize(
            workload.get("output_length")
        ):
            resolved["client"].pop("output_len")
        return resolved

    def workload_parameters(entry):
        workload = entry.get("workload") or {}
        values = {
            "name": str(workload.get("name") or ""),
            "input_length": normalize(workload.get("input_length")),
            "output_length": normalize(workload.get("output_length")),
            "batch_size": normalize(workload.get("batch_size")),
            "concurrent_requests": normalize(workload.get("concurrent_requests")),
            "dataset": str(workload.get("dataset") or ""),
        }
        return {
            key: value
            for key, value in values.items()
            if value is not None and value != ""
        }

    by_spec = {}
    for entry in entries:
        if (entry.get("quality") or {}).get("exclude_from_trends"):
            continue
        spec_id = str((entry.get("same_spec") or {}).get("spec_id") or "")
        if spec_id:
            by_spec.setdefault(spec_id, []).append(entry)

    effective_signature_counts = {}
    for spec_id, group in by_spec.items():
        baselines = [entry for entry in group if entry.get("engine") != "vllm-hust"]
        defaults = {
            "workload": {},
            "server": {},
            "client": (
                {"no_stream": False}
                if str(
                    (group[0].get("same_spec") or {}).get("scenario") or ""
                ).endswith("-online")
                else {}
            ),
        }
        for scope in ("workload", "server", "client"):
            baseline_values = [
                workload_parameters(entry)
                if scope == "workload"
                else parameters(entry)[scope]
                for entry in baselines
            ]
            keys = set().union(*baseline_values)
            for key in keys:
                recorded = [values[key] for values in baseline_values if key in values]
                if (
                    len(recorded) == len(baselines)
                    and len({json.dumps(value, sort_keys=True) for value in recorded})
                    == 1
                ):
                    defaults[scope][key] = recorded[0]

        signatures = set()
        for entry in group:
            explicit = parameters(entry)
            explicit["workload"] = workload_parameters(entry)
            effective = {
                scope: {**defaults[scope], **explicit[scope]}
                for scope in ("workload", "server", "client")
            }
            signatures.add(json.dumps(effective, sort_keys=True))
        scenario = str((group[0].get("same_spec") or {}).get("scenario") or "")
        effective_signature_counts[scenario] = len(signatures)

    historical_signature_limits = {
        "visionarena-online": 1,
        "instructcoder-online": 4,
        "prefix-repetition-online": 4,
        "random-online": 4,
        "random-latency": 5,
        "sharegpt-online": 3,
        "sharegpt-throughput": 3,
        "sonnet-throughput": 3,
    }
    assert effective_signature_counts
    for scenario, count in effective_signature_counts.items():
        assert count >= 1
        if scenario in historical_signature_limits:
            assert count <= historical_signature_limits[scenario]


def test_hard_constraints_baseline_block_is_rendered() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "leaderboard.css").read_text(encoding="utf-8")

    assert "hardConstraintsBaselineLabel" in js_text
    assert "hardConstraintsBaselineValue" in js_text
    assert '<div class="hard-constraints-baseline">' in js_text
    assert ".hard-constraints-baseline {" in css_text


def test_hf_loader_accepts_declared_empty_compare_snapshots() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "hf-data-loader.js").read_text(encoding="utf-8")

    assert "function isCompareSnapshotUsable(compareSnapshot)" in text
    assert "Incomplete compare snapshot from ${source}" in text
    assert "const declaredGroupCount = Number(compareSnapshot.group_count);" in text
    assert (
        "const declaredPairCount = Number(compareSnapshot.preferred_pair_count);"
        in text
    )
    assert (
        "return declaredGroupCount === groups.length && declaredPairCount === goalPairs.length;"
        in text
    )
    assert "return Array.isArray(compareSnapshot.groups);" in text
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


def test_empty_compare_snapshot_disables_focus_without_hiding_rows() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")

    assert "function hasCompleteSnapshotCompareGroups()" in js_text
    assert "viewOptions.hideIncompleteGroups = false;" in js_text
    assert "hideIncompleteToggle.disabled = !hasCompleteGroups;" in js_text
    assert (
        "compareRebuilding: 'Comparable baseline groups are being rebuilt.'" in js_text
    )
    assert "compareRebuilding: '可比基线组正在重建。'" in js_text


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
    assert 'href="./courses.html"' in text
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
    assert 'id="nav-courses"' in html_text
    assert 'class="cosmic-links"' not in html_text
    assert "home-card-leaderboard-title" not in html_text
    assert ".cosmic-links" not in css_text
    assert 'href="https://sage.org.ai/"' in html_text
    assert 'href="https://datasys.sage.org.ai/"' in html_text


def test_conference_navigation_is_general_not_event_specific() -> None:
    root = Path(__file__).resolve().parents[1]
    site_js = (root / "assets" / "site.js").read_text(encoding="utf-8")
    conferences_html = (root / "conferences.html").read_text(encoding="utf-8")

    for name in (
        "index.html",
        "leaderboard.html",
        "achievements.html",
        "contributors.html",
        "courses.html",
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


def test_courses_page_exposes_course_materials_and_project_pointers() -> None:
    root = Path(__file__).resolve().parents[1]
    site_js = (root / "assets" / "site.js").read_text(encoding="utf-8")
    courses_html = (root / "courses.html").read_text(encoding="utf-8")

    for name in (
        "index.html",
        "leaderboard.html",
        "achievements.html",
        "contributors.html",
        "conferences.html",
    ):
        text = (root / name).read_text(encoding="utf-8")
        assert 'id="nav-courses"' in text
        assert 'href="./courses.html"' in text

    assert "navCourses: 'Courses'" in site_js
    assert "navCourses: '课程'" in site_js
    assert 'data-page="courses"' in courses_html
    assert "大模型推理系统与实践" in courses_html
    assert "LLM Inference Systems and Practice" in courses_html
    assert "https://me.sage.org.ai/intro-to-llm-inference-engines.html" in courses_html
    assert "案例与练习" in courses_html
    assert "https://github.com/vLLM-HUST" in courses_html


def test_language_toggle_is_separate_from_primary_navigation() -> None:
    root = Path(__file__).resolve().parents[1]
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")

    for name in (
        "index.html",
        "leaderboard.html",
        "achievements.html",
        "contributors.html",
        "conferences.html",
        "courses.html",
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
    site_js = (root / "assets" / "site.js").read_text(encoding="utf-8")
    assert "langToggle: '中文'" in site_js
    assert "langToggle: 'EN'" in site_js
    assert "langToggleLabel: '切换为中文'" in site_js
    assert "langToggleLabel: 'Switch to English'" in site_js


def test_shared_visual_styles_use_current_cache_key_and_non_negative_tracking() -> None:
    root = Path(__file__).resolve().parents[1]
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")

    assert "letter-spacing: -" not in css_text
    assert "font-size: clamp(" not in css_text
    assert ".feature-card:hover" in css_text

    for name in (
        "index.html",
        "leaderboard.html",
        "achievements.html",
        "contributors.html",
        "conferences.html",
        "courses.html",
    ):
        text = (root / name).read_text(encoding="utf-8")
        assert "assets/site.css?v=upstream-qwen-community-20260727" in text
        assert "assets/site.js?v=engine-and-proving-ground-20260728" in text


def test_homepage_uses_shared_ecosystem_visual_system() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "index.html").read_text(encoding="utf-8")
    css_text = (root / "assets" / "home.css").read_text(encoding="utf-8")

    assert "assets/home.css?v=integration-branches-20260727" in html_text
    assert "assets/brand/ecosystem-infrastructure.png" in html_text
    assert 'class="execution-hero"' in html_text
    assert 'class="execution-architecture"' in html_text
    assert "cosmic-card" not in html_text
    assert ".execution-hero" in css_text
    assert ".execution-architecture" in css_text
    assert ".plugin-path" in css_text
    assert "letter-spacing: -" not in css_text
    assert "font-size: clamp(" not in css_text


def test_homepage_presents_a_verified_plugin_tool_ecosystem() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "index.html").read_text(encoding="utf-8")
    site_js = (root / "assets" / "site.js").read_text(encoding="utf-8")

    assert (
        "A domestic-compute inference engine—and a proving ground for reusable "
        "serving mechanisms." in html_text
    )
    assert "面向国产算力的大模型推理引擎，也是推理系统创新的试验场。" in html_text
    assert "Domestic-compute inference engine" in site_js
    assert "面向国产算力的推理引擎" in site_js
    assert 'class="plugin-path"' in html_text
    assert "Core mechanisms by system position." in html_text
    assert "按系统位置组织核心机制。" in html_text
    assert "independently integrated, transferred, or licensed" in html_text
    assert "独立集成、迁移或授权" in html_text

    expected_repositories = (
        "vllm-hust-bidkv",
        "vllm-ascend-hust-diffspec",
        "vllm-ascend-hust-LatchMoE",
        "vllm-ascend-quant-hust",
        "ascend-runtime-manager",
        "vllm-hust-perf-analyzer",
        "vllm-hust-profiling",
        "vllm-hust-benchmark",
        "vllm-ascend-hust",
        "triton-ascend-hust",
        "vllm-metal-hust",
    )
    for repository in expected_repositories:
        assert f"https://github.com/vLLM-HUST/{repository}" in html_text

    proving_ground = html_text.split('id="stack"', 1)[1].split('id="projects"', 1)[0]
    assert "Runtime Contract" in proving_ground
    assert "Plugin Interfaces" in proving_ground
    assert "Validation Matrix" in proving_ground
    assert "Benchmark Contract" in proving_ground
    assert "vllm-ascend-hust" not in proving_ground
    assert "triton-ascend-hust" not in proving_ground

    catalog = html_text.split('id="projects"', 1)[1].split('id="ecosystem"', 1)[0]
    ascend_adapter = catalog.index("vLLM Ascend HUST")
    metal_adapter = catalog.index("vLLM Metal HUST")
    assert ascend_adapter < metal_adapter
    assert "Triton Ascend HUST" in catalog
    assert "HUST-maintained Triton Ascend adaptation" in catalog
    assert (
        catalog.count('<span class="runtime-tag slate">integration branch</span>') == 3
    )
    assert '<span class="runtime-tag green">adapter</span>' not in catalog

    group_ids = (
        "mechanism-control-title",
        "mechanism-execution-title",
        "mechanism-representation-title",
        "mechanism-compiler-title",
        "mechanism-adapters-title",
        "mechanism-operations-title",
        "mechanism-validation-title",
    )
    group_positions = [catalog.index(f'id="{group_id}"') for group_id in group_ids]
    assert group_positions == sorted(group_positions)

    control_group = catalog.split('id="mechanism-control-title"', 1)[1].split(
        'id="mechanism-execution-title"', 1
    )[0]
    execution_group = catalog.split('id="mechanism-execution-title"', 1)[1].split(
        'id="mechanism-representation-title"', 1
    )[0]
    adapter_group = catalog.split('id="mechanism-adapters-title"', 1)[1].split(
        'id="mechanism-operations-title"', 1
    )[0]
    assert "vllm-hust-bidkv" in control_group
    assert "vllm-ascend-hust-diffspec" in execution_group
    assert "vllm-ascend-hust-LatchMoE" in execution_group
    assert "vllm-ascend-hust" in adapter_group
    assert "vllm-metal-hust" in adapter_group
    assert '<span class="runtime-tag">plugin</span>' not in adapter_group
    compiler_group = catalog.split('id="mechanism-compiler-title"', 1)[1].split(
        'id="mechanism-adapters-title"', 1
    )[0]
    assert "triton-ascend-hust" in compiler_group
    assert "integration branch" in compiler_group
    assert '<span class="runtime-tag">plugin</span>' not in compiler_group

    for internal_phrase in (
        "讲述口径",
        "提示词",
        "内部说明",
        "TODO",
        "speaker note",
    ):
        assert internal_phrase not in html_text


def test_subpages_use_shared_ecosystem_visual_system() -> None:
    root = Path(__file__).resolve().parents[1]
    css_text = (root / "assets" / "subpages.css").read_text(encoding="utf-8")

    for name in (
        "leaderboard.html",
        "achievements.html",
        "contributors.html",
        "conferences.html",
        "courses.html",
    ):
        text = (root / name).read_text(encoding="utf-8")
        assert "assets/subpages.css?v=leaderboard-contrast-system-20260730" in text
        assert '<span class="brand-mark">V</span>' in text
        assert "vLLM-HUST<small" in text

    assert 'body:not([data-page="home"])' in css_text
    assert 'body[data-page="leaderboard"]' in css_text
    assert "grid-template-columns: repeat(3, minmax(0, 1fr));" in css_text
    assert "overflow-wrap: anywhere;" in css_text
    assert "letter-spacing: -" not in css_text
    assert "font-size: clamp(" not in css_text


def test_cosmic_background_uses_scrollbar_safe_viewport_width() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "site.js").read_text(encoding="utf-8")

    assert "width = document.documentElement.clientWidth || window.innerWidth;" in text
    assert "width = window.innerWidth;" not in text


def test_leaderboard_model_column_and_timestamp_fallback_are_deployable() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "leaderboard.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "leaderboard.css").read_text(encoding="utf-8")

    assert 'id="table-head-model"' in html_text
    assert '<td colspan="9" class="details-cell">' in js_text
    assert "entry.model?.short_name || entry.model?.name || t('unknown')" in js_text
    assert "modelHeader.textContent = t('modelColumn');" in js_text
    assert "./data/last_updated.json?v=" in js_text
    assert "timestamp = await window.HFDataLoader.getLastUpdated();" in js_text
    assert "assets/leaderboard.css?v=model-column-sync-20260724" in html_text
    assert "assets/leaderboard.js?v=metric-state-semantics-20260730" in html_text
    assert "td:first-child:not(.version-table-cell)" in css_text
    assert "td.version-table-cell" in css_text


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


def test_leaderboard_summary_cards_have_complete_light_theme_contrast_contract() -> (
    None
):
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "leaderboard.html").read_text(encoding="utf-8")
    css_text = (root / "assets" / "subpages.css").read_text(encoding="utf-8")

    assert html_text.index("assets/leaderboard.css") < html_text.index(
        "assets/subpages.css"
    )
    assert "leaderboard-contrast-system-20260730" in html_text

    required_selectors = (
        'body[data-page="leaderboard"] .engine-summary-card.is-leader',
        'body[data-page="leaderboard"] .engine-summary-card .summary-metric',
        'body[data-page="leaderboard"] .engine-summary-card .summary-metric span',
        'body[data-page="leaderboard"] .engine-summary-card .summary-metric strong',
        'body[data-page="leaderboard"] .engine-summary-card.is-leader .engine-summary-meta',
        'body[data-page="leaderboard"] .engine-summary-card .engine-summary-version-label',
        'body[data-page="leaderboard"] .engine-summary-card .engine-summary-version-value',
        'body[data-page="leaderboard"] .engine-summary-card .engine-summary-footer-label',
        'body[data-page="leaderboard"] .engine-summary-card .engine-summary-footer-value',
        'body[data-page="leaderboard"] .engine-summary-card .leader-mark',
        'body[data-page="leaderboard"] .coverage-pill.success',
        'body[data-page="leaderboard"] .coverage-pill.warning',
        'body[data-page="leaderboard"] .hc-badge.pass',
        'body[data-page="leaderboard"] .hc-badge.fail',
    )
    for selector in required_selectors:
        assert selector in css_text

    # These declared light-theme pairs all exceed WCAG AA's 4.5:1 threshold.
    assert "color: #52615f;" in css_text
    assert "background: #e5f1ed;" in css_text
    assert "color: #195c35;" in css_text
    assert "background: #e2f3e7;" in css_text


def test_leaderboard_failure_state_has_bilingual_aa_contrast_contract() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "leaderboard.html").read_text(encoding="utf-8")
    css_text = (root / "assets" / "subpages.css").read_text(encoding="utf-8")

    assert "leaderboard-contrast-system-20260730" in html_text
    assert "'leaderboard-error-title': '排行榜数据加载失败'" in html_text
    assert "'leaderboard-error-text': '请刷新页面或检查网络连接。'" in html_text
    assert 'body[data-page="leaderboard"] #leaderboard-error-title' in css_text
    assert 'body[data-page="leaderboard"] #leaderboard-error-text' in css_text
    assert "background: #fff4f4;" in css_text

    def luminance(hex_color: str) -> float:
        channels = [int(hex_color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
        linear = [
            channel / 12.92
            if channel <= 0.04045
            else ((channel + 0.055) / 1.055) ** 2.4
            for channel in channels
        ]
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

    def contrast(foreground: str, background: str) -> float:
        lighter, darker = sorted(
            (luminance(foreground), luminance(background)), reverse=True
        )
        return (lighter + 0.05) / (darker + 0.05)

    assert contrast("#7f1d1d", "#fff4f4") >= 4.5
    assert contrast("#5f2525", "#fff4f4") >= 4.5


def test_achievements_page_omits_ambiguous_workload_evidence_cards() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert "achievement-evidence" not in html_text
    assert "achievements-evidence" not in html_text
    assert "renderEvidence" not in js_text
    assert "leaderboard-contrast-system-20260730" in html_text


def test_achievements_page_uses_reverse_chronological_timeline() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "subpages.css").read_text(encoding="utf-8")

    assert 'id="achievement-timeline"' in html_text
    assert 'class="achievement-timeline"' in html_text
    assert "achievement-artifacts" not in html_text
    assert "achievement-milestones" not in html_text
    assert "const ACHIEVEMENTS = [" in js_text
    assert "sortDate: '2026-07-02'" in js_text
    assert (
        ".sort((left, right) => right.sortDate.localeCompare(left.sortDate));"
        in js_text
    )
    assert 'id="achievement-release-line"' in html_text
    assert 'data-achievement-filter="publication"' in html_text
    assert "function renderReleaseLine" in js_text
    assert "activeAchievementFilter" in js_text
    assert "timelineFilterLabel: '筛选成果时间轴'" in js_text
    assert "releaseLineLabel: '成果发布线'" in js_text
    assert "achievement-item" in css_text
    assert "achievement-release-node" in css_text
    assert "achievement-status" in css_text


def test_achievements_timeline_only_records_merged_upstream_prs() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")
    achievements = js_text.split("const ACHIEVEMENTS = [", 1)[1].split(
        "const UPSTREAM_PULL_REQUESTS = [", 1
    )[0]

    assert "https://github.com/QwenLM/qwen-code/pull/5185" in achievements
    assert "https://github.com/QwenLM/qwen-code/pull/7701" in achievements
    assert "submitted upstream" not in achievements
    assert "opened upstream" not in achievements
    assert "https://github.com/vllm-project/vllm/pull/41449" not in achievements
    assert "https://github.com/vllm-project/vllm-ascend/pull/8958" not in achievements
    assert "https://github.com/triton-lang/triton-ascend/pull/918" not in achievements


def test_open_upstream_prs_render_in_repository_accordion() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")

    assert 'id="upstream-repository-browser"' in html_text
    assert "upstream-pr-prev" not in html_text
    assert "upstream-pr-next" not in html_text
    assert "const UPSTREAM_PULL_REQUESTS = [" in js_text
    assert "const UPSTREAM_REPOSITORIES = [" in js_text
    assert "function renderUpstreamPRs" in js_text
    assert "expandedUpstreamRepository" in js_text
    assert 'aria-expanded="${isExpanded}"' in js_text
    assert 'aria-controls="upstream-pr-details"' in js_text
    assert "upstream-repository-grid" in css_text
    assert "upstream-repository-card.is-active" in css_text
    assert ".upstream-pr-details[hidden]" in css_text
    assert "upstream-pr-track" not in css_text
    assert "upstream-pr-card" not in css_text
    assert "assets/site.css?v=upstream-qwen-community-20260727" in html_text
    assert (
        "assets/achievements-page.js?v=engine-and-proving-ground-20260728" in html_text
    )
    assert (
        "number: 49017, title: '[Perf] Batch KV scale host conversion', status: 'draft'"
        not in js_text
    )
    assert "number: 49018" not in js_text
    assert "number: 49017" not in js_text
    assert "number: 49034" in js_text
    assert "number: 49035" in js_text
    assert "number: 12343" in js_text
    assert "status: 'needs-label'" in js_text
    assert "status: 'review-requested'" in js_text
    assert "status: 'ready-evidence'" in js_text
    assert "status: 'evidence-pending'" in js_text
    assert "status: 'ci-retry'" in js_text
    assert "status: 'merged'" in js_text
    assert "[Performance][Worker] Reuse DP metadata sync buffers" in js_text
    assert "待上游标签" in js_text
    assert "已请求评审" in js_text
    assert "实机证据已补" in js_text
    assert "Draft · 待复现问题" in js_text
    assert "待重跑 CI" in js_text
    assert 'strong[data-status="review-requested"]' in css_text
    assert 'strong[data-status="ready-evidence"]' in css_text
    assert 'strong[data-status="evidence-pending"]' in css_text
    assert 'strong[data-status="merged"]' in css_text

    assert js_text.count("owner: 'vllm-project'") == 2
    assert js_text.count("owner: 'triton-lang'") == 1
    assert js_text.count("owner: 'QwenLM'") == 1
    assert "https://github.com/QwenLM/qwen-code" in js_text
    assert "https://github.com/QwenLM/qwen-code/pull/5185" in js_text
    assert "https://github.com/QwenLM/qwen-code/pull/7701" in js_text
    assert "'upstream-pr-kicker': '上游生态'" in html_text
    assert "'upstream-pr-title': '开放与已合入贡献'" in html_text
    assert "pullRequestCount(repository.pullRequests.length)" in js_text

    open_urls = (
        "https://github.com/vllm-project/vllm/pull/47793",
        "https://github.com/vllm-project/vllm/pull/49034",
        "https://github.com/vllm-project/vllm/pull/49035",
        "https://github.com/vllm-project/vllm-ascend/pull/12316",
        "https://github.com/vllm-project/vllm-ascend/pull/12317",
        "https://github.com/vllm-project/vllm-ascend/pull/12342",
        "https://github.com/vllm-project/vllm-ascend/pull/12343",
        "https://github.com/vllm-project/vllm-ascend/pull/12344",
        "https://github.com/triton-lang/triton-ascend/pull/918",
        "https://github.com/triton-lang/triton-ascend/pull/919",
        "https://github.com/triton-lang/triton-ascend/pull/920",
        "https://github.com/triton-lang/triton-ascend/pull/922",
        "https://github.com/triton-lang/triton-ascend/pull/923",
    )
    for url in open_urls:
        assert url in js_text

    for superseded_number in (917, 11417, 11449, 47622, 47623):
        assert f"/pull/{superseded_number}" not in js_text


def test_achievements_page_does_not_treat_upstream_sync_as_achievement() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert "triton-ascend-hust aligned with upstream Triton Ascend" not in js_text
    assert "vllm-ascend-hust #105 · compatibility" not in js_text


def test_achievements_page_records_qwen_accepted_prs() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert "Plan-gate fix merged into Qwen Code" in js_text
    assert "Plan-gate 修复合入 Qwen Code" in js_text
    assert "status: { en: 'Merged', zh: '已合入' }" in js_text
    assert "https://github.com/QwenLM/qwen-code/pull/5185" in js_text
    assert "Inline-math recognition fix merged into Qwen Code" in js_text
    assert "行内公式识别修复合入 Qwen Code" in js_text
    assert "Jingyuan Tian unified bounded inline-math recognition" in js_text
    assert "田景远为 Qwen Code CLI" in js_text
    assert "https://github.com/QwenLM/qwen-code/pull/7701" in js_text


def test_bidkv_is_presented_as_a_reusable_result_repository() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")
    pdf_path = root / "assets" / "papers" / "bidkv-sc2026.pdf"

    assert 'id="result-repository-list"' in html_text
    assert "已发表插件与系统" in html_text
    assert "成果仓库" in js_text
    assert "const RESULT_REPOSITORIES = [" in js_text
    assert (
        "BidKV: Utility-Guided Preemption Scheduling for KV-Pressure LLM Serving"
        in js_text
    )
    assert (
        "publication: { en: 'Accepted · SC 2026', zh: '已接收 · SC 2026' }" in js_text
    )
    assert "./assets/papers/bidkv-sc2026.pdf" in js_text
    assert "github.com/vLLM-HUST/vllm-hust-bidkv" in js_text
    assert "github.com/vLLM-HUST/vllm-ascend-hust-bidkv" not in js_text
    assert "github.com/intellistream/bidkv" not in js_text
    assert "repositoryName: 'vllm-hust-bidkv'" in js_text
    assert "names: { en: 'Yanbo Chen · Mingqi Wang', zh: '陈彦博 · 王明琪' }" in js_text
    assert "names: { en: 'Shuhao Zhang', zh: '张书豪' }" in js_text
    assert "result-repository-card" in css_text
    assert "result-repository-team" in css_text
    assert "artifact: { en: 'Scheduling plugin', zh: '调度插件' }" in js_text
    assert "boundary: { en: 'KV lifecycle + scheduler hooks'" in js_text
    assert "provingGround: { en: 'vLLM-HUST', zh: 'vLLM-HUST' }" in js_text
    assert pdf_path.is_file()
    assert pdf_path.stat().st_size > 100_000


def test_diffspec_is_presented_as_an_sc2026_result_repository() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert (
        "DiffSpec: Differential Speculative Decoding for Ultra-Long-Sequence Inference"
        in js_text
    )
    assert "DiffSpec：面向超长序列推理的差分投机解码加速系统" in js_text
    assert "项目团队：主要作者杜忠承；指导老师黄禹。" in js_text
    assert "name: 'DiffSpec'" in js_text
    assert "repositoryName: 'vllm-ascend-hust-diffspec'" in js_text
    assert "面向超长序列的差分投机解码系统" in js_text
    assert (
        "publication: { en: 'Accepted · SC 2026', zh: '已接收 · SC 2026' }" in js_text
    )
    assert "names: { en: 'Zhongcheng Du', zh: '杜忠承' }" in js_text
    assert "names: { en: 'Yu Huang', zh: '黄禹' }" in js_text
    assert (
        "repository: 'https://github.com/vLLM-HUST/vllm-ascend-hust-diffspec'"
        in js_text
    )
    assert "repository: 'https://github.com/vLLM-HUST/vllm-hust'" not in js_text
    result_repositories = js_text.split("const RESULT_REPOSITORIES = [", 1)[1].split(
        "    ];", 1
    )[0]
    assert result_repositories.index(
        "repositoryName: 'vllm-hust-bidkv'"
    ) < result_repositories.index("repositoryName: 'vllm-ascend-hust-diffspec'")
    assert "artifact: { en: 'Decoding system', zh: '解码系统' }" in js_text
    assert "boundary: { en: 'Draft + verify + decode hooks'" in js_text
    assert (
        "assets/achievements-page.js?v=engine-and-proving-ground-20260728" in html_text
    )


def test_published_result_repository_sits_between_hero_and_snapshot() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")
    css_text = (root / "assets" / "site.css").read_text(encoding="utf-8")

    hero_index = html_text.index('class="page-hero"')
    repositories_index = html_text.index(
        'class="content-panel result-repositories-panel"'
    )
    snapshot_index = html_text.index('id="achievements-stats-kicker"')
    assert hero_index < repositories_index < snapshot_index

    assert "https://github.com/vLLM-HUST/vllm-hust-bidkv" in js_text
    assert "https://vllm.ai/blog/2026-05-18-pegaflow" not in js_text
    assert "https://github.com/vLLM-HUST/pegaflow-hust" not in js_text
    assert "https://github.com/vLLM-HUST/vllm-ascend-quant-hust" not in js_text
    assert js_text.count("repositoryName:") == 2
    assert "result-repository-title" in css_text
    assert "result-repository-link" in css_text
    assert "result-repository-index" not in css_text
    assert "result-repository-tags" not in css_text
    assert "research-cache-salt-bucketing" not in js_text


def test_research_output_excludes_unpublished_artifacts() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    assert js_text.count("status: { en: 'Accepted · SC 2026'") == 2
    assert "adaptive-selector-plugin" not in js_text
    assert "fcs-domestic-chip-llm-recsys" not in js_text
    assert "cccf-domestic-inference-engine-survey" not in js_text
    assert "Pre-submission" not in js_text
    assert "Targeting FCS" not in js_text
    assert "Writing in public" not in js_text
    assert "Published on vLLM Blog" not in js_text


def test_achievements_page_excludes_external_origin_work() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "achievements.html").read_text(encoding="utf-8")
    js_text = (root / "assets" / "achievements-page.js").read_text(encoding="utf-8")

    for external_claim in (
        "PegaFlow",
        "Novita AI",
        "Organization mirror",
        "组织镜像",
        "Technical publication",
        "技术发表",
    ):
        assert external_claim not in js_text

    assert (
        "projects that we mirror, integrate, validate, or adapt are not achievements."
        in js_text
    )
    assert (
        "Accepted papers by our team, owned project releases, and upstream "
        "contributions merged from our contributors."
    ) in html_text
    assert (
        "仅展示本团队已接收论文、自主项目正式发布，以及团队成员已合入的上游贡献。"
        in html_text
    )
    assert "Project releases" in html_text
    assert "technical: 'Project releases'" in js_text


def test_upstream_pr_light_panel_has_explicit_contrast_overrides() -> None:
    root = Path(__file__).resolve().parents[1]
    css_text = (root / "assets" / "subpages.css").read_text(encoding="utf-8")

    required_selectors = (
        ".upstream-pr-details-head > strong",
        ".upstream-pr-details-head a",
        ".upstream-pr-number",
        ".upstream-pr-title",
        ".upstream-pr-link",
        '.upstream-pr-row > strong[data-status="draft"]',
        '.upstream-pr-row > strong[data-status="review-requested"]',
        '.upstream-pr-row > strong[data-status="ready-evidence"]',
        '.upstream-pr-row > strong[data-status="ci-retry"]',
    )
    for selector in required_selectors:
        assert selector in css_text

    assert "color: var(--sub-ink);" in css_text
    assert "color: #105d61;" in css_text
    assert "background: #d9f0f4;" in css_text
    assert "background: #fee3e7;" in css_text


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
    assert "leaderboard-empty-compare-v8-20260730" in html_text
    assert "model-column-sync-20260724" in html_text
    assert 'id="toggle-trend-series"' in html_text
    assert 'id="trend-series-search"' in html_text
    assert 'id="trend-series-list"' in html_text
    assert (
        "function buildTrendChartModel(entries, metricConfig, defaultEntries = entries)"
        in js_text
    )
    assert "function getTrendVersionSortInfo(entry)" in js_text
    assert (
        "commitCount: commitCountMatch ? parseInt(commitCountMatch[1], 10) : null"
        in js_text
    )
    assert "const leftHasCommitCount = left.commitCount !== null;" in js_text
    assert "return leftHasCommitCount ? -1 : 1;" in js_text
    assert "return left.timestamp - right.timestamp;" in js_text
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
    assert "展示当前范围内全部在线服务版本，包括 PR 与历史运行" in js_text
    assert "function getSelectOptionLabel(value, option, labelMapper = null)" in js_text
    assert "if (value === 'all')" in js_text
    assert "function isServingTrendWorkload(entry)" in js_text
    assert (
        "const SERVING_TREND_WORKLOAD_SUFFIXES = ['online', 'throughput', 'latency'];"
        in js_text
    )
    assert "function getServingTrendWorkloadBase(entry)" in js_text
    assert "replace(/-\\d+chip$/, '')" in js_text
    assert "current-main" not in js_text
    assert "return isServingTrendWorkload(entry);" in js_text
    assert (
        "function renderPerformanceTrendChart(entries, defaultEntries = entries)"
        in js_text
    )
    assert "new Chart(canvas" in js_text
    assert "legend: {" in js_text
    assert "display: false" in js_text
    assert "function renderTrendSeriesControl(series)" in js_text
    assert "state.trendChart.setDatasetVisibility(datasetIndex, visible)" in js_text
    assert "pointDetails" in js_text
    assert "spanGaps: true" in js_text
    assert "Keep one series continuous across x-axis slots" in js_text
    assert "function getTrendAxisValues(datasets)" in js_text
    assert "function getFiniteTrendMetricValue(entry, metricKey)" in js_text
    assert "rawValue === null || rawValue === undefined || rawValue === ''" in js_text
    assert (
        "const value = getFiniteTrendMetricValue(entry, metricConfig.key);" in js_text
    )
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
    assert "getPerformanceTrendEntries(data, 'all')" in js_text
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


def test_default_all_workload_trend_uses_sparse_version_union() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    data = json.loads((root / "data" / "leaderboard_single.json").read_text())

    def workload(entry: dict) -> str:
        return entry.get("workload", {}).get("name", "")

    def is_serving_workload(entry: dict) -> bool:
        base = re.sub(r"-\d+chip$", "", workload(entry))
        return base.endswith(("-online", "-throughput", "-latency"))

    def commit(entry: dict, key: str) -> str:
        versions = entry.get("metadata", {}).get("version_components") or {}
        component = versions.get(key) or {}
        return str(component.get("commit") or "")[:10].lower()

    def version_key(entry: dict) -> str:
        engine = entry.get("engine") or entry.get("metadata", {}).get("engine")
        prefix = "baseline" if engine != "vllm-hust" else "current"
        revision = "+".join(
            part for part in (commit(entry, "core"), commit(entry, "backend")) if part
        )
        return f"{prefix}|{revision or entry.get('engine_version')}"

    def series_key(entry: dict) -> tuple:
        hardware = entry.get("hardware") or {}
        model = entry.get("model") or {}
        cluster = entry.get("cluster") or {}
        return (
            workload(entry),
            model.get("canonical_id") or model.get("name"),
            hardware.get("chip_model"),
            hardware.get("chip_count"),
            cluster.get("node_count", 1),
            model.get("precision"),
        )

    rows = [
        entry
        for entry in data
        if is_serving_workload(entry)
        and not entry.get("quality", {}).get("exclude_from_trends")
        and entry.get("metrics", {}).get("throughput_tps") not in (None, "")
    ]
    assert rows

    points_by_series: dict[tuple, set[str]] = {}
    for entry in rows:
        points_by_series.setdefault(series_key(entry), set()).add(version_key(entry))

    plotted_version_keys = set().union(*points_by_series.values())
    complete_version_keys = {
        version
        for version in plotted_version_keys
        if all(version in points for points in points_by_series.values())
    }

    assert plotted_version_keys
    assert not complete_version_keys
    assert "const plottedVersionKeys = new Set(" in js_text
    assert "const completeVersionKeys = new Set(" not in js_text
    assert "spanGaps: true" in js_text


def test_multichip_trend_filter_keeps_pr_and_historical_online_workloads() -> None:
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / "data" / "leaderboard_multi.json").read_text())

    def workload(entry: dict) -> str:
        return entry.get("workload", {}).get("name", "")

    def is_serving_workload(entry: dict) -> bool:
        base = re.sub(r"-\d+chip$", "", workload(entry))
        return base.endswith(("-online", "-throughput", "-latency"))

    rows = [entry for entry in data if is_serving_workload(entry)]
    online_chip_workloads = sorted(
        {
            workload(entry)
            for entry in data
            if re.search(r"-online-\d+chip$", workload(entry))
        }
    )
    if not data:
        assert rows == []
        assert online_chip_workloads == []
        return
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

    all_visible_refs = {
        str(entry.get("metadata", {}).get("github_ref") or "") for entry in rows
    }
    assert any("pr" in ref.lower() for ref in all_visible_refs), (
        "the all-workload trend input should retain PR or historical revision points"
    )


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


def test_contributor_loader_uses_newest_canonical_or_local_snapshot() -> None:
    root = Path(__file__).resolve().parents[1]
    text = (root / "assets" / "contributors-page.js").read_text(encoding="utf-8")

    assert "const SOURCES = [" in text
    assert (
        "https://raw.githubusercontent.com/vLLM-HUST/.github/main/profile/core_contributors.json"
        in text
    )
    assert "'./data/core_contributors.json'" in text
    assert "async function fetchPayload()" in text
    assert "Promise.allSettled" in text
    assert "AbortController" in text
    assert "right.updatedAt.localeCompare(left.updatedAt)" in text
    assert "Number(right.hasMemberProfiles) - Number(left.hasMemberProfiles)" in text
    assert "right.index - left.index" in text
    assert "return candidates[0].payload;" in text
    assert (
        "item.display_name || item.chinese_name || item.name || item.github_login || ''"
        in text
    )
    assert "item.identity_confirmed === false" in text
    assert (
        "console.warn('[contributors] source failed', SOURCES[index], result.reason);"
        in text
    )


def test_contributor_snapshot_has_unique_human_identities() -> None:
    root = Path(__file__).resolve().parents[1]
    snapshot_path = root / "data" / "core_contributors.json"
    payload = json.loads(snapshot_path.read_text(encoding="utf-8"))

    assert payload["updated_at"] == "2026-07-25"
    assert len(payload["all_repos"]["contributors"]) == 32
    assert len(payload["core_repos"]["contributors"]) == 21
    profiles = payload["member_profiles"]
    assert len(profiles["core_members"]) == 18
    assert len(profiles["participants"]) == 42
    assert len(profiles["staff_members"]) == 5
    assert len(profiles["external_contributors"]) == 1
    assert len(profiles["unresolved_contributors"]) == 0
    assert "vllm-ascend-hust-bidkv" not in payload["all_repos"]["scope_repos"]
    assert "vllm-ascend-hust-bidkv" not in payload["core_repos"]["scope_repos"]
    assert "vllm-ascend-hust-diffspec" in payload["core_repos"]["scope_repos"]
    assert "vllm-hust-bidkv" in payload["core_repos"]["scope_repos"]
    assert len(payload["all_repos"]["scope_repos"]) >= 17

    core_logins = {
        item.get("github_login") for item in payload["core_repos"]["contributors"]
    }
    core_names = {
        item.get("display_name") for item in payload["core_repos"]["contributors"]
    }
    assert "cybber695" in core_logins
    assert "杜忠承" in core_names

    for scope in ("all_repos", "core_repos"):
        contributors = payload[scope]["contributors"]
        logins = [
            item["github_login"].casefold()
            for item in contributors
            if item.get("github_login")
        ]
        assert len(logins) == len(set(logins))

        identities = " ".join(
            f"{item.get('display_name', '')} {item.get('github_login', '')}"
            for item in contributors
        ).casefold()
        for automation_marker in ("qoder", "dependabot", "github-actions", "[bot]"):
            assert automation_marker not in identities

    all_names = {item["display_name"] for item in payload["all_repos"]["contributors"]}
    all_git_names = {
        item.get("name", "").casefold() for item in payload["all_repos"]["contributors"]
    }
    assert {"tony", "qixinzhang2601"}.isdisjoint(all_git_names)
    assert {"田景远", "程月甲", "张俊辉"} <= all_names
    assert (
        not {"Jingyuan", "Fletcher Tian", "Paul", "Paul Cheng", "Junhui Zhang"}
        & all_names
    )

    core_repo_names = set(profiles["core_repo_names"])
    core_ids = {item["person_id"] for item in profiles["core_members"]}
    participant_ids = {item["person_id"] for item in profiles["participants"]}
    assert "github:apei-520" in participant_ids
    staff_ids = {item["person_id"] for item in profiles["staff_members"]}
    external_ids = {item["person_id"] for item in profiles["external_contributors"]}
    assert core_ids.isdisjoint(participant_ids)
    assert core_ids.isdisjoint(staff_ids)
    assert core_ids.isdisjoint(external_ids)
    assert participant_ids.isdisjoint(staff_ids)
    assert participant_ids.isdisjoint(external_ids)
    assert staff_ids.isdisjoint(external_ids)
    assert len(core_ids) == len(profiles["core_members"])
    assert len(participant_ids) == len(profiles["participants"])
    assert len(staff_ids) == len(profiles["staff_members"])
    assert len(external_ids) == len(profiles["external_contributors"])
    assert all(
        set(item["repos"]) & core_repo_names for item in profiles["core_members"]
    )
    assert all(
        not (set(item["repos"]) & core_repo_names) for item in profiles["participants"]
    )
    assert {item["display_name"] for item in profiles["staff_members"]} == {
        "luoxiaohei",
        "张俊辉",
        "王胜",
        "程月甲",
        "龙斌",
    }
    assert {
        item["display_name"]
        for item in profiles["staff_members"]
        if item["core_repository_contributor"]
    } == {"王胜", "程月甲", "张俊辉"}

    people = {
        item["display_name"]: item
        for item in (
            profiles["core_members"]
            + profiles["participants"]
            + profiles["staff_members"]
            + profiles["external_contributors"]
        )
    }
    assert people["张睿诚"]["github_login"] == "KimmoZAG"
    expected_github_ids = {
        "张书豪": "ShuhaoZhangTony",
        "李昶吾": "Li-changwu",
        "李旭恒": "sssarrior",
        "高鸿儒": "hongrugao",
        "彭浩然": "Tkhkrnx",
        "王明琪": "MingqiWang-coder",
        "杨锦昀": "Yang-YJY",
        "王子澳": "ZeroJustMe",
        "张森磊": "zslchase",
        "陈德斌": "pluviophile-chen",
        "毛言粲": "yancanmao",
        "万瑞鹏": "wrp-wrp",
        "周雨桐": "FirmamentumX",
        "董君瑶": "carsontung666",
        "雷欣妍": "leixy2004",
        "路庆浩": "Luqhhh",
        "刘子墨": "Liu-zimo-LZM",
        "欧丹丹": "oddod",
        "钱柯彤": "Devilsssssss",
        "段盈君": "qingwanruojun",
        "何维": "healer-positive",
        "谢汉龙": "xiehanlong834-gif",
        "周升晖": "keridone",
        "姚世文": "YWHUTER",
        "沈家乐": "Fuze1111",
        "李林浩": "Sunshine-llh",
        "余天成": "yutiantian0115",
        "李欣妍": "XinYanLi-0725",
        "韦若皓": "kotoriqaq0",
    }
    for name, github_id in expected_github_ids.items():
        assert people[name]["github_login"] == github_id
    assert people["田景远"]["github_login"] == "CubeLander"
    assert people["田景远"]["role"]["zh"] == "学生"
    assert people["田景远"]["advisor"]["zh"] == "张书豪"
    assert people["匡明轩"]["github_login"] == "sad-and-bad1231"
    assert people["匡明轩"]["advisor"]["zh"] == "张书豪"
    assert people["马俊豪"]["github_login"] == "kms12425"
    assert people["邱瑞杰"]["github_login"] == "Jerry01020"
    assert people["赵建军"]["github_login"] == "curryzjj"
    assert people["高西岭"]["github_login"] == "XilingGao"
    assert people["王胜"]["role"]["zh"] == "工程师"
    assert people["王胜"]["staff_member"] is True
    assert people["张俊辉"]["github_login"] == "junhuizhang-boop"
    assert people["张俊辉"]["role"]["zh"] == "工程师（派欧云）"
    assert people["张俊辉"]["staff_member"] is True
    assert people["luoxiaohei"]["role"]["zh"] == "工程师（派欧云）"
    assert people["luoxiaohei"]["staff_member"] is True
    assert people["程月甲"]["role"]["zh"] == "工程师"
    assert people["程月甲"]["staff_member"] is True
    assert people["龙斌"]["role"]["zh"] == "项目/科研助理"
    assert people["龙斌"]["staff_member"] is True
    assert people["龙斌"]["github_status"]["zh"] == "无 GitHub ID"
    assert people["宋功轩"]["github_status"]["zh"] == "GitHub ID 待确认"
    assert people["彭成"]["github_status"]["zh"] == "GitHub ID 待确认"
    assert people["赵建军"]["role"]["zh"] == "教师"
    assert people["高西岭"]["research_direction"]["zh"] == "KV 量化"
    assert "多级" not in people["高西岭"]["research_direction"]["zh"]
    assert people["刘世峰"]["github_login"] == "Remygred"
    assert people["刘世峰"]["role"]["zh"] == "学生"
    assert people["刘世峰"]["advisor"]["zh"] == "张书豪"
    expanded_research_profiles = {
        "张书豪": "并行与分布式系统；状态管理；流处理；运行时系统；大模型推理基础设施；状态复用；记忆增强智能体中间件",
        "张睿诚": "智能体记忆体；长期记忆评测；推理技术实现；Benchmark；多模态长上下文推理",
        "陈彦博": "SLO-aware 请求调度；国产硬件推理引擎适配；性能测试与工程实现",
        "李旭恒": "KV Cache 跨请求与跨 Chunk 复用；共享选择层；缓存精度与存储权衡；vLLM、SGLang、Mooncake 与 CacheBlend",
        "高鸿儒": "动态图系统；计算机系统结构；国产硬件运行时与推理引擎优化",
        "曹哲": "Prompt/KV Cache 复用；缓存驱逐；语义感知与在线自适应策略；Agent 场景缓存生命周期管理",
        "彭浩然": "SLO-aware 调度；Workflow/Agent-aware Serving；程序感知调度；工作流状态管理",
        "杨锦昀": "Flink 流处理；分布式数据处理；流系统与推理系统协同",
        "王子澳": "ANNS；向量流连接；多核并行；RAG 检索基础设施",
        "朱鑫材": "智能体数据库；Agent 状态与记忆持久化；数据管理中间件",
    }
    for name, expected in expanded_research_profiles.items():
        assert people[name]["research_direction"]["zh"] == expected
    for name in ("韦若皓", "万瑞鹏", "周雨桐", "毛言粲", "雷欣妍"):
        assert people[name]["research_direction"]["zh"] == "待补充"
    assert (
        people["刘俊"]["research_direction"]["zh"]
        == "SLO 感知的 LLM Serving 调度；MLA 与 KV Cache 优化；张量并行与多 GPU 推理解码；延迟保障与资源分配；应用感知 Serving"
    )
    assert (
        people["李昶吾"]["research_direction"]["zh"]
        == "大模型推理系统软硬件协同优化；动态 MoE 推理；AI 加速器执行效率优化；Ascend NPU Host–Device 协同优化"
    )
    assert people["田景远"]["research_direction"]["zh"].startswith(
        "昇腾 NPU 推理系统优化"
    )
    assert people["匡明轩"]["research_direction"]["zh"].endswith("Attention Kernel")
    assert people["谢汉龙"]["research_direction"]["zh"].startswith("异构 GPU 推理分离")
    assert people["姚世文"]["research_direction"]["zh"].endswith("异构计算")
    assert (
        people["陈德斌"]["research_direction"]["zh"]
        == "MoE 专家卸载优化；控制面优化（与李昶吾协作）"
    )
    assert (
        people["陈子嘉"]["research_direction"]["zh"]
        == "昇腾 NPU 算子级性能调优；PyPTO Tile 编程；算子融合"
    )
    assert (
        people["何维"]["research_direction"]["zh"]
        == "性能优化；算法与硬件调优；方向适应性强"
    )
    assert people["董君瑶"]["research_direction"]["zh"] == "向量数据库"
    assert (
        people["路庆浩"]["research_direction"]["zh"]
        == "Profiling；vLLM 性能问题分析与优化"
    )
    assert (
        people["沈家乐"]["research_direction"]["zh"]
        == "KV Cache 复用；长上下文推理优化；多后端运行时适配"
    )
    for name in ("李林浩", "余天成"):
        assert people[name]["role"]["zh"] == "学生"
        assert people[name]["advisor"]["zh"] == "张书豪"
    assert (
        people["余天成"]["research_direction"]["zh"]
        == "大模型推理方向待定；愿意根据课题安排探索相关研究"
    )
    assert people["曹哲"]["github_login"] == "xmdhb"
    assert people["曹哲"]["role"]["zh"] == "学生"
    assert people["曹哲"]["advisor"]["zh"] == "张书豪"
    assert people["李庚"]["github_login"] == "Anjiangy"
    assert people["李庚"]["role"]["zh"] == "学生"
    assert people["李庚"]["advisor"]["zh"] == "张书豪"
    assert people["马俊豪"]["advisor"]["zh"] == "张书豪"
    assert people["Yang Sun"]["github_login"] == "sunYangGitHub"
    assert people["Yang Sun"]["role"]["zh"] == "学生"
    assert people["Yang Sun"]["advisor"]["zh"] == "张书豪"
    assert people["杜忠承"]["github_login"] == "dzcixy"
    assert people["杜忠承"]["advisor"]["zh"] == "黄禹"
    assert people["徐晨曦"]["github_login"] == "xsun2001"
    assert people["徐晨曦"]["external_contributor"] is True
    assert people["徐晨曦"]["role"]["zh"] == "外部贡献者（港科大（广州））"
    expected_advisors = {
        "马川湖": "王雄",
        "吴天宇": "郑龙",
        "李昶吾": "张书豪",
        "王润泽": "王庆刚",
        "谷昌伟": "罗瑞坤",
        "杨杰": "赵进",
        "陈彦博": "张书豪",
        "郑凌峰": "刘海坤",
        "王鸿坤": "项翔",
        "崔钰嘉": "姚鹏程",
        "赵文举": "姚鹏程",
        "刘思辰": "万瑶",
        "韦若皓": "万瑶",
        "周升晖": "张书豪",
        "何维": "张书豪",
        "路庆浩": "张书豪",
        "钱柯彤": "张书豪",
        "沈家乐": "张书豪",
        "刘子墨": "张书豪",
        "欧丹丹": "张书豪",
        "段盈君": "张书豪",
        "陈子嘉": "张书豪",
        "董君瑶": "张书豪",
        "谢汉龙": "张书豪",
        "姚世文": "张书豪",
    }
    for name, advisor in expected_advisors.items():
        assert people[name]["advisor"]["zh"] == advisor
        if advisor == "张书豪" and name in {
            "周升晖",
            "何维",
            "路庆浩",
            "钱柯彤",
            "沈家乐",
            "刘子墨",
            "欧丹丹",
            "段盈君",
            "陈子嘉",
            "董君瑶",
            "谢汉龙",
            "姚世文",
        }:
            assert people[name]["role"]["zh"] == "学生"
    unresolved_ids = {item["person_id"] for item in profiles["unresolved_contributors"]}
    assert "github:remygred" not in unresolved_ids
    assert "github:dzcixy" not in unresolved_ids
    assert "github:sunyanggithub" not in unresolved_ids
    assert "github:luoxiaohei" not in unresolved_ids
    assert unresolved_ids == set()

    kuang_rows = [
        item
        for item in payload["all_repos"]["contributors"]
        if item["person_id"] == "github:sad-and-bad1231"
    ]
    assert len(kuang_rows) == 1
    assert kuang_rows[0]["commits"] == 17

    canonical_snapshot = (
        root.parent / "vllm-hust-org-profile" / "profile" / "core_contributors.json"
    )
    if canonical_snapshot.exists():
        assert snapshot_path.read_bytes() == canonical_snapshot.read_bytes()


def test_core_contributor_stats_precede_all_repository_stats() -> None:
    root = Path(__file__).resolve().parents[1]
    html_text = (root / "contributors.html").read_text(encoding="utf-8")

    core_index = html_text.index('id="contributors-core-tbody"')
    all_index = html_text.index('id="contributors-all-tbody"')

    assert core_index < all_index
    assert "推理引擎核心仓库与已接收插件" in html_text
    assert "BidKV、DiffSpec" in html_text


def test_contributor_profile_cards_have_readable_light_theme_colors() -> None:
    root = Path(__file__).resolve().parents[1]
    css_text = (root / "assets" / "subpages.css").read_text(encoding="utf-8")
    html_text = (root / "contributors.html").read_text(encoding="utf-8")

    assert ".research-member-identity a:visited" in css_text
    assert ".research-member-identity strong" in css_text
    assert "color: #0c1112;" in css_text
    assert ".research-member-identity small" in css_text
    assert "color: #475569;" in css_text
    assert ".research-member-detail-row b" in css_text
    assert "color: #176f72;" in css_text
    assert "leaderboard-contrast-system-20260730" in html_text
    assert "github-status" in html_text
    page_js = (root / "assets" / "contributors-page.js").read_text(encoding="utf-8")
    assert "localized(item, 'github_status', lang)" in page_js


def test_leaderboard_uses_one_metric_state_contract_across_views() -> None:
    root = Path(__file__).resolve().parents[1]
    js_text = (root / "assets" / "leaderboard.js").read_text(encoding="utf-8")
    html_text = (root / "leaderboard.html").read_text(encoding="utf-8")

    assert "function getMetricState(entry, metricKey)" in js_text
    assert "function getMeasuredMetricValue(entry, metricKey)" in js_text
    assert "function formatMetricState(entry, metricKey" in js_text
    assert "function formatSummaryMetric(value, metricState" in js_text
    assert "workload.endsWith('-throughput') ? 'not_applicable' : 'invalid'" in js_text
    assert "metricKey === 'peak_mem_mb' && value === 0" in js_text
    assert "return getMeasuredMetricValue(entry, metricKey)" in js_text
    assert "getMeasuredMetricValue(a, column)" in js_text
    assert "getMeasuredMetricValue(current, metric)" in js_text
    assert "formatMetricState(variant, 'peak_mem_mb')" in js_text
    assert "metricMissing: '未采集'" in js_text
    assert "metricNotApplicable: '不适用'" in js_text
    assert "metric-state-semantics-20260730" in html_text
