# One Native baseline for MOD comparisons

The previous plugin-homepage ranking was incorrect: it combined percentages measured against
separate Native controls, including other models and topologies. That comparison is withdrawn.
Historical artifacts remain available for audit, but do not qualify for the performance ranking.

Every admitted MOD must use one shared Qwen3.5-35B-A3B Native baseline series. Runtime sources,
model, hardware topology, common launch settings, workload, qualification and metric accounting must
be fixed. Candidate changes must be attributable to the MOD. Re-dividing incompatible old
measurements by a newly selected Native value does not establish comparability.

The website currently exposes no scores. `plugin-performance/v2` records the pending state and
rejects per-MOD ratios. A future evidence validator must bind every candidate to the exact same
Native point IDs at C1/2/4/8/16 and the same frozen experiment contract before ranking is restored.

## ECPA status is an independent dimension

The ten historical performance entries are not ten ECPA certifications. The same
`plugin-performance/v2` record keeps three facts independent: archived performance evidence, ECPA
launch acceptance, and analysis integration. The 2026-09-27 campaign records are:

| Entries                                               | ECPA launch acceptance                                                                                          | Analysis path                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| KV Tiering                                            | Manager-verified                                                                                                | External specialized harness |
| AscendStoreConnector + Mooncake                       | Manager-verified through a supplemental Provider profile; `vLLM-HUST/extension-manager#8` remains an open draft | External specialized harness |
| BidKV, DLA, Pipeline Microbatch                       | Performance runs used project-specific scripts; no unified ECPA launch acceptance                               | External specialized harness |
| BetterScale, vSpec, KVCompression, LatchMoE, DiffSpec | Existing public results only; not reproduced through ECPA in this round                                         | External/published analysis  |

For all ten entries, request collection, throughput/latency recomputation, Native pairing, and
Frontier import remain outside the manager. `check`, `status`, and `plan` validate configuration and
state; they are not performance-analysis operations. A manager-launched run therefore does not by
itself establish an integrated experiment workflow or runtime effectiveness.

The campaign also observed a process-release defect: after the manager exited, API/worker processes
and device memory could remain until the experiment supervisor cleaned them up. The machine-readable
boundary keeps this as `known-defect` and links the retained incident record. Do not promote process
exit or resource release to accepted until signal forwarding, descendant waiting, and device-memory
release have an independent regression result.

Performance ordering belongs to the existing MOD catalog, with no separate results section. Admitted
gains sort descending, including negative gains; items without an admitted score follow and retain
the catalog compatibility/name ordering. Historical evidence alone grants no priority.

Published Frontier evidence is independent of gain-ranking admission. The catalog derives measured
point coverage directly from the Qwen3.5 SWE Frontier data and links to the existing curves. A
pending ranking review must never relabel completed measurements as waiting for another run.
BetterScale already has C1/2/4/8/16 curves alongside a complete Native series;
baseline/configuration mapping still needs review before assigning a cross-MOD gain score.
