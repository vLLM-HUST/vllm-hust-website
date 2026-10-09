const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),data=require('../data/leaderboard_frontier.json');
test('current Dense27 sweep joins qualified current State points, not old reconstruction',()=>{
 const points=[...data.points,...data.archived_points].filter(p=>p.evidence.benchmark_protocol?.campaign==='dense27-current-state-20261009');
 assert.deepEqual(points.map(p=>p.load.concurrency).sort((a,b)=>a-b),[1,2,4,8,12,16]);
 for(const p of points){
  const c=p.configuration.parameters;assert.equal(c.host_kv_budget_gib,8);assert.equal(c.scheduler_block_tokens,1536);assert.equal(c.balanced_decode_attention,true);
  const q=JSON.parse(fs.readFileSync(path.join(root,`docs/evidence/dense27-current-20261009/c${p.load.concurrency}/qualification.json`)));
  assert.equal(q.sourceRunId,p.evidence.run_ids[0]);assert.equal(q.passed,true);assert.equal(q.forcedPressure.continuationEqual,true);assert.equal(q.forcedPressure.reclaimedAndRestoredPages,2);
  assert.equal(q.retrieval.before.passed,16);assert.equal(q.retrieval.after.passed,16);assert.equal(q.summary.valid,true);assert.equal(q.summary.failed_requests,0);
  assert.deepEqual(q.measuredBehavior.metrics,p.metrics);assert.equal(q.lifecycle.passed,true);
 }
 const plan=require('../data/serving-plans.json').plans.find(p=>p.model==='Qwen3.8-27B');
 const best=points.reduce((a,b)=>a.metrics.output_tps>b.metrics.output_tps?a:b);assert.equal(plan.runId,best.evidence.run_ids[0]);assert.equal(plan.config.state_cache_partial_reclaim,true);
 const proof=require('../docs/evidence/dense27-current-20261009/workload-equivalence.json');assert.equal(proof.passed,true);assert.equal(proof.restored_metadata_sha256,proof.reference_sha256);
});

test('27B BetterScale display contains only frontier points; dominated history remains archived',()=>{
 const model=require('../assets/leaderboard-frontier-model.js');
 const cohort='qwen38-27b-bf16-sweprefix-smoke-v1';
 const visible=data.points.filter(p=>p.cohort_id===cohort&&p.configuration.mods.includes('betterscale'));
 const frontier=model.groupFrontiers(visible,'decode_p90_tps','output_tps_per_chip').flat().map(r=>r.point.id);
 assert.deepEqual(visible.map(p=>p.id).sort(),frontier.sort());
 const archived=data.archived_points.filter(p=>p.cohort_id===cohort&&p.display_withdrawal?.dominated_by_point_ids);
 assert.equal(archived.length,13);
 for(const p of archived){
  assert.ok(!data.points.some(q=>q.id===p.id));
  assert.ok(p.evidence.run_ids.length>0);
  for(const id of p.display_withdrawal.dominated_by_point_ids){
   const q=data.points.find(q=>q.id===id)||data.archived_points.find(q=>q.id===id);assert.ok(q);
   assert.equal(model.frontierKey(q),model.frontierKey(p));
   const x=model.value(q,'decode_p90_tps'),y=model.value(q,'output_tps_per_chip');
   assert.ok(x>=model.value(p,'decode_p90_tps')&&y>=model.value(p,'output_tps_per_chip'));
   assert.ok(x>model.value(p,'decode_p90_tps')||y>model.value(p,'output_tps_per_chip'));
  }
 }
});
