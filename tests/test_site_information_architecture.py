from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_JS = (ROOT / "assets" / "site.js").read_text(encoding="utf-8")
SITE_CSS = (ROOT / "assets" / "site.css").read_text(encoding="utf-8")
HOME = (ROOT / "index.html").read_text(encoding="utf-8")
HOME_CSS = (ROOT / "assets" / "home.css").read_text(encoding="utf-8")


def test_primary_navigation_expresses_three_journeys_and_grouped_directories() -> None:
    for label in ("navProducts", "navEngine", "navProjects"):
        assert label in SITE_JS
    assert "pages: ['leaderboard', 'achievements', 'news']" in SITE_JS
    assert "pages: ['members', 'contributors', 'conferences', 'courses']" in SITE_JS
    assert "pages: ['versions', 'issues']" in SITE_JS
    assert '<details class="nav-group"' in SITE_JS


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
    )
    for name in pages:
        text = (ROOT / name).read_text(encoding="utf-8")
        assert "assets/site.css?v=nav-polish-20260826" in text
        assert "assets/site.js?v=nav-polish-20260826" in text
        if name not in ("index.html", "versions.html"):
            assert "assets/subpages.css?v=site-structure-20260816" in text


def test_versions_external_links_have_safe_new_tab_contract() -> None:
    script = (ROOT / "assets" / "versions-page.js").read_text(encoding="utf-8")
    assert script.count('target="_blank" rel="noopener noreferrer"') == 2
    assert "lang === 'zh' && typeof pkg.version_note_zh" in script
    assert "window.addEventListener('vllm-hust:langchange'" in script
