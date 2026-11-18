"""Keep reviewed benchmark publication pins consistent across website workflows."""

import argparse
from pathlib import Path
import re
import tomllib

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / ".github/benchmark-publication.toml"
WORKFLOWS = (
    "ci.yml",
    "deploy-benchmark-pages.yml",
    "leaderboard-runs.yml",
    "midterm-browser.yml",
    "plugin-effects-browser.yml",
    "sync-plugin-workshop-metadata.yml",
)


def load_pins():
    pins = tomllib.loads(MANIFEST.read_text(encoding="utf-8"))
    for name in ("publication_revision", "visibility_policy_revision"):
        if not re.fullmatch(r"[0-9a-f]{40}", pins[name]):
            raise ValueError(f"{name} must be a full reviewed commit SHA")
    return pins


def render(source, pins):
    def checkout(match):
        block = match.group()
        if "repository: vLLM-HUST/vllm-hust-benchmark" not in block:
            return block
        policy = re.search(r"path: \.?publication-policy\s*$", block, re.M)
        revision = pins[
            "visibility_policy_revision" if policy else "publication_revision"
        ]
        updated, count = re.subn(
            r"(?m)^(\s+ref: )[0-9a-f]{40}(?=\s|$)",
            lambda item: item[1] + revision,
            block,
        )
        if count != 1:
            raise ValueError("Benchmark checkout must contain one pinned ref")
        return updated

    source = re.sub(r"(?ms)^      - .*?(?=^      - |^  [a-zA-Z]|\Z)", checkout, source)
    for argument, key in (
        ("--revision", "publication_revision"),
        ("--policy-revision", "visibility_policy_revision"),
    ):
        source = re.sub(
            rf"({argument}\s+)[0-9a-f]{{40}}",
            lambda match: match[1] + pins[key],
            source,
        )
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--write", action="store_true")
    args = parser.parse_args()
    pins = load_pins()
    changed = []
    for name in WORKFLOWS:
        path = ROOT / ".github/workflows" / name
        source = path.read_text(encoding="utf-8")
        expected = render(source, pins)
        if source != expected:
            changed.append(name)
            if args.write:
                path.write_text(expected, encoding="utf-8", newline="\n")
    if changed and args.check:
        raise SystemExit("Publication pins differ: " + ", ".join(changed))
    print("Publication workflow pins are consistent.")


if __name__ == "__main__":
    main()
