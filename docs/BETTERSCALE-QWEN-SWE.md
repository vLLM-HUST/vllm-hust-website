# BetterScale: Qwen3.8-27B SWE-trace serving study

This study measures HTTP inference serving, **not SWE-bench task-solving accuracy**. It is separate
from the DeepSeek V4 TP8/DP8 results on the same project page.

## Matched comparison

- Qwen3.8-27B, BF16, TP2 on the same two Ascend 910B2 devices connected by HCCS. Its configuration
  uses the `qwen3_5` / `qwen3_5_text` architecture: 64 layers, 48 GDN layers and 16 full-attention
  layers. The architecture field is not a claim that the checkpoint has a different release name.
- Baseline: the pinned native vLLM Ascend NPUWorker, with its effective `FULL_AND_PIECEWISE` graph
  configuration. This is not an intentionally eager-only baseline. Candidate:
  `betterscale.qwen_worker.MixedWorker` with elastic mixed FULL graphs and alternating metadata
  banks.
- **Native AIV communication is enabled in both arms.** The MOD does not take credit for this
  existing native switch. Native task queue is enabled for the baseline; the candidate's qualified
  raw ACL path requires `TASK_QUEUE_ENABLE=0`.
- Both arms: asynchronous request scheduling, no MTP, prefix caching enabled, eight request seats,
  2,048 scheduled tokens, 8,192-token context limit and 6 GiB KV cache per rank. CPU binding is
  disabled. Other shared-host CPU workloads are not isolated.
- Same-pair ABBA: baseline, candidate, candidate, baseline. Both repetitions run all four
  concurrency limits. First repetition: C1, C2, C4, C8; second: C8, C4, C2, C1. Each limit means at
  most that many concurrent sessions, not a smaller selected workload. Each session has at most one
  outstanding request.
- Load, compilation, graph capture and the same eight-request, 16-output-token warmup are excluded.
  No profiler or state oracle is enabled during timing. Candidate graph-bank priming occurs at
  startup, not inside the measured cohort. The prefix cache is cleared after warmup and before each
  cohort; reuse within that cohort remains enabled. Responses record actual cached prompt tokens.

## Workload and attribution

The source is [NVIDIA Open-SWE-Traces](https://huggingface.co/datasets/nvidia/Open-SWE-Traces),
revision `fb0c0dccc7a5cce79b3f6de891848acdede36685`, licensed CC-BY-4.0. The retained subset is
`data/minisweagent/qwen38_27b`. The preparation selected 8 complete trajectories after scanning
15,525 records, subject to 2–12 assistant calls, an 8,192-token input-plus-output limit for every
call, and at most 8,192 output tokens per trajectory. No selected trajectory is truncated.

Every cohort replays the same 78 requests and 20,648 output tokens. Prompts span 1,472–7,874 tokens.
The model's own tokenizer and chat template render recorded messages; JSON-string tool arguments are
parsed into mappings when the template requires them. Output budgets come from the independently
tokenized, complete serialized assistant suffix. `ignore_eos` fixes the requested output work.

Tools are never executed; tool waiting time is zero. The next turn is submitted when the prior
request completes, using the **original recorded history**, not the candidate's newly generated
text. There is no recorded arrival-time replay. Consequently this is a bounded, closed-loop
inference workload, not a reproduced agent run or a representative sample of all SWE traffic.

## Reading the measurements

- Aggregate output throughput = completed output tokens / complete cohort wall time. The pooled
  two-repeat value divides total tokens by total elapsed time; it is not the arithmetic mean of the
  two throughput values.
- TTFT is time to the first nonempty HTTP SSE content event. It is not a device kernel measurement.
  Request latency ends when the terminal response is read.
- HTTP TPOT = (request latency − TTFT) / (output tokens − 1). Reported mean and p95 summarize these
  per-request averages, **not individual token gaps**. SSE events can contain more than one token.
- Percentiles select the nearest observed value at index `round((n−1)q)` in the sorted observations.
  Cohort completion includes client-side session queuing; per-request TTFT begins only when that
  request is submitted.
- Keep both repetitions visible. Two ABBA observations are not a statistical confidence interval or
  a universal throughput guarantee. Results do not establish performance with MTP, longer contexts,
  other models, or higher server seat counts.

## Implementation and reproduction

APC-enabled numerical implementation:
[`4d08136`](https://github.com/vLLM-HUST/BetterScale/tree/4d08136163b1f3751ac5dfb622e2007f1fecd023).
This opt-in Qwen entry is separate from the DSV4 Worker. It owns the GDN state layout and mixed
full-graph execution, shares one native FIA host plan per wave, and primes every captured bank
before traffic. It still uses native graph replay and native HCCL; it does not replace attention
arithmetic or implement a new collective transport.

Runtime pins: vLLM `752a3a504485790a2e8491cacbb35c137339ad34`, vLLM Ascend
`9bf964cb4b87c8cd0d6852c41a55b3c29711fa95`, CANN 9.0.1, Torch 2.10.0, Torch-NPU 2.10.0.post2 and
Transformers 5.14.1. Native host/kernel artifacts are content-qualified. The source checkout, build
instructions and explicit preload requirements apply; these Qwen results do **not** claim
availability in the page's older DSV4 PyPI installation command.

## September 18 results

The [complete measurement snapshot](../data/betterscale-qwen-swe.json) retains all sixteen
arm/repeat/concurrency cohorts and the pooled values. The same physical pair ran baseline →
candidate → candidate → baseline. Both arms completed every requested token budget with prefix
caching enabled.

| Concurrent sessions | Native output tokens/s | BetterScale output tokens/s |    Gain |
| ------------------- | ---------------------: | --------------------------: | ------: |
| 1                   |                  30.23 |                       34.21 | +13.15% |
| 2                   |                  51.71 |                       59.41 | +14.89% |
| 4                   |                  86.03 |                      101.38 | +17.85% |
| 8                   |                 122.78 |                      149.01 | +21.36% |

Both arms reused 247,296 prompt tokens per C1/C2/C4 cohort (69.0%) and 238,080 per C8 cohort
(66.4%). Native C8 observations were 119.74 and 125.99 output tokens/s; candidate observations were
149.06 and 148.97. Both observations remain visible rather than selecting one favorable baseline.
Means and p95 for HTTP TTFT and TPOT improved at each tested concurrency.

APC correctness is a separate diagnostic 1 GiB-KV experiment, `apc-align-service3`: 68 graph/eager
rank-steps, 8,772 hidden/cache checks, maximum absolute difference 0. Three cold/warm pairs reused
1536/1536/3072 tokens; eight shared-prefix branches each reused 1536 tokens. Their greedy
eight-token output matched independent cold requests. This is bounded state/reuse evidence, not a
language-quality or SWE task-solving evaluation.
