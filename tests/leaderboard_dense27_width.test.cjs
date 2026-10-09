const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),data=require('../data/leaderboard_frontier.json'),evidence=require('../data/leaderboard_frontier_swe_evidence.json');
test('wide Dense27 observations retain qualified capacity pressure without polluting frontier',()=>{
 const points=data.archived_points.filter(p=>p.evidence.benchmark_protocol?.campaign==='dense27-width-state-20261009');
 assert.deepEqual(points.map(p=>p.load.concurrency).sort((a,b)=>a-b),[24,32]);
 for(const p of points){
  const c=p.load.concurrency,params=p.configuration.parameters;
  assert.equal(params.execution_seats,c);assert.equal(params.resident_seats,c+4);assert.equal(params.host_kv_budget_gib,8);
  assert.equal(params.state_cache_partial_reclaim,true);assert.equal(p.configuration.hardware.accelerator_count,2);
  const q=JSON.parse(fs.readFileSync(path.join(root,`docs/evidence/dense27-width-20261009/c${c}/qualification.json`)));
  assert.equal(q.passed,true);assert.equal(q.sourceRunId,p.evidence.run_ids[0]);assert.equal(q.summary.measurement_seconds,900);
  assert.equal(q.summary.failed_requests,0);assert.equal(q.retrieval.before.passed,16);assert.equal(q.retrieval.after.passed,16);
  assert.equal(q.lifecycle.passed,true);assert.equal(q.measuredBehavior.peak_cache_usage_sampled,1);
  assert.ok(q.measuredBehavior.events_window.partial_resumed>0);assert.deepEqual(q.measuredBehavior.metrics,p.metrics);
  assert.deepEqual(evidence.runs.find(r=>r.point_id===p.id).configuration,p.configuration);
  assert.ok(p.display_withdrawal.dominated_by_point_ids.length);assert.ok(!data.points.some(x=>x.id===p.id));
 }
});
