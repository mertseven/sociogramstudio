// graph_algorithms.js

import jsnx from 'https://esm.sh/jsnetworkx@0.3.4';

/**
 * Converts an array of nodes and links (from our app) to a jsnetworkx Graph object.
 * @param {Array} appNodes - Array of node objects {id: string, ...}
 * @param {Array} appLinks - Array of link objects {source: string, target: string, type: string}
 * @param {boolean} onlyPositive - If true, only consider 'positive' links for the graph.
 * @returns {object | null} A jsnetworkx Graph object, or null on error.
 */
function createAppGraphToJsNetworkX(appNodes, appLinks, onlyPositive = true) {
    if (!jsnx) {
        console.error("jsnetworkx module failed to load.");
        return null;
    }

    const G = new jsnx.Graph();

    appNodes.forEach(node => {
        G.addNode(node.id, { ...node });
    });

    appLinks.forEach(link => {
        if (onlyPositive && link.type !== 'positive') {
            return;
        }
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        if (G.hasNode(sourceId) && G.hasNode(targetId)) {
            G.addEdge(sourceId, targetId);
        }
    });

    return G;
}

/**
 * Finds all maximal cliques in the graph.
 * Uses jsnetworkx.findCliques (Bron-Kerbosch algorithm).
 * @param {Array} appNodes
 * @param {Array} appLinks
 * @returns {Array<Array<string>>} An array of cliques, where each clique is an array of node IDs.
 */
export function findMaximalCliques(appNodes, appLinks) {
    if (!jsnx) {
        console.error("jsnetworkx module not available for findMaximalCliques.");
        return [];
    }

    if (!appNodes || appNodes.length === 0) return [];

    const G = createAppGraphToJsNetworkX(appNodes, appLinks, true);
    if (!G) return [];

    try {
        const cliquesGenerator = jsnx.findCliques(G);
        
        const cliques = [];
        if (cliquesGenerator && typeof cliquesGenerator[Symbol.iterator] === 'function') {
            for (const clique of cliquesGenerator) {
                cliques.push(Array.from(clique));
            }
        }
        return cliques;
    } catch (error) {
        console.error("Error finding cliques:", error);
        return [];
    }
}

/**
 * Calculates Betweenness Centrality for all nodes.
 * @param {Array} appNodes
 * @param {Array} appLinks
 * @returns {Map<string, number>} A Map of node ID to its betweenness centrality score.
 */
export function calculateBetweennessCentrality(appNodes, appLinks) {
    if (!jsnx) {
        console.error("jsnetworkx module not available for calculateBetweennessCentrality.");
        return new Map();
    }

    if (!appNodes || appNodes.length === 0) return new Map();

    const G = createAppGraphToJsNetworkX(appNodes, appLinks, false);
    if (!G) return new Map();

    try {
        const betweenness = jsnx.betweennessCentrality(G, { normalized: true, weight: null });
        return betweenness; 
    } catch (error)
    {
        console.error("Error calculating betweenness centrality:", error);
        return new Map();
    }
}

// REMOVED: The calculateClosenessCentrality function has been deleted.