"""Exercise measured-source links in real browsers, including integrity failure."""

import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from verify_leaderboard_frontier_browser import click_point, ready


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8769")
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/evidence-links")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        )
        for width in (390, 1440):
            for lang in ("zh", "en"):
                for scheme in ("light", "dark"):
                    context = browser.new_context(
                        viewport={"width": width, "height": 1000}, color_scheme=scheme
                    )
                    context.add_init_script(
                        f"localStorage.setItem('vllm-hust_lang', '{lang}')"
                    )
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    manifest = context.request.get(
                        f"{args.url}/data/benchmark-source-manifest.json"
                    ).json()
                    registry = context.request.get(
                        f"{args.url}/data/benchmark-evidence-links.json"
                    ).json()
                    prefix = f"https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/{manifest['commit']}/"
                    page.goto(f"{args.url}/serving-plan.html", wait_until="networkidle")
                    expect(
                        page.locator("[data-benchmark-plan][data-evidence-rewritten]")
                    ).to_have_count(7)
                    for anchor in page.locator("[data-benchmark-plan]").all():
                        target = registry["serving_plans"][
                            anchor.get_attribute("data-benchmark-plan")
                        ]
                        assert anchor.get_attribute("href") == prefix + target["path"]
                    page.screenshot(
                        path=args.output / f"plans-{width}-{lang}-{scheme}.png",
                        full_page=True,
                    )
                    page.goto(
                        f"{args.url}/dataset-validation.html", wait_until="networkidle"
                    )
                    page.goto(
                        f"{args.url}/leaderboard-runs.html#frontier",
                        wait_until="networkidle",
                    )
                    ready(page)
                    expect(
                        page.locator(
                            'a[data-evidence-rewritten][href*="summary-adjudicated.json"]'
                        )
                    ).to_have_count(1)
                    ids = page.locator("[data-point]").evaluate_all(
                        "nodes => nodes.map(n => n.dataset.point)"
                    )
                    assert ids
                    for ident in list(dict.fromkeys([ids[0], ids[-1]])):
                        click_point(page, page.locator(f'[data-point="{ident}"]'))
                        container = page.locator(f'[data-benchmark-point="{ident}"]')
                        expect(container).to_have_attribute(
                            "data-evidence-ready", "true"
                        )
                        expected = [
                            f"https://github.com/vLLM-HUST/vllm-hust-benchmark/{r['kind']}/{manifest['commit']}/{r['path']}"
                            for r in registry["frontier_points"][ident]["links"]
                        ]
                        assert (
                            container.locator("a").evaluate_all(
                                "nodes => nodes.map(n => n.href)"
                            )
                            == expected
                        )
                        container.locator("a").first.scroll_into_view_if_needed()
                        expect(container.locator("a").first).to_be_visible()
                        page.screenshot(
                            path=args.output / f"point-{width}-{lang}-{scheme}.png"
                        )
                        with page.expect_download() as download:
                            page.locator("#frontier-popover [data-download]").click()
                        assert download.value.suggested_filename.endswith(".json")
                        page.locator("#frontier-popover [data-close]").click()
                    page.locator("#langToggle").click()
                    click_point(page, page.locator("[data-point]").first)
                    expect(
                        page.locator("[data-benchmark-point] a").first
                    ).to_be_visible()
                    assert not errors, errors
                    results.append(
                        {
                            "width": width,
                            "language": lang,
                            "scheme": scheme,
                            "points": ids,
                            "commit": manifest["commit"],
                        }
                    )
                    context.close()
        # The legacy offline vSpec cohort has original JSON, not a publication fallback.
        page = browser.new_page()
        page.goto(
            f"{args.url}/leaderboard-runs.html?setting=qwen25-14b-bf16-gsm8k-b128-vspec-v1#frontier",
            wait_until="networkidle",
        )
        ready(page)
        for ident in (
            "qwen25-gsm8k-b128-target-only-20260913",
            "qwen25-gsm8k-b128-vspec-draft-adaptive-20260913",  # pragma: allowlist secret
        ):
            click_point(page, page.locator(f'[data-point="{ident}"]'))
            expect(page.locator("[data-benchmark-point] a")).to_have_attribute(
                "href", prefix + registry["frontier_points"][ident]["links"][0]["path"]
            )
            page.locator("#frontier-popover [data-close]").click()
        page.close()
        # A corrupted registry must never redirect users to unverified evidence.
        page = browser.new_page()
        page.route(
            "**/data/benchmark-evidence-links.json",
            lambda route: route.fulfill(body="{}", content_type="application/json"),
        )
        page.goto(
            f"{args.url}/leaderboard-runs.html#frontier", wait_until="networkidle"
        )
        ready(page)
        click_point(page, page.locator("[data-point]").first)
        expect(page.locator("[data-benchmark-point]")).to_contain_text("unverified")
        expect(page.locator("[data-benchmark-point] a")).to_have_count(0)
        browser.close()
    (args.output / "verification.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        f"PASS: {len(results)} desktop/mobile × language × theme cases; integrity failure closed"
    )


if __name__ == "__main__":
    main()
