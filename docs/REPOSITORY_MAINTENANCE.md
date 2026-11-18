# Website repository maintenance

Use a local source workspace outside document synchronization folders. Browser reports, caches and
generated slides belong in the ignored `output/` and `screenshots/` directories.

## Published data and stored artifacts

[Benchmark website-publication](https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/main/website-publication)
owns the source data used by production Pages. Submit measurements, reports and publication metadata
there, with their original provenance. Website changes cover presentation, tests and maintenance
tools. Run data assembly before publication checks.

Existing root slides, evidence directories and tracked screenshots have historical consumers. Before
relocating an existing file, record its current path, fixed commit, SHA256 and inbound links, then
publish the exact bytes and a replacement entrypoint in benchmark. Verify those consumers before
retiring the old path. `.gitignore` prevents new local output from being added accidentally; already
tracked files need that explicit migration.

## Publication revisions

Edit `.github/benchmark-publication.toml` after reviewing the merged source commit. The publication
and visibility-policy commits are independently pinned. Regenerate the workflow references and
validate them together.

```sh
python scripts/update_benchmark_publication.py --write
python scripts/update_benchmark_publication.py --check
python -m pytest -q tests/test_pages_deployment.py tests/test_prepare_leaderboard_sync.py
```

CI enforces the manifest against the six production and browser consumers. The dataset navigation
script has separate pinned bytes and revisions. Update that navigation only when its source contract
changes.

## Leaderboard previews

The scheduled preview workflow consumes `leaderboard-data/snapshots`, validates the fixed target
bindings and retains an Actions artifact. The production workflow consumes the reviewed
`website-publication` commit and deploys its public projection. Check the workflow name and step
before interpreting a failure.

A target-bound baseline uses the registered baseline engine and version. The candidate uses its
recorded `vllm-hust` version. Model identity, hardware and semantic client/server parameters remain
target checks. Runtime transport overrides follow benchmark's `same_spec.py`.

To reproduce a preview admission check against an exact local benchmark checkout, use the same
arguments as `.github/workflows/sync-leaderboard-data.yml`. Keep preview output outside `data/`
until running the explicit assembly or preview synchronization step.
