const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../assets/leaderboard-frontier-model.js');
const fixture=require('./fixtures/leaderboard_frontier.json');
function agentxData() {
    const all=require('../data/leaderboard_frontier.json');
    const cohorts=all.cohorts.filter(c=>c.workload.id.startsWith('agentx'));
    const ids=new Set(cohorts.map(c=>c.id));
    return {...all,cohorts,points:[...all.points,...(all.archived_points||[])].filter(p=>ids.has(p.cohort_id))};
}
test('concurrency lines connect only declared same-cohort series in C order',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const projected=model.project(data.points,'decode_p90_tps','output_tps_per_chip');
    const lines=model.concurrencySeries(projected.measured);
    const native=lines.find(rows=>rows[0].point.load.concurrency_series==='swe-capacity16-native');
    assert.ok(native.length>=4);
    assert.deepEqual(native.map(row=>row.point.load.concurrency),[...native.map(row=>row.point.load.concurrency)].sort((a,b)=>a-b));
    const legacy=lines.filter(rows=>['swe-capacity16-native','swe-capacity16-full'].includes(rows[0].point.load.concurrency_series));
    assert.ok(legacy.flat().every(row=>row.point.configuration.parameters.max_num_seqs===16));
    for(const rows of lines){
        const first=rows[0].point;
        assert.ok(rows.every(row=>row.point.cohort_id===first.cohort_id && row.point.load.concurrency_series===first.load.concurrency_series));
        const fixed=p=>[p.configuration.mods,p.configuration.hardware.accelerator_count,...['max_num_seqs','total_serving_slots','tensor_parallel_size','data_parallel_size','expert_parallel','mtp_draft_tokens','graph_mode','max_model_len','max_num_batched_tokens','gpu_memory_utilization','execution_host'].map(k=>p.configuration.parameters[k])];
        for(const row of rows) assert.deepEqual(fixed(row.point),fixed(first));
        assert.deepEqual(rows.map(row=>row.point.load.concurrency),rows.map(row=>row.point.load.concurrency).sort((a,b)=>a-b));
    }
    assert.equal(model.concurrencySeries(native.slice(0,1)).length,0);
    const other={...native[0],point:{...native[0].point,cohort_id:'other-workload'}};
    assert.equal(model.concurrencySeries([native[0],other]).length,0);
    const hidden=model.concurrencySeries(native.filter(row=>row.point.load.concurrency!==2));
    assert.ok(hidden.flat().every(row=>row.point.load.concurrency!==2));
});
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
    const cohorts=data.cohorts.filter(c=>c.workload.contract.repository_url==='https://github.com/vLLM-HUST/swe-prefix-reuse');
    const byId=new Map(cohorts.map(c=>[c.id,c]));
    const points=[...data.points,...(data.archived_points||[])].filter(p=>byId.has(p.cohort_id));
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
        const contract=byId.get(p.cohort_id).workload.contract;
        const variants=contract.prepared_workload_variants||[{sha256:contract.prepared_workload_sha256}];
        assert.ok(variants.some(v=>v.sha256===p.evidence.benchmark_protocol.prepared_workload_sha256));
        assert.equal(p.evidence.benchmark_protocol.tokenizer_fingerprint||run.client.tokenizer.fingerprint,contract.tokenizer_fingerprint);
        if(run.old_point_id) assert.ok(agentxData().points.some(old=>old.id===run.old_point_id));
        else if(p.evidence.benchmark_protocol.campaign==='server32-c32-extension'){
            assert.equal(p.load.concurrency,32);
            assert.equal(p.configuration.parameters.max_num_seqs,32);
            assert.equal(p.load.concurrency_series,undefined);
            assert.equal(run.capacity_validation.passed,true);
            assert.equal(run.capacity_validation.preemptions,0);
            assert.equal(run.capacity_validation.max_observed_running,32);
            assert.ok(agentxData().points.some(old=>old.id===run.configuration_source_point_id));
        } else if(p.evidence.benchmark_protocol.campaign==='attention-expert-parallel-matrix'){
            const params=p.configuration.parameters;
            assert.equal(params.attention_tensor_parallel_size*params.attention_data_parallel_size,2);
            assert.equal(params.expert_tensor_parallel_size*params.expert_parallel_size,2);
            assert.equal(params.max_num_seqs*params.data_parallel_size,32);
            assert.equal(params.mtp_draft_tokens,2);
            assert.equal(run.capacity_validation.passed,true);
            assert.equal(run.partition_validation.status,'PASS');
            assert.equal(run.partition_validation.physical_moe_layers,41);
            assert.equal(run.validation.owned_server_exit_zero,true);
            assert.ok(p.load.concurrency_series);
        } else if(p.evidence.benchmark_protocol.campaign==='small-fish-tp2-sweep-v1'){
            const params=p.configuration.parameters;
            assert.equal(params.max_num_seqs,16);
            assert.equal(params.max_num_batched_tokens,4096);
            assert.equal(params.mtp_draft_tokens,2);
            assert.equal(params.kv_cache_memory_bytes,26038239232);
            for(const key of ['owned_server_exit_zero','selected_device_guard_exit_zero','selected_devices_released','exact_token_budgets','prefix_cache_observed']) assert.equal(run.validation[key],true);
            if(p.configuration.mods.includes('betterscale')){
                assert.equal(params.draft_only_distributed_greedy,true);
                assert.equal(params.gdn_strided_gates,true);
                assert.equal(params.mixed_shared_qkv_pack,true);
            }
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-mods-k8s-20260925'){
            assert.equal(run.retrieval_qualification.passed,true);
            assert.equal(run.retrieval_qualification.completed_requests,26);
            assert.equal(run.model_verification.verified,true);
            assert.equal(run.model_verification.files_checked,22);
            assert.equal(run.prepared_workload_equivalence.reconstructed_reference_sha256,contract.prepared_workload_sha256);
            for(const key of ['owned_server_exit_zero','selected_devices_released','exact_token_budgets','prefix_cache_observed']) assert.equal(run.validation[key],true);
            assert.ok(run.validation.prefix_hit_token_delta>0);
            assert.equal(p.configuration.parameters.kv_cache_memory_bytes,26038239232);
            assert.equal(p.configuration.hardware.accelerator_count,2);
            if(p.configuration.mods.includes('bidkv')){
                assert.equal(run.policy_effectiveness.enabled,true);
                assert.equal(run.policy_effectiveness.failures,0);
                assert.equal(run.policy_effectiveness.invalid_selections,0);
                if(run.policy_effectiveness.calls===0) assert.equal(run.policy_effectiveness.status,'not-exercised');
            }
        } else if(['qwen35-pipeline-k8s-20260925','qwen35-mod-curves-20260925'].includes(p.evidence.benchmark_protocol.campaign)){
            assert.equal(run.retrieval_qualification.passed,true);
            assert.equal(run.retrieval_qualification.completed_requests,26);
            assert.equal(p.configuration.hardware.accelerator_count,4);
            assert.equal(p.configuration.parameters.pipeline_parallel_size,2);
            for(const key of ['owned_server_exit_zero','selected_devices_released','exact_token_budgets','prefix_cache_observed']) assert.equal(run.validation[key],true);
            assert.ok(run.validation.prefix_hit_token_delta>0);
            if(p.configuration.mods.includes('pipeline-microbatch-migration')){
                assert.equal(run.policy_effectiveness.status,'exercised');
                for(const key of ['calls','admissions','completions']) assert.ok(run.policy_effectiveness[key]>0);
                for(const key of ['aborts','failures','invalid_admissions','builtin_fallbacks']) assert.equal(run.policy_effectiveness[key],0);
                const calibration=p.configuration.parameters.calibration;
                assert.equal(calibration.profiling_in_measurement,false);
                assert.equal(calibration.validation.passed,true);
                assert.equal(calibration.validation.ranks.length,4);
                assert.ok(calibration.validation.ranks.every(r=>r.passed && r.rows>=40));
            }
        } else assert.equal(p.evidence.benchmark_protocol.campaign,'repaired-mtp2-separated-experts-c64');
        assert.equal(run.client.endpoint,undefined);
        assert.equal(run.client.server_metadata,undefined);
    }
});
test('real-MTP expert points account for all eight chips and preserve native EP/capacity evidence',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
    for(const arm of ['a4e4','a6e2','dp8ep8','tp8ep8']){
        const id=arm.startsWith('a') ? `qwen35-sweprefix-realmtp2-${arm}-cap7-c64-hw3-20260924` : `qwen35-sweprefix-realmtp2-${arm}-c64-20260924`;
        const p=[...data.points,...(data.archived_points||[])].find(p=>p.id===id);
        assert.ok(p);
        const run=evidence.runs.find(r=>r.point_id===p.id);
        const params=p.configuration.parameters;
        assert.equal(p.configuration.hardware.accelerator_count,8);
        assert.equal(params.mtp_draft_tokens,2);
        assert.equal(params.kv_cache_memory_bytes,32*1024**3);
        assert.equal(p.load.concurrency,64);
        assert.equal(run.validation.all_role_exits_zero,true);
        assert.equal(run.validation.selected_devices_released,true);
        assert.ok(params.lifecycle_prefix_cache_hit_fraction>0);
        assert.ok(params.correctness_bridge.includes('9f58da1'));
        if(arm.startsWith('a')){
            assert.equal(params.attention_ranks+params.expert_ranks,8);
            assert.equal(run.validation.direct_resident_experts_verified,true);
        } else {
            assert.equal(params.expert_parallel_size,8);
            assert.equal(run.validation.actual_ep_partition_verified,true);
        }
        if(arm==='tp8ep8') assert.ok(params.capacity_caveat.includes('32 live request slots'));
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

test('AE separation is a tracking group, not a new MOD or a TP/EP alias',()=>{
    const data=model.validate(require('../data/leaderboard_frontier.json'));
    const separated=data.archived_points.filter(p=>p.display_withdrawal && p.configuration.experiment_group==='betterscale-AEseparation');
    assert.equal(separated.length,4);
    for(const p of separated){
        assert.equal(model.groupKey(p),'betterscale-AEseparation');
        assert.equal(model.modKey(p),'betterscale');
        assert.ok(p.configuration.parameters.attention_ranks>0 && p.configuration.parameters.expert_ranks>0);
        assert.equal(p.load.concurrency_series,undefined);
    }
    for(const p of data.points.filter(p=>!p.configuration.parameters.expert_ranks)){
        assert.equal(model.groupKey(p),model.modKey(p));
    }
    const invalid=structuredClone(data);invalid.points[0].configuration.experiment_group=' ';
    assert.throws(()=>model.validate(invalid),/experiment group/);
});

test('A+E frontier retains highest-throughput point while preserving all earlier evidence',()=>{
    const d=require('../data/leaderboard_frontier.json');
    const archived=d.archived_points;
    model.validate({...d,points:[...d.points,...archived]});
    for(const arm of ['a4e4','a6e2']){
        const prefix=`qwen35-sweprefix-realmtp2-${arm}-`;
        const selected=archived.filter(p=>p.id.startsWith(prefix)&&p.display_withdrawal);
        assert.equal(selected.length,1);
        const p=selected[0];
        const earlier=archived.filter(p=>p.id.startsWith(prefix)&&!p.display_withdrawal);
        assert.equal(earlier.length,2);
        assert.equal(p.configuration.parameters.expert_sources_per_wave,7);
        assert.equal(p.configuration.parameters.execution_host,'hw3');
        for(const old of earlier){
            assert.equal(old.frontier_selection.selected_point_id,p.id);
            assert.ok(model.value(old,'output_tps_per_chip')<=model.value(p,'output_tps_per_chip'));
        }
        assert.deepEqual(new Set(p.frontier_selection.compared_point_ids),new Set([p.id,...earlier.map(p=>p.id)]));
    }
});
test('failed correctness references stay visible but cannot form or dominate the Pareto envelope',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const refs=data.points.filter(p=>p.id.startsWith('qwen27-sweprefix-native-'));
    assert.deepEqual(refs.map(p=>p.load.concurrency),[1,2,4,8,16]);
    for(const p of refs){
        assert.equal(model.failedCorrectness(p),true);
        assert.equal(p.configuration.parameters.functional_check_concurrency,16);
        assert.deepEqual(p.configuration.parameters.functional_failed_request_ids,[2,5,8,11,13]);
    }
    const projected=model.project(refs,'decode_p90_tps','output_tps_per_chip');
    assert.equal(projected.measured.length,5);
    assert.equal(projected.frontier.length,0);
    const valid=structuredClone(refs[0]);valid.id='qualified-control';valid.configuration.parameters.functional_status='bounded_pass';valid.metrics.output_tps=1;valid.metrics.decode_p90_tps=1;
    assert.deepEqual(model.project([...refs,valid],'decode_p90_tps','output_tps_per_chip').frontier.map(p=>p.point.id),[valid.id]);
});

test('one frontier per baseline/MOD crosses configurations, not cohorts; ties keep whole records',()=>{
    const seed=require('../data/leaderboard_frontier.json').points[0];
    const point=(id,mods,x,y,c=1,cohort=seed.cohort_id)=>({...structuredClone(seed),id,cohort_id:cohort,configuration:{...structuredClone(seed.configuration),mods,experiment_group:undefined,hardware:{...seed.configuration.hardware,accelerator_count:2}},load:{concurrency:c},metrics:{decode_p90_tps:x,output_tps:y*2}});
    const rows=[point('native-slow',[],10,10),point('native-fast',[],20,5,8),point('native-dominated',[],8,8),point('mod-throughput',['betterscale'],30,30,32),point('mod-speed',['betterscale'],40,20,2),point('mod-tie',['betterscale'],40,20,16),point('other-cohort',['betterscale'],100,100,1,'other')];
    const groups=model.groupFrontiers(rows,'decode_p90_tps','output_tps_per_chip');
    assert.deepEqual(groups.map(g=>g.map(r=>r.point.id)),[['native-slow','native-fast'],['mod-throughput','mod-speed'],['other-cohort']]);
    assert.deepEqual(model.groupFrontiers(rows.filter(p=>p.id!=='mod-throughput'),'decode_p90_tps','output_tps_per_chip')[1].map(r=>r.point.id),['mod-speed']);
    const failed=point('failed',['betterscale'],1000,1000);failed.configuration.parameters.functional_status='failed';
    assert.deepEqual(model.groupFrontiers([failed], 'decode_p90_tps','output_tps_per_chip'),[]);
    assert.deepEqual(model.groupFrontiers([], 'decode_p90_tps','output_tps_per_chip'),[]);
});
test('AE separation is withdrawn from display, not erased from evidence',()=>{
    const d=require('../data/leaderboard_frontier.json');
    assert.ok(d.points.every(p=>p.configuration.experiment_group!=='betterscale-AEseparation'));
    const withdrawn=d.archived_points.filter(p=>p.display_withdrawal);
    assert.equal(withdrawn.length,4);
    assert.ok(withdrawn.every(p=>p.configuration.experiment_group==='betterscale-AEseparation'));
});

test('sampling dates are calendar-valid UTC dates taken from recorded run starts',()=>{
    const d=require('../data/leaderboard_frontier.json');
    const runs=new Map(require('../data/leaderboard_frontier_swe_evidence.json').runs.map(r=>[r.run_id,r]));
    for(const p of [...d.points,...d.archived_points]){
        assert.match(p.evidence.sampling_date_utc,/^\d{4}-\d{2}-\d{2}$/);
        assert.ok(p.evidence.sampling_date_source);
        for(const id of p.evidence.run_ids){
            const run=runs.get(id);
            if(run)assert.equal(p.evidence.sampling_date_utc,new Date(run.client.started_at_unix*1000).toISOString().slice(0,10));
        }
    }
    for(const value of ['2026-02-30','2026-13-01','09/25/2026',123]){
        const bad=structuredClone(d);bad.points[0].evidence.sampling_date_utc=value;
        assert.throws(()=>model.validate(bad),/sampling date/);
    }
    const legacy=structuredClone(d);delete legacy.points[0].evidence.sampling_date_utc;model.validate(legacy);
});

test('BetterScale points carry immutable MOD pointers, not engine or benchmark revisions',()=>{
    const d=require('../data/leaderboard_frontier.json');
    const points=d.points.filter(p=>p.configuration.mods.includes('betterscale'));
    assert.ok(points.length);
    for(const p of points){
        const q=p.configuration.parameters, source=p.configuration.mod_sources.find(s=>s.id==='betterscale');
        assert.equal(source.repository,'https://github.com/vLLM-HUST/BetterScale');
        assert.match(source.revision,/^[0-9a-f]{40}$/);
        assert.ok(source.source_capsule && source.scope);
        if(q.mod_revision)assert.equal(source.revision,q.mod_revision.split(' ')[0]);
        if(q.matrix_adaptation_revision)assert.equal(source.revision,q.matrix_adaptation_revision);
        assert.notEqual(source.revision,q.benchmark_revision);
        if(q.mod_revision?.includes(' + '))assert.ok(source.local_adaptations);
    }
    for(const mutate of [s=>s.repository='javascript:alert(1)',s=>s.revision='main',s=>s.id='unloaded-mod']){
        const bad=structuredClone(d);const p=bad.points.find(p=>p.configuration.mod_sources);mutate(p.configuration.mod_sources[0]);
        assert.throws(()=>model.validate(bad),/MOD source/);
    }
});

test('fresh K8s native and BidKV controls retain identical common runtime and workload',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
    const points=data.points.filter(p=>p.evidence.benchmark_protocol?.campaign==='qwen35-mods-k8s-20260925');
    assert.equal(points.length,4);
    for(const concurrency of [4,16]){
        const pair=points.filter(p=>p.load.concurrency===concurrency);
        assert.equal(pair.length,2);
        const native=pair.find(p=>p.configuration.mods.length===0);
        const bidkv=pair.find(p=>p.configuration.mods.includes('bidkv'));
        assert.ok(native && bidkv);
        assert.deepEqual(native.evidence.benchmark_protocol,bidkv.evidence.benchmark_protocol);
        const a=native.configuration.parameters,b=bidkv.configuration.parameters;
        for(const key of ['tensor_parallel_size','pipeline_parallel_size','max_num_seqs','max_num_batched_tokens','kv_cache_memory_bytes','prefix_caching','async_scheduling','mtp_draft_tokens','mamba_cache_mode','graph_mode','graph_capture_sizes','worker_abi_bridge_sha256']){
            assert.notEqual(a[key],undefined,key);
            assert.deepEqual(a[key],b[key],key);
        }
        for(const key of ['packages','cann','wheel_sha256','model_manifest_sha256','worker_bridge_sha256','feedback_patch_files','core_commit','ascend_commit','shared_preemption_api_patch_sha256']){
            assert.deepEqual(a.runtime_receipt[key],b.runtime_receipt[key],key);
        }
        const clients=pair.map(p=>evidence.runs.find(r=>r.point_id===p.id).client);
        for(const key of ['duration','concurrency','chips','seed','workload_sha256'])assert.deepEqual(clients[0][key],clients[1][key],key);
    }
});

test('Pipeline PP2 matched observations share runtime and use all four participating chips',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
    const points=data.points.filter(p=>p.evidence.benchmark_protocol?.campaign==='qwen35-pipeline-k8s-20260925');
    assert.equal(points.length,4);
    for(const concurrency of [4,16]){
        const pair=points.filter(p=>p.load.concurrency===concurrency);
        assert.equal(pair.length,2);
        const native=pair.find(p=>p.configuration.mods.length===0);
        const candidate=pair.find(p=>p.configuration.mods.includes('pipeline-microbatch-migration'));
        assert.ok(native && candidate);
        assert.deepEqual(native.evidence.benchmark_protocol,candidate.evidence.benchmark_protocol);
        const a=native.configuration.parameters,b=candidate.configuration.parameters;
        for(const key of ['tensor_parallel_size','pipeline_parallel_size','max_num_seqs','max_num_batched_tokens','kv_cache_memory_bytes','prefix_caching','async_scheduling','mtp_draft_tokens','mamba_cache_mode','graph_mode','graph_capture_sizes','worker_abi_bridge_sha256']){
            assert.notEqual(a[key],undefined,key);
            assert.deepEqual(a[key],b[key],key);
        }
        for(const key of ['packages','cann','wheel_sha256','model_manifest_sha256','worker_bridge_sha256','runtime_source_files','source_patches_sha256','core_commit','ascend_commit']){
            assert.notEqual(a.runtime_receipt[key],undefined,key);
            assert.deepEqual(a.runtime_receipt[key],b.runtime_receipt[key],key);
        }
        for(const p of pair){
            assert.equal(p.configuration.hardware.accelerator_count,4);
            assert.equal(p.configuration.parameters.participating_deployment_chips,4);
            assert.deepEqual(p.configuration.parameters.physical_devices,[0,1,2,3]);
            assert.equal(p.configuration.parameters.pipeline_parallel_size,2);
            assert.equal(p.configuration.parameters.tensor_parallel_size,2);
            assert.equal(p.configuration.parameters.mtp_draft_tokens,2);
            assert.equal(p.configuration.parameters.prefix_caching,true);
            assert.equal(p.configuration.parameters.async_scheduling,true);
        }
        const clients=pair.map(p=>evidence.runs.find(r=>r.point_id===p.id).client);
        for(const key of ['duration','concurrency','chips','seed','workload_sha256']) assert.deepEqual(clients[0][key],clients[1][key],key);
        assert.notEqual(native.load.concurrency_series,candidate.load.concurrency_series);
    }
});

test('completed PP2 curves retain all five measured concurrency levels in their actual MOD groups',()=>{
    const data=require('../data/leaderboard_frontier.json');
    for(const arm of ['nativepp','pipelinepp']){
        const points=data.points.filter(p=>p.load.concurrency_series===`swe-k8s-pp2-20260925-${arm}-r1`);
        assert.deepEqual(points.map(p=>p.load.concurrency).sort((a,b)=>a-b),[1,2,4,8,16]);
        for(const point of points){
            assert.equal(point.configuration.experiment_group,undefined);
            assert.deepEqual(point.configuration.mods,arm==='nativepp'?[]:['pipeline-microbatch-migration']);
            assert.equal(point.evidence.measurement_seconds,900);
            assert.equal(point.configuration.hardware.accelerator_count,4);
        }
    }
});
