(function () {
    const DATA_URLS = {
        versionMeta: './data/version_meta.json',
        single: './data/leaderboard_single.json',
        multi: './data/leaderboard_multi.json',
        compare: './data/leaderboard_compare.json',
        contributors: './data/core_contributors.json',
    };

    function fmt(value) {
        return Number(value || 0).toLocaleString();
    }

    function getEngine(entry) {
        return String(entry?.engine || entry?.metadata?.engine || 'unknown').trim();
    }

    function getWorkload(entry) {
        return String(entry?.workload?.name || entry?.metadata?.workload || 'Other').trim();
    }

    function getModel(entry) {
        return String(entry?.model?.display_name || entry?.model?.name || 'Unknown model').trim();
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
        setText('achievement-stat-models', fmt(new Set(entries.map(getModel)).size));
        setText('achievement-stat-workloads', fmt(new Set(entries.map(getWorkload)).size));
        setText('achievement-stat-contributors', fmt(contributors?.all_repos?.contributors?.length || 0));
        setText('achievement-stat-groups', fmt(compare?.group_count || 0));
        setText('achievement-stat-hard', fmt(compare?.hard_constraints?.scope_count || 0));
    }

    function renderPackages(versionMeta) {
        const target = document.getElementById('achievement-packages');
        if (!target) return;
        const packages = Array.isArray(versionMeta?.packages) ? versionMeta.packages : [];
        target.innerHTML = packages.map((pkg) => `
            <div class="data-row">
                <div>
                    <h3>${pkg.name || 'package'}</h3>
                    <p>${pkg.version_note_zh || pkg.version_display_label || pkg.group || ''}</p>
                    <div class="tag-list">
                        <span class="tag">${pkg.group || 'package'}</span>
                        <span class="tag">${pkg.version || '-'}</span>
                        ${pkg.pypi_name ? `<span class="tag">PyPI: ${pkg.pypi_name}</span>` : ''}
                    </div>
                </div>
                ${pkg.repo ? `<a class="action-button" href="${pkg.repo}" target="_blank" rel="noreferrer">GitHub</a>` : ''}
            </div>
        `).join('');
    }

    function renderEvidence(entries) {
        const target = document.getElementById('achievement-evidence');
        if (!target) return;
        const byWorkload = new Map();
        entries.forEach((entry) => {
            const workload = getWorkload(entry);
            const current = byWorkload.get(workload);
            const throughput = Number(entry?.metrics?.throughput_tps || 0);
            if (!current || throughput > current.throughput) {
                byWorkload.set(workload, {
                    workload,
                    throughput,
                    engine: getEngine(entry),
                    model: getModel(entry),
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
                    <span class="tag">${row.throughput.toFixed(1)} tok/s</span>
                </div>
            </div>
        `).join('');
    }

    function renderMilestones(compare) {
        const target = document.getElementById('achievement-milestones');
        if (!target) return;
        const hard = compare?.hard_constraints || {};
        const goal = compare?.goal_progress || {};
        const cards = [
            {
                title: 'Benchmark snapshot pipeline',
                body: `${fmt(compare?.group_count || 0)} compare groups and ${fmt(compare?.preferred_pair_count || 0)} preferred pairs are published as static JSON snapshots.`,
            },
            {
                title: 'Hard-constraint tracking',
                body: `${fmt(hard.scope_count || 0)} hard-constraint scopes are tracked with pass/fail and regression context.`,
            },
            {
                title: 'Official baseline comparison',
                body: `${fmt(goal.pair_count || (goal.pairs || []).length || 0)} goal-progress pairs compare vllm-hust against the official vLLM baseline.`,
            },
            {
                title: 'Workstation surface',
                body: 'The website can embed or link to a live vllm-hust workstation for operator-facing serving workflows.',
            },
        ];
        target.innerHTML = cards.map((card) => `
            <div class="info-card">
                <h3>${card.title}</h3>
                <p>${card.body}</p>
            </div>
        `).join('');
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
            renderStats(entries, compare, contributors);
            renderPackages(versionMeta);
            renderEvidence(entries);
            renderMilestones(compare);
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
})();
