# Serving Plan

`serving-plan.html` is a browser-local capacity and API-equivalent-value calculator, linked under
Evidence / 成果. Keep the shared `site.css`, `subpages.css`, `site.js`, navigation, cosmic background,
hero and footer; calculator styles are scoped under `.serving-plan`. The page represents multiple
engines and models, not a BetterScale-only product page.

Checkboxes select independent measured plans. Each gets its own stacked column, configuration,
latency facts and accounting scope through a small source link beneath its checkbox label. Do not
duplicate detailed metrics in separate cards or an evidence section. The main result is the chart,
without repeated per-plan summary cards: deep blue output, cyan new input, blue cached input; costs
remain visually distinct. Customized prices are flagged beside the chart. Values across models are
**not** optimization multipliers or quality-equivalence claims. Empty selection means no plans.
Export includes exactly the selected plans, their source identities, effective model-specific
prices, costs and calculations. User costs are neither assumed, persisted nor transmitted.

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
qualification receipt, not the deleted historical local checkpoint. The current State C16
observation `1bd9268ee77845f08b16f1c78513b6d1` replaces the earlier96cd03a reconstruction as the
displayed flagship. It completes 730 requests in900seconds with zero failures: per-card rates are
327.9461 new input, 8641.2517 cached input and 232.3072 output tok/s. Streamed-window output is
separately 249.0617 tok/s/card. Current State, streaming incremental backup, partial-priority
recovery and Q12/KV2 Balanced FlashDecode are enabled; independent operator and forced
partial-recovery gates pass, as do16 concurrent retrievals before and after each window. The timed
C16 run observes52 cache loads but no active partial eviction. This is bounded functionality, not a
general quality evaluation. See [current Dense27 methods](FRONTIER-DENSE27-CURRENT.md). Historical
reconstruction evidence remains archived, not relabeled.

All four currently displayed plans have complete, same-cohort input/output accounting. They are
selected deployment observations at different concurrency points, not a controlled same-concurrency
optimization A/B or proof of an optimal deployment for every workload.

The additional four-card Qwen27 flagship selects TP4 C48 from ten complete observations. Run
`b6f90bf6a4ec413b85db3df1000d1376` supplies matched-cohort per-card rates of 424.0411 new input,
9162.9953 cached input and 274.9417 outputtok/s; streamed-window output is285.9408tok/s/card. The
TP2 plan remains available as a two-card deployment. TP4 uses4GiB Host cache/rank and a qualified
pinned-allocation recovery path; no active partial eviction occurs in its measured windows. See
[TP4 methods and qualifications](FRONTIER-DENSE27-TP4.md).

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

When verifying a deployment, fetch the exact CSS/module URLs referenced by the delivered HTML. A
separate verification query can miss stale CDN entries at the actual asset URL. Change the asset
version when styling changes; do not request the new production asset URL until deployment finishes,
otherwise an old response can populate that new cache key.
