(function () {
    'use strict';

    const DEFAULT_CONFIG = {
        enabled: false,
        mode: 'embed',
        workstation_url: '',
        backend_url: '',
        docs_url: './docs/DEPLOY.md',
        label_zh: 'A100 Workstation',
        label_en: 'A100 Workstation'
    };

    let runtimeConfig = DEFAULT_CONFIG;

    function normalizeUrl(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function getCurrentDict() {
        const all = window['vllm-hustPageI18n'] || {};
        const lang = window['vllm-hustCurrentLang'] || 'zh';
        return all[lang] || all.zh || {};
    }

    function getCurrentLabel() {
        const lang = window['vllm-hustCurrentLang'] || 'zh';
        return lang === 'zh'
            ? normalizeUrl(runtimeConfig.label_zh) || 'A100 Workstation'
            : normalizeUrl(runtimeConfig.label_en) || normalizeUrl(runtimeConfig.label_zh) || 'A100 Workstation';
    }

    function setText(id, value) {
        const node = document.getElementById(id);
        if (node && typeof value === 'string') {
            node.textContent = value;
        }
    }

    function setLink(id, href) {
        const node = document.getElementById(id);
        if (node && typeof href === 'string' && href) {
            node.setAttribute('href', href);
        }
    }

    function renderWorkstationPanel() {
        const dict = getCurrentDict();
        const workstationUrl = normalizeUrl(runtimeConfig.workstation_url);
        const backendUrl = normalizeUrl(runtimeConfig.backend_url);
        const docsUrl = normalizeUrl(runtimeConfig.docs_url) || './docs/DEPLOY.md';
        const enabled = Boolean(runtimeConfig.enabled && workstationUrl);
        const embedMode = enabled && (runtimeConfig.mode || 'embed') === 'embed';
        const fallbackText = dict.workstation_not_configured || 'Not configured';
        const label = getCurrentLabel();

        setText('workstation-status-chip', enabled
            ? (dict.workstation_embed_live || 'Live')
            : (dict.workstation_embed_pending || 'Pending'));
        setText('workstation-status-detail', enabled ? label : (dict.workstation_status_waiting || 'Waiting for a public workstation URL.'));
        setText('workstation-embed-mode', enabled
            ? (embedMode
                ? (dict.workstation_embed_mode_embed || 'Embed Preview')
                : (dict.workstation_embed_mode_link || 'Launch Only'))
            : (dict.workstation_embed_mode_waiting || 'Waiting'));
        setText('workstation-topbar-title', enabled ? `${label}` : 'A100 Workstation Preview');
        setText('workstation-backend-value', backendUrl || fallbackText);
        setText('workstation-target-value', workstationUrl || fallbackText);

        setLink('workstation-docs-link', docsUrl);
        setLink('workstation-open-link', workstationUrl || docsUrl);

        const statusChip = document.getElementById('workstation-status-chip');
        const modeChip = document.getElementById('workstation-embed-mode');
        if (statusChip) {
            statusChip.dataset.state = enabled ? 'live' : 'pending';
        }
        if (modeChip) {
            modeChip.dataset.state = enabled ? 'live' : 'pending';
        }

        const iframe = document.getElementById('workstation-embed-frame');
        const placeholder = document.getElementById('workstation-placeholder');
        if (iframe && placeholder) {
            if (embedMode) {
                iframe.hidden = false;
                iframe.setAttribute('src', workstationUrl);
                placeholder.hidden = true;
            } else {
                iframe.hidden = true;
                iframe.removeAttribute('src');
                placeholder.hidden = false;
            }
        }
    }

    async function loadConfig() {
        const response = await fetch('./data/workstation_embed.json', { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Failed to load workstation embed config: ${response.status}`);
        }
        const payload = await response.json();
        runtimeConfig = { ...DEFAULT_CONFIG, ...(payload || {}) };
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (!document.getElementById('workstation-section')) {
            return;
        }

        try {
            await loadConfig();
        } catch (error) {
            console.warn('[workstation-embed] failed:', error.message);
        }

        renderWorkstationPanel();
        window.addEventListener('vllm-hust:langchange', renderWorkstationPanel);
    });
})();