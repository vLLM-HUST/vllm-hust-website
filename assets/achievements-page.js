(function () {
    const DATA_URLS = {
        versionMeta: './data/version_meta.json',
        single: './data/leaderboard_single.json',
        multi: './data/leaderboard_multi.json',
        compare: './data/leaderboard_compare.json',
        contributors: './data/core_contributors.json',
    };

    const ACHIEVEMENTS = [
        {
            sortDate: '2026-07-02',
            date: { en: 'July 2026', zh: '2026 年 7 月' },
            kind: { en: 'Publication', zh: '论文' },
            title: {
                en: 'BidKV at SC 2026',
                zh: 'BidKV 入选 SC 2026',
            },
            body: {
                en: 'SC 2026 paper on utility-guided preemption scheduling for KV-pressure LLM serving, connecting vllm-hust serving research with system-level scheduling evidence.',
                zh: 'SC 2026 论文，研究 KV cache 压力下大模型推理服务的 utility-guided preemption scheduling，体现 vllm-hust 在推理服务调度方向的系统研究成果。',
            },
            tags: [
                { en: 'SC 2026', zh: 'SC 2026' },
                { en: 'KV cache', zh: 'KV cache' },
                { en: 'LLM serving', zh: 'LLM serving' },
            ],
            links: [
                {
                    label: { en: 'Open PDF', zh: '查看 PDF' },
                    href: './assets/papers/bidkv-sc2026.pdf',
                },
            ],
        },
        {
            sortDate: '2026-07-01',
            date: { en: 'July 2026', zh: '2026 年 7 月' },
            kind: { en: 'Survey', zh: '综述' },
            title: {
                en: 'Domestic-hardware inference engine survey',
                zh: '国产算力推理引擎综述',
            },
            body: {
                en: 'CCCF survey manuscript covering domestic LLM inference engines, execution backends, state management, compression, and evaluation evidence.',
                zh: 'CCCF 通讯专刊综述稿件，系统梳理国产大模型推理引擎、执行后端、状态治理、压缩协同与评测证据链。',
            },
            tags: [
                { en: 'CCCF', zh: 'CCCF' },
                { en: 'Survey', zh: '综述' },
                { en: 'LaTeX', zh: 'LaTeX' },
            ],
            links: [
                {
                    label: { en: 'Open PDF', zh: '查看 PDF' },
                    href: 'https://github.com/vLLM-HUST/cccf-domestic-inference-engine-survey/blob/main/rendered/main.pdf',
                },
                {
                    label: { en: 'Repository', zh: '仓库' },
                    href: 'https://github.com/vLLM-HUST/cccf-domestic-inference-engine-survey',
                },
            ],
        },
        {
            sortDate: '2026-07-01',
            date: { en: 'July 2026', zh: '2026 年 7 月' },
            kind: { en: 'Benchmark', zh: '评测' },
            title: {
                en: 'Ascend performance evaluation documentation',
                zh: 'Ascend 性能评测文档',
            },
            body: {
                en: 'Benchmark repository documentation for official Ascend goal baselines, same-spec runs, canonical submissions, and website leaderboard publication.',
                zh: 'benchmark 仓沉淀的官方 Ascend goal baseline、same-spec 评测、canonical submission 与网站 leaderboard 发布链路文档。',
            },
            tags: [
                { en: 'Benchmark', zh: 'Benchmark' },
                { en: 'Ascend', zh: 'Ascend' },
                { en: 'same-spec', zh: '同规格评测' },
            ],
            links: [
                {
                    label: { en: 'Baseline docs', zh: '基线文档' },
                    href: 'https://github.com/vLLM-HUST/vllm-hust-benchmark#official-goal-baseline',
                },
                {
                    label: { en: 'Handoff doc', zh: '交接文档' },
                    href: 'https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/main/docs/LEADERBOARD_HANDOFF.md',
                },
            ],
        },
    ];

    const UI = {
        en: {
            throughputUnit: 'tok/s',
            workloadFallback: 'Other',
            modelFallback: 'Unknown model',
            milestoneBenchmarkTitle: 'Benchmark snapshot pipeline',
            milestoneBenchmarkBody: (groups, pairs) => `${groups} compare groups and ${pairs} preferred pairs are published as static JSON snapshots.`,
            milestoneHardTitle: 'Validation tracking',
            milestoneHardBody: (scopes) => `${scopes} validation scopes are tracked with pass/fail status and regression context.`,
            milestoneBaselineTitle: 'Official baseline comparison',
            milestoneBaselineBody: (pairs) => `${pairs} goal-progress pairs compare vllm-hust against the official vLLM baseline.`,
            milestoneWorkstationTitle: 'Workstation surface',
            milestoneWorkstationBody: 'The website can embed or link to a live vllm-hust workstation for operator-facing serving workflows.',
            currentDate: 'Current',
            milestoneKind: 'Project',
            latestLabel: 'Latest',
        },
        zh: {
            throughputUnit: 'token/s',
            workloadFallback: '其他',
            modelFallback: '未知模型',
            milestoneBenchmarkTitle: 'Benchmark 快照流水线',
            milestoneBenchmarkBody: (groups, pairs) => `当前以静态 JSON 快照发布 ${groups} 个对比组和 ${pairs} 个优选对比对。`,
            milestoneHardTitle: '验证项追踪',
            milestoneHardBody: (scopes) => `当前追踪 ${scopes} 个验证范围，并保留通过状态与回归上下文。`,
            milestoneBaselineTitle: '官方基线对比',
            milestoneBaselineBody: (pairs) => `${pairs} 个目标进展对比对用于比较 vllm-hust 与官方 vLLM 基线。`,
            milestoneWorkstationTitle: 'Workstation 入口',
            milestoneWorkstationBody: '网站可以嵌入或链接到实时 vllm-hust workstation，支撑面向操作者的推理服务工作流。',
            currentDate: '当前',
            milestoneKind: '项目',
            latestLabel: '最新',
        },
    };

    const state = {
        versionMeta: null,
        entries: [],
        compare: null,
    };

    function fmt(value) {
        return Number(value || 0).toLocaleString();
    }

    function currentLang() {
        return window.vllmHustSite?.getCurrentLang?.() || 'en';
    }

    function pick(value, lang) {
        if (typeof value === 'string') return value;
        return value?.[lang] || value?.en || value?.zh || '';
    }

    function ui(lang = currentLang()) {
        return UI[lang] || UI.en;
    }

    function getEngine(entry) {
        return String(entry?.engine || entry?.metadata?.engine || 'unknown').trim();
    }

    function getWorkload(entry, lang = currentLang()) {
        return String(entry?.workload?.name || entry?.metadata?.workload || ui(lang).workloadFallback).trim();
    }

    function getModel(entry, lang = currentLang()) {
        return String(entry?.model?.display_name || entry?.model?.name || ui(lang).modelFallback).trim();
    }

    async function loadJson(url) {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
        return response.json();
    }

    function setText(id, value) {
        const node = document.getElementById(id);
        if (node) node.textContent = value;
    }

    function renderStats(entries, compare, contributors) {
        setText('achievement-stat-runs', fmt(entries.length));
        setText('achievement-stat-models', fmt(new Set(entries.map((entry) => getModel(entry))).size));
        setText('achievement-stat-workloads', fmt(new Set(entries.map((entry) => getWorkload(entry))).size));
        setText('achievement-stat-contributors', fmt(contributors?.all_repos?.contributors?.length || 0));
        setText('achievement-stat-groups', fmt(compare?.group_count || 0));
        setText('achievement-stat-hard', fmt(compare?.hard_constraints?.scope_count || 0));
    }

    function buildMilestones(compare, lang = currentLang()) {
        const text = ui(lang);
        const hard = compare?.hard_constraints || {};
        const goal = compare?.goal_progress || {};
        const groupCount = fmt(compare?.group_count || 0);
        const preferredPairCount = fmt(compare?.preferred_pair_count || 0);
        const hardScopeCount = fmt(hard.scope_count || 0);
        const goalPairCount = fmt(goal.pair_count || (goal.pairs || []).length || 0);
        return [
            {
                sortDate: '2026-07-01',
                date: text.currentDate,
                kind: text.milestoneKind,
                title: text.milestoneBenchmarkTitle,
                body: text.milestoneBenchmarkBody(groupCount, preferredPairCount),
                tags: [
                    { en: 'Leaderboard', zh: '排行榜' },
                    { en: 'JSON snapshots', zh: 'JSON 快照' },
                ],
                links: [],
            },
            {
                sortDate: '2026-07-01',
                date: text.currentDate,
                kind: text.milestoneKind,
                title: text.milestoneHardTitle,
                body: text.milestoneHardBody(hardScopeCount),
                tags: [
                    { en: 'Validation', zh: '验证' },
                    { en: 'Regression context', zh: '回归上下文' },
                ],
                links: [],
            },
            {
                sortDate: '2026-07-01',
                date: text.currentDate,
                kind: text.milestoneKind,
                title: text.milestoneBaselineTitle,
                body: text.milestoneBaselineBody(goalPairCount),
                tags: [
                    { en: 'Baseline', zh: '基线' },
                    { en: 'vLLM', zh: 'vLLM' },
                ],
                links: [],
            },
            {
                sortDate: '2026-07-01',
                date: text.currentDate,
                kind: text.milestoneKind,
                title: text.milestoneWorkstationTitle,
                body: text.milestoneWorkstationBody,
                tags: [
                    { en: 'Workstation', zh: 'Workstation' },
                    { en: 'Operator workflow', zh: '操作工作流' },
                ],
                links: [],
            },
        ];
    }

    function normalizeAchievement(item, lang) {
        return {
            sortDate: item.sortDate || '0000-00-00',
            date: pick(item.date, lang) || item.date || '',
            kind: pick(item.kind, lang) || item.kind || '',
            title: pick(item.title, lang),
            body: pick(item.body, lang),
            tags: item.tags || [],
            links: item.links || [],
        };
    }

    function renderTimeline(compare, lang = currentLang()) {
        const target = document.getElementById('achievement-timeline');
        if (!target) return;
        const items = [
            ...ACHIEVEMENTS.map((item) => normalizeAchievement(item, lang)),
            ...buildMilestones(compare, lang).map((item) => normalizeAchievement(item, lang)),
        ].sort((left, right) => right.sortDate.localeCompare(left.sortDate));

        target.innerHTML = items.map((item) => `
            <article class="achievement-item ${item === items[0] ? 'is-latest' : ''}">
                <div class="achievement-time">
                    <span>${item.date}</span>
                    <strong>${item.kind}</strong>
                </div>
                <div class="achievement-body">
                    <div class="achievement-head">
                        <h3>${item.title}</h3>
                        ${item === items[0] ? `<span class="achievement-latest">${ui(lang).latestLabel}</span>` : ''}
                    </div>
                    <p>${item.body}</p>
                    ${item.tags.length ? `
                        <div class="tag-list">
                            ${item.tags.map((tag) => `<span class="tag">${pick(tag, lang)}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${item.links.length ? `
                        <div class="tag-list achievement-actions">
                            ${item.links.map((link) => `<a class="action-button" href="${link.href}" target="_blank" rel="noreferrer">${pick(link.label, lang)}</a>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </article>
        `).join('');
    }

    function renderDynamic(lang = currentLang()) {
        if (state.compare) renderTimeline(state.compare, lang);
    }

    async function init() {
        const loading = document.getElementById('achievements-loading');
        const content = document.getElementById('achievements-content');
        const error = document.getElementById('achievements-error');
        try {
            const [versionMeta, single, multi, compare, contributors] = await Promise.all([
                loadJson(DATA_URLS.versionMeta),
                loadJson(DATA_URLS.single),
                loadJson(DATA_URLS.multi),
                loadJson(DATA_URLS.compare),
                loadJson(DATA_URLS.contributors),
            ]);
            const entries = [...single, ...multi];
            state.versionMeta = versionMeta;
            state.entries = entries;
            state.compare = compare;
            renderStats(entries, compare, contributors);
            renderDynamic();
            if (loading) loading.style.display = 'none';
            if (error) error.style.display = 'none';
            if (content) content.style.display = 'block';
        } catch (err) {
            console.error('[achievements] failed:', err);
            if (loading) loading.style.display = 'none';
            if (content) content.style.display = 'none';
            if (error) error.style.display = 'block';
        }
    }

    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('vllm-hust:langchange', (event) => {
        renderDynamic(event.detail?.lang || currentLang());
    });
})();
