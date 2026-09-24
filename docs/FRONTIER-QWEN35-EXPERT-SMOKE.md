# Qwen3.5 eight-chip C64 AgentX smoke

All five points use **900 measured seconds after mandatory long-context snapshot
primers**, with **no extra cache-pressure replay and no MTP**. Official validity,
zero request errors/output-length mismatches, native EP coverage and clean
client/expert drain passed. These replace the withdrawn eight-chip C16 points.

| Configuration | Output tok/s | Output tok/s/chip | P90 decode tok/s/user | TTFT P95 ms | Primer seconds |
|---|---:|---:|---:|---:|---:|
| TP8 | 56.23 | 7.03 | 4.74 | 87851.92 | 639.90 |
| DP8EP8 | 160.19 | 20.02 | 13.27 | 18490.11 | 268.26 |
| TP8EP8 | 56.23 | 7.03 | 4.84 | 96658.45 | 615.38 |
| A4/E4 | 152.93 | 19.12 | 15.04 | 57801.81 | 391.96 |
| A6/E2 | 260.12 | 32.52 | 20.08 | 26845.36 | 373.17 |

A6/E2 delivers 70% more output than A4/E4 and 62% more than DP8EP8 at this
single offered load. DP8EP8 retains better TTFT P95. These are unpooled single
observations, not confidence intervals or established peak capacities. C64
scales the old two-chip C16 offered session-tree load by four; it is not a
promise of 64 continuously decoding requests or equal work across closed-loop arms.

## One chart, explicit configuration differences

Fletcher accepts the HF and ModelScope Qwen3.5-35B-A3B snapshots as the same
model for this throughput view. We therefore retain one model/chart, with
actual source identities in point configurations, not a claim of verified
byte-for-byte equality. The ModelScope content-manifest revision is
`1ad9f5f76ce02ffe2df0512f6a187b9b65737cf62264fbbf780054922f14abe3`.

Historical tuned TP2 points used **benchmark-only synthetic MTP2 with acceptance
length 2.63**, a different runtime/compiler recipe and primers plus ten extra
requests per lane. They remain faster per chip (best published 56.28 versus
A6/E2 32.52), but this is not an isolated parallelism or MTP ablation. Synthetic
acceptance is not measured natural acceptance or answer-quality evidence.

Both protocols use the full 393-session, 68,266-request 256K corpus, original
measured outputs/DAGs/delays, seed 20260923, trajectory starts 25–75%, greedy
nonthinking generation and ignore-EOS. Warmup advances different replay positions;
normal-replay throughput varies over time. Downloads retain each point's exact
`benchmark_protocol`; warmup variants are not pooled as repeats.

## Deployment and audit

Eight Ascend 910B2 chips per point; BF16 weights/compute/KV; context 262144,
prefill chunk 4096, FULL decode graphs, max-seqs32 per attention/DP rank,
85% memory utilization, aligned native Mamba cache and no host KV offload.
DP8EP8 means TP1/DP8/EP8, not eight full-model replicas. A4/E4 and A6/E2 assign
whole layers' routed experts to persistent servers; shared MLP stays native.
They use two direct persistent kernels per server, zero host-forward requests,
and an external bounded supervisor. Both candidates passed every client-owner
generation equality at drain. Native EP covers all 256 experts in every one of
40 layers across eight ranks. The same session-affine HTTP/SSE relay and SSH
loopback transport was used for all five points.

Measured mean running requests: TP8 27.50 (limit32); A4 per-rank
5.47/8.65/7.71/7.76; A6 2.02/2.27/5.05/4.67/6.86/5.11. Uneven occupancy remains;
these observations do not localize all performance loss to expert kernels.

The [workload repository](https://github.com/vLLM-HUST/agentx-bench) supplies the
wrapper; the local measured wrapper revision is `e7c2fd7` (not yet pushed).
Pinned official harness: `56a0cf70f4c0359454ee4bd15a17770b541a3e3e`;
corpus: `8fecd2fc56694469f758f0afbbb6335ad3043740`.
The selected snapshot-only v2 protocol is an explicit deviation from the earlier
website-style ten-extra-request warmup, not full methodology reproduction.
A prior TP8 C64 pressure10 run took 100 minutes to warm up and was superseded;
its DP8EP8 follow-up was cancelled for the protocol change. Neither is plotted.

[Metric-only official exports](../data/leaderboard_frontier_expert_evidence.json)
retain run IDs, original units and validity. X uses official P90 per-user output
throughput; Y uses official output throughput divided by all eight allocated
chips. It is not reconstructed tokens/900 or inverse P90 TPOT. Complete private
logs/source capsules and load samples are retained, not claimed as public downloads.
