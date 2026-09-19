# BetterScale: graph / asynchronous execution step evidence

Measured September 19, 2026. These are engineering case-study results, not official leaderboard
entries or a new PyPI release qualification. Product source:
[`98f507167b5a4832481a2187e6dcb5b5e5afc85b`](https://github.com/vLLM-HUST/BetterScale/tree/98f507167b5a4832481a2187e6dcb5b5e5afc85b).

## What the figures measure

- **Step period:** device-stream execute-entry event to the next execute-entry event. The final step
  without a successor is not counted. Rate gain is `native period / candidate period - 1`, not
  latency reduction and not output tokens/s.
- **Forward envelope:** events around the runner's model forward, including submission/update waits.
  It is not pure kernel time. Between-forward intervals include useful preparation, sampling and,
  for DSV4, draft work; they are not pure idle or CPU overhead.
- Same-host ABBA per configuration, whole-shape warmup followed by two measured passes per model
  startup. Events are preallocated and resolved after HTTP drain, not synchronized every step. A
  separate short profile is processed with TraceLoom; profiled timings do not enter the curves.
- Select actual scheduled queries and computed-prefix windows on all ranks. Take the rank with the
  slower mean period per cohort, then equally average valid cohorts. Shaded ranges are observed
  cohort extrema, not confidence intervals. Cohorts in one startup are not independent model
  startups.
- APC and AIV are enabled in both arms. Cache is cleared before each cohort and prompt salts prevent
  sharing: this is a **cold-prefix shape sweep**, not the SWE cache-hit distribution. The existing
  APC-on SWE serving study remains separate and was not rerun.
- Complete service configurations are compared, not a single-switch ablation. Historical patch
  increments cannot be added or relabeled as these native-to-final results.

## Configurations

All measurements use Ascend 910B2, pinned vLLM `752a3a50` / vLLM-Ascend `9bf964cb`, CANN9.0.1,
Torch2.10 / torch-npu2.10.0.post2. Qwen uses a different host from DSV4; only each configuration's
same-host native/candidate pair is compared.

| Model / topology                            | KV per rank | Seats per engine | Token budget per engine | Maximum context | Draft               |
| ------------------------------------------- | ----------: | ---------------: | ----------------------: | --------------: | ------------------- |
| Qwen3.8-27B TP2                             |       6 GiB |                8 |                    2048 |            8192 | No MTP              |
| DeepSeek-V4-Flash-0731 W8A8 TP8 / DP1 / EP8 |      12 GiB |                4 |                    4128 |           16384 | K5, real acceptance |
| DeepSeek-V4-Flash-0731 W8A8 TP1 / DP8 / EP8 |       8 GiB |                2 |                    1026 |           16384 | K5, real acceptance |

Qwen native: effective FULL_AND_PIECEWISE, capture sizes1/2/4/8, TASK_QUEUE_ENABLE=1. Candidate:
FULL, sizes1/2/4/8/16/32/64/128/256/512/1024/1536/2048, dual banks, TASK_QUEUE_ENABLE=0. The
checkpoint name is Qwen3.8-27B; its architecture is qwen3_5_text. This source deployment requires
the qualified GDN/FIA native libraries; the existing DSV4 PyPI commands do not constitute a Qwen
installation recipe.

DSV4: TASK_QUEUE_ENABLE=1, block32, native asynchronous scheduling and acceptance. TP uses DSACP and
FlashComm1; DP uses DSA without FlashComm1. Native FULL_DECODE_ONLY sizes24 (TP) or6/12 (DP).
Candidate FULL sizes24/4128 (TP) or6/12/132/264/516/1026 (DP). The native TP arm includes only the
LCM startup compatibility repair. DP requests use native engine affinity. The same task-local
qualified donor copy is used by both DSV4 arms, without upgrading the host's previous install.

## Shape coverage and limitations

Qwen: B1/2/4/8 decode with initial1024/4096 context; cold prefill128/256/512/1024/2048; 1or4 decode
plus128/512/1024/1536 joining tokens. Actual dispatch splits2048 prompt into1536+512, so21request
configurations produce22actual points. Every arm/point has four valid cohorts. Decode selection
requires full batches and host computed lengths in `[initial+8, initial+40)`.

DSV4 TP: B1/2/4 decode with initial1024/4096; prefill128/512/1024/2048/4096; 1or3 decode plus
128/512/1024/2048 joining tokens. All19points have four valid cohorts per arm.

DSV4 DP: B1/2 per engine decode with initial1024/4096; prefill128/256/512/1024; one decode plus
128/256/512/1018 joining tokens per engine. Actual1024 prompt splits1018+6; the1018join splits
1012+6, producing14actual points. Six-query tails remain prompt continuation, not K5 decode. Decode
selection requires actual six-query requests on all eight ranks, consecutive global waves and host
computed lengths in `[initial+16, initial+112)`. Host progress can be an acceptance bound, not exact
device-accepted positions. Generated histories are not forced equal.

Some DP HTTP requests enter different global waves despite affinity. Those cohorts cannot represent
balanced eight-engine work. A bounded supplement used one additional startup per arm, one warmup and
six measured repeats of prefill128/256/512/1024 and mixed1D+128, with HTTP thread start barriers
only: no scheduler pause or execution change. All37staggered derived cohorts are retained as
exclusions in JSON, never relabeled as balanced work.

**Two DP points have limited repeats:** candidate1018-token first chunk and six-token continuation
of the1024prompt each have only two valid cohorts from the same startup. Hollow squares identify
these points. All other arm/points have at least four. Status is `COMPLETE_WITH_LIMITED_REPEATS`;
`insufficient_points` means below the original four-cohort target, not absent data. The additional
load did not reliably fix this arrival skew; stronger conclusions at these two points require a
separately qualified controlled-admission experiment, not more blind reloads.

The headline table uses only the fully repeated **decode** points. Small-prefill gains do not
establish whole-service speedups. TP and DP differ in global concurrency and are not equal-work
alternatives to one another. Keep observed startup variability in the figure, rather than choosing
the most favorable native repeat.

## Source data

- [Qwen step snapshot](../data/betterscale-qwen-steps.json), including all cohort summaries.
- [DSV4 step snapshot](../data/betterscale-dsv4-steps.json), including exclusions and limited
  repeats.
- [Qwen vector figure](../assets/betterscale/qwen-step-20260919.svg).
- [DSV4 vector figure](../assets/betterscale/dsv4-step-20260919.svg).
- [Existing Qwen SWE methods](BETTERSCALE-QWEN-SWE.md), independently measured service throughput.
- [Historical DSV4 studies](BETTERSCALE.md), separate incremental controls and service evidence.

The snapshots retain source capsule identities. The new figures use the complete final source
configuration; the older Qwen mechanism profile below the fold is an APC-off incremental diagnostic,
not the new APC-on native-to-final control. DSV4 short profiles may include bootstrap and EP dummy
work; the scale curves instead use independent unprofiled actual-query records.
