"""Verify the execution guide, commands, languages, contrast and integrity guards."""

import argparse
import hashlib
import json
import re
import shlex
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument("url")
p.add_argument("--output", required=True)
args = p.parse_args()
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
prompts = {}


def check_prompt_download(page, language, target="mod"):
    button = page.locator("#download-test-prompt")
    assert button.is_enabled()
    with page.expect_download() as pending:
        button.click()
    download = pending.value
    assert download.suggested_filename.endswith(f"-ai-prompt-{language}.txt")
    content = Path(download.path()).read_text(encoding="utf-8-sig")
    for required in (
        "five-datasets-20261113-v1",
        "standard_sha256:",
        "run_guide_sha256:",
        "reference_runner_commit:",
        "max_output_tokens=16384",
        "judge_max_tokens=8192",
        "tool_choice=none",
    ):
        assert required in content, required
    if target == "mod":
        for section in range(1, 5):
            assert re.search(rf"(?<![.0-9])4\.{section}(?![.0-9])", content)
        assert "test_target: own_mod" in content
        assert "selected_scope: full" in content
        assert "selected_profiles: mmlu,hle,frontier,swe,terminal" in content
        assert "--b1-python" not in content
        assert "MOD" in content
    else:
        assert all(f"3.4.{section}" in content for section in range(1, 5))
        assert "test_target: reference-engine" in content
        assert "--datasets mmlu,hle,frontier,swe,terminal" in content
        assert "--b1-python /path/to/fixed-b1-sdk/bin/python" in content
        assert "execution-checklist.json" in content
    if language == "zh":
        assert "标准测试 AI 提示词" in content and "不测任务解决率" in content
    else:
        assert "AI prompt for standard testing" in content
        assert not re.search(r"[\u4e00-\u9fff]", content)
    key = (language, target)
    if key in prompts:
        assert prompts[key] == content, "Both pages must download the same standard"
    prompts[key] = content


def check_engine_link(page, language):
    link = page.locator("#engine-page-link")
    assert link.get_attribute("href") == "./engine.html"
    assert link.inner_text() == (
        "引擎与下载 →" if language == "zh" else "Engine & downloads →"
    )
    assert (
        page.locator("#download-test-script, #engine-download-description").count() == 0
    )
    navigation = page.context.browser.new_page()
    navigation.add_init_script(f"localStorage.setItem('vllm-hust_lang', '{language}')")
    navigation.goto(page.url, wait_until="networkidle")
    requests = []
    downloads = []
    navigation.on("request", lambda request: requests.append(request.url))
    navigation.on("download", lambda download: downloads.append(download))
    navigation.route(
        "**/engine.html",
        lambda route: route.fulfill(body="<h1>Engine</h1>", content_type="text/html"),
    )
    with navigation.expect_navigation():
        navigation.locator("#engine-page-link").focus()
        navigation.keyboard.press("Enter")
    assert navigation.url.endswith("/engine.html")
    assert not downloads and not any("one_click.py" in url for url in requests)
    navigation.close()


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (
        page.viewport_size
    )


def check_contrast(page, selectors):
    ratios = page.evaluate(
        """selectors => {
          const rgb = value => value.match(/[\\d.]+/g).map(Number);
          const lum = color => rgb(color).slice(0, 3).map(v => {
            v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
          }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
          return selectors.map(selector => {
            const element = document.querySelector(selector);
            let parent = element;
            while (parent && rgb(getComputedStyle(parent).backgroundColor)[3] === 0) parent = parent.parentElement;
            const a = lum(getComputedStyle(element).color);
            const b = lum(parent ? getComputedStyle(parent).backgroundColor : 'rgb(255,255,255)');
            return [selector, (Math.max(a,b)+.05)/(Math.min(a,b)+.05)];
          });
        }""",
        selectors,
    )
    assert all(ratio >= 4.5 for _, ratio in ratios), ratios


with sync_playwright() as play:
    browser = play.chromium.launch(headless=True, args=["--no-sandbox"])
    for name, url in [
        ("standard", args.url),
        ("entry", urljoin(args.url, "dataset-introductions.html")),
    ]:
        for width in [1440, 390]:
            for theme in ["light", "dark"]:
                context = browser.new_context(
                    viewport=dict(width=width, height=1100),
                    color_scheme=theme,
                    permissions=["clipboard-read", "clipboard-write"],
                )
                page = context.new_page()
                page.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(url, wait_until="networkidle")
                page.wait_for_selector("#standard-content:not([hidden])")
                current = page.locator("#dataset-current-results[data-loaded]")
                current.wait_for()
                catalog = page.request.get(
                    urljoin(url, "data/engine-release-history-v1.json")
                ).json()
                release = next(
                    row
                    for row in catalog["entries"]
                    if row["id"] == catalog["default_release"]
                )
                assert current.get_attribute("data-loaded") == release["id"]
                assert release["id"].upper() in current.locator("h2").inner_text()
                assert current.locator(
                    'a[href="./b0-b1.html?release=' + release["id"] + '"]'
                ).is_visible()
                acceptance = release["full_acceptance"]
                assert acceptance["models"][0]["name"] in current.inner_text()
                for model in acceptance["models"][1:]:
                    assert model["name"] in current.inner_text()
                assert "Compatibility entry points verified" in current.inner_text()
                assert "All 4.1–4.4 final targets met" in current.inner_text()
                current.locator("summary").click()
                for index, decision in enumerate(current.locator("li").all(), 1):
                    id_ = f"4.{index}"
                    status = (
                        "Target met"
                        if acceptance["targets"][id_]["final"]["met"]
                        else "Target not met"
                    )
                    assert decision.inner_text() == f"{id_} · {status}"
                assert current.locator("li").count() == 4
                current.locator("summary").click()
                assert "B0: 672/672" in current.inner_text()
                assert "B1: 672/672" in current.inner_text()
                assert not re.search(r"\br6\b", current.inner_text(), re.I)
                check_engine_link(page, "en")
                assert page.locator("#standard-rows tr").count() == 5
                assert (
                    "no additional model or external judge service is required"
                    in page.locator("#judge-disclosure").inner_text()
                )
                assert (
                    "Scoring adds total runtime"
                    in page.locator("#judge-disclosure").inner_text()
                )
                rows = page.locator("#standard-rows tr").all_text_contents()
                assert "64" in rows[3] and "48" in rows[4]
                assert not re.search(
                    r"[\u4e00-\u9fff]", page.locator("main").inner_text()
                )
                for mode, time in (("quick", "2–3"), ("full", "12–16")):
                    card = page.locator(f"#test-mode-{mode}")
                    if name == "entry":
                        assert time not in card.inner_text()
                        assert (
                            time
                            in card.locator(
                                ".entry-reference-command .duration"
                            ).text_content()
                        )
                    else:
                        assert time in card.inner_text()
                if name == "standard":
                    assert "200 / 12032" in rows[0] and "200 / 1811" in rows[1]
                    assert "160 / 160" in rows[2]
                    assert sum("Trace inference only" in row for row in rows) == 2
                    assert page.locator("#standard-files a").count() == 6
                    assert (
                        "not every item"
                        in page.locator("#test-mode-scope").inner_text()
                    )
                    assert (
                        "verified"
                        in page.locator("#standard-status").inner_text().lower()
                    )
                    assert not page.locator("#protocol-details details[open]").count()
                    assert page.locator(".guide-step").count() == 5
                    assert page.locator('input[value="full"]').is_checked()
                    assert page.locator(
                        '[name="test-target"][value="mod"]'
                    ).is_checked()
                    assert page.locator("#mod-run").is_visible()
                    assert page.locator("#reference-run").is_hidden()
                    page.locator('[name="mod_repository"]').fill(
                        "https://example.org/student-mod"
                    )
                    page.locator('[name="mod_revision"]').fill("student-v1")
                    with page.expect_download() as project_prompt:
                        page.locator("#download-mod-prompt").click()
                    project_content = Path(project_prompt.value.path()).read_text(
                        encoding="utf-8-sig"
                    )
                    assert "https://example.org/student-mod" in project_content
                    assert "student-v1" in project_content
                    assert "--b1-python" not in project_content
                    page.locator(
                        '[name="test-target"][value="reference-engine"]'
                    ).check()
                    assert page.locator("#reference-run").is_visible()
                    assert page.locator("#mod-run").is_hidden()
                    assert (
                        page.locator('[name="mod_repository"]').input_value()
                        == "https://example.org/student-mod"
                    )
                    page.locator('input[value="full"]').check()
                    check_prompt_download(page, "en", "reference-engine")
                    command = page.locator("#run-command").inner_text()
                    assert (
                        shlex.split(command.replace("\\\n", ""))[-1]
                        == "mmlu,hle,frontier,swe,terminal"
                    )
                    page.locator('input[value="quick"]').check()
                    quick_tokens = shlex.split(
                        page.locator("#run-command").inner_text().replace("\\\n", "")
                    )
                    assert quick_tokens[quick_tokens.index("--datasets") + 1] == "mmlu"
                    assert "--performance-only" in quick_tokens
                    model = (
                        "/models/a model's $(literal) --datasets /path/to/new-results"
                    )
                    sdk = "/sdk/$& value/python"
                    page.locator('[name="model"]').fill(model)
                    page.locator('[name="sdk"]').fill(sdk)
                    page.locator('[name="devices"]').fill("5,6")
                    command = page.locator("#run-command").inner_text()
                    tokens = shlex.split(command.replace("\\\n", ""))
                    assert tokens[tokens.index("--model") + 1] == model
                    assert tokens[tokens.index("--b1-python") + 1] == sdk
                    assert tokens[tokens.index("--physical-devices") + 1] == "5,6"
                    page.locator("#copy-run-command").click()
                    assert page.evaluate("navigator.clipboard.readText()") == command
                    page.locator('[name="devices"]').fill("5,5")
                    assert page.locator("#copy-run-command").is_disabled()
                    assert not page.locator("#run-command").inner_text()
                    page.locator('[name="devices"]').fill("5,6")
                    check_contrast(
                        page,
                        [
                            ".guide-lead",
                            ".guide-note",
                            ".mode-scope",
                            ".mode-requests",
                            ".guide-command code",
                            "#copy-run-command",
                            "[name=model]",
                            ".nav-group-label",
                            ".brand-copy small",
                        ],
                    )
                    page.locator('input[value="full"]').check()
                    page.locator('[name="model"]').fill("/path/to/model")
                    page.locator('[name="sdk"]').fill(
                        "/path/to/fixed-b1-sdk/bin/python"
                    )
                    page.locator('[name="devices"]').fill("0,1")
                    page.locator('[name="test-target"][value="mod"]').check()
                    page.locator('[name="mod_repository"]').fill("")
                    page.locator('[name="mod_revision"]').fill("")
                else:
                    assert [
                        row.locator("td").nth(1).inner_text()
                        for row in page.locator("#standard-rows tr").all()
                    ] == ["200", "200", "160", "32", "32"]
                    assert sum("Trace inference" in row for row in rows) == 2
                    assert not page.locator("#upstream-guides").evaluate("e => e.open")
                    assert not page.locator("#test-mode-notes-panel").evaluate(
                        "e => e.open"
                    )
                    assert page.locator("#standard-status").is_hidden()
                    assert (
                        page.locator(".summary-links a").get_attribute("href")
                        == "./dataset-standard.html"
                    )
                    assert "scope=quick" in page.locator(
                        "#test-mode-quick .mode-start-link"
                    ).get_attribute("href")
                    assert "scope=full" in page.locator(
                        "#test-mode-full .mode-start-link"
                    ).get_attribute("href")
                    assert page.locator(".entry-reference-command[open]").count() == 0
                    for detail in page.locator(".entry-reference-command").all():
                        detail.evaluate("element => element.open = true")
                    assert (
                        page.locator("#test-mode-quick code")
                        .inner_text()
                        .endswith("--datasets mmlu")
                    )
                    assert (
                        page.locator("#test-mode-full code")
                        .inner_text()
                        .endswith("--datasets mmlu,hle,frontier,swe,terminal")
                    )
                    page.locator("#test-mode-full .entry-copy-command").click()
                    assert (
                        page.evaluate("navigator.clipboard.readText()")
                        == page.locator("#test-mode-full code").inner_text()
                    )
                    check_contrast(
                        page,
                        [
                            "#entry-lead",
                            ".test-mode code",
                            ".test-mode p",
                            ".entry-copy-command",
                            ".summary-links span",
                            ".summary-links a",
                        ],
                    )
                if name == "entry":
                    for detail in page.locator(".entry-reference-command").all():
                        detail.evaluate("element => element.open = false")
                check_prompt_download(page, "en")
                check_contrast(page, ["#download-test-prompt", "#engine-page-link"])
                no_overflow(page)
                page.evaluate("window.scrollTo(0,0)")
                page.screenshot(
                    path=str(out / f"{name}-en-{width}-{theme}.png"), full_page=True
                )
                page.locator("#langToggle").click()
                assert (
                    page.locator("#test-mode-quick").inner_text().find("快速测试") >= 0
                )
                assert "About" not in page.locator("#standard-content").inner_text()
                assert (
                    "Trace inference"
                    not in page.locator("#standard-content").inner_text()
                )
                if name == "standard":
                    assert page.locator('[name="devices"]').input_value() == "0,1"
                    assert page.locator('input[value="full"]').is_checked()
                    assert page.locator(
                        '[name="test-target"][value="mod"]'
                    ).is_checked()
                    assert "标准测试" in page.locator("h1").inner_text()
                    for details in page.locator(".guide-details").all():
                        details.evaluate("element => element.open = true")
                    no_overflow(page)
                    for details in page.locator(".guide-details").all():
                        details.evaluate("element => element.open = false")
                else:
                    assert page.locator("#entry-title").inner_text() == "测试数据集"
                check_engine_link(page, "zh")
                check_prompt_download(page, "zh")
                no_overflow(page)
                assert not errors, errors
                page.evaluate("window.scrollTo(0,0)")
                page.screenshot(
                    path=str(out / f"{name}-zh-{width}-{theme}.png"), full_page=True
                )
                page.locator("#langToggle").click()
                assert page.locator("#standard-rows tr").count() == 5
                context.close()
        for path, expected in [
            ("dataset-standard-v1/standard.json", "standard checksum mismatch"),
            ("dataset-run-guide-v1.json", "run guide checksum mismatch"),
        ]:
            page = browser.new_page()
            page.route(
                f"**/{path}",
                lambda route: route.fulfill(
                    status=200, body="{}", content_type="application/json"
                ),
            )
            page.add_init_script("localStorage.setItem('vllm-hust_lang', 'en')")
            page.goto(url, wait_until="networkidle")
            page.wait_for_selector("#standard-status[role=alert]")
            assert page.locator("#standard-content").is_hidden()
            assert page.locator("#download-test-prompt").is_disabled()
            check_engine_link(page, "en")
            assert expected in page.locator("#standard-status").get_attribute(
                "data-error"
            )
            page.close()
    page = browser.new_page()
    page.goto(
        urljoin(args.url, "dataset-standard.html?scope=quick"), wait_until="networkidle"
    )
    page.wait_for_selector("#standard-content:not([hidden])")
    assert page.locator('input[value="quick"]').is_checked()
    assert page.locator('[name="test-target"][value="mod"]').is_checked()
    with page.expect_download() as quick_prompt:
        page.locator("#download-test-prompt").click()
    quick_content = Path(quick_prompt.value.path()).read_text(encoding="utf-8-sig")
    assert "selected_scope: quick" in quick_content
    assert re.search(r"^selected_profiles: mmlu$", quick_content, re.M)
    page.close()
    for kind in ("bytes", "population", "missing-target"):
        page = browser.new_page()
        summary = "data/engine-release-history-v1.json"
        body = page.request.get(urljoin(args.url, summary)).body()
        manifest = page.request.get(
            urljoin(args.url, "data/benchmark-source-manifest.json")
        ).json()
        if kind != "bytes":
            value = json.loads(body)
            release = next(
                row for row in value["entries"] if row["id"] == value["default_release"]
            )
            if kind == "population":
                row = next(
                    row for row in release["measurements"] if row["id"] == "mmlu"
                )
                row["arms"][1]["requests"] -= 1
            else:
                del release["full_acceptance"]["targets"]["4.1"]
            body = json.dumps(value).encode()
            for entry in manifest["files"]:
                if entry["website_path"] == summary:
                    entry.update(
                        sha256=hashlib.sha256(body).hexdigest(), bytes=len(body)
                    )
            page.route(
                "**/data/benchmark-source-manifest.json",
                lambda route, request, manifest=manifest: route.fulfill(json=manifest),
            )
        else:
            body = b"{}"
        page.route(
            "**/" + summary,
            lambda route, request, body=body: route.fulfill(
                body=body, content_type="application/json"
            ),
        )
        page.goto(urljoin(args.url, "dataset-introductions.html"))
        page.wait_for_selector(
            "#dataset-current-results[data-error=publication-rejected]"
        )
        assert not page.locator("#dataset-current-results").get_attribute("data-loaded")
        page.close()
    browser.close()
print(
    json.dumps(
        dict(
            status="passed",
            widths=[1440, 390],
            themes=["light", "dark"],
            languages=["en", "zh"],
            contrast="at least 4.5:1",
            commands="mode selection, shell quoting, clipboard and validation",
            downloads="bilingual prompts; Engine navigation without a script download",
            integrity_failure="rejected",
        )
    )
)
