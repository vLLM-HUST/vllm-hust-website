"""Import the public FrontierScience report, preserving original seal bytes."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import tarfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("report_dir", type=Path)
    parser.add_argument(
        "--output", type=Path, default=Path("data/frontierscience-20261013")
    )
    args = parser.parse_args()
    report_bytes = (args.report_dir / "report.json").read_bytes()
    report = json.loads(report_bytes)
    assert report["summary"]["scope"] == "full_gold"
    assert report["formal_acceptance"] is False
    assert report["paired_b1"] is None
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.json").write_bytes(report_bytes)
    runtime_bytes = (
        json.dumps(report["runtime"], indent=2, ensure_ascii=False) + "\n"
    ).encode()
    (out / "runtime.json").write_bytes(runtime_bytes)
    with tarfile.open(args.report_dir / "selected-evidence.tar.gz") as archive:
        table = archive.extractfile("results/frontierscience-results.md").read()
        original_manifest = archive.extractfile("MANIFEST.json").read()
    binding = report["original_binding"]
    assert sha(table) == binding["table_sha256"]
    assert sha(original_manifest) == binding["manifest_sha256"]
    (out / "result-table.md.gz").write_bytes(gzip.compress(table, mtime=0))
    (out / "original-manifest.json.gz").write_bytes(
        gzip.compress(original_manifest, mtime=0)
    )
    names = [
        "report.json",
        "runtime.json",
        "result-table.md.gz",
        "original-manifest.json.gz",
    ]
    manifest = {
        "schema": 1,
        "run_id": report["run_id"],
        "original_binding": binding,
        "source_report_sha256": sha(report_bytes),
        "publication_archive_sha256": sha(
            (args.report_dir / "selected-evidence.tar.gz").read_bytes()
        ),
        "files": {
            name: {"published_sha256": sha((out / name).read_bytes())} for name in names
        },
        "note": "Plain SHA-256, not a signature or formal acceptance. Gzip preserves exact original result-table and seal-manifest bytes.",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
