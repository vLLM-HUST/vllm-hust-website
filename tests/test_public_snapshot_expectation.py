"""The browser receipt follows the actual snapshot time rather than a frozen date."""

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "public_snapshot_browser", ROOT / "scripts/verify_public_pages_browser.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
NOW = 1794988800000  # 2026-11-18T08:00:00Z


@pytest.mark.parametrize(
    "timestamp,text,stale",
    [
        ("2026-11-18T08:00:00Z", "2026-11-18 08:00:00.000 UTC", False),
        ("2026-10-20T07:46:33Z", "2026-10-20 07:46:33.000 UTC", True),
        ("2026-11-19T08:00:00Z", "2026-11-19 08:00:00.000 UTC", True),
        ("2026-11-18T16:00:00+08:00", "2026-11-18 08:00:00.000 UTC", False),
        (None, "not verified", True),
        ("invalid", "not verified", True),
    ],
)
def test_expected_snapshot_state(timestamp, text, stale):
    assert MODULE.snapshot_expectation(timestamp, NOW, "en") == (text, stale)


def test_missing_chinese_snapshot_is_unverified():
    assert MODULE.snapshot_expectation(None, NOW, "zh") == ("未核验", True)
