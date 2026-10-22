"""Collect rendered evidence links across public entry pages without modifying data."""

import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright


async def run(args):
    root = Path(__file__).resolve().parents[1]
    pages = sorted(p.name for p in root.glob("*.html"))
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path=args.browser)
        semaphore = asyncio.Semaphore(3)

        async def inspect(filename):
            async with semaphore:
                context = await browser.new_context(
                    viewport={"width": 1440, "height": 1000}
                )
                page = await context.new_page()
                errors, failed = [], []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on(
                    "response",
                    lambda response: (
                        failed.append({"url": response.url, "status": response.status})
                        if response.status >= 400
                        else None
                    ),
                )
                record = {
                    "page": filename,
                    "errors": errors,
                    "failed_responses": failed,
                }
                try:
                    response = await page.goto(
                        f"{args.url.rstrip('/')}/{filename}",
                        wait_until="networkidle",
                        timeout=45000,
                    )
                    record["status"] = response.status
                    record["links"] = await page.locator("a[href]").evaluate_all(
                        "nodes => nodes.map(a => ({href:a.href, text:a.textContent.trim(), visible:!!a.getClientRects().length, section:a.closest('section')?.id || '', classes:a.className}))"
                    )
                    record["tables"] = await page.locator("main table").count()
                    record["title"] = await page.title()
                    await page.screenshot(
                        path=str(output / f"{filename}.png"), full_page=True
                    )
                except Exception as error:
                    record["error"] = str(error)
                results.append(record)
                print(
                    filename,
                    record.get("status"),
                    len(record.get("links", [])),
                    record.get("error", ""),
                    flush=True,
                )
                await context.close()

        await asyncio.gather(*(inspect(p) for p in pages))
        await browser.close()
    (output / "links.json").write_text(
        json.dumps(
            {"url": args.url, "pages": sorted(results, key=lambda r: r["page"])},
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    assert all(
        r.get("status") == 200
        and not r.get("error")
        and not r["errors"]
        and not r["failed_responses"]
        for r in results
    ), "Browser audit failed; inspect links.json"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--browser")
    parser.add_argument("--output", required=True)
    asyncio.run(run(parser.parse_args()))
