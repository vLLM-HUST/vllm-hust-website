# First-Phase Implementation Priorities And Validation Checklist

## Goal

This note turns the actual vLLM runtime and 9-task mapping into a first-phase execution checklist.

The focus is not to start all 9 subtasks equally. The goal is to pick the smallest set of runtime
paths that can:

1. Improve domestic-hardware viability.
1. Improve long-context and AGI4S serving behavior.
1. Stay merge-safe against upstream vLLM.
1. Produce benchmark evidence early.

This document should be read together with `docs/ARCHITECTURE_TASK_MAPPING.md`.

## Priority Order

### P0: Build a stable optimization baseline first

These items should move first because they unlock nearly all later work.

#### P0.1 1.2 Dynamic execution and native operator optimization

Why first:

- Domestic hardware enablement fails early if the model runner, attention backend, or kernel path is
  unstable.
- This is the narrowest place to recover real performance without rewriting the engine core.

Primary files to start with:

- vllm-hust:vllm/v1/worker/gpu/model_runner.py
- vllm-hust:vllm/v1/attention/selector.py
- vllm-hust:vllm/v1/attention/backend.py
- reference-repos/vllm-ascend-hust/vllm_ascend/worker/v2/model_runner.py
- reference-repos/vllm-ascend-hust/vllm_ascend/attention/
- reference-repos/vllm-ascend-hust/vllm_ascend/ops/

Minimum validation:

- Model loads and serves on target domestic hardware.
- No regression on basic single-node online serve path.
- Compare TTFT, TPOT, and output token throughput with `vllm bench serve`.

Suggested benchmark shape:

```bash
vllm bench serve \
  --backend vllm \
  --model <model> \
  --endpoint /v1/completions \
  --dataset-name sharegpt \
  --dataset-path <dataset> \
  --num-prompts 200 \
  --save-result
```

#### P0.2 2.1 Prefix and shared-state indexing

Why first:

- Prefix reuse is already native to vLLM and gives early wins in long-context and repeated-context
  workloads.
- It is merge-safe because the core abstractions already exist.

Primary files to start with:

- vllm-hust:vllm/v1/core/kv_cache_manager.py
- vllm-hust:vllm/v1/core/block_pool.py
- vllm-hust:vllm/v1/core/single_type_kv_cache_manager.py
- vllm-hust:vllm/v1/core/kv_cache_utils.py

Minimum validation:

- Correct cache-hit behavior.
- No correctness drift with prompt logprobs disabled or enabled.
- Prefix-hit metrics visible in logs or metrics.

Suggested benchmark shape:

- Use repeated-prefix synthetic or multi-turn request sets.
- Compare prefill cost and TTFT with caching on vs off.

#### P0.3 Benchmark and observability hardening

Why first:

- Without stable evidence, optimization work becomes anecdotal.
- This is the control point for deciding whether later kernel and scheduling changes are worth
  keeping.

Primary files to start with:

- vllm-hust:vllm/v1/metrics/
- vllm-hust:vllm/v1/core/kv_cache_metrics.py
- vllm-hust:vllm/v1/spec_decode/metrics.py
- vllm-hust-website:data/leaderboard_compare.json generation chain

Minimum validation:

- TTFT, TPOT, throughput, KV reuse, and error-rate outputs are stable.
- Scenario-level regression reports are reproducible across reruns.

### P1: Make long-context and scheduling behavior production-usable

#### P1.1 2.2 Hierarchical state residency and lifecycle

Why now:

- Once prefix reuse is stable, the next bottleneck is state pressure and recovery cost.
- This is central for long-context stability and real deployment concurrency.

Primary files to start with:

- vllm-hust:vllm/v1/kv_offload/
- vllm-hust:vllm/v1/core/kv_cache_coordinator.py
- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/kv_transfer/kv_pool/cpu_offload/
- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/

Minimum validation:

- Long-context service remains stable at 16K to 32K and above.
- Recovery and migration cost are visible and bounded.
- No hidden sync points collapse throughput.

Suggested benchmark shape:

- Long-context ShareGPT-style or synthetic workloads.
- Fixed-model runs at multiple context windows.

#### P1.2 1.3 Speculative decoding and stage-collaboration optimization

Why now:

- After single-path execution is stable, speculative execution can recover latency and throughput.
- This should be done after baseline scheduling observability is trustworthy.

Primary files to start with:

- vllm-hust:vllm/v1/spec_decode/
- vllm-hust:vllm/v1/core/sched/scheduler.py
- vllm-hust:vllm/v1/worker/gpu/spec_decode/
- reference-repos/vllm-ascend-hust/vllm_ascend/worker/v2/spec_decode/

Minimum validation:

- Correct draft/verify behavior.
- Stable scheduler state under speculative workloads.
- Separate metrics for speculative gain and rollback cost.

Suggested benchmark shape:

```bash
vllm bench throughput \
  --dataset-name=hf \
  --dataset-path=likaixin/InstructCoder \
  --model=<model> \
  --num-prompts=512 \
  --async-engine \
  --speculative-config '<json>'
```

#### P1.3 2.3 State transfer and scheduling co-optimization

Why now:

- This becomes valuable only after state accounting and residency are already visible.
- Otherwise routing decisions are just guesses.

Primary files to start with:

- vllm-hust:vllm/v1/core/sched/
- vllm-hust:vllm/v1/worker/gpu/kv_connector.py
- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/kv_transfer/
- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/device_communicators/

Minimum validation:

- Routing uses measurable locality and transfer-cost signals.
- Multi-node or multi-pool scenarios outperform blind routing.

### P2: Cost optimization and specialized compression

#### P2.1 3.2 KV dynamic quantization

Why before 3.1 in many deployments:

- In long-context serving, KV memory and bandwidth are often the first cost wall.
- KV quantization can produce direct capacity gains without fully re-quantizing the model.

Primary files to start with:

- vllm-hust:vllm/model_executor/layers/quantization/
- vllm-hust:vllm/v1/attention/
- reference-repos/vllm-ascend-hust/vllm_ascend/attention/

Minimum validation:

- No unacceptable quality collapse.
- Real reduction in memory or bandwidth pressure.
- Attention backend capability checks remain correct.

#### P2.2 3.1 Mixed-precision quantization and accuracy-cost tradeoff

Why later:

- Full-model quantization multiplies compatibility, kernel, and quality risk.
- It should start after the serving path itself is already stable.

Primary files to start with:

- vllm-hust:vllm/model_executor/layers/quantization/
- vllm-hust:vllm/model_executor/model_loader/
- reference-repos/vllm-ascend-hust/vllm_ascend/quantization/

Minimum validation:

- Accuracy-cost tradeoff is measured, not assumed.
- Loading and runtime kernels are both supported on target hardware.

#### P2.3 3.3 Sparse-quantization collaboration and domestic-hardware adaptation

Why later:

- This is high upside but also high integration risk.
- It depends on mature kernel, compiler, and fused-op support.

Primary files to start with:

- vllm-hust:vllm/model_executor/layers/fused_moe/
- vllm-hust:vllm/model_executor/layers/quantization/
- reference-repos/vllm-ascend-hust/vllm_ascend/ops/fused_moe/
- reference-repos/vllm-ascend-hust/vllm_ascend/ops/triton/

Minimum validation:

- End-to-end throughput win, not just microbench win.
- No regression in structured output, tool-calling, or long-context serving.

### P3: Architecture-level refactors only when required

#### P3.1 1.1 Unified execution abstraction and execution-graph modeling

Why later:

- This can easily become a broad rewrite if started too early.
- Most benefits can initially be captured by platform hooks, executor overrides, and model-runner
  adaptation.

Start only when one of these is true:

1. Existing platform interfaces cannot express the optimization.
1. Worker or executor duplication becomes unmaintainable.
1. A generic abstraction can clearly benefit multiple hardware targets.

## AGI4S-First Scenario Coverage

Every priority above should be checked against these real scenarios, not only synthetic throughput:

1. Long context and multi-turn continuation
1. Tool-calling and structured output
1. Reasoning-heavy generation
1. Multimodal request processing when applicable
1. Streaming latency under concurrency

If a change improves a microbenchmark but regresses any of the above, it should not be treated as a
clean win.

## Minimal First-Year Sequence

If the team wants one concrete sequence for the first year, use this order:

1. Stabilize dynamic execution and hardware-native kernels
1. Make prefix caching and KV metrics trustworthy
1. Harden benchmark and regression evidence
1. Improve state residency and long-context stability
1. Add speculative scheduling improvements
1. Introduce state-aware transfer and routing
1. Push KV quantization
1. Expand to mixed-precision and sparse-quantized adaptation

## Suggested Benchmark Bundle

Use a compact but repeatable benchmark bundle for every major optimization branch:

### Online serve benchmark

```bash
vllm bench serve \
  --backend vllm \
  --model <model> \
  --endpoint /v1/completions \
  --dataset-name sharegpt \
  --dataset-path <dataset> \
  --num-prompts 200 \
  --save-result
```

### Concurrency and load-pattern benchmark

```bash
vllm bench serve \
  --backend vllm \
  --model <model> \
  --endpoint /v1/completions \
  --dataset-name sharegpt \
  --dataset-path <dataset> \
  --num-prompts 200 \
  --request-rate 10 \
  --burstiness 1.0 \
  --max-concurrency 32 \
  --save-result
```

### Offline throughput benchmark

```bash
vllm bench throughput \
  --model <model> \
  --dataset-name sonnet \
  --dataset-path vllm/benchmarks/sonnet.txt \
  --num-prompts 200
```

### Structured-output or tool-calling benchmark when relevant

- Run at least one chat-completions path with structured-output enabled.
- Record TTFT and TPOT separately because grammar backends can move first-token latency.

## Stop Conditions

Do not continue broadening a branch if any of these happen:

1. The only gain is from a microbenchmark and not from serving workloads.
1. The implementation requires large shared-path edits before platform hooks are exhausted.
1. Validation cannot explain whether the gain came from scheduling, kernels, or caching.
1. Unsupported hardware fallback behavior becomes ambiguous.
