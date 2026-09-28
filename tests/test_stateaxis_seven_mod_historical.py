from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RECORD = json.loads(
    (ROOT / "data/stateaxis-seven-mod-historical.json").read_text(encoding="utf-8")
)
FOLLOWUP = json.loads(
    (ROOT / "data/stateaxis-qwen35-agentx-followup.json").read_text(encoding="utf-8")
)


EXPECTED = {
    "stateaxis.state-feedback-plane": -1.06,
    "stateaxis.ascend-state-action": 3.55,
    "stateaxis.hybrid-branch-coherence": 1.41,
    "stateaxis.no-harm-preparation": 2.20,
    "stateaxis.dependency-invalidation": 1.00,
    "stateaxis.workflow-state-scheduling": 1.94,
    "stateaxis.hybrid-hibernation": 8.20,
}

SOURCE_REVISIONS = {
    "stateaxis.ascend-state-action": "ac7c616bba4fc6645ab82b35d8366337cd9186ef",
    "stateaxis.dependency-invalidation": "deac2a05c279e02ce72c52d0c6bcda1d86cada99",
    "stateaxis.hybrid-branch-coherence": "65bc4fa60f739919aada1d615221d8d1a53ceb46",
    "stateaxis.hybrid-hibernation": "bb9cf7c29b6a95496a9189e396b66845825fdf1e",
    "stateaxis.no-harm-preparation": "4e73bb547270abb2b76ed8ce3dd27cdfea21e3ef",
    "stateaxis.state-feedback-plane": "199e739cefd246541f8e995e45650d0034d1dc18",
    "stateaxis.workflow-state-scheduling": "af6f70364969088f0d3e5e572f0dc5eeea5b0588",
}


def test_historical_record_preserves_seven_exact_identities() -> None:
    actual = {
        row["mod_id"]: row["change_from_control_percent"] for row in RECORD["results"]
    }
    assert actual == EXPECTED
    assert all("current_repository" not in row for row in RECORD["results"])
    assert "private source" not in json.dumps(RECORD)


def test_historical_result_cannot_be_presented_as_qwen35_agentx() -> None:
    assert RECORD["scope"]["model"] == "Qwen3.8-27B"
    assert RECORD["scope"]["dataset"] is None
    assert RECORD["scope"]["agentx_attribution"] == "not-recorded-do-not-infer"
    assert RECORD["qwen35_agentx_followup"]["status"] == "measured-single-run-smoke"
    assert FOLLOWUP["performance_qualified"] is False


def test_split_repositories_inherit_no_qualification() -> None:
    assert RECORD["performance_qualified"] is False
    assert RECORD["qualification_inherited_by_split_repositories"] is False
    assert RECORD["scope"]["repetitions"] == 1


def test_public_projection_retains_raw_archive_boundary() -> None:
    provenance = RECORD["provenance"]
    assert len(provenance["performance_summary_sha256"]) == 64
    assert len(provenance["all_sha256s_sha256"]) == 64
    assert provenance["raw_archive_publicly_downloadable"] is False


def test_followup_preserves_nine_valid_runs_without_qualification() -> None:
    assert FOLLOWUP["performance_result"] is True
    assert FOLLOWUP["server_started"] is True
    assert FOLLOWUP["accelerator_work_submitted"] is True
    assert FOLLOWUP["performance_qualified"] is False
    assert len(FOLLOWUP["controls"]) == 2
    assert len(FOLLOWUP["results"]) == 7
    assert len(FOLLOWUP["raw_archive_sha256"]) == 64
    assert {row["mod_id"] for row in FOLLOWUP["results"]} == set(EXPECTED)
    assert {
        row["mod_id"]: row["source_revision"] for row in FOLLOWUP["results"]
    } == SOURCE_REVISIONS
    for row in [*FOLLOWUP["controls"], *FOLLOWUP["results"]]:
        assert row["submission_valid"] is True
        assert row["errors"] == 0
        assert row["osl_mismatches"] == 0
        assert row["devices_released"] is True
        assert len(row["export_sha256"]) == 64
    feedback = next(
        row for row in FOLLOWUP["results"]
        if row["mod_id"] == "stateaxis.state-feedback-plane"
    )
    assert feedback["effect_status"] == "exercised-with-drops"
    assert feedback["effects"] == {
        "events_emitted": 256,
        "events_dropped": 3266,
        "events_flushed": 0,
    }
    assert all("repository" not in row for row in FOLLOWUP["results"])
    assert "private source" not in json.dumps(FOLLOWUP)


def test_frontier_page_renders_the_seven_mod_audit() -> None:
    script = (ROOT / "assets/leaderboard-frontier.js").read_text(encoding="utf-8")
    page = (ROOT / "leaderboard-runs.html").read_text(encoding="utf-8")
    assert "frontier-stateaxis" in script
    assert "data-stateaxis-mod" in script
    assert "stateaxis-seven-mod-historical.json" in script
    assert "stateaxis-qwen35-agentx-followup.json" in script
    assert "stateaxis-seven-mod-20260928" in page
    assert "github.com/${escape(row.current_repository)}" not in script
