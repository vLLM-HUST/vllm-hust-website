(() => {
  const catalog = document.querySelector("[data-plugin-catalog]");
  const status = document.querySelector("[data-plugin-status]");
  const filters = document.querySelector("[data-plugin-filters]");
  const search = document.querySelector("[data-plugin-search]");
  const adjacent = document.querySelector("[data-adjacent-assets]");
  if (!catalog || !status || !filters || !search) return;

  let manifest = null;
  let selectedLayer = "all";

  const language = () => (document.documentElement.lang.startsWith("zh") ? "zh" : "en");
  const local = (record, key) => record[`${key}_${language()}`] || record[`${key}_en`] || "";
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function labels() {
    return language() === "zh"
      ? { all: "全部", repository: "仓库", withheld: "链接未公开", entries: "个条目", empty: "没有符合条件的插件。", existing: "vLLM 运行时入口", searchPlaceholder: "搜索插件、职责或层次" }
      : { all: "All", repository: "Repository", withheld: "Link not public", entries: "entries", empty: "No plugins match the current filters.", existing: "vLLM runtime entry point", searchPlaceholder: "Search plugin, responsibility, or layer" };
  }

  function statusText(item) {
    const names = language() === "zh"
      ? { existing: "已有实现", active: "开发中", incubating: "研究原型", planned: "路线规划", concept: "架构概念" }
      : { existing: "Available code", active: "Active development", incubating: "Research prototype", planned: "Roadmap", concept: "Architecture concept" };
    return names[item.status] || item.status;
  }

  function renderFilters() {
    const copy = labels();
    search.placeholder = copy.searchPlaceholder;
    filters.replaceChildren();
    [{ id: "all", title_en: copy.all, title_zh: copy.all }, ...manifest.layers].forEach((layer) => {
      const button = element("button", `plugin-filter${selectedLayer === layer.id ? " active" : ""}`, local(layer, "title"));
      button.type = "button";
      button.dataset.layer = layer.id;
      button.setAttribute("aria-pressed", String(selectedLayer === layer.id));
      button.addEventListener("click", () => {
        selectedLayer = layer.id;
        renderFilters();
        renderCatalog();
      });
      filters.append(button);
    });
  }

  function cardFor(item) {
    const copy = labels();
    const card = element("article", "plugin-card");
    const top = element("div", "plugin-card-top");
    top.append(element("span", "plugin-code", item.code));
    const badges = element("div", "plugin-badges");
    if (item.origin === "existing") badges.append(element("span", "plugin-badge existing", copy.existing));
    badges.append(element("span", `plugin-badge status-${item.status}`, statusText(item)));
    top.append(badges);
    card.append(top, element("h3", "", item.name), element("p", "plugin-summary", local(item, "summary")));

    const footer = element("div", "plugin-card-footer");
    footer.append(element("span", "plugin-kind", local(item, "kind")));
    if (item.repository_url) {
      const link = element("a", "plugin-repository", `${copy.repository} ↗`);
      link.href = item.repository_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      footer.append(link);
    } else {
      footer.append(element("span", "plugin-repository withheld", copy.withheld));
    }
    card.append(footer);
    return card;
  }

  function renderAdjacent() {
    adjacent.replaceChildren();
    manifest.adjacent_assets.forEach((item) => {
      const card = element("a", "adjacent-card");
      card.href = item.repository_url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.append(element("span", "plugin-code", item.code), element("h3", "", item.name), element("p", "", local(item, "summary")), element("strong", "", `${labels().repository} ↗`));
      adjacent.append(card);
    });
    document.querySelectorAll("[data-adjacent-count]").forEach((node) => { node.textContent = String(manifest.adjacent_assets.length).padStart(2, "0"); });
  }

  function renderCatalog() {
    const query = search.value.trim().toLowerCase();
    const visible = manifest.plugins.filter((item) => {
      const layer = manifest.layers.find((candidate) => candidate.id === item.layer);
      const text = [item.name, item.code, local(item, "summary"), local(item, "kind"), local(layer || {}, "title")].join(" ").toLowerCase();
      return (selectedLayer === "all" || item.layer === selectedLayer) && (!query || text.includes(query));
    });

    catalog.replaceChildren();
    manifest.layers.forEach((layer, index) => {
      const items = visible.filter((item) => item.layer === layer.id);
      if (!items.length) return;
      const section = element("section", "plugin-layer");
      const head = element("div", "plugin-layer-head");
      const identity = element("div", "plugin-layer-identity");
      identity.append(element("span", "plugin-layer-index", String(index + 1).padStart(2, "0")), element("h2", "", local(layer, "title")));
      head.append(identity, element("p", "", local(layer, "summary")), element("strong", "plugin-layer-count", String(items.length).padStart(2, "0")));
      const grid = element("div", "plugin-grid");
      items.forEach((item) => grid.append(cardFor(item)));
      section.append(head, grid);
      catalog.append(section);
    });

    const copy = labels();
    status.textContent = visible.length ? `${visible.length} ${copy.entries}` : copy.empty;
  }

  fetch(catalog.dataset.source)
    .then((response) => {
      if (!response.ok) throw new Error(`plugin manifest request failed: ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      if (payload.schema_version !== 1 || !Array.isArray(payload.layers) || !Array.isArray(payload.plugins) || !Array.isArray(payload.adjacent_assets)) {
        throw new Error("unsupported plugin manifest");
      }
      manifest = payload;
      document.querySelectorAll("[data-plugin-count]").forEach((node) => { node.textContent = String(payload.plugins.length); });
      const runtimeCount = payload.plugins.filter((item) => item.origin === "existing" && item.repository_url).length;
      document.querySelectorAll("[data-runtime-count]").forEach((node) => { node.textContent = String(runtimeCount).padStart(2, "0"); });
      renderFilters();
      renderCatalog();
      renderAdjacent();
    })
    .catch((error) => {
      status.textContent = language() === "zh" ? "插件清单加载失败，请打开版本化 manifest。" : "The plugin plan could not be loaded. Open the versioned manifest.";
      status.title = error.message;
    });

  search.addEventListener("input", () => { if (manifest) renderCatalog(); });
  window.addEventListener("vllm-hust:langchange", () => {
    if (!manifest) return;
    renderFilters();
    renderCatalog();
    renderAdjacent();
  });
})();
