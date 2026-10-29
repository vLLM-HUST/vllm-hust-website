"""Verify the focused workflow, stage thresholds and evidence on real data."""

import argparse
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/playwright/performance-navigation"
PAGES = ("index.html", "dataset-introductions.html", "b0-b1.html", "serving-plan.html")
LINKS = ["./dataset-introductions.html", "./b0-b1.html", "./serving-plan.html"]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url")
    args = parser.parse_args()
    server = None
    if not args.url:
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT))
        )
        threading.Thread(target=server.serve_forever, daemon=True).start()
    base = args.url or f"http://127.0.0.1:{server.server_port}"
    OUTPUT.mkdir(parents=True, exist_ok=True)
    receipts = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--no-sandbox"])
            for width in (390, 1440):
                for language in ("zh", "en"):
                    for theme in ("light", "dark"):
                        context = browser.new_context(
                            viewport={"width": width, "height": 1000},
                            color_scheme=theme,
                        )
                        context.add_init_script(
                            f"localStorage.setItem('vllm-hust_lang','{language}')"
                        )
                        page = context.new_page()
                        errors = []
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        for name in PAGES:
                            response = page.goto(
                                f"{base}/{name}", wait_until="networkidle"
                            )
                            assert response.status == 200
                            links = page.locator('[data-nav-group="performance"] a')
                            assert (
                                links.evaluate_all(
                                    "ee=>ee.map(e=>e.getAttribute('href'))"
                                )
                                == LINKS
                            )
                            assert page.locator(".site-nav .nav-group").count() == 4
                            expect(
                                page.locator('.site-nav [data-nav-group="engine"]')
                            ).to_have_count(0)
                            expect(
                                page.locator(
                                    '.nav-links > a[href="./ecosystem-archive.html#stack"]'
                                )
                            ).to_have_count(1)
                            expect(
                                page.locator(".site-nav .brand-link")
                            ).to_have_attribute("href", "./index.html")
                            if name != "index.html":
                                current = page.locator(
                                    '.benchmark-tabs [aria-current="page"]'
                                )
                                expect(current).to_have_count(1)
                                expect(current).to_have_attribute("href", "./" + name)
                                expect(current).to_have_class("active")
                                assert (
                                    current.evaluate(
                                        "e=>getComputedStyle(e).backgroundColor"
                                    )
                                    == "rgb(125, 211, 252)"
                                )
                                assert (
                                    current.evaluate("e=>getComputedStyle(e).color")
                                    == "rgb(4, 17, 29)"
                                )
                                expect(
                                    page.locator(".benchmark-tabs a").nth(2)
                                ).to_contain_text("3.")
                            assert (
                                page.locator(
                                    '.site-nav a[href="./plugins.html"]'
                                ).count()
                                == 1
                            )
                            top = page.locator(
                                ".nav-links > a, .nav-links > details > summary"
                            )
                            assert top.all_text_contents() == (
                                [
                                    "产品",
                                    "项目",
                                    "MOD 目录",
                                    "引擎",
                                    "论文与新闻",
                                    "性能数据",
                                    "社区",
                                    "资源",
                                ]
                                if language == "zh"
                                else [
                                    "Products",
                                    "Projects",
                                    "MOD catalog",
                                    "Engine",
                                    "Papers & news",
                                    "Performance data",
                                    "Community",
                                    "Resources",
                                ]
                            )
                            if width == 390:
                                page.locator("#navToggle").click()
                                direct = page.locator(".nav-links > a")
                                expect(direct).to_have_count(4)
                                boxes = [link.bounding_box() for link in direct.all()]
                                assert boxes[0]["y"] == boxes[1]["y"]
                                assert boxes[2]["y"] == boxes[3]["y"]
                                assert boxes[2]["y"] > boxes[0]["y"]
                            for group in page.locator(".site-nav .nav-group").all():
                                group.locator("summary").click()
                                assert group.locator("a").first.is_visible()
                                expect(
                                    page.locator(".site-nav .nav-group[open]")
                                ).to_have_count(1)
                            page.keyboard.press("Escape")
                            if width == 390:
                                expect(page.locator("#navToggle")).to_have_attribute(
                                    "aria-expanded", "false"
                                )
                            else:
                                expect(
                                    page.locator(".site-nav .nav-group[open]")
                                ).to_have_count(0)
                            if name == "index.html":
                                assert (
                                    page.locator("#focus-paths .focus-card").count()
                                    == 3
                                )
                                assert (
                                    page.locator("#focus-paths a").evaluate_all(
                                        "ee=>ee.map(e=>e.getAttribute('href'))"
                                    )
                                    == LINKS
                                )
                                assert (
                                    "50%" in page.locator("#focus-stages").inner_text()
                                )
                                assert (
                                    "90%" in page.locator("#focus-stages").inner_text()
                                )
                            elif name == "dataset-introductions.html":
                                assert (
                                    page.locator(
                                        "#designated-cards .focus-card"
                                    ).count()
                                    == 5
                                )
                                assert page.locator("#ordinary").is_hidden()
                                assert page.locator("#all-sources").is_hidden()
                            elif name == "b0-b1.html":
                                page.wait_for_selector(
                                    '#comparison[data-loaded="V1.01"]'
                                )
                                overview = page.locator(".comparison-overview")
                                assert page.locator(".comparison-group").count() == 4
                                assert page.locator(".comparison-row").count() == 7
                                assert (
                                    page.locator(".comparison-method[open]").count()
                                    == 0
                                )
                                assert (
                                    overview.bounding_box()["y"]
                                    < page.locator(
                                        ".comparison-methods"
                                    ).bounding_box()["y"]
                                )
                                current = overview.inner_text()
                                for value in (
                                    "3.8407",
                                    "7.1042",
                                    "84.9705%",
                                    "50%",
                                    "90%",
                                    "247.2656",
                                    "885.9611",
                                    "258.3035%",
                                    "1685.4442",
                                    "365.0111",
                                    "78.3433%",
                                    "71.2462",
                                    "17.9418",
                                    "74.8172%",
                                ):
                                    assert value in current, value
                                for withdrawn in ("54.0301%", "99.9397%", "7.1085"):
                                    assert withdrawn not in current
                                assert (
                                    "修订中" if language == "zh" else "under revision"
                                ) in current
                                assert (
                                    "尚不能判定"
                                    in page.locator("#metric-4").inner_text()
                                    if language == "zh"
                                    else "not yet demonstrated"
                                    in page.locator("#metric-4").inner_text()
                                )
                                assert "FrontierScience" in current and "HLE" in current
                                # Every metric exposes both measurements, verdict and gaps
                                # without opening details or horizontal scrolling on mobile.
                                for row in page.locator(".comparison-row").all():
                                    assert row.locator("dt").all_text_contents()[
                                        :2
                                    ] == ["B0", "B1"]
                                    assert row.locator("dd").count() == 4
                                    for value in row.locator("dd").all():
                                        assert (
                                            value.is_visible()
                                            and value.inner_text().strip()
                                        )
                                        box = value.bounding_box()
                                        assert (
                                            box["x"] >= 0
                                            and box["x"] + box["width"] <= width + 1
                                        )
                                evidence = page.locator(".focus-source a").evaluate_all(
                                    "ee=>ee.map(e=>e.href)"
                                )
                                assert all(
                                    "/blob/" in href or "/tree/" in href
                                    for href in evidence
                                )
                                # In-page evidence links open the matching native disclosure.
                                page.locator(
                                    "#metric-1 .comparison-detail-link"
                                ).click()
                                assert (
                                    page.locator("#method-1").get_attribute("open")
                                    is not None
                                )
                                quality = page.locator("#method-1 details summary")
                                quality.focus()
                                page.keyboard.press("Enter")
                                assert (
                                    "151 / 200"
                                    in page.locator("#method-1").inner_text()
                                )
                                assert (
                                    "156 / 200"
                                    in page.locator("#method-1").inner_text()
                                )
                                page.locator(
                                    "#metric-3 .comparison-detail-link"
                                ).click()
                                stability = page.locator("#method-3").inner_text()
                                assert (
                                    "66 / 100" in stability and "62 / 100" in stability
                                )
                                assert (
                                    "157 / 668" in stability
                                    and "316 / 1143" in stability
                                )
                                # Screenshot the default result-first view after interaction.
                                page.goto(f"{base}/{name}", wait_until="networkidle")
                                page.wait_for_selector(
                                    '#comparison[data-loaded="V1.01"]'
                                )
                            else:
                                page.locator("#plan-options input").first.wait_for()
                                page.locator("#cost").fill("5000")
                                before = page.locator("#cost").input_value()
                                page.locator("#langToggle").click()
                                assert page.locator("#cost").input_value() == before
                                page.locator("#langToggle").click()
                            assert page.evaluate(
                                "document.documentElement.scrollWidth <= innerWidth + 1"
                            ), (name, width)
                            if name != "serving-plan.html":
                                assert page.locator("h1").evaluate(
                                    "e=>getComputedStyle(e).color"
                                ) == page.locator("body").evaluate(
                                    "e=>getComputedStyle(e).color"
                                )
                            assert not errors, (name, errors)
                            page.screenshot(
                                path=OUTPUT / f"{name}-{width}-{language}-{theme}.png"
                            )
                            receipts.append([name, width, language, theme, "PASS"])
                        # Restored primary links must reach actual preserved sections.
                        for section_id in ("products", "projects", "stack"):
                            page.goto(
                                f"{base}/ecosystem-archive.html#{section_id}",
                                wait_until="networkidle",
                            )
                            assert page.locator(f"#{section_id}").is_visible()
                            expect(
                                page.locator('.nav-links [aria-current="location"]')
                            ).to_have_attribute(
                                "href", f"./ecosystem-archive.html#{section_id}"
                            )
                            if section_id == "stack":
                                expect(page.locator("#stack-title")).to_contain_text(
                                    "vLLM-HUST"
                                )
                                expect(page.locator("#stack-summary")).to_contain_text(
                                    "我们的重点是各类 MOD 插件优化。"
                                    if language == "zh"
                                    else "Our focus is optimization through MOD plugins."
                                )
                                expect(page.locator("#stack-detail")).to_contain_text(
                                    "vLLM-Ascend-HUST"
                                )
                                for repo in ("vllm-hust", "vllm-ascend-hust"):
                                    expect(
                                        page.locator(
                                            f'#stack a[href="https://github.com/vLLM-HUST/{repo}"]'
                                        )
                                    ).to_be_visible()
                                assert (
                                    "gennova"
                                    not in page.locator("body").inner_text().lower()
                                )
                                page.locator("#stack").screenshot(
                                    path=OUTPUT
                                    / f"engine-{width}-{language}-{theme}.png"
                                )
                        # Hash-only navigation updates the current section without a reload.
                        page.evaluate("location.hash = 'products'")
                        expect(
                            page.locator('.nav-links [aria-current="location"]')
                        ).to_have_attribute("href", "./ecosystem-archive.html#products")
                        page.locator(".brand-link").click()
                        expect(page).to_have_url(f"{base}/index.html")
                        context.close()
            # A missing publication cannot become an empty "passed" dashboard.
            page = browser.new_page()
            page.route("**/data/midterm-v101.json", lambda route: route.abort())
            page.goto(f"{base}/b0-b1.html")
            page.wait_for_function(
                "document.querySelector('#comparison').textContent.includes('retry') || document.querySelector('#comparison').textContent.includes('重试')"
            )
            assert page.locator("#comparison").get_attribute("data-loaded") is None
            browser.close()
    finally:
        if server:
            server.shutdown()
            server.server_close()
    (OUTPUT / "receipt.json").write_text(
        json.dumps({"url": base, "checks": receipts}, indent=2) + "\n"
    )
    print(
        f"PASS: {len(receipts)} page/viewport/language/theme checks; missing-data failure verified"
    )


if __name__ == "__main__":
    main()
