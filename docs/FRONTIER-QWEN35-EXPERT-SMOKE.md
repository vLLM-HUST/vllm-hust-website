# Qwen3.5 separated experts: AgentX C16 smoke

Five configurations were measured on the same eight Ascend 910B2 cards. Every
accepted point passed the official harness validity check, had no request errors
or output-length mismatches, and completed owned deployment cleanup. Each point
uses **900 measured seconds after full warmup**. These are provisional smoke
observations, not one-hour formal certification or a tuned capacity frontier.

## Results

| Configuration | Output tok/s | Output tok/s/chip | P90 decode tok/s/user | TTFT P95 (ms) | TPOT P95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| TP8 | 89.93 | 11.24 | 29.72 | 3250.47 | 46.44 |
| DP8EP8 | 72.52 | 9.06 | 23.07 | 3888.26 | 56.71 |
| TP8EP8 | 90.34 | 11.29 | 30.53 | 2965.72 | 46.72 |
| A4E4 | 95.02 | 11.88 | 43.60 | 4498.67 | 39.59 |
| A6E2 | 94.67 | 11.83 | 40.13 | 3653.21 | 41.80 |

A4/E4 and A6/E2 are effectively tied in this single C16 throughput observation
(less than0.4% apart). They deliver about31% more output than DP8EP8 and about5%
more than TP8EP8. A4/E4 has the higher P90 per-request decode speed, while A6/E2
has the better TTFT P95 of the two candidates. TP8EP8 retains the best TTFT P95
of these five points. There are no repeats or confidence intervals; small gaps
are not established improvements. This is not an equal-work or causal ablation:
closed-loop arms reach different portions of the retained DAGs.

## Workload and configuration

The [AgentX workload repository](https://github.com/vLLM-HUST/agentx-bench)
(`e0c34de525246c98d14df590f9864d7be7a25075`) pins the unmodified official harness
`56a0cf70f4c0359454ee4bd15a17770b541a3e3e` and full393-session,68266-request256K
corpus `8fecd2fc56694469f758f0afbbb6335ad3043740`. All runs use C16 live session
trees, original output budgets/DAGs/delays, seed20260923, start ratios.25/.75,
primers plus ten warmup requests/lane, and30-second drain. No long-trace filtering
or output truncation was introduced. C16 is not sixteen continuously busy HTTP
requests, and this single offered load does not establish peak serving capacity.

Common server settings: BF16 weights/compute/KV,262144 context,4096 prefill chunks,
native FULL decode graphs,32 sequences **per attention/DP rank**,85% memory
utilization, aligned native Mamba prefix cache, native nonthinking chat template,
greedy sampling, ignore-EOS, no host-KV offload and **no MTP/speculation**. Global
scheduler capacity therefore differs with topology. Native TP-dependent hybrid
cache behavior is retained, not forced into an equal-KV control. All eight chips
are counted, including expert-only chips. The full host DRAM allocation is
recorded in downloadable parameters; no deployment price is inferred.

Native configurations are TP8, TP8EP8 and **TP1/DP8/EP8**, not eight independent
full-model replicas. Read-only native receipts verified every expert exactly
once across eight EP ranks in all40 layers. A4/E4 and A6/E2 use independent TP1
attention ranks, with all routed experts of each layer owned by one of four or
two persistent expert servers. Native routing, shared MLP, attention and KV
scheduling remain in the native worker. Server-side combine and device client
publication/collection are active; no host-forward expert RPC is used.

Every arm uses the same loopback HTTP/SSE relay and fixed SSH tunnel. Request
bodies and SSE bytes are unchanged. Official X-Correlation-ID sessions are
assigned round-robin at first request and retain their rank for later turns;
child sessions are independently placed, not pinned to their root tree. Native
DP receives X-data-parallel-rank; separated roles use independent native APIs.

## Identity and evidence

All five arms share the completed ModelScope BF16 checkpoint and tokenizer.
The original downloader did not retain an upstream commit. Their immutable
content-manifest identity is
`1ad9f5f76ce02ffe2df0512f6a187b9b65737cf62264fbbf780054922f14abe3`.
Equality to the earlier Frontier HF snapshot was not established, so this series
has a separate model/cohort identity. It also does not mix with the earlier MTP2
BetterScale FULL-compiler measurements: these candidates are the separated-expert
prototype on vLLM/Ascend0.23.0, not that compiler treatment.

[Metric-only official extracts](../data/leaderboard_frontier_expert_evidence.json)
preserve original units, percentiles, validity and run IDs. The chart takes
`output_token_throughput_per_user.p90` directly for X and official output
`output_token_throughput.avg / 8` for Y. It does not invert P90 TPOT or recompute
output tokens divided by900. Full private logs, source capsules, admission and
client/expert generation receipts are retained but are not claimed as public
artifacts. Synthetic payloads do not evaluate model answer quality.

## Rejected bring-up runs and sustained-runtime repair

Three earlier A4/E4 runs were rejected by official metric-duration coverage and
are **not plotted**: `20260923T173447Z-smoke-c16-2c6497e0`,
`20260923T180221Z-smoke-c16-64e152e5`, and
`20260923T183202Z-smoke-c16-e3929a89`. Their expert service stopped advancing
before the measured window ended. Runtime API queries subsequently showed that
both requested1200s and10800s execution limits became only1090.921693s on this
host. Raising process wait settings and removing the server graph alone did not
fix that effective execution limit. A separate early TP8 attempt lost its
launch shell before warmup; it is also excluded.

The accepted candidates explicitly use the documented zero per-kernel launch
deadline, two direct persistent launches, and an external11000-second owned
supervisor with bounded service/control lifetime. Attention FULL decode graphs
remain enabled. This does not lengthen the900-second benchmark or waive its
validity checks. A fresh four-client ×40-layer native-shadow qualification passed
for the exact new binary closure; both measured candidates then passed the full
endurance window and clean client/expert generation drain.
