(() => {
  'use strict';
  function reveal() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const requested = document.getElementById(id);
    if (!requested) return;
    const lang = window.vllmHustSite?.getCurrentLang() === 'en' ? 'en' : 'zh';
    const translated = document.getElementById(id.replace(/-(zh|en)$/, '-' + lang)) || requested;
    const details = translated.closest('details');
    if (details) { details.open = true; translated.scrollIntoView({block: 'start'}); }
  }
  function render() {
    const lang = window.vllmHustSite?.getCurrentLang() === 'en' ? 'en' : 'zh';
    document.querySelectorAll('[data-plan-lang]').forEach(node => { node.hidden = node.dataset.planLang !== lang; });
    document.querySelectorAll('[data-plan-zh]').forEach(node => { node.textContent = node.dataset[lang === 'en' ? 'planEn' : 'planZh']; });
    if (document.body.dataset.page === 'test-plan') document.title = (lang === 'zh' ? '课题四送测方案' : 'Topic 4 submission plan') + ' · vLLM-HUST';
    reveal();
  }
  window.addEventListener('vllm-hust:langchange', render);
  window.addEventListener('hashchange', reveal);
  render();
})();
