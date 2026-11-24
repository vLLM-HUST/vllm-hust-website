(() => {
  'use strict';
  const zh = {
    'control-kicker':'引擎控制面组件','control-title':'请求限流控制器','control-component-name':'请求限流控制器','control-product-link':'引擎控制面 ↗','control-owner':'负责人：毛言粲',
    'control-lede':'在请求到达引擎前协调多轮程序。在资源竞争时保留有用的程序状态，减少重复 prefill。',
    'control-result-link':'实测结果 ↓','control-deploy-link':'部署方式 ↓','control-repo-link':'源码与开发 ↗',
    'control-path-title':'请求路径','control-client':'客户端','control-program':'多轮程序','control-controller':'调度组件','control-engine':'模型服务',
    'control-path-note':'独立运行的 CPU 服务。引擎执行上限和状态容量仍是明确的资源约束。',
    'control-how-title':'按程序进展协调请求',
    'control-release-title':'决定请求放行','control-release-copy':'结合程序身份与引擎状态，决定等待中的请求何时执行。',
    'control-wait-title':'管理等待','control-wait-copy':'让部分程序暂时等待，其他程序继续运行。端到端结果包含限流层里的等待时间。',
    'control-cache-title':'保留有用状态','control-cache-copy':'协调程序续轮、结束释放与引擎状态管理。对照两组都必须开启跨轮缓存复用。',
    'control-results-title':'实测结果','control-results-intro':'在同一个优化引擎上，对比直连与加入原版 ThunderAgent 调度的结果。引擎自身 B0/B1 收益单独报告。',
    'control-deploy-title':'限流组件与模型分别启动','control-deploy-copy':'先用引擎入口启动模型并预热；再以 RIDE local 启动独立的请求限流控制器 CPU 服务，指定模型地址；最后把带程序身份的请求发送到限流层。',
    'control-model-step':'1. 模型服务','control-model-copy':'固定引擎版本、模型、设备编号与缓存设置，为目标负载配置任务状态和 KV 容量。','control-engine-link':'引擎版本与启动入口 ↗',
    'control-service-step':'2. 限流组件','control-service-copy':'请求限流控制器与引擎分别管理生命周期。本次实测使用 RIDE local，无需以 Ray 接入为前提。','control-guide-link':'部署指南 ↗',
    'control-benchmark-step':'3. 匹配实验','control-benchmark-copy':'两组使用同一冻结输入和引擎配置，完整保留输出量、质量、等待时间与失败。','control-protocol-link':'实验规范 ↗',
    'control-build-title':'基于限流组件继续开发','control-build-copy':'沿现有接口开发调度策略；在相同负载下与原版请求限流控制器对比，同时保留收益与退化。',
    'control-development-link':'仓库与接口 ↗','control-track-link':'实验跟踪与开放问题 ↗','control-engine-results-link':'引擎 B0/B1 结果 ↗',
    'footer-copy':'vLLM-HUST · 请求调度与可复现实测。'
  };
  const en = Object.fromEntries(Object.keys(zh).map(id => [id, document.getElementById(id)?.textContent || '']));
  en.title = 'Request Throttling Controller | vLLM-HUST';
  zh.title = `${zh['control-title']} · 引擎控制面 | vLLM-HUST`;
  window.vllmHustPageDict = {en, zh};
  let publication, selected, data, latest;
  const {
    controllerFixedProfilesPath,controllerComputePath,controllerStreamingPath,
    readPublishedJson,loadControllerFixedProfiles,loadControllerCompute,loadControllerTimingSupplement
  }=window.vllmHustControllerEvidence;
  const root = document.getElementById('control-results');
  const t = (cn, english) => document.documentElement.lang === 'zh' ? cn : english;
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (value, digits=2) => Number.isFinite(value) ? value.toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
  const table = (head, rows) => `<div class="control-table-wrap"><table class="control-table"><thead><tr>${head.map(v=>`<th scope="col">${esc(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<${i?'td':'th scope="row"'}>${esc(v)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const close = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<1e-5;
  function validate(value) {
    if(value.schema !== 'controller-product-results/v1' || !Array.isArray(value.releases) || !value.releases.length || !value.releases.some(r=>r.id===value.default_release)) throw Error('Invalid result catalog');
    const ids=new Set();
    for(const entry of value.releases) {
      if(ids.has(entry.id) || entry.repetitions_per_arm!==1 || !entry.result.completed_pair || !Array.isArray(entry.profiles) || !Array.isArray(entry.changelog)) throw Error('Invalid paired scope');
      ids.add(entry.id);
      const r=entry.result,a=r.direct,b=r.request_throttling_controller;
      for(const arm of [a,b]) if(arm.completed_tasks!==arm.tasks || arm.successful_requests<=0 || arm.failed_requests!==0 || arm.elapsed_seconds<=0) throw Error('Incomplete primary pair');
      if(a.successful_requests!==b.successful_requests || a.input_tokens!==b.input_tokens || a.output_tokens!==b.output_tokens || !close(r.time_reduction_percent,100*(1-b.elapsed_seconds/a.elapsed_seconds))) throw Error('Primary pair arithmetic mismatch');
      for(const p of entry.profiles) {
        if(p.status==='deferred' || p.status==='not_run') continue;
        if(p.status!=='complete' || !p.same_client_request_bodies || !p.same_per_case_engine_prompt_tokens) throw Error('Unmatched dataset profile');
        for(const arm of [p.direct,p.controller]) if(arm.successful!==arm.planned || arm.release_errors!==0 || !(arm.elapsed_seconds>0)) throw Error('Incomplete dataset arm');
        if(!close(p.time_reduction_percent,100*(1-p.controller.elapsed_seconds/p.direct.elapsed_seconds))) throw Error('Dataset arithmetic mismatch');
      }
    }
    return value;
  }
  function render() {
    if(!data) return;
    const e=data.releases.find(row=>row.id===selected),r=e.result;
    const {fixed,streaming,compute}=selected===latest?.id?latest:{};
    const a=streaming?.direct||r.direct,b=streaming?.controller||r.request_throttling_controller;
    const profileLabels=new Map(e.profiles.map(row=>[row.id,row.label]));
    const profiles=fixed?.profiles||e.profiles;
    const reduction=100*(1-b.elapsed_seconds/a.elapsed_seconds);
    const source=`https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${publication.commit}/${e.report_path}`;
    const comparisonLink=fixed?`<a href="./b0-b1.html?release=${esc(e.id)}&amp;controlplane=request-throttling">${t('本次复测的完整数据与图表','Full measurements and charts from the repeat')} ↗</a>`:'';
    const streamingLink=streaming?`<a href="./${controllerStreamingPath}">${t('流式重负载来源','Streaming heavy-load source')} ↗</a>`:'';
    document.getElementById('control-highlight').textContent = 'SWE Trace Heavy Load · '+
      (streaming?t('流式复测整批耗时缩短 ', 'Streaming batch time reduction '):t('首轮整批耗时缩短 ', 'Initial batch time reduction '))+
      num(reduction)+'% · '+e.id;
    const cards=[
      [t('完整批次耗时缩短','Batch time reduction'),`${num(reduction)}%`,`${num(a.elapsed_seconds)} → ${num(b.elapsed_seconds)} s`],
      [t('输入 token 缓存命中','Cached input tokens'),`${num(a.cached_input_percent)}% → ${num(b.cached_input_percent)}%`,t('按输入 token 数加权；包含首轮','Weighted by input tokens, including first turns')],
      [t('每组成功请求','Successful requests per arm'),`${num(a.requests??a.successful_requests,0)} / ${num(b.requests??b.successful_requests,0)}`,t('两组均无请求失败','No failed requests in either arm')],
      [t('完成的三轮程序实例','Completed three-turn instances'),num(r.direct.completed_tasks,0),t('按相同程序清单回放，统计完成实例','Completed instances from the matched program list')]
    ];
    const rows=profiles.map(p=>p.status==='complete' ? [profileLabels.get(p.id),num(p.direct.elapsed_seconds),num(p.controller.elapsed_seconds),`${num(p.time_reduction_percent)}%`,`${num(p.output_token_change_percent)}%`] : [profileLabels.get(p.id),'—','—',t(p.reason_zh,p.reason_en),'—']);
    const qualityRows=fixed?fixed.profiles.slice(0,3).map(profile=>{
      const correct=({quality})=>{
        if(profile.id==='mmlu')return quality.correct+' / '+quality.planned;
        const groups=Object.values(quality.groups||quality.tracks);
        const sum=key=>groups.reduce((total,group)=>total+group[key],0);
        return `${sum('successes')} / ${sum('total')} · ${sum(profile.id==='hle'?'unresolved':'judge_invalid')} ${t('未判定','unresolved')}`;
      };
      return [profileLabels.get(profile.id),correct(profile.direct),correct(profile.controller)];
    }):e.quality_rows.map(v=>[t(v.label_zh,v.label_en),v.direct,v.controller]);
    const mechanismRows=[
      [t('续轮零命中次数','Zero-hit continuations'),r.direct.zero_hit_continuations,r.request_throttling_controller.zero_hit_continuations],
      [t('输出 token','Output tokens'),a.output_tokens,b.output_tokens],
      streaming?[t('端到端 P99（秒）','End-to-end P99 (s)'),num(a.end_to_end_p99_ms/1000),num(b.end_to_end_p99_ms/1000)]:
        [t('请求平均时延（秒）','Mean request latency (s)'),num(a.request_latency_seconds.mean),num(b.request_latency_seconds.mean)]
    ];
    const serviceCompute=compute?`<h3>${t('服务侧矩阵算力下界','Service-side matrix compute lower bound')}</h3>
      <p class="control-scope">MMLU-Pro 200 · ${t('输出上限 256 · 各三轮','256 output token limit · three rounds per arm')}</p>
      ${table([t('必要矩阵计算速率下界（TFLOP/s/卡）','Necessary matrix work lower rate (TFLOP/s per accelerator)'),t('直连引擎','Direct engine'),t('加限流层','With controller')],
        [[t('整批服务计时，含双卡同步','Service batch timing including both accelerator fences'),
          ...['direct','controller'].map(side=>'≥'+num(Math.floor(compute.arms[side].target_matrix_tflops_per_card_lower*100)/100))]])}
      <p class="control-scope">${t('V2 4.1 尚缺控制面工况的原生双卡计时、完整必要算量和经核验的同工况参考上界。','V2 4.1 for this controller setup still needs native two-card timing, complete necessary work and a verified upper bound for the matched reference.')}
        <a href="./${controllerComputePath}">${t('逐轮记录','Per-round records')} ↗</a>
        <a href="./test-plan.html">${t('V2 核验口径','V2 verification protocol')} ↗</a></p>`:'';
    root.innerHTML=`<div class="control-toolbar"><label for="control-release">${t('版本与历史记录','Version and history')}</label><select id="control-release">${data.releases.map(v=>`<option value="${esc(v.id)}" ${v.id===selected?'selected':''}>${esc(t(v.label.replace(en['control-title'], zh['control-title']),v.label))}</option>`).join('')}</select><a href="${esc(source)}">${t('首轮报告与证据','Initial report and evidence')} ↗</a>${comparisonLink}${streamingLink}</div>
      <p class="control-scope">${esc(e.engine_release)} · Qwen3.5-35B-A3B BF16 · 2 × Ascend 910B2 · ${t('执行上限','Execution limit')} ${esc(e.max_num_seqs)} · ${t('状态驻留','Resident states')} ${esc(e.state_resident_seats)}</p>
      <div class="control-summary">${cards.map(([label,value,note])=>`<article><span>${esc(label)}</span><strong>${esc(value)}</strong><p>${esc(note)}</p></article>`).join('')}</div>
      <h3>SWE Trace Heavy Load</h3>
      <p class="control-scope">${esc(t(e.scope_zh,e.scope_en))}</p>
      <figure class="control-chart"><figcaption>${t('整批完成时间，包含限流等待；越短越好','Full batch completion, including controller waiting; lower is better')}</figcaption>${[[t('直连引擎','Direct engine'),a.elapsed_seconds,'direct'],[t('加限流层','With controller'),b.elapsed_seconds,'']].map(([name,value,cls])=>`<div class="control-bar-line"><span>${esc(name)}</span><div><div class="control-bar ${cls}" style="width:${100*value/Math.max(a.elapsed_seconds,b.elapsed_seconds)}%"></div></div><output>${num(value)} s</output></div>`).join('')}</figure>
      <details class="control-details"><summary>${t('配置覆盖与机制证据','Configuration overrides and mechanism evidence')}</summary><ul>${e.overrides.map(v=>`<li>${esc(t(v.zh,v.en))}</li>`).join('')}</ul>${streaming?`<p>${t('零命中次数来自首轮非流式封存。','Zero-hit counts come from the initial non-streaming run.')}</p>`:''}
      ${table(t(['指标','直连引擎','加限流层'],['Metric','Direct engine','With controller']),mechanismRows)}<p>${esc(t(e.limitations_zh,e.limitations_en))}</p></details>
      <h3>${fixed?t('五项固定数据集复测','Repeat across five fixed datasets'):t('首轮固定数据集对照','Initial fixed dataset comparison')}</h3><p class="control-scope">${t('耗时缩短的负值表示变慢。输出量可能不同，请结合输出 token 数与评分解读耗时变化。','A negative time reduction means slower. Interpret timing changes together with output token counts and grades.')}
        ${fixed?`<a href="./${controllerFixedProfilesPath}">${t('五项复测与评分来源','Fixed repeat and grading source')} ↗</a>`:''}</p>
      ${table(t(['数据集','直连秒','限流秒','耗时缩短','输出 token 变化'],['Dataset','Direct (s)','Controller (s)','Time reduction','Output token change']),rows)}
      <details class="control-details"><summary>${t('质量、截断与时延','Quality, truncation and latency')}</summary>${table(t(['指标','直连引擎','加限流层'],['Metric','Direct engine','With controller']),qualityRows)}<p>${esc(fixed?t('公开轨迹只统计回放性能。','Public traces report replay performance.'):t(e.quality_note_zh,e.quality_note_en))}</p>${table(t(['数据集','直连 HTTP P95 / P99 秒','限流 HTTP P95 / P99 秒'],['Dataset','Direct HTTP P95 / P99 (s)','Controller HTTP P95 / P99 (s)']),profiles.filter(p=>p.status==='complete').map(p=>[profileLabels.get(p.id),`${num(p.direct.latency_seconds.p95)} / ${num(p.direct.latency_seconds.p99)}`,`${num(p.controller.latency_seconds.p95)} / ${num(p.controller.latency_seconds.p99)}`]))}</details>
      ${serviceCompute}
      <details class="control-details"><summary>${t('变更记录与适用边界','Changelog and boundaries')}</summary><ul>${e.changelog.map(v=>`<li><strong>${esc(v.date)}</strong> ${esc(t(v.zh,v.en))}</li>`).join('')}</ul></details>`;
    document.getElementById('control-release').addEventListener('change',event=>{selected=event.target.value;render();document.getElementById('control-release').focus();});
    root.dataset.loaded=selected;root.setAttribute('aria-busy','false');
  }
  async function load() {
    const m=await fetch('./data/benchmark-source-manifest.json',{cache:'no-cache'});if(!m.ok)throw Error('Missing publication manifest');publication=await m.json();
    if(publication.repository!=='vLLM-HUST/vllm-hust-benchmark' || publication.status!=='published-source' || !/^[a-f0-9]{40}$/.test(publication.commit))throw Error('Unpublished source');
    const path='data/controller-product-results-v1.json';
    data=validate(await readPublishedJson(publication,path,await fetch('./'+path,{cache:'no-cache'})));
    const entry=data.releases.find(row=>row.id==='r8');
    if(entry){
      const optional=(label,promise)=>promise.catch(error=>{
        console.warn('Controller '+label+' supplement rejected',error);
        return null;
      });
      const [fixed,streaming,compute]=await Promise.all([
        optional('fixed profiles',loadControllerFixedProfiles(publication,entry)),
        optional('streaming',loadControllerTimingSupplement(publication,entry,controllerStreamingPath)),
        optional('service compute',loadControllerCompute(publication,entry))
      ]);
      latest={id:entry.id,fixed,streaming,compute};
    }
    const requested=new URLSearchParams(location.search).get('release');
    selected=data.releases.some(entry=>entry.id===requested)?requested:data.default_release;
    render();
  }
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load().catch(error=>{root.innerHTML=`<div class="control-error"><p>${t('结果来源校验未通过，暂不展示性能数值。','Result provenance verification failed; measurements are not displayed.')}</p><a href="https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/main/reports">${t('查看原始报告','View original reports')} ↗</a></div>`;root.setAttribute('aria-busy','false');root.dataset.error=error.message;});
})();
