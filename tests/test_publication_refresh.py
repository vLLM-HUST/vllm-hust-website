"""Publication automation must preserve CI and fixed-source boundaries."""

from pathlib import Path
import runpy

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def helper(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / "scripts"))
    return runpy.run_path(str(ROOT / "scripts/refresh_benchmark_publication.py"))


def checks(names, **updates):
    return {
        "check_runs": [
            {
                "id": index,
                "name": name,
                "app": {"slug": "github-actions"},
                "status": "completed",
                "conclusion": "success",
                **updates,
            }
            for index, name in enumerate(names, 1)
        ]
    }


def test_only_successful_merged_source_is_selected(helper):
    def read(path):
        if path.endswith("/main"):
            return {"sha": "a" * 40}
        if "/actions/runs?" in path:
            return {
                "workflow_runs": [
                    {"name": "CI", "status": "completed", "conclusion": "success"}
                ]
            }
        return checks(helper["SOURCE_CHECKS"])

    assert helper["reviewed_source"](read) == "a" * 40
    for update in (
        {"status": "in_progress", "conclusion": None},
        {"conclusion": "failure"},
        {"conclusion": "skipped"},
        {"app": {"slug": "other-app"}},
    ):
        assert not helper["checks_pass"](
            checks(helper["SOURCE_CHECKS"], **update), helper["SOURCE_CHECKS"]
        )
    assert not helper["checks_pass"](checks(["tests"]), helper["SOURCE_CHECKS"])


def test_lock_refresh_updates_every_existing_consumer_and_preserves_comments(
    helper, tmp_path
):
    pins = tmp_path / ".github/benchmark-publication.toml"
    pins.parent.mkdir(parents=True)
    pins.write_text((ROOT / ".github/benchmark-publication.toml").read_text())
    for name in helper["WORKFLOWS"]:
        target = tmp_path / ".github/workflows" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text((ROOT / ".github/workflows" / name).read_text())
    helper["advance"](tmp_path, "b" * 40)
    assert "# pragma: allowlist secret" in pins.read_text()
    for name in helper["WORKFLOWS"]:
        value = (tmp_path / ".github/workflows" / name).read_text()
        assert "b" * 40 in value
    before = pins.read_bytes()
    helper["advance"](tmp_path, "b" * 40)
    assert pins.read_bytes() == before


def test_merging_rejects_changed_pr_head_or_failed_current_checks(helper):
    def read(path):
        if "/pulls/" in path:
            return {"base": {"ref": "main"}, "head": {"sha": "c" * 40}}
        return checks(helper["WEBSITE_CHECKS"])

    helper["check_pr_head"](1, "c" * 40, read)
    with pytest.raises(ValueError):
        helper["check_pr_head"](1, "d" * 40, read)
    assert not helper["checks_pass"](
        checks(helper["WEBSITE_CHECKS"], conclusion="failure"), helper["WEBSITE_CHECKS"]
    )


def test_path_filtered_cpu_smoke_is_optional_but_queued_applicable_workflow_blocks(
    helper,
):
    def read(path):
        if path.endswith("/main"):
            return {"sha": "a" * 40}
        if "/actions/runs?" in path:
            return {
                "workflow_runs": [
                    {"name": "CI", "status": "completed", "conclusion": "success"},
                    {
                        "name": "Workload data CPU correctness smoke",
                        "status": "queued",
                        "conclusion": None,
                    },
                ]
            }
        return checks(helper["SOURCE_CHECKS"])

    assert helper["reviewed_source"](read) is None
