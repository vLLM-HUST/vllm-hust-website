/* Preserve direct links when long product details start collapsed. */
(function () {
  'use strict';
  if (!document.body.classList.contains('product-home')) return;
  let revealedHash = null;
  function reveal(hash) {
    let id;
    try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    revealedHash = hash;
    if (id === 'publications') target.querySelector('.publication-library').open = true;
    for (let node = target; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    requestAnimationFrame(() => target.scrollIntoView());
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash) reveal(url.hash);
  });
  window.addEventListener('hashchange', () => {
    if (location.hash !== revealedHash) reveal(location.hash);
  });
  window.addEventListener('load', () => reveal(location.hash));
}());
