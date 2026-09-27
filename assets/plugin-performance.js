/* Derive every MOD's throughput change from one declared Native series. */
(function (root) {
  const commonParameters = [
    'tensor_parallel_size', 'pipeline_parallel_size', 'data_parallel_size',
    'expert_parallel', 'max_num_seqs', 'max_num_batched_tokens',
    'async_scheduling', 'prefix_caching', 'mamba_cache_mode',
    'mtp_draft_tokens', 'thinking', 'generation_temperature',
    'kv_cache_memory_bytes', 'host_kv_budget_gib', 'checkpoint_revision'
  ];
  function identity(point) {
    const c = point.configuration, p = c.parameters, e = point.evidence;
    const protocol = e.benchmark_protocol;
    const runtime = p.runtime_base_commits;
    if (!runtime?.vllm || !(runtime['vllm-ascend'] || runtime.vllm_ascend)
        || !protocol?.prepared_workload_sha256 || !protocol.tokenizer_fingerprint
        || commonParameters.some(key => p[key] === undefined)) return null;
    return JSON.stringify([
      point.cohort_id, c.engine, c.engine_version, c.hardware.label,
      c.hardware.accelerator_count, c.context_capacity_tokens,
      ...commonParameters.map(key => p[key]), runtime.vllm,
      runtime['vllm-ascend'] || runtime.vllm_ascend,
      protocol.protocol_id, protocol.prepared_workload_sha256,
      protocol.tokenizer_fingerprint, e.measurement_seconds
    ]);
  }
  function series(frontier, id, loads, mods) {
    const points = frontier.points.filter(point => point.load.concurrency_series === id);
    if (points.length !== loads.length) return null;
    const rows = loads.map(concurrency => {
      const matches = points.filter(point => point.load.concurrency === concurrency);
      if (matches.length !== 1) return null;
      const point = matches[0];
      if (point.evidence.status !== 'measured' || !point.evidence.run_ids?.length
          || !point.evidence.url || !Number.isFinite(point.metrics.output_tps)
          || point.metrics.output_tps <= 0
          || JSON.stringify(point.configuration.mods) !== JSON.stringify(mods)
          || !['FULL', 'FULL_AND_PIECEWISE'].includes(point.configuration.parameters.graph_mode)) return null;
      return point;
    });
    return rows.every(Boolean) ? rows : null;
  }
  function summarize(data, frontier) {
    if (data.schema_version !== 'plugin-performance/v3'
        || data.metric !== 'output_tps' || data.aggregation !== 'geometric-mean'
        || JSON.stringify(data.concurrencies) !== '[1,2,4,8,16]'
        || !data.baseline?.series_id) throw new Error('Invalid shared Native contract');
    const baseline = series(frontier, data.baseline.series_id, data.concurrencies, []);
    if (!baseline || !identity(baseline[0])
        || baseline.some(point => identity(point) !== identity(baseline[0]))) {
      throw new Error('Incomplete or inconsistent Native series');
    }
    const modelLabel = frontier.cohorts.find(cohort => cohort.id === baseline[0].cohort_id)?.model.label;
    const ids = new Set();
    return new Map(data.entries.map(entry => {
      if (ids.has(entry.id) || ['baseline', 'baseline_id', 'pairs', 'ratios', 'gain'].some(key => key in entry)) {
        throw new Error('Per-MOD baseline or precomputed score is forbidden');
      }
      ids.add(entry.id);
      const candidate = entry.series_id ? series(frontier, entry.series_id, data.concurrencies, [entry.id]) : null;
      const compatible = candidate && candidate.every((point, index) => identity(point) === identity(baseline[index]));
      const comparisons = compatible ? candidate.map((point, index) => ({
        concurrency: point.load.concurrency, point_id: point.id,
        baseline_point_id: baseline[index].id,
        gain: (point.metrics.output_tps / baseline[index].metrics.output_tps - 1) * 100
      })) : [];
      const gain = comparisons.length
        ? (Math.exp(comparisons.reduce((sum, row) => sum + Math.log1p(row.gain / 100), 0) / comparisons.length) - 1) * 100
        : null;
      return [entry.id, { ...entry, gain, count: comparisons.length, comparisons,
        baseline_series_id: data.baseline.series_id, modelLabel }];
    }));
  }
  function compare(left, right, results) {
    const a = results.get(left.id)?.gain, b = results.get(right.id)?.gain;
    const aMeasured = Number.isFinite(a), bMeasured = Number.isFinite(b);
    if (aMeasured !== bMeasured) return aMeasured ? -1 : 1;
    if (aMeasured) return b - a;
    const aHasData = results.has(left.id), bHasData = results.has(right.id);
    return aHasData === bHasData ? 0 : aHasData ? -1 : 1;
  }
  const api = { summarize, compare };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PluginPerformance = api;
})(globalThis);
