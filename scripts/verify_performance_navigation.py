"""Local browser acceptance for the consolidated three-entry navigation."""

import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/playwright/performance-navigation"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            launch = {"args": ["--no-sandbox"]}
            executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
            if executable:
                launch["executable_path"] = executable
            browser = p.chromium.launch(**launch)
            try:
                OUTPUT.mkdir(parents=True, exist_ok=True)
                for width in (390, 1440):
                    for language in ("zh", "en"):
                        for filename in (
                            "leaderboard-runs.html",
                            "dataset-validation.html",
                            "serving-plan.html",
                        ):
                            page = browser.new_page(
                                viewport={"width": width, "height": 1000}
                            )
                            errors = []
                            page.on(
                                "pageerror", lambda error: errors.append(str(error))
                            )
                            page.goto(
                                f"http://127.0.0.1:{server.server_port}/{filename}",
                                wait_until="domcontentloaded",
                            )
                            page.wait_for_function("Boolean(window.vllmHustSite)")
                            page.evaluate(
                                "(lang) => window.vllmHustSite.setLang(lang)", language
                            )
                            assert (
                                page.locator('[data-nav-group="performance"] a').count()
                                == 3
                            )
                            assert (
                                page.locator(
                                    '[data-nav-group="performance"] a[href="./serving-plan.html"]'
                                ).count()
                                == 1
                            )
                            page.locator("#benchmark-source").wait_for()
                            if filename == "dataset-validation.html":
                                page.locator("#matrix-content").wait_for(
                                    state="visible"
                                )
                                page.locator("#coverage > summary").click()
                                assert (
                                    page.locator(
                                        "#coverage-content .coverage-cell"
                                    ).count()
                                    > 0
                                )
                                assert (
                                    page.locator("#coverage-content h1").evaluate(
                                        "(el) => getComputedStyle(el).color"
                                    )
                                    == "rgb(29, 41, 57)"
                                )
                            elif filename == "leaderboard-runs.html":
                                page.locator("#fixed-targets > summary").click()
                                page.wait_for_function(
                                    "document.querySelector('#official-target-body').textContent.trim().length > 0"
                                )
                            else:
                                page.locator("#plan-options input").first.wait_for()
                                assert page.locator("#plan-options input").count() > 0
                            assert page.evaluate("""() => {
                                const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
                                return ids.length === new Set(ids).size;
                            }""")
                            assert not errors, errors
                            page.screenshot(
                                path=OUTPUT
                                / f"{filename.removesuffix('.html')}-{width}-{language}.png"
                            )
                            print(filename, width, language, "PASS", flush=True)
                            page.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
