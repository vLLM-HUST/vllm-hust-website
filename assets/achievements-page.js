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
            sortDate: '2026-07-22',
            date: { en: 'Jul 22, 2026', zh: '2026 年 7 月 22 日' },
            category: 'publication',
            kind: { en: 'Publication', zh: '论文' },
            status: { en: 'Accepted · SC 2026', zh: '已接收 · SC 2026' },
            title: {
                en: 'DiffSpec: Accelerating Long Sequence Generation with Differential Speculative Decoding',
                zh: 'DiffSpec：面向长序列生成的差分投机解码加速',
            },
            body: {
                en: 'An accepted SC 2026 system for allocating speculative effort by position-specific utility during long-sequence generation, with a public Ascend implementation and reproducibility evidence.',
                zh: 'SC 2026 已接收成果：依据长序列生成中的位置效用分配投机计算，并公开 Ascend 实现与可复现实验证据。',
            },
            tags: [
                { en: 'SC 2026', zh: 'SC 2026' },
                { en: 'Speculative decoding', zh: '投机解码' },
                { en: 'Long context', zh: '长序列' },
            ],
            links: [
                {
                    label: { en: 'Repository', zh: '成果仓库' },
                    href: 'https://github.com/vLLM-HUST/vllm-ascend-hust-diffspec',
                },
            ],
        },
        {
            sortDate: '2026-07-02',
            date: { en: 'July 2026', zh: '2026 年 7 月' },
            category: 'publication',
            kind: { en: 'Publication', zh: '论文' },
            status: { en: 'Accepted · SC 2026', zh: '已接收 · SC 2026' },
            title: {
                en: 'BidKV: Utility-Guided Preemption Scheduling for KV-Pressure LLM Serving',
                zh: 'BidKV：KV 压力下大模型服务的效用引导抢占调度',
            },
            body: {
                en: 'Yanbo Chen, Mingqi Wang, Shuhao Zhang, Xiaofei Liao, and Hai Jin. The public artifact implements utility-guided KV-cache reclamation and preemption scheduling for vLLM.',
                zh: '作者：陈彦博、王明琪、张书豪、廖小飞、金海。公开制品实现了面向 vLLM 的效用引导 KV Cache 回收与抢占调度。',
            },
            tags: [
                { en: 'SC 2026', zh: 'SC 2026' },
                { en: 'KV cache', zh: 'KV Cache' },
                { en: 'LLM serving', zh: '推理服务' },
            ],
            links: [
                {
                    label: { en: 'Open PDF', zh: '查看 PDF' },
                    href: './assets/papers/bidkv-sc2026.pdf',
                },
                {
                    label: { en: 'Repository', zh: '成果仓库' },
                    href: 'https://github.com/vLLM-HUST/vllm-ascend-hust-bidkv',
                },
            ],
        },
        {
            sortDate: '2026-06-18',
            date: { en: 'Jun 18, 2026', zh: '2026 年 6 月 18 日' },
            category: 'community',
            kind: { en: 'Upstream contribution', zh: '上游贡献' },
            status: { en: 'Merged', zh: '已合入' },
            title: {
                en: 'Plan-gate fix merged into Qwen Code',
                zh: 'Plan-gate 修复合入 Qwen Code',
            },
            body: {
                en: 'Jingyuan Tian contributed an AbortSignal isolation fix for the plan gate, and the Qwen community merged it into the official qwen-code repository.',
                zh: 'Jingyuan Tian 提交了 plan gate 的 AbortSignal 隔离修复，并由 Qwen 社区合入 qwen-code 官方仓库。',
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
            sortDate: '2026-05-18',
            date: { en: 'May 18, 2026', zh: '2026 年 5 月 18 日' },
            category: 'technical',
            kind: { en: 'Technical publication', zh: '技术发表' },
            status: { en: 'Published on vLLM Blog', zh: '发表于 vLLM 官方博客' },
            title: {
                en: 'vLLM x Novita AI: PegaFlow for Production-Grade External KV Cache',
                zh: 'vLLM × Novita AI：面向生产环境的外部 KV Cache 系统 PegaFlow',
            },
            body: {
                en: 'A joint technical article by Novita AI and the vLLM Team on external KV ownership, shared cache pools, RDMA, SSD tiers, and production serving integration.',
                zh: 'Novita AI 与 vLLM Team 联合发布的技术文章，介绍外部 KV 所有权、共享缓存池、RDMA、SSD 分层与生产推理集成。',
            },
            tags: [
                { en: 'vLLM Blog', zh: 'vLLM 官方博客' },
                { en: 'External KV cache', zh: '外部 KV Cache' },
                { en: 'Production serving', zh: '生产推理' },
            ],
            links: [
                {
                    label: { en: 'Read article', zh: '阅读文章' },
                    href: 'https://vllm.ai/blog/2026-05-18-pegaflow',
                },
                {
                    label: { en: 'Organization mirror', zh: '组织镜像' },
                    href: 'https://github.com/vLLM-HUST/pegaflow-hust',
                },
            ],
        },
        {
            sortDate: '2026-03-24',
            date: { en: 'Mar 24, 2026', zh: '2026 年 3 月 24 日' },
            category: 'technical',
            kind: { en: 'Benchmark release', zh: '评测发布' },
            status: { en: 'Public', zh: '已公开' },
            title: {
                en: 'Reproducible vLLM-HUST benchmark workflow',
                zh: 'vLLM-HUST 可复现评测流程',
            },
            body: {
                en: 'The public benchmark repository standardizes baselines, aligned-configuration runs, result submission, schema validation, and leaderboard publication.',
                zh: '公开 benchmark 仓统一了基线、同配置运行、结果提交、Schema 验证与排行榜发布流程。',
            },
            tags: [
                { en: 'Benchmark', zh: 'Benchmark' },
                { en: 'Reproducibility', zh: '可复现性' },
                { en: 'Ascend', zh: 'Ascend' },
            ],
            links: [
                {
                    label: { en: 'Repository', zh: '仓库' },
                    href: 'https://github.com/vLLM-HUST/vllm-hust-benchmark',
                },
                {
                    label: { en: 'Leaderboard', zh: '性能排行榜' },
                    href: './leaderboard.html',
                },
            ],
        },
        {
            sortDate: '2026-03-19',
            date: { en: 'Mar 19, 2026', zh: '2026 年 3 月 19 日' },
            category: 'technical',
            kind: { en: 'Platform release', zh: '平台发布' },
            status: { en: 'Public', zh: '已公开' },
            title: {
                en: 'vLLM-HUST public runtime repository',
                zh: 'vLLM-HUST 推理运行时公开仓库',
            },
            body: {
                en: 'The upstream-compatible runtime fork opened as the shared execution foundation for domestic-hardware enablement, plugins, benchmarks, and serving experiments.',
                zh: '兼容上游的推理运行时仓库公开，作为国产硬件适配、插件、评测与服务实验的共同执行基础。',
            },
            tags: [
                { en: 'Runtime', zh: '推理运行时' },
                { en: 'Open source', zh: '开源' },
                { en: 'Domestic hardware', zh: '国产硬件' },
            ],
            links: [
                {
                    label: { en: 'Repository', zh: '仓库' },
                    href: 'https://github.com/vLLM-HUST/vllm-hust',
                },
            ],
        },
    ];

    const OPEN_UPSTREAM_PRS = [
        { repository: 'vLLM', number: 47793, title: 'Handle missing vLLM metadata in Triton import', status: 'needs-label', href: 'https://github.com/vllm-project/vllm/pull/47793' },
        { repository: 'vLLM', number: 49034, title: 'fix(v1): avoid false shutdown failures on clean exit', status: 'needs-label', href: 'https://github.com/vllm-project/vllm/pull/49034' },
        { repository: 'vLLM', number: 49035, title: 'fix: handle missing parent modules in _has_module', status: 'needs-label', href: 'https://github.com/vllm-project/vllm/pull/49035' },
        { repository: 'vLLM-Ascend', number: 12316, title: '[BugFix] Fix packaged custom opapi lookup', status: 'draft', href: 'https://github.com/vllm-project/vllm-ascend/pull/12316' },
        { repository: 'vLLM-Ascend', number: 12317, title: '[Performance][Worker] Reuse DP metadata sync buffers', status: 'review-requested', href: 'https://github.com/vllm-project/vllm-ascend/pull/12317' },
        { repository: 'vLLM-Ascend', number: 12342, title: '[BugFix] Persist enable_npugraph_ex override for worker processes', status: 'review-requested', href: 'https://github.com/vllm-project/vllm-ascend/pull/12342' },
        { repository: 'vLLM-Ascend', number: 12343, title: '[Ops][BugFix] Fix Qwen2 compiled-path outputs on Ascend', status: 'evidence-pending', href: 'https://github.com/vllm-project/vllm-ascend/pull/12343' },
        { repository: 'vLLM-Ascend', number: 12344, title: '[Ops][BugFix] Fix NPU memory profiling on Python 3.12', status: 'ready-evidence', href: 'https://github.com/vllm-project/vllm-ascend/pull/12344' },
        { repository: 'Triton-Ascend', number: 918, title: '[runtime](fix) skip missing backend entry points', status: 'review-requested', href: 'https://github.com/triton-lang/triton-ascend/pull/918' },
        { repository: 'Triton-Ascend', number: 919, title: '[ascend](fix) disambiguate dependent getDefiningOp calls', status: 'review-requested', href: 'https://github.com/triton-lang/triton-ascend/pull/919' },
        { repository: 'Triton-Ascend', number: 920, title: '[ascend](fix) allow MemAccOp factory specializations', status: 'review-requested', href: 'https://github.com/triton-lang/triton-ascend/pull/920' },
        { repository: 'Triton-Ascend', number: 922, title: '[build](fix) fix Python module build dependencies', status: 'review-requested', href: 'https://github.com/triton-lang/triton-ascend/pull/922' },
        { repository: 'Triton-Ascend', number: 923, title: '[tools](fix) trim optional dialect registrations', status: 'ci-retry', href: 'https://github.com/triton-lang/triton-ascend/pull/923' },
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
            name: 'BidKV',
            repositoryName: 'vllm-ascend-hust-bidkv',
            summary: {
                en: 'A KV-cache reclamation plugin for vLLM.',
                zh: '用于 vLLM 的 KV Cache 回收插件。',
            },
            publication: { en: 'Accepted · SC 2026', zh: '已接收 · SC 2026' },
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
        {
            name: 'DiffSpec',
            repositoryName: 'vllm-ascend-hust-diffspec',
            summary: {
                en: 'A differential speculative decoding acceleration system for ultra-long-sequence inference.',
                zh: '面向超长序列推理的差分投机解码加速系统。',
            },
            publication: { en: 'Accepted · SC 2026', zh: '已接收 · SC 2026' },
            team: [
                {
                    role: { en: 'Lead author', zh: '主要作者' },
                    names: { en: 'Zhongcheng Du', zh: '杜忠承' },
                },
                {
                    role: { en: 'Advisor', zh: '指导老师' },
                    names: { en: 'Yu Huang', zh: '黄禹' },
                },
            ],
            repository: 'https://github.com/vLLM-HUST/vllm-ascend-hust-diffspec',
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
            needsLabelStatus: 'Needs label',
            reviewRequestedStatus: 'Review requested',
            readyEvidenceStatus: 'Real-NPU evidence added',
            evidencePendingStatus: 'Draft · Reproducer needed',
            ciRetryStatus: 'CI retry needed',
            pullRequestCount: (count) => `${count} pull requests`,
            collapseRepository: (name) => `Collapse ${name} pull requests`,
            expandRepository: (name) => `Show ${name} pull requests`,
            repositoryLink: 'Open repository',
            filterLabels: {
                all: 'All',
                publication: 'Papers',
                technical: 'Technical',
                community: 'Community',
            },
            releaseCount: (count) => `${count} releases`,
            timelineEmpty: 'No releases match this filter.',
            timelineFilterLabel: 'Filter achievement timeline',
            releaseLineLabel: 'Achievement release line',
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
            needsLabelStatus: '待上游标签',
            reviewRequestedStatus: '已请求评审',
            readyEvidenceStatus: '实机证据已补',
            evidencePendingStatus: 'Draft · 待复现问题',
            ciRetryStatus: '待重跑 CI',
            pullRequestCount: (count) => `${count} 个 PR`,
            collapseRepository: (name) => `收起 ${name} PR`,
            expandRepository: (name) => `查看 ${name} PR`,
            repositoryLink: '打开仓库',
            filterLabels: {
                all: '全部',
                publication: '论文',
                technical: '技术发布',
                community: '社区贡献',
            },
            releaseCount: (count) => `${count} 项成果`,
            timelineEmpty: '当前分类下暂无成果。',
            timelineFilterLabel: '筛选成果时间轴',
            releaseLineLabel: '成果发布线',
        },
    };

    const state = {
        versionMeta: null,
        entries: [],
        compare: null,
    };

    let expandedUpstreamRepository = null;
    let activeAchievementFilter = 'all';

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
            category: item.category || 'technical',
            kind: pick(item.kind, lang) || item.kind || '',
            status: pick(item.status, lang) || '',
            title: pick(item.title, lang),
            body: pick(item.body, lang),
            tags: item.tags || [],
            links: item.links || [],
        };
    }

    function formatReleaseMonth(monthKey, lang) {
        const [year, month] = monthKey.split('-').map(Number);
        if (lang === 'zh') return `${year} 年 ${month} 月`;
        return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
            .format(new Date(Date.UTC(year, month - 1, 1)));
    }

    function renderReleaseLine(items, lang) {
        const target = document.getElementById('achievement-release-line');
        if (!target) return;
        target.setAttribute('aria-label', ui(lang).releaseLineLabel);
        const months = new Map();
        items.forEach((item) => {
            const month = item.sortDate.slice(0, 7);
            if (!months.has(month)) months.set(month, []);
            months.get(month).push(item);
        });
        target.innerHTML = Array.from(months.entries()).map(([month, monthItems], index) => `
            <div class="achievement-release-node ${index === 0 ? 'is-latest' : ''}">
                <span>${formatReleaseMonth(month, lang)}</span>
                <strong>${ui(lang).releaseCount(monthItems.length)}</strong>
                <small>${Array.from(new Set(monthItems.map((item) => item.kind))).join(' · ')}</small>
            </div>
        `).join('');
    }

    function renderTimeline(lang = currentLang()) {
        const target = document.getElementById('achievement-timeline');
        if (!target) return;
        const allItems = ACHIEVEMENTS
            .map((item) => normalizeAchievement(item, lang))
            .sort((left, right) => right.sortDate.localeCompare(left.sortDate));
        const items = activeAchievementFilter === 'all'
            ? allItems
            : allItems.filter((item) => item.category === activeAchievementFilter);

        document.querySelectorAll('.achievement-filter-button').forEach((button) => {
            const filter = button.dataset.achievementFilter;
            const isActive = filter === activeAchievementFilter;
            button.textContent = ui(lang).filterLabels[filter] || filter;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
        document.getElementById('achievement-filter')
            ?.setAttribute('aria-label', ui(lang).timelineFilterLabel);
        renderReleaseLine(items, lang);

        if (!items.length) {
            target.innerHTML = `<div class="empty-state">${ui(lang).timelineEmpty}</div>`;
            return;
        }

        target.innerHTML = items.map((item) => `
            <article class="achievement-item ${item === items[0] ? 'is-latest' : ''}">
                <div class="achievement-time">
                    <span>${item.date}</span>
                    <strong>${item.kind}</strong>
                </div>
                <div class="achievement-body">
                    <div class="achievement-head">
                        <h3>${item.title}</h3>
                        <div class="achievement-badges">
                            ${item.status ? `<span class="achievement-status" data-category="${item.category}">${item.status}</span>` : ''}
                            ${item === items[0] ? `<span class="achievement-latest">${ui(lang).latestLabel}</span>` : ''}
                        </div>
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
            <a class="result-repository-card ${repository.team?.length ? 'has-team' : 'no-team'}" href="${repository.repository}" target="_blank" rel="noreferrer" aria-label="${repository.name} · ${repository.repositoryName}">
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
            const statusLabels = {
                draft: ui(lang).draftStatus,
                'needs-label': ui(lang).needsLabelStatus,
                'review-requested': ui(lang).reviewRequestedStatus,
                'ready-evidence': ui(lang).readyEvidenceStatus,
                'evidence-pending': ui(lang).evidencePendingStatus,
                'ci-retry': ui(lang).ciRetryStatus,
            };
            const status = statusLabels[pullRequest.status] || ui(lang).openStatus;
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
        renderTimeline(lang);
    }

    function bindTimelineFilters() {
        document.querySelectorAll('.achievement-filter-button').forEach((button) => {
            button.addEventListener('click', () => {
                activeAchievementFilter = button.dataset.achievementFilter || 'all';
                renderTimeline();
            });
        });
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

    bindTimelineFilters();
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('vllm-hust:langchange', (event) => {
        renderDynamic(event.detail?.lang || currentLang());
    });
})();
