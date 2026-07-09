(function () {
    const SOURCES = [
        'https://raw.githubusercontent.com/vLLM-HUST/vllm-hust-org-profile/main/profile/core_contributors.json',
        './data/core_contributors.json',
    ];

    async function fetchPayload() {
        let lastError = null;
        for (const source of SOURCES) {
            try {
                const response = await fetch(source, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            } catch (err) {
                lastError = err;
                console.warn('[contributors] source failed', source, err);
            }
        }
        throw lastError || new Error('No contributor data source succeeded');
    }

    function contributorsFor(payload, scope) {
        if (payload?.[scope] && Array.isArray(payload[scope].contributors)) {
            return payload[scope].contributors;
        }
        if (payload?.all_repos && Array.isArray(payload.all_repos.contributors)) {
            return payload.all_repos.contributors;
        }
        return Array.isArray(payload?.contributors) ? payload.contributors : [];
    }

    function fmt(value) {
        return Number(value || 0).toLocaleString();
    }

    function renderMeta(payload) {
        const all = contributorsFor(payload, 'all_repos');
        const core = contributorsFor(payload, 'core_repos');
        const repoCount = new Set(all.flatMap((item) => item.repos || [])).size;
        document.getElementById('contributors-updated').textContent = payload.updated_at || '-';
        document.getElementById('contributors-total').textContent = fmt(all.length);
        document.getElementById('contributors-core-total').textContent = fmt(core.length);
        document.getElementById('contributors-repos').textContent = fmt(repoCount);
    }

    function renderTable(id, contributors) {
        const tbody = document.getElementById(id);
        if (!tbody) return;
        tbody.innerHTML = contributors.map((item) => {
            const displayName = item.display_name || item.chinese_name || item.name || item.github_login || '';
            const name = item.github_url
                ? `<a href="${item.github_url}" target="_blank" rel="noreferrer">${displayName}</a>`
                : displayName;
            const loginLine = item.github_login && item.github_login !== displayName
                ? `<br><small>${item.github_login}</small>`
                : '';
            const repos = Array.isArray(item.repos) ? item.repos.slice(0, 5).join(', ') : '';
            return `
                <tr>
                    <td>${item.rank || ''}</td>
                    <td>${name}${loginLine}</td>
                    <td>${fmt(item.commits)}</td>
                    <td>${fmt(item.changed_lines)}</td>
                    <td>${fmt(item.added)} / ${fmt(item.deleted)}</td>
                    <td>${fmt(item.active_repos)}<br><small>${repos}</small></td>
                    <td>${item.key_contributions || ''}</td>
                </tr>
            `;
        }).join('');
    }

    async function init() {
        const loading = document.getElementById('contributors-loading');
        const content = document.getElementById('contributors-content');
        const error = document.getElementById('contributors-error');
        try {
            const payload = await fetchPayload();
            renderMeta(payload);
            renderTable('contributors-all-tbody', contributorsFor(payload, 'all_repos'));
            renderTable('contributors-core-tbody', contributorsFor(payload, 'core_repos'));
            if (loading) loading.style.display = 'none';
            if (error) error.style.display = 'none';
            if (content) content.style.display = 'block';
        } catch (err) {
            console.error('[contributors] failed:', err);
            if (loading) loading.style.display = 'none';
            if (content) content.style.display = 'none';
            if (error) error.style.display = 'block';
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
