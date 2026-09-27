# Measured MOD ordering

The plugin homepage pins published performance results above the catalog. Within each group, entries
sort by `100 * (geomean(candidate output TPS / matched Native output TPS) - 1)`. Negative results
remain visible. Measured entries without a published reproducible ratio appear last in their group,
ahead of unmeasured catalog entries. Packaging and correctness checks alone are not throughput
measurements.

Qwen3.5 TP2/PP1 paired campaigns appear first. Other models or parallel configurations have their
own section. This is a navigation order, not a common-benchmark winner table: different MODs use
separate Native controls, runtime revisions and workloads. The UI states this limitation and links
every entry to its evidence. Single observations do not establish repeatable or causal gains.

`data/plugin-performance.json` selects the evidence; `assets/plugin-performance.js` computes the
scores. Frontier entries cite candidate/Native point IDs, using all five C1/2/4/8/16 cells of each
selected campaign. No best-point selection or cross-campaign Native substitution is used. Previously
published vSpec, BetterScale, KVCompression and LatchMoE ratios are transcribed from their linked
public results; BetterScale includes both DP8 and TP8, and KVCompression includes both long-context
and KV-pressure results. Their geometric means are derived summaries, not new measurements.
LatchMoE's input rates are approximate. DiffSpec retains its negative qualitative finding without
inventing a missing ratio.

Mooncake is shown explicitly as AscendStoreConnector + Mooncake. Its upstream-owned connector
classification stays unchanged, so it appears in the measured-results section without being
reclassified as an organization-native plugin. Delisted MODs remain excluded.

When publishing a new paired campaign, update the selected point IDs and the model/configuration
scope together. The tests reject missing or cross-concurrency controls and verify full five-point
series, source capsules and runtime-base identities for current entries. If ranking data cannot
load, the catalog remains usable and reports that performance ordering is unavailable.
