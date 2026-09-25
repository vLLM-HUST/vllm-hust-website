# Qwen3.5 attention / expert parallel matrix

This extension uses the same [SWE prefix-reuse workload](FRONTIER-QWEN35-SWE-PREFIX.md), native
BF16, real MTP2 acceptance/rejection and 262,144-token configured context. Each published point is
one 900-second smoke window, not an isolated peak-throughput or answer-quality certification.

## What is split

Attention and expert parallelism are separate configuration dimensions:

| Attention | Experts | Native engine flags |
| --------- | ------- | ------------------- |
| TP2       | TP2     | TP2, DP1, EP off    |
| TP2       | EP2     | TP2, DP1, EP on     |
| DP2       | TP2     | TP1, DP2, EP off    |
| DP2       | EP2     | TP1, DP2, EP on     |

In this pinned runtime, the expert tensor-parallel group includes the DP ranks. Thus **DP2 with EP
off does not replicate the experts**: each chip holds all 256 experts with half their intermediate
width. EP2 instead assigns 128 whole experts to each chip. Loaded-weight and expert-map receipts
verify all 40 target MoE layers and the physical draft layer. Attention TP2 shards QKV; DP2 keeps
full attention weights on each rank and assigns distinct request lanes to the ranks. This is
co-located native MoE communication, not separately allocated BetterScale expert-owner services.

## Fixed settings and qualification

New configurations use vLLM 0.25.1 / vLLM-Ascend 0.25.1rc1, query budget 4096, asynchronous
scheduling, prefix caching and automatic per-chip KV allocation at 0.95 memory utilization. All new
arms include the same private-host-mailbox MTP correctness bridge, preventing previous-step draft
feedback from being overwritten by request-row reordering. The native arm is not labeled as the
BetterScale performance treatment merely because it shares that bridge.

New curves keep **32 total serving slots** fixed: TP2 has one 32-slot scheduler; DP2 has two 16-slot
schedulers. Every point download records per-engine capacity, actual topology, graph bins, source
identity and launch configuration. Different auto-allocated KV amounts are not an equal-KV ablation.
Historical TP/TP C2/C4/C8/C16 results are reused, not remeasured or relabeled as this new
configuration. Their older source/capacity settings remain separate concurrency series.

BetterScale's TP1 attention geometry and C32 request metadata passed numerical operator/state checks
before serving. Real serving checks include cold/warm marker retrieval through 262,080 prompt tokens
and actual MTP. DP checks also overlap a long prefill on one rank with forced-length decoding on the
other, then swap ranks; this exercises a locally decode-only rank inside a common large FULL graph.
Short C32 load calibration must observe 32 running requests and no preemptions before the longer
measured windows begin. Capacity checks apply to this workload, not 32 full-256K requests at once.

## Measurement and comparison

Client 0.1.2 explicitly routes DP lane `i` to native `X-data-parallel-rank: i % 2`, preserving the
session's KV ownership across turns. Each new session play still has a fresh salt. There are no
recorded tool/human delays. Actual generated token IDs become the next turn's history; output
budgets and all strict stream/prompt/usage checks retain the existing workload contract.

The chart's fixed axes remain P90 request decode speed and output tokens/s/chip, counting both
chips. Solid lines connect only matching fixed server configurations in concurrency order. They are
not the dashed observed Pareto envelope, and lines of the same MOD color may represent different
topologies. Click a point to see attention and expert placement separately and download its details.

Disjoint two-chip groups may run concurrently on a shared host. Selected-device leases, fresh
admission and continuous foreign-owner guards protect each group; shared CPU/memory/host activity
still prevents treating these observations as an isolated hardware ceiling. Actual physical device
IDs are retained in each download; native and BetterScale controls use the same host, not a claimed
identical physical pair for every observation. The finite windows reach different turn/context
mixtures; this is a configuration comparison, not proof of a causal speedup from one individual
kernel or communication choice. Only sealed valid windows with verified cleanup are published, with
no invented values for unavailable configurations.

For shared-host fairness, subsequent measurements use one point per deployment, at most two pairs
per wave. All campaign leases are released after the wave drains, followed by at least two minutes
without a campaign lease. Every next wave needs fresh idle-device admission; no priority over other
tasks is claimed. Earlier completed windows remain valid under their recorded deployment policy.

## Completed coverage (2026-09-25)

The sweep now covers all 48 logical cells: two engine arms, two attention placements, two expert
placements and C1/C2/C4/C8/C16/C32. It contributes 38 newly sealed observations and reuses ten
previously published TP/TP observations; the existing BetterScale TP/TP C2–C16 windows were not
rerun. This is logical coverage, not a claim that the older 16-slot and new 32-slot deployments are
one fixed configuration. Their concurrency lines remain separate.

All seven new C32 windows completed and passed the workload's capacity and cleanup gates. C32 is not
universally faster than C16: higher concurrency can lower both per-request decode speed and
aggregate output for these finite-window traces. Keep every valid concurrency point rather than
retaining only the best-looking one. A successful C32 window does not certify 32 simultaneous
256K-token sequences.

Measurements ran on the local shared host. Two attempts were aborted by the selected-device
foreign-owner guard and excluded; retries used fresh admission, with physical cards0/1 subsequently
avoided. Another attempt was interrupted by a container restart and was also excluded. No partial or
contaminated window contributes a score. The final campaign ended with no active services or held
campaign device leases.
