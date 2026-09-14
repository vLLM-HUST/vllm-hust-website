"""Verify author-owned source MOD rendering in both languages and viewport sizes."""

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
                card = page.locator("#ascend-compact-greedy")
                card.wait_for(state="attached")
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
                    assert card.locator(".plugin-maintainer").count() == 1
                    author = card.locator(".plugin-maintainer")
                    assert (
                        author.get_attribute("href")
                        == "https://github.com/ShuhaoZhangTony"
                    )
                    assert "张书豪" in author.inner_text()
                    assert card.locator(".plugin-advisors").count() == 0
                    assert card.locator(".plugin-external-advisor").count() == 0
                    assert page.locator("#bidkv .plugin-advisors").count() == 1
                    assert "4.42" not in card.inner_text()
                    assert (
                        card.locator(
                            "a[href='https://github.com/vLLM-HUST/vllm-ascend-compact-greedy-hust']"
                        ).count()
                        >= 1
                    )
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= window.innerWidth + 1"
                    )
                    card.screenshot(
                        path=str(output / f"compact-greedy-{width}-{language}.png")
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
        "--output", type=Path, default=Path("output/playwright/compact-greedy")
    )
    args = parser.parse_args()
    verify(args.url, args.output, args.executable)
