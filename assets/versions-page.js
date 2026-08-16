(function () {
    'use strict';

    let currentMeta = null;

    function currentLanguage() {
        return window.vllmHustSite?.getCurrentLang?.() === 'zh' ? 'zh' : 'en';
    }

    function packageCard(pkg, lang) {
        const metaLines = [];
        if (typeof pkg.version_display_label === 'string' && pkg.version_display_label) {
            const label = lang === 'zh' ? '版本口径' : 'Version policy';
            metaLines.push(`<div class="package-meta"><strong>${label}:</strong> ${pkg.version_display_label}</div>`);
        }
        if (lang === 'zh' && typeof pkg.version_note_zh === 'string' && pkg.version_note_zh) {
            metaLines.push(`<div class="package-meta">${pkg.version_note_zh}</div>`);
        }
        const pypiUrl = pkg.pypi_name
            ? `https://pypi.org/project/${encodeURIComponent(pkg.pypi_name)}/${encodeURIComponent(pkg.version || '')}/`
            : '';
        return `
            <div class="package-item">
                <div class="package-name">${pkg.name}</div>
                <div class="package-version">${pkg.version || 'repository'}</div>
                ${metaLines.join('')}
                <div class="package-links">
                    ${pypiUrl ? `<a href="${pypiUrl}" target="_blank" rel="noopener noreferrer">PyPI</a>` : ''}
                    ${pkg.repo ? `<a href="${pkg.repo}" target="_blank" rel="noopener noreferrer">GitHub</a>` : ''}
                </div>
            </div>
        `;
    }

    function renderPackages(meta) {
        currentMeta = meta;
        const lang = currentLanguage();
        const coreContainer = document.getElementById('core-packages');
        const infraContainer = document.getElementById('infra-packages');
        const updatedNode = document.getElementById('versions-updated-at');
        const installVersionNode = document.getElementById('versions-install-version');
        const coreLoading = document.getElementById('core-loading');
        const infraLoading = document.getElementById('infra-loading');

        if (!coreContainer || !infraContainer) {
            return;
        }

        const packages = Array.isArray(meta.packages) ? meta.packages : [];
        const core = packages.filter((pkg) => pkg.group === 'core');
        const infra = packages.filter((pkg) => pkg.group === 'infrastructure');
        const rootPackage = packages.find((pkg) => pkg.name === 'vllm-hust');

        coreContainer.innerHTML = core.map((pkg) => packageCard(pkg, lang)).join('');
        infraContainer.innerHTML = infra.map((pkg) => packageCard(pkg, lang)).join('');

        if (installVersionNode) {
            installVersionNode.textContent = rootPackage?.version || 'latest';
        }

        if (coreLoading) {
            coreLoading.style.display = core.length > 0 ? 'none' : 'block';
            if (core.length === 0) {
                coreLoading.textContent = 'No core package versions found.';
            }
        }
        if (infraLoading) {
            infraLoading.style.display = infra.length > 0 ? 'none' : 'block';
            if (infra.length === 0) {
                infraLoading.textContent = 'No extension repositories listed.';
            }
        }

        if (updatedNode) {
            updatedNode.textContent = meta.updated_at || 'Unknown';
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const response = await fetch('./data/version_meta.json', { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`Failed to load version metadata: ${response.status}`);
            }
            const meta = await response.json();
            renderPackages(meta);
        } catch (error) {
            console.warn('[versions-page] failed:', error.message);
            const coreLoading = document.getElementById('core-loading');
            const infraLoading = document.getElementById('infra-loading');
            if (coreLoading) {
                coreLoading.textContent = 'Failed to load package versions.';
            }
            if (infraLoading) {
                infraLoading.textContent = 'Failed to load package versions.';
            }
        }
    });

    window.addEventListener('vllm-hust:langchange', () => {
        if (currentMeta) renderPackages(currentMeta);
    });
})();
