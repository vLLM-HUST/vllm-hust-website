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
  vm.runInContext(source.replace(marker, '  globalThis.computeTest = { computeBound, validateVersionComputeReference, versionComputeReferenceDetails, latestFrozenRelease, linkedDetailKey, transportAssetBytes, loadFixedBaseline, withFixedBaseline, setFixedBaseline: value=>{fixedBaseline=value;} };\n})();'), context);
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
  assert.ok(html.includes('Compute accounting for this B1 is unpublished'));
  assert.ok(!html.includes('<img'));
});

test('V2 verifies every repetition and sums work and time before division', async () => {
  const context = sandbox(), { entry, publication } = fixture(context);
  const data=entry.compute_reference;
  const legacy=structuredClone(data);
  data.accepted_scope='topic4_submission_v2_fixed200_max256_three_formal_runs';
  data.protocol.max_completion_tokens=256;data.protocol.formal_repetitions=3;
  for(const arm of Object.values(data.arms)) {
    arm.repetitions=Array.from({length:3},(_,index)=>({repetition:index+1,
      F_interval:[...arm.F_interval],T_seconds:arm.T_seconds,reference_seconds_lower:arm.reference_seconds_lower,
      geometry_sha256:'1'.repeat(64),timing_sha256:String(index+2).repeat(64),work_sha256:'3'.repeat(64),graph_sha256:'4'.repeat(64)}));
    arm.F_interval=['3000000000000','6000000000000'];arm.T_seconds='3';arm.reference_seconds_lower='1.5';
  }
  await context.computeTest.validateVersionComputeReference(entry,publication);
  const html=context.computeTest.versionComputeReferenceDetails(entry);
  assert.ok(html.includes('256 output cap'));
  assert.ok(html.includes('three formal native runs per arm; sum before division'));
  assert.ok(!html.includes('8192 output cap'));
  data.full_answer_supplement=legacy;
  await context.computeTest.validateVersionComputeReference(entry,publication);
  const withSupplement=context.computeTest.versionComputeReferenceDetails(entry);
  assert.ok(withSupplement.includes('256 output cap'));
  assert.ok(withSupplement.includes('8192 output cap'));
  assert.ok(withSupplement.includes('the three-run submission decision uses the 256-budget result above'));
  legacy.protocol.formal_repetitions=3;
  await assert.rejects(context.computeTest.validateVersionComputeReference(entry,publication));
  legacy.protocol.formal_repetitions=1;
  const originalPin=data.arms.B1.repetitions[2].timing_sha256;
  data.arms.B1.repetitions[2].timing_sha256=data.arms.B1.repetitions[0].timing_sha256;
  await assert.rejects(context.computeTest.validateVersionComputeReference(entry,publication));
  data.arms.B1.repetitions[2].timing_sha256=originalPin;
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

function reuseFixture() {
  const context=sandbox(), value=fixture(context, '75'), a=value.entry.compute_reference;
  Object.assign(a,{accepted_scope:'topic4_submission_v2_fixed200_max256_three_formal_runs',
    certificate_kind:'qualified_full_reference_denominator_reuse/v1',original_reference_work_and_time_retained:true,
    original_efficiency_used:false,shared_work_cancellation_used:false,source_and_workload_applicability_qualified:true,
    clean_native_clock_source_qualified:true,full_reference_denominator_qualified:true,
    recomputation_url:'https://github.com/DeepLinkNext/DeepLinkEngine/blob/'+'a'.repeat(40)+'/benchmark/reports/example/README.md'});
  a.protocol.max_completion_tokens=256;a.protocol.formal_repetitions=3;
  for(const arm of Object.values(a.arms)) {
    Object.assign(arm,{F_interval:['3000000000000','6000000000000'],T_seconds:'3',reference_F_interval:['9000000000000','12000000000000'],
      reference_seconds_lower:'9',reference_tflops_per_card_upper:String(2/3),shared_work_cancellation_used:false});
    arm.repetitions=Array.from({length:3},(_,i)=>({repetition:i+1,F_interval:[1000000000000,2000000000000],T_seconds:'1',
      geometry_sha256:'1'.repeat(64),timing_sha256:String(i+2).repeat(64),work_sha256:'3'.repeat(64),native_source_seal_sha256:'4'.repeat(64)}));
    arm.original_reference_repetitions=Array.from({length:3},(_,i)=>({name:'reference-'+i,F_interval:[3000000000000,4000000000000],Tref_lower_seconds:'3',
      requests:200,input_tokens:282265,output_tokens:51200,source_sha256:String(i+5).repeat(64)}));
  }
  function addAsset(path, data) {
    const raw=JSON.stringify(data);value.assets.set(path,raw);
    const asset={path,sha256:createHash('sha256').update(raw).digest('hex'),bytes:Buffer.byteLength(raw)};
    value.publication.files.push({website_path:path,sha256:asset.sha256,bytes:asset.bytes});return asset;
  }
  const stats={schema:'qualified-reference-denominator/v1',original_efficiency_used:false,target_times_used:false,
    scope:{requests:200,input_tokens:282265,output_tokens:51200,max_completion_tokens:256,dtype:'BF16',tp:2,accelerator:'Ascend 910B2',frontend:'native_inproc',timing:'dual_rank_synchronized_after_warmup'},calculation:{chips:2},arms:{}};
  for(const role of ['B0','B1']){const arm=a.arms[role];stats.arms[role]={effective_flops_interval:arm.reference_F_interval.map(Number),sum_reference_seconds_lower:arm.reference_seconds_lower,reference_tflops_per_card_upper:arm.reference_tflops_per_card_upper,reference_repetitions:arm.original_reference_repetitions};}
  a.reference_statistics=addAsset('data/compute-test/statistics.json',stats);
  const pair={certificate_kind:a.certificate_kind,full_model_certificate:true,full_reference_denominator_qualified:true,
    clean_native_clock_source_qualified:true,original_efficiency_used:false,original_reference_work_and_time_retained:true,
    shared_work_cancellation_used:false,qualified_full_reference_statistics_sha256:a.reference_statistics.sha256,arms:structuredClone(a.arms)};
  a.certificate=addAsset('data/compute-test/pair.json',pair);a.source_pair_sha256=a.certificate.sha256;
  return {context,...value};
}

test('complete-reference reuse preserves different F and validates both original evidence documents', async()=>{
  const {context,entry,publication}=reuseFixture();
  await context.computeTest.validateVersionComputeReference(entry,publication);
  const html=context.computeTest.versionComputeReferenceDetails(entry);
  assert.ok(html.includes('≥75%'));assert.ok(html.includes('Same-condition reference denominator'));
  assert.ok(html.includes('without cancellation'));assert.ok(html.includes('finish(v)'));
  assert.ok(!html.includes('The same actual necessary F cancels'));
});

test('reference reuse rejects F cancellation, missing original repetitions and mismatched source documents', async()=>{
  for(const change of [
    a=>{a.arms.B1.efficiency_lower_percent='300';a.final_numeric_met=true;},
    a=>{a.arms.B1.reference_F_interval=[...a.arms.B1.F_interval];},
    a=>{a.arms.B1.original_reference_repetitions.pop();},
    a=>{a.arms.B1.original_reference_repetitions[0].input_tokens=1;},
    a=>{a.arms.B1.repetitions[0].work_sha256='9'.repeat(64);},
    a=>{a.original_efficiency_used=true;},
    a=>{a.shared_work_cancellation_used=true;},
    a=>{a.reference_statistics.sha256='9'.repeat(64);},
    a=>{a.source_pair_sha256='9'.repeat(64);},
  ]) {
    const {context,entry,publication}=reuseFixture();change(entry.compute_reference);
    await assert.rejects(context.computeTest.validateVersionComputeReference(entry,publication));
  }
});


test('latest frozen release ignores stale defaults, input order and lexicographic version sorting',()=>{
  const {latestFrozenRelease}=sandbox().computeTest;
  assert.equal(latestFrozenRelease({default_release:'r6',order:['r6','r8','r7']}),'r8');
  assert.equal(latestFrozenRelease({default_release:'r9',order:['r9','r100','r10']}),'r100');
  assert.throws(()=>latestFrozenRelease({order:['r8','sr4']}));
  assert.throws(()=>latestFrozenRelease({order:[]}));
});


test('main-page legacy anchors address current-release details without redirecting to archived results',()=>{
  const {linkedDetailKey}=sandbox().computeTest;
  assert.equal(linkedDetailKey('#method-1'),'compute');
  assert.equal(linkedDetailKey('#current-qualified-compute'),'compute');
  assert.equal(linkedDetailKey('#metric-3'),'supplement');
  assert.equal(linkedDetailKey('#method-b0'),'configuration');
  const source=fs.readFileSync(path.join(__dirname,'..','assets','five-dataset-comparison.js'),'utf8');
  assert.ok(!source.includes("location.replace('./b0-b1-legacy.html'"));
});


const cfBeacon='<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v123abc" integrity="sha512-YWJjZA==" data-cf-beacon=\'{"version":"2024.11.0","token":"public-site-id"}\' crossorigin="anonymous"></script>\n';

test('a Cloudflare analytics suffix preserves exact original HTML and still rejects altered evidence',async()=>{
  for(const suffix of [cfBeacon,'<script src="https://example.com/beacon.min.js"></script>',cfBeacon+'<p>extra</p>',cfBeacon.replace('crossorigin="anonymous"','onload="alert(1)"')]) {
    const context=sandbox(),{entry,publication,assets}=fixture(context);
    const path=entry.compute_reference.report.path;
    assets.set(path,assets.get(path)+suffix);
    if(suffix===cfBeacon)await context.computeTest.validateVersionComputeReference(entry,publication);
    else await assert.rejects(context.computeTest.validateVersionComputeReference(entry,publication));
  }
  const context=sandbox(),{entry,publication,assets}=fixture(context);
  const path=entry.compute_reference.report.path;
  assets.set(path,assets.get(path).replace('fixture','altered')+cfBeacon);
  await assert.rejects(context.computeTest.validateVersionComputeReference(entry,publication));
});


function baselineFixture(context, mutate=()=>{}) {
  // Synthetic fixtures only: the production values come from benchmark.
  const baseline={id:'original018-cann8.5.1',vllm:'0.18.0',vllm_ascend:'0.18.0',cann:'8.5.1',image_digest:'sha256:'+'a'.repeat(64),sdk_source_map_sha256:'b'.repeat(64)};
  const ids=['mmlu','hle','frontier','swe','terminal'],counts=[200,200,160,64,48];
  const value={schema:'vllm-hust-fixed-baseline-observations/v1',baseline,model:'Qwen3.5-35B-A3B',precision:'BF16',tensor_parallel_size:2,chip_model:'Ascend 910B2',
    profiles:ids.map((id,i)=>({id,arm:{role:'B0',requests:counts[i],failed:0,output_tokens:1000,duration_seconds:10,output_tokens_per_second:100,mean_ttft_ms:20,mean_tpot_ms:5,source_seal_sha256:'c'.repeat(64)}})),
    context:{observations:ids.slice(0,4).map(phase=>({phase,B0:{status:'completed',metrics:{failed:0},windows:[{},{},{},{},{}]}}))},compute:{arm:{source_and_timing_qualified:true}}};
  mutate(value);
  const raw=Buffer.from(JSON.stringify(value));
  const descriptor={schema:'vllm-hust-fixed-baseline-descriptor/v1',path:'data/fixed-b0-original018-v1.json',sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length};
  baseline.observations=descriptor;
  context.fetch=async()=>({ok:true,arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)});
  return {baseline,value,publication:{files:[{website_path:descriptor.path,sha256:descriptor.sha256,bytes:descriptor.bytes}]}};
}

test('an empty future candidate retains five original B0 records without creating paired results',async()=>{
  const context=sandbox(),f=baselineFixture(context);
  const baseline=await context.computeTest.loadFixedBaseline(f.baseline,f.publication);
  context.computeTest.setFixedBaseline(baseline);
  const rows=context.computeTest.withFixedBaseline(baseline.profiles.map(row=>({id:row.id})));
  assert.equal(rows.length,5);
  for(const row of rows){assert.equal(row.baselineObservation.role,'B0');assert.equal(row.baselineObservation.output_tokens_per_second,100);assert.equal(row.baselineModel,baseline.model);assert.equal(row.arms,undefined);assert.equal(row.changes_percent,undefined);}
  const paired={id:'mmlu',arms:{B0:{output_tokens_per_second:42},B1:{output_tokens_per_second:84}}};
  assert.equal(context.computeTest.withFixedBaseline([paired])[0],paired);
  const candidate={id:'mmlu',observation:{output_tokens_per_second:150},model:'Synthetic other model'};
  const observed=context.computeTest.withFixedBaseline([candidate])[0];
  assert.equal(observed.observation,candidate.observation);assert.equal(observed.arms,undefined);
});

test('fixed B0 loader rejects an optimized arm or foreign model even after valid manifest signing',async()=>{
  for(const mutate of [v=>{v.profiles[0].arm.role='r8';},v=>{v.model='Foreign model';},v=>{v.profiles[0].arm.requests=1;},v=>{v.profiles[0].arm.output_tokens_per_second=200;}]){
    const context=sandbox(),f=baselineFixture(context,mutate);
    await assert.rejects(context.computeTest.loadFixedBaseline(f.baseline,f.publication));
  }
});

test('changed fixed-B0 bytes cannot pass the catalog descriptor',async()=>{
  const context=sandbox(),f=baselineFixture(context);
  f.baseline.observations.sha256='d'.repeat(64);
  f.publication.files[0].sha256=f.baseline.observations.sha256;
  await assert.rejects(context.computeTest.loadFixedBaseline(f.baseline,f.publication));
});


test('original B0 compute efficiency retains decimal precision when the current candidate has no certificate',()=>{
  const context=sandbox(),f=fixture(context,'49.99999999999999999');
  const arm=f.entry.compute_reference.arms.B0;
  arm.reference_F_interval=[...arm.F_interval];
  context.computeTest.setFixedBaseline({compute:{model:'Synthetic original model',arm,certificate:{path:'data/synthetic/certificate.json'},reference_statistics:{path:'data/synthetic/reference.json'}}});
  const html=context.computeTest.versionComputeReferenceDetails({});
  assert.ok(html.includes('49.9999%'));assert.ok(!html.includes('—%'));assert.ok(!html.includes('50%'));
  assert.ok(html.includes('Compute accounting for this B1 is unpublished'));
  assert.equal(arm.efficiency_lower_percent,'49.99999999999999999');
});
