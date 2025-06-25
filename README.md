# Sociogram Studio

An interactive, client-side sociometric analysis and visualization tool built with D3.js. You can run it via https://mertseven.com/sociogramstudio or locally by using the files in this repo.

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

Sociogram Studio is a powerful web application designed for educators, researchers, managers, and anyone interested in understanding group dynamics. It allows you to map and analyze interpersonal relationships within a group, transforming simple choice data into rich, interactive visualizations and insightful metrics.

---

## Key Features

*   **Interactive D3.js Visualization:** A force-directed graph that brings your network to life. Drag nodes, zoom, and pan to explore relationships.
*   **Advanced Sociometric Metrics:** The app goes beyond simple counts to calculate:
    *   **Sociometric Status:** Automatically classifies individuals as Popular, Rejected, Controversial, Neglected, or Average based on standardized scores.
    *   **Betweenness Centrality:** Identifies crucial "bridge" individuals who connect different parts of the network.
*   **Clique Analysis:** Instantly finds and highlights all maximal cliques (tightly-knit subgroups) within the network based on positive ties.
*   **Dynamic Filtering & Customization:**
    *   Color-code nodes by different metrics (Status, Degree, Centrality, etc.).
    *   Toggle the visibility of positive and negative relationship links.
    *   Filter the graph to show only the most connected individuals.
    *   Adjust force-simulation parameters like link distance and charge strength in real-time.
*   **Client-Side Privacy:** **Your data never leaves your browser.** All processing and analysis happens locally, ensuring 100% privacy and security.
*   **Easy Data Entry:**
    *   Manually add data row by row.
    *   Import data quickly from a `.csv` file.
*   **Export Your Work:** Download your final sociogram as a high-resolution PNG image for reports, presentations, or publications.

---

## How to Use

1.  **Open the App:** You can find a live demo hosted on GitHub Pages.
2.  **Enter Your Data:**
    *   On the **ENTER DATA** tab, either click `+ Add Row` to enter individuals and their choices manually.
    *   Or, click `Import CSV` to upload a file. The CSV should have columns like `Code`, `Name`, `MP1`, `MP2`, `MP3`, `LP1`, `LP2`, `LP3`.
3.  **Analyze:**
    *   Click the **GET ANALYSIS** button. The app will process your data and automatically switch you to the graph view.
4.  **Explore:**
    *   Navigate between the **NETWORK METRICS** tab to see a detailed table of scores.
    *   Use the controls on the **NETWORK GRAPH** tab to customize the visualization, highlight cliques, and uncover insights.

---

##  Technology Stack

*   **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
*   **Visualization:** [D3.js (v7)](https://d3js.org/)
*   **Graph Algorithms:** [jsnetworkx](https://github.com/jsnetworkx/jsnetworkx) for calculating Betweenness Centrality and finding cliques.
*   **SVG to PNG Export:** [save-svg-as-png](https://github.com/exupero/save-svg-as-png)

---

## Running Locally

To run Sociogram Studio on your local machine, you'll need a simple local web server because the application uses ES Modules, which are blocked by browser security policies when running from a local `file://` URL.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mertseven/sociogram-studio.git
    cd sociogram-studio
    ```

2.  **Start a local server:**
    *   **Using Python:**
        ```bash
        # For Python 3
        python -m http.server
        # For Python 2
        python -m SimpleHTTPServer
        ```
    *   **Using Node.js (requires `npx`):**
        ```bash
        npx http-server
        ```

3.  **Open in your browser:**
    Navigate to `http://localhost:8000` (or the port specified by your server).

---

## 📄 License

This work is licensed under a **[Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/)**.

See the `LICENSE` file for more details.

 
