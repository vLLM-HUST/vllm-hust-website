"""Exercise the final public B0/B1 artifact, including fail-closed checks."""

import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def verify(url, output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        )
        context = browser.new_context()
        manifest_response = context.request.get(
            url + "/data/benchmark-source-manifest.json"
        )
        assert manifest_response.ok
        manifest = manifest_response.json()
        assert (
            manifest["projection"]["policy"] == "selected-research-withdrawal-20261030"
        )
        report_response = context.request.get(url + "/data/midterm-v103.json")
        assert report_response.ok
        report_raw = report_response.body()
        report = json.loads(report_raw)
        runs = context.request.get(
            url + "/data/leaderboard_frontier_swe_evidence.json"
        ).json()
        missing = {
            arm["run_id"] for arm in report["c16_equal_request_latency"]["arms"]
        } - {run["run_id"] for run in runs["runs"]}
        results = []
        for language in ("zh", "en"):
            for width in (390, 1440):
                page = context.new_page()
                page.set_viewport_size({"width": width, "height": 1000})
                errors = []
                page.on(
                    "pageerror", lambda error, errors=errors: errors.append(str(error))
                )
                page.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang', '{language}')"
                )
                page.goto(url + "/b0-b1.html#method-2")
                root = page.locator("#comparison")
                expect(root).to_have_attribute("data-loaded", "V1.03", timeout=30000)
                expect(root.locator(".comparison-group")).to_have_count(4)
                expect(root.locator("#method-2")).to_have_attribute("open", "")
                for arm in report["full_answer_joint"]["arms"]:
                    expect(root.locator("#metric-2")).to_contain_text(
                        f"{arm['correct']}/200"
                    )
                if missing:
                    expect(root.locator("#method-2")).to_contain_text(
                        "历史 C16 对照当前未公开。"
                        if language == "zh"
                        else "The historical C16 comparison is not currently published."
                    )
                text = root.inner_text()
                assert "undefined" not in text and "NaN" not in text
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth + 1"
                )
                assert not errors, errors
                page.locator("#metric-1").scroll_into_view_if_needed()
                page.screenshot(
                    path=output / f"comparison-{language}-{width}.png", full_page=True
                )
                # A language change re-renders the already verified publication.
                page.evaluate(
                    "lang => window.vllmHustSite.setLang(lang)",
                    "en" if language == "zh" else "zh",
                )
                expect(root.locator(".comparison-group")).to_have_count(4)
                results.append({"language": language, "width": width, "sections": 4})
                page.close()
        failures = ["modified-data", "unavailable-data"]
        if missing:
            failures += ["missing-unprojected-identity", "unknown-projection"]
        for case in failures:
            page = context.new_page()
            page.add_init_script("localStorage.setItem('vllm-hust_lang', 'zh')")
            if case in ("modified-data", "unavailable-data"):
                page.route(
                    "**/data/midterm-v103.json",
                    lambda route, _request, case=case: route.fulfill(
                        status=503 if case == "unavailable-data" else 200,
                        content_type="application/json",
                        body=b"unavailable"
                        if case == "unavailable-data"
                        else report_raw + b" ",
                    ),
                )
            else:
                altered = dict(manifest)
                if case == "missing-unprojected-identity":
                    altered.pop("projection")
                else:
                    altered["projection"] = {"policy": "unknown", "revision": "a" * 40}
                page.route(
                    "**/data/benchmark-source-manifest.json",
                    lambda route, _request, altered=altered: route.fulfill(
                        json=altered
                    ),
                )
            page.goto(url + "/b0-b1.html")
            expect(page.locator("#comparison")).to_contain_text(
                "结果加载失败", timeout=30000
            )
            expect(page.locator(".comparison-group")).to_have_count(0)
            page.close()
        browser.close()
    receipt = {
        "url": url,
        "commit": manifest["commit"],
        "projection": manifest["projection"],
        "checks": results,
        "rejected_cases": failures,
        "missing_historical_runs": sorted(missing),
    }
    (output / "receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("PASS: public comparison, 4 language/viewport cases and fail-closed checks")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, default=Path("output/public-comparison"))
    args = parser.parse_args()
    verify(args.url.rstrip("/"), args.output)
