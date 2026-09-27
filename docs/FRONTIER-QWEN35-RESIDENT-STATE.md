# Qwen3.5 resident State — C16 SWE smoke

Measured on 2026-09-26: Qwen3.5-35B-A3B BF16, TP2/MTP2, two Ascend 910B2 chips, C16, 900 seconds.
Native BetterScale model execution, asynchronous scheduling and FULL graphs remain enabled; context
capacity is 262144. Resident State uses 20 seats and a shared attention page pool, within the same
24.25 GiB/chip total State budget.

| Metric                      | Fresh same-pair BetterScale baseline | Resident State |
| --------------------------- | -----------------------------------: | -------------: |
| Output tokens/s/chip        |                             369.1728 |       414.8011 |
| P90 request decode tokens/s |                              55.3413 |        59.4792 |
| TTFT P95, ms                |                               849.42 |         462.25 |
| Failed requests             |                                    0 |              0 |

Observed throughput improved 12.36%. This is one run per arm, not a repeatability estimate or SWE
answer-quality score. The new record is not an identical-configuration repeat of the old layout.

The fix protects the current GDN frontier at the known output-length limit against later queued
writes. It adds no second numerical State bank. All 1170 continuation requests hit cached State.
TraceLoom found unchanged decode graph bodies and approximately unchanged execution cost.
Long-context, actual preemption and hot-to-chunked-prefill correctness gates passed. Arbitrary
historical checkpoints and EOS/stop rollback are not supported; native graph capture is retained.

- [Measured source: a8abd05](https://github.com/vLLM-HUST/BetterScale/commit/a8abd056a3ece455f683b212d6bd905da4058cbb)
- [Acceptance record: d1ca3ec](https://github.com/vLLM-HUST/BetterScale/commit/d1ca3ec72445b784c58daafef4171e3f46f3bc69)
- [Public metric/configuration extract](../data/leaderboard_frontier_swe_evidence.json), run
  `f962e271466a456eb97dc77cdaf4d3cb`.

The source capsule was qualified in isolation, not as a released wheel. Raw requests and timelines
remain retained locally; the public extract does not claim to publish those artifacts.
