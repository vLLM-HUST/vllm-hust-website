/* Comparisons require one shared Native series. Historical per-MOD ratios are rejected. */
(function (root) {
  const launchStatuses = new Set([
    'manager-verified',
    'manager-verified-supplemental-adapter',
    'external-harness-only',
    'not-reproduced-this-round'
  ]);
  const configurationPaths = new Set([
    'manager-standard',
    'supplemental-adapter',
    'specialized-experiment-script',
    'not-evaluated'
  ]);
  function summarize(data, frontier = {points: []}) {
    if (data.schema_version !== 'plugin-performance/v2' || data.baseline !== null
        || data.status !== 'awaiting-unified-native') throw new Error('Unified Native evidence is not admitted');
    if (data.ecpa_experiment_boundary?.performance_analysis !== 'external-harness'
        || data.ecpa_experiment_boundary?.process_release !== 'known-defect') {
      throw new Error('Unsupported performance evidence boundary');
    }
    return new Map(data.entries.map(entry => {
      if ('pairs' in entry || 'ratios' in entry) throw new Error('Per-MOD Native comparisons are forbidden');
      if (!launchStatuses.has(entry.ecpa?.launch_acceptance)
          || !configurationPaths.has(entry.ecpa?.configuration_path)
          || entry.ecpa?.analysis_integration !== 'external-harness'
          || !entry.ecpa?.note_en || !entry.ecpa?.note_zh) {
        throw new Error(`Invalid ECPA status: ${entry.id}`);
      }
      if (entry.ecpa.launch_acceptance === 'manager-verified-supplemental-adapter'
          && (entry.ecpa.configuration_path !== 'supplemental-adapter'
            || entry.ecpa.adapter_merge_state !== 'open-draft'
            || !entry.ecpa.adapter_evidence
            || entry.ecpa.known_defect !== 'process-release'
            || !entry.ecpa.defect_evidence)) {
        throw new Error(`Invalid supplemental adapter evidence: ${entry.id}`);
      }
      const points = frontier.points.filter(point =>
        point.cohort_id === 'qwen35-35b-a3b-bf16-sweprefix-smoke-v1'
        && point.configuration?.mods?.includes(entry.id)
        && point.evidence?.status === 'measured'
        && Number.isFinite(point.metrics?.output_tps));
      return [entry.id, { ...entry, gain: null, count: 0,
        measuredPointCount: points.length,
        measuredConcurrencies: [...new Set(points.map(point => point.load.concurrency))].sort((a, b) => a - b)
      }];
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
