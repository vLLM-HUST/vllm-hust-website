"""Check rendered links and bilingual layouts in the final public artifact."""

import argparse
import asyncio
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

from playwright.async_api import async_playwright


async def verify(args):
    root = args.root.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((root / "data/benchmark-source-manifest.json").read_text())
    for item in manifest["files"]:
        raw = (root / item["website_path"]).read_bytes()
        assert len(raw) == item["bytes"]
        assert hashlib.sha256(raw).hexdigest() == item["sha256"], item["website_path"]
    receipts = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path=args.browser)
        semaphore = asyncio.Semaphore(3)

        async def inspect(name, width):
            async with semaphore:
                context = await browser.new_context(
                    viewport={"width": width, "height": 900}, locale="zh-CN"
                )
                page = await context.new_page()
                errors, failed = [], []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on(
                    "response",
                    lambda response: (
                        failed.append(response.url)
                        if response.status >= 400 and response.url.startswith(args.url)
                        else None
                    ),
                )
                record = {"page": name, "width": width, "languages": []}
                try:
                    response = await page.goto(
                        f"{args.url.rstrip('/')}/{name}", wait_until="networkidle"
                    )
                    assert response.status == 200
                    if name == "serving-plan.html":
                        await page.locator("#cost").fill("1200")
                        await page.locator("#days").fill("28")
                        await page.locator("#unit").select_option("month")
                    for language in ("zh", "en"):
                        if await page.locator("html").get_attribute("lang") != language:
                            await page.locator("#langToggle").click()
                        assert await page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth + 1"
                        )
                        body = await page.locator("body").inner_text()
                        assert not re.search(
                            r"\b(?:undefined|NaN)\b|\[object Object\]", body
                        ), body
                        if name == "serving-plan.html":
                            assert await page.locator("#cost").input_value() == "1200"
                            assert await page.locator("#days").input_value() == "28"
                            assert await page.locator("#unit").input_value() == "month"
                            assert not await page.locator("#error").is_visible()
                            assert await page.locator(".value-column").count() > 0
                        links = await page.locator("a[href]").evaluate_all(
                            "aa=>aa.map(a=>a.href)"
                        )
                        for href in links:
                            parsed = urlsplit(href)
                            if parsed.netloc != urlsplit(args.url).netloc:
                                continue
                            target = root / unquote(parsed.path).lstrip("/")
                            if target.is_dir():
                                target /= "index.html"
                            assert target.is_file(), f"Missing local link: {href}"
                        restricted = page.locator("[data-repository-access]")
                        for link in await restricted.all():
                            assert await link.get_attribute("href") is None
                            assert await link.get_attribute("title") == (
                                "需仓库权限"
                                if language == "zh"
                                else "Repository access required"
                            )
                        for identity, zh, en in (
                            ("coverage-summary", "覆盖与缺口", "Coverage and gaps"),
                            (
                                "fixed-targets-summary",
                                "固定目标与版本对比",
                                "Fixed targets and version comparisons",
                            ),
                        ):
                            title = page.locator(f"#{identity}")
                            if await title.count():
                                assert await title.inner_text() == (
                                    zh if language == "zh" else en
                                )
                        assert not errors, errors
                        assert not failed, failed
                        record["languages"].append(language)
                        await page.screenshot(
                            path=str(args.output / f"{name}-{width}-{language}.png")
                        )
                    record["status"] = "passed"
                except Exception as error:
                    record.update(status="failed", error=str(error))
                receipts.append(record)
                print(json.dumps(record, ensure_ascii=False), flush=True)
                await context.close()

        await asyncio.gather(
            *(
                inspect(path.name, width)
                for path in root.glob("*.html")
                for width in (390, 1440)
            )
        )
        page = await browser.new_page()
        await page.route("**/data/ecosystem.json*", lambda route: route.abort())
        await page.goto(f"{args.url.rstrip('/')}/", wait_until="networkidle")
        for _ in range(2):
            assert "40" not in await page.locator("#home-kicker").inner_text()
            assert "40" not in await page.locator("#home-primary-cta").inner_text()
            await page.locator("#langToggle").click()
        await browser.close()
    (args.output / "receipt.json").write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + "\n"
    )
    assert all(row["status"] == "passed" for row in receipts), "See receipt.json"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--browser")
    parser.add_argument("--output", type=Path, required=True)
    asyncio.run(verify(parser.parse_args()))
