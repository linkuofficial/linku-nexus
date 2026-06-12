import { test, expect } from "@playwright/test";

/*
 * Regression guard for the node-connection glow aesthetic: clicking a node must
 * light up its connections as animated focus-curves (.link.focus-curve.active)
 * with flowing photons (.photon), plus a focus-ring halo on the node. This broke
 * silently once during the CSS componentization refactor, so it's worth pinning.
 */

// In-page: pick the highest-degree visible node (guarantees it has edges to light)
// and dispatch a real click on its core/hit circle.
const CLICK_HUB = () => {
    const nodes = Array.from(document.querySelectorAll("g.node")) as any[];
    const deg = new Map<string, number>();
    for (const l of Array.from(document.querySelectorAll(".link")) as any[]) {
        const d = (l as any).__data__; if (!d) continue;
        const s = d.source?.id ?? d.source, t = d.target?.id ?? d.target;
        deg.set(s, (deg.get(s) || 0) + 1); deg.set(t, (deg.get(t) || 0) + 1);
    }
    let best: any = null, bestDeg = -1;
    for (const n of nodes) {
        const id = (n as any).__data__?.id;
        const dg = deg.get(id) || 0;
        if (dg > bestDeg) { bestDeg = dg; best = n; }
    }
    const target = best?.querySelector("circle.hit") || best?.querySelector("circle.core");
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return bestDeg;
};

async function assertGlow(page) {
    const counts = await page.evaluate(() => ({
        active: document.querySelectorAll(".link.focus-curve.active").length,
        photon: document.querySelectorAll(".photon").length,
        ring: document.querySelectorAll(".focus-ring").length,
    }));
    expect(counts.active, "focus-curve.active edges should light up").toBeGreaterThan(0);
    expect(counts.photon, "flowing photons should be drawn").toBeGreaterThan(0);
    expect(counts.ring, "selected node should get a focus-ring halo").toBeGreaterThan(0);
}

test("app: clicking a node lights up its connections", async ({ page }) => {
    // Canvas renderer: click the highest-degree on-screen node with a REAL
    // mouse click, then assert (a) the engine lit its focus curves + ring and
    // (b) actual pixels around the node got painted bright — the glow exists.
    await page.addInitScript(() => localStorage.setItem("nodus-app-onboard-seen-v1", "1"));
    await page.goto("/app.html");
    await expect.poll(async () =>
        page.evaluate(() => !!(window as any).__nodusApp?.ready())
    ).toBeTruthy();
    await page.waitForTimeout(800);

    const target = await page.evaluate(() => {
        const app = (window as any).__nodusApp;
        let best: any = null, bestDeg = -1;
        for (const id of app.nodeIds()) {
            const p = app.screenPos(id);
            if (!p || p.x < 80 || p.x > innerWidth - 80 || p.y < 140 || p.y > innerHeight - 80) continue;
            const deg = app.degree(id);
            if (deg > bestDeg) { bestDeg = deg; best = { id, ...p }; }
        }
        return { ...best, deg: bestDeg };
    });
    expect(target.deg).toBeGreaterThan(0);

    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(600);

    const debug = await page.evaluate(() => (window as any).__nodusApp.debug());
    expect(debug.activeEdges, "focus-curve edges should light up").toBeGreaterThan(0);
    expect(debug.hasRing, "selected node should get a focus-ring").toBeTruthy();

    // Pixel proof: the selected star's neighbourhood must be visibly lit.
    const litPixels = await page.evaluate((id) => {
        const app = (window as any).__nodusApp;
        const p = app.screenPos(id); // the click re-centers the view — re-read
        const c = document.getElementById("canvas") as HTMLCanvasElement;
        const ctx = c.getContext("2d")!;
        const dpr = c.width / innerWidth;
        const size = Math.round(80 * dpr);
        const img = ctx.getImageData(Math.round(p.x * dpr - size / 2), Math.round(p.y * dpr - size / 2), size, size).data;
        let lit = 0;
        for (let i = 0; i < img.length; i += 4) {
            if (img[i] + img[i + 1] + img[i + 2] > 90) lit++;
        }
        return lit;
    }, target.id);
    expect(litPixels, "pixels around the selected star should be lit").toBeGreaterThan(100);
});

test("explorer: clicking a node lights up its connections", async ({ page }) => {
    await page.goto("/explorer.html");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => { (window as any).startExploration?.("calculus_field"); });
    await page.waitForTimeout(1800);
    const deg = await page.evaluate(CLICK_HUB);
    expect(deg).toBeGreaterThan(0);
    await page.waitForTimeout(600);
    await assertGlow(page);
});
