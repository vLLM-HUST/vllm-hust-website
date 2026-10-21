(() => {
    'use strict';
    const main = document.querySelector('main');
    if (!main) return;
    const panel = document.createElement('section');
    panel.id = 'midterm-report';
    panel.className = 'current-measurements midterm-report';
    const summary = main.querySelector('.current-measurements');
    if (summary) summary.after(panel); else main.prepend(panel);
    const escape = value => String(value).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    let data;
    let failed = false;
    function render() {
        const zh = window.vllmHustSite?.getCurrentLang() === 'zh';
        const title = zh ? '中期实测报告' : 'Midterm measurements';
        if (!data) {
            panel.innerHTML = `<h2>${title}</h2><p role="status">${failed
                ? (zh ? '报告摘要加载失败，请重试。' : 'Report summary unavailable. Please retry.')
                : (zh ? '加载报告摘要…' : 'Loading report summary…')}</p>`;
            return;
        }
        const table = item => `<div class="measurement-table-scroll" tabindex="0" role="region" aria-label="${escape(item.headers.join(' / '))}"><table><thead><tr>${item.headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${item.rows.map(row => `<tr>${row.map((cell, i) => i === 0 ? `<th scope="row">${escape(cell)}</th>` : `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        panel.innerHTML = `<h2>${title} ${escape(data.version)}</h2>
            <p>${zh ? '下列数值与口径来自中文报告；核心B0/B1在上方，完整候选及验收边界在下方。' : 'Values and scope below retain the Chinese source report wording. Core B0/B1 metrics appear above; candidates and qualification limits follow.'}</p>
            <p><a href="${escape(data.report_url)}">${zh ? `阅读完整 ${escape(data.version)} 报告` : `Read the complete ${escape(data.version)} report`}</a></p>
            <nav aria-label="${title}">${data.sections.map(s => `<a href="#midterm-${escape(s.id)}">${escape(s.title.split(' / ')[zh ? 0 : 1])}</a>`).join(' · ')}</nav>
            <aside id="midterm-kv-audit" class="midterm-audit"><h3>${zh ? 'KV 结果：跨轮状态复用核查未闭合' : 'KV results: cross-run state reuse review remains open'}</h3>
            <p>${escape(data.kv_audit.scope)}</p>
            ${table({ headers: ['运行', '请求 / 独立盐', '前缀命中日志数', '最大已记录命中率'], rows: data.kv_audit.runs.map(r => [r.run_id, `${r.requests} / ${r.unique_salts}`, r.prefix_hit_samples, `${r.max_logged_prefix_hit_percent}%`]) })}</aside>
            ${data.sections.map(s => `<section id="midterm-${escape(s.id)}"><h3>${escape(s.title.split(' / ')[zh ? 0 : 1])}</h3><p>${escape(s.scope)}</p>${s.tables.map(table).join('')}<p class="midterm-caption">${escape(s.source_heading)} · <a href="${escape(data.report_url)}">${zh ? '报告证据与完整说明' : 'Evidence and full scope'}</a></p></section>`).join('')}`;
        panel.dataset.loaded = data.version;
    }
    window.addEventListener('vllm-hust:langchange', render);
    render();
    fetch('./data/midterm-v052.json', { cache: 'no-cache' })
        .then(response => { if (!response.ok) throw Error('Report unavailable'); return response.json(); })
        .then(value => {
            if (value.schema !== 'midterm-publication/v1' || value.version !== 'V0.52' ||
                !/^https:\/\/github\.com\/vLLM-HUST\/vllm-hust-benchmark\/blob\/[a-f0-9]{40}\//.test(value.report_url)) throw Error('Invalid report source');
            // Adjacent source tables can retain Markdown separators in a row.
            for (const section of value.sections) for (const table of section.tables) {
                table.rows = table.rows.filter(row => !row.every(cell => /^:?-+:?$/.test(cell.trim())));
            }
            data = value; render();
        })
        .catch(() => { failed = true; render(); });
})();
