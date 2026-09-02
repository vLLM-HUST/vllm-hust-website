(() => {
  const catalog = document.querySelector("[data-plugin-catalog]");
  const status = document.querySelector("[data-plugin-status]");
  const filters = document.querySelector("[data-plugin-filters]");
  const search = document.querySelector("[data-plugin-search]");
  const more = document.querySelector("[data-plugin-more]");
  const workloadNavigationRoot = document.querySelector("[data-workload-navigation]");
  const workloadFilters = document.querySelector("[data-workload-filters]");
  const workloadDescription = document.querySelector("[data-workload-description]");
  const adjacent = document.querySelector("[data-adjacent-assets]");
  const repositoryCatalog = document.querySelector("[data-repository-portfolio]");
  const repositoryStatus = document.querySelector("[data-repository-status]");
  if (!catalog || !status || !filters || !search) return;

  let registry;
  let portfolio;
  let workshopMetadata = {};
  let workloadNavigation = { traits: {}, plugins: {} };
  let selectedType = "extensions";
  let selectedWorkload = "all";
  let expanded = false;
  const pageSize = 9;

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
    extensions: "全部 MOD",
    installable: "可安装",
    incubating: "孵化中",
    mod: "MOD",
    more: "显示全部扩展",
    entries: "个 MOD",
    empty: "没有符合当前筛选条件的 MOD。",
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
    advisors: "指导老师",
    advisorUnknown: "规范元数据尚未记录指导关系",
    externalAdvisor: "校外指导",
    externalContributor: "项目外援",
    stars: "Stars",
    pullRequests: "开放 PR",
    forks: "Forks",
    publicEffect: "公开效果",
    effectSource: "查看依据",
    host: "宿主",
    versions: "适配版本",
    platforms: "平台",
    python: "Python",
    requirements: "前置条件",
    followup: "负责人跟进 Issue",
    details: "兼容性与技术详情",
    allWorkloads: "全部 Workload",
    workloadTraits: "适用 Workload",
    allWorkloadDescription: "展示所有公开 MOD；再结合兼容状态与公开效果判断是否适合生产使用。",
    installRun: "安装 / 启动",
    boundaries: "关键边界",
    repositories: "个组织仓库",
    repositoryEmpty: "没有符合当前搜索条件的仓库。",
    artifacts: "规范制品",
    relation: "与运行时关系",
    repositoryRelationship: "仓库关系",
    upstream: "官方上游",
    forkBadge: "上游同步 fork",
    forksTitle: "上游同步 HUST 分支系统",
    forksCopy: "这些仓库跟随官方项目演进，只承载 HUST 必需的窄幅差异。它们是完整系统或平台发行分支，不是插件。"
  } : {
    all: "All",
    extensions: "All MODs",
    installable: "Installable",
    incubating: "Incubating",
    mod: "MOD",
    more: "Show all extensions",
    entries: "MODs",
    empty: "No MODs match the current filters.",
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
    advisors: "Advisors",
    advisorUnknown: "No advisor relationship is recorded in canonical metadata",
    externalAdvisor: "External advisor",
    externalContributor: "External contributor",
    stars: "Stars",
    pullRequests: "Open PRs",
    forks: "Forks",
    publicEffect: "Public result",
    effectSource: "View evidence",
    host: "Host",
    versions: "Versions",
    platforms: "Platforms",
    python: "Python",
    requirements: "Requirements",
    followup: "Owner follow-up issue",
    details: "Compatibility & technical details",
    allWorkloads: "All workloads",
    workloadTraits: "Workload fit",
    allWorkloadDescription: "Show every public MOD; use compatibility status and public results before considering production use.",
    installRun: "Install / run",
    boundaries: "Key boundaries",
    repositories: "organization repositories",
    repositoryEmpty: "No repositories match the current search.",
    artifacts: "Canonical artifacts",
    relation: "Runtime relation",
    repositoryRelationship: "Repository relationship",
    upstream: "Official upstream",
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
  const domainLabels = {
    runtime_platform: { en: "Runtime and platform", zh: "运行时与平台" },
    kv_state_data_path: { en: "KV state and data path", zh: "KV 状态与数据路径" },
    compiler_runtime: { en: "Compiler and runtime substrate", zh: "编译器与运行时底座" },
    development_operations: { en: "Development and operations", zh: "开发与运维" },
    evidence_analysis: { en: "Evidence and analysis", zh: "评测与分析" },
    documentation_product: { en: "Documentation and product", zh: "文档与产品" },
    applications_research: { en: "Applications and research", zh: "应用与研究" }
  };

  const isWorkshopMod = (item) => (
    ["runtime_component", "bridge"].includes(item.artifact_type)
    && item.repository_relationship === "organization_native"
    && item.public_surface !== false
    && ["plugin_bundle", "python_distribution", "migration_scaffold"].includes(item.delivery_model)
    && String(item.canonical_repository || "").startsWith("https://github.com/vLLM-HUST/")
  );
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
    preview: { en: "Preview", zh: "能力预览" }
  };
  const quickStarts = {
    bidkv: {
      title_en: "Install and start BidKV",
      title_zh: "安装并启动 BidKV",
      note_en: "Requires the compatible vLLM-HUST 0.23 host.",
      note_zh: "需要兼容的 vLLM-HUST 0.23 宿主。",
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
    latchmoe: {
      title_en: "Install and start LatchMoE",
      title_zh: "安装并启动 LatchMoE",
      note_en: "Requires the pinned vLLM 0.21 and hook-enabled vLLM Ascend HUST stack; one NPU, max-num-seqs 1, prefix cache off.",
      note_zh: "需要固定 vLLM 0.21 与带 hook 的 vLLM Ascend HUST；单 NPU、max-num-seqs=1、关闭 prefix cache。",
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
      note_en: "Requires the paired vLLM-HUST and vLLM-Ascend-HUST source lines shown on this card; the full serving configuration remains mandatory.",
      note_zh: "需要卡片所列的成对 vLLM-HUST 与 vLLM-Ascend-HUST 源码版本；启动时仍须提供完整服务配置。",
      command: `uv pip install -e /path/to/vllm-ascend-kvcompress-hust
export VLLM_PLUGINS=ascend_kvcompress
export VLLM_KNORM_ENABLED=0
vllm serve /path/to/model \\
  --no-async-scheduling \\
  --no-enable-prefix-caching \\
  --block-size 128 \\
  --max-model-len 12288 \\
  --gpu-memory-utilization 0.8 \\
  --kv-cache-compression-config '{"schema_version":1,"provider":"ascend_kvcompress","provider_config":{"method":"triattention","stats_path":"/path/to/stats.pt","kv_budget":2048,"recompute_window":128,"protected_recent_window":128,"score_aggregation":"mean","layer_aggregation":"mean","score_chunk_size":512,"score_layer_stride":4}}'`
    }
  };
  const inspectableBundles = {
    "quantized-kv-cache-migration": "org.vllm-hust.quantized-kv-cache",
    "simllm-migration": "org.vllm-hust.simllm",
    "unified-communication-migration": "org.vllm-hust.unified-communication",
    "split-batch-full-graph-migration": "org.vllm-hust.split-batch-full-graph",
    "kv-transfer-observability-migration": "org.vllm-hust.kv-transfer-observability",
    "layered-prefill-migration": "org.vllm-hust.layered-prefill",
    "activation-sparsity-migration": "org.vllm-hust.activation-sparsity",
    "pipeline-microbatch-migration": "org.vllm-hust.pipeline-microbatch",
    "qos-scheduler-migration": "org.vllm-hust.qos-scheduler",
    "mapped-host-kv-offload": "org.vllm-hust.ascend-mapped-kv-offload",
    "stateharbor": "org.vllm-hust.stateharbor"
  };

  const valueLabel = (value) => String(value).replaceAll("_", " ");
  const typeTitle = (type) => (typeLabels[type] || { en: valueLabel(type), zh: valueLabel(type) })[language()];
  const domainTitle = (domain) => (
    domainLabels[domain] || { en: valueLabel(domain), zh: valueLabel(domain) }
  )[language()];

  function renderFilters() {
    filters.replaceChildren();
    ["extensions", "installable", "incubating"].forEach((type) => {
      const title = copy()[type];
      const button = element("button", `plugin-filter${selectedType === type ? " active" : ""}`, title);
      button.type = "button";
      button.dataset.layer = type;
      button.setAttribute("aria-pressed", String(selectedType === type));
      button.addEventListener("click", () => {
        selectedType = type;
        expanded = false;
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
    const statusValue = item.compatibility?.status || "source_scaffold";
    return selectedType === "extensions"
      || (selectedType === "installable" && ["ready", "verified", "experimental"].includes(statusValue))
      || (selectedType === "incubating" && !["ready", "verified", "experimental"].includes(statusValue));
  }

  function itemSearchText(item) {
    const workloadText = (workloadNavigation.plugins[item.id] || []).flatMap((traitId) => {
      const profile = traitProfile(traitId);
      return [traitId, profile.label_en, profile.label_zh, profile.description_en, profile.description_zh];
    });
    const metadata = workshopMetadata[item.id] || {};
    const peopleText = [
      ...(metadata.maintainers || []).flatMap((person) => [person.name, person.login]),
      ...(metadata.advisors || []).flatMap((advisor) => [
        advisor.name_en, advisor.name_zh, advisor.affiliation_en, advisor.affiliation_zh
      ])
    ].filter(Boolean);
    return [
      item.id, item.name, item.name_en, item.name_zh, local(item, "summary"), item.artifact_type,
      item.system_role, item.delivery_model, item.ownership, item.maturity,
      item.repository_relationship, item.evidence_level, item.execution_planes.join(" "),
      item.integration_contracts.join(" "), (item.integration_surfaces || []).join(" "),
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
      const count = registry.components.filter((item) => (
        isWorkshopMod(item)
        && matchesSelectedType(item)
        && itemSearchText(item).includes(query)
        && (isAll || (workloadNavigation.plugins[item.id] || []).includes(traitId))
      )).length;
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
        expanded = false;
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
        expanded = false;
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
    people.append(element("span", "plugin-community-label", copy().maintainers));
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
    const advisorRecords = Array.isArray(metadata.advisors) ? metadata.advisors : [];
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
      const link = element("a", "plugin-repo-metric");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(element("strong", "", String(value)), element("span", "", label));
      metrics.append(link);
    });
    panel.append(people);
    if (internalAdvisors.length || !externalAdvisors.length) panel.append(advisors);
    if (externalAdvisors.length) panel.append(externalRelationships);
    panel.append(metrics);
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
      [copy().platforms, profile.platforms?.join(" · ")]
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

  function publicEffectPanel(item) {
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

  function renderCard(item) {
    const isUpstreamFork = item.repository_relationship === "upstream_sync_fork";
    const card = element(
      "article",
      `plugin-card workshop-card workshop-${item.artifact_type} workshop-tone-${coverTone(item)}${isUpstreamFork ? " upstream-fork-card" : ""}`
    );
    const cover = element("div", "workshop-cover");
    const displayName = local(item, "name");
    const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
    cover.append(
      element("span", "workshop-cover-type", copy().mod),
      element("strong", "workshop-cover-mark", initials)
    );
    const top = element("div", "plugin-card-top");
    top.append(element("span", "plugin-code", item.id));
    const launcher = quickStart(item);
    if (launcher) top.append(launcher);
    const badges = element("div", "plugin-badges");
    badges.append(
      badge(copy().mod, "existing"),
      badge(valueLabel(item.maturity), `status-${item.maturity}`)
    );
    if (isUpstreamFork) badges.prepend(badge(copy().forkBadge, "upstream-fork"));
    top.append(badges);

    card.append(cover, top, element("h3", "", displayName), element("p", "plugin-summary", local(item, "summary")));
    const traits = workloadTags(item);
    if (traits) card.append(traits);
    const publicEffect = publicEffectPanel(item);
    if (publicEffect) card.append(publicEffect);
    const community = communityPanel(item);
    if (community) card.append(community);
    const compatibility = compatibilityPanel(item);
    if (compatibility) card.append(compatibility);
    const installState = installationStatus(item);
    if (installState) card.append(installState);
    const details = element("details", "plugin-technical-details");
    details.append(element("summary", "", copy().details));
    const detailBody = element("div", "plugin-technical-body");
    const compatibilityDetailsBlock = compatibilityDetails(item);
    if (compatibilityDetailsBlock) detailBody.append(compatibilityDetailsBlock);
    const facts = element("dl", "plugin-component-facts");
    [
      [copy().planes, item.execution_planes.map(valueLabel).join(" · ")],
      [copy().delivery, valueLabel(item.delivery_model)],
      [copy().ownership, valueLabel(item.ownership)],
      ...(item.maintainers?.length ? [[copy().maintainers, item.maintainers.map((name) => `@${name}`).join(" · ")]] : []),
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
    footer.append(element("span", "plugin-kind", valueLabel(item.system_role)));
    if (item.upstream_repository) {
      const upstream = element("a", "plugin-repository upstream", `${copy().upstream} ↗`);
      upstream.href = item.upstream_repository;
      upstream.target = "_blank";
      upstream.rel = "noopener noreferrer";
      footer.append(upstream);
    }
    if (item.canonical_repository) {
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
    const visible = registry.components.filter((item) => {
      const itemWorkloadTraits = workloadNavigation.plugins[item.id] || [];
      const matchesWorkload = selectedWorkload === "all" || itemWorkloadTraits.includes(selectedWorkload);
      return isWorkshopMod(item) && matchesSelectedType(item) && matchesWorkload && itemSearchText(item).includes(query);
    });

    const priority = { ready: 0, verified: 1, experimental: 2, external_service: 3, inspect_only: 4, source_scaffold: 5 };
    visible.sort((left, right) => {
      const leftRank = priority[left.compatibility?.status] ?? 6;
      const rightRank = priority[right.compatibility?.status] ?? 6;
      return leftRank - rightRank || left.name.localeCompare(right.name);
    });
    catalog.replaceChildren();
    const grid = element("section", "plugin-grid workshop-grid");
    const visibleLimit = pageSize;
    const displayed = query || expanded ? visible : visible.slice(0, visibleLimit);
    displayed.forEach((item) => grid.append(renderCard(item)));
    catalog.append(grid);
    status.textContent = visible.length ? `${displayed.length} / ${visible.length} ${copy().entries}` : copy().empty;
    if (more) {
      more.hidden = Boolean(query) || expanded || visible.length <= visibleLimit;
      more.textContent = `${copy().more} (${visible.length})`;
    }
  }

  search.addEventListener("input", () => {
    if (registry) {
      renderWorkloadNavigation();
      renderCatalog();
    }
    renderPortfolio();
  });
  more?.addEventListener("click", () => {
    expanded = true;
    renderCatalog();
  });
  function renderPageLabels() {
    const zh = language() === "zh";
    const values = {
      "plugins-eyebrow": zh ? "vLLM-HUST 扩展" : "vLLM-HUST Extensions",
      "plugins-title": zh ? "扩展工坊" : "Extension Workshop",
      "plugins-lede": zh ? "只展示独立维护的 vLLM-HUST MOD，并按宿主版本、平台和成熟度选择。" : "Independent vLLM-HUST MODs, organized by host version, platform, and readiness.",
      "plugins-fact-items": zh ? "个目录组件" : "catalog entries",
      "plugins-fact-runtime": zh ? "个已支持" : "supported"
    };
    Object.entries(values).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    });
  }
  renderPageLabels();
  search.placeholder = copy().searchPlaceholder;

  Promise.all([
    fetch(catalog.dataset.source).then((response) => {
      if (!response.ok) throw new Error(`ecosystem registry request failed: ${response.status}`);
      return response.json();
    }),
    fetch(catalog.dataset.metadata).then((response) => {
      if (!response.ok) throw new Error(`Workshop metadata request failed: ${response.status}`);
      return response.json();
    }),
    fetch(workloadNavigationRoot.dataset.source).then((response) => {
      if (!response.ok) throw new Error(`Workload navigation request failed: ${response.status}`);
      return response.json();
    })
  ])
    .then(([payload, metadata, navigation]) => {
      if (payload.schema_version !== "1.0" || payload.canonical_owner !== "vLLM-HUST/vllm-hust-docs" || !Array.isArray(payload.components)) {
        throw new Error("unsupported ecosystem registry");
      }
      if (metadata.schema_version !== "plugin-workshop-metadata/v1" || !metadata.plugins) {
        throw new Error("unsupported Workshop metadata");
      }
      if (navigation.schema_version !== "plugin-workload-navigation/v1" || !navigation.traits || !navigation.plugins) {
        throw new Error("unsupported workload navigation");
      }
      registry = payload;
      workshopMetadata = metadata.plugins;
      workloadNavigation = navigation;
      renderPageLabels();
      search.placeholder = copy().searchPlaceholder;
      document.querySelectorAll("[data-plugin-count]").forEach((node) => { node.textContent = String(payload.components.length); });
      const supported = payload.components.filter((item) => ["supported", "verified"].includes(item.maturity)).length;
      const incubating = payload.components.filter((item) => ["concept", "incubating", "experimental"].includes(item.maturity)).length;
      const evidence = payload.components.filter((item) => ["hardware_verified", "performance_verified", "production_observed"].includes(item.evidence_level)).length;
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
      status.textContent = language() === "zh" ? "生态目录加载失败，请检查规范 registry。" : "The ecosystem catalog could not be loaded. Check the canonical registry.";
      status.title = error.message;
    });

  if (repositoryCatalog && repositoryStatus) {
    fetch(repositoryCatalog.dataset.source)
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
