(() => {
    'use strict';
    const main = document.querySelector('main');
    if (!main) return;
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
    let error = false;
    const relevant = location.pathname.endsWith('serving-plan.html')
        ? path => path.includes('serving-plan')
        : location.pathname.endsWith('dataset-validation.html')
            ? path => /dataset|mmlu|hle|frontierscience|swe|terminal/.test(path)
            : path => /frontier|leaderboard|official-target|runs/.test(path);
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
                link.href = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${manifest.commit}/${file.benchmark_path.split('/').map(encodeURIComponent).join('/')}`;
                li.append(link);
            } else {
                li.textContent = `${text} · ${file.benchmark_path}`;
            }
            list.append(li);
        }
    }
    window.addEventListener('vllm-hust:langchange', render);
    render();
    fetch('./data/benchmark-source-manifest.json', { cache: 'no-cache' })
        .then(response => { if (!response.ok) throw Error('Manifest unavailable'); return response.json(); })
        .then(value => { manifest = value; render(); })
        .catch(() => { error = true; render(); });
})();
