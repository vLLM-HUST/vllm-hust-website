# Plugin homepage maintenance audit — 2026-09-26

Five entries are temporarily delisted from the plugin homepage: SimLLM, Unified Communication,
Layered Prefill, Activation Sparsity, and QoS Scheduler. Their catalog and ownership records remain
available. Repositories and historical benchmark evidence are unchanged.

## Decision and scope

This audit inspected the 46 catalog records (including infrastructure and paired descriptors),
GitHub repository metadata, and recent default-branch commits and issues. For the ten incomplete
migration repositories requiring closer inspection, it also checked all repository branches, up to
100 PRs, and comments on the returned issues. For the five delisted repositories, the complete
default-branch history contains nine commits each, all attributed to the organization bootstrap
account `ShuhaoZhangTony`; their only other branch is the same bootstrap scaffold. Their takeover
issues contain only organization bootstrap comments, with no response from their registered
maintainers. The observation window is September 1–26, 2026, not a general inactivity threshold.

Delisting requires both an unusable serving implementation and no observable maintainer takeover in
these public records. A named owner alone does not establish actual maintenance. Conversely, missing
Qwen3.5 benchmark curves, incompatibility with the Frontier configuration, or an unmerged
implementation alone do not justify delisting. This is a reversible homepage eligibility decision,
not a claim that the authors have permanently abandoned their work or that private work cannot
exist.

The earlier Frontier audit examined pinned source and selected real runs; it was not a hardware test
of every MOD, nor an audit of every current development branch. Current GitHub history includes
newer work in some repositories than those experimental pins. No new performance claim is made here.

## Delisted entries

Each linked README is pinned to the audited default-branch revision. The linked takeover issue and
its comments provide the maintenance evidence described above.

| Entry                 | Missing implementation                                                                  | Pinned source                                                                                                                   | Takeover record                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| SimLLM                | No runtime similarity/reuse implementation; import-only source/license contract package | [README](https://github.com/vLLM-HUST/vllm-ascend-simllm-hust/blob/dcdc6edf7bdcc68bdf35058888ebfd9752ae3566/README.md)          | [Issue 2](https://github.com/vLLM-HUST/vllm-ascend-simllm-hust/issues/2)          |
| Unified Communication | Device-neutral registry/policies only; no vLLM collective delegation                    | [README](https://github.com/vLLM-HUST/vllm-hust-unified-comm/blob/f00d1ef4c19a992d67ef8012952a9405d52dd447/README.md)           | [Issue 2](https://github.com/vLLM-HUST/vllm-hust-unified-comm/issues/2)           |
| Layered Prefill       | Partition/cursor helpers only; no Ascend host attachment                                | [README](https://github.com/vLLM-HUST/vllm-ascend-layered-prefill-hust/blob/a45e41709ccacc3d7c736910b93c1b5985d9ee94/README.md) | [Issue 2](https://github.com/vLLM-HUST/vllm-ascend-layered-prefill-hust/issues/2) |
| Activation Sparsity   | Configuration/hash validation only; no model/kernel attachment                          | [README](https://github.com/vLLM-HUST/vllm-hust-activation-sparsity/blob/0e4d0628c1972d5086a217b0007576c1fd8998a3/README.md)    | [Issue 2](https://github.com/vLLM-HUST/vllm-hust-activation-sparsity/issues/2)    |
| QoS Scheduler         | SLO validation/order helpers only; no API/scheduler attachment                          | [README](https://github.com/vLLM-HUST/vllm-hust-qos-scheduler/blob/13d376a7d8990c4dcf5c0903cb6fbf2398ef0fb0/README.md)          | [Issue 2](https://github.com/vLLM-HUST/vllm-hust-qos-scheduler/issues/2)          |

The repository listings on the same page are hidden too. These entries are removed from workload
recommendations and workshop display metadata; their registered ownership remains in the catalog.

## Important retained cases

- KNorm has [maintainer PR 4](https://github.com/vLLM-HUST/vllm-hust-knorm/pull/4).
- Prefix Router has a maintainer takeover reply and
  [PR 2](https://github.com/vLLM-HUST/vllm-hust-prefix-router/pull/2).
- KV Tiering has a
  [pluginize-v1 development branch](https://github.com/vLLM-HUST/vllm-hust-kv-tiering/tree/pluginize-v1),
  despite an unchanged scaffold on main.
- Split-Batch has a maintainer merge and a
  [development branch](https://github.com/vLLM-HUST/vllm-ascend-split-batch-hust/tree/feat/cascade-attention-plug).
- SliceGPT has only a scaffold and no observed takeover, but was already excluded from the MOD-card
  surface by its artifact type; no new delisting is claimed.
- Mooncake's failed Qwen3.5 qualification is not evidence of absent maintenance.
- Offline tools such as TraceLoom are assessed for their stated function, not for having a serving
  speedup curve.

## Relisting

A maintainer can establish active ownership with an implementation or takeover update. Public MOD
relisting also requires a runnable integration, explicit supported configurations, correctness
checks, and reproducible evidence appropriate to the claimed capability. Import-only packaging tests
are not serving qualification. Restore the catalog/portfolio visibility and corresponding workshop
metadata and workload mapping together after review.
