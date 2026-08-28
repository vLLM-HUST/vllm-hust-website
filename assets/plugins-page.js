(() => {
  const catalog = document.querySelector("[data-plugin-catalog]");
  const status = document.querySelector("[data-plugin-status]");
  const filters = document.querySelector("[data-plugin-filters]");
  const search = document.querySelector("[data-plugin-search]");
  const adjacent = document.querySelector("[data-adjacent-assets]");
  const repositoryCatalog = document.querySelector("[data-repository-portfolio]");
  const repositoryStatus = document.querySelector("[data-repository-status]");
  if (!catalog || !status || !filters || !search) return;

  let registry;
  let portfolio;
  let selectedType = "all";

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
    entries: "个生态组件",
    empty: "没有符合当前筛选条件的生态组件。",
    repository: "规范仓库",
    noRepository: "尚无公开主仓库",
    searchPlaceholder: "搜索系统、职责、契约、执行面或仓库",
    evidence: "证据",
    ownership: "维护",
    planes: "执行面",
    delivery: "交付",
    boundaries: "关键边界",
    repositories: "个组织仓库",
    repositoryEmpty: "没有符合当前搜索条件的仓库。",
    artifacts: "规范制品",
    relation: "与运行时关系"
  } : {
    all: "All",
    entries: "ecosystem components",
    empty: "No ecosystem components match the current filters.",
    repository: "Canonical repository",
    noRepository: "No public canonical repository",
    searchPlaceholder: "Search system, role, contract, execution plane, or repository",
    evidence: "Evidence",
    ownership: "Ownership",
    planes: "Planes",
    delivery: "Delivery",
    boundaries: "Key boundaries",
    repositories: "organization repositories",
    repositoryEmpty: "No repositories match the current search.",
    artifacts: "Canonical artifacts",
    relation: "Runtime relation"
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

  const valueLabel = (value) => String(value).replaceAll("_", " ");
  const typeTitle = (type) => (typeLabels[type] || { en: valueLabel(type), zh: valueLabel(type) })[language()];
  const domainTitle = (domain) => (
    domainLabels[domain] || { en: valueLabel(domain), zh: valueLabel(domain) }
  )[language()];

  function renderFilters() {
    const presentTypes = [...new Set(registry.components.map((item) => item.artifact_type))];
    filters.replaceChildren();
    ["all", ...presentTypes].forEach((type) => {
      const title = type === "all" ? copy().all : typeTitle(type);
      const button = element("button", `plugin-filter${selectedType === type ? " active" : ""}`, title);
      button.type = "button";
      button.dataset.layer = type;
      button.setAttribute("aria-pressed", String(selectedType === type));
      button.addEventListener("click", () => {
        selectedType = type;
        renderFilters();
        renderCatalog();
      });
      filters.append(button);
    });
  }

  function badge(text, className = "") {
    return element("span", `plugin-badge ${className}`.trim(), text);
  }

  function renderCard(item) {
    const card = element("article", "plugin-card");
    const top = element("div", "plugin-card-top");
    top.append(element("span", "plugin-code", item.id));
    const badges = element("div", "plugin-badges");
    badges.append(
      badge(typeTitle(item.artifact_type), "existing"),
      badge(valueLabel(item.maturity), `status-${item.maturity}`)
    );
    top.append(badges);

    card.append(top, element("h3", "", item.name), element("p", "plugin-summary", local(item, "summary")));
    const facts = element("dl", "plugin-component-facts");
    [
      [copy().planes, item.execution_planes.map(valueLabel).join(" · ")],
      [copy().delivery, valueLabel(item.delivery_model)],
      [copy().ownership, valueLabel(item.ownership)],
      [copy().evidence, valueLabel(item.evidence_level)]
    ].forEach(([label, value]) => {
      const row = element("div");
      row.append(element("dt", "", label), element("dd", "", value));
      facts.append(row);
    });
    card.append(facts);

    if (item.integration_contracts.length) {
      const contracts = element("div", "plugin-contracts");
      item.integration_contracts.forEach((contract) => contracts.append(element("code", "", contract)));
      card.append(contracts);
    }

    const footer = element("div", "plugin-card-footer");
    footer.append(element("span", "plugin-kind", valueLabel(item.system_role)));
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
      const text = [
        item.id, item.name, local(item, "summary"), item.artifact_type,
        item.system_role, item.delivery_model, item.ownership, item.maturity,
        item.evidence_level, item.execution_planes.join(" "),
        item.integration_contracts.join(" "), item.canonical_repository || ""
      ].join(" ").toLowerCase();
      return (selectedType === "all" || item.artifact_type === selectedType) && text.includes(query);
    });

    catalog.replaceChildren();
    Object.keys(typeLabels).forEach((type, index) => {
      const items = visible.filter((item) => item.artifact_type === type);
      if (!items.length) return;
      const section = element("section", "plugin-layer");
      const head = element("div", "plugin-layer-head");
      const identity = element("div", "plugin-layer-identity");
      identity.append(element("span", "plugin-layer-index", String(index + 1).padStart(2, "0")), element("h2", "", typeTitle(type)));
      head.append(identity, element("p"), element("strong", "plugin-layer-count", String(items.length).padStart(2, "0")));
      const grid = element("div", "plugin-grid");
      items.forEach((item) => grid.append(renderCard(item)));
      section.append(head, grid);
      catalog.append(section);
    });
    status.textContent = visible.length ? `${visible.length} ${copy().entries}` : copy().empty;
  }

  search.addEventListener("input", () => {
    if (registry) renderCatalog();
    renderPortfolio();
  });
  search.placeholder = copy().searchPlaceholder;

  fetch(catalog.dataset.source)
    .then((response) => {
      if (!response.ok) throw new Error(`ecosystem registry request failed: ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      if (payload.schema_version !== "1.0" || payload.canonical_owner !== "vLLM-HUST/vllm-hust-docs" || !Array.isArray(payload.components)) {
        throw new Error("unsupported ecosystem registry");
      }
      registry = payload;
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

  window.addEventListener("vllm-hust-language-change", () => {
    if (!registry) return;
    search.placeholder = copy().searchPlaceholder;
    renderFilters();
    renderCatalog();
    renderBoundaries();
    renderPortfolio();
  });
})();
