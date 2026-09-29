# DeepSeek V4 Flash · INT8 · SWE prefix reuse

24 complete 900-second observations on one local eight-chip Ascend 910B2 host, 2026-09-27 UTC. Four
configurations cover client C1/2/4/8/16/32. All enable native DSpark K5 natural rejection and prefix
caching. No failed run is scored. The benchmark-setting model selector labels this checkpoint
**DeepSeek V4 Flash · INT8**.

## Measured throughput

Output tokens/s/chip; the denominator includes all eight allocated chips.

| Client C | Baseline TP8 | BetterScale TP8 | Baseline DP8EP8 | BetterScale DP8EP8 |
| -------: | -----------: | --------------: | --------------: | -----------------: |
|        1 |        8.542 |          12.559 |           8.296 |              9.653 |
|        2 |       16.898 |          22.736 |          15.164 |             17.285 |
|        4 |       28.612 |          41.275 |          24.009 |             26.997 |
|        8 |       28.741 |          42.814 |          35.391 |             41.561 |
|       16 |       28.560 |          41.850 |          40.309 |             57.102 |
|       32 |       29.150 |          42.190 |          35.442 |             49.292 |

[All throughput, TTFT and decode-speed curves](../assets/frontier-dsv4-swe-concurrency.svg). Every
completed plateau/regression point remains in the snapshot. The existing “Best trade-off points
only” checkbox can be unchecked to inspect them all. The compact view retains separate baseline/MOD
boundaries; the diagnostic curves retain fixed parallel configurations.

Both TP arms plateau from C4; C32 P95 TTFT reaches165.15/103.16s (baseline/BetterScale). DP peaks at
C16 in this sweep; C32 throughput falls12.1%/13.7%, while P95 TTFT rises from4.82/3.12s
to76.94/60.77s. All four C64 points were intentionally omitted after saturation review, not measured
failures. These are single-run observations, not statistical significance or an absolute hardware
ceiling.

## Controls and limits

- Checkpoint: `DeepSeek-V4-Flash-0731-w8a8`, Ascend W8A8 quantization with BF16 activation dtype.
  INT8 describes the quantized checkpoint, not BF16 weights. The local quantized weight artifact's
  upstream revision was not independently attested; the tokenizer/encoder identities are recorded
  separately.
- TP8/DP1/EP8 uses four total engine seats,4128 token budget and12GiB KV/rank. TP1/DP8/EP8 uses two
  seats/rank (16 total),1026 token budget and7GiB KV/rank. Client concurrency beyond these limits
  primarily queues. Same-topology arms have matched KV and seats; this is not separately tuned peak
  throughput.
- BetterScale uses frozen0.5.1 source; baseline uses FULL_DECODE_ONLY while BetterScale uses FULL.
  Baseline TP adds only the required K5 LCM startup bridge. Downloads retain actual source pins,
  graph sizes, worker names and commands.
- Same eight Open-SWE-Traces sessions /360 assistant turns as the existing SWE workload; DSV4 is
  compiled with its official Python encoder, not another model's template. Real generated IDs are
  appended before the next fixed source delta.
- Closed-loop sequential lanes, unique per-play cache salts, sticky lane-modulo-DP routing through
  the same byte-preserving relay in all four arms. Separate cache qualification and60s traffic
  precede fresh-salt measured sessions.
- Y counts only actual output tokens received within900s, divided by900 and8. X is P90
  `(N-1)/(last-first token time)` for completed in-window requests; SSE groups share receipt
  timestamps. Drain tokens receive no throughput credit.
- All24 pass exact prompt-ID echo, output-count/usage/length/DONE checks, zero request errors,
  positive cache and K5 draft/accept counter deltas, clean server exit and owned-resource release.
  Diagnostic counters include drain, unlike Y. Cold/warm generated-token equality is diagnostic, not
  a performance gate.
- Not SWE answer accuracy, exhaustive numerical equivalence or full256K stress certification.262144
  is configured context; actual reached prompt lengths and request mixes differ across finite-window
  observations and remain recorded.
- Hardware admission and ongoing foreign-owner guards protect shared capacity; hidden occupancy on
  already-owned cards is not fully attributable from this namespace. No local point was rejected by
  the guard. Earlier hw3 attempts and local preparation failures supply no scores here.

## Evidence and rebuild

[data/leaderboard_frontier_dsv4_evidence.json](../data/leaderboard_frontier_dsv4_evidence.json) is a
curated metric-only extract containing unchanged summaries, diagnostic counter deltas and acceptance
receipts. Private raw request streams, prompts, host paths and full logs are not published. No point
mixes best X and Y from different runs.

The measurement capsule is `dsv4-swe-frontier-20260927-local-v2`. To import into a snapshot that
does not yet contain this cohort:

```bash
python scripts/import_dsv4_frontier.py /path/to/dsv4-swe-frontier-20260927-local-v2
```

The importer validates all24 points and appends only this cohort/its records; existing cohorts,
withdrawals, archives and campaigns remain unchanged. Reimport fails rather than duplicating or
silently overwriting published points.
