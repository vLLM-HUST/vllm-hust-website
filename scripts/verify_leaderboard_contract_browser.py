#!/usr/bin/env python3
"""Verify the setting-contract dialog against the production snapshot."""

import argparse
import re
from pathlib import Path

from playwright.sync_api import sync_playwright


SETTING = "qwen35-35b-a3b-bf16-sweprefix-smoke-v1"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8774")
    args = parser.parse_args()
    output = Path("output/playwright/leaderboard-contract")
    output.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for width, language, theme in (
                (1440, "en", "light"),
                (390, "zh", "dark"),
            ):
                context = browser.new_context(
                    viewport={"width": width, "height": 1000},
                    color_scheme=theme,
                )
                context.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang', '{language}')"
                )
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"{args.url}/leaderboard-runs.html?setting={SETTING}#settings")
                page.wait_for_function(
                    "document.querySelector('#frontier-status')?.dataset.state === 'ready'"
                )
                page.locator("#frontier-contract-open").click()
                dialog = page.locator("#frontier-contract-dialog")
                dialog.wait_for(state="visible")
                assert dialog.get_attribute("open") == ""
                text = dialog.text_content()
                for identity in (
                    "712cf74392b05026a6db2bf213d343747d1f6d45",
                    "8044561ffa1bb430bea8f778ef814d96649321e1a92654b95f64263b996d5e85",
                    "aa23f49e08a946d94eaab21307e9e015140cc8598adfbd5f7e244bdded7b17d0",
                    "4e62e54ef47497fd916a6c2906b220b3af400f87873ea0784740fed3f61e78c8",
                    "3f9ca78537850303ee04bfa6640c020be89723c62f37121c0f27a4c0babc53e0",
                    "swe-prefix-reuse/v1",
                    "FULL_AND_PIECEWISE",
                    "APC",
                ):
                    assert identity in text
                assert re.search(r"TP2 / PP1 / DP1 / EP", text)
                assert "900" in text
                assert dialog.locator("tbody tr").count() == 6
                box = dialog.bounding_box()
                assert box["x"] >= 0 and box["y"] >= 0
                assert box["x"] + box["width"] <= width + 1
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                page.screenshot(
                    path=output / f"{language}-{width}-{theme}.png", full_page=True
                )
                page.keyboard.press("Escape")
                assert not dialog.is_visible()
                assert errors == []
                context.close()
                print(
                    f"PASS {language} {width} {theme}: setting identity and six enabled curve contracts"
                )
        finally:
            browser.close()


if __name__ == "__main__":
    main()
