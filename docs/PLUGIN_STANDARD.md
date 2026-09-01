# vLLM-HUST Extension Architecture — experimental

> Manifest `0.2-experimental` and the former Bundle v1 prototype are not stable compatibility
> contracts. Alpha publication is blocked until the vLLM, external-KV-system, and control-plane
> acceptance gates pass.

## Product boundary

vLLM-HUST Extension Manager (`vllm-hust-ext`) provides discovery, compatibility evidence,
configuration, enablement intent, state projection, conflict checks, and delegation. It is not a
vLLM distribution, external KV service manager, Kubernetes deployment system, or control plane.

## Core + Host Provider

Core understands static manifests and the states `installed`, `discovered`, `compatible`,
`configured`, `enabled`, `reachable`, `healthy`, `degraded`, and `incompatible`.

Each host keeps runtime authority:

- vLLM loads in-process plugins and policies;
- Mooncake owns its services, storage backends, and transports;
- Production Stack and Kubernetes own Helm releases, CRDs, controllers, routers, autoscalers, OCI
  images, and cluster rollout;
- Extension Manager calls Provider `plan`, `render`, and `check` operations.

vLLM-HUST 0.23 now owns a minimal generic `vllm.scheduler.policy.v1` materializer. BidKV supplies an
active typed policy component and does not register the private `vllm.victim_selector` entry-point
group. Manager renders the host-native manifest and rejects unverified or incompatible hosts. This
is supported on pinned vLLM-HUST 0.23; official vLLM remains unsupported while RFC #51608 and draft
PR #51601 are unsettled. A real Qwen3-0.6B run on server 91 produced three BidKV victim selections
at full KV pressure, completed every request, and restored the built-in path after disable and
process restart.

At draft PR #51601 head `f8b7db61e446911e0d62fcb8220f863d6098c471`, code still provides one
registry-only `PreemptionPlugin` over live requests, while its design document specifies future
composable batched `PreemptionScore`, read-only features, descriptors, and out-of-tree discovery.
BidKV therefore maps only its minimum victim-ranking semantics now; proactive preemption triggers,
waiting-queue mutation, KV cleanup, and reinsertion remain core-owned and are not restored through
monkey patches.

The initial Provider protocol has no apply or delete operation.

## Manifest registration

```toml
[project.entry-points."vllm_hust.extension_bundles"]
"org.example.extension" = "example_extension.manifests"
```

The static manifest must explicitly distinguish `kind`, `host`, `runtime`, `lifecycle_owner`,
required services, protocol/host ranges, and implementation carriers. Supported carriers include
registered Python entry points, unregistered/import-only Python modules, host built-ins, external
services, OCI images, Helm values, Kubernetes manifests, CRDs, and controllers.

Third-party Provider factories use `vllm_hust_ext.providers`. vLLM-HUST does not create unofficial
entry-point groups inside `vllm.*`.

## Current commands

```bash
uv pip install vllm-hust-ext
uv pip install example-extension

vllm-hust-ext extension list
vllm-hust-ext extension inspect org.example.extension
vllm-hust-ext extension configure org.example.extension --file config.json
vllm-hust-ext extension enable org.example.extension
vllm-hust-ext extension status org.example.extension
vllm-hust-ext extension plan org.example.extension
vllm-hust-ext extension render org.example.extension
vllm-hust-ext extension check org.example.extension
```

For a vLLM-owned extension only, the manager can generate the launch command:

```bash
vllm-hust-ext run -- vllm serve MODEL
```

Mooncake Provider reuses `MooncakeConnector` or `MooncakeStoreConnector`. Production Stack Provider
renders values and dry-run instructions. No Provider performs an implicit service start, Helm apply,
uninstall, driver change, cache clear/eviction, or KV deletion.

Mooncake detection covers the official mutually exclusive CUDA, CUDA 13, non-CUDA, NPU, MUSA, and
EFA package variants. Multiple installed variants are an incompatible/degraded environment rather
than an arbitrary selection. The experimental profile currently targets `>=0.3.11.post1,<0.4`. For
Ascend NPU cache pointers the validated transport is `ascend`, not generic TCP, and the validated
vLLM 0.23 Store path requires `load_async=true`. Mooncake Store REST and vLLM KV launch
configuration have no separately published upstream protocol semver, so the manifest marks those
surfaces unversioned instead of inventing a `1.0` compatibility claim.

KV Providers delegate a declared `kv_transfer_config` capability to the vLLM launch path; dispatch
is not hard-coded by Provider name. Because one vLLM process accepts only one such configuration,
enabling two connector profiles for the same process is a fail-closed conflict. Experimental profile
packages pin the exact Manager development version until the compatibility contract freezes.

Uninstall is a package-manager operation, not a Provider lifecycle action. The safe sequence is host
rollback/restart, `extension disable`, `extension forget`, then `pip uninstall`. `forget` refuses
enabled extensions and only removes Manager-owned configuration, preventing stale intent from
reappearing after a later reinstall.

## Acceptance before alpha

1. BidKV must complete install, discover, configure, enable, real vLLM load, disable, restart, and
   upstream fallback.
1. Mooncake must complete connector rendering and a real data path without taking over lifecycle or
   mutating cache data implicitly.
1. Production Stack must pass official-chart render, Kubernetes server dry-run, rollout checks,
   conflict tests, and proof of no apply/uninstall.
1. Incompatible versions, missing required services, duplicate registrations, conflicts, degraded
   health, rollback, and clean uninstall must be tested.
1. The three cases must be repeated on the intended 112/91 environments.

The canonical pinned version, carrier and rollback matrix is maintained in
[`extension-manager-support-matrix-20260901.md`](https://github.com/vLLM-HUST/vllm-hust-docs/blob/codex/plugin-standardization-handoff/operations/extension-manager-support-matrix-20260901.md).
A passing point does not imply support for an entire experimental range.

Current evidence: the official Production Stack chart at commit
`1b87c11a24c144f6b63a64dbae4fc8c875059731` renders successfully, and all eight generated resources
pass a Kubernetes 1.34.11 server-side dry-run in an ephemeral kind cluster. That earlier dry-run
applied no resources.

The next isolated test performed an actual operator-owned Helm lifecycle for the official
`vllm-stack-0.1.12` chart: Router Deployment install at `1/1`, upgrade to `2/2`, explicit rollback
to `1/1`, a missing-image upgrade that failed and automatically rolled back, then uninstall with no
release-owned resources remaining. A lightweight `/health` OCI fixture avoided models and
accelerators, so this proves chart/Deployment/rollback behavior—not real Router traffic or
controller/autoscaler reconciliation. The temporary cluster and images were deleted afterward.

A second isolated chart run established the official `LoraAdapter` CRD, accepted a valid custom
resource with server-side dry-run, rolled out both Router and LoRA-controller probe Deployments at
`1/1`, and created an HPA whose scale target lookup succeeded. With no metrics-server,
`ScalingActive` correctly remained false, so no scaling decision is claimed. The official controller
image registry timed out in this environment; its business reconciliation remains unverified. Helm
uninstall removed release-owned resources but retained the chart CRD as expected, after which
deleting the temporary cluster removed everything. Those were deliberately limited historical
probes.

A subsequent isolated Kubernetes 1.34.11 run built the official Router and the official controller
binary from exact commit `1b87c11a`. The controller reconciled a `VLLMRouter` into owned RBAC,
Service, and Deployment resources; the Router forwarded an OpenAI-compatible completion request to
an external test backend; and real metrics-server CPU drove a separately owned Router Deployment
from one to three replicas. Removing the backend produced HTTP 500 for a unique request, and
restoring it recovered without Router reinstall.

The HPA is separately owned for a reason. A negative test targeted the controller-owned Deployment:
HPA desired two replicas, while the controller immediately restored the CR's one replica. Provider
status must treat that two-writer replica ownership as `incompatible + degraded`; a rollout boolean
cannot hide it. This proves control-plane reconciliation and Router forwarding, but the earlier mock
backend did not prove model inference or a production image support matrix.

That model-data-plane gap is now closed separately on the arm64 host 180. A Router built from the
same official commit first targeted an absent backend: its own `/health` stayed 200 while a valid
chat request returned 500. Recreating only the isolated Router against the existing
`zai-org/GLM-4-32B-0414` service returned 200 and `ROUTER_OK`; the production vLLM container
retained its original start time. The official `router:v0.1.12` manifest has no `linux/arm64/v8`, so
the source-built result is healthy data-plane evidence but remains degraded release-matrix evidence.

These checks also corrected the manifest: the chart exposes `LoraAdapter`, not the previously listed
`Model/Router` CRDs, and the successfully exercised Helm 4.2.4 expands the experimental
`helm-values` range to `>=3,<5`.

The Manager still performs none of those mutations. Its rendered operator plan keeps install,
upgrade, rollback, and uninstall as `null`; successful cluster and rollout states now require
non-empty evidence instead of trusting bare booleans. A healthy claim additionally requires separate
controller reconciliation, Router traffic, autoscaler-decision, and structured real-model
failure/recovery evidence. A mock backend can no longer claim healthy.

Mooncake now also has two real, separate 0.3.12.post1 non-CUDA results on `a100-dev`: two official
TransferEngine processes completed and verified a 1 MiB TCP/P2PHANDSHAKE write, and an isolated
official Master + HTTP metadata

- Store REST service completed put, exist, byte-matching get, lease-aware remove, and
  missing-after-remove. The probe removed only its UUID-scoped key after the configured hard lease
  expired; it never used `remove_all` or force deletion. This validates the standalone
  TransferEngine and Store data paths.

On 180, an isolated official `mooncake-transfer-engine-npu==0.3.13.post1` master completed a real
Manager-observed `healthy → unreachable/degraded → healthy` cycle. Disabling and forgetting the
extension left the external master healthy, proving the Manager does not stop it. That earlier
health-only run did not establish an NPU data path. A later isolated run on free NPU 4 used vLLM
0.23, vLLM Ascend, Qwen3-0.6B and `mooncake-transfer-engine-npu==0.3.11.post1`. With local prefix
caching off, the first request saved nine keys and the repeat loaded the same nine keys (133,191,072
bytes each way, zero failed keys). Stopping the test master kept inference available but produced
four partial save failures; restoring the master without restarting vLLM restored successful save
and load. This is real connector evidence, while alpha remains frozen for BidKV's upstream scheduler
contract and the remaining cross-version/support matrix.
