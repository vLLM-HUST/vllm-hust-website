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


def test_workshop_filter_excludes_connectors_and_systems() -> None:
    base = {
        "artifact_type": "runtime_component",
        "repository_relationship": "organization_native",
        "delivery_model": "plugin_bundle",
        "canonical_repository": "https://github.com/vLLM-HUST/example-mod",
    }
    assert MODULE.is_workshop_mod(base)
    assert not MODULE.is_workshop_mod({**base, "artifact_type": "bridge"})
    assert not MODULE.is_workshop_mod(
        {**base, "canonical_repository": "https://github.com/vllm-project/vllm"}
    )
