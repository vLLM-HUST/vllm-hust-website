// Keep previously shared evidence anchors usable inside the compact reading path.
(() => {
  function revealAnchor() {
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    for (let node = target.parentElement; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    target.scrollIntoView();
  }
  window.addEventListener('hashchange', revealAnchor);
  revealAnchor();
})();
