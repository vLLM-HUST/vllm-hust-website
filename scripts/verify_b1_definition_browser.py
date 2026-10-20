"""Check the measured-best legend in both languages and viewport sizes."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--browser", help="Optional installed Chromium executable")
    parser.add_argument(
        "--scenario", help="Also verify a measured scenario and its candidate details"
    )
    parser.add_argument(
        "--output", type=Path, default=Path("/tmp/b1-definition-browser")
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    server = None
    if not args.url:
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            partial(
                SimpleHTTPRequestHandler,
                directory=str(Path(__file__).resolve().parents[1]),
            ),
        )
        Thread(target=server.serve_forever, daemon=True).start()
        args.url = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=args.browser)
            for width in (320, 390, 1440):
                for lang in ("zh", "en"):
                    for theme in ("light", "dark"):
                        context = browser.new_context(
                            viewport={"width": width, "height": 900}, color_scheme=theme
                        )
                        context.add_init_script(
                            f"localStorage.setItem('vllm-hust_lang', '{lang}');"
                            f"localStorage.setItem('vllm-hust_theme', '{theme}');"
                        )
                        page = context.new_page()
                        errors = []
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        suffix = f"?model={args.scenario}" if args.scenario else ""
                        page.goto(args.url + "/dataset-validation.html" + suffix)
                        legend = page.locator("#validation-legend-b1")
                        expect(legend).to_have_text(
                            "当前已实测最优的vLLM-HUST优化方案"
                            if lang == "zh"
                            else "Currently best measured vLLM-HUST optimization solution"
                        )
                        legend.scroll_into_view_if_needed()
                        assert legend.evaluate(
                            "e => e.getBoundingClientRect().right <= innerWidth"
                        )
                        assert not errors, errors
                        if args.scenario:
                            expect(
                                page.locator("#validation-model-select")
                            ).to_have_value(args.scenario)
                            cell = page.locator(
                                '[data-cell="mmlu-pro:output_token_throughput"]'
                            )
                            expect(cell).to_be_visible()
                            cell.click()
                            expect(
                                page.locator(".validation-candidate--selected")
                            ).to_have_count(1)
                            expect(
                                page.locator("#validation-detail-meta")
                            ).to_contain_text(
                                "截断提取命中"
                                if lang == "zh"
                                else "Separate out8192 quality regression"
                            )
                            expect(
                                page.locator("#validation-detail-meta")
                            ).not_to_contain_text(
                                "未重评任务正确率"
                                if lang == "zh"
                                else "Task accuracy was not rescored"
                            )
                            page.locator("#validation-detail").evaluate(
                                "e => e.scrollIntoView({block: 'start', behavior: 'instant'})"
                            )
                            assert page.locator("#validation-detail h3").evaluate(
                                "e => e.getBoundingClientRect().top >= "
                                "document.querySelector('.site-nav').getBoundingClientRect().bottom"
                            )
                        page.screenshot(
                            path=str(args.output / f"b1-{width}-{lang}-{theme}.png")
                        )
                        if args.scenario:
                            meta = page.locator("#validation-detail-meta > dd").filter(
                                has_text="out8192"
                            )
                            meta.evaluate(
                                "e => e.scrollIntoView({block: 'start', behavior: 'instant'})"
                            )
                            page.evaluate("scrollBy(0, -88)")
                            assert meta.evaluate(
                                "e => e.getBoundingClientRect().right <= innerWidth"
                            )
                            page.screenshot(
                                path=str(
                                    args.output / f"quality-{width}-{lang}-{theme}.png"
                                )
                            )
                        context.close()
            browser.close()
    finally:
        if server:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
