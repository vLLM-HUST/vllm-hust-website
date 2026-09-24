#!/usr/bin/env python3
"""Verify fixed Frontier charts, compact point popovers and config downloads."""

import argparse
import copy
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def ready(page):
    page.locator("#frontier-panel").wait_for(state="visible")
    page.wait_for_function(
        "document.querySelector('#frontier-status').dataset.state === 'ready'"
    )


def click_point(page, dot):
    """Click actual chart coordinates, then disambiguate overlapping real points."""
    dot.evaluate(
        "node => node.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'})"
    )
    point_id = dot.get_attribute("data-point")
    box = dot.locator(".frontier-dot").bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    if dot.get_attribute("aria-expanded") != "true":
        page.locator(f'#frontier-popover [data-nearby="{point_id}"]').click()
    assert dot.get_attribute("aria-expanded") == "true"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8774")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("output/playwright/leaderboard-runs/frontier"),
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    site = Path(__file__).resolve().parents[1]
    production = json.loads((site / "data/leaderboard_frontier.json").read_text())
    default_points = [
        p
        for p in production["points"]
        if p["cohort_id"] == production["cohorts"][0]["id"]
    ]
    tag_keys = list(
        dict.fromkeys(
            (c["model"]["id"], c["precision"]["id"]) for c in production["cohorts"]
        )
    )
    fixture = json.loads(
        (site / "tests/fixtures/leaderboard_frontier.json").read_text()
    )
    empty = {"schema_version": "leaderboard-frontier/v1", "cohorts": [], "points": []}
    reports = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, language, scheme in [
            (1440, "en", "light"),
            (390, "zh", "light"),
            (1440, "zh", "dark"),
            (390, "en", "dark"),
        ]:
            context = browser.new_context(
                viewport={"width": width, "height": 1000}, color_scheme=scheme
            )
            context.add_init_script(
                f"localStorage.setItem('vllm-hust_lang', '{language}')"
            )
            page = context.new_page()
            # A stale unversioned URL must not hide published points.
            page.route(
                "**/data/leaderboard_frontier.json", lambda r: r.fulfill(json=empty)
            )
            errors = []
            page.on("pageerror", lambda error, errors=errors: errors.append(str(error)))
            page.goto(
                f"{args.url}/leaderboard-runs.html#frontier",
                wait_until="domcontentloaded",
            )
            ready(page)
            assert page.locator("#runs-panel").is_hidden()
            assert page.locator("#tasks-panel").is_hidden()
            assert (
                page.locator("#frontier-panel select:not(#frontier-workload)").count()
                == 0
            )
            assert (
                page.locator(
                    "#frontier-panel table, #frontier-panel pre, #frontier-panel details"
                ).count()
                == 0
            )
            for removed in [
                "frontier-x",
                "frontier-y",
                "frontier-mod",
                "frontier-hardware",
                "frontier-context",
                "frontier-precision",
                "frontier-detail",
            ]:
                assert page.locator(f"#{removed}").count() == 0
            assert page.locator(".frontier-model-tag").count() == len(tag_keys)
            assert (
                "Qwen3.5-35B-A3B"
                in page.locator(".frontier-model-tag").first.inner_text()
            )
            assert "BF16" in page.locator(".frontier-model-tag").first.inner_text()
            default_tag = (
                production["cohorts"][0]["model"]["id"],
                production["cohorts"][0]["precision"]["id"],
            )
            choices = [
                c
                for c in production["cohorts"]
                if (c["model"]["id"], c["precision"]["id"]) == default_tag
            ]
            if len(choices) > 1:
                assert page.locator("#frontier-workload option").count() == len(choices)
                assert (
                    page.locator("#frontier-workload").input_value()
                    == production["cohorts"][0]["id"]
                )
            else:
                assert page.locator("#frontier-workload").count() == 0
                assert page.locator("#frontier-workload-tag").is_visible()
            assert "smoke" in page.locator("#frontier-status").inner_text()
            assert page.locator(".frontier-point").count() == len(default_points)
            assert page.locator("#frontier-popover").is_hidden()
            curves = production["cohorts"][0]["workload"]["contract"].get(
                "concurrency_curves_url"
            )
            assert page.locator("#frontier-curves").is_visible() == bool(curves)
            if curves:
                assert page.locator("#frontier-curves").get_attribute("href") == curves
            # Real control changes filter points and the derived envelope, not data.
            for setting in ("on", "off", "all"):
                page.locator("[data-filter=mtp][value=on]").set_checked(
                    setting in ("on", "all")
                )
                page.locator("[data-filter=mtp][value=off]").set_checked(
                    setting in ("off", "all")
                )
                expected = [
                    p
                    for p in default_points
                    if setting == "all"
                    or (
                        p["configuration"]["parameters"].get("mtp_draft_tokens", -1) > 0
                        if setting == "on"
                        else p["configuration"]["parameters"].get("mtp_draft_tokens")
                        == 0
                    )
                ]
                ids = page.locator("[data-point]").evaluate_all(
                    "nodes => nodes.map(n => n.dataset.point)"
                )
                assert set(ids) == {p["id"] for p in expected}
                assert (
                    f"{len(expected)} / {len(default_points)}"
                    in page.locator("#frontier-filter-count").inner_text()
                )
                assert page.locator("#frontier-popover").is_hidden()
                front = [
                    p
                    for p in expected
                    if not any(
                        q["metrics"]["decode_p90_tps"] >= p["metrics"]["decode_p90_tps"]
                        and q["metrics"]["output_tps"]
                        / q["configuration"]["hardware"]["accelerator_count"]
                        >= p["metrics"]["output_tps"]
                        / p["configuration"]["hardware"]["accelerator_count"]
                        and (
                            q["metrics"]["decode_p90_tps"]
                            > p["metrics"]["decode_p90_tps"]
                            or q["metrics"]["output_tps"]
                            / q["configuration"]["hardware"]["accelerator_count"]
                            > p["metrics"]["output_tps"]
                            / p["configuration"]["hardware"]["accelerator_count"]
                        )
                        for q in expected
                    )
                ]
                envelope = page.locator(".frontier-envelope")
                assert envelope.count() == (1 if len(front) > 1 else 0)
                if len(front) > 1:
                    assert len(envelope.get_attribute("points").split()) == len(front)
                if expected:
                    click_point(
                        page, page.locator(f'[data-point="{expected[0]["id"]}"]')
                    )
            for checkbox in page.locator("[data-filter=mtp]").all():
                checkbox.check()
            # MOD union within its row intersects the MTP row; empty means hide all.
            page.locator("[data-filter=mods][value=none]").uncheck()
            page.locator("[data-filter=mtp][value=on]").uncheck()
            expected = [
                p
                for p in default_points
                if p["configuration"]["mods"]
                and p["configuration"]["parameters"].get("mtp_draft_tokens") == 0
            ]
            assert set(
                page.locator("[data-point]").evaluate_all(
                    "nodes=>nodes.map(n=>n.dataset.point)"
                )
            ) == {p["id"] for p in expected}
            for checkbox in page.locator("[data-filter=mods]").all():
                checkbox.uncheck()
            assert page.locator(".frontier-point").count() == 0
            assert page.locator("#frontier-blank").is_visible()
            for checkbox in page.locator("[data-filter]").all():
                checkbox.check()
            side = page.locator(".frontier-filters").bounding_box()
            card = page.locator(".frontier-card").bounding_box()
            assert page.locator(".frontier-card .frontier-filters").count() == 0
            if width > 900:
                assert side["x"] >= card["x"] + card["width"]
            else:
                assert side["y"] >= card["y"] + card["height"]

            for point in default_points:
                dot = page.locator(f'[data-point="{point["id"]}"]')
                click_point(page, dot)
                popup = page.locator("#frontier-popover")
                assert popup.is_visible()
                assert popup.locator("h2").evaluate(
                    "node => getComputedStyle(node).color"
                ) == popup.evaluate("node => getComputedStyle(node).color")
                text = popup.inner_text()
                for metric in [
                    point["metrics"]["decode_p90_tps"],
                    point["metrics"]["output_tps"]
                    / point["configuration"]["hardware"]["accelerator_count"],
                ]:
                    assert f"{metric:.2f}".rstrip("0").rstrip(".") in text
                params = point["configuration"]["parameters"]
                if params.get("attention_ranks"):
                    assert (
                        f"A{params['attention_ranks']} / E{params['expert_ranks']}"
                        in text
                    )
                else:
                    assert f"TP{params['tensor_parallel_size']}" in text
                    if params.get("expert_parallel_size"):
                        assert f"EP{params['expert_parallel_size']}" in text
                if params.get("mtp_draft_tokens") is not None:
                    assert f"MTP{params['mtp_draft_tokens']}" in text
                protocol = (
                    point["evidence"].get("benchmark_protocol", {}).get("protocol_id")
                )
                warmup = {
                    "agentx256k-snapshot-primers-v2": (
                        "初始上下文填充",
                        "Snapshot primers",
                    ),
                    "agentx256k-pressure10-v1": ("每路 10 次", "10/lane"),
                    "swe-prefix-reuse/v1": ("测量会话冷 KV", "fresh session KV"),
                }.get(protocol, ("未记录", "Not recorded"))
                assert warmup[0 if language == "zh" else 1] in text
                assert point["configuration"]["engine"] in text
                assert point["configuration"]["engine_version"] in text
                params = point["configuration"]["parameters"]
                if params.get("kv_cache_memory_bytes"):
                    assert (
                        f"{params['kv_cache_memory_bytes'] / 1024**3:g} GiB/chip"
                        in text
                    )
                assert popup.locator("pre").count() == 0
                box, plot = (
                    popup.bounding_box(),
                    page.locator("#frontier-plot").bounding_box(),
                )
                assert (
                    box["x"] >= plot["x"]
                    and box["x"] + box["width"] <= plot["x"] + plot["width"]
                )
                assert (
                    box["y"] >= plot["y"]
                    and box["y"] + box["height"] <= plot["y"] + plot["height"]
                )
                with page.expect_download() as download:
                    popup.locator("[data-download]").click()
                file = args.output / f"{width}-{language}-{point['id']}.json"
                download.value.save_as(file)
                payload = json.loads(file.read_text())
                assert payload["point"] == point
                assert payload["cohort"] == production["cohorts"][0]
                assert payload["chart"]["x"] == "decode_p90_tps"
                assert payload["chart"]["y"] == "output_tps_per_chip"
                popup.locator("[data-close]").click()
                assert popup.is_hidden()
            dot.focus()
            page.keyboard.press("Enter")
            assert page.locator("#frontier-popover").is_visible()
            page.screenshot(
                path=str(args.output / f"popover-{width}-{language}-{scheme}.png"),
                full_page=True,
            )
            page.keyboard.press("Escape")
            assert page.locator("#frontier-popover").is_hidden()
            assert dot.evaluate("node => node === document.activeElement")
            click_point(page, dot)
            page.locator(".frontier-heading h1").click()
            assert page.locator("#frontier-popover").is_hidden()
            page.locator("#view-runs").click()
            page.locator(".run-row").first.wait_for()
            page.locator("#view-tasks").click()
            assert page.locator("#tasks-panel").is_visible()
            page.locator("#view-frontier").click()
            assert page.locator("table:visible").count() == 0
            page.locator("#langToggle").click()
            assert page.locator(".frontier-point").count() == len(default_points)
            assert page.evaluate(
                "document.documentElement.scrollWidth <= window.innerWidth + 1"
            )
            page.locator("#langToggle").click()
            page.screenshot(
                path=str(args.output / f"production-{width}-{language}-{scheme}.png"),
                full_page=True,
            )
            assert page.locator("#frontier-workload-repo").get_attribute(
                "href"
            ) == production["cohorts"][0]["workload"]["contract"].get(
                "repository_url", "https://github.com/vLLM-HUST/agentx-bench"
            )
            # Additional checkpoint/workload cohorts keep topology and exact
            # downloadable evidence distinct from the original MTP2 series.
            for cohort in production["cohorts"][1:]:
                tag = (cohort["model"]["id"], cohort["precision"]["id"])
                page.locator(".frontier-model-tag").nth(tag_keys.index(tag)).click()
                picker = page.locator("#frontier-workload")
                if picker.count():
                    picker.select_option(cohort["id"])
                assert page.locator("#frontier-workload-repo").get_attribute(
                    "href"
                ) == cohort["workload"]["contract"].get(
                    "repository_url", "https://github.com/vLLM-HUST/agentx-bench"
                )
                members = [
                    p for p in production["points"] if p["cohort_id"] == cohort["id"]
                ]
                assert page.locator(".frontier-point").count() == len(members)
                for point in members:
                    click_point(page, page.locator(f'[data-point="{point["id"]}"]'))
                    popup = page.locator("#frontier-popover")
                    text = popup.inner_text()
                    params = point["configuration"]["parameters"]
                    if params.get("attention_ranks"):
                        assert (
                            f"A{params['attention_ranks']} / E{params['expert_ranks']}"
                            in text
                        )
                    else:
                        assert f"TP{params['tensor_parallel_size']}" in text
                        if params.get("expert_parallel_size"):
                            assert f"EP{params['expert_parallel_size']}" in text
                    box = popup.bounding_box()
                    assert box["x"] >= 0 and box["x"] + box["width"] <= width
                    with page.expect_download() as download:
                        popup.locator("[data-download]").click()
                    file = args.output / f"{width}-{language}-{point['id']}.json"
                    download.value.save_as(file)
                    payload = json.loads(file.read_text())
                    assert payload["point"] == point and payload["cohort"] == cohort
                    popup.locator("[data-close]").click()
            assert not errors, errors
            reports.append(
                {
                    "width": width,
                    "language": language,
                    "scheme": scheme,
                    "status": "PASS",
                }
            )
            context.close()

        # Same model with different precision stays in separate tags; workload/context is one contract.
        fixture = copy.deepcopy(fixture)
        c = copy.deepcopy(fixture["cohorts"][0])
        c["id"] = "test-other-precision"
        c["precision"] = {"id": "test-fp8", "label": "FP8"}
        fixture["cohorts"].append(c)
        c = copy.deepcopy(fixture["cohorts"][0])
        c["id"] = "test-other-workload"
        c["workload"]["id"] = "test-other-workload"
        c["workload"]["label"] = "Another workload"
        fixture["cohorts"].append(c)
        fixture["cohorts"][0]["workload"]["contract"]["concurrency_curves_url"] = (
            "./assets/frontier-qwen35-concurrency.svg"
        )
        fixture["cohorts"][-1]["workload"]["contract"]["concurrency_curves_url"] = (
            "javascript:alert(1)"
        )
        context = browser.new_context()
        page = context.new_page()
        page.route(
            "**/data/leaderboard_frontier.json*", lambda r: r.fulfill(json=fixture)
        )
        page.goto(f"{args.url}/leaderboard-runs.html#frontier")
        ready(page)
        assert page.locator(".frontier-model-tag").count() == 2
        assert page.locator("#frontier-workload option").count() == 2
        assert page.locator(".frontier-point").count() == 4
        assert page.locator(".frontier-envelope").count() == 1
        assert page.locator("#frontier-curves").is_visible()
        page.locator("[data-filter=mtp][value=unknown]").uncheck()
        assert page.locator(".frontier-point").count() == 0
        assert page.locator("#frontier-blank").is_visible()
        page.locator("[data-filter=mtp][value=unknown]").check()
        assert page.locator(".frontier-point").count() == 4
        page.locator("#frontier-workload").select_option("test-other-workload")
        assert page.locator("#frontier-curves").is_hidden()
        assert page.locator("#frontier-curves").get_attribute("href") is None
        assert page.locator(".frontier-point").count() == 0
        page.locator(".frontier-model-tag").nth(1).click()
        assert page.locator("#frontier-workload").count() == 0
        assert page.locator("#frontier-workload-tag").is_visible()
        assert page.locator(".frontier-point").count() == 0
        page.unroute("**/data/leaderboard_frontier.json*")
        page.route(
            "**/data/leaderboard_frontier.json*", lambda r: r.fulfill(json=empty)
        )
        page.reload()
        ready(page)
        assert page.locator(".frontier-model-tag, .frontier-point").count() == 0
        assert page.locator("#frontier-blank").is_visible()
        page.unroute("**/data/leaderboard_frontier.json*")
        page.route(
            "**/data/leaderboard_frontier.json*",
            lambda r: r.fulfill(json={"invalid": True}),
        )
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function(
            "document.querySelector('#frontier-status').dataset.state === 'error'"
        )
        assert page.locator(".frontier-point").count() == 0
        page.locator("#view-runs").click()
        page.locator(".run-row").first.wait_for()
        context.close()
        browser.close()
    (args.output / "report.json").write_text(json.dumps(reports, indent=2) + "\n")
    print(json.dumps(reports))


if __name__ == "__main__":
    main()
