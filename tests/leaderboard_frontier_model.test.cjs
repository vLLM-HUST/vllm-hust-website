const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../assets/leaderboard-frontier-model.js');
const fixture=require('./fixtures/leaderboard_frontier.json');
test('empty production snapshot is valid and supplies no invented points',()=>{
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
