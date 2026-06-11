import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

function copyDataPlugin() {
    return {
        name: 'copy-data',
        buildStart() {
            const srcDir = resolve(__dirname, 'data');
            const destDir = resolve(__dirname, 'frontend/public/data');
            mkdirSync(destDir, { recursive: true });

            // Split the monolithic graph payload into "topology" (everything the
            // graph needs to render — ids, labels, types, domains, connections) and
            // "descriptions" (the heavy English prose, ~780kB). The runtime loads
            // topology first and streams descriptions in afterwards, so the critical
            // first parse stays small. The source of truth in data/ is left intact;
            // both derived files land in the gitignored public/data.
            const raw = JSON.parse(readFileSync(resolve(srcDir, 'all_nodes.json'), 'utf8'));
            const nodes = (Array.isArray(raw) ? raw : raw.nodes) as any[];
            const descriptions: Record<string, string> = {};
            const slimNodes = nodes.map((n: any) => {
                if (n && typeof n.description === 'string' && n.description) {
                    descriptions[n.id] = n.description;
                    const { description, ...rest } = n;
                    return rest;
                }
                return n;
            });
            const slim = Array.isArray(raw) ? slimNodes : { ...raw, nodes: slimNodes };
            writeFileSync(resolve(destDir, 'all_nodes.json'), JSON.stringify(slim));
            writeFileSync(resolve(destDir, 'descriptions.json'), JSON.stringify(descriptions));

            const i18nSrc = resolve(srcDir, 'i18n');
            const i18nDest = resolve(destDir, 'i18n');
            if (existsSync(i18nSrc)) {
                mkdirSync(i18nDest, { recursive: true });
                // 只複製線上站實際載入的 i18n 檔；排除生成過程的中間/備份產物
                // （*_backup_*、*_mini_reviewed 等），避免把垃圾打包進 production。
                const isJunk = (name: string) => /backup|mini_reviewed/i.test(name);
                for (const f of readdirSync(i18nSrc)) {
                    if (f.endsWith('.json') && !isJunk(f)) {
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
