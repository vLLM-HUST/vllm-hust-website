"""Whole-site readability and navigation checks, plus calculator state preservation."""

import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright, expect


async def run(args):
    root = Path(__file__).resolve().parents[1]
    pages = sorted(p.name for p in root.glob("*.html"))
    args.output.mkdir(parents=True, exist_ok=True)
    receipts = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        semaphore = asyncio.Semaphore(3)

        async def inspect(filename, width, lang, theme):
            async with semaphore:
                context = await browser.new_context(
                    viewport={"width": width, "height": 1000}, color_scheme=theme
                )
                await context.add_init_script(
                    f"localStorage.setItem('vllm-hust_lang','{lang}')"
                )
                page = await context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                record = {
                    "page": filename,
                    "width": width,
                    "language": lang,
                    "theme": theme,
                }
                try:
                    response = await page.goto(
                        f"{args.url}/{filename}",
                        wait_until="networkidle",
                        timeout=60000,
                    )
                    assert response.status == 200
                    assert await page.locator("main").is_visible()
                    assert await page.locator(".brand-mark").inner_text() == "V", (
                        filename
                    )
                    assert await page.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth + 1"
                    ), filename
                    if filename in (
                        "conferences.html",
                        "courses.html",
                        "contributors.html",
                        "issues.html",
                        "members.html",
                        "news.html",
                        "resources.html",
                        "versions.html",
                    ):
                        labels = page.locator(".content-panel .eyebrow").filter(
                            visible=True
                        )
                        record["surface_labels"] = await labels.evaluate_all(
                            "ee=>ee.map(e=>({text:e.textContent.trim(),color:getComputedStyle(e).color,hero:!!e.closest('.page-hero')}))"
                        )
                        assert all(
                            r["color"]
                            == ("rgb(244, 196, 99)" if r["hero"] else "rgb(121, 83, 0)")
                            for r in record["surface_labels"]
                        ), record["surface_labels"]
                    assert (
                        await page.locator(".site-nav").evaluate(
                            "e=>getComputedStyle(e).backgroundColor"
                        )
                        == "rgb(12, 17, 18)"
                    )
                    assert (
                        await page.locator(".brand-mark").evaluate(
                            "e=>getComputedStyle(e).backgroundColor"
                        )
                        == "rgb(240, 179, 65)"
                    )
                    if filename == "index.html" and width == 390:
                        await expect(page.locator(".inference-fabric")).to_be_hidden()
                    if filename == "versions.html":
                        await expect(
                            page.locator("#versions-verified")
                        ).to_contain_text("2026-10-20")
                        assert await page.locator("#versions-verified").evaluate(
                            "e=>e.getBoundingClientRect().bottom < innerHeight"
                        )
                    if filename == "issues.html":
                        await expect(
                            page.locator("#issues-snapshot-summary")
                        ).to_contain_text("3")
                        await expect(page.locator("#issue-stat-total")).to_be_hidden()
                        await expect(
                            page.locator("#issues-source-link")
                        ).to_be_visible()
                    if filename == "contributors.html":
                        await expect(
                            page.locator(".research-members-menu")
                        ).to_have_attribute("open", "")
                        await expect(
                            page.locator("#contributors-core-member-list > li").first
                        ).to_be_visible()
                    # Preserve page-specific translation IDs through shared footer rendering.
                    footer = page.locator(".site-directory-brand > span")
                    if await footer.count():
                        await footer.scroll_into_view_if_needed()
                        assert await footer.is_visible()
                        await page.evaluate("window.scrollTo(0,0)")
                    if filename in ("conferences.html", "courses.html", "issues.html"):
                        expected = {
                            "conferences.html": ("会议", "Conference"),
                            "courses.html": ("课程", "Course"),
                            "issues.html": ("议题", "issue"),
                        }[filename][0 if lang == "zh" else 1]
                        await expect(footer).to_contain_text(expected)
                    if filename == "serving-plan.html":
                        if lang == "en":
                            price_copy = await page.locator("#price-note").inner_text()
                            assert "peak-period prices are twice as high" in price_copy
                            assert (
                                "not an official quote for the same checkpoint"
                                in price_copy
                            )
                            assert not any(
                                "\u4e00" <= char <= "\u9fff" for char in price_copy
                            )
                        assert (
                            await page.locator(
                                ".page-hero .content-panel > p"
                            ).last.evaluate("e=>getComputedStyle(e).color")
                            == "rgb(199, 212, 209)"
                        )
                        await expect(
                            page.locator("#columns .value-column")
                        ).not_to_have_count(0)
                        await expect(page.locator("main h1")).to_have_text(
                            "服务产能与成本"
                            if lang == "zh"
                            else "Serving capacity & cost"
                        )
                        await page.locator("#cost").fill("1234")
                        await page.locator("#utilization").fill("60")
                        await page.locator("#unit").select_option("24")
                        await page.locator("#plan-options input").first.uncheck()
                        await page.locator(".controls > details").evaluate(
                            "e=>e.open=true"
                        )
                        price = page.locator("#price-controls input").first
                        await price.fill("2.75")
                        values = await page.locator(
                            "#columns > .column > strong"
                        ).all_text_contents()
                        await page.locator("#langToggle").click()
                        await expect(page.locator("main h1")).to_have_text(
                            "Serving capacity & cost"
                            if lang == "zh"
                            else "服务产能与成本"
                        )
                        await expect(page.locator("#cost")).to_have_value("1234")
                        await expect(page.locator("#utilization")).to_have_value("60")
                        await expect(page.locator("#unit")).to_have_value("24")
                        await expect(price).to_have_value("2.75")
                        await expect(
                            page.locator("#plan-options input").first
                        ).not_to_be_checked()
                        assert (
                            await page.locator(
                                "#columns > .column > strong"
                            ).all_text_contents()
                            == values
                        )
                        assert await page.locator("#price-note a").count() > 0
                        await page.locator("#langToggle").click()
                        await page.locator("#days").fill("0")
                        await expect(page.locator("#error")).to_contain_text(
                            "月份天数" if lang == "zh" else "days per month"
                        )
                        await page.locator("#reset").click()
                        await expect(page.locator("#cost")).to_have_value("")
                        await page.locator(".controls > details").evaluate(
                            "e=>e.open=false"
                        )
                        await page.evaluate("window.scrollTo(0,0)")
                    if filename == "members.html":
                        search = page.locator("[data-member-search]")
                        await search.fill("no-such-member-clarity-test")
                        await expect(
                            page.locator("[data-member-empty]")
                        ).to_be_visible()
                        await search.fill("")
                        await expect(page.locator(".member-card").first).to_be_visible()
                        await page.evaluate("window.scrollTo(0,0)")
                    if width == 390:
                        button = page.locator("#navToggle")
                        await button.click()
                        await expect(button).to_have_attribute("aria-expanded", "true")
                        await page.keyboard.press("Escape")
                        await expect(button).to_have_attribute("aria-expanded", "false")
                    # Check current-page anchors without forcing closed evidence sections open.
                    record["missing_anchors"] = await page.locator(
                        "a[href]"
                    ).evaluate_all(
                        """aa => [...new Set(aa.filter(a => !a.matches('.matrix-dataset') && a.origin===location.origin && a.pathname===location.pathname && a.hash.length>1).map(a=>decodeURIComponent(a.hash.slice(1))).filter(id=>!document.getElementById(id))) ]"""
                    )
                    # Dataset links are hash-router routes, not missing DOM IDs;
                    # their detailed interactions have a dedicated matrix test.
                    record["dataset_routes"] = await page.locator(
                        ".matrix-dataset"
                    ).evaluate_all("aa=>aa.map(a=>a.hash)")
                    assert not record["missing_anchors"], record["missing_anchors"]
                    assert not errors, errors
                    await page.screenshot(
                        path=str(args.output / f"{filename}-{width}-{lang}-{theme}.png")
                    )
                    if width == 1440 and lang == "zh" and theme == "light":
                        await page.screenshot(
                            path=str(args.output / f"{filename}-full.png"),
                            full_page=True,
                        )
                    record["status"] = "passed"
                except Exception as error:
                    record["status"] = "failed"
                    record["error"] = str(error)
                receipts.append(record)
                print(
                    filename,
                    width,
                    lang,
                    theme,
                    record["status"],
                    record.get("error", ""),
                    flush=True,
                )
                await context.close()

        await asyncio.gather(
            *(
                inspect(name, width, lang, theme)
                for name in pages
                for width in (390, 1440)
                for lang in ("zh", "en")
                for theme in ("light", "dark")
            )
        )
        await browser.close()
    (args.output / "receipt.json").write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + "\n"
    )
    assert all(r["status"] == "passed" for r in receipts), (
        "See receipt.json for failures"
    )
    print(f"PASS: {len(receipts)} cases across {len(pages)} public entries")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/public-pages")
    )
    asyncio.run(run(parser.parse_args()))
