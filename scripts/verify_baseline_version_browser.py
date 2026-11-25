"""Check the assembled site's B0/B1 selectors; does not generate measurements."""

import argparse
from decimal import Decimal, ROUND_DOWN
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
parser.add_argument("--language", choices=("zh", "en"), default="zh")
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


def read_export_blob(page):
    # Verify each pairing's actual link and Blob without repeated native download events.
    name, payload = page.locator("#comparison-export").evaluate(
        """button=>new Promise((resolve,reject)=>{
          const controller=new AbortController();
          const timer=setTimeout(()=>{
            controller.abort();
            reject(new Error('Export did not emit a download link'));
          },5000);
          document.addEventListener('click',async event=>{
            const link=event.target.closest('a[download]');
            if(!link||!link.href.startsWith('blob:'))return;
            event.preventDefault();
            clearTimeout(timer);
            controller.abort();
            try {
              const response=await fetch(link.href);
              if(!response.ok)throw Error('Export Blob unreadable');
              resolve([link.download,await response.json()]);
            } catch(error) { reject(error); }
          },{capture:true,signal:controller.signal});
          button.click();
        })"""
    )
    assert name == f"{payload['baseline']}-B1-{payload['candidate']}.json"
    return payload


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

    def verify_original(native=False):
        page.wait_for_function(
            '(id)=>document.querySelector("#five-dataset-comparison").dataset.baselineId===id',
            arg=original,
        )
        assert page.locator("#comparison-baseline-select").input_value() == original
        assert page.locator('[data-comparison="selected-b0"]').count() == 1
        assert page.locator(".metric-change").count() == 0
        assert page.locator("[data-baseline-observation]").count() > 0
        assert "comparison" not in parse_qs(urlparse(page.url).query)
        exported = download_selection(page) if native else read_export_blob(page)
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
    verify_original(native=True)
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


def verify_full_baseline_details(
    page,
    source,
    label,
    width,
    scheme,
    prefix="",
    repair=None,
    commit=None,
    ft_pair=None,
):
    """Read the two existing dialogs; do not invent paired goals or grades."""
    expected_tracks = [
        [
            label,
            row.get("label", row["id"]),
            track,
            str(grade["successes"]) + "/" + str(grade["total"]),
            str(grade["graded"]),
            str(grade.get("unresolved", grade.get("judge_unresolved", "—"))),
        ]
        for row in source["profiles"]
        for track, grade in (row.get("quality") or {}).get("tracks", {}).items()
        if row.get("quality")
    ]
    page.evaluate("window.scrollTo(0,0)")
    page.screenshot(
        path=str(args.output / f"{prefix}layout-{width}-{scheme}.png"), full_page=True
    )
    page.locator('[data-detail="quality"]').click()
    dialog = page.locator("#comparison-detail-dialog")
    assert dialog.is_visible()
    actual_tracks = (
        dialog.locator("table")
        .nth(1)
        .locator("tbody tr")
        .evaluate_all(
            "rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent.trim()))"
        )
    )
    assert actual_tracks == expected_tracks
    text = dialog.inner_text()
    hle = next(row for row in source["profiles"] if row["id"] == "hle")
    scope = hle["execution_scope"]
    assert (
        "B0 HLE " + str(scope["selected_tasks"]) + "/" + str(scope["source_tasks"])
        in text
    )
    assert hle["quality"]["judge_model"] in text
    assert "替代裁判" in text or "substitute judge" in text
    assert "SWE/Terminal" in text and ("轨迹推理" in text or "trace inference" in text)
    page.screenshot(
        path=str(args.output / f"{prefix}quality-{width}-{scheme}.png"), full_page=True
    )
    if width == 390:
        last_grade = (
            dialog.locator("table").nth(1).locator("tbody tr").last.locator("td").last
        )
        last_grade.scroll_into_view_if_needed()
        bounds, frame = last_grade.bounding_box(), dialog.bounding_box()
        assert (
            frame["x"] <= bounds["x"]
            and bounds["x"] + bounds["width"] <= frame["x"] + frame["width"]
        )
        dialog.locator("p").last.scroll_into_view_if_needed()
        page.screenshot(
            path=str(args.output / f"{prefix}quality-right-{width}-{scheme}.png"),
            full_page=True,
        )
    dialog.locator(".dialog-close").click()
    assert not dialog.is_visible()
    page.locator('[data-detail="compute"]').click()
    assert dialog.is_visible()
    actual_native = dialog.locator("tbody tr").evaluate_all(
        "rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent.trim()))"
    )
    native = source["native_timing"]
    assert len(actual_native) == len(native["repetitions"]) == 3
    for actual, expected in zip(actual_native, native["repetitions"], strict=True):
        assert int(actual[0]) == expected["repetition"]
        assert float(actual[1]) == expected["T_seconds"]
        assert int(actual[2]) == expected["output_tokens"]
    assert source["F"] is source["efficiency_percent"] is native["F_interval"] is None
    assert source["automatic_ft_audit"]["status"] == "ineligible"
    text = dialog.inner_text()
    assert "F 与效率未计算" in text or "F and efficiency are uncomputed" in text
    assert (
        "算量适用性未通过" in text or "Arithmetic applicability is ineligible" in text
    )
    patch_detail = dialog.locator("[data-b0-kv-prefix-repair]")
    if repair:
        assert patch_detail.is_visible()
        interval = "–".join(
            f"{float(value):.3f}" for value in repair["tflops_per_card_interval"]
        )
        assert interval in patch_detail.inner_text()
        assert "3 × 200" in patch_detail.inner_text()
        assert patch_detail.locator(":scope > p > a").get_attribute("href") == (
            f"https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/{commit}/"
            "reports/b0-mtp-kv-prefix-repair-v1/README.md"
        )
    else:
        assert patch_detail.count() == 0
    comparison_detail = dialog.locator("[data-r10-patched-b0-ft]")
    if ft_pair:
        pair, b1 = ft_pair
        assert comparison_detail.is_visible()
        detail = comparison_detail.inner_text()
        for values in (
            b1["tflops_per_card_interval"],
            pair["B1_over_B0_effective_compute_interval"],
        ):
            assert "–".join(f"{float(value):.3f}" for value in values) in detail
        for arm in (pair["B0"], b1):
            assert f"{float(arm['T_seconds']):.3f} s" in detail
        assert comparison_detail.locator("a").get_attribute("href") == (
            f"https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/{commit}/"
            "reports/r10-stable-patched-b0-ft-20261123-v1/README.md"
        )
    else:
        assert comparison_detail.count() == 0
    page.screenshot(
        path=str(args.output / f"{prefix}compute-{width}-{scheme}.png"), full_page=True
    )
    if width == 390:
        tokens = dialog.locator("tbody tr").last.locator("td").last
        tokens.scroll_into_view_if_needed()
        bounds, frame = tokens.bounding_box(), dialog.bounding_box()
        assert (
            frame["x"] <= bounds["x"]
            and bounds["x"] + bounds["width"] <= frame["x"] + frame["width"]
        )
        page.screenshot(
            path=str(args.output / f"{prefix}compute-right-{width}-{scheme}.png"),
            full_page=True,
        )
    dialog.locator(".dialog-close").click()
    assert not dialog.is_visible()


def verify_candidate_reports(page, entry, commit):
    expected_reports = {"native-rms": 21, "contiguous-restore": 28}
    v2_source = entry.get("candidate_submission_assessment")
    assessment = None
    if v2_source:
        response = page.request.get(args.base_url.rstrip("/") + "/" + v2_source["path"])
        raw = response.body()
        assert response.ok and len(raw) == v2_source["bytes"]
        assert hashlib.sha256(raw).hexdigest() == v2_source["sha256"]
        assessment = json.loads(raw)
    panels = page.locator("[data-candidate-report]")
    assert panels.count() == len(expected_reports)
    for kind, count in expected_reports.items():
        panel = page.locator(f"[data-candidate-report='{kind}']")
        source = next(
            item
            for item in entry["sources"]
            if f"-{kind}-fixed-five-" in item["url"]
            and item["url"].endswith("/summary.json")
        )
        assert panel.get_by_text("JSON", exact=False).get_attribute("href") == source[
            "url"
        ].replace("/blob/main/", f"/blob/{commit}/")
        filename = source["url"].split("/reports/", 1)[1]
        response = page.request.get(args.base_url.rstrip("/") + "/data/" + filename)
        raw = response.body()
        assert response.ok and len(raw) == source["bytes"]
        assert hashlib.sha256(raw).hexdigest() == source["sha256"]
        report = json.loads(raw)
        panel.locator(":scope > summary").click()
        panel.locator("[data-candidate-metrics][data-state=loaded]").wait_for(
            timeout=20000
        )
        assert "672" in panel.inner_text()
        tables = panel.locator("[data-candidate-metrics] table")
        assert tables.first.locator("tbody tr").count() == count
        assert tables.last.locator("tbody tr").count() == 4
        assert set(
            tables.first.locator("tbody tr td:last-child").all_text_contents()
        ) == {
            arm["source_seal_sha256"]
            for arms in report["measurements"].values()
            for arm in arms.values()
        }
        if assessment:
            verify_candidate_v2(panel, assessment["candidates"][kind], report)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        panel.locator(":scope > summary").click()
    history = page.locator("#rms-revision")
    history.locator("summary").click()
    history.locator(".rms-revision-metrics[data-state=loaded]").wait_for(timeout=20000)
    assert history.locator("tbody tr").count() == 12
    history.locator("summary").click()


def verify_candidate_v2(panel, record, report):
    v2 = panel.locator("[data-candidate-v2][data-state=loaded]")
    v2.wait_for(timeout=20000)
    targets = record["targets"]
    assert record["selection"]["release"] == report["release"]
    pass_text = ("达成", "未达成") if args.language == "zh" else ("Met", "Not met")
    rows = v2.locator("table").first.locator("tbody tr").all()
    assert len(rows) == 4
    for index, row in enumerate(rows, 1):
        assert row.locator("td").all_text_contents() == [
            pass_text[not targets[f"4.{index}"][gate]["met"]]
            for gate in ("milestone", "final")
        ]
    text = v2.inner_text()
    assert record["selection"]["release"] in text
    assert "MMLU-Pro 200 / out256" in text
    assert "Terminal-Bench 2.1" in text and "C24" in text
    assert f"{float(targets['4.1']['efficiency_lower_percent']['B1']):.2f}%" in text
    assert targets["4.1"]["native"]["native_seals"]["B1"] in text
    assert (
        f"{float(targets['4.4']['four_tenant']['unit_cost_reduction_percent']):.2f}%"
        in text
    )
    assert set(
        v2.locator("a").evaluate_all("(nodes) => nodes.map(node => node.href)")
    ) >= {source["url"] for source in record["sources"].values()}
    seal = v2.locator("details")
    seal.locator("summary").click()
    assert targets["4.3"]["paired"]["arm_seals"]["B1"] in seal.inner_text()
    for task in targets["4.3"]["baseline_context"]["workload"]["task_ids"]:
        assert task in seal.inner_text()


def verify_candidate_checksum(page, report_query):
    base = args.base_url.rstrip("/") + "/b0-b1.html"
    pattern = "**/data/r10-native-rms-fixed-five-*/summary.json"
    page.route(
        pattern,
        lambda route: route.fulfill(
            status=200, content_type="application/json", body="{}"
        ),
    )
    page.goto(base + report_query)
    panel = page.locator("[data-candidate-report='native-rms']")
    panel.locator(":scope > summary").click()
    panel.locator("[data-candidate-metrics][data-state=unavailable]").wait_for()
    assert panel.locator("tbody tr").count() == 0
    page.unroute(pattern)


def verify_candidate_v2_checksum(page, entry, report_query):
    source = entry.get("candidate_submission_assessment")
    if not source:
        return
    base = args.base_url.rstrip("/") + "/b0-b1.html"
    pattern = "**/" + source["path"]
    page.route(
        pattern,
        lambda route: route.fulfill(
            status=200, content_type="application/json", body="{}"
        ),
    )
    page.goto(base + report_query)
    if entry.get("stable_evidence"):
        page.locator("#submission-v2 [data-stable-assessment-unavailable]").wait_for()
        assert page.locator("#submission-v2 tbody tr").count() == 0
    panel = page.locator("[data-candidate-report='native-rms']")
    panel.locator(":scope > summary").click()
    panel.locator("[data-candidate-v2][data-state=unavailable]").wait_for()
    assert panel.locator("[data-candidate-v2] tbody tr").count() == 0
    panel.locator("[data-candidate-metrics][data-state=loaded]").wait_for()
    page.unroute(pattern)


def verify_archived_cards_checksum(page, archived_record):
    base = args.base_url.rstrip("/") + "/b0-b1.html"
    pattern = "**/data/b0-archived-card-provenance-v1.json"
    page.route(
        pattern,
        lambda route: route.fulfill(
            status=200, content_type="application/json", body="{}"
        ),
    )
    baseline = archived_record["baseline_id"]
    page.goto(base + "?" + urlencode({"release": "r10", "b0": baseline}))
    page.wait_for_selector("#comparison-export")
    result = read_export_blob(page)
    row = next(
        item for item in result["rows"] if item["id"] == archived_record["profile_id"]
    )
    assert (
        row["baselineObservation"]["source_seal_sha256"]
        == archived_record["source_seal_sha256"]
    )
    assert row["baselineObservation"]["physical_cards"] is None
    assert "baselineCardMapping" not in row
    page.unroute(pattern)


def verify_stable_default(page, catalog):
    entry = next(
        row for row in catalog["entries"] if row["id"] == catalog["default_release"]
    )
    base = args.base_url.rstrip("/") + "/b0-b1.html"
    page.goto(base)
    archive = catalog.get("archived_r10")
    if entry.get("r10_revision") and not entry.get("submission_assessment"):
        stable_version = archive["stable_evidence"]["pypi_version"]
        default = page.locator("#submission-v2").get_by_role(
            "link", name="PyPI " + stable_version, exact=False
        )
        default.wait_for()
        page.goto(base + "?release=r10#submission-v2")
        default.wait_for()
        page.goto(base + "?release=r10")
        revision = entry["r10_revision"]
        assessment = page.locator("[data-r10-revision]")
        assessment.wait_for()
        assert assessment.get_attribute("data-r10-revision") == revision["pypi_version"]
        assert page.locator("[data-r10-stability-windows] tbody tr").count() == 5
        assert page.locator("[data-candidate-report]").count() == 0
        version = revision["previous_version"]
        page.locator(f'a[href="./b0-b1.html?release=r10&revision={version}"]').click()
        entry = archive
    stable = entry.get("stable_evidence")
    if stable is None:
        return
    page.locator("#submission-v2").wait_for()
    assert page.locator("#comparison-release-select").input_value() == entry["id"]
    assert (
        page.locator("#comparison-baseline-select").input_value()
        == catalog["baseline"]["id"]
    )
    response = page.request.get(
        args.base_url.rstrip("/")
        + "/"
        + entry["candidate_submission_assessment"]["path"]
    )
    assert response.ok
    record = response.json()["candidates"][stable["kind"]]
    block = page.locator("#submission-v2")
    assert stable["measured_release"] in block.inner_text()
    assert (
        block.get_by_role(
            "link", name="PyPI " + stable["pypi_version"], exact=False
        ).get_attribute("href")
        == stable["pypi_url"]
    )
    words = ("达成", "未达成") if args.language == "zh" else ("Met", "Not met")
    for index, row in enumerate(
        block.locator("table").first.locator("tbody tr").all(), 1
    ):
        assert row.locator("td").all_text_contents() == [
            words[not record["targets"][f"4.{index}"][gate]["met"]]
            for gate in ("milestone", "final")
        ]
    assert "Terminal-Bench 2.1" in block.inner_text()
    expected = Decimal(record["targets"]["4.1"]["efficiency_lower_percent"]["B1"])
    lower = expected.quantize(Decimal("0.0001"), rounding=ROUND_DOWN)
    assert (
        page.locator(".goal-grid article").first.locator("strong").inner_text()
        == f"≥{lower}%"
    )
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")


def verify_legacy_links(page, catalog):
    base = args.base_url.rstrip("/") + "/b0-b1.html"
    page.goto(base + "?release=unknown&b0=unknown&controlplane=unknown")
    for choice in ("release", "baseline", "controller"):
        page.locator(f".{choice}-fallback").wait_for()
    assert parse_qs(urlparse(page.url).query) == {
        "release": [catalog["default_release"]],
        "b0": [catalog["baseline"]["id"]],
    }
    for alias, target in (
        ("acceptance-stages", "#submission-v2"),
        ("method-4", "[data-rental-cost][open]"),
        ("metric-4", "[data-rental-cost][open]"),
    ):
        page.goto(base + "?release=" + catalog["default_release"] + "#" + alias)
        page.locator(target).wait_for()
        page.wait_for_function(
            """selector => {
                const element = document.querySelector(selector);
                const nav = document.querySelector('.site-nav');
                const top = element?.getBoundingClientRect().top;
                return top >= nav.getBoundingClientRect().bottom - 1 && top < innerHeight;
            }""",
            arg=target,
        )


checked_matrix = []
expected_matrix = set()
args.output.mkdir(parents=True, exist_ok=True)

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
        page.add_init_script(
            f"localStorage.setItem('vllm-hust_lang','{args.language}')"
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
        sr = page.request.get(
            args.base_url.rstrip("/") + "/data/sr-development-results-v1.json"
        ).json()
        controller_results = page.request.get(
            args.base_url.rstrip("/") + "/data/controller-product-results-v1.json"
        ).json()
        controller_releases = {entry["id"] for entry in controller_results["releases"]}
        publication = page.request.get(
            args.base_url.rstrip("/") + "/data/benchmark-source-manifest.json"
        ).json()
        commit = publication["commit"]
        repair_source = next(
            (
                file
                for file in publication["files"]
                if file["website_path"] == "data/b0-mtp-kv-prefix-repair-v1/report.json"
            ),
            None,
        )
        repair_versions = {}
        if repair_source:
            repair_report = read_descriptor(
                {**repair_source, "path": repair_source["website_path"]}
            )
            assert repair_report["scope"] == "patched-variants-only"
            repair_versions = repair_report["versions"]
            assert set(repair_versions) == {"0.23.0", "0.30.0"}
        ft_source = next(
            (
                file
                for file in publication["files"]
                if file["website_path"]
                == "data/r10-stable-patched-b0-ft-20261123-v1/report.json"
            ),
            None,
        )
        formal_ft = (
            read_descriptor({**ft_source, "path": ft_source["website_path"]})
            if ft_source
            else None
        )
        if formal_ft:
            assert set(formal_ft["pairs"]) == {"0.23.0", "0.30.0"}
            assert all(
                pair["B1_native_seal_sha256"] == formal_ft["B1"]["native_seal_sha256"]
                for pair in formal_ft["pairs"].values()
            )
        source = next(
            file
            for file in publication["files"]
            if file["website_path"] == "data/b0-archived-card-provenance-v1.json"
        )
        archived_card_mappings = {
            (record["baseline_id"], record["profile_id"]): record
            for record in read_descriptor({**source, "path": source["website_path"]})[
                "records"
            ]
        }
        release_entries = {entry["id"]: entry for entry in catalog["entries"]}
        r10_archive = catalog.get("archived_r10")
        report_entry = r10_archive or release_entries["r10"]
        report_query = "?release=r10"
        if r10_archive:
            report_query += (
                "&revision=" + r10_archive["stable_evidence"]["pypi_version"]
            )
        expected_baselines = {catalog["baseline"]["id"]} | {
            item["id"] for item in catalog.get("comparison_baselines", [])
        }
        expected_releases = set(catalog["order"] + catalog["attempt_order"]) | {
            item["id"] for item in sr["entries"]
        }
        controller_selector = "#comparison-controlplane-select"
        controller_options = page.locator(controller_selector + " option").evaluate_all(
            "(rows)=>rows.map(row=>row.value)"
        )
        assert set(controller_options) == {"", "request-throttling"}
        expected_matrix.update(
            (width, scheme, baseline, release, control)
            for baseline in expected_baselines
            for release in expected_releases
            for control in controller_options
        )

        def record_matrix(baseline, release):
            controller = page.locator("#controller-comparison")
            for control in controller_options:
                page.select_option(controller_selector, control)
                query = parse_qs(urlparse(page.url).query)
                assert query.get("controlplane", []) == ([control] if control else [])
                assert controller.count() == int(bool(control))
                assert (
                    page.locator("#comparison-release-select").input_value() == release
                )
                assert (
                    page.locator("#comparison-baseline-select").input_value()
                    == baseline
                )
                if control and release in controller_releases:
                    assert controller.get_attribute("data-engine-release") == release
                elif control:
                    assert controller.get_attribute("data-engine-release") is None
                checked_matrix.append([width, scheme, baseline, release, control])
            page.select_option(controller_selector, "")

        independent_baselines = {
            item["id"]: read_descriptor(item["observations"])
            for item in catalog.get("comparison_baselines", [])
            if item.get("observations")
        }
        context_workloads = catalog.get("context_workloads", {})
        context_inputs = {
            item["id"]: item["context_input_sha256"]
            for item in catalog.get("comparison_baselines", [])
            if "context_input_sha256" in item
        }
        release_context_inputs = {
            item["id"]: item["context_tenant_supplement"]["protocol"]["input_sha256"]
            for item in catalog["entries"]
            if item.get("context_tenant_supplement")
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
        assert set(baselines) == expected_baselines and len(baselines) == len(
            expected_baselines
        )
        assert set(releases) == expected_releases and len(releases) == len(
            expected_releases
        )
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
                    record_matrix(baseline, release)
                for release in (item for item in releases if not item.startswith("sr")):
                    page.select_option("#comparison-release-select", release)
                    page.wait_for_function(
                        '(id)=>document.querySelector("#five-dataset-comparison").dataset.release===id',
                        arg=release,
                    )
                    assert (
                        page.locator("#comparison-baseline-select").input_value()
                        == baseline
                    )
                    assert (
                        page.locator("#comparison-release-select").input_value()
                        == release
                    )
                    source = context_workloads.get(release_context_inputs.get(release))
                    if source:
                        supplement = page.locator("#context-tenant-supplement")
                        assert all(
                            name in supplement.inner_text()
                            for name in source["datasets"]
                        )
                    if release == "r10":
                        if r10_archive:
                            assert page.locator("[data-candidate-report]").count() == 0
                        else:
                            verify_candidate_reports(page, report_entry, commit)
                    if release == "r7":
                        supplement = page.locator("#context-tenant-supplement")
                        for source in release_entries[release]["measurements"]:
                            assert (
                                supplement.get_by_text(
                                    source["label"], exact=True
                                ).count()
                                > 0
                            )
                    record_matrix(baseline, release)
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
                expected_context_workloads = {}
                for arm, digest in (
                    ("B0", context_inputs.get(baseline)),
                    ("B1", release_context_inputs.get(release)),
                ):
                    if digest in context_workloads:
                        expected_context_workloads[arm] = {
                            "input_sha256": digest,
                            **context_workloads[digest],
                        }
                if expected_context_workloads:
                    label = page.locator(
                        "#context-tenant-supplement [data-context-workloads]"
                    )
                    assert label.count() == 1
                    for role, source in expected_context_workloads.items():
                        assert role + ":" in label.inner_text()
                        assert all(
                            name in label.inner_text() for name in source["datasets"]
                        )
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
                check_candidate = release in ("r6", "r7", "r9", "r10")
                check_baseline = (
                    release in ("r8", "r10") and baseline in independent_baselines
                )
                payload = None
                if check_candidate or check_baseline:
                    if (
                        check_baseline
                        and baseline
                        in (
                            "official-0.23.0",
                            "official-0.30.0",
                            "candidate-0.28.0rc1-source",
                        )
                        and release == "r10"
                    ):
                        payload = download_selection(page)
                    else:
                        payload = read_export_blob(page)
                    assert (payload["baseline"], payload["candidate"]) == (
                        baseline,
                        release,
                    )
                    published_pair = (
                        formal_ft["pairs"].get(baseline.removeprefix("official-"))
                        if formal_ft
                        and release_entries.get(release, {}).get("release")
                        == formal_ft["B1"]["release"]
                        else None
                    )
                    if published_pair:
                        assert payload["native_fixed200_ft"] == {
                            **published_pair,
                            "B1": formal_ft["B1"],
                            "protocol": formal_ft["protocol"],
                            "report": f"https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/{commit}/"
                            "reports/r10-stable-patched-b0-ft-20261123-v1/README.md",
                        }
                    else:
                        assert "native_fixed200_ft" not in payload
                if payload and expected_context_workloads:
                    assert {
                        role: source
                        for role, source in payload["context_workloads"].items()
                        if source
                    } == expected_context_workloads
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
                    if release == "r7":
                        by_id = {row["id"]: row for row in payload["context"]}
                        for profile in ("4096", "16384"):
                            assert (
                                by_id[profile]["workloads"]["B1"]["kind"]
                                == "continuous-synthetic"
                            )
                    if release == "r9":
                        supplement = release_entries[release][
                            "context_tenant_supplement"
                        ]
                        by_id = {row["id"]: row for row in payload["context"]}
                        for phase in supplement["comparisons"]:
                            row = by_id["real-context-" + phase["phase"]]
                            assert (
                                row["observation"]["source_seal_sha256"]
                                == supplement["arm_seals"]["B1"]
                            )
                            assert (
                                row["observation"]["physical_cards"]
                                == phase["B1"]["physical_cards"]
                            )
                            assert row["workloads"]["B1"] == {
                                "kind": "fixed-data-context",
                                "source": expected_context_workloads["B1"],
                            }
                        assert (
                            by_id["4096-formal"]["workloads"]["B1"]["kind"]
                            == "continuous-synthetic"
                        )
                    if release == "r10":
                        assert (
                            payload["configuration"]["B1"]["release"]
                            == release_entries[release]["release"]
                        )
                        assert (
                            payload["configuration"]["B1"]["settings"]
                            == release_entries[release]["settings"]
                        )
                        if r10_archive:
                            assert "candidate_reports" not in payload
                        else:
                            assert {
                                item["kind"] for item in payload["candidate_reports"]
                            } == {"native-rms", "contiguous-restore"}
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
                record_matrix(baseline, release)
                if check_baseline:
                    assert payload["native_timing"] == independent_baselines[
                        baseline
                    ].get("native_timing")
                    assert payload["automatic_ft_audit"] == independent_baselines[
                        baseline
                    ].get("automatic_ft_audit")
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
                        if original.get("source_metric"):
                            assert matches[0]["baselineObservation"][
                                "physical_cards"
                            ] == (
                                original["arm"].get("physical_cards")
                                or independent_baselines[baseline]["hardware"][
                                    "physical_devices"
                                ]
                            )
                        archive = archived_card_mappings.get((baseline, original["id"]))
                        if archive:
                            assert (
                                matches[0]["baselineCardMapping"] == archive["source"]
                            )
                            assert (
                                matches[0]["baselineObservation"]["physical_cards"]
                                == archive["physical_cards"]
                            )
                            assert (
                                matches[0]["baselineObservation"]["source_seal_sha256"]
                                == archive["source_seal_sha256"]
                            )
                        assert matches[0]["baselineQuality"] == original.get("quality")
                        assert matches[0]["baselineExecutionScope"] == original.get(
                            "execution_scope"
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
                            assert (
                                matches[0]["workloads"]["B0"]["kind"]
                                == "continuous-synthetic"
                            )
                if (
                    baseline
                    in (
                        "official-0.23.0",
                        "official-0.30.0",
                        "candidate-0.28.0rc1-source",
                    )
                    and release == "r10"
                ):
                    descriptor = next(
                        item
                        for item in catalog["comparison_baselines"]
                        if item["id"] == baseline
                    )
                    titles = []
                    for detail in ("configuration", "methods", "evidence"):
                        page.locator(f'[data-detail="{detail}"]').click()
                        dialog = page.locator("dialog[open]")
                        titles.append(dialog.locator("h2").inner_text())
                        if detail in ("configuration", "evidence"):
                            assert dialog.locator("table").count() >= 1
                        page.keyboard.press("Escape")
                    assert len(set(titles)) == len(titles)
                    ft_version = baseline.removeprefix("official-")
                    ft_pair = (
                        (formal_ft["pairs"][ft_version], formal_ft["B1"])
                        if published_pair is not None
                        else None
                    )
                    verify_full_baseline_details(
                        page,
                        independent_baselines[baseline],
                        descriptor.get("label_en", descriptor["label"])
                        if args.language == "en"
                        else descriptor["label"],
                        width,
                        scheme,
                        prefix=(
                            "official030-"
                            if baseline == "official-0.30.0"
                            else "candidate028-"
                            if baseline == "candidate-0.28.0rc1-source"
                            else ""
                        ),
                        repair=repair_versions.get(baseline.removeprefix("official-")),
                        commit=commit,
                        ft_pair=ft_pair,
                    )
                if baseline != "original018-cann8.5.1":
                    assert (
                        page.locator(
                            ".metric-change,[data-fixed-b0-compute],[data-fixed-b0-context]"
                        ).count()
                        == 0
                    )
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
        page.close()
        # Exercise deep links in a fresh download context after the version matrix.
        page = browser.new_page(
            viewport={"width": width, "height": 900}, color_scheme=scheme
        )
        page.add_init_script(
            f"localStorage.setItem('vllm-hust_lang','{args.language}')"
        )
        observe_exports(page)
        verify_development_priority(page, releases, baselines)
        verify_legacy_links(page, catalog)
        verify_stable_default(page, catalog)
        if width == 1366 and scheme == "light":
            if r10_archive:
                base = args.base_url.rstrip("/") + "/b0-b1.html"
                page.goto(base + report_query)
                page.locator("[data-candidate-report]").first.wait_for()
                verify_candidate_reports(page, report_entry, commit)
                if formal_ft:
                    version = next(iter(formal_ft["pairs"]))
                    page.goto(base + report_query + "&b0=official-" + version)
                    page.locator("#comparison-export").wait_for()
                    assert (
                        read_export_blob(page)["native_fixed200_ft"]["B1"]
                        == formal_ft["B1"]
                    )
            verify_candidate_checksum(page, report_query)
            verify_candidate_v2_checksum(page, report_entry, report_query)
            verify_archived_cards_checksum(
                page, next(iter(archived_card_mappings.values()))
            )
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

assert set(map(tuple, checked_matrix)) == expected_matrix
assert len(checked_matrix) == len(expected_matrix)
(args.output / "matrix-verification.json").write_text(
    json.dumps(
        dict(
            status="passed",
            checked_combinations=checked_matrix,
            combinations=len(checked_matrix),
            controllers=controller_options,
            language=args.language,
            themes=["light", "dark"],
            widths=[1366, 390],
            real_downloads_preserved=True,
            baseline_quality_and_scope_export_verified=True,
            native_and_automatic_audit_export_verified=True,
            quality_and_compute_dialogs_verified=True,
            model_requests=0,
        ),
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
