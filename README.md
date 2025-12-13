# IITC Plugin: Quick Fan Fields

**Quick Fan Fields (QFF)** is an advanced field planning plugin for [IITC](https://iitc.me/) designed to maximize AP gain while minimizing walking distance and key farming fatigue.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-GNU%20GPLv3-green)

## 📖 Overview

This plugin was inspired by the classic **Fan Fields 2** plugin. While the original Fan Fields algorithm creates beautiful, AP-heavy plans, it often suffers from two logistical issues in real-world gameplay:
1.  **Excessive Walking:** It frequently requires walking back and forth between the anchor and the perimeter portals.
2.  **Key Burnout:** It demands a massive number of keys for a single anchor portal, which can be tedious to farm.

**Quick Fan Fields** solves these problems by introducing a **Spatial Clustering** approach. Instead of treating the map as one giant fan, it divides the portals into dense, localized clusters. You capture and field one specific area (Cluster A) completely before moving to the next (Cluster B), and finally "stitch" them together to close the global fields.

## ✨ Key Features

* **Bisecting K-Means Clustering:** Automatically splits your selected portals into $N$ clusters based on density and proximity. This ensures you finish one area before moving to the next.
* **Rainbow Visualization:** Each cluster is color-coded (Red, Orange, Yellow, etc.) so you can visually distinguish your work zones.
* **Recursive Hull Stitching:** After local clusters are fielded, the plugin calculates a "Zipper" path to link the edges of the clusters together, ensuring no potential field is left unmade.
* **Smart Key Management:** The plan calculates exactly how many keys are needed for *future* steps (including stitching) and instructs you to farm them the *first* time you visit the portal.
* **Optimized Routing:** The logic prioritizes a logical flow: `Capture` -> `Farm` -> `Link`.
* **Widest-Gap Sorting:** Prevents "zig-zag" links by analyzing the widest angular gap in a cluster to start the fan sequence.
* **CSV Export:** Export your plan to a spreadsheet-friendly format to share or print.

## 🚀 How It Works

1.  **Select Portals:** Use the standard Draw Tools polygon or current view to grab portals.
2.  **Cluster:** Increase the "Clusters" count. The algorithm will split the portals into logical groups to minimize movement.
3.  **Plan Generation:**
    * **Phase 1 (Local Fans):** The plugin selects an anchor for Cluster A (usually on the perimeter) and fans all portals within that cluster. It repeats this for Cluster B, C, etc.
    * **Phase 2 (Stitching):** The plugin identifies the "seams" between clusters and creates a path to link them, closing the gaps between the clusters.
4.  **Execute:** Follow the step-by-step plan list or visual map indicators.

## 🤝 Multi-Agent Coordination

A powerful feature of the **Cluster** function is coordination. If you have 3 agents meeting for a fielding operation:
1.  Set the **Clusters** count to **3**.
2.  Assign **Cluster A** to Agent 1, **Cluster B** to Agent 2, and **Cluster C** to Agent 3.
3.  Each agent works their zone independently without crossing links.
4.  Once finished, one agent (or all) can perform the **Stitching Phase** to connect the zones.

## 🛠️ Installation

1.  Install [Tampermonkey](https://www.tampermonkey.net/) or an equivalent userscript manager.
2.  Install [IITC-CE](https://iitc.app/).
3.  Create a new script in Tampermonkey and paste the contents of `quick-fan-fields.user.js`.
4.  Reload the Intel Map.

## 🎮 Usage

1.  **Draw a Polygon** around the portals you want to field (or zoom in to a specific area).
2.  Click **"Quick Fan Fields"** in the sidebar toolbox.
3.  Click **"Get Portals"**.
4.  Use the **+ / -** buttons to adjust the number of **Clusters**. Watch the map update in real-time.
5.  (Optional) Click **"Shuffle Layout 🔀"** to try different geometric arrangements for the same number of clusters.
6.  Follow the **Plan** tab instructions.
7.  Use **"Export CSV"** to save the plan.

## 👥 Credits

* **Author:** Enrique H. (kyke31)
* **Development Assistant:** Google Gemini
* **Inspiration:** This tool builds upon the concepts established by the **Fan Fields 2** plugin, adapting the logic for modern, movement-efficient gameplay.

## 📄 License

**Quick Fan Fields** is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [GNU GPLv3](https://www.gnu.org/licenses/) for more details.
