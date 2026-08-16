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
    assert "体验 Sage Mate" in INDEX

    assert CATALOG.count("https://ws.sage.org.ai/") == 1
    assert CATALOG.count("https://twin.sage.org.ai/") == 1
    assert "version: '0.3.5'" in CATALOG
    assert "releasedAt: '2026-08-16'" in CATALOG


def test_product_links_have_consistent_accessible_external_link_contract() -> None:
    assert "link.target = '_blank';" in CATALOG
    assert "link.rel = 'noopener noreferrer';" in CATALOG
    assert "link.setAttribute('aria-label'" in CATALOG
    assert "Open vLLM-HUST Workstation in a new tab" in CATALOG
    assert "Talk to Sage Mate in a new tab" in CATALOG
    assert "在新标签页打开 vLLM-HUST Workstation" in CATALOG
    assert "在新标签页体验 Sage Mate" in CATALOG

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
        ".product-card:hover",
        ".product-card:focus-within",
        ".product-cta:hover",
        ".product-cta:focus-visible",
        ".product-cta:active",
    ):
        assert selector in HOME_CSS

    mobile = HOME_CSS.split("@media (max-width: 760px)", 1)[1]
    assert ".product-grid { grid-template-columns: 1fr; }" in mobile
    assert (
        'grid-template-areas: "meta" "title" "position" "cta" "visual" "features";'
        in mobile
    )
    assert (
        ".product-features { grid-template-columns: repeat(2, minmax(0, 1fr));"
        in mobile
    )
    assert ".product-cta { width: 100%;" in mobile
    assert "overflow-wrap: anywhere;" in mobile
    assert "min-width: 0;" in HOME_CSS


def test_products_have_distinct_graphical_signatures_and_compact_capabilities() -> None:
    assert 'class="product-visual workstation-visual"' in INDEX
    assert 'class="product-visual mate-visual"' in INDEX
    assert "workstation-pipeline" in INDEX
    assert "workstation-metrics" in INDEX
    assert "mate-core" in INDEX
    assert INDEX.count("mate-node ") == 4

    expected_labels = (
        "OpenAI-compatible API",
        "Models &amp; chat",
        "Live metrics",
        "Ascend stack",
        "Knowledge Q&amp;A",
        "Personal corpus",
        "Cited support",
        "Research flows",
    )
    for label in expected_labels:
        assert label in INDEX


def test_mobile_source_order_prioritizes_name_positioning_and_cta() -> None:
    for product in ("workstation", "mate"):
        card = INDEX.split(f'id="product-{product}-name"', 1)[1].split("</article>", 1)[
            0
        ]
        positioning = card.index(f'id="product-{product}-positioning"')
        cta = card.index(f'id="product-{product}-cta"')
        visual = card.index('class="product-visual')
        features = card.index('class="product-features"')
        assert positioning < cta < visual < features


def test_desktop_layout_prioritizes_product_name_and_value_before_visual() -> None:
    assert (
        'grid-template-areas: "meta" "title" "position" "visual" "features" "cta";'
        in HOME_CSS
    )
    assert "border-left: 3px solid var(--product-accent);" in HOME_CSS


def test_whole_card_click_uses_the_visible_cta_as_the_single_link() -> None:
    assert ".product-cta::after" in HOME_CSS
    assert "position: absolute; z-index: 1; inset: 0;" in HOME_CSS
    assert INDEX.count('data-product-id="workstation"') == 1
    assert INDEX.count('data-product-id="sage-mate"') == 1
    assert (
        "tabindex" not in INDEX.split('id="products"', 1)[1].split('id="stack"', 1)[0]
    )


def test_product_section_defines_readable_light_and_dark_themes() -> None:
    assert "@media (prefers-color-scheme: light)" in HOME_CSS
    for color in (
        "#111819",
        "#151f20",
        "#c4d0cf",
        "#eef2ef",
        "#f8fbf9",
        "#0c1112",
        "#374442",
    ):
        assert color in HOME_CSS

    product_styles = HOME_CSS.split(".execution-products {", 1)[1].split(
        ".plugin-path {", 1
    )[0]
    assert "rainbow" not in product_styles.lower()
    assert "text-shadow" not in product_styles
    assert "linear-gradient" not in product_styles


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
