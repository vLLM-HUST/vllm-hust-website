"""Keep the joined MuxPD publication within its installed-wheel evidence scope."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    return json.loads((ROOT / "data" / name).read_text())


def component():
    matches = [
        row for row in load("ecosystem.json")["components"] if row["id"] == "muxpd"
    ]
    assert len(matches) == 1
    return matches[0]


def test_muxpd_joins_as_a_restricted_runtime_mod_with_organization_support():
    row = component()
    assert row["public_surface"] is True
    assert row["maturity"] == "experimental"
    assert row["evidence_level"] == "hardware_verified"
    assert row["maintainers"] == ["vLLM-HUST"]
    assert row["support_url"] == row["canonical_repository"] + "/issues"
    taxonomy = load("mod-taxonomy.json")["components"]["muxpd"]
    assert taxonomy["kind"] == "runtime_mod"
    assert taxonomy["lifecycle"] == "implemented_restricted"
    assert taxonomy["evidence"] == "functionally_validated"
    assert set(taxonomy["phases"]) == {"prefill", "decode"}
    assert "latency_slo" in load("plugin-workload-navigation.json")["plugins"]["muxpd"]
    metadata = load("plugin-workshop-metadata.json")["plugins"]["muxpd"]
    assert metadata["repository_url"] == row["canonical_repository"]
    assert [item["login"] for item in metadata["maintainers"]] == ["vLLM-HUST"]
    assert metadata["advisors"] == []


def test_muxpd_qualification_link_is_immutable_and_keeps_numerical_limits():
    row = component()
    assert row["qualification_report"] == row["public_effect_url"]
    assert re.fullmatch(
        r"https://github\.com/vLLM-HUST/vllm-hust-benchmark/blob/[0-9a-f]{40}/"
        r"reports/muxpd-ecpa-20261025/RELEASE-QUALIFICATION\.md",
        row["public_effect_url"],
    )
    assert "6/8" in row["public_effect_en"] and "6/8" in row["public_effect_zh"]
    assert "equivalence is not established" in row["public_effect_en"]
    assert "No current-package performance gain" in row["public_effect_en"]
    assert row["compatibility"]["followup_url"].endswith("/issues/23")
    assert row["historical_evidence_scope"].startswith("Historical scoped TP4")
    assert "muxpd" not in {
        item["id"] for item in load("plugin-performance.json")["entries"]
    }


def test_muxpd_declares_the_three_actual_class_contracts_and_pinned_host():
    row = component()
    assert set(row["integration_contracts"]) == {
        "vllm_hust.extension_manifest.v0.3-experimental",
        "vllm.scheduler-class.v1",
        "vllm.worker-class.v1",
        "vllm.batch-admission-policy.v1",
    }
    compatibility = row["compatibility"]
    assert compatibility["status"] == "verified"
    assert "functional scope only" in compatibility["host"]
    assert any("910B2, TP4+EP" in value for value in compatibility["platforms"])
    assert any(
        "42 runtime-package file bytes" in value for value in compatibility["versions"]
    )
    assert (
        "HTTP/nonempty checks are not a semantic oracle"
        in compatibility["requirements_en"]
    )
