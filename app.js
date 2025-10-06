// ========= CONFIG =========
const BUCKET = 'sar-colombia-tiles';
const BASE   = `https://storage.googleapis.com/${BUCKET}/tiles`;
const EXPORTED_MAX_ZOOM = 18;

const LAYERS = {
  s1rgb: {
    name: 'SAR RGB (VV, VH, VV)',
    desc: 'Shows surface texture and moisture. Bright = rough/urban; dark = smooth/wet areas. (Tech: Sentinel-1 backscatter composite; VV→R,B and VH→G; σ⁰ GRD, RTC where available.)'
  },
  wet: {
    name: 'Water / Wetness',
    desc: 'Highlights waterlogged or inundated surfaces. (Tech: low VV/VH backscatter thresholding by quarter; not a strict “open water” mask; sensitive to roughness/incidence angle.)'
  },
  suspect: {
    name: 'Out-of-channel water',
    desc: 'Flags wet-looking areas outside the persistent river. Useful for overflow, canals or ponds. (Tech: pixels frequently wet beyond the main channel/buffer mask.)'
  },
  pond3m: {
    name: 'Pond density (250 m)',
    desc: 'Where small ponds cluster. (Tech: % of “suspect” pixels within a 250 m neighborhood, aggregated over time.)'
  }
};

const STATIC = {
  freq:   `${BASE}/static/freq/freq/{z}/{x}/{y}.png`,
  dwet:   `${BASE}/static/dwet/dwet/{z}/{x}/{y}.png`,
  mainch: `${BASE}/static/mainch/mainch/{z}/{x}/{y}.png`,
  mainbuf:`${BASE}/static/mainbuf/mainbuf/{z}/{x}/{y}.png`
};

// ========= MAP =========
const map = L.map('map', { zoomControl:false, minZoom:5, maxZoom:EXPORTED_MAX_ZOOM });
L.control.zoom({position:'bottomleft'}).addTo(map);

map.createPane('basemap');  map.getPane('basemap').style.zIndex = 200;
map.createPane('mask');     map.getPane('mask').style.zIndex    = 350;
map.createPane('dynamic');  map.getPane('dynamic').style.zIndex = 400;
map.createPane('static');   map.getPane('static').style.zIndex  = 450;
map.createPane('borders');  map.getPane('borders').style.zIndex = 500;
map.createPane('labels');   map.getPane('labels').style.zIndex  = 600;

console.log('🗺️ Map panes configured:');
console.log('  basemap z-index:', map.getPane('basemap').style.zIndex);
console.log('  mask z-index:', map.getPane('mask').style.zIndex);
console.log('  dynamic z-index:', map.getPane('dynamic').style.zIndex);
console.log('  static z-index:', map.getPane('static').style.zIndex);
console.log('  borders z-index:', map.getPane('borders').style.zIndex);
console.log('  labels z-index:', map.getPane('labels').style.zIndex);

L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, & others.', pane:'basemap' }
).addTo(map);

// Labels overlay
const labelsLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
  { subdomains:'abcd', pane:'labels', opacity:0.9, attribution:'© OpenStreetMap contributors, © CARTO' }
);

const COLOMBIA_BBOX = [[-4.3,-79.1],[13.6,-66.8]];
map.fitBounds(COLOMBIA_BBOX);
map.setMaxBounds([[COLOMBIA_BBOX[0][0]-2, COLOMBIA_BBOX[0][1]-2],[COLOMBIA_BBOX[1][0]+2, COLOMBIA_BBOX[1][1]+2]]);

// ========= UI HOOKS =========
const btnHelp   = document.getElementById('btnHelp');
const btnLayers = document.getElementById('btnLayers');
const btnCharts = document.getElementById('btnCharts');

const layersPanel = document.getElementById('layersPanel');
const chartsPanel = document.getElementById('chartsPanel');
const helpModal   = document.getElementById('helpModal');
const backdrop    = document.getElementById('backdrop');

const layerSelect   = document.getElementById('layerSelect'); // hidden
const quarterSelect = document.getElementById('quarterSelect');
const playToggle    = document.getElementById('playToggle');
const range         = document.getElementById('timelineRange');
const tickLabels    = document.getElementById('tickLabels');
const infoBtn       = document.getElementById('infoBtn');

const layerRadios = document.getElementById('layerRadios');
const lpOpacity   = document.getElementById('lpOpacity');
const lpFreq      = document.getElementById('lpFreq');
const lpDelta     = document.getElementById('lpDelta');
const lpMainCh    = document.getElementById('lpMainCh');
const lpMainBuf   = document.getElementById('lpMainBuf');
const layerDesc   = document.getElementById('layerDesc');
const staticInfoBtn = document.getElementById('staticInfoBtn');
const staticInfoBox = document.getElementById('staticInfoBox');
const cbModeToggle = document.getElementById('cbModeToggle');

// References
const chkPais   = document.getElementById('chkPais');
const chkLabels = document.getElementById('chkLabels');
const btnCol    = document.getElementById('btnColombia');

// ========= QUARTERS =========
function buildQuarters(y0,y1){ const qs=['Q1','Q2','Q3','Q4'], out=[]; for(let y=y0;y<=y1;y++) for(let i=0;i<4;i++) out.push(`${y}-${qs[i]}`); return out; }
const QUARTERS = buildQuarters(2016, 2023);

function populateQuarters(){
  quarterSelect.innerHTML = '';
  QUARTERS.forEach(q => { const opt=document.createElement('option'); opt.value=q; opt.textContent=q; quarterSelect.appendChild(opt); });
  range.min=0; range.max=QUARTERS.length-1; range.value=0;
  tickLabels.innerHTML=''; QUARTERS.forEach(q=>{ if(q.endsWith('Q1')){ const s=document.createElement('span'); s.textContent=q.split('-')[0]; tickLabels.appendChild(s);} });
}

// ========= TILES: helpers (TXT catalog for events) =========
const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const BLANK_PNG = transparentPng;

const __TileCatalog = Object.create(null);

async function loadTileCatalog(area){
  if (__TileCatalog[area]) return __TileCatalog[area];
  const url = `./data/lista_${area}.txt`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.warn(`[catalog] Could not load ${url} (status ${resp.status})`);
    __TileCatalog[area] = new Map();
    return __TileCatalog[area];
  }
  const txt = await resp.text();

  // Accepts lines as gs://..., https://storage.googleapis.com/... and relative prefix
  const reList = [
    new RegExp(`^gs://sar-colombia-tiles/${area}/tiles/(pond_pct|wet_pct|sar_rgb|suspect)/(\\d{4})/(\\d+)/(\\d+)/(\\d+)\\.png$`),
    new RegExp(`^https?://storage\\.googleapis\\.com/sar-colombia-tiles/${area}/tiles/(pond_pct|wet_pct|sar_rgb|suspect)/(\\d{4})/(\\d+)/(\\d+)/(\\d+)\\.png$`),
    new RegExp(`^${area}/tiles/(pond_pct|wet_pct|sar_rgb|suspect)/(\\d{4})/(\\d+)/(\\d+)/(\\d+)\\.png$`)
  ];

  const catalog = new Map();
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m=null;
    for (const re of reList) { m = re.exec(line); if (m) break; }
    if (!m) continue;
    const [, folder, year, z, x, y] = m;
    const key = `${folder}-${year}`;
    if (!catalog.has(key)) catalog.set(key, new Set());
    catalog.get(key).add(`${z}/${x}/${y}`); // z/x/y as stored (TMS-style)
  }

  console.log(`[catalog] ${area}: groups=${catalog.size}`, [...catalog.keys()].slice(0,6));
  __TileCatalog[area] = catalog;
  return catalog;
}

function yearsFromCatalog(catalog, folder){
  return [...new Set(
    [...catalog.keys()].filter(k=>k.startsWith(folder+'-')).map(k=>+k.split('-')[1])
  )].sort((a,b)=>a-b);
}
function normalizeYear(catalog, folder, year){
  const yrs = yearsFromCatalog(catalog, folder);
  if (yrs.length===0) return year;
  for (let i=yrs.length-1;i>=0;i--) if (yrs[i] <= year) return yrs[i];
  return yrs[0];
}

const EVENT_LAYER_MAP = { s1rgb:'sar_rgb', wet:'wet_pct', pond3m:'pond_pct', suspect:'suspect' };

const AvailableTilesOnly = L.TileLayer.extend({
  initialize: function(urlTemplate, options={}){
    L.TileLayer.prototype.initialize.call(this, urlTemplate, options);
    this._allow = options.allow || null;
    this._blank = options.errorTileUrl || BLANK_PNG;
  },
  getTileUrl: function(coords){
    if (!this._allow) return L.TileLayer.prototype.getTileUrl.call(this, coords);
    const y = this.options.tms ? (Math.pow(2, coords.z) - 1 - coords.y) : coords.y;
    const key = `${coords.z}/${coords.x}/${y}`;
    return this._allow.has(key)
      ? L.TileLayer.prototype.getTileUrl.call(this, coords)
      : this._blank;
  }
});

async function makeEventTileFromTxt({ area, layerKey, quarter, opacity }){
  const catalog = await loadTileCatalog(area);
  const folder  = EVENT_LAYER_MAP[layerKey] || layerKey;
  const reqYear = +String(quarter).slice(0,4);
  const year    = normalizeYear(catalog, folder, reqYear);
  const allow   = catalog.get(`${folder}-${year}`) || null;

  const urlTemplate = `https://storage.googleapis.com/${BUCKET}/${area}/tiles/${folder}/${year}/{z}/{x}/{y}.png`;

  const strat     = window.TileURLStrategy || {};
  const isTms     = typeof strat.tms === 'boolean' ? strat.tms : true;
  const minZoom   = strat.minZoom ?? 10;
  const maxNative = strat.maxNativeZoom ?? 14;

  const tl = new AvailableTilesOnly(urlTemplate, {
    pane:'dynamic',
    opacity: opacity ?? 0.85,
    minZoom: minZoom,
    maxZoom: EXPORTED_MAX_ZOOM,
    maxNativeZoom: maxNative,
    tms: isTms,
    tileSize: 256,
    noWrap: true,
    errorTileUrl: BLANK_PNG,
    allow,
    className: 'sar-dyn-tiles'
  });

  // Debug logs
  tl.on('tileloadstart', (e) => {
    console.log('🔽 Tile load started:', e.coords, 'URL:', e.tile.src);
  });
  tl.on('tileload', (e) => {
    console.log('✅ Tile loaded successfully:', e.coords);
  });
  tl.on('tileerror', (e) => {
    console.warn('❌ Tile load error:', e.coords, 'URL:', e.tile.src);
  });

  tl.__eventMeta = { area, folder, year, allowSet: allow, tms: isTms };
  return tl;
}

/* ===== Prefetch of available tiles (from .txt) ===== */
function __imgLoad(url){
  return new Promise((res)=>{ 
    const im = new Image();
    im.onload  = ()=>res({ok:true,url});
    im.onerror = ()=>res({ok:false,url});
    im.src = url;
  });
}

async function __prefetchUrls(urls, concurrency=12){
  let i = 0;
  const workers = Array.from({length: Math.min(concurrency, urls.length)}, async ()=>{
    while (i < urls.length){
      const url = urls[i++];
      await __imgLoad(url);
    }
  });
  await Promise.all(workers);
}
async function prefetchEventTiles({ area, folder, year, allowSet, minZ=10, maxZ=14, cap=null, concurrency=12 }){
  if (!allowSet || !allowSet.size) return;
  const base = `https://storage.googleapis.com/${BUCKET}/${area}/tiles/${folder}/${year}`;

  let keys = [...allowSet]
    .map(k => k.split('/').map(n=>+n))
    .filter(([z]) => z >= minZ && z <= maxZ)
    .sort((a,b)=> a[0]-b[0]);

  if (cap && keys.length > cap) keys = keys.slice(0, cap);

  const urls = keys.map(([z,x,y]) => `${base}/${z}/${x}/${y}.png`);
  console.log(`[prefetch] ${area}/${folder}/${year} → ${urls.length} tiles (z ${minZ}–${maxZ})`);
  await __prefetchUrls(urls, concurrency);
}

// ========= SAR TILES (global quarterly mode) =========
function makeTile(layerKey, quarter, opacity){
  const url = `${BASE}/${layerKey}/${quarter}/{z}/{x}/{y}.png`;
  console.log('🔨 makeTile() creating layer:', { layerKey, quarter, opacity, url });
  const layer = L.tileLayer(url, {
    pane:'dynamic',
    opacity: opacity,
    minZoom:5, maxZoom:EXPORTED_MAX_ZOOM, maxNativeZoom:EXPORTED_MAX_ZOOM,
    noWrap:true, tileSize:256, tms:false, errorTileUrl:transparentPng, className: 'sar-dyn-tiles'
  });
  
  // Debug logs
  layer.on('tileloadstart', (e) => {
    console.log('🔽 Tile load started:', e.coords, 'URL:', e.tile.src);
  });
  layer.on('tileload', (e) => {
    console.log('✅ Tile loaded successfully:', e.coords, 'style:', window.getComputedStyle(e.tile));
  });
  layer.on('tileerror', (e) => {
    console.warn('❌ Tile load error:', e.coords, 'URL:', e.tile.src);
  });
  
  console.log('✅ makeTile() layer created with pane:', layer.options.pane);
  return layer;
}
let activeLayer=null, baseSAR=null;

// updateLayer: uses TXT catalog when active event is Río Quito
async function updateLayer(){
  const k  = layerSelect.value;
  const q  = quarterSelect.value;
  const op = parseFloat(lpOpacity.value);

  console.log('🔄 updateLayer() called:', { layerKey: k, quarter: q, opacity: op, eventKey: window.__activeEventKey });

  if (activeLayer) {
    console.log('🗑️ Removing old activeLayer');
    map.removeLayer(activeLayer);
  }
  if (baseSAR) {
    console.log('🗑️ Removing old baseSAR');
    map.removeLayer(baseSAR);
  }
  baseSAR = null;

  if (window.__activeEventKey === 'rio_quito') {
    console.log('📍 Using Río Quito event tiles');
    if (k !== 's1rgb') {
      baseSAR = await makeEventTileFromTxt({ area:'rio_quito', layerKey:'s1rgb', quarter:q, opacity:0.6 });
      console.log('✅ baseSAR created:', baseSAR);
      baseSAR.addTo(map);
      console.log('✅ baseSAR added to map');
      if (baseSAR.__eventMeta) prefetchEventTiles({ ...baseSAR.__eventMeta, concurrency: 10 });
    }
    activeLayer = await makeEventTileFromTxt({ area:'rio_quito', layerKey:k, quarter:q, opacity:op });
    console.log('✅ activeLayer created:', activeLayer);
    activeLayer.addTo(map);
    console.log('✅ activeLayer added to map, pane:', activeLayer.options.pane, 'opacity:', activeLayer.options.opacity);

    if (activeLayer.__eventMeta) {
      prefetchEventTiles({ ...activeLayer.__eventMeta, minZ:10, maxZ:14, concurrency: 12 });
    }
  } else {
    console.log('🌍 Using global tiles');
    if (k !== 's1rgb') {
      baseSAR = makeTile('s1rgb', q, 0.6);
      console.log('✅ baseSAR created:', baseSAR);
      baseSAR.addTo(map);
      console.log('✅ baseSAR added to map');
    }
    activeLayer = makeTile(k, q, op);
    console.log('✅ activeLayer created:', activeLayer);
    activeLayer.addTo(map);
    console.log('✅ activeLayer added to map, pane:', activeLayer.options.pane, 'opacity:', activeLayer.options.opacity);
  }

  console.log('📊 Active layers in map:');
  map.eachLayer((layer) => {
    if (layer.options && layer.options.pane) {
      console.log('  - Layer in pane:', layer.options.pane, 'opacity:', layer.options.opacity, 'className:', layer.options.className);
    }
  });

  layerDesc.innerHTML = `<strong>${LAYERS[k].name}</strong> — ${LAYERS[k].desc}`;
}

// ========= STATIC OVERLAYS (event-aware via TXT; versioned, no year) =========
const STATIC_EVENT_MAP = {
  // UI key  -> event folder
  freq:   'freq_2016_2023',
  dwet:   'dwet',
  mainch: 'main_channel',
  mainbuf:'channel_buffer',
};

const __StaticCatalog = Object.create(null);

async function loadStaticCatalog(area){
  if (__StaticCatalog[area]) return __StaticCatalog[area];
  const url = `./data/lista_${area}.txt`;
  const resp = await fetch(url);
  if (!resp.ok){
    console.warn(`[static-catalog] Could not load ${url} (status ${resp.status})`);
    __StaticCatalog[area] = new Map();
    return __StaticCatalog[area];
  }
  const txt = await resp.text();

  // Accept gs://, https://storage.googleapis.com/, or relative paths
  const reList = [
    new RegExp(`^gs://sar-colombia-tiles/${area}/tiles/static/(channel_buffer|dwet|freq_2016_2023|main_channel)/v(\\d+)/(\\d+)/(\\d+)/(\\d+)\\.png$`),
    new RegExp(`^https?://storage\\.googleapis\\.com/sar-colombia-tiles/${area}/tiles/static/(channel_buffer|dwet|freq_2016_2023|main_channel)/v(\\d+)/(\\d+)/(\\d+)/(\\d+)\\.png$`),
    new RegExp(`^${area}/tiles/static/(channel_buffer|dwet|freq_2016_2023|main_channel)/v(\\d+)/(\\d+)/(\\d+)/(\\d+)\\.png$`)
  ];

  // Map: "<folder>@vN" -> Set("z/x/y")
  const catalog = new Map();
  for (const raw of txt.split(/\r?\n/)){
    const line = raw.trim();
    if (!line || !line.endsWith('.png')) continue; // ignore html etc.
    let m=null;
    for (const re of reList){ m = re.exec(line); if (m) break; }
    if (!m) continue;
    const [, folder, ver, z, x, y] = m;
    const key = `${folder}@v${ver}`;
    if (!catalog.has(key)) catalog.set(key, new Set());
    catalog.get(key).add(`${z}/${x}/${y}`);
  }

  __StaticCatalog[area] = catalog;
  console.log(`[static-catalog] ${area}: groups=${catalog.size}`, [...catalog.keys()]);
  return catalog;
}

function pickLatestVersion(catalog, folder){
  const vers = [...catalog.keys()]
    .filter(k => k.startsWith(folder+'@v'))
    .map(k => ({ k, v: +k.split('@v')[1] }))
    .sort((a,b)=> b.v - a.v);
  return vers[0] || null; // {k:'folder@vN', v:N}
}

async function makeEventStaticTileFromTxt({ area, key, opacity }){
  const folder = STATIC_EVENT_MAP[key];
  if (!folder) return null;

  const catalog = await loadStaticCatalog(area);
  const latest  = pickLatestVersion(catalog, folder);
  if (!latest){ console.warn(`[static] No tiles for ${folder} in ${area}`); return null; }

  const allow = catalog.get(latest.k);
  // derive z-range from catalog
  let minZ = 99, maxZ = 0;
  allow.forEach(s => { const z = +s.split('/')[0]; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; });

  const strat = window.TileURLStrategy || {};
  const tms   = typeof strat.tms === 'boolean' ? strat.tms : true;

  const urlTemplate =
    `https://storage.googleapis.com/${BUCKET}/${area}/tiles/static/${folder}/${latest.k.split('@')[1]}/{z}/{x}/{y}.png`;

  return new AvailableTilesOnly(urlTemplate, {
    pane: 'static',
    opacity,
    noWrap: true,
    tileSize: 256,
    tms,
    minZoom: Math.max(0, minZ),
    maxZoom: EXPORTED_MAX_ZOOM,
    maxNativeZoom: Math.max(minZ, maxZ),
    errorTileUrl: transparentPng,
    allow
  });
}

// Keep instances here; rebuild when context (global vs event) changes
let staticLayers = Object.create(null);

// Helper to (re)create one static overlay according to context
async function toggleStaticKey(key, checked){
  // remove current instance if any
  if (staticLayers[key] && map.hasLayer(staticLayers[key])) {
    map.removeLayer(staticLayers[key]);
  }
  if (!checked) return; // nothing to add

  const opacity = (key === 'mainch' || key === 'mainbuf') ? 0.90 : 0.85;

  let lyr = null;
  if (window.__activeEventKey === 'rio_quito'){
    lyr = await makeEventStaticTileFromTxt({ area:'rio_quito', key, opacity });
  } else {
    // global fallback (original STATIC URLs)
    lyr = L.tileLayer(STATIC[key], {
      pane:'static', opacity, noWrap:true, tileSize:256, tms:false, errorTileUrl: transparentPng
    });
  }

  if (lyr){ staticLayers[key] = lyr; lyr.addTo(map); }
}

// Re-apply all toggles for the current context
async function rebuildStaticForContext(){
  await toggleStaticKey('freq',   lpFreq.checked);
  await toggleStaticKey('dwet',   lpDelta.checked);
  await toggleStaticKey('mainch', lpMainCh.checked);
  await toggleStaticKey('mainbuf',lpMainBuf.checked);
}

// Toggle handlers (async-aware)
lpFreq   .addEventListener('change', e => toggleStaticKey('freq',   e.target.checked));
lpDelta  .addEventListener('change', e => toggleStaticKey('dwet',   e.target.checked));
lpMainCh .addEventListener('change', e => toggleStaticKey('mainch', e.target.checked));
lpMainBuf.addEventListener('change', e => toggleStaticKey('mainbuf',e.target.checked));

// Info
staticInfoBtn.addEventListener('click', ()=>{ staticInfoBox.hidden = !staticInfoBox.hidden; });

// ========= BORDERS + MASK =========
const URL_COUNTRIES = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
let paisEdge=null, paisGlow=null, paisMask=null;

async function loadPaisDecorado(){
  if (paisEdge && paisGlow && paisMask) return {edge:paisEdge, glow:paisGlow, mask:paisMask};

  const gj = await (await fetch(URL_COUNTRIES)).json();
  const feat = gj.features.find(f =>
    (f.properties.ADMIN||f.properties.name) === 'Colombia' ||
    f.properties.ADMIN === 'Republic of Colombia'
  );
  if (!feat) return {};

  paisGlow = L.geoJSON(feat, { pane:'borders', style:{ color:'#49a7ff', weight:9, opacity:0.25, fill:false } });
  paisEdge = L.geoJSON(feat, { pane:'borders', style:{ color:'#bfe2ff', weight:3, opacity:0.95, fill:false } });

  // Mask with Colombia as a hole
  const holes = [];
  const g = feat.geometry;
  if (g.type === 'Polygon') holes.push(g.coordinates[0]);
  else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => { if (poly[0]) holes.push(poly[0]); });

  const outerRect = [[-180,-90],[-180,90],[180,90],[180,-90],[-180,-90]];
  const maskGeo = { type:'Polygon', coordinates:[ outerRect, ...holes ] };

  paisMask = L.geoJSON(maskGeo, { pane:'mask', style:{ color:'#000', weight:0, fillColor:'#000', fillOpacity:0.35 }, interactive:false });

  return {edge:paisEdge, glow:paisGlow, mask:paisMask};
}

chkPais.addEventListener('change', async e => {
  const {edge, glow, mask} = await loadPaisDecorado();
  if (!edge || !glow || !mask) return;
  if (e.target.checked){ mask.addTo(map); glow.addTo(map); edge.addTo(map); }
  else { [edge,glow,mask].forEach(l => map.removeLayer(l)); }
});
chkLabels.addEventListener('change', e=>{ if (e.target.checked) labelsLayer.addTo(map); else map.removeLayer(labelsLayer); });
btnCol.addEventListener('click', ()=> map.fitBounds(COLOMBIA_BBOX));

// ========= PANELS / MODAL =========
function closeAllPanels(){
  layersPanel.classList.remove('open');
  chartsPanel.classList.remove('open');
  helpModal.classList.remove('open');
  backdrop.classList.remove('open');
}
btnLayers.addEventListener('click', ()=>{
  const isOpen = layersPanel.classList.contains('open');
  closeAllPanels(); if (!isOpen) layersPanel.classList.add('open');
});
btnCharts.addEventListener('click', ()=>{
  const isOpen = chartsPanel.classList.contains('open');
  closeAllPanels(); if (!isOpen) chartsPanel.classList.add('open');
});
btnHelp.addEventListener('click', ()=>{
  const isOpen = helpModal.classList.contains('open');
  closeAllPanels(); if (!isOpen){ helpModal.classList.add('open'); backdrop.classList.add('open'); }
});
document.querySelectorAll('.close').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    const sel = e.currentTarget.getAttribute('data-close');
    if (sel) document.querySelector(sel).classList.remove('open');
    backdrop.classList.remove('open');
  });
});
backdrop.addEventListener('click', closeAllPanels);

// ========= SYNC UI =========
function buildLayerRadios(){
  layerRadios.innerHTML = '';
  Object.entries(LAYERS).forEach(([key,val],i)=>{
    const id = `lr_${key}`;
    const lab = document.createElement('label');
    lab.innerHTML = `<input type="radio" name="layerRadio" id="${id}" value="${key}" ${i===0?'checked':''}><span>${val.name}</span>`;
    layerRadios.appendChild(lab);
  });
  layerRadios.querySelectorAll('input[type="radio"]').forEach(r=>{
    r.addEventListener('change', ()=>{
      console.log('🎚️ Radio button changed to:', r.value);
      layerSelect.value = r.value;
      updateLayer();
    });
  });
}

quarterSelect.addEventListener('change', ()=>{ const i=QUARTERS.indexOf(quarterSelect.value); if(i>=0) range.value=String(i); updateLayer(); });
range.addEventListener('input', ()=>{ const i=parseInt(range.value,10); quarterSelect.value=QUARTERS[i]; updateLayer(); });
lpOpacity.addEventListener('input', ()=>{ if(activeLayer) activeLayer.setOpacity(parseFloat(lpOpacity.value)); });

infoBtn.addEventListener('click', ()=>{ const k=layerSelect.value; alert(`${LAYERS[k].name}\n\n${LAYERS[k].desc}`); });
// UTILITIES
function applyCbMode(on){
  const root = document.documentElement;
  if (on) root.setAttribute('data-theme','cb');
  else    root.removeAttribute('data-theme');
  try{ localStorage.setItem('ui_cb', on ? '1' : '0'); }catch(_) {}
}

// Playback
let timer=null;
function stepForward(){ let i=parseInt(range.value,10); i=(i+1)%QUARTERS.length; range.value=String(i); quarterSelect.value=QUARTERS[i]; updateLayer(); }
playToggle.addEventListener('change', e=>{ if(e.target.checked){ if(timer) clearInterval(timer); timer=setInterval(stepForward, 1000); } else { if(timer) clearInterval(timer); }});

// ========= DEBUG UTILITIES =========
window.debugMap = function() {
  console.log('🔍 MAP DEBUG INFO:');
  console.log('Active layer:', activeLayer);
  console.log('Base SAR:', baseSAR);
  console.log('Current zoom:', map.getZoom());
  console.log('Current center:', map.getCenter());
  
  console.log('\n📊 All layers:');
  let layerCount = 0;
  map.eachLayer((layer) => {
    layerCount++;
    console.log(`  Layer ${layerCount}:`, {
      pane: layer.options?.pane,
      opacity: layer.options?.opacity,
      className: layer.options?.className,
      visible: layer._map !== null,
      container: layer._container
    });
  });
  
  console.log('\n🎨 Pane z-indexes:');
  ['basemap', 'mask', 'dynamic', 'static', 'borders', 'labels'].forEach(paneName => {
    const pane = map.getPane(paneName);
    if (pane) {
      console.log(`  ${paneName}:`, {
        zIndex: pane.style.zIndex,
        childCount: pane.children.length,
        display: window.getComputedStyle(pane).display,
        opacity: window.getComputedStyle(pane).opacity
      });
    }
  });
};

console.log('💡 Debug utility loaded. Type debugMap() in console to inspect map state.');


// ========= INIT =========
(function init(){
  // 1) UI básica
  populateQuarters();
  buildLayerRadios();

  // 2) Estado inicial de capas dinámicas
  layerSelect.value   = 'suspect';
  quarterSelect.value = QUARTERS[0];
  range.value         = 0;
  lpOpacity.value     = 0.9;

  // 3) Decoración de país (límite + glow + máscara)
  chkPais.checked = true;
  loadPaisDecorado().then(({edge,glow,mask})=>{
    if (mask) mask.addTo(map);
    if (glow) glow.addTo(map);
    if (edge) edge.addTo(map);
  });

  // 4) Etiquetas activas por defecto
  chkLabels.checked = true;
  labelsLayer.addTo(map);

  // 5) Restaurar preferencia de Color-blind mode (UI)
  const savedCb = (typeof localStorage !== 'undefined' && localStorage.getItem('ui_cb') === '1');
  if (cbModeToggle) cbModeToggle.checked = savedCb;
  applyCbMode(savedCb);

  // 6) Primer render de la capa dinámica
  updateLayer();
})();

// Listener del toggle en Settings
cbModeToggle?.addEventListener('change', (e)=> applyCbMode(e.target.checked));

/* ====== Left menu (Events / Analysis / Settings) ====== */
if (!map.getPane('sbFocus')) { map.createPane('sbFocus'); map.getPane('sbFocus').style.zIndex = 550; }

const sb          = document.getElementById('sb');
const sbCollapse  = document.getElementById('sbCollapse');
const sbTabs      = Array.from(document.querySelectorAll('.sb-tab'));
const sbPanels    = Array.from(document.querySelectorAll('.sb-panel'));
const sbBackdrop  = document.getElementById('sbBackdrop');
const sbEventModal= document.getElementById('sbEventModal');
const sbEventTitle= document.getElementById('sbEventTitle');
const sbEventBody = document.getElementById('sbEventBody');

/* ─────────────────────────────
   ANALYSIS POP-UP: data + wiring
   ───────────────────────────── */

// 1) Event-specific analysis content (extend as you add events)
const ANALYSIS_BY_EVENT = {
  rio_quito: {
    title: 'Río Quito – Illegal mining, channel change and impacts',
    paragraphs: [
      // Paragraph 1 – hydromorphology
      'Across the Río Quito floodplain, the expansion of illegal alluvial mining has reworked large stretches of the channel and bars. Repeated dredging and spoil deposition create artificial pits and levees that divert flow, promoting avulsions and multi-thread reaches. In SAR imagery this appears as persistent low-backscatter (water-filled pits) surrounded by rough, unstable substrates; over time the main flow path migrates toward these depressions, shortening bends and cutting off secondary channels.',
      // Paragraph 2 – hydrology & sediment regime
      'These morphological interventions alter the seasonal hydrological signal. Excavated pits delay drainage after flood peaks, sustaining wet surfaces through the dry season. Tailings and freshly exposed sediments increase turbidity and fine load, changing the roughness seen by C-band radar. The result is a broader zone of “wet” or ponded pixels outside the historical channel, which the out-of-channel and pond-density indicators pick up as expanding clusters from 2016 to 2020.',
      // Paragraph 3 – environmental & social effects
      'Downstream communities report bank erosion near mining fronts, degraded water quality and restricted navigation routes. Pond networks act as contaminant reservoirs where mercury and suspended solids accumulate, then reconnect during high flows, pulsing pollution into populated reaches such as Paimadó. The static masks (main channel and buffer) help separate natural floodplain dynamics from mining-related inundation, while the frequency and post–pre change overlays show the persistence and intensification of these impacts.'
    ]
  },
  mojana: {
    title: 'Mompós–Mojana – seasonal wetlands (placeholder)',
    paragraphs: [
      'Seasonal inundation patterns across the Mojana floodplain.',
      'Interaction between Magdalena branches and local storage.',
      'Use frequency and post–pre masks to separate persistent vs seasonal water.'
    ]
  },
  sabana: {
    title: 'Bogotá Savanna – peri-urban wetlands (placeholder)',
    paragraphs: [
      'Fragmented wetlands influenced by urban expansion.',
      'Drainage works and agriculture modify pond persistence.',
      'Combine out-of-channel and density layers to locate hotspots.'
    ]
  },
  __default: {
    title: 'Event analysis',
    paragraphs: [
      'Overview of hydrologic setting and drivers.',
      'Data and preprocessing: Sentinel-1 GRD, RTC where available.',
      'Indicators: wetness, out-of-channel, pond density, static masks.'
    ]
  }
};

// 2) Cache analysis modal nodes (robust to small HTML changes)
const sbAnalysisModal = document.getElementById('sbAnalysisModal');
const getAnalysisTitleEl = () =>
  document.getElementById('sbAnalysisTitle') ||
  (sbAnalysisModal && sbAnalysisModal.querySelector('.sb-title, .title, h3, .modal-title'));
const getAnalysisBodyEl = () =>
  document.getElementById('sbAnalysisBody') ||
  (sbAnalysisModal && sbAnalysisModal.querySelector('.sb-body, .body, .content, .sb-modal-body'));

// 3) Fill modal with the analysis for a given event key
function setAnalysisContentFor(eventKey){
  const data = ANALYSIS_BY_EVENT[eventKey] || ANALYSIS_BY_EVENT.__default;
  const t = getAnalysisTitleEl();
  const b = getAnalysisBodyEl();
  if (t) t.textContent = data.title;
  if (b) b.innerHTML = data.paragraphs.map(p => `<p>${p}</p>`).join('');
}

// 4) Open/close helpers
function openAnalysisFor(eventKey){
  setAnalysisContentFor(eventKey);
  if (sbAnalysisModal){ sbAnalysisModal.classList.add('open'); }
  if (sbBackdrop){ sbBackdrop.classList.add('open'); }
}
function closeAnalysis(){
  if (sbAnalysisModal) sbAnalysisModal.classList.remove('open');
  if (sbBackdrop) sbBackdrop.classList.remove('open');
}

// 5) Make the close button ALWAYS work (delegation + fallback)
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-sb-close], .sb-close'); // works for “X” or any close button
  if (!btn) return;
  const sel = btn.getAttribute('data-sb-close');
  const modal = sel ? document.querySelector(sel) : btn.closest('.sb-modal');
  if (modal) modal.classList.remove('open');
  if (sbBackdrop) sbBackdrop.classList.remove('open');
});

// Also close on backdrop and on ESC
sbBackdrop?.addEventListener('click', closeAnalysis);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAnalysis(); });

// 6) Wire the sidebar “Open pop-up” button to the CURRENT event
let __currentEventKey = null;
document.getElementById('sbOpenAnalysis')?.addEventListener('click', ()=>{
  openAnalysisFor(__currentEventKey || '__default');
});

// 7) Hook into your existing event focus function:
//    After you set strategy and call updateLayer(), also set the analysis content
//    and (optionally) auto-open the analysis modal the first time.
//    Add the lines marked “ADDED” to your existing focusEvent(ev).
const __origFocusEvent = typeof focusEvent === 'function' ? focusEvent : null;
window.focusEvent = function(ev){
  // Call the original behavior first (draw focus, switch tiles, show small popup, etc.)
  if (__origFocusEvent) __origFocusEvent(ev);

  // ADDED: remember which event is active
  __currentEventKey = ev.eventKey || ev.id || null;

  // ADDED: update the analysis content to match this event
  setAnalysisContentFor(__currentEventKey);

  // If you want to auto-open the big analysis popup whenever an event is clicked,
  // uncomment the next line:
  // openAnalysisFor(__currentEventKey);
};
// ========= SIDEBAR (events + analysis + settings) =========
sbCollapse.addEventListener('click', ()=>{ sb.classList.toggle('collapsed'); sbCollapse.textContent = sb.classList.contains('collapsed') ? '›' : '‹'; });
sbTabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    sbTabs.forEach(b=>b.classList.remove('sb-active'));
    sbPanels.forEach(p=>p.classList.remove('sb-active'));
    btn.classList.add('sb-active');
    document.getElementById(`sb-panel-${btn.dataset.tab}`).classList.add('sb-active');
  });
});

// Events
const SB_EVENTS = [
  { id: 'rio_quito', title: 'Río Quito', sub: 'Paimadó, Chocó', center: [5.492, -76.724], zoom: 13, eventKey: 'rio_quito',
    body: 'Annual series 2016–2023 from the event bucket. The quarter slider controls the year used.' },
  { id:'mojana', title:'Mompós Depression / Mojana', sub:'Bolívar–Sucre', center:[8.50,-74.30], zoom:9,
    body:'Placeholder: seasonal wetlands and overbank inundation.' },
  { id:'sabana', title:'Bogotá Savanna', sub:'Cundinamarca', bbox:[[4.45,-74.35],[4.95,-73.95]],
    body:'Placeholder: peri-urban wet areas.' }
];

const sbEvents = document.getElementById('sbEvents');
function renderSbEvents(){
  sbEvents.innerHTML = '';
  SB_EVENTS.forEach(ev=>{
    const btn = document.createElement('button');
    btn.className = 'item';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12 2a6 6 0 0 0-6 6c0 4.5 6 12 6 12s6-7.5 6-12a6 6 0 0 0-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
      <div><div class="title">${ev.title}</div><div class="sub">${ev.sub||''}</div></div>`;

    btn.addEventListener('click', ()=>{
      // NEW: remember which event is active and inject its analysis
      __currentEventKey = ev.eventKey || ev.id || null;
      setAnalysisContentFor(__currentEventKey);

      // keep your original behavior (center, switch tiles, small popup)
      focusEvent(ev);

      // Optional: auto-open the big analysis popup when an event is clicked
      // openAnalysisFor(__currentEventKey);
    });

    sbEvents.appendChild(btn);
  });
}

renderSbEvents();

let sbFocusLayer=null;
function focusEvent(ev){
  if (sbFocusLayer){ map.removeLayer(sbFocusLayer); sbFocusLayer=null; }
  if (ev.bbox){
    sbFocusLayer = L.rectangle(ev.bbox, {pane:'sbFocus', color:'#00ffe5', weight:2, dashArray:'6,4', fill:false, opacity:.9}).addTo(map);
    map.fitBounds(ev.bbox, {padding:[32,32]});
  } else if (ev.center){
    map.flyTo(ev.center, ev.zoom||10, {duration:.75});
    sbFocusLayer = null;
  }

  if (ev.eventKey === 'rio_quito') { window.__setEventStrategy && window.__setEventStrategy('rio_quito'); }
  else                              { window.__setEventStrategy && window.__setEventStrategy(null); }
  if (typeof updateLayer === 'function') updateLayer();

  sbEventTitle.textContent = ev.title;
  sbEventBody.innerHTML = `<p>${ev.body||'Event description (placeholder).'}</p>`;
  sbEventModal.classList.add('open'); sbBackdrop.classList.add('open');
}

// Analysis pop-up
document.getElementById('sbOpenAnalysis')?.addEventListener('click',()=>{
  document.getElementById('sbAnalysisModal').classList.add('open');
  sbBackdrop.classList.add('open');
});

// Close pop-ups (left menu)
document.querySelectorAll('.sb-close').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    const sel = e.currentTarget.getAttribute('data-sb-close');
    document.querySelector(sel).classList.remove('open');
    sbBackdrop.classList.remove('open');
  });
});
sbBackdrop?.addEventListener('click', ()=>{
  sbEventModal.classList.remove('open');
  document.getElementById('sbAnalysisModal').classList.remove('open');
  sbBackdrop.classList.remove('open');
});

// ESC closes
document.addEventListener('keydown',(e)=>{
  if(e.key==='Escape'){
    if (sb.classList.contains('collapsed')===false) sb.classList.add('collapsed');
    sbEventModal.classList.remove('open');
    document.getElementById('sbAnalysisModal').classList.remove('open');
    sbBackdrop.classList.remove('open');
  }
});

/* ================== Event strategy (auto-detect TMS/XYZ) ================== */
(function(){
  const buildDefaultURL = (layerKey, quarter) =>
    `${BASE}/${layerKey}/${quarter}/{z}/{x}/{y}.png`;

  const EVENT_DEFS = {
    rio_quito: {
      layerKeyMap: { s1rgb: 'sar_rgb', wet: 'wet_pct', pond3m: 'pond_pct', suspect: 'suspect' },
      availableYears: [2016, 2017, 2018, 2019, 2020],
      normalizeYear(y){
        const yrs = this.availableYears; y=+y;
        for (let i=yrs.length-1;i>=0;i--) if (yrs[i]<=y) return yrs[i];
        return yrs[0];
      },
      tms:true, minZoom:10, maxNativeZoom:14,
      buildUrl(layerKey, quarterStr){
        const yearStr = String(quarterStr).slice(0,4);
        const year = this.normalizeYear(+yearStr);
        const folder = this.layerKeyMap[layerKey] || layerKey;
        return `https://storage.googleapis.com/${BUCKET}/rio_quito/tiles/${folder}/${year}/{z}/{x}/{y}.png`;
      }
    }
  };

  function setStrategyFor(key){
    if (!key){
      window.TileURLStrategy = { buildUrl: buildDefaultURL, tms:false, minZoom:5, maxNativeZoom:EXPORTED_MAX_ZOOM };
      window.__activeEventKey = null; return;
    }
    const def = EVENT_DEFS[key];
    window.TileURLStrategy = {
      buildUrl: (layerKey,q)=>def.buildUrl(layerKey,q),
      tms:!!def.tms,
      minZoom:def.minZoom??5,
      maxNativeZoom:def.maxNativeZoom??EXPORTED_MAX_ZOOM
    };
    window.__activeEventKey = key;
    autoDetectScheme(def);
  }

  function autoDetectScheme(def){
    try{
      const z = Math.min(Math.max(map.getZoom(), def.minZoom||10), def.maxNativeZoom||14);
      const center = map.getCenter();
      const size = 256;
      const proj = map.project(center, z);
      const x = Math.floor(proj.x/size);
      const yXYZ = Math.floor(proj.y/size);
      const yTMS = (Math.pow(2,z)-1)-yXYZ;

      const k = (typeof layerSelect!=='undefined'?layerSelect.value:'pond3m')||'pond3m';
      const q = (typeof quarterSelect!=='undefined'?quarterSelect.value:'2016-Q1')||'2016-Q1';
      const baseUrl = def.buildUrl(k,q).replace('{z}',z).replace('{x}',x);

      const urlTMS = baseUrl.replace('{y}',yTMS);
      const urlXYZ = baseUrl.replace('{y}',yXYZ);

      const imgT=new Image(), imgX=new Image(); let decided=false;
      imgT.onload=()=>{ if(decided) return; decided=true; window.TileURLStrategy.tms=true;  updateLayer(); };
      imgX.onload=()=>{ if(decided) return; decided=true; window.TileURLStrategy.tms=false; updateLayer(); };
      imgT.src=urlTMS; imgX.src=urlXYZ;
      console.log('[Event]', window.__activeEventKey, 'probe TMS:', urlTMS, 'probe XYZ:', urlXYZ);
    }catch(e){ console.warn('AutoDetect TMS/XYZ error:', e); }
  }

  if (!window.__Patched){
    window.__makeTilePatched = true;
    setStrategyFor(null);
    const _transparent = typeof transparentPng!=='undefined'?transparentPng:'';
    makeTile = function(layerKey, quarter, opacity){
      const strat = window.TileURLStrategy || {};
      const url   = (strat.buildUrl || buildDefaultURL)(layerKey, quarter);
      return L.tileLayer(url, {
        pane:'dynamic',
        opacity: opacity ?? 0.85,
        minZoom: strat.minZoom ?? 5,
        maxZoom: EXPORTED_MAX_ZOOM,
        maxNativeZoom: strat.maxNativeZoom ?? EXPORTED_MAX_ZOOM,
        tms: !!strat.tms,
        tileSize:256,
        noWrap:true,
        errorTileUrl:_transparent,
        className: 'sar-dyn-tiles'
      });
    };
    window.__setEventStrategy = setStrategyFor;
  }
})();
