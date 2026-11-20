"""Block development data from becoming formal B0/B1 results during CI and deploy."""

import argparse
import itertools
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from verify_five_dataset_comparison_browser import HISTORY, assert_model_integration


def verify(url, output):
    output.mkdir(parents=True, exist_ok=True)
    checks = []
    with sync_playwright() as driver:
        browser = driver.chromium.launch(
            executable_path=os.environ.get("VLLMHUST_BROWSER_EXECUTABLE")
        )
        context = browser.new_context()
        catalog = context.request.get(url + "/" + HISTORY).json()
        entries = [
            entry for entry in catalog["entries"] if entry.get("model_integration")
        ]
        assert entries, "The published integration evidence must remain available"
        for entry in entries:
            for lang, width, theme in itertools.product(
                ("zh", "en"), (390, 1440), ("light", "dark")
            ):
                page = context.new_page()
                page.set_viewport_size({"width": width, "height": 1000})
                page.emulate_media(color_scheme=theme)
                page.add_init_script(f"localStorage.setItem('vllm-hust_lang','{lang}')")
                errors = []
                page.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
                page.goto(url + "/b0-b1.html?release=" + entry["id"])
                root = page.locator("#five-dataset-comparison")
                expect(root).to_have_attribute(
                    "data-release", entry["id"], timeout=30000
                )
                assert_model_integration(page, root, entry, url, lang)
                assert not errors, errors
                assert page.evaluate(
                    "document.documentElement.scrollWidth<=innerWidth+1"
                )
                page.screenshot(
                    path=str(output / f"{entry['id']}-{lang}-{width}-{theme}.png"),
                    full_page=True,
                )
                page.close()
                checks.append(
                    dict(release=entry["id"], lang=lang, width=width, theme=theme)
                )
            for lang in ("zh", "en"):
                page = context.new_page()
                page.set_viewport_size(
                    {"width": 390 if lang == "zh" else 1440, "height": 1000}
                )
                page.add_init_script(f"localStorage.setItem('vllm-hust_lang','{lang}')")
                page.goto(
                    url
                    + "/b0-b1.html?release="
                    + entry["id"]
                    + "#development-comparison"
                )
                root = page.locator("#five-dataset-comparison")
                expect(root.locator("dialog")).to_be_visible(timeout=30000)
                expect(root.locator("[data-development-comparison]")).to_have_attribute(
                    "data-development-comparison", entry["id"]
                )
                expect(root).to_have_attribute(
                    "data-baseline-id", catalog["baseline"]["id"]
                )
                assert page.evaluate(
                    "document.documentElement.scrollWidth<=innerWidth+1"
                )
                page.screenshot(path=str(output / f"development-details-{lang}.png"))
                page.close()
                checks.append(dict(release=entry["id"], deep_link=True, lang=lang))

        for suffix in ("", "?release=latest"):
            page = context.new_page()
            page.goto(url + "/b0-b1.html" + suffix)
            root = page.locator("#five-dataset-comparison")
            expect(root).to_have_attribute(
                "data-baseline-id", catalog["baseline"]["id"], timeout=30000
            )
            expect(root.locator(".fixed-b0-identity")).to_contain_text(
                "vLLM0.18 / Ascend0.18"
            )
            page.close()
            checks.append(dict(default_route=suffix or "bare", fixed_b0=True))

        # Reintroduce the actual historical bug. With no runtime guard it must
        # render borrowed values; with the guard enabled it must reject them.
        source = context.request.get(url + "/assets/five-dataset-comparison.js").text()
        marker = "  function versionRows(entry) {"
        assert source.count(marker) == 1
        injected = """
    if(entry.model_integration){
      const d=modelIntegrationResults.get(entry.id);
      return d.workloads.map(row=>{
        const arms={B0:{...row.reference,relative_cost_per_token:1},B1:{...row.candidate,relative_cost_per_token:row.reference.output_tokens_per_second/row.candidate.output_tokens_per_second}};
        return {id:row.id,label:row.label_en,arms,changes_percent:Object.fromEntries(['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map(k=>[k,100*(arms.B1[k]/arms.B0[k]-1)]))};
      });
    }
"""
        poisoned = source.replace(marker, marker + injected)
        guard = "if(!attempt&&!sr)assertFormalBaselineIsolation(entry,rows);"
        assert poisoned.count(guard) == 1
        assert source.count("observation:row.candidate") == 1
        reference_as_candidate = source.replace(
            "observation:row.candidate", "observation:row.reference"
        )
        reference_data = context.request.get(
            url + "/" + entries[0]["model_integration"]["summary"]["path"]
        ).json()
        for kind, contaminated in [
            ("paired-reference", poisoned),
            ("reference-as-candidate", reference_as_candidate),
        ]:
            for protected in (False, True):
                body = contaminated if protected else contaminated.replace(guard, "")
                page = context.new_page()
                page.route(
                    "**/assets/five-dataset-comparison.js*",
                    lambda route, request, body=body: route.fulfill(
                        body=body, content_type="text/javascript"
                    ),
                )
                page.goto(url + "/b0-b1.html?release=" + entries[0]["id"])
                root = page.locator("#five-dataset-comparison")
                if protected:
                    expect(root).to_have_attribute(
                        "data-error", "publication-rejected", timeout=30000
                    )
                    expect(root.locator(".metric-chart")).to_have_count(0)
                    assert root.get_attribute("data-baseline-id") is None
                else:
                    expect(root).to_have_attribute(
                        "data-release", entries[0]["id"], timeout=30000
                    )
                    expect(root.locator(".metric-grid .bar-value")).to_have_count(24)
                    if kind == "paired-reference":
                        expect(root.locator(".metric-grid .bar-fill")).to_have_count(24)
                    else:
                        row = root.locator(
                            '[data-metric="output_tokens_per_second"] [data-profile="mmlu"] .bar-value'
                        )
                        expect(row).to_have_text(
                            [
                                "—",
                                f"{reference_data['workloads'][0]['reference']['output_tokens_per_second']:.2f}",
                            ]
                        )
                page.close()
                checks.append(
                    dict(
                        historical_bug_injected=True,
                        contamination=kind,
                        guard_enabled=protected,
                        rejected=protected,
                    )
                )
        browser.close()
    (output / "verification.json").write_text(json.dumps(checks, indent=2) + "\n")
    print(f"Verified {len(checks)} formal-baseline isolation cases")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    verify(args.url.rstrip("/"), args.output)
