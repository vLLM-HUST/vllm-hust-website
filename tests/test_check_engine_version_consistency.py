from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


SCRIPT = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "check_engine_version_consistency.py"
)


def _write_snapshot(data_dir: Path, filename: str, entries: list[dict]) -> Path:
    path = data_dir / filename
    path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    return path


def _run(data_dir: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--data-dir",
            str(data_dir),
        ],
        capture_output=True,
        text=True,
        check=False,
    )


def _entry(
    entry_id: str,
    *,
    engine: str = "vllm-hust",
    engine_version: str = "v0.18.0.post1",
    git_commit: str = "ceec19abb0f1b5b5e4f1bcfc0d1f1d2b7aa8a4a3",  # pragma: allowlist secret
    throughput_tps: float = 1.0,
) -> dict:
    return {
        "entry_id": entry_id,
        "engine": engine,
        "engine_version": engine_version,
        "metrics": {"throughput_tps": throughput_tps},
        "metadata": {
            "engine": engine,
            "engine_version": engine_version,
            "git_commit": git_commit,
        },
    }


def test_check_passes_when_dev_build_sha_matches_git_commit(tmp_path: Path) -> None:
    _write_snapshot(
        tmp_path,
        "leaderboard_single.json",
        [
            _entry(
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                engine_version="v0.20.1rc0-535-gceec19abb0",
                git_commit="ceec19abb0f1b5b5e4f1bcfc0d1f1d2b7aa8a4a3",  # pragma: allowlist secret
            )
        ],
    )
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "errors=0" in result.stdout
    assert "WARNING" not in result.stdout


def test_check_fails_when_dev_build_sha_disagrees_with_git_commit(
    tmp_path: Path,
) -> None:
    _write_snapshot(
        tmp_path,
        "leaderboard_single.json",
        [
            _entry(
                "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                engine_version="v0.20.1rc0-535-gdeadbeef00",
                git_commit="ceec19abb0f1b5b5e4f1bcfc0d1f1d2b7aa8a4a3",  # pragma: allowlist secret
            )
        ],
    )
    result = _run(tmp_path)
    assert result.returncode == 1, result.stdout
    assert "ERROR" in result.stdout
    assert "deadbeef00" in result.stdout
    assert "ceec19abb" in result.stdout
    assert "errors=1" in result.stdout


def test_check_warns_when_release_and_dev_build_share_git_commit(
    tmp_path: Path,
) -> None:
    git_commit = "2fb7859dd0c1ce5a62f8db1d4fb1f1f8b0af3a1c"  # pragma: allowlist secret
    _write_snapshot(
        tmp_path,
        "leaderboard_single.json",
        [
            _entry(
                "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                engine_version="0.18.0.post1",
                git_commit=git_commit,
                throughput_tps=100.0,
            ),
            _entry(
                "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                engine_version="v0.20.1rc0-521-g2fb7859dd0",
                git_commit=git_commit,
                throughput_tps=50.0,
            ),
        ],
    )
    result = _run(tmp_path)
    # Warnings must NOT cause a failure (executive policy: option A, warn only).
    assert result.returncode == 0, result.stdout
    assert "WARNING" in result.stdout
    assert "warnings=2" in result.stdout  # one per co-existing entry
    assert "errors=0" in result.stdout


def test_check_ignores_vllm_baseline_entries(tmp_path: Path) -> None:
    _write_snapshot(
        tmp_path,
        "leaderboard_single.json",
        [
            _entry(
                "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                engine="vllm",
                engine_version="0.18.0",
                git_commit="e18643f8a4d5bd9990727654318ad069ea0b56e2",  # pragma: allowlist secret
            ),
            _entry(
                "ffffffff-ffff-4fff-8fff-ffffffffffff",
                engine="vllm",
                engine_version="0.18.0",
                git_commit="0000000000000000000000000000000000000000",
            ),
        ],
    )
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "errors=0" in result.stdout
    assert "WARNING" not in result.stdout


def test_check_handles_missing_data_dir(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"
    result = _run(missing)
    assert result.returncode == 2
    assert "data dir not found" in result.stderr
