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
    assert "./data/midterm-v076.json" in loader
    payload = json.loads((ROOT / "data/midterm-v076.json").read_text())
    assert payload["version"] == "V0.76"
    assert "C / C_reference" in payload["m01_method"]["efficiency_formula"]
    assert (
        payload["m01_method"]["current"]["reference_effective_tflops_per_chip"] is None
    )
    inventory = next(
        section
        for section in payload["sections"]
        if section["id"] == "dataset-quality-inventory"
    )
    assert len(inventory["tables"]) == 6
    assert sum(len(table["rows"]) for table in inventory["tables"]) == 24
    assert [row[1] for row in inventory["tables"][-1]["rows"]] == [
        "151 / 200",
        "152 / 200",
        "149 / 200",
        "146 / 200",
    ]
    assert (
        "reports/mmlu-quality018-20261022/quality018-completed-audit-r1.json" in loader
    )
    for filename in ("dataset-validation.html", "leaderboard-runs.html"):
        parser = Elements()
        parser.feed((ROOT / filename).read_text())
        assert [src for src in parser.scripts if "midterm-report.js" in src] == [
            "./assets/midterm-report.js?v=midterm-v076-audit-20261023"
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


def test_v15_current_method_is_bilingual_and_not_historical_acceptance():
    data = json.loads((ROOT / "data/midterm-v076.json").read_text())
    method = data["m01_method"]
    assert method["method_version"] == "V1.5"
    assert method["current"]["passed"] is None
    assert method["measured_synchronized_b1"]["completed"] == 200
    assert method["measured_synchronized_b1"]["failed"] == 0
    assert (
        method["measured_synchronized_b1"]["synchronized_seconds"] == 120.65347687713802
    )
    audit = data["milestone_contract"]
    assert audit["cost_method"]["lifecycle_is_current_gate"] is False
    assert audit["stability_method"]["six_probe_pass_is_task_stability_pass"] is False
    sections = {s["id"]: s for s in data["sections"]}
    assert "同工作量" in sections["m01-verdict"]["scope"]
    assert "same-workload" in sections["m01-verdict"]["scope_en"]
    assert "不是当前成本否决条件" in sections["resources"]["scope"]
    assert "not a current cost veto" in sections["resources"]["scope_en"]
    assert sections["milestone-v15"]["tables_en"]
    assert len(sections["milestone-v15"]["evidence"]) == 3
    review = sections["v15-remaining"]
    assert len(review["tables"][0]["rows"]) == 5
    assert len(review["tables_en"][0]["rows"]) == 5
    assert "22.601951%" in review["scope"]
    assert "does not improve" in review["scope_en"]
    assert "E2E is not TTFT/TPOT" in review["scope_en"]
    assert "1730876356085005" in review["scope"]
