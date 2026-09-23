# Frontier: website and measurement handoff

Entry: `leaderboard-runs.html#frontier`, alongside **Leaderboards / Tasks**.

Fletcher requested the page first on 2026-09-23. The initial production snapshot was empty. Fletcher
subsequently authorized the two measured Qwen3.5-35B-A3B AgentX smoke points on 2026-09-23; see
[their measurement notes](FRONTIER-QWEN35-AGENTX-SMOKE.md). Do not backfill this surface from the
legacy leaderboard or publish illustrative values. Smoke and formal windows require separate
workload identities; never silently mix them.

## UI contract

- Select a single model, precision, fixed workload and required context cohort. IDs are versioned
  identities, not cosmetic labels. Different requirements never silently share a frontier.
- Engine, MOD combinations, hardware count, parallelism, batching, graph mode, cache allocation and
  other deployment parameters may differ, provided the selected requirements remain satisfied.
  Context capacity may exceed the required context; a smaller allocation is rejected.
- Default X: P90 per-request decode speed (`decode_p90_tps`, output tokens/s/user). It is not the
  inverse of P90 TPOT. Alternatives: interactivity (`1000 / mean TPOT_ms`, excludes prefill), P95
  TTFT, P95 TPOT or P95 E2E.
- Y: output tokens/s/chip, total output tokens/s, or USD / million output tokens.
- Hardware and MOD-combination filters recompute the frontier **within the selected scope**.
- A point is Pareto-dominated when another is no worse on both selected axes and strictly better on
  at least one. Equal points are retained. This is an observed frontier, not proof of global
  optimality or statistical significance. Lines are guides, not interpolated measurements.
- Missing metrics are excluded from that projection and counted. Missing prices never become zero.
  Complete configuration and evidence remain inspectable through chart or table selection.
- Names of known MOD IDs come from the same `data/ecosystem.json` as the workshop. An empty MOD list
  means an explicitly measured no-MOD treatment, not missing attribution. Do not publish unknown
  activation as no MOD.

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

Cost projection:

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
- `assets/leaderboard-frontier.js`: independent controls, accessible SVG, table, EN/ZH and failure
  UI.
- `assets/leaderboard-frontier.css`: scoped responsive presentation.
- Existing run controller owns the three-way view switch; it does not supply Frontier points.

```bash
node --test tests/leaderboard_runs_model.test.cjs tests/leaderboard_frontier_model.test.cjs
python -m http.server 8774 --bind 127.0.0.1
python scripts/verify_leaderboard_frontier_browser.py
python scripts/verify_leaderboard_runs_browser.py
```

The Frontier browser check covers empty production state, test-only scatter/selection, both axis
orientations, missing cost/metrics, toggles, tab/state isolation, EN/ZH, mobile/desktop, dark/light,
and invalid-data failure. No NPU access is involved.

## Design reference, not code dependency

The requested [InferenceX Kimi K3 view](https://inferencex.semianalysis.com/inference/kimi-k3)
separates benchmark requirements from chart axes and hardware configuration. Its
[dashboard README](https://github.com/SemiAnalysisAI/InferenceX-app) describes sweeps over tensor
parallelism and concurrency. We borrow that comparison structure, not its GPL dashboard code or
Next.js/database deployment. This site remains a static snapshot consumer with native SVG.
