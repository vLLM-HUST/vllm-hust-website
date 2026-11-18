"""Check every MOD's people, current result and source in eight display modes."""

import argparse
import hashlib
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from verify_product_homepages_browser import CONTRAST


def check_product_views(page, taxonomy):
    """Product browsing must preserve identities, results and legacy guide links."""
    search = page.locator("[data-plugin-search]")
    search.fill("")
    cards = page.locator(".plugin-card")
    original = set(cards.evaluate_all("nodes => nodes.map(n => n.id)"))
    assert len(original) == cards.count()
    expected = {"engine": set(), "control-plane": set(), "archive": set()}
    for component_id in original:
        kind = taxonomy[component_id]["kind"]
        product = (
            "control-plane"
            if kind == "control_plane"
            else "archive"
            if kind == "retired"
            else "engine"
        )
        expected[product].add(component_id)
    assert expected["engine"] and expected["control-plane"]
    expect(page.locator(".mod-reference[open]")).to_have_count(0)
    for product, home in (
        ("engine", "engine.html"),
        ("control-plane", "control-plane.html"),
        ("continuum", "continuum.html"),
    ):
        button = page.locator(f'[data-product-filter="{product}"]')
        button.focus()
        button.press("Enter")
        expect(button).to_be_focused()
        expect(button).to_have_attribute("aria-pressed", "true")
        assert f"product={product}" in page.url
        scope = page.locator(f'[data-product-scope="{product}"]')
        expect(scope).to_be_visible()
        expect(scope.locator(".mod-product-results-heading a")).to_have_attribute(
            "href", f"./{home}"
        )
        expect(page.locator("[data-plugin-model]")).to_have_value("")
        if product == "continuum":
            expect(cards).to_have_count(0)
            expect(scope.locator(".mod-plan-status")).to_be_visible()
            expect(scope.locator("li")).to_have_count(4)
            expect(page.locator(".plugin-controls")).to_be_hidden()
            expect(page.locator(".workload-navigation")).to_be_hidden()
            expect(page.locator(".plugin-catalog-scope")).to_be_hidden()
            expect(page.locator(".continuum-mod-plan")).to_contain_text(
                "沙箱"
                if page.locator("html").get_attribute("lang") == "zh"
                else "Sandbox"
            )
        else:
            assert (
                set(cards.evaluate_all("nodes => nodes.map(n => n.id)"))
                == (expected[product])
            )
            expect(page.locator(".plugin-controls")).to_be_visible()
            expect(page.locator("[data-layer=retired]")).to_be_disabled()
            expect(page.locator("[data-layer=retired]")).to_be_hidden()
            assert page.locator("[data-layer=control_plane]").is_enabled() == (
                product == "control-plane"
            )
            # A filter with a real phase must not escape its product scope.
            phases = page.locator("[data-phase]:enabled:not([data-phase=all])")
            if phases.count():
                phases.first.click()
                filtered = set(cards.evaluate_all("nodes => nodes.map(n => n.id)"))
                assert filtered and filtered <= expected[product]
            search.fill("no-such-product-mod-entry")
            expect(cards).to_have_count(0)
            # Switching products clears filters and search, including empty states.
            page.locator('[data-product-filter="all"]').click()
            button.click()
            expect(search).to_have_value("")
            assert (
                set(cards.evaluate_all("nodes => nodes.map(n => n.id)"))
                == (expected[product])
            )
        if product != "engine":
            expect(page.locator(".r8-catalog-stack")).to_be_hidden()
            expect(page.locator("[data-plugin-model]")).to_be_hidden()
        else:
            expect(page.locator(".r8-catalog-stack")).to_be_visible()
        # Language changes keep the selected product rather than restoring all.
        page.locator("#langToggle").click()
        expect(button).to_have_attribute("aria-pressed", "true")
        page.locator("#langToggle").click()
        for title in page.locator(
            ".mod-products-heading h2, .mod-product-results-heading h2, "
            ".mod-product-option strong, .mod-product-option a, "
            '.mod-product-actions button[aria-pressed="true"], '
            ".r8-catalog-stack h2, .mod-plan-status"
        ).all():
            if title.is_visible():
                assert title.evaluate(CONTRAST) >= 4.5, title.inner_text()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    page.reload(wait_until="domcontentloaded")
    expect(page.locator('[data-product-filter="continuum"]')).to_have_attribute(
        "aria-pressed", "true"
    )
    expect(page.locator('[data-product-filter="continuum"]')).to_be_enabled()
    expect(cards).to_have_count(0)
    all_products = page.locator('[data-product-filter="all"]')
    all_products.focus()
    all_products.press("Space")
    expect(all_products).to_be_focused()
    assert "product=" not in page.url
    assert set(cards.evaluate_all("nodes => nodes.map(n => n.id)")) == original
    # Old anchors must open the relevant disclosure on initial load and clicks.
    base_url = page.url.split("?", 1)[0].split("#", 1)[0]
    page.goto(f"{base_url}#plugin-standard", wait_until="domcontentloaded")
    expect(page.locator(".mod-reference[open] #plugin-standard")).to_be_visible()
    page.locator('.mod-reference-links a[href="#mod-test-protocol"]').click()
    expect(page.locator(".mod-reference[open] #mod-test-protocol")).to_be_visible()
    page.goto(f"{base_url}?product=unknown", wait_until="domcontentloaded")
    expect(all_products).to_have_attribute("aria-pressed", "true")
    expect(cards).to_have_count(len(original))
    assert set(cards.evaluate_all("nodes => nodes.map(n => n.id)")) == original
    return {key: sorted(value) for key, value in expected.items()}


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
    parser.add_argument(
        "--host-ip", help="Optional verified origin IPv4 for browser DNS"
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    receipts = []
    launch_args = []
    if args.host_ip:
        import socket
        from urllib.parse import urlparse

        host = urlparse(args.url).hostname
        assert args.host_ip in {r[4][0] for r in socket.getaddrinfo(host, 443)}
        launch_args = [
            "--disable-quic",
            f"--host-resolver-rules=MAP {host} {args.host_ip}",
        ]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=launch_args)
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
                    for component_id in (
                        "traceloom",
                        "latchmoe",
                        "tricard-clm-lifecycle",
                        "ascend-adaptive-quantized-kv",
                        "dla",
                        "stateaxis-automatic-prefix-cache",
                        "stateaxis-async-kv-transfer",
                        "stateaxis-pipelined-weight-loading",
                        "cuda-mtp",
                        "memory-tracker",
                        "ascend-mapped-kv-offload",
                        "scheduler-policy-lab",
                    ):
                        card = page.locator(f"#{component_id}")
                        expect(card).to_be_visible()
                        expect(card.locator(".plugin-summary")).to_have_text(
                            components[component_id][f"summary_{lang}"]
                        )
                        if component_id.startswith("stateaxis-"):
                            component = components[component_id]
                            assert component["repository_visibility"] == "private"
                            assert "canonical_repository" not in component
                            expect(card.locator("a.plugin-repository")).to_have_count(0)
                            expect(card.locator(".plugin-maintainer")).to_contain_text(
                                "张书豪"
                            )
                        details = card.locator(".plugin-technical-details")
                        details.locator("summary").click()
                        expect(
                            details.locator(".plugin-technical-body")
                        ).to_be_visible()
                        details.locator("summary").click()
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
                        source_link = panel.locator("a")
                        if (
                            source_link.get_attribute("data-repository-access")
                            == "required"
                        ):
                            expect(source_link).to_have_attribute(
                                "data-repository-url", component["public_effect_url"]
                            )
                            expect(source_link).to_have_attribute(
                                "aria-disabled", "true"
                            )
                            assert source_link.get_attribute("href") is None
                            expect(source_link).to_contain_text(
                                "需仓库权限"
                                if lang == "zh"
                                else "Repository access required"
                            )
                        else:
                            expect(source_link).to_have_attribute(
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
                        "muxpd",
                    } <= set(checked)
                    simllm = page.locator("#simllm-migration")
                    expect(simllm).to_contain_text("5/12")
                    expect(simllm).to_contain_text("12/12")
                    expect(simllm.locator(".plugin-performance")).to_have_count(0)
                    for component_id, value in (
                        ("pegaflow-vllm-connectors", "+6.34%"),
                        ("bidkv", "+13.83%"),
                        ("muxpd", "+23.31%"),
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
                    muxpd = page.locator("#muxpd")
                    expect(muxpd).to_contain_text("+7.40%")
                    expect(muxpd.locator(".plugin-performance")).to_contain_text(
                        "161.68 → 199.37 token/s"
                    )
                    expect(muxpd.locator(".plugin-performance")).to_contain_text(
                        "未评估答案质量" if lang == "zh" else "quality not evaluated"
                    )
                    muxpd.screenshot(path=str(args.output / f"muxpd-{stem}.png"))
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
                    search = page.locator("[data-plugin-search]")
                    search.fill("ascend-attention-boundary")
                    op01 = page.locator("#ascend-attention-boundary")
                    expect(op01).to_be_visible()
                    expect(op01.locator(".plugin-public-effect p")).to_have_text(
                        components["ascend-attention-boundary"][
                            "public_effect_en" if lang == "zh" else "public_effect_zh"
                        ]
                    )
                    op01_details = op01.locator(".plugin-technical-details")
                    op01_details.locator("summary").click()
                    expect(
                        op01_details.locator(".plugin-technical-body")
                    ).to_be_visible()
                    search.fill("BetterScale")
                    betterscale = page.locator("#betterscale")
                    expect(betterscale).to_be_visible()
                    expect(betterscale.locator(".plugin-advisors")).to_contain_text(
                        "Shuhao Zhang" if lang == "zh" else "张书豪"
                    )
                    expect(
                        betterscale.locator(".plugin-public-effect")
                    ).to_contain_text("39.63%")
                    expect(
                        betterscale.locator(".plugin-public-effect")
                    ).to_contain_text("35.17%")
                    details = betterscale.locator(".plugin-technical-details")
                    expect(details).not_to_have_attribute("open", "")
                    details.locator("summary").click()
                    expect(details.locator(".plugin-test-review")).to_be_visible()
                    for token in ("268.89", "375.45", "155.13", "209.68", "32/32"):
                        expect(details.locator(".plugin-test-review")).to_contain_text(
                            token
                        )
                    expect(
                        betterscale.locator('a[href*="betterscale.html"]')
                    ).to_have_count(0)
                    assert (
                        context.request.get(f"{args.url}/betterscale.html").status
                        == 404
                    )
                    receipts[-1]["products"] = check_product_views(
                        page, payloads["mod-taxonomy.json"]["components"]
                    )
                    assert not errors, errors
                    context.close()
        browser.close()
    (args.output / "verification.json").write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        f"PASS: {len(receipts)} modes; product views, MOD people, effects and sources"
    )


if __name__ == "__main__":
    main()
