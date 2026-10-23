"""Exercise the dataset matrix with the real bundled reports, EN/ZH and mobile."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8786")
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/dataset-matrix")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, lang, scheme in [
            (1440, "zh", "light"),
            (390, "en", "dark"),
            (320, "zh", "light"),
        ]:
            context = browser.new_context(
                viewport={"width": width, "height": 1000}, color_scheme=scheme
            )
            context.add_init_script(f"localStorage.setItem('vllm-hust_lang', '{lang}')")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error, errors=errors: errors.append(str(error)))
            page.goto(args.url + "/dataset-validation.html")
            page.locator(".matrix-overview").wait_for()
            expect(page.locator(".matrix-overview tbody tr")).to_have_count(7)
            expect(page.locator("#matrix-table table")).to_have_count(1)
            assert "+91.7%" in page.locator(".matrix-overview").inner_text()
            system_row = page.locator(".matrix-overview tbody tr").filter(
                has=page.locator('a[href="#swe-bench-pro"]')
            )
            assert "+40.8%" in system_row.inner_text()
            assert "213.32" not in system_row.inner_text()
            assert "1.408" not in system_row.inner_text()
            assert ("基线" if lang == "zh" else "Baseline") in system_row.inner_text()
            assert "79.70%" in page.locator(".matrix-overview").inner_text()
            expect(
                page.locator(".matrix-profile-section, .matrix-replay-section")
            ).to_have_count(0)
            for value in [
                "57.00%",
                "58.00%",
                "8.33%",
                "6.67%",
                "23.80%",
                "79.78%",
                "26.95%",
            ]:
                assert value in page.locator(".matrix-overview").inner_text()
            snapshot = page.request.get(
                args.url + "/data/dataset-matrix-v1.json"
            ).json()
            cells = [
                (part, solution["id"])
                for dataset in snapshot["datasets"]
                for part in dataset["parts"]
                for solution in snapshot["solutions"]
            ]
            statuses = sum(
                sid not in part["scores"] and sid in part.get("statuses", {})
                for part, sid in cells
            )
            missing = sum(
                sid not in part["scores"] and sid not in part.get("statuses", {})
                for part, sid in cells
            )
            expect(page.locator(".matrix-missing")).to_have_count(missing)
            expect(page.locator(".matrix-status")).to_have_count(statuses)
            expect(
                page.locator(
                    '[data-nav-group="performance"] a[href="./dataset-validation.html"]'
                )
            ).to_have_count(1)
            page.screenshot(
                path=str(args.output / f"overview-{width}-{lang}.png"), full_page=True
            )
            page.locator('[data-sort="betterscale"]').click()
            assert "25.90%" in page.locator(".matrix-overview").inner_text()
            assert "27.65%" in page.locator(".matrix-overview").inner_text()
            page.locator('.matrix-dataset[href="#mmlu-pro"]').click()
            expect(page.locator(".matrix-detail .run-row")).to_have_count(6)
            assert "631.59" in page.locator(".matrix-detail").inner_text()
            for value in ["360.53", "337.20", "2026-10-18"]:
                assert value in page.locator(".matrix-detail").inner_text()
            page.locator('[data-sort="throughput"]').click()
            page.locator('[data-sort="throughput"]').click()
            assert (
                "BetterScale"
                in page.locator(".matrix-detail .run-row").first.inner_text()
            )
            toggle = page.locator('[data-expand="mmlu-pro-betterscale-test-200"]')
            toggle.click()
            assert page.locator("#evidence-mmlu-pro-betterscale-test-200").is_visible()
            with page.expect_download() as download:
                page.locator('[data-download="mmlu-pro-betterscale-test-200"]').click()
            saved = args.output / "download.json"
            download.value.save_as(saved)
            assert (
                json.loads(saved.read_text())["record"]["performance"][
                    "output_throughput"
                ]
                == 631.588934632666
            )
            toggle.click()
            page.locator('[data-solution="native"]').uncheck()
            expect(page.locator(".matrix-detail .run-row")).to_have_count(4)
            page.locator("#langToggle").click()
            expect(page.locator(".matrix-detail .run-row")).to_have_count(4)
            page.locator("#matrix-reset").click()
            expect(page.locator(".matrix-detail .run-row")).to_have_count(6)
            page.screenshot(
                path=str(args.output / f"detail-{width}-{lang}.png"), full_page=True
            )
            page.locator("#matrix-breadcrumb a").click()
            assert (
                page.locator('[data-sort="betterscale"]')
                .locator("..")
                .locator("..")
                .get_attribute("aria-sort")
                == "ascending"
            )
            page.locator('.matrix-dataset[href="#frontierscience"]').first.click()
            expect(page.locator(".matrix-detail .run-row")).to_have_count(5)
            assert "906.25" in page.locator(".matrix-detail").inner_text()
            page.go_back()
            page.locator(".matrix-overview").wait_for()
            page.locator('.matrix-dataset[href="#hle-verified"]').first.click()
            expect(page.locator(".matrix-detail .run-row")).to_have_count(18)
            page.locator('[data-solution="native"]').uncheck()
            expect(page.locator(".matrix-detail .run-row")).to_have_count(10)
            assert "875.67" in page.locator(".matrix-detail").inner_text()
            assert "466.19" in page.locator(".matrix-detail").inner_text()
            for value in ["327.04", "277.11", "368.90", "294.30", "2026-10-18"]:
                assert value in page.locator(".matrix-detail").inner_text()
            page.locator(
                '[data-expand="hle-gold-controller-20261018-request-throttling-controller-text"]'
            ).click()
            page.locator(
                '[data-expand="hle-revision-controller-20261018-request-throttling-controller-text"]'
            ).click()
            expect(page.locator(".matrix-detail thead th")).to_have_count(7)

            page.screenshot(
                path=str(args.output / f"hle-{width}-{lang}.png"), full_page=True
            )
            page.reload()
            page.locator(".matrix-detail").wait_for()
            expect(page.locator(".matrix-detail .run-row")).to_have_count(18)
            # The consolidated page also contains closed supplementary sections.
            # Keep the active wide matrix inside its own keyboard-scrollable region
            # instead of treating hidden content width as viewport overflow.
            assert page.locator(".runs-table-scroll").first.evaluate(
                "el => getComputedStyle(el).overflowX === 'auto'"
            )
            assert (
                page.locator(".runs-table-scroll").first.get_attribute("tabindex")
                == "0"
            )
            page.goto(
                args.url
                + "/dataset-validation.html#swe-smith-tranjactory-offline-window"
            )
            page.locator(
                '[data-expand="offline-window-request-throttling-controller-short-20261017-r18-on"]'
            ).wait_for()
            expect(
                page.locator(".matrix-detail tbody > tr:not(.run-detail)")
            ).to_have_count(8)
            assert "30.28" in page.locator(".matrix-detail").inner_text()
            notes = " ".join(
                page.locator("#matrix-table > p.runs-note").all_text_contents()
            )
            assert "512MiB" in notes and "+91.7%" in notes
            assert "seed" not in page.locator(".matrix-detail").inner_text()
            expect(page.locator(".matrix-detail thead th")).to_have_count(7)
            page.locator(
                '[data-expand="offline-window-request-throttling-controller-short-20261017-r18-on"]'
            ).click()
            assert page.locator(
                "#evidence-offline-window-request-throttling-controller-short-20261017-r18-on"
            ).is_visible()
            page.screenshot(
                path=str(args.output / f"offline-window-{width}-{lang}.png"),
                full_page=True,
            )
            assert page.evaluate(
                "document.documentElement.scrollWidth <= innerWidth + 1"
            )
            page.goto(
                args.url
                + "/dataset-validation.html#frontierscience-controller-20261018"
            )
            expect(page.locator(".matrix-detail .run-row")).to_have_count(5)
            for value in ["474.13", "432.14", "58.00%", "6.67%", "2026-10-18"]:
                assert value in page.locator(".matrix-detail").inner_text()
            toggle = page.locator(
                '[data-expand="frontierscience-controller-20261018-request-throttling-controller"]'
            )
            toggle.click()
            assert page.locator(
                "#evidence-frontierscience-controller-20261018-request-throttling-controller"
            ).is_visible()
            assert "0.23.0" in page.locator(".run-detail:not([hidden])").inner_text()
            toggle.click()
            page.locator(".runs-table-scroll").evaluate("e => e.scrollLeft = 0")
            page.screenshot(
                path=str(args.output / f"controller-frontier-{width}-{lang}.png"),
                full_page=True,
            )
            assert page.evaluate(
                "document.documentElement.scrollWidth <= innerWidth + 1"
            )
            page.goto(args.url + "/dataset-validation.html#swe-bench-pro")
            expect(page.locator(".matrix-detail .run-row")).to_have_count(2)
            expect(page.locator(".matrix-detail thead th")).to_have_count(7)
            for value in [
                "151.45",
                "213.32",
                "411.27",
                "963.34",
            ]:
                assert value in page.locator("#matrix-table").inner_text()
            assert "P95 / P99" in page.locator("#matrix-table").inner_text()
            assert "ThunderAgent" not in page.locator("#matrix-table").inner_text()
            expect(page.locator("#matrix-table a")).to_have_count(2)
            page.screenshot(
                path=str(args.output / f"real-agent-{width}-{lang}.png"), full_page=True
            )
            assert page.evaluate(
                "document.documentElement.scrollWidth <= innerWidth + 1"
            )
            assert not errors, errors
            context.close()
        browser.close()
    print(
        "Dataset matrix: desktop/mobile, EN/ZH, sorting, navigation, filters, evidence and downloads passed"
    )


if __name__ == "__main__":
    main()
