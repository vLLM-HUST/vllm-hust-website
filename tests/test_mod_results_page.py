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


def test_mod_report_page_is_visible_and_explains_measurement_scope():
    page = (ROOT / "mod-results.html").read_text()
    script = (ROOT / "assets/mod-results.js").read_text()
    plugins = (ROOT / "plugins.html").read_text()
    assert 'data-source="./data/mod-test-evidence.json?v=mod-report-20261105"' in page
    assert 'data-report-source href="./data/mod-test-evidence.json"' in page
    assert "Measured on vLLM-HUST-based stacks" in page
    assert "Each card retains its baseline, quality check, and applicability" in page
    assert "GenNova" not in page
    assert "StateAxis" not in page
    assert 'id="footer-copy">Measured results, traceable configurations.' in page
    assert '"title":"MOD 实测结果 | vLLM-HUST"' in page
    assert 'mod-results.js?v=mod-report-20261106-display' in page
    assert 'href="./mod-results.html"' in plugins
    assert "SINGLE · COMBINATION · COMPATIBILITY" in plugins
    home = (ROOT / "index.html").read_text()
    assert '<a href="./mod-results.html"><span>04 / EVIDENCE</span>' in home
    assert "MOD measured results" in home
    assert 'payload.schema_version !== "mod-test-evidence/v1"' in script
    assert "if (report.source?.report_url)" in script
    assert "integration_records: report.integration_records.length" in script
    assert "combination_effects: report.combination_effects.length" in script
    assert "bounded_negative_results: report.negative_results.length" in script
    assert 'negative: "兼容性 / 负结果"' in script
    assert ".replace(/gennova[a-z0-9-]*/gi" in script
    assert ".replace(/stateaxis[a-z0-9-]*/gi" in script
    assert "do_not_repeat" in script and "reopen_requires" in script
