(function initNodusState(globalObj) {
    const SAFE_NODE_ID_RE = /^[A-Za-z0-9._:-]{1,120}$/;

    function isSafeNodeId(id) {
        return typeof id === "string" && SAFE_NODE_ID_RE.test(id);
    }

    function parseLearnedSet(rawValue, nodeMap) {
        try {
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
                return new Set();
            }
            return new Set(parsed.filter((id) => isSafeNodeId(id) && nodeMap[id]));
        } catch (error) {
            return new Set();
        }
    }

    function loadStoredLearned(storageKey, nodeMap) {
        const saved = localStorage.getItem(storageKey);
        if (!saved) {
            return new Set();
        }
        return parseLearnedSet(saved, nodeMap);
    }

    function saveStoredLearned(storageKey, valuesSet) {
        localStorage.setItem(storageKey, JSON.stringify([...valuesSet]));
    }

    globalObj.NodusState = {
        isSafeNodeId,
        parseLearnedSet,
        loadStoredLearned,
        saveStoredLearned,
    };
})(window);
