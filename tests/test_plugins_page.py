from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "data" / "plugins.json").read_text(encoding="utf-8"))
PAGE = (ROOT / "plugins.html").read_text(encoding="utf-8")
SCRIPT = (ROOT / "assets" / "plugins-page.js").read_text(encoding="utf-8")


def test_plugin_manifest_has_the_governed_shape() -> None:
    assert MANIFEST["schema_version"] == 1
    assert len(MANIFEST["layers"]) == 9
    assert len(MANIFEST["plugins"]) == 58
    assert len(MANIFEST["adjacent_assets"]) == 7

    layer_ids = {layer["id"] for layer in MANIFEST["layers"]}
    assert len(layer_ids) == len(MANIFEST["layers"])
    assert {plugin["layer"] for plugin in MANIFEST["plugins"]} <= layer_ids

    plugin_codes = [plugin["code"] for plugin in MANIFEST["plugins"]]
    plugin_names = [plugin["name"] for plugin in MANIFEST["plugins"]]
    assert len(plugin_codes) == len(set(plugin_codes))
    assert len(plugin_names) == len(set(plugin_names))


def test_existing_runtime_plugins_are_linked_and_marked() -> None:
    expected = {
        "BidKV",
        "DiffSpec",
        "LatchMoE",
        "PegaFlow",
        "vLLM Ascend HUST",
        "vLLM Metal HUST",
    }
    existing = {
        item["name"] for item in MANIFEST["plugins"] if item["origin"] == "existing"
    }
    assert existing == expected

    for item in MANIFEST["plugins"]:
        url = item["repository_url"]
        assert url is None or url.startswith("https://github.com/")


def test_only_public_plugin_repositories_are_linked() -> None:
    public_prefixes = ("https://github.com/vLLM-HUST/",)
    assert all(
        item["repository_url"] is None
        or item["repository_url"].startswith(public_prefixes)
        for item in MANIFEST["plugins"]
    )
    linked_runtime_plugins = [
        item
        for item in MANIFEST["plugins"]
        if item["origin"] == "existing" and item["repository_url"]
    ]
    assert len(linked_runtime_plugins) == 6
    assert {item["status"] for item in MANIFEST["plugins"]}.isdisjoint(
        {"accepted", "stopped", "reframe"}
    )
    assert 'concept: "架构概念"' in SCRIPT
    assert 'concept: "Architecture concept"' in SCRIPT


def test_runtime_entrypoint_descriptions_match_repository_metadata() -> None:
    plugins = {item["name"]: item for item in MANIFEST["plugins"]}
    assert plugins["LatchMoE"]["kind_en"] == "vLLM platform plugin"
    assert "vLLM platform plugin interface" in plugins["LatchMoE"]["summary_en"]
    assert plugins["PegaFlow"]["origin"] == "existing"
    assert "data-runtime-count" in PAGE
    assert "runtimeCount" in SCRIPT


def test_quant_and_triton_are_adjacent_assets_not_plugins() -> None:
    plugin_names = {item["name"] for item in MANIFEST["plugins"]}
    adjacent = {item["name"]: item for item in MANIFEST["adjacent_assets"]}

    assert "Ascend Quant" not in plugin_names
    assert "Triton Ascend HUST" not in plugin_names
    assert adjacent["Ascend Quant"]["repository_url"].endswith(
        "/vllm-ascend-quant-hust"
    )
    assert adjacent["Triton Ascend HUST"]["repository_url"].endswith(
        "/triton-ascend-hust"
    )
    assert "not a vLLM runtime plugin" in adjacent["Triton Ascend HUST"]["summary_en"]


def test_page_keeps_plugin_and_adjacent_catalogs_visibly_separate() -> None:
    assert 'data-page="plugins"' in PAGE
    assert (
        'data-source="./data/plugins.json?v=plugin-publications-v1-control-plane-layer-v1"'
        in PAGE
    )
    assert "Adjacent assets are not runtime plugins." in PAGE
    assert "相邻资产不是运行时插件。" in PAGE
    assert "manifest.adjacent_assets.forEach" in SCRIPT
    assert 'item.origin === "existing"' in SCRIPT
    assert "item.repository_url" in SCRIPT


def test_published_plugins_link_verified_paper_records() -> None:
    published = {
        item["name"]: item["publications"]
        for item in MANIFEST["plugins"]
        if item.get("publications")
    }

    assert set(published) == {"BidKV", "DiffSpec"}
    assert sum(len(records) for records in published.values()) == 2
    assert published["BidKV"][0] == {
        "title_en": "BidKV: Utility-Guided Preemption Scheduling for KV-Pressure LLM Serving",
        "title_zh": "BidKV：KV 压力下大模型服务的效用引导抢占调度",
        "venue": "SC",
        "year": 2026,
        "status_en": "Accepted paper",
        "status_zh": "已接收论文",
        "url": "./assets/papers/bidkv-sc2026.pdf",
    }
    assert published["DiffSpec"][0]["url"].endswith(
        "/vllm-ascend-hust-diffspec#paper-reference"
    )
    assert (ROOT / "assets" / "papers" / "bidkv-sc2026.pdf").stat().st_size > 100_000

    assert 'id: "publications"' in SCRIPT
    assert "plugin-publications" in SCRIPT
    assert "data-publication-count" in PAGE
    assert "publicationCount" in SCRIPT
    assert "plugin-publications-v1" in PAGE


def test_formal_plugin_standard_is_downloadable_and_reproducible() -> None:
    latex = ROOT / "docs" / "PLUGIN_STANDARD.tex"
    pdf = ROOT / "assets" / "documents" / "vllm-hust-plugin-standard-v1.0.pdf"

    assert latex.is_file()
    assert pdf.is_file()
    assert pdf.read_bytes().startswith(b"%PDF-")
    assert pdf.stat().st_size > 100_000
    assert "Plugin Standard 1.0" in latex.read_text(encoding="utf-8")
    assert "插件开发与运行标准" in latex.read_text(encoding="utf-8")
    assert 'href="./assets/documents/vllm-hust-plugin-standard-v1.0.pdf"' in PAGE
    assert "download" in PAGE
    assert "PLUGIN_STANDARD.tex" in PAGE


def test_technical_highlights_separate_shipped_evidence_from_open_prs() -> None:
    assert 'id="technical-highlights"' in PAGE
    assert 'href="#technical-highlights"' in PAGE
    assert "Plugin-first, reversible extension" in PAGE
    assert "KV state as a policy surface" in PAGE
    assert "Long-sequence speculative execution" in PAGE
    assert "Performance provenance as an engine deliverable" in PAGE

    for merged_pr in (160, 171, 173, 216, 229, 232, 246, 247):
        assert f"https://github.com/vLLM-HUST/vllm-hust/pull/{merged_pr}" in PAGE

    for open_pr in (67, 123, 133, 169, 181, 249, 250, 256, 258, 260, 264):
        assert f"https://github.com/vLLM-HUST/vllm-hust/pull/{open_pr}" in PAGE

    assert "24.44% → 47.88%" in PAGE
    assert "223.80 → 174.80 ms" in PAGE
    assert "−0.01%" in PAGE
    assert "Plugin targets in review" in PAGE
    assert "Eight engine mechanisms designed as independent plugins" in PAGE
    assert PAGE.count("PLUGIN TARGET") == 8
    for target in (
        "Full-Graph Parallel Replay Plugin",
        "Load-Aware Prefix Router Plugin",
        "Host-Control Batching Plugin",
        "Low-Bit KV Precision Plugin",
        "Deadline-Aware QoS Plugin",
        "Activation Sparsity Plugin",
        "Runner Extension Transport Plugin",
        "KV Lifecycle Telemetry Plugin",
    ):
        assert target in PAGE
    assert "An open PR proves that code is reviewable" in PAGE
    assert "does not by itself prove production readiness or a speedup" in PAGE
    assert "Smoke, replay, simulation, and projected profiles" in PAGE


def test_public_highlights_do_not_expose_private_incubation_or_overclaim() -> None:
    normalized = PAGE.lower()
    assert "qixin-gaoke" not in normalized
    assert "first agent-native" not in normalized
    assert "faster than other engines" not in normalized
    assert (
        "triton ascend"
        not in PAGE.split('id="technical-highlights"', 1)[1].split(
            'id="plugin-standard"', 1
        )[0]
    )


def test_all_roadmap_modules_follow_the_declared_architecture_layer() -> None:
    expected_prefixes = {
        "scheduler": "SCH-",
        "kv": "KV-",
        "model": "MODEL-",
        "kernels": "KERNEL-",
        "compiler": "COMP-",
        "platform": "PLAT-",
        "observability": "OBS-",
        "benchmarks": "BENCH-",
        "connectors": "RIDE-",
    }

    assert len(MANIFEST["plugins"]) == 58
    for plugin in MANIFEST["plugins"]:
        assert plugin["code"].startswith(expected_prefixes[plugin["layer"]])


def test_ride_topics_with_engine_actions_are_only_control_plane_connectors() -> None:
    expected_connectors = {
        "SLO-Aware Agent Serving Connector",
        "VAMOS Connector",
        "Token-Budget Governor Connector",
        "Agent State Tiering Connector",
        "Prefix Cache Routing Reliability Connector",
        "FreshKV Connector",
        "Quality-Bounded Inference Connector",
        "Workflow-Aware Serving Connector",
    }
    connectors = {
        plugin["name"]
        for plugin in MANIFEST["plugins"]
        if plugin["layer"] == "connectors"
    }

    assert connectors == expected_connectors
    assert all(
        plugin["origin"] == "connector"
        for plugin in MANIFEST["plugins"]
        if plugin["layer"] == "connectors"
    )
    assert not any(
        plugin["name"] in {"Quality-Bounded Inference", "Workflow-Aware Serving"}
        for plugin in MANIFEST["plugins"]
    )
    connector_layer = next(
        layer for layer in MANIFEST["layers"] if layer["id"] == "connectors"
    )
    assert connector_layer["reference_url"] == "https://ride-lab.github.io/#portfolio"
    assert 'item.origin === "connector"' in SCRIPT
    assert "RIDE-Lab control plane" in SCRIPT
    assert "connectorLayer.reference_url" in SCRIPT


def test_signal_only_plugins_are_observability_modules() -> None:
    signal_only_kinds = {
        "Acceptance telemetry plugin",
        "Profiling seam plugin",
        "Lifecycle event plugin",
        "Performance regression plugin",
        "Phase-model telemetry plugin",
        "Trace relation exporter",
        "Resource-metering plugin",
    }
    signal_plugins = [
        plugin
        for plugin in MANIFEST["plugins"]
        if plugin["kind_en"] in signal_only_kinds
    ]

    assert {plugin["kind_en"] for plugin in signal_plugins} == signal_only_kinds
    assert all(plugin["layer"] == "observability" for plugin in signal_plugins)
    acceptance = next(
        plugin
        for plugin in MANIFEST["plugins"]
        if plugin["name"] == "Ascend Speculative Decoding Acceptance"
    )
    assert acceptance["code"] == "OBS-07"
