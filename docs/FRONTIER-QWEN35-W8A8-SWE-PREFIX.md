# Qwen3.5-35B-A3B W8A8 · SWE prefix reuse 并发曲线 (C1 / C2 / C4 / C8 / C16)

本报告由实测产物直接生成, 数值零推断。每一档是一个独立的 900s 固定窗口观测, 五档在**同一个服务实例**内按 C1→C16 连续完成 (档间不重启服务、不重置 prefix cache),
因此档间唯一变量就是客户端并发 C。

**修订说明**: 本页对应 series `swe-w8a8-tp2-20260929-mtp2-r2` (r2)。它是一个**口径修复后的重跑**: r1 批次的服务命令只显式给了
`--gpu-memory-utilization 0.85`, KV 预算与 batch token 预算都走引擎默认值, 实测服务端全程只同时跑 1 个请求, 5 档数值不构成并发曲线结论 ——
详见第 6 节。

## 1. 裁定口径

| 项           | 取值                                                                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 硬件         | Ascend 910B3 × 2 (physical devices [0, 1])                                                                                                                                                                                                                                                      |
| 引擎         | vLLM + vLLM-Ascend `0.28.1.post1.dev143+gf18cf803c / 0.25.1rc2.dev125+hust.20260903.4.g74f0c0a27`                                                                                                                                                                                               |
| 模型         | Qwen3.5-35B-A3B @ `712cf74392b05026a6db2bf213d343747d1f6d45`                                                                                                                                                                                                                                    |
| 精度         | W8A8 weights/compute · BF16 KV — int8 (msModelSlim ascendv1 离线量化, 10 个 quant_model_weights 分片); act int8 (动态 per-token); KV auto (bf16; KV 未量化)                                                                                                                                     |
| 并行         | TP2 · PP1 · DP1 · EP=False                                                                                                                                                                                                                                                                      |
| 并发座位     | max-num-seqs 16                                                                                                                                                                                                                                                                                 |
| 投机解码     | real MTP, num_speculative_tokens=2 (真实接受/拒绝, 无 synthetic 覆盖)                                                                                                                                                                                                                           |
| MOD          | ascend-mtp-contract-2patch — 两个 engine 契约补丁: (1) vllm_ascend/platform.py NPUPlatform.check_runner_kv_caches_multi_layer() no-op; (2) vllm_ascend/worker/model_runner_v1.py:898 改传 self.\_get_mamba_state_copy_funcs() (dict)。MTP2 为真实接受/拒绝, 无 synthetic sampler 覆盖。         |
| Graph        | FULL_DECODE_ONLY (请求 FULL, 平台因 AscendGDNAttentionBackend 仅支持 UNIFORM_BATCH 而降级); max_cudagraph_capture_size=256                                                                                                                                                                      |
| runtime 提交 | vllm `f18cf803c5f6` / vllm-ascend `74f0c0a27237`                                                                                                                                                                                                                                                |
| runtime 版本 | vllm 0.28.1.post1.dev143+gf18cf803c; vllm-ascend 0.25.1rc2.dev125+hust.20260903.4.g74f0c0a27; torch 2.13.0+cpu; torch_npu 2.13.0.rc1; Ascend CANN 9.1.0 (逐进程临时环境: /data/jxd/Ascend-9.1.0/{ascend-toolkit,nnal/atb}; 系统自带 /usr/local/Ascend CANN 8.5.0 未改动、未覆盖), ATB CXX ABI=1 |
| 客户端       | swe-prefix-reuse `6861242dbd9f17b707003191e4200b7752911d7c` (0.1.2)                                                                                                                                                                                                                             |
| workload     | `https://github.com/vLLM-HUST/swe-prefix-reuse` prepared/qwen35.json sha256 `ac1fbf9885076c369fd25c5525d1163ff8b7945972cdf4c0c6d2d523ab7c1172`                                                                                                                                                  |
| 窗口         | 每档 60s 协议/缓存资格 + 900s 正式窗口; 总吞吐只计窗口内收到的实际输出 token (在途排空请求在窗口内收到的部分计入, 窗口后的 token 不计)                                                                                                                                                          |
| 坐标轴       | x = P90 across fully completed in-window requests of (N-1)/(last-token-time-first-token-time); grouped SSE token times, not inverse P90 TPOT; y = In-window generated tokens / 900 seconds / every allocated chip                                                                               |

## 2. 结果

| C   | run_id         | output tps | tps/卡   | P90 decode tps | TTFT p95 (s) | 窗口内完成 / 启动 | 在途均值 | 满载占比 | 最大 prompt | drain (s) |
| --- | -------------- | ---------- | -------- | -------------- | ------------ | ----------------- | -------- | -------- | ----------- | --------- |
| C1  | `7b2a60c01325` | 91.5756    | 45.7878  | 101.8974       | 0.747        | 147 / 148         | 0.9994   | 0.9994   | 52505       | 1.59      |
| C2  | `52c159615877` | 144.1822   | 72.0911  | 87.2265        | 1.231        | 196 / 198         | 1.9991   | 0.9991   | 64999       | 3.51      |
| C4  | `b3bcd89a7ba3` | 219.0800   | 109.5400 | 74.0776        | 1.525        | 325 / 329         | 3.9979   | 0.9979   | 73616       | 16.62     |
| C8  | `37e3a43cfd3b` | 335.8400   | 167.9200 | 63.7543        | 1.793        | 480 / 488         | 7.9970   | 0.9970   | 82121       | 17.26     |
| C16 | `c6dc00b19a5d` | 440.8689   | 220.4344 | 39.3954        | 2.572        | 663 / 679         | 15.9968  | 0.9969   | 64136       | 58.69     |

## 3. 每档工作量与资格窗口

| C   | 完成会话 | 覆盖轨迹 | 最大 turn | 60s 资格窗口   | 资格失败请求 | 正式窗口失败请求 | 正式窗口有效 |
| --- | -------- | -------- | --------- | -------------- | ------------ | ---------------- | ------------ |
| C1  | 5        | 6 / 8    | 38        | `0f733f65e6b4` | 0            | 0                | 是           |
| C2  | 5        | 7 / 8    | 43        | `042636f74568` | 0            | 0                | 是           |
| C4  | 8        | 8 / 8    | 52        | `e3c362574252` | 0            | 0                | 是           |
| C8  | 9        | 8 / 8    | 64        | `b215f5560b59` | 0            | 0                | 是           |
| C16 | 14       | 8 / 8    | 43        | `599849131cb2` | 0            | 0                | 是           |

## 4. 曲线与站点数据

站点渲染器: `scripts/render_swe_w8a8_curves.py`; SVG: `assets/frontier-qwen35-w8a8-swe-concurrency.svg`;
测试: `tests/test_swe_w8a8_frontier_curves.py`。

## 5. 口径限制 (必须与数值一起引用)

- **C16 是 16 路 offered load**: workload 只有 8 条源轨迹, 客户端按全局 session 轮转 + 每 lane 独立 cache_salt 供给; 因此
  C16 时其中 8 条 lane 以不同 salt 重放已在途的同一轨迹, 不共享 prefix cache。它是 max-num-seqs=16 的饱和档, 不是 16 个不同的 SWE 会话。
- **单实例串行观测**: 五档共用同一个服务实例 (启动命令见下), 因此不是统计独立的重复; 不做重复性估计。
- **不是跨精度/跨引擎加速结论**: 与 BF16 cohort 的差异是精度口径差异; 本曲线只描述 W8A8 + real MTP2 在 TP2 / max-num-seqs 16 下的 C
  扫描。
- **不是 SWE 解题能力**: 本条只测吞吐/延迟与 prefix 复用的服务侧行为, LLM 输出内容不参与评分。
- **tuning 未完成**: ready-queue 与 KV 预算未扫参; 每档仅一次 900s 观测。

服务启动命令 (领档同一实例, 来源 server-metadata):

```
/data/jxd/envs/vllm-hust-v1-cann91/bin/vllm serve /data/jxd/Qwen3.5-35B-A3B-W8A8 --served-model-name qwen35-a3b-w8a8 --tensor-parallel-size 2 --max-model-len 262144 --gpu-memory-utilization 0.95 --trust-remote-code --host 127.0.0.1 --port 8100 --quantization ascend --max-num-seqs 16 --kv-cache-memory-bytes 26038239232 --max-num-batched-tokens 4096 --speculative-config {"method":"mtp","num_speculative_tokens":2} --compilation-config {"max_cudagraph_capture_size":256,"cudagraph_mode":"FULL"}
```

## 6. 口径修复说明 (相对 r1 批次)

r1 批次 (series `swe-w8a8-tp2-20260929-mtp2-r1`) 的 5 档数值**不是硬件或负载结论**: 该批次的服务命令显式给了
`--gpu-memory-utilization 0.85`, 但没有显式指定 `--kv-cache-memory-bytes` 与 `--max-num-batched-tokens`
(二者走引擎默认值), 实测服务端 `vllm:num_requests_running` 在每档 900s 窗口内恒为 1, `vllm:num_requests_waiting` = C-1
(16 路请求从未同时进入 running), 吞吐在 C1 附近即饱和。

本 r2 曲线只改这 3 个服务参数 (其中 `--gpu-memory-utilization` 是改值, 另两个由引擎默认改为显式固化); 客户端工具版本、prepared workload
sha256、协议、硬件、TP2 / max-num-seqs 16 / real MTP2 与 r1 逐字节相同:

| 服务参数                   | r1 (缺口径)   | r2 (本曲线) |
| -------------------------- | ------------- | ----------- |
| `--gpu-memory-utilization` | 0.85 (显式)   | 0.95        |
| `--kv-cache-memory-bytes`  | 未指定        | 26038239232 |
| `--max-num-batched-tokens` | 未指定 (默认) | 4096        |

两代同一档位的实测对照 (同样的客户端、workload、协议与硬件):

| C   | r1 output tps (缺口径) | r2 output tps (本曲线) | 倍数  |
| --- | ---------------------- | ---------------------- | ----- |
| C1  | 84.8000                | 91.5756                | ×1.08 |
| C2  | 87.4889                | 144.1822               | ×1.65 |
| C4  | 83.1544                | 219.0800               | ×2.63 |
| C8  | 86.3678                | 335.8400               | ×3.89 |
| C16 | 84.6822                | 440.8689               | ×5.21 |

诊断过程 (微探针、三项 flag 的排查、判定实验 capkv1 与重跑编排) 见测量方仓库的 `DIAGNOSIS-w8a8-concurrency.md`; 本次只替换站点点位与 SVG
的坐标数值, r1 的 5 档数值不再出现在本站数据中。
