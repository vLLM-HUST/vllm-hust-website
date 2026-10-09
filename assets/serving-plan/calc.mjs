export function calculate({
  output,
  input = null,
  priceOut,
  priceIn,
  utilization,
  hours,
  days,
  cost = null,
}) {
  for (const [k, v] of Object.entries({
    output,
    priceOut,
    priceIn,
    utilization,
    hours,
    days,
  }))
    if (!Number.isFinite(v) || v < 0) throw Error(`${k}: 请输入非负数`);
  if (hours <= 0) throw Error("展示时长必须大于零");
  if (utilization > 100 || days < 1 || days > 366)
    throw Error("利用率需为 0–100%，月份天数需为 1–366");
  for (const v of [input, cost])
    if (v !== null && (!Number.isFinite(v) || v < 0))
      throw Error("输入吞吐与成本需为非负数");
  const peakOut = (output * 3600 * hours * priceOut) / 1e6;
  const peakIn = ((input ?? 0) * 3600 * hours * priceIn) / 1e6;
  const value = ((peakIn + peakOut) * utilization) / 100;
  const expense = cost === null ? null : (cost * hours) / (24 * days);
  const monthlyPeak = ((peakIn + peakOut) / hours) * 24 * days;
  const result = {
    peakOut,
    peakIn,
    value,
    expense,
    difference: expense === null ? null : value - expense,
    breakEven:
      cost === null || monthlyPeak === 0 ? null : (cost / monthlyPeak) * 100,
    outputTokens: (output * 3600 * hours * utilization) / 100,
  };
  if (Object.values(result).some((v) => v !== null && !Number.isFinite(v)))
    throw Error("数值过大，请缩小输入范围");
  return result;
}
