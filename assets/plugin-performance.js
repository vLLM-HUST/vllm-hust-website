/* Comparisons require one shared Native series. Historical per-MOD ratios are rejected. */
(function (root) {
  function summarize(data) {
    if (data.schema_version !== 'plugin-performance/v2' || data.baseline !== null
        || data.status !== 'awaiting-unified-native') throw new Error('Unified Native evidence is not admitted');
    return new Map(data.entries.map(entry => {
      if ('pairs' in entry || 'ratios' in entry) throw new Error('Per-MOD Native comparisons are forbidden');
      return [entry.id, { ...entry, gain: null, count: 0 }];
    }));
  }
  function compare(left, right, results) {
    const a = results.has(left.id), b = results.has(right.id);
    return a !== b ? (a ? -1 : 1) : left.id.localeCompare(right.id);
  }
  const api = { summarize, compare };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PluginPerformance = api;
})(globalThis);
