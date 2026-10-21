"""Check bulk expansion, individual disclosures and the performance navigation."""

import argparse

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8793")
    args = parser.parse_args()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in (1440, 390):
            page = browser.new_page(viewport={"width": width, "height": 1000})
            page.goto(args.url + "/dataset-validation.html#coverage")
            cells = page.locator(".coverage-cell")
            assert cells.count() == 110
            page.locator('[data-expand="covered"]').click()
            assert cells.evaluate_all("""cells => cells.every(cell =>
                cell.open === ['●', '◐'].includes(
                    cell.querySelector('.coverage-symbol').textContent.trim()))""")
            page.locator('[data-expand="all"]').click()
            assert (
                page.locator("#coverage-content details[open]").count() == cells.count()
            )
            page.locator('[data-expand="none"]').click()
            assert page.locator("#coverage-content details[open]").count() == 0
            cells.first.locator("summary").click()
            assert page.locator("#coverage-content details[open]").count() == 1
            cells.first.locator("summary").focus()
            page.keyboard.press("Enter")
            assert page.locator("#coverage-content details[open]").count() == 0
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.goto(args.url + "/index.html")
            assert page.locator('a[href="./dataset-validation.html"]').count() > 0
            page.close()
        browser.close()
    print("Capability coverage: desktop/mobile disclosures and navigation passed")


if __name__ == "__main__":
    main()
