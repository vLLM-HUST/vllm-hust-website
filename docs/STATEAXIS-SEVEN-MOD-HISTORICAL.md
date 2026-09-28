# StateAxis seven-mod historical performance screen

This page registers the existing seven-carrier performance screen without changing its identity or
qualification. It is **not** a Qwen3.5-35B or AgentX result.

The original campaign used Qwen3.8-27B, TP4, eager execution, physical Ascend 910B2 NPU4--7 and
`stateaxis/runtime:dev42-cann91`. It compared each active carrier against ECPA-off dev42 in the same
runtime. The control was not an untouched `0.3.0.base1` build. Each value is one matched service
observation, so none is performance-qualified.

| Historical carrier                    | Median request wall time | Change from ECPA-off dev42 | Classification                    |
| ------------------------------------- | -----------------------: | -------------------------: | --------------------------------- |
| `stateaxis.state-feedback-plane`      |               3.657639 s |                     -1.06% | promising single run; unqualified |
| `stateaxis.ascend-state-action`       |               3.827980 s |                     +3.55% | negative; fallback-only           |
| `stateaxis.hybrid-branch-coherence`   |               4.940114 s |                     +1.41% | negative                          |
| `stateaxis.no-harm-preparation`       |               4.978619 s |                     +2.20% | negative safety mechanism         |
| `stateaxis.dependency-invalidation`   |               5.448510 s |                     +1.00% | negative safety mechanism         |
| `stateaxis.workflow-state-scheduling` |               3.768619 s |                     +1.94% | negative policy mechanism         |
| `stateaxis.hybrid-hibernation`        |               3.999750 s |                     +8.20% | negative lifecycle mechanism      |

Lower wall time is better. The feedback result is a single observation without cross-service
repetition. All other request paths were slower or fallback-only. Failed `invalid-port-custody`
attempts remain preserved in the source record and support no claim.

The campaign belonged to the private aggregate source at `f4e4a87bb56b553961adee5aab6e6d0ba588071c`.
The seven current independent private sources do not inherit its functional, device or performance
qualification. Private repository locations are intentionally omitted from this public record.

See [`data/stateaxis-seven-mod-historical.json`](../data/stateaxis-seven-mod-historical.json) for
effect receipts, fixed commits, archive digests and the pending Qwen3.5 + AgentX follow-up contract.
A future Qwen3.5/AgentX matrix must use a fresh matched control, the independently pinned
repositories, repeated ordering, exactness, effect attribution, process release and device release.
These historical values must not be inserted into the Qwen3.5 Frontier curve.

## Qwen3.5 + AgentX follow-up preflight

The 2026-09-28 follow-up found four visible idle Ascend 910B2 devices and verified all 22 Qwen3.5
model files against the published SHA-256/size manifest. The pinned AgentX wrapper passed 18 tests
and the StateAxis source import exposed all seven identities. No server or device workload was
started.

The official dataset loader could not resolve the exact public corpus revision after exhausting TLS
EOF retries, and no prepared cache was present. The pod's default vLLM metadata was also 0.23.0
rather than a frozen dev43 runtime image. The run therefore stopped before serving. No mirror,
alternate revision, subset, synthetic workload or old metric was substituted. See the
[machine-readable preflight receipt](../data/stateaxis-qwen35-agentx-followup.json).
