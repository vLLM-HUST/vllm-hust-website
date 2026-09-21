"""Check the public case study's rendered evidence, language, links and layout."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8769")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    evidence = json.loads((root / "data/betterscale-results.json").read_text())
    qwen = json.loads((root / "data/betterscale-qwen-swe.json").read_text())
    mechanism = json.loads((root / "data/betterscale-qwen-mechanism.json").read_text())
    steps = {
        key: json.loads((root / f"data/betterscale-{key}-steps.json").read_text())
        for key in ("qwen", "dsv4")
    }
    ecosystem = json.loads((root / "data/ecosystem.json").read_text())
    workshop_mod_count = sum(
        item["artifact_type"] in {"runtime_component", "bridge"}
        and item["repository_relationship"] == "organization_native"
        and item.get("public_surface", True) is not False
        and item["delivery_model"]
        in {
            "plugin_bundle",
            "python_distribution",
            "migration_scaffold",
            "source_patch",
        }
        and item["canonical_repository"].startswith("https://github.com/vLLM-HUST/")
        for item in ecosystem["components"]
    )
    output = root / "output/playwright/betterscale"
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, label in ((1440, "desktop"), (390, "mobile")):
            for language in ("en", "zh"):
                page = browser.new_page(viewport={"width": width, "height": 1000})
                errors = []
                page.on(
                    "pageerror", lambda error, errors=errors: errors.append(str(error))
                )
                page.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang', '{language}');"
                )
                response = page.goto(f"{args.url}/betterscale.html")
                assert response.status == 200
                page.wait_for_function(
                    "lang => document.documentElement.lang === lang", arg=language
                )
                for key, data in steps.items():
                    for topology in ("tp", "dp") if key == "dsv4" else ("qwen",):
                        points = [
                            point
                            for point in data["points"]
                            if point["case"]["kind"] == "decode"
                            and (key == "qwen" or point["topology"] == topology)
                        ]
                        gains = [point["step_rate_gain_pct"] for point in points]
                        assert page.locator(
                            f'[data-step-model="{topology}"] strong'
                        ).inner_text() == (f"+{min(gains):.2f}–{max(gains):.2f}%")
                assert page.locator(".bs-archive[open]").count() == 0
                for img in page.locator(".bs-step-figure img").all():
                    img.scroll_into_view_if_needed()
                    img.evaluate("e => e.decode()")
                    assert img.evaluate("e => e.naturalWidth > 0")
                assert "37" in page.locator("#step-efficiency").inner_text()
                page.locator("#step-efficiency").screenshot(
                    path=str(output / f"steps-{label}-{language}.png"),
                    style=".site-nav, .lang-toggle { visibility: hidden; }",
                )
                # Previously shared hash links must open their enclosing archive.
                page.evaluate("location.hash = 'qwen-mechanism'")
                page.wait_for_function(
                    "document.querySelector('#qwen-mechanism').closest('details').open"
                )
                page.locator(".bs-archive").evaluate_all(
                    "nodes => nodes.forEach(n => n.open = true)"
                )
                assert (
                    page.locator("#measurements h2").evaluate(
                        "e => getComputedStyle(e).color"
                    )
                    == "rgb(16, 25, 25)"
                )
                assert page.locator("h1").inner_text() == "BetterScale."
                assert (
                    page.locator("#mechanism h2")
                    .inner_text()
                    .startswith(
                        "Less orchestration." if language == "en" else "减少编排等待。"
                    )
                )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= window.innerWidth"
                ), f"Horizontal page overflow: {label}/{language}"
                mc2 = json.loads((root / "data/betterscale-qwen-mc2.json").read_text())
                rows = page.locator("#qwen-mc2 tbody tr")
                for i, tokens in enumerate((1024, 1536)):
                    point = next(
                        p
                        for p in mc2["points"]
                        if p["rank"] == 0
                        and p["kind"] == "prefill"
                        and p["tokens"] == tokens
                    )
                    assert rows.nth(i).locator("td").all_text_contents() == [
                        str(tokens),
                        f"{point['split']['forward_ms']:.2f}",
                        f"{point['mc2']['forward_ms']:.2f}",
                        f"{point['forward_reduction_percent']:.2f}%",
                    ]
                page.locator("#qwen-mc2").screenshot(
                    path=str(output / f"mc2-{label}-{language}.png")
                )
                mtp = json.loads(
                    (root / "data/betterscale-qwen-mtp-apc.json").read_text()
                )
                mtp_rows = page.locator("#qwen-mtp-apc tbody tr")
                for i, point in enumerate(mtp["results"]):
                    assert mtp_rows.nth(i).locator("td").all_text_contents() == [
                        str(point["concurrency"]),
                        f"{point['before']['output_tps']:.2f}",
                        f"{point['after']['output_tps']:.2f}",
                        f"{point['ratio']:.2f}×",
                    ]
                page.locator("#qwen-mtp-apc").screenshot(
                    path=str(output / f"mtp-apc-{label}-{language}.png")
                )
                capacity = page.locator("#capacity")
                assert "96.84%" in capacity.inner_text()
                assert "TP8" in capacity.inner_text() and "DP8" in capacity.inner_text()
                assert "512Ki" in capacity.inner_text()
                capacity.screenshot(
                    path=str(output / f"capacity-{label}-{language}.png")
                )
                assert "32/32" in page.locator("#prefix-reuse").inner_text()
                qwen_section = page.locator("#qwen-swe")
                assert "Qwen3.8-27B" in qwen_section.inner_text()
                for key, counts in mechanism["display_counts"].items():
                    actual = page.locator(
                        f'[data-qwen-mechanism="{key}"] dd'
                    ).inner_text()
                    assert actual == f"{counts[0]} → {counts[1]}"
                mechanism_section = page.locator("#qwen-mechanism")
                assert mechanism_section.locator(".bs-qwen-cards article").count() == 3
                assert "APC-off" in mechanism_section.inner_text()
                assert "FULL_AND_PIECEWISE" in mechanism_section.inner_text()
                mechanism_section.screenshot(
                    path=str(output / f"qwen-mechanism-{label}-{language}.png"),
                    style=".site-nav, .lang-toggle { visibility: hidden; }",
                )
                for concurrency, gain in qwen["throughput_gain_percent"].items():
                    cells = page.locator(
                        f'[data-qwen-concurrency="{concurrency}"] td'
                    ).all_text_contents()
                    assert cells == [
                        f"C{concurrency}",
                        f"{qwen['pooled']['baseline'][concurrency]['tokens_per_s']:.2f}",
                        f"{qwen['pooled']['candidate'][concurrency]['tokens_per_s']:.2f}",
                        f"+{gain:.2f}%",
                    ]
                for detail_id in ("qwen-repeats", "qwen-latency"):
                    page.locator(f"#{detail_id} summary").click()
                for row in qwen["rounds"]:
                    text = page.locator(
                        f'[data-qwen-repeat="{row["concurrency"]}-{row["repeat"]}"]'
                    ).inner_text()
                    assert f"{row['tokens_per_s']:.2f}" in text
                for arm, label_name in (
                    ("baseline", "Native"),
                    ("candidate", "BetterScale"),
                ):
                    for concurrency, metrics in qwen["pooled"][arm].items():
                        text = page.locator(
                            f'[data-qwen-latency="{concurrency}-{label_name}"]'
                        ).inner_text()
                        for field in (
                            "mean_ttft_ms",
                            "p95_ttft_ms",
                            "mean_tpot_ms",
                            "p95_tpot_ms",
                        ):
                            assert f"{metrics[field]:.2f}" in text
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= window.innerWidth"
                ), f"Qwen tables overflow page: {label}/{language}"
                qwen_section.screenshot(
                    path=str(output / f"qwen-{label}-{language}.png"),
                    style=".site-nav, .lang-toggle { visibility: hidden; }",
                )
                for detail_id in ("qwen-repeats", "qwen-latency"):
                    page.locator(f"#{detail_id} summary").click()
                integration = page.locator("#integration")
                assert "vllm-betterscale==0.5.1" in integration.inner_text()
                assert "python -m betterscale serve-qwen" in integration.inner_text()
                assert "BETTERSCALE_GDN_LIBRARY=" not in integration.inner_text()
                assert integration.locator("details").count() == 2
                for details in integration.locator("details").all():
                    if not details.evaluate("e => e.open"):
                        details.locator("summary").click()
                    assert (
                        "--worker-cls betterscale.worker.Worker" in details.inner_text()
                    )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= window.innerWidth"
                ), f"Expanded install commands overflow: {label}/{language}"
                integration.screenshot(
                    path=str(output / f"install-{label}-{language}.png")
                )
                for study in evidence["studies"]:
                    card = page.locator(f"#{study['id']}")
                    rows = card.locator(".bs-repeat")
                    assert rows.count() == len(study["repeats"])
                    for i, repeat in enumerate(study["repeats"]):
                        numbers = rows.nth(i).locator(".bs-bar-row b")
                        for j, side in enumerate(("control", "candidate")):
                            assert (
                                numbers.nth(j)
                                .inner_text()
                                .startswith(f"{repeat[side + '_ms']:.2f}")
                            )
                            bar = rows.nth(i).locator(f".bs-bar.{side}")
                            percent = float(
                                bar.evaluate(
                                    "e => e.style.getPropertyValue('--width').trim().replace('%', '')"
                                )
                            )
                            assert (
                                abs(percent - repeat[side + "_ms"] / 70 * 100) < 0.001
                            )
                for row in evidence["service_http"]["rows"]:
                    rendered = page.locator(
                        f'[data-service-layout="{row["layout"]}"]'
                    ).inner_text()
                    for key in ("native_tps", "candidate_tps", "gain_percent"):
                        assert f"{row[key]:.2f}" in rendered
                page.screenshot(path=str(output / f"opening-{label}-{language}.png"))
                page.screenshot(
                    path=str(output / f"{label}-{language}.png"), full_page=True
                )
                page.locator("#measurements").screenshot(
                    path=str(output / f"measurements-{label}-{language}.png"),
                    style=".site-nav, .lang-toggle { visibility: hidden; }",
                )
                page.locator("#langToggle").click()
                assert (
                    page.locator("#mechanism h2")
                    .inner_text()
                    .startswith(
                        "减少编排等待。" if language == "en" else "Less orchestration."
                    )
                )
                assert not errors, errors
                page.close()
        page = browser.new_page()
        page.goto(f"{args.url}/plugins.html")
        page.locator("#betterscale.workshop-card").wait_for()
        card = page.locator("#betterscale.workshop-card")
        assert card.locator(
            '.plugin-card-footer a[href="./betterscale.html"]'
        ).is_visible()
        assert card.locator(
            '.plugin-card-footer a[href="https://github.com/vLLM-HUST/BetterScale"]'
        ).is_visible()
        assert page.locator("#betterscale.bs-feature").count() == 0
        card.locator(".plugin-launch-icon").click()
        tooltip = card.locator(".plugin-launch-tooltip")
        tooltip.wait_for(state="visible")
        assert (
            "--data-parallel-size-local 8" in tooltip.locator("pre").first.inner_text()
        )
        tooltip.locator("summary").click()
        assert "--tensor-parallel-size 8" in tooltip.locator("details pre").inner_text()
        card.locator(".plugin-launch-icon").click()
        assert card.locator(".plugin-workload-tag").count() == 1
        page.locator("[data-plugin-search]").fill("BetterScale")
        assert page.locator(".workshop-card").count() == 1
        card.locator(".plugin-workload-tag").click()
        assert card.is_visible()
        page.locator("[data-plugin-search]").fill("StateHarbor")
        assert page.locator(".workshop-card").count() == 0
        page.locator("[data-plugin-search]").fill("")
        page.locator("[data-workload-filters] button").first.click()
        page.locator("[data-plugin-more]").click()
        assert page.locator(".workshop-card").count() == workshop_mod_count
        assert page.locator("#stateharbor.workshop-card").count() == 0
        page.locator(
            '#betterscale .plugin-card-footer a[href="./betterscale.html"]'
        ).click()
        page.wait_for_url("**/betterscale.html")
        for name in ("index", "achievements"):
            page.goto(f"{args.url}/{name}.html")
            assert page.locator('.bs-feature a[href="./betterscale.html"]').count() == 0
        for name in (
            "data/betterscale-results.json",
            "docs/BETTERSCALE.md",
            "data/betterscale-qwen-swe.json",
            "docs/BETTERSCALE-QWEN-SWE.md",
            "docs/BETTERSCALE-STEPS.md",
            "data/betterscale-qwen-mtp-apc.json",
            "docs/BETTERSCALE-QWEN-MTP-APC.md",
            "data/betterscale-qwen-steps.json",
            "data/betterscale-dsv4-steps.json",
        ):
            assert page.request.get(f"{args.url}/{name}").status == 200
        browser.close()
    print(
        "PASS: desktop/mobile, EN/ZH, language toggle, all repeats/bar scales, case-study links"
    )


if __name__ == "__main__":
    main()
