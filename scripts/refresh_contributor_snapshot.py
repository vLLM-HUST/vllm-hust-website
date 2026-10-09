"""Merge freshly collected Git statistics with the audited public profiles."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

from sync_member_roster import ROOT, build_snapshot, dedupe, profile_name

CATEGORIES = ("core_members", "participants", "staff_members", "external_contributors")
PROFILE_FIELDS = (
    "display_name",
    "chinese_name",
    "english_name",
    "github_login",
    "github_url",
    "person_id",
    "identity_confirmed",
    "external_contributor",
    "staff_member",
    "former_member",
    "role",
    "research_direction",
    "participation_direction",
    "advisor",
    "external_advisor",
    "github_status",
    "is_current_member",
    "current_status",
)


def identity(item: dict) -> str:
    login = str(item.get("github_login") or "").casefold()
    return f"github:{login}" if login else f"profile:{profile_name(item).casefold()}"


def refresh_snapshot(
    previous: dict, collected: dict, roster: dict, sources: dict
) -> dict:
    """Preserve reviewed personal metadata while replacing contribution statistics."""
    previous_profiles = previous["member_profiles"]
    reviewed = {
        identity(item): item
        for category in CATEGORIES
        for item in previous_profiles.get(category, [])
    }
    for scope in ("all_repos", "core_repos"):
        for item in previous[scope]["contributors"]:
            reviewed.setdefault(identity(item), item)

    def enrich(item: dict) -> dict:
        result = copy.deepcopy(item)
        old = reviewed.get(identity(item))
        if old:
            for field in PROFILE_FIELDS:
                if field in old:
                    result[field] = copy.deepcopy(old[field])
        return result

    result = copy.deepcopy(collected)
    for scope in ("all_repos", "core_repos"):
        result[scope]["contributors"] = dedupe(
            [enrich(item) for item in collected[scope]["contributors"]]
        )
    all_items = {identity(item): item for item in result["all_repos"]["contributors"]}
    core_items = {identity(item): item for item in result["core_repos"]["contributors"]}
    core_repos = set(result["core_repos"]["scope_repos"])
    for scope in ("all_repos", "core_repos"):
        for item in result[scope]["contributors"]:
            item["core_repository_contributor"] = bool(set(item["repos"]) & core_repos)
            item["core_member"] = (
                item["core_repository_contributor"]
                and item.get("identity_confirmed", False)
                and not item.get("staff_member")
                and not item.get("external_contributor")
                and not item.get("former_member")
            )

    # Only audited profiles or already confirmed collector identities become members.
    candidates = {
        identity(item): enrich(item)
        for category in CATEGORIES
        for item in collected["member_profiles"].get(category, [])
        if item.get("identity_confirmed")
    }
    for category in CATEGORIES:
        for item in previous_profiles.get(category, []):
            candidates[identity(item)] = copy.deepcopy(item)
    for key, item in all_items.items():
        if item.get("identity_confirmed") and not item.get("former_member"):
            candidates[key] = item

    profiles = {category: [] for category in CATEGORIES}
    profiles["core_repo_names"] = sorted(core_repos)
    for key, old in candidates.items():
        item = copy.deepcopy(core_items.get(key) or all_items.get(key) or old)
        if item.get("former_member") or item.get("current_status") == "former":
            continue
        if key not in all_items and key not in core_items:
            for field in (
                "commits",
                "changed_lines",
                "added",
                "deleted",
                "active_repos",
            ):
                item[field] = 0
            item["repos"] = []
            item["core_repository_contributor"] = False
            item["core_member"] = False
        if item.get("external_contributor"):
            category = "external_contributors"
        elif item.get("staff_member"):
            category = "staff_members"
        elif key in core_items:
            category = "core_members"
        else:
            category = "participants"
        profiles[category].append(item)
    for category in CATEGORIES:
        profiles[category] = dedupe(profiles[category])
        if category == "core_members":
            profiles[category].sort(key=lambda item: item.get("rank", 0))
            for rank, item in enumerate(profiles[category], start=1):
                item["rank"] = rank
        else:
            profiles[category].sort(key=lambda item: profile_name(item).casefold())
    profiles["unresolved_contributors"] = [
        item
        for item in all_items.values()
        if not item.get("identity_confirmed")
        and str(item.get("name") or "").casefold() != "vllm-hust developer"
    ]
    result["member_profiles"] = profiles
    result["contribution_collection"] = copy.deepcopy(sources)
    result["contributions_updated_at"] = collected["updated_at"]
    return build_snapshot(result, roster)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stats", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument(
        "--output", type=Path, default=ROOT / "data/core_contributors.json"
    )
    args = parser.parse_args()

    def read(path: Path) -> dict:
        return json.loads(path.read_text(encoding="utf-8"))

    payload = refresh_snapshot(
        read(ROOT / "data/core_contributors.json"),
        read(args.stats),
        read(ROOT / "data/member_roster.json"),
        read(args.sources),
    )
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
