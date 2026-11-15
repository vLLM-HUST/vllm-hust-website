/* Read the same sealed publication as the B0/B1 comparison; never infer a pass. */
(function () {
  'use strict';
  const root = document.getElementById('dataset-current-results');
  if (!root) return;
  const path = 'data/five-datasets-r6-20261114/summary-public-v2.json';
  const zh = () => (window.vllmHustSite?.getCurrentLang() || 'zh') === 'zh';
  const t = (a, b) => zh() ? a : b;
  const node = (tag, text) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  let data, manifest, error;
  function render() {
    root.replaceChildren(node('h2', t('当前参考 Engine 测试状态', 'Current reference Engine test status')));
    if (!data) {
      root.append(node('p', error
        ? t('结果加载或校验失败，请查看 B0/B1 页与固定发布源。', 'Result verification failed. See the B0/B1 page and pinned publication source.')
        : t('正在校验当前结果…', 'Verifying current results…')));
      return;
    }
    root.append(node('p', `${data.report_date} · ${data.run_id} · ${data.runtime.engine_release}`));
    root.append(node('p', t('正式引擎对比：B0 为原版 0.18，B1 为冻结 r6；与同一基础引擎关闭 / 启用 MOD 的对比定义分别记录。', 'Formal engine comparison: original 0.18 B0 versus frozen r6 B1. Record this separately from a same-base MOD off/on comparison.')));
    const counts = ['B0', 'B1'].map(role => {
      const total = key => data.datasets.reduce((sum, row) => sum + row.arms[role][key], 0);
      return `${role}: ${total('successful')}/${total('planned')} ${t('请求成功', 'requests successful')}, ${total('failed')} ${t('失败', 'failed')}, ${total('unreturned')} ${t('未返回', 'unreturned')}`;
    });
    root.append(node('p', counts.join('；')));
    root.append(node('p', t('五项执行完成。点击查看四项目标状态与完整图表。', 'Five-profile execution complete. View all four target statuses and charts below.')));
    const list = node('ul');
    for (const id of ['3.4.1', '3.4.2', '3.4.3', '3.4.4']) {
      const goal = window.vllmHustProjectMilestones.select(data,id);
      const final = data.project_final_assessment.targets[id];
      const title = t(goal.name, ({'3.4.1':'Effective compute','3.4.2':'Throughput and latency','3.4.3':'Context stability','3.4.4':'Cost and utilization'})[id]);
      const item = node('li');
      item.append(node('strong', `${id} ${title}`));
      item.append(node('p', `${t('项目里程碑', 'Project milestone')}: ${goal.accepted ? t('达成目标','Target met') : t('未达成目标','Target not met')}`));
      if (id === '3.4.1') item.append(node('p', t('已认证工况：原固定MMLU200/out256；当前版本效率另行复测。', 'Certified scope: original fixed MMLU200/out256; current-version efficiency is measured separately.')));
      item.append(node('p', `${t('项目最终目标', 'Project-final target')}: ${t(final.requirement, final.requirement_en)} — ${final.attainment === 'demonstrated' ? t('达成目标','Target met') : t('未达成目标','Target not met')}`));

      list.append(item);
    }
    const details = node('details');
    details.append(node('summary', t('查看四项目标的证据状态', 'View evidence for all four targets')), list);
    root.append(details);
    const link = node('a', t('查看完整 B0/B1 结果与图表 →', 'View complete B0/B1 results and charts →'));
    link.href = './b0-b1.html';
    const source = node('a', t('固定结果来源 ↗', 'Pinned result source ↗'));
    source.href = `https://github.com/${manifest.repository}/blob/${manifest.commit}/website-publication/${path}`;
    root.append(link, node('span', ' · '), source);
    root.dataset.loaded = data.run_id;
  }
  window.addEventListener('vllm-hust:langchange', render);
  render();
  (async () => {
    const response = await fetch('./data/benchmark-source-manifest.json', {cache:'no-store'});
    if (!response.ok) throw Error('Manifest unavailable');
    const m = await response.json();
    if (m.repository !== 'vLLM-HUST/vllm-hust-benchmark' || m.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(m.commit)) throw Error('Invalid source');
    const entries = m.files.filter(item => item.website_path === path);
    if (entries.length !== 1) throw Error('Ambiguous source');
    const result = await fetch('./' + path, {cache:'no-store'});
    if (!result.ok) throw Error('Result unavailable');
    const raw = await result.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== entries[0].sha256 || raw.byteLength !== entries[0].bytes) throw Error('Result checksum mismatch');
    const value = JSON.parse(new TextDecoder().decode(raw));
    const ids = ['mmlu','hle','frontier','swe','terminal'];
    const counts = [200,200,160,64,48];
    if (value.schema !== 'sealed-five-dataset-comparison/v1' || value.execution_complete !== true || value.datasets?.length !== 5) throw Error('Incomplete report');
    value.datasets.forEach((row, i) => {
      if (row.id !== ids[i]) throw Error('Unexpected profile');
      for (const role of ['B0','B1']) {
        const a = row.arms?.[role];
        if (!a || a.planned !== counts[i] || a.recorded !== counts[i] || a.successful + a.failed + a.unreturned !== a.planned || a.successful !== a.planned) throw Error('Incomplete population');
      }
    });
    for (const id of ['3.4.1','3.4.2','3.4.3','3.4.4']) {
      if (typeof value.formal_targets?.[id]?.accepted !== 'boolean' || !value.project_final_assessment?.targets?.[id]?.requirement) throw Error('Missing assessment');
    }
    window.vllmHustProjectMilestones.validate(value);
    data = value; manifest = m; render();
  })().catch(e => { error = e; root.dataset.error = 'publication-rejected'; render(); });
}());
