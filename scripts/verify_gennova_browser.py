"""Check standalone engine presentation in both languages, themes and viewports."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8777")
    parser.add_argument("--browser", help="Optional installed Chromium executable")
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/gennova")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    records = []
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=args.browser)
        for width in (1440, 390):
            for language in ("zh", "en"):
                for theme in ("light", "dark"):
                    page = browser.new_page(
                        viewport={"width": width, "height": 1000}, color_scheme=theme
                    )
                    errors = []
                    page.on(
                        "pageerror",
                        lambda error, errors=errors: errors.append(str(error)),
                    )
                    page.add_init_script(
                        f"localStorage.setItem('vllm-hust_lang', '{language}')"
                    )
                    response = page.goto(args.url + "/gennova.html")
                    assert response.status == 200
                    expect(page.locator("#gn-metrics")).to_be_visible()
                    expect(page.locator("#gn-throughput")).to_have_text("828.62")
                    expect(page.locator("#gn-requests")).to_have_text("200 / 200")
                    expect(page.locator("#gn-evidence a")).to_have_count(4)
                    expected_ink = (
                        "rgb(25, 43, 41)" if theme == "light" else "rgb(225, 234, 229)"
                    )
                    assert (
                        page.locator("h1").evaluate("e => getComputedStyle(e).color")
                        == expected_ink
                    )
                    assert (
                        page.locator("#validation h2").evaluate(
                            "e => getComputedStyle(e).color"
                        )
                        == expected_ink
                    )
                    assert (
                        "独立推理引擎" in page.locator("main").inner_text()
                        if language == "zh"
                        else "Independent inference engine"
                        in page.locator("main").inner_text()
                    )
                    assert page.locator("h1 img").evaluate(
                        "e => e.complete && e.naturalWidth > 0"
                    )
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth"
                    )
                    links = page.locator("#gn-evidence a").evaluate_all(
                        "xs => xs.map(x => x.href)"
                    )
                    assert all(
                        "/blob/b80727393ed07a12a4dfbb5d8006c7ac8c221346/reports/gennova-mmlu-pro-20261023/"  # pragma: allowlist secret
                        in link
                        for link in links
                    )
                    page.screenshot(
                        path=str(args.output / f"{width}-{language}-{theme}.png"),
                        full_page=True,
                    )
                    page.locator("#langToggle").click()
                    expect(page.locator("#gn-throughput")).to_have_text("828.62")
                    assert not errors, errors
                    records.append(
                        dict(
                            width=width,
                            language=language,
                            theme=theme,
                            links=links,
                            status="passed",
                        )
                    )
                    page.close()
        page = browser.new_page(viewport={"width": 390, "height": 1000})
        for path in ("index.html", "plugins.html"):
            page.goto(args.url + "/" + path)
            link = page.locator('#independent-engines a[href="./gennova.html"]')
            link.click()
            expect(page.locator("#gn-metrics")).to_be_visible()
            page.locator("#navToggle").click()
            group = page.locator('[data-nav-group="engine"]')
            if not group.evaluate("e => e.open"):
                group.locator("summary").click()
            expect(
                page.locator('[data-nav-group="engine"] a[href="./gennova.html"]')
            ).to_be_visible()
        page.route(
            "**/data/gennova-validation-v1.json",
            lambda route: route.fulfill(status=503, body="unavailable"),
        )
        page.goto(args.url + "/gennova.html")
        expect(page.locator("#gn-status")).to_contain_text("unavailable")
        expect(page.locator("#gn-metrics")).to_be_hidden()
        expect(page.locator("#gn-evidence a")).to_have_count(1)
        browser.close()
    (args.output / "results.json").write_text(json.dumps(records, indent=2) + "\n")
    print(
        "GenNova: 8 language/theme/viewport combinations, entry links and failure state passed"
    )


if __name__ == "__main__":
    main()
