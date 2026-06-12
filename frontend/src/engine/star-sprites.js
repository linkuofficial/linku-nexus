// Offscreen star-sprite factory for the canvas renderer.
//
// Each star is the same four-layer radial-gradient stack the SVG renderer drew
// (corona → halo → glow → core, plus the white core-hi pinprick). Painting those
// gradients per node per frame would be slow, so we pre-render them once into
// offscreen canvases and drawImage at draw time:
//
//   - "body" sprite  = halo + glow(×glowAlpha) + core + core-hi, flattened.
//   - "corona" sprite = the wide faint breathing field, kept separate because
//     its alpha twinkles per-frame while the body stays constant.
//
// Stop tables are copied verbatim from the SVG starStops() defs so the canvas
// star is colourimetrically identical to the SVG one. Sprites are cached by
// (domain, layer radii, dpr); radii derive from tier + degree-capped metadata,
// so only a few dozen distinct sprites exist in practice.

import { hexA } from './geometry.js';

const PAD = 2; // guard ring so the gradient's 0-alpha edge never clips

function makeLayerCanvas(radius, dpr) {
    const size = Math.ceil((radius + PAD) * 2 * dpr);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return c;
}

function paintRadial(ctx, cx, cy, r, stops) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [offset, color] of stops) grad.addColorStop(offset, color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
}

// Gradient stop tables — exact mirrors of the SVG <radialGradient> defs.
function coreStops(color) {
    return [
        [0.00, 'rgba(255,255,255,1)'],
        [0.22, 'rgba(255,255,255,0.98)'],
        [0.48, 'rgba(255,255,255,0.78)'],
        [0.70, hexA(color, 0.55)],
        [0.88, hexA(color, 0.22)],
        [1.00, hexA(color, 0)],
    ];
}
function glowStops(color) {
    return [
        [0.00, hexA(color, 0.92)],
        [0.24, hexA(color, 0.58)],
        [0.55, hexA(color, 0.18)],
        [1.00, hexA(color, 0)],
    ];
}
function haloStops(color) {
    return [
        [0.00, hexA(color, 0.32)],
        [0.38, hexA(color, 0.13)],
        [0.78, hexA(color, 0.035)],
        [1.00, hexA(color, 0)],
    ];
}
function coronaStops(color) {
    return [
        [0.00, hexA(color, 0)],
        [0.30, hexA(color, 0.035)],
        [0.65, hexA(color, 0.012)],
        [1.00, hexA(color, 0)],
    ];
}

export function createSpriteCache() {
    const cache = new Map();

    // meta: { core, glow, halo, corona, glowAlpha } — radii in CSS px.
    // Returns { body, bodyRadius, corona, coronaRadius } with canvases sized
    // for crisp drawing at the given devicePixelRatio.
    function get(domainColor, meta, dpr) {
        const key = [
            domainColor,
            meta.core.toFixed(2), meta.glow.toFixed(2),
            meta.halo.toFixed(2), meta.corona.toFixed(2),
            meta.glowAlpha, dpr,
        ].join('|');
        const hit = cache.get(key);
        if (hit) return hit;

        // Body: halo → glow → core → core-hi, flattened with normal compositing
        // (matching the SVG paint order inside one star).
        const bodyRadius = meta.halo + PAD;
        const body = makeLayerCanvas(meta.halo, dpr);
        const bctx = body.getContext('2d');
        bctx.scale(dpr, dpr);
        const c = bodyRadius;
        paintRadial(bctx, c, c, meta.halo, haloStops(domainColor));
        bctx.globalAlpha = meta.glowAlpha;
        paintRadial(bctx, c, c, meta.glow, glowStops(domainColor));
        bctx.globalAlpha = 1;
        paintRadial(bctx, c, c, meta.core, coreStops(domainColor));
        bctx.fillStyle = '#ffffff';
        bctx.beginPath();
        bctx.arc(c, c, Math.max(0.7, meta.core * 0.42), 0, Math.PI * 2);
        bctx.fill();

        // Corona: separate so its alpha can twinkle per frame.
        const coronaRadius = meta.corona + PAD;
        const corona = makeLayerCanvas(meta.corona, dpr);
        const cctx = corona.getContext('2d');
        cctx.scale(dpr, dpr);
        paintRadial(cctx, coronaRadius, coronaRadius, meta.corona, coronaStops(domainColor));

        const entry = { body, bodyRadius, corona, coronaRadius };
        cache.set(key, entry);
        return entry;
    }

    return { get, clear: () => cache.clear() };
}
