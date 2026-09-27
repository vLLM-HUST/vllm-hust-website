# Qwen3.5-35B KVCompress Frontier results

KVCompress was launched through ECPA and compared with the single existing Qwen3.5-35B unified
Native series. Each cell is one real-online 900-second observation. Values are output token/s.

| Concurrency | Native | KVCompress |  Change |
| ----------: | -----: | ---------: | ------: |
|          C1 |  91.55 |      82.05 | -10.38% |
|          C2 | 152.72 |     145.40 |  -4.80% |
|          C4 | 217.48 |     215.59 |  -0.87% |
|          C8 | 291.11 |     280.10 |  -3.78% |
|         C16 | 359.75 |     327.33 |  -9.01% |

Geometric mean throughput change: **-5.83%**.

Fixed controls: Qwen3.5-35B-A3B BF16, TP2/PP1, 262144-token context, APC, aligned Mamba cache,
asynchronous scheduling, native MTP2, FULL_AND_PIECEWISE graph mode, 16 maximum sequences, 4096
maximum batched tokens, and 26038239232 KV-cache bytes per chip.

The run recorded 1217 successful compression scheduler commits with matching TP0/TP1 worker
acknowledgements, passed 26/26 retrieval checks and the prefix-reuse gate, completed with zero
failed requests, and released both selected NPUs.

Plugin revision:
[`ed058fa1e45a6830776ccc10b6100537b8fc4fde`](https://github.com/vLLM-HUST/vllm-ascend-kvcompress-hust/commit/ed058fa1e45a6830776ccc10b6100537b8fc4fde).
