"""Reject unmerged, malformed and unverifiable release source identities."""

import importlib.util
from pathlib import Path
from urllib.error import URLError

import pytest

SPEC = importlib.util.spec_from_file_location(
    "release_sources",
    Path(__file__).resolve().parents[1] / "scripts/verify_release_sources.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
DATA, POLICY, HEAD = "a" * 40, "b" * 40, "c" * 40
PINS = {"publication_revision": DATA, "visibility_policy_revision": POLICY}


def reader(path):
    if path.endswith("/commits/main"):
        return {"sha": HEAD}
    commit = path.split("/compare/")[1].split("...")[0]
    return {
        "status": "identical" if commit == HEAD else "ahead",
        "base_commit": {"sha": commit},
        "merge_base_commit": {"sha": commit},
    }


def test_distinct_source_locks_and_presentation_are_verified():
    calls = []

    def read(path):
        calls.append(path)
        return reader(path)

    result = MODULE.verify_sources(PINS, read, HEAD)
    assert result["sources"]["publication_revision"]["revision"] == DATA
    assert result["sources"]["visibility_policy_revision"]["revision"] == POLICY
    assert result["presentation"]["revision"] == HEAD
    assert any(DATA + "..." + HEAD in path for path in calls)
    assert any(POLICY + "..." + HEAD in path for path in calls)


@pytest.mark.parametrize("role", ["publication_revision", "visibility_policy_revision"])
@pytest.mark.parametrize("status", ["behind", "diverged"])
def test_well_formed_unmerged_commit_is_rejected(role, status):
    def read(path):
        value = reader(path)
        if "/compare/" + PINS[role] + "..." in path:
            value["status"] = status
        return value

    with pytest.raises(ValueError, match="not merged"):
        MODULE.verify_sources(PINS, read)


def test_inconsistent_ancestry_response_is_rejected():
    def read(path):
        value = reader(path)
        if "/compare/" in path:
            value["merge_base_commit"]["sha"] = HEAD
        return value

    with pytest.raises(ValueError, match="not merged"):
        MODULE.verify_sources(PINS, read)


def test_unavailable_api_does_not_produce_a_success_receipt():
    def unavailable(path):
        raise URLError("source verification unavailable")

    with pytest.raises(URLError):
        MODULE.verify_sources(PINS, unavailable)


def test_checkout_is_bound_to_the_immutable_event_commit():
    MODULE.verify_checkout(DATA, DATA)
    with pytest.raises(ValueError, match="triggering commit"):
        MODULE.verify_checkout(DATA, HEAD)


@pytest.mark.parametrize("value", ["main", "a" * 39, "A" * 40, None])
def test_invalid_revisions_are_rejected(value):
    with pytest.raises(ValueError):
        MODULE.revision(value)
