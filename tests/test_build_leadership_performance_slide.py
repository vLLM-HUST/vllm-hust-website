from __future__ import annotations

import base64
import copy
import hashlib
import importlib.util
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from itertools import pairwise
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_leadership_performance_slide",
    ROOT / "scripts" / "build_leadership_performance_slide.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def dump(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ('{"outer":{"value":1,"value":2}}', "duplicate JSON key"),
        ('{"value":NaN}', "non-finite JSON constant"),
        ('{"value":Infinity}', "non-finite JSON constant"),
    ],
)
def test_all_json_inputs_fail_closed_on_ambiguous_values(
    tmp_path: Path, raw: str, message: str
) -> None:
    path = tmp_path / "ambiguous.json"
    path.write_text(raw, encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        MODULE.load_json(path)


def fixtures(tmp_path: Path) -> tuple[object, dict, Path, Path, Path]:
    registry_path = tmp_path / "official-targets.json"
    checksum_path = tmp_path / "official-targets.sha256"
    targets = []
    pins = []
    for workload in MODULE.REQUIRED_WORKLOADS:
        target_id = f"official-{workload}"
        targets.append(
            {
                "target_id": target_id,
                "target_version": "1.0.0",
                "profile": "core-text",
                "status": "active",
                "intended_use": "public-leaderboard",
                "model": {
                    "id": MODULE.MODEL_ID,
                    "parameters": "14B",
                    "precision": "FP16",
                },
                "hardware": {
                    "vendor": "Huawei",
                    "chip_model": "910B2",
                    "chip_count": 1,
                    "node_count": 1,
                },
                "server_parameters": {
                    "tensor_parallel_size": 1,
                    "enforce_eager": "",
                    "trust_remote_code": "",
                    "disable_log_stats": "",
                    "disable_log_requests": "",
                    "host": "0.0.0.0",
                    "port": 8000,
                    "gpu_memory_utilization": 0.6,
                    "max_model_len": 32768,
                },
                "workload": {
                    "name": workload,
                    "client_parameters": {
                        "backend": "openai-chat",
                        "endpoint": "/v1/chat/completions",
                        "dataset_name": "custom",
                        "dataset_path": f"traces/{workload}.jsonl",
                        "input_len": 1024,
                        "output_len": 256,
                        "num_prompts": 32,
                        "request_rate": 1,
                        "host": "127.0.0.1",
                        "port": 8000,
                    },
                },
            }
        )
        pins.append(
            {
                "workload": workload,
                "target_id": target_id,
                "target_version": "1.0.0",
                "profile_id": "core-text",
            }
        )
    dump(registry_path, {"registry_version": "1.0.0", "targets": targets})
    registry_hash = hashlib.sha256(registry_path.read_bytes()).hexdigest()
    checksum_path.write_text(
        f"{registry_hash}  official-targets.json\n", encoding="utf-8"
    )
    registry = MODULE.load_registry(registry_path, checksum_path)
    pin_path = tmp_path / "target-pin.json"
    dump(
        pin_path,
        {
            "schema_version": "leadership-performance-target-pin/v1",
            "registry_version": "1.0.0",
            "registry_sha256": registry_hash,
            "targets": pins,
        },
    )
    loaded_pins = MODULE.load_target_pins(pin_path, registry)

    snapshot_dir = tmp_path / "snapshots"
    snapshot_dir.mkdir()
    entries = []
    story_series = []
    for index, workload in enumerate(MODULE.REQUIRED_WORKLOADS, 1):
        entry_id = f"entry-{index}"
        target_id = f"official-{workload}"
        target = targets[index - 1]
        commit = f"{index}" * 40
        repository = "vLLM-HUST/vllm-hust"
        head_entry = {
            "entry_id": entry_id,
            "engine": "vllm-hust",
            "hardware": {
                "vendor": "Huawei",
                "chip_model": "910B2",
                "chip_count": 1,
            },
            "model": {
                "repo_id": MODULE.MODEL_ID,
                "parameters": "14B",
                "precision": "FP16",
                "quantization": None,
            },
            "workload": {
                "name": workload,
                "input_length": 1024,
                "output_length": 256,
                "batch_size": None,
                "concurrent_requests": None,
                "dataset": "custom",
            },
            "metrics": {"throughput_tps": 100.0 + index},
            "metadata": {
                "verified": True,
                "target_id": target_id,
                "target_version": "1.0.0",
                "profile_id": "core-text",
                "target_registry_sha256": registry_hash,
                "github_pr_number": index,
                "github_repository": repository,
                "github_pr_url": f"https://github.com/{repository}/pull/{index}",
                "git_commit": commit,
                "github_commit_url": f"https://github.com/{repository}/commit/{commit}",
                "submitted_at": f"2026-08-0{index}T00:00:00+00:00",
                "workload_config_contract": "explicit-effective/v1",
            },
            "same_spec": MODULE.expected_same_spec(target),
        }
        entries.append(head_entry)
        base_entry = copy.deepcopy(head_entry)
        base_entry["entry_id"] = f"baseline-{index}"
        base_entry["engine"] = "vllm"
        base_entry["metrics"]["throughput_tps"] = 90.0 + index
        entries.append(base_entry)
        story_series.append(
            {
                "workload": workload,
                "milestones": [
                    {
                        "entry_id": entry_id,
                        "label": "Public optimization",
                        "pr_number": index,
                        "repository": repository,
                        "pr_url": f"https://github.com/{repository}/pull/{index}",
                        "commit": commit,
                        "attribution": {
                            "kind": "checkpoint-cumulative",
                            "boundary_id": f"checkpoint-{index}",
                            "checkpoint_entry_id": entry_id,
                            "checkpoint_commit": commit,
                        },
                    }
                ],
            }
        )
    dump(snapshot_dir / "leaderboard_single.json", entries)
    dump(snapshot_dir / "leaderboard_multi.json", [])
    compare_groups = []
    for index, workload in enumerate(MODULE.REQUIRED_WORKLOADS, 1):
        compare_groups.append(
            {
                "category": "single",
                "scope": {
                    "model": MODULE.MODEL_ID,
                    "model_canonical_id": f"hf:{MODULE.MODEL_ID}",
                    "hardware": "910B2",
                    "precision": "FP16",
                    "workload": workload,
                    "config_type": "single_gpu",
                    "chip_count": 1,
                    "node_count": 1,
                    "setting_signature": f"official-{workload}",
                },
                "engines": [
                    {"engine": "vllm", "entry_id": f"baseline-{index}"},
                    {"engine": "vllm-hust", "entry_id": f"entry-{index}"},
                ],
                "preferred_pair": {
                    "left": {
                        "engine": "vllm-hust",
                        "entry_id": f"entry-{index}",
                    },
                    "right": {
                        "engine": "vllm",
                        "entry_id": f"baseline-{index}",
                    },
                },
            }
        )
    dump(
        snapshot_dir / "leaderboard_compare.json",
        {
            "schema_version": "leaderboard-compare-snapshot/v1",
            "group_count": len(compare_groups),
            "groups": compare_groups,
        },
    )
    dump(snapshot_dir / "last_updated.json", {"last_updated": "2026-08-01T00:00:00Z"})
    story_path = tmp_path / "story.json"
    dump(
        story_path,
        {"schema_version": "leadership-performance-story/v1", "series": story_series},
    )
    return registry, loaded_pins, pin_path, snapshot_dir, story_path


def test_registry_pin_and_snapshot_are_admitted(tmp_path: Path) -> None:
    registry, pins, _, snapshot_dir, _ = fixtures(tmp_path)
    entries, snapshot_time = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    assert len(entries) == 6
    assert snapshot_time == "2026-08-01T00:00:00Z"


def test_same_spec_comparator_matches_benchmark_contract() -> None:
    registry_path = (
        ROOT.parent
        / "vllm-hust-benchmark"
        / "leaderboard-data"
        / "official-targets.json"
    )
    if not registry_path.is_file():
        pytest.skip("benchmark checkout is unavailable")
    payload = json.loads(registry_path.read_text())
    target = next(
        target
        for target in payload["targets"]
        if target["target_id"].endswith("agent-research-online-qwen25-14b-910b2")
    )
    expected = MODULE.expected_same_spec(target)
    assert expected["resolved_spec_hash"] == (
        "05e08764f0853bcb19e84c3dc604018d567773fd6d7942d385190266c21a04cb"
    )


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("verified", False, "verified"),
        ("profile_id", "other", "profile_id"),
        ("target_registry_sha256", "0" * 64, "registry_sha256"),
    ],
)
def test_snapshot_binding_mismatch_fails_closed(
    tmp_path: Path, field: str, value: object, message: str
) -> None:
    registry, pins, _, snapshot_dir, _ = fixtures(tmp_path)
    payload = json.loads((snapshot_dir / "leaderboard_single.json").read_text())
    payload[0]["metadata"][field] = value
    dump(snapshot_dir / "leaderboard_single.json", payload)
    with pytest.raises(ValueError, match=message):
        MODULE.admit_snapshot(snapshot_dir, registry, pins)


@pytest.mark.parametrize(
    ("section", "field", "value", "message"),
    [
        ("server", "tensor_parallel_size", 2, "resolved_server_parameters"),
        ("client", "request_rate", 99, "resolved_client_parameters"),
        ("same_spec", "model_precision", "BF16", "model_precision"),
        ("same_spec", "resolved_spec_hash", "f" * 64, "resolved_spec_hash"),
        ("model", "precision", "BF16", "model contract"),
        ("hardware", "vendor", "Other", "hardware contract"),
        ("workload", "input_length", 2048, "workload.input_length"),
        ("workload", "output_length", 512, "workload.output_length"),
        ("workload", "dataset", "other", "workload.dataset"),
        (
            "metadata",
            "workload_config_contract",
            "other/v1",
            "workload_config_contract",
        ),
    ],
)
def test_official_target_contract_mismatch_fails_closed(
    tmp_path: Path, section: str, field: str, value: object, message: str
) -> None:
    registry, pins, _, snapshot_dir, _ = fixtures(tmp_path)
    payload = json.loads((snapshot_dir / "leaderboard_single.json").read_text())
    entry = payload[0]
    if section == "server":
        entry["same_spec"]["resolved_server_parameters"][field] = value
    elif section == "client":
        entry["same_spec"]["resolved_client_parameters"][field] = value
    else:
        entry[section][field] = value
    dump(snapshot_dir / "leaderboard_single.json", payload)
    with pytest.raises(ValueError, match=message):
        MODULE.admit_snapshot(snapshot_dir, registry, pins)


def test_random_online_known_sample_allows_operational_port_and_model_path() -> None:
    benchmark_data = ROOT.parent / "vllm-hust-benchmark" / "leaderboard-data"
    if not benchmark_data.is_dir():
        pytest.skip("benchmark checkout is unavailable")
    registry_payload = json.loads(
        (benchmark_data / "official-targets.json").read_text()
    )
    target = next(
        item
        for item in registry_payload["targets"]
        if item["target_id"].endswith("random-online-qwen25-14b-910b2")
    )
    entries = json.loads(
        (benchmark_data / "snapshots" / "leaderboard_single.json").read_text()
    )
    sample = next(
        item
        for item in entries
        if (item.get("same_spec") or {}).get("spec_id") == target["target_id"]
    )
    expected = MODULE.expected_same_spec(target)
    assert sample["same_spec"]["resolved_server_parameters"]["port"] == 8020
    assert sample["same_spec"]["resolved_server_parameters"]["model"].startswith("/")
    assert (
        MODULE._contract_mismatches(sample["same_spec"], expected, prefix="sample")
        == []
    )
    assert (
        MODULE._workload_summary_errors(sample, prefix="sample", expected_spec=expected)
        == []
    )


def test_empty_compare_and_missing_workload_fail_closed(tmp_path: Path) -> None:
    registry, pins, _, snapshot_dir, _ = fixtures(tmp_path)
    dump(snapshot_dir / "leaderboard_compare.json", {"group_count": 0, "groups": []})
    payload = json.loads((snapshot_dir / "leaderboard_single.json").read_text())
    payload = [
        entry
        for entry in payload
        if entry["workload"]["name"] != MODULE.REQUIRED_WORKLOADS[-1]
    ]
    dump(snapshot_dir / "leaderboard_single.json", payload)
    with pytest.raises(ValueError) as caught:
        MODULE.admit_snapshot(snapshot_dir, registry, pins)
    assert "no admitted groups" in str(caught.value)
    assert "lacks admitted leadership workload" in str(caught.value)


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        ("empty-members", "needs at least two members"),
        ("unknown-member", "unknown snapshot entry_id"),
        ("wrong-scope", "scope.workload differs from pinned target"),
        ("wrong-schema", "schema_version must be"),
        ("duplicate-engine", "member engines must be unique"),
        ("missing-side", "preferred_pair must declare left and right"),
        ("bad-preferred-pair", "preferred_pair entries must be group members"),
    ],
)
def test_compare_group_requires_admitted_members_and_exact_scope(
    tmp_path: Path, mutation: str, message: str
) -> None:
    registry, pins, _, snapshot_dir, _ = fixtures(tmp_path)
    compare_path = snapshot_dir / "leaderboard_compare.json"
    compare = json.loads(compare_path.read_text())
    if mutation == "empty-members":
        compare["groups"][0]["engines"] = []
    elif mutation == "unknown-member":
        compare["groups"][0]["engines"][0]["entry_id"] = "unknown-entry"
    elif mutation == "wrong-scope":
        compare["groups"][0]["scope"]["workload"] = "other-workload"
    elif mutation == "wrong-schema":
        compare["schema_version"] = "leaderboard-compare-snapshot/v0"
    elif mutation == "duplicate-engine":
        compare["groups"][0]["engines"][0]["engine"] = "vllm-hust"
    elif mutation == "missing-side":
        del compare["groups"][0]["preferred_pair"]["right"]
    else:
        compare["groups"][0]["preferred_pair"]["left"]["entry_id"] = "unknown-entry"
    dump(compare_path, compare)
    with pytest.raises(ValueError, match=message):
        MODULE.admit_snapshot(snapshot_dir, registry, pins)


def test_story_uses_only_canonical_metric_and_matching_pr(tmp_path: Path) -> None:
    registry, pins, _, snapshot_dir, story_path = fixtures(tmp_path)
    entries, _ = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    series = MODULE.load_story(story_path, entries)
    assert series["agent-research-online"][0].throughput_tps == 101.0

    story = json.loads(story_path.read_text())
    story["series"][0]["milestones"][0]["pr_number"] = 999
    dump(story_path, story)
    with pytest.raises(ValueError, match="PR URL is not canonical"):
        MODULE.load_story(story_path, entries)


@pytest.mark.parametrize(
    ("location", "field"),
    [
        ("top", "throughput_tps"),
        ("series", "performance_value"),
        ("milestone", "throughput_tps"),
        ("attribution", "delta_tps"),
    ],
)
def test_story_rejects_manual_performance_or_unknown_fields(
    tmp_path: Path, location: str, field: str
) -> None:
    registry, pins, _, snapshot_dir, story_path = fixtures(tmp_path)
    entries, _ = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    story = json.loads(story_path.read_text())
    target = {
        "top": story,
        "series": story["series"][0],
        "milestone": story["series"][0]["milestones"][0],
        "attribution": story["series"][0]["milestones"][0]["attribution"],
    }[location]
    target[field] = 123.45
    dump(story_path, story)
    with pytest.raises(ValueError, match="unexpected schema keys"):
        MODULE.load_story(story_path, entries)


def test_story_rejects_forbidden_image_text_and_duplicate_entry(tmp_path: Path) -> None:
    registry, pins, _, snapshot_dir, story_path = fixtures(tmp_path)
    entries, _ = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    story = json.loads(story_path.read_text())
    story["series"][0]["milestones"][0]["label"] = "prompt tuning"
    dump(story_path, story)
    with pytest.raises(ValueError, match="text audit rejected"):
        MODULE.load_story(story_path, entries)

    story = json.loads(story_path.read_text())
    story["series"][0]["milestones"][0]["label"] = "Public optimization"
    story["series"][0]["milestones"].append(
        copy.deepcopy(story["series"][0]["milestones"][0])
    )
    dump(story_path, story)
    with pytest.raises(ValueError, match="duplicate milestone entry_id"):
        MODULE.load_story(story_path, entries)


@pytest.mark.parametrize(
    "label", ["ｐｒｏｍｐｔ tuning", "p\u200brompt tuning", "ＰＲＯＭＰＴ"]
)
def test_text_audit_normalizes_nfkc_case_and_format_characters(label: str) -> None:
    with pytest.raises(ValueError, match="text audit rejected"):
        MODULE.audit_public_text([label], source="story")


def test_story_cannot_self_assert_a_paired_relationship(
    tmp_path: Path,
) -> None:
    registry, pins, _, snapshot_dir, story_path = fixtures(tmp_path)
    entries, _ = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    story = json.loads(story_path.read_text())
    milestone = story["series"][0]["milestones"][0]
    head_id = milestone["entry_id"]
    base_id = "agent-base"
    base = copy.deepcopy(entries[head_id])
    base["entry_id"] = base_id
    base["metrics"]["throughput_tps"] = 90.0
    base["metadata"]["submitted_at"] = "2026-07-31T00:00:00+00:00"
    entries[base_id] = base
    milestone["attribution"] = {
        "kind": "paired",
        "relationship_id": "agent-pair-1",
        "base_entry_id": base_id,
        "head_entry_id": head_id,
    }
    dump(story_path, story)
    with pytest.raises(ValueError, match="paired attribution is disabled"):
        MODULE.load_story(story_path, entries)


def test_paired_story_rejects_base_equal_to_head(tmp_path: Path) -> None:
    registry, pins, _, snapshot_dir, story_path = fixtures(tmp_path)
    entries, _ = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    story = json.loads(story_path.read_text())
    milestone = story["series"][0]["milestones"][0]
    milestone["attribution"] = {
        "kind": "paired",
        "relationship_id": "self-pair",
        "base_entry_id": milestone["entry_id"],
        "head_entry_id": milestone["entry_id"],
    }
    dump(story_path, story)
    with pytest.raises(ValueError, match="paired attribution is disabled"):
        MODULE.load_story(story_path, entries)


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("repository", "other/repo", "PR URL is not canonical"),
        ("pr_url", "https://github.com/other/repo/pull/1", "PR URL is not canonical"),
        ("commit", "f" * 40, "git_commit does not match canonical entry"),
    ],
)
def test_story_rejects_pr_identity_mismatch(
    tmp_path: Path, field: str, value: str, message: str
) -> None:
    registry, pins, _, snapshot_dir, story_path = fixtures(tmp_path)
    entries, _ = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    story = json.loads(story_path.read_text())
    story["series"][0]["milestones"][0][field] = value
    dump(story_path, story)
    with pytest.raises(ValueError, match=message):
        MODULE.load_story(story_path, entries)


def test_checkpoint_boundary_must_bind_exact_commit(tmp_path: Path) -> None:
    registry, pins, _, snapshot_dir, story_path = fixtures(tmp_path)
    entries, _ = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    story = json.loads(story_path.read_text())
    story["series"][0]["milestones"][0]["attribution"]["checkpoint_commit"] = "f" * 40
    dump(story_path, story)
    with pytest.raises(ValueError, match="exact entry/commit boundary"):
        MODULE.load_story(story_path, entries)


def test_cumulative_story_requires_monotonic_prs_and_commit_ancestry(
    tmp_path: Path,
) -> None:
    registry, pins, _, snapshot_dir, story_path = fixtures(tmp_path)
    entries, _ = MODULE.admit_snapshot(snapshot_dir, registry, pins)
    story = json.loads(story_path.read_text())
    milestones = story["series"][0]["milestones"]
    second = copy.deepcopy(milestones[0])
    second["entry_id"] = "entry-agent-second"
    second["pr_number"] = 20
    second["pr_url"] = "https://github.com/vLLM-HUST/vllm-hust/pull/20"
    second["commit"] = "a" * 40
    second["attribution"]["boundary_id"] = "checkpoint-agent-second"
    second["attribution"]["checkpoint_entry_id"] = second["entry_id"]
    second["attribution"]["checkpoint_commit"] = second["commit"]
    source = copy.deepcopy(entries[milestones[0]["entry_id"]])
    source["entry_id"] = second["entry_id"]
    source["metadata"]["github_pr_number"] = 20
    source["metadata"]["github_pr_url"] = second["pr_url"]
    source["metadata"]["git_commit"] = second["commit"]
    source["metadata"]["github_commit_url"] = (
        f"https://github.com/vLLM-HUST/vllm-hust/commit/{second['commit']}"
    )
    entries[second["entry_id"]] = source
    milestones.append(second)
    dump(story_path, story)

    calls: list[tuple[str, str | None, str]] = []
    MODULE.load_story(
        story_path,
        entries,
        commit_verifier=lambda repository, previous, current: calls.append(
            (repository, previous, current)
        ),
    )
    assert (
        "vLLM-HUST/vllm-hust",
        milestones[0]["commit"],
        second["commit"],
    ) in calls

    with pytest.raises(ValueError, match="no commit ancestry verifier"):
        MODULE.load_story(story_path, entries)

    story["series"][0]["milestones"][1]["pr_number"] = 1
    story["series"][0]["milestones"][1]["pr_url"] = (
        "https://github.com/vLLM-HUST/vllm-hust/pull/1"
    )
    entries[second["entry_id"]]["metadata"]["github_pr_number"] = 1
    entries[second["entry_id"]]["metadata"]["github_pr_url"] = (
        "https://github.com/vLLM-HUST/vllm-hust/pull/1"
    )
    dump(story_path, story)
    with pytest.raises(ValueError, match="strictly increasing"):
        MODULE.load_story(story_path, entries, commit_verifier=lambda *_: None)


def test_milestone_commit_verifier_requires_origin_and_strict_ancestry(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "milestones"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    subprocess.run(
        ["git", "-C", str(repo), "config", "user.email", "test@example.com"],
        check=True,
    )
    subprocess.run(
        ["git", "-C", str(repo), "config", "user.name", "Test"], check=True
    )
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "remote",
            "add",
            "origin",
            "git@github.com:vLLM-HUST/vllm-hust.git",
        ],
        check=True,
    )
    commits = []
    for index in range(2):
        (repo / "checkpoint.txt").write_text(str(index), encoding="utf-8")
        subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
        subprocess.run(
            ["git", "-C", str(repo), "commit", "-qm", f"checkpoint {index}"],
            check=True,
        )
        commits.append(
            subprocess.run(
                ["git", "-C", str(repo), "rev-parse", "HEAD"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
        )

    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "update-ref",
            "refs/remotes/origin/main",
            commits[-1],
        ],
        check=True,
    )
    verify = MODULE.milestone_commit_verifier(repo)
    verify("vLLM-HUST/vllm-hust", None, commits[0])
    verify("vLLM-HUST/vllm-hust", commits[0], commits[1])
    with pytest.raises(ValueError, match="not in strict ancestor order"):
        verify("vLLM-HUST/vllm-hust", commits[1], commits[0])
    with pytest.raises(ValueError, match="does not match"):
        verify("other/repo", None, commits[0])

    (repo / "checkpoint.txt").write_text("local-only", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(
        ["git", "-C", str(repo), "commit", "-qm", "local only checkpoint"],
        check=True,
    )
    local_only = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    with pytest.raises(ValueError, match="local-only"):
        verify("vLLM-HUST/vllm-hust", commits[-1], local_only)


def test_target_pin_is_stale_when_registry_hash_changes(tmp_path: Path) -> None:
    registry, _, pin_path, _, _ = fixtures(tmp_path)
    changed = MODULE.Registry(registry.version, "f" * 64, registry.targets)
    with pytest.raises(ValueError, match="stale"):
        MODULE.load_target_pins(pin_path, changed)


def test_target_pin_rejects_unknown_fields(tmp_path: Path) -> None:
    registry, _, pin_path, _, _ = fixtures(tmp_path)
    pins = json.loads(pin_path.read_text())
    pins["targets"][0]["throughput_tps"] = 999.0
    dump(pin_path, pins)
    with pytest.raises(ValueError, match="unexpected schema keys"):
        MODULE.load_target_pins(pin_path, registry)


def test_stale_check_covers_inputs_and_artifact_bytes(tmp_path: Path) -> None:
    artifacts = []
    for name in MODULE.EXPECTED_ARTIFACTS:
        artifact = tmp_path / name
        artifact.write_text(name, encoding="utf-8")
        artifacts.append(artifact)
    provenance = {
        "schema_version": MODULE.PROVENANCE_SCHEMA,
        "generated_at": "2026-08-01T00:00:00+00:00",
        "benchmark_commit": "a" * 40,
        "snapshot_time": "2026-08-01T00:00:00Z",
        "registry_version": "1.0.0",
        "registry_sha256": "b" * 64,
        "target_pin_sha256": "c" * 64,
        "story_sha256": "d" * 64,
        "snapshot_sha256": {},
        "targets": [],
    }
    stored = dict(provenance)
    stored["artifacts"] = {
        artifact.name: MODULE.sha256_file(artifact) for artifact in artifacts
    }
    provenance_path = tmp_path / "leadership_performance.provenance.json"
    dump(provenance_path, stored)
    MODULE.check_stale(provenance_path, provenance)
    artifacts[0].write_text("changed", encoding="utf-8")
    with pytest.raises(ValueError, match="artifact is stale"):
        MODULE.check_stale(provenance_path, provenance)

    stored["artifacts"].pop("leadership_performance.png")
    dump(provenance_path, stored)
    with pytest.raises(ValueError, match="exact artifact set"):
        MODULE.check_stale(provenance_path, provenance)

    stored["artifacts"]["../leadership_performance.png"] = "a" * 64
    dump(provenance_path, stored)
    with pytest.raises(ValueError, match="unsafe or invalid artifact provenance"):
        MODULE.check_stale(provenance_path, provenance)


def test_pptx_text_layer_forbidden_terms_are_rejected(tmp_path: Path) -> None:
    clean = tmp_path / "clean.pptx"
    with zipfile.ZipFile(clean, "w") as archive:
        archive.writestr("ppt/slides/slide1.xml", "<a:t>Public optimization</a:t>")
    MODULE.audit_pptx_text(clean)

    dirty = tmp_path / "dirty.pptx"
    with zipfile.ZipFile(dirty, "w") as archive:
        archive.writestr(
            "ppt/slides/slide1.xml",
            "<a:t>no </a:t><a:t>base</a:t><a:t>line</a:t>",
        )
    with pytest.raises(ValueError, match="no baseline"):
        MODULE.audit_pptx_text(dirty)


def test_svg_and_png_embed_provenance(tmp_path: Path) -> None:
    provenance = {
        "schema_version": MODULE.PROVENANCE_SCHEMA,
        "registry_sha256": "a" * 64,
    }
    series = {
        workload: [
            MODULE.Point(
                "Public optimization",
                1,
                100.0,
                "entry",
                "checkpoint-cumulative",
                None,
                "checkpoint-1",
            )
        ]
        for workload in MODULE.REQUIRED_WORKLOADS
    }
    svg = MODULE.render_svg(series, provenance)
    assert "leadership-performance-provenance" in svg
    assert "registry_sha256" in svg

    png = tmp_path / "image.png"
    png.write_bytes(
        base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        )
    )
    MODULE.embed_png_provenance(png, provenance)
    assert b"leadership-performance-provenance" in png.read_bytes()


def test_svg_single_near_value_series_use_distinct_markers_and_annotation_lanes() -> (
    None
):
    provenance = {
        "schema_version": MODULE.PROVENANCE_SCHEMA,
        "registry_sha256": "a" * 64,
    }
    series = {
        workload: [
            MODULE.Point(
                f"Optimization {index}",
                index,
                99.0 + index,
                f"entry-{index}",
                "checkpoint-cumulative",
                None,
                f"checkpoint-{index}",
            )
        ]
        for index, workload in enumerate(MODULE.REQUIRED_WORKLOADS, 1)
    }
    root = ET.fromstring(MODULE.render_svg(series, provenance))
    namespace = {"svg": "http://www.w3.org/2000/svg"}
    markers = [
        node
        for node in root.findall("svg:circle", namespace)
        if node.get("class") == "series-marker"
    ]
    annotations = [
        node
        for node in root.findall("svg:text", namespace)
        if node.get("class") == "point-annotation"
    ]
    leaders = [
        node
        for node in root.findall("svg:line", namespace)
        if node.get("class") == "point-leader"
    ]
    assert len(markers) == len(annotations) == len(leaders) == 3

    marker_positions = [
        (float(marker.attrib["cx"]), float(marker.attrib["cy"])) for marker in markers
    ]
    assert len({x for x, _ in marker_positions}) == 3
    for index, (left, right) in enumerate(pairwise(marker_positions), 1):
        distance = ((right[0] - left[0]) ** 2 + (right[1] - left[1]) ** 2) ** 0.5
        assert distance > 16, f"markers {index}/{index + 1} overlap"
    assert marker_positions[0][1] > marker_positions[1][1] > marker_positions[2][1]

    lane_positions = [float(annotation.attrib["y"]) for annotation in annotations]
    assert lane_positions == sorted(lane_positions)
    assert min(right - left for left, right in pairwise(lane_positions)) >= 40
    annotation_text = ["".join(annotation.itertext()) for annotation in annotations]
    for index, text in enumerate(annotation_text, 1):
        assert f"PR #{index}" in text
        assert f"{99.0 + index:.2f}" in text
        assert f"Optimization {index}" in text


def test_svg_rejects_forbidden_text_before_rasterization() -> None:
    provenance = {
        "schema_version": MODULE.PROVENANCE_SCHEMA,
        "registry_sha256": "a" * 64,
    }
    series = {
        workload: [
            MODULE.Point(
                "Public optimization",
                1,
                100.0,
                "entry",
                "checkpoint-cumulative",
                None,
                f"boundary-{workload}",
            )
        ]
        for workload in MODULE.REQUIRED_WORKLOADS
    }
    series["agent-research-online"][0] = MODULE.Point(
        "prompt detail",
        1,
        100.0,
        "entry",
        "checkpoint-cumulative",
        None,
        "boundary-agent",
    )
    with pytest.raises(ValueError, match="SVG text audit rejected"):
        MODULE.render_svg(series, provenance)


def test_benchmark_commit_binds_exact_registry_and_snapshot_bytes(
    tmp_path: Path,
) -> None:
    _, _, _, snapshot_dir, _ = fixtures(tmp_path)
    fixture_registry = tmp_path / "official-targets.json"
    fixture_checksum = tmp_path / "official-targets.sha256"
    repo = tmp_path / "benchmark"
    committed_data = repo / "leaderboard-data"
    committed_snapshots = committed_data / "snapshots"
    committed_snapshots.mkdir(parents=True)
    (committed_data / "official-targets.json").write_bytes(
        fixture_registry.read_bytes()
    )
    (committed_data / "official-targets.sha256").write_bytes(
        fixture_checksum.read_bytes()
    )
    for name in MODULE.SNAPSHOT_FILES:
        (committed_snapshots / name).write_bytes((snapshot_dir / name).read_bytes())
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    subprocess.run(
        ["git", "-C", str(repo), "config", "user.email", "test@example.com"],
        check=True,
    )
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"], check=True)
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "fixture"], check=True)
    commit = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    tree = MODULE.verify_benchmark_source(
        repo=repo,
        commit=commit,
        snapshot_dir=committed_snapshots,
        registry_path=committed_data / "official-targets.json",
        checksum_path=committed_data / "official-targets.sha256",
    )
    assert len(tree) == 40

    with pytest.raises(ValueError, match="cannot verify benchmark git source"):
        MODULE.verify_benchmark_source(
            repo=repo,
            commit="f" * 40,
            snapshot_dir=committed_snapshots,
            registry_path=committed_data / "official-targets.json",
            checksum_path=committed_data / "official-targets.sha256",
        )

    (committed_snapshots / "last_updated.json").write_text("{}\n", encoding="utf-8")
    with pytest.raises(ValueError, match="source bytes do not match"):
        MODULE.verify_benchmark_source(
            repo=repo,
            commit=commit,
            snapshot_dir=committed_snapshots,
            registry_path=committed_data / "official-targets.json",
            checksum_path=committed_data / "official-targets.sha256",
        )


def test_pptx_core_metadata_binds_story_and_snapshot() -> None:
    provenance = {
        "target_pin_sha256": "a" * 64,
        "registry_version": "1.0.0",
        "registry_sha256": "b" * 64,
        "benchmark_commit": "c" * 40,
        "benchmark_tree": "d" * 40,
        "story_sha256": "e" * 64,
        "snapshot_set_sha256": "f" * 64,
    }
    metadata = MODULE.pptx_core_metadata(provenance)
    assert provenance["story_sha256"] in metadata["content_status"]
    assert provenance["snapshot_set_sha256"] in metadata["last_modified_by"]
    assert all(len(value) <= 255 for value in metadata.values())


def test_staged_publish_rolls_back_on_mid_publish_failure(tmp_path: Path) -> None:
    staged = tmp_path / "staged"
    output = tmp_path / "output"
    staged.mkdir()
    output.mkdir()
    for name in MODULE.PUBLISHED_FILES:
        (staged / name).write_text(f"new:{name}", encoding="utf-8")
        (output / name).write_text(f"old:{name}", encoding="utf-8")
    calls = 0

    def fail_second(source: Path, target: Path) -> None:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("injected publish failure")
        source.replace(target)

    with pytest.raises(OSError, match="injected publish failure"):
        MODULE.publish_staged_outputs(staged, output, replace_file=fail_second)
    for name in MODULE.PUBLISHED_FILES:
        assert (output / name).read_text(encoding="utf-8") == f"old:{name}"
    assert not list(tmp_path.glob("leadership-slide-backup-*"))


def test_staged_publish_preserves_backup_when_recovery_is_incomplete(
    tmp_path: Path,
) -> None:
    staged = tmp_path / "staged"
    output = tmp_path / "output"
    staged.mkdir()
    output.mkdir()
    names = sorted(MODULE.PUBLISHED_FILES)
    for name in names:
        (staged / name).write_text(f"new:{name}", encoding="utf-8")
        (output / name).write_text(f"old:{name}", encoding="utf-8")
    install_calls = 0

    def fail_install(source: Path, target: Path) -> None:
        nonlocal install_calls
        install_calls += 1
        if install_calls == 2:
            raise OSError("injected install failure")
        source.replace(target)

    failed_restore = names[0]

    def fail_one_restore(source: Path, target: Path) -> None:
        if source.name == failed_restore:
            raise OSError("injected restore failure")
        source.replace(target)

    with pytest.raises(RuntimeError, match="preserved backup"):
        MODULE.publish_staged_outputs(
            staged,
            output,
            replace_file=fail_install,
            restore_file=fail_one_restore,
        )
    backups = list(tmp_path.glob("leadership-slide-backup-*"))
    assert len(backups) == 1
    assert (backups[0] / failed_restore).read_text(encoding="utf-8") == (
        f"old:{failed_restore}"
    )
    for name in names[1:]:
        assert (output / name).read_text(encoding="utf-8") == f"old:{name}"


def test_dependency_free_render_harness_writes_auditable_complete_set(
    tmp_path: Path,
) -> None:
    series = {
        workload: [
            MODULE.Point(
                "Public optimization",
                index,
                100.0 + index,
                f"entry-{index}",
                "checkpoint-cumulative",
                None,
                f"checkpoint-{index}",
            )
        ]
        for index, workload in enumerate(MODULE.REQUIRED_WORKLOADS, 1)
    }
    provenance = {
        "schema_version": MODULE.PROVENANCE_SCHEMA,
        "generated_at": "2026-08-01T00:00:00+00:00",
        "benchmark_commit": "a" * 40,
        "benchmark_tree": "b" * 40,
        "snapshot_time": "2026-08-01T00:00:00Z",
        "registry_version": "1.0.0",
        "registry_sha256": "c" * 64,
        "target_pin_sha256": "d" * 64,
        "story_sha256": "e" * 64,
        "snapshot_sha256": {},
        "snapshot_set_sha256": "f" * 64,
        "targets": [],
    }

    def write_png(svg: str, path: Path, metadata: dict) -> None:
        assert svg and metadata
        path.write_bytes(
            base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
            )
        )
        MODULE.embed_png_provenance(path, metadata)

    def write_pptx(png_path: Path, path: Path, metadata: dict) -> None:
        assert png_path.is_file() and metadata
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("ppt/slides/slide1.xml", "<a:t>Public optimization</a:t>")

    staged = tmp_path / "staged"
    MODULE.write_outputs(
        staged,
        series,
        provenance,
        png_renderer=write_png,
        pptx_renderer=write_pptx,
    )
    assert {path.name for path in staged.iterdir()} == MODULE.PUBLISHED_FILES
    current = dict(provenance)
    current.pop("artifacts")
    MODULE.check_stale(staged / "leadership_performance.provenance.json", current)


def test_checked_in_snapshot_is_not_formally_admitted() -> None:
    benchmark = ROOT.parent / "vllm-hust-benchmark" / "leaderboard-data"
    if not benchmark.is_dir():
        pytest.skip("benchmark checkout is unavailable")
    registry = MODULE.load_registry(
        benchmark / "official-targets.json", benchmark / "official-targets.sha256"
    )
    pins = MODULE.load_target_pins(
        ROOT / "data" / "leadership_performance_targets.json", registry
    )
    with pytest.raises(
        ValueError, match="canonical snapshot admission failed"
    ) as caught:
        MODULE.admit_snapshot(ROOT / "data", registry, pins)
    assert "metadata.verified must be true" in str(caught.value)
    assert "canonical compare snapshot has no admitted groups" in str(caught.value)
