/* Fixed comparison charts. Full configuration travels with the downloaded point. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id), M = window.LeaderboardFrontierModel;
    const DEFAULT_AXES = {x:'decode_p90_tps',y:'output_tps_per_chip'};
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const words = {
        en: {
            rentAxis: 'Normalize by card rent', rentY: 'Output throughput / monthly rent', rentUnit: 'tok/s / CNY 10,000 (monthly card rent)', rentNote: '910B2: CNY 4/card/hour × 24 × 30 = CNY 2,880/card/month. Rent-normalized throughput, not API revenue.',
            selectAll: 'Select all', clearAll: 'Deselect all', rotationDepth: 'Session rotation depth', rotationHelp: 'C1/C2/… is request concurrency; D1/D2 is the number of session states rotated per request lane.', rotationPending: 'Larger rotation depths are under construction.',
            knownBudget: 'Known output budget · no learned predictor', budgetChecksOnly: 'Admission capacity checks ran, but no admission deferrals or preemptions were observed. This point does not demonstrate an optimization benefit.',
            notExercised: 'MOD policy not exercised', notExercisedScope: 'The MOD was enabled, but its optimization mechanism was not exercised during this window. This point does not demonstrate an optimization benefit.',
            storeOnly: 'No cache restores observed', storeOnlyScope: 'Cache stores were observed, but no cache restores occurred in this window. This point does not establish a tiering benefit.',
            failed: 'Correctness failed · throughput reference only', failureScope: 'C16 retrieval check: 5/16 answers truncated (requests 2, 5, 8, 11, 13); 8/8 serial checks passed. All five red points use this deployment; C1/2/4/8 were not separately correctness-qualified.', title: 'Benchmark setting', subtitle: 'Decode speed × output efficiency', pairedSubtitle: 'Matched offline batch throughput', fixedSubtitle: 'Fixed-configuration measured comparison', studySubtitle: 'Measured configuration study', studyGroup: 'Study group', model: 'Model · precision', workload: 'Workload', filter: 'Filter', all: 'All', mtpOn: 'On', mtpOff: 'Off', noMatch: 'No points match this filter.',
            x: 'P90 decode speed', y: 'Output throughput / chip', batchSize: 'Batch size', outputThroughput: 'Output throughput', native: 'Native configuration', officialBaseline: 'Fixed official baseline', baselinePending: 'matched measurement pending for this setting', baselineMeasured: 'matched measurement available',
            smoke: 'Measured comparison', formal: 'Measured setting', fixed: 'Fixed comparison', study: 'Configuration study', hint: 'Select a point for configuration', fixedHint: 'Fixed-configuration comparison; points are independent measured observations', studyComparisonHint: 'Only Pareto-frontier points are shown, connected separately for BetterScale and Native. BetterScale spans workload-tuned configurations, not a fixed-capacity sweep.', studyHint: 'Independent study groups are not connected; compare points only within the same group', lineHint: 'BetterScale lines connect best trade-offs across workload-tuned configurations; other lines follow measured concurrency series', frontierOnly: 'Best trade-off points only', sampled: 'Sampling date',
            loading: 'Loading measurements…', empty: 'No measurements yet.', error: 'Measurements unavailable. Reload to retry.',
            missing: 'Missing axis metrics', standalone: 'measurements are not on a displayed line', points: 'points', context: 'context',
            download: 'Download configuration', close: 'Close', parallel: 'Parallelism', concurrency: 'Concurrency',
            modCoverage: '35B MOD coverage', workloadRepo: 'Workload repository', curves: 'Concurrency curves', nearby: 'Nearby configurations', warmup: 'Warmup', sweWarmup: 'Separate check · fresh session KV', primers: 'Snapshot primers', pressure: 'Primers + 10/lane', capacity: 'Server limit', unknown: 'Not recorded', draft: 'MTP draft tokens', graphMode: 'Graph mode', stateSeats: 'Execution / resident seats', balancedAttention: 'Balanced attention', cachePolicy: 'State cache', fullCache: 'Full', incrementalCache: 'Incremental', enabled: 'On', disabled: 'Off', modSource: 'MOD source', staged: 'staged source', localAdaptation: 'local adaptation',
            viewContract: 'View contract', contractTitle: 'Current setting contract', contractScope: 'Setting identity', contractCurves: 'Enabled curve configurations', contractCurve: 'Curve', contractRuntime: 'Runtime', contractTopology: 'Topology', contractMemory: 'Capacity / memory', contractExecution: 'Execution', contractEvidence: 'Evidence identity', modelRevision: 'Model revision', checkpoint: 'Checkpoint', precision: 'Precision / dtype', window: 'Measured window', protocol: 'Protocol', preparedWorkload: 'Canonical prepared workload', workloadHash: 'Workload', tokenizer: 'Canonical tokenizer fingerprint', dataset: 'Source dataset', seconds: 'seconds', chips: 'chips', perChip: 'per chip', varies: 'varies by curve', noCurves: 'No enabled curve configurations.'
        },
        zh: {
            rentAxis: '按卡月租归一化', rentY: '万元卡月租输出吞吐', rentUnit: 'tok/s/万元（卡月租）', rentNote: '910B2：4 元/卡时 × 24 × 30 = 2,880 元/卡月。仅折算卡租，不代表 API 产值。',
            selectAll: '全选', clearAll: '全不选', rotationDepth: '会话轮转深度', rotationHelp: 'C1/C2/… 是请求并发数；D1/D2 是每条并发通道轮转的会话状态数。', rotationPending: '更大轮转深度的测试正在施工。',
            knownBudget: '已知输出预算 · 未使用学习型预测器', budgetChecksOnly: '准入容量检查已执行，但未观察到准入延后或抢占；该点不构成优化收益证据。',
            notExercised: 'MOD 策略未触发', notExercisedScope: 'MOD 已启用，但本窗口未触发有效的优化动作；该点不构成优化收益证据。',
            storeOnly: '未观察到缓存恢复', storeOnlyScope: '本窗口观察到了缓存保存，但没有缓存恢复；该点不能证明层级缓存带来的收益。',
            failed: '正确性失败 · 仅吞吐参考', failureScope: 'C16 检索检查：5/16 答案截断（请求 2、5、8、11、13）；串行检查 8/8 通过。五个红点来自同一部署，C1/2/4/8 未分别通过正确性验收。', title: '实验设定', subtitle: '解码速度 × 产出效率', pairedSubtitle: '同配置离线批吞吐对照', fixedSubtitle: '固定配置实测对照', studySubtitle: '配置实测研究', studyGroup: '实验组', model: '模型 · 精度', workload: 'Workload', filter: '筛选', all: '全部', mtpOn: '开启', mtpOff: '关闭', noMatch: '没有符合筛选条件的数据点。',
            x: 'P90 解码速度', y: '每卡输出吞吐', batchSize: 'Batch size', outputThroughput: '总输出吞吐', native: 'Native 配置', officialBaseline: '固定官方基线', baselinePending: '该设定的同合同实测待补', baselineMeasured: '已有该设定的同合同实测',
            smoke: '实测对比', formal: '实测设定', fixed: '固定配置对照', study: '配置研究', hint: '点击数据点查看配置', fixedHint: '固定配置对照；各点是独立实测，不表示缺失并发曲线', studyComparisonHint: '仅展示并分别连接 BetterScale 与 Native 的 Pareto 前沿点；BetterScale 跨 workload 调优配置，不代表固定容量扫描。', studyHint: '不同实验组之间不连线；只在同一实验组内比较', lineHint: 'BetterScale 连线连接不同 workload 调优配置的最佳权衡点；其他连线按实测并发序列连接', frontierOnly: '仅显示最佳权衡点', sampled: '采样日期',
            loading: '正在读取成绩…', empty: '暂无实测成绩。', error: '暂时无法读取成绩，请刷新重试。',
            missing: '缺少坐标指标', standalone: '个测量点不在当前连线上', points: '个点', context: '上下文',
            download: '下载详细配置', close: '关闭', parallel: '并行规模', concurrency: '并发数',
            modCoverage: '35B MOD 补测进度', workloadRepo: 'Workload 仓库', curves: '并发曲线', nearby: '附近的配置', warmup: '预热', sweWarmup: '独立校验 · 测量会话冷 KV', primers: '初始上下文填充', pressure: '初始填充 + 每路 10 次', capacity: '服务端上限', unknown: '未记录', draft: 'MTP draft token 数', graphMode: '图模式', stateSeats: '执行 / 驻留槽位', balancedAttention: '均衡 attention', cachePolicy: '状态缓存', fullCache: '全量', incrementalCache: '增量', enabled: '开启', disabled: '关闭', modSource: 'MOD 源码', staged: '部署快照', localAdaptation: '本地适配',
            viewContract: '查看合同', contractTitle: '当前设定合同', contractScope: '设定身份', contractCurves: '已启用曲线配置', contractCurve: '曲线', contractRuntime: '运行时', contractTopology: '并行拓扑', contractMemory: '容量 / 显存', contractExecution: '执行模式', contractEvidence: '证据身份', modelRevision: '模型 revision', checkpoint: 'Checkpoint', precision: '精度 / dtype', window: '测量窗口', protocol: '协议', preparedWorkload: 'Canonical 预制负载', workloadHash: '负载', tokenizer: 'Canonical tokenizer 指纹', dataset: '源数据集', seconds: '秒', chips: '卡', perChip: '每卡', varies: '随曲线不同', noCurves: '当前没有启用的曲线配置。'
        }
    };
    const lang = () => (document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
    const t = key => words[lang()][key];
    const fmt = n => n == null ? '—' : new Intl.NumberFormat(lang(), {maximumFractionDigits: 2}).format(n);
    const rotationLabel = depth => depth == null ? 'D—' : `D${fmt(depth)}`;
    const serviceScale = point => {
        const c = point.load.concurrency, d = point.load.session_rotation_depth;
        if (axes().x === 'batch_size') return `${t('batchSize')}: B${fmt(point.load.batch_size)}`;
        if (!hasRotation()) return `${t('concurrency')}: ${fmt(c)}`;
        return `${t('concurrency')}: C${fmt(c)} · ${t('rotationDepth')}: ${rotationLabel(d)}`;
    };
    const state = {data:{cohorts:[],points:[]}, catalog:new Map(), ready:false, error:false, tag:'', cohort:'', selected:'', mtp:null, mods:null, rotation:null, frontierOnly:false, rentNormalized:false};
    const requestedSetting = new URLSearchParams(location.search).get('setting') || '';
    const colors = ['#4263eb','#008c78','#ad5c00','#965bd3','#d14469','#177baf'];
    const tagKey = c => JSON.stringify([c.model.id,c.precision.id]);
    const cohort = () => state.data.cohorts.find(c => c.id === state.cohort);
    const baseAxes = () => cohort()?.workload.contract.frontier_axes || DEFAULT_AXES;
    const canNormalizeRent = () => baseAxes().y === 'output_tps_per_chip' && cohortPoints().length > 0 && cohortPoints().every(M.supportsRent);
    const axes = () => state.rentNormalized && canNormalizeRent() ? {...baseAxes(), y:'output_tps_per_10k_rent'} : baseAxes();
    const axisUnit = key => key === 'output_tps_per_10k_rent' ? t('rentUnit') : M.metrics[key].unit;
    const fixedComparison = () => cohort()?.workload.contract.presentation === 'fixed-comparison';
    const configurationStudy = () => cohort()?.workload.contract.presentation === 'configuration-study';
    const studyComparison = p => cohort()?.workload.contract.comparison_point_ids?.includes(p.id);
    const independentStudy = () => fixedComparison() || configurationStudy();
    const axisLabel = key => ({batch_size:t('batchSize'),output_tps:t('outputThroughput'),decode_p90_tps:t('x'),output_tps_per_chip:t('y'),output_tps_per_10k_rent:t('rentY')})[key] || key;
    const cohortPoints = () => M.presentationPoints(state.data.points,cohort());
    const hasRotation = () => !!cohort()?.workload.contract.session_rotation;
    const depthPoints = () => cohortPoints().filter(p => !hasRotation() || state.rotation?.has(String(p.load.session_rotation_depth)));
    const filteredPoints = () => depthPoints().filter(p => state.mtp?.has(M.mtpState(p)) && state.mods?.has(M.groupKey(p)));
    const points = () => (configurationStudy() && cohort()?.workload.contract.comparison_point_ids) || (state.frontierOnly && !independentStudy())
        ? M.groupFrontiers(filteredPoints(),axes().x,axes().y).flat().map(row=>row.point) : filteredPoints();
    const groupLabel = p => p.study_group?.[lang()==='zh'?'label_zh':'label_en'] || p.load.presentation_group?.[lang()==='zh'?'label_zh':'label_en'] || cohort()?.workload.contract.display_group_labels?.[M.groupKey(p)]?.[lang()==='zh'?'label_zh':'label_en'] || p.configuration.experiment_group || (p.configuration.mods.length ? p.configuration.mods.map(id => state.catalog.get(id)?.name || id).join(' + ') : t('native'));
    const hasOfficialBaseline = () => !!state.data.official_baseline && cohortPoints().some(p => p.configuration.official_baseline_id === state.data.official_baseline.id);
    const officialBaselineText = () => {
        const baseline=state.data.official_baseline;
        if(!baseline)return '';
        return `${t('officialBaseline')} · vLLM ${baseline.vllm_version} + vLLM-Ascend ${baseline.vllm_ascend_version} · ${t(hasOfficialBaseline()?'baselineMeasured':'baselinePending')}`;
    };
    const pointLabel = p => independentStudy() && !studyComparison(p) ? p.label : groupLabel(p);
    const knownBudget = p => p.configuration.mods.includes('dla') && p.configuration.parameters.length_source === 'Declared exact ignore_eos output budgets, no learned predictor';
    const notExercised = p => p.configuration.mods.length > 0 && p.configuration.parameters.mod_runtime_effectiveness?.status === 'not-exercised';
    const storeOnly = p => p.configuration.mods.length > 0 && p.configuration.parameters.mod_runtime_effectiveness?.status === 'store-only';
    const modSources = point => point.configuration.mods.map(id=>{
        const name=state.catalog.get(id)?.name||id, source=point.configuration.mod_sources?.find(s=>s.id===id);
        if(!source)return `${escape(name)} · ${t('unknown')}`;
        const revisions=[source.revision,...(source.additional_revisions||[])];
        return `${escape(name)} @ ${revisions.map(rev=>`<a href="${escape(source.repository+'/commit/'+rev)}" target="_blank" rel="noopener" title="${escape(rev)}">${escape(rev.slice(0,7))}</a>`).join(' + ')} <span title="${escape(source.source_capsule+' — '+source.scope)}">· ${t('staged')}</span>${source.local_adaptations?` · <span title="${escape(source.local_adaptations)}">${t('localAdaptation')}</span>`:''}`;
    }).join('<br>');
    const parallel = p => {
        const params = p.configuration.parameters;
        if (params.attention_ranks != null && params.expert_ranks != null) return `A${params.attention_ranks} / E${params.expert_ranks}`;
        if (params.attention_tensor_parallel_size != null && params.expert_tensor_parallel_size != null) {
            const attention = params.attention_data_parallel_size > 1 ? `DP${params.attention_data_parallel_size}` : `TP${params.attention_tensor_parallel_size}`;
            const expert = params.expert_parallel_size > 1 ? `EP${params.expert_parallel_size}` : `TP${params.expert_tensor_parallel_size}`;
            return `${lang() === 'zh' ? '注意力' : 'Attention'} ${attention} / ${lang() === 'zh' ? '专家' : 'Experts'} ${expert}`;
        }
        return [['TP',params.tensor_parallel_size],['PP',params.pipeline_parallel_size],['DP',params.data_parallel_size],['EP',params.expert_parallel_size]]
            .filter(([key,value]) => value != null && (key === 'TP' || value > 1)).map(([key,value]) => `${key}${value}`).join(' / ') || t('unknown');
    };
    const boolLabel = value => value == null ? t('unknown') : t(value ? 'enabled' : 'disabled');
    const bytesLabel = value => value == null ? t('unknown') : `${fmt(value / 1024 ** 3)} GiB ${t('perChip')} (${fmt(value)} B)`;
    const contractGroups = () => {
        const groups = new Map();
        for (const point of points()) {
            const key = point.load.concurrency_series || point.id;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(point);
        }
        return [...groups.values()].map(members => ({
            point: members[0],
            concurrency: [...new Set(members.map(p => p.load.concurrency).filter(Number.isFinite))].sort((a,b)=>a-b)
        })).sort((a,b)=>groupLabel(a.point).localeCompare(groupLabel(b.point),lang()));
    };
    function openContract() {
        const current=cohort(), contract=current?.workload.contract || {}, groups=contractGroups();
        const protocols=[...new Set(points().map(p=>p.evidence.benchmark_protocol?.protocol_id).filter(Boolean))];
        const depths=[...new Set(points().map(p=>p.load.session_rotation_depth).filter(Number.isInteger))].sort((a,b)=>a-b);
        const content=$('frontier-contract-content');
        content.innerHTML=`<header class="frontier-contract-header"><div><h2 id="frontier-contract-title">${t('contractTitle')}</h2><p>${escape(current?.workload.label || t('unknown'))}</p></div></header>
            <section aria-labelledby="frontier-contract-scope-title"><h3 id="frontier-contract-scope-title">${t('contractScope')}</h3><dl class="frontier-contract-facts">
                <div><dt>${t('model')}</dt><dd>${escape(current?.model.label || t('unknown'))}</dd></div>
                <div><dt>${t('modelRevision')}</dt><dd class="frontier-contract-code">${escape(current?.model.revision || t('unknown'))}</dd></div>
                <div><dt>${t('precision')}</dt><dd>${escape(current?.precision.label || t('unknown'))}</dd></div>
                <div><dt>${t('window')}</dt><dd>${contract.measurement_seconds == null?t('unknown'):`${fmt(contract.measurement_seconds)} ${t('seconds')}`}</dd></div>
                <div><dt>${t('protocol')}</dt><dd>${escape(protocols.length===1?protocols[0]:protocols.length?t('varies'):t('unknown'))}</dd></div>
                <div><dt>${t('concurrency')}</dt><dd>${escape([...new Set(points().map(p=>p.load.concurrency).filter(Number.isFinite))].sort((a,b)=>a-b).map(c=>`C${c}`).join(' / ') || t('unknown'))}${depths.length?` · ${escape(depths.map(rotationLabel).join(' / '))}`:''}</dd></div>
                <div><dt>${t('preparedWorkload')}</dt><dd class="frontier-contract-code">${escape(contract.prepared_workload_sha256 || t('unknown'))}</dd></div>
                <div><dt>${t('tokenizer')}</dt><dd class="frontier-contract-code">${escape(contract.tokenizer_fingerprint || t('unknown'))}</dd></div>
                <div><dt>${t('dataset')}</dt><dd>${escape(contract.source_pool?.dataset || t('unknown'))}${contract.source_pool?.revision?`<br><span class="frontier-contract-code">${escape(contract.source_pool.revision)}</span>`:''}</dd></div>
            </dl></section>
            <section aria-labelledby="frontier-contract-curves-title"><h3 id="frontier-contract-curves-title">${t('contractCurves')}</h3>
                ${groups.length?`<div class="frontier-contract-table-wrap"><table class="frontier-contract-table"><thead><tr><th>${t('contractCurve')}</th><th>${t('contractRuntime')}</th><th>${t('contractTopology')}</th><th>${t('contractMemory')}</th><th>${t('contractExecution')}</th><th>${t('contractEvidence')}</th></tr></thead><tbody>${groups.map(({point,concurrency})=>{
                    const p=point.configuration.parameters, commits=p.runtime_base_commits || {};
                    const evidence=point.evidence.benchmark_protocol || {};
                    const runtimeCommits=[commits.vllm?`vLLM ${escape(commits.vllm)}`:null,(commits['vllm-ascend']||commits.vllm_ascend)?`Ascend ${escape(commits['vllm-ascend']||commits.vllm_ascend)}`:null].filter(Boolean).join('<br>');
                    const topology=p.attention_ranks!=null&&p.expert_ranks!=null?parallel(point):[
                        `TP${p.tensor_parallel_size ?? '—'}`,`PP${p.pipeline_parallel_size ?? '—'}`,`DP${p.data_parallel_size ?? '—'}`,`EP ${boolLabel(p.expert_parallel)}`
                    ].join(' / ');
                    return `<tr><th scope="row">${escape(groupLabel(point))}<small>${escape(concurrency.map(c=>`C${c}`).join(' / ') || `C${point.load.concurrency ?? '—'}`)}</small></th>
                        <td>${escape(point.configuration.engine_version)}${runtimeCommits?`<small>${runtimeCommits}</small>`:''}</td>
                        <td>${escape(point.configuration.hardware.label)} × ${fmt(point.configuration.hardware.accelerator_count)} ${t('chips')}<small>${escape(topology)}</small></td>
                        <td>KV ${bytesLabel(p.kv_cache_memory_bytes)}<small>max_model_len ${fmt(p.max_model_len)}<br>max_num_seqs ${fmt(p.max_num_seqs)} · batched ${fmt(p.max_num_batched_tokens)}</small></td>
                        <td>${t('graphMode')}: ${escape(p.graph_mode ?? t('unknown'))}<small>APC ${boolLabel(p.prefix_caching)} · async ${boolLabel(p.async_scheduling)}<br>Mamba ${escape(p.mamba_cache_mode ?? t('unknown'))} · MTP ${fmt(p.mtp_draft_tokens)}<br>thinking ${boolLabel(p.thinking)} · temperature ${fmt(p.generation_temperature)}</small></td>
                        <td class="frontier-contract-code">${t('checkpoint')}: ${escape(p.checkpoint_revision || t('unknown'))}<br>${t('workloadHash')}: ${escape(evidence.prepared_workload_sha256 || t('unknown'))}<br>Tokenizer: ${escape(evidence.tokenizer_fingerprint || t('unknown'))}</td></tr>`;
                }).join('')}</tbody></table></div>`:`<p class="frontier-contract-empty">${t('noCurves')}</p>`}
            </section>`;
        const dialog=$('frontier-contract-dialog');
        $('frontier-contract-close').setAttribute('aria-label',t('close'));
        if(!dialog.open)dialog.showModal();
        $('frontier-contract-close').focus();
    }
    function reconcile() {
        if (!state.data.cohorts.some(c => tagKey(c) === state.tag)) state.tag = state.data.cohorts[0] ? tagKey(state.data.cohorts[0]) : '';
        const available = state.data.cohorts.filter(c => tagKey(c) === state.tag);
        if (!available.some(c => c.id === state.cohort)) state.cohort = available[0]?.id || '';
    }
    function updateSettingURL() {
        if (!state.ready || !state.cohort || $('view-frontier')?.getAttribute('aria-pressed') !== 'true') return;
        const params = new URLSearchParams(location.search);
        params.set('setting', state.cohort);
        history.replaceState(null, '', `${location.pathname}?${params.toString()}#settings`);
    }
    function shell() {
        reconcile();
        const tags = [...new Map(state.data.cohorts.map(c => [tagKey(c),c])).values()];
        const choices = state.data.cohorts.filter(c => tagKey(c) === state.tag);
        const declaredDefaults=cohort()?.workload.contract.default_groups;
        // BetterScale checkbox identity follows the MOD, not its workload-tuned slot capacity.
        // E16/R20 and the C32 observation (E36/R36; C32 is request concurrency) use the same
        // parameterized execution mechanism and configuration family. Keep one BetterScale tag;
        // preserve seat/graph/cache differences in each point's configuration and popover.
        const mods=[...new Map(cohortPoints().map(p=>[M.groupKey(p),p])).values()].sort((a,b)=>
            Number(Array.isArray(declaredDefaults)&&declaredDefaults.includes(M.groupKey(b)))-Number(Array.isArray(declaredDefaults)&&declaredDefaults.includes(M.groupKey(a))));
        const mtpOptions=[['on',t('mtpOn')],['off',t('mtpOff')],...(cohortPoints().some(p=>M.mtpState(p)==='unknown')?[['unknown',t('unknown')]]:[])];
        const depths=[...new Set(cohortPoints().map(p=>p.load.session_rotation_depth))].filter(Number.isInteger).sort((a,b)=>a-b);
        if(state.rotation===null)state.rotation=new Set(depths.map(String));
        if(state.mods===null){
            state.mods=new Set(!Array.isArray(declaredDefaults)?mods.map(M.groupKey):declaredDefaults);
        }
        if(state.mtp===null)state.mtp=new Set(mtpOptions.map(([key])=>key));
        $('frontier-panel').innerHTML = `
            <header class="frontier-heading"><div><h1>${t('title')}</h1><p>${t(configurationStudy()?'studySubtitle':fixedComparison()?'fixedSubtitle':axes().x==='batch_size'?'pairedSubtitle':'subtitle')}</p></div><span id="frontier-status" class="frontier-status" role="status"></span></header>
            <div class="frontier-layout"><div class="frontier-card">
                <div class="frontier-picker">
                    <div class="frontier-identity">
                        ${tags.length?`<details class="frontier-model-picker" id="frontier-model-picker"><summary id="frontier-model-trigger" aria-label="${t('model')}: ${escape(cohort().model.label)} · ${escape(cohort().precision.label)}">${escape(cohort().model.label)}<span>${escape(cohort().precision.label)}</span><span class="frontier-model-chevron" aria-hidden="true"></span></summary><div class="frontier-model-tags" role="group" aria-label="${t('model')}">${tags.map(c=>`<button type="button" class="frontier-model-tag" data-model-tag="${escape(tagKey(c))}" aria-pressed="${tagKey(c)===state.tag}">${escape(c.model.label)}<span>${escape(c.precision.label)}</span></button>`).join('')}</div></details>`:''}
                        ${choices.length>1?`<label class="frontier-workload">${t('workload')}<select id="frontier-workload">${choices.map(c=>`<option value="${escape(c.id)}" ${c.id===state.cohort?'selected':''}>${escape(c.workload.label)} · ${fmt(c.context_tokens)} ${t('context')}</option>`).join('')}</select></label>`:choices.length?`<span id="frontier-workload-tag" class="frontier-workload-tag" aria-label="${t('workload')}">${escape(choices[0].workload.label)} · ${fmt(choices[0].context_tokens)} ${t('context')}</span>`:''}
                        <button id="frontier-contract-open" class="frontier-contract-open" type="button" ${state.ready&&cohort()?'':'disabled'}>${t('viewContract')}</button>
                    </div>

                </div>
                ${state.data.official_baseline?`<p class="frontier-baseline" data-state="${hasOfficialBaseline()?'measured':'pending'}">${escape(officialBaselineText())}</p>`:''}
                <div class="frontier-plot" id="frontier-plot">
                    <svg id="frontier-chart" viewBox="0 0 1000 480" role="group" aria-label="${axisLabel(axes().x)} × ${axisLabel(axes().y)}"></svg>
                    <div id="frontier-blank" class="frontier-blank" role="status"></div>
                    <section id="frontier-popover" class="frontier-popover" role="dialog" aria-modal="false" aria-labelledby="frontier-popover-title" hidden></section>
                </div>
                <footer class="frontier-footer"><div class="frontier-legend" id="frontier-legend"></div><div class="frontier-footer-links"><a id="frontier-curves" target="_blank" rel="noopener" hidden>${t('curves')} ↗</a><a id="frontier-mod-coverage" href="https://github.com/vLLM-HUST/vllm-hust-website/blob/main/docs/FRONTIER-QWEN35-MOD-COVERAGE.md" target="_blank" rel="noopener">${t('modCoverage')} ↗</a><a id="frontier-workload-repo" href="https://github.com/vLLM-HUST/agentx-bench" target="_blank" rel="noopener">${t('workloadRepo')} ↗</a><span id="frontier-hint">${t('hint')}</span></div></footer>
            </div>
            <aside class="frontier-filters" aria-label="${t('filter')}">
                <h2>${t('filter')}</h2>
                ${canNormalizeRent()?`<fieldset><legend>${axisLabel(baseAxes().y)}</legend><div class="frontier-checks"><label><input id="frontier-rent-axis" type="checkbox" ${state.rentNormalized?'checked':''}>${t('rentAxis')}</label></div><p class="frontier-filter-note" id="frontier-rent-note" ${state.rentNormalized?'':'hidden'}>${t('rentNote')}</p></fieldset>`:''}
                <fieldset><legend>${configurationStudy()?t('studyGroup'):'MOD / Group'} <button type="button" id="frontier-mods-toggle"></button></legend><div class="frontier-checks">${mods.map(p=>`<label><input type="checkbox" data-filter="mods" value="${escape(M.groupKey(p))}" ${state.mods.has(M.groupKey(p))?'checked':''}>${escape(groupLabel(p))}</label>`).join('')}</div></fieldset>
                <fieldset><legend>MTP</legend><div class="frontier-checks">${mtpOptions.map(([key,text])=>`<label><input type="checkbox" data-filter="mtp" value="${key}" ${state.mtp.has(key)?'checked':''}>${text}</label>`).join('')}</div></fieldset>
                ${hasRotation()?`<fieldset id="frontier-rotation-filter"><legend>${t('rotationDepth')}</legend><div class="frontier-checks">${depths.map(depth=>`<label><input type="checkbox" data-filter="rotation" value="${depth}" ${state.rotation.has(String(depth))?'checked':''}>${rotationLabel(depth)}</label>`).join('')}</div><p class="frontier-filter-note">${t('rotationHelp')}</p>${cohort().workload.contract.session_rotation.status==='under-construction'?`<p class="frontier-filter-note">${t('rotationPending')}</p>`:''}</fieldset>`:''}
                ${independentStudy()?'':`<div class="frontier-checks"><label><input id="frontier-only" type="checkbox" ${state.frontierOnly?'checked':''}>${t('frontierOnly')}</label></div>`}
                <span id="frontier-filter-count" role="status"></span>
            </aside></div>`;
        $('frontier-panel').querySelectorAll('[data-model-tag]').forEach(button=>button.addEventListener('click',()=>{
            state.tag=button.dataset.modelTag;state.cohort='';state.selected='';state.mtp=null;state.mods=null;state.rotation=null;shell();updateSettingURL();$('frontier-model-trigger')?.focus();
        }));
        $('frontier-workload')?.addEventListener('change',event=>{state.cohort=event.target.value;state.selected='';state.mtp=null;state.mods=null;state.rotation=null;shell();updateSettingURL();});
        $('frontier-rent-axis')?.addEventListener('change',event=>{state.rentNormalized=event.target.checked;state.selected='';$('frontier-rent-note').hidden=!state.rentNormalized;render();});
        $('frontier-contract-open').addEventListener('click',openContract);
        $('frontier-panel').querySelectorAll('[data-filter]').forEach(input=>input.addEventListener('change',()=>{
            const selected=state[input.dataset.filter];
            if(input.checked)selected.add(input.value);else selected.delete(input.value);
            state.selected='';render();
        }));
        $('frontier-mods-toggle').addEventListener('click',()=>{
            const all=mods.every(p=>state.mods.has(M.groupKey(p)));
            state.mods=new Set(all?[]:mods.map(M.groupKey));state.selected='';
            $('frontier-panel').querySelectorAll('[data-filter="mods"]').forEach(input=>{input.checked=!all;});
            render();
        });
        $('frontier-only')?.addEventListener('change',event=>{state.frontierOnly=event.target.checked;state.selected='';render();});
        $('frontier-chart').addEventListener('click',choose);
        $('frontier-chart').addEventListener('keydown',event=>{
            if(['Enter',' '].includes(event.key)&&event.target.closest('[data-point]')){event.preventDefault();choose(event);}
        });
        $('frontier-popover').addEventListener('click',event=>{
            if(event.target.closest('[data-close]'))close(true);
            if(event.target.closest('[data-download]'))download();
            const nearby=event.target.closest('[data-nearby]');
            if(nearby){state.selected=nearby.dataset.nearby;popup();}
        });
        render();
    }
    function choose(event) {
        let id=event.target.closest('[data-point]')?.dataset.point;
        if(event.type==='click'){
            // Dense mobile points must not be selected by SVG paint order.
            const hits=[...$('frontier-chart').querySelectorAll('[data-point]')].map(node=>{
                const box=node.querySelector('.frontier-dot').getBoundingClientRect();
                return {id:node.dataset.point,distance:Math.hypot(event.clientX-box.x-box.width/2,event.clientY-box.y-box.height/2)};
            }).sort((a,b)=>a.distance-b.distance);
            const nearest=hits[0];
            id=nearest?.distance<=18?(hits.find(hit=>hit.id===id&&Math.abs(hit.distance-nearest.distance)<.01)?.id||nearest.id):'';
        }
        if(!id)return;
        state.selected=id;popup();
        if(event.type==='keydown')$('frontier-popover').querySelector('[data-download]').focus();
    }
    function close(restoreFocus=false) {
        const id=state.selected;state.selected='';popup();
        if(restoreFocus&&id)$('frontier-chart').querySelector(`[data-point="${CSS.escape(id)}"]`)?.focus();
    }
    function download() {
        const point=points().find(p=>p.id===state.selected);
        if(!point)return;
        const payload={schema_version:'frontier-configuration/v1',cohort:state.data.cohorts.find(c=>c.id===point.cohort_id),point,
            ...(studyComparison(point)?{comparison_cohort:cohort()}:{}),
            chart:{x:axes().x,y:axes().y,x_unit:M.metrics[axes().x].unit,y_unit:M.metrics[axes().y].unit,...(axes().y==='output_tps_per_10k_rent'?{rent_assumption:M.rentAssumption,y_value:M.value(point,axes().y)}:{})}};
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=`${point.id.replace(/[^a-z0-9_.-]/gi,'_')}.json`;
        document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function render() {
        const measured=M.project(points(),axes().x,axes().y), current=cohort();
        $('frontier-mods-toggle').textContent=t(cohortPoints().every(p=>state.mods?.has(M.groupKey(p)))?'clearAll':'selectAll');
        $('frontier-mods-toggle').disabled=cohortPoints().length===0;
        $('view-frontier-count').textContent=state.data.points.length;
        const status=$('frontier-status');status.dataset.state=state.error?'error':state.ready?'ready':'loading';
        status.textContent=state.error?t('error'):!state.ready?t('loading'):configurationStudy()?t('study'):fixedComparison()?t('fixed'):current?.workload.contract.profile==='smoke'?t('smoke'):t('formal');
        const blank=$('frontier-blank');blank.hidden=measured.measured.length>0;
        blank.textContent=state.error?t('error'):!state.ready?t('loading'):cohortPoints().length?t('noMatch'):t('empty');
        $('frontier-filter-count').textContent=`${points().length} / ${depthPoints().length} ${t('points')}`;
        const groups=[...new Map(cohortPoints().map(p=>[M.groupKey(p),p])).values()].sort((a,b)=>
            Number(M.groupKey(b)==='none')-Number(M.groupKey(a)==='none')||M.groupKey(a).localeCompare(M.groupKey(b)));
        const color=p=>M.failedCorrectness(p)?'#dc2626':colors[groups.findIndex(g=>M.groupKey(g)===M.groupKey(p))%colors.length];
        const series=[...new Map(cohortPoints().map(p=>[independentStudy()&&!studyComparison(p)?p.id:M.frontierKey(p),p])).values()];
        $('frontier-legend').innerHTML=series.filter(g=>points().some(p=>independentStudy()&&!studyComparison(g)?p.id===g.id:M.frontierKey(p)===M.frontierKey(g))).map(p=>`<span data-frontier-group="${escape(M.frontierKey(p))}"><i style="background:${p.load.session_rotation_depth>1?'transparent':color(p)};border:2px solid ${color(p)}"></i>${escape(pointLabel(p))}${hasRotation()?` · ${rotationLabel(p.load.session_rotation_depth)}`:''}${M.failedCorrectness(p)?` · ${t('failed')}`:''}</span>`).join('');
        const measuredSeries=M.chartSeries(measured.measured,axes().x,axes().y,current);
        const connected=new Set(measuredSeries.flatMap(rows=>rows.map(row=>row.point.id)));
        const standalone=measured.measured.filter(row=>!connected.has(row.point.id)).length;
        $('frontier-hint').textContent=(configurationStudy()?t(cohort()?.workload.contract.comparison_point_ids?'studyComparisonHint':'studyHint'):fixedComparison()?t('fixedHint'):measuredSeries.length?t('lineHint'):t('hint'))+(!independentStudy()&&standalone?` · ${standalone} ${t('standalone')}`:'')+(measured.excluded?` · ${t('missing')}: ${measured.excluded}`:'');
        // Historical static curves describe depth1, not every workload selected by the checkboxes.
        const curves=$('frontier-curves'), curveUrl=!hasRotation()||(state.rotation?.size===1&&state.rotation.has('1'))?current?.workload.contract.concurrency_curves_url:null;
        curves.hidden=typeof curveUrl!=='string'||!/^\.\/assets\/[a-z0-9-]+\.svg(?:\?v=[a-z0-9-]+)?$/.test(curveUrl);
        if(!curves.hidden)curves.href=curveUrl;else curves.removeAttribute('href');
        const workloadRepo=current?.workload.contract.repository_url;
        $('frontier-workload-repo').href=typeof workloadRepo==='string'&&/^https:\/\/github\.com\/vLLM-HUST\/[a-z0-9-]+$/i.test(workloadRepo)?workloadRepo:'https://github.com/vLLM-HUST/agentx-bench';
        $('frontier-mod-coverage').hidden=!current?.model.label.startsWith('Qwen3.5');
        chart(measured,color);popup();
    }
    function popup() {
        const point=points().find(p=>p.id===state.selected), panel=$('frontier-popover');
        $('frontier-chart').querySelectorAll('[data-point]').forEach(node=>{
            node.classList.toggle('is-selected',node.dataset.point===state.selected);
            node.setAttribute('aria-expanded',String(node.dataset.point===state.selected));
        });
        panel.hidden=!point;if(!point)return;
        const params=point.configuration.parameters;
        const warmupKey=({'agentx256k-snapshot-primers-v2':'primers','agentx256k-pressure10-v1':'pressure','swe-prefix-reuse/v1':'sweWarmup'})[point.evidence.benchmark_protocol?.protocol_id]||'unknown';
        const selectedDot=$('frontier-chart').querySelector(`[data-point="${CSS.escape(point.id)}"] .frontier-dot`);
        const center=node=>{const b=node.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2];};
        const at=selectedDot?center(selectedDot):null;
        const nearby=at?points().filter(p=>{
            const dot=$('frontier-chart').querySelector(`[data-point="${CSS.escape(p.id)}"] .frontier-dot`);
            if(!dot)return false;const pos=center(dot);return Math.hypot(at[0]-pos[0],at[1]-pos[1])<=12;
        }):[];
        panel.innerHTML=`<button type="button" class="frontier-popup-close" data-close aria-label="${t('close')}">×</button>
            <h2 id="frontier-popover-title">${escape(pointLabel(point))}</h2>
            ${M.failedCorrectness(point)?`<p class="frontier-correctness-warning"><strong>${t('failed')}</strong><br>${point.configuration.parameters.functional_check_id==='dense27-native1'?t('failureScope'):escape(params.functional_scope)}</p>`:''}
            ${knownBudget(point)?`<p class="frontier-popup-variant">${t('knownBudget')}</p>`:''}
            ${notExercised(point)?`<p class="frontier-popup-load"><strong>${t('notExercised')}</strong><br>${t(knownBudget(point)&&params.mod_runtime_effectiveness?.admission_check_executed?'budgetChecksOnly':'notExercisedScope')}</p>`:''}
            ${storeOnly(point)?`<p class="frontier-popup-load"><strong>${t('storeOnly')}</strong><br>${t('storeOnlyScope')}</p>`:''}
            <p class="frontier-popup-engine">${escape(point.configuration.engine)} ${escape(point.configuration.engine_version)}</p>
            ${point.configuration.mods.length?`<p class="frontier-popup-mod-source">${t('modSource')}: ${modSources(point)}</p>`:''}
            <p class="frontier-popup-date">${t('sampled')}: ${point.evidence.sampling_date_utc?`${escape(point.evidence.sampling_date_utc)}${point.evidence.sampling_date_end_utc && point.evidence.sampling_date_end_utc!==point.evidence.sampling_date_utc?` – ${escape(point.evidence.sampling_date_end_utc)}`:''} (UTC)`:t('unknown')}</p>
            ${point.evidence.aggregation_kind==='arithmetic-mean-of-runs'?`<p>${lang()==='zh'?'三轮算术平均；P90/P95为各轮分位数的平均。':'Arithmetic mean of three runs; P90/P95 are means of per-run quantiles.'}</p>`:''}
            <p class="frontier-popup-subtitle">${escape(point.configuration.hardware.label)} × ${point.configuration.hardware.accelerator_count} · ${escape(parallel(point))}</p>
            <div class="frontier-popup-metrics"><div><strong>${fmt(M.value(point,axes().x))}</strong><span>${axisLabel(axes().x)}<br>${axisUnit(axes().x)}</span></div><div><strong>${fmt(M.value(point,axes().y))}</strong><span>${axisLabel(axes().y)}<br>${axisUnit(axes().y)}</span></div></div>
            <p class="frontier-popup-load">${serviceScale(point)}${params.mtp_draft_tokens!=null?` · MTP${params.mtp_draft_tokens}`:''}${params.max_num_seqs!=null?`<br>${t('capacity')}: ${fmt(params.max_num_seqs)}${params.max_num_seqs_per_rank!=null?' / rank':''}`:''}${params.kv_cache_memory_bytes!=null?` · KV ${fmt(params.kv_cache_memory_bytes/1024**3)} GiB/chip`:''}</p>
            ${point.configuration.mods.includes('betterscale')?`<p class="frontier-popup-configuration">${[
                params.graph_mode!=null?`${t('graphMode')}: ${escape(params.graph_mode)}`:null,
                params.execution_seats!=null||params.resident_seats!=null?`${t('stateSeats')}: E${fmt(params.execution_seats)}/R${fmt(params.resident_seats)}`:null,
                params.balanced_decode_attention!=null?`${t('balancedAttention')}: ${t(params.balanced_decode_attention?'enabled':'disabled')}`:null,
                params.state_cache_policy!=null?`${t('cachePolicy')}: ${t(!params.state_cache_policy?'disabled':params.state_cache_incremental?'incrementalCache':'fullCache')}`:null
            ].filter(Boolean).join('<br>')}</p>`:''}
            <p class="frontier-popup-load">${t('warmup')}: ${t(warmupKey)}</p>
            ${nearby.length>1?`<div class="frontier-nearby"><span>${t('nearby')}</span>${nearby.map(p=>`<button type="button" data-nearby="${escape(p.id)}" aria-pressed="${p.id===point.id}">${escape(parallel(p))}${hasRotation()?` · ${rotationLabel(p.load.session_rotation_depth)}`:''} · C${fmt(p.load.concurrency)} · MTP${p.configuration.parameters.mtp_draft_tokens??'—'} · ${fmt(p.configuration.parameters.max_num_seqs)}</button>`).join('')}</div>`:''}
            <button type="button" class="frontier-download" data-download>${t('download')} ↓</button>`;
        const anchor=$('frontier-chart').querySelector(`[data-point="${CSS.escape(point.id)}"]`);
        if(!anchor){panel.hidden=true;return;}
        const plot=$('frontier-plot').getBoundingClientRect(), spot=anchor.getBoundingClientRect();
        panel.style.maxHeight=`${Math.max(120,plot.height-24)}px`;
        panel.scrollTop=0;
        const width=panel.offsetWidth,height=panel.offsetHeight;
        let left=spot.right-plot.left+12;
        if(left+width>plot.width-12)left=spot.left-plot.left-width-12;
        panel.style.left=`${Math.max(12,Math.min(left,plot.width-width-12))}px`;
        panel.style.top=`${Math.max(12,Math.min(spot.top-plot.top-24,plot.height-height-12))}px`;
    }
    function chart(result,color) {
        const width=Math.max(300,$('frontier-chart').clientWidth||1000),height=width<600?420:480,left=96,right=28,top=32,bottom=80;
        $('frontier-chart').setAttribute('viewBox',`0 0 ${width} ${height}`);
        const bounds=key=>{const values=result.measured.map(p=>p[key]);if(!values.length)return[0,1];const min=Math.min(...values),max=Math.max(...values),pad=(max-min||Math.abs(max)||1)*.18;return[Math.max(0,min-pad),max+pad];};
        const [xmin,xmax]=bounds('x'),[ymin,ymax]=bounds('y');
        const x=v=>left+(v-xmin)/(xmax-xmin)*(width-left-right),y=v=>height-bottom-(v-ymin)/(ymax-ymin)*(height-top-bottom);
        $('frontier-chart').setAttribute('aria-label',`${axisLabel(axes().x)} × ${axisLabel(axes().y)}`);
        let svg=`<title>${axisLabel(axes().x)} / ${axisLabel(axes().y)}</title>`;
        for(let i=0;i<=4;i++){
            const xv=xmin+(xmax-xmin)*i/4,yv=ymin+(ymax-ymin)*i/4;
            svg+=`<line class="frontier-grid" x1="${x(xv)}" y1="${top}" x2="${x(xv)}" y2="${height-bottom}"/><line class="frontier-grid" x1="${left}" y1="${y(yv)}" x2="${width-right}" y2="${y(yv)}"/>`;
            if(result.measured.length)svg+=`<text text-anchor="middle" x="${x(xv)}" y="${height-bottom+24}">${fmt(xv)}</text><text text-anchor="end" x="${left-12}" y="${y(yv)+4}">${fmt(yv)}</text>`;
        }
        svg+=`<text text-anchor="middle" x="${(width+left-right)/2}" y="${height-26}">${axisLabel(axes().x)}<tspan x="${(width+left-right)/2}" dy="16">${axisUnit(axes().x)}</tspan></text><text text-anchor="middle" transform="translate(18 ${(height+top-bottom)/2}) rotate(-90)">${axisLabel(axes().y)}<tspan x="0" dy="16">${axisUnit(axes().y)}</tspan></text>`;
        const series=M.chartSeries(result.measured,axes().x,axes().y,cohort());
        for(const rows of series){
            const point=rows[0].point;
            const frontier=configurationStudy() || M.groupKey(point)==='betterscale';
            const id=frontier?M.frontierKey(point):JSON.stringify([point.cohort_id,point.load.concurrency_series,point.load.session_rotation_depth??null]);
            svg+=`<polyline class="frontier-concurrency-line" data-line-kind="${frontier?'frontier':'concurrency'}" data-series="${escape(id)}" stroke-dasharray="${point.load.session_rotation_depth>1?'7 4':'none'}" data-series-points="${escape(JSON.stringify(rows.map(row=>row.point.id)))}" stroke="${color(point)}" points="${rows.map(row=>`${x(row.x)},${y(row.y)}`).join(' ')}"/>`;
        }
        for(const row of result.measured){
            const neighbors=result.measured.filter(other=>other!==row).map(other=>Math.hypot(x(row.x)-x(other.x),y(row.y)-y(other.y))/2);
            const hitRadius=Math.max(2,Math.min(18,...neighbors));
            const p=row.point,text=`${pointLabel(p)}${hasRotation()?` · ${rotationLabel(p.load.session_rotation_depth)}`:''}${M.failedCorrectness(p)?` · ${t('failed')}`:''}${notExercised(p)?` · ${t('notExercised')}`:''}${storeOnly(p)?` · ${t('storeOnly')}`:''} · ${parallel(p)} · ${serviceScale(p)}: ${axisLabel(axes().x)} ${fmt(row.x)}, ${axisLabel(axes().y)} ${fmt(row.y)}`;
            svg+=`<g role="button" tabindex="0" aria-haspopup="dialog" aria-controls="frontier-popover" aria-expanded="false" aria-label="${escape(text)}" data-point="${escape(p.id)}" class="frontier-point"><circle class="frontier-hit" cx="${x(row.x)}" cy="${y(row.y)}" r="${hitRadius}"/><circle class="frontier-dot" cx="${x(row.x)}" cy="${y(row.y)}" r="7" fill="${p.load.session_rotation_depth>1?'var(--run-bg)':color(p)}" style="stroke:${color(p)}"/><title>${escape(text)}</title></g>`;
        }
        $('frontier-chart').innerHTML=svg;
    }
    document.addEventListener('pointerdown',event=>{if(!event.target.closest('#frontier-model-picker'))$('frontier-model-picker')?.removeAttribute('open');if(state.selected&&!event.target.closest('#frontier-popover,[data-point]'))close();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('frontier-model-picker')?.open){event.preventDefault();$('frontier-model-picker').open=false;$('frontier-model-trigger').focus();return;}if(event.key==='Escape'&&state.selected){event.preventDefault();close(true);}});
    window.addEventListener('vllm-hust:langchange',shell);
    let resize;window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(render);});
    $('view-frontier').addEventListener('click',()=>{updateSettingURL();requestAnimationFrame(render);});
    $('frontier-contract-close').addEventListener('click',()=>$('frontier-contract-dialog').close());
    $('frontier-contract-dialog').addEventListener('click',event=>{if(event.target===$('frontier-contract-dialog'))$('frontier-contract-dialog').close();});
    $('runs-content').hidden=false;shell();
    Promise.all([
        fetch('./data/leaderboard_frontier.json?v=dense27-tp4-sweep-20261010',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Snapshot unavailable');return r.json();}).then(M.validate),
        fetch('./data/ecosystem.json?v=benchmark-settings-20260929',{cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
    ]).then(([data,catalog])=>{state.data=M.visibleData(data);const requested=M.resolveCohort(state.data.cohorts,requestedSetting);if(requested){state.cohort=requested.id;state.tag=tagKey(requested);}state.mods=null;state.mtp=null;state.rotation=null;state.catalog=new Map((catalog.components||[]).map(c=>[c.id,c]));state.ready=true;shell();updateSettingURL();})
        .catch(error=>{state.error=true;state.ready=true;shell();console.error('[Benchmark settings]',error.message);});
})();
