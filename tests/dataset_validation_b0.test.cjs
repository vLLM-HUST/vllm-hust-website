'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_v1.b0.json'), 'utf8'));

test('Home archive import publishes only evidenced B0 cells', () => {
    assert.equal(DATA.contract_version, 'dataset-validation-v1');
    assert.equal(DATA.datasets.length, 44);
    assert.equal(DATA.metrics.length, 5);
    assert.equal(DATA.results.length, 28 * 5);
    assert.ok(DATA.results.every((cell) => cell.status === 'baseline_only'));
    assert.ok(DATA.results.every((cell) => cell.value === null));
    assert.ok(DATA.results.every((cell) => cell.baseline_value !== null));
    assert.ok(DATA.results.every((cell) => cell.provenance.archive_sha256 === '60084956ff45dbd361c299fb4f1f0d0e4ff6538636701405c97b4d5f4848f9bd')); // pragma: allowlist secret
    assert.equal(new Set(DATA.results.map((cell) => cell.dataset_id)).size, 28);
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
    assert.equal(DATA.candidate_search.eligible_cells, 0);
    assert.equal(DATA.candidate_search.rejected_near_matches.length, 4);
    assert.deepEqual(
        new Set(DATA.candidate_search.rejected_near_matches.map((item) => item.dataset_id)),
        new Set(['sharegpt-v3', 'sonnet', 'instructcoder'])
    );
    assert.ok(DATA.results.every((cell) => cell.value === null));
});

test('Dataset Validation loads the B0 import rather than the empty fixture', () => {
    const page = fs.readFileSync(path.join(ROOT, 'dataset-validation.html'), 'utf8');
    assert.match(page, /dataset_validation_v1\.b0\.json/);
    assert.match(page, /B1 is selected independently per cell/);
});
