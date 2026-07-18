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
                en: 'A SC 2026 paper on utility-guided preemption scheduling for LLM serving under KV-cache pressure.',
                zh: '一篇关于 KV cache 压力下大模型推理服务 utility-guided preemption scheduling 的 SC 2026 论文。',
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
            sortDate: '2026-06-18',
            date: { en: 'June 2026', zh: '2026 年 6 月' },
            kind: { en: 'Community', zh: '社区贡献' },
            title: {
                en: 'Jingyuan Tian PR accepted by the Qwen community',
                zh: '恭喜 Jingyuan 同学的 PR 被 Qwen 社区正式接收',
            },
            body: {
                en: 'Jingyuan Tian contributed a plan-gate fix to qwen-code, and the Qwen community merged it into the official repository.',
                zh: 'Jingyuan Tian 向 qwen-code 贡献了 plan-gate 修复，并已被 Qwen 社区合入官方仓库。',
            },
            tags: [
                { en: 'Qwen', zh: 'Qwen' },
                { en: 'qwen-code', zh: 'qwen-code' },
                { en: 'Merged PR', zh: '已合入 PR' },
            ],
            links: [
                {
                    label: { en: 'QwenLM/qwen-code #5185', zh: 'QwenLM/qwen-code #5185' },
                    href: 'https://github.com/QwenLM/qwen-code/pull/5185',
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
                en: 'A CCCF survey manuscript on domestic LLM inference engines, covering execution backends, state management, compression, and evaluation practice.',
                zh: 'CCCF 通讯专刊综述稿件，系统梳理国产大模型推理引擎、执行后端、状态治理、压缩协同与评测实践。',
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
                en: 'Benchmark documentation for Ascend baselines, same-configuration runs, result submission, and leaderboard publication.',
                zh: 'benchmark 仓提供 Ascend 基线、同配置评测、结果提交和排行榜发布流程文档。',
            },
            tags: [
                { en: 'Benchmark', zh: 'Benchmark' },
                { en: 'Ascend', zh: 'Ascend' },
                { en: 'Same configuration', zh: '同配置评测' },
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

    const OPEN_UPSTREAM_PRS = [
        { repository: 'vLLM', number: 41449, title: 'fix: handle missing parent modules in _has_module', href: 'https://github.com/vllm-project/vllm/pull/41449' },
        { repository: 'vLLM', number: 41507, title: 'fix(v1): avoid false shutdown failures on clean exit', href: 'https://github.com/vllm-project/vllm/pull/41507' },
        { repository: 'vLLM', number: 47789, title: 'fix: tolerate source checkout without vllm metadata', href: 'https://github.com/vllm-project/vllm/pull/47789' },
        { repository: 'vLLM', number: 47793, title: 'Handle missing vLLM metadata in Triton import', href: 'https://github.com/vllm-project/vllm/pull/47793' },
        { repository: 'vLLM', number: 49017, title: '[Perf] Batch KV scale host conversion', href: 'https://github.com/vllm-project/vllm/pull/49017' },
        { repository: 'vLLM', number: 49018, title: '[Perf] Avoid redundant logprobs list materialization', status: 'draft', href: 'https://github.com/vllm-project/vllm/pull/49018' },
        { repository: 'vLLM-Ascend', number: 8958, title: '[BugFix] Fix Qwen2 compiled-path outputs on Ascend', href: 'https://github.com/vllm-project/vllm-ascend/pull/8958' },
        { repository: 'vLLM-Ascend', number: 10735, title: '[BugFix] Persist enable_npugraph_ex override for worker processes', href: 'https://github.com/vllm-project/vllm-ascend/pull/10735' },
        { repository: 'vLLM-Ascend', number: 11422, title: '[Ops][BugFix] Fix NPU memory profiling on Python 3.12', href: 'https://github.com/vllm-project/vllm-ascend/pull/11422' },
        { repository: 'vLLM-Ascend', number: 12316, title: '[BugFix] Fix packaged custom opapi lookup', href: 'https://github.com/vllm-project/vllm-ascend/pull/12316' },
        { repository: 'vLLM-Ascend', number: 12317, title: '[Performance] Reuse DP metadata sync buffers', href: 'https://github.com/vllm-project/vllm-ascend/pull/12317' },
        { repository: 'Triton-Ascend', number: 918, title: '[runtime](fix) skip missing backend entry points', href: 'https://github.com/triton-lang/triton-ascend/pull/918' },
        { repository: 'Triton-Ascend', number: 919, title: '[ascend](fix) disambiguate dependent getDefiningOp calls', href: 'https://github.com/triton-lang/triton-ascend/pull/919' },
        { repository: 'Triton-Ascend', number: 920, title: '[ascend](fix) allow MemAccOp factory specializations', href: 'https://github.com/triton-lang/triton-ascend/pull/920' },
        { repository: 'Triton-Ascend', number: 922, title: '[build](fix) fix Python module build dependencies', href: 'https://github.com/triton-lang/triton-ascend/pull/922' },
        { repository: 'Triton-Ascend', number: 923, title: '[tools](fix) trim optional dialect registrations', href: 'https://github.com/triton-lang/triton-ascend/pull/923' },
    ];

    const UPSTREAM_REPOSITORIES = [
        {
            id: 'vllm',
            name: 'vLLM',
            owner: 'vllm-project',
            href: 'https://github.com/vllm-project/vllm',
        },
        {
            id: 'vllm-ascend',
            name: 'vLLM-Ascend',
            owner: 'vllm-project',
            href: 'https://github.com/vllm-project/vllm-ascend',
        },
        {
            id: 'triton-ascend',
            name: 'Triton-Ascend',
            owner: 'triton-lang',
            href: 'https://github.com/triton-lang/triton-ascend',
        },
    ];

    const RESULT_REPOSITORIES = [
        {
            name: 'BiDKV',
            repositoryName: 'vllm-ascend-hust-bidkv',
            summary: {
                en: 'A KV-cache reclamation plugin for vLLM.',
                zh: '用于 vLLM 的 KV Cache 回收插件。',
            },
            publication: { en: 'SC 2026', zh: 'SC 2026' },
            team: [
                {
                    role: { en: 'Lead authors', zh: '主要作者' },
                    names: { en: 'Yanbo Chen · Mingqi Wang', zh: '陈彦博 · 王明琪' },
                },
                {
                    role: { en: 'Advisor', zh: '指导老师' },
                    names: { en: 'Shuhao Zhang', zh: '张书豪' },
                },
            ],
            repository: 'https://github.com/vLLM-HUST/vllm-ascend-hust-bidkv',
        },
    ];

    const UI = {
        en: {
            throughputUnit: 'tok/s',
            workloadFallback: 'Other',
            modelFallback: 'Unknown model',
            milestoneBenchmarkTitle: 'Benchmark results',
            milestoneBenchmarkBody: (groups, pairs) => `${groups} comparison groups and ${pairs} preferred comparisons are available on the leaderboard.`,
            milestoneHardTitle: 'Validation coverage',
            milestoneHardBody: (scopes) => `${scopes} validation scopes are tracked with status and regression context.`,
            milestoneBaselineTitle: 'Baseline comparison',
            milestoneBaselineBody: (pairs) => `${pairs} comparisons show vllm-hust results against the vLLM baseline.`,
            milestoneWorkstationTitle: 'Workstation access',
            milestoneWorkstationBody: 'The website can link to the live vllm-hust workstation used for serving workflows.',
            currentDate: 'Current',
            milestoneKind: 'Project',
            latestLabel: 'Latest',
            repositoryLabel: 'Explore repository',
            teamLabel: 'Project team',
            openStatus: 'Open',
            draftStatus: 'Draft',
            pullRequestCount: (count) => `${count} pull requests`,
            collapseRepository: (name) => `Collapse ${name} pull requests`,
            expandRepository: (name) => `Show ${name} pull requests`,
            repositoryLink: 'Open repository',
        },
        zh: {
            throughputUnit: 'token/s',
            workloadFallback: '其他',
            modelFallback: '未知模型',
            milestoneBenchmarkTitle: 'Benchmark 结果',
            milestoneBenchmarkBody: (groups, pairs) => `排行榜目前展示 ${groups} 个对比组和 ${pairs} 个优选对比。`,
            milestoneHardTitle: '验证覆盖',
            milestoneHardBody: (scopes) => `当前展示 ${scopes} 个验证范围，并保留状态和回归上下文。`,
            milestoneBaselineTitle: '基线对比',
            milestoneBaselineBody: (pairs) => `${pairs} 个对比用于展示 vllm-hust 与 vLLM 基线的差异。`,
            milestoneWorkstationTitle: 'Workstation 入口',
            milestoneWorkstationBody: '网站可以链接到用于推理服务流程的 vllm-hust workstation。',
            currentDate: '当前',
            milestoneKind: '项目',
            latestLabel: '最新',
            repositoryLabel: '查看优化仓库',
            teamLabel: '项目团队',
            openStatus: '开放',
            draftStatus: '草稿',
            pullRequestCount: (count) => `${count} 个 PR`,
            collapseRepository: (name) => `收起 ${name} PR`,
            expandRepository: (name) => `查看 ${name} PR`,
            repositoryLink: '打开仓库',
        },
    };

    const state = {
        versionMeta: null,
        entries: [],
        compare: null,
    };

    let expandedUpstreamRepository = null;

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

    function renderResultRepositories(lang = currentLang()) {
        const target = document.getElementById('result-repository-list');
        if (!target) return;
        target.innerHTML = RESULT_REPOSITORIES.map((repository) => `
            <a class="result-repository-card" href="${repository.repository}" target="_blank" rel="noreferrer" aria-label="${repository.name} · ${repository.repositoryName}">
                <div class="result-repository-content">
                <div class="result-repository-source"><span>vLLM-HUST /</span><strong>${repository.repositoryName}</strong></div>
                    <div class="result-repository-title">
                        <h3>${repository.name}</h3>
                        <span>${pick(repository.publication, lang)}</span>
                    </div>
                    <p>${pick(repository.summary, lang)}</p>
                </div>
                ${repository.team?.length ? `
                    <div class="result-repository-team">
                        <span class="result-repository-team-kicker">${ui(lang).teamLabel}</span>
                        <div class="result-repository-team-list">
                            ${repository.team.map((member) => `
                                <div class="result-repository-team-row">
                                    <span>${pick(member.role, lang)}</span>
                                    <strong>${pick(member.names, lang)}</strong>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                <span class="result-repository-link">${ui(lang).repositoryLabel}<strong aria-hidden="true">↗</strong></span>
            </a>
        `).join('');
    }

    function renderUpstreamPRs(lang = currentLang()) {
        const target = document.getElementById('upstream-repository-browser');
        if (!target) return;
        const repositories = UPSTREAM_REPOSITORIES.map((repository) => ({
            ...repository,
            pullRequests: OPEN_UPSTREAM_PRS.filter((pullRequest) => pullRequest.repository === repository.name),
        }));
        const activeRepository = repositories.find((repository) => repository.id === expandedUpstreamRepository);

        const renderPullRequests = (repository) => repository.pullRequests.map((pullRequest) => {
            const status = pullRequest.status === 'draft' ? ui(lang).draftStatus : ui(lang).openStatus;
            return `
                <a class="upstream-pr-row" href="${pullRequest.href}" target="_blank" rel="noreferrer">
                    <span class="upstream-pr-number">#${pullRequest.number}</span>
                    <span class="upstream-pr-title">${pullRequest.title}</span>
                    <strong data-status="${pullRequest.status || 'open'}">${status}</strong>
                    <span class="upstream-pr-link" aria-hidden="true">↗</span>
                </a>
            `;
        }).join('');

        target.innerHTML = `
            <div class="upstream-repository-grid">
                ${repositories.map((repository) => {
                    const isExpanded = repository.id === expandedUpstreamRepository;
                    const label = isExpanded ? ui(lang).collapseRepository(repository.name) : ui(lang).expandRepository(repository.name);
                    return `
                        <button id="upstream-repository-${repository.id}" class="upstream-repository-card ${isExpanded ? 'is-active' : ''}" type="button" data-repository="${repository.id}" aria-expanded="${isExpanded}" aria-controls="upstream-pr-details" aria-label="${label}">
                            <span class="upstream-repository-owner">${repository.owner} /</span>
                            <strong>${repository.name}</strong>
                            <span class="upstream-repository-count">${ui(lang).pullRequestCount(repository.pullRequests.length)}</span>
                            <span class="upstream-repository-chevron" aria-hidden="true">⌄</span>
                        </button>
                    `;
                }).join('')}
            </div>
            <div id="upstream-pr-details" class="upstream-pr-details" role="region" ${activeRepository ? `aria-labelledby="upstream-repository-${activeRepository.id}"` : 'hidden'}>
                ${activeRepository ? `
                    <div class="upstream-pr-details-head">
                        <strong>${activeRepository.name}</strong>
                        <a href="${activeRepository.href}" target="_blank" rel="noreferrer">${ui(lang).repositoryLink}<span aria-hidden="true">↗</span></a>
                    </div>
                    <div class="upstream-pr-list">${renderPullRequests(activeRepository)}</div>
                ` : ''}
            </div>
        `;

        target.querySelectorAll('.upstream-repository-card').forEach((button) => {
            button.addEventListener('click', () => {
                const repositoryId = button.dataset.repository;
                expandedUpstreamRepository = expandedUpstreamRepository === repositoryId ? null : repositoryId;
                renderUpstreamPRs(lang);
                document.getElementById(`upstream-repository-${repositoryId}`)?.focus({ preventScroll: true });
            });
        });
    }

    function renderDynamic(lang = currentLang()) {
        renderResultRepositories(lang);
        renderUpstreamPRs(lang);
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
