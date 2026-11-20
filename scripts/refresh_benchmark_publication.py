"""Advance publication locks to a merged benchmark revision with passing CI."""

import argparse
from pathlib import Path
import re
import tomllib

from update_benchmark_publication import WORKFLOWS, render
from verify_release_sources import BENCHMARK, WEBSITE, read_json, revision

ROOT = Path(__file__).resolve().parents[1]
SOURCE_CHECKS = {"lint", "tests", "cpu-correctness"}
WEBSITE_CHECKS = {
    "validate",
    "browser",
    "No data PRs in website",
    "version-source-guard",
}


def checks_pass(payload, required):
    if payload.get("total_count", 0) > 100:
        return False
    latest = {}
    for check in payload.get("check_runs", []):
        if check.get("app", {}).get("slug") != "github-actions":
            continue
        name = check["name"]
        if name not in latest or check["id"] > latest[name]["id"]:
            latest[name] = check
    return required <= latest.keys() and all(
        check["status"] == "completed"
        and check["conclusion"]
        in ({"success"} if name in required else {"success", "skipped"})
        for name, check in latest.items()
    )


def reviewed_source(read=read_json):
    head = revision(read(BENCHMARK + "/commits/main")["sha"])
    checks = read(BENCHMARK + "/commits/" + head + "/check-runs?per_page=100")
    return head if checks_pass(checks, SOURCE_CHECKS) else None


def advance(root, candidate):
    candidate = revision(candidate)
    path = root / ".github/benchmark-publication.toml"
    text = path.read_text()
    for key in ("publication_revision", "visibility_policy_revision"):
        text, count = re.subn(
            rf'(?m)^({key}\s*=\s*")[a-f0-9]{{40}}(")',
            lambda match: match[1] + candidate + match[2],
            text,
        )
        if count != 1:
            raise ValueError("Expected one source lock: " + key)
    pins = tomllib.loads(text)
    # Validate every consumer before changing any file.
    outputs = [(path, text)]
    for name in WORKFLOWS:
        workflow = root / ".github/workflows" / name
        outputs.append((workflow, render(workflow.read_text(), pins)))
    for destination, content in outputs:
        destination.write_text(content, encoding="utf-8", newline="\n")


def check_pr_head(number, expected, read=read_json):
    pull = read(WEBSITE + "/pulls/" + str(number))
    if pull["base"]["ref"] != "main" or pull["head"]["sha"] != revision(expected):
        raise ValueError("Publication PR changed while CI was running")
    if not checks_pass(
        read(WEBSITE + "/commits/" + expected + "/check-runs?per_page=100"),
        WEBSITE_CHECKS,
    ):
        raise ValueError("Current publication PR checks have not passed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-pr", type=int)
    parser.add_argument("--expected-head")
    args = parser.parse_args()
    if args.check_pr:
        check_pr_head(args.check_pr, args.expected_head)
        print("Current publication PR head and checks verified")
    else:
        candidate = reviewed_source()
        if candidate is None:
            print("Latest benchmark main is still awaiting successful source CI")
            return
        advance(ROOT, candidate)
        print("Prepared source and policy locks for merged benchmark " + candidate)


if __name__ == "__main__":
    main()
