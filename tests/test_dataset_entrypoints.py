"""The navigation is a source directory, never an implicit execution claim."""

import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "assets/data/dataset-entrypoints-v1.json").read_text())


def test_full_source_directory_and_registration_boundary():
    rows = DATA["sources"]
    assert len(rows) == len({r["source_id"] for r in rows}) == 118
    assert DATA["counts"]["classes"] == 40
    assert DATA["counts"]["separate_assets"] == 15
    assert sum(r["provider_registered"] for r in rows) == 104
    for row in rows:
        assert bool(row["download_plan_command"]) == row["provider_registered"]
        assert row["source_plan_command"].endswith(row["source_id"])


def test_independent_clients_overlay_empty_provider_entries():
    guides = {x["source_id"] for x in DATA["primary_entries"]}
    assert guides == {
        "MMLU_PRO",
        "HLE_VERIFIED",
        "FRONTIERSCIENCE",
        "SWE_BENCH_PRO",
        "TERMINAL_BENCH_2_1",
    }
    assert {r["guide_id"] for r in DATA["sources"] if r["guide_id"]} == guides
    assert "platform_api" not in DATA
    assert DATA["new_measurements"] == 0


def test_real_page_not_redirect_and_three_layers():
    html = (ROOT / "dataset-introductions.html").read_text()
    assert 'http-equiv="refresh"' not in html
    assert '<span class="brand-mark">V</span>' in html
    for anchor in ("ordinary", "special", "sandbox", "all-sources"):
        assert f'id="{anchor}"' in html
    assert "./dataset-introductions.html" in (ROOT / "index.html").read_text()
    js = (ROOT / "assets/dataset-entrypoints.js").read_text()
    assert "scoring=NOT_RUN" in js
    assert "request_replay" in js
    assert "harbor run -c" in json.dumps(DATA)
    assert "bootstrap_swe_bench_pro.py?ref=${AGENT_REV}" in js
    assert "--source-revision ${AGENT_REV}" in js


def test_public_projection_has_no_operational_private_paths():
    raw = json.dumps(DATA)
    for forbidden in (
        "/root/",
        "/swe-persist/",
        "10.244.",
        "all_messages",
        "client-complete.json",
    ):
        assert forbidden not in raw
    assert all("request_body" not in row for row in DATA["sources"])


def test_canonical_navigation_copy_identity():
    identity = json.loads(
        (ROOT / "assets/data/dataset-entrypoints-source.json").read_text()
    )
    assert (
        hashlib.sha256(
            (ROOT / "assets/data/dataset-entrypoints-v1.json").read_bytes()
        ).hexdigest()
        == identity["sha256"]
    )
    assert identity["path"] == "docs/dataset-entrypoints/dataset-entrypoints-v1.json"


def test_coder_guide_has_one_user_workflow_without_unrelated_api_warning():
    js = (ROOT / "assets/dataset-entrypoints.js").read_text()
    for content in (js, json.dumps(DATA)):
        assert "BLOCKED_" + "NOT_INTEGRATED" not in content
    assert "普通用户生产身份链路未接通" not in js
    assert "请 ops 准备 CPU 执行工作区" not in js
    assert "1. 创建自己的 Coder CPU 工作区" in js
    assert "平台助手（可选）" in js
