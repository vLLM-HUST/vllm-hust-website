# vllm-hust-website Agent Guide

> Agent instructions for the vllm-hust leaderboard website.

## Repository Overview

`vllm-hust-website` is the public-facing leaderboard and marketing site for the vllm-hust project.
It is a pure static site (HTML/CSS/JS) with no build step. The main page is `leaderboard.html`,
which loads JSON benchmark data and renders interactive comparison tables and trend charts.

## Project Structure

```
vllm-hust-website/
├── leaderboard.html                  # Main leaderboard page
├── index.html                        # Landing/marketing page
├── assets/
│   ├── leaderboard.js                # 🎯 Core rendering logic (~6000 lines)
│   ├── leaderboard.css               # Leaderboard styles
│   ├── site.js / site.css            # Shared site utilities
│   └── version-meta-loader.js        # Version metadata loader
├── scripts/
│   ├── aggregate_results.py          # 🎯 Data aggregation & compare-snapshot generation
│   ├── sync_leaderboard_snapshots.py # Snapshot sync
│   ├── generate_rich_data.py         # Data enrichment
│   └── validate-local.sh             # Local validation
├── data/
│   ├── leaderboard_single.json       # Single-GPU benchmark data
│   ├── leaderboard_multi.json        # Multi-GPU benchmark data
│   ├── leaderboard_compare.json      # Derived compare snapshot
│   └── schemas/leaderboard_v1.schema.json
├── docs/
│   ├── LEADERBOARD_UI_INVARIANTS.md  # Non-negotiable UI rules
│   ├── FIELD_SPECIFICATION.md        # Data format contract
│   └── ARCHITECTURE_TASK_MAPPING.md  # Runtime architecture mapping
└── tests/
    ├── test_aggregate_results.py
    └── test_site_structure.py
```

## Key Files and Responsibilities

### `assets/leaderboard.js` (~6000 lines, IIFE pattern)

The main rendering engine. Key functions and their line locations:

| Function | Line | Purpose |
|----------|------|---------|
| `getSettingSignature` | ~1704 | Builds stable setting hash from `resolved_server_parameters` |
| `getSettingSummary` | ~1757 | Renders human-readable setting summary (IO, TP/PP, dtype, Mem, MaxLen, RPS, BS, CC) |
| `getTrendVersionKey` | ~2454 | Builds trend X-axis version key from core+backend commit pair |
| `getTrendVersionLabel` | ~2469 | Renders trend X-axis label |
| `getTrendSeriesKey` | ~2409 | Builds series key from workload+model+hardware+setting |
| `buildTrendChartModel` | ~2526 | Builds the Chart.js data model from entries |
| `renderPerformanceTrendChart` | ~2938 | Renders the trend chart using Chart.js |
| `buildTrendRows` | ~2355 | Computes trend deltas for the table |
| `buildCompareGroups` | ~5063 | Groups entries by scope for comparison |
| `applyComparisonView` | ~5150 | Applies `hideIncompleteGroups` filtering |
| `isNumericVersion` | ~2091 | PEP 440 version validation, rejects bare commit hashes |
| `compareDisplayVersions` | ~2110 | Version comparison with git-describe suffix handling |
| `compareVersions` | ~5718 | Numeric version comparison with `post1`/`rc0` support |
| `aggregateVersionBuilds` | ~2277 | Collapses equivalent package builds for table display |
| `getPerformanceTrendEntries` | ~1874 | Filters entries suitable for trend chart |

### `scripts/aggregate_results.py`

Data aggregation script that generates `leaderboard_compare.json` from leaderboard entries.

Key functions:
- `build_setting_signature()`: Creates stable setting fingerprint (includes `gpu_memory_utilization` and `max_model_len`)
- `build_setting_summary()`: Creates readable summary (includes `Mem` and `MaxLen`)

## Rendering Data Flow

```
leaderboard_single.json / leaderboard_multi.json
    │
    ▼
leaderboard.js loadData()
    │
    ▼
renderTable()
    ├── filtered = data.filter(by search/filters)          ← raw filtered data
    ├── comparisonView = applyComparisonView(filtered)      ← applies hideIncompleteGroups
    ├── visibleEntries = comparisonView.visibleEntries      ← filtered by hideIncompleteGroups
    ├── mergedEntries = aggregateVersionBuilds(visibleEntries)
    ├── sortedFiltered = sortForDisplay(mergedEntries)
    │
    ├── renderPerformanceTrendChart(filtered)               ← 🎯 uses RAW filtered, NOT visibleEntries
    ├── renderOverview(sortedFiltered, comparisonView)
    ├── renderTable(sortedFiltered)                         ← main table
    └── renderCoverage(comparisonView)
```

**IMPORTANT**: The trend chart must receive `filtered` (raw data before `hideIncompleteGroups` filtering),
not `visibleEntries`. This ensures all commits and revisions remain visible on the X-axis regardless
of whether their comparison group is complete. See the comment at line 3578-3579.

## Critical Rendering Invariants

### 1. Setting Signature (Hash) Consistency

The `getSettingSignature` function must include ALL relevant server parameters for hash consistency:

```javascript
// Order matters - must match Python's build_setting_signature
return [
    workload?.input_length ?? 'unknown-input',
    workload?.output_length ?? 'unknown-output',
    server?.tensor_parallel_size ?? 'unknown-tp',
    server?.pipeline_parallel_size ?? 'unknown-pp',
    server?.dtype || 'unknown-dtype',
    server?.gpu_memory_utilization ?? 'unknown-mem',    // ← MUST be included
    server?.max_model_len ?? 'unknown-maxlen',            // ← MUST be included
    client?.request_rate ?? 'unknown-rps',
].join('|');
```

The Python `aggregate_results.py` must use the same fields in the same order.

### 2. Setting Summary Display

The `getSettingSummary` function renders:
```
IO 6144/512 • TP1 • BF16 • Mem 0.6 • MaxLen 30720 • RPS inf • official spec
```

- `Mem` and `MaxLen` are only shown when the data is available (`!= null`)
- If data is missing, they are omitted (graceful degradation)
- Fallback to `entry.setting_summary || 'default settings'`

### 3. Trend Chart X-Axis

- X-axis keys are built from `coreCommit + backendCommit` (from `runtime_provenance?.plugin?.commit`)
- Sorted by commit count (from `engine_version`), then timestamp
- Baseline entries are always placed first on the X-axis
- Only versions with at least one plotted point are displayed

### 4. hideIncompleteGroups

- `hideIncompleteGroups: true` hides groups with only one engine (no baseline comparison)
- This affects the MAIN TABLE only
- The TREND CHART must NOT be affected by this filter
- Incomplete groups are still tracked and shown in the coverage summary

### 5. Version Sorting

Three-level sorting chain:
1. `isNumericVersion()`: Validates PEP 440 format, rejects bare commit hashes
2. `compareDisplayVersions()`: Strips git-describe suffixes, compares numerically
3. `compareVersions()`: Handles `post1`, `rc0`, and other non-numeric suffixes

## Common Issues and Fixes

### X-axis data points are fewer than expected

**Cause**: The trend chart was receiving `visibleEntries` (filtered by `hideIncompleteGroups`)
instead of the raw `filtered` data.

**Fix**: Change line 3580 from:
```javascript
renderPerformanceTrendChart(getPerformanceTrendEntries(visibleEntries, filters.workload));
```
to:
```javascript
renderPerformanceTrendChart(getPerformanceTrendEntries(filtered, filters.workload));
```

### Setting summary shows "default settings" instead of Mem/MaxLen

**Cause**: The data in `leaderboard_compare.json` was generated before the `gpu_memory_utilization`
and `max_model_len` fields were added to `aggregate_results.py`. The `scope.setting_summary` in the
compare snapshot takes priority over the dynamic `getSettingSummary()` function.

**Fix**: Regenerate the compare snapshot data with the updated `aggregate_results.py`:
```bash
cd scripts && python3 aggregate_results.py
```

### Mem/MaxLen not showing in some entries

**Cause**: The data was generated with an older version of `backfill_single_gpu.py` that didn't
include `gpu_memory_utilization` and `max_model_len` in `resolved_server_parameters`.

**Fix**: Re-run benchmark backfill with the updated script, or accept that older entries lack
these fields (graceful degradation is built in).

## Data Missing Documentation

### Data Quality Status (as of 2026-07-24)

| Field | Entries with data | Entries without data | % Complete |
|-------|------------------|---------------------|-----------|
| `gpu_memory_utilization` | 52/191 | 139/191 | 27% |
| `max_model_len` | 19/191 | 172/191 | 10% |
| Both fields | 19/191 | 172/191 | 10% |

**Root Cause**: The `backfill_single_gpu.py` script was updated to include `gpu_memory_utilization`
and `max_model_len` in `resolved_server_parameters` and `resolved_spec_hash` calculation. However,
existing benchmark data was generated before this fix and lacks these fields.

**Impact**:
- Entries with these fields show `Mem 0.6` and `MaxLen 30720` in the setting summary
- Entries without these fields show the setting summary without these indicators
- Hash comparison between old and new entries may differ if the `spec_id` is not available

**Resolution**: Re-run `backfill_single_gpu.py` with `SAME_SPEC_MAX_MODEL_LEN` set to regenerate
the missing data. After regeneration, the `leaderboard.compare.json` snapshot must also be
regenerated.

## Local Development

```bash
# Start local server
python3 -m http.server 8080

# Validate data
python3 scripts/validate-local.sh

# Regenerate compare snapshot
python3 scripts/aggregate_results.py

# Run tests
python3 -m pytest tests/
```

## Versioning Policy

- The website is a pure static site - no npm/pip packages to publish
- Data files are regenerated on each sync
- The `leaderboard_compare.json` snapshot is the derived view used for rendering
- Data format follows `data/schemas/leaderboard_v1.schema.json`

---

## Overall Requirements

This section defines the complete set of requirements for the vllm-hust leaderboard website.
All development work must align with these requirements and their acceptance criteria.

### R1: Correct Comparison Semantics (P0)

The trend chart must accurately distinguish between "full checkpoint trends" and "targeted base/head comparisons".

**Requirements:**
- "Align Model & Hardware" must preserve all series under the same umbrella (model/hardware/topology/precision), not reduce to a single exact group via `selectFocusGroup`.
- If a single best-comparable configuration view is needed, it must be a separately named control (e.g., "Focus Best Comparable Config"), not reuse "Align Model & Hardware".
- Two view modes must be supported:
  - `checkpoint/full-matrix`: Only checkpoints with planned full-matrix coverage.
  - `targeted-pair`: Paired baseline/head display by `campaign_id/comparison_id`.
- `spanGaps` must only span checkpoints that should exist per the coverage contract but are missing. Targeted PRs that did not run other workloads are NOT gaps.
- Fallback to `metadata.data_source/ref` before new fields are published; prefer `coverage_class`, `campaign_id/comparison_id`, `point_role` after publication.

**Acceptance Criteria:**
- [ ] "Align Model & Hardware" preserves all series under the umbrella.
- [ ] Checkpoint view shows no false gaps from targeted PRs.
- [ ] Base/head pairs are strictly paired; incomplete pairs show "blocked" without connecting lines.

### R2: Correct Value Selection & Applicability (P0)

The UI must not silently select misleading values or display invalid metrics.

**Requirements:**
- Remove silent best-of logic for duplicate runs within the same series/revision.
- Prefer `canonical_aggregate` from benchmark data; fall back to latest or median with sample count `n` and range shown.
- Validate metric applicability: latency workload throughput must show N/A; invalid `0` must not be plotted as throughput.
- Clearly distinguish between: `0`, `missing`, `N/A`, `blocked`, and `excluded`. Tooltip and series panel must use the same semantics.

**Acceptance Criteria:**
- [ ] Duplicate runs no longer silently pick the best value; aggregation rule, `n`, and range are visible.
- [ ] Throughput chart shows no invalid random-latency `0` points.
- [ ] Tooltip clearly distinguishes `0`, `missing`, `N/A`, `blocked`, and `excluded`.

### R3: Data Rendering Pipeline Consistency (P0)

The hash computation between frontend JS and backend Python must be identical.

**Requirements:**
- `getSettingSignature()` (JS frontend) and `build_setting_signature()` (Python aggregate script) must use the same fields and order:
  ```
  input_length | output_length | tensor_parallel_size | pipeline_parallel_size | dtype | gpu_memory_utilization | max_model_len | request_rate
  ```
- `backfill_single_gpu.py`'s `_generate_same_spec` must always include `max_model_len` (default 30720) in `resolved_spec_hash`, independent of environment variables.
- `resolved_server_parameters` must always include both `gpu_memory_utilization` and `max_model_len`.
- New entries must have automatic hash consistency validation; warn or reject on mismatch.

**Acceptance Criteria:**
- [ ] JS `getSettingSignature()` and Python `build_setting_signature()` use identical field sets and order.
- [ ] `backfill_single_gpu.py` `resolved_spec_hash` always includes `max_model_len`.
- [ ] Hash consistency validation passes for new entries.

### R4: Data Quality & Graceful Degradation (P0)

The UI must handle missing data gracefully without crashing or showing undefined values.

**Requirements:**
- `getSettingSummary()` must omit `gpu_memory_utilization` and `max_model_len` fields when they are `null`, without errors or `undefined` display.
- Trend chart X-axis must use `filtered` (raw filtered data) not `visibleEntries` (post-hideIncompleteGroups), ensuring all revisions are visible.
- `renderPerformanceTrendChart` must use `filtered` data, with an explicit comment in the code.
- When data is missing, display `entry.setting_summary || 'default settings'` without crashing.

**Acceptance Criteria:**
- [ ] Entries missing `gpu_memory_utilization` or `max_model_len` show no empty fields and no errors.
- [ ] Trend chart X-axis shows all revisions, unaffected by comparison view completeness.
- [ ] `renderPerformanceTrendChart` uses `filtered` data with explicit inline comment.
- [ ] Final fallback to `entry.setting_summary || 'default settings'` works without errors.

### R5: Reduce All-Workload View Misleading (P1)

The default all-workload chart must not visually mislead users.

**Requirements:**
- Use focused or faceted display by default, avoiding compression of `0–5615 tok/s` range series into a single broken-axis chart.
- Series count label should read "plottable series for current metric", not implying it equals total experiment count.
- Series panel must label data roles: `main trend`, `matched base/head`, `unpaired experimental`, `invalid/retired`.
- X-axis and tooltip must clearly indicate checkpoint/campaign identity, not imply feature branches are part of a continuous version timeline.

**Acceptance Criteria:**
- [ ] Default all-workload view uses focused/faceted display.
- [ ] Series count label correctly says "plottable series for current metric".
- [ ] Series panel shows correct role labels.
- [ ] X-axis and tooltip show checkpoint/campaign identity.

### R6: Version Sorting & Display (P1)

Version sorting must be correct and consistent.

**Requirements:**
- `isNumericVersion()` must validate PEP 440 format and reject bare commit hashes.
- `compareDisplayVersions()` must handle git-describe suffixes correctly.
- `compareVersions()` must handle `post1`, `rc0`, and other non-numeric suffixes.
- Baseline entries must always be placed first on the X-axis.

**Acceptance Criteria:**
- [ ] Bare commit hashes are rejected by `isNumericVersion()` (returns false).
- [ ] Baseline entries are always first on the X-axis.
- [ ] Version sorting with `post1`, `rc0` suffixes is correct.

### R7: Setting Summary Display (P1)

The setting summary must be informative and consistent between frontend and backend.

**Requirements:**
- Display format: `IO 6144/512 • TP1 • BF16 • Mem 0.6 • MaxLen 30720 • RPS inf • official spec`
- `Mem` and `MaxLen` only shown when data is available (`!= null`).
- `leaderboard_compare.json`'s `scope.setting_summary` must match the dynamically computed `getSettingSummary()` result.

**Acceptance Criteria:**
- [ ] Setting Summary correctly shows `Mem` and `MaxLen` when data is present.
- [ ] Graceful degradation when data is missing — no empty fields.
- [ ] Final fallback to `entry.setting_summary || 'default settings'`.

### R8: Test Coverage

All requirements must have corresponding test coverage.

**Requirements:**
- Structured JS regression tests for comparison semantics, value selection, and setting summary.
- Hash consistency tests for `aggregate_results.py`.
- Graceful degradation tests for missing data scenarios.
- Screenshots (Chinese and English) covering single-series, 19-series all-workload, and model-hardware-aligned states.
- Post-deployment regression check with current public snapshot.

**Acceptance Criteria:**
- [ ] JS regression tests for semantics, value selection, and setting summary.
- [ ] `aggregate_results.py` hash consistency tests.
- [ ] Frontend degradation tests for missing data.
- [ ] Screenshots provided for 3 states in both languages.
- [ ] Post-deployment snapshot verification passes.

## Requirements Priority Summary

| Priority | Area | Description |
|----------|------|-------------|
| **P0** | R1: Comparison Semantics | Correct umbrella filtering, views, and spanGaps |
| **P0** | R2: Value Selection | No best-of, metric applicability, semantic distinction |
| **P0** | R3: Pipeline Consistency | JS/Python hash consistency, backfill completeness |
| **P0** | R4: Graceful Degradation | Missing data handling, X-axis visibility |
| **P1** | R5: View Misleading | Focused display, role labels, campaign identity |
| **P1** | R6: Version Sorting | PEP 440, git-describe, baseline positioning |
| **P1** | R7: Setting Summary | Format, graceful fallback, frontend/backend alignment |
| **—** | R8: Tests | Regression, hash, degradation, screenshot, snapshot |

## Cross-References

- [docs/Task.md](file:///root/vllm/vllm-hust-website/docs/Task.md) — Detailed task breakdown with acceptance criteria
- [docs/LEADERBOARD_UI_INVARIANTS.md](file:///root/vllm/vllm-hust-website/docs/LEADERBOARD_UI_INVARIANTS.md) — Non-negotiable UI rules
- [docs/MISSING_DATA_REPORT.md](file:///root/vllm/vllm-hust-website/docs/MISSING_DATA_REPORT.md) — Data quality analysis
- [docs/FIELD_SPECIFICATION.md](file:///root/vllm/vllm-hust-website/docs/FIELD_SPECIFICATION.md) — Data format contract
- [tests/test_aggregate_results.py](file:///root/vllm/vllm-hust-website/tests/test_aggregate_results.py) — Aggregate tests
- [.github/agents/vllm-hust-website-copilot-agent.md](file:///root/vllm/vllm-hust-website/.github/agents/vllm-hust-website-copilot-agent.md) — Copilot instructions