import json
from pathlib import Path

from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[1]


def test_mod_report_data_is_complete_and_schema_valid():
    payload = json.loads((ROOT / "data/mod-test-evidence.json").read_text())
    schema = json.loads(
        (ROOT / "data/schemas/mod_test_evidence_v1.schema.json").read_text()
    )
    Draft7Validator(schema).validate(payload)
    assert payload["summary"]["catalog_entries"] == 107
    assert len(payload["integration_records"]) == 55
    assert len(payload["combination_effects"]) == 29
    assert len(payload["negative_results"]) == 90
    assert payload["scope"]["official_leaderboard_submission"] is False
    assert payload["scope"]["new_measurements"] is False


def test_mod_report_page_is_visible_and_preserves_boundaries():
    page = (ROOT / "mod-results.html").read_text()
    script = (ROOT / "assets/mod-results.js").read_text()
    plugins = (ROOT / "plugins.html").read_text()
    assert 'data-source="./data/mod-test-evidence.json?v=mod-report-20261105"' in page
    assert "does not add the source project to the vLLM-HUST MOD catalog" in page
    assert "GenNova" not in page
    assert "StateAxis" not in page
    assert 'id="footer-copy">Bounded evidence, reproducible provenance.' in page
    assert '"title":"MOD 测试报告 | vLLM-HUST"' in page
    assert 'href="./mod-results.html"' in plugins
    assert 'payload.schema_version !== "mod-test-evidence/v1"' in script
    assert ".replace(/gennova[a-z0-9-]*/gi" in script
    assert ".replace(/stateaxis[a-z0-9-]*/gi" in script
    assert "do_not_repeat" in script and "reopen_requires" in script
