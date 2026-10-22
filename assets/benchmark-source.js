(() => {
    'use strict';
    const main = document.querySelector('main');
    if (!main || document.getElementById('benchmark-source')) return;
    const details = document.createElement('details');
    details.id = 'benchmark-source';
    details.className = 'current-measurements';
    const summary = document.createElement('summary');
    const state = document.createElement('p');
    const list = document.createElement('ul');
    const manifestLink = document.createElement('a');
    manifestLink.href = './data/benchmark-source-manifest.json';
    manifestLink.textContent = 'SHA256 manifest';
    details.append(summary, state, manifestLink, list);
    main.append(details);
    function revealSection() {
        const target = document.getElementById(location.hash.slice(1));
        if (!target) return;
        for (let node = target; node; node = node.parentElement) {
            if (node.tagName === 'DETAILS') node.open = true;
        }
    }
    window.addEventListener('hashchange', revealSection);
    revealSection();
    let manifest;
    let evidence;
    let evidenceFailed = false;
    let error = false;
    const relevant = location.pathname.endsWith('serving-plan.html')
        ? path => path.includes('serving-plan')
        : location.pathname.endsWith('betterscale.html')
            ? path => path.includes('betterscale')
        : location.pathname.endsWith('traceloom.html')
            ? path => path.includes('traceloom')
        : location.pathname.endsWith('dataset-validation.html')
            ? path => /dataset|mmlu|hle|frontierscience|swe|terminal|midterm/.test(path)
            : path => /frontier|leaderboard|official-target|runs|midterm/.test(path);
    const urlFor = file => `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${manifest.commit}/${file.benchmark_path.split('/').map(encodeURIComponent).join('/')}`;
    const evidenceUrl = record => {
        if (!record || typeof record.path !== 'string' || !['blob', 'tree'].includes(record.kind) || !/^(archive|reports|submissions|website-publication)\//.test(record.path) || record.path.split('/').includes('..')) return null;
        return `https://github.com/vLLM-HUST/vllm-hust-benchmark/${record.kind}/${manifest.commit}/${record.path.split('/').map(encodeURIComponent).join('/')}`;
    };
    const evidenceLabel = role => {
        const zh = window.vllmHustSite?.getCurrentLang() === 'zh';
        const labels = {
            'raw-archive': ['原始运行归档', 'Original run archive'],
            'raw-parts': ['原始归档分片', 'Original archive parts'],
            'raw-manifest': ['原件清单与 SHA256', 'Original manifest & SHA256'],
            'public-measurement-extract': ['公开实测记录', 'Public measurement extract'],
            'publication-record': ['发布记录（不等同完整原始日志）', 'Published record (not full raw logs)'],
            'archived-measurement-report': ['归档测试报告', 'Archived measurement report'],
            'original-public-record': ['原始公开记录', 'Original public record'],
            'verified-release-member-copy': ['原始 Release 成员', 'Original Release member']
        };
        return (labels[role] || ['测量来源', 'Measurement source'])[zh ? 0 : 1];
    };
    function linkEvidence() {
        if (!evidence) {
            if (evidenceFailed) main.querySelectorAll('[data-benchmark-point]:not([data-evidence-ready])').forEach(node => {
                node.dataset.evidenceReady = 'true';
                node.textContent = '来源清单未通过校验 / Evidence index unavailable or unverified';
            });
            return;
        }
        for (const anchor of main.querySelectorAll('a[href]:not([data-evidence-rewritten])')) {
            const url = new URL(anchor.href, location.href);
            const key = url.origin === location.origin ? decodeURIComponent(url.pathname).replace(/^\//, '') : url.href;
            const record = evidence.serving_plans[anchor.dataset.benchmarkPlan] || evidence.rewrites[key];
            const destination = evidenceUrl(record);
            if (!destination) continue;
            anchor.dataset.evidenceRewritten = 'true';
            anchor.dataset.originalHref = anchor.href;
            anchor.href = destination;
            anchor.title = evidenceLabel(record.role);
        }
        for (const container of main.querySelectorAll('[data-benchmark-point]:not([data-evidence-ready])')) {
            const point = evidence.frontier_points[container.dataset.benchmarkPoint];
            container.dataset.evidenceReady = 'true';
            container.replaceChildren();
            if (!point) {
                container.textContent = '未登记原始来源 / Original source not indexed';
                continue;
            }
            for (const record of point.links) {
                const url = evidenceUrl(record);
                if (!url) continue;
                const link = document.createElement('a');
                link.className = 'raw-evidence';
                link.href = url;
                link.textContent = evidenceLabel(record.role) + ' ↗';
                link.title = record.run_id || point.run_ids.join(', ');
                link.target = '_blank';
                link.rel = 'noopener';
                container.append(link, document.createElement('br'));
            }
        }
    }
    function linkPublishedData() {
        if (!manifest || manifest.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(manifest.commit)) return;
        const files = new Map(manifest.files.map(file => [file.website_path, file]));
        for (const anchor of main.querySelectorAll('a[href]:not([data-benchmark-linked])')) {
            const url = new URL(anchor.href, location.href);
            if (url.origin !== location.origin) continue;
            const file = files.get(decodeURIComponent(url.pathname).replace(/^\//, ''));
            if (!file) continue;
            anchor.dataset.benchmarkLinked = 'true';
            const source = document.createElement('a');
            source.className = 'benchmark-publication-link';
            source.href = urlFor(file);
            source.textContent = ' [benchmark ↗]';
            source.title = '发布数据及原始来源字段 / Published data and original provenance fields';
            anchor.after(source);
        }
        linkEvidence();
    }
    new MutationObserver(linkPublishedData).observe(main, { childList: true, subtree: true });
    function render() {
        const zh = window.vllmHustSite?.getCurrentLang() === 'zh';
        summary.textContent = zh ? '数据源：vllm-hust-benchmark' : 'Data source: vllm-hust-benchmark';
        list.replaceChildren();
        if (!manifest) {
            state.textContent = error ? (zh ? '来源清单加载失败。' : 'Source manifest unavailable.')
                : (zh ? '正在核对来源清单…' : 'Loading source manifest…');
            return;
        }
        const published = manifest.status === 'published-source' && /^[a-f0-9]{40}$/.test(manifest.commit);
        state.textContent = published ? `${manifest.commit} · ${manifest.files.length} ${zh ? '个校验文件' : 'checksummed files'}`
            : (zh ? '本地整理版：源数据尚未提交发布，不是生产发布证明。' : 'Local draft: source data has not been committed for publication.');
        for (const file of manifest.files.filter(item => relevant(item.website_path))) {
            const li = document.createElement('li');
            const text = `${file.website_path} · SHA256 ${file.sha256}`;
            if (published) {
                const link = document.createElement('a');
                link.textContent = text;
                link.href = urlFor(file);
                li.append(link);
            } else {
                li.textContent = `${text} · ${file.benchmark_path}`;
            }
            list.append(li);
        }
    }
    window.addEventListener('vllm-hust:langchange', () => {
        render();
        main.querySelectorAll('[data-evidence-ready]').forEach(node => node.removeAttribute('data-evidence-ready'));
        linkEvidence();
    });
    render();
    fetch('./data/benchmark-source-manifest.json', { cache: 'no-cache' })
        .then(response => { if (!response.ok) throw Error('Manifest unavailable'); return response.json(); })
        .then(value => {
            if (value.repository !== 'vLLM-HUST/vllm-hust-benchmark' || !Array.isArray(value.files)) throw Error('Invalid manifest');
            manifest = value; render(); linkPublishedData();
            if (manifest.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(manifest.commit)) throw Error('Unpublished evidence navigation');
            const binding = manifest.files.find(file => file.website_path === 'data/benchmark-evidence-links.json');
            if (!binding) throw Error('Evidence navigation is not part of this publication');
            return fetch('./data/benchmark-evidence-links.json', { cache: 'no-cache' }).then(async response => {
                if (!response.ok) throw Error('Evidence navigation unavailable');
                const raw = await response.arrayBuffer();
                const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))].map(b => b.toString(16).padStart(2, '0')).join('');
                if (hash !== binding.sha256 || raw.byteLength !== binding.bytes) throw Error('Evidence navigation identity mismatch');
                const value = JSON.parse(new TextDecoder().decode(raw));
                if (value.schema !== 'benchmark-evidence-links/v1') throw Error('Invalid evidence navigation');
                evidence = value; linkEvidence();
            });
        })
        .catch(() => {
            if (manifest) {
                evidenceFailed = true;
                state.textContent += ' · 证据链接清单不可用 / Evidence links unavailable';
                linkEvidence();
            } else { error = true; render(); }
        });
})();
