'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_v1.b0.json'), 'utf8'));

test('Home import and vSpec evidence publish only evidenced cells', () => {
    assert.equal(DATA.contract_version, 'dataset-validation-v1');
    assert.equal(DATA.datasets.length, 44);
    assert.equal(DATA.metrics.length, 6);
    assert.equal(DATA.results.length, (28 * 6) + 6);
    assert.equal(DATA.results.filter((cell) => cell.status === 'passed').length, 12);
    assert.equal(DATA.results.filter((cell) => cell.status === 'baseline_only').length, 162);
    assert.ok(DATA.results.filter((cell) => cell.status === 'baseline_only').every((cell) => cell.provenance.archive_sha256 === '60084956ff45dbd361c299fb4f1f0d0e4ff6538636701405c97b4d5f4848f9bd')); // pragma: allowlist secret
    assert.equal(new Set(DATA.results.map((cell) => cell.dataset_id)).size, 29);
});

test('B1 selection is per cell and keeps unmatched datasets empty', () => {
    assert.equal(DATA.candidate_policy.id, 'best-per-cell');
    assert.equal(DATA.candidate_policy.single_version_required, false);
    assert.ok(!DATA.results.some((cell) => cell.dataset_id === 'szyn-opencode-swebench-verified-500'));
    assert.ok(DATA.datasets.some((dataset) => dataset.id === 'szyn-opencode-swebench-verified-500'));
    const longbench = DATA.results.find((cell) => cell.dataset_id === 'longbench-v2' && cell.metric_id === 'request_success_rate');
    assert.equal(longbench.baseline_value, 98);
});

test('B1 audit rejects near matches instead of populating incomparable cells', () => {
    assert.equal(DATA.candidate_search.audited_at, '2026-10-03');
    assert.equal(DATA.candidate_search.eligible_cells, 12);
    assert.equal(DATA.candidate_search.rejected_near_matches.length, 4);
    assert.deepEqual(
        new Set(DATA.candidate_search.rejected_near_matches.map((item) => item.dataset_id)),
        new Set(['sharegpt-v3', 'sonnet', 'instructcoder'])
    );
    assert.ok(DATA.results.filter((cell) => !['ai2-arc', 'gsm8k'].includes(cell.dataset_id)).every((cell) => cell.value === null));
});

test('vSpec fills the six evidenced B1 metrics for GSM8K and ARC-Easy', () => {
    const candidateCells = DATA.results.filter((cell) => ['ai2-arc', 'gsm8k'].includes(cell.dataset_id) && cell.value !== null);
    assert.equal(candidateCells.length, 12);
    assert.ok(candidateCells.every((cell) => cell.provenance.repository === 'vLLM-HUST/vllm-hust-vSpec'));
    assert.ok(candidateCells.every((cell) => cell.provenance.repository_commit === '4a29bf9bce72b3ea8cf7abbc54cbba204f00942f')); // pragma: allowlist secret
    assert.ok(candidateCells.every((cell) => cell.provenance.engine_commit === '762f85b311fbab0bcf8921dd216f5093cd58b9b8')); // pragma: allowlist secret
    const gsm8kOutput = candidateCells.find((cell) => cell.dataset_id === 'gsm8k' && cell.metric_id === 'output_token_throughput');
    const arcOutput = candidateCells.find((cell) => cell.dataset_id === 'ai2-arc' && cell.metric_id === 'output_token_throughput');
    assert.equal(gsm8kOutput.value, 611.2674615325014);
    assert.equal(gsm8kOutput.baseline_value, null);
    assert.equal(arcOutput.value, 442.61142407483453);
    assert.equal(arcOutput.baseline_value, 274.82);
});

test('Dataset Validation loads the B0 import rather than the empty fixture', () => {
    const page = fs.readFileSync(path.join(ROOT, 'dataset-validation.html'), 'utf8');
    assert.match(page, /dataset_validation_v1\.b0\.json/);
    assert.match(page, /B1 is selected independently per cell/);
});
