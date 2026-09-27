# Qwen3.5-35B unified MOD results

All candidates use the same five-point Native series. Values are output token/s; parentheses show
the change from Native at the same concurrency.

| MOD                      |             C1 |              C2 |              C4 |              C8 |             C16 | Geometric mean vs Native |
| ------------------------ | -------------: | --------------: | --------------: | --------------: | --------------: | -----------------------: |
| Native                   |          91.55 |          152.72 |          217.48 |          291.11 |          359.75 |                    0.00% |
| mooncake-vllm-connectors | 90.82 (-0.79%) | 151.70 (-0.67%) | 216.22 (-0.58%) | 290.27 (-0.29%) | 352.89 (-1.91%) |                   -0.85% |
| kv-tiering-migration     | 91.03 (-0.56%) | 150.45 (-1.49%) | 215.93 (-0.71%) | 286.12 (-1.71%) | 341.63 (-5.04%) |                   -1.91% |
| bidkv                    | 92.13 (+0.64%) | 153.43 (+0.46%) | 216.70 (-0.36%) | 293.45 (+0.80%) | 358.71 (-0.29%) |                   +0.25% |
| dla                      | 91.85 (+0.33%) | 152.61 (-0.07%) | 215.56 (-0.88%) | 288.15 (-1.02%) | 358.20 (-0.43%) |                   -0.42% |

Fixed controls: Qwen3.5-35B-A3B BF16, TP2/PP1, context 262144, APC, natural MTP2, async scheduling,
FULL_AND_PIECEWISE graph capture, max sequences 16, batch tokens 4096, and 26038239232 device KV
bytes per chip.

Each point is one real-online 900-second observation with zero failed requests, successful retrieval
and prefix-reuse gates, and verified device release.

The25 observations share the existing Qwen3.5-35B-A3B BF16 / SWE15-minute chart at the owner's
request; checkpoint/source differences are retained per point, not promoted into a duplicate model
button. The original campaign cohort contract is retained in `archived_cohorts`, and moved points
record `evidence.original_cohort_id`. This presentation merge does not pool repeats, alter metrics,
or replace the campaign's own matched Native controls for MOD speedup attribution. The prepared
workload variant/tokenizer equivalence was already recorded in the shared SWE contract. Rotation
depths continue to own independent Pareto frontiers within the combined chart.
