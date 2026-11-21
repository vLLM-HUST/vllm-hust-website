"""Check the assembled site's B0/B1 selectors; does not generate measurements."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:8000")
parser.add_argument(
    "--output", type=Path, default=Path("output/playwright/baseline-version")
)
args = parser.parse_args()
export_events = {}


def observe_exports(page):
    events = []
    export_events[page] = events
    page.on(
        "console",
        lambda message: events.append(
            {"kind": "console", "type": message.type, "text": message.text}
        ),
    )
    page.on(
        "pageerror",
        lambda error: events.append({"kind": "pageerror", "text": str(error)}),
    )
    page.on(
        "download",
        lambda download: events.append(
            {"kind": "download", "filename": download.suggested_filename}
        ),
    )
    cdp = page.context.new_cdp_session(page)
    cdp.send("Log.enable")
    cdp.on(
        "Log.entryAdded",
        lambda event: events.append({"kind": "browser-log", "entry": event}),
    )
    page.add_init_script("""(()=>{
      const probe=window.__comparisonExportProbe=[];
      const save=(kind,value={})=>{probe.push({kind,at:performance.now(),...value});if(probe.length>100)probe.shift()};
      document.addEventListener('click',event=>{const button=event.target.closest?.('#comparison-export');
        if(button)save('click',{trusted:event.isTrusted,onclickBound:typeof button.onclick==='function'})},true);
      const create=URL.createObjectURL,revoke=URL.revokeObjectURL,click=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=function(blob){const url=create.call(this,blob);save('blob-created',{url,bytes:blob.size});return url};
      URL.revokeObjectURL=function(url){save('blob-revoked',{url});return revoke.call(this,url)};
      HTMLAnchorElement.prototype.click=function(){if(this.download)save('anchor-click',{url:this.href,filename:this.download});return click.call(this)};
    })()""")


def download_selection(page):
    def state():
        try:
            return page.evaluate("""()=>({url:location.href,root:{...document.querySelector('#five-dataset-comparison').dataset},
          baseline:document.querySelector('#comparison-baseline-select')?.value,
          release:document.querySelector('#comparison-release-select')?.value,
          onclickBound:typeof document.querySelector('#comparison-export')?.onclick==='function',
          events:window.__comparisonExportProbe||[]})""")
        except Exception as error:
            return {"url": page.url, "state_error": str(error)}

    before = state()
    stage = "click-and-wait-for-download"
    try:
        with page.expect_download() as download:
            page.locator("#comparison-export").click()
        stage = "download-started"
        failure = download.value.failure()
        assert failure is None, "Export download failed: " + str(failure)
        stage = "download-completed"
        return json.loads(Path(download.value.path()).read_bytes())
    except Exception as error:
        args.output.mkdir(parents=True, exist_ok=True)
        evidence = {
            "stage": stage,
            "before": before,
            "after": state(),
            "error": str(error),
            "browser_events": export_events[page],
        }
        (args.output / "export-failure.json").write_text(
            json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print("EXPORT_FAILURE", json.dumps(evidence, ensure_ascii=False), flush=True)
        try:
            page.screenshot(
                path=str(args.output / "export-failure.png"), full_page=True
            )
        except Exception as screenshot_error:
            print("Export screenshot failed:", screenshot_error, flush=True)
        raise


def context_contrasts(page):
    return page.locator(
        "#context-tenant-supplement th,#context-tenant-supplement td"
    ).evaluate_all(
        """nodes=>{
          const rgba=color=>{const v=color.match(/[\\d.]+/g).map(Number);return v.length===3?[...v,1]:v};
          const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
          const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4)
            .reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
          return nodes.map(node=>{
            const ancestors=[];for(let n=node;n;n=n.parentElement)ancestors.push(n);
            const bg=ancestors.reverse().reduce((color,n)=>over(rgba(getComputedStyle(n).backgroundColor),color),[255,255,255]);
            const foreground=over(rgba(getComputedStyle(node).color),bg);
            const values=[luminance(foreground),luminance(bg)].sort((a,b)=>a-b);
            return (values[1]+0.05)/(values[0]+0.05);
          });
        }"""
    )


def verify_development_priority(page, releases, baselines):
    original = "original018-cann8.5.1"
    assert "sr1" in releases
    sr = ["sr1"] + [
        item for item in releases if item.startswith("sr") and item != "sr1"
    ]
    alternate = next(item for item in baselines if item != original)
    base = args.base_url.rstrip("/") + "/b0-b1.html"

    def wait_release(value):
        page.wait_for_function(
            '(id)=>document.querySelector("#five-dataset-comparison").dataset.release===id',
            arg=value,
        )

    def verify_original():
        page.wait_for_function(
            '(id)=>document.querySelector("#five-dataset-comparison").dataset.baselineId===id',
            arg=original,
        )
        assert page.locator("#comparison-baseline-select").input_value() == original
        assert page.locator('[data-comparison="selected-b0"]').count() == 1
        assert page.locator(".metric-change").count() == 0
        assert page.locator("[data-baseline-observation]").count() > 0
        assert "comparison" not in parse_qs(urlparse(page.url).query)
        exported = download_selection(page)
        assert exported["baseline"] == original and exported["candidate"] == sr[0]
        assert exported["paired"] is False

    page.goto(base + "?" + urlencode({"release": sr[0], "comparison": "development"}))
    page.wait_for_selector('[data-baseline-id="B1-r8"]', timeout=60000)
    assert page.locator("#comparison-baseline-select").count() == 0
    if len(sr) > 1:
        page.select_option("#comparison-release-select", sr[1])
        wait_release(sr[1])
        assert parse_qs(urlparse(page.url).query)["comparison"] == ["development"]
    page.select_option("#comparison-release-select", "r10")
    wait_release("r10")
    assert "comparison" not in parse_qs(urlparse(page.url).query)
    page.select_option("#comparison-baseline-select", alternate)
    page.select_option("#comparison-release-select", sr[0])
    wait_release(sr[0])
    page.select_option("#comparison-baseline-select", original)
    verify_original()
    page.reload()
    verify_original()
    page.goto(
        base
        + "?"
        + urlencode({"release": sr[0], "comparison": "development", "b0": original})
    )
    verify_original()
    page.reload()
    verify_original()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True, executable_path=os.environ.get("VLLMHUST_BROWSER_EXECUTABLE")
    )
    for width, scheme in (
        (1366, "light"),
        (1366, "dark"),
        (390, "light"),
        (390, "dark"),
    ):
        page = browser.new_page(
            viewport={"width": width, "height": 900}, color_scheme=scheme
        )
        observe_exports(page)
        page.goto(args.base_url.rstrip("/") + "/b0-b1.html?release=r8")
        page.wait_for_selector("#comparison-baseline-select", timeout=60000)

        def read_descriptor(descriptor):
            response = page.request.get(
                args.base_url.rstrip("/") + "/" + descriptor["path"]
            )
            raw = response.body()
            assert response.ok and len(raw) == descriptor["bytes"]
            assert hashlib.sha256(raw).hexdigest() == descriptor["sha256"]
            return json.loads(raw)

        catalog = page.request.get(
            args.base_url.rstrip("/") + "/data/engine-release-history-v1.json"
        ).json()
        fixed_model = read_descriptor(catalog["baseline"]["observations"])["model"]
        independent_baselines = {
            item["id"]: read_descriptor(item["observations"])
            for item in catalog.get("comparison_baselines", [])
            if item.get("observations")
        }
        expected_models = {}
        for entry in catalog["entries"]:
            integration = entry.get("model_integration")
            expected_models[entry["id"]] = (
                read_descriptor(integration["summary"])["candidate"]["model"]
                if integration and not entry["measurements"]
                else entry.get("model") or fixed_model
            )
        baselines = page.locator("#comparison-baseline-select option").evaluate_all(
            "(rows)=>rows.map(row=>row.value)"
        )
        releases = page.locator("#comparison-release-select option").evaluate_all(
            "(rows)=>rows.map(row=>row.value)"
        )
        assert "original018-cann8.5.1" in baselines
        for baseline in baselines:
            page.select_option("#comparison-baseline-select", baseline)
            if baseline == "original018-cann8.5.1":
                for release in (item for item in releases if item.startswith("sr")):
                    page.select_option("#comparison-release-select", release)
                    page.wait_for_function(
                        '(id)=>document.querySelector("#five-dataset-comparison").dataset.release===id',
                        arg=release,
                    )
                    assert page.locator('[data-comparison="selected-b0"]').count() == 1
                    assert page.locator(".metric-change").count() == 0
                    assert page.locator("[data-baseline-observation]").count() > 0
                continue
            for release in releases:
                page.select_option("#comparison-release-select", release)
                page.wait_for_function(
                    '(id)=>document.querySelector("#five-dataset-comparison").dataset.release===id',
                    arg=release,
                )
                assert (
                    page.locator("#comparison-baseline-select").input_value()
                    == baseline
                )
                assert page.locator(".metric-chart").count() == 4
                assert page.locator("#context-tenant-supplement").count() == 1
                assert all(
                    value
                    not in (
                        "Measured value",
                        "原值",
                        "分别实测",
                        "Separate measurements",
                    )
                    for value in page.locator(
                        '[data-metric="relative_cost_per_token"] .chart-row-heading>span'
                    ).all_text_contents()
                )
                check_candidate = release in ("r6", "r9", "r10")
                check_baseline = (
                    release in ("r8", "r10") and baseline in independent_baselines
                )
                payload = (
                    download_selection(page)
                    if check_candidate or check_baseline
                    else None
                )
                if check_candidate:
                    assert (
                        expected_models[release]
                        in page.locator("#comparison-lead").inner_text()
                    )
                    assert (
                        payload["baseline"] == baseline
                        and payload["candidate"] == release
                    )
                    assert all(
                        row["model"] == expected_models[release]
                        for row in payload["rows"]
                    )
                    if release == "r6":
                        report = page.request.get(
                            args.base_url.rstrip("/")
                            + "/data/five-datasets-r6-20261114/summary-public-v3.json"
                        ).json()
                        by_id = {row["id"]: row for row in payload["rows"]}
                        for source in report["datasets"]:
                            arm = by_id[source["id"]]["observation"]
                            assert arm["requests"] == source["arms"]["B1"]["planned"]
                            assert (
                                arm["output_tokens_per_second"]
                                == source["arms"]["B1"]["output_tokens_per_second"]
                            )
                    assert all(
                        row.get("observation", {}).get("relative_cost_per_token")
                        is None
                        for row in payload["rows"]
                    )
                if check_baseline:
                    assert payload["paired"] is False
                    contrasts = context_contrasts(page)
                    if contrasts:
                        assert min(contrasts) >= 4.5
                    for original in independent_baselines[baseline]["profiles"]:
                        matches = [
                            row
                            for row in payload["rows"]
                            if row["id"] == original["id"]
                        ]
                        assert len(matches) == 1
                        assert all(
                            matches[0]["baselineObservation"][key] == value
                            for key, value in original["arm"].items()
                        )
                        if original.get("workload_kind") == "continuous-synthetic":
                            assert original["id"] in ("4096-formal", "16384-formal")
                            assert (
                                len(
                                    [
                                        row
                                        for row in payload["context"]
                                        if row["id"] == original["id"]
                                    ]
                                )
                                == 1
                            )
                            assert "C8" in matches[0]["label"]
                if baseline != "original018-cann8.5.1":
                    assert (
                        page.locator(
                            ".metric-change,[data-fixed-b0-compute],[data-fixed-b0-context]"
                        ).count()
                        == 0
                    )
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
        verify_development_priority(page, releases, baselines)
        print(
            "PASS",
            width,
            scheme,
            len(baselines),
            "B0 choices,",
            len(releases),
            "B1 choices",
        )
        page.close()
    browser.close()
