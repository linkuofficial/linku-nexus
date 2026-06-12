// Deep Field design tokens — every aesthetic constant for the canvas star
// field lives here so the whole look can be tuned from one place.
//
// The visual language ("Deep Field"):
//   層級  — three star magnitudes with REAL contrast: fields are rare bright
//           luminaries, concepts mid, person/event a faint dust of pinpricks.
//   克制  — ambient sky keeps the domain hues but suppressed (desaturated +
//           dimmed); full colour is earned by interaction (hover / selection /
//           related / learning-path states).
//   焦點  — selecting a node dims the rest of the sky so one constellation
//           owns the scene; every state change eases instead of snapping.
//   深度  — a parallax far-field, per-domain nebula fog and a vignette give
//           the flat plane atmosphere.

export const THEME = {
    star: {
        // how much of the full domain colour the AMBIENT (untouched) sky keeps,
        // per tier — fields stay vivid, the dust is nearly monochrome.
        ambientMix: { primary: 1.0, secondary: 0.45, minor: 0.28 },
        // how much saturation the suppressed base colour keeps
        suppressKeepSat: 0.30,
        // NOTE: per-star brightness hierarchy comes from starMeta.baseOp
        // (1.0 / ~0.78 / ~0.42 with per-star jitter) — interaction lifts a
        // star from baseOp toward 1 alongside the colour mix.
    },
    focus: {
        dimOthers: 0.15,      // non-related stars while a selection is active
        dimOthersLp: 0.22,    // same, in learning-path mode (gold web context)
        restEdgeDim: 0.35,    // resting constellation lines while focused
        filterDim: 0.10,      // stars outside the active domain filter
    },
    anim: {
        tau: 0.11,            // seconds — exponential ease time-constant
        epsilon: 0.004,       // snap-to-target threshold
    },
    edges: {
        rest: 0.05,           // resting constellation line alpha
        restDimmed: 0.016,
        pending: 0.012,
        // lit focus-curves: endpoint vs mid-span alpha of the gradient stroke
        litEnd: 0.42, litMid: 0.10,
        litEndGold: 0.55, litMidGold: 0.16,
        reducedEnd: 0.75, reducedMid: 0.30, // no photon under reduced motion
    },
    atmosphere: {
        farStarCount: 170,       // per 1024-tile
        farParallax: 0.22,       // pan factor (zoom-independent — infinitely far)
        farAlpha: 0.5,           // overall far-field layer alpha
        nebulaAlpha: 0.16,       // per-domain fog (composited 'lighter')
        nebulaWorldRadius: 230,  // world units; scales with zoom (capped)
        nebulaMaxScreenRadius: 480,
        vignette: 0.45,          // edge darkening strength
        vignetteColor: '2,4,9',
    },
    labels: {
        field: { size: 12, alpha: 0.85, spacing: '0.6px' },
        node: { size: 10, alpha: 0.78 },
        related: 0.92,
        hovered: 0.9,
    },
};

// ── colour helpers ─────────────────────────────────────────────────────────

export function hexToRgb(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}

// Pull a colour toward its own luminance (keep = fraction of chroma retained).
export function desaturate(hex, keep) {
    const [r, g, b] = hexToRgb(hex);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return rgbToHex([l + (r - l) * keep, l + (g - l) * keep, l + (b - l) * keep]);
}

export function mixHex(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

// The ambient (suppressed) rendition of a domain colour for a star tier.
export function ambientColor(hex, tier) {
    const mix = THEME.star.ambientMix[tier] ?? 0.4;
    if (mix >= 1) return hex;
    return mixHex(desaturate(hex, THEME.star.suppressKeepSat), hex, mix);
}

// Deterministic 0..1 pseudo-random from a string seed (stable across loads —
// the sky must not reshuffle between sessions).
export function hash01(seed) {
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
}
