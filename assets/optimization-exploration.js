(() => {
  'use strict';
  const directory = 'data/optimization-exploration-20261115-v1/';
  const names = ['tradeoff.json', 'tradeoff.svg', 'all-trials.svg', 'all-trials.csv', 'provenance.json'];
  const finitePositive = value => Number.isFinite(value) && value > 0;
  const count = value => Number.isInteger(value) && value >= 0 && value <= 200;
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  function validate(data) {
    const fail = () => { throw Error('Invalid or incomplete exploration source'); };
    if (data?.schema !== 'vllm-hust-tradeoff-evidence/v1' ||
        !Array.isArray(data.rows) || !data.rows.length || !Array.isArray(data.sources) ||
        data.quality_qualified !== false || data.stability_qualified !== false || data.candidate_promoted !== false ||
        data.physical_trials !== data.rows.length || !hash(data.catalog_sha256)) fail();
    const ids = new Set();
    let admitted = 0;
    for (const row of data.rows) {
      if (typeof row.id !== 'string' || ids.has(row.id) || row.planned !== 200 ||
          typeof row.family !== 'string' || typeof row.state !== 'string' || typeof row.timing_eligible !== 'boolean') fail();
      ids.add(row.id);
      if (row.timing_eligible) {
        admitted++;
        if (row.recorded !== 200 || row.successful !== 200 || row.unreturned !== 0 || !hash(row.seal_sha256) ||
            ![row.output_tokens_per_second, row.mean_ttft_ms, row.mean_tpot_ms, row.ttft_p95_ms, row.tpot_p95_ms, row.output_tokens, row.duration_seconds].every(finitePositive) ||
            ![row.correct, row.truncated, row.unparsed].every(count) ||
            Math.abs(row.output_tokens / row.duration_seconds - row.output_tokens_per_second) > 1e-8 * Math.max(1, row.output_tokens_per_second)) fail();
      } else if ([row.output_tokens_per_second, row.mean_ttft_ms, row.mean_tpot_ms, row.correct, row.truncated].some(value => value !== null)) fail();
    }
    if (data.admitted_trials !== admitted || !Array.isArray(data.observed_performance_nondominated) ||
        data.observed_performance_nondominated.some(id => !data.rows.some(row => row.id === id && row.timing_eligible))) fail();
    let refs = 0;
    for (const source of data.sources) {
      if (!hash(source.sha256) || !Array.isArray(source.trial_ids) || source.trial_ids.some(id => !ids.has(id))) fail();
      refs += source.trial_ids.length;
    }
    if (refs !== data.source_row_references) fail();
    return data;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {validate};
  if (typeof document === 'undefined') return;
  const root = document.getElementById('optimization-exploration');
  if (!root) return;
  const t = (zh, en) => window.vllmHustSite.getCurrentLang() === 'zh' ? zh : en;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  let data, provenance, manifest;
  let images = [];
  const number = (row, key, divisor = 1) => row.timing_eligible ? (row[key] / divisor).toFixed(3) : t('未接纳', 'Not admitted');
  const table = (heads, rows) => `<div class="focus-table" tabindex="0" role="region" aria-label="${esc(t('全部探索试验', 'All exploratory trials'))}"><table><thead><tr>${heads.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map((cell, i) => `<${i ? 'td' : 'th scope="row"'}>${esc(cell)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  function render() {
    if (!data) return;
    const source = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${manifest.commit}/reports/performance-exploration-20261115-r1/README.md`;
    const rows = data.rows.map((row, i) => [i + 1, row.id, row.state,
      number(row, 'output_tokens_per_second'), number(row, 'mean_tpot_ms'), number(row, 'mean_ttft_ms', 1000),
      row.timing_eligible ? `${row.correct}/${row.planned}` : t('未测', 'Unmeasured'),
      row.timing_eligible ? row.truncated : t('未测', 'Unmeasured'),
      row.timing_eligible ? row.unparsed : t('未测', 'Unmeasured')]);
    root.innerHTML = `<section class="five-dataset-panel">
      <h2>${t('后续优化探索 · Tradeoff', 'Subsequent optimization exploration · Tradeoff')}</h2>
      <p>${esc(provenance.report_date)} · ${esc(data.scope.model)} · ${esc(data.scope.hardware)} · ${esc(t('固定MMLU200', 'Fixed MMLU200'))}</p>
      <p class="focus-note">${t('B1内部配置扫描 · 参照配置：原ND E09 · Tradeoff MOD默认关闭。', 'Internal B1 configuration sweep · Reference: original ND E09 · Tradeoff MOD off by default.')}</p>
      <p>${esc(t(`收录${data.physical_trials}次不同试验，其中${data.admitted_trials}次接纳计时、${data.physical_trials - data.admitted_trials}次未接纳；${data.source_row_references}处来源引用按同一实测去重。全部重复均列入记录。`, `${data.physical_trials} distinct trials: ${data.admitted_trials} timing-admitted and ${data.physical_trials - data.admitted_trials} not admitted. ${data.source_row_references} source references are deduplicated by physical trial; all actual repetitions are included.`))}</p>
      <figure><img src="${images[0]}" alt="${esc(t('吞吐对TPOT、TTFT、正确率与截断数的历史观测散点图', 'Historical throughput tradeoffs against TPOT, TTFT, correctness and truncation'))}" style="display:block;max-width:100%;height:auto"><figcaption>${t('菱形：吞吐、平均TPOT与平均TTFT的观测非支配点；其余图展示质量与截断计数。', 'Diamonds: observed nondominated throughput/mean TPOT/mean TTFT points. Other panels show quality and truncation counts.')}</figcaption></figure>
      <details><summary>${t('全部实测、失败与质量计数', 'All trials, failures and task counts')}</summary>
      ${table(t(['编号', '原始试验ID', '状态', 'token/s', 'TPOT ms', 'TTFT s', '正确/计划分母', '截断', '无法解析'], ['Point', 'Original trial ID', 'State', 'token/s', 'TPOT ms', 'TTFT s', 'Correct/planned', 'Truncated', 'Unparsed']), rows)}
      <p>${t('失败原因见来源报告；固定200题在各配置中配对复用。', 'Failure reasons are recorded in the source report; the fixed200 questions are paired across configurations.')}</p>
      <img src="${images[1]}" alt="${esc(t('完整试验表', 'Complete trial ledger'))}" style="display:block;max-width:100%;height:auto"></details>
      <p>${t('TTFT含批次排队。推理时段、启动预热与评分开销分别记录。', 'TTFT includes burst queueing. Inference, startup/warmup and grading costs are recorded separately.')}</p>
      <p><a href="${esc(source)}">${t('公开报告与来源', 'Public report and provenance')}</a> · <a href="./${directory}all-trials.csv">${t('下载完整CSV', 'Download full CSV')}</a> · <a href="./${directory}provenance.json">${t('SHA256与来源清单', 'SHA256 and source manifest')}</a> · <a href="${esc(provenance.source_archive.url)}">${t('下载Tradeoff MOD离线源包', 'Download offline Tradeoff MOD')}</a></p>
      <p>${t('', '')} ${t('发布源提交', 'Published source commit')}: ${esc(manifest.commit.slice(0, 12))}</p>
    </section>`;
    root.dataset.loaded = 'optimization-exploration-20261115-v1';
    root.setAttribute('aria-busy', 'false');
  }
  async function load() {
    const response = await fetch('./data/benchmark-source-manifest.json', {cache:'no-cache'});
    if (!response.ok) throw Error('Unavailable publication manifest');
    const m = await response.json();
    if (m.repository !== 'vLLM-HUST/vllm-hust-benchmark' || m.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(m.commit) || !Array.isArray(m.files)) throw Error('Invalid publication identity');
    async function verified(name) {
      const path = directory + name;
      const entries = m.files.filter(entry => entry.website_path === path);
      if (entries.length !== 1 || !hash(entries[0].sha256)) throw Error('Unpublished or ambiguous exploration asset');
      const result = await fetch('./' + path, {cache:'no-cache'});
      if (!result.ok) throw Error('Unavailable exploration asset');
      const bytes = await result.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
      if (digest !== entries[0].sha256 || bytes.byteLength !== entries[0].bytes) throw Error('Exploration asset checksum mismatch');
      return bytes;
    }
    const assets = await Promise.all(names.map(verified));
    const decoder = new TextDecoder();
    const value = validate(JSON.parse(decoder.decode(assets[0])));
    const p = JSON.parse(decoder.decode(assets[4]));
    if (p.schema !== 'optimization-exploration-provenance/v1' || p.source_repository !== 'vLLM-HUST/vllm-hust-engine' ||
        p.catalog_sha256 !== value.catalog_sha256 || !/^\d{4}-\d{2}-\d{2}$/.test(p.report_date) ||
        p.quality_qualified !== false || p.stability_qualified !== false || p.formal_acceptance !== false || p.candidate_promoted !== false ||
        !hash(p.source_archive?.sha256) || p.source_archive.redownload_verified !== true ||
        !/^https:\/\/github\.com\/vLLM-HUST\/vllm-hust-engine\/releases\/download\/performance-exploration-20261115-r1\/tradeoff-tuning-mod-v[\d.]+\.zip$/.test(p.source_archive.url)) throw Error('Invalid exploration provenance');
    images = [assets[1], assets[2]].map(bytes => URL.createObjectURL(new Blob([bytes], {type:'image/svg+xml'})));
    data = value; provenance = p; manifest = m; render();
  }
  window.addEventListener('vllm-hust:langchange', render);
  window.addEventListener('pagehide', () => images.forEach(url => URL.revokeObjectURL(url)), {once:true});
  load().catch(error => {
    console.error('Exploration publication rejected', error);
    root.dataset.error = 'publication-rejected';
    root.setAttribute('aria-busy', 'false');
    root.textContent = t('优化探索数据加载或校验失败，请查看benchmark发布源；正式B0/B1报告不受此面板影响。', 'Exploration data unavailable or verification failed; check the benchmark publication. The formal B0/B1 report is separate.');
  });
})();
