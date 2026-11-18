"""Exercise product workflows, language state, navigation and accessible layouts."""

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import expect, sync_playwright


CONTRAST = r"""el => {
    const rgba = s => s.match(/[\d.]+/g).map(Number);
    const over = (f,b) => f.slice(0,3).map((v,i)=>v*(f[3]??1)+b[i]*(1-(f[3]??1)));
    const lum = c => c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    let bg=[255,255,255];
    const ancestors=[]; for(let n=el;n;n=n.parentElement) ancestors.unshift(n);
    for(const n of ancestors) bg=over(rgba(getComputedStyle(n).backgroundColor),bg);
    const ink=over(rgba(getComputedStyle(el).color),bg);
    return (Math.max(lum(ink),lum(bg))+.05)/(Math.min(lum(ink),lum(bg))+.05);
}"""


def verify_publications(page, product, language):
    """Check the published citations against the editorial coverage inventory."""
    inventory = (
        Path(__file__).resolve().parents[1] / "docs/product-publications.md"
    ).read_text()
    expected = set()
    for line in inventory.splitlines():
        fields = [field.strip() for field in line.split("|")]
        if len(fields) == 5 and product in fields[3].split(", "):
            expected.add(re.sub(r"\\([\[\]])", r"\1", fields[1]))
    assert expected
    section = page.locator("#publications")
    expect(section).to_have_count(1)
    expect(page.locator(".publications-shortcut")).to_have_attribute(
        "href", re.compile(r"#publications$")
    )
    page.locator(".publications-shortcut").focus()
    page.keyboard.press("Enter")
    expect(section).to_be_visible()
    expect(page).to_have_url(re.compile(r"#publications$"))
    expect(section.locator("#publications-title")).to_contain_text(
        "相关论文" if language == "zh" else "Related publications"
    )
    entries = section.locator(".publication-item").evaluate_all(
        """nodes => nodes.map(node => ({
            id: node.id, title: node.querySelector('.publication-title').textContent,
            href: node.querySelector('.publication-title').href,
            citation: node.querySelector('.publication-citation p').textContent,
            year: Number(node.dataset.publicationYear),
            links: [...node.querySelectorAll('a')].map(a=>a.href)
        }))"""
    )
    assert len(entries) == len(expected)
    assert {entry["title"] for entry in entries} == expected
    assert len({entry["id"] for entry in entries}) == len(entries)
    assert int(section.locator(".publication-count").inner_text()) == len(entries)
    for entry in entries:
        assert entry["citation"] and 2013 <= entry["year"] <= 2027
        assert all(link.startswith("https://") for link in entry["links"])
    for group in section.locator(".publication-group").all():
        years = group.locator(".publication-item").evaluate_all(
            "nodes => nodes.map(n=>Number(n.dataset.publicationYear))"
        )
        assert years == sorted(years, reverse=True)
    expect(section.locator(".publication-citation[open]")).to_have_count(0)
    for details in (
        section.locator(".publication-citation").first,
        section.locator(".publication-citation").last,
        section.locator(".publication-provenance"),
    ):
        details.locator("summary").focus()
        page.keyboard.press("Enter")
        expect(details).to_have_attribute("open", "")
        expect(details.locator("p")).to_be_visible()
        page.keyboard.press("Enter")
        expect(details).not_to_have_attribute("open", "")
    source = section.get_attribute("data-publication-source")
    identity = re.fullmatch(
        r"https://github[.]com/ShuhaoZhangTony/shuhaozhangtony[.]github[.]io/"
        r"blob/([a-f0-9]{40})/contents/publications[.]md",
        source,
    )
    assert identity, source
    revision = identity[1]
    for link in section.locator('a[href*="raw.githubusercontent.com"]').all():
        assert f"/{revision}/contents/research_papers/" in link.get_attribute("href")
    if product == "continuum":
        accepted = section.locator(".publication-item").filter(
            has_text="BriskSeed: Online History-Guided Reuse"
        )
        expect(accepted.locator(".publication-status")).to_contain_text(
            "已接收" if language == "zh" else "Accepted"
        )
        expect(accepted.locator('a[href$=".pdf"]')).to_have_count(0)
    if product == "control-plane":
        for title in ("Demonstrating SAGE:", "BriskSnapshot:"):
            demo = section.locator(".publication-item").filter(has_text=title)
            expect(demo.locator(".publication-status")).to_contain_text("Demo")
    for selector in (
        "h2",
        "h3",
        ".publication-title",
        ".publication-meta",
        ".publication-links a",
        ".publication-citation summary",
    ):
        for element in section.locator(selector).all():
            assert element.evaluate(CONTRAST) >= 4.5, (product, selector)
    for link in section.locator(".publication-navigation a").all():
        target = link.evaluate("a => a.href")
        target_id = "#" + target.split("#", 1)[1]
        link.focus()
        page.keyboard.press("Enter")
        expect(page).to_have_url(target)
        expect(page.locator(target_id)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    return len(entries)


def close_publication_library(page):
    """Native close remains closed after the preceding anchor events drain."""
    summary = page.locator(".publication-library > summary")
    summary.focus()
    page.keyboard.press("Enter")
    expect(page.locator(".publication-library")).not_to_have_attribute("open", "")
    page.evaluate(
        "() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
    )
    expect(page.locator(".publication-library")).not_to_have_attribute("open", "")


LAYOUT_SIGNATURES = {}


def verify_product_layout(page, product, width, theme, language):
    """All three products use one visual hierarchy without erasing their scope."""
    expect(page.locator("body.product-home")).to_have_count(1)
    expect(page.locator('link[href*="assets/product-layout.css?v="]')).to_have_count(1)
    expect(page.locator('script[src*="assets/product-layout.js?v="]')).to_have_count(1)
    main = page.locator("main.product-shell")
    expect(main.locator(":scope > .product-hero h1")).to_have_count(1)
    expect(main.locator(":scope > .product-capabilities > article")).to_have_count(3)
    expect(main.locator(".product-diagram")).to_have_count(1)
    expect(main.locator(".product-owner")).to_contain_text(
        "毛言粲" if product == "control-plane" else "张书豪"
    )
    roles = main.evaluate("""el => [...el.children].map(n =>
        n.classList.contains('product-switcher') ? 'switcher' :
        n.classList.contains('product-jumps') ? 'jumps' :
        n.classList.contains('product-hero') ? 'hero' :
        n.classList.contains('product-capabilities') ? 'capabilities' :
        n.id === 'workflow' ? 'workflow' : n.id)
    """)
    assert roles == [
        "switcher",
        "jumps",
        "hero",
        "capabilities",
        "workflow",
        "product-details",
        "product-stack",
        "publications",
    ], roles
    signature = page.evaluate("""() => {
        const style = s => getComputedStyle(document.querySelector(s));
        return {
            width: document.querySelector('main').getBoundingClientRect().width,
            titleSize: style('h1').fontSize,
            titleWeight: style('h1').fontWeight,
            radius: style('.product-diagram').borderRadius,
            cardRadius: style('.product-capabilities article').borderRadius,
            padding: style('.product-hero').padding,
            background: style('body').backgroundColor
        };
    }""")
    key = (width, theme, language)
    if key in LAYOUT_SIGNATURES:
        assert signature == LAYOUT_SIGNATURES[key], (product, key, signature)
    else:
        LAYOUT_SIGNATURES[key] = signature
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    for selector in (
        ".product-jumps a",
        ".product-capabilities p",
        ".product-owner",
        ".product-status",
        ".product-actions a",
    ):
        for node in page.locator(selector).all():
            assert node.evaluate(CONTRAST) >= 4.5, (product, selector)
    if product == "continuum":
        expect(page.locator(".product-intro .product-eyebrow")).to_have_text(
            "智能体工作环境" if language == "zh" else "AGENT WORKSPACE"
        )
        expect(page.locator(".memory-stack > div")).to_have_count(4)
        expect(page.locator('[data-copy="memoryC"]')).to_contain_text(
            "沙箱" if language == "zh" else "Sandbox"
        )
        expect(page.locator(".product-status")).to_have_text(
            "架构规划" if language == "zh" else "Architecture planning"
        )
    library = page.locator(".publication-library")
    expect(library).not_to_have_attribute("open", "")
    library.locator(":scope > summary").focus()
    page.keyboard.press("Enter")
    expect(library).to_have_attribute("open", "")
    page.keyboard.press("Enter")
    expect(library).not_to_have_attribute("open", "")


def verify_product_deep_links(browser, args):
    """A shared collapsed library must still support saved and repeated links."""
    context = browser.new_context(viewport={"width": 390, "height": 1000})
    page = context.new_page()
    for slug in ("engine", "control-plane", "continuum"):
        url = urljoin(args.url.rstrip("/") + "/", f"{slug}.html")
        page.goto(url)
        paper = page.locator(".publication-item").first.get_attribute("id")
        page.goto(url + "#" + paper)
        page.reload(wait_until="networkidle")
        expect(page.locator(".publication-library")).to_have_attribute("open", "")
        expect(page.locator("#" + paper)).to_be_visible()
        page.goto(url + "#publications")
        expect(page.locator(".publication-library")).to_have_attribute("open", "")
        page.locator(".publication-library > summary").click()
        expect(page.locator(".publication-library")).not_to_have_attribute("open", "")
        page.locator(".publications-shortcut").click()
        expect(page.locator(".publication-library")).to_have_attribute("open", "")
        if slug == "engine":
            for anchor in ("#r8-mods", "#release", "#r8-current-results"):
                page.goto(url + anchor)
                expect(page.locator(anchor)).to_be_visible()
    context.close()


RESEARCH_URL = "https://lab.sage.org.ai/auto-research-report-website/"


def verify_home_product_navigation(browser, args, rows):
    """The three product lines own the homepage; apps stay in ecosystem details."""
    for width in (390, 1440):
        for theme in ("light", "dark"):
            context = browser.new_context(
                viewport={"width": width, "height": 1000}, color_scheme=theme
            )
            context.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(
                urljoin(args.url.rstrip("/") + "/", "index.html"),
                wait_until="domcontentloaded",
            )
            for language in ("en", "zh"):
                if page.locator("html").get_attribute("lang") != language:
                    page.locator("#langToggle").click()
                expect(page.locator("#ecosystem-details-link")).to_have_attribute(
                    "href", "./ecosystem-archive.html"
                )
                expect(page.locator(".core-product h3")).to_have_text(
                    ["Engine", "Control Plane", "Continuum"]
                )
                expect(
                    page.locator(
                        "#products .product-card, #product-research, [data-product-id]"
                    )
                ).to_have_count(0)
                expect(
                    page.locator('.nav-links > a[href="./engine.html"]')
                ).to_have_count(0)
                expect(
                    page.locator('[data-nav-group="products"] a[href="./engine.html"]')
                ).to_have_count(1)
                expect(page.locator("#core-memory-role")).to_contain_text(
                    "规划中" if language == "zh" else "Planned"
                )
                for slug in ("engine", "control-plane", "continuum"):
                    expect(
                        page.locator(f'#products a[href="./{slug}.html"]')
                    ).to_have_count(1)
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth + 1"
                )
                for selector in (
                    ".core-product p",
                    ".core-product-link",
                    ".core-product-kicker",
                ):
                    for node in page.locator(selector).all():
                        assert node.evaluate(CONTRAST) >= 4.5, (
                            selector,
                            width,
                            theme,
                            language,
                        )
                page.locator("#products").scroll_into_view_if_needed()
                page.screenshot(
                    path=str(
                        args.output / f"home-products-{width}-{theme}-{language}.png"
                    )
                )
                rows.append(
                    dict(
                        page="home-products",
                        width=width,
                        theme=theme,
                        language=language,
                    )
                )
            assert not errors, errors
            context.close()


def verify_homepage_research(browser, args, rows):
    """Preserve application links on the ecosystem detail page."""
    homepage_rows = []
    origin = urljoin(args.url, "/")
    for width in (390, 1440):
        for theme in ("light", "dark"):
            context = browser.new_context(
                viewport={"width": width, "height": 1000},
                color_scheme=theme,
                reduced_motion="reduce",
            )
            context.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
            page = context.new_page()
            errors = []
            network_errors = []
            model_requests = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on(
                "response",
                lambda response: (
                    network_errors.append(response.url)
                    if response.status >= 400 and response.url.startswith(origin)
                    else None
                ),
            )
            page.on(
                "request",
                lambda request: (
                    model_requests.append(request.url)
                    if re.search(r"/v1/(chat|responses|completions)", request.url)
                    else None
                ),
            )
            try:
                response = page.goto(
                    urljoin(args.url.rstrip("/") + "/", "ecosystem-archive.html"),
                    wait_until="domcontentloaded",
                )
                assert response is not None and response.status == 200
                research = page.locator("#product-research")
                expect(research).to_have_count(1)
                cards = page.locator("#products > .product-grid > .product-card")
                assert cards.count() >= 3
                expect(cards.nth(0).locator("#product-workstation-name")).to_have_text(
                    "vLLM-HUST Workstation"
                )
                expect(cards.nth(1).locator("#product-mate-name")).to_have_text(
                    "Sage Mate"
                )
                expect(cards.nth(2)).to_have_attribute("id", "product-research")
                expect(research.locator("a")).to_have_count(1)
                cta = research.locator("a.product-cta")
                expect(cta).to_have_attribute("href", RESEARCH_URL)
                expect(cta).to_have_attribute("target", "_blank")
                assert {"noopener", "noreferrer"} <= set(
                    (cta.get_attribute("rel") or "").split()
                )
                for language in ("en", "zh"):
                    if page.locator("html").get_attribute("lang") != language:
                        page.locator("#langToggle").click()
                    expect(page.locator("html")).to_have_attribute("lang", language)
                    expected = (
                        {
                            "name": "推理研究日报",
                            "lead": "基于 SAGE 构建，提供每日研报与专题综述。",
                            "daily": "每日研报",
                            "topic": "专题综述",
                            "feature": "推理全景",
                            "cta": "进入研究总览",
                        }
                        if language == "zh"
                        else {
                            "name": "Inference Research Reports",
                            "lead": (
                                "Built with SAGE, offering daily reports "
                                "and topic reviews."
                            ),
                            "daily": "Daily report",
                            "topic": "Topic review",
                            "feature": "Inference map",
                            "cta": "Explore research",
                        }
                    )
                    for selector, key in (
                        ("#product-research-name", "name"),
                        ("#product-research-positioning", "lead"),
                        ("#product-research-visual-daily", "daily"),
                        ("#product-research-visual-topic", "topic"),
                        ("#product-research-feature-2", "feature"),
                        ("#product-research-cta-copy", "cta"),
                    ):
                        expect(research.locator(selector)).to_have_text(expected[key])
                    if language == "en":
                        assert not re.search(r"[\u4e00-\u9fff]", research.inner_text())
                    page.evaluate(
                        "() => document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))"
                    )
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth + 1"
                    ), (width, theme, language)
                    boxes = [cards.nth(index).bounding_box() for index in range(3)]
                    assert all(box is not None for box in boxes)
                    first, second, third = boxes
                    if width == 1440:
                        assert abs(first["y"] - second["y"]) <= 1, boxes
                        assert first["x"] + first["width"] <= second["x"] + 1, boxes
                        assert abs(first["width"] - second["width"]) <= 1, boxes
                        assert (
                            third["y"]
                            >= max(
                                first["y"] + first["height"],
                                second["y"] + second["height"],
                            )
                            - 1
                        ), boxes
                        assert abs(third["x"] - first["x"]) <= 1, boxes
                        assert abs(third["width"] - first["width"]) <= 1, boxes
                    else:
                        assert second["y"] >= (first["y"] + first["height"] - 1), boxes
                        assert third["y"] >= (second["y"] + second["height"] - 1), boxes
                    daily = research.locator(".research-sheet-daily").bounding_box()
                    topic = research.locator(".research-sheet-topic").bounding_box()
                    visual = research.locator(".research-visual").bounding_box()
                    assert daily and topic and visual
                    assert daily["x"] < topic["x"], (daily, topic)
                    for sheet in (daily, topic):
                        assert sheet["x"] >= visual["x"] - 1, (sheet, visual)
                        assert sheet["x"] + sheet["width"] <= (
                            visual["x"] + visual["width"] + 1
                        ), (sheet, visual)

                    accents = {
                        name: page.locator(
                            f".product-card-{name} .product-cta"
                        ).evaluate("el => getComputedStyle(el).backgroundColor")
                        for name in ("workstation", "mate", "research")
                    }
                    assert all(accents.values()) and len(set(accents.values())) == 3, (
                        theme,
                        accents,
                    )
                    # Tab from the preceding product reaches the new card's one CTA.
                    page.locator("#product-mate-cta").focus()
                    page.keyboard.press("Tab")
                    expect(cta).to_be_focused()
                    assert cta.evaluate("el => el.matches(':focus-visible')")
                    cta.scroll_into_view_if_needed()
                    assert cta.evaluate(
                        """el => {
                            const r = el.getBoundingClientRect();
                            return el.contains(document.elementFromPoint(
                                r.x + r.width / 2, r.y + r.height / 2));
                        }"""
                    ), (width, theme, language)
                    # The existing parser is sufficient for an opaque rgb CTA:
                    # its background fully replaces any color-mix ancestors.
                    opaque = cta.evaluate(
                        r"""el => {
                            const value = getComputedStyle(el).backgroundColor;
                            const match = value.match(/^rgba?\(([^)]+)\)$/);
                            if (!match) return false;
                            const channels = match[1].split(/[,\s/]+/)
                                .filter(Boolean).map(Number);
                            return channels.length === 3 ||
                                (channels.length === 4 && channels[3] === 1);
                        }"""
                    )
                    assert opaque, (
                        theme,
                        cta.evaluate("el => getComputedStyle(el).backgroundColor"),
                    )
                    ratio = cta.evaluate(CONTRAST)
                    assert ratio >= 4.5, (width, theme, language, ratio)
                    assert not errors and not network_errors and not model_requests, (
                        errors,
                        network_errors,
                        model_requests,
                    )
                    screenshot = f"home-research-{width}-{theme}-{language}.png"
                    page.screenshot(
                        path=str(args.output / screenshot),
                        full_page=True,
                    )
                    row = dict(
                        page="home",
                        width=width,
                        theme=theme,
                        language=language,
                        passed=True,
                        screenshot=screenshot,
                        research_href=RESEARCH_URL,
                        cta_contrast=round(ratio, 3),
                        accents=accents,
                        keyboard_reachable=True,
                        daily_before_topic=True,
                    )
                    rows.append(row)
                    homepage_rows.append(row)
            finally:
                context.close()
    assert len(homepage_rows) == 8
    (args.output / "home-research-receipt.json").write_text(
        json.dumps(dict(passed=True, views=homepage_rows, model_requests=0), indent=2)
        + "\n",
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--host-ip", help="Optional verified origin IPv4 for browser DNS"
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rows = []
    launch_args = []
    if args.host_ip:
        from urllib.parse import urlparse

        import socket

        host = urlparse(args.url).hostname
        assert args.host_ip in {r[4][0] for r in socket.getaddrinfo(host, 443)}
        launch_args = [
            "--disable-quic",
            f"--host-resolver-rules=MAP {host} {args.host_ip}",
        ]
    with sync_playwright() as play:
        browser = play.chromium.launch(args=launch_args)
        for slug in ("control-plane", "continuum"):
            for width in (390, 1440):
                for theme in ("light", "dark"):
                    context = browser.new_context(
                        viewport={"width": width, "height": 1000},
                        color_scheme=theme,
                        reduced_motion="reduce",
                    )
                    context.add_init_script(
                        "localStorage.setItem('vllm-hust_lang', 'en')"
                    )
                    page = context.new_page()
                    errors = []
                    network_errors = []
                    model_requests = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on(
                        "response",
                        lambda response: (
                            network_errors.append(response.url)
                            if response.status >= 400
                            else None
                        ),
                    )
                    page.on(
                        "request",
                        lambda request: (
                            model_requests.append(request.url)
                            if re.search(
                                r"/v1/(chat|responses|completions)", request.url
                            )
                            else None
                        ),
                    )
                    response = page.goto(
                        urljoin(args.url.rstrip("/") + "/", f"{slug}.html"),
                        wait_until="networkidle",
                    )
                    assert response.status == 200
                    expect(page.locator("body")).to_have_attribute(
                        "data-product-ready", "true"
                    )
                    assert page.locator("h1").count() == 1
                    for language in ("en", "zh"):
                        if language == "zh":
                            page.locator("#langToggle").click()
                        if language == "en":
                            assert not re.search(
                                r"[\u4e00-\u9fff]",
                                page.locator("main")
                                .inner_text()
                                .replace("毛言粲", "")
                                .replace("张书豪", ""),
                            )
                        assert (
                            "毛言粲" if slug == "control-plane" else "张书豪"
                        ) in page.locator(".product-owner").inner_text()
                        assert (
                            "MOD"
                            in page.locator('[data-copy="stackMods"]').inner_text()
                        )
                        assert page.locator(
                            '.stack-links a[href="./engine.html"] strong'
                        ).inner_text() == ("引擎" if language == "zh" else "Engine")
                        assert page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth"
                        ), (slug, width, theme, language)
                        assert (
                            page.locator(
                                '.product-switcher [aria-current="page"]'
                            ).get_attribute("href")
                            == f"./{slug}.html"
                        )
                        if slug == "continuum":
                            expect(page.locator(".product-status")).to_have_text(
                                "架构规划"
                                if language == "zh"
                                else "Architecture planning"
                            )
                        headings = set()
                        for step in (0, 1, 2, 3):
                            page.locator(f"#flow-tab-{step}").click()
                            expect(page.locator("#flow-panel")).to_have_attribute(
                                "aria-labelledby", f"flow-tab-{step}"
                            )
                            expect(
                                page.locator('[role="tab"][tabindex="0"]')
                            ).to_have_count(1)
                            expect(
                                page.locator('[role="tab"][aria-selected="true"]')
                            ).to_have_count(1)
                            headings.add(page.locator("#flow-heading").inner_text())
                            assert page.locator("#flow-outcome").inner_text()
                        assert len(headings) == 4
                        page.keyboard.press("Home")
                        expect(page.locator("#flow-tab-0")).to_be_focused()
                        page.keyboard.press("ArrowLeft")
                        expect(page.locator("#flow-tab-3")).to_be_focused()
                        page.keyboard.press("ArrowRight")
                        expect(page.locator("#flow-tab-0")).to_be_focused()
                        page.keyboard.press("End")
                        expect(page.locator("#flow-tab-3")).to_be_focused()
                        # Switching languages preserves the selected workflow step.
                        page.locator("#langToggle").click()
                        expect(page.locator("#flow-tab-3")).to_have_attribute(
                            "aria-selected", "true"
                        )
                        page.locator("#langToggle").click()
                        assert not page.locator(
                            ".product-details details[open]"
                        ).count()
                        for detail in page.locator(".product-details details").all():
                            detail.locator("summary").focus()
                            page.keyboard.press("Enter")
                            expect(detail).to_have_attribute("open", "")
                            assert detail.locator("p").is_visible()
                            page.keyboard.press("Enter")
                        verify_product_layout(page, slug, width, theme, language)
                        publications = verify_publications(page, slug, language)
                        close_publication_library(page)
                        selectors = [
                            "h1",
                            ".product-eyebrow",
                            ".product-status",
                            ".product-owner",
                            ".product-lead",
                            ".product-button",
                            ".diagram-caption",
                            ".flow-tabs button",
                            "#flow-heading",
                            "#flow-text",
                            ".flow-outcome",
                            ".product-capabilities p",
                            ".stack-links a",
                            ".product-details summary",
                        ]
                        for selector in selectors:
                            for element in page.locator(selector).all():
                                ratio = element.evaluate(CONTRAST)
                                assert ratio >= 4.5, (slug, theme, selector, ratio)
                        # Navigation is discoverable from every product and keyboard operable.
                        if width == 390:
                            page.locator("#navToggle").click()
                        summary = page.locator('[data-nav-group="products"] > summary')
                        summary.focus()
                        menu = page.locator('[data-nav-group="products"]')
                        if menu.get_attribute("open") is not None:
                            page.keyboard.press("Enter")
                            expect(menu).not_to_have_attribute("open", "")
                        page.keyboard.press("Enter")
                        expect(menu).to_have_attribute("open", "")
                        for target in ("engine", "control-plane", "continuum"):
                            expect(
                                menu.locator(f'a[href="./{target}.html"]')
                            ).to_be_visible()
                            assert (
                                page.locator(
                                    f'.site-directory a[href="./{target}.html"]'
                                ).count()
                                == 1
                            )
                        expect(menu.locator("a")).to_have_text(
                            ["首页", "引擎", "服务控制", "智能体工作环境"]
                            if language == "zh"
                            else ["Home", "Engine", "Control Plane", "Agent Workspace"]
                        )
                        if slug == "control-plane":
                            expect(
                                page.locator(
                                    '.product-actions a[href="./controlplane/"]'
                                )
                            ).to_have_text(
                                "请求限流组件"
                                if language == "zh"
                                else "Request Throttling Controller"
                            )
                        page.screenshot(
                            path=str(
                                args.output
                                / f"menu-{slug}-{width}-{theme}-{language}.png"
                            )
                        )
                        expect(menu.locator('[aria-current="page"]')).to_have_count(1)
                        page.keyboard.press("Escape")
                        if (
                            width == 390
                            and page.locator("#navToggle").get_attribute(
                                "aria-expanded"
                            )
                            == "true"
                        ):
                            page.locator("#navToggle").click()
                        for anchor in ("#workflow",):
                            page.locator(f'.product-actions a[href="{anchor}"]').click()
                            assert page.url.endswith(anchor)
                        assert (
                            not errors and not network_errors and not model_requests
                        ), (errors, network_errors, model_requests)
                        page.locator("#flow-tab-0").click()
                        page.evaluate("window.scrollTo(0,0)")
                        page.screenshot(
                            path=str(
                                args.output / f"{slug}-{width}-{theme}-{language}.png"
                            ),
                            full_page=True,
                        )
                        rows.append(
                            dict(
                                page=slug,
                                width=width,
                                theme=theme,
                                language=language,
                                publications=publications,
                                passed=True,
                            )
                        )
                    context.close()
        verify_home_product_navigation(browser, args, rows)
        verify_homepage_research(browser, args, rows)
        # Product navigation is also available on the existing Engine page.
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto(urljoin(args.url.rstrip("/") + "/", "engine.html"))
        expect(page.locator("#engine-owner")).to_contain_text("张书豪")
        page.locator('[data-nav-group="products"] > summary').click()
        with page.expect_navigation():
            page.locator('.nav-links a[href="./continuum.html"]').click()
        expect(page.locator("body")).to_have_attribute("data-page", "continuum")
        page.close()
        # Engine shares the product layout and retains install/download actions.
        for width in (390, 1440):
            for theme in ("light", "dark"):
                context = browser.new_context(
                    viewport={"width": width, "height": 1000}, color_scheme=theme
                )
                context.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(urljoin(args.url.rstrip("/") + "/", "engine.html"))
                for language in ("en", "zh"):
                    if language == "zh":
                        page.locator("#langToggle").click()
                    verify_product_layout(page, "engine", width, theme, language)
                    count = verify_publications(page, "engine", language)
                    expect(page.locator("#engine-install-title")).to_be_visible()
                    assert page.locator("#engine-hero-download").get_attribute("href")
                    assert not errors, errors
                    page.locator("#publications").screenshot(
                        path=str(
                            args.output
                            / f"engine-publications-{width}-{theme}-{language}.png"
                        )
                    )
                    close_publication_library(page)
                    page.evaluate("window.scrollTo(0,0)")
                    page.screenshot(
                        path=str(
                            args.output / f"engine-{width}-{theme}-{language}.png"
                        ),
                        full_page=True,
                    )
                    rows.append(
                        dict(
                            page="engine",
                            width=width,
                            theme=theme,
                            language=language,
                            publications=count,
                            passed=True,
                        )
                    )
                context.close()
        # The controller's directory entry point keeps the same bibliography.
        for width in (390, 1440):
            for theme in ("light", "dark"):
                context = browser.new_context(
                    viewport={"width": width, "height": 1000}, color_scheme=theme
                )
                context.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(urljoin(args.url.rstrip("/") + "/", "controlplane/"))
                for language in ("en", "zh"):
                    if language == "zh":
                        page.locator("#langToggle").click()
                    count = verify_publications(page, "control-plane", language)
                    expect(page.locator("#control-owner")).to_contain_text(
                        "毛言粲" if language == "zh" else "Yancan Mao"
                    )
                    assert not errors, errors
                    page.locator("#publications").screenshot(
                        path=str(
                            args.output
                            / f"controller-publications-{width}-{theme}-{language}.png"
                        )
                    )
                    rows.append(
                        dict(
                            page="controlplane",
                            width=width,
                            theme=theme,
                            language=language,
                            publications=count,
                            passed=True,
                        )
                    )
                context.close()
        verify_product_deep_links(browser, args)
        browser.close()
    receipt = dict(passed=True, views=rows, model_requests=0)
    (args.output / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(dict(passed=True, views=len(rows), model_requests=0)))


if __name__ == "__main__":
    main()
