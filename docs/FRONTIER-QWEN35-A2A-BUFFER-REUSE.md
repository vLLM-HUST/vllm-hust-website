# Qwen3.5 SWE prefix-reuse: a2a-buffer-reuse OFF/ON at C8

Two 900-second [swe-prefix-reuse](https://github.com/vLLM-HUST/swe-prefix-reuse) observations of
`Qwen3.5-35B-A3B` on two Ascend 910B2 chips (TP2 + expert parallel, C8), with the standalone
`vllm-hust-a2a-buffer-reuse` 0.1.0.dev0 plugin not installed into the runtime (OFF) and installed
(ON). They are added to the existing `qwen35-35b-a3b-bf16-sweprefix-smoke-v1` cohort as two
single-point series, so the chart shows two points, not lines.

## Result

|                                |           OFF |            ON |
| ------------------------------ | ------------: | ------------: |
| Completed requests in window   |           314 |           318 |
| Output tokens / s (both chips) |        194.48 |        198.33 |
| Output tokens / s / chip       |         97.24 |         99.17 |
| Decode P90 (tokens / s)        |         40.72 |         40.71 |
| TTFT P50 / P95 (ms)            |   1346 / 3093 |   1323 / 3089 |
| TPOT mean / P95 (ms)           | 37.91 / 57.30 | 37.25 / 55.53 |
| E2E P95 (ms)                   |         73204 |         74158 |
| Failed requests                |             0 |             0 |
| `runtime_effective` events     |             0 |             0 |
| Patch-installed events         |             0 |             4 |

The ON arm is +2.0% in output throughput, and decode P90 is unchanged. **This is not evidence that
the mechanism helps.** Each arm is one serial observation (no confidence interval, no repeats), and
in the ON arm the patch installed but no `runtime_effective` event (the first time a reused buffer
is observed) was ever logged, so the receive-buffer reuse path was not seen executing. This matches
the earlier TP2 result recorded for the mechanism (E038 / E039 / E049 in
`vllm-hust-legacy017-perf`).

## Activation

`vllm-hust-ext extension enable org.vllm-hust.a2a-buffer-reuse` only records the state. The plugin
stays a no-op until `VLLM_HUST_A2A_BUFFER_REUSE_ENABLE=1` is exported to the server process
(`vllm-hust-ext extension env` still prints `"0"` for it). The OFF arm therefore has the extension
listed as `enabled` but no patch installed. The ON arm exports `ENABLE=1` and logs
`LEGACY017_EVIDENCE installed mechanism=a2a_receive_buffer_reuse classes=OProjRowParallelOp` once
per process. `VLLM_HUST_A2A_BUFFER_REUSE_EVIDENCE=1` is set in both arms.

## Differences from the other points in this cohort

- **Workload identity.** The prepared workload was re-prepared locally; its sha256 (`4e62e54e…`) and
  tokenizer fingerprint (`319f580a…`) differ from the cohort's `8044561f…` / `3f9ca785…`. The source
  bundle sha256 (`a31abfc7…`) is the same. These two points are not guaranteed to replay
  byte-identical requests to the other series, so compare them with each other, not across series.
- **Prefix caching is disabled** (`--no-enable-prefix-caching`), so this measures a no-reuse
  baseline for a prefix-reuse workload. Most other points enable it.
- **No MTP, FULL_DECODE_ONLY graph, `max-num-batched-tokens` 8192, 0.85 memory utilisation**, and a
  different runtime (vLLM-HUST 0.28.1 / Ascend-HUST 0.25.1rc2) from the 0.25.1 and 0.18 series.
- **Short-window coverage.** The observed maximum prompt was 59,957 tokens and 7 of 8 sessions
  completed; nothing here says anything about the 141K / 256K shapes.
- **Component catalog.** `a2a-buffer-reuse` is a local package that is not published as a GitHub
  repository and is not in `data/ecosystem.json`, so the ON point carries the ID without a
  `mod_sources` entry. The OFF point is `mods: []`.
- The 20-second protocol probe ran on the same server before each window. The client
  `server-metadata` file was identical for both arms (it does not record `ENABLE`); the actual
  per-arm state is in each point's `a2a_buffer_reuse` parameters.

## Reproducing

```bash
source /usr/local/Ascend/nnal/atb/set_env.sh
export ASCEND_RT_VISIBLE_DEVICES=0,1
export VLLM_HUST_A2A_BUFFER_REUSE_EVIDENCE=1
export VLLM_HUST_A2A_BUFFER_REUSE_ENABLE=1   # ON arm only
vllm serve /models/Qwen3.5-35B-A3B --served-model-name qwen3.5-35b-a3b \
  --dtype bfloat16 --block-size 128 --tensor-parallel-size 2 --enable-expert-parallel \
  --max-model-len 262144 --gpu-memory-utilization 0.85 --max-num-seqs 16 \
  --max-num-batched-tokens 8192 --no-enable-prefix-caching --enable-chunked-prefill \
  --distributed-executor-backend mp --disable-custom-all-reduce \
  --compilation-config '{"mode":3,"cudagraph_mode":"FULL_DECODE_ONLY"}' \
  --cudagraph-capture-sizes 1 2 4 8 16

swe-prefix-reuse run --workload prepared/qwen35.json \
  --endpoint http://127.0.0.1:18180/v1/completions --model qwen3.5-35b-a3b \
  --server-max-context 262144 --concurrency 8 --duration 900 --chips 2 \
  --server-metadata server-metadata.json --output results/c8-900s
```

TPOT and E2E P95 are not in the tool's `summary.json`; they were computed from the in-window
requests in `requests.jsonl` (`requests_artifact_sha256` is in the evidence file). TTFT P95 is taken
from `summary.json`.
