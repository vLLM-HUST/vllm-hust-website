(() => {
  'use strict';
  const root = document.getElementById('report-history');
  const links = document.getElementById('report-history-links');
  const path = 'data/report-history-v1.json';
  const t = (zh, en) => window.vllmHustSite.getCurrentLang() === 'zh' ? zh : en;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  let catalog;

  // Preserve bookmarks to the old detailed report after moving it to the archive.
  if (!root && document.getElementById('five-dataset-comparison') &&
      /^#(?:method-[1-4]|method-b0|metric-[1-4]|current-qualified-compute|b0-baseline|acceptance-stages|comparison)$/.test(location.hash)) {
    location.replace('./b0-b1-legacy.html' + location.hash);
    return;
  }

  function render() {
    if (links) links.innerHTML = `<a href="./report-history.html">${t('历史报告（按日期）', 'Report archive by date')}</a> · <a href="./b0-b1.html">${t('最新一轮结果', 'Latest comparison')}</a>`;
    if (!root) return;
    document.getElementById('history-title').textContent = t('历史报告', 'Report archive');
    document.getElementById('history-lead').textContent = t(
      '按北京时间日期倒序排列。测试日期、报告日期、归档标识和来源修订日期分别标记；修订不是新增推理。旧结论和原始证据保留，当前页只展示最新一轮。',
      'Newest first, in Asia/Shanghai. Experiment, report, archive-label and source-revision dates are labeled separately; a revision is not new inference. Original conclusions and evidence remain available; the comparison page shows the latest round.');
    if (!catalog) return;
    const dates = [...new Set(catalog.entries.map(r => r.date))];
    root.innerHTML = `<nav class="report-date-index" aria-label="${t('归档日期', 'Archive dates')}">${dates.map(day => `<a href="#date-${day}">${day}</a>`).join(' · ')}</nav>` + dates.map(day => {
      const rows = catalog.entries.filter(r => r.date === day);
      return `<section class="five-dataset-panel report-date-group" id="date-${day}"><h2><time datetime="${day}">${day}</time></h2>${rows.map(r => {
        const label = r.status === 'current' ? t('最新一轮', 'Latest round') : t('历史归档', 'Archived');
        const kind = {experiment_date:t('测试日期', 'Experiment date'), report_date:t('报告日期', 'Report date'), source_revision_date:t('来源修订日期', 'Source revision date'), archive_label_date:t('归档标识日期', 'Archive label date')}[r.date_kind];
        return `<article class="report-history-entry" data-report-id="${escape(r.id)}" data-status="${r.status}"><h3>${escape(t(r.title_zh, r.title_en))}</h3><p class="focus-status">${label} · ${kind} · ${day}</p><p>${escape(t(r.scope_zh, r.scope_en))}</p><p><a href="${escape(r.report_url)}">${t('原版报告', 'Original report')}</a>${r.website_view ? ` · <a href="./${escape(r.website_view)}">${t('网页查看', 'Website view')}</a>` : ''}${r.artifact_path ? ` · <a href="./${escape(r.artifact_path)}">${t('该版数据', 'Versioned data')}</a>` : ''}</p><details><summary>${t('来源身份', 'Source identity')}</summary><p>commit: <code>${r.source_commit}</code><br>report SHA256: <code>${r.report_sha256}</code></p></details></article>`;
      }).join('')}</section>`;
    }).join('');
    root.dataset.loaded = catalog.schema;
    root.setAttribute('aria-busy', 'false');
  }

  async function load() {
    const m = await fetch('./data/benchmark-source-manifest.json', {cache:'no-cache'});
    if (!m.ok) throw Error('Missing source manifest');
    const manifest = await m.json();
    if (manifest.repository !== 'vLLM-HUST/vllm-hust-benchmark' || manifest.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(manifest.commit)) throw Error('Invalid source identity');
    const entries = manifest.files.filter(f => f.website_path === path);
    if (entries.length !== 1) throw Error('Ambiguous archive source');
    const response = await fetch('./' + path, {cache:'no-cache'});
    if (!response.ok) throw Error('Missing archive source');
    const raw = await response.arrayBuffer();
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), b => b.toString(16).padStart(2, '0')).join('');
    if (sha !== entries[0].sha256 || raw.byteLength !== entries[0].bytes) throw Error('Archive checksum mismatch');
    const value = JSON.parse(new TextDecoder().decode(raw));
    if (value.schema !== 'benchmark-report-history/v1' || value.timezone !== 'Asia/Shanghai' || !Array.isArray(value.entries) || !value.entries.length) throw Error('Invalid archive');
    const ids = new Set();
    value.entries.forEach((r, i) => {
      if (ids.has(r.id) || !/^[a-z0-9-]+$/.test(r.id) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || (i && value.entries[i-1].date < r.date) ||
          !['archived', 'current'].includes(r.status) || !['experiment_date', 'report_date', 'source_revision_date', 'archive_label_date'].includes(r.date_kind) ||
          !/^[a-f0-9]{40}$/.test(r.source_commit) || !/^[a-f0-9]{64}$/.test(r.report_sha256) ||
          !r.report_url.startsWith(`https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${r.source_commit}/reports/`) ||
          !['title_zh','title_en','scope_zh','scope_en'].every(k => typeof r[k] === 'string' && r[k]) ||
          (r.artifact_path && (!/^data\/[a-zA-Z0-9_./-]+\.json$/.test(r.artifact_path) || r.artifact_path.includes('..') || !manifest.files.some(f => f.website_path === r.artifact_path))) ||
          (r.website_view && !/^(?:b0-b1|b0-b1-legacy)\.html(?:#[a-z0-9-]+)?$/.test(r.website_view))) throw Error('Invalid archive entry');
      ids.add(r.id);
    });
    const current = value.entries.filter(r => r.status === 'current');
    if (current.length !== 1 || current[0].id !== value.current_report_id || current[0].website_view !== 'b0-b1.html') throw Error('Ambiguous current report');
    catalog = value;
    render();
  }

  window.addEventListener('vllm-hust:langchange', render);
  render();
  if (root) load().catch(() => {
    root.dataset.error = 'publication-rejected';
    root.setAttribute('aria-busy', 'false');
    root.textContent = t('归档索引加载或校验失败，请查看 benchmark 发布源。', 'Archive unavailable or verification failed; check the benchmark publication source.');
  });
})();
