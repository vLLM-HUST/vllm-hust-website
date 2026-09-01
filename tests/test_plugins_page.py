from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = json.loads((ROOT / "data" / "ecosystem.json").read_text(encoding="utf-8"))
PORTFOLIO = json.loads(
    (ROOT / "data" / "repository-portfolio.json").read_text(encoding="utf-8")
)
PAGE = (ROOT / "plugins.html").read_text(encoding="utf-8")
SCRIPT = (ROOT / "assets" / "plugins-page.js").read_text(encoding="utf-8")
LEGACY_STANDARD = (ROOT / "docs" / "PLUGIN_STANDARD.md").read_text(encoding="utf-8")

REQUIRED_FIELDS = {
    "id",
    "name",
    "artifact_type",
    "system_role",
    "integration_contracts",
    "execution_planes",
    "deployment_topology",
    "delivery_model",
    "ownership",
    "maturity",
    "canonical_repository",
    "summary_en",
    "summary_zh",
    "evidence_level",
}


def by_id(component_id: str) -> dict:
    return next(item for item in REGISTRY["components"] if item["id"] == component_id)


def test_registry_is_canonical_and_multidimensional() -> None:
    assert REGISTRY["schema_version"] == "1.0"
    assert REGISTRY["canonical_owner"] == "vLLM-HUST/vllm-hust-docs"
    assert len(REGISTRY["components"]) >= 15

    ids = [item["id"] for item in REGISTRY["components"]]
    assert len(ids) == len(set(ids))
    for item in REGISTRY["components"]:
        assert REQUIRED_FIELDS <= item.keys()
        assert item["execution_planes"]

    assert by_id("vllm-production-stack")["maturity"] == "unsupported"


def test_system_role_is_independent_from_delivery_model() -> None:
    bidkv = by_id("bidkv")
    assert bidkv["system_role"] == "scheduler_policy"
    assert bidkv["delivery_model"] == "plugin_bundle"
    assert bidkv["integration_surfaces"] == [
        "vLLM-HUST vllm.scheduler.policy.v1",
        "legacy experiment-only vllm.general_plugins",
        "official vLLM scheduler contract (not yet supported)",
    ]
    assert bidkv["maturity"] == "supported"

    ascend = by_id("vllm-ascend-hust")
    assert ascend["artifact_type"] == "platform_profile"
    assert ascend["delivery_model"] == "platform_distribution"

    assert "artifact_type" in SCRIPT
    assert "system_role" in SCRIPT
    assert "delivery_model" in SCRIPT
    assert "execution_planes" in SCRIPT
    assert 'document.documentElement.lang.toLowerCase().startsWith("zh")' in SCRIPT


def test_kv_systems_and_connectors_are_not_collapsed_into_plugins() -> None:
    mooncake = by_id("mooncake")
    mooncake_connectors = by_id("mooncake-vllm-connectors")
    pegaflow = by_id("pegaflow")
    pegaflow_connectors = by_id("pegaflow-vllm-connectors")

    assert mooncake["artifact_type"] == "external_system"
    assert mooncake["maturity"] == "supported"
    assert mooncake["integration_contracts"] == []
    assert mooncake_connectors["artifact_type"] == "bridge"
    assert mooncake_connectors["maturity"] == "supported"
    assert mooncake_connectors["canonical_repository"] == (
        "https://github.com/vllm-project/vllm"
    )
    assert mooncake_connectors["upstream_repository"] == (
        "https://github.com/kvcache-ai/Mooncake"
    )
    assert mooncake_connectors["integration_contracts"] == [
        "vllm.kv_connector.scheduler.v1",
        "vllm.kv_connector.worker.v1",
        "vllm.kv_connector.telemetry.v1",
    ]
    assert "0.3.11.post1 Ascend transport" in mooncake["summary_en"]
    assert "9-key save/load" in mooncake_connectors["summary_en"]
    assert "outage/recovery evidence" in mooncake_connectors["summary_en"]
    assert pegaflow["ownership"] == "hust_owned_subsystem"
    assert pegaflow["integration_contracts"] == []
    assert pegaflow_connectors["integration_contracts"] == [
        "vllm.kv_connector.scheduler.v1",
        "vllm.kv_connector.worker.v1",
        "vllm.kv_connector.telemetry.v1",
    ]
    assert pegaflow_connectors["execution_planes"] == ["api", "scheduler", "worker"]

    assert "KV connector" in PAGE
    assert "state system" in PAGE
    assert "KV 状态系统" in PAGE
    assert "Read the pinned support and rollback matrix" in PAGE
    assert "NO-GO MATRIX" in PAGE


def test_extension_manager_and_production_stack_keep_distinct_ownership() -> None:
    manager = by_id("vllm-hust-extension-manager")
    production_stack = by_id("vllm-production-stack")
    assert production_stack["evidence_level"] == "integration_tested"
    assert "metrics-backed scaling" in production_stack["summary_en"]
    assert "real GLM Router failure/recovery" in production_stack["summary_en"]
    assert "lacks arm64 support" in production_stack["summary_en"]

    assert manager["artifact_type"] == "tool"
    assert manager["system_role"] == "extension_management"
    assert manager["integration_surfaces"] == [
        "vllm_hust.extension_bundles",
        "vllm_hust_ext.providers",
    ]
    assert production_stack["artifact_type"] == "external_system"
    assert production_stack["system_role"] == "control_plane"
    assert production_stack["delivery_model"] == "helm_chart"


def test_versioned_contracts_are_separate_from_existing_surfaces() -> None:
    ascend = by_id("vllm-ascend-hust")
    metal = by_id("vllm-metal-hust")
    diffspec = by_id("diffspec")
    kvcompress = by_id("kvcompress-ascend")

    assert ascend["integration_contracts"] == [
        "vllm.platform.v1",
        "vllm.operator.v1",
        "vllm.model_runner.v1",
    ]
    assert metal["integration_surfaces"] == [
        "vllm.platform_plugins",
        "vllm.model_loader",
    ]
    assert diffspec["integration_surfaces"] == ["vllm.speculative_decoding"]
    assert kvcompress["integration_contracts"] == []
    assert kvcompress["integration_surfaces"] == [
        "vllm.general_plugins",
        "vllm.kv_compression.provider",
        "vllm.kv_lifecycle",
    ]
    typed = {
        contract
        for item in REGISTRY["components"]
        for contract in item["integration_contracts"]
    }
    assert "vllm.platform" not in typed
    assert "vllm.operator" not in typed
    assert "vllm.model_runner" not in typed
    assert "integration_surfaces" in SCRIPT


def test_control_plane_remains_external_and_uses_a_bridge_contract() -> None:
    control_plane = by_id("ride-control-plane")
    remote_sidecar = by_id("ride-runtime-bridge")
    local_host = by_id("vllm-local-control-host")
    assert control_plane["artifact_type"] == "external_system"
    assert control_plane["system_role"] == "control_plane"
    assert control_plane["execution_planes"] == ["cluster_control"]
    assert control_plane["integration_contracts"] == []
    assert remote_sidecar["artifact_type"] == "bridge"
    assert remote_sidecar["system_role"] == "control_plane_bridge"
    assert remote_sidecar["deployment_topology"] == "sidecar"
    assert remote_sidecar["delivery_model"] == "python_distribution"
    assert remote_sidecar["maturity"] == "experimental"
    assert remote_sidecar["canonical_repository"] == (
        "https://github.com/vLLM-HUST/vllm-hust"
    )
    assert local_host["artifact_type"] == "bridge"
    assert local_host["system_role"] == "control_plane_bridge"
    assert local_host["execution_planes"] == ["api", "bridge"]
    assert local_host["delivery_model"] == "core_release"
    assert local_host["maturity"] == "experimental"
    assert local_host["canonical_repository"].endswith("/vllm-hust")
    assert local_host["integration_contracts"] == [
        "vllm.control.action.v1",
        "vllm.control.receipt.v1",
    ]
    assert remote_sidecar["evidence_level"] == "integration_tested"
    assert local_host["evidence_level"] == "integration_tested"
    assert "control plane makes external decisions through a narrow bridge" in PAGE
    assert "admission" in PAGE
    assert "local host still owns HMAC, schemas, authorization, replay" in PAGE
    assert "catalog separates three layers" in PAGE
    assert "TLS 1.3 mutual-authentication sidecar" in PAGE
    assert "allowlists client certificate fingerprints" in PAGE
    assert "forwards exact bounded frames" in PAGE
    assert "production certificate issuance, revocation, audit" in PAGE
    assert "mutating action contracts remain release gates" in PAGE


def test_page_consumes_the_docs_owned_registry() -> None:
    assert 'data-source="./data/ecosystem.json?v=ecosystem-registry-v6"' in PAGE
    assert 'payload.canonical_owner !== "vLLM-HUST/vllm-hust-docs"' in SCRIPT
    assert "ecosystem registry request failed" in SCRIPT
    assert "data/plugins.json" not in PAGE


def test_repository_portfolio_is_separate_and_complete() -> None:
    assert PORTFOLIO["canonical_owner"] == "vLLM-HUST/vllm-hust-docs"
    assert len(PORTFOLIO["repositories"]) == 31
    names = {item["name"] for item in PORTFOLIO["repositories"]}
    assert {"vllm-hust", "pegaflow-hust"} <= names

    pegaflow = next(
        item for item in PORTFOLIO["repositories"] if item["name"] == "pegaflow-hust"
    )
    assert pegaflow["repository_role"] == "external_subsystem"
    assert pegaflow["component_ids"] == [
        "pegaflow",
        "pegaflow-vllm-connectors",
    ]
    assert "Repositories are governance boundaries, not runtime types." in PAGE
    assert (
        'data-source="./data/repository-portfolio.json?v=repository-portfolio-v1"'
        in PAGE
    )
    assert "repository portfolio request failed" in SCRIPT


def test_extension_standard_covers_core_and_host_providers() -> None:
    assert "Manifest `0.2-experimental`" in LEGACY_STANDARD
    assert "Core + Host Provider" in LEGACY_STANDARD
    assert "vllm_hust_ext.providers" in LEGACY_STANDARD
    assert "former entry-point-based Plugin Standard 1.0" in PAGE
    assert "Domain contracts first; bundles second." in PAGE
    assert "先定义领域契约，再定义 bundle 交付。" in PAGE
    assert "uv pip install vllm-hust-ext" in PAGE
    assert "vllm-hust-ext extension enable org.example.kv-adapter" in PAGE
    assert "vllm-hust-ext extension plan org.example.kv-adapter" in PAGE
    assert "vllm-hust-ext extension check org.example.kv-adapter" in PAGE
    assert "vllm-hust-ext run -- vllm serve MODEL" in PAGE
    assert "Only explicit <code>vllm-hust-ext</code> extension commands" in PAGE
    assert "Release freeze: Core + Host Provider validation first" in PAGE
    assert "Historical prototype evidence (superseded)" in PAGE
    assert "Normal vLLM import and startup never invoke the manager" in PAGE
    assert "external services and clusters remain operator-owned" in PAGE.lower()
    assert "kv-systems-and-connector-materialization.md" in PAGE
    assert "control-plane-and-runtime-bridge.md" in PAGE
    assert "platform-operator-model-runner-boundaries.md" in PAGE
    assert "plugin-standard-v1.0.pdf" not in PAGE


def test_public_copy_uses_ecosystem_language() -> None:
    assert "Serving Ecosystem Architecture" in PAGE
    assert "推理生态系统架构" in PAGE
    assert "Classify the role before the delivery mechanism." in PAGE
    assert "Plugin, connector, and control plane are different concepts." in PAGE


def test_candidate_architecture_links_use_the_published_docs_branch() -> None:
    prefix = (
        "https://github.com/vLLM-HUST/vllm-hust-docs/blob/"
        "codex/ecosystem-architecture-reorganization/"
    )
    assert f"{prefix}architecture/ecosystem-architecture.md" in PAGE
    assert "vllm-hust-docs/blob/main/architecture/ecosystem-architecture.md" not in PAGE
    assert "PegaFlow is an external KV state system" in PAGE
    assert "multi-component platform profiles" in PAGE
