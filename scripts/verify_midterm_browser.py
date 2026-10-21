"""Verify the assembled benchmark publication in real desktop/mobile browsers."""

import argparse
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

SCENARIO = "qwen35-35b-a3b-bf16-tp2-school028-mmlu-inf-out256"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8769")
    args = parser.parse_args()
    output = Path("output/playwright/midterm")
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        )
        for width in (390, 1440):
            for lang in ("zh", "en"):
                for filename in ("dataset-validation.html", "leaderboard-runs.html"):
                    page = browser.new_page(viewport={"width": width, "height": 1000})
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(f"{args.url}/{filename}", wait_until="domcontentloaded")
                    expect(page.locator("#midterm-report")).to_have_attribute(
                        "data-loaded", "V0.50", timeout=30000
                    )
                    page.evaluate("lang => window.vllmHustSite.setLang(lang)", lang)
                    for ident in (
                        "candidates",
                        "quality",
                        "long-context",
                        "long-diagnostic",
                        "resources",
                        "m01",
                    ):
                        section = page.locator(f"#midterm-{ident}")
                        section.scroll_into_view_if_needed()
                        expect(section).to_be_visible()
                        assert section.locator("h3").evaluate(
                            "e => getComputedStyle(e).color === 'rgb(23, 33, 43)'"
                        )
                        assert section.locator("tbody tr").evaluate_all(
                            "rows => rows.every(row => ![...row.cells].every("
                            "cell => /^:?-+:?$/.test(cell.textContent.trim())))"
                        )
                        assert section.locator("tbody tr").count() > 0
                        page.screenshot(
                            path=output / f"{filename}-{width}-{lang}-{ident}.png"
                        )
                    expect(page.locator("#midterm-quality")).to_contain_text("147/200")
                    expect(page.locator("#midterm-quality")).to_contain_text("152/200")
                    expect(page.locator("#midterm-resources")).to_contain_text("2.68%")
                    expect(page.locator("#midterm-m01")).to_contain_text("未判定")
                    expect(page.locator("#midterm-kv-audit")).to_contain_text(
                        "不能排除"
                    )
                    if filename == "dataset-validation.html":
                        expect(page.locator("#validation-model-select")).to_have_value(
                            SCENARIO
                        )
                        select = page.locator("#validation-model-select")
                        alternative = select.locator("option").first.get_attribute(
                            "value"
                        )
                        select.select_option(alternative)
                        expect(select).to_have_value(alternative)
                        select.select_option(SCENARIO)
                        expect(page.locator("#validation-content")).to_be_visible()
                    assert page.locator("#midterm-report").evaluate(
                        "e => e.getBoundingClientRect().right <= innerWidth + 1"
                    )
                    assert not errors, errors
                    page.locator("#midterm-quality").scroll_into_view_if_needed()
                    page.screenshot(path=output / f"{filename}-{width}-{lang}.png")
                    print(filename, width, lang, "PASS", flush=True)
                    page.close()
        page = browser.new_page()
        page.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
        page.route(
            "**/data/midterm-v050.json",
            lambda route: route.fulfill(status=503, body="unavailable"),
        )
        page.goto(f"{args.url}/dataset-validation.html")
        expect(page.locator("#midterm-report [role=status]")).to_contain_text(
            "unavailable"
        )
        assert page.locator("#midterm-quality").count() == 0
        browser.close()


if __name__ == "__main__":
    main()
