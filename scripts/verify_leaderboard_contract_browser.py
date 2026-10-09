#!/usr/bin/env python3
"""Verify the setting-contract dialog against the production snapshot."""

import argparse
import json
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
    data = json.loads(Path("data/leaderboard_frontier.json").read_text())
    cohort = next(item for item in data["cohorts"] if item["id"] == SETTING)
    default_groups = set(cohort["workload"]["contract"]["default_groups"])

    def group_key(point):
        return (
            point.get("study_group", {}).get("id")
            or point["load"].get("presentation_group", {}).get("id")
            or point["configuration"].get("experiment_group")
            or "+".join(sorted(point["configuration"]["mods"]))
            or "none"
        )

    displayed_series = set(cohort["workload"]["contract"]["display_series_ids"])
    default_points = [
        point
        for point in data["points"]
        if point["cohort_id"] == SETTING
        and point["load"].get("concurrency_series") in displayed_series
        and group_key(point) in default_groups
    ]
    expected_identities = {
        cohort["model"]["revision"],
        cohort["workload"]["contract"]["prepared_workload_sha256"],
        cohort["workload"]["contract"]["tokenizer_fingerprint"],
        *(
            point["evidence"]["benchmark_protocol"].get(key)
            for point in default_points
            for key in ("prepared_workload_sha256", "tokenizer_fingerprint")
        ),
    } - {None}

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
                page.goto(
                    f"{args.url}/leaderboard-runs.html?setting={SETTING}#settings"
                )
                page.wait_for_function(
                    "document.querySelector('#frontier-status')?.dataset.state === 'ready'"
                )
                page.locator("#frontier-contract-open").click()
                dialog = page.locator("#frontier-contract-dialog")
                dialog.wait_for(state="visible")
                assert dialog.get_attribute("open") == ""
                text = dialog.text_content()
                for identity in expected_identities:
                    assert identity in text
                for identity in ("swe-prefix-reuse/v1", "FULL_AND_PIECEWISE", "APC"):
                    assert identity in text
                assert re.search(r"TP2 / PP1 / DP1 / EP", text)
                assert "900" in text
                assert dialog.locator("tbody tr").count() == len(default_groups)
                box = dialog.bounding_box()
                assert box["x"] >= 0 and box["y"] >= 0
                assert box["x"] + box["width"] <= width + 1
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth"
                )
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
