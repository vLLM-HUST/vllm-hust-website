#!/usr/bin/env python3
"""Render the independent leaderboard with real bundled evidence, in EN/ZH."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8774")
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/leaderboard-runs")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    site = Path(__file__).resolve().parents[1]
    supplement = json.loads(
        (site / "data/leaderboard_run_observations.json").read_text()
    )
    expected = {
        r["entry_id"]: r for runs in supplement["observations"].values() for r in runs
    }
    total_runs = len(expected)
    arm_runs = sum(r["engine"] == "betterscale" for r in expected.values())
    entries = {}
    for kind in ("single", "multi", "historical"):
        for entry in json.loads((site / f"data/leaderboard_{kind}.json").read_text()):
            if (
                kind != "historical"
                or entry.get("historical_recovery", {}).get(
                    "admitted_for_historical_trend"
                )
                is True
            ):
                entries.setdefault(entry["entry_id"], entry)
    all_runs = {
        run["entry_id"]: run
        for entry in entries.values()
        for run in supplement["observations"].get(entry["entry_id"], [entry])
    }
    b3_runs = {
        key for key, run in all_runs.items() if run["hardware"]["chip_model"] == "910B3"
    }
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
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            response = page.goto(
                f"{args.url}/leaderboard-runs.html", wait_until="domcontentloaded"
            )
            assert response.status == 200
            page.locator("#runs-content").wait_for(state="visible", timeout=30000)
            nav = page.locator('.site-nav [data-nav-page="leaderboard-v2"]')
            assert nav.count() == 1
            assert nav.inner_text() == (
                "排行榜 v2" if language == "zh" else "Leaderboard v2"
            )
            assert nav.get_attribute("href") == "./leaderboard-runs.html"
            assert "active" in nav.get_attribute("class")
            assert (
                page.locator('.site-nav [data-nav-page="leaderboard"].active').count()
                == 0
            )
            if width < 860:
                page.locator("#navToggle").click()
                assert nav.is_visible()
                page.locator("#navToggle").click()
            else:
                assert nav.is_visible()

            assert (
                page.locator(
                    ".runs-hero, .runs-filters, .hardware-context, #runs-title"
                ).count()
                == 0
            )
            # Default scope covers every published record, across hardware and history.
            assert page.locator("#view-runs-count").inner_text() == str(len(all_runs))
            assert page.locator("#runs-headers th").count() == 11
            seen = set()
            while True:
                for row in page.locator(".run-row").evaluate_all("""rows => rows.map(row => ({
                    id: row.dataset.runId, hardware: row.querySelector('.run-hardware').textContent
                }))"""):
                    assert row["id"] not in seen
                    seen.add(row["id"])
                    assert (
                        all_runs[row["id"]]["hardware"]["chip_model"] in row["hardware"]
                    )
                if page.locator("#runs-next").is_disabled():
                    break
                page.locator("#runs-next").click()
            assert seen == set(all_runs)
            page.locator("#runs-reset").click()
            page.screenshot(
                path=str(args.output / f"all-records-{width}-{language}-{scheme}.png")
            )
            page.locator('[data-column="hardware"]').click()
            assert page.locator("#column-scope").is_hidden()
            page.locator("#column-none").click()
            page.locator("#column-search").fill("910B3")
            page.locator("#column-values input").check()
            page.locator("#column-apply").click()
            assert (
                set(
                    page.locator(".run-row").evaluate_all(
                        "rows => rows.map(r => r.dataset.runId)"
                    )
                )
                == b3_runs
            )
            page.locator("#runs-reset").click()
            assert page.locator("#view-runs-count").inner_text() == str(len(all_runs))
            page.locator('[data-column="model"]').click()
            page.locator("#column-none").click()
            page.locator("#column-search").fill("Qwen3.8-27B")
            page.locator("#column-values input").check()
            page.locator("#column-apply").click()
            assert page.locator(".run-row").count() == min(40, total_runs)
            assert "Leaderboards" in page.locator("#view-runs").inner_text()
            assert "Tasks" in page.locator("#view-tasks").inner_text()
            assert page.locator("#view-runs-count").inner_text() == str(total_runs)
            assert page.locator("#view-tasks-count").inner_text() == "8"
            # Verify every visible per-run mean and P95 against real sealed evidence.
            measured = page.locator(".run-row").evaluate_all("""rows=>rows.map(row=>({
                id:row.dataset.runId, cells:Object.fromEntries([...row.querySelectorAll('[data-metric]')].map(c=>[c.dataset.metric,c.textContent]))
            }))""")
            if total_runs > 40:
                page.locator("#runs-next").click()
                measured += page.locator(".run-row").evaluate_all("""rows=>rows.map(row=>({
                    id:row.dataset.runId, cells:Object.fromEntries([...row.querySelectorAll('[data-metric]')].map(c=>[c.dataset.metric,c.textContent]))
                }))""")
                page.locator("#runs-previous").click()
            assert len(measured) == total_runs
            for row in measured:
                entry = expected[row["id"]]
                for key, metric in [
                    ("ttft", "ttft_ms"),
                    ("tpot", "tbt_ms"),
                    ("ttftP95", "ttft_p95_ms"),
                    ("tpotP95", "tpot_p95_ms"),
                    ("throughput", "throughput_tps"),
                ]:
                    actual = row["cells"][key]
                    value = entry["metrics"].get(metric)
                    if value is None:
                        assert actual == "—", (row["id"], key, actual)
                    else:
                        assert abs(float(actual.replace(",", "")) - value) <= 0.0051, (
                            key,
                            actual,
                            value,
                        )
            assert page.locator("#tasks-body > tr").count() == 8
            page.screenshot(
                path=str(args.output / f"table-{width}-{language}-{scheme}.png")
            )
            first = page.locator("[data-run]").first
            first.focus()
            page.keyboard.press("Enter")
            assert first.get_attribute("aria-expanded") == "true"
            detail = page.locator("#" + first.get_attribute("aria-controls"))
            assert detail.is_visible()
            assert detail.locator("td").get_attribute("colspan") == "11"
            assert "max_model_len" in detail.inner_text()
            assert detail.locator("a").count() >= 1
            first.click()
            tag = page.locator("[data-task]").first
            tag.click()
            selected = page.locator(".selected-task")
            assert selected.is_visible()
            assert "Agent Research" in selected.inner_text()
            assert page.locator("#tasks-panel").is_visible()
            assert page.locator("#runs-panel").is_hidden()
            assert page.locator("table:visible").count() == 1
            page.screenshot(
                path=str(args.output / f"tasks-{width}-{language}-{scheme}.png")
            )
            page.locator("#view-runs").click()
            assert page.locator("#tasks-panel").is_hidden()
            assert page.locator("table:visible").count() == 1
            # Exact-value multi-selection, cancel, search, and numeric ordering.
            page.locator('[data-column="mod"]').click()
            assert page.locator("#column-menu").is_visible()
            page.locator("#column-none").click()
            page.locator("#column-search").fill("betterscale")
            page.locator("#column-values input").check()
            page.screenshot(
                path=str(args.output / f"column-menu-{width}-{language}-{scheme}.png")
            )
            bounds = page.locator("#column-menu").bounding_box()
            assert bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= width + 1
            page.locator("#column-apply").click()
            assert page.locator(".run-row").count() == arm_runs
            page.locator('[data-column="mod"]').click()
            page.locator("#column-none").click()
            page.keyboard.press("Escape")
            assert page.locator(".run-row").count() == arm_runs
            assert page.locator('[data-column="mod"]').evaluate(
                "(el)=>el === document.activeElement"
            )
            page.locator('[data-order="ttft"]').focus()
            page.keyboard.press("Enter")
            assert page.locator("#column-menu").is_hidden()
            values = page.locator('[data-metric="ttft"]').all_text_contents()
            numeric = [float(v.replace(",", "")) for v in values if v != "—"]
            assert numeric == sorted(numeric)
            page.locator('[data-order="ttft"]').click()
            assert page.locator("#column-menu").is_hidden()
            values = page.locator('[data-metric="ttft"]').all_text_contents()
            numeric = [float(v.replace(",", "")) for v in values if v != "—"]
            assert numeric == sorted(numeric, reverse=True)
            assert values[-1] == "—"
            page.locator("#view-tasks").click()
            page.locator("#view-runs").click()
            assert page.locator(".run-row").count() == arm_runs
            page.locator('[data-column="mod"]').click()
            page.locator("#column-none").click()
            page.locator("#column-apply").click()
            assert page.locator("#runs-empty").is_visible()
            page.locator('[data-column="mod"]').click()
            page.locator("#column-clear").click()
            assert page.locator(".run-row").count() == min(40, total_runs)
            # Filters, empty states, pagination, and language switches stay functional.
            page.locator('[data-column="mod"]').click()
            page.locator("#column-none").click()
            page.locator("#column-values label").filter(
                has_text="Native" if language == "en" else "原生"
            ).locator("input").check()
            page.locator("#column-apply").click()
            assert page.locator(".run-row").count() == arm_runs
            page.locator("#langToggle").click()
            assert document_language(page) != language
            assert page.locator(".run-row").count() == arm_runs
            page.locator('[data-column="run"]').click()
            page.locator("#column-scope-select").select_option("historical")
            page.locator("#column-cancel").click()
            assert page.locator(".run-row").count() > 0
            assert all(
                ("Historical" in text or "历史" in text)
                for text in page.locator(".run-id").all_text_contents()
            )
            page.locator("#runs-reset").click()
            assert page.locator(".run-row").count() == 40
            assert page.locator("#view-runs-count").inner_text() == str(len(all_runs))
            page.locator("#runs-next").click()
            assert page.locator("#runs-page").inner_text().startswith("2 /")
            assert page.evaluate(
                "document.documentElement.scrollWidth <= window.innerWidth + 1"
            )
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
        # No supplement: visible missing-data notice; never silently invent P95.
        context = browser.new_context()
        page = context.new_page()
        page.route("**/leaderboard_run_observations.json", lambda route: route.abort())
        page.goto(f"{args.url}/leaderboard-runs.html", wait_until="domcontentloaded")
        page.locator("#runs-content").wait_for(state="visible", timeout=30000)
        assert page.locator("#runs-supplement-warning").is_visible()
        assert all(
            t == "—"
            for t in page.locator('[data-metric="ttftP95"]').all_text_contents()
        )
        context.close()
        browser.close()
    (args.output / "report.json").write_text(json.dumps(reports, indent=2) + "\n")
    print(json.dumps(reports))


def document_language(page):
    return page.locator("html").get_attribute("lang")


if __name__ == "__main__":
    main()
