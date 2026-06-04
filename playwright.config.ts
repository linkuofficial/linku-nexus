import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    outputDir: "./test-results",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "list",
    use: {
        baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
        trace: "on-first-retry",
    },
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : [
            {
                command: "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000",
                url: "http://127.0.0.1:8000/api/health",
                reuseExistingServer: true,
                timeout: 120000,
            },
            {
                command: "npm run dev -- --host 127.0.0.1 --port 3000",
                url: "http://127.0.0.1:3000",
                reuseExistingServer: true,
                timeout: 120000,
            },
        ],
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
