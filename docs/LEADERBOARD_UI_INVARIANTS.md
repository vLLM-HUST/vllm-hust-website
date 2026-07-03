# Leaderboard UI Invariants

This file records non-negotiable leaderboard display rules. Keep it in sync with
`assets/leaderboard.js` and tests.

## Overview Cards

- The top overview cards must never show averages across workloads, precision modes, models,
  hardware, or settings.
- Each overview card metric must come from one concrete benchmark row.
- When multiple complete compare scopes are visible, choose exactly one scope: the scope where the
  best visible `vllm-hust` row has the largest throughput improvement over the matching official
  `vllm` `0.18.0` row.
- The selected scope must stay aligned across both cards: same workload, model, hardware, chip
  count, node count, precision, and setting signature.
- Row counts may describe coverage, but metric values must remain sample values from the selected
  scope.

## Hardware And Precision Labels

- Hardware and precision labels must come from the benchmark artifact produced by the actual run.
- The website must not hard-code hardware labels such as `910B2` or `910B3`.
- The benchmark publication pipeline must reject public records whose artifact hardware or precision
  disagrees with the same-spec payload.
- Do not infer hardware from a file name, run id, branch name, or screenshot. Use same-spec/runtime
  metadata and validate before publishing.
