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

Performance ordering belongs to the existing MOD catalog, with no separate results section. Admitted
gains sort descending, including negative gains; items without an admitted score follow and retain
the catalog compatibility/name ordering. Historical evidence alone grants no priority.
