"""Validate the actual publication, both languages/themes and rejected provenance."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def verify_navigation(page, width):
    product = page.locator('[data-nav-group="products"]')
    link = product.locator('[data-nav-page="control-plane"]')
    expect(link).to_have_attribute("aria-current", "page")
    expect(product.locator('[data-nav-page="controlplane"]')).to_have_count(0)
    page.wait_for_function(
        """() => {
            const nav = document.querySelector('.site-nav').getBoundingClientRect();
            const heading = document.querySelector('#control-results-title').getBoundingClientRect();
            return heading.top >= nav.bottom && heading.bottom <= innerHeight;
        }""",
        timeout=3000,
    )
    if width <= 860:
        toggle = page.locator("#navToggle")
        toggle.click()
        expect(toggle).to_have_attribute("aria-expanded", "true")
        expect(link).to_be_visible()
        page.keyboard.press("Escape")
        expect(toggle).to_be_focused()
        expect(toggle).to_have_attribute("aria-expanded", "false")
    else:
        product.locator("summary").click()
        expect(link).to_be_visible()
        page.keyboard.press("Escape")
        expect(product.locator("summary")).to_be_focused()


def verify(args):
    args.output.mkdir(parents=True, exist_ok=True)
    receipts = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser)
        manifest = browser.new_context()
        files = manifest.request.get(
            args.url.rstrip("/") + "/data/benchmark-source-manifest.json"
        ).json()["files"]
        published = {row["website_path"] for row in files}
        fixed_path = "data/controller-r8-fixed-profiles-repeat-v1.json"
        streaming_path = "data/controller-r8-streamed-heavy-load-v1.json"
        compute_path = "data/controller-r8-mmlu256-service-compute-v1.json"

        def published_result(path):
            if path not in published:
                return None
            response = manifest.request.get(args.url.rstrip("/") + "/" + path)
            assert response.ok, path
            return response.json()

        fixed, streaming, compute = map(
            published_result, (fixed_path, streaming_path, compute_path)
        )
        manifest.close()
        for width in (1440, 390):
            for theme in ("light", "dark"):
                context = browser.new_context(
                    viewport={"width": width, "height": 1000}, color_scheme=theme
                )
                page = context.new_page()
                errors = []
                page.on(
                    "pageerror", lambda error, errors=errors: errors.append(str(error))
                )
                response = page.goto(
                    args.url.rstrip("/") + "/controlplane/#results",
                    wait_until="networkidle",
                )
                assert response.status == 200
                verify_navigation(page, width)
                root = page.locator("#control-results")
                expect(root).to_have_attribute("aria-busy", "false")
                assert not root.get_attribute("data-error"), root.inner_text()
                options = page.locator("#control-release option").evaluate_all(
                    "items=>items.map(v=>v.value)"
                )
                for language in ("en", "zh"):
                    if page.locator("html").get_attribute("lang") != language:
                        page.locator("#langToggle").click()
                    product_links = page.locator('[data-nav-group="products"] a')
                    expect(product_links).to_have_text(
                        ["首页", "引擎", "控制面", "智能体工作环境"]
                        if language == "zh"
                        else ["Home", "Engine", "Control Plane", "Agent Workspace"]
                    )
                    expect(page.locator("#control-title")).to_have_text(
                        "请求限流控制器"
                        if language == "zh"
                        else "Request Throttling Controller"
                    )
                    expect(page.locator("#control-product-link")).to_have_attribute(
                        "href", "./control-plane.html"
                    )
                    expect(page).to_have_title(
                        "请求限流控制器 · 引擎控制面 | vLLM-HUST"
                        if language == "zh"
                        else "Request Throttling Controller | vLLM-HUST"
                    )
                    expect(page.locator("#control-deploy-copy")).to_contain_text(
                        "请求限流控制器"
                        if language == "zh"
                        else "Request Throttling Controller"
                    )
                    expect(
                        page.locator("#control-release option").first
                    ).to_contain_text(
                        "请求限流控制器"
                        if language == "zh"
                        else "Request Throttling Controller"
                    )
                    for identity in options:
                        page.locator("#control-release").select_option(identity)
                        expect(root).to_have_attribute("data-loaded", identity)
                        assert page.locator("#control-release").evaluate(
                            "(e)=>document.activeElement===e"
                        )
                        assert page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth + 1"
                        )
                        text = root.inner_text()
                        assert all(
                            word not in text
                            for word in ("undefined", "NaN", "[object Object]")
                        )
                        assert page.locator(".control-summary article").count() == 4
                        assert page.locator(".control-bar-line").count() == 2
                        expect(
                            root.locator(
                                'a[href="./b0-b1.html?release=r8&controlplane=request-throttling"]'
                            )
                        ).to_have_count(1 if fixed and identity == "r8" else 0)
                        for detail in page.locator(".control-details").all():
                            detail.locator("summary").focus()
                            page.keyboard.press("Enter")
                            assert detail.get_attribute("open") is not None
                        if identity == options[0]:
                            rows = (
                                page.locator(".control-table")
                                .nth(1)
                                .locator("tbody tr th")
                                .all_text_contents()
                            )
                            assert rows == [
                                "MMLU-Pro",
                                "Humanity’s Last Exam",
                                "FrontierScience",
                                "SWE-bench Pro public trace",
                                "Terminal-Bench public trace",
                            ], rows
                            if fixed and identity == "r8":
                                hle = next(
                                    row
                                    for row in fixed["profiles"]
                                    if row["id"] == "hle"
                                )
                                row = (
                                    root.get_by_role("row")
                                    .filter(has_text="Humanity’s Last Exam")
                                    .first
                                )
                                expect(row.locator("td").first).to_have_text(
                                    f"{hle['direct']['elapsed_seconds']:,.2f}"
                                )
                                for side in ("direct", "controller"):
                                    groups = hle[side]["quality"]["groups"].values()
                                    correct = sum(
                                        group["successes"] for group in groups
                                    )
                                    total = sum(group["total"] for group in groups)
                                    assert f"{correct} / {total}" in root.text_content()
                            else:
                                assert (
                                    "暂缓" if language == "zh" else "Deferred"
                                ) in text
                        if streaming and identity == "r8":
                            values = [
                                f"{streaming[side]['elapsed_seconds']:,.2f} s"
                                for side in ("direct", "controller")
                            ]
                            expect(
                                root.locator(".control-bar-line output")
                            ).to_have_text(values)
                            expect(
                                root.locator(f'a[href="./{streaming_path}"]')
                            ).to_have_count(1)
                        if compute and identity == "r8":
                            expect(
                                root.get_by_role(
                                    "heading",
                                    name=(
                                        "服务侧矩阵算力下界"
                                        if language == "zh"
                                        else "Service-side matrix compute lower bound"
                                    ),
                                )
                            ).to_be_visible()
                            expect(root).to_contain_text("V2 4.1")
                            expect(
                                root.locator(f'a[href="./{compute_path}"]')
                            ).to_have_count(1)
                        else:
                            expect(
                                root.locator(f'a[href="./{compute_path}"]')
                            ).to_have_count(0)
                        await_name = f"{identity}-{width}-{theme}-{language}.png"
                        page.evaluate("window.scrollTo(0, 0)")
                        page.screenshot(
                            path=str(args.output / await_name), full_page=True
                        )
                assert not errors, errors
                links = page.locator('.nav-links a[href*="controlplane"]').all()
                assert len(links) == 0
                receipts.append(
                    {
                        "width": width,
                        "theme": theme,
                        "languages": ["en", "zh"],
                        "versions": options,
                        "status": "passed",
                    }
                )
                context.close()
        page = browser.new_page()
        page.goto(args.url.rstrip("/") + "/controlplane/?release=r6#results")
        expect(page.locator("#control-results")).to_have_attribute("data-loaded", "r6")
        page.close()
        if fixed and streaming and compute:
            page = browser.new_page()
            for path in (fixed_path, streaming_path, compute_path):
                page.route(
                    "**/" + path,
                    lambda route: route.fulfill(
                        status=200, content_type="application/json", body="{}"
                    ),
                )
            page.goto(args.url.rstrip("/") + "/controlplane/?release=r8#results")
            root = page.locator("#control-results")
            expect(root).to_have_attribute("data-loaded", "r8")
            expect(root.locator(".control-summary")).to_have_count(1)
            for path in (fixed_path, streaming_path, compute_path):
                expect(root.locator(f'a[href="./{path}"]')).to_have_count(0)
            receipts.append(
                {"rejection": "optional supplement checksum", "status": "passed"}
            )
            page.close()
        for failure in ("checksum", "publisher", "missing"):
            context = browser.new_context()
            page = context.new_page()
            if failure == "checksum":
                page.route(
                    "**/data/controller-product-results-v1.json",
                    lambda route: route.fulfill(
                        status=200, content_type="application/json", body="{}"
                    ),
                )
            elif failure == "publisher":
                page.route(
                    "**/data/benchmark-source-manifest.json",
                    lambda route: route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps(
                            {
                                "repository": "untrusted/source",
                                "status": "published-source",
                                "commit": "a" * 40,
                            }
                        ),
                    ),
                )
            else:
                page.route(
                    "**/data/controller-product-results-v1.json",
                    lambda route: route.fulfill(status=404, body="Missing"),
                )
            page.goto(args.url.rstrip("/") + "/controlplane/", wait_until="networkidle")
            root = page.locator("#control-results")
            expect(root).to_have_attribute("aria-busy", "false")
            assert root.get_attribute("data-error")
            assert root.locator(".control-summary").count() == 0
            receipts.append({"rejection": failure, "status": "passed"})
            context.close()
        for width, theme in ((1440, "light"), (390, "dark")):
            context = browser.new_context(
                viewport={"width": width, "height": 1000}, color_scheme=theme
            )
            page = context.new_page()
            root_url = args.url.rstrip("/")
            page.goto(root_url + "/control-plane.html#components")
            cards = page.locator("#components .engine-cards article")
            expect(cards).to_have_count(3)
            expect(
                page.locator("#instance-scaling-results, #kv-routing-results")
            ).to_have_count(0)
            for index, path in enumerate(
                ("controlplane/instance/", "controlplane/kv/", "controlplane/")
            ):
                card = cards.nth(index)
                expect(card.locator("a").first).to_have_attribute("href", f"./{path}")
                expect(card.locator("a").last).to_have_attribute(
                    "href", f"./{path}#results"
                )
                card.locator("a").last.click()
                expect(
                    page.locator(".controller-navigation a[aria-current=page]")
                ).to_have_attribute("href", f"./{path}")
                expect(page.locator("#results")).to_be_visible()
                expect(page.locator("#deploy")).to_be_visible()
                page.go_back()
            page.goto(root_url + "/control-plane.html#kv-routing-results")
            expect(page).to_have_url(root_url + "/controlplane/kv/#results")
            routing = page.locator("#kv-routing-results")
            expect(routing).to_have_attribute("data-loaded", "0.1.6")
            expect(routing.locator("tbody tr")).to_have_count(2)
            expect(routing.locator("tbody tr").last).to_contain_text("+17.25%")
            for language, verdict in (("zh", "通过"), ("en", "Passed")):
                if page.locator("html").get_attribute("lang") != language:
                    page.locator("#langToggle").click()
                expect(
                    routing.get_by_role("cell", name=verdict, exact=True)
                ).to_be_visible()
                expect(page).to_have_title(
                    "缓存控制器 · vLLM-HUST"
                    if language == "zh"
                    else "KV Controller · vLLM-HUST"
                )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth + 1"
                )
            page.goto(
                args.url.rstrip("/") + "/control-plane.html#instance-scaling-results"
            )
            expect(page).to_have_url(root_url + "/controlplane/instance/#results")
            scaling = page.locator("#instance-scaling-results")
            expect(scaling).to_have_attribute(
                "data-loaded", "instance-controller-scaling/v1"
            )
            expect(scaling.locator("tbody tr")).to_have_count(2)
            page.wait_for_function("""() => {
                    const nav = document.querySelector('.site-nav').getBoundingClientRect();
                    const heading = document.querySelector('#results-title').getBoundingClientRect();
                    return heading.top >= nav.bottom && heading.bottom <= innerHeight;
                }""")
            publication = page.request.get(
                args.url.rstrip("/") + "/data/instance-controller-scaling-v1.json"
            ).json()
            for index, scenario in enumerate(publication["scenarios"]):
                row = scaling.locator("tbody tr").nth(index)
                fixed, dynamic = scenario["fixed"], scenario["dynamic"]
                expect(row).to_contain_text(f"{scenario['completed_per_arm']:,}")
                expect(row).to_contain_text(
                    f"{fixed['p95_latency_seconds']:.2f} → {dynamic['p95_latency_seconds']:.2f}"
                )
                expect(row).to_contain_text(
                    f"{fixed['mean_reserved_replicas']:.3f} → {dynamic['mean_reserved_replicas']:.3f}"
                )
            for language, title in (
                ("zh", "实例控制器扩缩容实测"),
                ("en", "Instance Controller scaling benchmark"),
            ):
                if page.locator("html").get_attribute("lang") != language:
                    page.locator("#langToggle").click()
                expect(scaling.get_by_role("heading", name=title)).to_be_visible()
                expect(page).to_have_title(
                    "实例控制器 · vLLM-HUST"
                    if language == "zh"
                    else "Instance Controller · vLLM-HUST"
                )
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth + 1"
                )
            context.close()

        page = browser.new_page()
        page.route(
            "**/data/kv-controller-routing-v1.json",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body="{}"
            ),
        )
        page.goto(args.url.rstrip("/") + "/controlplane/kv/#results")
        routing = page.locator("#kv-routing-results")
        expect(routing).to_have_attribute("aria-busy", "false")
        expect(routing.locator("table")).to_have_count(0)
        assert not routing.get_attribute("data-loaded")
        receipts.append(
            {
                "kv_routing": "both languages, desktop/mobile and checksum rejection passed"
            }
        )
        page.close()
        page = browser.new_page()
        page.route(
            "**/data/instance-controller-scaling-v1.json",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body="{}"
            ),
        )
        page.goto(args.url.rstrip("/") + "/controlplane/instance/#results")
        scaling = page.locator("#instance-scaling-results")
        expect(scaling).to_have_attribute("aria-busy", "false")
        expect(scaling.locator("table")).to_have_count(0)
        assert not scaling.get_attribute("data-loaded")
        receipts.append(
            {
                "instance_scaling": "both languages, desktop/mobile and checksum rejection passed"
            }
        )
        browser.close()
    (args.output / "receipt.json").write_text(json.dumps(receipts, indent=2) + "\n")
    print(json.dumps(receipts, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--browser")
    verify(parser.parse_args())
