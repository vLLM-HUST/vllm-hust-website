(() => {
  const catalog = document.querySelector("[data-plugin-catalog]");
  const status = document.querySelector("[data-plugin-status]");
  const filters = document.querySelector("[data-plugin-filters]");
  const search = document.querySelector("[data-plugin-search]");
  const modelSelect = document.querySelector("[data-plugin-model]");
  const more = document.querySelector("[data-plugin-more]");
  const workloadNavigationRoot = document.querySelector("[data-workload-navigation]");
  const workloadFilters = document.querySelector("[data-workload-filters]");
  const workloadDescription = document.querySelector("[data-workload-description]");
  const adjacent = document.querySelector("[data-adjacent-assets]");
  const repositoryCatalog = document.querySelector("[data-repository-portfolio]");
  const repositoryStatus = document.querySelector("[data-repository-status]");
  if (!catalog || !status || !filters || !search) return;

  let registry;
  let performanceResults = new Map();
  let performanceData;
  let frontierData;
  let selectedModel = "";
  let portfolio;
  let workshopMetadata = {};
  let workloadNavigation = { traits: {}, plugins: {} };
  let modTaxonomy = {};
  let selectedType = "extensions";
  let selectedWorkload = "all";
  const taxonomyProfile = item => modTaxonomy[item.id] || {};
  const isPerformanceCandidate = item => ["runtime_mod", "connector_mod"].includes(taxonomyProfile(item).kind);

  const language = () => document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
  const local = (item, field) => item[`${field}_${language()}`] || item[`${field}_en`] || item[field] || "";
  const element = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const copy = () => language() === "zh" ? {
    all: "全部",
    extensions: "全部分类",
    runtime_mod: "运行时 MOD",
    connector_mod: "连接器 MOD",
    tool_mod: "工具 MOD",
    control_plane: "控制面",
    external_system: "外部系统",
    retired: "退役归档",
    mod: "MOD",
    entries: "个项目",
    empty: "没有符合当前筛选条件的组件。",
    repository: "规范仓库",
    noRepository: "尚无公开主仓库",
    searchPlaceholder: "搜索 MOD、宿主、平台或仓库",
    evidence: "证据",
    ownership: "维护",
    maintainers: "原负责人",
    planes: "执行面",
    delivery: "交付",
    contracts: "版本化契约",
    surfaces: "现有接入面",
    compatibility: "兼容性",
    maintainers: "负责人",
    adaptationMaintainers: "国产化适配维护者",
    advisors: "指导老师",
    advisorUnknown: "规范元数据尚未记录指导关系",
    externalAdvisor: "校外指导",
    externalContributor: "项目外援",
    stars: "Stars",
    pullRequests: "开放 PR",
    forks: "Forks",
    publicEffect: "公开效果",
    identity: "组件身份",
    capability: "能力域",
    lifecycle: "生命周期",
    evidenceState: "证据状态",
    effectSource: "查看依据",
    host: "宿主",
    versions: "适配版本",
    platforms: "平台",
    models: "模型资格",
    python: "Python",
    requirements: "前置条件",
    followup: "负责人跟进 Issue",
    details: "兼容性与技术详情",
    allWorkloads: "全部 Workload",
    workloadTraits: "适用 Workload",
    allWorkloadDescription: "展示所有已公开分类组件；只有运行时 MOD 与连接器 MOD 进入性能候选，其余类型用于工具、控制与系统边界说明。",
    installRun: "安装 / 启动",
    boundaries: "关键边界",
    repositories: "个组织仓库",
    allModels: "全部模型",
    runtimeMods: "运行时 MOD",
    connectorMods: "连接器 MOD",
    toolMods: "工具 MOD",
    controlPlanes: "控制面",
    externalSystems: "外部系统",
    retiredItems: "孵化终止与退役归档",
    repositoryEmpty: "没有符合当前搜索条件的仓库。",
    artifacts: "规范制品",
    relation: "与运行时关系",
    repositoryRelationship: "仓库关系",
    upstream: "官方上游",
    upstreamOwner: "上游原项目",
    projectComponents: "项目组件",
    componentRepository: "组件仓库",
    forkBadge: "上游同步 fork",
    forksTitle: "上游同步 HUST 分支系统",
    forksCopy: "这些仓库跟随官方项目演进，只承载 HUST 必需的窄幅差异。它们是完整系统或平台发行分支，不是插件。"
  } : {
    all: "All",
    extensions: "All classified",
    runtime_mod: "Runtime MODs",
    connector_mod: "Connector MODs",
    tool_mod: "Tool MODs",
    control_plane: "Control plane",
    external_system: "External systems",
    retired: "Retired",
    mod: "MOD",
    entries: "projects",
    empty: "No classified components match the current filters.",
    repository: "Canonical repository",
    noRepository: "No public canonical repository",
    searchPlaceholder: "Search MOD, host, platform, or repository",
    evidence: "Evidence",
    ownership: "Ownership",
    maintainers: "Original maintainers",
    planes: "Planes",
    delivery: "Delivery",
    contracts: "Versioned contracts",
    surfaces: "Existing surfaces",
    compatibility: "Compatibility",
    maintainers: "Maintainers",
    adaptationMaintainers: "Localization maintainers",
    advisors: "Advisors",
    advisorUnknown: "No advisor relationship is recorded in canonical metadata",
    externalAdvisor: "External advisor",
    externalContributor: "External contributor",
    stars: "Stars",
    pullRequests: "Open PRs",
    forks: "Forks",
    publicEffect: "Public result",
    identity: "Component identity",
    capability: "Capability area",
    lifecycle: "Lifecycle",
    evidenceState: "Evidence state",
    effectSource: "View evidence",
    host: "Host",
    versions: "Versions",
    platforms: "Platforms",
    models: "Model qualification",
    python: "Python",
    requirements: "Requirements",
    followup: "Owner follow-up issue",
    details: "Compatibility & technical details",
    allWorkloads: "All workloads",
    workloadTraits: "Workload fit",
    allWorkloadDescription: "Show every published classified component. Only runtime and connector MODs are performance candidates; other types document tooling, control, and system boundaries.",
    installRun: "Install / run",
    boundaries: "Key boundaries",
    repositories: "organization repositories",
    allModels: "All models",
    runtimeMods: "Runtime MODs",
    connectorMods: "Connector MODs",
    toolMods: "Tool MODs",
    controlPlanes: "Control plane",
    externalSystems: "External systems",
    retiredItems: "Incubation stopped and retired",
    repositoryEmpty: "No repositories match the current search.",
    artifacts: "Canonical artifacts",
    relation: "Runtime relation",
    repositoryRelationship: "Repository relationship",
    upstream: "Official upstream",
    upstreamOwner: "Upstream project",
    projectComponents: "Project components",
    componentRepository: "Component repository",
    forkBadge: "Upstream-sync fork",
    forksTitle: "Upstream-synchronized HUST forks",
    forksCopy: "These repositories track official projects and carry only narrowly required HUST deltas. They are complete system or platform distributions, not plugins."
  };

  const typeLabels = {
    runtime_core: { en: "Runtime core", zh: "运行时本体" },
    platform_profile: { en: "Platform profiles", zh: "平台 profile" },
    runtime_component: { en: "Runtime components", zh: "运行时组件" },
    external_system: { en: "External systems", zh: "外部系统" },
    bridge: { en: "Bridges", zh: "Bridge / Agent" },
    tool: { en: "Engineering and evidence", zh: "工程与证据" },
    application: { en: "Applications", zh: "应用与展示" }
  };
  const taxonomyLabels = {
    kind: {
      runtime_mod: { en: "Runtime MOD", zh: "运行时 MOD" },
      connector_mod: { en: "Connector MOD", zh: "连接器 MOD" },
      tool_mod: { en: "Tool MOD", zh: "工具 MOD" },
      control_plane: { en: "Control plane", zh: "控制面" },
      external_system: { en: "External system", zh: "外部系统" },
      retired: { en: "Retired", zh: "退役归档" }
    },
    capability: {
      execution_optimization: { en: "Execution optimization", zh: "执行优化" },
      decoding: { en: "Decoding", zh: "解码机制" },
      scheduling_routing: { en: "Scheduling and routing", zh: "调度与路由" },
      kv_management: { en: "KV management", zh: "KV 管理" },
      operators_attention: { en: "Operators and attention", zh: "算子与注意力" },
      parallel_communication: { en: "Parallel communication", zh: "并行与通信" },
      observability_evaluation: { en: "Observability and evaluation", zh: "可观测与评测" },
      model_preparation: { en: "Model preparation", zh: "模型准备" },
      lifecycle_control: { en: "Lifecycle control", zh: "生命周期控制" },
      policy_research: { en: "Policy research", zh: "策略研究" }
    },
    lifecycle: {
      implemented: { en: "Implemented", zh: "已实现" },
      implemented_restricted: { en: "Implemented · restricted", zh: "已实现 · 条件受限" },
      qualification_pending: { en: "Qualification pending", zh: "资格验证中" },
      evidence_reconciliation: { en: "Evidence reconciliation", zh: "证据对账中" },
      pending: { en: "Integration pending", zh: "接入中" },
      research: { en: "Research", zh: "研究中" },
      external: { en: "External lifecycle", zh: "外部生命周期" },
      retired: { en: "Retired", zh: "已退役" }
    },
    evidence: {
      measured_beneficial: { en: "Measured · beneficial", zh: "实测 · 有收益" },
      measured_inconclusive: { en: "Measured · inconclusive", zh: "实测 · 效果未定" },
      measured_not_beneficial: { en: "Measured · no gain in tested cell", zh: "实测 · 当前单元无收益" },
      qualified_restricted: { en: "Qualified · restricted", zh: "已验证 · 条件受限" },
      hardware_validation_pending: { en: "Hardware validation pending", zh: "硬件验证待完成" },
      runtime_effective_pending: { en: "Runtime-effective evidence pending", zh: "运行时生效证据待完成" },
      runtime_effective_functional: { en: "Runtime-effective · functional", zh: "运行时已生效 · 功能证据" },
      activation_pending: { en: "Activation pending", zh: "激活路径待完成" },
      operator_integration_pending: { en: "Operator integration pending", zh: "算子接入待完成" },
      catalog_conflict: { en: "Catalog evidence conflict", zh: "目录证据存在冲突" },
      specialized_workload: { en: "Specialized workload evidence", zh: "特殊负载证据" },
      scaffold_only: { en: "Scaffold only", zh: "仅有脚手架" },
      host_integration_pending: { en: "Host integration pending", zh: "宿主接入待完成" },
      topology_limited: { en: "Topology-limited evidence", zh: "拓扑受限证据" },
      functionally_validated: { en: "Functionally validated", zh: "功能已验证" },
      no_performance_claim: { en: "No performance claim", zh: "不声明性能收益" },
      observer_contract_pending: { en: "Observer contract pending", zh: "观察契约待完成" },
      offline_tool: { en: "Offline tool", zh: "离线工具" },
      metadata_validation_only: { en: "Metadata validation only", zh: "仅元数据校验" },
      functional_only: { en: "Functional evidence only", zh: "仅功能证据" },
      external_lifecycle: { en: "Externally operated", zh: "外部运维" },
      bridge_component: { en: "Bridge component", zh: "桥接组件" },
      integration_tested: { en: "Integration tested", zh: "集成已验证" },
      no_runtime_implementation: { en: "No runtime implementation", zh: "无运行时实现" },
      host_integration_missing: { en: "Host integration missing", zh: "缺少宿主接入" },
      no_activation_entry: { en: "No activation entry", zh: "无激活入口" },
      operator_integration_missing: { en: "Operator integration missing", zh: "缺少算子接入" },
      runtime_effective_no_causal_attribution: { en: "Runtime-effective · attribution pending", zh: "运行时已生效 · 因果归因待完成" }
    }
  };
  const taxonomyLabel = (field, value) => (
    taxonomyLabels[field]?.[value]?.[language()] || valueLabel(value)
  );
  const domainLabels = {
    runtime_platform: { en: "Runtime and platform", zh: "运行时与平台" },
    kv_state_data_path: { en: "KV state and data path", zh: "KV 状态与数据路径" },
    compiler_runtime: { en: "Compiler and runtime substrate", zh: "编译器与运行时底座" },
    development_operations: { en: "Development and operations", zh: "开发与运维" },
    evidence_analysis: { en: "Evidence and analysis", zh: "评测与分析" },
    documentation_product: { en: "Documentation and product", zh: "文档与产品" },
    applications_research: { en: "Applications and research", zh: "应用与研究" }
  };

  const isWorkshopMod = (item) => {
    const kind = taxonomyProfile(item).kind;
    return Boolean(kind) && (item.public_surface !== false || kind === "retired");
  };

  function catalogProjects() {
    const projects = new Map();
    registry.components.filter(isWorkshopMod).forEach((item) => {
      const key = item.catalog_project_id || item.id;
      if (!projects.has(key)) projects.set(key, []);
      projects.get(key).push(item);
    });
    return [...projects.entries()].map(([id, items]) => {
      const primaryId = items.find((item) => item.catalog_primary_component)
        ?.catalog_primary_component;
      const primary = items.find((item) => item.id === primaryId) || items[0];
      return { id, items, primary };
    });
  }
  const compatibilityLabels = {
    ready: { en: "Ready", zh: "可用" },
    verified: { en: "Verified", zh: "已验证" },
    experimental: { en: "Experimental", zh: "实验性" },
    inspect_only: { en: "Inspect only", zh: "仅检查" },
    external_service: { en: "External service", zh: "外部服务" },
    source_scaffold: { en: "Source scaffold", zh: "源码脚手架" },
    unsupported: { en: "Unsupported", zh: "不支持" }
  };
  const publicEffectLabels = {
    measured: { en: "Measured", zh: "公开实测" },
    validated: { en: "Validated", zh: "已验证" },
    inconclusive: { en: "Inconclusive", zh: "效果未定" },
    "not-beneficial-in-tested-cell": { en: "Not beneficial in tested cell", zh: "已测单元不具收益" },
    beneficial: { en: "Beneficial", zh: "有收益" },
    preview: { en: "Preview", zh: "能力预览" }
  };
  const quickStarts = {
    "vllm-hust-opset": {
      title_en: "Install and check OPset",
      title_zh: "安装并检查 OPset",
      action_en: "installation and checks",
      action_zh: "安装与检查命令",
      note_en: "Use the pinned Ascend 910B2 Graph environment and source revisions documented by OPset. Enable only after compatibility checks; this is not a general ACLNN or eager optimization.",
      note_zh: "须使用 OPset 文档中的 Ascend 910B2 Graph 固定环境与源码版本，通过兼容性检查后再启用；不适用于普通 ACLNN 或 eager 路径。",
      command: `python -m pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
python -m pip install vllm-hust-opset==0.3.2
vllm-hust-opset --vllm-src /path/to/vllm --vllm-ascend-src /path/to/vllm-ascend-hust
vllm-hust-ext extension check org.vllm-hust.operator-optimizations
vllm-hust-ext extension enable org.vllm-hust.operator-optimizations`
    },
    "kv-tiering-migration": {
      title_en: "Inspect the pinned KV Tiering candidate",
      title_zh: "检查固定版本的 KV Tiering 候选实现",
      action_en: "inspection commands",
      action_zh: "检查命令",
      note_en: "Experimental pinned setting only. Requires the pinned Host hybrid-prefix fix, compatible Ascend runtime, and explicit CPU/storage budgets before activation. These commands install and inspect; see PR #3 for qualification and the exact runtime scope.",
      note_zh: "仅限实验中的固定设定。启用前需要固定版本的 Host 混合前缀修复、配套 Ascend 运行时，并配置 CPU 与存储预算。以下命令用于安装和检查；资格结果及适配范围见 PR #3。",
      guide: "https://github.com/vLLM-HUST/vllm-hust-kv-tiering/pull/3",
      guide_en: "Pinned runtime and qualification →",
      guide_zh: "固定运行时与资格验证 →",
      command: `python -m pip install --no-deps "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git@cf1ea71e3e2cb81ab06267ef05eddb3e580ea20b"
python -m pip install --no-deps "git+https://github.com/vLLM-HUST/vllm-hust-kv-tiering.git@7ba646a780c3bd0a8906309ea59719f5ccf6187e"
vllm-hust-ext extension inspect org.vllm-hust.kv-tiering
vllm-hust-ext extension check org.vllm-hust.kv-tiering`
    },
    "simllm-migration": {
      title_en: "Install and start SimLLM",
      title_zh: "安装并启动 SimLLM",
      note_en: "Use the exact tested vLLM Ascend host and Qwen3.5 settings. The published gain is specific to a fixed-card, one-output-token similarity workload and primarily reflects prefill reuse.",
      note_zh: "请使用精确匹配的 vLLM Ascend 宿主与 Qwen3.5 配置。已发布收益来自固定卡、单输出 token 的相似任务负载，主要反映 prefill 复用。",
      command: `python -m pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git@main"
python -m pip install "git+https://github.com/vLLM-HUST/vllm-ascend-simllm-hust.git@1110fe5b1a029bcaed3efd8dba0b2801c4287e75"
vllm-hust-ext extension check org.vllm-hust.simllm
vllm-hust-ext extension enable org.vllm-hust.simllm
VLLM_ASCEND_SIMLLM_ENABLED=1 vllm-hust-ext run -- vllm serve /path/to/model --block-size 128`
    },
    traceloom: {
      title_en: "Install the TraceLoom runtime plugin",
      title_zh: "安装 TraceLoom 运行时插件",
      note_en: "Use an existing compatible vLLM environment. This patch-free mode records scheduler context only, not device associations. See the project page for standalone analysis and execution-linked capture.",
      note_zh: "在已有的兼容 vLLM 环境中运行。此无补丁模式仅记录 scheduler 上下文，不建立设备关联。独立分析与 execution-linked 采集见项目页。",
      command: String.raw`python -m pip install traceloom==0.1.4
export TRACELOOM_CONTEXT_DIR=./traceloom-context
export TRACELOOM_RUN_ID=inference-study-001
vllm serve /path/to/model --async-scheduling \
  --scheduler-cls traceloom.vllm.TracingAsyncScheduler \
  --host 127.0.0.1 --port 8000`
    },
    "clm-lifecycle": {
      title_en: "Install and inspect CLM Lifecycle",
      title_zh: "安装并检查 CLM 生命周期控制面",
      action_en: "inspection commands",
      action_zh: "检查命令",
      note_en: "Requires a host exposing vllm.request-lifecycle.v1. With no controller endpoint configured, the component remains observation-only and claims no throughput benefit.",
      note_zh: "要求宿主提供 vllm.request-lifecycle.v1；未配置控制器端点时仅进行观察，不声明吞吐收益。",
      command: `python -m pip install vllm-hust-clm-lifecycle==0.1.1
vllm-hust-ext extension inspect org.vllm-hust.clm-lifecycle
vllm-hust-ext extension check org.vllm-hust.clm-lifecycle
export VLLM_PLUGINS=ascend,clm_lifecycle`
    },
    adm: {
      title_en: "Inspect and stage Ascend Distributed Metadata",
      title_zh: "检查并暂存昇腾分布式元数据 MOD",
      action_en: "ECPA staging commands",
      action_zh: "ECPA 暂存命令",
      note_en: "This records activation intent only. Launch requires the exact qualified vLLM-HUST and vLLM-Ascend-HUST revisions; import or enablement alone is not runtime-effective evidence and does not broaden the published DP4 result.",
      note_zh: "这里只记录启用意图。启动仍要求精确匹配已验收的 vLLM-HUST 与 vLLM-Ascend-HUST 提交；仅导入或启用不是 runtime_effective 证据，也不会扩大已发布的 DP4 结果。",
      command: `python -m pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
python -m pip install "git+https://github.com/vLLM-HUST/ascend-distributed-metadata.git@462e0750faf7eea6317b13b692fb3326894d5796"
vllm-hust-ext extension inspect org.vllm-hust.ascend-distributed-metadata
vllm-hust-ext extension check org.vllm-hust.ascend-distributed-metadata
vllm-hust-ext extension enable org.vllm-hust.ascend-distributed-metadata
vllm-hust-ext extension plan org.vllm-hust.ascend-distributed-metadata`
    },
    "tricard-clm-lifecycle": {
      title_en: "Inspect and stage Tricard CLM Lifecycle",
      title_zh: "检查并暂存 Tricard CLM 生命周期插件",
      action_en: "ECPA staging commands",
      action_zh: "ECPA 暂存命令",
      note_en: "The external controller remains operator-owned. Enablement records intent; runtime effectiveness still requires an observer receipt owned by the launched host process.",
      note_zh: "外部 controller 仍由 operator 管理。enable 只记录意图；运行生效仍须由启动后的宿主进程提供其自有 observer receipt。",
      command: `python -m pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
python -m pip install "git+https://github.com/vLLM-HUST/Tricard.git@1d141da1c427a18859643b056b5514f5ebf511ce#subdirectory=plugins/vllm-clm"
vllm-hust-ext extension inspect org.vllm-hust.tricard-clm
vllm-hust-ext extension check org.vllm-hust.tricard-clm
vllm-hust-ext extension enable org.vllm-hust.tricard-clm
vllm-hust-ext extension plan org.vllm-hust.tricard-clm`
    },
    betterscale: {
      guide: "./betterscale.html#install-qwen",
      guide_en: "Qwen27 TP2: pip install, launch and request →",
      guide_zh: "Qwen27 TP2：pip 安装、启动与请求验证 →",
      title_en: "DSV4 · install + start DP8",
      title_zh: "DSV4 · 安装＋启动 DP8",
      note_en: "Run ONE configuration in your existing pinned vLLM 0.25.1 / Ascend 0.25.1rc1 environment. Replace /models/DeepSeek-V4-Flash with your W8A8 checkpoint; eight free 910B2 cards are required. Health: curl --fail http://127.0.0.1:8000/health",
      note_zh: "选择一种配置运行，使用已有 pinned vLLM 0.25.1 / Ascend 0.25.1rc1 环境。替换 /models/DeepSeek-V4-Flash 为 W8A8 权重路径，需要八张空闲 910B2。健康检查：curl --fail http://127.0.0.1:8000/health",
      command: String.raw`python -m pip install --no-deps vllm-betterscale==0.5.1
vllm serve /models/DeepSeek-V4-Flash \
  --worker-cls betterscale.worker.Worker \
  --tensor-parallel-size 1 --data-parallel-size 8 --data-parallel-size-local 8 --enable-expert-parallel \
  --quantization ascend --dtype bfloat16 \
  --distributed-executor-backend mp --async-scheduling \
  --max-num-seqs 2 --max-num-batched-tokens 1026 --max-model-len 524288 \
  --enable-prefix-caching \
  --speculative-config '{"method":"dspark","num_speculative_tokens":5,"enforce_eager":true}' \
  --compilation-config '{"cudagraph_mode":"FULL","cudagraph_capture_sizes":[6,12,132,264,516,1026],"max_cudagraph_capture_size":1026}' \
  --additional-config '{"enable_dsa_cp":false,"multistream_overlap_shared_expert":true,"ascend_compilation_config":{"enable_npugraph_ex":true,"enable_static_kernel":false}}' \
  --host 127.0.0.1 --port 8000 --served-model-name dsv4`,
      alternative: {
        title_en: "Alternatively: TP8 · four active requests",
        title_zh: "另一种配置：TP8 · 四个活跃请求",
        command: String.raw`python -m pip install --no-deps vllm-betterscale==0.5.1
vllm serve /models/DeepSeek-V4-Flash \
  --worker-cls betterscale.worker.Worker \
  --tensor-parallel-size 8 --enable-expert-parallel \
  --quantization ascend --dtype bfloat16 \
  --distributed-executor-backend mp --async-scheduling \
  --max-num-seqs 4 --max-num-batched-tokens 4128 --max-model-len 524288 \
  --enable-prefix-caching \
  --speculative-config '{"method":"dspark","num_speculative_tokens":5,"enforce_eager":true}' \
  --compilation-config '{"cudagraph_mode":"FULL","cudagraph_capture_sizes":[24,4128],"max_cudagraph_capture_size":4128}' \
  --additional-config '{"enable_dsa_cp":true,"multistream_overlap_shared_expert":true,"ascend_compilation_config":{"enable_npugraph_ex":true,"enable_static_kernel":false}}' \
  --host 127.0.0.1 --port 8000 --served-model-name dsv4`
      }
    },
    bidkv: {
      title_en: "Install and start BidKV",
      title_zh: "安装并启动 BidKV",
      note_en: "Qualified on vLLM-HUST 0.28.1rc1.dev319 / Ascend 0.25.1rc1, Qwen3.8-27B, TP4 graph; verify exact artifacts before enabling.",
      note_zh: "已在 vLLM-HUST 0.28.1rc1.dev319 / Ascend 0.25.1rc1、Qwen3.8-27B、TP4 graph 验证；启用前须核对精确制品。",
      command: `pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
pip install bidkv
vllm-hust-ext extension check org.vllm-hust.bidkv
vllm-hust-ext extension enable org.vllm-hust.bidkv
vllm-hust-ext run -- vllm serve /path/to/model`
    },
    diffspec: {
      title_en: "Configure and start DiffSpec",
      title_zh: "配置并启动 DiffSpec",
      note_en: "Prepare diffspec.json with the draft model configuration first.",
      note_zh: "请先在 diffspec.json 中填写 draft model 配置。",
      command: `pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
pip install "vllm-diffspec @ git+https://github.com/vLLM-HUST/vllm-ascend-hust-diffspec.git"
vllm-hust-ext extension configure org.vllm-hust.diffspec --file diffspec.json
vllm-hust-ext extension check org.vllm-hust.diffspec
vllm-hust-ext extension enable org.vllm-hust.diffspec
vllm-hust-ext run -- vllm serve /path/to/target-model`
    },
    vspec: {
      title_en: "Install and start vSpec",
      title_zh: "安装并启动 vSpec",
      note_en: "Use the published Qwen2.5 target/drafter pair, then check the host ABI before enabling the plugin.",
      note_zh: "请使用已发布的 Qwen2.5 target/drafter 组合，并在启用插件前检查宿主 ABI。",
      command: `python -m pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git@main"
python -m pip install /path/to/vllm_hust_vspec-0.13.2-py3-none-any.whl
vllm-hust-vspec-models
vllm-hust-ext extension inspect org.vllm-hust.vspec
vllm-hust-vspec-doctor --method eagle
vllm-hust-ext extension enable org.vllm-hust.vspec
vllm-hust-ext run -- vllm-hust-vspec --method eagle --target-model /path/to/Qwen2.5-14B-Instruct --gamma 2 --graph-mode full`
    },
    latchmoe: {
      title_en: "Install and start LatchMoE",
      title_zh: "安装并启动 LatchMoE",
      note_en: "Qwen3.8-27B is not applicable. Qwen3-30B-A3B is functionally qualified on the exact Core 762f85b3 / Ascend 4e57439e TP4 PIECEWISE graph lane.",
      note_zh: "不适用于 Qwen3.8-27B；Qwen3-30B-A3B 已在精确 Core 762f85b3 / Ascend 4e57439e TP4 PIECEWISE graph 通道通过功能验证。",
      command: `pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
pip install git+https://github.com/vLLM-HUST/vllm-ascend-hust-LatchMoE.git
latchmoe check
latchmoe serve /path/to/model`
    },
    "pegaflow-vllm-connectors": {
      title_en: "Configure the PegaFlow connector",
      title_zh: "配置 PegaFlow Connector",
      action_en: "configuration commands",
      action_zh: "配置命令",
      note_en: "PegaFlow is operated separately; the Manager checks health and never starts, stops, or clears the service.",
      note_zh: "PegaFlow 服务由外部单独运维；Manager 只检查健康状态，不启动、停止或清空服务。",
      command: `pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
pip install "git+https://github.com/vLLM-HUST/pegaflow-hust.git#subdirectory=extension-provider"
vllm-hust-ext extension configure org.vllm-hust.pegaflow --file pegaflow.json
vllm-hust-ext extension check org.vllm-hust.pegaflow
vllm-hust-ext extension plan org.vllm-hust.pegaflow`
    },
    "ascend-adaptive-quantized-kv": {
      title_en: "Install and inspect Adaptive Quantized KV",
      title_zh: "安装并检查 Adaptive Quantized KV",
      action_en: "inspection commands",
      action_zh: "检查命令",
      note_en: "Import-only descriptor: inspection is supported, enablement is intentionally refused.",
      note_zh: "当前为 import-only 描述包：支持检查，明确拒绝启用。",
      command: `pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
pip install git+https://github.com/vLLM-HUST/vllm-ascend-adaptive-quantized-kv-hust.git
vllm-hust-ext extension inspect org.vllm-hust.ascend-adaptive-quantized-kv
vllm-hust-ext extension check org.vllm-hust.ascend-adaptive-quantized-kv`
    },
    "ascend-quant-runtime-descriptor": {
      title_en: "Install and inspect Ascend Quant Runtime",
      title_zh: "安装并检查 Ascend Quant Runtime",
      action_en: "inspection commands",
      action_zh: "检查命令",
      note_en: "Import-only validator: no model loading, kernel selection, or runtime activation.",
      note_zh: "当前为 import-only 校验器：不加载模型、不选择内核、不激活运行时。",
      command: `pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
pip install "git+https://github.com/vLLM-HUST/vllm-ascend-quant-hust.git#subdirectory=runtime-extension"
vllm-hust-ext extension inspect org.vllm-hust.ascend-quant-runtime
vllm-hust-ext extension check org.vllm-hust.ascend-quant-runtime`
    },
    "kvcompress-ascend": {
      title_en: "Install and start Ascend KV Compression",
      title_zh: "安装并启动昇腾 KV 压缩",
      note_en: "ECPA enables the plugin; the compression profile and full serving configuration remain explicit inputs.",
      note_zh: "ECPA 负责启用插件；压缩 profile 与完整服务配置仍需显式提供。",
      command: `pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
pip install git+https://github.com/vLLM-HUST/vllm-ascend-kvcompress-hust.git
vllm-hust-ext extension check org.vllm-hust.ascend-kvcompress
vllm-hust-ext extension enable org.vllm-hust.ascend-kvcompress
export VLLM_ASCEND_KVCOMPRESS_CONFIG=/path/to/qwen35-triattention.json
export VLLM_ASCEND_KVCOMPRESS_QWEN_GDN_LIST_COMPAT=1
vllm-hust-ext run -- python -m vllm.entrypoints.cli.main serve /path/to/model \\
  --tensor-parallel-size 2 \\
  --pipeline-parallel-size 1 \\
  --dtype bfloat16 \\
  --kv-cache-dtype auto \\
  --max-model-len 262144 \\
  --max-num-seqs 16 \\
  --max-num-batched-tokens 4096 \\
  --enable-prefix-caching \\
  --mamba-cache-mode align \\
  --async-scheduling \\
  --compilation-config '{"cudagraph_mode":"FULL_AND_PIECEWISE","cudagraph_capture_sizes":[3,6,12,24,48],"max_cudagraph_capture_size":48}' \\
  --speculative-config '{"method":"mtp","num_speculative_tokens":2}' \\
  --kv-cache-memory-bytes 26038239232`
    }
  };
  const inspectableBundles = {
    "quantized-kv-cache-migration": "org.vllm-hust.quantized-kv-cache",
    "unified-communication-migration": "org.vllm-hust.unified-communication",
    "split-batch-full-graph-migration": "org.vllm-hust.split-batch-full-graph",
    "kv-transfer-observability-migration": "org.vllm-hust.kv-transfer-observability",
    "layered-prefill-migration": "org.vllm-hust.layered-prefill",
    "activation-sparsity-migration": "org.vllm-hust.activation-sparsity",
    "pipeline-microbatch-migration": "org.vllm-hust.pipeline-microbatch",
    "qos-scheduler-migration": "org.vllm-hust.qos-scheduler",
    "stateharbor": "org.vllm-hust.stateharbor",
    "clm-lifecycle": "org.vllm-hust.clm-lifecycle",
    "request-lifecycle-profiler": "org.vllm-hust.request-lifecycle-profiler",
    "quality-bounded-inference": "org.intellistream.quality-bounded-inference",
    "llm-serving-cost-pricing-model": "org.vllm-hust.llm-serving-cost-pricing-model"
  };

  const valueLabel = (value) => String(value).replaceAll("_", " ");
  const typeTitle = (type) => (typeLabels[type] || { en: valueLabel(type), zh: valueLabel(type) })[language()];
  const domainTitle = (domain) => (
    domainLabels[domain] || { en: valueLabel(domain), zh: valueLabel(domain) }
  )[language()];

  function renderFilters() {
    filters.replaceChildren();
    ["extensions", "runtime_mod", "connector_mod", "tool_mod", "control_plane", "external_system", "retired"].forEach((type) => {
      const title = copy()[type];
      const button = element("button", `plugin-filter${selectedType === type ? " active" : ""}`, title);
      button.type = "button";
      button.dataset.layer = type;
      button.setAttribute("aria-pressed", String(selectedType === type));
      button.addEventListener("click", () => {
        selectedType = type;
        renderFilters();
        renderWorkloadNavigation();
        renderCatalog();
      });
      filters.append(button);
    });
  }

  function badge(text, className = "") {
    return element("span", `plugin-badge ${className}`.trim(), text);
  }

  function traitProfile(traitId) {
    return workloadNavigation.traits[traitId] || {};
  }

  function traitLabel(traitId) {
    const profile = traitProfile(traitId);
    return local(profile, "label") || valueLabel(traitId);
  }

  function matchesSelectedType(item) {
    return selectedType === "extensions" || taxonomyProfile(item).kind === selectedType;
  }

  function itemSearchText(item) {
    const workloadText = (workloadNavigation.plugins[item.id] || []).flatMap((traitId) => {
      const profile = traitProfile(traitId);
      return [traitId, profile.label_en, profile.label_zh, profile.description_en, profile.description_zh];
    });
    const metadata = workshopMetadata[item.id] || {};
    const taxonomy = taxonomyProfile(item);
    const peopleText = [
      ...(metadata.maintainers || []).flatMap((person) => [person.name, person.login]),
      ...(metadata.advisors || []).flatMap((advisor) => [
        advisor.name_en, advisor.name_zh, advisor.affiliation_en, advisor.affiliation_zh
      ])
    ].filter(Boolean);
    return [
      item.id, item.name, item.name_en, item.name_zh, local(item, "summary"),
      local(item, "catalog_project_name"), local(item, "catalog_project_summary"),
      local(item, "catalog_role"), local(item, "catalog_independent_reason"), item.artifact_type,
      item.system_role, item.delivery_model, item.ownership, item.maturity,
      item.repository_relationship, item.evidence_level, item.execution_planes.join(" "),
      item.integration_contracts.join(" "), (item.integration_surfaces || []).join(" "),
      taxonomy.kind, taxonomy.capability, taxonomy.lifecycle, taxonomy.evidence,
      item.canonical_repository || "", item.upstream_repository || "", ...workloadText, ...peopleText
    ].join(" ").toLowerCase();
  }

  function renderWorkloadNavigation() {
    if (!workloadFilters || !workloadDescription || !registry) return;
    workloadFilters.replaceChildren();
    const options = ["all", ...Object.keys(workloadNavigation.traits)];
    const query = search.value.trim().toLowerCase();
    options.forEach((traitId) => {
      const isAll = traitId === "all";
      const count = catalogProjects().filter((project) => project.items.some((item) => (
        matchesSelectedType(item)
        && itemSearchText(item).includes(query)
        && (isAll || (workloadNavigation.plugins[item.id] || []).includes(traitId))
      ))).length;
      const button = element(
        "button",
        `workload-filter${selectedWorkload === traitId ? " active" : ""}`
      );
      button.type = "button";
      button.dataset.workload = traitId;
      button.setAttribute("aria-pressed", String(selectedWorkload === traitId));
      button.append(
        element("span", "", isAll ? copy().allWorkloads : traitLabel(traitId)),
        element("strong", "", String(count))
      );
      button.addEventListener("click", () => {
        selectedWorkload = traitId;
        renderWorkloadNavigation();
        renderCatalog();
        workloadFilters.querySelector(`[data-workload="${traitId}"]`)?.focus({ preventScroll: true });
      });
      workloadFilters.append(button);
    });
    workloadDescription.textContent = selectedWorkload === "all"
      ? copy().allWorkloadDescription
      : local(traitProfile(selectedWorkload), "description");
  }

  function workloadTags(item) {
    const traits = workloadNavigation.plugins[item.id] || [];
    if (!traits.length) return null;
    const panel = element("div", "plugin-workload-tags");
    panel.append(element("span", "plugin-workload-label", copy().workloadTraits));
    traits.forEach((traitId) => {
      const tag = element("button", "plugin-workload-tag", traitLabel(traitId));
      tag.type = "button";
      tag.addEventListener("click", () => {
        selectedWorkload = traitId;
        renderWorkloadNavigation();
        renderCatalog();
      });
      panel.append(tag);
    });
    return panel;
  }

  function quickStart(item) {
    const extensionId = inspectableBundles[item.id];
    const value = quickStarts[item.id] || (extensionId ? {
      title_en: `Install and inspect ${item.name_en}`,
      title_zh: `安装并检查${item.name_zh}`,
      action_en: "inspection commands",
      action_zh: "检查命令",
      note_en: "Import-only contract package: install, inspect, and check are supported; enablement and serving are intentionally unavailable.",
      note_zh: "当前为 import-only 合同包：支持安装、inspect 与 check；明确不提供启用和启动命令。",
      command: `pip install "vllm-hust-ext @ git+https://github.com/vLLM-HUST/extension-manager.git"
pip install "git+${item.canonical_repository}.git"
vllm-hust-ext extension inspect ${extensionId}
vllm-hust-ext extension check ${extensionId}`
    } : null);
    if (!value) return null;
    const launcher = element("div", "plugin-launcher");
    const trigger = element("button", "plugin-launch-icon");
    const tooltip = element("div", "plugin-launch-tooltip");
    const tooltipId = `plugin-launch-${item.id}`;
    trigger.type = "button";
    const action = local(value, "action") || (
      language() === "zh" ? "启动命令" : "launch command"
    );
    const buttonText = local(value, "action") || copy().installRun;
    trigger.append(element("span", "plugin-launch-glyph", ">_"), element("span", "plugin-launch-action", buttonText));
    trigger.setAttribute("aria-label", `${item.name} ${action}`);
    trigger.setAttribute("aria-describedby", tooltipId);
    trigger.setAttribute("aria-expanded", "false");
    tooltip.id = tooltipId;
    tooltip.setAttribute("role", "tooltip");
    const pre = element("pre");
    pre.append(element("code", "", value.command));
    tooltip.append(
      element("strong", "plugin-launch-title", local(value, "title")),
      pre,
      element("span", "plugin-launch-note", local(value, "note"))
    );
    if (value.guide) {
      const guide = element("a", "plugin-launch-note", local(value, "guide"));
      guide.href = value.guide;
      tooltip.append(guide);
    }
    if (value.alternative) {
      const details = element("details");
      const alternativePre = element("pre");
      alternativePre.append(element("code", "", value.alternative.command));
      details.append(element("summary", "", local(value.alternative, "title")), alternativePre);
      tooltip.append(details);
    }
    trigger.addEventListener("click", () => {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      launcher.classList.toggle("open", !expanded);
      trigger.setAttribute("aria-expanded", String(!expanded));
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      launcher.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      trigger.blur();
    });
    launcher.addEventListener("focusout", (event) => {
      if (event.relatedTarget && launcher.contains(event.relatedTarget)) return;
      launcher.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    });
    launcher.append(trigger, tooltip);
    return launcher;
  }

  function communityPanel(item) {
    const metadata = workshopMetadata[item.id];
    if (!metadata || !Array.isArray(metadata.maintainers) || !metadata.metrics) return null;

    const panel = element("section", "plugin-community");
    const people = element("div", "plugin-maintainers");
    const maintainerLabel = item.contribution_scope === "local_adaptation"
      ? copy().adaptationMaintainers
      : copy().maintainers;
    people.append(element("span", "plugin-community-label", maintainerLabel));
    const list = element("div", "plugin-maintainer-list");
    metadata.maintainers.forEach((maintainer) => {
      const link = element("a", "plugin-maintainer");
      link.href = maintainer.profile_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const avatar = element("img", "plugin-maintainer-avatar");
      avatar.src = maintainer.avatar_url;
      avatar.alt = "";
      avatar.width = 28;
      avatar.height = 28;
      avatar.loading = "lazy";
      const identity = element("span", "plugin-maintainer-identity");
      identity.append(
        element("strong", "", maintainer.name),
        element("small", "", `@${maintainer.login}`)
      );
      link.append(avatar, identity);
      list.append(link);
    });
    people.append(list);
    const noAdvisor = Array.isArray(item.advisors) && item.advisors.length === 0;
    const advisorRecords = noAdvisor ? [] : (Array.isArray(metadata.advisors) ? metadata.advisors : []);
    const internalAdvisors = advisorRecords.filter((advisor) => advisor.relationship !== "external_contributor");
    const externalAdvisors = advisorRecords.filter((advisor) => advisor.relationship === "external_contributor");
    const advisors = element("div", "plugin-advisors");
    advisors.append(element("span", "plugin-community-label", copy().advisors));
    const advisorNames = internalAdvisors
      .map((advisor) => advisor[`name_${language()}`] || advisor.name_en)
      .filter(Boolean);
    advisors.append(element("strong", "plugin-advisor-names", advisorNames.join(" · ") || (
      externalAdvisors.length ? "—" : copy().advisorUnknown
    )));

    const externalRelationships = element("div", "plugin-external-advisors");
    externalAdvisors.forEach((advisor) => {
      const relationship = element("div", "plugin-external-advisor");
      const name = advisor[`name_${language()}`] || advisor.name_en;
      const affiliation = advisor[`affiliation_${language()}`] || advisor.affiliation_en;
      relationship.append(
        element("span", "plugin-community-label", copy().externalAdvisor),
        element("strong", "plugin-advisor-names", [name, affiliation].filter(Boolean).join(" · ")),
        badge(copy().externalContributor, "external-contributor")
      );
      externalRelationships.append(relationship);
    });

    const metrics = element("div", "plugin-repo-metrics");
    [
      [copy().stars, metadata.metrics.stars, `${metadata.repository_url}/stargazers`],
      [copy().pullRequests, metadata.metrics.open_pull_requests, `${metadata.repository_url}/pulls`],
      [copy().forks, metadata.metrics.forks, `${metadata.repository_url}/forks`]
    ].forEach(([label, value, href]) => {
      const link = element(value == null ? "span" : "a", "plugin-repo-metric");
      if (value != null) link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(element("strong", "", value == null ? "—" : String(value)), element("span", "", label));
      metrics.append(link);
    });
    panel.append(people);
    if (!noAdvisor && (internalAdvisors.length || !externalAdvisors.length)) panel.append(advisors);
    if (externalAdvisors.length) panel.append(externalRelationships);
    panel.append(metrics);
    return panel;
  }

  function projectComponentsPanel(items) {
    if (!Array.isArray(items) || items.length < 2) return null;
    const panel = element("section", "plugin-project-components");
    panel.append(element("span", "plugin-community-label", copy().projectComponents));
    const list = element("div", "plugin-project-component-list");
    items.forEach((component) => {
      const row = element("div", "plugin-project-component");
      const heading = element("div", "plugin-project-component-head");
      heading.append(
        element("strong", "", local(component, "name")),
        badge(taxonomyLabel("kind", taxonomyProfile(component).kind), "project-component-kind")
      );
      row.append(heading);
      const role = local(component, "catalog_role") || local(component, "summary");
      if (role) row.append(element("p", "", role));
      if (component.canonical_repository) {
        const repository = element("a", "plugin-project-component-repository", `${copy().componentRepository} ↗`);
        repository.href = component.canonical_repository;
        repository.target = "_blank";
        repository.rel = "noopener noreferrer";
        row.append(repository);
      }
      list.append(row);
    });
    panel.append(list);
    return panel;
  }

  function compatibilityPanel(item) {
    const profile = item.compatibility;
    if (!profile) return null;
    const panel = element("section", `plugin-compatibility compatibility-${profile.status}`);
    const head = element("div", "plugin-compatibility-head");
    const statusLabel = compatibilityLabels[profile.status] || {
      en: valueLabel(profile.status), zh: valueLabel(profile.status)
    };
    head.append(
      element("span", "plugin-interface-label", copy().compatibility),
      badge(statusLabel[language()], `compatibility-status status-${profile.status}`)
    );
    const facts = element("dl", "plugin-compatibility-facts");
    [
      [copy().host, profile.host],
      [copy().versions, profile.versions?.join(" · ")],
      [copy().platforms, profile.platforms?.join(" · ")],
      [copy().models, profile.models?.join(" · ")]
    ].filter(([, value]) => value).forEach(([label, value]) => {
      const row = element("div");
      row.append(element("dt", "", label), element("dd", "", value));
      facts.append(row);
    });
    panel.append(head, facts);
    const requirements = local(profile, "requirements");
    if (requirements) {
      const note = element("p", "plugin-compatibility-note");
      note.append(element("strong", "", `${copy().requirements}: `), document.createTextNode(requirements));
      panel.append(note);
    }
    if (profile.followup_url) {
      const followup = element("a", "plugin-compatibility-followup", copy().followup);
      followup.href = profile.followup_url;
      followup.target = "_blank";
      followup.rel = "noopener noreferrer";
      panel.append(followup);
    }
    return panel;
  }

  function compatibilityDetails(item) {
    const profile = item.compatibility;
    if (!profile) return null;
    const block = element("section", "plugin-compatibility-details");
    const facts = element("dl", "plugin-component-facts compatibility-detail-facts");
    [
      ...(profile.python?.length ? [[copy().python, profile.python.join(" · ")]] : []),
      [copy().requirements, local(profile, "requirements")]
    ].filter(([, value]) => value).forEach(([label, value]) => {
      const row = element("div");
      row.append(element("dt", "", label), element("dd", "", value));
      facts.append(row);
    });
    if (!facts.children.length) return null;
    block.append(facts);
    return block;
  }

  function coverTone(item) {
    const role = `${item.id || ""} ${item.system_role || ""}`;
    if (/observ|telemetry|metric|trace/.test(role)) return "sky";
    if (/moe|expert|operator/.test(role)) return "forest";
    if (/quant|spars|compress|activation/.test(role)) return "violet";
    if (/spec|decod/.test(role)) return "indigo";
    if (/scheduler|qos|prefill|batch/.test(role)) return "ember";
    if (/kv|cache|transfer|offload/.test(role)) return "lagoon";
    return "graphite";
  }

  function performancePanel(result) {
    const panel = element("div", "plugin-performance");
    const zh = language() === "zh";
    const format = value => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    const measured = result && Number.isFinite(result.gain);
    const value = measured ? format(result.gain) : (zh ? "缺数据" : "No data");
    panel.append(element("strong", measured && result.gain < 0 ? "performance-negative" : "", value));
    if (measured) {
      panel.append(element("span", "", [
        result.modelLabel,
        local(result, "setting_label"),
        zh ? "输出吞吐" : "Output throughput"
      ].filter(Boolean).join(" · ")));
      const aggregationNote = local(result, "aggregation_note");
      if (aggregationNote) panel.append(element("span", "plugin-performance-aggregation", aggregationNote));
      if (result.runtimeBase) {
        const ascend = result.runtimeBase["vllm-ascend"] || result.runtimeBase.vllm_ascend;
        panel.append(element("span", "plugin-performance-runtime",
          `vLLM ${result.runtimeBase.vllm.slice(0, 7)} · Ascend ${ascend.slice(0, 7)}`));
      }
      const matchedSetting = result.source === "frontier";
      const link = element("a", "plugin-public-effect-link", matchedSetting ? (zh ? "设定 ↗" : "Setting ↗") : (zh ? "实测 ↗" : "Evidence ↗"));
      link.href = matchedSetting
        ? `./leaderboard-runs.html?setting=${encodeURIComponent(result.cohortId)}#settings`
        : result.url;
      link.target = matchedSetting ? "" : "_blank";
      link.rel = matchedSetting ? "" : "noopener noreferrer";
      link.title = matchedSetting
        ? (zh ? "C1/2/4/8/16 吞吐比的几何平均。" : "Geometric mean of C1/2/4/8/16 throughput ratios. ")
          + result.comparisons.map(row => `C${row.concurrency}: ${format(row.gain)}`).join(" · ")
        : [...new Set(result.published_comparisons.map(row => row.scope))].join(" · ");
      panel.append(link);
    }
    return panel;
  }

  function publicEffectPanel(item) {
    if (performanceResults.has(item.id)) return null;
    const result = local(item, "public_effect");
    if (!result || !item.public_effect_status || !item.public_effect_url) return null;
    const panel = element("section", `plugin-public-effect effect-${item.public_effect_status}`);
    const head = element("div", "plugin-public-effect-head");
    const statusLabel = publicEffectLabels[item.public_effect_status] || {
      en: valueLabel(item.public_effect_status), zh: valueLabel(item.public_effect_status)
    };
    head.append(
      element("strong", "plugin-public-effect-title", copy().publicEffect),
      badge(statusLabel[language()], `effect-status status-${item.public_effect_status}`)
    );
    const evidence = element("a", "plugin-public-effect-link", `${copy().effectSource} ↗`);
    evidence.href = item.public_effect_url;
    evidence.target = "_blank";
    evidence.rel = "noopener noreferrer";
    panel.append(head, element("p", "", result), evidence);
    return panel;
  }

  function installationStatus(item) {
    if (item.compatibility?.status !== "source_scaffold") return null;
    const panel = element("section", "plugin-install-state unavailable");
    panel.append(
      element("strong", "", copy().notInstallable),
      element("p", "", copy().notInstallableReason)
    );
    return panel;
  }

  function renderCard(item, projectItems = [item]) {
    const isUpstreamFork = item.repository_relationship === "upstream_sync_fork";
    const taxonomy = taxonomyProfile(item);
    const card = element(
      "article",
      `plugin-card workshop-card workshop-${item.artifact_type} workshop-tone-${coverTone(item)}${isUpstreamFork ? " upstream-fork-card" : ""}`
    );
    card.id = item.id;
    card.dataset.projectComponentCount = String(projectItems.length);
    const cover = element("div", "workshop-cover");
    const displayName = local(item, "catalog_project_name") || local(item, "name");
    const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
    cover.append(
      element("span", "workshop-cover-type", taxonomyLabel("kind", taxonomy.kind)),
      element("strong", "workshop-cover-mark", initials)
    );
    const top = element("div", "plugin-card-top");
    top.append(element("span", "plugin-code", item.id));
    const launcher = quickStart(item);
    if (launcher) top.append(launcher);
    const badges = element("div", "plugin-badges");
    badges.append(
      badge(taxonomyLabel("kind", taxonomy.kind), `taxonomy-kind kind-${taxonomy.kind}`),
      badge(taxonomyLabel("lifecycle", taxonomy.lifecycle), `taxonomy-lifecycle lifecycle-${taxonomy.lifecycle}`)
    );
    if (isUpstreamFork) badges.prepend(badge(copy().forkBadge, "upstream-fork"));
    top.append(badges);

    const summary = local(item, "catalog_project_summary") || local(item, "summary");
    card.append(cover, top, element("h3", "", displayName), element("p", "plugin-summary", summary));
    const projectComponents = projectComponentsPanel(projectItems);
    if (projectComponents) card.append(projectComponents);
    const traits = workloadTags(item);
    if (traits) card.append(traits);
    if (isPerformanceCandidate(item)) {
      card.append(performancePanel(performanceResults.get(item.id)));
    }
    const community = communityPanel(item);
    if (community) card.append(community);
    const compatibility = compatibilityPanel(item);
    if (compatibility) card.append(compatibility);
    const installState = installationStatus(item);
    if (installState) card.append(installState);
    const details = element("details", "plugin-technical-details");
    details.append(element("summary", "", copy().details));
    const detailBody = element("div", "plugin-technical-body");
    const publicEffect = publicEffectPanel(item);
    if (publicEffect) detailBody.append(publicEffect);
    const compatibilityDetailsBlock = compatibilityDetails(item);
    if (compatibilityDetailsBlock) detailBody.append(compatibilityDetailsBlock);
    const facts = element("dl", "plugin-component-facts");
    [
      [copy().identity, taxonomyLabel("kind", taxonomy.kind)],
      [copy().capability, taxonomyLabel("capability", taxonomy.capability)],
      [copy().lifecycle, taxonomyLabel("lifecycle", taxonomy.lifecycle)],
      [copy().evidenceState, taxonomyLabel("evidence", taxonomy.evidence)],
      [copy().planes, item.execution_planes.map(valueLabel).join(" · ")],
      [copy().delivery, valueLabel(item.delivery_model)],
      [copy().ownership, valueLabel(item.ownership)],
      ...(local(item, "upstream_owner") ? [[copy().upstreamOwner, local(item, "upstream_owner")]] : []),
      ...(item.maintainers?.length ? [[item.contribution_scope === "local_adaptation" ? copy().adaptationMaintainers : copy().maintainers, item.maintainers.map((name) => `@${name}`).join(" · ")]] : []),
      [copy().repositoryRelationship, valueLabel(item.repository_relationship)],
      [copy().evidence, valueLabel(item.evidence_level)]
    ].forEach(([label, value]) => {
      const row = element("div");
      row.append(element("dt", "", label), element("dd", "", value));
      facts.append(row);
    });
    detailBody.append(facts);

    if (item.integration_contracts.length) {
      const contracts = element("div", "plugin-contracts typed-contracts");
      contracts.append(element("span", "plugin-interface-label", copy().contracts));
      item.integration_contracts.forEach((contract) => contracts.append(element("code", "", contract)));
      detailBody.append(contracts);
    }
    const surfaces = item.integration_surfaces || [];
    if (surfaces.length) {
      const surfaceList = element("div", "plugin-contracts integration-surfaces");
      surfaceList.append(element("span", "plugin-interface-label", copy().surfaces));
      surfaces.forEach((surface) => surfaceList.append(element("code", "", surface)));
      detailBody.append(surfaceList);
    }
    details.append(detailBody);
    card.append(details);

    const footer = element("div", "plugin-card-footer");
    footer.append(element("span", "plugin-kind", taxonomyLabel("capability", taxonomy.capability)));
    if (item.upstream_repository) {
      const upstream = element("a", "plugin-repository upstream", `${copy().upstream} ↗`);
      upstream.href = item.upstream_repository;
      upstream.target = "_blank";
      upstream.rel = "noopener noreferrer";
      footer.append(upstream);
    }
    if (item.documentation_url) {
      const detailsLink = element("a", "plugin-repository", language() === "zh" ? "项目介绍 →" : "Project details →");
      detailsLink.href = item.documentation_url;
      footer.append(detailsLink);
    }
    if (item.repository_visibility === "private") {
      footer.append(element("span", "plugin-repository withheld", language() === "zh" ? "私有仓库" : "Private repository"));
    } else if (item.canonical_repository) {
      const link = element("a", "plugin-repository", `${copy().repository} ↗`);
      link.href = item.canonical_repository;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      footer.append(link);
    } else {
      footer.append(element("span", "plugin-repository withheld", copy().noRepository));
    }
    card.append(footer);
    return card;
  }

  function renderBoundaries() {
    if (!adjacent) return;
    adjacent.replaceChildren();
    const boundaries = language() === "zh" ? [
      ["Plugin bundle", "负责交付、校验、启停与治理，不定义 scheduler、KV 或 platform 业务协议。"],
      ["KV connector", "是 vLLM 与状态系统的 scheduler/worker 适配契约，不等于存储系统本身。"],
      ["Control plane", "在 vLLM 进程外做跨实例决策，只通过版本化 action/receipt bridge 接入。"]
    ] : [
      ["Plugin bundle", "Owns delivery, validation, enablement, and governance; it does not redefine scheduler, KV, or platform protocols."],
      ["KV connector", "Is the scheduler/worker adapter between vLLM and a state system, not the storage system itself."],
      ["Control plane", "Makes cross-instance decisions outside vLLM and integrates only through versioned action/receipt bridges."]
    ];
    boundaries.forEach(([title, summary]) => {
      const card = element("article", "adjacent-card");
      card.append(element("span", "plugin-code", copy().boundaries), element("h3", "", title), element("p", "", summary));
      adjacent.append(card);
    });
  }

  function renderPortfolio() {
    if (!portfolio || !repositoryCatalog || !repositoryStatus) return;
    const query = search.value.trim().toLowerCase();
    const visible = portfolio.repositories.filter((repository) => [
      repository.name,
      repository.portfolio_domain,
      repository.repository_role,
      repository.relation_to_runtime,
      repository.lifecycle,
      repository.canonical_artifacts.join(" "),
      repository.component_ids.join(" ")
    ].join(" ").toLowerCase().includes(query));

    repositoryCatalog.replaceChildren();
    const domains = [...new Set(
      portfolio.repositories.map((item) => item.portfolio_domain)
    )];
    domains.forEach((domain) => {
      const repositories = visible.filter(
        (item) => item.portfolio_domain === domain
      );
      if (!repositories.length) return;
      const section = element("section", "repository-domain");
      const heading = element("div", "repository-domain-head");
      heading.append(
        element("h3", "", domainTitle(domain)),
        element("strong", "", String(repositories.length).padStart(2, "0"))
      );
      const grid = element("div", "repository-grid");
      repositories.forEach((repository) => {
        const card = element("article", "repository-card");
        const top = element("div", "plugin-card-top");
        top.append(element("span", "plugin-code", repository.repository_role));
        const badges = element("div", "plugin-badges");
        badges.append(
          badge(valueLabel(repository.lifecycle), `status-${repository.lifecycle}`)
        );
        top.append(badges);

        const name = element("a", "repository-name", repository.name);
        name.href = repository.url;
        name.target = "_blank";
        name.rel = "noopener noreferrer";
        const facts = element("dl", "plugin-component-facts");
        [
          [copy().relation, valueLabel(repository.relation_to_runtime)],
          [copy().artifacts, repository.canonical_artifacts.join(" · ")]
        ].forEach(([label, value]) => {
          const row = element("div");
          row.append(element("dt", "", label), element("dd", "", value));
          facts.append(row);
        });
        card.append(top, name, facts);

        if (repository.component_ids.length) {
          const components = element("div", "plugin-contracts");
          repository.component_ids.forEach((id) => {
            components.append(element("code", "", id));
          });
          card.append(components);
        }
        grid.append(card);
      });
      section.append(heading, grid);
      repositoryCatalog.append(section);
    });
    repositoryStatus.textContent = visible.length
      ? `${visible.length} ${copy().repositories}`
      : copy().repositoryEmpty;
  }

  function renderCatalog() {
    const query = search.value.trim().toLowerCase();
    const visible = catalogProjects().filter((project) => {
      const matchesComponent = project.items.some((item) => {
        const itemWorkloadTraits = workloadNavigation.plugins[item.id] || [];
        const matchesWorkload = selectedWorkload === "all"
          || itemWorkloadTraits.includes(selectedWorkload);
        return matchesSelectedType(item) && matchesWorkload
          && itemSearchText(item).includes(query);
      });
      const item = project.primary;
      const matchesModel = !isPerformanceCandidate(item) || !selectedModel
        || (performanceResults.get(item.id)?.modelLabel === selectedModel
          && Number.isFinite(performanceResults.get(item.id)?.gain));
      return matchesComponent && matchesModel;
    }).map((project) => ({
      ...project,
      kind: selectedType === "extensions"
        ? taxonomyProfile(project.primary).kind
        : selectedType
    }));

    const priority = { ready: 0, verified: 1, experimental: 2, external_service: 3, inspect_only: 4, source_scaffold: 5 };
    catalog.replaceChildren();
    const appendGroup = (title, items, kind) => {
      if (!items.length) return;
      items.sort((leftProject, rightProject) => {
        const left = leftProject.primary;
        const right = rightProject.primary;
        if (isPerformanceCandidate(left) && isPerformanceCandidate(right)) {
          const leftRank = priority[left.compatibility?.status] ?? 6;
          const rightRank = priority[right.compatibility?.status] ?? 6;
          return (window.PluginPerformance?.compare(left, right, performanceResults) || 0)
            || leftRank - rightRank || left.name.localeCompare(right.name);
        }
        return left.name.localeCompare(right.name);
      });
      const section = element("section", `plugin-category plugin-category-${kind}`);
      section.append(element("h2", "plugin-category-title", title));
      const grid = element("div", "plugin-grid workshop-grid");
      items.forEach((project) => grid.append(renderCard(project.primary, project.items)));
      section.append(grid);
      catalog.append(section);
    };
    const groups = [
      ["runtime_mod", copy().runtimeMods],
      ["connector_mod", copy().connectorMods],
      ["tool_mod", copy().toolMods],
      ["control_plane", copy().controlPlanes],
      ["external_system", copy().externalSystems],
      ["retired", copy().retiredItems]
    ];
    groups.forEach(([kind, title]) => {
      appendGroup(title, visible.filter((project) => project.kind === kind), kind);
    });
    status.textContent = visible.length ? `${visible.length} ${copy().entries}` : copy().empty;
    if (more) {
      more.hidden = true;
    }
  }

  search.addEventListener("input", () => {
    if (registry) {
      renderWorkloadNavigation();
      renderCatalog();
    }
    renderPortfolio();
  });
  modelSelect?.addEventListener("change", () => {
    if (!performanceData || !frontierData || !window.PluginPerformance) return;
    selectedModel = modelSelect.value;
    performanceResults = PluginPerformance.summarize(performanceData, frontierData, selectedModel || null);
    renderWorkloadNavigation();
    renderCatalog();
  });
  function renderPageLabels() {
    const zh = language() === "zh";
    const values = {
      "plugins-eyebrow": zh ? "vLLM-HUST MOD 目录" : "vLLM-HUST MOD catalog",
      "plugins-title": zh ? "MOD 工坊" : "MOD Workshop",
      "plugins-fact-items": zh ? "个公开 MOD" : "public MODs",
      "plugins-fact-runtime": zh ? "个兼容性已验证" : "compatibility verified",
      "plugins-fact-review": zh ? "个实验性或仅检查" : "experimental or inspection-only",
      "plugins-fact-publications": zh ? "项硬件或性能证据" : "hardware/performance evidence"
    };
    Object.entries(values).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    });
    if (modelSelect?.options.length) modelSelect.options[0].textContent = copy().allModels;
  }
  renderPageLabels();
  search.placeholder = copy().searchPlaceholder;

  Promise.all([
    fetch(catalog.dataset.source, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`ecosystem registry request failed: ${response.status}`);
      return response.json();
    }),
    fetch(catalog.dataset.metadata, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`Workshop metadata request failed: ${response.status}`);
      return response.json();
    }),
    fetch(workloadNavigationRoot.dataset.source, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`Workload navigation request failed: ${response.status}`);
      return response.json();
    }),
    fetch(catalog.dataset.taxonomy, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`MOD taxonomy request failed: ${response.status}`);
      return response.json();
    }),
    Promise.all([
      fetch("./data/plugin-performance.json?v=configuration-scope-20261010", { cache: "no-cache" }).then(response => { if (!response.ok) throw new Error("Performance metadata unavailable"); return response.json(); }),
      fetch("./data/leaderboard_frontier.json?v=ecpa-final-20261009", { cache: "no-cache" }).then(response => { if (!response.ok) throw new Error("Benchmark settings unavailable"); return response.json(); })
    ]).then(([data, frontier]) => ({ data, frontier })).catch(() => null)
  ])
    .then(([payload, metadata, navigation, taxonomy, performance]) => {
      if (payload.schema_version !== "1.0" || payload.canonical_owner !== "vLLM-HUST/vllm-hust-docs" || !Array.isArray(payload.components)) {
        throw new Error("unsupported ecosystem registry");
      }
      if (metadata.schema_version !== "plugin-workshop-metadata/v1" || !metadata.plugins) {
        throw new Error("unsupported Workshop metadata");
      }
      if (navigation.schema_version !== "plugin-workload-navigation/v1" || !navigation.traits || !navigation.plugins) {
        throw new Error("unsupported workload navigation");
      }
      if (taxonomy.schema_version !== "mod-taxonomy/v1" || !taxonomy.components) {
        throw new Error("unsupported MOD taxonomy");
      }
      registry = payload;
      modTaxonomy = taxonomy.components;
      performanceData = performance?.data;
      frontierData = performance?.frontier;
      if (performance && window.PluginPerformance) {
        try {
          performanceResults = PluginPerformance.summarize(performanceData, frontierData);
          if (modelSelect) {
            modelSelect.replaceChildren(new Option(copy().allModels, ""));
            PluginPerformance.models(performanceData, frontierData).forEach((model) => {
              modelSelect.append(new Option(model, model));
            });
          }
        } catch (error) {
          console.warn("Performance metadata unavailable:", error);
          performanceData = undefined;
          frontierData = undefined;
          performanceResults = new Map();
        }
      }
      workshopMetadata = metadata.plugins;
      workloadNavigation = navigation;
      renderPageLabels();
      search.placeholder = copy().searchPlaceholder;
      const catalogSummary = window.EcosystemCatalog.summarize(payload, taxonomy);
      document.querySelectorAll("[data-plugin-count]").forEach((node) => { node.textContent = String(catalogSummary.total); });
      const supported = catalogSummary.verified;
      const incubating = catalogSummary.evaluating;
      const evidence = catalogSummary.evidenced;
      const external = payload.components.filter((item) => item.artifact_type === "external_system").length;
      document.querySelectorAll("[data-runtime-count]").forEach((node) => { node.textContent = String(supported).padStart(2, "0"); });
      document.querySelectorAll("[data-review-target-count]").forEach((node) => { node.textContent = String(incubating).padStart(2, "0"); });
      document.querySelectorAll("[data-publication-count]").forEach((node) => { node.textContent = String(evidence).padStart(2, "0"); });
      document.querySelectorAll("[data-adjacent-count]").forEach((node) => { node.textContent = String(external).padStart(2, "0"); });
      renderFilters();
      renderWorkloadNavigation();
      renderCatalog();
      renderBoundaries();
    })
    .catch((error) => {
      status.textContent = (language() === "zh" ? "生态目录加载失败：" : "The ecosystem catalog could not be loaded: ") + error.message;
      status.title = error.message;
    });

  if (repositoryCatalog && repositoryStatus) {
    fetch(repositoryCatalog.dataset.source, { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`repository portfolio request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        if (
          payload.schema_version !== "1.0"
          || payload.canonical_owner !== "vLLM-HUST/vllm-hust-docs"
          || !Array.isArray(payload.repositories)
        ) {
          throw new Error("unsupported repository portfolio");
        }
        portfolio = payload;
        search.placeholder = copy().searchPlaceholder;
        renderPortfolio();
      })
      .catch((error) => {
        repositoryStatus.textContent = language() === "zh"
          ? "仓库组合加载失败，请检查规范 registry。"
          : "The repository portfolio could not be loaded. Check the canonical registry.";
        repositoryStatus.title = error.message;
      });
  }

  const renderLanguage = () => {
    renderPageLabels();
    if (!registry) return;
    search.placeholder = copy().searchPlaceholder;
    renderFilters();
    renderWorkloadNavigation();
    renderCatalog();
    renderBoundaries();
    renderPortfolio();
  };
  window.addEventListener("vllm-hust-language-change", renderLanguage);
  window.addEventListener("vllm-hust:langchange", renderLanguage);
})();
