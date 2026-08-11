#!/usr/bin/env python3
"""Capture official fixed-target card screenshots (issue #168).

Development tool: renders the leaderboard page with a local server, forces the
repo-hosted registry mirror so the card renders deterministically, and saves
Chinese/English desktop and narrow-viewport screenshots under screenshots/.

Not part of CI. Requires Playwright and a locally running server, e.g.:

    python3 -m http.server 8090 --bind 127.0.0.1
    python3 scripts/capture_official_target_screenshots.py

The committed screenshots are cropped to the card region to stay under the
pre-commit check-added-large-files limit (1000 KB); regenerate then crop as
needed before committing.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "screenshots"


def wait_card(page: Page) -> None:
    """Force the local mirror and wait for the official-target card to render."""
    page.route("**/raw.githubusercontent.com/**", lambda route: route.abort())
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector("#official-target-body .official-target-item", timeout=30000)
    page.wait_for_timeout(600)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture official fixed-target card screenshots."
    )
    parser.add_argument(
        "--url",
        default=os.environ.get(
            "OFFICIAL_TARGET_URL", "http://127.0.0.1:8090/leaderboard.html"
        ),
        help="Leaderboard page URL (default: local server on port 8090).",
    )
    parser.add_argument(
        "--out",
        default=str(OUT_DIR),
        help="Output directory for screenshots.",
    )
    return parser.parse_args()


def main() -> int:
    global URL
    args = parse_args()
    URL = args.url
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---- English desktop ----
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        wait_card(page)
        page.click("#official-target-toggle")
        page.wait_for_timeout(400)
        page.screenshot(
            path=str(out / "official-target-en-desktop.png"), full_page=True
        )
        # ---- Chinese desktop ----
        page.click("#langToggle")
        page.wait_for_timeout(500)
        page.screenshot(
            path=str(out / "official-target-zh-desktop.png"), full_page=True
        )
        ctx.close()

        # ---- Chinese narrow ----
        ctx = browser.new_context(viewport={"width": 390, "height": 844})
        page = ctx.new_page()
        wait_card(page)
        page.click("#langToggle")
        page.wait_for_timeout(500)
        page.click("#official-target-toggle")
        page.wait_for_timeout(400)
        page.screenshot(path=str(out / "official-target-zh-narrow.png"), full_page=True)
        # ---- English narrow ----
        page.click("#langToggle")
        page.wait_for_timeout(500)
        page.screenshot(path=str(out / "official-target-en-narrow.png"), full_page=True)
        ctx.close()
        browser.close()

    print(f"screenshots saved to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
