"""Import the HLE public report and byte-identical result tables/seal manifests."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import tarfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("report_dir", type=Path)
    p.add_argument("--output", type=Path, default=Path("data/hle-verified-20261015"))
    a = p.parse_args()
    report_bytes = (a.report_dir / "report.json").read_bytes()
    report = json.loads(report_bytes)
    assert report["formal_acceptance"] is False
    a.output.mkdir(parents=True, exist_ok=True)
    (a.output / "report.json").write_bytes(report_bytes)
    (a.output / "runtime.json").write_text(
        json.dumps(report["runtime"], indent=2) + "\n"
    )
    names = ["report.json", "runtime.json"]
    for label, binding in report["bindings"].items():
        with tarfile.open(a.report_dir / (label + "-evidence.tar.gz")) as tf:
            for suffix, member, key in [
                ("table.md", "results/" + binding["table_path"], "table_sha256"),
                ("manifest.json", "MANIFEST.json", "manifest_sha256"),
            ]:
                raw = tf.extractfile(member).read()
                assert sha(raw) == binding[key]
                name = label + "-" + suffix + ".gz"
                (a.output / name).write_bytes(gzip.compress(raw, mtime=0))
                names.append(name)
    manifest = {
        "schema": 1,
        "run_id": report["run_id"],
        "bindings": report["bindings"],
        "source_report_sha256": sha(report_bytes),
        "files": {n: {"sha256": sha((a.output / n).read_bytes())} for n in names},
        "note": "Three independent original seals. Gzip preserves original table/manifest bytes; plain hashes, not signatures.",
    }
    (a.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
