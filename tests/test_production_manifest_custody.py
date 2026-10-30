"""Test byte preservation independently of the optional browser dependency."""

import ast
import hashlib
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def preserve():
    source = ast.parse((ROOT / "scripts/verify_midterm_browser.py").read_text())
    function = next(
        node
        for node in source.body
        if isinstance(node, ast.FunctionDef)
        and node.name == "preserve_publication_manifest"
    )
    namespace = {"json": json, "hashlib": hashlib}
    exec(
        compile(ast.Module(body=[function], type_ignores=[]), "custody", "exec"),
        namespace,
    )
    return namespace[function.name]


def test_preserves_actual_response_bytes(tmp_path):
    raw = (
        b'{ "schema":"benchmark-website-publication/v1",\r\n'
        b'"repository":"vLLM-HUST/vllm-hust-benchmark",'
        b'"status":"published-source"}\r\n'
    )
    manifest, receipt = preserve()(raw, tmp_path)
    assert manifest == json.loads(raw)
    assert (tmp_path / receipt["file"]).read_bytes() == raw
    assert receipt["sha256"] == hashlib.sha256(raw).hexdigest()
    assert receipt["bytes"] == len(raw)


def test_rejects_nonpublication_response(tmp_path):
    with pytest.raises((AssertionError, KeyError)):
        preserve()(b'{"schema":"wrong"}', tmp_path)
    assert not list(tmp_path.iterdir())
