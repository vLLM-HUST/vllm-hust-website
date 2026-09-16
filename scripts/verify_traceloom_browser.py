"""Verify the peer MOD entry, unified package commands and bilingual project page."""

import argparse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8768")
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / "output/playwright/traceloom"
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch()
        for width, viewport in [(1440, "desktop"), (390, "mobile")]:
            for language in ["en", "zh"]:
                page = browser.new_page(viewport={"width": width, "height": 1000})
                errors = []
                page.on(
                    "pageerror", lambda error, errors=errors: errors.append(str(error))
                )
                page.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang', '{language}');"
                )
                response = page.goto(f"{args.url}/traceloom.html")
                assert response.status == 200
                page.wait_for_function(
                    "lang => document.documentElement.lang === lang", arg=language
                )
                assert page.locator("h1").inner_text() == "TraceLoom."
                assert (
                    page.locator("#modes h2").evaluate("e => getComputedStyle(e).color")
                    == "rgb(20, 43, 42)"
                )
                assert (
                    page.locator("#modes h3").first.evaluate(
                        "e => getComputedStyle(e).color"
                    )
                    == "rgb(20, 43, 42)"
                )
                assert "14,144" in page.locator("#evidence").inner_text()
                assert page.locator("#capture img").evaluate(
                    "image => image.complete && image.naturalWidth > 0"
                )
                assert "traceloom==0.1.2" in page.locator("#integration").inner_text()
                assert "result.query" in page.locator("#integration").inner_text()
                page.locator("#integration summary").click()
                assert (
                    'bundled_rules("scheduler-step")'
                    in page.locator("#integration").inner_text()
                )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth"
                )
                page.evaluate("window.scrollTo(0, 0)")
                page.screenshot(
                    path=str(output / f"page-{viewport}-{language}.png"), full_page=True
                )
                page.goto(f"{args.url}/plugins.html")
                search = page.locator("[data-plugin-search]")
                search.fill("TraceLoom")
                card = page.locator(".workshop-card").filter(
                    has=page.get_by_role("heading", name="TraceLoom", exact=True)
                )
                card.wait_for()
                assert card.count() == 1
                assert card.locator('a[href="./traceloom.html"]').count() == 1
                card.locator(".plugin-launch-icon").click()
                expect(card.locator("pre")).to_contain_text(
                    "pip install traceloom==0.1.2", use_inner_text=True
                )
                expect(card.locator("pre")).to_contain_text(
                    "traceloom.vllm.TracingAsyncScheduler", use_inner_text=True
                )
                page.screenshot(
                    path=str(output / f"card-{viewport}-{language}.png"), full_page=True
                )
                assert not errors, errors
                page.close()
        browser.close()
    print(
        "TraceLoom desktop/mobile, EN/ZH, MOD search, package commands and real-data image passed"
    )


if __name__ == "__main__":
    main()
