(function () {
    'use strict';

    function packageCard(pkg) {
        const metaLines = [];
        if (typeof pkg.version_display_label === 'string' && pkg.version_display_label) {
            metaLines.push(`<div class="package-meta"><strong>Version policy:</strong> ${pkg.version_display_label}</div>`);
        }
        if (typeof pkg.version_note_zh === 'string' && pkg.version_note_zh) {
            metaLines.push(`<div class="package-meta">${pkg.version_note_zh}</div>`);
        }
        const pypiUrl = `https://pypi.org/project/${encodeURIComponent(pkg.pypi_name)}/${encodeURIComponent(pkg.version)}/`;
        return `
            <div class="package-item">
                <div class="package-name">${pkg.name}</div>
                <div class="package-version">v${pkg.version}</div>
                ${metaLines.join('')}
                <div class="package-links">
                    <a href="${pypiUrl}" target="_blank">PyPI</a>
                    <a href="${pkg.repo}" target="_blank">GitHub</a>
                </div>
            </div>
        `;
    }

    function renderPackages(meta) {
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

        coreContainer.innerHTML = core.map(packageCard).join('');
        infraContainer.innerHTML = infra.map(packageCard).join('');

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
                infraLoading.textContent = 'No infrastructure package versions found.';
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
})();
