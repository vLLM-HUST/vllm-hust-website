# BetterScale: execution improvements on vLLM Ascend

Fast kernels can still wait for the host to prepare and submit the next inference wave. BetterScale
shortens those cross-step dependencies through graph coverage, ordered replay, and device-side
preparation. Remaining host coordination gaps are not claimed solved.

BetterScale is an opt-in collection of execution optimizations, integrated through vLLM's native
Worker lifecycle. `betterscale.worker.Worker` is defined directly in `src/betterscale/worker.py`;
independently scoped patches live beside it.
[The development repository](https://github.com/vLLM-HUST/BetterScale) is public under Apache-2.0;
[`vllm-betterscale==0.3.2`](https://pypi.org/project/vllm-betterscale/0.3.2/) and its Python source
are public on PyPI. [Installation and native TP8 / DP8 commands](../betterscale.html#integration)
use the existing pinned runtime without upgrading dependencies. Packaging was verified separately
with 55 CPU tests and a clean install. Version 0.3.2 consolidates the package namespace only;
measured execution behavior is unchanged. Version 0.3.1 prepares the DP auxiliary graph catalog
before READY; TP's existing path is unchanged. Its DP throughput result reuses the qualified
startup-prepared implementation, rather than claiming a fresh wheel benchmark.
[The HTTP acceptance report](https://github.com/vLLM-HUST/BetterScale/blob/fbfa963/docs/E2E-20260914.zh-CN.md)
records DP +39.63% and TP +35.17% against their respective native baselines, all repeats and latency
limitations. These HTTP results are separate from the matched-cycle charts below.

[Visual case study](../betterscale.html) · [Measurement snapshot](../data/betterscale-results.json)

## Measurement identity

These September 2026 experiments use eight Ascend 910B2 accelerators connected by HCCS,
DeepSeek-V4-Flash-0731-w8a8 real weights, W8A8 quantization and BF16 activations, CANN 9.0.1 and
torch_npu 2.10.0.post2. The release pins are vLLM v0.25.1
(`752a3a504485790a2e8491cacbb35c137339ad34`) and vLLM-Ascend v0.25.1rc1
(`9bf964cb4b87c8cd0d6852c41a55b3c29711fa95`). Source identity does not assert a byte-identical
rebuild of every historical installed package.

The source report is `RESULTS.md` and the DP receipt is `evidence/dp-continuation-20260913.json` at
implementation commit `7f7bda350471bab47decc45b64264280b9c4d4d7`. These are immutable provenance
identifiers; the
[source report](https://github.com/vLLM-HUST/BetterScale/blob/7f7bda350471bab47decc45b64264280b9c4d4d7/RESULTS.md)
and
[DP receipt](https://github.com/vLLM-HUST/BetterScale/blob/7f7bda350471bab47decc45b64264280b9c4d4d7/evidence/dp-continuation-20260913.json)
are publicly accessible. The accompanying JSON is a curated, public measurement summary; it contains
every repeat shown on the page and comparator and selection definitions. Raw traces are not bundled.
This case study is separate from the website's fixed-target leaderboard and does not claim admission
to it.

## What changed

- **Target FULL coverage:** the Worker installs attention graph-support and metadata adaptations
  before native initialization, admitting supported prefill/mixed shapes to the original FULL graph
  route. Existing decode FULL remains intact.
- **Draft execution:** the TP path captures the small DSpark proposal body. Large context-KV
  ingestion runs at its actual row count rather than padding draft work to a large target bucket.
  Ordinary small decode retains its fused context/query path.
- **Replay and receipt dependencies:** stream-ordered replay avoids a global device fence; CPU-side
  QLI bounds avoid a device-to-host scalar dependency. In the admitted TP path, conservative CPU
  bounds and later receipt retirement allow useful work to be submitted first. These changes retain
  necessary input-buffer ownership fences.
- **DP device preparation:** separate input banks and captured device progress/metadata preparation
  shorten the observed draft-to-target interval. The DP draft remains native eager; the TP draft
  graph result must not be attributed to DP.

Each patch owns a bounded hook and the Worker composes them. This is not a claim that arbitrary
subsets, model versions, or graph shapes have been qualified. Removing the Worker requires
restarting with a known-working native configuration; hot-unpatching is not supported. Some K5/TP8
configurations also need the package's alignment repair.

## Timing: separate comparisons, not a compound throughput claim

Timing runs use normal HCCL with no profiler and no state oracle. Values are medians across eight
per-rank cycle medians. A K5 cycle is not one emitted token: speculative acceptance determines how
much output it produces.

| Study               | Control                                         | Candidate                                        | Repeats (control → candidate, ms)           |
| ------------------- | ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| TP draft, 026       | Original target FULL decode, native eager draft | Draft FULL, ordered replay, CPU QLI              | 65.60 → 51.74; 64.50 → 51.54                |
| TP receipt, 031     | Already optimized draft-graph path              | Conservative bounds and later receipt retirement | 52.05 → 46.60; 52.46 → 46.26; 51.66 → 46.11 |
| DP preparation, 120 | Dual target graph endpoints                     | Dual banks plus device producer/metadata         | 59.8931 → 50.3773; 59.0854 → 49.9979        |

TP: TP8 + EP, DSACP enabled, DCP size 1, DSpark K5, four real requests with six target queries each,
prefix caching off. Prompt/output lengths are 64/128, global budget 288, capture buckets 24/288, max
length 2048, KV sizing at 0.85 memory utilization. Each phase selects 21 matched intervals per rank.
Study 031 prewarms all four draft banks. The draft-graph study is bundled: ordered replay and CPU
QLI alone do not establish that entire gain. The two TP percentage improvements are not additive.

DP: TP1/DP8/EP8, K5, 16 global requests, two requests and 12 real queries per rank, local budget
1026, max length 16384, 8 GiB KV/rank, target FULL, native eager draft, DSACP off and prefix caching
off. Each repeat selects the first ten consecutive common occupied cycle ordinals. Both arms retain
experimental allocations; this is not a stock whole-service comparison. The corresponding cross-step
intervals are 9.4170 → 1.2382 ms and 9.4931 → 1.2344 ms. They include actual work, not only idle
time.

These are unprofiled measurements. Separately captured, aligned profiles still show approximately 10
ms gaps in some waves. The page's execution drawing is a mechanism schematic, not a measured
timeline or a claim of universally bubble-free execution.

## Short mixed and prefill

Runs 041/046 compare prior optimized FULL-target control against split context/query, not unmodified
vLLM. Both use budget 4128, capture 24/4128, max length 8256 and 3 GiB KV/rank; seven input cohorts
run twice with 64 output tokens/request. The reported warm, matching-row observations use all-rank
medians. A 6+17-row mixed wave takes 63.96 → 46.37 ms. The 64-, 1025- and 4112-row first waves are
approximately unchanged or slightly slower. All five reported shapes are retained in the
downloadable JSON. This single paired shape observation is not a general prefill speedup.

## Quality and limits

Both TP arms (048/049) pass the same 32 retained original-input OpenCompass LongBench English
retrieval questions: 32/32. Inputs contain 9,921–14,997 tokens; the output cap is 32 tokens with EOS
honored. The quality configuration uses TP8/K5, four seats, budget 4128, max length 15104 and 12 GiB
KV/rank, not the small timing configuration. The packaged DP Worker also passes 32/32 (124).
Evaluator commit: `60a28a727d3b7807eb3554928f3530d04c948452`.

This is a retrieval subset, not the complete OpenCompass suite. Deterministic state oracles are
separate from normal-HCCL timing. A faster matched cycle does not by itself establish a stable
service-throughput, TTFT, maximum-concurrency or KV-capacity gain. No mapped C4, PCP or all-mode N+2
scheduler improvement is included here.

## Installation and startup checks

The normal MOD installation panel contains the complete DP8 command and an expandable TP8
alternative, including the MP executor and async scheduler. Run one configuration at a time in the
existing pinned Ascend environment; replace the model path. The same commands appear in the detail
page.

The website CI job `betterscale-package` installs the actual public PyPI wheel on Python 3.12
without dependencies, loads its pins, checks both displayed command copies and runs the package's
CPU admission on the parsed settings. It exports the checked commands as an artifact. This CPU job
does **not** claim to boot an NPU model.

On an admitted Ascend machine, `scripts/smoke_betterscale_service.py` consumes that artifact,
replaces only the model path, starts the chosen server, waits at most900s for health, and makes one
short HTTP completion. It records the command, server log and result, then shuts down the owned
service. The caller must hold the existing eight-card lease and supervise descendants; this is not a
cluster scheduler. It does not benchmark throughput or repeat the retrieval quality set.

Startup smoke163 passed on 2026-09-14: the public0.3.1 wheel, the displayed DP8 command (only the
model path substituted), all eight native DP engines initialized, HTTP health200 and a32-token
completion. The supervisor exited0 and all eight cards were reclaimed. Native peer-disconnect
messages followed supervised teardown; they are retained in the log, not hidden as a clean graceful
shutdown. This is not a new TP8 boot, throughput measurement or model-quality gate. The compact
receipt is `startup_smoke` in the measurement snapshot; local full evidence is retained in the
original `163-hw3-dp8-mod-startup031` capsule.
