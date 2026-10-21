# Performance Data Publication

## Public Entries

- `leaderboard-runs.html`: performance curves, measured candidate comparisons, fixed-target
  contracts and version comparisons.
- `dataset-validation.html`: dataset scores, per-configuration B0/B1 measurements, supplementary
  evidence, and capability coverage.
- `serving-plan.html`: measured capacity, reference prices, user-supplied costs, and calculated
  API-equivalent value.

The former standalone fixed-target, matrix-v1 and coverage pages are removed, without redirects.
Their unique content remains within the three entries. Existing source receipts are not rewritten to
remove historical URLs.

## Source Contract

The benchmark repository's `website-publication/data/` is the canonical publication source for all
website `data/` files. Embedded original report and measurement provenance remains unchanged. A
publication snapshot is not itself proof that every experiment meets an acceptance contract.

Use `vllm-hust-benchmark/scripts/sync_website_publication.py` to publish a committed source
revision. It verifies that each source file matches that commit and generates
`data/benchmark-source-manifest.json`, recording source paths, SHA256 checksums and sizes. The
website's source panel links those exact committed files.

Do not hand-edit website measurements. Existing report generators must feed the benchmark
publication source before release. Regenerating any website artifact without updating its source and
manifest fails the publication regression test.

The initial byte-preserving source migration is merged in benchmark. The generated manifest pins the
exact merged commit and exposes commit-scoped source links. This establishes publication custody; it
does not claim that every historical measurement has completed methodological or provenance review.

## Release Order

1. Reconcile any measurements updated by ongoing report work into the benchmark publication source;
   verify embedded original provenance.
1. Commit and merge the benchmark publication source and sync tool.
1. Trigger `Deploy Pages From Benchmark` (`deploy-benchmark-pages.yml`) on website `main`, or send a
   `benchmark-publication` repository dispatch. Website code merges also trigger this workflow.
1. The workflow checks out benchmark `main`, resolves its exact commit, and runs
   `publish --revision <full-merged-commit>` into a temporary website checkout. It verifies the
   manifest and runs publication and presentation tests before uploading the Pages artifact.
1. Deploy that artifact with GitHub Pages Actions, without committing generated `data/` files or
   opening a website data PR. Pages must use the Actions build source, not legacy branch builds.
1. Compare production files against the generated manifest and inspect all three entries. The
   manifest's commit is the authoritative data version; website code and data commits may differ.

The `Prepare Benchmark Data Artifact` workflow is a preview-only diagnostic and does not deploy. Do
not bypass the website data-PR policy to publish generated files. Changes to benchmark data are
released through the deployment workflow above after merging the benchmark PR.

Tests for this migration verify navigation, preserved sections, unique DOM IDs, calculation behavior
and publication bytes. They do not substitute for a methodological audit of every historical
measurement or a fresh price quote.
