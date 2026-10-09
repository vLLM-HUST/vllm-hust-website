(function () {
    const DEFAULT_DATA_URL = './data/agent_dataset_qualifications.json';
    const TEXT = {
        en: {
            kicker: 'Tool / Agent datasets',
            title: 'Qualification results',
            description: 'Collector and sandbox checks are shown separately from aggregate dataset scores.',
            loading: 'Loading qualification results...',
            unavailable: 'Qualification data unavailable',
            loadError: 'The result document could not be loaded.',
            dataset: 'Dataset',
            configuration: 'Configuration',
            progress: 'Progress',
            result: 'Result',
            evidence: 'Evidence',
            passed: 'Single-case qualification passed',
            executed: 'tasks executed',
            resolved: 'resolved among executed',
            viewEvidence: 'View evidence',
            caveat: 'Qualification rows verify one collector/runtime path. They are not complete dataset scores unless every task has run.',
        },
        zh: {
            kicker: '工具 / Agent 数据集',
            title: 'Qualification 结果',
            description: '采集器与 sandbox 验证和完整数据集聚合成绩分开展示。',
            loading: '正在加载 qualification 结果...',
            unavailable: 'Qualification 数据不可用',
            loadError: '无法加载结果文档。',
            dataset: '数据集',
            configuration: '配置',
            progress: '进度',
            result: '结果',
            evidence: '证据',
            passed: '单题 qualification 通过',
            executed: '题已执行',
            resolved: '已执行题中解决',
            viewEvidence: '查看证据',
            caveat: 'Qualification 行只验证一条采集器 / runtime 链路；只有全部任务执行完成后，才能作为完整数据集成绩。',
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
        if (!data || data.contract_version !== 'agent-dataset-qualification-v1' || !Array.isArray(data.qualifications)) {
            throw new Error('Unsupported agent dataset qualification contract');
        }
        const ids = new Set();
        data.qualifications.forEach((item) => {
            if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('Invalid or duplicate qualification id');
            if (!Number.isInteger(item.executed_tasks) || !Number.isInteger(item.total_tasks) || item.executed_tasks < 0 || item.executed_tasks > item.total_tasks) throw new Error('Invalid qualification progress');
            if (!Number.isInteger(item.resolved_tasks) || item.resolved_tasks < 0 || item.resolved_tasks > item.executed_tasks) throw new Error('Invalid resolved task count');
            ids.add(item.id);
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
        $('agent-qualification-body').innerHTML = state.qualifications.map((item) => `
            <tr>
                <td data-label="${escapeHtml(t('dataset'))}"><span class="agent-qualification-name">${escapeHtml(item.dataset)}</span><span class="agent-qualification-meta">${escapeHtml(localized(item, 'owner'))}</span></td>
                <td data-label="${escapeHtml(t('configuration'))}"><span class="agent-qualification-value">${escapeHtml(item.model)}</span><span class="agent-qualification-meta">${escapeHtml(item.configuration)}</span></td>
                <td data-label="${escapeHtml(t('progress'))}"><span class="agent-qualification-value">${escapeHtml(`${item.executed_tasks} / ${item.total_tasks}`)}</span><span class="agent-qualification-note">${escapeHtml(`${item.executed_tasks} ${t('executed')}`)}</span></td>
                <td data-label="${escapeHtml(t('result'))}"><span class="agent-qualification-status">${escapeHtml(t('passed'))}</span><span class="agent-qualification-value">${escapeHtml(`${item.resolved_tasks} / ${item.executed_tasks}`)}</span><span class="agent-qualification-note">${escapeHtml(localized(item, 'caveat'))}</span></td>
                <td data-label="${escapeHtml(t('evidence'))}"><a class="agent-qualification-link" href="${escapeHtml(item.evidence_url)}">${escapeHtml(t('viewEvidence'))}</a><span class="agent-qualification-meta">${escapeHtml(item.case_id)}</span></td>
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
