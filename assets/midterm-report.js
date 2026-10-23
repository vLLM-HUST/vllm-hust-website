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
    let publicationCommit;
    let failed = false;
    const datasetEvidence = new Set([
        'website-publication/data/hle-verified-20261015/report.json',
        'website-publication/data/frontierscience-20261013/report.json',
        'website-publication/data/mmlu-pro-20261012/report.json',
        'website-publication/data/dataset-matrix-campaign-20261016/report.json',
        'website-publication/data/betterscale-school-runtime-20261016/report.json',
        'reports/frontierscience-combination-quality-20261022/summary.json',
        'reports/native-version-recovery-20261022/version-mapping.json',
        'reports/mmlu-quality018-20261022/quality018-completed-audit-r1.json',
        ...['mmlu-pro', 'frontierscience', 'hle-gold', 'hle-revision'].map(name =>
            `website-publication/data/request-throttling-dataset-matrix-20261018/${name}.json`)
    ]);
    const rowSources = (section, tableIndex) => {
        if (section.id === 'candidates') return section.evidence;
        if (section.id === 'dataset-quality-inventory') {
            const indices = [[0, 0, 1, 1], [2, 4, 3, 3, 5, 5], [4, 4, 4, 4], [7, 8, 6, 6], [9, 9], [11, 11, 11, 11]];
            return indices[tableIndex].map(index => section.evidence[index]);
        }
        return [section.evidence[0]];
    };
    const sourceUrl = source => `https://github.com/vLLM-HUST/vllm-hust-benchmark/${source.kind}/${publicationCommit}/${source.path.split('/').map(encodeURIComponent).join('/')}`;
    function render() {
        const zh = window.vllmHustSite?.getCurrentLang() === 'zh';
        const title = zh ? '中期实测报告' : 'Midterm measurements';
        if (!data) {
            panel.innerHTML = `<h2>${title}</h2><p role="status">${failed
                ? (zh ? '报告摘要加载失败，请重试。' : 'Report summary unavailable. Please retry.')
                : (zh ? '加载报告摘要…' : 'Loading report summary…')}</p>`;
            return;
        }
        const table = (item, sources = []) => `<div class="measurement-table-scroll" tabindex="0" role="region" aria-label="${escape(item.headers.join(' / '))}"><table><thead><tr>${item.headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${item.rows.map((row, index) => {
            const source = sources[index] || sources[0];
            const cellText = cell => source ? `<a class="raw-evidence" href="${escape(sourceUrl(source))}" title="${zh ? '查看对应原始测试数据' : 'Open original test evidence'}">${escape(cell)}</a>` : escape(cell);
            return `<tr>${row.map((cell, i) => i === 0 ? `<th scope="row">${cellText(cell)}</th>` : `<td>${cellText(cell)}</td>`).join('')}</tr>`;
        }).join('')}</tbody></table></div>`;
        panel.innerHTML = `<h2>${title} ${escape(data.version)}</h2>
            <p>${zh ? 'B0 固定为 vLLM 0.18 + vLLM-Ascend 0.18。B1 为当前最佳实测优化配置，基座版本不限，实际版本逐项标明。其他版本 Native 是版本对照，不是 B0。' : 'B0 is fixed at vLLM 0.18 + vLLM-Ascend 0.18. B1 is the best measured optimized configuration, with no base-version restriction and actual versions explicitly identified. Other-version Native runs are controls, not B0.'}</p>
            <p><a href="${escape(data.report_url)}">${zh ? `阅读完整 ${escape(data.version)} 报告` : `Read the complete ${escape(data.version)} report`}</a></p>
            <nav aria-label="${title}">${data.sections.map(s => `<a href="#midterm-${escape(s.id)}">${escape(s.title.split(' / ')[zh ? 0 : 1])}</a>`).join(' · ')}</nav>
            <aside id="midterm-kv-audit" class="midterm-audit"><h3>${zh ? 'KV 结果：跨轮状态复用核查未闭合' : 'KV results: cross-run state reuse review remains open'}</h3>
            <p>${escape(data.kv_audit.scope)}</p>
            ${table({ headers: ['运行', '请求 / 独立盐', '前缀命中日志数', '最大已记录命中率'], rows: data.kv_audit.runs.map(r => [r.run_id, `${r.requests} / ${r.unique_salts}`, r.prefix_hit_samples, `${r.max_logged_prefix_hit_percent}%`]) }, data.sections.find(s => s.id === 'candidates').evidence.slice(4, 6))}</aside>
            ${data.sections.map(s => `<section id="midterm-${escape(s.id)}"><h3>${escape(s.title.split(' / ')[zh ? 0 : 1])}</h3><p>${escape(s.scope)}</p><p class="midterm-evidence">${zh ? '原始记录 / 校验索引' : 'Original records / checksum index'}: ${s.evidence.map(e => `<a href="${escape(sourceUrl(e))}">${escape(e.label)}</a>`).join(' · ')}</p>${s.tables.map((t, index) => table(t, rowSources(s, index))).join('')}<p class="midterm-caption">${escape(s.source_heading)} · <a href="${escape(data.report_url)}">${zh ? '报告证据与完整说明' : 'Evidence and full scope'}</a></p></section>`).join('')}`;
        panel.dataset.loaded = data.version;
    }
    window.addEventListener('vllm-hust:langchange', render);
    render();
    Promise.all(['./data/midterm-v071.json', './data/benchmark-source-manifest.json'].map(url =>
        fetch(url, { cache: 'no-cache' }).then(response => { if (!response.ok) throw Error('Report unavailable'); return response.json(); })))
        .then(([value, manifest]) => {
            if (manifest.repository !== 'vLLM-HUST/vllm-hust-benchmark' || manifest.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(manifest.commit)) throw Error('Invalid publication');
            publicationCommit = manifest.commit;
            if (value.schema !== 'midterm-publication/v1' || value.version !== 'V0.71' ||
                !/^https:\/\/github\.com\/vLLM-HUST\/vllm-hust-benchmark\/blob\/[a-f0-9]{40}\//.test(value.report_url)) throw Error('Invalid report source');
            for (const section of value.sections) {
                if (!section.evidence?.length) throw Error('Missing original evidence');
                for (const source of section.evidence) {
                    const allowedPath = /^reports\/vllm-hust-midterm-20261019(?:\/|$)/.test(source.path) || (source.kind === 'blob' && datasetEvidence.has(source.path));
                    if (!['tree', 'blob'].includes(source.kind) || !allowedPath || source.path.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Invalid evidence locator');
                }
            }
            // Adjacent source tables can retain Markdown separators in a row.
            for (const section of value.sections) for (const table of section.tables) {
                table.rows = table.rows.filter(row => !row.every(cell => /^:?-+:?$/.test(cell.trim())));
            }
            data = value; render();
        })
        .catch(() => { failed = true; render(); });
})();
