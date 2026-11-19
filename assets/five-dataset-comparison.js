(() => {
  'use strict';
  // Update this committed source path only after the new benchmark report is audited.
  const summaryPath = 'data/five-datasets-r6-20261114/summary-public-v3.json';
  const supplementAnalysisSha = '0e3947af17badfa7edb244a2ca397c5367480678eeb416bb1c1f886d02c08c5f'; // pragma: allowlist secret -- fixed public evidence digest
  if (/^#(?:method-[1-4]|method-b0|metric-[1-4]|current-qualified-compute|b0-baseline|acceptance-stages|comparison)$/.test(location.hash)) {
    location.replace('./b0-b1-legacy.html'+location.hash);
    return;
  }
  const root = document.getElementById('five-dataset-comparison');
  if (!root) return;
  const combinationPath = 'data/five-datasets-r6-20261114/frozen-combination-v1.json';
  let data, manifest, combination, controllerProgress;
  const t = (zh, en) => window.vllmHustSite.getCurrentLang() === 'zh' ? zh : en;
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number.isFinite(v) ? v.toFixed(2) : '—';
  const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= 1e-8 * Math.max(1, Math.abs(b));
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
  function chart(key, title, unit, divisor = 1, rows = data.datasets, labels = profileNames(), roles = {B0:'B0',B1:'B1'}) {
    const maximum = Math.max(1,...rows.filter(row=>row.arms?.B0&&row.arms?.B1).map(d=>d.arms.B1[key]/d.arms.B0[key]));
    return `<article class="metric-chart" data-metric="${key}"><header><h3>${title}</h3><span>${unit}</span></header><div class="chart-legend"><span class="legend-b0">${esc(roles.B0)}</span><span class="legend-b1">${esc(roles.B1)}</span></div>${rows.map((row,i)=>{
      if(!row.arms?.B0||!row.arms?.B1)return `<div class="chart-row metric-missing" data-profile="${esc(row.id)}" data-missing="true"><div class="chart-row-heading"><strong>${esc(labels[i])}</strong><span aria-label="${t('无配对数据','No paired data')}">—</span></div><p class="missing-metric">${esc(row.missingReason||t('本版未发布配对数据','No published pair for this version'))}</p></div>`;
      const change = key==='estimated_cny_per_million_output_tokens' ? row.changes_percent.unit_cost_change_percent : row.changes_percent[key];
      const good = key==='output_tokens_per_second' ? change>=0 : change<=0;
      return `<div class="chart-row" data-profile="${row.id}"><div class="chart-row-heading"><strong>${esc(labels[i])}${row.workloadLabel?`<small class="chart-workload-label">${esc(row.workloadLabel)}</small>`:''}</strong><span class="metric-change ${good?'favorable':'regression'}">${change>0?'+':''}${n(change)}%</span></div>${['B0','B1'].map(role=>{
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
    if(hash!==matches[0].sha256 || bytes.byteLength!==matches[0].bytes) throw Error('Controller publication checksum mismatch');
    const value=JSON.parse(new TextDecoder().decode(bytes));
    const result=value.result;
    if(value.schema!=='controller-experiment-progress/v1' || !result.completed_pair || value.state_resident_seats!==80 || value.repetitions_per_arm!==1 || value.task_quality_evaluated!==false || !Array.isArray(value.profiles) || !Array.isArray(value.changelog)) throw Error('Invalid controller comparison scope');
    for(const arm of [result.direct,result.request_throttling_controller]) {
      if(arm.completed_tasks!==112 || arm.successful_requests!==336 || arm.failed_requests!==0 || !Number.isFinite(arm.elapsed_seconds) || arm.elapsed_seconds<=0) throw Error('Incomplete controller comparison');
    }
    if(!close(result.time_reduction_percent,100*(1-result.request_throttling_controller.elapsed_seconds/result.direct.elapsed_seconds))) throw Error('Controller arithmetic mismatch');
    controllerProgress=value;controllerProgressCommit=publication.commit;
  }
  function detailDialog() {
    return `<dialog id="comparison-detail-dialog" class="comparison-dialog" aria-labelledby="comparison-dialog-title"><div class="dialog-header"><h2 id="comparison-dialog-title"></h2><button type="button" class="dialog-close" aria-label="${t('关闭详情','Close details')}">×</button></div><div id="comparison-dialog-body"></div></dialog>`;
  }
  function bindDetails(content) {
    const dialog=root.querySelector('dialog');
    root.querySelectorAll('[data-detail]').forEach(button=>button.addEventListener('click',()=>{
      const value=button.dataset.detail==='controller-progress' ? controllerProgressContent() : content(button.dataset.detail);
      root.querySelector('#comparison-dialog-title').textContent=value.title;
      root.querySelector('#comparison-dialog-body').innerHTML=value.body;
      dialog.showModal();
    }));
    root.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog && event.clientX>=dialog.getBoundingClientRect().right)dialog.close();});
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
  let releaseIds = ['r8','r7','r6','r5','r4'];
  let attemptIds = ['r3','r2','r1'];
  const srIds = ['sr2','sr1'];
  let selectableIds = [...releaseIds,...attemptIds,...srIds];
  const requestedRelease = new URL(location.href).searchParams.get('release');
  let selectedRelease = /^(?:r[1-9][0-9]*|sr[12])$/.test(requestedRelease||'') ? requestedRelease : null;
  let releaseCatalog = null;
  let catalogRequest = null;
  let releaseRequest = 0;
  const historyPath = 'data/engine-release-history-v1.json';
  async function loadReleaseCatalog() {
    if (releaseCatalog) return;
    if (catalogRequest) return catalogRequest;
    catalogRequest = (async () => {
      const response = await fetch('./data/benchmark-source-manifest.json',{cache:'no-cache'});
      if (!response.ok) throw Error('Release manifest unavailable');
      const publication = await response.json();
      if (publication.repository !== 'vLLM-HUST/vllm-hust-benchmark' || publication.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(publication.commit)) throw Error('Invalid release catalog publisher');
      const entries = publication.files.filter(row=>row.website_path===historyPath);
      if (entries.length!==1) throw Error('Ambiguous release catalog source');
      const result = await fetch('./'+historyPath,{cache:'no-cache'});
      if (!result.ok) throw Error('Release catalog unavailable');
      const raw = await result.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
      if (digest!==entries[0].sha256 || raw.byteLength!==entries[0].bytes) throw Error('Release catalog checksum mismatch');
      const value = JSON.parse(new TextDecoder().decode(raw));
      if (value.schema!=='vllm-hust-engine-release-history/v1' || !Array.isArray(value.order) || !value.order.length || value.order.some(id=>!/^r[1-9][0-9]*$/.test(id)) || new Set(value.order).size!==value.order.length || !value.order.includes(value.default_release) || value.entries?.length!==value.order.length) throw Error('Invalid release catalog scope');
      const baseline=value.baseline;
      if (baseline?.id!=='original018-cann8.5.1' || baseline.vllm!=='0.18.0' || baseline.vllm_ascend!=='0.18.0' || baseline.cann!=='8.5.1' || baseline.sdk_source_map_sha256!=='a357ad8cf1ff6f8797fb2d6476e71a0deef5ee0899a55ea32ed65f07fe7773bc' || baseline.image_digest!=='sha256:2467d259ff068ca4edd7b50b849152910f3c05e435f314639fc06bcc7a00f9fa') throw Error('Unexpected fixed B0 identity'); // pragma: allowlist secret -- fixed public B0 image and SDK digests
      for (const id of value.order) {
        const matches = value.entries.filter(row=>row.id===id);
        if(matches.length!==1) throw Error('Ambiguous release identity');
        const entry=matches[0];
        if (entry.baseline_id!==baseline.id || !entry.release.endsWith('-'+id) || !entry.mods?.length || !entry.profile?.url || !Array.isArray(entry.measurements)) throw Error('Incomplete release identity');
        for (const measurement of entry.measurements) {
          if (measurement.control!=='B0' || measurement.baseline_id!==baseline.id || measurement.candidate!==id || measurement.arms?.length!==2 || measurement.arms[0].role!==measurement.control || measurement.arms[1].role!==id) throw Error('Release measurement identity mismatch');
          for (const arm of measurement.arms) {
            if (![arm.output_tokens_per_second,arm.mean_ttft_ms,arm.mean_tpot_ms,arm.output_tokens,arm.duration_seconds,arm.requests].every(v=>Number.isFinite(v)&&v>0) || !Number.isInteger(arm.failed) || arm.failed<0 || !close(arm.output_tokens/arm.duration_seconds,arm.output_tokens_per_second)) throw Error('Inconsistent release measurement');
          }
        }
        await validateVersionSupplement(entry, publication);
      }
      if(value.entries.find(row=>row.id==='r5').measurements.length) throw Error('r5 has no formal inference');
      if (!Array.isArray(value.attempt_order) || new Set(value.attempt_order).size!==value.attempt_order.length || value.attempt_order.some(id=>!/^r[1-9][0-9]*$/.test(id)||value.order.includes(id)) || value.attempts?.length!==value.attempt_order.length) throw Error('Invalid early-attempt catalog');
      for (const id of value.attempt_order) {
        const matches=value.attempts.filter(row=>row.id===id);
        if (matches.length!==1 || matches[0].kind!=='pre-freeze-attempt' || matches[0].status!=='failed' || matches[0].measurements?.length!==0 || !matches[0].source?.url) throw Error('Invalid early-attempt identity');
      }
      releaseIds=[...value.order];attemptIds=[...value.attempt_order];selectableIds=[...releaseIds,...attemptIds,...srIds];
      if(!selectableIds.includes(selectedRelease))selectedRelease=value.default_release;
      releaseCatalog=value;
    })();
    try { await catalogRequest; } finally { catalogRequest=null; }
  }
  function releaseEntry() { return releaseCatalog?.entries.find(entry=>entry.id===selectedRelease); }

  let currentR8 = null;
  const currentR8Sha = 'c81cd8078a1c9ea61af84cb31c2b59c99fa94876ae1cfaa3a5a12180f9408c61'; // pragma: allowlist secret -- fixed public evidence digest
  function releaseMenu() {
    return `<div class="comparison-meta release-selector"><label for="comparison-release-select">${t('版本 / 运行记录','Version / run history')}</label><select id="comparison-release-select"><optgroup label="${t('冻结版本','Frozen releases')}">${releaseIds.map(id=>{const entry=releaseCatalog?.entries.find(row=>row.id===id);return `<option value="${id}" ${selectedRelease===id?'selected':''}>${id}${entry?' · '+esc(t(entry.label_zh,entry.label_en)):''}</option>`;}).join('')}</optgroup><optgroup label="${t('冻结前尝试','Pre-freeze attempts')}">${attemptIds.map(id=>{const entry=releaseCatalog?.attempts.find(row=>row.id===id);return `<option value="${id}" ${selectedRelease===id?'selected':''}>${id}${entry?' · '+esc(t(entry.label_zh,entry.label_en)):''}</option>`;}).join('')}</optgroup><optgroup label="${t('SR 实验版本','Experimental SR releases')}">${srIds.map(id=>`<option value="${id}" ${selectedRelease===id?'selected':''}>B1-${id}</option>`).join('')}</optgroup></select><a class="fixed-b0-identity" href="${esc(releaseCatalog?.baseline.profile.url||'./engine.html')}">B0 · vLLM0.18 / Ascend0.18</a><a href="./engine-r8-development.html">${t('开发对照详情','Development evidence')} ↗</a><a id="release-history-link" href="./report-history.html">${t('历史报告','Report archive')} ↗</a></div>`;
  }
  function bindMenu() {
    root.querySelector('#comparison-release-select').addEventListener('change',event=>{
      selectedRelease=event.target.value;
      const url=new URL(location.href);url.searchParams.set('release',selectedRelease);history.replaceState(null,'',url);
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
  function coverageView(rows, qualityOnly=false) {
    return `<section class="dataset-coverage" aria-labelledby="dataset-coverage-title"><div class="section-heading"><h2 id="dataset-coverage-title">${t('固定五项数据集','Five fixed profiles')}</h2></div><div class="dataset-coverage-grid">${fixedProfiles.map(([id,label])=>{
      const row=rows.find(row=>row.id===id),available=!!row?.arms;
      const status=available?(row.crossCard?t('已发布跨卡对照','Published cross-card comparison'):t('已发布配对','Published pair')):(qualityOnly&&id==='mmlu'?t('仅质量记录','Quality record only'):t('缺少配对数据','Paired data missing'));
      return `<article data-dataset="${id}" data-available="${available}"><strong>${label}</strong><span>${status}</span></article>`;
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
       !/^https:\/\/github\.com\/vLLM-HUST\/vllm-hust-engine\/releases\/download\//.test(a.raw_asset?.url||'') ||
       a.comparisons?.length!==a.protocol?.phases?.length || !a.comparisons?.length ||
       !Number.isInteger(a.protocol.output_tokens) || a.protocol.output_tokens<=0)fail();
    if(a.tensor_parallel_size!==2 || !Array.isArray(a.physical_cards) || a.physical_cards.length!==2 ||
       new Set(a.physical_cards).size!==2 || !a.physical_cards.every(n=>Number.isInteger(n)&&n>=0) ||
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
      for(const role of ['B0','B1']) {
        const arm=row[role],m=arm?.metrics;
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
        const utilization=arm.utilization,cardValues=a.physical_cards.map(card=>utilization?.per_card_percent?.[card]);
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
    const chart=a.chart;
    if(!/^data\/[a-z0-9/-]+\.svg$/.test(chart?.path||'') || !/^[a-f0-9]{64}$/.test(chart?.sha256||''))fail();
    const source=publication.files.filter(row=>row.website_path===chart.path);
    if(source.length!==1 || source[0].sha256!==chart.sha256 || source[0].bytes!==chart.bytes)fail();
    const response=await fetch('./'+chart.path,{cache:'no-cache'});
    if(!response.ok)fail();
    const raw=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==chart.sha256 || raw.byteLength!==chart.bytes)fail();
  }
  function supplementLabel(a,row) {
    const phase=a.protocol.phases.find(phase=>row.phase===phase.id+'-formal');
    const cohort=a.protocol.cohorts.find(cohort=>String(cohort.min_tokens)===phase.cohort);
    return phase.tenants>1?t(`${phase.tenants}租户 / C${phase.concurrency}`,`${phase.tenants} tenants / C${phase.concurrency}`):
      `${cohort.min_tokens/1024}K–${cohort.max_tokens_exclusive/1024}K / C${phase.concurrency}`;
  }
  function versionSupplementRows(entry) {
    const a=entry.context_tenant_supplement;
    if(!a)return [];
    return a.comparisons.map(row=>{
      const arms=Object.fromEntries(['B0','B1'].map(role=>{
        const m=row[role].metrics;
        return [role,{...m,mean_ttft_ms:m.ttft_ms.mean,mean_tpot_ms:m.tpot_ms.mean,
          relative_cost_per_token:row.B0.metrics.output_tokens_per_second/m.output_tokens_per_second}];
      }));
      const changes_percent=Object.fromEntries(['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map(key=>[key,100*(arms.B1[key]/arms.B0[key]-1)]));
      return {id:'real-context-'+row.phase,label:supplementLabel(a,row),arms,changes_percent,
              workloadLabel:t(a.workload_label_zh,a.workload_label_en)};
    });
  }
  function versionSupplement(entry, values, control = 'B0') {
    const a=entry.context_tenant_supplement;
    if(!a)return `<section id="context-tenant-supplement"><div class="section-heading"><h2>${t('上下文与四租户补测','Context and four-tenant supplement')}</h2><button type="button" data-detail="supplement">${t('范围、窗口与原件','Scope, windows and evidence')} ↗</button></div><div class="supplement-highlights"><div><span>${t(`16K 相对 ${control} 吞吐`,`16K throughput vs ${control}`)}</span><strong>${values[2]}</strong></div><div><span>${t('四租户成本降低','Four-tenant cost reduction')}</span><strong>—</strong></div><div><span>${t('四租户AI Core利用率','Four-tenant AI Core utilization')}</span><strong>—</strong></div></div><div class="supplement-plot missing-plot">${t('本版未发布完整的上下文与四租户补测图。','This version has no published complete context and four-tenant supplement chart.')}</div></section>`;
    const tenant=a.comparisons.find(row=>row.B1.tenants>1);
    return `<section id="context-tenant-supplement" data-source-release="${esc(entry.id)}"><div class="section-heading"><h2>${t('上下文与四租户补测','Context and four-tenant supplement')}</h2><button type="button" data-detail="supplement">${t('范围、窗口与原件','Scope, windows and evidence')} ↗</button></div>
      <p>${esc(a.report_date)} · ${esc(t(a.workload_label_zh,a.workload_label_en))} · ${esc(t('固定输出预算','Fixed output budget'))} ${a.protocol.output_tokens}</p>
      <div class="supplement-highlights"><div><span>${t(`16K 相对 ${control} 吞吐`,`16K throughput vs ${control}`)}</span><strong>${values[2]}</strong></div><div><span>${t('四租户成本降低','Four-tenant cost reduction')}</span><strong>${n(tenant?.equal_rate_same_card_count_unit_cost_reduction_percent)}%</strong></div><div><span>${t('四租户AI Core利用率','Four-tenant AI Core utilization')}</span><strong>${n(tenant?.B0.utilization.mean_percent)} → ${n(tenant?.B1.utilization.mean_percent)}%</strong></div></div>
      <figure><div class="supplement-plot" tabindex="0" role="region" aria-label="${t('上下文与租户配对曲线，可横向滚动','Context and tenant paired curves; scroll horizontally')}"><img src="./${esc(a.chart.path)}" alt="${esc(t(a.workload_label_zh,a.workload_label_en))}" loading="lazy"></div><figcaption>${t('保留全部提交窗口、完整排空及租户分布；采样利用率与有效算力分别报告。','All submission windows, complete drain and tenant distributions are retained. Sampled utilization is separate from effective compute.')}</figcaption></figure></section>`;
  }
  function versionSupplementDetails(entry) {
    const a=entry.context_tenant_supplement;
    if(!a)return null;
    const rows=a.comparisons.map(row=>[supplementLabel(a,row),row.B0.metrics.requests+' / '+row.B1.metrics.requests,
      n(row.B0.metrics.output_tokens_per_second)+' / '+n(row.B1.metrics.output_tokens_per_second),
      n(row.throughput_ratio)+'×',n(row.B0.metrics.ttft_ms.p99)+' / '+n(row.B1.metrics.ttft_ms.p99),
      n(row.B0.metrics.tpot_ms.p99)+' / '+n(row.B1.metrics.tpot_ms.p99)]);
    const tenant=a.comparisons.find(row=>row.B1.tenants>1);
    return `<p>${esc(t(a.workload_label_zh,a.workload_label_en))} · ${a.protocol.task_count} ${t('份独立历史；重复窗口不是独立任务样本。','distinct histories; repeated windows are not independent task samples.')}</p>
      <p>${t('每阶段预热','Each phase warms up for')} ${a.protocol.phases[0].warmup_seconds}s · ${t('正式提交','formal submissions')} ${a.protocol.phases[0].formal_seconds}s ${t('后完整排空；吞吐分母包含排空。','plus complete drain, included in throughput duration.')} ${t('本专项不测任务质量或租户安全隔离，也不产生有效算力效率。','This supplement does not measure task quality, security isolation or effective-compute efficiency.')}</p>
      ${table(t(['工况','请求 B0 / B1','token/s B0 / B1','吞吐比','P99 TTFT ms B0 / B1','P99 TPOT ms B0 / B1'],['Scenario','Requests B0 / B1','tok/s B0 / B1','Throughput ratio','P99 TTFT ms B0 / B1','P99 TPOT ms B0 / B1']),rows)}
      ${tenant?table(t(['租户','B0 完成','B1 完成'],['Tenant','B0 completed','B1 completed']),Object.keys(tenant.B1.per_tenant).map(id=>[id,tenant.B0.per_tenant[id]?.successful??'—',tenant.B1.per_tenant[id].successful])):''}
      <p><a href="${esc(a.raw_asset.url)}">${t('完整原件、全部窗口与复算入口','Complete originals, all windows and reproduction')} ↗</a><br><code>${esc(a.raw_asset.sha256)}</code></p>`;
  }
  function versionRows(entry) {
    const rows=entry.measurements.map(row=>{
      const arms=Object.fromEntries(row.arms.map((arm,i)=>[i?'B1':'B0',{...arm,relative_cost_per_token:row.arms[0].output_tokens_per_second/arm.output_tokens_per_second}]));
      const changes_percent=Object.fromEntries(['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map(key=>[key,100*(arms.B1[key]/arms.B0[key]-1)]));
      return {id:row.id,label:row.label,arms,changes_percent};
    });
    rows.push(...versionSupplementRows(entry));
    if(entry.id==='r8')for(const row of r8Rows())if(!rows.some(old=>old.id===row.id))rows.push({...row,label:row.id==='4096-formal'?'4K / C8':'16K / C8'});
    return rows.map(row=>entry.id==='r8'&&['4096-formal','16384-formal'].includes(row.id)?{...row,workloadLabel:continuousWorkloadLabel()}:row);
  }
  function versionDetails(entry, rows, key, attempt) {
    const title={configuration:t('冻结配置与MOD','Configuration and MODs'),methods:t('计算公式与比较方式','Formulas and comparison'),metrics:t('完整数值','Complete metrics'),quality:t('质量与评分明细','Quality and grading'),evidence:t('原始证据','Original evidence'),supplement:t('上下文与四租户补测','Context and four-tenant supplement')}[key];
    if(attempt)return {title,body:`<p>${esc(t(entry.reason_zh,entry.reason_en))}</p><p>${esc(entry.run)}</p><p>${t('r1–r3为冻结r4前同批实验的尝试编号；本次未形成完整配对报告。','r1–r3 identify attempts preceding frozen r4; this attempt did not produce a complete paired report.')}</p><p><a href="${esc(entry.source.url)}">${t('全部尝试及退出回执','All attempts and exit receipts')} ↗</a></p><code>${esc(entry.source.sha256)}</code>`};
    if(key==='supplement')return {title,body:versionSupplementDetails(entry)||`<p>${t('本版已发布的连续负载仅在图中列出实测档位。尚缺32K及四租户的完整补测数据；不从其他版本迁入成绩。','Published continuous-load measurements cover the plotted context bands. Complete 32K and four-tenant supplement data are missing for this version; scores are not transferred from another version.')}</p>`};
    if(key==='configuration')return {title,body:`<p>${esc(entry.release)}</p><div class="mod-tags">${entry.mods.map(name=>`<span>${esc(name)}</span>`).join('')}</div><p>E${entry.settings.E}/R${entry.settings.R} · MTP${entry.settings.MTP} · ${entry.settings.graph} · State${entry.settings.state_gib_per_rank}GiB/rank · KV${entry.settings.kv_gib_per_rank}GiB/rank</p><a href="${esc(entry.profile.url)}">${t('冻结版本与MOD配置','Frozen version and MOD configuration')} ↗</a>`};
    if(key==='methods')return {title,body:`<p>${esc(t(entry.method_zh||'方法见本版原件',entry.method_en||'See this version’s originals for its protocol'))}</p><dl class="method-list"><dt>${t('吞吐','Throughput')}</dt><dd>${t('完成输出token / 包含排空的批次秒数','Output tokens / batch seconds including drain')}</dd><dt>TTFT / TPOT</dt><dd>${t('逐请求均值；历史预热和输出预算保持原样。','Request means; original warmup and output budgets retained.')}</dd><dt>${t('同费率成本','Equal-rate cost')}</dt><dd>${t('相同费率与卡数下，单位token成本比 = B0吞吐 / B1吞吐；B0 = 1。','At equal rates and device counts, unit token cost ratio = B0 throughput / B1 throughput; B0 = 1.')}</dd></dl>`};
    if(key==='metrics'&&!rows.some(row=>row.arms))return {title,body:`<p>${esc(t(entry.scope_zh,entry.scope_en))}</p>`};
    if(key==='metrics')return {title,body:['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map((field,i)=>`<h3>${[t('吞吐 · token/s','Throughput · token/s'),'TTFT · s','TPOT · ms',t('同费率成本 · B0 = 1','Equal-rate cost · B0 = 1')][i]}</h3>${table(t(['场景','B0','B1','变化'],['Scenario','B0','B1','Change']),rows.map(row=>[row.label,row.arms?n(row.arms.B0[field]/(i===1?1000:1)):'—',row.arms?n(row.arms.B1[field]/(i===1?1000:1)):'—',row.arms?n(row.changes_percent[field])+'%':'—']))}`).join('')};
    if(key==='quality'){
      const quality=entry.quality;
      const qualityView=quality?`<p class="historical-quality">MMLU200 · ${quality.correct}/${quality.requests} ${t('正确','correct')} · ${t('原开发筛选线','Original development screen')} ${quality.historical_screen_minimum}/${quality.requests} · ${quality.historical_screen_passed?t('通过','Passed'):t('未通过','Not passed')}</p>`:'';
      const qualityRows=rows.filter(row=>row.arms).flatMap(row=>['B0','B1'].filter(role=>Number.isInteger(row.arms[role].correct)).map(role=>[row.label,role==='B1'?entry.id:role,`${row.arms[role].correct}/${row.arms[role].requests}`,row.arms[role].truncated]));
      return {title,body:(entry.quality_note_zh?`<p>${esc(t(entry.quality_note_zh,entry.quality_note_en))}</p>`:'')+qualityView+(qualityRows.length?table(t(['场景','版本','正确','长度终止'],['Scenario','Version','Correct','Length stops']),qualityRows):`<p>${t('本页已发布场景没有配对质量成绩。','The published scenarios have no paired quality scores.')}</p>`)};
    }
    const development=entry.development_measurements||[];
    const developmentRows=development.flatMap(row=>row.arms.map(arm=>[row.label,arm.role,n(arm.output_tokens_per_second),n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms),n(arm.ttft_p95_ms)]));
    const tails=entry.measurements.flatMap(row=>row.arms.filter(arm=>Number.isFinite(arm.ttft_p95_ms)).map(arm=>[row.label,arm.role,n(arm.ttft_p95_ms),n(arm.ttft_p99_ms)]));
    return {title,body:`<p>${esc(t(entry.scope_zh,entry.scope_en))}</p><p>${esc(t(entry.method_zh||'',entry.method_en||''))}</p>${tails.length?table(t(['场景','版本','P95 TTFT / ms','P99 TTFT / ms'],['Scenario','Version','P95 TTFT / ms','P99 TTFT / ms']),tails):''}${developmentRows.length?`<h3>${t('开发对照 · B1 r6 → B1 r7','Development comparison · B1 r6 → B1 r7')}</h3>${table(t(['场景','版本','token/s','TTFT / s','TPOT / ms','P95 TTFT / ms'],['Scenario','Version','token/s','TTFT / s','TPOT / ms','P95 TTFT / ms']),developmentRows)}`:''}<p><a href="${esc(entry.release_url)}">${entry.id} Release ↗</a> · <a href="${esc(entry.profile.url)}">${t('冻结版本与MOD配置','Frozen version and MOD configuration')} ↗</a>${entry.sources.map((source,i)=>` · <a href="${esc(source.url)}">${t('原件','Source')} ${i+1} ↗</a>`).join('')}</p>${entry.id==='r8'?r8Details('evidence').body:''}`};
  }
  const srPath = 'data/sr-development-results-v1.json';
  let srEntries;
  async function loadSr() {
    const [meta, response]=await Promise.all([fetch('./data/benchmark-source-manifest.json'),fetch('./'+srPath)]);
    if(!meta.ok||!response.ok)throw Error('SR publication unavailable');
    const publication=await meta.json();
    const binding=publication.files.filter(file=>file.website_path===srPath);
    const raw=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(binding.length!==1||binding[0].sha256!==digest||binding[0].bytes!==raw.byteLength)throw Error('SR publication checksum mismatch');
    const value=JSON.parse(new TextDecoder().decode(raw));
    if(value.schema!=='vllm-hust-sr-development/v1'||value.control!=='B1-r8'||value.entries?.length!==srIds.length)throw Error('Invalid SR publication scope');
    for(const id of srIds){
      const entries=value.entries.filter(entry=>entry.id===id);
      if(entries.length!==1)throw Error('Invalid SR identity');
      const entry=entries[0];
      const url=new URL(entry.release_url);
      if(url.origin!=='https://github.com'||!url.pathname.startsWith('/vLLM-HUST/vllm-hust-engine/releases/tag/b1-'+id+'-'))throw Error('Invalid SR evidence link');
      const expected=id==='sr1'?['mmlu','4096-formal','16384-formal']:[...fixedProfiles.map(([id])=>id),'4096-formal','16384-formal'];
      if(entry.rows.length!==expected.length||expected.some(id=>entry.rows.filter(row=>row.id===id).length!==1))throw Error('Invalid SR row coverage');
      for(const row of entry.rows){
        if(row.arms?.length!==2||row.cards?.length!==2||row.cards.some(cards=>cards.length!==2||!cards.every(Number.isInteger)))throw Error('Invalid SR arm identity');
        for(const arm of row.arms){
          if(!['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','ttft_p95_ms','ttft_p99_ms','end_to_end_p95_ms','end_to_end_p99_ms'].every(key=>Number.isFinite(arm[key])&&arm[key]>0))throw Error('Invalid SR metrics');
          if(arm.correct!==undefined&&(!Number.isInteger(arm.correct)||!Number.isInteger(arm.requests)||arm.correct<0||arm.correct>arm.requests))throw Error('Invalid SR score');
        }
      }
    }
    srEntries=value.entries;
  }
  function srRows(entry) {
    return entry.rows.map(row=>{
      const crossCard=row.cards[0].join()!==row.cards[1].join();
      const arms=Object.fromEntries(row.arms.map((arm,i)=>[i?'B1':'B0',{...arm,relative_cost_per_token:row.arms[0].output_tokens_per_second/arm.output_tokens_per_second}]));
      const changes_percent=Object.fromEntries(['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms','relative_cost_per_token'].map(key=>[key,100*(arms.B1[key]/arms.B0[key]-1)]));
      const workloadLabel=[row.variant,crossCard?t('跨卡位对照','Different card positions'):t('同卡对照','Matched cards')].filter(Boolean).join(' · ');
      return {...row,arms,changes_percent,crossCard,workloadLabel};
    });
  }
  function srDetails(entry,rows,key,roles) {
    const measurements=rows.filter(row=>row.arms);
    const settings='E36/R54 · MTP2 · FULL · TP2';
    if(key==='configuration')return {title:t('运行配置','Run configuration'),body:`<p>${esc(entry.name)} · ${settings} · BF16 · Qwen3.5-35B-A3B</p><p><a href="${esc(entry.release_url)}">B1-${entry.id} Release ↗</a></p>`};
    if(key==='methods')return {title:t('计算公式与比较方式','Formulas and comparison'),body:`<p>${esc(t(entry.scope_zh,entry.scope_en))}</p><p>${t('各场景各记录一次对照。吞吐为输出 token 除以批次耗时，含排空。TTFT 和 TPOT 为逐请求均值。成本比按同费率计算，为 B1-r8 吞吐除以候选吞吐。','Each scenario reports one comparison. Throughput is output tokens divided by batch duration including drain. TTFT and TPOT are request means. Equal-rate cost is B1-r8 throughput divided by candidate throughput.')}</p>`};
    if(key==='quality'){
      const scored=measurements.filter(row=>Number.isInteger(row.arms.B1.correct));
      return {title:t('质量与评分明细','Quality and grading'),body:table(t(['场景','版本','正确 / 总数','长度终止','未判定'],['Profile','Version','Correct / total','Length stops','Unresolved']),scored.flatMap(row=>['B0','B1'].map(role=>{const arm=row.arms[role];return [row.label,roles[role],`${arm.correct}/${arm.requests}`,arm.truncated,arm.unresolved];})))+`<p>${t('SWE 与 Terminal 回放仅统计请求性能。','SWE and Terminal replays measure request performance only.')}</p>`};
    }
    if(key==='metrics')return {title:t('完整数值','Complete metrics'),body:table(t(['场景','版本','物理卡','tok/s','TTFT / s','TPOT / ms','TTFT P95 / s','TTFT P99 / s','E2E P95 / s','E2E P99 / s'],['Profile','Arm','Physical cards','tok/s','TTFT / s','TPOT / ms','TTFT P95 / s','TTFT P99 / s','E2E P95 / s','E2E P99 / s']),measurements.flatMap(row=>['B0','B1'].map((role,i)=>{const arm=row.arms[role];return [[row.label,row.variant].filter(Boolean).join(' · '),roles[role],row.cards[i].join(', '),n(arm.output_tokens_per_second),n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms),n(arm.ttft_p95_ms/1000),n(arm.ttft_p99_ms/1000),n(arm.end_to_end_p95_ms/1000),n(arm.end_to_end_p99_ms/1000)];})))};
    return {title:t('测量范围与证据','Measurement scope and evidence'),body:`<p>${esc(t(entry.scope_zh,entry.scope_en))}</p><p><a href="./${srPath}">${t('公开汇总','Public summary')} ↗</a> · <a href="${esc(entry.release_url)}">${t('私有 Release','Private Release')} ↗</a></p>`};
  }
  function renderVersion() {
    const attempt=attemptIds.includes(selectedRelease);
    const sr=srIds.includes(selectedRelease);
    const entry=sr?srEntries.find(row=>row.id===selectedRelease):attempt?releaseCatalog.attempts.find(row=>row.id===selectedRelease):releaseEntry();
    const roles=sr?{B0:'B1-r8',B1:'B1-'+entry.id}:{B0:'B0',B1:'B1'};
    const reason=attempt?t(entry.reason_zh,entry.reason_en):entry.id==='r5'?t(entry.scope_zh,entry.scope_en):'';
    const missingNote=attempt||entry.id==='r5'?t('运行未完成，无配对数据','Run incomplete; no paired data'):'';
    const rows=standardRows(attempt?[]:sr?srRows(entry):versionRows(entry),missingNote),available=rows.filter(row=>row.arms);
    const throughput=available.length?Math.max(...available.filter(row=>!row.crossCard).map(row=>row.arms.B1.output_tokens_per_second/row.arms.B0.output_tokens_per_second)):null;
    const context=available.find(row=>row.id==='real-context-16384-formal')||available.find(row=>/^16384/.test(row.id));
    const values=['—',throughput?n(throughput)+'×':'—',context?n(context.arms.B1.output_tokens_per_second/context.arms.B0.output_tokens_per_second)+'×':'—',throughput?n(100*(sr?1/throughput-1:1-1/throughput))+'%':'—'];
    const notes=[t('缺少本版有效算力核算','No version-specific compute accounting'),throughput?(sr?t('同卡场景最高吞吐比','Highest matched-card throughput ratio'):t('已发布场景最高吞吐比','Highest published throughput ratio')):t('缺少配对吞吐与时延','Paired throughput and latency missing'),context?t(`16K 相对 ${roles.B0} 吞吐`,`16K throughput vs ${roles.B0}`):t('缺少上下文配对观测','Paired context observations missing'),throughput?t('同费率单位token成本降低','Lower token cost at equal rates'):t('缺少成本与利用率观测','Cost and utilization observations missing')];
    document.getElementById('comparison-title').textContent=sr?t(`B1-r8 / B1-${entry.id} 实测对比`,`B1-r8 / B1-${entry.id} measured comparison`):t(`B0 / B1 ${entry.id} 实测对比`,`B0 / B1 ${entry.id} measured comparison`);
    document.getElementById('comparison-lead').textContent='Qwen3.5-35B-A3B · Ascend 910B2 × 2 · BF16';
    const settings=sr?'E36/R54 · MTP2 · FULL · TP2':attempt?t('本次尝试未形成冻结配置','This attempt did not produce a frozen configuration'):`E${entry.settings.E}/R${entry.settings.R} · MTP${entry.settings.MTP} · ${entry.settings.graph} · TP2 · host ${entry.settings.state_gib_per_rank} GiB/rank · KV ${entry.settings.kv_gib_per_rank} GiB/rank`;
    const config=frozenProfile(entry.id,{B0:releaseCatalog.baseline.cann,B1:attempt?'—':'9.1.0'},attempt?[]:sr?[entry.name]:entry.mods,settings);
    const scope=attempt?reason:t(entry.scope_zh,entry.scope_en);
    const costNote=sr&&throughput?t('同卡场景的同费率成本变化','Matched-card equal-rate cost change'):notes[3];
    root.innerHTML=`<section class="comparison-dashboard"${sr?' data-comparison="sr"':''}>${releaseMenu()}<div class="comparison-meta"><span>${esc(entry.id+' · '+scope)}</span></div><div class="goal-grid">${names().map((name,i)=>`<article class="result-card"><span>${name}</span><strong>${values[i]}</strong><small>${i===3?costNote:notes[i]}</small></article>`).join('')}</div>${config}${coverageView(rows,!!entry.quality)}<section ${entry.id==='r8'?'id="r8-current-continuous"':''}><div class="section-heading"><h2>${t('性能与成本','Performance and cost')}</h2><button type="button" data-detail="metrics">${t('查看数值','View metrics')} ↗</button></div><p class="chart-scale-note">${t(`条形按 ${roles.B0} = 1 归一，右侧为实测值。— 表示缺少本版配对数据。`,`Bars normalize ${roles.B0} to 1. Labels show measured values. — indicates missing version-specific paired data.`)}</p><div class="metric-grid">${chart('output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s',1,rows,rows.map(row=>row.label),roles)}${chart('mean_ttft_ms',t('首token时延 ↓','Time to first token ↓'),'s',1000,rows,rows.map(row=>row.label),roles)}${chart('mean_tpot_ms',t('逐token时延 ↓','Time per output token ↓'),'ms',1,rows,rows.map(row=>row.label),roles)}${chart('relative_cost_per_token',t('单位输出token成本 ↓','Cost per output token ↓'),`${roles.B0} = 1`,1,rows,rows.map(row=>row.label),roles)}</div></section>${versionSupplement(entry,values,roles.B0)}<div class="detail-actions">${[['methods',t('公式与比较方式','Formulas and comparison')],['quality',t('质量与评分明细','Quality and grading')],['evidence',t('原始证据','Original evidence')]].map(([key,label])=>`<button type="button" data-detail="${key}">${label} ↗</button>`).join('')}</div>${detailDialog()}</section>`;
    if(sr){
      const control=root.querySelector('.runtime-pair>div:first-child');
      control.querySelector('strong').textContent=roles.B0;
      control.querySelector('span').textContent='vLLM 0.28.1 / Ascend 0.25.1rc2 · CANN 9.1.0';
      root.querySelector('.runtime-pair>div:last-child strong').textContent=roles.B1;
      root.querySelector('[data-detail="controller-progress"]').remove();
    }
    if(!sr&&!attempt&&!['r4','r5','r7','r8'].includes(entry.id))root.querySelector('.runtime-pair>div:last-child span').textContent=t('运行时身份见配置详情','See configuration details for runtime identity');
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
  function render() {
    if(!releaseCatalog)return;
    if(srIds.includes(selectedRelease)){if(srEntries)renderVersion();return;}
    if(selectedRelease!=='r6'){if(selectedRelease!=='r8'||currentR8)renderVersion();return;}
    if(!data||!combination)return;
    renderR6();root.querySelector('.comparison-dashboard').insertAdjacentHTML('afterbegin',releaseMenu());
    root.querySelector('.frozen-profile').insertAdjacentHTML('afterend',coverageView(data.datasets));
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
      await Promise.all([loadReleaseCatalog(), controllerProgress ? Promise.resolve() : loadControllerProgress()]);
      if(request!==releaseRequest)return;
      if(srIds.includes(selectedRelease)&&!srEntries)await loadSr();
      else if(selectedRelease==='r8'&&!currentR8)await loadR8();
      else if(selectedRelease==='r6'&&!data)await loadR6();
      if(request!==releaseRequest)return;
      render();
    } catch(error) {
      if(request!==releaseRequest)return;
      delete root.dataset.loaded;delete root.dataset.release;delete root.dataset.baselineId;
      console.error('Release publication rejected',error);root.dataset.error='publication-rejected';root.setAttribute('aria-busy','false');
      root.innerHTML=releaseMenu()+`<p>${t('当前版本结果加载或校验失败。','Selected release results unavailable or verification failed.')}</p>`;bindMenu();
    }
  }
  window.addEventListener('vllm-hust:langchange',render);
  showRelease();
})();
