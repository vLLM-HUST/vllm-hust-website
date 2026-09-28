# BetterScale offloading phase 1 — SWE session rotation

Qwen3.5-35B-A3B BF16, TP2/MTP2, native asynchronous scheduling and FULL graphs. Every point uses
E16/R20, a 262144-token context limit and 24.25 GiB State per chip. Offloading ON adds an 8 GiB host
State pool per rank with a 70% backup watermark; OFF is the same BetterScale State implementation
without automatic host caching.

C denotes client concurrency, not execution-seat count. D denotes independent session slots per
lane: the working set is C × D sessions. Each arm is one 900-second cold-start SWE Prefix Reuse
window, with in-flight drain excluded from throughput. Two TP2 groups ran together on a shared host;
these are matched configuration observations, not repeatability estimates or SWE answer-quality
scores.

| Client load | OFF tokens/s/chip | ON tokens/s/chip |   Change | OFF → ON TTFT P95 (s) |
| ----------- | ----------------: | ---------------: | -------: | --------------------: |
| C16 D1      |            417.85 |           416.74 |   −0.27% |         0.591 → 0.628 |
| C16 D2      |            206.58 |           310.96 |  +50.53% |         4.606 → 3.137 |
| C32 D1      |            177.88 |           406.70 | +128.64% |       37.492 → 27.370 |
| C32 D2      |            251.56 |           275.40 |   +9.48% |       41.037 → 44.549 |

All eight windows passed the exact-token protocol with zero failed requests. All session slots
revisited a continuation. No running-request preemptions were recorded; sampled shared-attention
page usage peaked at 50.4%, and host State stayed within its configured budget. Capacity did not
regress in this configuration.

C16 D1 needed no host restores and remained nearly unchanged in throughput. C16 D2 and C32 D1
recovered substantial prefix reuse. C32 D2 remains a counterexample: throughput improved, but TTFT
P95 worsened by 8.56%. Host-LRU turnover and misses persisted; a larger-host experiment has not
established a fix for that tail latency.

All server and campaign exit codes were zero and selected devices were released. Shutdown logs
retain shared-memory cleanup warnings and four post-shutdown output-handler errors; this is not a
claim of warning-free teardown.

- [Measured source: 5d1dbfc](https://github.com/vLLM-HUST/BetterScale/commit/5d1dbfc8849c1002a40d1e23d81f93e52e4608e7)
- [Benchmark client: 8bb99eb](https://github.com/vLLM-HUST/swe-prefix-reuse/commit/8bb99ebac120f8907623fc1b5a04946894424d31)
- [Public metric/configuration extract](../data/leaderboard_frontier_swe_evidence.json).

The eight points are distinct configurations, not interchangeable repeats. Both controls and
treatments, including regressions, are retained. Raw requests, server logs and deployment capsules
remain local; the public extract contains metrics and configuration, not private runtime artifacts.
This is a source-snapshot result, not a released-wheel or hw180 rebuilt-runtime qualification.
