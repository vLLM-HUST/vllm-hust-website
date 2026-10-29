"""V1.02 evidence/failure disclosure across languages, viewports and themes."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/acceptance-completion")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    receipts = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--no-sandbox"])
        for width in (390, 1440):
            for language in ("zh", "en"):
                for theme in ("light", "dark"):
                    context = browser.new_context(
                        viewport={"width": width, "height": 1000}, color_scheme=theme
                    )
                    context.add_init_script(
                        "if(location.protocol==='http:'||location.protocol==='https:') "
                        f"localStorage.setItem('vllm-hust_lang','{language}')"
                    )
                    for filename in (
                        "b0-b1.html",
                        "dataset-validation.html",
                        "leaderboard-runs.html",
                    ):
                        page = context.new_page()
                        errors = []
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        response = page.goto(
                            args.url.rstrip("/") + "/" + filename,
                            wait_until="domcontentloaded",
                        )
                        assert response.status == 200
                        if filename == "b0-b1.html":
                            expect(page.locator("#comparison")).to_have_attribute(
                                "data-loaded", "V1.02", timeout=30000
                            )
                            target = page.locator(".comparison-overview")
                            for text in (
                                "19.0819",
                                "37.2302%",
                                "21/200",
                                "19/200",
                                "153 / 73",
                                "66.2253",
                                "35.4849",
                            ):
                                expect(target).to_contain_text(text)
                            expect(target).to_contain_text(
                                "实测失败"
                                if language == "zh"
                                else "configuration failed"
                            )
                            expect(target).to_contain_text(
                                "16K未执行" if language == "zh" else "16K not run"
                            )
                            expect(target).not_to_contain_text("99.9397")
                            assert target.locator("a.focus-source").count() == 0
                            assert target.locator(".focus-source a").count() == 4
                        else:
                            expect(page.locator("#midterm-report")).to_have_attribute(
                                "data-loaded", "V1.02", timeout=30000
                            )
                            page.locator("#report-details > summary").click()
                            target = page.locator("#midterm-acceptance-completion")
                            expect(target).to_be_visible()
                            expect(target.locator("h3")).to_have_text(
                                "当前证据与缺口清单"
                                if language == "zh"
                                else "Current evidence and remaining gaps"
                            )
                            for text in ("19.0819", "37.2302%", "21/200", "19/200"):
                                expect(target).to_contain_text(text)
                            assert target.locator("tbody tr").count() == 3
                            assert target.locator("a.raw-evidence").evaluate_all(
                                "aa=>aa.every(a=>a.href.endsWith('/continuous-summary.json'))"
                            )
                        expect(target).not_to_contain_text("undefined")
                        assert target.locator("a").evaluate_all(
                            r"aa=>aa.filter(a=>a.closest('.focus-source')||a.closest('.midterm-evidence')).every(a=>/^https:\/\/github.com\/vLLM-HUST\/vllm-hust-benchmark\/(blob|tree)\/[a-f0-9]{40}\//.test(a.href))"
                        )
                        assert page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth + 1"
                        )
                        assert not errors, errors
                        target.scroll_into_view_if_needed()
                        page.screenshot(
                            path=str(
                                args.output
                                / f"{filename}-{width}-{language}-{theme}.png"
                            )
                        )
                        receipts.append(
                            dict(
                                page=filename,
                                width=width,
                                language=language,
                                theme=theme,
                                status="PASS",
                            )
                        )
                        (args.output / "receipt.json").write_text(
                            json.dumps(receipts, indent=2) + "\n"
                        )
                        page.close()
                    context.close()
        browser.close()
    print(json.dumps(dict(passed=len(receipts), output=str(args.output))))


if __name__ == "__main__":
    main()
