import hashlib
from pathlib import Path


def test_published_crane_matches_frozen_official_arm64_release():
    archive = (
        Path(__file__).resolve().parents[1]
        / "downloads/swe-bench-pro/crane-v0.20.3-linux-arm64.tar.gz"
    )
    assert archive.stat().st_size == 14012994
    assert (
        hashlib.sha256(archive.read_bytes()).hexdigest()
        == "d2235f7779cd39c6e40f43701d2512c997409f629fb53e621ede0d57d3f995e2"
    )
