(function () {
    'use strict';

    const SITE_RELEASE = Object.freeze({
        version: '0.3.6',
        releasedAt: '2026-08-16',
    });

    const PRODUCTS = Object.freeze({
        workstation: Object.freeze({
            url: 'https://ws.sage.org.ai/',
            ariaLabel: Object.freeze({
                en: 'Open vLLM-HUST Workstation in a new tab',
                zh: '在新标签页打开 vLLM-HUST Workstation',
            }),
        }),
        'sage-mate': Object.freeze({
            url: 'https://twin.sage.org.ai/',
            ariaLabel: Object.freeze({
                en: 'Talk to Sage Mate in a new tab',
                zh: '在新标签页体验 Sage Mate',
            }),
        }),
    });

    function currentLanguage() {
        return String(window['vllm-hustCurrentLang'] || document.documentElement.lang || 'en').startsWith('zh')
            ? 'zh'
            : 'en';
    }

    function hydrateProductLinks() {
        const lang = currentLanguage();
        document.querySelectorAll('[data-product-id]').forEach((link) => {
            const product = PRODUCTS[link.dataset.productId];
            if (!product) return;
            link.href = product.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('aria-label', product.ariaLabel[lang]);
        });
    }

    window.vllmHustProductCatalog = Object.freeze({ release: SITE_RELEASE, products: PRODUCTS });
    document.addEventListener('DOMContentLoaded', hydrateProductLinks);
    window.addEventListener('vllm-hust:langchange', hydrateProductLinks);
})();
