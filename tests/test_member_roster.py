import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_profiles() -> tuple[dict, dict]:
    roster = json.loads(
        (ROOT / "data" / "member_roster.json").read_text(encoding="utf-8")
    )
    snapshot = json.loads(
        (ROOT / "data" / "core_contributors.json").read_text(encoding="utf-8")
    )
    return roster, snapshot


def test_member_snapshot_is_generated_from_audited_roster() -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "sync_member_roster.py"), "--check"],
        cwd=ROOT,
        check=True,
    )


def test_current_roster_is_unique_and_advisor_mappings_are_current() -> None:
    roster, snapshot = load_profiles()
    profiles = snapshot["member_profiles"]
    current = [
        *profiles["core_members"],
        *profiles["participants"],
        *profiles["staff_members"],
        *profiles["external_contributors"],
    ]
    names = [item["display_name"] for item in current]
    logins = [
        item["github_login"].casefold() for item in current if item.get("github_login")
    ]
    assert len(names) == len(set(names))
    assert len(logins) == len(set(logins))

    by_name = {item["display_name"]: item for item in current}
    expected = {
        item["name_zh"]: (item.get("github_login"), item.get("advisor_zh"))
        for item in roster["members"]
        if item["status"] == "current"
    }
    for name, (login, advisor) in expected.items():
        assert by_name[name]["github_login"] == login
        assert by_name[name]["advisor"]["zh"] == (advisor or "")
        assert by_name[name]["is_current_member"] is True


def test_pending_github_identities_have_no_invented_login_or_link() -> None:
    roster, snapshot = load_profiles()
    profiles = snapshot["member_profiles"]
    all_profiles = [
        *profiles["core_members"],
        *profiles["participants"],
        *profiles["staff_members"],
        *profiles["external_contributors"],
        *profiles["former_members"],
    ]
    by_name = {item["display_name"]: item for item in all_profiles}
    pending = {
        item["name_zh"]
        for item in roster["members"]
        if item.get("github_status") == "pending"
    }
    assert pending == {"宋功轩"}
    for name in pending:
        assert by_name[name]["github_login"] is None
        assert by_name[name]["github_url"] is None
        assert by_name[name]["github_status"]["zh"] == "GitHub ID 待确认"


def test_confirmed_github_identities_are_mapped_without_duplicates() -> None:
    roster, snapshot = load_profiles()
    profiles = snapshot["member_profiles"]
    all_profiles = [
        *profiles["core_members"],
        *profiles["participants"],
        *profiles["staff_members"],
        *profiles["external_contributors"],
        *profiles["former_members"],
    ]
    expected = {
        "江勰东": "jxd1111",
        "陈湘": "mumu029",
        "李佳乐": "peter17-17",
        "任天宇": "Renty-0",
    }
    roster_by_name = {item["name_zh"]: item for item in roster["members"]}
    profiles_by_name = {item["display_name"]: item for item in all_profiles}

    for name, login in expected.items():
        assert roster_by_name[name]["github_login"] == login
        assert roster_by_name[name].get("github_status") != "pending"
        profile = profiles_by_name[name]
        assert profile["github_login"] == login
        assert profile["github_url"] == f"https://github.com/{login}"
        assert profile["person_id"] == f"github:{login.casefold()}"
        assert profile["github_status"]["zh"] == ""

    person_ids = [item["person_id"] for item in all_profiles]
    github_logins = [
        item["github_login"].casefold()
        for item in all_profiles
        if item.get("github_login")
    ]
    assert len(person_ids) == len(set(person_ids))
    assert len(github_logins) == len(set(github_logins))

    for scope_name in ("all_repos", "core_repos"):
        contributors = snapshot[scope_name]["contributors"]
        scope_person_ids = [item["person_id"] for item in contributors]
        assert len(scope_person_ids) == len(set(scope_person_ids))


def test_only_verified_teacher_github_logins_are_published() -> None:
    _, snapshot = load_profiles()
    advisors = {item["name_zh"]: item for item in snapshot["advisor_profiles"]}
    profiles = snapshot["member_profiles"]
    current_advisor_names = {
        item["advisor"]["zh"]
        for category in (
            "core_members",
            "participants",
            "staff_members",
            "external_contributors",
        )
        for item in profiles[category]
        if item["advisor"]["zh"]
    }
    assert set(advisors) == current_advisor_names
    assert {name: item["github_login"] for name, item in advisors.items()} == {
        "张书豪": "ShuhaoZhangTony",
        "刘海坤": None,
        "王庆刚": None,
        "项翔": "eglxiang",
        "姚鹏程": None,
        "赵进": None,
        "郑龙": None,
        "万瑶": None,
        "毛言粲": "yancanmao",
        "罗瑞坤": None,
        "黄禹": None,
        "王雄": None,
    }
    for name in ("罗瑞坤", "黄禹", "王雄"):
        assert advisors[name]["name_en"] == ""
        assert advisors[name]["github_url"] is None


def test_former_members_are_separate_and_rendered_as_history() -> None:
    _, snapshot = load_profiles()
    profiles = snapshot["member_profiles"]
    current_names = {
        item["display_name"]
        for category in (
            "core_members",
            "participants",
            "staff_members",
            "external_contributors",
        )
        for item in profiles[category]
    }
    former = {item["display_name"]: item for item in profiles["former_members"]}
    assert set(former) == {"李林浩", "宋功轩", "余天成"}
    assert current_names.isdisjoint(former)
    page = (ROOT / "contributors.html").read_text(encoding="utf-8")
    script = (ROOT / "assets" / "contributors-page.js").read_text(encoding="utf-8")
    assert 'id="contributors-former-list"' in page
    assert "profiles.former_members" in script
