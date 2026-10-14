const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/leaderboard-frontier-model.js');
const data=require('../data/leaderboard_frontier.json');
const evidence=require('../data/leaderboard_910c_native_evidence.json');
const id='910c-native-dsv4-flash-w8a8-random8k1k-20261014';
test('910C engineering observations preserve hosts, die accounting and raw-derived axes',()=>{
 M.validate(data);
 const cohort=data.cohorts.find(c=>c.id===id);
 assert.match(cohort.workload.label,/910C.*Native vLLM Performance/);
 const points=data.points.filter(p=>p.cohort_id===id);
 assert.equal(points.length,11);
 assert.equal(new Set(points.map(M.groupKey)).size,2);
 assert.equal(M.concurrencySeries(M.project(points,'decode_p90_tps','output_tps_per_chip').measured).length,2);
 for(const p of points){
  const e=evidence.points.find(x=>x.id===p.id);
  assert.equal(p.metrics.decode_p90_tps,e.decode_p90_tps);
  assert.equal(p.metrics.output_tps,e.summary.output_tok_s);
  assert.equal(p.configuration.hardware.accelerator_count,16);
  assert.equal(p.configuration.parameters.physical_packages,8);
  assert.equal(p.configuration.parameters.draft_enforce_eager,true);
  assert.equal(p.configuration.official_baseline_id,undefined);
  assert.equal(M.supportsRent(p),false);
 }
});
