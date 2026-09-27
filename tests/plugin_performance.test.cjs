const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../assets/plugin-performance.js');
const data = JSON.parse(fs.readFileSync('data/plugin-performance.json'));
test('withdrawn comparisons cannot expose historical per-MOD percentages', () => {
  const results = M.summarize(data);
  assert.equal(results.size, 10);
  for (const row of results.values()) assert.equal(row.gain, null);
});
test('rejects the old per-MOD comparison format and any injected ratio', () => {
  assert.throws(() => M.summarize({...data,schema_version:'plugin-performance/v1'}));
  const invalid = structuredClone(data);
  invalid.entries[0].ratios = [1.5];
  assert.throws(() => M.summarize(invalid), /forbidden/);
});
test('a baseline cannot be admitted before the unified evidence validator exists', () => {
  assert.throws(() => M.summarize({...data,baseline:{id:'unverified'}}));
});
test('separates performance evidence from ECPA launch and analysis acceptance', () => {
  const result = M.summarize(data);
  assert.deepEqual(
    [...result.values()].filter(row => row.ecpa.launch_acceptance.startsWith('manager-verified')).map(row => row.id).sort(),
    ['kv-tiering-migration', 'mooncake-vllm-connectors']
  );
  assert.deepEqual(
    [...result.values()].filter(row => row.ecpa.launch_acceptance === 'external-harness-only').map(row => row.id).sort(),
    ['bidkv', 'dla', 'pipeline-microbatch-migration']
  );
  assert.deepEqual(
    [...result.values()].filter(row => row.ecpa.launch_acceptance === 'not-reproduced-this-round').map(row => row.id).sort(),
    ['betterscale', 'diffspec', 'kvcompress-ascend', 'latchmoe', 'vspec']
  );
  assert.equal(result.get('mooncake-vllm-connectors').ecpa.adapter_merge_state, 'open-draft');
  assert.equal(result.get('mooncake-vllm-connectors').ecpa.known_defect, 'process-release');
  assert.ok([...result.values()].every(row => row.ecpa.analysis_integration === 'external-harness'));
  assert.equal(data.ecpa_experiment_boundary.process_release, 'known-defect');
});
test('rejects missing or upgraded ECPA acceptance without the required evidence', () => {
  const missing = structuredClone(data);
  delete missing.entries[0].ecpa;
  assert.throws(() => M.summarize(missing), /Invalid ECPA status: bidkv/);
  const upgraded = structuredClone(data);
  upgraded.entries.find(row => row.id === 'mooncake-vllm-connectors').ecpa.adapter_merge_state = 'merged';
  assert.throws(() => M.summarize(upgraded), /Invalid supplemental adapter evidence/);
});

test('catalog sorts admitted gains descending, leaving pending items to catalog fallback', () => {
  const results = new Map([
    ['fast', {gain: 25}], ['slow', {gain: -3}], ['pending', {gain: null}]
  ]);
  const rows = ['pending', 'slow', 'unknown', 'fast'].map(id => ({id}));
  assert.deepEqual(rows.sort((a, b) => M.compare(a, b, results)).map(row => row.id),
    ['fast', 'slow', 'pending', 'unknown']);
  assert.equal(M.compare({id: 'pending'}, {id: 'unknown'}, results), 0);
});

test('existing Frontier evidence remains measured independently of ranking admission', () => {
  const frontier = JSON.parse(fs.readFileSync('data/leaderboard_frontier.json'));
  const result = M.summarize(data, frontier).get('betterscale');
  const expected = frontier.points.filter(point =>
    point.cohort_id === 'qwen35-35b-a3b-bf16-sweprefix-smoke-v1'
    && point.configuration.mods.includes('betterscale') && point.evidence.status === 'measured');
  assert.equal(result.measuredPointCount, expected.length);
  assert.ok(result.measuredPointCount >= 5);
  for (const concurrency of [1, 2, 4, 8, 16]) assert.ok(result.measuredConcurrencies.includes(concurrency));
  assert.equal(result.gain, null);
  const invalid = structuredClone(frontier);
  invalid.points.forEach(point => {point.evidence.status = 'pending';});
  assert.equal(M.summarize(data, invalid).get('betterscale').measuredPointCount, 0);
});
