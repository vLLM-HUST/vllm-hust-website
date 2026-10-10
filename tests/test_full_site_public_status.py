from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def public_text_files() -> list[Path]:
    files = [ROOT / "README.md", *ROOT.glob("*.html")]
    files.extend((ROOT / "assets").glob("*.js"))
    files.extend((ROOT / "data").glob("*.json"))
    files.extend((ROOT / "data").glob("*.md"))
    return sorted(files)


def test_retired_szyn_partial_progress_is_absent_from_every_public_surface() -> None:
    stale_markers = (
        "1 / 500",
        "1/500",
        "remaining 499",
        "其余 499",
        "single-case qualification",
    )
    for path in public_text_files():
        text = path.read_text(encoding="utf-8")
        for marker in stale_markers:
            assert marker not in text, f"{path.relative_to(ROOT)} retains {marker!r}"


def test_public_copy_names_configuration_differences_instead_of_historical_buckets() -> (
    None
):
    misleading_labels = (
        "Closed items · historical evidence",
        "已关闭议题 · 历史记录",
        "Historical result detected",
        "检测到历史结果",
        "Historical records available",
        "可查看历史记录",
        "historical 0.23 lane",
        "historical PyPI package",
        "历史 PyPI 包",
        "historical throughput charts",
        "历史吞吐图",
    )
    for path in public_text_files():
        text = path.read_text(encoding="utf-8")
        for label in misleading_labels:
            assert label not in text, f"{path.relative_to(ROOT)} retains {label!r}"


def test_all_top_level_pages_are_included_in_the_status_copy_audit() -> None:
    pages = {path.name for path in ROOT.glob("*.html")}
    audited = {
        path.name
        for path in public_text_files()
        if path.parent == ROOT and path.suffix == ".html"
    }
    assert audited == pages
