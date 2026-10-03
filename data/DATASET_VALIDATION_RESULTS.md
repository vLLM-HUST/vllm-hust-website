# Dataset Validation Results

The website consumes results produced by the independent fixed-machine dataset validation service.
It does not start evaluation jobs, apply merge gates, publish to Hugging Face, or read the retired
benchmark CI workflows.

## Contract

The first frontend contract is `dataset-validation-v1`. A result document contains:

- `source`: producer service, source repository, commit, run id, and an optional immutable artifact
  URL;
- `baseline`: the B0 reference identity used for comparison;
- `scenario`: model, hardware, precision, and scenario identity;
- `datasets` and `metrics`: the declared matrix dimensions;
- `results`: zero or more cells keyed by `dataset_id` and `metric_id`.

Each result cell may provide `status` (`not_tested`, `baseline_only`, `queued`, `running`, `passed`,
`failed`, or `not_applicable`), `value`, `baseline_value`, `delta_pct`, `unit`, `updated_at`, and a
`provenance` object. Missing cells are rendered as `not_tested`; this makes an empty run explicit
instead of presenting zeros as measurements.

`baseline_only` is used when an evidenced B0 value exists but no matching B1 candidate has been
selected. B0 is fixed for the scenario. B1 is selected independently for each dataset/metric cell
from the best compliant measured result; a single B1 engine version is not required. Every populated
B1 cell must retain its exact engine versions and evidence in `provenance`, and must match the B0
model, hardware, precision, workload, and measurement definition.

The production `dataset_validation_v1.b0.json` imports the B0 screenshots supplied in the Home
archive. Its archive SHA-256 and screenshot path are retained per cell. Preparation instructions are
not measurements: datasets without a benchmark-result screenshot remain `not_tested`.

`candidate_search` records each completed B1 evidence audit. A near match is not a B1 value: changes
to model, hardware, precision, dataset materialization, endpoint, arrival policy, execution mode, or
metric definition make the result ineligible for the corresponding cell. The 2026-10-03 audit covers
the benchmark snapshots, result-bearing remote branches, A1-A4 handoff, and evidence already
published by the Plugin page. The vSpec raw artifacts provide 12 eligible B1 cells across GSM8K and
ARC-Easy: request, output-token and total-token throughput, mean TTFT, mean TPOT, and request
success rate. Each cell retains the vSpec repository revision, engine revision, raw artifact, model,
hardware, precision, endpoint, request count, and arrival policy.

Output-token throughput is a separate metric from total-token throughput. The Home workbook supplies
the B0 output-token values for all 28 evidenced B0 datasets. GSM8K has a vSpec B1 measurement but no
measured B0 value in the Home archive or workbook, so its B0 side remains empty. The available
ShareGPT and Sonnet results still use different online/offline or arrival contracts, while the
available InstructCoder result also uses the Coder model. Those near matches remain in their
original leaderboard contexts and are not copied into this matrix.

The checked-in `data/dataset_validation_v1.empty.json` file is a schema-shaped empty fixture for
local UI development. It is not a benchmark result and must be replaced by a signed or otherwise
authenticated service artifact before production ingestion is enabled. For visual smoke testing
only, opening the page with `?demo=1` overlays the fixture's `_demo_results` and shows B0/B1
comparison colors; this private fixture field is not part of the production contract.

## Integration boundary

When the service contract is finalized, set `window.vllmHustDatasetValidationConfig.dataUrl` to the
published artifact and update the authentication/provenance policy in
`assets/dataset-validation.js`. The adapter rejects unknown statuses, dimensions, and duplicate
cells. Keep it independent from `leaderboard_v1` and retain the empty, loading, error, and
stale-source states.
