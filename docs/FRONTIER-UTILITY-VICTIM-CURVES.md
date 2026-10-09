# Utility-victim concurrency observations (2026-10-03 campaign)

Real measured results; candidate admission to the canonical Qwen3.5 setting remains pending
checkpoint identity verification. A passing data/model test does not establish checkpoint
equivalence or causal performance benefit.

## Available observations

Each retained point is one independent 900-second observation (r1). No repeated-sample uncertainty
estimate is available. The two series connect only measured concurrency levels; missing levels are
not fabricated or interpolated into points.

| Arm |   C | Output TPS | Decode P90 TPS | TTFT P95 ms | Mean TPOT ms | TPOT P95 ms |    E2E P95 ms | Completed | Max prompt | Sessions | Preempt delta | Installed / effective |
| --- | --: | ---------: | -------------: | ----------: | -----------: | ----------: | ------------: | --------: | ---------: | -------: | ------------: | --------------------- |
| OFF |   1 |  39.448889 |      44.016726 | 1876.069614 |    23.415315 |   24.476749 |  40938.521283 |        76 |      28638 |        3 |           0.0 | 0 / 0                 |
| OFF |   2 |  66.356667 |      40.638849 | 2515.363666 |    27.433914 |   33.804216 |  44236.277210 |       123 |      41173 |        4 |           0.0 | 0 / 0                 |
| OFF |   4 | 108.340000 |      36.438089 | 2684.820806 |    33.935991 |   45.337791 |  66866.304716 |       178 |      41173 |        4 |           0.0 | 0 / 0                 |
| OFF |   8 | 162.375556 |      29.868634 | 2747.880485 |    46.042655 |   61.807169 |  87137.399858 |       261 |      55491 |        6 |           0.0 | 0 / 0                 |
| OFF |  16 | 175.024444 |      19.306774 | 9237.753272 |    81.314337 |  151.693451 | 110545.961445 |       323 |      40244 |        6 |         398.0 | 0 / 0                 |
| ON  |   1 |  40.314444 |      45.721313 | 1889.361854 |    22.617201 |   23.724104 |  39593.188582 |        77 |      28638 |        3 |           0.0 | 4 / 0                 |
| ON  |   2 |  66.410000 |      40.708113 | 2534.284985 |    27.545299 |   34.543156 |  42096.980459 |       123 |      41173 |        4 |           0.0 | 4 / 0                 |
| ON  |   4 | 107.703333 |      36.110864 | 2657.152463 |    34.041279 |   45.769416 |  69807.154192 |       177 |      41173 |        4 |           0.0 | 4 / 0                 |
| ON  |   8 | 158.621111 |      28.123007 | 2713.216918 |    47.647988 |   63.337247 |  88615.234411 |       256 |      55491 |        5 |           0.0 | 4 / 0                 |
| ON  |  16 | 151.367778 |      19.225106 | 6525.029728 |    95.547838 |  276.225097 | 117480.764377 |       296 |      40244 |        4 |         191.0 | 4 / 1                 |

Full precision, run IDs, request-file hashes, artifact manifests, probes and client configuration
are retained in the evidence JSON.

## Excluded or unavailable

All ten planned arm/concurrency combinations have valid retained formal windows.

## Observed OFF/ON comparison

| C   | Output TPS change (ON/OFF - 1) | TTFT P95 change (ON/OFF - 1) |
| --- | -----------------------------: | ---------------------------: |
| 1   |                        +2.194% |                      +0.709% |
| 2   |                        +0.080% |                      +0.752% |
| 4   |                        -0.588% |                      -1.031% |
| 8   |                        -2.312% |                      -1.261% |
| 16  |                       -13.516% |                     -29.366% |

These ratios describe one observation per arm and are not confidence intervals or causal improvement
estimates. The supplied ON C16 log contains one runtime_effective event with selection_changed=true,
scope=victim_selection_only, tokens_proxy=41302, and actual_kv_freed_verified=false. This records a
selector change, not verified KV bytes released. Other supplied ON concurrency logs contain zero
effective events. C16 ON has lower throughput than OFF, despite fewer recorded preemptions and lower
TTFT P95. Mean/P95 TPOT and E2E P95 are worse in that observation. This is a tradeoff, not a general
speedup.

## Calculation and scope

Throughput sums streamed chunk token counts where 0 \<= t < 900 and divides by 900; per-chip
throughput divides by two. In-window tokens from later-drained requests still count. Latency samples
include successful requests with end \<= 900. Decode speed is
(output_count-1)/(last_token-first_token). Mean TPOT is the arithmetic mean of 1000/decode_speed per
request. It is not the reciprocal of aggregate throughput. TTFT is first_token-start. E2E is
last_token-start, not HTTP end-start. Millisecond metrics multiply seconds by 1000. Percentiles use
sorted samples and linear interpolation at (n-1)\*q. The builder recomputes original summary metrics
from request records and checks success, output lengths, completion counts and fixed 900s duration.
The separate 20s probes are excluded from scores. Session rotation depth 1 is inferred from the
client implementation, not an explicit recorded flag.

## Configuration and provenance

Both arms use TP2+EP on two Ascend 910B2 devices (physical IDs 2/3 in supplied snapshots), memory
utilization .65, context limit 262144, max-num-seqs 16, max batched tokens 8192, BF16 dtype, KV
dtype auto, block size 128, no prefix caching, chunked prefill, no async scheduling, and
FULL_DECODE_ONLY graph capture at 1/2/4/8/16. No MTP configuration is supplied. Concurrency changes
only in the client. Configured context capacity is not measured prompt coverage. Versions: vLLM
0.23.0+empty, vLLM-Ascend 0.23.0.post1, torch 2.10.0+cpu, torch_npu 2.10.0.post4, extension manager
0.2.0.dev0, utility-victim 0.1.0.dev2, client 0.1.2 / Transformers 5.18.0. Exact base commits,
dirty-source diff hashes and sanitized launch commands are in point parameters. OFF has the
extension installed/enabled in the manager with kill switch 1; ON has kill switch 0. Both use the
locally modified core scheduler, so OFF is not pristine upstream. Installation events do not
establish changed victim selection or KV freeing. Event counts cover the supplied whole server log,
including startup/probe. No causal benefit is asserted. Preemption deltas are after-minus-before
snapshots around the client invocation, including drain, not a strict 900s metric. Counter
continuity and log-to-run PID ownership were not independently captured. Supplied filenames and
launch markers provide the current association. Installed CANN component receipts and inspected
shell paths show 9.1.0; actual loaded server libraries were not captured. Some receipt branch
strings contain later dates; retain the raw evidence and verify clock/build provenance instead of
inferring a release date. Newline-normalized benchmark diff sections contain no changed text. The
core diff does add the local selector API/factory and a victim-membership check; it is not an
upstream API. Diff snapshots alone do not establish deployment timing. The plugin installed-files
manifest has individual hashes, but its hash is not the original wheel hash. Wheel identity, source
revision and public repository remain unknown. utility-victim is absent from the local ecosystem
catalog; mod_sources is omitted pending publication or explicit reviewer acceptance.

## Admission limitations

Model revision remains null. A model path and a list of download-metadata filenames do not identify
actual weights. The canonical cohort model revision must not be treated as proof of this
deployment's identity. Supply metadata contents and actual model hashes, then establish accepted
checkpoint equivalence before publication. The prepared workload hash
4e62e54ef47497fd916a6c2906b220b3af400f87873ea0784740fed3f61e78c8 and fingerprint
319f580a2fc8d2ff1e1f48a26ea0c29eea35798d747e7188ca584e92c014bdf9 match an already registered
variant. The reference establishes prepared-content equivalence after metadata normalization, not
tokenizer identity equality. Prepared bytes were not supplied to repeat that proof independently.
Original embedded metadata contains pre-run declarations and stale missing-information notes; it has
not been rewritten. Current derived evidence is stored separately. Raw files are local and
SHA256-addressed, but public archive hosting remains to be supplied. default_groups is unchanged.
Select the OFF/ON groups manually in the target setting. Historical C16 observations from another
campaign are not spliced into this sweep. See accompanying test-output.txt for the Node checks
actually run. Full pytest, pre-commit and browser verification have not been run for this candidate.
