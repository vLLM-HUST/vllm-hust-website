"""Verify the paused GenNova page and promotional entrances stay unpublished."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--browser")
    parser.add_argument(
        "--output", type=Path, default=Path("output/playwright/gennova")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parents[1]
    records = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=args.browser)
        page = browser.new_page()
        response = page.goto(args.url.rstrip("/") + "/gennova.html")
        assert response.status in (404, 410), response.status
        records.append(dict(page="gennova.html", status=response.status))
        for language in ("zh", "en"):
            context = browser.new_context()
            context.add_init_script(
                f"localStorage.setItem('vllm-hust_lang','{language}')"
            )
            page = context.new_page()
            for path in sorted(root.glob("*.html")):
                response = page.goto(
                    args.url.rstrip("/") + "/" + path.name, wait_until="networkidle"
                )
                assert response.status == 200
                assert "gennova" not in page.locator("body").inner_text().lower(), (
                    path.name
                )
                assert (
                    page.locator('a[href*="gennova.html"], a[href*="/GenNova"]').count()
                    == 0
                ), path.name
                records.append(dict(page=path.name, language=language, status="passed"))
            context.close()
        browser.close()
    (args.output / "results.json").write_text(json.dumps(records, indent=2) + "\n")
    print(f"PASS: withdrawn page + {len(records) - 1} public page/language checks")


if __name__ == "__main__":
    main()
