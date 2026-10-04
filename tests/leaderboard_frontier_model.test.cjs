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
    const mixedDepth=[...native.slice(0,2),...native.slice(0,2).map(row=>({
        ...row,point:{...row.point,load:{...row.point.load,session_rotation_depth:2}}
    }))];
    assert.deepEqual(model.concurrencySeries(mixedDepth).map(rows=>rows.map(
        row=>row.point.load.session_rotation_depth)),[[1,1],[2,2]]);
    const hidden=model.concurrencySeries(native.filter(row=>row.point.load.concurrency!==2));
    assert.ok(hidden.flat().every(row=>row.point.load.concurrency!==2));
});
test('production and empty snapshots validate without inventing points',()=>{
    const data=require('../data/leaderboard_frontier.json');
    model.validate(data);
    assert.equal(data.official_baseline.id,'vllm-0.18.0-vllm-ascend-0.18.0');
    assert.equal(data.official_baseline.vllm_version,'0.18.0');
    assert.equal(data.official_baseline.vllm_ascend_version,'0.18.0');
    assert.deepEqual(model.validate({schema_version:'leaderboard-frontier/v1',official_baseline:data.official_baseline,cohorts:[],points:[]}).points,[]);
    assert.equal(model.project([], 'interactivity','output_tps_per_chip').frontier.length,0);
});
test('presentation scope keeps the unified comparison readable without deleting evidence',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const cohort=data.cohorts.find(c=>c.id==='qwen35-35b-a3b-bf16-sweprefix-smoke-v1');
    const all=data.points.filter(p=>p.cohort_id===cohort.id);
    const displayed=model.presentationPoints(data.points,cohort);
    assert.equal(all.length,187);
    assert.equal(displayed.length,75);
    assert.deepEqual(new Set(displayed.map(p=>p.load.concurrency_series)),new Set(cohort.workload.contract.display_series_ids));
    const betterScale=displayed.filter(p=>model.groupKey(p)==='betterscale');
    assert.equal(betterScale.length,5);
    assert.equal(betterScale.filter(p=>p.load.concurrency_series==='swe-betterscale-resident-e16-r20-balanced-attn-graph-full-20260927').length,5);
    const hiddenIds=new Set(all.filter(p=>!displayed.includes(p)).map(p=>p.id));
    assert.ok(hiddenIds.has('qwen35-sweprefix-cache-width-full-tp2-c32-d1-20260928'));
    assert.ok(hiddenIds.has('qwen35-a2a-reuse-off-tp2ep-c8-20261001'));
    assert.ok(hiddenIds.has('qwen35-a2a-reuse-on-tp2ep-c8-20261001'));
    assert.deepEqual(cohort.workload.contract.display_group_labels.betterscale,{label_en:'BetterScale',label_zh:'BetterScale'});
    assert.deepEqual(cohort.workload.contract.default_groups,['native-runtime-v018-qwen35-backports-piecewise','native-runtime-d0f22d2-03766ac','native-runtime-752a3a5-9bf964c','betterscale']);
    const v018=displayed.filter(p=>model.groupKey(p)==='native-runtime-v018-qwen35-backports-piecewise');
    assert.equal(v018.length,5);
    assert.ok(v018.every(p=>p.configuration.official_baseline_id===data.official_baseline.id));
    assert.match(v018[0].load.presentation_group.label_en,/0\.18\.0.*9878e04.*0\.18\.0.*0f40ff0.*PIECEWISE/);
    assert.equal(displayed.filter(p=>model.groupKey(p)==='native-runtime-d0f22d2-03766ac').length,5);
    assert.equal(displayed.filter(p=>model.groupKey(p)==='native-runtime-752a3a5-9bf964c').length,5);
    assert.ok(displayed.filter(p=>model.groupKey(p)!=='native-runtime-v018-qwen35-backports-piecewise').every(p=>p.configuration.official_baseline_id==null));
    assert.match(displayed.find(p=>model.groupKey(p)==='native-runtime-d0f22d2-03766ac').load.presentation_group.label_en,/0\.25\.1\+frontier\.unified.*0\.25\.1rc1\+2/);
});
test('Qwen3.5 configuration studies consolidate related observations without implying missing series',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const studies=data.cohorts.filter(c=>c.workload.contract.presentation==='configuration-study');
    assert.equal(studies.length,3);
    const studyIds=new Set(studies.map(c=>c.id));
    const studyPoints=data.points.filter(p=>studyIds.has(p.cohort_id));
    assert.equal(studyPoints.length,15);
    assert.deepEqual(studies.map(c=>data.points.filter(p=>p.cohort_id===c.id).length).sort((a,b)=>a-b),[4,5,6]);
    assert.deepEqual(studies.map(c=>new Set(data.points.filter(p=>p.cohort_id===c.id).map(p=>p.study_group.id)).size).sort(),[2,2,3]);
    assert.ok(studyPoints.every(p=>p.study_group.label_en&&p.study_group.label_zh));
    assert.equal(model.concurrencySeries(model.project(studyPoints,'decode_p90_tps','output_tps_per_chip').measured).length,0);
    assert.equal(new Set(studies.flatMap(c=>c.aliases)).size,9);
    for(const study of studies) for(const alias of study.aliases) assert.equal(model.resolveCohort(data.cohorts,alias),study);
    const tp2=data.cohorts.find(c=>c.id==='qwen35-35b-a3b-bf16-sweprefix-study-tp2-engine-graph-v1');
    assert.equal(model.resolveCohort(data.cohorts,'qwen35-35b-a3b-bf16-sweprefix-study-tp2-legacy-v1'),tp2);
    for(const study of studies){
        assert.doesNotMatch(study.id,/legacy|historical/i);
        assert.doesNotMatch(study.workload.label,/legacy|historical/i);
        assert.doesNotMatch(study.workload.contract.display_scope,/legacy|historical/i);
    }

    const unifiedId='qwen35-35b-a3b-bf16-sweprefix-smoke-v1';
    const cohort=data.cohorts.find(c=>c.id===unifiedId);
    const displayed=model.presentationPoints(data.points,cohort);
    const measured=model.project(displayed,'decode_p90_tps','output_tps_per_chip').measured;
    const connected=new Set(model.concurrencySeries(measured).flat().map(row=>row.point.id));
    assert.ok(measured.length>0);
    assert.deepEqual(measured.filter(row=>!connected.has(row.point.id)),[]);
});
test('presentation mode accepts only declared setting semantics',()=>{
    const fixture=structuredClone(require('./fixtures/leaderboard_frontier.json'));
    fixture.cohorts[0].workload.contract.presentation='fixed-comparison';
    assert.equal(model.validate(fixture),fixture);
    fixture.cohorts[0].workload.contract.presentation='configuration-study';
    assert.throws(()=>model.validate(fixture),/Missing study group/);
    fixture.points.forEach(point=>{point.study_group={id:'fixture-study',label_en:'Fixture study',label_zh:'测试实验组'};});
    assert.equal(model.validate(fixture),fixture);
    fixture.cohorts[0].workload.contract.presentation='pareto-invalid';
    assert.throws(()=>model.validate(fixture),/Invalid Frontier presentation/);
});
test('Qwen2.5-14B vSpec uses measured offline batch and total-throughput axes',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const cohort=data.cohorts.find(c=>c.id==='qwen25-14b-bf16-gsm8k-b128-vspec-v1');
    assert.deepEqual(cohort.workload.contract.frontier_axes,{x:'batch_size',y:'output_tps'});
    const points=data.points.filter(p=>p.cohort_id===cohort.id);
    assert.equal(points.length,2);
    assert.deepEqual(points.map(p=>p.load.batch_size),[128,128]);
    assert.deepEqual(points.map(p=>Number(p.metrics.output_tps.toFixed(2))),[1557.25,2363.98]);
    assert.ok(points.every(p=>p.metrics.decode_p90_tps===undefined));
    assert.ok((points[1].metrics.output_tps/points[0].metrics.output_tps-1)*100>51.79);
});
test('SWE observations keep their fixed-window protocol and real MTP separate from AgentX',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
    const cohort=data.cohorts.find(c=>c.workload.id==='sweprefix-qwen35-eight-traces-900s-v1');
    assert.ok(cohort);
    assert.equal(cohort.workload.contract.repository_url,'https://github.com/vLLM-HUST/swe-prefix-reuse');
    const cohorts=data.cohorts.filter(c=>c.id.startsWith('qwen') && c.workload.contract.repository_url==='https://github.com/vLLM-HUST/swe-prefix-reuse');
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
        const variant=variants.find(v=>v.sha256===p.evidence.benchmark_protocol.prepared_workload_sha256);
        assert.equal(p.evidence.benchmark_protocol.tokenizer_fingerprint||run.client.tokenizer.fingerprint,variant.tokenizer_fingerprint||contract.tokenizer_fingerprint);
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
        } else if(['resident-state-tp2-c16-v1','resident-balanced-tp2-c16-v1','resident-balanced-tp2-curve-v1'].includes(p.evidence.benchmark_protocol.campaign)){
            const params=p.configuration.parameters;
            assert.equal(params.using_live_runtime,true);
            assert.equal(params.execution_seats,16);
            assert.equal(params.resident_seats,20);
            assert.equal(params.shared_attention_pages*params.attention_page_tokens,2140160);
            assert.equal(params.mtp_draft_tokens,2);
            assert.equal(params.async_scheduling,true);
            if(['resident-balanced-tp2-c16-v1','resident-balanced-tp2-curve-v1'].includes(p.evidence.benchmark_protocol.campaign)){
                assert.equal(params.mod_revision,'eee35fd6b50fca73385ad8f8af714fcd7e5c2684'); // pragma: allowlist secret (public Git commit)
                assert.equal(params.balanced_decode_attention,true);
                assert.equal(params.server_environment.BETTERSCALE_CONTEXT_PARALLEL,'1');
                assert.equal(params.worker_class,'betterscale.qwen35_worker.Worker');
                assert.equal(run.qualification.status,'PASS');
            } else assert.equal(params.mod_revision,'a8abd056a3ece455f683b212d6bd905da4058cbb'); // pragma: allowlist secret (public Git commit)
            assert.equal(p.configuration.mod_sources[0].revision,params.mod_revision);
            if(p.evidence.benchmark_protocol.campaign==='resident-balanced-tp2-curve-v1'){
                assert.ok([1,2,4,8].includes(p.load.concurrency));
                assert.equal(params.measured_mod_revision,params.mod_revision);
            } else assert.equal(p.load.concurrency,16);
            for(const key of ['owned_server_exit_zero','selected_device_guard_exit_zero','selected_devices_released','exact_token_budgets','prefix_cache_observed']) assert.equal(run.validation[key],true);
        } else if(p.evidence.benchmark_protocol.campaign==='width-matched-cache-tp2-v1'){
            const params=p.configuration.parameters;
            const wide=p.load.concurrency===32;
            assert.deepEqual([params.execution_seats,params.resident_seats,params.max_num_seqs],wide?[36,36,36]:[16,20,16]);
            assert.equal(params.shared_attention_pages,wide?15664:16720);
            assert.equal(params.state_budget_bytes_per_chip,26038239232);
            assert.equal(params.balanced_decode_attention,true);
            assert.equal(params.state_cache_policy,true);
            assert.equal(params.state_cache_incremental,p.id.includes('-incremental-'));
            assert.equal(p.load.session_rotation_depth,run.client.session_rotation_depth);
            assert.equal(run.summary.session_slots,p.load.concurrency*p.load.session_rotation_depth);
            for(const key of ['owned_server_exit_zero','campaign_exit_zero','selected_devices_released','request_protocol_pass']) assert.equal(run.validation[key],true);
        } else if(p.evidence.benchmark_protocol.campaign==='offloading-phase1-tp2-v1'){
            const params=p.configuration.parameters;
            assert.deepEqual(p.configuration.mods,['betterscale']);
            for(const [key,value] of Object.entries({execution_seats:16,resident_seats:20,max_num_seqs:16,max_model_len:262144,shared_attention_pages:16720,attention_page_tokens:128,state_budget_bytes_per_chip:26038239232,async_scheduling:true,mtp_draft_tokens:2})) assert.equal(params[key],value);
            assert.equal(params.state_cache_host_bytes,params.state_cache_policy?8589934592:0);
            assert.equal(params.mod_revision,'5d1dbfc8849c1002a40d1e23d81f93e52e4608e7'); // pragma: allowlist secret (public Git commit)
            assert.equal(p.configuration.mod_sources[0].revision,params.mod_revision);
            assert.equal(p.load.session_rotation_depth,run.client.session_rotation_depth);
            assert.equal(run.summary.session_slots,p.load.concurrency*p.load.session_rotation_depth);
            for(const key of ['owned_server_exit_zero','campaign_exit_zero','selected_devices_released','request_protocol_pass']) assert.equal(run.validation[key],true);
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
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-dla-bidkv-curves-20260925'){
            assert.equal(run.retrieval_qualification.passed,true);
            assert.equal(run.retrieval_qualification.completed_requests,26);
            assert.equal(p.configuration.hardware.accelerator_count,2);
            assert.equal(p.configuration.parameters.pipeline_parallel_size,1);
            for(const key of ['owned_server_exit_zero','selected_devices_released','exact_token_budgets','prefix_cache_observed']) assert.equal(run.validation[key],true);
            assert.ok(run.validation.prefix_hit_token_delta>0);
        } else if(['qwen35-managed-tiering-20260926','qwen35-managed-mooncake-20260926'].includes(p.evidence.benchmark_protocol.campaign)){
            assert.equal(run.retrieval_qualification.passed,true);
            assert.equal(run.retrieval_qualification.completed_requests,26);
            assert.equal(p.configuration.hardware.accelerator_count,2);
            for(const key of ['owned_server_stop_command_exit_zero','selected_devices_released','exact_token_budgets','prefix_cache_observed']) assert.equal(run.validation[key],true);
            assert.ok(run.validation.prefix_hit_token_delta>0);
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-native-rotation2-hw3-20260927'){
            assert.equal(p.load.session_rotation_depth,2);
            assert.equal(run.client.session_rotation_depth,2);
            for(const key of ['all_role_exits_zero','selected_devices_released','exact_request_protocol_passed','prefix_cache_qualification_passed']) assert.equal(run.validation[key],true);
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-unified-native-20260927'){
            assert.equal(p.configuration.hardware.accelerator_count,2);
            assert.equal(p.configuration.parameters.pipeline_parallel_size,1);
            assert.equal(run.validation.real_online,true);
            assert.equal(run.validation.failed_requests,0);
            assert.equal(run.validation.prefix_cache_observed,true);
            assert.equal(run.validation.selected_devices_released,true);
            assert.equal(run.validation.shared_native_contract_sha256,p.configuration.parameters.unified_native_contract_sha256);
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-kvcompress-frontier-20260928'){
            assert.deepEqual(p.configuration.mods,['kvcompress-ascend']);
            assert.equal(p.configuration.hardware.accelerator_count,2);
            assert.equal(p.configuration.parameters.pipeline_parallel_size,1);
            assert.equal(run.validation.real_online,true);
            assert.equal(run.validation.failed_requests,0);
            assert.equal(run.validation.prefix_cache_observed,true);
            assert.equal(run.validation.selected_devices_released,true);
            assert.equal(run.validation.kv_compression_runtime_effective,true);
            assert.equal(run.validation.shared_native_contract_sha256,p.configuration.parameters.unified_native_contract_sha256);
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-pegaflow-frontier-20260929'){
            assert.deepEqual(p.configuration.mods,['pegaflow-vllm-connectors']);
            assert.equal(p.configuration.hardware.accelerator_count,2);
            assert.equal(p.configuration.parameters.pipeline_parallel_size,1);
            for(const key of ['real_online','all_requests_succeeded','request_token_consistency','prefix_cache_observed','mtp2_observed','async_scheduling','selected_devices_released','pegaflow_runtime_effective']) assert.equal(run.validation[key],true);
            for(const key of ['load_successes','save_successes','loaded_bytes','saved_bytes','mtp_draft_tokens','mtp_accepted_tokens']) assert.ok(run.validation[key]>0);
            assert.equal(run.validation.load_failures,0);
            assert.equal(run.validation.save_failures,0);
            assert.equal(run.validation.graph_mode,'FULL_AND_PIECEWISE');
            assert.equal(run.validation.mamba_cache_mode,'align');
            assert.equal(run.validation.shared_native_contract_sha256,p.configuration.parameters.unified_native_contract_sha256);
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-kv-materialization-frontier-20260928'){
            assert.deepEqual(p.configuration.mods,['kv-materialization-arrival-control']);
            assert.equal(p.configuration.hardware.accelerator_count,2);
            assert.equal(p.configuration.parameters.pipeline_parallel_size,1);
            for(const key of ['real_online','owned_server_exit_zero','selected_devices_released','exact_token_budgets','prompt_id_echo','usage','done','prefix_cache_observed','mtp2_observed','async_scheduling']) {
                assert.equal(run.validation[key],true);
            }
            assert.equal(run.validation.graph_mode,'FULL_AND_PIECEWISE');
            assert.equal(run.validation.mamba_cache_mode,'align');
            assert.equal(run.validation.controller_status,'exercised');
            assert.equal(run.validation.shared_native_contract_sha256,p.configuration.parameters.unified_native_contract_sha256);
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-v018-native-text-only-20261001'){
            assert.deepEqual(p.configuration.mods,[]);
            assert.equal(p.configuration.official_baseline_id,data.official_baseline.id);
            assert.equal(p.configuration.parameters.graph_mode,'PIECEWISE');
            assert.equal(p.configuration.parameters.requested_graph_mode,'FULL_AND_PIECEWISE');
            assert.equal(p.configuration.parameters.runtime_release_versions.vllm,'0.18.0');
            assert.equal(p.configuration.parameters.runtime_release_versions['vllm-ascend'],'0.18.0');
            for(const key of ['real_online','prefix_cache_observed','native_mtp_observed','series_devices_released','source_and_runtime_sha256_manifest_verified']) assert.equal(run.validation[key],true);
            assert.equal(run.validation.failed_requests,0);
            assert.equal(run.validation.effective_graph_mode,'PIECEWISE ACL Graph');
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-a2a-buffer-reuse-tp2ep-c8-20261001'){
            const params=p.configuration.parameters;
            const on=p.id.includes('-on-');
            assert.deepEqual(p.configuration.mods,on?['a2a-buffer-reuse']:[]);
            assert.equal(p.load.concurrency,8);
            assert.equal(params.prefix_caching,false);
            assert.equal(params.a2a_buffer_reuse.env.VLLM_HUST_A2A_BUFFER_REUSE_ENABLE,on?'1':'unset');
            assert.equal(params.a2a_buffer_reuse.runtime_effective_events,0);
            assert.equal(run.validation.a2a_patch_installed,on);
            assert.equal(run.validation.prefix_cache_observed,false);
            assert.equal(run.validation.failed_requests,0);
        } else if(p.evidence.benchmark_protocol.campaign==='utility-victim-c1-c16-m65-20261003'){
            const on=p.configuration.mods.includes('utility-victim');
            const params=p.configuration.parameters;
            assert.equal(params.gpu_memory_utilization,0.65);
            assert.equal(params.prefix_caching,false);
            assert.equal(params.mtp_draft_tokens,0);
            assert.equal(params.checkpoint_revision,null);
            assert.equal(run.validation.checkpoint_identity_verified,false);
            assert.equal(params.utility_victim.patch_installed_events,on?4:0);
            assert.equal(params.utility_victim.runtime_effective_events,run.activation.runtime_effective_events);
            assert.equal(run.validation.performance_attribution_verified,false);
            assert.equal(run.probe.summary.measurement_seconds,20);
            assert.match(run.requests_artifact_sha256,/^[a-f0-9]{64}$/);
            for(const k of ['tpot_ms','tpot_p95_ms','e2e_p95_ms']) assert.ok(p.metrics[k]>0);
        } else if(p.evidence.benchmark_protocol.campaign==='qwen35-op01-attention-boundary-tp2ep-20261003'){
            const on=p.id.includes('-on-');
            const params=p.configuration.parameters;
            assert.deepEqual(p.configuration.mods,on?['ascend-attention-boundary']:[]);
            assert.ok([1,2,4,8,16].includes(p.load.concurrency));
            assert.equal(params.runtime_versions.vllm,'0.23.0+empty');
            assert.equal(params.runtime_versions['vllm-ascend'],'0.23.0.post1');
            assert.equal(params.mod.enable,on);
            assert.equal(run.validation.patch_requested,on);
            assert.equal(run.validation.failed_requests,0);
            assert.equal(run.validation.tokenizer_identity_independently_verified,false);
            assert.equal(run.validation.activation_log_point_isolated,false);
            if(p.load.concurrency===8){
                assert.ok(p.evidence.c8_selection);
                assert.equal(p.evidence.c8_selection.ranked_candidates.length,5);
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
    for(const p of data.points.filter(p=>!p.configuration.parameters.expert_ranks&&!p.study_group&&!p.load.presentation_group)){
        assert.equal(model.groupKey(p),model.modKey(p));
    }
    for(const p of data.points.filter(p=>p.study_group)) assert.equal(model.groupKey(p),p.study_group.id);
    for(const p of data.points.filter(p=>p.load.presentation_group)) assert.equal(model.groupKey(p),p.load.presentation_group.id);
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


test('output-budget curves retain matched controls and distinguish executed checks from changed decisions',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
    const points=data.points.filter(p=>p.evidence.benchmark_protocol?.campaign==='qwen35-dla-bidkv-curves-20260925');
    assert.equal(points.length,15);
    for(const concurrency of [1,2,4,8,16]){
        const triple=points.filter(p=>p.load.concurrency===concurrency);
        assert.equal(triple.length,3);
        const native=triple.find(p=>p.configuration.mods.length===0);
        assert.ok(native);
        for(const arm of ['native','bidkv','dla']){
            const p=triple.find(p=>p.load.concurrency_series===`swe-output-budget-tp2-20260925-${arm}-r1`);
            assert.ok(p);
            assert.deepEqual(p.configuration.mods,arm==='native'?[]:[arm]);
            assert.equal(p.configuration.experiment_group,undefined);
            assert.deepEqual(p.evidence.benchmark_protocol,native.evidence.benchmark_protocol);
            const a=native.configuration.parameters,b=p.configuration.parameters;
            for(const key of ['tensor_parallel_size','pipeline_parallel_size','max_num_seqs','max_num_batched_tokens','kv_cache_memory_bytes','prefix_caching','async_scheduling','mtp_draft_tokens','mamba_cache_mode','graph_mode','graph_capture_sizes','worker_abi_bridge_sha256']){
                assert.notEqual(a[key],undefined,key);
                assert.deepEqual(a[key],b[key],key);
            }
            for(const key of ['packages','cann','model_manifest_sha256','worker_bridge_sha256','runtime_source_files','source_patches_sha256','core_commit','ascend_commit','source_archives']){
                assert.notEqual(a.runtime_receipt[key],undefined,key);
                assert.deepEqual(a.runtime_receipt[key],b.runtime_receipt[key],key);
            }
            assert.equal(b.scheduler_reserve_output_budget,arm==='dla');
            assert.equal(b.runtime_base_commits,undefined);
            const run=evidence.runs.find(r=>r.point_id===p.id);
            const control=evidence.runs.find(r=>r.point_id===native.id);
            for(const key of ['duration','concurrency','chips','seed','workload_sha256']) assert.deepEqual(run.client[key],control.client[key],key);
            if(arm!=='native'){
                const effect=run.policy_effectiveness;
                assert.equal(effect.enabled,true);
                assert.equal(effect.status,'not-exercised');
                assert.ok(Object.values(effect.preemption).every(v=>v===0));
                assert.equal(effect.admission.deferred,0);
                if(arm==='dla'){
                    assert.match(p.label,/已知输出预算/);
                    assert.equal(effect.admission_check_executed,true);
                    for(const key of ['checks','extended_checks','passed']) assert.equal(effect.admission[key],run.summary.requests_started);
                } else assert.ok(Object.values(effect.admission).every(v=>v===0));
            }
        }
    }
});

test('SWE rotation metadata covers displayed and archived observations without relabeling AgentX',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const swe=new Set(data.cohorts.filter(c=>c.workload.id.startsWith('sweprefix-')).map(c=>c.id));
    for(const c of data.cohorts.filter(c=>swe.has(c.id))) {
        assert.equal(c.workload.contract.session_rotation.status,c.id.startsWith('qwen38-')?'under-construction':'measured');
        assert.equal(c.workload.contract.session_rotation.depth_field,'load.session_rotation_depth');
    }
    for(const p of [...data.points,...data.archived_points]) {
        if(swe.has(p.cohort_id)) {
            const offload=['offloading-phase1-tp2-v1','width-matched-cache-tp2-v1'].includes(p.evidence.benchmark_protocol.campaign);
            const expected=offload?Number(p.id.match(/-d([12])-/)[1]):p.id.includes('-rotation2-')?2:1;
            assert.equal(p.load.session_rotation_depth,expected);
        }
        else assert.equal(p.load.session_rotation_depth,undefined);
    }
});

test('rotation-enabled cohorts require explicit positive integer depths, never default missing to 1',()=>{
    const data=structuredClone(fixture);
    data.cohorts[0].workload.contract.session_rotation={policy:'per-lane-round-robin'};
    for(const p of data.points)p.load.session_rotation_depth=4;
    assert.equal(model.validate(data),data);
    for(const depth of [undefined,null,0,-1,1.5,'1',true]) {
        const invalid=structuredClone(data);
        invalid.points[0].load.session_rotation_depth=depth;
        assert.throws(()=>model.validate(invalid),/session rotation depth/);
    }
    assert.equal(model.validate(fixture),fixture); // Non-rotation workloads stay unchanged.
});


test('native Rotation2 points retain both C16 observations and exact public run metrics',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
    const points=data.points.filter(p=>p.evidence.benchmark_protocol?.campaign==='qwen35-native-rotation2-hw3-20260927');
    assert.deepEqual(points.map(p=>p.load.concurrency).sort((a,b)=>a-b),[2,4,8,16,16]);
    assert.deepEqual([...new Set(points.map(p=>p.load.concurrency_series))],['qwen35-native-rotation2-hw3-20260927']);
    assert.equal(new Set(points.flatMap(p=>p.evidence.run_ids)).size,5);
    for(const p of points) {
        const r=evidence.runs.find(r=>r.point_id===p.id);
        assert.ok(r);
        assert.deepEqual(p.metrics,r.metrics);
        assert.equal(p.metrics.output_tps,r.summary.output_tokens_per_second);
        assert.equal(p.metrics.decode_p90_tps,r.summary.decode_tokens_per_second_p90);
        assert.equal(p.configuration.parameters.expert_parallel,true);
        assert.equal(p.configuration.parameters.tensor_parallel_size,2);
        assert.deepEqual(p.configuration.mods,[]);
        assert.equal(r.client.session_rotation_depth,2);
        assert.equal(r.summary.session_slots,2*p.load.concurrency);
        assert.equal(r.summary.failed_requests,0);
        assert.equal(r.validation.all_role_exits_zero,true);
        assert.equal(r.validation.selected_devices_released,true);
    }
});


test('rotation depths cannot dominate or tie-deduplicate each other, even within one MOD',()=>{
    const seed=structuredClone(fixture.points[0]);
    const point=(id,depth,x,y)=>({...structuredClone(seed),id,load:{...seed.load,session_rotation_depth:depth},metrics:{decode_p90_tps:x,output_tps:y}});
    const rows=[point('d1-fast',1,100,100),point('d2-a',2,10,20),point('d2-b',2,20,10),point('d2-dominated',2,5,5),point('d3-tie',3,100,100)];
    assert.deepEqual(model.groupFrontiers(rows,'decode_p90_tps','output_tps_per_chip').map(g=>g.map(r=>r.point.id)),[['d1-fast'],['d2-a','d2-b'],['d3-tie']]);
    assert.equal(model.groupKey(rows[0]),model.groupKey(rows[1]));
    assert.notEqual(model.frontierKey(rows[0]),model.frontierKey(rows[1]));
    const only2=model.groupFrontiers(rows.filter(p=>p.load.session_rotation_depth===2),'decode_p90_tps','output_tps_per_chip');
    assert.deepEqual(only2[0].map(r=>r.point.id),['d2-a','d2-b']);
});


test('retired AgentX cohorts disappear from active choices without deleting historical evidence',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const before=JSON.stringify(data);
    const visible=model.visibleData(data);
    assert.ok(data.cohorts.some(c=>c.workload.id.startsWith('agentx') && c.display_withdrawal));
    assert.ok(data.points.some(p=>p.cohort_id.includes('agentx')));
    assert.ok(visible.cohorts.every(c=>!c.workload.id.startsWith('agentx')));
    assert.ok(visible.points.every(p=>visible.cohorts.some(c=>c.id===p.cohort_id)));
    assert.equal(JSON.stringify(data),before);
    assert.equal(visible.points.length,data.points.filter(p=>!data.cohorts.find(c=>c.id===p.cohort_id).display_withdrawal).length);
});


test('Qwen35 unified campaign remains on its series page without losing checkpoint provenance',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const visible=model.visibleData(data);
    const cohorts=visible.cohorts.filter(c=>c.model.label==='Qwen3.5-35B-A3B');
    assert.equal(cohorts.length,4);
    assert.equal(cohorts.filter(c=>c.workload.contract.presentation==='configuration-study').length,3);
    const original=data.archived_cohorts.find(c=>c.id==='qwen35-35b-a3b-bf16-sweprefix-unified-v1');
    assert.ok(original);
    const moved=data.points.filter(p=>p.evidence.original_cohort_id===original.id);
    assert.equal(moved.length,35);
    const canonical=cohorts.find(c=>c.id==='qwen35-35b-a3b-bf16-sweprefix-smoke-v1');
    assert.ok(canonical);
    const checkpointIdentities=new Set([
        original.model.revision,
        canonical.model.revision,
        ...(canonical.model.verified_identity_aliases||[]).map(alias=>alias.value),
    ]);
    const workloadIdentities=new Set([
        original.workload.contract.prepared_workload_sha256,
        canonical.workload.contract.prepared_workload_sha256,
        ...(canonical.workload.contract.prepared_workload_variants||[]).map(variant=>variant.sha256),
    ]);
    for(const p of moved){
        assert.equal(p.cohort_id,canonical.id);
        assert.ok(checkpointIdentities.has(p.configuration.parameters.checkpoint_revision));
        assert.ok(workloadIdentities.has(p.evidence.benchmark_protocol.prepared_workload_sha256));
    }
});


test('DSV4 INT8 retains all 24 matched K5 windows including saturation points',()=>{
    const data=model.validate(require('../data/leaderboard_frontier.json'));
    const cohort=data.cohorts.find(c=>c.id==='dsv4-flash-int8-sweprefix-smoke-v1');
    assert.equal(cohort.model.label,'DeepSeek V4 Flash');
    assert.equal(cohort.precision.label,'INT8');
    const points=data.points.filter(p=>p.cohort_id===cohort.id);
    const evidence=require('../data/leaderboard_frontier_dsv4_evidence.json');
    assert.equal(points.length,24);assert.equal(evidence.runs.length,24);
    for(const p of points){
        const r=evidence.runs.find(r=>r.run_id===p.id), k=p.configuration.parameters;
        assert.ok(r);assert.equal(r.summary.valid,true);assert.equal(r.summary.failed_requests,0);
        assert.equal(r.summary.measurement_seconds,900);assert.equal(r.acceptance.released_to_idle,true);
        assert.equal(p.metrics.output_tps,r.summary.observed_output_tokens_in_window/900);
        assert.equal(p.metrics.decode_p90_tps,r.summary.decode_tokens_per_second_p90);
        assert.equal(p.metrics.ttft_p95_ms,1000*r.summary.ttft_seconds_p95);
        assert.equal(k.mtp_draft_tokens,5);assert.equal(k.speculative_method,'dspark');
        assert.equal(k.global_seats,k.data_parallel_size===8?16:4);
        assert.equal(p.load.session_rotation_depth,1);
        const d=r.counter_deltas_including_drain;
        assert.equal(d.draft_tokens,d.dspark_drafts*5);assert.ok(d.accepted_draft_tokens>0&&d.prefix_hit_tokens>0);
    }
    const lines=model.concurrencySeries(model.project(points,'decode_p90_tps','output_tps_per_chip').measured);
    assert.equal(lines.length,4);
    for(const line of lines)assert.deepEqual(line.map(r=>r.point.load.concurrency),[1,2,4,8,16,32]);
    assert.equal(Object.keys(evidence.omitted).length,4);
});

test('BetterScale chart line uses only the displayed five-point configuration family',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const cohort=data.cohorts.find(c=>c.id==='qwen35-35b-a3b-bf16-sweprefix-smoke-v1');
    const points=model.presentationPoints(data.points,cohort);
    const projected=model.project(points,'decode_p90_tps','output_tps_per_chip').measured;
    const lines=model.chartSeries(projected,'decode_p90_tps','output_tps_per_chip');
    const better=lines.find(line=>model.groupKey(line[0].point)==='betterscale');
    assert.deepEqual(better,model.groupFrontiers(points.filter(p=>model.groupKey(p)==='betterscale'),'decode_p90_tps','output_tps_per_chip')[0]);
    assert.ok(better.every(row=>row.point.load.concurrency_series==='swe-betterscale-resident-e16-r20-balanced-attn-graph-full-20260927'));
    assert.ok(!points.some(point=>point.id==='qwen35-sweprefix-cache-width-full-tp2-c32-d1-20260928'));
    assert.ok(data.points.some(point=>point.id==='qwen35-sweprefix-cache-width-full-tp2-c32-d1-20260928'));
    assert.deepEqual(lines.filter(line=>model.groupKey(line[0].point)!=='betterscale'),model.concurrencySeries(projected.filter(row=>model.groupKey(row.point)!=='betterscale')));
    assert.deepEqual(model.chartSeries(better.slice(0,1),'decode_p90_tps','output_tps_per_chip'),[]);
});


test('BetterScale cache study reuses exact Native and tuned C1–C32 measurements without changing the main chart',()=>{
    const data=require('../data/leaderboard_frontier.json');
    model.validate(data);
    const study=data.cohorts.find(c=>c.id==='qwen35-35b-a3b-bf16-sweprefix-study-betterscale-cache-v1');
    const main=data.cohorts.find(c=>c.id==='qwen35-35b-a3b-bf16-sweprefix-smoke-v1');
    const shared=study.workload.contract.comparison_point_ids;
    assert.equal(shared.length,11);
    const points=model.presentationPoints(data.points,study);
    assert.equal(points.length,data.points.filter(p=>p.cohort_id===study.id).length+11);
    for(const id of shared) assert.equal(points.find(p=>p.id===id),data.points.find(p=>p.id===id));
    const rows=model.project(points,'decode_p90_tps','output_tps_per_chip').measured;
    const lines=model.chartSeries(rows,'decode_p90_tps','output_tps_per_chip',study);
    assert.equal(lines.length,2);
    const better=lines.find(line=>model.groupKey(line[0].point)==='betterscale');
    const native=lines.find(line=>model.groupKey(line[0].point)==='native-runtime-752a3a5-9bf964c');
    assert.deepEqual(better.map(row=>row.point.load.concurrency),[1,2,4,8,16,32]);
    assert.deepEqual(native.map(row=>row.point.load.concurrency),[1,2,4,8,16]);
    assert.equal(model.value(better.at(-1).point,'output_tps_per_chip'),613.88);
    assert.ok(lines.flat().every(row=>shared.includes(row.point.id)));
    const c32=better.at(-1).point;
    assert.ok(!model.presentationPoints(data.points,main).includes(c32));
    assert.equal(model.chartSeries(rows.filter(row=>row.point===c32),'decode_p90_tps','output_tps_per_chip',study).length,0);
    const withoutNative=model.chartSeries(rows.filter(row=>model.groupKey(row.point)!=='native-runtime-752a3a5-9bf964c'),'decode_p90_tps','output_tps_per_chip',study);
    assert.equal(withoutNative.length,1);
    for(const invalid of [[shared[0],shared[0]],['missing-point'],[],[data.points.find(p=>p.cohort_id==='qwen38-27b-bf16-sweprefix-smoke-v1').id]]){
        const fixture=structuredClone(data);
        fixture.cohorts.find(c=>c.id===study.id).workload.contract.comparison_point_ids=invalid;
        assert.throws(()=>model.validate(fixture),/Invalid comparison point IDs/);
    }
});

const utilityExpected=[
  {
    "id": "qwen35-utility-victim-off-tp2ep-m65-c1-r1-20261003",
    "c": 1,
    "run_id": "a68431af211c4dfa966d699bbb67a80f",
    "tokens": 35504,
    "completed": 76,
    "effective": 0,
    "preemptions": 0.0,
    "sha256": "e910496a71b7c9796f963ab796a3c662b4265397965121e646d1235edaca7876"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-off-tp2ep-m65-c2-r1-20261003",
    "c": 2,
    "run_id": "0fa2d4ced65a4a48acf03e648e1cc033",
    "tokens": 59721,
    "completed": 123,
    "effective": 0,
    "preemptions": 0.0,
    "sha256": "9e9645622a2fd896a720346520d9e1569c093493b665c6be74270703ef498be9"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-off-tp2ep-m65-c4-r1-20261003",
    "c": 4,
    "run_id": "16ec0ab723e04e169fb91a7d45e025b3",
    "tokens": 97506,
    "completed": 178,
    "effective": 0,
    "preemptions": 0.0,
    "sha256": "5dc62c28228e8988f0fdc13018b47acfa78633b60bdc65dae082d7fc55c47b20"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-off-tp2ep-m65-c8-r1-20261003",
    "c": 8,
    "run_id": "e856a1639261421fbb5249da76e14ee2",
    "tokens": 146138,
    "completed": 261,
    "effective": 0,
    "preemptions": 0.0,
    "sha256": "9aa58ef0aa53d981463dcd44994b4550681306205cc92046b437731fae73fd9f"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-off-tp2ep-m65-c16-r1-20261003",
    "c": 16,
    "run_id": "caaf91a4a6744d2287201b1f988733f5",
    "tokens": 157522,
    "completed": 323,
    "effective": 0,
    "preemptions": 398.0,
    "sha256": "19234a0e1d8a997e3d811de4ec703cb1f4c5f4a9922e85ef326241d76844b55f"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-on-tp2ep-m65-c1-r1-20261003",
    "c": 1,
    "run_id": "36ca7c81453242d1a3b86200bceb2c58",
    "tokens": 36283,
    "completed": 77,
    "effective": 0,
    "preemptions": 0.0,
    "sha256": "800066ec478f41ed621ea474039b45e4c44de559f367f8b3704e2cbf1db96502"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-on-tp2ep-m65-c2-r1-20261003",
    "c": 2,
    "run_id": "a392a568ce414aacbe095513af17a695",
    "tokens": 59769,
    "completed": 123,
    "effective": 0,
    "preemptions": 0.0,
    "sha256": "96e1ee12466b85da9c6b6a59abaad2f4493c6ad197971032681db01018620bb6"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-on-tp2ep-m65-c4-r1-20261003",
    "c": 4,
    "run_id": "e579a951e31746ceb0b734120305bf60",
    "tokens": 96933,
    "completed": 177,
    "effective": 0,
    "preemptions": 0.0,
    "sha256": "de7b5bfbbb3ac44d20bb285467f729a261862b7635f3666752bbbcc4d3b86832"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-on-tp2ep-m65-c8-r1-20261003",
    "c": 8,
    "run_id": "f7ca8a0ad2cf4a84a031997347e124ba",
    "tokens": 142759,
    "completed": 256,
    "effective": 0,
    "preemptions": 0.0,
    "sha256": "487bc9c28fe97858c2bdb95d0e0310e61f39715bc99152afd6e9944eedc73f73"// pragma: allowlist secret (request artifact SHA256 checksum)
  },
  {
    "id": "qwen35-utility-victim-on-tp2ep-m65-c16-r1-20261003",
    "c": 16,
    "run_id": "f531b2823fa540c787c59ab3c9042a4c",
    "tokens": 136231,
    "completed": 296,
    "effective": 1,
    "preemptions": 191.0,
    "sha256": "0848267caa553a920f5be01e7280d519678b751d8f54e6ece8689c965766e9b2"// pragma: allowlist secret (request artifact SHA256 checksum)
  }
];

test('utility-victim connects only retained valid concurrency observations, preserving gaps',()=>{
    const data=require('../data/leaderboard_frontier.json');
    const ps=data.points.filter(p=>p.evidence.benchmark_protocol?.campaign==='utility-victim-c1-c16-m65-20261003');
    assert.deepEqual(ps.map(p=>p.id).sort(),utilityExpected.map(p=>p.id).sort());
    const lines=model.concurrencySeries(model.project(ps,'decode_p90_tps','output_tps_per_chip').measured);
    assert.equal(lines.length,2);
    assert.equal(ps.length,10);
    const runs=require('../data/leaderboard_frontier_swe_evidence.json').runs;
    for(const rows of lines){
        const expected=utilityExpected.filter(e=>ps.find(p=>p.id===e.id).load.concurrency_series===rows[0].point.load.concurrency_series);
        assert.deepEqual(rows.map(row=>row.point.load.concurrency),expected.map(e=>e.c).sort((a,b)=>a-b));
        assert.equal(new Set(rows.map(row=>row.point.load.concurrency)).size,rows.length);
        assert.deepEqual(rows.map(row=>row.point.load.concurrency),[1,2,4,8,16]);
    }
    for(const e of utilityExpected){
        const p=ps.find(p=>p.id===e.id), r=runs.find(r=>r.point_id===e.id);
        assert.equal(r.run_id,e.run_id);
        assert.equal(r.requests_artifact_sha256,e.sha256);
        assert.equal(r.activation.runtime_effective_events,e.effective);
        assert.equal(r.preemptions.delta,e.preemptions);
        assert.equal(p.metrics.output_tps,e.tokens/900);
        assert.equal(p.metrics.completed_requests,e.completed);
        assert.equal(r.client.duration,900);
        assert.equal(r.summary.valid,true);
        assert.equal(r.summary.aborted,false);
    }
    const on16=ps.find(p=>p.configuration.mods.includes('utility-victim') && p.load.concurrency===16);
    const on16run=runs.find(r=>r.point_id===on16.id);
    assert.equal(on16run.activation.runtime_effective_events,1);
    assert.equal(on16run.activation.runtime_effective_payloads[0].selection_changed,true);
    assert.equal(on16run.activation.runtime_effective_payloads[0].actual_kv_freed_verified,false);
});
