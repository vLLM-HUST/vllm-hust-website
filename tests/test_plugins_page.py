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
    assert 'data-source="./data/plugins.json"' in PAGE
    assert "Adjacent assets are not runtime plugins." in PAGE
    assert "相邻资产不冒充运行时插件。" in PAGE
    assert "manifest.adjacent_assets.forEach" in SCRIPT
    assert 'item.origin === "existing"' in SCRIPT
    assert "item.repository_url" in SCRIPT
