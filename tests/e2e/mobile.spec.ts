import { test, expect } from "@playwright/test";

// Touch + small-viewport smoke for the canvas app. The whole graph is one
// <canvas> with no per-node DOM, so this guards that touch tap-to-select still
// resolves through the engine hit-test and the detail panel works as a mobile
// bottom sheet. Chromium mobile emulation (webkit isn't installed in CI/dev).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

test("mobile: canvas app is tap-usable with a clean console", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.addInitScript(() => localStorage.setItem("nodus-app-onboard-seen-v1", "1"));
    await page.goto("/app.html");
    await page.waitForFunction(() => !!(window as any).__nodusApp?.ready());
    await page.waitForTimeout(800);

    // Tap a high-degree node near the centre; the panel should open.
    const target = await page.evaluate(() => {
        const app = (window as any).__nodusApp;
        let best: any = null, bd = -1;
        for (const id of app.nodeIds()) {
            const p = app.screenPos(id);
            if (!p || p.x < 60 || p.x > innerWidth - 60 || p.y < 120 || p.y > innerHeight - 160) continue;
            const d = app.degree(id);
            if (d > bd) { bd = d; best = { id, ...p }; }
        }
        return best;
    });
    await page.touchscreen.tap(target.x, target.y);

    await expect(page.locator("#panel")).toHaveClass(/open/);
    // Bottom sheet spans the viewport width without horizontal overflow.
    const box = await page.locator("#panel").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(390);
    expect(errors, errors.join("\n")).toHaveLength(0);
});
