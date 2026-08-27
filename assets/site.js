(function () {
    const I18N = {
        en: {
            navHome: 'Home',
            navLeaderboard: 'Leaderboard',
            navDatasetValidation: 'Dataset validation',
            navAchievements: 'Achievements',
            navNews: 'News',
            navContributors: 'Contributors',
            navMembers: 'Members',
            navConferences: 'Conferences',
            navCourses: 'Courses',
            navIssues: 'Issues',
            navProducts: 'Products',
            navEngine: 'Engine',
            navProjects: 'Projects',
            navPlugins: 'Plugins',
            navEvidence: 'Evidence',
            navCommunity: 'Community',
            navResources: 'Resources',
            navVersions: 'Versions',
            navGithub: 'GitHub',
            navMenu: 'Open navigation',
            navMenuClose: 'Close navigation',
            footerBuild: 'Build',
            footerEvidence: 'Evidence',
            footerCommunity: 'Community',
            brandSubtitle: 'Domestic-compute inference engine',
            langToggle: 'ZH',
            langToggleLabel: '切换为中文',
        },
        zh: {
            navHome: '首页',
            navLeaderboard: '性能排行榜',
            navDatasetValidation: '数据集验证',
            navAchievements: '成果',
            navNews: '新闻',
            navContributors: '核心成员',
            navMembers: '组织成员',
            navConferences: '会议',
            navCourses: '课程',
            navIssues: '议题',
            navProducts: '产品',
            navEngine: '引擎',
            navProjects: '项目',
            navPlugins: '插件',
            navEvidence: '成果',
            navCommunity: '社区',
            navResources: '资源',
            navVersions: '版本',
            navGithub: 'GitHub',
            navMenu: '打开导航',
            navMenuClose: '关闭导航',
            footerBuild: '构建',
            footerEvidence: '成果',
            footerCommunity: '社区',
            brandSubtitle: '面向国产算力的推理引擎',
            langToggle: 'EN',
            langToggleLabel: 'Switch to English',
        },
    };

    function detectDefaultLang() {
        const stored = localStorage.getItem('vllm-hust_lang');
        if (stored === 'zh' || stored === 'en') return stored;
        const nav = (navigator.language || 'en').toLowerCase();
        return nav.startsWith('zh') ? 'zh' : 'en';
    }

    function getCurrentLang() {
        return (window['vllm-hustCurrentLang'] || document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
    }

    function setText(id, text) {
        const node = document.getElementById(id);
        if (node && typeof text === 'string') {
            if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
                node.placeholder = text;
            } else {
                node.textContent = text;
            }
        }
    }

    function applyPageI18n(lang) {
        const pageDict = window.vllmHustPageDict || {};
        const dict = pageDict[lang] || pageDict.en || {};
        Object.entries(dict).forEach(([key, value]) => {
            if (key === 'title') {
                document.title = value;
                return;
            }
            setText(key, value);
        });
    }

    function setLang(lang) {
        const common = I18N[lang] || I18N.en;
        const pageDict = window.vllmHustPageDict || {};
        const mergedI18n = {
            en: { ...I18N.en, ...(pageDict.en || {}) },
            zh: { ...I18N.zh, ...(pageDict.zh || {}) },
        };
        document.documentElement.lang = lang;
        window['vllm-hustCurrentLang'] = lang;
        window['vllm-hustPageI18n'] = mergedI18n;
        localStorage.setItem('vllm-hust_lang', lang);

        setText('nav-home', common.navHome);
        setText('nav-leaderboard', common.navLeaderboard);
        setText('nav-dataset-validation', common.navDatasetValidation);
        setText('nav-achievements', common.navAchievements);
        setText('nav-news', common.navNews);
        setText('nav-contributors', common.navContributors);
        setText('nav-members', common.navMembers);
        setText('nav-conferences', common.navConferences);
        setText('nav-courses', common.navCourses);
        setText('nav-issues', common.navIssues);
        setText('nav-products', common.navProducts);
        setText('nav-engine', common.navEngine);
        setText('nav-projects', common.navProjects);
        setText('nav-plugins', common.navPlugins);
        setText('nav-evidence', common.navEvidence);
        setText('nav-community', common.navCommunity);
        setText('nav-resources', common.navResources);
        setText('nav-versions', common.navVersions);
        document.querySelectorAll('[data-i18n-common]').forEach((node) => {
            const key = node.dataset.i18nCommon;
            if (key && typeof common[key] === 'string') node.textContent = common[key];
        });
        setText('langToggleText', common.langToggle);
        const languageButton = document.getElementById('langToggle');
        if (languageButton) {
            languageButton.setAttribute('aria-label', common.langToggleLabel);
            languageButton.setAttribute('title', common.langToggleLabel);
        }
        const menuButton = document.getElementById('navToggle');
        if (menuButton) {
            const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
            menuButton.setAttribute('aria-label', isOpen ? common.navMenuClose : common.navMenu);
        }
        document.querySelectorAll('.brand-copy small').forEach((node) => {
            node.textContent = common.brandSubtitle;
        });
        applyPageI18n(lang);
        window.dispatchEvent(new CustomEvent('vllm-hust:langchange', { detail: { lang } }));
    }

    const NAV_GROUPS = [
        {
            id: 'evidence',
            label: 'navEvidence',
            pages: ['leaderboard', 'achievements', 'news'],
            links: [
                ['leaderboard', './leaderboard.html', 'navLeaderboard'],
                ['achievements', './achievements.html', 'navAchievements'],
                ['news', './news.html', 'navNews'],
            ],
        },
        {
            id: 'community',
            label: 'navCommunity',
            pages: ['members', 'contributors', 'conferences', 'courses'],
            links: [
                ['members', './members.html', 'navMembers'],
                ['contributors', './contributors.html', 'navContributors'],
                ['conferences', './conferences.html', 'navConferences'],
                ['courses', './courses.html', 'navCourses'],
            ],
        },
        {
            id: 'resources',
            label: 'navResources',
            pages: ['versions', 'issues'],
            links: [
                ['versions', './versions.html', 'navVersions'],
                ['issues', './issues.html', 'navIssues'],
                ['', 'https://github.com/vLLM-HUST', 'navGithub', true],
            ],
        },
    ];

    function navLink(page, href, key, external) {
        const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        const pageAttr = page ? ` data-nav-page="${page}"` : '';
        const emphasis = page === 'plugins' ? ' nav-plugin-link' : '';
        return `<a class="nav-link${emphasis}"${pageAttr} href="${href}" data-i18n-common="${key}"${attrs}>${I18N.en[key]}</a>`;
    }

    function renderNavigation() {
        const nav = document.querySelector('.site-nav');
        const inner = nav?.querySelector('.site-nav-inner');
        const links = nav?.querySelector('.nav-links');
        if (!nav || !inner || !links) return;

        links.id = 'site-navigation';
        links.innerHTML = [
            navLink('', './index.html#products', 'navProducts'),
            navLink('', './index.html#stack', 'navEngine'),
            navLink('', './index.html#projects', 'navProjects'),
            navLink('plugins', './plugins.html', 'navPlugins'),
            ...NAV_GROUPS.map((group) => `
                <details class="nav-group" data-nav-group="${group.id}">
                    <summary class="nav-group-label" id="nav-${group.id}" data-i18n-common="${group.label}">${I18N.en[group.label]}</summary>
                    <div class="nav-group-menu">
                        ${group.links.map((link) => navLink(...link)).join('')}
                    </div>
                </details>
            `),
        ].join('');

        const button = document.createElement('button');
        button.id = 'navToggle';
        button.className = 'nav-toggle';
        button.type = 'button';
        button.setAttribute('aria-controls', links.id);
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = '<span></span><span></span><span></span>';
        inner.insertBefore(button, links);
        const languageButton = document.getElementById('langToggle');
        if (languageButton) inner.appendChild(languageButton);
        nav.classList.add('enhanced');

        const setOpen = (open) => {
            nav.classList.toggle('nav-open', open);
            document.body.classList.toggle('nav-menu-open', open);
            button.setAttribute('aria-expanded', String(open));
            if (open && window.matchMedia('(max-width: 860px)').matches) {
                links.querySelectorAll('.nav-group').forEach((group) => {
                    group.open = group.classList.contains('active');
                });
            }
            const common = I18N[getCurrentLang()] || I18N.en;
            button.setAttribute('aria-label', open ? common.navMenuClose : common.navMenu);
        };
        button.addEventListener('click', () => setOpen(!nav.classList.contains('nav-open')));
        links.addEventListener('click', (event) => {
            if (event.target.closest('a')) {
                setOpen(false);
                links.querySelectorAll('.nav-group').forEach((group) => { group.open = false; });
            }
        });
        links.querySelectorAll('.nav-group').forEach((group) => {
            group.addEventListener('toggle', () => {
                if (!group.open) return;
                links.querySelectorAll('.nav-group').forEach((other) => {
                    if (other !== group) other.open = false;
                });
            });
        });
        document.addEventListener('click', (event) => {
            if (nav.contains(event.target)) return;
            links.querySelectorAll('.nav-group').forEach((group) => { group.open = false; });
        });
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const openGroup = links.querySelector('.nav-group[open]');
            if (openGroup && !nav.classList.contains('nav-open')) {
                openGroup.open = false;
                openGroup.querySelector('summary')?.focus();
                return;
            }
            if (!nav.classList.contains('nav-open')) return;
            setOpen(false);
            button.focus();
        });
    }

    function renderFooter() {
        const footer = document.querySelector('.site-footer, .execution-footer');
        if (!footer) return;
        const summary = footer.querySelector('#footer-copy')?.textContent
            || footer.textContent.replace(/vllm-hust/ig, '').replace(/·/g, '').trim()
            || 'Inference for domestic compute.';
        footer.classList.add('site-footer', 'site-directory');
        footer.innerHTML = `
            <div class="site-directory-inner">
                <div class="site-directory-brand">
                    <strong>vLLM-HUST</strong>
                    <span id="footer-copy">${summary}</span>
                </div>
                <nav class="site-directory-links" aria-label="Footer navigation">
                    <div><strong data-i18n-common="footerBuild">Build</strong><a href="./index.html#products" data-i18n-common="navProducts">Products</a><a href="./index.html#stack" data-i18n-common="navEngine">Engine</a><a href="./index.html#projects" data-i18n-common="navProjects">Projects</a><a href="./plugins.html" data-i18n-common="navPlugins">Plugins</a><a href="./versions.html" data-i18n-common="navVersions">Versions</a></div>
                    <div><strong data-i18n-common="footerEvidence">Evidence</strong><a href="./leaderboard.html" data-i18n-common="navLeaderboard">Leaderboard</a><a href="./achievements.html" data-i18n-common="navAchievements">Achievements</a><a href="./news.html" data-i18n-common="navNews">News</a><a href="./issues.html" data-i18n-common="navIssues">Issues</a></div>
                    <div><strong data-i18n-common="footerCommunity">Community</strong><a href="./members.html" data-i18n-common="navMembers">Members</a><a href="./contributors.html" data-i18n-common="navContributors">Contributors</a><a href="./conferences.html" data-i18n-common="navConferences">Conferences</a><a href="./courses.html" data-i18n-common="navCourses">Courses</a><a href="https://github.com/vLLM-HUST" target="_blank" rel="noopener noreferrer" data-i18n-common="navGithub">GitHub</a></div>
                </nav>
            </div>`;
    }

    function initNav() {
        const currentPage = document.body?.dataset?.page || 'home';
        document.querySelectorAll('[data-nav-page]').forEach((link) => {
            link.classList.toggle('active', link.dataset.navPage === currentPage);
        });
        NAV_GROUPS.forEach((group) => {
            const node = document.querySelector(`[data-nav-group="${group.id}"]`);
            node?.classList.toggle('active', group.pages.includes(currentPage));
        });
        const button = document.getElementById('langToggle');
        if (button) {
            button.addEventListener('click', () => {
                setLang(getCurrentLang() === 'zh' ? 'en' : 'zh');
            });
        }
    }

    function initCosmicBackground() {
        const canvas = document.getElementById('cosmic-background');
        if (!canvas || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const stars = [];
        let width = 0;
        let height = 0;
        let frame = 0;

        function reset() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = document.documentElement.clientWidth || window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            stars.length = 0;
            const count = Math.max(80, Math.floor((width * height) / 11500));
            for (let i = 0; i < count; i += 1) {
                stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    z: 0.3 + Math.random() * 1.4,
                    r: 0.7 + Math.random() * 1.8,
                    a: 0.28 + Math.random() * 0.58,
                });
            }
        }

        function draw() {
            frame += 1;
            ctx.clearRect(0, 0, width, height);
            const gradient = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.68);
            gradient.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
            gradient.addColorStop(0.45, 'rgba(15, 23, 42, 0.18)');
            gradient.addColorStop(1, 'rgba(3, 7, 18, 0.92)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            stars.forEach((star, index) => {
                star.y += 0.06 * star.z;
                star.x += Math.sin((frame + index) * 0.006) * 0.035 * star.z;
                if (star.y > height + 8) star.y = -8;
                const pulse = 0.65 + Math.sin(frame * 0.018 + index) * 0.35;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.r * pulse, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(191, 219, 254, ${star.a})`;
                ctx.fill();
            });

            const cx = width * 0.5;
            const cy = height * 0.52;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(frame * 0.0012);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.20)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i += 1) {
                ctx.beginPath();
                ctx.ellipse(0, 0, 160 + i * 86, 58 + i * 31, i * 0.5, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();

            requestAnimationFrame(draw);
        }

        reset();
        window.addEventListener('resize', reset);
        requestAnimationFrame(draw);
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderNavigation();
        renderFooter();
        initNav();
        initCosmicBackground();
        setLang(detectDefaultLang());
    });

    window.vllmHustSite = {
        getCurrentLang,
        setLang,
    };
})();
