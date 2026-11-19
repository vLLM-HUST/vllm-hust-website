(() => {
  'use strict';

  const region = document.getElementById('instance-scaling-results');
  const output = document.getElementById('instance-scaling-measurements');
  if (!region || !output) return;

  const path = 'data/instance-controller-scaling-v1.json';
  const repository = 'vLLM-HUST/vllm-hust-benchmark';

  function append(parent, tag, zh, en) {
    const element = document.createElement(tag);
    if (en === undefined) {
      element.textContent = zh;
    } else {
      for (const [language, value] of [['zh', zh], ['en', en]]) {
        const span = document.createElement('span');
        span.className = 'lang-' + language;
        span.textContent = value;
        element.append(span);
      }
    }
    parent.append(element);
    return element;
  }

  async function fetchData(pathname) {
    const response = await fetch('./' + pathname, {cache: 'no-cache'});
    if (!response.ok) throw Error('Missing Instance Controller publication data');
    return response;
  }

  async function load() {
    const manifest = await (await fetchData('data/benchmark-source-manifest.json')).json();
    if (manifest.repository !== repository || manifest.status !== 'published-source' ||
        !/^[a-f0-9]{40}$/.test(manifest.commit) || !Array.isArray(manifest.files)) {
      throw Error('Unpublished benchmark source');
    }
    const entries = manifest.files.filter(entry => entry.website_path === path);
    const raw = await (await fetchData(path)).arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', raw);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (entries.length !== 1 || raw.byteLength !== entries[0].bytes || hash !== entries[0].sha256) {
      throw Error('Instance Controller checksum mismatch');
    }

    const data = JSON.parse(new TextDecoder().decode(raw));
    if (data.schema !== 'instance-controller-scaling/v1' ||
        data.execution_mode !== 'default CUDA Graph' ||
        !/^reports\/[a-z0-9-]+\/README\.md$/.test(data.report_path) ||
        data.scenarios?.length !== 2 ||
        !data.scenarios.every((scenario, index) =>
          scenario.peaks === index + 1 && Number.isInteger(scenario.completed_per_arm) &&
          scenario.completed_per_arm > 0 && scenario.fixed.replicas === 2 &&
          scenario.dynamic.min_replicas === 1 && scenario.dynamic.max_replicas === index + 3 &&
          [scenario.fixed, scenario.dynamic].every(arm =>
            ['p95_latency_seconds', 'mean_reserved_replicas'].every(key =>
              Number.isFinite(arm[key]) && arm[key] > 0)))) {
      throw Error('Unexpected Instance Controller schema');
    }

    const wrapper = append(output, 'div', '');
    wrapper.className = 'control-table-wrap';
    wrapper.tabIndex = 0;
    const table = append(wrapper, 'table', '');
    table.className = 'control-table';
    append(table, 'caption', '固定副本与动态扩缩容真机对照', 'Hardware comparison of fixed and dynamic replicas');
    const heading = table.createTHead().insertRow();
    for (const labels of [
      ['负载', 'Load'], ['副本设置', 'Replica settings'], ['每组完成请求', 'Completed per arm'],
      ['全量 P95 延迟（秒）', 'Overall P95 latency (s)'],
      ['窗口内平均预约副本数', 'Mean reserved replicas in window']
    ]) append(heading, 'th', ...labels).scope = 'col';
    const body = table.createTBody();
    for (const scenario of data.scenarios) {
      const row = body.insertRow();
      append(row, 'th', ...(scenario.peaks === 1 ? ['单峰', 'Single peak'] : ['双峰', 'Two peaks'])).scope = 'row';
      const {fixed, dynamic} = scenario;
      append(row, 'td', `2 → 1–${dynamic.max_replicas}`);
      append(row, 'td', scenario.completed_per_arm.toLocaleString('en-US'));
      append(row, 'td', `${fixed.p95_latency_seconds.toFixed(2)} → ${dynamic.p95_latency_seconds.toFixed(2)}`);
      append(row, 'td', `${fixed.mean_reserved_replicas.toFixed(3)} → ${dynamic.mean_reserved_replicas.toFixed(3)}`);
    }

    append(output, 'p', `RIDE ${data.ride_version} · ${data.model} · ${data.hardware} · CUDA Graph`);
    append(output, 'p',
      '表内按固定组 → 动态组显示。模型预约包含加载时间，两组的工作区均预留四张卡。',
      'Values show fixed → dynamic. Replica reservations include model loading. Both workspaces reserved four cards.');
    const report = append(output, 'a', '实验报告与预算核算 ↗', 'Experiment report and resource accounting ↗');
    report.href = `https://github.com/${repository}/blob/${manifest.commit}/${data.report_path}`;
    region.dataset.loaded = data.schema;
  }

  load().catch(() => {
    output.replaceChildren();
    append(output, 'p', '暂时无法校验实测数据。', 'Benchmark data could not be verified.');
  }).finally(() => region.setAttribute('aria-busy', 'false'));
})();
