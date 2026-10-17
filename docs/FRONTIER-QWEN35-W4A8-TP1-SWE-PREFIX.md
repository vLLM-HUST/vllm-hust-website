# Qwen3.5-35B-A3B W4A8 (专家层 int4) · 单卡 (TP1) SWE prefix reuse 并发曲线 (C1 / C2 / C4 / C8 / C16)

本报告由实测产物直接生成, 数值零推断。每一档是一个独立的 900s 固定窗口观测, 五档在**同一个服务实例**内按 C1→C16 连续完成 (档间不重启服务、不重置 prefix cache),
因此档间唯一变量就是客户端并发 C。

**本页对应 series `swe-w4a8-tp1-20261016-mtp2` (TP1, 1×910B3)**。本 cohort 的 KV 预算由服务端为本产物 显式设定 (32.55
GiB, 见第 1 节)。为说明这个预算在曲线里起什么作用, 本工作区在同一张卡 (卡 7) 上背靠背 另跑了**同权重的 KV 对照臂** (权重同为专家层 int4, 只把 KV 收紧到
18.85 GiB), 覆盖 C1/C8/C16 三档; 该对照臂**不作为 Frontier 条目提交**, 只用于第 5、6 节的变量分离。

## 1. 裁定口径

| 项           | 取值                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 硬件         | Ascend 910B3 × 1 (physical devices [7])                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 引擎         | vLLM + vLLM-Ascend `0.28.1.post1.dev143+gf18cf803c / 0.25.1rc2.dev125+hust.20260903.4.g74f0c0a27`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 模型         | Qwen3.5-35B-A3B (MoE)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 精度         | **W4A8**: MLP 专家层 (gate/up/down_proj) int4 权重 / int8 激活; self_attn 等其余量化层仍为 int8 权重/int8 激活 (在 int8 配方基线上只把 `*mlp.experts*` 换成 int4/ssz, msModelSlim ascendv1 离线量化, 6 个 quant_model_weights 分片); KV auto (bf16; KV 未量化)。反量化 cos 0.9907–0.9933                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 权重产物指纹 | `quant_model_description.json` sha256 `eb9a3ea871cefd0870d8a6a696d9e3444477c37e6999680d24be4e11d3d4453f`; `quant_model_weights.safetensors.index.json` sha256 `f76730c2ac6919e569d176aba42c9df35404ab33dd3a5dcff3becedbabb825a5`; 权重 23.38 GiB                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 并行         | TP1 · PP1 · DP1 · EP=False                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 并发座位     | max-num-seqs 16                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| KV 预算      | **`34953463839` (32.55 GiB, 显式) — 262144 上下文下最大并发 5.31x** (实测 1391235 token)。该值由服务端为本产物显式设定: 专家层 int4 权重 23.38 GiB + KV 32.55 GiB ≈ 55.9 GiB, 落在 64 GB 单卡 `gpu_memory_utilization=0.95` 的预算内。**它是一个部署选择, 不是 int4 自带的加速**                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 投机解码     | real MTP, num_speculative_tokens=2 (真实接受/拒绝, 无 synthetic 覆盖); 服务端日志实测 Mean acceptance length 2.898–2.910 (每档 n=90–99 采样)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| MOD          | `ascend-mtp-contract-2patch` + `ascend-npugraph-ex-attr-shim` — (1) `vllm_ascend/platform.py` NPUPlatform.check_runner_kv_caches_multi_layer() no-op; (2) `vllm_ascend/worker/model_runner_v1.py:898` 改传 `self._get_mamba_state_copy_funcs()` (dict)。(1)(2) 是 0.28.1 运行时契约所需的两处补丁。 (3) `vllm_ascend/compilation/compiler_interface.py` 的 npugraph_ex 属性 stand-in, mtime 2026-10-16, 是本次新增的一处: 其生效条件是编译图中存在 `npu.npu_weight_quant_batchmatmul` (W8A16) 节点, 而本产物的 `quant_model_description` 不含任何 W8A16 条目 (实测只有 FLOAT / W8A8_DYNAMIC / W4A8_DYNAMIC), 服务端日志中 `w8a16`/`experimental_config` 零次出现, 故对本模型为**惰性**。MTP2 为真实接受/拒绝 |
| Graph        | FULL_DECODE_ONLY (请求 FULL, 平台因 AscendGDNAttentionBackend 仅支持 UNIFORM_BATCH 而降级); max_cudagraph_capture_size=256                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| runtime 提交 | vllm `f18cf803c5f6` / vllm-ascend `74f0c0a27237`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| runtime 版本 | vllm 0.28.1.post1.dev143+gf18cf803c; vllm-ascend 0.25.1rc2.dev125+hust.20260903.4.g74f0c0a27; torch 2.13.0+cpu; torch_npu 2.13.0.rc1; Ascend CANN 9.1.0 (逐进程临时环境: /data/jxd/Ascend-9.1.0/{ascend-toolkit,nnal/atb}; 系统自带 /usr/local/Ascend CANN 8.5.0 未改动、未覆盖), ATB CXX ABI=1                                                                                                                                                                                                                                                                                                                                                                                                              |
| 客户端       | swe-prefix-reuse `6861242dbd9f17b707003191e4200b7752911d7c` (0.1.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| workload     | `https://github.com/vLLM-HUST/swe-prefix-reuse` prepared/qwen35.json sha256 `ac1fbf9885076c369fd25c5525d1163ff8b7945972cdf4c0c6d2d523ab7c1172`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 窗口         | 每档 60s 协议/缓存资格 + 900s 正式窗口; 总吞吐只计窗口内收到的实际输出 token                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 坐标轴       | x = P90 across fully completed in-window requests of (N-1)/(last-token-time-first-token-time); grouped SSE token times, not inverse P90 TPOT; y = In-window generated tokens / 900 seconds / every allocated chip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## 2. 结果

| C   | run_id         | output tps | tps/卡   | P90 decode tps | TTFT p95 (s) | 窗口内完成 / 启动 | 在途均值 | 满载占比 | 最大 prompt | drain (s) |
| --- | -------------- | ---------- | -------- | -------------- | ------------ | ----------------- | -------- | -------- | ----------- | --------- |
| C1  | `5b5d35933b2f` | 87.4011    | 87.4011  | 98.6658        | 0.753        | 143 / 144         | 0.9995   | 0.9995   | 52505       | 17.77     |
| C2  | `9a4e81797200` | 150.8744   | 150.8744 | 91.6978        | 1.041        | 209 / 211         | 1.9989   | 0.9989   | 71846       | 0.88      |
| C4  | `11411e908eaa` | 202.1389   | 202.1389 | 65.6202        | 1.566        | 286 / 290         | 3.9985   | 0.9985   | 67073       | 7.09      |
| C8  | `718876384df6` | 313.3722   | 313.3722 | 56.1269        | 1.729        | 457 / 465         | 7.9976   | 0.9976   | 80104       | 46.73     |
| C16 | `62cad876975a` | 394.3378   | 394.3378 | 34.8946        | 2.624        | 603 / 619         | 15.9976  | 0.9976   | 59957       | 86.53     |

单卡时 `tps/卡` 等于总吞吐 (只有一张卡)。**五档吞吐单调上升, C16 = 394.3378 是本曲线的峰值, 没有回落**; TTFT p95 在 C16 仍只有 2.624s。成因见第
6 节。

## 3. 每档工作量与资格窗口

| C   | 完成会话 | 覆盖轨迹 | 最大 turn | 60s 资格窗口   | 资格失败请求 | 正式窗口失败请求 | 正式窗口有效 |
| --- | -------- | -------- | --------- | -------------- | ------------ | ---------------- | ------------ |
| C1  | 5        | 6 / 8    | 38        | `47d01ce5e458` | 0            | 0                | 是           |
| C2  | 5        | 7 / 8    | 51        | `30675b71980d` | 0            | 0                | 是           |
| C4  | 6        | 8 / 8    | 44        | `ebce96d4f0c5` | 0            | 0                | 是           |
| C8  | 9        | 8 / 8    | 62        | `095ad7d68d3c` | 0            | 0                | 是           |
| C16 | 11       | 8 / 8    | 41        | `f3a3b0e1c32c` | 0            | 0                | 是           |

## 4. 曲线与站点数据

cohort `qwen35-35b-a3b-w4a8-tp1-1x910b3-full-decode-only-sweprefix-900s-v1`; 渲染器
`scripts/render_swe_w4a8_tp1_curves.py`; SVG `assets/frontier-qwen35-w4a8-tp1-swe-concurrency.svg`;
测试 `tests/test_swe_w4a8_tp1_frontier_curves.py`。

本 cohort 只有一条 real-MTP2 线 (C1..C16 五点在同一个服务实例内串行测得)。三个本地 mod 对本模型 均为惰性 (见第 1 节 MOD), 不存在第二条 "native"
对照线可画。

## 5. KV 预算的变量分离: 本 cohort (A) 与同权重对照臂 (C)

两臂都是本工作区自己跑出来的, 权重是**同一份专家层 int4 产物**, 同一张卡 (卡 7) 背靠背, 同一份 workload / 同一客户端 / 同一协议 /
同一硬件与软件栈。**唯一变量是服务端显式设定的 KV 预算**—— A 臂 = 本 cohort 的 32.55 GiB, C 臂 = 18.85 GiB。C 臂只跑了 C1/C8/C16 三档,
且不作为 Frontier 条目提交。

| C   | **A 本 cohort** (KV 32.55 GiB) | **C 对照臂** (KV 18.85 GiB) | A vs C     |
| --- | ------------------------------ | --------------------------- | ---------- |
| C1  | 87.40                          | 86.56                       | +1.0%      |
| C8  | 313.37                         | 320.42                      | −2.2%      |
| C16 | **394.34**                     | **200.81**                  | **+96.4%** |

逐档 (边际) 前缀缓存命中率 —— 同一份权重, 两次独立测量:

| C   | A (32.55 GiB) | C (18.85 GiB) |
| --- | ------------- | ------------- |
| C1  | 80.87%        | 80.91%        |
| C8  | 84.97%        | 85.11%        |
| C16 | **79.97%**    | **31.96%**    |

TTFT p95 (ms):

| C   | A      | C       |
| --- | ------ | ------- |
| C1  | 752.5  | 760.6   |
| C8  | 1728.7 | 1716.4  |
| C16 | 2624.4 | 12307.5 |

## 6. C16 的增益来自 KV 预算

18.85 GiB 的 KV 在 262144 上下文下只容 3.07x 并发 (实测 805156 token)。C 臂在该预算下跑到 C16 时, 16 路请求超出该上限, 前缀复用被冲掉:
边际命中率由 C8 的 85.11% 掉到 31.96%, 4096-token prefill chunk 插进 decode 步, 吞吐回落到 200.81、TTFT p95 涨到 12.31s。

**同一份权重, 把 KV 预算提到 32.55 GiB (5.31x 并发), C16 的边际命中率保持在 79.97%**, 与 C1–C8 同水平, 所以吞吐继续上升到 394.34, TTFT
p95 停在 2.624s。C16 这一档的 +96.4% 整段由 KV 容量解释。

在 C1 与 C8 两档, 两臂差异分别是 +1.0% 与 −2.2%, 排序非单调 (C8 上收窄 KV 的 C 臂反而更高), 且两臂的命中率 (80.87% / 80.91%) 与 MTP
接受率 (95.73% / 95.92%) 几乎相同 —— 说明这两档的臂间差异 落在平台重复测量的抖动地板内, 不是 KV 的效应。

**必须与数值一起引用的口径限制**: 本 cohort 的 KV 预算是服务端为本产物显式设定的部署选择。 本页只报本 cohort (A 臂) 自身的观测, 不跨 cohort 画线, **不构成
"int4 算子比别的位宽更快" 的结论**; 第 5、6 节的同权重对照臂说明 C16 的增益来自 KV 容量, 与权重位宽无关。

本产物在单卡上的作用是降低显存占用 (专家层 int4 权重 23.38 GiB), 本 cohort 选择把腾出的显存转为 KV 预算, 从而修好了高并发档。

## 7. 口径限制 (必须与数值一起引用)

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
- engine 树含一处本次新增的本地改动 (npugraph_ex 属性 stand-in), 因本产物不含 W8A16 节点故为惰性; 详见第 1 节 MOD 与本 cohort 各点的
  mod_activation
- W4A8 特有: 权重 23.38 GiB + KV 32.55 GiB ≈ 55.9 GiB, 约占满 64 GB 卡的 gpu_memory_utilization=0.95 预算
- W4A8 特有: **C16 档的增益由显式设定的 KV 预算解释, 不是 int4 算子带来的加速** (见第 6 节)
- TP1 特有: 服务端同样打印 kv_cache_utils.py 的 'no KV cache group could be identified' 告警; 该告警在 0.28.1 上过宽,
  本机用同判据 (vllm:prefix_cache_hits_total 增量) 实测前缀复用真实生效
- TP1 特有: 拒绝 token 只计窗口内, 窗口后的 drain 不计入; 各档 drain 时长已单列
- 本报告只回答性能, **未做精度评测** (MMLU-Pro 类); int4 的精度影响不在本页范围内

服务启动命令 (五档同一实例, 来源 server-metadata):

```
ASCEND_RT_VISIBLE_DEVICES=7 TP=1 PORT=8200 MAX_MODEL_LEN=262144 GPU_MEM_UTIL=0.95 LABEL=ab-w4a8max EXTRA_SERVER_ARGS='--max-num-seqs 16 --kv-cache-memory-bytes 34953463839 --max-num-batched-tokens 4096 --speculative-config {"method":"mtp","num_speculative_tokens":2} --compilation-config {"max_cudagraph_capture_size":256,"cudagraph_mode":"FULL"}' ./run_swe_server_ab.sh   # 展开后: vllm serve /data/gcy/Qwen3.5-35B-A3B-W4A8 --served-model-name qwen35-a3b-w4a8 --tensor-parallel-size 1 --max-model-len 262144 --gpu-memory-utilization 0.95 --trust-remote-code --host 127.0.0.1 --port 8200 --quantization ascend --max-num-seqs 16 --kv-cache-memory-bytes 34953463839 --max-num-batched-tokens 4096 --speculative-config {"method":"mtp","num_speculative_tokens":2} --compilation-config {"max_cudagraph_capture_size":256,"cudagraph_mode":"FULL"}
```
