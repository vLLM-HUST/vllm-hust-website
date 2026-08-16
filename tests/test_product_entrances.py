from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CATALOG = (ROOT / "assets" / "product-catalog.js").read_text(encoding="utf-8")
HOME_CSS = (ROOT / "assets" / "home.css").read_text(encoding="utf-8")


def test_product_names_urls_and_actions_are_release_catalogued() -> None:
    assert "vLLM-HUST Workstation" in INDEX
    assert "Sage Mate" in INDEX
    assert "Open Workstation" in INDEX
    assert "Talk to Sage Mate" in INDEX
    assert "打开 Workstation" in INDEX
    assert "与分身对话" in INDEX

    assert CATALOG.count("https://ws.sage.org.ai/") == 1
    assert CATALOG.count("https://twin.sage.org.ai/") == 1
    assert "version: '0.3.0'" in CATALOG
    assert "releasedAt: '2026-08-16'" in CATALOG


def test_product_links_have_consistent_accessible_external_link_contract() -> None:
    assert "link.target = '_blank';" in CATALOG
    assert "link.rel = 'noopener noreferrer';" in CATALOG
    assert "link.setAttribute('aria-label'" in CATALOG
    assert "Open vLLM-HUST Workstation in a new tab" in CATALOG
    assert "Talk to Sage Mate in a new tab" in CATALOG
    assert "在新标签页打开 vLLM-HUST Workstation" in CATALOG
    assert "在新标签页与 Sage Mate 分身对话" in CATALOG

    for product_id in ("workstation", "sage-mate"):
        assert f'data-product-id="{product_id}"' in INDEX


def test_products_are_the_first_content_section_after_the_hero_scope() -> None:
    scope_position = INDEX.index('class="execution-scope"')
    products_position = INDEX.index('id="products"')
    stack_position = INDEX.index('id="stack"')
    projects_position = INDEX.index('id="projects"')
    assert scope_position < products_position < stack_position < projects_position


def test_product_styles_cover_interaction_and_narrow_mobile_layout() -> None:
    for selector in (
        ".product-cta:hover",
        ".product-cta:focus-visible",
        ".product-cta:active",
    ):
        assert selector in HOME_CSS

    mobile = HOME_CSS.split("@media (max-width: 760px)", 1)[1]
    assert ".product-grid { grid-template-columns: 1fr; }" in mobile
    assert ".product-features { grid-template-columns: 1fr;" in mobile
    assert ".product-cta { width: 100%;" in mobile
    assert "overflow-wrap: anywhere;" in mobile
    assert "min-width: 0;" in HOME_CSS


def test_product_frontend_contains_no_inference_credentials() -> None:
    production_text = "\n".join((INDEX, CATALOG, HOME_CSS))
    forbidden = (
        r"api[_-]?key",
        r"authorization\s*[:=]",
        r"bearer\s+[a-z0-9._-]+",
        r"sk-[a-z0-9_-]{12,}",
    )
    for pattern in forbidden:
        assert re.search(pattern, production_text, flags=re.IGNORECASE) is None


def test_legacy_embedded_application_surface_is_removed() -> None:
    assert not (ROOT / "assets" / "workstation-embed.js").exists()
    assert not (ROOT / "data" / "workstation_embed.json").exists()
    assert "workstation-embed-frame" not in INDEX
    assert "backend_url" not in INDEX
