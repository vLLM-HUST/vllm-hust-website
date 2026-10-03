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
