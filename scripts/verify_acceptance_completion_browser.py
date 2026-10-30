"""Same-run current results and retained failures in all presentation variants."""

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
        request = pw.request.new_context()
        response = request.get(args.url.rstrip("/") + "/data/midterm-v103.json")
        assert response.ok
        report = response.json()
        assert report["version"] == "V1.03"
        a, b = report["full_answer_joint"]["arms"]
        request.dispose()
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
                                "data-loaded", "V1.03", timeout=30000
                            )
                            target = page.locator(".comparison-overview")
                            for text in (
                                "19.0819",
                                "37.2302%",
                                f"{a['correct']}/200",
                                f"{b['correct']}/200",
                                "153 / 73",
                                "408 / 183",
                                f"{a['cost']['cny_per_million_output_tokens']:.4f}",
                                f"{b['cost']['cny_per_million_output_tokens']:.4f}",
                            ):
                                expect(target).to_contain_text(text)
                            expect(target).to_contain_text(
                                "两臂窗口完成"
                                if language == "zh"
                                else "Both arms completed"
                            )
                            expect(target).not_to_contain_text(
                                "16K未执行" if language == "zh" else "16K not run"
                            )
                            expect(target).not_to_contain_text("99.9397")
                            assert target.locator("a.focus-source").count() == 0
                            assert target.locator(".focus-source a").count() == 4
                        else:
                            expect(page.locator("#midterm-report")).to_have_attribute(
                                "data-loaded", "V1.03", timeout=30000
                            )
                            page.locator("#report-details > summary").click()
                            target = page.locator("#midterm-full-answer-joint")
                            expect(target).to_be_visible()
                            expect(target.locator("h3")).to_have_text(
                                "完整回答联合补测"
                                if language == "zh"
                                else "Full-answer joint measurement"
                            )
                            for text in (
                                f"{a['correct']}/200",
                                f"{b['correct']}/200",
                                "408",
                                "183",
                            ):
                                expect(target).to_contain_text(text)
                            assert target.locator("tbody tr").count() == 10
                            assert target.locator("a.raw-evidence").evaluate_all(
                                r"aa=>aa.every(a=>/\/(joint|continuous)-summary.json$/.test(a.href))"
                            )
                            retained = page.locator("#midterm-acceptance-completion")
                            for text in ("19.0819", "37.2302%", "21/200", "19/200"):
                                expect(retained).to_contain_text(text)
                            expect(retained).to_contain_text("16K")
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
