#!/usr/bin/env python3
"""Bounded depth-selector QA; full historical export traversal lives in the full suite."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright
from verify_leaderboard_frontier_browser import (
    assert_concurrency_series,
    click_point,
    ready,
    verify_rotation_choices,
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8787")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / "data/leaderboard_frontier.json").read_text())
    cohorts = [c for c in data["cohorts"] if not c.get("display_withdrawal")]
    fixture = json.loads(
        (root / "tests/fixtures/leaderboard_frontier.json").read_text()
    )
    with sync_playwright() as p:
        browser = p.chromium.launch()
        verify_rotation_choices(browser, args.url, fixture)
        for width, language, scheme in [
            (1440, "en", "light"),
            (390, "zh", "light"),
            (1440, "zh", "dark"),
            (320, "en", "dark"),
        ]:
            context = browser.new_context(
                viewport={"width": width, "height": 1000}, color_scheme=scheme
            )
            context.add_init_script(
                f"localStorage.setItem('vllm-hust_lang', '{language}')"
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(args.url + "/leaderboard-runs.html#frontier")
            ready(page)
            page.locator("#frontier-only").uncheck()
            for cohort in cohorts:
                page.locator("#frontier-model-trigger").click()
                page.locator(".frontier-model-tag").filter(
                    has_text=cohort["model"]["label"]
                ).click()
                members = [v for v in data["points"] if v["cohort_id"] == cohort["id"]]
                depths = sorted({v["load"]["session_rotation_depth"] for v in members})
                assert page.locator(
                    "#frontier-rotation-filter legend"
                ).inner_text() == (
                    "会话轮转深度" if language == "zh" else "Session rotation depth"
                )
                notes = page.locator("#frontier-rotation-filter .frontier-filter-note")
                help_text = (
                    "C1/C2/… 是请求并发数；D1/D2 是每条并发通道轮转的会话状态数。"
                    if language == "zh"
                    else "C1/C2/… is request concurrency; D1/D2 is the number of session states rotated per request lane."
                )
                assert help_text in notes.first.inner_text()
                choices = page.locator('[data-filter="rotation"]')
                assert choices.count() == len(depths)
                assert all(choice.is_checked() for choice in choices.all())
                assert page.locator(".frontier-concurrency-label").count() == 0
                assert_concurrency_series(page, members)
                page.locator("#frontier-only").check()
                shown = set(
                    page.locator("[data-point]").evaluate_all(
                        "nodes=>nodes.map(n=>n.dataset.point)"
                    )
                )
                assert_concurrency_series(
                    page, [p for p in members if p["id"] in shown]
                )
                page.locator("#frontier-only").uncheck()
                toggle = page.locator("#frontier-mods-toggle")
                assert toggle.inner_text() == (
                    "全不选" if language == "zh" else "Deselect all"
                )
                toggle.click()
                assert page.locator("[data-point]").count() == 0
                assert all(
                    not c.is_checked()
                    for c in page.locator('[data-filter="mods"]').all()
                )
                assert toggle.inner_text() == (
                    "全选" if language == "zh" else "Select all"
                )
                toggle.click()
                assert page.locator("[data-point]").count() == len(members)
                # A partial MOD selection is completed by Select all, then cleared on the next click.
                mod = page.locator('[data-filter="mods"]').first
                mod.uncheck()
                assert toggle.inner_text() == (
                    "全选" if language == "zh" else "Select all"
                )
                toggle.click()
                assert all(
                    c.is_checked() for c in page.locator('[data-filter="mods"]').all()
                )
                for depth in depths:
                    for choice in choices.all():
                        choice.set_checked(int(choice.input_value()) == depth)
                    assert (
                        page.locator(f'[data-filter="rotation"][value="{depth}"]')
                        .locator("..")
                        .inner_text()
                        == f"D{depth}"
                    )
                    expected = [
                        v
                        for v in members
                        if v["load"]["session_rotation_depth"] == depth
                    ]
                    assert set(
                        page.locator("[data-point]").evaluate_all(
                            "nodes=>nodes.map(n=>n.dataset.point)"
                        )
                    ) == {v["id"] for v in expected}
                    assert_concurrency_series(page, expected)
                    assert (
                        f"{len(expected)} / {len(expected)}"
                        in page.locator("#frontier-filter-count").inner_text()
                    )
                    assert f"D{depth}" in page.locator("#frontier-chart").text_content()
                    page.locator("#frontier-only").check()
                    shown = set(
                        page.locator("[data-point]").evaluate_all(
                            "nodes=>nodes.map(n=>n.dataset.point)"
                        )
                    )
                    assert_concurrency_series(
                        page, [p for p in expected if p["id"] in shown]
                    )
                    page.locator("#frontier-only").uncheck()
                    click_point(
                        page, page.locator(f'[data-point="{expected[0]["id"]}"]')
                    )
                    c = expected[0]["load"]["concurrency"]
                    assert (
                        f"并发数: C{c} · 会话轮转深度: D{depth}"
                        if language == "zh"
                        else f"Concurrency: C{c} · Session rotation depth: D{depth}"
                    ) in page.locator("#frontier-popover").inner_text()
                    with page.expect_download() as downloaded:
                        page.locator("[data-download]").click()
                    assert (
                        json.loads(Path(downloaded.value.path()).read_text())["point"]
                        == expected[0]
                    )
                    page.locator("[data-close]").click()
                    page.locator("#langToggle").click()
                    assert [
                        c.input_value() for c in choices.all() if c.is_checked()
                    ] == [str(depth)]
                    page.locator("#langToggle").click()
                    assert (
                        page.evaluate("document.documentElement.scrollWidth") <= width
                    )
                for choice in choices.all():
                    choice.uncheck()
                assert page.locator("[data-point]").count() == 0
                assert page.locator("#frontier-blank").is_visible()
                assert not errors, errors
            print(
                f"PASS {width}px {language} {scheme}: scale overlays/isolation, MOD toggle, counts, downloads, language persistence",
                flush=True,
            )
            context.close()
        browser.close()


if __name__ == "__main__":
    main()
