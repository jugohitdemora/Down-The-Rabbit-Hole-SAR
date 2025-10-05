# 🛰️ SAR Colombia Viewer

An interactive web-based geospatial visualization tool for exploring Synthetic Aperture Radar (SAR) satellite imagery of Colombia from 2016 to 2023.

![Project Type](https://img.shields.io/badge/Type-NASA%20Space%20App%20Challenge-blue)
![Tech](https://img.shields.io/badge/Tech-Leaflet.js%20%7C%20Vanilla%20JS-green)
![Status](https://img.shields.io/badge/Status-Active-success)

---

## 🌟 What Does This Do?

This application allows you to:
- 🗺️ **Visualize SAR satellite data** on an interactive map of Colombia
- ⏱️ **Track changes over time** with a timeline slider (2016-2023, quarterly)
- 💧 **Detect water bodies** and wetland changes using radar backscatter analysis
- 🔍 **Identify suspicious activities** like illegal mining pits and deforestation
- 📊 **Compare multiple layers** including wetness, pond density, and water frequency

---

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for loading tiles from Google Cloud Storage)

### Running the Application

**Option 1: Direct File Opening**
```bash
# Simply open index.html in your browser
open index.html  # macOS
start index.html # Windows
xdg-open index.html # Linux
```

**Option 2: Local Web Server** (recommended)
```bash
# Using Python 3
python3 -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000

# Then open: http://localhost:8000
```

**Option 3: VS Code Live Server**
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

---

## 📖 Documentation

- **📘 [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** - Complete technical documentation
  - Project architecture
  - Data flow diagrams
  - API reference
  - Code structure
  
- **🔧 [QUICK_DEBUG_GUIDE.md](QUICK_DEBUG_GUIDE.md)** - Debugging and troubleshooting
  - Common issues and fixes
  - Console commands for diagnosis
  - Performance optimization
  - Emergency reset procedures

---

## 🎮 How to Use

### Basic Navigation

1. **Select a Layer Type**
   - Click the **Layers** button (▦) in the top-right
   - Choose from: SAR RGB, Wetness, Out-of-channel water, or Pond density
   
2. **Navigate Through Time**
   - Use the **timeline slider** at the bottom
   - Click **Play** (▶) to auto-advance through quarters
   - Watch environmental changes unfold over 8 years

3. **Explore Events**
   - Open the **sidebar** (left panel)
   - Click on pre-configured events:
     - **Río Quito** (Chocó) - Mining activity monitoring
     - **Depresión Momposina** - Seasonal flooding patterns
     - **Sabana de Bogotá** - Urban wetland changes

4. **Add Context Layers**
   - Toggle **Static Overlays**: Water frequency, Post-pre change
   - Enable **References**: Country boundary, Place labels
   - Adjust **Opacity** to blend layers

---

## 🏗️ Project Architecture

```
┌─────────────────────────────────────────┐
│           User Interface (HTML)         │
│  - Sidebar (Events/Analysis/Settings)   │
│  - Floating Action Buttons              │
│  - Timeline Controls                    │
│  - Layers Panel                         │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      Application Logic (app.js)         │
│  - Map initialization (Leaflet.js)      │
│  - Tile loading & caching               │
│  - Event handling                       │
│  - Tile catalog management              │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         Data Layer                      │
│  - Google Cloud Storage tiles           │
│  - Tile catalogs (lista_*.txt)          │
│  - Static overlays                      │
│  - GeoJSON boundaries                   │
└─────────────────────────────────────────┘
```

---

## 📊 Data Layers Explained

### Dynamic Layers (Change Over Time)

| Layer | What It Shows | Use Case |
|-------|---------------|----------|
| **SAR RGB** | Composite of VV, VH polarizations | Understand radar texture and context |
| **Wetness** | Water-logged or inundated surfaces | Track flooding and wet areas |
| **Out-of-channel water** | Wet pixels outside natural rivers | Detect illegal mining pits |
| **Pond density** | Concentration of suspect pixels | Quantify mining activity intensity |

### Static Overlays (Reference)

| Layer | What It Shows | Time Period |
|-------|---------------|-------------|
| **2016-2023 frequency** | How often each pixel was wet | 8-year average |
| **Post-pre change** | Difference in wetness | 2021-2023 vs 2016-2018 |
| **Main channel** | Persistent rivers (JRC data) | Historical |
| **Channel buffer** | 150m zones around rivers | Buffer analysis |

---

## 🛠️ Technical Stack

### Frontend
- **HTML5** - Semantic structure
- **CSS3** - Dark theme with glassmorphism
- **Vanilla JavaScript (ES6+)** - No framework dependencies

### Libraries
- **[Leaflet.js](https://leafletjs.com/)** v1.9.4 - Interactive mapping
- **Esri World Imagery** - Satellite base layer
- **CARTO** - Place name labels

### Data Infrastructure
- **Google Cloud Storage** - Tile hosting (`sar-colombia-tiles` bucket)
- **Tile format**: PNG (256×256 pixels)
- **Coordinate systems**: TMS and XYZ (auto-detected)
- **Zoom levels**: 5-18 (max native: 14-18 depending on area)

---

## 📁 File Structure

```
NASA-SPACE-APP/
│
├── index.html                    # Main HTML (372 lines)
├── app.js                        # JavaScript logic (587 lines)
├── styles.css                    # CSS styling (358 lines)
│
├── data/
│   ├── lista_rio_quito.txt      # Río Quito tile catalog (~3K lines)
│   └── lista_san_jose.txt       # San José tile catalog (~46K lines)
│
├── README.md                     # This file
├── PROJECT_DOCUMENTATION.md      # Complete technical docs
└── QUICK_DEBUG_GUIDE.md         # Debugging reference
```

---

## 🌐 Geographic Coverage

### Primary Region
- **Country**: Colombia 🇨🇴
- **Bounding Box**: [-4.3°, -79.1°] to [13.6°, -66.8°]
- **Focus Areas**:
  - Chocó Department (Pacific coast)
  - Depresión Momposina (Caribbean lowlands)
  - Sabana de Bogotá (Andean highlands)

### Event-Specific Tiles
- **Río Quito** (Paimadó, Chocó): [5.492, -76.724]
- **San José del Guaviare**: Coverage in san_jose catalog

---

## 🔬 SAR Technology Explained

**SAR (Synthetic Aperture Radar)** is a microwave imaging system that:
- Works day and night (no sunlight needed)
- Penetrates clouds and smoke
- Detects water (appears dark due to low backscatter)
- Measures surface roughness

**Polarizations Used:**
- **VV**: Vertical transmit → Vertical receive (surface scattering)
- **VH**: Vertical transmit → Horizontal receive (volume scattering)

**Low VV/VH ratio** = Likely water or very wet surfaces

---

## 🐛 Troubleshooting

### Quick Fixes

**Problem: Tiles not loading**
```javascript
// Open browser console (F12) and run:
console.log(__TileCatalog);
console.log(window.__activeEventKey);
updateLayer(); // Force reload
```

**Problem: Play button not working**
- Check console for errors
- Ensure quarters are populated: `console.log(QUARTERS)`
- Verify interval: `console.log(timer)`

**Problem: Events not switching**
- Verify catalog loaded: `console.log(__TileCatalog['rio_quito'])`
- Manually trigger: `window.__setEventStrategy('rio_quito'); updateLayer();`

👉 **See [QUICK_DEBUG_GUIDE.md](QUICK_DEBUG_GUIDE.md) for detailed troubleshooting**

---

## 🎯 Known Limitations

- Río Quito event tiles only available for **2016-2020**
- San José event integration **pending** (catalog exists but not in UI)
- Charts panel is **placeholder** (not implemented)
- Analysis modal content is **generic placeholder**
- Mobile experience could be improved (works but not optimized)
- No offline mode (requires internet)

---

## 🚧 Future Roadmap

### Planned Features
- [ ] Time series charts (VV/VH backscatter over time)
- [ ] San José event integration
- [ ] Export functionality (PNG, GeoTIFF)
- [ ] Side-by-side comparison mode
- [ ] Custom area selection for analysis
- [ ] User annotations and markers
- [ ] Mobile app (React Native or PWA)

### Performance Improvements
- [ ] Service Worker for tile caching
- [ ] WebGL tile rendering
- [ ] Lazy loading for tile catalogs
- [ ] Compression for large catalogs

---

## 📜 Data Attribution

### Satellite Imagery
- **Base Map**: Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community
- **SAR Tiles**: Custom processed Sentinel-1 data

### Vector Data
- **Country Boundaries**: Natural Earth (public domain)
- **Admin Boundaries**: geoBoundaries (CC BY 4.0)
- **Place Labels**: © OpenStreetMap contributors, © CARTO

### Reference Layers
- **Water Occurrence**: JRC Global Surface Water (public domain)

---

## 💡 Use Cases

### Environmental Monitoring
- Track seasonal flooding patterns
- Monitor wetland health
- Detect drainage of natural water bodies

### Illegal Activity Detection
- Identify out-of-channel pits (illegal gold mining)
- Monitor deforestation in protected areas
- Detect unauthorized canal construction

### Research & Analysis
- Hydrological studies
- Land use change detection
- Climate impact assessment

### Government & NGOs
- Enforcement planning
- Conservation prioritization
- Damage assessment after natural disasters

---

## 🤝 Contributing

This project is part of the NASA Space Apps Challenge. For questions or contributions:

1. **Report Issues**: Document bugs with:
   - Browser version
   - Console errors
   - Steps to reproduce
   - Screenshots

2. **Suggest Features**: Describe:
   - Use case
   - Expected behavior
   - Priority/impact

3. **Submit Changes**: Include:
   - Clear description
   - Testing performed
   - Updated documentation

---

## 📞 Support

### Getting Help
1. Check [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for technical details
2. Use [QUICK_DEBUG_GUIDE.md](QUICK_DEBUG_GUIDE.md) for common issues
3. Open browser console (F12) and look for error messages
4. Check Network tab for failed tile requests

### Debug Console Commands
```javascript
// Check system status
console.log({ map: !!map, quarters: QUARTERS.length, layers: Object.keys(LAYERS) });

// Force reload current view
updateLayer();

// List all active map layers
map.eachLayer(layer => console.log(layer));
```

---

## 📊 Project Statistics

- **Total Code**: ~1,300 lines (HTML + JS + CSS)
- **Data Files**: ~50,000 tile catalog entries
- **Time Period**: 2016-2023 (8 years, 32 quarters)
- **Map Layers**: 4 dynamic + 4 static overlays
- **Geographic Events**: 3 pre-configured areas
- **Tile Zoom Range**: 5-18
- **Max Native Zoom**: 14-18 (varies by region)

---

## 🏆 Credits

**Developed for NASA Space Apps Challenge 2025**

**Technologies**: Leaflet.js, Esri ArcGIS, Google Cloud Storage, Sentinel-1 SAR

**Data Processing**: Google Earth Engine

**Design Inspiration**: Apple HIG, Material Design

---

## 📄 License

Check with project maintainer for licensing terms.

---

## 🔗 Quick Links

- 📘 [Full Documentation](PROJECT_DOCUMENTATION.md)
- 🔧 [Debug Guide](QUICK_DEBUG_GUIDE.md)
- 🗺️ [Leaflet.js Docs](https://leafletjs.com/)
- 🛰️ [Sentinel-1 Mission](https://sentinel.esa.int/web/sentinel/missions/sentinel-1)
- 🌍 [NASA Space Apps](https://www.spaceappschallenge.org/)

---

**Made with 🛰️ and ☕ for environmental monitoring**
