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

    assert "mynameisczj" not in logins


def test_pending_github_identities_have_no_invented_login_or_link() -> None:
    roster, snapshot = load_profiles()
    profiles = snapshot["member_profiles"]
    all_profiles = [
        *profiles["core_members"],
        *profiles["participants"],
        *profiles["staff_members"],
        *profiles["external_contributors"],
    ]
    by_name = {item["display_name"]: item for item in all_profiles}
    pending = {
        item["name_zh"]
        for item in roster["members"]
        if item.get("github_status") == "pending"
    }
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


def test_confirmed_mod_owners_are_visible_with_internal_advisors() -> None:
    roster, snapshot = load_profiles()
    expected = {
        "李上上": ("ilnnfover", "郑龙"),
        "雷翔麟": ("llxler", "万瑶"),
        "张家万": ("Jiawan23", "万瑶"),
        "郁硕": ("Yushuo-star", "王雄"),
        "毛潮云": ("Irisuko", "罗瑞坤"),
    }
    roster_by_name = {item["name_zh"]: item for item in roster["members"]}
    profiles = snapshot["member_profiles"]
    visible = [
        *profiles["core_members"],
        *profiles["participants"],
        *profiles["staff_members"],
    ]
    profiles_by_name = {item["display_name"]: item for item in visible}
    for name, (login, advisor) in expected.items():
        assert roster_by_name[name]["github_login"] == login
        assert roster_by_name[name]["advisor_zh"] == advisor
        assert profiles_by_name[name]["github_login"] == login
        assert profiles_by_name[name]["advisor"]["zh"] == advisor


def test_pipeline_external_contributor_keeps_external_guidance_separate() -> None:
    _, snapshot = load_profiles()
    external = {
        item["github_login"]: item
        for item in snapshot["member_profiles"]["external_contributors"]
    }["xsun2001"]
    assert external["display_name"] == "徐晨曦"
    assert external["external_contributor"] is True
    assert external["advisor"] == {"zh": "", "en": ""}
    assert external["external_advisor"] == {
        "zh": "Chen Xinyu · 香港科技大学（广州）",
        "en": "Chen Xinyu · HKUST (Guangzhou)",
    }
    assert external["role"] == {
        "zh": "外部贡献者（港科大（广州））",
        "en": "External contributor (HKUST(GZ))",
    }


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


def test_former_members_are_absent_from_public_data_and_page() -> None:
    roster, snapshot = load_profiles()
    assert "former_members" not in snapshot["member_profiles"]
    assert all(item["status"] == "current" for item in roster["members"])
    for path in (ROOT / "data").rglob("*.json"):
        text = path.read_text(encoding="utf-8")
        for removed in (
            "李林浩",
            "宋功轩",
            "余天成",
            "Sunshine-llh",
            "yutiantian0115",
            "考核淘汰",
            "已请离",
            "已退出",
        ):
            assert removed not in text, path
    page = (ROOT / "contributors.html").read_text(encoding="utf-8")
    script = (ROOT / "assets" / "contributors-page.js").read_text(encoding="utf-8")
    assert "contributors-former-list" not in page
    assert "contributors-profile-former" not in page
    assert "profiles.former_members" not in script


def test_sync_discards_legacy_former_profiles_and_rejects_private_roster() -> None:
    import copy
    import runpy
    import pytest

    sync = runpy.run_path(str(ROOT / "scripts" / "sync_member_roster.py"))
    roster, snapshot = load_profiles()
    legacy = {
        "display_name": "Removed example",
        "former_member": True,
        "current_status": "former",
        "profile_status": {"zh": "Private reason"},
    }
    snapshot["member_profiles"]["former_members"] = [legacy]
    snapshot["member_profiles"]["participants"].append(legacy)
    snapshot["all_repos"]["contributors"].append(legacy)
    snapshot["core_repos"]["contributors"].append(legacy)
    result = sync["build_snapshot"](snapshot, roster)
    assert "Removed example" not in json.dumps(result)
    assert "former_members" not in result["member_profiles"]
    private_roster = copy.deepcopy(roster)
    private_roster["members"][0]["status"] = "former"
    with pytest.raises(AssertionError, match="only current members"):
        sync["build_snapshot"](snapshot, private_roster)
    private_roster["members"][0]["status"] = "current"
    private_roster["members"][0]["status_reason_zh"] = "Private reason"
    with pytest.raises(AssertionError, match="departure reasons"):
        sync["build_snapshot"](snapshot, private_roster)


def test_betterscale_author_is_a_core_runtime_contributor() -> None:
    _, snapshot = load_profiles()
    assert "BetterScale" in snapshot["core_repos"]["scope_repos"]
    for scope in (
        snapshot["core_repos"]["contributors"],
        snapshot["member_profiles"]["core_members"],
    ):
        member = next(
            item for item in scope if item.get("github_login") == "CubeLander"
        )
        assert member["display_name"] == "田景远"
        assert member["core_member"] is True
        assert "BetterScale" in member["repos"]
    assert not any(
        item.get("github_login") == "CubeLander"
        for item in snapshot["member_profiles"]["participants"]
    )
