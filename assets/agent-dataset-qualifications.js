(function () {
    const DEFAULT_DATA_URL = './data/agent_dataset_qualifications.json';
    const TEXT = {
        en: {
            kicker: 'Tool / Agent datasets',
            title: 'Agent dataset results',
            description: 'Complete campaigns are shown first; early path qualifications remain separately identified.',
            loading: 'Loading agent dataset results...',
            unavailable: 'Agent dataset results unavailable',
            loadError: 'The result document could not be loaded.',
            dataset: 'Dataset',
            configuration: 'Configuration',
            progress: 'Progress',
            result: 'Result',
            evidence: 'Evidence',
            passed: 'Single-case qualification passed',
            completed: 'Complete campaign',
            executed: 'tasks executed',
            resolved: 'resolved among executed',
            viewEvidence: 'View evidence',
            caveat: 'Complete campaigns are the current dataset results. Qualification rows are retained startup evidence, not current progress or aggregate scores.',
        },
        zh: {
            kicker: '工具 / Agent 数据集',
            title: 'Agent 数据集结果',
            description: '完整 campaign 优先展示；早期链路 qualification 单独标明。',
            loading: '正在加载 Agent 数据集结果...',
            unavailable: 'Agent 数据集结果不可用',
            loadError: '无法加载结果文档。',
            dataset: '数据集',
            configuration: '配置',
            progress: '进度',
            result: '结果',
            evidence: '证据',
            passed: '单题 qualification 通过',
            completed: '完整 campaign',
            executed: '题已执行',
            resolved: '已执行题中解决',
            viewEvidence: '查看证据',
            caveat: '完整 campaign 是当前数据集结果；qualification 行仅保留为启动证据，不代表当前进度或聚合成绩。',
        },
    };

    let state = null;
    const $ = (id) => document.getElementById(id);
    const lang = () => window.vllmHustSite?.getCurrentLang?.() || 'en';
    const t = (key) => TEXT[lang()][key] || TEXT.en[key] || key;
    const localized = (item, key) => item[`${key}_${lang()}`] || item[`${key}_en`] || '';

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    }

    function normalize(data) {
        if (!data || data.contract_version !== 'agent-dataset-results-v2' || !Array.isArray(data.results)) {
            throw new Error('Unsupported agent dataset results contract');
        }
        const ids = new Set();
        data.results.forEach((item) => {
            if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('Invalid or duplicate result id');
            if (!['campaign', 'qualification'].includes(item.record_kind)) throw new Error('Invalid result kind');
            if (!Number.isInteger(item.executed_tasks) || !Number.isInteger(item.total_tasks) || item.executed_tasks < 0 || item.executed_tasks > item.total_tasks) throw new Error('Invalid result progress');
            if (!Number.isInteger(item.resolved_tasks) || item.resolved_tasks < 0 || item.resolved_tasks > item.executed_tasks) throw new Error('Invalid resolved task count');
            if (item.record_kind === 'campaign' && item.executed_tasks !== item.total_tasks) throw new Error('Incomplete campaign result');
            const expectedRate = item.executed_tasks ? item.resolved_tasks / item.executed_tasks : 0;
            if (typeof item.resolution_rate !== 'number' || Math.abs(item.resolution_rate - expectedRate) > 1e-12) throw new Error('Invalid resolution rate');
            ids.add(item.id);
        });
        const campaignIds = new Set(data.results.filter((item) => item.record_kind === 'campaign').map((item) => item.id));
        data.results.forEach((item) => {
            if (item.superseded_by && !campaignIds.has(item.superseded_by)) throw new Error('Invalid superseding campaign');
        });
        return data;
    }

    function renderText() {
        $('agent-qualification-kicker').textContent = t('kicker');
        $('agent-qualification-title').textContent = t('title');
        $('agent-qualification-description').textContent = t('description');
        $('agent-qualification-loading').textContent = t('loading');
        $('agent-qualification-error-title').textContent = t('unavailable');
        $('agent-qualification-error-body').textContent = t('loadError');
        $('agent-heading-dataset').textContent = t('dataset');
        $('agent-heading-config').textContent = t('configuration');
        $('agent-heading-progress').textContent = t('progress');
        $('agent-heading-result').textContent = t('result');
        $('agent-heading-evidence').textContent = t('evidence');
        $('agent-qualification-caveat').textContent = t('caveat');
    }

    function render() {
        renderText();
        if (!state) return;
        $('agent-qualification-body').innerHTML = state.results.map((item) => `
            <tr>
                <td data-label="${escapeHtml(t('dataset'))}"><span class="agent-qualification-name">${escapeHtml(item.dataset)}</span><span class="agent-qualification-meta">${escapeHtml(localized(item, 'owner'))}</span></td>
                <td data-label="${escapeHtml(t('configuration'))}"><span class="agent-qualification-value">${escapeHtml(item.model)}</span><span class="agent-qualification-meta">${escapeHtml(item.configuration)}</span></td>
                <td data-label="${escapeHtml(t('progress'))}"><span class="agent-qualification-value">${escapeHtml(`${item.executed_tasks} / ${item.total_tasks}`)}</span><span class="agent-qualification-note">${escapeHtml(`${item.executed_tasks} ${t('executed')}`)}</span></td>
                <td data-label="${escapeHtml(t('result'))}"><span class="agent-qualification-status">${escapeHtml(t(item.record_kind === 'campaign' ? 'completed' : 'passed'))}</span><span class="agent-qualification-value">${escapeHtml(`${item.resolved_tasks} / ${item.executed_tasks}${item.record_kind === 'campaign' ? ` (${(item.resolution_rate * 100).toFixed(1)}%)` : ''}`)}</span><span class="agent-qualification-note">${escapeHtml(localized(item, 'caveat'))}</span></td>
                <td data-label="${escapeHtml(t('evidence'))}"><a class="agent-qualification-link" href="${escapeHtml(item.evidence_url)}">${escapeHtml(t('viewEvidence'))}</a><span class="agent-qualification-meta">${escapeHtml(item.evidence_label)}</span></td>
            </tr>`).join('');
    }

    function init() {
        renderText();
        const dataUrl = window.vllmHustAgentDatasetConfig?.dataUrl || DEFAULT_DATA_URL;
        fetch(dataUrl, { cache: 'no-cache' }).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }).then((data) => {
            state = normalize(data);
            $('agent-qualification-loading').hidden = true;
            $('agent-qualification-content').hidden = false;
            render();
        }).catch((error) => {
            console.error(error);
            $('agent-qualification-loading').hidden = true;
            $('agent-qualification-error').hidden = false;
            $('agent-qualification-error-body').textContent = error.message || t('loadError');
        });
        window.addEventListener('vllm-hust:langchange', render);
    }

    window.__agentDatasetQualificationsTest = { normalize };
    document.addEventListener('DOMContentLoaded', init);
})();
