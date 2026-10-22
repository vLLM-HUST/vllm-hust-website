(function () {
  'use strict';
  const main = document.querySelector('main');
  if (!main) return;
  const section = document.createElement('section');
  section.className = 'current-measurements';
  section.id = 'current-workload';
  section.setAttribute('aria-live', 'polite');
  const navigation = main.querySelector('.benchmark-tabs');
  if (navigation) navigation.after(section);
  else main.prepend(section);
  const dataPath = './data/dataset_validation_qwen35_mmlu_school028_inf_out256.json';
  const matrixPath = './dataset-validation.html?model=qwen35-35b-a3b-bf16-tp2-school028-mmlu-inf-out256#validation-content';
  const escape = value => String(value).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const number = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';
  let data;
  let failed = false;
  const original = id => {
    const paths = { baseline: ['blob', 'aligned-mmlu-b0.tar.gz'],
      'e16-r36': ['blob', 'aligned-mmlu-b1.tar.gz'], e32: ['blob', 'b1-e32-screen-evidence.tar.gz'],
      e24: ['blob', 'b1-e24-screen-evidence.tar.gz'], kvmat: ['blob', 'b1-kvmat-screen-evidence.tar.gz'],
      'kvmat-e24': ['blob', 'b1-kvmat-e24-screen-evidence.tar.gz'],
      'microflow-fa-median': ['tree', 'microflow-school028'],
      'vspec-argmax-median': ['tree', 'vspec-school028'] };
    const source = paths[id];
    if (!source || !/^[a-f0-9]{40}$/.test(data?.source?.commit || '')) return null;
    return `https://github.com/vLLM-HUST/vllm-hust-benchmark/${source[0]}/${data.source.commit}/reports/vllm-hust-midterm-20261019/${source[1]}`;
  };
  const linkedNumber = (value, id) => original(id)
    ? `<a class="raw-evidence" href="${original(id)}" title="原始测试数据 / Original test data">${number(value)}</a>` : number(value);
  function render() {
    const zh = window.vllmHustSite?.getCurrentLang() === 'zh';
    const title = zh ? 'MMLU-Pro · 当前实测 B0 / B1' : 'MMLU-Pro · Current measured B0 / B1';
    if (!data) {
      section.innerHTML = `<h2>${title}</h2><p>${failed
        ? (zh ? '实测摘要加载失败。' : 'Measurement summary unavailable.')
        : (zh ? '正在加载实测结果…' : 'Loading measurements…')}</p><a href="${dataPath}">${zh ? '原始数据' : 'Source data'}</a>`;
      return;
    }
    const labels = zh
      ? { output_token_throughput: '输出吞吐', ttft_mean: '平均首 token 延迟', tpot_mean: '平均 token 间延迟' }
      : { output_token_throughput: 'Output throughput', ttft_mean: 'Mean TTFT', tpot_mean: 'Mean TPOT' };
    const rows = data.results.map(result => {
      const metric = data.metrics.find(item => item.id === result.metric_id);
      const candidate = result.candidate_values?.find(item => item.candidate_id === result.selected_candidate_id);
      return `<tr><th scope="row">${escape(labels[result.metric_id] || result.metric_id)}</th><td>${linkedNumber(result.baseline_value, 'baseline')}</td><td>${linkedNumber(result.value, result.selected_candidate_id)}</td><td>${escape(metric?.unit || '')}</td><td>${escape(candidate?.label || result.selected_candidate_id || '')}</td></tr>`;
    }).join('');
    const throughput = data.results.find(item => item.metric_id === 'output_token_throughput');
    const points = throughput ? [
      { label: 'B0 Native', value: throughput.baseline_value, candidate_id: 'baseline' },
      ...(throughput.candidate_values || [])
    ].filter(item => Number.isFinite(item.value) && item.value >= 0) : [];
    const maximum = Math.max(1, ...points.map(item => item.value));
    const bars = points.map(item => `<li><span>${escape(item.label || item.candidate_id)}</span><div class="measurement-bar-track"><div class="measurement-bar" style="width:${item.value / maximum * 100}%"></div></div><strong>${linkedNumber(item.value, item.candidate_id)}</strong></li>`).join('');
    const report = data.source?.report_url;
    const safeReport = typeof report === 'string' && report.startsWith('https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/');
    const cards = data.results.map(result => {
      const metric = data.metrics.find(item => item.id === result.metric_id);
      return `<article class="result-metric" data-metric="${escape(result.metric_id)}"><h3>${escape(labels[result.metric_id] || result.metric_id)} <small>${escape(metric?.unit || '')}</small></h3>
        <div class="result-pair"><div><span>B0 · Native</span><strong>${linkedNumber(result.baseline_value, 'baseline')}</strong></div><div><span>B1 · vLLM-HUST</span><strong>${linkedNumber(result.value, result.selected_candidate_id)}</strong></div></div>
        <p class="result-change">${Number.isFinite(result.delta_pct) ? `${result.delta_pct > 0 ? '+' : ''}${number(result.delta_pct)}%` : '—'} <span>${zh ? '相对本工况 B0' : 'vs this workload’s B0'}</span></p>
        <small>${escape(result.selected_candidate_id || '')}</small></article>`;
    }).join('');
    const expanded = section.querySelector('#current-configuration')?.open;
    section.innerHTML = `<div class="result-heading"><div><span class="result-eyebrow">${zh ? '当前工况 · 开发栈对照' : 'CURRENT WORKLOAD · DEVELOPMENT STACK'}</span><h1>${title}</h1></div><span class="result-date">${escape(throughput?.updated_at || data.baseline.generated_at)}</span></div>
      <p class="result-context">${escape(data.scenario.model)} · ${escape(data.scenario.precision)} · TP2 · ${data.scenario.num_prompts} ${zh ? '请求' : 'requests'} · out${data.scenario.output_length} · ${escape(data.scenario.hardware)}</p>
      <p class="result-boundary">${zh ? '本组比较：vLLM 0.28.1 / Ascend 0.25.1rc2 开发栈。指定的 0.18 / 0.18 基线另列，不以此替代验收。' : 'This comparison: vLLM 0.28.1 / Ascend 0.25.1rc2 development stack. The designated 0.18 / 0.18 baseline is separate; these are not its acceptance results.'}</p>
      <div class="result-metrics">${cards}</div>
      <p class="result-selection">${zh ? 'B1 按指标选择当前已实测最优方案；三项不代表同一部署。性能改善不等于质量或 M01 验收通过。' : 'B1 is the best measured solution per metric, not one deployment achieving all three. Performance gains do not establish quality or M01 acceptance.'}</p>
      <nav class="result-next" aria-label="${zh ? '结论与验证进展' : 'Conclusions and validation progress'}">
        <a href="#midterm-native-paired-quality">${zh ? '质量 · 子集配对，非全集' : 'Quality · paired subset, not full corpus'}</a>
        <a href="#midterm-long-context-parser">${zh ? '长上下文 · 原判分与解析复核分列' : 'Long context · original and parser review separate'}</a>
        <a href="#midterm-kv-audit">${zh ? 'KV · 跨轮状态核查未闭合' : 'KV · cross-run state review open'}</a>
        <a href="#midterm-m01-verdict">${zh ? 'M01 · 本轮未通过' : 'M01 · not accepted this round'}</a>
      </nav>
      <details id="current-configuration" ${expanded ? 'open' : ''}><summary>${zh ? '配置、候选对比与原始证据' : 'Configurations, candidates & original evidence'}</summary>
      <p>${escape(data.scenario.label)} · ${zh ? 'B1：当前已实测最优的 vLLM-HUST 优化方案，按指标选择。' : 'B1: currently best measured vLLM-HUST optimization solution, selected per metric.'}</p>
      <div class="measurement-table-scroll"><table><thead><tr><th>${zh ? '指标' : 'Metric'}</th><th>B0</th><th>B1</th><th>${zh ? '单位' : 'Unit'}</th><th>${zh ? 'B1 配置' : 'B1 configuration'}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <details><summary>${zh ? '同工况候选吞吐对比' : 'Same-workload candidate throughput'} (token/s)</summary><ul class="measurement-bars">${bars}</ul></details>
      <p>${zh ? '200 请求、out256 服务性能；不代表完整数据集准确率。有效算力核算进展见报告，不计作新增性能点。' : '200-request out256 serving performance, not full-dataset accuracy. Effective-compute accounting is documented in the report, not counted as new performance points.'}</p>
      <p><a href="${matrixPath}">${zh ? '查看配对矩阵与候选证据' : 'Paired matrix and candidate evidence'}</a> · <a href="${dataPath}">${zh ? '原始数据' : 'Source data'}</a>${safeReport ? ` · <a href="${escape(report)}">${zh ? '中文测试报告' : 'Chinese test report'}</a>` : ''}</p></details>`;
    section.dataset.loaded = 'true';
  }
  window.addEventListener('vllm-hust:langchange', render);
  render();
  fetch(dataPath).then(response => {
    if (!response.ok) throw new Error('Measurement data unavailable');
    return response.json();
  }).then(value => { data = value; render(); }).catch(() => { failed = true; data = null; render(); });
})();
