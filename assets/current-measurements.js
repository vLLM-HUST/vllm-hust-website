(function () {
  'use strict';
  const main = document.querySelector('main');
  if (!main) return;
  const qualityPage = document.body.dataset.page === 'dataset-validation';
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
  let reportData;
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
    const title = qualityPage
      ? (zh ? 'MMLU-Pro · 同题质量回归' : 'MMLU-Pro · Matched quality regression')
      : (zh ? 'MMLU-Pro · 服务性能摘要' : 'MMLU-Pro · Serving performance summary');
    if (!data || !reportData) {
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
      { label: zh ? '开发栈对照' : 'Development control', value: throughput.baseline_value, candidate_id: 'baseline' },
      ...(throughput.candidate_values || [])
    ].filter(item => Number.isFinite(item.value) && item.value >= 0) : [];
    const maximum = Math.max(1, ...points.map(item => item.value));
    const bars = points.map(item => `<li><span>${escape(item.label || item.candidate_id)}</span><div class="measurement-bar-track"><div class="measurement-bar" style="width:${item.value / maximum * 100}%"></div></div><strong>${linkedNumber(item.value, item.candidate_id)}</strong></li>`).join('');
    const report = reportData.report_url;
    const safeReport = typeof report === 'string' && report.startsWith('https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/');
    const cards = data.results.map(result => {
      const metric = data.metrics.find(item => item.id === result.metric_id);
      return `<article class="result-metric" data-metric="${escape(result.metric_id)}"><h3>${escape(labels[result.metric_id] || result.metric_id)} <small>${escape(metric?.unit || '')}</small></h3>
        <div class="result-candidate">${escape(result.selected_candidate_id || '')}</div>
        <div class="result-pair"><div><span>B1 · 0.28.1/0.25.1rc2</span><strong>${linkedNumber(result.value, result.selected_candidate_id)}</strong></div></div></article>`;
    }).join('');
    const expanded = section.querySelector('#current-configuration')?.open;
    const relatedExpanded = section.querySelector('#result-related-evidence')?.open;
    const quality = reportData.current_summary.quality;
    const reference = reportData.current_summary.reference;
    const eta = reference.B1.eta_percent.toFixed(4);
    const qualityUrl = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${reportData.source_commit}/${quality.evidence_path}`;
    section.innerHTML = `<div class="result-heading"><div><span class="result-eyebrow">${zh ? '中期报告摘要 · 固定基线与按指标最优配置' : 'MIDTERM SUMMARY · FIXED BASELINE & METRIC-SPECIFIC BEST CONFIGURATIONS'}</span><h1>${title}</h1></div><span class="result-date">${escape(reportData.version)}</span></div>
      <p class="result-context">${escape(data.scenario.model)} · ${escape(data.scenario.precision)} · TP2 · ${data.scenario.num_prompts} ${zh ? '请求' : 'requests'} · out${data.scenario.output_length} · ${escape(data.scenario.hardware)}</p>
      <p class="result-boundary">${zh ? 'B0 固定：vLLM 0.18 / vLLM-Ascend 0.18。B1 基座版本不限，本页已测优化配置使用 0.28.1 / 0.25.1rc2 开发栈。' : 'B0 is fixed: vLLM 0.18 / vLLM-Ascend 0.18. B1 has no base-version restriction; the measured optimizations here use the 0.28.1 / 0.25.1rc2 development stack.'}</p>
      <div class="result-quality"><strong>${zh ? '同题质量 · out8192' : 'Matched quality · out8192'}</strong><span>B0: <a class="raw-evidence" href="${escape(qualityUrl)}">${quality.b0.correct}/${quality.b0.total}</a></span><span>${zh ? 'B1 · 当前纠正组合' : 'B1 · corrected combination'}: <a class="raw-evidence" href="${escape(qualityUrl)}">${quality.b1.candidate_correct}/${quality.b0.total}</a></span><small>${zh ? '固定200题子集；不代表全集或统计非劣' : 'Fixed 200-task subset; not full-corpus quality or statistical noninferiority'}</small></div>
      <p class="result-reference"><a href="#midterm-m01-verdict">${zh ? `M01 · B1 η=${eta}%，达到90%` : `M01 · B1 eta=${eta}%, meets 90%`}</a><br><small>${zh ? '90%为本轮实施判据；指定工况独立整链参考，共享实现且保留计数成本，不是芯片标称峰值利用率。' : '90% is the round implementation criterion; independently measured wholechain reference with shared code and accounting costs retained, not nominal chip-peak utilization.'}</small></p>
      <p class="result-comparison-note">${zh ? '服务性能 · out256：各指标分别选优，并非同一部署。本工况尚无固定 B0 性能配对，不计算收益。' : 'Serving performance · out256: metric-specific best configurations, not one deployment. No matched fixed B0 performance pair for this workload; gain not calculated.'}</p>
      <div class="result-metrics">${cards}</div>
      <p class="result-selection">${zh ? 'B1 按指标选择当前已实测最优方案；三项不代表同一部署。性能改善不等于质量或 M01 验收通过。' : 'B1 is the best measured solution per metric, not one deployment achieving all three. Performance gains do not establish quality or M01 acceptance.'}</p>
      <nav class="result-next" aria-label="${zh ? '结论与验证进展' : 'Conclusions and validation progress'}">
        <a href="#midterm-milestone-v15">${zh ? '本轮方法、成本与稳定性' : 'Current round method, cost & stability'}</a>
        <a href="#midterm-v15-remaining">${zh ? '新增复算 · 五项任务、成本与利用率' : 'New reanalysis · five tasks, cost & utilization'}</a>
        <a href="#midterm-dataset-quality-inventory">${zh ? '质量 · 子集配对，非全集' : 'Quality · paired subset, not full corpus'}</a>
        <a href="#midterm-long-context-parser">${zh ? '长上下文 · 原判分与解析复核分列' : 'Long context · original and parser review separate'}</a>
        <a href="#midterm-kv-audit">${zh ? 'KV · 跨轮状态核查未闭合' : 'KV · cross-run state review open'}</a>
        <a href="#midterm-m01-verdict">${zh ? 'M01 · 独立整链参考验收' : 'M01 · independent whole-chain assessment'}</a>
      </nav>
      <details id="current-configuration" ${expanded ? 'open' : ''}><summary>${zh ? '配置、候选对比与原始证据' : 'Configurations, candidates & original evidence'}</summary>
      <p>${escape(data.scenario.label)} · ${zh ? 'B1：当前已实测最优的 vLLM-HUST 优化方案，按指标选择。' : 'B1: currently best measured vLLM-HUST optimization solution, selected per metric.'}</p>
      <p>${zh ? '以下保留开发栈对照，不是 B0。' : 'The following development-stack control is not B0.'}</p>
      <div class="measurement-table-scroll"><table><thead><tr><th>${zh ? '指标' : 'Metric'}</th><th>${zh ? '开发栈对照' : 'Development control'}</th><th>B1</th><th>${zh ? '单位' : 'Unit'}</th><th>${zh ? 'B1 配置' : 'B1 configuration'}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <details><summary>${zh ? '同工况候选吞吐对比' : 'Same-workload candidate throughput'} (token/s)</summary><ul class="measurement-bars">${bars}</ul></details>
      <p>${zh ? '200 请求、out256 服务性能；不代表完整数据集准确率。有效算力核算进展见报告，不计作新增性能点。' : '200-request out256 serving performance, not full-dataset accuracy. Effective-compute accounting is documented in the report, not counted as new performance points.'}</p>
      <p><a href="${matrixPath}">${zh ? '查看配对矩阵与候选证据' : 'Paired matrix and candidate evidence'}</a> · <a href="${dataPath}">${zh ? '原始数据' : 'Source data'}</a>${safeReport ? ` · <a href="${escape(report)}">${zh ? '中文测试报告' : 'Chinese test report'}</a>` : ''}</p></details>`;
    // Keep the two entry pages task-specific without dropping evidence or anchors.
    const related = document.createElement('details');
    related.id = 'result-related-evidence';
    related.open = Boolean(relatedExpanded);
    related.innerHTML = `<summary>${qualityPage
      ? (zh ? '服务性能、M01 与其他验证进展' : 'Serving performance, M01 & other validation')
      : (zh ? 'M01 与其他验证进展' : 'M01 & other validation')}</summary>`;
    const secondary = qualityPage
      ? ['.result-reference', '.result-comparison-note', '.result-metrics', '.result-selection', '.result-next']
      : ['.result-reference', '.result-next'];
    secondary.forEach(selector => related.append(section.querySelector(selector)));
    section.querySelector('#current-configuration').before(related);
    if (qualityPage) {
      section.classList.add('quality-summary');
      section.querySelector('.result-context').textContent = `${data.scenario.model} · ${data.scenario.precision} · TP2 · 200 ${zh ? '题固定子集' : 'fixed tasks'} · out8192`;
    } else {
      const boundary = document.createElement('p');
      boundary.className = 'result-chart-boundary';
      boundary.textContent = zh
        ? '下方为其他工况的性能曲线，使用各自的模型、输入与运行配置；不与本摘要拼接比较。请以曲线的工况选择器和合同为准。'
        : 'The curves below cover other workloads with their own models, inputs and runtime configurations. Do not combine them with this summary; use each chart’s workload selector and contract.';
      section.append(boundary);
    }
    section.dataset.loaded = 'true';
  }
  window.addEventListener('vllm-hust:langchange', render);
  render();
  Promise.all([dataPath, './data/midterm-v096.json'].map(path => fetch(path, { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Measurement data unavailable');
    return response.json();
  }))).then(([value, report]) => {
    if (report.version !== 'V0.96' || report.comparison_contract?.b0?.fixed !== true ||
        report.comparison_contract.b0.vllm !== '0.18' || report.comparison_contract.b0.vllm_ascend !== '0.18' ||
        !/^[a-f0-9]{40}$/.test(report.source_commit) || !report.current_summary?.quality) throw Error('Invalid comparison identity');
    data = value; reportData = report; render();
  }).catch(() => { failed = true; data = null; render(); });
})();
