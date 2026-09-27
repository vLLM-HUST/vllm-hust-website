# MOD throughput comparisons

The existing plugin cards show one number: output-throughput change versus the Native concurrency
series recorded by the same published campaign. Cards sort by this number descending. A missing
complete comparison is a dash, never zero. No extra results section or qualification status
paragraphs are rendered on the cards.

`data/plugin-performance.json` groups complete candidate series with the Native series from their
published campaign. `assets/plugin-performance.js` reads actual Frontier throughput values and
computes `(geometric_mean(candidate_tps / native_tps) - 1) * 100` across C1/2/4/8/16. Every load
receives equal weight. The Frontier link tooltip exposes the aggregation and per-load percentages.
No scores are stored in metadata; per-entry baselines, precomputed ratios and partial sweeps are
rejected.

## Existing BetterScale data

The complete small-fish series and the existing capacity16 Native series have matching model
revision, runtime base commits, workload/tokenizer fingerprints, hardware topology, explicit 24.25
GiB/chip KV budget, context, slots, batching, APC, async scheduling and natural MTP2. Both use
900-second fixed-window streamed-token accounting, excluding drain. Their client revisions differ
only in repository documentation, as recorded in [the source evidence](FRONTIER-SMALL-FISH.md).

Graph/capture settings, task-queue settings and MOD workers are treatment configuration differences:
BetterScale uses its FULL graph path while Native uses FULL_AND_PIECEWISE. The reported number is
observed end-to-end throughput relative to Native, not an isolated kernel ablation. Both curves are
single smoke observations. The Native C16 retrieval caveat recorded in
[the original report](FRONTIER-QWEN35-SWE-PREFIX.md) remains; throughput comparisons do not certify
answer quality or repeatability. No original measurements or caveats are removed.

The five throughput changes are +16.87%, +30.44%, +46.63%, +57.55%, and +66.22%; their geometric
aggregate is +42.39%. This complete series is selected explicitly, rather than selecting the best
point independently at each load or substituting the newer single resident-state C16 observation.

## Later unified campaign

BidKV, DLA, Tiering and Mooncake use the single five-point Native curve from their later unified
campaign. Pipeline changes TP2/PP1 to TP2/PP2, and other published MOD reports use other models or
workloads, so they remain unscored. The validator excludes incompatible identities and incomplete
evidence.

ECPA launch/adapter/analysis metadata remains in the data file. It is not injected into the
performance card or used to invent a performance score.

## ECPA acceptance evidence

The ten historical performance entries are not ten ECPA certifications. The same
`plugin-performance/v4` record keeps three facts independent: archived performance evidence, ECPA
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
