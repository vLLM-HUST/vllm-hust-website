import { calculate } from "./calc.mjs?v=accounted-plans-20261009";
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: d });
let data, last;
const selected = new Set();
const prices = new Map();
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function number(id, optional = false) {
  const s = $(id).value.trim();
  if (!s && optional) return null;
  if (!s || !Number.isFinite(Number(s)) || Number(s) < 0)
    throw Error("请输入有效的非负数");
  return Number(s);
}
function render() {
  if (!data) return;
  try {
    const days = number("days"),
      unit = $("unit").value;
    const shared = {
      days,
      hours: unit === "month" ? 24 * days : Number(unit),
      utilization: number("utilization"),
      cost: number("cost", true),
    };
    const denom = unit === "month" ? "卡月" : unit === "24" ? "卡天" : "卡时";
    $("util-label").textContent = `${shared.utilization}%`;
    const rows = data.plans
      .filter((p) => selected.has(p.id))
      .map((plan) => {
        const price = prices.get(plan.priceReferenceId);
        const params = {
          ...shared,
          output: plan.outputTpsPerChip,
          input: plan.inputTpsPerChip,
          cachedInput: plan.cachedInputTpsPerChip,
          priceIn: number(price.input),
          priceCached: number(price.cached),
          priceOut: number(price.output),
        };
        return {
          plan,
          parameters: params,
          results: calculate(params),
          priceSource: price.changed
            ? "user-assumption"
            : data.priceReferences[plan.priceReferenceId],
        };
      });
    $("error").hidden = true;
    $("computed").hidden = false;
    $("export").disabled = !rows.length;
    const incomplete = rows.some(
      ({ plan }) =>
        plan.inputTpsPerChip === null || plan.cachedInputTpsPerChip === null,
    );
    $("coverage").textContent = rows.length
      ? `${rows.length} 个方案 · 元 / ${denom} · ${incomplete ? "缺失输入的方案仅显示已知输出价值" : "新增输入、缓存命中与输出完整计账"}`
      : "请勾选至少一个方案。";
    $("result-title").textContent =
      shared.utilization === 100
        ? "满载 API 等价产值"
        : "按利用率折算的 API 等价产值";
    $("kind").textContent = rows.some((r) => r.priceSource === "user-assumption")
      ? "实测产能 × 价格（含自定义）"
      : "实测产能 × 参考价格";
    $("columns").replaceChildren();
    const expense = rows[0]?.results.expense ?? null;
    const max =
      Math.max(0.01, expense ?? 0, ...rows.map((r) => r.results.value)) * 1.2;
    $("axis-top").textContent = fmt(max);
    $("axis-mid").textContent = fmt(max / 2);
    $("chart").style.minWidth =
      `${Math.max(300, (rows.length + (expense !== null ? 1 : 0)) * 165 + 48)}px`;
    for (const row of rows) {
      const { plan: p, results: r } = row;
      const complete =
        p.inputTpsPerChip !== null && p.cachedInputTpsPerChip !== null;
      const col = element("div", undefined, "column value-column");
      col.append(element("strong", `¥${fmt(r.value)}${complete ? "" : "*"}`));
      const stack = element("div", undefined, "bar-stack");
      stack.style.height = `${(r.value / max) * 220}px`;
      const total = r.peakOut + r.peakIn + r.peakCached;
      for (const [value, css] of [
        [r.peakCached, "cache-bar"],
        [r.peakIn, "input-bar"],
        [r.peakOut, "output-bar"],
      ]) {
        const segment = element("div", undefined, css);
        segment.style.height = `${total ? (value / total) * 100 : 0}%`;
        stack.append(segment);
      }
      col.append(stack, element("b", p.model), element("small", p.provider));
      $("columns").append(col);

    }
    if (expense !== null) {
      const col = element("div", undefined, "column");
      const bar = element("div", undefined, "cost-bar");
      bar.style.height = `${(expense / max) * 220}px`;
      col.append(
        element("strong", `¥${fmt(expense)}`),
        bar,
        element("b", "综合成本"),
        element("small", "用户输入 / 同单位"),
      );
      $("columns").append(col);
    }
    last = {
      generatedAt: new Date().toISOString(),
      unit: denom,
      plans: rows,
      caveat:
        "API 等价产值非收入、非利润、非 SLO 保证；硬件缓存命中映射到 API 缓存价为情景假设。",
    };
  } catch (e) {
    $("computed").hidden = true;
    $("error").hidden = false;
    $("error").textContent = e.message;
    $("export").disabled = true;
    last = null;
  }
}
function initialize() {
  $("plan-options").replaceChildren(element("legend", "旗舰推理方案 · 可多选"));
  for (const p of data.plans) {
    selected.add(p.id);
    const choice = element("div", undefined, "plan-choice");
    const check = element("input");
    check.type = "checkbox";
    check.id = `plan-${p.id}`;
    check.checked = true;
    check.value = p.id;
    check.setAttribute("aria-label", `${p.model} · ${p.provider} ${p.name}`);
    check.addEventListener("change", () => {
      check.checked ? selected.add(p.id) : selected.delete(p.id);
      render();
    });
    const copy = element("div");
    const label = element("label", `${p.model} · ${p.provider}`);
    label.htmlFor = check.id;
    const source = element("a", `${p.name} ↗`, "plan-source");
    source.href = p.source;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.title = "查看方案测量来源";
    copy.append(label, source);
    choice.append(check, copy);
    $("plan-options").append(choice);
  }
  for (const [id, p] of Object.entries(data.priceReferences)) {
    const box = element("fieldset");
    box.append(element("legend", p.model));
    const controls = { changed: false };
    for (const [key, label, value] of [
      ["input", "新增输入", p.inputCnyPerMillion],
      ["cached", "缓存命中输入", p.cachedInputCnyPerMillion],
      ["output", "输出", p.outputCnyPerMillion],
    ]) {
      const input = element("input");
      input.id = `price-${id}-${key}`;
      input.type = "number";
      input.min = "0";
      input.step = "0.01";
      input.value = value;
      input.defaultValue = value;
      const tag = element("label", label);
      tag.htmlFor = input.id;
      box.append(tag, input);
      controls[key] = input.id;
      input.addEventListener("input", () => {
        controls.changed = true;
        render();
      });
    }
    box.append(element("p", p.cacheScope, "hint"));
    prices.set(id, controls);
    $("price-controls").append(box);
    const note = element(
      "p",
      `${p.model}：新增输入 ¥${p.inputCnyPerMillion}，缓存命中输入 ¥${p.cachedInputCnyPerMillion}，输出 ¥${p.outputCnyPerMillion} / 百万 token。${p.region}；核对日期 ${p.checkedAt}。${p.cacheScope} `,
    );
    const link = element("a", "官方价格 ↗");
    link.href = p.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    note.append(link);
    $("price-note").append(note);
  }
  for (const id of ["utilization", "cost", "days", "unit"])
    $(id).addEventListener("input", render);
  $("reset").addEventListener("click", () => {
    $("utilization").value = 100;
    $("cost").value = "";
    $("days").value = 30;
    $("unit").value = "1";
    document.querySelectorAll("#plan-options input").forEach((c) => {
      c.checked = true;
      selected.add(c.value);
    });
    document
      .querySelectorAll("#price-controls input")
      .forEach((i) => (i.value = i.defaultValue));
    prices.forEach((p) => (p.changed = false));
    render();
  });
  $("export").addEventListener("click", () => {
    if (!last) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(last, null, 2)], { type: "application/json" }),
    );
    const a = element("a");
    a.href = url;
    a.download = "serving-plans.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
}
fetch("data/serving-plans.json?v=dense27-tp4-only-20261010", { cache: "no-cache" })
  .then((r) => {
    if (!r.ok) throw Error("方案数据读取失败");
    return r.json();
  })
  .then((d) => {
    data = d;
    initialize();
  })
  .catch((e) => {
    $("error").hidden = false;
    $("error").textContent = e.message;
    $("export").disabled = true;
  });
