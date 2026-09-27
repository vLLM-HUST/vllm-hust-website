/* Derive MOD throughput changes from their published five-point comparison sets. */
(function (root) {
  const commonParameters = [
    'tensor_parallel_size', 'pipeline_parallel_size', 'data_parallel_size',
    'expert_parallel', 'max_num_seqs', 'max_num_batched_tokens',
    'async_scheduling', 'prefix_caching', 'mamba_cache_mode',
    'mtp_draft_tokens', 'thinking', 'generation_temperature',
    'kv_cache_memory_bytes', 'checkpoint_revision'
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
    if (data.schema_version !== 'plugin-performance/v6'
        || data.metric !== 'output_tps' || data.aggregation !== 'geometric-mean'
        || JSON.stringify(data.concurrencies) !== '[1,2,4,8,16]'
        || !Array.isArray(data.comparison_sets)) throw new Error('Invalid comparison contract');
    const assignments = new Map();
    const baselines = new Map();
    for (const set of data.comparison_sets) {
      if (!set.baseline_series_id || !Array.isArray(set.entry_ids)) {
        throw new Error('Invalid comparison set');
      }
      const baseline = series(frontier, set.baseline_series_id, data.concurrencies, []);
      if (!baseline || !identity(baseline[0])
          || baseline.some(point => identity(point) !== identity(baseline[0]))) {
        throw new Error('Incomplete or inconsistent Native series');
      }
      baselines.set(set.baseline_series_id, baseline);
      for (const id of set.entry_ids) {
        if (assignments.has(id)) throw new Error('MOD assigned to multiple comparison sets');
        assignments.set(id, set.baseline_series_id);
      }
    }
    const ids = new Set();
    return new Map(data.entries.map(entry => {
      if (ids.has(entry.id) || ['baseline', 'baseline_id', 'baseline_series_id', 'pairs', 'ratios', 'gain'].some(key => key in entry)) {
        throw new Error('Per-MOD comparison or precomputed score is forbidden');
      }
      ids.add(entry.id);
      const baselineSeriesId = assignments.get(entry.id);
      const baseline = baselines.get(baselineSeriesId);
      const candidate = entry.series_id ? series(frontier, entry.series_id, data.concurrencies, [entry.id]) : null;
      const compatible = baseline && candidate
        && candidate.every((point, index) => identity(point) === identity(baseline[index]));
      const comparisons = compatible ? candidate.map((point, index) => ({
        concurrency: point.load.concurrency, point_id: point.id,
        baseline_point_id: baseline[index].id,
        gain: (point.metrics.output_tps / baseline[index].metrics.output_tps - 1) * 100
      })) : [];
      const published = entry.published_comparisons;
      if (published && (entry.series_id || !Array.isArray(published) || !published.length
          || published.some(row => row.metric !== data.metric
            || !Number.isFinite(row.baseline) || row.baseline <= 0
            || !Number.isFinite(row.candidate) || row.candidate <= 0
            || !row.model_label || !row.scope)
          || published.some(row => row.model_label !== published[0].model_label))) {
        throw new Error('Invalid published comparison');
      }
      const gain = comparisons.length
        ? (Math.exp(comparisons.reduce((sum, row) => sum + Math.log1p(row.gain / 100), 0) / comparisons.length) - 1) * 100
        : published ? (Math.exp(published.reduce((sum, row) => sum + Math.log(row.candidate / row.baseline), 0) / published.length) - 1) * 100 : null;
      const modelLabel = baseline
        ? frontier.cohorts.find(cohort => cohort.id === baseline[0].cohort_id)?.model.label
        : published?.[0].model_label || null;
      return [entry.id, { ...entry, gain,
        count: comparisons.length || (published ? published.length : 0), comparisons,
        baseline_series_id: baselineSeriesId || null, modelLabel,
        source: comparisons.length ? 'frontier' : published ? 'published-comparison' : null }];
    }));
  }
  function compare(left, right, results) {
    const a = results.get(left.id)?.gain, b = results.get(right.id)?.gain;
    const aMeasured = Number.isFinite(a), bMeasured = Number.isFinite(b);
    if (aMeasured !== bMeasured) return aMeasured ? -1 : 1;
    return aMeasured ? b - a : 0;
  }
  const api = { summarize, compare };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PluginPerformance = api;
})(globalThis);
