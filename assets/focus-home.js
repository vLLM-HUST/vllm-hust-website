(() => {
  function render() {
    const zh = window.vllmHustSite.getCurrentLang() === 'zh';
    const t = (cn, en) => zh ? cn : en;
    document.getElementById('focus-title').textContent = t('从指定数据集，到实测结果', 'From designated datasets to measured results');
    document.getElementById('focus-lead').textContent = t('先确认如何测，再查看 B0/B1 对比，最后估算服务产能与成本。', 'Start with the test protocol, review B0/B1 results, then estimate serving capacity and cost.');
    document.getElementById('focus-scope-title').textContent = t('统一测试范围', 'Shared test scope');
    document.getElementById('focus-scope').textContent = t('B0 固定为 vLLM 0.18 + vLLM-Ascend 0.18；B1 为各工况当前已实测最优的 vLLM-HUST 优化配置，逐项披露版本与资源。', 'B0 is vLLM 0.18 + vLLM-Ascend 0.18. B1 is the best measured vLLM-HUST configuration within each workload; versions and resources are disclosed per result.');
    document.getElementById('focus-stages').textContent = t('有效算力效率：中期里程碑门槛 50%，最终验收门槛 90%。当前结果按测量方法和适用范围分别判断。', 'Effective-compute efficiency: 50% for the midterm milestone, 90% for final acceptance. Assess each result within its measurement method and scope.');
    const root = document.getElementById('focus-paths'); root.replaceChildren();
    const items = [
      ['01', 'dataset-introductions.html', t('浦江指定数据集测试', 'Pujiang designated datasets'), t('五项数据集的来源、测试说明、客户端安装、执行入口与评分边界。', 'Sources, test instructions, client installation, execution entrypoints and scoring scope for the five datasets.')],
      ['02', 'b0-b1.html', t('B0/B1 大纲对比', 'B0/B1 results by test outline'), t('有效算力、吞吐与时延、稳定性、单位 token 成本；同时列出结果与未完成项。', 'Effective compute, throughput and latency, stability, and unit-token cost, including outstanding evidence.')],
      ['03', 'serving-plan.html', t('服务产能与成本', 'Serving capacity & cost'), t('从实测吞吐估算产能，输入实际成本与参考价格，查看假设下的账单。', 'Estimate capacity from measured throughput and inspect costs using your own expenses and price assumptions.')]
    ];
    for (const [n, href, title, copy] of items) {
      const card = document.createElement('article'); card.className = 'focus-card';
      const number = document.createElement('span'); number.textContent = n; number.className = 'focus-eyebrow';
      const h = document.createElement('h2'); h.textContent = title;
      const p = document.createElement('p'); p.textContent = copy;
      const a = document.createElement('a'); a.href = './' + href; a.textContent = t('查看 →', 'Explore →');
      card.append(number, h, p, a); root.append(card);
    }
  }
  window.addEventListener('vllm-hust:langchange', render); render();
})();
