import { test, expect } from "@playwright/test";

test("index page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Nodus/);
});

test("app page loads and shows graph container", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto("/app.html");
    await expect(page).toHaveTitle(/Nodus/);
    await expect(page.locator("#canvas")).toBeVisible();
    // canvas engine must come up with a clean console
    await expect.poll(async () =>
        page.evaluate(() => !!(window as any).__nodusApp?.ready())
    ).toBeTruthy();
    expect(errors, `runtime errors during app load:\n${errors.join("\n")}`).toHaveLength(0);
});

test("onboarding can advance and close", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.removeItem("nodus-app-onboard-seen-v1");
    });
    await page.goto("/app.html");

    const onboard = page.locator("#app-onboard");
    const step = page.locator("#app-onboard-step");
    const next = page.locator("#app-onboard-next");

    await expect(onboard).toHaveClass(/visible/);
    await expect(step).toContainText("1/3");

    await next.click();
    await expect(step).toContainText("2/3");

    await next.click();
    await expect(step).toContainText("3/3");

    await next.click();
    await expect(onboard).not.toHaveClass(/visible/);
    await expect(onboard).toHaveAttribute("aria-hidden", "true");
});

test("node can be dragged in app graph", async ({ page }) => {
    // The app graph renders to <canvas> — there is no per-node DOM. The drag
    // goes through real mouse events at the node's screen position and the
    // assertion reads the node's world position from the engine test hook.
    await page.addInitScript(() => localStorage.setItem("nodus-app-onboard-seen-v1", "1"));
    await page.goto("/app.html");

    await expect.poll(async () =>
        page.evaluate(() => !!(window as any).__nodusApp?.ready())
    ).toBeTruthy();
    await page.waitForTimeout(600); // let the layout settle a little

    // Pick a node comfortably inside the viewport so the mouse stays on-canvas.
    const id = await page.evaluate(() => {
        const app = (window as any).__nodusApp;
        for (const nid of app.nodeIds()) {
            const p = app.screenPos(nid);
            if (p && p.x > 150 && p.x < innerWidth - 150 && p.y > 150 && p.y < innerHeight - 150) return nid;
        }
        return app.nodeIds()[0];
    });

    const before = await page.evaluate((nid) => (window as any).__nodusApp.worldPos(nid), id);
    const pos = await page.evaluate((nid) => (window as any).__nodusApp.screenPos(nid), id);

    await page.mouse.move(pos.x, pos.y);
    await page.mouse.down();
    await page.mouse.move(pos.x + 48, pos.y + 36, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => {
        const after = await page.evaluate((nid) => (window as any).__nodusApp.worldPos(nid), id);
        return Math.hypot(after.x - before.x, after.y - before.y);
    }).toBeGreaterThan(5);
});

test("explorer page loads", async ({ page }) => {
    await page.goto("/explorer.html");
    await expect(page).toHaveTitle(/Nodus/);
});

test("explorer node can be dragged after starting exploration", async ({ page }) => {
    await page.goto("/explorer.html");

    await expect.poll(async () => {
        return await page.evaluate(() => {
            return typeof startExploration === "function" && typeof g !== "undefined" && !!g;
        });
    }).toBeTruthy();

    await page.evaluate(() => {
        startExploration("calculus_field");
    });

    await expect.poll(async () => page.locator("g.node").count()).toBeGreaterThan(0);
    const firstNode = page.locator("g.node").first();
    const firstCore = page.locator("g.node circle.core").first();
    await expect(firstCore).toBeVisible();

    const initialTransform = await firstNode.getAttribute("transform");
    const box = await firstCore.boundingBox();
    if (!box) {
        throw new Error("Unable to resolve explorer node position for drag test");
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 30, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => firstNode.getAttribute("transform")).not.toBe(initialTransform);
});

test("static data file is accessible", async ({ page }) => {
    const response = await page.request.get("/data/all_nodes.json");
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.nodes).toBeDefined();
    expect(json.nodes.length).toBeGreaterThan(0);
});
