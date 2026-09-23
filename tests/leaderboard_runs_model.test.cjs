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
    assert.equal(model.selectRows(rows,{engine:['vllm','unknown'],ttft:[0]}).length,2);
    assert.deepEqual(model.selectRows(rows,{engine:['vllm'],ttft:[0]}).map(r=>r.id),['a']);
    assert.equal(model.selectRows(rows,{engine:[]}).length,0);
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

const fs = require('node:fs');
const read = name => JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../data/', name)));
const realPayload = Object.fromEntries(['single','multi','historical'].map(k=>[k,read(`leaderboard_${k}.json`)]));
const supplement = read('leaderboard_run_observations.json');
const catalog = read('ecosystem.json');
const attributions = read('leaderboard_mod_attributions.json');
test('reviewed identities resolve to the workshop catalog without changing evidence or coverage',()=>{
    const before=model.build(realPayload,supplement), after=model.build(realPayload,supplement,catalog,attributions);
    assert.equal(after.rows.length,356);
    const old=new Map(before.rows.map(r=>[r.id,r]));
    for(const row of after.rows) {
        assert.deepEqual(row.metrics,old.get(row.id).metrics);
        assert.equal(row.taskId,old.get(row.id).taskId);
        if(row.modName) {
            const component=catalog.components.find(c=>c.id===row.mod);
            assert.equal(row.modName,component.name);
            assert.deepEqual(row.modMaintainers,component.maintainers);
        }
    }
    const counts={}; for(const r of after.rows) {const key=`${r.mod}:${r.modStatus}`;counts[key]=(counts[key]||0)+1;}
    assert.deepEqual(counts,{'none:baseline':47,'betterscale:enabled':30,'unknown:unknown':248,
        'simllm-migration:related':26,'kv-tiering-migration:baseline':1,'kv-tiering-migration:related':2,
        'prefix-router-migration:enabled':1,'split-batch-full-graph-migration:baseline':1});
    for(const row of after.rows.filter(r=>r.mod==='betterscale')) {
        assert.equal(row.engine,'vllm'); assert.equal(row.engineVersion,'v0.25.1');
        assert.equal(row.modVersion,row.entry.engine_version);
    }
    assert(after.rows.some(r=>r.mod==='none' && r.entry.same_spec.resolved_server_parameters.worker_cls==='betterscale.worker.Worker'));
});
test('all audited IDs exist exactly once; known catalog identities are not invented',()=>{
    const entries=new Map([...realPayload.historical,...realPayload.single,...realPayload.multi].map(e=>[e.entry_id,e]));
    const ids=new Set();
    for(const g of attributions.groups) {
        if(g.component_id) assert(catalog.components.some(c=>c.id===g.component_id));
        assert(g.evidence_urls.length);
        for(const id of g.entry_ids) {assert(entries.has(id));assert(!ids.has(id));ids.add(id);}
    }
});
test('MOD selection separates related experiments and baselines; engine is independent',()=>{
    const {rows}=model.build(realPayload,supplement,catalog,attributions);
    const key=model.stable(['kv-tiering-migration','related']);
    assert.equal(model.selectRows(rows,{mod:[key],engine:['vllm-hust']}).length,2);
    assert.equal(model.selectRows(rows,{mod:[key],engine:['vllm']}).length,0);
});
test('missing identity evidence or catalog does not guess MOD from engine, branch or worker',()=>{
    const e=fixture('new-record',{engine:'vllm-hust',metadata:{github_ref:'ascend-pr66-simllm-kv-manager'}});
    assert.equal(model.build({single:[e]}, {}, catalog,attributions).rows[0].mod,'unknown');
    const noCatalog=model.build(realPayload,supplement,{},attributions);
    assert(noCatalog.rows.filter(r=>r.entry.engine==='betterscale').every(r=>r.mod==='unknown'));
    const noEvidence=model.build(realPayload,supplement,catalog,{});
    assert(noEvidence.rows.every(r=>r.mod==='unknown'));
});

test('legacy attribution evidence pins match the recorded source and activation facts',()=>{
    const {rows}=model.build(realPayload,supplement,catalog,attributions);
    for(const row of rows.filter(r=>r.mod==='simllm-migration')) {
        assert(['e0686f12d1af74e6df97dfdaf7d314b4b3de10f7',
            '312ca80a90cbd28438bce3b59e3fbaad749451f3',
            'a05a9efe54c783cd4030d9aae8c8341b8c5e0d4b'].includes(row.entry.metadata.runtime_provenance.plugin.commit));
    }
    const prefix=rows.find(r=>r.mod==='prefix-router-migration');
    assert.equal(prefix.entry.same_spec.resolved_server_parameters.enable_prefix_routing,true);
    const split=rows.find(r=>r.mod==='split-batch-full-graph-migration');
    assert.equal(split.entry.metadata.runtime_provenance.plugin.commit,'cd29480d9699616adf6808fb6ccc3107bc9f1384');
    const base=rows.find(r=>r.mod==='kv-tiering-migration'&&r.modStatus==='baseline');
    assert.equal(base.entry.metadata.git_commit,'e0c0ce8e37e0fcd0f7a133c5c8eee68110295445');
    assert(rows.filter(r=>/pr49-kv-offload-worker|current-main-cpu-offload-kv/.test(r.entry.metadata.github_ref)).every(r=>r.mod==='unknown'));
});
