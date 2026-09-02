#!/usr/bin/env python3
"""Bounded real-browser regression for the website repair (local or public URL)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument(
        "--browser",
        help="Optional Chromium executable; otherwise use Playwright's installed browser",
    )
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/site-repair")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    report = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=args.browser, headless=True, args=["--no-sandbox"]
        )
        for width, height, scheme in [
            (1440, 1000, "light"),
            (1440, 1000, "dark"),
            (390, 844, "dark"),
            (390, 844, "light"),
        ]:
            context = browser.new_context(
                viewport={"width": width, "height": height}, color_scheme=scheme
            )
            page = context.new_page()
            page.set_default_timeout(12000)
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            for name in ["index", "versions", "issues", "achievements", "plugins"]:
                response = page.goto(
                    f"{args.url.rstrip('/')}/{name}.html",
                    wait_until="domcontentloaded",
                    timeout=25000,
                )
                assert response.status == 200, (name, response.status)
                suffix = f"{name}-{width}-{scheme}"
                if name == "index":
                    for target in ["#stack", "#ecosystem"]:
                        assert page.locator(target).is_visible(), target
                    if width == 390:
                        button = page.locator("#runtime-disclosure")
                        assert button.get_attribute("aria-expanded") == "false"
                        button.focus()
                        page.keyboard.press("Enter")
                        assert page.locator("#runtime-list").is_visible()
                        page.keyboard.press("Enter")
                        assert not page.locator("#runtime-list").is_visible()
                    page.screenshot(
                        path=str(args.output / f"{suffix}.png"), full_page=True
                    )
                elif name == "versions":
                    page.wait_for_function(
                        "document.querySelectorAll('.package-item').length === 7"
                    )
                    assert "pip install" not in page.locator("main").inner_text()
                    contrast = page.locator(".package-item").first.evaluate("""el => {
                        const rgba = s => s.match(/[\\d.]+/g).map(Number);
                        const over = (f,b) => f.slice(0,3).map((v,i)=>v*(f[3]??1)+b[i]*(1-(f[3]??1)));
                        const lum = c => c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
                        const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
                        let bg=[255,255,255];
                        const ancestors=[]; for(let n=el;n;n=n.parentElement) ancestors.unshift(n);
                        for(const n of ancestors) bg=over(rgba(getComputedStyle(n).backgroundColor),bg);
                        return ['.package-name','.package-version','.package-meta','.package-links a'].map(selector=>{
                            const node=el.querySelector(selector), style=getComputedStyle(node);
                            const actual=over(rgba(style.backgroundColor),bg);
                            const ink=over(rgba(style.color),actual);
                            return {selector,color:style.color,background:actual,contrast:ratio(ink,actual),opacity:style.opacity};
                        });
                    }""")
                    assert all(item["contrast"] >= 4.5 for item in contrast), contrast
                    report.append(
                        {"viewport": width, "scheme": scheme, "contrast": contrast}
                    )
                    page.screenshot(
                        path=str(args.output / f"{suffix}.png"), full_page=True
                    )
                    page.locator("#core-packages").screenshot(
                        path=str(args.output / f"{suffix}-cards.png")
                    )
                    link = page.locator(".package-links a").first
                    link.focus()
                    assert (
                        link.evaluate("el=>getComputedStyle(el).outlineStyle") != "none"
                    )
                    page.locator("#langToggle").click()
                    page.wait_for_function(
                        "document.documentElement.lang.startsWith('zh')"
                    )
                    assert (
                        "仓库 main 快照"
                        in page.locator(".package-meta").first.inner_text()
                    )
                    page.reload(wait_until="domcontentloaded")
                    page.wait_for_selector(".package-item")
                    assert page.locator("html").get_attribute("lang").startswith("zh")
                    page.locator("#langToggle").click()
                elif name == "issues":
                    page.wait_for_selector("#issues-content", state="visible")
                    assert page.locator("#issue-stat-total").inner_text() == "0"
                    assert page.locator("#issue-stat-prs").inner_text() == "0"
                    assert page.locator("#issue-list .issue-card").count() == 0
                    page.locator("#issue-archive summary").click()
                    assert page.locator("#issue-archive-list .issue-card").count() == 3
                    assert (
                        page.locator(".issue-pr-state").all_text_contents()
                        == ["Merged"] * 3
                    )
                    assert page.locator(".issue-history-note").count() == 3
                    page.evaluate("window.scrollTo(0, 0)")
                    page.screenshot(
                        path=str(args.output / f"{suffix}.png"), full_page=True
                    )
                elif name == "achievements":
                    page.wait_for_selector("#upstream-repository-browser button")
                    data = page.evaluate(
                        "performance.getEntriesByType('resource').filter(e=>e.name.includes('/data/')).map(e=>e.name)"
                    )
                    assert not data, data
                    assert page.locator("#achievements-content").is_visible()
                    page.screenshot(
                        path=str(args.output / f"{suffix}.png"), full_page=True
                    )
                else:
                    page.wait_for_selector(".workload-filter")
                    filters = page.locator("[data-workload-filters]")
                    assert filters.get_attribute("tabindex") == "0"
                    filters.focus()
                    assert (
                        filters.evaluate("el=>getComputedStyle(el).outlineStyle")
                        != "none"
                    )
                    option = filters.locator("button").nth(1)
                    option.focus()
                    page.keyboard.press("Enter")
                    assert page.evaluate(
                        "document.activeElement.matches('.workload-filter[aria-pressed=true]')"
                    )
                    page.locator("[data-workload-navigation]").screenshot(
                        path=str(args.output / f"{suffix}-filters.png")
                    )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth"
                ), (name, width)
            assert not errors, errors
            # Explicitly exercise a failed metadata request; this is fault injection,
            # separate from screenshots of the actual published content above.
            page.route(
                "**/data/version_meta.json",
                lambda route: route.fulfill(status=503, body="unavailable"),
            )
            page.goto(
                f"{args.url.rstrip('/')}/versions.html",
                wait_until="domcontentloaded",
                timeout=25000,
            )
            page.wait_for_function(
                "document.querySelector('#core-loading').textContent.includes('could not')"
            )
            page.locator("#langToggle").click()
            assert "加载失败" in page.locator("#core-loading").inner_text()
            page.unroute("**/data/version_meta.json")
            page.route(
                "**/data/version_meta.json",
                lambda route: route.fulfill(
                    json={"packages": [], "updated_at": "2020-01-01T00:00:00Z"}
                ),
            )
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function(
                "document.querySelector('#core-loading').textContent.includes('暂无')"
            )
            assert "暂无集成" in page.locator("#infra-loading").inner_text()
            assert (
                page.locator("#versions-verified").get_attribute("data-stale") == "true"
            )
            page.locator("#langToggle").click()
            assert "No core" in page.locator("#core-loading").inner_text()
            report.append(
                {
                    "viewport": width,
                    "scheme": scheme,
                    "layout": "pass",
                    "language_persistence": "pass",
                    "metadata_error_i18n": "pass",
                }
            )
            context.close()
        browser.close()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    (args.output / "results.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
