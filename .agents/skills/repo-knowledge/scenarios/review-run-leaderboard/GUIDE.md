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

Although the new campaign shares hardware, historical publications include B3 as well as B2. A
single global hardware selector prevents accidental comparison; parallel configuration must not be
inferred from accelerator count alone.
