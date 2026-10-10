# Qwen3.8-27B: current-State TP4 sweep

Ten complete900-second SWE Prefix Reuse observations on four Ascend910B2 cards. All use the current
State scheduler, streaming incremental backup, backed-history partial eviction, capacity-ready
priority recovery and Balanced FlashDecode. Every point passes16 exact-marker retrievals before
and16 after the window, zero HTTP failures, monitored device ownership, server exit0 and all-card
idle release.

## Measurements

| Concurrency | Execution / resident seats | Output tok/s/card | P90 decode tok/s/user | TTFT P95 (s) | Completed |
| ----------- | -------------------------- | ----------------: | --------------------: | -----------: | --------: |
| C1          | 16 / 20                    |             24.58 |                124.24 |        0.434 |       158 |
| C2          | 16 / 20                    |             51.62 |                119.75 |        0.570 |       290 |
| C4          | 16 / 20                    |             88.28 |                105.15 |        0.642 |       493 |
| C8          | 16 / 20                    |            137.78 |                 83.05 |        0.659 |       773 |
| C12         | 16 / 20                    |            171.09 |                 68.83 |        0.697 |       991 |
| C16         | 16 / 20                    |            197.53 |                 59.98 |        0.779 |      1137 |
| C24         | 24 / 28                    |            240.28 |                 48.30 |        0.933 |      1388 |
| C32         | 32 / 36                    |            264.33 |                 40.09 |        1.054 |      1543 |
| C40         | 40 / 44                    |            270.05 |                 32.31 |        1.157 |      1610 |
| C48         | 48 / 52                    |            285.94 |                 29.06 |        1.305 |      1752 |

C48 supplies1143.76 streamed outputtok/s across four cards. Compared with the best observed TP2 C16,
its per-card output is14.8% higher, while TTFT P95 is 1.305 versus1.313 seconds. These are
independently tuned whole deployments, not an isolated-feature A/B, a cloud SLO or a proof that
every workload scales this way. C32→C48 adds8.2% output while client concurrency rises50%; scaling
is already sublinear. This sweep stops at the requested C48, not a demonstrated hardware ceiling.

All ten TP4 points are nondominated within this measured BetterScale cohort. The earlier six
current-State TP2 points join the already dominated historical and wide-TP2 observations in
`archived_points`, with original identities and strict dominance witnesses preserved. Native
observations are untouched. The frontier connects whole measured configurations, not one fixed-seat
sweep.

## Protocol and configuration

Same eight SWE source sessions, real generated-token continuation, D1 rotation, 900-second
streamed-output window and allocated-card denominator as the
[current TP2 protocol](FRONTIER-DENSE27-CURRENT.md). The same prepared-workload metadata-equivalence
proof applies. Each fresh service passes retrieval, runs a separate60-second C2 warmup, then starts
freshly salted measured sessions. Drained output is excluded from the chart numerator. P90 user
decode is the request statistic, not inverse P90 TPOT. General model quality is not evaluated.

BF16/MTP2/FULL4096,262144-token configured context and autoHBM0.95 remain fixed. E=max(16,C), R=E+4.
Host cache is4GiB logical payload per rank,16GiB across TP4; TP2 used8GiB per rank, also16GiB total.
Device capacity is independently profiled, not constrained to the same aggregate HBM allocation.
Four cards run one TP4 service at a time; these points do not overlap another NPU workload.

## Actual scheduler behavior

| Concurrency | Peak sampled KV | Pure prefill steps | Mixed steps | Decode steps |
| ----------- | --------------: | -----------------: | ----------: | -----------: |
| C1          |          10.12% |                160 |           0 |        32282 |
| C2          |          17.32% |                  4 |         289 |        33722 |
| C4          |          25.80% |                  1 |         492 |        28650 |
| C8          |          30.41% |                  1 |         766 |        21972 |
| C12         |          29.38% |                  1 |         973 |        17701 |
| C16         |          37.55% |                  1 |        1094 |        15271 |
| C24         |          53.56% |                  1 |        1298 |        11763 |
| C32         |          62.60% |                  1 |        1422 |         9413 |
| C40         |          76.37% |                  1 |        1462 |         7356 |
| C48         |          87.32% |                  1 |        1565 |         6262 |

Every timed TP4 window records zero active partial recoveries and zero whole-request preemptions.
C48 peaks at87.32% sampled KV usage. The enabled partial policy is qualified separately under forced
pressure; these TP4 scores are not measurements of its speedup. Host backup/load activity and
complete per-rank traces are retained in each receipt. Counts above are rank0 host dispatches, not
device execution-time shares or a direct prefill/decode rank-sizing formula.

## Source, correctness and host-allocation recovery

Source base is BetterScale `a54e9f6`, with the extension subsequently committed as `af7cd8a` on
`codex/active-partial-reclaim`. Measured frozen capsules, not the later commit's prose/formatting,
identify each execution: source-v2 for C1/2/4/8, source-v4 for C12/16/24/32/40/48. Runtime pins
remain vLLM752a3a5, Ascend9bf964c, CANN9.0.1 and torch-npu2.10post2. No PyPI or CANN9.1 release
qualification is implied.

TP4 rank-local GDN QK4/V12, FA Q6/KV1 and MC2 shapes are explicitly admitted; there is no alternate
model loop. Independent mixed/decode and balanced-attention leaves pass, including E48 and C40/C48
skew. Four-rank MC2 matches native GEMM plus allreduce in eager/capture checks. Forced E4/R6/22-page
partial recovery restores two history pages: all four ranks check34 KV tensors
and53,477,376bytes/rank exactly; warm continuation hits8448 cached tokens versus cold0 and returns
the same marker. The gate also passes with source-v4.

Excluded attempts: Host8GiB/rank C1 completes its window but fails postcheck; Host4GiB/rank C12
fails during the window. Both fail pinned-host allocation with 207001. Logical Host eviction does
not release torch-npu's retained, rounded allocator slabs. At failed C12, allocator-owned pinned
memory reaches8.61GB/rank; cgroup OOM/max counters stay zero. This does not identify an exact driver
quota.

Source-v4 retries a failed NPU pinned allocation once after releasing unused allocator slabs. Live
snapshots and pending-copy ownership remain intact; there is no pageable fallback. Persistent
failure remains fatal. Successful C12 and C16 each observe one trim; C24 observes two, across ranks
over the full lifecycle. C12's trim frees2.835GiB. All ten scored runs pass final checks. Installed
`active_bytes` statistics are inconsistent and are not used to infer occupancy; `allocated_bytes`
records rounded allocator-owned memory.

## Serving Plan and reproducible evidence

The TP4 flagship selects C48, the highest streamed-output observation of these ten settings. Its
matched completed-request ledger uses the same1752 requests for new input, cached input and output,
with the full900seconds and all four cards in the denominator. The ledger, rather than streamed
partial output, drives API-equivalent value. At Fletcher’s October10 request, only TP4 C48 remains
in the Qwen27 Serving Plan selection; TP2 measurements and accounting evidence remain preserved.
Prices and user-supplied costs are unchanged; values are not revenue, profit or guarantees of cloud
cache-hit/quality equivalence.

Compact per-run qualification, accounting and usage-only projections are under
`docs/evidence/dense27-tp4-20261009/c{1,2,4,8,12,16,24,32,40,48}`. Full request, scheduler,
host-allocation, server and release evidence is retained outside Git in transfer-verified
`tp4-c*-evidence.tar.gz` archives. Public projections omit request text and token arrays.

The original four-rank qualification is `tp4-qualification.tar.gz`. E48 leaves, v4 source, host
library, second forced-pressure gate, host-allocation observations and excluded attempts are
preserved in `tp4-extension-final.tar.gz`, SHA256
`f8aaed50d0e768990c36ef962334f8d458eb3a70d414c6760cc4204c2f927a87`.
