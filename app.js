// ========= CONFIG =========
const BUCKET = 'sar-colombia-tiles';
const BASE   = `https://storage.googleapis.com/${BUCKET}/tiles`;
const EXPORTED_MAX_ZOOM = 18;

const LAYERS = {
  s1rgb:   { name: 'SAR RGB (VV,VH,VV)', desc: 'Composición SAR (VV,VH,VV). Contexto de textura y humedad.' },
  wet:     { name: 'Water / Wetness',    desc: 'Low VV/VH backscatter revealing waterlogged or inundated surfaces.' },
  suspect: { name: 'Out-of-channel water', desc: 'Frequent wet pixels outside the persistent channel (possible pits/canals).' },
  pond3m:  { name: 'Pond density (250 m)', desc: 'Percent of “suspect” pixels within a 250 m neighborhood.' }
};

const STATIC = {
  freq:   `${BASE}/static/freq/freq/{z}/{x}/{y}.png`,
  dwet:   `${BASE}/static/dwet/dwet/{z}/{x}/{y}.png`,
  mainch: `${BASE}/static/mainch/mainch/{z}/{x}/{y}.png`,
  mainbuf:`${BASE}/static/mainbuf/mainbuf/{z}/{x}/{y}.png`
};

// ========= MAPA =========
const map = L.map('map', { zoomControl:false, minZoom:5, maxZoom:EXPORTED_MAX_ZOOM });
L.control.zoom({position:'bottomleft'}).addTo(map);

map.createPane('basemap');  map.getPane('basemap').style.zIndex = 200;
map.createPane('mask');     map.getPane('mask').style.zIndex    = 350;
map.createPane('dynamic');  map.getPane('dynamic').style.zIndex = 400;
map.createPane('static');   map.getPane('static').style.zIndex  = 450;
map.createPane('borders');  map.getPane('borders').style.zIndex = 500;
map.createPane('labels');   map.getPane('labels').style.zIndex  = 600;

L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, & others.', pane:'basemap' }
).addTo(map);

// Overlay de etiquetas
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

const layerSelect   = document.getElementById('layerSelect'); // oculto
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

// Referencias
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

// ========= TILES: helpers (TXT catálogo para eventos) =========
const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const BLANK_PNG = transparentPng;

const __TileCatalog = Object.create(null);

async function loadTileCatalog(area){
  if (__TileCatalog[area]) return __TileCatalog[area];
  const url = `./data/lista_${area}.txt`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.warn(`[catalog] No pude cargar ${url} (status ${resp.status})`);
    __TileCatalog[area] = new Map();
    return __TileCatalog[area];
  }
  const txt = await resp.text();

  // Acepta líneas gs://..., https://storage.googleapis.com/... y prefijo relativo
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
    catalog.get(key).add(`${z}/${x}/${y}`); // z/x/y en TMS tal como existe
  }

  console.log(`[catalog] ${area}: grupos=${catalog.size}`, [...catalog.keys()].slice(0,6));
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

  // metadatos para prefetch
  tl.__eventMeta = { area, folder, year, allowSet: allow, tms: isTms };
  return tl;
}

/* ===== Prefetch de todos los tiles disponibles (según .txt) ===== */
function __imgLoad(url){
  return new Promise((res)=>{ 
    const im = new Image();          // <-- sin crossOrigin
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

// ========= TILES SAR (modo global trimestral) =========
function makeTile(layerKey, quarter, opacity){
  const url = `${BASE}/${layerKey}/${quarter}/{z}/{x}/{y}.png`;
  return L.tileLayer(url, {
    pane:'dynamic',
    opacity: opacity,
    minZoom:5, maxZoom:EXPORTED_MAX_ZOOM, maxNativeZoom:EXPORTED_MAX_ZOOM,
    noWrap:true, tileSize:256, tms:false, errorTileUrl:transparentPng, className: 'sar-dyn-tiles'
  });
}
let activeLayer=null, baseSAR=null;

// updateLayer: usa catálogo TXT cuando el evento activo es Río Quito
async function updateLayer(){
  const k  = layerSelect.value;
  const q  = quarterSelect.value;
  const op = parseFloat(lpOpacity.value);

  if (activeLayer) map.removeLayer(activeLayer);
  if (baseSAR)     map.removeLayer(baseSAR);
  baseSAR = null;

  if (window.__activeEventKey === 'rio_quito') {
    if (k !== 's1rgb') {
      baseSAR = await makeEventTileFromTxt({ area:'rio_quito', layerKey:'s1rgb', quarter:q, opacity:0.6 });
      baseSAR.addTo(map);
      // Prefetch opcional de la base
      if (baseSAR.__eventMeta) prefetchEventTiles({ ...baseSAR.__eventMeta, concurrency: 10 });
    }
    activeLayer = await makeEventTileFromTxt({ area:'rio_quito', layerKey:k, quarter:q, opacity:op });
    activeLayer.addTo(map);

    // Prefetch de toda la capa-año seleccionada
    if (activeLayer.__eventMeta) {
      prefetchEventTiles({ ...activeLayer.__eventMeta, minZ:10, maxZ:14, concurrency: 12 });
    }
  } else {
    if (k !== 's1rgb') baseSAR = makeTile('s1rgb', q, 0.6).addTo(map);
    activeLayer = makeTile(k, q, op).addTo(map);
  }

  layerDesc.innerHTML = `<strong>${LAYERS[k].name}</strong> — ${LAYERS[k].desc}`;
}

// ========= ESTÁTICAS =========
const staticLayers = {
  freq:   L.tileLayer(STATIC.freq,   {pane:'static', opacity:0.85, noWrap:true, errorTileUrl:transparentPng}),
  dwet:   L.tileLayer(STATIC.dwet,   {pane:'static', opacity:0.85, noWrap:true, errorTileUrl:transparentPng}),
  mainch: L.tileLayer(STATIC.mainch, {pane:'static', opacity:0.9,  noWrap:true, errorTileUrl:transparentPng}),
  mainbuf:L.tileLayer(STATIC.mainbuf,{pane:'static', opacity:0.9,  noWrap:true, errorTileUrl:transparentPng})
};
lpFreq   .addEventListener('change', e=> e.target.checked ? staticLayers.freq.addTo(map)   : map.removeLayer(staticLayers.freq));
lpDelta  .addEventListener('change', e=> e.target.checked ? staticLayers.dwet.addTo(map)   : map.removeLayer(staticLayers.dwet));
lpMainCh .addEventListener('change', e=> e.target.checked ? staticLayers.mainch.addTo(map) : map.removeLayer(staticLayers.mainch));
lpMainBuf.addEventListener('change', e=> e.target.checked ? staticLayers.mainbuf.addTo(map): map.removeLayer(staticLayers.mainbuf));

staticInfoBtn.addEventListener('click', ()=>{ staticInfoBox.hidden = !staticInfoBox.hidden; });

// ========= BORDES + MÁSCARA =========
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
      layerSelect.value = r.value;
      updateLayer();
    });
  });
}

quarterSelect.addEventListener('change', ()=>{ const i=QUARTERS.indexOf(quarterSelect.value); if(i>=0) range.value=String(i); updateLayer(); });
range.addEventListener('input', ()=>{ const i=parseInt(range.value,10); quarterSelect.value=QUARTERS[i]; updateLayer(); });
lpOpacity.addEventListener('input', ()=>{ if(activeLayer) activeLayer.setOpacity(parseFloat(lpOpacity.value)); });

infoBtn.addEventListener('click', ()=>{ const k=layerSelect.value; alert(`${LAYERS[k].name}\n\n${LAYERS[k].desc}`); });

// Reproducción
let timer=null;
function stepForward(){ let i=parseInt(range.value,10); i=(i+1)%QUARTERS.length; range.value=String(i); quarterSelect.value=QUARTERS[i]; updateLayer(); }
playToggle.addEventListener('change', e=>{ if(e.target.checked){ if(timer) clearInterval(timer); timer=setInterval(stepForward, 1000); } else { if(timer) clearInterval(timer); }});

// ========= INIT =========
(function init(){
  populateQuarters();
  buildLayerRadios();

  layerSelect.value = 'suspect';
  quarterSelect.value = QUARTERS[0];
  range.value = 0;
  lpOpacity.value = 0.9;

  chkPais.checked = true;
  loadPaisDecorado().then(({edge,glow,mask})=>{ if (mask) mask.addTo(map); if (glow) glow.addTo(map); if (edge) edge.addTo(map); });

  chkLabels.checked = true; labelsLayer.addTo(map);

  updateLayer();
})();

/* ====== Menú izquierdo (Eventos/Análisis/Settings) ====== */
if (!map.getPane('sbFocus')) { map.createPane('sbFocus'); map.getPane('sbFocus').style.zIndex = 550; }

const sb          = document.getElementById('sb');
const sbCollapse  = document.getElementById('sbCollapse');
const sbTabs      = Array.from(document.querySelectorAll('.sb-tab'));
const sbPanels    = Array.from(document.querySelectorAll('.sb-panel'));
const sbBackdrop  = document.getElementById('sbBackdrop');
const sbEventModal= document.getElementById('sbEventModal');
const sbEventTitle= document.getElementById('sbEventTitle');
const sbEventBody = document.getElementById('sbEventBody');

sbCollapse.addEventListener('click', ()=>{ sb.classList.toggle('collapsed'); sbCollapse.textContent = sb.classList.contains('collapsed') ? '›' : '‹'; });
sbTabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    sbTabs.forEach(b=>b.classList.remove('sb-active'));
    sbPanels.forEach(p=>p.classList.remove('sb-active'));
    btn.classList.add('sb-active');
    document.getElementById(`sb-panel-${btn.dataset.tab}`).classList.add('sb-active');
  });
});

// Eventos
const SB_EVENTS = [
  { id: 'rio_quito', title: 'Río Quito', sub: 'Paimadó, Chocó', center: [5.492, -76.724], zoom: 13, eventKey: 'rio_quito',
    body: 'Serie anual 2016–2023 desde el bucket del evento. El slider por trimestre controla el año.' },
  { id:'mojana', title:'Depresión Momposina / Mojana', sub:'Bolívar–Sucre', center:[8.50,-74.30], zoom:9,
    body:'Placeholder: humedales estacionales y desbordamientos.' },
  { id:'sabana', title:'Sabana de Bogotá', sub:'Cundinamarca', bbox:[[4.45,-74.35],[4.95,-73.95]],
    body:'Placeholder: áreas húmedas periurbanas.' }
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
    btn.addEventListener('click', ()=>focusEvent(ev));
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
    sbFocusLayer = L.circle(ev.center, {pane:'sbFocus', radius:5000, color:'#00ffe5', weight:2, fill:false}).addTo(map);
    map.flyTo(ev.center, ev.zoom||10, {duration:.75});
  }

  if (ev.eventKey === 'rio_quito') { window.__setEventStrategy && window.__setEventStrategy('rio_quito'); }
  else                              { window.__setEventStrategy && window.__setEventStrategy(null); }
  if (typeof updateLayer === 'function') updateLayer();

  sbEventTitle.textContent = ev.title;
  sbEventBody.innerHTML = `<p>${ev.body||'Descripción del suceso (placeholder).'}</p>`;
  sbEventModal.classList.add('open'); sbBackdrop.classList.add('open');
}

// Pop-up análisis
document.getElementById('sbOpenAnalysis')?.addEventListener('click',()=>{
  document.getElementById('sbAnalysisModal').classList.add('open');
  sbBackdrop.classList.add('open');
});

// Cierre de modales propios
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

// ESC cierra
document.addEventListener('keydown',(e)=>{
  if(e.key==='Escape'){
    if (sb.classList.contains('collapsed')===false) sb.classList.add('collapsed');
    sbEventModal.classList.remove('open');
    document.getElementById('sbAnalysisModal').classList.remove('open');
    sbBackdrop.classList.remove('open');
  }
});

/* ================== Estrategia de evento (autodetección TMS/XYZ) ================== */
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
      console.log('[Evento]', window.__activeEventKey, 'probe TMS:', urlTMS, 'probe XYZ:', urlXYZ);
    }catch(e){ console.warn('AutoDetect TMS/XYZ error:', e); }
  }

  if (!window.__makeTilePatched){
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

