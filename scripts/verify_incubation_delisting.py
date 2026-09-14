"""Verify the incubating sampling project stays off the public MOD catalog."""

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
                    assert page.locator("#ascend-compact-greedy").count() == 0
                    assert (
                        page.locator(
                            "a[href*='vllm-ascend-compact-greedy-hust']"
                        ).count()
                        == 0
                    )
                    assert page.locator("#betterscale").count() == 1
                    assert page.locator("#bidkv .plugin-advisors").count() == 1
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
