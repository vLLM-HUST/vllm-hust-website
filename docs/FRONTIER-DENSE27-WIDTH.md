# Qwen3.8-27B: wider current-State TP2 capacity

These two complete observations extend the [current-State sweep](FRONTIER-DENSE27-CURRENT.md), using
the same eight SWE sessions, MTP2/BF16/FULL4096, 900-second streamed-output window, D1 rotation,
fresh measured session salts and pre/post16-item exact-marker retrieval checks. Execution seats
equal client concurrency; residency adds four seats. Host cache is8GiB per rank. They retain the
current streaming incremental backup, backed-history partial reclaim and capacity-ready priority
recovery; they do not revert to native whole-request-only preemption.

| TP2 concurrency | Execution / resident seats | Output tok/s/card | P90 decode tok/s/user | TTFT P95 (s) | Completed |
| --------------- | -------------------------- | ----------------: | --------------------: | -----------: | --------: |
| C24             | 24 / 28                    |            202.03 |                 30.11 |        6.915 |       647 |
| C32             | 32 / 36                    |            143.19 |                 22.76 |       32.232 |       533 |

Both pass the complete window, zero HTTP failures,16/16 retrievals before and after, ownership
monitoring, server exit0 and selected-pair idle release. Every allocated card remains in the
throughput denominator. C24 ran in isolation; C32 partially overlapped an unsuccessful C24 launch on
the disjoint pair. These are single observations, not an isolated-feature or strictly controlled
cross-concurrency A/B. Failed launches and the failed TP4 Host8GiB postcheck are not scores.

C16 remains faster on both displayed axes. Following the requested frontier-only curation, C24 and
C32 are preserved in `archived_points` with their full evidence and dominance witness, rather than
added to the visible envelope. Serving Plan still uses the complete C16 accounting cohort.

## Capacity behavior

Both wide points reach sampled KV occupancy100%. Within900seconds, C24 records100 partial-page
reclaim operations,32 queued reloads,22 victim resumes and one whole-request preemption; C32
records150 reclaim operations,51 reloads,34 resumes and44 whole-request preemptions. Operations are
not unique victims or individual pages. Including drain, lifecycle reconstruction identifies24 and40
completed partial-recovery episodes respectively, with matching progress/epoch and rank completion
evidence. The trace includes other requests reusing reclaimed capacity; one C24 recovery episode has
no observed intervening reuse. These traces are not byte-equality checks.

Rank0 dispatch counts are871 mixed /4801 decode steps for C24, and949 /2391 for C32. Counts are not
device-time shares and cannot directly determine prefill/decode rank ratios. Capacity pressure,
recovery and prefill coexist; these runs alone do not isolate each mechanism's performance cost.
They do show that increasing client concurrency beyond C16 does not improve this TP2 deployment's
throughput under this workload.

## Source and qualification

The source extends BetterScale `a54e9f6b84fb3e4ef1ffbca37b66650f070b1ee2` to Dense27 E32. C32 uses
frozen source-v1. C24 uses source-v2, which also normalizes proven virtual target-graph padding: 72
real MTP verification tokens capture at80, and donor dummy rows must not become live KV work. This
changes padding metadata only; it is not a new model loop or a released-wheel qualification. The
independent wide gates cover Dense GDN decode96/E32 and balanced Q12/KV2 attention at C24/C32.
Existing Dense mixed and forced TP2 partial-recovery byte gates retain the same state geometry.
Runtime remains vLLM752a3a5 / Ascend9bf964c / CANN9.0.1 / torch-npu2.10post2.

The extension qualification capsule is retained outside Git as
`extension-qualification-sofar.tar.gz`, SHA256
`5f4fd4132adc8de2d1fe52ed08a327e28a7bc2dde87bcc6fb36afa53b74626a1`. The full transfer-verified
request, scheduler, lifecycle, server and release archives are:

- C24: `tp2-c24-evidence.tar.gz`, SHA256
  `a921a2931f0fa1b8716c44abe526241a78958fd3fb0e610135dd9affede23fa2`.
- C32: `tp2-c32-evidence.tar.gz`, SHA256
  `db047fd8da27070adc02616ce272da1174ee1ffa3ba76f790683d3158fdb3ec4`.

Compact receipts and reproducible usage-only projections are under
`docs/evidence/dense27-width-20261009/c24` and `c32`. The three business-accounting components use
one matched set of successful requests completed within900seconds and exclude drain; they are not
the streamed-output chart numerator. This is a serving smoke study, not model-quality equivalence, a
cloud SLO, a hardware ceiling or a causal speedup claim for partial recovery.
