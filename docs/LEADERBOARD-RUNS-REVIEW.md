# Run-oriented leaderboard review

Review entry: <https://vllm-hust.sage.org.ai/leaderboard-runs.html>.

This is an additive, independent entry for tutor review. The existing leaderboard, its scripts,
navigation, publication schema and snapshots are unchanged.

## Reading the page

- Use the **Measurements / Task definitions** buttons to switch views; only one table is visible.
  Clicking a task tag switches to its definition and highlights the row. Returning preserves the
  result filters, sorting and page.
- Click a measurement column title to toggle ascending/descending sorting; its separate small arrow
  opens a dropdown with searchable checkboxes. Selections combine OR within a column and AND across
  columns, over all pages. Apply commits checkbox changes; Cancel / Escape discard them. Clear
  filter restores one column; Reset restores grouped order. Missing numbers remain last in either
  sort direction. Options cover the current top-level scope, not just the other column filters.
  Changing that top-level scope clears column selections; Reset clears selections and sorting
  together.
- The flat table is organized by **(model, parallel configuration), task tag, MOD**.
- Hardware is selected once above the table; different hardware is never silently combined. The new
  TP2 campaign uses 910B2; older publications also contain 910B3.
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

`data/leaderboard_run_observations.json` supplements the existing 16 TP2 publication aggregates with
32 sealed original observations. It joins by publication entry ID; current publication wins over
historical duplicates. Raw evidence is pinned to benchmark commit
`0793bfa9d0bad7ad4752d908889a9863480bed09`.

Rebuild the supplement with a checkout of that benchmark revision:

```bash
python scripts/build_leaderboard_run_observations.py \
  --benchmark-repo /path/to/vllm-hust-benchmark \
  --revision 0793bfa9d0bad7ad4752d908889a9863480bed09 \
  --pattern 'betterscale-qwen27-tp2-20260922-*' \
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
definitions / 32 run rows, filtering, pagination, keyboard expansion, exclusive table views, header
multi-selection, numeric ordering, tag navigation, missing evidence, and desktop/mobile EN/ZH in
both OS color schemes. The dedicated review workflow retains screenshots.

Tutor review should focus on whether the flat hierarchy is clear, whether task tags make comparisons
sufficiently explicit, and whether the configuration prefix and expanded evidence provide enough
auditability before this replaces the old entry.
