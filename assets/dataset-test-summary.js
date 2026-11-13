(function () {
  'use strict';
  let payload;
  let failure;
  const language = () => window.vllmHustSite?.getCurrentLang()
    || localStorage.getItem('vllm-hust_lang')
    || ((navigator.language || '').startsWith('zh') ? 'zh' : 'en');
  const node = (tag, value) => {
    const element = document.createElement(tag);
    if (value !== undefined) element.textContent = value;
    return element;
  };
  const copy = {
    zh: {
      title: '测试数据集', scope: '测试范围', dataset: '数据集', tasks: '固定任务',
      requests: '每臂请求', purpose: '用途', protocol: '完整测试标准',
      notes: '运行说明', upstream: '原始数据集与工具', loading: '加载中…',
      error: '测试标准加载失败，请稍后重试。', quality: '质量与性能',
      trace: '轨迹回放性能', guide: '运行指南', source: '标准来源',
    },
    en: {
      title: 'Test datasets', scope: 'Test scope', dataset: 'Dataset', tasks: 'Fixed tasks',
      requests: 'Requests per arm', purpose: 'Purpose', protocol: 'Full test standard',
      notes: 'Run details', upstream: 'Original datasets and tools', loading: 'Loading…',
      error: 'Unable to load the test standard. Please try again.', quality: 'Quality and performance',
      trace: 'Trace inference', guide: 'Run guide', source: 'Standard source',
    },
  };

  function render() {
    const lang = language() === 'zh' ? 'zh' : 'en';
    const labels = copy[lang];
    const value = item => item[`${lang}`];
    const field = (item, name) => item[`${name}_${lang}`];
    document.getElementById('entry-title').textContent = labels.title;
    document.title = `${labels.title} · vLLM-HUST`;
    document.querySelectorAll('[data-summary-copy]').forEach(element => {
      element.textContent = labels[element.dataset.summaryCopy];
    });
    document.getElementById('test-modes').setAttribute('aria-label', labels.title);
    const status = document.getElementById('standard-status');
    status.hidden = Boolean(payload) && !failure;
    status.textContent = failure ? labels.error : labels.loading;
    if (failure || !payload) return;

    const {data, guide, source, entry, digest, guideSource, guideEntry} = payload;
    const cards = document.getElementById('test-mode-cards');
    cards.replaceChildren();
    for (const mode of guide.modes) {
      const card = node('article');
      card.className = 'test-mode'; card.id = `test-mode-${mode.id}`;
      card.append(node('h2', field(mode, 'title')));
      const duration = node('p', value({zh: `预计 ${mode.hours[0]}–${mode.hours[1]} 小时`, en: `About ${mode.hours[0]}–${mode.hours[1]} hours`}));
      duration.className = 'duration'; card.append(duration);
      const datasets = mode.datasets.map(id => data.datasets.find(dataset => dataset.id === id));
      const scope = mode.id === 'quick'
        ? value({zh: `${datasets[0].name} · ${datasets[0].tasks} 题`, en: `${datasets[0].name} · ${datasets[0].tasks} questions`})
        : value({zh: `${datasets.length} 项固定数据集`, en: `${datasets.length} frozen datasets`});
      card.append(node('p', scope));
      const command = node('pre');
      command.append(node('code', guide.execution.command_template.replace('{datasets}', mode.datasets_flag)));
      card.append(command); cards.append(card);
    }

    const rows = document.getElementById('standard-rows'); rows.replaceChildren();
    for (const dataset of data.datasets) {
      const row = node('tr');
      const purpose = dataset.mode === 'inference_only' ? labels.trace : labels.quality;
      for (const cell of [dataset.name.replace(/ public traces$/, ''), dataset.tasks, dataset.requests_per_arm, purpose]) {
        row.append(node('td', String(cell)));
      }
      rows.append(row);
    }

    const notes = document.getElementById('test-mode-notes'); notes.replaceChildren();
    for (const detail of [field(guide.timing, 'reference'), field(guide.timing, 'includes'), field(guide.timing, 'excludes'), field(guide.execution, 'note')]) {
      notes.append(node('p', detail));
    }
    const guideLink = node('a', labels.guide);
    guideLink.href = `https://github.com/${guideSource.repository}/blob/${guideSource.commit}/${guideEntry.benchmark_path}`;
    document.getElementById('test-mode-provenance').replaceChildren(guideLink);
    document.getElementById('standard-title').textContent = data.standard_id;
    const original = node('a', labels.source);
    original.href = `https://github.com/${source.repository}/blob/${source.commit}/${entry.benchmark_path}`;
    document.getElementById('standard-provenance').replaceChildren(original, node('small', `SHA256 ${digest}`));
    document.getElementById('standard-content').hidden = false;
  }

  window.vllmHustTestSummary = {
    render(data) { payload = data; failure = undefined; render(); },
    fail(error) {
      failure = error;
      const status = document.getElementById('standard-status');
      status.setAttribute('role', 'alert'); status.dataset.error = error.message;
      render();
    },
  };
  window.addEventListener('vllm-hust:langchange', render);
  render();
}());
