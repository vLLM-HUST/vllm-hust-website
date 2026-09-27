import copy
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def refresh(*args):
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        module = runpy.run_path(str(ROOT / "scripts/refresh_contributor_snapshot.py"))
        return module["refresh_snapshot"](*args)
    finally:
        sys.path.pop(0)


def sample():
    person = {
        "name": "example",
        "display_name": "Example",
        "chinese_name": "Example",
        "github_login": "example",
        "person_id": "github:example",
        "commits": 1,
        "changed_lines": 4,
        "added": 3,
        "deleted": 1,
        "active_repos": 1,
        "repos": ["docs"],
        "identity_confirmed": True,
        "role": {"zh": "学生", "en": "Student"},
        "research_direction": {"zh": "已核实方向", "en": "Reviewed interest"},
        "advisor": {"zh": "导师", "en": "Advisor"},
        "external_advisor": {"zh": "", "en": ""},
    }
    previous = {
        "updated_at": "2026-01-01",
        "all_repos": {"scope_repos": ["docs"], "contributors": [person]},
        "core_repos": {"scope_repos": ["runtime"], "contributors": []},
        "member_profiles": {
            "core_members": [],
            "participants": [person],
            "staff_members": [],
            "external_contributors": [],
        },
    }
    roster = {
        "updated_at": "2026-02-01",
        "advisors": [{"name_zh": "导师", "name_en": "Advisor", "github_login": None}],
        "members": [
            {
                "name_zh": "Example",
                "github_login": "example",
                "advisor_zh": "导师",
                "status": "current",
            }
        ],
    }
    fresh = copy.deepcopy(person)
    fresh.update(
        {
            "commits": 9,
            "added": 80,
            "deleted": 20,
            "changed_lines": 100,
            "repos": ["runtime"],
            "rank": 1,
            "research_direction": {"zh": "旧信息", "en": "Stale interest"},
        }
    )
    collected = {
        "updated_at": "2026-03-01",
        "all_repos": {"scope_repos": ["runtime", "docs"], "contributors": [fresh]},
        "core_repos": {"scope_repos": ["runtime"], "contributors": [fresh]},
        "member_profiles": {
            "core_members": [fresh],
            "participants": [],
            "staff_members": [],
            "external_contributors": [],
        },
    }
    sources = {"collected_at": "2026-03-01T00:00:00+00:00", "repositories": []}
    return previous, collected, roster, sources


def test_refresh_updates_stats_and_category_without_overwriting_reviewed_profile():
    result = refresh(*sample())
    person = result["member_profiles"]["core_members"][0]
    assert person["commits"] == 9
    assert person["added"] + person["deleted"] == person["changed_lines"] == 100
    assert person["research_direction"]["zh"] == "已核实方向"
    assert person["advisor"]["zh"] == "导师"
    assert person["is_current_member"] is True
    assert result["member_profiles"]["participants"] == []
    _, collected, roster, sources = sample()
    assert refresh(result, collected, roster, sources) == result
    assert result["contributions_updated_at"] == result["updated_at"] == "2026-03-01"
    assert result["contribution_collection"]["collected_at"].startswith("2026-03-01")


def test_unknown_authors_do_not_become_members_and_old_stats_are_cleared():
    previous, collected, roster, sources = sample()
    unknown = copy.deepcopy(collected["all_repos"]["contributors"][0])
    unknown.update(
        {
            "name": "Unverified",
            "display_name": "Unverified",
            "chinese_name": "",
            "github_login": None,
            "person_id": "author:unverified",
            "identity_confirmed": False,
        }
    )
    for scope in ("all_repos", "core_repos"):
        collected[scope]["contributors"] = [unknown]
    collected["member_profiles"]["core_members"] = [unknown]
    result = refresh(previous, collected, roster, sources)
    assert result["member_profiles"]["core_members"] == []
    retained = result["member_profiles"]["participants"][0]
    assert retained["display_name"] == "Example"
    assert retained["commits"] == retained["changed_lines"] == 0
    assert retained["repos"] == []
    assert len(result["member_profiles"]["unresolved_contributors"]) == 1
    assert result["all_repos"]["contributors"][0]["core_member"] is False
