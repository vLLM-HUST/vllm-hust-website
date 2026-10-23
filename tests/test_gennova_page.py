from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])


def test_standalone_page_and_discoverable_entrances():
    html = (ROOT / "gennova.html").read_text()
    parser = Page()
    parser.feed(html)
    assert len(parser.ids) == len(set(parser.ids))
    assert {"validation", "evidence", "gn-status", "gn-metrics"} <= set(parser.ids)
    assert "独立推理引擎" in html
    assert "不构成超过当前 B1" in html
    assert "完整 MMLU-Pro 准确率" in html
    for page in ("index.html", "plugins.html", "assets/site.js"):
        assert "./gennova.html" in (ROOT / page).read_text()
    assert 'data-page="gennova"' in html
    assert "data-plugin-id" not in html
