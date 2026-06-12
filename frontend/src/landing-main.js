        const copyrightYearEl = document.getElementById('copyright-year');
        if (copyrightYearEl) {
            copyrightYearEl.textContent = String(new Date().getFullYear());
        }

        // ─── Domain Colors ───────────────────────────────────────────────
        const DOMAIN_COLORS = window.NodusTokens?.DOMAIN_COLORS || {
            MAT: '#5b9bd5', PHY: '#c97a5b', CHE: '#c9c05b',
            BIO: '#5bc97a', MED: '#5bc9b8', ENG: '#9b7bc9',
            TEC: '#c95b9b', SOC: '#c9a05a', HUM: '#7ba5c9',
            PHI: '#9bc95b', ART: '#c95b5b', HIS: '#a07850'
        };
        const TYPE_COLORS = {
            field: 'rgba(91, 155, 213, 0.25)',
            concept: 'rgba(196, 198, 206, 0.15)',
            person: 'rgba(240, 192, 80, 0.2)',
            event: 'rgba(255, 180, 171, 0.2)'
        };

        // ─── State ───────────────────────────────────────────────────────
        const SUPPORTED_LANGS = ['en', 'zh', 'ja'];
        let allNodes = [];
        let searchIndex = [];
        let i18n = null;
        let lang = normalizeLang(localStorage.getItem('nodus-lang'));
        let activeIndex = -1;

        function normalizeLang(value) {
            if (!value) return 'en';
            if (value === 'zh-TW') return 'zh';
            if (value.toLowerCase() === 'ja-jp') return 'ja';
            return SUPPORTED_LANGS.includes(value) ? value : 'en';
        }

        function htmlLang(value) {
            if (value === 'zh') return 'zh-Hant';
            return value;
        }

        // ─── DOM ─────────────────────────────────────────────────────────
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        const searchSpinner = document.getElementById('searchSpinner');
        const nodeCountEl = document.getElementById('nodeCount');
        const langToggle = document.getElementById('langToggle');
        const heroKicker = document.getElementById('heroKicker');
        const heroTitle = document.getElementById('heroTitle');
        const heroSubtitle = document.getElementById('heroSubtitle');
        const ctaExplore = document.getElementById('ctaExplore');
        const pillTooltip = document.getElementById('pillTooltip');
        const pillTooltipDomain = document.getElementById('pillTooltipDomain');
        const pillTooltipTitle = document.getElementById('pillTooltipTitle');
        const pillTooltipBody = document.getElementById('pillTooltipBody');
        const footerCopy = document.getElementById('footerCopy');
        const footerGraphLink = document.getElementById('footerGraphLink');
        const footerExplorerLink = document.getElementById('footerExplorerLink');
        let activeTooltipButton = null;
        let touchTooltipButton = null;

        function prefersTouchTooltipMode() {
            return window.__NODUS_FORCE_TOUCH_TOOLTIP__ === true ||
                window.matchMedia('(pointer: coarse)').matches ||
                navigator.maxTouchPoints > 0;
        }

        function hidePillTooltip() {
            activeTooltipButton?.removeAttribute('aria-describedby');
            activeTooltipButton = null;
            touchTooltipButton = null;
            pillTooltip.classList.remove('visible');
            pillTooltip.setAttribute('aria-hidden', 'true');
        }

        function positionPillTooltip(button) {
            const rect = button.getBoundingClientRect();
            const margin = 12;
            const tooltipRect = pillTooltip.getBoundingClientRect();
            const left = Math.min(
                Math.max(margin, rect.left + rect.width / 2 - tooltipRect.width / 2),
                window.innerWidth - tooltipRect.width - margin
            );
            const placeAbove = rect.top - tooltipRect.height - 14 >= margin;
            const top = placeAbove ? rect.top - tooltipRect.height - 14 : rect.bottom + 14;
            pillTooltip.dataset.placement = placeAbove ? 'above' : 'below';
            pillTooltip.style.left = `${left}px`;
            pillTooltip.style.top = `${top}px`;
        }

        function showPillTooltip(button) {
            const domain = button.dataset.tooltipDomain || '';
            const title = button.dataset.tooltipTitle || button.querySelector('.pill-label')?.textContent || '';
            const body = button.dataset.tooltipBody || '';
            if (!domain || !body) return;
            activeTooltipButton?.removeAttribute('aria-describedby');
            activeTooltipButton = button;
            pillTooltipDomain.textContent = domain;
            pillTooltipTitle.textContent = title;
            pillTooltipBody.textContent = body;
            pillTooltip.classList.add('visible');
            pillTooltip.setAttribute('aria-hidden', 'false');
            button.setAttribute('aria-describedby', 'pillTooltip');
            positionPillTooltip(button);
        }

        // ─── Data Loading ────────────────────────────────────────────────
        async function loadData() {
            try {
                let data;
                const cacheKey = 'nodus:index:graph:v1';
                try {
                    const cachedRaw = sessionStorage.getItem(cacheKey);
                    if (cachedRaw) {
                        data = JSON.parse(cachedRaw);
                    }
                } catch (_) {
                    // Ignore invalid cache and fetch fresh.
                }

                if (!data || !Array.isArray(data.nodes)) {
                    try {
                        const apiRes = await fetch('/api/graph/full');
                        if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
                        data = await apiRes.json();
                    } catch (_) {
                        const fallbackRes = await fetch('../data/all_nodes.json');
                        if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
                        data = await fallbackRes.json();
                    }
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify(data));
                    } catch (_) {
                        // Ignore storage quota errors.
                    }
                }
                allNodes = data.nodes || [];
                searchIndex = allNodes.map((node) => ({
                    node,
                    id: node.id.toLowerCase(),
                    label: (node.label || '').toLowerCase(),
                    tags: (node.display_tags || []).map((t) => String(t).toLowerCase()),
                    desc: (node.description || '').toLowerCase(),
                }));
                nodeCountEl.textContent = `${allNodes.length} NODES · ${countEdges(data)} EDGES · 13 DOMAINS`;
                nodeCountEl.style.opacity = '1';
            } catch (e) {
                console.error('Failed to load nodes:', e);
            }
        }

        async function loadI18n(locale) {
            if (locale === 'en') {
                i18n = null;
                return;
            }
            try {
                let data;
                try {
                    const apiRes = await fetch(`/api/i18n/${encodeURIComponent(locale)}`);
                    if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
                    data = await apiRes.json();
                } catch (_) {
                    const fallbackRes = await fetch(`../data/i18n/${encodeURIComponent(locale)}.json`);
                    if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
                    data = await fallbackRes.json();
                }
                i18n = data;
            } catch (e) {
                console.warn('i18n load failed:', e);
                i18n = null;
            }
        }

        function countEdges(data) {
            if (data.edges) return data.edges.length;
            let count = 0;
            for (const node of (data.nodes || [])) {
                count += (node.connections || []).length;
            }
            return Math.floor(count / 2);
        }

        // ─── Search ──────────────────────────────────────────────────────
        function search(query) {
            if (!query || query.length < 2) return [];
            const q = query.toLowerCase();
            const scored = [];

            for (const entry of searchIndex) {
                const node = entry.node;
                let score = 0;
                const label = getLabel(node).toLowerCase();

                // Exact label match
                if (label === q || entry.id === q) { score = 100; }
                // Label starts with query
                else if (label.startsWith(q) || entry.id.startsWith(q)) { score = 80; }
                // Label contains query
                else if (label.includes(q) || entry.id.includes(q)) { score = 60; }
                // Tags match
                else if (entry.tags.some(t => t.includes(q))) { score = 40; }
                // Description contains
                else if (entry.desc.includes(q)) { score = 20; }

                if (score > 0) {
                    scored.push({ node, score });
                }
            }

            scored.sort((a, b) => b.score - a.score);
            return scored.slice(0, 8);
        }

        function getLabel(node) {
            if (lang !== 'en' && i18n && i18n[node.id]) {
                return i18n[node.id];
            }
            return node.label;
        }

        function renderResults(results) {
            if (results.length === 0) {
                searchResults.classList.add('hidden');
                return;
            }

            searchResults.innerHTML = '';

            results.forEach((r, i) => {
                const node = r.node || {};
                const item = document.createElement('div');
                item.className = `search-result-item ${i === activeIndex ? 'active' : ''}`;
                item.dataset.nodeId = String(node.id || '');
                item.dataset.index = String(i);

                const row = document.createElement('div');
                row.className = 'flex items-center justify-between';

                const left = document.createElement('div');
                left.className = 'flex items-center gap-2';

                for (const d of (node.domain || [])) {
                    const dot = document.createElement('span');
                    dot.className = 'domain-dot';
                    dot.style.background = DOMAIN_COLORS[d] || '#888';
                    left.appendChild(dot);
                }

                const labelEl = document.createElement('span');
                labelEl.className = 'text-on-surface font-body-sm';
                labelEl.textContent = getLabel(node);
                left.appendChild(labelEl);

                const typeEl = document.createElement('span');
                typeEl.className = 'type-badge';
                typeEl.style.background = TYPE_COLORS[node.type] || TYPE_COLORS.concept;
                typeEl.style.color = 'rgba(212, 228, 250, 0.7)';
                typeEl.textContent = String(node.type || 'concept');

                row.appendChild(left);
                row.appendChild(typeEl);

                const descEl = document.createElement('div');
                descEl.className = 'text-on-surface/40 text-[11px] mt-1 line-clamp-1 font-label-code';
                const desc = String(node.description || '');
                descEl.textContent = desc.length > 80 ? `${desc.slice(0, 80)}…` : desc;

                item.appendChild(row);
                item.appendChild(descEl);
                searchResults.appendChild(item);
            });

            searchResults.classList.remove('hidden');
        }

        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        // ─── Navigation ──────────────────────────────────────────────────
        function navigateToNode(nodeId) {
            window.location.href = `app.html?node=${encodeURIComponent(nodeId)}`;
        }

        function navigateToSearch(query) {
            window.location.href = `app.html?search=${encodeURIComponent(query)}`;
        }

        // ─── Event Handlers ──────────────────────────────────────────────
        let debounceTimer = null;
        let latestResults = [];
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const q = searchInput.value.trim();
            if (q.length < 2) {
                searchResults.classList.add('hidden');
                activeIndex = -1;
                latestResults = [];
                return;
            }
            debounceTimer = setTimeout(() => {
                const results = search(q);
                latestResults = results;
                activeIndex = -1;
                renderResults(results);
            }, 150);
        });

        searchInput.addEventListener('keydown', (e) => {
            const items = searchResults.querySelectorAll('.search-result-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, items.length - 1);
                renderResults(latestResults);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, -1);
                renderResults(latestResults);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0 && items[activeIndex]) {
                    const nodeId = items[activeIndex].dataset.nodeId;
                    navigateToNode(nodeId);
                } else if (searchInput.value.trim().length >= 2) {
                    navigateToSearch(searchInput.value.trim());
                }
            } else if (e.key === 'Escape') {
                searchResults.classList.add('hidden');
                activeIndex = -1;
            }
        });

        searchResults.addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (item) {
                navigateToNode(item.dataset.nodeId);
            }
        });

        // Close results on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#searchContainer') && !e.target.closest('#searchResults')) {
                searchResults.classList.add('hidden');
                activeIndex = -1;
            }
            if (!e.target.closest('.pill-btn') && !e.target.closest('#pillTooltip')) {
                hidePillTooltip();
            }
        });

        // Suggestion pills
        document.querySelectorAll('.pill-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if (!prefersTouchTooltipMode()) showPillTooltip(btn);
            });
            btn.addEventListener('focus', () => {
                if (!prefersTouchTooltipMode()) showPillTooltip(btn);
            });
            btn.addEventListener('mouseleave', () => {
                if (!prefersTouchTooltipMode()) hidePillTooltip();
            });
            btn.addEventListener('blur', () => {
                if (!prefersTouchTooltipMode() || touchTooltipButton !== btn) hidePillTooltip();
            });
            btn.addEventListener('click', (e) => {
                if (prefersTouchTooltipMode() && (touchTooltipButton !== btn || !pillTooltip.classList.contains('visible'))) {
                    e.preventDefault();
                    showPillTooltip(btn);
                    touchTooltipButton = btn;
                    return;
                }
                touchTooltipButton = null;
                const nodeId = btn.dataset.node;
                const query = btn.dataset.query;
                if (nodeId) {
                    navigateToNode(nodeId);
                } else if (query) {
                    navigateToSearch(query);
                }
            });
        });

        window.addEventListener('resize', () => {
            if (activeTooltipButton) positionPillTooltip(activeTooltipButton);
        });

        window.addEventListener('scroll', () => {
            if (activeTooltipButton) positionPillTooltip(activeTooltipButton);
        }, { passive: true });

        async function setLang(nextLang) {
            if (!SUPPORTED_LANGS.includes(nextLang) || nextLang === lang) return;
            lang = nextLang;
            localStorage.setItem('nodus-lang', lang);
            document.documentElement.lang = htmlLang(lang);
            await loadI18n(lang);
            applyLang();
        }

        // Language toggle (direct selection, no cycling)
        langToggle.addEventListener('click', async (e) => {
            const btn = e.target.closest('.lang-btn');
            if (!btn) return;
            await setLang(btn.dataset.lang);
        });

        langToggle.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const btn = e.target.closest('.lang-btn');
            if (!btn) return;
            e.preventDefault();
            await setLang(btn.dataset.lang);
        });

        function applyLang() {
            const copy = {
                en: {
                    heroKicker: 'BEGIN ANYWHERE',
                    heroTitle: 'It\'s all <span class="text-primary">connected</span>',
                    heroSubtitle: 'Follow one spark of curiosity wherever it leads.',
                    ctaExplore: 'Start Exploring',
                    placeholder: 'Explore the infinite...',
                    footerCopy: `© ${new Date().getFullYear()} NODUS. EXPLORE THE INFINITE.`,
                    footerGraph: 'Graph',
                    footerExplorer: 'Explorer',
                },
                zh: {
                    heroKicker: '從任一點開始',
                    heroTitle: '一切皆<span class="text-primary">相連</span>',
                    heroSubtitle: '順著一絲好奇，看它通向何方。',
                    ctaExplore: '開始探索',
                    placeholder: '探索無限知識…',
                    footerCopy: `© ${new Date().getFullYear()} NODUS．探索無限知識。`,
                    footerGraph: '圖譜',
                    footerExplorer: '探索器',
                },
                ja: {
                    heroKicker: 'どこからでも',
                    heroTitle: 'すべては<span class="text-primary">つながる</span>',
                    heroSubtitle: 'ひとつの好奇心を、どこまでも。',
                    ctaExplore: '探索する',
                    placeholder: '無限の知識を探索…',
                    footerCopy: `© ${new Date().getFullYear()} NODUS. 知のつながりを探索する。`,
                    footerGraph: 'グラフ',
                    footerExplorer: 'エクスプローラー',
                }
            };

            const pillMap = {
                en: {
                    'Black Holes': 'Black Holes',
                    'Evolution': 'Evolution',
                    'Industrial Revolution': 'Industrial Revolution',
                    'Neural Networks': 'Neural Networks',
                    'Quantum Mechanics': 'Quantum Mechanics'
                },
                zh: {
                    'Black Holes': '黑洞',
                    'Evolution': '演化',
                    'Industrial Revolution': '工業革命',
                    'Neural Networks': '神經網路',
                    'Quantum Mechanics': '量子力學'
                },
                ja: {
                    'Black Holes': 'ブラックホール',
                    'Evolution': '進化',
                    'Industrial Revolution': '産業革命',
                    'Neural Networks': 'ニューラルネットワーク',
                    'Quantum Mechanics': '量子力学'
                }
            };

            const pillTooltipMap = {
                en: {
                    domains: {
                        PHY: 'PHY / Physics',
                        BIO: 'BIO / Biology',
                        HIS: 'HIS / History',
                        TEC: 'TEC / Technology'
                    },
                    topics: {
                        blackHoles: 'Start from gravity, stars, and spacetime to see how collapse creates black holes.',
                        evolution: 'Follow heredity, variation, and natural selection to understand how species change.',
                        industrialRevolution: 'Trace machines, factories, and labor shifts to see how industry reshaped society.',
                        neuralNetworks: 'Connect linear algebra, optimization, and pattern recognition to modern AI models.',
                        quantumMechanics: 'Move from atoms and waves to probability, uncertainty, and quantum behavior.'
                    }
                },
                zh: {
                    domains: {
                        PHY: 'PHY / 物理',
                        BIO: 'BIO / 生物',
                        HIS: 'HIS / 歷史',
                        TEC: 'TEC / 科技'
                    },
                    topics: {
                        blackHoles: '從重力、恆星與時空開始，理解坍縮如何形成黑洞。',
                        evolution: '沿著遺傳、變異與自然選擇的脈絡，理解物種如何改變。',
                        industrialRevolution: '從機器、工廠到勞動轉變，看到工業如何重塑社會。',
                        neuralNetworks: '把線性代數、最佳化與模式辨識串起來，理解現代 AI 模型。',
                        quantumMechanics: '從原子與波動出發，走向機率、不確定性與量子行為。'
                    }
                },
                ja: {
                    domains: {
                        PHY: 'PHY / 物理',
                        BIO: 'BIO / 生物',
                        HIS: 'HIS / 歴史',
                        TEC: 'TEC / 技術'
                    },
                    topics: {
                        blackHoles: '重力、恒星、時空から出発して、崩壊がどのようにブラックホールを生むかをたどります。',
                        evolution: '遺伝、変異、自然選択をつなげて、種がどう変化するかを理解します。',
                        industrialRevolution: '機械、工場、労働の変化を追って、産業化が社会をどう変えたかを見ます。',
                        neuralNetworks: '線形代数、最適化、パターン認識を結びつけ、現代の AI モデルへつなげます。',
                        quantumMechanics: '原子と波から始めて、確率、不確定性、量子のふるまいへ進みます。'
                    }
                }
            };

            const langCopy = copy[lang] || copy.en;
            const tooltipCopy = pillTooltipMap[lang] || pillTooltipMap.en;
            heroKicker.textContent = langCopy.heroKicker;
            heroTitle.innerHTML = langCopy.heroTitle;
            heroSubtitle.textContent = langCopy.heroSubtitle;
            ctaExplore.textContent = langCopy.ctaExplore;
            searchInput.placeholder = langCopy.placeholder;
            if (footerCopy) footerCopy.textContent = langCopy.footerCopy;
            if (footerGraphLink) footerGraphLink.textContent = langCopy.footerGraph;
            if (footerExplorerLink) footerExplorerLink.textContent = langCopy.footerExplorer;
            langToggle.querySelectorAll('.lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === lang);
            });

            document.querySelectorAll('.pill-label').forEach(el => {
                if (!el.dataset.en) {
                    el.dataset.en = el.textContent;
                }
                const base = el.dataset.en;
                el.textContent = (pillMap[lang] && pillMap[lang][base]) || base;
            });

            document.querySelectorAll('.pill-btn').forEach(btn => {
                const label = btn.querySelector('.pill-label');
                const topic = btn.dataset.topic;
                const domain = btn.dataset.domain;
                btn.dataset.tooltipDomain = (tooltipCopy.domains && tooltipCopy.domains[domain]) || domain || '';
                btn.dataset.tooltipTitle = label ? label.textContent : '';
                btn.dataset.tooltipBody = (tooltipCopy.topics && tooltipCopy.topics[topic]) || '';
            });

            if (activeTooltipButton) showPillTooltip(activeTooltipButton);

            const query = searchInput.value.trim();
            if (query.length >= 2) {
                renderResults(search(query));
            }
        }

        // ─── Init ────────────────────────────────────────────────────────
        document.documentElement.lang = htmlLang(lang);
        localStorage.setItem('nodus-lang', lang);
        Promise.all([loadData(), loadI18n(lang)]).then(() => {
            applyLang();
        });

        // ─── Particle Canvas ─────────────────────────────────────────────
        const canvas = document.getElementById('particleCanvas');
        const ctx = canvas.getContext('2d');

        let width, height;
        let particles = [];
        const colors = ['#5b9bd5', '#f59e0b', '#10b981', '#f0c050'];

        let mouse = { x: null, y: null, radius: 150 };

        window.addEventListener('mousemove', function (event) {
            // 用相對 canvas 的座標，修正 body `m-4`（16px）邊距造成的排斥偏移。
            const rect = canvas.getBoundingClientRect();
            mouse.x = event.clientX - rect.left;
            mouse.y = event.clientY - rect.top;
        });

        window.addEventListener('mouseout', function () {
            mouse.x = undefined;
            mouse.y = undefined;
        });

        function resize() {
            // 以 canvas 實際版面尺寸（CSS px）為準，並依 devicePixelRatio 放大繪圖緩衝，
            // 讓高 DPI 螢幕的粒子與連線銳利；繪圖座標仍用 CSS px。
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        class Particle {
            constructor() {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * Math.min(width, height) * (Math.random() > 0.3 ? 0.3 : 0.8);

                this.x = width / 2 + Math.cos(angle) * radius;
                this.y = height / 2 + Math.sin(angle) * radius;
                this.size = Math.random() * 1.5 + 0.5;
                this.baseX = this.x;
                this.baseY = this.y;
                this.density = (Math.random() * 30) + 1;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.vx = (Math.random() - 0.5) * 0.1;
                this.vy = (Math.random() - 0.5) * 0.1;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.globalAlpha = 0.6;
                ctx.fill();
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;

                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    let forceDirectionX = dx / distance;
                    let forceDirectionY = dy / distance;
                    let maxDistance = mouse.radius;
                    let force = (maxDistance - distance) / maxDistance;
                    let directionX = forceDirectionX * force * this.density;
                    let directionY = forceDirectionY * force * this.density;

                    if (distance < mouse.radius) {
                        this.x -= directionX * 0.05;
                        this.y -= directionY * 0.05;
                    }
                }
            }
        }

        function init() {
            resize();
            particles = [];
            let numberOfParticles = (width * height) / 12000;
            if (numberOfParticles > 150) numberOfParticles = 150;

            for (let i = 0; i < numberOfParticles; i++) {
                particles.push(new Particle());
            }
        }

        function connect() {
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    let distance = ((particles[a].x - particles[b].x) * (particles[a].x - particles[b].x))
                        + ((particles[a].y - particles[b].y) * (particles[a].y - particles[b].y));
                    if (distance < (width / 7) * (height / 7)) {
                        let opacityValue = 1 - (distance / 20000);
                        ctx.strokeStyle = `rgba(196, 198, 206, ${opacityValue * 0.15})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
            }
        }

        function drawFrame() {
            ctx.clearRect(0, 0, width, height);
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }
            connect();
        }

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let rafId = null;

        function animate() {
            drawFrame();
            rafId = requestAnimationFrame(animate);
        }

        function startAnimation() {
            if (rafId != null) return;
            if (reduceMotion.matches) {
                drawFrame();   // 尊重 reduced-motion：靜態繪一次，不啟動迴圈
                return;
            }
            animate();
        }

        function stopAnimation() {
            if (rafId != null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }

        // 分頁隱藏時暫停動畫，省電省效能（手機友善）。
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAnimation();
            } else {
                startAnimation();
            }
        });

        // reduced-motion 偏好切換時即時反應。
        reduceMotion.addEventListener('change', () => {
            stopAnimation();
            startAnimation();
        });

        window.addEventListener('resize', () => {
            init();
            if (reduceMotion.matches && rafId == null) drawFrame();  // 靜態模式下重繪
        });
        init();
        startAnimation();
