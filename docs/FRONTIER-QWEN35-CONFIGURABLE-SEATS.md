# BetterScale configurable seats and incremental cache — SWE smoke

Qwen3.5-35B-A3B BF16, TP2/MTP2, native asynchronous scheduling, FULL graphs and balanced attention.
C16 uses 16 execution / 20 resident seats; C32 uses 36 execution / 36 resident seats. Both cache
modes have automatic offloading enabled, an 8 GiB host pool per rank and a 70% backup watermark.
“Full” means full checkpoint transfers, not offloading disabled.

Each point is one 900-second cold-start SWE Prefix Reuse observation; in-flight drain is excluded
from throughput. Each pair uses the same source, settings and physical device pair, changing only
incremental transfer mode. C16 D1 ran locally; C16 D2 and C32 D1 ran concurrently on a remote shared
host. These are smoke observations, not repeatability estimates or SWE answer-quality scores.

| Client load | Execution / resident seats | Full tokens/s/chip | Incremental tokens/s/chip | Change | Full → incremental TTFT P95 (s) |
| ----------- | -------------------------- | -----------------: | ------------------------: | -----: | ------------------------------: |
| C16 D1      | 16 / 20                    |             442.64 |                    437.57 | −1.14% |                   0.571 → 0.520 |
| C16 D2      | 16 / 20                    |             313.13 |                    315.33 | +0.70% |                   3.158 → 3.319 |
| C32 D1      | 36 / 36                    |             613.88 |                    613.53 | −0.06% |                   0.729 → 0.713 |

All six official windows are valid with zero failed requests. C16 D1 passes the predeclared
no-more-than 5% throughput regression gate. Neither pressure comparison reaches the predeclared 10%
material-throughput-gain threshold. C16 D2 TTFT P95 is 5.10% worse in the incremental observation.

The 613.88 tokens/s/chip C32 result exceeds the previously published BetterScale Qwen35 SWE smoke
throughput records, but the matched full/incremental pair shows essentially unchanged throughput. Do
not attribute the historical jump to incremental copying: this campaign also removes the former
16-execution-seat bottleneck and connects the wider balanced-attention path. Historical source,
capacity and host differences prevent an isolated causal speedup claim.

## Capacity and transfer evidence

Every rank has 26,038,239,232 bytes (24.25 GiB) of total State and a 262144-token context limit. C16
reserves 1,912,095,920 resident bytes and 16,720 shared 128-token attention pages (2,140,160
tokens); C32 reserves 3,441,772,656 resident bytes and 15,664 pages (2,004,992 tokens). Shared
attention is pooled, not a maximum-context reservation per seat. No running-request preemptions were
recorded; sampled page occupancy peaked at 84.56% across the campaign.

Incremental C16 D2 completed 615 restores. Per rank, its sampled transfer accounting records
225,443,812,148 D2H bytes versus 328,307,020,596 logical full-checkpoint bytes, and 59,535,142,124
H2D bytes versus 191,326,465,260 logical bytes. Only 32 attention blocks were restored. This
demonstrates byte savings, not a corresponding throughput gain. C16 D1 and C32 D1 had zero host
restores in both modes; incremental backup still reduced transferred bytes. These counters cover
deployment lifetime, including qualification and drain, rather than exactly the 900-second
measurement window. No sampled load was admitted without native execution capacity.

The separate 36-seat correctness gate passed 144 requests, including 36 distinct-key hot/cold
continuation pairs with exactly matching output token IDs. The native GDN host shim now admits 37
padded metadata rows; numerical GDN/FIA kernels are unchanged. The wider CPU planner oracle does not
establish NPU qualification beyond 36 execution seats. The smoke stress test validates the request
protocol, not numerical equivalence of every generated continuation.

All six server and admission exits were zero and selected devices were released. Five servers logged
shared-memory cleanup warnings; four logged output-handler EngineDeadError after requested shutdown.
These teardown warnings are retained separately from zero measured request failures.

- [Measured source: 96cd03a](https://github.com/vLLM-HUST/BetterScale/commit/96cd03a362b18d68ea1a1b1f7ada5633d9c5e60c)
- [Benchmark client: 8bb99eb](https://github.com/vLLM-HUST/swe-prefix-reuse/commit/8bb99ebac120f8907623fc1b5a04946894424d31)
- [Public metric/configuration extract](../data/leaderboard_frontier_swe_evidence.json).

The six configurations are retained, including controls and regressions. Best-of curation applies
only to identical configurations; full and incremental modes are not interchangeable repeats. Raw
request arrays, logs and runtime capsules remain local. This is a source-snapshot result, not a
released-wheel qualification. Earlier offered-C32 tests constrained to 16 execution seats remain
separate diagnostic evidence and are not imported as width-matched system results.
