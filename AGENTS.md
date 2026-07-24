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