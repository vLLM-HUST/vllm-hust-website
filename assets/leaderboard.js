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
            Other: 'Other',
        },
        zh: {
            all: '全部',
            Other: '其他',
        },
    };

    const ENGINE_LABELS = {
        en: {
            'vllm-hust': 'vllm-hust',
            vllm: 'vLLM',
            'vllm-ascend': 'vLLM Ascend',
            sglang: 'SGLang',
            unknown: 'Unknown',
        },
        zh: {
            'vllm-hust': 'vllm-hust',
            vllm: 'vLLM',
            'vllm-ascend': 'vLLM Ascend',
            sglang: 'SGLang',
            unknown: '未知',
        },
    };

    const DIRTY_ENGINE_VERSION_MARKERS = [
        'path string is null',
    ];
    const ENGINE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

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
            statsSource: 'source',
            quickCompare: 'Quick Compare',
            hardConstraintsTitle: 'Hard Constraints',
            hardConstraintsSubtitle: 'Best current hard-constraint result from benchmark snapshots, with regression vs previous submission.',
            hardConstraintsNoData: 'No hard-constraint records under current filters.',
            hardConstraintsBaselineLabel: 'Performance Baseline',
            hardConstraintsBaselineValue: 'Official Ascend Jan 2026 (vllm v0.11.0 + vllm-ascend v0.11.0)',
            baselineStateOfficial: 'official',
            baselineStatePending: 'pending',
            baselineStateNone: 'not declared',
            pass: 'PASS',
            fail: 'FAIL',
            current: 'Current',
            target: 'Target',
            previous: 'Previous',
            delta: 'Delta',
            scope: 'Scope',
            constraint1: 'C1 Single-chip effective utilization >= 90%',
            constraint2: 'C2 Typical scenes: throughput >= 2x and TTFT/TPOT reduction > 20%',
            constraint3: 'C3 Context >= 32K with stable throughput and stable TTFT/TPOT P95/P99',
            constraint4: 'C4 Single business scenario token cost down >= 30% and high multi-tenant utilization',
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
            releaseDate: 'Result Date',
            ttft: 'TTFT',
            tokensPerSecond: 'Tokens/s',
            peakMem: 'Peak Mem',
            error: 'Error',
            hitRate: 'Hit Rate',
            improvements: '🚀 Improvements',
            noSpecificImprovements: 'No specific improvements noted.',
            noImprovements: 'No specific improvements noted.',
            gitCommit: 'Git Commit',
            githubUser: 'GitHub User',
            provenanceActor: 'Provenance',
            githubPullRequest: 'GitHub PR',
            githubRepository: 'Repository',
            gitReference: 'Git Ref',
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
            goalProgressKicker: 'Goal Gap',
            goalBaselineLabel: 'Official Ascend Jan 2026 baseline',
            goalCurrentLabel: 'Current vllm-hust',
            goalMet: 'Goal met',
            goalGapRemaining: 'Remaining gap',
            goalCompareTitle: 'vllm-hust vs Official Ascend Jan 2026 baseline',
            goalCompareScope: 'Pinned goal scope',
            overviewHeroGoalLabel: 'Official Compare',
            overviewHeroCompareLabel: 'Snapshot Compare',
            overviewGridLabel: 'Visible Aggregate',
            overviewGridNote: 'Cards summarize the currently visible table rows by engine.',
            overviewTableLabel: 'Visible Rows',
            overviewTableNote: 'The main table shows the currently visible benchmark rows after filters, scope toggles, and version merging.',
            overviewGoalSnapshotNote: 'Hero deltas use the matched official compare snapshot. Cards below summarize the currently visible table rows.',
            overviewCompareSnapshotNote: 'Hero deltas use the matched compare snapshot. Cards below summarize the currently visible table rows.',
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
            statsSource: '数据源',
            quickCompare: '快速对比',
            hardConstraintsTitle: '硬约束达成',
            hardConstraintsSubtitle: '展示当前 benchmark 中表现最好的硬约束结果，并和上次提交做回归对比。',
            hardConstraintsNoData: '当前筛选条件下没有硬约束记录。',
            hardConstraintsBaselineLabel: '性能基线',
            hardConstraintsBaselineValue: 'Official Ascend Jan 2026（vllm v0.11.0 + vllm-ascend v0.11.0）',
            baselineStateOfficial: '官方覆盖',
            baselineStatePending: '待补基线',
            baselineStateNone: '未声明',
            pass: '达标',
            fail: '未达标',
            current: '当前',
            target: '目标',
            previous: '上次',
            delta: '变化',
            scope: '范围',
            constraint1: 'C1 单芯片有效算力 >= 90%',
            constraint2: 'C2 典型场景：吞吐 >= 2x 且 TTFT/TPOT 降幅 > 20%',
            constraint3: 'C3 上下文 >= 32K 且吞吐稳定、TTFT/TPOT P95/P99 稳定',
            constraint4: 'C4 单一业务场景单位 token 成本下降 >= 30%，且多租户高利用率',
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
            releaseDate: '结果日期',
            ttft: 'TTFT',
            tokensPerSecond: 'Tokens/s',
            peakMem: '峰值显存',
            error: '错误率',
            hitRate: '命中率',
            improvements: '🚀 改进说明',
            noSpecificImprovements: '没有额外改进说明。',
            noImprovements: '没有额外改进说明。',
            gitCommit: 'Git Commit',
            githubUser: 'GitHub 用户',
            provenanceActor: '来源身份',
            githubPullRequest: 'GitHub PR',
            githubRepository: '仓库',
            gitReference: 'Git 引用',
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
            goalProgressKicker: '目标差距',
            goalBaselineLabel: '官方 Ascend 2026 年 1 月基线',
            goalCurrentLabel: '当前 vllm-hust',
            goalMet: '已达到目标',
            goalGapRemaining: '距离目标',
            goalCompareTitle: 'vllm-hust 对比官方 Ascend 2026 年 1 月基线',
            goalCompareScope: '目标比较范围',
            overviewHeroGoalLabel: '官方对比',
            overviewHeroCompareLabel: '快照对比',
            overviewGridLabel: '当前可见聚合',
            overviewGridNote: '下方卡片按引擎汇总当前主表可见行。',
            overviewTableLabel: '当前可见明细',
            overviewTableNote: '主表展示的是当前筛选、scope 开关和版本合并之后的 benchmark 可见行。',
            overviewGoalSnapshotNote: '顶部 Hero 的差距值来自当前命中的官方 compare snapshot；下方卡片汇总的是当前主表可见行。',
            overviewCompareSnapshotNote: '顶部 Hero 的差距值来自当前命中的 compare snapshot；下方卡片汇总的是当前主表可见行。',
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
            'single-chip': { sameScopeOnly: false, hideIncompleteGroups: false },
            'multi-chip': { sameScopeOnly: false, hideIncompleteGroups: false },
            'multi-node': { sameScopeOnly: false, hideIncompleteGroups: false }
        },
        expandedRows: new Set()
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('vllm-hust:langchange', () => {
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

            state.multiChipData = multiData.filter(entry =>
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
        if (typeof direct === 'string' && direct.trim()) {
            return direct.trim();
        }

        return 'Other';
    }

    function getWorkloadLabel(workloadId) {
        const lang = getCurrentLang();
        return (WORKLOAD_LABELS[lang] && WORKLOAD_LABELS[lang][workloadId]) || workloadId;
    }

    function getEntryTimestamp(entry) {
        const meta = entry?.metadata || {};
        return Date.parse(meta.release_date || meta.submitted_at || '') || 0;
    }

    function compareByReleaseDateDesc(a, b) {
        const aDate = getEntryTimestamp(a);
        const bDate = getEntryTimestamp(b);
        return bDate - aDate;
    }

    function formatDateLabel(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return '';
        }
        const timestamp = Date.parse(raw);
        if (Number.isNaN(timestamp)) {
            return raw;
        }
        return new Date(timestamp).toISOString().slice(0, 10);
    }

    function getEntryDateLabel(entry) {
        const meta = entry?.metadata || {};
        return formatDateLabel(meta.release_date || meta.submitted_at || '');
    }

    function normalizeDisplayVersion(version) {
        const text = String(version || '').trim();
        if (!text) {
            return '';
        }
        const hasLeadingV = /^v/i.test(text);
        const coreText = hasLeadingV ? text.slice(1) : text;
        if (/^\d+\.\d+\.\d+\.\d+$/.test(coreText)) {
            const parts = coreText.split('.');
            const collapsed = `${parts[0]}.${parts[1]}.${parts[2]}.x`;
            return hasLeadingV ? `v${collapsed}` : collapsed;
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
        return (window['vllm-hustCurrentLang'] || document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
    }

    function t(key) {
        const lang = getCurrentLang();
        return (UI_STRINGS[lang] && UI_STRINGS[lang][key]) || UI_STRINGS.en[key] || key;
    }

    function getEntryGitCommit(entry) {
        return String(
            entry?.metadata?.git_commit ||
            entry?.git_commit ||
            entry?.metadata?.runtime_provenance?.engine?.commit ||
            ''
        ).trim();
    }

    function sanitizeEngineVersion(version, gitCommit = '') {
        const raw = String(version || '');
        const sawMultiline = /[\r\n]/.test(raw);
        let sawDirtyMarker = DIRTY_ENGINE_VERSION_MARKERS.some((marker) => raw.toLowerCase().includes(marker));
        const candidates = [];

        raw.split(/\r?\n/).forEach((line) => {
            const normalized = String(line || '').replace(/\s+/g, ' ').trim();
            if (!normalized) {
                return;
            }
            if (DIRTY_ENGINE_VERSION_MARKERS.some((marker) => normalized.toLowerCase().includes(marker))) {
                sawDirtyMarker = true;
                return;
            }
            candidates.push(normalized);
        });

        for (const candidate of candidates) {
            if (/\d/.test(candidate) && ENGINE_VERSION_PATTERN.test(candidate)) {
                return candidate;
            }
        }

        if (candidates.length) {
            const primary = candidates[0];
            if (ENGINE_VERSION_PATTERN.test(primary) && !(sawMultiline || sawDirtyMarker)) {
                return primary;
            }
        }

        const shortCommit = getShortCommit(gitCommit);
        return shortCommit ? `g${shortCommit}` : '';
    }

    function formatVersionText(version) {
        const normalized = String(version || '').trim();
        if (!normalized || normalized.toLowerCase() === 'unknown') {
            return 'N/A';
        }
        if (/^v/i.test(normalized) || /^g[0-9a-f]{7,}$/i.test(normalized)) {
            return normalized;
        }
        return `v${normalized}`;
    }

    function getSnapshotEngineVersion(snapshot) {
        return sanitizeEngineVersion(snapshot?.engine_version || '', snapshot?.git_commit || '');
    }

    function formatSnapshotVersion(snapshot) {
        return formatVersionText(getSnapshotEngineVersion(snapshot));
    }

    function getEngineVersion(entry) {
        return sanitizeEngineVersion(
            entry?.engine_version || entry?.metadata?.engine_version || '',
            getEntryGitCommit(entry)
        );
    }

    function getDisplayVersion(entry) {
        const explicit = sanitizeEngineVersion(entry?.displayVersion || '', getEntryGitCommit(entry));
        return normalizeDisplayVersion(explicit || getEngineVersion(entry));
    }

    function formatEntryVersion(entry, { display = false } = {}) {
        return formatVersionText(display ? getDisplayVersion(entry) : getEngineVersion(entry));
    }

    function hasVersionValue(value) {
        const normalized = String(value || '').trim();
        return normalized && normalized.toLowerCase() !== 'n/a' && normalized.toLowerCase() !== 'unknown';
    }

    function isCommitLikeValue(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return false;
        }

        const candidate = normalized.replace(/^[vg]/i, '');
        return /[a-f]/i.test(candidate) && /^[0-9a-f]{7,40}$/i.test(candidate);
    }

    function hasRenderablePackageVersion(value) {
        return hasVersionValue(value) && !isCommitLikeValue(value);
    }

    function extractCommitFromVersion(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return '';
        }
        const match = normalized.match(/(?:^|[.+-])g([0-9a-f]{7,40})(?:\.d\d{8})?$/i);
        return match ? match[1] : '';
    }

    function normalizePackageVersion(value) {
        const normalized = String(value || '').trim();
        if (!hasRenderablePackageVersion(normalized)) {
            return '';
        }

        const withoutLeadingV = normalized.replace(/^v/i, '');
        const cleaned = withoutLeadingV
            .replace(/-\d+-g[0-9a-f]{7,40}$/i, '')
            .replace(/\+g[0-9a-f]{7,40}(?:\.d\d{8})?$/i, '')
            .replace(/\.g[0-9a-f]{7,40}(?:\.d\d{8})?$/i, '')
            .replace(/\.dev\d+\b/i, '')
            .replace(/(?:[.+-])d\d{8}$/i, '');

        return isCommitLikeValue(cleaned) ? '' : cleaned;
    }

    function formatComponentVersion(version, commit, { includeCommit = true } = {}) {
        const normalizedVersion = normalizePackageVersion(version);
        if (!normalizedVersion) {
            return '';
        }

        const shortCommit = getShortCommit(commit || extractCommitFromVersion(version));
        return includeCommit && shortCommit ? `v${normalizedVersion}.${shortCommit}` : `v${normalizedVersion}`;
    }

    function getVersionLabelTone(label) {
        if (label === 'vllm-hust') {
            return 'hust';
        }
        if (label === 'vllm-ascend-hust' || label === 'vllm-ascend') {
            return 'plugin';
        }
        if (label === 'vllm') {
            return 'upstream';
        }
        return 'default';
    }

    function renderAlignedVersionRow(component) {
        const tone = getVersionLabelTone(component.label);
        return `
            <span class="version-aligned-row">
                <span class="version-engine-label version-engine-label--${tone}">${component.label}</span>
                <span class="version-engine-value">${component.version}</span>
            </span>
        `;
    }

    function buildTableVersionComponents(entry) {
        const metadata = entry?.metadata || {};
        const runtime = metadata.runtime_provenance || {};
        const versions = entry?.versions || {};
        const githubRepository = String(metadata.github_repository || '').trim().toLowerCase();
        const engineRepository = String(runtime?.engine?.repository || '').trim().toLowerCase();
        const pluginRepository = String(runtime?.plugin?.repository || '').trim().toLowerCase();
        const pluginEngine = String(runtime?.plugin?.engine || '').trim().toLowerCase();
        const dataSource = String(metadata.data_source || '').trim().toLowerCase();
        const engineName = getEngine(entry);
        const engineVersion = entry?.engine_version || metadata.engine_version || '';
        const components = [];

        const hasHustEngineRepository = engineRepository.includes('vllm-hust')
            || githubRepository.endsWith('/vllm-hust');
        const hasHustPluginRepository = pluginEngine === 'vllm-ascend-hust'
            || pluginRepository.includes('vllm-ascend-hust')
            || githubRepository.includes('vllm-ascend-hust');
        const canUseEngineVersionForHust = hasHustEngineRepository
            || (engineName === 'vllm-hust' && !hasHustPluginRepository);
        const canUseEngineVersionForPlugin = engineName === 'vllm-ascend-hust'
            || (hasHustPluginRepository && !hasHustEngineRepository);

        const hustVersion = hasRenderablePackageVersion(versions.core)
            ? versions.core
            : (canUseEngineVersionForHust ? engineVersion : '');
        const hustCommit = runtime?.engine?.commit
            || (canUseEngineVersionForHust ? getEntryGitCommit(entry) : '')
            || extractCommitFromVersion(versions.core)
            || extractCommitFromVersion(engineVersion);

        const hustDisplayVersion = formatComponentVersion(hustVersion, hustCommit, { includeCommit: false });
        if (hustDisplayVersion) {
            components.push({
                label: 'vllm-hust',
                version: hustDisplayVersion,
            });
        }

        const ascendHustVersion = hasRenderablePackageVersion(versions.backend)
            ? versions.backend
            : (canUseEngineVersionForPlugin ? engineVersion : '');
        const ascendHustCommit = runtime?.plugin?.commit
            || (canUseEngineVersionForPlugin ? getEntryGitCommit(entry) : '')
            || extractCommitFromVersion(versions.backend)
            || extractCommitFromVersion(engineVersion);

        const ascendHustDisplayVersion = formatComponentVersion(ascendHustVersion, ascendHustCommit, { includeCommit: false });
        if (ascendHustDisplayVersion) {
            components.push({
                label: 'vllm-ascend-hust',
                version: ascendHustDisplayVersion,
            });
        }

        if (components.length) {
            return components;
        }

        const isOfficialAscendStack = engineName === 'vllm'
            && (
                githubRepository.includes('vllm-ascend')
                || pluginRepository.includes('vllm-ascend')
                || dataSource.includes('vllm-ascend')
            );
        const officialVersion = formatComponentVersion(engineVersion || metadata.github_ref || '', '', { includeCommit: false });
        if (officialVersion) {
            components.push({
                label: engineName === 'vllm' ? 'vllm' : getEngineLabel(engineName),
                version: officialVersion,
            });
            if (isOfficialAscendStack) {
                components.push({
                    label: 'vllm-ascend',
                    version: officialVersion,
                });
            }
        }

        return components;
    }

    function formatTableVersionSummary(entry, dateLabel = '') {
        const components = buildTableVersionComponents(entry).filter((component) => component?.label && component?.version);
        if (!components.length) {
            return '';
        }

        const rows = components.map((component) => renderAlignedVersionRow(component)).join('');
        const dateLine = dateLabel ? `<small class="version-date version-date--aligned">${dateLabel}</small>` : '';
        return `${rows}${dateLine}`;
    }

    function getSameSpecPayload(entry) {
        return entry?.same_spec && typeof entry.same_spec === 'object' ? entry.same_spec : {};
    }

    function getSettingSignature(entry) {
        const sameSpec = getSameSpecPayload(entry);
        const sameSpecHash = String(sameSpec?.resolved_spec_hash || '').trim();
        if (sameSpecHash) {
            return sameSpecHash;
        }

        const workload = entry?.workload || {};
        const server = sameSpec?.resolved_server_parameters || {};
        const client = sameSpec?.resolved_client_parameters || {};
        return [
            workload?.input_length ?? 'unknown-input',
            workload?.output_length ?? 'unknown-output',
            server?.tensor_parallel_size ?? 'unknown-tp',
            server?.pipeline_parallel_size ?? 'unknown-pp',
            server?.dtype || 'unknown-dtype',
            client?.request_rate ?? 'unknown-rps',
        ].join('|');
    }

    function getCompactSpecLabel(specId) {
        const normalized = String(specId || '').trim();
        if (!normalized) {
            return '';
        }
        if (normalized.startsWith('official-ascend-jan-2026')) {
            return 'official spec';
        }
        return normalized.length > 32 ? `spec ${normalized.slice(0, 29)}...` : `spec ${normalized}`;
    }

    function formatSettingDtype(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return '';
        }
        const lower = normalized.toLowerCase();
        if (lower === 'float16') {
            return 'FP16';
        }
        if (lower === 'bfloat16') {
            return 'BF16';
        }
        return normalized;
    }

    function getSettingSummary(entry) {
        const sameSpec = getSameSpecPayload(entry);
        const workload = entry?.workload || {};
        const server = sameSpec?.resolved_server_parameters || {};
        const client = sameSpec?.resolved_client_parameters || {};
        const parts = [];

        if (workload?.input_length != null || workload?.output_length != null) {
            parts.push(`IO ${workload?.input_length ?? '?'}/${workload?.output_length ?? '?'}`);
        }

        const parallel = [];
        if (server?.tensor_parallel_size != null) {
            parallel.push(`TP${server.tensor_parallel_size}`);
        }
        if (server?.pipeline_parallel_size != null) {
            parallel.push(`PP${server.pipeline_parallel_size}`);
        }
        if (parallel.length) {
            parts.push(parallel.join(' '));
        }

        const dtype = formatSettingDtype(server?.dtype);
        if (dtype) {
            parts.push(dtype);
        }
        if (client?.request_rate != null) {
            parts.push(`RPS ${client.request_rate}`);
        }
        if (workload?.batch_size != null) {
            parts.push(`BS ${workload.batch_size}`);
        }
        if (workload?.concurrent_requests != null) {
            parts.push(`CC ${workload.concurrent_requests}`);
        }
        const specLabel = getCompactSpecLabel(sameSpec?.spec_id);
        if (specLabel) {
            parts.push(specLabel);
        }

        if (parts.length) {
            return parts.join(' • ');
        }
        return entry?.setting_summary || 'default settings';
    }

    function normalizeScopeModelName(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return 'unknown-model';
        }
        if (!raw.includes('/')) {
            return raw;
        }
        return raw.split('/').pop() || raw;
    }

    function buildComparableScopeFromEntry(entry) {
        return {
            model: entry?.model?.name || 'unknown-model',
            modelNormalized: normalizeScopeModelName(entry?.model?.name),
            hardware: entry?.hardware?.chip_model || 'unknown-hardware',
            precision: entry?.model?.precision || 'unknown-precision',
            workload: getWorkloadId(entry) || 'Other',
            configType: entry?.config_type || state.currentTab || 'unknown-config',
            chipCount: Number(entry?.hardware?.chip_count || 0),
            nodeCount: Number(entry?.cluster?.node_count || 1),
            settingSignature: getSettingSignature(entry),
        };
    }

    function extractSnapshotSettingSignature(snapshotPayload) {
        const explicitScopeSignature = typeof snapshotPayload?.scope?.setting_signature === 'string'
            ? snapshotPayload.scope.setting_signature.trim()
            : '';
        if (explicitScopeSignature) {
            return explicitScopeSignature;
        }

        const candidatePaths = [
            snapshotPayload?.current,
            snapshotPayload?.baseline,
            snapshotPayload?.preferred_pair?.left,
            snapshotPayload?.preferred_pair?.right,
        ];

        for (const candidate of candidatePaths) {
            const sameSpecHash = String(candidate?.same_spec?.resolved_spec_hash || '').trim();
            if (sameSpecHash) {
                return sameSpecHash;
            }
        }

        return '';
    }

    function buildComparableScopeFromSnapshot(snapshotPayload) {
        const scope = snapshotPayload?.scope || {};
        return {
            model: scope?.model || 'unknown-model',
            modelNormalized: normalizeScopeModelName(scope?.model),
            hardware: scope?.hardware || 'unknown-hardware',
            precision: scope?.precision || 'unknown-precision',
            workload: scope?.workload || 'Other',
            configType: scope?.config_type || 'unknown-config',
            chipCount: Number(scope?.chip_count || 0),
            nodeCount: Number(scope?.node_count || 1),
            settingSignature: extractSnapshotSettingSignature(snapshotPayload),
        };
    }

    function scopeDescriptorsMatch(left, right) {
        if (!left || !right) {
            return false;
        }

        const modelMatches = left.model === right.model
            || left.modelNormalized === right.modelNormalized;
        if (!modelMatches) {
            return false;
        }

        if (left.hardware !== right.hardware
            || left.precision !== right.precision
            || left.workload !== right.workload
            || left.configType !== right.configType
            || left.chipCount !== right.chipCount
            || left.nodeCount !== right.nodeCount) {
            return false;
        }

        if (left.settingSignature && right.settingSignature) {
            return left.settingSignature === right.settingSignature;
        }

        return true;
    }

    function snapshotScopeMatchesEntries(snapshotPayload, entries) {
        if (!snapshotPayload || !Array.isArray(entries) || !entries.length) {
            return false;
        }

        const snapshotDescriptor = buildComparableScopeFromSnapshot(snapshotPayload);
        return entries.some((entry) => scopeDescriptorsMatch(snapshotDescriptor, buildComparableScopeFromEntry(entry)));
    }

    function formatGithubUserText(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return '';
        }
        return normalized.startsWith('@') ? normalized : `@${normalized}`;
    }

    function getShortCommit(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return '';
        }
        return normalized.replace(/^g/, '').slice(0, 8);
    }

    function renderExternalLink(url, label, className = 'meta-link') {
        if (!url || !label) {
            return '';
        }
        return `<a class="${className}" href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
    }

    function isGenericSubmitter(value) {
        const normalized = String(value || '').trim().toLowerCase();
        return !normalized || ['hust', 'same-spec-current', 'official-ascend-baseline'].includes(normalized);
    }

    function getProvenanceActor(meta) {
        const githubUser = formatGithubUserText(meta?.github_user);
        if (githubUser) {
            return { label: githubUser, className: 'provenance-user' };
        }

        const repository = String(meta?.github_repository || '').trim();
        const ref = String(meta?.github_ref || '').trim();
        if (repository && ref) {
            return { label: `${repository}@${ref}`, className: 'provenance-repo' };
        }
        if (repository) {
            return { label: repository, className: 'provenance-repo' };
        }

        const dataSource = String(meta?.data_source || '').trim();
        if (dataSource) {
            return { label: dataSource, className: 'provenance-source' };
        }

        const submitter = String(meta?.submitter || '').trim();
        if (!isGenericSubmitter(submitter)) {
            return { label: submitter, className: 'provenance-submitter' };
        }

        return null;
    }

    function renderProvenanceSummary(entry) {
        const meta = entry?.metadata || {};
        const parts = [];
        const actor = getProvenanceActor(meta);
        const shortCommit = getShortCommit(meta.git_commit);

        if (actor) {
            parts.push(`<span class="${actor.className}">${actor.label}</span>`);
        }
        if (shortCommit) {
            const commitLabel = `<span class="provenance-commit">${shortCommit}</span>`;
            parts.push(
                meta.github_commit_url
                    ? renderExternalLink(meta.github_commit_url, commitLabel, 'provenance-link')
                    : commitLabel
            );
        }

        if (!parts.length) {
            return '';
        }
        return `<small class="version-provenance">${parts.join('<span class="provenance-separator">·</span>')}</small>`;
    }

    function isNumericVersion(version) {
        return /^v?\d+(\.\d+){1,3}(\.x)?$/i.test(String(version || '').trim());
    }

    function compareDisplayVersions(a, b) {
        const normalizedA = String(a || '').trim().replace(/^v/i, '').replace(/\.x$/, '.0');
        const normalizedB = String(b || '').trim().replace(/^v/i, '').replace(/\.x$/, '.0');

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
        const settingSignature = getSettingSignature(entry);

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
            settingSignature,
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
                state.filters[tab] = {
                    engine: 'all',
                    hardware: 'all',
                    model: 'all',
                    version: 'all',
                    workload: 'all',
                    precision: 'all'
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
        const dynamicWorkloads = getUniqueValues(data, d => getWorkloadId(d)).sort((a, b) => a.localeCompare(b));
        const workloadOptions = ['all', ...dynamicWorkloads];
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

        renderHardConstraints(visibleEntries, comparisonView);
        renderCoverage(comparisonView);
        renderTableSectionHint();

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
            const showVersionForEveryRow = typeof window !== 'undefined'
                && new URLSearchParams(window.location.search).get('showVersionAll') === '1';
            const showVersion = showVersionForEveryRow || index === 0 || currentVersion !== prevVersion;
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
        const source = window.HFDataLoader && window.HFDataLoader.getLastLoadedSource
            ? window.HFDataLoader.getLastLoadedSource()
            : 'local';
        const sourceText = source ? ` • ${t('statsSource')}: ${source}` : '';
        statsEl.textContent = `${t('statsLoaded')} ${state.totalLoadedEntries} • ${state.currentTab}: ${tabTotal} • ${t('statsMatched')} ${rawFilteredTotal} ${t('statsBuildEntries')} • ${t('statsShowing')} ${mergedTotal} ${t('statsComparisonRows')} ${comparisonView.activeCoverage.completeGroupCount} ${t('statsCompleteGroups')}${hiddenText}${sourceText}`;
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
            el.firstElementChild?.remove();
            return;
        }

        const summaries = summarizeEngines(entries);
        const leaders = getLeaders(summaries);
        const goalPair = findGoalProgressPair(entries, comparisonView);
        const title = goalPair
            ? getGoalProgressTitle(goalPair)
            : getOverviewTitle(summaries, leaders, comparisonView);
        const subtitle = goalPair
            ? getGoalProgressSubtitle(goalPair)
            : getOverviewSubtitle(entries, summaries.length, comparisonView, viewOptions);
        const compareSnapshotGroup = findCompareSnapshotGroup(entries, comparisonView);
        const badges = getOverviewBadges(entries, summaries.length, leaders, comparisonView);
        const heroSectionLabel = getOverviewHeroSectionLabel(goalPair, compareSnapshotGroup);
        const headToHeadHtml = goalPair
            ? renderGoalProgressPair(goalPair)
            : compareSnapshotGroup
                ? renderHeadToHeadFromSnapshot(compareSnapshotGroup)
                : renderHeadToHead(summaries);
        const kicker = goalPair ? t('goalProgressKicker') : t('quickCompare');

        el.innerHTML = `
            <div class="overview-section">
                <div class="overview-section-label">${heroSectionLabel}</div>
                <div class="overview-hero">
                    <div class="overview-kicker">${kicker}</div>
                    <div class="overview-title">${title}</div>
                    <div class="overview-subtitle">${subtitle}</div>
                    <div class="overview-badges">
                        ${badges.map((badge) => `<div class="overview-badge">${badge}</div>`).join('')}
                    </div>
                    ${headToHeadHtml}
                </div>
            </div>
            <div class="overview-section">
                <div class="overview-section-label">${t('overviewGridLabel')}</div>
                <div class="overview-section-note">${t('overviewGridNote')}</div>
                <div class="overview-grid">
                    ${summaries.map((summary) => renderEngineSummaryCard(summary, leaders)).join('')}
                </div>
            </div>
        `;
        el.firstElementChild?.remove();

    }

    function normalizeBaselineEngine(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getAccountableBaselineInfo(accountableScope) {
        const accountable = accountableScope || {};
        const officialEngine = normalizeBaselineEngine(accountable.baseline_engine);
        const declaredEngine = normalizeBaselineEngine(
            accountable.declared_baseline_engine || officialEngine
        );
        let status = String(accountable.baseline_status || '').trim();

        if (!status) {
            if (officialEngine) {
                status = 'official-covered';
            } else if (declaredEngine) {
                status = 'pending-baseline';
            } else {
                status = 'no-baseline-declared';
            }
        }

        return {
            officialEngine: status === 'official-covered' ? (officialEngine || declaredEngine) : '',
            declaredEngine,
            status,
            scopeEngine: declaredEngine || officialEngine || 'unknown-baseline',
        };
    }

    function formatAccountableBaseline(accountableScope) {
        const baselineInfo = getAccountableBaselineInfo(accountableScope);
        const engineValue = baselineInfo.declaredEngine || baselineInfo.officialEngine;
        if (!engineValue) {
            return '-';
        }

        const engineLabel = getEngineLabel(engineValue);
        if (baselineInfo.status === 'official-covered') {
            return `${engineLabel} (${t('baselineStateOfficial')})`;
        }
        if (baselineInfo.status === 'pending-baseline') {
            return `${engineLabel} (${t('baselineStatePending')})`;
        }
        return `${engineLabel} (${t('baselineStateNone')})`;
    }

    function buildHardConstraintScopeKey(entry) {
        const accountable = entry?.constraints?.accountable_scope || {};
        const representativeBusinessScenario = accountable.representative_business_scenario || 'unknown-business-scenario';
        const baselineEngine = getAccountableBaselineInfo(accountable).scopeEngine;
        const model = entry?.model?.name || 'unknown-model';
        const hardware = entry?.hardware?.chip_model || 'unknown-hardware';
        const workload = getWorkloadId(entry) || 'Other';
        const configType = entry?.config_type || 'unknown-config';
        return [
            getEngine(entry),
            model,
            hardware,
            workload,
            configType,
            representativeBusinessScenario,
            baselineEngine,
        ].join('|');
    }

    function isHardConstraintTrackedEngine(value) {
        return String(value || '').trim().toLowerCase() === 'vllm-hust';
    }

    function formatSignedDelta(value, suffix = '') {
        if (!Number.isFinite(value)) {
            return '-';
        }
        const prefix = value > 0 ? '+' : '';
        return `${prefix}${value.toFixed(2)}${suffix}`;
    }

    function formatBoolean(value) {
        if (value === true) {
            return t('pass');
        }
        if (value === false) {
            return t('fail');
        }
        return '-';
    }

    function buildHardConstraintCheckItems(scope) {
        const latest = scope?.latest || {};
        const evaluation = latest?.evaluation || {};
        const checks = evaluation?.checks || {};
        const metrics = evaluation?.metrics || {};
        const deltas = scope?.metric_deltas || {};

        const c1Current = Number.isFinite(metrics.single_chip_effective_utilization_pct)
            ? `${metrics.single_chip_effective_utilization_pct.toFixed(2)}%`
            : '-';
        const c2Current = [
            Number.isFinite(metrics.typical_throughput_ratio_vs_baseline)
                ? `TPS x${metrics.typical_throughput_ratio_vs_baseline.toFixed(2)}`
                : 'TPS x-',
            Number.isFinite(metrics.typical_ttft_reduction_pct_vs_baseline)
                ? `TTFT ${metrics.typical_ttft_reduction_pct_vs_baseline.toFixed(2)}%`
                : 'TTFT -',
            Number.isFinite(metrics.typical_tpot_reduction_pct_vs_baseline)
                ? `TPOT ${metrics.typical_tpot_reduction_pct_vs_baseline.toFixed(2)}%`
                : 'TPOT -',
        ].join(' · ');
        const c3Current = [
            Number.isFinite(metrics.long_context_length)
                ? `CTX ${Math.round(metrics.long_context_length)}`
                : 'CTX -',
            `THR ${formatBoolean(metrics.long_context_throughput_stable)}`,
            `TTFT P95 ${formatBoolean(metrics.long_context_ttft_p95_stable)}`,
            `TTFT P99 ${formatBoolean(metrics.long_context_ttft_p99_stable)}`,
            `TPOT P95 ${formatBoolean(metrics.long_context_tpot_p95_stable)}`,
            `TPOT P99 ${formatBoolean(metrics.long_context_tpot_p99_stable)}`,
        ].join(' · ');
        const c4Current = [
            Number.isFinite(metrics.unit_token_cost_reduction_pct)
                ? `Cost ${metrics.unit_token_cost_reduction_pct.toFixed(2)}%`
                : 'Cost -',
            `Tenant ${formatBoolean(metrics.multi_tenant_high_utilization)}`,
        ].join(' · ');

        return [
            {
                code: 'C1',
                label: t('constraint1'),
                passed: checks.effective_utilization_ge_90,
                currentValue: c1Current,
                targetValue: '>= 90%',
                deltaValue: formatSignedDelta(deltas.single_chip_effective_utilization_pct, ' pp'),
            },
            {
                code: 'C2',
                label: t('constraint2'),
                passed: checks.typical_scene_ge_2x_and_ttft_tpot_reduction_gt_20,
                currentValue: c2Current,
                targetValue: 'TPS >= 2x, TTFT > 20%, TPOT > 20%',
                deltaValue: [
                    `TPS ${formatSignedDelta(deltas.typical_throughput_ratio_vs_baseline)}`,
                    `TTFT ${formatSignedDelta(deltas.typical_ttft_reduction_pct_vs_baseline, ' pp')}`,
                    `TPOT ${formatSignedDelta(deltas.typical_tpot_reduction_pct_vs_baseline, ' pp')}`,
                ].join(' · '),
            },
            {
                code: 'C3',
                label: t('constraint3'),
                passed: checks.long_context_ge_32k_and_p95_p99_stable,
                currentValue: c3Current,
                targetValue: 'CTX >= 32K + stability checks',
                deltaValue: '-',
            },
            {
                code: 'C4',
                label: t('constraint4'),
                passed: checks.single_business_cost_down_ge_30_and_multi_tenant_high_utilization,
                currentValue: c4Current,
                targetValue: 'Cost >= 30% + high tenant utilization',
                deltaValue: `Cost ${formatSignedDelta(deltas.unit_token_cost_reduction_pct, ' pp')}`,
            },
        ];
    }

    function countPassedHardConstraintChecks(scope) {
        const checks = scope?.latest?.evaluation?.checks || {};
        return Object.values(checks).filter((value) => value === true).length;
    }

    function countKnownHardConstraintSignals(scope) {
        const metrics = scope?.latest?.evaluation?.metrics || {};
        const numericSignals = [
            metrics.single_chip_effective_utilization_pct,
            metrics.typical_throughput_ratio_vs_baseline,
            metrics.typical_ttft_reduction_pct_vs_baseline,
            metrics.typical_tpot_reduction_pct_vs_baseline,
            metrics.long_context_length,
            metrics.unit_token_cost_reduction_pct,
        ].filter((value) => Number.isFinite(value)).length;
        const booleanSignals = [
            metrics.long_context_throughput_stable,
            metrics.long_context_ttft_p95_stable,
            metrics.long_context_ttft_p99_stable,
            metrics.long_context_tpot_p95_stable,
            metrics.long_context_tpot_p99_stable,
            metrics.multi_tenant_high_utilization,
        ].filter((value) => value === true || value === false).length;
        return numericSignals + booleanSignals;
    }

    function buildHardConstraintScopeSortKey(scope) {
        const metrics = scope?.latest?.evaluation?.metrics || {};
        const stabilityScore = [
            metrics.long_context_throughput_stable,
            metrics.long_context_ttft_p95_stable,
            metrics.long_context_ttft_p99_stable,
            metrics.long_context_tpot_p95_stable,
            metrics.long_context_tpot_p99_stable,
        ].filter((value) => value === true).length;
        const submittedAt = Date.parse(scope?.latest?.submitted_at || '') || 0;
        return [
            Number(Boolean(scope?.overall_pass)),
            countPassedHardConstraintChecks(scope),
            countKnownHardConstraintSignals(scope),
            Number.isFinite(metrics.typical_throughput_ratio_vs_baseline) ? metrics.typical_throughput_ratio_vs_baseline : -1,
            Number.isFinite(metrics.typical_ttft_reduction_pct_vs_baseline) ? metrics.typical_ttft_reduction_pct_vs_baseline : -1,
            Number.isFinite(metrics.typical_tpot_reduction_pct_vs_baseline) ? metrics.typical_tpot_reduction_pct_vs_baseline : -1,
            Number.isFinite(metrics.single_chip_effective_utilization_pct) ? metrics.single_chip_effective_utilization_pct : -1,
            Number.isFinite(metrics.unit_token_cost_reduction_pct) ? metrics.unit_token_cost_reduction_pct : -1,
            Number.isFinite(metrics.long_context_length) ? metrics.long_context_length : -1,
            stabilityScore,
            Number(metrics.multi_tenant_high_utilization === true),
            submittedAt,
        ];
    }

    function compareHardConstraintScopes(left, right) {
        const leftRank = Number(left?.selection_rank);
        const rightRank = Number(right?.selection_rank);
        if (Number.isFinite(leftRank) && Number.isFinite(rightRank) && leftRank !== rightRank) {
            return leftRank - rightRank;
        }

        const leftKey = buildHardConstraintScopeSortKey(left);
        const rightKey = buildHardConstraintScopeSortKey(right);
        const length = Math.max(leftKey.length, rightKey.length);
        for (let index = 0; index < length; index += 1) {
            const delta = (rightKey[index] || 0) - (leftKey[index] || 0);
            if (delta !== 0) {
                return delta;
            }
        }
        return String(left?.scope_key || '').localeCompare(String(right?.scope_key || ''));
    }

    function selectBestHardConstraintScope(scopes) {
        if (!Array.isArray(scopes) || !scopes.length) {
            return null;
        }

        return [...scopes].sort(compareHardConstraintScopes)[0] || null;
    }

    function getHardConstraintConfigTypesForCurrentTab() {
        if (state.currentTab === 'single-chip') {
            return new Set(['single_gpu']);
        }
        if (state.currentTab === 'multi-chip') {
            return new Set(['multi_gpu']);
        }
        if (state.currentTab === 'multi-node') {
            return new Set(['multi_node']);
        }
        return new Set();
    }

    function renderHardConstraints(entries, comparisonView) {
        const el = document.getElementById('leaderboard-hard-constraints');
        if (!el) {
            return;
        }

        const snapshot = state.compareSnapshot?.hard_constraints;
        const scopes = Array.isArray(snapshot?.scopes) ? snapshot.scopes : [];
        if (!scopes.length) {
            el.innerHTML = `
                <div class="hard-constraints-empty">${t('hardConstraintsNoData')}</div>
            `;
            return;
        }

        const validConfigTypes = getHardConstraintConfigTypesForCurrentTab();
        const sourceEntries = getDataByTab(state.currentTab).filter(
            (entry) => isHardConstraintTrackedEngine(getEngine(entry))
        );
        const scopeKeys = new Set(
            sourceEntries
                .map((entry) => buildHardConstraintScopeKey(entry))
        );
        const filteredScopes = scopes
            .filter((scope) => isHardConstraintTrackedEngine(scope?.latest?.engine || scope?.scope?.engine))
            .filter((scope) => {
                if (!validConfigTypes.size) {
                    return true;
                }
                return validConfigTypes.has(String(scope?.scope?.config_type || 'unknown-config'));
            })
            .filter((scope) => scopeKeys.has(scope.scope_key))
            .sort(compareHardConstraintScopes);

        const bestScope = selectBestHardConstraintScope(filteredScopes);
        const displayedScopes = bestScope ? [bestScope] : [];

        if (!displayedScopes.length) {
            el.innerHTML = `
                <div class="hard-constraints-empty">${t('hardConstraintsNoData')}</div>
            `;
            return;
        }

        const passCount = displayedScopes.filter((scope) => scope?.overall_pass).length;
        const failCount = Math.max(displayedScopes.length - passCount, 0);

        el.innerHTML = `
            <div class="hard-constraints-header">
                <div>
                    <h3>${t('hardConstraintsTitle')}</h3>
                    <p>${t('hardConstraintsSubtitle')}</p>
                </div>
                <div class="hard-constraints-summary">
                    <span class="hc-badge pass">${t('pass')}: ${passCount}</span>
                    <span class="hc-badge fail">${t('fail')}: ${failCount}</span>
                </div>
            </div>
            <div class="hard-constraints-baseline">
                <div class="hard-constraints-baseline-label">${t('hardConstraintsBaselineLabel')}</div>
                <div class="hard-constraints-baseline-value">${t('hardConstraintsBaselineValue')}</div>
            </div>
            <div class="hard-constraints-grid">
                ${displayedScopes.map((scope) => renderHardConstraintScopeCard(scope)).join('')}
            </div>
        `;
    }

    function renderHardConstraintScopeCard(scope) {
        const latest = scope?.latest || {};
        const previous = scope?.previous || {};
        const accountable = latest?.accountable_scope || scope?.scope?.accountable_scope || {};
        const checkItems = buildHardConstraintCheckItems(scope);
        const passedCount = checkItems.filter((item) => item.passed === true).length;
        const failedItems = checkItems.filter((item) => item.passed === false);
        const statusClass = scope?.overall_pass ? 'pass' : 'fail';
        const summaryBadges = failedItems.length
            ? failedItems.map((item) => `<span class="hc-check-badge fail">${item.code}</span>`).join('')
            : `<span class="hc-check-badge pass">4/4</span>`;

        return `
            <details class="hard-constraint-card ${statusClass}">
                <summary class="hard-constraint-summary">
                    <div class="hard-constraint-summary-main">
                        <div class="hard-constraint-card-head">
                            <strong>${getEngineLabel(latest?.engine || scope?.scope?.engine || 'unknown')}</strong>
                            <span class="hc-status ${statusClass}">${scope?.overall_pass ? t('pass') : t('fail')}</span>
                        </div>
                        <p class="hard-constraint-scope">
                            ${t('scope')}: ${scope?.scope?.model || '-'} • ${scope?.scope?.hardware || '-'} • ${scope?.scope?.workload || '-'}
                        </p>
                        <p class="hard-constraint-scope-meta">
                            scenario=${accountable?.representative_business_scenario || '-'} · baseline=${formatAccountableBaseline(accountable)} · ${passedCount}/4
                        </p>
                    </div>
                    <div class="hard-constraint-summary-side">
                        <div class="hard-constraint-badges">${summaryBadges}</div>
                        <span class="hard-constraint-toggle"></span>
                    </div>
                </summary>
                <div class="hard-constraint-details">
                    <div class="hard-constraint-rows">
                        ${checkItems.map((item) => renderHardConstraintRow(item.label, item.passed, item.currentValue, item.targetValue, item.deltaValue)).join('')}
                    </div>
                    <p class="hard-constraint-commit">${t('current')}: ${latest?.git_commit || latest?.entry_id || '-'} · ${t('previous')}: ${previous?.git_commit || previous?.entry_id || '-'}</p>
                </div>
            </details>
        `;
    }

    function renderHardConstraintRow(label, passed, currentValue, targetValue, deltaValue) {
        const statusClass = passed ? 'pass' : 'fail';
        return `
            <div class="hard-constraint-row">
                <div class="hc-row-title">${label}</div>
                <div class="hc-row-meta">
                    <span>${t('current')}: ${currentValue}</span>
                    <span>${t('target')}: ${targetValue}</span>
                    <span>${t('delta')}: ${deltaValue}</span>
                    <span class="hc-row-status ${statusClass}">${passed ? t('pass') : t('fail')}</span>
                </div>
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

        const formatted = formatBeijingTimestamp(date);
        el.textContent = `${t('lastUpdated')}: ${formatted}`;
    }

    function formatBeijingTimestamp(date) {
        if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
            const parts = Object.fromEntries(
                formatter
                    .formatToParts(date)
                    .filter((part) => part.type !== 'literal')
                    .map((part) => [part.type, part.value])
            );

            if (parts.year && parts.month && parts.day && parts.hour && parts.minute && parts.second) {
                return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} UTC+8`;
            }
        }

        const beijingDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
        return `${beijingDate.toISOString().slice(0, 19).replace('T', ' ')} UTC+8`;
    }

    // Render data row
    function renderDataRow(entry, isLatest, isExpanded, showVersion, isSparse) {
        const m = entry.metrics;
        const trends = entry.trends || {};
        const dateLabel = getEntryDateLabel(entry);
        const displayVersion = formatEntryVersion(entry, { display: true });
        const buildCount = entry.versionVariants?.length || 1;
        const engineLabel = getEngineLabel(getEngine(entry));
        const fallbackDate = dateLabel ? `<small class="version-date version-date--aligned">${dateLabel}</small>` : '';
        const tableVersionSummary = formatTableVersionSummary(entry, dateLabel);
        const versionMainText = tableVersionSummary || `${renderAlignedVersionRow({ label: engineLabel, version: displayVersion })}${fallbackDate}`;
        const provenanceSummary = renderProvenanceSummary(entry);
        const settingSummary = getSettingSummary(entry);

        // 生成配置描述（芯片数/节点数）
        const configText = getConfigText(entry);
        const workloadText = getWorkloadLabel(getWorkloadId(entry));

        return `
            <tr data-entry-id="${entry.entry_id}" class="${isSparse ? 'is-sparse' : ''}">
                <td>
                    <div class="version-cell">
                        ${showVersion ? `<div class="version-main version-main--aligned">${versionMainText}</div>` : ''}
                        ${showVersion ? provenanceSummary : ''}
                        ${showVersion ? `<small class="version-setting-summary">${settingSummary}</small>` : ''}
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
        const engineVersion = formatEntryVersion(entry);
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
                <p><strong>${t('displayedVersion')}:</strong> ${formatEntryVersion(entry, { display: true })} ${t('bestFourthInline')}</p>
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
                                        <td>${getEngineLabel(getEngine(variant))} ${formatEntryVersion(variant)}${index === 0 ? ` ${t('selectedStar')}` : ''}</td>
                                        <td>${getEntryDateLabel(variant) || '-'}</td>
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
        const actor = getProvenanceActor(meta);
        const commitLabel = meta.git_commit ? `<code>${meta.git_commit}</code>` : '';
        const gitCommit = meta.github_commit_url
            ? renderExternalLink(meta.github_commit_url, commitLabel || t('view'))
            : (commitLabel || '-');
        const githubPullRequest = meta.github_pr_number
            ? renderExternalLink(meta.github_pr_url, `#${meta.github_pr_number}`) || `#${meta.github_pr_number}`
            : (meta.github_pr_url ? renderExternalLink(meta.github_pr_url, t('view')) : '');
        const changelog = meta.changelog_url ? renderExternalLink(meta.changelog_url, t('view')) : '-';
        return `
            <div class="detail-section">
                <h4>${t('improvements')}</h4>
                <p>${meta.notes || t('noImprovements')}</p>
                ${actor ? `<p><strong>${t('provenanceActor')}:</strong> <span class="${actor.className}">${actor.label}</span></p>` : ''}
                ${(meta.git_commit || meta.github_commit_url) ? `<p><strong>${t('gitCommit')}:</strong> ${gitCommit}</p>` : ''}
                ${githubPullRequest ? `<p><strong>${t('githubPullRequest')}:</strong> ${githubPullRequest}</p>` : ''}
                ${meta.github_repository ? `<p><strong>${t('githubRepository')}:</strong> ${meta.github_repository}</p>` : ''}
                ${meta.github_ref ? `<p><strong>${t('gitReference')}:</strong> ${meta.github_ref}</p>` : ''}
                <p><strong>${t('changelog')}:</strong> ${changelog}</p>
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
        const model = normalizeScopeModelName(entry?.model?.name);
        const hardware = entry?.hardware?.chip_model || 'unknown-hardware';
        const precision = entry?.model?.precision || 'unknown-precision';
        const workload = getWorkloadId(entry) || 'Other';
        const configType = entry?.config_type || state.currentTab || 'unknown-config';
        const chipCount = entry?.hardware?.chip_count || 0;
        const nodeCount = entry?.cluster?.node_count || 1;
        const settingSignature = getSettingSignature(entry);
        return [model, hardware, precision, workload, configType, chipCount, nodeCount, settingSignature].join('|');
    }

    function buildScopeLabel(entry) {
        const model = entry?.model?.name || 'Unknown model';
        const hardware = entry?.hardware?.chip_model || 'Unknown hardware';
        const workload = getWorkloadLabel(getWorkloadId(entry));
        const settingSummary = entry?.scope?.setting_summary || getSettingSummary(entry);
        return `${model} • ${hardware} • ${workload} • ${settingSummary}`;
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
                    version: formatEntryVersion(bestEntry, { display: true }),
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

    function getOverviewHeroSectionLabel(goalPair, compareSnapshotGroup) {
        if (goalPair) {
            return t('overviewHeroGoalLabel');
        }
        if (compareSnapshotGroup) {
            return t('overviewHeroCompareLabel');
        }
        return t('quickCompare');
    }

    function renderTableSectionHint() {
        const hintEl = document.getElementById('leaderboard-hint');
        if (!hintEl) {
            return;
        }

        hintEl.innerHTML = `
            <span class="overview-section-label overview-section-label-inline">${t('overviewTableLabel')}</span>
            <span class="leaderboard-hint-copy">${t('overviewTableNote')}</span>
        `;
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

    function findGoalProgressPair(entries, comparisonView) {
        const goalProgress = state.compareSnapshot?.goal_progress;
        const pairs = Array.isArray(goalProgress?.pairs) ? goalProgress.pairs : [];
        if (!pairs.length) {
            return null;
        }

        const focusedEntries = Array.isArray(comparisonView?.focusGroup?.entries)
            ? comparisonView.focusGroup.entries
            : [];
        if (focusedEntries.length) {
            const focusedPair = pairs.find((pair) => snapshotScopeMatchesEntries(pair, focusedEntries));
            if (focusedPair) {
                return focusedPair;
            }
        }

        const visibleEntries = comparisonView?.visibleEntries?.length
            ? comparisonView.visibleEntries
            : entries;
        const matchingPairs = pairs.filter((pair) => snapshotScopeMatchesEntries(pair, visibleEntries));
        if (matchingPairs.length) {
            return matchingPairs[0];
        }

        return goalProgress?.headline_pair || null;
    }

    function getGoalProgressTitle(pair) {
        const currentVersion = formatSnapshotVersion(pair?.current);
        const baselineVersion = formatSnapshotVersion(pair?.baseline);
        return `${t('goalCompareTitle')} · ${currentVersion} ${t('versusShort')} ${baselineVersion}`;
    }

    function getGoalProgressSubtitle(pair) {
        const scope = pair?.scope || {};
        const model = scope.model || 'Unknown model';
        const hardware = scope.hardware || 'Unknown hardware';
        const workload = getWorkloadLabel(scope.workload || 'Other');
        const settingSummary = scope.setting_summary ? ` • ${scope.setting_summary}` : '';
        return `${t('goalCompareScope')}: ${model} • ${hardware} • ${workload}${settingSummary}`;
    }

    function formatRemainingGap(value) {
        if (!Number.isFinite(value)) {
            return '-';
        }
        if (value === 0) {
            return t('goalMet');
        }
        return `${value.toFixed(1)}% ${t('goalGapRemaining')}`;
    }

    function renderGoalProgressPair(pair) {
        const current = pair?.current;
        const baseline = pair?.baseline;
        if (!current || !baseline) {
            return '';
        }

        const deltas = pair?.deltas || {};
        const remainingGap = pair?.remaining_gap_pct || {};

        return `
            <div class="head-to-head goal-progress-head-to-head">
                <div class="head-to-head-side">
                    <span class="goal-compare-label">${t('goalCurrentLabel')}</span>
                    <strong>${getEngineLabel(current.engine)} ${formatSnapshotVersion(current)}</strong>
                    <span>TTFT ${formatNumber(current.metrics.ttft_ms)} ms • TBT ${formatNumber(current.metrics.tbt_ms)} ms • TPS ${formatNumber(current.metrics.throughput_tps)}</span>
                </div>
                <div class="head-to-head-divider">${t('versusShort')}</div>
                <div class="head-to-head-side">
                    <span class="goal-compare-label">${t('goalBaselineLabel')}</span>
                    <strong>${getEngineLabel(baseline.engine)} ${formatSnapshotVersion(baseline)}</strong>
                    <span>TTFT ${formatNumber(baseline.metrics.ttft_ms)} ms • TBT ${formatNumber(baseline.metrics.tbt_ms)} ms • TPS ${formatNumber(baseline.metrics.throughput_tps)}</span>
                </div>
            </div>
            <div class="head-to-head-deltas goal-progress-deltas">
                <div class="head-to-head-delta">${t('throughputGap')}: ${formatSnapshotDelta(deltas.throughput_pct_current_vs_baseline, true)} · ${formatRemainingGap(remainingGap.throughput)}</div>
                <div class="head-to-head-delta">TTFT ${t('gap')}: ${formatSnapshotDelta(deltas.ttft_pct_current_vs_baseline, false)} · ${formatRemainingGap(remainingGap.ttft)}</div>
                <div class="head-to-head-delta">TBT ${t('gap')}: ${formatSnapshotDelta(deltas.tbt_pct_current_vs_baseline, false)} · ${formatRemainingGap(remainingGap.tbt)}</div>
            </div>
        `;
    }

    function findCompareSnapshotGroup(entries, comparisonView) {
        const groups = Array.isArray(state.compareSnapshot?.groups) ? state.compareSnapshot.groups : [];
        if (!groups.length) {
            return null;
        }

        const focusedEntries = Array.isArray(comparisonView?.focusGroup?.entries)
            ? comparisonView.focusGroup.entries
            : [];
        if (focusedEntries.length) {
            const focusedGroup = groups.find((group) => snapshotScopeMatchesEntries(group, focusedEntries));
            if (focusedGroup) {
                return focusedGroup;
            }
        }

        const scopedEntries = Array.isArray(entries) ? entries : [];
        if (scopedEntries.length) {
            const matchedGroup = groups.find((group) => snapshotScopeMatchesEntries(group, scopedEntries));
            if (matchedGroup) {
                return matchedGroup;
            }
        }

        return null;
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
        const settingSummary = group?.scope?.setting_summary
            ? `<div class="head-to-head-delta">${t('focusedScope')}: ${group.scope.setting_summary}</div>`
            : '';

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
                ${settingSummary}
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
