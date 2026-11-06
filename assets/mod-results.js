(() => {
  const root = document.querySelector("[data-mod-report]");
  const grid = document.querySelector("[data-report-grid]");
  const status = document.querySelector("[data-report-status]");
  const search = document.querySelector("[data-report-search]");
  const tabs = [...document.querySelectorAll("[data-report-tab]")];
  if (!root || !grid || !status || !search) return;

  let report;
  let selected = "integrations";
  const language = () => document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
  const node = (tag, className = "", text = "") => {
    const value = document.createElement(tag);
    if (className) value.className = className;
    if (text) value.textContent = text;
    return value;
  };
  const deidentify = (value) => String(value || "")
    .replace(/gennova[a-z0-9-]*/gi, "source-project")
    .replace(/stateaxis[a-z0-9-]*/gi, "withdrawn-project");
  const text = (value) => deidentify(Array.isArray(value) ? value.join(" ") : value);
  const searchable = (value) => Object.values(value).map(text).join(" ").toLowerCase();
  const copy = () => language() === "zh" ? {
    integrations: "单项 MOD", combinations: "组合", negative: "兼容性 / 负结果",
    positive: "正向观察", negativeLabel: "负向观察", boundary: "适用边界",
    baseline: "对照", effect: "效果", quality: "质量", qualification: "结论边界",
    result: "结果", stop: "不要重复", reopen: "重开条件", empty: "没有匹配记录",
    records: "条记录", evidence: "份证据引用", defaultOff: "默认关闭"
  } : {
    integrations: "Single MOD", combinations: "Combination", negative: "Compatibility / negative",
    positive: "Positive observation", negativeLabel: "Negative observation", boundary: "Boundary",
    baseline: "Baseline", effect: "Effect", quality: "Quality", qualification: "Qualification",
    result: "Result", stop: "Do not repeat", reopen: "Reopen requires", empty: "No matching records",
    records: "records", evidence: "evidence references", defaultOff: "default off"
  };

  function fact(label, value, className = "") {
    if (!value || (Array.isArray(value) && !value.length)) return null;
    const block = node("div", `mod-result-fact ${className}`.trim());
    block.append(node("strong", "", label), node("p", "", text(value)));
    return block;
  }

  function integrationCard(item) {
    const card = node("article", "mod-result-card integration-record");
    const head = node("header");
    head.append(node("span", "mod-result-kind", copy().integrations), node("code", "", item.id));
    card.append(head, node("h2", "", item.name));
    const tags = node("div", "mod-result-tags");
    tags.append(node("span", "", item.status || "recorded"));
    if (!item.default_enabled) tags.append(node("span", "warning", copy().defaultOff));
    tags.append(node("span", "", `${item.evidence_count} ${copy().evidence}`));
    card.append(tags);
    [
      fact(copy().positive, item.positive, "positive"),
      fact(copy().negativeLabel, item.negative, "negative"),
      fact(copy().boundary, item.boundary, "boundary")
    ].filter(Boolean).forEach((value) => card.append(value));
    return card;
  }

  function combinationCard(item) {
    const card = node("article", "mod-result-card combination-record");
    const head = node("header");
    head.append(node("span", "mod-result-kind", copy().combinations), node("code", "", item.id));
    card.append(head, node("h2", "", item.combination));
    [
      fact(copy().baseline, item.baseline), fact(copy().effect, item.effect, "positive"),
      fact(copy().quality, item.quality), fact(copy().qualification, item.qualification, "boundary")
    ].filter(Boolean).forEach((value) => card.append(value));
    return card;
  }

  function negativeCard(item) {
    const card = node("article", "mod-result-card negative-record");
    const head = node("header");
    head.append(node("span", "mod-result-kind", copy().negative), node("code", "", item.id));
    card.append(head, node("h2", "", item.name || item.id));
    const tags = node("div", "mod-result-tags");
    [item.status, item.outcome_kind].filter(Boolean).forEach((value) => tags.append(node("span", "warning", value)));
    card.append(tags);
    [
      fact(copy().result, item.result, "negative"), fact(copy().boundary, item.quality_scope || item.scope, "boundary"),
      fact(copy().stop, item.do_not_repeat), fact(copy().reopen, item.reopen_requires)
    ].filter(Boolean).forEach((value) => card.append(value));
    return card;
  }

  function selectedRecords() {
    if (selected === "combinations") return report.combination_effects;
    if (selected === "negative") return report.negative_results;
    return report.integration_records;
  }

  function render() {
    if (!report) return;
    const query = search.value.trim().toLowerCase();
    const records = selectedRecords().filter((item) => searchable(item).includes(query));
    grid.replaceChildren();
    records.forEach((item) => grid.append(
      selected === "combinations" ? combinationCard(item) : selected === "negative" ? negativeCard(item) : integrationCard(item)
    ));
    status.textContent = records.length ? `${records.length} ${copy().records}` : copy().empty;
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => {
    selected = tab.dataset.reportTab;
    tabs.forEach((value) => value.classList.toggle("active", value === tab));
    render();
  }));
  search.addEventListener("input", render);
  window.addEventListener("vllm-hust-language-change", render);
  window.addEventListener("vllm-hust:langchange", render);

  fetch(root.dataset.source, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`report request failed: ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      if (payload.schema_version !== "mod-test-evidence/v1") throw new Error("unsupported report schema");
      report = payload;
      const visibleSummary = {
        ...report.summary,
        integration_records: report.integration_records.length,
        combination_effects: report.combination_effects.length,
        bounded_negative_results: report.negative_results.length
      };
      document.querySelectorAll("[data-summary]").forEach((value) => {
        value.textContent = visibleSummary[value.dataset.summary];
      });
      if (report.source?.report_url) {
        document.querySelector("[data-report-source]").href = report.source.report_url;
      }
      render();
    })
    .catch((error) => {
      status.textContent = language() === "zh" ? "测试报告加载失败。" : "The test report could not be loaded.";
      status.title = error.message;
    });
})();
