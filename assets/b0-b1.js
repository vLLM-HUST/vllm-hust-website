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
    const quality=(data.historical_current_summary_v102 || data.current_summary).quality;
    const titles=[t('3.4.1 单芯片有效算力','3.4.1 Effective compute per chip'),t('3.4.2 吞吐与时延','3.4.2 Throughput & latency'),t('3.4.3 数据集与长上下文稳定性','3.4.3 Dataset & long-context stability'),t('3.4.4 单位 token 成本','3.4.4 Cost per token')];
    const threshold=eta=>Number.isFinite(eta)?[eta>=50?t('达到数值门槛','Meets numeric threshold'):t('未达到','Below threshold'),eta>=90?t('达到数值门槛','Meets numeric threshold'):t('未达到','Below threshold')]:[t('修订中','Under revision'),t('修订中','Under revision')];
    const methods=`<details class="comparison-method focus-note"><summary>${t('版本定义、阶段门槛与报告来源','Version definitions, stage thresholds and report sources')}</summary><p>${t('B0 固定为 vLLM 0.18 + vLLM-Ascend 0.18。B1 为各工况当前已实测最优的 vLLM-HUST 优化配置，基座版本不限；以下各项结果分别绑定实际版本、配置与证据。','B0 is fixed at vLLM 0.18 + vLLM-Ascend 0.18. B1 is the best measured vLLM-HUST configuration for each workload, with no base-version restriction; results bind their own versions, settings and evidence.')}</p>
      <p id="acceptance-stages"><strong>${t('中期里程碑：效率 ≥50%；最终验收：效率 ≥90%。','Midterm milestone: efficiency ≥50%; final acceptance: efficiency ≥90%.')}</strong> ${t('数值门槛与测试方法、质量及覆盖范围分别核验；单项达到数值门槛不等于整体验收完成。','Numeric thresholds, measurement method, quality and coverage are assessed separately. Meeting one numeric threshold is not complete acceptance.')}</p>
      <p class="focus-source">${escape(data.version)} · <a href="${escape(source(data.m01_method.outline.path))}">${t('测试大纲 V1.5 课题四','V1.5 Project 4 test outline')}</a> · <a href="${escape(data.report_url)}">${t('完整报告与原始记录','Full report and records')}</a></p>
      </details>
      <details class="comparison-method focus-result" id="method-1"><summary>${titles[0]} · ${t('方法与记录','Methods & records')}</summary><p>${escape(ref.model)} · ${escape(ref.dtype)} · ${escape(ref.device)} × ${ref.participating_chips} · ${escape(ref.dataset)}</p>
      ${table([t('方案','Arm'),t('有效算力 TFLOPS/芯片','Effective TFLOPS/chip'),t('效率 η','Efficiency η'),t('中期 50%','Midterm 50%'),t('最终 90%','Final 90%')],['B0','B1'].map(arm=>[arm,number(ref[arm].own_C),number(ref[arm].eta_percent)+'%',...threshold(ref[arm].eta_percent)]))}
      <p>${t('实际运行版本','Actual runtime versions')}: B0 ${escape(pair.identities.B0)}; B1 ${escape(pair.identities.B1)}</p>
      <p class="focus-status">${t('参考修订中：独立标定的B1模型已回验；模型诊断与正式无插桩验收分开。仍需B0路径绑定、适用计时与同预算质量。','Reference under revision: the independently calibrated B1 model was reproduced. Model diagnostics are separate from uninstrumented acceptance. B0 path binding, applicable timing and same-budget quality remain open.')}</p>
      <details><summary>${t('同配置质量与测量范围','Configuration-bound quality and measurement scope')}</summary>${table([t('方案','Arm'),t('正确 / 总题数','Correct / total'),t('长度终止','Length stops')],[['B0',`${quality.b0.correct} / ${quality.b0.total}`,quality.b0.truncated],['B1',`${quality.b1.candidate_correct} / ${quality.b0.total}`,quality.b1.candidate_truncated]])}<p>${t('质量输出预算','Quality output budget')}: ${quality.output_limit}; ${t('计量输出预算','Measurement output budget')}: ${pair.workload.output_budget}. ${t('固定子集，不代表全量或统计非劣结论。','A fixed subset, not a full-corpus or statistical noninferiority finding.')}</p></details>${evidence('m01-verdict')}</details>
      <details class="comparison-method focus-result" id="method-2"><summary>${titles[1]} · ${t('方法与记录','Methods & records')}</summary><p>${t('门槛：吞吐提升 ≥10%；逐请求平均 TTFT、TPOT 分别改善 ≥5%，同时满足质量与 SLO。当前展示 SWE-prefix-reuse、C16、900 秒既有窗口。','Targets: throughput +10% or more; request-weighted mean TTFT and TPOT each improve by at least 5%, with matched quality and SLO. Existing SWE-prefix-reuse C16 windows of 900 seconds are shown.')}</p>
      ${table([t('指标','Metric'),'B0','B1',t('描述性变化','Descriptive change')],[[t('输出 token/秒','Output tokens/s'),number(c16.window_tokens[0]/latency.arms[0].measurement_seconds),number(c16.window_tokens[1]/latency.arms[1].measurement_seconds),'+'+number(c16.descriptive_gain_percent)+'%'],...['ttft','tpot'].map(k=>[k.toUpperCase()+t(' 均值 (ms)',' mean (ms)'),number(latency.arms[0].window[k].mean_seconds*1000),number(latency.arms[1].window[k].mean_seconds*1000),'-'+number(latency.descriptive_reduction_percent[k])+'%'])])}
      <details><summary>${t('C16 运行版本、配置与负载差异','C16 runtime, settings and load differences')}</summary>
      <p>B0: vLLM 0.18 / vLLM-Ascend 0.18 · ${escape(runs[0].validation.effective_graph_mode)}. B1: ${escape(config.engine_version)} · ${escape(config.mods.join(' + '))} · TP${config.parameters.tensor_parallel_size} · ${escape(config.parameters.graph_mode)} · E${config.parameters.execution_seats}/R${config.parameters.resident_seats}.</p>
      <p>${t('B1 MOD 提交','B1 MOD revision')}: ${escape(config.parameters.measured_mod_revision || config.parameters.mod_revision)}.</p>
      <p>${t('同一源权重、轨迹与提示长度已复核；多轮生成不同导致后续提示字节不同。两臂任务质量与 SLO 不能由吞吐推定。记录中的负载种子不同','Source weights, trajectories and prompt lengths were audited; generated turns change subsequent prompt bytes. Throughput does not establish paired task quality or SLO. Recorded load seeds differ')}: ${runs[0].client.seed} / ${runs[1].client.seed}.</p>
      <p class="focus-source"><a href="${source(manifest.files.find(f=>f.website_path==='data/leaderboard_frontier_swe_evidence.json').benchmark_path)}">${t('配置与运行清单','Configurations and run inventory')}</a></p></details>
      <p class="focus-status">${t('已有描述性改善；完整验收未闭合。B1 全部资源占用、任务质量与 SLO 证据仍需核验。该 C16 配置与上一项有效算力配置分别记录，不拼成同一方案。','Descriptive improvements are available; complete acceptance remains open. Full B1 resource occupancy, task quality and SLO evidence still need verification. This C16 deployment is separate from the effective-compute configuration above.')}</p>${evidence('c16-request-latency')}${evidence('baseline018')}</details>
      <details class="comparison-method focus-result" id="method-3"><summary>${titles[2]} · ${t('方法与记录','Methods & records')}</summary><p class="focus-status">${t('尚未完成五项数据集及长上下文的完整配对稳定性验收。要求既定任务异常核查、实际 ≥16K 连续区间、可比 4K 负载与 TTFT/TPOT P95/P99 窗口统计。','Complete paired stability acceptance across all five datasets and long contexts remains open. It requires task anomaly coverage, actual ≥16K continuous intervals, comparable 4K loads, and windowed TTFT/TPOT P95/P99 statistics.')}</p>
      ${data.sections.find(s=>s.id==='v15-remaining').tables[0].rows.map((row,i)=>`<details><summary>${escape(row[0])} — ${escape(t(row[2],['Continuous intervals and service anomalies need matching evidence.','Text/image and solver/judge coverage must remain separate.','Full task coverage and same-task B1 pairing remain incomplete.','Quality completion is not continuous stability acceptance.','Full task coverage and same-task B1 pairing remain incomplete.'][i]))}</summary><p>${escape(window.vllmHustSite.getCurrentLang()==='zh'?row[1]:data.sections.find(s=>s.id==='v15-remaining').tables_en[0].rows[i][1])}</p></details>`).join('')}
      <h3>${t('指定基线质量核查','Quality checks against the designated baseline')}</h3>
      <p>${t('FrontierScience：指定 B0 与原冻结组合的同题配对。两个赛道均未观察到该组合质量提升；这组候选不能作为已通过质量要求的最优 B1。','FrontierScience: same-task pairing of designated B0 and the originally frozen combination. Neither track shows a quality improvement for that candidate; it is not a quality-qualified best B1.')}</p>
      ${sectionTables('frontierscience-designated-pair',[0])}${evidence('frontierscience-designated-pair')}
      <p>${t('HLE-Verified：以下为指定 0.18/0.18 B0 的完整分母评分，未决保留；本表没有同配置 B1 配对，不补成配对通过。','HLE-Verified: designated 0.18/0.18 B0 scores with complete denominators and unresolved cases retained. This table has no matched B1 arm and does not establish paired acceptance.')}</p>
      ${sectionTables('hle-designated-baseline',[0])}${evidence('hle-designated-baseline')}
      ${evidence('v15-remaining')}<details><summary>${t('已有各数据集质量结果','Existing dataset quality results')}</summary>${sectionTables('dataset-quality-inventory',[0,1,2,3,4,5])}${evidence('dataset-quality-inventory')}</details></details>
      <details class="comparison-method focus-result" id="method-4"><summary>${titles[3]} · ${t('方法与记录','Methods & records')}</summary><p>${t('门槛：每百万输出 token 成本降低 ≥10%，可比高负载下芯片平均利用率明显优于基线。','Target: at least 10% lower cost per million output tokens and clearly improved mean chip utilization under comparable high load.')}</p>
      <p><code>${escape(data.milestone_contract.cost_method.allocated_expense)}</code> ${t('为区间分摊费用；单位成本 = 10⁶ × 分摊费用 / 成功输出 token 数。','is the allocated interval expense; unit cost = 10⁶ × allocated expense / successful output tokens.')}</p>
      <p class="focus-status">${t('固定 B0 的货币成本验收未完成。尚需可比 B0/B1、综合月费及折算天数、同区间成功请求用量与时长加权利用率。开发栈历史资源系数不替代此结论。','Monetary cost acceptance against fixed B0 remains incomplete. It needs a comparable B0/B1 pair, documented all-in monthly fees and month days, matched successful-request usage, and time-weighted utilization. Historical development-stack resource coefficients do not establish this result.')}</p>
      <p><a href="./serving-plan.html">${t('进入产能与成本估算 →','Open capacity and cost estimates →')}</a> · ${t('估算基于输入假设，不是本项验收成绩。','Estimates depend on inputs; they are not an acceptance result.')}</p>${evidence('milestone-v15')}</details>`;
    const row=(name,b0,b1,status,gap)=>`<div class="comparison-row"><h3>${escape(name)}</h3><dl>${[['B0',b0],['B1',b1],[t('中期门槛 / 当前判定','Midterm target / verdict'),status],[t('还缺什么','Outstanding evidence'),gap]].map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></div>`;
    const group=(i,rows,note='')=>`<section class="comparison-group" id="metric-${i+1}"><h2>${titles[i]}</h2>${rows}${note?`<p class="comparison-caveat">${escape(note)}</p>`:''}<a class="comparison-detail-link" href="#method-${i+1}">${t('展开方法与记录','Expand methods & records')} →</a></section>`;
    root.innerHTML=`<section class="comparison-overview" aria-labelledby="current-results-title"><h2 id="current-results-title">${t('当前结果与中期进度','Current results & midterm progress')}</h2>
      <p class="comparison-context">${escape(data.version)} · ${t('B0 固定 0.18/0.18；B1 按工况分别记录。数值达标不等于整体验收完成。','B0 fixed at 0.18/0.18; B1 recorded per workload. Numeric success is not full acceptance.')}</p>
      <section id="metric-1"></section>
      <section id="metric-2"></section>
      <section id="metric-3"></section>
      <section id="metric-4"></section>
      </section><section class="comparison-methods" aria-labelledby="methods-title"><h2 id="methods-title">${t('详细方法、证据与历史记录','Detailed methods, evidence & historical records')}</h2>${methods}</section>`;
    const completed=data.acceptance_completion;
    const serving=completed.recovered_serving;
    const diagnostic=completed.reference.graph_recomputation[0];
    const b0Phases=completed.b0_continuous.phases.filter(p=>p.name.endsWith('-formal'));
    const evidencePath='reports/acceptance-completion-20261029/';
    const currentLinks=evidence('acceptance-completion');
    const qualityGap=t('同预算评分 B0 21/200、B1 19/200；质量与 SLO 未闭合。','Same-budget scores: B0 21/200, B1 19/200; quality and SLO remain unresolved.');
    root.querySelector('#metric-1').outerHTML=group(0,
      row(t('实测有效算力','Measured effective compute'),`${number(ref.B0.own_C)} TFLOPS/${t('芯片','chip')}`,`${number(ref.B1.own_C)} TFLOPS/${t('芯片','chip')}`,
        t('正式 η 修订中；尚不能判定通过','Formal eta under revision; acceptance not established'),
        t('B0 独立参考绑定、无插桩计时与同预算质量。','B0 reference binding, uninstrumented timing and same-budget quality.'))+
      row(t('独立标定模型诊断','Independent calibration model diagnostic'),t('参考尚未绑定','Reference not yet bound'),`${number(diagnostic.reference_tflops_per_chip)} TFLOPS/${t('芯片','chip')}`,
        `${number(diagnostic.efficiency_percent)}% · `+t('对原计数轮的诊断，不是正式 η','Diagnostic against the counted run, not formal eta'),
        t('三场景为敏感性，不是置信区间。','Three scenarios are sensitivity analysis, not a confidence interval.')),
      t('中期门槛50%，最终门槛90%；正式参考仍在修订。','Midterm target: 50%; final target: 90%. The formal reference remains under revision.'));
    root.querySelector('#metric-2').outerHTML=group(1,
      [['output_tokens_per_second',t('输出吞吐（token/s）','Output throughput (tokens/s)')],['equal_request_mean_TTFT_ms',t('平均 TTFT（ms）','Mean TTFT (ms)')],['equal_request_mean_TPOT_ms',t('平均 TPOT（ms/token）','Mean TPOT (ms/token)')]].map(([key,label])=>
        row(label,number(serving.arms.B0[key]),number(serving.arms.B1[key]),t('服务测量已复算；完整验收未通过','Serving metrics recomputed; full acceptance not established'),qualityGap)).join(''),
      t('固定200请求、out256、各保留两卡；B1为0.28.1/Ascend0.25.1rc2开发栈。C16记录在详情中另列。','Fixed 200 requests, out256, two reserved cards per arm; B1 uses the 0.28.1/Ascend 0.25.1rc2 development stack. C16 records remain separate in details.'));
    root.querySelector('#metric-3').outerHTML=group(2,
      row(t('4K / 16K 连续运行','4K / 16K continuous operation'),
        t(`${b0Phases[0].requests} / ${b0Phases[1].requests} 请求，零失败`,`${b0Phases[0].requests} / ${b0Phases[1].requests} requests, no failures`),
        t('24个预热成功；正式4K的8请求失败；16K未执行','24 warmup successes; 8 formal 4K failures; 16K not run'),
        t('该 B1 合成压力配置实测失败','This B1 synthetic stress configuration failed'),
        t('状态卸载锁页主机内存分配故障；需修复后重新验证。','Pinned host allocation failed during state offload; repair and revalidation required.'))+
      row(t('16K / 32K 检索','16K / 32K retrieval'),'6 / 6','6 / 6',t('检索通过，与连续稳定性分开','Retrieval passed, separate from continuous stability'),t('五任务原记录已审计；HLE旧退出缺失和Agent上下文失败保留。','Five-task records audited; HLE unknown old exit and Agent context failures retained.')),
      t('实际输入4115/16407 token，C8闭环，正式发起300秒并完整排空；合成压力不替代五任务质量。','Actual 4115/16407 input tokens, C8 closed loop, 300-second formal submission plus drain; synthetic stress is not five-task quality.'));
    root.querySelector('#metric-4').outerHTML=group(3,
      row(t('每百万输出 token 租赁估算（元）','Rental estimate per million output tokens (CNY)'),
        number(serving.arms.B0.compute_rental_CNY_per_million_output_tokens),number(serving.arms.B1.compute_rental_CNY_per_million_output_tokens),
        t('算术降低','Arithmetic reduction')+` ${number(serving.improvements_percent.same_rate_compute_rental_cost)}%；`+t('不是业务验收通过','not business acceptance'),qualityGap)+
      row(t('原成本区间利用率','Utilization over the original cost interval'),t('条件界限9.4245–16.7177%，非精确点','Conditional bounds 9.4245–16.7177%, not an exact point'),
        number(serving.arms.B1.same_interval_ai_core_utilization.mean_percent)+'%',t('精确配对仍未闭合','Exact paired comparison remains open'),
        t('B0原轮缺同轮时钟桥；不能借用新连续轮填数。','B0 lacks a same-run clock bridge; new continuous data cannot fill the old run.')),
      t('天翼云类似双卡910B报价36908元/月；30天分析假设，云盘/公网另计。不是本机账单。','Analogous CTYun dual 910B quote: CNY 36908/month; 30-day analysis assumption, disk/network extra. Not this machine’s bill.'));
    const primaryEvidence=['reference-method.md','out256-quality-audit.json','continuous-summary.json','README.md'];
    for (const id of [1,2,3,4]) root.querySelector('#metric-'+id).insertAdjacentHTML('beforeend',`<p class="focus-source"><a href="${source(evidencePath+primaryEvidence[id-1])}">${t('原始证据与复算','Original evidence and recomputation')}</a></p>`);
    root.querySelector('#method-1').insertAdjacentHTML('beforeend',`<p>${t('B1模型参考时间','B1 modeled reference time')}: ${number(diagnostic.reference_seconds)} s · ${number(diagnostic.efficiency_percent)}% · <a href="${source(evidencePath+'reference-method.md')}">${t('参考推导与适用范围','Derivation and applicability')}</a></p>`);
    root.querySelector('#method-3').insertAdjacentHTML('beforeend',sectionTables('acceptance-completion',[0])+currentLinks);
    root.querySelector('#method-4 .focus-status').textContent=t('固定B0请求集合与公开类似机器报价已恢复，租赁估算降低46.4178%。原out256质量21/200对19/200、B0精确时钟桥及业务适用性仍未闭合。','Fixed-B0 request usage and analogous public pricing were recovered; rental arithmetic falls46.4178%. Out256 quality21/200 versus19/200, exact B0 clock alignment and business applicability remain unresolved.');
    root.querySelector('#method-4').insertAdjacentHTML('beforeend',`<p><a href="${source('reports/acceptance-gaps-20261029/README.md')}">${t('公开报价、原始用量与成本复算','Public pricing, original usage and cost recomputation')}</a></p>`);
    if (data.full_answer_joint) {
      root.querySelector('#metric-1 .comparison-row h3').textContent=t('实测有效算力（原out256计数工况）','Measured effective compute (prior out256 counted workload)');
      const joint=data.full_answer_joint, [a,b]=joint.arms;
      const continuous=data.packed_continuous;
      const newPath='reports/full-answer-joint-20261030/';
      const qualityScope=joint.quality_observation.fixed_subset_correct_count_not_lower
        ? t('本轮固定子集正确数未下降；不是全集或统计非劣结论。','No lower correct count on the fixed subset; not full-corpus or statistical noninferiority.')
        : t('本轮候选正确数下降，未通过质量比较。','Candidate correct count fell; quality comparison failed.');
      const numeric=(value,target)=>`${number(value)}% · `+(value>=target?t('达到数值门槛','Meets numeric target'):t('未达到数值门槛','Below numeric target'));
      root.querySelector('#metric-2').outerHTML=group(1,
        row(t('同轮质量 / 长度终止','Same-run quality / length stops'),`${a.correct}/200 · ${a.truncated}`,`${b.correct}/200 · ${b.truncated}`,qualityScope,t('原评分器、全部200题；截断与逐题退步保留。','Original scorer and all200 tasks; length stops and paired regressions retained.'))+
        row(t('输出吞吐（token/s）','Output throughput (tokens/s)'),number(a.output_tokens_per_second),number(b.output_tokens_per_second),numeric(joint.output_throughput_change_percent,10),qualityScope)+
        ['ttft_ms','tpot_ms'].map(key=>row(key==='ttft_ms'?t('平均 TTFT（ms）','Mean TTFT (ms)'):t('平均 TPOT（ms/token）','Mean TPOT (ms/token)'),number(a.timing[key].mean),number(b.timing[key].mean),numeric(joint.latency_reduction_percent[key],5),t('相同突发到达；不外推交互式SLO。','Matched burst arrivals; not an interactive-SLO claim.'))).join(''),
        t('MMLU-Pro固定200题，完整回答上限8192；两张910B2。B1候选为0.28.1/Ascend0.25.1rc2开发栈，主机State预算4GiB/rank。','MMLU-Pro fixed200, full-answer cap8192; two910B2 cards. B1 candidate uses0.28.1/Ascend0.25.1rc2 with4GiB/rank host State.'));
      const phaseText=arm=>continuous[arm].phases.filter(p=>p.name.endsWith('formal')).map(p=>p.requests).join(' / ')+t(' 请求，零失败',' requests, no failures');
      root.querySelector('#metric-3').outerHTML=group(2,
        row(t('4K / 16K 连续窗口','4K / 16K continuous windows'),phaseText('b0'),phaseText('b1'),t('两臂窗口完成；吞吐和尾时延见详情','Both arms completed; throughput and tails in details'),t('五任务全范围稳定性仍有原缺项；合成窗口不替代任务质量。','Original five-task coverage gaps remain; synthetic windows are not task quality.'))+
        row(t('16K / 32K 检索（既有配置）','16K / 32K retrieval (prior configuration)'),'6 / 6','6 / 6',t('原检索结果保留','Prior retrieval results retained'),t('不同于本轮4GiB主机State配置，未重复检索测试。','Separate from the current4GiB host-State configuration; retrieval was not rerun.')),
        t('实际输入4115/16407 token、C8、out256；60秒预热、300秒正式发起后完整排空。旧分配失败保留。','Actual4115/16407 input tokens, C8, out256;60-second warmup and300-second formal arrivals plus full drain. Prior allocation failures retained.'));
      root.querySelector('#metric-4').outerHTML=group(3,
        row(t('每百万输出 token 租赁估算（元）','Rental estimate per million output tokens (CNY)'),number(a.cost.cny_per_million_output_tokens),number(b.cost.cny_per_million_output_tokens),numeric(joint.rental_cost_reduction_percent,10),qualityScope)+
        row(t('同请求区间 AI Core 采样均值','AI Core sample mean over the same request interval'),number(a.utilization.mean_percent)+'%',number(b.utilization.mean_percent)+'%',t('双卡同期采样，覆盖范围已复核','Synchronized two-card samples; coverage audited'),t('报告采样均值及逐卡值，不将采样当作精确物理利用率。','Sample means and per-card values, not exact physical utilization.')),
        t('天翼云类似双卡910B报价36908元/月、30天分析约定；云盘/公网另计，不是本机账单。分母含答错及长度终止的已完成输出。','Analogous CTYun dual910B: CNY36908/month and a30-day convention; disk/network extra, not this host’s bill. Completed output includes incorrect and length-stopped answers.'));
      for (const id of [2,3,4]) root.querySelector('#metric-'+id).insertAdjacentHTML('beforeend',`<p class="focus-source"><a href="${source(newPath+(id===3?'continuous-summary.json':'joint-summary.json'))}">${t('本轮原始证据与复算','Current original evidence and recomputation')}</a></p>`);
      root.querySelector('#method-2 > summary').insertAdjacentHTML('afterend',`<h3>${t('完整回答联合测量','Full-answer joint measurement')}</h3>${sectionTables('full-answer-joint',[0])}${evidence('full-answer-joint')}<h3>${t('既有 C16 记录','Prior C16 records')}</h3>`);
      root.querySelector('#method-3 > summary').insertAdjacentHTML('afterend',`<h3>${t('本轮4K/16K连续窗口','Current4K/16K continuous windows')}</h3>${sectionTables('full-answer-joint',[1])}${evidence('full-answer-joint')}<p>${t('以下保留五任务范围与旧配置失败，V1.02的失败不改写为本轮结果。','Five-task scope and prior configuration failures follow; V1.02 failures are not rewritten as this run.')}</p>`);
      root.querySelector('#method-4 .focus-status').textContent=t('本轮固定200题完整回答已同步采齐费用用量、质量及双卡利用率。结果按公开类似机型报价复算，逐题和生命周期统计见原件。下面旧成本链接保留原out256范围。','The fixed200 full-answer run jointly captured usage, quality and two-card utilization. Costs use analogous public pricing; per-task and lifecycle metrics are linked. The old cost link below retains its out256 scope.');
      root.querySelector('#method-4').insertAdjacentHTML('beforeend',evidence('full-answer-joint'));
    }
    root.querySelectorAll('.comparison-detail-link').forEach(link=>link.addEventListener('click',()=>{
      const details=root.querySelector(link.getAttribute('href'));
      details.open=true;
    }));
    openLinkedMethod();
    root.dataset.loaded=data.version;
  }
  function openLinkedMethod() {
    if (/^#method-[1-4]$/.test(location.hash)) {
      const details=document.querySelector(location.hash);
      if (details) details.open=true;
    }
  }
  window.addEventListener('hashchange',openLinkedMethod);
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
    const [d,runs]=await Promise.all(['data/midterm-v103.json','data/leaderboard_frontier_swe_evidence.json'].map(fetchVerified));
    if(d.schema!=='midterm-publication/v1'||d.version!=='V1.03')throw Error('Invalid report');
    const joint=d.full_answer_joint;
    if(joint?.same_run_quality_and_performance!==true||joint.protocol?.max_completion_tokens!==8192||joint.arms?.length!==2||joint.arms[0].role!=='B0'||joint.arms[1].role!=='B1'||joint.arms.some(a=>a.completed!==200||a.failed!==0)||!d.packed_continuous)throw Error('Invalid full-answer pair');
    if(d.acceptance_completion?.continuous?.status!=='B0_completed_B1_measured_host_allocation_failure'||d.acceptance_completion.continuous.paired_continuous_stability_pass!==false)throw Error('Invalid completion evidence');
    const ref=d.wholechain_reference;
    if(ref?.status!=='reference_under_revision'||ref.reference_qualified!==false||ref.reference_C_TFLOPS_per_chip!==null)throw Error('Invalid reference revision');
    for(const arm of ['B0','B1']) if(ref[arm]?.eta_percent!==null||ref[arm]?.eta_target_met!==null||!Number.isFinite(ref[arm]?.own_C)||ref[arm].own_C!==ref[arm].ownF/(ref.participating_chips*ref[arm].own_T_seconds*1e12))throw Error('Invalid same-run measurement');
    const missingC16=d.c16_equal_request_latency.arms.some(arm=>!runs.runs.some(r=>r.run_id===arm.run_id));
    if(missingC16)throw Error('Missing C16 identity');
    data=d;manifest=m;runEvidence=runs;render();
  }
  loadPublication().catch(error=>{console.error('B0/B1 publication load failed',error);root.textContent=t('结果加载失败或校验不一致，请刷新重试。','Results unavailable or publication verification failed; please retry.');});
})();
