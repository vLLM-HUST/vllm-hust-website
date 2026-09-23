#!/usr/bin/env python3
"""Verify the empty production surface and deterministic test-only Frontier data."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8774")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("output/playwright/leaderboard-runs/frontier"),
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    site = Path(__file__).resolve().parents[1]
    fixture = json.loads(
        (site / "tests/fixtures/leaderboard_frontier.json").read_text()
    )
    production = json.loads((site / "data/leaderboard_frontier.json").read_text())
    reports = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, language, scheme in [
            (1440, "en", "light"),
            (390, "zh", "light"),
            (1440, "zh", "dark"),
            (390, "en", "dark"),
        ]:
            context = browser.new_context(
                viewport={"width": width, "height": 1000}, color_scheme=scheme
            )
            context.add_init_script(
                f"localStorage.setItem('vllm-hust_lang', '{language}')"
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error, errors=errors: errors.append(str(error)))
            page.goto(
                f"{args.url}/leaderboard-runs.html#frontier",
                wait_until="domcontentloaded",
            )
            page.locator("#frontier-panel").wait_for(state="visible")
            page.wait_for_function(
                "document.querySelector('#frontier-status').dataset.state === 'ready'"
            )
            assert page.locator("#runs-panel").is_hidden()
            assert page.locator("#tasks-panel").is_hidden()
            assert page.locator("#view-frontier-count").inner_text() == str(
                len(production["points"])
            )
            if not production["cohorts"]:
                assert page.locator(".frontier-point").count() == 0
                assert page.locator("#frontier-model").is_disabled()
            page.screenshot(
                path=str(args.output / f"empty-{width}-{language}-{scheme}.png")
            )
            # Fixture only: never shipped as production measurements.
            page.route(
                "**/data/leaderboard_frontier.json",
                lambda route: route.fulfill(json=fixture),
            )
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function(
                "document.querySelectorAll('.frontier-point').length === 4"
            )
            assert page.locator("#view-frontier-count").inner_text() == "5"
            assert page.locator(".frontier-envelope").count() == 1
            assert page.locator("#frontier-rows > tr").count() == 4
            page.locator("#frontier-show-all").uncheck()
            assert page.locator(".frontier-point").count() == 3
            assert (
                page.locator('#frontier-rows [data-point="test-dominated"]').count()
                == 0
            )
            page.locator("#frontier-show-all").check()
            page.locator('#frontier-chart [data-point="test-fast"]').focus()
            page.keyboard.press("Enter")
            assert page.locator("#frontier-detail").is_visible()
            assert (
                "synthetic-test-only" in page.locator("#frontier-detail").inner_text()
            )
            assert (
                page.locator("#frontier-detail a").get_attribute("href")
                == "https://example.com/synthetic-fixture"
            )
            page.locator("#frontier-x").select_option("ttft_p95_ms")
            page.locator("#frontier-y").select_option("cost_per_million")
            assert page.locator(".frontier-point").count() == 3
            page.locator("#frontier-show-all").uncheck()
            assert page.locator(".frontier-point").count() == 2
            page.locator("#frontier-mod").select_option("betterscale")
            assert page.locator(".frontier-point").count() == 1
            page.locator("#frontier-x").select_option("e2e_p95_ms")
            assert page.locator(".frontier-point").count() == 0
            assert page.locator("#frontier-blank").is_visible()
            page.locator("#frontier-x").select_option("interactivity")
            page.locator("#frontier-y").select_option("output_tps_per_chip")
            page.locator("#frontier-mod").select_option("")
            page.locator("#frontier-show-all").check()
            page.locator("#view-runs").click()
            page.locator('#runs-headers [data-column="engine"]').wait_for()
            page.locator("#view-tasks").click()
            assert page.locator("#tasks-panel").is_visible()
            page.locator("#view-frontier").click()
            assert page.locator(".frontier-point").count() == 4
            assert page.locator("table:visible").count() == 1
            page.locator("#langToggle").click()
            assert page.locator(".frontier-point").count() == 4
            assert page.evaluate(
                "document.documentElement.scrollWidth <= window.innerWidth + 1"
            )
            page.locator("#frontier-panel").scroll_into_view_if_needed()
            page.screenshot(
                path=str(args.output / f"fixture-only-{width}-{language}-{scheme}.png")
            )
            assert not errors, errors
            reports.append(
                {
                    "width": width,
                    "language": language,
                    "scheme": scheme,
                    "status": "PASS",
                }
            )
            context.close()
        context = browser.new_context()
        page = context.new_page()
        page.route(
            "**/data/leaderboard_frontier.json",
            lambda route: route.fulfill(json={"invalid": True}),
        )
        page.goto(
            f"{args.url}/leaderboard-runs.html#frontier", wait_until="domcontentloaded"
        )
        page.wait_for_function(
            "document.querySelector('#frontier-status').textContent === 'Snapshot unavailable'"
        )
        assert page.locator(".frontier-point").count() == 0
        page.locator("#view-runs").click()
        page.locator(".run-row").first.wait_for()
        context.close()
        browser.close()
    (args.output / "report.json").write_text(json.dumps(reports, indent=2) + "\n")
    print(json.dumps(reports))


if __name__ == "__main__":
    main()
