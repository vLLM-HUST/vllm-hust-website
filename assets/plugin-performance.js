/* Ranking uses paired throughput ratios, never maturity or a hand-entered rank. */
(function (root) {
  const groupOrder = { qwen35: 0, other: 1 };
  function summarize(data, frontier) {
    const points = new Map(frontier.points.map(point => [point.id, point]));
    return new Map(data.entries.map(entry => {
      const ratios = entry.pairs ? entry.pairs.map(pair => {
        const candidate = points.get(pair.candidate), native = points.get(pair.native);
        if (!candidate || !native || candidate.evidence.status !== 'measured' || native.evidence.status !== 'measured'
            || !candidate.configuration.mods.includes(entry.id) || native.configuration.mods.length
            || candidate.cohort_id !== native.cohort_id || candidate.load.concurrency !== native.load.concurrency
            || candidate.configuration.hardware.accelerator_count !== native.configuration.hardware.accelerator_count) {
          throw new Error(`Invalid performance pair: ${entry.id}`);
        }
        return candidate.metrics.output_tps / native.metrics.output_tps;
      }) : entry.ratios;
      if (!Array.isArray(ratios) || ratios.some(ratio => !Number.isFinite(ratio) || ratio <= 0)) throw new Error('Invalid throughput ratio');
      const gain = ratios.length ? 100 * (Math.exp(ratios.reduce((sum, ratio) => sum + Math.log(ratio), 0) / ratios.length) - 1) : null;
      return [entry.id, { ...entry, gain, count: ratios.length }];
    }));
  }
  function compare(left, right, results) {
    const a = results.get(left.id), b = results.get(right.id);
    if (Boolean(a) !== Boolean(b)) return a ? -1 : 1;
    if (!a) return 0;
    return groupOrder[a.group] - groupOrder[b.group]
      || (b.gain ?? -Infinity) - (a.gain ?? -Infinity) || left.id.localeCompare(right.id);
  }
  const api = { summarize, compare };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PluginPerformance = api;
})(globalThis);
