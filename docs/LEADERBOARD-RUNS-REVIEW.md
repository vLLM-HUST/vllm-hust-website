# Run-oriented leaderboard review

Review entry: <https://vllm-hust.sage.org.ai/leaderboard-runs.html>.

This is the additive **Leaderboard v2 / 排行榜 v2** entry, linked directly from the shared top
navigation. The existing leaderboard, its scripts, publication schema and snapshots remain
unchanged.

## Reading the page

- Use the **Leaderboards / Tasks** tabs to switch views; only one table is visible. Clicking a task
  tag switches to its definition and highlights the row. Returning preserves the result filters,
  sorting and page.
- Click a measurement column title to toggle ascending/descending sorting; its separate small arrow
  opens a dropdown with searchable checkboxes. Selections combine OR within a column and AND across
  columns, over all pages. Apply commits checkbox changes; Cancel / Escape discard them. Clear
  filter restores one column; Reset restores grouped order. Missing numbers remain last in either
  sort direction. Options cover the current top-level scope, not just the other column filters.
  Changing that top-level scope clears column selections; Reset clears selections and sorting
  together.
- The flat table is organized by **(model, parallel configuration), task tag, MOD**.
- The page starts directly with the view tabs and table, without a hero or filter panel. All current
  and historical records appear together by default. Hardware is an explicit, sortable and filterable column (including 910B2 and 910B3), not a hidden global scope. Publication scope
  remains optional inside the Run menu; Reset restores all records. Different hardware remains
  distinct in model identity and is never aggregated together.
- Engine and MOD are separate sortable/filterable columns. Engine reports the host runtime and
  platform backend; BetterScale's published engine slot is retained in raw provenance but is not
  mistaken for the host. MOD names, maintainers and catalog links come from the same
  `data/ecosystem.json` used by the workshop.
- MOD evidence states distinguish enabled, baseline, related experiment (activation unverified),
  and unknown. Baseline rows associated with a MOD are not enabled results. Missing identity
  evidence does not mean no MOD. MOD filters include the evidence state.
- TTFT and TPOT are request means in milliseconds. Each P95 is the corresponding **individual run's
  request distribution**, not an average of repeated percentiles. There are no latency thresholds or
  SLO gates.
- Each repeat stays a separate row. No fastest-repeat selection. Published aggregates without raw
  repeats remain explicitly labelled aggregates, with no derived P95.
- Click a task tag to inspect its dataset, input/output lengths, concurrency, request rate, request
  count and remaining workload arguments in the task-definition table. Dataset length summaries are
  not presented as fixed lengths.
- The final column gives a short graph / MTP / APC prefix. Expand it for server, client and
  provenance configuration, with immutable source links where available. Unrecorded settings remain
  unknown rather than being inferred as disabled.
- Missing metrics stay `—`. Offline batch latency is shown in configuration details, not relabelled
  as TTFT. Legacy throughput token-count basis may be unspecified.

## Implementation boundaries

`leaderboard-runs.html` uses the existing atomic snapshot loader but not the legacy leaderboard
controller. `assets/leaderboard-runs-model.js` owns pure normalization, identity and grouping.
`assets/leaderboard-runs.js` owns DOM state and interaction; `assets/leaderboard-runs.css` is scoped
to the new surface.

Task identity includes the workload contract and client workload arguments, not server graph
settings or the MOD. Unknown workload arguments are retained to avoid silently merging distinct
tasks. Missing client contracts stay separately identified. Task labels gain a short identity suffix
only when otherwise ambiguous. The expanded run preserves the recorded configuration for audit; this
adapter does not claim to standardize all historical workload formats.

`data/leaderboard_run_observations.json` supplements the 30 TP2 publication aggregates (16 non-MTP
and 14 MTP2) with 60 sealed original observations. It joins by publication entry ID; current
publication wins over historical duplicates. Raw evidence is pinned to benchmark commit `56f78b5`.

Rebuild the supplement with a checkout of that benchmark revision:

```bash
python scripts/build_leaderboard_run_observations.py \
  --benchmark-repo /path/to/vllm-hust-benchmark \
  --revision 56f78b5 \
  --pattern 'betterscale-qwen27-tp2*-20260922-*' \
  --output data/leaderboard_run_observations.json
```

The builder verifies checksums against the pinned Git sealing manifest, does not modify benchmark
artifacts, and takes P95 directly from compressed raw run results. This review adapter is not a new
production submission protocol. New repeat campaigns need an explicit supplement refresh; missing
supplementary evidence is shown rather than fabricated.

## Validation and review focus

```bash
node --test tests/leaderboard_runs_model.test.cjs
pytest tests/test_leaderboard_run_observations.py -q
python -m http.server 8774 --bind 127.0.0.1
# In another terminal, with Playwright Chromium installed:
python scripts/verify_leaderboard_runs_browser.py
```

The browser check compares every displayed TP2 metric with the sealed supplement, checks 8 task
definitions / 60 run rows, filtering, pagination, keyboard expansion, exclusive table views, header
multi-selection, numeric ordering, tag navigation, missing evidence, and desktop/mobile EN/ZH in
both OS color schemes. The dedicated review workflow retains screenshots.

Tutor review should focus on whether the flat hierarchy is clear, whether task tags make comparisons
sufficiently explicit, and whether the configuration prefix and expanded evidence provide enough
auditability before this replaces the old entry.

## MOD identity audit (2026-09-23)

`data/leaderboard_mod_attributions.json` is a reviewed presentation supplement, joined by exact
publication entry ID. It is not a second component catalog or a rewrite of benchmark artifacts.
Its groups retain evidence links and reasoning; names and maintainers are resolved from the workshop
catalog at render time. Raw repeats inherit the reviewed publication arm. New IDs remain unknown
until reviewed. Absence of the supplement/catalog degrades visibly to unknown, not native.

The 356 rendered rows comprise:

| Catalog identity | Rows | Evidence state |
| --- | ---: | --- |
| BetterScale | 30 | Enabled experiment arm |
| Prefix Router | 1 | Legacy implementation, explicit routing enable/config |
| SimLLM | 26 | Legacy PR #66/#70/#80 checkpoints; activation unverified |
| KV Tiering | 3 | 1 pre-merge baseline; 2 related head/latest experiments |
| Split-Batch / Full-Graph Parallel | 1 | Base-only experiment, not optimized arm |
| No MOD | 47 | Explicit published vLLM baselines, including 30 native TP2 repeats |
| Unknown | 248 | No reviewed per-run MOD evidence |

Important exclusions and provenance:

- The old core/Ascend histories moved to `intellistream/vllm-hust-legacy-20260831` and
  `intellistream/vllm-ascend-hust-legacy-20260831`. Old organization PR URLs may return 404;
  each current MOD repository's `PROVENANCE.md` points to the archived history.
- SimLLM backend commits `e0686f12`, `312ca80a`, `a05a9efe` match the merges of archived
  Ascend PRs #66, #70 and #80. The first two have 11 records each; #80 has 4. PR #70's
  “baseline validation” name does **not** mean a SimLLM-disabled baseline. PR #80's description
  says default-on, but that is not a per-run environment/activation receipt. Retained rerun logs
  and manifests do not establish activation. The current migration package is import-only and
  license-gated; these historical associations are not claims for that package.
- Archived core PR #49 is a split-KV offloading compatibility fix by `sad-and-bad1231`, not
  JieYang2001's KV Tiering implementation. Its six checkpoint records and the eight
  `current-main-cpu-offload-kv` records are not relabelled KV Tiering based on “offload”.
- KV Tiering PR #124 base `e0c0ce8e` precedes merge `89334ef1`. The head/latest records lack
  tiering/offload activation parameters; their specialty workload alone is not proof.
- The fullgraph record's Ascend commit `cd29480d` matches archived PR #125's **base**.
  A graph-enabled baseline is not Split-Batch activation and is not BetterScale.
- Prefix Router's recorded `enable_prefix_routing=true`, `longest-cached-prefix`, and two
  independent replicas establish the legacy routing treatment. Its catalog maintainers are
  Amber1qq, WMASTER123 and Adr1anZheng.
- Some native TP2 MTP2 runs use `betterscale.worker.Worker` for a required ABI bridge. The
  declared experimental arm, not a worker-class substring, determines MOD attribution.
- Catalog existence, authorship, source inclusion, runtime activation and measured benefit are
  separate claims. No Mooncake/BidKV/DiffSpec/etc. results are added from catalog descriptions;
  importing their separate measurements is outside this snapshot identity audit.

Source evidence links are preserved in the attribution supplement and shown in each run's expanded
provenance. The real-data model regression checks row/metric/task preservation, exact catalog
identity, counts, baseline distinctions and missing-evidence behavior.
