/* Fixed comparison charts. Full configuration travels with the downloaded point. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id), M = window.LeaderboardFrontierModel;
    const X = 'decode_p90_tps', Y = 'output_tps_per_chip';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const words = {
        en: {
            title: 'Frontier', subtitle: 'Decode speed × output efficiency', model: 'Model · precision', workload: 'Workload', filter: 'Filter', all: 'All', mtpOn: 'On', mtpOff: 'Off', noMatch: 'No points match this filter.',
            x: 'P90 decode speed', y: 'Output throughput / chip', native: 'Native baseline',
            smoke: '15 min smoke', formal: 'Measured configurations', hint: 'Select a point for configuration', lineHint: 'Solid: concurrency sweep · Dashed: Pareto envelope',
            loading: 'Loading measurements…', empty: 'No measurements yet.', error: 'Measurements unavailable. Reload to retry.',
            missing: 'Missing axis metrics', points: 'points', context: 'context',
            download: 'Download configuration', close: 'Close', parallel: 'Parallelism', concurrency: 'Concurrency',
            workloadRepo: 'Workload repository', curves: 'Concurrency curves', nearby: 'Nearby configurations', warmup: 'Warmup', sweWarmup: 'Separate check · fresh session KV', primers: 'Snapshot primers', pressure: 'Primers + 10/lane', capacity: 'Server limit', unknown: 'Not recorded', draft: 'MTP draft tokens', experimental: 'BetterScale experimental'
        },
        zh: {
            title: 'Frontier', subtitle: '解码速度 × 产出效率', model: '模型 · 精度', workload: 'Workload', filter: '筛选', all: '全部', mtpOn: '开启', mtpOff: '关闭', noMatch: '没有符合筛选条件的数据点。',
            x: 'P90 解码速度', y: '每卡输出吞吐', native: '原生 Baseline',
            smoke: '15 分钟 smoke', formal: '实测配置', hint: '点击数据点查看配置', lineHint: '实线：同配置并发扫描 · 虚线：Pareto 边界',
            loading: '正在读取成绩…', empty: '暂无实测成绩。', error: '暂时无法读取成绩，请刷新重试。',
            missing: '缺少坐标指标', points: '个点', context: '上下文',
            download: '下载详细配置', close: '关闭', parallel: '并行规模', concurrency: '并发数',
            workloadRepo: 'Workload 仓库', curves: '并发曲线', nearby: '附近的配置', warmup: '预热', sweWarmup: '独立校验 · 测量会话冷 KV', primers: '初始上下文填充', pressure: '初始填充 + 每路 10 次', capacity: '服务端上限', unknown: '未记录', draft: 'MTP draft token 数', experimental: 'BetterScale 实验版本'
        }
    };
    const lang = () => (document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
    const t = key => words[lang()][key];
    const fmt = n => n == null ? '—' : new Intl.NumberFormat(lang(), {maximumFractionDigits: 2}).format(n);
    const state = {data:{cohorts:[],points:[]}, catalog:new Map(), ready:false, error:false, tag:'', cohort:'', selected:'', mtp:null, mods:null};
    const colors = ['#4263eb','#008c78','#ad5c00','#965bd3','#d14469','#177baf'];
    const tagKey = c => JSON.stringify([c.model.id,c.precision.id]);
    const cohort = () => state.data.cohorts.find(c => c.id === state.cohort);
    const cohortPoints = () => state.data.points.filter(p => p.cohort_id === state.cohort);
    const points = () => cohortPoints().filter(p => state.mtp?.has(M.mtpState(p)) && state.mods?.has(M.modKey(p)));
    const label = p => p.configuration.mods.length ? p.configuration.mods.map(id => state.catalog.get(id)?.name || id).join(' + ') : t('native');
    const parallel = p => {
        const params = p.configuration.parameters;
        if (params.attention_ranks != null && params.expert_ranks != null) return `A${params.attention_ranks} / E${params.expert_ranks}`;
        return [['TP',params.tensor_parallel_size],['PP',params.pipeline_parallel_size],['DP',params.data_parallel_size],['EP',params.expert_parallel_size]]
            .filter(([key,value]) => value != null && (key === 'TP' || value > 1)).map(([key,value]) => `${key}${value}`).join(' / ') || t('unknown');
    };
    function reconcile() {
        if (!state.data.cohorts.some(c => tagKey(c) === state.tag)) state.tag = state.data.cohorts[0] ? tagKey(state.data.cohorts[0]) : '';
        const available = state.data.cohorts.filter(c => tagKey(c) === state.tag);
        if (!available.some(c => c.id === state.cohort)) state.cohort = available[0]?.id || '';
    }
    function shell() {
        reconcile();
        const tags = [...new Map(state.data.cohorts.map(c => [tagKey(c),c])).values()];
        const choices = state.data.cohorts.filter(c => tagKey(c) === state.tag);
        const mods=[...new Map(cohortPoints().map(p=>[M.modKey(p),p])).values()];
        const mtpOptions=[['on',t('mtpOn')],['off',t('mtpOff')],...(cohortPoints().some(p=>M.mtpState(p)==='unknown')?[['unknown',t('unknown')]]:[])];
        if(state.mods===null)state.mods=new Set(mods.map(M.modKey));
        if(state.mtp===null)state.mtp=new Set(mtpOptions.map(([key])=>key));
        $('frontier-panel').innerHTML = `
            <header class="frontier-heading"><div><h1>${t('title')}</h1><p>${t('subtitle')}</p></div><span id="frontier-status" class="frontier-status" role="status"></span></header>
            <div class="frontier-layout"><div class="frontier-card">
                <div class="frontier-picker">
                    <div class="frontier-identity">
                        <div class="frontier-model-tags" role="group" aria-label="${t('model')}">${tags.map(c=>`<button type="button" class="frontier-model-tag" data-model-tag="${escape(tagKey(c))}" aria-pressed="${tagKey(c)===state.tag}">${escape(c.model.label)}<span>${escape(c.precision.label)}</span></button>`).join('')}</div>
                        ${choices.length>1?`<label class="frontier-workload">${t('workload')}<select id="frontier-workload">${choices.map(c=>`<option value="${escape(c.id)}" ${c.id===state.cohort?'selected':''}>${escape(c.workload.label)} · ${fmt(c.context_tokens)} ${t('context')}</option>`).join('')}</select></label>`:choices.length?`<span id="frontier-workload-tag" class="frontier-workload-tag" aria-label="${t('workload')}">${escape(choices[0].workload.label)} · ${fmt(choices[0].context_tokens)} ${t('context')}</span>`:''}
                    </div>

                </div>
                <div class="frontier-plot" id="frontier-plot">
                    <svg id="frontier-chart" viewBox="0 0 1000 480" role="group" aria-label="${t('x')} × ${t('y')}"></svg>
                    <div id="frontier-blank" class="frontier-blank" role="status"></div>
                    <section id="frontier-popover" class="frontier-popover" role="dialog" aria-modal="false" aria-labelledby="frontier-popover-title" hidden></section>
                </div>
                <footer class="frontier-footer"><div class="frontier-legend" id="frontier-legend"></div><div class="frontier-footer-links"><a id="frontier-curves" target="_blank" rel="noopener" hidden>${t('curves')} ↗</a><a id="frontier-workload-repo" href="https://github.com/vLLM-HUST/agentx-bench" target="_blank" rel="noopener">${t('workloadRepo')} ↗</a><span id="frontier-hint">${t('hint')}</span></div></footer>
            </div>
            <aside class="frontier-filters" aria-label="${t('filter')}">
                <h2>${t('filter')}</h2>
                <fieldset><legend>MOD</legend><div class="frontier-checks">${mods.map(p=>`<label><input type="checkbox" data-filter="mods" value="${escape(M.modKey(p))}" ${state.mods.has(M.modKey(p))?'checked':''}>${escape(label(p))}</label>`).join('')}</div></fieldset>
                <fieldset><legend>MTP</legend><div class="frontier-checks">${mtpOptions.map(([key,text])=>`<label><input type="checkbox" data-filter="mtp" value="${key}" ${state.mtp.has(key)?'checked':''}>${text}</label>`).join('')}</div></fieldset>
                <span id="frontier-filter-count" role="status"></span>
            </aside></div>`;
        $('frontier-panel').querySelectorAll('[data-model-tag]').forEach(button=>button.addEventListener('click',()=>{
            state.tag=button.dataset.modelTag;state.cohort='';state.selected='';state.mtp=null;state.mods=null;shell();
        }));
        $('frontier-workload')?.addEventListener('change',event=>{state.cohort=event.target.value;state.selected='';state.mtp=null;state.mods=null;shell();});
        $('frontier-panel').querySelectorAll('[data-filter]').forEach(input=>input.addEventListener('change',()=>{
            const selected=state[input.dataset.filter];
            if(input.checked)selected.add(input.value);else selected.delete(input.value);
            state.selected='';render();
        }));
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
        const payload={schema_version:'frontier-configuration/v1',cohort:cohort(),point,
            chart:{x:X,y:Y,x_unit:M.metrics[X].unit,y_unit:M.metrics[Y].unit}};
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=`${point.id.replace(/[^a-z0-9_.-]/gi,'_')}.json`;
        document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function render() {
        const measured=M.project(points(),X,Y), current=cohort();
        $('view-frontier-count').textContent=state.data.points.length;
        const status=$('frontier-status');status.dataset.state=state.error?'error':state.ready?'ready':'loading';
        status.textContent=state.error?t('error'):!state.ready?t('loading'):current?.workload.contract.profile==='smoke'?t('smoke'):t('formal');
        const blank=$('frontier-blank');blank.hidden=measured.measured.length>0;
        blank.textContent=state.error?t('error'):!state.ready?t('loading'):cohortPoints().length?t('noMatch'):t('empty');
        $('frontier-filter-count').textContent=`${points().length} / ${cohortPoints().length} ${t('points')}`;
        const groups=[...new Map(cohortPoints().map(p=>[M.modKey(p),p])).values()].sort((a,b)=>
            Number(M.modKey(b)==='none')-Number(M.modKey(a)==='none')||M.modKey(a).localeCompare(M.modKey(b)));
        const color=p=>colors[groups.findIndex(g=>M.modKey(g)===M.modKey(p))%colors.length];
        $('frontier-legend').innerHTML=groups.filter(g=>points().some(p=>M.modKey(p)===M.modKey(g))).map(p=>`<span><i style="background:${color(p)}"></i>${escape(label(p))}</span>`).join('');
        $('frontier-hint').textContent=(M.concurrencySeries(measured.measured).length?t('lineHint'):t('hint'))+(measured.excluded?` · ${t('missing')}: ${measured.excluded}`:'');
        const curves=$('frontier-curves'), curveUrl=current?.workload.contract.concurrency_curves_url;
        curves.hidden=typeof curveUrl!=='string'||!/^\.\/assets\/[a-z0-9-]+\.svg(?:\?v=[a-z0-9-]+)?$/.test(curveUrl);
        if(!curves.hidden)curves.href=curveUrl;else curves.removeAttribute('href');
        const workloadRepo=current?.workload.contract.repository_url;
        $('frontier-workload-repo').href=typeof workloadRepo==='string'&&/^https:\/\/github\.com\/vLLM-HUST\/[a-z0-9-]+$/i.test(workloadRepo)?workloadRepo:'https://github.com/vLLM-HUST/agentx-bench';
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
            <h2 id="frontier-popover-title">${escape(label(point))}</h2>
            <p class="frontier-popup-engine">${escape(point.configuration.engine)} ${escape(point.configuration.engine_version)}${point.configuration.mods.includes('betterscale')?`<br>${t('experimental')}`:''}</p>
            <p class="frontier-popup-subtitle">${escape(point.configuration.hardware.label)} × ${point.configuration.hardware.accelerator_count} · ${escape(parallel(point))}</p>
            <div class="frontier-popup-metrics"><div><strong>${fmt(M.value(point,X))}</strong><span>${t('x')}<br>tokens/s/user</span></div><div><strong>${fmt(M.value(point,Y))}</strong><span>${t('y')}<br>tokens/s/chip</span></div></div>
            <p class="frontier-popup-load">${t('concurrency')}: ${fmt(point.load.concurrency)}${params.mtp_draft_tokens!=null?` · MTP${params.mtp_draft_tokens}`:''}${params.max_num_seqs!=null?`<br>${t('capacity')}: ${fmt(params.max_num_seqs)}${params.max_num_seqs_per_rank!=null?' / rank':''}`:''}${params.kv_cache_memory_bytes!=null?` · KV ${fmt(params.kv_cache_memory_bytes/1024**3)} GiB/chip`:''}</p>
            <p class="frontier-popup-load">${t('warmup')}: ${t(warmupKey)}</p>
            ${nearby.length>1?`<div class="frontier-nearby"><span>${t('nearby')}</span>${nearby.map(p=>`<button type="button" data-nearby="${escape(p.id)}" aria-pressed="${p.id===point.id}">${escape(parallel(p))} · C${fmt(p.load.concurrency)} · MTP${p.configuration.parameters.mtp_draft_tokens??'—'} · ${fmt(p.configuration.parameters.max_num_seqs)}</button>`).join('')}</div>`:''}
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
        let svg=`<title>${t('x')} / ${t('y')}</title>`;
        for(let i=0;i<=4;i++){
            const xv=xmin+(xmax-xmin)*i/4,yv=ymin+(ymax-ymin)*i/4;
            svg+=`<line class="frontier-grid" x1="${x(xv)}" y1="${top}" x2="${x(xv)}" y2="${height-bottom}"/><line class="frontier-grid" x1="${left}" y1="${y(yv)}" x2="${width-right}" y2="${y(yv)}"/>`;
            if(result.measured.length)svg+=`<text text-anchor="middle" x="${x(xv)}" y="${height-bottom+24}">${fmt(xv)}</text><text text-anchor="end" x="${left-12}" y="${y(yv)+4}">${fmt(yv)}</text>`;
        }
        svg+=`<text text-anchor="middle" x="${(width+left-right)/2}" y="${height-26}">${t('x')}<tspan x="${(width+left-right)/2}" dy="16">output tokens/s/user</tspan></text><text text-anchor="middle" transform="translate(18 ${(height+top-bottom)/2}) rotate(-90)">${t('y')}<tspan x="0" dy="16">output tokens/s/chip</tspan></text>`;
        if(result.frontier.length>1)svg+=`<polyline class="frontier-envelope" points="${result.frontier.map(p=>`${x(p.x)},${y(p.y)}`).join(' ')}"/>`;
        const series=M.concurrencySeries(result.measured), connected=new Set(series.flat().map(row=>row.point.id));
        for(const rows of series){
            const id=rows[0].point.load.concurrency_series;
            svg+=`<polyline class="frontier-concurrency-line" data-series="${escape(id)}" data-series-points="${escape(JSON.stringify(rows.map(row=>row.point.id)))}" stroke="${color(rows[0].point)}" points="${rows.map(row=>`${x(row.x)},${y(row.y)}`).join(' ')}"/>`;
        }
        for(const row of result.measured){
            const neighbors=result.measured.filter(other=>other!==row).map(other=>Math.hypot(x(row.x)-x(other.x),y(row.y)-y(other.y))/2);
            const hitRadius=Math.max(2,Math.min(18,...neighbors));
            const p=row.point,text=`${label(p)} · ${parallel(p)} · C${p.load.concurrency??'—'}: ${t('x')} ${fmt(row.x)}, ${t('y')} ${fmt(row.y)}`;
            svg+=`<g role="button" tabindex="0" aria-haspopup="dialog" aria-controls="frontier-popover" aria-expanded="false" aria-label="${escape(text)}" data-point="${escape(p.id)}" class="frontier-point"><circle class="frontier-hit" cx="${x(row.x)}" cy="${y(row.y)}" r="${hitRadius}"/><circle class="frontier-dot" cx="${x(row.x)}" cy="${y(row.y)}" r="7" fill="${color(p)}"/><title>${escape(text)}</title></g>`;
        }
        for(const row of result.measured.filter(row=>connected.has(row.point.id))){
            svg+=`<text class="frontier-concurrency-label" style="fill:${color(row.point)}" x="${x(row.x)+9}" y="${y(row.y)-10}">C${row.point.load.concurrency}</text>`;
        }
        $('frontier-chart').innerHTML=svg;
    }
    document.addEventListener('pointerdown',event=>{if(state.selected&&!event.target.closest('#frontier-popover,[data-point]'))close();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.selected){event.preventDefault();close(true);}});
    window.addEventListener('vllm-hust:langchange',shell);
    let resize;window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(render);});
    $('view-frontier').addEventListener('click',()=>requestAnimationFrame(render));
    $('runs-content').hidden=false;shell();
    Promise.all([
        fetch('./data/leaderboard_frontier.json?v=sweprefix-curves-20260924-3',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Snapshot unavailable');return r.json();}).then(M.validate),
        fetch('./data/ecosystem.json').then(r=>r.ok?r.json():{}).catch(()=>({}))
    ]).then(([data,catalog])=>{state.data=data;state.mods=null;state.mtp=null;state.catalog=new Map((catalog.components||[]).map(c=>[c.id,c]));state.ready=true;shell();})
        .catch(error=>{state.error=true;state.ready=true;shell();console.error('[Frontier]',error.message);});
})();
