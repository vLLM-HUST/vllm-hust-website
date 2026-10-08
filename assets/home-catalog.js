(() => {
  "use strict";

  const registryUrl = "./data/ecosystem.json?v=mod-catalog-20261008";
  const navigationUrl = "./data/plugin-workload-navigation.json?v=mod-catalog-20261008";
  let summary;
  let workloadCount;

  function language() {
    return document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function copy(lang, modCount, workloads) {
    return lang === "zh" ? {
      kicker: `${modCount} 个 MOD，覆盖真实推理场景，兼容状态与验证依据清晰可查。`,
      cta: `查看全部 ${modCount} 个 MOD →`,
      fact: `${modCount} 个 MOD · ${workloads} 类 Workload`,
      atlas: `探索 ${modCount} 个 MOD，覆盖调度、KV、执行、模型准备与可观测性。`
    } : {
      kicker: `${modCount} MODs for real serving workloads, with compatibility and evidence close at hand.`,
      cta: `Explore all ${modCount} MODs →`,
      fact: `${modCount} MODs · ${workloads} workloads`,
      atlas: `Explore ${modCount} MODs for scheduling, KV, execution, model preparation, and observability.`
    };
  }

  function render() {
    if (!summary || !Number.isInteger(workloadCount)) return;
    const values = copy(language(), summary.total, workloadCount);
    const targets = {
      "home-kicker": values.kicker,
      "home-primary-cta": values.cta,
      "home-fact-1-value": values.fact,
      "atlas-title": values.atlas
    };
    Object.entries(targets).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    });
    document.querySelectorAll("[data-home-mod-count]").forEach((node) => {
      node.textContent = String(summary.total);
    });
  }

  Promise.all([
    fetch(registryUrl, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`ecosystem registry request failed: ${response.status}`);
      return response.json();
    }),
    fetch(navigationUrl, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`workload navigation request failed: ${response.status}`);
      return response.json();
    })
  ]).then(([registry, navigation]) => {
    summary = window.EcosystemCatalog.summarize(registry);
    workloadCount = Object.keys(navigation.traits || {}).length;
    render();
  }).catch((error) => {
    console.warn("Catalog summary unavailable; keeping the published fallback copy.", error);
  });

  window.addEventListener("vllm-hust:langchange", render);
})();
