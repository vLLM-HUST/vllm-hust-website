(() => {
  "use strict";

  const panel = document.getElementById("qwen35-9b-reference-41");
  if (!panel) return;
  const summaryFile = "qwen35-9b-reference-41.json";
  const graphFile = "qwen35-9b-reference-41-dag.json";
  const dataDirectory = new URL("./data/", window.location.href);
  const strings = {
    zh: {
      title: "Qwen3.5-9B · 4.1 独立参考下界",
      scope: input => `${input.dataset} 冻结 ${input.ordered_requests} 题，按原请求顺序，每题上限 ${input.max_output_tokens} 个输出 token。`,
      limit: "下界覆盖已核验的必要计算、KV 张量搬运、跨卡通信和主机处理。并行按依赖图计算。现有下界无法判定精确效率或里程碑达标。",
      details: "查看原墙钟、算量和逐轮复算",
      arm: "工况", round: "轮次", wall: "原墙钟（秒）", duration: "参考时长下界（秒）",
      operations: "必要基本运算下界", performance: "有效 TFLOPS/卡下界", efficiency: "效率下界",
      data: "结果 JSON", graph: "逐轮依赖图", source: "复算命令与来源"
    },
    en: {
      title: "Qwen3.5-9B · 4.1 independent reference lower bound",
      scope: input => `${input.ordered_requests} frozen ${input.dataset} questions in original order, up to ${input.max_output_tokens} output tokens each.`,
      limit: "The bound includes verified compute, KV tensor movement, cross-device communication and host processing. The dependency graph accounts for overlap. The bound leaves exact efficiency and milestone attainment unresolved.",
      details: "Original walls, work and per-round results",
      arm: "Arm", round: "Round", wall: "Original wall (s)", duration: "Reference time lower bound (s)",
      operations: "Required basic operations lower bound", performance: "Effective TFLOPS/card lower bound", efficiency: "Efficiency lower bound",
      data: "Result JSON", graph: "Per-round dependency graph", source: "Recomputation and sources"
    }
  };

  function element(tag, contents, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (contents !== undefined) node.textContent = contents;
    return node;
  }

  function lower(value, precision) {
    if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Invalid decimal bound");
    const [whole, fraction = ""] = value.split(".");
    return `${whole}.${fraction.slice(0, precision).padEnd(precision, "0")}`;
  }

  function table(labels, rows) {
    const tableElement = element("table");
    const head = element("thead");
    const titles = element("tr");
    for (const label of labels) {
      const heading = element("th", label);
      heading.scope = "col";
      titles.append(heading);
    }
    head.append(titles);
    const body = element("tbody");
    for (const values of rows) {
      const row = element("tr");
      for (const value of values) row.append(element("td", value));
      body.append(row);
    }
    tableElement.append(head, body);
    const viewport = element("div", undefined, "reference-41-table");
    viewport.append(tableElement);
    return viewport;
  }

  function render(data, benchmarkCommit) {
    const language = document.documentElement.lang.startsWith("en") ? "en" : "zh";
    const t = strings[language];
    const labels = [t.arm, t.duration, t.performance, t.efficiency];
    const aggregate = Object.entries(data.arms).map(([role, {engine, aggregate: row}]) => [
      `${role} ${engine}`, lower(row.independent_reference_seconds_lower, 9),
      lower(row.effective_tflops_per_card_lower, 3), `${lower(row.efficiency_percent_lower, 5)}%`
    ]);
    const rounds = Object.entries(data.arms).flatMap(([role, {engine, rounds: rows}]) => rows.map(row => [
      `${role} ${engine}`, row.repetition, row.original_wall_seconds,
      lower(row.projected_seconds_lower, 9), new Intl.NumberFormat(language).format(row.arithmetic_basic_lower),
      lower(row.measured_tflops_per_card_lower, 3), `${lower(row.efficiency_percent_lower, 5)}%`
    ]));
    const heading = element("h2", t.title);
    heading.id = "reference-41-heading";
    const details = element("details");
    details.append(element("summary", t.details), table(
      [t.arm, t.round, t.wall, t.duration, t.operations, t.performance, t.efficiency], rounds
    ));
    const links = element("p");
    const documents = [
      [t.data, new URL(summaryFile, dataDirectory)],
      [t.graph, new URL(graphFile, dataDirectory)],
      [t.source, `https://github.com/vLLM-HUST/vllm-hust-benchmark/tree/${benchmarkCommit}/reports/qwen35-9b-reference-41-20261128`]
    ];
    for (const [title, href] of documents) {
      if (links.childNodes.length) links.append(" · ");
      const link = element("a", title);
      link.href = href;
      links.append(link);
    }
    const opened = panel.querySelector("details")?.open;
    details.open = Boolean(opened);
    panel.replaceChildren(heading, element("p", `${t.scope(data.input)} ${data.dtype} ${data.parallelism} · ${data.chip}`),
      table(labels, aggregate), element("p", t.limit), details, links);
    panel.hidden = false;
  }

  async function load() {
    const response = await fetch(new URL("benchmark-source-manifest.json", dataDirectory));
    if (!response.ok) return;
    const manifest = await response.json();
    if (manifest.status !== "published-source" || !/^[0-9a-f]{40}$/.test(manifest.commit)) return;
    const file = manifest.files.find(entry => entry.website_path === `data/${summaryFile}`);
    const graph = manifest.files.find(entry => entry.website_path === `data/${graphFile}`);
    if (!file || !graph) return;
    const source = await fetch(new URL(summaryFile, dataDirectory));
    if (!source.ok) return;
    const body = await source.arrayBuffer();
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", body)),
      value => value.toString(16).padStart(2, "0")).join("");
    if (file.bytes !== body.byteLength || checksum !== file.sha256) return;
    const result = JSON.parse(new TextDecoder().decode(body));
    if (result.schema !== "qwen35-9b-4-1-conservative-publication/v1" ||
        result.qualification !== "qualified-lower-bound" || result.recompute_graph.sha256 !== graph.sha256 ||
        result.recompute_graph.path !== graphFile || !result.arms.B0 || !result.arms.B1) return;
    render(result, manifest.commit);
    const language = new MutationObserver(() => render(result, manifest.commit));
    language.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  load().catch(() => { panel.hidden = true; });
})();
