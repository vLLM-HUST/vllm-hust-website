from __future__ import annotations

import re
from pathlib import Path


INDEX = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")


def _dictionary(language: str) -> str:
    marker = f"      {language}: {{"
    tail = INDEX.split(marker, 1)[1]
    return tail.split("\n      }", 1)[0]


def _copy(dictionary: str, key: str) -> str:
    match = re.search(rf"'{re.escape(key)}': '([^']*)'", dictionary)
    assert match, f"missing {key}"
    return match.group(1)


def test_high_impact_home_copy_stays_concise_in_both_languages() -> None:
    keys = (
        "home-kicker",
        "home-lede",
        "products-title",
        "products-summary",
        "product-workstation-positioning",
        "product-mate-positioning",
        "stack-summary",
        "atlas-summary",
    )
    en = _dictionary("en")
    zh = _dictionary("zh")

    assert max(len(_copy(en, key)) for key in keys) <= 125
    assert max(len(_copy(zh, key)) for key in keys) <= 55


def test_leadership_value_is_explicit_and_product_outcomes_are_distinct() -> None:
    for phrase in (
        "Turn domestic compute into usable, verifiable inference.",
        "One engine connects upstream compatibility, system innovation, and public evidence.",
        "Two products. From infrastructure to impact.",
        "One workspace to serve models, observe performance, and operate the Ascend inference stack.",
        "A cited AI twin that turns personal knowledge into an always-available service.",
        "让国产算力成为可用、可验证的推理能力。",
        "两款产品，让基础设施真正产生价值。",
    ):
        assert phrase in INDEX

    for advantage in ("Usable", "Evolvable", "Verifiable", "可用", "可演进", "可验证"):
        assert advantage in INDEX


def test_workstation_visual_uses_capabilities_not_unverified_metrics() -> None:
    product_section = INDEX.split('id="products"', 1)[1].split('id="stack"', 1)[0]
    for capability in ("OPENAI", "LIVE", "ASCEND", "API", "METRICS", "BACKEND"):
        assert capability in product_section
    for decorative_metric in (">128<", ">32<", ">100%<", "tok/s", ">ms<", ">health<"):
        assert decorative_metric not in product_section


def test_home_copy_avoids_retired_prompt_like_explanations() -> None:
    retired = (
        "Projects are organized by where they intervene",
        "rather than one privileged backend",
        "these are not plugin artifacts",
        "承担系统创新试验场的作用",
        "不作为独立插件制品",
    )
    for phrase in retired:
        assert phrase not in INDEX


def test_copy_pass_preserves_product_actions() -> None:
    for text in (
        "Open Workstation",
        "Talk to Sage Mate",
        "打开 Workstation",
        "体验 Sage Mate",
    ):
        assert text in INDEX


def test_footer_is_a_short_product_statement() -> None:
    assert "Inference for domestic compute." in INDEX
    assert "面向国产算力的推理服务。" in INDEX
