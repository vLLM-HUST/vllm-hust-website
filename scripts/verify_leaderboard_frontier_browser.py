#!/usr/bin/env python3
"""Verify fixed Frontier charts, compact point popovers and config downloads."""

import argparse
import copy
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def ready(page):
    page.locator("#frontier-panel").wait_for(state="visible")
    page.wait_for_function(
        "document.querySelector('#frontier-status').dataset.state === 'ready'"
    )


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
    production = json.loads((site / "data/leaderboard_frontier.json").read_text())
    fixture = json.loads(
        (site / "tests/fixtures/leaderboard_frontier.json").read_text()
    )
    empty = {"schema_version": "leaderboard-frontier/v1", "cohorts": [], "points": []}
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
            # A stale unversioned URL must not hide published points.
            page.route(
                "**/data/leaderboard_frontier.json", lambda r: r.fulfill(json=empty)
            )
            errors = []
            page.on("pageerror", lambda error, errors=errors: errors.append(str(error)))
            page.goto(
                f"{args.url}/leaderboard-runs.html#frontier",
                wait_until="domcontentloaded",
            )
            ready(page)
            assert page.locator("#runs-panel").is_hidden()
            assert page.locator("#tasks-panel").is_hidden()
            assert page.locator("#frontier-panel select").count() == 1
            assert (
                page.locator(
                    "#frontier-panel table, #frontier-panel pre, #frontier-panel details"
                ).count()
                == 0
            )
            for removed in [
                "frontier-x",
                "frontier-y",
                "frontier-mod",
                "frontier-hardware",
                "frontier-context",
                "frontier-precision",
                "frontier-detail",
            ]:
                assert page.locator(f"#{removed}").count() == 0
            assert page.locator(".frontier-model-tag").count() == 1
            assert "Qwen3.5-35B-A3B" in page.locator(".frontier-model-tag").inner_text()
            assert "BF16" in page.locator(".frontier-model-tag").inner_text()
            assert page.locator("#frontier-workload").is_disabled()
            assert "smoke" in page.locator("#frontier-status").inner_text()
            assert page.locator(".frontier-point").count() == len(production["points"])
            assert page.locator("#frontier-popover").is_hidden()
            for point in production["points"]:
                dot = page.locator(f'[data-point="{point["id"]}"]')
                dot.click()
                popup = page.locator("#frontier-popover")
                assert popup.is_visible()
                text = popup.inner_text()
                for metric in [
                    point["metrics"]["decode_p90_tps"],
                    point["metrics"]["output_tps"] / 2,
                ]:
                    assert f"{metric:.2f}".rstrip("0").rstrip(".") in text
                assert "TP2" in text and "MTP2" in text
                assert popup.locator("pre").count() == 0
                box, plot = (
                    popup.bounding_box(),
                    page.locator("#frontier-plot").bounding_box(),
                )
                assert (
                    box["x"] >= plot["x"]
                    and box["x"] + box["width"] <= plot["x"] + plot["width"]
                )
                assert (
                    box["y"] >= plot["y"]
                    and box["y"] + box["height"] <= plot["y"] + plot["height"]
                )
                with page.expect_download() as download:
                    popup.locator("[data-download]").click()
                file = args.output / f"{width}-{language}-{point['id']}.json"
                download.value.save_as(file)
                payload = json.loads(file.read_text())
                assert payload["point"] == point
                assert payload["cohort"] == production["cohorts"][0]
                assert payload["chart"]["x"] == "decode_p90_tps"
                assert payload["chart"]["y"] == "output_tps_per_chip"
                popup.locator("[data-close]").click()
                assert popup.is_hidden()
            dot.focus()
            page.keyboard.press("Enter")
            assert page.locator("#frontier-popover").is_visible()
            page.screenshot(
                path=str(args.output / f"popover-{width}-{language}-{scheme}.png"),
                full_page=True,
            )
            page.keyboard.press("Escape")
            assert page.locator("#frontier-popover").is_hidden()
            assert dot.evaluate("node => node === document.activeElement")
            dot.click()
            page.locator(".frontier-heading h1").click()
            assert page.locator("#frontier-popover").is_hidden()
            page.locator("#view-runs").click()
            page.locator(".run-row").first.wait_for()
            page.locator("#view-tasks").click()
            assert page.locator("#tasks-panel").is_visible()
            page.locator("#view-frontier").click()
            assert page.locator("table:visible").count() == 0
            page.locator("#langToggle").click()
            assert page.locator(".frontier-point").count() == 2
            assert page.evaluate(
                "document.documentElement.scrollWidth <= window.innerWidth + 1"
            )
            page.locator("#langToggle").click()
            page.screenshot(
                path=str(args.output / f"production-{width}-{language}-{scheme}.png"),
                full_page=True,
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

        # Same model with different precision stays in separate tags; workload/context is one contract.
        fixture = copy.deepcopy(fixture)
        c = copy.deepcopy(fixture["cohorts"][0])
        c["id"] = "test-other-precision"
        c["precision"] = {"id": "test-fp8", "label": "FP8"}
        fixture["cohorts"].append(c)
        c = copy.deepcopy(fixture["cohorts"][0])
        c["id"] = "test-other-workload"
        c["workload"]["id"] = "test-other-workload"
        c["workload"]["label"] = "Another workload"
        fixture["cohorts"].append(c)
        context = browser.new_context()
        page = context.new_page()
        page.route(
            "**/data/leaderboard_frontier.json*", lambda r: r.fulfill(json=fixture)
        )
        page.goto(f"{args.url}/leaderboard-runs.html#frontier")
        ready(page)
        assert page.locator(".frontier-model-tag").count() == 2
        assert page.locator("#frontier-workload option").count() == 2
        assert page.locator(".frontier-point").count() == 4
        assert page.locator(".frontier-envelope").count() == 1
        page.locator("#frontier-workload").select_option("test-other-workload")
        assert page.locator(".frontier-point").count() == 0
        page.locator(".frontier-model-tag").nth(1).click()
        assert page.locator("#frontier-workload option").count() == 1
        assert page.locator(".frontier-point").count() == 0
        page.unroute("**/data/leaderboard_frontier.json*")
        page.route(
            "**/data/leaderboard_frontier.json*", lambda r: r.fulfill(json=empty)
        )
        page.reload()
        ready(page)
        assert page.locator(".frontier-model-tag, .frontier-point").count() == 0
        assert page.locator("#frontier-blank").is_visible()
        page.unroute("**/data/leaderboard_frontier.json*")
        page.route(
            "**/data/leaderboard_frontier.json*",
            lambda r: r.fulfill(json={"invalid": True}),
        )
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function(
            "document.querySelector('#frontier-status').dataset.state === 'error'"
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
