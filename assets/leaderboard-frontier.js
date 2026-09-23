/* Frontier is an independent, static-snapshot consumer. No benchmark execution. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id), M = window.LeaderboardFrontierModel;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const words = {
        en: {
            title: 'Find the configuration frontier.', subtitle: 'One fixed workload. Many ways to serve it. Compare measured configurations—not just MOD names.',
            model: 'Model', precision: 'Precision', workload: 'Workload', context: 'Required context', hardware: 'Hardware', mod: 'MOD combination',
            x: 'X axis', y: 'Y axis', all: 'All', none: 'No MOD', pending: 'Awaiting measurements', loading: 'Loading evidence', error: 'Snapshot unavailable',
            empty: 'The frontier starts with evidence.', emptyHint: 'The page is ready. Publish fixed-workload measurements to populate this view. No legacy results or invented points are substituted.',
            noMatch: 'No comparable points in this view.', noMatchHint: 'Change the filters or axes. Cost requires a recorded full-deployment USD/hour rate; missing metrics are not estimated.',
            failed: 'Could not load Frontier evidence.', failedHint: 'The snapshot is missing or invalid. Leaderboards and Tasks remain independent. Reload to retry.',
            interactivity: 'Interactivity', ttft_p95_ms: 'P95 TTFT', tpot_p95_ms: 'P95 TPOT', e2e_p95_ms: 'P95 end-to-end',
            output_tps: 'Output throughput', output_tps_per_chip: 'Output throughput / chip', cost_per_million: 'Cost / 1M output tokens',
            showAll: 'Show non-frontier points', points: 'Measured points', frontier: 'Frontier points', excluded: 'Missing selected metrics',
            table: 'Configurations', tableHint: 'Select a point or configuration to inspect its evidence.', configuration: 'Engine / configuration',
            concurrency: 'Concurrency', status: 'Position', onFrontier: 'On frontier', dominated: 'Dominated', detail: 'Configuration evidence', source: 'Open measurement evidence ↗',
            methodology: 'How to read this frontier', notes: 'A point is one measured deployment at one load level. The frontier contains points that are not worse on both selected axes and strictly better on at least one. Equal points are retained. Lines are visual guides, not interpolated measurements. Only the selected workload/model/precision/context cohort is compared.',
            costNote: 'Interactivity = 1000 / mean TPOT in ms, excluding prefill. USD / 1M output tokens = full deployment USD/hour × 1,000,000 / (3,600 × measured output tokens/s). Per-chip throughput is resource efficiency, not a price. No costs are inferred from chip counts.',
            contract: 'Workload contract', contractHint: 'Dataset and cache/arrival policy are fixed by the incoming workload contract. Engine, MOD combinations, parallelism and serving parameters may vary while satisfying the selected requirements.',
            direction: 'Better direction', larger: 'higher', smaller: 'lower', available: 'configurations', unknown: 'Not recorded'
        },
        zh: {
            title: '找到值得选择的推理配置。', subtitle: '固定负载，开放配置。比较实测配置的前沿，而不只是 MOD 的名字。',
            model: '模型', precision: '精度', workload: '固定 Workload', context: '所需上下文', hardware: '硬件', mod: 'MOD 组合',
            x: '横轴', y: '纵轴', all: '全部', none: '无 MOD', pending: '等待实测数据', loading: '正在读取证据', error: '快照暂不可用',
            empty: '前沿，从真实测量开始。', emptyHint: '页面已就绪，等待固定 workload 的测量数据接入。不挪用旧榜单，也不填入虚构成绩。',
            noMatch: '当前条件下没有可比较的点。', noMatchHint: '请调整筛选或坐标轴。成本需要完整部署的美元时价；缺失指标不会估算补齐。',
            failed: '暂时无法读取 Frontier 证据。', failedHint: '数据快照缺失或格式无效；不影响 Leaderboards 和 Tasks。可刷新重试。',
            interactivity: '单用户解码速度', ttft_p95_ms: 'P95 首 token 延迟', tpot_p95_ms: 'P95 TPOT', e2e_p95_ms: 'P95 端到端延迟',
            output_tps: '总输出吞吐', output_tps_per_chip: '单卡输出吞吐', cost_per_million: '每百万输出 token 成本',
            showAll: '显示非前沿点', points: '实测点', frontier: '前沿点', excluded: '缺少所选指标',
            table: '推理配置', tableHint: '点击点或配置，查看完整参数和原始证据。', configuration: 'Engine / 配置',
            concurrency: '并发', status: '位置', onFrontier: '位于前沿', dominated: '被支配', detail: '配置与证据', source: '查看测量证据 ↗',
            methodology: '如何阅读这条前沿', notes: '一个点代表某套部署在一个负载水平下的实测。若没有其他点在两项所选指标上都不差、且至少一项更好，该点就在前沿上。相等的点全部保留。连线仅为视觉引导，不代表插值配置的实测。只比较同一 workload、模型、精度和上下文要求下的配置。',
            costNote: '单用户解码速度 = 1000 ÷ 平均 TPOT（毫秒），不包含 prefill。每百万输出 token 美元成本 = 完整部署美元时价 × 1,000,000 ÷（3,600 × 实测输出 tokens/s）。单卡吞吐代表资源效率，不等于性价比；不会用卡数虚构价格。',
            contract: '固定负载口径', contractHint: '数据集、缓存与到达策略由接入的 workload 合同固定。满足所选要求的 Engine、MOD 组合、并行度和服务端参数均可参与比较。',
            direction: '更优方向', larger: '更高', smaller: '更低', available: '套配置', unknown: '未记录'
        }
    };
    const lang = () => (document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
    const t = key => words[lang()][key] || key;
    const fmt = n => n === null || n === undefined ? '—' : new Intl.NumberFormat(lang(), {maximumFractionDigits: 2}).format(n);
    const state = {data:{cohorts:[],points:[]}, catalog:new Map(), ready:false, error:false,
        model:'', precision:'', workload:'', context:'', hardware:'', mod:'', x:'interactivity', y:'output_tps_per_chip', showAll:true, selected:''};
    const colors = ['#4263eb','#008c78','#ad5c00','#965bd3','#d14469','#177baf','#6b7e16','#ba572d'];
    const modLabel = p => p.configuration.mods.length ? p.configuration.mods.map(id => state.catalog.get(id)?.name || id).join(' + ') : t('none');
    const cohortFields = ['model','precision','workload','context'];
    const fieldValue = (c,key) => key === 'context' ? String(c.context_tokens) : c[key].id;
    function selectedCohort() { return state.data.cohorts.find(c => cohortFields.every(k => fieldValue(c,k) === state[k])); }
    function cohortPoints() { return state.data.points.filter(p => p.cohort_id === selectedCohort()?.id); }
    function select(id, choices, current, emptyLabel) {
        const node = $(id);
        node.innerHTML = choices.length ? choices.map(([value,label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join('') : `<option value="">${escape(emptyLabel || t('pending'))}</option>`;
        node.disabled = !choices.length;
        node.value = choices.some(c => c[0] === current) ? current : choices[0]?.[0] || '';
        return node.value;
    }
    function renderControls() {
        let candidates = state.data.cohorts;
        for (const key of cohortFields) {
            const choices = new Map(candidates.map(c => [fieldValue(c,key),key === 'context' ? `${fmt(c.context_tokens)} tokens` : c[key].label]));
            state[key] = select(`frontier-${key}`, [...choices],state[key]);
            candidates = candidates.filter(c => fieldValue(c,key) === state[key]);
        }
        const points = cohortPoints();
        state.hardware = select('frontier-hardware', [['',t('all')], ...[...new Set(points.map(p=>p.configuration.hardware.label))].sort().map(v=>[v,v])],state.hardware);
        state.mod = select('frontier-mod', [['',t('all')], ...new Map(points.map(p=>[M.modKey(p),modLabel(p)]))],state.mod);
        const axis = keys => keys.map(k=>[k,`${t(k)} · ${M.metrics[k].unit}`]);
        select('frontier-x',axis(['interactivity','ttft_p95_ms','tpot_p95_ms','e2e_p95_ms']),state.x);
        select('frontier-y',axis(['output_tps_per_chip','output_tps','cost_per_million']),state.y);
        $('frontier-show-all').checked=state.showAll;
    }
    function shell() {
        const control = key => `<label>${t(key)}<select id="frontier-${key}"></select></label>`;
        $('frontier-panel').innerHTML = `
            <header class="frontier-heading"><div><span class="frontier-eyebrow">Measured configuration frontier</span><h1>${t('title')}</h1><p>${t('subtitle')}</p></div><span class="frontier-status" id="frontier-status" role="status"></span></header>
            <div class="frontier-card"><div class="frontier-contract">${cohortFields.map(control).join('')}</div>
                <div class="frontier-toolbar">${['x','y','hardware','mod'].map(control).join('')}<label class="frontier-checkbox"><input type="checkbox" id="frontier-show-all">${t('showAll')}</label></div>
                <div class="frontier-plot"><svg id="frontier-chart" viewBox="0 0 1000 460" role="group" aria-label="Pareto frontier"></svg><div id="frontier-blank" class="frontier-blank"><strong></strong><p></p></div></div>
                <div class="frontier-legend" id="frontier-legend"></div><div class="frontier-summary" id="frontier-summary" aria-live="polite"></div>
            </div>
            <div class="frontier-table-heading"><h2>${t('table')}</h2><span>${t('tableHint')}</span></div>
            <div class="runs-table-scroll"><table class="runs-table frontier-table"><thead><tr>${['configuration','mod','hardware','concurrency','interactivity','output_tps_per_chip','cost_per_million','status'].map(k=>`<th scope="col">${t(k)}</th>`).join('')}</tr></thead><tbody id="frontier-rows"></tbody></table></div>
            <section id="frontier-detail" class="frontier-card frontier-detail" hidden></section>
            <details class="frontier-notes"><summary>${t('contract')}</summary><p>${t('contractHint')}</p><pre id="frontier-contract-detail" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details>
            <details class="frontier-notes"><summary>${t('methodology')}</summary><p>${t('notes')}</p><p>${t('costNote')}</p><a href="https://inferencex.semianalysis.com/inference/kimi-k3" target="_blank" rel="noopener noreferrer">Inspired by InferenceX ↗</a></details>`;
        for (const key of [...cohortFields,'x','y','hardware','mod']) $(`frontier-${key}`).addEventListener('change', event=>{
            state[key]=event.target.value; state.selected='';
            if(cohortFields.includes(key)) {state.hardware='';state.mod='';}
            renderControls();render();
        });
        $('frontier-show-all').addEventListener('change',event=>{state.showAll=event.target.checked;render();});
        $('frontier-rows').addEventListener('click',choose);
        $('frontier-chart').addEventListener('click',choose);
        $('frontier-chart').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.closest('[data-point]')){event.preventDefault();choose(event);}});
        renderControls(); render();
    }
    function choose(event) {
        const id=event.target.closest('[data-point]')?.dataset.point;
        if(id){state.selected=id;render();$('frontier-detail').scrollIntoView({block:'nearest',behavior:'smooth'});}
    }
    function render() {
        const cohort=selectedCohort(), points=cohortPoints().filter(p => (!state.hardware||p.configuration.hardware.label===state.hardware)&&(!state.mod||M.modKey(p)===state.mod));
        const result=M.project(points,state.x,state.y), visible=state.showAll?result.measured:result.frontier;
        const groups=[...new Set(cohortPoints().map(M.modKey))].sort(), color=p=>colors[groups.indexOf(M.modKey(p))%colors.length];
        if(!visible.some(p=>p.point.id===state.selected))state.selected='';
        $('view-frontier-count').textContent=state.data.points.length;
        $('frontier-status').dataset.state=state.error?'error':state.ready?'ready':'loading';
        $('frontier-status').textContent=state.error?t('error'):!state.ready?t('loading'):!state.data.points.length?t('pending'):`${points.length} ${t('available')}`;
        $('frontier-summary').innerHTML=`<span>${t('points')} <strong>${result.measured.length}</strong> · ${t('frontier')} <strong>${result.frontier.length}</strong> · ${t('excluded')} <strong>${result.excluded}</strong></span><span>${t('direction')}: X ${t(M.metrics[state.x].direction==='max'?'larger':'smaller')} / Y ${t(M.metrics[state.y].direction==='max'?'larger':'smaller')}</span>`;
        $('frontier-contract-detail').textContent=cohort?JSON.stringify(cohort,null,2):'—';
        const blank=$('frontier-blank'); blank.hidden=!!result.measured.length;
        blank.querySelector('strong').textContent=t(state.error?'failed':state.data.points.length?'noMatch':'empty');
        blank.querySelector('p').textContent=t(state.error?'failedHint':state.data.points.length?'noMatchHint':'emptyHint');
        chart(result,visible,color);
        $('frontier-legend').innerHTML=[...new Map(visible.map(({point:p})=>[M.modKey(p),p])).values()].map(p=>`<span><i style="background:${color(p)}"></i>${escape(modLabel(p))}</span>`).join('');
        $('frontier-rows').innerHTML=visible.slice().sort((a,b)=>Number(b.frontier)-Number(a.frontier)||a.point.id.localeCompare(b.point.id)).map(({point:p,frontier})=>`<tr data-config-id="${escape(p.id)}" class="${p.id===state.selected?'is-selected':''}"><td><button type="button" data-point="${escape(p.id)}">${escape(p.label||p.id)}</button><small>${escape(p.configuration.engine)} · ${escape(p.configuration.engine_version)}</small></td><td>${escape(modLabel(p))}</td><td>${escape(p.configuration.hardware.label)}<small>× ${p.configuration.hardware.accelerator_count}</small></td><td>${fmt(p.load.concurrency)}</td><td>${fmt(M.value(p,'interactivity'))}</td><td>${fmt(M.value(p,'output_tps_per_chip'))}</td><td>${fmt(M.value(p,'cost_per_million'))}</td><td class="frontier-badge">${t(frontier?'onFrontier':'dominated')}</td></tr>`).join('') || `<tr><td colspan="8">${t(state.error?'failed':state.data.points.length?'noMatch':'pending')}</td></tr>`;
        const selected=visible.find(p=>p.point.id===state.selected)?.point, detail=$('frontier-detail');detail.hidden=!selected;
        if(selected)detail.innerHTML=`<h3>${t('detail')} · ${escape(selected.label||selected.id)}</h3><a href="${escape(M.safeURL(selected.evidence.url))}" target="_blank" rel="noopener noreferrer">${t('source')}</a><pre>${escape(JSON.stringify(selected,null,2))}</pre>`;
    }
    function chart(result,visible,color) {
        const width=Math.max(340,$('frontier-chart').clientWidth||1000),height=width<600?360:460,left=80,right=24,top=26,bottom=74;
        $('frontier-chart').setAttribute('viewBox',`0 0 ${width} ${height}`);
        const bounds=key=>{const values=result.measured.map(p=>p[key]);if(!values.length)return [0,1];let min=Math.min(...values),max=Math.max(...values);const pad=(max-min||Math.abs(max)||1)*.12;return [Math.max(0,min-pad),max+pad];};
        const [xmin,xmax]=bounds('x'),[ymin,ymax]=bounds('y');
        const x=v=>left+(v-xmin)/(xmax-xmin)*(width-left-right),y=v=>height-bottom-(v-ymin)/(ymax-ymin)*(height-top-bottom);
        let svg=`<title>${escape(t(state.x))} / ${escape(t(state.y))}</title>`;
        for(let i=0;i<=5;i++){const xv=xmin+(xmax-xmin)*i/5,yv=ymin+(ymax-ymin)*i/5;
            svg+=`<line class="frontier-grid" x1="${x(xv)}" y1="${top}" x2="${x(xv)}" y2="${height-bottom}"/><line class="frontier-grid" x1="${left}" y1="${y(yv)}" x2="${width-right}" y2="${y(yv)}"/>`;
            if(result.measured.length)svg+=`<text text-anchor="middle" x="${x(xv)}" y="${height-bottom+24}">${fmt(xv)}</text><text text-anchor="end" x="${left-12}" y="${y(yv)+4}">${fmt(yv)}</text>`;
        }
        svg+=`<text text-anchor="middle" x="${(width+left-right)/2}" y="${height-18}">${escape(t(state.x))}<tspan x="${(width+left-right)/2}" dy="15">${M.metrics[state.x].unit}</tspan></text><text text-anchor="middle" transform="translate(18 ${(height+top-bottom)/2}) rotate(-90)">${escape(t(state.y))}<tspan x="0" dy="15">${M.metrics[state.y].unit}</tspan></text>`;
        if(result.frontier.length>1)svg+=`<polyline class="frontier-envelope" points="${result.frontier.map(p=>`${x(p.x)},${y(p.y)}`).join(' ')}"/>`;
        for(const p of visible){const label=`${p.point.label||p.point.id}: ${t(state.x)} ${fmt(p.x)}, ${t(state.y)} ${fmt(p.y)} · ${t(p.frontier?'onFrontier':'dominated')}`;
            svg+=`<circle role="button" tabindex="0" aria-label="${escape(label)}" data-point="${escape(p.point.id)}" class="frontier-point ${state.selected===p.point.id?'is-selected':''}" cx="${x(p.x)}" cy="${y(p.y)}" r="${p.frontier?7:5}" fill="${color(p.point)}" opacity="${p.frontier?1:.35}"><title>${escape(label)}</title></circle>`;}
        $('frontier-chart').innerHTML=svg;
    }
    window.addEventListener('vllm-hust:langchange',shell);
    let resize;
    window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(render);});
    $('view-frontier').addEventListener('click',()=>requestAnimationFrame(render));
    // Keep Frontier usable even if the independent legacy snapshot loader fails.
    $('runs-content').hidden=false;
    shell();
    Promise.all([
        fetch('./data/leaderboard_frontier.json').then(r=>{if(!r.ok)throw new Error('Frontier snapshot unavailable');return r.json();}).then(M.validate),
        fetch('./data/ecosystem.json').then(r=>r.ok?r.json():{}).catch(()=>({}))
    ]).then(([data,catalog])=>{state.data=data;state.catalog=new Map((catalog.components||[]).map(c=>[c.id,c]));state.ready=true;shell();})
        .catch(error=>{state.error=true;state.ready=true;shell();console.error('[Frontier]',error.message);});
})();
