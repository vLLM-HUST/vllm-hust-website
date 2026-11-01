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
    document.getElementById('comparison-lead').textContent=t('按测试大纲 3.4.1—3.4.4 列出本轮结论、实测数值与具体缺项。','Results, measurements and specific missing tests for outline sections 3.4.1–3.4.4.');
    if (!data) return;
    const ref=data.wholechain_reference, joint=data.full_answer_joint, [a,b]=joint.arms;
    const diagnostic=ref.model_diagnostic.graph_recomputation.find(x=>x.seed===ref.model_diagnostic.primary_seed);
    const continuous=data.packed_continuous;
    const [q0,q1]=data.acceptance_completion.out256_quality.arms;
    const phases=arm=>continuous[arm].phases.filter(p=>p.name.endsWith('-formal'));
    const phaseText=arm=>phases(arm).map(p=>p.requests).join(' / ')+t(' 请求，',' requests, ')+phases(arm).reduce((sum,p)=>sum+p.failures,0)+t(' 失败',' failures');
    const numeric=(value,target)=>`${number(value)}% · `+(value>=target?t('达标','Met'):t('未达标','Not met'));
    const qualityPass=joint.quality_observation.fixed_subset_correct_count_not_lower;
    const qualityVerdict=qualityPass?t('通过：本批正确数未下降','Passed: correct count did not fall in this batch'):t('未通过：本批正确数下降','Failed: correct count fell in this batch');
    const servingPass=qualityPass&&joint.output_throughput_change_percent>=10&&Object.values(joint.latency_reduction_percent).every(v=>v>=5);
    const costPass=qualityPass&&joint.rental_cost_reduction_percent>=10&&b.utilization.mean_percent>a.utilization.mean_percent;
    const zeroFailures=['b0','b1'].every(arm=>phases(arm).length===2&&phases(arm).every(p=>p.requests>0&&p.failures===0));
    const titles=[t('3.4.1 单芯片有效算力','3.4.1 Effective compute per chip'),t('3.4.2 吞吐与时延','3.4.2 Throughput & latency'),t('3.4.3 数据集与长上下文稳定性','3.4.3 Dataset & long-context stability'),t('3.4.4 单位 token 成本','3.4.4 Cost per token')];
    const row=(name,b0,b1,status,basis)=>`<div class="comparison-row"><h3>${escape(name)}</h3><dl>${[['B0',b0],['B1',b1],[t('本轮结论','Result'),status],[t('判定依据','Basis'),basis]].map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></div>`;
    const group=(i,verdict,rows,note,path)=>`<section class="comparison-group" id="metric-${i+1}"><h2>${titles[i]}</h2><p class="comparison-verdict"><strong>${escape(verdict)}</strong></p>${rows}<p class="comparison-caveat">${escape(note)}</p><a class="comparison-detail-link" href="#method-${i+1}">${t('展开方法与记录','Expand methods & records')} →</a><p class="focus-source"><a href="${source(path)}">${t('原始证据与复算','Original evidence and recomputation')}</a></p></section>`;
    const qualityBasis=t('MMLU-Pro 固定200题；原评分器；回答上限8192 token。','MMLU-Pro fixed 200; original scorer; output cap 8192 tokens.');
    const m01Verdict=t('未通过：η 计量条件不完整','Not accepted: incomplete η measurement conditions');
    const stabilityVerdict=t('未通过：五项任务的完整稳定性检查未完成','Not accepted: five-dataset stability checks incomplete');
    const continuousVerdict=zeroFailures?t('运行通过：两臂窗口完成，零失败','Run passed: Both arms completed, no failures'):t('运行未通过：存在失败或缺少窗口','Run failed: failures or missing windows');
    const currentPath='reports/full-answer-joint-20261030/';
    const overview=group(0,m01Verdict,
      row(t('实测有效算力（out256计数工况）','Measured compute (out256 counted workload)'),`${number(ref.B0.own_C)} TFLOPS/${t('芯片','chip')}`,`${number(ref.B1.own_C)} TFLOPS/${t('芯片','chip')}`,
        t('有效算力已测得；η 验收未通过','Compute measured; η acceptance not passed'),
        t('缺少 B0 路径参考及匹配的无插桩计时；同预算评分','Missing B0 path reference and matched uninstrumented timing; same-budget scores')+` B0 ${q0.correct}/${q0.total}、B1 ${q1.correct}/${q1.total}。`)+
      row(t('独立标定模型诊断','Independent calibration model diagnostic'),t('无对应参考值','No bound reference'),`${number(diagnostic.reference_tflops_per_chip)} TFLOPS/${t('芯片','chip')}`,
        `${number(diagnostic.efficiency_percent)}% · `+t('模型值低于中期50%门槛','Model value below the 50% midterm target'),
        t('以独立标定的 B1 依赖图计算参考时间，与原计数轮耗时比较。','B1 reference time from independently calibrated dependencies, compared with the counted run.')),
      t('中期 η ≥50%，最终 η ≥90%。本轮未出具正式 η；上列效率为模型诊断值。','Midterm η ≥50%; final η ≥90%. Formal η is not issued for this run; the efficiency above is a model diagnostic.'),
      'reports/acceptance-completion-20261029/reference-reassessment-20261029.json')+
      group(1,servingPass?t('本批次达标：吞吐、TTFT、TPOT及正确数比较通过','Batch targets met: throughput, TTFT, TPOT and correct-count comparison'):t('本批次未达标','Batch targets not met'),
        row(t('同轮质量 / 长度终止','Same-run quality / length stops'),`${a.correct}/${a.completed} · ${a.truncated}`,`${b.correct}/${b.completed} · ${b.truncated}`,qualityVerdict,qualityBasis)+
        row(t('输出吞吐（token/s）','Output throughput (tokens/s)'),number(a.output_tokens_per_second),number(b.output_tokens_per_second),numeric(joint.output_throughput_change_percent,10),t('提升门槛 ≥10%。','Target: improvement ≥10%.'))+
        ['ttft_ms','tpot_ms'].map(key=>row(key==='ttft_ms'?t('平均 TTFT（ms）','Mean TTFT (ms)'):t('平均 TPOT（ms/token）','Mean TPOT (ms/token)'),number(a.timing[key].mean),number(b.timing[key].mean),numeric(joint.latency_reduction_percent[key],5),t('改善门槛 ≥5%；逐请求等权均值。','Target: reduction ≥5%; request-weighted mean.'))).join(''),
        t('200题同时到达、完整回答、双卡910B2；结论适用于本批次。多轮工具调用 C16 的独立结果见详情。','200 simultaneous full-answer requests on two 910B2 cards; this result applies to the batch. Separate multi-turn C16 results are below.'),currentPath+'joint-summary.json')+
      group(2,stabilityVerdict,
        row(t('4K / 16K 连续窗口','4K / 16K continuous windows'),phaseText('b0'),phaseText('b1'),continuousVerdict,
          t('每阶段60秒预热、300秒正式发起，随后完整排空。','Each phase: 60 s warmup, 300 s arrivals, then full drain.'))+
        row(t('16K / 32K 检索（既有配置）','16K / 32K retrieval (prior configuration)'),'6 / 6','6 / 6',t('检索通过','Retrieval passed'),
          t('原配置的检索测试；本轮4GiB/rank配置未执行此项。','Retrieval in the prior configuration; not run for this round’s 4 GiB/rank configuration.')),
        t('连续窗口已经完成。五任务仍缺完整配对、服务异常记录和连续稳定性核验，详见任务清单。','Continuous windows are complete. Full paired coverage, service-anomaly records and stability checks remain missing across the five-task inventory.'),currentPath+'continuous-summary.json')+
      group(3,costPass?t('同价租赁估算达标：成本降幅及利用率均满足指标','Same-rate rental estimate meets cost and utilization targets'):t('同价租赁估算未达标','Same-rate rental estimate does not meet targets'),
        row(t('每百万输出 token 租赁估算（元）','Rental estimate per million output tokens (CNY)'),number(a.cost.cny_per_million_output_tokens),number(b.cost.cny_per_million_output_tokens),numeric(joint.rental_cost_reduction_percent,10),t('同一报价、费用范围和测量区间；降幅门槛 ≥10%。','Same price, scope and measurement interval; target reduction ≥10%.'))+
        row(t('同请求区间 AI Core 采样均值','AI Core sample mean over the same request interval'),number(a.utilization.mean_percent)+'%',number(b.utilization.mean_percent)+'%',
          t('利用率提高','Utilization increased')+` ${number(b.utilization.mean_percent-a.utilization.mean_percent)} `+t('个百分点','percentage points'),
          t('双卡同期采样，按采样时长加权。','Two-card samples over the same interval, duration-weighted.')),
        t('费用口径：天翼云同类双卡910B公开月租，按30天折算，含CPU、主存与加速卡；云盘和公网单列。质量使用同轮200题评分。','Cost scope: public CTYun dual-910B monthly rental, 30-day conversion, including CPU, RAM and accelerators; disk and network billed separately. Quality uses the same 200-task run.'),currentPath+'joint-summary.json');
    const latency=data.c16_equal_request_latency, c16=data.milestone_contract.recomputed.c16_fixed_b0;
    const runs=latency.arms.map(arm=>runEvidence.runs.find(r=>r.run_id===arm.run_id));
    const config=runs[1].configuration;
    const taskNames=['MMLU-Pro','HLE-Verified','SWE-bench-Pro','FrontierScience','TerminalBench 2.1'];
    const taskGaps=[
      t('任务质量轮缺少实际达到16K的连续窗口。','The task-quality run lacks a continuous window reaching 16K.'),
      t('原父进程退出码缺失；资格测试与续跑属于分开的服务区间。','Original parent exit code is missing; qualification and continuation are separate service intervals.'),
      t('既定任务覆盖不足，缺少 B1 同题配对；已有上下文拒绝和步数耗尽。','Incomplete assigned-task coverage and missing matched B1 tasks; context-limit and step-limit terminations are recorded.'),
      t('既有配对属于旧冻结组合；本轮 B1 配置缺少对应任务验证。','The existing pair uses the old frozen combination; task validation for this round’s B1 configuration is missing.'),
      t('既定任务覆盖不足，缺少 B1 同题配对；已有上下文拒绝，部分原任务未评分。','Incomplete assigned-task coverage and missing matched B1 tasks; context-limit rejections and ungraded original attempts are recorded.')
    ];
    const methods=`<details class="comparison-method focus-note"><summary>${t('版本定义、阶段门槛与报告来源','Versions, targets and sources')}</summary>
      <p>${t('B0 固定为 vLLM 0.18 + vLLM-Ascend 0.18。B1 按各项实测配置记录。页面给出本轮测试结论，第三方验收报告另行归档。','B0 is vLLM 0.18 + vLLM-Ascend 0.18. B1 is recorded per measured configuration. This page reports this test round; third-party acceptance reports are archived separately.')}</p>
      <p id="acceptance-stages">${t('中期 η ≥50%，最终 η ≥90%；吞吐提升 ≥10%；平均 TTFT、TPOT 分别改善 ≥5%；单位 token 成本降低 ≥10%。','Midterm η ≥50%, final η ≥90%; throughput +10%; mean TTFT and TPOT each −5%; cost per token −10%.')}</p>
      <p class="focus-source">${escape(data.version)} · <a href="${source(data.m01_method.outline.path)}">${t('测试大纲 V1.5 课题四','V1.5 Project 4 test outline')}</a> · <a href="${escape(data.report_url)}">${t('完整报告与原始记录','Full report and records')}</a></p></details>
      <details class="comparison-method focus-result" id="method-1"><summary>${titles[0]} · ${t('方法与记录','Methods & records')}</summary>
      <p class="focus-status"><strong>${m01Verdict}</strong></p>
      <p>${escape(ref.model)} · ${escape(ref.dtype)} · ${escape(ref.device)} × ${ref.participating_chips} · ${escape(ref.dataset)}</p>
      <p><code>C = F / (k × T × 10¹²)</code>；<code>η = T参 / T × 100%</code>。</p>
      ${table([t('方案','Arm'),t('有效算力 TFLOPS/芯片','Effective TFLOPS/chip'),t('正式 η','Formal η')],['B0','B1'].map(arm=>[arm,number(ref[arm].own_C),t('未出具：计量条件不完整','Not issued: incomplete measurement conditions')]))}
      <p>${t('现有 F/T 记录保留计数开销，缺少匹配的无插桩时间与 B0 路径参考。同一 out256 工况的 B1 正确数下降，质量比较未通过。','The F/T record includes counting overhead and lacks matched uninstrumented timing and a B0 path reference. B1 correct count fell in the same out256 workload; its quality comparison failed.')}</p>
      <details><summary>${t('out256 同预算质量','Same-budget out256 quality')}</summary>${table([t('指标','Metric'),'B0','B1'],[[t('正确 / 题数','Correct / total'),`${q0.correct}/${q0.total}`,`${q1.correct}/${q1.total}`]])}</details>
      <p>${t('B1 独立标定模型','Independently calibrated B1 model')}: ${number(diagnostic.reference_seconds)} s · ${number(diagnostic.reference_tflops_per_chip)} TFLOPS/${t('芯片','chip')} · ${number(diagnostic.efficiency_percent)}%。${t('模型诊断低于50%门槛；三个调度种子用于敏感性分析。','The model diagnostic is below 50%; three scheduling seeds provide sensitivity analysis.')}</p>
      ${evidence('m01-verdict')}${evidence('acceptance-completion')}</details>
      <details class="comparison-method focus-result" id="method-2"><summary>${titles[1]} · ${t('方法与记录','Methods & records')}</summary>
      <h3>${t('完整回答批次','Full-answer batch')}</h3>${sectionTables('full-answer-joint',[0])}
      <p>${qualityBasis} ${t('两臂使用同一突发到达序列，按成功完成的响应计算吞吐及逐请求平均时延；本批次没有交互式服务 SLO 测试。','Both arms use the same burst arrival sequence; throughput and mean latency use completed responses. Interactive-service SLO was not tested in this batch.')}</p>
      <p>${t('B1 主机 State 预算','B1 host State budget')}: ${continuous.b1_host_state_budget_bytes_per_rank/(1024**3)} GiB/rank · ${escape(b.runtime.vllm_version)} / ${escape(b.runtime.ascend_version)}.</p>${evidence('full-answer-joint')}
      <h3>${t('C16 多轮工具调用记录','C16 multi-turn tool-call records')}</h3>
      ${table([t('指标','Metric'),'B0','B1',t('变化','Change')],[[t('输出 token/秒','Output tokens/s'),number(c16.window_tokens[0]/latency.arms[0].measurement_seconds),number(c16.window_tokens[1]/latency.arms[1].measurement_seconds),'+'+number(c16.descriptive_gain_percent)+'%'],...['ttft','tpot'].map(k=>[k.toUpperCase()+t(' 均值 (ms)',' mean (ms)'),number(latency.arms[0].window[k].mean_seconds*1000),number(latency.arms[1].window[k].mean_seconds*1000),'-'+number(latency.descriptive_reduction_percent[k])+'%'])])}
      <p>${t('C16 结论：性能数值达标；该配置的任务质量与 SLO 未验收。','C16 result: performance targets met; task quality and SLO for this configuration are not accepted.')}</p>
      <p>B0: vLLM 0.18 / Ascend 0.18 · ${escape(runs[0].validation.effective_graph_mode)}. B1: ${escape(config.engine_version)} · ${escape(config.mods.join(' + '))} · TP${config.parameters.tensor_parallel_size} · ${escape(config.parameters.graph_mode)} · E${config.parameters.execution_seats}/R${config.parameters.resident_seats}.</p>
      <p>${t('MOD 提交','MOD revision')}: ${escape(config.parameters.measured_mod_revision||config.parameters.mod_revision)}. ${t('负载种子','Load seeds')}: ${runs[0].client.seed} / ${runs[1].client.seed}. ${t('源权重、轨迹和提示长度一致；生成内容会改变后续提示字节。','Source weights, trajectories and prompt lengths match; generated content changes later prompt bytes.')}</p>${evidence('c16-request-latency')}${evidence('baseline018')}</details>
      <details class="comparison-method focus-result" id="method-3"><summary>${titles[2]} · ${t('方法与记录','Methods & records')}</summary>
      <p class="focus-status"><strong>${stabilityVerdict}</strong></p><h3>${t('本轮4K/16K连续窗口','Current 4K/16K continuous windows')}</h3>${sectionTables('full-answer-joint',[1])}
      <p>${t('实际输入4115/16407 token，C8闭环，输出上限256。表中保留吞吐及TTFT/TPOT的P95/P99；两臂所有正式窗口零失败。','Actual inputs: 4115/16407 tokens; C8 closed loop; output cap 256. Throughput and TTFT/TPOT P95/P99 are listed; all formal windows in both arms had zero failures.')}</p>
      ${table([t('任务','Dataset'),t('完整稳定性结论','Full stability result'),t('具体缺项','Missing checks')],taskNames.map((name,i)=>[name,t('未通过','Not accepted'),taskGaps[i]]))}
      <p>${t('SWE 与 Terminal 的已执行任务数、未执行任务及逐次评分见任务清单。旧配置的主机内存分配失败保留在 V1.02 记录中；本轮使用4GiB/rank配置。','Executed and unexecuted SWE/Terminal tasks and individual scores are in the inventory. V1.02 retains the prior host-allocation failure; this round uses 4 GiB/rank.')}</p>${evidence('v15-remaining')}${evidence('full-answer-joint')}
      <details><summary>${t('指定基线的任务质量与既有评分','Task quality and existing scores')}</summary>
      <h3>FrontierScience</h3><p>${t('原冻结组合的两个赛道均未提高正确率。','The original frozen combination improved neither track’s correct rate.')}</p>${sectionTables('frontierscience-designated-pair',[0])}${evidence('frontierscience-designated-pair')}
      <h3>HLE-Verified</h3><p>${t('指定0.18/0.18 B0的完整分母评分；对应B1配对未执行。','Complete-denominator scores for designated 0.18/0.18 B0; matched B1 evaluation was not run.')}</p>${sectionTables('hle-designated-baseline',[0])}${evidence('hle-designated-baseline')}
      ${sectionTables('dataset-quality-inventory',[0,1,2,3,4,5])}${evidence('dataset-quality-inventory')}</details></details>
      <details class="comparison-method focus-result" id="method-4"><summary>${titles[3]} · ${t('方法与记录','Methods & records')}</summary>
      <p class="focus-status">${t('本轮同价租赁估算达到降本10%的门槛，双卡AI Core利用率提高。','This round’s same-rate rental estimate meets the 10% cost-reduction target and raises two-card AI Core utilization.')}</p>
      <p><code>${escape(data.milestone_contract.cost_method.allocated_expense)}</code>；${t('单位成本 = 10⁶ × 区间分摊费用 / 成功完成请求的输出 token 数。','Unit cost = 10⁶ × allocated interval expense / output tokens from completed requests.')}</p>
      <p>${t('费用取值','Price basis')}: ${escape(a.cost.price_basis.provider)} · ${escape(a.cost.price_basis.sku)} · ${a.cost.price_basis.instance_monthly_price} ${t('元/月','CNY/month')} · ${a.cost.price_basis.month_days_for_analysis} ${t('天/月','days/month')}.</p>
      <p>${t('采用同类机器公开报价估算，包含CPU、主存及加速卡，云盘和公网另计。成功完成请求的全部输出计入分母，包含答错和长度终止；固定费用按实际占用双卡与时长分摊。','The analogous-machine public quote includes CPU, RAM and accelerators; disk/network are separate. All completed-response output counts, including incorrect and length-stopped answers. Fixed expense uses both reserved cards and elapsed time.')}</p>
      <p><a href="./serving-plan.html">${t('调整部署费用，计算产能与成本 →','Adjust deployment costs and estimate capacity →')}</a></p>${evidence('full-answer-joint')}${evidence('milestone-v15')}</details>`;
    root.innerHTML=`<section class="comparison-overview" aria-labelledby="current-results-title"><h2 id="current-results-title">${t('本轮测试结论','Results for this test round')}</h2><p class="comparison-context">${escape(data.version)} · ${t('B0 固定0.18/0.18；各项分别列明B1配置、判定条件和适用工况。','B0 fixed at 0.18/0.18; B1 configuration, criteria and workload are identified for each result.')}</p>${overview}</section><section class="comparison-methods" aria-labelledby="methods-title"><h2 id="methods-title">${t('方法、任务清单与原始记录','Methods, task inventory and source records')}</h2>${methods}</section>`;
    root.querySelectorAll('.comparison-detail-link').forEach(link=>link.addEventListener('click',()=>{root.querySelector(link.getAttribute('href')).open=true;}));
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
