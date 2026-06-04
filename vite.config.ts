import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';

function copyDataPlugin() {
    return {
        name: 'copy-data',
        buildStart() {
            const srcDir = resolve(__dirname, 'data');
            const destDir = resolve(__dirname, 'frontend/public/data');
            mkdirSync(destDir, { recursive: true });
            copyFileSync(resolve(srcDir, 'all_nodes.json'), resolve(destDir, 'all_nodes.json'));
            const i18nSrc = resolve(srcDir, 'i18n');
            const i18nDest = resolve(destDir, 'i18n');
            if (existsSync(i18nSrc)) {
                mkdirSync(i18nDest, { recursive: true });
                for (const f of readdirSync(i18nSrc)) {
                    if (f.endsWith('.json')) {
                        copyFileSync(resolve(i18nSrc, f), resolve(i18nDest, f));
                    }
                }
            }
        },
    };
}

export default defineConfig({
    root: 'frontend',
    plugins: [copyDataPlugin()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'frontend/src'),
        },
    },
    server: {
        port: 3000,
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'frontend/index.html'),
                app: resolve(__dirname, 'frontend/app.html'),
                explorer: resolve(__dirname, 'frontend/explorer.html'),
            },
        },
    },
});
