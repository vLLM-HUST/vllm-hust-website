import hashlib
import json
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]


def test_all_data_files_match_the_benchmark_publication_manifest():
    manifest_path = ROOT / "data/benchmark-source-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    assert manifest["repository"] == "vLLM-HUST/vllm-hust-benchmark"
    entries = manifest["files"]
    expected = {entry["website_path"] for entry in entries}
    actual = {
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "data").rglob("*")
        if path.is_file() and path != manifest_path
    }
    assert actual == expected
    assert len(entries) == len(expected)
    for entry in entries:
        assert entry["benchmark_path"].startswith("website-publication/data/")
        raw = (ROOT / entry["website_path"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == entry["sha256"]
        assert len(raw) == entry["bytes"]


class Elements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if tag == "script":
            self.scripts.append(attrs.get("src", ""))


def test_midterm_loader_cache_key_matches_publication_version():
    loader = (ROOT / "assets/midterm-report.js").read_text()
    assert "./data/midterm-v060.json" in loader
    for filename in ("dataset-validation.html", "leaderboard-runs.html"):
        parser = Elements()
        parser.feed((ROOT / filename).read_text())
        assert [src for src in parser.scripts if "midterm-report.js" in src] == [
            "./assets/midterm-report.js?v=midterm-v060-20261021"
        ]


def test_three_destinations_preserve_sections_without_duplicate_ids():
    for page, ids in {
        "leaderboard-runs.html": {
            "frontier-panel",
            "fixed-targets",
            "official-target-body",
            "leaderboard-tbody",
        },
        "dataset-validation.html": {
            "matrix-content",
            "validation-content",
            "coverage-content",
        },
        "serving-plan.html": {"plan-options", "computed"},
    }.items():
        parser = Elements()
        parser.feed((ROOT / page).read_text())
        assert len(parser.ids) == len(set(parser.ids))
        assert ids <= set(parser.ids)
    for obsolete in (
        "leaderboard.html",
        "dataset-matrix-v1.html",
        "capability-coverage.html",
    ):
        assert not (ROOT / obsolete).exists()
        for page in ROOT.glob("*.html"):
            parser = Elements()
            parser.feed(page.read_text())
            assert not any(
                link.split("#")[0].split("?")[0].endswith("/" + obsolete)
                for link in parser.links
            )
