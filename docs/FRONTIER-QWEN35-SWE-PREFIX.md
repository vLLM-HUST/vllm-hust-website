# Qwen3.5 SWE prefix-reuse smoke measurements

These observations replay SWE-shaped multi-turn sessions with
[swe-prefix-reuse](https://github.com/vLLM-HUST/swe-prefix-reuse), not AgentX. Select **SWE prefix
reuse · 15 min smoke** on the
[Frontier page](https://vllm-hust.sage.org.ai/leaderboard-runs.html#frontier). Historical AgentX
observations remain under their original workload. They are not repeats of this experiment and their
numerical differences are not MOD speedups.

## Fixed workload, real continuation

The bundled workload contains eight complete trajectories (360 assistant turns) from NVIDIA
Open-SWE-Traces. The prepared workload, tokenizer fingerprint, source revision and measurement-tool
revision are recorded in each downloadable configuration and the workload contract.

For each turn, the client appends the next original input segment to the **actual token IDs
generated so far**. It does not restore the original assistant answer, retokenize generated text, or
rerender earlier history. Each turn has a fixed source-derived output-token budget. Generation is
greedy with EOS ignored until that budget is met. Qwen3.5's thinking-enabled template is used;
structural closing delimiters belong to the subsequent fixed input, not the answer budget.

At concurrency C, C sequential request lanes are continuously replenished from a cyclic
whole-session queue. There are no recorded human/tool think-time waits. Each lane has at most one
in-flight request. A new session play gets a unique cache salt and sticky routing identity; both
persist across its turns. This measures within-session prefix reuse, not cross-session common-prefix
sharing. Full client concurrency is an observed load property, not proof that every lane is decoding
on the accelerator simultaneously.

## Timing and acceptance

Each point is one **900-second smoke window**, following a separate short protocol/prefix-cache
qualification. Measured sessions use fresh salts and no primers: their KV is cold, but server
kernels have already warmed up. Only already in-flight requests drain after the window; drained
tokens receive no throughput credit.

- **Y:** actual output tokens received inside the window / 900 / **all allocated chips**, including
  separately allocated expert chips.
- **X:** P90 of per-request `(output tokens - 1) / (last-token time - first-token time)` for
  requests fully completed inside the window. This is not the inverse of P90 TPOT. Token times
  reflect the server's grouped streaming chunks.
- TTFT starts at request dispatch and ends at the first token-bearing chunk; end-to-end latency ends
  at the last token-bearing chunk.
- Prompt-ID echo, exact output-token budget, usage and stream completion checks must pass. Failed
  requests invalidate the run rather than being silently excluded. Prefix reuse and owned-server
  cleanup are checked before import.

MTP-enabled points use **real draft acceptance/rejection**, never the historical forced acceptance
length. MTP-off points remain off. Real model output is used for performance measurement, not
evaluated as a correct SWE answer.

## Configurations and interpretation

The campaign remeasures the 16 previously published configurations serially: two legacy max-seqs8
TP2/C4 points, nine capacity16 TP2 concurrency points, and five eight-chip C64 topologies. Only
completed, validated observations are added; absence means pending or invalid, not zero performance.

TP2 retains vLLM 0.25.1 / vLLM-Ascend 0.25.1rc1 and the original graph/capacity settings. The
historical MTP-off eight-chip configurations retain vLLM 0.23.0 / vLLM-Ascend 0.23.0rc1; the new
real-MTP2 expert/control campaign below uses the pinned 0.25.1 / 0.25.1rc1 runtime. Exact source
revisions, worker/MOD activation, hardware allocation, host, parallelism, MTP and memory settings
are included in the point download. The capacity16 native and BetterScale arms retain their
individually tuned 24.25 and 20.25 GiB KV budgets per chip; this is **not an equal-KV ablation**.

The configured context capacity is 262,144 tokens. The eight complete prepared session shapes end
between 15,494 and 141,269 tokens; individual short windows may stop earlier. Each point records its
observed maximum prompt length. These measurements do **not** establish performance at a full 256K
prompt.

These are shared-host single observations, not confidence intervals, certified peak capacity, or
answer-quality results. A finite window reaches different turn/context mixtures at different speeds
and concurrency levels. The original native C16 functional caveats remain in the configurations;
performance success does not resolve them. Compare paired settings within this workload, and retain
host, capacity and request-mix differences when interpreting the envelope.

The requested C32 capacity extensions raise the server limit to 32 while retaining the original
arm-specific KV budget. They must first pass a short C32 load/capacity check. This is a different
serving configuration: successful C32 observations stay separate from the capacity16 concurrency
lines, not silently joined to them. A failed capacity probe supplies no Frontier score and does not
invalidate completed capacity16 observations.

## Published evidence

The Frontier main chart directly connects each capacity16 concurrency series with a solid line and C
labels. The dashed Pareto envelope is a different, cross-point projection; it must not be mistaken
for a fixed-configuration concurrency sweep.

The **Concurrency curves** link opens the
[capacity16 speed-throughput plot](../assets/frontier-qwen35-swe-concurrency.svg). Each line
connects measured concurrency levels for one fixed serving configuration, not the combined Pareto
envelope. Native and BetterScale are separate series; the legacy max-seqs8 C4 points and eight-chip
topologies do not belong on these lines. The renderer checks that the serving settings remain
constant within a series. Regenerate it after importing results with
`python scripts/render_swe_frontier_curves.py`.

The first native capacity sweep completed C1/C2/C4/C8 successfully. Its C16 window was interrupted
by the selected-card foreign-owner guard and is excluded. The last retained run completed its drain
at 09:12:12 UTC on 2026-09-24; the foreign process was observed at 09:23:11 UTC, during C16. Earlier
completed windows are retained with that deployment note, and C16 was remeasured separately rather
than filling its missing result with the interrupted window. Actual device selection remains
recorded in each point's download. The clean C16 rerun on local cards 2/3 passed all request checks
and owned-resource cleanup.

[`leaderboard_frontier_swe_evidence.json`](../data/leaderboard_frontier_swe_evidence.json) contains
the run summaries, sanitized client configurations and metric extracts used by the chart. The
chart's point download preserves the complete public configuration and comparison contract. Full
generated-token logs, hardware admission records, server counters and source capsules remain with
the measurement owner; the public extract does not claim to include those private artifacts.

## Native C32 capacity and graph coverage

The native extensions retain the same 24.25 GiB/chip KV budget. Both C32 windows completed 900
seconds with zero request failures and zero preemptions, observing 32 running requests. They reached
a maximum prompt of 40,244 tokens; this is not proof that 32 full-256K contexts fit simultaneously.

| Server limit | Client C | Graph capture maximum         | Output tokens/s/chip | Decode P90 tokens/s |
| ------------ | -------- | ----------------------------- | -------------------: | ------------------: |
| 16           | 16       | 48 tokens                     |               221.95 |               38.93 |
| 32           | 32       | 48 tokens (untuned extension) |               135.53 |                9.72 |
| 32           | 32       | 96 tokens                     |               207.88 |               21.01 |

Raising the server limit alone retained a capture maximum of 48 tokens. A full 32-lane MTP2 decode
batch needs 96 tokens; the pinned dispatcher's explicit rule returns no-graph execution above its
capture maximum. The second extension adds 96 to the capture sizes. It restores eligible full-batch
decode coverage, not full-graph coverage for all larger mixed-prefill batches.

Peak observed KV usage was 61.8% for the original-capture C32 probe and 65.1% for the
expanded-capture observation. The latter performed better, but still did not beat the C16 window on
either coordinate. These are single shared-host windows with different reached request mixtures, not
repeated estimates of the causal contribution of graph capture. Capacity and useful throughput are
different questions; increasing concurrency need not improve either coordinate.

Both C32 points remain visible with their exact configurations. Neither joins the server-limit16
concurrency line. The initial slower observation is retained, not silently replaced or described as
a tuned 32-slot baseline.

The BetterScale server32 attempt was rejected before model initialization: the pinned capacity16
adapter admits only16 requests, with matching fixed GDN/FIA metadata and draft-padding layouts. This
is an unsupported adapter configuration, not an observed out-of-memory result. It supplies no
benchmark point; the published BetterScale capacity16 sweep is unchanged.

## Repaired MTP2 expert separation: eight-chip C64

The four completed hw0 observations use the same prepared inputs, real MTP2, 32 GiB KV per chip,
query budget 4096, native FULL decode graphs and asynchronous scheduling. Both separated and native
EP controls include the qualified MTP feedback ownership correction: the previous-step D2H receipt
has a private host mailbox, isolated from input-batch row reordering. This is a shared correctness
bridge applied to all four configurations, not the separated-expert performance treatment.

| Configuration          | Output tokens/s/chip | Decode speed P90 (tokens/s/request) | TTFT P95 (s) |
| ---------------------- | -------------------: | ----------------------------------: | -----------: |
| A4E4                   |               143.19 |                               25.81 |         4.47 |
| A6E2                   |               132.39 |                               20.44 |         2.85 |
| DP8EP8                 |                93.34 |                               16.74 |         3.28 |
| TP8EP8 (32 live slots) |                65.06 |                               25.80 |        52.66 |

Every point completed 900 measured seconds with zero request/protocol failures and clean
owned-resource release. Mean client-inflight occupancy was approximately 64. Native EP receipts
verify 32 local experts on each of 8 ranks and a complete, nonoverlapping 256-expert union at all 40
target layers plus the physical draft layer. DP8EP8 is **not eight independent replicas**. Separated
expert owners each use two directly launched resident kernels, no server graph and no host forward
RPC; every owner/source generation count agrees at drain. Expert chips are included in the
throughput denominator.

These are single observations: A4E4's measured output throughput is about 8% higher than A6E2, while
A6E2 has lower TTFT P95. A6E2 is about 42% above DP8EP8 in this window. Actual MTP acceptance
lengths are close (about 2.87–2.89); they are not a forced calibration. Server-side prefix-cache
hits are positive on all arms. Acceptance/cache ratios in the downloads cover the server lifetime
including the HTTP gate and drain, not just the measured window.

**TP8EP8 is capacity-limited here:** its single engine admits 32 active requests against 64 client
lanes. The separated/DP arms have 32 slots per attention engine. The follow-up with 64 TP8 slots was
cancelled before worker launch; no result is inferred. Do not describe the retained 32-slot point as
a tuned TP8 optimum. All four table entries were completed before the campaign stopped.

The new runs reached at most 30K–51K prompt tokens, not 141K or 256K; reached turns and session
counts remain in the evidence. These fixed-shape measurements use actual generated IDs but do not
score SWE solving or certify semantic quality. No partially cancelled AgentX or TP8 capacity run is
admitted.

The new prepared file has a different SHA because tokenizer path/version metadata uses Transformers
5.14.1 rather than 5.17.0. Direct structural comparison proves identical source/policy/session
ordering, all 360 input-token segments and output budgets, and identical tokenizer fingerprint. Both
exact file hashes are retained in the contract and per-point evidence. Client 0.1.0 uses a
cache-salt-aware relay; client 0.1.1 adds an equal-valued correlation header. Session affinity is
identical, while exact tool/transport versions remain disclosed rather than rewritten.
