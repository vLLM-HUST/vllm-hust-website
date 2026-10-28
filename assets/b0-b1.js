(() => {
  'use strict';
  let data, manifest, runEvidence;
  const root = document.getElementById('comparison');
  const escape = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t = (cn, en) => window.vllmHustSite.getCurrentLang() === 'zh' ? cn : en;
  const number = v => Number.isFinite(v) ? v.toFixed(4) : '—';
  const table = (headers, rows) => `<div class="focus-table" tabindex="0" role="region" aria-label="${escape(headers.join(' / '))}"><table><thead><tr>${headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>i?`<td>${escape(c)}</td>`:`<th scope="row">${escape(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const source = path => `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${manifest.commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const evidence = id => {
    const s = data.sections.find(s=>s.id===id);
    return `<p class="focus-source">${t('原始证据','Original evidence')}: ${s.evidence.map(e=>`<a href="${escape(source(e.path).replace('/blob/',`/${e.kind}/`))}">${escape(e.label)}</a>`).join(' · ')}</p>`;
  };
  const sectionTables = (id, indices) => {
    const s = data.sections.find(s=>s.id===id);
    const tables = window.vllmHustSite.getCurrentLang()==='zh' ? s.tables : (s.tables_en || s.tables);
    return indices.map(i=>table(tables[i].headers,tables[i].rows)).join('');
  };
  function render() {
    document.getElementById('comparison-title').textContent=t('B0/B1 大纲对比','B0/B1 results by test outline');
    document.getElementById('comparison-lead').textContent=t('按测试大纲 3.4.1—3.4.4 展示现有结果与未完成项。','Current results and outstanding evidence, organized by test-outline sections 3.4.1–3.4.4.');
    if (!data) return;
    const ref=data.wholechain_reference, pair=data.paired_own_compute;
    const c16=data.milestone_contract.recomputed.c16_fixed_b0;
    const latency=data.c16_equal_request_latency;
    const runs=latency.arms.map(arm=>runEvidence.runs.find(r=>r.run_id===arm.run_id));
    const config=runs[1].configuration;
    const quality=data.current_summary.quality;
    const titles=[t('3.4.1 单芯片有效算力','3.4.1 Effective compute per chip'),t('3.4.2 吞吐与时延','3.4.2 Throughput & latency'),t('3.4.3 数据集与长上下文稳定性','3.4.3 Dataset & long-context stability'),t('3.4.4 单位 token 成本','3.4.4 Cost per token')];
    const threshold=eta=>[eta>=50?t('达到数值门槛','Meets numeric threshold'):t('未达到','Below threshold'),eta>=90?t('达到数值门槛','Meets numeric threshold'):t('未达到','Below threshold')];
    root.innerHTML=`<div class="focus-note"><p>${t('B0 固定为 vLLM 0.18 + vLLM-Ascend 0.18。B1 为各工况当前已实测最优的 vLLM-HUST 优化配置，基座版本不限；以下各项结果分别绑定实际版本、配置与证据。','B0 is fixed at vLLM 0.18 + vLLM-Ascend 0.18. B1 is the best measured vLLM-HUST configuration for each workload, with no base-version restriction; results bind their own versions, settings and evidence.')}</p>
      <p id="acceptance-stages"><strong>${t('中期里程碑：效率 ≥50%；最终验收：效率 ≥90%。','Midterm milestone: efficiency ≥50%; final acceptance: efficiency ≥90%.')}</strong> ${t('数值门槛与测试方法、质量及覆盖范围分别核验；单项达到数值门槛不等于整体验收完成。','Numeric thresholds, measurement method, quality and coverage are assessed separately. Meeting one numeric threshold is not complete acceptance.')}</p>
      <p class="focus-source">${escape(data.version)} · <a href="${escape(source(data.m01_method.outline.path))}">${t('测试大纲 V1.5 课题四','V1.5 Project 4 test outline')}</a> · <a href="${escape(data.report_url)}">${t('完整报告与原始记录','Full report and records')}</a></p>
      <nav class="benchmark-tabs">${titles.map((title,i)=>`<a href="#metric-${i+1}">${title}</a>`).join('')}</nav></div>
      <section class="focus-result" id="metric-1"><h2>${titles[0]}</h2><p>${escape(ref.model)} · ${escape(ref.dtype)} · ${escape(ref.device)} × ${ref.participating_chips} · ${escape(ref.dataset)}</p>
      ${table([t('方案','Arm'),t('有效算力 TFLOPS/芯片','Effective TFLOPS/chip'),t('效率 η','Efficiency η'),t('中期 50%','Midterm 50%'),t('最终 90%','Final 90%')],['B0','B1'].map(arm=>[arm,number(ref[arm].own_C),number(ref[arm].eta_percent)+'%',...threshold(ref[arm].eta_percent)]))}
      <p>${t('实际运行版本','Actual runtime versions')}: B0 ${escape(pair.identities.B0)}; B1 ${escape(pair.identities.B1)}</p>
      <p class="focus-status">${t('当前测量采用独立执行的整链经验参考，保留同轮计量开销，并非严格无插桩；参考与 B1 共享代码。表中效率不是芯片理论峰值利用率。中期大纲原方法的独立推导、无插桩适用性需单独核验。','The current measurement uses an independently executed empirical whole-chain reference, retaining same-run accounting costs rather than strictly uninstrumented timing. The reference shares code with B1. This efficiency is not utilization of theoretical chip peak. Applicability to the original midterm independently derived, uninstrumented method must be assessed separately.')}</p>
      <details><summary>${t('同配置质量与测量范围','Configuration-bound quality and measurement scope')}</summary>${table([t('方案','Arm'),t('正确 / 总题数','Correct / total'),t('长度终止','Length stops')],[['B0',`${quality.b0.correct} / ${quality.b0.total}`,quality.b0.truncated],['B1',`${quality.b1.candidate_correct} / ${quality.b0.total}`,quality.b1.candidate_truncated]])}<p>${t('质量输出预算','Quality output budget')}: ${quality.output_limit}; ${t('计量输出预算','Measurement output budget')}: ${pair.workload.output_budget}. ${t('固定子集，不代表全量或统计非劣结论。','A fixed subset, not a full-corpus or statistical noninferiority finding.')}</p></details>${evidence('m01-verdict')}</section>
      <section class="focus-result" id="metric-2"><h2>${titles[1]}</h2><p>${t('门槛：吞吐提升 ≥10%；逐请求平均 TTFT、TPOT 分别改善 ≥5%，同时满足质量与 SLO。当前展示 SWE-prefix-reuse、C16、900 秒既有窗口。','Targets: throughput +10% or more; request-weighted mean TTFT and TPOT each improve by at least 5%, with matched quality and SLO. Existing SWE-prefix-reuse C16 windows of 900 seconds are shown.')}</p>
      ${table([t('指标','Metric'),'B0','B1',t('描述性变化','Descriptive change')],[[t('输出 token/秒','Output tokens/s'),number(c16.window_tokens[0]/latency.arms[0].measurement_seconds),number(c16.window_tokens[1]/latency.arms[1].measurement_seconds),'+'+number(c16.descriptive_gain_percent)+'%'],...['ttft','tpot'].map(k=>[k.toUpperCase()+t(' 均值 (ms)',' mean (ms)'),number(latency.arms[0].window[k].mean_seconds*1000),number(latency.arms[1].window[k].mean_seconds*1000),'-'+number(latency.descriptive_reduction_percent[k])+'%'])])}
      <details><summary>${t('C16 运行版本、配置与负载差异','C16 runtime, settings and load differences')}</summary>
      <p>B0: vLLM 0.18 / vLLM-Ascend 0.18 · ${escape(runs[0].validation.effective_graph_mode)}. B1: ${escape(config.engine_version)} · ${escape(config.mods.join(' + '))} · TP${config.parameters.tensor_parallel_size} · ${escape(config.parameters.graph_mode)} · E${config.parameters.execution_seats}/R${config.parameters.resident_seats}.</p>
      <p>${t('B1 MOD 提交','B1 MOD revision')}: ${escape(config.parameters.measured_mod_revision || config.parameters.mod_revision)}.</p>
      <p>${t('同一源权重、轨迹与提示长度已复核；多轮生成不同导致后续提示字节不同。两臂任务质量与 SLO 不能由吞吐推定。记录中的负载种子不同','Source weights, trajectories and prompt lengths were audited; generated turns change subsequent prompt bytes. Throughput does not establish paired task quality or SLO. Recorded load seeds differ')}: ${runs[0].client.seed} / ${runs[1].client.seed}.</p>
      <p class="focus-source"><a href="${source(manifest.files.find(f=>f.website_path==='data/leaderboard_frontier_swe_evidence.json').benchmark_path)}">${t('配置与运行清单','Configurations and run inventory')}</a></p></details>
      <p class="focus-status">${t('已有描述性改善；完整验收未闭合。B1 全部资源占用、任务质量与 SLO 证据仍需核验。该 C16 配置与上一项有效算力配置分别记录，不拼成同一方案。','Descriptive improvements are available; complete acceptance remains open. Full B1 resource occupancy, task quality and SLO evidence still need verification. This C16 deployment is separate from the effective-compute configuration above.')}</p>${evidence('c16-request-latency')}${evidence('baseline018')}</section>
      <section class="focus-result" id="metric-3"><h2>${titles[2]}</h2><p class="focus-status">${t('尚未完成五项数据集及长上下文的完整配对稳定性验收。要求既定任务异常核查、实际 ≥16K 连续区间、可比 4K 负载与 TTFT/TPOT P95/P99 窗口统计。','Complete paired stability acceptance across all five datasets and long contexts remains open. It requires task anomaly coverage, actual ≥16K continuous intervals, comparable 4K loads, and windowed TTFT/TPOT P95/P99 statistics.')}</p>
      ${data.sections.find(s=>s.id==='v15-remaining').tables[0].rows.map((row,i)=>`<details><summary>${escape(row[0])} — ${escape(t(row[2],['Continuous intervals and service anomalies need matching evidence.','Text/image and solver/judge coverage must remain separate.','Full task coverage and same-task B1 pairing remain incomplete.','Quality completion is not continuous stability acceptance.','Full task coverage and same-task B1 pairing remain incomplete.'][i]))}</summary><p>${escape(window.vllmHustSite.getCurrentLang()==='zh'?row[1]:data.sections.find(s=>s.id==='v15-remaining').tables_en[0].rows[i][1])}</p></details>`).join('')}
      <h3>${t('指定基线质量核查','Quality checks against the designated baseline')}</h3>
      <p>${t('FrontierScience：指定 B0 与原冻结组合的同题配对。两个赛道均未观察到该组合质量提升；这组候选不能作为已通过质量要求的最优 B1。','FrontierScience: same-task pairing of designated B0 and the originally frozen combination. Neither track shows a quality improvement for that candidate; it is not a quality-qualified best B1.')}</p>
      ${sectionTables('frontierscience-designated-pair',[0])}${evidence('frontierscience-designated-pair')}
      <p>${t('HLE-Verified：以下为指定 0.18/0.18 B0 的完整分母评分，未决保留；本表没有同配置 B1 配对，不补成配对通过。','HLE-Verified: designated 0.18/0.18 B0 scores with complete denominators and unresolved cases retained. This table has no matched B1 arm and does not establish paired acceptance.')}</p>
      ${sectionTables('hle-designated-baseline',[0])}${evidence('hle-designated-baseline')}
      ${evidence('v15-remaining')}<details><summary>${t('已有各数据集质量结果','Existing dataset quality results')}</summary>${sectionTables('dataset-quality-inventory',[0,1,2,3,4,5])}${evidence('dataset-quality-inventory')}</details></section>
      <section class="focus-result" id="metric-4"><h2>${titles[3]}</h2><p>${t('门槛：每百万输出 token 成本降低 ≥10%，可比高负载下芯片平均利用率明显优于基线。','Target: at least 10% lower cost per million output tokens and clearly improved mean chip utilization under comparable high load.')}</p>
      <p><code>${escape(data.milestone_contract.cost_method.allocated_expense)}</code> ${t('为区间分摊费用；单位成本 = 10⁶ × 分摊费用 / 成功输出 token 数。','is the allocated interval expense; unit cost = 10⁶ × allocated expense / successful output tokens.')}</p>
      <p class="focus-status">${t('固定 B0 的货币成本验收未完成。尚需可比 B0/B1、综合月费及折算天数、同区间成功请求用量与时长加权利用率。开发栈历史资源系数不替代此结论。','Monetary cost acceptance against fixed B0 remains incomplete. It needs a comparable B0/B1 pair, documented all-in monthly fees and month days, matched successful-request usage, and time-weighted utilization. Historical development-stack resource coefficients do not establish this result.')}</p>
      <p><a href="./serving-plan.html">${t('进入产能与成本估算 →','Open capacity and cost estimates →')}</a> · ${t('估算基于输入假设，不是本项验收成绩。','Estimates depend on inputs; they are not an acceptance result.')}</p>${evidence('milestone-v15')}</section>`;
    root.dataset.loaded=data.version;
  }
  window.addEventListener('vllm-hust:langchange',render);
  async function loadPublication() {
    const response=await fetch('./data/benchmark-source-manifest.json',{cache:'no-cache'});
    if(!response.ok) throw Error('Unavailable manifest');
    const m=await response.json();
    if(m.repository!=='vLLM-HUST/vllm-hust-benchmark'||m.status!=='published-source'||!/^[a-f0-9]{40}$/.test(m.commit))throw Error('Invalid publication');
    const fetchVerified=async path=>{
      const entry=m.files.find(f=>f.website_path===path);
      if(!entry)throw Error('Unpublished data');
      const r=await fetch('./'+path,{cache:'no-cache'});if(!r.ok)throw Error('Unavailable data');
      const raw=await r.arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==entry.sha256||raw.byteLength!==entry.bytes)throw Error('Publication identity mismatch');
      return JSON.parse(new TextDecoder().decode(raw));
    };
    const [d,runs]=await Promise.all(['data/midterm-v099.json','data/leaderboard_frontier_swe_evidence.json'].map(fetchVerified));
    if(d.schema!=='midterm-publication/v1'||d.version!=='V0.99')throw Error('Invalid report');
    if(!d.wholechain_reference?.reference_qualified||!d.wholechain_reference.all_frozen_applicability_checks_pass)throw Error('Reference not qualified');
    for(const arm of ['B0','B1']) if(!Number.isFinite(d.wholechain_reference[arm]?.eta_percent)||!Number.isFinite(d.wholechain_reference[arm]?.own_C))throw Error('Missing measurement');
    for(const arm of d.c16_equal_request_latency.arms) if(!runs.runs.some(r=>r.run_id===arm.run_id))throw Error('Missing C16 identity');
    data=d;manifest=m;runEvidence=runs;render();
  }
  loadPublication().catch(()=>{root.textContent=t('结果加载失败或校验不一致，请刷新重试。','Results unavailable or publication verification failed; please retry.');});
})();
