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
                        if name == "engine.html":
                            command = await page.locator(
                                "#engine-install-command"
                            ).inner_text()
                            assert command.strip() == (
                                "python -m pip install --no-deps -r "
                                "https://vllm-hust.sage.org.ai/wheels/r8.txt"
                            )
                            assert (
                                "curl " not in command
                                and "install-engine-r8.py" not in command
                            )
                            manifest = root / "wheels/r8.txt"
                            fetched = await page.request.get(
                                f"{args.url.rstrip('/')}/wheels/r8.txt"
                            )
                            assert fetched.status == 200
                            assert await fetched.body() == manifest.read_bytes()
                            requirements = [
                                line
                                for line in manifest.read_text().splitlines()
                                if line and not line.startswith(("#", "--"))
                            ]
                            assert len(requirements) == 4
                            assert any(
                                line.startswith("vllm-hust-engine==2026.11.17.8.post2 ")
                                for line in requirements
                            )
                            assert all(
                                re.search(r" --hash=sha256:[a-f0-9]{64}$", line)
                                for line in requirements
                            )
                            assert "--require-hashes" in manifest.read_text()
                            index = root / "wheels/r8.html"
                            download = await page.request.get(
                                f"{args.url.rstrip('/')}/wheels/r8.html"
                            )
                            assert download.status == 200
                            assert await download.body() == index.read_bytes()
                            wheel_links = re.findall(
                                r'href="([^\"]+)"', index.read_text()
                            )
                            assert len(wheel_links) == 3
                            for link in wheel_links:
                                assert link.startswith(
                                    "https://github.com/vLLM-HUST/vllm-hust-website/releases/download/engine-wheels-r8-v1/"
                                )
                                assert re.search(
                                    r"-cp312-cp312-linux_aarch64\.whl#sha256=[a-f0-9]{64}$",
                                    link,
                                )
                            assert any(
                                "vllm-0.28.1.post1.dev143" in link
                                for link in wheel_links
                            )
                            assert any(
                                "vllm_ascend-0.25.1rc2.dev125" in link
                                for link in wheel_links
                            )
                            assert any(
                                "vllm_hust_runtime-2026.11.17.8+r8.3f7eacc1" in link
                                for link in wheel_links
                            )
                            assert not await page.locator(
                                "#engine-install-details"
                            ).evaluate("e => e.parentElement.open")
                            await page.locator("#engine-install-details").click()
                            assert (
                                "Torch 2.13.0+cpu"
                                in await page.locator(
                                    "#engine-install-deps"
                                ).inner_text()
                            )
                            await page.locator("#engine-install-details").click()
                        if name == "test-plan.html":
                            active = page.locator(f'[data-plan-lang="{language}"]')
                            assert await active.is_visible()
                            assert await active.locator("tbody tr").count() == 9
                            contrast = await active.evaluate(
                                r"""root => {
                                  const rgb = value => value.match(/[\d.]+/g).map(Number).slice(0, 3);
                                  const luminance = color => rgb(color).map(v => {
                                    v /= 255;
                                    return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
                                  }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
                                  return Array.from(root.querySelectorAll('td, th, article, details, pre')).map(node => {
                                    const style = getComputedStyle(node);
                                    let parent = node;
                                    while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
                                    const background = parent ? getComputedStyle(parent).backgroundColor : 'rgb(3, 7, 18)';
                                    const values = [luminance(style.color), luminance(background)].sort((a, b) => b - a);
                                    return (values[0] + .05) / (values[1] + .05);
                                  });
                                }"""
                            )
                            assert contrast and min(contrast) >= 4.5, contrast
                            details = active.locator("details")
                            assert await details.count() == 5
                            await page.goto(
                                f"{args.url.rstrip('/')}/test-plan.html#compute-{language}"
                            )
                            assert await active.locator("details").first.evaluate(
                                "element => element.open"
                            )
                            await active.locator("details > summary").first.click()
                            assert not await active.locator("details").first.evaluate(
                                "element => element.open"
                            )
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
            kicker = await page.locator("#home-kicker").inner_text()
            cta = await page.locator("#home-primary-cta").inner_text()
            assert "MOD" in kicker and "MOD" in cta
            assert "40" not in kicker and "40" not in cta
            assert "stateaxis" not in f"{kicker} {cta}".lower()
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
