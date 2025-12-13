// ==UserScript==
// @id             iitc-plugin-quick-fan-fields
// @name           IITC plugin: Quick Fan Fields
// @category       Layer
// @version        1.0.0
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @description    Automated Fanfield planner with K-Means clustering, hull stitching, and export capabilities.
// @author         Enrique H. (kyke31) using Google Gemini
// @license        GNU GPLv3
// @include        https://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

/*
 * Quick Fan Fields
 * Copyright (C) 2025 Enrique H. (kyke31) using Google Gemini
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

function wrapper(plugin_info) {
    if (typeof window.plugin !== 'function') window.plugin = function() {};

    window.plugin.quickFanFields = function() {};
    var self = window.plugin.quickFanFields;

    // =========================================================================
    // CONFIGURATION & STATE
    // =========================================================================
    self.PLUGIN_VERSION = "1.0.0";
    self.PROJECT_ZOOM = 16;
    self.CLUSTER_COLORS = ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#800080']; // Rainbow Palette

    // UI & Data State
    self.dialogData = [];
    self.activeTab = 'config';
    self.isLocked = false; 
    self.clusterCount = 1;

    // Visual Layers
    self.layerGroupLinks = null;
    self.layerGroupFields = null;
    self.layerGroupNumbers = null;

    // Algorithm State
    self.allPoints = [];            // Master list of {guid, latlng, point, data}
    self.clusters = [];             // Array of Point Arrays (K-Means result)
    self.clusterHulls = [];         // Array of {points, label} for stitching
    self.globalPerimeterGuids = []; // GUIDs forming the convex hull of all points

    // Plan Results
    self.generatedLinks = [];
    self.generatedFields = [];
    self.planSections = [];         // Array of {title, type, steps: []}
    self.globalVisitedGuids = new Set();
    self.keyReqs = {};              // Map<guid, count>
    self.farmedGuids = new Set();   // Track farming requests to avoid duplicates
    self.linkMap = new Set();       // Fast lookup for existing links "guidA_guidB"

    // =========================================================================
    // INITIALIZATION & CSS
    // =========================================================================
    self.setup = function() {
        self.setupCSS();
        self.layerGroupLinks = new L.LayerGroup();
        self.layerGroupFields = new L.LayerGroup();
        self.layerGroupNumbers = new L.LayerGroup();
        
        window.addLayerGroup('QFF Links', self.layerGroupLinks, true);
        window.addLayerGroup('QFF Fields', self.layerGroupFields, true);
        window.addLayerGroup('QFF Numbers', self.layerGroupNumbers, true);
        
        $('#toolbox').append('<a onclick="window.plugin.quickFanFields.showDialog()">Quick Fan Fields</a>');
    };

    self.setupCSS = function() {
        $("<style>").prop("type", "text/css").html(`
            #qff-dialog { display: flex; flex-direction: column; height: 100%; font-family: sans-serif; font-size: 12px; color: #ccc; }
            
            /* Tabs */
            .qff-tabs { display: flex; border-bottom: 1px solid #444; background: #222; flex-shrink: 0; }
            .qff-tab-btn { flex: 1; padding: 8px; text-align: center; cursor: pointer; font-weight: bold; color: #888; border-right: 1px solid #333; background: #1a1a1a; transition: background 0.2s; }
            .qff-tab-btn:hover { background: #2a2a2a; color: #ddd; }
            .qff-tab-btn.active { background: #204020; color: #fff; border-bottom: 2px solid #3c6; }
            .qff-tab-content { display: none; height: 100%; flex-direction: column; }
            .qff-tab-content.active { display: flex; }
            
            /* Layout */
            .qff-content-area { flex: 1; overflow: hidden; position: relative; }
            .qff-layout { display: flex; height: 100%; width: 100%; overflow: hidden; }
            .qff-list { flex: 1; overflow: auto; border-right: 1px solid #444; background-color: #202020; }
            .qff-sidebar { width: 220px; display: flex; flex-direction: column; gap: 8px; padding: 8px; background: #1b1b1b; overflow-y: auto; flex-shrink: 0; }
            
            /* Tables */
            .qff-table { width: 100%; border-collapse: collapse; min-width: 300px; }
            .qff-table th, .qff-table td { border: 1px solid #444; padding: 4px; }
            .qff-table th { background-color: #1b3a4b; position: sticky; top: 0; color: #fff; text-align: center; z-index: 2; }
            .qff-col-id { width: 40px; text-align: center; font-weight: bold; color: #4da; }
            .qff-col-name { width: 120px; word-wrap: break-word; }
            .qff-col-action { width: auto; }
            .qff-row-del { color: #f55; cursor: pointer; font-weight: bold; text-align: center; }
            
            /* Controls */
            .qff-btn { background-color: #204020; border: 1px solid #3c6; color: #fff; padding: 6px; text-align: center; cursor: pointer; border-radius: 2px; user-select: none; }
            .qff-btn:hover { background-color: #306030; }
            .qff-btn:active { background-color: #3c6; color: #000; }
            .qff-btn-danger { background-color: #402020; border: 1px solid #f55; }
            .qff-btn-action { background-color: #1b3a4b; border: 1px solid #4da; }
            
            .qff-cluster-ctrl { display: flex; align-items: center; background: #222; border: 1px solid #555; border-radius: 4px; margin-bottom: 5px;}
            .qff-cluster-btn { width: 30px; background: #333; color: #fff; text-align: center; cursor: pointer; padding: 5px 0; font-weight: bold; user-select: none; }
            .qff-cluster-btn:hover { background: #444; }
            .qff-cluster-val { flex: 1; text-align: center; font-weight: bold; color: #3c6; }

            /* Stats & Headers */
            .qff-stats { display: flex; justify-content: space-around; background: #111; border-top: 2px solid #4da; padding: 8px; color: #fff; font-size: 12px; flex-shrink: 0; }
            .qff-stat-val { display: block; font-weight: bold; color: #4da; font-size: 14px; text-align: center; }
            .qff-cluster-summary { background: #222; border: 1px solid #444; padding: 5px; font-size: 11px; color: #ccc; margin-top: 10px; }
            
            .qff-step-cluster-header { background: #3c6; color: #000; padding: 5px; font-weight: bold; text-align: center; margin-top: 10px; }
            .qff-step-stitch-header { background: #d63; color: #000; padding: 5px; font-weight: bold; text-align: center; margin-top: 10px; }
            
            /* Map Elements */
            .qff-label { font-size: 14px; font-family: 'Arial Black', sans-serif; font-weight: 900; color: #ffce00; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; text-align: center; pointer-events: none; white-space: nowrap;}
            .qff-label-anchor { color: #00ff00 !important; font-size: 18px; z-index: 1000 !important; }
        `).appendTo("head");
    };

    // =========================================================================
    // UI BUILDER & INTERACTIONS
    // =========================================================================
    self.showDialog = function() {
        if (!self.dialogData) self.dialogData = [];
        self.activeTab = 'config';

        var html = `
            <div id="qff-dialog">
                <div class="qff-tabs">
                    <div id="qff-tab-btn-config" class="qff-tab-btn active" onclick="window.plugin.quickFanFields.switchTab('config')">Config</div>
                    <div id="qff-tab-btn-plan" class="qff-tab-btn" onclick="window.plugin.quickFanFields.switchTab('plan')">Plan</div>
                </div>

                <div class="qff-content-area">
                    <div id="qff-tab-config" class="qff-tab-content active">
                        <div class="qff-layout">
                            <div class="qff-list">
                                <table class="qff-table">
                                    <thead><tr>
                                        <th style="width:30px">ID</th>
                                        <th>Portal Name</th>
                                        <th style="width:30px">Del</th>
                                    </tr></thead>
                                    <tbody id="qff-table-body">${self.renderTableRows()}</tbody>
                                </table>
                            </div>
                            <div class="qff-sidebar">
                                <div class="qff-btn" onclick="window.plugin.quickFanFields.fetchPortals()">Get Portals</div>
                                <div class="qff-btn qff-btn-danger" onclick="window.plugin.quickFanFields.resetAll()">Reset</div>
                                <hr style="width:100%; border:0; border-top:1px solid #444; margin:5px 0;">
                                
                                <label style="display:block; margin-bottom:4px; font-weight:bold;">Clusters (Areas)</label>
                                <div class="qff-cluster-ctrl">
                                    <div class="qff-cluster-btn" onclick="window.plugin.quickFanFields.changeClusters(-1)">-</div>
                                    <div class="qff-cluster-val" id="qff-cluster-disp">${self.clusterCount}</div>
                                    <div class="qff-cluster-btn" onclick="window.plugin.quickFanFields.changeClusters(1)">+</div>
                                </div>
                                <div class="qff-btn" onclick="window.plugin.quickFanFields.recalculatePlan()">Shuffle Layout 🔀</div>
                                
                                <div id="qff-cluster-summary-box" class="qff-cluster-summary">
                                    </div>

                                <div style="margin-top:auto; font-size:10px; color:#888; text-align:center;">v${self.PLUGIN_VERSION}</div>
                            </div>
                        </div>
                    </div>

                    <div id="qff-tab-plan" class="qff-tab-content">
                        <div style="padding:5px; background:#222; border-bottom:1px solid #444; display:flex; justify-content:flex-end;">
                             <div class="qff-btn qff-btn-action" style="padding:4px 10px; font-size:11px;" onclick="window.plugin.quickFanFields.exportPlan()">Export CSV 💾</div>
                        </div>
                        <div id="qff-plan-content" style="flex:1; overflow-y:auto; padding:5px;"></div>
                    </div>
                </div>

                <div id="qff-stats-footer" class="qff-stats"></div>
            </div>`;

        dialog({ html: html, id: 'plugin-qff-dialog', title: `Quick Fan Fields v${self.PLUGIN_VERSION}`, width: 750, height: 550 });
        self.recalculatePlan();
    };

    self.switchTab = function(tab) {
        self.activeTab = tab;
        $('.qff-tab-btn').removeClass('active'); $('#qff-tab-btn-' + tab).addClass('active');
        $('.qff-tab-content').removeClass('active'); $('#qff-tab-' + tab).addClass('active');
        if (tab === 'plan') self.renderPlanTab();
    };

    // --- Data Rendering ---
    self.renderTableRows = function() {
        if (!self.dialogData.length) return '<tr><td colspan="3" style="text-align:center; padding:10px;">No portals. Click "Get Portals".</td></tr>';
        return self.dialogData.map(p => `
            <tr>
                <td style="text-align:center">${p.label || "-"}</td>
                <td><a href="javascript:void(0)" onclick="window.zoomToAndShowPortal('${p.guid}', [${p.lat}, ${p.lng}])">${p.name}</a></td>
                <td class="qff-row-del" onclick="window.plugin.quickFanFields.deletePortal('${p.guid}')">X</td>
            </tr>
        `).join('');
    };

    self.updateStats = function() {
        var maxKeys = 0;
        Object.values(self.keyReqs).forEach(k => { if(k > maxKeys) maxKeys = k; });
        
        var dist = self.calculateDistance();
        var ap = (self.allPoints.length * 1750) + (self.generatedLinks.length * 313) + (self.generatedFields.length * 1250);

        $('#qff-stats-footer').html(`
            <div><span class="qff-stat-val">${self.allPoints.length}</span>Portals</div>
            <div><span class="qff-stat-val">${self.generatedFields.length}</span>Fields</div>
            <div><span class="qff-stat-val">${self.generatedLinks.length}</span>Links</div>
            <div><span class="qff-stat-val">${maxKeys}</span>Max Keys</div>
            <div><span class="qff-stat-val">${dist} km</span>Walk</div>
            <div><span class="qff-stat-val">${ap.toLocaleString()}</span>AP</div>
        `);

        // Cluster Summary
        var summaryHtml = "<b>Portal Counts:</b><br>";
        if (self.clusters.length > 0 && self.clusters[0].length > 0) {
            summaryHtml += self.clusters.map((c, i) => {
                var prefix = String.fromCharCode(65 + i);
                return `Cluster ${prefix}: <b>${c.length}</b>`;
            }).join(" | ");
        } else {
            summaryHtml += "None";
        }
        $('#qff-cluster-summary-box').html(summaryHtml);
    };

    self.renderPlanTab = function() {
        var div = $('#qff-plan-content');
        if (!self.planSections.length) {
            div.html('<div style="text-align:center; margin-top:20px; color:#888;">Plan not calculated.</div>');
            return;
        }

        var html = "";
        self.planSections.forEach(sect => {
            var headerClass = sect.type === 'stitch' ? 'qff-step-stitch-header' : 'qff-step-cluster-header';
            html += `<div class="${headerClass}">${sect.title}</div>`;
            html += `<table class="qff-table" style="font-size:11px;">`;
            html += `<thead><tr><th class="qff-col-id">#</th><th class="qff-col-name">Portal</th><th class="qff-col-action">Action</th></tr></thead><tbody>`;

            sect.steps.forEach(s => {
                var totalKeysNeeded = self.keyReqs[s.guid] || 0;
                
                // Farming Instructions
                var farmHtml = "";
                if (totalKeysNeeded > 0 && !self.farmedGuids.has(s.guid)) {
                    farmHtml = `<div style="color:#ffce00; font-weight:bold;">• Farm ${totalKeysNeeded} Keys</div>`;
                    self.farmedGuids.add(s.guid);
                }
                
                // Visit Action
                var actionRows = "";
                if (sect.type === 'stitch' && s.visitedBefore) {
                    actionRows += `<div>• Arrive at (Already Captured)</div>`;
                } else {
                    actionRows += `<div>• Capture</div>`;
                }
                
                actionRows += farmHtml;
                s.links.forEach(act => actionRows += `<div>• ${act}</div>`);

                html += `<tr>
                    <td class="qff-col-id">${s.label}</td>
                    <td class="qff-col-name"><b>${s.name}</b></td>
                    <td class="qff-col-action">${actionRows}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
        });
        div.html(html);
    };

    // --- User Actions ---
    self.fetchPortals = function() {
        var list = [];
        var bounds = map.getBounds();
        var polyLayers = [];
        if (window.plugin.drawTools && window.plugin.drawTools.drawnItems) {
            window.plugin.drawTools.drawnItems.eachLayer(l => {
                if (l instanceof L.GeodesicPolygon || l instanceof L.Polygon) polyLayers.push(l);
            });
        }
        $.each(window.portals, function(guid, p) {
            var latlng = p.getLatLng();
            var keep = polyLayers.length > 0 ? polyLayers.some(poly => self.isPointInPolygon(latlng, poly)) : bounds.contains(latlng);
            if (keep) {
                var rawName = p.options.data.title || "Untitled";
                var cleanName = rawName.replace(/[.,:;#]/g, ''); // Name Sanitization
                list.push({ guid: guid, name: cleanName, lat: latlng.lat, lng: latlng.lng });
            }
        });
        self.dialogData = list;
        self.recalculatePlan();
    };

    self.changeClusters = function(delta) {
        var newVal = self.clusterCount + delta;
        if (newVal < 1) newVal = 1;
        self.clusterCount = newVal;
        $('#qff-cluster-disp').text(self.clusterCount);
        self.recalculatePlan();
    };

    self.deletePortal = function(id) { self.dialogData = self.dialogData.filter(x => x.guid !== id); self.recalculatePlan(); };
    self.resetAll = function() { self.dialogData = []; self.clusterCount = 1; self.recalculatePlan(); };

    self.exportPlan = function() {
        if (!self.planSections.length) { alert("No plan to export."); return; }
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Section,Step ID,Portal Name,Action,Check\n";

        self.planSections.forEach(sect => {
            sect.steps.forEach(s => {
                let sectionName = sect.title.replace(/,/g, ""); 
                let portalName = s.name.replace(/,/g, ""); 
                
                let actions = [];
                if (sect.type === 'stitch' && s.visitedBefore) actions.push("Arrive"); else actions.push("Capture");
                if (self.keyReqs[s.guid] > 0) actions.push(`Farm ${self.keyReqs[s.guid]} Keys`);
                s.links.forEach(l => actions.push(l));
                
                let actionStr = actions.join(" | ").replace(/,/g, "");
                csvContent += `${sectionName},${s.label},${portalName},${actionStr}, \n`;
            });
        });

        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `qff_plan_clusters_${self.clusterCount}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // =========================================================================
    // CORE LOGIC & ORCHESTRATION
    // =========================================================================
    self.recalculatePlan = function() {
        self.clearLayers();

        // 1. Initialize Points
        self.allPoints = self.dialogData.map(d => ({
            guid: d.guid,
            latlng: L.latLng(d.lat, d.lng),
            point: map.project([d.lat, d.lng], self.PROJECT_ZOOM),
            data: d,
            label: ""
        }));

        if (self.allPoints.length < 3) {
            $('#qff-table-body').html(self.renderTableRows());
            return;
        }

        // 2. Global Analysis
        var globalHullPoints = self.convexHull(self.allPoints);
        self.globalPerimeterGuids = globalHullPoints.map(p => p.guid);

        // 3. Clustering
        self.performBisectingKMeans(self.clusterCount); 

        // 4. Reset Plan State
        self.generatedLinks = [];
        self.generatedFields = [];
        self.planSections = [];
        self.globalVisitedGuids = new Set();
        self.farmedGuids = new Set();
        self.keyReqs = {}; 
        self.linkMap = new Set();
        self.allPoints.forEach(p => self.keyReqs[p.guid] = 0);
        self.clusterHulls = []; 

        // 5. Process Clusters (Fanfields)
        self.clusters.forEach((clusterPoints, idx) => {
            self.processCluster(clusterPoints, idx);
        });

        // 6. Process Stitching (Hull Zipper)
        if (self.clusterCount > 1) {
            self.performStitching();
        }

        // 7. Update UI Labels & Render
        self.dialogData.forEach(d => {
            var pt = self.allPoints.find(p => p.guid === d.guid);
            if (pt) d.label = pt.label;
        });
        
        self.updateStats();
        $('#qff-table-body').html(self.renderTableRows());
        self.drawLayer();
        if (self.activeTab === 'plan') self.renderPlanTab();
    };

    /**
     * Process a single cluster: Identify anchor, sort points, generate fan links.
     */
    self.processCluster = function(clusterPoints, idx) {
        if (clusterPoints.length === 0) return;
        var prefix = String.fromCharCode(65 + idx); // A, B, C...
        var color = self.CLUSTER_COLORS[idx % self.CLUSTER_COLORS.length];

        // Hull Calculation
        var clusterHull = self.convexHull(clusterPoints);
        self.clusterHulls.push({ points: clusterHull, label: prefix });

        // Anchor Selection (Prefer Global Hull)
        var anchor = clusterHull.find(p => self.globalPerimeterGuids.includes(p.guid));
        if (!anchor) anchor = clusterHull[0]; 

        var pointsToFan = clusterPoints.filter(p => p.guid !== anchor.guid);
        anchor.label = prefix; 
        
        // Sorting (Widest Gap)
        var sorted = self.angularSortWithGap(anchor, pointsToFan);
        
        var steps = [];
        var localVisited = [anchor];
        
        // Add Anchor Step
        self.globalVisitedGuids.add(anchor.guid);
        steps.push({ guid: anchor.guid, name: anchor.data.name, label: anchor.label, links: [], visitedBefore: false });

        // Add Target Steps
        var subIndex = 1;
        sorted.forEach(target => {
            target.label = prefix + subIndex++;
            self.globalVisitedGuids.add(target.guid);
            localVisited.push(target);
            
            var linkActions = [];
            
            // Link to Anchor
            if (!self.hasLink(target, anchor)) {
                self.addLink(target, anchor, color);
                self.keyReqs[anchor.guid]++;
                linkActions.push(`Link to ${self.formatTargetName(anchor)}`);
            }

            // Link to previous points in cluster
            for (var j = 0; j < localVisited.length; j++) {
                var past = localVisited[j];
                if (past.guid === anchor.guid || past.guid === target.guid) continue;
                
                if (!self.hasLink(target, past) && !self.isIntersecting(target, past)) {
                    var fCount = self.countFields(target, past);
                    self.addLink(target, past, color);
                    self.keyReqs[past.guid]++;
                    var note = fCount > 0 ? ` [+${fCount}F]` : "";
                    linkActions.push(`Link to ${self.formatTargetName(past)}${note}`);
                }
            }
            
            steps.push({ guid: target.guid, name: target.data.name, label: target.label, links: linkActions, visitedBefore: false });
        });

        self.planSections.push({ title: `Cluster ${prefix}`, type: 'cluster', steps: steps });
    };

    /**
     * Stitching Phase: Connects hull points of different clusters to close global fields.
     */
    self.performStitching = function() {
        var stitchSteps = [];
        var stitchPlanMap = new Map(); // Use Map to aggregate links per source portal

        // Exhaustive Hull-to-Hull check
        for (let i = 1; i < self.clusterHulls.length; i++) {
            let currHull = self.clusterHulls[i];
            
            for (let j = 0; j < i; j++) {
                let prevHull = self.clusterHulls[j];
                
                // Attempt to link Every Point in CurrHull -> Every Point in PrevHull
                currHull.points.forEach(p1 => {
                    prevHull.points.forEach(p2 => {
                        if (self.hasLink(p1, p2)) return;

                        if (!self.isIntersecting(p1, p2)) {
                            var fCount = self.countFields(p1, p2);
                            self.addLink(p1, p2, '#FFFFFF'); // Stitch Color
                            // We are at p1 (Cluster B), linking to p2 (Cluster A). Need Key for p2.
                            self.keyReqs[p2.guid]++; 
                            var note = fCount > 0 ? ` [+${fCount}F]` : "";
                            
                            if (!stitchPlanMap.has(p1.guid)) {
                                var wasVisited = self.globalVisitedGuids.has(p1.guid);
                                stitchPlanMap.set(p1.guid, { 
                                    guid: p1.guid, 
                                    name: p1.data.name, 
                                    label: p1.label, 
                                    links: [], 
                                    visitedBefore: wasVisited,
                                    lat: p1.latlng.lat 
                                });
                            }
                            stitchPlanMap.get(p1.guid).links.push(`Link to ${self.formatTargetName(p2)}${note}`);
                        }
                    });
                });
            }
        }

        // Output formatting
        stitchSteps = Array.from(stitchPlanMap.values());
        // Sort North-South for logical traversal flow
        stitchSteps.sort((a,b) => b.lat - a.lat);

        if (stitchSteps.length > 0) {
            self.planSections.push({ title: `Stitching (Hull Zipper)`, type: 'stitch', steps: stitchSteps });
        }
    };

    // =========================================================================
    // GEOMETRIC & MATH HELPERS
    // =========================================================================
    self.formatTargetName = function(target) {
        var isAnchor = /^[A-Z]$/.test(target.label);
        var prefix = isAnchor ? "Anchor " : "";
        return `${prefix}${target.label} ${target.data.name}`;
    };

    /** Bisecting K-Means: Recursively splits the largest cluster to improve density/balance. */
    self.performBisectingKMeans = function(k) {
        var clusters = [self.allPoints.slice()];
        while (clusters.length < k) {
            var biggestIdx = -1, maxLen = -1;
            clusters.forEach((c, i) => { if (c.length > maxLen) { maxLen = c.length; biggestIdx = i; } });
            if (biggestIdx === -1 || maxLen < 2) break; 
            var toSplit = clusters[biggestIdx];
            var [c1, c2] = self.runTwoMeans(toSplit);
            clusters.splice(biggestIdx, 1, c1, c2);
        }
        self.clusters = clusters;
    };

    self.runTwoMeans = function(points) {
        if (points.length < 2) return [points, []];
        var c1 = points[Math.floor(Math.random() * points.length)];
        var c2 = points[Math.floor(Math.random() * points.length)];
        // Ensure distinct seeds
        var safeGuard = 0;
        while(c1 === c2 && points.length > 1 && safeGuard < 10) { 
            c2 = points[Math.floor(Math.random() * points.length)]; 
            safeGuard++;
        }
        var group1 = [], group2 = [];
        points.forEach(p => {
            if(p.latlng.distanceTo(c1.latlng) < p.latlng.distanceTo(c2.latlng)) group1.push(p); else group2.push(p);
        });
        if(group1.length === 0) group1.push(group2.pop());
        if(group2.length === 0) group2.push(group1.pop());
        return [group1, group2];
    };

    /** Sort points angularly around anchor, then rotate to start at widest gap. */
    self.angularSortWithGap = function(anchor, points) {
        points.forEach(p => p.angle = Math.atan2(p.point.y - anchor.point.y, p.point.x - anchor.point.x));
        points.sort((a, b) => a.angle - b.angle);
        if (points.length < 2) return points;
        let maxGap = 0, splitIdx = 0;
        for(let i=0; i<points.length; i++) {
            let curr = points[i], next = points[(i+1)%points.length];
            let diff = next.angle - curr.angle;
            if(diff < 0) diff += 2*Math.PI; 
            if(diff > maxGap) { maxGap = diff; splitIdx = i+1; }
        }
        return points.slice(splitIdx).concat(points.slice(0, splitIdx));
    };

    self.isIntersecting = function(p1, p2) {
        for (var i = 0; i < self.generatedLinks.length; i++) {
            var l = self.generatedLinks[i];
            if (l.a.guid === p1.guid || l.a.guid === p2.guid || l.b.guid === p1.guid || l.b.guid === p2.guid) continue;
            if (self.linesIntersect(p1.point, p2.point, l.a.point, l.b.point)) return true;
        }
        return false;
    };

    self.addLink = function(p1, p2, color) {
        self.generatedLinks.push({ a: p1, b: p2, from: p1.latlng, to: p2.latlng, color: color });
        var k = p1.guid < p2.guid ? p1.guid + "_" + p2.guid : p2.guid + "_" + p1.guid;
        self.linkMap.add(k);
    };

    self.hasLink = function(p1, p2) {
        var k = p1.guid < p2.guid ? p1.guid + "_" + p2.guid : p2.guid + "_" + p1.guid;
        return self.linkMap.has(k);
    };

    self.countFields = function(p1, p2) {
        var count = 0;
        self.allPoints.forEach(p3 => {
            if (p3.guid === p1.guid || p3.guid === p2.guid) return;
            // Check triangle legs: (p1-p2 is candidate), we need (p1-p3) AND (p2-p3) to exist
            if (self.hasLink(p1, p3) && self.hasLink(p2, p3)) {
                count++;
                // Use field color from context of p1 creation or stitch default
                var fieldColor = self.generatedLinks[self.generatedLinks.length - 1].color || '#FFFFFF'; 
                self.generatedFields.push({ pts: [p1.latlng, p2.latlng, p3.latlng], color: fieldColor });
            }
        });
        return count;
    };

    self.convexHull = function(points) {
        if (points.length < 3) return points;
        // Sort by X then Y
        var sorted = points.slice().sort((a,b) => a.point.x === b.point.x ? a.point.y - b.point.y : a.point.x - b.point.x);
        var lower = [], upper = [];
        var cross = (o, a, b) => (a.point.x - o.point.x) * (b.point.y - o.point.y) - (a.point.y - o.point.y) * (b.point.x - o.point.x);
        
        for (var i = 0; i < sorted.length; i++) {
            while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], sorted[i]) <= 0) lower.pop();
            lower.push(sorted[i]);
        }
        for (var i = sorted.length - 1; i >= 0; i--) {
            while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], sorted[i]) <= 0) upper.pop();
            upper.push(sorted[i]);
        }
        upper.pop(); lower.pop();
        return lower.concat(upper);
    };

    self.linesIntersect = function(a,b,c,d) {
        var p = [a.x, a.y], r = [b.x-a.x, b.y-a.y], q = [c.x, c.y], s = [d.x-c.x, d.y-c.y];
        var det = r[0]*s[1] - r[1]*s[0];
        if (det === 0) return false;
        var t = ((q[0]-p[0])*s[1] - (q[1]-p[1])*s[0]) / det;
        var u = ((q[0]-p[0])*r[1] - (q[1]-p[1])*r[0]) / det;
        return (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999);
    };

    self.isPointInPolygon = function(pt, poly) {
        var polyPoints = Array.isArray(poly.getLatLngs()[0]) ? poly.getLatLngs()[0] : poly.getLatLngs();
        var x = pt.lat, y = pt.lng, inside = false;
        for (var i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
            var xi = polyPoints[i].lat, yi = polyPoints[i].lng;
            var xj = polyPoints[j].lat, yj = polyPoints[j].lng;
            var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    self.calculateDistance = function() {
        var points = [];
        self.planSections.forEach(sect => {
            sect.steps.forEach(s => {
               var p = self.allPoints.find(x => x.guid === s.guid);
               if(p) points.push(p);
            });
        });
        if (points.length < 2) return "0.00";
        var d = 0;
        for(var i=0; i<points.length-1; i++) {
            d += points[i].latlng.distanceTo(points[i+1].latlng);
        }
        return (d/1000).toFixed(2);
    };

    self.clearLayers = function() {
        if(self.layerGroupLinks) self.layerGroupLinks.clearLayers();
        if(self.layerGroupFields) self.layerGroupFields.clearLayers();
        if(self.layerGroupNumbers) self.layerGroupNumbers.clearLayers();
    };

    self.drawLayer = function() {
        self.generatedFields.forEach(f => L.polygon(f.pts, { stroke: false, fill: true, fillColor: f.color, fillOpacity: 0.1, interactive: false }).addTo(self.layerGroupFields));
        self.generatedLinks.forEach(l => {
            var dash = self.showLinkDir ? [10, 5, 5, 5, "10000"] : null;
            L.polyline([l.from, l.to], { color: l.color || '#FFFFFF', weight: 2, opacity: 0.8, dashArray: dash, interactive: false }).addTo(self.layerGroupLinks);
        });
        self.allPoints.forEach((p) => {
            var isAnchor = /^[A-Z]$/.test(p.label);
            var cls = isAnchor ? "qff-label qff-label-anchor" : "qff-label";
            L.marker(p.latlng, { icon: L.divIcon({ className: cls, html: p.label || "?", iconSize: [40, 20], iconAnchor: [20, 10] }), interactive: false }).addTo(self.layerGroupNumbers);
        });
    };

    if (window.iitcLoaded && typeof self.setup === 'function') self.setup();
    else if (window.bootPlugins) window.bootPlugins.push(self.setup);
    else window.bootPlugins = [self.setup];
}

var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
