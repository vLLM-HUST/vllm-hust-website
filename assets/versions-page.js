(function () {
    'use strict';
    let currentMeta = null;
    let failed = false;
    const COPY = {
        en: {
            policy: 'Repository main snapshot; not a production compatibility approval.',
            emptyCore: 'No core repositories recorded.', emptyInfra: 'No integration repositories recorded.',
            error: 'Version data could not be loaded. Use the source runbook above; do not infer a supported version.',
            commit: 'Exact commit', sourceDate: 'Source updated',
            registry: 'PyPI snapshot (not approved for the current stack)',
        },
        zh: {
            policy: '仓库 main 快照；不代表该组合已通过生产兼容性验证。',
            emptyCore: '暂无核心仓库记录。', emptyInfra: '暂无集成仓库记录。',
            error: '版本数据加载失败。请查阅上方来源部署文档，不要据此推断支持的版本。',
            commit: '精确提交', sourceDate: '源码更新', registry: 'PyPI 快照（未批准用于当前服务栈）',
        },
    };
    function currentLanguage() {
        return window.vllmHustSite?.getCurrentLang?.() === 'zh' ? 'zh' : 'en';
    }
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[char]);
    }
    function sourceLink(url, label) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' || !['github.com', 'pypi.org'].includes(parsed.hostname)
                || parsed.username || parsed.password) return '';
            return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
        } catch { return ''; }
    }
    function packageCard(pkg, text) {
        return `<article class="package-item">
            <h3 class="package-name">${escapeHtml(pkg.name)}</h3>
            <div class="package-version">${escapeHtml(pkg.version)}</div>
            <div class="package-meta">${text.policy}</div>
            <div class="package-meta">${text.sourceDate}: ${escapeHtml(pkg.source_updated_at || '—')}</div>
            <div class="package-links">${sourceLink(pkg.repo, 'GitHub')}${sourceLink(pkg.source_commit_url, text.commit)}</div>
        </article>`;
    }
    function render() {
        const lang = currentLanguage();
        const text = COPY[lang];
        for (const [group, id, empty] of [['core', 'core', text.emptyCore], ['infrastructure', 'infra', text.emptyInfra]]) {
            const items = (currentMeta?.packages || []).filter((pkg) => pkg.group === group);
            document.getElementById(`${id}-packages`).innerHTML = items.map((pkg) => packageCard(pkg, text)).join('');
            const loading = document.getElementById(`${id}-loading`);
            loading.hidden = items.length > 0;
            if (failed || currentMeta) loading.textContent = failed ? text.error : empty;
        }
        if (!currentMeta) return;
        window.vllmHustSnapshot.render(document.getElementById('versions-verified'), currentMeta.updated_at, lang);
        document.getElementById('versions-updated-at').textContent = currentMeta.updated_at || '—';
        const registry = currentMeta.registry;
        document.getElementById('versions-registry').textContent = registry
            ? `${text.registry}: ${registry.name} ${registry.version} · ${registry.uploaded_at || '—'}` : '';
    }
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const response = await fetch('./data/version_meta.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const meta = await response.json();
            if (!meta || !Array.isArray(meta.packages)) throw new Error('Invalid package metadata');
            currentMeta = meta;
        } catch (error) {
            failed = true;
            console.warn('[versions-page] failed:', error.message);
        }
        render();
    });
    window.addEventListener('vllm-hust:langchange', render);
})();
