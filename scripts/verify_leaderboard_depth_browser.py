#!/usr/bin/env python3
"""Bounded depth-selector QA; full historical export traversal lives in the full suite."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright
from verify_leaderboard_frontier_browser import (
    assert_group_frontiers,
    click_point,
    ready,
    verify_rotation_choices,
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8787")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / "data/leaderboard_frontier.json").read_text())
    cohorts = [c for c in data["cohorts"] if not c.get("display_withdrawal")]
    fixture = json.loads(
        (root / "tests/fixtures/leaderboard_frontier.json").read_text()
    )
    with sync_playwright() as p:
        browser = p.chromium.launch()
        verify_rotation_choices(browser, args.url, fixture)
        for width, language, scheme in [
            (1440, "en", "light"),
            (390, "zh", "light"),
            (1440, "zh", "dark"),
            (320, "en", "dark"),
        ]:
            context = browser.new_context(
                viewport={"width": width, "height": 1000}, color_scheme=scheme
            )
            context.add_init_script(
                f"localStorage.setItem('vllm-hust_lang', '{language}')"
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(args.url + "/leaderboard-runs.html#frontier")
            ready(page)
            page.locator("#frontier-only").uncheck()
            for cohort in cohorts:
                page.locator("#frontier-model-trigger").click()
                page.locator(".frontier-model-tag").filter(
                    has_text=cohort["model"]["label"]
                ).click()
                members = [v for v in data["points"] if v["cohort_id"] == cohort["id"]]
                depths = sorted({v["load"]["session_rotation_depth"] for v in members})
                slider = page.locator("#frontier-depth")
                assert slider.is_disabled() == (len(depths) == 1)
                for index, depth in enumerate(depths):
                    if index:
                        slider.focus()
                        slider.press("ArrowRight")
                    assert slider.get_attribute("aria-valuetext") == str(depth)
                    expected = [
                        v
                        for v in members
                        if v["load"]["session_rotation_depth"] == depth
                    ]
                    assert set(
                        page.locator("[data-point]").evaluate_all(
                            "nodes=>nodes.map(n=>n.dataset.point)"
                        )
                    ) == {v["id"] for v in expected}
                    assert_group_frontiers(page, expected)
                    assert (
                        f"{len(expected)} / {len(expected)}"
                        in page.locator("#frontier-filter-count").inner_text()
                    )
                    assert (
                        f"D{depth}"
                        not in page.locator("#frontier-chart").text_content()
                    )
                    page.locator("#frontier-only").check()
                    assert_group_frontiers(page, expected)
                    page.locator("#frontier-only").uncheck()
                    click_point(
                        page, page.locator(f'[data-point="{expected[0]["id"]}"]')
                    )
                    with page.expect_download() as downloaded:
                        page.locator("[data-download]").click()
                    assert (
                        json.loads(Path(downloaded.value.path()).read_text())["point"]
                        == expected[0]
                    )
                    page.locator("[data-close]").click()
                    page.locator("#langToggle").click()
                    assert slider.get_attribute("aria-valuetext") == str(depth)
                    page.locator("#langToggle").click()
                    assert (
                        page.evaluate("document.documentElement.scrollWidth") <= width
                    )
                assert not errors, errors
            print(
                f"PASS {width}px {language} {scheme}: depth isolation, frontier, counts, downloads, language persistence",
                flush=True,
            )
            context.close()
        browser.close()


if __name__ == "__main__":
    main()
