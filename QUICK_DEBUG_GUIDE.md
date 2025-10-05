# 🚨 Quick Debug Guide - SAR Colombia Viewer

## Fast Diagnosis Commands

### 1️⃣ Is Everything Loaded?
Open browser console (F12) and paste:
```javascript
// Check critical components
console.log({
  map: !!map,
  quarters: QUARTERS.length,
  layers: Object.keys(LAYERS),
  catalogRioQuito: __TileCatalog['rio_quito']?.size || 0,
  activeStrategy: window.__activeEventKey,
  currentQuarter: quarterSelect.value,
  currentLayer: layerSelect.value
});
```

### 2️⃣ Check Current Tile URL
```javascript
// See what URL is being generated
const k = layerSelect.value;
const q = quarterSelect.value;
const strat = window.TileURLStrategy || {};
console.log('Tile URL:', strat.buildUrl ? strat.buildUrl(k, q) : `${BASE}/${k}/${q}/{z}/{x}/{y}.png`);
```

### 3️⃣ Force Reload Everything
```javascript
// Nuclear option - reload current view
updateLayer();
```

### 4️⃣ Check Network Issues
```javascript
// Test if tiles are accessible
fetch('https://storage.googleapis.com/sar-colombia-tiles/tiles/suspect/2016-Q1/10/293/496.png')
  .then(r => console.log('Tile fetch:', r.ok ? '✅ OK' : '❌ FAIL', r.status))
  .catch(e => console.error('Network error:', e));
```

### 5️⃣ List All Active Layers
```javascript
// See what's actually on the map
const layers = [];
map.eachLayer(layer => {
  layers.push({
    type: layer.constructor.name,
    pane: layer.options?.pane,
    url: layer._url || 'N/A'
  });
});
console.table(layers);
```

---

## Common Problems → Quick Fixes

### ❌ PROBLEM: Blank tiles / No imagery
**Quick Check:**
1. Open DevTools → Network → Filter "PNG"
2. Look for red (404) requests
3. Check the URL pattern

**Quick Fix:**
```javascript
// If wrong TMS/XYZ:
window.TileURLStrategy.tms = !window.TileURLStrategy.tms;
updateLayer();
```

---

### ❌ PROBLEM: Timeline slider doesn't change imagery
**Quick Check:**
```javascript
// Are they synced?
console.log('Slider:', range.value, 'Select:', quarterSelect.value);
```

**Quick Fix:**
```javascript
// Re-attach listener
range.addEventListener('input', () => {
  const i = parseInt(range.value, 10);
  quarterSelect.value = QUARTERS[i];
  updateLayer();
});
```

---

### ❌ PROBLEM: Event doesn't load Río Quito tiles
**Quick Check:**
```javascript
// Is strategy set?
console.log('Active event:', window.__activeEventKey);
console.log('Catalog size:', __TileCatalog['rio_quito']?.size);
```

**Quick Fix:**
```javascript
// Manually trigger event
window.__setEventStrategy('rio_quito');
updateLayer();
```

---

### ❌ PROBLEM: Colombia boundary missing
**Quick Check:**
```javascript
// Check if layers exist
console.log({
  edge: !!paisEdge,
  glow: !!paisGlow,
  mask: !!paisMask
});
```

**Quick Fix:**
```javascript
// Reload boundaries
loadPaisDecorado().then(({edge, glow, mask}) => {
  if (mask) mask.addTo(map);
  if (glow) glow.addTo(map);
  if (edge) edge.addTo(map);
});
```

---

### ❌ PROBLEM: Static overlays invisible
**Quick Check:**
```javascript
// Are they on the map?
Object.entries(staticLayers).forEach(([key, layer]) => {
  console.log(key, ':', layer._map ? '✅ ON MAP' : '❌ NOT ON MAP');
});
```

**Quick Fix:**
```javascript
// Force add frequency layer
staticLayers.freq.addTo(map);
lpFreq.checked = true;
```

---

## Emergency Reset

If everything is broken:
```javascript
// 1. Clear and reload
location.reload();

// OR if that doesn't work, reset state:
// 2. Stop play timer
if (timer) clearInterval(timer);
playToggle.checked = false;

// 3. Remove all layers
map.eachLayer(layer => {
  if (layer._url) map.removeLayer(layer);
});

// 4. Reset to defaults
layerSelect.value = 'suspect';
quarterSelect.value = QUARTERS[0];
range.value = 0;
window.__setEventStrategy(null);

// 5. Reload layer
updateLayer();
```

---

## Debug Mode

Enable verbose logging:
```javascript
// Override updateLayer with logging
const originalUpdateLayer = updateLayer;
updateLayer = async function() {
  console.log('🔄 updateLayer called:', {
    layer: layerSelect.value,
    quarter: quarterSelect.value,
    event: window.__activeEventKey,
    opacity: lpOpacity.value
  });
  await originalUpdateLayer();
  console.log('✅ updateLayer complete');
};
```

---

## Performance Check

```javascript
// Memory usage (Chrome only)
console.log('Memory:', {
  used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
  total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
  limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
});

// Network requests
const resources = performance.getEntriesByType('resource');
console.log('Total requests:', resources.length);
console.log('PNG tiles:', resources.filter(r => r.name.endsWith('.png')).length);
```

---

## Test Tile Loading

```javascript
// Test a specific tile
function testTile(url) {
  const img = new Image();
  const start = Date.now();
  img.onload = () => console.log('✅ Loaded in', Date.now() - start, 'ms');
  img.onerror = () => console.log('❌ Failed to load');
  img.src = url;
  return img;
}

// Example
testTile('https://storage.googleapis.com/sar-colombia-tiles/rio_quito/tiles/suspect/2016/10/293/496.png');
```

---

## Inspect UI State

```javascript
// Check all UI elements
console.log('UI State:', {
  sidebar: sb.classList.contains('collapsed') ? 'collapsed' : 'open',
  layersPanel: layersPanel.classList.contains('open') ? 'open' : 'closed',
  chartsPanel: chartsPanel.classList.contains('open') ? 'open' : 'closed',
  helpModal: helpModal.classList.contains('open') ? 'open' : 'closed',
  activeTab: Array.from(sbTabs).find(t => t.classList.contains('sb-active'))?.dataset.tab,
  countryBorder: chkPais.checked,
  placeLabels: chkLabels.checked
});
```

---

## Export Current State

```javascript
// Save current configuration for reporting bugs
const state = {
  timestamp: new Date().toISOString(),
  layer: layerSelect.value,
  quarter: quarterSelect.value,
  opacity: lpOpacity.value,
  event: window.__activeEventKey,
  mapCenter: map.getCenter(),
  mapZoom: map.getZoom(),
  tms: window.TileURLStrategy?.tms,
  staticOverlays: {
    freq: lpFreq.checked,
    delta: lpDelta.checked,
    mainCh: lpMainCh.checked,
    mainBuf: lpMainBuf.checked
  }
};
console.log('Current State:', state);
copy(JSON.stringify(state, null, 2)); // Copies to clipboard in Chrome
```

---

## Browser Compatibility Check

```javascript
// Check if browser supports required features
console.log('Browser Check:', {
  fetch: typeof fetch !== 'undefined',
  Promise: typeof Promise !== 'undefined',
  Map: typeof Map !== 'undefined',
  Set: typeof Set !== 'undefined',
  ES6: (() => { try { eval('const x = () => 1'); return true; } catch(e) { return false; } })()
});
```

---

## Quick Reference

### File Locations
- **Main app**: `app.js` (~587 lines)
- **Tile catalogs**: `data/lista_rio_quito.txt`, `data/lista_san_jose.txt`
- **Styles**: `styles.css` (~358 lines)

### Key Functions
| Function | Line | Purpose |
|----------|------|---------|
| `updateLayer()` | ~244 | Main layer switching logic |
| `loadTileCatalog(area)` | ~95 | Loads tile list from .txt |
| `makeEventTileFromTxt()` | ~161 | Creates event-specific tile layer |
| `focusEvent(ev)` | ~450 | Zooms to event and switches mode |
| `prefetchEventTiles()` | ~215 | Background tile loading |

### Important Variables
```javascript
BUCKET = 'sar-colombia-tiles'
BASE = 'https://storage.googleapis.com/sar-colombia-tiles/tiles'
QUARTERS = ['2016-Q1', ..., '2023-Q4'] // 32 items
EXPORTED_MAX_ZOOM = 18
```

---

**Need more help?** Check `PROJECT_DOCUMENTATION.md` for full details.
