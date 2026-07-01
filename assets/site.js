(function () {
    const I18N = {
        en: {
            navHome: 'Home',
            navLeaderboard: 'Leaderboard',
            navAchievements: 'Achievements',
            navContributors: 'Contributors',
            langToggle: '中文',
        },
        zh: {
            navHome: '首页',
            navLeaderboard: '性能排行榜',
            navAchievements: '成果',
            navContributors: '核心成员',
            langToggle: 'English',
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
            node.textContent = text;
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
        setText('nav-achievements', common.navAchievements);
        setText('nav-contributors', common.navContributors);
        setText('langToggleText', common.langToggle);
        applyPageI18n(lang);
        window.dispatchEvent(new CustomEvent('vllm-hust:langchange', { detail: { lang } }));
    }

    function initNav() {
        const currentPage = document.body?.dataset?.page || 'home';
        document.querySelectorAll('[data-nav-page]').forEach((link) => {
            link.classList.toggle('active', link.dataset.navPage === currentPage);
        });
        const button = document.getElementById('langToggle');
        if (button) {
            button.addEventListener('click', () => {
                setLang(getCurrentLang() === 'zh' ? 'en' : 'zh');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initNav();
        setLang(detectDefaultLang());
    });

    window.vllmHustSite = {
        getCurrentLang,
        setLang,
    };
})();
