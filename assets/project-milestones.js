/* Project achievement persists within its certified scope; campaign results stay separate. */
(() => {
  'use strict';
  function validate(data) {
    const current = data.formal_targets?.['3.4.1'];
    const historical = current?.historical_evidence;
    const reference = data.compute_reference_statistics;
    if (typeof historical?.accepted !== 'boolean' ||
        !Number.isFinite(historical.measured_value) ||
        (historical.accepted && historical.measured_value < 50) ||
        !historical.accepted_scope?.includes('fixed200/out256') ||
        !/^[a-f0-9]{64}$/.test(current.source_summary_sha256 || '') ||
        !/^[a-f0-9]{40}$/.test(reference?.benchmark_commit || '') ||
        historical.source_url !== `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${reference.benchmark_commit}/reports/m01-qualified-pair-20261103/README.md`) {
      throw Error('Invalid scoped project compute milestone');
    }
  }
  function select(data, id) {
    if (id === '3.4.1') {
      validate(data);
      return data.formal_targets[id].historical_evidence;
    }
    return data.formal_targets[id];
  }
  window.vllmHustProjectMilestones = Object.freeze({validate, select});
})();
