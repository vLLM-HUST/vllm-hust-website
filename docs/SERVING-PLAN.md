# Serving Plan

`serving-plan.html` is a browser-local capacity and API-equivalent-value calculator, linked under
Evidence / 成果. Keep the shared `site.css`, `subpages.css`, `site.js`, navigation, cosmic background,
hero and footer; calculator styles are scoped under `.serving-plan`. The page represents multiple
engines and models, not a BetterScale-only product page.

Checkboxes select independent measured plans. Each gets its own stacked column, configuration,
latency facts and accounting scope. Values across models are **not** optimization multipliers or
quality-equivalence claims. Empty selection means no plans. Export includes exactly the selected
plans, their source identities, effective model-specific prices, costs and calculations. User costs
are neither assumed, persisted nor transmitted.

## Token accounting

Count three disjoint components: new input, cached input and output. Never infer prompt volume from
median length × request count, or infer token counts from an aggregate cache-hit percentage.
`scripts/serving_plan_accounting.py` reads actual HTTP usage and rejects missing/inconsistent
counters. Its matched cohort consists of successful requests completed within the observation
window. All three components use that same cohort and the full window duration and allocated chip
count. Drained requests and their partially streamed output are excluded from this business ledger.

This differs deliberately from the leaderboard's streamed-output-window throughput. Preserve that
original metric and run identity; do not silently replace the leaderboard measurement. Missing
inputs remain null, not zero measurements. An output-only plan is an incomplete valuation, not a
fair total-value comparison with a fully accounted plan; fill its inputs before drawing conclusions.

Qwen35 C44's October6 run `5fc2d7346b1042dca87f55bb55df327b` retains 2,007 completed requests
in900s: 43,898,113 prompt tokens =42,233,381 cached +1,664,732 new; 1,152,403 output. The
matched-cohort per-card output is640.2239tok/s versus675.4006 in the original streamed-output-window
metric. `data/serving-plans.json` retains both, plus the raw request-file identity. This is the
selected highest-throughput observation in its eight-run width campaign, not a global optimum, SLO
goodput, or measurement of later partial eviction.

The Native plan is a fresh October 9 deployment, not the September run with new input numbers
attached. Run `9904a21a7b6b4e8f8c71734e4c97f477` completed 652 requests within 900 seconds, with
13,544,151 prompt tokens = 10,977,280 cached + 2,566,871 new; 376,590 output tokens. All 16
concurrent exact-marker checks passed; the measured workload had zero failures. Its donor kernels,
graph mode and scheduler remain Native; the reconstructed environment needs the SD/V1 Mamba ABI
bridge and a private accepted-count CPU mailbox for asynchronous correctness. This is not an
unmodified stock installation. Per-card output is 209.2167 tok/s on the matched cohort, versus
215.2961 under the streamed-output-window convention.

Each complete plan links a compact `accounting.json`, a gzip per-request usage projection and a
functional/measurement receipt where available. The projection omits generated text and token
arrays, but reproduces every displayed token rate. Full raw records are retained outside the
repository in the local campaign archive. Original historical inputs were deleted; never invent
those inputs or relabel a reconstruction as an exact historical reproduction. Qwen27 uses the newly
downloaded official Qwen/Qwen3.8-27B checkpoint, identified by the per-file manifest in its
qualification receipt, not the deleted historical local checkpoint. Run
`1a775a4fdc2748f0bac20914479da804` completed 437 requests within 900 seconds, zero failures; its
per-card rates are 366.9661 new input, 5,616.64 cached input and 142.8467 output tok/s. The
streamed-output-window rate is separately 149.045 tok/s/card. Independent GDN/FIA numerical gates
and 16 concurrent exact-marker checks passed. The 96cd03a-based dense geometry reconstruction
preserves FULL/MTP2/4096-query/256K context and uses the existing early mixed capture policy;
LiveState is not qualified. This is bounded functionality, not a general quality evaluation.

All three currently displayed plans have complete, same-cohort input/output accounting. They are
selected deployment observations at different concurrency points, not a controlled same-concurrency
optimization A/B or proof of an optimal deployment for every workload.

## Model-specific API prices

References were checked against the official Alibaba Model Studio pages on October9,2026, Beijing:

- [Qwen3.5-35B-A3B](https://help.aliyun.com/zh/model-studio/qwen3-5-35b-a3b): input≤128K, CNY0.4/M
  input, CNY3.2/M output. This service does not support context caching discounts, so both
  hardware-cached and new input use the same0.4 rate. Higher-length tiers need separate accounting.
- [Qwen3.8-27B](https://help.aliyun.com/zh/model-studio/qwen3-8-27b): CNY3/M new input, CNY0.6/M
  implicit-cache-hit input, CNY12/M output. Do not confuse these with explicit-cache creation/hit
  fees. Mapping hardware hits to an API's billable hits is an explicit scenario assumption, not
  evidence the cloud would deliver the same hit rate.

Prices exclude promotions and contracts. Editable prices are labeled user assumptions. No cloud
latency, sustained quota, effect-equivalence or contractual SLA is claimed. API-equivalent value is
neither revenue nor profit.

## Calculation and checks

For each component: tokens/s/card ×3600×period_hours×utilization×CNY/M /1e6. Utilization means
equivalent full-load hours, not prediction of low-load efficiency. Cost is fixed monthly cost
×period_hours/(24×month_days), **not** utilization-scaled. Measured per-card throughput already
includes every allocated chip; TP2 remains a two-card deployment unit.

Run `node --test tests/serving_plan.test.mjs`, the Python accounting tests, and applicable site
checks. Browser QA covers checkbox selection/empty/reset, per-model pricing, fixed costs, hour/day/
month conversion, zero utilization, invalid values, export and desktop/mobile overflow. Keep preview
servers, downloaded models, logs and screenshots outside this repository.
