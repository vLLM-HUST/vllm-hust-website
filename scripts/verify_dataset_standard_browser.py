"""Verify the execution guide, commands, languages, contrast and integrity guards."""

import argparse
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
                assert page.locator("#standard-rows tr").count() == 5
                rows = page.locator("#standard-rows tr").all_text_contents()
                assert "64" in rows[3] and "48" in rows[4]
                assert not re.search(
                    r"[\u4e00-\u9fff]", page.locator("main").inner_text()
                )
                assert "2–3" in page.locator("#test-mode-quick").inner_text()
                assert "12–16" in page.locator("#test-mode-full").inner_text()
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
                    command = page.locator("#run-command").inner_text()
                    assert (
                        shlex.split(command.replace("\\\n", ""))[-1]
                        == "mmlu,hle,frontier,swe,terminal"
                    )
                    page.locator('input[value="quick"]').check()
                    assert (
                        page.locator("#run-command")
                        .inner_text()
                        .endswith("--datasets mmlu")
                    )
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
                    assert "标准测试" in page.locator("h1").inner_text()
                    for details in page.locator(".guide-details").all():
                        details.evaluate("element => element.open = true")
                    no_overflow(page)
                    for details in page.locator(".guide-details").all():
                        details.evaluate("element => element.open = false")
                else:
                    assert page.locator("#entry-title").inner_text() == "测试数据集"
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
            page.goto(url, wait_until="networkidle")
            page.wait_for_selector("#standard-status[role=alert]")
            assert page.locator("#standard-content").is_hidden()
            assert expected in page.locator("#standard-status").get_attribute(
                "data-error"
            )
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
            integrity_failure="rejected",
        )
    )
)
