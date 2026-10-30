"""Assemble the pinned canonical navigation asset; never commit website data."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REVISION = "a181a5e94414bca9b51bb89e5ce2da6bdcef38ce"  # pragma: allowlist secret - canonical commit
SHA256 = "7cdb80726122cf1d73e93c3da2c16d580ca1181f6b948b666b0f7d9bb640f187"  # pragma: allowlist secret - public metadata digest
SOURCE = "docs/dataset-entrypoints/dataset-entrypoints-v1.json"
TERMINAL_REVISION = "d31b20c3b4f1dae120fe7fb5e62dac9f83433716"  # pragma: allowlist secret - public canonical commit
TERMINAL_SHA256 = "e0c4c9554b096d9ac9cd66d5126e686ac1724c372ca3d3b14b588befca624d15"  # pragma: allowlist secret - public evidence digest
TERMINAL_SOURCE = "docs/terminal-arm64-acceptance/acceptance-v1.json"


def github_headers():
    headers = {
        "Accept": "application/vnd.github.raw+json",
        "User-Agent": "vllm-hust-navigation-build",
    }
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", type=Path, help="Optional already fetched canonical file"
    )
    parser.add_argument(
        "--terminal-source",
        type=Path,
        help="Already fetched canonical Terminal acceptance",
    )
    args = parser.parse_args()
    if args.source:
        raw = args.source.read_bytes()
    else:
        request = Request(
            f"https://api.github.com/repos/vLLM-HUST/vllm-hust-benchmark/contents/{SOURCE}?ref={REVISION}",
            headers=github_headers(),
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
    if args.terminal_source:
        terminal_raw = args.terminal_source.read_bytes()
    else:
        request = Request(
            f"https://api.github.com/repos/vLLM-HUST/vllm-hust-benchmark/contents/{TERMINAL_SOURCE}?ref={TERMINAL_REVISION}",
            headers=github_headers(),
        )
        with urlopen(request, timeout=60) as response:
            terminal_raw = response.read(100_001)
    if (
        len(terminal_raw) > 100_000
        or hashlib.sha256(terminal_raw).hexdigest() != TERMINAL_SHA256
    ):
        raise ValueError("Canonical Terminal acceptance byte identity mismatch")
    terminal = json.loads(terminal_raw)
    if (
        terminal["schema"] != "terminal-arm64-user-acceptance/v1"
        or terminal["task_id"] != "openssl-selfsigned-cert"
    ):
        raise ValueError("Canonical Terminal acceptance schema mismatch")
    (out / "terminal-arm64-acceptance-v1.json").write_bytes(terminal_raw)
    (out / "terminal-arm64-acceptance-source.json").write_text(
        json.dumps(
            {
                "repository": "vLLM-HUST/vllm-hust-benchmark",
                "commit": TERMINAL_REVISION,
                "path": TERMINAL_SOURCE,
                "sha256": TERMINAL_SHA256,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Navigation assembled: 118 sources, sha256={SHA256}")


if __name__ == "__main__":
    main()
