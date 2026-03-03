/**
 * sageLLM Leaderboard - Version Evolution Display
 *
 * This script handles:
 * - Loading JSON data (single-node and multi-node)
 * - Tab switching between single/multi configurations
 * - Configuration filtering (hardware, model, workload, precision)
 * - Version sorting (newest first)
 * - Trend calculation (compare with previous version)
 * - Detail expansion/collapse
 * - Reproducible command copy
 */

(function () {
    'use strict';

    const WORKLOAD_LABELS = {
        all: 'All',
        Q1: 'Q1 – Short QA',
        Q2: 'Q2 – Long Summarization',
        Q3: 'Q3 – Code Generation',
        Q4: 'Q4 – Multi-turn Reasoning',
        Q5: 'Q5 – Stress: Short Concurrent',
        Q6: 'Q6 – Stress: Long Concurrent',
        Q7: 'Q7 – Chain-of-Thought',
        Q8: 'Q8 – Mixed Batch',
        Other: 'Other',
    };

    const VERSION_COMPONENTS = [
        { label: 'sageLLM', metadataKey: 'sagellm', pypiPackage: 'isagellm' },
        { label: 'Benchmark', metadataKey: 'benchmark', pypiPackage: 'isagellm-benchmark' },
        { label: 'Protocol', metadataKey: 'protocol', pypiPackage: 'isagellm-protocol' },
        { label: 'Backend', metadataKey: 'backend', pypiPackage: 'isagellm-backend' },
        { label: 'Core', metadataKey: 'core', pypiPackage: 'isagellm-core' },
        { label: 'KV Cache', metadataKey: 'kv_cache', pypiPackage: 'isagellm-kv-cache' },
        { label: 'Control Plane', metadataKey: 'control_plane', pypiPackage: 'isagellm-control-plane' },
        { label: 'Gateway', metadataKey: 'gateway', pypiPackage: 'isagellm-gateway' },
        { label: 'Comm', metadataKey: 'comm', pypiPackage: 'isagellm-comm' },
        { label: 'Compression', metadataKey: 'compression', pypiPackage: 'isagellm-compression' },
    ];

    const PYPI_CACHE_KEY = 'sagellm_pypi_versions_v1';
    const PYPI_CACHE_TTL_MS = 10 * 60 * 1000;
    const FULL_VERSION_REGEX = /^\d+(\.\d+){3}$/;

    // State management
    let state = {
        currentTab: 'single-chip', // single-chip, multi-chip, multi-node
        singleChipData: [],
        multiChipData: [],
        multiNodeData: [],
        totalLoadedEntries: 0,
        pypiVersions: {},
        sagellmVersionOptions: [],
        pypiLoaded: false,
        pypiLoadError: false,
        filters: {
            'single-chip': { hardware: '', model: '', version: '', workload: '', precision: '' },
            'multi-chip': { hardware: '', model: '', version: '', workload: '', precision: '' },
            'multi-node': { hardware: '', model: '', version: '', workload: '', precision: '' }
        },
        expandedRows: new Set()
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        await loadData();
        setupEventListeners();
        renderFilters();
        renderTable();
        await renderLastUpdated();
        void loadPyPIVersions();
    }

    function readPyPICache() {
        try {
            const raw = sessionStorage.getItem(PYPI_CACHE_KEY);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            if (!parsed?.savedAt || !parsed?.versions) {
                return null;
            }
            if (Date.now() - parsed.savedAt > PYPI_CACHE_TTL_MS) {
                return null;
            }
            return parsed.versions;
        } catch (_error) {
            return null;
        }
    }

    function writePyPICache(versions) {
        try {
            sessionStorage.setItem(PYPI_CACHE_KEY, JSON.stringify({
                savedAt: Date.now(),
                versions,
            }));
        } catch (_error) {
            // ignore cache write failures
        }
    }

    async function loadPyPIVersions() {
        const cached = readPyPICache();
        if (cached) {
            state.pypiVersions = cached;
            if (cached.isagellm_releases_050 && Array.isArray(cached.isagellm_releases_050)) {
                state.sagellmVersionOptions = cached.isagellm_releases_050;
            }
            state.pypiLoaded = true;
            renderFilters();
            renderTable();
            return;
        }

        try {
            const requests = VERSION_COMPONENTS.map(async (component) => {
                const response = await fetch(`https://pypi.org/pypi/${component.pypiPackage}/json`, {
                    cache: 'no-cache',
                });

                if (!response.ok) {
                    throw new Error(`PyPI ${component.pypiPackage}: ${response.status}`);
                }

                const payload = await response.json();
                const releases = component.pypiPackage === 'isagellm'
                    ? Object.keys(payload?.releases || {})
                        .filter((version) => /^\d+(\.\d+){3}$/.test(version))
                        .filter((version) => compareVersions(version, '0.5.0.0') >= 0)
                        .sort((a, b) => compareVersions(b, a))
                    : null;

                return [component.pypiPackage, payload?.info?.version || 'N/A', releases];
            });

            const settled = await Promise.allSettled(requests);
            const versions = {};
            settled.forEach((item) => {
                if (item.status === 'fulfilled') {
                    const [pkg, version, releases] = item.value;
                    versions[pkg] = version;
                    if (pkg === 'isagellm' && Array.isArray(releases)) {
                        versions.isagellm_releases_050 = releases;
                        state.sagellmVersionOptions = releases;
                    }
                }
            });

            state.pypiVersions = versions;
            state.pypiLoaded = true;
            writePyPICache(versions);
            renderFilters();
            renderTable();
        } catch (error) {
            console.warn('[Leaderboard] Failed to load PyPI versions:', error);
            state.pypiLoadError = true;
            state.pypiLoaded = true;
            renderTable();
        }
    }

    // Load JSON data (支持 HF 和本地两种模式)
    async function loadData() {
        const loadingEl = document.getElementById('leaderboard-loading');
        const errorEl = document.getElementById('leaderboard-error');
        const contentEl = document.getElementById('leaderboard-content');

        try {
            let singleData, multiData;

            // 优先使用 HF Data Loader（如果可用）
            if (window.HFDataLoader) {
                console.log('[Leaderboard] Using HF Data Loader...');
                const data = await window.HFDataLoader.loadLeaderboardData();
                singleData = data.single;
                multiData = data.multi;
            } else {
                // 备用：直接从本地加载
                console.log('[Leaderboard] HF Loader not available, using local data...');
                const [singleRes, multiRes] = await Promise.all([
                    fetch('./data/leaderboard_single.json'),
                    fetch('./data/leaderboard_multi.json')
                ]);

                if (!singleRes.ok || !multiRes.ok) {
                    throw new Error('Failed to load data');
                }

                singleData = await singleRes.json();
                multiData = await multiRes.json();
            }

            // 按芯片数和节点数分类
            state.singleChipData = singleData.filter(entry =>
                entry.hardware.chip_count === 1 && (!entry.cluster || entry.cluster.node_count === 1)
            );

            state.multiChipData = singleData.filter(entry =>
                entry.hardware.chip_count > 1 && (!entry.cluster || entry.cluster.node_count === 1)
            );

            state.multiNodeData = multiData.filter(entry =>
                entry.cluster && entry.cluster.node_count > 1
            );

            state.totalLoadedEntries =
                state.singleChipData.length +
                state.multiChipData.length +
                state.multiNodeData.length;

            // 排序
            [state.singleChipData, state.multiChipData, state.multiNodeData].forEach(data => {
                data.sort((a, b) => compareVersions(b.sagellm_version, a.sagellm_version));
            });

            // 初始化筛选器默认值
            initializeFilters();

            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
        } catch (error) {
            console.error('Error loading leaderboard data:', error);
            loadingEl.style.display = 'none';
            errorEl.style.display = 'block';
        }
    }

    function getWorkloadId(entry) {
        const direct = entry.workload?.name || entry.workload_name || entry.metadata?.workload;
        const normalizedDirect = normalizeWorkloadId(direct);
        if (normalizedDirect) {
            return normalizedDirect;
        }

        const notes = entry.metadata?.notes || '';
        const qMatch = notes.match(/\bQ([1-8])\b/i);
        if (qMatch) {
            return `Q${qMatch[1]}`;
        }

        if (notes.includes('short_input')) return 'Q1';
        if (notes.includes('long_input')) return 'Q2';
        if (notes.includes('stress_test')) return 'Q5';

        return 'Other';
    }

    function normalizeWorkloadId(value) {
        if (!value) {
            return null;
        }

        const raw = String(value).trim();
        if (!raw) {
            return null;
        }

        if (/^Q[1-8]$/i.test(raw)) {
            return raw.toUpperCase();
        }

        const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const aliasMap = {
            short: 'Q1',
            short_qa: 'Q1',
            short_input: 'Q1',
            long: 'Q2',
            long_summarization: 'Q2',
            long_input: 'Q2',
            code: 'Q3',
            code_generation: 'Q3',
            multi_turn: 'Q4',
            multi_turn_reasoning: 'Q4',
            stress: 'Q5',
            stress_short: 'Q5',
            stress_test: 'Q5',
            stress_long: 'Q6',
            cot: 'Q7',
            chain_of_thought: 'Q7',
            mixed: 'Q8',
            mixed_batch: 'Q8',
        };

        return aliasMap[normalized] || null;
    }

    function getWorkloadLabel(workloadId) {
        return WORKLOAD_LABELS[workloadId] || workloadId;
    }

    function compareByReleaseDateDesc(a, b) {
        const aDate = Date.parse(a?.metadata?.release_date || '') || 0;
        const bDate = Date.parse(b?.metadata?.release_date || '') || 0;
        return bDate - aDate;
    }

    function normalizeDisplayVersion(version) {
        const parts = String(version || '').split('.');
        if (parts.length < 3) {
            return String(version || '');
        }
        return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
    }

    function getDisplayVersion(entry) {
        return entry.displayVersion || normalizeDisplayVersion(entry.sagellm_version);
    }

    function createAggregationKey(entry) {
        const workload = getWorkloadId(entry);
        const hardware = entry?.hardware?.chip_model || '';
        const chipCount = entry?.hardware?.chip_count || 0;
        const nodeCount = entry?.cluster?.node_count || 1;
        const interconnect = entry?.cluster?.interconnect || 'single-node';
        const topology = entry?.cluster?.topology || '';
        const model = entry?.model?.name || '';
        const precision = entry?.model?.precision || '';
        const baseVersion = normalizeDisplayVersion(entry.sagellm_version);

        return [
            workload,
            hardware,
            chipCount,
            nodeCount,
            interconnect,
            topology,
            model,
            precision,
            baseVersion,
        ].join('|');
    }

    function compareEntryQuality(candidate, incumbent) {
        const c = candidate.metrics || {};
        const i = incumbent.metrics || {};

        const cThroughput = Number(c.throughput_tps) || 0;
        const iThroughput = Number(i.throughput_tps) || 0;
        if (cThroughput !== iThroughput) {
            return cThroughput - iThroughput;
        }

        const cTtft = Number(c.ttft_ms) || Number.POSITIVE_INFINITY;
        const iTtft = Number(i.ttft_ms) || Number.POSITIVE_INFINITY;
        if (cTtft !== iTtft) {
            return iTtft - cTtft;
        }

        const cError = Number(c.error_rate) || 0;
        const iError = Number(i.error_rate) || 0;
        if (cError !== iError) {
            return iError - cError;
        }

        const cHit = Number(c.prefix_hit_rate) || 0;
        const iHit = Number(i.prefix_hit_rate) || 0;
        if (cHit !== iHit) {
            return cHit - iHit;
        }

        const cMem = Number(c.peak_mem_mb) || Number.POSITIVE_INFINITY;
        const iMem = Number(i.peak_mem_mb) || Number.POSITIVE_INFINITY;
        if (cMem !== iMem) {
            return iMem - cMem;
        }

        return compareByReleaseDateDesc(candidate, incumbent);
    }

    function aggregateVersionBuilds(entries) {
        const groups = new Map();

        entries.forEach((entry) => {
            const key = createAggregationKey(entry);
            const existing = groups.get(key);

            if (!existing) {
                groups.set(key, {
                    best: entry,
                    variants: [entry],
                });
                return;
            }

            existing.variants.push(entry);
            if (compareEntryQuality(entry, existing.best) > 0) {
                existing.best = entry;
            }
        });

        return Array.from(groups.values()).map((group) => {
            const sortedVariants = [...group.variants].sort((a, b) => {
                const qualityCompare = compareEntryQuality(b, a);
                if (qualityCompare !== 0) {
                    return qualityCompare;
                }
                return compareVersions(b.sagellm_version, a.sagellm_version);
            });

            return {
                ...group.best,
                displayVersion: normalizeDisplayVersion(group.best.sagellm_version),
                versionVariants: sortedVariants,
            };
        });
    }

    function sortForDisplay(entries, selectedWorkload) {
        const sorted = [...entries];

        if (selectedWorkload === 'all') {
            sorted.sort((a, b) => {
                const workloadCompare = getWorkloadId(a).localeCompare(getWorkloadId(b));
                if (workloadCompare !== 0) {
                    return workloadCompare;
                }

                const versionCompare = compareVersions(getDisplayVersion(b), getDisplayVersion(a));
                if (versionCompare !== 0) {
                    return versionCompare;
                }

                return compareByReleaseDateDesc(a, b);
            });
            return sorted;
        }

        sorted.sort((a, b) => {
            const versionCompare = compareVersions(getDisplayVersion(b), getDisplayVersion(a));
            if (versionCompare !== 0) {
                return versionCompare;
            }
            return compareByReleaseDateDesc(a, b);
        });
        return sorted;
    }

    function buildTrendRows(filtered, selectedWorkload) {
        if (selectedWorkload === 'all') {
            return filtered.map((entry) => ({
                ...entry,
                trends: {},
                baselineTrends: {},
                isBaseline: false,
            }));
        }

        const baseline = filtered[filtered.length - 1];
        return filtered.map((entry, index) => {
            const prevEntry = filtered[index + 1];
            const trends = prevEntry ? calculateTrends(entry, prevEntry) : {};
            const baselineTrends = (index < filtered.length - 1) ? calculateTrends(entry, baseline) : {};
            const isBaseline = (index === filtered.length - 1);
            return { ...entry, trends, baselineTrends, isBaseline };
        });
    }

    // 初始化筛选器默认值（选择第一个可用配置）
    function initializeFilters() {
        ['single-chip', 'multi-chip', 'multi-node'].forEach(tab => {
            const data = getDataByTab(tab);
            if (data.length > 0) {
                const first = data[0];
                state.filters[tab] = {
                    hardware: first.hardware.chip_model,
                    model: first.model.name,
                    version: 'all',
                    workload: 'all',
                    precision: first.model.precision
                };
            }
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                switchTab(tab);
            });
        });

        // Filter changes
        ['hardware', 'model', 'version', 'workload', 'precision'].forEach(filterType => {
            const selectEl = document.getElementById(`filter-${filterType}`);
            if (selectEl) {
                selectEl.addEventListener('change', () => {
                    state.filters[state.currentTab][filterType] = selectEl.value;
                    renderTable();
                });
            }
        });
    }

    // Get data by tab
    function getDataByTab(tab) {
        switch (tab) {
            case 'single-chip': return state.singleChipData;
            case 'multi-chip': return state.multiChipData;
            case 'multi-node': return state.multiNodeData;
            default: return [];
        }
    }

    // Switch between single-chip/multi-chip/multi-node tabs
    function switchTab(tab) {
        state.currentTab = tab;
        state.expandedRows.clear();

        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        renderFilters();
        renderTable();
    }

    // Render filter dropdowns
    function renderFilters() {
        const data = getDataByTab(state.currentTab);
        const filters = state.filters[state.currentTab];

        // Extract unique values
        const hardwareOptions = getUniqueValues(data, d => d.hardware.chip_model);
        const modelOptions = getUniqueValues(data, d => d.model.name);
        const versionOptions = getVersionOptions(data);
        const dynamicWorkloads = getUniqueValues(data, d => getWorkloadId(d));
        const workloadOptions = ['all', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];
        dynamicWorkloads.forEach(workload => {
            if (!workloadOptions.includes(workload)) {
                workloadOptions.push(workload);
            }
        });
        const precisionOptions = getUniqueValues(data, d => d.model.precision);

        // Update dropdowns
        updateSelect('filter-hardware', ['all', ...hardwareOptions], filters.hardware);
        updateSelect('filter-model', ['all', ...modelOptions], filters.model);
        updateSelect('filter-version', ['all', ...versionOptions], filters.version);
        updateSelect('filter-workload', workloadOptions, filters.workload, getWorkloadLabel);
        updateSelect('filter-precision', ['all', ...precisionOptions], filters.precision);
    }

    function getVersionOptions(data) {
        const dataVersions = getUniqueValues(data, d => normalizeDisplayVersion(d.sagellm_version));
        const releaseVersions = (state.sagellmVersionOptions || []).map((version) =>
            normalizeDisplayVersion(version)
        );
        const merged = [...new Set([...releaseVersions, ...dataVersions])]
            .filter((version) => /^\d+(\.\d+){2}\.x$/.test(version))
            .sort((a, b) => compareVersions(b, a));
        return merged;
    }

    function getUniqueValues(data, accessor) {
        // 删除 'all'，只返回唯一值
        return [...new Set(data.map(accessor).filter(Boolean))];
    }

    function updateSelect(id, options, selectedValue, labelMapper = null) {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = options.map(opt =>
            `<option value="${opt}" ${opt === selectedValue ? 'selected' : ''}>${labelMapper ? labelMapper(opt) : opt}</option>`
        ).join('');

        if (selectedValue && options.includes(selectedValue)) {
            select.value = selectedValue;
        } else if (options.includes('all')) {
            select.value = 'all';
            state.filters[state.currentTab][id.replace('filter-', '')] = 'all';
        }
    }

    // Render leaderboard table
    function renderTable() {
        const tbody = document.getElementById('leaderboard-tbody');
        const emptyState = document.getElementById('empty-state');

        if (!tbody) return;

        const data = getDataByTab(state.currentTab);
        const filters = state.filters[state.currentTab];

        // Apply filters
        const filtered = data.filter(entry => {
            const workload = getWorkloadId(entry);
            return (filters.hardware === 'all' || entry.hardware.chip_model === filters.hardware) &&
                (filters.model === 'all' || entry.model.name === filters.model) &&
                (filters.version === 'all' || normalizeDisplayVersion(entry.sagellm_version) === filters.version) &&
                (filters.workload === 'all' || workload === filters.workload) &&
                (filters.precision === 'all' || entry.model.precision === filters.precision);
        });

        const mergedEntries = aggregateVersionBuilds(filtered);
        const sortedFiltered = sortForDisplay(mergedEntries, filters.workload);

        // Show empty state if no data
        if (mergedEntries.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            renderDataStats(data.length, 0, 0);
            return;
        }

        emptyState.style.display = 'none';
        renderDataStats(data.length, filtered.length, mergedEntries.length);

        const withTrends = buildTrendRows(sortedFiltered, filters.workload);

        // Render rows
        tbody.innerHTML = withTrends.map((entry, index) => {
            const isLatest = index === 0;
            const isExpanded = state.expandedRows.has(entry.entry_id);
            const currentVersion = getDisplayVersion(entry);
            const prevVersion = index > 0 ? getDisplayVersion(withTrends[index - 1]) : null;
            const showVersion = index === 0 || currentVersion !== prevVersion;

            return `
                ${renderDataRow(entry, isLatest, isExpanded, showVersion)}
                ${renderDetailsRow(entry, isExpanded)}
            `;
        }).join('');

        // Attach event listeners for buttons
        attachRowEventListeners();
    }

    function renderDataStats(tabTotal, rawFilteredTotal, mergedTotal) {
        const statsEl = document.getElementById('leaderboard-data-stats');
        if (!statsEl) {
            return;
        }

        statsEl.textContent = `Loaded ${state.totalLoadedEntries} entries • ${state.currentTab}: ${tabTotal} • Matched ${rawFilteredTotal} build entries • Showing ${mergedTotal} merged entries`;
    }

    async function renderLastUpdated() {
        const el = document.getElementById('leaderboard-last-updated');
        if (!el) {
            return;
        }

        let timestamp = null;
        if (window.HFDataLoader && window.HFDataLoader.getLastUpdated) {
            timestamp = await window.HFDataLoader.getLastUpdated();
        }

        if (!timestamp) {
            el.textContent = 'Last updated: -';
            return;
        }

        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
            el.textContent = `Last updated: ${timestamp}`;
            return;
        }

        const formatted = date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
        el.textContent = `Last updated: ${formatted}`;
    }

    // Render data row
    function renderDataRow(entry, isLatest, isExpanded, showVersion) {
        const m = entry.metrics;
        const t = entry.trends || {};
        const bt = entry.baselineTrends || {};
        const releaseDate = entry?.metadata?.release_date || '-';
        const displayVersion = getDisplayVersion(entry);
        const buildCount = entry.versionVariants?.length || 1;

        // 生成配置描述（芯片数/节点数）
        const configText = getConfigText(entry);
        const workloadText = getWorkloadLabel(getWorkloadId(entry));

        return `
            <tr data-entry-id="${entry.entry_id}">
                <td>
                    <div class="version-cell">
                        ${showVersion ? `<div class="version-main">v${displayVersion}<small class="version-date">(${releaseDate})</small></div>` : ''}
                        ${showVersion && buildCount > 1 ? '<small class="version-merge-hint">Best 4th-segment result selected</small>' : ''}
                        ${(showVersion && (isLatest || entry.isBaseline))
                            ? `<div class="version-badges">${isLatest ? '<span class="version-badge">Latest</span>' : ''}${entry.isBaseline ? '<span class="version-badge baseline">Baseline</span>' : ''}</div>`
                            : ''}
                    </div>
                </td>
                <td class="config-cell">${workloadText}</td>
                <td class="config-cell">${configText}</td>
                <td>${renderMetricCell(m.ttft_ms, t.ttft_ms, bt.ttft_ms, false, false, entry.isBaseline)}</td>
                <td>${renderMetricCell(m.throughput_tps, t.throughput_tps, bt.throughput_tps, true, false, entry.isBaseline)}</td>
                <td>${renderMetricCell(m.peak_mem_mb, t.peak_mem_mb, bt.peak_mem_mb, false, false, entry.isBaseline)}</td>
                <td>${renderMetricCell(m.error_rate, t.error_rate, bt.error_rate, false, true, entry.isBaseline)}</td>
                <td>${renderMetricCell(m.prefix_hit_rate, t.prefix_hit_rate, bt.prefix_hit_rate, true, true, entry.isBaseline)}</td>
                <td class="action-cell">
                    <button class="btn-details" data-entry-id="${entry.entry_id}">
                        ${isExpanded ? 'Hide' : (buildCount > 1 ? '4th Ver.' : 'Details')}
                    </button>
                </td>
            </tr>
        `;
    }

    // 生成配置描述文本
    function getConfigText(entry) {
        const chipCount = entry.hardware.chip_count;
        const nodeCount = entry.cluster ? entry.cluster.node_count : 1;

        if (nodeCount === 1 && chipCount === 1) {
            return `1 × ${entry.hardware.chip_model}`;
        } else if (nodeCount === 1 && chipCount > 1) {
            return `${chipCount} × ${entry.hardware.chip_model}`;
        } else {
            return `${nodeCount} nodes × ${chipCount} chips<br><small>(${entry.cluster.interconnect})</small>`;
        }
    }

    // Render metric cell with trend (双重对比：vs baseline 和 vs 上一版)
    function renderMetricCell(value, prevTrend, baselineTrend, higherIsBetter, isPercentage = false, isBaseline = false) {
        const formattedValue = isPercentage ?
            (value * 100).toFixed(1) + '%' :
            typeof value === 'number' ? value.toFixed(1) : value;

        if (isBaseline) {
            return `<div class="metric-cell"><span class="metric-value">${formattedValue}</span></div>`;
        }

        const prevTrendHtml = prevTrend !== undefined && prevTrend !== null ? formatTrendIndicator(prevTrend, higherIsBetter, 'vs Prev') : '';
        const baseTrendHtml = baselineTrend !== undefined && baselineTrend !== null ? formatTrendIndicator(baselineTrend, higherIsBetter, 'vs Base') : '';

        return `
            <div class="metric-cell">
                <span class="metric-value">${formattedValue}</span>
                ${prevTrendHtml}
                ${baseTrendHtml}
            </div>
        `;
    }

    function formatTrendIndicator(trend, higherIsBetter, label) {
        const trendClass = getTrendClass(trend, higherIsBetter);
        const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
        const trendText = Math.abs(trend).toFixed(1) + '%';
        return `<small style="color: #718096;">${label}: <span class="metric-trend ${trendClass}">${trendIcon} ${trendText}</span></small>`;
    }

    function getTrendClass(trend, higherIsBetter) {
        if (trend === 0) return 'trend-neutral';
        const isImprovement = higherIsBetter ? trend > 0 : trend < 0;
        return isImprovement ? 'trend-up' : 'trend-down';
    }

    // Render details row
    function renderDetailsRow(entry, isExpanded) {
        return `
            <tr class="details-row ${isExpanded ? 'show' : ''}" data-details-for="${entry.entry_id}">
                <td colspan="9" class="details-cell">
                    <div class="details-content">
                        ${renderHardwareSection(entry)}
                        ${renderBuildVariantsSection(entry)}
                        ${renderVersionsSection(entry)}
                        ${renderImprovementsSection(entry)}
                        ${renderReproduceSection(entry)}
                    </div>
                </td>
            </tr>
        `;
    }

    function renderHardwareSection(entry) {
        const hw = entry.hardware;
        const cluster = entry.cluster;
        const env = entry.environment;

        return `
            <div class="detail-section">
                <h4>🔧 Hardware Configuration</h4>
                <p><strong>Chip:</strong> ${hw.chip_model} × ${hw.chip_count}</p>
                <p><strong>Total Memory:</strong> ${hw.total_memory_gb} GB</p>
                ${env && env.cuda_version ? `<p><strong>CUDA:</strong> ${env.cuda_version}</p>` : ''}
                ${env && env.cann_version ? `<p><strong>CANN:</strong> ${env.cann_version}</p>` : ''}
                ${cluster ? `
                    <p><strong>Cluster:</strong> ${cluster.node_count} nodes, ${cluster.interconnect} (${cluster.topology})</p>
                ` : ''}
            </div>
        `;
    }

    function renderVersionsSection(entry) {
        const versions = entry.versions || {};
        const rows = VERSION_COMPONENTS.map((component) => {
            const benchmarkVersion = component.metadataKey === 'sagellm'
                ? (entry.sagellm_version || versions.sagellm || 'N/A')
                : (versions[component.metadataKey] || 'N/A');
            const pypiVersion = state.pypiVersions[component.pypiPackage] || (state.pypiLoaded ? 'N/A' : 'Loading...');
            const status = getVersionComparisonStatus(benchmarkVersion, pypiVersion);

            return {
                label: component.label,
                benchmarkVersion,
                pypiVersion,
                status,
            };
        });

        const mismatchCount = rows.filter((row) => row.status === 'ahead').length;
        const historicalCount = rows.filter((row) => row.status === 'behind').length;
        const sourceHint = state.pypiLoaded
            ? 'Source: benchmark metadata + PyPI latest reference'
            : 'Source: benchmark metadata (PyPI versions loading...)';

        return `
            <div class="detail-section">
                <h4>📦 Component Versions</h4>
                ${rows.map((row) => `<p><strong>${row.label}:</strong> ${row.benchmarkVersion} <span style="color:#718096">| PyPI: ${row.pypiVersion}</span>${row.status === 'ahead' ? ' <span style="color:#e53e3e;font-weight:600">⚠ mismatch</span>' : row.status === 'behind' ? ' <span style="color:#718096;font-weight:600">ℹ historical</span>' : ''}</p>`).join('')}
                <p><small style="color:#718096">${sourceHint}</small></p>
                ${mismatchCount > 0 ? '<p><small style="color:#e53e3e">检测到版本异常：benchmark 结果中的部分组件版本高于 PyPI 最新发布。</small></p>' : ''}
                ${mismatchCount === 0 && historicalCount > 0 ? '<p><small style="color:#718096">检测到历史结果：部分组件版本低于 PyPI 最新发布。</small></p>' : ''}
                ${state.pypiLoadError ? '<p><small style="color:#dd6b20">PyPI 版本拉取失败，仅展示 benchmark metadata。</small></p>' : ''}
            </div>
        `;
    }

    function renderBuildVariantsSection(entry) {
        const variants = entry.versionVariants || [entry];

        return `
            <div class="detail-section">
                <h4>🧩 Full Build Results</h4>
                <p><strong>Displayed version:</strong> v${getDisplayVersion(entry)}（首页展示该三位版本下的最佳四位版本）</p>
                <div class="build-variants-table-wrap">
                    <table class="build-variants-table">
                        <thead>
                            <tr>
                                <th>Full Version</th>
                                <th>Release Date</th>
                                <th>TTFT</th>
                                <th>Tokens/s</th>
                                <th>Peak Mem</th>
                                <th>Error</th>
                                <th>Hit Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${variants.map((variant, index) => {
            const vm = variant.metrics || {};
            const selected = variant.entry_id === entry.entry_id ? 'selected' : '';
            return `
                                    <tr class="${selected}">
                                        <td>v${variant.sagellm_version}${index === 0 ? ' ⭐' : ''}</td>
                                        <td>${variant?.metadata?.release_date || '-'}</td>
                                        <td>${formatMetric(vm.ttft_ms)}</td>
                                        <td>${formatMetric(vm.throughput_tps)}</td>
                                        <td>${formatMetric(vm.peak_mem_mb)}</td>
                                        <td>${formatMetric(vm.error_rate, true)}</td>
                                        <td>${formatMetric(vm.prefix_hit_rate, true)}</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function formatMetric(value, isPercentage = false) {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return '-';
        }

        if (isPercentage) {
            return `${(value * 100).toFixed(1)}%`;
        }

        if (typeof value === 'number') {
            return value.toFixed(1);
        }

        return String(value);
    }

    function getVersionComparisonStatus(benchmarkVersion, pypiVersion) {
        if (!isComparableVersion(benchmarkVersion) || !isComparableVersion(pypiVersion)) {
            return 'unknown';
        }

        const comparison = compareVersions(benchmarkVersion, pypiVersion);
        if (comparison > 0) {
            return 'ahead';
        }
        if (comparison < 0) {
            return 'behind';
        }
        return 'match';
    }

    function isComparableVersion(version) {
        if (!version || version === 'N/A' || version === 'Loading...') {
            return false;
        }
        return FULL_VERSION_REGEX.test(String(version));
    }

    function renderImprovementsSection(entry) {
        const meta = entry.metadata;
        return `
            <div class="detail-section">
                <h4>🚀 Improvements</h4>
                <p>${meta.notes || 'No specific improvements noted.'}</p>
                <p><strong>Git Commit:</strong> <code>${meta.git_commit}</code></p>
                <p><strong>Changelog:</strong> <a href="${meta.changelog_url}" target="_blank" style="color: #5a67d8;">View</a></p>
            </div>
        `;
    }

    function renderReproduceSection(entry) {
        const cmd = entry.metadata.reproducible_cmd;
        return `
            <div class="detail-section">
                <h4>🔁 Reproduce This Result</h4>
                <div class="command-block">
                    <button class="btn-copy" data-cmd="${encodeURIComponent(cmd)}">Copy</button>
                    <code>${cmd}</code>
                </div>
            </div>
        `;
    }

    // Attach event listeners to dynamically created buttons
    function attachRowEventListeners() {
        // Details toggle
        document.querySelectorAll('.btn-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entryId = e.target.dataset.entryId;
                toggleDetails(entryId);
            });
        });

        // Copy buttons
        document.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cmd = decodeURIComponent(e.target.dataset.cmd);
                copyToClipboard(cmd, e.target);
            });
        });
    }

    // Toggle details row
    function toggleDetails(entryId) {
        if (state.expandedRows.has(entryId)) {
            state.expandedRows.delete(entryId);
        } else {
            state.expandedRows.add(entryId);
        }
        renderTable();
    }

    // Copy to clipboard
    function copyToClipboard(text, btnEl) {
        navigator.clipboard.writeText(text).then(() => {
            btnEl.textContent = 'Copied!';
            btnEl.classList.add('copied');
            setTimeout(() => {
                btnEl.textContent = 'Copy';
                btnEl.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy command');
        });
    }

    // Calculate trends between two versions
    function calculateTrends(current, previous) {
        const trends = {};
        const metrics = ['ttft_ms', 'throughput_tps', 'peak_mem_mb', 'error_rate', 'prefix_hit_rate'];

        metrics.forEach(metric => {
            const curr = current.metrics[metric];
            const prev = previous.metrics[metric];

            if (curr != null && prev != null && prev !== 0) {
                trends[metric] = ((curr - prev) / prev) * 100;
            }
        });

        return trends;
    }

    // Compare semantic versions (e.g., "0.3.2" > "0.3.1")
    function compareVersions(a, b) {
        const aParts = String(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
        const bParts = String(b).split('.').map((part) => Number.parseInt(part, 10) || 0);

        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;

            if (aVal !== bVal) {
                return aVal - bVal;
            }
        }

        return 0;
    }

})();
