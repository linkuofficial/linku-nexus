// Canonical force-layout configuration, shared by the build-time bake
// (vite.config copyDataPlugin) and the runtime engine (app-main.js). Keeping a
// single source means the positions baked into the topology JSON are produced
// by exactly the forces the runtime would have used — so the page can skip the
// warm-up entirely and just display the settled constellation.

import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3';

// Apparent node radius driving collision spacing (the visual star size lives
// elsewhere; this only feeds the physics).
export const TYPE_SIZE = { field: 16, concept: 6, person: 9, event: 11 };
export function nodeRadius(n) { return TYPE_SIZE[n.type] || 6; }

// Build the undirected edge list from node.connections (dedup by unordered
// pair + relation), the same way the runtime does. Used by the bake; the
// runtime builds its own draw-edge list but the layout topology is identical.
export function buildLayoutEdges(nodes) {
    const ids = new Set(nodes.map((n) => n.id));
    const seen = new Set();
    const edges = [];
    for (const n of nodes) {
        for (const c of (n.connections || [])) {
            if (!ids.has(c.target)) continue;
            const key = [n.id, c.target].sort().join('|') + c.relation_type;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({ source: n.id, target: c.target });
        }
    }
    return edges;
}

// The one true simulation setup. `nodes` and `edges` are mutated by d3 (x/y,
// source/target resolution) — callers pass copies if they need the originals.
export function createLayoutSimulation(nodes, edges, width, height) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const typeOf = (ref) => (byId.get(ref.id || ref) || {}).type;
    return forceSimulation(nodes)
        .force('link', forceLink(edges).id((d) => d.id).distance((d) => {
            const s = typeOf(d.source), t = typeOf(d.target);
            if (s === 'field' && t === 'field') return 180;
            if (s === 'field' || t === 'field') return 100;
            return 60;
        }).strength((d) => {
            const s = typeOf(d.source), t = typeOf(d.target);
            return (s === 'field' && t === 'field') ? 0.3 : 0.15;
        }))
        .force('charge', forceManyBody().strength((d) => d.type === 'field' ? -600 : -120).theta(0.9))
        .force('center', forceCenter(width / 2, height / 2))
        .force('collision', forceCollide((d) => nodeRadius(d) + 4))
        .alphaDecay(0.03)
        .alphaMin(0.008)
        .velocityDecay(0.4);
}

// Run a simulation to rest synchronously and return [{id,x,y}]. Used at build
// time. The viewport size is arbitrary — the runtime re-frames to fit.
export function bakeLayout(rawNodes, { width = 1600, height = 1000, maxTicks = 600 } = {}) {
    const nodes = rawNodes.map((n) => ({ id: n.id, type: n.type }));
    const edges = buildLayoutEdges(rawNodes);
    const sim = createLayoutSimulation(nodes, edges, width, height);
    sim.stop();
    for (let i = 0; i < maxTicks && sim.alpha() > sim.alphaMin(); i++) sim.tick();
    return nodes.map((n) => ({ id: n.id, x: Math.round(n.x * 100) / 100, y: Math.round(n.y * 100) / 100 }));
}
