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

## Qwen3.5 + AgentX follow-up

The exact dataset revision was subsequently restored and verified, and a frozen dev43 source carrier
completed two controls plus all seven independently activated mods on the same Ascend 910B2 pair.
Every run used the full 393-session corpus, C4, TP2 and a 900-second official smoke window. All nine
exports are submission-valid with zero request errors and output-length mismatches, and every run
released its devices.

The observations split into 58-request / 11.457 output tok/s and 59-request / 16.105 output tok/s
windows because one long-output request crossed the measurement boundary; the closing control
returned to the 58-request mode. This prevents a causal speedup claim. Five mods were not exercised,
Ascend state action was fallback-only, and feedback plane emitted 256 events while dropping 3266.
See the [machine-readable run receipt](../data/stateaxis-qwen35-agentx-followup.json). Private
source locations remain intentionally unlinked.
