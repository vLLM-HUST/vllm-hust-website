"""Verify red failed-correctness references, scope warnings and downloads."""

import importlib.util
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE / "output/playwright/leaderboard-runs"
spec = importlib.util.spec_from_file_location(
    "frontier_qa", SITE / "scripts/verify_leaderboard_frontier_browser.py"
)
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
data = json.loads((SITE / "data/leaderboard_frontier.json").read_text())
cohort = next(
    c for c in data["cohorts"] if c["id"] == "qwen38-27b-bf16-sweprefix-smoke-v1"
)
points = [p for p in data["points"] if p["cohort_id"] == cohort["id"]]
assert sorted(p["load"]["concurrency"] for p in points) == [
    1,
    1,
    2,
    2,
    4,
    4,
    8,
    8,
    16,
    16,
]
output = ROOT / "native27-correctness"
output.mkdir(parents=True, exist_ok=True)
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
        context.add_init_script(f"localStorage.setItem('vllm-hust_lang','{language}')")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(
            os.environ.get("FRONTIER_QA_URL", "http://127.0.0.1:8786")
            + "/leaderboard-runs.html#frontier",
            wait_until="domcontentloaded",
        )
        qa.ready(page)
        page.locator(".frontier-model-tag").filter(has_text="Qwen3.8-27B").click()
        assert page.locator(".frontier-point").count() == len(points)
        qa.assert_concurrency_lines(page, points)
        for point in points:
            qa.click_point(page, page.locator(f'[data-point="{point["id"]}"]'))
            popup = page.locator("#frontier-popover")
            text = popup.inner_text()
            qa.assert_parallel(text, point["configuration"]["parameters"], language)
            failed = (
                point["configuration"]["parameters"]["functional_status"] == "failed"
            )
            warning = popup.locator(".frontier-correctness-warning")
            assert warning.count() == int(failed)
            if failed:
                assert "5/16" in warning.inner_text() and "C16" in warning.inner_text()
                assert (
                    "正确性失败" if language == "zh" else "Correctness failed"
                ) in warning.inner_text()
                assert (
                    page.locator(
                        f'[data-point="{point["id"]}"] .frontier-dot'
                    ).get_attribute("fill")
                    == "#dc2626"
                )
                assert (
                    "正确性失败" if language == "zh" else "Correctness failed"
                ) in page.locator("#frontier-legend").inner_text()
            for value in (
                point["metrics"]["decode_p90_tps"],
                point["metrics"]["output_tps"] / 2,
            ):
                expected = page.evaluate(
                    "([n,l])=>new Intl.NumberFormat(l,{maximumFractionDigits:2}).format(n)",
                    [value, language],
                )
                assert expected in text, (point["id"], expected, text)
            box = popup.bounding_box()
            assert box["x"] >= 0 and box["x"] + box["width"] <= width
            with page.expect_download() as download:
                popup.locator("[data-download]").click()
            path = output / f"{width}-{language}-{point['id']}.json"
            download.value.save_as(path)
            payload = json.loads(path.read_text())
            assert payload["point"] == point and payload["cohort"] == cohort
            popup.locator("[data-close]").click()
        page.locator('[data-filter="mods"][value="betterscale"]').uncheck()
        assert page.locator(".frontier-point").count() == 5
        assert page.locator(".frontier-envelope").count() == 0
        page.locator('[data-filter="mods"][value="betterscale"]').check()
        assert not errors, errors
        assert page.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth+1"
        )
        page.screenshot(
            path=str(output / f"{width}-{language}-{scheme}.png"), full_page=True
        )
        reports.append(
            dict(
                width=width,
                language=language,
                scheme=scheme,
                status="PASS",
                points=len(points),
            )
        )
        context.close()
    browser.close()
(output / "receipt.json").write_text(json.dumps(reports, indent=2) + "\n")
print(json.dumps(reports))
