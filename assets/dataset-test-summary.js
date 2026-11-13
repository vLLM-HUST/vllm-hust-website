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
      title: '测试数据集', lead: '先选测试范围，再按执行指南完成 B0/B1 配对与结果核对。', guideTitle: '第一次做标准测试？从这里开始', guideLead: '准备条件、可复制命令、结果核对，按四步完成。', copy: '复制命令', copied: '已复制', copyFailed: '请选中命令手动复制', timingHint: '时间为参考配置的排期估算，安装、下载和失败重跑另计。首次运行前请先检查执行指南的环境要求。', scope: '测试范围', dataset: '数据集', tasks: '固定任务',
      requests: '每臂请求', purpose: '用途', protocol: '查看测试执行指南 →',
      notes: '运行说明', upstream: '原始数据集与工具', loading: '加载中…',
      error: '测试标准加载失败，请稍后重试。', quality: '质量与性能',
      trace: '轨迹回放性能', guide: '运行指南', source: '标准来源',
    },
    en: {
      title: 'Test datasets', lead: 'Choose a scope, then follow the guide to run B0/B1 and review the results.', guideTitle: 'Running a standard test for the first time?', guideLead: 'Prerequisites, commands and result checks in four steps.', copy: 'Copy command', copied: 'Copied', copyFailed: 'Select the command and copy manually', timingHint: 'Planning estimates for the reference configuration; installation, downloads and failed-run repeats are extra. Check the execution guide before your first run.', scope: 'Test scope', dataset: 'Dataset', tasks: 'Fixed tasks',
      requests: 'Requests per arm', purpose: 'Purpose', protocol: 'Open the execution guide →',
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
    document.getElementById('entry-lead').textContent = labels.lead;
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
      card.append(command);
      const copyButton = node('button', labels.copy); copyButton.type = 'button'; copyButton.className = 'entry-copy-command';
      const feedback = node('span'); feedback.className = 'entry-copy-feedback'; feedback.setAttribute('role', 'status');
      copyButton.setAttribute('aria-label', `${labels.copy} · ${field(mode, 'title')}`);
      copyButton.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(command.textContent); feedback.textContent = labels.copied; }
        catch {
          const range = document.createRange(); range.selectNodeContents(command);
          const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
          feedback.textContent = labels.copyFailed;
        }
      });
      card.append(copyButton, feedback); cards.append(card);
    }

    document.getElementById('entry-timing-note').textContent = labels.timingHint;

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
