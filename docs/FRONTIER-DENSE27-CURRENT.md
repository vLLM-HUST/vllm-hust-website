# Qwen3.8-27B: current State serving (October 9, 2026)

These are new 900-second SWE Prefix Reuse observations using BetterScale's current resident-State,
streaming incremental backup, backed-history partial eviction, capacity-ready priority recovery and
Balanced FlashDecode. The earlier October9 `96cd03a` dense reconstruction used native whole-request
preemption; it is not the current implementation and is not imported as this campaign.

## Measurement

| Concurrency | Output tok/s/card | P90 decode tok/s/user | TTFT P95 (s) | Completed requests |
| ----------- | ----------------: | --------------------: | -----------: | -----------------: |
| C1          |             35.39 |                 83.85 |        0.582 |                120 |
| C2          |             69.08 |                 78.90 |        0.911 |                188 |
| C4          |            114.43 |                 68.07 |        0.940 |                340 |
| C8          |            178.72 |                 53.78 |        1.025 |                510 |
| C12         |            218.27 |                 43.61 |        1.113 |                651 |
| C16         |            249.06 |                 37.39 |        1.313 |                730 |

Each point is one complete observation, not a pooled repeat or an isolated-feature A/B. TP2 uses two
Ascend910B2 cards; every allocated card remains in the throughput denominator. E16/R20, MTP2,
FULL4096, BF16, 262144-token configured context, automatic HBM utilization0.95 and8GiB Host cache
per rank are fixed across C1/C2/C4/C8/C12/C16. C13/C14 were cancelled and are not scored or
displayed. C8 and C16 use disjoint physical pairs with partially overlapping execution; C12 reuses
C8's released pair. The later C1/C4 windows also overlap on disjoint pairs; C2 follows C1 on its
released pair. These three additions reuse the same qualified frozen source and native libraries,
not the in-progress TP4 extension. Balanced attention is enabled, but the single-request native
dispatch remains intentional; an enable flag does not mean every step uses the balanced kernel.

The client uses the same eight SWE source sessions and model-tokenized budgets, continuous request
lanes and D1 session rotation. A separate60-second C2 warmup precedes each measured window; measured
plays start with fresh salts. Actual generated token IDs form each continuation. Throughput counts
only streamed output received inside900seconds; in-flight drain is excluded. P90 decode speed is the
request statistic, not inverse P90 TPOT. This is a smoke workload, not general model quality, a
cloud SLO or a guaranteed saturation rate.

The downloaded official `Qwen/Qwen3.8-27B` checkpoint's complete file identity is retained in each
qualification receipt. It is not claimed byte-identical to the deleted historical local checkpoint.
[Prepared-workload equivalence](evidence/dense27-current-20261009/workload-equivalence.json)
recovers the historical prepared-file SHA by replacing only tokenizer path and Transformers-version
metadata; every other byte, including sessions, deltas and output budgets, is unchanged. The
executed client `src` and `pyproject.toml` were directly compared against SWE client commit
`6861242dbd9f17b707003191e4200b7752911d7c` with no differences.

## Current implementation and correctness

BetterScale base `e476263683186a8554fbc7e9dfad865cfd7a7482` plus the sealed Dense27 port reuses the
current State scheduler; it does not invent another model loop. Dense27 TP2 has48 GDN layers with24
local value heads and16 target attention layers plus one draft attention layer, each with Q12/KV2.
The attention planner schedules two six-Q-head KV groups per request. Scheduler pages contain1536
tokens, not35B's2048. Both target and draft use the admitted geometry.

The source was subsequently committed as `f55f4b5` on `codex/active-partial-reclaim`. The measured
qualification cut is independently archived: the final commit additionally contains fail-closed
admission guards and documentation, rather than claiming every measured file was already that
commit. Runtime pins remain vLLM752a3a5, Ascend9bf964c, CANN9.0.1 and torch-npu2.10post2. No PyPI
release or CANN9.1 Dense27 qualification is implied.

- Independent Dense GDN gates cover mixed512, mixed4096 and decode48, changing banks, request roles
  and accepted lengths, with full State/conv pools checked. Qwen35 geometry regression also passes.
- Balanced attention covers five Q12/KV2 length patterns, dynamic lengths, replay banks, CPU/native
  references and guard checks; original Q8/KV1 regression passes.
- Forced E4/R6/22-page pressure reclaims and restores two already-backed history pages without
  whole-request preemption. Both ranks check34 KV tensors and106,954,752 restored bytes exactly. The
  victim resumes at computed7607. Warm continuation hits8448 cached tokens versus cold0 and produces
  the identical seven-token marker answer. Byte-audit instrumentation makes this a correctness
  fixture, not a throughput score.
- Each timed deployment passes16 concurrent exact-marker retrievals before and16 after its measured
  window. All measured requests pass the client's prompt, output-budget, usage and completion
  checks. Selected-card ownership is monitored continuously; owned servers exit0 and each physical
  pair passes idle-release checks.

## What the timed scheduler actually did

| Concurrency | Queued seal / store / load | Active partial evictions | Peak sampled KV usage | Mixed / decode steps (rank0) |
| ----------- | -------------------------: | -----------------------: | --------------------: | ---------------------------: |
| C1          |                 70 / 5 / 0 |                        0 |                25.15% |                    0 / 22914 |
| C2          |                 75 / 7 / 0 |                        0 |                39.18% |                  188 / 22555 |
| C4          |               164 / 12 / 0 |                        0 |                60.62% |                  343 / 18573 |
| C8          |               637 / 18 / 0 |                        0 |                71.54% |                  510 / 14158 |
| C12         |               856 / 29 / 6 |                        0 |                73.49% |                  637 / 11256 |
| C16         |              700 / 72 / 52 |                        0 |                86.74% |                   714 / 9551 |

Counts refer to the900-second window. `seal` is proactive completed-history-page backup; `store` is
resident checkpoint backup; `load` restores cached state. These are operations, not necessarily
single pages. Queued and completed counts can differ at the window boundary. Read-only buffered host
observers introduce no per-step device synchronization. Full lifecycle traces and per-rank dispatch
records are retained; they do not replace the separate byte-equality qualification.

Zero active partial evictions in a timed run means that run does **not** demonstrate a
partial-victim speedup. Likewise, the overall difference from the old reconstruction cannot be
assigned entirely to one feature. The new source combines more efficient state ownership,
asynchronous cache turnover and balanced attention. Step counts describe dispatch mix, not device
execution time; do not directly use the mixed/decode ratio as a prefill/decode rank allocation
ratio.

## Business accounting and evidence

Serving Plan selects the highest-throughput complete observation among these six settings, not a
global optimum. Its new-input, cached-input and output rates all use the **same successful requests
completed within900seconds**, excluding drain and incomplete-request output. That business ledger
intentionally differs from the chart's streamed-output-window rate. Costs remain user inputs; API
prices are the already documented model-specific scenario assumptions, not realized revenue.

Compact per-run qualification, accounting and reproducible usage-only projections are under
`docs/evidence/dense27-current-20261009/c1`, `c2`, `c4`, `c8`, `c12` and `c16`. The Frontier
snapshot and SWE evidence extract preserve complete point/run joins. Historical points and
failed-native annotations remain unchanged; Pareto filtering decides which whole observations are
frontier vertices.

Full source/native qualification is retained outside Git as `qualification-evidence.tar.gz`, SHA256
`d87df056cbd5714edfbe40c28ced2fad124b25a2ee91d763d239e75665217735`. Raw request streams, observers,
server logs and cleanup receipts are preserved in separate per-concurrency campaign archives. Public
projections omit generated text and token arrays.

The later C1/C2/C4 raw archives are retained under the local `dense27-sweep-20261009` campaign, with
transfer-verified identities. C24/C32 and TP4 are not represented by these low-concurrency
observations; pending or interrupted launches are not scores.

## Display selection

At Fletcher’s request, the five dominated historical BetterScale observations (September24
C1/C2/C4/C8/C16) are now in `archived_points`, with their complete measurements and dominating point
IDs preserved. The six current-State points remain visible. Native reference points and other models
are unchanged; raw run evidence is not deleted. This is display curation across measured
configurations, not a matched-control speedup claim.
