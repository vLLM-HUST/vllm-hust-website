"""Check the public case study's rendered evidence, language, links and layout."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8769")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    evidence = json.loads((root / "data/betterscale-results.json").read_text())
    output = root / "output/playwright/betterscale"
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, label in ((1440, "desktop"), (390, "mobile")):
            for language in ("en", "zh"):
                page = browser.new_page(viewport={"width": width, "height": 1000})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang', '{language}');"
                )
                response = page.goto(f"{args.url}/betterscale.html")
                assert response.status == 200
                page.wait_for_function(
                    "lang => document.documentElement.lang === lang", arg=language
                )
                assert (
                    page.locator("#measurements h2").evaluate(
                        "e => getComputedStyle(e).color"
                    )
                    == "rgb(16, 25, 25)"
                )
                assert page.locator("h1").inner_text() == "BetterScale."
                assert (
                    page.locator("#mechanism h2")
                    .inner_text()
                    .startswith(
                        "Less orchestration." if language == "en" else "减少编排等待。"
                    )
                )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= window.innerWidth"
                ), f"Horizontal page overflow: {label}/{language}"
                for study in evidence["studies"]:
                    card = page.locator(f"#{study['id']}")
                    rows = card.locator(".bs-repeat")
                    assert rows.count() == len(study["repeats"])
                    for i, repeat in enumerate(study["repeats"]):
                        numbers = rows.nth(i).locator(".bs-bar-row b")
                        for j, side in enumerate(("control", "candidate")):
                            assert (
                                numbers.nth(j)
                                .inner_text()
                                .startswith(f"{repeat[side + '_ms']:.2f}")
                            )
                            bar = rows.nth(i).locator(f".bs-bar.{side}")
                            percent = float(
                                bar.evaluate(
                                    "e => e.style.getPropertyValue('--width').trim().replace('%', '')"
                                )
                            )
                            assert (
                                abs(percent - repeat[side + "_ms"] / 70 * 100) < 0.001
                            )
                page.screenshot(path=str(output / f"opening-{label}-{language}.png"))
                page.screenshot(
                    path=str(output / f"{label}-{language}.png"), full_page=True
                )
                page.locator("#measurements").screenshot(
                    path=str(output / f"measurements-{label}-{language}.png"),
                    style=".site-nav, .lang-toggle { visibility: hidden; }",
                )
                page.locator("#langToggle").click()
                assert (
                    page.locator("#mechanism h2")
                    .inner_text()
                    .startswith(
                        "减少编排等待。" if language == "en" else "Less orchestration."
                    )
                )
                assert not errors, errors
                page.close()
        page = browser.new_page()
        for name in ("plugins",):
            page.goto(f"{args.url}/{name}.html")
            assert page.locator('.bs-feature a[href="./betterscale.html"]').is_visible()
        for name in ("index", "achievements"):
            page.goto(f"{args.url}/{name}.html")
            assert page.locator('.bs-feature a[href="./betterscale.html"]').count() == 0
        for name in ("data/betterscale-results.json", "docs/BETTERSCALE.md"):
            assert page.request.get(f"{args.url}/{name}").status == 200
        browser.close()
    print(
        "PASS: desktop/mobile, EN/ZH, language toggle, all repeats/bar scales, case-study links"
    )


if __name__ == "__main__":
    main()
