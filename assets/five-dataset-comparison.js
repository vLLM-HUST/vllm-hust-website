(() => {
  'use strict';
  // Update this committed source path only after the new benchmark report is audited.
  const summaryPath = 'data/five-datasets-r6-20261114/summary-public-v3.json';
  const supplementAnalysisSha = '0e3947af17badfa7edb244a2ca397c5367480678eeb416bb1c1f886d02c08c5f'; // pragma: allowlist secret -- fixed public evidence digest
  const root = document.getElementById('five-dataset-comparison');
  if (!root) return;
  const combinationPath = 'data/five-datasets-r6-20261114/frozen-combination-v1.json';
  let data, manifest, combination, controllerProgress;
  const t = (zh, en) => window.vllmHustSite.getCurrentLang() === 'zh' ? zh : en;
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number.isFinite(v) ? v.toFixed(2) : '—';
  const {
    controllerFixedProfilesPath,controllerComputePath,controllerNativeComputePath,controllerStreamingPath,controllerC8Path,
    readPublishedJson,loadControllerFixedProfiles,loadControllerCompute,loadControllerNativeCompute,
    controllerNativeComputeDetails,loadControllerTimingSupplement
  }=window.vllmHustControllerEvidence;
  const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= 1e-8 * Math.max(1, Math.abs(b));
  const modelIntegrationResults = new Map();
  const submissionAssessments = new Map();
  const stableAssessments = new Map();
  const table = (heads, rows) => `<div class="focus-table" tabindex="0" role="region" aria-label="${esc(heads.join(' / '))}"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<${i?'td':'th scope="row"'}>${esc(v)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const required = ['3.4.1','3.4.2','3.4.3','3.4.4'];
  const names = () => t(['有效算力','吞吐与时延','上下文稳定性','成本与利用率'], ['Effective compute','Throughput and latency','Context stability','Cost and utilization']);

  function validate(d) {
    const fail = () => { throw Error('Incomplete or inconsistent five-profile publication'); };
    if (d.schema !== 'sealed-five-dataset-comparison/v1' || d.execution_complete !== true ||
        d.scope !== 'all_five_frozen_profiles_not_all_upstream_items' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(d.report_date) || !/^[a-f0-9]{40}$/.test(d.aggregation_engine_commit) ||
        !Number.isInteger(d.reused_stages) || !Number.isInteger(d.new_inference_stages) ||
        d.reused_stages < 0 || d.new_inference_stages < 0 || d.reused_stages + d.new_inference_stages !== 15 ||
        d.datasets?.length !== 5 || d.source_provenance?.stages?.length !== 15) fail();
    const ids = ['mmlu','hle','frontier','swe','terminal'], counts = [200,200,160,64,48];
    d.datasets.forEach((row,i) => {
      if (row.id !== ids[i] || row.mode !== (i<3?'quality_and_inference':'inference_only')) fail();
      for (const role of ['B0','B1']) {
        const a = row.arms?.[role];
        if (!a || a.planned !== counts[i] || a.recorded !== counts[i] || a.successful !== counts[i] ||
            a.failed !== 0 || a.unreturned !== 0 || ![a.duration_seconds,a.successful_output_tokens,a.output_tokens_per_second,a.mean_ttft_ms,a.mean_tpot_ms,a.estimated_cny_per_million_output_tokens].every(v=>Number.isFinite(v)&&v>0) ||
            !close(a.successful_output_tokens/a.duration_seconds,a.output_tokens_per_second)) fail();
        if (i<3) {
          const q = row.quality?.[role];
          const count = i===0 ? q?.planned_denominator : Object.values(q?.tracks || {}).reduce((s,x)=>s+x.total,0);
          if (count !== counts[i]) fail();
        } else if (row.quality !== null) fail();
      }
      for (const key of ['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms']) {
        if (!close(row.changes_percent?.[key],100*(row.arms.B1[key]/row.arms.B0[key]-1))) fail();
      }
      if (!close(row.changes_percent?.unit_cost_change_percent,100*(row.arms.B1.estimated_cny_per_million_output_tokens/row.arms.B0.estimated_cny_per_million_output_tokens-1))) fail();
    });
    const supplement=d.acceptance_supplement;
    if (supplement?.schema!=='sealed-A01-context-tenant-publication/v1' || supplement.execution_complete!==true ||
        supplement.source_analysis_sha256!==supplementAnalysisSha ||
        supplement.chart_path!=='data/context-tenant-a01-20261115/paired-overview.svg' ||
        supplement.comparisons?.length!==4 || supplement.fixed_five_datasets_rerun!==false) fail();
    const phases=['4096-formal','16384-formal','32768-formal','multi-tenant-formal'];
    supplement.comparisons.forEach((row,i)=>{
      if(row.phase!==phases[i])fail();
      for(const role of ['B0','B1']) {
        const arm=row.arms?.[role],m=arm?.metrics;
        if(!m || m.failed!==0 || m.requests!==m.successful || arm.windows?.length!==5 ||
            !close(m.output_tokens/m.duration_seconds,m.output_tokens_per_second) ||
            arm.windows.some(w=>w.metrics.failed!==0 || w.metrics.requests!==w.metrics.successful))fail();
      }
      if(!close(row.throughput_ratio,row.arms.B1.metrics.output_tokens_per_second/row.arms.B0.metrics.output_tokens_per_second) ||
          !close(row.cost_reduction_percent,100*(1-1/row.throughput_ratio)))fail();
    });
    const assessment=supplement.qualitative_assessment;
    if(d.formal_targets['3.4.3'].accepted!==assessment.milestone_context.accepted ||
        (d.project_final_assessment.targets['3.4.3'].attainment==='demonstrated')!==assessment.final_context.accepted ||
        (d.project_final_assessment.targets['3.4.4'].attainment==='demonstrated')!==assessment.final_cost.accepted)fail();
    window.vllmHustProjectMilestones.validate(d);
    const reference=d.compute_reference_statistics;
    if (reference?.schema!=='qualified-reference-denominator/v1' || reference.scope?.max_completion_tokens!==256 || reference.calculation?.chips!==2) fail();
    for (const role of ['B0','B1']) {
      const r=reference.arms?.[role];
      if (!r || r.reference_repetitions?.length!==3 || !close(Number(r.reference_tflops_per_card_upper),r.effective_flops_interval[1]/(2*Number(r.sum_reference_seconds_lower)*1e12))) fail();
    }
    for (const id of required) {
      if (typeof d.formal_targets?.[id]?.accepted !== 'boolean' ||
          !['demonstrated','not_demonstrated'].includes(d.project_final_assessment?.targets?.[id]?.attainment)) fail();
    }
  }

  function qualityRows() {
    return data.datasets.slice(0,3).flatMap(row=>['B0','B1'].map(role=>{
      const q = row.quality[role], tracks = Object.entries(q.tracks || {});
      if (row.id === 'mmlu') return [row.name,role,`${q.correct}/${q.planned_denominator}`,q.truncated_recorded,q.unparsed_recorded,'—','—',q.unreturned];
      return [row.name,role,tracks.map(([name,x])=>`${name}: ${x.successes}/${x.total}`).join('; '),
        tracks.reduce((s,[,x])=>s+x.solver_truncated,0),
        '—',
        tracks.reduce((s,[,x])=>s+(x.unresolved ?? x.judge_unresolved),0),
        tracks.reduce((s,[,x])=>s+x.judge_truncated,0),row.arms[role].unreturned];
    }));
  }


  const profileNames = () => t(['MMLU200','HLE200','Frontier160','SWE trace64','Terminal trace48'],['MMLU200','HLE200','Frontier160','SWE trace64','Terminal trace48']);
  const attainment = (id, final = false) => {
    const goal = final ? data.project_final_assessment.targets[id] : window.vllmHustProjectMilestones.select(data,id);
    const met = final ? goal.attainment === 'demonstrated' : goal.accepted;
    return met ? t('达成目标','Target met') : t('未达成目标','Target not met');
  };
  const continuousWorkloadLabel = () => t('闭环连续压测 · 并发 8','Closed-loop continuous stress test · concurrency 8');
  const terminalReplayWorkloadLabel = () => t('Terminal-Bench 2.1 离线请求回放 · 并发 8','Terminal-Bench 2.1 offline request replay · concurrency 8');
  const validPhysicalCards = cards => Array.isArray(cards)&&cards.length===2&&
    new Set(cards).size===cards.length&&cards.every(card=>Number.isInteger(card)&&card>=0);
  function cardComparison(before, after) {
    if(!before||!after)return {};
    const crossCard=before.slice().sort().join()!==after.slice().sort().join();
    const cardLabel=`B0 [${before.join(', ')}] → B1 [${after.join(', ')}]`;
    return {cardLabel,crossCard};
  }
  function cardComparisonLabel({cardLabel,crossCard}) {
    return cardLabel?`${crossCard?t('跨卡对照','Cross-card comparison'):t('同卡对照','Matched cards')} · ${cardLabel}`:'';
  }
  function cardComparisonAttribute({cardLabel,crossCard}) {
    return cardLabel?` data-card-comparison="${crossCard?'cross-card':'matched'}"`:'';
  }
  function chart(key, title, unit, divisor = 1, rows = data.datasets, labels = profileNames(), roles = {B0:'B0',B1:'B1'}) {
    const maximum = Math.max(1,...rows.filter(row=>row.arms?.B0&&row.arms?.B1).map(d=>d.arms.B1[key]/d.arms.B0[key]));
    return `<article class="metric-chart" data-metric="${key}"><header><h3>${title}</h3><span>${unit}</span></header><div class="chart-legend"><span class="legend-b0">${esc(roles.B0)}</span><span class="legend-b1">${esc(roles.B1)}</span></div>${rows.map((row,i)=>{
      if(row.baselineObservation){
        const base=row.baselineObservation;
        const candidate=key==='relative_cost_per_token'?null:row.observation?.[key];
        const before=base[key],limit=Math.max(1,before,Number.isFinite(candidate)?candidate:0);
        const line=(role,value)=>`<div class="bar-line"><span class="bar-role">${role}</span><span class="bar-track">${Number.isFinite(value)?`<span class="bar-fill ${role.toLowerCase()}" style="width:${100*value/limit}%"></span>`:''}</span><span class="bar-value">${n(Number.isFinite(value)?value/divisor:null)}</span></div>`;
        return `<div class="chart-row" data-profile="${esc(row.id)}" data-baseline-observation="verified"${row.observation?' data-observation="single-arm"':''}><div class="chart-row-heading"><strong>${esc(labels[i])}<small class="chart-workload-label">B0 · ${esc(row.baselineModel)}${row.observation?' / B1 · '+esc(row.model):''}</small></strong><span>${Number.isFinite(before)&&Number.isFinite(candidate)?t('分别实测','Separate measurements'):Number.isFinite(before)?t('B0 已测 · B1 暂无结果','B0 measured · B1 unpublished'):Number.isFinite(candidate)?t('B1 已测 · B0 暂无结果','B1 measured · B0 unpublished'):t('未发布','Unpublished')}</span></div>${line('B0',before)}${line('B1',candidate)}</div>`;
      }
      if(row.observation){
        const raw=key==='relative_cost_per_token'?null:row.observation[key];
        const value=Number.isFinite(raw)?n(raw/divisor):'—';
        return `<div class="chart-row" data-profile="${esc(row.id)}" data-observation="single-arm"><div class="chart-row-heading"><strong>${esc(labels[i])}<small class="chart-workload-label">${esc(row.model)} · ${Number.isFinite(raw)?t('单臂实测','Single-arm measurement'):t('本指标未发布','This metric is unpublished')}</small></strong><span>${Number.isFinite(raw)?t('原值','Measured value'):t('未发布','Unpublished')}</span></div><div class="bar-line"><span class="bar-role">B0</span><span class="bar-track"></span><span class="bar-value">—</span></div><div class="bar-line"><span class="bar-role">B1</span><span class="bar-track"></span><span class="bar-value">${value}</span></div></div>`;
      }
      if(!row.arms?.B0||!row.arms?.B1)return `<div class="chart-row metric-missing" data-profile="${esc(row.id)}" data-missing="true"><div class="chart-row-heading"><strong>${esc(labels[i])}</strong><span aria-label="${t('无配对数据','No paired data')}">—</span></div><p class="missing-metric">${esc(row.missingReason||t('本版未发布配对数据','No published pair for this version'))}</p></div>`;
      const change = key==='estimated_cny_per_million_output_tokens' ? row.changes_percent.unit_cost_change_percent : row.changes_percent[key];
      const good = key==='output_tokens_per_second' ? change>=0 : change<=0;
      return `<div class="chart-row" data-profile="${row.id}"${cardComparisonAttribute(row)}><div class="chart-row-heading"><strong>${esc(labels[i])}${row.workloadLabel?`<small class="chart-workload-label">${esc(row.workloadLabel)}</small>`:''}</strong><span class="metric-change ${good?'favorable':'regression'}">${row.metricScope?esc(row.metricScope)+' · ':''}${change>0?'+':''}${n(change)}%</span></div>${['B0','B1'].map(role=>{
        const value=row.arms[role][key]/divisor;
        return `<div class="bar-line" aria-label="${esc(`${labels[i]} ${row.workloadLabel||''} ${roles[role]} ${n(value)} ${unit}`)}"><span class="bar-role">${esc(roles[role])}</span><span class="bar-track"><span class="bar-fill ${role.toLowerCase()}" style="width:${100*row.arms[role][key]/row.arms.B0[key]/maximum}%"></span></span><span class="bar-value">${n(value)}</span></div>`;
      }).join('')}</div>`;
    }).join('')}</article>`;
  }
  function detailContent(key) {
    const final=data.project_final_assessment.targets;
    const requirements=t(['同工况参考效率 ≥50%','吞吐提升 ≥10%，TTFT/TPOT各降低 ≥5%','16K相对4K吞吐同量级，P95/P99稳定','单位token成本降低 ≥10%，高负载利用率改善'],['Workload-reference efficiency ≥50%','Throughput +10%; TTFT/TPOT each −5%','16K vs4K throughput and P95/P99 stability','Unit token cost −10%; higher utilization at load']);
    if (key.startsWith('goal-')) {
      const id=key.slice(5),i=required.indexOf(id),goal=data.formal_targets[id];
      let body=table(t(['阶段','要求','当前结果'],['Stage','Requirement','Current result']),[
        [t('项目里程碑','Project milestone'),requirements[i],attainment(id)],
        [t('项目最终目标','Project final'),t(final[id].requirement,final[id].requirement_en),attainment(id,true)]]);
      if (id==='3.4.1') {
        const stats=data.compute_reference_statistics;
        body+=`<p>${t('原固定MMLU200/out256工况的50%里程碑记录见下表。当前送测版本以同轮F、同步T及适用的独立参考分母计算效率；三轮原始值与复算表一并归档。','The table retains the original MMLU200/out256 record for the 50% milestone. Assess the submitted version using same-run F, synchronized T and an applicable independent reference denominator; archive all three repetitions and recomputation tables.')}</p>
          <p class="formula">C<sub>ref</sub><sup>U</sup> = ΣF<sup>U</sup> / (k × ΣT<sub>ref</sub><sup>L</sup> × 10¹²)</p>
          <p>${t('单位TFLOP/s/卡，k=2。F上界是必要算量上界，参考耗时下界来自独立组件标定与资源依赖图。','Unit:TFLOP/s/card; k=2. F upper bounds necessary work; reference time lower bounds come from independently calibrated component/resource dependency graphs.')}</p>
          ${table(t(['原参考域','ΣF上界 / FLOPs','ΣT参考下界 / 秒','参考算力上界 / TFLOP/s/卡'],['Original domain','ΣF upper / FLOPs','ΣTref lower / s','Reference upper / TFLOP/s/card']),['B0','B1'].map(role=>{const r=stats.arms[role];return [role,r.effective_flops_interval[1],r.sum_reference_seconds_lower,Number(r.reference_tflops_per_card_upper).toFixed(8)];}))}
          <p>${t('三轮全部先求和再相除，不平均逐轮速率。参考图按 finish(v)=duration(v)+max(finish(parent)) 求最长完成路径；经证明的保留图只删除非负工作或约束，故给出时间下界。参考构造不使用目标端到端耗时或目标效率。','Sum all three repetitions before division; do not average their rates. Compute the longest completion path using finish(v)=duration(v)+max(finish(parent)). The certified retained graph removes only nonnegative work or constraints, giving a time lower bound. Target endpoint times and efficiency are not inputs to reference construction.')}</p>
          <p class="formula">C<sub>current</sub><sup>L</sup> = ΣF<sub>current</sub><sup>L</sup> / (k × ΣT<sub>current</sub> × 10¹²)<br>η<sup>L</sup> = 100 × C<sub>current</sub><sup>L</sup> / C<sub>ref</sub><sup>U</sup></p>
          <p>${t('必要工作量相同且F可合法消去时，才可化简为100×ΣT参考下界/ΣT本轮。原MMLU200/out256/native inproc与本轮out8192/HTTP性能计时分别核验工作域。','Only when necessary work is identical and F can validly cancel may efficiency simplify to100×ΣTref_lower/ΣTcurrent. Original MMLU200/out256/native-inproc and current out8192/HTTP timings require separate applicability checks.')}</p><p><a href="${esc(goal.source_url)}">${t('原始参考统计与复算','Original reference statistics and recomputation')}</a></p>`;
      }
      if (id==='3.4.2') body+=`<p>${esc(t(final[id].evidence_summary,final[id].evidence_summary_en))}</p>`;
      if (id==='3.4.3') body+=`<p>${esc(t(goal.reason,'16K throughput is0.599 of4K. All five windows complete; the tested32–48K band has no sustained throughput/tail deterioration. Output throughput decreases across input lengths, with all windows and individual regressions retained.'))}</p><p>${esc(t(final[id].evidence_summary,final[id].evidence_summary_en))}</p>`;
      if (id==='3.4.4') body+=`<p>${esc(t(final[id].evidence_summary,final[id].evidence_summary_en))}</p><p>${t('同费率、同设备数折算；四租户共享同一引擎，分别完成105、103、104、103个请求。统计范围为C24、300秒正式提交窗口及其排空。','Equal rates and device counts; four logical tenants share one engine and complete105,103,104,103 requests. Scope:C24,300s formal submission window and its drain.')}</p>`;
      const actions = {
        '3.4.1': t('原验收工况已达到50%里程碑。继续完成当前冻结版本的必要算量与三轮同步计时，并推进90%最终目标。','The certified original workload already met the50% milestone. Complete current-version necessary-work accounting and three synchronized timings, then pursue the90% final target.'),
      };
      if ((!goal.accepted || final[id].attainment!=='demonstrated') && actions[id]) body+=`<p>${actions[id]}</p><p><a href="https://github.com/vLLM-HUST/vllm-hust-engine/blob/main/experiments/optimization-20261115/acceptance-goals-20261115-v3.json">${t('目标、差距与执行任务','Goals, gaps and execution tasks')}</a></p>`;
      body+=`<p><a href="./test-plan.html">${t('送测方案V2：四项两阶段判据与同轮计量','Submission plan V2: two-stage criteria and same-run measurement')}</a></p>`;
      return {title:`${id} ${names()[i]}`,body};
    }
    if (key==='supplement') {
      const a=data.acceptance_supplement;
      const labels=['4K–8K','16K–24K','32K–48K'].map(band=>`${band} · ${terminalReplayWorkloadLabel()}`).concat(t('四租户/C24','Four tenants/C24'));
      return {title:t('上下文与四租户：范围、窗口和原件','Context and four tenants: scope, windows and evidence'),body:`
        <p>${t('五条原始公开Terminal任务历史，不裁剪或补齐。两臂共享启动预热，每阶段再预热60秒、正式提交300秒，固定输出256；最终排空计入整阶段吞吐。','Five original public Terminal histories, without cropping or padding. Both arms share startup warmup, then60s warmup and300s formal submissions per phase, fixed256 output; whole-phase throughput includes the final drain.')}</p>
        ${table(t(['阶段','B0 token/s','B1 token/s','B1/B0','成本降低'],['Phase','B0 token/s','B1 token/s','B1/B0','Cost reduction']),a.comparisons.map((r,i)=>[labels[i],n(r.arms.B0.metrics.output_tokens_per_second),n(r.arms.B1.metrics.output_tokens_per_second),n(r.throughput_ratio)+'×',n(r.cost_reduction_percent)+'%']))}
        <p>${t('五个提交窗口分别跟踪其全部响应，排空区间可重叠，不能相加时长或平均各窗口吞吐来替代整阶段吞吐。所有首窗口和四条局部尾时延回归均保留。','Each submission window follows all its responses; drains can overlap. Do not sum durations or average window rates as whole-phase throughput. All first windows and four individual tail-latency regressions are retained.')}</p>
        <p>${t('B1输出吞吐随输入变长为238.13→142.54→80.82 token/s。稳定性结论限于已测输入档、C8和300秒窗口，按原大纲定性要求判断。四租户结果限于C24共享服务；成本按同费率折算。','B1 output throughput decreases238.13→142.54→80.82 token/s as input length grows. Stability follows the original qualitative outline within the tested bands,C8 and300s windows. Four-tenant results cover a shared C24 service; cost uses equal rates.')}</p>
        <p><a href="${esc(a.analysis_path)}">${t('全部窗口、利用率和局部回归','All windows, utilization and individual regressions')}</a> · <a href="${esc(a.artifacts.paired.url)}">${t('源码、分析与复算包','Source, analysis and recomputation bundle')}</a></p>
        <p>${['B0','B1'].map(role=>`<a href="${esc(a.artifacts.raw_arms[role].url)}">${role} ${t('原始流与日志','raw streams and logs')}</a>`).join(' · ')}</p>
        <p>${t('实际专项使用工具r4；最新工具为20261116-r7，包含逐请求缓存隔离、原生RPC、worker身份与当前运行计划记录修复。该专项不评分任务质量或租户安全隔离。','Actual A01 tools:r4. Latest tools:20261116-r7, with per-request cache isolation, native RPC, worker identity and current-plan metadata fixes. A01 measures inference performance; task quality and tenant isolation are separate.')}</p>`};
    }
    if (key==='metrics') {
      const metric=(field,divisor=1)=>table(t(['数据集','B0','B1','变化'],['Dataset','B0','B1','Change']),data.datasets.map((r,i)=>[profileNames()[i],n(r.arms.B0[field]/divisor),n(r.arms.B1[field]/divisor),n(field==='estimated_cny_per_million_output_tokens'?r.changes_percent.unit_cost_change_percent:r.changes_percent[field])+'%']));
      return {title:t('完整数值','Complete metrics'),body:`<h3>${t('吞吐 · token/s','Throughput · token/s')}</h3>${metric('output_tokens_per_second')}<h3>TTFT · s</h3>${metric('mean_ttft_ms',1000)}<h3>TPOT · ms</h3>${metric('mean_tpot_ms')}<h3>${t('成本 · 元/百万输出token','Cost · CNY/million output tokens')}</h3>${metric('estimated_cny_per_million_output_tokens')}`};
    }
    if (key==='methods') return {title:t('计算公式与比较方式','Formulas and comparison'),body:`<dl class="method-list">
      <dt>${t('吞吐','Throughput')}</dt><dd>${t('有效输出token数 ÷ 整批solver墙钟秒数。区间从首请求提交至最后响应完成。','Output tokens / solver batch wall seconds, from first submission to final completion.')}</dd>
      <dt>TTFT</dt><dd>${t('首内容token时刻 − 请求提交时刻，包含本批队列等待。','First content-token time − submission time, including batch queueing.')}</dd>
      <dt>TPOT</dt><dd>${t('(响应完成时刻 − 首内容token时刻) ÷ (输出token数 − 1)，逐请求等权平均。','(Completion time − first content-token time) / (output tokens − 1), averaged equally across requests.')}</dd>
      <dt>P95 / P99</dt><dd>${t('在(n−1)×q位置线性插值；连续窗口单列。','Linear interpolation at(n−1)×q; continuous windows are reported separately.')}</dd>
      <dt>${t('配对条件','Pairing')}</dt><dd>${t('相同模型权重、tokenizer、设备数、任务顺序、生成预算和评分器。每项目标在同一固定数据集内联合判断，任一数据集满足即可。','Matched weights, tokenizer, device count, task order, generation budget and graders. Joint conditions are assessed within one fixed profile; any qualifying profile suffices.')}</dd>
      <dt>${t('变化率','Change')}</dt><dd>B1 / B0 − 1</dd><dt>${t('同费率成本','Equal-rate cost')}</dt><dd>${t('设备费率 × 设备数 × 批次耗时 ÷ 有效输出token数。报价日期：','Device rate × devices × batch seconds / output tokens. Quotation date: ')}${esc(data.price_basis.checked_date)}</dd></dl>`};
    if (key==='quality') return {title:t('质量与评分明细','Quality and grading'),body:`<p>${t('MMLU使用规则评分。HLE/Frontier使用同一35B权重，由脚本另启评分阶段；裁判耗时单列。错误、截断、无法解析与未决保留原计划分母。SWE/Terminal为轨迹回放推理性能。','MMLU uses rule scoring. HLE/Frontier use the same35B weights in separately timed grading stages. Errors, truncation, unparsed and unresolved cases retain the planned denominator. SWE/Terminal measure trace inference.')}</p>${table(t(['数据集','配置','正确/计划数','回答截断','无法解析','裁判未决','裁判截断','未返回'],['Dataset','Arm','Correct/planned','Solver truncated','Unparsed','Judge unresolved','Judge truncated','Unreturned']),qualityRows())}`};
    if (key==='configuration') return {title:t('冻结配置','Frozen configuration'),body:`<p>${esc(combination.engine_release)} · ${esc(combination.worker)}</p>${table(t(['MOD / 参数','配置'],['MOD / parameter','Configuration']),combination.components.map(c=>[t(c.name_zh,c.name_en),c.configuration]))}<p>TP2 · E24/R36 · prefill4096 · context65536 · host4GiB/rank · KV20GiB/rank</p><ul>${combination.source_files.map(f=>`<li><a href="https://github.com/${f.repository}/blob/${f.commit}/${f.path}">${esc(f.path)}</a><br><code>${esc(f.sha256)}</code></li>`).join('')}</ul>`};
    const source=`https://github.com/${manifest.repository}/blob/${manifest.commit}/website-publication/${summaryPath}`;
    return {title:t('原始证据与版本','Evidence and versions'),body:`<p>${esc(data.run_id)} · ${esc(data.report_date)}</p><p>${t(`复用${data.reused_stages}个封存阶段，新执行${data.new_inference_stages}个阶段。`,`Reused${data.reused_stages} sealed stages; newly executed${data.new_inference_stages} stages.`)}</p><p><a href="${esc(source)}">${t('报告、阶段来源和校验清单','Report, stage provenance and checksums')}</a></p><code>${esc(manifest.commit)}</code>`};
  }
  function supplementView() {
    const a=data.acceptance_supplement,tenant=a.tenant_summary;
    return `<section id="context-tenant-supplement"><div class="section-heading"><h2>${t('上下文与四租户补测','Context and four-tenant supplement')}</h2><button type="button" data-detail="supplement">${t('范围、窗口与原件','Scope, windows and evidence')} ↗</button></div>
      <p>${esc(a.report_date)} · 4K–8K /16K–24K /32K–48K · C8 · ${t('四租户C24 · 各300秒','Four tenants C24 ·300s each')}</p>
      <div class="supplement-highlights"><div><span>${t('16K相对B0吞吐','16K throughput vsB0')}</span><strong>${n(a.comparisons[1].throughput_ratio)}×</strong></div><div><span>${t('四租户成本降低','Four-tenant cost reduction')}</span><strong>${n(tenant.cost_reduction_percent)}%</strong></div><div><span>${t('四租户AI Core利用率','Four-tenant AI Core utilization')}</span><strong>${n(tenant.B0_utilization.mean_percent)} → ${n(tenant.B1_utilization.mean_percent)}%</strong></div></div>
      <figure><div class="supplement-workload-label" data-workload="terminal-replay" role="note"><strong>4K–8K · 16K–24K · 32K–48K</strong><span>${terminalReplayWorkloadLabel()}</span></div><div class="supplement-plot" tabindex="0" role="region" aria-label="${t('上下文与四租户配对图，可横向滚动','Context and tenant paired chart; scroll horizontally')}"><img src="${esc(a.chart_path)}" alt="${t('4K–8K、16K–24K、32K–48K：Terminal-Bench 2.1 离线请求回放 · 并发 8；四租户并发 24 的吞吐、尾时延和利用率实测图','4K–8K, 16K–24K and 32K–48K: Terminal-Bench 2.1 offline request replay · concurrency 8; four-tenant concurrency 24 throughput, tail-latency and utilization measurements')}" width="1426" height="1022"></div><figcaption>${t('输入变长时输出吞吐下降；五窗口稳定性与局部回归见详情。','Output throughput decreases with longer inputs; see details for five-window stability and individual regressions.')}</figcaption></figure></section>`;
  }
  function renderR6() {
    if (!data || !combination) return;
    document.getElementById('comparison-title').textContent=t('B0 / B1 r6 实测对比','B0 / B1 r6 measured comparison');
    document.getElementById('comparison-lead').textContent=`${data.hardware.model} · ${data.hardware.accelerator} × ${data.hardware.cards} · ${data.hardware.dtype}`;
    const goalCards=required.map((id,i)=>`<button type="button" class="goal-card" data-detail="goal-${id}" data-goal="${id}"><span>${names()[i]}</span><strong><span class="stage-label">${t('项目里程碑','Project milestone')}</span>${attainment(id)}</strong>${id==='3.4.1' ? `<span class="reference-scope">${t('已认证工况：MMLU200/out256','Certified workload: MMLU200/out256')}</span>` : ''}<small>${t('项目最终目标','Project final')}: ${attainment(id,true)} <span aria-hidden="true">↗</span></small></button>`).join('');
    root.innerHTML=`<section class="comparison-dashboard"><div class="comparison-meta" id="report-history-links"><span>${esc(data.report_date)} · ${t(`固定五项 · 两臂各${data.datasets.reduce((n,r)=>n+r.arms.B0.successful,0)}/${data.datasets.reduce((n,r)=>n+r.arms.B0.planned,0)}请求完成`, `Five fixed profiles ·${data.datasets.reduce((n,r)=>n+r.arms.B0.successful,0)}/${data.datasets.reduce((n,r)=>n+r.arms.B0.planned,0)} requests per arm`)}</span><a href="./report-history.html">${t('历史报告','Report archive')} ↗</a></div><div class="goal-grid">${goalCards}</div>
      ${frozenProfile('r6',{B0:combination.B0.cann,B1:combination.B1.cann},combination.components.map(c=>t(c.name_zh,c.name_en)),'E24/R36 · MTP2 · FULL · TP2 · host 4 GiB/rank')}
      <div class="section-heading"><h2>${t('性能与成本','Performance and cost')}</h2><button type="button" data-detail="metrics">${t('查看数值','View metrics')} ↗</button></div><p class="chart-scale-note">${t('条形按 B0 = 1 归一，右侧为实测值。','Bars normalize B0 to1; labels show measured values.')}</p><div class="metric-grid">${chart('output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s')}${chart('mean_ttft_ms',t('首token时延 ↓','Time to first token ↓'),'s',1000)}${chart('mean_tpot_ms',t('逐token时延 ↓','Time per output token ↓'),'ms')}${chart('estimated_cny_per_million_output_tokens',t('单位输出token成本 ↓','Cost per output token ↓'),t('元/百万token','CNY/million tokens'))}</div>
      ${supplementView()}
      <div class="detail-actions">${[['methods',t('公式与比较方式','Formulas and comparison')],['quality',t('质量与评分明细','Quality and grading')],['evidence',t('原始证据','Original evidence')]].map(([key,label])=>`<button type="button" data-detail="${key}">${label} ↗</button>`).join('')}</div>
      ${detailDialog()}</section>`;
    bindDetails(detailContent);
    root.dataset.loaded=data.run_id;root.setAttribute('aria-busy','false');
  }
  function controllerProgressContent() {
    const d = controllerProgress, r = d.result;
    const rows = d.profiles.map(profile => [t(profile.label_zh, profile.label_en), (profile.engine_comparison==='historical_b1_replay' ? t('历史 B1 回放', 'Historical B1 replay') : t('已有引擎对照', 'Engine comparison published')), profile.controller_comparison === 'complete' ? t('已完成', 'Complete') : t('待补跑', 'Pending')]);
    const metrics = [
      [t('整批耗时（秒）', 'Batch time (s)'), n(r.direct.elapsed_seconds), n(r.request_throttling_controller.elapsed_seconds)],
      [t('KV 缓存输入命中率', 'Cached input tokens'), n(r.direct.cached_input_percent)+'%', n(r.request_throttling_controller.cached_input_percent)+'%'],
      [t('成功请求', 'Successful requests'), r.direct.successful_requests, r.request_throttling_controller.successful_requests],
      [t('续轮零命中次数 / 224', 'Zero-hit continuations / 224'), r.direct.zero_hit_continuations, r.request_throttling_controller.zero_hit_continuations],
    ];
    const source = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${controllerProgressCommit}/${d.report_path}`;
    return {title:t('限流层实验结果与更新记录', 'Request Throttling Controller results and changelog'),body:`
      <p><a href="./controlplane/">${t('查看第八版控制面完整结果','View the r8 control-plane results')} ↗</a></p><p>${t('以下为第六版历史配对，不代表第八版。','The following is the historical r6 pair, not r8.')}</p><p>${esc(d.updated)} · ${esc(d.model)} · ${esc(d.platform)}</p><p>${esc(d.engine_release)} · max_num_seqs=${d.max_num_seqs} · state_resident_seats=${d.state_resident_seats}</p>
      <p>${t('SWE-smith 三轮长度/等待微基准：整批耗时缩短 ', 'SWE-smith three-turn length/wait microbenchmark: batch time reduced by ')}<strong>${n(r.time_reduction_percent)}%</strong></p>
      ${table(t(['指标','直连 B1','B1 加原版 ThunderAgent'], ['Metric','B1 direct','B1 with original ThunderAgent']), metrics)}
      <p>${t('112 个任务同时到达，每组 336 次请求全部成功。两组各自冷启动和预热，执行上限 24、任务状态驻留数 80；KV 缓存占用峰值均为 99.83%。', '112 simultaneous tasks, all 336 requests successful in each arm. Both arms cold-started and warmed up independently, with execution limit 24 and 80 resident states; peak KV usage was 99.83% in both arms.')}</p>
      <p>${t('每组一次顺序配对。续轮继承各自实际输出，336 次请求中 170 次输入 token 序列一致。任务解决率尚未测量；独立重复待验证。', 'One ordered run per arm. Continuations inherit each arm’s generated outputs; 170 of 336 prompt token sequences match. Task solve rate and independent repetitions remain unmeasured.')}</p>
      <p>${t('56份长度与工具等待模板，各两个独立合成token-ID实例；续轮继承真实输出，不是原始题目文本或完整Agent任务。','56 length/tool-wait templates with two independent synthetic token-ID instances each. Continuations inherit real outputs; this is not original task text or complete Agent execution.')}</p>${table(t(['数据集','B0/B1 引擎结果','历史限流层配对覆盖'], ['Dataset','B0/B1 engine results','Historical controller-pair coverage']), rows)}
      <details><summary>${t('更新记录', 'Changelog')}</summary><ul>${d.changelog.map(row=>`<li><strong>${esc(row.date)}</strong> ${esc(t(row.zh,row.en))}</li>`).join('')}</ul></details>
      <p><a href="${esc(source)}">${t('实验配置、原始指标与复算', 'Configuration, recorded metrics and recomputation')} ↗</a> · <a href="./b0-b1-legacy.html#method-2">${t('历史对照', 'Historical comparison')} ↗</a></p>`};
  }
  let controllerProgressCommit;
  async function loadControllerProgress() {
    const path='data/controller-experiment-progress-v1.json';
    const publication=await (await fetch('./data/benchmark-source-manifest.json',{cache:'no-cache'})).json();
    if(publication.repository!=='vLLM-HUST/vllm-hust-benchmark' || publication.status!=='published-source' || !/^[a-f0-9]{40}$/.test(publication.commit)) throw Error('Invalid controller publisher');
    const matches=publication.files.filter(row=>row.website_path===path);
    if(matches.length!==1) throw Error('Missing controller publication');
    const response=await fetch('./'+path,{cache:'no-cache'});
    if(!response.ok) throw Error('Unavailable controller publication');
    const bytes=await response.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==matches[0].sha256 || bytes.byteLength!==matches[0].bytes) throw Error('Published asset checksum mismatch');
    const value=JSON.parse(new TextDecoder().decode(bytes));
    const result=value.result;
    if(value.schema!=='controller-experiment-progress/v1' || !result.completed_pair || value.state_resident_seats!==80 || value.repetitions_per_arm!==1 || value.task_quality_evaluated!==false || !Array.isArray(value.profiles) || !Array.isArray(value.changelog)) throw Error('Invalid controller comparison scope');
    for(const arm of [result.direct,result.request_throttling_controller]) {
      if(arm.completed_tasks!==112 || arm.successful_requests!==336 || arm.failed_requests!==0 || !Number.isFinite(arm.elapsed_seconds) || arm.elapsed_seconds<=0) throw Error('Incomplete controller comparison');
    }
    if(!close(result.time_reduction_percent,100*(1-result.request_throttling_controller.elapsed_seconds/result.direct.elapsed_seconds))) throw Error('Controller arithmetic mismatch');
    controllerProgress=value;controllerProgressCommit=publication.commit;
  }
  function detailDialog(prefix='comparison') {
    return `<dialog id="${prefix}-detail-dialog" class="comparison-dialog" aria-labelledby="${prefix}-dialog-title"><div class="dialog-header"><h2 id="${prefix}-dialog-title"></h2><button type="button" class="dialog-close" aria-label="${t('关闭详情','Close details')}">×</button></div><div id="${prefix}-dialog-body"></div></dialog>`;
  }
  function bindDetails(content, scope=root) {
    const dialog=scope.querySelector('dialog');
    scope.querySelectorAll('[data-detail]').forEach(button=>button.addEventListener('click',()=>{
      const value=button.dataset.detail==='controller-progress' ? controllerProgressContent() : content(button.dataset.detail);
      dialog.querySelector('.dialog-header h2').textContent=value.title;
      dialog.lastElementChild.innerHTML=value.body;
      dialog.showModal();
    }));
    scope.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog && event.clientX>=dialog.getBoundingClientRect().right)dialog.close();});
  }
  function linkedDetailKey(hash) {
    if(/^#(?:method-1|metric-1|current-qualified-compute)$/.test(hash))return 'compute';
    if(/^#(?:method-3|metric-3)$/.test(hash))return 'supplement';
    if(/^#(?:method-[24]|metric-[24])$/.test(hash))return 'methods';
    if(/^#(?:method-b0|b0-baseline)$/.test(hash))return 'configuration';
    if(hash==='#development-comparison')return 'development';
    return null;
  }
  function scrollLinkedSection(section) {
    const navHeight=document.querySelector('.site-nav')?.offsetHeight??0;
    section.style.scrollMarginTop=(navHeight+12)+'px';
    section.scrollIntoView();
  }
  function openLinkedDetail() {
    if(location.hash==='#r8-current-continuous'){
      root.querySelector('#r8-current-continuous')?.scrollIntoView();
      return;
    }
    if(root.getAttribute('aria-busy')==='true')return;
    if(location.hash==='#acceptance-stages'){
      const assessment=root.querySelector('#submission-v2');
      if(assessment){
        scrollLinkedSection(assessment);
        return;
      }
    }
    if(/^#(?:method-4|metric-4)$/.test(location.hash)){
      const rental=root.querySelector('[data-rental-cost]');
      if(rental){
        rental.open=true;
        scrollLinkedSection(rental);
        return;
      }
    }
    let key=location.hash==='#acceptance-stages'?'evidence':linkedDetailKey(location.hash);
    if(key==='compute'&&selectedRelease==='r6')key='goal-3.4.1';
    if(!key)return;
    const button=root.querySelector(`[data-detail="${key}"]`),dialog=root.querySelector('dialog');
    if(button&&dialog&&!dialog.open)button.click();
  }
  function frozenProfile(release, cann, mods, settings) {
    return `<section class="frozen-profile"><div class="section-heading"><h2>${t('本轮冻结组合','Frozen combination')}</h2><button type="button" data-detail="configuration">${t('版本与配置详情','Versions and configuration')} ↗</button><button type="button" data-detail="controller-progress">${t('限流层实验与更新记录','Controller experiments and changelog')} ↗</button></div><div class="runtime-pair"><div><strong>B0</strong><span>vLLM 0.18 / Ascend 0.18 · CANN ${esc(cann.B0)}</span></div><div><strong>B1 · ${esc(release)}</strong><span>vLLM 0.28.1 / Ascend 0.25.1rc2 · CANN ${esc(cann.B1)}</span></div></div><div class="mod-tags">${mods.map(c=>`<span>${esc(c)}</span>`).join('')}</div><p class="frozen-settings">${esc(settings)}</p></section>`;
  }

  async function loadR6() {
    const response = await fetch('./data/benchmark-source-manifest.json',{cache:'no-cache'});
    if (!response.ok) throw Error('Unavailable publication manifest');
    const m = await response.json();
    if (m.repository !== 'vLLM-HUST/vllm-hust-benchmark' || m.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(m.commit)) throw Error('Invalid publication identity');
    const entries = m.files.filter(f=>f.website_path===summaryPath);
    if (entries.length !== 1) throw Error('Unpublished or ambiguous five-profile source');
    const result = await fetch('./'+summaryPath,{cache:'no-cache'});
    if (!result.ok) throw Error('Unavailable five-profile source');
    const raw = await result.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if (hash !== entries[0].sha256 || raw.byteLength !== entries[0].bytes) throw Error('Five-profile publication hash mismatch');
    const value = JSON.parse(new TextDecoder().decode(raw));
    validate(value);
    const entry=m.files.filter(f=>f.website_path===combinationPath);
    if(entry.length!==1)throw Error('Missing frozen combination source');
    const comboResponse=await fetch('./'+combinationPath,{cache:'no-cache'});
    if(!comboResponse.ok)throw Error('Frozen combination unavailable');
    const comboRaw=await comboResponse.arrayBuffer();
    const comboHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',comboRaw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(comboHash!==entry[0].sha256 || comboRaw.byteLength!==entry[0].bytes)throw Error('Frozen combination checksum mismatch');
    const combo=JSON.parse(new TextDecoder().decode(comboRaw));
    if(combo.schema!=='vllm-hust-frozen-combination/v1' || combo.run_id!==value.run_id || combo.engine_release!==value.runtime.engine_release || combo.components?.length!==8 || combo.worker!==value.runtime.actual_worker || combo.settings?.max_num_seqs!==24 || combo.settings.resident_seats!==36)throw Error('Frozen combination differs from measured profile');
    data=value;manifest=m;combination=combo;
  }
  let releaseIds = [];
  let attemptIds = [];
  let srIds = [];
  let selectableIds = [...releaseIds,...attemptIds,...srIds];
  const controllerOption = 'request-throttling';
  const validRelease = id => /^(?:r[1-9][0-9]*|sr[1-9][0-9]*)$/.test(id||'');
  let selectedRelease, selectedBaseline, selectedController, selectedRevision, automaticRelease;
  const r10ArchivedVersion='2026.11.21.10';
  const archivedR10Selected=()=>selectedRelease==='r10'&&selectedRevision===r10ArchivedVersion;
  const currentR10Version=()=>releaseCatalog?.entries.find(entry=>entry.id==='r10')?.r10_revision?.pypi_version;
  function r10RevisionHref(revision) {
    const params=new URLSearchParams({release:'r10'});
    if(revision)params.set('revision',revision);
    if(!originalBaselineSelected())params.set('b0',selectedBaseline);
    if(selectedController)params.set('controlplane',selectedController);
    return './b0-b1.html?'+params;
  }
  const stableAssessment=entry=>stableAssessments.get(entry);
  let baselineFallback = false, releaseFallback = false, controllerFallback = false;
  function readComparisonLocation() {
    const url=new URL(location.href), params=url.searchParams;
    if(params.get('release')==='sr5'){
      params.set('release','r8');
      params.set('controlplane',controllerOption);
      params.delete('comparison');
      history.replaceState(null,'',url);
    }
    const requested=params.get('release')||(url.hash==='#r8-current-continuous'?'r8':null);
    const controller=params.get('controlplane');
    selectedRelease=validRelease(requested)?requested:null;
    selectedRevision=params.get('revision');
    automaticRelease=!selectedRevision&&!params.has('comparison')&&
      (!requested||requested==='latest'||(validRelease(requested)&&url.hash==='#submission-v2'));
    releaseFallback=!!requested&&requested!=='latest'&&!validRelease(requested);
    controllerFallback=!!controller&&controller!==controllerOption;
    baselineFallback=false;
    selectedBaseline=params.get('b0')||'original018-cann8.5.1';
    selectedController=controller===controllerOption?controllerOption:'';
  }
  readComparisonLocation();
  let comparisonBaselines = [];
  const baselineObservations = new Map();
  const independentRentalPath='data/b0-independent-rental-observations-v1.json';
  let independentRental=null;
  const b0RepairReportPath='data/b0-mtp-kv-prefix-repair-v1/report.json';
  const r10PatchedFtPath='data/r10-stable-patched-b0-ft-20261123-v1/report.json';
  let b0RepairReport;
  let r10PatchedFt;
  async function loadPatchedEvidence(publication,path) {
    const matches=publication.files.filter(row=>row.website_path===path);
    if(!matches.length)return;
    if(matches.length!==1)throw Error('Ambiguous patched B0 evidence');
    const response=await fetch('./'+path,{cache:'no-cache'});
    if(!response.ok)throw Error('Patched B0 evidence unavailable');
    const raw=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(digest!==matches[0].sha256||raw.byteLength!==matches[0].bytes)throw Error('Patched B0 evidence checksum mismatch');
    return JSON.parse(new TextDecoder().decode(raw));
  }
  async function loadB0RepairReport(publication) {
    const report=await loadPatchedEvidence(publication,b0RepairReportPath);
    if(!report)return;
    if(report.schema!=='deeplinkengine-mtp-selected-kv-prefix-repair/v1'||report.scope!=='patched-variants-only'||
       report.model!=='Qwen3.5-35B-A3B'||report.tensor_parallel_size!==2||report.accelerator!=='Ascend 910B2'||
       !report.versions||!report.workload)throw Error('B0 patch retest identity mismatch');
    return report;
  }
  async function loadR10PatchedFt(publication) {
    const report=await loadPatchedEvidence(publication,r10PatchedFtPath);
    if(!report)return;
    const protocol=report.protocol, current=report.B1;
    const previous=publication.files.find(row=>row.website_path===b0RepairReportPath);
    const positive=value=>typeof value==='string'&&Number.isFinite(Number(value))&&Number(value)>0;
    const validInterval=values=>Array.isArray(values)&&values.length===2&&
      values.every(positive)&&Number(values[0])<=Number(values[1]);
    if(!b0RepairReport||report.schema!=='vllm-hust-r10-stable-patched-b0-ft/v1'||
       report.previous_b0_public_report_sha256!==previous?.sha256||protocol?.model!=='Qwen3.5-35B-A3B'||
       protocol?.tensor_parallel_size!==2||protocol?.native_formal_repetitions!==3||
       protocol?.native_formal_requests_per_repetition!==200||current?.release!=='full-answer-b1-20261121-r10'||
       current?.package_version!=='2026.11.21.10'||!/^[a-f0-9]{64}$/.test(current?.native_seal_sha256||'')||
       !validInterval(current.tflops_per_card_interval)||!positive(current.T_seconds)||
       !report.pairs||Object.keys(report.pairs).length!==2)throw Error('R10 patched B0 comparison identity mismatch');
    for(const version of ['0.23.0','0.30.0']){
      const pair=report.pairs[version], previousB0=b0RepairReport.versions[version];
      if(!previousB0||pair?.B1_native_seal_sha256!==current.native_seal_sha256||
         pair?.B0?.source_variant!=='selected-kv-prefix-repair'||pair.B0.version!==version||
         pair.B0.upstream_image_manifest!==previousB0.upstream_image_manifest||
         pair.B0.native_seal_sha256!==previousB0.repaired_native_seal_sha256||
         pair.B0.T_seconds!==previousB0.T_seconds||
         !validInterval(pair.B0.tflops_per_card_interval)||
         !pair.B0.tflops_per_card_interval.every((rate,index)=>rate===previousB0.tflops_per_card_interval[index])||
         !validInterval(pair.B1_over_B0_effective_compute_interval))throw Error('Patched B0 pair identity mismatch');
    }
    return report;
  }
  function b0RepairResult(baseline) {
    const version=baseline.id.match(/^official-(0\.23\.0|0\.30\.0)$/)?.[1];
    const result=b0RepairReport?.versions[version];
    if(result?.upstream_image_manifest!==baseline.image_digest||
       result?.original_release_ft_eligible!==false)return;
    return result;
  }
  let baselineCardMappings = new Map();
  const baselineCardPath = 'data/b0-archived-card-provenance-v1.json';
  let contextWorkloads = new Map();
  const originalBaselineSelected = () => selectedBaseline === 'original018-cann8.5.1';
  const developmentRelease = () => srIds.includes(selectedRelease);
  const developmentComparison = () => {
    const params=new URL(location.href).searchParams;
    return originalBaselineSelected()&&!params.has('b0')&&params.get('comparison')==='development'&&developmentRelease();
  };
  let releaseCatalog = null;
  let releasePublication = null;
  let fixedBaseline = null;
  let catalogRequest = null;
  let releaseRequest = 0;
  const historyPath = 'data/engine-release-history-v1.json';
  async function loadFixedBaseline(baseline, publication) {
    const descriptor=baseline.observations;
    const fail=()=>{throw Error('Invalid fixed B0 observations');};
    if(descriptor?.schema!=='vllm-hust-fixed-baseline-descriptor/v1' || descriptor.path!=='data/fixed-b0-original018-v1.json')fail();
    const source=publication.files.filter(row=>row.website_path===descriptor.path);
    if(source.length!==1||source[0].sha256!==descriptor.sha256||source[0].bytes!==descriptor.bytes)fail();
    const response=await fetch('./'+descriptor.path,{cache:'no-cache'});
    if(!response.ok)fail();
    const raw=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==descriptor.sha256||raw.byteLength!==descriptor.bytes)fail();
    const value=JSON.parse(new TextDecoder().decode(raw));
    if(value.schema!=='vllm-hust-fixed-baseline-observations/v1'||value.model!=='Qwen3.5-35B-A3B'||value.precision!=='BF16'||value.tensor_parallel_size!==2||value.chip_model!=='Ascend 910B2')fail();
    for(const field of ['id','vllm','vllm_ascend','cann','image_digest','sdk_source_map_sha256'])if(value.baseline?.[field]!==baseline[field])fail();
    const ids=['mmlu','hle','frontier','swe','terminal'],counts=[200,200,160,64,48];
    if(value.profiles?.length!==ids.length)fail();
    value.profiles.forEach((row,i)=>{
      const arm=row.arm;
      if(row.id!==ids[i]||arm?.role!=='B0'||arm.requests!==counts[i]||arm.failed!==0||!/^[a-f0-9]{64}$/.test(arm.source_seal_sha256||''))fail();
      if(![arm.output_tokens_per_second,arm.mean_ttft_ms,arm.mean_tpot_ms,arm.output_tokens,arm.duration_seconds].every(x=>Number.isFinite(x)&&x>0)||!close(arm.output_tokens/arm.duration_seconds,arm.output_tokens_per_second))fail();
    });
    if(value.context?.observations?.length!==4||!value.compute?.arm?.source_and_timing_qualified)fail();
    for(const row of value.context.observations)if(row.B1||row.B0?.status!=='completed'||row.B0.metrics?.failed!==0||row.B0.windows?.length!==5)fail();
    return value;
  }
  async function loadComparisonBaseline(baseline,publication) {
    const descriptor=baseline.observations;
    if(!/^data\/[a-z0-9/_-]+\.json$/.test(descriptor.path||''))throw Error('Invalid B0 observations path');
    const matches=publication.files.filter(row=>row.website_path===descriptor.path);
    if(matches.length!==1||matches[0].sha256!==descriptor.sha256||matches[0].bytes!==descriptor.bytes)throw Error('Unpublished B0 observations');
    const response=await fetch('./'+descriptor.path,{cache:'no-cache'});
    if(!response.ok)throw Error('B0 observations unavailable');
    const raw=await response.arrayBuffer();
    const pin=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(pin!==descriptor.sha256||raw.byteLength!==descriptor.bytes)throw Error('B0 observations checksum mismatch');
    const value=JSON.parse(new TextDecoder().decode(raw));
    if(value.schema!=='vllm-hust-official-baseline-observations/v1'||value.baseline_id!==baseline.id||value.model!==baseline.model||value.precision!==baseline.precision||value.tensor_parallel_size!==baseline.tensor_parallel_size||!value.hardware?.chip_model||!Array.isArray(value.profiles))throw Error('B0 observation identity mismatch');
    const hardware=value.hardware;
    if(hardware.driver_version===null ? hardware.driver_version_status!=='not-recorded'||typeof hardware.npu_smi_version!=='string'||!hardware.npu_smi_version.trim() : typeof hardware.driver_version!=='string'||!hardware.driver_version.trim())throw Error('B0 hardware provenance incomplete');
    if(baseline.source_identity){
      if(value.runtime?.kind!=='source-build-candidate'||!/^[a-f0-9]{64}$/.test(value.runtime.build_receipt_sha256||'')||Object.entries(baseline.source_identity).some(([key,expected])=>value.runtime[key]!==expected)||value.runtime.image_digest)throw Error('B0 source candidate identity mismatch');
    }else if(value.runtime?.kind!=='official-image'||value.runtime.image_digest!==baseline.image_digest)throw Error('B0 official image identity mismatch');
    const ids=new Set();
    for(const row of value.profiles){
      const arm=row.arm;
      if(!row.id||ids.has(row.id)||arm?.role!=='B0'||!Number.isInteger(arm.requests)||arm.requests<0||!Number.isInteger(arm.failed)||arm.failed<0||arm.failed>arm.requests||!/^[a-f0-9]{64}$/.test(arm.source_seal_sha256||''))throw Error('Invalid B0 profile');
      ids.add(row.id);
      for(const key of ['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms'])if(arm[key]!==null&&(!Number.isFinite(arm[key])||arm[key]<0))throw Error('Invalid B0 metric');
      if(Number.isFinite(arm.output_tokens_per_second)&&(!Number.isFinite(arm.output_tokens)||!Number.isFinite(arm.duration_seconds)||arm.duration_seconds<=0||!close(arm.output_tokens/arm.duration_seconds,arm.output_tokens_per_second)))throw Error('Inconsistent B0 throughput');
    }
    return value;
  }
  async function loadArchivedBaselineCards(publication) {
    const mappings=new Map();
    if(!publication.files.some(file=>file.website_path===baselineCardPath))return mappings;
    const response=await fetch('./'+baselineCardPath,{cache:'no-cache',signal:AbortSignal.timeout(10000)});
    const value=await readPublishedJson(publication,baselineCardPath,response);
    if(value.schema!=='vllm-hust-b0-archived-card-provenance/v1'||!Array.isArray(value.records)){
      throw Error('Invalid archived B0 card provenance');
    }
    for(const record of value.records){
      const baseline=comparisonBaselines.find(item=>item.id===record.baseline_id);
      const profile=baselineObservations.get(record.baseline_id)?.profiles.find(row=>row.id===record.profile_id);
      const source=record.source;
      const key=record.baseline_id+'/'+record.profile_id;
      if(!profile||record.source_seal_sha256!==profile.arm.source_seal_sha256||
         !validPhysicalCards(record.physical_cards)||mappings.has(key)||
         !/^evidence\/[a-z0-9_/-]+\.json$/.test(source?.artifact_path||'')||
         !/^[a-f0-9]{64}$/.test(source?.artifact_sha256||'')||
         !baseline?.previous_evidence?.some(archive=>archive.url===source.archive_url&&archive.sha256===source.archive_sha256)){
        throw Error('Unbound archived B0 card mapping');
      }
      mappings.set(key,record);
    }
    return mappings;
  }
  function withFixedBaseline(rows) {
    return rows.map(row=>{
      if(row.arms)return row;
      const original=fixedBaseline?.profiles.find(record=>record.id===row.id);
      return original?{...row,baselineObservation:{...original.arm,relative_cost_per_token:1},baselineModel:fixedBaseline.model}:row;
    });
  }
  function fixedBaselineContext() {
    const a=fixedBaseline?.context;
    if(!a)return '';
    return `<div data-fixed-b0-context><h3>${t('固定 B0 · 上下文与四租户','Fixed B0 · context and four tenants')}</h3><p>${esc(fixedBaseline.model)} · ${esc(a.report_date)} · ${esc(contextWorkloadLabel(a))}</p>${table(t(['工况','请求','B0 token/s','TTFT P99 / ms','TPOT P99 / ms'],['Scenario','Requests','B0 token/s','TTFT P99 / ms','TPOT P99 / ms']),a.observations.map(row=>[row.phase,row.B0.metrics.requests,n(row.B0.metrics.output_tokens_per_second),n(row.B0.metrics.ttft_ms.p99),n(row.B0.metrics.tpot_ms.p99)]))}</div>`;
  }
  function fixedBaselineCompute() {
    const a=fixedBaseline?.compute,arm=a?.arm;
    if(!arm)return '';
    return `<div data-fixed-b0-compute><h3>${t('固定 B0 · 有效算力原始核算','Fixed B0 · original compute accounting')}</h3><p>${esc(a.model)} · MMLU200/out256 · ${t('三轮原生计时','Three native timing runs')}</p>${table(t(['运行臂','ΣF / FLOPs','ΣT / s','参考算力上界 / TFLOP/s/卡','效率下界'],['Arm','ΣF / FLOPs','ΣT / s','Reference upper / TFLOP/s/card','Efficiency lower bound']),[['B0','['+arm.F_interval.join(', ')+']',arm.T_seconds,arm.reference_tflops_per_card_upper,computeBound(arm.efficiency_lower_percent)+'%']])}<p>${t('参考分母','Reference denominator')}: ΣFref = [${esc(arm.reference_F_interval.join(', '))}], ΣTref,lower = ${esc(arm.reference_seconds_lower)} s</p><p>Ccurrent,lower = ΣFcurrent,lower / (2 × ΣTcurrent × 10¹²)<br>Cref,upper = ΣFref,upper / (2 × ΣTref,lower × 10¹²)<br>ηlower = 100 × Ccurrent,lower / Cref,upper</p><p><a href="./${esc(a.certificate.path)}">${t('原始证书','Original certificate')}</a> · <a href="./${esc(a.reference_statistics.path)}">${t('参考分母统计','Reference denominator statistics')}</a></p></div>`;
  }
  const isFrozenCandidate = entry => entry.publication_status==='frozen-candidate';
  function latestFrozenRelease(catalog) {
    if(!Array.isArray(catalog.order)||!catalog.order.length||catalog.order.some(id=>!/^r[1-9][0-9]*$/.test(id)))throw Error('Invalid frozen release order');
    const official=catalog.order.filter(id=>!isFrozenCandidate(catalog.entries.find(entry=>entry.id===id)));
    if(!official.length)throw Error('No official frozen release');
    return official.reduce((latest,id)=>BigInt(id.slice(1))>BigInt(latest.slice(1))?id:latest);
  }
  function latestCompleteRelease(catalog, family) {
    const archived=catalog.archived_r10;
    return [...catalog.entries,...(archived?[archived]:[])]
      .filter(entry=>{
        const targets=(stableAssessment(entry)||submissionAssessments.get(entry))?.targets;
        return (!family||entry.id===family)&&!isFrozenCandidate(entry)&&
          ['4.1','4.2','4.3','4.4'].every(id=>
            targets?.[id]?.milestone?.met===true&&targets[id].final?.met===true);
      })
      .sort((a,b)=>{
        if(a.id!==b.id)return BigInt(a.id.slice(1))>BigInt(b.id.slice(1))?-1:1;
        return b.frozen_date.localeCompare(a.frozen_date);
      })[0];
  }
  async function readReleasePublication(signal) {
    const response = await fetch('./data/benchmark-source-manifest.json',{cache:'no-cache',signal});
    if (!response.ok) throw Error('Release manifest unavailable');
    const publication = await response.json();
    if (publication.repository !== 'vLLM-HUST/vllm-hust-benchmark' ||
        publication.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(publication.commit) ||
        !Array.isArray(publication.files)) throw Error('Invalid release catalog publisher');
    return publication;
  }
  let publicationCheck;
  function openPublicationIsCurrent() {
    if (!releaseCatalog || document.visibilityState !== 'visible') return Promise.resolve(true);
    if (!publicationCheck) {
      const loaded = releasePublication;
      publicationCheck = (async () => {
        try {
          const current = await readReleasePublication(AbortSignal.timeout(5000));
          if (releaseCatalog && releasePublication === loaded && current.commit !== loaded.commit) {
            // Load the matching presentation and verified evidence together.
            location.reload();
            return false;
          }
        } catch (error) {
          console.warn('Release publication recheck unavailable',error);
        }
        return true;
      })().finally(()=>{publicationCheck=undefined;});
    }
    return publicationCheck;
  }
  async function loadIndependentRental(publication, catalog) {
    if(!publication.files.some(file=>file.website_path===independentRentalPath))return null;
    const response=await fetch('./'+independentRentalPath,{cache:'no-cache'});
    const data=await readPublishedJson(publication,independentRentalPath,response);
    const official=catalog.entries.find(entry=>entry.submission_assessment?.path===data.rental_quote_source?.path);
    const approved=official&&submissionAssessments.get(official)?.quote;
    const same=(left,right)=>left?.path===right?.path&&left?.sha256===right?.sha256&&left?.bytes===right?.bytes;
    const ids=['mmlu','real-context-multi-tenant-formal'];
    if(data.schema!=='vllm-hust-independent-b0-rental-observations/v1'||data.inference_reruns!==0||
       !approved||!same(data.rental_quote_source,official.submission_assessment)||
       Object.keys(approved).some(key=>data.rental_quote?.[key]!==approved[key]))throw Error('Invalid B0 rental source');
    const rate=Number(approved.cny_per_card_month);
    for(const [id,record] of Object.entries(data.baselines||{})){
      const item=catalog.comparison_baselines.find(baseline=>baseline.id===id);
      const observed=baselineObservations.get(id);
      if(!item||!observed||!same(record.observations,item.observations)||!same(data.sse_replay,observed.original_sse_replay)||
         Object.keys(record.workloads||{}).length!==ids.length)throw Error('Invalid B0 rental run identity');
      for(const key of ids){
        const profile=observed.profiles.find(row=>row.id===key);
        const row=record.workloads[key], arm=profile?.arm, utilization=row?.utilization;
        if(!arm||!row||row.measurement_seal_sha256!==arm.source_seal_sha256||
           row.source_metric?.path!==profile.source_metric?.path||row.source_metric?.sha256!==profile.source_metric?.sha256||
           row.successful_output_tokens!==arm.output_tokens||row.duration_seconds!==arm.duration_seconds||
           !validPhysicalCards(row.physical_cards)||!utilization||utilization.missing_seconds!==0||
           !close(utilization.covered_seconds,row.duration_seconds))throw Error('Invalid B0 rental window');
        const cardValues=row.physical_cards.map(card=>utilization.per_card_percent?.[card]);
        if(Object.keys(utilization.per_card_percent||{}).length!==row.physical_cards.length||
           !cardValues.every(value=>Number.isFinite(value)&&value>=0&&value<=100)||
           !close(utilization.mean_percent,cardValues.reduce((total,value)=>total+value,0)/cardValues.length)||
           !close(row.estimated_cny_per_million_successful_output_tokens,
                  1e6*rate*row.physical_cards.length*row.duration_seconds/(30*86400*row.successful_output_tokens))){
          throw Error('Inconsistent B0 rental observations');
        }
      }
    }
    return data;
  }
  async function loadReleaseCatalog() {
    if (releaseCatalog) return;
    if (catalogRequest) return catalogRequest;
    catalogRequest = (async () => {
      const publication = await readReleasePublication();
      const entries = publication.files.filter(row=>row.website_path===historyPath);
      if (entries.length!==1) throw Error('Ambiguous release catalog source');
      const result = await fetch('./'+historyPath,{cache:'no-cache'});
      if (!result.ok) throw Error('Release catalog unavailable');
      const raw = await result.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
      if (digest!==entries[0].sha256 || raw.byteLength!==entries[0].bytes) throw Error('Release catalog checksum mismatch');
      const value = JSON.parse(new TextDecoder().decode(raw));
      if (value.schema!=='vllm-hust-engine-release-history/v1' || !Array.isArray(value.order) || !value.order.length || value.order.some(id=>!/^r[1-9][0-9]*$/.test(id)) || new Set(value.order).size!==value.order.length || !value.order.includes(value.default_release) || value.entries?.length!==value.order.length) throw Error('Invalid release catalog scope');
      contextWorkloads=new Map(Object.entries(value.context_workloads||{}));
      for(const [digest,source] of contextWorkloads){
        const valid=values=>Array.isArray(values)&&values.length>0&&
          values.every(value=>typeof value==='string'&&value.trim())&&new Set(values).size===values.length;
        if(!/^[a-f0-9]{64}$/.test(digest)||!valid(source?.datasets)||!valid(source?.task_ids)){
          throw Error('Invalid context workload provenance');
        }
      }
      const baseline=value.baseline;
      if (baseline?.id!=='original018-cann8.5.1' || baseline.vllm!=='0.18.0' || baseline.vllm_ascend!=='0.18.0' || baseline.cann!=='8.5.1' || baseline.sdk_source_map_sha256!=='a357ad8cf1ff6f8797fb2d6476e71a0deef5ee0899a55ea32ed65f07fe7773bc' || baseline.image_digest!=='sha256:2467d259ff068ca4edd7b50b849152910f3c05e435f314639fc06bcc7a00f9fa') throw Error('Unexpected fixed B0 identity'); // pragma: allowlist secret -- fixed public B0 image and SDK digests
      fixedBaseline=await loadFixedBaseline(baseline,publication);
      comparisonBaselines=[{...baseline,label:'vLLM 0.18 / Ascend 0.18',status:'published'},...(value.comparison_baselines||[])];
      const baselineIds=new Set();
      for(const item of comparisonBaselines){
        if(!item.id || baselineIds.has(item.id) || !item.label || !item.profile?.url?.startsWith('https://'))throw Error('Invalid B0 selection catalog');
        baselineIds.add(item.id);
        if(item.id!==baseline.id){
          if(!['pending','candidate-pending','partial','published'].includes(item.status) || !item.model || item.precision!=='BF16' || item.tensor_parallel_size!==2 || item.pairs!==null)throw Error('Unreviewed B0 observations');
          if(item.source_identity){
            const identity=item.source_identity;
            if(identity.kind!=='source-build-candidate'||!/^candidate-/.test(item.id)||!/source candidate|源码候选/.test(item.label)||(item.label_en&&!/source candidate/i.test(item.label_en))||!/^sha256:[a-f0-9]{64}$/.test(identity.base_image_digest||'')||!['vllm_source_commit','ascend_source_commit'].every(key=>/^[a-f0-9]{40}$/.test(identity[key]||''))||item.image_digest)throw Error('Unreviewed B0 source candidate');
          }else if(!/^sha256:[a-f0-9]{64}$/.test(item.image_digest||''))throw Error('Missing B0 image identity');
          if(item.context_input_sha256&&(!item.observations||!contextWorkloads.has(item.context_input_sha256))){
            throw Error('Missing B0 context workload provenance');
          }
          if(item.observations)baselineObservations.set(item.id,await loadComparisonBaseline(item,publication));
          else if(['partial','published'].includes(item.status))throw Error('Missing B0 observations');
        }
      }
      b0RepairReport=await loadB0RepairReport(publication).catch(error=>{
        console.warn('B0 patch retest rejected',error);
      });
      r10PatchedFt=await loadR10PatchedFt(publication).catch(error=>{
        console.warn('R10 patched B0 comparison rejected',error);
      });
      baselineCardMappings=await loadArchivedBaselineCards(publication).catch(error=>{
        console.warn('Archived B0 card provenance rejected',error);
        return new Map();
      });
      for (const id of value.order) {
        const matches = value.entries.filter(row=>row.id===id);
        if(matches.length!==1) throw Error('Ambiguous release identity');
        const entry=matches[0];
        if (entry.baseline_id!==baseline.id || !entry.release.endsWith('-'+id) || !entry.mods?.length || !entry.profile?.url || !Array.isArray(entry.measurements)) throw Error('Incomplete release identity');
        for (const measurement of entry.measurements) {
          if (measurement.control!=='B0' || measurement.baseline_id!==baseline.id || measurement.candidate!==id || measurement.arms?.length!==2 || measurement.arms[0].role!==measurement.control || measurement.arms[1].role!==id) throw Error('Release measurement identity mismatch');
          if(measurement.arms.some(arm=>arm.physical_cards!==undefined)&&
             !measurement.arms.every(arm=>validPhysicalCards(arm.physical_cards)))throw Error('Invalid per-arm measurement cards');
          for (const arm of measurement.arms) {
            if (![arm.output_tokens_per_second,arm.mean_ttft_ms,arm.mean_tpot_ms,arm.output_tokens,arm.duration_seconds,arm.requests].every(v=>Number.isFinite(v)&&v>0) || !Number.isInteger(arm.failed) || arm.failed<0 || !close(arm.output_tokens/arm.duration_seconds,arm.output_tokens_per_second)) throw Error('Inconsistent release measurement');
          }
        }
        await validateVersionSupplement(entry, publication);
        if(entry.r10_revision)validateR10Revision(entry);
        await validateVersionComputeReference(entry, publication);
        await validateModelIntegration(entry, publication);
        await loadSubmissionAssessment(entry, publication);
        if(entry.stable_evidence)await loadStableAssessment(entry, publication, baseline.id).catch(error=>{
          console.warn('Stable release V2 evidence rejected',error);
        });
      }
      independentRental=await loadIndependentRental(publication,value).catch(error=>{
        console.warn('Independent B0 rental observations rejected',error);
        return null;
      });
      if(value.archived_r10){
        const archive=value.archived_r10;
        if(archive.id!=='r10'||archive.release!=='full-answer-b1-20261121-r10'||
           archive.baseline_id!==baseline.id||archive.stable_evidence?.pypi_version!==r10ArchivedVersion){
          throw Error('Invalid archived R10 release');
        }
        await loadStableAssessment(archive,publication,baseline.id).catch(error=>{
          console.warn('Archived R10 V2 evidence rejected',error);
        });
      }
      if(value.entries.find(row=>row.id==='r5').measurements.length) throw Error('r5 has no formal inference');
      if (!Array.isArray(value.attempt_order) || new Set(value.attempt_order).size!==value.attempt_order.length || value.attempt_order.some(id=>!/^r[1-9][0-9]*$/.test(id)||value.order.includes(id)) || value.attempts?.length!==value.attempt_order.length) throw Error('Invalid early-attempt catalog');
      for (const id of value.attempt_order) {
        const matches=value.attempts.filter(row=>row.id===id);
        if (matches.length!==1 || matches[0].kind!=='pre-freeze-attempt' || matches[0].status!=='failed' || matches[0].measurements?.length!==0 || !matches[0].source?.url) throw Error('Invalid early-attempt identity');
      }
      releaseIds=[...value.order];attemptIds=[...value.attempt_order];selectableIds=[...releaseIds,...attemptIds,...srIds];
      releaseCatalog=value;
      releasePublication=publication;
    })();
    try { await catalogRequest; } finally { catalogRequest=null; }
  }
  function releaseEntry() {
    if(archivedR10Selected()&&releaseCatalog?.archived_r10)return releaseCatalog.archived_r10;
    return releaseCatalog?.entries.find(entry=>entry.id===selectedRelease);
  }

  async function validateModelIntegration(entry, publication) {
    const descriptor=entry.model_integration;
    if(!descriptor)return;
    const fail=()=>{throw Error('Invalid model integration publication');};
    if(descriptor.schema!=='vllm-hust-model-integration-descriptor/v1')fail();
    async function asset(value, extension) {
      if(!value||!/^data\/[a-z0-9/-]+\.(?:json|svg)$/.test(value.path||'')||!value.path.endsWith('.'+extension)||
         !/^[a-f0-9]{64}$/.test(value.sha256||'')||!Number.isInteger(value.bytes)||value.bytes<=0)fail();
      const bindings=publication.files.filter(file=>file.website_path===value.path);
      if(bindings.length!==1||bindings[0].sha256!==value.sha256||bindings[0].bytes!==value.bytes)fail();
      const response=await fetch('./'+value.path,{cache:'no-cache'});
      if(!response.ok)fail();
      const raw=await response.arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
      if(raw.byteLength!==value.bytes||hash!==value.sha256)fail();
      return raw;
    }
    const data=JSON.parse(new TextDecoder().decode(await asset(descriptor.summary,'json')));
    await asset(descriptor.chart,'svg');
    if(data.schema!=='vllm-hust-model-integration/v1'||data.candidate?.release!==entry.release||
       typeof data.candidate.model!=='string'||typeof data.reference?.model!=='string'||
       data.candidate.dtype!=='BF16'||data.candidate.hardware!=='Ascend910B2'||data.candidate.devices!==2||
       data.reference.kind!=='previously-published-website-reference'||
       !/^full-answer-b1-\d{8}-r[1-9][0-9]*$/.test(data.reference.release||'')||
       data.reference.release===data.candidate.release||
       data.scope?.original018_pair!==false||data.scope.project_full_five!==false||
       data.scope.qwen_performance_repeated!==false||data.scope.native_intern_run_complete!==true||
       !Array.isArray(data.workloads)||!data.workloads.length||data.workloads.length>10)fail();
    const positive=x=>Number.isFinite(x)&&x>0;
    const ids=new Set();
    for(const row of data.workloads) {
      if(typeof row.id!=='string'||ids.has(row.id)||typeof row.label_zh!=='string'||typeof row.label_en!=='string')fail();
      ids.add(row.id);
      for(const arm of [row.reference,row.candidate]) {
        if(!arm||![arm.output_tokens_per_second,arm.mean_ttft_ms,arm.mean_tpot_ms,arm.output_tokens,arm.requests].every(positive)||
           !Number.isInteger(arm.requests)||arm.failed!==0||
           !positive(arm.duration_seconds??arm.cohort_wall_seconds)||
           !close(arm.output_tokens/(arm.duration_seconds??arm.cohort_wall_seconds),arm.output_tokens_per_second))fail();
      }
      for(const metric of ['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','ttft_p95_ms','ttft_p99_ms','tpot_p95_ms','tpot_p99_ms']) {
        if(positive(row.reference[metric])&&positive(row.candidate[metric])&&
           !close(100*(row.candidate[metric]/row.reference[metric]-1),row.change_percent?.[metric]))fail();
      }
    }
    const quality=data.quality;
    if(!quality||![quality.requests,quality.correct,quality.truncated,quality.failed,quality.unparsed].every(Number.isInteger)||
       quality.requests!==200||quality.correct<0||quality.correct>quality.requests||
       quality.truncated<0||quality.truncated>quality.requests||quality.failed!==0||quality.unparsed!==0)fail();
    const mmlu=data.workloads.find(row=>row.id==='mmlu200');
    if(!mmlu||mmlu.candidate.correct!==quality.correct||mmlu.candidate.requests!==quality.requests||
       mmlu.candidate.truncated!==quality.truncated)fail();
    modelIntegrationResults.set(entry.id,data);
  }

  function comparisonRoles() { return {B0:'B0',B1:'B1'}; }
  function singleArmObservation(entry) {
    const value=modelIntegrationResults.get(entry.id);
    return value&&!entry.measurements.length&&!entry.context_tenant_supplement?value:null;
  }
  function observationRows(entry) {
    const value=singleArmObservation(entry);
    return value?value.workloads.map(row=>({id:row.id,label:t(row.label_zh,row.label_en),
      observation:row.candidate,model:value.candidate.model,
      workloadLabel:t('B1单臂实测','B1 single-arm measurement')})):[];
  }

  function modelIntegrationDetails(entry) {
    const result=modelIntegrationResults.get(entry.id);
    if(!result)return {title:t('开发对照','Development comparison'),body:''};
    const reference=result.reference.release.split('-').at(-1),candidate=entry.id;
    const percent=value=>(value>=0?'+':'')+n(value)+'%';
    const metrics=result.workloads.flatMap(row=>['reference','candidate'].map(arm=>{
      const a=row[arm];
      return [t(row.label_zh,row.label_en),arm==='reference'?reference:candidate,n(a.output_tokens_per_second),n(a.mean_ttft_ms/1000),n(a.mean_tpot_ms),n(a.ttft_p95_ms),n(a.ttft_p99_ms),n(a.tpot_p95_ms),n(a.tpot_p99_ms)];
    }));
    const changes=result.workloads.map(row=>[t(row.label_zh,row.label_en),...['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms'].map(key=>percent(row.change_percent[key]))]);
    return {title:t('书生适配开发对照（非正式基线）','Intern adaptation development comparison (not the formal baseline)'),body:`<div data-development-comparison="${esc(entry.id)}">
      <p>${esc(result.candidate.model)} · ${esc(candidate)} / ${esc(result.reference.model)} · ${esc(reference)}</p>
      <p>${t('此处使用已发布R8的Qwen实测，检查书生适配的性能水平。两边模型不同；该开发对照不替代固定的vLLM/Ascend 0.18基线，不用于认定引擎优化收益或正式验收。','This development comparison uses published Qwen R8 measurements to check Intern adaptation performance. The models differ; it does not replace the fixed vLLM/Ascend 0.18 baseline or establish engine optimization gains or formal acceptance.')}</p>
      ${table(t(['工况','版本','token/s','TTFT / s','TPOT / ms','TTFT P95 / ms','TTFT P99 / ms','TPOT P95 / ms','TPOT P99 / ms'],['Workload','Version','token/s','TTFT / s','TPOT / ms','TTFT P95 / ms','TTFT P99 / ms','TPOT P95 / ms','TPOT P99 / ms']),metrics)}
      ${table(t(['工况','吞吐变化','平均TTFT变化','平均TPOT变化'],['Workload','Throughput change','Mean TTFT change','Mean TPOT change']),changes)}
      <p>MMLU200 · ${result.quality.correct}/${result.quality.requests} ${t('正确','correct')} · ${t('长度终止','Length stops')} ${result.quality.truncated} · ${t('失败 / 未解析','Failed / unparsed')} ${result.quality.failed} / ${result.quality.unparsed}</p>
      <p>${esc(t(result.tradeoffs_zh,result.tradeoffs_en))}</p>
      <figure class="comparison-source-plot"><div class="supplement-plot" tabindex="0" role="region" aria-label="${t('开发对照实测图，可横向滚动','Development comparison measurements; scroll horizontally')}"><img src="./${esc(entry.model_integration.chart.path)}" alt="${t('书生与已发布Qwen R8的开发性能对照，不属于正式B0/B1结果','Intern versus published Qwen R8 development comparison, not formal B0/B1 results')}"></div></figure>
      <p><a href="./${esc(entry.model_integration.summary.path)}">${t('已上传实测汇总','Uploaded measurement summary')} ↗</a> · <a href="${esc(entry.release_url)}">${t('发行包、原始记录与复算脚本','Release, original records and recomputation scripts')} ↗</a></p></div>`};
  }

  function computeBound(value, upper=false) {
    const match=String(value).match(/^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if(!match||String(value).length>150)throw Error('Invalid compute decimal');
    const exponent=Number(match[3]||0),fraction=match[2]||'';
    if(!Number.isInteger(exponent)||Math.abs(exponent)>100)throw Error('Invalid compute exponent');
    const shift=exponent+4-fraction.length,digits=BigInt(match[1]+fraction);
    let scaled;
    if(shift>=0)scaled=digits*10n**BigInt(shift);
    else {const divisor=10n**BigInt(-shift);scaled=digits/divisor;if(upper&&digits%divisor)scaled++;}
    const whole=scaled/10000n,tail=String(scaled%10000n).padStart(4,'0').replace(/0+$/,'');
    return String(whole)+(tail?'.'+tail:'');
  }
  function transportAssetBytes(raw, asset) {
    if(!asset.path.endsWith('.html')||raw.byteLength<=asset.bytes)return raw;
    const suffix=new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(raw,asset.bytes)).trim();
    // Cloudflare may append one external analytics tag. The original prefix still
    // has to match every declared byte and its SHA256; other modifications fail.
    const beacon=/^<script(?:\s+(?:type="module"|defer(?:="")?|src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\/v[a-fA-F0-9]+)?"|integrity="sha(?:256|384|512)-[A-Za-z0-9+/=]+"|data-cf-beacon=(?:'[^'<>\r\n]*'|"[^"<>\r\n]*")|crossorigin="anonymous"))+\s*><\/script>$/;
    if(suffix.length>2048||!beacon.test(suffix)||!suffix.includes('data-cf-beacon=')||(suffix.match(/\bsrc=/g)||[]).length!==1)return raw;
    return raw.slice(0,asset.bytes);
  }
  async function validateVersionComputeReference(entry, publication, allowSupplement=true) {
    const a=entry.compute_reference;
    if(!a)return;
    const fail=()=>{throw Error('Invalid version-specific compute reference');};
    const protocol=a.protocol;
    const submission=a.accepted_scope==='topic4_submission_v2_fixed200_max256_three_formal_runs';
    const legacy=a.accepted_scope==='full_answer_max8192_single_formal_run';
    const reuse=a.certificate_kind==='qualified_full_reference_denominator_reuse/v1';
    if(a.schema!=='engine-current-compute-reference/v1'||a.engine_release!==entry.release||
       a.baseline_id!==entry.baseline_id||a.status!=='measured'||a.full_model_certificate!==true||
       (!submission&&!legacy)||
       (!reuse&&a.certificate_kind!=='matched_complete_necessary_work_and_full_reference_lower_bound')||
       a.efficiency_exact_percent!==null||a.hardware_peak_utilization_percent!==null||
       a.model!=='Qwen3.5-35B-A3B'||a.precision!=='BF16'||a.tensor_parallel_size!==2||
       a.chip_model!=='Ascend 910B2'||protocol?.requests!==200||protocol.max_completion_tokens!==(submission?256:8192)||
       protocol.formal_repetitions!==(submission?3:1)||protocol.temperature!==0||protocol.seed!==0||protocol.eos!=='enabled'||
       protocol.quality_plan_sha256!=='f4ed4ce5956c9ed08f360400b5a996ef92a217ce295d50648d4dc06443db768e'|| // pragma: allowlist secret -- fixed public workload digest
       !/^[a-f0-9]{64}$/.test(a.source_status_sha256||'')||
       !/^[a-f0-9]{64}$/.test(a.source_pair_sha256||'')||
       !/^https:\/\/github\.com\/(?:vLLM-HUST\/vllm-hust-engine|DeepLinkNext\/DeepLinkEngine)\/releases\/download\//.test(a.raw_asset?.url||'')||
       !/^[a-f0-9]{64}$/.test(a.raw_asset?.sha256||'')||!Number.isInteger(a.raw_asset?.bytes)||a.raw_asset.bytes<=0||
       !Number.isInteger(a.raw_asset?.asset_id)||a.raw_asset.asset_id<=0||a.raw_asset.redownload_verified!==true)fail();
    if(reuse&&(!/^https:\/\/github\.com\/DeepLinkNext\/DeepLinkEngine\/blob\/[a-f0-9]{40}\//.test(a.recomputation_url||'')||a.certificate?.sha256!==a.source_pair_sha256||!submission||a.original_reference_work_and_time_retained!==true||a.original_efficiency_used!==false||a.shared_work_cancellation_used!==false||a.source_and_workload_applicability_qualified!==true||a.clean_native_clock_source_qualified!==true||a.full_reference_denominator_qualified!==true))fail();
    if(['B0','B1'].some(role=>a.arms?.[role]?.physical_cards!==undefined)&&
       !['B0','B1'].every(role=>validPhysicalCards(a.arms?.[role]?.physical_cards)))fail();
    for(const role of ['B0','B1']) {
      const arm=a.arms?.[role];
      if(!arm||arm.F_interval?.length!==2||arm.achieved_tflops_per_card_interval?.length!==2||
         arm.full_model_certificate!==true||arm.source_and_timing_qualified!==true||
         ![arm.native_checksums_sha256,arm.necessary_work_sha256,arm.reference_graph_sha256].every(v=>/^[a-f0-9]{64}$/.test(v||''))||
         arm.efficiency_exact_percent!==null||arm.reference_seconds_exact!==null||
         arm.hardware_peak_utilization_percent!==null)fail();
      const numbers=[...arm.F_interval,arm.T_seconds,arm.reference_seconds_lower,
        ...arm.achieved_tflops_per_card_interval,arm.reference_tflops_per_card_upper,arm.efficiency_lower_percent];
      if(!numbers.every(v=>typeof v==='string'&&Number.isFinite(Number(v))&&Number(v)>0))fail();
      numbers.forEach(v=>computeBound(v));
      const [low,high]=arm.F_interval.map(Number),time=Number(arm.T_seconds),ref=Number(arm.reference_seconds_lower);
      const referenceHigh=reuse?Number(arm.reference_F_interval?.[1]):high;
      if(low>high||!close(Number(arm.achieved_tflops_per_card_interval[0]),low/(2*time*1e12))||
         !close(Number(arm.achieved_tflops_per_card_interval[1]),high/(2*time*1e12))||
         !close(Number(arm.reference_tflops_per_card_upper),referenceHigh/(2*ref*1e12))||
         !close(Number(arm.efficiency_lower_percent),reuse?100*(low/(2*time*1e12))/Number(arm.reference_tflops_per_card_upper):100*ref/time))fail();
      if(reuse) {
        if(arm.reference_F_interval?.length!==2||!arm.reference_F_interval.every(v=>typeof v==='string'&&Number(v)>0)||Number(arm.reference_F_interval[0])>referenceHigh||arm.shared_work_cancellation_used!==false||arm.original_reference_repetitions?.length!==3)fail();
        const sums={F:[0,0],time:0};
        const refs=arm.original_reference_repetitions;
        if(new Set(refs.map(row=>row.source_sha256)).size!==3)fail();
        for(const row of refs) {
          if(row.F_interval?.length!==2||row.requests!==200||row.input_tokens!==282265||row.output_tokens!==51200||!/^[a-f0-9]{64}$/.test(row.source_sha256||''))fail();
          const values=[...row.F_interval,row.Tref_lower_seconds];
          if(!values.every(v=>Number.isFinite(Number(v))&&Number(v)>0)||Number(row.F_interval[0])>Number(row.F_interval[1]))fail();
          sums.F[0]+=Number(row.F_interval[0]);sums.F[1]+=Number(row.F_interval[1]);sums.time+=Number(row.Tref_lower_seconds);
        }
        if(!close(sums.F[0],Number(arm.reference_F_interval[0]))||!close(sums.F[1],referenceHigh)||!close(sums.time,ref))fail();
      }
      if(submission) {
        if(arm.repetitions?.length!==3||new Set(arm.repetitions.map(row=>row.timing_sha256)).size!==3)fail();
        const totals={F:[0,0],time:0,reference:0};
        for(const [index,row] of arm.repetitions.entries()) {
          if(row.repetition!==index+1||row.F_interval?.length!==2||
             ![row.geometry_sha256,row.timing_sha256,row.work_sha256,reuse?row.native_source_seal_sha256:row.graph_sha256].every(v=>/^[a-f0-9]{64}$/.test(v||'')))fail();
          const values=[...row.F_interval,row.T_seconds,...(reuse?[]:[row.reference_seconds_lower])];
          if(!values.every(v=>(typeof v==='string'||(reuse&&Number.isSafeInteger(v)))&&Number.isFinite(Number(v))&&Number(v)>0)||Number(row.F_interval[0])>Number(row.F_interval[1]))fail();
          values.forEach(v=>computeBound(v));
          totals.F[0]+=Number(row.F_interval[0]);totals.F[1]+=Number(row.F_interval[1]);
          totals.time+=Number(row.T_seconds);if(!reuse)totals.reference+=Number(row.reference_seconds_lower);
        }
        if(!close(low,totals.F[0])||!close(high,totals.F[1])||!close(time,totals.time)||(!reuse&&!close(ref,totals.reference)))fail();
      }
    }
    const current=Number(computeBound(a.arms.B1.efficiency_lower_percent));
    if(a.milestone_met!==(current>=50)||a.final_numeric_met!==(current>=90))fail();
    if(a.full_answer_supplement) {
      if(!allowSupplement||!submission||a.full_answer_supplement.accepted_scope!=='full_answer_max8192_single_formal_run')fail();
      await validateVersionComputeReference({...entry,compute_reference:a.full_answer_supplement},publication,false);
    }
    for(const asset of [a.chart,a.report,...(reuse?[a.certificate,a.reference_statistics]:[])]) {
      if(!asset||!/^data\/[A-Za-z0-9_/-]+\.(?:svg|html|json)$/.test(asset.path)||
         !/^[a-f0-9]{64}$/.test(asset.sha256)||!Number.isInteger(asset.bytes)||asset.bytes<=0)fail();
      const matches=publication.files.filter(row=>row.website_path===asset.path);
      if(matches.length!==1||matches[0].sha256!==asset.sha256||matches[0].bytes!==asset.bytes)fail();
      const response=await fetch('./'+asset.path,{cache:'no-cache'});
      if(!response.ok)fail();
      const raw=transportAssetBytes(await response.arrayBuffer(),asset);
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==asset.sha256||raw.byteLength!==asset.bytes)fail();
      if(reuse&&asset===a.certificate) {
        const pair=JSON.parse(new TextDecoder().decode(raw));
        if(pair.certificate_kind!==a.certificate_kind||pair.full_model_certificate!==true||pair.full_reference_denominator_qualified!==true||pair.clean_native_clock_source_qualified!==true||pair.original_efficiency_used!==false||pair.original_reference_work_and_time_retained!==true||pair.shared_work_cancellation_used!==false||pair.qualified_full_reference_statistics_sha256!==a.reference_statistics.sha256)fail();
        for(const role of ['B0','B1'])for(const key of ['F_interval','T_seconds','reference_F_interval','reference_seconds_lower','reference_tflops_per_card_upper','efficiency_lower_percent','original_reference_repetitions','repetitions']) {
          const source=pair.arms?.[role]?.[key],value=a.arms[role][key];
          if(Array.isArray(source)&&key.endsWith('_interval')){if(source.map(String).join()!==value.join())fail();}
          else if(JSON.stringify(source)!==JSON.stringify(value))fail();
        }
      }
      if(reuse&&asset===a.reference_statistics) {
        const stats=JSON.parse(new TextDecoder().decode(raw));
        if(stats.schema!=='qualified-reference-denominator/v1'||stats.original_efficiency_used!==false||stats.target_times_used!==false||stats.scope?.max_completion_tokens!==256||stats.scope.requests!==200||stats.scope.input_tokens!==282265||stats.scope.output_tokens!==51200||stats.scope.dtype!=='BF16'||stats.scope.tp!==2||stats.scope.accelerator!=='Ascend 910B2'||stats.scope.frontend!=='native_inproc'||stats.scope.timing!=='dual_rank_synchronized_after_warmup'||stats.calculation?.chips!==2)fail();
        for(const role of ['B0','B1']){const ref=stats.arms?.[role],arm=a.arms[role];if(ref?.effective_flops_interval?.map(String).join()!==arm.reference_F_interval.join()||ref.sum_reference_seconds_lower!==arm.reference_seconds_lower||ref.reference_tflops_per_card_upper!==arm.reference_tflops_per_card_upper||JSON.stringify(ref.reference_repetitions)!==JSON.stringify(arm.original_reference_repetitions))fail();}
      }
    }
  }
  function versionComputeReferenceDetails(entry, showSupplement=true) {
    const a=entry.compute_reference;
    if(!a)return fixedBaselineCompute()+`<p>${t('本版 B1 尚未发布有效算力核算。','Compute accounting for this B1 is unpublished.')}</p>`;
    const submission=a.accepted_scope==='topic4_submission_v2_fixed200_max256_three_formal_runs';
    const reuse=a.certificate_kind==='qualified_full_reference_denominator_reuse/v1';
    const rows=['B0','B1'].map(role=>{
      const arm=a.arms[role];
      return [role,arm.T_seconds,'['+arm.F_interval.join(', ')+']',
        '['+computeBound(arm.achieved_tflops_per_card_interval[0])+', '+computeBound(arm.achieved_tflops_per_card_interval[1],true)+']',
        '≤'+computeBound(arm.reference_tflops_per_card_upper,true),'≥'+computeBound(arm.efficiency_lower_percent)+'%'];
    });
    return `<p>MMLU200 · ${submission?t('输出上限256 · EOS保留 · 每臂三轮正式原生计时，先求和再计算','256 output cap · EOS enabled · three formal native runs per arm; sum before division'):t('输出上限8192 · EOS保留 · 每臂一轮正式原生计时','8192 output cap · EOS enabled · one formal native run per arm')} · BF16 · TP2</p>
      ${a.arms.B0.physical_cards?`<p>${esc(cardComparisonLabel(cardComparison(a.arms.B0.physical_cards,a.arms.B1.physical_cards)))}</p>`:''}
      <figure><img style="max-width:100%" src="./${esc(a.chart.path)}" alt="${t('B0/B1参考效率下界','B0/B1 reference efficiency lower bounds')}"></figure>
      ${table(t(['运行臂','原生时间 / s','必要算量 / FLOPs','每卡有效算力 / TFLOP/s','参考算力上界 / TFLOP/s','效率下界'],['Arm','Native time / s','Necessary work / FLOPs','Effective compute per card / TFLOP/s','Reference upper bound / TFLOP/s','Efficiency lower bound']),rows)}
      <p>${t('里程碑50%','50% milestone')}：${a.milestone_met?t('达成目标','Target met'):t('未达成目标','Target not met')} · ${t('最终90%','90% final target')}：${a.final_numeric_met?t('达成目标','Target met'):t('未达成目标','Target not met')}</p>
      ${reuse?`<h3>${t('同工况参考分母统计','Same-condition reference denominator')}</h3>${table(t(['参考域','ΣF参区间 / FLOPs','ΣT参下界 / 秒','参考上界 / TFLOP/s/卡'],['Reference domain','ΣFref interval / FLOPs','ΣTref lower / s','Reference upper / TFLOP/s/card']),['B0','B1'].map(role=>{const arm=a.arms[role];return [role,'['+arm.reference_F_interval.join(', ')+']',arm.reference_seconds_lower,arm.reference_tflops_per_card_upper];}))}<p>C<sub>current,lower</sub> = ΣF<sub>current,lower</sub> / (k × ΣT<sub>current</sub> × 10¹²)<br>C<sub>ref,upper</sub> = ΣF<sub>ref,upper</sub> / (k × ΣT<sub>ref,lower</sub> × 10¹²)<br>η<sub>lower</sub> = 100 × C<sub>current,lower</sub> / C<sub>ref,upper</sub> · k = 2</p><p>${t('参考时间下界由独立组件标定和保留依赖图最长路径计算：finish(v) = duration(v) + max(finish(parent))。参考统计保留全部三轮。本轮与参考的F不同，分别核算，不约分。','Independent component calibration and the longest retained dependency path give the reference-time lower bound: finish(v) = duration(v) + max(finish(parent)). All three reference runs are retained. Current and reference work differ and are accounted separately, without cancellation.')}</p><p><a href="./${esc(a.certificate.path)}">${t('六轮原生统计与来源哈希','Six native runs and source hashes')}</a> · <a href="./${esc(a.reference_statistics.path)}">${t('完整参考分母与构造公式','Complete reference denominator and construction formulas')}</a> · <a href="${esc(a.recomputation_url)}">${t('公开复算入口','Public recomputation entry')}</a></p>`:`<p>${submission?t('精确效率未知。三轮必要算量、实测时间及参考时间下界分别求和后复算；不将三轮当作独立任务样本或置信区间。未达成表示本次认证下界尚未证明达到目标。','Exact efficiency is unknown. Necessary work, measured time and reference time lower bounds are each summed across three runs before recomputation; the runs are not independent task samples or confidence intervals. A target not met means this certified lower bound has not proved its threshold.'):t('精确效率未知。未达成表示本次下界尚低于目标；一轮测量不表示重复性或置信区间。','Exact efficiency is unknown. A target not met means this lower bound is below its threshold; one run does not measure repeatability or confidence intervals.')}</p>
      <p>η ≥ 100 × T${t('参考下界','reference lower')} / T${t('原生','native')} · ${t('同一个实际必要F在配对比值中相消。','The same actual necessary F cancels in the matched ratio.')}</p>`}
      <p><a href="./${esc(a.report.path)}">${t('完整报告、图表与复算来源','Full report, charts and recomputation sources')} ↗</a> · <a href="${esc(a.raw_asset.url)}">${t('算量与计时原件','Work and timing originals')} ↗</a><br><code>${esc(a.raw_asset.sha256)}</code></p>
      ${showSupplement&&a.full_answer_supplement?`<details><summary>${t('8192 token 单轮补充核算','8192-token single-run supplementary accounting')}</summary><p>${t('以下补充保留原8192预算和单轮身份；送测三轮判定使用上方256预算的结果。','This supplement retains its original 8192 budget and single-run identity; the three-run submission decision uses the 256-budget result above.')}</p>${versionComputeReferenceDetails({...entry,compute_reference:a.full_answer_supplement},false)}</details>`:''}`;
  }

  let currentR8 = null;
  const currentR8Sha = 'c81cd8078a1c9ea61af84cb31c2b59c99fa94876ae1cfaa3a5a12180f9408c61'; // pragma: allowlist secret -- fixed public evidence digest
  function releaseMenu() {
    const option=(id,label)=>`<option value="${esc(id)}" ${selectedRelease===id?'selected':''}>${esc(label)}</option>`;
    const engineOptions=(ids,entries)=>ids.map(id=>{
      const entry=id==='r10'&&archivedR10Selected()&&releaseCatalog?.archived_r10
        ?releaseCatalog.archived_r10:entries?.find(row=>row.id===id);
      return option(id,entry?id+' · '+t(entry.label_zh,entry.label_en):id);
    }).join('');
    const specialIds=[...srIds].sort((a,b)=>BigInt(a.slice(2))>BigInt(b.slice(2))?-1:1);
    const baselineOptions=items=>items.map(item=>`<option value="${esc(item.id)}" ${selectedBaseline===item.id?'selected':''}>${esc(t(item.label,item.label_en||item.label))}${['candidate-pending','pending'].includes(item.status)?t(' · 待发布结果',' · results pending'):''}</option>`).join('');
    const submissionBaseline=comparisonBaselines.filter(item=>item.id===releaseCatalog?.baseline.id);
    const additionalBaselines=comparisonBaselines.filter(item=>item.id!==releaseCatalog?.baseline.id);
    return `<div class="comparison-meta release-selector">
      <div class="release-fields">
      <div class="release-field">
      <label for="comparison-release-select">${t('B1 版本 / 运行记录','B1 version / run history')}</label>
      <select id="comparison-release-select">
        <optgroup label="${t('冻结版本','Frozen releases')}">${engineOptions(releaseIds,releaseCatalog?.entries)}</optgroup>
        <optgroup label="${t('冻结前尝试','Pre-freeze attempts')}">${engineOptions(attemptIds,releaseCatalog?.attempts)}</optgroup>
        <optgroup label="${t('SR 实验版本','Experimental SR releases')}">${specialIds.map(id=>
          option(id,'B1-'+id)).join('')}</optgroup>
      </select></div>
      ${!developmentComparison()?`<div class="release-field"><label for="comparison-baseline-select">${t('B0 版本','B0 version')}</label>
      <select id="comparison-baseline-select">
        <optgroup label="${t('送测 B0','Submission B0')}">${baselineOptions(submissionBaseline)}</optgroup>
        <optgroup label="${t('扩展对照','Additional controls')}">${baselineOptions(additionalBaselines)}</optgroup>
      </select></div>`:''}
      <div class="release-field">
      <label for="comparison-controlplane-select">${t('控制面','Control plane')}</label>
      <select id="comparison-controlplane-select">
        <option value="">${t('无','None')}</option>
        <option value="${controllerOption}" ${selectedController?'selected':''}>${controllerName()}</option>
      </select>
      </div>
      </div>
      <div class="release-links">
      ${developmentComparison()?`<a href="./b0-b1.html?release=${esc(selectedRelease)}">${t('B0 / B1 对比','B0 / B1 comparison')} ↗</a>`:`<a class="fixed-b0-identity" href="${esc(comparisonBaselines.find(item=>item.id===selectedBaseline)?.profile.url||releaseCatalog?.baseline.profile.url||'./engine.html')}">${originalBaselineSelected()?'B0 · vLLM0.18 / Ascend0.18':t('B0 来源','B0 source')} ↗</a>`}
      ${modelIntegrationResults.has(selectedRelease)?`<a href="./b0-b1.html?release=${esc(selectedRelease)}#development-comparison">${t('书生适配开发对照','Intern adaptation development comparison')} ↗</a>`:developmentRelease()&&!developmentComparison()?`<a href="./b0-b1.html?release=${esc(selectedRelease)}&amp;comparison=development">${t('查看本版专项配对','View this release’s development pair')} ↗</a>`:`<a href="./engine-r8-development.html">${t('开发对照详情','Development evidence')} ↗</a>`}
      <a class="latest-release-link" href="./b0-b1.html">${t('默认实测结果','Default benchmark results')} ↗</a>
      ${selectedRelease==='r10'&&releaseCatalog?.archived_r10?archivedR10Selected()
        ? `<a data-r10-revision-link data-r10-route-version="${esc(currentR10Version()||'')}" href="${esc(r10RevisionHref(currentR10Version()))}">${t('查看最新 r10 修订','View the latest R10 revision')} ↗</a>`
        : `<a data-r10-revision-link data-r10-route-version="${esc(r10ArchivedVersion)}" href="${esc(r10RevisionHref(r10ArchivedVersion))}">${t('r10 历史版','Archived R10')} ${esc(r10ArchivedVersion)} ↗</a>` : ''}
      <a id="release-history-link" href="./report-history.html">${t('历史报告','Report archive')} ↗</a>
      </div>
    </div>${baselineFallback?`<p class="baseline-fallback" role="status">${t('链接中的基线版本无效，已显示固定送测 B0。','The baseline in the link is unknown. Showing the fixed submission B0.')}</p>`:''}
    ${releaseFallback?`<p class="release-fallback" role="status">${t('链接中的 B1 版本无效，已显示最新正式版。','The B1 version in the link is unknown. Showing the latest frozen release.')}</p>`:''}
    ${controllerFallback?`<p class="controller-fallback" role="status">${t('链接中的控制面无效，已选无。','The control plane in the link is unknown. None is selected.')}</p>`:''}`;
  }
  function bindMenu() {
    root.querySelector('#comparison-controlplane-select').addEventListener('change',event=>{
      selectedController=event.target.value;
      if(controllerFallback){
        controllerFallback=false;
        root.querySelector('.controller-fallback')?.remove();
      }
      const url=new URL(location.href);
      if(selectedController)url.searchParams.set('controlplane',selectedController);
      else url.searchParams.delete('controlplane');
      history.replaceState(null,'',url);
      root.querySelectorAll('[data-r10-route-version]').forEach(link=>{
        link.setAttribute('href',r10RevisionHref(link.dataset.r10RouteVersion));
      });
      renderControllerPanel();
    });
    root.querySelector('#comparison-baseline-select')?.addEventListener('change',event=>{
      selectedBaseline=event.target.value;
      baselineFallback=false;
      const url=new URL(location.href);url.searchParams.set('b0',selectedBaseline);url.searchParams.delete('comparison');history.replaceState(null,'',url);
      showRelease();
    });
    root.querySelector('#comparison-release-select').addEventListener('change',event=>{
      selectedRelease=event.target.value;
      selectedRevision=selectedRelease==='r10'?currentR10Version():null;
      automaticRelease=false;
      releaseFallback=false;
      const url=new URL(location.href);url.searchParams.set('release',selectedRelease);
      if(selectedRevision)url.searchParams.set('revision',selectedRevision);
      else url.searchParams.delete('revision');
      if(url.searchParams.has('b0')||!developmentRelease())url.searchParams.delete('comparison');
      history.replaceState(null,'',url);
      showRelease();
    });
  }
  const fixedProfiles = [['mmlu','MMLU200'],['hle','HLE200'],['frontier','Frontier160'],['swe','SWE trace64'],['terminal','Terminal trace48']];
  function standardRows(rows, reason) {
    const used=new Set();
    const fixed=fixedProfiles.map(([id,label])=>{
      const row=rows.find(row=>row.id===id||row.id===id+'200'||row.id===id+'160'||row.id===id+'-trace');
      if(row){used.add(row);return {...row,id,label};}
      return {id,label,missingReason:reason||t('本版未发布该项配对数据','No published pair for this profile')};
    });
    return [...fixed,...rows.filter(row=>!used.has(row))];
  }
  function coverageView(rows, qualityOnly=false, referenceLabel=null, heading='dataset-coverage-title') {
    return `<section class="dataset-coverage" aria-labelledby="${heading}"><div class="section-heading"><h2 id="${heading}">${t('固定五项数据集','Five fixed profiles')}</h2></div><div class="dataset-coverage-grid">${fixedProfiles.map(([id,label])=>{
      const row=rows.find(row=>row.id===id),available=!!row?.arms;
      const status=row?.baselineObservation?(row.observation?t('B0 已测 · B1 已测（分别列示）','B0 measured · B1 measured (separate)'):t('B0 已测 · B1 暂无结果','B0 measured · B1 unpublished')):row?.observation?t('B1单臂实测','B1 single-arm measurement'):available?(referenceLabel?t(`实测；参考 ${referenceLabel}`,`Measured; reference ${referenceLabel}`):row.crossCard?t('已发布跨卡对照','Published cross-card comparison'):t('已发布配对','Published pair')):(qualityOnly&&id==='mmlu'?t('仅质量记录','Quality record only'):t('缺少配对数据','Paired data missing'));
      const taskScope=id==='swe'?t('32 任务 / 64 请求','32 tasks / 64 requests'):id==='terminal'?t('32 任务 / 48 请求','32 tasks / 48 requests'):'';
      return `<article data-dataset="${id}"${cardComparisonAttribute(row||{})} data-available="${available}" data-b0-available="${!!(row?.arms?.B0||row?.baselineObservation)}" data-b1-available="${!!(row?.arms?.B1||row?.observation)}"><strong>${label}</strong><span>${status}</span>${taskScope?`<small>${taskScope}</small>`:''}${row?.cardLabel?`<small>${esc(row.cardLabel)}</small>`:''}${row?.coverageNote?`<small>${esc(row.coverageNote)}</small>`:''}</article>`;
    }).join('')}</div></section>`;
  }
  async function validateVersionSupplement(entry, publication) {
    const a=entry.context_tenant_supplement;
    if(!a)return;
    const fail=()=>{throw Error('Invalid version-specific context and tenant evidence');};
    if(a.schema!==entry.id+'-context-tenant-publication/v1' || a.engine_release!==entry.release ||
       a.baseline_id!==entry.baseline_id || a.execution_complete!==true || a.quality_measured!==false ||
       a.effective_flops_certified!==false || a.efficiency_percent!==null ||
       !/^[a-f0-9]{64}$/.test(a.source_summary_sha256||'') || !/^[a-f0-9]{64}$/.test(a.raw_asset?.sha256||'') ||
       !/^https:\/\/github\.com\/(?:vLLM-HUST\/vllm-hust-engine|DeepLinkNext\/DeepLinkEngine)\/releases\/download\//.test(a.raw_asset?.url||'') ||
       a.comparisons?.length!==a.protocol?.phases?.length || !a.comparisons?.length ||
       !Number.isInteger(a.protocol.output_tokens) || a.protocol.output_tokens<=0)fail();
    if(a.tensor_parallel_size!==2 || (a.physical_cards!==undefined&&!validPhysicalCards(a.physical_cards)) ||
       !Number.isFinite(a.protocol.measurement_window_seconds) || a.protocol.measurement_window_seconds<=0 ||
       !a.protocol.phases.some(p=>p.tenants>1))fail();
    const metrics=m=>{
      if(!m || ![m.requests,m.successful,m.failed,m.output_tokens].every(Number.isInteger) ||
         m.requests<0 || m.successful!==m.requests || m.failed!==0 ||
         !Number.isFinite(m.duration_seconds) || m.duration_seconds<=0 ||
         !Number.isFinite(m.output_tokens_per_second) || m.output_tokens_per_second<0 ||
         !close(m.output_tokens/m.duration_seconds,m.output_tokens_per_second) ||
         (a.protocol.ignore_eos===true&&m.output_tokens!==m.successful*a.protocol.output_tokens))fail();
      for(const kind of ['ttft_ms','tpot_ms']) {
        const values=['mean','p95','p99'].map(k=>m[kind]?.[k]);
        if(m.successful? !values.every(v=>Number.isFinite(v)&&v>0): !values.every(v=>v===null))fail();
        if(m.successful&&m[kind].p99<m[kind].p95)fail();
      }
    };
    const ids=new Set();
    for(let i=0;i<a.comparisons.length;i++) {
      const row=a.comparisons[i],phase=a.protocol.phases[i];
      const cohorts=a.protocol.cohorts.filter(c=>String(c.min_tokens)===phase.cohort);
      if(ids.has(row.phase) || row.phase!==phase.id+'-formal' || cohorts.length!==1 ||
         !Number.isInteger(phase.tenants) || phase.tenants<1 || !Number.isInteger(phase.concurrency) || phase.concurrency<phase.tenants ||
         !Number.isFinite(phase.formal_seconds) || phase.formal_seconds<=0 ||
         !Number.isFinite(phase.warmup_seconds) || phase.warmup_seconds<0 ||
         !Number.isInteger(cohorts[0].min_tokens) || cohorts[0].min_tokens<1 ||
         !Number.isInteger(cohorts[0].max_tokens_exclusive) || cohorts[0].max_tokens_exclusive<=cohorts[0].min_tokens)fail();
      ids.add(row.phase);
      const hasArmCards=['B0','B1'].some(role=>row[role]?.physical_cards!==undefined);
      if(hasArmCards&&!['B0','B1'].every(role=>validPhysicalCards(row[role]?.physical_cards)))fail();
      for(const role of ['B0','B1']) {
        const arm=row[role],m=arm?.metrics;
        const physicalCards=arm?.physical_cards??a.physical_cards;
        if(!validPhysicalCards(physicalCards))fail();
        if(arm?.status!=='completed' || arm.tenants!==phase.tenants || arm.concurrency!==phase.concurrency ||
           !m || ![m.requests,m.successful,m.failed].every(Number.isInteger) || m.requests<=0 ||
           m.successful<0 || m.failed<0 || m.successful+m.failed!==m.requests ||
           ![m.output_tokens,m.duration_seconds,m.output_tokens_per_second].every(v=>Number.isFinite(v)&&v>0) ||
           !close(m.output_tokens/m.duration_seconds,m.output_tokens_per_second) ||
           (a.protocol.ignore_eos===true&&!close(m.output_tokens,m.successful*a.protocol.output_tokens)) ||
           arm.windows?.length!==phase.formal_seconds/a.protocol.measurement_window_seconds ||
           Object.keys(arm.per_tenant||{}).length!==phase.tenants ||
           Object.values(arm.per_tenant).reduce((n,t)=>n+t.requests,0)!==m.requests)fail();
        metrics(m);
        if(arm.phase!==row.phase || arm.cohort!==phase.cohort)fail();
        const tenants=Object.values(arm.per_tenant);
        tenants.forEach(metrics);
        arm.windows.forEach((window,index)=>{
          metrics(window.metrics);
          if(window.submission_window!==index ||
             ![window.start_monotonic,window.submission_end_monotonic,window.drain_end_monotonic].every(Number.isFinite) ||
             !close(window.submission_end_monotonic-window.start_monotonic,a.protocol.measurement_window_seconds) ||
             window.drain_end_monotonic<window.submission_end_monotonic ||
             !close(window.drain_end_monotonic-window.start_monotonic,window.metrics.duration_seconds) ||
             (index&&!close(window.start_monotonic,arm.windows[index-1].submission_end_monotonic)))fail();
        });
        for(const key of ['requests','successful','failed','output_tokens']) {
          if(tenants.reduce((n,t)=>n+t[key],0)!==m[key] || arm.windows.reduce((n,w)=>n+w.metrics[key],0)!==m[key])fail();
        }
        const utilization=arm.utilization,cardValues=physicalCards.map(card=>utilization?.per_card_percent?.[card]);
        if(!cardValues.every(v=>Number.isFinite(v)&&v>=0&&v<=100) ||
           !close(utilization.mean_percent,cardValues.reduce((n,v)=>n+v,0)/cardValues.length) ||
           !Number.isFinite(utilization.covered_seconds) || utilization.covered_seconds<0 ||
           !Number.isFinite(utilization.missing_seconds) || utilization.missing_seconds<0 ||
           !close(utilization.covered_seconds+utilization.missing_seconds,m.duration_seconds))fail();
        if(!/^[a-f0-9]{64}$/.test(a.arm_seals?.[role]||''))fail();
        for(const kind of ['ttft_ms','tpot_ms'])if(!['mean','p95','p99'].every(k=>Number.isFinite(m[kind]?.[k])&&m[kind][k]>0))fail();
      }
      if(!close(row.B1.metrics.output_tokens_per_second/row.B0.metrics.output_tokens_per_second,row.throughput_ratio) ||
         !close(100*(1-1/row.throughput_ratio),row.equal_rate_same_card_count_unit_cost_reduction_percent))fail();
    }
    const publicSource=a.raw_asset.public_download;
    if(publicSource&&(!/^data\/[a-z0-9/-]+\.(?:json|tar\.gz|zip)$/.test(publicSource.path||'')||
       (publicSource.original_sha256??publicSource.sha256)!==a.raw_asset.sha256||
       (!publicSource.original_sha256&&publicSource.bytes!==a.raw_asset.bytes)||
       !publication.files.some(row=>row.website_path===publicSource.path&&
         row.sha256===publicSource.sha256&&row.bytes===publicSource.bytes)))fail();
    const chart=a.chart;
    if(entry.r10_revision&&!chart)return;
    if(!/^data\/[a-z0-9/-]+\.svg$/.test(chart?.path||'') || !/^[a-f0-9]{64}$/.test(chart?.sha256||''))fail();
    const source=publication.files.filter(row=>row.website_path===chart.path);
    if(source.length!==1 || source[0].sha256!==chart.sha256 || source[0].bytes!==chart.bytes)fail();
    const response=await fetch('./'+chart.path,{cache:'no-cache'});
    if(!response.ok)fail();
    const raw=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==chart.sha256 || raw.byteLength!==chart.bytes)fail();
  }
  function validateR10Revision(entry) {
    const revision=entry.r10_revision,a=entry.context_tenant_supplement;
    const result=revision.assessment_4_3;
    const percentileMethod=entry.submission_assessment?'nearest_rank':'linear_interpolation_(n-1)q';
    const phases=['4096-formal','16384-formal','32768-formal','multi-tenant-formal'];
    const mirror='https://github.com/vLLM-HUST/vllm-hust-website/releases/download/engine-wheels-r10-v1/';
    const fail=()=>{throw Error('Invalid R10 revision comparison');};
    if(entry.id!=='r10'||entry.release!=='full-answer-b1-20261124-r10'||(entry.measurements.length&&!entry.submission_assessment)||
       revision.pypi_version!=='2026.11.24.10'||revision.previous_version!==r10ArchivedVersion||
       revision.pypi_url!=='https://pypi.org/project/vllm-hust-engine/'+revision.pypi_version+'/'||
       revision.install_manifest_url!==mirror+'r10-3072-pip-requirements.txt'||
       revision.arm64_acceptance_url!==mirror+'arm64-r10-3072-clean-install.json'||
       !(revision.previous_b1_throughput_32k>0)||JSON.stringify(a?.comparisons.map(row=>row.phase))!==JSON.stringify(phases)||
       !isTerminalReplayC8(sealedContextWorkload(a.protocol.input_sha256),a.comparisons[0])||
       a.protocol.output_tokens!==256||a.protocol.measurement_window_seconds!==60||
       a.protocol.phases.some((phase,i)=>phase.warmup_seconds!==60||phase.formal_seconds!==300||
         phase.concurrency!==(i===3?24:8)||phase.tenants!==(i===3?4:1))||
       result?.percentile_method!==percentileMethod||
       !['B0','B1'].every(role=>result.blocking_errors?.[role]?.length===0))fail();
    const [short,medium,long]=a.comparisons.map(row=>row.B1);
    const fields={
      throughput:m=>m.output_tokens_per_second,
      ttft_p95:m=>m.ttft_ms.p95,ttft_p99:m=>m.ttft_ms.p99,
      tpot_p95:m=>m.tpot_ms.p95,tpot_p99:m=>m.tpot_ms.p99,
    };
    const milestone=Object.fromEntries(Object.entries(fields).map(([key,metric])=>[key,metric(medium.metrics)/metric(short.metrics)]));
    const windows=Object.fromEntries(Object.entries(fields).map(([key,metric])=>{
      const values=long.windows.map(row=>metric(row.metrics));
      return [key,Math.max(...values)/Math.min(...values)];
    }));
    if(!Object.keys(fields).every(key=>close(milestone[key],Number(result.measured_ratios[key]))&&
       close(windows[key],Number(result.measured_window_ratios[key]))))fail();
    if(result.milestone?.met!==(milestone.throughput>=.5&&milestone.ttft_p95<=3&&milestone.ttft_p99<=3&&
       milestone.tpot_p95<=2&&milestone.tpot_p99<=2)||
       result.final?.met!==(windows.throughput<=1.5&&windows.ttft_p95<=2&&windows.ttft_p99<=2&&
       windows.tpot_p95<=1.25&&windows.tpot_p99<=1.25))fail();
  }
  function sealedContextWorkload(digest) {
    const source=contextWorkloads.get(digest);
    return source?{input_sha256:digest,...source}:null;
  }
  function formatContextWorkload(source) {
    return source.datasets.join(' / ')+' · '+source.task_ids.length+' '+t('条公开任务历史','published task histories');
  }
  function contextWorkloadLabel(supplement) {
    const source=sealedContextWorkload(supplement.protocol?.input_sha256||supplement.input_sha256);
    return source?formatContextWorkload(source):t(supplement.workload_label_zh,supplement.workload_label_en);
  }
  function supplementLabel(a,row) {
    const phase=a.protocol.phases.find(phase=>row.phase===phase.id+'-formal');
    const cohort=a.protocol.cohorts.find(cohort=>String(cohort.min_tokens)===phase.cohort);
    return phase.tenants>1?t(`${phase.tenants}租户 / C${phase.concurrency}`,`${phase.tenants} tenants / C${phase.concurrency}`):
      `${cohort.min_tokens/1024}K–${cohort.max_tokens_exclusive/1024}K / C${phase.concurrency}`;
  }
  function isTerminalReplayC8(workload, row) {
    return workload?.datasets.length===1&&workload.datasets[0]==='Terminal-Bench 2.1'
      &&row.B1.tenants===1&&row.B1.concurrency===8;
  }
  function versionSupplementRows(entry) {
    const a=entry.context_tenant_supplement;
    const stable=stableAssessment(entry)?.targets['4.3'];
    if(!a&&!stable)return [];
    const workload=stable?.baseline_context.workload||sealedContextWorkload(a.protocol.input_sha256);
    const rows=stable?.paired.comparison||a.comparisons;
    return rows.map(row=>{
      const arms=Object.fromEntries(['B0','B1'].map(role=>{
        const m=row[role].metrics;
        return [role,{...m,mean_ttft_ms:m.ttft_ms.mean,mean_tpot_ms:m.tpot_ms.mean,
          physical_cards:stable?.physical_cards[role]??row[role].physical_cards??a.physical_cards,
          source_seal_sha256:(stable?.paired||a).arm_seals[role],
          relative_cost_per_token:row.B0.metrics.output_tokens_per_second/m.output_tokens_per_second}];
      }));
      const changes_percent=Object.fromEntries(['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map(key=>[key,100*(arms.B1[key]/arms.B0[key]-1)]));
      const cards=cardComparison(row.B0.physical_cards??stable?.physical_cards.B0,row.B1.physical_cards??stable?.physical_cards.B1);
      const phase=row.B1;
      const label=stable?(phase.tenants>1?t('4K / 四租户 C24','4K / four tenants C24'):
        `${Number(phase.cohort)/1024}K / C${phase.concurrency}`):supplementLabel(a,row);
      const dataset=stable?workload.datasets.join(' · '):contextWorkloadLabel(a);
      const replay=isTerminalReplayC8(workload,row)?terminalReplayWorkloadLabel():dataset;
      return {id:'real-context-'+row.phase,label,arms,changes_percent,...cards,
              workloadKind:'fixed-data-context',workloadSource:workload,
              workloadLabel:[replay,cardComparisonLabel(cards)].filter(Boolean).join(' · ')};
    });
  }
  async function loadSubmissionAssessment(entry, publication) {
    const descriptor=entry.submission_assessment;
    if(!descriptor)return;
    const fail=()=>{throw Error('Invalid release submission assessment');};
    async function verifiedAsset(asset, extension) {
      if(!asset||!/^data\/[a-z0-9/-]+\.(?:json|html)$/.test(asset.path||'')||
         !asset.path.endsWith('.'+extension)||!/^[a-f0-9]{64}$/.test(asset.sha256||'')||
         !Number.isInteger(asset.bytes)||asset.bytes<=0)fail();
      const bindings=publication.files.filter(file=>file.website_path===asset.path);
      if(bindings.length!==1||bindings[0].sha256!==asset.sha256||bindings[0].bytes!==asset.bytes)fail();
      const response=await fetch('./'+asset.path,{cache:'no-cache'});
      if(!response.ok)fail();
      const raw=transportAssetBytes(await response.arrayBuffer(),asset);
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(raw.byteLength!==asset.bytes||digest!==asset.sha256)fail();
      return raw;
    }
    const report=JSON.parse(new TextDecoder().decode(await verifiedAsset(descriptor,'json')));
    const targets=report.targets,goals=['4.1','4.2','4.3','4.4'];
    if(report.schema!=='deeplinkengine-full-acceptance-report/v1'||report.engine_release!==entry.release||
       report.execution_complete!==true||!goals.every(id=>['milestone','final'].every(gate=>typeof targets?.[id]?.[gate]?.met==='boolean')))fail();

    const compute=entry.compute_reference;
    if(!compute||!['B0','B1'].every(role=>validPhysicalCards(compute.arms[role].physical_cards))||
       targets['4.1'].efficiency_lower_percent!==compute.arms.B1.efficiency_lower_percent||
       targets['4.1'].milestone.met!==compute.milestone_met||targets['4.1'].final.met!==compute.final_numeric_met)fail();
    const pair=id=>entry.measurements.find(row=>row.id===id)?.arms;
    if(entry.measurements.some(row=>!row.arms.every(arm=>validPhysicalCards(arm.physical_cards))))fail();
    const serving=targets['4.2'];
    for(const [gate,profiles,speed,latency] of [
      ['milestone',serving.datasets,1.1,0.95],['final',serving.final_datasets,2,0.8]
    ]) {
      if(!profiles||Object.keys(profiles).length!==fixedProfiles.length)fail();
      for(const [id] of fixedProfiles) {
        const arms=pair(id),row=profiles[id];
        if(!arms||!row||row.execution_complete!==true||typeof row.quality?.met!=='boolean'||arms.some(arm=>arm.failed!==0))fail();
        const [before,after]=arms;
        const throughput=after.output_tokens_per_second/before.output_tokens_per_second;
        const ttft=after.mean_ttft_ms/before.mean_ttft_ms,tpot=after.mean_tpot_ms/before.mean_tpot_ms;
        if(!close(Number(row.throughput_ratio),throughput)||!close(Number(row.ttft_ratio),ttft)||
           !close(Number(row.tpot_ratio),tpot)||row.met!==(row.quality.met&&throughput>=speed&&ttft<=latency&&tpot<=latency))fail();
      }
      if(serving[gate].met!==Object.values(profiles).some(row=>row.met))fail();
    }

    const mmlu=pair('mmlu');
    const supplement=entry.context_tenant_supplement;
    const tenant=supplement?.comparisons.find(row=>row.B1.tenants===4);
    if(!mmlu||!tenant||supplement.comparisons.some(row=>!['B0','B1'].every(role=>validPhysicalCards(row[role].physical_cards))))fail();
    const cost=targets['4.4'],quote=cost.rental_quote;
    const rate=Number(quote?.cny_per_card_month);
    if(typeof quote?.provider!=='string'||!quote.provider.trim()||!/^https:\/\/[^\s]+$/.test(quote.url||'')||
       !/^\d{4}-\d{2}-\d{2}$/.test(quote.checked_date||'')||!Number.isFinite(rate)||rate<=0)fail();
    function costWorkload(id, observations) {
      const evidence=cost.formal_cost?.[id];
      const arms=Object.fromEntries(['B0','B1'].map((role,i)=>{
        const {metrics,physicalCards,seal}=observations[i];
        const arm=evidence?.arms?.[role];
        const util=evidence?.utilization?.[role];
        const values=physicalCards.map(card=>util?.per_card_percent?.[card]);
        if(!arm||arm.occupied_cards!==physicalCards.length||!close(Number(arm.window_seconds),metrics.duration_seconds)||
           arm.successful_output_tokens!==metrics.output_tokens||arm.measurement_seal_sha256!==seal||
           !values.every(value=>Number.isFinite(value)&&value>=0&&value<=100)||
           !close(util.mean_percent,values.reduce((sum,value)=>sum+value,0)/physicalCards.length)||
           util.missing_seconds!==0||!close(util.covered_seconds,metrics.duration_seconds))fail();
        return [role,{utilization:util.mean_percent,
          unitCost:1e6*rate*arm.occupied_cards*Number(arm.window_seconds)/(30*86400*arm.successful_output_tokens)}];
      }));
      const reduction=100*(1-arms.B1.unitCost/arms.B0.unitCost);
      if(!close(Number(evidence.reduction_percent),reduction))fail();
      return {arms,reduction,cards:cardComparison(...observations.map(row=>row.physicalCards))};
    }
    const mmluCost=costWorkload('mmlu',mmlu.map(arm=>({metrics:arm,physicalCards:arm.physical_cards,seal:arm.source_seal_sha256})));
    const tenantCost=costWorkload('four_tenant',['B0','B1'].map(role=>({
      metrics:tenant[role].metrics,physicalCards:tenant[role].physical_cards,seal:supplement.arm_seals[role]
    })));
    const gain=mmluCost.arms.B1.utilization-mmluCost.arms.B0.utilization;
    const tenantUtilization=tenantCost.arms.B1.utilization;
    const allTenants=['B0','B1'].every(role=>Object.values(tenant[role].per_tenant).every(metrics=>metrics.successful>0));
    if(!close(Number(cost.utilization_gain_pp),gain)||!close(Number(cost.four_tenant_ai_core_mean_percent),tenantUtilization)||
       cost.milestone.met!==(serving.datasets.mmlu.quality.met&&mmluCost.reduction>=10&&gain>=10)||
       cost.final.met!==(allTenants&&tenantCost.reduction>=30&&tenantUtilization>=80))fail();
    if(entry.r10_revision&&['milestone','final'].some(gate=>
      targets['4.3'][gate].met!==entry.r10_revision.assessment_4_3[gate].met))fail();
    if(entry.submission_report)await verifiedAsset(entry.submission_report,'html');
    submissionAssessments.set(entry,{targets,quote,rate,mmluCost,tenantCost,gain,tenantUtilization});
  }
  function rentalCostDetails(assessment) {
    const {quote,rate,mmluCost,tenantCost}=assessment;
    return `<details data-rental-cost><summary>${t('4.4 租金来源与单位成本','4.4 Rental source and unit cost')}</summary>
      <p><a href="${esc(quote.url)}">${esc(quote.provider)} ↗</a> · ${esc(quote.checked_date)} · ${n(rate)} ${t('元/卡月','CNY/card-month')}</p>
      <p>${t('两臂按同一公开租金折算。每百万输出词元成本 = 每卡月租 × 占卡数 × 正式区间秒数 × 10⁶ ÷（30 × 86400 × 成功输出词元数）。正式区间包含排空。','Both arms use the same published rental rate. Cost per million output tokens = monthly rent per card × occupied cards × measured seconds × 10⁶ ÷ (30 × 86400 × successful output tokens). The measured interval includes drain.')}</p>
      ${table(t(['工况','卡号','B0 元/百万词元','B1 元/百万词元','成本降幅','双卡 AI Core 利用率'],['Workload','Cards','B0 CNY/million tokens','B1 CNY/million tokens','Cost reduction','Two-card AI Core utilization']),
        [['MMLU200',mmluCost],[t('4K 四租户','4K four tenants'),tenantCost]].map(([label,row])=>[
          label,cardComparisonLabel(row.cards),n(row.arms.B0.unitCost),n(row.arms.B1.unitCost),
          n(row.reduction)+'%',n(row.arms.B0.utilization)+'% → '+n(row.arms.B1.utilization)+'%'
        ]))}
    </details>`;
  }
  function v2Assessment(entry, rows) {
    if(entry.r10_revision&&!submissionAssessments.has(entry)){
      const release=entry.r10_revision;
      const result=release.assessment_4_3;
      const status=met=>met?t('达成目标','Target met'):t('未达成目标','Target not met');
      const mark=(met,reason)=>status(met)+' · '+reason;
      const milestone=result.measured_ratios,windows=result.measured_window_ratios;
      const tail=`${n(Number(milestone.ttft_p95))}× / ${n(Number(milestone.ttft_p99))}×`;
      const spread=`${n(Number(windows.throughput))}× · ${n(Number(windows.tpot_p95))}× / ${n(Number(windows.tpot_p99))}×`;
      const score=t('待核算 · 本版有效算力参考','Pending calculation · current-release compute reference');
      const five=t('待补测 · 本版固定五项配对','Pending measurements · current-release fixed-five pairs');
      return `<section class="submission-assessment" id="submission-v2" data-r10-revision="${esc(release.pypi_version)}">
        <div class="section-heading"><h2>${t('新版实测进度与 4.3 判定','Revision progress and 4.3 assessment')}</h2></div>
        <p><a href="${esc(release.pypi_url)}">PyPI ${esc(release.pypi_version)} ↗</a> ·
        <a href="${esc(release.install_manifest_url)}">${t('安装清单','Installation manifest')} ↗</a> ·
        <a href="${esc(release.arm64_acceptance_url)}">${t('ARM64 安装验收','ARM64 installation acceptance')} ↗</a></p>
        ${table(t(['项目','里程碑','结题'],['Target','Milestone','Final']),[
          ['4.1',score,score],
          ['4.2',five,five],
          ['4.3',mark(result.milestone.met,t('16K／4K TTFT P95／P99 ','16K / 4K TTFT P95 / P99 ')+tail),
            mark(result.final.met,t('32K 五窗吞吐／TPOT P95／P99 波动 ','32K five-window throughput / TPOT P95 / P99 spreads ')+spread)],
          ['4.4',t('待补测 · 本版 MMLU 完整回答及成本','Pending measurements · current-release MMLU full answers and cost'),
            t('证据未齐 · 已完成四租户回归','Evidence incomplete · four-tenant regression complete')],
        ])}</section>`;
    }
    const stable=stableAssessment(entry);
    if(stable){
      const release=entry.stable_evidence;
      return `<section class="submission-assessment" id="submission-v2">
        <div class="section-heading"><h2>${t('送测 V2 判定','Submission V2 assessment')}</h2></div>
        <p><a href="${esc(release.pypi_url)}">PyPI ${esc(release.pypi_version)} ↗</a> ·
        <a href="${esc(release.install_manifest_url)}">${t('安装清单','Installation manifest')} ↗</a> ·
        <a href="${esc(release.arm64_acceptance_url)}">${t('ARM64 安装验收','ARM64 installation acceptance')} ↗</a></p>
        ${candidateAssessment(stable.item,stable.report,stable.value,{rentalDisclosure:true})}</section>`;
    }
    if(entry.stable_evidence)return `<section class="submission-assessment" id="submission-v2">
      <h2>${t('送测 V2 判定','Submission V2 assessment')}</h2>
      <p data-stable-assessment-unavailable>${t('稳定版 V2 封存证据未通过读取校验。','Stable V2 evidence could not be verified.')}</p></section>`;
    const status=(met,evidence)=>[met?t('达成目标','Target met'):t('未达成目标','Target not met'),evidence].join(' · ');
    const missing=reason=>status(false,reason);
    const assessment=submissionAssessments.get(entry);
    const source=(anchor,label)=>`<a href="./test-plan.html#${anchor}-${t('zh','en')}">${label} ↗</a>`;
    const certificate=entry.compute_reference?.accepted_scope==='topic4_submission_v2_fixed200_max256_three_formal_runs'
      ?entry.compute_reference:null;
    const compute=target=>certificate
      ?status(Number(certificate.arms.B1.efficiency_lower_percent)>=target,
        'η ≥ '+computeBound(certificate.arms.B1.efficiency_lower_percent)+'%')
      :missing(t('待本版 MMLU200 / 256 输出预算三轮必要算量与同步计时核验',
        'This version needs verified work and synchronized timing for three MMLU200 / out256 runs'));

    const mmlu=rows.find(row=>row.id==='mmlu')?.arms;
    const b0=mmlu?.B0,b1=mmlu?.B1;
    const serving=(speed,latency,gate)=>{
      if(assessment) {
        const result=assessment.targets['4.2'];
        const profiles=gate==='final'?result.final_datasets:result.datasets;
        const accepted=fixedProfiles.filter(([id])=>profiles[id].met).map(([id,label])=>{
          const row=rows.find(profile=>profile.id===id);
          return row?.crossCard?`${label} (${t('跨卡','cross-card')})`:label;
        });
        return status(result[gate].met,accepted.join(' · '));
      }
      if(!b0||!b1)return missing(t('本版无 MMLU 配对证据','This version lacks a paired MMLU result'));
      const ratio=b1.output_tokens_per_second/b0.output_tokens_per_second;
      const ttft=100*(1-b1.mean_ttft_ms/b0.mean_ttft_ms),tpot=100*(1-b1.mean_tpot_ms/b0.mean_tpot_ms);
      const score=[b0,b1].map(arm=>Number.isInteger(arm.correct)?arm.correct+'/'+arm.requests:'—').join(' → ');
      const values=`MMLU200 · ${n(ratio)}× · TTFT −${n(ttft)}% · TPOT −${n(tpot)}% · ${score}`.replaceAll('−-','+');
      const numericPass=ratio>=speed&&ttft>=latency&&tpot>=latency;
      return missing(values+' · '+(numericPass
        ?t('达到该场景性能门槛，待核对 V2 质量与服务验收条件','Performance thresholds met; V2 quality and service acceptance must be verified')
        :t('该场景未同时达到三项性能门槛','This scenario misses at least one performance threshold')));
    };

    const context=entry.context_tenant_supplement?.comparisons||[];
    const find=phase=>context.find(row=>row.phase===phase)?.B1;
    const short=find('4096-formal'),medium=find('16384-formal'),long=find('32768-formal');
    const measures=m=>[m.output_tokens_per_second,m.ttft_ms.p95,m.ttft_ms.p99,m.tpot_ms.p95,m.tpot_ms.p99];
    const within=(values,limits)=>values.every((value,i)=>Number.isFinite(value)&&value>0&&value<=limits[i]);
    const tails=values=>values.map(value=>n(value)+'×').join(' / ');
    const milestone=short&&medium?measures(medium.metrics).map((v,i)=>v/measures(short.metrics)[i]):null;
    const final=long?.windows.length===5?measures(long.metrics).map((_,i)=>{
      const values=long.windows.map(w=>measures(w.metrics)[i]);
      return Math.max(...values)/Math.min(...values);
    }):null;
    const healthy=(...phases)=>phases.every(phase=>phase?.status==='completed'&&phase.metrics.failed===0&&
      phase.metrics.requests===phase.metrics.successful&&phase.windows.length===5&&
      phase.windows.every(w=>w.metrics.requests>0&&w.metrics.failed===0&&w.metrics.requests===w.metrics.successful));
    const contextMilestone=milestone
      ?status(healthy(short,medium)&&milestone[0]>=0.5&&within(milestone.slice(1),[3,3,2,2]),
        `16K / 4K ${n(100*milestone[0])}% · TTFT ${tails(milestone.slice(1,3))} · TPOT ${tails(milestone.slice(3))}`)
      :missing(t('缺本版 4K 和 16K 专项及尾时延，C8 附加压测另列','Matching 4K and 16K specialist runs and tail latencies are missing; C8 load tests are separate'));
    const contextFinal=final
      ?status(healthy(long)&&within(final,[1.5,2,2,1.25,1.25]),
        `32K max/min · ${tails(final.slice(0,1))} · TTFT ${tails(final.slice(1,3))} · TPOT ${tails(final.slice(3))}`)
      :missing(t('缺本版 32K 五窗口','Five 32K windows for this version are missing'));
    const tenant=context.find(row=>row.B1.tenants===4);
    const costMilestone=assessment
      ?status(assessment.targets['4.4'].milestone.met,`MMLU200 · ${t('公开租金折算','Published rental rate')} −${n(assessment.mmluCost.reduction)}% · AI Core +${n(assessment.gain)} pp`)
      :missing((b0&&b1?`MMLU200 · ${t('同费率估算','Equal-rate estimate')} ${n(100*(1-b0.output_tokens_per_second/b1.output_tokens_per_second))}% · `:'')+
      t('待核验完整回答的正式计量及同区间双卡利用率','Full-answer metering and matched two-card utilization require verification'));
    const costFinal=assessment
      ?status(assessment.targets['4.4'].final.met,`${t('4K 四租户','4K four tenants')} · ${cardComparisonLabel(assessment.tenantCost.cards)} · ${t('公开租金折算','Published rental rate')} −${n(assessment.tenantCost.reduction)}% · AI Core ${n(assessment.tenantUtilization)}%`)
      :missing((tenant?`${t('同费率估算','Equal-rate estimate')} ${n(tenant.equal_rate_same_card_count_unit_cost_reduction_percent)}% · AI Core ${n(tenant.B1.utilization.mean_percent)}% · `:'')+
      (tenant?t('待核验四租户封存与公开租赁报价核算','Four-tenant seals and the public rental calculation require verification'):t('缺四租户实测及同区间双卡采样','Four-tenant measurements and matched two-card sampling are missing')));
    return `<section class="submission-assessment" id="submission-v2">
      <div class="section-heading"><h2>${t('送测方案 V2 · 本版证据判定','Submission V2 · Evidence for this version')}</h2>
        <a href="./test-plan.html#targets-${t('zh','en')}">${t('完整判据','Full criteria')} ↗</a></div>
      <p>${t('固定 B0 为 vLLM / vLLM-Ascend 0.18.0。判定只使用本版证据；未达成项注明未过门槛或待核验内容。','Submission B0 is fixed to vLLM / vLLM-Ascend 0.18.0. Each judgment uses this version’s evidence and distinguishes a missed threshold from missing evidence.')}</p>
      ${table(t(['指标','里程碑','结题'],['Target','Milestone','Final']),[
        ['4.1 '+names()[0],'≥50% · '+compute(50),'≥90% · '+compute(90)],
        ['4.2 '+names()[1],'≥1.10× / ≥5% / ≥5% · '+serving(1.1,5,'milestone'),'≥2× / ≥20% / ≥20% · '+serving(2,20,'final')],
        ['4.3 '+names()[2],'≥50% / ≤3× / ≤2× · '+contextMilestone,'≤1.50× / ≤2× / ≤1.25× · '+contextFinal],
        ['4.4 '+names()[3],'≥10% / +10 pp · '+costMilestone,'≥30% / ≥80% · '+costFinal]
      ])}
      <p class="assessment-sources">${source('compute',t('有效算力','Compute'))} · ${source('performance',t('性能与质量','Performance and quality'))} · ${source('context',t('上下文','Context'))} · ${source('cost',t('费用折算与采样','Cost accounting and sampling'))}</p>
      ${assessment?rentalCostDetails(assessment):''}
      ${assessment?`<p><a href="./${esc(entry.submission_assessment.path)}">${t('本版验收数据','Version-specific acceptance data')} ↗</a>${entry.submission_report?` · <a href="./${esc(entry.submission_report.path)}">${t('完整补测报告','Full supplement report')} ↗</a>`:''}</p>`:''}
    </section>`;
  }
  function publishedContextTable(rows) {
    const context=rows.filter(row=>continuousProfile(row.id)&&(row.arms?.B1||row.observation));
    if(!context.length)return '';
    return table(t(['工况','数据集来源','运行臂','请求','token/s','TTFT / s','TPOT / ms','TTFT P95/P99 / ms'],
      ['Scenario','Dataset source','Arm','Requests','token/s','TTFT / s','TPOT / ms','TTFT P95/P99 / ms']),
      context.flatMap(row=>(row.arms?Object.entries(row.arms):[['B1',row.observation]]).map(([role,arm])=>[
        row.label,row.workloadLabel||continuousWorkloadLabel(),role,arm.requests??'—',n(arm.output_tokens_per_second),
        n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms),n(arm.ttft_p95_ms)+' / '+n(arm.ttft_p99_ms)
      ])));
  }
  function versionSupplement(entry, rows, values, control) {
    const stable=stableAssessment(entry);
    if(stable){
      const cost=stable.targets['4.4'].four_tenant;
      const cards=stable.targets['4.3'].physical_cards;
      return `<section id="context-tenant-supplement" data-source-release="${esc(entry.id)}"${cardComparisonAttribute(cardComparison(cards.B0,cards.B1))}>
        <div class="section-heading"><h2>${t('上下文与四租户补测','Context and four-tenant supplement')}</h2>
        <button type="button" data-detail="supplement">${t('范围、窗口与原件','Scope, windows and evidence')} ↗</button></div>
        <div class="supplement-highlights"><div><span>${t(`16K 相对 ${control} 吞吐`,`16K throughput vs ${control}`)}</span><strong>${values[2]}</strong></div>
        <div><span>${t('四租户成本降低','Four-tenant cost reduction')}</span><strong>${n(Number(cost.unit_cost_reduction_percent))}%</strong></div>
        <div><span>${t('四租户 AI Core 利用率','Four-tenant AI Core utilization')}</span><strong>${n(cost.utilization.B0.mean_percent)} → ${n(cost.utilization.B1.mean_percent)}%</strong></div></div>
        ${candidateAssessment(stable.item,stable.report,stable.value,{target:'4.3'})}</section>`;
    }
    const a=entry.context_tenant_supplement;
    const baselineContext=control==='B0'&&/^r[1-9][0-9]*$/.test(entry.id)?fixedBaselineContext():'';
    if(!a){
      const published=control==='B0'?publishedContextTable(rows):'';
      const status=t('本版 B1 尚未发布完整补测结果。','Complete supplement results for this B1 are unpublished.');
      return `<section id="context-tenant-supplement"${published?' data-source-release="'+esc(entry.id)+'"':''}><div class="section-heading"><h2>${t('上下文与四租户补测','Context and four-tenant supplement')}</h2><button type="button" data-detail="supplement">${t('范围、窗口与原件','Scope, windows and evidence')} ↗</button></div><div class="supplement-highlights"><div><span>${t(`16K 相对 ${control} 吞吐`,`16K throughput vs ${control}`)}</span><strong>${values[2]}</strong></div><div><span>${t('四租户成本降低','Four-tenant cost reduction')}</span><strong>—</strong></div><div><span>${t('四租户AI Core利用率','Four-tenant AI Core utilization')}</span><strong>—</strong></div></div>${baselineContext}${published}<div class="supplement-plot missing-plot">${status}</div></section>`;
    }
    const tenant=a.comparisons.find(row=>row.B1.tenants>1);
    const cards=cardComparison(tenant?.B0.physical_cards,tenant?.B1.physical_cards);
    const workload=sealedContextWorkload(a.protocol.input_sha256);
    const replayBands=a.comparisons.filter(row=>isTerminalReplayC8(workload,row))
      .map(row=>supplementLabel(a,row).replace(' / C8',''));
    const replayLabel=replayBands.length
      ? `<div class="supplement-workload-label" data-workload="terminal-replay" role="note"><strong>${esc(replayBands.join(' · '))}</strong><span>${terminalReplayWorkloadLabel()}</span></div>`
      : '';
    return `<section id="context-tenant-supplement" data-source-release="${esc(entry.id)}"${cardComparisonAttribute(cards)}><div class="section-heading"><h2>${t('上下文与四租户补测','Context and four-tenant supplement')}</h2><button type="button" data-detail="supplement">${t('范围、窗口与原件','Scope, windows and evidence')} ↗</button></div>
      <p>${esc(a.report_date)} · ${esc(contextWorkloadLabel(a))} · ${esc(t('固定输出预算','Fixed output budget'))} ${a.protocol.output_tokens}</p>
      ${cards.cardLabel?`<p>${esc(cardComparisonLabel(cards))}</p>`:''}
      <div class="supplement-highlights"><div><span>${t(`16K 相对 ${control} 吞吐`,`16K throughput vs ${control}`)}</span><strong>${values[2]}</strong></div><div><span>${t('四租户成本降低','Four-tenant cost reduction')}</span><strong>${n(tenant?.equal_rate_same_card_count_unit_cost_reduction_percent)}%</strong></div><div><span>${t('四租户AI Core利用率','Four-tenant AI Core utilization')}</span><strong>${n(tenant?.B0.utilization.mean_percent)} → ${n(tenant?.B1.utilization.mean_percent)}%</strong></div></div>
      ${entry.r10_revision?replayLabel+r10StabilityWindows(entry):`<figure>${replayLabel}<div class="supplement-plot" tabindex="0" role="region" aria-label="${t('上下文与租户配对曲线，可横向滚动','Context and tenant paired curves; scroll horizontally')}"><img src="./${esc(a.chart.path)}" alt="${esc(contextWorkloadLabel(a))}" loading="lazy"></div><figcaption>${t('保留全部提交窗口、完整排空及租户分布；采样利用率与有效算力分别报告。','All submission windows, complete drain and tenant distributions are retained. Sampled utilization is separate from effective compute.')}</figcaption></figure>`}</section>`;
  }
  function r10StabilityWindows(entry) {
    const row=entry.context_tenant_supplement.comparisons.find(phase=>phase.phase==='32768-formal');
    const previous=entry.r10_revision.previous_b1_throughput_32k;
    const total=row.B1.metrics.output_tokens_per_second;
    const change=100*(total/previous-1);
    return `<div data-r10-stability-windows>${table(t(
      ['32K 窗口','B0 token/s','B1 token/s','B1 TTFT P95 / ms','B1 TTFT P99 / ms','B1 TPOT P95 / ms','B1 TPOT P99 / ms'],
      ['32K window','B0 token/s','B1 token/s','B1 TTFT P95 / ms','B1 TTFT P99 / ms','B1 TPOT P95 / ms','B1 TPOT P99 / ms']),
      row.B1.windows.map((window,i)=>[i+1,n(row.B0.windows[i].metrics.output_tokens_per_second),
        n(window.metrics.output_tokens_per_second),n(window.metrics.ttft_ms.p95),n(window.metrics.ttft_ms.p99),
        n(window.metrics.tpot_ms.p95),n(window.metrics.tpot_ms.p99)]))}
      <p>${t('32K 整段吞吐','Overall 32K throughput')} ${n(total)} token/s ·
      ${t('相对 2026.11.21.10','vs 2026.11.21.10')} ${n(change)}%</p></div>`;
  }
  function versionSupplementDetails(entry, contextRows) {
    const a=entry.context_tenant_supplement;
    if(!a)return /^r[1-9][0-9]*$/.test(entry.id)?fixedBaselineContext()+publishedContextTable(contextRows):null;
    const dataset=sealedContextWorkload(a.protocol.input_sha256)?.datasets.join(' · ')||contextWorkloadLabel(a);
    const rows=a.comparisons.map(row=>[[supplementLabel(a,row),cardComparisonLabel(cardComparison(row.B0.physical_cards,row.B1.physical_cards))].filter(Boolean).join(' · '),dataset,row.B0.metrics.requests+' / '+row.B1.metrics.requests,
      n(row.B0.metrics.output_tokens_per_second)+' / '+n(row.B1.metrics.output_tokens_per_second),
      n(row.throughput_ratio)+'×',n(row.B0.metrics.ttft_ms.p99)+' / '+n(row.B1.metrics.ttft_ms.p99),
      n(row.B0.metrics.tpot_ms.p99)+' / '+n(row.B1.metrics.tpot_ms.p99)]);
    const tenant=a.comparisons.find(row=>row.B1.tenants>1);
    return `<p>${esc(contextWorkloadLabel(a))} · ${a.protocol.task_count} ${t('份独立历史；重复窗口不是独立任务样本。','distinct histories; repeated windows are not independent task samples.')}</p>
      <p>${t('每阶段预热','Each phase warms up for')} ${a.protocol.phases[0].warmup_seconds}s · ${t('正式提交','formal submissions')} ${a.protocol.phases[0].formal_seconds}s ${t('后完整排空；吞吐分母包含排空。','plus complete drain, included in throughput duration.')} ${t('本专项不测任务质量或租户安全隔离，也不产生有效算力效率。','This supplement does not measure task quality, security isolation or effective-compute efficiency.')}</p>
      ${table(t(['工况','数据集来源','请求 B0 / B1','token/s B0 / B1','吞吐比','P99 TTFT ms B0 / B1','P99 TPOT ms B0 / B1'],['Scenario','Dataset source','Requests B0 / B1','tok/s B0 / B1','Throughput ratio','P99 TTFT ms B0 / B1','P99 TPOT ms B0 / B1']),rows)}
      ${tenant?table(t(['租户','B0 完成','B1 完成'],['Tenant','B0 completed','B1 completed']),Object.keys(tenant.B1.per_tenant).map(id=>[id,tenant.B0.per_tenant[id]?.successful??'—',tenant.B1.per_tenant[id].successful])):''}
      <p><a href="${esc(a.raw_asset.public_download?'./'+a.raw_asset.public_download.path:a.raw_asset.url)}">${t('全部窗口与复算入口','All windows and reproduction')} ↗</a><br><code>${esc(a.raw_asset.sha256)}</code></p>`;
  }
  function versionRows(entry) {
    const observations=observationRows(entry);
    if(observations.length)return observations;
    const rows=entry.measurements.map(row=>{
      const arms=Object.fromEntries(row.arms.map((arm,i)=>[i?'B1':'B0',{...arm,relative_cost_per_token:row.arms[0].output_tokens_per_second/arm.output_tokens_per_second}]));
      const changes_percent=Object.fromEntries(['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map(key=>[key,100*(arms.B1[key]/arms.B0[key]-1)]));
      const cards=cardComparison(row.arms[0].physical_cards,row.arms[1].physical_cards);
      return {id:row.id,label:row.label,arms,changes_percent,...cards,workloadLabel:cardComparisonLabel(cards)};
    });
    rows.push(...versionSupplementRows(entry));
    if(entry.id==='r8')for(const row of r8Rows())if(!rows.some(old=>old.id===row.id))rows.push({...row,label:row.id==='4096-formal'?'4K / C8':'16K / C8'});
    return rows.map(row=>continuousProfile(row.id)
      ?{...row,workloadKind:'continuous-synthetic',workloadLabel:[continuousWorkloadLabel(),row.workloadLabel].filter(Boolean).join(' · ')}
      :row);
  }
  function r6ArmRows(role) {
    return data.datasets.map(row=>{
      const arm=row.arms[role], quality=row.quality?.[role];
      const tracks=Object.values(quality?.tracks||{});
      const sum=key=>tracks.length&&tracks.every(track=>Number.isInteger(track[key]))
        ?tracks.reduce((total,track)=>total+track[key],0):undefined;
      return {id:row.id,label:row.title,model:data.hardware.model,observation:{
        ...arm,requests:arm.planned,correct:quality?.correct??sum('successes'),
        truncated:quality?.truncated_recorded??sum('solver_truncated'),
        unresolved:quality?.unparsed_recorded??sum('unresolved')??sum('judge_unresolved')
      }};
    });
  }
  function assertFormalBaselineIsolation(entry, rows) {
    if(entry.baseline_id!==releaseCatalog.baseline.id)throw Error('Formal comparison lost fixed B0 identity');
    const context=stableAssessment(entry)?.targets['4.3'].paired.comparison||entry.context_tenant_supplement?.comparisons||[];
    const ids=[...entry.measurements.map(row=>row.id),
      ...context.map(row=>'real-context-'+row.phase),
      ...(entry.id==='r8'&&currentR8?['4096-formal','16384-formal']:[])];
    const permitted=new Set(standardRows(ids.map(id=>({id,sourceRecord:true}))).filter(row=>row.sourceRecord).map(row=>row.id));
    if(rows.some(row=>row.arms&&!permitted.has(row.id)))throw Error('Development data cannot enter formal B0/B1 charts');
    for(const row of rows.filter(row=>row.baselineObservation)){
      const original=fixedBaseline.profiles.find(record=>record.id===row.id);
      if(row.arms||!original||row.baselineModel!==fixedBaseline.model||Object.keys(original.arm).some(key=>row.baselineObservation[key]!==original.arm[key])||row.baselineObservation.relative_cost_per_token!==1)throw Error('Fixed B0 observation differs from its verified original');
    }
    const integration=modelIntegrationResults.get(entry.id);
    const observed=new Map(standardRows((integration?.workloads||[]).map(row=>({id:row.id,sourceObservation:row.candidate}))).filter(row=>row.sourceObservation).map(row=>[row.id,row.sourceObservation]));
    for(const row of rows.filter(row=>row.observation)){
      const expected=observed.get(row.id);
      if(row.arms||!expected||row.model!==integration.candidate.model||Object.keys(expected).some(key=>row.observation[key]!==expected[key]))throw Error('Single-arm values must match the current candidate, never the historical reference');
    }

  }
  const versionRecordLabel = entry => entry.release_url.includes('/releases/tag/') ? `${entry.id} Release` : t(`${entry.id} 版本记录`,`${entry.id} version record`);
  function pinnedSource(url) {
    const prefix='https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/main/';
    return url.startsWith(prefix)?url.replace('/blob/main/','/blob/'+releasePublication.commit+'/'):url;
  }
  function sourceLabel(url) {
    if(url.includes('/r10-native-rms-'))return url.endsWith('summary.json')
      ?t('原生 RMS 修订汇总','Native RMS revision summary'):t('原生 RMS 修订报告','Native RMS revision report');
    if(url.includes('/r10-fixed-five-'))return t('原始 r10 五项及 C8 汇总','Original r10 fixed-five and C8 summary');
    return url.split('/').at(-1);
  }
  function measurementDetails(entry) {
    const columns=['ttft_p95_ms','ttft_p99_ms','tpot_p95_ms','tpot_p99_ms','end_to_end_p95_ms','end_to_end_p99_ms'];
    const rows=entry.measurements.flatMap(row=>row.arms.map(arm=>[
      row.label,arm.role,arm.physical_cards?.join(', ')||'—',fixedBaseline.model,arm.requests,arm.failed,
      n(arm.output_tokens_per_second),n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms),
      ...columns.map(key=>n(arm[key])),arm.source_completed_utc||'—',arm.source_seal_sha256||'—'
    ]));
    return {title:t('逐臂数值、尾时延与来源','Per-arm measurements, tails and sources'),body:
      `<p>${t('吞吐为双卡输出总吞吐。MMLU200 按 C200 一批提交，TTFT 从请求发出至首词元，包含等待。4K/16K C8 以固定时间发压并完整排空，两臂完成请求数可不同。','Throughput counts total output on two chips. MMLU200 submits a C200 batch; TTFT includes waiting after dispatch. Fixed-time 4K/16K C8 trials drain all requests, so arm counts may differ.')}</p>
      ${table([...t(['工况','运行臂','物理卡','模型','请求','失败'],['Scenario','Arm','Physical cards','Model','Requests','Failures']),
        'tok/s','TTFT mean / s','TPOT mean / ms','TTFT P95 / ms','TTFT P99 / ms','TPOT P95 / ms','TPOT P99 / ms','E2E P95 / ms','E2E P99 / ms',
        ...t(['来源完成时间 UTC','原始封存 SHA-256'],['Source completed UTC','Original seal SHA-256'])],rows)}
      <p><a href="./test-plan.html#profiles-${t('zh','en')}">${t('固定样本、并发及输出预算','Fixed samples, concurrency and output budgets')} ↗</a></p>`};
  }
  const rmsReport='reports/r10-native-rms-20261121/';
  const rmsDescriptor=(entry,file)=>entry.sources.find(source=>source.url.endsWith('/'+rmsReport+file));
  async function fetchBenchmarkReport(descriptor, websitePath, publication=releasePublication) {
    const prefix='https://github.com/'+publication.repository+'/blob/main/';
    if(descriptor.url!==prefix+websitePath.replace(/^data\//,'reports/')){
      throw Error('Unreviewed benchmark report source');
    }
    const binding=publication.files.filter(file=>file.website_path===websitePath);
    if(binding.length!==1||binding[0].bytes!==descriptor.bytes||binding[0].sha256!==descriptor.sha256){
      throw Error('Unbound candidate report');
    }
    const response=await fetch('./'+websitePath,{signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Candidate report unavailable');
    const raw=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(raw.byteLength!==descriptor.bytes||digest!==descriptor.sha256)throw Error('Candidate report checksum mismatch');
    return JSON.parse(new TextDecoder().decode(raw));
  }

  function candidateReports(entry) {
    const labels={
      'native-rms':t('原生 RMS 候选','Native RMS candidate'),
      'contiguous-restore':t('连续写回候选','Contiguous restore candidate')
    };
    return (entry.sources||[]).flatMap(summary=>{
      const match=summary.url.match(/\/reports\/(r[1-9][0-9]*-(native-rms|contiguous-restore)-fixed-five-\d+)\/summary\.json$/);
      if(!match)return [];
      const readme=entry.sources.find(source=>source.url===summary.url.replace(/summary\.json$/,'README.md'));
      return readme?[{kind:match[2],label:labels[match[2]],websitePath:'data/'+match[1]+'/summary.json',summary,readme}]:[];
    });
  }

  async function loadCandidateAssessment(entry, publication=releasePublication, baseline=releaseCatalog.baseline.id) {
    const asset=entry.candidate_submission_assessment;
    const bindings=publication.files.filter(file=>file.website_path===asset.path);
    if(!/^data\/[a-z0-9-]+\.json$/.test(asset.path)||bindings.length!==1||
       bindings[0].sha256!==asset.sha256||bindings[0].bytes!==asset.bytes){
      throw Error('Unbound candidate submission assessment');
    }
    const response=await fetch('./'+asset.path,{cache:'no-cache',signal:AbortSignal.timeout(12000)});
    const value=await readPublishedJson(publication,asset.path,response);
    if(value.schema!=='vllm-hust-candidate-v2-assessment/v1'||value.release_family!==entry.id||
       value.baseline_id!==baseline||!/^[a-f0-9]{40}$/.test(value.engine_revision)){
      throw Error('Candidate assessment identity mismatch');
    }
    return value;
  }

  async function loadStableAssessment(entry, publication, baseline) {
    const stable=entry.stable_evidence;
    const item=candidateReports(entry).find(candidate=>candidate.kind===stable.kind);
    const sha=value=>/^[a-f0-9]{64}$/.test(value||'');
    const wheels='https://github.com/vLLM-HUST/vllm-hust-website/releases/download/engine-wheels-'+entry.id+'-v1/';
    if(!item||entry.publication_status!=='stable'||stable.measured_release!==entry.release+'-'+stable.kind||
       !/^[a-f0-9]{40}$/.test(stable.engine_commit)||
       !['sdist_sha256','sdk_sha256','runtime_overlay_sha256','installed_files_canonical_sha256'].every(key=>sha(stable[key]))||
       !/^\d{4}\.\d{1,2}\.\d{1,2}\.\d+$/.test(stable.pypi_version)||
       stable.pypi_url!=='https://pypi.org/project/vllm-hust-engine/'+stable.pypi_version+'/'||
       stable.install_manifest_url!==wheels+entry.id+'-pip-requirements.txt'||
       stable.arm64_acceptance_url!==wheels+'arm64-clean-install.json'){
      throw Error('Invalid stable release evidence lock');
    }
    const [report,value]=await Promise.all([
      fetchBenchmarkReport(item.summary,item.websitePath,publication),
      loadCandidateAssessment(entry,publication,baseline)
    ]);
    const record=value.candidates?.[item.kind];
    if(report.schema!=='vllm-hust-r10-full-fixed-five-evidence/v1'||report.release!==stable.measured_release||
       report.baseline_id!==baseline||record?.targets?.['4.3']?.candidate_runtime?.runtime_overlay_sha256!==stable.runtime_overlay_sha256||
       entry.measurements.length!==Object.keys(report.measurements).length||
       !entry.measurements.every(row=>row.arms.every((arm,index)=>{
         const expected=report.measurements[row.id]?.[index===0?'B0':'candidate'];
         return expected&&Object.entries(expected).every(([key,expectedValue])=>key==='role'||
           JSON.stringify(arm[key])===JSON.stringify(expectedValue));
       }))){
      throw Error('Stable release measurements do not match the sealed trial');
    }
    candidateAssessment(item,report,value);
    stableAssessments.set(entry,{item,report,value,targets:record.targets});
  }

  function candidateAssessment(item, report, value, {target,rentalDisclosure=false}={}) {
    const record=value.candidates?.[item.kind], goals=['4.1','4.2','4.3','4.4'];
    const targets=record?.targets;
    const sha=hash=>/^[a-f0-9]{64}$/.test(hash||'');
    const prefix='https://github.com/DeepLinkNext/DeepLinkEngine/blob/'+value.engine_revision+'/evidence/';
    const sources=['compute_audit','original_evidence_audit','context_audit'].map(key=>record?.sources?.[key]);
    const fail=()=>{throw Error('Candidate assessment evidence does not match its fixed trial');};
    if(record?.selection?.release!==report.release||record.selection.baseline_id!==report.baseline_id||
       record.selection.status!=='candidate'||record.selection.version!==value.release_family+'-'+item.kind||
       record.fixed_five?.sha256!==item.summary.sha256||record.fixed_five?.bytes!==item.summary.bytes||
       !goals.every(id=>['milestone','final'].every(gate=>typeof targets?.[id]?.[gate]?.met==='boolean'))||
       !sources.every(source=>source?.url?.startsWith(prefix)&&sha(source.sha256)&&Number.isInteger(source.bytes)&&source.bytes>0))fail();

    const [compute,performance,context,cost]=goals.map(id=>targets[id]);
    const roles=['B0','B1'], native=compute.native, workload=context.baseline_context.workload;
    const phases=['4096-formal','16384-formal','32768-formal','multi-tenant-formal'];
    if(native.release!==report.release||native.baseline_id!==report.baseline_id||
       context.paired.comparison.map(row=>row.phase).join()!==phases.join()||
       !workload.datasets?.length||!workload.task_ids?.length||
       !roles.every(role=>sha(native.native_seals[role])&&native.arms[role].repetitions.length===3&&
         sha(context.paired.arm_seals[role])&&context.physical_cards[role]?.length===2))fail();
    const costAreas=[cost.mmlu_full_answers,cost.four_tenant],rent=cost.published_rental;
    if(cost.cost_basis!=='published_rental'||!/^https:\/\/[^\s]+$/.test(rent.source_url)||
       !roles.every((role,i)=>costAreas[0].arms[role].measurement_seal_sha256===
         report.measurements.mmlu[i===0?'B0':'candidate'].source_seal_sha256&&
         costAreas[1].arms[role].measurement_seal_sha256===context.paired.arm_seals[role]))fail();

    const status=gate=>gate.met?t('达成','Met'):t('未达成','Not met');
    const heading=(label,fields,rows)=>'<h4>'+esc(label)+'</h4>'+table(fields,rows);
    const ratio=value=>n(Number(value))+'×';
    const percent=value=>n(Number(value))+'%';
    const speedRows=fixedProfiles.map(([id])=>{
      const {B0,candidate}=report.measurements[id],row=performance.datasets[id];
      const ratios=row.ratios;
      const metrics={throughput_ratio:'output_tokens_per_second',ttft_ratio:'mean_ttft_ms',tpot_ratio:'mean_tpot_ms'};
      if(!record.datasets[id]||!Object.entries(metrics).every(([key,metric])=>
        close(Number(ratios[key]),candidate[metric]/B0[metric])))fail();
      const drop=row.quality?.drop_pp;
      const quality=drop==null?'—':typeof drop==='object'?
        Object.entries(drop).map(([track,value])=>track+' '+n(Number(value))).join(' / '):n(Number(drop));
      const dataset=t(record.datasets[id],record.datasets[id].replace(' 公开轨迹',' public traces'));
      return [dataset,...Object.keys(metrics).map(key=>ratio(ratios[key])),
        quality,status(row.milestone),status(row.final)];
    });
    const dataName=workload.datasets.join(' / ');
    const contextRows=context.paired.comparison.map((row,i)=>[dataName,
      ['4K / C8','16K / C8','32K / C8',t('4K / 四租户 C24','4K / four tenants C24')][i],
      ...roles.map(role=>n(row[role].metrics.output_tokens_per_second)),
      ...roles.map(role=>String(row[role].metrics.successful)),
      ...roles.map(role=>n(row[role].metrics.ttft_ms.p95)),...roles.map(role=>context.physical_cards[role].join(', '))]);
    const costRows=costAreas.map((area,i)=>[i===0?t('MMLU-Pro 200 完整回答','MMLU-Pro 200 full answers'):dataName+' · 4K / C24',
      ...roles.map(role=>n(Number(area.arms[role].cost_per_million_output_tokens_cny))),
      percent(area.unit_cost_reduction_percent),...roles.map(role=>percent(area.utilization[role].mean_percent))]);
    const sourceNames=t(['原生计时与算量','固定五项原件复算','上下文与四租户封存'],['Native timing and work','Fixed-profile source audit','Context and four-tenant seals']);
    const sections={
      '4.1':heading('4.1 · MMLU-Pro 200 / out256',
        t(['运行臂','物理卡','三轮计时 / 秒','有效算力下界 / TFLOP/s/卡','效率下界','原生封存 SHA-256'],
          ['Arm','Physical cards','Three runs / s','Effective lower / TFLOP/s/card','Efficiency lower','Native seal SHA-256']),
        roles.map(role=>[role,native.physical_cards[role].join(', '),
          native.arms[role].repetitions.map(run=>Number(run.T_seconds).toFixed(3)).join(' / '),
          n(Number(compute.achieved_tflops_per_card_lower[role])),percent(compute.efficiency_lower_percent[role]),native.native_seals[role]])),
      '4.2':heading(t('4.2 · 固定五项','4.2 · Five fixed profiles'),
        t(['数据集','吞吐 B1/B0','平均 TTFT B1/B0','平均 TPOT B1/B0','正确率降幅 / pp','里程碑','结题'],
          ['Dataset','Throughput B1/B0','Mean TTFT B1/B0','Mean TPOT B1/B0','Accuracy drop / pp','Milestone','Final']),speedRows),
      '4.3':heading(t('4.3 · 真实上下文与四租户','4.3 · Real context and four tenants'),
        t(['数据集','工况','B0 tok/s','B1 tok/s','B0 成功','B1 成功','B0 TTFT P95 / ms','B1 TTFT P95 / ms','B0 物理卡','B1 物理卡'],
          ['Dataset','Workload','B0 tok/s','B1 tok/s','B0 successes','B1 successes','B0 TTFT P95 / ms','B1 TTFT P95 / ms','B0 cards','B1 cards']),contextRows)+
      '<p>'+t('16K/4K 吞吐','16K/4K throughput')+' '+percent(Number(context.measured_ratios.throughput)*100)+
      ' · TTFT P95 '+ratio(context.measured_ratios.ttft_p95)+
      ' · '+t('32K 窗口最大/最小','32K window max/min')+
      ' · '+t('吞吐','Throughput')+' '+ratio(context.measured_window_ratios.throughput)+
      ' · TTFT P95/P99 '+ratio(context.measured_window_ratios.ttft_p95)+' / '+ratio(context.measured_window_ratios.ttft_p99)+
      ' · TPOT P95/P99 '+ratio(context.measured_window_ratios.tpot_p95)+' / '+ratio(context.measured_window_ratios.tpot_p99)+'</p>'+
      '<details><summary>'+t('任务 ID 与上下文封存','Task IDs and context seals')+'</summary><p>'+esc(workload.task_ids.join(' · '))+'</p>'+
      table(t(['运行臂','原始封存 SHA-256'],['Arm','Original seal SHA-256']),roles.map(role=>[role,context.paired.arm_seals[role]]))+'</details>',
      '4.4':heading(t('4.4 · 公开租金折算','4.4 · Published rental estimate'),
        t(['工况','B0 元/百万输出词元','B1 元/百万输出词元','成本降幅','B0 AI Core','B1 AI Core'],
          ['Workload','B0 CNY/million output tokens','B1 CNY/million output tokens','Cost reduction','B0 AI Core','B1 AI Core']),costRows)+
      '<p><a href="'+esc(rent.source_url)+'">'+esc(rent.publisher)+' ↗</a> · '+Number(rent.monthly_cost_per_card_cny).toLocaleString(t('zh-CN','en-US'))+' '+t('元/卡月','CNY/card-month')+'</p>'
    };
    if(rentalDisclosure)sections['4.4']='<details data-rental-cost open><summary>'+
      t('4.4 租金来源与单位成本','4.4 Rental source and unit cost')+'</summary>'+sections['4.4']+'</details>';
    const links='<p>'+sources.map((source,i)=>'<a href="'+esc(source.url)+'">'+esc(sourceNames[i])+' ↗</a>').join(' · ')+'</p>';
    if(target)return sections[target]+links;
    return '<p>'+esc(report.release)+' · '+esc(record.selection.model)+' · BF16 · TP2 · '+t('固定 0.18 B0','Fixed 0.18 B0')+'</p>'+
      table(t(['送测 V2','里程碑','结题'],['Submission V2','Milestone','Final']),
        goals.map((id,i)=>[id+' '+names()[i],status(targets[id].milestone),status(targets[id].final)]))+
      Object.values(sections).join('')+links;
  }


  function candidateReportPanels(entry) {
    return candidateReports(entry).map(item=>`<details class="comparison-revision" data-candidate-report="${esc(item.kind)}">
      <summary>${esc(entry.id+' · '+item.label)} · ${entry.candidate_submission_assessment?
        t('固定 0.18 B0 · V2 实测与判定','Fixed 0.18 B0 · V2 measurements and verdicts'):t('固定五项和两档 C8','Five fixed profiles and both C8 bands')}</summary>
      <p>${t('报告使用封存的固定 0.18 B0。各候选保留自己的评分和运行配置。','This report uses the sealed fixed 0.18 B0. Each candidate retains its own grades and configuration.')}</p>
      <p><a href="${esc(pinnedSource(item.readme.url))}">${t('完整报告与配置','Full report and configuration')} ↗</a> · <a href="${esc(pinnedSource(item.summary.url))}">JSON ↗</a></p>
      ${entry.candidate_submission_assessment?'<div data-candidate-v2 aria-live="polite"></div>':''}
      <div data-candidate-metrics aria-live="polite"></div>
    </details>`).join('');
  }

  function bindCandidateReports(entry) {
    let assessment;
    const labels={mmlu:'MMLU-Pro 200',hle:'HLE-Verified 200',frontier:'FrontierScience 160',
      swe:'SWE-bench Pro · 64 requests',terminal:'Terminal-Bench 2.1 · 48 requests',
      '4096-formal':t('4K / C8 · 合成请求','4K / C8 · Synthetic requests'),
      '16384-formal':t('16K / C8 · 合成请求','16K / C8 · Synthetic requests')};
    for(const item of candidateReports(entry)){
      const disclosure=root.querySelector(`[data-candidate-report="${item.kind}"]`);
      const panel=disclosure.querySelector('[data-candidate-metrics]');
      const v2Panel=disclosure.querySelector('[data-candidate-v2]');
      disclosure.addEventListener('toggle',async()=>{
        if(!disclosure.open||['loaded','loading'].includes(panel.dataset.state))return;
        panel.dataset.state='loading';
        panel.textContent=t('正在校验候选报告…','Verifying candidate report…');
        try{
          const report=await fetchBenchmarkReport(item.summary,item.websitePath);
          if(report.schema!=='vllm-hust-r10-full-fixed-five-evidence/v1'||
             report.baseline_id!==releaseCatalog.baseline.id||!report.release?.endsWith('-'+entry.id+'-'+item.kind)){
            throw Error('Candidate identity mismatch');
          }
          const pairIds=Object.keys(labels);
          const arms=item.kind==='contiguous-restore'?['B0','r10_original','native_rms','candidate']:['B0','r10_original','candidate'];
          if(!pairIds.every(id=>arms.every(role=>/^[a-f0-9]{64}$/.test(report.measurements?.[id]?.[role]?.source_seal_sha256||'')))){
            throw Error('Incomplete candidate measurements');
          }
          const names={B0:t('固定 B0','Fixed B0'),r10_original:t('原始 ','Original ')+entry.id,
            native_rms:t('原生 RMS 候选（已封存）','Native RMS candidate (archived)'),candidate:item.label};
          const rows=pairIds.flatMap(id=>arms.map(role=>{
            const arm=report.measurements[id][role];
            return [labels[id],names[role],arm.requests,arm.failed,arm.correct??'—',arm.unresolved??'—',
              n(arm.output_tokens_per_second),n(arm.mean_ttft_ms),n(arm.mean_tpot_ms),
              n(arm.ttft_p95_ms)+' / '+n(arm.ttft_p99_ms),n(arm.tpot_p95_ms)+' / '+n(arm.tpot_p99_ms),
              n(arm.end_to_end_p95_ms)+' / '+n(arm.end_to_end_p99_ms),
              arm.source_seal_sha256];
          }));
          const judgeRows=Object.entries(report.judges||{}).map(([id,judge])=>[
            id,judge.planned,judge.recorded,judge.unresolved_grades
          ]);
          panel.innerHTML='<p>'+esc(report.release)+' · '+esc(String(report.full_request_count_per_solver_arm))+' '+t('条固定请求 / 臂','fixed requests per arm')+'</p>'+
            table(t(['工况','运行臂','请求','失败','正确','未决','tok/s','平均 TTFT / ms','平均 TPOT / ms','TTFT P95/P99 / ms','TPOT P95/P99 / ms','端到端 P95/P99 / ms','封存 SHA-256'],
              ['Scenario','Arm','Requests','Failed','Correct','Unresolved','tok/s','Mean TTFT / ms','Mean TPOT / ms','TTFT P95/P99 / ms','TPOT P95/P99 / ms','E2E P95/P99 / ms','Seal SHA-256']),rows)+
            table(t(['裁判阶段','计划','已记录','未决'],['Judge phase','Planned','Recorded','Unresolved']),judgeRows);
          panel.dataset.state='loaded';
          if(v2Panel){
            try{
              assessment??=loadCandidateAssessment(entry);
              v2Panel.innerHTML=candidateAssessment(item,report,await assessment);
              v2Panel.dataset.state='loaded';
            }catch{
              v2Panel.dataset.state='unavailable';
              v2Panel.textContent=t('未能校验本版 V2 证据。','Could not verify V2 evidence for this candidate.');
            }
          }
        }catch{
          panel.dataset.state='unavailable';
          panel.textContent=t('未能校验候选汇总。可从上方入口查看该版原件。','The candidate summary could not be verified. Use the fixed report link above.');
        }
      });
    }
  }

  function rmsRevisionPanel(entry) {
    const source=rmsDescriptor(entry,'README.md');
    if(!source||!rmsDescriptor(entry,'summary.json'))return '';
    return `<details class="comparison-revision" id="rms-revision"><summary>${t('r10 原生 RMS 修订 · 独立四项实测','r10 native RMS revision · four separate measurements')}</summary>
      <p>${t('修订版复查 HLE、FrontierScience、4K/C8 和 16K/C8，HLE 与 Frontier 使用修订版共同裁判。此处保留早期四项复查。两份完整固定五项与 C8 结果见候选报告。','The revision tested HLE, FrontierScience, 4K/C8 and 16K/C8. HLE and Frontier use the revised common judge. This table preserves the early four-profile review. The candidate reports contain both complete fixed-five and C8 evaluations.')}</p>
      <p><a href="${esc(pinnedSource(source.url))}">${t('修订报告、组件证据与复算数据','Revision report, component evidence and recomputation data')} ↗</a></p>
      <div class="rms-revision-metrics" aria-live="polite"></div>
    </details>`;
  }
  async function fetchRmsRevision(entry) {
    const descriptor=rmsDescriptor(entry,'summary.json');
    const report=await fetchBenchmarkReport(descriptor,rmsReport.replace(/^reports\//,'data/')+'summary.json');
    if(report.schema!=='vllm-hust-r10-native-rms-evidence/v1'||report.original_release!==(entry.original_candidate_release||entry.release)||
       report.baseline_id!==releaseCatalog.baseline.id)throw Error('Revision identity mismatch');
    return report;
  }
  function bindRmsRevision(entry) {
    const disclosure=root.querySelector('#rms-revision');
    const panel=disclosure.querySelector('.rms-revision-metrics');
    disclosure.addEventListener('toggle',async()=>{
      if(!disclosure.open||panel.dataset.state==='loaded'||panel.dataset.state==='loading')return;
      panel.dataset.state='loading';
      panel.textContent=t('正在校验修订版实测…','Verifying revision measurements…');
      try{
        const report=await fetchRmsRevision(entry);
        const profiles=[['HLE200',report.priority_pair.scope.hle],['Frontier160',report.priority_pair.scope.frontier],
          ['4K / C8',report.C8['4096-formal']],['16K / C8',report.C8['16384-formal']]];
        const labels={B0:t('固定 B0（修订版裁判）','Fixed B0 (revised judge)'),r10_original:t('原始 r10','Original r10'),r10_corrected:t('原生 RMS 修订','Native RMS revision')};
        panel.innerHTML=table(t(['工况','运行臂','请求','正确','未决','tok/s','TTFT P95/P99 · ms','E2E P95/P99 · ms'],
          ['Scenario','Arm','Requests','Correct','Unresolved','tok/s','TTFT P95/P99 · ms','E2E P95/P99 · ms']),
          profiles.flatMap(([label,arms])=>Object.entries(labels).map(([role,name])=>{
            const arm=arms[role];
            return [label,role==='B0'&&!Number.isInteger(arm.correct)?'B0':name,arm.requests,arm.correct??'—',arm.unresolved??'—',
              n(arm.output_tokens_per_second),n(arm.ttft_p95_ms)+' / '+n(arm.ttft_p99_ms),n(arm.end_to_end_p95_ms)+' / '+n(arm.end_to_end_p99_ms)];
          })))+`<p>${t('修订版优先发布验收','Revision promotion gate')} · ${report.priority_pair.gate_passed?t('通过','Passed'):t('未通过','Not passed')}</p>`;
        panel.dataset.state='loaded';
      }catch{
        panel.dataset.state='unavailable';
        panel.textContent=t('网页暂时无法读取或核验汇总，可打开上方固定版本报告。','This page could not verify the summary. Open the pinned revision report above.');
      }
    });
  }
  function versionDetails(entry, rows, key, attempt) {
    if(key==='development')return modelIntegrationDetails(entry);
    if(key==='arm-metrics')return measurementDetails(entry);
    const roles=comparisonRoles(entry);
    const title={compute:t('有效算力参考','Compute reference'),configuration:t('冻结配置与MOD','Configuration and MODs'),methods:t('计算公式与比较方式','Formulas and comparison'),metrics:t('完整数值','Complete metrics'),quality:t('质量与评分明细','Quality and grading'),evidence:t('原始证据','Original evidence'),supplement:t('上下文与四租户补测','Context and four-tenant supplement')}[key];
    if(attempt&&key==='compute')return {title,body:fixedBaselineCompute()};
    if(attempt&&key==='supplement')return {title,body:fixedBaselineContext()};
    if(attempt&&key!=='metrics')return {title,body:`<p>${esc(t(entry.reason_zh,entry.reason_en))}</p><p>${esc(entry.run)}</p><p>${t('r1–r3为冻结r4前同批实验的尝试编号；本次未形成完整配对报告。','r1–r3 identify attempts preceding frozen r4; this attempt did not produce a complete paired report.')}</p><p><a href="${esc(entry.source.url)}">${t('全部尝试及退出回执','All attempts and exit receipts')} ↗</a></p><code>${esc(entry.source.sha256)}</code>`};
    const stable=stableAssessment(entry);
    if(stable&&['compute','supplement'].includes(key))return {title,body:
      candidateAssessment(stable.item,stable.report,stable.value,{target:key==='compute'?'4.1':'4.3'})};
    if(key==='compute')return {title,body:versionComputeReferenceDetails(entry)};
    if(key==='supplement')return {title,body:versionSupplementDetails(entry,rows)||`<p>${t('本版已发布的连续负载仅在图中列出实测档位。尚缺32K及四租户的完整补测数据；不从其他版本迁入成绩。','Published continuous-load measurements cover the plotted context bands. Complete 32K and four-tenant supplement data are missing for this version; scores are not transferred from another version.')}</p>`};
    if(key==='configuration')return {title,body:`<p>${esc(entry.release)}</p><div class="mod-tags">${entry.mods.map(name=>`<span>${esc(name)}</span>`).join('')}</div><p>E${entry.settings.E}/R${entry.settings.R} · MTP${entry.settings.MTP} · ${entry.settings.graph} · State${entry.settings.state_gib_per_rank}GiB/rank · KV${entry.settings.kv_gib_per_rank}GiB/rank</p><a href="${esc(entry.profile.url)}">${t('冻结版本与MOD配置','Frozen version and MOD configuration')} ↗</a>`};
    if(key==='methods'&&singleArmObservation(entry))return {title,body:`<p>${t('B1书生三组单臂记录：MMLU200保留8192输出预算；4K/C8、16K/C8各预热60秒、正式提交300秒并排空，输出256。吞吐为输出token数除以含排空的批次秒数；TTFT、TPOT为逐请求均值。固定B0的配对结果单独核验。','Three B1 Intern-S2 single-arm records: MMLU200 retains its8192 output budget;4K/C8 and16K/C8 use60s warmup,300s formal submissions plus drain and256 outputs. Throughput divides output tokens by batch seconds including drain; TTFT and TPOT are request means. Fixed-B0 paired results are audited separately.')}</p>`};
    if(key==='methods')return {title,body:`<p>${esc(t(entry.method_zh||'方法见本版原件',entry.method_en||'See this version’s originals for its protocol'))}</p><dl class="method-list"><dt>${t('吞吐','Throughput')}</dt><dd>${t('完成输出token / 包含排空的批次秒数','Output tokens / batch seconds including drain')}</dd><dt>TTFT / TPOT</dt><dd>${t('逐请求均值；历史预热和输出预算保持原样。','Request means; original warmup and output budgets retained.')}</dd><dt>${t('同费率成本','Equal-rate cost')}</dt><dd>${t(`相同费率与卡数下，单位token成本比 = ${roles.B0}吞吐 / ${roles.B1}吞吐；${roles.B0} = 1。`,`At equal rates and device counts, unit token cost ratio = ${roles.B0} throughput / ${roles.B1} throughput; ${roles.B0} = 1.`)}</dd></dl>`};
    if(key==='metrics'&&rows.some(row=>row.baselineObservation))return {title,body:table(t(['工况','运行臂','模型','请求数','token/s','TTFT / s','TPOT / ms'],['Scenario','Arm','Model','Requests','token/s','TTFT / s','TPOT / ms']),rows.flatMap(row=>{const arms=row.arms?[['B0',row.arms.B0,fixedBaseline.model],['B1',row.arms.B1,fixedBaseline.model]]:[['B0',row.baselineObservation,row.baselineModel],['B1 '+entry.id,row.observation,row.model]];return arms.filter(([,arm])=>arm).map(([role,arm,model])=>[row.label,role,model,arm.requests,n(arm.output_tokens_per_second),n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms)]);}))+`<p><a href="./${esc(releaseCatalog.baseline.observations.path)}">${t('固定 B0 原值、工况与封存来源','Fixed B0 values, workloads and sealed sources')}</a></p>`};
    if(key==='metrics'&&!rows.some(row=>row.arms||row.observation))return {title,body:`<p>${esc(t(entry.scope_zh,entry.scope_en))}</p>`};
    if(key==='metrics'&&rows.some(row=>row.observation))return {title,body:table(t(['工况','版本','请求数','token/s','TTFT / s','TPOT / ms'],['Scenario','Arm','Requests','token/s','TTFT / s','TPOT / ms']),rows.filter(row=>row.observation).map(row=>[row.label,'B1 '+entry.id+' · '+row.model,row.observation.requests,n(row.observation.output_tokens_per_second),n(row.observation.mean_ttft_ms/1000),n(row.observation.mean_tpot_ms)]))};
    if(key==='metrics')return {title,body:['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map((field,i)=>`<h3>${[t('吞吐 · token/s','Throughput · token/s'),'TTFT · s','TPOT · ms',t(`同费率成本 · ${roles.B0} = 1`,`Equal-rate cost · ${roles.B0} = 1`)][i]}</h3>${table(t(['场景',roles.B0,roles.B1,'变化'],['Scenario',roles.B0,roles.B1,'Change']),rows.map(row=>[row.label,row.arms?n(row.arms.B0[field]/(i===1?1000:1)):'—',row.arms?n(row.arms.B1[field]/(i===1?1000:1)):'—',row.arms?n(row.changes_percent[field])+'%':'—']))}`).join('')};
    if(key==='quality'&&rows.some(row=>row.baselineObservation)){const historical=entry.quality?`<p class="historical-quality">MMLU200 · ${entry.quality.correct}/${entry.quality.requests} ${t('正确','correct')} · ${t('原开发筛选线','Original development screen')} ${entry.quality.historical_screen_minimum}/${entry.quality.requests} · ${entry.quality.historical_screen_passed?t('通过','Passed'):t('未通过','Not passed')}</p>`:'';const measured=rows.flatMap(row=>(row.arms?[['B0',row.arms.B0,fixedBaseline.model],['B1 '+entry.id,row.arms.B1,fixedBaseline.model]]:[['B0',row.baselineObservation,row.baselineModel],['B1 '+entry.id,row.observation,row.model]]).filter(([,arm])=>Number.isInteger(arm?.correct)).map(([role,arm,model])=>[row.label,role,model,`${arm.correct}/${arm.requests}`,arm.truncated,`${arm.failed??'—'} / ${arm.unparsed??'—'}`,arm.unresolved??arm.unparsed??'—']));return {title,body:table(t(['工况','运行臂','模型','正确 / 总数','长度终止','失败 / 未解析','未判定'],['Scenario','Arm','Model','Correct / total','Length stops','Failed / unparsed','Unresolved']),measured)+historical+`<p>${t('沿用各次原始评分与裁判来源，见原件。','Original grading and judge provenance are retained in the sources.')}</p>`};}
    if(key==='quality'){
      const quality=entry.quality;
      const qualityView=quality?`<p class="historical-quality">MMLU200 · ${quality.correct}/${quality.requests} ${t('正确','correct')} · ${t('原开发筛选线','Original development screen')} ${quality.historical_screen_minimum}/${quality.requests} · ${quality.historical_screen_passed?t('通过','Passed'):t('未通过','Not passed')}</p>`:'';
      const measured=rows.filter(row=>Number.isInteger(row.observation?.correct));
      if(measured.length)return {title,body:table(t(['工况','版本','正确 / 总数','长度终止','失败 / 未解析'],['Scenario','Arm','Correct / total','Length stops','Failed / unparsed']),measured.map(row=>[row.label,'B1 '+entry.id+' · '+row.model,`${row.observation.correct}/${row.observation.requests}`,row.observation.truncated,`${row.observation.failed} / ${row.observation.unparsed}`]))};
      const qualityRows=rows.filter(row=>row.arms).flatMap(row=>['B0','B1'].filter(role=>Number.isInteger(row.arms[role].correct)).map(role=>[row.label,role==='B1'?entry.id:roles.B0,`${row.arms[role].correct}/${row.arms[role].requests}`,row.arms[role].truncated,row.arms[role].unresolved??row.arms[role].unparsed??'—']));
      return {title,body:(entry.quality_note_zh&&(!entry.model_integration||entry.measurements.length)?`<p>${esc(t(entry.quality_note_zh,entry.quality_note_en))}</p>`:'')+qualityView+(qualityRows.length?table(t(['场景','版本','正确','长度终止','未判定'],['Scenario','Version','Correct','Length stops','Unresolved']),qualityRows):`<p>${t('本页已发布场景没有配对质量成绩。','The published scenarios have no paired quality scores.')}</p>`)};
    }
    const development=entry.development_measurements||[];
    const developmentRows=development.flatMap(row=>row.arms.map(arm=>[row.label,arm.role,n(arm.output_tokens_per_second),n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms),n(arm.ttft_p95_ms)]));
    const measuredTails=entry.measurements.flatMap(row=>row.arms.filter(arm=>Number.isFinite(arm.ttft_p95_ms)).map(arm=>[row.label,arm.role,n(arm.ttft_p95_ms),n(arm.ttft_p99_ms)]));
    const tails=measuredTails;
    const baselineEvidence=fixedBaseline?`<h3>${t('固定 B0 原始记录','Fixed B0 original observations')}</h3><p>${esc(fixedBaseline.model)} · ${t('来源报告完成时间','Source report completed')} ${esc(fixedBaseline.source_report_completed_utc)} · <a href="./${esc(releaseCatalog.baseline.observations.path)}">${t('五项原值、原始算力分母与逐臂封存来源','Five original profiles, compute denominator and arm seals')}</a></p>`:'';
    return {title,body:`${baselineEvidence}<p>${esc(t(entry.scope_zh,entry.scope_en))}</p><p>${esc(t(entry.method_zh||'',entry.method_en||''))}</p>${tails.length?table(t(['场景','版本','P95 TTFT / ms','P99 TTFT / ms'],['Scenario','Version','P95 TTFT / ms','P99 TTFT / ms']),tails):''}${developmentRows.length?`<h3>${t('开发对照 · B1 r6 → B1 r7','Development comparison · B1 r6 → B1 r7')}</h3>${table(t(['场景','版本','token/s','TTFT / s','TPOT / ms','P95 TTFT / ms'],['Scenario','Version','token/s','TTFT / s','TPOT / ms','P95 TTFT / ms']),developmentRows)}`:''}<p><a href="${esc(entry.release_url)}">${versionRecordLabel(entry)} ↗</a> · <a href="${esc(entry.profile.url)}">${t('冻结版本与MOD配置','Frozen version and MOD configuration')} ↗</a>${entry.sources.map(source=>` · <a href="${esc(pinnedSource(source.url))}">${esc(sourceLabel(source.url))} ↗</a>`).join('')}${entry.model_integration?` · <a data-development-evidence href="${esc(entry.release_url)}">${t('模型集成开发记录','Model integration development records')} ↗</a>`:''}</p>${entry.id==='r8'?r8Details('evidence').body:''}`};
  }
  const controllerResultsPath = 'data/controller-product-results-v1.json';
  const controllerLatencyPath = 'data/controller-r8-latency-v1.json';
  const controllerContextPath = 'data/controller-r8-context-tenant-v1.json';
  const controllerHeavyLoadRepeatPath = 'data/controller-r8-heavy-load-repeat-v1.json';
  const controllerUtilizationPath = 'data/controller-r8-ai-core-utilization-v1.json';
  const controllerName = () => t('请求限流控制器','Request Throttling Controller');
  let controllerResults;

  async function loadControllerResults() {
    if(controllerResults)return;
    const [meta,response]=await Promise.all([fetch('./data/benchmark-source-manifest.json',{cache:'no-cache'}),fetch('./'+controllerResultsPath,{cache:'no-cache'})]);
    if(!meta.ok||!response.ok)throw Error('Controller results unavailable');
    const publication=await meta.json();
    if(publication.repository!=='vLLM-HUST/vllm-hust-benchmark'||publication.status!=='published-source'||!/^[a-f0-9]{40}$/.test(publication.commit))throw Error('Invalid controller results publisher');
    const value=await readPublishedJson(publication,controllerResultsPath,response);
    if(value.schema!=='controller-product-results/v1'||!Array.isArray(value.releases))throw Error('Invalid controller results');
    const results=new Map();
    for(const entry of value.releases){
      if(!/^r[1-9][0-9]*$/.test(entry.id)||results.has(entry.id))throw Error('Ambiguous controller engine version');
      validateControllerPair(entry);
      results.set(entry.id,{entry,commit:publication.commit,latency:null,context:null,repeat:null,fixed:null,compute:null,streaming:null,c8:null,utilization:null});
    }
    const r8=results.get('r8');
    if(r8)[r8.latency,r8.context,r8.repeat,r8.fixed,r8.compute,r8.nativeCompute,r8.streaming,r8.c8,r8.utilization]=await Promise.all([
      loadControllerLatency(publication,r8.entry).catch(error=>{
        console.warn('Controller latency supplement rejected',error);
        return null;
      }),
      loadControllerContext(publication,r8.entry).catch(error=>{
        console.warn('Controller context supplement rejected',error);
        return null;
      }),
      loadControllerHeavyLoadRepeat(publication,r8.entry).catch(error=>{
        console.warn('Controller repeat supplement rejected',error);
        return null;
      }),
      loadControllerFixedProfiles(publication,r8.entry).catch(error=>{
        console.warn('Controller fixed-profile supplement rejected',error);
        return null;
      }),
      loadControllerCompute(publication,r8.entry).catch(error=>{
        console.warn('Controller service compute supplement rejected',error);
        return null;
      }),
      loadControllerNativeCompute(publication,r8.entry).catch(error=>{
        console.warn('Controller native compute supplement rejected',error);
        return null;
      }),
      loadControllerTimingSupplement(publication,r8.entry,controllerStreamingPath).catch(error=>{
        console.warn('Controller streamed heavy-load supplement rejected',error);
        return null;
      }),
      loadControllerTimingSupplement(publication,r8.entry,controllerC8Path).catch(error=>{
        console.warn('Controller C8 supplement rejected',error);
        return null;
      }),
      loadControllerUtilization(publication,r8.entry).catch(error=>{
        console.warn('Controller utilization supplement rejected',error);
        return null;
      })
    ]);
    controllerResults=results;
  }

  function validateControllerPair(entry) {
    const result=entry.result, a=result.direct, b=result.request_throttling_controller;
    const positive=x=>Number.isFinite(x)&&x>0;
    if(entry.repetitions_per_arm!==1||entry.engine_release?.split('-').pop()!==entry.id||!/^reports\/controller-[a-z0-9-]+\/README[.]md$/.test(entry.report_path)
       ||!result.completed_pair||[a,b].some(arm=>!positive(arm.elapsed_seconds)||!positive(arm.output_tokens)||arm.completed_tasks!==arm.tasks||!positive(arm.successful_requests)||arm.failed_requests!==0
          ||!Number.isFinite(arm.cached_input_percent)||arm.cached_input_percent<0||arm.cached_input_percent>100)
       ||a.successful_requests!==b.successful_requests||a.input_tokens!==b.input_tokens||a.output_tokens!==b.output_tokens
       ||!close(result.time_reduction_percent,100*(1-b.elapsed_seconds/a.elapsed_seconds)))throw Error('Invalid controller special release pair');
    if(entry.profiles?.map(p=>p.id).join()!==fixedProfiles.map(([id])=>id).join())throw Error('Unexpected controller profile coverage');
    for(const p of entry.profiles){
      if(p.status==='deferred'||p.status==='not_run')continue;
      if(p.status!=='complete'||!p.same_client_request_bodies||!p.same_per_case_engine_prompt_tokens
         ||[p.direct,p.controller].some(arm=>!positive(arm.elapsed_seconds)||!positive(arm.planned)||arm.successful!==arm.planned
           ||arm.release_errors!==0||!positive(arm.time_to_first_content_seconds?.mean)||!close(arm.output_tokens/arm.elapsed_seconds,arm.output_tokens_per_second))
         ||p.direct.planned!==p.controller.planned
         ||!close(p.time_reduction_percent,100*(1-p.controller.elapsed_seconds/p.direct.elapsed_seconds))
         ||!close(p.output_token_change_percent,100*(p.controller.output_tokens/p.direct.output_tokens-1)))throw Error('Invalid controller profile pair');
    }
  }

  async function loadControllerLatency(publication,entry) {
    if(!publication.files.some(file=>file.website_path===controllerLatencyPath))return null;
    const response=await fetch('./'+controllerLatencyPath,{cache:'no-cache'});
    const value=await readPublishedJson(publication,controllerLatencyPath,response);
    const positive=x=>Number.isFinite(x)&&x>0;
    if(value.schema!=='controller-r8-latency/v1'||value.engine_release!==entry.engine_release||value.report_path!==entry.report_path||!/^[a-f0-9]{40}$/.test(value.report_revision))
      throw Error('Unmatched controller latency supplement');
    const profiles=entry.profiles.filter(p=>p.status==='complete');
    for(const arm of ['direct','controller']){
      const client=value.fixed_profiles_client?.[arm];
      if(!client||Object.keys(client).length!==profiles.length||profiles.some(p=>client[p.id]?.requests!==p[arm].successful||!positive(client[p.id]?.mean_tpot_ms)))
        throw Error('Incomplete client latency coverage');
      const engine=value.multi_turn_engine?.[arm];
      const pair=entry.result[arm==='direct'?'direct':'request_throttling_controller'];
      if(engine?.requests!==pair.successful_requests||!['mean_e2e_ms','mean_ttft_ms','mean_tpot_ms'].every(key=>positive(engine[key])))
        throw Error('Incomplete multi-turn engine latency coverage');
    }
    return value;
  }

  async function loadControllerContext(publication,entry) {
    if(!publication.files.some(file=>file.website_path===controllerContextPath))return null;
    const response=await fetch('./'+controllerContextPath,{cache:'no-cache'});
    const value=await readPublishedJson(publication,controllerContextPath,response);
    const expected=[['4096',8,1],['16384',8,1],['32768',8,1],['multi-tenant',24,4]];
    const completeLatency=row=>['mean','p95','p99'].every(key=>Number.isFinite(row?.[key])&&row[key]>0);
    if(value.schema!=='controller-context-tenant-pair/v1'||value.engine_release!==entry.engine_release
       ||value.max_num_seqs!==entry.max_num_seqs||value.state_resident_seats!==entry.state_resident_seats
       ||!/^[a-f0-9]{64}$/.test(value.input_sha256)||value.phases?.length!==expected.length)
      throw Error('Unmatched controller context supplement');
    for(const [index,[id,concurrency,tenants]] of expected.entries()){
      const phase=value.phases[index];
      if(phase.id!==id||phase.concurrency!==concurrency||phase.tenants!==tenants)
        throw Error('Unexpected controller context workload');
      for(const arm of [phase.direct,phase.controller]){
        const m=arm?.metrics;
        if(!m||!Number.isInteger(m.successful)||m.successful<concurrency||m.requests!==m.successful||m.failed!==0
           ||m.duration_seconds<300||m.output_tokens!==m.successful*256
           ||!close(m.output_tokens/m.duration_seconds,m.output_tokens_per_second)
           ||!completeLatency(m.ttft_ms)||!completeLatency(m.tpot_ms)
           ||(arm.sampled_aicore_mean_percent!==null&&(!Number.isFinite(arm.sampled_aicore_mean_percent)||arm.sampled_aicore_mean_percent<0||arm.sampled_aicore_mean_percent>100))
           ||Object.keys(arm.per_tenant||{}).length!==tenants
           ||Array.from({length:tenants},(_,i)=>arm.per_tenant?.['tenant-'+i]).some(row=>
             !row||!Number.isInteger(row.successful)||row.successful<1||!Number.isFinite(row.output_tokens_per_second)||row.output_tokens_per_second<=0)
           ||!/^[a-f0-9]{64}$/.test(arm.execution_sha256))
          throw Error('Incomplete controller context measurements');
      }
    }
    return value;
  }

  async function loadControllerHeavyLoadRepeat(publication,entry) {
    if(!publication.files.some(file=>file.website_path===controllerHeavyLoadRepeatPath))return null;
    const response=await fetch('./'+controllerHeavyLoadRepeatPath,{cache:'no-cache'});
    const value=await readPublishedJson(publication,controllerHeavyLoadRepeatPath,response);
    const source=entry.result.direct;
    if(value.schema!=='controller-r8-heavy-load-repeat/v1'||value.engine_release!==entry.engine_release||
      value.program_state_residency!==entry.state_resident_seats||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||
      !/^reports\/controller-r8-[0-9]{8}-repeat\/README\.md$/.test(value.report_path)||
      !/^[a-f0-9]{64}$/.test(value.report_pair_sha256))throw Error('Unmatched SWE Trace Heavy Load repeat');
    for(const arm of [value.direct,value.controller]){
      if(arm?.programs!==source.completed_tasks||arm.requests!==source.successful_requests||
        arm.input_tokens!==source.input_tokens||arm.output_tokens!==source.output_tokens||
        !Number.isFinite(arm.elapsed_seconds)||arm.elapsed_seconds<=0||
        !close(arm.output_tokens_per_second,arm.output_tokens/arm.elapsed_seconds)||
        !Number.isFinite(arm.cached_input_percent)||arm.cached_input_percent<0||arm.cached_input_percent>100)
        throw Error('Incomplete SWE Trace Heavy Load repeat');
    }
    return value;
  }

  async function loadControllerUtilization(publication,entry) {
    if(!publication.files.some(file=>file.website_path===controllerUtilizationPath))return null;
    const response=await fetch('./'+controllerUtilizationPath,{cache:'no-cache'});
    const value=await readPublishedJson(publication,controllerUtilizationPath,response);
    const expected=[...fixedProfiles.map(([id])=>id),'swe-heavy','4096-formal','16384-formal'].sort().join();
    if(value.schema!=='controller-r8-ai-core-utilization/v1'||value.engine_release!==entry.engine_release||
      value.state_resident_seats!==entry.state_resident_seats||Object.keys(value.rows||{}).sort().join()!==expected)
      throw Error('Invalid accelerator utilization scope');
    const bounded=percent=>Number.isFinite(percent)&&percent>=0&&percent<=100;
    for(const pair of Object.values(value.rows)){
      for(const side of ['direct','controller']){
        const arm=pair[side],cards=Object.values(arm?.cards||{});
        if(cards.length!==2||!Number.isFinite(arm.window_start_wall)||!(arm.window_end_wall>arm.window_start_wall)||
          cards.some(card=>!Number.isFinite(card.unobserved_seconds)||card.unobserved_seconds<0)||
          arm.coverage_complete!==cards.every(card=>card.unobserved_seconds<.001)||
          (arm.coverage_complete ? !bounded(arm.mean_percent)||cards.some(card=>!bounded(card.mean_percent))||
            !close(arm.mean_percent,(cards[0].mean_percent+cards[1].mean_percent)/2) : arm.mean_percent!==null))
          throw Error('Invalid accelerator utilization observation');
      }
    }
    return value;
  }

  function renderControllerPanel() {
    root.querySelector('#controller-comparison')?.remove();
    if(!selectedController)return;
    const selector=root.querySelector('.release-selector');
    if(!selector)return;
    const panel=document.createElement('section');
    panel.id='controller-comparison';
    panel.setAttribute('aria-labelledby','controller-comparison-title');
    selector.after(panel);
    const heading=`<h2 id="controller-comparison-title">${t('控制面实测','Control plane measurements')} · ${controllerName()}</h2>`;
    const pair=controllerResults?.get(selectedRelease);
    if(!pair){
      const message=controllerResults
        ?t(`B1 ${selectedRelease} 暂无这款控制器的配对实测。`,`No published pair for this controller on B1 ${selectedRelease}.`)
        :t('控制面实测数据加载或校验失败。','Control plane measurements unavailable or verification failed.');
      panel.innerHTML=heading+`<p>${esc(message)}</p>`;
      return;
    }
    const {entry,commit,latency,context,repeat,fixed,compute,nativeCompute,streaming,c8,utilization}=pair;
    const profiles=fixed?fixed.profiles.map((row,index)=>({...row,label:entry.profiles[index].label})):entry.profiles;
    const a=entry.result.direct,b=entry.result.request_throttling_controller;
    const roles={B0:t(`B1 ${entry.id} 直连`,`B1 ${entry.id} direct`),B1:controllerName()};
    const pairedMetrics=(direct,controller)=>{
      const arms={
        B0:{...direct,relative_cost_per_token:1},
        B1:{...controller,relative_cost_per_token:direct.output_tokens_per_second/controller.output_tokens_per_second}
      };
      return {arms,changes_percent:Object.fromEntries(Object.keys(arms.B0)
        .map(key=>[key,100*(arms.B1[key]/arms.B0[key]-1)]))};
    };
    const rows=standardRows(profiles.map(p=>{
      if(p.status!=='complete')return {id:p.id,missingReason:t(p.reason_zh,p.reason_en)};
      const metrics=['direct','controller'].map(role=>{
        const arm=p[role];
        return {output_tokens_per_second:arm.output_tokens_per_second,
          mean_ttft_ms:1000*(fixed?arm.time_to_first_output_seconds:arm.time_to_first_content_seconds).mean,
          ...(fixed?{mean_tpot_ms:arm.time_per_output_token_ms.mean}
            :latency?{mean_tpot_ms:latency.fixed_profiles_client[role][p.id].mean_tpot_ms}:{})
        };
      });
      return {id:p.id,...pairedMetrics(...metrics)};
    }));
    const contextWorkload=sealedContextWorkload(context?.input_sha256);
    const contextDataset=contextWorkload?.datasets.join(' / ')||t('数据集身份待核验','Dataset identity pending verification');
    const contextRows=(context?.phases||[]).map(phase=>{
      const labels={4096:'4K–8K / C8',16384:'16K–24K / C8',32768:'32K–48K / C8',
        'multi-tenant':t('四租户 / C24','Four tenants / C24')};
      const metrics=[phase.direct,phase.controller].map(arm=>({
        output_tokens_per_second:arm.metrics.output_tokens_per_second,
        p99_ttft_ms:arm.metrics.ttft_ms.p99,
        p99_tpot_ms:arm.metrics.tpot_ms.p99,
        aicore_percent:arm.sampled_aicore_mean_percent
      }));
      return {id:phase.id,label:labels[phase.id]+' · '+contextDataset,...pairedMetrics(...metrics)};
    });
    const contextSection=()=>{
      if(!contextRows.length)return '';
      const labels=contextRows.map(row=>row.label);
      const charts=[
        ['output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s'],
        ['p99_ttft_ms',t('首 token 时延 P99 ↓','Time to first token P99 ↓'),'ms'],
        ['p99_tpot_ms',t('逐 token 时延 P99 ↓','Time per output token P99 ↓'),'ms'],
        ['relative_cost_per_token',t('单位输出 token 加速卡成本估算 ↓','Estimated accelerator cost per output token ↓'),t('直连 = 1','Direct = 1')]
      ];
      const tenants=context.phases.find(phase=>phase.id==='multi-tenant');
      const tenantRows=Object.entries(tenants.direct.per_tenant).map(([name,direct])=>{
        const controller=tenants.controller.per_tenant[name];
        return [name,direct.successful,controller.successful,n(direct.output_tokens_per_second),n(controller.output_tokens_per_second)];
      });
      return `<section id="controller-context-tenant"><div class="section-heading"><h3>${t('上下文与四租户实测','Context and four-tenant measurements')}</h3><button type="button" data-detail="supplement">${t('逐组指标与来源','Per-arm metrics and source')} ↗</button></div>
        <p class="chart-scale-note">${t('每个阶段预热 60 秒，提交 300 秒，吞吐计入排空时间。时延从客户端测量。','Each phase warms up for 60 seconds, submits for 300 seconds and includes the drain time in throughput. Latency is measured at the client.')}</p>
        <div class="metric-grid">${charts.map(([key,title,unit])=>chart(key,title,unit,1,contextRows,labels,roles)).join('')}</div>
        ${table(t(['工况','直连采样利用率','控制器采样利用率'],['Scenario','Direct sampled utilization','Controller sampled utilization']),
          contextRows.map(row=>[row.label,...['B0','B1'].map(role=>Number.isFinite(row.arms[role].aicore_percent)?n(row.arms[role].aicore_percent)+'%':'—')]))}
        ${table(t(['租户','直连完成请求','控制器完成请求','直连 token/s','控制器 token/s'],['Tenant','Direct completions','Controller completions','Direct token/s','Controller token/s']),tenantRows)}
        ${contextWorkload?`<p>${esc(formatContextWorkload(contextWorkload))} · <a href="./${controllerContextPath}">${t('冻结输入与逐阶段执行摘要','Sealed input and per-phase execution digests')} ↗</a></p>`:''}
        <p><a href="./${controllerContextPath}">${t('阶段、窗口与逐租户原始汇总','Source summary by phase, window and tenant')} ↗</a></p>
      </section>`;
    };
    const trajectoryLabel='SWE Trace Heavy Load';
    const trajectoryId='swe-smith-trajectory';
    const trajectoryMetrics=streaming?['direct','controller'].map(side=>({output_tokens_per_second:streaming[side].output_tokens_per_second,mean_ttft_ms:streaming[side].mean_ttft_ms,mean_tpot_ms:streaming[side].mean_tpot_ms})):[['direct',a],['controller',b]].map(([role,arm])=>{
      const engine=latency?.multi_turn_engine[role];
      return {output_tokens_per_second:arm.output_tokens/arm.elapsed_seconds,
        ...(engine?{mean_ttft_ms:engine.mean_ttft_ms,mean_tpot_ms:engine.mean_tpot_ms}:{})
      };
    });
    const trajectory={id:trajectoryId,label:trajectoryLabel,...pairedMetrics(...trajectoryMetrics)};
    const engineLatency=()=>{
      if(!latency)return '';
      const {direct,controller}=latency.multi_turn_engine;
      const rows=[
        [t('引擎侧首 token 时延（秒）','Engine time to first token (s)'),n(direct.mean_ttft_ms/1000),n(controller.mean_ttft_ms/1000)],
        [t('引擎侧逐 token 时延（毫秒）','Engine time per output token (ms)'),n(direct.mean_tpot_ms),n(controller.mean_tpot_ms)],
        [t('引擎侧请求耗时（秒）','Engine request latency (s)'),n(direct.mean_e2e_ms/1000),n(controller.mean_e2e_ms/1000)],
        [t('客户端从请求就绪到完成（秒）','Client request ready to completion (s)'),n(a.request_latency_seconds.mean),n(b.request_latency_seconds.mean)]
      ];
      return `<h3>${trajectoryLabel} · ${t('非流式批次的时延分解','Latency breakdown for the non-streaming batch')}</h3>
        <p>${t(`两组各 ${direct.requests} 条请求。引擎侧从请求进入引擎开始计时，放行前等待计入客户端请求耗时。本轮客户端采用非流式接口，未记录首 token 到达时间。`,`${direct.requests} requests per arm. Engine timings start at engine admission. Client request latency includes waiting before admission. This run used non-streaming responses, so client first-token arrival was unobserved.`)}</p>
        ${table([t('指标','Metric'),roles.B0,roles.B1],rows)}`;
    };
    const computeDetails=()=>{
      if(!compute)return '';
      const sides=['direct','controller'];
      return `<h3>${t('MMLU-Pro 200 · 输出上限 256','MMLU-Pro 200 · 256 output token limit')}</h3>
        <p>${t('三轮各 200 条请求。分子取目标模型必要矩阵算量下界，计时覆盖整批服务和双卡同步。引擎原生效率认证使用独立的算量与计时协议。','Three rounds of 200 requests. The numerator bounds the target model’s necessary matrix work. Timing includes the complete service batch and both accelerator fences. Native engine efficiency uses its own work and timing protocol.')}</p>
        ${table([t('指标','Metric'),roles.B0,roles.B1],[
          [t('必要矩阵计算速率下界（TFLOP/s/卡）','Necessary matrix work lower rate (TFLOP/s per accelerator)'),...sides.map(side=>'≥'+lowerRate(compute.arms[side].target_matrix_tflops_per_card_lower))],
          [t('三轮合计（秒）','Three rounds total (s)'),...sides.map(side=>n(compute.arms[side].synchronized_service_seconds))],
          [t('整批输出吞吐（token/s）','Batch output throughput (token/s)'),...sides.map(side=>n(compute.arms[side].output_tokens_per_second))]
        ])}<p><a href="./${controllerComputePath}">${t('逐轮算量及计时记录','Per-round work and timing')} ↗</a></p>`;
    };
    const repeatDetails=()=>{
      if(!repeat)return '';
      const rows=[
        [t('整批耗时（秒）','Batch time (s)'),...['direct','controller'].map(arm=>n(repeat[arm].elapsed_seconds))],
        [t('输出吞吐（token/s）','Output throughput (token/s)'),...['direct','controller'].map(arm=>n(repeat[arm].output_tokens_per_second))],
        [t('输入 token 缓存命中率','Cached input tokens'),...['direct','controller'].map(arm=>n(repeat[arm].cached_input_percent)+'%')]
      ];
      const report=`https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${commit}/${repeat.report_path}`;
      return `<h3>${trajectoryLabel} · ${t('复测','Repeat')} · ${esc(repeat.date)}</h3>
        ${table([t('指标','Metric'),roles.B0,roles.B1],rows)}
        <p><a href="${esc(report)}">${t('复测报告与图表','Repeat report and figures')} ↗</a></p>`;
    };
    const latestDirect=streaming?.direct||a, latestController=streaming?.controller||b;
    const batchTime=`${n(latestDirect.elapsed_seconds)} → ${n(latestController.elapsed_seconds)} s`;
    const timeReduction=100*(1-latestController.elapsed_seconds/latestDirect.elapsed_seconds);
    const trajectorySource=streaming?`<a href="./${controllerStreamingPath}">${t('本批流式来源','Source for this streaming batch')} ↗</a>`:'';
    const c8Label=id=>(id==='4096-formal'?'4K':'16K')+' / C8 · '+t('独立闭环','Independent closed loop');
    const cacheHit=[latestDirect,latestController].map(arm=>Number.isFinite(arm.cached_input_percent)?n(arm.cached_input_percent)+'%':'—').join(' → ');
    const chartRows=[...rows];
    chartRows.splice(rows.findIndex(row=>row.id==='swe')+1,0,trajectory);
    for(const row of c8?.rows||[]){
      const label=c8Label(row.id);
      const fields=[row.direct,row.controller].map(arm=>({output_tokens_per_second:arm.output_tokens_per_second,
        mean_ttft_ms:arm.mean_ttft_ms,mean_tpot_ms:arm.mean_tpot_ms}));
      chartRows.push({id:row.id,label,...pairedMetrics(...fields)});
    }
    const source='https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/'+(latency?.report_revision||commit)+'/'+entry.report_path;
    const resultLink=`<a href="./controlplane/?release=${esc(entry.id)}#results">${t('请求限流控制器专题','Request Throttling Controller overview')} ↗</a>`;
    const peak=peakThroughputPair([...chartRows,...contextRows]);
    const throughput=throughputRatio(peak);
    const context16k=contextRows.find(row=>row.id==='16384'&&throughputRatio(row)!==null)
      ||chartRows.find(row=>row.id==='16384-formal'&&throughputRatio(row)!==null);
    const lowerRate=value=>(Math.floor(value*100)/100).toFixed(2);
    const summaryNames=comparisonSummaryNames();
    summaryNames[0]=t('参考效率下界','Reference efficiency lower bound');
    const values=[nativeCompute?'≥'+nativeCompute.arms.controller.efficiency_percent_lower+'%':'—',peak?n(throughput)+'×':'—',context16k?n(throughputRatio(context16k))+'×':'—',
      peak?n(100*(1-1/throughput))+'%':'—'];
    const notes=[
      nativeCompute?t('经控制器 · MMLU-Pro 200 / out256 · 双卡原生计时','Via controller · MMLU-Pro 200 / out256 · two-card native timing'):
        t('原生参考效率待核验','Native reference efficiency pending verification'),
      peak?`${peak.label} · ${t('相对同配置引擎直连','Compared with direct access to the same engine')}`:t('暂无配对实测','No paired measurements'),
      context16k?`${context16k.label} · ${t('相对同配置引擎直连','Compared with direct access to the same engine')}`:t('暂无 16K 配对实测','No paired 16K measurements'),
      peak?`${peak.label} · ${t('同费率单位输出 token 加速卡成本估算','Estimated accelerator cost per output token at equal rates')}`:t('暂无配对实测','No paired measurements')
    ];
    const settings=t(`两组共同配置 · 执行上限 ${entry.max_num_seqs} · 状态驻留数 ${entry.state_resident_seats} · 跨轮缓存复用 · TP2`,`Shared settings · execution limit ${entry.max_num_seqs} · resident states ${entry.state_resident_seats} · cross-turn cache reuse · TP2`);
    const metricChart=(key,title,unit,divisor,reason)=>{
      const scopedLatency=key==='mean_ttft_ms'||key==='mean_tpot_ms';
      const missing=reason||t('多轮回放使用非流式接口，未记录客户端首内容 token 到达时间','The non-streaming multi-turn replay has no client first content-token arrival timestamp');
      const metricRows=chartRows.map(row=>Number.isFinite(row.arms?.B0?.[key])&&Number.isFinite(row.arms?.B1?.[key])
        ?{...row,metricScope:scopedLatency&&row.id===trajectoryId&&!streaming?t('引擎侧','Engine-side'):null}
        :{...row,arms:null,missingReason:row.missingReason||(key==='mean_tpot_ms'&&row.id!==trajectoryId
          ?t('尚未发布客户端逐 token 时延补充数据','Client time per output token supplement is unpublished'):missing)});
      return chart(key,title,unit,divisor,metricRows,chartRows.map(row=>row.label),roles);
    };
    const summaryRows=profiles.map(p=>p.status==='complete'
      ?[p.label,n(p.direct.elapsed_seconds),n(p.controller.elapsed_seconds),n(p.time_reduction_percent)+'%',n(p.output_token_change_percent)+'%']
      :[p.label,'—','—',t(p.reason_zh,p.reason_en),'—']);
    summaryRows.splice(rows.findIndex(row=>row.id==='swe')+1,0,
      [trajectoryLabel,n(latestDirect.elapsed_seconds),n(latestController.elapsed_seconds),n(timeReduction)+'%',n(100*(latestController.output_tokens/latestDirect.output_tokens-1))+'%']);
    const tailDetails=()=>{
      const measurements=[];
      if(fixed)for(const row of profiles){
        for(const side of ['direct','controller']){
          const arm=row[side];
          if(!arm.latency_seconds)continue;
          const first=arm.time_to_first_output_seconds,perToken=arm.time_per_output_token_ms;
          measurements.push([row.label,side,arm.successful,first.p95,first.p99,perToken.p95,perToken.p99,arm.latency_seconds.p95,arm.latency_seconds.p99]);
        }
      }
      const supplements=[...(streaming?[{...streaming,label:trajectoryLabel}]:[]),
        ...(c8?.rows||[]).map(row=>({...row,label:c8Label(row.id)}))];
      for(const row of supplements){
        for(const side of ['direct','controller']){
          const arm=row[side];
          measurements.push([row.label,side,arm.requests,arm.ttft_p95_ms/1000,arm.ttft_p99_ms/1000,arm.tpot_p95_ms,arm.tpot_p99_ms,
            arm.end_to_end_p95_ms/1000,arm.end_to_end_p99_ms/1000]);
        }
      }
      if(!measurements.length)return '';
      return `<h3>${t('客户端尾部时延','Client tail latency')}</h3>${table(t(
        ['负载','路径','完成请求','首 token P95（秒）','首 token P99（秒）','逐 token P95（毫秒）','逐 token P99（毫秒）','端到端 P95（秒）','端到端 P99（秒）'],
        ['Profile','Path','Completions','TTFT P95 (s)','TTFT P99 (s)','TPOT P95 (ms)','TPOT P99 (ms)','End-to-end P95 (s)','End-to-end P99 (s)']),
        measurements.map(([label,side,count,...values])=>[label,side==='direct'?roles.B0:roles.B1,count,...values.map(value=>n(Number.isFinite(value)?value:null))]))}`;
    };
    const contextWindowsDetails=()=>{
      const phase=context.phases.find(row=>row.id==='32768');
      if(!phase)return '';
      const {direct,controller}=phase;
      const windows=direct.windows;
      if(!Array.isArray(windows)||!Array.isArray(controller.windows)||windows.length!==5||controller.windows.length!==windows.length||
         windows.some((row,i)=>row.submission_start_seconds!==controller.windows[i]?.submission_start_seconds||
           row.submission_end_seconds!==controller.windows[i]?.submission_end_seconds))return '';
      const fields=window=>[window.metrics?.successful??'—',n(window.metrics?.ttft_ms?.p99),n(window.metrics?.tpot_ms?.p99)];
      const rows=windows.map((window,i)=>{
        return [`${window.submission_start_seconds}–${window.submission_end_seconds}`,...fields(window),...fields(controller.windows[i])];
      });
      return `<h3>32K–48K / C8 · ${esc(contextDataset)} · ${t('五个提交窗口','Five submission windows')}</h3>
        ${table(t(['窗口（秒）','直连完成数','直连 TTFT P99 / ms','直连 TPOT P99 / ms','控制器完成数','控制器 TTFT P99 / ms','控制器 TPOT P99 / ms'],
          ['Window (s)','Direct completions','Direct TTFT P99 / ms','Direct TPOT P99 / ms','Controller completions','Controller TTFT P99 / ms','Controller TPOT P99 / ms']),rows)}`;
    };
    const costDetails=()=>{
      const monthlyRent=1875,occupiedCards=2;
      const quote='https://news.smm.cn/news/TCNOQJBAJVZYJ73BMVU7G5GJZXQ462A4U6NN4CY';
      const cost=arm=>monthlyRent*occupiedCards*1e6/(30*86400*arm.output_tokens_per_second);
      const values=[...chartRows,...contextRows].filter(row=>row.arms?.B0&&row.arms?.B1).map(row=>[
        row.label,
        ...['B0','B1'].map(side=>n(cost(row.arms[side])))
      ]);
      const tenant=contextRows.find(row=>row.id==='multi-tenant');
      const tenantDetails=tenant?`<h3>${esc(tenant.label)}</h3>${table([t('同一正式区间','Same measured interval'),roles.B0,roles.B1],[
        [t('成本估算（元/百万输出 token）','Estimated cost (CNY/million output tokens)'),...['B0','B1'].map(side=>n(cost(tenant.arms[side])))],
        [t('加速卡单位成本变化','Change in accelerator unit cost'),'—',`${tenant.changes_percent.relative_cost_per_token.toFixed(3)}%`],
        [t('双卡 AI Core 采样利用率','Sampled two-card AI Core utilization'),...['B0','B1'].map(side=>{
          const percent=tenant.arms[side].aicore_percent;
          return Number.isFinite(percent)?n(percent)+'%':'—';
        })]
      ])}`:'';
      return `<h3>${t('每百万输出 token 加速卡成本估算','Estimated accelerator cost per million output tokens')}</h3>
        <p>${t('沿用引擎送测的公开租赁报价。每张卡每月 1,875 元，按 30 天分摊。两组各用两张卡。','The engine assessment uses a published rental quote of CNY 1,875 per accelerator per 30-day month. Each arm uses two accelerators.')}
        <a href="${quote}">${t('上海有色网报价','Shanghai Metals Market quote')} ↗</a></p>
        ${table([t('负载（元/百万输出 token）','Profile (CNY/million output tokens)'),roles.B0,roles.B1],values)}${tenantDetails}`;
    };
    const utilizationChart=()=>{
      if(!utilization)return '';
      const results=chartRows.map(row=>{
        const observation=utilization.rows[row.id===trajectoryId?'swe-heavy':row.id];
        if(!observation)return '';
        const sides=['direct','controller'];
        const complete=sides.every(side=>observation[side].coverage_complete);
        const delta=observation.controller.mean_percent-observation.direct.mean_percent;
        const label=t('双卡采样时间加权均值','Time-weighted two-card mean');
        return `<div class="chart-row" data-profile="${esc(row.id)}"><div class="chart-row-heading">
          <strong>${esc(row.label)}</strong><span>${complete?(delta>0?'+':'')+n(delta)+' pp':t('采样有缺口','Sampling gap')}</span></div>
          ${sides.map((side,index)=>{
            const current=observation[side].mean_percent,role=index?'B1':'B0';
            return `<div class="bar-line"><span class="bar-role">${esc(roles[role])}</span><span class="bar-track">
              ${Number.isFinite(current)?`<span title="${label}" class="bar-fill ${role.toLowerCase()}" style="width:${current}%"></span>`:''}</span>
              <span class="bar-value">${n(current)}</span></div>`;
          }).join('')}</div>`;
      });
      return `<article class="metric-chart" data-metric="ai_core_utilization_percent"><header><h3>${t('AI Core 利用率','AI Core utilization')}</h3><span>%</span></header>
        <p class="chart-scale-note">${t('按两张加速卡的正式请求区间采样并加权。','Time-weighted over the formal request interval for both accelerators.')}</p>
        ${results.join('')}<p><a href="./${controllerUtilizationPath}">${t('逐卡覆盖与采样来源','Per-card coverage and sample source')} ↗</a></p></article>`;
    };
    panel.innerHTML=`${heading}
      <div class="comparison-meta"><span>${t(`基于 B1 ${entry.id}，直连与控制器组共用下方实验配置`,`Both arms use the experiment configuration below, based on B1 ${entry.id}`)}</span>${resultLink}</div>
      <p class="release-coverage-summary">${fixedPairSummary(rows)}</p>
      <div class="goal-grid">${summaryNames.map((name,i)=>`<article class="result-card"><span>${name}</span><strong>${values[i]}</strong><small>${esc(notes[i])}</small></article>`).join('')}</div>
      ${nativeCompute?`<p class="comparison-meta" data-controller-native-efficiency>
        <span>${t('两臂均已证明达到 50%。现有下界不足以证明 90%。','Both paths establish the 50% milestone. The bounds do not establish 90%.')}</span>
        <button type="button" data-detail="native-compute">${t('直连与限流层原生参考效率','Direct and controller native reference efficiency')} ↗</button></p>`:
        compute?`<p class="comparison-meta" data-controller-native-efficiency>${t('服务侧矩阵算力见耗时详情。','Service-side matrix compute is available in the timing details.')}</p>`:''}
      <p class="comparison-meta" id="controller-trajectory-result"><strong>${trajectoryLabel}</strong>
        <span>${t('整批耗时','Batch time')} ${batchTime} · ${t('缩短','Reduction')} <strong>${n(timeReduction)}%</strong></span>
        <span>${t('输入 token 缓存命中率','Cached input tokens')} ${cacheHit}</span></p>
      <section class="frozen-profile"><div class="section-heading"><h3>${t('控制面实验配置','Control plane experiment configuration')}</h3><button type="button" data-detail="configuration">${t('版本与配置详情','Versions and configuration')} ↗</button></div>
      <p>${esc(entry.engine_release)}</p><p class="frozen-settings">${esc(settings)}</p></section>
      ${coverageView(rows,false,null,'controller-coverage-title')}
      <div class="section-heading"><h2>${t('性能与成本','Performance and cost')}</h2><button type="button" data-detail="metrics">${t('耗时与请求时延','Batch and request latency')} ↗</button></div>
      <p class="chart-scale-note">${t(`以同配置的引擎直连为基准。SWE trace64 是固定公开轨迹请求回放，这轮按请求隔离缓存，无法验证跨轮复用。${trajectoryLabel} 按多轮程序回放，保留工具等待，续轮继承模型真实输出。`,`Bars use direct access to the same engine as the reference. SWE trace64 replays fixed public requests with isolated caches, so it cannot test cross-turn reuse in this run. ${trajectoryLabel} replays multi-turn programs, preserves tool waits, and uses actual model outputs in later turns.`)}</p>
      <p class="chart-scale-note" id="controller-metric-scopes">${t('时延默认从客户端测量。标记「引擎侧」的数值从请求进入引擎开始计时。成本按相同加速卡费率估算，未计入控制器与宿主机。','Latencies are client-side unless marked Engine-side, where timing starts at engine admission. Cost estimates assume the same accelerator rate and exclude the controller and host.')}</p>
      <div class="metric-grid">
      ${metricChart('output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s',1)}
      ${metricChart('mean_ttft_ms',t('首 token 时延 ↓','Time to first token ↓'),'s',1000)}
      ${metricChart('mean_tpot_ms',t('逐 token 时延 ↓','Time per output token ↓'),'ms',1,t('此负载未记录客户端逐 token 时延','Client time per output token unavailable for this workload'))}
      ${metricChart('relative_cost_per_token',t('单位输出 token 的加速卡成本估算 ↓','Estimated accelerator cost per output token ↓'),t('直连 = 1','Direct = 1'),1)}</div>
      ${utilizationChart()}
      ${contextSection()}
      <div class="detail-actions">${[['methods',t('公式与比较方式','Formulas and comparison')],['quality',t('质量与评分明细','Quality and grading')],['evidence',t('原始证据','Original evidence')]].map(([key,label])=>`<button type="button" data-detail="${key}">${label} ↗</button>`).join('')}</div>${detailDialog('controller')}`;
    bindDetails(key=>{
      if(key==='native-compute'&&nativeCompute)return {title:t('V2 4.1 双卡原生参考效率','V2 4.1 Two-card native reference efficiency'),
        body:controllerNativeComputeDetails(nativeCompute,commit,t,table)};
      if(key==='metrics')return {title:t('耗时与请求时延','Batch and request latency'),body:
        `<p>${trajectoryLabel} · ${esc(latestDirect.requests??latestDirect.successful_requests)} ${t('请求 / 组','requests per arm')} · ${esc(latestDirect.output_tokens)} ${t('输出 token / 组','output tokens per arm')} ${trajectorySource}</p>
        <p>${t('输入 token 缓存命中','Cached input tokens')} ${cacheHit}</p>${table(t(['负载','直连（秒）','加控制器（秒）','耗时缩短','输出 token 变化'],['Profile','Direct (s)','Controller (s)','Time reduction','Output token change']),summaryRows)}${tailDetails()}${engineLatency()}${repeatDetails()}${computeDetails()}`};
      if(key==='configuration')return {title:t('运行配置','Run configuration'),body:`<p>${esc(entry.engine_release)}</p><ul>${entry.overrides.map(v=>`<li>${esc(t(v.zh,v.en))}</li>`).join('')}</ul>`};
      if(key==='methods')return {title:t('公式与比较方式','Formulas and comparison'),body:`<p>${t('客户端逐 token 时延为响应结束减首个模型输出 token 到达，再除以输出 token 数减一，逐请求等权平均。多轮回放的引擎侧时延来自覆盖整批业务请求的引擎计数器增量。','Client time per output token is the response end minus the first model output token arrival, divided by the output token count minus one and averaged equally across requests. Multi-turn engine latencies come from engine counter deltas over the full batch.')}</p><p>${t('相同卡数和费率下，加速卡单位成本比 = 直连输出吞吐 ÷ 加控制器后的输出吞吐。两组均为两张 Ascend 910B2。','With the same accelerator count and rate, accelerator unit-cost ratio equals direct output throughput divided by controller output throughput. Both arms used two Ascend 910B2 cards.')}</p>${costDetails()}<p><a href="${esc(source)}">${t('原始报告','Original report')} ↗</a></p>`};
      if(key==='quality'){
        let rows=entry.quality_rows.map(row=>[t(row.label_zh,row.label_en),row.direct,row.controller]);
        let breakdown='';
        if(fixed){
          const [mmlu,hle,frontier]=['mmlu','hle','frontier'].map(id=>fixed.profiles.find(row=>row.id===id));
          const sides=['direct','controller'];
          const sum=(groups,field)=>Object.values(groups||{}).reduce((value,group)=>value+(group[field]||0),0);
          rows=[
            [t('MMLU-Pro 正确数 / 200','MMLU-Pro correct / 200'),...sides.map(side=>`${mmlu[side].quality.correct} / 200`)],
            [t('Humanity’s Last Exam 正确数 / 200','Humanity’s Last Exam correct / 200'),...sides.map(side=>`${sum(hle[side].quality.groups,'successes')} / 200`)],
            [t('Humanity’s Last Exam 评分未判定','Humanity’s Last Exam unresolved grades'),...sides.map(side=>sum(hle[side].quality.groups,'unresolved'))],
            ...['olympiad','research'].flatMap(track=>[
              [`FrontierScience ${track} ${t('达标数 / 总数','successes / total')}`,...sides.map(side=>{const row=frontier[side].quality.tracks[track];return `${row.successes} / ${row.total}`;})],
              [`FrontierScience ${track} ${t('评分未解析','unparsed grades')}`,...sides.map(side=>frontier[side].quality.tracks[track].judge_invalid)]
            ])
          ];
          const groupNames={'gold/text':t('原题 · 文本','Gold · text'),'gold/image':t('原题 · 图像','Gold · image'),
            'revision/text':t('修订题 · 文本','Revision · text'),'revision/image':t('修订题 · 图像','Revision · image')};
          const groupRows=Object.entries(groupNames).flatMap(([id,label])=>sides.flatMap((side,index)=>{
            const grade=hle[side].quality.groups[id];
            return grade?[[label,index?roles.B1:roles.B0,`${grade.successes} / ${grade.total}`,grade.unresolved,grade.solver_truncated??'—']]:[];
          }));
          if(groupRows.length)breakdown=`<h3>Humanity’s Last Exam</h3>${table(t(['题组','路径','正确 / 总数','评分未判定','答题达到输出上限'],
            ['Group','Path','Correct / total','Unresolved grade','Solver length stops']),groupRows)}`;
        }
        return {title:t('质量与评分明细','Quality and grading'),
          body:table([t('指标','Metric'),roles.B0,roles.B1],rows)+breakdown+`<p>${esc(fixed?t('SWE trace64、SWE Trace Heavy Load 和 Terminal trace48 统计回放性能。','SWE trace64, SWE Trace Heavy Load and Terminal trace48 report replay performance.'):t(entry.quality_note_zh,entry.quality_note_en))}</p>`};
      }
      if(key==='supplement'&&context)return {title:t('上下文与四租户补测','Context and four-tenant supplement'),body:
        table([...t(['工况','路径','完成请求','输出 token/s'],['Scenario','Path','Completed requests','Output token/s']),
          'TTFT mean / ms','TTFT P95 / ms','TTFT P99 / ms','TPOT mean / ms','TPOT P95 / ms','TPOT P99 / ms'],
          context.phases.flatMap((phase,index)=>[
            [roles.B0,phase.direct.metrics],[roles.B1,phase.controller.metrics]
          ].map(([label,m])=>[contextRows[index].label,label,m.successful,n(m.output_tokens_per_second),
            ...[m.ttft_ms,m.tpot_ms].flatMap(value=>['mean','p95','p99'].map(q=>n(value[q])))])))+
        contextWindowsDetails()+`<p><a href="./${controllerContextPath}">${t('逐阶段、逐窗口与租户数据','Source data by phase, window and tenant')} ↗</a></p>`};
      const pairedSources=[
        [fixed,controllerFixedProfilesPath,t('五项固定负载与评分','Five fixed profiles and grades')],
        [streaming,controllerStreamingPath,t('SWE Trace Heavy Load 流式补测','SWE Trace Heavy Load streaming pair')],
        [c8,controllerC8Path,t('4K / 16K 闭环并发 8','4K / 16K closed-loop concurrency 8')],
        [context,controllerContextPath,t('三档上下文和四租户','Three context ranges and four tenants')],
        [nativeCompute,controllerNativeComputePath,t('V2 4.1 双卡原生参考效率','V2 4.1 Two-card native reference efficiency')],
        [compute,controllerComputePath,t('服务侧矩阵算力下界','Service-side matrix compute lower bound')],
        [utilization,controllerUtilizationPath,t('双卡 AI Core 采样区间','Two-card AI Core sampling interval')]
      ].filter(([available])=>available);
      return {title:t('测量范围与证据','Measurement scope and evidence'),body:`<p>${esc(t(entry.scope_zh,entry.scope_en))}</p>
        ${c8?`<p>${t('独立闭环 C8 的公开记录未列出输入摘要或数据集身份。','The published independent closed-loop C8 record does not identify the workload input digest or dataset.')}</p>`:''}
        ${pairedSources.length?`<ul>${pairedSources.map(([,path,label])=>`<li><a href="./${path}">${esc(label)} ↗</a></li>`).join('')}</ul>`:''}<p><a href="${esc(source)}">${t('历史原始报告','Historical report')} ↗</a> · ${resultLink}</p>`};
    },panel);
    panel.dataset.engineRelease=entry.id;
  }

  const srPath = 'data/sr-development-results-v1.json';
  let srEntries;
  async function loadSr() {
    if(srEntries)return;
    const [meta, response]=await Promise.all([fetch('./data/benchmark-source-manifest.json',{cache:'no-cache'}),fetch('./'+srPath,{cache:'no-cache'})]);
    if(!meta.ok||!response.ok)throw Error('SR publication unavailable');
    const publication=await meta.json();
    if(publication.repository!=='vLLM-HUST/vllm-hust-benchmark'||publication.status!=='published-source'||!/^[a-f0-9]{40}$/.test(publication.commit))throw Error('Invalid SR publication identity');
    const binding=publication.files.filter(file=>file.website_path===srPath);
    const raw=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(binding.length!==1||binding[0].sha256!==digest||binding[0].bytes!==raw.byteLength)throw Error('SR publication checksum mismatch');
    const value=JSON.parse(new TextDecoder().decode(raw));
    if(value.schema!=='vllm-hust-sr-development/v1'||value.control!=='B1-r8'||!Array.isArray(value.entries)||!value.entries.length)throw Error('Invalid SR publication scope');
    const ids=value.entries.map(entry=>entry.id);
    if(new Set(ids).size!==ids.length||ids.some(id=>!/^sr[1-9][0-9]*$/.test(id)))throw Error('Invalid SR identity');
    for(const id of ids){
      const entries=value.entries.filter(entry=>entry.id===id);
      if(entries.length!==1)throw Error('Invalid SR identity');
      const entry=entries[0];
      const url=new URL(entry.release_url);
      if(url.origin!=='https://github.com'||!url.pathname.startsWith('/vLLM-HUST/vllm-hust-engine/releases/tag/b1-'+id+'-'))throw Error('Invalid SR evidence link');
      const expected=id==='sr1'?['mmlu','4096-formal','16384-formal']:[...fixedProfiles.map(([id])=>id),'4096-formal','16384-formal'];
      if(entry.rows.some(row=>/^(?:4096|16384)-repeat$/.test(row.id)))expected.push('4096-repeat','16384-repeat');
      if(expected.some(id=>entry.rows.filter(row=>row.id===id).length!==1)||new Set(entry.rows.map(row=>row.id)).size!==entry.rows.length||entry.rows.some(row=>!expected.includes(row.id)&&!/^(?:4096|16384)-repeat$/.test(row.id)))throw Error('Invalid SR row coverage');
      for(const row of entry.rows){
        if(row.arms?.length!==2||row.cards?.length!==2||row.cards.some(cards=>cards.length!==2||!cards.every(Number.isInteger)))throw Error('Invalid SR arm identity');
        for(const arm of row.arms){
          if(!['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','ttft_p95_ms','ttft_p99_ms','end_to_end_p95_ms','end_to_end_p99_ms'].every(key=>Number.isFinite(arm[key])&&arm[key]>0))throw Error('Invalid SR metrics');
          if(arm.correct!==undefined&&(!Number.isInteger(arm.correct)||!Number.isInteger(arm.requests)||arm.correct<0||arm.correct>arm.requests))throw Error('Invalid SR score');
        }
      }
    }
    srEntries=value.entries;
    srIds=ids.sort((a,b)=>BigInt(a.slice(2))>BigInt(b.slice(2))?-1:1);
  }
  function srRows(entry) {
    return entry.rows.map(row=>{
      const crossCard=row.cards[0].join()!==row.cards[1].join();
      const arms=Object.fromEntries(row.arms.map((arm,i)=>[i?'B1':'B0',{...arm,physical_cards:row.cards[i],relative_cost_per_token:row.arms[0].output_tokens_per_second/arm.output_tokens_per_second}]));
      const changes_percent=Object.fromEntries(['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map(key=>[key,100*(arms.B1[key]/arms.B0[key]-1)]));
      const workloadLabel=[row.variant,crossCard?t('跨卡位对照','Different card positions'):t('同卡对照','Matched cards')].filter(Boolean).join(' · ');
      const label=row.id.endsWith('-repeat')?row.label+' · '+t('复测','Repeat'):row.label;
      return {...row,label,arms,changes_percent,crossCard,workloadLabel};
    });
  }
  function srDetails(entry,rows,key,roles) {
    const measurements=rows.filter(row=>row.arms);
    const settings='E36/R54 · MTP2 · FULL · TP2';
    if(key==='configuration')return {title:t('运行配置','Run configuration'),body:`<p>${esc(entry.name)} · ${settings} · BF16 · Qwen3.5-35B-A3B</p><p><a href="${esc(entry.release_url)}">B1-${entry.id} Release ↗</a></p>`};
    if(key==='methods')return {title:t('计算公式与比较方式','Formulas and comparison'),body:`<p>${esc(t(entry.scope_zh,entry.scope_en))}</p><p>${t('各行单独列出对应轮次。吞吐为输出 token 除以批次耗时，含排空。TTFT 和 TPOT 为逐请求均值。成本比按同费率计算，为 B1-r8 吞吐除以候选吞吐。','Each row reports its corresponding run. Throughput is output tokens divided by batch duration including drain. TTFT and TPOT are request means. Equal-rate cost is B1-r8 throughput divided by candidate throughput.')}</p>`};
    if(key==='quality'){
      const scored=measurements.filter(row=>Number.isInteger(row.arms.B1.correct));
      return {title:t('质量与评分明细','Quality and grading'),body:table(t(['场景','版本','正确 / 总数','长度终止','未判定'],['Profile','Version','Correct / total','Length stops','Unresolved']),scored.flatMap(row=>['B0','B1'].map(role=>{const arm=row.arms[role];return [row.label,roles[role],`${arm.correct}/${arm.requests}`,arm.truncated,arm.unresolved];})))+`<p>${t('SWE 与 Terminal 回放仅统计请求性能。','SWE and Terminal replays measure request performance only.')}</p>`};
    }
    if(key==='metrics')return {title:t('完整数值','Complete metrics'),body:table(t(['场景','版本','物理卡','tok/s','TTFT / s','TPOT / ms','TTFT P95 / s','TTFT P99 / s','E2E P95 / s','E2E P99 / s'],['Profile','Arm','Physical cards','tok/s','TTFT / s','TPOT / ms','TTFT P95 / s','TTFT P99 / s','E2E P95 / s','E2E P99 / s']),measurements.flatMap(row=>['B0','B1'].map((role,i)=>{const arm=row.arms[role];return [[row.label,row.variant].filter(Boolean).join(' · '),roles[role],row.cards[i].join(', '),n(arm.output_tokens_per_second),n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms),n(arm.ttft_p95_ms/1000),n(arm.ttft_p99_ms/1000),n(arm.end_to_end_p95_ms/1000),n(arm.end_to_end_p99_ms/1000)];})))};
    return {title:t('测量范围与证据','Measurement scope and evidence'),body:`<p>${esc(t(entry.scope_zh,entry.scope_en))}</p><p><a href="./${srPath}">${t('公开汇总','Public summary')} ↗</a> · <a href="${esc(entry.release_url)}">${t('私有 Release','Private Release')} ↗</a></p>`};
  }
  function comparisonSummaryNames() {
    return t(['有效算力下界','最高吞吐比','16K 吞吐比','最高同费率降幅'],
      ['Effective compute bound','Peak throughput ratio','16K throughput ratio','Best equal-rate cost reduction']);
  }

  function throughputRatio(row) {
    const baseline=row?.arms?.B0?.output_tokens_per_second;
    const candidate=row?.arms?.B1?.output_tokens_per_second;
    return [baseline,candidate].every(value=>Number.isFinite(value)&&value>0)?candidate/baseline:null;
  }

  function peakThroughputPair(rows) {
    return rows.filter(row=>!row.crossCard&&throughputRatio(row)!==null)
      .reduce((best,row)=>!best||throughputRatio(row)>throughputRatio(best)?row:best,null);
  }

  function fixedPairSummary(rows) {
    const complete=rows.filter(row=>fixedProfiles.some(([id])=>id===row.id)&&row.arms).length;
    return `${t('固定五项配对','Fixed-profile pairs')} ${complete}/${fixedProfiles.length}`;
  }

  function renderVersion() {
    const attempt=attemptIds.includes(selectedRelease);
    const sr=srIds.includes(selectedRelease);
    const entry=sr?srEntries.find(row=>row.id===selectedRelease):attempt?releaseCatalog.attempts.find(row=>row.id===selectedRelease):releaseEntry();
    const roles=sr?{B0:'B1-r8',B1:'B1-'+entry.id}:comparisonRoles(entry);
    const reason=attempt?t(entry.reason_zh,entry.reason_en):entry.id==='r5'?t(entry.scope_zh,entry.scope_en):'';
    const missingNote=attempt||entry.id==='r5'?t('运行未完成，无配对数据','Run incomplete; no paired data'):'';
    const originalRows=standardRows(attempt?[]:sr?srRows(entry):versionRows(entry),missingNote);
    const rows=sr?originalRows:withFixedBaseline(originalRows),available=rows.filter(row=>row.arms);
    if(!attempt&&!sr)assertFormalBaselineIsolation(entry,rows);
    const peak=peakThroughputPair(available);
    const throughput=throughputRatio(peak);
    const context=available.find(row=>row.id==='real-context-16384-formal')||available.find(row=>/^16384/.test(row.id)||row.contextBand==='16k');
    const compute=stableAssessment(entry)?.targets['4.1'];
    const reference=sr?null:entry.compute_reference||(compute?{
      accepted_scope:'topic4_submission_v2_fixed200_max256_three_formal_runs',
      arms:{B1:{efficiency_lower_percent:compute.efficiency_lower_percent.B1}},
      milestone_met:compute.milestone.met,
      final_numeric_met:compute.final.met
    }:null);
    const values=[reference?'≥'+computeBound(reference.arms.B1.efficiency_lower_percent)+'%':'—',throughput?n(throughput)+'×':'—',context?n(context.arms.B1.output_tokens_per_second/context.arms.B0.output_tokens_per_second)+'×':'—',throughput?n(100*(sr?1/throughput-1:1-1/throughput))+'%':'—'];
    const notes=[reference?(reference.accepted_scope==='topic4_submission_v2_fixed200_max256_three_formal_runs'?t('MMLU200/out256 · 三轮效率下界','MMLU200/out256 · three-run efficiency lower bound'):t('本轮完整回答参考效率下界','Current full-answer reference efficiency lower bound')):t('B0 核算见详情；本版 B1 尚未发布','B0 accounting in details; current B1 unpublished'),throughput?(sr?t('同卡场景最高吞吐比','Highest matched-card throughput ratio'):t('已发布场景最高吞吐比','Highest published throughput ratio')):t('固定 B0 已保留；本版 B1 暂无测量','Fixed B0 retained; current B1 measurements unpublished'),context?t(`16K 相对 ${roles.B0} 吞吐`,`16K throughput vs ${roles.B0}`):t('固定 B0 已保留；本版 B1 暂无补测','Fixed B0 retained; current B1 supplement unpublished'),throughput?t('同费率单位token成本降低','Lower token cost at equal rates'):t('本版 B1 成本与利用率尚未汇总','Current B1 cost and utilization are unpublished')];
    const observation=singleArmObservation(entry);
    if(observation){notes[1]=t('固定 B0 与本版 B1 原值见下图','Fixed B0 and current B1 measurements below');notes[2]=t('B0 原测记录及本版 B1 4K/16K 实测见下方','Original B0 and current B1 4K/16K measurements below');notes[3]=t('本版 B1 成本与利用率尚未汇总','Current B1 cost and utilization are unpublished');}
    document.getElementById('comparison-title').textContent=sr?t(`B1-r8 / B1-${entry.id} 实测对比`,`B1-r8 / B1-${entry.id} measured comparison`):observation?t(`B0 / B1 ${entry.id} 测试记录`,`B0 / B1 ${entry.id} test records`):t(`B0 / B1 ${entry.id} 实测对比`,`B0 / B1 ${entry.id} measured comparison`);
    document.getElementById('comparison-lead').textContent=(observation?'B1 '+entry.id+' · '+observation.candidate.model:'Qwen3.5-35B-A3B')+' · Ascend 910B2 × 2 · BF16';
    const settings=sr?'E36/R54 · MTP2 · FULL · TP2':attempt?t('本次尝试未形成冻结配置','This attempt did not produce a frozen configuration'):frozenSettings(entry.settings);
    const config=frozenProfile(entry.id,{B0:releaseCatalog.baseline.cann,B1:attempt?'—':'9.1.0'},attempt?[]:sr?[entry.name]:entry.mods,settings);
    const scope=attempt?reason:observation?t(`固定 B0 保留原测记录；B1 书生实测：${observation.workloads.map(row=>row.label_zh).join('、')}。模型与工况分别标注。`,`Fixed B0 observations are retained. Current B1 Intern measurements: ${observation.workloads.map(row=>row.label_en).join(', ')}. Models and workloads are labeled separately.`):t(entry.scope_zh,entry.scope_en);
    const costNote=sr&&throughput?t('同卡场景的同费率成本变化','Matched-card equal-rate cost change'):notes[3];
    const cardNames=sr?names():comparisonSummaryNames();
    const cardScope=[null,peak?.label,[context?.label,context?.crossCard?cardComparisonLabel(context):''].filter(Boolean).join(' · '),peak?.label];
    const coverageNote=!attempt&&!sr&&entry.id!=='r5'?`<p class="release-coverage-summary">${fixedPairSummary(originalRows)}${entry.publication_status==='frozen-candidate'?' · '+t('冻结候选','Frozen candidate'):''}</p>`:'';
    if(entry.id==='r9'){
      for(const row of rows.filter(r=>fixedProfiles.some(([id])=>id===r.id)&&!r.arms&&!r.observation)){
        row.coverageNote=row.id==='hle'?t('原轮启动失败；完整续跑结果待发布','Original startup failed; completed continuation pending publication')
          :t('原轮未执行；待发布续跑结果','Skipped in the original run; continuation pending publication');
      }
    }
    root.innerHTML=`<section class="comparison-dashboard"${sr?' data-comparison="sr"':''}>${releaseMenu()}<div class="comparison-meta"><span>${esc(entry.id+' · '+scope)}</span></div><div class="goal-grid">${names().map((name,i)=>`<article class="result-card"><span>${name}</span><strong>${values[i]}</strong><small>${i===3?costNote:notes[i]}</small>${i===0&&reference?`<small>${t('里程碑50%','50% milestone')}：${reference.milestone_met?t('达成目标','Target met'):t('未达成目标','Target not met')}<br>${t('最终90%','90% final')}：${reference.final_numeric_met?t('达成目标','Target met'):t('未达成目标','Target not met')}</small>`:''}</article>`).join('')}</div>${config}${coverageView(rows,!!entry.quality)}<section ${entry.id==='r8'?'id="r8-current-continuous"':''}><div class="section-heading"><h2>${t('性能与成本','Performance and cost')}</h2><button type="button" data-detail="metrics">${t('查看数值','View metrics')} ↗</button></div><p class="chart-scale-note">${t(`配对条形按 ${roles.B0} = 1 归一；独立记录按原值显示，模型和工况见详情。`,`Paired bars normalize ${roles.B0} to 1; independent records show raw values. Models and workloads are in details.`)}</p><div class="metric-grid">${chart('output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s',1,rows,rows.map(row=>row.label),roles)}${chart('mean_ttft_ms',t('首token时延 ↓','Time to first token ↓'),'s',1000,rows,rows.map(row=>row.label),roles)}${chart('mean_tpot_ms',t('逐token时延 ↓','Time per output token ↓'),'ms',1,rows,rows.map(row=>row.label),roles)}${chart('relative_cost_per_token',t('单位输出token成本 ↓','Cost per output token ↓'),`${roles.B0} = 1`,1,rows,rows.map(row=>row.label),roles)}</div></section>${versionSupplement(entry,rows,values,roles.B0)}<div class="detail-actions">${[...(!sr?[['compute',t('有效算力参考','Compute reference')]]:[]),...(modelIntegrationResults.has(entry.id)?[['development',t('书生适配开发对照（非正式基线）','Intern adaptation development comparison (not the formal baseline)')]]:[]),['methods',t('公式与比较方式','Formulas and comparison')],['quality',t('质量与评分明细','Quality and grading')],['evidence',t('原始证据','Original evidence')]].map(([key,label])=>`<button type="button"${key==='development'?' id="development-comparison"':''} data-detail="${key}">${label} ↗</button>`).join('')}</div>${detailDialog()}</section>`;
    const overview=root.querySelector('.goal-grid');
    if(coverageNote)overview.insertAdjacentHTML('beforebegin',coverageNote);
    overview.querySelectorAll('.result-card').forEach((card,i)=>{
      card.firstElementChild.textContent=cardNames[i];
      const label=cardScope[i];
      if(label)card.querySelector('small').textContent=label+' · '+card.querySelector('small').textContent;
    });
    if(!attempt&&!sr){
      root.querySelector('.dataset-coverage').insertAdjacentHTML('afterend',v2Assessment(entry,rows));
      if(entry.measurements.length){
        root.querySelector('[data-detail="metrics"]').insertAdjacentHTML('afterend',
          `<button type="button" data-detail="arm-metrics">${t('逐臂数值与尾时延','Per-arm metrics and tails')} ↗</button>`);
      }
      const revision=rmsRevisionPanel(entry);
      root.querySelector('#context-tenant-supplement').insertAdjacentHTML('afterend',candidateReportPanels(entry)+revision);
      bindCandidateReports(entry);
      if(revision)bindRmsRevision(entry);
    }
    if(observation)root.querySelector('.runtime-pair>div:last-child span').textContent+=' · '+observation.candidate.model;
    if(sr){
      const control=root.querySelector('.runtime-pair>div:first-child');
      control.querySelector('strong').textContent=roles.B0;
      control.querySelector('span').textContent='vLLM 0.28.1 / Ascend 0.25.1rc2 · CANN 9.1.0';
      root.querySelector('.runtime-pair>div:last-child strong').textContent=roles.B1;
      root.querySelector('[data-detail="controller-progress"]').remove();
    }
    if(!sr&&!observation&&!attempt&&!['r4','r5','r7','r8'].includes(entry.id))root.querySelector('.runtime-pair>div:last-child span').textContent=t('运行时身份见配置详情','See configuration details for runtime identity');
    if(attempt){const config=root.querySelector('.frozen-profile');config.querySelector('h2').textContent=t('本次运行配置','Run configuration');config.querySelector('.runtime-pair>div:last-child span').textContent=t('冻结前尝试，运行时身份见原件','Pre-freeze attempt; see originals for runtime identity');config.querySelector('.mod-tags').textContent=t('未形成冻结MOD组合','No frozen MOD stack');config.dataset.historyAttempt=entry.id;delete root.dataset.baselineId;}else{root.querySelector('.frozen-profile').dataset.historyRelease=entry.id;root.dataset.baselineId=sr?'B1-r8':releaseCatalog.baseline.id;}
    bindMenu();bindDetails(key=>sr?srDetails(entry,rows,key,roles):versionDetails(entry,rows,key,attempt));root.dataset.release=entry.id;root.dataset.loaded=entry.id==='r8'?'r8-continuous-20261117':attempt?'engine-release-attempt-'+entry.id:'engine-release-history-'+entry.id;root.dataset.layout='release-dashboard-v1';root.setAttribute('aria-busy','false');
  }
  const r8Mods = ['Extension Manager','BetterScale','Microflow','KV materialization','M01 correction','Packed host state','Sealed serving warmup','Guarded progress async','Capacity tuning','Short prefill tail'];
  function r8Rows() {
    return ['4096-formal','16384-formal'].map(phase=>{
      const arms=Object.fromEntries(['B0','B1'].map(role=>[role,{...currentR8.groups[role][phase],relative_cost_per_token:currentR8.groups.B0[phase].output_tokens_per_second/currentR8.groups[role][phase].output_tokens_per_second}]));
      const changes_percent=Object.fromEntries(['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map(key=>[key,100*(arms.B1[key]/arms.B0[key]-1)]));
      return {id:phase,arms,changes_percent};
    });
  }
  function r8Details(key) {
    if(key==='configuration')return {title:t('冻结配置','Frozen configuration'),body:`<p>B1 r8 · CorrectedWorker · E36/R54 · MTP2 · FULL · TP2 · async H2D · Tail256 · host 4 GiB/rank · KV 20 GiB/rank</p><div class="mod-tags">${r8Mods.map(name=>`<span>${name}</span>`).join('')}</div><p><a href="./engine.html#r8-mods">${t('MOD组合、版本与下载','MOD stack, versions and download')} ↗</a></p>`};
    if(key==='metrics')return {title:t('完整数值','Complete metrics'),body:['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map((field,i)=>`<h3>${[t('吞吐 · token/s','Throughput · token/s'),'TTFT · s','TPOT · ms',t('同费率成本 · B0 = 1','Equal-rate cost · B0 = 1')][i]}</h3>${table(t(['场景','B0','B1','变化'],['Context','B0','B1','Change']),r8Rows().map((row,j)=>[['4K','16K'][j],n(row.arms.B0[field]/(i===1?1000:1)),n(row.arms.B1[field]/(i===1?1000:1)),n(row.changes_percent[field])+'%']))}`).join('')};
    if(key==='methods')return {title:t('计算公式与比较方式','Formulas and comparison'),body:`<dl class="method-list"><dt>${t('配对条件','Pairing')}</dt><dd>${t('两臂相同71条预热与输入配方；并发8、输出256 token，每阶段提交300秒再排空；预热不计时。','Same 71 warmups and input recipe; concurrency 8, 256 output tokens, each phase submits for 300s then drains. Warmup is unscored.')}</dd><dt>${t('吞吐','Throughput')}</dt><dd>${t('完成输出token数 ÷ 包含排空的阶段耗时。','Completed output tokens / phase wall time including drain.')}</dd><dt>TTFT</dt><dd>${t('首内容token时刻 − 请求提交时刻，包含排队与prefill。','First content-token time − submission time, including queueing and prefill.')}</dd><dt>TPOT</dt><dd>${t('(响应完成时刻 − 首内容token时刻) ÷ (输出token数 − 1)，逐请求等权平均。','(Completion time − first content-token time) / (output tokens − 1), averaged equally across requests.')}</dd><dt>${t('同费率成本','Equal-rate cost')}</dt><dd>${t('设备费率与卡数相同：单位token成本比 = B0吞吐 / B1吞吐。图中B0 = 1。','With equal device rates and counts: unit token cost ratio = B0 throughput / B1 throughput. B0 = 1 in the chart.')}</dd></dl>`};
    return {title:t('原始证据','Original evidence'),body:`<p>${t('C8闭环 · 正式871请求、失败0 · 每臂一次。固定五项配对结果见本页图表与质量详情。','C8 closed loop · 871 measured requests, zero failures · one run per arm. The five-profile pairs are included in this page’s charts and quality details.')}</p><p><a href="./data/r8-continuous-20261117/summary-v1.json">${t('详细统计','Detailed statistics')} ↗</a> · <a href="${esc(currentR8.evidence.raw.url)}">${t('原始数据与CPU复算','Original data and CPU replay')} ↗</a></p><figure class="comparison-source-plot"><a href="./data/r8-continuous-20261117/continuous-B0-r8-v1.svg"><img src="./data/r8-continuous-20261117/continuous-B0-r8-v1.svg" width="2160" height="1440" alt="${t('B0与r8连续负载原始对照图','Original B0 and r8 continuous-load chart')}"></a></figure>`};
  }
  const datasetNames={mmlu:'MMLU-Pro',hle:'HLE-Verified',frontier:'FrontierScience',
    swe:'SWE-bench Pro',terminal:'Terminal-Bench 2.1'};
  const continuousProfile=id=>/^(?:continuous-|(?:4096|16384|32768)(?:-formal|-repeat)?$|multi-tenant-formal$)/.test(id);
  const cardList=cards=>validPhysicalCards(cards)?cards.join(' / '):'—';
  function frozenSettings(settings) {
    return `E${settings.E}/R${settings.R} · MTP${settings.MTP} · ${settings.graph} · TP2 · host ${settings.state_gib_per_rank} GiB/rank · KV ${settings.kv_gib_per_rank} GiB/rank`;
  }
  function rowWorkload(id,kind,source,variant) {
    if(kind==='fixed-data-context'||id.startsWith('real-context-')){
      return {kind:'fixed-data-context',source:source??null};
    }
    if(kind==='continuous-synthetic'||continuousProfile(id)){
      return {kind:'continuous-synthetic',source:null};
    }
    return {kind:kind??(['swe','terminal'].includes(id)?'published-agent-trace':'fixed-dataset'),
      dataset:datasetNames[id.replace(/(?:200|160|-trace)$/,'')]??null,
      ...(variant?{variant}:{})};
  }
  function workloadName(workload) {
    if(!workload)return '—';
    if(workload.kind==='continuous-synthetic')return t('合成 C8 闭环输入','Synthetic C8 closed-loop inputs');
    if(workload.kind==='fixed-data-context')return workload.source?formatContextWorkload(workload.source):
      t('真实历史回放，数据集见原件','Recorded task histories; dataset in source evidence');
    return [workload.dataset,workload.variant].filter(Boolean).join(' · ')||'—';
  }

  function renderSelectedBaseline() {
    const selected=comparisonBaselines.find(item=>item.id===selectedBaseline);
    const baseline={...selected,label:t(selected.label,selected.label_en||selected.label),model:selected.model||fixedBaseline.model};
    const entry=releaseEntry()||releaseCatalog.attempts.find(item=>item.id===selectedRelease)||srEntries?.find(item=>item.id===selectedRelease)||{id:selectedRelease,mods:[],measurements:[],release_url:'./report-history.html'};
    const observed=originalBaselineSelected()?{...fixedBaseline,runtime:fixedBaseline.baseline,
      hardware:{chip_model:fixedBaseline.chip_model,driver_version:fixedBaseline.driver_version??null},
      profiles:[...fixedBaseline.profiles,...fixedBaseline.context.observations.map(row=>({
        id:'real-context-'+row.phase,label:row.phase,workload_kind:'fixed-data-context',arm:{
          ...row.B0.metrics,mean_ttft_ms:row.B0.metrics.ttft_ms.mean,mean_tpot_ms:row.B0.metrics.tpot_ms.mean,
          physical_cards:row.B0.physical_cards??Object.keys(row.B0.utilization?.per_card_percent||{}).map(Number),
          source_seal_sha256:fixedBaseline.context.seal_sha256
        }
      }))]}:baselineObservations.get(baseline.id);
    const repair=b0RepairResult(baseline);
    const ftPair=repair&&entry.id==='r10'&&entry.release===r10PatchedFt?.B1.release
      ?r10PatchedFt.pairs[baseline.id.slice('official-'.length)]:null;
    const reason=observed?t('各臂实测原值分别列示。','Measurements are listed separately for each arm.'):
      t('B0 原值待发布。','B0 observations are awaiting publication.');
    const alternate=!originalBaselineSelected();
    const candidateModel=entry.id==='r6'?data.hardware.model:
      ((!entry.measurements?.length&&modelIntegrationResults.get(entry.id)?.candidate.model)||entry.model||fixedBaseline.model);
    const sourceRows=entry.id==='r6'?r6ArmRows('B1'):attemptIds.includes(entry.id)?[]:srIds.includes(entry.id)?srRows(entry):versionRows(entry);
    const contextSources={
      B0:sealedContextWorkload(baseline.context_input_sha256||
                              (originalBaselineSelected()?fixedBaseline.context?.protocol?.input_sha256:null)),
      B1:sealedContextWorkload(entry.context_tenant_supplement?.protocol?.input_sha256)
    };
    const baselineProfiles=new Map((observed?.profiles||[]).map(row=>[row.id,row]));
    const sourceIds=new Set(sourceRows.map(row=>row.id));
    const allRows=[...sourceRows,...[...baselineProfiles.values()].filter(row=>!sourceIds.has(row.id))
      .map(row=>({id:row.id,label:row.label||row.id}))];
    const rows=standardRows(allRows).map(row=>{
      const base=baselineProfiles.get(row.id);
      const candidate=row.arms?.B1||row.observation;
      const source=base?.source_metric;
      // Earlier C8 snapshots have their own seal and hardware provenance.
      const suiteCards=source?observed.hardware?.physical_devices:null;
      const archive=baselineCardMappings.get(baseline.id+'/'+row.id);
      const physicalCards=base?.arm.physical_cards??archive?.physical_cards??suiteCards;
      return {id:row.id,label:row.label,model:row.model||candidateModel,missingReason:reason,
        observation:candidate?{...candidate,relative_cost_per_token:null}:undefined,
        ...base&&{
          baselineObservation:{...base.arm,relative_cost_per_token:null,physical_cards:physicalCards??null},
          baselineModel:baseline.model,baselineQuality:base.quality??null,baselineExecutionScope:base.execution_scope??null,
          ...(source?{baselineSourceMetric:source}:{}),
          ...(archive?{baselineCardMapping:archive.source}:{}),
        },
        workloads:{
          B0:base?rowWorkload(row.id,base.workload_kind,contextSources.B0):null,
          B1:candidate?rowWorkload(row.id,row.workloadKind,row.workloadSource,
                                  row.variant):null
        }};
    });
    const isContext=row=>continuousProfile(row.id)||row.id.startsWith('real-context-');
    const context=rows.filter(isContext),performanceRows=rows.filter(row=>!isContext(row));
    const measured=(records,arm)=>records.filter(row=>Number.isFinite(row[arm]?.output_tokens_per_second)).length;
    const fixed=rows.filter(row=>fixedProfiles.some(([id])=>id===row.id));
    const fixedContext=context.filter(row=>row.id.startsWith('real-context-'));
    const coverage=(records,total)=>`B0 ${measured(records,'baselineObservation')}/${total} · B1 ${measured(records,'observation')}/${total}`;
    const mmlu=rows.find(row=>row.id==='mmlu'), b0Mmlu=mmlu.baselineObservation;
    const missingLatency=b0Mmlu?Object.entries({TTFT:b0Mmlu.mean_ttft_ms,TPOT:b0Mmlu.mean_tpot_ms})
      .filter(([,value])=>!Number.isFinite(value)).map(([name])=>name).join(' / '):'';
    if(alternate&&missingLatency)mmlu.coverageNote=t(
      `已发布吞吐，B0 公开记录缺 ${missingLatency}`,`Throughput published, B0 public record lacks ${missingLatency}`);
    const tenantBaseline=baselineProfiles.get('real-context-multi-tenant-formal');
    const supplement=entry.context_tenant_supplement;
    const tenantCandidate=supplement?.comparisons.find(row=>row.phase==='multi-tenant-formal');
    const isC24=phase=>phase?.cohort==='4096'&&phase.tenants===4&&phase.concurrency===24;
    const validPercent=value=>Number.isFinite(value)&&value>=0&&value<=100;
    function utilizationTable(role, utilization, link, sourceLabel) {
      const cards=Object.entries(utilization?.per_card_percent||{});
      if(cards.length!==2||!cards.every(([card,value])=>/^(0|[1-9][0-9]*)$/.test(card)&&validPercent(value))||
        !validPercent(utilization.mean_percent)||!Number.isFinite(utilization.covered_seconds)||
        utilization.covered_seconds<=0||!Number.isFinite(utilization.missing_seconds)||utilization.missing_seconds<0)return '';
      return `<div data-${role.toLowerCase()}-c24-utilization>
        <h3>${role} · ${t('4K 四租户 C24 正式窗口的 AI Core 采样','AI Core sampling for the formal 4K four-tenant C24 window')}</h3>
        ${table(t(['设备','AI Core 利用率'],['Device','AI Core utilization']),[
          ...cards.map(([card,value])=>[t('卡 '+card,'Card '+card),n(value)+'%']),
          [t('双卡均值','Two-card mean'),n(utilization.mean_percent)+'%']
        ])}
        <p>${t('采样覆盖','Sample coverage')} ${n(utilization.covered_seconds)} s ·
          ${t('采样缺口','Sampling gap')} ${n(utilization.missing_seconds)} s ·
          <a href="${esc(link)}">${sourceLabel}</a></p>
      </div>`;
    }
    const b0TenantUtilization=alternate&&isC24(tenantBaseline)&&
      utilizationTable('B0',tenantBaseline.utilization,'./'+baseline.observations.path,
        t('B0 机器可读实测','Machine-readable B0 observations'));
    const b1TenantUtilization=alternate&&isC24(supplement?.protocol.phases.find(phase=>phase.id==='multi-tenant'))&&
      utilizationTable('B1',tenantCandidate?.B1.utilization,supplement.raw_asset.url,
        t('B1 上下文与四租户原件','B1 context and four-tenant evidence'));
    const b0Rental=alternate?independentRental?.baselines?.[baseline.id]:null;
    const rentalTable=b0Rental?`<div data-b0-rental-observations>
      <h3>${t('B0 单臂实测与租金折算','B0 measurements and rental estimates')}</h3>
      <p>${t('按各臂原测窗口和公开租金折算','Based on the original measurement windows and the published rental rate')}
        · <a href="${esc(independentRental.rental_quote.url)}">${n(Number(independentRental.rental_quote.cny_per_card_month))}
        ${t('元/卡月','CNY/card-month')}</a> · <a href="./${independentRentalPath}">${t('数据和封存摘要','Data and evidence digests')}</a></p>
      ${table(t(['工况','元/百万成功输出 token','双卡平均 AI Core','逐卡 AI Core'],
                ['Workload','CNY per million successful output tokens','Mean AI Core, two cards','AI Core per card']),
        [['mmlu','MMLU-Pro 200'],['real-context-multi-tenant-formal',t('4K 四租户 C24','4K four tenants C24')]]
        .map(([id,label])=>{
          const row=b0Rental.workloads[id];
          return [label,n(row.estimated_cny_per_million_successful_output_tokens),n(row.utilization.mean_percent)+'%',
            row.physical_cards.map(card=>t('卡 ','Card ')+card+' · '+n(row.utilization.per_card_percent[card])+'%').join(' / ')];
        }))}
    </div>`:'';
    const tenantUtilization=b0TenantUtilization||b1TenantUtilization||rentalTable?
      `<div id="selected-c24-utilization" tabindex="-1">${rentalTable}${b0TenantUtilization||''}${b1TenantUtilization||''}</div>`:'';
    const goalNotes=[
      ftPair?t('已有补丁版 F/T 专项，见下方','Patched B0 F/T comparison below'):
        observed?.automatic_ft_audit?.status==='ineligible'?
          t('原版 B0 已测原生时间，算量核验未通过','Original B0 has native timing, but arithmetic qualification failed'):
          t('缺所选工况的原生算量或参考核验','Native work or reference qualification is missing'),
      t('固定负载已发布','Published fixed workloads')+' · '+coverage(fixed,fixedProfiles.length)+' · '+(missingLatency?
        t(`MMLU-Pro 的 B0 缺 ${missingLatency}`,`B0 MMLU-Pro lacks ${missingLatency}`):
        t('固定负载独立实测','Fixed profiles measured independently')),
      coverage(fixedContext,4)+' · '+t('三档上下文与四租户的原值覆盖','Raw coverage across three context ranges and four tenants'),
      (b0TenantUtilization?t('B0 有四租户逐卡采样 · ','B0 has four-tenant per-card samples · '):'')+
        t('缺同工况成本与逐卡利用率的配对核验','Paired cost and per-card utilization for a matched workload are unverified')
    ];
    const scopeLink=new URLSearchParams({release:entry.id,b0:releaseCatalog.baseline.id});
    const revision=entry.id==='r10'&&(archivedR10Selected()?r10ArchivedVersion:currentR10Version());
    if(revision)scopeLink.set('revision',revision);
    const outlineScope=alternate?`<p class="comparison-meta" data-outline-scope>
      <span>${t('课题四 V2 正式判定使用固定 B0 0.18。','Topic 4 V2 acceptance uses the fixed B0 0.18.')}</span>
      ${entry===releaseEntry()?`<a href="./b0-b1.html?${esc(scopeLink.toString())}#acceptance-stages">${t('查看同版 B1 的正式判定','View formal assessment for this B1')} ↗</a>`:''}</p>`:'';
    const rawMetrics=selected=>table(t(
      ['工况','B0 数据集或负载','B1 数据集或负载','B0 token/s','B1 token/s','B0 TTFT / ms','B1 TTFT / ms','B0 TPOT / ms','B1 TPOT / ms'],
      ['Scenario','B0 dataset or workload','B1 dataset or workload','B0 token/s','B1 token/s','B0 TTFT / ms','B1 TTFT / ms','B0 TPOT / ms','B1 TPOT / ms']
    ),selected.map(row=>[row.label,workloadName(row.workloads.B0),workloadName(row.workloads.B1),
      n(row.baselineObservation?.output_tokens_per_second),n(row.observation?.output_tokens_per_second),
      n(row.baselineObservation?.mean_ttft_ms),n(row.observation?.mean_ttft_ms),
      n(row.baselineObservation?.mean_tpot_ms),n(row.observation?.mean_tpot_ms)]));
    const contextTable=rawMetrics(context);
    const sourceLabels=Object.entries(contextSources).filter(([,source])=>source)
      .map(([role,source])=>role+': '+formatContextWorkload(source));
    const contextDescription=sourceLabels.length?'<p data-context-workloads>'+t('真实历史回放','Recorded task histories')+' · '+esc(sourceLabels.join(' · '))+'</p>':'';
    const roles={B0:baseline.label,B1:'B1-'+entry.id};
    document.getElementById('comparison-title').textContent=t(baseline.label+' / B1 '+entry.id+' 测试记录',baseline.label+' / B1 '+entry.id+' test records');
    const models=[...new Set(rows.filter(row=>row.observation).map(row=>row.model))];
    document.getElementById('comparison-lead').textContent='B0: '+baseline.model+' · B1: '+(models.join(' / ')||candidateModel);
    const note=t('同模型不代表可配对；须核验设备、驱动、权重、输入、预算和计时协议。','The same model alone does not establish a matched pair: devices, drivers, weights, inputs, budgets and timing must be verified.');
    const scores=rows.flatMap(row=>[['B0',row.baselineObservation],['B1 '+entry.id,row.observation]].filter(([,arm])=>Number.isInteger(arm?.correct)&&Number.isInteger(arm?.requests)).map(([role,arm])=>[row.label,role,arm.correct+'/'+arm.requests,arm.failed??'—',arm.truncated??'—']));
    const trackScores=(observed?.profiles||[]).flatMap(row=>Object.entries(row.quality?.tracks||{}).map(([track,grade])=>[baseline.label,row.label||row.id,track,grade.successes+'/'+grade.total,grade.graded,grade.unresolved??grade.judge_unresolved??'—']));
    const hle=(observed?.profiles||[]).find(row=>row.id==='hle');
    const qualityScope=hle?.execution_scope&&hle.quality?.judge_model?'<p>'+esc('B0 HLE '+hle.execution_scope.selected_tasks+'/'+hle.execution_scope.source_tasks+' · '+hle.quality.judge_model+' · '+t('替代裁判，非官方榜单复现','substitute judge, not an official leaderboard replication'))+'</p>':'';
    const native=observed?.native_timing;
    const nativeStatus=observed?.automatic_ft_audit?.status==='ineligible'?t('算量适用性未通过；F 与效率未计算。','Arithmetic applicability is ineligible; F and efficiency are uncomputed.'):observed?.necessary_work_certified===true?t('算量与效率见本版核验报告。','See this version’s qualification report for arithmetic and efficiency.'):t('算量资格尚未发布。','Arithmetic qualification is unpublished.');
    const nativeDetail=native?'<p>'+esc(t('原生计时；保留原始轮次，不计入五项吞吐图。','Native timing; original runs, separate from fixed-five throughput.'))+'</p>'+table(t(['轮次','原始 T / 秒','输出 token'],['Run','Original T / s','Output tokens']),native.repetitions.map(row=>[row.repetition,row.T_seconds,row.output_tokens]))+'<p>'+esc(nativeStatus)+'</p>':'';
    const repairEvidence=repair?pinnedSource('https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/main/reports/b0-mtp-kv-prefix-repair-v1/README.md'):null;
    const repairLink=repairEvidence?'<p><a href="'+esc(repairEvidence)+'">'+t('Benchmark 记录与复算','Benchmark evidence and replay')+'</a></p>':'';
    const formatFtInterval=values=>values.map(value=>Number(value).toFixed(3)).join('–');
    const comparisonEvidence=ftPair?pinnedSource('https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/main/reports/r10-stable-patched-b0-ft-20261123-v1/README.md'):null;
    const comparisonLink=ftPair?'<p><a href="'+esc(comparisonEvidence)+'">'+
      t('F/T 专项对照与复算','F/T comparison and replay')+'</a></p>':'';
    const archivedPair=repair&&entry.id==='r10'&&releaseCatalog.archived_r10&&
      r10PatchedFt?.pairs[baseline.id.slice('official-'.length)];
    const supplementalFt=ftPair?`<p class="comparison-meta" data-b0-ft-overview>
      <span>${t('历史 R10 与所选版本 B0 补丁版 · MMLU-Pro 200 / out256','Archived R10 and patched B0 for the selected version · MMLU-Pro 200 / out256')}
      · ${t('有效算力比','Effective-compute ratio')} <strong>${esc(formatFtInterval(ftPair.B1_over_B0_effective_compute_interval))}×</strong></span>
      <a href="${esc(comparisonEvidence)}">${t('专项报告与原件','Supplemental report and evidence')} ↗</a></p>`:
      archivedPair?`<p class="comparison-meta" data-b0-ft-archive><a data-r10-route-version="${esc(r10ArchivedVersion)}" href="${esc(r10RevisionHref(r10ArchivedVersion))}">
      ${t('查看历史 R10 与此 B0 补丁版的 F/T 对照','View archived R10 against this patched B0')} ↗</a></p>`:'';
    const comparisonDetail=ftPair?'<div data-r10-patched-b0-ft><p><strong>R10 '+
      esc(formatFtInterval(r10PatchedFt.B1.tflops_per_card_interval))+' TFLOP/s/'+t('卡','card')+'</strong> · '+
      esc(t('R10 / 补丁版 B0','R10 / patched B0')+' '+formatFtInterval(ftPair.B1_over_B0_effective_compute_interval))+'×</p><p>'+
      t('三轮合计计时','Elapsed time over three rounds')+' · B0 '+esc(Number(ftPair.B0.T_seconds).toFixed(3))+' s · R10 '+
      esc(Number(r10PatchedFt.B1.T_seconds).toFixed(3))+' s</p>'+comparisonLink+'</div>':'';
    const repairDetail=repair?'<div data-b0-kv-prefix-repair><h3>'+t('MTP KV 补丁复测','MTP KV patch retest')+'</h3><p>'+
      esc(ftPair?t('使用同序输入、同一预热和采样设置的补丁版 B0 与 R10。','Patched B0 and R10 used the same ordered inputs, warmup and sampling.'):
        t('这组独立复测覆盖带补丁的 B0。','This retest covers the patched B0.'))+'</p><p>'+
      esc(repair.repetitions.length+' × '+b0RepairReport.workload.requests_per_formal_repetition+' '+t('请求','requests')+
      ' · '+b0RepairReport.workload.output_tokens_per_request+' '+t('输出 token/请求','output tokens/request'))+'</p>'+
      '<p><strong>'+(ftPair?'B0 ':'')+esc(formatFtInterval(repair.tflops_per_card_interval))+
      ' TFLOP/s/'+t('卡','card')+'</strong></p>'+repairLink+comparisonDetail+'</div>':'';
    const b0Configuration={
      id:baseline.id,profile:baseline.profile.url,model:baseline.model,cann:baseline.cann,
      precision:baseline.precision??observed?.precision??null,tensor_parallel_size:baseline.tensor_parallel_size??observed?.tensor_parallel_size??null,
      runtime:observed?.runtime??baseline.source_identity??null,image_digest:baseline.image_digest??null,
      hardware:observed?.hardware??null
    };
    const b1Configuration={
      id:entry.id,release:entry.release??null,run:entry.run??null,release_url:entry.release_url??null,
      profile:entry.profile?.url??entry.source?.url??entry.release_url??null,
      model:candidateModel,settings:entry.settings??null,mods:entry.mods??(entry.name?[entry.name]:null),
      receipt_sha256:entry.receipt_sha256??null,source_manifest_sha256:entry.source_manifest_sha256??null
    };
    const title=t(['版本与配置详情','完整数值','上下文与四租户','有效算力参考','计算公式与比较方式','质量与评分明细','原始证据'],
                  ['Versions and configuration','Complete metrics','Context and four tenants','Compute reference','Formulas and comparison','Quality and grading','Original evidence']);
    const detail=key=>{
      const links='<p><a href="'+esc(baseline.profile.url)+'">'+esc(baseline.label)+'</a> · <a href="'+esc(b1Configuration.profile||'./report-history.html')+'">B1 '+esc(entry.id)+'</a></p>';
      if(key==='configuration'){
        const cards=rows.filter(row=>row.baselineObservation||row.observation).map(row=>[
          row.label,cardList(row.baselineObservation?.physical_cards),cardList(row.observation?.physical_cards)
        ]);
        const settings=b1Configuration.settings?'<p>'+esc(frozenSettings(b1Configuration.settings))+'</p>':'';
        const mods=(b1Configuration.mods||[]).map(mod=>'<span>'+esc(mod)+'</span>').join('');
        const runtime=b0Configuration.runtime;
        const identity=[
          ...Object.entries(runtime?.versions||{}),
          [t('镜像摘要','Image digest'),b0Configuration.image_digest],
          [t('基础镜像摘要','Base image digest'),runtime?.base_image_digest],
          ['vLLM commit',runtime?.vllm_source_commit],
          ['vLLM Ascend commit',runtime?.ascend_source_commit],
          [t('请求图模式','Requested graph mode'),runtime?.requested_graph_mode],
          [t('生效图模式','Effective graph mode'),runtime?.requested_graph_mode?(runtime.effective_graph_mode??t('未从封存元数据复原','Unresolved from sealed metadata')):null],
          ['npu-smi',b0Configuration.hardware?.npu_smi_version]
        ].filter(([,value])=>value);
        const runtimeDetails=identity.length?table(t(['B0 运行时字段','冻结值'],['B0 runtime field','Frozen value']),identity):'';
        return {title:title[0],body:links+table(t(['运行臂','版本','模型','运行时或设备'],['Arm','Version','Model','Runtime or hardware']),[
          ['B0',baseline.label,baseline.model,[
            baseline.cann?'CANN '+baseline.cann:null,b0Configuration.precision,b0Configuration.tensor_parallel_size?'TP'+b0Configuration.tensor_parallel_size:null,
            observed?.hardware?.chip_model,observed?.hardware?.driver_version??t('驱动版本未记录','Driver version not recorded')
          ].filter(Boolean).join(' · ')],
          ['B1',b1Configuration.release??b1Configuration.run??entry.id,candidateModel,t('见本版冻结配置','See this version’s configuration')]
        ])+runtimeDetails+settings+(mods?'<div class="mod-tags">'+mods+'</div>':'')+
          table(t(['工况','B0 物理卡号','B1 物理卡号'],['Scenario','B0 physical cards','B1 physical cards']),cards)};
      }
      if(key==='metrics'||key==='supplement')return {title:title[key==='metrics'?1:2],body:rawMetrics(key==='metrics'?rows:context)};
      if(key==='compute')return {title:title[3],body:(ftPair?'<h3>'+t('官方原版 B0','Unmodified official B0')+'</h3>':'')+
        (nativeDetail||'<p>'+esc(reason)+'</p>'+links)+repairDetail};
      if(key==='methods')return {title:title[4],body:'<p>'+esc(reason)+'</p><p>'+esc(note)+'</p>'+
        '<p>'+t('吞吐取成功输出词元数除以含排空的耗时；时延使用各臂原测均值。','Throughput divides successful output tokens by elapsed time including drain. Latencies use each arm’s original means.')+'</p>'+links};
      if(key==='quality')return {title:title[5],body:table(t(['工况','运行臂','正确 / 请求','失败','截断'],['Scenario','Arm','Correct / requests','Failed','Truncated']),scores)+
        (trackScores.length?table(t(['运行臂','工况','评分组','成功 / 计划','已评分','未解析'],['Arm','Scenario','Track','Successes / planned','Graded','Unresolved']),trackScores)+qualityScope:
        '')+'<p>'+t('未解析保留分母。SWE/Terminal 仅测轨迹推理。','Unresolved cases retain their denominators. SWE/Terminal measure trace inference only.')+'</p>'+links};
      const sealedRows=rows.filter(row=>row.baselineObservation||row.observation).map(row=>[
        row.label,row.baselineObservation?.source_seal_sha256??'—',row.observation?.source_seal_sha256??'—'
      ]);
      const priorArchives=(baseline.previous_evidence||[]).map(archive=>
        '<p><a href="'+esc(archive.url)+'">'+t('B0 早期公开封存','Earlier public B0 archive')+'</a><br><code>'+esc(archive.sha256)+'</code></p>'
      ).join('');
      const eventProof=[
        [t('B1 运行回执','B1 run receipt'),b1Configuration.receipt_sha256],
        [t('B1 来源清单','B1 source manifest'),b1Configuration.source_manifest_sha256]
      ].filter(([,digest])=>digest).map(([label,digest])=>'<p>'+esc(label)+' · <code>'+esc(digest)+'</code></p>').join('');
      const replayUrl=observed?.original_sse_replay?.report_url;
      const replayLink=/^https:\/\/github\.com\/vLLM-HUST\/vllm-hust-benchmark\/blob\/main\/reports\/[a-z0-9/_-]+\.md$/i.test(replayUrl||'')?
        '<p><a href="'+esc(pinnedSource(replayUrl))+'">'+
        t('原请求流复算与计时口径','Original stream replay and timing method')+'</a></p>':'';
      return {title:title[6],body:links+priorArchives+eventProof+repairLink+comparisonLink+replayLink+
        (baseline.evidence?.url?'<p><a href="'+esc(baseline.evidence.url)+'">'+t('B0 原件与 CPU 报告重建','B0 original evidence and CPU report reconstruction')+'</a></p>':'')+
        (baseline.observations?.path?'<p><a href="./'+esc(baseline.observations.path)+'">'+t('B0 机器可读实测','Machine-readable B0 observations')+'</a></p>':'')+
        ((entry.sources||[]).length?'<p>'+entry.sources.map(source=>'<a href="'+esc(pinnedSource(source.url))+'">'+esc(sourceLabel(source.url))+'</a>').join(' · ')+'</p>':'')+
        table(t(['工况','B0 封存 SHA-256','B1 封存 SHA-256'],['Scenario','B0 seal SHA-256','B1 seal SHA-256']),sealedRows)};
    };
    root.innerHTML=`<section class="comparison-dashboard" data-comparison="selected-b0">${releaseMenu()}${outlineScope||
      `<div class="comparison-meta"><span>${esc(reason)}</span></div>`}
      <div class="goal-grid">${names().map((name,i)=>`<article class="result-card"><span>${alternate?'4.'+(i+1)+' ':''}${name}</span><strong>—</strong>
        <small>${esc(alternate?goalNotes[i]:t('所选组合暂无核验配对','No verified pair for the selected combination'))}
        ${i===3&&tenantUtilization?`<br><a href="#selected-c24-utilization" data-c24-samples-link>${t('查看逐卡采样','View per-card samples')} ↗</a>`:''}</small></article>`).join('')}</div>
      ${supplementalFt}
      ${frozenProfile(entry.id,{B0:baseline.cann,B1:'—'},entry.mods||[],entry.settings?frozenSettings(entry.settings):t('配置以各自来源为准','See each source for configuration'))}
      ${coverageView(rows)}<section><div class="section-heading"><h2>${t('性能与成本','Performance and cost')}</h2><button type="button" data-detail="metrics">${t('查看数值','View metrics')} ↗</button></div><p class="chart-scale-note">${esc(reason)}</p><div class="metric-grid">
      ${chart('output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s',1,performanceRows,performanceRows.map(row=>row.label),roles)}
      ${chart('mean_ttft_ms',t('首token时延 ↓','Time to first token ↓'),'s',1000,performanceRows,performanceRows.map(row=>row.label),roles)}
      ${chart('mean_tpot_ms',t('逐token时延 ↓','Time per output token ↓'),'ms',1,performanceRows,performanceRows.map(row=>row.label),roles)}
      ${chart('relative_cost_per_token',t('单位输出token成本 ↓','Cost per output token ↓'),'—',1,performanceRows,performanceRows.map(row=>row.label),roles)}</div></section>
      <section id="context-tenant-supplement"><div class="section-heading"><h2>${t('上下文与四租户补测','Context and four-tenant supplement')}</h2><button type="button" data-detail="supplement">${t('查看数值','View metrics')} ↗</button></div><div class="supplement-highlights">${[t('16K 吞吐比','16K throughput ratio'),t('32K 吞吐比','32K throughput ratio'),t('四租户收益','Four-tenant improvement')].map(label=>`<div><span>${label}</span><strong>—</strong></div>`).join('')}</div>${contextDescription}<div class="supplement-plot${context.length?'':' missing-plot'}" style="background:transparent">${context.length?contextTable:esc(reason)}</div>${tenantUtilization}</section>
      <div class="detail-actions">${['compute','methods','quality','evidence'].map(key=>`<button type="button" data-detail="${key}">${t({compute:'有效算力参考',methods:'公式与比较方式',quality:'质量与评分明细',evidence:'原始证据'}[key],{compute:'Compute reference',methods:'Methods',quality:'Quality',evidence:'Evidence'}[key])} ↗</button>`).join('')}<button type="button" id="comparison-export">${t('导出所选组合','Export selection')}</button></div>${detailDialog()}</section>`;
    root.querySelector('#context-tenant-supplement').insertAdjacentHTML('afterend',candidateReportPanels(entry));
    bindCandidateReports(entry);
    const control=root.querySelector('.runtime-pair>div:first-child');
    control.querySelector('strong').textContent=baseline.label;
    control.querySelector('span').textContent='CANN '+baseline.cann+' · '+baseline.model;
    root.querySelector('.runtime-pair>div:last-child span').textContent=
      [b1Configuration.release,candidateModel,t('运行时见配置原件','Runtime in the configuration source')].filter(Boolean).join(' · ');
    root.querySelector('[data-detail="controller-progress"]')?.remove();
    bindMenu();bindDetails(detail);
    root.querySelector('[data-c24-samples-link]')?.addEventListener('click',event=>{
      event.preventDefault();
      const samples=root.querySelector('#selected-c24-utilization');
      samples.focus({preventScroll:true});
      samples.scrollIntoView({block:'start'});
    });
    root.querySelector('#comparison-export').onclick=()=>{
      const payload={schema:'selected-b0-b1-observations/v1',baseline:baseline.id,candidate:entry.id,paired:false,reason,rows,context,context_workloads:contextSources,configuration:{B0:b0Configuration,B1:b1Configuration},
        native_timing:observed?.native_timing??null,automatic_ft_audit:observed?.automatic_ft_audit??null};
      if(b0Rental)payload.independent_b0_rental={quote:independentRental.rental_quote,
        source:independentRentalPath,workloads:b0Rental.workloads};
      if(ftPair)payload.native_fixed200_ft={...ftPair,B1:r10PatchedFt.B1,protocol:r10PatchedFt.protocol,report:comparisonEvidence};
      const reports=candidateReports(entry).map(({kind,summary,readme,websitePath})=>({
        kind,baseline:releaseCatalog.baseline.id,summary:{...summary,path:websitePath,url:pinnedSource(summary.url)},report:pinnedSource(readme.url)
      }));
      if(reports.length)payload.candidate_reports=reports;
      const link=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      link.href=url;
      link.download=baseline.id+'-B1-'+entry.id+'.json';
      link.hidden=true;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    };
    root.dataset.baselineId=baseline.id;root.dataset.release=entry.id;root.dataset.loaded='selected-b0-'+baseline.id;
    root.dataset.layout='release-dashboard-v1';root.setAttribute('aria-busy','false');
  }
  function render() {
    if(!releaseCatalog||!selectedRelease||!selectableIds.includes(selectedRelease))return;
    renderEngineComparison();
    renderControllerPanel();
  }
  function renderEngineComparison() {
    if(developmentComparison()){renderVersion();return;}
    if(!originalBaselineSelected()||srIds.includes(selectedRelease)){renderSelectedBaseline();return;}
    if(selectedRelease!=='r6'){if(selectedRelease!=='r8'||currentR8)renderVersion();return;}
    if(!data||!combination)return;
    renderR6();root.querySelector('.comparison-dashboard').insertAdjacentHTML('afterbegin',releaseMenu());
    root.querySelector('.frozen-profile').insertAdjacentHTML('afterend',coverageView(data.datasets));
    root.querySelector('.goal-grid').insertAdjacentHTML('beforebegin',`<p class="assessment-history-note">${t('原报告判定 · 历史 3.4.x 大纲','Original report assessment · historical outline 3.4.x')}</p>`);
    const r6B0=r6ArmRows('B0');
    const r6Rows=r6ArmRows('B1').map((row,i)=>({id:row.id,arms:{B0:r6B0[i].observation,B1:row.observation}}));
    root.querySelector('.dataset-coverage').insertAdjacentHTML('afterend',v2Assessment(releaseEntry(),r6Rows));
    bindMenu();root.dataset.baselineId=releaseCatalog.baseline.id;root.dataset.release='r6';root.dataset.layout='release-dashboard-v1';
  }
  async function loadR8() {
    const response=await fetch('./data/r8-continuous-20261117/summary-v1.json',{cache:'no-cache'});
    if(!response.ok)throw Error('r8 publication unavailable');
    const raw=await response.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==currentR8Sha)throw Error('r8 publication checksum mismatch');
    const value=JSON.parse(new TextDecoder().decode(raw));
    if(value.schema!=='r8-first-current-continuous-pair/v1'||value.formal_requests!==871||value.failures!==0||value.candidate!=='B1 r8'||value.independent_runs_per_arm!==1)throw Error('r8 publication scope mismatch');
    currentR8=value;
  }
  async function showRelease() {
    const request=++releaseRequest;
    root.setAttribute('aria-busy','true');delete root.dataset.error;
    try {
      if(!await openPublicationIsCurrent()||request!==releaseRequest)return;
      const loaded=await Promise.all([loadReleaseCatalog(), controllerProgress ? Promise.resolve() : loadControllerProgress(), loadSr().then(()=>null,error=>error), loadControllerResults().catch(error=>console.warn('Controller results rejected',error))]);
      if(request!==releaseRequest)return;
      if(loaded[2]&&/^sr/.test(selectedRelease||''))throw loaded[2];
      selectableIds=[...releaseIds,...attemptIds,...srIds];
      if(automaticRelease){
        const recommended=selectedBaseline===releaseCatalog.baseline.id&&
          latestCompleteRelease(releaseCatalog,selectedRelease);
        if(recommended){
          selectedRelease=recommended.id;
          selectedRevision=recommended===releaseCatalog.archived_r10?recommended.stable_evidence.pypi_version:null;
        }
        automaticRelease=false;
      }
      if(!selectableIds.includes(selectedRelease)){
        releaseFallback=releaseFallback||!!selectedRelease;
        selectedRelease=latestFrozenRelease(releaseCatalog);
      }
      if(srIds.includes(selectedRelease)&&!srEntries)await loadSr();
      else if(selectedRelease==='r8'&&!currentR8)await loadR8();
      else if(selectedRelease==='r6'&&!data)await loadR6();
      if(request!==releaseRequest)return;
      const url=new URL(location.href);
      if(releaseFallback)url.searchParams.set('release',selectedRelease);
      if(!selectedRevision&&selectedRelease==='r10'&&releaseCatalog.archived_r10&&!submissionAssessments.has(releaseEntry())&&
         selectedBaseline===releaseCatalog.baseline.id&&/^#(?:method-4|metric-4)$/.test(url.hash)){
        selectedRevision=r10ArchivedVersion;
        url.searchParams.set('release',selectedRelease);
        url.searchParams.set('revision',selectedRevision);
      }
      if(!archivedR10Selected()&&(selectedRelease!=='r10'||selectedRevision!==currentR10Version())){
        selectedRevision=null;
        url.searchParams.delete('revision');
      }
      if(controllerFallback)url.searchParams.delete('controlplane');
      if(!comparisonBaselines.some(item=>item.id===selectedBaseline)){
        baselineFallback=true;selectedBaseline=releaseCatalog.baseline.id;
        url.searchParams.set('b0',selectedBaseline);
      }
      if((url.searchParams.has('b0')||!developmentRelease())&&url.searchParams.has('comparison'))url.searchParams.delete('comparison');
      if(url.href!==location.href)history.replaceState(null,'',url);
      render();openLinkedDetail();
    } catch(error) {
      if(request!==releaseRequest)return;
      delete root.dataset.loaded;delete root.dataset.release;delete root.dataset.baselineId;
      console.error('Release publication rejected',error);root.dataset.error='publication-rejected';root.setAttribute('aria-busy','false');
      root.innerHTML=releaseMenu()+`<p>${t('当前版本结果加载或校验失败。','Selected release results unavailable or verification failed.')}</p>`;bindMenu();
    }
  }
  window.addEventListener('vllm-hust:langchange',render);
  window.addEventListener('hashchange',openLinkedDetail);
  window.addEventListener('popstate',()=>{readComparisonLocation();showRelease();});
  window.addEventListener('focus',openPublicationIsCurrent);
  document.addEventListener('visibilitychange',openPublicationIsCurrent);
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    releaseCatalog=null;catalogRequest=null;srEntries=null;srIds=[];controllerResults=null;
    readComparisonLocation();
    showRelease();
  });
  showRelease();
})();
