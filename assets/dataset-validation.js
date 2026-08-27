(function () {
    const DATA_URL = './data/dataset_validation_v1.empty.json';
    const STATUS_ORDER = ['not_tested', 'queued', 'running', 'passed', 'failed', 'not_applicable'];
    const STATUS_LABELS = {
        en: { not_tested: 'Not tested', queued: 'Queued', running: 'Running', passed: 'Passed', failed: 'Failed', not_applicable: 'N/A' },
        zh: { not_tested: '未测试', queued: '排队中', running: '运行中', passed: '通过', failed: '失败', not_applicable: '不适用' },
    };
    const TEXT = {
        en: { all: 'All statuses', noValue: 'No result', noDataTitle: 'No dataset results yet', noDataBody: 'The validation service has not published a result for this scenario. Empty cells are intentionally shown as Not tested.', sourcePending: 'Awaiting validation service artifact', detailTitle: 'Cell detail', baseline: 'B0 baseline', current: 'Current', delta: 'Delta', updated: 'Updated', model: 'Model', hardware: 'Hardware', provenance: 'Provenance', notProvided: 'Not provided' },
        zh: { all: '全部状态', noValue: '暂无结果', noDataTitle: '当前还没有数据集结果', noDataBody: '验证服务尚未为该场景发布结果。空单元格会明确显示为“未测试”。', sourcePending: '等待验证服务产物', detailTitle: '单元格详情', baseline: 'B0 基线', current: '当前值', delta: '变化', updated: '更新时间', model: '模型', hardware: '硬件', provenance: '来源', notProvided: '未提供' },
    };

    const state = { data: null, status: 'all', selected: null };
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
        const results = new Map();
        data.results.forEach((item) => {
            if (!item?.dataset_id || !item?.metric_id) return;
            results.set(`${item.dataset_id}:${item.metric_id}`, { ...item, status: STATUS_ORDER.includes(item.status) ? item.status : 'not_tested' });
        });
        return { ...data, results };
    }

    function getCell(dataset, metric) {
        return state.data.results.get(`${dataset.id}:${metric.id}`) || { dataset_id: dataset.id, metric_id: metric.id, status: 'not_tested' };
    }

    function formatValue(cell, metric) {
        if (cell.value === null || cell.value === undefined || cell.value === '') return t('noValue');
        const value = Number(cell.value);
        if (!Number.isFinite(value)) return escapeHtml(cell.value);
        const digits = metric.unit === '%' ? 2 : value >= 100 ? 1 : 2;
        return `${value.toFixed(digits)} ${escapeHtml(cell.unit || metric.unit || '')}`.trim();
    }

    function formatDelta(cell) {
        if (cell.delta_pct === null || cell.delta_pct === undefined || cell.delta_pct === '') return '';
        const value = Number(cell.delta_pct);
        return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : escapeHtml(cell.delta_pct);
    }

    function visibleCells() {
        const cells = [];
        state.data.datasets.forEach((dataset) => state.data.metrics.forEach((metric) => cells.push(getCell(dataset, metric))));
        return state.status === 'all' ? cells : cells.filter((cell) => cell.status === state.status);
    }

    function renderSummary() {
        const cells = visibleCells();
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
        header.innerHTML = `<th scope="col">${lang() === 'zh' ? '数据集' : 'Dataset'}</th>${state.data.metrics.map((metric) => `<th scope="col">${escapeHtml(metric.label)}<small>${escapeHtml(metric.unit || '')}</small></th>`).join('')}`;
        body.innerHTML = state.data.datasets.map((dataset) => `<tr><th scope="row" class="validation-dataset"><strong>${escapeHtml(dataset.label)}</strong><small>${escapeHtml(dataset.description || '')}</small></th>${state.data.metrics.map((metric) => {
            const cell = getCell(dataset, metric);
            const delta = formatDelta(cell);
            const key = `${dataset.id}:${metric.id}`;
            const hidden = state.status !== 'all' && cell.status !== state.status;
            return `<td class="validation-cell"${hidden ? ' data-filtered="true"' : ''}><button class="validation-cell-button" type="button" data-cell="${escapeHtml(key)}" aria-label="${escapeHtml(dataset.label)} ${escapeHtml(metric.label)}"><span class="validation-cell-value">${formatValue(cell, metric)}</span>${delta ? `<span class="validation-cell-delta">${delta}</span>` : ''}<span class="validation-status validation-status--${cell.status}">${statusLabel(cell.status)}</span></button></td>`;
        }).join('')}</tr>`).join('');
        body.querySelectorAll('[data-cell]').forEach((button) => button.addEventListener('click', () => { state.selected = button.dataset.cell; renderDetail(); }));
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
        $('validation-detail-meta').innerHTML = `<dt>${t('baseline')}</dt><dd>${escapeHtml(cell.baseline_value ?? t('notProvided'))}</dd><dt>${t('current')}</dt><dd>${escapeHtml(cell.value ?? t('noValue'))}</dd><dt>${t('delta')}</dt><dd>${escapeHtml(formatDelta(cell) || t('notProvided'))}</dd><dt>${t('updated')}</dt><dd>${escapeHtml(cell.updated_at || state.data.generated_at || t('notProvided'))}</dd><dt>${t('model')}</dt><dd>${escapeHtml(cell.model || state.data.scenario.model || t('notProvided'))}</dd><dt>${t('hardware')}</dt><dd>${escapeHtml(cell.hardware || state.data.scenario.hardware || t('notProvided'))}</dd><dt>${t('provenance')}</dt><dd>${escapeHtml(provenance.job_url || provenance.artifact || state.data.source.artifact_url || t('notProvided'))}</dd>`;
        panel.hidden = false;
    }

    function render() {
        if (!state.data) return;
        const scenario = state.data.scenario || {};
        $('validation-scenario').textContent = scenario.label || scenario.id || t('notProvided');
        $('validation-source').innerHTML = state.data.source?.commit ? `${escapeHtml(state.data.source.service)} · <strong>${escapeHtml(state.data.source.commit)}</strong>` : t('sourcePending');
        renderSummary();
        renderMatrix();
        renderDetail();
        $('validation-empty').hidden = state.data.results.size !== 0;
    }

    function init() {
        const select = $('validation-status-filter');
        STATUS_ORDER.forEach((status) => { const option = document.createElement('option'); option.value = status; option.textContent = statusLabel(status); select.appendChild(option); });
        select.addEventListener('change', () => { state.status = select.value; render(); });
        document.addEventListener('click', (event) => { if (event.target.closest('[data-close-detail]')) { state.selected = null; renderDetail(); } });
        fetch(DATA_URL).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((data) => { state.data = normalize(data); $('validation-loading').hidden = true; $('validation-content').hidden = false; render(); }).catch((error) => { console.error(error); $('validation-loading').hidden = true; $('validation-error').hidden = false; });
        window.addEventListener('vllm-hust:langchange', () => { if (state.data) { select.innerHTML = `<option value="all">${t('all')}</option>`; STATUS_ORDER.forEach((status) => { const option = document.createElement('option'); option.value = status; option.textContent = statusLabel(status); select.appendChild(option); }); select.value = state.status; render(); } });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
