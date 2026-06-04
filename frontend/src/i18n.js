/**
 * i18n.js — All internationalisation data and helpers for the Knowledge Graph.
 *
 * Imported by app-main.js.  The per-language string dictionaries live in the
 * ./i18n/ subdirectory so translators can find them quickly.
 */

import en from './i18n/en.js';
import zh from './i18n/zh.js';
import ja from './i18n/ja.js';

/** Master dictionary keyed by locale code. */
export const I18N = { en, zh, ja };

export function isValidLang(lang) {
    return typeof lang === 'string' && Object.prototype.hasOwnProperty.call(I18N, lang);
}

/** Resolve the preferred locale from localStorage / navigator. */
export function getLang() {
    const saved = localStorage.getItem('nodus-lang');
    if (saved === 'zh-TW') return 'zh';
    if (isValidLang(saved)) return saved;
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('zh')) return 'zh';
    return 'en';
}

/** Display-tag label translations for zh / ja. */
export const TAG_LABELS = {
    zh: {
        foundational: '\u57fa\u7879',
        abstract: '\u62bd\u8c61',
        axiomatic: '\u516c\u7406\u5316',
        philosophical: '\u54f2\u5b78\u7684',
        ancient: '\u53e4\u4ee3',
        experimental: '\u5be6\u9a57',
        natural_world: '\u81ea\u7136\u4e16\u754c',
        molecular_scale: '\u5206\u5b50\u5c3a\u5ea6',
        interdisciplinary: '\u8de8\u9818\u57df',
        field: '\u9818\u57df',
        applied: '\u61c9\u7528',
        theoretical: '\u7406\u8ad6',
        empirical: '\u5be6\u8b49',
        modern: '\u73fe\u4ee3',
        contemporary: '\u7576\u4ee3',
        paradigm_shift: '\u5178\u7bc4\u8f49\u79fb',
        cold_war_era: '\u51b7\u6230\u6642\u4ee3',
        military_application: '\u8ecd\u4e8b\u61c9\u7528',
        turning_point: '\u8f49\u6369\u9ede',
        historical_timescale: '\u6b77\u53f2\u5c3a\u5ea6',
        historically_significant: '\u6b77\u53f2\u91cd\u8981',
        unifying_concept: '\u7d71\u4e00\u6982\u5ff5',
        well_established: '\u6210\u719f\u7406\u8ad6',
        currently_active_research: '\u76ee\u524d\u6d3b\u8e8d\u7814\u7a76',
    },
    ja: {
        foundational: '\u57fa\u790e',
        abstract: '\u62bd\u8c61',
        axiomatic: '\u516c\u7406\u5316',
        philosophical: '\u54f2\u5b66\u7684',
        ancient: '\u53e4\u4ee3',
        experimental: '\u5b9f\u9a13',
        natural_world: '\u81ea\u7136\u754c',
        molecular_scale: '\u5206\u5b50\u30b9\u30b1\u30fc\u30eb',
        interdisciplinary: '\u5b66\u969b\u7684',
        field: '\u5206\u91ce',
        applied: '\u5fdc\u7528',
        theoretical: '\u7406\u8ad6',
        empirical: '\u5b9f\u8a3c',
        modern: '\u8fd1\u4ee3',
        contemporary: '\u73fe\u4ee3',
        paradigm_shift: '\u30d1\u30e9\u30c0\u30a4\u30e0\u30b7\u30d5\u30c8',
        cold_war_era: '\u51b7\u6226\u6642\u4ee3',
        military_application: '\u8ecd\u4e8b\u5fdc\u7528',
        turning_point: '\u8ee2\u63db\u70b9',
        historical_timescale: '\u6b74\u53f2\u30b9\u30b1\u30fc\u30eb',
        historically_significant: '\u6b74\u53f2\u7684\u91cd\u8981',
        unifying_concept: '\u7d71\u4e00\u6982\u5ff5',
        well_established: '\u78ba\u7acb\u3055\u308c\u305f\u7406\u8ad6',
        currently_active_research: '\u73fe\u5728\u9032\u884c\u4e2d\u306e\u7814\u7a76',
    },
};

/** Token-to-Chinese mapping used by localizeTag() to build compound labels. */
export const TAG_TOKEN_ZH = {
    age: '\u6642\u4ee3', ancient: '\u53e4\u4ee3', modern: '\u73fe\u4ee3',
    contemporary: '\u7576\u4ee3', early: '\u65e9\u671f', middle: '\u4e2d\u671f',
    post: '\u5f8c', digital: '\u6578\u4f4d', industrial: '\u5de5\u696d',
    cold: '\u51b7', war: '\u6230\u722d', exploration: '\u63a2\u7d22',
    revolution: '\u9769\u547d', enlightenment: '\u555f\u8499',
    renaissance: '\u6587\u85dd\u5fa9\u8208', ancient_greek: '\u53e4\u5e0c\u81d8',
    islamic: '\u4f0a\u65af\u862d', golden: '\u9ec3\u91d1', world: '\u4e16\u754c',
    history: '\u6b77\u53f2', historical: '\u6b77\u53f2',
    historiography: '\u53f2\u5b78\u65b9\u6cd5', studies: '\u7814\u7a76',
    science: '\u79d1\u5b78', technology: '\u79d1\u6280', engineering: '\u5de5\u7a0b',
    application: '\u61c9\u7528', applied: '\u61c9\u7528', practical: '\u5be6\u52d9',
    theoretical: '\u7406\u8ad6', theory: '\u7406\u8ad6', model: '\u6a21\u578b',
    methodology: '\u65b9\u6cd5\u8ad6', framework: '\u6846\u67b6', concept: '\u6982\u5ff5',
    foundational: '\u57fa\u7879', abstract: '\u62bd\u8c61', axiomatic: '\u516c\u7406\u5316',
    empirical: '\u5be6\u8b49', experimental: '\u5be6\u9a57',
    observational: '\u89c0\u6e2c', analytical: '\u5206\u6790', analysis: '\u5206\u6790',
    quantitative: '\u91cf\u5316', qualitative: '\u8cea\u5316', logic: '\u908f\u8f2f',
    algebra: '\u4ee3\u6578', calculus: '\u5fae\u7a4d\u5206', geometry: '\u5e7e\u4f55',
    topology: '\u62d3\u64b2', probability: '\u6a5f\u7387', statistics: '\u7d71\u8a08',
    differential: '\u5fae\u5206', equations: '\u65b9\u7a0b', number: '\u6578\u8ad6',
    graph: '\u5716', set: '\u96c6\u5408', field: '\u9818\u57df',
    interdisciplinary: '\u8de8\u9818\u57df', cross: '\u8de8', domain: '\u9818\u57df',
    molecular: '\u5206\u5b50', atomic: '\u539f\u5b50', cellular: '\u7d30\u80de',
    ecological: '\u751f\u614b', planetary: '\u884c\u661f', cosmic: '\u5b87\u5b99',
    scale: '\u5c3a\u5ea6', ethics: '\u502b\u7406', policy: '\u653f\u7b56',
    society: '\u793e\u6703', social: '\u793e\u6703', culture: '\u6587\u5316',
    cultural: '\u6587\u5316', cognitive: '\u8a8d\u77e5', medical: '\u91ab\u5b78',
    biomedical: '\u751f\u91ab', chemistry: '\u5316\u5b78', physics: '\u7269\u7406',
    biology: '\u751f\u7269', linguistics: '\u8a9e\u8a00\u5b78', philosophy: '\u54f2\u5b78',
    art: '\u85dd\u8853', music: '\u97f3\u6a02', design: '\u8a2d\u8a08', law: '\u6cd5\u5f8b',
    cybersecurity: '\u8cc7\u5b89', machine: '\u6a5f\u5668', learning: '\u5b78\u7fd2',
    network: '\u7db2\u8def', systems: '\u7cfb\u7d71', system: '\u7cfb\u7d71',
    computing: '\u8a08\u7b97', computer: '\u96fb\u8166', language: '\u8a9e\u8a00',
    processing: '\u8655\u7406', public: '\u516c\u5171', health: '\u5065\u5eb7',
    significant: '\u91cd\u8981', established: '\u6210\u719f', unifying: '\u7d71\u4e00',
};

/** Token-to-Japanese mapping used by localizeTag() for ja compound fallback labels. */
export const TAG_TOKEN_JA = {
    age: '\u6642\u4ee3', ancient: '\u53e4\u4ee3', modern: '\u8fd1\u4ee3',
    contemporary: '\u73fe\u4ee3', early: '\u521d\u671f', middle: '\u4e2d\u671f',
    post: '\u5f8c\u671f', digital: '\u30c7\u30b8\u30bf\u30eb', industrial: '\u7523\u696d',
    cold: '\u51b7', war: '\u6226\u4e89', exploration: '\u63a2\u7d22',
    revolution: '\u9769\u547d', enlightenment: '\u5553\u8499',
    renaissance: '\u30eb\u30cd\u30b5\u30f3\u30b9', ancient_greek: '\u53e4\u4ee3\u30ae\u30ea\u30b7\u30e3',
    islamic: '\u30a4\u30b9\u30e9\u30e0', golden: '\u9ec4\u91d1', world: '\u4e16\u754c',
    history: '\u6b74\u53f2', historical: '\u6b74\u53f2',
    historiography: '\u53f2\u5b66', studies: '\u7814\u7a76',
    science: '\u79d1\u5b66', technology: '\u6280\u8853', engineering: '\u5de5\u5b66',
    application: '\u5fdc\u7528', applied: '\u5fdc\u7528', practical: '\u5b9f\u8df5',
    theoretical: '\u7406\u8ad6', theory: '\u7406\u8ad6', model: '\u30e2\u30c7\u30eb',
    methodology: '\u65b9\u6cd5\u8ad6', framework: '\u67a0\u7d44\u307f', concept: '\u6982\u5ff5',
    foundational: '\u57fa\u790e', abstract: '\u62bd\u8c61', axiomatic: '\u516c\u7406\u5316',
    empirical: '\u5b9f\u8a3c', experimental: '\u5b9f\u9a13',
    observational: '\u89b3\u6e2c', analytical: '\u5206\u6790', analysis: '\u5206\u6790',
    quantitative: '\u5b9a\u91cf', qualitative: '\u5b9a\u6027', logic: '\u8ad6\u7406',
    algebra: '\u4ee3\u6570', calculus: '\u5fae\u7a4d\u5206', geometry: '\u5e7e\u4f55',
    topology: '\u30c8\u30dd\u30ed\u30b8\u30fc', probability: '\u78ba\u7387', statistics: '\u7d71\u8a08',
    differential: '\u5fae\u5206', equations: '\u65b9\u7a0b\u5f0f', number: '\u6570\u8ad6',
    graph: '\u30b0\u30e9\u30d5', set: '\u96c6\u5408', field: '\u5206\u91ce',
    interdisciplinary: '\u5b66\u969b', cross: '\u6a2a\u65ad', domain: '\u9818\u57df',
    molecular: '\u5206\u5b50', atomic: '\u539f\u5b50', cellular: '\u7d30\u80de',
    ecological: '\u751f\u614b', planetary: '\u60d1\u661f', cosmic: '\u5b87\u5b99',
    scale: '\u30b9\u30b1\u30fc\u30eb', ethics: '\u502b\u7406', policy: '\u653f\u7b56',
    society: '\u793e\u4f1a', social: '\u793e\u4f1a', culture: '\u6587\u5316',
    cultural: '\u6587\u5316', cognitive: '\u8a8d\u77e5', medical: '\u533b\u7642',
    biomedical: '\u751f\u7269\u533b\u5b66', chemistry: '\u5316\u5b66', physics: '\u7269\u7406',
    biology: '\u751f\u7269', linguistics: '\u8a00\u8a9e\u5b66', philosophy: '\u54f2\u5b66',
    art: '\u82b8\u8853', music: '\u97f3\u697d', design: '\u30c7\u30b6\u30a4\u30f3', law: '\u6cd5\u5f8b',
    cybersecurity: '\u30b5\u30a4\u30d0\u30fc\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3', machine: '\u6a5f\u68b0', learning: '\u5b66\u7fd2',
    network: '\u30cd\u30c3\u30c8\u30ef\u30fc\u30af', systems: '\u30b7\u30b9\u30c6\u30e0', system: '\u30b7\u30b9\u30c6\u30e0',
    computing: '\u8a08\u7b97', computer: '\u30b3\u30f3\u30d4\u30e5\u30fc\u30bf', language: '\u8a00\u8a9e',
    processing: '\u51e6\u7406', public: '\u516c\u5171', health: '\u5065\u5eb7',
    significant: '\u91cd\u8981', established: '\u78ba\u7acb', unifying: '\u7d71\u5408',
};
