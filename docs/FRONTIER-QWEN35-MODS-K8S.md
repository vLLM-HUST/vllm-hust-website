# Qwen3.5-35B-A3B: fresh container MOD controls

This campaign measures additional MODs against a fresh native control on the same Qwen3.5-35B-A3B
checkpoint and SWE prefix-reuse workload. Historical BetterScale points are not the denominator for
a new MOD's speedup.

Evidence kind: **real-online**. All serving and measurement ran inside the user-provided Kubernetes
container.

## Comparison contract

Both arms use Ascend 910B2 TP2, BF16, PP1, 262144-token configured capacity, 16 server slots, a
4096-token scheduling budget, prefix caching, Mamba `align`, natural MTP with two draft tokens, and
FULL_AND_PIECEWISE graphs with capture sizes 3/6/12/24/48. Explicit KV capacity is 26038239232 bytes
per participating chip. Each measurement is a complete 900-second window after a separate C2/60s
protocol/cache qualification. Measured session salts are fresh. Output token IDs are the actual
generated history; no retokenized or synthetic continuation.

The task-owned deployment participates on two chips inside the user-provided Kubernetes container.
The enclosing pod exposes eight NPUs; the other six are not part of this TP2 deployment. Per-chip
throughput divides by two and does not omit any participating draft, prefill or decode worker.

X is P90 of each fully completed in-window request's
`(output_tokens - 1) / (last_token_time - first_token_time)`. Y is actual output tokens received
inside the window, divided by 900 and by two. Drain tokens do not contribute to window throughput.
Individual observations remain separate; they are not a peak-capacity or repeatability certificate.

## Pinned model and runtime

All 22 model files (14 shards and eight config/tokenizer files) match SHA256 and size in the
official ModelScope repository at revision `712cf74392b05026a6db2bf213d343747d1f6d45`. Verification
uses the official ModelScope repository tree. Five existing readonly mounted shards were reused
after hash verification; missing files were placed in a task-owned directory.

- Core base: `752a3a504485790a2e8491cacbb35c137339ad34`.
- Ascend base: `9bf964cb4b87c8cd0d6852c41a55b3c29711fa95`.
- Installed core metadata: `0.25.1+frontier.bidkv.empty`.
- Ascend official A2 wheel: `0.25.1rc1`, SHA256
  `0e6ba24d581ef9200aa38ae6773363633070a21a84ce229fbe41bbedc054ae42`.
- Container base: CANN 9.1.0, torch 2.10.0+cpu, torch-npu 2.10.0.post4, triton-ascend 3.2.2; client
  Transformers 5.14.1.
- SWE client: `6861242dbd9f17b707003191e4200b7752911d7c`.
- Prepared SHA256: `aa23f49e08a946d94eaab21307e9e015140cc8598adfbd5f7e244bdded7b17d0`.
- Tokenizer fingerprint: `3f9ca78537850303ee04bfa6640c020be89723c62f37121c0f27a4c0babc53e0`.

The source bundle and compiler are unchanged from the historical public client revision `59ea20a`;
the new prepared artifact retains its actual path/version metadata and identity. Replacing only its
tokenizer path with `/workspace/models/Qwen3.5-35B-A3B` and tokenizer version with `5.17.0`
reconstructs the published historical SHA256
`8044561ffa1bb430bea8f778ef814d96649321e1a92654b95f64263b996d5e85` exactly; all fixed input-token
deltas, source-derived output budgets and session ordering are therefore unchanged. It contains
eight sessions and 360 turns, ending at 15494..141269 tokens. A 900-second run need not reach each
full-session shape.

The provided container's CANN and torch-npu differ from historical environments. Consequently this
campaign supplies a new matched control rather than claiming bitwise equivalence to an older serving
deployment.

## Common correctness and integration changes

The [common source overlays and identity receipts](evidence/qwen35-mods-k8s-20260925/README.md) are
included with this report. Both arms use the same neutral preemption-policy API port, V1/SD Mamba
kernel ABI adapter, and private previous-step accepted-token feedback buffer. These are shared
integration/correctness changes, not part of the BidKV treatment.

The feedback buffer prevents request admission and batch-row reordering from mutating the
previous-step MTP receipt before it is remapped. Entirely new batches reset accepted counts to one.
The accepted tokens themselves still come from real native MTP accept/reject; no forced acceptance
or eager fallback is used.

`VLLM_VERSION=0.25.1` selects the backend's exact-version compatibility branch; the actual patched
package metadata and file hashes remain in run receipts.

The fresh native control passed 26 marker-retrieval probes: cold/warm at 1024, 8192, 32768, 131072
and 262080 input tokens, followed by 16 concurrent requests. This is bounded marker retrieval, not
general answer-quality or SWE problem-solving certification. Its separate 60-second SWE gate
completed with 20 requests, zero request failures, and 79872 measured prefix-cache-hit tokens.

## Candidate scope

BidKV uses source `a0cba97d9abdc99908e46616db622f0e0099127f`,
`--preemption-policy bidkv.adapters.vllm_hust.selector.BidkvPreemptionPolicy` and
`BIDKV_UTILITY_ENABLE=1`. The fresh native arm uses the built-in policy on the same common core.
Runtime policy-call, failure and invalid-selection counters must accompany each candidate point. A
zero-call observation is **not exercised**, not evidence of a BidKV optimization benefit.

A [35B Eagle3 draft](https://huggingface.co/jiapingW/Qwen3.5-35B-A3B-Eagle3-Specforge) exists, but
the inspected DiffSpec revision `42e5909fc6fe276ba0defe1901257a523653aefb` explicitly requires TP4,
dense Qwen architecture, asynchronous scheduling off, and APC off. That implementation therefore
cannot join this TP2/MoE/APC/async cell by changing only the MOD. LatchMoE also currently conflicts
with APC. Pipeline Microbatch now has a
[separate matched PP2×TP2 campaign](FRONTIER-QWEN35-PIPELINE-K8S.md), with real calibrated profiles
and fresh native controls. DLA needs a documented prediction input and its additional scheduler
interfaces. Their historical or simulated results are not imported into this campaign.

## Completed matched observations

| Arm    | Concurrency | Output tokens/s/chip | Decode P90 tokens/s | Request errors | Policy calls |
| ------ | ----------: | -------------------: | ------------------: | -------------: | -----------: |
| Native |           4 |              121.040 |              88.998 |              0 |            0 |
| BidKV  |           4 |              119.515 |              89.202 |              0 |            0 |
| Native |          16 |              184.020 |              35.545 |              0 |            0 |
| BidKV  |          16 |              184.852 |              35.400 |              0 |            0 |

Both arms passed all 26 retrieval probes and the separate C2/60-second protocol gate (20 requests,
zero failures, 79872 prefix-hit tokens). All four 900-second windows completed and the owned servers
exited cleanly, with no selected-device FD owners remaining. Native C16 drained for 90.94 seconds
and BidKV C16 for 92.89 seconds; post-window tokens do not contribute to throughput.

BidKV was enabled, but neither measured concurrency invoked its preemption policy. Both cells have
zero calls, selections, failures, invalid selections and preemptions, including the in-flight drain.
The UI therefore marks them **MOD policy not exercised**. The small throughput differences are
single-observation differences, not demonstrated optimization gains. The originally proposed
repeated pairs were not pursued after this mechanism check: repeating an uninvoked policy would not
establish its benefit. A future pressure experiment needs its own matched control and declared
configuration; this campaign does not silently reduce KV capacity or alter the workload to trigger
it.

Full original artifacts are retained as `runs/native-r1` and `runs/bidkv-r1` under
`frontier-mods-qwen35-20260925`, together with per-window counter snapshots, request records,
qualification receipts and release receipts. Public evidence rows include raw-request SHA256 values
and the observed metrics.

The
[committed campaign harness and configuration](https://github.com/vLLM-HUST/vllm-hust-dev-hub/tree/d9d5810872b7bb820ced8822f775029ea15376a7/scripts/frontier_runtime)
preserve the custody checks, window runner, exporter and common overlays.
