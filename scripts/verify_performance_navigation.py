"""Verify the focused workflow, stage thresholds and evidence on real data."""

import argparse
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

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
                            assert page.locator(".site-nav .nav-group").count() == 1
                            assert (
                                page.locator(
                                    '.site-nav a[href="./plugins.html"]'
                                ).count()
                                == 0
                            )
                            if width == 390:
                                page.locator("#navToggle").click()
                                page.locator('[data-nav-group="performance"]').evaluate(
                                    "e=>e.open=true"
                                )
                                assert links.first.is_visible()
                                page.keyboard.press("Escape")
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
                                    '#comparison[data-loaded="V0.99"]'
                                )
                                assert page.locator(".focus-result").count() == 4
                                table = page.locator(
                                    "#metric-1 table"
                                ).first.inner_text()
                                assert "54.0301%" in table and "99.9397%" in table
                                assert "50%" in table and "90%" in table
                                assert (
                                    "达到数值门槛" in table
                                    if language == "zh"
                                    else "Meets numeric threshold" in table
                                )
                                assert (
                                    "未达到" in table
                                    if language == "zh"
                                    else "Below threshold" in table
                                )
                                assert (
                                    "258.3035%"
                                    in page.locator("#metric-2 table").inner_text()
                                )
                                assert page.locator("#metric-3 details").count() >= 5
                                assert page.locator(
                                    "#metric-4 .focus-status"
                                ).inner_text()
                                # Evidence links always identify the published source commit.
                                evidence = page.locator(".focus-source a").evaluate_all(
                                    "ee=>ee.map(e=>e.href)"
                                )
                                assert all(
                                    "/blob/" in href or "/tree/" in href
                                    for href in evidence
                                )
                                page.locator("#metric-1 details summary").click()
                                assert (
                                    "151 / 200"
                                    in page.locator("#metric-1").inner_text()
                                )
                                assert (
                                    "156 / 200"
                                    in page.locator("#metric-1").inner_text()
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
                        context.close()
            # A missing publication cannot become an empty "passed" dashboard.
            page = browser.new_page()
            page.route("**/data/midterm-v099.json", lambda route: route.abort())
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
