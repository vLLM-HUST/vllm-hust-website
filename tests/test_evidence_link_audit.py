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
