"""Verify the assembled benchmark publication in real desktop/mobile browsers."""

import argparse
import hashlib
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

SCENARIO = "qwen35-35b-a3b-bf16-tp2-school028-mmlu-inf-out256"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8769")
    args = parser.parse_args()
    output = Path("output/playwright/midterm")
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        )
        context = browser.new_context()
        response = context.request.get(f"{args.url}/data/midterm-v052.json")
        assert response.ok
        raw = response.body()
        report = json.loads(raw)
        assert report["version"] == "V0.52"
        manifest_response = context.request.get(
            f"{args.url}/data/benchmark-source-manifest.json"
        )
        assert manifest_response.ok
        manifest = manifest_response.json()
        entry = next(
            f
            for f in manifest["files"]
            if f["website_path"] == "data/midterm-v052.json"
        )
        assert hashlib.sha256(raw).hexdigest() == entry["sha256"]
        assert len(raw) == entry["bytes"]
        (output / "publication-identity.json").write_text(
            json.dumps(
                {
                    "url": args.url,
                    "benchmark_commit": manifest["commit"],
                    "report_url": report["report_url"],
                    "file": entry,
                },
                indent=2,
            )
            + "\n"
        )
        context.close()
        for width in (390, 1440):
            for lang in ("zh", "en"):
                for filename in ("dataset-validation.html", "leaderboard-runs.html"):
                    page = browser.new_page(viewport={"width": width, "height": 1000})
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(f"{args.url}/{filename}", wait_until="domcontentloaded")
                    expect(page.locator("#midterm-report")).to_have_attribute(
                        "data-loaded", "V0.52", timeout=30000
                    )
                    page.evaluate("lang => window.vllmHustSite.setLang(lang)", lang)
                    for ident in (
                        "candidates",
                        "quality",
                        "long-context",
                        "long-diagnostic",
                        "resources",
                        "m01",
                        "runtime-recovery",
                        "state-commit",
                    ):
                        section = page.locator(f"#midterm-{ident}")
                        section.scroll_into_view_if_needed()
                        expect(section).to_be_visible()
                        assert section.locator("h3").evaluate(
                            "e => getComputedStyle(e).color === 'rgb(23, 33, 43)'"
                        )
                        assert section.locator("tbody tr").evaluate_all(
                            "rows => rows.every(row => ![...row.cells].every("
                            "cell => /^:?-+:?$/.test(cell.textContent.trim())))"
                        )
                        assert section.locator("tbody tr").count() > 0
                        page.screenshot(
                            path=output / f"{filename}-{width}-{lang}-{ident}.png"
                        )
                    expect(page.locator("#midterm-quality")).to_contain_text("147/200")
                    expect(page.locator("#midterm-quality")).to_contain_text("152/200")
                    expect(page.locator("#midterm-resources")).to_contain_text("2.68%")
                    expect(page.locator("#midterm-m01")).to_contain_text("未判定")
                    expect(page.locator("#midterm-runtime-recovery")).to_contain_text(
                        "每卡36项变输入检查通过"
                    )
                    expect(page.locator("#midterm-state-commit")).to_contain_text(
                        "r1/r2导入失败原样保留"
                    )
                    expect(page.locator("#midterm-state-commit")).to_contain_text(
                        "不能排除完整模型跨轮状态污染"
                    )
                    expect(page.locator("#midterm-report > p a")).to_contain_text(
                        "V0.52"
                    )
                    expect(page.locator("#midterm-kv-audit")).to_contain_text(
                        "不能排除"
                    )
                    if filename == "dataset-validation.html":
                        expect(page.locator("#validation-model-select")).to_have_value(
                            SCENARIO
                        )
                        select = page.locator("#validation-model-select")
                        alternative = select.locator("option").first.get_attribute(
                            "value"
                        )
                        select.select_option(alternative)
                        expect(select).to_have_value(alternative)
                        select.select_option(SCENARIO)
                        expect(page.locator("#validation-content")).to_be_visible()
                    assert page.locator("#midterm-report").evaluate(
                        "e => e.getBoundingClientRect().right <= innerWidth + 1"
                    )
                    assert not errors, errors
                    page.locator("#midterm-quality").scroll_into_view_if_needed()
                    page.screenshot(path=output / f"{filename}-{width}-{lang}.png")
                    print(filename, width, lang, "PASS", flush=True)
                    page.close()
        page = browser.new_page()
        page.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
        page.route(
            "**/data/midterm-v052.json",
            lambda route: route.fulfill(status=503, body="unavailable"),
        )
        page.goto(f"{args.url}/dataset-validation.html")
        expect(page.locator("#midterm-report [role=status]")).to_contain_text(
            "unavailable"
        )
        assert page.locator("#midterm-quality").count() == 0
        browser.close()


if __name__ == "__main__":
    main()
