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

TP2 retains vLLM 0.25.1 / vLLM-Ascend 0.25.1rc1 and the original graph/capacity settings. Eight-chip
configurations retain vLLM 0.23.0 / vLLM-Ascend 0.23.0rc1. Exact source revisions, worker/MOD
activation, hardware allocation, host, parallelism, MTP and memory settings are included in the
point download. The capacity16 native and BetterScale arms retain their individually tuned 24.25 and
20.25 GiB KV budgets per chip; this is **not an equal-KV ablation**.

The configured context capacity is 262,144 tokens. The eight complete prepared session shapes end
between 15,494 and 141,269 tokens; individual short windows may stop earlier. Each point records its
observed maximum prompt length. These measurements do **not** establish performance at a full 256K
prompt.

These are shared-host single observations, not confidence intervals, certified peak capacity, or
answer-quality results. A finite window reaches different turn/context mixtures at different speeds
and concurrency levels. The original native C16 functional caveats remain in the configurations;
performance success does not resolve them. Compare paired settings within this workload, and retain
host, capacity and request-mix differences when interpreting the envelope.

## Published evidence

[`leaderboard_frontier_swe_evidence.json`](../data/leaderboard_frontier_swe_evidence.json) contains
the run summaries, sanitized client configurations and metric extracts used by the chart. The
chart's point download preserves the complete public configuration and comparison contract. Full
generated-token logs, hardware admission records, server counters and source capsules remain with
the measurement owner; the public extract does not claim to include those private artifacts.
