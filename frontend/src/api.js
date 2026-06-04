(function initNodusApi(globalObj) {
    const CACHE_PREFIX = "nodus:api:";
    const CACHE_TTL_MS = {
        graphFull: 5 * 60 * 1000,
        descriptions: 5 * 60 * 1000,
        localeLabels: 30 * 60 * 1000,
        localeDescriptions: 30 * 60 * 1000,
    };
    const inMemoryCache = new Map();
    const inFlight = new Map();

    async function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function readSessionCache(cacheKey, ttlMs) {
        if (!globalObj.sessionStorage) {
            return null;
        }
        try {
            const raw = sessionStorage.getItem(CACHE_PREFIX + cacheKey);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") {
                return null;
            }
            if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
                sessionStorage.removeItem(CACHE_PREFIX + cacheKey);
                return null;
            }
            return parsed.value;
        } catch (error) {
            return null;
        }
    }

    function writeSessionCache(cacheKey, value, ttlMs) {
        if (!globalObj.sessionStorage) {
            return;
        }
        try {
            sessionStorage.setItem(
                CACHE_PREFIX + cacheKey,
                JSON.stringify({
                    value,
                    expiresAt: Date.now() + ttlMs,
                })
            );
        } catch (error) {
            // Storage quota can fail in private mode; ignore safely.
        }
    }

    async function dedupedCachedFetch(cacheKey, ttlMs, producer) {
        const memoryHit = inMemoryCache.get(cacheKey);
        if (memoryHit && memoryHit.expiresAt > Date.now()) {
            return memoryHit.value;
        }

        const sessionHit = readSessionCache(cacheKey, ttlMs);
        if (sessionHit !== null) {
            inMemoryCache.set(cacheKey, {
                value: sessionHit,
                expiresAt: Date.now() + ttlMs,
            });
            return sessionHit;
        }

        const inflightHit = inFlight.get(cacheKey);
        if (inflightHit) {
            return inflightHit;
        }

        const pending = (async () => {
            const value = await producer();
            inMemoryCache.set(cacheKey, {
                value,
                expiresAt: Date.now() + ttlMs,
            });
            writeSessionCache(cacheKey, value, ttlMs);
            return value;
        })();

        inFlight.set(cacheKey, pending);
        try {
            return await pending;
        } finally {
            inFlight.delete(cacheKey);
        }
    }

    function normalizeGraphData(data) {
        const nodes = Array.isArray(data) ? data : data?.nodes;
        if (!Array.isArray(nodes)) {
            throw new Error("Invalid graph payload: missing nodes array");
        }
        const edges = Array.isArray(data?.edges) ? data.edges : null;
        return { nodes, edges };
    }

    async function fetchJsonWithRetry(url, retries = 2) {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                lastError = error;
                if (attempt < retries) {
                    await sleep(300 * (attempt + 1));
                }
            }
        }
        throw lastError;
    }

    async function loadGraphData() {
        return dedupedCachedFetch("graph-full", CACHE_TTL_MS.graphFull, async () => {
            const fileData = await fetchJsonWithRetry("/data/all_nodes.json", 2);
            return normalizeGraphData(fileData);
        });
    }

    async function fetchGraphDescriptions() {
        // Descriptions are embedded in each node's .description field from all_nodes.json.
        return {};
    }

    async function fetchLocaleLabels(locale) {
        const targetLocale = locale || "en";
        return dedupedCachedFetch(`labels:${targetLocale}`, CACHE_TTL_MS.localeLabels, async () => {
            const primary = await fetch(`/data/i18n/${encodeURIComponent(targetLocale)}.json`);
            if (primary.ok) return primary.json();
            const english = await fetch(`/data/i18n/en.json`);
            if (english.ok) return english.json();
            return {};
        });
    }

    async function fetchLocaleDescriptions(locale) {
        if (!locale || locale === "en") {
            return {};
        }
        return dedupedCachedFetch(`descriptions:${locale}`, CACHE_TTL_MS.localeDescriptions, async () => {
            const fileCandidates = [
                `/data/i18n/${encodeURIComponent(locale)}_descriptions.json`,
                `/data/i18n/${encodeURIComponent(locale)}_descriptions_batch1.json`,
            ];
            for (const path of fileCandidates) {
                try {
                    const response = await fetch(path);
                    if (!response.ok) continue;
                    const payload = await response.json();
                    if (payload && typeof payload === "object") {
                        if (payload.descriptions && typeof payload.descriptions === "object") {
                            return payload.descriptions;
                        }
                        return payload;
                    }
                } catch (error) {
                    // Continue to next candidate.
                }
            }
            return {};
        });
    }

    async function fetchLearningProgress() {
        // Progress is stored in localStorage only — no backend sync.
        return null;
    }

    function postLearningToggle(nodeId) {
        // No backend — progress persists via localStorage only.
        return Promise.resolve();
    }

    globalObj.NodusApi = {
        sleep,
        normalizeGraphData,
        fetchJsonWithRetry,
        loadGraphData,
        fetchGraphDescriptions,
        fetchLocaleLabels,
        fetchLocaleDescriptions,
        fetchLearningProgress,
        postLearningToggle,
    };
})(window);
