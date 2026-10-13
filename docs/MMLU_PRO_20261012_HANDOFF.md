# MMLU-Pro, 2026-10-12 operator handoff

The dataset page shows this run in a separate, bilingual section between the designated dataset
program and the validation-service matrix. Four overview cards distinguish full-test accuracy from
load-test output throughput, mean TTFT and mean TPOT. Expandable details contain all 14 subjects,
output termination diagnostics, request contracts and downloadable summaries.

An always-expanded blue configuration panel immediately below the result cards displays the 18
actual values marked `verified` in `receipt/effective.reparse.json`. The public `runtime.json`
projects only each field's log-derived value and verification status; it omits expected values,
command arguments, API model paths and raw log snippets. This receipt was produced by a later
reparse of the saved startup log, not by a new measurement. The panel says so explicitly. The
manifest records the source receipt hash and the projected JSON hash; the projection also retains
the startup log hash and receipt timestamp. Unconfirmed fields are never presented as actual values.

This is an operator-supplied measurement, not a canonical validation-service publication or V5.5
admission. The generated scenario index, dataset program and historical matrix remain unchanged.
Their existing readiness statements describe the formal program; this handoff does not upgrade it.
The independent same-origin loader allows these results to display if the matrix source is unavailable.

## Data and provenance

Run: `mmlu-pro-b0-35b-v1-20261012T064318`, Qwen3.5-35B-A3B, B0, single lifecycle.

- Full test: 9,609 correct out of 12,032, or 79.86203457446809%.
- Performance: 200 completed requests, 442.8152399013184 output tokens/s,
  53,476.45447229035 ms mean TTFT, 31.91726063188239 ms mean TPOT.
- No paired B1 or repeat distribution; no improvement claim.

`data/mmlu-pro-20261012/manifest.json` records the source-relative filenames, original byte hashes,
and hashes of the published JSON (indentation and final newline normalized). Counts and values are
unchanged. Only aggregate summaries are included: no raw question/response bodies, server logs,
environment dumps, host addresses or model files. Hashes are integrity checks, not signatures.

Recreate from the original run directory:

```bash
python3 scripts/import_mmlu_pro_handoff.py /path/to/mmlu-pro-b0-35b-v1-20261012T064318
node --test tests/mmlu_pro_handoff.test.cjs
```

The accuracy report predates the load test and still records `bench: not run yet`. The later
`outputs/mmlu-pro.summary.json` supplies performance metrics. The UI preserves both sources and
explains their chronology rather than rewriting the original report.

## Interpretation

Accuracy uses frozen token IDs through `/v1/completions`, 5-shot prompts, thinking disabled,
temperature 0, seed 17, max tokens 2,048 and runtime concurrency 16. This legacy plan records
contract concurrency 1 and has no bound scorer hash. It is not an official leaderboard run.

The load test uses `/v1/chat/completions`, 200 requests, infinite arrival rate, output length 256,
temperature 0 and seed 0. Its TTFT must not be substituted for the accuracy-client mean of 0.593 s.

All questions remain in the accuracy denominator, including 56 invalid answers and 1,533
length-limited outputs. Of the latter, 1,287 used a last-standalone-letter fallback that can
misinterpret prose. Diagnostic subset accuracy does not replace the overall score.
