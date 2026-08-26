"""Apply the audited website roster to the contributor snapshot."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROSTER_PATH = ROOT / "data" / "member_roster.json"
SNAPSHOT_PATH = ROOT / "data" / "core_contributors.json"


def localized(zh: str | None, en: str | None = None) -> dict[str, str]:
    return {"zh": zh or "", "en": en or ""}


def profile_name(item: dict) -> str:
    return str(item.get("chinese_name") or item.get("display_name") or "").strip()


def new_profile(member: dict, advisor_en: dict[str, str]) -> dict:
    login = member.get("github_login")
    name = member["name_zh"]
    pending = member.get("github_status") == "pending"
    return {
        "name": name,
        "github_login": login,
        "github_url": f"https://github.com/{login}" if login else None,
        "commits": 0,
        "changed_lines": 0,
        "added": 0,
        "deleted": 0,
        "active_repos": 0,
        "repos": [],
        "key_contributions": "",
        "display_name": name,
        "chinese_name": name,
        "english_name": "",
        "person_id": f"github:{login.casefold()}" if login else f"profile:{name}",
        "identity_confirmed": True,
        "external_contributor": False,
        "staff_member": False,
        "core_repository_contributor": False,
        "core_member": False,
        "role": localized("学生", "Student"),
        "research_direction": localized("", ""),
        "participation_direction": localized("", ""),
        "advisor": localized(
            member.get("advisor_zh"), advisor_en.get(member.get("advisor_zh") or "")
        ),
        "github_status": localized(
            "GitHub ID 待确认" if pending else "",
            "GitHub ID pending confirmation" if pending else "",
        ),
        "contribution_areas": "",
    }


def apply_member(item: dict, member: dict, advisor_en: dict[str, str]) -> dict:
    updated = copy.deepcopy(item)
    login = member.get("github_login")
    pending = member.get("github_status") == "pending"
    updated.update(
        {
            "github_login": login,
            "github_url": f"https://github.com/{login}" if login else None,
            "person_id": f"github:{login.casefold()}"
            if login
            else f"profile:{member['name_zh']}",
            "advisor": localized(
                member.get("advisor_zh"),
                advisor_en.get(member.get("advisor_zh") or ""),
            ),
            "is_current_member": member["status"] == "current",
            "current_status": member["status"],
        }
    )
    if member.get("github_status_zh") or member.get("github_status_en"):
        updated["github_status"] = localized(
            member.get("github_status_zh"), member.get("github_status_en")
        )
    elif pending:
        updated["github_status"] = localized(
            "GitHub ID 待确认", "GitHub ID pending confirmation"
        )
    if member["status"] == "former":
        updated["former_member"] = True
        updated["role"] = localized("历史成员", "Former member")
        updated["profile_status"] = localized(
            member["status_reason_zh"], member["status_reason_en"]
        )
    else:
        updated.pop("former_member", None)
        updated.pop("profile_status", None)
    return updated


def dedupe(items: list[dict]) -> list[dict]:
    seen_names: set[str] = set()
    seen_logins: set[str] = set()
    result = []
    for item in items:
        name = profile_name(item)
        login = str(item.get("github_login") or "").casefold()
        if name and name in seen_names:
            continue
        if login and login in seen_logins:
            continue
        if name:
            seen_names.add(name)
        if login:
            seen_logins.add(login)
        result.append(item)
    return result


def build_snapshot(snapshot: dict, roster: dict) -> dict:
    result = copy.deepcopy(snapshot)
    result["updated_at"] = roster["updated_at"]
    result["advisor_profiles"] = [
        {
            **advisor,
            "github_url": (
                f"https://github.com/{advisor['github_login']}"
                if advisor.get("github_login")
                else None
            ),
        }
        for advisor in roster["advisors"]
    ]
    result["roster_source"] = "data/member_roster.json"
    advisor_en = {item["name_zh"]: item["name_en"] for item in roster["advisors"]}
    members = {item["name_zh"]: item for item in roster["members"]}
    profiles = result["member_profiles"]
    category_names = (
        "core_members",
        "participants",
        "staff_members",
        "external_contributors",
    )

    current_by_name: dict[str, tuple[str, dict]] = {}
    former_by_name: dict[str, dict] = {}
    for item in profiles.get("former_members", []):
        name = profile_name(item)
        override = members.get(name)
        if override and override["status"] == "former":
            former_by_name[name] = apply_member(item, override, advisor_en)
    for category in category_names:
        for item in profiles.get(category, []):
            name = profile_name(item)
            override = members.get(name)
            if override:
                item = apply_member(item, override, advisor_en)
                if override["status"] == "former":
                    former_by_name[name] = item
                    continue
            current_by_name[name] = (category, item)

    for name, member in members.items():
        if name in current_by_name or name in former_by_name:
            continue
        item = apply_member(new_profile(member, advisor_en), member, advisor_en)
        if member["status"] == "former":
            former_by_name[name] = item
        else:
            current_by_name[name] = ("participants", item)

    for category in category_names:
        profiles[category] = dedupe(
            [
                item
                for item_category, item in current_by_name.values()
                if item_category == category
            ]
        )
    profiles["former_members"] = dedupe(
        [
            former_by_name[item["name_zh"]]
            for item in roster["members"]
            if item["status"] == "former"
        ]
    )

    for scope_name in ("all_repos", "core_repos"):
        scope = result.get(scope_name, {})
        rewritten = []
        for item in scope.get("contributors", []):
            override = members.get(profile_name(item))
            rewritten.append(
                apply_member(item, override, advisor_en) if override else item
            )
        scope["contributors"] = dedupe(rewritten)
        for rank, item in enumerate(scope["contributors"], start=1):
            item["rank"] = rank

    return result


def validate_roster(roster: dict) -> None:
    members = roster["members"]
    names = [item["name_zh"] for item in members]
    logins = [
        item["github_login"].casefold() for item in members if item.get("github_login")
    ]
    assert len(names) == len(set(names)), "duplicate member name in roster"
    assert len(logins) == len(set(logins)), "duplicate GitHub login in roster"
    advisors = {item["name_zh"] for item in roster["advisors"]}
    assert all(
        not item.get("advisor_zh") or item["advisor_zh"] in advisors for item in members
    )
    assert all(
        item.get("github_login") is None
        for item in members
        if item.get("github_status") == "pending"
    ), "pending GitHub identities must not carry a login"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    roster = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    validate_roster(roster)
    rendered = (
        json.dumps(build_snapshot(snapshot, roster), ensure_ascii=False, indent=2)
        + "\n"
    )
    if args.check:
        if SNAPSHOT_PATH.read_text(encoding="utf-8") != rendered:
            raise SystemExit(
                "data/core_contributors.json is not synchronized with data/member_roster.json"
            )
        return
    SNAPSHOT_PATH.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    main()
