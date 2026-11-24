(() => {
  'use strict';
  const controllerFixedProfilesPath = 'data/controller-r8-fixed-profiles-repeat-v1.json';
  const controllerComputePath = 'data/controller-r8-mmlu256-service-compute-v1.json';
  const controllerNativeComputePath = 'data/controller-r8-mmlu256-native-compute-v1.json';
  const controllerNativeReportPath = 'reports/controller-r8-native-efficiency-20261123/README.md';
  const controllerStreamingPath = 'data/controller-r8-streamed-heavy-load-v1.json';
  const controllerC8Path = 'data/controller-r8-closed-loop-c8-v1.json';
  const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= 1e-8 * Math.max(1, Math.abs(b));

  async function readPublishedJson(publication,path,response) {
    const bindings=publication.files.filter(file=>file.website_path===path);
    if(bindings.length!==1||!response.ok)throw Error('Published asset unavailable or ambiguous');
    const bytes=await response.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(bindings[0].bytes!==bytes.byteLength||bindings[0].sha256!==hash)throw Error('Published asset checksum mismatch');
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function loadControllerFixedProfiles(publication,entry) {
    const counts={mmlu:200,hle:200,frontier:160,swe:64,terminal:48};
    if(!publication.files.some(file=>file.website_path===controllerFixedProfilesPath))return null;
    const response=await fetch('./'+controllerFixedProfilesPath,{cache:'no-cache'});
    const value=await readPublishedJson(publication,controllerFixedProfilesPath,response);
    if(value.schema!=='controller-r8-fixed-profiles-repeat/v1'||value.engine_release!==entry.engine_release||
      value.state_resident_seats!==entry.state_resident_seats||
      value.profiles?.map(row=>row.id).join()!==Object.keys(counts).join())
      throw Error('Unmatched fixed profile repeat');
    const positive=value=>Number.isFinite(value)&&value>0;
    for(const row of value.profiles){
      const expected=counts[row.id];
      if(row.status!=='complete'||row.same_client_request_bodies!==true||row.same_per_case_engine_prompt_tokens!==true)
        throw Error('Incomplete fixed-profile pair');
      for(const arm of [row.direct,row.controller]){
        if(arm.planned!==expected||arm.successful!==expected||arm.release_errors!==0||
          !positive(arm.elapsed_seconds)||!positive(arm.output_tokens)||
          !close(arm.output_tokens_per_second,arm.output_tokens/arm.elapsed_seconds)||
          arm.time_to_first_output_seconds?.n!==expected||!positive(arm.time_to_first_output_seconds?.mean)||
          !Number.isInteger(arm.time_per_output_token_ms?.n)||arm.time_per_output_token_ms.n<1||
          arm.time_per_output_token_ms.n>expected||!positive(arm.time_per_output_token_ms.mean))
          throw Error('Invalid fixed-profile metrics');
        const quality=arm.quality;
        const count=(number,limit)=>Number.isInteger(number)&&number>=0&&number<=limit;
        if(row.id==='mmlu'&&(!count(quality?.correct,expected)||quality.planned!==expected))
          throw Error('Incomplete MMLU-Pro grades');
        if(row.id==='hle'){
          const groups=Object.values(quality?.groups||{});
          if(groups.some(group=>!count(group.total,expected)||!count(group.successes,group.total)||!count(group.unresolved,group.total))||
             groups.reduce((sum,group)=>sum+group.total,0)!==expected)
            throw Error('Incomplete Humanity’s Last Exam grades');
        }
        if(row.id==='frontier'&&Object.entries({olympiad:100,research:60}).some(([track,total])=>{
          const grade=quality?.tracks?.[track];
          return grade?.total!==total||!count(grade.successes,total)||!count(grade.judge_invalid,total);
        }))throw Error('Incomplete FrontierScience grades');
      }
      if(!close(row.time_reduction_percent,100*(1-row.controller.elapsed_seconds/row.direct.elapsed_seconds))||
         !close(row.output_token_change_percent,100*(row.controller.output_tokens/row.direct.output_tokens-1)))
        throw Error('Fixed-profile summary does not match the measured arms');
    }
    return value;
  }

  async function loadControllerCompute(publication,entry) {
    if(!publication.files.some(file=>file.website_path===controllerComputePath))return null;
    const response=await fetch('./'+controllerComputePath,{cache:'no-cache'});
    const value=await readPublishedJson(publication,controllerComputePath,response);
    if(value.schema!=='controller-r8-mmlu256-service-compute/v1'||value.engine_release!==entry.engine_release||
       value.state_resident_seats!==entry.state_resident_seats||value.accelerators!==2||value.native_efficiency_certified!==false||
       !/^[a-f0-9]{64}$/.test(value.source_formula_sha256)||!/^[a-f0-9]{64}$/.test(value.model_config_sha256))
      throw Error('Unmatched service compute measurement');
    for(const side of ['direct','controller']){
      const arm=value.arms?.[side];
      if(arm?.rounds?.map(r=>r.repetition).join()!=='1,2,3'||arm.rounds.some(r=>r.requests!==200||r.input_tokens!==282265||
        !Number.isSafeInteger(r.target_matrix_work_lower_flops)||r.target_matrix_work_lower_flops<=0||
        !Number.isInteger(r.output_tokens)||r.output_tokens<200||r.output_tokens>51200||
        !Number.isFinite(r.elapsed_seconds)||r.elapsed_seconds<=0))throw Error('Incomplete three-round service compute evidence');
      const sum=key=>arm.rounds.reduce((a,r)=>a+r[key],0);
      const seconds=sum('elapsed_seconds'), work=sum('target_matrix_work_lower_flops');
      if(!close(arm.synchronized_service_seconds,seconds)||!close(arm.target_matrix_tflops_per_card_lower,work/(2e12*seconds))||
        !close(arm.output_tokens_per_second,sum('output_tokens')/seconds))throw Error('Service compute summary does not match the sealed rounds');
    }
    return value;
  }

  async function loadControllerNativeCompute(publication,entry) {
    if(entry.id!=='r8'||!publication.files.some(file=>file.website_path===controllerNativeComputePath))return null;
    const response=await fetch('./'+controllerNativeComputePath,{cache:'no-cache'});
    const value=await readPublishedJson(publication,controllerNativeComputePath,response);
    const {scope,handoff,independent_reference:reference}=value;
    const sha=value=>/^[a-f0-9]{64}$/.test(value||'');
    const positive=value=>Number.isFinite(value)&&value>0;
    const decimal=value=>typeof value==='string'&&/^\d+\.\d+$/.test(value)&&positive(Number(value));
    const work=value=>Number.isSafeInteger(value)&&value>0;
    if(value.schema!=='controller-r8-mmlu256-native-compute/v1'||value.native_efficiency_certified!==true||
       value.release!==entry.id||value.engine_release!==entry.engine_release||value.model!=='Qwen3.5-35B-A3B'||
       value.max_num_seqs!==entry.max_num_seqs||value.state_resident_seats!==entry.state_resident_seats||
       scope?.profile!=='mmlu-fixed200-v1'||scope.requests!==200||scope.input_tokens!==282265||
       scope.output_tokens!==51200||scope.max_completion_tokens!==256||scope.ignore_eos!==false||
       scope.repetitions_per_arm!==3||scope.dtype!=='BF16'||scope.tp!==2||scope.accelerator!=='Ascend 910B2'||
       scope.clock!=='EngineCoreProc monotonic_ns: first admission to post-drain TP2 fence'||
       scope.routing_before_first_admission_included!==false||scope.idle_after_first_admission_included!==true||
       handoff?.report_path!==controllerNativeReportPath||handoff.timed_rounds_verified!==6||
       handoff.arithmetic_rounds_verified!==6||handoff.controller_releases_verified!==600||
       ![handoff.paired_certificate_sha256,handoff.clean_native_clocks_sha256,handoff.observed_arithmetic_sha256,
         handoff.arithmetic_audits_sha256].every(sha))throw Error('Unmatched native compute evidence');
    const repeats=reference?.repetitions;
    if(reference?.arm!=='B1'||reference.target_times_used!==false||!sha(reference.source_sha256)||
       !/^[a-f0-9]{40}$/.test(reference.source_commit||'')||
       !Array.isArray(repeats)||repeats.length!==3||new Set(repeats.map(row=>row?.source_sha256)).size!==3||
       !repeats.every(row=>sha(row?.source_sha256)&&work(row.work_flops_upper)&&decimal(row.critical_path_seconds_lower))||
       !decimal(reference.critical_path_seconds_lower)||!decimal(reference.tflops_per_card_upper))
      throw Error('Invalid independent native reference');
    const refWork=repeats.reduce((total,row)=>total+row.work_flops_upper,0);
    const refTime=repeats.reduce((total,row)=>total+Number(row.critical_path_seconds_lower),0);
    const refUpper=Number(reference.tflops_per_card_upper);
    const refExact=refWork/(2e12*refTime);
    if(reference.work_flops_upper!==refWork||!close(refTime,Number(reference.critical_path_seconds_lower))||
       !close(refExact,refUpper)||refUpper<refExact-1e-12)throw Error('Native reference totals do not match');
    for(const side of ['direct','controller']){
      const arm=value.arms?.[side];
      if(arm?.all_requests_successful!==600||!work(arm.necessary_work_flops_lower)||
         ![arm.native_seconds_reported,arm.native_seconds_upper,arm.effective_tflops_per_card_lower,
           arm.efficiency_percent_lower].every(decimal))throw Error('Invalid native compute arm');
      const seconds=Number(arm.native_seconds_upper), reported=Number(arm.native_seconds_reported);
      const rate=Number(arm.effective_tflops_per_card_lower), efficiency=Number(arm.efficiency_percent_lower);
      const recomputed=arm.necessary_work_flops_lower/(2e12*seconds);
      if(Math.abs(seconds-reported-0.000001)>1e-10||!close(recomputed,rate)||rate>recomputed+1e-12||
         efficiency!==(Math.floor(100*recomputed/refUpper*10000)/10000)||
         arm.milestone_50_proven!==(efficiency>=50)||arm.target_90_proven!==(efficiency>=90))
        throw Error('Native compute totals do not match');
    }
    return value;
  }

  function controllerNativeComputeDetails(value,commit,t,table) {
    const sides=['direct','controller'];
    const verdict=passed=>passed?t('已证明','Proven'):t('下界不足以证明','Lower bound does not establish it');
    const bound=value=>'≥'+(Math.floor(Number(value)*10000)/10000).toFixed(4);
    const reference=(Math.ceil(Number(value.independent_reference.tflops_per_card_upper)*10000)/10000).toFixed(4);
    const report='https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/'+commit+'/'+controllerNativeReportPath;
    return `<div data-controller-native-compute>
      <p>R8 E36/R80 · Qwen3.5-35B-A3B BF16 · TP2 · 2 × Ascend 910B2 · MMLU-Pro 200 · ${t('输出上限 256 · 各三轮','256 output token limit · Three rounds per arm')}</p>
      <p>${t('从首个请求进入引擎计时，到排空后的双卡同步结束。首次准入前的路由和等待不计入。','Timing runs from first engine admission through the post-drain two-card fence. Routing and waits before the first admission are outside this interval.')}</p>
      ${table(t(['指标','直连','经请求限流控制器'],['Metric','Direct engine','Via Request Throttling Controller']),[
        [t('参考效率下界','Reference efficiency lower bound'),...sides.map(side=>'≥'+value.arms[side].efficiency_percent_lower+'%')],
        [t('有效算力下界（TFLOP/s/卡）','Effective compute lower bound (TFLOP/s per card)'),...sides.map(side=>bound(value.arms[side].effective_tflops_per_card_lower))],
        [t('三轮原生计时合计（秒）','Native timing total across three rounds (s)'),...sides.map(side=>value.arms[side].native_seconds_reported)],
        [t('50% 里程碑','50% milestone'),...sides.map(side=>verdict(value.arms[side].milestone_50_proven))],
        [t('90% 最终阈值','90% final threshold'),...sides.map(side=>verdict(value.arms[side].target_90_proven))]
      ])}
      <p>${t('两臂共用独立 B1 参考算力上界','Independent B1 reference upper bound shared by both paths')} ≤${reference} TFLOP/s/${t('卡','card')} ·
        <a href="./${controllerNativeComputePath}">${t('算量、计时与证书','Work, timing and certificate')} ↗</a> ·
        <a href="${report}">${t('核验报告','Verification report')} ↗</a></p>
      </div>`;
  }

  async function loadControllerTimingSupplement(publication,entry,path) {
    if(!publication.files.some(file=>file.website_path===path))return null;
    const response=await fetch('./'+path,{cache:'no-cache'});
    const value=await readPublishedJson(publication,path,response);
    const streaming=path===controllerStreamingPath;
    const schema=streaming?'controller-r8-streamed-heavy-load/v1':'controller-r8-closed-loop-c8/v1';
    if(value.schema!==schema||value.engine_release!==entry.engine_release||value.state_resident_seats!==entry.state_resident_seats)
      throw Error('Unmatched timing supplement');
    const positive=value=>Number.isFinite(value)&&value>0;
    if(!streaming&&(value.concurrency!==8||value.rows?.map(row=>row.id).join()!=='4096-formal,16384-formal'))
      throw Error('Incomplete original closed-loop C8 intervals');
    for(const row of streaming?[value]:value.rows){
      for(const arm of [row.direct,row.controller]){
        const time=streaming?arm.elapsed_seconds:arm.cohort_wall_seconds;
        if(!positive(time)||!positive(arm.mean_ttft_ms)||!positive(arm.mean_tpot_ms)||
          !Number.isInteger(arm.requests)||!positive(arm.requests)||!close(arm.output_tokens_per_second,arm.output_tokens/time))
          throw Error('Incomplete requests or timing observations');
        if(streaming&&(arm.requests!==entry.result.direct.successful_requests||arm.output_tokens!==entry.result.direct.output_tokens||
          arm.tpot_requests<1||arm.tpot_requests>arm.requests||
          (arm.cached_input_percent!==null&&(!Number.isFinite(arm.cached_input_percent)||arm.cached_input_percent<0||arm.cached_input_percent>100))))
          throw Error('Unmatched streamed heavy-load census');
        if(!streaming&&(arm.phase!==row.id||time<300||arm.seconds!==300||arm.output_tokens!==256*arm.requests))
          throw Error('Unmatched standardized C8 window or output budget');
      }
    }
    return value;
  }

  window.vllmHustControllerEvidence=Object.freeze({
    controllerFixedProfilesPath,controllerComputePath,controllerNativeComputePath,controllerStreamingPath,controllerC8Path,
    readPublishedJson,loadControllerFixedProfiles,loadControllerCompute,loadControllerNativeCompute,
    controllerNativeComputeDetails,loadControllerTimingSupplement
  });
})();
