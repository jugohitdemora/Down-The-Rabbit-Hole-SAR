# SAR Colombia Viewer

An interactive, browser‑based geospatial viewer to explore Synthetic Aperture Radar (SAR) imagery across Colombia (2016–2023). Built for quick visual analysis of wetness dynamics, off‑channel water (e.g., mining ponds/canals), and related environmental change.

Badges: NASA Space Apps Challenge • Leaflet.js • Vanilla JS

---

## Overview

This single‑page web app lets you:
- Visualize SAR‑derived layers on an interactive map of Colombia.
- Step through time with a quarterly timeline (2016–2023) and autoplay.
- Inspect dynamic layers (SAR RGB, Wetness, Out‑of‑channel water, Pond density).
- Toggle static overlays for context (water frequency, recent change, main channel, buffer).
- Jump to preconfigured areas of interest (e.g., Río Quito, Depresión Momposina, Sabana de Bogotá).

No build pipeline is required — it’s plain HTML/CSS/JavaScript using Leaflet and CDN assets.

---

## Quick Start

Prerequisites
- A modern browser (Chrome, Firefox, Edge, Safari)
- Internet connection (tiles are loaded from Google Cloud Storage)

Option 1: Open directly
```
start index.html      # Windows
open index.html       # macOS
xdg-open index.html   # Linux
```

Option 2: Serve locally (recommended)
```
# Python 3
python -m http.server 8000

# Node (if you have it)
npx serve

# Then visit:
http://localhost:8000
```

Option 3: VS Code Live Server
- Install the “Live Server” extension
- Right‑click `index.html` → “Open with Live Server”

---

## How To Use

- Choose a dynamic layer: open Layers and select SAR RGB, Wetness, Out‑of‑channel water, or Pond density.
- Explore in time: drag the timeline or enable autoplay to move through quarters.
- Add context: toggle static overlays (frequency, change, main channel, buffer) and adjust opacity.
- Show references: enable Colombia boundary and place labels.
- Events: pick a preset area (e.g., Río Quito) from the left sidebar to jump there and load its tile strategy.

---

## Layers

Dynamic layers (vary by quarter)
- SAR RGB (VV,VH,VV): three‑band composite to visualize texture and moisture context.
- Water / Wetness: low backscatter indicating inundation or waterlogged surfaces.
- Out‑of‑channel water: wet pixels away from the main river channel (useful for spotting ponds/canals).
- Pond density (≈250 m): concentration of “suspect” pixels within a local neighborhood.

Static overlays (reference)
- 2016–2023 frequency: share of months each pixel is wet (long‑term persistence).
- Post–pre change: difference in wetness between 2021–2023 vs. 2016–2018.
- Main channel: persistent water mask (e.g., derived from JRC Global Surface Water occurrence).
- Channel buffer: ~150 m buffer around the main channel mask.

---

## Data & Storage

- Source bucket: `sar-colombia-tiles` (Google Cloud Storage)
- Global tiles (by quarter):
  - `https://storage.googleapis.com/sar-colombia-tiles/tiles/{layerKey}/{quarter}/{z}/{x}/{y}.png`
- Event‑specific tiles (by year):
  - `https://storage.googleapis.com/sar-colombia-tiles/{area}/tiles/{folder}/{year}/{z}/{x}/{y}.png`
- Tile catalogs in `data/` provide quick existence checks for event areas:
  - `data/lista_rio_quito.txt`
  - `data/lista_san_jose.txt`

TMS vs. XYZ is auto‑handled for event strategies; missing tiles render as transparent.

---

## Tech Stack

- HTML5/CSS3, Vanilla JavaScript (ES6+)
- Leaflet.js 1.9.x for mapping
- Basemap: Esri World Imagery • Labels: OSM/CARTO
- No build tools, no framework, CDN delivered dependencies

---

## Project Structure

```
index.html          # UI markup (map, panels, timeline, modals)
app.js              # Map logic, tile strategies, timeline, events
styles.css          # Dark theme and layout styling
data/
  lista_rio_quito.txt
  lista_san_jose.txt
PROJECT_DOCUMENTATION.md  # Technical details (architecture, data, UI)
QUICK_DEBUG_GUIDE.md      # Debug tips and console snippets
SOLUCION_IMAGENES_INVISIBLES.md # (ES) Root cause analysis for invisible tiles
```

---

## Troubleshooting

- See `QUICK_DEBUG_GUIDE.md` for fast console checks (current layer/quarter, URL generation, network tests).
- If tiles fetch but don’t appear, try disabling blend/filters (see `SOLUCION_IMAGENES_INVISIBLES.md`).
- Check browser console for network errors, 404s, or CORS issues.

---

## Acknowledgements

- Created for NASA Space Apps Challenge.
- Basemap: © Esri; labels © OpenStreetMap contributors and © CARTO.
- SAR tiles hosted in Google Cloud Storage (`sar-colombia-tiles`).

