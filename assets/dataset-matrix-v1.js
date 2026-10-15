/* Dataset quality overview -> measured per-solution load tests. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const t = (zh, en) => document.documentElement.lang === 'zh' ? zh : en;
    const fmt = (value, digits = 2) => Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
    let data;
    const sorts = new Map(), selected = new Map(), expanded = new Set();
    const dataset = () => data.datasets.find(d => `#${d.id}` === location.hash);
    const quality = s => s ? `<strong>${fmt(s.value * 100)}%</strong><small>${fmt(s.correct, 0)} / ${fmt(s.total, 0)}</small>` : `<span class="matrix-missing">—<small>${t('尚未测量', 'Not measured')}</small></span>`;
    const metricLabel = key => ({ accuracy: t('准确率', 'Accuracy'), success: t('成功率', 'Success rate'), score7: t('得分 ≥ 7 的比例', 'Score ≥ 7 rate') })[key];
    const names = () => Object.fromEntries(data.solutions.map(s => [s.id, s.name]));
    const scope = key => ({ 'test-200': t('Test · 200 条压测请求', 'Test · 200 load-test requests'),
        'full-160': t('全量 · 160 条压测请求（两个分项合并）', 'Full · 160 load-test requests (both tracks)'),
        'gold-text': 'Gold · text', 'gold-image': 'Gold · image', 'revision-text': 'Revision · text', 'revision-image': 'Revision · image' })[key];
    function header(label, key, view) {
        const sort = sorts.get(view);
        return `<th scope="col" ${key ? `aria-sort="${sort?.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}"` : ''}>${key ? `<div class="column-heading"><button type="button" class="column-title" data-sort="${key}">${label}<span aria-hidden="true">${sort?.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></div>` : label}</th>`;
    }
    function overview() {
        const rows = data.datasets.flatMap(d => d.parts.map(p => ({ dataset: d, part: p,
            metrics: Object.fromEntries(data.solutions.map(s => [s.id, p.scores[s.id]?.value ?? null])) })));
        const ordered = LeaderboardRunsModel.selectRows(rows, {}, sorts.get('overview'));
        return `<div class="runs-table-scroll" tabindex="0" role="region" aria-label="${t('数据集成绩矩阵', 'Dataset quality matrix')}"><table class="runs-table matrix-overview"><caption class="matrix-sr">${t('按数据集对照各方案成绩；点击数据集查看性能', 'Quality by dataset and solution; select a dataset for performance')}</caption><thead><tr>${header(t('数据集 / 分项', 'Dataset / split'))}${data.solutions.map(s => header(escape(s.name), s.id, 'overview')).join('')}</tr></thead><tbody>${ordered.map(({ dataset: d, part: p }) => `<tr class="run-row"><th scope="row"><a class="matrix-dataset" href="#${d.id}">${escape(d.name)} <span aria-hidden="true">↗</span></a><small>${escape(p.name)} · ${metricLabel(p.metric)}</small></th>${data.solutions.map(s => `<td class="metric">${quality(p.scores[s.id])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    function evidence(row) {
        return `<tr class="run-detail" id="evidence-${row.id}" ${expanded.has(row.id) ? '' : 'hidden'}><td colspan="7"><div class="run-detail-head"><strong>${escape(names()[row.solution])} · ${escape(scope(row.scope))}</strong><div><a href="./${row.report}" target="_blank" rel="noopener">${t('原始报告 ↗', 'Source report ↗')}</a><button class="run-toggle" type="button" data-download="${row.id}">${t('下载此记录 ↓', 'Download record ↓')}</button></div></div><div class="run-config-grid">${[[t('运行配置', 'Runtime configuration'), row.configuration], [t('评测与压测协议', 'Evaluation and load-test protocol'), row.protocol], [t('评分审计与适用范围', 'Scoring audit and scope'), { quality: row.quality, limitations: row.limitations }]].map(([title, value]) => `<section><h4>${title}</h4><pre>${escape(JSON.stringify(value, null, 2))}</pre></section>`).join('')}</div></td></tr>`;
    }
    function detail(d) {
        const choices = selected.get(d.id) || data.solutions.map(s => s.id);
        const rows = data.records.filter(r => r.dataset === d.id).map(r => ({ ...r,
            metrics: { throughput: r.performance.output_throughput, ttft: r.performance.mean_ttft_ms / 1000, tpot: r.performance.mean_tpot_ms } }));
        const ordered = LeaderboardRunsModel.selectRows(rows.filter(r => choices.includes(r.solution)), {}, sorts.get(d.id));
        return `<div class="matrix-tools"><fieldset><legend>${t('方案', 'Solutions')}</legend>${data.solutions.map(s => `<label><input type="checkbox" data-solution="${s.id}" ${choices.includes(s.id) ? 'checked' : ''}>${escape(s.name)}</label>`).join('')}</fieldset><button class="run-toggle" type="button" id="matrix-reset">${t('重置排序与筛选', 'Reset sorting & filters')}</button></div><div class="runs-table-scroll" tabindex="0" role="region" aria-label="${escape(d.name)} ${t('性能对照', 'performance comparison')}"><table class="runs-table matrix-detail"><caption class="matrix-sr">${escape(d.name)} · ${t('每项性能来自独立压测，不是答题阶段延迟', 'Performance from separate load tests, not evaluation latency')}</caption><thead><tr>${header(t('方案', 'Solution'))}${header(t('评测成绩', 'Quality'))}${header(t('压测范围', 'Load-test scope'))}${header(t('输出 tok/s', 'Output tok/s'), 'throughput', d.id)}${header(t('平均 TTFT · s', 'Mean TTFT · s'), 'ttft', d.id)}${header(t('平均 TPOT · ms', 'Mean TPOT · ms'), 'tpot', d.id)}${header(t('配置与来源', 'Configuration & source'))}</tr></thead><tbody>${ordered.map(r => `<tr class="run-row"><th scope="row">${escape(names()[r.solution])}<small>${r.solution === 'betterscale' ? '2026-10-15' : r.dataset === 'mmlu-pro' ? '2026-10-12' : r.dataset === 'frontierscience' ? '2026-10-13' : '2026-10-14/15'}</small></th><td class="metric">${r.quality.map(q => `<div class="matrix-score"><small>${escape(q.label)}</small>${quality(q)}${q.label === 'Research' ? `<small>${t('得分 ≥ 7', 'Score ≥ 7')}</small>` : ''}</div>`).join('')}</td><td>${escape(scope(r.scope))}<small>${r.performance.completed}/${r.performance.completed + r.performance.failed} ${t('请求完成', 'completed')}</small></td>${['throughput', 'ttft', 'tpot'].map(k => `<td class="metric" data-metric="${k}">${fmt(r.metrics[k])}</td>`).join('')}<td><button type="button" class="run-toggle" data-expand="${r.id}" aria-expanded="${expanded.has(r.id)}" aria-controls="evidence-${r.id}">${expanded.has(r.id) ? t('收起', 'Close') : t('展开', 'Inspect')}</button></td></tr>${evidence(r)}`).join('')}${!ordered.length ? `<tr><td colspan="7">${t('所选方案暂无实测记录。', 'No measurements for the selected solutions.')}</td></tr>` : ''}</tbody></table></div>${d.id === 'hle-verified' ? `<p class="runs-note">${t('Gold / Revision 的 text 与 image 分别压测，未合成吞吐。BetterScale 的未决判分分别为 20 / 27 条，保留在总分母中。', 'Gold / Revision text and image were load-tested separately; no pooled throughput is reported. BetterScale has 20 / 27 unresolved judges, retained in the overall denominators.')}</p>` : ''}`;
    }
    function render() {
        if (!data) return;
        const d = dataset(), c = data.cohort;
        $('matrix-title').textContent = t('数据集矩阵 v1', 'Dataset matrix v1');
        $('matrix-subtitle').textContent = t('先看任务成绩，再看每个数据集上的服务性能。', 'Task quality first. Serving performance, one dataset at a time.');
        $('matrix-cohort').textContent = `${c.model} · ${c.precision} · ${c.hardware} · ${c.parallel}`;
        $('matrix-breadcrumb').innerHTML = d ? `<a href="#overview">← ${t('全部数据集', 'All datasets')}</a><span>/</span><strong>${escape(d.name)}</strong>` : `<strong>${t('全部数据集', 'All datasets')}</strong><span>${t('点击行标题查看性能 →', 'Select a dataset to inspect performance →')}</span>`;
        $('matrix-table').innerHTML = d ? detail(d) : overview();
        $('matrix-note').textContent = t('准确率与性能分开测试；各方案运行配置不同，单次实测，不作为单变量 A/B。', 'Quality and performance are measured separately. Configurations differ; these single-run observations are not a controlled A/B.');
        $('matrix-method-label').textContent = t('评测口径与数据来源', 'Methods & data sources');
        $('matrix-methods').innerHTML = `<p>${t('MMLU-Pro 为全量 Test 准确率；FrontierScience 的 Research 为得分 ≥ 7 的比例。FrontierScience 与 HLE 使用同一 Qwen 模型作评审，不等同于官方榜单；未能判分的题目保留在分母中。', 'MMLU-Pro reports full-test accuracy; FrontierScience Research reports the score ≥ 7 rate. FrontierScience and HLE use the same Qwen model as judge, not official leaderboard judges; unresolved cases remain in the denominator.')}</p><p>${t('性能列均为独立压测的输出吞吐与请求平均延迟，不是 SLO goodput；输出上限 256、请求到达率 inf。FrontierScience 的两个分项共用一次 160 条请求的压测。HLE 按模态分测，Uncertain 未测。', 'Performance columns show output throughput and request-mean latency from separate load tests, not SLO goodput; output cap 256, request rate inf. Both FrontierScience tracks share one 160-request load test. HLE is tested by modality; Uncertain is not evaluated.')}</p><a href="./data/dataset-matrix-v1.json" download>${t('下载矩阵与来源绑定 JSON', 'Download matrix & source bindings')}</a> · <a href="${data.betterscale_publication.url}">${t('BetterScale 公开实测报告', 'BetterScale public report')}</a> · <a href="./dataset-validation.html">${t('原数据集页面', 'Original dataset page')}</a>`;
        document.title = `${d ? d.name + ' · ' : ''}${t('数据集矩阵 v1', 'Dataset matrix v1')} - vLLM-HUST`;
    }
    $('matrix-table').addEventListener('click', event => {
        const sort = event.target.closest('[data-sort]');
        if (sort) {
            const view = dataset()?.id || 'overview', previous = sorts.get(view), key = sort.dataset.sort;
            sorts.set(view, { key, direction: previous?.key === key && previous.direction === 'asc' ? 'desc' : 'asc' });
            render(); document.querySelector(`[data-sort="${key}"]`).focus({ preventScroll: true });
        }
        if (event.target.closest('#matrix-reset')) { const id = dataset().id; sorts.delete(id); selected.delete(id); render(); }
        const expand = event.target.closest('[data-expand]');
        if (expand) {
            const id = expand.dataset.expand;
            expanded.has(id) ? expanded.delete(id) : expanded.add(id);
            $(`evidence-${id}`).hidden = !expanded.has(id);
            expand.setAttribute('aria-expanded', String(expanded.has(id)));
            expand.textContent = expanded.has(id) ? t('收起', 'Close') : t('展开', 'Inspect');
        }
        const download = event.target.closest('[data-download]');
        if (download) {
            const record = data.records.find(r => r.id === download.dataset.download);
            const url = URL.createObjectURL(new Blob([JSON.stringify({ cohort: data.cohort, record, source_files_sha256: data.source_files_sha256, formal_acceptance: false }, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = `${record.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    });
    $('matrix-table').addEventListener('change', event => {
        if (!event.target.matches('[data-solution]')) return;
        selected.set(dataset().id, [...document.querySelectorAll('[data-solution]:checked')].map(el => el.dataset.solution));
        const id = event.target.dataset.solution; render(); document.querySelector(`[data-solution="${id}"]`).focus({ preventScroll: true });
    });
    window.addEventListener('hashchange', () => { render(); $('matrix-breadcrumb').focus({ preventScroll: true }); });
    window.addEventListener('vllm-hust:langchange', render);
    fetch('./data/dataset-matrix-v1.json?v=20261015-hle-2', { cache: 'no-cache' }).then(response => { if (!response.ok) throw new Error('Snapshot unavailable'); return response.json(); }).then(snapshot => { data = snapshot; $('matrix-loading').hidden = true; $('matrix-content').hidden = false; render(); }).catch(() => { $('matrix-loading').textContent = t('数据暂时无法加载，请刷新重试。', 'Data could not be loaded. Please refresh to retry.'); });
})();
