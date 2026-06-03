import { test, expect } from '@playwright/test';

test.describe('Nexus regressions', () => {
    test('app and explorer ESC clears search input', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.goto(`${root}/app.html`);
        await expect(page.locator('#loading')).toBeHidden({ timeout: 30000 });
        await page.fill('#search-input', 'quantum');
        await expect(page.locator('#search-input')).toHaveValue('quantum');
        await page.locator('#search-input').press('Escape');
        await expect(page.locator('#search-input')).toHaveValue('');
        await expect(page.locator('#search-results')).toHaveAttribute('aria-hidden', 'true');

        await page.goto(`${root}/explorer.html`);
        await page.fill('#search-input', 'a');
        await expect(page.locator('#search-input')).toHaveValue('a');
        await page.locator('#search-input').evaluate((el) => el.focus());
        await page.keyboard.press('Escape');
        await expect(page.locator('#search-input')).toHaveValue('');
        await expect(page.locator('#search-results')).toBeHidden();
    });

    test('app breadcrumb nav history survives reload in session', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.goto(`${root}/app.html`);
        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await page.fill('#search-input', 'quantum');
        await expect(page.locator('#search-results .sr[data-node-id]').first()).toBeVisible();
        await page.locator('#search-results .sr[data-node-id]').first().click();
        await expect(page.locator('#panel')).toHaveClass(/open/);
        await expect(page.locator('#p-breadcrumb .bc-item').first()).toBeVisible();

        await page.reload();
        await expect(page.locator('#loading')).toBeHidden({ timeout: 30000 });
        await expect(page.locator('#p-breadcrumb .bc-item').first()).toBeVisible();
    });

    test('SEO/meta essentials exist on all entry pages', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';
        const pages = ['/', '/app.html', '/explorer.html'];

        for (const path of pages) {
            await page.goto(`${root}${path}`);
            await expect(page.locator('meta[name="description"]')).toHaveCount(1);
            await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
            await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
            await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
            await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
            await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
        }
    });

    test('explorer loads graph and search remains usable', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';
        await page.goto(`${root}/explorer.html`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await expect(page.locator('#canvas')).toBeVisible();

        await page.fill('#search-input', 'physics');
        await expect(page.locator('#search-results .sr').first()).toBeVisible();
    });

    test('app first-visit onboarding can be dismissed and help opens with keyboard', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.addInitScript(() => {
            localStorage.removeItem('nexus-app-onboard-seen-v1');
        });
        await page.goto(`${root}/app.html`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await expect(page.locator('#app-onboard')).toHaveClass(/visible/);
        await page.click('#app-onboard-dismiss');
        await expect(page.locator('#app-onboard')).not.toHaveClass(/visible/);

        await page.keyboard.press('?');
        await expect(page.locator('#shortcuts-modal')).toHaveClass(/visible/);
        await expect(page.locator('#shortcut-search-label')).not.toHaveText('');
        await page.keyboard.press('Escape');
        await expect(page.locator('#shortcuts-modal')).not.toHaveClass(/visible/);
    });

    test('app keyboard shortcuts focus search and help button opens modal', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.addInitScript(() => {
            localStorage.setItem('nexus-app-onboard-seen-v1', '1');
        });
        await page.goto(`${root}/app.html`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await page.keyboard.press('/');
        await expect(page.locator('#search-input')).toBeFocused();
        await page.click('#help-btn');
        await expect(page.locator('#shortcuts-modal')).toHaveClass(/visible/);
        await page.click('#shortcuts-close');
        await expect(page.locator('#shortcuts-modal')).not.toHaveClass(/visible/);
    });

    test('explorer first-visit tour and help button coordinate correctly', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.addInitScript(() => {
            localStorage.removeItem('nexus-explorer-tour-v1');
        });
        await page.goto(`${root}/explorer.html`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await expect(page.locator('#onboard')).toHaveClass(/visible/);
        await page.keyboard.press('Escape');
        await expect(page.locator('#onboard')).not.toHaveClass(/visible/);

        await page.click('#btn-help');
        await expect(page.locator('#shortcuts')).toHaveClass(/visible/);
        await expect(page.locator('#shortcuts-intro')).not.toHaveText('');
        await page.click('#shortcuts-close');
        await expect(page.locator('#shortcuts')).not.toHaveClass(/visible/);
    });

    test('explorer onboarding closes when backdrop is clicked', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.addInitScript(() => {
            localStorage.removeItem('nexus-explorer-tour-v1');
        });
        await page.goto(`${root}/explorer.html`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await expect(page.locator('#onboard')).toHaveClass(/visible/);
        await page.locator('#onboard').click({ position: { x: 8, y: 8 } });
        await expect(page.locator('#onboard')).not.toHaveClass(/visible/);
    });

    test('explorer recommended items are keyboard-activatable buttons', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.addInitScript(() => {
            localStorage.setItem('nexus-explorer-tour-v1', 'done');
        });
        await page.goto(`${root}/explorer.html`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await page.fill('#search-input', 'evolution');
        await expect(page.locator('#search-results .sr').first()).toBeVisible();
        await page.locator('#search-results .sr').first().click();
        await expect(page.locator('#recommend')).toHaveClass(/visible/);

        const firstRec = page.locator('#rec-list .rec-item').first();
        await expect(firstRec).toHaveAttribute('type', 'button');
        await firstRec.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#btn-undo')).toBeEnabled();
    });

    test('app search query deep-link auto-focuses best node', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';
        await page.goto(`${root}/app.html?search=quantum`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await expect(page.locator('#search-input')).toHaveValue('quantum');
        await expect(page.locator('#panel')).toHaveClass(/open/);
        await expect(page.locator('#p-label')).not.toHaveText('');
    });

    test('app language toggle remains visible when panel is open', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';
        await page.goto(`${root}/app.html?search=quantum`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        await expect(page.locator('#panel')).toHaveClass(/open/);
        const layout = await page.evaluate(() => {
            const lang = document.getElementById('lang-toggle');
            const panel = document.getElementById('panel');
            if (!lang || !panel) return null;
            const langRect = lang.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            return {
                inViewport: langRect.left >= 0 && langRect.right <= window.innerWidth,
                clearOfPanel: langRect.right <= panelRect.left,
                width: langRect.width,
            };
        });

        expect(layout).not.toBeNull();
        expect(layout?.inViewport).toBeTruthy();
        expect(layout?.clearOfPanel).toBeTruthy();
        expect((layout?.width || 0) > 0).toBeTruthy();
    });

    test('index Search Directly focuses search input', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';
        await page.goto(`${root}/`);

        await page.click('#ctaSearch');
        await expect(page.locator('#searchInput')).toBeFocused();
    });

    test('app filter chips expose full-name labels for abbreviated domains', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';
        await page.goto(`${root}/app.html`);

        await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
        const matFilter = page.locator('#filter-bar .filter-btn[data-domain="MAT"]');
        await expect(matFilter).toHaveAttribute('title', /math|\u6578\u5b66/i);
        await expect(matFilter).toHaveAttribute('aria-label', /math|\u6578\u5b66/i);
    });

    test('index suggestion pills navigate to app search on touch flow', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.addInitScript(() => {
            window.__NEXUS_FORCE_TOUCH_TOOLTIP__ = true;
        });

        await page.goto(`${root}/`);

        await expect.poll(async () => {
            const readyCount = await page.locator('.pill-btn').evaluateAll((nodes) => {
                return nodes.filter((node) => {
                    const body = node.getAttribute('data-tooltip-body');
                    const query = node.getAttribute('data-query');
                    return Boolean(query) && Boolean(body && body.trim().length > 0);
                }).length;
            });
            return readyCount;
        }, { timeout: 20000 }).toBeGreaterThan(0);

        const firstPill = page.locator('.pill-btn[data-query]').first();
        await firstPill.click();
        const firstUrl = page.url();
        if (firstUrl === `${root}/`) {
            await firstPill.click();
        }
        await expect(page).toHaveURL(/app\.html\?search=black%20hole/);
    });

    test('explorer shows retry UI when API and static data both fail', async ({ page, baseURL }) => {
        const root = baseURL || 'http://127.0.0.1:3000';

        await page.route('**/api/graph/full', async (route) => {
            await route.abort();
        });
        await page.route('**/data/all_nodes.json', async (route) => {
            await route.abort();
        });

        await page.goto(`${root}/explorer.html`);

        await expect(page.locator('#loading')).toBeVisible();
        await expect(page.locator('#loading-retry')).toBeVisible();
        await expect(page.locator('#loading-text')).toContainText('Unable to load graph data');
    });
});
