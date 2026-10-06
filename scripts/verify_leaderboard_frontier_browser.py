#!/usr/bin/env python3
"""Verify fixed Frontier charts, compact point popovers and config downloads."""

import argparse
import copy
import json
import time
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


def download_configuration(page, popup, previous_download):
    # Chromium silently drops burst downloads in LocalFrame::ShouldThrottleDownload.
    # Pace this exhaustive UI check; retain every click and payload assertion.
    remaining = 0.2 - (time.monotonic() - previous_download)
    if remaining > 0:
        page.wait_for_timeout(remaining * 1000)
    with page.expect_download() as download:
        popup.locator("[data-download]").click()
    return download.value, time.monotonic()


def assert_concurrency_series(page, points, cohort=None):
    """BetterScale joins Pareto vertices; other groups retain measured sweeps."""
    visible = set(
        page.locator("[data-point]").evaluate_all(
            "nodes => nodes.map(node => node.dataset.point)"
        )
    )
    groups = {}
    frontiers = {}
    configuration_groups = {}
    contract = (cohort or {}).get("workload", {}).get("contract", {})
    shared_ids = set(contract.get("comparison_point_ids", []))
    configuration_comparison = contract.get("presentation") == "configuration-study"
    for point in points:
        if point["id"] not in visible or not point["load"].get("concurrency_series"):
            continue
        group = (
            point.get("study_group", {}).get("id")
            or point["load"].get("presentation_group", {}).get("id")
            or point["configuration"].get("experiment_group")
            or "+".join(sorted(point["configuration"]["mods"]))
            or "none"
        )
        if (
            group == "betterscale"
            and configuration_comparison
            and point["id"] in shared_ids
        ):
            campaign = (
                point.get("evidence", {}).get("benchmark_protocol", {}).get("campaign")
            )
            family = (
                campaign
                if campaign
                in {"concurrency-knee-20261006", "concurrency-width-20261006"}
                else "original"
            )
            key = (
                point["cohort_id"],
                point["load"].get("session_rotation_depth"),
                family,
            )
            configuration_groups.setdefault(key, []).append(point)
            continue
        if group == "betterscale":
            key = json.dumps(
                [
                    point["cohort_id"],
                    group,
                    point["load"].get("session_rotation_depth"),
                ],
                separators=(",", ":"),
            )
            if (
                point["configuration"]["parameters"].get("functional_status")
                != "failed"
            ):
                frontiers.setdefault(key, []).append(point)
            continue
        series = json.dumps(
            [
                point["cohort_id"],
                point["load"]["concurrency_series"],
                point["load"].get("session_rotation_depth"),
            ],
            separators=(",", ":"),
        )
        groups.setdefault(series, []).append(point)

    expected = {
        series: sorted(members, key=lambda p: p["load"]["concurrency"])
        for series, members in groups.items()
        if len(members) > 1
    }
    for members in configuration_groups.values():
        members.sort(key=lambda p: p["load"]["concurrency"])
        if len(members) < 2:
            continue
        first = members[0]
        series = json.dumps(
            [
                first["cohort_id"],
                first["load"]["concurrency_series"],
                first["load"].get("session_rotation_depth"),
            ],
            separators=(",", ":"),
        )
        expected[series] = members

    def coordinates(point):
        return (
            point["metrics"]["decode_p90_tps"],
            point["metrics"]["output_tps"]
            / point["configuration"]["hardware"]["accelerator_count"],
        )

    for key, members in frontiers.items():
        vertices = []
        seen = set()
        for point in sorted(members, key=lambda p: (coordinates(p)[0], p["id"])):
            x, y = coordinates(point)
            if (
                any(
                    coordinates(other)[0] >= x
                    and coordinates(other)[1] >= y
                    and coordinates(other) != (x, y)
                    for other in members
                )
                or (x, y) in seen
            ):
                continue
            vertices.append(point)
            seen.add((x, y))
        if len(vertices) > 1:
            expected[key] = vertices

    lines = page.locator(".frontier-concurrency-line")
    assert lines.count() == len(expected)
    assert page.locator(".frontier-envelope").count() == 0
    for line in lines.all():
        rows = expected[line.get_attribute("data-series")]
        depth = rows[0]["load"].get("session_rotation_depth")
        assert all(p["load"].get("session_rotation_depth") == depth for p in rows)
        assert line.get_attribute("stroke-dasharray") == (
            "7 4" if depth and depth > 1 else "none"
        )
        assert json.loads(line.get_attribute("data-series-points")) == [
            p["id"] for p in rows
        ]
        vertices = [
            tuple(map(float, pair.split(",")))
            for pair in line.get_attribute("points").split()
        ]
        for point, vertex in zip(rows, vertices, strict=True):
            dot = page.locator(f'[data-point="{point["id"]}"] .frontier-dot')
            assert vertex == (
                float(dot.get_attribute("cx")),
                float(dot.get_attribute("cy")),
            )


def assert_parallel(text, params, language):
    if params.get("attention_tensor_parallel_size") is not None:
        attention = "DP2" if params["attention_data_parallel_size"] == 2 else "TP2"
        expert = "EP2" if params["expert_parallel_size"] == 2 else "TP2"
        assert f"{'注意力' if language == 'zh' else 'Attention'} {attention}" in text
        assert f"{'专家' if language == 'zh' else 'Experts'} {expert}" in text
    elif params.get("attention_ranks"):
        assert f"A{params['attention_ranks']} / E{params['expert_ranks']}" in text
    else:
        assert f"TP{params['tensor_parallel_size']}" in text
        if params.get("pipeline_parallel_size", 1) > 1:
            assert f"PP{params['pipeline_parallel_size']}" in text
        if params.get("expert_parallel_size"):
            assert f"EP{params['expert_parallel_size']}" in text


def verify_rotation_choices(browser, url, fixture):
    """Exercise future depths using explicitly synthetic browser-only input."""
    data = copy.deepcopy(fixture)
    data["cohorts"][0]["workload"]["contract"]["session_rotation"] = {
        "status": "under-construction"
    }
    for index, point in enumerate(data["points"]):
        point["load"]["session_rotation_depth"] = 1 if index % 2 == 0 else 4
    context = browser.new_context(viewport={"width": 390, "height": 1000})
    page = context.new_page()
    page.route("**/data/leaderboard_frontier.json*", lambda r: r.fulfill(json=data))
    page.goto(f"{url}/leaderboard-runs.html#frontier")
    ready(page)
    choices = page.locator('[data-filter="rotation"]')
    assert choices.evaluate_all("nodes=>nodes.map(n=>n.value)") == ["1", "4"]
    assert all(choice.is_checked() for choice in choices.all())
    page.locator("#frontier-only").uncheck()
    assert_concurrency_series(page, data["points"])
    page.locator('[data-filter="rotation"][value="1"]').uncheck()
    expected = [p for p in data["points"] if p["load"]["session_rotation_depth"] == 4]
    assert set(
        page.locator("[data-point]").evaluate_all(
            "nodes=>nodes.map(n=>n.dataset.point)"
        )
    ) == {p["id"] for p in expected}
    assert_concurrency_series(page, expected)
    page.locator('[data-filter="rotation"][value="4"]').uncheck()
    assert page.locator("[data-point]").count() == 0
    page.locator('[data-filter="rotation"][value="1"]').check()
    expected = [p for p in data["points"] if p["load"]["session_rotation_depth"] == 1]
    assert_concurrency_series(page, expected)
    context.close()


def verify_setting_deep_links(browser, url):
    setting = "qwen25-14b-bf16-gsm8k-b128-vspec-v1"
    context = browser.new_context(viewport={"width": 390, "height": 1000})
    context.add_init_script("localStorage.setItem('vllm-hust_lang', 'zh')")
    page = context.new_page()
    page.goto(f"{url}/leaderboard-runs.html?setting={setting}#settings")
    ready(page)
    assert page.locator("#view-frontier").get_attribute("aria-pressed") == "true"
    assert "实验设定" in page.locator("#view-frontier").inner_text()
    assert "Qwen2.5-14B" in page.locator("#frontier-model-trigger").inner_text()
    assert "GSM8K" in page.locator("#frontier-workload-tag").inner_text()
    assert "仅显示最佳权衡点" in page.locator("#frontier-panel").inner_text()
    assert not page.locator("#frontier-only").is_checked()
    assert f"setting={setting}" in page.url
    assert page.url.endswith("#settings")

    page.goto(f"{url}/leaderboard-runs.html#frontier")
    ready(page)
    assert page.url.endswith("#settings")
    context.close()


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
    production["cohorts"] = [
        c for c in production["cohorts"] if not c.get("display_withdrawal")
    ]
    visible_ids = {c["id"] for c in production["cohorts"]}
    production["points"] = [
        p for p in production["points"] if p["cohort_id"] in visible_ids
    ]
    default_cohort = production["cohorts"][0]
    default_cohort_points = [
        p
        for p in production["points"]
        if p["cohort_id"] == default_cohort["id"]
        and (
            not default_cohort["workload"]["contract"].get("display_series_ids")
            or p["load"].get("concurrency_series")
            in default_cohort["workload"]["contract"]["display_series_ids"]
        )
    ]
    default_points = [
        p for p in default_cohort_points if p["load"]["session_rotation_depth"] == 1
    ]
    default_groups = set(
        default_cohort["workload"]["contract"].get("default_groups", [])
    )
    initial_points = [
        p
        for p in default_points
        if not default_groups
        or (
            p["load"].get("presentation_group", {}).get("id")
            or p["configuration"].get("experiment_group")
            or "+".join(sorted(p["configuration"]["mods"]))
            or "none"
        )
        in default_groups
    ]
    tag_keys = list(
        dict.fromkeys(
            (c["model"]["id"], c["precision"]["id"]) for c in production["cohorts"]
        )
    )
    fixture = json.loads(
        (site / "tests/fixtures/leaderboard_frontier.json").read_text()
    )
    empty = {
        "schema_version": "leaderboard-frontier/v1",
        "official_baseline": production["official_baseline"],
        "cohorts": [],
        "points": [],
    }
    reports = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        verify_rotation_choices(browser, args.url, fixture)
        verify_setting_deep_links(browser, args.url)
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
            previous_download = 0.0
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
            assert "AgentX" not in page.locator("#frontier-panel").inner_text()
            baseline_text = page.locator(".frontier-baseline").inner_text()
            assert "vLLM 0.18.0 + vLLM-Ascend 0.18.0" in baseline_text
            assert (
                "已有该设定的同合同实测"
                if language == "zh"
                else "matched measurement available"
            ) in baseline_text
            assert not page.locator("#frontier-only").is_checked()
            shown = page.locator("[data-point]").evaluate_all(
                "nodes=>nodes.map(n=>n.dataset.point)"
            )
            assert set(shown) == {point["id"] for point in initial_points}
            page.locator("#frontier-only").check()
            shown = page.locator("[data-point]").evaluate_all(
                "nodes=>nodes.map(n=>n.dataset.point)"
            )
            expected_front = page.evaluate(
                "points => LeaderboardFrontierModel.groupFrontiers(points, 'decode_p90_tps', 'output_tps_per_chip').flat().map(r=>r.point.id)",
                initial_points,
            )
            assert set(shown) == set(expected_front)
            assert_concurrency_series(
                page, [p for p in initial_points if p["id"] in shown]
            )
            page.screenshot(
                path=str(
                    args.output / f"frontier-only-{width}-{language}-{scheme}.png"
                ),
                full_page=True,
            )
            page.locator("#frontier-only").uncheck()
            page.locator("#frontier-mods-toggle").click()
            assert page.locator("[data-point]").count() == len(default_points)

            pegaflow_points = [
                point
                for point in default_points
                if point["load"].get("concurrency_series")
                == "swe-unified-pegaflow-vllm-connectors-20260929"
            ]
            assert [point["load"]["concurrency"] for point in pegaflow_points] == [
                1,
                2,
                4,
                8,
                16,
            ]
            for point in pegaflow_points:
                assert page.locator(f'[data-point="{point["id"]}"]').count() == 1

            assert page.locator("[data-filter=rotation]").count() == 1
            assert (
                page.locator("#frontier-rotation-filter .frontier-filter-note").count()
                == 1
            )
            assert page.locator('[data-filter="rotation"][value="2"]').count() == 0
            page.locator("#langToggle").click()
            assert page.locator('[data-filter="rotation"][value="1"]').is_checked()
            page.locator("#langToggle").click()
            assert page.locator(".frontier-point").count() == len(default_points)

            assert page.locator("#runs-panel").is_hidden()
            assert page.locator("#tasks-panel").is_hidden()
            assert (
                page.locator("#frontier-panel select:not(#frontier-workload)").count()
                == 0
            )
            assert (
                page.locator(
                    "#frontier-panel table, #frontier-panel pre, #frontier-panel details:not(#frontier-model-picker)"
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
            trigger = page.locator("#frontier-model-trigger")
            assert not page.locator("#frontier-model-picker").get_attribute("open")
            trigger.focus()
            trigger.press("Enter")
            assert page.locator(".frontier-model-tag").first.is_visible()
            trigger.press("Escape")
            assert not page.locator(".frontier-model-tag").first.is_visible()
            assert trigger.evaluate("el => el === document.activeElement")
            trigger.click()
            menu_box = page.locator(".frontier-model-tags").bounding_box()
            assert menu_box["x"] >= 0 and menu_box["x"] + menu_box["width"] <= width
            page.locator(".frontier-heading h1").click()
            assert not page.locator(".frontier-model-tag").first.is_visible()
            assert page.locator(".frontier-model-tag").count() == len(tag_keys)
            assert (
                "Qwen3.5-35B-A3B"
                in page.locator(".frontier-model-tag").first.text_content()
            )
            assert "BF16" in page.locator(".frontier-model-tag").first.text_content()
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
            expected_status = "实测对比" if language == "zh" else "Measured comparison"
            assert expected_status in page.locator("#frontier-status").inner_text()
            assert page.locator(".frontier-point").count() == len(default_points)
            assert_concurrency_series(page, default_points)
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
                assert_concurrency_series(page, expected)
                page.locator("#frontier-only").check()
                shown = set(
                    page.locator("[data-point]").evaluate_all(
                        "nodes=>nodes.map(n=>n.dataset.point)"
                    )
                )
                assert_concurrency_series(
                    page, [p for p in expected if p["id"] in shown]
                )
                shown = page.locator("[data-point]").evaluate_all(
                    "nodes=>nodes.map(n=>n.dataset.point)"
                )
                expected_front = page.evaluate(
                    "points => LeaderboardFrontierModel.groupFrontiers(points, 'decode_p90_tps', 'output_tps_per_chip').flat().map(r=>r.point.id)",
                    expected,
                )
                assert set(shown) == set(expected_front)
                page.locator("#frontier-only").uncheck()

                assert (
                    f"{len(expected)} / {len(default_points)}"
                    in page.locator("#frontier-filter-count").inner_text()
                )
                assert page.locator("#frontier-popover").is_hidden()
                if expected:
                    click_point(
                        page, page.locator(f'[data-point="{expected[0]["id"]}"]')
                    )
            for checkbox in page.locator("[data-filter=mtp]").all():
                checkbox.check()
            # MOD union within its row intersects the MTP row; empty means hide all.
            native_groups = {
                p["load"].get("presentation_group", {}).get("id", "none")
                for p in default_points
                if not p["configuration"]["mods"]
            }
            for group in native_groups:
                page.locator(f'[data-filter="mods"][value="{group}"]').uncheck()
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
            assert page.locator(".frontier-concurrency-line").count() == 0
            for checkbox in page.locator("[data-filter]").all():
                checkbox.check()
            # The public comparison contains only the unified D1 series.
            assert page.locator('[data-filter="rotation"][value="2"]').count() == 0
            assert (
                page.locator(
                    '[data-filter=mods][value="betterscale-AEseparation"]'
                ).count()
                == 0
            )
            assert (
                "betterscale-AEseparation"
                not in page.locator("#frontier-legend").inner_text()
            )
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
                is_known_budget = (
                    "dla" in point["configuration"]["mods"]
                    and point["configuration"]["parameters"].get("length_source")
                    == "Declared exact ignore_eos output budgets, no learned predictor"
                )
                assert popup.locator(".frontier-popup-variant").count() == int(
                    is_known_budget
                )
                if is_known_budget:
                    assert (
                        "已知输出预算" if language == "zh" else "Known output budget"
                    ) in text
                    assert (
                        "准入容量检查已执行"
                        if language == "zh"
                        else "Admission capacity checks ran"
                    ) in text
                for metric in [
                    point["metrics"]["decode_p90_tps"],
                    point["metrics"]["output_tps"]
                    / point["configuration"]["hardware"]["accelerator_count"],
                ]:
                    # Browser Intl uses half-up rounding (147.125 ->147.13),
                    # unlike Python's half-even formatting. Preserve locale grouping.
                    formatted = page.evaluate(
                        "([value, locale]) => new Intl.NumberFormat(locale, "
                        "{maximumFractionDigits: 2}).format(value)",
                        [metric, language],
                    )
                    assert formatted in text, (point["id"], formatted, text)
                params = point["configuration"]["parameters"]
                assert_parallel(text, params, language)
                assert (
                    f"并发数: C{point['load']['concurrency']} · 会话轮转深度: D{point['load']['session_rotation_depth']}"
                    if language == "zh"
                    else f"Concurrency: C{point['load']['concurrency']} · Session rotation depth: D{point['load']['session_rotation_depth']}"
                ) in text
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
                download, previous_download = download_configuration(
                    page, popup, previous_download
                )
                file = args.output / f"{width}-{language}-{point['id']}.json"
                download.save_as(file)
                payload = json.loads(file.read_text())
                assert payload["point"] == point
                assert payload["cohort"] == production["cohorts"][0]
                assert payload["chart"]["x"] == "decode_p90_tps"
                assert payload["chart"]["y"] == "output_tps_per_chip"
                for source in point["configuration"].get("mod_sources", []):
                    link = page.locator(
                        f'.frontier-popup-mod-source a[href="{source["repository"]}/commit/{source["revision"]}"]'
                    )
                    assert link.inner_text() == source["revision"][:7]
                    assert (
                        payload["point"]["configuration"]["mod_sources"]
                        == point["configuration"]["mod_sources"]
                    )

                assert (
                    f"{point['evidence']['sampling_date_utc']} (UTC)"
                    in page.locator(".frontier-popup-date").inner_text()
                )

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
            assert page.locator("#runs-panel table:visible").count() == 0
            assert page.locator("#tasks-panel table:visible").count() == 0
            assert (
                page.locator(
                    "#frontier-agent-qualifications .agent-qualification-table:visible"
                ).count()
                == 1
            )
            page.locator("#langToggle").click()
            assert not page.locator("#frontier-only").is_checked()
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
                page.locator("#frontier-model-trigger").click()
                page.locator(".frontier-model-tag").nth(tag_keys.index(tag)).click()
                picker = page.locator("#frontier-workload")
                if picker.count():
                    picker.select_option(cohort["id"])
                assert page.locator("#frontier-workload-repo").get_attribute(
                    "href"
                ) == cohort["workload"]["contract"].get(
                    "repository_url", "https://github.com/vLLM-HUST/agentx-bench"
                )
                assert page.locator("#frontier-rotation-filter").count() == int(
                    "session_rotation" in cohort["workload"]["contract"]
                )
                assert not page.locator(".frontier-model-tag").first.is_visible()
                if cohort["model"]["label"] == "DeepSeek V4 Flash":
                    assert (
                        "INT8" in page.locator("#frontier-model-trigger").inner_text()
                    )
                    page.screenshot(
                        path=str(args.output / f"dsv4-{width}-{language}-{scheme}.png"),
                        full_page=True,
                    )
                contract = cohort["workload"]["contract"]
                shared_ids = set(contract.get("comparison_point_ids", []))
                members = [
                    p
                    for p in production["points"]
                    if p["cohort_id"] == cohort["id"] or p["id"] in shared_ids
                ]
                if contract.get("display_series_ids"):
                    members = [
                        p
                        for p in members
                        if p["load"].get("concurrency_series")
                        in contract["display_series_ids"]
                    ]
                if contract.get("display_series_prefix"):
                    members = [
                        p
                        for p in members
                        if p["load"]
                        .get("concurrency_series", "")
                        .startswith(contract["display_series_prefix"])
                    ]
                available_depths = sorted(
                    {
                        p["load"]["session_rotation_depth"]
                        for p in members
                        if isinstance(p["load"].get("session_rotation_depth"), int)
                    }
                )
                default_groups = set(contract.get("default_groups", []))
                if default_groups:
                    members = [
                        p
                        for p in members
                        if (
                            p.get("study_group", {}).get("id")
                            or p["load"].get("presentation_group", {}).get("id")
                            or p["configuration"].get("experiment_group")
                            or "+".join(sorted(p["configuration"]["mods"]))
                            or "none"
                        )
                        in default_groups
                    ]
                if "session_rotation" in cohort["workload"]["contract"]:
                    assert page.locator('[data-filter="rotation"]').count() == len(
                        available_depths
                    )
                    for depth in available_depths:
                        assert page.locator(
                            f'[data-filter="rotation"][value="{depth}"]'
                        ).is_checked()
                rendered_point_count = page.locator(".frontier-point").count()
                assert rendered_point_count == len(members), (
                    cohort["id"],
                    len(members),
                    rendered_point_count,
                )
                assert_concurrency_series(page, members, cohort)
                for point in members:
                    click_point(page, page.locator(f'[data-point="{point["id"]}"]'))
                    popup = page.locator("#frontier-popover")
                    text = popup.inner_text()
                    params = point["configuration"]["parameters"]
                    assert_parallel(text, params, language)
                    box = popup.bounding_box()
                    assert box["x"] >= 0 and box["x"] + box["width"] <= width
                    download, previous_download = download_configuration(
                        page, popup, previous_download
                    )
                    file = args.output / f"{width}-{language}-{point['id']}.json"
                    download.save_as(file)
                    payload = json.loads(file.read_text())
                    source_cohort = next(
                        c
                        for c in production["cohorts"]
                        if c["id"] == point["cohort_id"]
                    )
                    assert payload["point"] == point
                    assert payload["cohort"] == source_cohort
                    if point["id"] in shared_ids:
                        assert payload["comparison_cohort"] == cohort
                    else:
                        assert "comparison_cohort" not in payload
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
        assert not page.locator("#frontier-only").is_checked()
        assert page.locator(".frontier-model-tag").count() == 2
        assert page.locator("#frontier-workload option").count() == 2
        assert page.locator(".frontier-point").count() == 4
        assert_concurrency_series(page, fixture["points"][:4])
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
        page.locator("#frontier-model-trigger").click()
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
