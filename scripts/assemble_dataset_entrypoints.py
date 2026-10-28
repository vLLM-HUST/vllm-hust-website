"""Assemble the pinned canonical navigation asset; never commit website data."""

import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REVISION = "c3b4297b337802af8b767bd0b3a6533b4c5604c9"  # pragma: allowlist secret - canonical commit
SHA256 = "dd192122308172b42227d70c0c6cd92afe368b0f2daa99aa419dc99d6f8d1c01"  # pragma: allowlist secret - public metadata digest
SOURCE = "docs/dataset-entrypoints/dataset-entrypoints-v1.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", type=Path, help="Optional already fetched canonical file"
    )
    args = parser.parse_args()
    if args.source:
        raw = args.source.read_bytes()
    else:
        request = Request(
            f"https://api.github.com/repos/vLLM-HUST/vllm-hust-benchmark/contents/{SOURCE}?ref={REVISION}",
            headers={
                "Accept": "application/vnd.github.raw+json",
                "User-Agent": "vllm-hust-navigation-build",
            },
        )
        with urlopen(request, timeout=60) as response:
            raw = response.read(1_000_001)
    if len(raw) > 1_000_000 or hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError("Canonical navigation byte identity mismatch")
    data = json.loads(raw)
    if data["schema"] != "dataset-entrypoints/v1" or len(data["sources"]) != 118:
        raise ValueError("Canonical navigation schema mismatch")
    out = ROOT / "assets/data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "dataset-entrypoints-v1.json").write_bytes(raw)
    (out / "dataset-entrypoints-source.json").write_text(
        json.dumps(
            {
                "repository": "vLLM-HUST/vllm-hust-benchmark",
                "commit": REVISION,
                "path": SOURCE,
                "sha256": SHA256,
                "scope": "Separate navigation projection; existing experimental publication remains unchanged.",
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Navigation assembled: 118 sources, sha256={SHA256}")


if __name__ == "__main__":
    main()
