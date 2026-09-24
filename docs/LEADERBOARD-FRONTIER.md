# Frontier: website and measurement handoff

Entry: `leaderboard-runs.html#frontier`, alongside **Leaderboards / Tasks**.

Fletcher requested the page first on 2026-09-23. The initial production snapshot was empty. Fletcher
subsequently authorized the two measured Qwen3.5-35B-A3B AgentX smoke points on 2026-09-23; see
[their measurement notes](FRONTIER-QWEN35-AGENTX-SMOKE.md). Do not backfill this surface from the
legacy leaderboard or publish illustrative values. Smoke and formal windows require separate
workload identities; never silently mix them.

## UI contract

- Model + precision is one combined tag. The only other choice is a fixed workload/context cohort; a
  single available workload is displayed without inviting an unnecessary selection.
- An external right sidebar has checkbox rows for MOD and MTP (on/off; unknown
  when present). All options start checked; no separate “all” choice. Options
  within a row are OR, rows intersect, and unchecking a whole row hides all points.
  It recomputes the observed envelope without changing measurements; mobile stacks
  the sidebar below the chart.
  A single workload is a selected-style static tag; multiple workloads use a selector.
- Axes are fixed: **X = P90 per-request decode speed (output tokens/s/user)**; **Y = total output
  tokens/s / all allocated chips**. No axis, hardware or MOD filters.
- Engine, MOD combinations, hardware count, parallelism, batching, graph mode, cache allocation and
  other deployment parameters may differ while satisfying the selected comparison contract.
- All points with both coordinates are shown, including dominated observations. The observed Pareto
  envelope is a visual guide, not a globally optimal or statistically certified curve.
- Clicking or keyboard-activating a point opens a small floating card with hardware, parallelism,
  session concurrency, MTP, request limit, explicit KV budget and the two coordinate values. Escape,
  outside-click or the close button dismisses it. The card stays inside the chart on mobile too.
- **Download configuration** exports a JSON containing the complete point and cohort, including
  original metrics, protocol, configuration and evidence references. The page does not dump JSON,
  show a configuration table, or display lengthy evidence/methodology sections.
- A compact **15 min smoke** badge identifies the current short-run cohort. Full limitations stay in
  its download and linked report, not in a large page banner.
- A small **Concurrency curves** link opens the current cohort's static diagnostic SVG; it does not
  introduce additional selectors. `workload.contract.concurrency_curves_url` accepts only a local
  `./assets/*.svg` path with an optional version query. Invalid/absent links stay hidden.
- Missing axis values are not fabricated. Known MOD names still use the workshop catalog for
  legend/point labels, never as a filter or as proof of runtime activation.

## Data handoff

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

The [AgentX workload repository](https://github.com/vLLM-HUST/agentx-bench)
pins the official replay harness and corpus and records the smoke protocol.
Current comparison runs use 15-minute measured windows after full warmup; this
is an evolving smoke protocol, not one-hour formal certification. The Frontier
footer links the workload repository directly.


## Unified throughput comparison (2026-09-24)

The Qwen35 view now includes the [C64 expert matrix](FRONTIER-QWEN35-EXPERT-SMOKE.md)
with historical TP2 points. HF/ModelScope are accepted as the same model by
Fletcher. Exact checkpoint, MTP and warmup remain per-point settings;
`evidence.benchmark_protocol` overrides historical cohort-wide assumptions.
This is a throughput configuration comparison, not an identical-protocol causal
experiment. The withdrawn eight-chip C16 points remain excluded.
