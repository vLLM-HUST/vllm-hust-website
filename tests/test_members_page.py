import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_verified_member_snapshot_is_minimized_and_unique() -> None:
    payload = json.loads((ROOT / "data" / "members.json").read_text(encoding="utf-8"))
    members = payload["members"]

    assert payload["organization"] == "vLLM-HUST"
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


def test_members_are_separate_from_external_contributors() -> None:
    page = (ROOT / "members.html").read_text(encoding="utf-8")
    shell = (ROOT / "assets" / "site.js").read_text(encoding="utf-8")

    assert 'data-source="./data/members.json"' in page
    assert "navMembers" in shell
    assert "['members', './members.html', 'navMembers']" in shell
    assert "['contributors', './contributors.html', 'navContributors']" in shell
