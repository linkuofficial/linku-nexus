import { test, expect } from "@playwright/test";

/*
 * Guard for the description-streaming split (vite copyDataPlugin writes a slim
 * all_nodes.json + a separate descriptions.json). The graph must render on the
 * topology alone, then the panel description must fill in once descriptions are
 * fetched. Regression target: a broken split / missing enDescriptionMap fallback
 * would leave panels permanently blank for English.
 */

const panelDescLen = async (page) =>
    ((await page.locator("#p-desc").textContent()) || "").trim().length;

test("app: node panel fills with streamed description", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("nodus-app-onboard-seen-v1", "1"));
    await page.goto("/app.html?node=mathematics_field");
    await page.waitForLoadState("networkidle");
    await expect
        .poll(() => panelDescLen(page), { timeout: 15000 })
        .toBeGreaterThan(0);
});

test("explorer: node panel fills with streamed description", async ({ page }) => {
    await page.goto("/explorer.html");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => (window as any).startExploration?.("mathematics_field"));
    await page.waitForTimeout(1500);
    // Open the seed node's panel.
    await page.evaluate(() => {
        const n = document.querySelector("g.node") as any;
        const target = n?.querySelector("circle.hit") || n?.querySelector("circle.core");
        target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect
        .poll(() => panelDescLen(page), { timeout: 15000 })
        .toBeGreaterThan(0);
});
