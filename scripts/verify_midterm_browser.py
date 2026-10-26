"""Verify the assembled benchmark publication in real desktop/mobile browsers."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import quote

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
        response = context.request.get(f"{args.url}/data/midterm-v085.json")
        assert response.ok
        raw = response.body()
        report = json.loads(raw)
        assert report["version"] == "V0.85"
        manifest_response = context.request.get(
            f"{args.url}/data/benchmark-source-manifest.json"
        )
        assert manifest_response.ok
        manifest = manifest_response.json()
        entry = next(
            f
            for f in manifest["files"]
            if f["website_path"] == "data/midterm-v085.json"
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
                        "src",
                        "./assets/midterm-report.js?v=midterm-v085-quality-20261026",
                    )
                    expect(page.locator("#midterm-report")).to_have_attribute(
                        "data-loaded", "V0.85", timeout=30000
                    )
                    page.evaluate("lang => window.vllmHustSite.setLang(lang)", lang)
                    page.locator("#report-details > summary").click()
                    latency = page.locator("#midterm-c16-request-latency")
                    expect(latency.locator("tbody tr")).to_have_count(6)
                    for value in (
                        "1.685444191",
                        "0.365011074",
                        "0.071246185",
                        "0.017941781",
                    ):
                        expect(
                            latency.get_by_role("cell", name=value, exact=True)
                        ).to_have_count(1)
                    if filename == "dataset-validation.html":
                        page.locator("#dataset-background > summary").click()
                        page.locator("#supplementary-results > summary").click()
                        mmlu = page.locator("#dataset-program-list article").first
                        expect(mmlu).to_contain_text(
                            "子集质量已实测"
                            if lang == "zh"
                            else "Subset quality measured"
                        )
                        for value in ("147/200", "146/200", "19/22"):
                            expect(mmlu).to_contain_text(value)
                        expect(
                            mmlu.locator('a[href="#midterm-native-paired-quality"]')
                        ).to_have_count(1)
                    for ident in (
                        "c16-request-latency",
                        "milestone-v15",
                        "v15-remaining",
                        "dataset-quality-inventory",
                        "reference-closure",
                        "worker-model",
                        "fenced-model",
                        "trace-qualification",
                        "long-context-parser",
                        "paired-lifecycle",
                        "candidates",
                        "quality",
                        "recovered-quality",
                        "native-paired-quality",
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
                            "e => getComputedStyle(e).color === "
                            "getComputedStyle(e.closest('.current-measurements')).color"
                        )
                        assert section.locator("tbody tr").evaluate_all(
                            "rows => rows.every(row => ![...row.cells].every("
                            "cell => /^:?-+:?$/.test(cell.textContent.trim())))"
                        )
                        assert section.locator("tbody tr").count() > 0
                        links = section.locator("tbody tr a.raw-evidence")
                        assert links.count() > 0
                        evidence = next(
                            item["evidence"]
                            for item in report["sections"]
                            if item["id"] == ident
                        )
                        if ident == "v15-remaining":
                            inventory = next(
                                item["evidence"]
                                for item in report["sections"]
                                if item["id"] == "dataset-quality-inventory"
                            )
                            evidence = evidence + [inventory[i] for i in (11, 0, 9)]
                            for row, path in (
                                (0, inventory[11]["path"]),
                                (
                                    1,
                                    "reports/hle-native018-completed-20261026/b0-completed-audit.json",
                                ),
                                (
                                    2,
                                    "reports/swe-native018-single-agent-20261026/summary.json",
                                ),
                                (3, inventory[9]["path"]),
                            ):
                                href = (
                                    section.locator("table")
                                    .first.locator("tbody tr")
                                    .nth(row)
                                    .locator("a")
                                    .first.get_attribute("href")
                                )
                                assert href.endswith(quote(path)), (row, href, path)
                        if ident == "m01-verdict":
                            for table_index in range(section.locator("table").count()):
                                suffix = "wholechain-reference-20261025/summary.json"
                                table_links = (
                                    section.locator("table")
                                    .nth(table_index)
                                    .locator("a.raw-evidence")
                                )
                                assert table_links.count() > 0
                                assert table_links.evaluate_all(
                                    "(links, suffix) => links.every(a => a.href.endsWith(suffix))",
                                    suffix,
                                )
                        allowed_links = [
                            "https://github.com/vLLM-HUST/vllm-hust-benchmark/"
                            f"{item['kind']}/{manifest['commit']}/{quote(item['path'])}"
                            for item in evidence
                        ]
                        assert links.evaluate_all(
                            "(links, allowed) => links.every(a => allowed.includes(a.href))",
                            allowed_links,
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
                    trace_qualification = page.locator("#midterm-trace-qualification")
                    worker = page.locator("#midterm-worker-model")
                    closure = page.locator("#midterm-reference-closure")
                    for value in ("3.6%", "请求窗口核算见M01本轮判定", "40.288556"):
                        expect(closure).to_contain_text(value)
                    assert closure.locator(".midterm-evidence a").count() > 0
                    expect(worker.locator("tbody tr")).to_have_count(6)
                    for value in (
                        "200成功",
                        "3245470",
                        "3246373",
                        "75种",
                        "264",
                        "不替换正式B1",
                    ):
                        expect(worker).to_contain_text(value)
                    fenced = page.locator("#midterm-fenced-model")
                    expect(fenced.locator("tbody tr")).to_have_count(6)
                    for value in (
                        "125.031105",
                        "175.853432",
                        "完整采集未通过",
                        "exit 130",
                        "M01未通过本轮验收",
                    ):
                        expect(fenced).to_contain_text(value)
                    expect(trace_qualification.locator("tbody tr")).to_have_count(6)
                    expect(trace_qualification).to_contain_text("16条已知探针依赖通过")
                    expect(trace_qualification).to_contain_text("M01仍未通过本轮验收")
                    expect(trace_qualification).to_contain_text("非35B模型性能复测")
                    parser_confirmation = page.locator("#midterm-long-context-parser")
                    expect(parser_confirmation.locator("tbody tr")).to_have_count(6)
                    for value in (
                        "正文严格匹配6/6"
                        if lang == "zh"
                        else "not five-task continuous stability acceptance",
                        "原0/6记录保留" if lang == "zh" else "Original scores",
                        "16,457",
                        "32,843",
                        "已分离",
                    ):
                        expect(parser_confirmation).to_contain_text(value)
                    paired = page.locator("#midterm-paired-lifecycle")
                    expect(paired.locator("tbody tr")).to_have_count(10)
                    for value in (
                        "477.258648",
                        "616.624727",
                        "+29.20%",
                        "+57.13%",
                        "+121.48%",
                    ):
                        expect(paired).to_contain_text(value)
                    expect(paired).to_contain_text(
                        "文件页缓存未全局清空"
                        if lang == "zh"
                        else "not the fixed 0.18 B0"
                    )
                    native_quality = page.locator("#midterm-native-paired-quality")
                    expect(native_quality.locator("tbody tr")).to_have_count(2)
                    expect(native_quality).to_contain_text("147/200")
                    expect(native_quality).to_contain_text("146/200")
                    expect(native_quality).to_contain_text("不宣称全集质量或统计非劣性")
                    long_current = page.locator("#midterm-current-b1-long-context")
                    expect(long_current.locator("tbody tr")).to_have_count(6)
                    expect(long_current).to_contain_text("16,457")
                    expect(long_current).to_contain_text("32,843")
                    if lang == "zh":
                        expect(long_current).to_contain_text("正文严格匹配0/6")
                        expect(long_current).to_contain_text("补充解析6/6")
                        expect(long_current).to_contain_text("不替换原始判分")
                    else:
                        expect(long_current).to_contain_text(
                            "not five-task continuous stability acceptance"
                        )
                    current_method = page.locator("#midterm-milestone-v15")
                    expect(current_method).to_contain_text("V1.5")
                    expect(current_method).to_contain_text("3.4.4")
                    expect(current_method).to_contain_text(
                        "本轮保留同轮计数成本"
                        if lang == "zh"
                        else "Same-run accounting costs remain"
                    )
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
                        "V0.85"
                    )
                    expect(page.locator("#midterm-model-runtime")).to_contain_text(
                        "100.000000%"
                    )
                    expect(page.locator("#midterm-model-runtime")).to_contain_text(
                        "200 / 0"
                    )
                    inventory = page.locator("#midterm-dataset-quality-inventory")
                    for score in ("156 / 668", "313 / 1143", "57 / 100", "5 / 60"):
                        expect(inventory).to_contain_text(score)
                    paired_fs = page.locator("#midterm-frontierscience-designated-pair")
                    expect(paired_fs.locator("tbody tr")).to_have_count(2)
                    for score in (
                        "66 / 100",
                        "62 / 100",
                        "3 / 60",
                        "2 / 60",
                        "-4.0000",
                        "-1.6667",
                    ):
                        expect(paired_fs).to_contain_text(score)
                    expect(paired_fs).to_contain_text(
                        "不宣称质量达标" if lang == "zh" else "no quality-pass claim"
                    )
                    expect(inventory.locator("tbody tr")).to_have_count(24)
                    for score in ("151 / 200", "152 / 200", "149 / 200", "146 / 200"):
                        expect(inventory).to_contain_text(score)
                    for score in (
                        "9589 / 12032",
                        "9599 / 12032",
                        "173 / 668",
                        "316 / 1143",
                        "159 / 668",
                        "308 / 1143",
                        "62 / 100",
                        "2 / 60",
                    ):
                        expect(inventory).to_contain_text(score)
                    inventory_section = next(
                        s
                        for s in report["sections"]
                        if s["id"] == "dataset-quality-inventory"
                    )
                    for table_index, indices in enumerate(
                        (
                            (0, 0, 1, 1),
                            (2, 4, 3, 3, 5, 5),
                            (4, 4, 4, 4),
                            (7, 8, 6, 6),
                            (9, 9),
                            (11, 11, 11, 11),
                        )
                    ):
                        rows = (
                            inventory.locator("table")
                            .nth(table_index)
                            .locator("tbody tr")
                        )
                        expect(rows).to_have_count(len(indices))
                        for row_index, evidence_index in enumerate(indices):
                            href = (
                                rows.nth(row_index)
                                .locator("a")
                                .first.get_attribute("href")
                            )
                            assert href.endswith(
                                "/"
                                + inventory_section["evidence"][evidence_index]["path"]
                            )
                    for index, dataset in enumerate(
                        ("hle-verified-20261015",) * 2
                        + ("frontierscience-20261013",) * 2
                    ):
                        href = (
                            inventory.locator("tbody tr")
                            .nth(index)
                            .locator("a")
                            .first.get_attribute("href")
                        )
                        assert href.endswith(
                            f"/website-publication/data/{dataset}/report.json"
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
                    expect(page.locator(".midterm-history-notice")).to_have_count(11)
                    for notice in page.locator(".midterm-history-notice").all():
                        expect(notice).to_contain_text(
                            "历史" if lang == "zh" else "Historical"
                        )
                        expect(notice.locator("a")).to_have_attribute(
                            "href", "#midterm-m01-verdict"
                        )
                    expect(verdict.locator(".midterm-history-notice")).to_have_count(0)
                    expect(verdict.locator("table")).to_have_count(1)
                    expect(
                        verdict.locator("table").nth(0).locator("tbody tr")
                    ).to_have_count(2)
                    expect(verdict).to_contain_text("3.8407")
                    expect(verdict).to_contain_text("99.9397%")
                    expect(verdict).to_contain_text("7.1042")
                    expect(verdict).to_contain_text("7.1085")
                    expect(verdict).to_contain_text("54.0301%")
                    expect(verdict).to_contain_text(
                        "不是理论峰值" if lang == "zh" else "not theoretical peak"
                    )
                    expect(verdict).to_contain_text("127.5166")
                    expect(verdict).to_contain_text("128.6601")
                    expect(verdict).to_contain_text(
                        "未扣除计量开销"
                        if lang == "zh"
                        else "Accounting overhead remains"
                    )
                    expect(verdict).not_to_contain_text(
                        "当前F、T、T参、C和η均未核验齐备"
                    )
                    expect(verdict).not_to_contain_text("30.2443")
                    corrected = page.locator("#midterm-corrected-quality")
                    for value in ("156/200", "143/200", "151/200"):
                        expect(corrected).to_contain_text(value)
                    expect(corrected).to_contain_text("143/200")
                    expect(corrected).to_contain_text(
                        "达到90%" if lang == "zh" else "meets 90%"
                    )
                    historical = page.locator("#midterm-m01-historical")
                    expect(historical).to_contain_text("30.2443%–30.2505%")
                    expect(historical).to_contain_text("135.340126192")
                    expect(page.locator("#midterm-kv-audit")).to_contain_text(
                        "不能排除" if lang == "zh" else "does not exclude"
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
                        native018 = inventory.locator(".measurement-table-scroll").last
                        native018.scroll_into_view_if_needed()
                        bounds = native018.bounding_box()
                        assert bounds and bounds["x"] >= 0
                        assert bounds["x"] + bounds["width"] <= width + 1
                        native018.screenshot(
                            path=output
                            / f"{filename}-{width}-{lang}-{scheme}-native018.png"
                        )
                        fenced.scroll_into_view_if_needed()
                        expect(fenced).to_be_visible()
                        assert fenced.evaluate(
                            "e => e.getBoundingClientRect().right <= innerWidth + 1"
                        )
                        page.screenshot(
                            path=output
                            / f"{filename}-{width}-{lang}-{scheme}-fenced.png"
                        )
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
                        trace_qualification.scroll_into_view_if_needed()
                        expect(trace_qualification).to_be_visible()
                        assert trace_qualification.evaluate(
                            "e => e.getBoundingClientRect().right <= innerWidth + 1"
                        )
                        page.screenshot(
                            path=output
                            / f"{filename}-{width}-{lang}-{scheme}-trace.png"
                        )
                    print(filename, width, lang, "PASS", flush=True)
                    page.close()
        for width in (390, 1440):
            page = browser.new_page(viewport={"width": width, "height": 1000})
            source_response = page.request.get(
                f"{args.url}/data/plugin-performance.json"
            )
            assert source_response.ok
            sources = source_response.json()["entries"]
            page.goto(f"{args.url}/plugins.html", wait_until="domcontentloaded")
            expect(page.locator("#adm .plugin-performance a").first).to_be_attached(
                timeout=30000
            )
            for lang in ("zh", "en"):
                page.evaluate("lang => window.vllmHustSite.setLang(lang)", lang)
                checked = []
                for source in sources:
                    card = page.locator(f"[id='{source['id']}']")
                    if not card.count():
                        continue
                    observation = next(
                        row
                        for row in source["observations"]
                        if row["id"] == source["default_observation_id"]
                    )
                    url = observation.get("url", source["url"])
                    link = card.locator(f".plugin-performance a[href='{url}']")
                    expect(link).to_have_count(1)
                    checked.append(source["id"])
                assert {
                    "adm",
                    "bidkv",
                    "pegaflow-vllm-connectors",
                    "simllm-migration",
                } <= set(checked)
                page.screenshot(path=output / f"plugins-sources-{width}-{lang}.png")
                print("plugins source hrefs", width, lang, checked, "PASS", flush=True)
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
            "**/data/midterm-v085.json",
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
