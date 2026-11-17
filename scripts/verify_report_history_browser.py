"""Verify current/archive separation, dates, source integrity and old bookmarks."""

import argparse
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        data = context.request.get(args.url + "/data/report-history-v1.json").json()
        for lang in ("zh", "en"):
            for width in (390, 1440):
                page = context.new_page()
                page.set_viewport_size({"width": width, "height": 1000})
                page.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang', '{lang}')"
                )
                page.goto(args.url + "/b0-b1.html")
                expect(page.locator("#five-dataset-comparison")).to_have_attribute(
                    "data-loaded", "r8-continuous-20261117"
                )
                expect(page.locator("#comparison")).to_have_count(0)
                page.locator("#release-history-link").click()
                root = page.locator("#report-history")
                expect(root).to_have_attribute("data-loaded", data["schema"])
                expect(root.locator(".report-history-entry")).to_have_count(
                    len(data["entries"])
                )
                days = root.locator("h2 time").all_text_contents()
                assert days == sorted(
                    set(r["date"] for r in data["entries"]), reverse=True
                )
                expect(root.locator('[data-status="current"]')).to_have_count(1)
                for entry in data["entries"]:
                    row = root.locator(f'[data-report-id="{entry["id"]}"]')
                    expect(row).to_contain_text(
                        entry["title_zh" if lang == "zh" else "title_en"]
                    )
                    expect(row.locator("a").first).to_have_attribute(
                        "href", entry["report_url"]
                    )
                    if entry.get("artifact_path"):
                        assert context.request.get(
                            args.url + "/" + entry["artifact_path"]
                        ).ok
                expect(page.locator("#history-lead")).to_contain_text(
                    "修订不是新增推理"
                    if lang == "zh"
                    else "a revision is not new inference"
                )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth + 1"
                )
                page.screenshot(path=str(args.output / f"archive-{lang}-{width}.png"))
                page.locator("#langToggle").click()
                expect(page.locator("#history-title")).to_have_text(
                    "Report archive" if lang == "zh" else "历史报告"
                )
                page.goto(args.url + "/b0-b1.html#method-1")
                expect(page).to_have_url(args.url + "/b0-b1-legacy.html#method-1")
                expect(page.locator("#comparison")).to_have_attribute(
                    "data-loaded", "V1.03"
                )
                expect(page.locator("#five-dataset-comparison")).to_have_count(0)
                expect(page.locator("#comparison-lead")).to_contain_text(
                    "历史材料合集" if lang == "zh" else "Historical collection"
                )
                checks.append(
                    {"language": lang, "width": width, "entries": len(data["entries"])}
                )
                page.close()
        page = context.new_page()
        page.route(
            "**/data/report-history-v1.json",
            lambda route: route.fulfill(json={"entries": []}),
        )
        page.goto(args.url + "/report-history.html")
        expect(page.locator("#report-history")).to_have_attribute(
            "data-error", "publication-rejected"
        )
        expect(page.locator(".report-history-entry")).to_have_count(0)
        checks.append({"corrupt_source": "rejected"})
        browser.close()
    (args.output / "receipt.json").write_text(json.dumps(checks, indent=2) + "\n")
    print(f"PASS: {len(checks)} report archive cases; no inference requests")


if __name__ == "__main__":
    main()
