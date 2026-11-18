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


def test_scheduled_writers_only_propose_readme_changes_in_website():
    import yaml

    assert not (ROOT / ".github/workflows/site-status-check.yml").exists()
    workflow = yaml.load(
        (ROOT / ".github/workflows/sync-version-meta.yml").read_text(),
        Loader=yaml.BaseLoader,
    )
    assert workflow["permissions"] == {"contents": "read"}
    steps = workflow["jobs"]["sync-version-meta"]["steps"]
    proposal = next(
        step
        for step in steps
        if step.get("uses", "").startswith("peter-evans/create-pull-request@")
    )
    assert proposal["with"]["add-paths"] == "README.md"
    commands = "\n".join(step.get("run", "") for step in steps)
    assert "--readme-only" in commands
    assert "git push" not in commands


def test_snapshot_preview_is_separate_from_frozen_website_data():
    import yaml

    workflow = yaml.load(
        (ROOT / ".github/workflows/sync-leaderboard-data.yml").read_text(),
        Loader=yaml.BaseLoader,
    )
    steps = workflow["jobs"]["sync"]["steps"]
    commands = "\n".join(step.get("run", "") for step in steps)
    # The immutable-target guard remains available for explicit migration reviews.
    assert (ROOT / "scripts/refresh_leadership_target_pin.py").is_file()
    assert "refresh_leadership_target_pin.py" not in commands
    assert commands.count("--target-dir output/leaderboard-preview/data") == 2
    upload = next(
        step
        for step in steps
        if step.get("uses", "").startswith("actions/upload-artifact@")
    )
    assert upload["with"]["path"] == "output/leaderboard-preview/"
