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
            sortDate: '2026-07-07',
            date: { en: 'July 7, 2026', zh: '2026 年 7 月 7 日' },
            kind: { en: 'Upstream', zh: '上游贡献' },
            title: {
                en: 'Triton and vLLM source-build fixes submitted upstream',
                zh: 'Triton 与 vLLM 源码构建修复提交上游',
            },
            body: {
                en: 'These PRs improve source checkout handling in vLLM and strengthen Triton-Ascend compatibility across runtime loading, build dependencies, and optional tool registration.',
                zh: '这组 PR 改进 vLLM 源码 checkout 场景下的 metadata 处理，并提升 Triton-Ascend 在 runtime 加载、构建依赖和可选工具注册上的兼容性。',
            },
            tags: [
                { en: 'vLLM', zh: 'vLLM' },
                { en: 'Triton-Ascend', zh: 'Triton-Ascend' },
                { en: 'Source builds', zh: '源码构建' },
            ],
            links: [
                {
                    label: { en: 'vLLM #47793 · label gate', zh: 'vLLM #47793 · 等待 label' },
                    href: 'https://github.com/vllm-project/vllm/pull/47793',
                },
                {
                    label: { en: 'vLLM #47789 · label gate', zh: 'vLLM #47789 · 等待 label' },
                    href: 'https://github.com/vllm-project/vllm/pull/47789',
                },
                {
                    label: { en: 'Triton-Ascend #917 · CI running', zh: 'Triton-Ascend #917 · CI 运行中' },
                    href: 'https://github.com/triton-lang/triton-ascend/pull/917',
                },
                {
                    label: { en: 'Triton-Ascend #918 · CI passed', zh: 'Triton-Ascend #918 · CI 已通过' },
                    href: 'https://github.com/triton-lang/triton-ascend/pull/918',
                },
                {
                    label: { en: 'Triton-Ascend #919 · CI passed, pipeline pending', zh: 'Triton-Ascend #919 · CI 已通过，pipeline 等待中' },
                    href: 'https://github.com/triton-lang/triton-ascend/pull/919',
                },
                {
                    label: { en: 'Triton-Ascend #920 · CI passed, pipeline pending', zh: 'Triton-Ascend #920 · CI 已通过，pipeline 等待中' },
                    href: 'https://github.com/triton-lang/triton-ascend/pull/920',
                },
                {
                    label: { en: 'Triton-Ascend #922 · runner retry needed', zh: 'Triton-Ascend #922 · 等待 runner 重试' },
                    href: 'https://github.com/triton-lang/triton-ascend/pull/922',
                },
                {
                    label: { en: 'Triton-Ascend #923 · CI passed, pipeline pending', zh: 'Triton-Ascend #923 · CI 已通过，pipeline 等待中' },
                    href: 'https://github.com/triton-lang/triton-ascend/pull/923',
                },
            ],
        },
        {
            sortDate: '2026-07-05',
            date: { en: 'July 5, 2026', zh: '2026 年 7 月 5 日' },
            kind: { en: 'Upstream', zh: '上游贡献' },
            title: {
                en: 'vLLM and vLLM-Ascend performance improvements submitted upstream',
                zh: 'vLLM 与 vLLM-Ascend 性能改进提交上游',
            },
            body: {
                en: 'The July submissions cover KV-scale host conversion, logprobs materialization, packaged custom-op lookup, NPU runtime support for Python 3.12, and DP metadata buffer reuse.',
                zh: '7 月提交覆盖 KV scale host conversion、logprobs materialization、packaged custom-op lookup、Python 3.12 下的 NPU runtime 支持，以及 DP metadata buffer 复用。',
            },
            tags: [
                { en: 'Performance', zh: '性能' },
                { en: 'vLLM', zh: 'vLLM' },
                { en: 'vLLM-Ascend', zh: 'vLLM-Ascend' },
            ],
            links: [
                {
                    label: { en: 'vLLM #47622 · label gate', zh: 'vLLM #47622 · 等待 label' },
                    href: 'https://github.com/vllm-project/vllm/pull/47622',
                },
                {
                    label: { en: 'vLLM #47623 · label gate', zh: 'vLLM #47623 · 等待 label' },
                    href: 'https://github.com/vllm-project/vllm/pull/47623',
                },
                {
                    label: { en: 'vLLM-Ascend #11417 · CI passed', zh: 'vLLM-Ascend #11417 · CI 已通过' },
                    href: 'https://github.com/vllm-project/vllm-ascend/pull/11417',
                },
                {
                    label: { en: 'vLLM-Ascend #11422 · CI passed', zh: 'vLLM-Ascend #11422 · CI 已通过' },
                    href: 'https://github.com/vllm-project/vllm-ascend/pull/11422',
                },
                {
                    label: { en: 'vLLM-Ascend #11449 · CI passed', zh: 'vLLM-Ascend #11449 · CI 已通过' },
                    href: 'https://github.com/vllm-project/vllm-ascend/pull/11449',
                },
            ],
        },
        {
            sortDate: '2026-06-19',
            date: { en: 'June 2026', zh: '2026 年 6 月' },
            kind: { en: 'Upstream', zh: '上游贡献' },
            title: {
                en: 'vLLM-Ascend runtime reliability fix opened upstream',
                zh: 'vLLM-Ascend 运行时可靠性修复提交上游',
            },
            body: {
                en: 'This contribution keeps the worker override configuration consistent across vLLM-Ascend worker processes, including NPU graph settings.',
                zh: '该贡献让 vLLM-Ascend 的 worker override 配置在不同 worker 进程间保持一致，包括 NPU graph 相关设置。',
            },
            tags: [
                { en: 'Runtime reliability', zh: '运行时可靠性' },
                { en: 'vLLM-Ascend', zh: 'vLLM-Ascend' },
            ],
            links: [
                {
                    label: { en: 'vLLM-Ascend #10735 · CI passed', zh: 'vLLM-Ascend #10735 · CI 已通过' },
                    href: 'https://github.com/vllm-project/vllm-ascend/pull/10735',
                },
            ],
        },
        {
            sortDate: '2026-05-07',
            date: { en: 'May 2026', zh: '2026 年 5 月' },
            kind: { en: 'Upstream', zh: '上游贡献' },
            title: {
                en: 'Early vLLM and vLLM-Ascend stability fixes opened upstream',
                zh: '早期 vLLM 与 vLLM-Ascend 稳定性修复提交上游',
            },
            body: {
                en: 'May submissions focused on everyday stability: missing parent-module handling, clean shutdown behavior, and Qwen2 compiled-path output correctness on Ascend.',
                zh: '5 月提交聚焦基础稳定性：parent module 缺失处理、clean shutdown 行为，以及 Ascend 上 Qwen2 compiled path 的输出正确性。',
            },
            tags: [
                { en: 'Stability', zh: '稳定性' },
                { en: 'vLLM', zh: 'vLLM' },
                { en: 'vLLM-Ascend', zh: 'vLLM-Ascend' },
            ],
            links: [
                {
                    label: { en: 'vLLM #41449 · label gate', zh: 'vLLM #41449 · 等待 label' },
                    href: 'https://github.com/vllm-project/vllm/pull/41449',
                },
                {
                    label: { en: 'vLLM #41507 · label gate', zh: 'vLLM #41507 · 等待 label' },
                    href: 'https://github.com/vllm-project/vllm/pull/41507',
                },
                {
                    label: { en: 'vLLM-Ascend #8958 · CI passed', zh: 'vLLM-Ascend #8958 · CI 已通过' },
                    href: 'https://github.com/vllm-project/vllm-ascend/pull/8958',
                },
            ],
        },
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

    const RESULT_REPOSITORIES = [
        {
            name: 'BiDKV',
            repositoryName: 'vllm-ascend-hust-bidkv',
            summary: {
                en: 'Utility-guided KV-cache reclamation for responsive admission under sustained memory pressure.',
                zh: '效用驱动的 KV Cache 回收，在持续显存压力下改善请求准入响应。',
            },
            publication: { en: 'SC 2026', zh: 'SC 2026' },
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
                <span class="result-repository-link">${ui(lang).repositoryLabel}<strong aria-hidden="true">↗</strong></span>
            </a>
        `).join('');
    }

    function renderDynamic(lang = currentLang()) {
        renderResultRepositories(lang);
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
