import * as d3 from 'd3';

// ===== I18N =====
// All translation data lives in ./i18n.js (which re-exports ./i18n/{lang}.js).
import { I18N, isValidLang, getLang, TAG_LABELS, TAG_TOKEN_ZH, TAG_TOKEN_JA } from './i18n.js';

let LANG = getLang();
function t(key) { return I18N[LANG][key] || I18N['en'][key] || key; }

function localizeTag(tag) {
    const mapped = TAG_LABELS[LANG] && TAG_LABELS[LANG][tag];
    if (mapped) return mapped;

    const centuryMatch = tag.match(/^(\d{1,2})th_century$/);
    if (centuryMatch) {
        if (LANG === 'zh') return `${centuryMatch[1]}世紀`;
        if (LANG === 'ja') return `${centuryMatch[1]}世紀`;
    }

    if (LANG === 'en') {
        return humanizeTag(tag);
    }

    if (LANG === 'zh') {
        const rangeMatch = tag.match(/^(\d+)bce_to_(\d+)ce$/);
        if (rangeMatch) {
            return `${rangeMatch[1]}公元前至${rangeMatch[2]}公元`;
        }
        const tokens = tag.split('_').filter(Boolean);
        const converted = tokens.map((token) => TAG_TOKEN_ZH[token] || token);
        if (converted.every((value, idx) => value === tokens[idx])) {
            return humanizeTag(tag);
        }
        return converted.join('');
    }

    if (LANG === 'ja') {
        const rangeMatch = tag.match(/^(\d+)bce_to_(\d+)ce$/);
        if (rangeMatch) {
            return `紀元前${rangeMatch[1]}年から紀元${rangeMatch[2]}年`;
        }
        const tokens = tag.split('_').filter(Boolean);
        const converted = tokens.map((token) => TAG_TOKEN_JA[token] || token);
        if (converted.every((value, idx) => value === tokens[idx])) {
            return humanizeTag(tag);
        }
        return converted.join('');
    }

    return humanizeTag(tag);
}

function humanizeTag(tag) {
    return String(tag)
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function sectionLabel(kind) {
    const labels = {
        en: { definition: 'Definition', applications: 'Applications', theory: 'Theory' },
        zh: { definition: '定義', applications: '應用', theory: '理論' },
        ja: { definition: '定義', applications: '応用', theory: '理論' },
    };
    const set = labels[LANG] || labels.en;
    return set[kind] || kind;
}

function renderPanelDescription(node) {
    const raw = nodeDescription(node).trim();
    if (!raw) return '';
    const html = escHtml(raw)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>');
    return `<p>${html}</p>`;
}

async function setLang(lang) {
    if (!isValidLang(lang)) return;
    LANG = lang;
    localStorage.setItem('nodus-lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;
    // Load/clear label translations
    if (lang !== 'en') {
        try {
            labelMap = await window.NodusApi.fetchLocaleLabels(lang);
        } catch (e) { labelMap = {}; }
    } else {
        labelMap = {};
    }
    if (lang !== 'en') {
        try {
            descriptionMap = await window.NodusApi.fetchLocaleDescriptions(lang);
        } catch (e) {
            descriptionMap = {};
        }
    } else {
        descriptionMap = {};
    }
    rebuildSearchIndex();
    applyI18n();
    // Update graph node labels
    if (nodeEls) nodeEls.select('text').text(d => nodeLabel(d));
}

function applyI18n() {
    document.querySelector('#hdr h1').textContent = t('title');
    document.getElementById('search-input').placeholder = t('searchPlaceholder');
    document.getElementById('search-results').setAttribute('aria-label', t('searchResultsLabel'));
    document.getElementById('lp-btn').lastChild.textContent = t('learningPath');
    const helpBtnLabel = document.getElementById('help-btn-label');
    if (helpBtnLabel) helpBtnLabel.textContent = t('helpButton');
    document.getElementById('p-search').textContent = t('searchOnGoogle');
    const lpActionBtn = document.getElementById('p-lp-action');
    if (lpActionBtn) {
        if (currentPanelNodeId && nodeMap[currentPanelNodeId]) {
            updatePanelLearningControls(nodeMap[currentPanelNodeId]);
        } else {
            lpActionBtn.textContent = t('addToLearningPath');
        }
    }
    const nextStep = document.getElementById('p-next-step');
    if (nextStep && !currentPanelNodeId) {
        nextStep.textContent = t('nextStepWillAppear');
    }
    document.querySelector('#p-prereqs h4').textContent = t('prerequisites');
    document.querySelector('#p-unlocks h4').textContent = t('unlocks');
    document.querySelector('#p-conns h3').textContent = t('allConnections');
    // Legend
    const legendItems = document.querySelectorAll('#legend .li');
    const legendKeys = ['logical', 'historical', 'applied', 'conceptual', 'causal', 'prerequisite'];
    legendItems.forEach((li, i) => { if (legendKeys[i]) li.lastChild.textContent = t(legendKeys[i]); });
    // Filter bar — update ALL + domain labels
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const d = btn.dataset.domain;
        if (d) {
            btn.textContent = domainLabel(d);
            btn.title = filterControlLabel(d);
            btn.setAttribute('aria-label', filterControlLabel(d));
        }
    });
    refreshFilterButtonStyles();
    // Welcome text
    const welcomeTextEl = document.getElementById('welcome-text');
    if (welcomeTextEl) welcomeTextEl.textContent = t('welcomeText');
    const onboardStep = document.getElementById('app-onboard-step');
    if (onboardStep) onboardStep.textContent = `${t('appGuideStepLabel')} ${guideStepIndex + 1}/${GUIDE_STEPS.length}`;
    const onboardTitle = document.getElementById('app-onboard-title');
    if (onboardTitle) onboardTitle.textContent = t('appGuideTitle');
    const onboard1 = document.getElementById('app-onboard-item-1');
    if (onboard1) onboard1.textContent = t('appGuideStep1');
    const onboard2 = document.getElementById('app-onboard-item-2');
    if (onboard2) onboard2.textContent = t('appGuideStep2');
    const onboard3 = document.getElementById('app-onboard-item-3');
    if (onboard3) onboard3.textContent = t('appGuideStep3');
    const onboardDismiss = document.getElementById('app-onboard-dismiss');
    if (onboardDismiss) onboardDismiss.textContent = t('appGuideDismiss');
    const onboardNext = document.getElementById('app-onboard-next');
    if (onboardNext) onboardNext.textContent = guideStepIndex === GUIDE_STEPS.length - 1 ? t('appGuidePrimary') : t('appGuideNext');
    const shortcutsKicker = document.getElementById('shortcuts-kicker');
    if (shortcutsKicker) shortcutsKicker.textContent = t('shortcutsKicker');
    const shortcutsTitle = document.getElementById('shortcuts-title');
    if (shortcutsTitle) shortcutsTitle.textContent = t('shortcutsTitle');
    const shortcutsIntro = document.getElementById('shortcuts-intro');
    if (shortcutsIntro) shortcutsIntro.textContent = t('shortcutsIntro');
    const shortcutSearch = document.getElementById('shortcut-search-label');
    if (shortcutSearch) shortcutSearch.textContent = t('shortcutSearch');
    const shortcutHelp = document.getElementById('shortcut-help-label');
    if (shortcutHelp) shortcutHelp.textContent = t('shortcutHelp');
    const shortcutEscape = document.getElementById('shortcut-escape-label');
    if (shortcutEscape) shortcutEscape.textContent = t('shortcutEscape');
    const shortcutLp = document.getElementById('shortcut-lp-label');
    if (shortcutLp) shortcutLp.textContent = t('shortcutLp');
    const shortcutDismiss = document.getElementById('shortcuts-close');
    if (shortcutDismiss) shortcutDismiss.textContent = t('shortcutDismiss');
    // Stats
    if (allNodes.length) {
        document.getElementById('stats').textContent = `${allNodes.length} ${t('nodes')} \u00b7 ${allEdges.length} ${t('edges')} \u00b7 ${prereqEdges.length} ${t('prereqs')}`;
    }
    // Lang toggle active state
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === LANG));
    // Update learned info if visible
    if (lpMode) updateLearnedInfo();

    // Re-render panel content so localized descriptions/tags apply immediately.
    if (currentPanelNodeId && nodeMap[currentPanelNodeId]) {
        openPanel(nodeMap[currentPanelNodeId]);
    }
}

function setLoadingState(message, isError = false, showRetry = false) {
    const loading = document.getElementById('loading');
    const text = document.getElementById('loading-text');
    const retry = document.getElementById('loading-retry');
    text.textContent = message;
    text.style.color = isError ? '#fda4af' : '#94a7bf';
    retry.style.display = showRetry ? 'inline-block' : 'none';
    loading.style.display = 'block';
}

function hideLoadingState() {
    document.getElementById('loading').style.display = 'none';
    // Show welcome overlay only if no node is pre-selected
    const params = new URLSearchParams(window.location.search);
    const welcomeEl = document.getElementById('welcome-overlay');
    if (welcomeEl && (params.get('node') || params.get('search'))) {
        dismissWelcomeOverlay();
    } else if (welcomeEl) {
        // Auto-dismiss after 12 seconds
        setTimeout(() => dismissWelcomeOverlay(), 12000);
    }
}

// ===== CONSTANTS =====
const DC = window.NodusTokens?.DOMAIN_COLORS || { MAT: '#5b9bd5', PHY: '#c97a5b', CHE: '#c9c05b', BIO: '#5bc97a', MED: '#5bc9b8', ENG: '#9b7bc9', TEC: '#c95b9b', SOC: '#c9a05a', HUM: '#7ba5c9', PHI: '#9bc95b', ART: '#c95b5b', HIS: '#a07850' };
const RC = window.NodusTokens?.RELATION_COLORS || { logical: '#5b9bd5', historical: '#c9a05a', applied: '#5bc97a', conceptual: '#9b7bc9', causal: '#c95b5b' };
const TYPE_SIZE = { field: 16, concept: 6, person: 9, event: 11 };

let allNodes = [], allEdges = [], nodeMap = {}, sim, nodeEls, linkEls, g, svgEl, zoomBehavior;
let focusCurveEls, focusCurveG;
let linkNodeRefs = [];
let activeFilter = null;
let lpMode = false;
let learnedSet = new Set();
let prereqEdges = [];
let prereqGraph = { parents: {}, children: {} };
let navHistory = [];
let currentZoom = 1;
let labelMap = {};
let descriptionMap = {};
let enDescriptionMap = {}; // English descriptions loaded from /api/graph/descriptions
let _searchIndex = null; // Pre-built lowercase index for fast search
let currentPanelNodeId = null;
let relatedLabelIds = new Set();
const EDGE_CURVE_DISTANCE_FACTOR = 0.18;
const EDGE_CURVE_MIN_OFFSET = 10;
const EDGE_CURVE_MAX_OFFSET = 42;
const TOP_CHROME_EXPAND_DELAY = 90;
const TOP_CHROME_COLLAPSE_DELAY = 260;
const NAV_HISTORY_STORAGE_KEY = 'nodus-nav-history-v1';
const APP_ONBOARD_STORAGE_KEY = 'nodus-app-onboard-seen-v1';
let guideBindingsReady = false;
let guideStepIndex = 0;

const GUIDE_STEPS = [
    { targetId: 'search-box' },
    { targetId: 'canvas' },
    { targetId: 'mode-toggle' },
];

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function dismissWelcomeOverlay() {
    const welcomeEl = document.getElementById('welcome-overlay');
    if (welcomeEl) welcomeEl.classList.add('hidden');
}

function setGuideVisibility(id, visible) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('visible', visible);
    el.setAttribute('aria-hidden', String(!visible));
}

function closeAppOnboard(markSeen = true) {
    setGuideVisibility('app-onboard', false);
    document.querySelectorAll('.guide-target-highlight').forEach(el => el.classList.remove('guide-target-highlight'));
    if (markSeen) localStorage.setItem(APP_ONBOARD_STORAGE_KEY, '1');
}

function applyGuideStep(index) {
    guideStepIndex = Math.max(0, Math.min(GUIDE_STEPS.length - 1, index));
    document.querySelectorAll('#app-onboard-list li').forEach((el, idx) => {
        el.classList.toggle('is-active', idx === guideStepIndex);
    });
    document.querySelectorAll('.guide-target-highlight').forEach(el => el.classList.remove('guide-target-highlight'));
    const step = GUIDE_STEPS[guideStepIndex];
    const target = step ? document.getElementById(step.targetId) : null;
    if (target) target.classList.add('guide-target-highlight');

    const label = document.getElementById('app-onboard-step');
    if (label) label.textContent = `${t('appGuideStepLabel')} ${guideStepIndex + 1}/${GUIDE_STEPS.length}`;

    const nextBtn = document.getElementById('app-onboard-next');
    if (nextBtn) nextBtn.textContent = guideStepIndex === GUIDE_STEPS.length - 1 ? t('appGuidePrimary') : t('appGuideNext');
}

function advanceGuideStep() {
    if (guideStepIndex >= GUIDE_STEPS.length - 1) {
        closeAppOnboard(true);
        return;
    }
    applyGuideStep(guideStepIndex + 1);
}

function openShortcutsModal() {
    closeAppOnboard(false);
    setGuideVisibility('shortcuts-modal', true);
}

function closeShortcutsModal() {
    setGuideVisibility('shortcuts-modal', false);
}

function setupGuides() {
    const helpBtn = document.getElementById('help-btn');
    const onboardDismiss = document.getElementById('app-onboard-dismiss');
    const onboardNext = document.getElementById('app-onboard-next');
    const shortcutsClose = document.getElementById('shortcuts-close');
    const searchInput = document.getElementById('search-input');

    if (!guideBindingsReady) {
        helpBtn?.addEventListener('click', () => {
            const modal = document.getElementById('shortcuts-modal');
            if (modal && modal.classList.contains('visible')) closeShortcutsModal();
            else openShortcutsModal();
        });
        onboardDismiss?.addEventListener('click', () => closeAppOnboard(true));
        onboardNext?.addEventListener('click', () => advanceGuideStep());
        shortcutsClose?.addEventListener('click', () => closeShortcutsModal());
        document.addEventListener('keydown', (e) => {
            const typing = isTypingTarget(document.activeElement);
            if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '/' || e.key.toLowerCase() === 'f')) {
                e.preventDefault();
                searchInput?.focus();
                searchInput?.select?.();
                return;
            }
            if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === '?') {
                e.preventDefault();
                const modal = document.getElementById('shortcuts-modal');
                if (modal && modal.classList.contains('visible')) closeShortcutsModal();
                else openShortcutsModal();
                return;
            }
            if (e.key === 'Escape') {
                closeShortcutsModal();
                closeAppOnboard(true);
            }
        });
        guideBindingsReady = true;
    }

    const params = new URLSearchParams(window.location.search);
    const seen = localStorage.getItem(APP_ONBOARD_STORAGE_KEY) === '1';
    if (!seen && !params.get('node') && !params.get('search')) {
        dismissWelcomeOverlay();
        setGuideVisibility('app-onboard', true);
        applyGuideStep(0);
    }
}

function isSafeNodeId(id) {
    return window.NodusState.isSafeNodeId(id);
}

function parseLearnedSet(rawValue) {
    return window.NodusState.parseLearnedSet(rawValue, nodeMap);
}

function normalizeGraphData(data) {
    return window.NodusApi.normalizeGraphData(data);
}

function sleep(ms) {
    return window.NodusApi.sleep(ms);
}

async function fetchJsonWithRetry(url, retries = 2) {
    return window.NodusApi.fetchJsonWithRetry(url, retries);
}

async function loadGraphData() {
    return window.NodusApi.loadGraphData();
}

function nodeLabel(n) {
    if (LANG !== 'en' && labelMap[n.id]) return labelMap[n.id];
    return n.label;
}

function nodeDescription(n) {
    if (!n) return '';
    if (LANG !== 'en' && descriptionMap[n.id]) return descriptionMap[n.id];
    return n.description || enDescriptionMap[n.id] || '';
}

function rebuildSearchIndex() {
    _searchIndex = allNodes.map(n => ({
        node: n,
        label: nodeLabel(n).toLowerCase(),
        fallbackLabel: (n.label || '').toLowerCase(),
        id: (n.id || '').toLowerCase(),
        tags: (n.display_tags || []).join(' ').toLowerCase(),
        desc: nodeDescription(n).toLowerCase(),
        domains: (n.domain || []).map(d => d.toLowerCase()),
    }));
}

function edgeKey(source, target) {
    return `${source}->${target}`;
}

function saveNavHistory() {
    try {
        sessionStorage.setItem(NAV_HISTORY_STORAGE_KEY, JSON.stringify(navHistory.slice(-10)));
    } catch (e) {
        // Ignore storage quota or unavailable storage errors.
    }
}

function loadNavHistory() {
    try {
        const raw = sessionStorage.getItem(NAV_HISTORY_STORAGE_KEY);
        if (!raw) {
            navHistory = [];
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            navHistory = [];
            return;
        }
        navHistory = parsed
            .filter((id) => typeof id === 'string' && isSafeNodeId(id) && !!nodeMap[id])
            .slice(-10);
    } catch (e) {
        navHistory = [];
    }
}

// ===== INIT =====
async function init() {
    // Setup lang toggle
    document.getElementById('lang-toggle').addEventListener('click', e => {
        const btn = e.target.closest('.lang-btn');
        if (btn) setLang(btn.dataset.lang);
    });
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === LANG));
    setLoadingState(t('loading'));

    document.getElementById('loading-retry').onclick = () => {
        setLoadingState(t('loading'));
        init();
    };

    // Load translations if not English
    if (LANG !== 'en') {
        try {
            labelMap = await window.NodusApi.fetchLocaleLabels(LANG);
        } catch (e) { /* fallback to English labels */ }
    }
    if (LANG !== 'en') {
        try {
            descriptionMap = await window.NodusApi.fetchLocaleDescriptions(LANG);
        } catch (e) {
            descriptionMap = {};
        }
    }

    // Load the graph topology first so the constellation can render as soon as
    // possible. The heavier English descriptions are split into their own payload
    // and streamed in afterwards (see the enrichment call at the end of init).
    let data;
    try {
        setLoadingState(t('loadingGraph'));
        data = await loadGraphData();
    } catch (e) {
        setLoadingState('Unable to load graph data. Please retry.', true, true);
        return;
    }
    const raw = data.nodes;

    const idSet = new Set(raw.map(n => n.id));
    allNodes = raw.map(n => ({ ...n }));
    nodeMap = Object.fromEntries(allNodes.map(n => [n.id, n]));

    // Pre-build search index (lowercase once, avoid repeated .toLowerCase() per keystroke)
    setLoadingState(t('loadingIndex'));
    rebuildSearchIndex();

    // Use API edges directly, or build from connections as fallback
    if (data.edges && data.edges.length > 0) {
        allEdges = data.edges.map(e => ({
            source: e.source, target: e.target,
            relation_type: e.relation_type,
            pending: e.pending || false,
            learning_prerequisite: e.learning_prerequisite || false,
            directed: e.directed || false
        }));
    } else {
        const edgeSet = new Set();
        allEdges = [];
        for (const n of raw) {
            for (const c of (n.connections || [])) {
                if (!idSet.has(c.target)) continue;
                const key = [n.id, c.target].sort().join('|') + c.relation_type;
                if (edgeSet.has(key)) continue;
                edgeSet.add(key);
                allEdges.push({
                    source: n.id, target: c.target,
                    relation_type: c.relation_type,
                    pending: c.pending || false,
                    learning_prerequisite: c.learning_prerequisite || false,
                    directed: c.directed || false
                });
            }
        }
    }

    // Build prerequisite graph
    buildPrereqGraph(raw);

    // Restore session breadcrumb history
    loadNavHistory();
    renderBreadcrumb();

    // Load learning progress
    await loadLearningProgress();

    setLoadingState(t('loadingRender'));
    hideLoadingState();
    document.getElementById('stats').textContent = allNodes.length + ' ' + t('nodes') + ' \u00b7 ' + allEdges.length + ' ' + t('edges') + ' \u00b7 ' + prereqEdges.length + ' ' + t('prereqs');

    buildFilters();
    setupTopChrome();
    buildGraph();
    setupSearch();
    setupLPMode();
    applyI18n();
    setupGuides();

    // Stream English descriptions in after the graph is interactive. Until they
    // land, label/id/tag/domain search all work; once they arrive we re-index so
    // full-text search lights up and refresh any panel that's already open.
    window.NodusApi.fetchGraphDescriptions().then((map) => {
        enDescriptionMap = map || {};
        rebuildSearchIndex();
        if (currentPanelNodeId && nodeMap[currentPanelNodeId]) openPanel(nodeMap[currentPanelNodeId]);
    }).catch(() => { /* descriptions are non-critical */ });
}

function setupTopChrome() {
    const trigger = document.getElementById('top-chrome-trigger');
    const searchBox = document.getElementById('search-box');
    const filterBar = document.getElementById('filter-bar');
    const hdr = document.getElementById('hdr');
    const langToggle = document.getElementById('lang-toggle');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    if (!trigger || !searchBox || !filterBar || !hdr || !langToggle) return;

    const pointerSupportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hoverNoneQuery = window.matchMedia('(hover: none)');
    const desktopQuery = window.matchMedia('(min-width: 761px)');
    const proximityEnabled = () => {
        if (!desktopQuery.matches) return false;
        if (pointerSupportsHover) return true;
        // Fallback for browsers that report hover capability conservatively on desktop.
        return !hoverNoneQuery.matches;
    };

    const interactiveAreas = [trigger, searchBox, filterBar, hdr, langToggle];
    let handlersBound = false;
    let expandTimer = null;
    let collapseTimer = null;

    const clearTimers = () => {
        if (expandTimer) { clearTimeout(expandTimer); expandTimer = null; }
        if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
    };

    const shouldStayExpanded = () => {
        if (searchInput === document.activeElement) return true;
        if (searchResults && searchResults.style.display === 'block') return true;
        return false;
    };

    const setCollapsed = (collapsed) => {
        document.body.classList.toggle('top-ui-collapsed', collapsed);
        trigger.setAttribute('aria-expanded', String(!collapsed));
    };

    const scheduleExpand = () => {
        if (!proximityEnabled()) return;
        if (expandTimer) clearTimeout(expandTimer);
        if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
        expandTimer = setTimeout(() => setCollapsed(false), TOP_CHROME_EXPAND_DELAY);
    };

    const scheduleCollapse = () => {
        if (!proximityEnabled()) return;
        if (shouldStayExpanded()) return;
        if (collapseTimer) clearTimeout(collapseTimer);
        if (expandTimer) { clearTimeout(expandTimer); expandTimer = null; }
        collapseTimer = setTimeout(() => {
            if (!shouldStayExpanded()) setCollapsed(true);
        }, TOP_CHROME_COLLAPSE_DELAY);
    };

    const bindHandlers = () => {
        if (handlersBound) return;
        interactiveAreas.forEach((el) => {
            el.addEventListener('pointerenter', scheduleExpand);
            el.addEventListener('pointerleave', scheduleCollapse);
        });
        searchInput.addEventListener('focus', scheduleExpand);
        searchInput.addEventListener('blur', () => setTimeout(scheduleCollapse, 120));
        handlersBound = true;
    };

    const unbindHandlers = () => {
        if (!handlersBound) return;
        interactiveAreas.forEach((el) => {
            el.removeEventListener('pointerenter', scheduleExpand);
            el.removeEventListener('pointerleave', scheduleCollapse);
        });
        searchInput.removeEventListener('focus', scheduleExpand);
        handlersBound = false;
    };

    const syncMode = () => {
        clearTimers();
        if (!proximityEnabled()) {
            unbindHandlers();
            setCollapsed(false);
            return;
        }
        bindHandlers();
        setCollapsed(true);
    };

    if (typeof desktopQuery.addEventListener === 'function') {
        desktopQuery.addEventListener('change', syncMode);
    } else if (typeof desktopQuery.addListener === 'function') {
        desktopQuery.addListener(syncMode);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') scheduleCollapse();
    });

    syncMode();
}

function buildPrereqGraph(raw) {
    const built = window.NodusGraph.buildPrerequisiteGraph(raw, nodeMap);
    prereqEdges = built.prereqEdges;
    prereqGraph = built.prereqGraph;
}

// ===== FILTERS =====
function domainLabel(d) {
    if (d === 'ALL') return t('filterAll');
    return t('domain' + d) || d;
}

function domainFullLabel(d) {
    if (d === 'ALL') return t('filterAll');
    return t('domainFull' + d) || domainLabel(d);
}

function filterControlLabel(d) {
    const short = domainLabel(d);
    const full = domainFullLabel(d);
    if (d === 'ALL' || short === full) return full;
    return `${short} - ${full}`;
}

function refreshFilterButtonStyles() {
    const activeDomain = activeFilter || 'ALL';
    document.querySelectorAll('.filter-btn').forEach((btn) => {
        const d = btn.dataset.domain;
        if (!d) return;
        const baseColor = btn.dataset.baseColor || (d === 'ALL' ? '#c8d0dc' : (DC[d] || '#556'));
        btn.style.color = d === activeDomain ? '#f7db95' : baseColor;
        btn.title = filterControlLabel(d);
        btn.setAttribute('aria-label', filterControlLabel(d));
    });
}

function buildFilters() {
    const bar = document.getElementById('filter-bar');
    const domains = ['ALL', 'MAT', 'PHY', 'CHE', 'BIO', 'MED', 'ENG', 'TEC', 'SOC', 'HUM', 'PHI', 'ART', 'HIS'];
    domains.forEach(d => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn' + (d === 'ALL' ? ' active' : '');
        btn.textContent = domainLabel(d);
        btn.dataset.baseColor = d === 'ALL' ? '#c8d0dc' : (DC[d] || '#556');
        btn.style.color = btn.dataset.baseColor;
        btn.title = filterControlLabel(d);
        btn.setAttribute('aria-label', filterControlLabel(d));
        btn.dataset.domain = d;
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = d === 'ALL' ? null : d;
            refreshFilterButtonStyles();
            applyVisibility();
        };
        bar.appendChild(btn);
    });
    refreshFilterButtonStyles();
}

function applyVisibility() {
    if (lpMode) { applyLPVisibility(); return; }
    if (!activeFilter) {
        nodeEls.classed('dimmed', false);
        linkEls.classed('dimmed-link', false);
        refreshFocusCurves();
        return;
    }
    const visible = new Set(allNodes.filter(n => n.domain.includes(activeFilter)).map(n => n.id));
    nodeEls.classed('dimmed', d => !visible.has(d.id));
    linkEls.classed('dimmed-link', d => !(visible.has(d.source.id) && visible.has(d.target.id)));
    refreshFocusCurves();
}

// ===== GRAPH =====
function nc(n) { return DC[n.domain[0]] || '#888' }
function nr(n) { return TYPE_SIZE[n.type] || 6 }

// ── Star rendering (visual only — fully decoupled from physics) ──────────────
// hex "#rrggbb" + alpha → "rgba(...)". Used to author the layered star gradients.
function hexA(hex, a) {
    const n = parseInt(String(hex).slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Per-node star metadata: tier (three magnitudes) + bloom radii for
// core/glow/halo/corona, brightness, and stable twinkle timing.
// Driven by node TYPE + graph DEGREE — this NEVER feeds the force sim
// (collision still uses nr()), so it is safe to retune freely.
let starMeta = {};
function buildStarMeta() {
    const deg = {};
    for (const e of allEdges) {
        const s = e.source.id ?? e.source, t = e.target.id ?? e.target;
        deg[s] = (deg[s] || 0) + 1; deg[t] = (deg[t] || 0) + 1;
    }
    starMeta = {};
    allNodes.forEach((n, i) => {
        const d = deg[n.id] || 0;
        const tier = n.type === 'field' ? 'primary' : (n.type === 'concept' ? 'secondary' : 'minor');
        const degCap = Math.min(d, 8);
        // Tight, real-star compact bloom: mostly darkness with bright pinpricks.
        const size = tier === 'primary' ? {
            core: 4.0 + degCap * 0.28, glow: 15 + degCap * 0.8,
            halo: 30 + degCap * 1.4, corona: 60 + degCap * 2.2,
        } : tier === 'secondary' ? {
            core: 1.8 + degCap * 0.10, glow: 7.0 + degCap * 0.35,
            halo: 15 + degCap * 0.7, corona: 30 + degCap * 1.0,
        } : {
            core: 1.1, glow: 3.4, halo: 7.5, corona: 16,
        };
        // Stable per-star jitter (-0.5…0.5) so brightness/twinkle desync.
        const jitter = ((i * 9301 + 49297) % 233) / 233 - 0.5;
        starMeta[n.id] = {
            ...size, degree: d, tier, jitter,
            baseOp: tier === 'primary' ? 1.0 : tier === 'secondary' ? 0.78 + jitter * 0.12 : 0.42 + jitter * 0.16,
            glowAlpha: tier === 'primary' ? 1.0 : tier === 'secondary' ? 0.86 : 0.62,
            twDur: (6.5 + (i % 7) * 0.9).toFixed(2),
            twDelay: ((i * 0.53) % 6).toFixed(2),
        };
    });
}
function sm(n) { return starMeta[n.id] || { core: nr(n) * 0.3, glow: nr(n), halo: nr(n) * 2, corona: nr(n) * 4, glowAlpha: 0.6, baseOp: 0.8, twDur: '5', twDelay: '0' }; }
function edgeCurveDirection(edge) {
    const s = String(edge.source.id || edge.source || '');
    const t = String(edge.target.id || edge.target || '');
    let hash = 0;
    const key = s < t ? s + '|' + t : t + '|' + s;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    return hash % 2 === 0 ? 1 : -1;
}

function curvedEdgePath(edge) {
    const sx = edge.source.x ?? 0;
    const sy = edge.source.y ?? 0;
    const tx = edge.target.x ?? 0;
    const ty = edge.target.y ?? 0;
    // Cache: reuse last path string if positions haven't moved significantly
    if (edge._cpCache &&
        Math.abs(sx - edge._cpSx) < 0.5 && Math.abs(sy - edge._cpSy) < 0.5 &&
        Math.abs(tx - edge._cpTx) < 0.5 && Math.abs(ty - edge._cpTy) < 0.5) {
        return edge._cpCache;
    }
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const baseOffset = Math.min(EDGE_CURVE_MAX_OFFSET, Math.max(EDGE_CURVE_MIN_OFFSET, dist * EDGE_CURVE_DISTANCE_FACTOR));
    const dir = edgeCurveDirection(edge);
    const cx = (sx + tx) * 0.5 + nx * baseOffset * dir;
    const cy = (sy + ty) * 0.5 + ny * baseOffset * dir;
    const path = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
    edge._cpCache = path; edge._cpSx = sx; edge._cpSy = sy; edge._cpTx = tx; edge._cpTy = ty;
    return path;
}

function refreshFocusCurves() {
    if (!focusCurveG || !linkNodeRefs.length) return;
    // Collect only edges that are highlighted or on prereq path
    const activeEdges = [];
    for (let i = 0; i < linkNodeRefs.length; i++) {
        const el = linkNodeRefs[i];
        if (el && (el.classList.contains('highlight') || el.classList.contains('prereq-path'))) {
            activeEdges.push({ edge: allEdges[i], isPrereq: el.classList.contains('prereq-path') });
        }
    }
    // Remove old curves and create fresh ones for active edges only.
    // Each active edge = a coloured backbone path + a flowing PHOTON overlay,
    // so the lit constellation reads as energy running between its stars.
    focusCurveG.selectAll('*').remove();
    if (activeEdges.length === 0) { focusCurveEls = null; return; }
    // Backbone — keeps the semantic relation colour (shared.css).
    focusCurveG.selectAll('path.focus-curve').data(activeEdges.map(a => a.edge)).enter().append('path')
        .attr('class', (d, i) => {
            const a = activeEdges[i];
            let cls = 'link focus-curve ' + d.relation_type + ' active';
            cls += a.isPrereq ? ' prereq-path' : ' highlight';
            return cls;
        })
        .attr('marker-end', (d, i) => activeEdges[i].isPrereq ? 'url(#arrow)' : null)
        .attr('d', d => curvedEdgePath(d));
    // Photon — a single long luminous dash gliding the edge (CSS-animated).
    focusCurveG.selectAll('path.photon').data(activeEdges.map(a => a.edge)).enter().append('path')
        .attr('class', (d, i) => 'photon' + (activeEdges[i].isPrereq ? ' photon-gold' : ''))
        .style('stroke', (d, i) => activeEdges[i].isPrereq ? '#f7d27d' : (RC[d.relation_type] || '#cfe0f5'))
        .attr('d', d => curvedEdgePath(d));
    // Both path sets carry the edge datum → the existing tick re-paths all of
    // them via `focusCurveEls.attr('d', …)` with no extra per-tick work added.
    focusCurveEls = focusCurveG.selectAll('path');
}

function buildGraph() {
    const W = window.innerWidth, H = window.innerHeight;
    svgEl = d3.select('#canvas').attr('width', W).attr('height', H);
    g = svgEl.append('g');

    // Defs: gradients + glow filter + arrow marker
    const defs = svgEl.append('defs');
    // Radial gradients per domain color (legacy grad-XXX kept for compatibility)
    Object.entries(DC).forEach(([key, color]) => {
        const grad = defs.append('radialGradient').attr('id', 'grad-' + key);
        grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.9);
        grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.25);
    });
    // Layered STAR gradients per domain: core (white-hot body) → glow (tight
    // colored bloom) → halo (mid atmosphere) → corona (faint breathing field).
    function starStops(id, stops) {
        const g = defs.append('radialGradient').attr('id', id).attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
        stops.forEach(([off, col, op]) => {
            const s = g.append('stop').attr('offset', off).attr('stop-color', col);
            if (op != null) s.attr('stop-opacity', op);
        });
    }
    Object.entries(DC).forEach(([key, color]) => {
        starStops('core-' + key, [
            ['0%', '#ffffff', 1], ['22%', '#ffffff', 0.98], ['48%', '#ffffff', 0.78],
            ['70%', hexA(color, 0.55)], ['88%', hexA(color, 0.22)], ['100%', hexA(color, 0)],
        ]);
        starStops('glow-' + key, [
            ['0%', hexA(color, 0.92)], ['24%', hexA(color, 0.58)], ['55%', hexA(color, 0.18)], ['100%', hexA(color, 0)],
        ]);
        starStops('halo-' + key, [
            ['0%', hexA(color, 0.32)], ['38%', hexA(color, 0.13)], ['78%', hexA(color, 0.035)], ['100%', hexA(color, 0)],
        ]);
        starStops('corona-' + key, [
            ['0%', hexA(color, 0)], ['30%', hexA(color, 0.035)], ['65%', hexA(color, 0.012)], ['100%', hexA(color, 0)],
        ]);
    });
    // Glow filter (node legacy)
    const glow = defs.append('filter').attr('id', 'node-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '3').attr('result', 'blur');
    const merge = glow.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
    // Edge glow filter — gives constellation lines their faint fluorescent halo.
    const eglow = defs.append('filter').attr('id', 'edge-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    eglow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '1.4').attr('result', 'eb');
    const emerge = eglow.append('feMerge');
    emerge.append('feMergeNode').attr('in', 'eb');
    emerge.append('feMergeNode').attr('in', 'SourceGraphic');
    // Arrow marker
    defs.append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 20).attr('refY', 5)
        .attr('markerWidth', 6).attr('markerHeight', 6)
        .attr('orient', 'auto-start-reverse')
        .append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('class', 'arrow-marker');

    let _labelRaf = 0;
    zoomBehavior = d3.zoom().scaleExtent([0.1, 6]).on('zoom', e => {
        g.attr('transform', e.transform);
        currentZoom = e.transform.k;
    });
    svgEl.call(zoomBehavior);

    sim = d3.forceSimulation(allNodes)
        .force('link', d3.forceLink(allEdges).id(d => d.id).distance(d => {
            const s = nodeMap[d.source.id || d.source], t = nodeMap[d.target.id || d.target];
            if (s && t && s.type === 'field' && t.type === 'field') return 180;
            if ((s && s.type === 'field') || (t && t.type === 'field')) return 100;
            return 60;
        }).strength(d => {
            const s = nodeMap[d.source.id || d.source], t = nodeMap[d.target.id || d.target];
            if (s && t && s.type === 'field' && t.type === 'field') return 0.3;
            return 0.15;
        }))
        .force('charge', d3.forceManyBody().strength(d => d.type === 'field' ? -600 : -120).theta(0.9))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collision', d3.forceCollide(d => nr(d) + 4))
        .alphaDecay(0.03)
        .alphaMin(0.008)
        .velocityDecay(0.4);

    linkEls = g.append('g').attr('class', 'links').selectAll('line').data(allEdges).enter().append('line')
        .attr('class', d => 'link ' + d.relation_type + (d.pending ? ' pending' : ''));
    linkNodeRefs = linkEls.nodes();

    focusCurveG = g.append('g').attr('class', 'focus-curves');
    focusCurveEls = null;

    nodeEls = g.append('g').attr('class', 'nodes').selectAll('.node').data(allNodes).enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', (e, d) => {
                if (!e.active) sim.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
                d3.select(e.currentTarget).classed('dragging', true);
            })
            .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
            .on('end', (e, d) => {
                if (!e.active) sim.alphaTarget(0);
                d.fx = null;
                d.fy = null;
                d3.select(e.currentTarget).classed('dragging', false);
            }))
        .on('click', (e, d) => { e.stopPropagation(); handleNodeClick(e, d); });

    // Compute star bloom metadata (visual only — never touches the sim).
    buildStarMeta();

    // Invisible hit-area for touch (min 22px radius = 44px target)
    nodeEls.append('circle')
        .attr('class', 'hit')
        .attr('r', d => Math.max(22, nr(d) + 10))
        .style('fill', 'transparent')
        .style('pointer-events', 'all');

    // STAR BODY — stacking outside-in: corona → halo → glow → core → core-hi.
    // All circles centred at (0,0); the node <g> transform carries them, so the
    // tick loop is untouched. The brightness IS the body — no solid disc.
    nodeEls.append('circle')
        .attr('class', 'corona twinkle')
        .attr('r', d => sm(d).corona)
        .style('fill', d => `url(#corona-${d.domain[0]})`)
        .style('pointer-events', 'none')
        .style('animation-duration', d => `${sm(d).twDur}s`)
        .style('animation-delay', d => `${sm(d).twDelay}s`);

    nodeEls.append('circle')
        .attr('class', 'halo')
        .attr('r', d => sm(d).halo)
        .style('fill', d => `url(#halo-${d.domain[0]})`)
        .style('pointer-events', 'none');

    nodeEls.append('circle')
        .attr('class', 'glow')
        .attr('r', d => sm(d).glow)
        .style('fill', d => `url(#glow-${d.domain[0]})`)
        .style('opacity', d => sm(d).glowAlpha)
        .style('pointer-events', 'none');

    nodeEls.append('circle')
        .attr('class', 'core')
        .attr('r', d => sm(d).core)
        .style('fill', d => `url(#core-${d.domain[0]})`)
        .style('pointer-events', 'none');

    // central highlight — guarantees even the smallest star reads as a point of light
    nodeEls.append('circle')
        .attr('class', 'core-hi')
        .attr('r', d => Math.max(0.7, sm(d).core * 0.42))
        .style('fill', '#ffffff')
        .style('pointer-events', 'none');

    // learned/available state mark — a tiny soft tick tucked just outside the core
    nodeEls.append('circle')
        .attr('class', 'state-mark')
        .attr('r', 1.6)
        .attr('cx', d => sm(d).glow * 0.6)
        .attr('cy', d => -sm(d).glow * 0.6)
        .style('pointer-events', 'none');

    nodeEls.append('text')
        .text(d => nodeLabel(d))
        .attr('dy', d => Math.max(sm(d).halo * 0.5, nr(d) + 12))
        .style('font-size', d => d.type === 'field' ? '11px' : '10px')
        .style('fill', '#d4e4fa')
        .style('opacity', d => d.type === 'field' ? 0.7 : 0);

    // Hover labels
    nodeEls.on('mouseenter', (e, d) => {
        d3.select(e.currentTarget).select('text').style('opacity', 0.9);
    }).on('mouseleave', (e, d) => {
        d3.select(e.currentTarget).select('text').style('opacity', shouldShowLabel(d) ? 0.88 : 0);
    });

    const simHint = document.getElementById('sim-hint');
    const simHintText = document.getElementById('sim-hint-text');
    if (simHint && simHintText) {
        simHintText.textContent = t('layoutStabilizing');
        simHint.classList.add('visible');
    }

    // Warm-up: run 30 ticks without rendering to pre-settle node positions
    sim.stop();
    for (let i = 0; i < 30; i++) sim.tick();
    // Apply settled positions to DOM once
    linkEls.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeEls.attr('transform', d => `translate(${d.x},${d.y})`);

    let _tickFrame = null;
    let _perfMode = false;
    let _frameTimes = [];
    let _lastTickTime = 0;
    let _currentTransform = d3.zoomIdentity;
    let _cullTimer = 0;
    // Stars carry a PERMANENT, fixed-size glow: each node group is counter-scaled
    // by 1/k so the star + halo render at a constant apparent size at every zoom
    // level (the bloom is an intrinsic part of the star, not something the zoom
    // grows or shrinks). Pure visual — never affects the sim. Optimised: the
    // per-node pass runs ONLY when the zoom factor k actually changes (panning
    // leaves node sizes untouched, so it does zero per-node work).
    let _nodeScale = 1;
    let _scaleRaf = 0;
    let _lastScaleK = 1;
    const _nodeElArr = nodeEls.nodes();
    const _linkElArr = linkNodeRefs;

    // Allow localStorage override: 'low' forces perf-mode, 'high' disables it
    const _perfOverride = (() => { try { return localStorage.getItem('nodus-perf'); } catch { return null; } })();

    // Viewport culling state
    let _visibleNodes = new Uint8Array(allNodes.length); // 1 = visible
    _visibleNodes.fill(1); // all visible initially

    function getViewBounds() {
        const t = _currentTransform;
        const w = window.innerWidth, h = window.innerHeight;
        // Padding in world coords. Stars are a fixed SCREEN size, so their world
        // footprint grows as 1/k when zoomed out — add a bloom margin (~120 screen
        // px → 120/k world) so edge stars don't pop out while their glow shows.
        const pad = 80 + Math.min(900, 120 / t.k);
        return {
            x0: (-t.x / t.k) - pad,
            y0: (-t.y / t.k) - pad,
            x1: (w - t.x) / t.k + pad,
            y1: (h - t.y) / t.k + pad
        };
    }

    function updateCulling() {
        const b = getViewBounds();
        for (let i = 0; i < allNodes.length; i++) {
            const d = allNodes[i];
            const vis = d.x >= b.x0 && d.x <= b.x1 && d.y >= b.y0 && d.y <= b.y1 ? 1 : 0;
            if (_visibleNodes[i] !== vis) {
                _visibleNodes[i] = vis;
                const el = _nodeElArr[i];
                el.style.display = vis ? '' : 'none';
                // Re-apply the current fixed-size scale on reveal — otherwise a
                // node that was culled across a zoom keeps a stale scale and the
                // star renders at the wrong (often tiny) size = "glow vanished".
                if (vis) el.setAttribute('transform', `translate(${d.x},${d.y}) scale(${_nodeScale})`);
            }
        }
        // Cull links: hide if both endpoints off-screen
        for (let i = 0; i < allEdges.length; i++) {
            const e = allEdges[i];
            const sVis = e.source.x >= b.x0 && e.source.x <= b.x1 && e.source.y >= b.y0 && e.source.y <= b.y1;
            const tVis = e.target.x >= b.x0 && e.target.x <= b.x1 && e.target.y >= b.y0 && e.target.y <= b.y1;
            _linkElArr[i].style.display = (sVis || tVis) ? '' : 'none';
        }
    }

    // Perf-mode: disable expensive visual effects on low-end devices
    function setPerfMode(on) {
        if (_perfMode === on) return;
        _perfMode = on;
        document.documentElement.classList.toggle('perf-mode', on);
    }

    function checkFrameBudget(dt) {
        if (_perfOverride === 'low') { setPerfMode(true); return; }
        if (_perfOverride === 'high') { setPerfMode(false); return; }
        _frameTimes.push(dt);
        if (_frameTimes.length > 10) _frameTimes.shift();
        if (_frameTimes.length < 5) return;
        const avg = _frameTimes.reduce((a, b) => a + b, 0) / _frameTimes.length;
        if (!_perfMode && avg > 28) setPerfMode(true);
        else if (_perfMode && avg < 14 && _frameTimes.length >= 10) setPerfMode(false);
    }

    // Override zoom handler to track transform for culling
    zoomBehavior.on('zoom', e => {
        g.attr('transform', e.transform);
        currentZoom = e.transform.k;
        _currentTransform = e.transform;
        // Constant apparent size: counter-scale by 1/k (clamped for safety).
        // Skip the per-node pass entirely on pan (k unchanged) — sizes are fixed.
        const k = e.transform.k;
        if (k !== _lastScaleK) {
            _lastScaleK = k;
            // 1/k → exact constant size; clamp covers the full [0.1, 6] zoom range.
            _nodeScale = Math.min(12, Math.max(0.15, 1 / k));
            if (!_scaleRaf) {
                _scaleRaf = requestAnimationFrame(() => {
                    const s = _nodeScale;
                    // Update ALL nodes (incl. currently-culled) so a node revealed
                    // later by panning already carries the correct fixed size.
                    for (let i = 0; i < allNodes.length; i++) {
                        const d = allNodes[i];
                        _nodeElArr[i].setAttribute('transform', `translate(${d.x},${d.y}) scale(${s})`);
                    }
                    _scaleRaf = 0;
                });
            }
        }
        if (!_labelRaf) {
            _labelRaf = requestAnimationFrame(() => {
                updateLabelVisibility();
                _labelRaf = 0;
            });
        }
        // Throttled culling on zoom/pan
        clearTimeout(_cullTimer);
        _cullTimer = setTimeout(updateCulling, 60);
    });

    sim.on('tick', () => {
        if (_tickFrame) return;
        _tickFrame = requestAnimationFrame(() => {
            const now = performance.now();
            // Update only visible links
            for (let i = 0; i < allEdges.length; i++) {
                if (_linkElArr[i].style.display === 'none') continue;
                const e = allEdges[i];
                const el = _linkElArr[i];
                el.setAttribute('x1', e.source.x);
                el.setAttribute('y1', e.source.y);
                el.setAttribute('x2', e.target.x);
                el.setAttribute('y2', e.target.y);
            }
            if (focusCurveEls) focusCurveEls.attr('d', d => curvedEdgePath(d));
            // Update only visible nodes
            for (let i = 0; i < allNodes.length; i++) {
                if (!_visibleNodes[i]) continue;
                const d = allNodes[i];
                _nodeElArr[i].setAttribute('transform', `translate(${d.x},${d.y}) scale(${_nodeScale})`);
            }
            // Ease-to-rest: as the layout nears its stopping point (alpha → alphaMin)
            // ramp friction up so residual drift glides to a halt instead of freezing
            // mid-motion. The STOP time is fixed by alphaDecay; this only damps the
            // leftover velocity, so the final layout is unchanged. Auto-resets to the
            // base friction whenever the sim is re-heated (drag / zoom / resize).
            const _a = sim.alpha();
            if (_a < 0.02) {
                const tt = Math.min(1, (0.02 - _a) / (0.02 - 0.008));
                sim.velocityDecay(0.4 + tt * 0.5);   // 0.4 → 0.9 over the last ~0.5s
            } else if (sim.velocityDecay() !== 0.4) {
                sim.velocityDecay(0.4);
            }
            // Frame budget check
            if (_lastTickTime) checkFrameBudget(now - _lastTickTime);
            _lastTickTime = now;
            _tickFrame = null;
        });
    });

    sim.on('end', () => {
        if (!simHint) return;
        simHint.classList.add('fading');
        setTimeout(() => simHint.classList.remove('visible', 'fading'), 520);
        // Run culling once simulation stabilizes
        updateCulling();
    });

    // Resume simulation after warm-up (tick handler now bound)
    sim.restart();

    svgEl.on('click', () => {
        setPanelOpenState(false);
        clearHighlights();
    });

    // Dismiss welcome overlay on first graph interaction
    const _welcomeEl = document.getElementById('welcome-overlay');
    if (_welcomeEl) {
        const _dismissOnWheel = () => {
            dismissWelcomeOverlay();
            svgEl.on('wheel.welcome', null);
        };
        svgEl.on('wheel.welcome', _dismissOnWheel);
    }

    // Resize handler — update SVG dimensions and recenter simulation
    let _resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => {
            const nw = window.innerWidth, nh = window.innerHeight;
            svgEl.attr('width', nw).attr('height', nh);
            sim.force('center', d3.forceCenter(nw / 2, nh / 2));
            sim.alpha(0.1).restart();
        }, 200);
    });
}

// ===== SEMANTIC ZOOM =====
function shouldShowLabel(d) {
    if (relatedLabelIds.has(d.id)) return true;
    if (d.type === 'field') return true;
    if (currentZoom > 1.8 && (d.type === 'event' || d.type === 'person')) return true;
    if (currentZoom > 3) return true;
    if (lpMode && (learnedSet.has(d.id) || isAvailable(d.id))) return true;
    return false;
}

function updateLabelVisibility() {
    if (!nodeEls) return;
    nodeEls
        .classed('related-node', d => relatedLabelIds.has(d.id))
        .select('text')
        .style('opacity', d => shouldShowLabel(d) ? 0.88 : 0);
}

function getRelatedNodeIds(nodeId) {
    const ids = new Set([nodeId]);
    for (const edge of allEdges) {
        const sId = edge.source.id || edge.source;
        const tId = edge.target.id || edge.target;
        if (sId === nodeId) ids.add(tId);
        else if (tId === nodeId) ids.add(sId);
    }
    return ids;
}

// ===== NODE CLICK =====
function handleNodeClick(e, d) {
    if (lpMode && e.shiftKey) {
        toggleLearned(d.id);
        return;
    }
    openPanel(d);
    centerViewOnNode(d, 420);
}

function percentile(sortedValues, p) {
    if (!sortedValues.length) return 0;
    const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * p)));
    return sortedValues[idx];
}

function connectedPointsForNode(nodeId) {
    const points = [];
    for (const edge of allEdges) {
        const sId = edge.source.id || edge.source;
        const tId = edge.target.id || edge.target;
        let neighbor = null;
        if (sId === nodeId) neighbor = nodeMap[tId];
        else if (tId === nodeId) neighbor = nodeMap[sId];
        if (!neighbor) continue;
        if (!Number.isFinite(neighbor.x) || !Number.isFinite(neighbor.y)) continue;
        points.push(neighbor);
    }
    return points;
}

function estimateAdaptiveScale(node, availableWidth, availableHeight) {
    const neighbors = connectedPointsForNode(node.id);
    if (!neighbors.length) return Math.max(0.9, Math.min(2.2, currentZoom || 1.2));

    const distances = neighbors
        .map(n => Math.hypot((n.x - node.x), (n.y - node.y)))
        .filter(d => Number.isFinite(d) && d > 0)
        .sort((a, b) => a - b);

    if (!distances.length) return Math.max(0.9, Math.min(2.2, currentZoom || 1.2));

    // Sacrifice far boundary nodes: keep only the nearest neighborhood for framing.
    const nearestCount = Math.max(10, Math.min(28, Math.floor(distances.length * 0.55)));
    const nearestDistances = distances.slice(0, nearestCount);
    const focusRadius = Math.max(28, percentile(nearestDistances, 0.82));
    const targetRadiusPx = Math.min(availableWidth * 0.42, availableHeight * 0.44);
    const nextScale = targetRadiusPx / focusRadius;
    return Math.max(0.95, Math.min(3.6, nextScale));
}

function centerViewOnNode(node, duration = 500) {
    if (!svgEl || !zoomBehavior || !node || Number.isNaN(node.x) || Number.isNaN(node.y)) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const panel = document.getElementById('panel');
    const panelOpen = !!(panel && panel.classList.contains('open') && window.innerWidth > 760);
    const panelWidth = panelOpen ? (panel.getBoundingClientRect().width || 364) : 0;
    const availableWidth = Math.max(260, W - panelWidth);
    const centerX = availableWidth / 2;
    const scale = estimateAdaptiveScale(node, availableWidth, H);
    const transform = d3.zoomIdentity
        .translate(centerX, H / 2)
        .scale(scale)
        .translate(-node.x, -node.y);
    svgEl.transition().duration(duration).call(zoomBehavior.transform, transform);
}

function setPanelOpenState(isOpen) {
    const panel = document.getElementById('panel');
    if (!panel) return;
    panel.classList.toggle('open', !!isOpen);
    document.body.classList.toggle('panel-open', !!isOpen);
}

// ===== PANEL =====
function openPanel(d) {
    currentPanelNodeId = d.id;
    navHistory = navHistory.filter(id => id !== d.id);
    navHistory.push(d.id);
    if (navHistory.length > 10) navHistory.shift();
    saveNavHistory();
    renderBreadcrumb();

    // Hide welcome overlay on first interaction
    dismissWelcomeOverlay();

    document.getElementById('p-type').textContent = t(d.type);
    document.getElementById('p-type').style.color = nc(d);
    document.getElementById('p-label').textContent = nodeLabel(d);
    document.getElementById('p-domains').innerHTML = d.domain.map(dm =>
        `<span class="d-badge" style="color:${DC[dm]}">${escHtml(dm)}</span>`
    ).join('');
    document.getElementById('p-desc').innerHTML = renderPanelDescription(d);
    document.getElementById('p-tags').innerHTML = (d.display_tags || []).map((tag) =>
        `<span class="tag">${escHtml(localizeTag(tag))}</span>`
    ).join('');

    // Era display (fixed)
    const era = d.era;
    if (era && era.start != null) {
        const s = era.start < 0 ? `${Math.abs(era.start)} ${t('bce')}` : String(era.start);
        const end = era.end != null ? (era.end < 0 ? `${Math.abs(era.end)} ${t('bce')}` : String(era.end)) : t('present');
        document.getElementById('p-era').textContent = `${t('era')}: ${s} \u2014 ${end}`;
    } else {
        document.getElementById('p-era').textContent = '';
    }

    document.getElementById('p-search').href = 'https://www.google.com/search?q=' + encodeURIComponent(nodeLabel(d));
    updatePanelLearningControls(d);

    // Prerequisites & Unlocks
    const parents = (prereqGraph.parents[d.id] || []).map(id => nodeMap[id]).filter(Boolean);
    const children = (prereqGraph.children[d.id] || []).map(id => nodeMap[id]).filter(Boolean);

    const prereqSection = document.getElementById('p-prereqs');
    const unlockSection = document.getElementById('p-unlocks');

    if (parents.length || children.length) {
        prereqSection.style.display = 'block';
        unlockSection.style.display = 'block';
        document.getElementById('p-prereq-list').innerHTML = parents.length
            ? parents.map(n => connItem(n, 'prerequisite', false)).join('')
            : `<div style="font-size:10px;color:#334;padding:2px 0">${t('noneFoundational')}</div>`;
        document.getElementById('p-unlock-list').innerHTML = children.length
            ? children.map(n => connItem(n, 'unlocks', false)).join('')
            : `<div style="font-size:10px;color:#334;padding:2px 0">${t('noneDetected')}</div>`;
    } else {
        prereqSection.style.display = 'none';
        unlockSection.style.display = 'none';
    }

    // All connections
    const conns = (d.connections || []).map(c => {
        const o = nodeMap[c.target];
        return { node: o, rel: c.relation_type, pending: c.pending };
    }).filter(c => c.node);

    document.getElementById('p-conn-list').innerHTML = conns.map(c =>
        connItem(c.node, c.rel, c.pending)
    ).join('');

    setPanelOpenState(true);

    // Highlight
    clearHighlights();
    nodeEls.classed('selected-node', n => n.id === d.id);
    applyFocusRing(d);
    relatedLabelIds = getRelatedNodeIds(d.id);
    updateLabelVisibility();
    if (lpMode) {
        highlightPrereqChain(d.id);
    } else {
        linkEls.classed('highlight', l => (l.source.id === d.id || l.target.id === d.id));
    }
    refreshFocusCurves();
}

function connItem(node, rel, pending) {
    const cls = pending ? 'ci cp' : (rel === 'prerequisite' || rel === 'unlocks' ? 'ci ci-prereq' : 'ci');
    const relLabel = t(rel) || escHtml(rel);
    const pendingLabel = pending ? ` (${t('pending')})` : '';
    return `<div class="${cls}" data-node-id="${escAttr(node.id)}"><div class="cd" style="background:${nc(node)}"></div><span>${escHtml(nodeLabel(node))}${pendingLabel}</span><span class="cr" style="color:${RC[rel] || '#f0c050'}">${relLabel}</span></div>`;
}

function renderBreadcrumb() {
    const el = document.getElementById('p-breadcrumb');
    const MAX = 3;
    const last = navHistory.slice(-MAX);
    const hasMore = navHistory.length > MAX;
    const prefix = hasMore ? '<span class="bc-sep" title="Earlier history">\u2026</span><span class="bc-sep">\u203a</span>' : '';
    el.innerHTML = prefix + last.map((id, i) => {
        const n = nodeMap[id];
        if (!n) return '';
        const sep = i < last.length - 1 ? '<span class="bc-sep">\u203a</span>' : '';
        return `<span class="bc-item" data-node-id="${escAttr(id)}">${escHtml(nodeLabel(n))}</span>${sep}`;
    }).join('');
}

function getNextRecommendedNodeId(currentNodeId) {
    const childIds = prereqGraph.children[currentNodeId] || [];
    const childCandidates = childIds
        .map(id => nodeMap[id])
        .filter(Boolean)
        .filter(node => isAvailable(node.id) && !learnedSet.has(node.id))
        .sort((a, b) => {
            const unlockA = (prereqGraph.children[a.id] || []).length;
            const unlockB = (prereqGraph.children[b.id] || []).length;
            return unlockB - unlockA || nodeLabel(a).localeCompare(nodeLabel(b));
        });

    if (childCandidates.length) {
        return childCandidates[0].id;
    }

    if (!learnedSet.has(currentNodeId) && isAvailable(currentNodeId)) {
        return currentNodeId;
    }

    return null;
}

function updatePanelLearningControls(node) {
    const lpBtn = document.getElementById('p-lp-action');
    const nextStepEl = document.getElementById('p-next-step');
    if (!lpBtn || !nextStepEl || !node) return;

    const learned = learnedSet.has(node.id);
    lpBtn.dataset.nodeId = node.id;
    lpBtn.textContent = learned ? t('removeFromLearningPath') : t('addToLearningPath');
    lpBtn.classList.toggle('is-learned', learned);

    if (!lpMode) {
        nextStepEl.textContent = t('nextStepWillAppear');
        return;
    }

    const nextId = getNextRecommendedNodeId(node.id);
    if (nextId) {
        if (nextId === node.id) {
            nextStepEl.textContent = `${t('nextStepLabel')}: ${t('nextStepReady')}`;
            return;
        }
        const nextNode = nodeMap[nextId];
        nextStepEl.innerHTML = `${escHtml(t('nextStepLabel'))}: <span class="next-link" data-node-id="${escAttr(nextNode.id)}">${escHtml(nodeLabel(nextNode))}</span>`;
        return;
    }

    nextStepEl.textContent = learned ? t('learningComplete') : t('nextStepLocked');
}

// ===== LEARNING PATH MODE =====
function setupLPMode() {
    const btn = document.getElementById('lp-btn');
    const toggle = () => {
        lpMode = !lpMode;
        btn.classList.toggle('active', lpMode);
        btn.setAttribute('aria-pressed', String(lpMode));
        document.body.classList.toggle('lp-active', lpMode);
        document.getElementById('learned-info').style.display = lpMode ? 'block' : 'none';
        if (lpMode) {
            applyLPVisibility();
        } else {
            clearLPState();
            applyVisibility();
        }
        updateLabelVisibility();
        updateLearnedInfo();
        if (currentPanelNodeId && nodeMap[currentPanelNodeId]) {
            updatePanelLearningControls(nodeMap[currentPanelNodeId]);
        }
    };
    btn.onclick = toggle;
    btn.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    };
}

function applyLPVisibility() {
    const prereqNodes = new Set();
    const prereqEdgeSet = new Set();
    for (const e of prereqEdges) {
        prereqNodes.add(e.source);
        prereqNodes.add(e.target);
        prereqEdgeSet.add(edgeKey(e.source, e.target));
        prereqEdgeSet.add(edgeKey(e.target, e.source));
    }

    nodeEls.classed('dimmed', d => !prereqNodes.has(d.id) && !learnedSet.has(d.id));
    linkEls.classed('dimmed-link', true).classed('prereq-path', false).attr('marker-end', null);

    // Show prereq edges with arrows
    linkEls.each(function (d) {
        const sId = d.source.id || d.source;
        const tId = d.target.id || d.target;
        const isPrereq = prereqEdgeSet.has(edgeKey(sId, tId));
        if (isPrereq) {
            d3.select(this).classed('dimmed-link', false).classed('prereq-path', true)
                .attr('marker-end', 'url(#arrow)');
        }
    });

    nodeEls.classed('learned', d => learnedSet.has(d.id));
    nodeEls.classed('available', d => isAvailable(d.id));
    updateLabelVisibility();
    refreshFocusCurves();
}

function clearLPState() {
    nodeEls.classed('learned', false).classed('available', false).classed('on-path', false);
    linkEls.classed('prereq-path', false).classed('dimmed-link', false).attr('marker-end', null);
    refreshFocusCurves();
}

function toggleLearned(id) {
    if (learnedSet.has(id)) learnedSet.delete(id);
    else learnedSet.add(id);
    applyLPVisibility();
    updateLearnedInfo();
    saveLearningProgress(id);
    if (currentPanelNodeId && nodeMap[currentPanelNodeId]) {
        updatePanelLearningControls(nodeMap[currentPanelNodeId]);
    }
}

// --- Learning Progress Persistence ---
async function loadLearningProgress() {
    // Prefer local state as baseline, then merge server state when available.
    const localLearned = window.NodusState.loadStoredLearned('nodus-learned', nodeMap);
    learnedSet = new Set(localLearned);

    try {
        const data = await window.NodusApi.fetchLearningProgress();
        if (data) {
            const serverLearned = (data.learned || []).filter(id => isSafeNodeId(id) && nodeMap[id]);
            for (const id of serverLearned) {
                learnedSet.add(id);
            }
            window.NodusState.saveStoredLearned('nodus-learned', learnedSet);
            return;
        }
    } catch (e) { /* API unavailable */ }
}

function saveLearningProgress(toggledId) {
    // Save to localStorage immediately
    try {
        window.NodusState.saveStoredLearned('nodus-learned', learnedSet);
    } catch (e) { }
    // Sync to backend (fire-and-forget)
    window.NodusApi.postLearningToggle(toggledId).catch(() => { });
}

function isAvailable(id) {
    if (learnedSet.has(id)) return false;
    const parents = prereqGraph.parents[id];
    if (!parents || parents.length === 0) {
        // Root node in prereq graph — available if it has children (is part of prereq graph)
        return (prereqGraph.children[id] || []).length > 0;
    }
    return parents.every(p => learnedSet.has(p));
}

function updateLearnedInfo() {
    const el = document.getElementById('learned-info');
    if (!lpMode) { el.style.display = 'none'; return; }
    const availableNodes = allNodes.filter(n => isAvailable(n.id) && !learnedSet.has(n.id));
    const avail = availableNodes.length;
    const next = availableNodes
        .sort((a, b) => {
            const unlockA = (prereqGraph.children[a.id] || []).length;
            const unlockB = (prereqGraph.children[b.id] || []).length;
            return unlockB - unlockA || nodeLabel(a).localeCompare(nodeLabel(b));
        })[0];
    const nextText = next ? `${t('nextStepLabel')}: ${nodeLabel(next)}` : t('learningComplete');
    el.textContent = `\u2713 ${learnedSet.size} ${t('learned')} \u00b7 ${avail} ${t('available')} \u00b7 ${nextText}`;
    el.style.display = 'block';
}

function highlightPrereqChain(id) {
    const ancestors = new Set();
    const descendants = new Set();

    function findAncestors(nid) {
        for (const p of (prereqGraph.parents[nid] || [])) {
            if (!ancestors.has(p)) { ancestors.add(p); findAncestors(p); }
        }
    }
    function findDescendants(nid) {
        for (const c of (prereqGraph.children[nid] || [])) {
            if (!descendants.has(c)) { descendants.add(c); findDescendants(c); }
        }
    }

    findAncestors(id);
    findDescendants(id);

    const onPath = new Set([...ancestors, ...descendants, id]);
    const onPathPrereqEdgeSet = new Set();
    for (const pe of prereqEdges) {
        if (onPath.has(pe.source) && onPath.has(pe.target)) {
            onPathPrereqEdgeSet.add(edgeKey(pe.source, pe.target));
            onPathPrereqEdgeSet.add(edgeKey(pe.target, pe.source));
        }
    }
    nodeEls.classed('on-path', d => onPath.has(d.id));

    linkEls.each(function (d) {
        const sId = d.source.id || d.source;
        const tId = d.target.id || d.target;
        const isOnChain = onPathPrereqEdgeSet.has(edgeKey(sId, tId));
        if (isOnChain) d3.select(this).classed('prereq-path', true);
    });
    refreshFocusCurves();
}

// Dual-concentric focus ring — a luminous white star-ring shown ONLY on the
// selected node. Appended to that node's <g> so it rides the group transform
// (no per-tick cost). Removed on deselect / reselect.
function applyFocusRing(d) {
    removeFocusRing();
    const idx = allNodes.indexOf(d);
    if (idx < 0 || !nodeEls) return;
    const el = nodeEls.nodes()[idx];
    if (!el) return;
    const m = sm(d);
    const ringR = Math.max(m.halo * 0.7, m.core * 5) + 6;
    const g = d3.select(el).append('g').attr('class', 'focus-ring').attr('pointer-events', 'none');
    // outer soft bloom
    g.append('circle').attr('class', 'fr-bloom').attr('r', ringR + 3);
    // bright glowing band
    g.append('circle').attr('class', 'fr-band').attr('r', ringR);
    // sharp inner hairline — the second concentric ring
    g.append('circle').attr('class', 'fr-edge').attr('r', ringR - 4);
}
function removeFocusRing() {
    if (nodeEls) nodeEls.selectAll('.focus-ring').remove();
}

function clearHighlights() {
    linkEls.classed('highlight', false);
    nodeEls.classed('selected-node', false);
    nodeEls.classed('on-path', false);
    removeFocusRing();
    relatedLabelIds = new Set();
    updateLabelVisibility();
    if (!lpMode) linkEls.classed('prereq-path', false);
    refreshFocusCurves();
}

// ===== SEARCH (fixed: event delegation, no XSS) =====
function setupSearch() {
    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    let latestMatches = [];

    const rankMatches = (q) => {
        const index = _searchIndex || [];
        const scored = [];
        for (let i = 0; i < index.length; i++) {
            const entry = index[i];
            const n = entry.node;
            let score = 0;

            if (entry.label === q || entry.id === q || entry.fallbackLabel === q) score = 120;
            else if (entry.label.startsWith(q) || entry.id.startsWith(q) || entry.fallbackLabel.startsWith(q)) score = 90;
            else if (entry.label.includes(q) || entry.id.includes(q) || entry.fallbackLabel.includes(q)) score = 70;
            else if (entry.tags.includes(q)) score = 55;
            else if (entry.desc.includes(q)) score = 35;

            if (!score && entry.domains.some(d => d === q)) {
                score = 50;
            }

            if (score > 0) {
                scored.push({ n, score });
            }
        }
        scored.sort((a, b) => b.score - a.score || nodeLabel(a.n).localeCompare(nodeLabel(b.n)));
        return scored.slice(0, 12).map(item => item.n);
    };

    const hideResults = () => {
        results.style.display = 'none';
        results.setAttribute('aria-hidden', 'true');
        input.setAttribute('aria-expanded', 'false');
        latestMatches = [];
    };

    const showNoResults = () => {
        results.style.display = 'block';
        results.setAttribute('aria-hidden', 'false');
        input.setAttribute('aria-expanded', 'true');
        results.innerHTML = `<div class="sr" style="opacity:0.75;color:#8fa0b8;cursor:default;line-height:1.5">${escHtml(t('searchNoResults'))}</div>`;
    };

    const showMatches = (matches) => {
        results.style.display = 'block';
        results.setAttribute('aria-hidden', 'false');
        input.setAttribute('aria-expanded', 'true');
        results.innerHTML = [
            `<div class="sr" style="opacity:0.6;color:#8fa0b8;cursor:default;font-size:10px;letter-spacing:0.04em">${escHtml(t('searchTopHint'))}</div>`,
            ...matches.map((n) =>
                `<div class="sr" style="color:${nc(n)}" data-node-id="${escAttr(n.id)}">${escHtml(nodeLabel(n))} <span style="opacity:0.4;font-size:9px">${escHtml(n.type)}</span></div>`
            )
        ].join('');
    };

    let _searchTimer = 0;

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const top = latestMatches[0];
            if (top) {
                focusNode(top.id);
                hideResults();
                input.value = '';
            }
        });
    }

    input.addEventListener('input', () => {
        clearTimeout(_searchTimer);
        const q = input.value.toLowerCase().trim();
        if (q.length < 2) { hideResults(); return; }
        _searchTimer = setTimeout(() => {
            const matches = rankMatches(q);
            latestMatches = matches;
            if (!matches.length) {
                showNoResults();
                return;
            }
            showMatches(matches);
        }, 120);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const top = latestMatches[0];
            if (top) {
                e.preventDefault();
                focusNode(top.id);
                hideResults();
                input.value = '';
            }
        }
        if (e.key === 'Escape') {
            hideResults();
            input.value = '';
        }
    });

    // mousedown fires before blur — avoids race condition
    results.addEventListener('mousedown', (e) => {
        const sr = e.target.closest('.sr');
        if (!sr) return;
        e.preventDefault();
        const id = sr.dataset.nodeId;
        if (id) { focusNode(id); hideResults(); input.value = ''; }
    });

    input.addEventListener('blur', () => setTimeout(hideResults, 150));
}

// ===== EVENT DELEGATION for panel clicks =====
document.addEventListener('click', (e) => {
    const ci = e.target.closest('[data-node-id]');
    if (ci && (ci.closest('#p-conn-list') || ci.closest('#p-prereq-list') || ci.closest('#p-unlock-list') || ci.closest('#p-breadcrumb') || ci.closest('#p-next-step'))) {
        focusNode(ci.dataset.nodeId);
    }
});

const panelLpActionBtn = document.getElementById('p-lp-action');
if (panelLpActionBtn) {
    panelLpActionBtn.addEventListener('click', () => {
        const id = panelLpActionBtn.dataset.nodeId;
        if (!id || !nodeMap[id]) return;
        toggleLearned(id);
    });
}

// ===== FOCUS NODE =====
function focusNode(id) {
    if (!isSafeNodeId(id)) return;
    const d = allNodes.find(n => n.id === id);
    if (d) {
        openPanel(d);
        centerViewOnNode(d, 500);
    }
}

// ===== CLOSE PANEL =====
document.getElementById('close').onclick = () => {
    setPanelOpenState(false);
    clearHighlights();
    if (lpMode) applyLPVisibility();
};

// ===== UTILITIES =====
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function resolveSearchQueryNodeId(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return null;

    const index = _searchIndex || [];
    const exact = [];
    const prefix = [];

    for (let i = 0; i < index.length; i++) {
        const entry = index[i];
        const isExact = entry.label === q || entry.id === q || entry.fallbackLabel === q;
        if (isExact) {
            exact.push(entry.node);
            continue;
        }

        const isPrefix = entry.label.startsWith(q) || entry.id.startsWith(q) || entry.fallbackLabel.startsWith(q);
        if (isPrefix) {
            prefix.push(entry.node);
        }
    }

    const sortByLabel = (a, b) => nodeLabel(a).localeCompare(nodeLabel(b));
    if (exact.length > 0) {
        exact.sort(sortByLabel);
        return exact[0].id;
    }
    if (prefix.length > 0) {
        prefix.sort(sortByLabel);
        return prefix[0].id;
    }
    return null;
}

// ===== URL PARAMS =====
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const nodeId = params.get('node');
    const searchQuery = params.get('search');

    if (nodeId && isSafeNodeId(nodeId) && nodeMap[nodeId]) {
        setTimeout(() => focusNode(nodeId), 600);
    } else if (searchQuery && searchQuery.length <= 120) {
        const input = document.getElementById('search-input');
        input.value = searchQuery;
        input.focus();

        const resolvedNodeId = resolveSearchQueryNodeId(searchQuery);
        if (resolvedNodeId) {
            setTimeout(() => focusNode(resolvedNodeId), 280);
        } else {
            input.dispatchEvent(new Event('input'));
        }
    }
}

// ===== START =====
init().then(() => handleUrlParams());

// ===== PARTICLE BACKGROUND (lazy loaded) =====
import('./particles.js').catch(() => {/* non-critical */ });
