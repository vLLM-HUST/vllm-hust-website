import pytest

from scripts.serving_plan_accounting import account


def record(end=2, cached=80):
    return {
        "start": 0,
        "end": end,
        "success": True,
        "prompt_tokens": 100,
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 20,
            "total_tokens": 120,
            "prompt_tokens_details": {"cached_tokens": cached},
        },
    }


def test_matched_cohort_excludes_all_drain_usage():
    result = account([record(), record(end=901)], 900, 2)
    assert result["requests"] == 1
    assert result["maxPromptTokens"] == 100
    assert result["counts"] == dict(prompt=100, cached=80, new=20, output=20)
    assert result["tokensPerSecondPerChip"]["cached"] == 80 / 900 / 2


def test_missing_or_inconsistent_usage_fails_closed():
    for row in [record(cached=101), record(cached=-1)]:
        with pytest.raises(ValueError):
            account([row], 900, 2)
    row = record()
    row["usage"]["prompt_tokens_details"] = {}
    with pytest.raises(KeyError):
        account([row], 900, 2)
    row = record()
    row["success"] = False
    with pytest.raises(ValueError):
        account([row], 900, 2)


def test_invalid_window_and_no_completed_requests():
    for seconds in (0, -1, float("nan"), float("inf")):
        with pytest.raises(ValueError):
            account([record()], seconds, 2)
    with pytest.raises(ValueError):
        account([record(end=901)], 900, 2)


def test_nonfinite_request_timestamp_rejected():
    for end in (float("nan"), float("inf")):
        with pytest.raises(ValueError):
            account([record(end=end)], 900, 2)


def test_public_usage_ledger_reproduces_plan_rates():
    import gzip
    import hashlib
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    plans = json.loads((root / "data/serving-plans.json").read_text())["plans"]
    for plan in plans:
        if "accountingEvidence" not in plan:
            continue
        path = root / plan["accountingEvidence"]
        evidence = json.loads(path.read_text())
        raw = gzip.decompress(path.with_name("usage.jsonl.gz").read_bytes())
        assert hashlib.sha256(raw).hexdigest() == evidence["usageProjectionSha256"]
        result = account(
            [json.loads(line) for line in raw.splitlines()], 900, plan["chips"]
        )
        for key in ("counts", "requests", "maxPromptTokens", "tokensPerSecondPerChip"):
            assert result[key] == evidence[key]
        assert evidence["sourceRunId"] == plan["runId"]
        for field, kind in [
            ("outputTpsPerChip", "output"),
            ("inputTpsPerChip", "new"),
            ("cachedInputTpsPerChip", "cached"),
        ]:
            assert plan[field] == result["tokensPerSecondPerChip"][kind]
        assert plan["maxPromptTokens"] == result["maxPromptTokens"]
