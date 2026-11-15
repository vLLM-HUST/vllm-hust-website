"""Verify the separately sourced B1 exploration, including corrupted-asset rejection."""

import argparse
import copy
import hashlib
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

DIRECTORY = "data/optimization-exploration-20261115-v1/"


def verify(url, output):
    output.mkdir(parents=True, exist_ok=True)
    checks = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context()
        response = context.request.get(url + "/" + DIRECTORY + "tradeoff.json")
        assert response.ok
        data = response.json()
        manifest = context.request.get(
            url + "/data/benchmark-source-manifest.json"
        ).json()
        for lang in ("zh", "en"):
            for width in (390, 1440):
                page = context.new_page()
                page.set_viewport_size({"width": width, "height": 1000})
                page.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang', '{lang}')"
                )
                page.goto(url + "/b0-b1.html")
                page.locator("#optimization-records > summary").click()
                root = page.locator("#optimization-exploration")
                expect(root).to_have_attribute(
                    "data-loaded", DIRECTORY.split("/")[1], timeout=30000
                )
                expect(root).to_contain_text(
                    "B1内部配置扫描"
                    if lang == "zh"
                    else "Internal B1 configuration sweep"
                )
                expect(root.locator("tbody tr")).to_have_count(data["physical_trials"])
                for index, row in enumerate(data["rows"]):
                    cells = root.locator("tbody tr").nth(index).locator("td")
                    expect(cells.nth(0)).to_have_text(row["id"])
                    expect(cells.nth(2)).to_have_text(
                        f"{row['output_tokens_per_second']:.3f}"
                        if row["timing_eligible"]
                        else "未接纳"
                        if lang == "zh"
                        else "Not admitted"
                    )
                    expect(cells.nth(5)).to_have_text(
                        f"{row['correct']}/{row['planned']}"
                        if row["timing_eligible"]
                        else "未测"
                        if lang == "zh"
                        else "Unmeasured"
                    )
                root.locator("summary").click()
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth + 1"
                )
                page.wait_for_function(
                    "Array.from(document.querySelectorAll('#optimization-exploration img')).every(e=>e.complete && e.naturalWidth>0)"
                )
                assert root.locator("img").evaluate_all(
                    "els => els.every(e => e.complete && e.naturalWidth > 0)"
                )
                expect(page.locator("#five-dataset-comparison")).to_have_attribute(
                    "data-loaded", "five-datasets-r6-matched-20261114-r3", timeout=30000
                )
                page.locator("#langToggle").click()
                expect(root).to_contain_text(
                    "Internal B1 configuration sweep"
                    if lang == "zh"
                    else "B1内部配置扫描"
                )
                page.locator("#langToggle").click()
                root.screenshot(path=str(output / f"exploration-{lang}-{width}.png"))
                checks.append(
                    dict(language=lang, width=width, rows=data["physical_trials"])
                )
                page.close()
        for filename, resign in (
            ("tradeoff.json", False),
            ("tradeoff.svg", False),
            ("all-trials.csv", False),
            ("tradeoff.json", True),
        ):
            page = context.new_page()
            changed = copy.deepcopy(data)
            changed["admitted_trials"] += 1
            raw = (
                (json.dumps(changed) + "\n").encode()
                if filename.endswith("json")
                else b"corrupted"
            )
            page.route(
                "**/" + DIRECTORY + filename,
                lambda route, request, raw=raw: route.fulfill(body=raw),
            )
            if resign:
                updated = copy.deepcopy(manifest)
                for entry in updated["files"]:
                    if entry["website_path"] == DIRECTORY + filename:
                        entry.update(
                            sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw)
                        )
                page.route(
                    "**/data/benchmark-source-manifest.json",
                    lambda route: route.fulfill(json=updated),
                )
            page.goto(url + "/b0-b1.html")
            expect(page.locator("#optimization-exploration")).to_have_attribute(
                "data-error", "publication-rejected", timeout=30000
            )
            assert page.locator("#optimization-exploration table").count() == 0
            expect(page.locator("#five-dataset-comparison")).to_have_attribute(
                "data-loaded", "five-datasets-r6-matched-20261114-r3", timeout=30000
            )
            checks.append(
                dict(
                    rejected=filename,
                    manifest_resigned=resign,
                    formal_panel_unchanged=True,
                )
            )
            page.close()
        browser.close()
    (output / "verification.json").write_text(json.dumps(checks, indent=2) + "\n")
    print(f"Verified {len(checks)} exploration display/rejection cases")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    verify(args.url.rstrip("/"), args.output)
