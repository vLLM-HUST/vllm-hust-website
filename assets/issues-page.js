(function () {
    const DATA_URL = window.vllmHustIssuesDataUrl || './data/issues.json';

    const UI = {
        en: {
            issueWord: 'Issue',
            prWord: 'PR',
            priorityLabel: 'Priority',
            categoryLabel: 'Category',
            statusLabel: 'Status',
            progressLabel: 'Progress',
            criteriaLabel: 'Acceptance criteria',
            criteriaMet: 'Met',
            criteriaUnmet: 'Unmet',
            tagsLabel: 'Tags',
            draftPr: 'Draft',
            openPr: 'Open',
            closedPr: 'Closed',
            noCriteria: 'No acceptance criteria recorded.',
        },
        zh: {
            issueWord: '议题',
            prWord: 'PR',
            priorityLabel: '优先级',
            categoryLabel: '类别',
            statusLabel: '状态',
            progressLabel: '进展',
            criteriaLabel: '验收标准',
            criteriaMet: '已达成',
            criteriaUnmet: '未达成',
            tagsLabel: '标签',
            draftPr: '草稿',
            openPr: '开放',
            closedPr: '已关闭',
            noCriteria: '暂无验收标准。',
        },
    };

    const state = {
        data: null,
    };

    function currentLang() {
        if (window.vllmHustSite && window.vllmHustSite.getCurrentLang) return window.vllmHustSite.getCurrentLang();
        const lang = window['vllm-hustCurrentLang'] || document.documentElement.lang || 'en';
        return String(lang).startsWith('zh') ? 'zh' : 'en';
    }

    function pick(value, lang) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value;
        return (value && (value[lang] || value.en || value.zh)) || '';
    }

    function ui(lang = currentLang()) {
        return UI[lang] || UI.en;
    }

    function setText(id, value) {
        const node = document.getElementById(id);
        if (node) node.textContent = value;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function loadJson(url) {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Failed to load ' + url + ': ' + response.status);
        return response.json();
    }

    function renderStats(data, lang) {
        const issues = (data && data.issues) || [];
        const openPrs = issues.filter((issue) => issue.pr && issue.pr.state === 'open').length;
        const blocked = issues.filter((issue) => issue.status === 'blocked').length;
        const draft = issues.filter((issue) => issue.status === 'draft').length;
        setText('issue-stat-total', String(issues.length));
        setText('issue-stat-prs', String(openPrs));
        setText('issue-stat-blocked', String(blocked));
        setText('issue-stat-draft', String(draft));
    }

    function statusBadgeClass(status) {
        if (status === 'blocked') return 'issue-badge issue-badge--blocked';
        if (status === 'draft') return 'issue-badge issue-badge--draft';
        if (status === 'in-progress') return 'issue-badge issue-badge--in-progress';
        return 'issue-badge';
    }

    function prStateLabel(pr, lang) {
        const text = ui(lang);
        if (!pr) return '';
        if (pr.draft) return text.draftPr;
        if (pr.state === 'open') return text.openPr;
        if (pr.state === 'closed') return text.closedPr;
        return pr.state || text.openPr;
    }

    function renderIssue(issue, lang) {
        const text = ui(lang);
        const title = pick(issue.title, lang);
        const summary = pick(issue.summary, lang);
        const progress = pick(issue.progress_summary, lang);
        const statusLabel = pick(issue.status_label, lang) || issue.status || '';
        const category = issue.category || '';
        const priority = issue.priority || '';
        const pr = issue.pr || {};
        const criteria = issue.acceptance_criteria || [];
        const tags = issue.tags || [];
        const links = issue.links || [];

        const criteriaHtml = criteria.length ? `
            <div class="issue-criteria">
              <span class="issue-criteria-heading">${escapeHtml(text.criteriaLabel)}</span>
              <ul class="issue-criteria-list">
                ${criteria.map((criterion) => {
                    const met = !!criterion.met;
                    const label = pick(criterion.label, lang);
                    const note = criterion.note ? pick(criterion.note, lang) : '';
                    return `
                    <li class="issue-criteria-item ${met ? 'is-met' : 'is-unmet'}">
                      <span class="issue-criteria-mark" aria-hidden="true">${met ? '✓' : '✗'}</span>
                      <span class="issue-criteria-body">
                        <span class="issue-criteria-label-text">${escapeHtml(label)}</span>
                        <span class="issue-criteria-state">${met ? escapeHtml(text.criteriaMet) : escapeHtml(text.criteriaUnmet)}</span>
                        ${note ? `<span class="issue-note">${escapeHtml(note)}</span>` : ''}
                      </span>
                    </li>`;
                }).join('')}
              </ul>
            </div>
        ` : `<p class="issue-empty">${escapeHtml(text.noCriteria)}</p>`;

        const tagsHtml = tags.length ? `
            <div class="issue-tags">
              ${tags.map((tag) => `<span class="tag">${escapeHtml(pick(tag, lang))}</span>`).join('')}
            </div>
        ` : '';

        const linksHtml = links.length ? `
            <div class="issue-links tag-list achievement-actions">
              ${links.map((link) => `<a class="action-button" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(pick(link.label, lang))}</a>`).join('')}
            </div>
        ` : '';

        const prHtml = pr.number ? `
            <a class="issue-pr" href="${escapeHtml(pr.url || '#')}" target="_blank" rel="noreferrer">
              <span class="issue-pr-label">${escapeHtml(text.prWord)} #${escapeHtml(pr.number)}</span>
              <span class="issue-pr-state">${escapeHtml(prStateLabel(pr, lang))}</span>
              ${pr.head_branch ? `<span class="issue-pr-branch">${escapeHtml(pr.head_branch)}</span>` : ''}
            </a>
        ` : '';

        return `
          <article class="issue-card" data-status="${escapeHtml(issue.status || '')}" data-category="${escapeHtml(category)}">
            <header class="issue-card-header">
              <div class="issue-card-title-row">
                <span class="issue-number">#${escapeHtml(issue.number)}</span>
                <h3 class="issue-title">${escapeHtml(title)}</h3>
              </div>
              <div class="issue-badges">
                ${category ? `<span class="issue-badge issue-badge--category">${escapeHtml(category)}</span>` : ''}
                ${priority ? `<span class="issue-badge issue-badge--priority">${escapeHtml(priority)}</span>` : ''}
                <span class="${statusBadgeClass(issue.status)}">${escapeHtml(statusLabel)}</span>
              </div>
            </header>
            <p class="issue-summary">${escapeHtml(summary)}</p>
            ${prHtml}
            ${progress ? `<p class="issue-progress"><span class="issue-progress-label">${escapeHtml(text.progressLabel)}</span><span class="issue-progress-text">${escapeHtml(progress)}</span></p>` : ''}
            ${criteriaHtml}
            ${tagsHtml}
            ${linksHtml}
          </article>
        `;
    }

    function renderIssues(lang = currentLang()) {
        const target = document.getElementById('issue-list');
        if (!target || !state.data) return;
        const issues = state.data.issues || [];
        target.innerHTML = issues.map((issue) => renderIssue(issue, lang)).join('');
    }

    function renderDynamic(lang = currentLang()) {
        if (!state.data) return;
        renderStats(state.data, lang);
        renderIssues(lang);
    }

    async function init() {
        const loading = document.getElementById('issues-loading');
        const content = document.getElementById('issues-content');
        const error = document.getElementById('issues-error');
        try {
            const data = await loadJson(DATA_URL);
            state.data = data;
            renderDynamic();
            if (loading) loading.style.display = 'none';
            if (error) error.style.display = 'none';
            if (content) content.style.display = 'block';
        } catch (err) {
            console.error('[issues] failed:', err);
            if (loading) loading.style.display = 'none';
            if (content) content.style.display = 'none';
            if (error) error.style.display = 'block';
        }
    }

    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('vllm-hust:langchange', (event) => {
        renderDynamic((event && event.detail && event.detail.lang) || currentLang());
    });
})();
