# Qwen3.5-35B-A3B: AgentX 256K smoke

**15-minute smoke, tuning incomplete. Not a one-hour formal result, released-wheel claim, model
quality score, or proof of a globally optimal frontier.** Published at Fletcher's request on
2026-09-23. No one-hour window will be run until tuning is accepted.

## Measured points

| Metric                                               | Native baseline | BetterScale experimental |
| ---------------------------------------------------- | --------------: | -----------------------: |
| Output tokens/s/chip                                 |         29.2968 |                  42.3122 |
| Total output tokens/s                                |         58.5936 |                  84.6243 |
| **P90 per-request decode tokens/s (default X)**      |     **83.9964** |              **97.6618** |
| Interactivity: 1000 / mean request TPOT (tok/s/user) |         63.2970 |                  67.6906 |
| TTFT median (ms)                                     |       1384.2884 |                 806.4078 |
| TTFT P95 (ms)                                        |       4022.7425 |                4189.5071 |
| Median per-request decode tokens/s                   |         67.6700 |                  79.8870 |
| Completed measured requests                          |              89 |                      111 |
| Request errors / output-length mismatches            |           0 / 0 |                    0 / 0 |

The ordinate is **total measured output tokens/s divided by all allocated chips**: two Ascend 910B2
accelerators in each configuration. It is resource productivity, not revenue, cost, or task value.
No price assumptions are attached.

The default X coordinate is **P90 per-request decode tokens/s**, taken directly from the official
`output_token_throughput_per_user.p90` statistic. It is the 90th percentile of inverse request TPOT,
not `1000 / P90 TPOT`, not median speed and not inverse mean TPOT. Higher is faster; this upper
speed percentile is not a slow-tail guarantee. The pinned harness's `inter_token_latency` is
request-level `(request latency − TTFT) / (output length − 1)`, i.e. TPOT. Its P95 is not a
percentile of individual streaming token gaps. Alternative chart projections retain inverse mean
TPOT and P95 latency metrics.

Output throughput is copied from the official `output_token_throughput.avg`, preserving the
harness's observation/drain accounting. The configured **sending window** is 900 seconds after
warmup; do not reconstruct throughput as total output tokens divided by 900, or divide by the
separately exported `benchmark_duration` statistic. Those are not necessarily its denominator.

## Comparison contract

- Model: Qwen3.5-35B-A3B, revision `712cf74392b05026a6db2bf213d343747d1f6d45`.
- Native BF16 weights/compute/KV, 262,144-token capacity; model-native nonthinking chat template.
- Official AgentX 256K corpus revision `8fecd2fc56694469f758f0afbbb6335ad3043740`, all 393 sessions
  / 68,266 requests available as the sampling pool. No additional filtering, context clipping or
  output-budget reduction. A timed run does not execute the entire pool.
- Official harness revision `56a0cf70f4c0359454ee4bd15a17770b541a3e3e`; seed 20260923, trajectory
  starts 25–75%, mandatory snapshot primers plus ten warmup requests/lane, per-play prefix cache
  busting, original DAG/delay replay, 900-second smoke window and 30-second grace setting.
- Same shared-host card pair, **TP2 / PP1 / DP1, no EP**, four live client session trees; server
  max-seqs 8, query budget 4096, async scheduling, prefix caching and Mamba align cache enabled. MTP
  drafts two tokens. Native uses FULL_AND_PIECEWISE and TASK_QUEUE_ENABLE=1; BetterScale uses FULL
  prefill/mixed/decode and TASK_QUEUE_ENABLE=0. Both include the same benchmark sampler.
- No host KV offload. Host DRAM allocation is proportional to two of eight chips. Other chips on the
  shared host were occupied; selected-card admission and foreign-owner guards protected these runs.
  This is not an isolated whole-host hardware ceiling.
- BetterScale is the experimental `moe-full5 / candidate-runtime1` source capsule, not a published
  wheel qualification. Native includes only the necessary SD/V1 Mamba ABI bridge, not the
  BetterScale graph/scheduler treatment. Engine base revisions and source distinctions are retained
  in the metric evidence and configuration details.

## Speculative acceptance and scope

Real SPEED-Bench coding calibration: all 80 coding prompts, dataset revision
`454f88454792dfa3ccfd7ef15fff248efde44cd1`, nonthinking MTP2, temperature 0.7, top-p 0.8, top-k 20,
presence penalty 1.5, maximum output 4096, concurrency one. 44,587 accepted draft tokens over 27,396
draft steps gives `1 + 44587 / 27396 = 2.627500365`, rounded forced reference **2.63**.

Both synthetic AgentX arms use that forced acceptance length with greedy sampling and the same
explicit pinned adapter, including TP-rank0 random-uniform broadcast. The pinned Ascend V1 sampler
otherwise ignores the core synthetic option. This benchmark adapter does not establish natural model
output quality. Separate real-weight functional and long-context qualification preceded these
measurements.

Each point is **one run**, sequential rather than ABBA. The measured total-throughput ratio is
1.4443×, but closed-loop replay progressed to different request mixes (89 vs 111 completions). This
is not an isolated kernel speedup or a repeatability estimate. TTFT P95 is slightly higher for
BetterScale even though its median improves; preserve both rather than best-picking metrics. Both
official exports report `submission_valid=true`; that does not turn a smoke into a formal one-hour
result or imply SemiAnalysis certification.

## Evidence

- [Machine-readable points and configuration](../data/leaderboard_frontier.json)
- [Curated official metric extracts and calibration](../data/leaderboard_frontier_evidence.json)
- Native run: `20260923T111149Z-smoke-c4-6aba3e3e`.
- BetterScale run: `20260923T103407Z-smoke-c4-90c340f1`.
- The evidence JSON contains selected unmodified aggregate fields from each official export,
  protocol/runtime identities and the calibration receipt. It omits local paths, host identities,
  request payloads and unrelated runtime logs; it is not advertised as a complete raw archive.
- [AgentX methodology](https://inferencex.semianalysis.com/agentx/methodology)
- [InferenceX throughput/interactivity explanation](https://inferencex.semianalysis.com/blog/ultra-high-interactivity-on-nvidia)
