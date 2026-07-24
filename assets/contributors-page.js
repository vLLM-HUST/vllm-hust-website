(function () {
    const SOURCES = [
        'https://raw.githubusercontent.com/vLLM-HUST/.github/main/profile/core_contributors.json',
        './data/core_contributors.json',
    ];
    const EXCLUDED_PROFILE_IDENTITIES = new Set(['vllm-hust developer']);
    const CURATED_PROFILES = {
        shuhaozhangtony: {
            en: 'State management · Distributed runtimes · Inference infrastructure',
            zh: '状态管理 · 分布式运行时 · 推理基础设施',
            advisor: false,
        },
        'mingqiwang-coder': {
            en: 'vLLM runtime · Inference operators · Performance engineering',
            zh: 'vLLM 运行时 · 推理算子 · 工程优化',
            advisor: true,
        },
        cybber695: {
            en: 'Domestic hardware · Performance testing · Inference engineering',
            zh: '国产硬件适配 · 性能测试 · 推理工程',
            advisor: true,
        },
        pygone: {
            en: 'AgentDB · State persistence · Memory middleware',
            zh: 'AgentDB · 状态持久化 · 记忆中间件',
            advisor: true,
        },
        wmaster123: {
            en: 'Inference engines · Testing · Engineering optimization',
            zh: '推理引擎 · 测试 · 工程优化',
            advisor: true,
        },
        xilinggao: {
            en: 'Tiered KV cache · KV migration · Cache reuse',
            zh: '多级 KV 缓存 · KV 迁移 · 缓存复用',
            advisor: true,
        },
        moonandlife: {
            en: 'Upstream sync · CI/CD · Performance regression',
            zh: '上游同步 · CI/CD · 性能回归',
            advisor: true,
        },
        succinctpaul: {
            en: 'Benchmark infrastructure · Website · Engineering quality',
            zh: 'Benchmark 基础设施 · 网站 · 工程质量',
            advisor: true,
        },
    };
    let currentPayload = null;

    async function fetchPayload() {
        let lastError = null;
        const candidates = [];
        for (const [index, source] of SOURCES.entries()) {
            try {
                const response = await fetch(source, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                candidates.push({
                    payload,
                    index,
                    updatedAt: String(payload?.updated_at || ''),
                });
            } catch (err) {
                lastError = err;
                console.warn('[contributors] source failed', source, err);
            }
        }
        if (candidates.length) {
            candidates.sort((left, right) => (
                right.updatedAt.localeCompare(left.updatedAt)
                || left.index - right.index
            ));
            return candidates[0].payload;
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

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function currentLang() {
        return window.vllmHustSite?.getCurrentLang?.() === 'zh' ? 'zh' : 'en';
    }

    function profileKey(item) {
        return String(item.github_login || item.name || '').toLowerCase();
    }

    function renderMemberProfiles(payload) {
        const list = document.getElementById('contributors-member-list');
        const loading = document.getElementById('contributors-members-loading');
        if (!list) return;

        const lang = currentLang();
        const advisorLabel = lang === 'zh' ? '指导老师：' : 'Advisor: ';
        const advisorName = lang === 'zh' ? '张书豪' : 'Shuhao Zhang';
        const members = contributorsFor(payload, 'all_repos').filter((item) => {
            const identities = [item.name, item.github_login, item.display_name]
                .filter(Boolean)
                .map((value) => String(value).toLowerCase());
            return !identities.some((identity) => EXCLUDED_PROFILE_IDENTITIES.has(identity));
        });

        list.innerHTML = members.map((item) => {
            const displayName = item.display_name || item.chinese_name || item.name || item.github_login || '';
            const key = profileKey(item);
            const curated = CURATED_PROFILES[key];
            const focus = curated?.[lang]
                || item.key_contributions
                || (Array.isArray(item.repos) ? item.repos.slice(0, 3).join(' · ') : '');
            const name = item.github_url
                ? `<a href="${escapeHtml(item.github_url)}" target="_blank" rel="noreferrer">${escapeHtml(displayName)}</a>`
                : `<strong>${escapeHtml(displayName)}</strong>`;
            const login = item.github_login && item.github_login !== displayName
                ? `<small>@${escapeHtml(item.github_login)}</small>`
                : '';
            const advisor = curated?.advisor ? advisorName : '';
            return `
                <li>
                    <span class="research-member-identity">${name}${login}</span>
                    <span class="research-member-details">
                        <span class="research-member-focus">${escapeHtml(focus)}</span>
                        <span class="research-member-advisor"><b>${advisorLabel}</b><span>${escapeHtml(advisor)}</span></span>
                    </span>
                </li>
            `;
        }).join('');
        if (loading) loading.hidden = true;
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
            currentPayload = payload;
            renderMeta(payload);
            renderMemberProfiles(payload);
            renderTable('contributors-core-tbody', contributorsFor(payload, 'core_repos'));
            renderTable('contributors-all-tbody', contributorsFor(payload, 'all_repos'));
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

    window.addEventListener('vllm-hust:langchange', () => {
        if (currentPayload) renderMemberProfiles(currentPayload);
    });
    document.addEventListener('DOMContentLoaded', init);
})();
