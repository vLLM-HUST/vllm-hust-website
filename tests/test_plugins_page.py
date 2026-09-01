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
STYLES = (ROOT / "assets" / "plugins.css").read_text(encoding="utf-8")
WORKSHOP_METADATA = json.loads(
    (ROOT / "data" / "plugin-workshop-metadata.json").read_text(encoding="utf-8")
)
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
    "repository_relationship",
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

    assert by_id("vllm-production-stack")["maturity"] == "supported"


def test_legacy_migration_cards_preserve_original_ownership() -> None:
    expected = {
        "prefix-router-migration": ["Amber1qq", "WMASTER123", "Adr1anZheng"],
        "kv-tiering-migration": ["JieYang2001"],
        "knorm-migration": ["kotoriqaq0", "SuccinctPaul"],
        "pyramidkv-ascend-migration": ["Irisuko"],
        "slicegpt-migration": ["qingfengyuhuoda"],
    }
    for component_id, maintainers in expected.items():
        component = by_id(component_id)
        assert component["ownership"] == "original_contributor_maintained"
        assert component["maintainers"] == maintainers
        assert component["delivery_model"] == "migration_scaffold"
        assert component["maturity"] == "incubating"
        assert "Repository scaffold only" in component["summary_en"]

    assert "Original maintainers" in SCRIPT
    assert "原负责人" in SCRIPT
    assert "item.maintainers" in SCRIPT


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


def test_upstream_synchronized_hust_forks_are_a_separate_system_class() -> None:
    forks = {
        item["id"]: item
        for item in REGISTRY["components"]
        if item["repository_relationship"] == "upstream_sync_fork"
    }
    assert set(forks) == {
        "vllm-hust-runtime",
        "vllm-production-stack",
        "vllm-ascend-hust",
        "vllm-metal-hust",
        "triton-ascend-hust",
        "sglang-hust",
        "mooncake",
    }
    assert {item["upstream_repository"] for item in forks.values()} == {
        "https://github.com/vllm-project/vllm",
        "https://github.com/vllm-project/production-stack",
        "https://github.com/vllm-project/vllm-ascend",
        "https://github.com/vllm-project/vllm-metal",
        "https://github.com/triton-lang/triton-ascend",
        "https://github.com/sgl-project/sglang",
        "https://github.com/kvcache-ai/Mooncake",
    }
    assert all(item["delivery_model"] != "plugin_bundle" for item in forks.values())
    assert by_id("vllm-ascend-hust")["name"] == "vLLM Ascend HUST"
    assert "it is not a HUST plugin" in by_id("vllm-ascend-hust")["summary_en"]

    assert "Upstream-synchronized HUST forks are systems, not plugins." in PAGE
    assert "上游同步 HUST fork 是系统分支，不是插件。" in PAGE
    assert "upstream_sync_fork" in SCRIPT
    assert 'let selectedType = "extensions"' in SCRIPT
    assert 'badge(copy().forkBadge, "upstream-fork")' in SCRIPT
    assert "forksTitle" in SCRIPT


def test_kv_systems_and_connectors_are_not_collapsed_into_plugins() -> None:
    mooncake = by_id("mooncake")
    mooncake_connectors = by_id("mooncake-vllm-connectors")
    pegaflow = by_id("pegaflow")
    pegaflow_connectors = by_id("pegaflow-vllm-connectors")

    assert mooncake["artifact_type"] == "external_system"
    assert mooncake["maturity"] == "supported"
    assert mooncake["integration_contracts"] == []
    assert mooncake["canonical_repository"] == (
        "https://github.com/vLLM-HUST/mooncake-hust"
    )
    assert mooncake["upstream_repository"] == ("https://github.com/kvcache-ai/Mooncake")
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
    assert pegaflow["canonical_repository"] == (
        "https://github.com/vLLM-HUST/pegaflow-hust"
    )
    assert pegaflow_connectors["integration_contracts"] == [
        "vllm_hust.extension_manifest.v0.2-experimental"
    ]
    assert pegaflow_connectors["integration_surfaces"] == [
        "vllm_hust_ext.providers",
        "vllm.general_plugins",
        "vllm.kv_transfer_config",
    ]
    assert pegaflow_connectors["execution_planes"] == ["api", "scheduler", "worker"]
    assert (
        "external operator retains service lifecycle"
        in pegaflow_connectors["summary_en"]
    )

    assert "KV connector" in PAGE
    assert "state system" in PAGE
    assert "KV 状态系统" in PAGE
    assert "Read the pinned support and rollback matrix" in PAGE
    assert "NO-GO MATRIX" in PAGE


def test_extension_manager_and_production_stack_keep_distinct_ownership() -> None:
    manager = by_id("vllm-hust-extension-manager")
    production_stack = by_id("vllm-production-stack")
    assert production_stack["evidence_level"] == "integration_tested"
    assert production_stack["canonical_repository"] == (
        "https://github.com/vLLM-HUST/production-stack-hust"
    )
    assert production_stack["upstream_repository"] == (
        "https://github.com/vllm-project/production-stack"
    )
    assert "metrics-backed scaling" in production_stack["summary_en"]
    assert "real GLM Router failure/recovery" in production_stack["summary_en"]
    assert "amd64 is not required" in production_stack["summary_en"]
    assert (
        "self-hosted infrastructure is not a dependency"
        in production_stack["summary_en"]
    )

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
    assert diffspec["integration_contracts"] == []
    assert diffspec["integration_surfaces"] == [
        "vllm.general_plugins",
        "vllm.speculative_config",
        "vllm-ascend runtime patch surface",
    ]
    assert diffspec["execution_planes"] == ["scheduler", "worker", "native", "device"]
    assert "0.2-experimental" in diffspec["summary_en"]
    assert "vLLM Ascend 0.23" in diffspec["summary_en"]
    assert "unversioned" in diffspec["summary_en"]
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


def test_standardized_extensions_expose_honest_accessible_tooltips() -> None:
    assert "const quickStarts = {" in SCRIPT
    assert "bidkv: {" in SCRIPT
    assert "diffspec: {" in SCRIPT
    assert (
        "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
        in SCRIPT
    )
    assert "pip install bidkv" in SCRIPT
    assert "extension enable org.vllm-hust.bidkv" in SCRIPT
    assert (
        "vllm-diffspec @ git+https://github.com/vLLM-HUST/vllm-ascend-hust-diffspec.git"
        in SCRIPT
    )
    assert "extension configure org.vllm-hust.diffspec --file diffspec.json" in SCRIPT
    assert "extension enable org.vllm-hust.diffspec" in SCRIPT
    assert "latchmoe: {" in SCRIPT
    assert "latchmoe check" in SCRIPT
    assert "latchmoe serve /path/to/model" in SCRIPT
    assert '"pegaflow-vllm-connectors": {' in SCRIPT
    assert "extension check org.vllm-hust.pegaflow" in SCRIPT
    assert "Manager checks health and never starts, stops, or clears" in SCRIPT
    assert '"ascend-adaptive-quantized-kv": {' in SCRIPT
    assert "inspection is supported, enablement is intentionally refused" in SCRIPT
    assert 'action_zh: "检查命令"' in SCRIPT
    assert '"ascend-quant-runtime-descriptor": {' in SCRIPT
    assert "no model loading, kernel selection, or runtime activation" in SCRIPT
    assert 'trigger.setAttribute("aria-label", `${item.name} ${action}`)' in SCRIPT
    assert 'element("button", "plugin-launch-icon")' in SCRIPT
    assert 'element("span", "plugin-launch-glyph", ">_")' in SCRIPT
    assert 'trigger.setAttribute("aria-describedby", tooltipId)' in SCRIPT
    assert 'trigger.setAttribute("aria-expanded", "false")' in SCRIPT
    assert 'if (event.key !== "Escape") return' in SCRIPT
    assert ".plugin-launcher:hover .plugin-launch-tooltip" in STYLES
    assert ".plugin-launcher:focus-within .plugin-launch-tooltip" in STYLES
    assert "workshop-v1" in PAGE


def test_mod_style_catalog_prioritizes_compatibility_and_keeps_details() -> None:
    expected = {
        "bidkv": ("ready", "vLLM-HUST", ["0.23"]),
        "diffspec": ("experimental", "vLLM Ascend", ["0.23"]),
        "latchmoe": ("experimental", "vLLM Ascend HUST", ["vLLM 0.21"]),
        "ascend-adaptive-quantized-kv": (
            "inspect_only",
            "vLLM Ascend",
            ["Host contract pending"],
        ),
        "ascend-quant-runtime-descriptor": (
            "inspect_only",
            "vLLM Ascend",
            ["Loader contract pending"],
        ),
    }
    for component_id, (status, host, versions) in expected.items():
        profile = by_id(component_id)["compatibility"]
        assert profile["status"] == status
        assert profile["host"] == host
        assert profile["versions"] == versions
        assert profile["platforms"]
        assert profile["requirements_en"]
        assert profile["requirements_zh"]

    assert "function compatibilityPanel(item)" in SCRIPT
    assert 'element("details", "plugin-technical-details")' in SCRIPT
    assert 'element("summary", "", copy().details)' in SCRIPT
    assert "copy().installRun" in SCRIPT
    assert "Read it like a MOD catalog" in PAGE
    assert "像查看 MOD 一样选择扩展" in PAGE
    assert ".plugin-compatibility-facts" in STYLES
    assert ".mod-catalog-guide" in STYLES


def test_workshop_view_opens_on_a_flat_extension_grid() -> None:
    assert 'let selectedType = "extensions"' in SCRIPT
    assert "const isWorkshopMod = (item)" in SCRIPT
    assert 'item.artifact_type === "runtime_component"' in SCRIPT
    assert 'item.repository_relationship === "organization_native"' in SCRIPT
    assert '["plugin_bundle", "python_distribution", "migration_scaffold"]' in SCRIPT
    assert 'element("section", "plugin-grid workshop-grid")' in SCRIPT
    assert 'element("div", "workshop-cover")' in SCRIPT
    assert '"plugins-title": zh ? "扩展工坊" : "Extension Workshop"' in SCRIPT
    assert 'body[data-page="plugins"] .technical-highlights' in STYLES
    assert 'body[data-page="plugins"] .plugin-standard' in STYLES
    assert 'body[data-page="plugins"] .repository-portfolio' in STYLES
    assert 'body[data-page="plugins"] .workshop-grid' in STYLES


def test_workshop_does_not_present_official_connectors_or_systems_as_mods() -> None:
    assert "isWorkshopMod(item) && matchesType" in SCRIPT
    assert 'item.artifact_type === "runtime_component"' in SCRIPT
    assert "Only independent vLLM-HUST extension repositories appear here." in PAGE
    assert "official connectors" in PAGE
    assert "官方 Connector" in PAGE


def test_every_workshop_mod_has_synced_maintainers_and_repository_metrics() -> None:
    assert WORKSHOP_METADATA["schema_version"] == "plugin-workshop-metadata/v1"
    workshop_mods = {
        item["id"]
        for item in REGISTRY["components"]
        if item["artifact_type"] == "runtime_component"
        and item["repository_relationship"] == "organization_native"
        and item["delivery_model"]
        in {"plugin_bundle", "python_distribution", "migration_scaffold"}
        and item["canonical_repository"].startswith("https://github.com/vLLM-HUST/")
    }
    assert set(WORKSHOP_METADATA["plugins"]) == workshop_mods
    for plugin in WORKSHOP_METADATA["plugins"].values():
        assert plugin["maintainers"]
        assert all(
            person["login"] and person["name"] for person in plugin["maintainers"]
        )
        assert set(plugin["metrics"]) == {"stars", "forks", "open_pull_requests"}
        assert all(
            isinstance(value, int) and value >= 0
            for value in plugin["metrics"].values()
        )


def test_workshop_renders_synced_metadata_without_hardcoded_counts() -> None:
    assert 'data-metadata="./data/plugin-workshop-metadata.json?v=' in PAGE
    assert "fetch(catalog.dataset.metadata)" in SCRIPT
    assert "function communityPanel(item)" in SCRIPT
    assert "metadata.maintainers.forEach" in SCRIPT
    assert "metadata.metrics.stars" in SCRIPT
    assert "metadata.metrics.open_pull_requests" in SCRIPT
    assert "metadata.metrics.forks" in SCRIPT
    assert ".plugin-maintainer" in STYLES
    assert ".plugin-repo-metrics" in STYLES


def test_quantization_entries_preserve_runtime_boundaries() -> None:
    adaptive = by_id("ascend-adaptive-quantized-kv")
    toolkit = by_id("ascend-quant-toolkit")
    runtime = by_id("ascend-quant-runtime-descriptor")
    latchmoe = by_id("latchmoe")

    assert adaptive["delivery_model"] == "python_distribution"
    assert "import-only" in adaptive["summary_en"]
    assert "refuses enablement" in adaptive["summary_en"]
    assert toolkit["artifact_type"] == "tool"
    assert toolkit["system_role"] == "offline_model_quantization"
    assert "not a vLLM plugin" in toolkit["summary_en"]
    assert runtime["artifact_type"] == "runtime_component"
    assert runtime["delivery_model"] == "python_distribution"
    assert "Import-only" in runtime["summary_en"]
    assert "owner-approved value allowlist" in runtime["summary_en"]
    assert latchmoe["integration_surfaces"] == [
        "vllm.general_plugins",
        "vllm-ascend-hust MoE offload seam v1",
        "latchmoe validated launcher",
    ]
    assert "one NPU" in latchmoe["summary_en"]
    assert "prefix cache disabled" in latchmoe["summary_en"]


def test_dark_surfaces_and_dense_metadata_keep_readable_colors() -> None:
    assert "plugins.css?v=workshop-v1" in PAGE
    assert 'body[data-page="plugins"] .content-panel .highlights-head h2' in STYLES
    assert 'body[data-page="plugins"] .content-panel .highlight-lead h3' in STYLES
    assert 'body[data-page="plugins"] .content-panel .portfolio-head h2' in STYLES
    assert "color: #c7d4d1" in STYLES
    assert ".plugin-interface-label" in STYLES
    assert "font-size: 10px" in STYLES
    assert ".plugin-card:nth-child(3n) .plugin-launch-tooltip" in STYLES


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
    assert 'data-source="./data/ecosystem.json?v=workshop-v1"' in PAGE
    assert 'payload.canonical_owner !== "vLLM-HUST/vllm-hust-docs"' in SCRIPT
    assert "ecosystem registry request failed" in SCRIPT
    assert "data/plugins.json" not in PAGE


def test_repository_portfolio_is_separate_and_complete() -> None:
    assert PORTFOLIO["canonical_owner"] == "vLLM-HUST/vllm-hust-docs"
    assert len(PORTFOLIO["repositories"]) == 49
    names = {item["name"] for item in PORTFOLIO["repositories"]}
    assert {"extension-manager", "vllm-hust", "pegaflow-hust"} <= names
    assert "vllm-ascend" not in names
    assert {
        "vllm-hust-prefix-router",
        "vllm-hust-kv-tiering",
        "vllm-hust-knorm",
        "vllm-ascend-pyramidkv-hust",
        "vllm-hust-slicegpt",
        "vllm-ascend-adaptive-quantized-kv-hust",
    } <= names
    upstream_forks = {
        item["name"]
        for item in PORTFOLIO["repositories"]
        if item["repository_role"] == "upstream_sync_fork"
    }
    assert upstream_forks == {
        "vllm-hust",
        "vllm-ascend-hust",
        "vllm-metal-hust",
        "triton-ascend-hust",
        "sglang-hust",
        "mooncake-hust",
        "production-stack-hust",
    }

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
        'data-source="./data/repository-portfolio.json?v=repository-portfolio-v5"'
        in PAGE
    )
    assert "repository portfolio request failed" in SCRIPT


def test_new_migration_repositories_replace_legacy_page_links() -> None:
    expected = {
        "vllm-ascend-quantized-kv-cache-hust": "quantized-kv-cache-migration",
        "vllm-ascend-simllm-hust": "simllm-migration",
        "vllm-hust-unified-comm": "unified-communication-migration",
        "vllm-ascend-split-batch-hust": "split-batch-full-graph-migration",
        "vllm-hust-kv-transfer-observability": "kv-transfer-observability-migration",
        "vllm-ascend-layered-prefill-hust": "layered-prefill-migration",
        "vllm-hust-activation-sparsity": "activation-sparsity-migration",
        "vllm-hust-pipeline-microbatch": "pipeline-microbatch-migration",
        "vllm-hust-qos-scheduler": "qos-scheduler-migration",
        "vllm-hust-scheduler-policy-lab": "scheduler-policy-lab",
    }
    repositories = {item["name"]: item for item in PORTFOLIO["repositories"]}
    for repository_name, component_id in expected.items():
        repository = repositories[repository_name]
        assert repository["url"] == f"https://github.com/vLLM-HUST/{repository_name}"
        assert repository["component_ids"] == [component_id]
        component = by_id(component_id)
        assert component["canonical_repository"] == repository["url"]
        assert component["compatibility"]["status"] == "source_scaffold"
        assert component["maturity"] == "incubating"

    assert "intellistream/vllm-hust-legacy" not in PAGE
    assert "intellistream/vllm-ascend-hust-legacy" not in PAGE
    assert "Host-Control Batching Plugin" not in PAGE
    assert "Runner Extension Transport Plugin" not in PAGE
    assert 'source_scaffold: { en: "Source scaffold", zh: "源码脚手架" }' in SCRIPT


def test_extension_standard_covers_core_and_host_providers() -> None:
    assert "Manifest `0.2-experimental`" in LEGACY_STANDARD
    assert "Core + Host Provider" in LEGACY_STANDARD
    assert "vllm_hust_ext.providers" in LEGACY_STANDARD
    assert "former entry-point-based Plugin Standard 1.0" in PAGE
    assert "Domain contracts first; bundles second." in PAGE
    assert "先定义领域契约，再定义 bundle 交付。" in PAGE
    assert (
        'uv pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"'
        in PAGE
    )
    assert "No public vllm-hust-ext PyPI alpha exists yet" in PAGE
    assert "activation_ready=false" in PAGE
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
