(() => {
  'use strict';
  let data, manifest, runEvidence, qualifiedPair, controllerDiscovery;
  const root = document.getElementById('comparison');
  const escape = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t = (cn, en) => window.vllmHustSite.getCurrentLang() === 'zh' ? cn : en;
  const number = v => Number.isFinite(v) ? v.toFixed(4) : '—';
  const table = (headers, rows) => `<div class="focus-table" tabindex="0" role="region" aria-label="${escape(headers.join(' / '))}"><table><thead><tr>${headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>i?`<td>${escape(c)}</td>`:`<th scope="row">${escape(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const source = path => `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${manifest.commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const evidence = id => {
    const s = data.sections.find(s=>s.id===id);
    return `<p class="focus-source">${t('来源记录','Source records')}: ${s.evidence.map(e=>`<a href="${escape(source(e.path).replace('/blob/',`/${e.kind}/`))}">${escape(e.label)}</a>`).join(' · ')}</p>`;
  };
  const sectionTables = (id, indices) => {
    const s = data.sections.find(s=>s.id===id);
    const tables = window.vllmHustSite.getCurrentLang()==='zh' ? s.tables : (s.tables_en || s.tables);
    return indices.map(i=>table(tables[i].headers,tables[i].rows)).join('');
  };

  function controllerDiscoverySection() {
    const d=controllerDiscovery, a=d.arms;
    const decrease=(base,next)=>(100*(1-next/base)).toFixed(2);
    const labels=t(['A 旧B1重算参考（不是B0）','B 跨轮缓存B1，无Controller','C 与B相同，加原版Controller','D C＋延迟感知候选（不采用）'],['A Previous B1 recomputation reference (not B0)','B Cross-turn-cache B1, no Controller','C Same as B, with original Controller','D C + latency-aware candidate (rejected)']);
    return `<h3>${t('Controller：多轮回放的阶段性结果','Controller: preliminary multi-turn replay results')}</h3>
      <p class="focus-status">${t('单次发现，尚未重复验证；不是上方200题完整回答成绩，也没有匹配B0。','Single-run discovery, not yet replicated; separate from the 200 full-answer tasks above, with no matched B0.')}</p>
      <p>${escape(t(`${d.programs_per_arm}个program，每个${d.rounds_per_program}轮；每组${a.B.successful_business_requests}个成功请求、${a.B.actual_generated_tokens}个实际输出token。真实输出继承历史及记录的工具等待；初始提示按长度构造，非完整代码Agent任务。`,`${d.programs_per_arm} programs, ${d.rounds_per_program} turns each; ${a.B.successful_business_requests} successful requests and ${a.B.actual_generated_tokens} generated tokens per arm. Actual outputs feed later turns with recorded tool waits; length-constructed initial prompts, not complete coding-agent tasks.`))}</p>
      ${table(t(['配置','整批耗时（秒）','请求P95（秒）','缓存输入占比（%）'],['Configuration','Batch time (s)','Request P95 (s)','Cached input (%)']),['A','B','C','D'].map((k,i)=>[labels[i],number(a[k].makespan_seconds),number(a[k].request_p95_seconds),number(a[k].cached_input_fraction_percent)]))}
      <p>${escape(t(`旧B1→缓存B1：耗时减少${decrease(a.A.makespan_seconds,a.B.makespan_seconds)}%（包含缓存及驻留配置变化）；缓存B1→加入Controller：再减少${decrease(a.B.makespan_seconds,a.C.makespan_seconds)}%；旧B1→缓存＋Controller：合计减少${decrease(a.A.makespan_seconds,a.C.makespan_seconds)}%。各百分比的分母不同，不能相加。`,`Previous B1 → cached B1: ${decrease(a.A.makespan_seconds,a.B.makespan_seconds)}% less time (cache and residency configuration changes); cached B1 → Controller: ${decrease(a.B.makespan_seconds,a.C.makespan_seconds)}% less time; previous B1 → cache + Controller: ${decrease(a.A.makespan_seconds,a.C.makespan_seconds)}% less time overall. Different denominators: do not add these percentages.`))}</p>
      <p>${t('同一模型BF16/TP2、双卡910B2；B/C共享引擎配置。原版指保留原调度算法，另有共同HTTP token-ID、容量及无业务超时适配，不是完全未修改的上游程序。','Same BF16/TP2 model and two 910B2 devices; B/C share engine settings. Original refers to the scheduling algorithm, with disclosed common token-ID HTTP, capacity and no-business-timeout adaptations, not an unmodified upstream binary.')}</p>
      <p class="comparison-caveat">${t('必须澄清：顺序B→C→D→A，每组仅一次，无独立留出；D比C更慢，候选不采用。缓存/冷路径逐token诊断仍失败（64个仅15个相同），原因未解决，性能数据不证明数值等价或任务质量。非流式回放未测首字延迟及每token延迟；业务无错误不代表SDK收尾无告警。','Clarifications: order B→C→D→A, one run per arm, no independent holdout. D is slower than C and is rejected. Cached/cold token comparison remains unresolved (15 of 64 match); timing does not establish numerical equivalence or task quality. Non-streaming replay did not measure TTFT or TPOT. Error-free business requests do not imply warning-free SDK shutdown.')}</p>
      <p class="focus-source"><a href="${escape(source(d.report_path))}">${t('配置、负结果与证据边界','Configuration, negative result and evidence limits')}</a> · <a href="${escape(source('website-publication/data/controller-b1-discovery-20261104.json'))}">${t('机器可读数据与来源SHA','Machine-readable results and source hashes')}</a></p>`;
  }

  function validateQualifiedPair(pair) {
    const fail = () => { throw Error('Qualified pair evidence or arithmetic mismatch'); };
    const close = (a, b) => Math.abs(Number(a) - Number(b)) <= 1e-10 * Math.max(1, Math.abs(Number(b)));
    if (pair.schema !== 'm01-qualified-pair/v1' || pair.chips !== 2 || pair.milestone_percent !== 50 ||
        pair.final_target_percent !== 90 || pair.evidence_qualified !== true ||
        pair.reference_kind !== 'certified_lower_bound_of_fixed_full_reference' || pair.arms?.length !== 2) fail();
    const interval = a => Array.isArray(a) && a.length === 2 && a.every(v => Number.isSafeInteger(v) && v > 0) && a[0] <= a[1];
    pair.arms.forEach((arm, i) => {
      if (arm.role !== ['B0', 'B1'][i] || arm.repetitions?.length !== 3 ||
          !arm.reference_certificate_path || !arm.work_components?.length ||
          arm.F_correspondence_qualified !== true || arm.reference_lower_qualified !== true) fail();
      const names = new Set();
      arm.repetitions.forEach(r => {
        names.add(r.name);
        if (!interval(r.F_interval) || ![r.T_seconds, r.Tref_lower_seconds].every(v => Number.isFinite(Number(v)) && Number(v) > 0) ||
            r.requests !== 200 || r.input_tokens !== 282265 || r.output_tokens !== 51200 ||
            r.uninstrumented !== true || r.synchronized_ranks !== 2 ||
            !/^[a-f0-9]{64}$/.test(r.source_sha256)) fail();
      });
      if (names.size !== 3 || !['uninstrumented-1','uninstrumented-2','uninstrumented-3'].every(n => names.has(n))) fail();
      const sumT = arm.repetitions.reduce((s, r) => s + Number(r.T_seconds), 0);
      const sumRef = arm.repetitions.reduce((s, r) => s + Number(r.Tref_lower_seconds), 0);
      const sums = [0, 1].map(j => arm.repetitions.reduce((s, r) => s + r.F_interval[j], 0));
      if (arm.work_components.some(c => !interval(c.F_interval))) fail();
      [0, 1].forEach(j => {
        if (arm.work_components.reduce((s, c) => s + c.F_interval[j], 0) !== sums[j] ||
            !close(arm.aggregate.C_interval[j], sums[j] / (pair.chips * sumT * 1e12))) fail();
      });
      if (!close(arm.aggregate.sum_T_seconds, sumT) || !close(arm.aggregate.sum_Tref_lower_seconds, sumRef) ||
          !close(arm.aggregate.eta_percent_lower, 100 * sumRef / sumT)) fail();
    });
    const passed = Number(pair.arms[1].aggregate.eta_percent_lower) >= pair.milestone_percent;
    if (pair.current_milestone_met !== passed) fail();
  }

  function qualifiedComputeView(paired) {
    const bound = (v, upper = false, digits = 4) => ((upper ? Math.ceil : Math.floor)(Number(v) * 10 ** digits) / 10 ** digits).toFixed(digits);
    const interval = (v, digits = 4) => v.map((x, i) => bound(x, i === 1, digits)).join('–');
    const whole = v => Number(v).toLocaleString('en-US');
    const rawRange = v => '[' + v.map(whole).join(', ') + ']';
    const values = paired.arms.map(arm => {
      const repetitions = arm.repetitions;
      const sumT = repetitions.reduce((s, r) => s + Number(r.T_seconds), 0);
      const sumF = [0, 1].map(i => repetitions.reduce((s, r) => s + r.F_interval[i], 0));
      const sumRef = repetitions.reduce((s, r) => s + Number(r.Tref_lower_seconds), 0);
      return {arm, sumT, sumF, sumRef, C: sumF.map(f => f / (paired.chips * sumT * 1e12)), etaLower: 100 * sumRef / sumT};
    });
    const [b0, b1] = values;
    const gain = [100 * (b1.C[0] / b0.C[1] - 1), 100 * (b1.C[1] / b0.C[0] - 1)];
    const met = paired.evidence_qualified === true && b1.etaLower >= paired.milestone_percent;
    const verdict = met ? t('已达标 · 本次里程碑', 'Current milestone met') : t('本次里程碑未达标', 'Current milestone not met');
    const line = (label, a, b, result, basis) => '<div class="comparison-row"><h3>' + escape(label) + '</h3><dl>' +
      [['B0', a], ['B1', b], [t('结果', 'Result'), result], [t('计算依据', 'Basis'), basis]].map(([k, v]) => '<div><dt>' + escape(k) + '</dt><dd>' + escape(v) + '</dd></div>').join('') + '</dl></div>';
    const report = source(paired.report_path);
    const overview = '<section class="comparison-group" id="metric-1"><h2>' + t('3.4.1 单芯片有效算力', '3.4.1 Effective compute per chip') + '</h2><p class="comparison-verdict"><strong>' + verdict + '</strong></p>' +
      line(t('有效算力（TFLOPS/芯片）', 'Effective compute (TFLOPS/chip)'), interval(b0.C), interval(b1.C),
        t('提升 ', 'Gain ') + interval(gain) + '%', 'C = ΣF / (k × ΣT × 10¹²)') +
      line(t('同工况参考效率', 'Workload reference efficiency'), '≥' + bound(b0.etaLower) + '%', '≥' + bound(b1.etaLower) + '%',
        t('本次要求 ≥50%', 'Current target ≥50%'), 'η ≥ 100 × ΣT参,下界 / ΣT') +
      '<p class="comparison-caveat">' + t('固定200请求、每题上限256 token；两组各3轮，无插桩同步计时，全部计入。', 'Fixed 200 requests, cap 256 tokens; three uninstrumented, synchronized repetitions per arm, all included.') +
      '</p><a class="comparison-detail-link" href="#method-1">' + t('展开计算与记录', 'Expand calculations & records') + ' →</a><p class="focus-source"><a href="' + report + '">' + t('来源与复算', 'Source and calculation') + '</a></p></section>';
    let calculation = '<section id="current-qualified-compute"><h3>' + t('本次计算：有效F、同步T与独立参考T参', 'Current calculation: effective F, synchronized T and independent T_ref') + '</h3><p>' +
      t('Qwen3.5-35B-A3B · BF16 · TP2 · 双卡910B2 · MMLU-Pro固定200请求。每轮输入282265 token、输出51200 token。', 'Qwen3.5-35B-A3B · BF16 · TP2 · two 910B2 chips · MMLU-Pro fixed 200 requests. Each repetition has 282265 input and 51200 output tokens.') +
      '</p><p>' + t('计时从请求提交前的双卡同步开始，到完成请求后的双卡同步结束；包含区间内搬运、通信与同步。HTTP和分词在两侧均不计入。路径核查另行采集，三轮正式计时均无逐步观察器。', 'Timing spans synchronization on both chips before request submission through synchronization after completion, including transfers, communication and synchronization in the interval. HTTP and tokenization are outside both arms. Path auditing is separate; all three timed repetitions omit stepwise observers.') + '</p>';
    calculation += '<h3>1. ' + t('合计必要算量', 'Sum necessary work') + '</h3><p>' +
      t('从保留输出追溯必要依赖，按矩阵、注意力、GDN与基础标量运算计数。未确定的末次截断和共享状态分支分别计算保证成立的下界与上界。', 'Trace dependencies of retained outputs and count matrix, attention, GDN and basic scalar operations. Unresolved terminal clipping and shared-state branches receive certified lower and upper work bounds.') + '</p>';
    for (const {arm} of values) {
      calculation += '<h4>' + arm.role + '</h4>' + table([t('运算项', 'Operation term'), t('三轮基本运算数合计', 'Basic operations across all three repetitions')],
        arm.work_components.map(x => [t(x.label_zh, x.label_en), rawRange(x.F_interval)]));
      calculation += '<p>ΣF' + (arm.role === 'B0' ? '₀' : '₁') + ' = ' + arm.work_components.map(x => rawRange(x.F_interval)).join(' + ') + '</p>';
    }
    calculation += '<h3>2. ' + t('列出每一轮F、T和参考时间', 'List F, T and reference time for every repetition') + '</h3>' +
      table([t('运行', 'Run'), 'F (FLOPs)', 'T (s)', t('T参下界 (s)', 'T_ref lower bound (s)')],
        values.flatMap(({arm}) => arm.repetitions.map(r => [arm.role + ' / ' + r.name, rawRange(r.F_interval), r.T_seconds, '≥' + r.Tref_lower_seconds])));
    calculation += '<h3>3. ' + t('由独立标定构造参考时间', 'Construct reference time from independent calibration') + '</h3><p>' +
      t('沿预先固定的组件与资源依赖图，将独立标定得到的组件耗时d(v)代入；同一资源的顺序约束和双卡通信依赖均作为边。', 'Use the component and resource dependency graph fixed in advance, with independently calibrated component duration d(v). Edges include resource order and communication dependencies on both chips.') +
      '</p><p>finish(v) = d(v) + max{finish(u) : u → v}; T参 = max finish(v).</p><p>' +
      t('对所有与运行记录相容的分支，保留算量、形状和依赖均确定的节点，计算完整参考时间的下界。该下界用于保守验收；完整参考方法与组件标定值保持不变。', 'Across every branch compatible with the records, retain nodes with invariant work, shapes and dependencies to certify a lower bound on the full reference time. Acceptance uses this conservative bound; the full reference method and component calibration values remain unchanged.') + '</p>';
    calculation += '<h3>4. ' + t('分别代入计算', 'Calculate each arm') + '</h3>';
    for (const v of values) {
      calculation += '<h4>' + v.arm.role + '</h4><p>ΣT = ' + v.arm.repetitions.map(r => r.T_seconds).join(' + ') + ' = ' + v.sumT.toFixed(9) + ' s</p>' +
        '<p>C = ' + rawRange(v.sumF) + ' / (' + paired.chips + ' × ' + v.sumT.toFixed(9) + ' × 10¹²) = <strong>' + interval(v.C) + ' TFLOPS/' + t('芯片', 'chip') + '</strong></p>' +
        '<p>η ≥ 100 × (' + v.arm.repetitions.map(r => r.Tref_lower_seconds).join(' + ') + ') / ' + v.sumT.toFixed(9) + ' = <strong>' + bound(v.etaLower) + '%</strong></p>' +
        '<p><a href="' + source(v.arm.reference_certificate_path) + '">' + t('查看参考时间证明与组件记录', 'Reference-time certificate and component records') + '</a></p>';
    }
    calculation += '<h3>5. ' + t('按本次50%要求判定', 'Apply the current 50% criterion') + '</h3><p><strong>' + verdict + '：B1 η ≥ ' + bound(b1.etaLower) + (met ? '% ≥ ' : '%；本次要求 ') + paired.milestone_percent + '%。</strong></p><p>' +
      t('90%为后续目标。η表示同工况独立参考效率；B1相对B0的有效算力提升另按C₁/C₀−1计算。', '90% is a later target. η measures efficiency against the independent workload reference; B1 compute improvement over B0 is calculated separately as C₁/C₀−1.') +
      '</p><p>' + t('本批输出均达到256-token长度上限，反映固定输出预算的服务工况。完整回答质量与吞吐结果见3.4.2。当前B1组合与源码版本见来源记录；Request Throttling接入由独立任务跟进，其收益未计入本批。', 'All outputs reach the 256-token cap, defining a fixed-budget serving workload. Full-answer quality and throughput appear in section 3.4.2. The source record identifies the B1 combination and revisions; Request Throttling integration is tracked separately and contributes no claimed gain here.') +
      '</p><p><code>python scripts/recompute_m01_qualified_pair.py --check</code></p><p><a href="' + report + '">' + t('完整公式、证据索引与复算说明', 'Full formulas, evidence index and recomputation instructions') + '</a></p></section>';
    return {overview, calculation};
  }

  function render() {
    document.getElementById('comparison-title').textContent=t('B0/B1 大纲对比','B0/B1 results by test outline');
    document.getElementById('comparison-lead').textContent=t('按大纲展示有效算力、吞吐与时延、稳定性和成本；固定 B0 为比较基线。','Effective compute, throughput and latency, stability and cost by the test outline, compared with fixed B0.');
    if (!data) return;
    const joint=data.full_answer_joint, [a,b]=joint.arms;
    const continuous=data.packed_continuous;
    const phases=arm=>continuous[arm].phases.filter(p=>p.name.endsWith('-formal'));
    const phaseText=arm=>phases(arm).map(p=>p.requests).join(' / ')+t(' 请求，',' requests, ')+phases(arm).reduce((sum,p)=>sum+p.failures,0)+t(' 失败',' failures');
    const numeric=(value,target)=>`${number(value)}% · `+(value>=target?t('达标','Met'):t('未达标','Not met'));
    const qualityPass=joint.quality_observation.fixed_subset_correct_count_not_lower;
    const qualityVerdict=qualityPass?t('正确数达标','Correct-count target met'):t('正确数下降','Correct count decreased');
    const servingPass=qualityPass&&joint.output_throughput_change_percent>=10&&Object.values(joint.latency_reduction_percent).every(v=>v>=5);
    const costPass=qualityPass&&joint.rental_cost_reduction_percent>=10&&b.utilization.mean_percent>a.utilization.mean_percent;
    const zeroFailures=['b0','b1'].every(arm=>phases(arm).length===2&&phases(arm).every(p=>p.requests>0&&p.failures===0));
    const titles=[t('3.4.1 单芯片有效算力','3.4.1 Effective compute per chip'),t('3.4.2 吞吐与时延','3.4.2 Throughput & latency'),t('3.4.3 数据集与长上下文稳定性','3.4.3 Dataset & long-context stability'),t('3.4.4 单位 token 成本','3.4.4 Cost per token')];
    const row=(name,b0,b1,status,basis)=>`<div class="comparison-row"><h3>${escape(name)}</h3><dl>${[['B0',b0],['B1',b1],[t('结果','Result'),status],[t('计算依据','Basis'),basis]].map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></div>`;
    const group=(i,verdict,rows,note,path)=>`<section class="comparison-group" id="metric-${i+1}"><h2>${titles[i]}</h2><p class="comparison-verdict"><strong>${escape(verdict)}</strong></p>${rows}<p class="comparison-caveat">${escape(note)}</p><a class="comparison-detail-link" href="#method-${i+1}">${t('展开方法与记录','Expand methods & records')} →</a><p class="focus-source"><a href="${source(path)}">${t('来源与复算','Source and calculation')}</a></p></section>`;
    const qualityBasis=t('MMLU-Pro 固定200题；原评分器；回答上限8192 token。','MMLU-Pro fixed 200; original scorer; output cap 8192 tokens.');
    const stabilityVerdict=t('五任务稳定性验收未通过','Five-task stability acceptance failed');
    const continuousVerdict=zeroFailures?t('两组均零失败','Zero failures in both arms'):t('窗口失败或缺失','Failed or missing windows');
    const currentPath='reports/full-answer-joint-20261030/';
    const currentCompute = qualifiedComputeView(qualifiedPair);
    const overview=currentCompute.overview+
      group(1,servingPass?t('吞吐与时延达标','Throughput and latency targets met'):t('吞吐与时延未达标','Throughput or latency targets not met'),
        row(t('同轮质量 / 长度终止','Same-run quality / length stops'),`${a.correct}/${a.completed} · ${a.truncated}`,`${b.correct}/${b.completed} · ${b.truncated}`,qualityVerdict,qualityBasis)+
        row(t('输出吞吐（token/s）','Output throughput (tokens/s)'),number(a.output_tokens_per_second),number(b.output_tokens_per_second),numeric(joint.output_throughput_change_percent,10),t('提升门槛 ≥10%。','Target: improvement ≥10%.'))+
        ['ttft_ms','tpot_ms'].map(key=>row(key==='ttft_ms'?t('平均 TTFT（ms）','Mean TTFT (ms)'):t('平均 TPOT（ms/token）','Mean TPOT (ms/token)'),number(a.timing[key].mean),number(b.timing[key].mean),numeric(joint.latency_reduction_percent[key],5),t('改善门槛 ≥5%；逐请求等权均值。','Target: reduction ≥5%; request-weighted mean.'))).join(''),
        t('200题同时到达、完整回答、双卡910B2。C16 多轮工具调用结果见详情。','200 simultaneous full-answer requests on two 910B2 cards. C16 multi-turn results are in the details.'),currentPath+'joint-summary.json')+
      group(2,stabilityVerdict,
        row(t('4K / 16K 连续窗口','4K / 16K continuous windows'),phaseText('b0'),phaseText('b1'),continuousVerdict,
          t('每阶段60秒预热、300秒正式发起，随后完整排空。','Each phase: 60 s warmup, 300 s arrivals, then full drain.'))+
        row(t('16K / 32K 检索（既有配置）','16K / 32K retrieval (prior configuration)'),'6 / 6','6 / 6',t('检索通过','Retrieval passed'),
          t('既有配置的检索结果；4GiB/rank配置待测。','Prior-configuration retrieval; 4 GiB/rank configuration awaiting this test.')),
        t('五任务待补：同题配对、服务异常记录及连续稳定性检查，详见任务清单。','Five-task checklist: matched tasks, service-anomaly records and continuous stability checks.'),currentPath+'continuous-summary.json')+
      group(3,costPass?t('租赁成本估算与利用率达标','Rental-cost estimate and utilization targets met'):t('租赁成本估算未达标','Rental-cost estimate target not met'),
        row(t('每百万输出 token 租赁估算（元）','Rental estimate per million output tokens (CNY)'),number(a.cost.cny_per_million_output_tokens),number(b.cost.cny_per_million_output_tokens),numeric(joint.rental_cost_reduction_percent,10),t('同一报价、费用范围和测量区间；降幅门槛 ≥10%。','Same price, scope and measurement interval; target reduction ≥10%.'))+
        row(t('AI Core 时间平均利用率（设备监控）','Time-averaged AI Core utilization (device monitoring)'),number(a.utilization.mean_percent)+'%',number(b.utilization.mean_percent)+'%',
          t('利用率提高','Utilization increased')+` ${number(b.utilization.mean_percent-a.utilization.mean_percent)} `+t('个百分点','percentage points'),
          t('同批请求区间内按时长加权，再对双卡取平均；用于3.4.4利用率对照，不是3.4.1的 C₁ 或 η。','Duration-weighted samples over each paired request interval, averaged across both chips; the utilization comparison for 3.4.4, not C₁ or η in 3.4.1.')),
        t('按天翼云同类双卡910B公开月租估算，费用组成见详情。','Estimated from public CTYun dual-910B monthly rental. Cost components are in the details.'),currentPath+'joint-summary.json');
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
    const throughputB0=a.successful_output_tokens/a.phase_seconds, throughputB1=b.successful_output_tokens/b.phase_seconds;
    const speed=throughputB1/throughputB0, etaB0=100*speed;
    const methodSource='https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/8b8e5f2f448371913615cbe25d5127b04642fd88/docs/B0_BASELINE_METRICS.md';
    const baseline=`<section class="focus-result" id="b0-baseline" aria-labelledby="b0-baseline-title">
      <h2 id="b0-baseline-title">${t('补充比较：B0 相对吞吐 η_B0','Supplement: B0-relative throughput η_B0')}</h2>
      <p>${t('以 vLLM 0.18 + vLLM-Ascend 0.18 的实测吞吐为100%，比较 B1 的吞吐、时延与成本。','Measured vLLM 0.18 + vLLM-Ascend 0.18 throughput is the 100% baseline for comparing B1 throughput, latency and cost.')}</p>
      ${table([t('指标','Metric'),'B0','B1'],[
        [t('相对吞吐效率 η_B0','Relative throughput efficiency η_B0'),'100.0000%',number(etaB0)+'%'],
        [t('吞吐倍率','Throughput ratio'),'1.0000×',number(speed)+'×'],
        [t('吞吐提升率','Throughput gain'),'0.0000%',number(etaB0-100)+'%']
      ])}
      <p><code>η_B0 = 100 × (O₁ / T₁) / (O₀ / T₀)</code> · <code>${t('提升率','Gain')} = η_B0 − 100</code></p>
      <p>${t('200题完整回答，正确数','200 full-answer tasks, correct counts')}: B0 ${a.correct}/${a.completed} · B1 ${b.correct}/${b.completed}。${t('两组使用相同任务与硬件。','Both arms use the same tasks and hardware.')}</p>
      <details class="focus-note" id="method-b0"><summary>${t('公式与测量条件','Formulas and measurement settings')}</summary>
      ${table([t('测量量','Measured quantity'),'B0','B1'],[
        [t('成功完成请求的输出 token 数 O','Output tokens from completed requests O'),String(a.successful_output_tokens),String(b.successful_output_tokens)],
        [t('批次完成时间 T（秒）','Batch elapsed time T (s)'),number(a.phase_seconds),number(b.phase_seconds)],
        [t('输出吞吐 Q=O/T（token/s）','Output throughput Q=O/T (tokens/s)'),number(throughputB0),number(throughputB1)]
      ])}
      ${table([t('量','Quantity'),t('公式','Formula'),t('本批次','This batch')],[
        [t('吞吐倍率 S_Q','Throughput ratio S_Q'),'Q₁/Q₀ = O₁T₀/(O₀T₁)',number(speed)+'×'],
        [t('相对吞吐效率 η_B0','Relative throughput efficiency η_B0'),'100 × S_Q',number(etaB0)+'%'],
        [t('吞吐提升率 G_Q','Throughput gain G_Q'),'100 × (S_Q − 1)',number(etaB0-100)+'%'],
        [t('批次时间倍率 S_T','Batch-time ratio S_T'),'T₀/T₁',number(a.phase_seconds/b.phase_seconds)+'×'],
        [t('批次时间降幅 R_T','Batch-time reduction R_T'),'100 × (1 − T₁/T₀)',number(100*(1-b.phase_seconds/a.phase_seconds))+'%'],
        [t('平均 TTFT 降幅','Mean TTFT reduction'),'100 × (1 − L₁/L₀)',number(joint.latency_reduction_percent.ttft_ms)+'%'],
        [t('平均 TPOT 降幅','Mean TPOT reduction'),'100 × (1 − L₁/L₀)',number(joint.latency_reduction_percent.tpot_ms)+'%'],
        [t('单位 token 成本降幅','Cost-per-token reduction'),'100 × [1 − (E₁/O₁)/(E₀/O₀)]',number(joint.rental_cost_reduction_percent)+'%']
      ])}
      ${table([t('计算条件','Calculation settings'),t('定义','Definition')],[
        [t('符号','Symbols'),t('O：已完成响应的输出token；T：完整测量窗口；L：逐请求等权平均时延；E：同窗口全部占用资源的分摊费用。','O: completed-response output tokens; T: full measurement interval; L: request-weighted mean latency; E: allocated cost of all reserved resources in that interval.')],
        [t('输出与质量','Output and quality'),t('O 包含答错与长度终止的已完成输出；正确数和长度终止数单列。','O includes completed incorrect and length-stopped answers; correct and length-stop counts are listed separately.')],
        [t('时间与吞吐','Time and throughput'),t('同工作量且 O₀=O₁ 时 S_Q=S_T。本组自然回答长度不同，两个倍率分别计算。','For equal work and O₀=O₁, S_Q=S_T. Natural-answer lengths differ here, so the ratios are calculated separately.')],
        [t('等租价成本','Equal-rate cost'),t('完整部署小时费用相同、计费与测量窗口一致时，降幅=100×(1−1/S_Q)。','With equal complete-deployment hourly rates and matching billing/measurement intervals, reduction=100×(1−1/S_Q).')],
        [t('百分比与重复测量','Percentages and repetitions'),t('η_B0=190%：1.9倍，提升90%。重复测量逐对计算倍率后取中位数，保留全部重复。','η_B0=190%: 1.9×, a 90% gain. For repetitions, take the median of within-pair ratios and retain all runs.')],
        [t('同工况参考效率 η_ref','Workload-reference efficiency η_ref'),t('η_ref=100×T_ref/T；本次中期目标50%，后续目标90%。T_ref 来自独立组件标定，按各受测工况的必要依赖、资源顺序和可重叠部分推导。适用条件一致时可共用参考值。','η_ref=100×T_ref/T; current milestone: 50%; later target: 90%. T_ref is derived from independent component calibration using each tested workload’s required dependencies, resource order and overlap. Matching conditions can share the reference.')]
      ])}
      <p class="focus-source"><a href="${methodSource}">${t('完整公式与只读复算命令','Full method and read-only recomputation command')}</a> · <a href="${source(currentPath+'joint-summary.json')}">${t('本批原始记录','Original paired record')}</a></p>
      </details></section>`;
    const methods=`<details class="comparison-method focus-note"><summary>${t('版本定义、阶段门槛与报告来源','Versions, targets and sources')}</summary>
      <p>${t('B0：vLLM 0.18 + vLLM-Ascend 0.18。B1 版本及配置随各项记录列出。','B0: vLLM 0.18 + vLLM-Ascend 0.18. Each result lists its B1 version and configuration.')}</p>
      <p id="acceptance-stages">${t('同工况参考效率：本次中期 η_ref ≥50%（T≤2T_ref）；后续目标 ≥90%（T≤T_ref/0.9）。吞吐提升 ≥10%；平均 TTFT、TPOT 分别改善 ≥5%；单位 token 成本降低 ≥10%。','Workload-reference efficiency: current milestone η_ref ≥50% (T≤2T_ref); later target ≥90% (T≤T_ref/0.9). Throughput +10%; mean TTFT and TPOT each −5%; cost per token −10%.')}</p>
      <p class="focus-source">${escape(data.version)} · <a href="${source(data.m01_method.outline.path)}">${t('测试大纲 V1.5 课题四','V1.5 Project 4 test outline')}</a> · <a href="${escape(data.report_url)}">${t('完整报告与原始记录','Full report and records')}</a></p></details>
      <details class="comparison-method focus-result" id="method-1"><summary>${titles[0]} · ${t('计算过程与记录','Calculation & records')}</summary>
      ${currentCompute.calculation}</details>
      <details class="comparison-method focus-result" id="method-2"><summary>${titles[1]} · ${t('方法与记录','Methods & records')}</summary>
      ${controllerDiscoverySection()}
      <h3>${t('完整回答批次','Full-answer batch')}</h3>${sectionTables('full-answer-joint',[0])}
      <p>${qualityBasis} ${t('负载：同一突发到达序列。统计：已完成响应的吞吐与逐请求平均时延。交互式服务 SLO：未测。','Load: the same burst arrival sequence. Statistics: throughput and per-request mean latency of completed responses. Interactive-service SLO: untested.')}</p>
      <p>${t('B1 主机 State 预算','B1 host State budget')}: ${continuous.b1_host_state_budget_bytes_per_rank/(1024**3)} GiB/rank · ${escape(b.runtime.vllm_version)} / ${escape(b.runtime.ascend_version)}.</p>${evidence('full-answer-joint')}
      <h3>${t('C16 多轮工具调用记录','C16 multi-turn tool-call records')}</h3>
      ${table([t('指标','Metric'),'B0','B1',t('变化','Change')],[[t('输出 token/秒','Output tokens/s'),number(c16.window_tokens[0]/latency.arms[0].measurement_seconds),number(c16.window_tokens[1]/latency.arms[1].measurement_seconds),'+'+number(c16.descriptive_gain_percent)+'%'],...['ttft','tpot'].map(k=>[k.toUpperCase()+t(' 均值 (ms)',' mean (ms)'),number(latency.arms[0].window[k].mean_seconds*1000),number(latency.arms[1].window[k].mean_seconds*1000),'-'+number(latency.descriptive_reduction_percent[k])+'%'])])}
      <p>${t('C16：吞吐与时延达标；任务质量、SLO 待验收。','C16: throughput and latency targets met; task quality and SLO await acceptance.')}</p>
      <p>B0: vLLM 0.18 / Ascend 0.18 · ${escape(runs[0].validation.effective_graph_mode)}. B1: ${escape(config.engine_version)} · ${escape(config.mods.join(' + '))} · TP${config.parameters.tensor_parallel_size} · ${escape(config.parameters.graph_mode)} · E${config.parameters.execution_seats}/R${config.parameters.resident_seats}.</p>
      <p>${t('MOD 提交','MOD revision')}: ${escape(config.parameters.measured_mod_revision||config.parameters.mod_revision)}. ${t('负载种子','Load seeds')}: ${runs[0].client.seed} / ${runs[1].client.seed}. ${t('相同源权重、轨迹与提示长度；后续提示包含各自生成内容。','Shared source weights, trajectories and prompt lengths; later prompts include each arm’s generated content.')}</p>${evidence('c16-request-latency')}${evidence('baseline018')}</details>
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
      <p class="focus-status">${t('单位 token 租赁成本按以下费用与完成输出量计算。','Rental cost per token uses the expense and completed output below.')}</p>
      <p><code>${escape(data.milestone_contract.cost_method.allocated_expense)}</code>；${t('单位成本 = 10⁶ × 区间分摊费用 / 成功完成请求的输出 token 数。','Unit cost = 10⁶ × allocated interval expense / output tokens from completed requests.')}</p>
      <p>${t('费用取值','Price basis')}: ${escape(a.cost.price_basis.provider)} · ${escape(a.cost.price_basis.sku)} · ${a.cost.price_basis.instance_monthly_price} ${t('元/月','CNY/month')} · ${a.cost.price_basis.month_days_for_analysis} ${t('天/月','days/month')}.</p>
      <p>${t('采用同类机器公开报价估算，包含CPU、主存及加速卡，云盘和公网另计。成功完成请求的全部输出计入分母，包含答错和长度终止；固定费用按实际占用双卡与时长分摊。','The analogous-machine public quote includes CPU, RAM and accelerators; disk/network are separate. All completed-response output counts, including incorrect and length-stopped answers. Fixed expense uses both reserved cards and elapsed time.')}</p>
      <h3>${t('设备监控利用率如何计算','How device utilization is calculated')}</h3>
      <p>U_card = Σ(U_sample × Δt_overlap) / T; U = (Σ U_card) / k.</p>
      <p>${t('Δt_overlap 是采样覆盖区间与本批测量窗口的交集时长。先对每卡按时间加权，再对参与芯片求平均。','Δt_overlap is the overlap between the sample interval and this batch’s measurement window. Weight by time per card, then average over participating chips.')}</p>
      ${table([t('每卡采样均值','Per-card mean'),'B0','B1'],Object.keys(b.utilization.per_card_percent).map(card=>[card,number(a.utilization.per_card_percent[card])+'%',number(b.utilization.per_card_percent[card])+'%']))}
      <p>${t('该百分比描述AI Core的忙碌程度，不包含有效FLOPs计数。重复运算和未采纳草稿也会占用设备，因此不能把 U 当成 C₁ 或 η，也不能用 U 乘硬件峰值代替有效算力。','This percentage describes AI Core activity, without counting effective FLOPs. Redundant computation and rejected drafts can also occupy the device. U is neither C₁ nor η; multiplying U by hardware peak throughput does not yield effective compute.')}</p>
      <p><a href="./serving-plan.html">${t('调整部署费用，计算产能与成本 →','Adjust deployment costs and estimate capacity →')}</a></p>${evidence('full-answer-joint')}${evidence('milestone-v15')}</details>`;
    root.innerHTML=`<section class="comparison-overview" aria-labelledby="current-results-title"><h2 id="current-results-title">${t('各项结果','Results by metric')}</h2><p class="comparison-context">${escape(data.version)} · ${t('B0 0.18/0.18 → B1；版本、公式与任务记录见下方详情。','B0 0.18/0.18 → B1. Versions, formulas and task records are below.')}</p>${overview}</section>${baseline}<section class="comparison-methods" aria-labelledby="methods-title"><h2 id="methods-title">${t('方法、任务清单与原始记录','Methods, task inventory and source records')}</h2>${methods}</section>`;
    root.querySelectorAll('.comparison-detail-link').forEach(link=>link.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      const hash=link.getAttribute('href'), target=root.querySelector(hash);
      target.open=true;
      if(location.hash!==hash)history.pushState(null,'',hash);
      target.scrollIntoView({block:'start'});
    }));
    openLinkedMethod();
    root.dataset.loaded=data.version;
  }
  function openLinkedMethod() {
    if (/^#method-(?:b0|[1-4])$/.test(location.hash)) {
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
    const [d,runs,counts,reference,paired,discovery]=await Promise.all(['data/midterm-v103.json','data/leaderboard_frontier_swe_evidence.json','data/full-answer-compute-20261101.json','data/b0-reference-compute-20261101.json','data/m01-qualified-pair-20261103.json','data/controller-b1-discovery-20261104.json'].map(fetchVerified));
    if(d.schema!=='midterm-publication/v1'||d.version!=='V1.03')throw Error('Invalid report');
    const joint=d.full_answer_joint;
    if(joint?.same_run_quality_and_performance!==true||joint.protocol?.max_completion_tokens!==8192||joint.arms?.length!==2||joint.arms[0].role!=='B0'||joint.arms[1].role!=='B1'||joint.arms.some(a=>a.completed!==200||a.failed!==0)||!d.packed_continuous)throw Error('Invalid full-answer pair');
    for (const arm of joint.arms) {
      const {successful_output_tokens:o,phase_seconds:seconds,output_tokens_per_second:q}=arm;
      if (![o,seconds,q].every(v=>Number.isFinite(v)&&v>0)||Math.abs(o/seconds-q)>1e-9*Math.max(1,q)) throw Error('Invalid B0-relative measurement');
    }
    if(d.acceptance_completion?.continuous?.status!=='B0_completed_B1_measured_host_allocation_failure'||d.acceptance_completion.continuous.paired_continuous_stability_pass!==false)throw Error('Invalid completion evidence');
    const ref=d.wholechain_reference;
    if(ref?.status!=='reference_under_revision'||ref.reference_qualified!==false||ref.reference_C_TFLOPS_per_chip!==null)throw Error('Invalid reference revision');
    for(const arm of ['B0','B1']) if(ref[arm]?.eta_percent!==null||ref[arm]?.eta_target_met!==null||!Number.isFinite(ref[arm]?.own_C)||ref[arm].own_C!==ref[arm].ownF/(ref.participating_chips*ref[arm].own_T_seconds*1e12))throw Error('Invalid same-run measurement');
    const missingC16=d.c16_equal_request_latency.arms.some(arm=>!runs.runs.some(r=>r.run_id===arm.run_id));
    if(missingC16)throw Error('Missing C16 identity');
    if(counts.schema!=='full-answer-compute-subtotal/v1'||counts.arms?.length!==2)throw Error('Invalid compute subtotal');
    counts.arms.forEach((arm,i)=>{
      const paired=joint.arms[i], parts=Object.values(arm.matrix_flops_parts);
      if(arm.run!==paired.run||arm.role!==paired.role||arm.client_seconds!==paired.phase_seconds||arm.output_tokens!==paired.successful_output_tokens||arm.requests!==paired.completed||arm.chips!==2||parts.some(v=>!Number.isSafeInteger(v)||v<=0)||parts.reduce((a,b)=>a+b,0)!==arm.matrix_flops_subtotal||arm.matrix_subtotal_tflops_per_chip!==arm.matrix_flops_subtotal/(arm.chips*arm.client_seconds*1e12))throw Error('Compute subtotal identity mismatch');
      if(['effective_flops_total','effective_tflops_per_chip','reference_seconds','efficiency_percent','outline_pass'].some(k=>arm[k]!==null))throw Error('Subtotal cannot supply total compute or acceptance');
    });
    const extended=counts.b1_basic_work_interval, measured=counts.arms[1];
    if(extended?.run!==measured.run||extended.recovered_native_requests!==measured.requests||extended.basic_work_flops_interval?.length!==2||extended.client_tflops_per_chip_interval?.length!==2||extended.gdn_prefill_flops_interval?.length!==2)throw Error('Invalid extended arithmetic');
    extended.basic_work_flops_interval.forEach((f,i)=>{
      if(!Number.isSafeInteger(f)||f!==measured.matrix_flops_subtotal+extended.target_scalar_flops+extended.necessary_draft_flops+extended.gdn_prefill_flops_interval[i]||extended.client_tflops_per_chip_interval[i]!==f/(2*measured.client_seconds*1e12))throw Error('Extended arithmetic mismatch');
    });
    if(extended.basic_work_flops_interval[0]>extended.basic_work_flops_interval[1]||['synchronized_effective_tflops_per_chip','reference_seconds','efficiency_percent','outline_pass'].some(k=>extended[k]!==null))throw Error('Client-work interval cannot supply outline acceptance');
    const n=measured.necessary_target_positions, p=measured.causal_pairs, o=measured.output_tokens, requests=measured.requests, dep=extended.dependencies;
    const scalar=n*(1627333+1683480+371520+1720320-160)-requests*2949120+p*480+(o-requests)*110223360;
    const draft=20998533*dep.kv_rows+108091657*dep.full_query_rows+1017118720*dep.retained_vocab_rows+16432*dep.attention_pairs;
    if(scalar!==extended.target_scalar_flops||draft!==extended.necessary_draft_flops)throw Error('Displayed coefficient calculation mismatch');
    if(reference.schema!=='b0-effective-compute-comparison/v2'||reference.arms?.length!==2||reference.acceptance_scope!=='descriptive_comparison_only'||reference.independent_outline_eta_ref_pass!==null||reference.original_independent_reference_reclassified!==false)throw Error('Invalid compute comparison scope');
    if([reference,...reference.arms].some(record=>Object.keys(record).some(key=>key.includes('target')||key.includes('margin'))))throw Error('Baseline comparison cannot supply an acceptance target');
    const base=reference.arms[0];
    if(base.role!=='B0'||reference.arms[1].role!=='B1'||reference.baseline_C_TFLOPS_per_chip!==base.C_TFLOPS_per_chip)throw Error('Invalid B0 comparison baseline');
    for(const arm of reference.arms){
      const terms=Object.values(reference.component_totals[arm.role]);
      const original=ref[arm.role];
      const ratio=100*arm.C_TFLOPS_per_chip/base.C_TFLOPS_per_chip;
      if(terms.some(v=>!Number.isSafeInteger(v)||v<0)||terms.reduce((a,b)=>a+b,0)!==arm.F||arm.F!==original.ownF||arm.T_seconds!==original.own_T_seconds||arm.chips!==ref.participating_chips||arm.C_TFLOPS_per_chip!==arm.F/(arm.chips*arm.T_seconds*1e12)||Math.abs(arm.relative_compute_percent-ratio)>1e-10)throw Error('B0 comparison arithmetic mismatch');
    }
    if(Object.values(reference.B0_family_totals).reduce((a,b)=>a+b,0)!==base.F||Math.abs(reference.C_gain_percent-(reference.arms[1].relative_compute_percent-100))>1e-10)throw Error('B0 comparison component or gain mismatch');
    if(discovery.schema!=='controller-b1-discovery/v1'||discovery.matched_B0!==null||discovery.validated_win!==false||discovery.repetitions_per_arm!==1||discovery.task_quality_evaluated!==false)throw Error('Invalid Controller discovery scope');
    for(const arm of Object.values(discovery.arms)) {
      if(arm.successful_business_requests!==discovery.programs_per_arm*discovery.rounds_per_program||![arm.makespan_seconds,arm.request_p95_seconds].every(v=>Number.isFinite(v)&&v>0))throw Error('Incomplete Controller batch');
    }
    const gain=100*(1-discovery.arms.C.makespan_seconds/discovery.arms.B.makespan_seconds);
    if(Math.abs(gain-discovery.C_over_B_percent)>1e-9)throw Error('Controller comparator mismatch');
    controllerDiscovery=discovery;
    validateQualifiedPair(paired);
    data=d;manifest=m;runEvidence=runs;qualifiedPair=paired;render();
  }
  loadPublication().catch(error=>{console.error('B0/B1 publication load failed',error);root.textContent=t('结果加载失败或校验不一致，请刷新重试。','Results unavailable or publication verification failed; please retry.');});
})();
