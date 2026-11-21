"""Check the assembled site's B0/B1 selectors; does not generate measurements."""

import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:8000")
args = parser.parse_args()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width, scheme in ((1366, "light"), (390, "dark")):
        page = browser.new_page(
            viewport={"width": width, "height": 900}, color_scheme=scheme
        )
        page.goto(args.base_url.rstrip("/") + "/b0-b1.html?release=r8")
        page.wait_for_selector("#comparison-baseline-select", timeout=60000)
        baselines = page.locator("#comparison-baseline-select option").evaluate_all(
            "(rows)=>rows.map(row=>row.value)"
        )
        releases = page.locator("#comparison-release-select option").evaluate_all(
            "(rows)=>rows.map(row=>row.value)"
        )
        assert "original018-cann8.5.1" in baselines
        for baseline in baselines:
            page.select_option("#comparison-baseline-select", baseline)
            # Existing formal/development browser suites cover the legacy
            # selector default. This suite covers additional official versions.
            if baseline == "original018-cann8.5.1":
                continue
            for release in releases:
                page.select_option("#comparison-release-select", release)
                page.wait_for_function(
                    '(id)=>document.querySelector("#five-dataset-comparison").dataset.release===id',
                    arg=release,
                )
                assert (
                    page.locator("#comparison-baseline-select").input_value()
                    == baseline
                )
                assert page.locator(".metric-chart").count() == 4
                assert page.locator("#context-tenant-supplement").count() == 1
                if baseline != "original018-cann8.5.1":
                    assert (
                        page.locator(
                            ".metric-change,[data-fixed-b0-compute],[data-fixed-b0-context]"
                        ).count()
                        == 0
                    )
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
        print(
            "PASS",
            width,
            scheme,
            len(baselines),
            "B0 choices,",
            len(releases),
            "B1 choices",
        )
        page.close()
    browser.close()
