"use strict";
(async () => {
  const status = document.getElementById("standard-status");
  const text = (tag, value) => { const element = document.createElement(tag); element.textContent = value; return element; };
  try {
    const sourcePath = document.querySelector('meta[name="standard-source"]').content;
    const response = await fetch(sourcePath, {cache: "no-store"});
    if (!response.ok) throw new Error(`source HTTP ${response.status}`);
    const source = await response.json();
    const path = "data/dataset-standard-v1/standard.json";
    const entry = source.files.find(item => item.website_path === path);
    if (!entry || !/^[a-f0-9]{40}$/.test(source.commit)) throw new Error("missing pinned source");
    const dataResponse = await fetch(`./${path}`, {cache: "no-store"});
    if (!dataResponse.ok) throw new Error(`standard HTTP ${dataResponse.status}`);
    const raw = await dataResponse.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)), b => b.toString(16).padStart(2, "0")).join("");
    if (digest !== entry.sha256 || raw.byteLength !== entry.bytes) throw new Error("standard checksum mismatch");
    const data = JSON.parse(new TextDecoder().decode(raw));
    if (data.standard_id !== "five-datasets-20261113-v1" || data.datasets.length !== 5) throw new Error("unknown standard");
    document.getElementById("standard-title").textContent = data.standard_id;
    const provenance = document.getElementById("standard-provenance");
    provenance.append(text("span", `${source.repository} @ ${source.commit} · SHA256 ${digest} `));
    const original = text("a", "固定来源 / Pinned source");
    original.href = `https://github.com/${source.repository}/blob/${source.commit}/${entry.benchmark_path}`;
    provenance.append(original);
    for (const dataset of data.datasets) {
      const row = document.createElement("tr");
      const scope = dataset.mode === "inference_only" ? "推理性能 / Inference only" : "质量与推理性能 / Quality + inference";
      const settings = `max ${dataset.max_output_tokens} · C${dataset.concurrency} · T${dataset.temperature} · seed ${dataset.seed}` + (dataset.judge_max_tokens ? ` · judge ${dataset.judge_max_tokens}` : "");
      for (const value of [dataset.name, `${dataset.tasks} / ${dataset.source_tasks}`, dataset.requests_per_arm, scope, `${dataset.selection_zh} ${dataset.selection_en}`, settings]) row.append(text("td", String(value)));
      document.getElementById("standard-rows").append(row);
    }
    for (const [name, artifact] of Object.entries(data.artifacts)) {
      const item = document.createElement("li"); const link = text("a", name);
      link.href = `./data/dataset-standard-v1/${name}`; link.download = name;
      item.append(link, text("code", ` ${artifact.bytes} bytes · ${artifact.sha256}`));
      document.getElementById("standard-files").append(item);
    }
    for (const [name, value] of Object.entries(data.metrics)) document.getElementById("standard-metrics").append(text("dt", name), text("dd", value));
    for (const value of data.invariants) document.getElementById("standard-invariants").append(text("li", value));
    document.getElementById("standard-access").textContent = `${data.execution.access} ${data.execution.engine_binding} ${data.execution.trace_model_binding} ${data.execution.judge}`;
    document.getElementById("standard-content").hidden = false;
    status.textContent = "来源与标准校验通过 / Source and standard verified";
  } catch (error) {
    status.textContent = `加载或校验失败 / Load or integrity failure: ${error.message}`;
    status.setAttribute("role", "alert");
  }
})();
