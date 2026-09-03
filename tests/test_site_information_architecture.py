import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_JS = (ROOT / "assets" / "site.js").read_text(encoding="utf-8")
SITE_CSS = (ROOT / "assets" / "site.css").read_text(encoding="utf-8")
HOME = (ROOT / "index.html").read_text(encoding="utf-8")
HOME_CSS = (ROOT / "assets" / "home.css").read_text(encoding="utf-8")


def test_primary_navigation_expresses_three_journeys_and_grouped_directories() -> None:
    for label in ("navProducts", "navEngine", "navProjects", "navPlugins"):
        assert label in SITE_JS
    assert (
        "pages: ['leaderboard', 'achievements', 'dataset-validation', 'news']"
        in SITE_JS
    )
    assert (
        "['dataset-validation', './dataset-validation.html', 'navDatasetValidation']"
        in SITE_JS
    )
    assert "pages: ['members', 'contributors', 'conferences', 'courses']" in SITE_JS
    assert "pages: ['versions', 'issues']" in SITE_JS
    assert '<details class="nav-group"' in SITE_JS


def test_dataset_validation_is_reachable_from_evidence_navigation() -> None:
    assert (
        'href="./dataset-validation.html" data-i18n-common="navDatasetValidation"'
        in SITE_JS
    )


def test_every_public_page_has_a_cache_safe_static_ecosystem_navigation_entry() -> None:
    for name in (
        "index.html",
        "leaderboard.html",
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
        assert 'href="./plugins.html">Ecosystem</a>' in text, name
        assert "assets/site.js?v=nav-polish-20260826" in text, name
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
    assert "Typed runtime contracts. 20 audited MODs. Evidence before claims." in HOME
    assert (
        "every MOD publishes ownership, compatibility, workload fit, and evidence limits"
        in HOME
    )
    assert "类型化运行时契约、20 个已审计 MOD、证据先于结论。" in HOME
    assert "每个 MOD 明示负责人、兼容性、Workload 与证据边界" in HOME


def test_shared_directory_footer_and_versions_shell_are_site_wide() -> None:
    assert "function renderFooter()" in SITE_JS
    assert "site-directory-links" in SITE_JS
    assert ".site-directory-inner" in SITE_CSS

    versions = (ROOT / "versions.html").read_text(encoding="utf-8")
    assert 'data-page="versions"' in versions
    assert 'class="site-nav"' in versions
    assert 'class="site-footer"' in versions
    assert "assets/site.css?v=nav-polish-20260826" in versions
    assert "assets/site.js?v=nav-polish-20260826" in versions
    assert "assets/versions.css?v=site-structure-20260816" in versions


def test_all_public_pages_use_the_same_shared_shell_release() -> None:
    pages = (
        "index.html",
        "leaderboard.html",
        "achievements.html",
        "news.html",
        "contributors.html",
        "members.html",
        "conferences.html",
        "courses.html",
        "issues.html",
        "versions.html",
        "plugins.html",
    )
    for name in pages:
        text = (ROOT / name).read_text(encoding="utf-8")
        assert "assets/site.css?v=nav-polish-20260826" in text
        assert "assets/site.js?v=nav-polish-20260826" in text
        if name not in ("index.html", "versions.html"):
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
    assert "Manifest `0.2-experimental`" in standard
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
    assert "Manifest `0.2-experimental`" in standard


def test_versions_external_links_have_safe_new_tab_contract() -> None:
    script = (ROOT / "assets" / "versions-page.js").read_text(encoding="utf-8")
    assert script.count('target="_blank" rel="noopener noreferrer"') == 2
    assert "lang === 'zh' && typeof pkg.version_note_zh" in script
    assert "window.addEventListener('vllm-hust:langchange'" in script
