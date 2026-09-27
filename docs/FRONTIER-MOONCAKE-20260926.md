# Qwen3.5 Mooncake matched Frontier observations

Completed 2026-09-26; published 2026-09-27. Evidence: **real-online**.

The manager-launched **AscendStoreConnector with the Mooncake backend** completed C1/C2/C4/C8/C16
and matched Native controls. Throughput was 1.02%–2.66% lower. Each point is one observation; this
does not establish repeatability or a speedup. This is a separate integration from the official
MooncakeStoreConnector described in the plugin catalog.

Qwen3.5-35B-A3B BF16, TP2/PP1, two Ascend 910B2 chips, 262144 context capacity, APC, MTP2, async
scheduling and FULL_AND_PIECEWISE graph execution were retained. Captures: 3/6/12/24/48, max
sequences 16, batch tokens 4096, explicit KV budget 26038239232 bytes/chip. Mooncake uses a 16
GiB/rank Store segment. Deployment environment is provenance, not a MOD.

Each fresh service passed all 26 retrieval checks and a 60-second prefix-reuse gate, then ran serial
900-second windows without cache resets. Token output after the measurement window was excluded. The
workload is closed-loop: generated tokens feed later turns; equal budgets do not imply identical
generated content.

| Concurrency | Native total tokens/s | Mooncake total tokens/s | Change |
| ----------- | --------------------- | ----------------------- | ------ |
| 1           | 92.48                 | 91.19                   | -1.40% |
| 2           | 153.28                | 150.94                  | -1.53% |
| 4           | 219.22                | 216.28                  | -1.34% |
| 8           | 293.93                | 290.93                  | -1.02% |
| 16          | 361.25                | 351.63                  | -2.66% |

No backend-specific transfer counters were available in the captured serving metrics. Transfer
effectiveness is **unavailable**, not zero. Prefix hits and a loaded connector do not prove an
offload benefit.

Both arms released their owned processes and returned NPU0/1 HBM to approximately 3.4 GiB idle
usage. Mooncake required bounded SIGTERM/SIGKILL cleanup of its owned process group after the
manager exited; Native required an additional SIGTERM. Thus the release receipts do not claim every
child exited normally. No heap-corruption fatal markers were observed in the retained logs.

Source:
[frozen experiment harness](https://github.com/vLLM-HUST/vllm-hust-dev-hub/tree/520acc2/scripts/frontier_mooncake).
The common host includes hybrid-prefix capability fix 49f082797535ef2f730639e008588a5912a20d2c and
the recorded Ascend tracker fix; exact file hashes and manager plans are in the metadata. Compact
chart records replace duplicated file maps with their counts and canonical JSON SHA256; full
metadata files retain the original bytes.

Public evidence:
[Native metadata](../reports/frontier-managed-mooncake-20260926/metadata-native.json.gz),
[Mooncake metadata](../reports/frontier-managed-mooncake-20260926/metadata-mooncake.json.gz),
[source manifest](../reports/frontier-managed-mooncake-20260926/manifest.json.gz),
[paired completion](../reports/frontier-managed-mooncake-20260926/pair-status.json),
[independent raw-stream metric audit](../reports/frontier-managed-mooncake-20260926/latency-audit.json).
Each point also links its compressed raw requests. All ten windows passed independent recomputation
of throughput, P90 decode speed, P95 TTFT and mean client concurrency.

Full retained experiment archive SHA256:
`78f3a2694701a264c9f7a9086618a1cb280de37fed11d14d297e682fe230e11f`. This identifies the retained
local capsule, not a public archive download.
