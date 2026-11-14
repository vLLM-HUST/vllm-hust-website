"""Verify displayed five-profile metrics and reject corrupted or inconsistent sources."""

import argparse
import copy
import hashlib
import json
from pathlib import Path
import re

from playwright.sync_api import expect, sync_playwright


def verify(url, output):
    output.mkdir(parents=True, exist_ok=True)
    source = (
        Path(__file__).resolve().parents[1] / "assets/five-dataset-comparison.js"
    ).read_text()
    summary_path = re.search(r"const summaryPath = '([^']+)'", source).group(1)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        result = context.request.get(url + "/" + summary_path)
        assert result.ok
        data = result.json()
        manifest = context.request.get(
            url + "/data/benchmark-source-manifest.json"
        ).json()
        checks = []
        for lang in ("zh", "en"):
            for width in (390, 1440):
                page = context.new_page()
                page.set_viewport_size({"width": width, "height": 1000})
                page.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang', '{lang}')"
                )
                page.goto(url + "/b0-b1.html")
                root = page.locator("#five-dataset-comparison")
                expect(root).to_have_attribute(
                    "data-loaded", data["run_id"], timeout=30000
                )
                expect(root.locator("table")).to_have_count(6)
                for row in data["datasets"]:
                    expect(root).to_contain_text(row["name"])
                    expect(root).to_contain_text(
                        f"{row['arms']['B1']['output_tokens_per_second']:.2f}"
                    )
                goal_rows = root.locator("table").nth(0).locator("tbody tr")
                expect(goal_rows).to_have_count(4)
                for i, key in enumerate(("3.4.1", "3.4.2", "3.4.3", "3.4.4")):
                    expected = (
                        ("达标" if lang == "zh" else "Met")
                        if data["formal_targets"][key]["accepted"]
                        else ("未通过" if lang == "zh" else "Not passed")
                    )
                    expect(goal_rows.nth(i).locator("td").nth(2)).to_have_text(expected)
                expect(root).to_contain_text("64")
                expect(root).to_contain_text("48")
                expect(root).to_contain_text(
                    "任务解决率" if lang == "zh" else "no task solve rate"
                )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth + 1"
                )
                assert (
                    root.locator("a")
                    .last.get_attribute("href")
                    .startswith(
                        "https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/"
                        + manifest["commit"]
                    )
                )
                page.screenshot(
                    path=str(output / f"five-datasets-{lang}-{width}.png"),
                    full_page=True,
                )
                checks.append(dict(language=lang, width=width, run_id=data["run_id"]))
                page.close()

        for label, corrupt, resign in (
            ("bad-hash", False, False),
            ("inconsistent-rate", True, True),
            ("incomplete", False, True),
        ):
            changed = copy.deepcopy(data)
            if corrupt:
                changed["datasets"][0]["arms"]["B1"]["output_tokens_per_second"] *= 2
            else:
                changed["execution_complete"] = False
            raw = (json.dumps(changed) + "\n").encode()
            updated = copy.deepcopy(manifest)
            for entry in updated["files"]:
                if entry["website_path"] == summary_path:
                    entry.update(sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
            page = context.new_page()
            page.route(
                "**/" + summary_path,
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
            expect(page.locator("#five-dataset-comparison")).to_have_attribute(
                "data-error", "publication-rejected", timeout=30000
            )
            assert page.locator("#five-dataset-comparison table").count() == 0
            checks.append(dict(rejected=label))
            page.close()
        browser.close()
    (output / "verification.json").write_text(json.dumps(checks, indent=2) + "\n")
    print(f"Verified {len(checks)} five-dataset display/rejection cases")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    verify(args.url.rstrip("/"), args.output)
