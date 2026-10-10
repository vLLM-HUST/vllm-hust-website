/**
 * Published Fixed-Target Registry
 *
 * Consumes the central machine-readable fixed-target registry published by
 * vLLM-HUST/vllm-hust-benchmark (leaderboard-data/official-targets.json). The
 * registry is the single source of truth; this page must never hard-code the
 * target configuration. The GitHub registry and repo-hosted mirror
 * (./data/official_targets.json) are checked together; the newest registry
 * version wins so a stale source cannot hide newly published targets.
 *
 * Display is fail-closed: only `status=active` + `intended_use=public-leaderboard`
 * targets are treated as active public configurations. Perfgate (3B) and
 * specialty targets are shown separately and never promoted into that view.
 */

(function () {
    'use strict';

    const REGISTRY_CONFIG = {
        github: {
            repo: 'vLLM-HUST/vllm-hust-benchmark',
            branch: 'main',
            path: 'leaderboard-data/official-targets.json',
        },
        localPath: './data/official_targets.json',
    };
    const ACCEPTANCE_PROGRAM_PATH = './data/dataset_program_v1.json';

    const UI = {
        en: {
            cardVersion: 'registry',
            effectiveFrom: 'Effective from',
            acceptanceTitle: 'Current mandatory acceptance contract',
            fixedTargetTitle: 'Published version-specific fixed targets',
            fixedTargetHint: 'These configurations remain valid for their named runtime and workload; they are not the current mandatory model.',
            activeTargets: 'Active configurations',
            baselineStacks: 'Runtime stacks',
            hardwareConfigs: 'Hardware configurations',
            profiles: 'Profiles',
            workloads: 'Workloads',
            distinct: 'distinct',
            viewMatrix: 'View full config matrix',
            hideMatrix: 'Hide config matrix',
            machineJson: 'machine-readable JSON',
            matrixTitle: 'Workload / Profile matrix',
            matrixHint: 'Resolved client + server parameters, spec hash, status and update date.',
            profile: 'Profile',
            workload: 'Workload',
            model: 'Model',
            runtime: 'Runtime',
            params: 'Resolved parameters',
            specHash: 'Spec SHA256',
            status: 'Status',
            updated: 'Updated',
            officialPending: 'The fixed-target registry is being rebuilt.',
            officialPendingHint: 'No active public configuration is published yet. Legacy or unverified records are not shown.',
            perfgateTitle: 'Perfgate (CI only, not a public 14B target)',
            specialtyTitle: 'Additional hardware configurations',
            invalidRegistry: 'Fixed-target registry is unavailable.',
            retry: 'Retry',
            statusActive: 'active',
            statusProvisional: 'provisional',
            statusRetired: 'retired',
            sourceGitHub: 'GitHub registry',
            sourceLocal: 'local mirror',
        },
        zh: {
            cardVersion: 'registry',
            effectiveFrom: '生效日期',
            acceptanceTitle: '当前必测验收合同',
            fixedTargetTitle: '已发布的版本化固定目标',
            fixedTargetHint: '这些配置在各自标明的运行时与 workload 下仍然有效，但不是当前必测模型。',
            activeTargets: 'Active 配置数',
            baselineStacks: '运行时组合',
            hardwareConfigs: '硬件配置',
            profiles: 'Profile 数',
            workloads: 'Workload 数',
            distinct: '种',
            viewMatrix: '查看完整配置矩阵',
            hideMatrix: '收起配置矩阵',
            machineJson: '机器可读 JSON',
            matrixTitle: 'Profile / Workload 矩阵',
            matrixHint: '解析后的 client + server 参数、spec hash、状态与更新时间。',
            profile: 'Profile',
            workload: 'Workload',
            model: '模型',
            runtime: '运行时',
            params: '解析参数',
            specHash: 'Spec SHA256',
            status: '状态',
            updated: '更新时间',
            officialPending: '固定目标注册表正在重建。',
            officialPendingHint: '当前尚未发布任何 active 公开配置，不展示 legacy 或未验证记录。',
            perfgateTitle: 'Perfgate（仅用于 CI，不属于公开 14B 固定靶）',
            specialtyTitle: '其他硬件配置',
            invalidRegistry: '固定靶 registry 不可用。',
            retry: '重试',
            statusActive: 'active',
            statusProvisional: 'provisional',
            statusRetired: 'retired',
            sourceGitHub: 'GitHub registry',
            sourceLocal: '本地镜像',
        },
    };

    function getLang() {
        return (window['vllm-hustCurrentLang'] || document.documentElement.lang || 'en')
            .startsWith('zh') ? 'zh' : 'en';
    }

    function t(key) {
        return (UI[getLang()] || UI.en)[key] || UI.en[key] || key;
    }

    const CONTAINER_ID = 'official-target-body';
    const MATRIX_ID = 'official-target-matrix';
    const TOGGLE_ID = 'official-target-toggle';
    const JSON_LINK_ID = 'official-target-json-link';
    const PERFGATE_ID = 'official-target-perfgate';
    const SPECIALTY_ID = 'official-target-specialty';

    let lastRegistry = null;
    let lastAcceptancePlan = null;

    // --- Classification (fail-closed) ------------------------------------

    function isOfficialPublic(target) {
        if (!target || typeof target !== 'object') {
            return false;
        }
        return target.status === 'active' && target.intended_use === 'public-leaderboard';
    }

    function isPerfgate(target) {
        return Boolean(target && typeof target === 'object' && target.intended_use === 'perfgate');
    }

    function isSpecialty(target) {
        return Boolean(target && typeof target === 'object' && target.intended_use === 'specialty');
    }

    function classifyTarget(target) {
        if (isOfficialPublic(target)) {
            return 'official';
        }
        if (isPerfgate(target)) {
            return 'perfgate';
        }
        if (isSpecialty(target)) {
            return 'specialty';
        }
        return 'other';
    }

    // --- Loading ----------------------------------------------------------

    function buildGitHubRawUrl() {
        const cfg = REGISTRY_CONFIG.github;
        return `https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch}/${cfg.path}`;
    }

    async function loadFromGitHub() {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch(buildGitHubRawUrl(), {
                headers: { 'Accept': 'application/json' },
                cache: 'no-cache',
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`GitHub raw error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        } finally {
            window.clearTimeout(timeout);
        }
    }

    async function loadFromLocal() {
        const response = await fetch(REGISTRY_CONFIG.localPath, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Local mirror error: ${response.status}`);
        }
        return response.json();
    }

    function compareRegistryVersions(left, right) {
        const parse = (value) => String(value || '')
            .split('.')
            .map((part) => Number.parseInt(part, 10) || 0);
        const a = parse(left);
        const b = parse(right);
        const length = Math.max(a.length, b.length);
        for (let index = 0; index < length; index += 1) {
            const difference = (a[index] || 0) - (b[index] || 0);
            if (difference !== 0) {
                return difference;
            }
        }
        return 0;
    }

    async function loadRegistry() {
        // Fetch both mirrors and select the newest valid generation. Prefer the
        // deployed local copy on a tie for deterministic Pages rendering.
        const sources = [
            { name: 'local', loader: loadFromLocal },
            { name: 'github', loader: loadFromGitHub },
        ];
        const settled = await Promise.allSettled(sources.map((source) => source.loader()));
        const available = [];
        settled.forEach((result, index) => {
            const source = sources[index];
            if (result.status === 'fulfilled' && Array.isArray(result.value?.targets)) {
                available.push({
                    payload: result.value,
                    source: source.name,
                    targets: result.value.targets,
                });
            } else {
                const error = result.status === 'rejected' ? result.reason : new Error('invalid registry');
                console.warn(`[OfficialTargets] ${source.name} load failed:`, error?.message || error);
            }
        });
        if (!available.length) {
            throw new Error('Failed to load fixed-target registry');
        }
        available.sort((left, right) => compareRegistryVersions(
            right.payload?.registry_version,
            left.payload?.registry_version,
        ));
        [lastRegistry] = available;
        return lastRegistry;
    }

    function validateAcceptancePlan(payload) {
        const plan = payload?.test_plan;
        if (!plan || typeof plan.test_plan_version !== 'string'
            || typeof plan.contract_url !== 'string' || !plan.contract_url.startsWith('https://')
            || typeof plan.mandatory_model !== 'string'
            || typeof plan.formal_precision !== 'string'
            || !Array.isArray(plan.baseline_roles) || plan.baseline_roles.length === 0) {
            throw new Error('Invalid mandatory acceptance contract');
        }
        return plan;
    }

    async function loadAcceptancePlan() {
        const response = await fetch(ACCEPTANCE_PROGRAM_PATH, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Acceptance contract error: ${response.status}`);
        }
        lastAcceptancePlan = validateAcceptancePlan(await response.json());
        return lastAcceptancePlan;
    }

    // --- Rendering helpers ------------------------------------------------

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function shortSha(full) {
        const raw = String(full || '');
        return raw.length > 12 ? `${raw.slice(0, 12)}…` : raw;
    }

    function formatDate(value) {
        if (!value) {
            return '—';
        }
        return String(value);
    }

    function renderParams(params) {
        if (!params || typeof params !== 'object') {
            return '—';
        }
        return Object.keys(params)
            .map((key) => `${key}=${JSON.stringify(params[key])}`)
            .join(' · ');
    }

    function modelLabel(target) {
        const model = target?.model || {};
        const id = String(model.id || '');
        const precision = model.precision ? ` · ${model.precision}` : '';
        return `${id}${precision}`;
    }

    function hardwareLabel(target) {
        const hw = target?.hardware || {};
        const vendor = hw.vendor || '';
        const chip = hw.chip_model || '';
        const count = hw.chip_count ? ` ×${hw.chip_count}` : '';
        const nodes = hw.node_count && hw.node_count > 1 ? `, ${hw.node_count} nodes` : '';
        return `${vendor} ${chip}${count}${nodes}`.trim();
    }

    function baselineLabel(target) {
        const rt = target?.baseline_runtime || {};
        const engine = rt.engine || '';
        const version = rt.engine_version || '';
        const rawAscendRef = String(rt.vllm_ascend_ref || '');
        const ascendRef = /^[0-9a-f]{40}$/i.test(rawAscendRef) ? shortSha(rawAscendRef) : rawAscendRef;
        const ascend = ascendRef ? ` + vLLM-Ascend ${ascendRef}` : '';
        return `${engine} ${version}${ascend}`.trim();
    }

    function uniqueLabels(targets, formatter) {
        return [...new Set(targets.map(formatter).filter(Boolean))].sort();
    }

    function compactList(values) {
        if (!values.length) {
            return '—';
        }
        if (values.length <= 3) {
            return values.join(' / ');
        }
        return `${values.length} ${t('distinct')}`;
    }

    // --- Card rendering -----------------------------------------------------

    function renderOfficialCard(registry, acceptancePlan) {
        const container = document.getElementById(CONTAINER_ID);
        if (!container) {
            return;
        }
        const targets = registry.targets;
        const official = targets.filter(isOfficialPublic);
        const perfgate = targets.filter(isPerfgate);
        const specialty = targets.filter(isSpecialty);

        if (!official.length) {
            // Fail closed: never fall back to legacy/unverified points.
            container.innerHTML = `
                <div class="official-target-body">
                    <div class="official-target-banner">
                        <strong>${escapeHtml(t('officialPending'))}</strong>
                        <span>${escapeHtml(t('officialPendingHint'))}</span>
                    </div>
                </div>`;
            return;
        }

        const runtimeStacks = uniqueLabels(official, baselineLabel);
        const hardwareConfigs = uniqueLabels(official, hardwareLabel);
        const profiles = uniqueLabels(official, (target) => target.profile);
        const workloads = uniqueLabels(official, (target) => target.workload?.name);
        const preview = [
            [t('activeTargets'), official.length],
            [t('baselineStacks'), compactList(runtimeStacks)],
            [t('hardwareConfigs'), compactList(hardwareConfigs)],
            [t('profiles'), profiles.length],
            [t('workloads'), workloads.length],
        ].map(([label, value]) => `
            <div class="official-target-item">
                <span class="official-target-item-label">${escapeHtml(label)}</span>
                <span class="official-target-item-value">${escapeHtml(value)}</span>
            </div>`).join('');

        const sourceLabel = registry.source === 'github' ? t('sourceGitHub') : t('sourceLocal');

        container.innerHTML = `
            <div class="official-target-body">
                <div class="official-target-banner official-target-acceptance">
                    <strong>${escapeHtml(t('acceptanceTitle'))}</strong>
                    <span><a href="${escapeHtml(acceptancePlan.contract_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(acceptancePlan.test_plan_version)}</a> · ${escapeHtml(acceptancePlan.mandatory_model)} · ${escapeHtml(acceptancePlan.formal_precision)} · ${escapeHtml(acceptancePlan.baseline_roles.join(' + '))}</span>
                </div>
                <div class="official-target-matrix-head">
                    <strong>${escapeHtml(t('fixedTargetTitle'))}</strong>
                    <span>${escapeHtml(t('fixedTargetHint'))}</span>
                </div>
                <div class="official-target-head">
                    <span class="official-target-version">
                        ${escapeHtml(t('cardVersion'))}: ${escapeHtml(registry.payload?.registry_version || '')}
                    </span>
                    <span class="official-target-effective">${escapeHtml(t('effectiveFrom'))}: ${escapeHtml(formatDate(registry.payload?.effective_from))}</span>
                    <span class="official-target-source">${sourceLabel}</span>
                </div>
                <div class="official-target-grid">${preview}</div>
                <div class="official-target-actions">
                    <button id="${TOGGLE_ID}" class="action-button" type="button" aria-expanded="false" aria-controls="${MATRIX_ID}">
                        ${escapeHtml(t('viewMatrix'))}
                    </button>
                    <a id="${JSON_LINK_ID}" class="official-target-json-link" href="${escapeHtml(buildGitHubRawUrl())}" target="_blank" rel="noopener">
                        ${escapeHtml(t('machineJson'))}
                    </a>
                </div>
                <div id="${MATRIX_ID}" class="official-target-matrix" hidden></div>
                <div id="${PERFGATE_ID}" class="official-target-subsection official-target-subsection--perfgate" hidden></div>
                <div id="${SPECIALTY_ID}" class="official-target-subsection official-target-subsection--specialty" hidden></div>
            </div>`;

        renderMatrix(registry, official);
        bindToggle();
        renderPerfgate(perfgate);
        renderSpecialty(specialty);
    }

    function renderMatrix(registry, official) {
        const node = document.getElementById(MATRIX_ID);
        if (!node) {
            return;
        }
        const byProfile = new Map();
        official.forEach((target) => {
            const profile = target.profile || 'other';
            if (!byProfile.has(profile)) {
                byProfile.set(profile, []);
            }
            byProfile.get(profile).push(target);
        });

        const rows = [];
        byProfile.forEach((items, profile) => {
            items.forEach((target) => {
                rows.push(`
                    <tr>
                        <td>${escapeHtml(profile)}</td>
                        <td>${escapeHtml(target.workload?.name || '')}</td>
                        <td>${escapeHtml(modelLabel(target))}</td>
                        <td>${escapeHtml(baselineLabel(target))}</td>
                        <td class="official-target-params">${escapeHtml(renderParams(target.workload?.client_parameters))}</td>
                        <td><code title="${escapeHtml(target.source_spec?.sha256 || '')}">${escapeHtml(shortSha(target.source_spec?.sha256))}</code></td>
                        <td>${escapeHtml(t('status' + target.status[0].toUpperCase() + target.status.slice(1)) || target.status)}</td>
                        <td>${escapeHtml(formatDate(target.effective_from))}</td>
                    </tr>`);
            });
        });

        node.innerHTML = `
            <div class="official-target-matrix-head">
                <strong>${escapeHtml(t('matrixTitle'))}</strong>
                <span>${escapeHtml(t('matrixHint'))}</span>
            </div>
            <div class="table-container">
                <table class="leaderboard-table official-target-table">
                    <thead>
                        <tr>
                            <th>${escapeHtml(t('profile'))}</th>
                            <th>${escapeHtml(t('workload'))}</th>
                            <th>${escapeHtml(t('model'))}</th>
                            <th>${escapeHtml(t('runtime'))}</th>
                            <th>${escapeHtml(t('params'))}</th>
                            <th>${escapeHtml(t('specHash'))}</th>
                            <th>${escapeHtml(t('status'))}</th>
                            <th>${escapeHtml(t('updated'))}</th>
                        </tr>
                    </thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>`;
    }

    function renderSubsection(itemId, items, title, registry) {
        const node = document.getElementById(itemId);
        if (!node || !items.length) {
            return;
        }
        const rows = items.map((target) => `
            <tr>
                <td>${escapeHtml(target.profile || '')}</td>
                <td>${escapeHtml(target.workload?.name || '')}</td>
                <td>${escapeHtml(modelLabel(target))}</td>
                <td>${escapeHtml(baselineLabel(target))}</td>
                <td>${escapeHtml(renderParams(target.workload?.client_parameters))}</td>
                <td><code title="${escapeHtml(target.source_spec?.sha256 || '')}">${escapeHtml(shortSha(target.source_spec?.sha256))}</code></td>
                <td>${escapeHtml(target.status)}</td>
            </tr>`).join('');
        node.hidden = false;
        node.innerHTML = `
            <div class="official-target-subsection-title">${escapeHtml(title)}</div>
            <div class="table-container">
                <table class="leaderboard-table official-target-table">
                    <thead>
                        <tr>
                            <th>${escapeHtml(t('profile'))}</th>
                            <th>${escapeHtml(t('workload'))}</th>
                            <th>${escapeHtml(t('model'))}</th>
                            <th>${escapeHtml(t('runtime'))}</th>
                            <th>${escapeHtml(t('params'))}</th>
                            <th>${escapeHtml(t('specHash'))}</th>
                            <th>${escapeHtml(t('status'))}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    function renderPerfgate(items) {
        renderSubsection(PERFGATE_ID, items, t('perfgateTitle'));
    }

    function renderSpecialty(items) {
        renderSubsection(SPECIALTY_ID, items, t('specialtyTitle'));
    }

    function bindToggle() {
        const toggle = document.getElementById(TOGGLE_ID);
        const matrix = document.getElementById(MATRIX_ID);
        if (!toggle || !matrix) {
            return;
        }
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            matrix.hidden = expanded;
            toggle.setAttribute('aria-expanded', String(!expanded));
            toggle.textContent = expanded ? t('viewMatrix') : t('hideMatrix');
        });
    }

    function renderError(message) {
        const container = document.getElementById(CONTAINER_ID);
        if (!container) {
            return;
        }
        container.innerHTML = `
            <div class="official-target-body">
                <div class="official-target-banner official-target-banner--error">
                    <strong>${escapeHtml(t('invalidRegistry'))}</strong>
                    <span>${escapeHtml(message || '')}</span>
                </div>
            </div>`;
    }

    async function init() {
        const container = document.getElementById(CONTAINER_ID);
        if (!container) {
            return;
        }
        try {
            const [registry, acceptancePlan] = await Promise.all([
                loadRegistry(),
                loadAcceptancePlan(),
            ]);
            renderOfficialCard(registry, acceptancePlan);
        } catch (error) {
            console.error('[OfficialTargets] init failed:', error?.message || error);
            renderError(error?.message || '');
        }
    }

    // Re-render in the active language when the user toggles lang.
    window.addEventListener('vllm-hust:langchange', () => {
        if (lastRegistry && lastAcceptancePlan) {
            renderOfficialCard(lastRegistry, lastAcceptancePlan);
        }
    });

    document.addEventListener('DOMContentLoaded', init);

    // Expose classification for tests and debugging.
    window.OfficialTargets = {
        classifyTarget,
        isOfficialPublic,
        isPerfgate,
        isSpecialty,
        compareRegistryVersions,
        validateAcceptancePlan,
        uniqueLabels,
        compactList,
    };
})();
