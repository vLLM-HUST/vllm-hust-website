"""Collect rendered evidence links across public entry pages without modifying data."""

import argparse
import asyncio
import base64
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit


def evidence_urls(value, revision):
    """Include registry entries behind unselected controls, not only DOM links."""
    urls = set()
    if isinstance(value, dict):
        if value.get("kind") in ("blob", "tree") and value.get("path"):
            urls.add(
                "https://github.com/vLLM-HUST/vllm-hust-benchmark/"
                f"{value['kind']}/{revision}/{value['path']}"
            )
        for child in value.values():
            urls.update(evidence_urls(child, revision))
    elif isinstance(value, list):
        for child in value:
            urls.update(evidence_urls(child, revision))
    elif isinstance(value, str) and value.startswith(
        "https://github.com/vLLM-HUST/vllm-hust-benchmark/"
    ):
        urls.add(value)
    return urls


async def publication_evidence(request, base):
    response = await request.get(f"{base}/data/benchmark-source-manifest.json")
    assert response.ok, response.status
    manifest = await response.json()
    urls, receipts = set(), []
    for name in ("benchmark-evidence-links.json", "midterm-v076.json"):
        path = f"data/{name}"
        entry = next(row for row in manifest["files"] if row["website_path"] == path)
        response = await request.get(f"{base}/{path}")
        assert response.ok, (path, response.status)
        body = await response.body()
        digest = hashlib.sha256(body).hexdigest()
        assert digest == entry["sha256"] and len(body) == entry["bytes"], path
        payload = json.loads(body)
        urls.update(evidence_urls(payload, manifest["commit"]))
        receipts.append({"path": path, "sha256": digest, "bytes": len(body)})
        if name == "midterm-v076.json":
            report_path = "reports/vllm-hust-midterm-20261019/中期测试报告.md"
            report_url = (
                "https://api.github.com/repos/vLLM-HUST/vllm-hust-benchmark/contents/"
                f"{report_path}?ref={payload['source_commit']}"
            )
            report_headers = {"Accept": "application/vnd.github+json"}
            if os.environ.get("GH_TOKEN"):
                report_headers["Authorization"] = f"Bearer {os.environ['GH_TOKEN']}"
            report_response = await request.get(
                report_url, headers=report_headers, timeout=60000, max_retries=2
            )
            assert report_response.ok, (report_url, report_response.status)
            report_object = await report_response.json()
            assert report_object["encoding"] == "base64"
            report_body = base64.b64decode(report_object["content"])
            assert hashlib.sha256(report_body).hexdigest() == payload["report_sha256"]
            assert "报告版本：V0.76" in report_body.decode()
            receipts.append(
                {
                    "path": report_url,
                    "sha256": payload["report_sha256"],
                    "bytes": len(report_body),
                }
            )
    return urls, {"commit": manifest["commit"], "files": receipts}


async def verify_targets(request, urls):
    """Resolve file/directory links against complete Git trees, not rate-limited HTML."""
    headers = {"Accept": "application/vnd.github+json"}
    if os.environ.get("GH_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GH_TOKEN']}"
    trees, releases, checked = {}, {}, []
    api = "https://api.github.com/repos/vLLM-HUST/vllm-hust-benchmark"
    for url in sorted(urls):
        parsed = urlsplit(url)
        parts = unquote(parsed.path).split("/")
        if (
            parsed.hostname != "github.com"
            or parts[1:3] != ["vLLM-HUST", "vllm-hust-benchmark"]
            or len(parts) < 6
        ):
            continue
        if parts[3] in ("blob", "tree", "raw"):
            revision, path = parts[4], "/".join(parts[5:])
            if revision not in trees:
                response = await request.get(
                    f"{api}/git/trees/{revision}?recursive=1",
                    headers=headers,
                    timeout=60000,
                )
                assert response.ok, (revision, response.status)
                tree = await response.json()
                assert not tree["truncated"], revision
                trees[revision] = {item["path"]: item["type"] for item in tree["tree"]}
            kind = "tree" if parts[3] == "tree" else "blob"
            assert trees[revision].get(path) == kind, url
        elif parts[3] == "releases" and parts[4] in ("tag", "download"):
            tag = parts[5]
            if tag not in releases:
                response = await request.get(
                    f"{api}/releases/tags/{tag}", headers=headers, timeout=60000
                )
                assert response.ok, (tag, response.status)
                releases[tag] = await response.json()
            if parts[4] == "download":
                assert any(
                    a["name"] == "/".join(parts[6:]) and a["state"] == "uploaded"
                    for a in releases[tag]["assets"]
                ), url
        else:
            continue
        checked.append(url)
    return checked


async def run(args):
    from playwright.async_api import async_playwright

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
        if args.verify_targets:
            context = await browser.new_context()
            urls = {link["href"] for row in results for link in row.get("links", [])}
            publication_urls, identity = await publication_evidence(
                context.request, args.url.rstrip("/")
            )
            urls.update(publication_urls)
            identity["registry_and_report_destinations"] = len(publication_urls)
            (output / "publication-identity.json").write_text(
                json.dumps(identity, indent=2) + "\n"
            )
            checked = await verify_targets(context.request, urls)
            (output / "verified-targets.json").write_text(
                json.dumps(checked, indent=2) + "\n"
            )
            print(
                f"Verified {len(checked)} benchmark Git/Release destinations",
                flush=True,
            )
            await context.close()
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
    parser.add_argument("--verify-targets", action="store_true")
    asyncio.run(run(parser.parse_args()))
