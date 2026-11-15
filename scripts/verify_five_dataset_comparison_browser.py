"""Verify paired charts, compact target states, frozen MODs and details dialogs."""

import argparse
import copy
import hashlib
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

SUMMARY = "data/five-datasets-r6-20261114/summary-public-v2.json"
COMBINATION = "data/five-datasets-r6-20261114/frozen-combination-v1.json"


def verify(url, output):
    output.mkdir(parents=True, exist_ok=True)
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        data = context.request.get(url + "/" + SUMMARY).json()
        combo = context.request.get(url + "/" + COMBINATION).json()
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
                    expect(root).to_have_attribute(
                        "data-loaded", data["run_id"], timeout=30000
                    )
                    expect(root.locator(".goal-card")).to_have_count(4)
                    for index, goal in enumerate(("3.4.1", "3.4.2", "3.4.3", "3.4.4")):
                        card = root.locator(f'[data-goal="{goal}"]')
                        expected = (
                            (
                                "达成目标"
                                if data["formal_targets"][goal]["accepted"]
                                else "未达成目标"
                            )
                            if lang == "zh"
                            else (
                                "Target met"
                                if data["formal_targets"][goal]["accepted"]
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

                    expect(root.locator(".metric-chart")).to_have_count(4)
                    expect(root.locator(".bar-value")).to_have_count(40)
                    expect(root.locator(".mod-tags span")).to_have_count(
                        len(combo["components"])
                    )
                    assert not page.locator("#optimization-records").evaluate(
                        "el=>el.open"
                    )
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
                    expect(dialog).to_contain_text(
                        "未达成目标" if lang == "zh" else "Target not met"
                    )
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
        for label, path, transform, resign in [
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
            page.goto(url + "/b0-b1.html")
            root = page.locator("#five-dataset-comparison")
            expect(root).to_have_attribute(
                "data-error", "publication-rejected", timeout=30000
            )
            expect(root.locator(".metric-chart")).to_have_count(0)
            checks.append(dict(rejected=label))
            page.close()
        browser.close()
    (output / "verification.json").write_text(json.dumps(checks, indent=2) + "\n")
    print(f"Verified {len(checks)} chart/dialog/source cases")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    verify(args.url.rstrip("/"), args.output)
