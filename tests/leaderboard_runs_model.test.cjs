const {test} = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/leaderboard-runs-model.js');
const fixture = (id, extra = {}) => ({entry_id:id, engine:'vllm', model:{name:'Qwen',precision:'BF16'},
    hardware:{vendor:'Huawei',chip_model:'910B2',chip_count:2}, workload:{name:'random-online',input_length:1024,output_length:256},
    same_spec:{resolved_server_parameters:{tensor_parallel_size:2,enforce_eager:false},resolved_client_parameters:{max_concurrency:8,num_prompts:200}},
    metrics:{ttft_ms:0,tbt_ms:4,throughput_tps:100},metadata:{},...extra});
test('same task across MOD / graph; different load is a different tag',()=>{
    const a=fixture('a'),b=fixture('b',{engine:'betterscale'});
    b.same_spec=structuredClone(a.same_spec); b.same_spec.resolved_server_parameters.compilation_config={cudagraph_mode:'FULL'};
    const c=structuredClone(b);c.entry_id='c';c.same_spec.resolved_client_parameters.max_concurrency=4;
    const result=model.build({multi:[a,b,c]});
    assert.equal(result.tasks.length,2);assert.equal(result.rows.find(r=>r.id==='a').taskId,result.rows.find(r=>r.id==='b').taskId);
});
test('raw repeats replace aggregate, preserve zero, missing percentile stays null',()=>{
    const parent=fixture('aggregate',{canonical_aggregate:{count:2,method:'mean'}});
    const a=fixture('a'),b=fixture('b');a.metrics.ttft_p95_ms=7;b.metrics.ttft_p95_ms=30;
    const result=model.build({multi:[parent]},{observations:{aggregate:[a,b]}});
    assert.equal(result.rows.length,2);assert.deepEqual(result.rows.map(r=>r.metrics.ttftP95).sort((x,y)=>x-y),[7,30]);
    assert.equal(result.rows[0].metrics.ttft,0);assert.equal(result.rows[0].metrics.tpotP95,null);
});
test('aggregate percentiles and long-context constraints never masquerade as run P95',()=>{
    const entry=fixture('a',{canonical_aggregate:{count:2},constraints:{metrics:{long_context_ttft_p95_ms:42}}});
    entry.metrics.ttft_p95_ms=19;
    const row=model.build({multi:[entry]}).rows[0];assert.equal(row.metrics.ttftP95,null);assert.equal(row.aggregate.count,2);
});
test('current record wins duplicate history; distinct runs are not best-selected',()=>{
    const a=fixture('a'),b=fixture('b');const old=structuredClone(a);old.historical_recovery={admitted_for_historical_trend:true};
    const result=model.build({multi:[a,b],historical:[old]});assert.equal(result.rows.length,2);
});
test('hardware and precision separate model scopes; parallelism is never inferred from chip count',()=>{
    const a=fixture('a'),b=fixture('b',{hardware:{chip_model:'910B3',chip_count:2},same_spec:{}});
    const result=model.build({multi:[a,b]});assert.notEqual(result.rows[0].modelKey,result.rows[1].modelKey);assert.equal(model.parallel(b).label,'—');
});
test('offline EngineArgs are run knobs, not distinct tasks',()=>{
    const a=fixture('a'),b=fixture('b');b.same_spec=structuredClone(a.same_spec);b.same_spec.resolved_client_parameters.worker_cls='owned.Worker';
    b.same_spec.resolved_client_parameters.compilation_config='FULL';
    b.same_spec.resolved_client_parameters.scheduler_cls='apc_boundary.BoundaryScheduler';
    assert.deepEqual(model.taskDefinition(a),model.taskDefinition(b));
});
test('unrecorded flags are unknown and unsafe URLs are rejected',()=>{
    assert.match(model.graphPrefix(fixture('a',{same_spec:{}})),/graph \?/);
    assert.equal(model.safeURL('javascript:alert(1)'),null);assert.equal(model.safeURL('https://github.com/a/b'),'https://github.com/a/b');
});
test('column filters combine OR within columns and AND across columns; empty means none',()=>{
    const a=fixture('a'),b=fixture('b',{engine:'betterscale'}),c=fixture('c');
    c.metrics.ttft_ms=100;
    const rows=model.build({multi:[a,b,c]}).rows;
    assert.equal(model.selectRows(rows,{mod:['native','betterscale'],ttft:[0]}).length,2);
    assert.deepEqual(model.selectRows(rows,{mod:['native'],ttft:[0]}).map(r=>r.id),['a']);
    assert.equal(model.selectRows(rows,{mod:[]}).length,0);
});
test('numeric sorting uses raw values, is stable, leaves missing values last in both directions',()=>{
    const rows=[2,10,null,0,2].map((value,index)=>({id:String(index),metrics:{ttft:value}}));
    assert.deepEqual(model.selectRows(rows,{}, {key:'ttft',direction:'asc'}).map(r=>r.id),['3','0','4','1','2']);
    assert.deepEqual(model.selectRows(rows,{}, {key:'ttft',direction:'desc'}).map(r=>r.id),['1','0','4','3','2']);
    assert.deepEqual(rows.map(r=>r.id),['0','1','2','3','4']);
});
test('text sorting follows task labels rather than opaque task identities',()=>{
    const rows=[{taskId:'z',taskLabel:'Alpha',metrics:{}},{taskId:'a',taskLabel:'Beta',metrics:{}}];
    assert.equal(model.selectRows(rows,{}, {key:'task',direction:'asc'})[0].taskLabel,'Alpha');
});

test('hardware is an ordinary filterable and sortable column, without dropping history', () => {
    const a=fixture('a'), b=fixture('b', {hardware:{vendor:'Huawei',chip_model:'910B3',chip_count:2},
        historical_recovery:{admitted_for_historical_trend:true}});
    const {rows}=model.build({single:[a],historical:[b]});
    assert.equal(rows.length,2);
    assert.deepEqual(model.selectRows(rows,{hardware:['Huawei · 910B3']}).map(r=>r.id),['b']);
    assert.deepEqual(model.selectRows(rows,{}, {key:'hardware',direction:'asc'}).map(r=>r.id),['a','b']);
    assert.deepEqual(model.selectRows(rows,{}, {key:'hardware',direction:'desc'}).map(r=>r.id),['b','a']);
});
