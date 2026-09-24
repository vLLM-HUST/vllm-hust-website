const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../assets/leaderboard-frontier-model.js');
const fixture=require('./fixtures/leaderboard_frontier.json');
function agentxData() {
    const all=require('../data/leaderboard_frontier.json');
    const cohorts=all.cohorts.filter(c=>c.workload.id.startsWith('agentx'));
    const ids=new Set(cohorts.map(c=>c.id));
    return {...all,cohorts,points:all.points.filter(p=>ids.has(p.cohort_id))};
}
test('production and empty snapshots validate without inventing points',()=>{
    const data=require('../data/leaderboard_frontier.json');
    model.validate(data);
    assert.deepEqual(model.validate({schema_version:'leaderboard-frontier/v1',cohorts:[],points:[]}).points,[]);
    assert.equal(model.project([], 'interactivity','output_tps_per_chip').frontier.length,0);
});
test('SWE observations keep their fixed-window protocol and real MTP separate from AgentX',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
    const cohort=data.cohorts.find(c=>c.workload.id==='sweprefix-qwen35-eight-traces-900s-v1');
    assert.ok(cohort);
    assert.equal(cohort.workload.contract.repository_url,'https://github.com/vLLM-HUST/swe-prefix-reuse');
    const points=data.points.filter(p=>p.cohort_id===cohort.id);
    assert.ok(points.length>0);
    assert.equal(points.length,evidence.runs.length);
    assert.equal(agentxData().points.length,16);
    for(const p of points){
        const run=evidence.runs.find(r=>r.run_id===p.evidence.run_ids[0]);
        assert.ok(run);
        assert.equal(run.summary.valid,true);
        assert.equal(run.summary.aborted,false);
        assert.equal(run.summary.failed_requests,0);
        assert.equal(run.summary.measurement_seconds,900);
        assert.deepEqual(p.metrics,run.metrics);
        assert.equal(p.metrics.output_tps,run.summary.observed_output_tokens_in_window/900);
        assert.equal(model.value(p,'output_tps_per_chip'),run.summary.output_tokens_per_second_per_chip);
        assert.equal(p.configuration.hardware.accelerator_count,run.client.chips);
        assert.equal(p.metrics.decode_p90_tps,run.summary.decode_tokens_per_second_p90);
        assert.equal(p.load.concurrency,run.client.concurrency);
        assert.equal(p.configuration.parameters.synthetic_acceptance_length,undefined);
        assert.equal(p.evidence.benchmark_protocol.protocol_id,'swe-prefix-reuse/v1');
        assert.equal(p.evidence.benchmark_protocol.prepared_workload_sha256,cohort.workload.contract.prepared_workload_sha256);
        assert.ok(agentxData().points.some(old=>old.id===run.old_point_id));
        assert.equal(run.client.endpoint,undefined);
        assert.equal(run.client.server_metadata,undefined);
    }
});
test('contract validates fixture, rejects unknown cohort, duplicate IDs and unsupported context',()=>{
    assert.equal(model.validate(fixture).points.length,5);
    for(const alter of [d=>d.points[0].cohort_id='absent', d=>d.points[1].id=d.points[0].id,
        d=>d.points[0].configuration.context_capacity_tokens=100,
        d=>d.points[0].metrics.tpot_ms=-1, d=>d.points[0].metrics.tpot_ms=Infinity,
        d=>d.points[0].evidence.url='javascript:alert(1)', d=>d.points[0].cost.usd_per_hour=-2,
        d=>d.points[0].evidence.status='unverified',d=>d.cohorts.push({...d.cohorts[0],id:'duplicate-contract'})]) {
        const data=structuredClone(fixture);alter(data);assert.throws(()=>model.validate(data));
    }
});
test('max/max dominance retains tradeoffs and ties, excludes missing observations',()=>{
    const result=model.project(fixture.points,'interactivity','output_tps_per_chip');
    assert.equal(result.excluded,1);
    assert.deepEqual(result.frontier.map(r=>r.point.id).sort(),['test-efficient','test-fast','test-tie']);
    assert.equal(result.measured.find(r=>r.point.id==='test-dominated').frontier,false);
});
test('mixed/minimum directions and missing prices use the correct frontier',()=>{
    const result=model.project(fixture.points,'ttft_p95_ms','cost_per_million');
    assert.equal(result.excluded,2);
    assert.deepEqual(result.frontier.map(r=>r.point.id),['test-fast','test-efficient']);
    assert.equal(model.value(fixture.points[0],'cost_per_million'),10*1e6/(3600*200));
    assert.equal(model.value(fixture.points[0],'output_tps_per_chip'),100);
    assert.equal(model.value(fixture.points[0],'interactivity'),50);
});
test('zero TPOT, missing metrics and prices never become infinite or free',()=>{
    const p=structuredClone(fixture.points[0]);p.metrics.tpot_ms=0;p.cost=null;
    assert.equal(model.value(p,'interactivity'),null);assert.equal(model.value(p,'cost_per_million'),null);
    delete p.metrics.ttft_p95_ms;assert.equal(model.value(p,'ttft_p95_ms'),null);
});
test('MOD combinations are order independent and no-MOD is a distinct group',()=>{
    assert.equal(model.modKey({configuration:{mods:['b','a']}}),'a+b');
    assert.equal(model.modKey({configuration:{mods:[]}}),'none');
});
test('published smoke points preserve official metrics and all allocated chips',()=>{
    const data=agentxData();
    const evidence=require('../data/leaderboard_frontier_evidence.json');
    model.validate(data);
    const points=data.points.filter(p=>p.configuration.hardware.accelerator_count===2);
    assert.equal(points.length,evidence.runs.length);
    assert.equal(new Set(data.points.map(p=>p.evidence.run_ids[0])).size,data.points.length);
    assert.equal(data.cohorts[0].workload.contract.profile,'smoke');
    for(const p of points){
        const run=evidence.runs.find(r=>r.run_id===p.evidence.run_ids[0]);
        assert.ok(run);
        assert.equal(p.evidence.measurement_seconds,900);
        assert.equal(p.evidence.tuning_complete,false);
        assert.equal(run.official_metrics.metadata.submission_valid,true);
        assert.equal(p.metrics.output_tps,run.official_metrics.output_token_throughput.avg);
        assert.equal(model.value(p,'decode_p90_tps'),run.official_metrics.output_token_throughput_per_user.p90);
        assert.notEqual(model.value(p,'decode_p90_tps'),1000/run.official_metrics.inter_token_latency.p90);
        assert.equal(p.metrics.tpot_ms,run.official_metrics.inter_token_latency.avg);
        assert.equal(p.metrics.ttft_p95_ms,run.official_metrics.time_to_first_token.p95);
        assert.equal(model.value(p,'output_tps_per_chip'),p.metrics.output_tps/2);
        assert.equal(model.value(p,'interactivity'),1000/run.official_metrics.inter_token_latency.avg);
        assert.equal(model.value(p,'cost_per_million'),null);
        assert.equal(p.configuration.parameters.tensor_parallel_size,2);
        assert.ok([1,2,4,8,16].includes(p.load.concurrency));
        assert.equal(p.evidence.profile,'smoke');
    }
    // Better mean interactivity does not conceal the slightly worse TTFT tail.
    const initial=data.points.filter(p=>p.configuration.parameters.max_num_seqs===8);
    assert.equal(initial.length,2);
    assert.equal(model.project(initial,'ttft_p95_ms','output_tps_per_chip').frontier.length,2);
    const capacity=data.points.filter(p=>p.configuration.parameters.max_num_seqs===16);
    assert.equal(capacity.length,9);
    for(const p of capacity){
        const arm=p.configuration.mods.length?'full':'native';
        assert.equal(p.configuration.parameters.kv_cache_memory_bytes,evidence.capacity_series.kv_cache_bytes_per_chip[arm]);
    }
    for(const invalid of evidence.capacity_series.invalid){
        assert.ok(!data.points.some(p=>p.evidence.run_ids.includes(invalid.run_id)));
    }
});

test('P90 decode speed projects the recorded percentile, never a TPOT reciprocal fallback',()=>{
    const p=structuredClone(fixture.points[0]);
    p.metrics.decode_p90_tps=90;p.metrics.tpot_p95_ms=50;
    assert.equal(model.value(p,'decode_p90_tps'),90);
    delete p.metrics.decode_p90_tps;
    assert.equal(model.value(p,'decode_p90_tps'),null);
    assert.equal(model.project([p],'decode_p90_tps','output_tps_per_chip').excluded,1);
});


test('C64 expert observations share one view and preserve point-specific protocols',()=>{
    const data=agentxData();
    const evidence=require('../data/leaderboard_frontier_expert_evidence.json');
    assert.equal(data.cohorts.length,1);
    assert.equal(data.points.length,16);
    const points=data.points.filter(p=>p.configuration.hardware.accelerator_count===8);
    assert.equal(points.length,5);
    for(const p of data.points) assert.equal(p.cohort_id,data.cohorts[0].id);
    for(const p of points){
        const run=evidence.runs.find(r=>r.run_id===p.evidence.run_ids[0]);
        assert.ok(run); assert.equal(run.official_metrics.metadata.submission_valid,true);
        assert.deepEqual(run.official_metrics.error_summary,[]);
        assert.equal(run.official_metrics.osl_mismatch_count.avg,0);
        assert.equal(model.value(p,'output_tps_per_chip'),run.official_metrics.output_token_throughput.avg/8);
        assert.equal(model.value(p,'decode_p90_tps'),run.official_metrics.output_token_throughput_per_user.p90);
        assert.equal(p.evidence.measurement_seconds,900);assert.equal(p.load.concurrency,64);
        assert.equal(p.configuration.parameters.mtp_draft_tokens,0);
        assert.deepEqual(p.evidence.benchmark_protocol,run.protocol);
        assert.equal(run.protocol.protocol_id,'agentx256k-snapshot-primers-v2');
        assert.equal(run.warmup.completed_requests,63);assert.equal(run.warmup.completed,true);
        assert.ok(p.configuration.parameters.checkpoint_revision.startsWith('sha256-manifest:'));
    }
    for(const p of data.points.filter(p=>p.configuration.hardware.accelerator_count===2)){
        assert.equal(p.evidence.benchmark_protocol.warmup_requests_per_lane,10);
        assert.equal(p.configuration.parameters.mtp_draft_tokens,2);
    }
    assert.ok(!data.points.some(p=>p.id.includes('expert-') && p.load.concurrency===16));
});


test('MTP filter classifies explicit settings without treating missing as off',()=>{
    const point=tokens=>({configuration:{parameters:{mtp_draft_tokens:tokens}}});
    assert.equal(model.mtpState(point(0)),'off');
    assert.equal(model.mtpState(point(2)),'on');
    for(const value of [undefined,null,-1,'0',NaN])assert.equal(model.mtpState(point(value)),'unknown');
    const data=agentxData();
    assert.equal(data.points.filter(p=>model.mtpState(p)==='on').length,11);
    assert.equal(data.points.filter(p=>model.mtpState(p)==='off').length,5);
});
