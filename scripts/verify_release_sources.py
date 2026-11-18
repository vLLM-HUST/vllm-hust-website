"""Verify merged source identities before executing a publication build."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import time
import tomllib
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BENCHMARK = "vLLM-HUST/vllm-hust-benchmark"
WEBSITE = "vLLM-HUST/vllm-hust-website"


def revision(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("A full lowercase commit SHA is required")
    return value


def read_json(path):
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "vllm-hust-release-verification",
    }
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    request = Request("https://api.github.com/repos/" + path, headers=headers)
    for attempt in range(4):
        try:
            with urlopen(request, timeout=30) as response:
                result = json.load(response)
            if not isinstance(result, dict):
                raise ValueError("Unexpected GitHub source verification response")
            return result
        except HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 3:
                raise
        except (URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(2**attempt)


def merged_source(repository, commit, read=read_json, main=None):
    commit = revision(commit)
    main = revision(main or read(repository + "/commits/main")["sha"])
    comparison = read(repository + "/compare/" + commit + "..." + main)
    if (
        comparison.get("status") not in {"ahead", "identical"}
        or comparison.get("base_commit", {}).get("sha") != commit
        or comparison.get("merge_base_commit", {}).get("sha") != commit
    ):
        raise ValueError(f"Source is not merged into {repository} main: {commit}")
    return {
        "repository": repository,
        "revision": commit,
        "verified_main_revision": main,
    }


def verify_sources(pins, read=read_json, presentation=None):
    # Resolve one immutable main per repository for this verification receipt.
    main = revision(read(BENCHMARK + "/commits/main")["sha"])
    sources = {}
    for name in ("publication_revision", "visibility_policy_revision"):
        sources[name] = merged_source(BENCHMARK, pins[name], read, main)
    result = {"schema": "website-release-sources/v1", "sources": sources}
    if presentation is not None:
        result["presentation"] = merged_source(WEBSITE, presentation, read)
    result["verified_at"] = datetime.now(timezone.utc).isoformat()
    return result


def verify_checkout(expected, actual):
    if revision(expected) != revision(actual):
        raise ValueError("Presentation checkout differs from the triggering commit")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--benchmark-only", action="store_true")
    mode.add_argument("--presentation-revision")
    parser.add_argument(
        "--output", type=Path, default=ROOT / "output/release-sources.json"
    )
    args = parser.parse_args()
    if args.presentation_revision:
        actual = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip()
        verify_checkout(args.presentation_revision, actual)
    pins = tomllib.loads(
        (ROOT / ".github/benchmark-publication.toml").read_text(encoding="utf-8")
    )
    result = verify_sources(pins, presentation=args.presentation_revision)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(
        "Merged publication sources verified"
        + (" with exact presentation checkout" if args.presentation_revision else "")
    )


if __name__ == "__main__":
    main()
