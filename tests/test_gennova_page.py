"""Public promotion is paused; experiment evidence is deliberately preserved."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_gennova_is_not_a_public_page_or_navigation_target():
    assert not (ROOT / "gennova.html").exists()
    for page in [*ROOT.glob("*.html"), ROOT / "assets/site.js"]:
        text = page.read_text()
        assert "./gennova.html" not in text, page
        assert "navGenNova" not in text, page
        assert 'id="independent-engines"' not in text, page


def test_withdrawal_preserves_benchmark_evidence():
    data = json.loads((ROOT / "data/gennova-validation-v1.json").read_text())
    assert data["kind"] == "independent-engine"
    assert data["b1_replacement_approved"] is False
    assert data["metrics"]["output_tokens_per_second"] > 0
