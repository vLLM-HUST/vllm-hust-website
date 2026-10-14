# FrontierScience full-run handoff — 2026-10-13 UTC

The independent FrontierScience section on dataset-validation.html reports the completed
Qwen3.5-35B-A3B run: Olympiad 57/100; Research 5/60 at score >=7; Research mean 2.530877 over 57
valid scores. The separate bench completed 160/160 with output throughput 555.663817 token/s, mean
TTFT 33954.699772 ms and mean TPOT 26.662730 ms.

The page provides track/subject details, valid-score distribution, solver/judge truncation and
invalid-grade counts, and a prominent panel of 18 verified runtime values. It loads independently of
the validation-service matrix and the earlier MMLU-Pro section.

## Boundaries

Official Appendix B prompts, same Qwen solver and judge, one trial and local first-complete-VERDICT
extraction. Invalid judge results remain in the full denominator as nonsuccess. The numeric Research
mean excludes missing grades. Audit flags are nonexhaustive and require human review. This is not
official leaderboard replication or V5.5 acceptance; no B1 or improvement is claimed.

Solver/judge concurrency is 1, max output 16384/8192, temperature 0, seed 17, thinking off. Bench
uses 160 prompts, output cap 256, request-rate infinity, temperature 0, seed 0, server-default chat
template. Bench TTFT includes queue effects.

The existing service continued after smoke; startup evidence was copied and process arguments
rechecked. Full weight hashes and image digest are unavailable. Eleven small model files were
checked. The component displays actual verified runtime values only.

## Import and verification

Input is the public report directory from the benchmark repository:
reports/frontierscience-qwen35-b0-precheck-20261013.

```bash
python3 scripts/import_frontierscience_handoff.py /path/to/benchmark/report
node --test tests/frontierscience_handoff.test.cjs
```

The importer preserves report bytes and creates a public runtime projection. The manifest.json
records published-file hashes and original result/evidence/contract binding. Gzip downloads preserve
the exact original result-table and MANIFEST bytes; tests decompress and check their original
hashes. No prompts, answers, server environment dumps or host paths are published on the website.

The original result-table SHA-256 is
f2d855f4f245ada52fa03408f8fa1f092a34ae870c95c029dc0a068cace9990b. The original manifest SHA-256 is
ae99f3a1f7a453b8aa19fd7bc71d9e0c3c923efbc2ca862258f0357559c4359b. SHA-256 verifies file consistency,
not authenticity, scientific correctness or acceptance.

References: website PRs #427/#429 supplied layout/evidence precedent; benchmark PR #277 supplied
evidence packaging precedent. Scores, subject schema and scoring definitions are FrontierScience's
own results. Raw server commands and selected startup evidence are in the benchmark report archive.
