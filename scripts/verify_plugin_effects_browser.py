"""Check every MOD's people, current result and source in eight display modes."""

import argparse
import hashlib
import json
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from verify_product_homepages_browser import CONTRAST


def check_r10_and_result_updates(page, components, release_history, lang):
    entry = next(
        row
        for row in release_history["entries"]
        if row["id"] == release_history["default_release"]
    )
    latest = page.locator("#r11-mods")
    release = entry["full_acceptance"]
    expect(latest).to_be_visible()
    expect(latest).to_contain_text(release["pypi_version"])
    expect(latest).to_contain_text(release["scheduler_profile"])
    enabled = sorted(
        release["enabled_components"], key=lambda item: bool(item.get("condition"))
    )
    ids = [item["id"] for item in enabled]
    assert len(ids) == 12
    expect(latest.locator("[data-release-component]")).to_have_count(len(ids))
    engine = page.locator('[data-product-scope="engine"]')
    pinned = engine.locator(".plugin-category").first
    expect(pinned).to_have_attribute("data-pinned-release", entry["id"])
    assert (
        pinned.locator(".plugin-card").evaluate_all(
            "cards => cards.map(card => card.id)"
        )
        == ids
    )
    for component in ids:
        link = latest.locator(f'[data-release-component="{component}"]')
        expect(link).to_have_attribute("href", f"#{component}")
        expect(page.locator(f"#{component}")).to_have_count(1)
        expect(pinned.locator(f"#{component} .release-component")).to_contain_text(
            entry["id"].upper()
        )
    for component, zh, en in [
        ("intern-s2", "仅 Intern-S2", "Intern-S2 only"),
        ("state-page-copy", "仅符合条件的自有状态", "Qualified owned state only"),
    ]:
        label = zh if lang == "zh" else en
        expect(
            latest.locator(f'[data-release-component="{component}"]')
        ).to_contain_text(label)
        expect(pinned.locator(f"#{component} .release-component")).to_contain_text(
            label
        )
    latest.locator('[data-release-component="intern-s2"]').click()
    expect(page.locator("#intern-s2")).to_be_visible()

    r10 = next(entry for entry in release_history["entries"] if entry["id"] == "r10")
    box = page.locator("#r10-mods")
    expect(box).to_be_visible()
    expect(box).to_contain_text(r10["r10_revision"]["pypi_version"])
    expect(box.locator("[data-r10-component]")).to_have_count(len(r10["mods"]))
    assert len(r10["mods"]) == 11
    ids = box.locator("[data-r10-component]").evaluate_all(
        "nodes => nodes.map(node => node.dataset.r10Component)"
    )
    assert ids == [
        "vllm-hust-extension-manager",
        "betterscale",
        "prefill-microflow",
        "kv-materialization-arrival-control",
        "hust-m01-correction",
        "hust-joint-packed",
        "sealed-serving-warmup",
        "guarded-progress-async",
        "capacity-tuning",
        "short-prefill-tail",
        "state-page-copy",
    ]
    for component_id in ids:
        expect(box.locator(f'[data-r10-component="{component_id}"]')).to_have_attribute(
            "href", f"#{component_id}"
        )

    for component_id, evidence_path, values in (
        ("diffspec", "/diffspec/README.md", ("48b1828", "24", "1294c95")),
        ("prefix-router-migration", "/prefix-router/README.md", ("47.88%", "174.80")),
    ):
        panel = page.locator(f"#{component_id} > .plugin-public-effect")
        expect(panel).to_be_visible()
        effect = components[component_id]
        expect(panel.locator("p")).to_have_text(effect[f"public_effect_{lang}"])
        assert effect["public_effect_url"].endswith(evidence_path)
        expect(panel.locator("a")).to_have_attribute(
            "href", effect["public_effect_url"]
        )
        for value in values:
            expect(panel).to_contain_text(value)

    search = page.locator("[data-plugin-search]")
    search.fill("DiffSpec")
    expect(page.locator("#diffspec")).to_be_visible()
    expect(page.locator("[data-pinned-release]")).to_have_count(0)
    expect(page.locator("#prefix-router-migration")).to_have_count(0)
    search.fill("Prefix Router")
    expect(
        page.locator("#prefix-router-migration > .plugin-public-effect")
    ).to_be_visible()
    expect(page.locator("#diffspec")).to_have_count(0)
    box.locator('[data-r10-component="state-page-copy"]').click()
    expect(page.locator("#state-page-copy")).to_be_visible()
    expect(search).to_have_value("")
    page.locator('[data-product-filter="control-plane"]').click()
    expect(box).to_be_hidden()
    expect(page.locator("[data-pinned-release]")).to_have_count(0)
    page.locator('[data-product-filter="engine"]').click()
    expect(box).to_be_visible()
    expect(pinned).to_have_attribute("data-pinned-release", entry["id"])
    page.locator('[data-product-filter="all"]').click()
    return {"release": r10["release"], "enabled": ids, "result_panels": 2}


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
        expect(page.locator(".r8-catalog-stack")).to_have_count(0)
        if product != "engine":
            expect(page.locator("[data-plugin-model]")).to_be_hidden()
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
    # Grouping shares a project card without removing constituent MOD anchors.
    page.goto(f"{base_url}?product=continuum#mooncake", wait_until="domcontentloaded")
    expect(
        page.locator("#mooncake-vllm-connectors details[open] #mooncake")
    ).to_be_visible()
    assert "product=continuum" not in page.url
    page.locator("[data-plugin-search]").fill("simllm-migration")
    expect(page.locator("#pegaflow")).to_have_count(0)
    page.evaluate("location.hash = 'pegaflow'")
    expect(
        page.locator("#pegaflow-vllm-connectors details[open] #pegaflow")
    ).to_be_visible()

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
        upstream = component.get("upstream_creators", [])
        assert logins or upstream, f"Missing creator attribution: {component['id']}"
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
            declared = next(
                (
                    p
                    for p in component.get("maintainer_profiles", [])
                    if p["login"] == login
                ),
                {},
            )
            name = person.get("name") or declared.get("name")
            assert name, f"Missing creator name: {login}"
            expect(link).to_contain_text(name)
        for group in upstream:
            link = panel.locator(f'a.plugin-upstream-creator[href="{group["url"]}"]')
            expect(link).to_be_visible()
            expect(link).to_have_text(group[f"name_{lang}"])
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


def check_engine_catalog_consistency(page, context, base_url, components):
    """Engine components share their names and creators with ordinary MOD cards."""
    expect(page.locator(".r8-catalog-stack")).to_have_count(0)
    engine = context.new_page()
    try:
        engine.goto(f"{base_url}/engine.html#r8-mods", wait_until="domcontentloaded")
        expect(engine.locator("#r8-mods")).to_be_visible()
        expected = engine.locator("#r8-mods tbody tr").evaluate_all(
            """rows => rows.map(row => ({
                id: row.dataset.r8ModId,
                name: row.cells[0].innerText.trim(),
                creator: row.querySelector(".r8-mod-creator a").href
            }))"""
        )
    finally:
        engine.close()
    assert len(expected) == 10
    aliases = {
        "extension-manager": "vllm-hust-extension-manager",
        "microflow": "prefill-microflow",
        "kv-materialization": "kv-materialization-arrival-control",
        "m01-correction": "hust-m01-correction",
        "packed-host": "hust-joint-packed",
    }
    for row in expected:
        assert not re.search(r"\d", row["name"])
        component_id = aliases.get(row["id"], row["id"])
        component = components[component_id]
        card = page.locator(f"#{component_id}.plugin-card")
        expect(card).to_be_visible()
        expect(card.locator(":scope > h3")).to_have_text(row["name"])
        creator = card.locator(f'.plugin-maintainer[href="{row["creator"]}"]')
        expect(creator).to_be_visible()
        login = row["creator"].rstrip("/").rsplit("/", 1)[1]
        person = next(
            p for p in component["maintainer_profiles"] if p["login"] == login
        )
        expect(creator).to_contain_text(person["name"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--channel", help="Use an installed Chromium browser channel")
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
        browser = pw.chromium.launch(args=launch_args, channel=args.channel)
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
                        "engine-release-history-v1.json",
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
                    check_engine_catalog_consistency(
                        page, context, args.url, components
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
                    catalog_updates = check_r10_and_result_updates(
                        page,
                        components,
                        payloads["engine-release-history-v1.json"],
                        lang,
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
                            "catalog_updates": catalog_updates,
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
        page = browser.new_page()
        page.route(
            "**/data/engine-release-history-v1.json",
            lambda route: route.fulfill(body="{}", content_type="application/json"),
        )
        page.goto(args.url.rstrip("/") + "/plugins.html")
        expect(page.locator("#diffspec")).to_be_visible()
        expect(page.locator("#r11-mods")).to_be_hidden()
        expect(page.locator("[data-pinned-release]")).to_have_count(0)
        page.close()
        browser.close()
    (args.output / "verification.json").write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        f"PASS: {len(receipts)} modes; product views, MOD people, effects and sources"
    )


if __name__ == "__main__":
    main()
