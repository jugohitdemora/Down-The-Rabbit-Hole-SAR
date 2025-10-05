# SAR Colombia Viewer - Project Documentation

## 🌍 Project Overview

**SAR Colombia Viewer** is an interactive web-based geospatial visualization tool that displays Synthetic Aperture Radar (SAR) satellite imagery for Colombia. The application enables users to explore temporal changes in water bodies, wetlands, and suspected deforestation or mining activities across different regions of Colombia from 2016 to 2023.

### Purpose
- Monitor environmental changes over time using SAR satellite data
- Identify out-of-channel water bodies (potential illegal mining pits/canals)
- Track wetness and waterlogging in different regions
- Analyze pond density and water frequency patterns

---

## 📁 Project Structure

```
NASA-SPACE-APP/
├── index.html              # Main HTML file with UI components
├── app.js                  # JavaScript application logic
├── styles.css              # CSS styling (dark theme)
└── data/
    ├── lista_rio_quito.txt    # Tile catalog for Río Quito area
    └── lista_san_jose.txt     # Tile catalog for San José area
```

---

## 🎯 Key Features

### 1. **Interactive Map Viewer**
- Built with Leaflet.js
- Base layer: Esri World Imagery
- Multiple Z-index panes for layer management
- Colombia-focused view with bounding box constraints

### 2. **Temporal Visualization**
- Timeline slider with quarterly data (2016-2023)
- Auto-play functionality
- 32 total quarters of data (Q1 2016 through Q4 2023)

### 3. **Multiple Layer Types**
The application supports 4 dynamic layer types:

| Layer Key | Display Name | Description |
|-----------|--------------|-------------|
| `s1rgb` | SAR RGB (VV,VH,VV) | SAR composite showing texture and moisture context |
| `wet` | Water / Wetness | Low VV/VH backscatter revealing waterlogged/inundated surfaces |
| `suspect` | Out-of-channel water | Frequent wet pixels outside persistent channels (possible illegal pits/canals) |
| `pond3m` | Pond density (250m) | Percentage of "suspect" pixels within 250m neighborhood |

### 4. **Static Overlay Layers**
- **2016–2023 frequency**: Percentage of time each pixel was wet
- **Post–pre change**: Difference in wetness between 2021–2023 vs 2016–2018
- **Main channel**: Persistent rivers/water (JRC Global Surface Water, ≥60% occurrence)
- **Channel buffer**: ~150m buffer around main channel

### 5. **Geographic Events**
Pre-configured geographic areas of interest:

| Event | Location | Coordinates | Purpose |
|-------|----------|-------------|---------|
| Río Quito | Paimadó, Chocó | [5.492, -76.724] | Annual series 2016–2023 from event bucket |
| Depresión Momposina/Mojana | Bolívar–Sucre | [8.50, -74.30] | Seasonal wetlands and flooding |
| Sabana de Bogotá | Cundinamarca | [[4.45,-74.35],[4.95,-73.95]] | Peri-urban wet areas |

### 6. **User Interface Components**
- **Sidebar (Left)**: Events, Analysis, and Settings tabs (collapsible)
- **Floating Action Buttons (Top-Right)**: Help, Layers, Charts
- **Timeline (Bottom)**: Quarter selector with play/pause controls
- **Panels**: Layers panel and Charts panel (floating)
- **Modals**: Help modal, Event details, Analysis information

---

## 🔧 Technical Implementation

### Data Storage
- **Primary Storage**: Google Cloud Storage bucket `sar-colombia-tiles`
- **Base URL**: `https://storage.googleapis.com/sar-colombia-tiles/tiles`
- **Tile Format**: PNG images (256×256 pixels)
- **Coordinate System**: Supports both TMS and XYZ tile schemes

### Tile Organization

#### Global Tiles
```
{BASE_URL}/{layerKey}/{quarter}/{z}/{x}/{y}.png
```
Example: `.../tiles/suspect/2016-Q1/10/293/496.png`

#### Event-Specific Tiles (Río Quito)
```
{BUCKET}/rio_quito/tiles/{folder}/{year}/{z}/{x}/{y}.png
```
Where `folder` maps:
- `s1rgb` → `sar_rgb`
- `wet` → `wet_pct`
- `pond3m` → `pond_pct`
- `suspect` → `suspect`

### Tile Catalogs
The `data/` directory contains text files listing available tiles:
- **lista_rio_quito.txt**: ~3,000 lines of Google Storage URLs for Río Quito tiles
- **lista_san_jose.txt**: ~46,000 lines of Google Storage URLs for San José tiles

Format examples:
```
gs://sar-colombia-tiles/rio_quito/tiles/pond_pct/2016/10/293/496.png
gs://sar-colombia-tiles/san_jose/tiles/def_year/2016/10/304/503.png
```

### Key JavaScript Components

#### 1. Map Initialization
```javascript
const map = L.map('map', { 
  zoomControl: false, 
  minZoom: 5, 
  maxZoom: 18 
});
```

#### 2. Z-Index Panes
- `basemap`: 200 (Esri imagery)
- `mask`: 350 (Country dimming)
- `dynamic`: 400 (SAR layers)
- `static`: 450 (Overlays)
- `borders`: 500 (Country boundaries)
- `labels`: 600 (Place names)

#### 3. Tile Loading Strategy
- **AvailableTilesOnly**: Custom Leaflet TileLayer that checks catalog before loading
- **Prefetching**: Asynchronously loads tiles in parallel (12 concurrent requests)
- **Error Handling**: Shows transparent PNG for missing tiles

#### 4. Year Normalization
For event-specific tiles, years are normalized to available data:
```javascript
normalizeYear(catalog, folder, year) {
  // Finds the most recent available year ≤ requested year
}
```

#### 5. TMS/XYZ Auto-Detection
```javascript
autoDetectScheme(def) {
  // Probes both TMS and XYZ tile URLs
  // Uses whichever responds first
}
```

### UI Event Handlers

| UI Element | Event | Action |
|------------|-------|--------|
| Timeline slider | `input` | Updates quarter and refreshes layer |
| Play toggle | `change` | Starts/stops 1-second interval auto-advance |
| Layer radios | `change` | Switches active SAR layer |
| Opacity slider | `input` | Adjusts active layer opacity |
| Event buttons | `click` | Zooms to event and switches tile strategy |
| Checkboxes | `change` | Toggles static overlays and reference layers |

---

## 🎨 Design & Styling

### Color Palette
```css
--bg: #0b0e12          /* Background dark */
--panel: #121621cc     /* Panel semi-transparent */
--text: #e8eef6        /* Primary text */
--muted: #9fb0c3       /* Muted text */
--accent: #00ffe5      /* Cyan accent */
--track: #243041       /* Slider track */
```

### Visual Effects
- **Glassmorphism**: Panels use `backdrop-filter: blur(6px)`
- **Squircle Buttons**: Apple-style rounded buttons (22px radius on 64px)
- **Shadows**: `0 8px 24px rgba(0,0,0,.35)` for depth
- **Mix Blend Mode**: SAR tiles use `screen` blend mode with adjusted brightness/contrast

### Responsive Breakpoints
```css
@media (max-width: 920px) {
  /* Sidebar, panels, and timeline adjust to 88-94vw */
}
```

---

## 🚀 How to Use

### Setup
1. **No build process required** - pure HTML/CSS/JavaScript
2. Open `index.html` in a modern web browser
3. Ensure internet connection for external resources:
   - Leaflet.js (v1.9.4) from CDN
   - Tile imagery from Google Cloud Storage
   - Colombia GeoJSON boundaries

### Navigation
1. **Select Layer**: Click Layers button (▦), choose a layer type
2. **Choose Time Period**: Use timeline slider or play button
3. **View Events**: Open sidebar (left panel), select an event
4. **Toggle Overlays**: Enable frequency, change, or channel layers
5. **Adjust Opacity**: Use slider in Layers panel

### Keyboard Shortcuts
- **Escape**: Closes modals and collapses sidebar

---

## 🐛 Debugging Guide

### Common Issues

#### 1. **Tiles Not Loading**
**Symptoms**: Blank or transparent tiles on map

**Check**:
```javascript
// Open browser console (F12)
// Look for 404 errors or tile URL patterns

// Verify catalog loaded:
console.log(__TileCatalog);

// Check active strategy:
console.log(window.TileURLStrategy);
console.log(window.__activeEventKey);
```

**Possible Causes**:
- Network connectivity issues
- Google Cloud Storage bucket permissions
- Incorrect tile catalog format
- TMS vs XYZ coordinate mismatch

**Fix**:
- Check browser Network tab for failed requests
- Verify tile URLs match catalog entries
- Ensure `tms: true/false` is correctly set

#### 2. **Quarter Selector Not Updating Layer**
**Symptoms**: Timeline moves but tiles don't change

**Check**:
```javascript
// Verify quarter select is synced:
console.log(quarterSelect.value);
console.log(QUARTERS[range.value]);

// Check if updateLayer is being called:
console.log('updateLayer called');
```

**Fix**:
- Ensure event listeners are attached
- Check for JavaScript errors in console
- Verify quarter format (e.g., "2016-Q1")

#### 3. **Event Not Switching Tile Strategy**
**Symptoms**: Clicking event doesn't load event-specific tiles

**Check**:
```javascript
// After clicking event:
console.log(window.__activeEventKey); // Should be 'rio_quito' or null
console.log(window.TileURLStrategy.buildUrl);

// Check if catalog exists:
console.log(__TileCatalog['rio_quito']);
```

**Fix**:
- Verify `data/lista_rio_quito.txt` loaded successfully
- Check regex patterns in `loadTileCatalog()` function
- Ensure `focusEvent()` calls `window.__setEventStrategy()`

#### 4. **Layers Panel Not Opening**
**Symptoms**: Clicking Layers button does nothing

**Check**:
```javascript
// Verify element exists:
console.log(document.getElementById('layersPanel'));

// Check event listener:
btnLayers.addEventListener('click', () => {
  console.log('Layers button clicked');
});
```

**Fix**:
- Check for duplicate IDs in HTML
- Verify `closeAllPanels()` isn't preventing open
- Look for CSS `display:none` overrides

#### 5. **Static Overlays Not Showing**
**Symptoms**: Checkboxes toggle but no overlay appears

**Check**:
```javascript
// Verify static layer URLs:
console.log(STATIC);

// Check if layer is added to map:
console.log(staticLayers.freq._map); // Should not be null when active
```

**Fix**:
- Verify static tile URLs are accessible
- Check Z-index of `static` pane (should be 450)
- Ensure opacity is not 0

#### 6. **Colombia Boundary Not Loading**
**Symptoms**: Country outline doesn't appear

**Check**:
```javascript
// Check if GeoJSON loaded:
loadPaisDecorado().then(({edge, glow, mask}) => {
  console.log(edge, glow, mask);
});

// Verify fetch succeeded:
fetch(URL_COUNTRIES)
  .then(r => r.json())
  .then(d => console.log(d));
```

**Fix**:
- Check GitHub raw content URL is accessible
- Verify GeoJSON format is valid
- Look for CORS issues

### Debugging Tools

#### Console Commands
```javascript
// List all layers on map
map.eachLayer(layer => console.log(layer));

// Get current map state
console.log({
  center: map.getCenter(),
  zoom: map.getZoom(),
  bounds: map.getBounds()
});

// Force reload current layer
updateLayer();

// Check prefetch status
console.log('Prefetch cache size:', performance.getEntriesByType('resource').length);

// Test tile URL generation
console.log(makeEventTileFromTxt({
  area: 'rio_quito',
  layerKey: 'suspect',
  quarter: '2016-Q1',
  opacity: 0.9
}));
```

#### Network Debugging
1. Open Chrome DevTools → Network tab
2. Filter by `PNG`
3. Look for:
   - Status codes (200 = success, 404 = not found)
   - Response times
   - Tile URL patterns

#### Performance Debugging
```javascript
// Monitor tile load performance
const startTime = Date.now();
prefetchEventTiles({...}).then(() => {
  console.log(`Loaded in ${Date.now() - startTime}ms`);
});

// Check memory usage
console.log(performance.memory); // Chrome only
```

### Error Messages Reference

| Error | Meaning | Solution |
|-------|---------|----------|
| `[catalog] No pude cargar ./data/lista_X.txt` | Tile catalog file missing | Check file path and web server |
| `AutoDetect TMS/XYZ error` | Tile probe failed | Check network, verify tile exists |
| `[prefetch] ... → 0 tiles` | Empty tile catalog | Verify catalog format and filtering |

---

## 📊 Data Flow

```
User Action (select layer/quarter)
    ↓
updateLayer() called
    ↓
Check if event-specific (rio_quito?)
    ↓
[YES] → loadTileCatalog() → makeEventTileFromTxt() → AvailableTilesOnly
    ↓
[NO]  → makeTile() → Standard L.tileLayer
    ↓
Add to map (pane: 'dynamic')
    ↓
Optional: prefetchEventTiles() (background)
    ↓
Update layer description
```

---

## 🔗 External Dependencies

### CDN Resources
- **Leaflet.js**: v1.9.4 (mapping library)
- **Esri World Imagery**: Base satellite imagery
- **CARTO Labels**: Place name overlays
- **Natural Earth / geoBoundaries**: Country boundaries

### Data Sources
- **SAR Imagery**: Google Cloud Storage bucket
- **Colombia GeoJSON**: GitHub datasets repository
- **JRC Global Surface Water**: Main channel layer

---

## 📝 Code Architecture

### Initialization Sequence
```javascript
1. Document loads
2. init() function executes:
   a. populateQuarters() - builds 2016-2023 quarter list
   b. buildLayerRadios() - creates layer selection UI
   c. Sets default values (suspect layer, Q1 2016, opacity 0.9)
   d. Loads Colombia boundaries
   e. Adds label layer
   f. Calls updateLayer() for initial render
3. Event listeners attached to UI elements
4. TileURLStrategy initialized to global mode
```

### State Management
Global state variables:
```javascript
activeLayer      // Current SAR tile layer on map
baseSAR          // Background SAR RGB layer (when not primary)
sbFocusLayer     // Visual highlight for selected event
paisEdge         // Colombia border edge
paisGlow         // Colombia border glow
paisMask         // Dimming mask outside Colombia
labelsLayer      // Place name overlay
staticLayers     // Object with freq, dwet, mainch, mainbuf
timer            // Interval ID for auto-play
```

Window-level state:
```javascript
window.__activeEventKey        // 'rio_quito' or null
window.TileURLStrategy         // {buildUrl, tms, minZoom, maxNativeZoom}
window.TileURLStrategy.tms     // boolean for tile coordinate system
```

---

## 🛠️ Future Enhancements

### Planned Features
- [ ] Charts panel implementation (time series graphs)
- [ ] Additional geographic events (San José area)
- [ ] Export functionality (screenshot, data download)
- [ ] Side-by-side comparison mode
- [ ] Mobile-optimized UI
- [ ] User annotations/markers
- [ ] Search functionality for places

### Known Limitations
- Timeline limited to 2016-2023
- Río Quito data only available for 2016-2020
- Some static overlays may not cover all regions
- Prefetch can be memory-intensive on low-end devices
- No offline mode

---

## 📄 License & Attribution

### Map Data
- **Base imagery**: Esri, Maxar, Earthstar Geographics (attribution required)
- **Boundaries**: Natural Earth (public domain), geoBoundaries (CC BY 4.0)
- **Labels**: © OpenStreetMap contributors, © CARTO
- **SAR tiles**: Custom processed data in GCS bucket

### Code
Check with project maintainer for license terms.

---

## 👥 For Developers

### Making Changes

#### Add New Layer Type
1. Update `LAYERS` object in `app.js`:
```javascript
const LAYERS = {
  newlayer: { 
    name: 'Display Name', 
    desc: 'Description of what this shows' 
  },
  // ... existing layers
};
```

2. Ensure tiles exist at:
```
{BASE}/newlayer/{quarter}/{z}/{x}/{y}.png
```

3. Update HTML `<select>` options if needed

#### Add New Event
1. Add to `SB_EVENTS` array:
```javascript
{ 
  id: 'unique_id',
  title: 'Event Name',
  sub: 'Location description',
  center: [lat, lon],
  zoom: 12,
  eventKey: 'event_key_for_tiles', // optional
  body: 'Detailed description HTML'
}
```

2. If event-specific tiles, add catalog file:
   - `data/lista_{event_key}.txt`
   - Update `EVENT_DEFS` in app.js if needed

#### Modify Styling
- Colors: Edit `:root` CSS variables in `styles.css`
- Layout: Adjust flex/grid in component classes
- Z-index: Modify pane creation in `app.js`

### Testing Checklist
- [ ] All layers load correctly
- [ ] Timeline advances through all quarters
- [ ] Play/pause works
- [ ] Events zoom and switch correctly
- [ ] Static overlays toggle
- [ ] Panels open/close
- [ ] Mobile responsive (< 920px width)
- [ ] Console shows no errors
- [ ] Network requests succeed (check DevTools)

---

## 📞 Support

### Logs Location
- **Browser Console**: F12 (Developer Tools)
- Look for:
  - `[catalog]` messages - tile catalog loading
  - `[prefetch]` messages - background tile loading
  - `[Evento]` messages - TMS/XYZ probe URLs

### Reporting Issues
Include:
1. Browser version
2. Console errors (screenshots)
3. Network tab showing failed requests
4. Steps to reproduce
5. Expected vs actual behavior

---

## 🎓 Glossary

| Term | Definition |
|------|------------|
| **SAR** | Synthetic Aperture Radar - microwave satellite imaging technique |
| **VV/VH** | Polarization modes of SAR (Vertical-Vertical, Vertical-Horizontal) |
| **TMS** | Tile Map Service - tile coordinate system (Y origin at bottom) |
| **XYZ** | Slippy map tiles - coordinate system (Y origin at top) |
| **Quarter** | 3-month period (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec) |
| **Backscatter** | Signal reflected back to SAR sensor (low = water/wet) |
| **Squircle** | Square with continuous corner curves (Apple design) |
| **Glassmorphism** | UI design with transparency and blur effects |
| **Z-index** | Stacking order of map layers |

---

**Last Updated**: October 2025  
**Project Type**: NASA Space App Challenge Entry  
**Technology Stack**: HTML5, CSS3, JavaScript (ES6+), Leaflet.js  
**Deployment**: Static web hosting (no server-side processing required)
