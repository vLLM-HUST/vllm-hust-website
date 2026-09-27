const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../assets/plugin-performance.js');
const data = JSON.parse(fs.readFileSync('data/plugin-performance.json'));
const frontier = JSON.parse(fs.readFileSync('data/leaderboard_frontier.json'));
const points = new Map(frontier.points.map(point => [point.id, point]));

test('BetterScale gain is computed from five published points against the one Native series', () => {
  const result = M.summarize(data, frontier).get('betterscale');
  assert.equal(result.count, 5);
  let product = 1;
  for (const row of result.comparisons) {
    const candidate = points.get(row.point_id), baseline = points.get(row.baseline_point_id);
    assert.equal(baseline.load.concurrency_series, data.baseline.series_id);
    assert.equal(candidate.load.concurrency, baseline.load.concurrency);
    const ratio = candidate.metrics.output_tps / baseline.metrics.output_tps;
    assert.ok(Math.abs(row.gain - (ratio - 1) * 100) < 1e-10);
    product *= ratio;
  }
  assert.ok(Math.abs(result.gain - (product ** (1 / 5) - 1) * 100) < 1e-10);
  assert.equal(result.gain.toFixed(2), '42.39');
});

test('all candidates reference the same Native IDs and cannot supply their own baseline or score', () => {
  const results = M.summarize(data, frontier);
  assert.ok([...results.values()].every(row => row.baseline_series_id === data.baseline.series_id));
  for (const key of ['baseline', 'baseline_id', 'pairs', 'ratios', 'gain']) {
    const invalid = structuredClone(data);
    invalid.entries[0][key] = {};
    assert.throws(() => M.summarize(invalid, frontier), /forbidden/);
  }
});

test('incompatible historical MOD series do not produce cross-baseline percentages', () => {
  const results = M.summarize(data, frontier);
  for (const id of ['bidkv', 'dla', 'kv-tiering-migration', 'mooncake-vllm-connectors', 'pipeline-microbatch-migration']) {
    assert.equal(results.get(id).gain, null);
    assert.deepEqual(results.get(id).comparisons, []);
  }
});

test('workload, model, topology, KV budget, runtime and measurement mismatches exclude a candidate', () => {
  const id = M.summarize(data, frontier).get('betterscale').comparisons[0].point_id;
  const edits = [
    p => {p.evidence.benchmark_protocol.prepared_workload_sha256 = 'different';},
    p => {p.configuration.parameters.checkpoint_revision = 'different';},
    p => {p.configuration.parameters.pipeline_parallel_size = 2;},
    p => {p.configuration.parameters.kv_cache_memory_bytes = 1;},
    p => {p.configuration.parameters.runtime_base_commits.vllm = 'different';},
    p => {p.evidence.measurement_seconds = 60;},
    p => {p.configuration.parameters.graph_mode = 'NONE';},
    p => {p.evidence.status = 'pending';}
  ];
  for (const edit of edits) {
    const invalid = structuredClone(frontier);
    edit(invalid.points.find(point => point.id === id));
    assert.equal(M.summarize(data, invalid).get('betterscale').gain, null);
  }
});

test('missing or duplicated concurrency windows cannot turn a partial curve into a score', () => {
  const id = M.summarize(data, frontier).get('betterscale').comparisons[0].point_id;
  const missing = {...frontier, points: frontier.points.filter(point => point.id !== id)};
  assert.equal(M.summarize(data, missing).get('betterscale').gain, null);
  const duplicate = {...frontier, points: [...frontier.points, points.get(id)]};
  assert.equal(M.summarize(data, duplicate).get('betterscale').gain, null);
  const native = M.summarize(data, frontier).get('betterscale').comparisons[0].baseline_point_id;
  assert.throws(() => M.summarize(data, {...frontier, points: frontier.points.filter(point => point.id !== native)}), /Native series/);
});

test('catalog sorts positive and negative gains descending, with unavailable scores last', () => {
  const results = new Map([['fast', {gain: 25}], ['slow', {gain: -3}], ['pending', {gain: null}]]);
  const rows = ['pending', 'slow', 'unknown', 'fast'].map(id => ({id}));
  assert.deepEqual(rows.sort((a, b) => M.compare(a, b, results)).map(row => row.id),
    ['fast', 'slow', 'pending', 'unknown']);
  const real = M.summarize(data, frontier);
  assert.equal([...real.values()].sort((a, b) => M.compare(a, b, real))[0].id, 'betterscale');
});

test('ECPA evidence is preserved in metadata without becoming a performance claim', () => {
  const result = M.summarize(data, frontier);
  assert.equal(result.get('betterscale').ecpa.launch_acceptance, 'not-reproduced-this-round');
  assert.equal(result.get('mooncake-vllm-connectors').ecpa.adapter_merge_state, 'open-draft');
  assert.equal(data.ecpa_experiment_boundary.process_release, 'known-defect');
});
