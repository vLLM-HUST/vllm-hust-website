"""Exercise the pinned evidence adapter with a real, sealed local Git submission."""

import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_leaderboard_run_observations import build


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


@pytest.fixture(params=["", "./"])
def sealed_repo(tmp_path, request):
    git(tmp_path, "init", "-q")
    directory = tmp_path / "submissions" / "campaign"
    directory.mkdir(parents=True)
    (directory / "raw.json.gz").write_bytes(
        gzip.compress(
            json.dumps(
                {
                    "p95_ttft_ms": 12.5,
                    "p95_tpot_ms": 0,
                }
            ).encode()
        )
    )
    (directory / "repeats.json").write_text(
        json.dumps(
            [
                {
                    "entry_id": "run-1",
                    "metrics": {"ttft_ms": 10},
                    "metadata": {"raw_result": "raw.json.gz"},
                }
            ]
        )
    )
    (directory / "run_leaderboard.json").write_text(
        json.dumps(
            {
                "entry_id": "aggregate-1",
                "canonical_aggregate": {"count": 1},
            }
        )
    )
    (directory / "checksums.sha256").write_text(
        "".join(
            f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {request.param}{p.name}\n"
            for p in sorted(directory.iterdir())
        )
    )
    git(tmp_path, "add", "submissions")
    git(
        tmp_path,
        "-c",
        "user.name=Evidence test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-qm",
        "Seal evidence",
    )
    return tmp_path, directory


def test_preserves_raw_percentiles_and_commit_identity(sealed_repo):
    repo, _ = sealed_repo
    result = build(repo, "HEAD", "*")
    run = result["observations"]["aggregate-1"][0]
    assert run["metrics"] == {"ttft_ms": 10, "ttft_p95_ms": 12.5, "tpot_p95_ms": 0}
    assert git(repo, "rev-parse", "HEAD") in run["metadata"]["raw_evidence_url"]
    assert not git(repo, "status", "--porcelain")


def test_rejects_changed_worktree(sealed_repo):
    repo, directory = sealed_repo
    (directory / "raw.json.gz").write_bytes(b"changed")
    with pytest.raises(subprocess.CalledProcessError):
        build(repo, "HEAD", "*")


def test_rejects_untracked_submission(sealed_repo):
    repo, directory = sealed_repo
    extra = directory.parent / "unsealed"
    extra.mkdir()
    (extra / "repeats.json").write_text("[]")
    with pytest.raises(subprocess.CalledProcessError):
        build(repo, "HEAD", "unsealed")


def test_rejects_checksum_mismatch_in_committed_evidence(sealed_repo):
    repo, directory = sealed_repo
    (directory / "raw.json.gz").write_bytes(b"corrupt")
    git(repo, "add", "submissions")
    git(
        repo,
        "-c",
        "user.name=Evidence test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-qm",
        "Invalid seal",
    )
    with pytest.raises(ValueError, match="checksum mismatch"):
        build(repo, "HEAD", "*")
