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
    assert len(MANIFEST["plugins"]) == 59
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
    assert 'data-source="./data/plugins.json?v=plugin-publications-v1"' in PAGE
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
