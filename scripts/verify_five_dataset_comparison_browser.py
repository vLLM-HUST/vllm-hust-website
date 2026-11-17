"""Verify paired charts, compact target states, frozen MODs and details dialogs."""

import argparse
import copy
import hashlib
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

SUMMARY = "data/five-datasets-r6-20261114/summary-public-v3.json"
HISTORY = "data/engine-release-history-v1.json"
COMBINATION = "data/five-datasets-r6-20261114/frozen-combination-v1.json"


def verify(url, output):
    output.mkdir(parents=True, exist_ok=True)
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        data = context.request.get(url + "/" + SUMMARY).json()
        combo = context.request.get(url + "/" + COMBINATION).json()
        catalog = context.request.get(url + "/" + HISTORY).json()
        manifest = context.request.get(
            url + "/data/benchmark-source-manifest.json"
        ).json()
        for lang in ("zh", "en"):
            for width in (390, 1440):
                for theme in ("light", "dark"):
                    page = context.new_page()
                    page.set_viewport_size(dict(width=width, height=1000))
                    page.emulate_media(color_scheme=theme)
                    page.add_init_script(
                        f"localStorage.setItem('vllm-hust_lang','{lang}')"
                    )
                    errors = []
                    page.on("pageerror", lambda e: errors.append(str(e)))
                    page.goto(url + "/b0-b1.html")
                    root = page.locator("#five-dataset-comparison")
                    expect(root).to_have_attribute("data-release", "r8", timeout=30000)
                    expect(root.locator(".goal-card")).to_have_count(0)
                    expect(root.locator("#r8-current-continuous")).to_be_visible()
                    expect(root.locator("#report-history-links")).to_have_count(0)
                    expect(
                        root.locator("#comparison-release-select option")
                    ).to_have_count(8)
                    for release, controls, values in [
                        ("r1", [], []),
                        ("r2", [], []),
                        ("r3", [], []),
                        ("r4", ["B0", "r4"], ["495.84", "944.47"]),
                        ("r5", [], []),
                        ("r7", ["B0", "r7"], ["126.72", "385.30"]),
                    ]:
                        root.locator("#comparison-release-select").select_option(
                            release
                        )
                        expect(root).to_have_attribute(
                            "data-release", release, timeout=30000
                        )
                        expect(page.locator("#comparison-title")).to_contain_text(
                            release
                        )
                        expect(root.locator("#r8-current-continuous")).to_have_count(0)
                        expect(root.locator(".goal-card")).to_have_count(0)
                        if controls:
                            expect(root).to_have_attribute(
                                "data-baseline-id", "original018-cann8.5.1"
                            )
                            chart = root.locator(
                                '[data-metric="output_tokens_per_second"]'
                            )
                            expect(chart.locator(".bar-role").nth(0)).to_have_text(
                                controls[0]
                            )
                            expect(chart.locator(".bar-role").nth(1)).to_have_text(
                                controls[1]
                            )
                            expect(chart.locator(".bar-value").nth(0)).to_have_text(
                                values[0]
                            )
                            expect(chart.locator(".bar-value").nth(1)).to_have_text(
                                values[1]
                            )
                        else:
                            expect(root.locator(".metric-chart")).to_have_count(0)
                            if release == "r5":
                                expect(root).to_contain_text(
                                    "ready" if lang == "zh" else "readiness"
                                )
                        if release in ("r1", "r2", "r3"):
                            root.locator("details summary").click()
                            expect(root.locator("details")).to_contain_text(
                                "continuous-b1-packed-" + release
                            )
                        if release == "r7":
                            expect(root.locator(".historical-quality")).to_contain_text(
                                "138/200"
                            )
                            root.locator("details summary").click()
                            expect(root.locator("details")).to_contain_text("8742.65")
                        assert page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth+1"
                        )
                        page.evaluate("window.scrollTo(0,0)")
                        page.screenshot(
                            path=str(output / f"{release}-{lang}-{width}-{theme}.png"),
                            full_page=True,
                        )
                    root.locator("#comparison-release-select").select_option("r6")
                    expect(root).to_have_attribute("data-release", "r6", timeout=30000)
                    expect(page.locator("#comparison-title")).to_contain_text("r6")
                    expect(root).to_have_attribute(
                        "data-loaded", data["run_id"], timeout=30000
                    )
                    expect(root).to_have_attribute(
                        "data-baseline-id", "original018-cann8.5.1"
                    )
                    expect(root.locator(".goal-card")).to_have_count(4)
                    for index, goal in enumerate(("3.4.1", "3.4.2", "3.4.3", "3.4.4")):
                        card = root.locator(f'[data-goal="{goal}"]')
                        milestone = data["formal_targets"][goal]
                        if goal == "3.4.1":
                            milestone = milestone["historical_evidence"]
                        expected = (
                            ("达成目标" if milestone["accepted"] else "未达成目标")
                            if lang == "zh"
                            else (
                                "Target met"
                                if milestone["accepted"]
                                else "Target not met"
                            )
                        )
                        assert (
                            card.locator("strong").evaluate(
                                "el=>el.lastChild.textContent.trim()"
                            )
                            == expected
                        )
                        assert not any(
                            word in card.inner_text()
                            for word in ("复核中", "待测", "待计算", "pending")
                        )

                    supplement = root.locator("#context-tenant-supplement")
                    expect(supplement).to_contain_text("62.89%")
                    expect(supplement).to_contain_text("82.77%")
                    image = supplement.locator("img")
                    assert image.evaluate("el=>el.complete && el.naturalWidth>0")
                    root.locator('[data-detail="supplement"]').click()
                    extra = root.locator("dialog")
                    expect(extra.locator("tbody tr")).to_have_count(4)
                    expect(extra).to_contain_text("238.13")
                    expect(extra).to_contain_text("r4")
                    expect(extra).to_contain_text("20261116-r7")
                    extra.locator(".dialog-close").click()
                    expect(root.locator(".metric-chart")).to_have_count(4)
                    expect(root.locator(".bar-value")).to_have_count(40)
                    expect(root.locator(".mod-tags span")).to_have_count(
                        len(combo["components"])
                    )
                    expect(page.locator("#optimization-records")).to_have_count(0)
                    expect(
                        root.locator('a[href="./engine-r8-development.html"]')
                    ).to_be_visible()
                    assert not root.locator("dialog").is_visible()
                    text = root.inner_text()
                    for phrase in (
                        "用户未确认",
                        "未证明达标",
                        "不能证明",
                        "does not establish",
                        "Not demonstrated",
                    ):
                        assert phrase not in text
                    for key, divisor in [
                        ("output_tokens_per_second", 1),
                        ("mean_ttft_ms", 1000),
                        ("mean_tpot_ms", 1),
                        ("estimated_cny_per_million_output_tokens", 1),
                    ]:
                        chart = root.locator(f'[data-metric="{key}"]')
                        widths = chart.locator(".bar-fill.b0").evaluate_all(
                            "els=>els.map(e=>e.style.width)"
                        )
                        assert len(set(widths)) == 1, (
                            "B0-normalized bars must share their baseline"
                        )
                        for row in data["datasets"]:
                            values = chart.locator(
                                f'[data-profile="{row["id"]}"] .bar-value'
                            )
                            expect(values).to_have_text(
                                [
                                    f"{row['arms'][role][key] / divisor:.2f}"
                                    for role in ("B0", "B1")
                                ]
                            )
                    for component in combo["components"]:
                        expect(root.locator(".mod-tags")).to_contain_text(
                            component["name_" + lang]
                        )
                    button = root.locator('[data-detail="methods"]')
                    button.click()
                    dialog = root.locator("dialog")
                    expect(dialog).to_be_visible()
                    expect(dialog).to_contain_text("(n−1)×q")
                    expect(dialog).to_contain_text("TTFT")
                    page.keyboard.press("Escape")
                    expect(dialog).not_to_be_visible()
                    expect(button).to_be_focused()
                    root.locator('[data-detail="quality"]').click()
                    expect(dialog.locator("tbody tr")).to_have_count(6)
                    expect(dialog).to_contain_text("35B")
                    dialog.locator(".dialog-close").click()
                    root.locator('[data-detail="configuration"]').click()
                    expect(dialog).to_contain_text(combo["engine_release"])
                    expect(dialog.locator("tbody tr")).to_have_count(8)
                    dialog.locator(".dialog-close").click()
                    root.locator('[data-goal="3.4.1"]').click()
                    expect(dialog).to_contain_text("19.340383")
                    expect(dialog).to_contain_text("MMLU200/out256")
                    expect(dialog).to_contain_text(
                        "达成目标" if lang == "zh" else "Target met"
                    )
                    assert data["formal_targets"]["3.4.1"]["measured_value"] is None
                    dialog.locator(".dialog-close").click()
                    root.locator('[data-detail="metrics"]').click()
                    expect(dialog.locator("table")).to_have_count(4)
                    dialog.locator(".dialog-close").click()
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth+1"
                    )
                    assert not errors, errors
                    page.evaluate("window.scrollTo(0,0)")
                    page.screenshot(
                        path=str(output / f"{lang}-{width}-{theme}.png"), full_page=True
                    )
                    checks.append(
                        dict(
                            language=lang,
                            width=width,
                            theme=theme,
                            verified="40 values,8 MODs,4 goals,dialogs and keyboard",
                        )
                    )
                    page.close()
        for release in ("r1", "r2", "r3", "r4", "r5", "r7"):
            page = context.new_page()
            page.goto(url + "/b0-b1.html?release=" + release)
            root = page.locator("#five-dataset-comparison")
            expect(root).to_have_attribute("data-release", release, timeout=30000)
            expect(root.locator("#comparison-release-select")).to_have_value(release)
            initial_title = page.locator("#comparison-title").inner_text()
            page.locator("#langToggle").click()
            expect(root).to_have_attribute("data-release", release)
            expect(page.locator("#comparison-title")).not_to_have_text(initial_title)
            expect(root.locator("#comparison-release-select")).to_have_value(release)
            page.close()
            checks.append(dict(direct_release=release, language_switch=True))
        page = context.new_page()
        page.add_init_script("""{
            const original = window.fetch.bind(window);
            window.fetch = (path, ...args) => String(path).includes('summary-public-v3.json')
                ? new Promise((resolve, reject) => setTimeout(() => reject(Error('Delayed old request failure')), 200))
                : original(path, ...args);
        }""")
        page.goto(url + "/b0-b1.html")
        root = page.locator("#five-dataset-comparison")
        expect(root).to_have_attribute("data-release", "r8", timeout=30000)
        page.evaluate("""async () => {
            const choose = id => {const menu=document.querySelector('#comparison-release-select');menu.value=id;menu.dispatchEvent(new Event('change'));};
            choose('r6');await new Promise(resolve=>setTimeout(resolve,20));choose('r4');
        }""")
        expect(root).to_have_attribute("data-release", "r4", timeout=30000)
        page.wait_for_timeout(300)
        expect(root).to_have_attribute("data-release", "r4")
        assert root.get_attribute("data-error") is None
        page.close()
        checks.append(dict(rapid_switch="r8-r6-r4", stale_failure_ignored=True))
        for label, path, transform, resign in [
            (
                "unsupported-historical-pass",
                SUMMARY,
                lambda d: d["formal_targets"]["3.4.1"]["historical_evidence"].update(
                    measured_value=49
                ),
                True,
            ),
            (
                "foreign-milestone-evidence",
                SUMMARY,
                lambda d: d["formal_targets"]["3.4.1"]["historical_evidence"].update(
                    source_url="https://example.com"
                ),
                True,
            ),
            (
                "inconsistent-supplement-rate",
                SUMMARY,
                lambda d: d["acceptance_supplement"]["comparisons"][0].__setitem__(
                    "throughput_ratio", 100
                ),
                True,
            ),
            (
                "incomplete-supplement-window",
                SUMMARY,
                lambda d: d["acceptance_supplement"]["comparisons"][0]["arms"]["B1"][
                    "windows"
                ].pop(),
                True,
            ),
            ("bad-hash", SUMMARY, lambda d: d.update(execution_complete=False), False),
            (
                "inconsistent-rate",
                SUMMARY,
                lambda d: d["datasets"][0]["arms"]["B1"].__setitem__(
                    "output_tokens_per_second", 1
                ),
                True,
            ),
            ("incomplete", SUMMARY, lambda d: d.update(execution_complete=False), True),
            (
                "bad-combination-hash",
                COMBINATION,
                lambda d: d.update(engine_release="other"),
                False,
            ),
            (
                "foreign-frozen-combination",
                COMBINATION,
                lambda d: d.update(engine_release="other"),
                True,
            ),
        ]:
            changed = copy.deepcopy(data if path == SUMMARY else combo)
            transform(changed)
            raw = json.dumps(changed).encode()
            updated = copy.deepcopy(manifest)
            for entry in updated["files"]:
                if entry["website_path"] == path:
                    entry.update(sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
            page = context.new_page()
            page.route(
                "**/" + path,
                lambda route, request, raw=raw: route.fulfill(
                    body=raw, content_type="application/json"
                ),
            )
            if resign:
                page.route(
                    "**/data/benchmark-source-manifest.json",
                    lambda route, request, updated=updated: route.fulfill(json=updated),
                )
            page.goto(url + "/b0-b1.html?release=r6")
            root = page.locator("#five-dataset-comparison")
            expect(root).to_have_attribute(
                "data-error", "publication-rejected", timeout=30000
            )
            expect(root.locator(".metric-chart")).to_have_count(0)
            checks.append(dict(rejected=label))
            page.close()
        for label, transform, resign in [
            (
                "release-history-bad-hash",
                lambda d: d.update(default_release="r4"),
                False,
            ),
            (
                "release-history-wrong-arm",
                lambda d: d["entries"][0]["measurements"][0].update(candidate="r7"),
                True,
            ),
            (
                "release-history-B1-used-as-baseline",
                lambda d: d["entries"][3]["measurements"][0].update(control="r6"),
                True,
            ),
            (
                "release-history-foreign-B0",
                lambda d: d["baseline"].update(vllm="0.28.1"),
                True,
            ),
            (
                "release-history-fabricated-r5",
                lambda d: d["entries"][1]["measurements"].append(
                    d["entries"][0]["measurements"][0]
                ),
                True,
            ),
        ]:
            changed = copy.deepcopy(catalog)
            transform(changed)
            raw = json.dumps(changed).encode()
            updated = copy.deepcopy(manifest)
            for entry in updated["files"]:
                if entry["website_path"] == HISTORY:
                    entry.update(sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
            page = context.new_page()
            page.route(
                "**/" + HISTORY,
                lambda route, request, raw=raw: route.fulfill(
                    body=raw, content_type="application/json"
                ),
            )
            if resign:
                page.route(
                    "**/data/benchmark-source-manifest.json",
                    lambda route, request, updated=updated: route.fulfill(json=updated),
                )
            page.goto(url + "/b0-b1.html?release=r4")
            root = page.locator("#five-dataset-comparison")
            expect(root).to_have_attribute(
                "data-error", "publication-rejected", timeout=30000
            )
            expect(root.locator(".metric-chart")).to_have_count(0)
            checks.append(dict(rejected=label))
            page.close()
        page = context.new_page()
        page.route(
            "**/data/r8-continuous-20261117/summary-v1.json",
            lambda route: route.fulfill(json={"corrupted": True}),
        )
        page.goto(url + "/b0-b1.html")
        root = page.locator("#five-dataset-comparison")
        expect(root).to_have_attribute(
            "data-error", "publication-rejected", timeout=30000
        )
        expect(root.locator("#r8-current-continuous")).to_have_count(0)
        root.locator("#comparison-release-select").select_option("r6")
        expect(root).to_have_attribute("data-release", "r6", timeout=30000)
        expect(root.locator(".goal-card")).to_have_count(4)
        page.close()
        checks.append(
            dict(rejected="corrupt-r8-publication", historical_release_selectable=True)
        )
        browser.close()
    (output / "verification.json").write_text(json.dumps(checks, indent=2) + "\n")
    print(f"Verified {len(checks)} chart/dialog/source cases")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    verify(args.url.rstrip("/"), args.output)
