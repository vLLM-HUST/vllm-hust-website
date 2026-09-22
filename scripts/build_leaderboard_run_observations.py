#!/usr/bin/env python3
"""Build the review page's per-run evidence supplement from sealed submissions.

Read-only with respect to the benchmark repository and existing site snapshots.
Percentiles come from each raw run, never from averaging repeat percentiles.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

from sync_leaderboard_snapshots import sanitize_public_payload


def build(repo: Path, revision: str, pattern: str) -> dict:
    commit = subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", f"{revision}^{{commit}}"], text=True
    ).strip()
    subprocess.run(
        ["git", "-C", str(repo), "diff", "--exit-code", commit, "--", "submissions"],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    observations = {}
    for directory in sorted((repo / "submissions").glob(pattern)):
        if not (directory / "repeats.json").is_file():
            continue
        relative = directory.relative_to(repo).as_posix()
        # Verify the sealing manifest against the pinned Git object, not just a
        # potentially untracked directory that happens to have checksum files.
        sealed = subprocess.check_output(
            ["git", "-C", str(repo), "show", f"{commit}:{relative}/checksums.sha256"]
        )
        covered = set()
        for line in sealed.decode().splitlines():
            digest, name = line.split("  ", 1)
            path = (directory / name).resolve()
            if not path.is_relative_to(directory.resolve()):
                raise ValueError("Evidence path escapes sealed submission")
            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise ValueError(f"Evidence checksum mismatch: {path.name}")
            covered.add(path.relative_to(directory.resolve()).as_posix())
        if not {"repeats.json", "run_leaderboard.json"} <= covered:
            raise ValueError("Unsealed repeat manifest")
        aggregate = json.loads((directory / "run_leaderboard.json").read_text())
        runs = json.loads((directory / "repeats.json").read_text())
        if len(runs) != aggregate["canonical_aggregate"]["count"]:
            raise ValueError("Incomplete repeat evidence")
        for run in runs:
            filename = run["metadata"]["raw_result"]
            if filename not in covered or not (
                directory / filename
            ).resolve().is_relative_to(directory.resolve()):
                raise ValueError("Unsealed raw result")
            raw = json.loads(gzip.decompress((directory / filename).read_bytes()))
            # Do not reinterpret long-context constraints as run-wide percentiles.
            for output, original in (
                ("ttft_p95_ms", "p95_ttft_ms"),
                ("tpot_p95_ms", "p95_tpot_ms"),
            ):
                run["metrics"][output] = raw.get(original)
            run["metadata"]["raw_evidence_url"] = (
                f"https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/{commit}/"
                f"{relative}/{filename}"
            )
            run["metadata"]["evidence_manifest_url"] = (
                f"https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/{commit}/"
                f"{relative}/repeats.json"
            )
            run["metadata"]["percentile_basis"] = "per-run request distribution"
        observations[aggregate["entry_id"]] = sanitize_public_payload(runs)
    if not observations:
        raise ValueError("No sealed repeat submissions selected")
    return {
        "schema_version": "leaderboard-run-observations/v1",
        "source_commit": commit,
        "observations": observations,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark-repo", type=Path, required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--pattern", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    payload = build(args.benchmark_repo.resolve(), args.revision, args.pattern)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(
        f"Preserved {sum(map(len, payload['observations'].values()))} independent runs"
    )


if __name__ == "__main__":
    main()
