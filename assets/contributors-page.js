(function () {
    const SOURCES = [
        'https://raw.githubusercontent.com/vLLM-HUST/.github/main/profile/core_contributors.json',
        './data/core_contributors.json',
    ];
    const SYNTHETIC_IDENTITIES = new Set(['vllm-hust developer']);
    let currentPayload = null;

    async function fetchSource(source, index) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 4500);
        try {
            const response = await fetch(source, {
                cache: 'no-store',
                signal: controller.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            return {
                payload,
                index,
                updatedAt: String(payload?.updated_at || ''),
                hasMemberProfiles: Boolean(payload?.member_profiles),
            };
        } finally {
            window.clearTimeout(timeout);
        }
    }

    async function fetchPayload() {
        const results = await Promise.allSettled(
            SOURCES.map((source, index) => fetchSource(source, index)),
        );
        const candidates = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                candidates.push(result.value);
            } else {
                console.warn('[contributors] source failed', SOURCES[index], result.reason);
            }
        });
        if (!candidates.length) {
            throw new Error('Remote and local contributor data sources both failed');
        }
        candidates.sort((left, right) => (
            right.updatedAt.localeCompare(left.updatedAt)
            || Number(right.hasMemberProfiles) - Number(left.hasMemberProfiles)
            || right.index - left.index
        ));
        return candidates[0].payload;
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

    function identityKey(item) {
        return String(item.person_id || item.github_login || item.name || '').toLowerCase();
    }

    function isSynthetic(item) {
        return [item.name, item.display_name, item.github_login]
            .filter(Boolean)
            .some((value) => SYNTHETIC_IDENTITIES.has(String(value).toLowerCase()));
    }

    function memberProfilesFor(payload) {
        if (payload?.member_profiles) return payload.member_profiles;
        const coreMembers = contributorsFor(payload, 'core_repos');
        const coreIds = new Set(coreMembers.map(identityKey));
        const participants = contributorsFor(payload, 'all_repos')
            .filter((item) => !coreIds.has(identityKey(item)) && !isSynthetic(item));
        return {
            core_repo_names: payload?.core_repos?.scope_repos || [],
            core_members: coreMembers,
            participants,
            unresolved_contributors: [],
        };
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

    function localized(item, field, lang) {
        const value = item?.[field];
        if (value && typeof value === 'object') {
            return String(value[lang] || value.en || value.zh || '');
        }
        return String(value || '');
    }

    function labels(lang) {
        return lang === 'zh'
            ? {
                role: '身份',
                research: '研究方向',
                participation: '参与方向',
                areas: '贡献领域',
                main: '主要贡献',
                advisor: '指导老师',
                pending: '身份待确认',
                commits: '次提交',
                none: '—',
            }
            : {
                role: 'Role',
                research: 'Research direction',
                participation: 'Participation focus',
                areas: 'Contribution areas',
                main: 'Main contributions',
                advisor: 'Advisor',
                pending: 'Identity pending',
                commits: 'commits',
                none: '—',
            };
    }

    function displayName(item, lang) {
        const raw = item.display_name || item.chinese_name || item.name || item.github_login || '';
        if (item.identity_confirmed === false) {
            return `${labels(lang).pending}（${raw}）`;
        }
        return raw;
    }

    function memberNameMarkup(item, lang) {
        const name = escapeHtml(displayName(item, lang));
        const main = item.github_url
            ? `<a href="${escapeHtml(item.github_url)}" target="_blank" rel="noreferrer">${name}</a>`
            : `<strong>${name}</strong>`;
        const login = item.github_login
            ? `<small>@${escapeHtml(item.github_login)}</small>`
            : '';
        return `${main}${login}`;
    }

    function memberContextMarkup(item, lang) {
        const role = localized(item, 'role', lang);
        const advisor = localized(item, 'advisor', lang);
        const parts = [
            role,
            advisor
                ? `${labels(lang).advisor}${lang === 'zh' ? '：' : ': '}${advisor}`
                : '',
        ].filter(Boolean);
        return parts.length
            ? `<small class="contributor-member-context">${escapeHtml(parts.join(' · '))}</small>`
            : '';
    }

    function mainContribution(item, lang) {
        const repos = Array.isArray(item.repos) ? item.repos.join(' · ') : '';
        const commits = Number(item.commits || 0);
        if (!commits && !repos) return '';
        return [
            commits ? `${fmt(commits)} ${labels(lang).commits}` : '',
            repos,
        ].filter(Boolean).join(' · ');
    }

    function detailRow(label, value) {
        return `
            <span class="research-member-detail-row">
                <b>${escapeHtml(label)}</b>
                <span>${escapeHtml(value || '—')}</span>
            </span>
        `;
    }

    function renderProfileList(id, members, kind) {
        const list = document.getElementById(id);
        if (!list) return;
        const lang = currentLang();
        const text = labels(lang);
        list.innerHTML = members.map((item) => {
            const role = localized(item, 'role', lang);
            const research = localized(item, 'research_direction', lang);
            const participation = localized(item, 'participation_direction', lang);
            const areas = item.contribution_areas || item.key_contributions || '';
            const advisor = localized(item, 'advisor', lang);
            const rows = kind === 'core'
                ? [
                    detailRow(text.research, research),
                    detailRow(text.areas, areas),
                    detailRow(text.main, mainContribution(item, lang)),
                    advisor ? detailRow(text.advisor, advisor) : '',
                ]
                : [
                    role ? detailRow(text.role, role) : '',
                    research ? detailRow(text.research, research) : '',
                    participation ? detailRow(text.participation, participation) : '',
                    areas ? detailRow(text.areas, areas) : '',
                    advisor ? detailRow(text.advisor, advisor) : '',
                ];
            return `
                <li>
                    <span class="research-member-identity">${memberNameMarkup(item, lang)}</span>
                    <span class="research-member-details">${rows.filter(Boolean).join('')}</span>
                </li>
            `;
        }).join('');
    }

    function renderMeta(payload, profiles) {
        const all = contributorsFor(payload, 'all_repos');
        const repoCount = new Set(all.flatMap((item) => item.repos || [])).size;
        document.getElementById('contributors-updated').textContent = payload.updated_at || '-';
        document.getElementById('contributors-total').textContent = fmt(all.length);
        document.getElementById('contributors-core-total').textContent = fmt(profiles.core_members.length);
        document.getElementById('contributors-participant-total').textContent = fmt(profiles.participants.length);
        document.getElementById('contributors-repos').textContent = fmt(repoCount);
    }

    function renderCoreTable(contributors) {
        const tbody = document.getElementById('contributors-core-tbody');
        if (!tbody) return;
        const lang = currentLang();
        tbody.innerHTML = contributors.map((item) => `
            <tr>
                <td>${fmt(item.rank)}</td>
                <td><span class="contributor-table-member">${memberNameMarkup(item, lang)}${memberContextMarkup(item, lang)}</span></td>
                <td>${escapeHtml(localized(item, 'research_direction', lang) || labels(lang).none)}</td>
                <td>${escapeHtml(item.contribution_areas || item.key_contributions || labels(lang).none)}</td>
                <td>${escapeHtml(mainContribution(item, lang) || labels(lang).none)}</td>
            </tr>
        `).join('');
    }

    function renderAllTable(contributors) {
        const tbody = document.getElementById('contributors-all-tbody');
        if (!tbody) return;
        const lang = currentLang();
        tbody.innerHTML = contributors.map((item) => {
            const repos = Array.isArray(item.repos) ? item.repos.slice(0, 5).join(', ') : '';
            return `
                <tr>
                    <td>${fmt(item.rank)}</td>
                    <td>${memberNameMarkup(item, lang)}</td>
                    <td>${fmt(item.commits)}</td>
                    <td>${fmt(item.changed_lines)}</td>
                    <td>${fmt(item.added)} / ${fmt(item.deleted)}</td>
                    <td>${fmt(item.active_repos)}<br><small>${escapeHtml(repos)}</small></td>
                    <td>${escapeHtml(item.contribution_areas || item.key_contributions || '')}</td>
                </tr>
            `;
        }).join('');
    }

    function renderPayload(payload) {
        const profiles = memberProfilesFor(payload);
        renderMeta(payload, profiles);
        renderProfileList('contributors-core-member-list', profiles.core_members, 'core');
        renderProfileList('contributors-participant-list', profiles.participants, 'participant');
        renderCoreTable(profiles.core_members);
        renderAllTable(contributorsFor(payload, 'all_repos'));
        const loading = document.getElementById('contributors-members-loading');
        if (loading) loading.hidden = true;
    }

    async function init() {
        const loading = document.getElementById('contributors-loading');
        const content = document.getElementById('contributors-content');
        const error = document.getElementById('contributors-error');
        try {
            currentPayload = await fetchPayload();
            renderPayload(currentPayload);
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
        if (currentPayload) renderPayload(currentPayload);
    });
    document.addEventListener('DOMContentLoaded', init);
})();
