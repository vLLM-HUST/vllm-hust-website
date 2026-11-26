/* Show the reviewed default release without borrowing historical results. */
(function () {
  'use strict';
  const root = document.getElementById('dataset-current-results');
  if (!root) return;
  const path = 'data/engine-release-history-v1.json';
  const targets = ['4.1', '4.2', '4.3', '4.4'];
  const profiles = {mmlu: 200, hle: 200, frontier: 160, swe: 64, terminal: 48};
  const zh = () => (window.vllmHustSite?.getCurrentLang() || 'zh') === 'zh';
  const t = (a, b) => zh() ? a : b;
  const node = (tag, text) => {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
  };
  const link = (text, href) => {
    const el = node('a', text);
    el.href = href;
    return el;
  };

  let current, error;
  function render() {
    const showDecisions = root.querySelector('details')?.open === true;
    const title = t('正式引擎验收', 'Official Engine acceptance');
    root.replaceChildren(node('h2', current ? `${title} · ${current.entry.id.toUpperCase()}` : title));
    if (!current) {
      root.append(node('p', error
        ? t('正式结果加载或校验失败。', 'The official result could not be loaded or verified.')
        : t('正在校验正式结果…', 'Verifying the official result…')));
      if (error) root.append(link(t('查看正式 B0/B1 对比 →', 'View the official B0/B1 comparison →'), './b0-b1.html'));
      return;
    }

    const {entry, acceptance, fixed} = current;
    const comparison = link(t('查看验收与图表 →', 'View acceptance and charts →'), `./b0-b1.html?release=${entry.id}`);
    if (acceptance) {
      const full = acceptance.models.find(model => model.scope === 'full-acceptance');
      const compatible = acceptance.models.filter(model => model.scope === 'compatibility-verified').map(model => model.name).join(' / ');
      const verdict = targets.every(id => acceptance.targets[id].final.met)
        ? t('4.1–4.4 全部达标', 'All 4.1–4.4 final targets met')
        : t('4.1–4.4 逐项判定见下方', 'See the individual 4.1–4.4 decisions below');
      root.append(node('p', [full.name, acceptance.scheduler_profile, verdict].join(' · ')));
      if (compatible) root.append(node('p', `${compatible} · ${t('已验证兼容入口', 'Compatibility entry points verified')}`));
      const planned = Object.values(profiles).reduce((sum, count) => sum + count, 0);
      const counts = ['B0', 'B1'].map((role, i) => {
        const successful = fixed.reduce((sum, row) => sum + row.arms[i].requests - row.arms[i].failed, 0);
        return `${role}: ${successful}/${planned} ${t('请求成功', 'requests successful')}`;
      });
      root.append(node('p', counts.join(' · ')));
      const details = node('details', '');
      details.open = showDecisions;
      const list = node('ul', '');
      for (const id of targets) {
        const status = acceptance.targets[id].final.met ? t('达成目标', 'Target met') : t('未达成目标', 'Target not met');
        list.append(node('li', `${id} · ${status}`));
      }
      details.append(node('summary', t('查看四项结题判定', 'View the four final decisions')), list);
      root.append(details);
    } else {
      root.append(node('p', t('本版的四项正式判定见 B0/B1 对比页。', 'See the B0/B1 comparison for this release’s formal decisions.')));
    }
    const links = node('p', '');
    links.append(comparison);
    if (acceptance) links.append(document.createTextNode(' · '), link(t('完整验收报告 ↗', 'Full acceptance report ↗'), acceptance.report_url));
    links.append(document.createTextNode(' · '), link(t('历史版本', 'Historical versions'), './report-history.html'));
    root.append(links);
    root.dataset.loaded = entry.id;
  }

  function readCurrent(catalog) {
    const id = catalog.default_release;
    if (catalog.schema !== 'vllm-hust-engine-release-history/v1' || !/^r[1-9][0-9]*$/.test(id) ||
        !catalog.order?.includes(id)) throw Error('Invalid release catalog');
    const entries = catalog.entries.filter(entry => entry.id === id);
    const [entry] = entries;
    if (entries.length !== 1 || entry.publication_status === 'frozen-candidate' ||
        !entry.release.endsWith('-' + id) || entry.baseline_id !== catalog.baseline?.id) throw Error('Invalid current release');
    const acceptance = entry.full_acceptance;
    if (!acceptance) return {entry};

    const fixed = entry.measurements.filter(row => Object.hasOwn(profiles, row.id));
    if (fixed.length !== Object.keys(profiles).length || new Set(fixed.map(row => row.id)).size !== fixed.length ||
        fixed.some(row => row.arms?.length !== 2 || row.arms.some((arm, i) =>
          arm.role !== (i === 0 ? 'B0' : entry.id) || arm.requests !== profiles[row.id] ||
          !Number.isInteger(arm.failed) || arm.failed < 0 || arm.failed > arm.requests))) {
      throw Error('Invalid release request counts');
    }
    if (acceptance.models?.filter(model => model.scope === 'full-acceptance' && model.name).length !== 1 ||
        !acceptance.scheduler_profile ||
        !/^https:\/\/github\.com\/vLLM-HUST\/vllm-hust-benchmark\/blob\/[a-f0-9]{40}\/reports\//.test(acceptance.report_url) ||
        !targets.every(id => typeof acceptance.targets?.[id]?.final?.met === 'boolean')) {
      throw Error('Invalid release acceptance');
    }
    return {entry, acceptance, fixed};
  }

  window.addEventListener('vllm-hust:langchange', render);
  render();
  (async () => {
    const response = await fetch('./data/benchmark-source-manifest.json', {cache: 'no-store'});
    if (!response.ok) throw Error('Manifest unavailable');
    const manifest = await response.json();
    if (manifest.repository !== 'vLLM-HUST/vllm-hust-benchmark' || manifest.status !== 'published-source' ||
        !/^[a-f0-9]{40}$/.test(manifest.commit)) throw Error('Invalid source');
    const entries = manifest.files.filter(item => item.website_path === path);
    if (entries.length !== 1) throw Error('Ambiguous source');
    const result = await fetch('./' + path, {cache: 'no-store'});
    if (!result.ok) throw Error('Release catalog unavailable');
    const raw = await result.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== entries[0].sha256 || raw.byteLength !== entries[0].bytes) throw Error('Release catalog checksum mismatch');
    current = readCurrent(JSON.parse(new TextDecoder().decode(raw)));
    render();
  })().catch(e => { error = e; root.dataset.error = 'publication-rejected'; render(); });
}());
