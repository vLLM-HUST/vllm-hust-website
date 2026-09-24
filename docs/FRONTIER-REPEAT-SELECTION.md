# Identical-configuration BetterScale repeats

Fletcher selected best-of presentation on September24 to reduce repeat noise.
`scripts/curate_frontier_repeats.py` retains the complete valid measured run with highest output
tokens/s/chip, not a point assembled from separate metric maxima. Ties use stable point ID.
Downloads disclose the compared point IDs and repeat count; complete inferior points move to
`archived_points`. Metric evidence and raw benchmark artifacts remain intact.

The conservative grouping key is cohort, serving configuration, load and per-point
benchmark-protocol override. Existing observed prompt length/client occupancy fields, endpoint
port/model alias and historical import point ID are not configuration settings and do not split
repeats. All other fields stay strict. Different models, workloads, concurrency, source revisions,
topology, request limits, KV budgets or protocol settings do not silently merge. Native observations
and existing independently curated A+E experiments are unchanged. Missing axis metrics cannot win a
group.

This is an observed best-of selection, not an average, confidence interval or repeatability claim.
Inferior runs remain available for variance analysis. New optimized deployments have their own
fixed-configuration concurrency series; do not join them to an older capsule's curve merely because
both are BetterScale.

After additive point import and before snapshot publication:

```sh
python scripts/curate_frontier_repeats.py data/leaderboard_frontier.json
python -m pytest tests/test_frontier_repeat_selection.py
```

Always fetch/rebase concurrent publication changes additively; this helper is not authority to
replace another campaign's point inventory.
