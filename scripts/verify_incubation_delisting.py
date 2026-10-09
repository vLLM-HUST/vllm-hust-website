"""Verify retired MODs are archived and reactivated MODs stay correctly typed."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def verify(url: str, output: Path, executable: str | None = None) -> None:
    output.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=executable)
        try:
            for width in (1440, 390):
                page = browser.new_page(viewport={"width": width, "height": 1000})
                page.goto(f"{url.rstrip('/')}/plugins.html", wait_until="networkidle")
                page.locator("#betterscale").wait_for(state="attached")
                for language in ("en", "zh"):
                    if (
                        not page.locator("html")
                        .get_attribute("lang")
                        .startswith(language)
                    ):
                        page.locator("#langToggle").click()
                    page.wait_for_function(
                        "lang => document.documentElement.lang.startsWith(lang)",
                        arg=language,
                    )
                    retired = page.locator(".plugin-category-retired")
                    for retired_id in (
                        "activation-sparsity-migration",
                        "layered-prefill-migration",
                        "qos-scheduler-migration",
                    ):
                        assert retired.locator(f"#{retired_id}").count() == 1
                    assert (
                        page.locator(
                            ".plugin-category-runtime_mod #simllm-migration"
                        ).count()
                        == 1
                    )
                    assert page.locator("#ascend-compact-greedy").count() == 0
                    assert (
                        page.locator(
                            "a[href*='vllm-ascend-compact-greedy-hust']"
                        ).count()
                        == 0
                    )
                    assert page.locator("#betterscale").count() == 1
                    assert page.locator("#bidkv .plugin-advisors").count() == 1
                    search = page.locator("[data-plugin-search]")
                    search.fill("Unified Communication")
                    unified = page.locator("#unified-communication-migration")
                    unified.wait_for(state="visible")
                    unified.locator("details > summary").first.click()
                    assert unified.count() == 1
                    assert (
                        retired.locator("#unified-communication-migration").count() == 1
                    )
                    assert "#42" in unified.inner_text()
                    expected_status = "已退役" if language == "zh" else "retired"
                    assert expected_status in unified.inner_text().lower()
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= window.innerWidth + 1"
                    )
                    page.screenshot(
                        path=str(
                            output / f"unified-communication-{width}-{language}.png"
                        )
                    )
                    search.fill("")
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= window.innerWidth + 1"
                    )
                    page.screenshot(
                        path=str(
                            output / f"incubation-delisting-{width}-{language}.png"
                        )
                    )
                    results.append(
                        {"width": width, "language": language, "passed": True}
                    )
                page.close()
        finally:
            browser.close()
    (output / "result.json").write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--executable")
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/incubation-delisting")
    )
    args = parser.parse_args()
    verify(args.url, args.output, args.executable)
