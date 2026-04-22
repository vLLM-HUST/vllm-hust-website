# Actual vLLM Runtime And 9-Task Mapping

## Goal

This note clarifies two things that should not be mixed together:

1. What the actual serving runtime shape in upstream vLLM looks like.
1. How the 9 subtasks in the implementation plan map onto real runtime subsystems and extension
   points.

The 9 subtasks are optimization slices over real runtime subsystems. They are not claims that
upstream vLLM already exposes those subtasks as named modules.

For the execution-oriented follow-up, see `docs/IMPLEMENTATION_PRIORITIES.md`.

## Actual Runtime Shape

The main vLLM V1 serving chain is:

1. API and client entrypoints
1. Engine core and scheduler
1. Executor and workers
1. Model runner, attention backend, kernels, sampler
1. Cross-cutting systems such as KV cache, multimodal processing, structured output, and metrics

In code, the most important anchor points are:

- vllm-hust:vllm/v1/engine/llm_engine.py
- vllm-hust:vllm/v1/engine/async_llm.py
- vllm-hust:vllm/v1/engine/core.py
- vllm-hust:vllm/v1/core/sched/scheduler.py
- vllm-hust:vllm/v1/core/kv_cache_manager.py
- vllm-hust:vllm/v1/executor/multiproc_executor.py
- vllm-hust:vllm/v1/worker/gpu_worker.py
- vllm-hust:vllm/v1/worker/gpu/model_runner.py
- vllm-hust:vllm/v1/attention/selector.py
- vllm-hust:vllm/v1/attention/backend.py
- vllm-hust:vllm/v1/structured_output/
- vllm-hust:vllm/v1/kv_offload/
- vllm-hust:vllm/multimodal/
- vllm-hust:vllm/model_executor/layers/quantization/

Relevant upstream design references:

- reference-repos/vllm/docs/design/arch_overview.md
- reference-repos/vllm/docs/usage/v1_guide.md
- reference-repos/vllm/docs/design/prefix_caching.md
- reference-repos/vllm/docs/design/hybrid_kv_cache_manager.md
- reference-repos/vllm/docs/design/attention_backends.md
- reference-repos/vllm/docs/design/mm_processing.md
- reference-repos/vllm/docs/features/structured_outputs.md
- reference-repos/vllm/docs/design/model_runner_v2.md

## Fork-Side Landing Zones

For merge-safe fork work, the highest-priority landing zones are:

### vllm-hust

- vllm/v1/engine/
- vllm/v1/core/sched/
- vllm/v1/core/kv_cache_manager.py
- vllm/v1/core/kv_cache_coordinator.py
- vllm/v1/spec_decode/
- vllm/v1/worker/gpu/
- vllm/v1/attention/
- vllm/v1/structured_output/
- vllm/v1/kv_offload/
- vllm/model_executor/layers/quantization/
- vllm/multimodal/

### vllm-ascend-hust

These are hardware-plugin landing zones and should usually absorb domestic-hardware-specific logic
before shared-path edits are considered:

- reference-repos/vllm-ascend-hust/vllm_ascend/platform.py
- reference-repos/vllm-ascend-hust/vllm_ascend/worker/model_runner_v1.py
- reference-repos/vllm-ascend-hust/vllm_ascend/worker/v2/model_runner.py
- reference-repos/vllm-ascend-hust/vllm_ascend/worker/worker.py
- reference-repos/vllm-ascend-hust/vllm_ascend/worker/v2/
- reference-repos/vllm-ascend-hust/vllm_ascend/attention/
- reference-repos/vllm-ascend-hust/vllm_ascend/ops/
- reference-repos/vllm-ascend-hust/vllm_ascend/quantization/
- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/
- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/kv_transfer/
- reference-repos/vllm-ascend-hust/vllm_ascend/patch/platform/
- reference-repos/vllm-ascend-hust/vllm_ascend/patch/worker/

## 9 Subtasks To Real Subsystems

### 1.1 Unified execution abstraction and execution-graph modeling

Primary mapping:

- vllm-hust:vllm/v1/engine/core.py
- vllm-hust:vllm/v1/executor/
- vllm-hust:vllm/v1/worker/
- vllm-hust:vllm/config/parallel.py

Why:

- This is about the execution contract between engine core, executor, workers, and model runner.
- It is not a separate business-control layer.

Recommended fork-first path:

- Prefer platform-specific executor overrides and worker/model-runner extension points.
- In Ascend plugin work, start from reference-repos/vllm-ascend-hust/vllm_ascend/platform.py and
  reference-repos/vllm-ascend-hust/vllm_ascend/patch/platform/patch_multiproc_executor.py.

### 1.2 Dynamic execution and native operator optimization

Primary mapping:

- vllm-hust:vllm/v1/worker/gpu/model_runner.py
- vllm-hust:vllm/v1/attention/
- vllm-hust:vllm/model_executor/
- vllm-hust:vllm/model_executor/layers/

Ascend-first landing zones:

- reference-repos/vllm-ascend-hust/vllm_ascend/worker/v2/model_runner.py
- reference-repos/vllm-ascend-hust/vllm_ascend/attention/
- reference-repos/vllm-ascend-hust/vllm_ascend/ops/

Why:

- Dynamic shape, fused operators, hardware-native kernels, and graph execution all land near the
  model runner and attention backend.

### 1.3 Speculative decoding and stage-collaboration optimization

Primary mapping:

- vllm-hust:vllm/v1/spec_decode/
- vllm-hust:vllm/v1/core/sched/scheduler.py
- vllm-hust:vllm/v1/worker/gpu/spec_decode/
- vllm-hust:vllm/v1/sample/

Ascend-first landing zones:

- reference-repos/vllm-ascend-hust/vllm_ascend/worker/v2/spec_decode/
- reference-repos/vllm-ascend-hust/vllm_ascend/patch/worker/patch_v2_eagle.py

Why:

- Draft and verify overlap is a scheduler plus worker-timing problem, not just a sampler trick.

### 2.1 Prefix and shared-state indexing

Primary mapping:

- vllm-hust:vllm/v1/core/kv_cache_manager.py
- vllm-hust:vllm/v1/core/block_pool.py
- vllm-hust:vllm/v1/core/single_type_kv_cache_manager.py
- vllm-hust:vllm/v1/core/kv_cache_utils.py

Why:

- Prefix reuse in vLLM is implemented as block-hash and block-pool logic inside KV cache management.

### 2.2 Hierarchical state residency and lifecycle

Primary mapping:

- vllm-hust:vllm/v1/kv_offload/
- vllm-hust:vllm/v1/core/kv_cache_manager.py
- vllm-hust:vllm/v1/core/kv_cache_coordinator.py

Ascend-first landing zones:

- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/kv_transfer/kv_pool/cpu_offload/cpu_kv_cache_manager.py
- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/

Why:

- Any HBM-DRAM-NVMe policy should be modeled as state-management logic, not spread into unrelated
  scheduling paths.

### 2.3 State transfer and scheduling co-optimization

Primary mapping:

- vllm-hust:vllm/v1/core/sched/
- vllm-hust:vllm/v1/engine/core.py
- vllm-hust:vllm/v1/worker/gpu/kv_connector.py

Ascend-first landing zones:

- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/kv_transfer/
- reference-repos/vllm-ascend-hust/vllm_ascend/distributed/device_communicators/

Why:

- This is where state locality, transfer cost, and routing policy can be coupled.

### 3.1 Mixed-precision quantization and accuracy-cost tradeoff

Primary mapping:

- vllm-hust:vllm/model_executor/layers/quantization/
- vllm-hust:vllm/model_executor/model_loader/
- vllm-hust:vllm/config/model.py

Ascend-first landing zones:

- reference-repos/vllm-ascend-hust/vllm_ascend/quantization/
- reference-repos/vllm-ascend-hust/vllm_ascend/\_310p/quantization/

Why:

- The main work is configuration, loading, kernel support, and quality-cost validation.

### 3.2 KV dynamic quantization

Primary mapping:

- vllm-hust:vllm/model_executor/layers/quantization/
- vllm-hust:vllm/v1/attention/
- vllm-hust:vllm/v1/core/kv_cache_manager.py

Ascend-first landing zones:

- reference-repos/vllm-ascend-hust/vllm_ascend/attention/
- reference-repos/vllm-ascend-hust/vllm_ascend/\_310p/attention/

Why:

- KV dtype support depends on both model-side scale loading and backend capability validation.

### 3.3 Sparse-quantization collaboration and domestic-hardware adaptation

Primary mapping:

- vllm-hust:vllm/v1/attention/
- vllm-hust:vllm/model_executor/layers/fused_moe/
- vllm-hust:vllm/model_executor/layers/quantization/

Ascend-first landing zones:

- reference-repos/vllm-ascend-hust/vllm_ascend/ops/fused_moe/
- reference-repos/vllm-ascend-hust/vllm_ascend/ops/triton/
- reference-repos/vllm-ascend-hust/vllm_ascend/patch/worker/

Why:

- This is primarily a kernel, fused-op, and platform adaptation problem.

## Merge-Safe Priorities

Use this order when deciding where to implement a change:

1. Existing upstream config gates and registries
1. Platform plugin hooks
1. Worker or model-runner subclassing
1. Attention backend or kernel registration
1. Narrow worker or platform patch
1. Shared hot-path edits only if none of the above are sufficient

For domestic hardware enablement, start from the plugin repository first. Only move into shared
vllm-hust paths when the change is truly generic or when the extension point is missing.

## Validation Expectations

Each subtask should be validated on both code-level and workload-level evidence:

1. Unit or subsystem tests around the touched runtime path
1. Scenario-level serving checks for long context, tool-calling, structured output, or multimodal
   flows when relevant
1. vLLM benchmark artifacts for throughput, TTFT, TPOT, KV reuse, or token cost claims
1. Clear fallback behavior on unsupported platforms

## Practical Reading Order

If a new contributor needs to understand where to work first, use this order:

1. reference-repos/vllm/docs/design/arch_overview.md
1. reference-repos/vllm/docs/usage/v1_guide.md
1. vllm-hust:vllm/v1/engine/core.py
1. vllm-hust:vllm/v1/core/sched/scheduler.py
1. vllm-hust:vllm/v1/core/kv_cache_manager.py
1. vllm-hust:vllm/v1/worker/gpu/model_runner.py
1. reference-repos/vllm-ascend-hust/vllm_ascend/platform.py
1. reference-repos/vllm-ascend-hust/vllm_ascend/worker/model_runner_v1.py
1. reference-repos/vllm-ascend-hust/vllm_ascend/worker/v2/model_runner.py
