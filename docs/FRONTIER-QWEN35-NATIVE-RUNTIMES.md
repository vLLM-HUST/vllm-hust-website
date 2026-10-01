# Qwen3.5 Native runtime curves

The Qwen3.5 SWE prefix-reuse setting publishes Native configurations as separate concurrency curves.
`Native` is not one interchangeable implementation: every curve keeps its actual vLLM, vLLM-Ascend,
graph mode and capacity identity.

## vLLM 0.18.0 + vLLM-Ascend 0.18.0 reference

The official `quay.io/ascend/vllm-ascend:v0.18.0` arm uses image index digest
`sha256:697175418772c65b56afc04a7ccde7c24e7ad15a988a852eb8239fa9b6298e24` and arm64 digest
`sha256:2467d259ff068ca4edd7b50b849152910f3c05e435f314639fc06bcc7a00f9fa`. Its release sources are
vLLM `bcf2be9` and vLLM-Ascend `e18643f`, with CANN 8.5.1.

Those untouched releases can load the Qwen3.5 multimodal checkpoint but cannot correctly serve this
pure-text MTP workload. The measured arm therefore discloses minimal upstream-derived compatibility
backports rather than calling itself an untouched binary:

- vLLM `9878e04`: Qwen3.5 text-only registration, hybrid support and MTP config recognition.
- vLLM-Ascend `0f40ff0`: apply multimodal RoPE handling only when the loaded config actually has
  multimodal RoPE sections.
- The text-only config view is derived from the checkpoint `text_config`; every tokenizer and weight
  file remains a symlink to the source checkpoint. Its config SHA256 is
  `5abb937cfa1f8a4089e37e34b25a7a3d7a5567bbde471875cf5734a19dd08521`.

The server accepts the requested `FULL_AND_PIECEWISE` setting, but 0.18's Ascend backend records the
effective mode as **PIECEWISE ACL Graph**. It reports 23.37 GiB available KV cache per chip and
544,768 KV-cache tokens, below the requested 26,038,239,232 bytes. The chart and downloaded point
configuration show these effective values. This is the 0.18 release-line reference, not an
equal-runtime comparison against either 0.25 curve.

## Formal measurements

All points use Qwen3.5-35B-A3B BF16, Ascend 910B2, TP2/PP1/DP1, APC, async scheduling, Mamba
`align`, native MTP with two draft tokens, thinking enabled, temperature zero, and the prepared
`swe-prefix-reuse/v1` workload SHA256
`8044561ffa1bb430bea8f778ef814d96649321e1a92654b95f64263b996d5e85`. Each measurement window is
exactly 900 seconds; only in-flight requests drain afterward.

| Client C | Output tok/s | P90 decode tok/s/user | Window completions | Drain | Failures |
| -------: | -----------: | --------------------: | -----------------: | ----: | -------: |
|        1 |      29.8444 |               31.9750 |                 66 |     1 |        0 |
|        2 |      56.7300 |               31.5535 |                108 |     2 |        0 |
|        4 |     106.2889 |               30.7664 |                173 |     4 |        0 |
|        8 |     161.9156 |               23.9590 |                261 |     8 |        0 |
|       16 |     247.2656 |               20.5847 |                392 |    16 |        0 |

Every point has zero failed requests. C16 records mean client inflight 15.9985 and full-concurrency
fraction 0.9986. Service logs show positive APC hit rates and real Native MTP drafted/accepted
counters. The owned server exited with status zero and all four allocated NPUs were process-free
after teardown. Raw request timing, service-log slices, periodic NPU snapshots, source patches and
per-window plus aggregate SHA256 manifests remain in the measurement evidence bundle; the public
extract is in
[`leaderboard_frontier_swe_evidence.json`](../data/leaderboard_frontier_swe_evidence.json).

## Other Native configurations

The page retains two other complete Native curves with direct labels:

- vLLM 0.25.1 (`752a3a5`) / vLLM-Ascend 0.25.1rc1 (`9bf964c`) · FULL_AND_PIECEWISE.
- vLLM 0.25.1+frontier.unified (`d0f22d2`) / vLLM-Ascend 0.25.1rc1+2 (`03766ac`) ·
  FULL_AND_PIECEWISE.

They remain separate series because their runtime sources and effective serving configurations are
different. MOD gain calculations continue to use their declared matched controls; adding the 0.18
reference does not silently rebase existing results.
