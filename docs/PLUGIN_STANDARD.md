# vLLM-HUST Extension Architecture — experimental

> Manifest `0.2-experimental` and the former Bundle v1 prototype are not stable
> compatibility contracts. Alpha publication is blocked until the vLLM,
> external-KV-system, and control-plane acceptance gates pass.

## Product boundary

vLLM-HUST Extension Manager (`vllm-hust-ext`) provides discovery,
compatibility evidence, configuration, enablement intent, state projection,
conflict checks, and delegation. It is not a vLLM distribution, external KV
service manager, Kubernetes deployment system, or control plane.

## Core + Host Provider

Core understands static manifests and the states `installed`, `discovered`,
`compatible`, `configured`, `enabled`, `reachable`, `healthy`, `degraded`, and
`incompatible`.

Each host keeps runtime authority:

- vLLM loads in-process plugins and policies;
- Mooncake or LMCache owns its services, storage backends, and transports;
- Production Stack and Kubernetes own Helm releases, CRDs, controllers,
  routers, autoscalers, OCI images, and cluster rollout;
- Extension Manager calls Provider `plan`, `render`, and `check` operations.

BidKV's current `vllm.victim_selector` adapter is legacy experimental evidence,
not a contract present in the fresh vLLM-HUST 0.23 fork. New scheduler-policy
integration must track upstream RFC #51608 and draft PR #51601's
`vllm.scheduler_plugins`/PreemptionScore direction; the organization must not
advertise a second private hook as current vLLM compatibility.

The initial Provider protocol has no apply or delete operation.

## Manifest registration

```toml
[project.entry-points."vllm_hust.extension_bundles"]
"org.example.extension" = "example_extension.manifests"
```

The static manifest must explicitly distinguish `kind`, `host`, `runtime`,
`lifecycle_owner`, required services, protocol/host ranges, and implementation
carriers. Supported carriers include Python entry points, host built-ins,
external services, OCI images, Helm values, Kubernetes manifests, CRDs, and
controllers.

Third-party Provider factories use `vllm_hust_ext.providers`. vLLM-HUST does
not create unofficial entry-point groups inside `vllm.*`.

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

Mooncake Provider reuses `MooncakeConnector` or `MooncakeStoreConnector`.
LMCache Provider independently renders `LMCacheMPConnector` or an explicitly
selected official V1/dynamic connector and checks the external `/healthcheck`
endpoint. Production Stack Provider renders values and dry-run instructions.
No Provider performs an implicit service start, Helm apply, uninstall, driver
change, cache clear/eviction, or KV deletion.

LMCache-Ascend is modeled separately as an LMCache-owned platform backend plus
a vLLM connector adapter. It is not an external LMCache MP service. The
`vllm-hust-lmcache-ascend-adapter` profile therefore has no required service,
and renders either the vLLM-Ascend built-in `LMCacheAscendConnector` or the
exact official dynamic pair
`LMCacheAscendConnectorV1Dynamic` /
`lmcache_ascend.integration.vllm.lmcache_ascend_connector_v1`.
`LMCacheMPConnector` must not be paired with a fabricated Python module path.

Mooncake detection covers the official mutually exclusive CUDA, CUDA 13,
non-CUDA, NPU, MUSA, and EFA package variants. Multiple installed variants are
an incompatible/degraded environment rather than an arbitrary selection.

KV Providers delegate a declared `kv_transfer_config` capability to the vLLM
launch path; dispatch is not hard-coded by Provider name. Because one vLLM
process accepts only one such configuration, enabling Mooncake and LMCache for
the same process is a fail-closed conflict. Experimental profile packages pin
the exact Manager development version until the compatibility contract freezes.

Uninstall is a package-manager operation, not a Provider lifecycle action. The
safe sequence is host rollback/restart, `extension disable`, `extension
forget`, then `pip uninstall`. `forget` refuses enabled extensions and only
removes Manager-owned configuration, preventing stale intent from reappearing
after a later reinstall.

## Acceptance before alpha

1. BidKV must complete install, discover, configure, enable, real vLLM load,
   disable, restart, and upstream fallback.
2. Mooncake and LMCache must each complete official connector rendering and
   real service healthy/outage/recovery checks without lifecycle takeover or
   cache-data mutation.
3. Production Stack must pass official-chart render, Kubernetes server dry-run,
   rollout checks, conflict tests, and proof of no apply/uninstall.
4. Incompatible versions, missing required services, duplicate registrations,
   conflicts, degraded health, rollback, and clean uninstall must be tested.
5. The three cases must be repeated on the intended 112/91 environments.

Current evidence: the official Production Stack chart at commit
`1b87c11a24c144f6b63a64dbae4fc8c875059731` renders successfully, and all eight
generated resources pass a Kubernetes 1.34.11 server-side dry-run in an
ephemeral kind cluster. That earlier dry-run applied no resources.

The next isolated test performed an actual operator-owned Helm lifecycle for
the official `vllm-stack-0.1.12` chart: Router Deployment install at `1/1`,
upgrade to `2/2`, explicit rollback to `1/1`, a missing-image upgrade that
failed and automatically rolled back, then uninstall with no release-owned
resources remaining. A lightweight `/health` OCI fixture avoided models and
accelerators, so this proves chart/Deployment/rollback behavior—not real Router
traffic or controller/autoscaler reconciliation. The temporary cluster and
images were deleted afterward.

The Manager still performs none of those mutations. Its rendered operator plan
keeps install, upgrade, rollback, and uninstall as `null`; successful cluster
and rollout states now require non-empty evidence instead of trusting bare
booleans.

LMCache MP remains blocked on the current 91 Ascend environment. An isolated
LMCache 0.4.3 probe built and imported its common `native_storage_ops`, but the
MP server then required CuPy before `/healthcheck` could become ready. The
checked LMCache-Ascend commit also leaves `NPUCacheContext` unimplemented and
skips MP tests. This is recorded as an honest platform-support gap, not replaced
with a stub health endpoint; CUDA MP health/recovery and Ascend in-process KV
data-path acceptance remain separate release gates.

On 180, an isolated official
`mooncake-transfer-engine-npu==0.3.13.post1` master completed a real
Manager-observed `healthy → unreachable/degraded → healthy` cycle. Disabling
and forgetting the extension left the external master healthy, proving the
Manager does not stop it. The connector KV data path remains a gate: all four
NPUs in that production container were already occupied by vLLM workers, and a
new store client could not create an ACL context. Existing inference processes
were not interrupted for this test.
