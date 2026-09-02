(function (root) {
    'use strict';
    function describe(timestamp, lang = 'en', now = Date.now()) {
        const value = Date.parse(timestamp);
        const stale = !Number.isFinite(value) || value > now + 300000 || now - value > 7 * 86400000;
        const date = Number.isFinite(value) ? new Date(value).toISOString().replace('T', ' ').replace('Z', ' UTC') : (lang === 'zh' ? '未核验' : 'not verified');
        const text = lang === 'zh'
            ? `GitHub 快照核验：${date}。${stale ? '数据可能已过期，请以来源链接为准。' : '这是定时核验快照，不是实时状态。'}`
            : `Snapshot verified: ${date}. ${stale ? 'May be out of date; check the source links.' : 'Periodically verified snapshot, not live status.'}`;
        return { stale, text };
    }
    function render(node, timestamp, lang) {
        if (!node) return;
        const result = describe(timestamp, lang);
        node.textContent = result.text;
        node.dataset.stale = String(result.stale);
    }
    root.vllmHustSnapshot = Object.freeze({ describe, render });
})(globalThis);
