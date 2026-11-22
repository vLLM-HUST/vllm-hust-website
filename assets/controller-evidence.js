(() => {
  'use strict';
  const controllerFixedProfilesPath = 'data/controller-r8-fixed-profiles-repeat-v1.json';
  const controllerComputePath = 'data/controller-r8-mmlu256-service-compute-v1.json';
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
    controllerFixedProfilesPath,controllerComputePath,controllerStreamingPath,controllerC8Path,
    readPublishedJson,loadControllerFixedProfiles,loadControllerCompute,loadControllerTimingSupplement
  });
})();
