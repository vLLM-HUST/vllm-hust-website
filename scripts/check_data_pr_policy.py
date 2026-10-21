"""Reject website data PRs; all result data belongs in vllm-hust-benchmark."""

import argparse
import json
from pathlib import PurePosixPath

DATA_PREFIXES = ("data/", "reports/", "docs/evidence/", "op01-evidence/")
DATA_SUFFIXES = (".csv", ".tsv", ".jsonl", ".parquet", ".arrow")
DESTINATION = "https://github.com/vLLM-HUST/vllm-hust-benchmark"


def is_data_path(filename):
    path = str(PurePosixPath(filename)).lower()
    if path.startswith(DATA_PREFIXES):
        return True
    # Synthetic regression fixtures are code-test inputs, not published results.
    if path.startswith("tests/fixtures/"):
        return False
    return path.endswith(DATA_SUFFIXES)


def prohibited_paths(pages):
    return sorted(
        {
            filename
            for page in pages
            for change in page
            for filename in (change["filename"], change.get("previous_filename", ""))
            if filename and is_data_path(filename)
        }
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file_list", help="gh api --paginate --slurp PR files JSON")
    parser.add_argument("--expected-count", type=int, required=True)
    args = parser.parse_args()
    with open(args.file_list, encoding="utf-8") as stream:
        pages = json.load(stream)
    count = sum(len(page) for page in pages)
    if count != args.expected_count:
        raise SystemExit("Incomplete PR file list; split the PR before review.")
    blocked = prohibited_paths(pages)
    if blocked:
        print("网站仓库不接受数据 PR（包括新增、修改、删除和移动数据）。")
        print(f"请把数据、实验结果、证据和元数据提交到 {DESTINATION}")
        print("Website PRs must contain presentation/code changes only.")
        print("No author, label or bot exemption applies.")
        for filename in blocked:
            print(json.dumps(filename, ensure_ascii=False))
        raise SystemExit(1)
    print("PASS: no published data or evidence files changed.")


if __name__ == "__main__":
    main()
