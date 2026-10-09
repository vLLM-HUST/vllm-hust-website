"""Count matched completed-request input/output for API-equivalent value.

Usage: python scripts/serving_plan_accounting.py REQUESTS[.gz] --seconds 900 --chips 2
Never estimates input from median prompt length or aggregate cache-hit percentages.
"""

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path


def account(records, seconds, chips):
    if not math.isfinite(seconds) or seconds <= 0 or chips <= 0:
        raise ValueError(
            "Positive observation duration and allocated chip count required"
        )
    counts = dict(prompt=0, cached=0, new=0, output=0)
    completed = 0
    max_prompt = 0
    for row in records:
        if not row["success"]:
            raise ValueError("Failed requests: not a qualified plan")
        if (
            not math.isfinite(row["start"])
            or not math.isfinite(row["end"])
            or row["start"] < 0
            or row["end"] < row["start"]
        ):
            raise ValueError("Expected timestamps relative to measurement start")
        if row["end"] > seconds:
            continue
        usage = row["usage"]
        prompt = usage["prompt_tokens"]
        cached = usage["prompt_tokens_details"]["cached_tokens"]
        output = usage["completion_tokens"]
        if not all(isinstance(n, int) and n >= 0 for n in (prompt, cached, output)):
            raise ValueError("Nonnegative integer usage required")
        if cached > prompt or prompt != row["prompt_tokens"]:
            raise ValueError("Inconsistent input accounting")
        if usage["total_tokens"] != prompt + output:
            raise ValueError("Inconsistent total usage")
        completed += 1
        max_prompt = max(max_prompt, prompt)
        for key, value in zip(
            counts, (prompt, cached, prompt - cached, output), strict=True
        ):
            counts[key] += value
    if not completed:
        raise ValueError("No completed requests")
    return {
        "measurementSeconds": seconds,
        "chips": chips,
        "requests": completed,
        "maxPromptTokens": max_prompt,
        "counts": counts,
        "tokensPerSecondPerChip": {k: v / seconds / chips for k, v in counts.items()},
        "accounting": "Successful requests completed within observation window; excludes drain "
        "and incomplete-request output. Input and output use the same cohort. Not the "
        "leaderboard's streamed-output-window metric.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("requests", type=Path)
    parser.add_argument("--seconds", type=float, required=True)
    parser.add_argument("--chips", type=int, required=True)
    args = parser.parse_args()
    blob = args.requests.read_bytes()
    raw = gzip.decompress(blob) if args.requests.suffix == ".gz" else blob
    result = account(
        [json.loads(line) for line in raw.splitlines()], args.seconds, args.chips
    )
    result["sourceSha256"] = hashlib.sha256(raw).hexdigest()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
