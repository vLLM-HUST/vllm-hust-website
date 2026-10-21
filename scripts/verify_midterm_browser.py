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
        response = context.request.get(f"{args.url}/data/midterm-v057.json")
        assert response.ok
        raw = response.body()
        report = json.loads(raw)
        assert report["version"] == "V0.57"
        manifest_response = context.request.get(
            f"{args.url}/data/benchmark-source-manifest.json"
        )
        assert manifest_response.ok
        manifest = manifest_response.json()
        entry = next(
            f
            for f in manifest["files"]
            if f["website_path"] == "data/midterm-v057.json"
        )
        assert hashlib.sha256(raw).hexdigest() == entry["sha256"]
        assert len(raw) == entry["bytes"]
        # Validate every destination against one immutable Git tree. Repeated
        # github.com HEAD requests trigger web rate limiting even for valid URLs.
        headers = {"Accept": "application/vnd.github+json"}
        if os.environ.get("GH_TOKEN"):
            headers["Authorization"] = f"Bearer {os.environ['GH_TOKEN']}"
        response = context.request.get(
            "https://api.github.com/repos/vLLM-HUST/vllm-hust-benchmark/"
            f"git/trees/{manifest['commit']}?recursive=1",
            headers=headers,
            timeout=60000,
        )
        assert response.ok, response.status
        tree = response.json()
        assert not tree["truncated"], "Evidence tree must be complete"
        paths = {item["path"]: item["type"] for item in tree["tree"]}
        for section in report["sections"]:
            for evidence in section["evidence"]:
                assert paths.get(evidence["path"]) == evidence["kind"], evidence
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
                    expect(
                        page.locator('script[src*="midterm-report.js"]')
                    ).to_have_attribute(
                        "src", "./assets/midterm-report.js?v=midterm-v057-20261021"
                    )
                    expect(page.locator("#midterm-report")).to_have_attribute(
                        "data-loaded", "V0.57", timeout=30000
                    )
                    page.evaluate("lang => window.vllmHustSite.setLang(lang)", lang)
                    for ident in (
                        "candidates",
                        "quality",
                        "recovered-quality",
                        "long-context",
                        "current-b1-long-context",
                        "long-diagnostic",
                        "resources",
                        "m01",
                        "runtime-recovery",
                        "state-commit",
                        "model-runtime",
                        "preprocess-publication",
                        "projection-references",
                        "logits-collective-reference",
                        "m01-verdict",
                    ):
                        section = page.locator(f"#midterm-{ident}")
                        section.evaluate("el => el.scrollIntoView({block: 'start'})")
                        expect(section).to_be_visible()
                        assert section.locator("h3").evaluate(
                            "e => getComputedStyle(e).color === 'rgb(23, 33, 43)'"
                        )
                        assert section.locator("tbody tr").evaluate_all(
                            "rows => rows.every(row => ![...row.cells].every("
                            "cell => /^:?-+:?$/.test(cell.textContent.trim())))"
                        )
                        assert section.locator("tbody tr").count() > 0
                        links = section.locator("tbody tr a.raw-evidence")
                        assert links.count() > 0
                        assert links.evaluate_all(
                            "(links, commit) => links.every(a => a.href.startsWith("
                            "'https://github.com/vLLM-HUST/vllm-hust-benchmark/') && "
                            "a.href.includes('/' + commit + '/reports/'))",
                            manifest["commit"],
                        )
                        assert section.locator(".midterm-evidence a").count() > 0
                        page.screenshot(
                            path=output / f"{filename}-{width}-{lang}-{ident}.png"
                        )
                    expect(page.locator("#midterm-quality")).to_contain_text("147/200")
                    expect(page.locator("#midterm-quality")).to_contain_text("152/200")
                    recovered_quality = page.locator("#midterm-recovered-quality")
                    expect(recovered_quality.locator("tbody tr")).to_have_count(3)
                    expect(recovered_quality).to_contain_text("147/200")
                    expect(recovered_quality).to_contain_text("149/200")
                    expect(recovered_quality).to_contain_text("原评分器")
                    long_current = page.locator("#midterm-current-b1-long-context")
                    expect(long_current.locator("tbody tr")).to_have_count(6)
                    expect(long_current).to_contain_text("16,457")
                    expect(long_current).to_contain_text("32,843")
                    expect(long_current).to_contain_text("正文严格匹配0/6")
                    expect(long_current).to_contain_text("补充解析6/6")
                    expect(long_current).to_contain_text("不替换原始判分")
                    expect(page.locator("#midterm-resources")).to_contain_text("2.68%")
                    expect(page.locator("#midterm-m01")).to_contain_text("未通过验收")
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
                        "V0.57"
                    )
                    expect(page.locator("#midterm-model-runtime")).to_contain_text(
                        "100.000000%"
                    )
                    expect(page.locator("#midterm-model-runtime")).to_contain_text(
                        "200 / 0"
                    )
                    publication = page.locator("#midterm-preprocess-publication")
                    expect(publication).to_contain_text("64")
                    expect(publication).to_contain_text("560")
                    expect(publication).to_contain_text("完整有效F和M01仍未判定")
                    projections = page.locator("#midterm-projection-references")
                    expect(projections.locator("tbody tr")).to_have_count(10)
                    expect(projections).to_contain_text("6372.136")
                    expect(projections).to_contain_text("5389.571")
                    expect(projections).to_contain_text("图填充运算不冒充有效F")
                    communication = page.locator("#midterm-logits-collective-reference")
                    expect(communication.locator("tbody tr")).to_have_count(2)
                    expect(communication).to_contain_text("17,879,040")
                    verdict = page.locator("#midterm-m01-verdict")
                    expect(verdict.locator("tbody tr")).to_have_count(3)
                    expect(verdict).to_contain_text("不是实测有效算力低于50%")
                    expect(page.locator("#midterm-kv-audit")).to_contain_text(
                        "不能排除"
                    )
                    assert (
                        page.locator(
                            ".current-measurements:not(#midterm-report) table a.raw-evidence"
                        ).count()
                        == 6
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
                    for scheme in ("light", "dark"):
                        page.emulate_media(color_scheme=scheme)
                        recovered = page.locator("#midterm-model-runtime")
                        recovered.scroll_into_view_if_needed()
                        expect(recovered).to_be_visible()
                        expect(recovered).to_contain_text("100.000000%")
                        assert recovered.evaluate(
                            "e => e.getBoundingClientRect().right <= innerWidth + 1"
                        )
                        page.screenshot(
                            path=output
                            / f"{filename}-{width}-{lang}-{scheme}-runtime.png"
                        )
                    print(filename, width, lang, "PASS", flush=True)
                    page.close()
        for filename in ("betterscale.html", "traceloom.html", "serving-plan.html"):
            page = browser.new_page(viewport={"width": 390, "height": 1000})
            page.goto(f"{args.url}/{filename}", wait_until="domcontentloaded")
            expect(page.locator("a.benchmark-publication-link").first).to_be_attached(
                timeout=30000
            )
            assert (
                page.locator("a[data-benchmark-linked]").count()
                == page.locator("a.benchmark-publication-link").count()
            )
            assert page.locator("a.benchmark-publication-link").evaluate_all(
                "(links, commit) => links.every(a => a.href.startsWith("
                "'https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/' + commit + '/'))",
                manifest["commit"],
            )
            print(filename, "canonical source links PASS", flush=True)
            page.close()
        page = browser.new_page()
        page.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
        page.route(
            "**/data/midterm-v057.json",
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
