"""Check every MOD's people, current result and source in eight display modes."""

import argparse
import hashlib
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def check_people(page, components, metadata, lang):
    checked = []
    for card in page.locator(".plugin-card").all():
        component = components[card.get_attribute("id")]
        record = metadata.get(component["id"], {})
        maintainers = record.get("maintainers", [])
        logins = [person["login"] for person in maintainers] or component.get(
            "maintainers", []
        )
        advisors = record.get("advisors", component.get("advisors", []))
        if component.get("advisors") == []:
            advisors = []
        expect(card.locator("details[open]")).to_have_count(0)
        if not logins and not advisors:
            continue
        panel = card.locator(":scope > .plugin-community")
        expect(panel).to_be_visible()
        expect(panel.locator(".plugin-maintainer")).to_have_count(len(logins))
        for login in logins:
            person = next((p for p in maintainers if p["login"] == login), {})
            link = panel.locator(
                f'a.plugin-maintainer[href="{person.get("profile_url", f"https://github.com/{login}")}"]'
            )
            expect(link).to_be_visible()
            expect(link).to_contain_text(f"@{login}")
            if person.get("name"):
                expect(link).to_contain_text(person["name"])
        for advisor in advisors:
            selector = (
                ".plugin-external-advisors"
                if advisor.get("relationship") == "external_contributor"
                else ".plugin-advisors"
            )
            expect(panel.locator(selector)).to_be_visible()
            expect(panel.locator(selector)).to_contain_text(
                advisor.get(f"name_{lang}") or advisor["name_en"]
            )
        if component.get("advisors") == []:
            expect(panel.locator(".plugin-advisors")).to_have_count(0)
        expect(panel.locator(".plugin-repo-metrics")).to_have_count(0)
        checked.append(component["id"])
    assert "simllm-migration" in checked
    return checked


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/plugin-effects")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    receipts = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width in (390, 1440):
            for lang in ("zh", "en"):
                for theme in ("light", "dark"):
                    context = browser.new_context(
                        viewport={"width": width, "height": 1000}, color_scheme=theme
                    )
                    context.add_init_script(
                        f"localStorage.setItem('vllm-hust_lang', '{lang}')"
                    )
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(f"{args.url}/plugins.html", wait_until="networkidle")
                    expect(
                        page.locator("#simllm-migration .plugin-public-effect")
                    ).to_be_visible()
                    response = context.request.get(
                        f"{args.url}/data/benchmark-source-manifest.json"
                    )
                    assert response.ok
                    manifest_raw = response.body()
                    manifest = response.json()
                    payloads = {}
                    for name in (
                        "ecosystem.json",
                        "plugin-performance.json",
                        "mod-taxonomy.json",
                        "plugin-workshop-metadata.json",
                    ):
                        response = context.request.get(f"{args.url}/data/{name}")
                        assert response.ok
                        identity = next(
                            row
                            for row in manifest["files"]
                            if row["website_path"] == f"data/{name}"
                        )
                        assert (
                            hashlib.sha256(response.body()).hexdigest()
                            == identity["sha256"]
                        )
                        payloads[name] = response.json()
                    components = {
                        c["id"]: c for c in payloads["ecosystem.json"]["components"]
                    }
                    checked = []
                    people_checked = check_people(
                        page,
                        components,
                        payloads["plugin-workshop-metadata.json"]["plugins"],
                        lang,
                    )
                    for card in page.locator(".plugin-card").all():
                        component = components[card.get_attribute("id")]
                        result = component.get(f"public_effect_{lang}")
                        if not result or not component.get("public_effect_url"):
                            continue
                        panel = card.locator(":scope > .plugin-public-effect")
                        expect(panel).to_be_visible()
                        expect(panel.locator("p")).to_have_text(result)
                        assert panel.locator("p").evaluate(
                            "e => e.scrollHeight <= e.clientHeight + 1"
                        )
                        expect(panel.locator("a")).to_have_attribute(
                            "href", component["public_effect_url"]
                        )
                        checked.append(component["id"])
                    assert {
                        "simllm-migration",
                        "pyramidkv-ascend-migration",
                        "vllm-hust-opset",
                        "request-lifecycle-profiler",
                        "kvcompress-ascend",
                        "pegaflow-vllm-connectors",
                    } <= set(checked)
                    simllm = page.locator("#simllm-migration")
                    expect(simllm).to_contain_text("5/12")
                    expect(simllm).to_contain_text("12/12")
                    expect(simllm.locator(".plugin-performance")).to_have_count(0)
                    for component_id, value in (
                        ("pegaflow-vllm-connectors", "+6.34%"),
                        ("bidkv", "+13.83%"),
                        ("kvcompress-ascend", "-3.55%"),
                    ):
                        expect(
                            page.locator(f"#{component_id} .plugin-performance")
                        ).to_contain_text(value)
                    assert (
                        "No data"
                        not in page.locator("[data-plugin-catalog]").inner_text()
                    )
                    assert (
                        "缺数据"
                        not in page.locator("[data-plugin-catalog]").inner_text()
                    )
                    assert page.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth + 1"
                    )
                    assert not errors, errors
                    stem = f"{width}-{lang}-{theme}"
                    simllm.screenshot(path=str(args.output / f"simllm-{stem}.png"))
                    page.locator("#pyramidkv-ascend-migration").screenshot(
                        path=str(args.output / f"pyramidkv-{stem}.png")
                    )
                    page.screenshot(
                        path=str(args.output / f"catalog-{stem}.png"), full_page=True
                    )
                    receipts.append(
                        {
                            "width": width,
                            "language": lang,
                            "theme": theme,
                            "cards": checked,
                            "people_cards": people_checked,
                            "manifest_sha256": hashlib.sha256(manifest_raw).hexdigest(),
                            "source_commit": manifest["commit"],
                            "projection": manifest.get("projection"),
                            "errors": errors,
                        }
                    )
                    (args.output / "manifest.json").write_bytes(manifest_raw)
                    page.locator("#langToggle").click()
                    switched = check_people(
                        page,
                        components,
                        payloads["plugin-workshop-metadata.json"]["plugins"],
                        "en" if lang == "zh" else "zh",
                    )
                    assert switched == people_checked
                    context.close()
        browser.close()
    (args.output / "verification.json").write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        f"PASS: {len(receipts)} modes; MOD people and effects visible with exact links"
    )


if __name__ == "__main__":
    main()
