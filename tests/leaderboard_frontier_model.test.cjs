const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../assets/leaderboard-frontier-model.js');
const fixture=require('./fixtures/leaderboard_frontier.json');
test('production and empty snapshots validate without inventing points',()=>{
    const data=require('../data/leaderboard_frontier.json');
    model.validate(data);
    assert.deepEqual(model.validate({schema_version:'leaderboard-frontier/v1',cohorts:[],points:[]}).points,[]);
    assert.equal(model.project([], 'interactivity','output_tps_per_chip').frontier.length,0);
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
    const data=require('../data/leaderboard_frontier.json');
    const evidence=require('../data/leaderboard_frontier_evidence.json');
    model.validate(data);
    assert.equal(data.points.length,evidence.runs.length);
    assert.equal(new Set(data.points.map(p=>p.evidence.run_ids[0])).size,data.points.length);
    assert.equal(data.cohorts[0].workload.contract.profile,'smoke');
    for(const p of data.points){
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
