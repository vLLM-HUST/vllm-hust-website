from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "sync_dataset_validation_snapshots",
    ROOT / "scripts" / "sync_dataset_validation_snapshots.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def write_publication(root: Path) -> None:
    index = {
        "contract_version": "dataset-validation-index-v1",
        "program_file": MODULE.PROGRAM_FILE,
        "default_scenario_id": "qwen25",
        "scenarios": [
            {
                "id": "qwen25",
                "label": "Qwen2.5",
                "model": "Qwen2.5",
                "hardware": "Ascend",
                "precision": "FP16",
                "data_file": "qwen25.json",
            }
        ],
    }
    artifact = {
        "contract_version": "dataset-validation-v1",
        "scenario": {"id": "qwen25"},
        "datasets": [],
        "metrics": [],
        "results": [],
    }
    program = {
        "contract_version": "dataset-program-v1",
        "designation": {
            "id": "pujiang-specified-dataset-scope",
            "scope_status": "names-only",
        },
        "primary_datasets": [
            {
                "id": dataset_id,
                "readiness": {
                    "status": (
                        "material-unfrozen" if dataset_id == "mmlu-pro" else "missing"
                    )
                },
            }
            for dataset_id in (
                "mmlu-pro",
                "hle-verified",
                "swe-bench-pro",
                "frontierscience",
                "terminal-bench-2.1",
            )
        ],
    }
    for name, payload in (
        (MODULE.INDEX_FILE, index),
        (MODULE.PROGRAM_FILE, program),
        ("qwen25.json", artifact),
    ):
        (root / name).write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    lines = []
    for name in (MODULE.INDEX_FILE, MODULE.PROGRAM_FILE, "qwen25.json"):
        digest = hashlib.sha256((root / name).read_bytes()).hexdigest()
        lines.append(f"{digest}  {name}")
    (root / MODULE.CHECKSUM_FILE).write_text("\n".join(lines) + "\n")


def test_sync_renders_consumer_urls_and_detects_mirror_drift(tmp_path: Path) -> None:
    source = tmp_path / "source"
    target = tmp_path / "target"
    source.mkdir()
    write_publication(source)

    assert MODULE.sync_publication(source, target, check=False) == 0
    mirrored = json.loads((target / MODULE.INDEX_FILE).read_text(encoding="utf-8"))
    assert "data_file" not in mirrored["scenarios"][0]
    assert mirrored["scenarios"][0]["data_url"] == "./data/qwen25.json"
    assert mirrored["program_url"] == f"./data/{MODULE.PROGRAM_FILE}"
    assert (target / MODULE.PROGRAM_FILE).is_file()
    assert MODULE.sync_publication(source, target, check=True) == 0

    (target / "qwen25.json").write_text("{}\n", encoding="utf-8")
    assert MODULE.sync_publication(source, target, check=True) == 1


def test_sync_rejects_tampered_source(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    write_publication(source)
    artifact = json.loads((source / "qwen25.json").read_text(encoding="utf-8"))
    artifact["tampered"] = True
    (source / "qwen25.json").write_text(
        json.dumps(artifact, indent=2) + "\n", encoding="utf-8"
    )
    with pytest.raises(SystemExit, match="checksum mismatch"):
        MODULE.validate_source(source)
