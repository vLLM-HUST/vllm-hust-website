import hashlib
import json
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]


def test_flipt_raw_failures_and_parser_coverage_are_disclosed():
    data = json.loads((ROOT / "data/midterm-v092.json").read_text())
    section = next(
        s for s in data["sections"] if s["id"] == "swe-single-agent-observation"
    )
    assert "14通过、2失败" in section["scope"]
    assert "2个包初始化失败" in section["scope"]
    assert "实际执行并失败" in section["scope"]
    assert "14 passed, 2 failed" in section["scope_en"]
    assert "2 package setup failures" in section["scope_en"]
    assert "target executed and failed" in section["scope_en"]
    assert section["evidence"][0]["path"] == (
        "reports/swe-native018-navidrome-20261027/catalog.json"
    )


def test_current_and_retained_swe_evidence_paths_remain_allowed():
    data = json.loads((ROOT / "data/midterm-v092.json").read_text())
    loader = (ROOT / "assets/midterm-report.js").read_text()
    for section in data["sections"]:
        for source in section["evidence"]:
            if source["path"].startswith("reports/swe-native018-"):
                assert repr(source["path"]) in loader


def test_c16_latency_is_existing_request_weighted_evidence():
    data = json.loads((ROOT / "data/midterm-v092.json").read_text())
    value = data["c16_equal_request_latency"]
    assert value["new_inference_requests"] == 0
    assert [arm["window"]["requests"] for arm in value["arms"]] == [392, 1280]
    assert [arm["including_drain"]["requests"] for arm in value["arms"]] == [408, 1296]
    assert value["method"]["weighting"] == "equal weight per successful request"
    section = next(s for s in data["sections"] if s["id"] == "c16-request-latency")
    assert section["tables"][0]["rows"] == section["tables_en"][0]["rows"]
    assert "质量/SLO" in section["scope"]
    assert "not full acceptance" in section["scope_en"]
    assert (
        section["evidence"][0]["path"]
        in (ROOT / "assets/midterm-report.js").read_text()
    )


def test_hle_completion_and_swe_single_attempt_are_not_full_acceptance():
    data = json.loads((ROOT / "data/midterm-v092.json").read_text())
    assert data["hle_designated_baseline"]["gold"]["successes"] == 157
    assert data["hle_designated_baseline"]["revision"]["successes"] == 316
    swe = data["swe_single_agent"]
    assert swe["executed_tasks"] == 1 and swe["resolved"] == 0
    assert swe["qualification"]["model_calls"] == 5
    assert swe["agent"]["status"] == "LimitsExceeded"
    assert swe["unresolved_grading"] == 0 and not swe["full_dataset_acceptance"]
    sections = {s["id"]: s for s in data["sections"]}
    for key in ("tables", "tables_en"):
        rows = {row[0]: row for row in sections["v15-remaining"][key][0]["rows"]}
        assert "23/31" in rows["HLE-Verified"][1]
        assert "2/15" in rows["SWE-bench-Pro"][1]
    catalog = data["swe_incremental_tasks"]
    assert catalog["attempted_unique_tasks"] == 15
    assert catalog["confirmed_patch_application_failure_tasks"] == 2
    assert catalog["unattempted_tasks"] == 716
    assert catalog["application_evidence_limited_tasks"] == 1
    assert catalog["recorded_official_resolved"] == 2
    for key in ("tables", "tables_en"):
        assert len(sections["swe-single-agent-observation"][key][0]["rows"]) == 15
    assert catalog["confirmed_target_compilation_failure_tasks"] == 1
    assert catalog["entries"][-1]["official_resolved"] == 0
    terminal = data["terminal_arm64_controls"]
    assert terminal["model_calls"] == terminal["official_89_task_model_coverage"] == 0
    assert [(c["passed"], c["reward"]) for c in terminal["controls"]] == [
        (0, 0),
        (6, 1),
    ]
    for key in ("tables", "tables_en"):
        assert len(sections["terminal-arm64-controls"][key][0]["rows"]) == 2
        assert len(sections["terminal-model-recovery"][key][0]["rows"]) == 2
    cancel = data["terminal_cancel_controls"]
    assert cancel["model_calls"] == cancel["model_task_attempts"] == 0
    assert [(c["passed"], c["reward"]) for c in cancel["controls"]] == [(0, 0), (6, 1)]
    for key in ("tables", "tables_en"):
        assert len(sections["terminal-cancel-async-controls"][key][0]["rows"]) == 2
    recovered = data["terminal_model_recovery"]
    assert recovered["model_task_attempts"] == recovered["scored_model_tasks"] == 1
    assert recovered["recovery"]["passed"] == 6 and recovered["unattempted_tasks"] == 88
    assert recovered["original_verifier"]["reward"] is None
    assert recovered["recovery"]["additional_model_calls"] == 0
    assert not recovered["script_provenance"]["original_filesystem_sha_captured"]
    loader = (ROOT / "assets/midterm-report.js").read_text()
    for name in ("hle-designated-baseline", "swe-single-agent-observation"):
        assert sections[name]["evidence"][0]["path"] in loader


def test_all_data_files_match_the_benchmark_publication_manifest():
    manifest_path = ROOT / "data/benchmark-source-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    assert manifest["repository"] == "vLLM-HUST/vllm-hust-benchmark"
    entries = manifest["files"]
    expected = {entry["website_path"] for entry in entries}
    actual = {
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "data").rglob("*")
        if path.is_file() and path != manifest_path
    }
    assert actual == expected
    assert len(entries) == len(expected)
    for entry in entries:
        assert entry["benchmark_path"].startswith("website-publication/data/")
        raw = (ROOT / entry["website_path"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == entry["sha256"]
        assert len(raw) == entry["bytes"]


class Elements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if tag == "script":
            self.scripts.append(attrs.get("src", ""))


def test_midterm_loader_cache_key_matches_publication_version():
    loader = (ROOT / "assets/midterm-report.js").read_text()
    assert "./data/midterm-v092.json" in loader
    hero = (ROOT / "assets/current-measurements.js").read_text()
    assert "./data/midterm-v092.json" in hero
    assert "report.version !== 'V0.92'" in hero
    assert "midterm-v076.json" not in hero
    for page in ("dataset-validation.html", "leaderboard-runs.html"):
        assert (
            "current-measurements.js?v=clarity-v092-20261027"
            in (ROOT / page).read_text()
        )
    payload = json.loads((ROOT / "data/midterm-v092.json").read_text())
    assert payload["version"] == "V0.92"
    pair = payload["frontierscience_designated_pair"]
    assert pair["quality_passed"] is None
    assert [pair["B0"][t]["successes"] for t in ("olympiad", "research")] == [66, 3]
    assert [pair["B1"][t]["successes"] for t in ("olympiad", "research")] == [62, 2]
    assert "frontierscience-native018-paired-20261025" in loader
    assert (
        payload["corrected_quality"]["reference"]["eta_percent"]
        == payload["wholechain_reference"]["B1"]["eta_percent"]
    )
    assert payload["current_summary"]["quality"]["b1"]["candidate_correct"] == 156
    assert (
        payload["current_summary"]["quality"]["b1"]["original_controller_status"]
        == "failed"
    )
    assert "C / C_reference" in payload["m01_method"]["efficiency_formula"]
    assert (
        payload["m01_method"]["current"]["reference_effective_tflops_per_chip"]
        == payload["wholechain_reference"]["reference_C_TFLOPS_per_chip"]
    )
    inventory = next(
        section
        for section in payload["sections"]
        if section["id"] == "dataset-quality-inventory"
    )
    assert len(inventory["tables"]) == 6
    assert sum(len(table["rows"]) for table in inventory["tables"]) == 24
    assert [row[1] for row in inventory["tables"][-1]["rows"]] == [
        "151 / 200",
        "152 / 200",
        "149 / 200",
        "146 / 200",
    ]
    assert (
        "reports/mmlu-quality018-20261022/quality018-completed-audit-r1.json" in loader
    )
    for filename in ("dataset-validation.html", "leaderboard-runs.html"):
        parser = Elements()
        parser.feed((ROOT / filename).read_text())
        assert [src for src in parser.scripts if "midterm-report.js" in src] == [
            "./assets/midterm-report.js?v=midterm-v092-quality-20261027"
        ]


def test_three_destinations_preserve_sections_without_duplicate_ids():
    for page, ids in {
        "leaderboard-runs.html": {
            "frontier-panel",
            "fixed-targets",
            "official-target-body",
            "leaderboard-tbody",
        },
        "dataset-validation.html": {
            "matrix-content",
            "validation-content",
            "coverage-content",
        },
        "serving-plan.html": {"plan-options", "computed"},
    }.items():
        parser = Elements()
        parser.feed((ROOT / page).read_text())
        assert len(parser.ids) == len(set(parser.ids))
        assert ids <= set(parser.ids)
    for obsolete in (
        "leaderboard.html",
        "dataset-matrix-v1.html",
        "capability-coverage.html",
    ):
        assert not (ROOT / obsolete).exists()
        for page in ROOT.glob("*.html"):
            parser = Elements()
            parser.feed(page.read_text())
            assert not any(
                link.split("#")[0].split("?")[0].endswith("/" + obsolete)
                for link in parser.links
            )


def test_v15_current_method_is_bilingual_and_not_historical_acceptance():
    data = json.loads((ROOT / "data/midterm-v092.json").read_text())
    method = data["m01_method"]
    assert method["method_version"] == "wholechain-20261025"
    assert method == data["milestone_contract"]["method"]
    assert method["identity"]["formal_indicator_amendment"] is False
    assert method["identity"]["original_v15"]["threshold_percent"] == 50
    assert method["current"]["passed"] is True
    supplement = data["reference_supplement"]
    assert supplement["totals"]["numerical_checks"] == 1402
    assert supplement["model_validation"]["passed"] == 6
    assert supplement["model_validation"]["failed"] == 26
    assert supplement["efficiency_percent"] is supplement["attainment"] is None
    assert (
        method["current"]["efficiency_percent"]
        == data["wholechain_reference"]["B1"]["eta_percent"]
    )
    assert method["current"]["effective_tflops_per_chip"] == 7.1042207644080255
    assert method["current"]["effective_flops"] == 1812905151088034
    assert method["current"]["matched_uninstrumented_seconds"] is None
    assert method["current_measurement"]["strict_uninstrumented"] is False
    assert method["measured_synchronized_b1"]["completed"] == 200
    assert method["measured_synchronized_b1"]["failed"] == 0
    assert (
        method["measured_synchronized_b1"]["synchronized_seconds"] == 120.65347687713802
    )
    audit = data["milestone_contract"]
    assert audit["cost_method"]["lifecycle_is_current_gate"] is False
    assert audit["stability_method"]["six_probe_pass_is_task_stability_pass"] is False
    sections = {s["id"]: s for s in data["sections"]}
    assert "独立整链参考与配对验收完成" in sections["m01-verdict"]["scope"]
    assert "paired assessment are complete" in sections["m01-verdict"]["scope_en"]
    pair = data["paired_own_compute"]
    assert pair["rows"]["B0"]["F"] == 1829161955258989
    assert pair["eta_percent"] == data["wholechain_reference"]["B1"]["eta_percent"]
    assert pair["attainment"] is True
    assert "not theoretical peak" in sections["m01-verdict"]["scope_en"]
    assert "不构成固定0.18/0.18 B0的M06货币成本通过" in sections["resources"]["scope"]
    assert "not M06 monetary-cost acceptance" in sections["resources"]["scope_en"]
    assert sections["milestone-v15"]["tables_en"]
    assert sections["milestone-v15"]["evidence"][0]["path"].endswith(
        "/current-method.json"
    )
    assert sections["milestone-v15"]["tables"][0]["headers"][1] == "依据及本轮方法"
    review = sections["v15-remaining"]
    assert len(review["tables"][0]["rows"]) == 5
    assert len(review["tables_en"][0]["rows"]) == 5
    assert "22.601951%" in review["scope"]
    assert "does not improve" in review["scope_en"]
    assert "E2E is not TTFT/TPOT" in review["scope_en"]
    assert pair["rows"]["B1"]["F"] == 1812905151088034
    assert "7.1042" in review["scope_en"]
