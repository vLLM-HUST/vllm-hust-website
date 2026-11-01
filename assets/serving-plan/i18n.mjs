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
  ['采用隐式缓存命中价；将实测命中输入映射为参考 API 的可计费命中量是情景假设，不保证云端相同命中率。未使用显式缓存价格。', 'Uses implicit-cache pricing, assuming measured cached input maps to billable API cache hits.'],
  ['采用现行 V4.1 Flash 空闲时段报价作为 V4-0731 部署方案的参考售价，可自行调整；不是同一 checkpoint 的官方报价。', 'The V4-0731 plan uses V4.1 Flash off-peak pricing as an adjustable estimate.'],
  ['采用官方缓存命中价作参考；实测硬件缓存量映射到API计费量是情景假设，不保证云端相同命中率。', 'Uses official cache-hit pricing, assuming measured hardware cache volume maps to API billing.'],
  ['公开原价，输入≤128K，不含活动折扣；并非效果、吞吐或延迟等价承诺。', 'Published list price for input up to 128K, excluding promotions.'],
  ['北京公开原价，不含优惠或合同折扣；非云端体验或质量承诺。', 'Published Beijing list price, excluding promotional or contract discounts.'],
  ['参考定价，不代表模型质量或云端性能等价。', 'Reference API prices are used to estimate service value.'],
  ['参考API价格，不含优惠或合同折扣；非质量或云端性能等价承诺。', 'Reference API prices exclude promotional or contract discounts.'],
]);
const sourceChineseCopy = new Map([
  ["采用隐式缓存命中价；将实测命中输入映射为参考 API 的可计费命中量是情景假设，不保证云端相同命中率。未使用显式缓存价格。", "按隐式缓存命中价计费，假设实测命中输入可折算为 API 可计费命中量。"],
  ["采用现行 V4.1 Flash 空闲时段报价作为 V4-0731 部署方案的参考售价，可自行调整；不是同一 checkpoint 的官方报价。", "V4-0731 方案借用 V4.1 Flash 空闲时段报价估算，可修改。"],
  ["采用官方缓存命中价作参考；实测硬件缓存量映射到API计费量是情景假设，不保证云端相同命中率。", "按官方缓存命中价估算，假设实测硬件缓存量可折算为 API 计费量。"],
  ["公开原价，输入≤128K，不含活动折扣；并非效果、吞吐或延迟等价承诺。", "公开原价，输入≤128K，不含活动折扣。"],
  ["北京公开原价，不含优惠或合同折扣；非云端体验或质量承诺。", "北京公开原价，不含优惠或合同折扣。"],
  ["参考定价，不代表模型质量或云端性能等价。", "参考 API 单价用于产值估算。"],
  ["参考API价格，不含优惠或合同折扣；非质量或云端性能等价承诺。", "参考 API 价格，不含优惠或合同折扣。"],
]);
export const sourceChinese = value => sourceChineseCopy.get(value) || value || "";
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
  ["按实测吞吐和参考 API 单价估算服务产值，结合输入成本计算差额。", "Estimate service value from measured throughput and reference API prices, then compare it with your input costs."],
  ["benchmark 数据源与校验清单", "Benchmark sources & checksums"],
  ["产能方案与价格依据", "Measured plans & price references"],
  ["01 / 计算条件", "01 / Assumptions"],
  ["旗舰推理方案 · 可多选", "Measured plans · select one or more"],
  ["正在读取方案…", "Loading measured plans…"],
  ["选择模型与部署方案，查看各自的产能与价格。", "Select models and deployment plans to compare their capacity and pricing."],
  ["有效利用率", "Effective utilization"],
  ["100% 按实测满载速率外推；其他利用率折算为等效满载时长。", "100% extrapolates the measured full-load rate; other utilization levels scale equivalent full-load time."],
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
  ["柱高为各方案按参考价格折算的服务产值；成本线采用输入的综合成本。", "Bars show service value at each plan’s reference prices; the cost line uses your total-cost input."],
  ["价格参考", "Price references"],
  ["计算方法", "Calculation method"],
  ["API 等价产值＝实测每卡吞吐×等效满载时长×参考 API 单价。输入、缓存命中和输出分别计价，再合计；日/月产能按同一工作负载与实测速率线性外推。产值与输入成本的差额用于部署预算估算，实际收入取决于业务用量与成交价。", "API-equivalent value = measured per-card throughput × equivalent full-load time × reference API price. New input, cached input and output are priced separately and summed. Daily/monthly capacity linearly extrapolates the same workload and measured rate. The difference from input costs supports deployment budgeting; revenue depends on business usage and selling prices."],
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
