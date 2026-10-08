# BetterScale E36/R36 concurrency boundary

Seven independent 900-second SWE Prefix Reuse D1 observations on October 6, 2026, using two Ascend
910B2 chips. Execution seats and resident seats both remain 36. This fixed configuration stays
healthy at C36 and degrades reproducibly at C37; this is not a device's physical concurrency limit.

|   C | Observation  | Output tok/s/chip | TTFT P95 ms | P90 decode tok/s/user |
| --: | ------------ | ----------------: | ----------: | --------------------: |
|  32 | Control      |          613.1761 |      725.83 |               43.8739 |
|  36 | Sweep        |          650.0278 |      766.06 |               41.5374 |
|  36 | Confirmation |          650.7822 |      747.46 |               41.9852 |
|  37 | Edge         |          266.7206 |    12544.43 |               21.9010 |
|  37 | Confirmation |          278.6472 |    10665.55 |               23.2777 |
|  40 | Sweep        |          207.4422 |    20453.76 |               20.0576 |
|  40 | Confirmation |          212.6867 |    18757.76 |               20.6576 |

All windows are valid, with zero failed requests, 40/40 exact-code retrieval checks per fresh
server, and successful server exit and selected-device release. The predeclared diagnostic is TTFT
P95 at least twice the same-host C32 control, not an SLA. After C40 degraded, C37 and both sides
were replicated rather than continuing to C48/C64.

The chart follows existing whole-run best-of repeat selection: four configurations remain visible;
the other three full observations remain in `archived_points` and
[the complete metric/configuration extract](../data/leaderboard_betterscale_knee_evidence.json). No
percentile pooling or independently selected X/Y coordinates. Regressing C37/C40 configurations
remain visible. This campaign appears only in **BetterScale residency and cache studies**, not the
main chart. It does not reinstate historical standalone C32 in the main chart or change other
groups.

## Interpretation

C36 delivers approximately 6% more throughput than the same-host C32 control. C37's token-weighted
prefix-cache hit fraction falls from approximately 96.5% to 30–32%; C40 reaches 3–4%. Median sampled
waiting counts are 2 and 5 respectively, while peak KV page occupancy drops to approximately 58% and
49%. Sampled native preemption deltas remain zero. These counters cover measurement plus drain at
15-second sampling; headline throughput and latency exclude drain.

This points toward resident-state/cache churn after exceeding 36 seats rather than exhaustion of the
shared attention page pool. A subsequent
[width-matched study and separate resident-only diagnosis](FRONTIER-QWEN35-CONCURRENCY-WIDTH.md)
confirm that sufficient residency removes most of this cliff and directly observe restored-state
discard before request claim. Zero native preemptions does not mean zero resident-cache evictions;
backup/restore counts were not collected in these original seven windows.

## Protocol and source

Qwen3.5-35B-A3B BF16, TP2/MTP2, FULL graphs, balanced attention, async scheduling, 262144 context,
4096 batch token budget, E36/R36. State budget is 24.25 GiB/chip; 15664 shared 128-token attention
pages and 3441772656 resident bytes/rank. Host cache is 8 GiB/rank, policy enabled, watermark0.7,
full checkpoint transfers (incremental disabled, not cache disabled). No profiler. Each fresh server
runs 40 retrieval checks and a separate C2/60-second qualification before the 900-second measurement
with fresh salts and seed20260924.

Measured BetterScale source is `96cd03a362b18d68ea1a1b1f7ada5633d9c5e60c`, vLLM
`752a3a504485790a2e8491cacbb35c137339ad34`, Ascend `9bf964cb4b87c8cd0d6852c41a55b3c29711fa95`.
Isolated CANN9.0.1, torch2.10.0+cpu, torch-npu2.10.0.post2 and transformers5.14.1; host
driver26.0.rc1 unchanged. Original FIA planner/GDN device payloads are retained; host GDN and CP
libraries are rebuilt with explicit task-only admission manifests. Worker library maps were checked.
This is a reconstructed source stack, not an unchanged released wheel.

Client `6861242dbd9f17b707003191e4200b7752911d7c` reports tool0.1.2 and SWE v1 D1. Historical
client8bb99eb was unavailable. Prepared workload hash
`3879dffad03bc6ad4574f75dab06f27bb905e5bb18104be0d4bf39b42fdc9a1e` matches the qualified October2
reconstruction; tokenizer fingerprint matches historical. Replacing only tokenizer path/version
metadata in the original compact JSON reconstructs the historical prepared-file SHA256 exactly:
session order, token deltas, output budgets and policy are identical. ModelScope revision
`712cf74392b05026a6db2bf213d343747d1f6d45` passed the existing 22-file manifest. Do not label this
exact historical runtime/client reproduction or attribute a cross-host historical difference to one
component. Full pins, commands, run IDs and sampling dates are in the extract. Raw token records and
runtime capsules remain private; this publication is aggregate/configuration only.
