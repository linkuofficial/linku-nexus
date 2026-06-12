import * as d3 from "d3";
import { hexA, curvedEdgePath } from "./engine/geometry.js";

        // ===== CONSTANTS =====
        const DC = window.NodusTokens?.DOMAIN_COLORS || {
            MAT: '#5b9bd5', PHY: '#c97a5b', CHE: '#c9c05b', BIO: '#5bc97a',
            MED: '#5bc9b8', ENG: '#9b7bc9', TEC: '#c95b9b', SOC: '#c9a05a',
            HUM: '#7ba5c9', PHI: '#9bc95b', ART: '#c95b5b', HIS: '#a07850'
        };
        const RC = window.NodusTokens?.RELATION_COLORS || {
            logical: '#5b9bd5', historical: '#c9a05a', applied: '#5bc97a',
            conceptual: '#9b7bc9', causal: '#c95b5b'
        };
        const TYPE_SIZE = { field: 14, concept: 7, person: 10, event: 12 };
        const I18N = {
            en: {
                navHome: 'Home',
                navGraph: 'Graph',
                hdrTitle: 'Nodus Explorer',
                hdrSubtitle: 'Knowledge Graph',
                all: 'ALL',
                searchPlaceholder: 'Search a concept to start exploring...',
                welcomeTitle: 'Search a concept to start exploring',
                welcomeSubtitle: 'Type a topic, person, or event - then double-click or right-click a node to expand connections',
                recommended: 'Suggested next',
                btnReset: 'Reset',
                btnFit: 'Fit',
                btnUndo: 'Undo',
                btnHelp: 'Help',
                btnGuide: 'Guide',
                btnResetTitle: 'Clear graph and start over',
                btnFitTitle: 'Fit view to all visible nodes',
                btnUndoTitle: 'Undo last expand (Ctrl+Z)',
                btnFocusTitle: 'Cycle focus depth: Off, 1-Hop, 2-Hop',
                btnHelpTitle: 'Open keyboard shortcuts and explorer help',
                btnGuideTitle: 'Replay quick guide',
                focusOff: 'Focus Off',
                focus1: 'Focus 1-Hop',
                focus2: 'Focus 2-Hop',
                connections: 'Connections',
                showAll: 'Show all',
                showLess: 'Show less',
                expand: 'Expand',
                collapse: 'Collapse',
                path: 'Path',
                inGraph: 'in graph',
                explored: 'explored',
                total: 'total',
                hiddenConnections: 'hidden connections',
                ctxExpand: 'Expand connections',
                ctxCollapse: 'Collapse node',
                ctxPath: 'Find path from selected',
                ctxFocus: 'Focus on this',
                shortcutsTitle: 'Keyboard Shortcuts',
                shortcutsIntro: 'Use a few keys to move through the explorer faster.',
                scSearch: 'Search',
                scSearchAlt: 'Search (alt)',
                scUndo: 'Undo',
                scClose: 'Close panel / shortcuts',
                scShow: 'Show shortcuts',
                scExpand: 'Expand selected',
                scContext: 'Node context menu',
                shortcutsClose: 'Close',
                onboardingSkip: 'Skip',
                onboardingNext: 'Next',
                onboardingDone: 'Done',
                onboardingEscHint: 'Press Esc to close',
                tourStep1: 'Step 1 of 3',
                tourTitle1: 'Find a starting concept',
                tourText1: 'Use the search box to start from any concept, person, or event. Search supports labels, domains, and tags.',
                tourStep2: 'Step 2 of 3',
                tourTitle2: 'Expand and navigate',
                tourText2: 'Click a node to inspect details, then double click or right-click that node to expand more connections.',
                tourStep3: 'Step 3 of 3',
                tourTitle3: 'Use Focus Mode for clarity',
                tourText3: 'Use Focus to cycle Off, 1-Hop, and 2-Hop views after selecting a node to reduce noise and inspect local structure.',
                relLogical: 'logical',
                relHistorical: 'historical',
                relApplied: 'applied',
                relConceptual: 'conceptual',
                relCausal: 'causal',
                typeField: 'field',
                typeConcept: 'concept',
                typePerson: 'person',
                typeEvent: 'event',
                eraBce: 'BCE',
                eraPresent: 'present'
            },
            zh: {
                navHome: '首頁',
                navGraph: '圖譜',
                hdrTitle: 'Nodus \u63a2\u7d22\u5668',
                hdrSubtitle: '\u77e5\u8b58\u5716\u8b5c',
                all: '\u5168\u90e8',
                searchPlaceholder: '\u641c\u5c0b\u6982\u5ff5\u4f86\u958b\u59cb\u63a2\u7d22...',
                welcomeTitle: '\u641c\u5c0b\u4e00\u500b\u6982\u5ff5\u958b\u59cb\u63a2\u7d22',
                welcomeSubtitle: '\u8f38\u5165\u4e3b\u984c\u3001\u4eba\u7269\u6216\u4e8b\u4ef6 - \u7136\u5f8c\u96d9\u64ca\u6216\u5728\u7bc0\u9ede\u4e0a\u53f3\u9375\u5c55\u958b\u95dc\u806f',
                recommended: '\u5efa\u8b70\u4e0b\u4e00\u6b65',
                btnReset: '\u91cd\u7f6e',
                btnFit: '\u9069\u914d',
                btnUndo: '\u5fa9\u539f',
                btnHelp: '\u8aaa\u660e',
                btnGuide: '\u6307\u5f15',
                btnResetTitle: '\u6e05\u9664\u5716\u5f62\u4e26\u5f9e\u982d\u958b\u59cb',
                btnFitTitle: '\u5c07\u8996\u5716\u8abf\u6574\u81f3\u6240\u6709\u53ef\u898b\u7bc0\u9ede',
                btnUndoTitle: '\u5fa9\u539f\u4e0a\u4e00\u6b21\u5c55\u958b (Ctrl+Z)',
                btnFocusTitle: '\u5207\u63db\u805a\u7126\u5c64\u7d1a\uff1a\u95dc\u9589\u30011 \u8df3\u30012 \u8df3',
                btnHelpTitle: '\u958b\u555f\u5feb\u6377\u9375\u8207 explorer \u8aaa\u660e',
                btnGuideTitle: '\u91cd\u64ad\u5feb\u901f\u6307\u5f15',
                focusOff: '\u7121\u805a\u7126',
                focus1: '1 \u8df3\u805a\u7126',
                focus2: '2 \u8df3\u805a\u7126',
                connections: '\u9023\u7d50',
                showAll: '\u986f\u793a\u5168\u90e8',
                showLess: '\u986f\u793a\u8f03\u5c11',
                expand: '\u5c55\u958b',
                collapse: '\u6536\u5408',
                path: '\u8def\u5f91',
                inGraph: '\u5728\u5716\u4e2d',
                explored: '\u5df2\u63a2\u7d22',
                total: '\u7e3d\u8a08',
                hiddenConnections: '\u96b1\u85cf\u9023\u7d50',
                ctxExpand: '\u5c55\u958b\u95dc\u806f',
                ctxCollapse: '\u6536\u5408\u7bc0\u9ede',
                ctxPath: '\u5c0b\u627e\u8207\u76ee\u524d\u9078\u53d6\u7bc0\u9ede\u7684\u8def\u5f91',
                ctxFocus: '\u805a\u7126\u6b64\u7bc0\u9ede',
                shortcutsTitle: '\u9375\u76e4\u5feb\u901f\u9375',
                shortcutsIntro: '\u7528\u9019\u5e7e\u500b\u6309\u9375\uff0c\u53ef\u4ee5\u66f4\u5feb\u5730\u5c0e\u89bd explorer\u3002',
                scSearch: '\u641c\u5c0b',
                scSearchAlt: '\u641c\u5c0b\uff08\u5099\u7528\uff09',
                scUndo: '\u5fa9\u539f',
                scClose: '\u95dc\u9589\u9762\u677f / \u5feb\u901f\u9375',
                scShow: '\u986f\u793a\u5feb\u901f\u9375',
                scExpand: '\u5c55\u958b\u5df2\u9078\u7bc0\u9ede',
                scContext: '\u7bc0\u9ede\u53f3\u9375\u9078\u55ae',
                shortcutsClose: '\u95dc\u9589',
                onboardingSkip: '\u7565\u904e',
                onboardingNext: '\u4e0b\u4e00\u6b65',
                onboardingDone: '\u5b8c\u6210',
                onboardingEscHint: '\u6309 Esc \u53ef\u95dc\u9589',
                tourStep1: '\u6b65\u9a5f 1 / 3',
                tourTitle1: '\u5148\u627e\u4e00\u500b\u8d77\u9ede\u6982\u5ff5',
                tourText1: '\u4f7f\u7528\u641c\u5c0b\u6846\u5f9e\u4efb\u4f55\u6982\u5ff5\u3001\u4eba\u7269\u6216\u4e8b\u4ef6\u958b\u59cb\u3002\u641c\u5c0b\u652f\u63f4\u6a19\u7c64\u3001\u9818\u57df\u8207\u95dc\u9375\u8a5e\u3002',
                tourStep2: '\u6b65\u9a5f 2 / 3',
                tourTitle2: '\u5c55\u958b\u8207\u5c0e\u89bd',
                tourText2: '\u9ede\u64ca\u7bc0\u9ede\u53ef\u67e5\u770b\u8a73\u60c5\uff0c\u518d\u4ee5\u96d9\u64ca\u6216\u5728\u8a72\u7bc0\u9ede\u4e0a\u53f3\u9375\u5c55\u958b\u66f4\u591a\u95dc\u806f\u3002',
                tourStep3: '\u6b65\u9a5f 3 / 3',
                tourTitle3: '\u4f7f\u7528\u805a\u7126\u6a21\u5f0f\u63d0\u5347\u53ef\u8b80\u6027',
                tourText3: '\u9078\u53d6\u7bc0\u9ede\u5f8c\uff0c\u53ef\u5728\u95dc\u9589\u30011 \u8df3\u30012 \u8df3\u9593\u5207\u63db\u805a\u7126\uff0c\u964d\u4f4e\u8996\u89ba\u96dc\u8a0a\u4e26\u6aa2\u8996\u5c40\u90e8\u7d50\u69cb\u3002',
                relLogical: '\u908f\u8f2f',
                relHistorical: '\u6b77\u53f2',
                relApplied: '\u61c9\u7528',
                relConceptual: '\u6982\u5ff5',
                relCausal: '\u56e0\u679c',
                typeField: '\u9818\u57df',
                typeConcept: '\u6982\u5ff5',
                typePerson: '\u4eba\u7269',
                typeEvent: '\u4e8b\u4ef6',
                eraBce: '\u516c\u5143\u524d',
                eraPresent: '\u81f3\u4eca'
            },
            ja: {
                navHome: 'ホーム',
                navGraph: 'グラフ',
                hdrTitle: 'Nodus \u30a8\u30af\u30b9\u30d7\u30ed\u30fc\u30e9\u30fc',
                hdrSubtitle: '\u77e5\u8b58\u30b0\u30e9\u30d5',
                all: '\u3059\u3079\u3066',
                searchPlaceholder: '\u63a2\u7d22\u3092\u59cb\u3081\u308b\u6982\u5ff5\u3092\u691c\u7d22...',
                welcomeTitle: '\u6982\u5ff5\u3092\u691c\u7d22\u3057\u3066\u63a2\u7d22\u3092\u958b\u59cb',
                welcomeSubtitle: '\u30c8\u30d4\u30c3\u30af\u3001\u4eba\u7269\u3001\u51fa\u6765\u4e8b\u3092\u5165\u529b\u3057\u3001\u30ce\u30fc\u30c9\u3092\u30c0\u30d6\u30eb\u30af\u30ea\u30c3\u30af\u307e\u305f\u306f\u53f3\u30af\u30ea\u30c3\u30af\u3067\u63a5\u7d9a\u3092\u5c55\u958b\u3057\u3066\u304f\u3060\u3055\u3044',
                recommended: '\u63a8\u5968\u306e\u6b21\u306e\u4e00\u624b',
                btnReset: '\u30ea\u30bb\u30c3\u30c8',
                btnFit: '\u5168\u4f53\u8868\u793a',
                btnUndo: '\u5143\u306b\u623b\u3059',
                btnHelp: '\u30d8\u30eb\u30d7',
                btnGuide: '\u30ac\u30a4\u30c9',
                btnResetTitle: '\u30b0\u30e9\u30d5\u3092\u30ea\u30bb\u30c3\u30c8\u3057\u3066\u6700\u521d\u304b\u3089\u3084\u308a\u76f4\u3059',
                btnFitTitle: '\u53ef\u8996\u30ce\u30fc\u30c9\u5168\u4f53\u304c\u53ce\u307e\u308b\u3088\u3046\u306b\u8868\u793a\u3092\u8abf\u6574',
                btnUndoTitle: '\u76f4\u524d\u306e\u5c55\u958b\u3092\u5143\u306b\u623b\u3059 (Ctrl+Z)',
                btnFocusTitle: '\u30d5\u30a9\u30fc\u30ab\u30b9\u6df1\u5ea6\u3092\u5207\u66ff\uff1aOFF\u30fb1\u30db\u30c3\u30d7\u30fb2\u30db\u30c3\u30d7',
                btnHelpTitle: '\u30ad\u30fc\u30dc\u30fc\u30c9\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8\u3068 explorer \u30d8\u30eb\u30d7\u3092\u958b\u304f',
                btnGuideTitle: '\u30af\u30a4\u30c3\u30af\u30ac\u30a4\u30c9\u3092\u518d\u751f',
                focusOff: '\u30d5\u30a9\u30fc\u30ab\u30b9OFF',
                focus1: '\u30d5\u30a9\u30fc\u30ab\u30b91\u30db\u30c3\u30d7',
                focus2: '\u30d5\u30a9\u30fc\u30ab\u30b92\u30db\u30c3\u30d7',
                connections: '\u63a5\u7d9a',
                showAll: '\u3059\u3079\u3066\u8868\u793a',
                showLess: '\u6298\u308a\u305f\u305f\u3080',
                expand: '\u5c55\u958b',
                collapse: '\u6298\u308a\u305f\u305f\u3080',
                path: '\u30d1\u30b9',
                inGraph: '\u30b0\u30e9\u30d5\u5185',
                explored: '\u63a2\u7d22\u6e08\u307f',
                total: '\u5408\u8a08',
                hiddenConnections: '\u975e\u8868\u793a\u63a5\u7d9a',
                ctxExpand: '\u63a5\u7d9a\u3092\u5c55\u958b',
                ctxCollapse: '\u30ce\u30fc\u30c9\u3092\u6298\u308a\u305f\u305f\u3080',
                ctxPath: '\u9078\u629e\u4e2d\u30ce\u30fc\u30c9\u304b\u3089\u306e\u30d1\u30b9\u3092\u63a2\u3059',
                ctxFocus: '\u3053\u306e\u30ce\u30fc\u30c9\u306b\u30d5\u30a9\u30fc\u30ab\u30b9',
                shortcutsTitle: '\u30ad\u30fc\u30dc\u30fc\u30c9\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8',
                shortcutsIntro: '\u3044\u304f\u3064\u304b\u306e\u30ad\u30fc\u3067 explorer \u3092\u3088\u308a\u65e9\u304f\u64cd\u4f5c\u3067\u304d\u307e\u3059\u3002',
                scSearch: '\u691c\u7d22',
                scSearchAlt: '\u691c\u7d22\uff08\u4ee3\u66ff\uff09',
                scUndo: '\u5143\u306b\u623b\u3059',
                scClose: '\u30d1\u30cd\u30eb / \u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8\u3092\u9589\u3058\u308b',
                scShow: '\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8\u3092\u8868\u793a',
                scExpand: '\u9078\u629e\u30ce\u30fc\u30c9\u3092\u5c55\u958b',
                scContext: '\u30ce\u30fc\u30c9\u306e\u53f3\u30af\u30ea\u30c3\u30af\u30e1\u30cb\u30e5\u30fc',
                shortcutsClose: '\u9589\u3058\u308b',
                onboardingSkip: '\u30b9\u30ad\u30c3\u30d7',
                onboardingNext: '\u6b21\u3078',
                onboardingDone: '\u5b8c\u4e86',
                onboardingEscHint: 'Esc\u3067\u9589\u3058\u308b',
                tourStep1: '\u30b9\u30c6\u30c3\u30d7 1 / 3',
                tourTitle1: '\u63a2\u7d22\u306e\u8d77\u70b9\u30b3\u30f3\u30bb\u30d7\u30c8\u3092\u898b\u3064\u3051\u308b',
                tourText1: '\u691c\u7d22\u30dc\u30c3\u30af\u30b9\u3092\u4f7f\u3063\u3066\u3001\u4efb\u610f\u306e\u6982\u5ff5\u30fb\u4eba\u7269\u30fb\u51fa\u6765\u4e8b\u304b\u3089\u63a2\u7d22\u3092\u59cb\u3081\u3066\u304f\u3060\u3055\u3044\u3002\u691c\u7d22\u306f\u30e9\u30d9\u30eb\u3001\u9818\u57df\u3001\u30bf\u30b0\u306b\u5bfe\u5fdc\u3057\u307e\u3059\u3002',
                tourStep2: '\u30b9\u30c6\u30c3\u30d7 2 / 3',
                tourTitle2: '\u5c55\u958b\u3057\u3066\u30ca\u30d3\u30b2\u30fc\u30c8\u3059\u308b',
                tourText2: '\u30ce\u30fc\u30c9\u3092\u30af\u30ea\u30c3\u30af\u3059\u308b\u3068\u8a73\u7d30\u3092\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002\u3055\u3089\u306b\u305d\u306e\u30ce\u30fc\u30c9\u3092\u30c0\u30d6\u30eb\u30af\u30ea\u30c3\u30af\u3001\u307e\u305f\u306f\u53f3\u30af\u30ea\u30c3\u30af\u30e1\u30cb\u30e5\u30fc\u3067\u63a5\u7d9a\u3092\u5c55\u958b\u3067\u304d\u307e\u3059\u3002',
                tourStep3: '\u30b9\u30c6\u30c3\u30d7 3 / 3',
                tourTitle3: '\u30d5\u30a9\u30fc\u30ab\u30b9\u30e2\u30fc\u30c9\u3067\u898b\u3084\u3059\u304f\u3059\u308b',
                tourText3: '\u30ce\u30fc\u30c9\u9078\u629e\u5f8c\u306b\u30d5\u30a9\u30fc\u30ab\u30b9\u3092 OFF\u30fb1\u30db\u30c3\u30d7\u30fb2\u30db\u30c3\u30d7\u3067\u5207\u308a\u66ff\u3048\u3066\u3001\u30ce\u30a4\u30ba\u3092\u6291\u3048\u3064\u3064\u5c40\u6240\u69cb\u9020\u3092\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002',
                relLogical: '\u8ad6\u7406',
                relHistorical: '\u6b74\u53f2',
                relApplied: '\u5fdc\u7528',
                relConceptual: '\u6982\u5ff5',
                relCausal: '\u56e0\u679c',
                typeField: '\u9818\u57df',
                typeConcept: '\u6982\u5ff5',
                typePerson: '\u4eba\u7269',
                typeEvent: '\u51fa\u6765\u4e8b',
                eraBce: '\u7d00\u5143\u524d',
                eraPresent: '\u73fe\u5728'
            }
        };

        // ===== STATE =====
        let LANG = 'en';
        let labelMap = {};
        let descriptionMap = {};
        let enDescriptionMap = {}; // English descriptions, split out of all_nodes.json and streamed in
        let localeLoadSeq = 0;
        const localeMapsCache = {
            en: { labels: {}, descriptions: {} }
        };
        let allNodesRaw = [];
        let nodeMap = {};
        let adjacency = {};         // nodeId -> [{target, relation_type, pending}]

        let visibleNodeIds = new Set();
        let expandedNodeIds = new Set();  // nodes whose neighbors have been added
        let visibleNodes = [];
        let visibleEdges = [];

        let sim, nodeEls, linkEls, g, svgEl, zoomBehavior;
        let focusCurveEls;
        let photonEls = null;   // flowing-light overlay on the lit constellation
        let linkNodeRefs = [];
        let currentZoom = 1;
        let nodeScale = 1;       // 1/k counter-scale → constant-size permanent glow
        let lastScaleK = 1;
        let selectedNodeId = null;
        let relatedLabelIds = new Set();
        let undoStack = [];       // snapshots of {visibleNodeIds, expandedNodeIds}
        let explorationHistory = []; // ordered list of expanded node ids for breadcrumb
        let activeFilter = null;  // domain filter (null = show all)
        let focusDepth = 0;
        let tourIndex = 0;
        let lastLoadError = null;
        const TOP_CHROME_EXPAND_DELAY = 90;
        const TOP_CHROME_COLLAPSE_DELAY = 260;

        const TOUR_KEY = 'nodus-explorer-tour-v1';

        function getTourSteps() {
            return [
                {
                    step: t('tourStep1'),
                    title: t('tourTitle1'),
                    text: t('tourText1'),
                    target: 'search-box'
                },
                {
                    step: t('tourStep2'),
                    title: t('tourTitle2'),
                    text: t('tourText2'),
                    target: 'controls'
                },
                {
                    step: t('tourStep3'),
                    title: t('tourTitle3'),
                    text: t('tourText3'),
                    target: 'btn-focus'
                }
            ];
        }

        // ===== HELPERS =====
        function nc(n) { return DC[n.domain[0]] || '#888'; }
        function nr(n) { return TYPE_SIZE[n.type] || 7; }

        // ── Star rendering (visual only — never feeds the sim/collision) ──────
        // Bloom radii + twinkle by node TYPE tier (Field ▸ Concept ▸ Detail).
        function esm(n) {
            const tier = n.type === 'field' ? 'primary' : (n.type === 'concept' ? 'secondary' : 'minor');
            const size = tier === 'primary' ? { core: 5.0, glow: 17, halo: 33, corona: 66 }
                : tier === 'secondary' ? { core: 2.0, glow: 7.5, halo: 16, corona: 32 }
                    : { core: 1.1, glow: 3.4, halo: 7.5, corona: 16 };
            // stable hash off id → desynced twinkle
            let h = 0; const s = String(n.id);
            for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
            h = Math.abs(h);
            return {
                ...size, tier,
                glowAlpha: tier === 'primary' ? 1.0 : tier === 'secondary' ? 0.86 : 0.62,
                twDur: (6.5 + (h % 7) * 0.9).toFixed(2),
                twDelay: ((h % 60) / 10).toFixed(2),
            };
        }
        function setLoadingState(message, isError = false, showRetry = false) {
            const wrap = document.getElementById('loading');
            const textEl = document.getElementById('loading-text');
            const retryBtn = document.getElementById('loading-retry');
            if (!wrap || !textEl || !retryBtn) return;
            textEl.textContent = message;
            textEl.style.color = isError ? '#fda4af' : '#94a7bf';
            retryBtn.style.display = showRetry ? 'inline-flex' : 'none';
            wrap.style.display = 'block';
        }

        function hideLoadingState() {
            const wrap = document.getElementById('loading');
            const retryBtn = document.getElementById('loading-retry');
            if (retryBtn) {
                retryBtn.disabled = false;
            }
            if (wrap) {
                wrap.style.display = 'none';
            }
        }

        async function fetchJsonWithTimeout(url, timeoutMs) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return await response.json();
            } finally {
                clearTimeout(timer);
            }
        }

        function normalizeGraphNodes(payload) {
            if (Array.isArray(payload)) {
                return payload;
            }
            if (payload && Array.isArray(payload.nodes)) {
                return payload.nodes;
            }
            throw new Error('Invalid graph payload: missing nodes array.');
        }

        function hydrateGraphData(rawNodes) {
            allNodesRaw = rawNodes;
            nodeMap = {};
            adjacency = {};

            for (const n of allNodesRaw) {
                nodeMap[n.id] = n;
                if (!adjacency[n.id]) adjacency[n.id] = [];
            }

            // Build bidirectional adjacency
            for (const n of allNodesRaw) {
                for (const c of (n.connections || [])) {
                    if (!nodeMap[c.target]) continue;
                    adjacency[n.id].push({ target: c.target, relation_type: c.relation_type, pending: c.pending || false });
                    // Add reverse
                    if (!adjacency[c.target]) adjacency[c.target] = [];
                    if (!adjacency[c.target].find(e => e.target === n.id && e.relation_type === c.relation_type)) {
                        adjacency[c.target].push({ target: n.id, relation_type: c.relation_type, pending: c.pending || false });
                    }
                }
            }
        }

        function edgeKey(edge) {
            const s = edge.source.id || edge.source;
            const t = edge.target.id || edge.target;
            return [s, t].sort().join('|') + '|' + edge.relation_type;
        }
        function escHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
        function truncate(s, len) { return s && s.length > len ? s.slice(0, len) + '…' : (s || ''); }
        function neighborCount(id) { return (adjacency[id] || []).filter(c => !visibleNodeIds.has(c.target)).length; }

        function refreshFocusCurves() {
            if (!focusCurveEls || !linkEls) return;
            const linkState = new Map();
            linkEls.each(function (d) {
                linkState.set(edgeKey(d), this);
            });

            focusCurveEls
                .classed('active', d => {
                    const baseLink = linkState.get(edgeKey(d));
                    if (!baseLink || baseLink.style.display === 'none') return false;
                    return baseLink.classList.contains('highlight') ||
                        baseLink.classList.contains('path-edge') ||
                        baseLink.classList.contains('focus-keep');
                })
                .classed('highlight', d => {
                    const baseLink = linkState.get(edgeKey(d));
                    return !!baseLink && baseLink.classList.contains('highlight');
                })
                .classed('path-edge', d => {
                    const baseLink = linkState.get(edgeKey(d));
                    return !!baseLink && baseLink.classList.contains('path-edge');
                })
                .classed('focus-keep', d => {
                    const baseLink = linkState.get(edgeKey(d));
                    return !!baseLink && baseLink.classList.contains('focus-keep');
                })
                .classed('focus-dim', d => {
                    const baseLink = linkState.get(edgeKey(d));
                    return !!baseLink && baseLink.classList.contains('focus-dim');
                });

            // Flowing PHOTONS — only on the lit (active) edges, a small set, so
            // this adds no work over the full edge list. Each rebuilt on state
            // change; positions ride the tick alongside focusCurveEls.
            const relColors = (window.NodusTokens && window.NodusTokens.RELATION_COLORS) || {};
            const activeData = focusCurveEls.data().filter(d => {
                const bl = linkState.get(edgeKey(d));
                return bl && bl.style.display !== 'none' &&
                    (bl.classList.contains('highlight') || bl.classList.contains('path-edge') || bl.classList.contains('focus-keep'));
            });
            const fcg = g.select('.focus-curves');
            photonEls = fcg.selectAll('path.photon').data(activeData, d => edgeKey(d));
            photonEls.exit().remove();
            const pen = photonEls.enter().append('path');
            photonEls = pen.merge(photonEls)
                .attr('class', d => {
                    const bl = linkState.get(edgeKey(d));
                    const gold = bl && bl.classList.contains('path-edge');
                    return 'photon' + (gold ? ' photon-gold' : '');
                })
                .style('stroke', d => {
                    const bl = linkState.get(edgeKey(d));
                    if (bl && bl.classList.contains('path-edge')) return '#f7d27d';
                    return relColors[d.relation_type] || '#cfe0f5';
                })
                .attr('d', d => curvedEdgePath(d));

            updateFocusRing();
        }

        // Dual-concentric focus ring on the selected star (appended to its <g>,
        // so it rides the node transform — no per-tick cost).
        function updateFocusRing() {
            if (!nodeEls) return;
            nodeEls.selectAll('.focus-ring').remove();
            if (!selectedNodeId) return;
            const sel = nodeEls.filter(d => d.id === selectedNodeId);
            if (sel.empty()) return;
            const d = sel.datum();
            const m = esm(d);
            const ringR = Math.max(m.halo * 0.7, m.core * 5) + 6;
            const fr = sel.append('g').attr('class', 'focus-ring').attr('pointer-events', 'none');
            fr.append('circle').attr('class', 'fr-bloom').attr('r', ringR + 3);
            fr.append('circle').attr('class', 'fr-band').attr('r', ringR);
            fr.append('circle').attr('class', 'fr-edge').attr('r', ringR - 4);
        }

        function setupTopChrome() {
            const trigger = document.getElementById('top-chrome-trigger');
            const searchBox = document.getElementById('search-box');
            const filterBar = document.getElementById('filter-bar');
            const hdr = document.getElementById('hdr');
            const langToggle = document.getElementById('lang-toggle');
            const stats = document.getElementById('stats');
            const searchInput = document.getElementById('search-input');
            const searchResults = document.getElementById('search-results');
            if (!trigger || !searchBox || !filterBar || !hdr || !langToggle || !stats || !searchInput) return;

            const pointerSupportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
            const hoverNoneQuery = window.matchMedia('(hover: none)');
            const desktopQuery = window.matchMedia('(min-width: 769px)');
            const interactiveAreas = [trigger, searchBox, filterBar, hdr, langToggle, stats];
            let handlersBound = false;
            let expandTimer = null;
            let collapseTimer = null;

            const proximityEnabled = () => {
                if (!desktopQuery.matches) return false;
                if (pointerSupportsHover) return true;
                return !hoverNoneQuery.matches;
            };

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

        function getPanelOffset() {
            const panel = document.getElementById('panel');
            if (!panel || !panel.classList.contains('open')) return 0;
            if (window.innerWidth <= 768) return 0;
            const panelWidth = panel.getBoundingClientRect().width || 340;
            return -Math.round(panelWidth * 0.5);
        }

        function isValidLang(lang) {
            return typeof lang === 'string' && Object.prototype.hasOwnProperty.call(I18N, lang);
        }

        function getLang() {
            const saved = localStorage.getItem('nodus-lang');
            if (saved === 'zh-TW') return 'zh';
            if (saved && saved.toLowerCase() === 'ja-jp') return 'ja';
            if (isValidLang(saved)) return saved;
            const nav = (navigator.language || '').toLowerCase();
            if (nav.startsWith('ja')) return 'ja';
            if (nav.startsWith('zh')) return 'zh';
            return 'en';
        }

        function t(key) {
            return (I18N[LANG] && I18N[LANG][key]) || (I18N.en && I18N.en[key]) || key;
        }

        const TAG_LABELS = {
            zh: {
                foundational: '基礎',
                abstract: '抽象',
                axiomatic: '公理化',
                ancient: '古代',
                experimental: '實驗',
                natural_world: '自然世界',
                molecular_scale: '分子尺度',
                interdisciplinary: '跨領域',
                field: '領域',
                applied: '應用',
                theoretical: '理論',
                empirical: '實證',
                modern: '現代',
                contemporary: '當代',
                historical_timescale: '歷史尺度',
                historically_significant: '歷史重要',
                unifying_concept: '統一概念',
                well_established: '成熟理論',
                currently_active_research: '目前活躍研究'
            },
            ja: {
                foundational: '基礎',
                abstract: '抽象',
                axiomatic: '公理化',
                ancient: '古代',
                experimental: '実験',
                natural_world: '自然界',
                molecular_scale: '分子スケール',
                interdisciplinary: '学際的',
                field: '分野',
                applied: '応用',
                theoretical: '理論',
                empirical: '実証',
                modern: '近代',
                contemporary: '現代',
                historical_timescale: '歴史スケール',
                historically_significant: '歴史的重要',
                unifying_concept: '統一概念',
                well_established: '確立された理論',
                currently_active_research: '現在進行中の研究'
            }
        };

        const TAG_TOKEN_ZH = {
            age: '時代',
            ancient: '古代',
            modern: '現代',
            contemporary: '當代',
            early: '早期',
            middle: '中期',
            post: '後',
            digital: '數位',
            industrial: '工業',
            cold: '冷',
            war: '戰爭',
            exploration: '探索',
            revolution: '革命',
            enlightenment: '啟蒙',
            renaissance: '文藝復興',
            ancient_greek: '古希臘',
            islamic: '伊斯蘭',
            golden: '黃金',
            world: '世界',
            history: '歷史',
            historical: '歷史',
            historiography: '史學方法',
            studies: '研究',
            science: '科學',
            technology: '科技',
            engineering: '工程',
            application: '應用',
            applied: '應用',
            practical: '實務',
            theoretical: '理論',
            theory: '理論',
            model: '模型',
            methodology: '方法論',
            framework: '框架',
            concept: '概念',
            foundational: '基礎',
            abstract: '抽象',
            axiomatic: '公理化',
            empirical: '實證',
            experimental: '實驗',
            observational: '觀測',
            analytical: '分析',
            analysis: '分析',
            quantitative: '量化',
            qualitative: '質化',
            logic: '邏輯',
            algebra: '代數',
            calculus: '微積分',
            geometry: '幾何',
            topology: '拓撲',
            probability: '機率',
            statistics: '統計',
            differential: '微分',
            equations: '方程',
            number: '數論',
            graph: '圖',
            set: '集合',
            field: '領域',
            interdisciplinary: '跨領域',
            cross: '跨',
            domain: '領域',
            molecular: '分子',
            atomic: '原子',
            cellular: '細胞',
            ecological: '生態',
            planetary: '行星',
            cosmic: '宇宙',
            scale: '尺度',
            ethics: '倫理',
            policy: '政策',
            society: '社會',
            social: '社會',
            culture: '文化',
            cultural: '文化',
            cognitive: '認知',
            medical: '醫學',
            biomedical: '生醫',
            chemistry: '化學',
            physics: '物理',
            biology: '生物',
            linguistics: '語言學',
            philosophy: '哲學',
            art: '藝術',
            music: '音樂',
            design: '設計',
            law: '法律',
            cybersecurity: '資安',
            machine: '機器',
            learning: '學習',
            network: '網路',
            systems: '系統',
            system: '系統',
            computing: '計算',
            computer: '電腦',
            language: '語言',
            processing: '處理',
            public: '公共',
            health: '健康',
            significant: '重要',
            established: '成熟',
            unifying: '統一',
        };

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

            if (node.id !== 'machine_learning_concept') {
                return `<p>${escHtml(raw)}</p>`;
            }

            const sentences = raw
                .split(/(?<=[。！？.!?])\s*/)
                .map((part) => part.trim())
                .filter(Boolean);

            const definition = sentences[0] || raw;
            const applications = sentences[1] || '';
            const theory = sentences.slice(2).join(' ') || '';

            const blocks = [
                { title: sectionLabel('definition'), body: definition },
                { title: sectionLabel('applications'), body: applications },
                { title: sectionLabel('theory'), body: theory },
            ].filter((block) => block.body);

            return blocks
                .map((block) => `<p><strong>${escHtml(block.title)}:</strong> ${escHtml(block.body)}</p>`)
                .join('');
        }

        function relationLabel(relationType) {
            const relationKey = {
                logical: 'relLogical',
                historical: 'relHistorical',
                applied: 'relApplied',
                conceptual: 'relConceptual',
                causal: 'relCausal'
            }[relationType];
            return relationKey ? t(relationKey) : relationType;
        }

        function typeLabel(type) {
            const typeKey = {
                field: 'typeField',
                concept: 'typeConcept',
                person: 'typePerson',
                event: 'typeEvent'
            }[type];
            return typeKey ? t(typeKey) : type;
        }

        function nodeLabel(n) {
            if (LANG !== 'en' && n && labelMap[n.id]) return labelMap[n.id];
            return n ? n.label : '';
        }

        function nodeDescription(n) {
            if (!n) return '';
            if (LANG !== 'en' && descriptionMap[n.id]) return descriptionMap[n.id];
            return n.description || enDescriptionMap[n.id] || '';
        }

        async function fetchLocaleLabels(locale) {
            try {
                const primary = await fetch(`/api/i18n/${encodeURIComponent(locale)}`);
                if (primary.ok) {
                    return await primary.json();
                }
            } catch (error) {
                // Fall through to static fallback.
            }

            const fallback = await fetch(`../data/i18n/${encodeURIComponent(locale)}.json`);
            if (fallback.ok) {
                return await fallback.json();
            }

            // Final safety net: if locale assets are missing, fall back to English labels.
            const english = await fetch('../data/i18n/en.json');
            if (english.ok) {
                return await english.json();
            }

            return {};
        }

        async function fetchLocaleDescriptions(locale) {
            if (!locale || locale === 'en') return {};

            try {
                const primary = await fetch(`/api/i18n/${encodeURIComponent(locale)}/descriptions`);
                if (primary.ok) {
                    const payload = await primary.json();
                    if (payload && typeof payload === 'object') {
                        if (payload.descriptions && typeof payload.descriptions === 'object') {
                            return payload.descriptions;
                        }
                        return payload;
                    }
                }
            } catch (error) {
                // Fall through to static fallback.
            }

            const candidates = [
                `../data/i18n/${encodeURIComponent(locale)}_descriptions.json`,
                `../data/i18n/${encodeURIComponent(locale)}_descriptions_batch1.json`
            ];

            for (const path of candidates) {
                try {
                    const response = await fetch(path);
                    if (!response.ok) continue;
                    const payload = await response.json();
                    if (payload && typeof payload === 'object') {
                        if (payload.descriptions && typeof payload.descriptions === 'object') {
                            return payload.descriptions;
                        }
                        return payload;
                    }
                } catch (error) {
                    // Try next candidate.
                }
            }

            return {};
        }

        async function loadLocaleMaps(locale) {
            if (!locale || locale === 'en') {
                return { labels: {}, descriptions: {} };
            }

            if (localeMapsCache[locale]) {
                return localeMapsCache[locale];
            }

            const [labelResult, descriptionResult] = await Promise.allSettled([
                fetchLocaleLabels(locale),
                fetchLocaleDescriptions(locale),
            ]);

            const maps = {
                labels: labelResult.status === 'fulfilled' ? labelResult.value : {},
                descriptions: descriptionResult.status === 'fulfilled' ? descriptionResult.value : {},
            };
            localeMapsCache[locale] = maps;
            return maps;
        }

        function applyI18n() {
            document.getElementById('hdr-home-link').textContent = t('navHome');
            document.getElementById('hdr-graph-link').textContent = t('navGraph');
            document.getElementById('hdr-title').textContent = t('hdrTitle');
            document.getElementById('hdr-subtitle').textContent = t('hdrSubtitle');
            document.getElementById('search-input').placeholder = t('searchPlaceholder');
            document.getElementById('welcome-title').textContent = t('welcomeTitle');
            document.getElementById('welcome-subtitle').textContent = t('welcomeSubtitle');
            document.getElementById('recommend-title').textContent = t('recommended');
            document.getElementById('p-conns-title').textContent = t('connections');
            document.getElementById('btn-reset').textContent = `↺ ${t('btnReset')}`;
            document.getElementById('btn-fit').textContent = `⊡ ${t('btnFit')}`;
            document.getElementById('btn-undo').textContent = `↶ ${t('btnUndo')}`;
            document.getElementById('btn-help').textContent = `⌘ ${t('btnHelp')}`;
            document.getElementById('btn-tour').textContent = `? ${t('btnGuide')}`;
            document.getElementById('btn-reset').title = t('btnResetTitle');
            document.getElementById('btn-fit').title = t('btnFitTitle');
            document.getElementById('btn-undo').title = t('btnUndoTitle');
            document.getElementById('btn-focus').title = t('btnFocusTitle');
            document.getElementById('btn-help').title = t('btnHelpTitle');
            document.getElementById('btn-tour').title = t('btnGuideTitle');
            document.getElementById('pa-expand').textContent = `⊕ ${t('expand')}`;
            document.getElementById('pa-collapse').textContent = `⊖ ${t('collapse')}`;
            document.getElementById('pa-path').textContent = `⤳ ${t('path')}`;

            document.getElementById('ctx-expand').textContent = t('ctxExpand');
            document.getElementById('ctx-collapse').textContent = t('ctxCollapse');
            document.getElementById('ctx-path').textContent = t('ctxPath');
            document.getElementById('ctx-focus').textContent = t('ctxFocus');

            document.getElementById('shortcuts-title').textContent = t('shortcutsTitle');
            document.getElementById('shortcuts-intro').textContent = t('shortcutsIntro');
            document.getElementById('sc-search').textContent = t('scSearch');
            document.getElementById('sc-search-alt').textContent = t('scSearchAlt');
            document.getElementById('sc-undo').textContent = t('scUndo');
            document.getElementById('sc-close').textContent = t('scClose');
            document.getElementById('sc-show').textContent = t('scShow');
            document.getElementById('sc-expand').textContent = t('scExpand');
            document.getElementById('sc-context').textContent = t('scContext');
            document.getElementById('shortcuts-close').textContent = t('shortcutsClose');

            document.getElementById('onboard-skip').textContent = t('onboardingSkip');
            document.getElementById('onboard-hint').textContent = t('onboardingEscHint');

            document.getElementById('legend-logical').textContent = t('relLogical');
            document.getElementById('legend-historical').textContent = t('relHistorical');
            document.getElementById('legend-applied').textContent = t('relApplied');
            document.getElementById('legend-conceptual').textContent = t('relConceptual');
            document.getElementById('legend-causal').textContent = t('relCausal');

            const langToggle = document.getElementById('lang-toggle');
            if (langToggle) langToggle.setAttribute('aria-label', 'Language selector');
            document.querySelector('.lang-btn[data-lang="en"]')?.setAttribute('aria-label', 'Switch language to English');
            document.querySelector('.lang-btn[data-lang="zh"]')?.setAttribute('aria-label', 'Switch language to Chinese');
            document.querySelector('.lang-btn[data-lang="ja"]')?.setAttribute('aria-label', 'Switch language to Japanese');

            document.querySelectorAll('.lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === LANG);
            });

            updateFocusButton();
            if (nodeEls) {
                nodeEls.select('text').text(d => nodeLabel(d));
            }
            renderBreadcrumb();
            updateRecommendations();
            updateStats();
            if (document.getElementById('onboard').classList.contains('visible')) {
                renderTourStep();
            }

            // Re-render current panel to apply localized description instantly.
            if (selectedNodeId && nodeMap[selectedNodeId]) {
                openPanel(nodeMap[selectedNodeId]);
            }
        }

        async function setLang(lang) {
            if (!isValidLang(lang)) return;
            LANG = lang;
            localStorage.setItem('nodus-lang', lang);
            document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;

            const requestSeq = ++localeLoadSeq;
            const maps = await loadLocaleMaps(LANG);
            if (requestSeq !== localeLoadSeq) return;

            labelMap = maps.labels;
            descriptionMap = maps.descriptions;

            applyI18n();
        }

        // ===== DATA LOADING =====
        async function loadData() {
            let apiError = null;
            try {
                const apiPayload = await fetchJsonWithTimeout('/api/graph/full', 9000);
                return normalizeGraphNodes(apiPayload);
            } catch (err) {
                apiError = err;
            }

            try {
                const staticPayload = await fetchJsonWithTimeout('../data/all_nodes.json', 7000);
                return normalizeGraphNodes(staticPayload);
            } catch (err) {
                const reason = apiError ? `${apiError.message}; ${err.message}` : err.message;
                throw new Error(`Unable to load graph data (${reason}).`);
            }
        }

        // ===== GRAPH ENGINE =====
        function initGraph() {
            const W = window.innerWidth, H = window.innerHeight;
            svgEl = d3.select('#canvas').attr('width', W).attr('height', H);

            // SVG defs: radial gradients per domain + glow filter
            const defs = svgEl.append('defs');

            // Glow filter
            const glowFilter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
            glowFilter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '3').attr('result', 'blur');
            glowFilter.append('feMerge').selectAll('feMergeNode')
                .data(['blur', 'SourceGraphic']).enter()
                .append('feMergeNode').attr('in', d => d);

            // Radial gradient for each domain color
            Object.entries(DC).forEach(([domain, color]) => {
                const grad = defs.append('radialGradient')
                    .attr('id', `grad-${domain}`)
                    .attr('cx', '35%').attr('cy', '35%').attr('r', '65%');
                grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.9);
                grad.append('stop').attr('offset', '55%').attr('stop-color', color).attr('stop-opacity', 0.4);
                grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.08);
            });
            // Fallback gradient
            const gradFb = defs.append('radialGradient')
                .attr('id', 'grad-default')
                .attr('cx', '35%').attr('cy', '35%').attr('r', '65%');
            gradFb.append('stop').attr('offset', '0%').attr('stop-color', '#888').attr('stop-opacity', 0.9);
            gradFb.append('stop').attr('offset', '55%').attr('stop-color', '#888').attr('stop-opacity', 0.4);
            gradFb.append('stop').attr('offset', '100%').attr('stop-color', '#888').attr('stop-opacity', 0.08);

            // Layered STAR gradients per domain (+ default): white-hot core →
            // tight colored glow → mid halo → faint corona. brightness IS body.
            function starStops(id, stops) {
                const gr = defs.append('radialGradient').attr('id', id).attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
                stops.forEach(([off, col, op]) => {
                    const s = gr.append('stop').attr('offset', off).attr('stop-color', col);
                    if (op != null) s.attr('stop-opacity', op);
                });
            }
            const starDomains = { ...DC, default: '#8aa0bf' };
            Object.entries(starDomains).forEach(([domain, color]) => {
                starStops('core-' + domain, [
                    ['0%', '#ffffff', 1], ['22%', '#ffffff', 0.98], ['48%', '#ffffff', 0.78],
                    ['70%', hexA(color, 0.55)], ['88%', hexA(color, 0.22)], ['100%', hexA(color, 0)],
                ]);
                starStops('glow-' + domain, [
                    ['0%', hexA(color, 0.92)], ['24%', hexA(color, 0.58)], ['55%', hexA(color, 0.18)], ['100%', hexA(color, 0)],
                ]);
                starStops('halo-' + domain, [
                    ['0%', hexA(color, 0.32)], ['38%', hexA(color, 0.13)], ['78%', hexA(color, 0.035)], ['100%', hexA(color, 0)],
                ]);
                starStops('corona-' + domain, [
                    ['0%', hexA(color, 0)], ['30%', hexA(color, 0.035)], ['65%', hexA(color, 0.012)], ['100%', hexA(color, 0)],
                ]);
            });
            // Edge glow filter — fluorescent halo for the lit constellation.
            const eglow = defs.append('filter').attr('id', 'edge-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
            eglow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '1.4').attr('result', 'eb');
            eglow.append('feMerge').selectAll('feMergeNode').data(['eb', 'SourceGraphic']).enter().append('feMergeNode').attr('in', d => d);

            g = svgEl.append('g');
            // Test/debug handles consumed by the E2E regression guards (tests/e2e).
            // These were implicitly global when the explorer ran as an inline classic
            // script; the ES-module refactor makes the exposure explicit. Inert in prod.
            window.g = g;
            window.startExploration = startExploration;

            zoomBehavior = d3.zoom()
                .scaleExtent([0.1, 8])
                .on('zoom', e => {
                    g.attr('transform', e.transform);
                    currentZoom = e.transform.k;
                    // Constant apparent size: counter-scale by 1/k so the glow is
                    // a permanent fixed-size part of each star. Skip on pure pan.
                    if (e.transform.k !== lastScaleK) {
                        lastScaleK = e.transform.k;
                        nodeScale = Math.min(12, Math.max(0.15, 1 / e.transform.k));
                        if (nodeEls) nodeEls.attr('transform', d => `translate(${d.x},${d.y}) scale(${nodeScale})`);
                    }
                    updateLabels();
                    updateZoomIndicator();
                    applyLinkLOD();
                });
            svgEl.call(zoomBehavior);

            // Click background to close panel
            svgEl.on('click', (e) => {
                if (e.target === svgEl.node()) {
                    closePanel();
                    clearHighlights();
                }
            });

            sim = d3.forceSimulation([])
                .force('link', d3.forceLink([]).id(d => d.id).distance(d => {
                    const s = nodeMap[d.source.id || d.source];
                    const t = nodeMap[d.target.id || d.target];
                    if (s && t && s.type === 'field' && t.type === 'field') return 140;
                    if ((s && s.type === 'field') || (t && t.type === 'field')) return 90;
                    return 60;
                }).strength(0.4))
                .force('charge', d3.forceManyBody().strength(d => d.type === 'field' ? -400 : -150))
                .force('center', d3.forceCenter(W / 2, H / 2).strength(0.05))
                .force('collision', d3.forceCollide(d => nr(nodeMap[d.id] || d) + 8))
                .alphaDecay(0.03)
                .on('tick', scheduleTick);

            // Link and node groups
            g.append('g').attr('class', 'links');
            g.append('g').attr('class', 'focus-curves');
            g.append('g').attr('class', 'nodes');
        }

        function tick() {
            if (!tickScheduled) return;
            tickScheduled = false;
            if (linkEls) {
                linkEls
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
            }
            if (focusCurveEls) {
                focusCurveEls.attr('d', d => curvedEdgePath(d));
            }
            if (photonEls) {
                photonEls.attr('d', d => curvedEdgePath(d));
            }
            if (nodeEls) {
                nodeEls.attr('transform', d => `translate(${d.x},${d.y}) scale(${nodeScale})`);
            }
            // Ease-to-rest: ramp friction up near the stopping point so the layout
            // glides to a halt instead of freezing. Stop time / final layout
            // unchanged; auto-resets to base friction when re-heated (expand/drag).
            if (sim) {
                const a = sim.alpha();
                if (a < 0.02) {
                    const tt = Math.min(1, (0.02 - a) / 0.019);
                    sim.velocityDecay(0.4 + tt * 0.5);
                } else if (sim.velocityDecay() !== 0.4) {
                    sim.velocityDecay(0.4);
                }
            }
        }

        let tickScheduled = false;
        function scheduleTick() {
            if (!tickScheduled) {
                tickScheduled = true;
                requestAnimationFrame(tick);
            }
        }

        function rebuildVisuals() {
            updatePerfMode();
            // Rebuild visible arrays
            visibleNodes = Array.from(visibleNodeIds).map(id => {
                // Preserve existing position if node was already in sim
                const existing = sim.nodes().find(n => n.id === id);
                if (existing) return existing;
                const raw = nodeMap[id];
                return { ...raw };
            });

            const edgeSet = new Set();
            visibleEdges = [];
            for (const id of visibleNodeIds) {
                for (const conn of (adjacency[id] || [])) {
                    if (!visibleNodeIds.has(conn.target)) continue;
                    const key = [id, conn.target].sort().join('|') + '|' + conn.relation_type;
                    if (edgeSet.has(key)) continue;
                    edgeSet.add(key);
                    visibleEdges.push({
                        source: id,
                        target: conn.target,
                        relation_type: conn.relation_type,
                        pending: conn.pending
                    });
                }
            }

            // Update simulation with adaptive parameters
            sim.nodes(visibleNodes);
            sim.force('link').links(visibleEdges);

            // Adapt force parameters based on graph size
            const n = visibleNodes.length;
            if (n > 100) {
                sim.force('charge').strength(d => d.type === 'field' ? -250 : -80);
                sim.alphaDecay(0.04);
            } else if (n > 50) {
                sim.force('charge').strength(d => d.type === 'field' ? -350 : -120);
                sim.alphaDecay(0.035);
            } else {
                sim.force('charge').strength(d => d.type === 'field' ? -400 : -150);
                sim.alphaDecay(0.03);
            }

            sim.alpha(0.6).restart();

            // Rebind links
            linkEls = g.select('.links').selectAll('line').data(visibleEdges, d => {
                const sId = d.source.id || d.source;
                const tId = d.target.id || d.target;
                return [sId, tId].sort().join('|') + '|' + d.relation_type;
            });
            linkEls.exit().transition().duration(200).style('opacity', 0).remove();
            const linkEnter = linkEls.enter().append('line')
                .attr('class', d => {
                    let cls = 'link ' + d.relation_type + (d.pending ? ' pending' : '');
                    const sId = d.source.id || d.source;
                    const tId = d.target.id || d.target;
                    if (expandedNodeIds.has(sId) && expandedNodeIds.has(tId)) cls += ' structural';
                    return cls;
                })
                .style('opacity', 0)
                .on('mouseenter', (e, d) => showLinkTooltip(e, d))
                .on('mousemove', (e) => moveLinkTooltip(e))
                .on('mouseleave', () => hideLinkTooltip());
            linkEnter.transition().duration(350).style('opacity', null);
            linkEls = linkEnter.merge(linkEls);
            linkNodeRefs = linkEls.nodes();

            focusCurveEls = g.select('.focus-curves').selectAll('path').data(visibleEdges, d => edgeKey(d));
            focusCurveEls.exit().remove();
            const focusEnter = focusCurveEls.enter().append('path')
                .attr('class', d => 'link focus-curve ' + d.relation_type + (d.pending ? ' pending' : ''));
            focusCurveEls = focusEnter.merge(focusCurveEls);

            // Update structural class on existing links
            linkEls.classed('structural', d => {
                const sId = d.source.id || d.source;
                const tId = d.target.id || d.target;
                return expandedNodeIds.has(sId) && expandedNodeIds.has(tId);
            });

            // Rebind nodes
            nodeEls = g.select('.nodes').selectAll('.node').data(visibleNodes, d => d.id);
            nodeEls.exit().transition().duration(200).style('opacity', 0).remove();

            const nodeEnter = nodeEls.enter().append('g')
                .attr('class', d => {
                    let cls = 'node';
                    if (expandedNodeIds.has(d.id)) cls += ' expanded';
                    if (!expandedNodeIds.has(d.id)) cls += ' frontier';
                    return cls;
                })
                .style('opacity', 0)
                .call(d3.drag()
                    .on('start', dragStart)
                    .on('drag', dragging)
                    .on('end', dragEnd))
                .on('click', (e, d) => { e.stopPropagation(); handleClick(d); })
                .on('dblclick', (e, d) => { e.stopPropagation(); e.preventDefault(); expandNode(d.id); })
                .on('mouseenter', (e, d) => showTooltip(e, d))
                .on('mousemove', (e, d) => moveTooltip(e))
                .on('mouseleave', () => hideTooltip());

            // STAR BODY — corona → halo → glow → core → core-hi (centred at 0,0;
            // the node <g> transform carries them, so the tick is untouched).
            nodeEnter.append('circle')
                .attr('class', 'corona twinkle')
                .attr('r', d => esm(d).corona)
                .style('fill', d => `url(#corona-${d.domain[0] || 'default'})`)
                .style('pointer-events', 'none')
                .style('animation-duration', d => `${esm(d).twDur}s`)
                .style('animation-delay', d => `${esm(d).twDelay}s`);

            nodeEnter.append('circle')
                .attr('class', 'halo')
                .attr('r', d => esm(d).halo)
                .style('fill', d => `url(#halo-${d.domain[0] || 'default'})`)
                .style('pointer-events', 'none');

            nodeEnter.append('circle')
                .attr('class', 'glow')
                .attr('r', d => esm(d).glow)
                .style('fill', d => `url(#glow-${d.domain[0] || 'default'})`)
                .style('opacity', d => esm(d).glowAlpha)
                .style('pointer-events', 'none');

            nodeEnter.append('circle')
                .attr('class', 'core')
                .attr('r', d => esm(d).core)
                .style('fill', d => `url(#core-${d.domain[0] || 'default'})`)
                .style('color', d => nc(d));

            nodeEnter.append('circle')
                .attr('class', 'core-hi')
                .attr('r', d => Math.max(0.7, esm(d).core * 0.42))
                .style('fill', '#ffffff')
                .style('pointer-events', 'none');

            // Expand ring for frontier nodes (functional affordance — kept)
            nodeEnter.append('circle')
                .attr('class', 'expand-ring')
                .attr('r', d => Math.max(nr(d) + 6, esm(d).glow + 4));

            nodeEnter.append('text')
                .text(d => nodeLabel(d))
                .attr('dy', d => Math.max(esm(d).halo * 0.5, nr(d) + 12))
                .style('font-size', d => d.type === 'field' ? '11px' : '10px')
                .style('fill', '#d4e4fa')
                .style('opacity', 0);

            // Neighbor count badge for frontier nodes
            nodeEnter.append('text')
                .attr('class', 'neighbor-count')
                .attr('dy', d => -nr(d) - 4)
                .text(d => {
                    const count = neighborCount(d.id);
                    return count > 0 ? `+${count}` : '';
                });

            // Entrance: opacity fade (the scale pop is driven by the .entering
            // class, added below after the class attribute is rebuilt).
            nodeEnter.transition().duration(350).style('opacity', 1);

            nodeEls = nodeEnter.merge(nodeEls);

            // Update classes for existing nodes
            nodeEls.attr('class', d => {
                let cls = 'node tier-' + esm(d).tier;
                if (expandedNodeIds.has(d.id)) cls += ' expanded';
                else cls += ' frontier';
                if (d.id === selectedNodeId) cls += ' center-node';
                return cls;
            });

            // Trigger the scale-pop entrance now that .attr('class') (which would
            // otherwise wipe it) has run. Drop the class once the 0.5s animation
            // finishes so circles revert to their resting styles.
            nodeEnter.classed('entering', true);
            setTimeout(() => nodeEnter.classed('entering', false), 560);

            // Update expand ring visibility
            nodeEls.select('.expand-ring')
                .attr('r', d => Math.max(nr(d) + 6, esm(d).glow + 4))
                .style('display', d => expandedNodeIds.has(d.id) ? 'none' : null);

            // Update neighbor count badges
            nodeEls.select('.neighbor-count')
                .text(d => {
                    if (expandedNodeIds.has(d.id)) return '';
                    const count = neighborCount(d.id);
                    return count > 0 ? `+${count}` : '';
                });

            updateLabels();
            updateStats();
            updateRecommendations();
            applyFocusMode();
            saveState();
            refreshFocusCurves();
        }

        function updateLabels() {
            if (!nodeEls) return;
            nodeEls
                .classed('related-node', d => relatedLabelIds.has(d.id))
                .select('text')
                .style('opacity', d => {
                    const degree = (adjacency[d.id] || []).length;
                    const isSelected = d.id === selectedNodeId;

                    if (relatedLabelIds.has(d.id)) return 0.92;
                    if (isSelected) return 0.96;
                    if (d.type === 'field') return currentZoom > 0.6 ? 0.86 : 0.72;
                    if (currentZoom > 1.8) return 0.72;
                    if (currentZoom > 1.15 && degree >= 8) return 0.58;
                    if (d.type === 'person' || d.type === 'event') return currentZoom > 1.25 ? 0.56 : 0;
                    return currentZoom > 1.45 ? 0.5 : 0;
                });
        }

        function getRelatedNodeIds(nodeId) {
            const ids = new Set([nodeId]);
            for (const edge of visibleEdges) {
                const sId = edge.source.id || edge.source;
                const tId = edge.target.id || edge.target;
                if (sId === nodeId) ids.add(tId);
                else if (tId === nodeId) ids.add(sId);
            }
            return ids;
        }

        function updateStats() {
            const el = document.getElementById('stats');
            const filterBar = document.getElementById('filter-bar');
            if (visibleNodeIds.size === 0) {
                el.style.display = 'none';
                filterBar.classList.remove('visible');
                return;
            }
            el.style.display = 'block';
            filterBar.classList.add('visible');
            const filterText = activeFilter || t('all');
            el.textContent = `${visibleNodeIds.size} ${t('explored')} · ${allNodesRaw.length} ${t('total')} · ${filterText}`;
        }

        // ===== EXPAND LOGIC =====
        function expandNode(id) {
            if (!nodeMap[id]) return;
            if (expandedNodeIds.has(id)) return; // already expanded

            // Save undo snapshot before mutation
            undoStack.push({
                visible: new Set(visibleNodeIds),
                expanded: new Set(expandedNodeIds),
                history: [...explorationHistory]
            });
            if (undoStack.length > 30) undoStack.shift();
            document.getElementById('btn-undo').disabled = false;

            expandedNodeIds.add(id);
            visibleNodeIds.add(id);

            // Track exploration history
            explorationHistory.push(id);
            if (explorationHistory.length > 12) explorationHistory.shift();
            renderBreadcrumb();

            // Add all neighbors
            const neighbors = adjacency[id] || [];
            for (const conn of neighbors) {
                if (nodeMap[conn.target]) {
                    visibleNodeIds.add(conn.target);
                }
            }

            // Position new nodes near the expanded node
            const existing = sim.nodes().find(n => n.id === id);
            if (existing) {
                for (const conn of neighbors) {
                    if (!sim.nodes().find(n => n.id === conn.target)) {
                        // Will be positioned in rebuildVisuals via spread
                    }
                }
            }

            rebuildVisuals();

            // Position new nodes near parent
            if (existing) {
                const newNodes = sim.nodes().filter(n => {
                    return neighbors.some(c => c.target === n.id) && (n.x === undefined || isNaN(n.x));
                });
                for (const n of newNodes) {
                    n.x = existing.x + (Math.random() - 0.5) * 60;
                    n.y = existing.y + (Math.random() - 0.5) * 60;
                }
            }

            // Auto-pan to center the expanded node after layout settles
            setTimeout(() => {
                const node = sim.nodes().find(n => n.id === id);
                if (node && !isNaN(node.x)) {
                    const W = window.innerWidth, H = window.innerHeight;
                    const transform = d3.zoomIdentity
                        .translate(W / 2 + getPanelOffset(), H / 2)
                        .scale(Math.max(currentZoom, 1))
                        .translate(-node.x, -node.y);
                    svgEl.transition().duration(500).call(zoomBehavior.transform, transform);
                }
            }, 600);

            // Hide welcome
            document.getElementById('welcome').classList.add('hidden');
        }

        function startExploration(id) {
            // Clear everything and start fresh from this node
            visibleNodeIds.clear();
            expandedNodeIds.clear();
            selectedNodeId = id;

            // Remove existing graph elements
            g.select('.links').selectAll('*').remove();
            g.select('.nodes').selectAll('*').remove();
            sim.nodes([]);
            sim.force('link').links([]);

            // Expand the starting node
            expandNode(id);

            // Center view on the node after a brief layout settle
            setTimeout(() => {
                const node = sim.nodes().find(n => n.id === id);
                if (node) {
                    const W = window.innerWidth, H = window.innerHeight;
                    const transform = d3.zoomIdentity
                        .translate(W / 2, H / 2)
                        .scale(1.2)
                        .translate(-node.x, -node.y);
                    svgEl.transition().duration(600).call(zoomBehavior.transform, transform);
                }
            }, 800);
        }

        function resetGraph() {
            // Smooth zoom out before clearing
            svgEl.transition().duration(500).ease(d3.easeCubicInOut)
                .call(zoomBehavior.transform, d3.zoomIdentity)
                .on('end', () => {
                    visibleNodeIds.clear();
                    expandedNodeIds.clear();
                    selectedNodeId = null;
                    undoStack = [];
                    explorationHistory = [];
                    g.select('.links').selectAll('*').remove();
                    g.select('.nodes').selectAll('*').remove();
                    sim.nodes([]);
                    sim.force('link').links([]);
                    linkEls = null;
                    nodeEls = null;
                    closePanel();
                    updateStats();
                    renderBreadcrumb();
                    document.getElementById('btn-undo').disabled = true;
                    document.getElementById('welcome').classList.remove('hidden');
                    // Clear persistence
                    localStorage.removeItem(STORAGE_KEY);
                    history.replaceState(null, '', window.location.pathname);
                    updatePerfMode();
                });
        }

        function fitView() {
            if (visibleNodes.length === 0) return;
            const W = window.innerWidth, H = window.innerHeight;
            const xs = visibleNodes.map(n => n.x).filter(x => !isNaN(x));
            const ys = visibleNodes.map(n => n.y).filter(y => !isNaN(y));
            if (xs.length === 0) return;

            const x0 = Math.min(...xs) - 40;
            const x1 = Math.max(...xs) + 40;
            const y0 = Math.min(...ys) - 40;
            const y1 = Math.max(...ys) + 40;
            const dx = x1 - x0, dy = y1 - y0;
            const scale = Math.min(W / dx, H / dy, 2) * 0.85;
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;

            const transform = d3.zoomIdentity
                .translate(W / 2, H / 2)
                .scale(scale)
                .translate(-cx, -cy);
            svgEl.transition().duration(500).call(zoomBehavior.transform, transform);
        }

        // ===== TOOLTIP =====
        const tooltipEl = document.getElementById('tooltip');

        function showTooltip(e, d) {
            const node = nodeMap[d.id] || d;
            tooltipEl.querySelector('.tt-label').textContent = nodeLabel(node);
            tooltipEl.querySelector('.tt-desc').textContent = truncate(nodeDescription(node), 80);
            const hidden = neighborCount(d.id);
            const domains = node.domain.join(', ');
            tooltipEl.querySelector('.tt-meta').textContent = `${typeLabel(node.type)} · ${domains}${hidden > 0 ? ` · ${hidden} ${t('hiddenConnections')}` : ''}`;
            moveTooltip(e);
            tooltipEl.classList.add('visible');
        }

        function moveTooltip(e) {
            const x = e.clientX + 14;
            const y = e.clientY + 14;
            tooltipEl.style.left = x + 'px';
            tooltipEl.style.top = y + 'px';
        }

        function hideTooltip() {
            tooltipEl.classList.remove('visible');
        }

        // ===== LINK TOOLTIP =====
        const linkTooltipEl = document.getElementById('link-tooltip');

        function showLinkTooltip(e, d) {
            const sNode = nodeMap[d.source.id || d.source];
            const tNode = nodeMap[d.target.id || d.target];
            if (!sNode || !tNode) return;
            linkTooltipEl.textContent = `${nodeLabel(sNode)} — ${relationLabel(d.relation_type)} — ${nodeLabel(tNode)}`;
            moveLinkTooltip(e);
            linkTooltipEl.classList.add('visible');
        }

        function moveLinkTooltip(e) {
            linkTooltipEl.style.left = (e.clientX + 10) + 'px';
            linkTooltipEl.style.top = (e.clientY - 24) + 'px';
        }

        function hideLinkTooltip() {
            linkTooltipEl.classList.remove('visible');
        }

        // ===== INTERACTION =====
        function handleClick(d) {
            selectedNodeId = d.id;
            relatedLabelIds = getRelatedNodeIds(d.id);
            openPanel(d);
            highlightNode(d.id);
            applyFocusMode();
            centerViewOnNode(d, 420);
            updateLabels();

            // Update node classes
            if (nodeEls) {
                nodeEls.attr('class', nd => {
                    let cls = 'node';
                    if (expandedNodeIds.has(nd.id)) cls += ' expanded';
                    else cls += ' frontier';
                    if (nd.id === selectedNodeId) cls += ' center-node';
                    return cls;
                });
            }
        }

        function percentile(sortedValues, p) {
            if (!sortedValues.length) return 0;
            const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * p)));
            return sortedValues[idx];
        }

        function connectedPointsForNode(nodeId) {
            const points = [];
            for (const edge of visibleEdges) {
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
            if (!neighbors.length) return Math.max(0.9, Math.min(2.4, currentZoom || 1.2));

            const distances = neighbors
                .map(n => Math.hypot((n.x - node.x), (n.y - node.y)))
                .filter(d => Number.isFinite(d) && d > 0)
                .sort((a, b) => a - b);

            if (!distances.length) return Math.max(0.9, Math.min(2.4, currentZoom || 1.2));

            // Sacrifice far boundary nodes and frame the closest cluster for readability.
            const nearestCount = Math.max(10, Math.min(28, Math.floor(distances.length * 0.55)));
            const nearestDistances = distances.slice(0, nearestCount);
            const focusRadius = Math.max(26, percentile(nearestDistances, 0.82));
            const targetRadiusPx = Math.min(availableWidth * 0.42, availableHeight * 0.44);
            const nextScale = targetRadiusPx / focusRadius;
            return Math.max(0.95, Math.min(4.2, nextScale));
        }

        function centerViewOnNode(node, duration = 500) {
            if (!svgEl || !zoomBehavior || !node || Number.isNaN(node.x) || Number.isNaN(node.y)) return;
            const W = window.innerWidth;
            const H = window.innerHeight;
            const panelOffset = getPanelOffset();
            const availableWidth = Math.max(240, W + panelOffset * 2);
            const centerX = availableWidth / 2;
            const scale = estimateAdaptiveScale(node, availableWidth, H);
            const transform = d3.zoomIdentity
                .translate(centerX, H / 2)
                .scale(scale)
                .translate(-node.x, -node.y);
            svgEl.transition().duration(duration).call(zoomBehavior.transform, transform);
        }

        function highlightNode(id) {
            clearHighlights();
            if (!linkEls) return;
            linkEls.classed('highlight', d => {
                const sId = d.source.id || d.source;
                const tId = d.target.id || d.target;
                return sId === id || tId === id;
            });
            linkEls.classed('dimmed', d => {
                const sId = d.source.id || d.source;
                const tId = d.target.id || d.target;
                return sId !== id && tId !== id;
            });
            refreshFocusCurves();
        }

        function clearHighlights() {
            if (linkEls) {
                linkEls.classed('highlight', false).classed('dimmed', false);
            }
            relatedLabelIds = new Set();
            updateLabels();
            refreshFocusCurves();
        }

        function updateFocusButton() {
            const btn = document.getElementById('btn-focus');
            if (focusDepth === 0) {
                btn.textContent = `◎ ${t('focusOff')}`;
            } else if (focusDepth === 1) {
                btn.textContent = `◎ ${t('focus1')}`;
            } else {
                btn.textContent = `◎ ${t('focus2')}`;
            }
            btn.classList.toggle('active', focusDepth > 0);
        }

        function applyFocusMode() {
            if (!nodeEls || !linkEls) return;

            if (focusDepth === 0 || !selectedNodeId) {
                nodeEls.classed('focus-dim', false).classed('focus-keep', false);
                linkEls.classed('focus-dim', false).classed('focus-keep', false);
                refreshFocusCurves();
                return;
            }

            const graphAdj = {};
            for (const e of visibleEdges) {
                const sId = e.source.id || e.source;
                const tId = e.target.id || e.target;
                if (!graphAdj[sId]) graphAdj[sId] = [];
                if (!graphAdj[tId]) graphAdj[tId] = [];
                graphAdj[sId].push(tId);
                graphAdj[tId].push(sId);
            }

            const keepNodes = new Set([selectedNodeId]);
            let frontier = [selectedNodeId];
            for (let depth = 0; depth < focusDepth; depth++) {
                const next = [];
                for (const id of frontier) {
                    for (const nb of (graphAdj[id] || [])) {
                        if (keepNodes.has(nb)) continue;
                        keepNodes.add(nb);
                        next.push(nb);
                    }
                }
                if (next.length === 0) break;
                frontier = next;
            }

            nodeEls
                .classed('focus-keep', d => keepNodes.has(d.id))
                .classed('focus-dim', d => !keepNodes.has(d.id));

            linkEls
                .classed('focus-keep', d => {
                    const sId = d.source.id || d.source;
                    const tId = d.target.id || d.target;
                    return keepNodes.has(sId) && keepNodes.has(tId);
                })
                .classed('focus-dim', d => {
                    const sId = d.source.id || d.source;
                    const tId = d.target.id || d.target;
                    return !(keepNodes.has(sId) && keepNodes.has(tId));
                });
            refreshFocusCurves();
        }

        function dragStart(e, d) {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
            d3.select(e.currentTarget).classed('dragging', true);
        }

        function dragging(e, d) {
            d.fx = e.x;
            d.fy = e.y;
        }

        function dragEnd(e, d) {
            if (!e.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
            d3.select(e.currentTarget).classed('dragging', false);
        }

        // ===== PANEL =====
        function openPanel(d) {
            const node = nodeMap[d.id] || d;
            document.getElementById('p-type').textContent = typeLabel(node.type);
            document.getElementById('p-type').style.color = nc(node);
            document.getElementById('p-label').textContent = nodeLabel(node);
            document.getElementById('p-domains').innerHTML = node.domain.map(dm =>
                `<span class="d-badge" style="color:${DC[dm]}">${escHtml(dm)}</span>`
            ).join('');
            document.getElementById('p-desc').innerHTML = renderPanelDescription(node);
            document.getElementById('p-tags').innerHTML = (node.display_tags || []).map((tag) =>
                `<span class="tag">${escHtml(localizeTag(tag))}</span>`
            ).join('');

            // Era
            const era = node.era;
            if (era && era.start != null) {
                const s = era.start < 0 ? `${Math.abs(era.start)} ${t('eraBce')}` : String(era.start);
                const end = era.end != null ? (era.end < 0 ? `${Math.abs(era.end)} ${t('eraBce')}` : String(era.end)) : t('eraPresent');
                document.getElementById('p-era').textContent = `${s} — ${end}`;
            } else {
                document.getElementById('p-era').textContent = '';
            }

            // Connections
            const conns = (node.connections || []).filter(c => nodeMap[c.target]);
            conns.sort((a, b) => {
                const aVis = visibleNodeIds.has(a.target) ? 0 : 1;
                const bVis = visibleNodeIds.has(b.target) ? 0 : 1;
                return aVis - bVis;
            });

            const CONN_LIMIT = 5;
            const connCountEl = document.getElementById('p-conn-count');
            connCountEl.textContent = `(${conns.length})`;

            function renderConns(list) {
                return list.map(c => {
                    const target = nodeMap[c.target];
                    const inGraph = visibleNodeIds.has(c.target);
                    const cls = inGraph ? 'ci in-graph' : 'ci';
                    const expandIcon = inGraph ? '' : '<span class="ci-expand">+</span>';
                    return `<div class="${cls}" data-id="${escHtml(c.target)}">
                        <div class="cd" style="background:${nc(target)}"></div>
                        <span class="ci-label">${escHtml(nodeLabel(target))}</span>
                        <span class="cr" style="color:${RC[c.relation_type] || '#888'}">${escHtml(relationLabel(c.relation_type))}</span>
                        ${expandIcon}
                    </div>`;
                }).join('');
            }

            const connListEl = document.getElementById('p-conn-list');
            const moreBtn = document.getElementById('p-conn-more');
            let showingAll = conns.length <= CONN_LIMIT;

            connListEl.innerHTML = renderConns(showingAll ? conns : conns.slice(0, CONN_LIMIT));
            moreBtn.style.display = conns.length > CONN_LIMIT ? 'block' : 'none';
            moreBtn.textContent = showingAll ? t('showLess') : `${t('showAll')} (${conns.length})`;

            moreBtn.onclick = () => {
                showingAll = !showingAll;
                connListEl.innerHTML = renderConns(showingAll ? conns : conns.slice(0, CONN_LIMIT));
                moreBtn.textContent = showingAll ? t('showLess') : `${t('showAll')} (${conns.length})`;
                bindConnClicks();
            };

            function bindConnClicks() {
                connListEl.querySelectorAll('.ci').forEach(el => {
                    el.addEventListener('click', () => {
                        const targetId = el.dataset.id;
                        if (!visibleNodeIds.has(targetId)) {
                            visibleNodeIds.add(targetId);
                            expandNode(targetId);
                        }
                        const targetNode = sim.nodes().find(n => n.id === targetId);
                        if (targetNode) {
                            handleClick(targetNode);
                            const W = window.innerWidth, H = window.innerHeight;
                            const transform = d3.zoomIdentity
                                .translate(W / 2 + getPanelOffset(), H / 2)
                                .scale(currentZoom)
                                .translate(-targetNode.x, -targetNode.y);
                            svgEl.transition().duration(400).call(zoomBehavior.transform, transform);
                        }
                    });
                });
            }
            bindConnClicks();

            // Panel action buttons
            const paExpand = document.getElementById('pa-expand');
            const paCollapse = document.getElementById('pa-collapse');
            const paPath = document.getElementById('pa-path');
            const isExpanded = expandedNodeIds.has(d.id);
            paExpand.style.display = isExpanded ? 'none' : 'inline-block';
            paCollapse.style.display = isExpanded ? 'inline-block' : 'none';
            paPath.style.display = (explorationHistory.length > 1 && explorationHistory[explorationHistory.length - 1] !== d.id) ? 'inline-block' : 'none';

            paExpand.onclick = () => { expandNode(d.id); openPanel(d); };
            paCollapse.onclick = () => { collapseNode(d.id); closePanel(); };
            paPath.onclick = () => {
                const lastExpanded = explorationHistory[explorationHistory.length - 1];
                if (lastExpanded && lastExpanded !== d.id) {
                    clearPath();
                    const path = findShortestPath(lastExpanded, d.id);
                    if (path) showPath(path);
                }
            };

            document.getElementById('panel').classList.add('open');
            // Hide recommendations when panel opens
            document.getElementById('recommend').classList.remove('visible');
        }

        function closePanel() {
            document.getElementById('panel').classList.remove('open');
            selectedNodeId = null;
            applyFocusMode();
            // Re-show recommendations if applicable
            updateRecommendations();
        }

        // ===== ONBOARDING =====
        function clearTourTargets() {
            document.querySelectorAll('.tour-target').forEach(el => el.classList.remove('tour-target'));
        }

        function renderTourStep() {
            const tourSteps = getTourSteps();
            const step = tourSteps[tourIndex];
            if (!step) return;

            document.getElementById('onboard-step').textContent = step.step;
            document.getElementById('onboard-title').textContent = step.title;
            document.getElementById('onboard-text').textContent = step.text;
            document.getElementById('onboard-next').textContent =
                tourIndex === tourSteps.length - 1 ? t('onboardingDone') : t('onboardingNext');

            clearTourTargets();
            const target = document.getElementById(step.target);
            if (target) target.classList.add('tour-target');
        }

        function closeTour(markDone = true) {
            document.getElementById('onboard').classList.remove('visible');
            clearTourTargets();
            if (markDone) {
                localStorage.setItem(TOUR_KEY, 'done');
            }
        }

        function openShortcuts() {
            closeTour(false);
            document.getElementById('shortcuts').classList.add('visible');
        }

        function closeShortcuts() {
            document.getElementById('shortcuts').classList.remove('visible');
        }

        function startTour(force = false) {
            if (!force && localStorage.getItem(TOUR_KEY) === 'done') return;
            closeShortcuts();
            tourIndex = 0;
            document.getElementById('onboard').classList.add('visible');
            renderTourStep();
        }

        function setupOnboarding() {
            const onboard = document.getElementById('onboard');
            const onboardCard = document.getElementById('onboard-card');

            document.getElementById('onboard-next').addEventListener('click', () => {
                if (tourIndex >= getTourSteps().length - 1) {
                    closeTour(true);
                    return;
                }
                tourIndex += 1;
                renderTourStep();
            });

            document.getElementById('onboard-skip').addEventListener('click', () => {
                closeTour(true);
            });

            onboard.addEventListener('click', (e) => {
                if (e.target === onboard) closeTour(true);
            });
            onboardCard.addEventListener('click', (e) => e.stopPropagation());
        }

        // ===== SEARCH =====
        function setupSearch() {
            const input = document.getElementById('search-input');
            const results = document.getElementById('search-results');
            let debounceTimer = null;
            let activeIndex = -1;

            function hideResults(clearInput = false) {
                results.style.display = 'none';
                activeIndex = -1;
                if (clearInput) {
                    input.value = '';
                }
            }

            function renderResults(matches) {
                activeIndex = -1;
                if (matches.length === 0) {
                    hideResults();
                    return;
                }

                results.innerHTML = matches.map(n => {
                    const inGraph = visibleNodeIds.has(n.id);
                    const inCls = inGraph ? ' in-graph' : '';
                    const inBadge = inGraph ? `<span class="sr-in-badge">${t('inGraph')}</span>` : '';
                    return `<div class="sr${inCls}" data-id="${escHtml(n.id)}">
                        <div class="sr-dot" style="background:${nc(n)}"></div>
                        <span class="sr-label">${escHtml(nodeLabel(n))}</span>
                        <span class="sr-type">${escHtml(typeLabel(n.type))}</span>
                        <div class="sr-domains">
                            ${n.domain.map(d => `<span class="sr-domain" style="color:${DC[d]}">${d}</span>`).join('')}
                        </div>
                        ${inBadge}
                    </div>`;
                }).join('');
                results.style.display = 'block';

                results.querySelectorAll('.sr').forEach(el => {
                    el.addEventListener('click', () => selectResult(el.dataset.id));
                });
            }

            function selectResult(id) {
                results.style.display = 'none';
                input.value = '';
                input.blur();
                startExploration(id);
            }

            function updateActiveResult() {
                const items = results.querySelectorAll('.sr');
                items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
                if (activeIndex >= 0 && items[activeIndex]) {
                    items[activeIndex].scrollIntoView({ block: 'nearest' });
                }
            }

            input.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const q = input.value.trim().toLowerCase();
                    if (q.length < 1) {
                        hideResults();
                        return;
                    }
                    const matches = allNodesRaw.filter(n => {
                        return nodeLabel(n).toLowerCase().includes(q) ||
                            n.id.toLowerCase().includes(q) ||
                            n.domain.some(d => d.toLowerCase() === q) ||
                            (n.display_tags || []).some(t => t.toLowerCase().includes(q));
                    }).slice(0, 10);

                    renderResults(matches);
                }, 120);
            });

            input.addEventListener('keydown', (e) => {
                const items = results.querySelectorAll('.sr');
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (items.length > 0) {
                        activeIndex = Math.min(activeIndex + 1, items.length - 1);
                        updateActiveResult();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (items.length > 0) {
                        activeIndex = Math.max(activeIndex - 1, 0);
                        updateActiveResult();
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (activeIndex >= 0 && items[activeIndex]) {
                        selectResult(items[activeIndex].dataset.id);
                    } else if (items.length > 0) {
                        selectResult(items[0].dataset.id);
                    }
                } else if (e.key === 'Escape') {
                    hideResults(true);
                    input.value = '';
                    input.blur();
                }
            });

            // Close results on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#search-box')) {
                    hideResults();
                }
            });

            // Focus search on Ctrl+K or /
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && document.activeElement === input) {
                    hideResults(true);
                    input.value = '';
                    input.blur();
                    return;
                }
                if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== input)) {
                    e.preventDefault();
                    input.focus();
                    input.select();
                }
            });
        }

        // ===== UNDO =====
        function undo() {
            if (undoStack.length === 0) return;
            const snapshot = undoStack.pop();
            visibleNodeIds = snapshot.visible;
            expandedNodeIds = snapshot.expanded;
            explorationHistory = snapshot.history;

            // Clear and rebuild
            g.select('.links').selectAll('*').remove();
            g.select('.nodes').selectAll('*').remove();
            sim.nodes([]);
            sim.force('link').links([]);
            rebuildVisuals();
            renderBreadcrumb();
            document.getElementById('btn-undo').disabled = undoStack.length === 0;
        }

        // ===== COLLAPSE =====
        function collapseNode(id) {
            if (!expandedNodeIds.has(id)) return;

            // Save undo snapshot
            undoStack.push({
                visible: new Set(visibleNodeIds),
                expanded: new Set(expandedNodeIds),
                history: [...explorationHistory]
            });
            document.getElementById('btn-undo').disabled = false;

            expandedNodeIds.delete(id);

            // Find nodes that are ONLY reachable through this node
            // A node should be removed if it has no other expanded neighbor keeping it visible
            const toRemove = new Set();
            const neighbors = (adjacency[id] || []).map(c => c.target);

            for (const nid of neighbors) {
                if (nid === id) continue;
                if (expandedNodeIds.has(nid)) continue; // it's expanded itself, keep it

                // Check if any OTHER expanded node connects to it
                const hasOtherSource = Array.from(expandedNodeIds).some(expId => {
                    if (expId === id) return false;
                    return (adjacency[expId] || []).some(c => c.target === nid);
                });

                if (!hasOtherSource) {
                    toRemove.add(nid);
                }
            }

            for (const nid of toRemove) {
                visibleNodeIds.delete(nid);
            }

            // Rebuild graph
            g.select('.links').selectAll('*').remove();
            g.select('.nodes').selectAll('*').remove();
            sim.nodes([]);
            sim.force('link').links([]);
            rebuildVisuals();
            renderBreadcrumb();
        }

        // ===== CONTEXT MENU =====
        let ctxTargetId = null;

        function setupContextMenu() {
            const menu = document.getElementById('ctx-menu');

            // Right-click on node (handled via D3 after node creation)
            // We'll set this up as a global handler
            document.addEventListener('contextmenu', (e) => {
                // Check if the click is on a node circle
                const nodeEl = e.target.closest('.node');
                if (nodeEl && e.target.closest('#canvas')) {
                    e.preventDefault();
                    const d = d3.select(nodeEl).datum();
                    if (!d) return;
                    ctxTargetId = d.id;
                    menu.style.left = e.clientX + 'px';
                    menu.style.top = e.clientY + 'px';
                    menu.style.display = 'block';

                    // Update menu items based on node state
                    document.getElementById('ctx-expand').style.display = expandedNodeIds.has(d.id) ? 'none' : 'block';
                    document.getElementById('ctx-collapse').style.display = expandedNodeIds.has(d.id) ? 'block' : 'none';
                    document.getElementById('ctx-path').style.display = (selectedNodeId && selectedNodeId !== d.id) ? 'block' : 'none';
                } else {
                    menu.style.display = 'none';
                }
            });

            document.addEventListener('click', () => {
                menu.style.display = 'none';
            });

            document.getElementById('ctx-expand').addEventListener('click', () => {
                if (ctxTargetId) expandNode(ctxTargetId);
                menu.style.display = 'none';
            });

            document.getElementById('ctx-collapse').addEventListener('click', () => {
                if (ctxTargetId) collapseNode(ctxTargetId);
                menu.style.display = 'none';
            });

            document.getElementById('ctx-path').addEventListener('click', () => {
                if (ctxTargetId && selectedNodeId && ctxTargetId !== selectedNodeId) {
                    clearPath();
                    const path = findShortestPath(selectedNodeId, ctxTargetId);
                    if (path) {
                        showPath(path);
                    }
                }
                menu.style.display = 'none';
            });

            document.getElementById('ctx-focus').addEventListener('click', () => {
                if (ctxTargetId) {
                    const node = sim.nodes().find(n => n.id === ctxTargetId);
                    if (node) {
                        handleClick(node);
                        const W = window.innerWidth, H = window.innerHeight;
                        const transform = d3.zoomIdentity
                            .translate(W / 2, H / 2)
                            .scale(1.5)
                            .translate(-node.x, -node.y);
                        svgEl.transition().duration(400).call(zoomBehavior.transform, transform);
                    }
                }
                menu.style.display = 'none';
            });
        }

        // ===== BREADCRUMB =====
        function renderBreadcrumb() {
            const el = document.getElementById('breadcrumb');
            if (explorationHistory.length === 0) {
                el.innerHTML = '';
                return;
            }

            const currentId = explorationHistory[explorationHistory.length - 1];
            if (currentId === 'machine_learning_concept') {
                const mlPath = [
                    { id: 'computer_science_field', label: 'Computer Science' },
                    { id: 'artificial_intelligence_concept', label: 'Artificial Intelligence' },
                    { id: 'machine_learning_concept', label: 'Machine Learning' },
                ];
                el.innerHTML = mlPath
                    .map((item, i) => {
                        const cls = i === mlPath.length - 1 ? 'bc-item current' : 'bc-item';
                        const sep = i < mlPath.length - 1 ? '<span class="bc-sep">›</span>' : '';
                        return `<span class="${cls}" data-id="${escHtml(item.id)}">${escHtml(item.label)}</span>${sep}`;
                    })
                    .join('');
            } else {
                const items = explorationHistory.slice(-8).map((id, i, arr) => {
                    const node = nodeMap[id];
                    if (!node) return '';
                    const isCurrent = i === arr.length - 1;
                    const cls = isCurrent ? 'bc-item current' : 'bc-item';
                    return `<span class="${cls}" data-id="${escHtml(id)}" style="color:${nc(node)}">${escHtml(nodeLabel(node))}</span>`;
                });
                el.innerHTML = items.join('<span class="bc-sep">›</span>');
            }

            // Click handlers
            el.querySelectorAll('.bc-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const node = sim.nodes().find(n => n.id === id);
                    if (node) {
                        handleClick(node);
                        const W = window.innerWidth, H = window.innerHeight;
                        const transform = d3.zoomIdentity
                            .translate(W / 2 + getPanelOffset(), H / 2)
                            .scale(currentZoom)
                            .translate(-node.x, -node.y);
                        svgEl.transition().duration(400).call(zoomBehavior.transform, transform);
                    }
                });
            });
        }

        // ===== PATH FINDING =====
        function findShortestPath(startId, endId) {
            // BFS on the full graph (not just visible)
            if (startId === endId) return [startId];
            const visited = new Set([startId]);
            const queue = [[startId]];

            while (queue.length > 0) {
                const path = queue.shift();
                const current = path[path.length - 1];

                for (const conn of (adjacency[current] || [])) {
                    if (visited.has(conn.target)) continue;
                    const newPath = [...path, conn.target];
                    if (conn.target === endId) return newPath;
                    visited.add(conn.target);
                    queue.push(newPath);
                    if (visited.size > 2000) return null; // safety limit
                }
            }
            return null;
        }

        function showPath(path) {
            if (!path || path.length < 2) return;

            // Ensure all path nodes are visible
            for (const id of path) {
                visibleNodeIds.add(id);
            }
            // Expand nodes along path so edges appear
            for (let i = 0; i < path.length - 1; i++) {
                expandedNodeIds.add(path[i]);
            }

            // Rebuild visuals to include new nodes
            g.select('.links').selectAll('*').remove();
            g.select('.nodes').selectAll('*').remove();
            sim.nodes([]);
            sim.force('link').links([]);
            rebuildVisuals();

            // Highlight path after a short delay
            setTimeout(() => {
                const pathSet = new Set(path);
                const pathEdges = new Set();
                for (let i = 0; i < path.length - 1; i++) {
                    pathEdges.add([path[i], path[i + 1]].sort().join('|'));
                }

                if (nodeEls) {
                    nodeEls.classed('on-path', d => pathSet.has(d.id));
                }
                if (linkEls) {
                    linkEls.classed('path-edge', d => {
                        const key = [d.source.id || d.source, d.target.id || d.target].sort().join('|');
                        return pathEdges.has(key);
                    });
                    linkEls.classed('dimmed', d => {
                        const key = [d.source.id || d.source, d.target.id || d.target].sort().join('|');
                        return !pathEdges.has(key);
                    });
                    refreshFocusCurves();
                }
            }, 500);
        }

        function clearPath() {
            if (nodeEls) nodeEls.classed('on-path', false);
            if (linkEls) linkEls.classed('path-edge', false).classed('dimmed', false);
            refreshFocusCurves();
        }

        // ===== RECOMMENDATIONS =====
        function updateRecommendations() {
            const recEl = document.getElementById('recommend');
            const listEl = document.getElementById('rec-list');

            if (visibleNodeIds.size < 2) {
                recEl.classList.remove('visible');
                return;
            }

            // Score frontier nodes by how many connections they'd bring
            const frontier = [];
            for (const id of visibleNodeIds) {
                if (expandedNodeIds.has(id)) continue;
                const node = nodeMap[id];
                if (!node) continue;
                const hiddenConns = (adjacency[id] || []).filter(c => !visibleNodeIds.has(c.target)).length;
                // Bonus for connecting to different domains
                const currentDomains = new Set();
                for (const vid of visibleNodeIds) {
                    const vn = nodeMap[vid];
                    if (vn) vn.domain.forEach(d => currentDomains.add(d));
                }
                const newDomains = node.domain.filter(d => !currentDomains.has(d)).length;
                const score = hiddenConns + newDomains * 3;
                if (score > 0) frontier.push({ id, node, score, hiddenConns });
            }

            frontier.sort((a, b) => b.score - a.score);
            const top = frontier.slice(0, 4);

            if (top.length === 0) {
                recEl.classList.remove('visible');
                return;
            }

            recEl.classList.add('visible');
            listEl.innerHTML = top.map(f => `
                <button class="rec-item" type="button" data-id="${escHtml(f.id)}" aria-label="${escHtml(nodeLabel(f.node))}">
                    <div class="rec-dot" style="background:${nc(f.node)}"></div>
                    <span>${escHtml(nodeLabel(f.node))}</span>
                    <span class="rec-score">+${f.hiddenConns}</span>
                </button>
            `).join('');

            listEl.querySelectorAll('.rec-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    expandNode(id);
                    updateRecommendations();
                });
            });
        }

        // ===== DOMAIN FILTER =====
        function setupFilters() {
            const bar = document.getElementById('filter-bar');
            const domains = ['ALL', 'MAT', 'PHY', 'CHE', 'BIO', 'MED', 'ENG', 'TEC', 'SOC', 'HUM', 'PHI', 'ART', 'HIS'];
            domains.forEach(d => {
                const btn = document.createElement('div');
                btn.className = 'filter-btn' + (d === 'ALL' ? ' active' : '');
                btn.textContent = d;
                btn.style.color = d === 'ALL' ? '#c8d0dc' : (DC[d] || '#556');
                btn.dataset.domain = d;
                btn.onclick = () => {
                    bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeFilter = d === 'ALL' ? null : d;
                    applyFilter();
                };
                bar.appendChild(btn);
            });
        }

        function applyFilter() {
            if (!nodeEls) return;
            if (!activeFilter) {
                nodeEls.style('opacity', 1);
                linkEls.style('opacity', null).classed('dimmed', false);
                refreshFocusCurves();
                updateStats();
                return;
            }
            nodeEls.style('opacity', d => {
                const node = nodeMap[d.id];
                return node && node.domain.includes(activeFilter) ? 1 : 0.12;
            });
            linkEls.each(function (d) {
                const sNode = nodeMap[d.source.id || d.source];
                const tNode = nodeMap[d.target.id || d.target];
                const relevant = (sNode && sNode.domain.includes(activeFilter)) ||
                    (tNode && tNode.domain.includes(activeFilter));
                d3.select(this).classed('dimmed', !relevant);
            });
            refreshFocusCurves();
            updateStats();
        }

        // ===== CONTROLS =====
        function setupControls() {
            document.getElementById('btn-reset').addEventListener('click', resetGraph);
            document.getElementById('btn-fit').addEventListener('click', fitView);
            document.getElementById('btn-undo').addEventListener('click', undo);
            document.getElementById('btn-focus').addEventListener('click', () => {
                focusDepth = (focusDepth + 1) % 3;
                updateFocusButton();
                applyFocusMode();
            });
            document.getElementById('btn-help').addEventListener('click', () => toggleShortcuts());
            document.getElementById('btn-tour').addEventListener('click', () => startTour(true));
            document.getElementById('close').addEventListener('click', () => {
                closePanel();
                clearHighlights();
            });
            document.getElementById('shortcuts-close').addEventListener('click', () => closeShortcuts());

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                const tag = document.activeElement.tagName;
                const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

                // Ctrl+Z undo
                if (e.ctrlKey && e.key === 'z' && !isInput) {
                    e.preventDefault();
                    undo();
                    return;
                }

                // Ctrl+K focus search
                if (e.ctrlKey && e.key === 'k') {
                    e.preventDefault();
                    document.getElementById('search-input').focus();
                    return;
                }

                // Don't handle other shortcuts while typing
                if (isInput) return;

                // ? show shortcuts
                if (e.key === '?' && !e.ctrlKey) {
                    e.preventDefault();
                    toggleShortcuts();
                    return;
                }

                // / focus search
                if (e.key === '/') {
                    e.preventDefault();
                    document.getElementById('search-input').focus();
                    return;
                }

                // Esc close panel or shortcuts
                if (e.key === 'Escape') {
                    const sc = document.getElementById('shortcuts');
                    if (sc.classList.contains('visible')) {
                        closeShortcuts();
                    } else if (document.getElementById('onboard').classList.contains('visible')) {
                        closeTour(true);
                    } else {
                        closePanel();
                        clearHighlights();
                    }
                    return;
                }
            });

            // Click outside shortcuts to close
            document.getElementById('shortcuts').addEventListener('click', (e) => {
                if (e.target.id === 'shortcuts') {
                    closeShortcuts();
                }
            });
        }

        function toggleShortcuts() {
            const el = document.getElementById('shortcuts');
            if (el.classList.contains('visible')) closeShortcuts();
            else openShortcuts();
        }

        // ===== ZOOM INDICATOR =====
        let zoomIndicatorTimer = null;
        function updateZoomIndicator() {
            const el = document.getElementById('zoom-indicator');
            el.textContent = `${Math.round(currentZoom * 100)}%`;
            el.classList.add('visible');
            clearTimeout(zoomIndicatorTimer);
            zoomIndicatorTimer = setTimeout(() => el.classList.remove('visible'), 1200);
        }

        // ===== LINK LOD =====
        function applyLinkLOD() {
            if (!linkEls) return;
            if (currentZoom < 0.5 && visibleNodes.length > 40) {
                linkEls.style('display', d => {
                    const sId = d.source.id || d.source;
                    const tId = d.target.id || d.target;
                    if (expandedNodeIds.has(sId) && expandedNodeIds.has(tId)) return null;
                    return 'none';
                });
            } else {
                linkEls.style('display', null);
            }
            refreshFocusCurves();
        }

        // ===== PERFORMANCE MODE =====
        function updatePerfMode() {
            const n = visibleNodeIds.size;
            const on = document.documentElement.classList.contains('perf-mode');
            // Hysteresis: OFF→ON above 180, ON→OFF below 140 — avoids flicker
            // when the visible count hovers around the threshold.
            if (!on && n > 180) document.documentElement.classList.add('perf-mode');
            else if (on && n < 140) document.documentElement.classList.remove('perf-mode');
        }

        // ===== INIT =====
        async function init() {
            try {
                setLoadingState('Loading graph...');
                LANG = getLang();
                document.documentElement.lang = LANG === 'zh' ? 'zh-Hant' : LANG;

                const rawNodes = await loadData();
                hydrateGraphData(rawNodes);

                setLoadingState('Loading labels...');
                const maps = await loadLocaleMaps(LANG);
                labelMap = maps.labels;
                descriptionMap = maps.descriptions;

                hideLoadingState();
                initGraph();
                setupSearch();
                setupFilters();
                setupTopChrome();
                setupControls();
                setupOnboarding();
                setupContextMenu();
                document.getElementById('lang-toggle').addEventListener('click', async (e) => {
                    const btn = e.target.closest('.lang-btn');
                    if (!btn) return;
                    await setLang(btn.dataset.lang);
                });
                applyI18n();
                updateFocusButton();
                restoreState();
                setTimeout(() => startTour(false), 280);

                // English descriptions are split out of all_nodes.json at build time
                // and streamed in after the graph is interactive. Until they arrive,
                // nodeDescription() simply returns '' for English; once loaded, refresh
                // any open panel so its prose fills in.
                fetchJsonWithTimeout('../data/descriptions.json', 7000)
                    .then((map) => {
                        enDescriptionMap = (map && typeof map === 'object') ? map : {};
                        if (selectedNodeId && nodeMap[selectedNodeId]) openPanel(nodeMap[selectedNodeId]);
                    })
                    .catch(() => { /* descriptions are non-critical */ });
            } catch (error) {
                lastLoadError = error;
                const msg = error && error.message ? error.message : 'Unable to initialize explorer.';
                setLoadingState(msg, true, true);
                const retryBtn = document.getElementById('loading-retry');
                if (retryBtn) {
                    retryBtn.onclick = () => {
                        retryBtn.disabled = true;
                        setLoadingState('Retrying...', false, false);
                        init();
                    };
                }
            }
        }

        // ===== PERSISTENCE =====
        const STORAGE_KEY = 'nodus-explorer-state';

        function saveState() {
            try {
                const state = {
                    visible: Array.from(visibleNodeIds),
                    expanded: Array.from(expandedNodeIds),
                    history: explorationHistory
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                // Update URL hash for sharing (compact: just expanded nodes)
                if (expandedNodeIds.size > 0) {
                    const hash = Array.from(expandedNodeIds).join(',');
                    history.replaceState(null, '', '#' + hash);
                }
            } catch (e) { /* storage full or unavailable */ }
        }

        function restoreState() {
            // Priority: URL hash > localStorage
            const hash = window.location.hash.slice(1);
            if (hash) {
                const ids = hash.split(',').filter(id => nodeMap[id]);
                if (ids.length > 0) {
                    for (const id of ids) {
                        expandedNodeIds.add(id);
                        visibleNodeIds.add(id);
                        for (const conn of (adjacency[id] || [])) {
                            if (nodeMap[conn.target]) visibleNodeIds.add(conn.target);
                        }
                    }
                    explorationHistory = ids;
                    rebuildVisuals();
                    renderBreadcrumb();
                    document.getElementById('welcome').classList.add('hidden');
                    setTimeout(fitView, 800);
                    return;
                }
            }

            // Try localStorage
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const state = JSON.parse(raw);
                if (!state.visible || state.visible.length === 0) return;

                visibleNodeIds = new Set(state.visible.filter(id => nodeMap[id]));
                expandedNodeIds = new Set(state.expanded.filter(id => nodeMap[id]));
                explorationHistory = (state.history || []).filter(id => nodeMap[id]);

                if (visibleNodeIds.size > 0) {
                    rebuildVisuals();
                    renderBreadcrumb();
                    document.getElementById('welcome').classList.add('hidden');
                    setTimeout(fitView, 800);
                }
            } catch (e) { /* corrupted state, ignore */ }
        }

        // ===== BACKGROUND PARTICLE SYSTEM =====
        (function initParticles() {
            const canvas = document.getElementById('bgCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            let pw, ph, particles = [];
            const pColors = ['#5b9bd5', '#c97a5b', '#9b7bc9', '#5bc97a', '#c9a05a', '#c95b9b', '#7ba5c9'];

            function resize() {
                pw = canvas.width = window.innerWidth;
                ph = canvas.height = window.innerHeight;
            }

            class P {
                constructor() {
                    this.x = Math.random() * pw;
                    this.y = Math.random() * ph;
                    this.size = Math.random() * 1.4 + 0.4;
                    this.vx = (Math.random() - 0.5) * 0.04;
                    this.vy = (Math.random() - 0.5) * 0.04;
                    this.color = pColors[Math.floor(Math.random() * pColors.length)];
                    this.alpha = Math.random() * 0.25 + 0.15;
                }
                update() {
                    this.x += this.vx;
                    this.y += this.vy;
                    if (this.x < 0) this.x = pw;
                    if (this.x > pw) this.x = 0;
                    if (this.y < 0) this.y = ph;
                    if (this.y > ph) this.y = 0;
                }
                draw() {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fillStyle = this.color;
                    ctx.globalAlpha = this.alpha;
                    ctx.fill();
                }
            }

            function initP() {
                resize();
                particles = [];
                const count = Math.min(Math.floor((pw * ph) / 18000), 80);
                for (let i = 0; i < count; i++) particles.push(new P());
            }

            function connectP() {
                const maxDist = Math.min(pw, ph) * 0.12;
                const maxDist2 = maxDist * maxDist;
                for (let a = 0; a < particles.length; a++) {
                    for (let b = a + 1; b < particles.length; b++) {
                        const dx = particles[a].x - particles[b].x;
                        const dy = particles[a].y - particles[b].y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 < maxDist2) {
                            const opacity = (1 - d2 / maxDist2) * 0.07;
                            ctx.strokeStyle = `rgba(180, 200, 220, ${opacity})`;
                            ctx.lineWidth = 0.4;
                            ctx.beginPath();
                            ctx.moveTo(particles[a].x, particles[a].y);
                            ctx.lineTo(particles[b].x, particles[b].y);
                            ctx.stroke();
                        }
                    }
                }
            }

            let animId;
            function animate() {
                if (document.documentElement.classList.contains('perf-mode')) {
                    cancelAnimationFrame(animId);
                    return;
                }
                ctx.clearRect(0, 0, pw, ph);
                ctx.globalAlpha = 1;
                for (const p of particles) { p.update(); p.draw(); }
                connectP();
                animId = requestAnimationFrame(animate);
            }

            window.addEventListener('resize', initP);
            initP();
            animate();
        })();

        init();
