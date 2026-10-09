import { calculate } from "./calc.mjs";
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) =>
  n.toLocaleString("zh-CN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
let data, last;
const number = (id, optional = false) => {
  const s = $(id).value.trim();
  if (!s && optional) return null;
  if (!s) throw Error("请补全必填数值");
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw Error("数值必须为有效的非负数");
  return n;
};
function render() {
  if (!data) return;
  const custom = $("plan").value === "custom";
  $("custom-fields").hidden = !custom;
  $("measured-evidence").hidden = custom;
  $("custom-evidence").hidden = !custom;
  try {
    const days = number("days"),
      unit = $("unit").value,
      hours = unit === "month" ? 24 * days : Number(unit);
    const params = {
      output: custom ? number("throughput") : data.plans[0].outputTpsPerChip,
      input: number("input-tps", true),
      priceOut: number("price-out"),
      priceIn: number("price-in"),
      utilization: number("utilization"),
      hours,
      days,
      cost: number("cost", true),
    };
    const r = calculate(params),
      denom = unit === "month" ? "卡月" : unit === "24" ? "卡天" : "卡时";
    $("computed").hidden = false;
    $("error").hidden = true;
    $("export").disabled = false;
    $("util-label").textContent = `${params.utilization}%`;
    $("result-title").textContent =
      params.utilization === 100
        ? "满载 API 等价产值"
        : "按利用率折算的 API 等价产值";
    $("kind").textContent = custom ? "用户假设" : "实测外推";
    $("value").textContent = `¥ ${fmt(r.value)}`;
    $("denom").textContent = `元 / ${denom}`;
    $("coverage").textContent =
      params.input === null
        ? "仅计输出价值 · 输入计费量待补"
        : "输出 + 输入价值 · 输入吞吐为用户假设";
    const max = Math.max(r.value, r.expense ?? 0, 0.01) * 1.2,
      scale = 160 / max;
    $("axis-top").textContent = fmt(max);
    $("axis-mid").textContent = fmt(max / 2);
    $("bar").style.height = `${r.value * scale}px`;
    const total = r.peakIn + r.peakOut;
    $("input-bar").style.height = `${total ? (r.peakIn / total) * 100 : 0}%`;
    $("output-bar").style.height = `${total ? (r.peakOut / total) * 100 : 0}%`;
    $("cost-bar").style.height = `${(r.expense ?? 0) * scale}px`;
    $("cost-bar").style.opacity = r.expense === null ? 0.25 : 1;
    $("bar-value").textContent = `¥${fmt(r.value)}`;
    $("cost-value").textContent =
      r.expense === null ? "待填写" : `¥${fmt(r.expense)}`;
    $("bar-name").textContent = custom
      ? $("model").value || "自定义模型"
      : data.plans[0].model;
    $("bar-plan").textContent = custom ? "自定义规划假设" : "C44 · BetterScale";
    $("tokens").textContent = fmt(r.outputTokens / 1e6);
    $("tokens-unit").textContent = `百万 token / ${denom}`;
    $("difference").textContent =
      r.difference === null
        ? "待填成本"
        : `${r.difference >= 0 ? "+" : "−"} ¥${fmt(Math.abs(r.difference))}`;
    $("breakeven").textContent =
      r.expense === null
        ? "待填成本"
        : r.breakEven === null
          ? "不适用"
          : `${fmt(r.breakEven, 1)}%`;
    $("break-note").textContent =
      r.breakEven > 100
        ? "满载时当前已计价值仍不足覆盖成本"
        : "按当前已计价值计算";
    $("verdict").textContent =
      r.expense === null
        ? "先看这套方案的产能，再填入你的综合成本。我们不替你假定采购价。"
        : r.difference >= 0
          ? "当前假设下，已计 API 等价产值覆盖综合成本。差额仅供采购比较，不是实际销售利润。"
          : "当前假设下，已计 API 等价产值低于综合成本。请结合未计输入价值、真实合同价格与业务体验判断。";
    $("price-note").textContent =
      $("pricing").value === "beijing"
        ? "百炼北京区域，同模型输入 ≤128K 公开原价：输入 ¥0.4 / 百万 token，输出 ¥3.2 / 百万 token。核对日期 2026-10-09，不含促销和合同折扣；服务限流需另行核对。"
        : "当前采用用户自定义价格，非官方报价。请确认适用模型、区域、长度档位及缓存折扣；链接仅为原始参考。";
    last = {
      generatedAt: new Date().toISOString(),
      model: $("bar-name").textContent,
      plan: custom ? "user-assumption" : data.plans[0],
      parameters: params,
      unit: denom,
      results: r,
      priceSource:
        $("pricing").value === "beijing"
          ? data.priceReference
          : "user-assumption",
      caveat:
        $("coverage").textContent +
        "；API 等价产值非收入、非利润、非 SLO 保证。",
    };
  } catch (e) {
    $("error").hidden = false;
    $("error").textContent = e.message;
    $("computed").hidden = true;
    $("export").disabled = true;
    last = null;
  }
}
document.querySelectorAll("input,select").forEach((el) =>
  el.addEventListener("input", () => {
    if (["price-in", "price-out"].includes(el.id))
      $("pricing").value = "custom";
    if (el.id === "plan" && el.value === "custom")
      $("pricing").value = "custom";
    if (el.id === "pricing" && el.value === "beijing") {
      if ($("plan").value === "custom") {
        $("pricing").value = "custom";
      } else {
        $("price-in").value = data.priceReference.inputCnyPerMillion;
        $("price-out").value = data.priceReference.outputCnyPerMillion;
      }
    }
    render();
  }),
);
$("reset").addEventListener("click", () => {
  for (const [id, value] of Object.entries({
    plan: "measured",
    utilization: 100,
    cost: "",
    days: 30,
    unit: "1",
    pricing: "beijing",
    "price-in": 0.4,
    "price-out": 3.2,
    "input-tps": "",
    throughput: 675.4,
    model: "自定义方案",
  }))
    $(id).value = value;
  render();
});
$("export").addEventListener("click", () => {
  if (!last) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(last, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "serving-plan.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
try {
  const response = await fetch("data/serving-plans.json");
  if (!response.ok) throw Error("数据加载失败，请刷新重试");
  data = await response.json();
  render();
} catch (e) {
  $("error").hidden = false;
  $("error").textContent = e.message;
  $("computed").hidden = true;
  $("export").disabled = true;
}
