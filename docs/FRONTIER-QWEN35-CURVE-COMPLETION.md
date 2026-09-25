# Qwen3.5-35B-A3B: Native and Pipeline curve completion

Both matched arms passed all six measured cells and released their devices. The importer validated
the complete raw records before adding these observations.

This campaign adds C1, C2 and C8 to the previously measured C4/C16 curves. Native and Pipeline use
the same qualified TP2×PP2 runtime on four participating Ascend 910B2 chips. The current container
allocates four chips; the throughput denominator is the four serving chips. Deployment environment
is provenance, not a MOD group.

## Configuration and qualification

The checkpoint, complete model-file manifest, compiled SWE workload, tokenizer, packages, common
core/Ascend overlays, Pipeline revision and measured calibration are unchanged from the
[qualified Pipeline comparison](FRONTIER-QWEN35-PIPELINE-K8S.md). The import check compares their
exact source and workload identities before joining these observations to the existing C4/C16
series.

Both arms retain BF16, 262144-token capacity, APC, Mamba `align`, async scheduling, real MTP with
two draft tokens, FULL_AND_PIECEWISE graphs, 16 server slots, a 4096-token scheduling budget and
26038239232 KV bytes per chip. Only the candidate enables the calibrated Pipeline Microbatch
admission policy. Profiling and debug launchers are excluded.

Each fresh service passed all 26 exact marker-retrieval probes and a separate C2/60-second
protocol/prefix-reuse check before measurement. These are bounded checks, not general answer-quality
or SWE-solving certification. The 60-second checks do not appear as performance points.

## Closed-loop protocol

Each arm runs C1, C2 and C8 serially with one 900-second observation per cell. Cache state is not
reset between windows. Existing C4/C16 points come from the previous matched pair; this is not a set
of repeated independent lifecycles.

The compiled workload fixes prompt lengths and output budgets. Actual output token IDs are appended
to the next turn's input. Consequently, generated content and subsequent prompt hashes can differ
across runs even when their compiled shapes agree. This is a closed-loop serving workload, not a
fixed-token replay.

For C1, all 80 common requests have matching input hashes, budgets and complete output token
sequences. For C2, all 110 common requests have matching input lengths and budgets; eight have
matching input hashes, and three of those also have identical output sequences. These comparisons
supplement the raw-data checks and do not establish general quality equivalence or a cause for
differences.

## Observations

| Arm                 | Concurrency | Output token/s/chip | Decode P90 token/s | Request errors | Policy admissions |
| ------------------- | ----------: | ------------------: | -----------------: | -------------: | ----------------: |
| Native              |           1 |              10.366 |             60.025 |              0 |                 — |
| Pipeline Microbatch |           1 |              15.245 |             69.388 |              0 |             19268 |
| Native              |           2 |              14.011 |             37.041 |              0 |                 — |
| Pipeline Microbatch |           2 |              14.729 |             36.054 |              0 |             19062 |
| Native              |           8 |              20.446 |             14.743 |              0 |                 — |
| Pipeline Microbatch |           8 |              20.541 |             15.500 |              0 |              8920 |

Only streamed output tokens inside each 900-second window contribute to throughput. Post-window
drain tokens and time are excluded. The importer recomputes token totals from raw chunk timestamps,
verifies exact output budgets and valid token IDs, and requires positive prefix-hit deltas. Policy
counters include the window and its drain; admissions/completions show execution, not a
statistically established gain. All observed positive and negative differences are retained without
selecting peaks.

Both services stopped with exit status 0 and no remaining device owners. All six cells passed the
raw-data import checks. The dedicated supervisor was shut down after the paired controller
completed; no automatic restart occurred.

## Reproduction and evidence

Campaign sources are in the dev-hub's
[`scripts/frontier_curves`](https://github.com/vLLM-HUST/vllm-hust-dev-hub/tree/f350939a86c4f567fb3e90433d6e4302b6c25b68/scripts/frontier_curves),
including the exact deployed-controller archive and the validated importer. The published metric
extract retains client configuration, raw-request hashes, qualification receipts and per-window
policy counter deltas. Full per-request records remain in the measurement owner's experiment
artifacts.

The exact deployed-controller archive SHA256 is
`f7e4f04f8cd76f9121dc188ba9cfe205a307da27eb16fee70af8d9d8b0b8af5d`.
