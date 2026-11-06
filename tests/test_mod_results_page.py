import json
from pathlib import Path

from jsonschema import Draft7Validator


ROOT = Path(__file__).resolve().parents[1]


def load(name):
    return json.loads((ROOT / "data" / name).read_text())


def test_mod_result_publication_is_complete_and_bound_to_catalog():
    evidence = load("mod-test-evidence.json")
    bindings = load("mod-result-bindings.json")
    evidence_schema = load("schemas/mod_test_evidence_v1.schema.json")
    binding_schema = load("schemas/mod_result_bindings_v1.schema.json")
    Draft7Validator(evidence_schema).validate(evidence)
    Draft7Validator(binding_schema).validate(bindings)

    assert len(evidence["integration_records"]) == 55
    assert len(evidence["combination_effects"]) == 29
    assert len(evidence["negative_results"]) == 90
    for key in ("integration_records", "combination_effects", "negative_results"):
        assert set(bindings[key]) == {row["id"] for row in evidence[key]}

    component_ids = {row["id"] for row in load("ecosystem.json")["components"]}
    assert {
        component_id
        for key in ("integration_records", "combination_effects", "negative_results")
        for component_ids_for_result in bindings[key].values()
        for component_id in component_ids_for_result
    } <= component_ids


def test_results_are_rendered_inside_corresponding_mod_cards():
    page = (ROOT / "plugins.html").read_text()
    script = (ROOT / "assets/plugins-page.js").read_text()
    home = (ROOT / "index.html").read_text()

    assert 'href="./mod-results.html"' not in page
    assert 'fetch("./data/mod-test-evidence.json?v=mod-catalog-20261106"' in script
    assert 'fetch("./data/mod-result-bindings.json?v=mod-catalog-20261106"' in script
    assert "function modEvidenceSummary(item)" in script
    assert "function modEvidenceDetails(item)" in script
    assert 'item.evidence_level === "retest_pending"' in script
    assert "Previous records remain source references only" in script
    assert "旧记录仅作来源参考" in script
    assert "indexModResults();" in script
    assert "row.do_not_repeat" in script and "row.reopen_requires" in script
    assert ".replace(/gennova(?:-hust)?[a-z0-9-]*/gi" in script
    assert ".replace(/stateaxis[a-z0-9-]*/gi" in script
    assert 'source.href = "./data/mod-test-evidence.json"' in script
    assert '<a href="./plugins.html#plugin-catalog"><span>04 / EVIDENCE</span>' in home
    assert "attached to each corresponding MOD" in home


def test_old_result_url_redirects_to_catalog():
    redirect = (ROOT / "mod-results.html").read_text()
    assert "url=./plugins.html#plugin-catalog" in redirect
    assert 'window.location.replace("./plugins.html#plugin-catalog")' in redirect
    assert "data-mod-report" not in redirect


def test_new_mod_homes_have_requested_owner_and_no_advisor():
    components = {row["id"]: row for row in load("ecosystem.json")["components"]}
    for component_id in (
        "gdn-optimizations",
        "runtime-micro-optimizations",
        "ascend-attention-optimizations",
    ):
        component = components[component_id]
        assert component["maintainers"] == ["ShuhaoZhangTony"]
        assert component["advisors"] == []
        assert component["canonical_repository"].startswith(
            "https://github.com/vLLM-HUST/"
        )
