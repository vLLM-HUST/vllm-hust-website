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
    'betterscale', 'pipeline-microbatch-migration', 'bidkv', 'dla', 'kv-tiering-migration',
    'mooncake-vllm-connectors', 'kvcompress-ascend', 'kv-materialization-arrival-control',
    'pegaflow-vllm-connectors'
  ]));
  assert.equal(results.get('betterscale').gain.toFixed(2), '42.39');
  assert.equal(results.get('pipeline-microbatch-migration').gain.toFixed(2), '9.78');
  assert.equal(results.get('kvcompress-ascend').gain.toFixed(2), '-3.55');
  assert.equal(results.get('pegaflow-vllm-connectors').gain.toFixed(2), '6.34');
  assert.equal(results.get('betterscale').runtimeBase.vllm.slice(0, 7), '752a3a5');
  assert.equal(results.get('bidkv').runtimeBase.vllm.slice(0, 7), 'd0f22d2');
  assert.equal(results.get('kvcompress-ascend').cohortId,
    'qwen35-35b-a3b-bf16-sweprefix-smoke-v1');
});

test('published paired runs expose both gains and regressions without precomputed scores', () => {
  const results = M.summarize(data, frontier);
  const expected = {
    adm: '0.80',
    vspec: '51.80',
    diffspec: '-70.66',
    latchmoe: '-87.65'
  };
  for (const [id, gain] of Object.entries(expected)) {
    const result = results.get(id);
    assert.equal(result.source, 'published-comparison');
    assert.equal(result.count, id === 'adm' ? 3 : 1);
    assert.equal(result.gain.toFixed(2), gain);
    assert.ok(result.url.startsWith('https://github.com/vLLM-HUST/'));
    assert.ok(result.published_comparisons.every(row => row.baseline > 0));
    assert.ok(result.published_comparisons.every(row => row.candidate > 0));
  }
  assert.equal([...results.values()].filter(result => Number.isFinite(result.gain)).length, 13);
});

test('model-scoped summaries expose and rank only measurements from the selected model', () => {
  assert.deepEqual(M.models(data, frontier), [
    'Qwen2.5-14B', 'Qwen2.5-7B-Instruct', 'Qwen2.5-Coder-14B', 'Qwen3-30B-A3B', 'Qwen3-30B-A3B-W8A8',
    'Qwen3.5-35B-A3B', 'Qwen3.8-27B'
  ]);
  const qwen25 = M.summarize(data, frontier, 'Qwen2.5-14B');
  assert.equal(qwen25.get('vspec').gain.toFixed(2), '51.80');
  assert.equal(qwen25.get('betterscale').gain, null);
  assert.equal(qwen25.get('kv-materialization-arrival-control').gain, null);
  const qwen35 = M.summarize(data, frontier, 'Qwen3.5-35B-A3B');
  assert.equal(qwen35.get('vspec').gain, null);
  assert.equal(qwen35.get('betterscale').gain.toFixed(2), '42.39');
  assert.equal(qwen35.get('kv-materialization-arrival-control').gain.toFixed(2), '7.13');
  assert.equal(qwen35.get('pegaflow-vllm-connectors').gain.toFixed(2), '6.34');
  const qwen25Kvmat = M.summarize(data, frontier, 'Qwen2.5-7B-Instruct')
    .get('kv-materialization-arrival-control');
  assert.equal(qwen25Kvmat.source, 'published-comparison');
  assert.equal(qwen25Kvmat.count, 6);
  assert.equal(qwen25Kvmat.gain.toFixed(2), '-0.42');
  const qwen25Kvcompress = M.summarize(data, frontier, 'Qwen2.5-Coder-14B')
    .get('kvcompress-ascend');
  assert.equal(qwen25Kvcompress.source, 'published-comparison');
  assert.equal(qwen25Kvcompress.count, 1);
  assert.equal(qwen25Kvcompress.gain.toFixed(2), '10.25');
});

test('kv-materialization publishes five exact unified windows and exercised actions', () => {
  const series = frontier.points.filter(point => point.load.concurrency_series
    === 'swe-unified-kv-materialization-arrival-control-20260928');
  assert.deepEqual(series.map(point => point.load.concurrency), [1, 2, 4, 8, 16]);
  assert.equal(new Set(series.map(point => point.evidence.run_ids[0])).size, 5);
  for (const point of series) {
    const parameters = point.configuration.parameters;
    assert.equal(point.evidence.measurement_seconds, 900);
    assert.equal(point.cohort_id, 'qwen35-35b-a3b-bf16-sweprefix-smoke-v1');
    assert.equal(parameters.runtime_base_commits.vllm, 'd0f22d2bda562156e4dbf433ce645e1769b4f804'); // pragma: allowlist secret (public Git commit)
    assert.equal(parameters.runtime_base_commits['vllm-ascend'], '03766ac696fde5ab1980d80ca0b8543d3580c989'); // pragma: allowlist secret (public Git commit)
    assert.equal(parameters.checkpoint_revision, '712cf74392b05026a6db2bf213d343747d1f6d45'); // pragma: allowlist secret (public model revision)
    assert.equal(parameters.kv_cache_memory_bytes, 26038239232);
    assert.equal(parameters.mod_runtime_effectiveness.status, 'exercised');
    assert.ok(parameters.mod_runtime_effectiveness.controller_calls > 0);
    assert.ok(parameters.mod_runtime_effectiveness.realized_scheduler_decisions.partial_reuse > 0);
    assert.equal(point.evidence.benchmark_protocol.prepared_workload_sha256,
      '8044561ffa1bb430bea8f778ef814d96649321e1a92654b95f64263b996d5e85'); // pragma: allowlist secret (public workload hash)
    assert.equal(point.evidence.benchmark_protocol.tokenizer_fingerprint,
      '3f9ca78537850303ee04bfa6640c020be89723c62f37121c0f27a4c0babc53e0'); // pragma: allowlist secret (public tokenizer fingerprint)
    assert.equal(point.evidence.correctness.status, 'passed');
  }
  const allModels = M.summarize(data, frontier).get('kv-materialization-arrival-control');
  assert.equal(allModels.source, 'frontier');
  assert.equal(allModels.gain.toFixed(2), '7.13');
});

test('KVCompress publishes the clean 2ca0f933 Frontier evidence without duplicating the series', () => {
  const series = frontier.points.filter(point => point.load.concurrency_series
    === 'swe-unified-kvcompress-ascend-20260928');
  assert.deepEqual(series.map(point => point.load.concurrency), [1, 2, 4, 8, 16]);
  assert.deepEqual(series.map(point => point.metrics.output_tps), [
    94.57222222222222, 136.70555555555555, 206.5988888888889,
    286.1011111111111, 347.75333333333333
  ]);
  assert.equal(new Set(series.map(point => point.evidence.run_ids[0])).size, 5);
  for (const point of series) {
    const parameters = point.configuration.parameters;
    assert.equal(parameters.mod_revision, '2ca0f9335399a698342285870df1514e9c519bd4'); // pragma: allowlist secret (public Git commit)
    assert.equal(parameters.checkpoint_revision, '712cf74392b05026a6db2bf213d343747d1f6d45'); // pragma: allowlist secret (public model revision)
    assert.equal(point.evidence.benchmark_protocol.prepared_workload_sha256,
      '8044561ffa1bb430bea8f778ef814d96649321e1a92654b95f64263b996d5e85'); // pragma: allowlist secret (public workload hash)
    assert.match(point.evidence.source_evidence_url, /a020c164.*qwen35-frontier-formal/);
  }
  assert.equal(M.summarize(data, frontier).get('kvcompress-ascend').gain.toFixed(2), '-3.55');
});

test('PegaFlow publishes five exercised save/load windows without duplicating the core service', () => {
  const series = frontier.points.filter(point => point.load.concurrency_series
    === 'swe-unified-pegaflow-vllm-connectors-20260929');
  assert.deepEqual(series.map(point => point.load.concurrency), [1, 2, 4, 8, 16]);
  assert.deepEqual(series.map(point => point.metrics.output_tps), [
    65.52333333333333, 167.14333333333335, 237.96777777777777,
    361.4411111111111, 459.71555555555557
  ]);
  assert.equal(new Set(series.map(point => point.evidence.run_ids[0])).size, 5);
  for (const point of series) {
    const parameters = point.configuration.parameters;
    assert.deepEqual(point.configuration.mods, ['pegaflow-vllm-connectors']);
    assert.equal(parameters.mod_revision, 'cd64ecc283ff856a44437a9a25659929ef3a0653'); // pragma: allowlist secret (public Git commit)
    assert.equal(parameters.mod_runtime_effectiveness.status, 'exercised');
    assert.ok(parameters.mod_runtime_effectiveness.load_successes > 0);
    assert.ok(parameters.mod_runtime_effectiveness.save_successes > 0);
    assert.equal(parameters.mod_runtime_effectiveness.load_failures, 0);
    assert.equal(parameters.mod_runtime_effectiveness.save_failures, 0);
    assert.match(point.evidence.source_evidence_url, /64ef9d0b.*qwen35-frontier-formal/);
  }
  assert.equal(M.summarize(data, frontier).get('pegaflow-vllm-connectors').gain.toFixed(2), '6.34');
  assert.equal(data.entries.some(entry => entry.id === 'pegaflow'), false);
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
  duplicate.comparison_sets[1].observation_ids.push('bidkv:qwen35-frontier');
  assert.throws(() => M.summarize(duplicate, frontier), /multiple comparison sets/i);
});

test('published observations require raw matched values', () => {
  for (const edit of [
    comparison => { comparison.baseline = 0; },
    comparison => { comparison.metric = 'request_tps'; },
    comparison => { comparison.scope = ''; }
  ]) {
    const invalid = structuredClone(data);
    const observation = invalid.entries.find(row => row.id === 'vspec').observations[0];
    edit(observation.comparisons[0]);
    assert.throws(() => M.summarize(invalid, frontier), /Invalid performance observation/);
  }
  const invalid = structuredClone(data);
  invalid.entries.find(row => row.id === 'vspec').observations[0].kind = 'unknown';
  assert.throws(() => M.summarize(invalid, frontier), /Invalid performance observation/);
});

test('series outside declared comparison sets do not produce percentages', () => {
  const results = M.summarize(data, frontier);
  const selected = new Set([...results.values()]
    .filter(result => Number.isFinite(result.gain)).map(result => result.id));
  for (const id of ['bidkv', 'dla', 'kv-tiering-migration', 'mooncake-vllm-connectors', 'pipeline-microbatch-migration', 'betterscale', 'kvcompress-ascend']) {
    if (selected.has(id)) continue;
    assert.equal(results.get(id).gain, null);
    assert.deepEqual(results.get(id).comparisons, []);
  }
});

test('workload, model, topology, KV budget, runtime and measurement mismatches exclude a candidate', () => {
  const measured = [...M.summarize(data, frontier).values()].find(result => result.source === 'frontier' && Number.isFinite(result.gain));
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

test('only explicitly evidenced model and workload aliases join a comparison set', () => {
  const changed = structuredClone(frontier);
  const point = changed.points.find(row => row.load.concurrency_series === 'swe-unified-bidkv-20260927');
  const cohort = changed.cohorts.find(row => row.id === point.cohort_id);
  point.configuration.parameters.checkpoint_revision = cohort.model.revision;
  point.evidence.benchmark_protocol.prepared_workload_sha256 = cohort.workload.contract.prepared_workload_sha256;
  assert.ok(Number.isFinite(M.summarize(data, changed).get('bidkv').gain));

  const missingModelEvidence = structuredClone(changed);
  const changedCohort = missingModelEvidence.cohorts.find(row => row.id === point.cohort_id);
  changedCohort.model.verified_identity_aliases = [];
  assert.throws(() => M.summarize(data, missingModelEvidence), /Native series/);

  const missingWorkloadEvidence = structuredClone(changed);
  const workload = missingWorkloadEvidence.cohorts.find(row => row.id === point.cohort_id).workload.contract;
  workload.prepared_workload_variants = workload.prepared_workload_variants.filter(row => !row.equivalence);
  assert.throws(() => M.summarize(data, missingWorkloadEvidence), /Native series/);
});

test('MOD-specific host-tier capacity remains part of the treatment', () => {
  const result = [...M.summarize(data, frontier).values()].find(row => row.source === 'frontier' && Number.isFinite(row.gain));
  const changed = structuredClone(frontier);
  for (const row of result.comparisons) {
    const parameters = changed.points.find(point => point.id === row.point_id).configuration.parameters;
    parameters.host_kv_budget_gib = (parameters.host_kv_budget_gib || 0) + 1;
  }
  assert.equal(M.summarize(data, changed).get(result.id).gain, result.gain);
});

test('missing or duplicated concurrency windows cannot turn a partial curve into a score', () => {
  const measured = [...M.summarize(data, frontier).values()].find(result => result.source === 'frontier' && Number.isFinite(result.gain));
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
    'vspec', 'betterscale', 'pipeline-microbatch-migration',
    'kv-materialization-arrival-control', 'pegaflow-vllm-connectors', 'adm', 'bidkv', 'dla', 'mooncake-vllm-connectors', 'kv-tiering-migration',
    'kvcompress-ascend', 'diffspec', 'latchmoe'
  ]);
});

test('ECPA evidence is preserved in metadata without becoming a performance claim', () => {
  const result = M.summarize(data, frontier);
  assert.equal(result.get('betterscale').ecpa.launch_acceptance, 'not-reproduced-this-round');
  const mooncake = result.get('mooncake-vllm-connectors');
  assert.equal(mooncake.ecpa.launch_acceptance, 'manager-verified');
  const pipeline = result.get('pipeline-microbatch-migration');
  assert.equal(pipeline.ecpa.launch_acceptance, 'manager-verified');
  assert.match(pipeline.ecpa.evidence_url, /frontier_pipeline\/ecpa$/);
  assert.equal(result.get('kvcompress-ascend').ecpa.launch_acceptance, 'manager-verified');
  assert.equal(result.get('pegaflow-vllm-connectors').ecpa.launch_acceptance, 'manager-verified');
  assert.equal(data.ecpa_experiment_boundary.process_release, 'known-defect');
});
