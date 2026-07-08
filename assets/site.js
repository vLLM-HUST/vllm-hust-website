(function () {
    const I18N = {
        en: {
            navHome: 'Home',
            navLeaderboard: 'Leaderboard',
            navAchievements: 'Achievements',
            navContributors: 'Contributors',
            navConferences: 'Conferences',
            navCourses: 'Courses',
            brandSubtitle: 'vLLM serving',
            langToggle: '中 / EN',
        },
        zh: {
            navHome: '首页',
            navLeaderboard: '性能排行榜',
            navAchievements: '成果',
            navContributors: '核心成员',
            navConferences: '会议',
            navCourses: '课程',
            brandSubtitle: 'vLLM 推理服务',
            langToggle: '中 / EN',
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
        setText('nav-conferences', common.navConferences);
        setText('nav-courses', common.navCourses);
        setText('langToggleText', common.langToggle);
        document.querySelectorAll('.brand-copy small').forEach((node) => {
            node.textContent = common.brandSubtitle;
        });
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
            width = window.innerWidth;
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
        initNav();
        initCosmicBackground();
        setLang(detectDefaultLang());
    });

    window.vllmHustSite = {
        getCurrentLang,
        setLang,
    };
})();
