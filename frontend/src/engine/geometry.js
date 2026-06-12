// Shared graph geometry + colour helpers for the star-field engines used by both
// app-main.js and explorer-main.js. Pure functions only — no DOM, no D3, no module
// state — so the two renderers can share them verbatim with no behavioural drift.
//
// This is the first slice of a shared "engine/" layer. Node sizing (TYPE_SIZE) and
// the star-bloom metadata intentionally differ between the two pages, so those stay
// page-local; only the genuinely identical primitives live here.

export const EDGE_CURVE_DISTANCE_FACTOR = 0.18;
export const EDGE_CURVE_MIN_OFFSET = 10;
export const EDGE_CURVE_MAX_OFFSET = 42;

// hex "#rrggbb" + alpha → "rgba(...)". Used to author the layered star gradients.
export function hexA(hex, a) {
    const n = parseInt(String(hex).slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Deterministic ±1 curve direction from the unordered endpoint-id pair, so an edge
// always bows the same way regardless of source/target ordering.
export function edgeCurveDirection(edge) {
    const s = String(edge.source.id || edge.source || '');
    const t = String(edge.target.id || edge.target || '');
    const key = s < t ? s + '|' + t : t + '|' + s;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    return hash % 2 === 0 ? 1 : -1;
}

// Quadratic-bezier path for an edge, bowed perpendicular to its chord. Caches the
// last result on the edge and reuses it while both endpoints stay within 0.5px, so
// a settled graph builds no path strings on the tick loop.
export function curvedEdgePath(edge) {
    const sx = edge.source.x ?? 0;
    const sy = edge.source.y ?? 0;
    const tx = edge.target.x ?? 0;
    const ty = edge.target.y ?? 0;
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
