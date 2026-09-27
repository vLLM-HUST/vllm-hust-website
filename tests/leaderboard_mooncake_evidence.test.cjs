const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gunzipSync}=require('node:zlib');
const data=require('../data/leaderboard_frontier.json');
const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
const archive=path.join(__dirname,'../reports/frontier-managed-mooncake-20260926');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>JSON.parse(fs.readFileSync(path.join(archive,name)));
test('Mooncake retains ten matched observations, raw metric audits and actual HBM release',()=>{
 const points=data.points.filter(p=>p.evidence.benchmark_protocol?.campaign==='qwen35-managed-mooncake-20260926');
 assert.equal(points.length,10);
 const audits=read('latency-audit.json');assert.equal(audits.passed,true);assert.equal(audits.windows.length,10);
 assert.equal(read('pair-status.json').passed,true);
 const launches={};const metadata={};
 for(const arm of ['native','mooncake']){
  const candidate=arm==='mooncake';
  const rows=points.filter(p=>Boolean(p.configuration.mods.length)===candidate).sort((a,b)=>a.load.concurrency-b.load.concurrency);
  assert.deepEqual(rows.map(p=>p.load.concurrency),[1,2,4,8,16]);
  const packed=fs.readFileSync(path.join(archive,`metadata-${arm}.json.gz`));metadata[arm]=JSON.parse(gunzipSync(packed));
  const q=read(`${arm}-qualification.json`);assert.equal(q.state.passed,true);assert.equal(q.gate.completed_requests,26);assert.equal(q.prefix.passed,true);
  assert.deepEqual(q.state.owned_processes_after_stop,[]);assert.deepEqual(q.state.hbm_after_stop.processes,[]);
  for(const device of Object.values(q.state.hbm_after_stop.devices))assert.ok(device.used_mb<=4500);
  launches[arm]=q.custody.serving_child.argv.slice();
  for(const p of rows){
   const params=p.configuration.parameters;const run=evidence.runs.find(r=>r.point_id===p.id);
   assert.deepEqual(p.configuration.mods,candidate?['mooncake-vllm-connectors']:[]);
   assert.equal(params.mtp_draft_tokens,2);assert.equal(params.prefix_caching,true);assert.equal(params.async_scheduling,true);assert.equal(params.graph_mode,'FULL_AND_PIECEWISE');
   assert.equal(p.configuration.hardware.accelerator_count,2);assert.equal(p.evidence.measurement_seconds,900);
   assert.equal(params.runtime_receipt.full_metadata.sha256,sha(packed));
   const raw=gunzipSync(fs.readFileSync(path.join(archive,`${arm}-c${p.load.concurrency}-requests.jsonl.gz`)));
   assert.equal(sha(raw),run.requests_content_sha256);
   const audit=audits.windows.find(a=>a.run_id===run.run_id);assert.equal(audit.raw_requests_sha256,sha(raw));assert.equal(audit.output_tps,p.metrics.output_tps);
   assert.equal(run.validation.hbm_release_observed,true);
   if(candidate){assert.equal(params.kv_transfer_config.kv_connector,'AscendStoreConnector');assert.equal(params.mod_runtime_effectiveness.status,'unavailable');assert.equal(params.mod_runtime_effectiveness.transfer_bytes,null);}
  }
 }
 const index=launches.mooncake.indexOf('--kv-transfer-config');assert.ok(index>0);launches.mooncake.splice(index,2);assert.deepEqual(launches.native,launches.mooncake);
 for(const key of ['runtime_source_files','core_patch','ascend_provenance','prepared_workload_sha256','model_manifest_sha256'])assert.deepEqual(metadata.native[key],metadata.mooncake[key]);
});
