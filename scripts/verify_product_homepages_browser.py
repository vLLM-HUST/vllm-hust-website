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
                        assert (
                            page.locator(
                                '.stack-links a[href="./engine.html"] strong'
                            ).inner_text()
                            == "Engine"
                        )
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
                        for anchor in ("#workflow", "#product-stack"):
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
                                passed=True,
                            )
                        )
                    context.close()
        # Product navigation is also available on the existing Engine page.
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto(urljoin(args.url.rstrip("/") + "/", "engine.html"))
        expect(page.locator("#engine-owner")).to_contain_text("张书豪")
        page.locator('[data-nav-group="products"] > summary').click()
        with page.expect_navigation():
            page.locator('.nav-links a[href="./continuum.html"]').click()
        expect(page.locator("body")).to_have_attribute("data-page", "continuum")
        browser.close()
    receipt = dict(passed=True, views=rows, model_requests=0)
    (args.output / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(dict(passed=True, views=len(rows), model_requests=0)))


if __name__ == "__main__":
    main()
