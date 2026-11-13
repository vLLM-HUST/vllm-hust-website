"""Public ownership and activation boundaries for the three independent MODs."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_independent_mod_cards_keep_explicit_owner_and_empty_advisors():
    data = ROOT / "data"
    catalog = json.loads((data / "ecosystem.json").read_text(encoding="utf-8"))
    metadata = json.loads(
        (data / "plugin-workshop-metadata.json").read_text(encoding="utf-8")
    )
    taxonomy = json.loads((data / "mod-taxonomy.json").read_text(encoding="utf-8"))
    components = {item["id"]: item for item in catalog["components"]}
    expected = {
        "graph-coverage": "vllm-hust-graph-coverage",
        "prefill-admission": "vllm-hust-prefill-admission",
        "sglang-prepared-dispatch": "sglang-hust-prepared-dispatch",
    }
    script = (ROOT / "assets/plugins-page.js").read_text(encoding="utf-8")
    for key, repository in expected.items():
        item = components[key]
        assert item["canonical_repository"] == (
            "https://github.com/vLLM-HUST/" + repository
        )
        assert item.get("catalog_project_id", key) == key
        assert item["maintainers"] == ["ShuhaoZhangTony"]
        assert item["advisors"] == []
        public = metadata["plugins"][key]
        assert [(p["login"], p["name"]) for p in public["maintainers"]] == [
            ("ShuhaoZhangTony", "张书豪")
        ]
        assert public["advisors"] == []
        assert repository + ".git" in script
    for key in ("graph-coverage", "prefill-admission"):
        assert taxonomy["components"][key]["kind"] == "tool_mod"
    assert taxonomy["components"]["sglang-prepared-dispatch"]["lifecycle"] == (
        "qualification_pending"
    )
