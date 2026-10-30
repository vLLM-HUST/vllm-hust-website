import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "evidence_audit", ROOT / "scripts/audit_evidence_links_browser.py"
)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


def test_registry_audit_includes_every_frontier_point():
    registry = json.loads((ROOT / "data/benchmark-evidence-links.json").read_text())
    manifest = json.loads((ROOT / "data/benchmark-source-manifest.json").read_text())
    urls = AUDIT.evidence_urls(registry, manifest["commit"])
    assert len(registry["frontier_points"]) >= 338
    for entry in registry["frontier_points"].values():
        point_urls = AUDIT.evidence_urls(entry, manifest["commit"])
        assert point_urls
        assert point_urls <= urls


def test_nested_locators_and_release_links_are_retained():
    release = "https://github.com/vLLM-HUST/vllm-hust-benchmark/releases/download/tag/raw.tar.gz"
    assert AUDIT.evidence_urls(
        [{"kind": "tree", "path": "archive/example"}, {"evidence": release}], "abc"
    ) == {
        "https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/abc/archive/example",
        release,
    }


def test_report_audit_follows_all_current_loaders_and_joint_evidence():
    for name in ("midterm-report.js", "current-measurements.js", "b0-b1.js"):
        assert AUDIT.CURRENT_REPORT in (ROOT / "assets" / name).read_text()
    report = json.loads((ROOT / "data" / AUDIT.CURRENT_REPORT).read_text())
    assert report["version"] == AUDIT.CURRENT_VERSION
    urls = AUDIT.evidence_urls(report, report["source_commit"])
    for name in (
        "joint-summary.json",
        "continuous-summary.json",
        "original-telemetry.tar.gz",
    ):
        assert any(url.endswith("/full-answer-joint-20261030/" + name) for url in urls)
