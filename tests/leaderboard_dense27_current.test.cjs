const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),data=require('../data/leaderboard_frontier.json');
test('current Dense27 sweep joins qualified current State points, not old reconstruction',()=>{
 const points=data.points.filter(p=>p.evidence.benchmark_protocol?.campaign==='dense27-current-state-20261009');
 assert.deepEqual(points.map(p=>p.load.concurrency).sort((a,b)=>a-b),[8,12,16]);
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
