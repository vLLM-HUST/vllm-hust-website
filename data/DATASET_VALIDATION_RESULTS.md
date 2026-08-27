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

Each result cell may provide `status` (`not_tested`, `queued`, `running`, `passed`, `failed`, or
`not_applicable`), `value`, `baseline_value`, `delta_pct`, `unit`, `updated_at`, and a `provenance`
object. Missing cells are rendered as `not_tested`; this makes an empty run explicit instead of
presenting zeros as measurements.

The checked-in `data/dataset_validation_v1.empty.json` file is a schema-shaped empty fixture for
local UI development. It is not a benchmark result and must be replaced by a signed or otherwise
authenticated service artifact before production ingestion is enabled.

## Integration boundary

When the service contract is finalized, update the loader URL and authentication/provenance policy
in `assets/dataset-validation.js`. Keep the adapter independent from `leaderboard_v1` and retain the
empty, loading, error, and stale-source states.
