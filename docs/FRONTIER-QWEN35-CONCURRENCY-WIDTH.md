# BetterScale width-matched concurrency boundary

Eight valid, independent 900-second SWE Prefix Reuse D1 **smoke** observations on October6,2026. The
best observed throughput is **675.40 output tokens/s/chip at C44, E44/R48**, with TTFT P95
**0.821s** and no sampled native preemptions. These are complete runs, not pooled statistics.

|   C | E / R   | Observation  | Output tok/s/chip | TTFT P95 ms | Native preemptions\* |
| --: | :------ | :----------- | ----------------: | ----------: | -------------------: |
|  37 | 40 / 44 | control      |          628.1478 |      784.44 |                    0 |
|  40 | 40 / 44 | sweep        |          641.9228 |      771.15 |                    0 |
|  44 | 44 / 48 | sweep        |          675.4006 |      820.72 |                    0 |
|  48 | 48 / 52 | sweep        |          598.8339 |     1094.05 |                   99 |
|  48 | 48 / 52 | confirmation |          623.6839 |     1358.83 |                   40 |
|  52 | 52 / 56 | refinement   |          553.7444 |     4088.66 |                   72 |
|  56 | 56 / 60 | confirmation |          531.7678 |     7300.54 |                   57 |
|  52 | 52 / 56 | confirmation |          544.6350 |     3493.46 |                   59 |

\*Native preemption deltas cover measurement plus drain, sampled every15seconds. Client throughput
and latency use the official fixed measurement window and exclude drain. All admitted windows have
zero failed requests, exact-code retrieval gates matching execution width, and successful owned
server exit and selected-card release.

## What the boundary means

The predeclared diagnostic threshold is TTFT P95 at least twice the E40/R44 C37 control:
1.5689seconds, not a service SLA. Both C48 observations remain below it (1.094/1.359s); both C52
observations exceed it (4.089/3.493s), and the clean C56 observation reaches7.301s. The sampled
transition is therefore bracketed by C48 and C52, under this workload and budget—not an exact
integer boundary, hardware maximum, or long-duration stability guarantee. No C64 serving score was
collected after a lower-concurrency degradation was found.

Execution and residency increase with offered concurrency, with R=E+4 and E>=C. This removes the old
E36/R36 admission bottleneck: C37 now reaches628.15tokens/s/chip and0.784s TTFT P95. The total State
budget remains24.25GiB/chip; larger resident GDN domains leave fewer shared attention pages. C44
has14864 shared128-token pages; C48 has14608, C52 has14336 and C56 has14080. These are actual
startup allocations, not a claim that all24.25GiB is attention KV.

Page occupancy alone is not a cliff detector: C37/C44 can reach100% sampled usage without native
preemption because inactive retained state can be reclaimed. C48 introduces active-request
preemption (99/40 per run); C52/C56 also preempt, while token-weighted prefix hits fall to84.6/86.3%
and73.8%, compared with96.3% at C44. In the measured source, `_allocate` first tries to reclaim
inactive hot residents before returning allocation failure to native scheduling. The later cliff is
consistent with shared-page pressure and lost reuse, distinct from merely having too few execution
or resident slots. Exact per-operator attribution was not collected.

## Separate causal diagnosis of the old C37 cliff

Two corrected, fresh-server **300-second diagnostic** windows hold E=36 and C=37 fixed and change
only resident capacity36→40 within the same total State budget. Both use the same host-only cache
event observer, physical cards4,5 and CPU affinity48–143; both pass their own endpoint retrieval
gate. They are not leaderboard scores and are not pooled with the900-second results.

| Resident seats | TTFT P95 s | Output tok/s/chip | Continuations with zero cached tokens | Completed host loads |
| -------------: | ---------: | ----------------: | :------------------------------------ | -------------------: |
|             36 |      8.742 |            273.70 | 208 / 380                             |                  695 |
|             40 |      1.558 |            629.56 | 0 / 749                               |                    0 |

For R36,582 of695 completed restores were evicted **before any request claimed that seat**; only113
were followed by a warm claim. This comes from matching each load completion to the first subsequent
claim/content-eviction event on its seat inside the same measurement window, not inference from the
native preemption counter. Source inspection explains the exposed handoff: load completion clears
`io_owner` and publishes a warm, unowned resident; ordinary cold admission can reclaim it before its
intended continuation is admitted. The trace proves premature discard, not every intended-request
identity. Increasing R supplies enough residency slack to eliminate zero-cache continuations in this
bounded comparison despite E still being below C. Thus the old cliff is not just one extra queue
waiter, nor evidence that available KV bytes guarantee available complete hybrid request state.

## Measurement integrity and publication

The first exploratory E56/R60 C56 window is **excluded**: while enabling parallel probes, a copied
retrieval helper retained port18236 and inserted36 foreign check requests into that window. The
first diagnostic pair is also excluded (one wrong-server gate; the second refused connection). Raw
files are retained. Corrected helpers derive their endpoint from their own server metadata and
record the endpoint plus start/end timestamps. Only the later clean C56 window and corrected
diagnostic pair support results here. Earlier C37/C40/C44/C48 windows completed before parallel
diagnostics began; C52 helpers were corrected before their first retrieval.

Width runs use physical cards0,1; the two C52 refinement runs use2,3. Later windows may overlap
other owner-authorized campaigns on disjoint cards, with separate endpoints, locks and caches on the
same 192-core/2TiB host. Actual card placement and co-run context are preserved; no percentile
pooling or same-card equivalence claim is made across those groups. All six used cards were released
after the campaigns.

The chart retains six configurations and archives the two inferior identical-configuration repeats
under the existing whole-run highest-throughput selection rule. Slower C48/C52/C56 configurations
remain present. BetterScale keeps one MOD identity and its group Pareto curve. Distinct E/R settings
have distinct measured-series IDs; singleton capacities do not fabricate fixed-setting sweeps.

## Source and protocol envelope

Qwen3.5-35B-A3B BF16, TP2/MTP2, FULL graphs, balanced attention, async scheduling,262144 context,
4096 batch-token budget, State24.25GiB/chip, host cache8GiB/rank, watermark0.7, full checkpoint
transfers (incremental disabled, not cache disabled). Fresh server, E/E exact-code retrieval checks,
separate C2/60s qualification, then fresh salts and seed20260924 for each900-second D1 window. No
profiler in scored runs; passive Prometheus sampling only.

Base BetterScale96cd03a, vLLM752a3a5 and Ascend9bf964c use the previously documented isolated
CANN9.0.1 / torch2.10.0+cpu / torch-npu2.10.0.post2 / transformers5.14.1 reconstruction. The task
adds execution admission up to64, host GDN metadata up to65rows including the sentinel, and larger
count bins192/240/320. GDN device and balanced-attention algorithms are unchanged. This is an
explicit capacity-extension capsule, not an unchanged released wheel. Seventeen focused CPU tests
passed; 12 wide-versus-partition GDN FULL comparisons at40/48/64 requests had zero error; six
balanced attention width cases passed native comparisons, guards and replay checks (maximum
error0.0004883). These leaf gates do not substitute for a C64 full-serving result.

Client6861242 reports SWE v1/tool0.1.2. Prepared3879dff has exactly the historical token payload
after only tokenizer path/version metadata substitution reconstructs8044561f. Historical
client8bb99eb and runtime identity still differ. Full checkpoint, runtime pins and workload
identities remain those of the preceding fixed-E36 campaign. Commands, exact patch/native hashes and
per-run metrics are in the public extract; full raw request/state-event records and runtime capsules
remain private.

[Public metric/configuration extract](../data/leaderboard_betterscale_width_evidence.json) ·
[Earlier fixed-E36/R36 observations](FRONTIER-QWEN35-CONCURRENCY-KNEE.md).
