from __future__ import annotations

import json
from pathlib import Path

from scripts.sync_leaderboard_snapshots import (
    render_public_snapshot,
    sanitize_public_payload,
    sanitize_public_string,
)


def test_public_snapshot_sanitizer_preserves_traceable_relative_identity() -> None:
    assert (
        sanitize_public_string(
            "/home/user/vllm-hust-benchmark/docs/official-baselines/spec.json"
        )
        == "vllm-hust-benchmark/docs/official-baselines/spec.json"
    )
    assert (
        sanitize_public_string(
            "/home/user/.cache/huggingface/hub/models--Qwen--Model/snapshots/revision"
        )
        == "<huggingface-cache>/models--Qwen--Model/snapshots/revision"
    )
    assert (
        sanitize_public_string("/home/user/miniconda3/envs/runtime/bin/python")
        == "<python-environment>/bin/python"
    )
    assert sanitize_public_string("Qwen/Qwen2.5-14B-Instruct") == (
        "Qwen/Qwen2.5-14B-Instruct"
    )


def test_public_snapshot_sanitizer_recurses_without_mutating_input() -> None:
    source = {
        "metadata": {
            "runtime_provenance": {
                "python": "/home/user/miniconda3/envs/runtime/bin/python"
            }
        },
        "models": ["Qwen/model"],
    }
    sanitized = sanitize_public_payload(source)
    assert sanitized["metadata"]["runtime_provenance"]["python"] == (
        "<python-environment>/bin/python"
    )
    assert source["metadata"]["runtime_provenance"]["python"].startswith("/home/")


def test_render_public_snapshot_emits_stable_formatted_json(tmp_path: Path) -> None:
    source = tmp_path / "snapshot.json"
    source.write_text(
        json.dumps({"path": "/home/user/private/result.json"}), encoding="utf-8"
    )
    rendered = render_public_snapshot(source)
    assert rendered.endswith(b"\n")
    assert b"/home/" not in rendered
    assert json.loads(rendered) == {"path": "<local-path>/result.json"}
