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
  let data, manifest, combination;
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


  const profileNames = () => t(['MMLU200','HLE200','Frontier160','SWE trace','Terminal trace'],['MMLU200','HLE200','Frontier160','SWE trace','Terminal trace']);
  const attainment = (id, final = false) => {
    const goal = final ? data.project_final_assessment.targets[id] : window.vllmHustProjectMilestones.select(data,id);
    const met = final ? goal.attainment === 'demonstrated' : goal.accepted;
    return met ? t('达成目标','Target met') : t('未达成目标','Target not met');
  };
  function chart(key, title, unit, divisor = 1, rows = data.datasets, labels = profileNames()) {
    const maximum = Math.max(1,...rows.map(d=>d.arms.B1[key]/d.arms.B0[key]));
    return `<article class="metric-chart" data-metric="${key}"><header><h3>${title}</h3><span>${unit}</span></header><div class="chart-legend"><span class="legend-b0">B0</span><span class="legend-b1">B1</span></div>${rows.map((row,i)=>{
      const change = key==='estimated_cny_per_million_output_tokens' ? row.changes_percent.unit_cost_change_percent : row.changes_percent[key];
      const good = key==='output_tokens_per_second' ? change>=0 : change<=0;
      return `<div class="chart-row" data-profile="${row.id}"><div class="chart-row-heading"><strong>${labels[i]}</strong><span class="metric-change ${good?'favorable':'regression'}">${change>0?'+':''}${n(change)}%</span></div>${['B0','B1'].map(role=>{
        const value=row.arms[role][key]/divisor;
        return `<div class="bar-line" aria-label="${esc(`${labels[i]} ${role} ${n(value)} ${unit}`)}"><span class="bar-role">${role}</span><span class="bar-track"><span class="bar-fill ${role.toLowerCase()}" style="width:${100*row.arms[role][key]/row.arms.B0[key]/maximum}%"></span></span><span class="bar-value">${n(value)}</span></div>`;
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
        body+=`<p>${t('项目50%里程碑已由原固定MMLU200/out256认证工况达成。当前冻结版本另行复测效率，复用参考分母统计，重新采集分子；不把原效率百分比当成本轮新测结果。','The project50% milestone was achieved by the original certified MMLU200/out256 workload. Requalify the current frozen version separately: reuse reference denominator statistics and measure a fresh numerator, without presenting the historical efficiency as a new measurement.')}</p>
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
      return {title:`${id} ${names()[i]}`,body};
    }
    if (key==='supplement') {
      const a=data.acceptance_supplement;
      const labels=t(['4K–8K/C8','16K–24K/C8','32K–48K/C8','四租户/C24'],['4K–8K/C8','16K–24K/C8','32K–48K/C8','Four tenants/C24']);
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
      <figure><div class="supplement-plot" tabindex="0" role="region" aria-label="${t('上下文与四租户配对图，可横向滚动','Context and tenant paired chart; scroll horizontally')}"><img src="${esc(a.chart_path)}" alt="${t('两臂上下文吞吐、尾时延和四租户利用率实测图','Measured paired context throughput, tail latency and four-tenant utilization')}" width="1426" height="1022"></div><figcaption>${t('输入变长时输出吞吐下降；五窗口稳定性与局部回归见详情。','Output throughput decreases with longer inputs; see details for five-window stability and individual regressions.')}</figcaption></figure></section>`;
  }
  function renderR6() {
    if (!data || !combination) return;
    document.getElementById('comparison-title').textContent=t('B0 / B1 r6 · 固定五项对比','B0 / B1 r6 · Five-profile comparison');
    document.getElementById('comparison-lead').textContent=`${data.hardware.model} · ${data.hardware.accelerator} × ${data.hardware.cards} · ${data.hardware.dtype}`;
    const goalCards=required.map((id,i)=>`<button type="button" class="goal-card" data-detail="goal-${id}" data-goal="${id}"><span>${names()[i]}</span><strong><span class="stage-label">${t('项目里程碑','Project milestone')}</span>${attainment(id)}</strong>${id==='3.4.1' ? `<span class="reference-scope">${t('已认证工况：MMLU200/out256','Certified workload: MMLU200/out256')}</span>` : ''}<small>${t('项目最终目标','Project final')}: ${attainment(id,true)} <span aria-hidden="true">↗</span></small></button>`).join('');
    root.innerHTML=`<section class="comparison-dashboard"><div class="comparison-meta release-navigation"><span>${t('本页：B0 对比默认 B1 r6 · 固定五数据集','This report: B0 vs default B1 r6 · five fixed profiles')}</span><a href="./engine.html#r8-current-results">${t('r8 已冻结：下载、MOD 与实测图','Frozen r8: download, MODs and measurements')} ↗</a></div><div class="comparison-meta" id="report-history-links"><span>${esc(data.report_date)} · ${t(`固定五项 · 两臂各${data.datasets.reduce((n,r)=>n+r.arms.B0.successful,0)}/${data.datasets.reduce((n,r)=>n+r.arms.B0.planned,0)}请求完成`, `Five fixed profiles ·${data.datasets.reduce((n,r)=>n+r.arms.B0.successful,0)}/${data.datasets.reduce((n,r)=>n+r.arms.B0.planned,0)} requests per arm`)}</span><a href="./report-history.html">${t('历史报告','Report archive')} ↗</a></div><div class="goal-grid">${goalCards}</div>
      ${frozenProfile('r6',{B0:combination.B0.cann,B1:combination.B1.cann},combination.components.map(c=>t(c.name_zh,c.name_en)),'E24/R36 · MTP2 · FULL · TP2 · host 4 GiB/rank')}
      <div class="section-heading"><h2>${t('五数据集性能','Five-profile performance')}</h2><button type="button" data-detail="metrics">${t('查看数值','View metrics')} ↗</button></div><p class="chart-scale-note">${t('条形按 B0 = 1 归一，右侧为实测值。','Bars normalize B0 to1; labels show measured values.')}</p><div class="metric-grid">${chart('output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s')}${chart('mean_ttft_ms',t('首token时延 ↓','Time to first token ↓'),'s',1000)}${chart('mean_tpot_ms',t('逐token时延 ↓','Time per output token ↓'),'ms')}${chart('estimated_cny_per_million_output_tokens',t('单位输出token成本 ↓','Cost per output token ↓'),t('元/百万token','CNY/million tokens'))}</div>
      ${supplementView()}
      <div class="detail-actions">${[['methods',t('公式与比较方式','Formulas and comparison')],['quality',t('质量与评分明细','Quality and grading')],['evidence',t('原始证据','Original evidence')]].map(([key,label])=>`<button type="button" data-detail="${key}">${label} ↗</button>`).join('')}</div>
      ${detailDialog()}</section>`;
    bindDetails(detailContent);
    root.dataset.loaded=data.run_id;root.setAttribute('aria-busy','false');
  }
  function detailDialog() {
    return `<dialog id="comparison-detail-dialog" class="comparison-dialog" aria-labelledby="comparison-dialog-title"><div class="dialog-header"><h2 id="comparison-dialog-title"></h2><button type="button" class="dialog-close" aria-label="${t('关闭详情','Close details')}">×</button></div><div id="comparison-dialog-body"></div></dialog>`;
  }
  function bindDetails(content) {
    const dialog=root.querySelector('dialog');
    root.querySelectorAll('[data-detail]').forEach(button=>button.addEventListener('click',()=>{
      const value=content(button.dataset.detail);
      root.querySelector('#comparison-dialog-title').textContent=value.title;
      root.querySelector('#comparison-dialog-body').innerHTML=value.body;
      dialog.showModal();
    }));
    root.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog && event.clientX>=dialog.getBoundingClientRect().right)dialog.close();});
  }
  function frozenProfile(release, cann, mods, settings) {
    return `<section class="frozen-profile"><div class="section-heading"><h2>${t('本轮冻结组合','Frozen combination')}</h2><button type="button" data-detail="configuration">${t('版本与配置详情','Versions and configuration')} ↗</button></div><div class="runtime-pair"><div><strong>B0</strong><span>vLLM 0.18 / Ascend 0.18 · CANN ${esc(cann.B0)}</span></div><div><strong>B1 · ${esc(release)}</strong><span>vLLM 0.28.1 / Ascend 0.25.1rc2 · CANN ${esc(cann.B1)}</span></div></div><div class="mod-tags">${mods.map(c=>`<span>${esc(c)}</span>`).join('')}</div><p class="frozen-settings">${esc(settings)}</p></section>`;
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
  const releaseIds = ['r8','r7','r6','r5','r4'];
  const attemptIds = ['r3','r2','r1'];
  const selectableIds = [...releaseIds,...attemptIds];
  const requestedRelease = new URL(location.href).searchParams.get('release');
  let selectedRelease = selectableIds.includes(requestedRelease) ? requestedRelease : 'r8';
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
      if (value.schema!=='vllm-hust-engine-release-history/v1' || value.default_release!=='r8' || JSON.stringify(value.order)!==JSON.stringify(releaseIds) || value.entries?.length!==5) throw Error('Invalid release catalog scope');
      const baseline=value.baseline;
      if (baseline?.id!=='original018-cann8.5.1' || baseline.vllm!=='0.18.0' || baseline.vllm_ascend!=='0.18.0' || baseline.cann!=='8.5.1' || baseline.sdk_source_map_sha256!=='a357ad8cf1ff6f8797fb2d6476e71a0deef5ee0899a55ea32ed65f07fe7773bc' || baseline.image_digest!=='sha256:2467d259ff068ca4edd7b50b849152910f3c05e435f314639fc06bcc7a00f9fa') throw Error('Unexpected fixed B0 identity'); // pragma: allowlist secret -- fixed public B0 image and SDK digests
      for (const id of releaseIds) {
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
      }
      if(value.entries.find(row=>row.id==='r5').measurements.length) throw Error('r5 has no formal inference');
      if (JSON.stringify(value.attempt_order)!==JSON.stringify(attemptIds) || value.attempts?.length!==3) throw Error('Invalid early-attempt catalog');
      for (const id of attemptIds) {
        const matches=value.attempts.filter(row=>row.id===id);
        if (matches.length!==1 || matches[0].kind!=='pre-freeze-attempt' || matches[0].status!=='failed' || matches[0].measurements?.length!==0 || !matches[0].source?.url) throw Error('Invalid early-attempt identity');
      }
      releaseCatalog=value;
    })();
    try { await catalogRequest; } finally { catalogRequest=null; }
  }
  function releaseEntry() { return releaseCatalog?.entries.find(entry=>entry.id===selectedRelease); }

  let currentR8 = null;
  const currentR8Sha = 'c81cd8078a1c9ea61af84cb31c2b59c99fa94876ae1cfaa3a5a12180f9408c61'; // pragma: allowlist secret -- fixed public evidence digest
  function releaseMenu() {
    return `<div class="comparison-meta release-selector"><label for="comparison-release-select">${t('版本 / 运行记录','Version / run history')}</label><select id="comparison-release-select"><optgroup label="${t('冻结版本','Frozen releases')}">${releaseIds.map(id=>{const entry=releaseCatalog?.entries.find(row=>row.id===id);return `<option value="${id}" ${selectedRelease===id?'selected':''}>${id}${entry?' · '+esc(t(entry.label_zh,entry.label_en)):''}</option>`;}).join('')}</optgroup><optgroup label="${t('冻结前尝试','Pre-freeze attempts')}">${attemptIds.map(id=>{const entry=releaseCatalog?.attempts.find(row=>row.id===id);return `<option value="${id}" ${selectedRelease===id?'selected':''}>${id}${entry?' · '+esc(t(entry.label_zh,entry.label_en)):''}</option>`;}).join('')}</optgroup></select><a class="fixed-b0-identity" href="${esc(releaseCatalog?.baseline.profile.url||'./engine.html')}">B0 · vLLM0.18 / Ascend0.18</a><a href="./engine-r8-development.html">${t('开发对照详情','Development evidence')} ↗</a><a id="release-history-link" href="./report-history.html">${t('历史报告','Report archive')} ↗</a></div>`;
  }
  function bindMenu() {
    root.querySelector('#comparison-release-select').addEventListener('change',event=>{
      selectedRelease=event.target.value;
      const url=new URL(location.href);url.searchParams.set('release',selectedRelease);history.replaceState(null,'',url);
      showRelease();
    });
  }
  function renderAttempt() {
    const entry=releaseCatalog.attempts.find(row=>row.id===selectedRelease);
    document.getElementById('comparison-title').textContent=t(`${entry.id} · 冻结前尝试`,`${entry.id} · Pre-freeze attempt`);
    document.getElementById('comparison-lead').textContent=t('2026-10-30 · packed-host 实验历史','2026-10-30 · packed-host experiment history');
    root.innerHTML=`<section class="comparison-dashboard">${releaseMenu()}<section class="frozen-profile historical-attempt" data-history-attempt="${entry.id}"><h2>${esc(t(entry.label_zh,entry.label_en))}</h2><p>${esc(t(entry.reason_zh,entry.reason_en))}</p><details><summary>${t('运行身份与原始记录','Run identity and original records')}</summary><p>${esc(entry.run)}</p><p>${t('r1–r3为冻结r4前同批实验的尝试编号。','r1–r3 identify attempts in the experiment batch preceding frozen r4.')}</p><p><a href="${esc(entry.source.url)}">${t('全部尝试及退出回执','All attempts and exit receipts')} ↗</a></p><p style="overflow-wrap:anywhere">SHA256 · ${esc(entry.source.sha256)}</p></details></section></section>`;
    bindMenu();delete root.dataset.baselineId;root.dataset.release=entry.id;root.dataset.loaded='engine-release-attempt-'+entry.id;root.setAttribute('aria-busy','false');
  }
  function renderHistorical() {
    const entry=releaseEntry();
    const pairing=entry.measurements.length?`B0 → B1 ${entry.id}`:`B1 ${entry.id}`;
    document.getElementById('comparison-title').textContent=t(`${pairing} · 历史记录`,`${pairing} · Historical record`);
    document.getElementById('comparison-lead').textContent='Qwen3.5-35B-A3B · 2 × Ascend 910B2 · BF16';
    const measures=entry.measurements;
    const chart=(key,title,unit,divisor=1)=>`<article class="metric-chart" data-metric="${key}"><header><h3>${title}</h3><span>${unit}</span></header>${measures.map(row=>{
      const maximum=Math.max(...row.arms.map(arm=>arm[key]));
      const change=100*(row.arms[1][key]/row.arms[0][key]-1);
      const good=key==='output_tokens_per_second'?change>=0:change<=0;
      return `<div class="chart-row" data-profile="${esc(row.id)}"><div class="chart-row-heading"><strong>${esc(row.label)}</strong><span class="metric-change ${good?'favorable':'regression'}">${change>0?'+':''}${n(change)}%</span></div>${row.arms.map((arm,i)=>`<div class="bar-line" aria-label="${esc(`${row.label} ${arm.role} ${n(arm[key]/divisor)} ${unit}`)}"><span class="bar-role">${esc(arm.role)}</span><span class="bar-track"><span class="bar-fill ${i?'b1':'b0'}" style="width:${100*arm[key]/maximum}%"></span></span><span class="bar-value">${n(arm[key]/divisor)}</span></div>`).join('')}</div>`;
    }).join('')}</article>`;
    const development=entry.development_measurements||[];
    const developmentRows=development.flatMap(row=>row.arms.map(arm=>[row.label,arm.role,n(arm.output_tokens_per_second),n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms),n(arm.ttft_p95_ms)]));
    const developmentView=developmentRows.length?`<h3>${t('开发对照 · B1 r6 → B1 r7','Development comparison · B1 r6 → B1 r7')}</h3>${table(t(['场景','版本','token/s','TTFT / s','TPOT / ms','P95 TTFT / ms'],['Scenario','Version','token/s','TTFT / s','TPOT / ms','P95 TTFT / ms']),developmentRows)}`:'';
    const quality=entry.quality;
    const qualityView=quality?`<p class="historical-quality">MMLU200 · ${quality.correct}/${quality.requests} ${t('正确','correct')} · ${t('原开发筛选线','Original development screen')} ${quality.historical_screen_minimum}/${quality.requests} · ${quality.historical_screen_passed?t('通过','Passed'):t('未通过','Not passed')}</p>`:'';
    const valueRows=measures.flatMap(row=>row.arms.map(arm=>[row.label,arm.role,n(arm.output_tokens_per_second),n(arm.mean_ttft_ms/1000),n(arm.mean_tpot_ms),`${arm.requests} / ${arm.failed}`]));
    const qualityRows=measures.flatMap(row=>row.arms.filter(arm=>Number.isInteger(arm.correct)).map(arm=>[row.label,arm.role,`${arm.correct}/${arm.requests}`,arm.truncated]));
    const tailRows=measures.flatMap(row=>row.arms.filter(arm=>Number.isFinite(arm.ttft_p95_ms)).map(arm=>[row.label,arm.role,n(arm.ttft_p95_ms),n(arm.ttft_p99_ms)]));
    root.innerHTML=`<section class="comparison-dashboard">${releaseMenu()}<section class="frozen-profile historical-release" data-history-release="${entry.id}"><h2>${esc(t(entry.scope_zh,entry.scope_en))}</h2><div class="mod-tags" aria-label="${t('本版本MOD组合','MODs in this release')}">${entry.mods.map(mod=>`<span>${esc(mod)}</span>`).join('')}</div><p>E${entry.settings.E}/R${entry.settings.R} · MTP${entry.settings.MTP} · ${entry.settings.graph} · State${entry.settings.state_gib_per_rank}GiB/rank · KV${entry.settings.kv_gib_per_rank}GiB/rank</p>${qualityView}${measures.length?`<div class="metric-grid">${chart('output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s')}${chart('mean_ttft_ms',t('首token时延 ↓','Time to first token ↓'),'s',1000)}${chart('mean_tpot_ms',t('逐token时延 ↓','Time per output token ↓'),'ms')}</div>`:''}<details><summary>${t('测试范围、完整数值与原件','Scope, complete metrics and originals')}</summary><p>${esc(t(entry.method_zh,entry.method_en))}</p>${valueRows.length?table(t(['场景','版本','token/s','TTFT / s','TPOT / ms','请求 / 失败'],['Scenario','Version','token/s','TTFT / s','TPOT / ms','Requests / failures']),valueRows):''}${qualityRows.length?table(t(['场景','版本','正确','长度终止'],['Scenario','Version','Correct','Length stops']),qualityRows):''}${tailRows.length?table(t(['场景','版本','P95 TTFT / ms','P99 TTFT / ms'],['Scenario','Version','P95 TTFT / ms','P99 TTFT / ms']),tailRows):''}${developmentView}<p>${t('吞吐=完成输出token/包含排空的批次耗时；TTFT与TPOT为逐请求均值，历史预热协议保持原样。','Throughput=output tokens/batch time including drain; TTFT and TPOT are request means, with each original warmup protocol retained.')}</p><p><a href="${esc(entry.release_url)}">${entry.id} Release ↗</a> · <a href="${esc(entry.profile.url)}">${t('冻结版本与MOD配置','Frozen version and MOD configuration')} ↗</a>${entry.sources.map((source,i)=>` · <a href="${esc(source.url)}">${t('原件','Source')} ${i+1} ↗</a>`).join('')}</p></details></section></section>`;
    bindMenu();root.dataset.baselineId=releaseCatalog.baseline.id;root.dataset.release=entry.id;root.dataset.loaded='engine-release-history-'+entry.id;root.setAttribute('aria-busy','false');
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
    return {title:t('原始证据','Original evidence'),body:`<p>${t('C8闭环 · 正式871请求、失败0 · 每臂一次。固定五项配对结果另行发布。','C8 closed loop · 871 measured requests, zero failures · one run per arm. Five-profile paired results are published separately.')}</p><p><a href="./data/r8-continuous-20261117/summary-v1.json">${t('详细统计','Detailed statistics')} ↗</a> · <a href="${esc(currentR8.evidence.raw.url)}">${t('原始数据与CPU复算','Original data and CPU replay')} ↗</a></p><figure class="comparison-source-plot"><a href="./data/r8-continuous-20261117/continuous-B0-r8-v1.svg"><img src="./data/r8-continuous-20261117/continuous-B0-r8-v1.svg" width="2160" height="1440" alt="${t('B0与r8连续负载原始对照图','Original B0 and r8 continuous-load chart')}"></a></figure>`};
  }
  function renderR8() {
    document.getElementById('comparison-title').textContent=t('B0 / B1 r8 实测对比','B0 / B1 r8 measured comparison');
    document.getElementById('comparison-lead').textContent='Qwen3.5-35B-A3B · Ascend 910B2 × 2 · BF16';
    const rows=r8Rows(),labels=['4K','16K'];
    const highlights=[[t('4K吞吐','4K throughput'),n(currentR8.comparisons['4096-formal'].throughput_ratio)+'×',t('相对B0','vs B0')],[t('16K吞吐','16K throughput'),n(currentR8.comparisons['16384-formal'].throughput_ratio)+'×',t('相对B0','vs B0')],['4K · TTFT','−'+n(currentR8.comparisons['4096-formal'].ttft_reduction_percent)+'%',t('首token时延降低','Lower time to first token')],['4K · TPOT','−'+n(currentR8.comparisons['4096-formal'].tpot_reduction_percent)+'%',t('逐token时延降低','Lower time per output token')]];
    root.innerHTML=`<section class="comparison-dashboard">${releaseMenu()}<div class="comparison-meta"><span>r8 · ${t('4K / 16K连续负载 · C8 · 正式871请求，失败0','4K / 16K continuous load · C8 · 871 measured requests, zero failures')}</span></div><div class="goal-grid">${highlights.map(([label,value,note])=>`<article class="result-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('')}</div>
      ${frozenProfile('r8',{B0:'8.5.1',B1:'9.1.0'},r8Mods,'E36/R54 · MTP2 · FULL · TP2 · host 4 GiB/rank · KV 20 GiB/rank')}
      <section id="r8-current-continuous"><div class="section-heading"><h2>${t('连续负载性能','Continuous-load performance')}</h2><button type="button" data-detail="metrics">${t('查看数值','View metrics')} ↗</button></div><p class="chart-scale-note">${t('条形按 B0 = 1 归一，右侧为实测值；成本按同费率折算。','Bars normalize B0 to 1; labels show measured values. Cost uses equal device rates.')}</p><div class="metric-grid">${chart('output_tokens_per_second',t('输出吞吐 ↑','Output throughput ↑'),'token/s',1,rows,labels)}${chart('mean_ttft_ms',t('首token时延 ↓','Time to first token ↓'),'s',1000,rows,labels)}${chart('mean_tpot_ms',t('逐token时延 ↓','Time per output token ↓'),'ms',1,rows,labels)}${chart('relative_cost_per_token',t('单位输出token成本 ↓','Cost per output token ↓'),'B0 = 1',1,rows,labels)}</div></section>
      <div class="detail-actions">${[['methods',t('公式与比较方式','Formulas and comparison')],['evidence',t('原始证据','Original evidence')]].map(([key,label])=>`<button type="button" data-detail="${key}">${label} ↗</button>`).join('')}</div>${detailDialog()}</section>`;
    bindMenu();bindDetails(r8Details);root.dataset.baselineId=releaseCatalog.baseline.id;root.dataset.loaded='r8-continuous-20261117';root.dataset.release='r8';root.setAttribute('aria-busy','false');
  }
  function render() {
    if(attemptIds.includes(selectedRelease)) {if(releaseCatalog)renderAttempt();return;}
    if(selectedRelease==='r8') {if(currentR8)renderR8();return;}
    if(['r4','r5','r7'].includes(selectedRelease)) {if(releaseCatalog)renderHistorical();return;}
    if(!data||!combination)return;
    renderR6();root.querySelector('.comparison-dashboard').insertAdjacentHTML('afterbegin',releaseMenu());bindMenu();root.dataset.baselineId=releaseCatalog.baseline.id;root.dataset.release='r6';
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
      await loadReleaseCatalog();
      if(request!==releaseRequest)return;
      if(selectedRelease==='r8'&&!currentR8)await loadR8();
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
