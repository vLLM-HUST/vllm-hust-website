# Dataset matrix v1

`dataset-matrix-v1.html` is an additive entry under Performance data. The original
`dataset-validation.html` and its canonical validation snapshots remain unchanged.

The overview compares task quality: dataset/split rows, solution columns. Dataset links switch to
load-test rows for that dataset. The current cohort is Qwen3.5-35B-A3B BF16 on Ascend 910B2 TP2. Do
not mix other model/hardware/precision cohorts into these cells. Each solution currently has one
observation per workload; future repeats need explicit selection/rows, not silent replacement.

The implementation reuses `leaderboard-runs.css` and the pure `selectRows` sorter from
`leaderboard-runs-model.js`; it does not initialize the main leaderboard controller or fetch its
large snapshots. Hash navigation supports direct links and browser Back. Sort and solution filters
survive view/language switches; reset clears the current detail view. Configuration, protocol,
scoring audit and source reports are expandable; record downloads preserve unrounded metrics.

## Data updates

Run `python scripts/build_dataset_matrix.py` after updating the existing public report imports. To
import the published BetterScale report for the first time:

```sh
python scripts/build_dataset_matrix.py --benchmark ../vllm-hust-benchmark
```

Only its public `report.json` is copied, byte-for-byte after checking the publication checksum. The
generated `data/dataset-matrix-v1.json` binds all consumed local reports by SHA256 and links
BetterScale's immutable benchmark publication commit. No private archives, questions or answers are
read or published. The existing baseline report imports retain their own manifests.

The canonical six-hour leaderboard sync does **not** import `reports/`; this projection must be
rebuilt explicitly when measured-report imports change. Bump the matrix data/script/style URL
versions on publication. This is a measured-results view, not formal V5.5 acceptance.

## Scope that must survive layout changes

- MMLU-Pro accuracy uses all 12,032 questions. Accuracy-client timing is not load-test timing.
- FrontierScience has separate Olympiad and Research quality scores. Research uses score ≥ 7;
  numeric mean over valid grades remains in the audit. There is one combined 160-request load test
  per solution, not independent track performance. Never duplicate it as separate track
  measurements.
- HLE Gold and Revision retain all selected questions in the denominator. Text/image performance
  tests remain separate; do not pool throughput or match full-subset accuracy to a modality score.
  BetterScale has no HLE result in this publication. Missing is not zero. Uncertain is unmeasured.
- Same-model Qwen judging is not official leaderboard judging. Unresolved grades are nonsuccess in
  the displayed denominator, not confirmed incorrect responses.
- Configurations/donor runtimes differ; these single runs do not isolate a single optimization.
  BetterScale MMLU load testing overlapped the other TP2 pair's Frontier judging. Frontier load
  testing followed MMLU release. Performance is output throughput, not SLO-qualified goodput.

## Checks

```sh
python -m pytest tests/test_dataset_matrix.py
python -m http.server 8786 --bind 127.0.0.1
python scripts/verify_dataset_matrix_browser.py --url http://127.0.0.1:8786
```

The browser check uses actual bundled reports, desktop/mobile EN/ZH, light/dark palettes, hash
navigation, numeric sorting, missing values, solution filters, evidence expansion, downloads and
viewport containment. Screenshots belong in local QA output, not published site assets.
