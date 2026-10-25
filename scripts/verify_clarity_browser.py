"""Check readable surfaces and compact result cards in both languages/themes."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def verify_muxpd_links(page, output, stem):
    """Check real hit targets without navigating or hiding neighboring cards."""
    card = page.locator("#muxpd")
    details = card.locator("details.plugin-technical-details")
    details.locator("summary").click()
    trigger = card.locator(".plugin-launch-icon")
    trigger.click()
    tooltip = page.locator("#plugin-launch-muxpd")
    expect(tooltip).to_be_visible()
    before = page.url
    results = []
    base = "https://github.com/vLLM-HUST/vllm-ascend-MuxPD-hust"
    paths = (
        "/blob/v0.2.0a1/docs/ecpa-deployment.md",
        "/releases/tag/v0.2.0a1",
        "/issues/23",
    )
    for phase in ("normal", "after-card-screenshot"):
        if phase == "after-card-screenshot":
            card.screenshot(path=str(output / f"muxpd-card-{stem}.png"))
        for suffix in paths:
            link = tooltip.locator(f'a[href="{base + suffix}"]')
            expect(link).to_have_count(1)
            link.scroll_into_view_if_needed()
            link.click(trial=True, timeout=5000)
            hit = link.evaluate("""el => {
                const r = el.getBoundingClientRect();
                const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return {matches: target?.closest('a') === el, rect: r.toJSON()};
            }""")
            assert hit["matches"], (phase, suffix, hit)
            results.append(
                {"phase": phase, "href": base + suffix, "trial_click": True, **hit}
            )
    assert page.url == before, "Trial clicks must not navigate"
    geometry = tooltip.evaluate("""el => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return {height: r.height, viewport: innerHeight, overflow: s.overflowY};
    }""")
    assert geometry["height"] <= geometry["viewport"] * 0.7 + 2, geometry
    assert geometry["overflow"] == "auto", geometry
    page.screenshot(path=str(output / f"muxpd-links-{stem}.png"))
    return {"links": results, "geometry": geometry, "external_navigation": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/clarity")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    receipts = []
    contrast = """el => {
        const rgba = s => s.match(/[\\d.]+/g).map(Number);
        const over = (f,b) => f.slice(0,3).map((v,i)=>v*(f[3]??1)+b[i]*(1-(f[3]??1)));
        const lum = c => c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
        let bg=[255,255,255];
        const ancestors=[]; for(let n=el;n;n=n.parentElement) ancestors.unshift(n);
        for(const n of ancestors) bg=over(rgba(getComputedStyle(n).backgroundColor),bg);
        const ink=over(rgba(getComputedStyle(el).color),bg);
        return (Math.max(lum(ink),lum(bg))+.05)/(Math.min(lum(ink),lum(bg))+.05);
    }"""
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width in (390, 1440):
            for lang in ("zh", "en"):
                for scheme in ("light", "dark"):
                    context = browser.new_context(
                        viewport={"width": width, "height": 1000}, color_scheme=scheme
                    )
                    context.add_init_script(
                        f"localStorage.setItem('vllm-hust_lang','{lang}')"
                    )
                    for name in (
                        "dataset-validation",
                        "leaderboard-runs",
                        "plugins",
                        "achievements",
                    ):
                        page = context.new_page()
                        errors = []
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        page.goto(
                            f"{args.url}/{name}.html", wait_until="domcontentloaded"
                        )
                        selectors = []
                        muxpd_links = None
                        if name in ("dataset-validation", "leaderboard-runs"):
                            expect(page.locator("#current-workload")).to_have_attribute(
                                "data-loaded", "true"
                            )
                            expect(page.locator(".result-date")).to_be_visible()
                            related = page.locator("#result-related-evidence")
                            expect(related).not_to_have_attribute("open", "")
                            if name == "dataset-validation":
                                expect(page.locator(".result-quality")).to_be_visible()
                                expect(page.locator(".result-metrics")).to_be_hidden()
                                assert page.locator("#dataset-results").evaluate(
                                    "e=>e.getBoundingClientRect().top < 850"
                                )
                            else:
                                expect(page.locator(".result-metrics")).to_be_visible()
                                expect(
                                    page.locator(".result-chart-boundary")
                                ).to_contain_text(
                                    "其他工况" if lang == "zh" else "other workloads"
                                )
                            related.locator("summary").click()
                            expect(page.locator(".result-metric")).to_have_count(3)
                            expect(page.locator(".result-pair strong")).to_have_count(3)
                            expect(
                                page.locator(".result-comparison-note")
                            ).to_contain_text("B0")
                            assert page.locator(".result-metrics").evaluate(
                                "e => e.getBoundingClientRect().height < 340"
                            )
                            expect(page.locator(".cosmic-background")).to_be_hidden()
                            selectors = [
                                ".result-comparison-note",
                                ".result-boundary",
                                ".result-quality small",
                            ]
                            if name == "dataset-validation":
                                expect(
                                    page.locator(".matrix-overview .run-row")
                                ).to_have_count(24)
                                selectors += [".matrix-heading h1", ".matrix-heading p"]
                        elif name == "plugins":
                            expect(page.locator(".plugin-card").first).to_be_visible()
                            expect(
                                page.locator(".plugin-catalog-scope")
                            ).to_contain_text("40")
                            expect(
                                page.locator(".plugin-catalog-scope")
                            ).to_contain_text("44")
                            expect(
                                page.locator('[data-scenario="service_suspend_resume"]')
                            ).to_be_disabled()
                            expect(
                                page.locator(".plugin-technical-details").first
                            ).not_to_have_attribute("open", "")
                            expect(
                                page.locator(".plugin-compatibility-facts").first
                            ).to_be_hidden()
                            selectors = [".plugin-catalog-scope", ".plugin-summary"]
                            # Hero is a gradient: verify its explicitly light text,
                            # not a flat-color contrast approximation through it.
                            assert (
                                page.locator("#plugins-lede").evaluate(
                                    "e => getComputedStyle(e).color"
                                )
                                == "rgb(199, 212, 209)"
                            )
                            if width == 390:
                                assert (
                                    page.locator(".plugin-controls").evaluate(
                                        "e => getComputedStyle(e).position"
                                    )
                                    == "static"
                                )
                            muxpd_links = verify_muxpd_links(
                                page, args.output, f"{width}-{lang}-{scheme}"
                            )
                        else:
                            selectors = ["#serving-plan-link"]
                        ratios = {
                            s: page.locator(s).first.evaluate(contrast)
                            for s in selectors
                        }
                        assert all(v >= 4.5 for v in ratios.values()), (name, ratios)
                        if name in ("dataset-validation", "leaderboard-runs"):
                            related.locator("summary").click()
                            page.evaluate("window.scrollTo(0,0)")
                        assert page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth + 1"
                        ), name
                        assert not errors, errors
                        page.screenshot(
                            path=str(
                                args.output / f"{name}-{width}-{lang}-{scheme}.png"
                            )
                        )
                        receipts.append(
                            {
                                "page": name,
                                "width": width,
                                "language": lang,
                                "theme": scheme,
                                "contrast": ratios,
                                "muxpd_links": muxpd_links,
                            }
                        )
                        page.close()
                    context.close()
        browser.close()
    (args.output / "receipt.json").write_text(json.dumps(receipts, indent=2) + "\n")
    print(f"PASS: {len(receipts)} page/language/viewport/theme cases")


if __name__ == "__main__":
    main()
