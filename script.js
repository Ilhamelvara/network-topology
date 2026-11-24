const svg = document.getElementById("network");
const viewport = document.getElementById("viewport");
const nodesLayer = document.getElementById("nodes");
const edgesLayer = document.getElementById("edges");
const canvas = document.getElementById("canvas");
const nodeForm = document.getElementById("nodeForm");
const nodeName = document.getElementById("nodeName");
const edgeForm = document.getElementById("edgeForm");
const edgeDistance = document.getElementById("edgeDistance");
const modePrompt = document.getElementById("modePrompt");
const connectBtn = document.getElementById("connectBtn");
const offlineBtn = document.getElementById("offlineBtn");
const deleteBtn = document.getElementById("deleteBtn");
const stepBtn = document.getElementById("stepBtn");
const anycastBtn = document.getElementById("anycastBtn");
const ttl1Count = document.getElementById("ttl1Count");
const ttl2Count = document.getElementById("ttl2Count");
const ttl3Count = document.getElementById("ttl3Count");

const NODE_RADIUS = 27;
const STORAGE_KEY = "networkTopologyState";

let nodes = [];
let edges = [];
let selectedId = null;
let connectFromId = null;
let pathFromId = null;
let pathMode = false;
let activePath = null;
let highlightedNodeIds = new Set();
let highlightedEdgeIds = new Set();
let bfsFrontierIds = new Set();
let bfsVisitedIds = new Set();
let bfsDistances = new Map();
let bfsAnimationTimer = null;
let bfsRunId = 0;
let pan = { x: 0, y: 0 };
let scale = 1;
let draggingId = null;
let dragOffset = { x: 0, y: 0 };
let panning = false;
let panStart = { x: 0, y: 0 };

function loadState() {
    try {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (state && Array.isArray(state.nodes) && Array.isArray(state.edges)) {
            nodes = state.nodes;
            edges = state.edges;
            pan = state.pan || pan;
            scale = state.scale || scale;
        }
    } catch (_) {
        nodes = [];
        edges = [];
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, pan, scale }));
}

function screenToWorld(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
        x: (clientX - rect.left - pan.x) / scale,
        y: (clientY - rect.top - pan.y) / scale
    };
}

function updateTransform() {
    viewport.setAttribute("transform", `translate(${pan.x} ${pan.y}) scale(${scale})`);
}

function updateToolbar() {
    const enabled = selectedId !== null;
    connectBtn.disabled = !enabled;
    offlineBtn.disabled = !enabled;
    deleteBtn.disabled = !enabled;
    stepBtn.disabled = !enabled;
    anycastBtn.disabled = !enabled;
    const selected = nodes.find(node => node.id === selectedId);
    offlineBtn.title = selected && selected.offline
        ? "Set selected node online"
        : "Set selected node offline";
}

function roleBadge(role) {
    if (role === "standard") return null;

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "role-badge");

    const badges = {
        gateway: { label: "KEY", width: 34, color: "#0891b2" },
        core: { label: "LOCKED", width: 52, color: "#7c3aed" },
        server: { label: "SERVER", width: 54, color: "#475569" }
    };
    const badge = badges[role];
    if (!badge) return null;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(-badge.width / 2));
    rect.setAttribute("y", "-47");
    rect.setAttribute("width", String(badge.width));
    rect.setAttribute("height", "17");
    rect.setAttribute("fill", badge.color);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "0");
    text.setAttribute("y", "-35");
    text.textContent = badge.label;

    group.append(rect, text);
    return group;
}

function offlineBadge() {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "offline-badge");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "-29");
    rect.setAttribute("y", "-67");
    rect.setAttribute("width", "58");
    rect.setAttribute("height", "16");
    rect.setAttribute("fill", "#e11d48");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "0");
    text.setAttribute("y", "-56");
    text.textContent = "OFFLINE";

    group.append(rect, text);
    return group;
}

function render() {
    edgesLayer.innerHTML = "";

    edges.forEach(edge => {
        const from = nodes.find(node => node.id === edge.from);
        const to = nodes.find(node => node.id === edge.to);
        if (!from || !to) return;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", from.x);
        line.setAttribute("y1", from.y);
        line.setAttribute("x2", to.x);
        line.setAttribute("y2", to.y);
        line.setAttribute("class", [
            "edge-line",
            from.offline || to.offline ? "inactive" : "",
            highlightedEdgeIds.has(edge.id) ? "highlighted" : ""
        ].filter(Boolean).join(" "));
        edgesLayer.appendChild(line);

        if (edge.distance !== undefined && edge.distance !== null) {
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", (from.x + to.x) / 2);
            label.setAttribute("y", (from.y + to.y) / 2 - 7);
            label.setAttribute("fill", "#94a3b8");
            label.setAttribute("font-size", "11");
            label.setAttribute("text-anchor", "middle");
            label.textContent = edge.distance;
            edgesLayer.appendChild(label);
        }
    });

    nodesLayer.innerHTML = "";

    nodes.forEach(node => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const nodeClasses = ["node"];
        if (selectedId === node.id) nodeClasses.push("selected");
        if (node.offline) nodeClasses.push("offline");
        if (highlightedNodeIds.has(node.id)) nodeClasses.push("highlighted");
        if (bfsFrontierIds.has(node.id)) nodeClasses.push("bfs-frontier");
        else if (bfsVisitedIds.has(node.id)) nodeClasses.push("bfs-visited");
        group.setAttribute("class", nodeClasses.join(" "));
        group.setAttribute("transform", `translate(${node.x} ${node.y})`);
        group.dataset.id = node.id;

        const badge = roleBadge(node.role);
        if (badge) group.appendChild(badge);
        if (node.offline) group.appendChild(offlineBadge());

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("r", NODE_RADIUS);
        circle.setAttribute("class", "node-circle");

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("r", "4");
        dot.setAttribute("class", "node-dot");

        if (bfsDistances.has(node.id)) {
            const hopLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            hopLabel.setAttribute("class", "bfs-hop-label");
            hopLabel.setAttribute("x", "19");
            hopLabel.setAttribute("y", "-17");
            hopLabel.textContent = String(bfsDistances.get(node.id));
            group.appendChild(hopLabel);
        }

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "node-label");
        label.setAttribute("y", "43");
        label.textContent = node.label;

        group.append(circle, dot, label);
        nodesLayer.appendChild(group);
    });

    updateToolbar();
    updateTransform();
}

function findAuthorizedRoute(fromId, isDestination) {
    const source = nodes.find(node => node.id === fromId);
    if (!source || source.offline) return null;

    const initialAuthenticated = source.role === "gateway";
    const stateKey = (nodeId, authenticated) => `${nodeId}|${authenticated ? 1 : 0}`;
    const startKey = stateKey(fromId, initialAuthenticated);
    const queue = [{ nodeId: fromId, authenticated: initialAuthenticated, key: startKey }];
    const visited = new Set([startKey]);
    const parents = new Map();
    let destinationKey = null;
    let destinationId = null;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        const currentNode = nodes.find(node => node.id === current.nodeId);
        if (currentNode && isDestination(currentNode)) {
            destinationKey = current.key;
            destinationId = current.nodeId;
            break;
        }

        edges.forEach(edge => {
            let neighborId = null;
            if (edge.from === current.nodeId) neighborId = edge.to;
            else if (edge.to === current.nodeId) neighborId = edge.from;
            if (!neighborId) return;

            const neighbor = nodes.find(node => node.id === neighborId);
            if (!neighbor || neighbor.offline) return;

            const authenticated = current.authenticated || neighbor.role === "gateway";
            if (neighbor.role === "core" && !authenticated) return;

            const key = stateKey(neighborId, authenticated);
            if (visited.has(key)) return;
            visited.add(key);
            parents.set(key, { previousKey: current.key, edgeId: edge.id });
            queue.push({ nodeId: neighborId, authenticated, key });
        });
    }

    if (destinationKey === null) return null;

    const nodeIds = [];
    const edgeIds = [];
    let currentKey = destinationKey;
    while (currentKey !== startKey) {
        nodeIds.push(currentKey.split("|")[0]);
        const parent = parents.get(currentKey);
        if (!parent) return null;
        edgeIds.push(parent.edgeId);
        currentKey = parent.previousKey;
    }
    nodeIds.push(fromId);
    return {
        nodeIds: nodeIds.reverse(),
        edgeIds: edgeIds.reverse(),
        destinationId
    };
}

function findAuthorizedPath(fromId, toId) {
    const destination = nodes.find(node => node.id === toId);
    if (!destination || destination.offline) return null;
    return findAuthorizedRoute(fromId, node => node.id === toId);
}

function findNearestServer(sourceId) {
    const source = nodes.find(node => node.id === sourceId);
    if (!source || source.offline) return null;

    const stateKey = (nodeId, authenticated) => `${nodeId}|${authenticated ? 1 : 0}`;
    const queue = [];
    const visited = new Set();
    const nextSteps = new Map();

    nodes.forEach(node => {
        if (node.role !== "server" || node.offline) return;
        [false, true].forEach(authenticated => {
            const key = stateKey(node.id, authenticated);
            if (visited.has(key)) return;
            visited.add(key);
            nextSteps.set(key, null);
            queue.push({ nodeId: node.id, authenticated, key });
        });
    });

    const sourceAuthenticated = source.role === "gateway";
    let sourceKey = null;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        const currentNode = nodes.find(node => node.id === current.nodeId);
        if (!currentNode) continue;

        if (current.nodeId === sourceId && current.authenticated === sourceAuthenticated) {
            sourceKey = current.key;
            break;
        }

        if (currentNode.role === "core" && !current.authenticated) continue;

        edges.forEach(edge => {
            let predecessorId = null;
            if (edge.from === current.nodeId) predecessorId = edge.to;
            else if (edge.to === current.nodeId) predecessorId = edge.from;
            if (!predecessorId) return;

            const predecessor = nodes.find(node => node.id === predecessorId);
            if (!predecessor || predecessor.offline) return;

            [false, true].forEach(authenticatedBefore => {
                if (predecessor.role === "gateway" && !authenticatedBefore) return;
                const authenticatedAfter = authenticatedBefore || currentNode.role === "gateway";
                if (currentNode.role === "core" && !authenticatedAfter) return;
                if (authenticatedAfter !== current.authenticated) return;

                const key = stateKey(predecessorId, authenticatedBefore);
                if (visited.has(key)) return;
                visited.add(key);
                nextSteps.set(key, { nextKey: current.key, edgeId: edge.id });
                queue.push({ nodeId: predecessorId, authenticated: authenticatedBefore, key });
            });
        });
    }

    if (sourceKey === null) return null;

    const nodeIds = [sourceId];
    const edgeIds = [];
    let currentKey = sourceKey;
    while (true) {
        const step = nextSteps.get(currentKey);
        if (!step) break;
        edgeIds.push(step.edgeId);
        currentKey = step.nextKey;
        nodeIds.push(currentKey.split("|")[0]);
    }

    return {
        nodeIds,
        edgeIds,
        destinationId: nodeIds[nodeIds.length - 1]
    };
}

function clearBfsVisuals() {
    if (bfsAnimationTimer !== null) {
        clearTimeout(bfsAnimationTimer);
        bfsAnimationTimer = null;
    }
    bfsRunId += 1;
    bfsFrontierIds.clear();
    bfsVisitedIds.clear();
    bfsDistances.clear();
    ttl1Count.textContent = "0";
    ttl2Count.textContent = "0";
    ttl3Count.textContent = "0";
}

function setTtlCounts(sourceId, distances) {
    let oneHop = 0;
    let twoHops = 0;
    let threeOrMoreHops = 0;

    distances.forEach((distance, nodeId) => {
        if (nodeId === sourceId) return;
        if (distance === 1) oneHop += 1;
        else if (distance === 2) twoHops += 1;
        else if (distance >= 3) threeOrMoreHops += 1;
    });

    ttl1Count.textContent = String(oneHop);
    ttl2Count.textContent = String(twoHops);
    ttl3Count.textContent = String(threeOrMoreHops);
}

function buildBfsTraversal(sourceId) {
    const source = nodes.find(node => node.id === sourceId);
    if (!source || source.offline) return null;

    const stateKey = (nodeId, authenticated) => `${nodeId}|${authenticated ? 1 : 0}`;
    const startAuthenticated = source.role === "gateway";
    const startKey = stateKey(sourceId, startAuthenticated);
    const queue = [{
        nodeId: sourceId,
        authenticated: startAuthenticated,
        key: startKey,
        distance: 0
    }];
    const visited = new Set([startKey]);
    const layers = [];
    const distances = new Map([[sourceId, 0]]);

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        if (!layers[current.distance]) layers[current.distance] = new Set();
        layers[current.distance].add(current.nodeId);

        edges.forEach(edge => {
            let neighborId = null;
            if (edge.from === current.nodeId) neighborId = edge.to;
            else if (edge.to === current.nodeId) neighborId = edge.from;
            if (!neighborId) return;

            const neighbor = nodes.find(node => node.id === neighborId);
            if (!neighbor || neighbor.offline) return;

            const authenticated = current.authenticated || neighbor.role === "gateway";
            if (neighbor.role === "core" && !authenticated) return;

            const key = stateKey(neighborId, authenticated);
            if (visited.has(key)) return;
            visited.add(key);
            if (!distances.has(neighborId)) distances.set(neighborId, current.distance + 1);
            queue.push({
                nodeId: neighborId,
                authenticated,
                key,
                distance: current.distance + 1
            });
        });
    }

    return { layers, distances };
}

function showPathResult(fromId, toId) {
    clearBfsVisuals();
    const path = findAuthorizedPath(fromId, toId);
    if (!path) {
        activePath = null;
        highlightedNodeIds.clear();
        highlightedEdgeIds.clear();
        modePrompt.textContent = "Destination Host Unreachable (0 valid routes)";
        modePrompt.hidden = false;
        render();
        return false;
    }

    activePath = { fromId, toId };
    highlightedNodeIds = new Set(path.nodeIds);
    highlightedEdgeIds = new Set(path.edgeIds);
    modePrompt.hidden = true;
    render();
    return true;
}

function showAnycastResult() {
    if (selectedId === null) return;
    clearBfsVisuals();
    cancelConnection();
    pathMode = false;
    pathFromId = null;
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();

    const route = findNearestServer(selectedId);
    if (!route) {
        activePath = null;
        highlightedNodeIds.clear();
        highlightedEdgeIds.clear();
        modePrompt.textContent = "No reachable online server";
        modePrompt.hidden = false;
        render();
        return;
    }

    activePath = { fromId: selectedId, toId: route.destinationId };
    highlightedNodeIds = new Set(route.nodeIds);
    highlightedEdgeIds = new Set(route.edgeIds);
    const server = nodes.find(node => node.id === route.destinationId);
    modePrompt.textContent = `Nearest server: ${server.label} | Total Hops: ${route.edgeIds.length}`;
    modePrompt.hidden = false;
    render();
}

function runStepBfs() {
    if (selectedId === null) return;
    const traversal = buildBfsTraversal(selectedId);
    clearBfsVisuals();
    cancelConnection();
    pathMode = false;
    pathFromId = null;
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();

    if (!traversal) {
        modePrompt.textContent = "Choose an online source node";
        modePrompt.hidden = false;
        render();
        return;
    }

    bfsDistances = traversal.distances;
    setTtlCounts(selectedId, traversal.distances);
    const runId = bfsRunId;
    let layerIndex = 0;
    const visitedNodeIds = new Set();

    function showNextLayer() {
        if (runId !== bfsRunId) return;

        if (layerIndex >= traversal.layers.length) {
            bfsFrontierIds.clear();
            bfsVisitedIds = visitedNodeIds;
            modePrompt.textContent = "BFS complete";
            bfsAnimationTimer = null;
            render();
            return;
        }

        const layer = traversal.layers[layerIndex] || new Set();
        bfsFrontierIds = new Set(layer);
        bfsVisitedIds = new Set(visitedNodeIds);
        modePrompt.textContent = layerIndex === 0
            ? "BFS: source node (0 hops)"
            : `BFS: exploring ${layerIndex} hop${layerIndex === 1 ? "" : "s"}`;
        layer.forEach(nodeId => visitedNodeIds.add(nodeId));
        layerIndex += 1;
        render();
        bfsAnimationTimer = setTimeout(showNextLayer, 550);
    }

    modePrompt.hidden = false;
    showNextLayer();
}

function cancelConnection() {
    connectFromId = null;
    edgeForm.hidden = true;
    modePrompt.hidden = true;
}

function openEdgeForm(targetId) {
    const target = nodes.find(node => node.id === targetId);
    if (!target || connectFromId === null) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = pan.x + target.x * scale;
    const screenY = pan.y + target.y * scale;
    edgeForm.hidden = false;
    edgeForm.style.left = `${Math.max(8, Math.min(screenX + 20, rect.width - 270))}px`;
    edgeForm.style.top = `${Math.max(8, Math.min(screenY - 10, rect.height - 90))}px`;
    edgeForm.dataset.targetId = targetId;
    edgeDistance.value = "1";
    edgeDistance.focus();
    edgeDistance.select();
}

function openNodeForm(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    nodeForm.hidden = false;
    nodeForm.style.left = `${Math.max(8, Math.min(clientX - rect.left + 10, rect.width - nodeForm.offsetWidth - 8))}px`;
    nodeForm.style.top = `${Math.max(8, Math.min(clientY - rect.top + 10, rect.height - nodeForm.offsetHeight - 8))}px`;
    nodeName.value = "";
    document.querySelector('input[name="nodeRole"][value="standard"]').checked = true;
    nodeName.focus();
}

function closeNodeForm() {
    nodeForm.hidden = true;
}

function saveImage() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const exportSvg = svg.cloneNode(true);
    exportSvg.setAttribute("width", String(width));
    exportSvg.setAttribute("height", String(height));
    exportSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", "grid");
    pattern.setAttribute("width", "25");
    pattern.setAttribute("height", "25");
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    const gridPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    gridPath.setAttribute("d", "M 25 0 H 0 V 25");
    gridPath.setAttribute("fill", "none");
    gridPath.setAttribute("stroke", "#e9e9e9");
    gridPath.setAttribute("stroke-width", "1");
    pattern.appendChild(gridPath);
    defs.appendChild(pattern);

    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("width", "100%");
    background.setAttribute("height", "100%");
    background.setAttribute("fill", "url(#grid)");

    const styles = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styles.textContent = `
        .node-circle{fill:#fff;stroke:#64748b;stroke-width:2}
        .node-dot{fill:#64748b}
        .node-label{fill:#334155;font:700 13px Arial,sans-serif;text-anchor:middle}
        .node.selected .node-circle{stroke:#2563eb;stroke-width:4}
        .node.selected .node-label{fill:#2563eb}
        .node.offline .node-circle{fill:#94a3b8;stroke:#e11d48;stroke-dasharray:5 4}
        .node.offline .node-dot{fill:#fff}
        .node.highlighted .node-circle{stroke:#16a34a;stroke-width:4}
        .node.selected.highlighted .node-circle{stroke:#2563eb}
        .node.bfs-frontier .node-circle{fill:#fef3c7;stroke:#d97706;stroke-width:4}
        .node.bfs-visited .node-circle{fill:#dbeafe;stroke:#3b82f6;stroke-width:3}
        .edge-line{stroke:#64748b;stroke-width:1.5}
        .edge-line.inactive{stroke:#cbd5e1;stroke-dasharray:6 5}
        .edge-line.highlighted{stroke:#16a34a;stroke-width:3}
        .edge-distance{fill:#94a3b8;font:11px Arial,sans-serif;text-anchor:middle}
        .role-badge text,.offline-badge text{fill:#fff;font:800 9px Arial,sans-serif;text-anchor:middle}
        .bfs-hop-label{fill:#fff;font:700 10px Arial,sans-serif;text-anchor:middle}
    `;

    exportSvg.insertBefore(defs, exportSvg.firstChild);
    exportSvg.insertBefore(background, exportSvg.firstChild);
    exportSvg.insertBefore(styles, exportSvg.firstChild);

    const content = new XMLSerializer().serializeToString(exportSvg);
    const url = URL.createObjectURL(new Blob([content], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "result.svg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadDemo() {
    clearBfsVisuals();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const id = label => `demo-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    nodes = [
        { id: id("Client-PC"), label: "Client-PC", role: "standard", offline: false, x: width * 0.29, y: height * 0.58 },
        { id: id("Router-A"), label: "Router-A", role: "standard", offline: true, x: width * 0.41, y: height * 0.58 },
        { id: id("Auth-Gateway"), label: "Auth-Gateway", role: "gateway", offline: false, x: width * 0.41, y: height * 0.30 },
        { id: id("Switch-1"), label: "Switch-1", role: "standard", offline: false, x: width * 0.55, y: height * 0.45 },
        { id: id("Edge-Server-1"), label: "Edge-Server-1", role: "server", offline: false, x: width * 0.70, y: height * 0.30 },
        { id: id("Core-DB"), label: "Core-DB", role: "core", offline: false, x: width * 0.70, y: height * 0.58 },
        { id: id("Switch-2"), label: "Switch-2", role: "standard", offline: false, x: width * 0.55, y: height * 0.75 },
        { id: id("Edge-Server-2"), label: "Edge-Server-2", role: "server", offline: false, x: width * 0.41, y: height * 0.88 }
    ];

    const links = [
        ["Client-PC", "Router-A", 5],
        ["Auth-Gateway", "Router-A", 8],
        ["Router-A", "Switch-1", 10],
        ["Switch-1", "Edge-Server-1", 7],
        ["Switch-1", "Core-DB", 4],
        ["Router-A", "Switch-2", 12],
        ["Switch-2", "Core-DB", 6],
        ["Switch-2", "Edge-Server-2", 9]
    ];
    edges = links.map(([from, to, distance], index) => ({
        id: `demo-edge-${index + 1}`,
        from: id(from),
        to: id(to),
        distance
    }));

    selectedId = null;
    connectFromId = null;
    pathFromId = null;
    pathMode = false;
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();
    pan = { x: 0, y: 0 };
    scale = 1;
    modePrompt.hidden = true;
    closeNodeForm();
    edgeForm.hidden = true;
    saveState();
    render();
}

canvas.addEventListener("dblclick", event => {
    if (event.target.closest(".node")) return;
    const point = screenToWorld(event.clientX, event.clientY);
    nodeForm.dataset.x = point.x;
    nodeForm.dataset.y = point.y;
    openNodeForm(event.clientX, event.clientY);
});

nodeForm.addEventListener("submit", event => {
    event.preventDefault();

    const label = nodeName.value.trim();
    if (!label) {
        nodeName.focus();
        return;
    }

    const role = document.querySelector('input[name="nodeRole"]:checked').value;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    nodes.push({
        id,
        label,
        role,
        offline: false,
        x: Number(nodeForm.dataset.x),
        y: Number(nodeForm.dataset.y)
    });

    clearBfsVisuals();
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();
    closeNodeForm();
    saveState();
    render();
});

nodeName.addEventListener("keydown", event => {
    if (event.key === "Escape") closeNodeForm();
});

document.addEventListener("pointerdown", event => {
    if (!nodeForm.hidden && !nodeForm.contains(event.target)) closeNodeForm();
    if (!edgeForm.hidden && !edgeForm.contains(event.target) &&
        !event.target.closest(".node")) {
        cancelConnection();
    }
});

canvas.addEventListener("pointerdown", event => {
    if (event.target.closest(".node")) return;
    if (!nodeForm.hidden) closeNodeForm();

    panning = true;
    panStart = {
        x: event.clientX - pan.x,
        y: event.clientY - pan.y
    };
    canvas.classList.add("panning");
});

canvas.addEventListener("pointermove", event => {
    if (!panning) return;
    pan.x = event.clientX - panStart.x;
    pan.y = event.clientY - panStart.y;
    updateTransform();
});

window.addEventListener("pointerup", () => {
    if (draggingId || panning) saveState();
    draggingId = null;
    panning = false;
    canvas.classList.remove("panning");
});

window.addEventListener("pointermove", event => {
    if (!draggingId) return;

    const node = nodes.find(item => item.id === draggingId);
    if (!node) return;

    const point = screenToWorld(event.clientX, event.clientY);
    node.x = point.x - dragOffset.x;
    node.y = point.y - dragOffset.y;
    render();
});

nodesLayer.addEventListener("pointerdown", event => {
    const nodeElement = event.target.closest(".node");
    if (!nodeElement) return;

    event.stopPropagation();
    const node = nodes.find(item => item.id === nodeElement.dataset.id);
    if (!node) return;

    if (connectFromId !== null) {
        if (node.id === connectFromId) {
            modePrompt.textContent = "Choose a different node to connect";
            return;
        }
        openEdgeForm(node.id);
        return;
    }

    if (pathMode) {
        if (pathFromId === null) {
            pathFromId = node.id;
            selectedId = node.id;
            modePrompt.textContent = "Choose destination node";
        } else if (node.id !== pathFromId) {
            const fromId = pathFromId;
            pathMode = false;
            pathFromId = null;
            selectedId = null;
            showPathResult(fromId, node.id);
        }
        render();
        return;
    }

    clearBfsVisuals();
    const point = screenToWorld(event.clientX, event.clientY);
    draggingId = node.id;
    dragOffset = {
        x: point.x - node.x,
        y: point.y - node.y
    };
    selectedId = node.id;
    if (!activePath) modePrompt.hidden = true;
    render();
});

connectBtn.addEventListener("click", () => {
    if (selectedId === null) return;

    cancelConnection();
    clearBfsVisuals();
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();
    pathMode = false;
    pathFromId = null;
    closeNodeForm();
    edgeForm.hidden = true;
    connectFromId = selectedId;
    modePrompt.textContent = "Choose target node";
    modePrompt.hidden = false;
});

document.getElementById("pathBtn").addEventListener("click", () => {
    cancelConnection();
    clearBfsVisuals();
    connectFromId = null;
    edgeForm.hidden = true;
    pathMode = true;
    pathFromId = selectedId;
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();
    modePrompt.textContent = pathFromId === null ? "Choose source node" : "Choose destination node";
    modePrompt.hidden = false;
    render();
});

stepBtn.addEventListener("click", runStepBfs);
anycastBtn.addEventListener("click", showAnycastResult);
document.getElementById("saveBtn").addEventListener("click", saveImage);
document.getElementById("loadBtn").addEventListener("click", loadDemo);

edgeForm.addEventListener("submit", event => {
    event.preventDefault();

    const distance = Number(edgeDistance.value);
    const targetId = edgeForm.dataset.targetId;
    if (!Number.isFinite(distance) || distance <= 0 || !targetId || connectFromId === null) {
        edgeDistance.focus();
        return;
    }

    const existing = edges.find(edge =>
        (edge.from === connectFromId && edge.to === targetId) ||
        (edge.to === connectFromId && edge.from === targetId));

    if (existing) {
        existing.distance = distance;
    } else {
        edges.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            from: connectFromId,
            to: targetId,
            distance
        });
    }

    selectedId = connectFromId;
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();
    clearBfsVisuals();
    cancelConnection();
    saveState();
    render();
});

document.getElementById("connectCancelBtn").addEventListener("click", cancelConnection);

edgeDistance.addEventListener("keydown", event => {
    if (event.key === "Escape") cancelConnection();
});

canvas.addEventListener("wheel", event => {
    if (!event.ctrlKey) return;
    event.preventDefault();

    const rect = svg.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const worldX = (mouseX - pan.x) / scale;
    const worldY = (mouseY - pan.y) / scale;
    const factor = event.deltaY < 0 ? 1.1 : 0.9;

    scale = Math.min(3, Math.max(0.25, scale * factor));
    pan.x = mouseX - worldX * scale;
    pan.y = mouseY - worldY * scale;

    updateTransform();
    saveState();
}, { passive: false });

canvas.addEventListener("click", event => {
    if (event.target.closest(".node")) return;
    if (pathMode) return;
    selectedId = null;
    activePath = null;
    clearBfsVisuals();
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();
    modePrompt.hidden = true;
    render();
});

function toggleSelectedOffline() {
    const selected = nodes.find(node => node.id === selectedId);
    if (!selected) return;

    const previousPath = activePath;
    selected.offline = !selected.offline;
    clearBfsVisuals();
    saveState();
    render();

    if (previousPath) {
        showPathResult(previousPath.fromId, previousPath.toId);
    }
}

offlineBtn.addEventListener("click", toggleSelectedOffline);

document.addEventListener("keydown", event => {
    const isEditing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
    if (!isEditing && !event.ctrlKey && !event.metaKey && !event.altKey &&
        event.key.toLowerCase() === "o" && selectedId !== null) {
        toggleSelectedOffline();
    }

    if (event.key === "Escape") {
        closeNodeForm();
        if (connectFromId !== null || !edgeForm.hidden) {
            cancelConnection();
        } else if (pathMode) {
            pathMode = false;
            pathFromId = null;
            modePrompt.hidden = true;
        } else {
            selectedId = null;
            activePath = null;
            highlightedNodeIds.clear();
            highlightedEdgeIds.clear();
            clearBfsVisuals();
        }
        render();
    }
});

document.getElementById("clearBtn").addEventListener("click", () => {
    nodes = [];
    edges = [];
    selectedId = null;
    cancelConnection();
    pathMode = false;
    pathFromId = null;
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();
    clearBfsVisuals();
    pan = { x: 0, y: 0 };
    scale = 1;
    closeNodeForm();
    saveState();
    render();
});

document.getElementById("deleteBtn").addEventListener("click", () => {
    if (!selectedId) return;
    nodes = nodes.filter(node => node.id !== selectedId);
    edges = edges.filter(edge => edge.from !== selectedId && edge.to !== selectedId);
    selectedId = null;
    clearBfsVisuals();
    cancelConnection();
    activePath = null;
    highlightedNodeIds.clear();
    highlightedEdgeIds.clear();
    saveState();
    render();
});

document.addEventListener("keydown", event => {
    const isEditing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
    if (isEditing) return;
    if ((event.key === "Backspace" || event.key === "Delete") && selectedId !== null) {
        event.preventDefault();
        deleteBtn.click();
    }
});

loadState();
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(error => {
        console.error("Service worker registration failed:", error);
    });
}