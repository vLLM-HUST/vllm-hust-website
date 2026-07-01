(function () {
    const DATA_URLS = {
        versionMeta: './data/version_meta.json',
        single: './data/leaderboard_single.json',
        multi: './data/leaderboard_multi.json',
        compare: './data/leaderboard_compare.json',
        contributors: './data/core_contributors.json',
    };

    const ARTIFACTS = [
        {
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
            packageFallback: 'package',
            packageRepo: 'GitHub',
            packagePypi: 'PyPI',
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
        },
        zh: {
            packageFallback: '软件包',
            packageRepo: '代码仓库',
            packagePypi: 'PyPI',
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

    function renderArtifacts(lang = currentLang()) {
        const target = document.getElementById('achievement-artifacts');
        if (!target) return;
        target.innerHTML = ARTIFACTS.map((artifact) => `
            <div class="info-card">
                <h3>${pick(artifact.title, lang)}</h3>
                <p>${pick(artifact.body, lang)}</p>
                <div class="tag-list">
                    ${artifact.tags.map((tag) => `<span class="tag">${pick(tag, lang)}</span>`).join('')}
                </div>
                <div class="tag-list">
                    ${artifact.links.map((link) => `<a class="action-button" href="${link.href}" target="_blank" rel="noreferrer">${pick(link.label, lang)}</a>`).join('')}
                </div>
            </div>
        `).join('');
    }

    function renderPackages(versionMeta, lang = currentLang()) {
        const target = document.getElementById('achievement-packages');
        if (!target) return;
        const text = ui(lang);
        const packages = Array.isArray(versionMeta?.packages) ? versionMeta.packages : [];
        target.innerHTML = packages.map((pkg) => `
            <div class="data-row">
                <div>
                    <h3>${pkg.name || text.packageFallback}</h3>
                    <p>${lang === 'zh' ? (pkg.version_note_zh || pkg.version_display_label || pkg.group || '') : (pkg.version_display_label || pkg.group || '')}</p>
                    <div class="tag-list">
                        <span class="tag">${pkg.group || text.packageFallback}</span>
                        <span class="tag">${pkg.version || '-'}</span>
                        ${pkg.pypi_name ? `<span class="tag">${text.packagePypi}: ${pkg.pypi_name}</span>` : ''}
                    </div>
                </div>
                ${pkg.repo ? `<a class="action-button" href="${pkg.repo}" target="_blank" rel="noreferrer">${text.packageRepo}</a>` : ''}
            </div>
        `).join('');
    }

    function renderEvidence(entries, lang = currentLang()) {
        const target = document.getElementById('achievement-evidence');
        if (!target) return;
        const text = ui(lang);
        const byWorkload = new Map();
        entries.forEach((entry) => {
            const workload = getWorkload(entry, lang);
            const current = byWorkload.get(workload);
            const throughput = Number(entry?.metrics?.throughput_tps || 0);
            if (!current || throughput > current.throughput) {
                byWorkload.set(workload, {
                    workload,
                    throughput,
                    engine: getEngine(entry),
                    model: getModel(entry, lang),
                    precision: entry?.model?.precision || '-',
                });
            }
        });
        const rows = [...byWorkload.values()]
            .sort((a, b) => b.throughput - a.throughput)
            .slice(0, 8);
        target.innerHTML = rows.map((row) => `
            <div class="info-card">
                <h3>${row.workload}</h3>
                <p>${row.model}</p>
                <div class="tag-list">
                    <span class="tag">${row.engine}</span>
                    <span class="tag">${row.precision}</span>
                    <span class="tag">${row.throughput.toFixed(1)} ${text.throughputUnit}</span>
                </div>
            </div>
        `).join('');
    }

    function renderMilestones(compare, lang = currentLang()) {
        const target = document.getElementById('achievement-milestones');
        if (!target) return;
        const text = ui(lang);
        const hard = compare?.hard_constraints || {};
        const goal = compare?.goal_progress || {};
        const groupCount = fmt(compare?.group_count || 0);
        const preferredPairCount = fmt(compare?.preferred_pair_count || 0);
        const hardScopeCount = fmt(hard.scope_count || 0);
        const goalPairCount = fmt(goal.pair_count || (goal.pairs || []).length || 0);
        const cards = [
            {
                title: text.milestoneBenchmarkTitle,
                body: text.milestoneBenchmarkBody(groupCount, preferredPairCount),
            },
            {
                title: text.milestoneHardTitle,
                body: text.milestoneHardBody(hardScopeCount),
            },
            {
                title: text.milestoneBaselineTitle,
                body: text.milestoneBaselineBody(goalPairCount),
            },
            {
                title: text.milestoneWorkstationTitle,
                body: text.milestoneWorkstationBody,
            },
        ];
        target.innerHTML = cards.map((card) => `
            <div class="info-card">
                <h3>${card.title}</h3>
                <p>${card.body}</p>
            </div>
        `).join('');
    }

    function renderDynamic(lang = currentLang()) {
        renderArtifacts(lang);
        if (state.versionMeta) renderPackages(state.versionMeta, lang);
        if (state.entries.length) renderEvidence(state.entries, lang);
        if (state.compare) renderMilestones(state.compare, lang);
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
