import saveSvgAsPng from 'https://esm.sh/save-svg-as-png@1.4.17';
import { findMaximalCliques, calculateBetweennessCentrality } from './graph_algorithms.js';

const nodeColorModeSelect = document.getElementById('node-color-mode');
const legendTitle = document.getElementById('legend-title');
const legendContent = document.getElementById('legend-content');
const explanationContent = document.getElementById('explanation-content');
const downloadGraphBtn = document.getElementById('download-graph-btn');
const tabs = document.querySelectorAll('#tabs li[data-tab]');
const sections = document.querySelectorAll('section.tab');
const dataTableBody = document.querySelector('#data-table tbody');
const metricsTableBody = document.querySelector('#metrics-table tbody');
const addRowBtn = document.getElementById('add-row-btn');
const clearTableBtn = document.getElementById('clear-table-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const csvFileInput = document.getElementById('csv-file-input');
const nodeLabelSelect = document.getElementById('node-label-select');
const linkDistanceInput = document.getElementById('link-distance');
const linkDistanceValueDisplay = document.getElementById('link-distance-value');
const chargeStrengthInput = document.getElementById('charge-strength');
const chargeStrengthValueDisplay = document.getElementById('charge-strength-value');
const collideRadiusFactorInput = document.getElementById('collide-radius-factor');
const collideRadiusFactorValueDisplay = document.getElementById('collide-radius-factor-value');
const showPositiveLinksCheckbox = document.getElementById('show-positive-links');
const showNegativeLinksCheckbox = document.getElementById('show-negative-links');
const minPrefsFilterInput = document.getElementById('min-prefs-filter');
const nodeLabelSizeInput = document.getElementById('node-label-size');
const nodeLabelSizeValueDisplay = document.getElementById('node-label-size-value');
const fullscreenGraphBtn = document.getElementById('fullscreen-graph-btn');
const clearHighlightBtn = document.getElementById('clear-highlight-btn');
const minCliqueSizeInput = document.getElementById('min-clique-size');
const cliqueSelector = document.getElementById('clique-selector');
const cliqueCountInfoP = document.getElementById('clique-count-info');


let masterSociogramData = { nodes: [], links: [] }; 
let allFoundCliques = []; 
let currentDisplayNodes = [];
let currentDisplayLinks = [];
let simulation; 

const svg = d3.select("#sociogram-svg");
const d3Container = document.getElementById('d3-sociogram-container');
let width, height;
let zoomableGroup; 
let linkGroup, nodeGroup;
let zoomBehavior; 
let graphInitialized = false; 

// --- Helper Math Functions ---
function calculateMean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((acc, val) => acc + val, 0) / arr.length;
}

function calculateStdDev(arr, mean) {
    if (arr.length < 2) return 0;
    const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
    const variance = calculateMean(squaredDiffs); 
    return Math.sqrt(variance);
}

// --- Sociometric Status Calculation ---
function calculateSociometricStatus(nodes) {
    if (nodes.length === 0) return;

    const prefsReceivedArr = nodes.map(n => n.preferencesReceived);
    const nonPrefsReceivedArr = nodes.map(n => n.nonPreferencesReceived);

    const meanPR = calculateMean(prefsReceivedArr);
    const stdDevPR = calculateStdDev(prefsReceivedArr, meanPR);
    const meanNPR = calculateMean(nonPrefsReceivedArr);
    const stdDevNPR = calculateStdDev(nonPrefsReceivedArr, meanNPR);

    nodes.forEach(node => {
        const zPR = stdDevPR === 0 ? 0 : (node.preferencesReceived - meanPR) / stdDevPR;
        const zNPR = stdDevNPR === 0 ? 0 : (node.nonPreferencesReceived - meanNPR) / stdDevNPR;

        const SP = zPR - zNPR; 
        const SI = zPR + zNPR; 

        if (zPR > 0.5 && SP > 0.8 && zNPR < 0) node.status = "Popular"; 
        else if (zNPR > 0.5 && SP < -0.8 && zPR < 0) node.status = "Rejected"; 
        else if (zPR > 0.5 && zNPR > 0.5 && SI > 0.8) node.status = "Controversial"; 
        else if (SI < -0.8 && zPR < 0 && zNPR < 0) node.status = "Neglected"; 
        else node.status = "Average";
    });
}


// --- D3 Setup ---
function setupD3Graph() {
    if (graphInitialized) return true; 

    const containerRect = d3Container.getBoundingClientRect();
    width = Math.floor(containerRect.width); 
    height = Math.floor(containerRect.height);

    if (width <= 0 || height <= 0) { 
        console.warn("D3 container dimensions are invalid during setup. Deferring actual SVG setup.");
        return false; 
    }
    svg.attr("width", width).attr("height", height);

    svg.append('defs').selectAll('marker')
        .data(['positive', 'negative'])
        .join('marker')
        .attr('id', d => `arrow-${d}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 19) 
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', d => d === 'positive' ? 'var(--pos)' : 'var(--neg)');

    zoomableGroup = svg.append("g").attr("id", "zoomable-graph-group");

    linkGroup = zoomableGroup.append("g").attr("class", "links");
    nodeGroup = zoomableGroup.append("g").attr("class", "nodes");


    zoomBehavior = d3.zoom()
        .scaleExtent([0.05, 10]) 
        .on("zoom", (event) => {
            if (zoomableGroup) zoomableGroup.attr("transform", event.transform);
        });
    svg.call(zoomBehavior);
    svg.on("dblclick.zoom", () => {
        if(zoomBehavior && width > 0 && height > 0) { 
            svg.transition().duration(750).call(
                zoomBehavior.transform, 
                d3.zoomIdentity, 
                d3.zoomTransform(svg.node()).invert([width / 2, height / 2])
            );
        }
    });

    simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(width / 2, height / 2)) 
        .on("tick", () => {
            if (!linkGroup || !nodeGroup) return; 
            linkGroup.selectAll(".link") 
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            nodeGroup.selectAll(".node") 
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });
    
    graphInitialized = true;
    console.log("D3 graph setup complete with dimensions:", width, height);
    return true; 
}

// --- Node Coloring and Legend Update ---
function getNodeColor(node, mode) {
    switch (mode) {
        case "status":
            return `var(--status-${node.status ? node.status.toLowerCase() : 'average'})`;
        case "preferencesReceived": 
            if (!masterSociogramData.nodes.length) return 'var(--accent-primary)'; 
            if (!nodeColorScales.preferencesReceived || nodeColorScales.preferencesReceivedExtent !== d3.extent(masterSociogramData.nodes, d => d.preferencesReceived).join('-')) {
                const extentPR = d3.extent(masterSociogramData.nodes, d => d.preferencesReceived);
                nodeColorScales.preferencesReceivedExtent = extentPR.join('-');
                nodeColorScales.preferencesReceived = d3.scaleSequential(d3.interpolateGreens).domain(extentPR);
                if (extentPR[0] === extentPR[1]) {
                     nodeColorScales.preferencesReceived = () => d3.interpolateGreens(0.5);
                }
            }
            return nodeColorScales.preferencesReceived(node.preferencesReceived);
        case "nonPreferencesReceived":
            if (!masterSociogramData.nodes.length) return 'var(--accent-primary)';
            if (!nodeColorScales.nonPreferencesReceived || nodeColorScales.nonPreferencesReceivedExtent !== d3.extent(masterSociogramData.nodes, d => d.nonPreferencesReceived).join('-')) {
                const extentNPR = d3.extent(masterSociogramData.nodes, d => d.nonPreferencesReceived);
                nodeColorScales.nonPreferencesReceivedExtent = extentNPR.join('-');
                nodeColorScales.nonPreferencesReceived = d3.scaleSequential((t) => d3.interpolateReds(t)).domain(extentNPR);
                 if (extentNPR[0] === extentNPR[1]) {
                     nodeColorScales.nonPreferencesReceived = () => d3.interpolateReds(0.5);
                }
            }
            return nodeColorScales.nonPreferencesReceived(node.nonPreferencesReceived);
        case "degree": 
            if (!masterSociogramData.nodes.length) return 'var(--accent-primary)';
            if (!nodeColorScales.degree || nodeColorScales.degreeExtent !== d3.extent(masterSociogramData.nodes, d => d.totalDegree).join('-')) {
                const extentDegree = d3.extent(masterSociogramData.nodes, d => d.totalDegree);
                nodeColorScales.degreeExtent = extentDegree.join('-');
                nodeColorScales.degree = d3.scaleSequential(d3.interpolateBlues).domain(extentDegree); 
                if (extentDegree[0] === extentDegree[1]) {
                     nodeColorScales.degree = () => d3.interpolateBlues(0.5);
                }
            }
            return nodeColorScales.degree(node.totalDegree);
        case "betweenness": 
            if (!masterSociogramData.nodes.length || typeof node.betweenness === 'undefined') return 'var(--accent-primary)';
            if (!nodeColorScales.betweenness || nodeColorScales.betweennessExtent !== d3.extent(masterSociogramData.nodes, d => d.betweenness).join('-')) {
                const extentB = d3.extent(masterSociogramData.nodes, d => d.betweenness);
                nodeColorScales.betweennessExtent = extentB.join('-');
                nodeColorScales.betweenness = d3.scaleSequential(d3.interpolateViridis).domain(extentB); 
                if (extentB[0] === extentB[1]) nodeColorScales.betweenness = () => d3.interpolateViridis(0.5);
            }
            return nodeColorScales.betweenness(node.betweenness);
        case "default":
        default:
            return 'var(--accent-primary)';
    }
}
const nodeColorScales = {};

function updateLegendAndExplanation(mode) {
    legendContent.innerHTML = '';
    explanationContent.innerHTML = '';
    let legendTitleText = "Legend";
    let explanationHTML = '';

    switch (mode) {
        case "status":
            legendTitleText = "Sociometric Status";
            const statuses = [
                { name: "Popular", color: "var(--status-popular)"},
                { name: "Rejected", color: "var(--status-rejected)"},
                { name: "Controversial", color: "var(--status-controversial)"},
                { name: "Neglected", color: "var(--status-neglected)"},
                { name: "Average", color: "var(--status-average)"},
            ];
            statuses.forEach(s => {
                legendContent.innerHTML += `
                    <div class="legend-item">
                        <div class="legend-color-box" style="background-color: ${s.color};"></div>
                        <span>${s.name}</span>
                    </div>`;
            });
            explanationHTML = `<p>This mode categorizes individuals based on how their received 'preferred' and 'non-preferred' nominations compare to the group average (using standardized scores). Status types help identify social standing within the group.</p>
                               <p><strong>Popular:</strong> Often preferred, rarely non-preferred. <strong>Rejected:</strong> Often non-preferred, rarely preferred. <strong>Controversial:</strong> Receives many preferred and non-preferred nominations. <strong>Neglected:</strong> Receives few nominations. <strong>Average:</strong> Typical social standing.</p>`;
            break;
        case "preferencesReceived":
            legendTitleText = "Preferences Received";
            if (masterSociogramData.nodes.length > 0) { 
                legendContent.innerHTML = `
                    <div class="legend-gradient" style="background: linear-gradient(to right, ${d3.interpolateGreens(0.1)}, ${d3.interpolateGreens(0.9)});"></div>
                    <div class="legend-gradient-labels"><span>Low Count</span><span>High Count</span></div>`;
            }
            explanationHTML = `<p>Nodes are colored based on the number of 'Most Preferred' nominations they received. Greener nodes received more 'preferred' nominations, indicating higher positive peer regard.</p>`;
            break;
        case "nonPreferencesReceived":
            legendTitleText = "Non-Preferences Received";
             if (masterSociogramData.nodes.length > 0) {
                legendContent.innerHTML = `
                    <div class="legend-gradient" style="background: linear-gradient(to right, ${d3.interpolateReds(0.1)}, ${d3.interpolateReds(0.9)});"></div>
                    <div class="legend-gradient-labels"><span>Low Count</span><span>High Count</span></div>`;
            }
            explanationHTML = `<p>Nodes are colored based on the number of 'Least Preferred' nominations they received. Redder nodes received more 'non-preferred' nominations, indicating higher negative peer regard.</p>`;
            break;
        case "degree":
            legendTitleText = "Total Degree";
            if (masterSociogramData.nodes.length > 0) {
                legendContent.innerHTML = `
                    <div class="legend-gradient" style="background: linear-gradient(to right, ${d3.interpolateBlues(0.1)}, ${d3.interpolateBlues(0.9)});"></div>
                    <div class="legend-gradient-labels"><span>Low Degree</span><span>High Degree</span></div>`;
            }
            explanationHTML = `<p>Nodes are colored based on their 'Total Degree' (total number of incoming and outgoing connections, both positive and negative). Darker blue nodes have more connections, indicating higher overall activity or involvement in the network.</p>`;
            break;
        case "betweenness":
            legendTitleText = "Betweenness Centrality";
            if (masterSociogramData.nodes.length > 0) {
                legendContent.innerHTML = `
                    <div class="legend-gradient" style="background: linear-gradient(to right, ${d3.interpolateViridis(0)}, ${d3.interpolateViridis(1)});"></div>
                    <div class="legend-gradient-labels"><span>Low</span><span>High</span></div>`;
            }
            explanationHTML = `<p>Colors nodes by Betweenness Centrality. Nodes with higher scores (brighter/more towards the 'high' end of the gradient) act as bridges between different parts of the network. They lie on many shortest paths between other pairs of nodes.</p>`;
            break;
        case "default":
            legendTitleText = "Node Color";
             legendContent.innerHTML += `
                    <div class="legend-item">
                        <div class="legend-color-box" style="background-color: var(--accent-primary);"></div>
                        <span>Default</span>
                    </div>`;
            explanationHTML = `<p>All nodes are shown with a default color. This mode is useful for focusing on network structure without emphasis on individual attributes.</p>`;
            break;
    }
    legendTitle.textContent = legendTitleText;
    explanationContent.innerHTML = explanationHTML;
}


// --- D3 Graph Update ---
function updateD3Graph() {
    if (!graphInitialized) {
        console.warn("Attempted to update D3 graph before proper initialization.");
        if (!setupD3Graph()) { 
             return; 
        }
    }
    
    const containerRect = d3Container.getBoundingClientRect();
    const currentWidth = Math.floor(containerRect.width);
    const currentHeight = Math.floor(containerRect.height);

    if (currentWidth > 0 && currentHeight > 0 && (width !== currentWidth || height !== currentHeight)) {
        width = currentWidth;
        height = currentHeight;
        svg.attr("width", width).attr("height", height);
        if (simulation) {
            simulation.force("center", d3.forceCenter(width / 2, height / 2));
        }
    }


    if (!currentDisplayNodes.length && !currentDisplayLinks.length && !masterSociogramData.nodes.length) { 
        if (linkGroup) linkGroup.selectAll("*").remove(); 
        if (nodeGroup) nodeGroup.selectAll("*").remove();
        if (simulation) simulation.nodes([]).force("link", null); 
        updateLegendAndExplanation(nodeColorModeSelect.value);
        return;
    }
    
    const nodeLabelType = nodeLabelSelect.value;
    const currentLabelSize = +nodeLabelSizeInput.value;
    const linkDist = +linkDistanceInput.value;
    const chargeStr = +chargeStrengthInput.value;
    const collideFactor = +collideRadiusFactorInput.value;
    const currentColorMode = nodeColorModeSelect.value;

    updateLegendAndExplanation(currentColorMode);

    let nodesForSim = currentDisplayNodes.map(d => ({...d}));
    let linksForSim = currentDisplayLinks.map(d => ({...d}));

    simulation
        .nodes(nodesForSim)
        .force("link", d3.forceLink(linksForSim).id(d => d.id).distance(linkDist).strength(0.4))
        .force("charge", d3.forceManyBody().strength(chargeStr))
        .force("collide", d3.forceCollide().radius(d => d.radius * collideFactor + 3).strength(0.8));

    const links = linkGroup.selectAll(".link")
        .data(linksForSim, d => d.id);
    
    links.exit().remove();
    links.enter().append("line")
        .attr("class", "link")
        .merge(links) 
        .attr("stroke", d => d.type === 'positive' ? 'var(--pos)' : 'var(--neg)')
        .attr("stroke-width", 2)
        .attr("marker-end", d => `url(#arrow-${d.type})`);


    const nodes = nodeGroup.selectAll(".node")
        .data(nodesForSim, d => d.id);

    nodes.exit().remove();
    const nodeEnter = nodes.enter().append("g").attr("class", "node");

    nodeEnter.append("circle")
        .attr("r", d => d.radius)
        .on("mouseover", (event, d_node) => { 
            linkGroup.selectAll(".link").style('opacity', l => {
                const sourceId = l.source.id || l.source;
                const targetId = l.target.id || l.target;
                return (sourceId === d_node.id || targetId === d_node.id) ? 1 : 0.2;
            });
        })
        .on("mouseout", () => { 
            linkGroup.selectAll(".link").style('opacity', 0.7);
        });
    
    nodeEnter.append("text")
        .attr("text-anchor", "middle");
    
    nodeEnter.merge(nodes) 
        .each(function(d_node) { 
            d3.select(this).select("circle")
                .attr("r", d_node.radius)
                .attr("fill", getNodeColor(d_node, currentColorMode));
            d3.select(this).select("text")
                .attr("dy", d_node.radius + 12 + (currentLabelSize / 10)) 
                .style("font-size", `${currentLabelSize}px`) 
                .text(nodeLabelType === 'name' ? (d_node.label || d_node.id) : d_node.id);
        })
        .call(drag(simulation));

    
    if (simulation.alpha() < 0.1) { 
        simulation.alpha(0.6).restart();
    } else { 
        simulation.nodes(nodesForSim); 
        if (simulation.force("link")) {
            simulation.force("link").links(linksForSim); 
        }
    }
}

// --- Drag Function ---
function drag(simulationInstance) { 
    function dragstarted(event, d) {
        if (!event.active) simulationInstance.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    function dragended(event, d) {
        if (!event.active) simulationInstance.alphaTarget(0);
    }
    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
}


// --- Apply Filters and Redraw ---
function applyFiltersAndRedraw() { 
    const showPositive = showPositiveLinksCheckbox.checked;
    const showNegative = showNegativeLinksCheckbox.checked;
    const minPrefs = +minPrefsFilterInput.value;

    currentDisplayNodes = masterSociogramData.nodes.filter(node => node.preferencesReceived >= minPrefs);
    const visibleNodeIds = new Set(currentDisplayNodes.map(n => n.id));

    currentDisplayLinks = masterSociogramData.links.filter(link => {
        const sourceId = link.source.id || link.source; 
        const targetId = link.target.id || link.target;
        if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) return false;
        if (link.type === 'positive' && showPositive) return true;
        if (link.type === 'negative' && showNegative) return true;
        return false;
    });
    updateD3Graph();
}

// --- Tab Navigation ---
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    sections.forEach(s => {
        s.classList.remove('active');
    });
    tab.classList.add('active');
    const activeSection = document.getElementById(tab.dataset.tab);
    activeSection.classList.add('active');
    
    if (tab.dataset.tab === 'graph') {
        requestAnimationFrame(() => { 
            if (!graphInitialized) { 
                if (!setupD3Graph()) { 
                    console.error("Failed to initialize graph on tab click.");
                    return;
                }
            } else { 
                 const containerRect = d3Container.getBoundingClientRect();
                 if (containerRect.width > 0 && containerRect.height > 0) { 
                    const newWidth = Math.floor(containerRect.width);
                    const newHeight = Math.floor(containerRect.height);

                    if (width !== newWidth || height !== newHeight) {
                        width = newWidth;
                        height = newHeight;
                        svg.attr("width", width).attr("height", height);
                        if (simulation) {
                            simulation.force("center", d3.forceCenter(width / 2, height / 2));
                            if (currentDisplayNodes.length > 0) simulation.alpha(0.3).restart(); 
                        }
                    }
                }
            }
            if(masterSociogramData.nodes.length > 0 && currentDisplayNodes.length === 0 && currentDisplayLinks.length === 0){
                applyFiltersAndRedraw();
            } else if (currentDisplayNodes.length > 0) {
                updateD3Graph(); 
            } else { 
                updateLegendAndExplanation(nodeColorModeSelect.value);
            }
        });
    }
  });
});


// --- Data Table ---
function createEditableRow(rowData = []) {
  const tr = document.createElement('tr');
  for (let i = 0; i < 8; i++) { 
    const td = document.createElement('td');
    td.contentEditable = true;
    td.textContent = rowData[i] || '';
    tr.appendChild(td);
  }
  const actionTd = document.createElement('td');
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.classList.add('danger');
  deleteBtn.onclick = () => tr.remove();
  actionTd.appendChild(deleteBtn);
  tr.appendChild(actionTd);
  dataTableBody.appendChild(tr);
  if (dataTableBody.children.length === 1 && !rowData.length) {
    tr.cells[0].focus();
  }
}
addRowBtn.addEventListener('click', () => createEditableRow());

clearTableBtn.addEventListener('click', () => {
    dataTableBody.innerHTML = '';
    masterSociogramData = { nodes: [], links: [] };
    allFoundCliques = [];
    currentDisplayNodes = [];
    currentDisplayLinks = [];

    if (graphInitialized) { 
        if(linkGroup) linkGroup.selectAll("*").remove();
        if(nodeGroup) nodeGroup.selectAll("*").remove();
        if (simulation) simulation.nodes([]).force("link", null).alpha(1).stop(); 
    }
    metricsTableBody.innerHTML = ''; 
    populateCliqueSelector(); 
    cliqueCountInfoP.textContent = "";
    clearHighlights();
    updateLegendAndExplanation(nodeColorModeSelect.value); 
    if (zoomBehavior && svg.node() && graphInitialized) {
        svg.call(zoomBehavior.transform, d3.zoomIdentity);
    }
});

csvFileInput.addEventListener('change', (event) => { 
  const file = event.target.files[0];
  if (file) {
    clearTableBtn.click(); 

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.split(/\r\n|\n/).filter(row => row.trim() !== '');
      let dataRows = rows;
      if (rows.length > 0) {
          const firstRowCells = rows[0].split(',').map(cell => cell.trim().toLowerCase());
          const mpHeaders = ['code', 'name', 'mp1', 'mp2', 'mp3', 'lp1', 'lp2', 'lp3'];
          const mlHeaders = ['code', 'name', 'ml1', 'ml2', 'ml3', 'll1', 'll2', 'll3'];
          if (mpHeaders.every(h => firstRowCells.includes(h)) || mlHeaders.every(h => firstRowCells.includes(h))) {
              dataRows = rows.slice(1);
          }
      }
      dataRows.forEach(rowStr => {
        const cells = rowStr.split(',').map(cell => cell.trim());
        createEditableRow(cells);
      });
    };
    reader.readAsText(file);
    csvFileInput.value = ''; 
  }
});

// --- Populate Clique Selector ---
function populateCliqueSelector() {
    const minSize = parseInt(minCliqueSizeInput.value, 10) || 2;
    cliqueSelector.innerHTML = ''; 

    const filteredCliques = allFoundCliques.filter(clique => clique.length >= minSize);
    filteredCliques.sort((a,b) => b.length - a.length || JSON.stringify(a).localeCompare(JSON.stringify(b))); 

    if (filteredCliques.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = `-- No cliques of size ${minSize}+ --`;
        cliqueSelector.appendChild(option);
        cliqueSelector.disabled = true;
        cliqueCountInfoP.textContent = `Found 0 cliques with at least ${minSize} members.`;
        clearHighlights(); 
        return;
    }

    cliqueSelector.disabled = false;
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Select a Clique";
    cliqueSelector.appendChild(defaultOption);

    filteredCliques.forEach((clique, index) => {
        const option = document.createElement('option');
        option.value = index; 
        const memberNames = clique.map(id => {
            const node = masterSociogramData.nodes.find(n => n.id === id);
            return node ? (node.label || node.id) : id;
        }).slice(0, 3); 
        option.textContent = `Clique ${index + 1} (Size: ${clique.length}): ${memberNames.join(', ')}${clique.length > 3 ? '...' : ''}`;
        option.dataset.cliqueMembers = JSON.stringify(clique); 
        cliqueSelector.appendChild(option);
    });
    cliqueCountInfoP.textContent = `Found ${filteredCliques.length} clique(s) with at least ${minSize} members.`;
}


// --- Analysis ---
analyzeBtn.addEventListener('click', () => {
    masterSociogramData = { nodes: [], links: [] };
    allFoundCliques = [];
    currentDisplayNodes = [];
    currentDisplayLinks = [];
    if (graphInitialized) {
        if(linkGroup) linkGroup.selectAll("*").remove();
        if(nodeGroup) nodeGroup.selectAll("*").remove();
        if (simulation) simulation.nodes([]).force("link", null).alpha(1).stop();
    }
    metricsTableBody.innerHTML = '';
    populateCliqueSelector(); 
    cliqueCountInfoP.textContent = "";
    clearHighlights();


    const tableRows = [...dataTableBody.rows];
    if (tableRows.length === 0) {
        alert("Data table is empty. Please add data or import a CSV.");
        return;
    }

    const nodesMap = new Map();
    const edges = []; 
    const nominationsBySource = new Map(); 

    // Refined first pass to gather all unique codes first
    const allCodesInTable = new Set();
    tableRows.forEach(r => {
        const cells = [...r.cells].map(c => c.innerText.trim());
        if (cells[0]) allCodesInTable.add(cells[0]); 
        for (let k = 2; k < 8; k++) { 
            if (cells[k]) allCodesInTable.add(cells[k]);
        }
    });

    allCodesInTable.forEach(code => {
        if (!nodesMap.has(code)) {
            let foundName = code; 
            for (const r_inner of tableRows) {
                const cells_inner = [...r_inner.cells].map(c_inner => c_inner.innerText.trim());
                if (cells_inner[0] === code && cells_inner[1]) {
                    foundName = cells_inner[1];
                    break;
                }
            }
            nodesMap.set(code, { 
                id: code, label: foundName, 
                preferencesReceived: 0, nonPreferencesReceived: 0, 
                preferencesGiven: 0, nonPreferencesGiven: 0, 
                totalDegree: 0,
                positiveReciprocal: 0, status: 'Average',
                betweenness: 0
            });
        }
    });


    tableRows.forEach(r => {
        const cells = [...r.cells].map(c => c.innerText.trim());
        const sourceCode = cells[0];
        if (!sourceCode || !nodesMap.has(sourceCode)) {
            return;
        }
        const sourceNode = nodesMap.get(sourceCode);
        const nominations = cells.slice(2, 8); 

        if (!nominationsBySource.has(sourceCode)) {
            nominationsBySource.set(sourceCode, { positive: new Set(), negative: new Set() });
        }
        const sourceNoms = nominationsBySource.get(sourceCode);

        nominations.forEach((targetCode, i) => {
          if (!targetCode) return;
          const type = i < 3 ? 'positive' : 'negative';
          
          if (!nodesMap.has(targetCode)) { 
            console.warn(`Target code ${targetCode} nominated by ${sourceCode} was not found despite refined scan. Creating it now.`);
            nodesMap.set(targetCode, { 
                id: targetCode, label: targetCode, 
                preferencesReceived: 0, nonPreferencesReceived: 0, 
                preferencesGiven: 0, nonPreferencesGiven: 0,
                totalDegree: 0,
                positiveReciprocal: 0, status: 'Average',
                betweenness: 0
            });
          }
          edges.push({ 
            id: `e-${sourceCode}-${targetCode}-${i}-${type}`, 
            source: sourceCode,
            target: targetCode,
            type
          });
          const targetNode = nodesMap.get(targetCode);

          sourceNode.totalDegree++; 
          targetNode.totalDegree++; 

          if (type === 'positive') {
            targetNode.preferencesReceived++; 
            sourceNode.preferencesGiven++; 
            sourceNoms.positive.add(targetCode);
          } else {
            targetNode.nonPreferencesReceived++; 
            sourceNode.nonPreferencesGiven++; 
            sourceNoms.negative.add(targetCode);
          }
        });
    });

    nodesMap.forEach((node, sourceCode) => { 
        const myPositiveNoms = nominationsBySource.get(sourceCode)?.positive || new Set();
        myPositiveNoms.forEach(targetCode => {
            const targetNomsToMe = nominationsBySource.get(targetCode)?.positive || new Set();
            if (targetNomsToMe.has(sourceCode)) {
                node.positiveReciprocal++;
            }
        });
    });
    
    masterSociogramData.nodes = Array.from(nodesMap.values());
    masterSociogramData.links = edges; 

    if (masterSociogramData.nodes.length > 0) {
        try {
            const betweennessMap = calculateBetweennessCentrality(masterSociogramData.nodes, masterSociogramData.links);

            masterSociogramData.nodes.forEach(node => {
                node.betweenness = betweennessMap.get(node.id) || 0;
            });
        } catch(e) {
            console.error("Error calculating jsnx centrality metrics:", e);
        }


        calculateSociometricStatus(masterSociogramData.nodes); 
        Object.keys(nodeColorScales).forEach(key => nodeColorScales[key] = null);
        
        masterSociogramData.nodes = masterSociogramData.nodes.map(n => ({
            ...n,
            radius: 5 + Math.sqrt(n.preferencesReceived + n.preferencesGiven) * 2.5 
        }));
        
        try {
            allFoundCliques = findMaximalCliques(masterSociogramData.nodes, masterSociogramData.links);
        } catch(e) {
            console.error("Error finding cliques with jsnx:", e);
            allFoundCliques = [];
        }
        populateCliqueSelector(); 
        clearHighlights(); 
        cliqueSelector.value = ""; 
    }


    updateMetricsTable(masterSociogramData.nodes); 
    
    const graphTabButton = document.querySelector('#tabs li[data-tab="graph"]');
    if (graphTabButton) {
        if (!document.getElementById('graph').classList.contains('active')) {
            graphTabButton.click(); 
        } else {
            requestAnimationFrame(() => {
                if (!graphInitialized) { 
                    if(!setupD3Graph()) {
                         console.error("Graph setup failed during analysis while tab was active.");
                         return;
                    }
                }
                const containerRect = d3Container.getBoundingClientRect();
                 if (containerRect.width > 0 && containerRect.height > 0) {
                    width = Math.floor(containerRect.width);
                    height = Math.floor(containerRect.height);
                    svg.attr("width", width).attr("height", height);
                    if (simulation) {
                        simulation.force("center", d3.forceCenter(width / 2, height / 2));
                    }
                }
                applyFiltersAndRedraw(); 
                if (zoomBehavior && svg.node() && graphInitialized) { 
                    svg.call(zoomBehavior.transform, d3.zoomIdentity); 
                }
            });
        }
    }
});

// --- Metrics Table Update ---
function updateMetricsTable(nodes) { 
  metricsTableBody.innerHTML = ''; 
  nodes.forEach(node => {
    const tr = document.createElement('tr');
    const socialPreferenceScore = node.preferencesReceived - node.nonPreferencesReceived; 
    tr.innerHTML = `
      <td>${node.id}</td>
      <td>${node.label || node.id}</td>
      <td>${node.preferencesReceived}</td> 
      <td>${node.nonPreferencesReceived}</td>
      <td>${node.preferencesGiven}</td>
      <td>${node.nonPreferencesGiven}</td>
      <td>${node.totalDegree}</td>
      <td>${node.positiveReciprocal}</td>
      <td>${socialPreferenceScore}</td>
      <td>${node.status || 'N/A'}</td>
      <td>${node.betweenness !== undefined ? node.betweenness.toFixed(3) : 'N/A'}</td>
    `;
    metricsTableBody.appendChild(tr);
  });
}

// --- Clique Highlighting ---
function highlightClique(cliqueMemberIds) {
    const cliqueSet = new Set(cliqueMemberIds);

    if (nodeGroup) {
        nodeGroup.selectAll(".node")
            .classed("highlighted", d => cliqueSet.has(d.id))
            .classed("faded", d => !cliqueSet.has(d.id));
    }

    if (linkGroup) {
        linkGroup.selectAll(".link")
            .classed("highlighted", d => {
                const sourceId = d.source.id || d.source; 
                const targetId = d.target.id || d.target;
                return cliqueSet.has(sourceId) && cliqueSet.has(targetId);
            })
            .classed("faded", d => {
                 const sourceId = d.source.id || d.source;
                 const targetId = d.target.id || d.target;
                return !(cliqueSet.has(sourceId) && cliqueSet.has(targetId));
            });
    }
    clearHighlightBtn.style.display = 'inline-block';
}

function clearHighlights() {
    if (nodeGroup) nodeGroup.selectAll(".node").classed("highlighted", false).classed("faded", false);
    if (linkGroup) linkGroup.selectAll(".link").classed("highlighted", false).classed("faded", false);
    clearHighlightBtn.style.display = 'none';
}


// --- Graph Control Listeners ---
function setupGraphControlListeners() {
    nodeLabelSelect.addEventListener('change', updateD3Graph);
    nodeColorModeSelect.addEventListener('change', updateD3Graph);
    nodeLabelSizeInput.addEventListener('input', () => {
        nodeLabelSizeValueDisplay.textContent = nodeLabelSizeInput.value;
        if (graphInitialized && currentDisplayNodes.length > 0) {
            updateD3Graph(); 
        }
    });

    [linkDistanceInput, chargeStrengthInput, collideRadiusFactorInput].forEach(input => {
        input.addEventListener('input', () => {
            if (input.id === 'link-distance') linkDistanceValueDisplay.textContent = input.value;
            if (input.id === 'charge-strength') chargeStrengthValueDisplay.textContent = input.value;
            if (input.id === 'collide-radius-factor') collideRadiusFactorValueDisplay.textContent = input.value;
            
            if (simulation && currentDisplayNodes.length > 0) { 
                 if (input.id === 'link-distance') simulation.force("link").distance(+input.value);
                 if (input.id === 'charge-strength') simulation.force("charge").strength(+input.value);
                 if (input.id === 'collide-radius-factor') simulation.force("collide").radius(d => d.radius * (+input.value) + 3);
                 simulation.alpha(0.3).restart(); 
            } else if (masterSociogramData.nodes.length > 0) { 
                applyFiltersAndRedraw();
            }
        });
    });

    [showPositiveLinksCheckbox, showNegativeLinksCheckbox, minPrefsFilterInput].forEach(input => {
        input.addEventListener('input', applyFiltersAndRedraw); 
    });

    downloadGraphBtn.addEventListener('click', () => {
        const svgElement = document.getElementById('sociogram-svg');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        const options = {
            backgroundColor: getComputedStyle(d3Container).backgroundColor || 'var(--bg-primary)',
            scale: 2 
        };
        saveSvgAsPng.saveSvgAsPng(svgElement, `sociogram-${timestamp}.png`, options);
    });

    fullscreenGraphBtn.addEventListener('click', () => {
        // FIX: Target the entire graph section for fullscreen
        const elem = document.getElementById('graph'); 

        if (!document.fullscreenElement &&   
            !document.mozFullScreenElement && 
            !document.webkitFullscreenElement && 
            !document.msFullscreenElement) {  
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.mozRequestFullScreen) { 
                elem.mozRequestFullScreen();
            } else if (elem.webkitRequestFullscreen) { 
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { 
                elem.msRequestFullscreen();
            }
        } else { 
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) { 
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) { 
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { 
                document.msExitFullscreen();
            }
        }
    });

    minCliqueSizeInput.addEventListener('input', () => {
        if (allFoundCliques.length > 0 || masterSociogramData.nodes.length > 0) { 
            populateCliqueSelector();
            clearHighlights();
            cliqueSelector.value = "";
        }
    });

    cliqueSelector.addEventListener('change', (event) => {
        const selectedOption = event.target.selectedOptions[0];
        if (selectedOption && selectedOption.value !== "") {
            try {
                const cliqueMembers = JSON.parse(selectedOption.dataset.cliqueMembers);
                const visibleCliqueMembers = cliqueMembers.filter(id => 
                    currentDisplayNodes.find(n => n.id === id)
                );
                if (visibleCliqueMembers.length >= 2) {
                    highlightClique(visibleCliqueMembers);
                } else {
                    clearHighlights();
                    alert("Selected clique members are not sufficiently visible with current graph filters.");
                }
            } catch (e) {
                console.error("Error parsing clique members from selector:", e);
                clearHighlights();
            }
        } else {
            clearHighlights(); 
        }
    });

    clearHighlightBtn.addEventListener('click', () => {
        clearHighlights();
        cliqueSelector.value = ""; 
    });

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}

function handleFullscreenChange() {
    // This function now correctly resizes the SVG after entering/exiting fullscreen
    setTimeout(() => {
        // No need to check for fullscreen class, just check if the tab is active
        if (document.getElementById('graph').classList.contains('active')) {
            requestAnimationFrame(() => {
                const containerRect = d3Container.getBoundingClientRect();
                if (containerRect.width > 0 && containerRect.height > 0) {
                    const newWidth = Math.floor(containerRect.width);
                    const newHeight = Math.floor(containerRect.height);
                    
                    // Only resize if there's a significant change
                    if (width !== newWidth || height !== newHeight) {
                        width = newWidth;
                        height = newHeight;
                        svg.attr("width", width).attr("height", height);
                        if (simulation) {
                            simulation.force("center", d3.forceCenter(width / 2, height / 2));
                            if (currentDisplayNodes.length > 0) {
                                // A more vigorous restart for the layout
                                simulation.alpha(0.5).restart();
                            }
                        }
                    }
                    // Always update the graph to ensure labels/etc are correct
                    if (currentDisplayNodes.length > 0) {
                        updateD3Graph();
                    }
                }
            });
        }
    }, 150); // Increased timeout slightly for stability
}

// --- Initialize App ---
function initializeApp() {
    createEditableRow(); 
    setupGraphControlListeners(); 
    updateLegendAndExplanation(nodeColorModeSelect.value);

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            // We only care about the SVG's container
            if (entry.target === d3Container && graphInitialized) { 
                // Don't resize if we are in fullscreen, handleFullscreenChange will manage it
                if (document.fullscreenElement) {
                    return;
                }
                requestAnimationFrame(() => { 
                    const newWidth = Math.floor(entry.contentRect.width);
                    const newHeight = Math.floor(entry.contentRect.height);
                    if (newWidth > 0 && newHeight > 0 ) {
                        if (width !== newWidth || height !== newHeight) {
                            width = newWidth;
                            height = newHeight;
                            svg.attr("width", width).attr("height", height);
                            if (simulation) {
                                simulation.force("center", d3.forceCenter(width / 2, height / 2));
                                if (document.getElementById('graph').classList.contains('active') && currentDisplayNodes.length > 0) {
                                   simulation.alpha(0.1).restart();
                                }
                            }
                        }
                    }
                });
            }
        }
    });
    if (d3Container) resizeObserver.observe(d3Container);
    else console.error("D3 container not found for ResizeObserver.");
    
    const firstTab = document.querySelector('#tabs li[data-tab]');
    if (firstTab) {
        setTimeout(() => firstTab.click(), 50); 
    }
}

initializeApp();