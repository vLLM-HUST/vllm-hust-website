import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "data_policy", ROOT / "scripts/check_data_pr_policy.py"
)
POLICY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(POLICY)


def test_data_and_evidence_are_blocked_for_all_change_types():
    for prefix in POLICY.DATA_PREFIXES:
        for status in ("added", "modified", "removed"):
            path = prefix + "result.json"
            assert POLICY.prohibited_paths(
                [[{"filename": path, "status": status}]]
            ) == [path]


def test_renaming_data_out_of_the_directory_does_not_bypass_the_policy():
    assert POLICY.prohibited_paths(
        [[{"filename": "assets/results.js", "previous_filename": "data/results.json"}]]
    ) == ["data/results.json"]


def test_code_docs_and_synthetic_fixtures_are_allowed():
    assert not POLICY.prohibited_paths(
        [
            [
                {"filename": "assets/chart.js"},
                {"filename": "CONTRIBUTING.md"},
                {"filename": "tests/fixtures/parser.csv"},
            ]
        ]
    )
    assert POLICY.is_data_path("assets/results.csv")
    assert POLICY.is_data_path("data/Example.JSON")


def test_workflow_uses_trusted_base_code_and_read_only_permissions():
    workflow = (ROOT / ".github/workflows/data-pr-policy.yml").read_text()
    assert "pull_request_target:" in workflow
    assert "ref: ${{ github.event.pull_request.base.sha }}" in workflow
    assert "persist-credentials: false" in workflow
    assert "pull_request.head" not in workflow
    assert "contents: write" not in workflow
    assert "pull-requests: write" not in workflow


def test_sync_workflow_no_longer_creates_or_merges_website_data_prs():
    workflow = (ROOT / ".github/workflows/sync-leaderboard-data.yml").read_text()
    assert "create-pull-request@" not in workflow
    assert "gh pr merge" not in workflow
    assert "contents: write" not in workflow
    assert "actions/upload-artifact@" in workflow
