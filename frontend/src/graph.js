(function initNodusGraph(globalObj) {
    function isPrerequisiteConnection(connection) {
        return Boolean(
            connection.learning_prerequisite ||
            (connection.directed && (connection.relation_type === "logical" || connection.relation_type === "causal"))
        );
    }

    function buildPrerequisiteGraph(rawNodes, nodeMap) {
        const prereqEdges = [];
        const edgeIndex = new Set();
        const graph = { parents: {}, children: {} };

        for (const node of rawNodes) {
            for (const connection of (node.connections || [])) {
                if (!nodeMap[connection.target]) {
                    continue;
                }
                if (!isPrerequisiteConnection(connection)) {
                    continue;
                }

                const from = connection.target;
                const to = node.id;
                const edgeKey = `${from}->${to}`;
                if (edgeIndex.has(edgeKey)) {
                    continue;
                }

                prereqEdges.push({ source: from, target: to });
                edgeIndex.add(edgeKey);
                if (!graph.children[from]) {
                    graph.children[from] = [];
                }
                if (!graph.parents[to]) {
                    graph.parents[to] = [];
                }
                graph.children[from].push(to);
                graph.parents[to].push(from);
            }
        }

        return { prereqEdges, prereqGraph: graph };
    }

    globalObj.NodusGraph = {
        isPrerequisiteConnection,
        buildPrerequisiteGraph,
    };
})(window);
