"""Verify paired charts, compact target states, frozen MODs and details dialogs."""

import argparse
import copy
import hashlib
import json
import os
from decimal import ROUND_FLOOR, Decimal
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

SUMMARY = "data/five-datasets-r6-20261114/summary-public-v3.json"
HISTORY = "data/engine-release-history-v1.json"
SR = "data/sr-development-results-v1.json"
CONTROLLER = "data/controller-product-results-v1.json"
CONTROLLER_LATENCY = "data/controller-r8-latency-v1.json"
CONTROLLER_SUPPLEMENTS = {
    "fixed": "data/controller-r8-fixed-profiles-repeat-v1.json",
    "streaming": "data/controller-r8-streamed-heavy-load-v1.json",
    "context": "data/controller-r8-context-tenant-v1.json",
    "compute": "data/controller-r8-mmlu256-service-compute-v1.json",
    "c8": "data/controller-r8-closed-loop-c8-v1.json",
    "utilization": "data/controller-r8-ai-core-utilization-v1.json",
}
COMBINATION = "data/five-datasets-r6-20261114/frozen-combination-v1.json"


def assert_current_compute_reference(root, entry, lang):
    reference = entry.get("compute_reference")
    card = root.locator(".result-card").first
    if reference:
        lower = Decimal(reference["arms"]["B1"]["efficiency_lower_percent"])
        value = format(lower.quantize(Decimal("0.0001"), rounding=ROUND_FLOOR), ".4f")
        value = value.rstrip("0").rstrip(".")
        expect(card.locator("strong")).to_have_text("≥" + value + "%")
    else:
        expect(card.locator("strong")).to_have_text("—")
    button = root.locator('[data-detail="compute"]')
    button.click()
    dialog = root.locator("dialog")
    expect(dialog).to_be_visible()
    if reference:
        supplement = reference.get("full_answer_supplement")
        reuse = (
            reference["certificate_kind"]
            == "qualified_full_reference_denominator_reuse/v1"
        )
        expect(dialog.locator("table")).to_have_count(2 if supplement or reuse else 1)
        expect(dialog.locator("table").first.locator("tbody tr")).to_have_count(2)
        for role in ("B0", "B1"):
            expect(dialog).to_contain_text(reference["arms"][role]["T_seconds"])
        expect(dialog.locator("p").first).to_contain_text(
            str(reference["protocol"]["max_completion_tokens"])
        )
        if reference["protocol"]["formal_repetitions"] == 3:
            expect(dialog.locator("p").first).to_contain_text(
                "三轮" if lang == "zh" else "three formal"
            )
        if reuse:
            for role in ("B0", "B1"):
                expect(dialog).to_contain_text(
                    reference["arms"][role]["reference_seconds_lower"]
                )
                expect(dialog).to_contain_text(
                    reference["arms"][role]["reference_tflops_per_card_upper"]
                )
            expect(dialog).to_contain_text("finish(v)")
            expect(dialog).to_contain_text(
                "不约分" if lang == "zh" else "without cancellation"
            )
        else:
            expect(dialog).to_contain_text(
                "精确效率未知" if lang == "zh" else "Exact efficiency is unknown"
            )
        image = dialog.locator("img").first
        expect(image).to_be_visible()
        assert image.evaluate("el=>el.complete && el.naturalWidth>0")
        expect(
            dialog.locator('a[href="./' + reference["report"]["path"] + '"]')
        ).to_have_attribute("href", "./" + reference["report"]["path"])
        expect(
            dialog.locator('a[href="' + reference["raw_asset"]["url"] + '"]')
        ).to_have_attribute("href", reference["raw_asset"]["url"])
        if supplement:
            panel = dialog.locator("details").last
            panel.locator("summary").click()
            expect(panel).to_contain_text("8192")
            for role in ("B0", "B1"):
                expect(panel).to_contain_text(supplement["arms"][role]["T_seconds"])
            expect(panel.locator("img")).to_be_visible()
            assert panel.locator("img").evaluate("el=>el.complete && el.naturalWidth>0")
    else:
        expect(dialog.locator("img")).to_have_count(0)
        expect(dialog).to_contain_text("尚无已发布" if lang == "zh" else "no published")
    dialog.locator(".dialog-close").click()
    expect(button).to_be_focused()


def assert_release_control_readable(page, root):
    contrast = root.locator("#comparison-release-select").evaluate(
        """select => {
          const luminance = rgb => {
            const channels = rgb.match(/[0-9.]+/g).slice(0,3).map(Number)
              .map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
            return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
          };
          return [select,...select.options,...select.querySelectorAll("optgroup")].map(el=>{
            const css=getComputedStyle(el),a=luminance(css.color),b=luminance(css.backgroundColor);
            return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),background:css.backgroundColor};
          });
        }"""
    )
    assert all(c["ratio"] >= 4.5 for c in contrast), contrast
    assert all(c["background"] != "rgba(0, 0, 0, 0)" for c in contrast), contrast
    select = root.locator("#comparison-release-select")
    select.focus()
    assert select.evaluate("el=>getComputedStyle(el).outlineStyle") != "none"
    expect(select).to_be_focused()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+1")


def dashboard_layout(root):
    return root.evaluate(
        """el=>({summary:el.querySelector('.goal-grid').children.length,
          frozen:el.querySelectorAll('.frozen-profile').length,
          runtimes:el.querySelector('.runtime-pair').children.length,
          charts:el.querySelectorAll('.metric-grid>.metric-chart').length,
          columns:getComputedStyle(el.querySelector('.metric-grid')).gridTemplateColumns,
          dialogs:el.querySelectorAll('.comparison-dialog').length,
          supplements:el.querySelectorAll('#context-tenant-supplement').length,
          supplementCards:el.querySelectorAll('.supplement-highlights>div').length,
          profiles:[...el.querySelectorAll('.dataset-coverage [data-dataset]')].map(row=>row.dataset.dataset),
          chartProfiles:[...el.querySelectorAll('.metric-chart')].map(chart=>[...chart.querySelectorAll('.chart-row:not([data-profile=swe-smith-trajectory])')].slice(0,5).map(row=>row.dataset.profile))})"""
    )


def assert_controller_progress(page, root, publication, lang):
    button = root.locator('[data-detail="controller-progress"]')
    button.click()
    dialog = root.locator("dialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text(publication["engine_release"])
    expect(dialog).to_contain_text(
        f"{publication['result']['time_reduction_percent']:.2f}%"
    )
    expect(dialog.locator("table")).to_have_count(2)
    for row in publication["profiles"]:
        expect(dialog).to_contain_text(row["label_zh" if lang == "zh" else "label_en"])
    details = dialog.locator("details")
    details.locator("summary").click()
    for row in publication["changelog"]:
        expect(details).to_contain_text(row["zh" if lang == "zh" else "en"])
    page.keyboard.press("Escape")
    expect(dialog).not_to_be_visible()
    expect(button).to_be_focused()


def assert_sr(page, root, entry, layout, lang):
    release = entry["id"]
    page.goto(
        page.url.split("?")[0].split("#")[0]
        + f"?release={release}&comparison=development"
    )
    expect(root.locator("#comparison-release-select")).to_be_visible(timeout=30000)
    root.locator("#comparison-release-select").select_option(release)
    expect(root).to_have_attribute("data-release", release, timeout=30000)
    expect(root).to_have_attribute("data-baseline-id", "B1-r8")
    expect(page.locator("#comparison-title")).to_contain_text(f"B1-r8 / B1-{release}")
    expect(root.locator(".runtime-pair strong")).to_have_text(
        ["B1-r8", f"B1-{release}"]
    )
    assert dashboard_layout(root) == layout
    assert_release_control_readable(page, root)
    for row in entry["rows"]:
        bars = root.locator(
            f'[data-metric="output_tokens_per_second"] [data-profile="{row["id"]}"] .bar-value'
        )
        expect(bars).to_have_text(
            [f"{arm['output_tokens_per_second']:.2f}" for arm in row["arms"]]
        )
    expect(root.locator(".metric-missing")).to_have_count(16 if release == "sr1" else 0)
    if release == "sr2":
        expect(root.locator('[data-dataset="hle"]')).to_contain_text(
            "已发布跨卡对照" if lang == "zh" else "Published cross-card comparison"
        )
    button = root.locator('[data-detail="metrics"]')
    button.click()
    dialog = root.locator("dialog")
    expect(dialog).to_contain_text("E2E P95 / s")
    expect(dialog).to_contain_text("E2E P99 / s")
    page.keyboard.press("Escape")
    expect(button).to_be_focused()
    root.locator('[data-detail="quality"]').click()
    scored = next(row for row in entry["rows"] if row["id"] == "mmlu")
    for arm in scored["arms"]:
        expect(dialog).to_contain_text(f"{arm['correct']}/{arm['requests']}")
    page.keyboard.press("Escape")


def assert_controller_special(page, root, entry, layout, lang, latency, supplements):
    base = page.url.split("?")[0].split("#")[0]
    canonical = base + "?release=r8&controlplane=request-throttling"
    menu = root.locator("#comparison-release-select")
    baseline = root.locator("#comparison-baseline-select")
    control = root.locator("#comparison-controlplane-select")
    panel = root.locator("#controller-comparison")
    page.goto(base + "?release=r8")
    expect(control).to_have_value("")
    expect(menu.locator('option[value="sr5"]')).to_have_count(0)
    expect(panel).to_have_count(0)
    original = baseline.input_value()
    control.select_option("request-throttling")
    expect(page).to_have_url(canonical)
    expect(panel).to_have_attribute("data-engine-release", "r8")
    expect(root.locator(".release-selector + #controller-comparison")).to_have_count(1)
    expect(menu).to_have_value("r8")
    expect(baseline).to_have_value(original)
    menu.select_option("r6")
    expect(panel).to_have_attribute("data-engine-release", "r6")
    expect(panel.locator("#controller-trajectory-result")).to_contain_text("30.06%")
    menu.select_option("r9")
    expect(panel).not_to_have_attribute("data-engine-release", "r8")
    expect(panel).to_contain_text("B1 r9")
    expect(panel.locator(".metric-chart")).to_have_count(0)
    expect(control).to_have_value("request-throttling")
    expect(baseline).to_have_value(original)
    menu.select_option("r8")
    expect(panel).to_have_attribute("data-engine-release", "r8")
    alternate = next(
        value
        for value in baseline.locator("option").evaluate_all(
            "options=>options.map(option=>option.value)"
        )
        if value != original
    )
    baseline.select_option(alternate)
    expect(baseline).to_have_value(alternate)
    expect(panel).to_have_attribute("data-engine-release", "r8")
    control.select_option("")
    expect(panel).to_have_count(0)
    expect(baseline).to_have_value(alternate)

    for old in ("?release=sr5", "?release=sr5&comparison=development"):
        page.goto(base + old)
        expect(page).to_have_url(canonical)
        expect(panel).to_have_attribute("data-engine-release", "r8")
        expect(menu.locator('option[value="sr5"]')).to_have_count(0)
    root = panel
    fixed = supplements.get("fixed")
    streaming = supplements.get("streaming")
    context = supplements.get("context")
    compute = supplements.get("compute")
    c8 = supplements.get("c8")
    utilization = supplements.get("utilization")
    profiles = (
        [
            {**row, "label": old["label"]}
            for row, old in zip(fixed["profiles"], entry["profiles"], strict=True)
        ]
        if fixed
        else entry["profiles"]
    )
    expect(root.locator('[data-dataset="hle"]')).to_have_attribute(
        "data-available", "true" if fixed else "false"
    )
    performance = root.locator(":scope > .metric-grid")
    tpot_chart = performance.locator('[data-metric="mean_tpot_ms"]')
    if fixed:
        for profile in profiles:
            row = tpot_chart.locator(f'[data-profile="{profile["id"]}"]')
            expect(row.locator(".bar-value")).to_have_text(
                [
                    f"{profile[side]['time_per_output_token_ms']['mean']:.2f}"
                    for side in ("direct", "controller")
                ]
            )
        expect(tpot_chart.locator(".metric-missing")).to_have_count(
            0 if streaming or latency else 1
        )
    elif latency:
        timing = latency["fixed_profiles_client"]
        for dataset in timing["direct"]:
            row = tpot_chart.locator(f'[data-profile="{dataset}"]')
            expect(row.locator(".bar-value")).to_have_text(
                [
                    f"{timing[role][dataset]['mean_tpot_ms']:.2f}"
                    for role in ("direct", "controller")
                ]
            )
        expect(tpot_chart.locator(".metric-missing")).to_have_count(1)
    else:
        expect(tpot_chart.locator(".bar-fill")).to_have_count(0)
    cost_chart = performance.locator('[data-metric="relative_cost_per_token"]')
    expect(cost_chart.locator(".metric-missing")).to_have_count(0 if fixed else 1)
    for profile in profiles:
        if profile["status"] == "complete":
            ratio = (
                profile["direct"]["output_tokens_per_second"]
                / profile["controller"]["output_tokens_per_second"]
            )
            row = cost_chart.locator(f'[data-profile="{profile["id"]}"]')
            expect(row.locator(".bar-value")).to_have_text(["1.00", f"{ratio:.2f}"])
    result = entry["result"]
    a, b = result["direct"], result["request_throttling_controller"]
    if streaming:
        a, b = streaming["direct"], streaming["controller"]
    output_rates = [arm["output_tokens"] / arm["elapsed_seconds"] for arm in (a, b)]
    complete = [profile for profile in profiles if profile["status"] == "complete"]
    rate_pairs = [
        (
            profile["direct"]["output_tokens_per_second"],
            profile["controller"]["output_tokens_per_second"],
        )
        for profile in complete
    ] + [tuple(output_rates)]
    c8_pairs = {
        row["id"]: (
            row["direct"]["output_tokens_per_second"],
            row["controller"]["output_tokens_per_second"],
        )
        for row in (c8 or {}).get("rows", [])
    }
    context_pairs = {
        str(row["id"]): (
            row["direct"]["metrics"]["output_tokens_per_second"],
            row["controller"]["metrics"]["output_tokens_per_second"],
        )
        for row in (context or {}).get("phases", [])
    }
    peak = max(
        after / before
        for before, after in [*rate_pairs, *c8_pairs.values(), *context_pairs.values()]
    )
    context_16k = context_pairs.get("16384") or c8_pairs.get("16384-formal")
    expect(root.locator(".release-coverage-summary")).to_have_text(
        ("固定五项配对" if lang == "zh" else "Fixed-profile pairs")
        + f" {len(complete)}/5"
    )
    expect(root.locator(".result-card > span")).to_have_text(
        ["有效算力下界", "最高吞吐比", "16K 吞吐比", "最高同费率降幅"]
        if lang == "zh"
        else [
            "Effective compute bound",
            "Peak throughput ratio",
            "16K throughput ratio",
            "Best equal-rate cost reduction",
        ]
    )
    expect(root.locator(".result-card strong")).to_have_text(
        [
            "—",
            f"{peak:.2f}×",
            f"{context_16k[1] / context_16k[0]:.2f}×" if context_16k else "—",
            f"{100 * (1 - 1 / peak):.2f}%",
        ]
    )
    evidence = root.locator("#controller-trajectory-result")
    expect(evidence).to_contain_text("SWE Trace Heavy Load")
    clarification = root.locator(".chart-scale-note").first
    expect(clarification).to_contain_text("SWE trace64")
    expect(clarification).to_contain_text("SWE Trace Heavy Load")
    expect(clarification).not_to_contain_text("SWE-smith")
    expect(evidence).to_contain_text(
        f"{100 * (1 - b['elapsed_seconds'] / a['elapsed_seconds']):.2f}%"
    )
    cache = " → ".join(
        f"{arm['cached_input_percent']:.2f}%"
        if arm["cached_input_percent"] is not None
        else "—"
        for arm in (a, b)
    )
    expect(evidence).to_contain_text(cache)
    for chart in performance.locator(".metric-chart").all():
        expect(
            chart.locator(
                '[data-profile="swe"] + [data-profile="swe-smith-trajectory"]'
            )
        ).to_have_count(1)
    row = performance.locator(
        '[data-metric="output_tokens_per_second"] [data-profile="swe-smith-trajectory"]'
    )
    expect(row.locator(".bar-value")).to_have_text(
        [f"{rate:.2f}" for rate in output_rates]
    )
    cost_row = cost_chart.locator('[data-profile="swe-smith-trajectory"]')
    expect(cost_row.locator(".bar-value")).to_have_text(
        ["1.00", f"{output_rates[0] / output_rates[1]:.2f}"]
    )
    for metric, divisor in (("mean_ttft_ms", 1000), ("mean_tpot_ms", 1)):
        row = performance.locator(
            f'[data-metric="{metric}"] [data-profile="swe-smith-trajectory"]'
        )
        if streaming:
            expect(row.locator(".bar-value")).to_have_text(
                [f"{arm[metric] / divisor:.2f}" for arm in (a, b)]
            )
        elif latency:
            engine = latency["multi_turn_engine"]
            expect(row.locator(".metric-change")).to_contain_text(
                "引擎侧" if lang == "zh" else "Engine-side"
            )
            expect(row.locator(".bar-value")).to_have_text(
                [
                    f"{engine[role][metric] / divisor:.2f}"
                    for role in ("direct", "controller")
                ]
            )
        else:
            expect(row).to_have_attribute("data-missing", "true")
    if context:
        expect(root.locator("#controller-context-tenant .metric-chart")).to_have_count(
            4
        )
    if c8:
        for summary in c8["rows"]:
            row = performance.locator(
                f'[data-metric="output_tokens_per_second"] [data-profile="{summary["id"]}"]'
            )
            expect(row.locator(".bar-value")).to_have_text(
                [
                    f"{summary[side]['output_tokens_per_second']:.2f}"
                    for side in ("direct", "controller")
                ]
            )
    if utilization:
        device_chart = root.locator('[data-metric="ai_core_utilization_percent"]')
        expect(device_chart.locator(".chart-row")).to_have_count(
            len(utilization["rows"])
        )
        for dataset, pair in utilization["rows"].items():
            displayed = "swe-smith-trajectory" if dataset == "swe-heavy" else dataset
            row = device_chart.locator(f'[data-profile="{displayed}"]')
            expect(row.locator(".bar-value")).to_have_text(
                [
                    f"{pair[side]['mean_percent']:.2f}"
                    if pair[side]["coverage_complete"]
                    else "—"
                    for side in ("direct", "controller")
                ]
            )
    root.locator('[data-detail="metrics"]').click()
    dialog = root.locator("dialog")
    expect(dialog).to_be_visible()
    expect(dialog.locator("tbody tr").nth(4)).to_contain_text("SWE Trace Heavy Load")
    if compute:
        lower = compute["arms"]["controller"]["target_matrix_tflops_per_card_lower"]
        expect(dialog).to_contain_text(f"≥{int(100 * lower) / 100:.2f}")
    if latency:
        engine = latency["multi_turn_engine"]
        engine_table = dialog.locator("table").filter(
            has_text="引擎侧首 token 时延"
            if lang == "zh"
            else "Engine time to first token"
        )
        for index, (metric, divisor) in enumerate(
            (("mean_ttft_ms", 1000), ("mean_tpot_ms", 1))
        ):
            expect(
                engine_table.locator("tbody tr").nth(index).locator("td")
            ).to_have_text(
                [
                    f"{engine[role][metric] / divisor:.2f}"
                    for role in ("direct", "controller")
                ]
            )
    for profile in profiles:
        row = (
            dialog.locator("table")
            .first.locator("tbody tr")
            .filter(has_text=profile["label"])
        )
        if profile["status"] == "complete":
            expect(row).to_contain_text(f"{profile['time_reduction_percent']:.2f}%")
        else:
            expect(row).to_contain_text(profile[f"reason_{lang}"])
    if fixed and streaming and c8:
        tails = dialog.locator("table").filter(
            has_text="端到端 P99" if lang == "zh" else "End-to-end P99"
        )
        expect(tails.locator("tbody tr")).to_have_count(16)
        assert all(
            value != "—" for value in tails.locator("tbody td").all_text_contents()
        )
    page.keyboard.press("Escape")
    expect(root.locator('[data-detail="metrics"]')).to_be_focused()
    root.locator('[data-detail="methods"]').click()
    expect(dialog.locator('a[href*="news.smm.cn"]')).to_have_count(1)
    expect(
        dialog.locator("tbody tr").filter(has_text="SWE Trace Heavy Load")
    ).to_contain_text(f"{1875 * 2e6 / (30 * 86400 * output_rates[1]):.2f}")
    page.keyboard.press("Escape")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    control.select_option("")
    expect(panel).to_have_count(0)
    assert dashboard_layout(page.locator("#five-dataset-comparison")) == layout


def assert_model_integration(page, root, entry, url, lang):
    # Keep the same dashboard, showing actual B1 values without inventing a
    # fixed-B0 pair or substituting an older optimized engine as the control.
    expect(root.locator("[data-model-integration]")).to_have_count(0)
    descriptor = entry.get("model_integration")
    if (
        not descriptor
        or entry.get("measurements")
        or entry.get("context_tenant_supplement")
    ):
        return
    data = page.request.get(url + "/" + descriptor["summary"]["path"]).json()
    expect(root).to_have_attribute("data-baseline-id", "original018-cann8.5.1")
    expect(root.locator(".runtime-pair strong")).to_have_text(
        ["B0", "B1 · " + entry["id"]]
    )
    expect(root.locator(".runtime-pair>div").first).to_contain_text("0.18")
    expect(root.locator(".runtime-pair>div").first).to_contain_text("8.5.1")
    expect(root.locator(".fixed-b0-identity")).to_contain_text(
        "B0 · vLLM0.18 / Ascend0.18"
    )
    expect(page.locator("#comparison-title")).to_contain_text("B0 / B1 " + entry["id"])
    expect(page.locator("#comparison-lead")).to_contain_text(data["candidate"]["model"])
    expect(root.locator(".metric-chart")).to_have_count(4)
    expect(root.locator(".dataset-coverage [data-available='true']")).to_have_count(0)
    expect(root.locator(".dataset-coverage [data-dataset=mmlu]")).to_contain_text(
        "B0 已测 · B1 已测" if lang == "zh" else "B0 measured · B1 measured"
    )
    expect(root.locator(".result-card strong")).to_have_text(["—"] * 4)
    catalog = page.request.get(url + "/" + HISTORY).json()
    baseline = page.request.get(
        url + "/" + catalog["baseline"]["observations"]["path"]
    ).json()
    originals = {row["id"]: row["arm"] for row in baseline["profiles"]}
    expect(root.locator(".dataset-coverage [data-b0-available=true]")).to_have_count(5)
    expect(root.locator(".metric-grid .bar-value")).to_have_count(56)
    expect(root.locator(".metric-missing")).to_have_count(0)
    expect(root.locator("[data-baseline-observation=verified]")).to_have_count(20)
    expect(root.locator("[data-fixed-b0-context]")).to_have_count(1)
    for row in data["workloads"]:
        profile = "mmlu" if row["id"] == "mmlu200" else row["id"]
        for metric, divisor in [
            ("output_tokens_per_second", 1),
            ("mean_ttft_ms", 1000),
            ("mean_tpot_ms", 1),
            ("relative_cost_per_token", 1),
        ]:
            record = root.locator(
                f'[data-metric="{metric}"] [data-profile="{profile}"]'
            )
            value = (
                "—"
                if metric == "relative_cost_per_token"
                else f"{row['candidate'][metric] / divisor:.2f}"
            )
            original = originals.get(profile)
            before = (
                f"{1 if metric == 'relative_cost_per_token' else original[metric] / divisor:.2f}"
                if original
                else "—"
            )
            expect(record.locator(".bar-value")).to_have_text([before, value])
            expect(record.locator(".bar-role")).to_have_text(["B0", "B1"])
    for profile, original in originals.items():
        for metric, divisor in [
            ("output_tokens_per_second", 1),
            ("mean_ttft_ms", 1000),
            ("mean_tpot_ms", 1),
        ]:
            record = root.locator(
                f'[data-metric="{metric}"] [data-profile="{profile}"]'
            )
            expect(record.locator(".bar-value").first).to_have_text(
                f"{original[metric] / divisor:.2f}"
            )
            expect(record.locator(".bar-fill.b0")).to_have_count(1)
    supplement = root.locator("#context-tenant-supplement")
    expect(supplement.locator(".supplement-highlights strong")).to_have_text(["—"] * 3)
    for row in data["workloads"]:
        if row["id"].startswith("continuous-"):
            expect(supplement).to_contain_text(
                f"{row['candidate']['output_tokens_per_second']:.2f}"
            )
    for detail in (
        "metrics",
        "quality",
        "methods",
        "supplement",
        "evidence",
        "compute",
    ):
        root.locator(f'[data-detail="{detail}"]').click()
        dialog = root.locator("dialog")
        expect(dialog).to_be_visible()
        if detail == "compute":
            expect(dialog.locator("[data-fixed-b0-compute]")).to_have_count(1)
            expect(dialog).to_contain_text(str(baseline["compute"]["arm"]["T_seconds"]))
            efficiency = Decimal(
                baseline["compute"]["arm"]["efficiency_lower_percent"]
            ).quantize(Decimal("0.0001"), rounding=ROUND_FLOOR)
            expect(dialog).to_contain_text(str(efficiency.normalize()) + "%")
            expect(dialog.locator("[data-fixed-b0-compute]")).not_to_contain_text("—%")
        elif detail == "quality":
            expect(dialog).to_contain_text(
                f"{data['quality']['correct']}/{data['quality']['requests']}"
            )
            expect(dialog).to_contain_text("17")
            expect(dialog).to_contain_text("0 / 0")
        elif detail == "metrics":
            for row in data["workloads"]:
                expect(dialog).to_contain_text(
                    f"{row['candidate']['output_tokens_per_second']:.2f}"
                )
        elif detail == "evidence":
            expect(dialog.locator("[data-development-evidence]")).to_have_attribute(
                "href", entry["release_url"]
            )
        page.keyboard.press("Escape")

    button = root.locator('[data-detail="development"]')
    expect(button).to_have_attribute("id", "development-comparison")
    expect(root.locator('a[href$="#development-comparison"]')).to_have_count(1)
    button.click()
    dialog = root.locator("dialog")
    expect(dialog).to_be_visible()
    section = dialog.locator("[data-development-comparison]")
    expect(section).to_have_attribute("data-development-comparison", entry["id"])
    expect(dialog.locator("h2")).to_contain_text(
        "非正式基线" if lang == "zh" else "not the formal baseline"
    )
    for arm in ("candidate", "reference"):
        expect(section).to_contain_text(data[arm]["model"])
    expect(section).to_contain_text("0.18")
    expect(section).to_contain_text(data["tradeoffs_" + lang])
    expect(section).to_contain_text(
        f"{data['quality']['correct']}/{data['quality']['requests']}"
    )
    reference = data["reference"]["release"].split("-")[-1]
    for i, row in enumerate(data["workloads"]):
        for j, arm in enumerate(("reference", "candidate")):
            a = row[arm]
            values = [reference if arm == "reference" else entry["id"]]
            for key, divisor in [
                ("output_tokens_per_second", 1),
                ("mean_ttft_ms", 1000),
                ("mean_tpot_ms", 1),
                ("ttft_p95_ms", 1),
                ("ttft_p99_ms", 1),
                ("tpot_p95_ms", 1),
                ("tpot_p99_ms", 1),
            ]:
                values.append(f"{a[key] / divisor:.2f}" if key in a else "—")
            expect(
                section.locator("table")
                .first.locator("tbody tr")
                .nth(2 * i + j)
                .locator("td")
            ).to_have_text(values)
        values = [
            f"{row['change_percent'][key]:+.2f}%"
            for key in ("output_tokens_per_second", "mean_ttft_ms", "mean_tpot_ms")
        ]
        expect(
            section.locator("table").nth(1).locator("tbody tr").nth(i).locator("td")
        ).to_have_text(values)
    image = section.locator("img")
    expect(image).to_have_attribute("src", "./" + descriptor["chart"]["path"])
    assert image.evaluate("async el=>{await el.decode();return el.naturalWidth>0}")
    expect(
        section.locator('a[href="./' + descriptor["summary"]["path"] + '"]')
    ).to_have_count(1)
    expect(section.locator('a[href="' + entry["release_url"] + '"]')).to_have_count(1)
    page.keyboard.press("Escape")
    expect(button).to_be_focused()
    expect(root.locator(".result-card strong")).to_have_text(["—"] * 4)
    catalog = page.request.get(url + "/" + HISTORY).json()
    baseline = page.request.get(
        url + "/" + catalog["baseline"]["observations"]["path"]
    ).json()
    originals = {row["id"]: row["arm"] for row in baseline["profiles"]}
    expect(root.locator(".dataset-coverage [data-b0-available=true]")).to_have_count(5)
    expect(root.locator(".metric-grid .bar-value")).to_have_count(56)
    expect(root.locator(".metric-grid .bar-fill.b0")).to_have_count(20)
    expect(root.locator(".metric-grid .bar-fill.b1")).to_have_count(3)
    expect(root.locator(".metric-change")).to_have_count(0)


def latest_official_release(catalog):
    return max(
        (
            entry["id"]
            for entry in catalog["entries"]
            if entry.get("publication_status") != "frozen-candidate"
        ),
        key=lambda value: int(value[1:]),
    )


def assert_paired_version(page, root, entry, catalog):
    expect(root).to_have_attribute("data-baseline-id", catalog["baseline"]["id"])
    fixed = {"mmlu", "hle", "frontier", "swe", "terminal"}
    expect(root.locator('.dataset-coverage [data-available="true"]')).to_have_count(
        sum(row["id"] in fixed for row in entry["measurements"])
    )
    chart = root.locator('[data-metric="output_tokens_per_second"]')
    for row in entry["measurements"]:
        expect(chart.locator(f'[data-profile="{row["id"]}"] .bar-value')).to_have_text(
            [f"{arm['output_tokens_per_second']:.2f}" for arm in row["arms"]]
        )
    root.locator('[data-detail="quality"]').click()
    dialog = root.locator("dialog")
    for row in entry["measurements"]:
        for arm in row["arms"]:
            if "correct" in arm:
                expect(dialog).to_contain_text(f"{arm['correct']}/{arm['requests']}")
    page.keyboard.press("Escape")
    root.locator('[data-detail="evidence"]').click()
    for row in entry["measurements"]:
        for arm in row["arms"]:
            if "ttft_p99_ms" in arm:
                expect(dialog).to_contain_text(f"{arm['ttft_p99_ms']:.2f}")
    page.keyboard.press("Escape")


def assert_submission_assessment(page, root, entry, url, lang):
    descriptor = entry["submission_assessment"]
    response = page.request.get(url + "/" + descriptor["path"])
    assert response.ok
    payload = response.body()
    assert hashlib.sha256(payload).hexdigest() == descriptor["sha256"]
    targets = json.loads(payload)["targets"]
    coverage = root.locator(".dataset-coverage")
    expect(coverage.locator("[data-available=true]")).to_have_count(5)
    expect(root.locator(".release-coverage-summary")).to_contain_text("5/5")
    chart = root.locator('[data-metric="output_tokens_per_second"]')
    for row in entry["measurements"]:
        before, after = (arm["physical_cards"] for arm in row["arms"])
        values = f"B0 {before} → B1 {after}"
        mode = "matched" if set(before) == set(after) else "cross-card"
        record = chart.locator(f'[data-profile="{row["id"]}"]')
        expect(record).to_have_attribute("data-card-comparison", mode)
        expect(record).to_contain_text(values)
        if row["id"] in {"mmlu", "hle", "frontier", "swe", "terminal"}:
            cell = coverage.locator(f'[data-dataset="{row["id"]}"]')
            expect(cell).to_have_attribute("data-card-comparison", mode)
            expect(cell).to_contain_text(values)
    for row in entry["context_tenant_supplement"]["comparisons"]:
        before, after = (row[role]["physical_cards"] for role in ("B0", "B1"))
        record = chart.locator(f'[data-profile="real-context-{row["phase"]}"]')
        expect(record).to_have_attribute(
            "data-card-comparison",
            "matched" if set(before) == set(after) else "cross-card",
        )
        expect(record).to_contain_text(f"B0 {before} → B1 {after}")
    supplement = root.locator("#context-tenant-supplement")
    expect(supplement).to_have_attribute("data-source-release", entry["id"])
    image = supplement.locator("img")
    assert image.evaluate("async el=>{await el.decode();return el.naturalWidth>0}")

    assessment = root.locator("#submission-v2")
    for index, goal in enumerate(("4.1", "4.2", "4.3", "4.4")):
        cells = (
            assessment.locator("table")
            .first.locator("tbody tr")
            .nth(index)
            .locator("td")
        )
        for column, stage in enumerate(("milestone", "final")):
            passed = targets[goal][stage]["met"]
            status = (
                ("达成目标" if passed else "未达成目标")
                if lang == "zh"
                else ("Target met" if passed else "Target not met")
            )
            cell = cells.nth(column)
            expect(cell).to_contain_text(status)
            if passed and lang == "zh":
                expect(cell).not_to_contain_text("未达成目标")

    panel = assessment.locator("details[data-rental-cost]")
    panel.locator("summary").click()
    quote = targets["4.4"]["rental_quote"]
    expect(panel.get_by_role("link")).to_have_attribute("href", quote["url"])
    expect(panel).to_contain_text(quote["provider"])
    expect(panel).to_contain_text(quote["checked_date"])
    expect(panel).to_contain_text(f"{float(quote['cny_per_card_month']):.2f}")
    for index, workload in enumerate(("mmlu", "four_tenant")):
        evidence = targets["4.4"]["formal_cost"][workload]
        row = panel.locator("tbody tr").nth(index)
        for role in ("B0", "B1"):
            arm = evidence["arms"][role]
            unit = (
                1e6
                * float(quote["cny_per_card_month"])
                * arm["occupied_cards"]
                * float(arm["window_seconds"])
                / (30 * 86400 * arm["successful_output_tokens"])
            )
            expect(row).to_contain_text(f"{unit:.2f}")
        expect(row).to_contain_text(f"{float(evidence['reduction_percent']):.2f}%")
    panel.locator("summary").click()
    if entry.get("submission_report"):
        expect(
            assessment.locator('[href="./' + entry["submission_report"]["path"] + '"]')
        ).to_be_visible()
    assert_current_compute_reference(root, entry, lang)


def context_supplement(catalog):
    return next(row for row in catalog["entries"] if row["id"] == "r8")[
        "context_tenant_supplement"
    ]


def verify(url, output):
    output.mkdir(parents=True, exist_ok=True)
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("VLLMHUST_BROWSER_EXECUTABLE")
        )
        context = browser.new_context()
        controller = context.request.get(
            url + "/data/controller-experiment-progress-v1.json"
        ).json()
        data = context.request.get(url + "/" + SUMMARY).json()
        combo = context.request.get(url + "/" + COMBINATION).json()
        catalog = context.request.get(url + "/" + HISTORY).json()
        manifest = context.request.get(
            url + "/data/benchmark-source-manifest.json"
        ).json()
        r8 = context.request.get(
            url + "/data/r8-continuous-20261117/summary-v1.json"
        ).json()
        sr = context.request.get(url + "/" + SR).json()
        controller_catalog = context.request.get(url + "/" + CONTROLLER).json()
        latency_response = context.request.get(url + "/" + CONTROLLER_LATENCY)
        controller_latency = latency_response.json() if latency_response.ok else None
        controller_supplements = {}
        for label, path in CONTROLLER_SUPPLEMENTS.items():
            response = context.request.get(url + "/" + path)
            if response.ok:
                controller_supplements[label] = response.json()
        controller_special = next(
            row for row in controller_catalog["releases"] if row["id"] == "r8"
        )
        for lang in ("zh", "en"):
            for width in (390, 1440):
                for theme in ("light", "dark"):
                    page = context.new_page()
                    page.set_viewport_size({"width": width, "height": 1000})
                    page.emulate_media(color_scheme=theme)
                    page.add_init_script(
                        f"localStorage.setItem('vllm-hust_lang','{lang}')"
                    )
                    errors = []
                    page.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
                    page.goto(url + "/b0-b1.html")
                    root = page.locator("#five-dataset-comparison")
                    latest = latest_official_release(catalog)
                    expect(root).to_have_attribute(
                        "data-release", latest, timeout=30000
                    )
                    current = next(
                        row for row in catalog["entries"] if row["id"] == latest
                    )
                    if current.get("model_integration"):
                        assert_model_integration(page, root, current, url, lang)
                    if current.get("measurements") or not current.get(
                        "model_integration"
                    ):
                        assert_paired_version(page, root, current, catalog)
                    if current.get("submission_assessment"):
                        assert_submission_assessment(page, root, current, url, lang)
                    assert_release_control_readable(page, root)
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth+1"
                    )
                    page.screenshot(
                        path=str(output / f"latest-{lang}-{width}-{theme}.png"),
                        full_page=True,
                    )
                    page.goto(url + "/b0-b1.html?release=r8")
                    root = page.locator("#five-dataset-comparison")
                    expect(root).to_have_attribute("data-release", "r8", timeout=30000)
                    expect(root.locator(".goal-card")).to_have_count(0)
                    expect(root.locator("#r8-current-continuous")).to_be_visible()
                    expect(root.locator("#report-history-links")).to_have_count(0)
                    expect(root.locator(".metric-chart")).to_have_count(4)
                    expect(root.locator(".bar-value")).to_have_count(
                        56
                        + 8
                        * len(
                            next(
                                row for row in catalog["entries"] if row["id"] == "r8"
                            )["context_tenant_supplement"]["comparisons"]
                        )
                    )
                    expect(root.locator(".mod-tags span")).to_have_count(10)
                    assert_release_control_readable(page, root)
                    assert_controller_progress(page, root, controller, lang)
                    workload = (
                        "闭环连续压测 · 并发 8"
                        if lang == "zh"
                        else "Closed-loop continuous stress test · concurrency 8"
                    )
                    for phase in ("4096-formal", "16384-formal"):
                        labels = root.locator(
                            f'.metric-chart [data-profile="{phase}"] .chart-workload-label'
                        )
                        expect(labels).to_have_count(4)
                        expect(labels).to_have_text([workload] * 4)
                    expect(
                        root.locator('[data-profile="mmlu"] .chart-workload-label')
                    ).to_have_count(0)
                    r8_layout = dashboard_layout(root)
                    assert r8_layout["profiles"] == [
                        "mmlu",
                        "hle",
                        "frontier",
                        "swe",
                        "terminal",
                    ]
                    assert r8_layout["chartProfiles"] == [r8_layout["profiles"]] * 4
                    expect(root.locator(".metric-missing .bar-fill")).to_have_count(0)
                    expect(root.locator(".metric-missing .bar-value")).to_have_count(0)
                    for key, divisor in [
                        ("output_tokens_per_second", 1),
                        ("mean_ttft_ms", 1000),
                        ("mean_tpot_ms", 1),
                        ("relative_cost_per_token", 1),
                    ]:
                        for phase in ("4096-formal", "16384-formal"):
                            values = root.locator(
                                f'[data-metric="{key}"] [data-profile="{phase}"] .bar-value'
                            )
                            expected = []
                            for role in ("B0", "B1"):
                                value = (
                                    r8["groups"]["B0"][phase][
                                        "output_tokens_per_second"
                                    ]
                                    / r8["groups"][role][phase][
                                        "output_tokens_per_second"
                                    ]
                                    if key == "relative_cost_per_token"
                                    else r8["groups"][role][phase][key] / divisor
                                )
                                expected.append(f"{value:.2f}")
                            expect(values).to_have_text(expected)
                    published_r8 = next(
                        row for row in catalog["entries"] if row["id"] == "r8"
                    )
                    assert_current_compute_reference(root, published_r8, lang)
                    expect(
                        root.locator('.dataset-coverage [data-available="true"]')
                    ).to_have_count(5)
                    expect(root.locator(".metric-missing")).to_have_count(0)
                    for row in published_r8["measurements"]:
                        for key, divisor in [
                            ("output_tokens_per_second", 1),
                            ("mean_ttft_ms", 1000),
                            ("mean_tpot_ms", 1),
                            ("relative_cost_per_token", 1),
                        ]:
                            values = root.locator(
                                f'[data-metric="{key}"] [data-profile="{row["id"]}"] .bar-value'
                            )
                            expected = [
                                f"{(row['arms'][0]['output_tokens_per_second'] / arm['output_tokens_per_second'] if key == 'relative_cost_per_token' else arm[key] / divisor):.2f}"
                                for arm in row["arms"]
                            ]
                            expect(values).to_have_text(expected)
                    extra = published_r8["context_tenant_supplement"]
                    supplement = root.locator("#context-tenant-supplement")
                    expect(supplement).to_have_attribute("data-source-release", "r8")
                    for row in extra["comparisons"]:
                        for key, divisor in [
                            ("output_tokens_per_second", 1),
                            ("mean_ttft_ms", 1000),
                            ("mean_tpot_ms", 1),
                            ("relative_cost_per_token", 1),
                        ]:
                            bars = root.locator(
                                f'[data-metric="{key}"] [data-profile="real-context-{row["phase"]}"] .bar-value'
                            )
                            values = []
                            for role in ("B0", "B1"):
                                metrics = row[role]["metrics"]
                                value = (
                                    row["B0"]["metrics"]["output_tokens_per_second"]
                                    / metrics["output_tokens_per_second"]
                                    if key == "relative_cost_per_token"
                                    else (
                                        metrics["ttft_ms"]["mean"]
                                        if key == "mean_ttft_ms"
                                        else metrics["tpot_ms"]["mean"]
                                        if key == "mean_tpot_ms"
                                        else metrics[key]
                                    )
                                    / divisor
                                )
                                values.append(f"{value:.2f}")
                            expect(bars).to_have_text(values)
                    image = supplement.locator("img")
                    image.scroll_into_view_if_needed()
                    assert image.evaluate(
                        "async el=>{await el.decode();return el.naturalWidth>0}"
                    )
                    supplement.locator('[data-detail="supplement"]').click()
                    dialog = root.locator("dialog")
                    expect(dialog.locator("table")).to_have_count(2)
                    for row in extra["comparisons"]:
                        expect(dialog).to_contain_text(
                            f"{row['B0']['metrics']['requests']} / {row['B1']['metrics']['requests']}"
                        )
                    expect(dialog).to_contain_text(extra["raw_asset"]["sha256"])
                    page.keyboard.press("Escape")
                    for key in ("metrics", "configuration", "methods", "evidence"):
                        button = root.locator(f'[data-detail="{key}"]')
                        button.click()
                        dialog = root.locator("dialog")
                        expect(dialog).to_be_visible()
                        if key == "metrics":
                            expect(dialog.locator("table")).to_have_count(4)
                        elif key == "configuration":
                            expect(dialog).to_contain_text("E36/R54")
                        elif key == "evidence":
                            assert dialog.locator("img").evaluate(
                                "async el=>{await el.decode();return el.naturalWidth>0}"
                            )
                        page.keyboard.press("Escape")
                        expect(dialog).not_to_be_visible()
                        expect(button).to_be_focused()
                    page.evaluate("window.scrollTo(0,0)")
                    page.screenshot(
                        path=str(output / f"r8-{lang}-{width}-{theme}.png"),
                        full_page=True,
                    )
                    expect(
                        root.locator("#comparison-release-select optgroup option")
                    ).to_have_count(
                        len(catalog["order"])
                        + len(catalog["attempt_order"])
                        + len(sr["entries"])
                    )
                    for entry in sr["entries"]:
                        assert_sr(page, root, entry, r8_layout, lang)
                    assert_controller_special(
                        page,
                        root,
                        controller_special,
                        r8_layout,
                        lang,
                        controller_latency,
                        controller_supplements,
                    )
                    for release, controls, values in [
                        ("r1", [], []),
                        ("r2", [], []),
                        ("r3", [], []),
                        ("r4", ["B0", "B1"], ["495.84", "944.47"]),
                        ("r5", [], []),
                        ("r7", ["B0", "B1"], ["126.72", "385.30"]),
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
                        assert dashboard_layout(root) == r8_layout
                        assert_release_control_readable(page, root)
                        expect(root.locator(".metric-missing .bar-fill")).to_have_count(
                            0
                        )
                        expect(
                            root.locator(".metric-missing .bar-value")
                        ).to_have_count(0)
                        if controls:
                            expect(root).to_have_attribute(
                                "data-baseline-id", "original018-cann8.5.1"
                            )
                            chart = root.locator(
                                '[data-metric="output_tokens_per_second"]'
                            )
                            expect(
                                chart.locator(
                                    ".chart-row:not([data-baseline-observation]) .bar-role"
                                ).nth(0)
                            ).to_have_text(controls[0])
                            expect(
                                chart.locator(
                                    ".chart-row:not([data-baseline-observation]) .bar-role"
                                ).nth(1)
                            ).to_have_text(controls[1])
                            expect(
                                chart.locator(
                                    ".chart-row:not([data-baseline-observation]) .bar-value"
                                ).nth(0)
                            ).to_have_text(values[0])
                            expect(
                                chart.locator(
                                    ".chart-row:not([data-baseline-observation]) .bar-value"
                                ).nth(1)
                            ).to_have_text(values[1])
                        else:
                            expect(root.locator(".metric-chart")).to_have_count(4)
                            expect(root.locator(".metric-missing")).to_have_count(0)
                            expect(root.locator(".bar-value")).to_have_count(40)
                            if release == "r5":
                                expect(root).to_contain_text(
                                    "ready" if lang == "zh" else "readiness"
                                )
                        if release in ("r1", "r2", "r3"):
                            expect(
                                root.locator(
                                    '.dataset-coverage [data-b0-available="true"][data-b1-available="false"]'
                                )
                            ).to_have_count(5)
                            root.locator('[data-detail="evidence"]').click()
                            expect(root.locator("dialog")).to_contain_text(
                                "continuous-b1-packed-" + release
                            )
                            page.keyboard.press("Escape")
                        if release == "r7":
                            root.locator('[data-detail="quality"]').click()
                            expect(root.locator(".historical-quality")).to_contain_text(
                                "138/200"
                            )
                            page.keyboard.press("Escape")
                            root.locator('[data-detail="evidence"]').click()
                            expect(root.locator("dialog")).to_contain_text("8742.65")
                            page.keyboard.press("Escape")
                        assert page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth+1"
                        )
                        page.evaluate("window.scrollTo(0,0)")
                        page.screenshot(
                            path=str(output / f"{release}-{lang}-{width}-{theme}.png"),
                            full_page=True,
                        )
                    for entry in catalog["entries"]:
                        if entry["id"] in {"r4", "r5", "r6", "r7", "r8"}:
                            continue
                        root.locator("#comparison-release-select").select_option(
                            entry["id"]
                        )
                        expect(root).to_have_attribute(
                            "data-release", entry["id"], timeout=30000
                        )
                        if entry.get("model_integration"):
                            assert dashboard_layout(root) == r8_layout
                            assert_model_integration(page, root, entry, url, lang)
                        if entry.get("measurements") or not entry.get(
                            "model_integration"
                        ):
                            assert_paired_version(page, root, entry, catalog)
                        if entry.get("submission_assessment") and entry["id"] != latest:
                            assert_submission_assessment(page, root, entry, url, lang)
                        assert_release_control_readable(page, root)
                        expect(root.locator(".metric-missing .bar-fill")).to_have_count(
                            0
                        )
                        page.screenshot(
                            path=str(
                                output / f"{entry['id']}-{lang}-{width}-{theme}.png"
                            ),
                            full_page=True,
                        )
                    # Rapid switching must not leave the integration data on another version.
                    root.locator("#comparison-release-select").select_option("r8")
                    expect(root).to_have_attribute("data-release", "r8", timeout=30000)
                    expect(root.locator("[data-model-integration]")).to_have_count(0)
                    expect(root).to_have_attribute(
                        "data-baseline-id", "original018-cann8.5.1"
                    )
                    expect(root.locator(".runtime-pair strong")).to_have_text(
                        ["B0", "B1 · r8"]
                    )
                    root.locator("#comparison-release-select").select_option("r6")
                    expect(root).to_have_attribute("data-release", "r6", timeout=30000)
                    expect(page.locator("#comparison-title")).to_contain_text("r6")
                    expect(root).to_have_attribute(
                        "data-loaded", data["run_id"], timeout=30000
                    )
                    assert dashboard_layout(root) == r8_layout
                    assert_release_control_readable(page, root)
                    assert_controller_progress(page, root, controller, lang)
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
                    replay = (
                        "Terminal-Bench 2.1 离线请求回放 · 并发 8"
                        if lang == "zh"
                        else "Terminal-Bench 2.1 offline request replay · concurrency 8"
                    )
                    label = supplement.locator(".supplement-workload-label")
                    expect(label).to_be_visible()
                    expect(label).to_contain_text(replay)
                    for band in ("4K–8K", "16K–24K", "32K–48K"):
                        expect(label).to_contain_text(band)
                    image = supplement.locator("img")
                    assert image.evaluate(
                        "async el=>{await el.decode();return el.naturalWidth>0}"
                    )
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
                        {
                            "language": lang,
                            "width": width,
                            "theme": theme,
                            "verified": "matching release layouts,56 r8 and40 r6 values,five completed r8 pairs,MODs,contrast,dialogs and keyboard",
                        }
                    )
                    page.close()
        sr_ids = [entry["id"] for entry in sr["entries"]]
        for release in (*catalog["attempt_order"], *catalog["order"], *sr_ids):
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
            checks.append({"direct_release": release, "language_switch": True})
        # A new catalog-only release keeps the same empty dashboard without a JS edit.
        future = copy.deepcopy(context.request.get(url + "/" + HISTORY).json())
        future_id = "r" + str(max(int(value[1:]) for value in catalog["order"]) + 1)
        entry = copy.deepcopy(
            next(row for row in future["entries"] if row["id"] == "r5")
        )
        entry.update(
            id=future_id,
            release=f"full-answer-b1-catalog-test-{future_id}",
            release_url=f"https://github.com/vLLM-HUST/vllm-hust-engine/releases/tag/catalog-test-{future_id}",
        )
        future["entries"].append(entry)
        future["order"].insert(0, future_id)
        future["default_release"] = (
            "r8"  # A stale advisory default must not pin the main URL.
        )
        raw = (json.dumps(future, ensure_ascii=False) + "\n").encode()
        updated = copy.deepcopy(manifest)
        published = next(
            row for row in updated["files"] if row["website_path"] == HISTORY
        )
        published.update(sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
        page = context.new_page()
        page.route(
            "**/" + HISTORY,
            lambda route: route.fulfill(body=raw, content_type="application/json"),
        )
        page.route(
            "**/data/benchmark-source-manifest.json",
            lambda route: route.fulfill(json=updated),
        )
        page.goto(url + "/b0-b1.html?release=" + future_id)
        root = page.locator("#five-dataset-comparison")
        expect(root).to_have_attribute("data-release", future_id, timeout=30000)
        expect(root.locator(".metric-chart")).to_have_count(4)
        expect(root.locator(".metric-missing")).to_have_count(0)
        expect(root.locator("[data-baseline-observation=verified]")).to_have_count(20)
        expect(root.locator(".bar-value")).to_have_count(40)
        expect(
            root.locator("#comparison-release-select optgroup option")
        ).to_have_count(
            len(catalog["order"])
            + len(catalog["attempt_order"])
            + len(sr["entries"])
            + 1
        )
        page.goto(url + "/b0-b1.html")
        expect(root).to_have_attribute("data-release", future_id, timeout=30000)
        page.goto(url + "/b0-b1.html?release=latest")
        expect(root).to_have_attribute("data-release", future_id, timeout=30000)
        page.goto(url + "/b0-b1.html?release=r6")
        expect(root).to_have_attribute("data-release", "r6", timeout=30000)
        page.close()
        checks.append(
            {"catalog_only_new_release": future_id, "uniform_empty_dashboard": True}
        )
        page = context.new_page()
        page.add_init_script("""{
            const original = window.fetch.bind(window);
            window.fetch = (path, ...args) => String(path).includes('summary-public-v3.json')
                ? new Promise((resolve, reject) => setTimeout(() => reject(Error('Delayed old request failure')), 200))
                : original(path, ...args);
        }""")
        page.goto(url + "/b0-b1.html?release=r8")
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
        checks.append({"rapid_switch": "r8-r6-r4", "stale_failure_ignored": True})
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
            checks.append({"rejected": label})
            page.close()
        for label, transform, resign in [
            (
                "context-foreign-release",
                lambda d: context_supplement(d).update(engine_release="foreign"),
                True,
            ),
            (
                "context-fabricated-efficiency",
                lambda d: context_supplement(d).update(efficiency_percent=99),
                True,
            ),
            (
                "context-failed-request",
                lambda d: context_supplement(d)["comparisons"][0]["B1"][
                    "metrics"
                ].update(failed=1),
                True,
            ),
            (
                "context-bad-throughput",
                lambda d: context_supplement(d)["comparisons"][0].update(
                    throughput_ratio=100
                ),
                True,
            ),
            (
                "context-missing-window",
                lambda d: context_supplement(d)["comparisons"][0]["B1"][
                    "windows"
                ].pop(),
                True,
            ),
            (
                "context-failed-window",
                lambda d: context_supplement(d)["comparisons"][0]["B1"]["windows"][0][
                    "metrics"
                ].update(failed=1),
                True,
            ),
            (
                "context-tenant-count",
                lambda d: next(
                    iter(
                        context_supplement(d)["comparisons"][-1]["B1"][
                            "per_tenant"
                        ].values()
                    )
                ).update(requests=1),
                True,
            ),
            (
                "context-invalid-utilization",
                lambda d: context_supplement(d)["comparisons"][0]["B1"][
                    "utilization"
                ].update(mean_percent=101),
                True,
            ),
            (
                "context-foreign-chart",
                lambda d: context_supplement(d)["chart"].update(
                    path="https://example.com/foreign.svg"
                ),
                True,
            ),
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
            checks.append({"rejected": label})
            page.close()
        # A valid source hash cannot turn a model integration into project acceptance.
        for integration_entry in catalog["entries"]:
            descriptor = integration_entry.get("model_integration")
            if not descriptor:
                continue
            summary_path = descriptor["summary"]["path"]
            original_summary = context.request.get(url + "/" + summary_path).json()
            for label, mutate, resign in [
                (
                    "integration-summary-tamper",
                    lambda d: d["candidate"].update(model="tampered"),
                    False,
                ),
                (
                    "integration-foreign-release",
                    lambda d: d["candidate"].update(release="foreign"),
                    True,
                ),
                (
                    "integration-claimed-original018",
                    lambda d: d["scope"].update(original018_pair=True),
                    True,
                ),
                (
                    "integration-claimed-full-five",
                    lambda d: d["scope"].update(project_full_five=True),
                    True,
                ),
                (
                    "integration-fabricated-throughput",
                    lambda d: d["workloads"][0]["candidate"].update(
                        output_tokens_per_second=1
                    ),
                    True,
                ),
                (
                    "integration-wrong-delta",
                    lambda d: d["workloads"][0]["change_percent"].update(
                        mean_ttft_ms=99
                    ),
                    True,
                ),
                (
                    "integration-failed-request",
                    lambda d: d["workloads"][0]["candidate"].update(failed=1),
                    True,
                ),
                (
                    "integration-quality-mismatch",
                    lambda d: d["quality"].update(correct=0),
                    True,
                ),
            ]:
                altered = copy.deepcopy(original_summary)
                mutate(altered)
                raw = json.dumps(altered).encode()
                changed = copy.deepcopy(catalog)
                updated = copy.deepcopy(manifest)
                if resign:
                    selected = next(
                        row
                        for row in changed["entries"]
                        if row["id"] == integration_entry["id"]
                    )
                    selected["model_integration"]["summary"].update(
                        sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw)
                    )
                    for binding in updated["files"]:
                        if binding["website_path"] == summary_path:
                            binding.update(
                                sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw)
                            )
                    history_raw = json.dumps(changed).encode()
                    for binding in updated["files"]:
                        if binding["website_path"] == HISTORY:
                            binding.update(
                                sha256=hashlib.sha256(history_raw).hexdigest(),
                                bytes=len(history_raw),
                            )
                page = context.new_page()
                page.route(
                    "**/" + summary_path,
                    lambda route, request, raw=raw: route.fulfill(
                        body=raw, content_type="application/json"
                    ),
                )
                if resign:
                    page.route(
                        "**/" + HISTORY,
                        lambda route, request, body=history_raw: route.fulfill(
                            body=body, content_type="application/json"
                        ),
                    )
                    page.route(
                        "**/data/benchmark-source-manifest.json",
                        lambda route, request, value=updated: route.fulfill(json=value),
                    )
                page.goto(url + "/b0-b1.html?release=" + integration_entry["id"])
                root = page.locator("#five-dataset-comparison")
                expect(root).to_have_attribute(
                    "data-error", "publication-rejected", timeout=30000
                )
                expect(root.locator(".model-integration")).to_have_count(0)
                page.close()
                checks.append({"rejected": label, "release": integration_entry["id"]})
            page = context.new_page()
            page.route(
                "**/" + descriptor["chart"]["path"],
                lambda route: route.fulfill(
                    body="<svg/>", content_type="image/svg+xml"
                ),
            )
            page.goto(url + "/b0-b1.html?release=" + integration_entry["id"])
            expect(page.locator("#five-dataset-comparison")).to_have_attribute(
                "data-error", "publication-rejected", timeout=30000
            )
            page.close()
            checks.append({"rejected": "integration-chart-tamper"})
        for entry in catalog["entries"]:
            descriptor = entry.get("submission_assessment")
            if not descriptor:
                continue
            page = context.new_page()
            page.route(
                "**/" + descriptor["path"],
                lambda route: route.fulfill(json={"corrupted": True}),
            )
            page.goto(url + "/b0-b1.html?release=" + entry["id"])
            root = page.locator("#five-dataset-comparison")
            expect(root).to_have_attribute(
                "data-error", "publication-rejected", timeout=30000
            )
            expect(root.locator("details[data-rental-cost]")).to_have_count(0)
            page.close()
            checks.append(
                {"rejected": "submission-assessment-tamper", "release": entry["id"]}
            )
        page = context.new_page()
        page.route(
            "**/data/r8-continuous-20261117/summary-v1.json",
            lambda route: route.fulfill(json={"corrupted": True}),
        )
        page.goto(url + "/b0-b1.html?release=r8")
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
            {
                "rejected": "corrupt-r8-publication",
                "historical_release_selectable": True,
            }
        )
        page = context.new_page()
        page.route("**/" + SR, lambda route: route.fulfill(json={"corrupted": True}))
        page.goto(url + "/b0-b1.html?release=sr2")
        root = page.locator("#five-dataset-comparison")
        expect(root).to_have_attribute(
            "data-error", "publication-rejected", timeout=30000
        )
        root.locator("#comparison-release-select").select_option("r8")
        expect(root).to_have_attribute("data-release", "r8", timeout=30000)
        page.close()
        checks.append({"rejected": "corrupt-sr-publication", "r8_selectable": True})
        reference = next(row for row in catalog["entries"] if row["id"] == "r8").get(
            "compute_reference"
        )
        if reference:
            report_path = reference["report"]["path"]
            original = context.request.get(url + "/" + report_path).body()
            beacon = b'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v123abc" data-cf-beacon="public-site-id"></script>\n'
            for altered in (False, True):
                page = context.new_page()
                report = (
                    original.replace(b"meta", b"META", 1) if altered else original
                ) + beacon
                page.route(
                    "**/" + report_path,
                    lambda route, request, body=report: route.fulfill(
                        body=body, content_type="text/html"
                    ),
                )
                page.goto(url + "/b0-b1.html?release=r8")
                root = page.locator("#five-dataset-comparison")
                if altered:
                    expect(root).to_have_attribute(
                        "data-error", "publication-rejected", timeout=30000
                    )
                    expect(root.locator(".metric-chart")).to_have_count(0)
                else:
                    expect(root).to_have_attribute("data-release", "r8", timeout=30000)
                    expect(
                        root.locator(".result-card").first.locator("strong")
                    ).not_to_have_text("—")
                page.close()
                checks.append(
                    {
                        "cdn_analytics_suffix": True,
                        "original_report_altered": altered,
                        "rejected": altered,
                    }
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
