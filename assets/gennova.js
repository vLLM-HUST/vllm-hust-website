(function () {
    'use strict';
    function validate(data) {
        if (data.schema !== 'gennova-independent-validation/v1' || data.kind !== 'independent-engine' || data.b1_replacement_approved !== false || data.full_dataset_quality_score !== null || data.http_comparable !== false) throw Error('Invalid validation scope');
        const m = data.metrics;
        if (m.completed_requests !== 200 || m.total_output_tokens !== 51200 || !(m.seconds > 0) || Math.abs(m.output_tokens_per_second - m.total_output_tokens / m.seconds) > 1e-9 || !m.rank_output_agreement || m.exit_code !== 0 || !m.all_devices_released) throw Error('Invalid validation metrics');
        if (!/^[a-f0-9]{40}$/.test(data.source_commit) || !/^[a-f0-9]{40}$/.test(data.benchmark_evidence_commit)) throw Error('Invalid provenance');
        const prefix = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${data.benchmark_evidence_commit}/reports/gennova-mmlu-pro-20261023/`;
        for (const key of ['report', 'manifest', 'raw_run', 'protocol']) {
            if (!data.evidence[key]?.startsWith(prefix) || data.evidence[key].includes('..')) throw Error('Invalid evidence link');
        }
        return data;
    }
    if (typeof module !== 'undefined' && module.exports) { module.exports = { validate }; return; }
    let data;
    let failed = false;
    function render() {
        const zh = document.documentElement.lang === 'zh';
        document.title = zh ? 'GenNova 独立推理引擎 | vLLM-HUST' : 'GenNova Independent Engine | vLLM-HUST';
        const status = document.getElementById('gn-status');
        if (!data) {
            status.textContent = failed ? (zh ? '验证数据暂不可用，请查阅中文原始报告。' : 'Validation data unavailable. See the original report.') : (zh ? '正在核验 benchmark 数据源…' : 'Verifying benchmark source…');
            if (failed) {
                const link = document.createElement('a');
                link.href = 'https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/b80727393ed07a12a4dfbb5d8006c7ac8c221346/reports/gennova-mmlu-pro-20261023/README.md';
                link.textContent = zh ? '中文验证报告' : 'Validation report (Chinese)';
                document.getElementById('gn-evidence').replaceChildren(link);
            }
            return;
        }
        status.textContent = zh ? '运行验证通过 · 两卡输出一致 · exit 0 · 设备已释放' : 'Runtime validated · matching rank outputs · exit 0 · devices released';
        const m = data.metrics;
        document.getElementById('gn-requests').textContent = `${m.completed_requests} / 200`;
        document.getElementById('gn-throughput').textContent = m.output_tokens_per_second.toFixed(2);
        document.getElementById('gn-tokens').textContent = m.total_output_tokens.toLocaleString('en-US');
        document.getElementById('gn-seconds').textContent = m.seconds.toFixed(3);
        document.getElementById('gn-source').href = `https://github.com/vLLM-HUST/GenNova/commit/${data.source_commit}`;
        document.querySelector('#gn-source code').textContent = data.source_commit;
        document.getElementById('gn-metrics').hidden = false;
        const labels = zh ? ['中文验证报告', 'SHA256 清单', '原始运行证据', '协议与执行脚本'] : ['Validation report (Chinese)', 'SHA256 manifest', 'Raw run evidence', 'Protocol and scripts'];
        document.getElementById('gn-evidence').replaceChildren(...['report', 'manifest', 'raw_run', 'protocol'].map((key, i) => {
            const link = document.createElement('a');
            link.href = data.evidence[key];
            link.textContent = labels[i] + ' ↗';
            return link;
        }));
    }
    window.addEventListener('vllm-hust:langchange', render);
    render();
    (async () => {
        const response = await fetch('./data/benchmark-source-manifest.json', { cache: 'no-cache' });
        if (!response.ok) throw Error('Source unavailable');
        const manifest = await response.json();
        if (manifest.repository !== 'vLLM-HUST/vllm-hust-benchmark' || manifest.status !== 'published-source') throw Error('Unpublished source');
        const binding = manifest.files.find(file => file.website_path === 'data/gennova-validation-v1.json');
        if (!binding) throw Error('Missing publication');
        const result = await fetch('./data/gennova-validation-v1.json', { cache: 'no-cache' });
        if (!result.ok) throw Error('Data unavailable');
        const raw = await result.arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))].map(b => b.toString(16).padStart(2, '0')).join('');
        if (hash !== binding.sha256 || raw.byteLength !== binding.bytes) throw Error('Publication identity mismatch');
        data = validate(JSON.parse(new TextDecoder().decode(raw)));
        render();
    })().catch(() => { failed = true; render(); });
})();
