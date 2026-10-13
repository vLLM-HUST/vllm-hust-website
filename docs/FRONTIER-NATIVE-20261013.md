# Native serving-plan campaign · October13

## DeepSeek V4 Flash

[Eleven complete observations, two fixed native configurations and curves](evidence/dsv4-native-20261013/README.md).
The historical September cohort is preserved separately; new-runtime points do not replace
historical measurements or imply exact workload artifact equivalence.

## GLM-5.3 Flash

[Ten complete observations and both fixed-configuration curves](evidence/glm-native-20261013/README.md).
TP8/EP8 W8A8, MTP3, native vLLM0.30 / Ascend0.30rc1, CANN9.1 on eight910B2. The wide configuration
raises max_num_seqs16→32 and token budget2048→4096 together; this is joint configuration tuning, not
single-feature attribution. At C16/C32/C48 it measures34.662/38.169/31.288 output tok/s/card
and2.990/9.495/61.426s P95 TTFT. Every completed plateau/regression point remains in the
downloadable snapshot.

## Accounting and qualification

All windows last900s, follow a separate60s C2 warmup and eight-marker functional gate, use fresh
session salts and append real generated IDs before the next source delta. No download runs during
the measured windows. Diagnostic cache/speculation counters include drain; plotted output counts
only the observation window. Serving Plan uses the same completed-request cohort for new input,
cached input and output, excluding drain and unfinished output. Both conventions remain explicit.

See `data/leaderboard_frontier_native_20261013_evidence.json` for all21 metric receipts. No
synthetic acceptance, generated-text retokenization or cross-model quality equivalence is claimed.
Kimi has no score: the available checkpoint exceeds this deployment’s eight-card capacity before KV;
no compatible smaller quantized artifact was qualified. HY3 is being qualified separately; startup
failures are never scored.

GLM price reference: [official BigModel pricing](https://open.bigmodel.cn/pricing), checked
October13: CNY0.8/M new input,0.23/M cached input,2.8/M output. These editable API-reference
assumptions are not realized revenue or profit.
