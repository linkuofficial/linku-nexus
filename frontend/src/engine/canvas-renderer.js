// Canvas scene renderer for the star-field knowledge graph.
//
// Replaces the SVG render layer (one <g> per node with 6 circles + text, one
// <line> per edge, CSS classes for every visual state) with a single canvas
// painted in screen space each frame. Physics stays in d3-force, untouched —
// the renderer only READS node x/y. Visual state travels on per-object flag
// bags (node.vis / edge.vis) that the page logic mutates, mirroring the old
// CSS-class semantics one-to-one:
//
//   node.vis: dimmed, selected, learned, available, onPath, related
//   edge.vis: dimmed, highlight, prereqPath          (+ edge.pending, static)
//
// Stars composite with 'lighter' (true additive light — overlapping glows sum,
// which SVG alpha stacking could never do); hover/selected/on-path "brightness"
// is an extra additive pass of the same sprite, replacing the old CSS
// brightness() filters. Twinkle, photons and the focus-ring pulse are driven by
// the frame clock instead of CSS keyframes, with the exact periods/amplitudes
// of the old @keyframes. All stroke widths, dash patterns and label metrics are
// kept in CSS-pixel screen space, matching the SVG's vector-effect:
// non-scaling-stroke + counter-scaled node groups (stars render at a constant
// apparent size at every zoom level).

import { createSpriteCache } from './star-sprites.js';
import { edgeCurveDirection, EDGE_CURVE_DISTANCE_FACTOR, EDGE_CURVE_MIN_OFFSET, EDGE_CURVE_MAX_OFFSET } from './geometry.js';

const TWO_PI = Math.PI * 2;

// CSS ease-in-out approximation for the photon sweep (@keyframes nodusFlow).
function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// World-space control point of an edge's quadratic curve (same math as
// geometry.curvedEdgePath, but returning the point for canvas quadraticCurveTo).
function curveControl(edge) {
    const sx = edge.source.x ?? 0, sy = edge.source.y ?? 0;
    const tx = edge.target.x ?? 0, ty = edge.target.y ?? 0;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const baseOffset = Math.min(EDGE_CURVE_MAX_OFFSET, Math.max(EDGE_CURVE_MIN_OFFSET, dist * EDGE_CURVE_DISTANCE_FACTOR));
    const dir = edgeCurveDirection(edge);
    return {
        cx: (sx + tx) * 0.5 + (-dy / dist) * baseOffset * dir,
        cy: (sy + ty) * 0.5 + (dx / dist) * baseOffset * dir,
    };
}

export function ensureVis(obj) {
    if (!obj.vis) obj.vis = {};
    return obj.vis;
}

export function createCanvasRenderer(opts) {
    const {
        canvas,
        nodes,
        edges,
        relationColor,     // (relation_type) => '#rrggbb'
        domainColor,       // (node) => '#rrggbb'
        starMeta,          // (node) => {core,glow,halo,corona,glowAlpha,twDur,twDelay}
        label,             // (node, hovered) => {text, dy, size, alpha} | null
    } = opts;

    const ctx = canvas.getContext('2d');
    const sprites = createSpriteCache();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0, height = 0, dpr = 1;
    let transform = { k: 1, x: 0, y: 0 };
    let hoveredId = null;
    let selectedNode = null;
    let lpMode = false;
    let rafId = 0;
    let dirty = true;
    let running = false;
    const stats = { lastMs: 0, avgMs: 0, frames: 0 };

    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        width = w; height = h;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        sprites.clear(); // dpr may have changed; sprites re-bake lazily
        dirty = true;
    }

    // ── per-frame helpers ───────────────────────────────────────────────────

    function twinkleAlpha(meta, nowSec) {
        if (reducedMotion) return 1;
        const dur = Number(meta.twDur) || 5;
        const delay = Number(meta.twDelay) || 0;
        const phase = ((nowSec - delay) / dur) % 1;
        // @keyframes nodusTwinkle: 0.85 → 1 → 0.85, ease-in-out ≈ sinusoid.
        return 0.925 - 0.075 * Math.cos(TWO_PI * phase);
    }

    function drawEdges(k, tx, ty, nowSec) {
        // Base constellation lines, batched by (relation, state) so the whole
        // sky is ~a dozen stroke() calls. Highlighted/prereq edges skip the base
        // line (their stroke-opacity was 0 in CSS) — they render as focus curves.
        const buckets = new Map();
        for (const e of edges) {
            const v = e.vis || {};
            if (v.highlight || v.prereqPath) continue;
            const alpha = v.dimmed ? 0.03 : (e.pending ? 0.02 : 0.10);
            const key = e.relation_type + '|' + alpha + '|' + (e.pending ? 1 : 0);
            let b = buckets.get(key);
            if (!b) { b = { color: relationColor(e.relation_type) || '#888', alpha, pending: !!e.pending, list: [] }; buckets.set(key, b); }
            b.list.push(e);
        }
        ctx.lineWidth = 0.5;
        ctx.lineCap = 'round';
        for (const b of buckets.values()) {
            ctx.globalAlpha = b.alpha;
            ctx.strokeStyle = b.color;
            ctx.setLineDash(b.pending ? [4 * k, 3 * k] : []);
            ctx.beginPath();
            for (const e of b.list) {
                ctx.moveTo(e.source.x * k + tx, e.source.y * k + ty);
                ctx.lineTo(e.target.x * k + tx, e.target.y * k + ty);
            }
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Lit constellation: coloured backbone + flowing photon per active edge.
        const active = [];
        for (const e of edges) {
            const v = e.vis || {};
            if (v.highlight || v.prereqPath) active.push(e);
        }
        if (!active.length) return;

        // NOTE: no shadowBlur anywhere on this path — per-stroke gaussian shadows
        // collapse Chrome's raster pipeline to a few fps once a hub lights up
        // dozens of curves. The soft glow is layered strokes instead: a wide
        // low-alpha pass under the bright core reads the same at a fraction of
        // the cost.
        for (const e of active) {
            const isPrereq = !!e.vis.prereqPath;
            const sxp = e.source.x * k + tx, syp = e.source.y * k + ty;
            const txp = e.target.x * k + tx, typ = e.target.y * k + ty;
            const cp = curveControl(e);
            const cxp = cp.cx * k + tx, cyp = cp.cy * k + ty;
            const stroke = isPrereq ? '#f0c050' : (relationColor(e.relation_type) || '#cfe0f5');
            const curve = () => {
                ctx.beginPath();
                ctx.moveTo(sxp, syp);
                ctx.quadraticCurveTo(cxp, cyp, txp, typ);
                ctx.stroke();
            };

            // Backbone (CSS .focus-curve.active; edge-glow filter ≈ halo pass).
            ctx.strokeStyle = stroke;
            ctx.globalAlpha = (isPrereq ? 0.92 : 0.85) * 0.30;
            ctx.lineWidth = 3.6;
            curve();
            ctx.globalAlpha = isPrereq ? 0.92 : 0.85;
            ctx.lineWidth = isPrereq ? 1.4 : 1.1;
            curve();

            // Photon — one long luminous dash gliding the curve. Dash pattern is
            // authored in world units (SVG dasharray scales with the zoomed <g>),
            // so multiply by k. @keyframes nodusFlow(Gold): 360→-360 / 380→-380.
            const photonColor = isPrereq ? '#f7d27d' : (relationColor(e.relation_type) || '#cfe0f5');
            const dur = isPrereq ? 4.4 : 3.6;
            const span = isPrereq ? 380 : 360;
            const phase = reducedMotion ? 0 : easeInOut((nowSec / dur) % 1);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = photonColor;
            ctx.setLineDash(isPrereq ? [54 * k, 680 * k] : [60 * k, 640 * k]);
            ctx.lineDashOffset = (span - phase * span * 2) * k;
            // diffuse band (the old drop-shadow) under the bright dash core
            ctx.globalAlpha = 0.22;
            ctx.lineWidth = 4.2;
            curve();
            ctx.globalAlpha = 0.95;
            ctx.lineWidth = isPrereq ? 0.95 : 1.1;
            curve();
            ctx.restore();

            // Gold arrowhead on prerequisite edges (SVG marker-end #arrow,
            // refX 20 → tip sits just outside the target star's core).
            if (isPrereq) {
                const ang = Math.atan2(typ - cyp, txp - cxp);
                const s = 0.72 * k; // markerWidth 6 / viewBox 10 × stroke-width 1.2
                const tipX = txp - Math.cos(ang) * 10 * s;
                const tipY = typ - Math.sin(ang) * 10 * s;
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#f0c050';
                ctx.beginPath();
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(tipX - Math.cos(ang - 0.46) * 11 * s, tipY - Math.sin(ang - 0.46) * 11 * s);
                ctx.lineTo(tipX - Math.cos(ang + 0.46) * 11 * s, tipY - Math.sin(ang + 0.46) * 11 * s);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawStars(k, tx, ty, nowSec) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const margin = 140; // stars are constant screen size; pad by max corona
        // Far-zoom exposure control: hundreds of constant-screen-size stars
        // overlap when zoomed way out, and additive compositing would sum their
        // glows into a white blowout (SVG alpha-stacking saturated at the
        // gradient colours instead). Ease footprint + alpha down as k shrinks.
        const farZoom = Math.min(1, Math.max(0, (k - 0.18) / (0.6 - 0.18)));
        const sizeMul = 0.55 + 0.45 * farZoom;
        const exposure = 0.30 + 0.70 * farZoom;
        for (const n of nodes) {
            const sx = n.x * k + tx, sy = n.y * k + ty;
            if (sx < -margin || sx > width + margin || sy < -margin || sy > height + margin) continue;
            const v = n.vis || {};
            const meta = starMeta(n);
            const baseAlpha = (v.dimmed ? 0.12 : 1) * exposure;
            const sp = sprites.get(domainColor(n), meta, dpr);
            const cr = sp.coronaRadius * sizeMul;
            const br = sp.bodyRadius * sizeMul;

            // corona (twinkles) then flattened body — same stack order as SVG.
            ctx.globalAlpha = baseAlpha * twinkleAlpha(meta, nowSec);
            ctx.drawImage(sp.corona, sx - cr, sy - cr, cr * 2, cr * 2);
            ctx.globalAlpha = baseAlpha;
            ctx.drawImage(sp.body, sx - br, sy - br, br * 2, br * 2);

            // Brightness states (old CSS brightness() filters) — with additive
            // compositing, re-drawing the body at partial alpha IS a brightness
            // boost: +0.35 ≈ brightness(1.35).
            let boost = 0;
            if (v.selected) boost = 0.35;
            else if (n.id === hoveredId) boost = 0.3;
            else if (v.onPath) boost = 0.25;
            if (boost > 0) {
                ctx.globalAlpha = baseAlpha * boost;
                ctx.drawImage(sp.body, sx - br, sy - br, br * 2, br * 2);
            }

            // Learning-path state mark — tiny tick tucked outside the core.
            if (lpMode && (v.learned || v.available)) {
                const mx = sx + meta.glow * 0.6, my = sy - meta.glow * 0.6;
                let a = baseAlpha;
                if (v.available && !reducedMotion) {
                    const p = (nowSec / 1.5) % 1; // @keyframes pulse: 0.7→1→0.7
                    a *= 0.85 - 0.15 * Math.cos(TWO_PI * p);
                }
                ctx.globalAlpha = a;
                ctx.fillStyle = v.learned ? 'rgba(150,230,215,0.95)' : '#fbbf24';
                ctx.beginPath();
                ctx.arc(mx, my, 1.6, 0, TWO_PI);
                ctx.fill();
            }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawFocusRing(k, tx, ty, nowSec) {
        if (!selectedNode) return;
        const m = starMeta(selectedNode);
        const r = Math.max(m.halo * 0.7, m.core * 5) + 6;
        const sx = selectedNode.x * k + tx, sy = selectedNode.y * k + ty;
        // @keyframes nodusSelHalo: ring opacity 0.6 → 1 → 0.6 over 3.6s.
        // Blurs are emulated with stacked strokes — see the no-shadowBlur note
        // in drawEdges.
        const pulse = reducedMotion ? 1 : 0.8 - 0.2 * Math.cos(TWO_PI * ((nowSec / 3.6) % 1));
        ctx.save();
        const ring = (radius, strokeStyle, lineWidth, alphaScale = 1) => {
            ctx.globalAlpha = pulse * alphaScale;
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, TWO_PI);
            ctx.stroke();
        };
        ring(r + 3, 'rgba(255,255,255,0.26)', 11, 0.35); // .fr-bloom outer haze
        ring(r + 3, 'rgba(255,255,255,0.26)', 5);        // .fr-bloom (blur 4px)
        ring(r, 'rgba(255,255,255,0.7)', 3, 0.4);        // .fr-band haze (blur 1px)
        ring(r, 'rgba(255,255,255,0.7)', 1.6);           // .fr-band
        ring(r - 4, 'rgba(255,255,255,0.92)', 0.5);      // .fr-edge
        ctx.restore();
    }

    function drawLabels(k, tx, ty) {
        ctx.lineJoin = 'round';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        for (const n of nodes) {
            const info = label(n, n.id === hoveredId);
            if (!info || info.alpha <= 0) continue;
            const sx = n.x * k + tx, sy = n.y * k + ty;
            if (sx < -160 || sx > width + 160 || sy < -160 || sy > height + 160) continue;
            ctx.globalAlpha = info.alpha;
            ctx.font = `${info.size}px 'IBM Plex Mono', monospace`;
            // CSS paint-order: stroke — dark outline behind the glyphs.
            ctx.strokeStyle = 'rgba(4,7,12,0.92)';
            ctx.lineWidth = 3;
            ctx.strokeText(info.text, sx, sy + info.dy);
            ctx.fillStyle = '#d4e4fa';
            ctx.fillText(info.text, sx, sy + info.dy);
        }
        ctx.globalAlpha = 1;
    }

    function draw(nowMs) {
        const t0 = performance.now();
        const nowSec = nowMs / 1000;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const { k, x: tx, y: ty } = transform;
        drawEdges(k, tx, ty, nowSec);
        drawStars(k, tx, ty, nowSec);
        drawFocusRing(k, tx, ty, nowSec);
        drawLabels(k, tx, ty);
        stats.lastMs = performance.now() - t0;
        stats.frames += 1;
        stats.avgMs += (stats.lastMs - stats.avgMs) / Math.min(stats.frames, 60);
        dirty = false;
    }

    function loop(nowMs) {
        rafId = 0;
        if (!running) return;
        // Continuous when ambient animation runs (twinkle/photon); on-demand
        // (dirty-flag) under prefers-reduced-motion.
        if (!reducedMotion || dirty) draw(nowMs || performance.now());
        if (!reducedMotion || dirty) rafId = requestAnimationFrame(loop);
        else running = false;
    }

    function start() {
        running = true;
        if (!rafId) rafId = requestAnimationFrame(loop);
    }

    function notify() {
        dirty = true;
        // rAF never fires while the document is hidden (background tab, headless
        // screenshot tools) — paint state changes synchronously there so the
        // canvas always reflects current state; the rAF loop takes over once
        // the page is visible.
        if (document.hidden) {
            draw(performance.now());
            return;
        }
        start();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            running = false;
            if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        } else {
            notify();
        }
    });

    window.addEventListener('resize', () => { resize(); notify(); });
    resize();

    return {
        notify,
        start,
        resize,
        stats,
        get reducedMotion() { return reducedMotion; },
        setTransform(t) { transform = { k: t.k, x: t.x, y: t.y }; notify(); },
        getTransform() { return transform; },
        setHover(id) { if (hoveredId !== id) { hoveredId = id; notify(); } },
        getHover() { return hoveredId; },
        setSelected(node) { selectedNode = node || null; notify(); },
        setLpMode(v) { lpMode = !!v; notify(); },
        // test/diagnostic snapshot of what the scene is currently lighting up
        debugCounts() {
            let active = 0, prereq = 0, dimmedNodes = 0;
            for (const e of edges) { const v = e.vis || {}; if (v.highlight || v.prereqPath) active++; if (v.prereqPath) prereq++; }
            for (const n of nodes) { if (n.vis && n.vis.dimmed) dimmedNodes++; }
            return { activeEdges: active, prereqEdges: prereq, dimmedNodes, hasRing: !!selectedNode, running, rafPending: !!rafId, dirty };
        },
    };
}
