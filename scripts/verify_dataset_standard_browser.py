"""Check the published protocol UI and integrity failure at desktop/mobile widths."""

import argparse
import json
from urllib.parse import urljoin
from pathlib import Path
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument("url")
p.add_argument("--output", required=True)
args = p.parse_args()
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as play:
    browser = play.chromium.launch(headless=True, args=["--no-sandbox"])
    for name, url in [("standard", args.url), ("entry", urljoin(args.url, "dataset-introductions.html"))]:
        for width in [1440, 390]:
            page = browser.new_page(viewport=dict(width=width, height=1100))
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(url, wait_until="networkidle")
            page.wait_for_selector("#standard-content:not([hidden])")
            assert page.locator("#standard-rows tr").count() == 5
            rows = page.locator("#standard-rows tr").all_text_contents()
            assert (
                "200 / 12032" in rows[0]
                and "200 / 1811" in rows[1]
                and "160 / 160" in rows[2]
            )
            assert "64" in rows[3] and "48" in rows[4]
            assert sum("Inference only" in row for row in rows) == 2
            if name == "standard":
                assert page.locator("#standard-files a").count() == 6
            else:
                assert not page.locator("#upstream-guides").evaluate("e => e.open")
                assert page.locator("#test-modes").is_visible()
                assert page.locator("#test-mode-full").bounding_box()["y"] < page.locator("#upstream-guides").bounding_box()["y"]
            assert "2–3" in page.locator("#test-mode-quick").inner_text()
            assert "12–16" in page.locator("#test-mode-full").inner_text()
            assert (
                page.locator("#test-mode-quick code")
                .inner_text()
                .endswith("--datasets mmlu")
            )
            assert (
                page.locator("#test-mode-full code")
                .inner_text()
                .endswith("--datasets mmlu,hle,frontier,swe,terminal")
            )
            assert "not every item" in page.locator("#test-mode-scope").inner_text()
            assert "verified" in page.locator("#standard-status").inner_text()
            assert not errors, errors
            assert page.evaluate(
                "document.documentElement.scrollWidth <= window.innerWidth"
            ), width
            page.screenshot(path=str(out / f"{name}-{width}.png"), full_page=True)
            page.close()
        page = browser.new_page()
        page.route(
            "**/dataset-standard-v1/standard.json",
            lambda route: route.fulfill(
                status=200, body="{}", content_type="application/json"
            ),
        )
        page.goto(url, wait_until="networkidle")
        page.wait_for_selector("#standard-status[role=alert]")
        assert page.locator("#standard-content").is_hidden()
        assert "checksum mismatch" in page.locator("#standard-status").inner_text()
        page = browser.new_page()
        page.route(
            "**/dataset-run-guide-v1.json",
            lambda route: route.fulfill(
                status=200, body="{}", content_type="application/json"
            ),
        )
        page.goto(url, wait_until="networkidle")
        page.wait_for_selector("#standard-status[role=alert]")
        assert page.locator("#standard-content").is_hidden()
        assert (
            "run guide checksum mismatch" in page.locator("#standard-status").inner_text()
        )
    browser.close()
print(
    json.dumps(
        dict(
            status="passed",
            desktop=1440,
            mobile=390,
            datasets=5,
            pages=["dataset-standard.html", "dataset-introductions.html"],
            inference_only=2,
            integrity_failure="rejected",
        )
    )
)
