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
            statsLoadingMore: 'loading more data...',
            quickCompare: 'Compare',
            hardConstraintsTitle: 'Validation Checks',
            hardConstraintsSubtitle: 'Current validation records from benchmark snapshots, with context from previous submissions.',
            hardConstraintsNoData: 'No validation records under current filters.',
            hardConstraintsBaselineLabel: 'Performance Baseline',
            hardConstraintsBaselineValue: 'Official vLLM 0.18.0 + vllm-ascend v0.18.0',
            hardConstraintsBestCaseScope: 'Selected scope across visible workloads',
            hardConstraintsMixedWorkloads: 'mixed workloads',
            hardConstraintsBestWorkloadLabel: 'Selected workload',
            hardConstraintsTiedWorkloadsLabel: 'Related workloads',
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
            noComparableHidden: 'The current filters expose sparse groups. Turn off "Focus comparable rows" if you want to inspect single-engine rows.',
            noComparableRelax: 'Relax one or more filters to bring engines back into the same comparison frame.',
            rows: 'rows',
            engines: 'engines',
            completeCompareGroups: 'complete compare groups',
            leadsThroughput: 'higher throughput',
            onlyEngine: 'is the single engine in the current view.',
            comparingEngines: 'Comparing engines in the current view.',
            focusedPrefix: 'Aligned comparison scope: ',
            leadsBy: 'is higher in the current view by',
            throughputOver: 'throughput over',
            sparseHidden: 'sparse groups hidden',
            completeGroupsLabel: 'Complete groups',
            sparseGroupsLabel: 'Sparse groups',
            focusedScopeLabel: 'Focused scope',
            hiddenRowsLabel: 'Hidden rows',
            latest: 'Latest',
            baseline: 'Baseline',
            bestFourth: 'Selected 4th-segment result shown',
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
            hardwareConfig: 'Hardware Configuration',
            hardwareConfiguration: 'Hardware Configuration',
            chip: 'Chip',
            totalMemory: 'Total Memory',
            cuda: 'CUDA',
            cann: 'CANN',
            cluster: 'Cluster',
            engineVersions: 'Engine Versions',
            engine: 'Engine',
            engineVersion: 'Engine Version',
            benchmark: 'Benchmark',
            componentVersions: 'Component Versions',
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
            bestFourthInline: '(the selected 4th-segment build under this 3-segment version is shown on the main table)',
            displayedVersionHint: 'the selected 4th-segment build under this 3-segment version is shown on the main table',
            fullVersion: 'Full Version',
            releaseDate: 'Result Date',
            ttft: 'TTFT',
            tokensPerSecond: 'Tokens/s',
            peakMem: 'Peak Mem',
            error: 'Error',
            hitRate: 'Hit Rate',
            improvements: 'Improvements',
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
            reproduceThisResult: 'Reproduce This Result',
            reproduce: 'Reproduce This Result',
            copy: 'Copy',
            copiedBang: 'Copied!',
            copyCommandFailed: 'Failed to copy command',
            copied: 'Copied!',
            copyFailed: 'Failed to copy command',
            selectedStar: '',
            throughputLeader: 'Higher throughput',
            rowCount: 'rows',
            bestVisibleVersion: 'Visible version',
            visibleVersionLabel: 'Visible version: ',
            currentBestVersionLabel: 'Current selected version: ',
            baselineVersionLabel: 'Baseline version: ',
            alignedVersionLabel: 'Aligned compare version: ',
            sampleTTFT: 'TTFT',
            sampleTBT: 'TBT',
            sampleThroughput: 'Throughput',
            errorRate: 'Error Rate',
            bestVisibleRun: 'Visible run',
            visibleScopeLabel: 'Visible scope',
            alignedRunLabel: 'Aligned compare run',
            parity: 'parity',
            better: 'better',
            worse: 'worse',
            throughputGap: 'Throughput gap',
            gap: 'gap',
            ttftGap: 'TTFT gap',
            tbtGap: 'TBT gap',
            compareUtilizationLabel: 'Util',
            compareTokenCostLabel: 'Token cost',
            compareMultiTenantLabel: 'Multi-tenant',
            compareLongContextLabel: 'Long ctx',
            compareNoData: 'n/a',
            compareStableYes: 'stable',
            compareStableNo: 'unstable',
            onlyEngineView: 'is the single engine in the current view.',
            comparing: 'Comparing',
            enginesInView: 'engines in the current view.',
            focusedSlice: 'Aligned comparison scope:',
            leadsCurrentView: 'is higher in the current view by',
            models: 'models',
            hardwareTargets: 'hardware targets',
            workloads: 'workloads',
            sparseGroupsHidden: 'sparse groups hidden',
            completeGroups: 'Complete groups',
            sparseGroups: 'Sparse groups',
            focusedScope: 'Focused scope',
            hiddenRows: 'Hidden rows',
            versusShort: 'VS',
            goalProgressKicker: 'Goal View',
            goalBaselineLabel: 'Official vLLM 0.18.0 + vllm-ascend v0.18.0 baseline',
            goalCurrentLabel: 'Current vllm-hust',
            goalMet: 'Goal met',
            goalGapRemaining: 'Remaining gap',
            goalCompareTitle: 'vllm-hust vs Official vLLM 0.18.0 + vllm-ascend v0.18.0',
            goalCompareScope: 'Pinned goal scope',
            overviewHeroGoalLabel: 'Official Compare',
            overviewHeroCompareLabel: 'Snapshot Compare',
            overviewGridLabel: 'Visible Aggregate',
            overviewGridNote: 'Cards show the highlighted visible sample for each engine; row counts show coverage.',
            overviewGridNoteAligned: 'Cards show one matched compare-scope sample selected from the current snapshot; row counts show coverage.',
            overviewGridNoteScopedOnly: 'No complete compare scope is visible, so cards do not show synthetic aggregate metrics.',
            overviewTableLabel: 'Visible Rows',
            overviewTableNote: 'The main table shows the currently visible benchmark rows after filters, scope toggles, and version merging.',
            overviewGoalSnapshotNote: 'Hero deltas use the matched official compare snapshot. Cards below show the highlighted visible sample for each engine.',
            overviewCompareSnapshotNote: 'Hero deltas use the matched compare snapshot. Cards below show the highlighted visible sample for each engine.',
            trendLabel: 'Version Trend',
            trendTitle: 'Performance trend',
            trendSubtitle: 'Baseline first, then every visible online serving revision, including PR and historical runs.',
            trendMetricThroughput: 'Tokens/s',
            trendMetricTTFT: 'TTFT',
            trendMetricTBT: 'TBT',
            trendAxisLabel: 'Y axis',
            trendAxisAuto: 'Auto',
            trendAxisLog: 'Log',
            trendAxisLinear: 'Linear',
            trendAxisBreak: 'axis break',
            trendSeriesButton: 'Series',
            trendSeriesSummary: '{visible} of {total} series visible',
            trendSeriesHint: 'Open the series panel to focus the chart.',
            trendSeriesSearch: 'Search series',
            trendSeriesShowAll: 'Show all',
            trendSeriesHideAll: 'Hide all',
            trendSeriesEmpty: 'No matching series.',
            trendSeriesComparable: 'baseline + current · {count} points',
            trendSeriesBaselineOnly: 'baseline only · 1 point · no trend',
            trendSeriesCurrentHistory: 'current history · {count} points · no comparable baseline',
            trendSeriesSinglePoint: 'current only · 1 point · no trend',
            trendSeriesConfig: 'config {token}',
            trendTooltipActualValue: 'Actual',
            trendTooltipBrokenAxis: 'shown on broken axis',
            trendEmpty: 'No trend data under current filters.',
            trendTooltipVersion: 'Version',
            trendTooltipDate: 'Submitted',
            trendTooltipWorkload: 'Workload',
            trendTooltipPrecision: 'Precision',
            trendTooltipEngine: 'Engine',
            trendTooltipModel: 'Model',
            trendTooltipHardware: 'Hardware',
            trendTooltipSetting: 'Setting',
            showTableDetails: 'Show table data',
            hideTableDetails: 'Hide table data',
            resetFilters: 'Reset',
            paginationPrev: 'Prev',
            paginationNext: 'Next',
            paginationPage: 'Page',
            paginationRows: 'rows',
            modelColumn: 'Model',
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
            statsLoadingMore: '仍在加载更多数据...',
            quickCompare: '对比',
            hardConstraintsTitle: '验证项',
            hardConstraintsSubtitle: '展示当前 benchmark 快照中的验证记录，并保留与上次提交相关的上下文。',
            hardConstraintsNoData: '当前筛选条件下没有验证记录。',
            hardConstraintsBaselineLabel: '性能基线',
            hardConstraintsBaselineValue: 'Official vLLM 0.18.0 + vllm-ascend v0.18.0',
            hardConstraintsBestCaseScope: '当前可见 workload 选择范围',
            hardConstraintsMixedWorkloads: '多 workload 组合',
            hardConstraintsBestWorkloadLabel: '选中 workload',
            hardConstraintsTiedWorkloadsLabel: '相关 workload',
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
            noComparableHidden: '当前筛选下主要是稀疏分组。如果你想查看单引擎结果，可以关闭“聚焦可对比记录”。',
            noComparableRelax: '放宽一个或多个筛选条件，让引擎回到同一对比范围。',
            rows: '条记录',
            engines: '个引擎',
            completeCompareGroups: '个完整对比分组',
            leadsThroughput: '吞吐较高',
            onlyEngine: '是当前视图中的单个引擎。',
            comparingEngines: '当前视图包含多个引擎。',
            focusedPrefix: '当前为严格同条件视图：',
            leadsBy: '当前吞吐较高',
            throughputOver: '，相对',
            sparseHidden: '个稀疏分组已隐藏',
            completeGroupsLabel: '完整分组',
            sparseGroupsLabel: '稀疏分组',
            focusedScopeLabel: '锁定范围',
            hiddenRowsLabel: '隐藏行数',
            latest: '最新',
            baseline: '基线',
            bestFourth: '主表展示该三位版本下选中的四段版本',
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
            hardwareConfig: '硬件配置',
            hardwareConfiguration: '硬件配置',
            chip: '芯片',
            totalMemory: '总显存',
            cuda: 'CUDA',
            cann: 'CANN',
            cluster: '集群',
            engineVersions: '引擎版本',
            engine: '引擎',
            engineVersion: '引擎版本',
            benchmark: 'Benchmark',
            componentVersions: '组件版本',
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
            bestFourthInline: '（主表展示该三位版本下选中的四段版本）',
            displayedVersionHint: '主表展示该三位版本下选中的四段版本',
            fullVersion: '完整版本',
            releaseDate: '结果日期',
            ttft: 'TTFT',
            tokensPerSecond: 'Tokens/s',
            peakMem: '峰值显存',
            error: '错误率',
            hitRate: '命中率',
            improvements: '改进说明',
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
            reproduceThisResult: '复现实验结果',
            reproduce: '复现实验',
            copy: '复制',
            copiedBang: '已复制！',
            copyCommandFailed: '复制命令失败',
            copied: '已复制！',
            copyFailed: '复制命令失败',
            selectedStar: '',
            throughputLeader: '吞吐较高',
            rowCount: '条记录',
            bestVisibleVersion: '当前可见版本',
            visibleVersionLabel: '当前可见版本：',
            currentBestVersionLabel: '当前选中版本：',
            baselineVersionLabel: '基线版本：',
            alignedVersionLabel: '对齐对比版本：',
            sampleTTFT: 'TTFT',
            sampleTBT: 'TBT',
            sampleThroughput: '吞吐',
            errorRate: '错误率',
            bestVisibleRun: '当前可见样本',
            visibleScopeLabel: '当前可见范围',
            alignedRunLabel: '对齐对比样本',
            parity: '持平',
            better: '更优',
            worse: '更差',
            throughputGap: '吞吐差距',
            gap: '差距',
            ttftGap: 'TTFT 差距',
            tbtGap: 'TBT 差距',
            compareUtilizationLabel: '利用率',
            compareTokenCostLabel: '单位成本下降',
            compareMultiTenantLabel: '多租户',
            compareLongContextLabel: '长上下文',
            compareNoData: '暂无',
            compareStableYes: '稳定',
            compareStableNo: '不稳定',
            onlyEngineView: '是当前视图中的单个引擎。',
            comparing: '当前正在比较',
            enginesInView: '个引擎。',
            focusedSlice: '当前为严格同条件视图：',
            leadsCurrentView: '当前吞吐较高',
            models: '个模型',
            hardwareTargets: '类硬件目标',
            workloads: '个工作负载',
            sparseGroupsHidden: '个稀疏分组已隐藏',
            completeGroups: '完整分组',
            sparseGroups: '稀疏分组',
            focusedScope: '锁定范围',
            hiddenRows: '隐藏行数',
            versusShort: '对比',
            goalProgressKicker: '目标视图',
            goalBaselineLabel: '官方 vLLM 0.18.0 + vllm-ascend v0.18.0 基线',
            goalCurrentLabel: '当前 vllm-hust',
            goalMet: '已达到目标',
            goalGapRemaining: '距离目标',
            goalCompareTitle: 'vllm-hust 对比官方 vLLM 0.18.0 + vllm-ascend v0.18.0 基线',
            goalCompareScope: '目标比较范围',
            overviewHeroGoalLabel: '官方对比',
            overviewHeroCompareLabel: '快照对比',
            overviewGridLabel: '当前可见聚合',
            overviewGridNote: '下方卡片展示每个引擎当前高亮样本的指标；记录数表示覆盖范围。',
            overviewGridNoteAligned: '下方卡片展示一个同规格 compare scope 的实际样本；该样本来自当前快照，记录数表示覆盖范围。',
            overviewGridNoteScopedOnly: '当前没有完整对比分组，卡片不会展示合成聚合指标。',
            overviewTableLabel: '当前可见明细',
            overviewTableNote: '主表展示的是当前筛选、scope 开关和版本合并之后的 benchmark 可见行。',
            overviewGoalSnapshotNote: '顶部 Hero 的差距值来自当前命中的官方 compare snapshot；下方卡片展示每个引擎当前高亮样本。',
            overviewCompareSnapshotNote: '顶部 Hero 的差距值来自当前命中的 compare snapshot；下方卡片展示每个引擎当前高亮样本。',
            trendLabel: '版本趋势',
            trendTitle: '性能趋势',
            trendSubtitle: '横轴从基线开始，展示当前范围内全部在线服务版本，包括 PR 与历史运行。',
            trendMetricThroughput: '吞吐',
            trendMetricTTFT: 'TTFT',
            trendMetricTBT: 'TBT',
            trendAxisLabel: 'Y 轴',
            trendAxisAuto: '自动',
            trendAxisLog: '对数',
            trendAxisLinear: '线性',
            trendAxisBreak: '断轴',
            trendSeriesButton: '系列',
            trendSeriesSummary: '已显示 {visible} / {total} 条系列',
            trendSeriesHint: '打开系列面板以聚焦图表。',
            trendSeriesSearch: '搜索系列',
            trendSeriesShowAll: '全部显示',
            trendSeriesHideAll: '全部隐藏',
            trendSeriesEmpty: '没有匹配的系列。',
            trendSeriesComparable: '基线 + 当前版本 · {count} 个点',
            trendSeriesBaselineOnly: '仅基线 · 1 个点 · 无趋势',
            trendSeriesCurrentHistory: '当前版本历史 · {count} 个点 · 无可比基线',
            trendSeriesSinglePoint: '仅当前版本 · 1 个点 · 无趋势',
            trendSeriesConfig: '配置 {token}',
            trendTooltipActualValue: '实际值',
            trendTooltipBrokenAxis: '断轴显示',
            trendEmpty: '当前筛选条件下没有可绘制的趋势数据。',
            trendTooltipVersion: '版本',
            trendTooltipDate: '提交时间',
            trendTooltipWorkload: '工作负载',
            trendTooltipPrecision: '精度',
            trendTooltipEngine: '引擎',
            trendTooltipModel: '模型',
            trendTooltipHardware: '硬件',
            trendTooltipSetting: '设置',
            showTableDetails: '展开详细数据',
            hideTableDetails: '收起详细数据',
            resetFilters: '清空筛选',
            paginationPrev: '上一页',
            paginationNext: '下一页',
            paginationPage: '第',
            paginationRows: '条',
            modelColumn: '模型',
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
        expandedRows: new Set(),
        sort: {
            'single-chip': { column: null, direction: 'asc' },
            'multi-chip': { column: null, direction: 'asc' },
            'multi-node': { column: null, direction: 'asc' }
        },
        pagination: {
            'single-chip': { page: 1, pageSize: 20 },
            'multi-chip': { page: 1, pageSize: 20 },
            'multi-node': { page: 1, pageSize: 20 }
        },
        chartMetric: 'throughput_tps',
        trendAxisScale: 'auto',
        trendChart: null,
        trendSeries: [],
        hiddenTrendSeries: new Set(),
        trendSeriesExpanded: false,
        tableDetailsExpanded: false,
        loadingMore: false
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('vllm-hust:langchange', () => {
        renderFilters();
        renderViewControls();
        updateTableDetailsToggle();
        renderTable();
        void renderLastUpdated();
    });

    async function init() {
        setupEventListeners();
        await loadData();
        renderFilters();
        renderViewControls();
        updateTableDetailsToggle();
        renderTable();
        await renderLastUpdated();
        startBackgroundDataSync();
    }

    // Load JSON data (支持 HF 和本地两种模式)
    async function loadData() {
        const loadingEl = document.getElementById('leaderboard-loading');
        const errorEl = document.getElementById('leaderboard-error');
        const contentEl = document.getElementById('leaderboard-content');

        try {
            let data;
            let renderedPartial = false;

            const renderPartialData = (progress) => {
                const partialData = progress?.data || {};
                const hasBenchmarkData =
                    Array.isArray(partialData.single) || Array.isArray(partialData.multi);
                if (!hasBenchmarkData) {
                    return;
                }

                applyLeaderboardPayload(partialData, {
                    partial: true,
                    resetFilters: !renderedPartial
                });
                if (!renderedPartial) {
                    ensureCurrentTabHasData();
                }
                renderedPartial = true;
                state.loadingMore = !progress.complete;

                loadingEl.style.display = 'none';
                errorEl.style.display = 'none';
                contentEl.style.display = 'block';
                renderFilters();
                renderViewControls();
                updateTableDetailsToggle();
                renderTable();
            };

            // 优先使用 HF Data Loader（如果可用）
            if (window.HFDataLoader) {
                console.log('[Leaderboard] Using HF Data Loader...');
                data = await window.HFDataLoader.loadLeaderboardData({
                    onProgress: renderPartialData
                });
            } else {
                // 备用：直接从本地加载
                console.log('[Leaderboard] HF Loader not available, using local data...');
                const [singleRes, multiRes, compareRes] = await Promise.all([
                    fetch('./data/leaderboard_single.json'),
                    fetch('./data/leaderboard_multi.json'),
                    fetch('./data/leaderboard_compare.json')
                ]);

                if (!singleRes.ok || !multiRes.ok) {
                    throw new Error('Failed to load data');
                }

                data = {
                    single: await singleRes.json(),
                    multi: await multiRes.json(),
                    compare: compareRes.ok ? await compareRes.json() : null,
                };
            }

            state.loadingMore = false;
            applyLeaderboardPayload(data, { resetFilters: !renderedPartial });
            if (!renderedPartial) {
                ensureCurrentTabHasData();
            }

            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
        } catch (error) {
            console.error('Error loading leaderboard data:', error);
            loadingEl.style.display = 'none';
            errorEl.style.display = 'block';
        }
    }

    function applyLeaderboardPayload(data, options = {}) {
        const hasSingle = Array.isArray(data?.single);
        const hasMulti = Array.isArray(data?.multi);
        const hasCompare = Object.prototype.hasOwnProperty.call(data || {}, 'compare');

        if (hasCompare) {
            state.compareSnapshot = data?.compare || null;
        }

        if (hasSingle || !options.partial) {
            const singleData = hasSingle ? data.single : [];
            // 按芯片数和节点数分类
            state.singleChipData = singleData.filter(entry =>
                entry.hardware.chip_count === 1 && (!entry.cluster || entry.cluster.node_count === 1)
            );
        }

        if (hasMulti || !options.partial) {
            const multiData = hasMulti ? data.multi : [];
            state.multiChipData = multiData.filter(entry =>
                entry.hardware.chip_count > 1 && (!entry.cluster || entry.cluster.node_count === 1)
            );

            state.multiNodeData = multiData.filter(entry =>
                entry.cluster && entry.cluster.node_count > 1
            );
        }

        state.totalLoadedEntries =
            state.singleChipData.length +
            state.multiChipData.length +
            state.multiNodeData.length;

        [state.singleChipData, state.multiChipData, state.multiNodeData].forEach(entries => {
            entries.sort(compareEntriesByVersionDesc);
        });

        if (options.resetFilters) {
            initializeFilters();
        }
    }

    function ensureCurrentTabHasData() {
        if (getDataByTab(state.currentTab).length > 0) {
            return;
        }

        const firstPopulatedTab = ['single-chip', 'multi-chip', 'multi-node']
            .find((tab) => getDataByTab(tab).length > 0);
        if (!firstPopulatedTab) {
            return;
        }

        state.currentTab = firstPopulatedTab;
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === firstPopulatedTab);
        });
    }

    function startBackgroundDataSync() {
        if (!window.HFDataLoader || typeof window.HFDataLoader.startBackgroundSync !== 'function') {
            return;
        }

        window.addEventListener('vllm-hust:leaderboard-data-updated', (event) => {
            const data = event.detail?.data;
            if (!data) {
                return;
            }

            applyLeaderboardPayload(data, { resetFilters: false });
            renderFilters();
            renderViewControls();
            updateTableDetailsToggle();
            renderTable();
            void renderLastUpdated();
        });

        window.HFDataLoader.startBackgroundSync();
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

    function sanitizeDisplayEngineVersion(version, gitCommit = '') {
        const sanitized = sanitizeEngineVersion(version, gitCommit);
        return hasRenderablePackageVersion(sanitized) ? sanitized : '';
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
        const gitCommit = getEntryGitCommit(entry);
        const explicit = sanitizeDisplayEngineVersion(entry?.displayVersion || '', gitCommit);
        const engineVersion = sanitizeDisplayEngineVersion(
            entry?.engine_version || entry?.metadata?.engine_version || '',
            gitCommit
        );
        return normalizeDisplayVersion(explicit || engineVersion);
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

        if (isCommitLikeValue(cleaned)) {
            return '';
        }

        const match = cleaned.match(/^(?<release>\d+(?:\.\d+){0,2})(?<suffix>.*)$/);
        if (!match || !match.groups) {
            return cleaned;
        }

        const parts = match.groups.release.split('.');
        while (parts.length < 3) {
            parts.push('0');
        }

        return `${parts.join('.')}${match.groups.suffix}`;
    }

    function formatComponentVersion(version, commit, { includeCommit = true } = {}) {
        const normalizedVersion = normalizePackageVersion(version);
        if (!normalizedVersion) {
            return '';
        }

        const shortCommit = getShortCommit(commit || extractCommitFromVersion(version));
        return includeCommit && shortCommit ? `v${normalizedVersion}#${shortCommit}` : `v${normalizedVersion}`;
    }

    function normalizeDetailedPackageVersion(value) {
        const normalized = String(value || '').trim();
        if (!hasRenderablePackageVersion(normalized)) {
            return '';
        }

        const withoutLeadingV = normalized.replace(/^v/i, '');
        const cleaned = withoutLeadingV
            .replace(/-\d+-g[0-9a-f]{7,40}$/i, '')
            .replace(/\+g[0-9a-f]{7,40}(?:\.d\d{8})?$/i, '')
            .replace(/\.g[0-9a-f]{7,40}(?:\.d\d{8})?$/i, '')
            .replace(/(?:[.+-])d\d{8}$/i, '');

        if (isCommitLikeValue(cleaned)) {
            return '';
        }

        const match = cleaned.match(/^(?<release>\d+(?:\.\d+){0,2})(?<suffix>.*)$/);
        if (!match || !match.groups) {
            return cleaned;
        }

        const parts = match.groups.release.split('.');
        while (parts.length < 3) {
            parts.push('0');
        }

        return `${parts.join('.')}${match.groups.suffix}`;
    }

    function formatDetailedVersion(version, commit, { includeCommit = true } = {}) {
        const normalizedVersion = normalizeDetailedPackageVersion(version);
        if (!normalizedVersion) {
            return '';
        }

        const shortCommit = getShortCommit(extractCommitFromVersion(version) || commit);
        return includeCommit && shortCommit ? `v${normalizedVersion}#${shortCommit}` : `v${normalizedVersion}`;
    }

    function getRepositoryName(repository) {
        const normalized = String(repository || '').trim().toLowerCase();
        if (!normalized) {
            return '';
        }
        const parts = normalized.split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : normalized;
    }

    function getRepositoryOwner(repository) {
        const normalized = String(repository || '').trim();
        if (!normalized) {
            return '';
        }
        const parts = normalized.split('/').filter(Boolean);
        return parts.length > 1 ? parts[0] : '';
    }

    function isHustCoreRepository(repository) {
        return getRepositoryName(repository) === 'vllm-hust';
    }

    function isHustPluginRepository(repository) {
        return getRepositoryName(repository) === 'vllm-ascend-hust';
    }

    function entryMatchesRepositoryCommit(entry, repository, commit) {
        const normalizedRepository = String(repository || '').trim().toLowerCase();
        const normalizedCommit = String(commit || '').trim().toLowerCase();
        if (!normalizedRepository || !normalizedCommit) {
            return false;
        }

        const metadata = entry?.metadata || {};
        const runtime = metadata.runtime_provenance || {};
        const candidates = [
            {
                repository: String(metadata.github_repository || '').trim().toLowerCase(),
                commit: String(metadata.git_commit || '').trim().toLowerCase(),
            },
            {
                repository: String(runtime?.engine?.repository || '').trim().toLowerCase(),
                commit: String(runtime?.engine?.commit || '').trim().toLowerCase(),
            },
            {
                repository: String(runtime?.plugin?.repository || '').trim().toLowerCase(),
                commit: String(runtime?.plugin?.commit || '').trim().toLowerCase(),
            },
        ];

        return candidates.some((candidate) => (
            candidate.repository === normalizedRepository && candidate.commit === normalizedCommit
        ));
    }

    function resolveRecordedGithubActor(repository, commit, fallbackActor = '') {
        const explicitActor = String(fallbackActor || '').trim();
        if (explicitActor) {
            return explicitActor;
        }

        const datasets = [state.singleChipData, state.multiChipData, state.multiNodeData];
        for (const dataset of datasets) {
            for (const entry of dataset) {
                if (!entryMatchesRepositoryCommit(entry, repository, commit)) {
                    continue;
                }

                const githubUser = String(entry?.metadata?.github_user || '').trim();
                if (githubUser) {
                    return githubUser;
                }
            }
        }

        return getRepositoryOwner(repository);
    }

    function compactGitRef(ref) {
        const normalized = String(ref || '').trim();
        if (!normalized) {
            return '';
        }
        return normalized.length > 24
            ? `${normalized.slice(0, 14)}...${normalized.slice(-8)}`
            : normalized;
    }

    function formatRecordedRevision(ref, commit) {
        const refLabel = compactGitRef(ref);
        const shortCommit = getShortCommit(commit);
        if (refLabel && shortCommit) {
            return `${refLabel}@${shortCommit}`;
        }
        if (shortCommit) {
            return `commit:${shortCommit}`;
        }
        return refLabel;
    }

    function formatActorRefCommitVersion(actor, ref, commit) {
        const actorLabel = formatGithubUserText(actor);
        const refLabel = compactGitRef(ref);
        const shortCommit = getShortCommit(commit);

        if (actorLabel && refLabel && shortCommit) {
            return `${actorLabel}/${refLabel}#${shortCommit}`;
        }
        if (actorLabel && refLabel) {
            return `${actorLabel}/${refLabel}`;
        }
        if (refLabel && shortCommit) {
            return `${refLabel}#${shortCommit}`;
        }
        if (actorLabel && shortCommit) {
            return `${actorLabel}#${shortCommit}`;
        }
        if (shortCommit) {
            return `commit#${shortCommit}`;
        }
        return actorLabel || refLabel;
    }

    function formatRefCommitVersion(ref, commit) {
        const refLabel = compactGitRef(ref);
        const shortCommit = getShortCommit(commit);
        if (refLabel && shortCommit) {
            return `${refLabel}#${shortCommit}`;
        }
        if (shortCommit) {
            return `commit#${shortCommit}`;
        }
        return refLabel;
    }

    function isGitDescribeLikeVersion(version) {
        const normalized = String(version || '').trim();
        if (!normalized) {
            return false;
        }

        return /(?:^|[-+.])g[0-9a-f]{7,40}(?:\.d\d{8})?$/i.test(normalized)
            || /\.dev\d+/i.test(normalized)
            || /-\d+-g[0-9a-f]{7,40}/i.test(normalized);
    }

    const HISTORICAL_SAME_SPEC_VERSION_OVERRIDES = {
        'vllm-ascend-hust-ci-same-spec|vllm-hust|vllm-hust': '0.17.2.post1',
        'vllm-ascend-hust-ci-same-spec|vllm-ascend-hust|vllm-ascend-hust': '0.1',
        'vllm-hust-ci-same-spec|vllm-hust|vllm-hust': '0.17.2.post1',
        'vllm-hust-ci-same-spec|vllm-ascend-hust|vllm-ascend-hust': '0.18.0.post1',
    };

    function getHistoricalSameSpecVersionOverride(dataSource, label, repository) {
        const key = [
            String(dataSource || '').trim().toLowerCase(),
            String(label || '').trim().toLowerCase(),
            getRepositoryName(repository),
        ].join('|');
        return HISTORICAL_SAME_SPEC_VERSION_OVERRIDES[key] || '';
    }

    function resolveVersionDisplayValue(version, commit, ref, { overrideVersion = '', fallbackToRecordedRevision = false, preferRecordedRevisionForDevBuild = false, includeCommit = false, missingValue = '' } = {}) {
        if (!overrideVersion && preferRecordedRevisionForDevBuild && isGitDescribeLikeVersion(version)) {
            const refCommitVersion = formatRefCommitVersion(ref, commit || extractCommitFromVersion(version));
            if (refCommitVersion) {
                return refCommitVersion;
            }
        }

        const semanticVersion = formatComponentVersion(version, commit, { includeCommit });
        if (semanticVersion) {
            return semanticVersion;
        }

        const semanticOverride = formatComponentVersion(overrideVersion, commit, { includeCommit });
        if (semanticOverride) {
            return semanticOverride;
        }

        if (fallbackToRecordedRevision) {
            const recordedRevision = formatRecordedRevision(ref, commit);
            if (recordedRevision) {
                return recordedRevision;
            }
        }

        return missingValue;
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

    function buildComponentVisibilityKey(label, version, commit, ref) {
        return [
            String(label || '').trim(),
            String(version || '').trim(),
            String(ref || '').trim(),
            getShortCommit(commit),
        ].join('|');
    }

    function buildTableVersionComponents(entry) {
        const metadata = entry?.metadata || {};
        const runtime = metadata.runtime_provenance || {};
        const versions = entry?.versions || {};
        const githubRepository = String(metadata.github_repository || '').trim();
        const sharedSource = {
            repository: githubRepository,
            ref: String(metadata.github_ref || '').trim(),
            commit: String(metadata.git_commit || '').trim(),
        };
        const engineSource = {
            repository: String(runtime?.engine?.repository || '').trim()
                || (isHustCoreRepository(sharedSource.repository) ? sharedSource.repository : ''),
            ref: String(runtime?.engine?.ref || '').trim()
                || (isHustCoreRepository(sharedSource.repository) ? sharedSource.ref : ''),
            commit: String(runtime?.engine?.commit || '').trim()
                || (isHustCoreRepository(sharedSource.repository) ? sharedSource.commit : ''),
        };
        const pluginSource = {
            engine: String(runtime?.plugin?.engine || '').trim()
                || (isHustPluginRepository(sharedSource.repository) ? 'vllm-ascend-hust' : ''),
            repository: String(runtime?.plugin?.repository || '').trim()
                || (isHustPluginRepository(sharedSource.repository) ? sharedSource.repository : ''),
            ref: String(runtime?.plugin?.ref || '').trim()
                || (isHustPluginRepository(sharedSource.repository) ? sharedSource.ref : ''),
            commit: String(runtime?.plugin?.commit || '').trim()
                || (isHustPluginRepository(sharedSource.repository) ? sharedSource.commit : ''),
        };
        const engineRepository = engineSource.repository.toLowerCase();
        const pluginRepository = pluginSource.repository.toLowerCase();
        const pluginEngine = pluginSource.engine.toLowerCase();
        const dataSource = String(metadata.data_source || '').trim().toLowerCase();
        const engineName = getEngine(entry);
        const engineVersion = entry?.engine_version || metadata.engine_version || '';
        const components = [];

        const isOfficialAscendStack = engineName === 'vllm'
            && (
                githubRepository.toLowerCase().includes('vllm-ascend')
                || pluginRepository.includes('vllm-ascend')
                || dataSource.includes('vllm-ascend')
            );

        if (isOfficialAscendStack) {
            const officialCoreVersion = hasRenderablePackageVersion(versions.core)
                ? versions.core
                : engineVersion;
            const officialBackendVersion = hasRenderablePackageVersion(versions.backend)
                ? versions.backend
                : engineVersion;

            const officialCoreDisplayVersion = resolveVersionDisplayValue(
                officialCoreVersion,
                sharedSource.commit,
                sharedSource.ref,
                {
                    fallbackToRecordedRevision: true,
                }
            );
            if (officialCoreDisplayVersion) {
                components.push({
                    label: 'vllm',
                    version: officialCoreDisplayVersion,
                    rawVersion: officialCoreVersion,
                    commit: sharedSource.commit,
                    ref: sharedSource.ref,
                    visibilityKey: buildComponentVisibilityKey(
                        'vllm',
                        officialCoreDisplayVersion,
                        sharedSource.commit,
                        sharedSource.ref
                    ),
                });
            }

            const officialBackendDisplayVersion = resolveVersionDisplayValue(
                officialBackendVersion,
                sharedSource.commit,
                sharedSource.ref,
                {
                    fallbackToRecordedRevision: true,
                }
            );
            if (officialBackendDisplayVersion) {
                components.push({
                    label: 'vllm-ascend',
                    version: officialBackendDisplayVersion,
                    rawVersion: officialBackendVersion,
                    commit: sharedSource.commit,
                    ref: sharedSource.ref,
                    visibilityKey: buildComponentVisibilityKey(
                        'vllm-ascend',
                        officialBackendDisplayVersion,
                        sharedSource.commit,
                        sharedSource.ref
                    ),
                });
            }

            if (components.length) {
                return components;
            }
        }

        const hasHustEngineRepository = engineRepository.includes('vllm-hust')
            || githubRepository.toLowerCase().endsWith('/vllm-hust');
        const hasHustPluginRepository = pluginEngine === 'vllm-ascend-hust'
            || pluginRepository.includes('vllm-ascend-hust')
            || githubRepository.toLowerCase().includes('vllm-ascend-hust');
        const isHustStack = hasHustEngineRepository
            || hasHustPluginRepository
            || engineName === 'vllm-hust'
            || engineName === 'vllm-ascend-hust';
        const canUseEngineVersionForHust = hasHustEngineRepository
            || (engineName === 'vllm-hust' && !hasHustPluginRepository);
        const canUseEngineVersionForPlugin = engineName === 'vllm-ascend-hust'
            || (hasHustPluginRepository && !hasHustEngineRepository);
        if (isHustStack) {
            const hustVersion = hasRenderablePackageVersion(versions.core)
                ? versions.core
                : (canUseEngineVersionForHust ? engineVersion : '');
            const hustCommit = engineSource.commit
                || (canUseEngineVersionForHust ? getEntryGitCommit(entry) : '')
                || extractCommitFromVersion(versions.core)
                || extractCommitFromVersion(engineVersion);
            const hustOverrideVersion = getHistoricalSameSpecVersionOverride(
                dataSource,
                'vllm-hust',
                engineSource.repository
            );
            const hustActor = resolveRecordedGithubActor(
                engineSource.repository,
                hustCommit,
                metadata.github_user,
            );
            const hustIdentityVersion = formatActorRefCommitVersion(
                hustActor,
                engineSource.ref,
                hustCommit,
            );
            const hustDisplayVersion = hustIdentityVersion || resolveVersionDisplayValue(
                hustVersion,
                hustCommit,
                engineSource.ref,
                {
                    overrideVersion: hustOverrideVersion,
                    fallbackToRecordedRevision: hasHustEngineRepository,
                    preferRecordedRevisionForDevBuild: true,
                    includeCommit: true,
                    missingValue: engineName === 'vllm-hust' && hasHustPluginRepository ? 'unrecorded' : '',
                }
            );
            if (hustDisplayVersion) {
                components.push({
                    label: 'vllm-hust',
                    version: hustDisplayVersion,
                    rawVersion: hustVersion,
                    overrideVersion: hustOverrideVersion,
                    commit: hustCommit,
                    ref: engineSource.ref,
                    visibilityKey: buildComponentVisibilityKey(
                        'vllm-hust',
                        hustDisplayVersion,
                        hustCommit,
                        engineSource.ref
                    ),
                });
            }

            const ascendHustVersion = hasRenderablePackageVersion(versions.backend)
                ? versions.backend
                : (canUseEngineVersionForPlugin ? engineVersion : '');
            const ascendHustCommit = pluginSource.commit
                || (canUseEngineVersionForPlugin ? getEntryGitCommit(entry) : '')
                || extractCommitFromVersion(versions.backend)
                || extractCommitFromVersion(engineVersion);
            const ascendHustOverrideVersion = getHistoricalSameSpecVersionOverride(
                dataSource,
                'vllm-ascend-hust',
                pluginSource.repository
            );
            const ascendHustActor = resolveRecordedGithubActor(
                pluginSource.repository,
                ascendHustCommit,
                metadata.github_user,
            );
            const ascendHustIdentityVersion = formatActorRefCommitVersion(
                ascendHustActor,
                pluginSource.ref,
                ascendHustCommit,
            );
            const ascendHustDisplayVersion = ascendHustIdentityVersion || resolveVersionDisplayValue(
                ascendHustVersion,
                ascendHustCommit,
                pluginSource.ref,
                {
                    overrideVersion: ascendHustOverrideVersion,
                    fallbackToRecordedRevision: hasHustPluginRepository,
                    preferRecordedRevisionForDevBuild: true,
                    includeCommit: true,
                }
            );
            if (ascendHustDisplayVersion) {
                components.push({
                    label: 'vllm-ascend-hust',
                    version: ascendHustDisplayVersion,
                    rawVersion: ascendHustVersion,
                    overrideVersion: ascendHustOverrideVersion,
                    commit: ascendHustCommit,
                    ref: pluginSource.ref,
                    visibilityKey: buildComponentVisibilityKey(
                        'vllm-ascend-hust',
                        ascendHustDisplayVersion,
                        ascendHustCommit,
                        pluginSource.ref
                    ),
                });
            }

            if (components.length) {
                return components;
            }
        }

        const officialVersion = formatComponentVersion(engineVersion || metadata.github_ref || '', '', { includeCommit: false });
        if (officialVersion) {
            components.push({
                label: engineName === 'vllm' ? 'vllm' : getEngineLabel(engineName),
                version: officialVersion,
                rawVersion: engineVersion || metadata.github_ref || '',
                commit: sharedSource.commit,
                ref: sharedSource.ref,
            });
            if (isOfficialAscendStack) {
                components.push({
                    label: 'vllm-ascend',
                    version: officialVersion,
                    rawVersion: engineVersion || metadata.github_ref || '',
                    commit: sharedSource.commit,
                    ref: sharedSource.ref,
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

    function getTableVersionVisibilityKey(entry) {
        const components = buildTableVersionComponents(entry);
        if (components.length) {
            return components
                .map((component) => component.visibilityKey || `${component.label}:${component.version}`)
                .join('|');
        }
        return formatEntryVersion(entry, { display: true });
    }

    function getTableVersionRowSpanKey(entry) {
        return getTableVersionVisibilityKey(entry);
    }

    function formatOverviewComponentVersion(component) {
        if (!component?.label) {
            return '';
        }

        const explicitDisplayVersion = String(component.version || '').trim();
        if (explicitDisplayVersion) {
            return explicitDisplayVersion;
        }

        const versionCandidates = [component.rawVersion, component.overrideVersion]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        let resolvedVersion = '';
        for (const candidate of versionCandidates) {
            resolvedVersion = formatComponentVersion(candidate, component.commit, { includeCommit: false });
            if (resolvedVersion) {
                break;
            }
        }

        if (!resolvedVersion) {
            resolvedVersion = String(component.version || '').trim();
        }

        if (!resolvedVersion) {
            return '';
        }

        return resolvedVersion;
    }

    function formatDetailComponentVersion(component) {
        if (!component?.label) {
            return '';
        }

        const versionCandidates = [component.rawVersion, component.overrideVersion, component.version]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        for (const candidate of versionCandidates) {
            const resolvedVersion = formatDetailedVersion(candidate, component.commit);
            if (resolvedVersion) {
                return resolvedVersion;
            }
        }

        return String(component.version || '').trim();
    }

    function getEntryDetailedVersionText(entry) {
        const parts = buildTableVersionComponents(entry)
            .map((component) => formatDetailComponentVersion(component))
            .filter(Boolean);

        if (parts.length) {
            return parts.join(' + ');
        }

        const fallbackVersion = formatDetailedVersion(
            entry?.engine_version || entry?.metadata?.engine_version || '',
            getEntryGitCommit(entry)
        );
        return fallbackVersion || formatEntryVersion(entry, { display: true });
    }

    function getVersionFieldCommit(entry, key) {
        const normalizedKey = String(key || '').trim().toLowerCase();
        if (!normalizedKey) {
            return '';
        }

        const components = buildTableVersionComponents(entry);
        if (normalizedKey === 'core') {
            return components.find((component) => component.label === 'vllm-hust' || component.label === 'vllm')?.commit || '';
        }
        if (normalizedKey === 'backend') {
            return components.find((component) => component.label === 'vllm-ascend-hust' || component.label === 'vllm-ascend')?.commit || '';
        }
        return '';
    }

    function getOverviewSummaryChipText(summary) {
        const labels = (summary?.overviewComponents || [])
            .map((component) => String(component?.label || '').trim())
            .filter(Boolean);

        if (labels.length) {
            return labels.join(' + ');
        }

        return summary?.label || '';
    }

    function getOverviewSummaryVersionText(summary) {
        const parts = (summary?.overviewComponents || [])
            .map((component) => formatOverviewComponentVersion(component))
            .filter(Boolean);

        if (parts.length) {
            return parts.join(' + ');
        }

        return summary?.version || '';
    }

    function getEntryCompositeVersionText(entry) {
        const parts = buildTableVersionComponents(entry)
            .map((component) => formatOverviewComponentVersion(component))
            .filter(Boolean);

        if (parts.length) {
            return parts.join(' + ');
        }

        return formatEntryVersion(entry, { display: true });
    }

    function getEntryFilterVersionParts(entry) {
        const components = buildTableVersionComponents(entry)
            .filter((component) => component?.label && component?.version)
            .map((component) => String(component.version || '').trim())
            .filter(Boolean);

        if (components.length) {
            return components;
        }

        const fallbackVersion = formatEntryVersion(entry, { display: true });
        return hasVersionValue(fallbackVersion) ? [fallbackVersion] : [];
    }

    function getEntryFilterVersionText(entry) {
        const components = buildTableVersionComponents(entry)
            .filter((component) => component?.label && component?.version);

        if (components.length) {
            return components
                .map((component) => `${component.label} ${component.version}`)
                .join(' + ');
        }

        const fallbackVersion = formatEntryVersion(entry, { display: true });
        if (!hasVersionValue(fallbackVersion)) {
            return '';
        }

        const engineName = String(getEngine(entry) || '').trim();
        return engineName && engineName !== 'unknown'
            ? `${engineName} ${fallbackVersion}`
            : fallbackVersion;
    }

    function compareVersionFilterOptions(left, right) {
        const leftParts = Array.isArray(left?.parts) ? left.parts : [];
        const rightParts = Array.isArray(right?.parts) ? right.parts : [];
        const partCount = Math.max(leftParts.length, rightParts.length);

        for (let index = 0; index < partCount; index += 1) {
            const comparison = compareDisplayVersions(
                rightParts[index] || '',
                leftParts[index] || ''
            );
            if (comparison !== 0) {
                return comparison;
            }
        }

        return String(left?.label || '').localeCompare(String(right?.label || ''));
    }

    function buildVersionFilterOption(entry) {
        return {
            label: getEntryFilterVersionText(entry),
            parts: getEntryFilterVersionParts(entry),
        };
    }

    function compareEntriesByCompositeVersion(left, right) {
        return compareVersionFilterOptions(
            buildVersionFilterOption(left),
            buildVersionFilterOption(right)
        );
    }

    function matchesVersionFilter(entry, selectedVersion) {
        const normalizedFilter = String(selectedVersion || '').trim();
        if (!normalizedFilter || normalizedFilter === 'all') {
            return true;
        }

        return getEntryFilterVersionText(entry) === normalizedFilter
            || normalizeDisplayVersion(getEngineVersion(entry)) === normalizedFilter;
    }

    function getEntryTotalMemoryGb(entry) {
        const hardware = entry?.hardware || {};
        const totalMemoryGb = Number(hardware.total_memory_gb);
        if (Number.isFinite(totalMemoryGb) && totalMemoryGb >= 0) {
            return totalMemoryGb;
        }

        const memoryPerChipGb = Number(hardware.memory_per_chip_gb);
        const chipCount = Number(hardware.chip_count);
        if (Number.isFinite(memoryPerChipGb) && Number.isFinite(chipCount) && chipCount > 0) {
            return memoryPerChipGb * chipCount;
        }

        return null;
    }

    function formatMemoryGb(value) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
    }

    function getSameSpecPayload(entry) {
        return entry?.same_spec && typeof entry.same_spec === 'object' ? entry.same_spec : {};
    }

    function getSameSpecId(entry) {
        return String(getSameSpecPayload(entry)?.spec_id || '').trim();
    }

    const TREND_SEMANTIC_SPEC_VERSION = 'same-spec-semantic/v1';
    const NON_SEMANTIC_SPEC_PARAMETER_KEYS = new Set(['host', 'port', 'model']);

    function normalizeSemanticSpecParameters(parameters) {
        if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
            return null;
        }
        return Object.fromEntries(
            Object.entries(parameters)
                .filter(([key]) => !NON_SEMANTIC_SPEC_PARAMETER_KEYS.has(key))
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, value]) => [key, value])
        );
    }

    function stableStringify(value) {
        if (Array.isArray(value)) {
            return `[${value.map((item) => stableStringify(item)).join(',')}]`;
        }
        if (value && typeof value === 'object') {
            return `{${Object.keys(value).sort().map((key) => (
                `${JSON.stringify(key)}:${stableStringify(value[key])}`
            )).join(',')}}`;
        }
        return JSON.stringify(value);
    }

    function getSemanticSpecSignature(entry) {
        const sameSpec = getSameSpecPayload(entry);
        const server = normalizeSemanticSpecParameters(sameSpec?.resolved_server_parameters);
        const client = normalizeSemanticSpecParameters(sameSpec?.resolved_client_parameters);
        if (!server || !client) {
            return '';
        }

        const basis = {
            schema_version: String(sameSpec?.schema_version || ''),
            spec_id: String(sameSpec?.spec_id || ''),
            scenario: String(sameSpec?.scenario || ''),
            model: String(sameSpec?.model || ''),
            model_parameters: String(sameSpec?.model_parameters || ''),
            model_precision: String(sameSpec?.model_precision || ''),
            model_quantization: String(sameSpec?.model_quantization || ''),
            hardware_vendor: String(sameSpec?.hardware_vendor || ''),
            hardware_chip_model: String(sameSpec?.hardware_chip_model || ''),
            chip_count: Number.parseInt(sameSpec?.chip_count, 10) || 0,
            node_count: Number.parseInt(sameSpec?.node_count, 10) || 0,
            resolved_server_parameters: server,
            resolved_client_parameters: client,
        };
        return `${TREND_SEMANTIC_SPEC_VERSION}:${stableStringify(basis)}`;
    }

    function getTrendSpecToken(signature) {
        let hash = 2166136261;
        for (const character of String(signature || '')) {
            hash ^= character.codePointAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function getSettingSignature(entry) {
        const semanticSignature = getSemanticSpecSignature(entry);
        if (semanticSignature) {
            return semanticSignature;
        }

        const sameSpec = getSameSpecPayload(entry);
        const sameSpecHash = String(sameSpec?.resolved_spec_hash || '').trim();
        if (sameSpecHash) {
            return `hash:${sameSpecHash}`;
        }

        const sameSpecId = getSameSpecId(entry);
        if (sameSpecId) {
            return `spec:${sameSpecId}`;
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
        if (normalized.startsWith('official-ascend')) {
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

    function getEntryModelIdentity(entry) {
        const payload = entry?.model && typeof entry.model === 'object' ? entry.model : {};
        return {
            canonicalId: String(payload.canonical_id || '').trim(),
            repoId: String(payload.repo_id || '').trim(),
            shortName: String(payload.short_name || '').trim(),
            displayName: String(payload.display_name || '').trim(),
            name: String(payload.name || '').trim(),
        };
    }
    function getEntryModelCanonicalId(entry) {
        return getEntryModelIdentity(entry).canonicalId;
    }

    function getEntryModelRepoId(entry) {
        return getEntryModelIdentity(entry).repoId;
    }

    function getEntryModelShortName(entry) {
        return getEntryModelIdentity(entry).shortName;
    }

    function getEntryModelDisplayName(entry) {
        return getEntryModelIdentity(entry).displayName || 'Unknown model';
    }

    function getEntryQuantization(entry) {
        const value = entry?.model?.quantization;
        const normalized = String(value == null ? '' : value).trim();
        if (!normalized || normalized.toLowerCase() === 'none') {
            return 'none';
        }
        return normalized;
    }

    function formatPrecisionWithQuantization(entry) {
        const precision = entry?.model?.precision || t('unknown');
        const quantization = getEntryQuantization(entry);
        return quantization === 'none' ? precision : `${precision}/${quantization}`;
    }

    function isSuspectEntry(entry) {
        const qualityStatus = String(entry?.quality?.status || '').trim().toLowerCase();
        const status = String(entry?.status || '').trim().toLowerCase();
        const labels = Array.isArray(entry?.labels) ? entry.labels : [];
        return qualityStatus === 'suspect'
            || status === 'suspect'
            || labels.some((label) => String(label || '').trim().toLowerCase() === 'suspect');
    }

    function shouldExcludeFromTrends(entry) {
        return Boolean(entry?.quality?.exclude_from_trends) || isSuspectEntry(entry);
    }

    const SERVING_TREND_WORKLOAD_SUFFIXES = ['online', 'throughput', 'latency'];

    function getServingTrendWorkloadBase(entry) {
        return String(getWorkloadId(entry) || '').replace(/-\d+chip$/, '');
    }

    function isServingTrendWorkload(entry) {
        const workload = getServingTrendWorkloadBase(entry);
        return SERVING_TREND_WORKLOAD_SUFFIXES.some((suffix) => workload.endsWith(`-${suffix}`));
    }

    function getPerformanceTrendEntries(entries, selectedWorkload) {
        return entries.filter((entry) => {
            if (shouldExcludeFromTrends(entry)) {
                return false;
            }
            if (selectedWorkload !== 'all') {
                return true;
            }
            return isServingTrendWorkload(entry);
        });
    }

    function getScopeModelIdentity(scope) {
        return {
            canonicalId: String(scope?.model_canonical_id || '').trim(),
            repoId: String(scope?.model || '').trim(),
            shortName: String(scope?.model_short_name || '').trim(),
            displayName: String(scope?.model_display_name || '').trim(),
            name: String(scope?.model || '').trim(),
        };
    }

    function getScopeModelDisplayName(scope) {
        return getScopeModelIdentity(scope).displayName || 'Unknown model';
    }

    function buildComparableScopeFromEntry(entry) {
        return {
            model: getEntryModelRepoId(entry) || 'unknown-model',
            modelCanonical: getEntryModelCanonicalId(entry),
            modelNormalized: getEntryModelShortName(entry),
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
            const sameSpecId = String(candidate?.same_spec?.spec_id || '').trim();
            if (sameSpecId) {
                return sameSpecId;
            }

            const sameSpecHash = String(candidate?.same_spec?.resolved_spec_hash || '').trim();
            if (sameSpecHash) {
                return sameSpecHash;
            }
        }

        return '';
    }

    function buildComparableScopeFromSnapshot(snapshotPayload) {
        const scope = snapshotPayload?.scope || {};
        const scopeModel = getScopeModelIdentity(scope);
        return {
            model: scopeModel.repoId || scope?.model || 'unknown-model',
            modelCanonical: scopeModel.canonicalId,
            modelNormalized: scopeModel.shortName,
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

        const modelMatches = (left.modelCanonical && right.modelCanonical && left.modelCanonical === right.modelCanonical)
            || left.model === right.model
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

    function shouldHideVersionProvenance(entry) {
        const components = buildTableVersionComponents(entry);
        if (!components.length) {
            return false;
        }

        return components.some((component) => {
            const label = String(component?.label || '').trim().toLowerCase();
            if (label !== 'vllm-hust' && label !== 'vllm-ascend-hust') {
                return false;
            }

            return String(component?.version || '').includes('#');
        });
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

        const versionCompare = compareEntriesByCompositeVersion(a, b);
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
        const model = getEntryModelCanonicalId(entry) || '';
        const precision = entry?.model?.precision || '';
        const quantization = getEntryQuantization(entry);
        const engine = getEngine(entry);
        const baseVersion = getEntryFilterVersionText(entry);
        const settingSignature = getSettingSignature(entry);

        // Try strict aggregation first: require both vllm-hust and vllm-ascend-hust to have valid PEP versions
        const components = buildTableVersionComponents(entry).filter((c) => c?.label && c?.version);
        const hust = components.find((c) => c.label === 'vllm-hust');
        const ascend = components.find((c) => c.label === 'vllm-ascend-hust');
        const isValidPEP = (v) => typeof v === 'string' && /^[0-9]+(\.[0-9]+){0,2}([a-zA-Z0-9._+-]*)?$/.test(v);

        // Only aggregate if both present and both are valid PEP versions
        if (hust && ascend && isValidPEP(hust.rawVersion) && isValidPEP(ascend.rawVersion)) {
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
                quantization,
                hust.rawVersion,
                ascend.rawVersion,
                settingSignature,
            ].join('|');
        }

        // Fallback: use the runtime core/backend revision pair when full PEP
        // version info is missing. Backend PRs can reuse the same core commit,
        // so the plugin commit must stay in the aggregation key.
        const gitCommit = String(entry?.metadata?.git_commit || '').trim();
        const pluginCommit = String(entry?.metadata?.runtime_provenance?.plugin?.commit || '').trim();
        const engineVersion = String(entry?.engine_version || '').trim();
        const versionKey = [gitCommit, pluginCommit].filter(Boolean).join('+')
            || engineVersion
            || '__UNKNOWN_VERSION__';

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
            quantization,
            versionKey,
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
                return compareEntriesByCompositeVersion(a, b);
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
                const modelCompare = getEntryModelDisplayName(a).localeCompare(getEntryModelDisplayName(b));
                if (modelCompare !== 0) {
                    return modelCompare;
                }

                const workloadCompare = getWorkloadId(a).localeCompare(getWorkloadId(b));
                if (workloadCompare !== 0) {
                    return workloadCompare;
                }

                const engineCompare = getEngine(a).localeCompare(getEngine(b));
                if (engineCompare !== 0) {
                    return engineCompare;
                }

                const versionCompare = compareEntriesByCompositeVersion(a, b);
                if (versionCompare !== 0) {
                    return versionCompare;
                }

                return compareByReleaseDateDesc(a, b);
            });
            return sorted;
        }

        sorted.sort((a, b) => {
            const versionCompare = compareEntriesByCompositeVersion(a, b);
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

        const trendable = filtered.filter((entry) => !shouldExcludeFromTrends(entry));
        const trendIndex = new Map(trendable.map((entry, index) => [entry, index]));
        const baseline = trendable[trendable.length - 1];
        return filtered.map((entry) => {
            const index = trendIndex.get(entry);
            if (index == null || !baseline) {
                return { ...entry, trends: {}, baselineTrends: {}, isBaseline: false };
            }
            const prevEntry = trendable[index + 1];
            const trends = prevEntry ? calculateTrends(entry, prevEntry) : {};
            const baselineTrends = (index < trendable.length - 1) ? calculateTrends(entry, baseline) : {};
            const isBaseline = (index === trendable.length - 1);
            return { ...entry, trends, baselineTrends, isBaseline };
        });
    }

    function getTrendMetricConfig(metric) {
        const configs = {
            throughput_tps: {
                key: 'throughput_tps',
                label: t('trendMetricThroughput'),
                unit: 'tok/s',
                higherIsBetter: true,
            },
            ttft_ms: {
                key: 'ttft_ms',
                label: t('trendMetricTTFT'),
                unit: 'ms',
                higherIsBetter: false,
            },
            tbt_ms: {
                key: 'tbt_ms',
                label: t('trendMetricTBT'),
                unit: 'ms',
                higherIsBetter: false,
            },
        };
        return configs[metric] || null;
    }

    function isTrendBaselineEntry(entry) {
        return Boolean(entry?.isBaseline) || getEngine(entry) !== 'vllm-hust';
    }

    function getTrendSeriesKey(entry) {
        const workload = getWorkloadId(entry) || 'Other';
        const model = getEntryModelCanonicalId(entry) || getEntryModelDisplayName(entry) || 'unknown-model';
        const hardware = entry?.hardware?.chip_model || 'unknown-hardware';
        const chipCount = entry?.hardware?.chip_count || 0;
        const nodeCount = entry?.cluster?.node_count || 1;
        const precision = entry?.model?.precision || 'unknown-precision';
        const quantization = getEntryQuantization(entry);
        const settingSignature = getSettingSignature(entry);
        return [workload, model, hardware, chipCount, nodeCount, precision, quantization, settingSignature].join('|');
    }

    function getTrendSeriesLabel(entry) {
        const workload = getWorkloadLabel(getWorkloadId(entry) || 'Other');
        const model = getEntryModelDisplayName(entry) || 'Unknown model';
        const hardware = entry?.hardware?.chip_model || 'Unknown hardware';
        const precision = formatPrecisionWithQuantization(entry);
        return `${workload} · ${model} · ${hardware} · ${precision}`;
    }

    function formatTrendSeriesEvidence(series) {
        const count = series.pointCount;
        if (series.hasBaseline && series.hasCurrent) {
            return t('trendSeriesComparable').replace('{count}', String(count));
        }
        if (series.hasBaseline) {
            return t('trendSeriesBaselineOnly');
        }
        if (count === 1) {
            return t('trendSeriesSinglePoint');
        }
        return t('trendSeriesCurrentHistory').replace('{count}', String(count));
    }

    function getTrendVersionText(entry) {
        return getEntryFilterVersionText(entry) || formatEntryVersion(entry, { display: true });
    }

    function compactTrendLabel(value) {
        const text = String(value || '').trim();
        if (text.length <= 34) {
            return text;
        }
        return `${text.slice(0, 15)}...${text.slice(-14)}`;
    }

    function getTrendVersionSortInfo(entry) {
        const engineVersion = String(entry?.engine_version || '').trim();
        const commitCountMatch = engineVersion.match(/-(\d+)-g[0-9a-f]+$/);
        return {
            commitCount: commitCountMatch ? parseInt(commitCountMatch[1], 10) : null,
            timestamp: getEntryTimestamp(entry) || 0,
        };
    }

    function normalizeTrendCommit(value) {
        return String(value || '').trim().toLowerCase().slice(0, 10);
    }

    function getTrendVersionKey(entry) {
        const coreCommit = normalizeTrendCommit(
            getVersionFieldCommit(entry, 'core') || entry?.metadata?.git_commit
        );
        const backendCommit = normalizeTrendCommit(
            getVersionFieldCommit(entry, 'backend')
                || entry?.metadata?.runtime_provenance?.plugin?.commit
        );
        const version = getTrendVersionText(entry);
        const revision = [coreCommit, backendCommit].filter(Boolean).join('+') || version;
        // A runtime revision is the core/backend pair. Backend PRs often reuse the
        // same core commit and must still receive their own x-axis position.
        return `${isTrendBaselineEntry(entry) ? 'baseline' : 'current'}|${revision}`;
    }

    function getTrendVersionLabel(entry) {
        if (isTrendBaselineEntry(entry)) {
            return `${t('baseline')} ${getTrendVersionText(entry)}`;
        }
        const engine = getEngine(entry);
        const commit = String(entry?.metadata?.git_commit || '').trim().slice(0, 10);
        const engineVersion = String(entry?.engine_version || '').trim();
        const commitCountMatch = engineVersion.match(/-(\d+)-g[0-9a-f]+$/);
        let label;
        if (commitCountMatch) {
            label = `${engine}@${commit}(${commitCountMatch[1]})`;
        } else {
            label = `${engine}@${commit}`;
        }
        // Append plugin engine info (e.g. vllm-ascend-hust) to show both engines on the x-axis
        const pluginEngine = String(entry?.metadata?.runtime_provenance?.plugin?.engine || '').trim();
        const pluginCommit = String(entry?.metadata?.runtime_provenance?.plugin?.commit || '').trim().slice(0, 10);
        if (pluginEngine && pluginCommit) {
            label += ` + ${pluginEngine}@${pluginCommit}`;
        }
        return label;
    }

    function getTrendVersionDetail(entry) {
        const version = getTrendVersionText(entry);
        return isTrendBaselineEntry(entry) ? `${t('baseline')} ${version}` : version;
    }

    function shouldReplaceTrendPoint(currentEntry, candidateEntry, metricConfig) {
        if (!currentEntry) {
            return true;
        }
        const currentValue = getFiniteTrendMetricValue(currentEntry, metricConfig.key);
        const candidateValue = getFiniteTrendMetricValue(candidateEntry, metricConfig.key);
        if (candidateValue === null) {
            return false;
        }
        if (currentValue === null) {
            return true;
        }
        if (candidateValue !== currentValue) {
            return metricConfig.higherIsBetter
                ? candidateValue > currentValue
                : candidateValue < currentValue;
        }
        return getEntryTimestamp(candidateEntry) > getEntryTimestamp(currentEntry);
    }

    function getFiniteTrendMetricValue(entry, metricKey) {
        const rawValue = entry?.metrics?.[metricKey];
        if (rawValue === null || rawValue === undefined || rawValue === '') {
            return null;
        }
        const value = Number(rawValue);
        return Number.isFinite(value) ? value : null;
    }

    function buildTrendChartModel(entries, metricConfig) {
        const versionMap = new Map();
        const seriesMap = new Map();

        // First pass: collect candidate versions from all entries. The default
        // all-workload view is naturally sparse because each revision only
        // covers some workload/model scopes, so the x-axis must be driven by
        // versions that have at least one plotted point rather than the full
        // intersection across every visible series.
        entries.forEach((entry) => {
            const versionKey = getTrendVersionKey(entry);
            const timestamp = getEntryTimestamp(entry);
            const baseline = isTrendBaselineEntry(entry);
            const existingVersion = versionMap.get(versionKey);
            const sortInfo = getTrendVersionSortInfo(entry);
            if (!existingVersion) {
                versionMap.set(versionKey, {
                    key: versionKey,
                    label: getTrendVersionLabel(entry),
                    commitCount: sortInfo.commitCount,
                    timestamp,
                    baseline,
                });
            } else if (!baseline && sortInfo.commitCount !== null
                && (existingVersion.commitCount === null
                    || sortInfo.commitCount > existingVersion.commitCount)) {
                existingVersion.commitCount = sortInfo.commitCount;
                existingVersion.label = getTrendVersionLabel(entry);
                existingVersion.timestamp = Math.max(existingVersion.timestamp, timestamp);
            } else if (!baseline && existingVersion.commitCount === null
                && timestamp > existingVersion.timestamp) {
                existingVersion.label = getTrendVersionLabel(entry);
                existingVersion.timestamp = timestamp;
            } else if (baseline && timestamp > existingVersion.timestamp) {
                existingVersion.timestamp = timestamp;
            }
        });

        // Second pass: populate series data only from entries with valid metric values
        entries.forEach((entry) => {
            const value = getFiniteTrendMetricValue(entry, metricConfig.key);
            if (value === null) {
                return;
            }

            const versionKey = getTrendVersionKey(entry);
            const seriesKey = getTrendSeriesKey(entry);
            if (!seriesMap.has(seriesKey)) {
                const settingSignature = getSettingSignature(entry);
                seriesMap.set(seriesKey, {
                    key: seriesKey,
                    baseLabel: getTrendSeriesLabel(entry),
                    specToken: getTrendSpecToken(settingSignature),
                    workload: getWorkloadLabel(getWorkloadId(entry) || 'Other'),
                    model: getEntryModelDisplayName(entry) || 'Unknown model',
                    hardware: getConfigText(entry).replace('<br><small>', ' ').replace('</small>', ''),
                    precision: formatPrecisionWithQuantization(entry),
                    points: new Map(),
                });
            }
            const series = seriesMap.get(seriesKey);
            const currentPoint = series.points.get(versionKey);
            if (shouldReplaceTrendPoint(currentPoint?.entry, entry, metricConfig)) {
                series.points.set(versionKey, { entry, value });
            }
        });

        const candidateVersions = [...versionMap.values()].sort((left, right) => {
            if (left.baseline !== right.baseline) {
                return left.baseline ? -1 : 1;
            }
            const leftHasCommitCount = left.commitCount !== null;
            const rightHasCommitCount = right.commitCount !== null;
            if (leftHasCommitCount !== rightHasCommitCount) {
                return leftHasCommitCount ? -1 : 1;
            }
            if (leftHasCommitCount && left.commitCount !== right.commitCount) {
                return left.commitCount - right.commitCount;
            }
            if (left.timestamp !== right.timestamp) {
                return left.timestamp - right.timestamp;
            }
            return String(left.label || '').localeCompare(String(right.label || ''));
        });
        const plottedVersionKeys = new Set(
            [...seriesMap.values()].flatMap((item) => [...item.points.keys()])
        );
        const versions = candidateVersions.filter((version) => plottedVersionKeys.has(version.key));
        const versionIndex = new Map(versions.map((version, index) => [version.key, index]));

        const series = [...seriesMap.values()]
            .map((item) => ({
                ...item,
                points: new Map([...item.points].filter(([key]) => plottedVersionKeys.has(key))),
            }))
            .map((item) => ({
                ...item,
                pointCount: item.points.size,
                hasBaseline: [...item.points.values()].some(({ entry }) => isTrendBaselineEntry(entry)),
                hasCurrent: [...item.points.values()].some(({ entry }) => !isTrendBaselineEntry(entry)),
                latestIndex: Math.max(...[...item.points.keys()].map((key) => versionIndex.get(key) ?? -1)),
            }))
            .filter((item) => item.pointCount > 0)
            .sort((left, right) => {
                if (right.pointCount !== left.pointCount) {
                    return right.pointCount - left.pointCount;
                }
                if (right.latestIndex !== left.latestIndex) {
                    return right.latestIndex - left.latestIndex;
                }
                return left.baseLabel.localeCompare(right.baseLabel);
            });

        const labelCounts = new Map();
        series.forEach((item) => {
            labelCounts.set(item.baseLabel, (labelCounts.get(item.baseLabel) || 0) + 1);
        });
        series.forEach((item) => {
            item.hasDuplicateLabel = labelCounts.get(item.baseLabel) > 1;
            item.configurationLabel = item.hasDuplicateLabel
                ? t('trendSeriesConfig').replace('{token}', item.specToken)
                : '';
            item.label = item.hasDuplicateLabel
                ? `${item.baseLabel} · ${item.configurationLabel}`
                : item.baseLabel;
            item.evidenceLabel = formatTrendSeriesEvidence(item);
        });

        return { versions, series };
    }

    function getTrendColors(index) {
        const palette = [
            '#38bdf8', '#86efac', '#fbbf24', '#f472b6',
            '#a78bfa', '#22d3ee', '#fb7185', '#c4b5fd',
            '#34d399', '#f97316', '#60a5fa', '#e879f9',
        ];
        const color = palette[index % palette.length];
        return {
            borderColor: color,
            backgroundColor: color,
        };
    }

    function getTrendPointDetails(entry) {
        return {
            version: getTrendVersionDetail(entry),
            date: getEntryDateLabel(entry) || '-',
            workload: getWorkloadLabel(getWorkloadId(entry) || 'Other'),
            precision: formatPrecisionWithQuantization(entry),
            engine: getEngineLabel(getEngine(entry)),
            model: getEntryModelDisplayName(entry),
            hardware: getConfigText(entry).replace('<br><small>', ' ').replace('</small>', ''),
            setting: getSettingSummary(entry),
        };
    }

    function makeUniqueTrendLabels(labels) {
        const counts = new Map();
        return labels.map((label) => {
            const text = String(label || '');
            const count = (counts.get(text) || 0) + 1;
            counts.set(text, count);
            return count === 1 ? text : `${text} · ${count}`;
        });
    }


    function isMissingTrendValue(value) {
        return value === null || value === undefined || value === '';
    }

    function getTrendAxisValues(datasets) {
        return datasets
            .flatMap((dataset) => dataset.data || [])
            .filter((value) => !isMissingTrendValue(value) && Number.isFinite(Number(value)))
            .map(Number);
    }

    const BROKEN_TREND_AXIS_RATIO_THRESHOLD = 8;
    const BROKEN_TREND_AXIS_MEDIAN_MULTIPLIER = 3;
    const BROKEN_TREND_AXIS_HIGH_SEGMENT_MULTIPLIER = 1.25;

    function getSortedPositiveTrendValues(datasets) {
        return getTrendAxisValues(datasets)
            .filter((value) => value > 0)
            .sort((left, right) => left - right);
    }

    function getTrendMedian(values) {
        if (!values.length) {
            return 0;
        }
        const middle = Math.floor(values.length / 2);
        return values.length % 2 === 0
            ? (values[middle - 1] + values[middle]) / 2
            : values[middle];
    }

    function getBrokenTrendAxisConfig(metricConfig, datasets) {
        if (state.trendAxisScale !== 'auto' || metricConfig.key !== 'throughput_tps') {
            return null;
        }
        const values = getSortedPositiveTrendValues(datasets);
        if (values.length < 4) {
            return null;
        }
        const median = getTrendMedian(values);
        const max = values[values.length - 1];
        if (!median || max / median < BROKEN_TREND_AXIS_RATIO_THRESHOLD) {
            return null;
        }

        const lowMax = median * BROKEN_TREND_AXIS_MEDIAN_MULTIPLIER;
        const highValues = values.filter((value) => value > lowMax);
        const lowValues = values.filter((value) => value <= lowMax);
        if (lowValues.length < 2 || highValues.length < 1) {
            return null;
        }

        const highMin = Math.min(...highValues);
        const highMax = Math.max(...highValues);
        if (highMax <= highMin) {
            return null;
        }
        const highDisplayMin = lowMax * 1.18;
        const highDisplayMax = lowMax * BROKEN_TREND_AXIS_HIGH_SEGMENT_MULTIPLIER * 2;
        return {
            lowMax,
            highMin,
            highMax,
            highDisplayMin,
            highDisplayMax,
            min: 0,
            max: highDisplayMax * 1.08,
        };
    }

    function mapBrokenTrendAxisValue(value, axisConfig) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return null;
        }
        if (!axisConfig || number <= axisConfig.lowMax) {
            return number;
        }
        const sourceRange = axisConfig.highMax - axisConfig.highMin;
        const displayRange = axisConfig.highDisplayMax - axisConfig.highDisplayMin;
        if (sourceRange <= 0 || displayRange <= 0) {
            return number;
        }
        const ratio = Math.max(0, Math.min(1, (number - axisConfig.highMin) / sourceRange));
        return axisConfig.highDisplayMin + ratio * displayRange;
    }

    function unmapBrokenTrendAxisValue(value, axisConfig) {
        const number = Number(value);
        if (!Number.isFinite(number) || !axisConfig || number <= axisConfig.lowMax) {
            return number;
        }
        if (number < axisConfig.highDisplayMin) {
            return null;
        }
        const displayRange = axisConfig.highDisplayMax - axisConfig.highDisplayMin;
        const sourceRange = axisConfig.highMax - axisConfig.highMin;
        if (displayRange <= 0 || sourceRange <= 0) {
            return number;
        }
        const ratio = Math.max(0, Math.min(1, (number - axisConfig.highDisplayMin) / displayRange));
        return axisConfig.highMin + ratio * sourceRange;
    }

    const brokenTrendAxisPlugin = {
        id: 'brokenTrendAxis',
        afterDraw(chart, _args, options) {
            const axisConfig = options?.axisConfig;
            const yScale = chart.scales?.y;
            const area = chart.chartArea;
            if (!axisConfig || !yScale || !area) {
                return;
            }
            const gapMiddle = (axisConfig.lowMax + axisConfig.highDisplayMin) / 2;
            const y = yScale.getPixelForValue(gapMiddle);
            const ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = 'rgba(71, 85, 105, 0.76)';
            ctx.lineWidth = 2;
            const left = area.left - 10;
            const right = area.left + 18;
            ctx.beginPath();
            ctx.moveTo(left, y + 8);
            ctx.lineTo(left + 10, y - 8);
            ctx.moveTo(left + 12, y + 8);
            ctx.lineTo(right, y - 8);
            ctx.stroke();
            ctx.fillStyle = 'rgba(71, 85, 105, 0.82)';
            ctx.font = '600 11px Inter, sans-serif';
            ctx.fillText(t('trendAxisBreak'), area.left + 8, y - 10);
            ctx.restore();
        },
    };

    function shouldUseLogTrendAxis() {
        return state.trendAxisScale === 'log';
    }

    function getLogTrendAxisBounds(datasets) {
        const values = getTrendAxisValues(datasets).filter((value) => value > 0);
        if (!values.length) {
            return {};
        }
        const min = Math.min(...values);
        const max = Math.max(...values);
        return {
            min: Math.max(min * 0.65, Number.MIN_VALUE),
            max: max * 1.18,
        };
    }

    function formatTrendSeriesSummary(visible, total) {
        return t('trendSeriesSummary')
            .replace('{visible}', String(visible))
            .replace('{total}', String(total));
    }

    function updateTrendSeriesSummary() {
        const summary = document.getElementById('leaderboard-trend-series-summary');
        if (!summary) {
            return;
        }
        const total = state.trendSeries.length;
        const visible = state.trendSeries.filter((series) => !state.hiddenTrendSeries.has(series.key)).length;
        summary.textContent = formatTrendSeriesSummary(visible, total);
    }

    function filterTrendSeriesList() {
        const input = document.getElementById('trend-series-search');
        const empty = document.getElementById('trend-series-empty');
        const query = String(input?.value || '').trim().toLocaleLowerCase();
        let matches = 0;
        document.querySelectorAll('.trend-series-item').forEach((item) => {
            const match = !query || String(item.dataset.search || '').includes(query);
            item.hidden = !match;
            if (match) {
                matches += 1;
            }
        });
        if (empty) {
            empty.hidden = matches > 0;
        }
    }

    function renderTrendSeriesControl(series) {
        state.trendSeries = series;
        const list = document.getElementById('trend-series-list');
        const panel = document.getElementById('trend-series-panel');
        const toggle = document.getElementById('toggle-trend-series');
        const hint = document.getElementById('leaderboard-trend-series-hint');
        const searchLabel = document.getElementById('trend-series-search-label');
        const search = document.getElementById('trend-series-search');
        const showAll = document.getElementById('trend-series-show-all');
        const hideAll = document.getElementById('trend-series-hide-all');
        const empty = document.getElementById('trend-series-empty');
        if (!list || !panel || !toggle) {
            return;
        }

        toggle.textContent = t('trendSeriesButton');
        toggle.setAttribute('aria-expanded', state.trendSeriesExpanded ? 'true' : 'false');
        panel.hidden = !state.trendSeriesExpanded;
        if (hint) hint.textContent = t('trendSeriesHint');
        if (searchLabel) searchLabel.textContent = t('trendSeriesSearch');
        if (search) search.placeholder = t('trendSeriesSearch');
        if (showAll) showAll.textContent = t('trendSeriesShowAll');
        if (hideAll) hideAll.textContent = t('trendSeriesHideAll');
        if (empty) empty.textContent = t('trendSeriesEmpty');

        list.replaceChildren();
        series.forEach((item, index) => {
            const colors = getTrendColors(index);
            const label = document.createElement('label');
            label.className = 'trend-series-item';
            label.dataset.seriesKey = item.key;
            label.dataset.search = [
                item.label,
                item.workload,
                item.model,
                item.hardware,
                item.precision,
                item.evidenceLabel,
                item.configurationLabel,
            ]
                .join(' ')
                .toLocaleLowerCase();

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !state.hiddenTrendSeries.has(item.key);
            checkbox.dataset.seriesKey = item.key;

            const swatch = document.createElement('span');
            swatch.className = 'trend-series-swatch';
            swatch.style.setProperty('--series-color', colors.borderColor);
            swatch.setAttribute('aria-hidden', 'true');

            const copy = document.createElement('span');
            copy.className = 'trend-series-copy';
            const title = document.createElement('strong');
            title.textContent = item.workload;
            const meta = document.createElement('small');
            meta.textContent = `${item.model} · ${item.hardware} · ${item.precision}`;
            const evidence = document.createElement('small');
            evidence.className = 'trend-series-evidence';
            evidence.textContent = [item.evidenceLabel, item.configurationLabel].filter(Boolean).join(' · ');
            copy.append(title, meta, evidence);
            label.append(checkbox, swatch, copy);
            list.append(label);
        });
        updateTrendSeriesSummary();
        filterTrendSeriesList();
    }

    function setTrendSeriesVisibility(seriesKey, visible, updateImmediately = true) {
        if (visible) {
            state.hiddenTrendSeries.delete(seriesKey);
        } else {
            state.hiddenTrendSeries.add(seriesKey);
        }
        const datasetIndex = state.trendChart?.data?.datasets?.findIndex(
            (dataset) => dataset.seriesKey === seriesKey
        );
        if (Number.isInteger(datasetIndex) && datasetIndex >= 0) {
            state.trendChart.setDatasetVisibility(datasetIndex, visible);
            if (updateImmediately) {
                state.trendChart.update();
            }
        }
        if (updateImmediately) {
            updateTrendSeriesSummary();
        }
    }

    function renderPerformanceTrendChart(entries) {
        const panel = document.getElementById('leaderboard-trend-panel');
        const canvas = document.getElementById('leaderboard-trend-chart');
        const empty = document.getElementById('leaderboard-trend-empty');
        if (!panel || !canvas || !empty) {
            return;
        }

        const metricConfig = getTrendMetricConfig(state.chartMetric) || getTrendMetricConfig('throughput_tps');
        state.chartMetric = metricConfig.key;

        const labelEl = document.getElementById('leaderboard-trend-label');
        const titleEl = document.getElementById('leaderboard-trend-title');
        const subtitleEl = document.getElementById('leaderboard-trend-subtitle');
        if (labelEl) labelEl.textContent = t('trendLabel');
        if (titleEl) titleEl.textContent = t('trendTitle');
        if (subtitleEl) subtitleEl.textContent = t('trendSubtitle');
        const axisLabelEl = document.getElementById('leaderboard-trend-axis-label');
        if (axisLabelEl) axisLabelEl.textContent = t('trendAxisLabel');
        empty.textContent = t('trendEmpty');

        document.querySelectorAll('[data-trend-metric]').forEach((button) => {
            const metric = button.dataset.trendMetric;
            const buttonConfig = getTrendMetricConfig(metric);
            if (buttonConfig) {
                button.textContent = buttonConfig.label;
            }
            button.classList.toggle('active', metric === metricConfig.key);
            button.setAttribute('aria-pressed', metric === metricConfig.key ? 'true' : 'false');
        });
        const axisLabels = {
            auto: t('trendAxisAuto'),
            log: t('trendAxisLog'),
            linear: t('trendAxisLinear'),
        };
        document.querySelectorAll('[data-trend-axis]').forEach((button) => {
            const axis = button.dataset.trendAxis;
            if (axisLabels[axis]) {
                button.textContent = axisLabels[axis];
            }
            button.classList.toggle('active', axis === state.trendAxisScale);
            button.setAttribute('aria-pressed', axis === state.trendAxisScale ? 'true' : 'false');
        });

        if (typeof Chart === 'undefined') {
            if (state.trendChart) {
                state.trendChart.destroy();
                state.trendChart = null;
            }
            empty.style.display = 'flex';
            canvas.style.display = 'none';
            renderTrendSeriesControl([]);
            return;
        }

        const model = buildTrendChartModel(entries, metricConfig);
        if (model.versions.length < 1 || model.series.length < 1) {
            if (state.trendChart) {
                state.trendChart.destroy();
                state.trendChart = null;
            }
            empty.style.display = 'flex';
            canvas.style.display = 'none';
            renderTrendSeriesControl([]);
            return;
        }

        empty.style.display = 'none';
        canvas.style.display = 'block';

        const labels = makeUniqueTrendLabels(model.versions.map((version) => version.label));
        let datasets = model.series.map((series, index) => {
            const colors = getTrendColors(index);
            const pointDetails = model.versions.map((version) => {
                const point = series.points.get(version.key);
                return point ? getTrendPointDetails(point.entry) : null;
            });
            return {
                label: series.label,
                seriesKey: series.key,
                data: model.versions.map((version) => series.points.get(version.key)?.value ?? null),
                pointDetails,
                borderColor: colors.borderColor,
                backgroundColor: colors.backgroundColor,
                borderWidth: 2,
                pointRadius: series.pointCount === 1 ? 5 : 3,
                pointHoverRadius: 6,
                tension: 0.28,
                showLine: series.pointCount > 1,
                // Keep one series continuous across x-axis slots where other
                // workload/model scopes have data but this series does not.
                spanGaps: true,
                hidden: state.hiddenTrendSeries.has(series.key),
            };
        });

        const brokenYAxisConfig = getBrokenTrendAxisConfig(metricConfig, datasets);
        const useLogYAxis = shouldUseLogTrendAxis();
        const yAxisBounds = useLogYAxis
            ? getLogTrendAxisBounds(datasets)
            : (brokenYAxisConfig || {});
        if (useLogYAxis || brokenYAxisConfig) {
            datasets = datasets.map((dataset) => ({
                ...dataset,
                tension: brokenYAxisConfig ? 0 : dataset.tension,
                rawData: dataset.data,
                data: dataset.data.map((value) => {
                    if (isMissingTrendValue(value)) {
                        return null;
                    }
                    const number = Number(value);
                    if (!Number.isFinite(number) || (useLogYAxis && number <= 0)) {
                        return null;
                    }
                    return brokenYAxisConfig ? mapBrokenTrendAxisValue(number, brokenYAxisConfig) : number;
                }),
                brokenAxisData: dataset.data.map((value) => {
                    if (isMissingTrendValue(value)) {
                        return false;
                    }
                    const number = Number(value);
                    return Boolean(brokenYAxisConfig && Number.isFinite(number) && number > brokenYAxisConfig.lowMax);
                }),
            }));
        }

        if (state.trendChart) {
            state.trendChart.destroy();
        }

        state.trendChart = new Chart(canvas, {
            type: 'line',
            plugins: brokenYAxisConfig ? [brokenTrendAxisPlugin] : [],
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    intersect: false,
                },
                plugins: {
                    brokenTrendAxis: {
                        axisConfig: brokenYAxisConfig,
                    },
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        backgroundColor: 'rgba(2, 6, 23, 0.94)',
                        titleColor: '#ffffff',
                        bodyColor: '#eaf6ff',
                        borderColor: 'rgba(125, 211, 252, 0.42)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            title(items) {
                                const item = items[0];
                                return item ? String(item.label || '') : '';
                            },
                            label(context) {
                                const sourceValue = context.dataset.rawData?.[context.dataIndex];
                                const rawValue = isMissingTrendValue(sourceValue) ? NaN : Number(sourceValue);
                                const formatted = Number.isFinite(rawValue) ? formatNumber(rawValue) : '-';
                                const suffix = context.dataset.brokenAxisData?.[context.dataIndex]
                                    ? ` (${t('trendTooltipBrokenAxis')})`
                                    : '';
                                return `${context.dataset.label}: ${formatted} ${metricConfig.unit}${suffix}`;
                            },
                            afterLabel(context) {
                                const details = context.dataset.pointDetails?.[context.dataIndex];
                                if (!details) {
                                    return [];
                                }
                                const extra = [];
                                if (context.dataset.brokenAxisData?.[context.dataIndex]) {
                                    const sourceValue = context.dataset.rawData?.[context.dataIndex];
                                    const rawValue = isMissingTrendValue(sourceValue) ? NaN : Number(sourceValue);
                                    if (Number.isFinite(rawValue)) {
                                        extra.push(`${t('trendTooltipActualValue')}: ${formatNumber(rawValue)} ${metricConfig.unit}`);
                                    }
                                }
                                return [
                                    ...extra,
                                    `${t('trendTooltipVersion')}: ${details.version}`,
                                    `${t('trendTooltipDate')}: ${details.date}`,
                                    `${t('trendTooltipWorkload')}: ${details.workload}`,
                                    `${t('trendTooltipPrecision')}: ${details.precision}`,
                                    `${t('trendTooltipEngine')}: ${details.engine}`,
                                    `${t('trendTooltipModel')}: ${details.model}`,
                                    `${t('trendTooltipHardware')}: ${details.hardware}`,
                                    `${t('trendTooltipSetting')}: ${details.setting}`,
                                ];
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#52615f',
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                        },
                        grid: {
                            color: 'rgba(82, 97, 95, 0.16)',
                        },
                    },
                    y: {
                        type: useLogYAxis ? 'logarithmic' : 'linear',
                        min: yAxisBounds.min,
                        max: yAxisBounds.max,
                        ticks: {
                            color: '#52615f',
                            callback(value) {
                                const axisValue = brokenYAxisConfig ? unmapBrokenTrendAxisValue(value, brokenYAxisConfig) : Number(value);
                                return Number.isFinite(axisValue) ? formatNumber(axisValue) : '⋯';
                            },
                        },
                        title: {
                            display: true,
                            text: `${metricConfig.label} (${metricConfig.unit})`,
                            color: '#25312f',
                        },
                        grid: {
                            color: 'rgba(82, 97, 95, 0.16)',
                        },
                    },
                },
            },
        });
        renderTrendSeriesControl(model.series);
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
                    state.pagination[state.currentTab].page = 1; // Reset to first page on filter change
                    renderTable();
                });
            }
        });

        // Reset all filters button
        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                state.filters[state.currentTab] = {
                    engine: 'all', hardware: 'all', model: 'all',
                    version: 'all', workload: 'all', precision: 'all'
                };
                state.pagination[state.currentTab].page = 1;
                renderFilters();
                renderTable();
            });
        }

        const tableDetailsBtn = document.getElementById('toggle-table-details');
        if (tableDetailsBtn) {
            tableDetailsBtn.addEventListener('click', () => {
                state.tableDetailsExpanded = !state.tableDetailsExpanded;
                updateTableDetailsToggle();
            });
        }

        document.querySelectorAll('[data-trend-metric]').forEach((button) => {
            button.addEventListener('click', () => {
                const metric = button.dataset.trendMetric;
                if (!getTrendMetricConfig(metric)) {
                    return;
                }
                state.chartMetric = metric;
                renderTable();
            });
        });
        document.querySelectorAll('[data-trend-axis]').forEach((button) => {
            button.addEventListener('click', () => {
                const axis = button.dataset.trendAxis;
                if (!['auto', 'log', 'linear'].includes(axis)) {
                    return;
                }
                state.trendAxisScale = axis;
                renderTable();
            });
        });

        const trendSeriesToggle = document.getElementById('toggle-trend-series');
        if (trendSeriesToggle) {
            trendSeriesToggle.addEventListener('click', () => {
                state.trendSeriesExpanded = !state.trendSeriesExpanded;
                const panel = document.getElementById('trend-series-panel');
                trendSeriesToggle.setAttribute('aria-expanded', state.trendSeriesExpanded ? 'true' : 'false');
                if (panel) {
                    panel.hidden = !state.trendSeriesExpanded;
                }
            });
        }
        const trendSeriesSearch = document.getElementById('trend-series-search');
        if (trendSeriesSearch) {
            trendSeriesSearch.addEventListener('input', filterTrendSeriesList);
        }
        const trendSeriesList = document.getElementById('trend-series-list');
        if (trendSeriesList) {
            trendSeriesList.addEventListener('change', (event) => {
                const checkbox = event.target.closest('input[data-series-key]');
                if (!checkbox) {
                    return;
                }
                setTrendSeriesVisibility(checkbox.dataset.seriesKey, checkbox.checked);
            });
        }
        ['show', 'hide'].forEach((action) => {
            const button = document.getElementById(`trend-series-${action}-all`);
            if (!button) {
                return;
            }
            button.addEventListener('click', () => {
                const visible = action === 'show';
                state.trendSeries.forEach((series) => {
                    setTrendSeriesVisibility(series.key, visible, false);
                });
                document.querySelectorAll('#trend-series-list input[data-series-key]').forEach((checkbox) => {
                    checkbox.checked = visible;
                });
                state.trendChart?.update();
                updateTrendSeriesSummary();
            });
        });

        // Sortable column headers: click to sort, click again to toggle direction
        const SORTABLE_HEADER_MAP = {
            'table-head-ttft': 'ttft_ms',
            'table-head-tbt': 'tbt_ms',
            'table-head-tps': 'throughput_tps',
            'table-head-error': 'error_rate',
        };
        Object.entries(SORTABLE_HEADER_MAP).forEach(([headId, col]) => {
            const th = document.getElementById(headId);
            if (!th) return;
            th.classList.add('sortable-header');
            th.setAttribute('tabindex', '0');
            th.setAttribute('role', 'columnheader');
            th.setAttribute('aria-sort', 'none');
            function activateSort() {
                const sortState = state.sort[state.currentTab];
                if (sortState.column === col) {
                    // Three-state cycle per column: firstDir → secondDir → unsorted
                    // throughput_tps (higher-is-better): desc → asc → unsorted
                    // others (lower-is-better):           asc  → desc → unsorted
                    const firstDir = col === 'throughput_tps' ? 'desc' : 'asc';
                    const secondDir = firstDir === 'desc' ? 'asc' : 'desc';
                    if (sortState.direction === secondDir) {
                        // Third click: clear sort
                        sortState.column = null;
                        sortState.direction = 'asc';
                    } else {
                        // Second click: flip to opposite direction
                        sortState.direction = secondDir;
                    }
                } else {
                    sortState.column = col;
                    // Default: lower-is-better → asc first; higher-is-better → desc first
                    sortState.direction = col === 'throughput_tps' ? 'desc' : 'asc';
                }
                state.pagination[state.currentTab].page = 1;
                renderTable();
            }
            th.addEventListener('click', activateSort);
            th.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activateSort();
                }
            });
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

    function updateTableDetailsToggle() {
        const details = document.getElementById('leaderboard-table-details');
        const button = document.getElementById('toggle-table-details');
        const expanded = Boolean(state.tableDetailsExpanded);
        if (details) {
            details.classList.toggle('is-collapsed', !expanded);
            details.hidden = !expanded;
        }
        if (button) {
            button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            button.textContent = expanded ? t('hideTableDetails') : t('showTableDetails');
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

        // Reset pagination and sort when switching tabs
        state.pagination[tab].page = 1;
        state.sort[tab].column = null;
        state.sort[tab].direction = 'asc';

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

        // Update reset button label for current language
        const resetLabel = document.getElementById('btn-reset-filters-label');
        if (resetLabel) { resetLabel.textContent = t('resetFilters'); }

        // Extract unique values
        const engineOptions = getUniqueValues(data, d => getEngine(d));
        const hardwareOptions = getUniqueValues(data, d => d.hardware.chip_model);
        const modelOptionsMap = new Map();
        data.forEach((entry) => {
            const value = getEntryModelCanonicalId(entry);
            if (!value || modelOptionsMap.has(value)) {
                return;
            }
            modelOptionsMap.set(value, {
                value,
                label: getEntryModelDisplayName(entry),
            });
        });
        const modelOptions = [...modelOptionsMap.values()].sort((left, right) => left.label.localeCompare(right.label));
        const versionOptions = getVersionOptions(data);
        const dynamicWorkloads = getUniqueValues(data, d => getWorkloadId(d)).sort((a, b) => a.localeCompare(b));
        const workloadOptions = ['all', ...dynamicWorkloads];
        const precisionOptions = getUniqueValues(data, d => d.model.precision);

        // Update dropdowns
        updateSelect('filter-engine', ['all', ...engineOptions], filters.engine, getEngineLabel);
        updateSelect('filter-hardware', ['all', ...hardwareOptions], filters.hardware);
        updateSelect('filter-model', ['all', ...modelOptions], filters.model, (value, option) => option?.label || value);
        updateSelect('filter-version', ['all', ...versionOptions], filters.version);
        updateSelect('filter-workload', workloadOptions, filters.workload, getWorkloadLabel);
        updateSelect('filter-precision', ['all', ...precisionOptions], filters.precision);
    }

    function getVersionOptions(data) {
        const optionMap = new Map();
        data.forEach((entry) => {
            const label = getEntryFilterVersionText(entry);
            if (!label || optionMap.has(label)) {
                return;
            }

            optionMap.set(label, {
                label,
                parts: getEntryFilterVersionParts(entry),
            });
        });

        return [...optionMap.values()]
            .sort(compareVersionFilterOptions)
            .map((option) => option.label);
    }

    function getUniqueValues(data, accessor) {
        // 删除 'all'，只返回唯一值
        return [...new Set(data.map(accessor).filter(Boolean))];
    }

    function getSelectOptionLabel(value, option, labelMapper = null) {
        if (value === 'all') {
            return getWorkloadLabel('all');
        }

        if (labelMapper) {
            return labelMapper(value, option);
        }

        if (option && typeof option === 'object' && !Array.isArray(option)) {
            return String(option.label ?? value);
        }

        return value;
    }

    function normalizeSelectOption(option, labelMapper = null) {
        if (option && typeof option === 'object' && !Array.isArray(option)) {
            const value = String(option.value ?? '');
            return {
                value,
                label: getSelectOptionLabel(value, option, labelMapper),
            };
        }

        const value = String(option);
        return {
            value,
            label: getSelectOptionLabel(value, option, labelMapper),
        };
    }

    function updateSelect(id, options, selectedValue, labelMapper = null) {
        const select = document.getElementById(id);
        if (!select) return;

        const normalizedOptions = options.map((option) => normalizeSelectOption(option, labelMapper));

        select.innerHTML = normalizedOptions.map(opt =>
            `<option value="${opt.value}" ${opt.value === selectedValue ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        if (selectedValue && normalizedOptions.some((option) => option.value === selectedValue)) {
            select.value = selectedValue;
        } else if (normalizedOptions.some((option) => option.value === 'all')) {
            select.value = 'all';
            state.filters[state.currentTab][id.replace('filter-', '')] = 'all';
        }
    }

    // Render leaderboard table
    function renderTable() {
        const tbody = document.getElementById('leaderboard-tbody');
        const emptyState = document.getElementById('empty-state');
        const modelHeader = document.getElementById('table-head-model');

        if (!tbody) return;
        if (modelHeader) {
            modelHeader.textContent = t('modelColumn');
        }

        const data = getDataByTab(state.currentTab);
        const filters = state.filters[state.currentTab];
        const viewOptions = state.viewOptions[state.currentTab];

        // Apply filters
        const filtered = data.filter(entry => {
            const workload = getWorkloadId(entry);
            return (filters.engine === 'all' || getEngine(entry) === filters.engine) &&
                (filters.hardware === 'all' || entry.hardware.chip_model === filters.hardware) &&
                (filters.model === 'all' || getEntryModelCanonicalId(entry) === filters.model) &&
                matchesVersionFilter(entry, filters.version) &&
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
            renderPerformanceTrendChart([]);
            renderPagination(0, 0); // clear any stale pagination controls
            renderSortHeaders();   // clear stale sort indicators on empty tab
            return;
        }

        emptyState.style.display = 'none';
        renderDataStats(data.length, filtered.length, visibleEntries.length, mergedEntries.length, comparisonView);
        renderOverview(sortedFiltered, comparisonView, viewOptions);
        // The table intentionally collapses equivalent package builds. The trend chart must use
        // the unaggregated rows so distinct commits and PR revisions remain visible on the axis.
        renderPerformanceTrendChart(getPerformanceTrendEntries(visibleEntries, filters.workload));

        const withTrends = buildTrendRows(sortedFiltered, filters.workload);

        // Apply column sort if active (after trend computation so arrows are preserved)
        const sortState = state.sort[state.currentTab];
        const displayRows = sortState.column
            ? applyColumnSort(withTrends, sortState)
            : withTrends;

        // Pagination
        const pagination = state.pagination[state.currentTab];
        const totalItems = displayRows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pagination.pageSize));
        if (pagination.page > totalPages) { pagination.page = totalPages; }
        const startIdx = (pagination.page - 1) * pagination.pageSize;
        const pageRows = displayRows.slice(startIdx, startIdx + pagination.pageSize);

        // Render rows
        const showVersionAllParam = typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).get('showVersionAll') === '1';
        const showVersionForEveryRow = showVersionAllParam
            || Boolean(sortState.column)
            || filters.version !== 'all';
        const rowSpanInfo = buildVersionRowSpanInfo(pageRows, {
            showVersionAll: showVersionAllParam,
            forceEveryRow: showVersionForEveryRow,
            expandedRows: state.expandedRows,
        });

        tbody.innerHTML = pageRows.map((entry, index) => {
            // Only the first item of the first page (in default sort) carries the "Latest" badge
            const isLatest = !sortState.column && pagination.page === 1 && index === 0;
            const isExpanded = state.expandedRows.has(entry.entry_id);
            const rowSpan = rowSpanInfo.get(entry.entry_id) || { showVersion: true, span: 1 };
            const isSparse = comparisonView.incompleteKeys.has(createCompareScopeKey(entry));

            return `
                ${renderDataRow(entry, isLatest, isExpanded, rowSpan.showVersion, isSparse, rowSpan.span)}
                ${isExpanded ? renderDetailsRow(entry, isExpanded) : ''}
            `;
        }).join('');

        // Update sort header indicators
        renderSortHeaders();

        // Render pagination controls
        renderPagination(totalItems, totalPages);

        // Attach event listeners for buttons
        attachRowEventListeners();
    }

    function buildVersionRowSpanInfo(entries, options = {}) {
        const showVersionForEveryRow = Boolean(options.showVersionAll || options.forceEveryRow);
        const expandedRows = options.expandedRows instanceof Set ? options.expandedRows : new Set();
        const info = new Map();
        let index = 0;

        while (index < entries.length) {
            const entry = entries[index];
            const key = getTableVersionRowSpanKey(entry);
            let span = 1;

            if (!showVersionForEveryRow) {
                while (
                    index + span < entries.length
                    && getTableVersionRowSpanKey(entries[index + span]) === key
                ) {
                    span += 1;
                }
            }

            const groupHasExpandedRow = entries
                .slice(index, index + span)
                .some((groupEntry) => expandedRows.has(groupEntry.entry_id));

            if (groupHasExpandedRow) {
                for (let offset = 0; offset < span; offset += 1) {
                    info.set(entries[index + offset].entry_id, { showVersion: true, span: 1 });
                }
                index += span;
                continue;
            }

            info.set(entry.entry_id, { showVersion: true, span });
            for (let offset = 1; offset < span; offset += 1) {
                info.set(entries[index + offset].entry_id, { showVersion: false, span: 0 });
            }
            index += span;
        }

        return info;
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
        const loadingMoreText = state.loadingMore ? ` • ${t('statsLoadingMore')}` : '';
        statsEl.textContent = `${t('statsLoaded')} ${state.totalLoadedEntries} • ${state.currentTab}: ${tabTotal} • ${t('statsMatched')} ${rawFilteredTotal} ${t('statsBuildEntries')} • ${t('statsShowing')} ${mergedTotal} ${t('statsComparisonRows')} ${comparisonView.activeCoverage.completeGroupCount} ${t('statsCompleteGroups')}${hiddenText}${sourceText}${loadingMoreText}`;
    }

    function shouldLockOverviewScope(comparisonView) {
        const focusedEntries = Array.isArray(comparisonView?.focusGroup?.entries)
            ? comparisonView.focusGroup.entries.filter(Boolean)
            : [];
        if (focusedEntries.length) {
            return true;
        }

        const activeGroups = Array.isArray(comparisonView?.activeGroups)
            ? comparisonView.activeGroups
            : [];
        const completeGroups = activeGroups.filter((group) => group?.isComplete);
        return completeGroups.length === 1;
    }

    function getSingleCompleteOverviewGroup(comparisonView) {
        const activeGroups = Array.isArray(comparisonView?.activeGroups)
            ? comparisonView.activeGroups
            : [];
        const completeGroups = activeGroups.filter((group) => group?.isComplete);
        return completeGroups.length === 1 ? completeGroups[0] : null;
    }

    function getOverviewAggregateScopeText(comparisonView) {
        const completeGroupCount = Number(comparisonView?.activeCoverage?.completeGroupCount || 0);
        if (completeGroupCount > 0) {
            return `${completeGroupCount} ${t('completeCompareGroups')}`;
        }
        return t('compareNoData');
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

        const goalPair = findGoalProgressPair(entries, comparisonView);
        const compareSnapshotGroup = findCompareSnapshotGroup(entries, comparisonView);
        const overviewScopeLocked = shouldLockOverviewScope(comparisonView);
        const alignmentPayload = overviewScopeLocked ? (goalPair || compareSnapshotGroup) : null;
        const representativeGroup = overviewScopeLocked
            ? null
            : selectOverviewRepresentativeGroup(comparisonView);
        const representativeEntries = representativeGroup
            ? [...representativeGroup.entries]
            : getOverviewRepresentativeEntries(entries, comparisonView, alignmentPayload);
        const summaries = summarizeEngines(entries, representativeEntries, {
            aggregateScopeText: representativeGroup?.summaryLabel || getOverviewAggregateScopeText(comparisonView),
        });
        const leaders = getLeaders(summaries);
        const title = overviewScopeLocked && goalPair
            ? getGoalProgressTitle(goalPair)
            : getOverviewTitle(summaries, leaders, comparisonView);
        const subtitle = overviewScopeLocked && goalPair
            ? getGoalProgressSubtitle(goalPair)
            : getOverviewSubtitle(entries, summaries.length, comparisonView, viewOptions);
        const badges = getOverviewBadges(entries, summaries.length, leaders, comparisonView);
        const heroSectionLabel = getOverviewHeroSectionLabel(
            overviewScopeLocked ? goalPair : null,
            overviewScopeLocked ? compareSnapshotGroup : null,
        );
        const overviewGridNote = representativeEntries.length
            ? t('overviewGridNoteAligned')
            : summaries.some((summary) => summary.aggregateOnly)
                ? t('overviewGridNoteScopedOnly')
                : t('overviewGridNote');
        const headToHeadHtml = overviewScopeLocked
            ? (goalPair
                ? renderGoalProgressPair(goalPair)
                : compareSnapshotGroup
                    ? renderHeadToHeadFromSnapshot(compareSnapshotGroup)
                    : renderHeadToHead(summaries))
            : renderHeadToHead(summaries);
        const kicker = overviewScopeLocked && goalPair ? t('goalProgressKicker') : t('quickCompare');

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
                <div class="overview-section-note">${overviewGridNote}</div>
                <div class="overview-grid">
                    ${[...summaries].sort((a, b) => {
                        const aBaseline = isBaselineEngine(a.engine) ? 0 : 1;
                        const bBaseline = isBaselineEngine(b.engine) ? 0 : 1;
                        return aBaseline - bBaseline;
                    }).map((summary, index) => renderEngineSummaryCard(summary, leaders, index, summaries.length)).join('')}
                </div>
            </div>
        `;
        el.firstElementChild?.remove();

    }

    function getSnapshotRepresentativeCandidates(snapshotPayload) {
        const candidates = [];
        const preferredPair = snapshotPayload?.preferred_pair || {};
        const pairCandidates = [preferredPair.left, preferredPair.right];
        pairCandidates.forEach((candidate) => {
            if (candidate && typeof candidate === 'object') {
                candidates.push(candidate);
            }
        });

        const engines = Array.isArray(snapshotPayload?.engines) ? snapshotPayload.engines : [];
        engines.forEach((candidate) => {
            if (candidate && typeof candidate === 'object') {
                candidates.push(candidate);
            }
        });

        return candidates;
    }

    function getSnapshotRepresentativeEntries(entries, snapshotPayload) {
        if (!snapshotPayload || !Array.isArray(entries) || !entries.length) {
            return [];
        }

        const entryById = new Map();
        entries.forEach((entry) => {
            const entryId = String(entry?.entry_id || '').trim();
            if (entryId) {
                entryById.set(entryId, entry);
            }
        });

        const candidates = getSnapshotRepresentativeCandidates(snapshotPayload);
        const explicitMatches = [];
        const seenEngines = new Set();

        candidates.forEach((candidate) => {
            const entryId = String(candidate?.entry_id || '').trim();
            const engine = getEngine(candidate);
            const matchedEntry = entryId ? entryById.get(entryId) : null;
            if (!matchedEntry || seenEngines.has(engine)) {
                return;
            }
            explicitMatches.push(matchedEntry);
            seenEngines.add(engine);
        });

        if (explicitMatches.length) {
            return explicitMatches;
        }

        const snapshotDescriptor = buildComparableScopeFromSnapshot(snapshotPayload);
        return entries.filter((entry) => scopeDescriptorsMatch(snapshotDescriptor, buildComparableScopeFromEntry(entry)));
    }

    function getOverviewRepresentativeEntries(entries, comparisonView, snapshotPayload) {
        const focusedEntries = Array.isArray(comparisonView?.focusGroup?.entries)
            ? comparisonView.focusGroup.entries.filter(Boolean)
            : [];
        if (focusedEntries.length) {
            return focusedEntries;
        }

        if (!snapshotPayload || !Array.isArray(entries) || !entries.length) {
            return [];
        }

        return getSnapshotRepresentativeEntries(entries, snapshotPayload);
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
        const model = getEntryModelRepoId(entry) || 'unknown-model';
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

    function getHardConstraintCheckCodes() {
        return ['C1', 'C2', 'C3', 'C4'];
    }

    function getHardConstraintScopeMetrics(scope) {
        return scope?.derived_metrics || scope?.latest?.evaluation?.metrics || {};
    }

    function getHardConstraintScopeChecks(scope) {
        return scope?.derived_checks || scope?.latest?.evaluation?.checks || {};
    }

    function getHardConstraintScopeMetricDeltas(scope) {
        return scope?.derived_metric_deltas || scope?.metric_deltas || {};
    }

    function getHardConstraintSubmittedAt(scope) {
        return Date.parse(scope?.latest?.submitted_at || '') || 0;
    }

    function getHardConstraintScopeHint(scope, tiedScopes = []) {
        const scopes = Array.isArray(tiedScopes) && tiedScopes.length ? tiedScopes : [scope];
        const workloads = [...new Set(scopes.map((item) => item?.scope?.workload).filter(Boolean))];
        if (workloads.length > 1) {
            return `${t('hardConstraintsTiedWorkloadsLabel')}: ${t('hardConstraintsMixedWorkloads')} (${workloads.length})`;
        }

        const workload = scopes[0]?.scope?.workload || scope?.scope?.workload || '-';
        const model = getScopeModelDisplayName(scope?.scope) || '-';
        const hardware = scope?.scope?.hardware || '-';
        return `${t('hardConstraintsBestWorkloadLabel')}: ${workload} • ${model} • ${hardware}`;
    }

    function buildHardConstraintCheckItem(code, scope, tiedScopes = []) {
        const checks = getHardConstraintScopeChecks(scope);
        const metrics = getHardConstraintScopeMetrics(scope);
        const deltas = getHardConstraintScopeMetricDeltas(scope);
        const scopeHint = getHardConstraintScopeHint(scope, tiedScopes);

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

        if (code === 'C1') {
            return {
                code,
                label: t('constraint1'),
                passed: checks.effective_utilization_ge_90,
                currentValue: c1Current,
                targetValue: '>= 90%',
                deltaValue: formatSignedDelta(deltas.single_chip_effective_utilization_pct, ' pp'),
                scopeHint,
            };
        }

        if (code === 'C2') {
            return {
                code,
                label: t('constraint2'),
                passed: checks.typical_scene_ge_2x_and_ttft_tpot_reduction_gt_20,
                currentValue: c2Current,
                targetValue: 'TPS >= 2x, TTFT > 20%, TPOT > 20%',
                deltaValue: [
                    `TPS ${formatSignedDelta(deltas.typical_throughput_ratio_vs_baseline)}`,
                    `TTFT ${formatSignedDelta(deltas.typical_ttft_reduction_pct_vs_baseline, ' pp')}`,
                    `TPOT ${formatSignedDelta(deltas.typical_tpot_reduction_pct_vs_baseline, ' pp')}`,
                ].join(' · '),
                scopeHint,
            };
        }

        if (code === 'C3') {
            return {
                code,
                label: t('constraint3'),
                passed: checks.long_context_ge_32k_and_p95_p99_stable,
                currentValue: c3Current,
                targetValue: 'CTX >= 32K + stability checks',
                deltaValue: '-',
                scopeHint,
            };
        }

        return {
            code,
            label: t('constraint4'),
            passed: checks.single_business_cost_down_ge_30_and_multi_tenant_high_utilization,
            currentValue: c4Current,
            targetValue: 'Cost >= 30% + high tenant utilization',
            deltaValue: `Cost ${formatSignedDelta(deltas.unit_token_cost_reduction_pct, ' pp')}`,
            scopeHint,
        };
    }

    function buildHardConstraintCheckItems(scope) {
        if (Array.isArray(scope?.check_items) && scope.check_items.length) {
            return scope.check_items;
        }

        return getHardConstraintCheckCodes().map((code) => buildHardConstraintCheckItem(code, scope));
    }

    function countPassedHardConstraintChecks(scope) {
        const checks = getHardConstraintScopeChecks(scope);
        return Object.values(checks).filter((value) => value === true).length;
    }

    function countKnownHardConstraintSignals(scope) {
        const metrics = getHardConstraintScopeMetrics(scope);
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
        const metrics = getHardConstraintScopeMetrics(scope);
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

    function findHardConstraintCompareGroup(scope) {
        const groups = Array.isArray(state.compareSnapshot?.groups) ? state.compareSnapshot.groups : [];
        const scopeModelCanonicalId = String(scope?.scope?.model_canonical_id || '').trim();
        const scopeModelDisplayName = String(scope?.scope?.model_display_name || '').trim();
        const scopeWorkload = String(scope?.scope?.workload || '').trim();
        const scopeHardware = String(scope?.scope?.hardware || '').trim();
        const scopeConfigType = String(scope?.scope?.config_type || '').trim();

        return groups.find((group) => {
            const pair = group?.preferred_pair;
            const left = pair?.left;
            const right = pair?.right;
            const groupScope = group?.scope || {};
            if (!pair || !left || !right) {
                return false;
            }
            if (String(left?.engine || '').trim().toLowerCase() !== 'vllm-hust') {
                return false;
            }
            if (String(groupScope?.workload || '').trim() !== scopeWorkload) {
                return false;
            }
            if (String(groupScope?.hardware || '').trim() !== scopeHardware) {
                return false;
            }
            if (String(groupScope?.config_type || '').trim() !== scopeConfigType) {
                return false;
            }

            const groupModelCanonicalId = String(groupScope?.model_canonical_id || '').trim();
            const groupModelDisplayName = String(groupScope?.model_display_name || '').trim();
            if (scopeModelCanonicalId && groupModelCanonicalId) {
                return groupModelCanonicalId === scopeModelCanonicalId;
            }
            return groupModelDisplayName === scopeModelDisplayName;
        }) || null;
    }

    function deriveC2MetricsFromCompareScope(scope) {
        const group = findHardConstraintCompareGroup(scope);
        const pair = group?.preferred_pair;
        const leftMetrics = pair?.left?.metrics || {};
        const rightMetrics = pair?.right?.metrics || {};
        if (!pair || !pair.left || !pair.right) {
            return null;
        }

        const throughputCurrent = Number(leftMetrics?.throughput_tps);
        const throughputBaseline = Number(rightMetrics?.throughput_tps);
        const throughputRatio = Number.isFinite(throughputCurrent) && Number.isFinite(throughputBaseline) && throughputBaseline > 0
            ? throughputCurrent / throughputBaseline
            : null;

        const ttftCurrent = Number(leftMetrics?.ttft_ms);
        const ttftBaseline = Number(rightMetrics?.ttft_ms);
        const ttftReduction = Number.isFinite(ttftCurrent) && Number.isFinite(ttftBaseline) && ttftBaseline > 0
            ? ((ttftBaseline - ttftCurrent) / ttftBaseline) * 100
            : null;

        const tpotCurrentRaw = leftMetrics?.tpot_ms ?? leftMetrics?.tbt_ms;
        const tpotBaselineRaw = rightMetrics?.tpot_ms ?? rightMetrics?.tbt_ms;
        const tpotCurrent = Number(tpotCurrentRaw);
        const tpotBaseline = Number(tpotBaselineRaw);
        const tpotReduction = Number.isFinite(tpotCurrent) && Number.isFinite(tpotBaseline) && tpotBaseline > 0
            ? ((tpotBaseline - tpotCurrent) / tpotBaseline) * 100
            : null;

        const previousMetrics = getHardConstraintScopeMetrics(scope);
        const previousChecks = getHardConstraintScopeChecks(scope);
        return {
            metrics: {
                ...previousMetrics,
                typical_throughput_ratio_vs_baseline: throughputRatio,
                typical_ttft_reduction_pct_vs_baseline: ttftReduction,
                typical_tpot_reduction_pct_vs_baseline: tpotReduction,
            },
            checks: {
                ...previousChecks,
                typical_scene_ge_2x_and_ttft_tpot_reduction_gt_20: (
                    Number.isFinite(throughputRatio)
                    && throughputRatio >= 2
                    && Number.isFinite(ttftReduction)
                    && ttftReduction > 20
                    && Number.isFinite(tpotReduction)
                    && tpotReduction > 20
                ),
            },
            metricDeltas: {
                ...getHardConstraintScopeMetricDeltas(scope),
                typical_throughput_ratio_vs_baseline: null,
                typical_ttft_reduction_pct_vs_baseline: null,
                typical_tpot_reduction_pct_vs_baseline: null,
            },
        };
    }

    function enrichHardConstraintScope(scope) {
        const derivedC2 = deriveC2MetricsFromCompareScope(scope);
        if (!derivedC2) {
            return scope;
        }

        return {
            ...scope,
            derived_metrics: derivedC2.metrics,
            derived_checks: derivedC2.checks,
            derived_metric_deltas: derivedC2.metricDeltas,
        };
    }

    function buildHardConstraintCheckSortKey(scope, code) {
        const checks = getHardConstraintScopeChecks(scope);
        const metrics = getHardConstraintScopeMetrics(scope);
        const submittedAt = getHardConstraintSubmittedAt(scope);
        const stabilityScore = [
            metrics.long_context_throughput_stable,
            metrics.long_context_ttft_p95_stable,
            metrics.long_context_ttft_p99_stable,
            metrics.long_context_tpot_p95_stable,
            metrics.long_context_tpot_p99_stable,
        ].filter((value) => value === true).length;

        if (code === 'C1') {
            return [
                Number(checks.effective_utilization_ge_90 === true),
                Number.isFinite(metrics.single_chip_effective_utilization_pct) ? metrics.single_chip_effective_utilization_pct : -1,
                submittedAt,
            ];
        }

        if (code === 'C2') {
            return [
                Number(checks.typical_scene_ge_2x_and_ttft_tpot_reduction_gt_20 === true),
                Number.isFinite(metrics.typical_throughput_ratio_vs_baseline) ? metrics.typical_throughput_ratio_vs_baseline : -1,
                Number.isFinite(metrics.typical_ttft_reduction_pct_vs_baseline) ? metrics.typical_ttft_reduction_pct_vs_baseline : -1,
                Number.isFinite(metrics.typical_tpot_reduction_pct_vs_baseline) ? metrics.typical_tpot_reduction_pct_vs_baseline : -1,
                submittedAt,
            ];
        }

        if (code === 'C3') {
            return [
                Number(checks.long_context_ge_32k_and_p95_p99_stable === true),
                Number.isFinite(metrics.long_context_length) ? metrics.long_context_length : -1,
                stabilityScore,
                submittedAt,
            ];
        }

        return [
            Number(checks.single_business_cost_down_ge_30_and_multi_tenant_high_utilization === true),
            Number(metrics.multi_tenant_high_utilization === true),
            Number.isFinite(metrics.unit_token_cost_reduction_pct) ? metrics.unit_token_cost_reduction_pct : -1,
            submittedAt,
        ];
    }

    function compareHardConstraintScopesForCheck(code, left, right) {
        const leftKey = buildHardConstraintCheckSortKey(left, code);
        const rightKey = buildHardConstraintCheckSortKey(right, code);
        const length = Math.max(leftKey.length, rightKey.length);
        for (let index = 0; index < length; index += 1) {
            const delta = (rightKey[index] || 0) - (leftKey[index] || 0);
            if (delta !== 0) {
                return delta;
            }
        }
        return String(left?.scope_key || '').localeCompare(String(right?.scope_key || ''));
    }

    function hardConstraintCheckSortKeyEquals(code, left, right) {
        const leftKey = buildHardConstraintCheckSortKey(left, code);
        const rightKey = buildHardConstraintCheckSortKey(right, code);
        const length = Math.max(leftKey.length, rightKey.length);
        for (let index = 0; index < length; index += 1) {
            if ((leftKey[index] || 0) !== (rightKey[index] || 0)) {
                return false;
            }
        }
        return true;
    }

    function selectBestHardConstraintScopeForCheck(scopes, code) {
        if (!Array.isArray(scopes) || !scopes.length) {
            return null;
        }

        const rankedScopes = [...scopes].sort((left, right) => compareHardConstraintScopesForCheck(code, left, right));
        const primaryScope = rankedScopes[0] || null;
        if (!primaryScope) {
            return null;
        }

        const tiedScopes = rankedScopes.filter((scope) => hardConstraintCheckSortKeyEquals(code, scope, primaryScope));
        return {
            primaryScope,
            tiedScopes,
        };
    }

    function buildBestCaseHardConstraintScope(scopes) {
        if (!Array.isArray(scopes) || !scopes.length) {
            return null;
        }

        const selectedScopes = getHardConstraintCheckCodes()
            .map((code) => {
                const selection = selectBestHardConstraintScopeForCheck(scopes, code);
                return selection
                    ? {
                        code,
                        scope: selection.primaryScope,
                        tiedScopes: selection.tiedScopes,
                    }
                    : null;
            })
            .filter(Boolean);
        if (!selectedScopes.length) {
            return null;
        }

        const checkItems = selectedScopes.map((item) => buildHardConstraintCheckItem(item.code, item.scope, item.tiedScopes));
        const latestScope = [...selectedScopes]
            .sort((left, right) => getHardConstraintSubmittedAt(right.scope) - getHardConstraintSubmittedAt(left.scope))[0]?.scope || null;
        const workloads = [...new Set(selectedScopes.flatMap((item) => (item.tiedScopes || [item.scope]).map((scope) => scope?.scope?.workload)).filter(Boolean))];
        const hardwares = [...new Set(selectedScopes.map((item) => item.scope?.scope?.hardware).filter(Boolean))];
        const hasTiedSelections = selectedScopes.some((item) => Array.isArray(item.tiedScopes) && item.tiedScopes.length > 1);

        return {
            is_best_case_bundle: true,
            overall_pass: checkItems.every((item) => item.passed === true),
            summary_counts: {
                passed: checkItems.filter((item) => item.passed === true).length,
                failed: checkItems.filter((item) => item.passed !== true).length,
            },
            check_items: checkItems,
            latest: {
                engine: latestScope?.latest?.engine || 'vllm-hust',
                accountable_scope: latestScope?.latest?.accountable_scope || {},
                git_commit: latestScope?.latest?.git_commit || null,
            },
            previous: {},
            scope: {
                engine: latestScope?.scope?.engine || latestScope?.latest?.engine || 'vllm-hust',
                model_display_name: t('hardConstraintsBestCaseScope'),
                hardware: hardwares.join(', ') || '-',
                workload: workloads.length === 1 && !hasTiedSelections ? workloads[0] : t('hardConstraintsMixedWorkloads'),
            },
            best_case_workloads: workloads,
            has_tied_selections: hasTiedSelections,
        };
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
            .map((scope) => enrichHardConstraintScope(scope))
            .sort(compareHardConstraintScopes);

        const bestScope = buildBestCaseHardConstraintScope(filteredScopes);
        const displayedScopes = bestScope ? [bestScope] : [];

        if (!displayedScopes.length) {
            el.innerHTML = `
                <div class="hard-constraints-empty">${t('hardConstraintsNoData')}</div>
            `;
            return;
        }

        const passCount = bestScope?.summary_counts?.passed ?? displayedScopes.filter((scope) => scope?.overall_pass).length;
        const failCount = bestScope?.summary_counts?.failed ?? Math.max(displayedScopes.length - passCount, 0);

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
        const scopeLine = scope?.is_best_case_bundle
            ? `${t('scope')}: ${t('hardConstraintsBestCaseScope')}`
            : `${t('scope')}: ${getScopeModelDisplayName(scope?.scope) || '-'} • ${scope?.scope?.hardware || '-'} • ${scope?.scope?.workload || '-'}`;
        const scopeMeta = scope?.is_best_case_bundle
            ? `${scope?.has_tied_selections || (scope?.best_case_workloads || []).length > 1 ? t('hardConstraintsTiedWorkloadsLabel') : t('hardConstraintsBestWorkloadLabel')}: ${scope?.has_tied_selections || (scope?.best_case_workloads || []).length > 1 ? t('hardConstraintsMixedWorkloads') : ((scope?.best_case_workloads || []).join(', ') || t('hardConstraintsMixedWorkloads'))} · ${passedCount}/4`
            : `scenario=${accountable?.representative_business_scenario || '-'} · baseline=${formatAccountableBaseline(accountable)} · ${passedCount}/4`;
        const commitLine = scope?.is_best_case_bundle
            ? `${t('current')}: ${t('hardConstraintsBestCaseScope')} · ${t('previous')}: -`
            : `${t('current')}: ${latest?.git_commit || latest?.entry_id || '-'} · ${t('previous')}: ${previous?.git_commit || previous?.entry_id || '-'}`;

        return `
            <details class="hard-constraint-card ${statusClass}">
                <summary class="hard-constraint-summary">
                    <div class="hard-constraint-summary-main">
                        <div class="hard-constraint-card-head">
                            <strong>${getEngineLabel(latest?.engine || scope?.scope?.engine || 'unknown')}</strong>
                            <span class="hc-status ${statusClass}">${scope?.overall_pass ? t('pass') : t('fail')}</span>
                        </div>
                        <p class="hard-constraint-scope">${scopeLine}</p>
                        <p class="hard-constraint-scope-meta">
                            ${scopeMeta}
                        </p>
                    </div>
                    <div class="hard-constraint-summary-side">
                        <div class="hard-constraint-badges">${summaryBadges}</div>
                        <span class="hard-constraint-toggle"></span>
                    </div>
                </summary>
                <div class="hard-constraint-details">
                    <div class="hard-constraint-rows">
                        ${checkItems.map((item) => renderHardConstraintRow(item.label, item.passed, item.currentValue, item.targetValue, item.deltaValue, item.scopeHint)).join('')}
                    </div>
                    <p class="hard-constraint-commit">${commitLine}</p>
                </div>
            </details>
        `;
    }

    function renderHardConstraintRow(label, passed, currentValue, targetValue, deltaValue, scopeHint = '') {
        const statusClass = passed ? 'pass' : 'fail';
        return `
            <div class="hard-constraint-row">
                <div class="hc-row-title">${label}</div>
                <div class="hc-row-meta">
                    <span>${t('current')}: ${currentValue}</span>
                    <span>${t('target')}: ${targetValue}</span>
                    <span>${t('delta')}: ${deltaValue}</span>
                    ${scopeHint ? `<span>${scopeHint}</span>` : ''}
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
            try {
                timestamp = await window.HFDataLoader.getLastUpdated();
            } catch (_error) {
                timestamp = null;
            }
        }

        // Fallback: load local last_updated.json directly
        if (!timestamp) {
            try {
                const response = await fetch(`./data/last_updated.json?v=${LOCAL_DATA_CACHE_BUST || '1'}`);
                if (response.ok) {
                    const data = await response.json();
                    timestamp = data?.last_updated || null;
                }
            } catch (_e) {
                // ignore
            }
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
    function renderDataRow(entry, isLatest, isExpanded, showVersion, isSparse, versionRowSpan = 1) {
        const m = entry.metrics;
        const trends = entry.trends || {};
        const dateLabel = getEntryDateLabel(entry);
        const displayVersion = formatEntryVersion(entry, { display: true });
        const buildCount = entry.versionVariants?.length || 1;
        const engineLabel = getEngineLabel(getEngine(entry));
        const fallbackDate = dateLabel ? `<small class="version-date version-date--aligned">${dateLabel}</small>` : '';
        const tableVersionSummary = formatTableVersionSummary(entry, dateLabel);
        const versionMainText = tableVersionSummary || `${renderAlignedVersionRow({ label: engineLabel, version: displayVersion })}${fallbackDate}`;
        const provenanceSummary = shouldHideVersionProvenance(entry)
            ? ''
            : renderProvenanceSummary(entry);
        const settingSummary = getSettingSummary(entry);
        const modelText = entry.model?.short_name || entry.model?.name || t('unknown');

        // 生成配置描述（芯片数/节点数）
        const configText = getConfigText(entry);
        const workloadText = getWorkloadLabel(getWorkloadId(entry));
        const versionCellHtml = showVersion ? `
                <td class="version-table-cell" rowspan="${Math.max(1, versionRowSpan)}">
                    <div class="version-cell">
                        <div class="version-main version-main--aligned">${versionMainText}</div>
                        ${provenanceSummary}
                        <small class="version-setting-summary">${settingSummary}</small>
                        ${buildCount > 1 ? `<small class="version-merge-hint">${t('bestFourth')}</small>` : ''}
                        ${isSparse ? `<small class="version-merge-hint sparse">${t('sparseGroup')}</small>` : ''}
                        ${(isLatest || entry.isBaseline)
                            ? `<div class="version-badges">${isLatest ? `<span class="version-badge">${t('latest')}</span>` : ''}${entry.isBaseline ? `<span class="version-badge baseline">${t('baseline')}</span>` : ''}</div>`
                            : ''}
                    </div>
                </td>
            ` : '';

        return `
            <tr data-entry-id="${entry.entry_id}" class="${isSparse ? 'is-sparse' : ''}">
                ${versionCellHtml}
                <td class="config-cell">${workloadText}</td>
                <td class="config-cell">${configText}</td>
                <td class="config-cell">${modelText}</td>
                <td class="metric-column">${renderMetricCell(m.ttft_ms, trends.ttft_ms, false, false, entry.isBaseline)}</td>
                <td class="metric-column">${renderMetricCell(m.tbt_ms, trends.tbt_ms, false, false, entry.isBaseline)}</td>
                <td class="metric-column">${renderMetricCell(m.throughput_tps, trends.throughput_tps, true, false, entry.isBaseline)}</td>
                <td class="metric-column">${renderMetricCell(m.error_rate, trends.error_rate, false, true, entry.isBaseline)}</td>
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
            formatPercent(value) :
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
        const totalMemoryGb = getEntryTotalMemoryGb(entry);

        return `
            <div class="detail-section">
                <h4>${t('hardwareConfig')}</h4>
                <p><strong>${t('chip')}:</strong> ${hw.chip_model} × ${hw.chip_count}</p>
                <p><strong>${t('totalMemory')}:</strong> ${formatMemoryGb(totalMemoryGb)} GB</p>
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
        const engineVersion = getEntryDetailedVersionText(entry);
        const versions = entry.versions || {};
        const versionRows = Object.entries(versions)
            .filter(([_, value]) => typeof value === 'string' && value.trim())
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

        return `
            <div class="detail-section">
                <h4>${t('engineVersions')}</h4>
                <p><strong>${t('engine')}:</strong> ${engineLabel}</p>
                <p><strong>${t('engineVersion')}:</strong> ${engineVersion}</p>
                ${versionRows.length ? versionRows.map(([key, value]) => {
            const formatted = formatDetailedVersion(value, getVersionFieldCommit(entry, key)) || value;
            return `<p><strong>${key}:</strong> ${formatted}</p>`;
        }).join('') : ''}
            </div>
        `;
    }

    function renderBuildVariantsSection(entry) {
        const variants = entry.versionVariants || [entry];
        const displayedVersion = getEntryDetailedVersionText(entry);

        return `
            <div class="detail-section">
                <h4>${t('fullBuildResults')}</h4>
                <p><strong>${t('displayedVersion')}:</strong> ${displayedVersion} ${t('bestFourthInline')}</p>
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
            const variantVersion = getEntryDetailedVersionText(variant);
            return `
                                    <tr class="${selected}">
                                        <td><span class="build-version-summary">${variantVersion}</span>${index === 0 ? ` <span class="build-version-marker">${t('selectedStar')}</span>` : ''}</td>
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

    // Apply a user-selected column sort on top of the default display order.
    // Entries with missing/invalid metric values are pushed to the bottom.
    function applyColumnSort(entries, sortState) {
        const { column, direction } = sortState;
        const sorted = [...entries];
        sorted.sort((a, b) => {
            const aVal = Number(a.metrics?.[column]);
            const bVal = Number(b.metrics?.[column]);
            const aValid = Number.isFinite(aVal);
            const bValid = Number.isFinite(bVal);
            if (!aValid && !bValid) return 0;
            if (!aValid) return 1;
            if (!bValid) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return direction === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }

    // Reflect current sort state as CSS classes on sortable column headers
    function renderSortHeaders() {
        const sortState = state.sort[state.currentTab];
        const SORTABLE_HEADER_MAP = {
            'table-head-ttft': 'ttft_ms',
            'table-head-tbt': 'tbt_ms',
            'table-head-tps': 'throughput_tps',
            'table-head-error': 'error_rate',
        };
        Object.entries(SORTABLE_HEADER_MAP).forEach(([headId, col]) => {
            const th = document.getElementById(headId);
            if (!th) return;
            th.classList.remove('sort-active-asc', 'sort-active-desc');
            if (sortState.column === col) {
                th.classList.add(sortState.direction === 'asc' ? 'sort-active-asc' : 'sort-active-desc');
                th.setAttribute('aria-sort', sortState.direction === 'asc' ? 'ascending' : 'descending');
            } else {
                th.setAttribute('aria-sort', 'none');
            }
        });
    }

    // Render page prev/next controls below the table
    function renderPagination(totalItems, totalPages) {
        const el = document.getElementById('leaderboard-pagination');
        if (!el) return;
        const pagination = state.pagination[state.currentTab];
        if (totalPages <= 1) {
            el.innerHTML = '';
            return;
        }
        const { page } = pagination;
        const lang = localStorage.getItem('vllm-hust_lang') || 'en';
        // Build page indicator text (zh: "第 X / Y 页", en: "Page X / Y")
        const pageText = lang === 'zh'
            ? `${t('paginationPage')} <strong>${page}</strong> / ${totalPages} &nbsp;(${totalItems} ${t('paginationRows')})`
            : `${t('paginationPage')} <strong>${page}</strong> / ${totalPages} &nbsp;(${totalItems} ${t('paginationRows')})`;
        el.innerHTML = `
            <div class="pagination-controls">
                <button class="pagination-btn" id="pagination-prev" ${page <= 1 ? 'disabled' : ''}>← ${t('paginationPrev')}</button>
                <span class="pagination-info">${pageText}</span>
                <button class="pagination-btn" id="pagination-next" ${page >= totalPages ? 'disabled' : ''}>→ ${t('paginationNext')}</button>
            </div>
        `;
        document.getElementById('pagination-prev')?.addEventListener('click', () => {
            if (pagination.page > 1) { pagination.page--; renderTable(); }
        });
        document.getElementById('pagination-next')?.addEventListener('click', () => {
            if (pagination.page < totalPages) { pagination.page++; renderTable(); }
        });
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
        const model = getEntryModelCanonicalId(entry) || 'unknown-model';
        const hardware = entry?.hardware?.chip_model || 'unknown-hardware';
        const precision = entry?.model?.precision || 'unknown-precision';
        const quantization = getEntryQuantization(entry);
        const workload = getWorkloadId(entry) || 'Other';
        const configType = entry?.config_type || state.currentTab || 'unknown-config';
        const chipCount = entry?.hardware?.chip_count || 0;
        const nodeCount = entry?.cluster?.node_count || 1;
        const settingSignature = getSettingSignature(entry);
        return [model, hardware, precision, quantization, workload, configType, chipCount, nodeCount, settingSignature].join('|');
    }

    function buildScopeLabel(entry) {
        const model = getEntryModelDisplayName(entry) || 'Unknown model';
        const hardware = entry?.hardware?.chip_model || 'Unknown hardware';
        const precision = formatPrecisionWithQuantization(entry);
        const workload = getWorkloadLabel(getWorkloadId(entry));
        const settingSummary = entry?.scope?.setting_summary || getSettingSummary(entry);
        return `${model} • ${hardware} • ${precision} • ${workload} • ${settingSummary}`;
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

    function getBestEntryForEngine(entries, engine) {
        const candidates = entries.filter((entry) => getEngine(entry) === engine);
        if (!candidates.length) {
            return null;
        }
        return [...candidates].sort((a, b) => compareEntryQuality(b, a))[0] || null;
    }

    function getOfficialVllmBaselineEntry(entries) {
        const candidates = entries.filter((entry) => {
            const engine = getEngine(entry);
            const version = String(getEngineVersion(entry) || '').trim();
            return engine === 'vllm' && version === '0.18.0';
        });
        if (candidates.length) {
            return [...candidates].sort((a, b) => compareEntryQuality(b, a))[0] || null;
        }
        return getBestEntryForEngine(entries, 'vllm');
    }

    function getThroughputImprovementScore(currentEntry, baselineEntry) {
        const currentThroughput = Number(currentEntry?.metrics?.throughput_tps);
        const baselineThroughput = Number(baselineEntry?.metrics?.throughput_tps);
        if (!Number.isFinite(currentThroughput) || !Number.isFinite(baselineThroughput) || baselineThroughput <= 0) {
            return Number.NEGATIVE_INFINITY;
        }
        return (currentThroughput - baselineThroughput) / baselineThroughput;
    }

    function getGroupRepresentativeScore(group) {
        if (!group?.isComplete || !Array.isArray(group.entries)) {
            return Number.NEGATIVE_INFINITY;
        }

        const currentBest = getBestEntryForEngine(group.entries, 'vllm-hust');
        const officialBaseline = getOfficialVllmBaselineEntry(group.entries);
        return getThroughputImprovementScore(currentBest, officialBaseline);
    }

    function selectOverviewRepresentativeGroup(comparisonView) {
        const activeGroups = Array.isArray(comparisonView?.activeGroups)
            ? comparisonView.activeGroups
            : [];
        const completeGroups = activeGroups.filter((group) => group?.isComplete);
        if (!completeGroups.length) {
            return null;
        }

        return [...completeGroups].sort((a, b) => {
            const scoreDelta = getGroupRepresentativeScore(b) - getGroupRepresentativeScore(a);
            if (scoreDelta !== 0) {
                return scoreDelta;
            }
            if (b.entries.length !== a.entries.length) {
                return b.entries.length - a.entries.length;
            }
            return String(a.summaryLabel || '').localeCompare(String(b.summaryLabel || ''));
        })[0] || null;
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
            activeGroups,
            incompleteKeys,
            totalIncompleteGroups: totalGroups.filter((group) => !group.isComplete).length,
            hiddenCount: Math.max(entries.length - visibleEntries.length, 0),
            activeCoverage: {
                groupCount: activeGroups.length,
                completeGroupCount: activeGroups.filter((group) => group.isComplete).length,
            },
        };
    }

    function summarizeEngines(entries, representativeEntries = [], options = {}) {
        const grouped = new Map();
        const representativeByEngine = new Map();
        const aggregateScopeText = String(options?.aggregateScopeText || '').trim();

        representativeEntries.forEach((entry) => {
            const engine = getEngine(entry);
            const incumbent = representativeByEngine.get(engine);
            if (!incumbent || compareEntryQuality(entry, incumbent) > 0) {
                representativeByEngine.set(engine, entry);
            }
        });

        entries.forEach((entry) => {
            const engine = getEngine(entry);
            if (!grouped.has(engine)) {
                grouped.set(engine, []);
            }
            grouped.get(engine).push(entry);
        });

        return Array.from(grouped.entries())
            .map(([engine, engineEntries]) => {
                const representativeEntry = representativeByEngine.get(engine) || null;
                const bestEntry = representativeEntry || null;
                const coverageBestEntry = [...engineEntries].sort((a, b) => compareEntryQuality(b, a))[0] || null;
                const displayEntry = representativeEntry;
                const displayMetrics = displayEntry?.metrics || {};
                return {
                    engine,
                    label: getEngineLabel(engine),
                    count: engineEntries.length,
                    displayTTFT: displayEntry ? Number(displayMetrics.ttft_ms) : null,
                    displayTBT: displayEntry ? Number(displayMetrics.tbt_ms) : null,
                    displayTPS: displayEntry ? Number(displayMetrics.throughput_tps) : null,
                    displayError: displayEntry ? Number(displayMetrics.error_rate) : null,
                    displayEntry,
                    representativeEntry,
                    aggregateOnly: false,
                    aggregateScopeText,
                    bestEntry: bestEntry || coverageBestEntry,
                    overviewComponents: buildTableVersionComponents(bestEntry || coverageBestEntry),
                    version: formatEntryVersion(bestEntry || coverageBestEntry, { display: true }),
                };
            })
            .sort((a, b) => (b.displayTPS || 0) - (a.displayTPS || 0));
    }

    function getLeaders(summaries) {
        if (!summaries.length) {
            return { throughput: null, ttft: null, tbt: null };
        }

        return {
            throughput: [...summaries].filter((item) => Number.isFinite(item.displayTPS)).sort((a, b) => b.displayTPS - a.displayTPS)[0] || null,
            ttft: [...summaries].filter((item) => Number.isFinite(item.displayTTFT)).sort((a, b) => a.displayTTFT - b.displayTTFT)[0] || null,
            tbt: [...summaries].filter((item) => Number.isFinite(item.displayTBT)).sort((a, b) => a.displayTBT - b.displayTBT)[0] || null,
        };
    }

    function getOverviewTitle(summaries, leaders, comparisonView) {
        if (summaries.length === 1) {
            return `${summaries[0].label} ${t('onlyEngineView')}`;
        }

        const leader = leaders.throughput;
        const runnerUp = summaries[1];
        if (!leader || !runnerUp || !Number.isFinite(leader.displayTPS) || !Number.isFinite(runnerUp.displayTPS) || runnerUp.displayTPS === 0) {
            return `${t('comparing')} ${summaries.length} ${t('enginesInView')}`;
        }

        const delta = ((leader.displayTPS - runnerUp.displayTPS) / runnerUp.displayTPS) * 100;
        const scopePrefix = comparisonView.focusGroup ? `${t('focusedSlice')} ` : '';
        return `${scopePrefix}${leader.label} ${t('leadsCurrentView')} ${delta.toFixed(1)}% ${t('throughputOver')} ${runnerUp.label}.`;
    }

    function getOverviewSubtitle(entries, engineCount, comparisonView, viewOptions) {
        const models = getUniqueValues(entries, (entry) => getEntryModelDisplayName(entry));
        const hardware = getUniqueValues(entries, (entry) => entry?.hardware?.chip_model);
        const precisions = getUniqueValues(entries, (entry) => entry?.model?.precision);
        const workloads = getUniqueValues(entries, (entry) => getWorkloadId(entry));
        const singleCompleteGroup = getSingleCompleteOverviewGroup(comparisonView);

        const modelText = models.length === 1 ? models[0] : `${models.length} ${t('models')}`;
        const hardwareText = hardware.length === 1 ? hardware[0] : `${hardware.length} ${t('hardwareTargets')}`;
        const precisionText = precisions.length === 1 ? precisions[0] : `${precisions.length} ${t('precision')}`;
        const workloadText = workloads.length === 1 ? getWorkloadLabel(workloads[0]) : `${workloads.length} ${t('workloads')}`;
        const scopeText = singleCompleteGroup?.summaryLabel
            ? singleCompleteGroup.summaryLabel
            : `${modelText} • ${hardwareText} • ${precisionText} • ${workloadText}`;

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
        const tpsDelta = relativeDelta(left.displayTPS, right.displayTPS, true);
        const ttftDelta = relativeDelta(left.displayTTFT, right.displayTTFT, false);
        const tbtDelta = relativeDelta(left.displayTBT, right.displayTBT, false);

        return `
            <div class="head-to-head">
                <div class="head-to-head-side">
                    <strong>${left.label}</strong>
                    <span>TTFT ${formatNumber(left.displayTTFT)} ms • TBT ${formatNumber(left.displayTBT)} ms • TPS ${formatNumber(left.displayTPS)}</span>
                </div>
                <div class="head-to-head-divider">${t('versusShort')}</div>
                <div class="head-to-head-side">
                    <strong>${right.label}</strong>
                    <span>TTFT ${formatNumber(right.displayTTFT)} ms • TBT ${formatNumber(right.displayTBT)} ms • TPS ${formatNumber(right.displayTPS)}</span>
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
        const model = getScopeModelDisplayName(scope) || 'Unknown model';
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
                    <span>${renderSnapshotConstraintHeadline(left.constraints)}</span>
                    <span>${renderSnapshotLongContextSummary(left.constraints)}</span>
                </div>
                <div class="head-to-head-divider">${t('versusShort')}</div>
                <div class="head-to-head-side">
                    <strong>${getEngineLabel(right.engine)}</strong>
                    <span>TTFT ${formatNumber(right.metrics.ttft_ms)} ms • TBT ${formatNumber(right.metrics.tbt_ms)} ms • TPS ${formatNumber(right.metrics.throughput_tps)}</span>
                    <span>${renderSnapshotConstraintHeadline(right.constraints)}</span>
                    <span>${renderSnapshotLongContextSummary(right.constraints)}</span>
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

    function renderSnapshotConstraintHeadline(constraints) {
        const utilization = formatSnapshotValueWithUnit(
            constraints?.single_chip_effective_utilization_pct,
            '%',
        );
        const tokenCost = formatSnapshotValueWithUnit(
            constraints?.unit_token_cost_reduction_pct,
            '%',
        );
        const multiTenant = formatSnapshotBoolean(constraints?.multi_tenant_high_utilization);
        return `${t('compareUtilizationLabel')} ${utilization} • ${t('compareTokenCostLabel')} ${tokenCost} • ${t('compareMultiTenantLabel')} ${multiTenant}`;
    }

    function renderSnapshotLongContextSummary(constraints) {
        const hasLongContext = Number.isFinite(Number(constraints?.long_context_length))
            || Number.isFinite(Number(constraints?.long_context_ttft_p95_ms))
            || Number.isFinite(Number(constraints?.long_context_ttft_p99_ms))
            || Number.isFinite(Number(constraints?.long_context_tpot_p99_ms));
        if (!hasLongContext) {
            return `${t('compareLongContextLabel')} ${t('compareNoData')}`;
        }

        const parts = [];
        if (Number.isFinite(Number(constraints?.long_context_length))) {
            parts.push(String(Math.round(Number(constraints.long_context_length))));
        }
        if (Number.isFinite(Number(constraints?.long_context_ttft_p95_ms))) {
            parts.push(`P95 ${formatNumber(Number(constraints.long_context_ttft_p95_ms))} ms`);
        }
        if (Number.isFinite(Number(constraints?.long_context_ttft_p99_ms))) {
            parts.push(`P99 ${formatNumber(Number(constraints.long_context_ttft_p99_ms))} ms`);
        }
        if (Number.isFinite(Number(constraints?.long_context_tpot_p99_ms))) {
            parts.push(`TPOT P99 ${formatNumber(Number(constraints.long_context_tpot_p99_ms))} ms`);
        }

        const stable = formatSnapshotBoolean(constraints?.long_context_throughput_stable);
        return `${t('compareLongContextLabel')} ${parts.join(' • ')} • ${stable}`;
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

    function formatSnapshotBoolean(value) {
        if (value === true) {
            return t('compareStableYes');
        }
        if (value === false) {
            return t('compareStableNo');
        }
        return t('compareNoData');
    }

    function formatSnapshotValueWithUnit(value, unit) {
        if (!Number.isFinite(Number(value))) {
            return t('compareNoData');
        }
        return `${formatNumber(Number(value))}${unit}`;
    }

    function isBaselineEngine(engine) {
        return engine !== 'vllm-hust';
    }

    function renderEngineSummaryCard(summary, leaders, cardIndex, cardCount) {
        const representativeEntry = summary.representativeEntry || null;
        const bestEntry = summary.bestEntry || {};
        const aggregateOnly = Boolean(summary.aggregateOnly);
        const isLeader = leaders.throughput && leaders.throughput.engine === summary.engine;
        const isBaselineCard = !isLeader && cardCount === 2 && cardIndex === 1;
        const chipText = getOverviewSummaryChipText(summary);
        const versionText = getOverviewSummaryVersionText(summary);
        const bestVisibleRunText = `${getWorkloadLabel(getWorkloadId(bestEntry))} • ${getConfigText(bestEntry).replace('<br><small>', ' • ').replace('</small>', '')}`;
        const versionPrefix = isLeader
            ? t('currentBestVersionLabel')
            : isBaselineCard
                ? t('baselineVersionLabel')
                : t('bestVisibleVersion');
        const footerLabel = representativeEntry
            ? t('alignedRunLabel')
            : aggregateOnly
                ? t('visibleScopeLabel')
                : t('bestVisibleRun');
        const footerValue = aggregateOnly ? (summary.aggregateScopeText || t('compareNoData')) : bestVisibleRunText;
        const metricLabel = (sampleKey) => t(sampleKey);

        return `
            <div class="engine-summary-card ${isLeader ? 'is-leader' : ''}">
                <div class="engine-summary-head">
                    <span class="engine-chip">${chipText}</span>
                    ${isLeader ? `<span class="leader-mark">${t('throughputLeader')}</span>` : `<span class="leader-mark">${summary.count} ${summary.count > 1 ? t('rows') : t('row')}</span>`}
                </div>
                <div class="engine-summary-metrics">
                    <div class="summary-metric">
                        <span>${metricLabel('sampleTTFT')}</span>
                        <strong>${formatNumber(summary.displayTTFT)} ms</strong>
                    </div>
                    <div class="summary-metric">
                        <span>${metricLabel('sampleTBT')}</span>
                        <strong>${formatNumber(summary.displayTBT)} ms</strong>
                    </div>
                    <div class="summary-metric">
                        <span>${metricLabel('sampleThroughput')}</span>
                        <strong>${formatNumber(summary.displayTPS)} tok/s</strong>
                    </div>
                    <div class="summary-metric">
                        <span>${t('errorRate')}</span>
                        <strong>${formatPercent(summary.displayError)}</strong>
                    </div>
                </div>
                <div class="engine-summary-meta">
                    <div class="engine-summary-version">
                        <span class="engine-summary-version-label">${versionPrefix}</span>
                        <span class="engine-summary-version-value">${versionText}</span>
                    </div>
                    <div class="engine-summary-footer">
                        <span class="engine-summary-footer-label">${footerLabel}:</span>
                        <span class="engine-summary-footer-value">${footerValue}</span>
                    </div>
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
