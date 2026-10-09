(function () {
    const DEFAULT_DATA_URL = './data/dataset_validation_v1.empty.json';
    const STATUS_ORDER = ['not_tested', 'baseline_only', 'queued', 'running', 'passed', 'failed', 'not_applicable'];
    const TREND_ORDER = ['improved', 'regressed', 'unchanged', 'not_comparable'];
    const STATUS_LABELS = {
        en: { not_tested: 'Not tested', baseline_only: 'B0 only', queued: 'Queued', running: 'Running', passed: 'Passed', failed: 'Failed', not_applicable: 'N/A' },
        zh: { not_tested: '未测试', baseline_only: '仅 B0', queued: '排队中', running: '运行中', passed: '通过', failed: '失败', not_applicable: '不适用' },
    };
    const TEXT = {
        en: { all: 'All statuses', noValue: 'No result', filtered: 'Filtered', allDatasets: 'All datasets', searchDataset: 'Search datasets', page: 'Page', of: 'of', previous: 'Previous', next: 'Next', noDataTitle: 'No dataset results yet', noDataBody: 'The validation service has not published a result for this scenario. Empty cells are intentionally shown as Not tested.', sourcePending: 'Awaiting validation service artifact', sourceCellEvidence: 'Cell-level evidence in details', detailTitle: 'Cell detail', baseline: 'B0 baseline', current: 'Current', delta: 'Delta', reason: 'Reason', note: 'Note', tracking: 'Tracking', updated: 'Updated', model: 'Model', hardware: 'Hardware', provenance: 'Provenance', candidates: 'B1 candidates', selected: 'Selected', exercised: 'Exercised', notExercised: 'Not exercised', notRecorded: 'Not recorded', viewSource: 'View report', notProvided: 'Not provided', timestampUnavailable: 'Timestamp unavailable', freshPrefix: 'Updated', stalePrefix: 'Stale' },
        zh: { all: '全部状态', noValue: '暂无结果', filtered: '已筛选', allDatasets: '全部数据集', searchDataset: '搜索数据集', page: '第', of: '/', previous: '上一页', next: '下一页', noDataTitle: '当前还没有数据集结果', noDataBody: '验证服务尚未为该场景发布结果。空单元格会明确显示为“未测试”。', sourcePending: '等待验证服务产物', sourceCellEvidence: '证据见单元格详情', detailTitle: '单元格详情', baseline: 'B0 基线', current: '当前值', delta: '变化', reason: '原因', note: '说明', tracking: '跟踪', updated: '更新时间', model: '模型', hardware: '硬件', provenance: '来源', candidates: 'B1 候选', selected: '已选为 B1', exercised: '已执行控制动作', notExercised: '未执行控制动作', notRecorded: '未记录控制动作', viewSource: '查看报告', notProvided: '未提供', timestampUnavailable: '缺少时间戳', freshPrefix: '更新时间', stalePrefix: '结果已过期' },
    };

    const state = { data: null, index: null, scenarioId: null, status: 'all', selected: null, query: '', group: 'all', page: 1, pageSize: 20 };
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
            if (item.candidate_values !== undefined) {
                if (!Array.isArray(item.candidate_values) || item.candidate_values.length === 0) throw new Error(`Invalid candidate values: ${key}`);
                const candidateIds = new Set();
                item.candidate_values.forEach((candidate) => {
                    if (!candidate || typeof candidate.candidate_id !== 'string' || !candidate.candidate_id || candidateIds.has(candidate.candidate_id) || !Number.isFinite(Number(candidate.value)) || typeof candidate.provenance?.repository !== 'string' || typeof candidate.provenance?.report_url !== 'string') {
                        throw new Error(`Invalid or duplicate candidate: ${key}`);
                    }
                    candidateIds.add(candidate.candidate_id);
                });
                const selected = item.candidate_values.find((candidate) => candidate.candidate_id === item.selected_candidate_id);
                if (!selected || Number(selected.value) !== Number(item.current_value ?? item.value)) throw new Error(`Selected candidate mismatch: ${key}`);
            }
            results.set(key, { ...item, status: item.status || 'not_tested' });
        });
        return { ...data, results };
    }

    function normalizeIndex(data) {
        if (!data || data.contract_version !== 'dataset-validation-index-v1' || !Array.isArray(data.scenarios) || data.scenarios.length === 0) {
            throw new Error('Unsupported dataset validation index');
        }
        const ids = new Set();
        data.scenarios.forEach((scenario) => {
            if (!scenario || typeof scenario.id !== 'string' || !scenario.id || ids.has(scenario.id) || typeof scenario.data_url !== 'string' || !scenario.data_url) {
                throw new Error('Invalid or duplicate validation scenario');
            }
            ids.add(scenario.id);
        });
        if (!ids.has(data.default_scenario_id)) throw new Error('Invalid default validation scenario');
        return data;
    }

    function selectScenario(index, requestedId) {
        return index.scenarios.find((scenario) => scenario.id === requestedId)
            || index.scenarios.find((scenario) => scenario.id === index.default_scenario_id);
    }

    function selectableScenarios(index, currentId) {
        return index.scenarios.filter((scenario) => scenario.selector_visible !== false || scenario.id === currentId);
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

    function detailMetadata(cell, data) {
        const provenance = cell.provenance || {};
        return {
            model: cell.model || data.scenario?.model || t('notProvided'),
            hardware: cell.hardware || data.scenario?.hardware || t('notProvided'),
            provenance: provenance.job_url || provenance.screenshot || provenance.report_url || provenance.artifact || data.source?.artifact_url || t('notProvided'),
        };
    }

    function provenanceHtml(value) {
        try {
            const url = new URL(value);
            if (url.protocol === 'https:') return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${t('viewSource')}</a>`;
        } catch (_) { return escapeHtml(value); }
        return escapeHtml(value);
    }

    function candidateValuesHtml(cell, metric) {
        if (!Array.isArray(cell.candidate_values) || cell.candidate_values.length === 0) return '';
        const effectivenessLabel = (value) => ({ exercised: t('exercised'), 'not-exercised': t('notExercised'), 'not-recorded': t('notRecorded') })[value] || value;
        const items = cell.candidate_values.map((candidate) => {
            const selected = candidate.candidate_id === cell.selected_candidate_id;
            const delta = formatDelta(candidate);
            const value = formatValue(candidate, metric);
            const report = candidate.provenance?.report_url ? provenanceHtml(candidate.provenance.report_url) : '';
            return `<li class="validation-candidate${selected ? ' validation-candidate--selected' : ''}"><div><strong>${escapeHtml(candidate.label)}</strong>${selected ? `<span>${t('selected')}</span>` : ''}</div><div class="validation-candidate-value">${value}${delta ? ` · ${escapeHtml(delta)}` : ''}</div><small>${escapeHtml(effectivenessLabel(candidate.runtime_effectiveness))}${report ? ` · ${report}` : ''}</small></li>`;
        }).join('');
        return `<dt>${t('candidates')}</dt><dd><ul class="validation-candidate-list">${items}</ul></dd>`;
    }

    function detailNote(cell) {
        return lang() === 'zh' ? cell.note_zh || cell.note : cell.note;
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

    function coverageSummary(cells) {
        const hasValue = (value) => value !== null && value !== undefined && value !== '';
        const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
        cells.forEach((cell) => { counts[cell.status] += 1; });
        return {
            total: cells.length,
            baseline: cells.filter((cell) => hasValue(cell.baseline_value)).length,
            paired: cells.filter((cell) => hasValue(cell.baseline_value) && hasValue(cell.current_value ?? cell.value)).length,
            awaiting: counts.not_tested + counts.queued + counts.running,
            failed: counts.failed,
            notApplicable: counts.not_applicable,
        };
    }

    function renderSummary() {
        const summary = coverageSummary(allCells());
        $('validation-stat-total').textContent = summary.total;
        $('validation-stat-baseline').textContent = summary.baseline;
        $('validation-stat-paired').textContent = summary.paired;
        $('validation-stat-awaiting').textContent = summary.awaiting;
        $('validation-stat-failed').textContent = summary.failed;
        $('validation-stat-not-applicable').textContent = summary.notApplicable;
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
        const metadata = detailMetadata(cell, state.data);
        $('validation-detail-title').textContent = `${dataset.label} / ${metric.label}`;
        $('validation-detail-status').className = `validation-status validation-status--${cell.status}`;
        $('validation-detail-status').textContent = statusLabel(cell.status);
        $('validation-detail-description').textContent = `${dataset.description || ''} - ${metric.unit || ''}`;
        const reason = cell.reason ? `<dt>${t('reason')}</dt><dd>${escapeHtml(cell.reason)}</dd>` : '';
        const noteText = detailNote(cell);
        const note = noteText ? `<dt>${t('note')}</dt><dd>${escapeHtml(noteText)}</dd>` : '';
        const tracking = cell.tracking_url ? `<dt>${t('tracking')}</dt><dd>${escapeHtml(cell.tracking_url)}</dd>` : '';
        $('validation-detail-meta').innerHTML = `<dt>${t('baseline')}</dt><dd>${escapeHtml(cell.baseline_value ?? t('notProvided'))}</dd><dt>${t('current')}</dt><dd>${escapeHtml(cell.current_value ?? cell.value ?? t('noValue'))}</dd><dt>${t('delta')}</dt><dd>${escapeHtml(formatDelta(cell) || t('notProvided'))}</dd>${candidateValuesHtml(cell, metric)}${reason}${note}${tracking}<dt>${t('updated')}</dt><dd>${escapeHtml(cell.updated_at || state.data.generated_at || t('notProvided'))}</dd><dt>${t('model')}</dt><dd>${escapeHtml(metadata.model)}</dd><dt>${t('hardware')}</dt><dd>${escapeHtml(metadata.hardware)}</dd><dt>${t('provenance')}</dt><dd>${provenanceHtml(metadata.provenance)}</dd>`;
        panel.hidden = false;
    }

    function render() {
        if (!state.data) return;
        const scenario = state.data.scenario || {};
        const hasResults = state.data.results.size !== 0;
        const hasCellEvidence = [...state.data.results.values()].some((cell) =>
            ['baseline_only', 'passed'].includes(cell.status) &&
            (cell.provenance?.report_url || cell.provenance?.job_url || cell.provenance?.artifact)
        );
        $('validation-scenario').textContent = scenario.label || scenario.id || t('notProvided');
        $('validation-source').innerHTML = state.data.source?.commit
            ? `${escapeHtml(state.data.source.service)} · <strong>${escapeHtml(state.data.source.commit)}</strong>`
            : hasCellEvidence ? t('sourceCellEvidence') : t('sourcePending');
        renderFreshness();
        for (const selector of ['.validation-summary', '.validation-toolbar', '.validation-legend', '.validation-table-wrap', '.validation-pagination']) {
            document.querySelector(selector).hidden = !hasResults;
        }
        if (hasResults) {
            renderDatasetControls();
            renderSummary();
            renderMatrix();
            renderDetail();
        } else {
            state.selected = null;
            $('validation-detail').hidden = true;
        }
        $('validation-empty').hidden = hasResults;
    }

    function renderScenarioOptions() {
        const select = $('validation-model-select');
        select.innerHTML = selectableScenarios(state.index, state.scenarioId).map((scenario) => `<option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.label || scenario.model || scenario.id)}</option>`).join('');
        select.value = state.scenarioId;
        select.disabled = false;
    }

    function fetchJson(url) {
        return fetch(url).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        });
    }

    function loadScenario(scenario, updateUrl = false) {
        state.scenarioId = scenario.id;
        state.data = null;
        state.selected = null;
        state.page = 1;
        $('validation-loading').hidden = false;
        $('validation-content').hidden = true;
        $('validation-error').hidden = true;
        renderScenarioOptions();
        if (updateUrl) {
            const url = new URL(window.location.href);
            url.searchParams.set('model', scenario.id);
            window.history.replaceState(null, '', url);
        }
        return fetchJson(scenario.data_url).then((data) => {
            const demo = new URLSearchParams(window.location.search).get('demo') === '1';
            const payload = demo && Array.isArray(data._demo_results) ? { ...data, results: data._demo_results } : data;
            if (payload.scenario?.id && payload.scenario.id !== scenario.id) throw new Error('Validation scenario identity mismatch');
            state.data = normalize(payload);
            $('validation-loading').hidden = true;
            $('validation-content').hidden = false;
            render();
        });
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
        $('validation-model-select').addEventListener('change', (event) => {
            const scenario = selectScenario(state.index, event.target.value);
            loadScenario(scenario, true).catch(showLoadError);
        });
        const config = window.vllmHustDatasetValidationConfig || {};
        const indexPromise = config.indexUrl
            ? fetchJson(config.indexUrl).then(normalizeIndex)
            : Promise.resolve(normalizeIndex({ contract_version: 'dataset-validation-index-v1', default_scenario_id: 'default', scenarios: [{ id: 'default', label: 'Default', data_url: config.dataUrl || DEFAULT_DATA_URL }] }));
        indexPromise.then((index) => {
            state.index = index;
            const requestedId = new URLSearchParams(window.location.search).get('model');
            return loadScenario(selectScenario(index, requestedId));
        }).catch(showLoadError);
        window.addEventListener('vllm-hust:langchange', () => { if (state.data) { select.innerHTML = `<option value="all">${t('all')}</option>`; STATUS_ORDER.forEach((status) => { const option = document.createElement('option'); option.value = status; option.textContent = statusLabel(status); select.appendChild(option); }); select.value = state.status; render(); } });
    }

    function showLoadError(error) {
        console.error(error);
        $('validation-loading').hidden = true;
        $('validation-content').hidden = true;
        $('validation-error').hidden = false;
        $('validation-error-body').textContent = error.message || 'Unable to load validation artifact';
    }

    document.addEventListener('DOMContentLoaded', init);
})();
