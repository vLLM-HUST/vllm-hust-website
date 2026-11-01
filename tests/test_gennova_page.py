"""Public promotion is paused; experiment evidence is deliberately preserved."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_gennova_is_not_a_public_page_or_navigation_target():
    assert not (ROOT / "gennova.html").exists()
    for page in [*ROOT.glob("*.html"), ROOT / "assets/site.js"]:
        text = page.read_text()
        assert "./gennova.html" not in text, page
        assert "navGenNova" not in text, page
        assert 'id="independent-engines"' not in text, page


def test_relocated_summary_is_not_a_public_data_endpoint():
    assert not (ROOT / "data/gennova-validation-v1.json").exists()
