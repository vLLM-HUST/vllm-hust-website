(function () {
    const button = document.getElementById('runtime-disclosure');
    const list = document.getElementById('runtime-list');
    if (!button || !list) return;
    const narrow = window.matchMedia('(max-width: 760px)');
    let expanded = !narrow.matches;
    function render() {
        button.hidden = !narrow.matches;
        list.hidden = narrow.matches && !expanded;
        button.setAttribute('aria-expanded', String(!list.hidden));
        const zh = document.documentElement.lang.startsWith('zh');
        button.textContent = list.hidden
            ? (zh ? '展开仓库目录 ＋' : 'Explore repository directory ＋')
            : (zh ? '收起仓库目录 −' : 'Collapse repository directory −');
    }
    button.addEventListener('click', () => { expanded = !expanded; render(); });
    narrow.addEventListener('change', render);
    window.addEventListener('vllm-hust:langchange', render);
    render();
})();
