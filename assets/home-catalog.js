(() => {
  "use strict";

  const registryUrl = "./data/ecosystem.json?v=taxonomy-v2-20261012";
  const navigationUrl = "./data/plugin-workload-navigation.json?v=taxonomy-v2-20261012";
  const taxonomyUrl = "./data/mod-taxonomy.json?v=taxonomy-v2-20261012";
  let summary;
  let phaseCount;
  let scenarioCount;

  function language() {
    return document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function copy(lang, modCount, phases, scenarios) {
    return lang === "zh" ? {
      kicker: `${modCount} 个公开 MOD，覆盖 ${phases} 个推理生命周期阶段，范围与证据边界明确。`,
      lede: "按阶段、场景、平台和成熟度探索；启用证据与性能证据分开呈现。",
      cta: `查看全部 ${modCount} 个 MOD →`,
      portfolio: `${modCount} 个公开 MOD`,
      coverage: `${phases} 个阶段 · ${scenarios} 类场景`,
      evidence: "启用证据 ≠ 性能证据",
      atlas: `探索 ${modCount} 个 MOD：从离线准备、服务启动到请求准入、Prefill、Decode、状态与服务生命周期及可观测性。`,
      atlasSummary: "每张卡片分别说明可用性、适用范围、启用依据与性能证据；未验证收益不会被写成有效优化。",
      portfolioCopy: "按生命周期阶段、场景、平台与成熟度比较 MOD，并查看维护者、配置、证据标签与公开结果。"
    } : {
      kicker: `${modCount} public MODs across ${phases} lifecycle phases, with scope and evidence explicit.`,
      lede: "Explore by phase, scenario, platform, and readiness; activation and performance evidence stay separate.",
      cta: `Explore all ${modCount} MODs →`,
      portfolio: `${modCount} public MODs`,
      coverage: `${phases} phases · ${scenarios} scenarios`,
      evidence: "activation evidence ≠ performance evidence",
      atlas: `Explore ${modCount} MODs from offline preparation and service startup through request admission, prefill, decode, state and service lifecycle, and observability.`,
      atlasSummary: "Each card separates availability, scope, activation evidence, and performance evidence; unverified gains remain unclaimed.",
      portfolioCopy: "Compare MODs by lifecycle phase, scenario, platform, and readiness, with maintainers, setup, evidence labels, and public results."
    };
  }

  function render() {
    if (!summary || !Number.isInteger(phaseCount) || !Number.isInteger(scenarioCount)) return;
    const values = copy(language(), summary.total, phaseCount, scenarioCount);
    const targets = {
      "home-kicker": values.kicker,
      "home-lede": values.lede,
      "home-primary-cta": values.cta,
      "home-fact-1-value": values.portfolio,
      "home-fact-2-value": values.coverage,
      "home-fact-3-value": values.evidence,
      "atlas-title": values.atlas,
      "atlas-summary": values.atlasSummary,
      "mod-portfolio-copy": values.portfolioCopy
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
    }),
    fetch(taxonomyUrl, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`MOD taxonomy request failed: ${response.status}`);
      return response.json();
    })
  ]).then(([registry, navigation, taxonomy]) => {
    summary = window.EcosystemCatalog.summarize(registry, taxonomy);
    phaseCount = new Set(summary.mods.flatMap((item) => (
      taxonomy.components[item.id]?.phases || []
    ))).size;
    scenarioCount = Object.keys(navigation.traits || {}).length;
    render();
  }).catch((error) => {
    console.warn("Catalog summary unavailable; keeping the published fallback copy.", error);
  });

  window.addEventListener("vllm-hust:langchange", render);
})();
