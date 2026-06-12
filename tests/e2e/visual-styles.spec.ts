import { test, expect } from "@playwright/test";

/*
 * Computed-style regression oracle for the CSS componentization refactor.
 *
 * The graph canvas is an animated force sim (non-deterministic positions), so
 * full-page pixel diffs are flaky. Instead we snapshot getComputedStyle() of the
 * chrome elements — these are deterministic and are exactly what the refactor
 * must keep byte-identical. First run writes the baseline snapshot; later runs
 * fail if any captured property drifts.
 *
 * Tagged @visual and EXCLUDED from the CI `test:e2e` run: the committed
 * snapshots are platform-specific (win32 only) and these are a local before/
 * after oracle for deliberate style changes, not a portable CI gate. Run it
 * manually on your dev machine (regenerate baselines with -u after an
 * intentional style change):
 *   npm run test:e2e:visual
 *   npm run test:e2e:visual -- -u   # update baselines for your platform
 */

const PROPS = [
    "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
    "color", "background-color", "background-image", "text-transform",
    "margin", "padding", "border", "border-radius", "box-shadow", "opacity",
    "width", "height", "max-width", "display", "gap", "backdrop-filter",
    "position", "top", "left", "right", "bottom", "transform", "z-index",
];

// Freeze all animation/transition so captured computed styles are deterministic
// (the graph chrome has pulsing opacity + a transitioning search glow).
async function freezeMotion(page) {
    await page.addStyleTag({
        content: "*,*::before,*::after{animation:none !important;transition:none !important;}",
    });
}

async function snap(page, selectors: string[]) {
    return await page.evaluate(({ selectors, PROPS }) => {
        const out: Record<string, Record<string, string> | null> = {};
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (!el) { out[sel] = null; continue; }
            const cs = getComputedStyle(el);
            const rec: Record<string, string> = {};
            for (const p of PROPS) rec[p] = cs.getPropertyValue(p);
            out[sel] = rec;
        }
        return out;
    }, { selectors, PROPS });
}

function asSnapshot(label: string, data: unknown) {
    return JSON.stringify({ label, data }, null, 2);
}

test("index.html chrome computed styles", { tag: "@visual" }, async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await freezeMotion(page);
    const sels = [
        "body", ".glass-pane", "#heroKicker", "#heroTitle", "#heroSubtitle",
        "#ctaExplore", "#ctaSearch", ".pill-btn", ".pill-domain", ".pill-label",
        ".pill-tooltip-title", ".pill-tooltip-domain", ".pill-tooltip-body",
        ".footer-nav", ".footer-nav a", ".lang-btn", "#nodeCount", ".hairline-border",
    ];
    expect(asSnapshot("index", await snap(page, sels))).toMatchSnapshot("index-styles.json");
});

test("app.html chrome computed styles", { tag: "@visual" }, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("nodus-app-onboard-seen-v1", "1"));
    await page.goto("/app.html");
    await page.waitForLoadState("networkidle");
    await freezeMotion(page);
    // Open the detail drawer so #p-* styles resolve. The graph is a canvas
    // (no per-node DOM), so select through the engine hook — nodeIds()[0] is
    // the same node the old "first g.node" click resolved to.
    await page.evaluate(() => {
        const app = (window as any).__nodusApp;
        if (app?.selectNode) app.selectNode(app.nodeIds()[0]);
    });
    await page.waitForTimeout(400);
    const sels = [
        "body", "#bgCanvas", "#canvas", "#hdr", "#hdr h1", "#hdr p",
        "#search-box", "#search-input", "#filter-bar", ".filter-btn",
        "#legend", "#panel", "#p-label", "#p-type", "#p-era", "#p-desc",
        "#p-domains", "#p-tags", "#p-conns h3", ".d-badge",
    ];
    expect(asSnapshot("app", await snap(page, sels))).toMatchSnapshot("app-styles.json");
});

test("explorer.html chrome computed styles", { tag: "@visual" }, async ({ page }) => {
    await page.goto("/explorer.html");
    await page.waitForLoadState("networkidle");
    await freezeMotion(page);
    await page.evaluate(() => {
        // @ts-ignore — globals exposed by explorer page
        if (typeof startExploration === "function") startExploration("calculus_field");
    }).catch(() => {});
    await page.waitForTimeout(600);
    await page.locator("g.node circle.core").first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const sels = [
        "body", "#bgCanvas", "#canvas", "#hdr", "#hdr h1", "#hdr p",
        "#search-box", "#search-input", "#filter-bar", ".filter-btn",
        "#legend", "#panel", "#p-label", "#p-type", "#p-era", "#p-desc",
        "#p-domains", "#p-tags", "#p-conns h3", ".d-badge",
    ];
    expect(asSnapshot("explorer", await snap(page, sels))).toMatchSnapshot("explorer-styles.json");
});
