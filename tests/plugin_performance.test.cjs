const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../assets/plugin-performance.js');
const data = JSON.parse(fs.readFileSync('data/plugin-performance.json'));
const frontier = JSON.parse(fs.readFileSync('data/leaderboard_frontier.json'));
const points = new Map(frontier.points.map(point => [point.id, point]));

test('every Frontier gain is computed from five points in a declared comparison set', () => {
  const results = M.summarize(data, frontier);
  const measured = [...results.values()].filter(result => result.source === 'frontier');
  assert.ok(measured.length >= 1);
  for (const result of measured) {
    assert.equal(result.count, 5);
    let product = 1;
    for (const row of result.comparisons) {
      const candidate = points.get(row.point_id), baseline = points.get(row.baseline_point_id);
      assert.equal(baseline.load.concurrency_series, result.baseline_series_id);
      assert.equal(candidate.load.concurrency, baseline.load.concurrency);
      const ratio = candidate.metrics.output_tps / baseline.metrics.output_tps;
      assert.ok(Math.abs(row.gain - (ratio - 1) * 100) < 1e-10);
      product *= ratio;
    }
    assert.ok(Math.abs(result.gain - (product ** (1 / 5) - 1) * 100) < 1e-10);
  }
  assert.deepEqual(new Set(measured.map(result => result.id)), new Set([
    'betterscale', 'pipeline-microbatch-migration', 'bidkv', 'dla', 'kv-tiering-migration', 'mooncake-vllm-connectors'
  ]));
  assert.equal(results.get('betterscale').gain.toFixed(2), '42.39');
  assert.equal(results.get('pipeline-microbatch-migration').gain.toFixed(2), '9.78');
});

test('published paired runs expose both gains and regressions without precomputed scores', () => {
  const results = M.summarize(data, frontier);
  const expected = {
    vspec: '51.80',
    'kvcompress-ascend': '10.25',
    diffspec: '-70.66',
    latchmoe: '-87.65'
  };
  for (const [id, gain] of Object.entries(expected)) {
    const result = results.get(id);
    assert.equal(result.source, 'published-comparison');
    assert.equal(result.count, 1);
    assert.equal(result.gain.toFixed(2), gain);
    assert.ok(result.url.startsWith('https://github.com/vLLM-HUST/'));
    assert.ok(result.published_comparison.baseline > 0);
    assert.ok(result.published_comparison.candidate > 0);
  }
  assert.equal([...results.values()].filter(result => Number.isFinite(result.gain)).length, 10);
});

test('comparison sets declare baselines centrally and entries cannot supply a baseline or score', () => {
  const results = M.summarize(data, frontier);
  const declared = new Set(data.comparison_sets.map(set => set.baseline_series_id));
  assert.ok([...results.values()].every(row => row.baseline_series_id === null
    || declared.has(row.baseline_series_id)));
  for (const key of ['baseline', 'baseline_id', 'baseline_series_id', 'pairs', 'ratios', 'gain']) {
    const invalid = structuredClone(data);
    invalid.entries[0][key] = {};
    assert.throws(() => M.summarize(invalid, frontier), /forbidden/);
  }
  const duplicate = structuredClone(data);
  duplicate.comparison_sets[1].entry_ids.push('bidkv');
  assert.throws(() => M.summarize(duplicate, frontier), /multiple comparison sets/);
});

test('published comparisons require raw matched values and cannot shadow a Frontier series', () => {
  for (const edit of [
    comparison => { comparison.baseline = 0; },
    comparison => { comparison.metric = 'request_tps'; },
    comparison => { comparison.scope = ''; }
  ]) {
    const invalid = structuredClone(data);
    const entry = invalid.entries.find(row => row.id === 'vspec');
    edit(entry.published_comparison);
    assert.throws(() => M.summarize(invalid, frontier), /Invalid published comparison/);
  }
  const invalid = structuredClone(data);
  invalid.entries.find(row => row.id === 'vspec').series_id = 'swe-unified-bidkv-20260927';
  assert.throws(() => M.summarize(invalid, frontier), /Invalid published comparison/);
});

test('series outside declared comparison sets do not produce percentages', () => {
  const results = M.summarize(data, frontier);
  const selected = new Set([...results.values()]
    .filter(result => Number.isFinite(result.gain)).map(result => result.id));
  for (const id of ['bidkv', 'dla', 'kv-tiering-migration', 'mooncake-vllm-connectors', 'pipeline-microbatch-migration', 'betterscale']) {
    if (selected.has(id)) continue;
    assert.equal(results.get(id).gain, null);
    assert.deepEqual(results.get(id).comparisons, []);
  }
});

test('workload, model, topology, KV budget, runtime and measurement mismatches exclude a candidate', () => {
  const measured = [...M.summarize(data, frontier).values()].find(result => Number.isFinite(result.gain));
  const id = measured.comparisons[0].point_id;
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
    assert.equal(M.summarize(data, invalid).get(measured.id).gain, null);
  }
});

test('MOD-specific host-tier capacity remains part of the treatment', () => {
  const result = [...M.summarize(data, frontier).values()].find(row => Number.isFinite(row.gain));
  const changed = structuredClone(frontier);
  for (const row of result.comparisons) {
    const parameters = changed.points.find(point => point.id === row.point_id).configuration.parameters;
    parameters.host_kv_budget_gib = (parameters.host_kv_budget_gib || 0) + 1;
  }
  assert.equal(M.summarize(data, changed).get(result.id).gain, result.gain);
});

test('missing or duplicated concurrency windows cannot turn a partial curve into a score', () => {
  const measured = [...M.summarize(data, frontier).values()].find(result => Number.isFinite(result.gain));
  const id = measured.comparisons[0].point_id;
  const missing = {...frontier, points: frontier.points.filter(point => point.id !== id)};
  assert.equal(M.summarize(data, missing).get(measured.id).gain, null);
  const duplicate = {...frontier, points: [...frontier.points, points.get(id)]};
  assert.equal(M.summarize(data, duplicate).get(measured.id).gain, null);
  const native = measured.comparisons[0].baseline_point_id;
  assert.throws(() => M.summarize(data, {...frontier, points: frontier.points.filter(point => point.id !== native)}), /Native series/);
});

test('catalog sorts every measured percentage from gain through regression', () => {
  const results = new Map([['fast', {gain: 25}], ['slow', {gain: -3}], ['pending', {gain: null}]]);
  const rows = ['pending', 'slow', 'unknown', 'fast'].map(id => ({id}));
  assert.deepEqual(rows.sort((a, b) => M.compare(a, b, results)).map(row => row.id),
    ['fast', 'slow', 'pending', 'unknown']);
  const real = M.summarize(data, frontier);
  const sorted = [...real.values()].sort((a, b) => M.compare(a, b, real));
  assert.deepEqual(sorted.map(row => row.id), [
    'vspec', 'betterscale', 'kvcompress-ascend', 'pipeline-microbatch-migration',
    'bidkv', 'dla', 'mooncake-vllm-connectors', 'kv-tiering-migration',
    'diffspec', 'latchmoe'
  ]);
});

test('ECPA evidence is preserved in metadata without becoming a performance claim', () => {
  const result = M.summarize(data, frontier);
  assert.equal(result.get('betterscale').ecpa.launch_acceptance, 'not-reproduced-this-round');
  const mooncake = result.get('mooncake-vllm-connectors');
  assert.equal(mooncake.ecpa.launch_acceptance, 'manager-verified');
  assert.equal(data.ecpa_experiment_boundary.process_release, 'known-defect');
});
