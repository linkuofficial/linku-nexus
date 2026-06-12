// Atmosphere layers for the Deep Field look: a parallax far-field of dust
// stars, soft per-domain nebula fog, and a vignette that pulls the eye to the
// centre. Everything is pre-rendered once to offscreen canvases and stamped
// per frame — no per-frame gradient construction or raster cost beyond
// drawImage.

import { THEME, hash01 } from './theme.js';
import { hexA } from './geometry.js';

const TILE = 1024;

// Far-field: one TILE×TILE canvas of tiny cold-white dust stars, tiled across
// the viewport with a small pan-only parallax. It deliberately ignores zoom —
// these stars read as infinitely far away.
export function createFarField(dpr) {
    const c = document.createElement('canvas');
    c.width = TILE * dpr;
    c.height = TILE * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const COLORS = ['#cfd9ec', '#b9c6de', '#e6edf8', '#9fb2cf'];
    for (let i = 0; i < THEME.atmosphere.farStarCount; i++) {
        const x = hash01('fx' + i) * TILE;
        const y = hash01('fy' + i) * TILE;
        const r = 0.35 + hash01('fr' + i) * 0.85;
        g.globalAlpha = 0.10 + hash01('fa' + i) * 0.35;
        g.fillStyle = COLORS[Math.floor(hash01('fc' + i) * COLORS.length)];
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
    }
    return {
        draw(ctx, width, height, tx, ty) {
            const p = THEME.atmosphere.farParallax;
            const ox = (((tx * p) % TILE) + TILE) % TILE - TILE;
            const oy = (((ty * p) % TILE) + TILE) % TILE - TILE;
            ctx.globalAlpha = THEME.atmosphere.farAlpha;
            for (let x = ox; x < width; x += TILE) {
                for (let y = oy; y < height; y += TILE) {
                    ctx.drawImage(c, x, y, TILE, TILE);
                }
            }
            ctx.globalAlpha = 1;
        },
    };
}

// Nebula: an organic multi-blob fog sprite in a domain colour, deterministic
// per domain key so the sky never reshuffles between visits. Drawn in world
// space (scales with zoom, capped by the renderer) at very low alpha.
export function createNebulaSprite(domainKey, color, radiusPx) {
    const c = document.createElement('canvas');
    c.width = radiusPx * 2;
    c.height = radiusPx * 2;
    const g = c.getContext('2d');
    for (let i = 0; i < 5; i++) {
        const ang = hash01(domainKey + 'a' + i) * Math.PI * 2;
        const dist = hash01(domainKey + 'd' + i) * radiusPx * 0.42;
        const bx = radiusPx + Math.cos(ang) * dist;
        const by = radiusPx + Math.sin(ang) * dist;
        const br = radiusPx * (0.38 + hash01(domainKey + 'r' + i) * 0.5);
        const grad = g.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0, hexA(color, 0.30));
        grad.addColorStop(0.55, hexA(color, 0.10));
        grad.addColorStop(1, hexA(color, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.arc(bx, by, br, 0, Math.PI * 2);
        g.fill();
    }
    return c;
}

// Vignette: cached full-screen radial fade, rebuilt only on resize.
export function createVignette() {
    let cache = null, cw = 0, ch = 0;
    return {
        draw(ctx, width, height) {
            if (!cache || cw !== width || ch !== height) {
                cw = width; ch = height;
                cache = document.createElement('canvas');
                cache.width = width;
                cache.height = height;
                const g = cache.getContext('2d');
                const cx = width / 2, cy = height / 2;
                const rOuter = Math.hypot(cx, cy);
                const grad = g.createRadialGradient(cx, cy, rOuter * 0.42, cx, cy, rOuter);
                const col = THEME.atmosphere.vignetteColor;
                grad.addColorStop(0, `rgba(${col},0)`);
                grad.addColorStop(1, `rgba(${col},${THEME.atmosphere.vignette})`);
                g.fillStyle = grad;
                g.fillRect(0, 0, width, height);
            }
            ctx.drawImage(cache, 0, 0, width, height);
        },
    };
}
