(() => {
  'use strict';

  const root = document.getElementById('kv-routing-results');
  const output = document.getElementById('kv-routing-measurements');
  const path = 'data/kv-controller-routing-v1.json';
  const bilingual = (zh, en) => {
    const text = document.createDocumentFragment();
    for (const [language, value] of [['zh', zh], ['en', en]]) {
      const span = document.createElement('span');
      span.className = 'lang-' + language;
      span.textContent = value;
      text.append(span);
    }
    return text;
  };

  function addText(parent, tag, content) {
    const element = document.createElement(tag);
    element.append(content);
    parent.append(element);
    return element;
  }

  async function read(path) {
    const response = await fetch('./' + path, {cache: 'no-cache'});
    if (!response.ok) throw Error('Missing KV routing publication data');
    return response;
  }

  async function load() {
    const publication = await (await read('data/benchmark-source-manifest.json')).json();
    if (publication.repository !== 'vLLM-HUST/vllm-hust-benchmark' ||
        publication.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(publication.commit)) {
      throw Error('Unpublished benchmark source');
    }
    const entries = publication.files.filter(entry => entry.website_path === path);
    if (entries.length !== 1) throw Error('Missing KV routing data identity');
    const bytes = await (await read(path)).arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (bytes.byteLength !== entries[0].bytes || hash !== entries[0].sha256) {
      throw Error('KV routing checksum mismatch');
    }

    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data.schema !== 'kv-controller-routing/v1' ||
        !/^reports\/[a-z0-9-]+\/README\.md$/.test(data.report_path)) {
      throw Error('Unexpected KV routing schema');
    }
    const table = document.createElement('table');
    table.className = 'control-table';
    addText(table, 'caption', bilingual('同输入、同缓存预算的整批回放', 'Full-batch replay with matched inputs and cache budgets'));
    const heading = table.createTHead().insertRow();
    for (const labels of [
      ['负载', 'Workload'], ['整批时间缩短（中位）', 'Median batch time reduction'],
      ['整批吞吐提升（中位）', 'Median batch throughput gain'], ['全体请求 P95 降幅', 'Overall request P95 reduction'],
      ['预设收益门槛', 'Replay gate']
    ]) addText(heading, 'th', bilingual(...labels)).scope = 'col';

    const tbody = table.createTBody();
    for (const group of data.groups) {
      const percent = value => value.toFixed(2) + '%';
      const row = tbody.insertRow();
      addText(row, 'th', data.workload + ' · ' + group.programs + ' programs').scope = 'row';
      row.insertCell().textContent = percent(group.batch_reduction_percent);
      row.insertCell().textContent = '+' + percent(group.throughput_increase_percent);
      row.insertCell().textContent = group.p95_reduction_range_percent.map(percent).join(' – ');
      row.insertCell().append(group.gate_passed
        ? bilingual('通过', 'Passed')
        : bilingual('整批中位未达 5%', 'Median batch reduction below 5%'));
    }

    addText(output, 'p', 'KV Controller ' + data.version + ' · ' + data.model + ' · ' + data.hardware);
    const wrapper = addText(output, 'div', table);
    wrapper.className = 'control-table-wrap';
    wrapper.tabIndex = 0;
    addText(output, 'p', bilingual(
      '每种负载三对。两组共用 vLLM 原生 CPU KV 卸载与按需回载，路由开销计入端到端耗时。正式限流层接入与线上验收待完成。',
      'Three pairs per workload. Both arms used native vLLM CPU KV offload and on-demand reload. End-to-end timings include routing overhead. Production request-controller integration and online acceptance are pending.'
    ));
    const report = addText(output, 'a', bilingual('逐对数据与验证范围 ↗', 'Per-pair data and scope ↗'));
    report.href = 'https://github.com/' + publication.repository + '/blob/' + publication.commit + '/' + data.report_path;
    root.dataset.loaded = data.version;
  }

  load().catch(() => {
    addText(output, 'p', bilingual('暂时无法校验实测数据。', 'Benchmark data could not be verified.'));
  }).finally(() => root.setAttribute('aria-busy', 'false'));
})();
