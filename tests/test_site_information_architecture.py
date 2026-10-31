import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_JS = (ROOT / "assets" / "site.js").read_text(encoding="utf-8")
SITE_CSS = (ROOT / "assets" / "site.css").read_text(encoding="utf-8")
HOME = (ROOT / "index.html").read_text(encoding="utf-8")
HOME_CSS = (ROOT / "assets" / "home.css").read_text(encoding="utf-8")


def test_labels_titles_and_footer_use_bilingual_public_copy() -> None:
    assert "navPlugins: 'MOD catalog'" in SITE_JS
    assert "navPlugins: 'MOD 目录'" in SITE_JS
    assert "navContributors: '贡献者'" in SITE_JS
    assert "navMembers: 'Organization members'" in SITE_JS
    for name in (
        "index.html",
        "b0-b1.html",
        "dataset-introductions.html",
        "serving-plan.html",
    ):
        assert f"'{name}':" in SITE_JS
        assert any(
            f'class="{footer}"' in (ROOT / name).read_text()
            for footer in ("site-footer", "execution-footer")
        )
    for title in (
        "Inference Engine for Domestic Compute",
        "B0/B1 results",
        "Designated dataset tests",
    ):
        assert title in SITE_JS
    assert "footerNavigation: '页脚导航'" in SITE_JS
    assert "plugin availability alone is not proof" not in HOME


def test_engine_explains_mod_first_focus_and_two_supporting_forks() -> None:
    assert "我们的重点是各类 MOD 插件优化。" in HOME
    assert "部分 MOD 还需要修改 vLLM 或昇腾后端" in HOME
    assert "Our focus is optimization through MOD plugins." in HOME
    assert "Some MODs also need changes to vLLM or its Ascend backend" in HOME
    section = HOME.split('id="stack"', 1)[1].split('id="projects"', 1)[0]
    for repo in ("vllm-hust", "vllm-ascend-hust", "vllm-hust-benchmark"):
        assert f'href="https://github.com/vLLM-HUST/{repo}"' in section
    assert 'href="./plugins.html"' in section
    assert "gennova" not in HOME.lower()
    assert "Independent inference engine" not in HOME
    assert "独立的推理引擎" not in HOME


def test_only_performance_navigation_is_reduced_to_three_deliverables() -> None:
    groups = SITE_JS.split("const NAV_GROUPS =", 1)[1].split("function navLink", 1)[0]
    performance = groups.split("id: 'performance'", 1)[1].split("id: 'community'", 1)[0]
    assert "pages: ['dataset-entrypoints', 'b0-b1', 'serving-plan']" in performance
    assert (
        performance.index("./dataset-introductions.html")
        < performance.index("./b0-b1.html")
        < performance.index("./serving-plan.html")
    )
    assert groups.count("id:") == 4
    for name in ("publications", "community", "resources"):
        assert f"id: '{name}'" in groups
    assert "id: 'engine'" not in groups
    assert "navLink('', './index.html#stack', 'navEngine')" in SITE_JS
    for old in ("leaderboard-runs.html", "dataset-validation.html"):
        assert old not in performance
    for section in ("products", "projects", "stack"):
        href = "./index.html" if section == "products" else f"./index.html#{section}"
        assert href in SITE_JS
        assert f'id="{section}"' in HOME
    assert "navLink('plugins', './plugins.html', 'navPlugins')" in SITE_JS
    for name in (
        "achievements",
        "news",
        "members",
        "contributors",
        "conferences",
        "courses",
        "resources",
        "versions",
        "issues",
        "plugins",
        "ecosystem-archive",
    ):
        assert 'content="noindex, follow"' not in (ROOT / f"{name}.html").read_text()


def test_resources_navigation_lists_two_distinct_verified_cluster_frontends() -> None:
    page = (ROOT / "resources.html").read_text(encoding="utf-8")

    assert 'data-page="resources"' in page
    assert "两个私有云昇腾 910B2 集群" in page
    assert "9443 集群为 2 台 8 卡机器（共 16 卡）" in page
    assert "9450 集群为 4 台 8 卡机器（共 32 卡）" in page
    assert "48 张昇腾 910B2" in page
    assert "2 台 RDMA 互联的 8 卡机器" in page
    assert "4 台 RDMA 互联的 8 卡机器" in page
    assert "数十张" not in page
    for port in (9443, 9450):
        url = (
            f"https://coder.sage.org.ai:{port}/login?redirect=%2Fworkspaces%3Ffilter%3D"
        )
        assert url in page
    assert "https://coder.sage.org.ai:9450/https://" not in page


def test_current_results_and_guide_are_in_shared_navigation() -> None:
    assert (
        "['dataset-entrypoints', './dataset-introductions.html', 'navDatasetGuide']"
        in SITE_JS
    )
    assert "['b0-b1', './b0-b1.html', 'navComparison']" in SITE_JS


def test_benchmark_pages_share_the_ordered_workflow() -> None:
    for name in (
        "dataset-introductions.html",
        "b0-b1.html",
        "serving-plan.html",
        "leaderboard-runs.html",
        "dataset-validation.html",
    ):
        text = (ROOT / name).read_text()
        assert 'class="benchmark-tabs"' in text
        for href in ("dataset-introductions.html", "b0-b1.html", "serving-plan.html"):
            assert f'href="./{href}"' in text


def test_brand_always_returns_home_and_workflow_marks_current_page() -> None:
    import re

    for page in ROOT.glob("*.html"):
        brand = re.search(r'<a\b[^>]*class="brand-link"[^>]*>', page.read_text())
        assert brand and 'href="./index.html"' in brand.group(), page.name
    assert "3. Capacity & cost" in SITE_JS
    assert "3. 产能与成本" in SITE_JS
    assert "function updateNavigationState()" in SITE_JS
    assert "window.addEventListener('hashchange', updateNavigationState)" in SITE_JS
    assert "target.pathname === pathname" in SITE_JS
    assert "link.removeAttribute('aria-current')" in SITE_JS
    assert '.benchmark-tabs a[aria-current="page"]' in SITE_CSS


def test_every_public_page_has_a_cache_safe_static_ecosystem_navigation_entry() -> None:
    for name in (
        "ecosystem-archive.html",
        "leaderboard-runs.html",
        "achievements.html",
        "contributors.html",
        "members.html",
        "conferences.html",
        "courses.html",
        "issues.html",
        "versions.html",
        "plugins.html",
    ):
        text = (ROOT / name).read_text(encoding="utf-8")
        assert 'id="nav-plugins"' in text, name
        assert 'href="./plugins.html">MOD catalog</a>' in text, name
        assert "assets/site.js?v=product-home-20261031" in text, name
    assert "page === 'plugins' ? ' nav-plugin-link'" in SITE_JS


def test_mobile_navigation_uses_compact_accessible_disclosure() -> None:
    assert "button.setAttribute('aria-controls', links.id)" in SITE_JS
    assert "button.setAttribute('aria-expanded', 'false')" in SITE_JS
    assert "event.key !== 'Escape'" in SITE_JS
    assert ".site-nav.enhanced.nav-open .nav-links" in SITE_CSS
    assert "min-height: 64px;" in SITE_CSS
    assert "min-height: 160px;" not in HOME_CSS


def test_homepage_section_index_links_to_existing_primary_sections() -> None:
    assert '<nav class="execution-scope" aria-label="Homepage sections">' in HOME
    for section_id in ("products", "stack", "projects", "ecosystem"):
        assert f'href="#{section_id}"' in HOME
        assert f'id="{section_id}"' in HOME
    assert ".execution-scope a:focus-visible" in HOME_CSS


def test_homepage_leads_with_typed_ecosystem_positioning() -> None:
    assert "40 public MODs across 8 lifecycle phases" in HOME
    assert "Explore by phase, scenario, platform, and readiness" in HOME
    assert "activation and performance evidence stay separate" in HOME
    assert "40 个公开 MOD，覆盖 8 个推理生命周期阶段" in HOME
    assert "按阶段、场景、平台和成熟度探索" in HOME
    assert "启用证据与性能证据分开呈现" in HOME


def test_shared_directory_footer_and_versions_shell_are_site_wide() -> None:
    assert "function renderFooter()" in SITE_JS
    assert "site-directory-links" in SITE_JS
    assert ".site-directory-inner" in SITE_CSS

    versions = (ROOT / "versions.html").read_text(encoding="utf-8")
    assert 'data-page="versions"' in versions
    assert 'class="site-nav"' in versions
    assert 'class="site-footer"' in versions
    assert "assets/site.css?v=benchmarks-ia-20261003" in versions
    assert "assets/site.js?v=product-home-20261031" in versions
    assert "assets/versions.css?v=0.3.7" in versions


def test_all_public_pages_use_the_same_shared_shell_release() -> None:
    pages = (
        "ecosystem-archive.html",
        "leaderboard-runs.html",
        "achievements.html",
        "news.html",
        "contributors.html",
        "members.html",
        "conferences.html",
        "courses.html",
        "issues.html",
        "versions.html",
        "resources.html",
        "plugins.html",
    )
    for name in pages:
        text = (ROOT / name).read_text(encoding="utf-8")
        assert "assets/site.css?v=benchmarks-ia-20261003" in text
        assert "assets/site.js?v=product-home-20261031" in text
        if name not in ("ecosystem-archive.html", "versions.html"):
            assert "assets/subpages.css?v=site-structure-20260816" in text


def test_ecosystem_page_marks_entry_point_standard_as_legacy() -> None:
    page = (ROOT / "plugins.html").read_text(encoding="utf-8")
    standard = (ROOT / "docs" / "PLUGIN_STANDARD.md").read_text(encoding="utf-8")

    assert 'id="plugin-standard"' in page
    assert 'href="#plugin-standard"' in page
    assert 'href="#plugin-catalog"' in page
    assert "TRANSITION" in page
    assert "Domain contracts first; bundles second." in page
    assert "former entry-point-based Plugin Standard 1.0" in page
    assert "Manifest `0.3`" in standard
    assert "`0.3-experimental` remain readable migration inputs" in standard
    assert "One materializer does not prove ecosystem compatibility" in page
    assert "Zero typed providers retain legacy auto-discovery" in page
    assert "explicit victim_selector_plugin must select exactly one" in page
    assert "Platform, operator, and model-runner materializers remain pending" in page
    assert "explicit ordered composition" in page
    assert "declared HMA, piecewise, and cache-layout capabilities" in page
    assert "API-plane telemetry components" in page
    assert "Conflicting ordered layouts fail before import" in page
    assert "KVTransferConfig keeps typed and legacy paths mutually exclusive" in page
    assert "forwards recovery lifecycle signals" in page
    assert "Typed single and ordered_multi selections now materialize" in page
    assert "keyed by logical connector ID instead of class name" in page
    assert "Legacy entry-point profile" in page
    assert "plugin-standard-v1.0.pdf" not in page

    assert '[project.entry-points."vllm_hust.extension_bundles"]' in standard
    assert "## Current commands" in standard
    assert "## Acceptance before alpha" in standard
    assert "rollback/restart, `extension disable`, `extension forget`" in standard


def test_plugin_standard_has_provider_owned_lifecycle_semantics() -> None:
    standard = (ROOT / "docs" / "PLUGIN_STANDARD.md").read_text(encoding="utf-8")

    assert "Extension Manager calls Provider `plan`, `render`, and `check`" in standard
    assert "The initial Provider protocol has no apply or delete operation." in standard
    assert "No Provider performs an implicit service start" in standard
    assert "Uninstall is a package-manager operation" in standard
    for forbidden in (
        "/home/shuhao",
        "npu-smi",
        "CUDA_VISIBLE_DEVICES=",
        "ASCEND_RT_VISIBLE_DEVICES=",
        "pkill",
        "Qixin-Gaoke",
    ):
        assert forbidden not in standard


def test_ecosystem_registry_has_docs_as_its_canonical_owner() -> None:
    registry = json.loads(
        (ROOT / "data" / "ecosystem.json").read_text(encoding="utf-8")
    )

    assert registry["schema_version"] == "1.0"
    assert registry["canonical_owner"] == "vLLM-HUST/vllm-hust-docs"
    assert not (ROOT / "data" / "plugins.legacy.json").exists()
    standard = (ROOT / "docs" / "PLUGIN_STANDARD.md").read_text(encoding="utf-8")
    assert "Manifest `0.3`" in standard
    assert "`0.3-experimental` remain readable migration inputs" in standard


def test_versions_external_links_have_safe_new_tab_contract() -> None:
    script = (ROOT / "assets" / "versions-page.js").read_text(encoding="utf-8")
    assert 'target="_blank" rel="noopener noreferrer"' in script
    assert "function sourceLink(url, label)" in script
    assert "sourceLink(pkg.repo, 'GitHub')" in script
    assert "sourceLink(pkg.source_commit_url, text.commit)" in script
    assert "parsed.protocol !== 'https:'" in script
    assert "const text = COPY[lang]" in script
    assert "仓库 main 快照；不代表该组合已通过生产兼容性验证。" in script
    assert "window.addEventListener('vllm-hust:langchange'" in script
