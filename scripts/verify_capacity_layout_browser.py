"""Check shared page layout, formulas dialog and unchanged calculator interaction."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def verify(url, output):
    output.mkdir(parents=True, exist_ok=True)
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for lang in ("zh", "en"):
            for width in (390, 1440):
                for theme in ("light", "dark"):
                    page = browser.new_page(
                        viewport=dict(width=width, height=1000), color_scheme=theme
                    )
                    page.add_init_script(
                        f"localStorage.setItem('vllm-hust_lang','{lang}')"
                    )
                    errors = []
                    page.on("pageerror", lambda e: errors.append(str(e)))
                    page.goto(url + "/serving-plan.html")
                    expect(page.locator(".value-column").first).to_be_visible(
                        timeout=30000
                    )
                    expect(page.locator("main.focus-main")).to_have_count(1)
                    expect(page.locator(".focus-hero h1")).to_have_text(
                        "产能与成本" if lang == "zh" else "Capacity & cost"
                    )
                    dialog = page.locator("#plan-details-dialog")
                    expect(dialog).not_to_be_visible()
                    page.locator("#cost").fill("1200")
                    page.locator("#days").fill("28")
                    page.locator("#unit").select_option("month")
                    before = page.locator("#columns").inner_text()
                    button = page.locator("#open-plan-details")
                    button.click()
                    expect(dialog).to_be_visible()
                    expect(dialog.locator("#price-note")).not_to_be_empty()
                    expect(dialog).to_contain_text("API")
                    page.keyboard.press("Escape")
                    expect(dialog).not_to_be_visible()
                    expect(button).to_be_focused()
                    assert page.locator("#columns").inner_text() == before
                    page.locator("#langToggle").click()
                    expect(page.locator("#cost")).to_have_value("1200")
                    expect(page.locator("#days")).to_have_value("28")
                    expect(page.locator("#unit")).to_have_value("month")
                    assert page.evaluate(
                        "document.documentElement.scrollWidth<=innerWidth+1"
                    )
                    assert not errors, errors
                    page.screenshot(
                        path=str(output / f"{lang}-{width}-{theme}.png"), full_page=True
                    )
                    checks.append(
                        dict(
                            language=lang,
                            width=width,
                            theme=theme,
                            formula_dialog=True,
                            calculator_state_preserved=True,
                        )
                    )
                    page.close()
        browser.close()
    (output / "verification.json").write_text(json.dumps(checks, indent=2) + "\n")
    print(f"Verified {len(checks)} capacity layout/formula/state cases")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    a = parser.parse_args()
    verify(a.url.rstrip("/"), a.output)
