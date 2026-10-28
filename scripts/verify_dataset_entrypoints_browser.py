"""Check the data guide without downloading datasets or calling model services."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/dataset-entrypoints")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for language in ("en", "zh"):
            for width in (390, 1440):
                for theme in ("light", "dark"):
                    context = browser.new_context(
                        viewport={"width": width, "height": 950}, color_scheme=theme
                    )
                    page = context.new_page()
                    page.add_init_script(
                        f"localStorage.setItem('vllm-hust_lang', '{language}')"
                    )
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    response = page.goto(
                        args.url.rstrip("/") + "/dataset-introductions.html"
                    )
                    assert response.status == 200
                    page.wait_for_function(
                        "document.querySelectorAll('.entry-source').length === 118"
                    )
                    assert page.locator("#entry-count").inner_text() == "118 / 118"
                    assert 'http-equiv="refresh"' not in page.content()
                    for anchor in (
                        "MMLU_PRO",
                        "HLE_VERIFIED",
                        "FRONTIERSCIENCE",
                        "SWE_BENCH_PRO",
                        "TERMINAL_BENCH_2_1",
                    ):
                        assert page.locator(f"#{anchor}").count() == 1
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth + 1"
                    )
                    page.screenshot(
                        path=str(args.output / f"{language}-{width}-{theme}.png")
                    )
                    page.locator("#entry-search").fill("HLE_VERIFIED")
                    assert page.locator(".entry-source").count() == 1
                    page.locator("#source-HLE_VERIFIED summary").click()
                    assert (
                        "download-plan HLE_VERIFIED"
                        not in page.locator("#source-HLE_VERIFIED").inner_text()
                    )
                    page.locator("#entry-search").fill("")
                    page.locator("#entry-filter").select_option("client")
                    assert page.locator(".entry-source").count() == 5
                    page.locator("#TERMINAL_BENCH_2_1 summary").click()
                    assert (
                        "harbor run -c /ABSOLUTE/PRIVATE/job.json"
                        in page.locator("#TERMINAL_BENCH_2_1").inner_text()
                    )
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth + 1"
                    )
                    assert not errors, errors
                    results.append(
                        {
                            "language": language,
                            "width": width,
                            "theme": theme,
                            "sources": 118,
                            "page_errors": errors,
                        }
                    )
                    context.close()
        browser.close()
    (args.output / "receipt.json").write_text(
        json.dumps({"checks": results, "model_requests": 0}, indent=2) + "\n"
    )
    print("PASS: 8 bilingual viewport/theme checks; 118 sources; no model requests")


if __name__ == "__main__":
    main()
