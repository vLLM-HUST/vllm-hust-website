(() => {
  'use strict';

  function forwardLegacyResult() {
    const destination = {
      '#instance-scaling-results': './controlplane/instance/#results',
      '#kv-routing-results': './controlplane/kv/#results'
    }[location.hash];
    if (destination) location.replace(destination);
  }

  window.addEventListener('hashchange', forwardLegacyResult);
  forwardLegacyResult();
})();
