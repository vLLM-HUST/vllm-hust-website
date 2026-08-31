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
