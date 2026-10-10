const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),data=require('../data/leaderboard_frontier.json'),evidence=require('../data/leaderboard_frontier_swe_evidence.json');
test('Dense27 TP4 sweeps all requested shapes with whole-run qualification and accounting',()=>{
 const points=[...data.points,...data.archived_points].filter(p=>p.evidence.benchmark_protocol?.campaign==='dense27-tp4-state-20261009');
 assert.deepEqual(points.map(p=>p.load.concurrency).sort((a,b)=>a-b),[1,2,4,8,12,16,24,32,40,48]);
 for(const p of points){
  const c=p.load.concurrency,q=JSON.parse(fs.readFileSync(path.join(root,`docs/evidence/dense27-tp4-20261009/c${c}/qualification.json`)));
  assert.equal(p.configuration.parameters.host_kv_budget_gib,4);assert.equal(q.passed,true);assert.equal(q.summary.measurement_seconds,900);
  assert.equal(q.sourceRunId,p.evidence.run_ids[0]);assert.equal(q.summary.failed_requests,0);
  assert.equal(q.retrieval.before.passed,16);assert.equal(q.retrieval.after.passed,16);
  assert.deepEqual(q.measuredBehavior.metrics,p.metrics);assert.equal(q.lifecycle.passed,true);
  assert.deepEqual(Object.keys(q.measuredBehavior.steps).sort(),['0','1','2','3']);
  assert.equal(q.forcedPressure.byteExactRestoredBytesPerRank,53477376);assert.equal(q.forcedPressure.continuationEqual,true);
  assert.deepEqual(evidence.runs.find(r=>r.point_id===p.id).configuration,p.configuration);
 }
 const best=points.reduce((a,b)=>a.metrics.output_tps>b.metrics.output_tps?a:b);
 const modelPlans=require('../data/serving-plans.json').plans.filter(p=>p.model==='Qwen3.8-27B');
 assert.equal(modelPlans.length,1);const plan=modelPlans[0];assert.equal(plan.chips,4);
 assert.equal(plan.runId,best.evidence.run_ids[0]);assert.equal(plan.config.tensor_parallel_size,4);
 const accounting=JSON.parse(fs.readFileSync(path.join(root,plan.accountingEvidence)));
 assert.equal(accounting.chips,4);assert.deepEqual(plan.accounting,accounting);
 assert.equal(plan.outputTpsPerChip,accounting.tokensPerSecondPerChip.output);
 assert.equal(plan.inputTpsPerChip,accounting.tokensPerSecondPerChip.new);
 assert.equal(plan.cachedInputTpsPerChip,accounting.tokensPerSecondPerChip.cached);
});
