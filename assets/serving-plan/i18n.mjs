// Translate presentation only. Source notes and exported evidence keep their identity.
export const isZh = () => window.vllmHustSite?.getCurrentLang() === "zh";
export const t = (zh, en) => isZh() ? zh : en;
// Exact source-text keys prevent a new price condition inheriting an old translation.
export const sourceTranslations = new Map([
  ['C44 吞吐方案', 'C44 throughput configuration'],
  ['DeepSeek-V4.1-Flash（V4-0731 方案参考定价）', 'DeepSeek-V4.1-Flash (reference pricing for V4-0731)'],
  ['华北2（北京）', 'China North 2 (Beijing)'],
  ['中国公开刊例价', 'Published China list prices'],
  ['空闲时段公开价；高峰时段为两倍', 'Published off-peak prices; peak-period prices are twice as high'],
  ['百炼该模型不支持上下文缓存折扣；命中与新增输入均按普通输入价计。', 'Model Studio offers no context-cache discount for this model; cached and new input both use the standard input price.'],
  ['采用隐式缓存命中价；将实测命中输入映射为参考 API 的可计费命中量是情景假设，不保证云端相同命中率。未使用显式缓存价格。', 'Uses implicit-cache hit pricing, not explicit-cache pricing. Mapping measured cached input to billable API cache hits is a scenario assumption; the same cloud cache-hit rate is not guaranteed.'],
  ['采用现行 V4.1 Flash 空闲时段报价作为 V4-0731 部署方案的参考售价，可自行调整；不是同一 checkpoint 的官方报价。', 'Uses the recorded V4.1 Flash off-peak quote as an adjustable reference for the V4-0731 deployment; it is not an official quote for the same checkpoint.'],
  ['采用官方缓存命中价作参考；实测硬件缓存量映射到API计费量是情景假设，不保证云端相同命中率。', 'Uses the official cache-hit price as a reference. Mapping measured hardware cache volume to API billing is a scenario assumption; the same cloud cache-hit rate is not guaranteed.'],
  ['公开原价，输入≤128K，不含活动折扣；并非效果、吞吐或延迟等价承诺。', 'Published list price for input up to 128K, excluding promotions; no promise of equivalent quality, throughput or latency.'],
  ['北京公开原价，不含优惠或合同折扣；非云端体验或质量承诺。', 'Published Beijing list price, excluding promotional or contract discounts; no promise of cloud experience or quality.'],
  ['参考定价，不代表模型质量或云端性能等价。', 'Reference pricing does not establish equivalent model quality or cloud performance.'],
  ['参考API价格，不含优惠或合同折扣；非质量或云端性能等价承诺。', 'Reference API prices exclude promotional or contract discounts; no promise of equivalent quality or cloud performance.'],
]);
export const sourceEnglish = value => sourceTranslations.get(value) || value || '';
export const errorText = message => t(message, ({
  "展示时长必须大于零": "Display duration must be greater than zero",
  "利用率需为 0–100%，月份天数需为 1–366": "Utilization must be 0–100%; days per month must be 1–366",
  "输入吞吐与成本需为非负数": "Input throughput and cost must be non-negative",
  "数值过大，请缩小输入范围": "Values are too large; reduce the inputs",
})[message] || message.replace("请输入非负数", "enter a non-negative number"));

const copy = new Map([
  ["Serving Plan · 服务产能与成本", "Serving Plan · Capacity & cost"],
  ["服务产能与成本", "Serving capacity & cost"],
  ["从实测推理吞吐，到每卡服务产能与 API 等价产值。成本由你定义。", "From measured throughput to per-card capacity and API-equivalent value. You define the cost."],
  ["实测吞吐、参考价格和计算假设分开记账。API 等价产值是估算，不是实际收入；综合成本采用你输入的数值。", "Measurements, reference prices and assumptions are kept separate. API-equivalent value is an estimate, not revenue; costs use your inputs."],
  ["benchmark 数据源与校验清单", "Benchmark sources & checksums"],
  ["产能方案与价格依据", "Measured plans & price references"],
  ["01 / 计算条件", "01 / Assumptions"],
  ["旗舰推理方案 · 可多选", "Measured plans · select one or more"],
  ["正在读取方案…", "Loading measured plans…"],
  ["按模型与方案并列展示；不是不同模型的效果排名。", "Plans are shown side by side, not ranked across models."],
  ["有效利用率", "Effective utilization"],
  ["100% 为满载外推。利用率按等效满载时长折算，不是低负载性能预测。", "100% extrapolates full load. Utilization scales equivalent full-load time; it does not predict low-load performance."],
  ["综合成本 · 元 / 卡月", "Total cost · CNY / card-month"],
  ["选填", "Optional"],
  ["可合并卡租、主机、内存、电力与运维。不填成本，不计算差额。", "Include card rental, host, memory, electricity and operations. Leave blank to omit the cost comparison."],
  ["每月天数", "Days per month"],
  ["展示单位", "Display unit"],
  ["每卡小时", "Per card-hour"],
  ["每卡天", "Per card-day"],
  ["每卡月", "Per card-month"],
  ["各模型售价 / API 参考价", "Model pricing / API reference prices"],
  ["单位：元 / 百万 token。分别设置新增输入、缓存命中输入、输出的价格；修改后标为用户假设。", "CNY per million tokens. Set new-input, cached-input and output prices separately. Edits are marked as user assumptions."],
  ["恢复默认条件 ↺", "Reset assumptions ↺"],
  ["导出当前账单 ↓", "Export current calculation ↓"],
  ["02 / 服务价值", "02 / Service value"],
  ["满载 API 等价产值", "API-equivalent value at full load"],
  ["实测外推", "Measured extrapolation"],
  ["输出", "Output"],
  ["新增输入", "New input"],
  ["缓存命中输入", "Cached input"],
  ["成本参考", "Cost reference"],
  ["API 等价产值不是实际收入或利润。成本由你输入；不同模型、工作负载和价格的柱高，不能解释成优化倍数或效果等价。", "API-equivalent value is not revenue or profit. You supply costs; bar heights across different models, workloads and prices are not speedups or equivalent quality."],
  ["价格参考", "Price references"],
  ["这张账单回答什么？", "What does this calculation tell you?"],
  ["等价产值是按参考 API 单价折算的服务价值，不是销售收入或利润。日/月数值按同一工作负载、固定实测速率线性外推；不是长期稳定性测量。真实采购还需确认业务效果、体验要求、可靠性与运维投入。", "Equivalent value converts measured capacity using reference API prices; it is not revenue or profit. Daily/monthly values linearly extrapolate a fixed measured rate and workload, not long-term stability. Procurement also requires quality, experience, reliability and operating-cost validation."],
  ["服务产能与成本 · 输入仅在当前浏览器内计算，不上传。", "Capacity & cost · Inputs stay in your browser and are not uploaded."],
]);

// Keep original text nodes so links, form controls and their state are never rebuilt.
const nodes = [];
for (const root of document.querySelectorAll("main.serving-plan, .site-footer")) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const zh = node.textContent.trim().replace(/\s+/g, " ");
    if (copy.has(zh)) nodes.push({ node, zh, en: copy.get(zh) });
  }
}

export function translate() {
  document.title = t("服务产能与成本 — vLLM-HUST", "Capacity & cost — vLLM-HUST");
  for (const { node, zh, en } of nodes) node.textContent = t(zh, en);
  for (const node of document.querySelectorAll("[data-plan-zh]")) {
    node.textContent = t(node.dataset.planZh, node.dataset.planEn);
  }
  document.getElementById("cost").placeholder = t("填入你的实际成本", "Enter your actual cost");
  for (const node of document.querySelectorAll("#price-controls input")) node.placeholder = t("请输入售价", "Enter a price");
  document.querySelector(".chart-scroll").setAttribute("aria-label", t("方案产值柱状图，可横向滚动", "Plan value chart; scroll horizontally"));
  document.getElementById("chart").setAttribute("aria-label", t("各方案 API 等价产值", "API-equivalent value by plan"));
}
