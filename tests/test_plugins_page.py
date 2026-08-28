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


def test_system_role_is_independent_from_delivery_model() -> None:
    bidkv = by_id("bidkv")
    assert bidkv["system_role"] == "scheduler_policy"
    assert bidkv["delivery_model"] == "plugin_bundle"

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
    lmcache = by_id("lmcache")
    pegaflow = by_id("pegaflow")
    lmcache_ascend = by_id("lmcache-ascend")

    assert mooncake["artifact_type"] == "external_system"
    assert lmcache["system_role"] == "kv_state_manager"
    assert pegaflow["ownership"] == "hust_owned_subsystem"
    assert lmcache_ascend["system_role"] == "kv_integration"
    assert lmcache_ascend["artifact_type"] == "runtime_component"

    assert "KV connector" in PAGE
    assert "state system" in PAGE
    assert "KV 状态系统" in PAGE


def test_control_plane_remains_external_and_uses_a_bridge_contract() -> None:
    control_plane = by_id("ride-control-plane")
    assert control_plane["artifact_type"] == "external_system"
    assert control_plane["system_role"] == "control_plane"
    assert control_plane["execution_planes"] == ["cluster_control"]
    assert control_plane["integration_contracts"] == [
        "vllm.control.action.v1",
        "vllm.control.receipt.v1",
    ]
    assert "control plane makes external decisions through a narrow bridge" in PAGE


def test_page_consumes_the_docs_owned_registry() -> None:
    assert 'data-source="./data/ecosystem.json?v=ecosystem-registry-v2"' in PAGE
    assert 'payload.canonical_owner !== "vLLM-HUST/vllm-hust-docs"' in SCRIPT
    assert "ecosystem registry request failed" in SCRIPT
    assert "data/plugins.json" not in PAGE


def test_repository_portfolio_is_separate_and_complete() -> None:
    assert PORTFOLIO["canonical_owner"] == "vLLM-HUST/vllm-hust-docs"
    assert len(PORTFOLIO["repositories"]) == 32
    names = {item["name"] for item in PORTFOLIO["repositories"]}
    assert {"vllm-hust", "pegaflow-hust", "LMCache-Ascend"} <= names

    pegaflow = next(
        item for item in PORTFOLIO["repositories"] if item["name"] == "pegaflow-hust"
    )
    lmcache_ascend = next(
        item for item in PORTFOLIO["repositories"]
        if item["name"] == "LMCache-Ascend"
    )
    assert pegaflow["repository_role"] == "external_subsystem"
    assert lmcache_ascend["relation_to_runtime"] == "integrates_external_system"
    assert "Repositories are governance boundaries, not runtime types." in PAGE
    assert 'data-source="./data/repository-portfolio.json?v=repository-portfolio-v1"' in PAGE
    assert "repository portfolio request failed" in SCRIPT


def test_plugin_standard_is_explicitly_legacy() -> None:
    assert "Legacy compatibility profile" in LEGACY_STANDARD
    assert "former entry-point-based Plugin Standard 1.0" in PAGE
    assert "Domain contracts first; bundles second." in PAGE
    assert "先定义领域契约，再定义 bundle 交付。" in PAGE
    assert "VLLM_EXTENSION_MANIFESTS" in PAGE
    assert "VLLM_EXTENSION_BUNDLES" in PAGE
    assert "One materializer does not prove ecosystem compatibility" in PAGE
    assert 'victim_selector_component="bundle-id/component-id"' in PAGE
    assert "BidKV remains on the compatibility path" in PAGE
    assert "plugin-standard-v1.0.pdf" not in PAGE


def test_public_copy_uses_ecosystem_language() -> None:
    assert "Serving Ecosystem Architecture" in PAGE
    assert "推理生态系统架构" in PAGE
    assert "Classify the role before the delivery mechanism." in PAGE
    assert "Plugin, connector, and control plane are different concepts." in PAGE
    assert "PegaFlow is an external KV state system" in PAGE
    assert "multi-component platform profiles" in PAGE
