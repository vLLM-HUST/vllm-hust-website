from __future__ import annotations

import http.client
import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "sync_plugin_workshop_metadata.py"
SPEC = importlib.util.spec_from_file_location(
    "sync_plugin_workshop_metadata", SCRIPT_PATH
)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_github_client_retries_connection_resets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Response:
        headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return b'[{"ok": true}]'

    attempts = iter(
        [
            http.client.RemoteDisconnected("reset one"),
            http.client.RemoteDisconnected("reset two"),
            Response(),
        ]
    )

    def open_once(*_args, **_kwargs):
        result = next(attempts)
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(MODULE.urllib.request, "urlopen", open_once)
    monkeypatch.setattr(MODULE.time, "sleep", lambda _seconds: None)

    payload, _ = MODULE.GitHubClient().get_json("/test")
    assert payload == [{"ok": True}]


def test_extract_github_handles_ignores_teams_and_deduplicates() -> None:
    text = "Owners: @alice, @Bob and @alice; team @vLLM-HUST/runtime"
    assert MODULE.extract_github_handles(text) == ["alice", "Bob"]


def test_repository_slug_discards_subdirectory_paths() -> None:
    assert (
        MODULE.repository_slug(
            "https://github.com/vLLM-HUST/vllm-ascend-quant-hust/tree/main/runtime-extension"
        )
        == "vLLM-HUST/vllm-ascend-quant-hust"
    )


def test_workshop_filter_matches_public_catalog_people_cards() -> None:
    base = {
        "artifact_type": "runtime_component",
        "repository_relationship": "organization_native",
        "delivery_model": "plugin_bundle",
        "canonical_repository": "https://github.com/vLLM-HUST/example-mod",
        "maintainers": ["maintainer"],
    }
    assert MODULE.is_workshop_mod(base)
    assert MODULE.is_workshop_mod({**base, "artifact_type": "bridge"})
    assert MODULE.is_workshop_mod({**base, "artifact_type": "external_system"})
    assert MODULE.is_workshop_mod({**base, "artifact_type": "tool"})
    assert MODULE.is_workshop_mod(
        {**base, "canonical_repository": "https://github.com/example/example-mod"}
    )
    assert not MODULE.is_workshop_mod({**base, "public_surface": False})
    assert not MODULE.is_workshop_mod({**base, "maintainers": []})


def test_prune_snapshot_keeps_only_current_public_workshop_mods() -> None:
    base = {
        "artifact_type": "runtime_component",
        "repository_relationship": "organization_native",
        "delivery_model": "plugin_bundle",
        "canonical_repository": "https://github.com/vLLM-HUST/example-mod",
        "maintainers": ["maintainer"],
    }
    registry = {
        "components": [
            {**base, "id": "runnable"},
            {**base, "id": "source-scaffold", "public_surface": False},
        ]
    }
    snapshot = {
        "schema_version": "plugin-workshop-metadata/v1",
        "generated_at": "2026-09-27T00:00:00+00:00",
        "source": "preserved source",
        "plugins": {
            "runnable": {"repository": "vLLM-HUST/runnable"},
            "source-scaffold": {"repository": "vLLM-HUST/scaffold"},
            "stale-entry": {"repository": "vLLM-HUST/stale"},
        },
    }

    assert MODULE.prune_snapshot(registry, snapshot) == {
        **snapshot,
        "plugins": {"runnable": snapshot["plugins"]["runnable"]},
    }


def test_verified_identity_names_prefers_confirmed_real_names() -> None:
    payload = {
        "people": [
            {
                "github_login": "alice",
                "display_name": "艾丽丝",
                "identity_confirmed": True,
            },
            {
                "github_login": "bob",
                "display_name": "Unverified Bob",
                "identity_confirmed": False,
            },
        ]
    }
    assert MODULE.verified_identity_names(payload) == {"alice": "艾丽丝"}


def test_verified_identity_advisors_keeps_public_relationships() -> None:
    payload = {
        "people": [
            {
                "github_login": "alice",
                "identity_confirmed": True,
                "advisor": {"zh": "张老师", "en": "Prof. Zhang"},
            },
            {
                "github_login": "bob",
                "identity_confirmed": False,
                "advisor": {"zh": "不应显示", "en": "Hidden"},
            },
        ]
    }
    assert MODULE.verified_identity_advisors(payload) == {
        "alice": [
            {
                "name_zh": "张老师",
                "name_en": "Prof. Zhang",
                "relationship": "internal",
            }
        ]
    }


def test_identity_sources_can_merge_contributor_and_organization_people_data() -> None:
    contributor_snapshot = {
        "contributors": [
            {
                "github_login": "alice",
                "display_name": "艾丽丝",
                "identity_confirmed": True,
            }
        ]
    }
    organization_people = {
        "people": {
            "bob": {
                "github_login": "bob",
                "display_name": "鲍勃",
                "public": True,
                "needs_review": False,
                "profiles": {
                    "vllm_hust": {
                        "advisor_zh": "张老师",
                        "advisor_en": "Prof. Zhang",
                    }
                },
            }
        }
    }
    sources = [contributor_snapshot, organization_people]
    assert MODULE.verified_identity_names(sources) == {
        "alice": "艾丽丝",
        "bob": "鲍勃",
    }
    assert MODULE.verified_identity_advisors(sources) == {
        "bob": [
            {
                "name_zh": "张老师",
                "name_en": "Prof. Zhang",
                "relationship": "internal",
            }
        ]
    }


def test_declared_people_and_external_advisor_override_inferred_metadata() -> None:
    item = {
        "id": "pipeline-microbatch-migration",
        "maintainer_profiles": [{"login": "xsun2001", "name": "徐晨曦"}],
        "advisors": [
            {
                "name_zh": "Chen Xinyu",
                "name_en": "Chen Xinyu",
                "affiliation_zh": "香港科技大学（广州）",
                "affiliation_en": "HKUST (Guangzhou)",
                "relationship": "external_contributor",
            }
        ],
    }
    assert MODULE.declared_identity_names(item, ["xsun2001"]) == {"xsun2001": "徐晨曦"}
    assert MODULE.declared_advisors(item) == item["advisors"]


def test_private_repository_preserves_public_identity_without_repo_api():
    class PublicIdentityClient:
        def get_json(self, path):
            raise AssertionError(f"Private repository must not be queried: {path}")

        def user(self, login):
            return {"name": login, "avatar_url": "https://example.org/avatar.png"}

    item = {
        "id": "private-mod",
        "artifact_type": "runtime_component",
        "repository_relationship": "organization_native",
        "delivery_model": "python_distribution",
        "canonical_repository": "https://github.com/vLLM-HUST/private-mod",
        "repository_visibility": "private",
        "maintainers": ["maintainer"],
    }
    result = MODULE.build_snapshot({"components": [item]}, PublicIdentityClient())
    plugin = result["plugins"]["private-mod"]
    assert plugin["maintainers"][0]["login"] == "maintainer"
    assert plugin["metrics"] == {
        "stars": None,
        "forks": None,
        "open_pull_requests": None,
    }


def test_explicit_no_advisor_overrides_inferred_relationships():
    class PublicIdentityClient:
        def get_json(self, path):
            raise AssertionError(f"No repository lookup expected: {path}")

        def user(self, login):
            return {
                "name": "Shuhao Zhang",
                "avatar_url": "https://example.org/avatar.png",
            }

    item = {
        "id": "faculty-owned-mod",
        "artifact_type": "runtime_component",
        "repository_relationship": "organization_native",
        "delivery_model": "source_patch",
        "canonical_repository": "https://github.com/vLLM-HUST/example",
        "repository_visibility": "private",
        "maintainers": ["ShuhaoZhangTony"],
        "advisors": [],
    }
    inferred = {
        "shuhaozhangtony": [
            {"name_zh": "错误推断", "name_en": "Wrong", "relationship": "internal"}
        ]
    }
    result = MODULE.build_snapshot(
        {"components": [item]}, PublicIdentityClient(), identity_advisors=inferred
    )
    assert result["plugins"][item["id"]]["advisors"] == []
    assert MODULE.declared_advisors(item) == []
    del item["advisors"]
    assert MODULE.declared_advisors(item) is None
    result = MODULE.build_snapshot(
        {"components": [item]}, PublicIdentityClient(), identity_advisors=inferred
    )
    assert result["plugins"][item["id"]]["advisors"] == inferred["shuhaozhangtony"]
