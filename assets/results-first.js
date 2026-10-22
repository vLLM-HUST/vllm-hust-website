(() => {
    'use strict';
    const main = document.querySelector('main');
    if (!main) return;
    const disclosures = [];
    function fold(selector, id, zh, en) {
        const nodes = [...main.querySelectorAll(selector)];
        if (!nodes.length) return;
        const details = document.createElement('details');
        details.id = id;
        details.className = 'result-disclosure';
        const summary = document.createElement('summary');
        details.append(summary);
        nodes[0].before(details);
        nodes.forEach(node => details.append(node));
        disclosures.push({ summary, zh, en });
        return details;
    }
    const report = fold('#midterm-report', 'report-details',
        '中期报告 · 质量、长上下文、资源成本与 M01 详细证据',
        'Midterm report · quality, long context, resource costs & M01 evidence');
    if (report) main.append(report);
    fold('.page-hero, .dataset-program-section, #hle-verified-handoff, #frontierscience-handoff, #mmlu-pro-handoff',
        'dataset-background', '数据集范围与单项测试档案', 'Dataset scope & individual measurement archives');
    fold('.dataset-validation-section', 'supplementary-results',
        '更多工况 · 配对矩阵与候选配置', 'More workloads · paired matrix & candidate configurations');
    fold('#frontier-agent-qualifications', 'agent-results-details',
        'Agent 数据集 · 评分与原始证据', 'Agent datasets · scores & original evidence');
    function translate() {
        const zh = window.vllmHustSite?.getCurrentLang() === 'zh';
        disclosures.forEach(item => { item.summary.textContent = zh ? item.zh : item.en; });
    }
    let revealed;
    function reveal() {
        let target;
        try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
        if (!target || target === revealed) return;
        let parent = target.closest('details');
        while (parent) { parent.open = true; parent = parent.parentElement?.closest('details'); }
        target.scrollIntoView({ block: 'start' });
        revealed = target;
    }
    window.addEventListener('vllm-hust:langchange', translate);
    window.addEventListener('hashchange', () => { revealed = null; reveal(); });
    // Data-backed anchors arrive asynchronously. Keep old report/validation URLs usable.
    const observer = new MutationObserver(reveal);
    observer.observe(main, { childList: true, subtree: true });
    translate();
    reveal();
})();
