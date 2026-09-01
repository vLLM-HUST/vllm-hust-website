import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_verified_member_snapshot_is_minimized_and_unique() -> None:
    payload = json.loads((ROOT / "data" / "members.json").read_text(encoding="utf-8"))
    members = payload["members"]

    assert payload["organization"] == "vLLM-HUST"
    assert payload["verified_at"] == "2026-09-01"
    assert payload["count"] == len(members) == 68
    assert len({member["login"].lower() for member in members}) == len(members)
    assert all(
        set(member) == {"login", "name", "avatar_url", "profile_url", "bio"}
        for member in members
    )
    assert all(
        member["profile_url"] == f"https://github.com/{member['login']}"
        for member in members
    )
    by_login = {member["login"]: member for member in members}
    assert {
        login: by_login[login]["name"]
        for login in ("ilnnfover", "Irisuko", "Jiawan23", "llxler", "Yushuo-star")
    } == {
        "ilnnfover": "李上上",
        "Irisuko": "毛潮云",
        "Jiawan23": "张家万",
        "llxler": "雷翔麟",
        "Yushuo-star": "郁硕",
    }


def test_members_are_separate_from_external_contributors() -> None:
    page = (ROOT / "members.html").read_text(encoding="utf-8")
    shell = (ROOT / "assets" / "site.js").read_text(encoding="utf-8")

    assert 'data-source="./data/members.json?v=roster-20260901"' in page
    assert "navMembers" in shell
    assert "['members', './members.html', 'navMembers']" in shell
    assert "['contributors', './contributors.html', 'navContributors']" in shell
