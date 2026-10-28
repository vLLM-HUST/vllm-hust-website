"""Check the data guide without downloading datasets or calling model services."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


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
                    assert page.locator(".brand-mark").inner_text() == "V"
                    assert (
                        page.locator(".brand-mark").evaluate(
                            "e=>getComputedStyle(e).backgroundColor"
                        )
                        == "rgb(240, 179, 65)"
                    )
                    page.wait_for_function(
                        "document.querySelectorAll('#designated-cards .focus-card').length === 5"
                    )
                    assert page.locator("#ordinary").is_hidden()
                    assert page.locator("#all-sources").is_hidden()
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
                    assert page.evaluate(
                        "getComputedStyle(document.querySelector('h1')).color === getComputedStyle(document.body).color"
                    )
                    page.screenshot(
                        path=str(args.output / f"{language}-{width}-{theme}.png")
                    )
                    for anchor in (
                        "MMLU_PRO",
                        "HLE_VERIFIED",
                        "SWE_BENCH_PRO",
                        "FRONTIERSCIENCE",
                        "TERMINAL_BENCH_2_1",
                    ):
                        page.locator(f'#designated-cards a[href="#{anchor}"]').click()
                        expect(page.locator(f"#{anchor}")).to_have_attribute("open", "")
                    assert page.locator("#TERMINAL_BENCH_2_1").is_visible()
                    terminal = page.locator("#TERMINAL_BENCH_2_1")
                    for command in (
                        "harbor run -c job-oracle.json",
                        "harbor run -c job-smoke.json",
                        "harbor run -c job-b0.json",
                        "harbor run -c job-b1.json",
                    ):
                        assert command in terminal.inner_text()
                    for anchor in ("terminal-preparation", "terminal-validation"):
                        panel = page.locator(f"#{anchor}")
                        assert not panel.evaluate("e => e.open")
                        panel.locator("summary").click()
                        expect(panel).to_have_attribute("open", "")
                    assert "python3.12 -m venv" in terminal.inner_text()
                    assert "--validate-harbor" in terminal.inner_text()
                    assert "null reward" in terminal.inner_text()
                    swe = page.locator("#SWE_BENCH_PRO")
                    assert swe.locator('a[href*="#coder-"]').count() == 1
                    assert (
                        swe.locator('a[href$="references/swe-bench-pro.md"]').count()
                        == 1
                    )
                    assert "quality_score: null" in swe.inner_text()
                    page.screenshot(
                        path=str(args.output / f"guides-{language}-{width}-{theme}.png")
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
                            "designated_datasets": 5,
                            "page_errors": errors,
                        }
                    )
                    context.close()
        browser.close()
    (args.output / "receipt.json").write_text(
        json.dumps({"checks": results, "model_requests": 0}, indent=2) + "\n"
    )
    print(
        "PASS: 8 bilingual viewport/theme checks; 5 designated datasets; no model requests"
    )


if __name__ == "__main__":
    main()
