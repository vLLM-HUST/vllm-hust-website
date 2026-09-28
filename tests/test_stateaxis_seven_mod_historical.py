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
    assert RECORD["qwen35_agentx_followup"]["status"] == "blocked-before-serving"


def test_split_repositories_inherit_no_qualification() -> None:
    assert RECORD["performance_qualified"] is False
    assert RECORD["qualification_inherited_by_split_repositories"] is False
    assert RECORD["scope"]["repetitions"] == 1


def test_public_projection_retains_raw_archive_boundary() -> None:
    provenance = RECORD["provenance"]
    assert len(provenance["performance_summary_sha256"]) == 64
    assert len(provenance["all_sha256s_sha256"]) == 64
    assert provenance["raw_archive_publicly_downloadable"] is False


def test_followup_stops_before_serving_when_identity_gates_fail() -> None:
    assert FOLLOWUP["performance_result"] is False
    assert FOLLOWUP["server_started"] is False
    assert FOLLOWUP["accelerator_work_submitted"] is False
    assert FOLLOWUP["preflight"]["hardware"]["running_npu_processes_at_check"] == 0
    assert FOLLOWUP["preflight"]["model"]["sha256_and_size_matches"] == 22
    assert FOLLOWUP["preflight"]["agentx"]["wrapper_tests"] == {
        "passed": 18,
        "failed": 0,
    }
    assert FOLLOWUP["preflight"]["agentx"]["dataset_prepared"] is False
    assert {item["gate"] for item in FOLLOWUP["blockers"]} == {
        "official-agentx-dataset",
        "runtime-image-identity",
    }


def test_frontier_page_renders_the_seven_mod_audit() -> None:
    script = (ROOT / "assets/leaderboard-frontier.js").read_text(encoding="utf-8")
    page = (ROOT / "leaderboard-runs.html").read_text(encoding="utf-8")
    assert "frontier-stateaxis" in script
    assert "data-stateaxis-mod" in script
    assert "stateaxis-seven-mod-historical.json" in script
    assert "stateaxis-qwen35-agentx-followup.json" in script
    assert "stateaxis-seven-mod-20260928" in page
    assert "github.com/${escape(row.current_repository)}" not in script
