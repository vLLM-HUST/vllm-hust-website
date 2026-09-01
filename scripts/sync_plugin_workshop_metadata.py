#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = ROOT / "data" / "ecosystem.json"
DEFAULT_IDENTITIES = ROOT / "data" / "core_contributors.json"
DEFAULT_OUTPUT = ROOT / "data" / "plugin-workshop-metadata.json"
GITHUB_API = "https://api.github.com"
WORKSHOP_DELIVERY_MODELS = {
    "plugin_bundle",
    "python_distribution",
    "migration_scaffold",
}
MAINTAINER_FILES = (
    "MAINTAINERS.md",
    ".github/MAINTAINERS.md",
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "docs/CODEOWNERS",
)


class GitHubClient:
    def __init__(self, token: str | None = None) -> None:
        self.token = token
        self.user_cache: dict[str, dict[str, Any]] = {}

    def _request(self, path: str, *, accept: str) -> urllib.request.Request:
        headers = {
            "Accept": accept,
            "User-Agent": "vllm-hust-plugin-workshop-sync/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return urllib.request.Request(f"{GITHUB_API}{path}", headers=headers)

    @staticmethod
    def _read(request: urllib.request.Request) -> tuple[bytes, Any]:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    return response.read(), response.headers
            except urllib.error.HTTPError as error:
                if error.code < 500:
                    raise
                last_error = error
            except urllib.error.URLError as error:
                last_error = error
            if attempt < 2:
                time.sleep(2**attempt)
        assert last_error is not None
        raise last_error

    def get_json(self, path: str) -> tuple[Any, Any]:
        request = self._request(path, accept="application/vnd.github+json")
        try:
            body, headers = self._read(request)
            return json.loads(body.decode("utf-8")), headers
        except urllib.error.HTTPError as error:
            raise RuntimeError(
                f"GitHub API {path} returned HTTP {error.code}"
            ) from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"GitHub API {path} is unavailable: {error}") from error

    def get_text_if_present(self, path: str) -> str | None:
        request = self._request(path, accept="application/vnd.github.raw+json")
        try:
            body, _ = self._read(request)
            return body.decode("utf-8")
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            raise RuntimeError(
                f"GitHub API {path} returned HTTP {error.code}"
            ) from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"GitHub API {path} is unavailable: {error}") from error

    def user(self, login: str) -> dict[str, Any]:
        key = login.casefold()
        if key not in self.user_cache:
            payload, _ = self.get_json(f"/users/{urllib.parse.quote(login)}")
            if not isinstance(payload, dict):
                raise RuntimeError(f"GitHub user payload for {login} is invalid")
            self.user_cache[key] = payload
        return self.user_cache[key]


def is_workshop_mod(item: dict[str, Any]) -> bool:
    repository = str(item.get("canonical_repository") or "")
    return (
        item.get("artifact_type") == "runtime_component"
        and item.get("repository_relationship") == "organization_native"
        and item.get("public_surface", True) is not False
        and item.get("delivery_model") in WORKSHOP_DELIVERY_MODELS
        and repository.startswith("https://github.com/vLLM-HUST/")
    )


def repository_slug(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    parts = [part for part in parsed.path.split("/") if part]
    if parsed.netloc.casefold() != "github.com" or len(parts) < 2:
        raise ValueError(f"Unsupported canonical repository URL: {url}")
    return "/".join(parts[:2])


def extract_github_handles(text: str) -> list[str]:
    handles: list[str] = []
    seen: set[str] = set()
    for token in re.findall(
        r"(?<!\w)@[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:/[A-Za-z0-9_.-]+)?", text
    ):
        if "/" in token:
            continue
        login = token[1:]
        key = login.casefold()
        if key not in seen:
            seen.add(key)
            handles.append(login)
    return handles


def _is_human_login(login: str) -> bool:
    normalized = login.casefold()
    return not (
        normalized.endswith("[bot]")
        or normalized in {"codex", "github-actions", "dependabot"}
    )


def maintainer_handles(
    client: GitHubClient, slug: str, default_branch: str
) -> tuple[list[str], str]:
    owner, repository = slug.split("/", 1)
    tree, _ = client.get_json(
        f"/repos/{owner}/{repository}/git/trees/{urllib.parse.quote(default_branch)}?recursive=1"
    )
    entries = tree.get("tree") if isinstance(tree, dict) else None
    if not isinstance(entries, list):
        raise TypeError(f"Repository tree payload for {slug} is invalid")
    repository_paths = {
        str(entry.get("path")) for entry in entries if isinstance(entry, dict)
    }
    for path in (
        candidate for candidate in MAINTAINER_FILES if candidate in repository_paths
    ):
        encoded_path = "/".join(urllib.parse.quote(part) for part in path.split("/"))
        content = client.get_text_if_present(
            f"/repos/{owner}/{repository}/contents/{encoded_path}"
        )
        if content is None:
            continue
        handles = [
            login for login in extract_github_handles(content) if _is_human_login(login)
        ]
        if handles:
            return handles, path

    if "README.md" in repository_paths:
        readme = client.get_text_if_present(
            f"/repos/{owner}/{repository}/contents/README.md"
        )
        if readme:
            ownership_lines = [
                line
                for line in readme.splitlines()
                if re.search(r"负责人|maintainers?\s*[:：]", line, flags=re.IGNORECASE)
            ]
            handles = [
                login
                for login in extract_github_handles("\n".join(ownership_lines))
                if _is_human_login(login)
            ]
            if handles:
                return handles, "README.md#maintainers"

    raise RuntimeError(
        f"No explicit maintainer declaration was found for {slug}; "
        "declare component.maintainers in ecosystem.json or add a repository "
        "MAINTAINERS/CODEOWNERS file"
    )


def open_pull_request_count(client: GitHubClient, slug: str) -> int:
    payload, headers = client.get_json(f"/repos/{slug}/pulls?state=open&per_page=1")
    if not isinstance(payload, list):
        raise TypeError(f"Pull request payload for {slug} is invalid")
    link = str(headers.get("Link") or "")
    match = re.search(r"[?&]page=(\d+)>; rel=\"last\"", link)
    if match:
        return int(match.group(1))
    return len(payload)


def verified_identity_names(payload: Any) -> dict[str, str]:
    identities: dict[str, str] = {}

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                visit(item)
            return
        if not isinstance(value, dict):
            return
        login = value.get("github_login")
        confirmed = value.get("identity_confirmed")
        display_name = value.get("display_name") or value.get("chinese_name")
        if (
            isinstance(login, str)
            and login.strip()
            and confirmed is True
            and isinstance(display_name, str)
            and display_name.strip()
            and display_name.casefold() != login.casefold()
        ):
            identities.setdefault(login.casefold(), display_name.strip())
        for child in value.values():
            visit(child)

    visit(payload)
    return identities


def verified_identity_advisors(payload: Any) -> dict[str, list[dict[str, str]]]:
    advisors: dict[str, list[dict[str, str]]] = {}

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                visit(item)
            return
        if not isinstance(value, dict):
            return
        login = value.get("github_login")
        advisor = value.get("advisor")
        if (
            isinstance(login, str)
            and login.strip()
            and value.get("identity_confirmed") is True
            and isinstance(advisor, dict)
        ):
            name_zh = str(advisor.get("zh") or "").strip()
            name_en = str(advisor.get("en") or "").strip()
            if name_zh or name_en:
                record = {"name_zh": name_zh, "name_en": name_en or name_zh}
                bucket = advisors.setdefault(login.casefold(), [])
                if record not in bucket:
                    bucket.append(record)
        for child in value.values():
            visit(child)

    visit(payload)
    return advisors


def plugin_advisors(
    handles: list[str], identity_advisors: dict[str, list[dict[str, str]]]
) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for login in handles:
        for advisor in identity_advisors.get(login.casefold(), []):
            if advisor not in result:
                result.append(advisor)
    return result


def maintainer_profile(
    client: GitHubClient, login: str, identities: dict[str, str]
) -> dict[str, str]:
    payload = client.user(login)
    name = payload.get("name")
    verified_name = identities.get(login.casefold())
    return {
        "login": login,
        "name": verified_name
        or (str(name).strip() if isinstance(name, str) and name.strip() else login),
        "profile_url": str(payload.get("html_url") or f"https://github.com/{login}"),
        "avatar_url": str(payload.get("avatar_url") or ""),
    }


def build_snapshot(
    registry: dict[str, Any],
    client: GitHubClient,
    *,
    identities: dict[str, str] | None = None,
    identity_advisors: dict[str, list[dict[str, str]]] | None = None,
    generated_at: str | None = None,
) -> dict[str, Any]:
    components = registry.get("components")
    if not isinstance(components, list):
        raise TypeError("ecosystem registry is missing a components array")

    plugins: dict[str, Any] = {}
    identity_names = identities or {}
    advisor_names = identity_advisors or {}
    repository_cache: dict[str, dict[str, Any]] = {}
    for item in components:
        if not isinstance(item, dict) or not is_workshop_mod(item):
            continue
        plugin_id = str(item["id"])
        slug = repository_slug(str(item["canonical_repository"]))
        if slug not in repository_cache:
            repository_payload, _ = client.get_json(f"/repos/{slug}")
            if not isinstance(repository_payload, dict):
                raise RuntimeError(f"Repository payload for {slug} is invalid")
            repository_cache[slug] = {
                "repository": slug,
                "repository_url": str(
                    repository_payload.get("html_url") or f"https://github.com/{slug}"
                ),
                "metrics": {
                    "stars": int(repository_payload.get("stargazers_count") or 0),
                    "forks": int(repository_payload.get("forks_count") or 0),
                    "open_pull_requests": open_pull_request_count(client, slug),
                },
            }
        declared_handles = item.get("maintainers")
        if isinstance(declared_handles, list) and declared_handles:
            handles = [str(login) for login in declared_handles]
            source = "ecosystem.json#component.maintainers"
        else:
            raw_repository, _ = client.get_json(f"/repos/{slug}")
            default_branch = str(raw_repository.get("default_branch") or "main")
            handles, source = maintainer_handles(client, slug, default_branch)
        plugins[plugin_id] = {
            **repository_cache[slug],
            "maintainers": [
                maintainer_profile(client, login, identity_names) for login in handles
            ],
            "advisors": plugin_advisors(handles, advisor_names),
            "maintainer_source": source,
        }

    if not plugins:
        raise RuntimeError("No Workshop MODs were found in the ecosystem registry")
    return {
        "schema_version": "plugin-workshop-metadata/v1",
        "generated_at": generated_at
        or datetime.now(UTC).replace(microsecond=0).isoformat(),
        "source": "GitHub API + canonical ownership and verified identity data",
        "plugins": plugins,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync maintainers and GitHub metrics for the Extension Workshop"
    )
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--identities", type=Path, default=DEFAULT_IDENTITIES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    identity_payload = json.loads(args.identities.read_text(encoding="utf-8"))
    identities = verified_identity_names(identity_payload)
    advisors = verified_identity_advisors(identity_payload)
    client = GitHubClient(os.environ.get("GITHUB_TOKEN"))
    snapshot = build_snapshot(
        registry, client, identities=identities, identity_advisors=advisors
    )
    if args.output.exists():
        existing = json.loads(args.output.read_text(encoding="utf-8"))
        if (
            existing.get("schema_version") == snapshot["schema_version"]
            and existing.get("source") == snapshot["source"]
            and existing.get("plugins") == snapshot["plugins"]
        ):
            snapshot["generated_at"] = existing.get(
                "generated_at", snapshot["generated_at"]
            )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Synced {len(snapshot['plugins'])} Workshop MODs to {args.output}")


if __name__ == "__main__":
    main()
