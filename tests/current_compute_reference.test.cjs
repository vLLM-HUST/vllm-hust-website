'use strict';

// Synthetic browser-consumer fixtures, never measurement publication.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');

function sandbox() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'five-dataset-comparison.js'), 'utf8');
  const marker = '  showRelease();\n})();';
  assert.ok(source.endsWith(marker + '\n'));
  const context = { console, TextDecoder, URL, URLSearchParams, crypto: webcrypto,
    location: { href: 'https://example.test/b0-b1.html', hash: '', search: '' }, document: { getElementById: () => ({}) },
    window: { addEventListener() {}, vllmHustSite: { getCurrentLang: () => 'en' } } };
  vm.createContext(context);
  vm.runInContext(source.replace(marker, '  globalThis.computeTest = { computeBound, validateVersionComputeReference, versionComputeReferenceDetails };\n})();'), context);
  return context;
}

function fixture(context, efficiency='50') {
  const makeArm = () => ({ F_interval: ['1000000000000', '2000000000000'], T_seconds: '1',
    reference_seconds_lower: String(Number(efficiency)/100), reference_seconds_exact: null,
    achieved_tflops_per_card_interval: ['0.5', '1'], reference_tflops_per_card_upper: String(100/Number(efficiency)),
    full_model_certificate: true, source_and_timing_qualified: true,
    native_checksums_sha256: 'c'.repeat(64), necessary_work_sha256: 'd'.repeat(64), reference_graph_sha256: 'e'.repeat(64),
    efficiency_lower_percent: efficiency, efficiency_exact_percent: null, hardware_peak_utilization_percent: null });
  const assets = new Map([['data/compute-test/plot.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    ['data/compute-test/report.html', '<p>Synthetic fixture</p>']]);
  const files = [...assets].map(([website_path, raw]) => ({ website_path,
    sha256: createHash('sha256').update(raw).digest('hex'), bytes: Buffer.byteLength(raw) }));
  context.fetch = async name => ({ ok: true, arrayBuffer: async () => {
    const raw = Buffer.from(assets.get(name.replace(/^\.\//, '')));
    return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  } });
  const data = { schema: 'engine-current-compute-reference/v1', engine_release: 'full-answer-b1-20261117-r8',
    baseline_id: 'original018-cann8.5.1', status: 'measured', full_model_certificate: true,
    accepted_scope: 'full_answer_max8192_single_formal_run',
    certificate_kind: 'matched_complete_necessary_work_and_full_reference_lower_bound',
    efficiency_exact_percent: null, hardware_peak_utilization_percent: null,
    model: 'Qwen3.5-35B-A3B', precision: 'BF16', tensor_parallel_size: 2, chip_model: 'Ascend 910B2',
    protocol: { requests: 200, max_completion_tokens: 8192, formal_repetitions: 1, temperature: 0,
      seed: 0, eos: 'enabled', quality_plan_sha256: 'f4ed4ce5956c9ed08f360400b5a996ef92a217ce295d50648d4dc06443db768e' }, // pragma: allowlist secret -- fixed public workload digest
    source_status_sha256: 'a'.repeat(64), source_pair_sha256: 'b'.repeat(64),
    raw_asset: {url: 'https://github.com/vLLM-HUST/vllm-hust-engine/releases/download/test/synthetic.zip',
      sha256: 'f'.repeat(64), bytes: 100, asset_id: 1, redownload_verified: true},
    arms: { B0: makeArm(), B1: makeArm() }, milestone_met: Number(context.computeTest.computeBound(efficiency)) >= 50,
    final_numeric_met: Number(context.computeTest.computeBound(efficiency)) >= 90,
    chart: { path: files[0].website_path, sha256: files[0].sha256, bytes: files[0].bytes },
    report: { path: files[1].website_path, sha256: files[1].sha256, bytes: files[1].bytes } };
  return { entry: { id: 'r8', release: data.engine_release, baseline_id: data.baseline_id, compute_reference: data },
    publication: { files }, assets };
}

test('bounds round outwards across integral thresholds and scientific notation', () => {
  const { computeBound } = sandbox().computeTest;
  assert.equal(computeBound('49.99999999999999999999'), '49.9999');
  assert.equal(computeBound('49.99999999999999999999', true), '50');
  assert.equal(computeBound('5.00000000000000000001e1'), '50');
  assert.equal(computeBound('1e-10'), '0');
  assert.equal(computeBound('1e-10', true), '0.0001');
  assert.equal(computeBound('101.23456'), '101.2345');
  assert.throws(() => computeBound('NaN'));
  assert.throws(() => computeBound('-1'));
});

test('near-50 exact decimal stays below the milestone and greater-than-100 remains unclamped', async () => {
  for (const efficiency of ['49.99999999999999999999', '150']) {
    const context = sandbox();
    const { entry, publication } = fixture(context, efficiency);
    await context.computeTest.validateVersionComputeReference(entry, publication);
    const html = context.computeTest.versionComputeReferenceDetails(entry);
    assert.ok(html.includes('≥' + context.computeTest.computeBound(efficiency) + '%'));
    assert.ok(html.includes('Exact efficiency is unknown'));
    assert.ok(html.includes('8192 output cap'));
    if (efficiency.startsWith('49.')) assert.ok(html.includes('50% milestone：Target not met'));
  }
});

test('missing reference leaves a specific missing-data explanation', async () => {
  const context = sandbox();
  await context.computeTest.validateVersionComputeReference({}, { files: [] });
  const html = context.computeTest.versionComputeReferenceDetails({});
  assert.ok(html.includes('no published compute reference accounting'));
  assert.ok(!html.includes('<img'));
});

test('V2 verifies every repetition and sums work and time before division', async () => {
  const context = sandbox(), { entry, publication } = fixture(context);
  const data=entry.compute_reference;
  data.accepted_scope='topic4_submission_v2_fixed200_max256_three_formal_runs';
  data.protocol.max_completion_tokens=256;data.protocol.formal_repetitions=3;
  for(const arm of Object.values(data.arms)) {
    arm.repetitions=Array.from({length:3},(_,index)=>({repetition:index+1,
      F_interval:[...arm.F_interval],T_seconds:arm.T_seconds,reference_seconds_lower:arm.reference_seconds_lower,
      geometry_sha256:'1'.repeat(64),timing_sha256:'2'.repeat(64),work_sha256:'3'.repeat(64),graph_sha256:'4'.repeat(64)}));
    arm.F_interval=['3000000000000','6000000000000'];arm.T_seconds='3';arm.reference_seconds_lower='1.5';
  }
  await context.computeTest.validateVersionComputeReference(entry,publication);
  const html=context.computeTest.versionComputeReferenceDetails(entry);
  assert.ok(html.includes('256 output cap'));
  assert.ok(html.includes('three formal native runs per arm; sum before division'));
  assert.ok(!html.includes('8192 output cap'));
  data.arms.B1.repetitions[2].T_seconds='2';
  await assert.rejects(context.computeTest.validateVersionComputeReference(entry,publication));
  data.arms.B1.repetitions.pop();
  await assert.rejects(context.computeTest.validateVersionComputeReference(entry,publication));
});

test('wrong workload, foreign baseline, incomplete proof, inconsistent math and broken assets are rejected', async () => {
  const changes = [
    data => { data.protocol.max_completion_tokens = 256; },
    data => { data.protocol.formal_repetitions = 3; },
    data => { data.baseline_id = 'foreign-B0'; },
    data => { data.full_model_certificate = false; },
    data => { data.arms.B0.full_model_certificate = false; },
    data => { data.arms.B1.native_checksums_sha256 = ''; },
    data => { data.efficiency_exact_percent = 50; },
    data => { data.arms.B1.efficiency_lower_percent = '60'; },
    data => { data.arms.B1.F_interval = ['2000000000000', '1000000000000']; },
    data => { data.arms.B1.T_seconds = '0'; },
    data => { data.chart.sha256 = '0'.repeat(64); },
    data => { data.report.path = 'javascript:alert(1)'; },
  ];
  for (const change of changes) {
    const context = sandbox(), { entry, publication } = fixture(context);
    change(entry.compute_reference);
    await assert.rejects(context.computeTest.validateVersionComputeReference(entry, publication));
  }
  const context = sandbox(), { entry, publication, assets } = fixture(context);
  assets.set(entry.compute_reference.chart.path, 'changed image');
  await assert.rejects(context.computeTest.validateVersionComputeReference(entry, publication));
});
