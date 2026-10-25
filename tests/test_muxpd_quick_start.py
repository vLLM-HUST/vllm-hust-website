"""Check the MuxPD instructions without publishing an unqualified catalog row."""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "assets/plugins-page.js"


def quick_start():
    # Evaluate the actual inert command table, not a copied test recipe. No DOM,
    # networking or child-process capability is supplied to the JavaScript VM.
    program = """
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[1], 'utf8');
const start = source.indexOf('  const quickStarts = ');
const end = source.indexOf('  const inspectableBundles = ', start);
if (start < 0 || end < 0) throw new Error('command table boundary changed');
const table = source.slice(start, end);
const result = vm.runInNewContext(table + '\\nquickStarts.muxpd', {}, {timeout: 1000});
process.stdout.write(JSON.stringify(result));
"""
    return json.loads(
        subprocess.check_output(["node", "-e", program, str(SCRIPT)], text=True)
    )


def test_muxpd_uses_explicit_wheels_and_the_release_build_guide():
    entry = quick_start()
    root = "https://github.com/vLLM-HUST/vllm-ascend-MuxPD-hust"
    assert entry["guide"] == root + "/blob/v0.2.0a1/docs/ecpa-deployment.md"
    assert entry["release"] == root + "/releases/tag/v0.2.0a1"
    assert "wheel checksums" in entry["note_en"]
    command = entry["command"]
    assert command.count("python -m pip install --no-deps ") == 2
    assert "/path/to/vllm_hust_ext-0.3.1.dev1-py3-none-any.whl" in command
    assert "/path/to/vllm_ascend_muxpd-0.2.0a1-py3-none-any.whl" in command
    assert "@main" not in command and "git+" not in command


def test_muxpd_has_three_paired_contracts_and_an_explicit_launch_boundary():
    entry = quick_start()
    for contract in (
        "vllm.scheduler-class.v1",
        "vllm.worker-class.v1",
        "vllm.batch-admission-policy.v1",
    ):
        assert contract in entry["note_en"] and contract in entry["note_zh"]
    assert "enablement do not start a model" in entry["note_en"]
    assert "all three components, not merely health readiness" in entry["note_en"]
    command = entry["command"]
    steps = [
        'export VLLM_HUST_EXT_CONFIG="$PWD/muxpd-state/config.json"',
        "vllm-muxpd doctor",
        "vllm-hust-ext extension validate org.vllm-hust.muxpd",
        "vllm-muxpd configuration --output muxpd-configuration.json",
        "vllm-hust-ext extension configure org.vllm-hust.muxpd --file ",
        "vllm-hust-ext extension enable org.vllm-hust.muxpd",
        "vllm-hust-ext extension plan org.vllm-hust.muxpd",
        "vllm-hust-ext extension render org.vllm-hust.muxpd",
    ]
    offsets = [command.index(step) for step in steps]
    assert offsets == sorted(offsets)
    serves = [
        line for line in command.splitlines() if line.startswith("vllm-muxpd serve")
    ]
    assert len(serves) == 2
    assert serves[0] == serves[1] + " --dry-run"
    assert command.index(serves[0]) > offsets[-1]
    for selector in ("--scheduler-cls", "--worker-cls", "--batch-admission-policy"):
        assert selector not in command


def test_muxpd_rollback_requires_drain_stop_disable_and_fresh_native_workers():
    entry = quick_start()
    command = entry["command"]
    drain = command.index("After draining requests and stopping that service")
    disable = command.index("extension disable org.vllm-hust.muxpd")
    status = command.index("extension status org.vllm-hust.muxpd")
    assert drain < disable < status
    assert "vllm-muxpd serve" not in command[disable:]
    assert "disable changes only the next launch" in entry["note_en"]
    assert "Restart native vLLM in fresh workers" in entry["note_en"]
    # The existing renderer displays commands as text and links; no shell or
    # model service invocation is added to the web page.
    source = SCRIPT.read_text()
    assert 'element("code", "", value.command)' in source
    assert "release.href = value.release" in source
    assert "tooltip.append(release)" in source
