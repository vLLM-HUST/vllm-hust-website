"""Rendering reviewed metadata must not query PyPI or rewrite website data."""

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "version_readme", ROOT / "scripts/sync_version_meta.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_readme_only_uses_supplied_metadata_without_touching_data(
    tmp_path, monkeypatch
):
    metadata = tmp_path / "reviewed.json"
    metadata.write_text(
        json.dumps(
            {
                "release": {"headline_zh": "Reviewed snapshot"},
                "quickstart": {
                    "install_command": "reviewed-command",
                    "description_zh": "Reviewed instructions",
                    "runbook_url": "https://example.org/runbook",
                },
            }
        ),
        encoding="utf-8",
    )
    website_data = tmp_path / "website.json"
    website_data.write_text("unchanged", encoding="utf-8")
    readme = tmp_path / "README.md"
    readme.write_text(
        "<!-- BEGIN:VERSION_META -->\nold\n<!-- END:VERSION_META -->", encoding="utf-8"
    )

    def forbidden_fetch(*args):
        raise AssertionError(
            "Rendering a reviewed snapshot must not fetch remote versions"
        )

    monkeypatch.setattr(MODULE, "_fetch_latest_version", forbidden_fetch)
    monkeypatch.setattr(MODULE, "VERSION_META_PATH", website_data)
    monkeypatch.setattr(MODULE, "README_PATH", readme)
    monkeypatch.setattr(
        sys,
        "argv",
        ["sync_version_meta.py", "--readme-only", "--metadata", str(metadata)],
    )
    MODULE.main()
    assert "reviewed-command" in readme.read_text(encoding="utf-8")
    assert website_data.read_text(encoding="utf-8") == "unchanged"
