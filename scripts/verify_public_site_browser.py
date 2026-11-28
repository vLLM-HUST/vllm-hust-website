"""Check rendered links and bilingual layouts in the final public artifact."""

import argparse
import asyncio
import hashlib
import json
import os
import re
import shlex
from pathlib import Path
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen

from playwright.async_api import async_playwright


def release_request(url, accept):
    request = Request(
        url,
        headers={"Accept": accept, "User-Agent": "vllm-hust-public-site-audit"},
    )
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        request.add_unredirected_header("Authorization", f"Bearer {token}")
    return request


def read_release_asset(index, url):
    matches = [
        asset for asset in index["assets"] if asset["browser_download_url"] == url
    ]
    assert len(matches) == 1, f"Missing stable release asset: {url}"
    asset = matches[0]
    size = asset["size"]
    assert 0 < size <= 65536
    api_url = asset["url"]
    assert api_url == (
        "https://api.github.com/repos/vLLM-HUST/vllm-hust-website/releases/assets/"
        + str(asset["id"])
    )
    request = release_request(api_url + "?download=1", "application/octet-stream")
    with urlopen(request, timeout=30) as response:
        raw = response.read(size + 1)
    assert len(raw) == size
    assert asset["digest"] == "sha256:" + hashlib.sha256(raw).hexdigest()
    return raw


def verify_stable_install_manifest(release, stable):
    url = stable["install_manifest_url"]
    mirror_prefix = "https://github.com/vLLM-HUST/vllm-hust-website/releases/download/"
    assert url.startswith(mirror_prefix)
    tag, _, filename = url.removeprefix(mirror_prefix).partition("/")
    assert re.fullmatch(r"engine-wheels-r[1-9][0-9]*-v[1-9][0-9]*", tag)
    assert filename and "/" not in filename
    request = release_request(
        "https://api.github.com/repos/vLLM-HUST/vllm-hust-website/releases/tags/" + tag,
        "application/vnd.github+json",
    )
    with urlopen(request, timeout=30) as response:
        index = json.load(response)
    assert index["tag_name"] == tag
    lines = read_release_asset(index, url).decode().splitlines()
    assert "--require-hashes" in lines, "Missing hash requirement"
    receipt = json.loads(read_release_asset(index, stable["arm64_acceptance_url"]))
    assert receipt["release"] == release["release"]
    filename = f"vllm_hust_engine-{stable['pypi_version']}.tar.gz"
    prefix = url.rsplit("/", 1)[0] + "/"
    if release.get("r10_revision") or release.get("full_acceptance"):
        assert receipt["version"] == stable["pypi_version"]
        assert receipt["serve_dry_run"]
        if release.get("full_acceptance"):
            assert receipt["arm64_clean_install"]
            assert receipt["source_commit"] == stable["published_source_commit"]
            assert not receipt["model_started"] and not receipt["devices_reserved"]
            assert set(receipt["verified_profiles"]) == {
                "qwen35",
                "qwen9b",
                "intern-s2",
            }
            assert 1536 in receipt["capture_sizes_include"]
        else:
            assert receipt["installer_cli_verified"]
            assert receipt["capture_3072"] and not receipt["model_loaded"]
            assert not receipt["reserved_devices"] and receipt["runtime_files"] > 0
        assert re.fullmatch(
            r"[a-f0-9]{64}", receipt["installed_files_canonical_sha256"]
        )

        # The public package index binds the exact source archive independently
        # of the GitHub release that hosts the runtime wheels.
        package_url = (
            f"https://pypi.org/pypi/vllm-hust-engine/{stable['pypi_version']}/json"
        )
        with urlopen(package_url, timeout=30) as response:
            package = json.load(response)
        assert package["info"]["version"] == stable["pypi_version"]
        (archive,) = (
            item
            for item in package["urls"]
            if item["packagetype"] == "sdist" and item["filename"] == filename
        )
        (mirror,) = (
            item
            for item in index["assets"]
            if item["browser_download_url"] == prefix + filename
        )
        sdist_sha256 = archive["digests"]["sha256"]
        assert (
            mirror["digest"] == f"sha256:{sdist_sha256}"
            and mirror["size"] == archive["size"]
        )
        wheel_hashes = {}
        for row in receipt["native_artifacts"]:
            assert unquote(row["url"]).startswith(prefix)
            assert unquote(row["url"]).rsplit("/", 1)[-1] == row["name"]
            (mirror,) = (
                item
                for item in index["assets"]
                if unquote(item["browser_download_url"]) == unquote(row["url"])
            )
            assert (
                mirror["digest"] == f"sha256:{row['sha256']}"
                and mirror["size"] == row["bytes"]
            )
            wheel_hashes[row["name"]] = row["sha256"]
    else:
        assert receipt["linux_architecture"] == "aarch64"
        assert receipt["isolated_venv"] and receipt["serve_dry_run_passed"]
        assert not receipt["model_started"] and not receipt["npu_initialized"]
        assert receipt["sdist"]["sha256"] == stable["sdist_sha256"]
        assert receipt["sdk_sha256"] == stable["sdk_sha256"]
        assert receipt["sdist"]["filename"] == filename
        sdist_sha256 = stable["sdist_sha256"]
        wheel_hashes = receipt["wheel_sha256"]
    assert len(wheel_hashes) == 3
    expected = {filename: sdist_sha256, **wheel_hashes}
    requirements = [
        shlex.split(line) for line in lines if line and not line.startswith(("#", "--"))
    ]
    observed = {}
    names = set()
    for name, operator, url, digest in requirements:
        filename = unquote(urlsplit(url).path.rsplit("/", 1)[1])
        assert operator == "@" and url.startswith(prefix)
        assert filename not in observed and name not in names
        assert re.fullmatch(r"--hash=sha256:[a-f0-9]{64}", digest)
        observed[filename] = digest.removeprefix("--hash=sha256:")
        names.add(name)
    assert names == {"vllm-hust-engine", "vllm", "vllm-ascend", "vllm-hust-runtime"}
    assert observed == expected, (
        "Stable installation files differ from the accepted package"
    )
    assert all(name.endswith("-cp312-cp312-linux_aarch64.whl") for name in wheel_hashes)


async def verify(args):
    root = args.root.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((root / "data/benchmark-source-manifest.json").read_text())
    for item in manifest["files"]:
        raw = (root / item["website_path"]).read_bytes()
        assert len(raw) == item["bytes"]
        assert hashlib.sha256(raw).hexdigest() == item["sha256"], item["website_path"]
    catalog_path = "data/engine-release-history-v1.json"
    assert any(item["website_path"] == catalog_path for item in manifest["files"])
    catalog = json.loads((root / catalog_path).read_bytes())
    release = next(
        row for row in catalog["entries"] if row["id"] == catalog["default_release"]
    )
    stable = (
        release.get("full_acceptance")
        or release.get("r10_revision")
        or release["stable_evidence"]
    )
    verify_stable_install_manifest(release, stable)
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
                            commands = [
                                shlex.split(line)
                                for line in command.replace("\\\n", "").splitlines()
                                if line.strip()
                            ]
                            assert [
                                "git",
                                "clone",
                                "https://github.com/DeepLinkNext/DeepLinkEngine.git",
                            ] in commands
                            install = next(
                                args
                                for args in commands
                                if args[:3] == ["python", "deeplink.py", "install"]
                            )
                            serve = next(
                                args
                                for args in commands
                                if args[:3] == ["python", "deeplink.py", "serve"]
                            )
                            assert (
                                install[install.index("--out") + 1]
                                == serve[serve.index("--installation") + 1]
                            )
                            assert all(
                                flag in serve
                                for flag in ("--model", "--physical-devices")
                            )
                            assert "--no-deps" not in command
                            assert "--engine-version" not in install
                            assert serve[serve.index("--physical-devices") + 1] == (
                                "$DEEPLINK_PHYSICAL_DEVICES"
                            )
                            url = stable["install_manifest_url"]
                            assert (
                                await page.locator(
                                    "#engine-install-source"
                                ).get_attribute("href")
                                == url
                            )
                            assert (
                                stable["pypi_version"]
                                in await page.locator(
                                    "#engine-install-copy"
                                ).inner_text()
                            )
                            manual = await page.locator(
                                "#install-runtime details pre"
                            ).text_content()
                            pip = shlex.split(manual.splitlines()[0])
                            assert pip[:4] == ["python", "-m", "pip", "install"]
                            assert "--no-deps" in pip
                            assert pip[pip.index("-r") + 1] == url
                            assert "vllm-hust-engine verify" in manual.splitlines()
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
            intro = await page.locator("#home-intro").inner_text()
            cta = await page.locator("#home-primary-cta").inner_text()
            assert "MOD" in intro and "MOD" in cta
            assert "40" not in intro and "40" not in cta
            assert "stateaxis" not in f"{intro} {cta}".lower()
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
