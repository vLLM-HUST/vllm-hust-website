# Qwen3.5-35B-A3B W8A8 · 单卡 (TP1) SWE prefix reuse 并发曲线 (C1 / C2 / C4 / C8 / C16)

本报告由实测产物直接生成, 数值零推断。每一档是一个独立的 900s 固定窗口观测, 五档在**同一个服务实例**内按 C1→C16 连续完成 (档间不重启服务、不重置 prefix cache),
因此档间唯一变量就是客户端并发 C。

**本页对应 series `swe-w8a8-tp1-20261014-mtp2` (TP1, 1×910B3)**。与已发布的 TP2 曲线
(`swe-w8a8-tp2-20260929-mtp2-r2`) 使用同一份 prepared workload、同一个客户端、同一协议、同一硬件型号与软件栈; 差别只有单卡 TP1
与随单卡重新标定的 KV 预算。

## 1. 裁定口径

| 项           | 取值                                                                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 硬件         | Ascend 910B3 × 1 (physical devices [0])                                                                                                                                                                                                                                                         |
| 引擎         | vLLM + vLLM-Ascend `0.28.1.post1.dev143+gf18cf803c / 0.25.1rc2.dev125+hust.20260903.4.g74f0c0a27`                                                                                                                                                                                               |
| 模型         | Qwen3.5-35B-A3B @ `712cf74392b05026a6db2bf213d343747d1f6d45`                                                                                                                                                                                                                                    |
| 精度         | W8A8 weights/compute · BF16 KV — int8 (msModelSlim ascendv1 离线量化, 10 个 quant_model_weights 分片); act int8 (动态 per-token); KV auto (bf16; KV 未量化)                                                                                                                                     |
| 并行         | TP1 · PP1 · DP1 · EP=False                                                                                                                                                                                                                                                                      |
| 并发座位     | max-num-seqs 16                                                                                                                                                                                                                                                                                 |
| KV 预算      | `20242376704` (18.85 GiB, 显式) — 262144 上下文下最大并发 3.07x                                                                                                                                                                                                                                 |
| 投机解码     | real MTP, num_speculative_tokens=2 (真实接受/拒绝, 无 synthetic 覆盖); 服务端日志实测 Mean acceptance length 2.876–2.906 (每档 n=90 采样)                                                                                                                                                       |
| MOD          | ascend-mtp-contract-2patch — 两个 engine 契约补丁: (1) vllm_ascend/platform.py NPUPlatform.check_runner_kv_caches_multi_layer() no-op; (2) vllm_ascend/worker/model_runner_v1.py:898 改传 self.\_get_mamba_state_copy_funcs() (dict)。MTP2 为真实接受/拒绝, 无 synthetic sampler 覆盖。         |
| Graph        | FULL_DECODE_ONLY (请求 FULL, 平台因 AscendGDNAttentionBackend 仅支持 UNIFORM_BATCH 而降级); max_cudagraph_capture_size=256                                                                                                                                                                      |
| runtime 提交 | vllm `f18cf803c5f6` / vllm-ascend `74f0c0a27237`                                                                                                                                                                                                                                                |
| runtime 版本 | vllm 0.28.1.post1.dev143+gf18cf803c; vllm-ascend 0.25.1rc2.dev125+hust.20260903.4.g74f0c0a27; torch 2.13.0+cpu; torch_npu 2.13.0.rc1; Ascend CANN 9.1.0 (逐进程临时环境: /data/jxd/Ascend-9.1.0/{ascend-toolkit,nnal/atb}; 系统自带 /usr/local/Ascend CANN 8.5.0 未改动、未覆盖), ATB CXX ABI=1 |
| 客户端       | swe-prefix-reuse `6861242dbd9f17b707003191e4200b7752911d7c` (0.1.2)                                                                                                                                                                                                                             |
| workload     | `https://github.com/vLLM-HUST/swe-prefix-reuse` prepared/qwen35.json sha256 `ac1fbf9885076c369fd25c5525d1163ff8b7945972cdf4c0c6d2d523ab7c1172`                                                                                                                                                  |
| 窗口         | 每档 60s 协议/缓存资格 + 900s 正式窗口; 总吞吐只计窗口内收到的实际输出 token                                                                                                                                                                                                                    |
| 坐标轴       | x = P90 across fully completed in-window requests of (N-1)/(last-token-time-first-token-time); grouped SSE token times, not inverse P90 TPOT; y = In-window generated tokens / 900 seconds / every allocated chip                                                                               |

## 2. 结果

| C   | run_id         | output tps | tps/卡   | P90 decode tps | TTFT p95 (s) | 窗口内完成 / 启动 | 在途均值 | 满载占比 | 最大 prompt | drain (s) |
| --- | -------------- | ---------- | -------- | -------------- | ------------ | ----------------- | -------- | -------- | ----------- | --------- |
| C1  | `c5185b6fec70` | 88.0300    | 88.0300  | 98.6721        | 0.736        | 143 / 144         | 0.9995   | 0.9995   | 52505       | 12.03     |
| C2  | `364918f0a6d7` | 148.9056   | 148.9056 | 90.8362        | 1.044        | 203 / 205         | 1.9990   | 0.9990   | 70940       | 7.19      |
| C4  | `bcb1f419331e` | 198.6622   | 198.6622 | 64.9734        | 1.600        | 281 / 285         | 3.9986   | 0.9986   | 66020       | 11.29     |
| C8  | `90045a491387` | 304.6978   | 304.6978 | 54.9497        | 1.663        | 444 / 452         | 7.9976   | 0.9976   | 79519       | 57.61     |
| C16 | `69ab051c2e66` | 205.5767   | 205.5767 | 27.7368        | 11.925       | 351 / 367         | 15.9988  | 0.9989   | 40244       | 63.02     |

单卡时 `tps/卡` 等于总吞吐 (只有一张卡)。C1–C8 段每卡吞吐单调上升, **C16 相对 C8 回落**, 且 TTFT p95 由 1.663s 涨到 11.925s —— 见第
5、6 节。

## 3. 每档工作量与资格窗口

| C   | 完成会话 | 覆盖轨迹 | 最大 turn | 60s 资格窗口   | 资格失败请求 | 正式窗口失败请求 | 正式窗口有效 |
| --- | -------- | -------- | --------- | -------------- | ------------ | ---------------- | ------------ |
| C1  | 5        | 6 / 8    | 38        | `fb4510415c81` | 0            | 0                | 是           |
| C2  | 5        | 7 / 8    | 48        | `eb54d49f12eb` | 0            | 0                | 是           |
| C4  | 6        | 8 / 8    | 43        | `abb6d1e41211` | 0            | 0                | 是           |
| C8  | 9        | 8 / 8    | 61        | `6851bee86a18` | 0            | 0                | 是           |
| C16 | 6        | 8 / 8    | 29        | `8c38bfad5e6a` | 0            | 0                | 是           |

## 4. 曲线与站点数据

cohort `qwen35-35b-a3b-w8a8-tp1-1x910b3-full-decode-only-sweprefix-900s-v1`; 渲染器
`scripts/render_swe_w8a8_tp1_curves.py`; SVG `assets/frontier-qwen35-w8a8-tp1-swe-concurrency.svg`;
测试 `tests/test_swe_w8a8_tp1_frontier_curves.py`。

## 5. 口径限制 (必须与数值一起引用)

- 客户端与 engine 同机 (127.0.0.1), 客户端调度/JSON/网络开销仍在观测路径内
- 未做预热: 每个 play 使用新 cache_salt 冷启动, 窗口结束排空在途请求
- 本轮为 60s 短测 + 900s 固定窗口两个显式测量, 无自动认证语义
- 首次冷编译: 因关闭 torch AOT autograd 缓存, 每轮启动都要重跑 torch.compile + ACL 图捕获, 该时间不计入测量窗口
- CANN 9.1 为逐进程临时环境 (未覆盖系统 8.5.0); 引擎实际加载的 CANN 版本见启动日志的 ASCEND_HOME_PATH
- 样例 workload 仅 8 条轨迹/360 轮, 非统计代表性 SWE 样本; 最长会话 141269 tokens, 未触及 262144 上限
- MTP 特有: 请求的 cudagraph_mode=FULL 被平台降级为 FULL_DECODE_ONLY (AscendGDNAttentionBackend 仅声明
  UNIFORM_BATCH)
- MTP 特有: 每次带 MTP 的运行都会留下一条不可用的 AOT 编译缓存条目, 故每轮实验前需隔离 torch_aot_compile/\*
- MTP 特有: 前缀复用可用, 但受 EAGLE/MTP 尾块丢弃语义影响, 每个请求比无 MTP 时少复用 1 个 block (2048 token)
- 两个 engine 契约补丁为本地最小改动, 未进入上游; 若上游修复该契约, 本点的 mod 块需相应更新
- TP1 特有: 单卡 KV 预算 18.85 GiB -> 805156 token -> 262144 上下文下最大并发 3.07x, 低于 TP2 的 9.87x; 这是 C16
  塌方的直接约束
- TP1 特有: 服务端同样打印 kv_cache_utils.py 的 'no KV cache group could be identified' 告警; 该告警在 0.28.1 上过宽,
  本机用同判据 (vllm:prefix_cache_hits_total 增量) 实测前缀复用真实生效
- TP1 特有: 拒绝 token 只计窗口内, 窗口后的 drain 不计入; 各档 drain 时长已单列

服务启动命令 (五档同一实例, 来源 server-metadata):

```
ASCEND_RT_VISIBLE_DEVICES=0 TP=1 PORT=8100 MAX_MODEL_LEN=262144 GPU_MEM_UTIL=0.95 VLLM_ENGINE_READY_TIMEOUT_S=3600 LABEL=w8a8 EXTRA_SERVER_ARGS='--max-num-seqs 16 --kv-cache-memory-bytes 20242376704 --max-num-batched-tokens 4096 --speculative-config {"method":"mtp","num_speculative_tokens":2} --compilation-config {"max_cudagraph_capture_size":256,"cudagraph_mode":"FULL"}' ./run_swe_server.sh   # 展开后: vllm serve /data/jxd/Qwen3.5-35B-A3B-W8A8 --served-model-name qwen35-a3b-w8a8 --tensor-parallel-size 1 --max-model-len 262144 --gpu-memory-utilization 0.95 --trust-remote-code --host 127.0.0.1 --port 8100 --quantization ascend --max-num-seqs 16 --kv-cache-memory-bytes 20242376704 --max-num-batched-tokens 4096 --speculative-config {"method":"mtp","num_speculative_tokens":2} --compilation-config {"max_cudagraph_capture_size":256,"cudagraph_mode":"FULL"}
```

## 6. C16 回落: 是实测结论, 不是故障

C16 相对 C8 回落 32.5% (304.6978 → 205.5767 output tps)。已核实的成因与排除项:

- **KV 容量约束**: 单卡 KV 预算 18.85 GiB -> 805156 token -> 服务启动日志记录
  `Maximum concurrency for 262144 tokens per request: 3.07x`。本 workload 在 C16 下 实际向调度器投入 16 路请求,
  远超该上限, 因此请求不得不在队列中排队并通过更小的 prefill 批次推进。
- **前缀复用被稀释**: 边际 (逐档差分) 命中率在 C1–C8 为 80.7/85.3/85.3/84.7%, C16 掉到 34.6%; cache miss 由 C8 的 1766761
  升到 C16 的 3347229 (×1.89), 与 prompt 吞吐由 1966 升到 3666 tok/s (×1.86) 一致。
- **decode 步被 prefill 打断**: C16 的步间隔分布呈双峰, p50 0.063s 但 p90 0.507s, 30.75% 的步超过 0.2s, 且集中在
  0.50–0.54s 窄带 —— 等于一个 4096-token prefill chunk 除以实测峰值 prefill 速率 6719 tok/s。TP2 同等条件下该比例只有 10.01%。
- **已排除**: 算力饱和 (AICore 均值 29.9% / 峰值 50%)、排队异常 (waiting 峰值 3)、硬性 KV 耗尽 (峰值 82.8%)、偶发故障 (见下)。

**重跑验证**: C16 在 `tp1-rr1-c16-{check,900s}` 下独立重跑一次, output tps 205.5767 → 201.0933 (−2.18%), decode
P90 27.74 → 26.58 (−4.16%), TTFT p95 11.925 → 11.566 (−3.01%); 指纹字段逐字节一致:
`max_turn_index_reached=29`、`sessions_completed=6`、`full_concurrency_fraction` 与
`mean_client_inflight` 到写出精度相同。因此 C16 是稳定的饱和观测, 不是瞬态故障。

**与 TP2 的对照** (同一客户端 / workload / 协议, 差别只有并行规模与 KV 预算):

| C   | TP2 总吞吐 | TP2 每卡 | TP1 每卡 | TP1 TTFT p95 (s) |
| --- | ---------- | -------- | -------- | ---------------- |
| C1  | 91.58      | 45.79    | 88.0300  | 0.736            |
| C2  | 144.18     | 72.09    | 148.9056 | 1.044            |
| C4  | 219.08     | 109.54   | 198.6622 | 1.600            |
| C8  | 335.84     | 167.92   | 304.6978 | 1.663            |
| C16 | 440.87     | 220.43   | 205.5767 | 11.925           |

结论: 在 C1–C8 段, 单卡每卡吞吐是双卡的 1.8–1.9 倍 (双卡并行并未带来超线性收益); 但在 C16 档, 单卡受 KV 容量约束回落, 双卡每卡反超。该 workload
在单卡上的可用工作点应取 C8 及以下。
