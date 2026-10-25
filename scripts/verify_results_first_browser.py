"""Results-first layout: eight language/viewport/theme variants on both pages."""

import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8783")
    args = parser.parse_args()
    output = Path("output/playwright/midterm/results-first")
    output.mkdir(parents=True, exist_ok=True)
    receipts = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        )
        for width in (390, 1440):
            for lang in ("zh", "en"):
                for scheme in ("light", "dark"):
                    for filename in (
                        "dataset-validation.html",
                        "leaderboard-runs.html",
                    ):
                        context = browser.new_context(
                            viewport={"width": width, "height": 1000},
                            color_scheme=scheme,
                        )
                        context.add_init_script(
                            "if (location.protocol === 'http:' || location.protocol === 'https:') "
                            f"localStorage.setItem('vllm-hust_lang', '{lang}')"
                        )
                        page = context.new_page()
                        errors = []
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        page.goto(f"{args.url}/{filename}", wait_until="networkidle")
                        expect(page.locator("#current-workload")).to_have_attribute(
                            "data-loaded", "true"
                        )
                        expect(page.locator("#midterm-report")).to_have_attribute(
                            "data-loaded", "V0.80"
                        )
                        assert not page.locator("#report-details").evaluate(
                            "e => e.open"
                        )
                        assert not page.locator("#current-configuration").evaluate(
                            "e => e.open"
                        )
                        expect(page.locator(".result-date")).to_have_text("V0.80")
                        source = page.evaluate(
                            "async () => (await fetch('./data/dataset_validation_qwen35_mmlu_school028_inf_out256.json')).json()"
                        )
                        for metric in source["results"]:
                            card = page.locator(
                                f'[data-metric="{metric["metric_id"]}"]'
                            )
                            expect(card).to_be_visible()
                            for value in (metric["value"],):
                                formatted = page.evaluate(
                                    "v => v.toLocaleString('en-US', {maximumFractionDigits:2})",
                                    value,
                                )
                                expect(card).to_contain_text(formatted)
                            assert card.locator("a.raw-evidence").count() == 1
                            expect(
                                card.locator(".result-pair strong")
                            ).not_to_have_text("—")
                            expect(card.locator(".result-pair")).to_contain_text("B1")
                            expect(card.locator(".result-pair")).not_to_contain_text(
                                "B0"
                            )
                            assert card.locator("a").evaluate_all(
                                "aa => aa.every(a => /^https:\\/\\/github.com\\/vLLM-HUST\\/vllm-hust-benchmark\\/(blob|tree)\\/[a-f0-9]{40}\\//.test(a.href))"
                            )
                        expect(page.locator(".result-boundary")).to_contain_text(
                            "vLLM 0.18 / vLLM-Ascend 0.18"
                        )
                        expect(page.locator(".result-boundary")).to_contain_text(
                            "0.25.1rc2"
                        )
                        expect(page.locator(".result-comparison-note")).to_contain_text(
                            "不计算收益" if lang == "zh" else "gain not calculated"
                        )
                        expect(page.locator(".result-quality")).to_contain_text(
                            "151/200"
                        )
                        expect(page.locator(".result-quality")).to_contain_text(
                            "156/200"
                        )
                        assert page.locator(".result-quality").evaluate(
                            "e => e.getBoundingClientRect().bottom < innerHeight"
                        ), "B0/B1 must be on the first screen"
                        assert page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth + 1"
                        )
                        assert page.locator("#current-workload").evaluate(
                            "(e, dark) => getComputedStyle(e).backgroundColor === "
                            "(dark ? 'rgb(20, 33, 44)' : 'rgb(255, 255, 255)')",
                            scheme == "dark",
                        )
                        name = f"{filename}-{width}-{lang}-{scheme}"
                        page.screenshot(path=output / f"{name}.png")
                        # Real keyboard disclosure, with state retained on translation.
                        summary = page.locator("#current-configuration > summary")
                        summary.focus()
                        summary.press("Enter")
                        expect(
                            page.locator("#current-configuration table")
                        ).to_be_visible()
                        page.locator("#langToggle").click()
                        expect(
                            page.locator("#current-configuration table")
                        ).to_be_visible()
                        page.locator("#langToggle").click()
                        page.locator('a[href="#midterm-kv-audit"]').first.click()
                        expect(page.locator("#midterm-kv-audit")).to_be_visible()
                        assert page.locator("#report-details").evaluate("e => e.open")
                        page.locator('a[href="#midterm-v15-remaining"]').first.click()
                        review = page.locator("#midterm-v15-remaining")
                        expect(review).to_be_visible()
                        expect(review).to_contain_text("22.601951%")
                        expect(review).to_contain_text("TerminalBench 2.1")
                        expect(review).to_contain_text(
                            "利用率却未提高"
                            if lang == "zh"
                            else "utilization does not improve"
                        )
                        assert review.locator("table").count() == 3
                        assert review.locator("a.raw-evidence").count() > 20
                        assert page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth + 1"
                        )
                        page.screenshot(path=output / f"{name}-evidence.png")
                        # Fresh deep link must reveal asynchronous sections, too.
                        page.goto("about:blank")
                        if filename == "leaderboard-runs.html":
                            # Force curves to load before the report: this exposed
                            # the production-only hash overwrite race.
                            def delayed_report(route):
                                expect(
                                    page.locator("#frontier-status")
                                ).to_have_attribute(
                                    "data-state", "ready", timeout=30000
                                )
                                assert (
                                    page.evaluate("location.hash")
                                    == "#midterm-m01-verdict"
                                )
                                route.continue_()

                            page.route("**/data/midterm-v080.json", delayed_report)
                        page.goto(f"{args.url}/{filename}#midterm-m01-verdict")
                        expect(page.locator("#midterm-m01-verdict")).to_be_visible()
                        verdict = page.locator("#midterm-m01-verdict")
                        expect(verdict).to_contain_text("84.9705%")
                        expect(verdict).to_contain_text(
                            "C提升不是参考达成率"
                            if lang == "zh"
                            else "Compute gain is not reference attainment"
                        )
                        expect(verdict).to_contain_text("7.1042")
                        expect(verdict).to_contain_text("1812905151088034")
                        expect(verdict).not_to_contain_text("30.2443")
                        expect(page.locator("#midterm-m01-historical")).to_contain_text(
                            "30.2443%–30.2505%"
                        )
                        assert not errors, errors
                        receipts.append(
                            {
                                "page": filename,
                                "width": width,
                                "language": lang,
                                "theme": scheme,
                                "status": "passed",
                            }
                        )
                        print(name, "PASS", flush=True)
                        context.close()
        for filename in ("dataset-validation.html", "leaderboard-runs.html"):
            page = browser.new_page(viewport={"width": 320, "height": 1000})
            page.goto(f"{args.url}/{filename}", wait_until="networkidle")
            expect(page.locator("#current-workload")).to_have_attribute(
                "data-loaded", "true"
            )
            assert page.evaluate(
                "document.documentElement.scrollWidth <= innerWidth + 1"
            )
            assert page.locator(".result-pair a").evaluate_all(
                "aa => aa.every(a => a.getBoundingClientRect().right <= innerWidth)"
            )
            page.screenshot(path=output / f"{filename}-320.png")
            page.close()
        browser.close()
    (output / "receipt.json").write_text(json.dumps(receipts, indent=2) + "\n")


if __name__ == "__main__":
    main()
