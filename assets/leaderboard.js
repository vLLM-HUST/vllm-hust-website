/**
 * LLM Engine Leaderboard - Version Evolution Display
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
        en: {
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
        },
        zh: {
            all: '全部',
            Q1: 'Q1 – 短问答',
            Q2: 'Q2 – 长摘要',
            Q3: 'Q3 – 代码生成',
            Q4: 'Q4 – 多轮推理',
            Q5: 'Q5 – 压测：短并发',
            Q6: 'Q6 – 压测：长并发',
            Q7: 'Q7 – 思维链',
            Q8: 'Q8 – 混合批次',
            Other: '其他',
        },
    };

    const ENGINE_LABELS = {
        en: {
            sagellm: 'sageLLM',
            vllm: 'vLLM',
            'vllm-ascend': 'vLLM Ascend',
            sglang: 'SGLang',
            unknown: 'Unknown',
        },
        zh: {
            sagellm: 'sageLLM',
            vllm: 'vLLM',
            'vllm-ascend': 'vLLM Ascend',
            sglang: 'SGLang',
            unknown: '未知',
        },
    };

    const UI_STRINGS = {
        en: {
            statsHidden: 'Hidden',
            statsSparseSuffix: 'sparse or out-of-scope rows',
            statsLoaded: 'Loaded',
            statsMatched: 'Matched',
            statsBuildEntries: 'build entries',
            statsShowing: 'Showing',
            statsComparisonRows: 'comparison rows across',
            statsCompleteGroups: 'complete groups',
            quickCompare: 'Quick Compare',
            lastUpdated: 'Last updated',
            noComparableTitle: 'No comparable rows in the current view.',
            noComparableHidden: 'The current filters only expose sparse groups. Turn off "Hide sparse benchmark rows" if you want to inspect single-engine rows.',
            noComparableRelax: 'Relax one or more filters to bring engines back into the same comparison frame.',
            rows: 'rows',
            engines: 'engines',
            completeCompareGroups: 'complete compare groups',
            leadsThroughput: 'leads throughput',
            onlyEngine: 'is the only engine in the current view.',
            comparingEngines: 'Comparing engines in the current view.',
            focusedPrefix: 'Focused apples-to-apples slice: ',
            leadsBy: 'leads the current view by',
            throughputOver: 'throughput over',
            sparseHidden: 'sparse groups hidden',
            completeGroupsLabel: 'Complete groups',
            sparseGroupsLabel: 'Sparse groups',
            focusedScopeLabel: 'Focused scope',
            hiddenRowsLabel: 'Hidden rows',
            latest: 'Latest',
            baseline: 'Baseline',
            bestFourth: 'Best 4th-segment result selected',
            sparseGroup: 'Sparse group: no peer engine in the same comparison scope',
            hide: 'Hide',
            details: 'Details',
            fourthVersion: '4th Ver.',
            unknown: 'Unknown',
            row: 'row',
            singleNode: 'single-node',
            nodes: 'nodes',
            chips: 'chips',
            vsPrev: 'vs Prev',
            hardwareConfig: '🔧 Hardware Configuration',
            hardwareConfiguration: '🔧 Hardware Configuration',
            chip: 'Chip',
            totalMemory: 'Total Memory',
            cuda: 'CUDA',
            cann: 'CANN',
            cluster: 'Cluster',
            engineVersions: '📦 Engine Versions',
            engine: 'Engine',
            engineVersion: 'Engine Version',
            benchmark: 'Benchmark',
            componentVersions: '📦 Component Versions',
            versionSourceReady: 'Source: benchmark metadata + PyPI latest reference',
            versionSourceLoading: 'Source: benchmark metadata (PyPI versions loading...)',
            sourceHintLoaded: 'Source: benchmark metadata + PyPI latest reference',
            sourceHintLoading: 'Source: benchmark metadata (PyPI versions loading...)',
            mismatch: 'mismatch',
            historical: 'historical',
            versionMismatchNote: 'Detected version mismatch: some component versions in the benchmark results are higher than the latest PyPI release.',
            historicalNote: 'Historical result detected: some component versions are lower than the latest PyPI release.',
            pypiLoadError: 'Failed to load PyPI versions; showing benchmark metadata only.',
            mismatchDetected: 'Detected version mismatch: some component versions in the benchmark results are higher than the latest PyPI release.',
            historicalDetected: 'Historical result detected: some component versions are lower than the latest PyPI release.',
            pypiLoadFailed: 'Failed to load PyPI versions; showing benchmark metadata only.',
            fullBuildResults: '🧩 Full Build Results',
            displayedVersion: 'Displayed version:',
            bestFourthInline: '(the best 4th-segment build under this 3-segment version is shown on the main table)',
            displayedVersionHint: 'the best 4th-segment build under this 3-segment version is shown on the main table',
            fullVersion: 'Full Version',
            releaseDate: 'Release Date',
            ttft: 'TTFT',
            tokensPerSecond: 'Tokens/s',
            peakMem: 'Peak Mem',
            error: 'Error',
            hitRate: 'Hit Rate',
            improvements: '🚀 Improvements',
            noSpecificImprovements: 'No specific improvements noted.',
            gitCommit: 'Git Commit',
            changelog: 'Changelog',
            view: 'View',
            reproduceThisResult: '🔁 Reproduce This Result',
            reproduce: '🔁 Reproduce This Result',
            copy: 'Copy',
            copiedBang: 'Copied!',
            copyCommandFailed: 'Failed to copy command',
            copied: 'Copied!',
            copyFailed: 'Failed to copy command',
            selectedStar: '⭐',
            throughputLeader: 'Throughput leader',
            rowCount: 'rows',
            bestVisibleVersion: 'Best visible version',
            avgTTFT: 'Avg TTFT',
            avgTBT: 'Avg TBT',
            avgThroughput: 'Avg Throughput',
            errorRate: 'Error Rate',
            bestVisibleRun: 'Best visible run',
            parity: 'parity',
            better: 'better',
            worse: 'worse',
            throughputGap: 'Throughput gap',
            gap: 'gap',
            ttftGap: 'TTFT gap',
            tbtGap: 'TBT gap',
            onlyEngineView: 'is the only engine in the current view.',
            comparing: 'Comparing',
            enginesInView: 'engines in the current view.',
            focusedSlice: 'Focused apples-to-apples slice:',
            leadsCurrentView: 'leads the current view by',
            models: 'models',
            hardwareTargets: 'hardware targets',
            workloads: 'workloads',
            sparseGroupsHidden: 'sparse groups hidden',
            completeGroups: 'Complete groups',
            sparseGroups: 'Sparse groups',
            focusedScope: 'Focused scope',
            hiddenRows: 'Hidden rows',
            versusShort: 'VS',
        },
        zh: {
            statsHidden: '已隐藏',
            statsSparseSuffix: '条稀疏或超出范围的数据',
            statsLoaded: '已加载',
            statsMatched: '匹配到',
            statsBuildEntries: '条构建记录',
            statsShowing: '展示',
            statsComparisonRows: '条对比记录，覆盖',
            statsCompleteGroups: '个完整分组',
            quickCompare: '快速对比',
            lastUpdated: '最近更新',
            noComparableTitle: '当前视图没有可直接对比的数据。',
            noComparableHidden: '当前筛选下只剩稀疏分组。如果你想查看单引擎结果，可以关闭“隐藏缺少对比的数据”。',
            noComparableRelax: '放宽一个或多个筛选条件，让引擎回到同一对比范围。',
            rows: '条记录',
            engines: '个引擎',
            completeCompareGroups: '个完整对比分组',
            leadsThroughput: '吞吐领先',
            onlyEngine: '是当前视图中的唯一引擎。',
            comparingEngines: '当前视图包含多个引擎。',
            focusedPrefix: '当前为严格同条件视图：',
            leadsBy: '当前吞吐领先',
            throughputOver: '，相对',
            sparseHidden: '个稀疏分组已隐藏',
            completeGroupsLabel: '完整分组',
            sparseGroupsLabel: '稀疏分组',
            focusedScopeLabel: '锁定范围',
            hiddenRowsLabel: '隐藏行数',
            latest: '最新',
            baseline: '基线',
            bestFourth: '主表展示该三位版本下表现最好的四段版本',
            sparseGroup: '稀疏分组：当前比较范围内没有可直接对照的其他引擎',
            hide: '收起',
            details: '详情',
            fourthVersion: '四段版本',
            unknown: '未知',
            row: '条记录',
            singleNode: '单机',
            nodes: '节点',
            chips: '卡',
            vsPrev: '较上一版',
            hardwareConfig: '🔧 硬件配置',
            hardwareConfiguration: '🔧 硬件配置',
            chip: '芯片',
            totalMemory: '总显存',
            cuda: 'CUDA',
            cann: 'CANN',
            cluster: '集群',
            engineVersions: '📦 引擎版本',
            engine: '引擎',
            engineVersion: '引擎版本',
            benchmark: 'Benchmark',
            componentVersions: '📦 组件版本',
            versionSourceReady: '来源：benchmark metadata + PyPI 最新版本参考',
            versionSourceLoading: '来源：benchmark metadata（PyPI 版本加载中）',
            sourceHintLoaded: '来源：benchmark metadata + PyPI 最新版本参考',
            sourceHintLoading: '来源：benchmark metadata（PyPI 版本加载中）',
            mismatch: '异常',
            historical: '历史版本',
            versionMismatchNote: '检测到版本异常：benchmark 结果中的部分组件版本高于 PyPI 最新发布。',
            historicalNote: '检测到历史结果：部分组件版本低于 PyPI 最新发布。',
            pypiLoadError: 'PyPI 版本拉取失败，仅展示 benchmark metadata。',
            mismatchDetected: '检测到版本异常：benchmark 结果中的部分组件版本高于 PyPI 最新发布。',
            historicalDetected: '检测到历史结果：部分组件版本低于 PyPI 最新发布。',
            pypiLoadFailed: 'PyPI 版本拉取失败，仅展示 benchmark metadata。',
            fullBuildResults: '🧩 完整构建结果',
            displayedVersion: '当前展示版本：',
            bestFourthInline: '（主表展示该三位版本下表现最好的四段版本）',
            displayedVersionHint: '主表展示该三位版本下表现最好的四段版本',
            fullVersion: '完整版本',
            releaseDate: '发布日期',
            ttft: 'TTFT',
            tokensPerSecond: 'Tokens/s',
            peakMem: '峰值显存',
            error: '错误率',
            hitRate: '命中率',
            improvements: '🚀 改进说明',
            noSpecificImprovements: '没有额外改进说明。',
            gitCommit: 'Git Commit',
            changelog: '变更记录',
            view: '查看',
            reproduceThisResult: '🔁 复现实验结果',
            reproduce: '🔁 复现实验',
            copy: '复制',
            copiedBang: '已复制！',
            copyCommandFailed: '复制命令失败',
            copied: '已复制！',
            copyFailed: '复制命令失败',
            selectedStar: '⭐',
            throughputLeader: '吞吐领先',
            rowCount: '条记录',
            bestVisibleVersion: '当前最佳可见版本',
            avgTTFT: '平均 TTFT',
            avgTBT: '平均 TBT',
            avgThroughput: '平均吞吐',
            errorRate: '错误率',
            bestVisibleRun: '当前最佳样本',
            parity: '持平',
            better: '更优',
            worse: '更差',
            throughputGap: '吞吐差距',
            gap: '差距',
            ttftGap: 'TTFT 差距',
            tbtGap: 'TBT 差距',
            onlyEngineView: '是当前视图中的唯一引擎。',
            comparing: '当前正在比较',
            enginesInView: '个引擎。',
            focusedSlice: '当前为严格同条件视图：',
            leadsCurrentView: '当前吞吐领先',
            models: '个模型',
            hardwareTargets: '类硬件目标',
            workloads: '个工作负载',
            sparseGroupsHidden: '个稀疏分组已隐藏',
            completeGroups: '完整分组',
            sparseGroups: '稀疏分组',
            focusedScope: '锁定范围',
            hiddenRows: '隐藏行数',
            versusShort: '对比',
        },
    };

    // State management
    let state = {
        currentTab: 'single-chip', // single-chip, multi-chip, multi-node
        singleChipData: [],
        multiChipData: [],
        multiNodeData: [],
        compareSnapshot: null,
        totalLoadedEntries: 0,
        filters: {
            'single-chip': { engine: '', hardware: '', model: '', version: '', workload: '', precision: '' },
            'multi-chip': { engine: '', hardware: '', model: '', version: '', workload: '', precision: '' },
            'multi-node': { engine: '', hardware: '', model: '', version: '', workload: '', precision: '' }
        },
        viewOptions: {
            'single-chip': { sameScopeOnly: false, hideIncompleteGroups: true },
            'multi-chip': { sameScopeOnly: false, hideIncompleteGroups: true },
            'multi-node': { sameScopeOnly: false, hideIncompleteGroups: true }
        },
        expandedRows: new Set()
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('sagellm:langchange', () => {
        renderFilters();
        renderViewControls();
        renderTable();
        void renderLastUpdated();
    });

    async function init() {
        await loadData();
        setupEventListeners();
        renderFilters();
        renderViewControls();
        renderTable();
        await renderLastUpdated();
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
                state.compareSnapshot = data.compare || null;
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
                state.compareSnapshot = null;
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
                data.sort(compareEntriesByVersionDesc);
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
        const lang = getCurrentLang();
        return (WORKLOAD_LABELS[lang] && WORKLOAD_LABELS[lang][workloadId]) || workloadId;
    }

    function compareByReleaseDateDesc(a, b) {
        const aDate = Date.parse(a?.metadata?.release_date || '') || 0;
        const bDate = Date.parse(b?.metadata?.release_date || '') || 0;
        return bDate - aDate;
    }

    function normalizeDisplayVersion(version) {
        const text = String(version || '').trim();
        if (!text) {
            return '';
        }
        if (/^\d+\.\d+\.\d+\.\d+$/.test(text)) {
            const parts = text.split('.');
            return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
        }
        return text;
    }

    function getEngine(entry) {
        const direct = entry?.engine || entry?.metadata?.engine;
        if (typeof direct === 'string' && direct.trim()) {
            return direct.trim().toLowerCase();
        }
        return 'unknown';
    }

    function getEngineLabel(engine) {
        const lang = getCurrentLang();
        return (ENGINE_LABELS[lang] && ENGINE_LABELS[lang][engine]) || String(engine || t('unknown'));
    }

    function getCurrentLang() {
        return (window.sagellmCurrentLang || document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
    }

    function t(key) {
        const lang = getCurrentLang();
        return (UI_STRINGS[lang] && UI_STRINGS[lang][key]) || UI_STRINGS.en[key] || key;
    }

    function getEngineVersion(entry) {
        return String(
            entry?.engine_version ||
            entry?.metadata?.engine_version ||
            ''
        ).trim();
    }

    function getDisplayVersion(entry) {
        return entry.displayVersion || normalizeDisplayVersion(getEngineVersion(entry));
    }

    function isNumericVersion(version) {
        return /^\d+(\.\d+){1,3}(\.x)?$/.test(String(version || '').trim());
    }

    function compareDisplayVersions(a, b) {
        const normalizedA = String(a || '').replace(/\.x$/, '.0');
        const normalizedB = String(b || '').replace(/\.x$/, '.0');

        if (isNumericVersion(a) && isNumericVersion(b)) {
            return compareVersions(normalizedA, normalizedB);
        }

        return String(a || '').localeCompare(String(b || ''));
    }

    function compareEntriesByVersionDesc(a, b) {
        const engineCompare = getEngine(a).localeCompare(getEngine(b));
        if (engineCompare !== 0) {
            return engineCompare;
        }

        const versionCompare = compareDisplayVersions(getDisplayVersion(b), getDisplayVersion(a));
        if (versionCompare !== 0) {
            return versionCompare;
        }

        return compareByReleaseDateDesc(a, b);
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
        const engine = getEngine(entry);
        const baseVersion = normalizeDisplayVersion(getEngineVersion(entry));

        return [
            engine,
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
                return compareDisplayVersions(getEngineVersion(b), getEngineVersion(a));
            });

            return {
                ...group.best,
                displayVersion: normalizeDisplayVersion(getEngineVersion(group.best)),
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

                const engineCompare = getEngine(a).localeCompare(getEngine(b));
                if (engineCompare !== 0) {
                    return engineCompare;
                }

                const versionCompare = compareDisplayVersions(
                    getDisplayVersion(b),
                    getDisplayVersion(a)
                );
                if (versionCompare !== 0) {
                    return versionCompare;
                }

                return compareByReleaseDateDesc(a, b);
            });
            return sorted;
        }

        sorted.sort((a, b) => {
            const versionCompare = compareDisplayVersions(getDisplayVersion(b), getDisplayVersion(a));
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
                    engine: getEngine(first),
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
        ['engine', 'hardware', 'model', 'version', 'workload', 'precision'].forEach(filterType => {
            const selectEl = document.getElementById(`filter-${filterType}`);
            if (selectEl) {
                selectEl.addEventListener('change', () => {
                    state.filters[state.currentTab][filterType] = selectEl.value;
                    renderTable();
                });
            }
        });

        const sameScopeToggle = document.getElementById('toggle-same-scope');
        if (sameScopeToggle) {
            sameScopeToggle.addEventListener('change', () => {
                state.viewOptions[state.currentTab].sameScopeOnly = sameScopeToggle.checked;
                renderTable();
            });
        }

        const hideIncompleteToggle = document.getElementById('toggle-hide-incomplete');
        if (hideIncompleteToggle) {
            hideIncompleteToggle.addEventListener('change', () => {
                state.viewOptions[state.currentTab].hideIncompleteGroups = hideIncompleteToggle.checked;
                renderTable();
            });
        }
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
        renderViewControls();
        renderTable();
    }

    function renderViewControls() {
        const viewOptions = state.viewOptions[state.currentTab];
        const sameScopeToggle = document.getElementById('toggle-same-scope');
        const hideIncompleteToggle = document.getElementById('toggle-hide-incomplete');

        if (sameScopeToggle) {
            sameScopeToggle.checked = viewOptions.sameScopeOnly;
        }

        if (hideIncompleteToggle) {
            hideIncompleteToggle.checked = viewOptions.hideIncompleteGroups;
        }
    }

    // Render filter dropdowns
    function renderFilters() {
        const data = getDataByTab(state.currentTab);
        const filters = state.filters[state.currentTab];

        // Extract unique values
        const engineOptions = getUniqueValues(data, d => getEngine(d));
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
        updateSelect('filter-engine', ['all', ...engineOptions], filters.engine, getEngineLabel);
        updateSelect('filter-hardware', ['all', ...hardwareOptions], filters.hardware);
        updateSelect('filter-model', ['all', ...modelOptions], filters.model);
        updateSelect('filter-version', ['all', ...versionOptions], filters.version);
        updateSelect('filter-workload', workloadOptions, filters.workload, getWorkloadLabel);
        updateSelect('filter-precision', ['all', ...precisionOptions], filters.precision);
    }

    function getVersionOptions(data) {
        const merged = [...new Set(getUniqueValues(data, d => normalizeDisplayVersion(getEngineVersion(d))))]
            .filter((version) => String(version || '').trim())
            .sort((a, b) => compareDisplayVersions(b, a));
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
        const viewOptions = state.viewOptions[state.currentTab];

        // Apply filters
        const filtered = data.filter(entry => {
            const workload = getWorkloadId(entry);
            return (filters.engine === 'all' || getEngine(entry) === filters.engine) &&
                (filters.hardware === 'all' || entry.hardware.chip_model === filters.hardware) &&
                (filters.model === 'all' || entry.model.name === filters.model) &&
                (filters.version === 'all' || normalizeDisplayVersion(getEngineVersion(entry)) === filters.version) &&
                (filters.workload === 'all' || workload === filters.workload) &&
                (filters.precision === 'all' || entry.model.precision === filters.precision);
        });

        const comparisonView = applyComparisonView(filtered, viewOptions);
        const visibleEntries = comparisonView.visibleEntries;
        const mergedEntries = aggregateVersionBuilds(visibleEntries);
        const sortedFiltered = sortForDisplay(mergedEntries, filters.workload);

        renderCoverage(comparisonView);

        // Show empty state if no data
        if (mergedEntries.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            renderDataStats(data.length, filtered.length, visibleEntries.length, 0, comparisonView);
            renderOverview([], comparisonView, viewOptions);
            return;
        }

        emptyState.style.display = 'none';
        renderDataStats(data.length, filtered.length, visibleEntries.length, mergedEntries.length, comparisonView);
        renderOverview(sortedFiltered, comparisonView, viewOptions);

        const withTrends = buildTrendRows(sortedFiltered, filters.workload);

        // Render rows
        tbody.innerHTML = withTrends.map((entry, index) => {
            const isLatest = index === 0;
            const isExpanded = state.expandedRows.has(entry.entry_id);
            const currentVersion = getDisplayVersion(entry);
            const prevVersion = index > 0 ? getDisplayVersion(withTrends[index - 1]) : null;
            const showVersion = index === 0 || currentVersion !== prevVersion;
            const isSparse = comparisonView.incompleteKeys.has(createCompareScopeKey(entry));

            return `
                ${renderDataRow(entry, isLatest, isExpanded, showVersion, isSparse)}
                ${renderDetailsRow(entry, isExpanded)}
            `;
        }).join('');

        // Attach event listeners for buttons
        attachRowEventListeners();
    }

    function renderDataStats(tabTotal, rawFilteredTotal, visibleTotal, mergedTotal, comparisonView) {
        const statsEl = document.getElementById('leaderboard-data-stats');
        if (!statsEl) {
            return;
        }

        const hidden = Math.max(rawFilteredTotal - visibleTotal, 0);
        const hiddenText = hidden > 0 ? ` • ${t('statsHidden')} ${hidden} ${t('statsSparseSuffix')}` : '';
        statsEl.textContent = `${t('statsLoaded')} ${state.totalLoadedEntries} • ${state.currentTab}: ${tabTotal} • ${t('statsMatched')} ${rawFilteredTotal} ${t('statsBuildEntries')} • ${t('statsShowing')} ${mergedTotal} ${t('statsComparisonRows')} ${comparisonView.activeCoverage.completeGroupCount} ${t('statsCompleteGroups')}${hiddenText}`;
    }

    function renderOverview(entries, comparisonView, viewOptions) {
        const el = document.getElementById('leaderboard-overview');
        if (!el) {
            return;
        }

        if (!entries.length) {
            const reason = viewOptions.hideIncompleteGroups ? t('noComparableHidden') : t('noComparableRelax');
            el.innerHTML = `
                <div class="overview-hero">
                    <div class="overview-kicker">${t('quickCompare')}</div>
                    <div class="overview-title">${t('noComparableTitle')}</div>
                    <div class="overview-subtitle">${reason}</div>
                </div>
            `;
            return;
        }

        const summaries = summarizeEngines(entries);
        const leaders = getLeaders(summaries);
        const title = getOverviewTitle(summaries, leaders, comparisonView);
        const subtitle = getOverviewSubtitle(entries, summaries.length, comparisonView, viewOptions);
        const badges = getOverviewBadges(entries, summaries.length, leaders, comparisonView);
        const compareSnapshotGroup = findCompareSnapshotGroup(entries, comparisonView);
        const headToHeadHtml = compareSnapshotGroup
            ? renderHeadToHeadFromSnapshot(compareSnapshotGroup)
            : renderHeadToHead(summaries);

        el.innerHTML = `
            <div class="overview-hero">
                <div class="overview-kicker">${t('quickCompare')}</div>
                <div class="overview-title">${title}</div>
                <div class="overview-subtitle">${subtitle}</div>
                <div class="overview-badges">
                    ${badges.map((badge) => `<div class="overview-badge">${badge}</div>`).join('')}
                </div>
                ${headToHeadHtml}
            </div>
            <div class="overview-grid">
                ${summaries.map((summary) => renderEngineSummaryCard(summary, leaders)).join('')}
            </div>
        `;
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
            el.textContent = `${t('lastUpdated')}: -`;
            return;
        }

        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
            el.textContent = `${t('lastUpdated')}: ${timestamp}`;
            return;
        }

        const formatted = date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
        el.textContent = `${t('lastUpdated')}: ${formatted}`;
    }

    // Render data row
    function renderDataRow(entry, isLatest, isExpanded, showVersion, isSparse) {
        const m = entry.metrics;
        const trends = entry.trends || {};
        const releaseDate = entry?.metadata?.release_date || '-';
        const displayVersion = getDisplayVersion(entry);
        const buildCount = entry.versionVariants?.length || 1;
        const engineLabel = getEngineLabel(getEngine(entry));

        // 生成配置描述（芯片数/节点数）
        const configText = getConfigText(entry);
        const workloadText = getWorkloadLabel(getWorkloadId(entry));

        return `
            <tr data-entry-id="${entry.entry_id}" class="${isSparse ? 'is-sparse' : ''}">
                <td>
                    <div class="version-cell">
                        ${showVersion ? `<div class="version-main">${engineLabel} v${displayVersion}<small class="version-date">(${releaseDate})</small></div>` : ''}
                        ${showVersion && buildCount > 1 ? `<small class="version-merge-hint">${t('bestFourth')}</small>` : ''}
                        ${showVersion && isSparse ? `<small class="version-merge-hint sparse">${t('sparseGroup')}</small>` : ''}
                        ${(showVersion && (isLatest || entry.isBaseline))
                            ? `<div class="version-badges">${isLatest ? `<span class="version-badge">${t('latest')}</span>` : ''}${entry.isBaseline ? `<span class="version-badge baseline">${t('baseline')}</span>` : ''}</div>`
                            : ''}
                    </div>
                </td>
                <td class="config-cell">${workloadText}</td>
                <td class="config-cell">${configText}</td>
                <td>${renderMetricCell(m.ttft_ms, trends.ttft_ms, false, false, entry.isBaseline)}</td>
                <td>${renderMetricCell(m.tbt_ms, trends.tbt_ms, false, false, entry.isBaseline)}</td>
                <td>${renderMetricCell(m.throughput_tps, trends.throughput_tps, true, false, entry.isBaseline)}</td>
                <td>${renderMetricCell(m.error_rate, trends.error_rate, false, true, entry.isBaseline)}</td>
                <td class="action-cell">
                    <button class="btn-details" data-entry-id="${entry.entry_id}">
                        ${isExpanded ? t('hide') : (buildCount > 1 ? t('fourthVersion') : t('details'))}
                    </button>
                </td>
            </tr>
        `;
    }

    // 生成配置描述文本
    function getConfigText(entry) {
        if (!entry || !entry.hardware) {
            return t('unknown');
        }

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
    function renderMetricCell(value, trend, higherIsBetter, isPercentage = false, isBaseline = false) {
        const formattedValue = isPercentage ?
            (value * 100).toFixed(1) + '%' :
            formatNumber(value);

        if (isBaseline) {
            return `<div class="metric-cell"><span class="metric-value">${formattedValue}</span></div>`;
        }

        const trendHtml = trend !== undefined && trend !== null ? formatTrendIndicator(trend, higherIsBetter, t('vsPrev')) : '';

        return `
            <div class="metric-cell">
                <span class="metric-value">${formattedValue}</span>
                ${trendHtml}
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
                <td colspan="8" class="details-cell">
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
                <h4>${t('hardwareConfig')}</h4>
                <p><strong>${t('chip')}:</strong> ${hw.chip_model} × ${hw.chip_count}</p>
                <p><strong>${t('totalMemory')}:</strong> ${hw.total_memory_gb} GB</p>
                ${env && env.cuda_version ? `<p><strong>CUDA:</strong> ${env.cuda_version}</p>` : ''}
                ${env && env.cann_version ? `<p><strong>CANN:</strong> ${env.cann_version}</p>` : ''}
                ${cluster ? `
                    <p><strong>${t('cluster')}:</strong> ${cluster.node_count} ${t('nodes')}, ${cluster.interconnect} (${cluster.topology})</p>
                ` : ''}
            </div>
        `;
    }

    function renderVersionsSection(entry) {
        const engine = getEngine(entry);
        const engineLabel = getEngineLabel(engine);
        const engineVersion = getEngineVersion(entry) || 'N/A';
        const versions = entry.versions || {};

        const versionRows = Object.entries(versions)
            .filter(([_, value]) => typeof value === 'string' && value.trim())
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

        return `
            <div class="detail-section">
                <h4>${t('engineVersions')}</h4>
                <p><strong>${t('engine')}:</strong> ${engineLabel}</p>
                <p><strong>${t('engineVersion')}:</strong> ${engineVersion}</p>
                ${versionRows.length ? versionRows.map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`).join('') : ''}
            </div>
        `;
    }

    function renderBuildVariantsSection(entry) {
        const variants = entry.versionVariants || [entry];

        return `
            <div class="detail-section">
                <h4>${t('fullBuildResults')}</h4>
                <p><strong>${t('displayedVersion')}:</strong> v${getDisplayVersion(entry)} ${t('bestFourthInline')}</p>
                <div class="build-variants-table-wrap">
                    <table class="build-variants-table">
                        <thead>
                            <tr>
                                <th>${t('fullVersion')}</th>
                                <th>${t('releaseDate')}</th>
                                <th>TTFT</th>
                                <th>${t('tokensPerSecond')}</th>
                                <th>${t('peakMem')}</th>
                                <th>${t('error')}</th>
                                <th>${t('hitRate')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${variants.map((variant, index) => {
            const vm = variant.metrics || {};
            const selected = variant.entry_id === entry.entry_id ? 'selected' : '';
            return `
                                    <tr class="${selected}">
                                        <td>${getEngineLabel(getEngine(variant))} v${getEngineVersion(variant)}${index === 0 ? ` ${t('selectedStar')}` : ''}</td>
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

    function renderImprovementsSection(entry) {
        const meta = entry.metadata;
        return `
            <div class="detail-section">
                <h4>${t('improvements')}</h4>
                <p>${meta.notes || t('noImprovements')}</p>
                <p><strong>${t('gitCommit')}:</strong> <code>${meta.git_commit}</code></p>
                <p><strong>${t('changelog')}:</strong> <a href="${meta.changelog_url}" target="_blank" style="color: #5a67d8;">${t('view')}</a></p>
            </div>
        `;
    }

    function renderReproduceSection(entry) {
        const cmd = entry.metadata.reproducible_cmd;
        return `
            <div class="detail-section">
                <h4>${t('reproduceThisResult')}</h4>
                <div class="command-block">
                    <button class="btn-copy" data-cmd="${encodeURIComponent(cmd)}">${t('copy')}</button>
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
            btnEl.textContent = t('copiedBang');
            btnEl.classList.add('copied');
            setTimeout(() => {
                btnEl.textContent = t('copy');
                btnEl.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert(t('copyCommandFailed'));
        });
    }

    // Calculate trends between two versions
    function calculateTrends(current, previous) {
        const trends = {};
        const metrics = ['ttft_ms', 'tbt_ms', 'throughput_tps', 'error_rate'];

        metrics.forEach(metric => {
            const curr = current.metrics[metric];
            const prev = previous.metrics[metric];

            if (curr != null && prev != null && prev !== 0) {
                trends[metric] = ((curr - prev) / prev) * 100;
            }
        });

        return trends;
    }

    function createCompareScopeKey(entry) {
        const model = entry?.model?.name || 'unknown-model';
        const hardware = entry?.hardware?.chip_model || 'unknown-hardware';
        const precision = entry?.model?.precision || 'unknown-precision';
        const workload = getWorkloadId(entry) || 'Other';
        const configType = entry?.config_type || state.currentTab || 'unknown-config';
        const chipCount = entry?.hardware?.chip_count || 0;
        const nodeCount = entry?.cluster?.node_count || 1;
        return [model, hardware, precision, workload, configType, chipCount, nodeCount].join('|');
    }

    function buildScopeLabel(entry) {
        const model = entry?.model?.name || 'Unknown model';
        const hardware = entry?.hardware?.chip_model || 'Unknown hardware';
        const workload = getWorkloadLabel(getWorkloadId(entry));
        return `${model} • ${hardware} • ${workload}`;
    }

    function buildCompareGroups(entries) {
        const groups = new Map();

        entries.forEach((entry) => {
            const key = createCompareScopeKey(entry);
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    entries: [],
                    engines: new Set(),
                    summaryLabel: buildScopeLabel(entry),
                });
            }
            const group = groups.get(key);
            group.entries.push(entry);
            group.engines.add(getEngine(entry));
        });

        return Array.from(groups.values()).map((group) => ({
            ...group,
            engineCount: group.engines.size,
            isComplete: group.engines.size >= 2,
        }));
    }

    function selectFocusGroup(groups) {
        if (!groups.length) {
            return null;
        }

        const candidates = groups.some((group) => group.isComplete)
            ? groups.filter((group) => group.isComplete)
            : groups;

        return [...candidates].sort((a, b) => {
            if (b.engineCount !== a.engineCount) {
                return b.engineCount - a.engineCount;
            }
            if (b.entries.length !== a.entries.length) {
                return b.entries.length - a.entries.length;
            }

            const latestA = [...a.entries].sort(compareByReleaseDateDesc)[0];
            const latestB = [...b.entries].sort(compareByReleaseDateDesc)[0];
            return compareByReleaseDateDesc(latestB, latestA);
        })[0] || null;
    }

    function applyComparisonView(entries, viewOptions) {
        const totalGroups = buildCompareGroups(entries);
        let visibleEntries = [...entries];
        let focusGroup = null;

        if (viewOptions.sameScopeOnly) {
            focusGroup = selectFocusGroup(totalGroups);
            visibleEntries = focusGroup ? [...focusGroup.entries] : [];
        }

        let activeGroups = buildCompareGroups(visibleEntries);

        if (viewOptions.hideIncompleteGroups) {
            const completeKeys = new Set(activeGroups.filter((group) => group.isComplete).map((group) => group.key));
            visibleEntries = visibleEntries.filter((entry) => completeKeys.has(createCompareScopeKey(entry)));
            activeGroups = buildCompareGroups(visibleEntries);
        }

        const incompleteKeys = new Set(totalGroups.filter((group) => !group.isComplete).map((group) => group.key));

        return {
            visibleEntries,
            focusGroup,
            incompleteKeys,
            totalIncompleteGroups: totalGroups.filter((group) => !group.isComplete).length,
            hiddenCount: Math.max(entries.length - visibleEntries.length, 0),
            activeCoverage: {
                groupCount: activeGroups.length,
                completeGroupCount: activeGroups.filter((group) => group.isComplete).length,
            },
        };
    }

    function summarizeEngines(entries) {
        const grouped = new Map();

        entries.forEach((entry) => {
            const engine = getEngine(entry);
            if (!grouped.has(engine)) {
                grouped.set(engine, []);
            }
            grouped.get(engine).push(entry);
        });

        return Array.from(grouped.entries())
            .map(([engine, engineEntries]) => {
                const bestEntry = [...engineEntries].sort((a, b) => compareEntryQuality(b, a))[0];
                return {
                    engine,
                    label: getEngineLabel(engine),
                    count: engineEntries.length,
                    avgTTFT: averageMetric(engineEntries, 'ttft_ms'),
                    avgTBT: averageMetric(engineEntries, 'tbt_ms'),
                    avgTPS: averageMetric(engineEntries, 'throughput_tps'),
                    avgError: averageMetric(engineEntries, 'error_rate'),
                    bestEntry,
                    version: getEngineVersion(bestEntry) || getDisplayVersion(bestEntry) || 'N/A',
                };
            })
            .sort((a, b) => (b.avgTPS || 0) - (a.avgTPS || 0));
    }

    function averageMetric(entries, metric) {
        const values = entries
            .map((entry) => Number(entry?.metrics?.[metric]))
            .filter((value) => Number.isFinite(value));

        if (!values.length) {
            return null;
        }

        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function getLeaders(summaries) {
        if (!summaries.length) {
            return { throughput: null, ttft: null, tbt: null };
        }

        return {
            throughput: [...summaries].filter((item) => item.avgTPS != null).sort((a, b) => b.avgTPS - a.avgTPS)[0] || null,
            ttft: [...summaries].filter((item) => item.avgTTFT != null).sort((a, b) => a.avgTTFT - b.avgTTFT)[0] || null,
            tbt: [...summaries].filter((item) => item.avgTBT != null).sort((a, b) => a.avgTBT - b.avgTBT)[0] || null,
        };
    }

    function getOverviewTitle(summaries, leaders, comparisonView) {
        if (summaries.length === 1) {
            return `${summaries[0].label} ${t('onlyEngineView')}`;
        }

        const leader = leaders.throughput;
        const runnerUp = summaries[1];
        if (!leader || !runnerUp || !Number.isFinite(leader.avgTPS) || !Number.isFinite(runnerUp.avgTPS) || runnerUp.avgTPS === 0) {
            return `${t('comparing')} ${summaries.length} ${t('enginesInView')}`;
        }

        const delta = ((leader.avgTPS - runnerUp.avgTPS) / runnerUp.avgTPS) * 100;
        const scopePrefix = comparisonView.focusGroup ? `${t('focusedSlice')} ` : '';
        return `${scopePrefix}${leader.label} ${t('leadsCurrentView')} ${delta.toFixed(1)}% ${t('throughputOver')} ${runnerUp.label}.`;
    }

    function getOverviewSubtitle(entries, engineCount, comparisonView, viewOptions) {
        const models = getUniqueValues(entries, (entry) => entry?.model?.name);
        const hardware = getUniqueValues(entries, (entry) => entry?.hardware?.chip_model);
        const workloads = getUniqueValues(entries, (entry) => getWorkloadId(entry));

        const modelText = models.length === 1 ? models[0] : `${models.length} ${t('models')}`;
        const hardwareText = hardware.length === 1 ? hardware[0] : `${hardware.length} ${t('hardwareTargets')}`;
        const workloadText = workloads.length === 1 ? getWorkloadLabel(workloads[0]) : `${workloads.length} ${t('workloads')}`;
        const scopeText = `${modelText} • ${hardwareText} • ${workloadText}`;

        if (comparisonView.focusGroup) {
            return scopeText;
        }

        if (comparisonView.totalIncompleteGroups > 0 && viewOptions.hideIncompleteGroups) {
            return `${scopeText} • ${comparisonView.totalIncompleteGroups} ${t('sparseGroupsHidden')}`;
        }

        return scopeText;
    }

    function getOverviewBadges(entries, engineCount, leaders, comparisonView) {
        const badges = [`${entries.length} ${t('rows')}`, `${engineCount} ${t('engines')}`];

        if (comparisonView.activeCoverage.completeGroupCount) {
            badges.push(`${comparisonView.activeCoverage.completeGroupCount} ${t('completeCompareGroups')}`);
        }

        if (leaders.throughput) {
            badges.push(`${leaders.throughput.label} ${t('leadsThroughput')}`);
        }

        return badges.slice(0, 4);
    }

    function renderCoverage(comparisonView) {
        const el = document.getElementById('leaderboard-coverage');
        if (!el) {
            return;
        }

        const pills = [];
        pills.push(`<span class="coverage-pill success">${t('completeGroups')}: ${comparisonView.activeCoverage.completeGroupCount}</span>`);

        if (comparisonView.totalIncompleteGroups > 0) {
            pills.push(`<span class="coverage-pill warning">${t('sparseGroups')}: ${comparisonView.totalIncompleteGroups}</span>`);
        }

        if (comparisonView.focusGroup) {
            pills.push(`<span class="coverage-pill">${t('focusedScope')}: ${comparisonView.focusGroup.summaryLabel}</span>`);
        }

        if (comparisonView.hiddenCount > 0) {
            pills.push(`<span class="coverage-pill warning">${t('hiddenRows')}: ${comparisonView.hiddenCount}</span>`);
        }

        el.innerHTML = pills.join('');
    }

    function renderHeadToHead(summaries) {
        if (summaries.length !== 2) {
            return '';
        }

        const [left, right] = summaries;
        const tpsDelta = relativeDelta(left.avgTPS, right.avgTPS, true);
        const ttftDelta = relativeDelta(left.avgTTFT, right.avgTTFT, false);
        const tbtDelta = relativeDelta(left.avgTBT, right.avgTBT, false);

        return `
            <div class="head-to-head">
                <div class="head-to-head-side">
                    <strong>${left.label}</strong>
                    <span>TTFT ${formatNumber(left.avgTTFT)} ms • TBT ${formatNumber(left.avgTBT)} ms • TPS ${formatNumber(left.avgTPS)}</span>
                </div>
                <div class="head-to-head-divider">${t('versusShort')}</div>
                <div class="head-to-head-side">
                    <strong>${right.label}</strong>
                    <span>TTFT ${formatNumber(right.avgTTFT)} ms • TBT ${formatNumber(right.avgTBT)} ms • TPS ${formatNumber(right.avgTPS)}</span>
                </div>
            </div>
            <div class="head-to-head-deltas">
                <div class="head-to-head-delta">${t('throughputGap')}: ${tpsDelta}</div>
                <div class="head-to-head-delta">TTFT ${t('gap')}: ${ttftDelta}</div>
                <div class="head-to-head-delta">TBT ${t('gap')}: ${tbtDelta}</div>
            </div>
        `;
    }

    function findCompareSnapshotGroup(entries, comparisonView) {
        const groups = Array.isArray(state.compareSnapshot?.groups) ? state.compareSnapshot.groups : [];
        if (!groups.length) {
            return null;
        }

        let scopeKey = comparisonView?.focusGroup?.key || null;
        if (!scopeKey) {
            const scopedGroups = buildCompareGroups(entries);
            if (scopedGroups.length === 1) {
                scopeKey = scopedGroups[0].key;
            }
        }
        if (!scopeKey) {
            return null;
        }

        return groups.find((group) => group && group.scope_key === scopeKey) || null;
    }

    function renderHeadToHeadFromSnapshot(group) {
        const pair = group?.preferred_pair;
        if (!pair?.left || !pair?.right) {
            return '';
        }

        const left = pair.left;
        const right = pair.right;
        const throughputDelta = formatSnapshotDelta(pair?.deltas?.throughput_pct_left_vs_right, true);
        const ttftDelta = formatSnapshotDelta(pair?.deltas?.ttft_pct_left_vs_right, false);
        const tbtDelta = formatSnapshotDelta(pair?.deltas?.tbt_pct_left_vs_right, false);

        return `
            <div class="head-to-head">
                <div class="head-to-head-side">
                    <strong>${getEngineLabel(left.engine)}</strong>
                    <span>TTFT ${formatNumber(left.metrics.ttft_ms)} ms • TBT ${formatNumber(left.metrics.tbt_ms)} ms • TPS ${formatNumber(left.metrics.throughput_tps)}</span>
                </div>
                <div class="head-to-head-divider">${t('versusShort')}</div>
                <div class="head-to-head-side">
                    <strong>${getEngineLabel(right.engine)}</strong>
                    <span>TTFT ${formatNumber(right.metrics.ttft_ms)} ms • TBT ${formatNumber(right.metrics.tbt_ms)} ms • TPS ${formatNumber(right.metrics.throughput_tps)}</span>
                </div>
            </div>
            <div class="head-to-head-deltas">
                <div class="head-to-head-delta">${t('throughputGap')}: ${throughputDelta}</div>
                <div class="head-to-head-delta">TTFT ${t('gap')}: ${ttftDelta}</div>
                <div class="head-to-head-delta">TBT ${t('gap')}: ${tbtDelta}</div>
            </div>
        `;
    }

    function formatSnapshotDelta(value, higherIsBetter) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        const absValue = Math.abs(value).toFixed(1);
        if (value === 0) {
            return t('parity');
        }

        const isBetter = higherIsBetter ? value > 0 : value < 0;
        return isBetter ? `${absValue}% ${t('better')}` : `${absValue}% ${t('worse')}`;
    }

    function relativeDelta(left, right, higherIsBetter) {
        if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
            return '-';
        }

        const delta = ((left - right) / Math.abs(right)) * 100;
        const label = delta === 0 ? t('parity') : `${Math.abs(delta).toFixed(1)}%`;

        if (delta === 0) {
            return label;
        }

        const isBetter = higherIsBetter ? delta > 0 : delta < 0;
        return isBetter ? `${label} ${t('better')}` : `${label} ${t('worse')}`;
    }

    function renderEngineSummaryCard(summary, leaders) {
        const bestEntry = summary.bestEntry || {};
        const isLeader = leaders.throughput && leaders.throughput.engine === summary.engine;

        return `
            <div class="engine-summary-card ${isLeader ? 'is-leader' : ''}">
                <div class="engine-summary-head">
                    <span class="engine-chip">${summary.label}</span>
                    ${isLeader ? `<span class="leader-mark">${t('throughputLeader')}</span>` : `<span class="leader-mark">${summary.count} ${summary.count > 1 ? t('rows') : t('row')}</span>`}
                </div>
                <div class="engine-summary-version">${t('bestVisibleVersion')} ${summary.version}</div>
                <div class="engine-summary-metrics">
                    <div class="summary-metric">
                        <span>${t('avgTTFT')}</span>
                        <strong>${formatNumber(summary.avgTTFT)} ms</strong>
                    </div>
                    <div class="summary-metric">
                        <span>${t('avgTBT')}</span>
                        <strong>${formatNumber(summary.avgTBT)} ms</strong>
                    </div>
                    <div class="summary-metric">
                        <span>${t('avgThroughput')}</span>
                        <strong>${formatNumber(summary.avgTPS)} tok/s</strong>
                    </div>
                    <div class="summary-metric">
                        <span>${t('errorRate')}</span>
                        <strong>${formatPercent(summary.avgError)}</strong>
                    </div>
                </div>
                <div class="engine-summary-footer">
                    ${t('bestVisibleRun')}: ${getWorkloadLabel(getWorkloadId(bestEntry))} • ${getConfigText(bestEntry).replace('<br><small>', ' • ').replace('</small>', '')}
                </div>
            </div>
        `;
    }

    function formatNumber(value) {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return '-';
        }

        if (typeof value === 'number') {
            return value.toFixed(1);
        }

        return String(value);
    }

    function formatPercent(value) {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return '-';
        }

        return `${(value * 100).toFixed(1)}%`;
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
