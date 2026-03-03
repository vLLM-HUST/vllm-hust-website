#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
VERSION_META_PATH = ROOT_DIR / "data" / "version_meta.json"
README_PATH = ROOT_DIR / "README.md"
INDEX_PATH = ROOT_DIR / "index.html"
VERSIONS_PATH = ROOT_DIR / "versions.html"
ALLOWLIST_PATH = ROOT_DIR / "scripts" / "stale_version_allowlist.txt"

STALE_PATTERN = re.compile(r"v0\.[0-4]\b|\b0\.[0-4]\.\d+\.\d+\b")
QUICKSTART_VERSION_PATTERN = re.compile(r"Quick Start \(v(\d+\.\d+)\)")


def _load_allowlist_patterns() -> list[re.Pattern[str]]:
    if not ALLOWLIST_PATH.exists():
        return []

    patterns: list[re.Pattern[str]] = []
    for raw_line in ALLOWLIST_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        patterns.append(re.compile(line))
    return patterns


def _is_allowlisted(line: str, allowlist: list[re.Pattern[str]]) -> bool:
    return any(pattern.search(line) for pattern in allowlist)


def _find_stale_references(
    file_path: Path, allowlist: list[re.Pattern[str]]
) -> list[str]:
    violations: list[str] = []
    for line_no, line in enumerate(
        file_path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if STALE_PATTERN.search(line) and not _is_allowlisted(line, allowlist):
            violations.append(
                f"{file_path.relative_to(ROOT_DIR)}:{line_no}: {line.strip()}"
            )
    return violations


def _load_meta() -> dict:
    return json.loads(VERSION_META_PATH.read_text(encoding="utf-8"))


def _extract_quickstart_minor(title: str) -> str:
    match = QUICKSTART_VERSION_PATTERN.search(title)
    if not match:
        raise RuntimeError(
            "quickstart.title_zh in version_meta.json must contain 'Quick Start (vX.Y)'"
        )
    return match.group(1)


def _check_consistency(meta: dict) -> list[str]:
    errors: list[str] = []
    release = meta.get("release", {}) if isinstance(meta, dict) else {}
    quickstart = meta.get("quickstart", {}) if isinstance(meta, dict) else {}

    headline = release.get("headline_zh", "")
    message = release.get("message_zh", "")
    quickstart_title = quickstart.get("title_zh", "")
    description = quickstart.get("description_zh", "")

    for field_name, value in {
        "release.headline_zh": headline,
        "release.message_zh": message,
        "quickstart.title_zh": quickstart_title,
        "quickstart.description_zh": description,
    }.items():
        if not isinstance(value, str) or not value.strip():
            errors.append(f"Missing required field: {field_name}")

    readme_text = README_PATH.read_text(encoding="utf-8")
    index_text = INDEX_PATH.read_text(encoding="utf-8")
    versions_text = VERSIONS_PATH.read_text(encoding="utf-8")

    if headline and headline not in readme_text:
        errors.append(
            "README.md does not include release.headline_zh from version_meta.json"
        )
    if message and message not in readme_text:
        errors.append(
            "README.md does not include release.message_zh from version_meta.json"
        )
    if quickstart_title and quickstart_title.replace("🚀 ", "") not in readme_text:
        errors.append(
            "README.md does not include quickstart.title_zh from version_meta.json"
        )
    if description and "Version Metadata Maintenance" not in readme_text:
        errors.append("README.md is missing version metadata maintenance section")

    if 'id="release-banner-title"' not in index_text:
        errors.append("index.html is missing release banner placeholder")
    if 'id="quickstart-title"' not in index_text:
        errors.append("index.html is missing quickstart title placeholder")
    if "./assets/version-meta-loader.js" not in index_text:
        errors.append("index.html is missing version-meta-loader.js")

    if "./assets/versions-page.js" not in versions_text:
        errors.append("versions.html is missing versions-page.js")

    if isinstance(quickstart_title, str) and quickstart_title:
        minor = _extract_quickstart_minor(quickstart_title)
        umbrella_version = ""
        for package in meta.get("packages", []):
            if isinstance(package, dict) and package.get("pypi_name") == "isagellm":
                version = package.get("version", "")
                if isinstance(version, str):
                    umbrella_version = version
                break

        if umbrella_version and not umbrella_version.startswith(f"{minor}."):
            errors.append(
                "quickstart.title_zh major.minor does not match isagellm package version in version_meta.json"
            )

    return errors


def main() -> None:
    allowlist = _load_allowlist_patterns()

    violations: list[str] = []
    for target in (INDEX_PATH, README_PATH, VERSIONS_PATH, VERSION_META_PATH):
        violations.extend(_find_stale_references(target, allowlist))

    try:
        meta = _load_meta()
        violations.extend(_check_consistency(meta))
    except Exception as error:  # noqa: BLE001
        violations.append(f"Failed consistency check: {error}")

    if violations:
        print("❌ Stale-version check failed:")
        for item in violations:
            print(f" - {item}")
        sys.exit(1)

    print("✅ Stale-version check passed.")


if __name__ == "__main__":
    main()
