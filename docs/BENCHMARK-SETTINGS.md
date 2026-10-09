# Benchmark settings: website and measurement handoff

Entry: `leaderboard-runs.html#settings`, alongside **Leaderboards / Tasks**. The former `#frontier`
fragment remains a compatibility alias.

## Naming boundary

**Benchmark settings / 实验设定** is the public name for this view. A setting is an exact cohort: model
and revision, precision, hardware and topology, workload contract, context limit, runtime controls
and measurement window. Engineering measurement, measured setting and published comparison describe
evidence status separately.

The former word `Frontier` may remain in immutable schema values, historical artifact names, version
identifiers and compatibility URLs. Those strings preserve provenance; they must not be presented as
a current benchmark family, quality tier or reason to exclude a MOD.

Fletcher requested the page first on 2026-09-23. The initial production snapshot was empty. Fletcher
subsequently authorized the two measured Qwen3.5-35B-A3B AgentX smoke points on 2026-09-23; see
[their measurement notes](FRONTIER-QWEN35-AGENTX-SMOKE.md). Do not backfill this surface from the
legacy leaderboard or publish illustrative values. Smoke and formal windows require separate
workload identities; never silently mix them.

## UI contract

- Model + precision is one combined tag. The only other choice is a fixed workload/context cohort; a
  single available workload is displayed without inviting an unnecessary selection.
- An external right sidebar has checkbox rows for MOD and MTP (on/off; unknown when present). All
  options start checked; choices within a row union and the rows intersect. Unchecking a whole row
  hides all points. **Concurrent service scale** is another checkbox row: observed depths may
  overlay but retain independent measurement series. All start checked, including a single available
  depth. Choices survive language changes and reset on model/workload changes. Visible/total counts
  are scoped to selected scales. MOD / Group offers Select all / Deselect all without changing other
  rows. Mobile stacks the sidebar below the chart. A single workload is a selected-style static tag;
  multiple workloads use a selector.
- Per-point concurrency/session tags appear in the click popover, not as persistent chart labels.
  Keep the series legend and accessible point names; leave the plot for dots and measured-series
  lines.
- Axes are fixed: **X = P90 per-request decode speed (output tokens/s/user)**; **Y = total output
  tokens/s / all allocated chips** by default. A card-rent checkbox switches Y to output tok/s per
  CNY10,000 of monthly card rent for all-910B2 settings. Assume CNY4/card/hour, 24hours/day
  and30days/month: CNY2,880/card/month, hence Y = per-chip throughput ×10000/2880. The switch
  preserves X, raw measurements and point membership; this is a cost normalization, not API revenue.
  Non-910B2 or non-per-chip axes retain their original display. The displayed assumption is included
  in point downloads when enabled.
- Engine, MOD combinations, hardware count, parallelism, batching, graph mode, cache allocation and
  other deployment parameters may differ while satisfying the selected comparison contract.
- The sidebar’s **Best trade-off points only** checkbox is off by default, so every selected
  measurement remains visible. Turn it on to show only points for which no peer in the same group
  improves both chart metrics. Slower trade-offs and failed-correctness references are not invalid.
  MOD/MTP filters recompute membership; the preference survives language and cohort changes.
  Identical-configuration BetterScale repeats use the documented
  [whole-run best-of selection](FRONTIER-REPEAT-SELECTION.md), retaining inferior raw evidence.
- BetterScale uses the short **BetterScale** group/legend label; graph mode, execution/resident
  seats, balanced attention and state-cache policy appear in its popover. The main unified
  concurrency comparison retains only its declared C1–C16 sweeps. The October6 fixed-E36 and
  width-matched extensions through C56 belong exclusively in the final residency/cache study,
  following Fletcher's corrected publication placement; neither campaign appears in the first chart.
- **BetterScale residency and cache studies** references 21 immutable source points through
  `workload.contract.comparison_point_ids`, but displays only each MOD's Pareto frontier: 8
  BetterScale points and 5 Native points. Each frontier is connected in increasing P90 decode speed
  order. BetterScale spans workload-tuned configurations across the three campaigns; this envelope
  is not a fixed-capacity sweep. Dominated points and unrelated cache-ablation groups are hidden
  from this chart, not deleted from the snapshot. Filters recompute the frontier. Source points,
  archived repeats, metrics and provenance are unchanged; downloads include the source cohort plus
  `comparison_cohort`. The first chart remains unchanged. See
  [the width-matched boundary](FRONTIER-QWEN35-CONCURRENCY-WIDTH.md).
- Clicking or keyboard-activating a point opens a small floating card with hardware, parallelism,
  session concurrency, MTP, request limit, explicit KV budget, UTC sampling date and the two
  coordinate values. `evidence.sampling_date_utc` is a calendar-valid YYYY-MM-DD date, with
  `sampling_date_source` recording provenance. Existing dates use SWE client run starts or AgentX
  recorded run starts (including warmup), not publication dates or point-ID suffixes. Missing dates
  display “Not recorded”; never infer them in the browser. Escape, outside-click or the close button
  dismisses it. The card stays inside the chart on mobile too.
- **Download configuration** exports a JSON containing the complete point and cohort, including
  original metrics, protocol, configuration and evidence references. The page does not dump JSON,
  show a configuration table, or display lengthy evidence/methodology sections.
- A compact evidence-status badge distinguishes an engineering measurement from a measured setting.
  Full limitations stay in its download and linked report, not in a large page banner.
- A small **Concurrency curves** link opens the current cohort's static diagnostic SVG; it does not
  introduce additional selectors. `workload.contract.concurrency_curves_url` accepts only a local
  `./assets/*.svg` path with an optional version query. Invalid/absent links stay hidden.
- Missing axis values are not fabricated. Known MOD names still use the workshop catalog for
  legend/point labels, never as a filter or as proof of runtime activation.

## Data handoff

BetterScale connects one Pareto frontier per cohort × MOD/group × session-rotation depth, across
workload-tuned slot configurations. Vertices are whole measured records, ordered by P90 decode
speed; dominated observations remain visible but are not line vertices, coordinate ties share one
vertex, failed-correctness references are excluded, and singletons have no line. A source-only
comment at checkbox construction explains why E16/R20 and C32 (actually E36/R36) belong to one
family; no explanatory note is rendered beneath the checkbox. This is a best measured trade-off
boundary, not a claim of one fixed-slot sweep or an interpolated measurement. Filters recompute that
boundary.

Other groups retain one line for each declared `load.concurrency_series` within the selected cohort
and rotation depth, ordered by client concurrency. Their lines represent actual sweeps; filters can
shorten or remove them. All measurements remain inspectable by leaving **Best trade-off points
only** unchecked. The footer reports points that are not on any displayed line. Original series
metadata and static diagnostics preserve their fixed-configuration meaning.

Fletcher withdrew BetterScale AE separation from display on2026-09-25. Its four then-visible
AgentX/SWE observations now reside in `archived_points` with `display_withdrawal`; earlier archived
runs and all metric evidence remain intact. Do not restore these points or their filter/legend entry
from a historical import without explicit authorization. Ordinary co-located BetterScale TP/DP/EP
measurements remain visible.

The website reads `data/leaderboard_frontier.json` independently of the legacy run snapshot. Schema:
`leaderboard-frontier/v1`. Two arrays: `cohorts` and `points`.

### Cohort

| Field                             | Required meaning                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                              | Unique immutable comparison-contract ID                                                          |
| `model: {id, label, revision}`    | Exact model identity; ID includes revision when it changes                                       |
| `precision: {id, label}`          | Precision contract; record weight/compute/KV precision constraints, not just an ambiguous “FP16” |
| `workload: {id, label, contract}` | Versioned fixed request contract, with full details in `contract`                                |
| `context_tokens`                  | Positive integer: required supported context capacity                                            |

The measurement owner defines the workload. Record dataset/sample identity, rendered request lengths
or distribution, output/stop policy, tokenizer/template, cache/reset/warmup/reuse policy, arrival
mode, success/quality admission and aggregation method in the contract. A change in these
requirements needs a distinct workload ID. Concurrent load may be swept under the same workload only
when that contract explicitly allows it; each measured load level becomes its own point. The UI does
not choose datasets, perform admission tests, or impose an arbitrary SLO.

### Point

| Field                                                | Required meaning                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `cohort_id`, optional `label`                  | Stable point identity and one existing cohort                                                                                                  |
| `configuration.engine`, `engine_version`             | Actual host engine and exact version                                                                                                           |
| `configuration.mods`                                 | Array of workshop component IDs; combinations allowed                                                                                          |
| `configuration.hardware: {label, accelerator_count}` | Actual hardware and total accelerator allocation                                                                                               |
| `configuration.context_capacity_tokens`              | Effective deployment capacity, at least cohort requirement                                                                                     |
| `configuration.parameters`                           | Full JSON deployment parameters; include source/runtime versions, MOD revisions and activation, topology, draft model, cache/offload resources |
| `load`                                               | JSON measured load specification; `concurrency` is rendered in the table when recorded                                                         |
| `metrics`                                            | Object of finite nonnegative numbers or null, with the fields below                                                                            |
| `evidence: {status, url, run_ids, aggregation}`      | `status: "measured"`, HTTPS evidence link, original run IDs and declared repeat aggregation                                                    |
| Optional `cost: {usd_per_hour, source, scope}`       | Positive **full-deployment** USD/hour, pricing basis/date/source and complete accounting scope                                                 |

Recognized metrics: `decode_p90_tps` (P90 of per-request inverse TPOT), `output_tps`, `tpot_ms`
(request-mean TPOT), `ttft_p95_ms`, `tpot_p95_ms`, `e2e_p95_ms`. Unmeasured metrics are omitted or
null, never invented zeros. Output TPS counts measured output tokens over the stated measured
duration, not input+output or requests/s. Per-chip efficiency divides by **all** allocated
accelerators, including draft/prefill/decode resources when applicable. Cost includes the complete
deployment; do not charge only active chips while excluding CPU, external KV services or mandatory
network resources. Omit cost when unknown.

Historical model utility (not exposed by the fixed chart):

`USD / million output tokens = usd_per_hour * 1e6 / (3600 * output_tps)`.

This is a cost-model projection at the measured operating point, not an actual billed API price.
Rent/ownership assumptions and utilization belong in `cost.source` / `cost.scope`. No hardware price
table is embedded in the website. Provider-side acceptance of successful runs, model quality and
repeat summaries remains the benchmark producer's responsibility. Do not pool/average run
percentiles and describe them as a pooled request percentile.

The exact machine consumer is `assets/leaderboard-frontier-model.js::validate`. For formatting only,
`tests/fixtures/leaderboard_frontier.json` is explicitly synthetic test data, **not measurement
input**. Publication replaces the production JSON after measurement review; no JS edits are needed
to add a cohort or measured point.

## SWE concurrent service scale

The visible control is **并发服务规模 / Concurrent service scale**, with choices such as **1倍会话 / 1×
sessions** and **2倍会话 / 2× sessions**. A C8/D2 point displays **8路并发，16个活跃会话 / 8 concurrent
requests, 16 active sessions**. Active sessions are C×D histories served by C request lanes, not C×D
simultaneous requests.

`load.session_rotation_depth` is a positive integer for every point in a cohort whose
`workload.contract.session_rotation` is present. Checkboxes select any combination of observed
scales, initially all selected; an empty selection shows no points. Missing depth fails validation
rather than silently becoming1. MOD / Group has a **Select all / Deselect all** toggle: partial or
empty selection becomes all, and all becomes empty. It does not change MTP or scale selections.
Selections survive language changes and reset on model/workload changes. Downloads retain exact
original point metadata.

On 2026-09-27 Fletcher confirmed that all existing SWE 15-minute results used depth **1**. Both
visible and archived SWE points are annotated; original metrics, run IDs and raw evidence artifacts
remain unchanged. The compact “Session rotation depth testing is under construction” notice records
pending deeper-session testing at that time, not measured D>1 performance. Measured depths become
choices only when explicitly recorded; do not add placeholder points or infer results from this
notice.

At C lanes and D slots per lane, only C requests can be in flight, while C\*D histories may be
revisited. Different rotation depths may share one chart but never dominate each other: frontiers
are independent per cohort × MOD/group × depth. Depth1 uses solid lines and filled points; depth2
uses dashed lines and hollow points. Legends name the session scale. Historical static concurrency
SVGs describe depth1, so their link is visible only when depth1 alone is selected. Remove the
construction status only when the measurement owner supplies the corresponding evidence.

## Implementation and checks

- `assets/leaderboard-frontier-model.js`: data checks, axes and strict Pareto projection.
- `assets/leaderboard-frontier.js`: independent controls, accessible SVG/popover, EN/ZH and failure
  UI.
- `assets/leaderboard-frontier.css`: scoped responsive presentation.
- Existing run controller owns the three-way view switch; it does not supply Frontier points.

```bash
node --test tests/leaderboard_runs_model.test.cjs tests/leaderboard_frontier_model.test.cjs
python -m http.server 8774 --bind 127.0.0.1
python scripts/verify_leaderboard_frontier_browser.py
python scripts/verify_leaderboard_runs_browser.py
```

For depth-selector-only edits,
`python scripts/verify_leaderboard_depth_browser.py --url http://127.0.0.1:8774` checks every active
model/depth and four responsive language/theme combinations, with representative exact downloads.
The full browser suite additionally exports every historical point and can take about20 minutes;
reserve that traversal for evidence/export changes.

The Frontier browser check covers production values, fixed axes, combined model/precision tags,
workload isolation, point popovers, downloaded configuration equality, keyboard/outside-click
dismissal, stale-cache isolation, EN/ZH, mobile/desktop, dark/light and empty/error states. No NPU
access is involved.

## Design reference, not code dependency

The requested [InferenceX Kimi K3 view](https://inferencex.semianalysis.com/inference/kimi-k3)
separates benchmark requirements from chart axes and hardware configuration. Its
[dashboard README](https://github.com/SemiAnalysisAI/InferenceX-app) describes sweeps over tensor
parallelism and concurrency. We borrow that comparison structure, not its GPL dashboard code or
Next.js/database deployment. This site remains a static snapshot consumer with native SVG.

## Workload source

The [AgentX workload repository](https://github.com/vLLM-HUST/agentx-bench) pins the official replay
harness and corpus and records the smoke protocol. Current comparison runs use 15-minute measured
windows after full warmup; this is an evolving smoke protocol, not one-hour formal certification.
The Frontier footer links the workload repository directly.

## Unified throughput comparison (2026-09-24)

The Qwen35 view now includes the [C64 expert matrix](FRONTIER-QWEN35-EXPERT-SMOKE.md) with
historical TP2 points. HF/ModelScope are accepted as the same model by Fletcher. Exact checkpoint,
MTP and warmup remain per-point settings; `evidence.benchmark_protocol` overrides historical
cohort-wide assumptions. This is a throughput configuration comparison, not an identical-protocol
causal experiment. The withdrawn eight-chip C16 points remain excluded.

## Experiment groups

Optional `configuration.experiment_group` separates tracking groups in the existing MOD / Group
filter, legend and point popover without changing canonical `configuration.mods` attribution.
`betterscale-AEseparation` labels actual separately allocated attention/expert serving experiments
(including historical AgentX and current SWE points), not ordinary co-located TP/EP topology. Future
revisions may share this group; each point retains its own source/configuration and metrics. A group
alone never joins points into a concurrency line: `load.concurrency_series` still requires fixed
serving settings. Retain all valid observations, including dominated results; interrupted windows
without valid summaries are not benchmark scores.

## Best-point retention for the A+E batching comparison

The September24 layer-separated real-MTP2/C64 A4E4 and A6E2 series retain one point per topology:
the highest measured output tokens/s/chip across the historical control and new cap1/cap7 runs. This
explicit curation does not collapse different MTP states, concurrency levels, capacity settings or
unrelated campaigns. A selected point's `frontier_selection` names the compared IDs; superseded
complete points live in the snapshot's optional `archived_points` with a link to the selected ID.
Metric evidence retains every run. The renderer consumes only `points`; the legacy Runs table is not
repurposed as a synthetic archive. Selection is an observed-throughput ranking, not a statistical or
universal-optimum claim.

## Failed-correctness references

Explicit `functional_status: failed` points remain visible as red throughput references, with
textual warnings in the legend, accessible point label and popup. They neither form nor dominate the
Pareto envelope. The27B native check failed5/16 retrievals at C16; all five native points share that
deployment, but this is not evidence of separately observed failures at every C. The independent
browser check exercises all ten27B points, EN/ZH, dark/light, mobile/desktop, exact downloads and
native-only filtering.

## MOD source pointers

Each active BetterScale point now records `configuration.mod_sources`: canonical MOD ID, repository,
full immutable revision, optional additional revisions, deployed source capsule and scope. The popup
links the short commit IDs instead of saying only “BetterScale experimental”; the download retains
the full pins and local-adaptation caveat. Engine, model and benchmark revisions are not MOD pins.
These prototype pointers identify staging/adaptation code, not a claim that the deployed capsule is
an unmodified released wheel. Dense27 retains its recorded envelope specialization on top of the
shared small-fish revision.

Historical full5 uses3e99033; capacity16 retains both b0b8bb2 staging and37428c7 qualification; the
parallel matrix usesce2ac3f; small-fish usesf7598b9. These derive from recorded capsule/runtime
provenance, not the current repository HEAD. Missing future pointers must remain “Not recorded”.

## Fresh Qwen3.5 MOD controls in the Kubernetes container

The [2026-09-25 campaign report](FRONTIER-QWEN35-MODS-K8S.md) records new Native / BidKV TP2
controls, common runtime overlays, and model/workload identity checks. Points whose enabled policy
receives no calls are explicitly marked **MOD policy not exercised**; they are observations, not
demonstrated optimization gains.

The September27 Qwen35 native Rotation2 import supplies five complete observations at C2/4/8/16,
including both C16 repeats. Its construction notice is removed; Qwen27 remains under construction.
Checkboxes offer measured depths1 and2, together or separately. Select only2 for Rotation2 and
disable frontier-only display to inspect every observation of that workload.

On September27 the owner retired AgentX from the active leaderboard. Its cohort carries
`display_withdrawal`; the renderer excludes that cohort and its points from choices, counts and
charts. Historical point IDs, metrics and evidence remain unchanged in the snapshot. This does not
change legacy Runs submissions or relabel AgentX as SWE.
