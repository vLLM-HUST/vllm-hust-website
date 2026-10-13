"""Import public summary files from the 2026-10-12 MMLU-Pro handoff."""

import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dir", type=Path)
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[1] / "data/mmlu-pro-20261012"
    destination.mkdir(exist_ok=True)
    sources = {
        "accuracy.json": "outputs/mmlu-pro-accuracy/summary.json",
        "performance.json": "outputs/mmlu-pro.summary.json",
        "report.json": "summary.report.json",
    }
    hashes = {}
    for name, relative in sources.items():
        raw = (args.run_dir / relative).read_bytes()
        data = json.loads(raw)
        # The known handoff summaries contain counts/configuration, not raw prompts,
        # responses, environment variables or host receipts.
        if name == "accuracy.json":
            assert data["cases"] == 12032 and data["correct"] == 9609
        elif name == "performance.json":
            assert data["completed"] == data["num_prompts"] == 200
        else:
            assert data["accuracy"]["cases"] == 12032
            assert sum(x["n"] for x in data["per_category"].values()) == 12032
            assert sum(x["correct"] for x in data["per_category"].values()) == 9609
        published = (json.dumps(data, indent=2) + "\n").encode("utf-8")
        (destination / name).write_bytes(published)
        hashes[name] = {
            "source_relative_path": relative,
            "source_sha256": hashlib.sha256(raw).hexdigest(),
            "published_sha256": hashlib.sha256(published).hexdigest(),
        }
    relative = "receipt/effective.reparse.json"
    raw = (args.run_dir / relative).read_bytes()
    receipt = json.loads(raw)
    runtime = {
        "run_id": args.run_dir.name,
        "source_kind": "post-hoc-startup-receipt-reparse",
        "generated_utc": receipt["post_hoc"]["generated_utc"],
        "startup_log_sha256": receipt["post_hoc"]["startup_log_sha256"],
        "fields": {
            key: {"value": field["log"], "status": "verified"}
            for key, field in receipt["fields"].items()
            if field.get("status") == "verified" and "log" in field
        },
    }
    published = (json.dumps(runtime, indent=2) + "\n").encode("utf-8")
    (destination / "runtime.json").write_bytes(published)
    hashes["runtime.json"] = {
        "source_relative_path": relative,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "published_sha256": hashlib.sha256(published).hexdigest(),
    }
    manifest = {
        "schema_version": 1,
        "source_kind": "operator-supplied-summary-handoff",
        "run_id": args.run_dir.name,
        "measurement_date": "2026-10-12",
        "model": "Qwen3.5-35B-A3B",
        "variant": "B0",
        "formal_acceptance": False,
        "paired_b1": None,
        "files": hashes,
    }
    (destination / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
