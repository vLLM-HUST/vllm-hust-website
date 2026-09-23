# Review or extend the run-oriented leaderboard

Enter here for the independent `leaderboard-runs.html` review entry, task tags, per-run percentile
display, or importing sealed repeats into that entry.

Fletcher chose an additive review page on 2026-09-22: leave the legacy leaderboard, its scripts and
the production publication protocol alone until tutor review. Do not resume benchmark experiments
merely to work on this presentation.

Read [the review handoff](../../../../../docs/LEADERBOARD-RUNS-REVIEW.md) for the interface, module
boundaries, evidence rebuild command and executable checks. The scripts there are site/CI consumers,
not private knowledge-plane helpers.

The costly evidence distinction to preserve: the existing TP2 snapshot contains 16 aggregate rows,
while sealed submissions contain 32 raw runs. P95 comes from raw compressed results; aggregate
constraints and averaged repeat P95 are not request-distribution percentiles. `tbt_ms` is the
producer's TPOT alias, whereas offline batch latency is not TTFT. Missing old metrics must remain
missing.

Although the new campaign shares hardware, historical publications include B3 as well as B2.
Fletcher chose a single flat table on 2026-09-23: include current and historical records by default,
with an explicit hardware column instead of a global hardware selector. Hardware remains part of
model identity; parallel configuration must not be inferred from accelerator count alone.

Before changing MOD attribution, read the audit section in the review handoff. Resolve canonical
names/maintainers from the workshop's `data/ecosystem.json`; reviewed publication-ID associations
live in `data/leaderboard_mod_attributions.json`. A legacy PR checkpoint proves lineage, not runtime
activation. Missing activation stays unknown/related, never silently native. Legacy repositories
were archived under `intellistream/*-legacy-20260831`; current MOD `PROVENANCE.md` resolves their
old PR identities. In particular, PR #49 offload compatibility is not KV Tiering, and the native
MTP2 arm's BetterScale worker bridge is not evidence that it ran the BetterScale treatment.

For the sibling Frontier view, read
[the Frontier handoff](../../../../../docs/LEADERBOARD-FRONTIER.md). It consumes a separate
production snapshot. Fletcher authorized the first native/BetterScale Qwen35 AgentX points as
explicitly labeled 15-minute smoke results, not formal results. Do not derive Frontier admission,
prices, or MOD activation from the historical run table. The pure model and browser checks exercise
the contract without using accelerator capacity.

AgentX metric import uses the official output throughput field, not a reconstructed token count /
900 seconds or the separately exported benchmark-duration statistic: native observation/drain
accounting differs. Its request `inter_token_latency` is TPOT; Fletcher selected P90 request decode
speed as default X, taken from `output_token_throughput_per_user.p90`, not inverse P90 TPOT. Inverse
mean TPOT remains an alternative projection, not a substitute for this percentile. Keep smoke/formal
in distinct workload IDs, retain all allocated chips in the Y denominator, and preserve both TTFT
tails. Public evidence is a curated metric-only extract, not a claim that full private logs/source
capsules were published.

When publishing a Frontier snapshot, update its fetch URL revision and the HTML asset versions
alongside the data. The public HTML response advertises a ten-minute cache lifetime; a source-side
match does not prove an existing browser has discarded the initial empty JSON. The snapshot fetch
uses revalidation too. The browser test deliberately serves an empty unversioned URL to protect this
boundary. For a rollout handoff, link a versioned page URL before `#frontier` so an old HTML cache
cannot keep loading the old scripts.
