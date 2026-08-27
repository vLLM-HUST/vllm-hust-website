(function () {
    const DEFAULT_DATA_URL = './data/dataset_validation_v1.empty.json';
    const STATUS_ORDER = ['not_tested', 'queued', 'running', 'passed', 'failed', 'not_applicable'];
    const TREND_ORDER = ['improved', 'regressed', 'unchanged', 'not_comparable'];
    const STATUS_LABELS = {
        en: { not_tested: 'Not tested', queued: 'Queued', running: 'Running', passed: 'Passed', failed: 'Failed', not_applicable: 'N/A' },
        zh: { not_tested: '未测试', queued: '排队中', running: '运行中', passed: '通过', failed: '失败', not_applicable: '不适用' },
    };
    const TEXT = {
        en: { all: 'All statuses', noValue: 'No result', filtered: 'Filtered', allDatasets: 'All datasets', searchDataset: 'Search datasets', page: 'Page', of: 'of', previous: 'Previous', next: 'Next', noDataTitle: 'No dataset results yet', noDataBody: 'The validation service has not published a result for this scenario. Empty cells are intentionally shown as Not tested.', sourcePending: 'Awaiting validation service artifact', detailTitle: 'Cell detail', baseline: 'B0 baseline', current: 'Current', delta: 'Delta', updated: 'Updated', model: 'Model', hardware: 'Hardware', provenance: 'Provenance', notProvided: 'Not provided', timestampUnavailable: 'Timestamp unavailable', freshPrefix: 'Updated', stalePrefix: 'Stale' },
        zh: { all: '全部状态', noValue: '暂无结果', filtered: '已筛选', allDatasets: '全部数据集', searchDataset: '搜索数据集', page: '第', of: '/', previous: '上一页', next: '下一页', noDataTitle: '当前还没有数据集结果', noDataBody: '验证服务尚未为该场景发布结果。空单元格会明确显示为“未测试”。', sourcePending: '等待验证服务产物', detailTitle: '单元格详情', baseline: 'B0 基线', current: '当前值', delta: '变化', updated: '更新时间', model: '模型', hardware: '硬件', provenance: '来源', notProvided: '未提供', timestampUnavailable: '缺少时间戳', freshPrefix: '更新时间', stalePrefix: '结果已过期' },
    };

    const state = { data: null, status: 'all', selected: null, query: '', group: 'all', page: 1, pageSize: 20 };
    const $ = (id) => document.getElementById(id);
    const lang = () => window.vllmHustSite?.getCurrentLang?.() || 'en';
    const t = (key) => TEXT[lang()][key] || TEXT.en[key] || key;
    const statusLabel = (status) => STATUS_LABELS[lang()][status] || STATUS_LABELS.en[status] || status;

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    }

    function normalize(data) {
        if (!data || data.contract_version !== 'dataset-validation-v1' || !Array.isArray(data.datasets) || !Array.isArray(data.metrics) || !Array.isArray(data.results)) {
            throw new Error('Unsupported dataset validation contract');
        }
        const datasetIds = new Set();
        data.datasets.forEach((dataset) => {
            if (!dataset || typeof dataset.id !== 'string' || !dataset.id || datasetIds.has(dataset.id)) throw new Error('Invalid or duplicate dataset id');
            datasetIds.add(dataset.id);
        });
        const metricIds = new Set();
        data.metrics.forEach((metric) => {
            if (!metric || typeof metric.id !== 'string' || !metric.id || metricIds.has(metric.id)) throw new Error('Invalid or duplicate metric id');
            metricIds.add(metric.id);
        });
        const results = new Map();
        data.results.forEach((item) => {
            if (!item || !datasetIds.has(item.dataset_id) || !metricIds.has(item.metric_id)) throw new Error('Result references an undeclared dataset or metric');
            if (item.status !== undefined && !STATUS_ORDER.includes(item.status)) throw new Error(`Unsupported result status: ${item.status}`);
            if (item.comparison?.trend !== undefined && !TREND_ORDER.includes(item.comparison.trend)) throw new Error(`Unsupported comparison trend: ${item.comparison.trend}`);
            const key = `${item.dataset_id}:${item.metric_id}`;
            if (results.has(key)) throw new Error(`Duplicate result cell: ${key}`);
            results.set(key, { ...item, status: item.status || 'not_tested' });
        });
        return { ...data, results };
    }

    function getCell(dataset, metric) {
        return state.data.results.get(`${dataset.id}:${metric.id}`) || { dataset_id: dataset.id, metric_id: metric.id, status: 'not_tested' };
    }

    function formatValue(cell, metric) {
        const rawValue = cell.current_value ?? cell.value;
        if (rawValue === null || rawValue === undefined || rawValue === '') return t('noValue');
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return escapeHtml(rawValue);
        const digits = metric.unit === '%' ? 2 : value >= 100 ? 1 : 2;
        return `${value.toFixed(digits)} ${escapeHtml(cell.unit || metric.unit || '')}`.trim();
    }

    function formatBaselineValue(cell, metric) {
        const rawValue = cell.baseline_value;
        if (rawValue === null || rawValue === undefined || rawValue === '') return t('noValue');
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return escapeHtml(rawValue);
        const digits = metric.unit === '%' ? 2 : value >= 100 ? 1 : 2;
        return `${value.toFixed(digits)} ${escapeHtml(cell.unit || metric.unit || '')}`.trim();
    }

    function formatDelta(cell) {
        if (cell.delta_pct === null || cell.delta_pct === undefined || cell.delta_pct === '') return '';
        const value = Number(cell.delta_pct);
        return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : escapeHtml(cell.delta_pct);
    }

    function allCells() {
        const cells = [];
        state.data.datasets.forEach((dataset) => state.data.metrics.forEach((metric) => cells.push(getCell(dataset, metric))));
        return cells;
    }

    function filteredDatasets() {
        const query = state.query.trim().toLowerCase();
        return state.data.datasets.filter((dataset) => {
            const matchesGroup = state.group === 'all' || dataset.group === state.group;
            const haystack = `${dataset.label} ${dataset.description || ''}`.toLowerCase();
            return matchesGroup && (!query || haystack.includes(query));
        });
    }

    function renderSummary() {
        const cells = allCells();
        const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
        cells.forEach((cell) => { counts[cell.status] += 1; });
        $('validation-stat-total').textContent = cells.length;
        $('validation-stat-passed').textContent = counts.passed;
        $('validation-stat-failed').textContent = counts.failed;
        $('validation-stat-pending').textContent = counts.not_tested + counts.queued + counts.running;
    }

    function renderMatrix() {
        const header = $('validation-table-head');
        const body = $('validation-table-body');
        const datasets = filteredDatasets();
        const pageCount = Math.max(1, Math.ceil(datasets.length / state.pageSize));
        state.page = Math.min(state.page, pageCount);
        const pageStart = (state.page - 1) * state.pageSize;
        const pageDatasets = datasets.slice(pageStart, pageStart + state.pageSize);
        header.innerHTML = `<th scope="col">${lang() === 'zh' ? '数据集' : 'Dataset'}</th>${state.data.metrics.map((metric) => `<th scope="col">${escapeHtml(metric.label)}<small>${escapeHtml(metric.unit || '')}</small></th>`).join('')}`;
        body.innerHTML = pageDatasets.map((dataset) => `<tr><th scope="row" class="validation-dataset"><strong>${escapeHtml(dataset.label)}</strong><small>${escapeHtml(dataset.description || '')}</small></th>${state.data.metrics.map((metric) => {
            const cell = getCell(dataset, metric);
            const delta = formatDelta(cell);
            const key = `${dataset.id}:${metric.id}`;
            const hidden = state.status !== 'all' && cell.status !== state.status;
            if (hidden) return `<td class="validation-cell" data-filtered="true"><span class="validation-filtered-cell">${t('filtered')}</span></td>`;
            const trend = TREND_ORDER.includes(cell.comparison?.trend) ? cell.comparison.trend : 'not_comparable';
            const trendText = cell.comparison?.trend ? `${cell.comparison.trend}${delta ? ` ${delta}` : ''}` : delta;
            return `<td class="validation-cell"><button class="validation-cell-button" type="button" data-cell="${escapeHtml(key)}" aria-label="${escapeHtml(dataset.label)} ${escapeHtml(metric.label)}"><span class="validation-cell-pair"><span><small>B0</small>${formatBaselineValue(cell, metric)}</span><span><small>B1</small>${formatValue(cell, metric)}</span></span>${trendText ? `<span class="validation-cell-delta validation-trend--${trend}">${escapeHtml(trendText)}</span>` : ''}<span class="validation-status validation-status--${cell.status}">${statusLabel(cell.status)}</span></button></td>`;
        }).join('')}</tr>`).join('');
        body.querySelectorAll('[data-cell]').forEach((button) => button.addEventListener('click', () => { state.selected = button.dataset.cell; renderDetail(); }));
        renderPagination(datasets.length, pageCount);
    }

    function renderPagination(total, pageCount) {
        const node = $('validation-pagination');
        if (!node) return;
        const start = total ? ((state.page - 1) * state.pageSize) + 1 : 0;
        const end = Math.min(state.page * state.pageSize, total);
        node.innerHTML = `<span>${escapeHtml(`${start}-${end} / ${total}`)}</span><button type="button" class="action-button" data-page="prev" ${state.page <= 1 ? 'disabled' : ''}>${t('previous')}</button><span>${escapeHtml(`${t('page')} ${state.page} ${t('of')} ${pageCount}`)}</span><button type="button" class="action-button" data-page="next" ${state.page >= pageCount ? 'disabled' : ''}>${t('next')}</button>`;
        node.querySelector('[data-page="prev"]')?.addEventListener('click', () => { state.page -= 1; render(); });
        node.querySelector('[data-page="next"]')?.addEventListener('click', () => { state.page += 1; render(); });
    }

    function renderDetail() {
        const panel = $('validation-detail');
        if (!state.selected) { panel.hidden = true; return; }
        const [datasetId, metricId] = state.selected.split(':');
        const dataset = state.data.datasets.find((item) => item.id === datasetId);
        const metric = state.data.metrics.find((item) => item.id === metricId);
        if (!dataset || !metric) { panel.hidden = true; return; }
        const cell = getCell(dataset, metric);
        const provenance = cell.provenance || {};
        $('validation-detail-title').textContent = `${dataset.label} / ${metric.label}`;
        $('validation-detail-status').className = `validation-status validation-status--${cell.status}`;
        $('validation-detail-status').textContent = statusLabel(cell.status);
        $('validation-detail-description').textContent = `${dataset.description || ''} - ${metric.unit || ''}`;
        $('validation-detail-meta').innerHTML = `<dt>${t('baseline')}</dt><dd>${escapeHtml(cell.baseline_value ?? t('notProvided'))}</dd><dt>${t('current')}</dt><dd>${escapeHtml(cell.current_value ?? cell.value ?? t('noValue'))}</dd><dt>${t('delta')}</dt><dd>${escapeHtml(formatDelta(cell) || t('notProvided'))}</dd><dt>${t('updated')}</dt><dd>${escapeHtml(cell.updated_at || state.data.generated_at || t('notProvided'))}</dd><dt>${t('model')}</dt><dd>${escapeHtml(cell.model || state.data.scenario.model || t('notProvided'))}</dd><dt>${t('hardware')}</dt><dd>${escapeHtml(cell.hardware || state.data.scenario.hardware || t('notProvided'))}</dd><dt>${t('provenance')}</dt><dd>${escapeHtml(provenance.job_url || provenance.artifact || state.data.source.artifact_url || t('notProvided'))}</dd>`;
        panel.hidden = false;
    }

    function render() {
        if (!state.data) return;
        const scenario = state.data.scenario || {};
        $('validation-scenario').textContent = scenario.label || scenario.id || t('notProvided');
        $('validation-source').innerHTML = state.data.source?.commit ? `${escapeHtml(state.data.source.service)} · <strong>${escapeHtml(state.data.source.commit)}</strong>` : t('sourcePending');
        renderFreshness();
        renderDatasetControls();
        renderSummary();
        renderMatrix();
        renderDetail();
        $('validation-empty').hidden = state.data.results.size !== 0;
    }

    function renderFreshness() {
        const node = $('validation-freshness');
        const timestamp = Date.parse(state.data.generated_at || '');
        if (!Number.isFinite(timestamp)) {
            node.textContent = t('timestampUnavailable');
            node.dataset.state = 'unknown';
            return;
        }
        const ageHours = Math.max(0, Date.now() - timestamp) / 3600000;
        node.textContent = `${ageHours > 24 ? t('stalePrefix') : t('freshPrefix')}: ${new Date(timestamp).toISOString()}`;
        node.dataset.state = ageHours > 24 ? 'stale' : 'fresh';
    }

    function renderDatasetControls() {
        const groupSelect = $('validation-group-filter');
        $('validation-legend-b0').textContent = lang() === 'zh' ? '基线' : 'Baseline';
        $('validation-legend-b1').textContent = lang() === 'zh' ? '优化后' : 'Optimized';
        $('validation-legend-improved').textContent = lang() === 'zh' ? '性能提升' : 'Improved';
        $('validation-legend-regressed').textContent = lang() === 'zh' ? '性能回退' : 'Regressed';
        $('validation-group-label').textContent = lang() === 'zh' ? '分组' : 'Group';
        $('validation-search-label').textContent = lang() === 'zh' ? '数据集' : 'Dataset';
        $('validation-dataset-search').placeholder = t('searchDataset');
        const groups = [...new Set(state.data.datasets.map((dataset) => dataset.group).filter(Boolean))];
        groupSelect.innerHTML = `<option value="all">${t('allDatasets')}</option>${groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('')}`;
        groupSelect.value = groups.includes(state.group) ? state.group : 'all';
        state.group = groupSelect.value;
        $('validation-dataset-count').textContent = `${filteredDatasets().length} / ${state.data.datasets.length}`;
    }

    function init() {
        const select = $('validation-status-filter');
        STATUS_ORDER.forEach((status) => { const option = document.createElement('option'); option.value = status; option.textContent = statusLabel(status); select.appendChild(option); });
        select.addEventListener('change', () => { state.status = select.value; render(); });
        $('validation-dataset-search').addEventListener('input', (event) => { state.query = event.target.value; state.page = 1; render(); });
        $('validation-group-filter').addEventListener('change', (event) => { state.group = event.target.value; state.page = 1; render(); });
        document.addEventListener('click', (event) => { if (event.target.closest('[data-close-detail]')) { state.selected = null; renderDetail(); } });
        const dataUrl = window.vllmHustDatasetValidationConfig?.dataUrl || DEFAULT_DATA_URL;
        fetch(dataUrl).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((data) => { const demo = new URLSearchParams(window.location.search).get('demo') === '1'; const payload = demo && Array.isArray(data._demo_results) ? { ...data, results: data._demo_results } : data; state.data = normalize(payload); $('validation-loading').hidden = true; $('validation-content').hidden = false; render(); }).catch((error) => { console.error(error); $('validation-loading').hidden = true; $('validation-error').hidden = false; $('validation-error-body').textContent = error.message || 'Unable to load validation artifact'; });
        window.addEventListener('vllm-hust:langchange', () => { if (state.data) { select.innerHTML = `<option value="all">${t('all')}</option>`; STATUS_ORDER.forEach((status) => { const option = document.createElement('option'); option.value = status; option.textContent = statusLabel(status); select.appendChild(option); }); select.value = state.status; render(); } });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
