/* Review-only controller. The legacy leaderboard and its publication data stay untouched. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const words = {
        en: {
            readingNotes: 'About these measurements', ascending: '↑ Sort ascending', descending: '↓ Sort descending', searchValues: 'Search values', selectAll: 'Select visible', selectNone: 'Deselect visible', clearColumn: 'Clear filter', cancel: 'Cancel', apply: 'Apply', noValues: 'No matching values', filterColumn: 'Filter', filtered: 'filtered',
            title: 'One workload. Every run.', lede: 'Model × parallel configuration → task → MOD. Real measurements, with the configuration beside each run.',
            review: 'REVIEW PREVIEW', old: 'Existing leaderboard ↗', model: 'Model / parallel', task: 'Task tag', mod: 'MOD',
            all: 'All', native: 'Native', current: 'Current publication', historical: 'Historical evidence', records: 'Records',
            hardware: 'Hardware', unknown: 'Not recorded', results: 'Measurements', tasks: 'Task definitions',
            taskHint: 'A tag identifies the recorded workload contract, not a server implementation. Click a tag to inspect its definition.',
            hint: 'TTFT / TPOT are request means in ms; P95 is per run. No SLO thresholds. Missing measurements stay blank (—). Repeats are separate rows, not best-run selections.',
            historyHint: 'Historical rows are retained evidence, not newly verified targets. Different run prefixes need not be a controlled comparison.',
            config: 'Run configuration', open: 'Expand', close: 'Collapse', raw: 'Raw result ↗', manifest: 'Repeat evidence ↗',
            source: 'Source ↗', empty: 'No runs match these filters.', reset: 'Reset', previous: 'Previous', next: 'Next',
            rows: 'rows', runs: 'runs / records', tags: 'task tags', observed: 'sealed individual repeats',
            dataset: 'Dataset / sampler', input: 'Input tokens', output: 'Output tokens', concurrency: 'Concurrency / batch',
            rate: 'Request rate', count: 'Requests / iterations', parameters: 'Full sampling parameters', variable: 'Variable',
            server: 'Effective server parameters', client: 'Recorded client parameters', provenance: 'Provenance',
            repeat: 'Repeat', batch: 'Batch latency (ms)', aggregate: 'Aggregate only', aggregateHint: 'Individual repeat evidence unavailable here; no pooled P95 is claimed.',
            loading: 'Loading published evidence…', error: 'Could not load the published snapshot. Reload to retry.',
            supplementMissing: 'Per-run evidence supplement unavailable; showing original published records without inventing repeats or P95.',
            snapshot: 'Published snapshot', throughput: 'Throughput (tok/s)', prefix: 'Run prefix', scope: 'Evidence scope',
            throughputHint: 'Output tokens/s where declared. Legacy token-count basis may be unspecified; inspect run configuration.',
            legacyLength: 'Variable; recorded summary', reviewNote: 'Independent review entry. The existing leaderboard and benchmark artifacts are unchanged.'
        },
        zh: {
            readingNotes: '数据口径说明', ascending: '↑ 升序排列', descending: '↓ 降序排列', searchValues: '搜索选项', selectAll: '勾选可见项', selectNone: '取消可见项', clearColumn: '清除此列筛选', cancel: '取消', apply: '应用', noValues: '没有匹配的选项', filterColumn: '筛选', filtered: '已筛选',
            title: '同一任务，看清每一次运行。', lede: '模型 × 并行配置 → 任务 → MOD。实测成绩与每次运行的配置，放在同一张表里。',
            review: '评审预览', old: '现有排行榜 ↗', model: '模型 / 并行配置', task: '任务 tag', mod: 'MOD',
            all: '全部', native: '原生', current: '当前发布', historical: '历史证据', records: '记录范围',
            hardware: '硬件', unknown: '未记录', results: '成绩主表', tasks: '任务定义表',
            taskHint: 'tag 标识已记录的负载口径，不包含服务端实现。点击 tag 可查看任务定义。',
            hint: 'TTFT / TPOT 为请求均值，单位 ms；P95 按单次 run 展示，不设 SLO 门槛。未测量保留 —，重复运行逐条保留，不挑最好的一次。',
            historyHint: '历史记录是保留证据，不是重新核验的官方目标。不同 run prefix 的成绩不自动构成控制变量对照。',
            config: 'Run 配置', open: '展开', close: '收起', raw: '原始结果 ↗', manifest: '重复运行证据 ↗',
            source: '来源 ↗', empty: '没有符合当前筛选条件的运行。', reset: '重置', previous: '上一页', next: '下一页',
            rows: '条', runs: '次运行 / 记录', tags: '个任务 tag', observed: '条原始重复成绩',
            dataset: '数据集 / 采样器', input: '输入 token', output: '输出 token', concurrency: '并发 / batch',
            rate: '请求速率', count: '请求数 / 迭代数', parameters: '完整采样参数', variable: '变长',
            server: '实际服务端参数', client: '已记录的客户端参数', provenance: '来源与版本',
            repeat: '重复', batch: '批次延迟（ms）', aggregate: '仅有汇总值', aggregateHint: '此处没有单次重复证据，不宣称整体 P95。',
            loading: '正在读取已发布证据……', error: '无法读取已发布快照，请刷新重试。',
            supplementMissing: '逐 run 补充证据暂不可用；保留原发布记录，不补造重复运行或 P95。',
            snapshot: '发布快照', throughput: '吞吐（tok/s）', prefix: 'Run prefix', scope: '证据范围',
            throughputHint: '已明确声明时为输出 tokens/s；旧记录可能未说明 token 统计范围，请查看 run 配置。',
            legacyLength: '变长；记录摘要', reviewNote: '独立评审入口，现有排行榜及 benchmark 原始工件保持不变。'
        }
    };
    const lang = () => (document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
    const t = key => words[lang()][key] || key;
    const fmt = value => value === null || value === undefined ? '—' : new Intl.NumberFormat(lang(), { maximumFractionDigits: 2 }).format(value);
    const state = { rows: [], tasks: [], page: 0, expanded: new Set(), selectedTask: '', ready: false,
        view: 'runs', columnFilters: {}, sort: null,
        filters: { source: '' }, missingSupplement: false };
    const pageSize = 40;
    const link = (url, label) => url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>` : '';
    const columns = [
        ['model', () => t('model')], ['hardware', () => t('hardware')], ['task', () => t('task')], ['mod', () => t('mod')],
        ['ttft', () => 'TTFT', 'mean · ms'], ['tpot', () => 'TPOT', 'mean · ms'],
        ['ttftP95', () => 'TTFT P95', 'ms'], ['tpotP95', () => 'TPOT P95', 'ms'],
        ['throughput', () => t('throughput')], ['run', () => 'Run'], ['config', () => t('config')]
    ];
    const model = window.LeaderboardRunsModel;
    let menu = null;
    function filteredRows() { return model.selectRows(state.rows.filter(matches), state.columnFilters, state.sort); }
    function setView(view) {
        state.view = view;
        for (const name of ['runs', 'tasks']) {
            $(`${name}-panel`).hidden = view !== name;
            $(`view-${name}`).setAttribute('aria-pressed', String(view === name));
        }
    }
    function renderHeaders() {
        $('runs-headers').innerHTML = columns.map(([key, label, unit]) => {
            const direction = state.sort?.key === key ? state.sort.direction : '';
            const filtered = key in state.columnFilters;
            return `<th scope="col" aria-sort="${direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}"><div class="column-heading"><button type="button" class="column-title" data-order="${key}" aria-label="${escape(label())}: ${t(direction === 'asc' ? 'descending' : 'ascending')}"><span>${escape(label())}${unit ? `<small>${unit}</small>` : ''}</span><span aria-hidden="true">${direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : ''}</span></button><button type="button" data-column="${key}" aria-haspopup="dialog" aria-controls="column-menu" aria-expanded="false" class="column-trigger ${filtered ? 'is-filtered' : ''}" aria-label="${escape(label())}: ${t('filterColumn')}${filtered ? ` (${t('filtered')})` : ''}"><span class="column-chevron" aria-hidden="true"></span>${filtered ? '<span aria-hidden="true">•</span>' : ''}</button></div></th>`;
        }).join('');
    }
    function valueLabel(row, key) {
        if (key in row.metrics) return row.metrics[key] === null ? '—' : String(row.metrics[key]);
        if (key === 'model') return `${row.model} · ${row.parallel.label} · ${row.precision} · ${row.parallel.chips ?? '?'} NPU`;
        if (key === 'task') return row.taskLabel;
        if (key === 'mod') return row.mod === 'native' ? t('native') : row.mod;
        return String(model.columnValue(row, key) ?? '—');
    }
    function visibleChoices() {
        const query = $('column-search').value.toLocaleLowerCase();
        return menu.choices.filter(choice => choice.label.toLocaleLowerCase().includes(query));
    }
    function renderChoices() {
        const visible = visibleChoices();
        $('column-values').innerHTML = visible.length ? visible.map(choice =>
            `<label><input type="checkbox" data-choice="${choice.index}" ${menu.selected.has(choice.value) ? 'checked' : ''}><span>${escape(choice.label)}</span></label>`
        ).join('') : `<p>${t('noValues')}</p>`;
    }
    function closeMenu() {
        const key = menu?.key;
        $('column-menu').close(); menu = null;
        const trigger = document.querySelector(`[data-column="${key}"]`);
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.focus({ preventScroll: true });
    }
    function applyMenuChange() {
        const key = menu.key;
        state.page = 0; state.selectedTask = '';
        closeMenu(); renderHeaders(); renderRows();
        document.querySelector(`[data-column="${key}"]`)?.focus({ preventScroll: true });
    }
    function openMenu(key) {
        const unique = new Map();
        // Options span the selected global scope, not just the current page or
        // other column filters, so a filtered-out value can always be restored.
        for (const row of state.rows.filter(matches)) {
            const value = model.columnValue(row, key);
            if (!unique.has(value)) unique.set(value, { value, label: valueLabel(row, key) });
        }
        const choices = [...unique.values()].sort((a, b) => {
            if (a.value === null || b.value === null) return a.value === b.value ? 0 : a.value === null ? 1 : -1;
            return typeof a.value === 'number' ? a.value - b.value : a.label.localeCompare(b.label, lang(), { numeric: true });
        }).map((choice, index) => ({ ...choice, index }));
        menu = { key, choices, selected: new Set(state.columnFilters[key] ?? choices.map(c => c.value)) };
        $('column-menu-title').textContent = columns.find(c => c[0] === key)[1]();
        const scopeKey = key === 'run' ? 'source' : null;
        $('column-scope').hidden = !scopeKey;
        if (scopeKey) {
            $('column-scope-label').textContent = t('records');
            const values = ['', 'current', 'historical'];
            $('column-scope-select').innerHTML = values.map(value => `<option value="${escape(value)}" ${state.filters[scopeKey] === value ? 'selected' : ''}>${escape(t(value || 'all'))}</option>`).join('');
        }
        $('column-search').value = '';
        renderChoices();
        const trigger = document.querySelector(`[data-column="${key}"]`);
        trigger.setAttribute('aria-expanded', 'true');
        $('column-menu').showModal();
        const rect = trigger.getBoundingClientRect(), dialog = $('column-menu');
        dialog.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - dialog.offsetWidth - 8))}px`;
        dialog.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - dialog.offsetHeight - 8))}px`;
        $('column-search').focus({ preventScroll: true });
    }
    $('runs-headers').addEventListener('click', event => {
        const button = event.target.closest('[data-column]');
        if (button) openMenu(button.dataset.column);
        const title = event.target.closest('[data-order]');
        if (title) {
            const key = title.dataset.order;
            state.sort = { key, direction: state.sort?.key === key && state.sort.direction === 'asc' ? 'desc' : 'asc' };
            state.page = 0; renderHeaders(); renderRows();
            document.querySelector(`[data-order="${key}"]`)?.focus({ preventScroll: true });
        }
    });
    $('column-scope-select').addEventListener('change', () => {
        const key = menu.key;
        state.filters.source = $('column-scope-select').value;
        state.columnFilters = {}; state.page = 0; state.selectedTask = '';
        closeMenu(); renderHeaders(); renderRows(); openMenu(key);
    });
    $('column-search').addEventListener('input', renderChoices);
    $('column-values').addEventListener('change', event => {
        const choice = menu.choices[Number(event.target.dataset.choice)];
        if (choice) event.target.checked ? menu.selected.add(choice.value) : menu.selected.delete(choice.value);
    });
    for (const [id, checked] of [['column-all', true], ['column-none', false]]) $(id).addEventListener('click', () => {
        for (const choice of visibleChoices()) checked ? menu.selected.add(choice.value) : menu.selected.delete(choice.value);
        renderChoices();
    });
    $('column-apply').addEventListener('click', () => {
        if (menu.choices.every(c => menu.selected.has(c.value))) delete state.columnFilters[menu.key];
        else state.columnFilters[menu.key] = [...menu.selected];
        applyMenuChange();
    });
    $('column-clear').addEventListener('click', () => {
        delete state.columnFilters[menu.key]; applyMenuChange();
    });
    $('column-cancel').addEventListener('click', closeMenu);
    $('column-menu').addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
    $('column-menu').addEventListener('click', event => {
        if (event.target === $('column-menu')) {
            const rect = event.target.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeMenu();
        }
    });
    for (const view of ['runs', 'tasks']) $(`view-${view}`).addEventListener('click', () => setView(view));
    function matches(row) {
        return Object.entries(state.filters).every(([key, value]) => !value || row[key] === value);
    }
    function details(row) {
        const entry = row.entry, meta = entry.metadata || {};
        const provenance = { entry_id: row.id, engine: entry.engine, engine_version: entry.engine_version, submitted_at: row.date,
            git_commit: meta.git_commit, runtime: meta.runtime_provenance, hardware: entry.hardware,
            evidence_scope: meta.official_admission_status || row.source, verified: meta.verified,
            throughput_token_basis: meta.throughput_token_basis || 'unspecified',
            note: meta.notes, repeat_index: row.repeat, parent_aggregate: row.parentId };
        return `<tr id="config-${escape(row.id)}" class="run-detail" ${state.expanded.has(row.id) ? '' : 'hidden'}><td colspan="${columns.length}">
            <div class="run-detail-head"><strong>${escape(row.prefix)}</strong><span>${link(row.evidence, meta.raw_evidence_url ? t('raw') : t('source'))} ${link(row.manifest, t('manifest'))}</span></div>
            ${row.aggregate ? `<p>${t('aggregateHint')}</p>` : ''}
            ${row.metrics.batchLatency !== null ? `<p class="batch-value">${t('batch')}: <strong>${fmt(row.metrics.batchLatency)}</strong> — not TTFT</p>` : ''}
            <div class="run-config-grid">${[[t('server'), entry.same_spec?.resolved_server_parameters || {}],
                [t('client'), entry.same_spec?.resolved_client_parameters || {}], [t('provenance'), provenance]]
                .map(([title, data]) => `<section><h4>${escape(title)}</h4><pre>${escape(JSON.stringify(data, null, 2))}</pre></section>`).join('')}</div>
        </td></tr>`;
    }
    function renderRows() {
        const filtered = filteredRows(), maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
        state.page = Math.min(state.page, maxPage);
        const visible = filtered.slice(state.page * pageSize, (state.page + 1) * pageSize);
        let previousGroup = '';
        $('runs-body').innerHTML = visible.map(row => {
            const group = `${row.modelKey}/${row.taskId}`, boundary = group !== previousGroup;
            previousGroup = group;
            return `<tr class="run-row ${boundary ? 'group-start' : ''}" data-run-id="${escape(row.id)}">
                <td><strong>${escape(row.model)}</strong><small>${escape(row.parallel.label)} · ${escape(row.precision)} · ${escape(row.parallel.chips ?? '?')} NPU</small></td>
                <td class="run-hardware">${escape(row.hardware || '—')}</td>
                <td><button type="button" class="task-tag" data-task="${row.taskId}">${escape(row.taskLabel)}</button></td>
                <td><strong class="mod-label ${row.mod === 'native' ? 'native' : ''}">${escape(row.mod === 'native' ? t('native') : row.mod)}</strong><small>${escape(row.version)}</small></td>
                ${['ttft', 'tpot', 'ttftP95', 'tpotP95', 'throughput'].map(key => `<td class="metric" data-metric="${key}">${fmt(row.metrics[key])}</td>`).join('')}
                <td class="run-id"><span>${escape(row.date.slice(0, 10) || '—')}</span><small>${row.aggregate ? `${t('aggregate')} · ${escape(row.aggregate.count)}` : row.repeat !== null ? `${t('repeat')} ${escape(row.repeat)}` : escape(row.id.slice(0, 8))}</small><small>${t(row.source)}</small></td>
                <td><button type="button" class="run-toggle" data-run="${escape(row.id)}" aria-expanded="${state.expanded.has(row.id)}" aria-controls="config-${escape(row.id)}">${state.expanded.has(row.id) ? t('close') : t('open')}</button><small class="run-prefix">${escape(row.prefix)}</small></td>
            </tr>${details(row)}`;
        }).join('');
        $('runs-empty').hidden = Boolean(filtered.length);
        $('view-runs-count').textContent = filtered.length;
        $('view-tasks-count').textContent = new Set(filtered.map(r => r.taskId)).size;
        $('runs-page').textContent = `${state.page + 1} / ${maxPage + 1}`;
        $('runs-previous').disabled = state.page === 0;
        $('runs-next').disabled = state.page >= maxPage;
        renderTasks(filtered);
    }
    function lengths(definition, key) {
        const variable = ['sharegpt', 'custom', 'hf'].includes(definition.dataset);
        const value = definition[key];
        return variable ? `${t('variable')}${value !== null ? ` (${t('legacyLength')}: ${value})` : ''}` : value ?? '—';
    }
    function renderTasks(rows) {
        const active = new Set(rows.map(row => row.taskId));
        if (state.selectedTask) active.add(state.selectedTask);
        $('tasks-body').innerHTML = state.tasks.filter(task => active.has(task.id)).map(task => {
            const d = task.definition, p = d.parameters;
            return `<tr id="${task.id}" tabindex="-1" class="${state.selectedTask === task.id ? 'selected-task' : ''}">
                <td><strong>${escape(task.label)}</strong></td><td>${escape(p.hf_name || p.dataset_path || d.dataset || '—')}</td>
                <td>${escape(lengths(d, 'input_length'))}</td><td>${escape(lengths(d, 'output_length'))}</td>
                <td>${escape(d.concurrency ?? '—')} / ${escape(d.batch_size ?? '—')}</td><td>${escape(p.request_rate ?? '—')}</td>
                <td>${escape(p.num_prompts ?? p.max_requests ?? p.num_iters ?? '—')}</td>
                <td><details><summary>${t('parameters')}</summary><pre>${escape(JSON.stringify(d, null, 2))}</pre></details></td>
            </tr>`;
        }).join('');
    }
    function translate() {
        for (const node of document.querySelectorAll('[data-runs-i18n]')) node.textContent = t(node.dataset.runsI18n);
        document.title = lang() === 'zh' ? '排行榜 v2 - vLLM-HUST' : 'Leaderboard v2 - vLLM-HUST';
        if (state.ready) { renderHeaders(); renderRows(); }
    }
    async function initialize() {
        translate();
        try {
            // Existing loader owns atomic snapshots and local/GitHub fallback.
            // The supplement is optional and only joins by published aggregate ID.
            const [payload, supplement] = await Promise.all([
                window.HFDataLoader.loadLeaderboardData(),
                fetch('./data/leaderboard_run_observations.json').then(response => {
                    if (!response.ok) throw new Error('Missing run observations');
                    return response.json();
                }).catch(() => { state.missingSupplement = true; return {}; })
            ]);
            const built = window.LeaderboardRunsModel.build(payload, supplement);
            Object.assign(state, built, { ready: true });
            $('runs-supplement-warning').hidden = !state.missingSupplement;
            $('runs-loading').hidden = true;
            $('runs-content').hidden = false;
            renderHeaders(); renderRows();
        } catch (error) {
            $('runs-loading').hidden = true;
            $('runs-error').hidden = false;
            console.error('[Unified runs]', error);
        }
    }
    $('runs-reset').addEventListener('click', () => {
        state.filters.source = ''; state.page = 0; state.selectedTask = '';
        state.columnFilters = {}; state.sort = null; renderHeaders(); renderRows();
    });
    $('runs-previous').addEventListener('click', () => { state.page--; renderRows(); });
    $('runs-next').addEventListener('click', () => { state.page++; renderRows(); });
    $('runs-body').addEventListener('click', event => {
        const run = event.target.closest('[data-run]'), task = event.target.closest('[data-task]');
        if (run) {
            const id = run.dataset.run;
            state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
            renderRows();
            document.querySelector(`[data-run="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
        }
        if (task) {
            state.selectedTask = task.dataset.task;
            renderTasks(filteredRows());
            setView('tasks');
            $(state.selectedTask).scrollIntoView({ behavior: 'smooth', block: 'center' });
            $(state.selectedTask).focus({ preventScroll: true });
        }
    });
    window.addEventListener('vllm-hust:langchange', translate);
    initialize();
})();
