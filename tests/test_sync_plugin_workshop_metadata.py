from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "sync_plugin_workshop_metadata.py"
SPEC = importlib.util.spec_from_file_location(
    "sync_plugin_workshop_metadata", SCRIPT_PATH
)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


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


def test_workshop_filter_accepts_org_bridges_but_excludes_external_systems() -> None:
    base = {
        "artifact_type": "runtime_component",
        "repository_relationship": "organization_native",
        "delivery_model": "plugin_bundle",
        "canonical_repository": "https://github.com/vLLM-HUST/example-mod",
    }
    assert MODULE.is_workshop_mod(base)
    assert MODULE.is_workshop_mod({**base, "artifact_type": "bridge"})
    assert not MODULE.is_workshop_mod(
        {
            **base,
            "artifact_type": "bridge",
            "repository_relationship": "official_upstream",
        }
    )
    assert not MODULE.is_workshop_mod({**base, "artifact_type": "external_system"})
    assert not MODULE.is_workshop_mod({**base, "public_surface": False})
    assert not MODULE.is_workshop_mod(
        {**base, "canonical_repository": "https://github.com/vllm-project/vllm"}
    )


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
        "alice": [{"name_zh": "张老师", "name_en": "Prof. Zhang"}]
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
        "bob": [{"name_zh": "张老师", "name_en": "Prof. Zhang"}]
    }
