from __future__ import annotations

import re
from pathlib import Path

INDEX = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
CATALOG_SCRIPT = (
    Path(__file__).resolve().parents[1] / "assets" / "ecosystem-catalog.js"
).read_text(encoding="utf-8")
HOME_CATALOG_SCRIPT = (
    Path(__file__).resolve().parents[1] / "assets" / "home-catalog.js"
).read_text(encoding="utf-8")


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
        "40 public MODs across 8 lifecycle phases, with scope and evidence explicit.",
        "Explore by phase, scenario, platform, and readiness",
        "activation and performance evidence stay separate",
        "From inference operations to agent applications.",
        "One workspace to serve models, observe performance, and operate the Ascend inference stack.",
        "A cited AI twin built with SAGE that calls vLLM-HUST for model execution.",
        "40 个公开 MOD，覆盖 8 个推理生命周期阶段，范围与证据边界明确。",
        "启用证据与性能证据分开呈现",
        "从推理运维到智能体应用。",
    ):
        assert phrase in INDEX

    for advantage in (
        "Portfolio",
        "Coverage",
        "Evidence",
        "项目组合",
        "覆盖范围",
        "公开证据",
    ):
        assert advantage in INDEX


def test_homepage_mod_summary_matches_canonical_catalog() -> None:
    import json

    root = Path(__file__).resolve().parents[1]
    ecosystem = json.loads(
        (root / "data" / "ecosystem.json").read_text(encoding="utf-8")
    )
    taxonomy = json.loads(
        (root / "data" / "mod-taxonomy.json").read_text(encoding="utf-8")
    )["components"]
    active_kinds = {"runtime_mod", "connector_mod", "tool_mod", "control_plane"}
    mod_projects = {
        item.get("catalog_project_id", item["id"])
        for item in ecosystem["components"]
        if item.get("public_surface", True) is not False
        and taxonomy.get(item["id"], {}).get("kind") in active_kinds
    }
    mod_count = len(mod_projects)
    assert mod_count == 40
    scenario_count = len(
        json.loads(
            (root / "data" / "plugin-workload-navigation.json").read_text(
                encoding="utf-8"
            )
        )["traits"]
    )
    phase_count = len(
        {
            phase
            for item in ecosystem["components"]
            if item.get("public_surface", True) is not False
            and taxonomy.get(item["id"], {}).get("kind") in active_kinds
            for phase in taxonomy[item["id"]]["phases"]
        }
    )
    assert scenario_count == 16
    assert phase_count == 8
    assert f"Explore all {mod_count} MODs" in INDEX
    assert f"查看全部 {mod_count} 个 MOD" in INDEX
    assert f"{mod_count} public MODs" in INDEX
    assert f"{mod_count} 个公开 MOD" in INDEX
    assert f"{phase_count} phases · {scenario_count} scenarios" in INDEX
    assert f"{phase_count} 个阶段 · {scenario_count} 类场景" in INDEX
    assert f">{mod_count}</span>" in INDEX
    assert 'href="./plugins.html#plugin-catalog"' in INDEX
    assert "EcosystemCatalog.summarize(registry, taxonomy)" in HOME_CATALOG_SCRIPT
    assert "stateaxis-topic-mods.json" not in HOME_CATALOG_SCRIPT
    assert "summary.mods.flatMap" in HOME_CATALOG_SCRIPT
    assert "phaseCount" in HOME_CATALOG_SCRIPT
    assert "scenarioCount" in HOME_CATALOG_SCRIPT
    assert "mod-taxonomy.json" in HOME_CATALOG_SCRIPT
    assert "performanceResults" not in CATALOG_SCRIPT
    assert "unverified gains remain unclaimed" in INDEX
    assert "未验证收益不会被写成有效优化" in INDEX


def test_homepage_uses_lifecycle_and_evidence_language() -> None:
    for phrase in (
        "offline preparation and service startup",
        "request admission, prefill, decode",
        "state and service lifecycle, and observability",
        "activation evidence ≠ performance evidence",
        "离线准备、服务启动",
        "请求准入、Prefill、Decode",
        "启用证据 ≠ 性能证据",
    ):
        assert phrase in INDEX

    for stale_phrase in (
        "40 MODs for real serving workloads",
        "58 MODs for real serving workloads",
        "maintainers and results linked from every project",
        "Compare workload fit",
        ">26</span>",
    ):
        assert stale_phrase not in INDEX


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
