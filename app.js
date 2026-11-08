'use strict';
/* Melbourne Sweet Spot. All filtering runs in the browser over precomputed walking-distance grids. */

const DEFAULTS = {
  view: 'all', opacity: 75, minHa: 3, showPoi: false, showParks: false, showZones: false,
  land: { 1: true, 2: true, 3: true, 4: true },
  supermarket: { on: true, max: 800, brands: { woolworths: true, coles: true, aldi: true } },
  park: { on: true, max: 800, tier: 'park_1' },
  primary: { on: true, max: 1000, sector: 'any' },
  high: { on: true, max: 2000, mode: 'dist', schools: null, sector: 'public' },
  train: { on: true, max: 800, lines: { metro: true, vline: true } },
  gym: { on: true, max: 1000, kinds: { gym_full: true, gym_func: true, gym_spar: true, gym_climb: true, gym_combat: false, gym_women: false } },
  price: { on: false, max: 1500000, kind: 'house' },
};
const LAYERS = [
  { id: 'supermarket', label: 'Supermarket', min: 200, maxv: 2500, step: 50, color: '#d9480f' },
  { id: 'train', label: 'Train station', min: 200, maxv: 3000, step: 50, color: '#0b7285' },
  { id: 'park', label: 'Decent park', min: 100, maxv: 2000, step: 50, color: '#2b8a3e' },
  { id: 'primary', label: 'Primary school', min: 200, maxv: 3000, step: 50, color: '#1971c2' },
  { id: 'high', label: 'High school', min: 500, maxv: 5000, step: 100, color: '#7048e8' },
  { id: 'gym', label: 'Gym', min: 200, maxv: 3000, step: 50, color: '#c2255c' },
  { id: 'price', label: 'Budget', min: 400000, maxv: 5000000, step: 50000, color: '#2f9e44', sub: true },
];
// Optional filters: off to start, and only downloaded when switched on.
const EXTRAS = [
  ['cafe', 'Café', '#a0522d'], ['restaurant', 'Restaurant', '#e67700'], ['pub_bar', 'Pub or bar', '#9c36b5'],
  ['gp', 'GP clinic', '#e03131'], ['pharmacy', 'Pharmacy', '#0ca678'], ['childcare', 'Childcare or kinder', '#f59f00'],
  ['library', 'Public library', '#4263eb'], ['tram', 'Tram stop', '#66a80f'], ['pool', 'Public pool', '#1098ad'], ['beach', 'Beach', '#d4a017'],
];
for (const [id, label, color] of EXTRAS) { DEFAULTS[id] = { on: false, max: 1500 }; LAYERS.push({ id, label, color, extra: true, min: 200, maxv: 3000, step: 50 }); }
// Keep-away filters pass when the nearest place is at least this far, in a straight line.
DEFAULTS.away_school = { on: false, max: 500 };
LAYERS.push({ id: 'away_school', label: 'Away from schools', color: '#868e96', extra: true, away: true, min: 200, maxv: 1500, step: 50 });
// Personas are changes from the original brief. Schools, shops and so on stay as they are unless a persona says otherwise.
const PERSONAS = [
  { id: 'brief', label: 'Amenity family', hint: '', set: {} },
  { id: 'family', label: 'Young family', hint: 'Playground, primary school, childcare and a GP nearby. High schools can wait.', set: {
    high: { on: false }, gym: { on: false }, train: { max: 1000 }, park: { tier: 'park_play' }, childcare: { on: true }, gp: { on: true } } },
  { id: 'teens', label: 'Family with teens', hint: 'In the zone of a top high school, with a train and library for independent teens.', set: {
    primary: { on: false }, high: { mode: 'zone' }, library: { on: true } } },
  { id: 'dinks', label: 'DINKs', hint: 'At least 500 m from any school. Good food, a pub, a gym and a train, apartments included.', set: {
    primary: { on: false }, high: { on: false }, park: { tier: 'park_05' }, gym: { max: 800 }, cafe: { on: true, max: 800 }, restaurant: { on: true, max: 800 }, pub_bar: { on: true, max: 800 }, away_school: { on: true } } },
  { id: 'nature', label: 'Nature lovers', hint: 'A 20 ha park or reserve within 500 m, and nothing else matters.', set: {
    supermarket: { on: false }, train: { on: false }, primary: { on: false }, high: { on: false }, gym: { on: false }, park: { tier: 'park_20', max: 500 } } },
  { id: 'downsizers', label: 'Downsizers', hint: 'GP, pharmacy, café and library close by, at least 500 m from any school.', set: {
    primary: { on: false }, high: { on: false }, gym: { on: false }, gp: { on: true, max: 800 }, pharmacy: { on: true, max: 800 }, cafe: { on: true, max: 800 }, library: { on: true }, away_school: { on: true } } },
  { id: 'beach', label: 'Beach life', hint: 'The beach within 800 m, with a coffee and a train not far away.', set: {
    primary: { on: false }, high: { on: false }, gym: { on: false }, park: { on: false }, train: { max: 1500 }, supermarket: { max: 1500 }, beach: { on: true, max: 800 }, cafe: { on: true, max: 800 } } },
];
const LAND = { 1: 'Residential zones', 2: 'Low-density / rural living', 3: 'Commercial & activity centres (apartments)', 4: 'Urban growth (new estates)' };
const TIERS = { park_05: 'Any park 0.5 ha or more', park_1: 'Park 1 ha or more (about 1.5 ovals)', park_green: 'Park 1 ha or more, not just sports grounds', park_3: 'Park 3 ha or more', park_10: 'Big park 10 ha or more', park_20: 'Very big park 20 ha or more, not just sports grounds', park_play: 'Park 1 ha or more with a playground' };
const BRAND_LABEL = { woolworths: 'Woolworths', coles: 'Coles', aldi: 'Aldi' };
const GYM_KINDS = {
  gym_full: { label: 'Full gyms', hint: 'chains, leisure centres, independents', color: '#c2255c' },
  gym_func: { label: 'CrossFit and functional', hint: 'CrossFit, F45, BFT and similar', color: '#e8590c' },
  gym_spar: { label: 'Boxing and MMA with sparring', hint: 'sparring shown on their website', color: '#862e9c' },
  gym_climb: { label: 'Climbing gyms', hint: 'indoor bouldering and rope walls', color: '#2f9e44' },
  gym_combat: { label: 'Other boxing, MMA and BJJ', hint: 'sparring not confirmed', color: '#b197c4' },
  gym_women: { label: 'Women-only gyms', hint: 'Fernwood, Curves and similar', color: '#e599b7' },
};
const TRAIN_KEYS = { metro: 'train_metro', vline: 'train_vline' };
const BRAND_COLOR = { woolworths: '#1b7f3b', coles: '#d6001c', aldi: '#00539f' };

let S, meta, pois, N, cols, rows;
const G = {};            // decoded rasters
const SRC = {};          // nearest-source rasters, loaded after first paint
let cand, hsMin, zoneAny, hsBlob, hsFar, zoneBlob;
let labels, pockets = [], selPocket = -1, subs, SUB, hasPrices = false;
let canvas, ctx, img, px32, map, poiLayer, zoneLayer, parkLayer, parksData, zonesData, legendCtl;
let raf = 0;

const $ = (s) => document.querySelector(s);
const el = (t, a = {}, ...kids) => { const e = document.createElement(t); for (const k in a) { if (k === 'class') e.className = a[k]; else if (k === 'html') e.innerHTML = a[k]; else e.setAttribute(k, a[k]); } e.append(...kids); return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMoney = (v) => (v >= 1e6 ? '$' + (v / 1e6).toFixed(2).replace(/0$/, '') + 'm' : '$' + Math.round(v / 1000) + 'k');
const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1) + ' km' : m + ' m');

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (to, from) => { for (const k in from) { if (isObj(to[k]) && isObj(from[k])) merge(to[k], from[k]); else to[k] = from[k]; } return to; };
function loadState() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('pocketfinder') || '{}'); } catch (e) { /* ignore corrupt state */ }
  const d = structuredClone(DEFAULTS);
  // Merge level by level so options added since the settings were saved keep their defaults.
  for (const k in saved) if (k in d) { if (isObj(d[k]) && isObj(saved[k])) merge(d[k], saved[k]); else d[k] = saved[k]; }
  return d;
}
const saveState = () => localStorage.setItem('pocketfinder', JSON.stringify(S));

/* Static hosts occasionally drop a request with a 5xx; retry twice so one blip doesn't stop the whole map loading. */
async function getData(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status < 500 || attempt >= 2) return r;
    } catch (e) { if (attempt >= 2) throw e; }
    await new Promise((ok) => setTimeout(ok, 700 * (attempt + 1)));
  }
}
async function gz(path) {
  const r = await getData('data/' + path);
  if (!r.ok) throw new Error(path + ' ' + r.status);
  const st = r.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(st).arrayBuffer();
}

const extraLoading = {};
function ensureExtra(id) {
  if (!extraLoading[id]) {
    extraLoading[id] = Promise.all([
      gz(id + '.u8.gz').then((b) => { G[id] = new Uint8Array(b); }),
      getData('data/poi_' + id + '.json').then((r) => { if (!r.ok) throw new Error(id + ' ' + r.status); return r.json(); }).then((p) => { pois[id] = p; }),
    ]).catch((e) => { delete extraLoading[id]; throw e; });
  }
  return extraLoading[id];
}

/* Only the top schools ship with the page. Picking any other school fetches the rest. */
let hsFarLoading;
function ensureFar() {
  if (hsFar || ![...chosenSchools()].some((n) => schoolByName.get(n).far)) return Promise.resolve();
  hsFarLoading ||= gz('highschools_all.u8.gz').then((b) => { hsFar = new Uint8Array(b); }).catch((e) => { hsFarLoading = null; throw e; });
  return hsFarLoading;
}
const schoolByName = new Map();
const isPublic = (s) => s.sector === 'Government';
/* Ticks are kept for every school; the public/private switch decides which of them count. */
function chosenSchools() {
  const sec = S.high.sector;
  return new Set(S.high.schools.filter((n) => { const s = schoolByName.get(n); return s && (sec === 'both' || isPublic(s) === (sec === 'public')); }));
}
async function init() {
  meta = await (await getData('data/meta.json')).json();
  ({ cols, rows } = meta); N = cols * rows;
  subs = (await (await getData('data/suburbs.json')).json());
  const subArr = (k, T) => T.from([0, ...subs.suburbs.map((d) => d[k] || 0)]);
  SUB = { house: subArr('house', Int32Array), unit: subArr('unit', Int32Array) };
  hasPrices = SUB.house.some((v) => v > 0);
  const names = ['woolworths', 'coles', 'aldi', 'train_metro', 'train_vline', 'gym_full', 'gym_func', 'gym_spar', 'gym_climb', 'gym_combat', 'gym_women', 'primary_gov', 'primary_nongov', 'park_05', 'park_1', 'park_green', 'park_3', 'park_10', 'park_20', 'park_play'];
  let done = 0; const total = names.length + 4;
  const tick = () => { $('#loadPct').textContent = Math.round(++done / total * 100) + '%'; };
  const [p, res, loc, hb, zb] = await Promise.all([
    getData('data/pois.json').then((r) => r.json()).finally(tick),
    gz('res.u8.gz').finally(tick), gz('loc.u16.gz').finally(tick),
    gz('highschools.u8.gz').finally(tick), gz('zones.u8.gz'),
    ...names.map((n) => gz(n + '.u8.gz').then((b) => { G[n] = new Uint8Array(b); tick(); })),
  ]);
  pois = p; G.res = new Uint8Array(res); G.loc = new Uint16Array(loc); hsBlob = new Uint8Array(hb); zoneBlob = new Uint8Array(zb);
  S = loadState();
  if (!S.high.schools) S.high.schools = meta.schools.filter((s) => s.on).map((s) => s.name);
  meta.schools.forEach((s) => schoolByName.set(s.name, s));
  // Private schools aren't ranked, so all of them start ticked; the switch keeps them out until chosen.
  if (!S.high.privTicked) { S.high.schools = [...new Set([...S.high.schools, ...meta.schools.filter((s) => !isPublic(s)).map((s) => s.name)])]; S.high.privTicked = true; }
  await ensureFar().catch(() => {});
  await Promise.all(LAYERS.filter((l) => l.extra && S[l.id].on).map((l) => ensureExtra(l.id).catch(() => { S[l.id].on = false; })));

  const c = []; for (let i = 0; i < N; i++) if (G.res[i]) c.push(i);
  cand = Int32Array.from(c);
  hsMin = new Uint8Array(N); zoneAny = new Uint8Array(N); labels = new Int32Array(N);

  initMap(); buildUI(); rebuildSchools(); schedule();
  $('#loading').remove();
  $('#built').textContent = 'Data built ' + meta.built;
}

/* Nearest-place lookups are only needed when something is tapped, so they load on demand to spare phone memory. */
const srcLoading = {};
function ensureSrc(keys) {
  return Promise.all(keys.map((k) => {
    if (!srcLoading[k]) srcLoading[k] = gz(k + '.src.gz').then((b) => { SRC[k] = new Uint16Array(b); });
    return srcLoading[k];
  }));
}

function initMap() {
  map = L.map('map', { zoomControl: !L.Browser.mobile, maxZoom: 18, minZoom: 9, preferCanvas: true }).setView([-37.84, 145.05], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
  const CanvasOverlay = L.ImageOverlay.extend({
    _initImage() {
      const c = this._image = this._url;
      L.DomUtil.addClass(c, 'leaflet-image-layer grid');
      if (this._zoomAnimated) L.DomUtil.addClass(c, 'leaflet-zoom-animated');
      c.onselectstart = L.Util.falseFn; c.onmousemove = L.Util.falseFn;
    },
  });
  canvas = document.createElement('canvas'); canvas.width = cols; canvas.height = rows;
  ctx = canvas.getContext('2d');
  img = ctx.createImageData(cols, rows); px32 = new Uint32Array(img.data.buffer);
  const overlay = new CanvasOverlay(canvas, [meta.sw, meta.ne], { opacity: S.opacity / 100, interactive: false });
  overlay.addTo(map); map._grid = overlay;
  poiLayer = L.layerGroup().addTo(map);
  map.on('click', (e) => openPopup(e.latlng));
  map.on('zoomend moveend', () => { if (S.showPoi) drawPois(); });
  map.on('zoomend', drawParks);
  legendCtl = L.control({ position: 'bottomright' });
  legendCtl.onAdd = () => el('div', { class: 'legend', id: 'legend' });
  legendCtl.addTo(map);
}

/* ---------- criteria ---------- */
function activeLayers() {
  const a = [];
  for (const L_ of LAYERS) {
    const st = S[L_.id];
    if (!st.on) continue;
    const q = Math.round(st.max / meta.step);
    if (L_.id === 'price') { if (hasPrices) a.push({ id: L_.id, sub: SUB[st.kind], q: st.max }); continue; }
    if (L_.extra) { if (G[L_.id]) a.push({ id: L_.id, arrs: [G[L_.id]], q, away: L_.away }); continue; }
    if (L_.id === 'supermarket') a.push({ id: L_.id, arrs: Object.keys(st.brands).filter((b) => st.brands[b]).map((b) => G[b]), q });
    if (L_.id === 'park') a.push({ id: L_.id, arrs: [G[st.tier]], q });
    if (L_.id === 'primary') a.push({ id: L_.id, arrs: st.sector === 'gov' ? [G.primary_gov] : [G.primary_gov, G.primary_nongov], q });
    if (L_.id === 'gym') a.push({ id: L_.id, arrs: Object.keys(st.kinds).filter((k) => st.kinds[k]).map((k) => G[k]), q });
    if (L_.id === 'train') a.push({ id: L_.id, arrs: Object.keys(st.lines).filter((k) => st.lines[k]).map((k) => G[TRAIN_KEYS[k]]), q });
    if (L_.id === 'high') a.push({ id: L_.id, hs: true, mode: st.mode, q });
  }
  return a;
}
function rebuildSchools() {
  hsMin.fill(meta.cap); zoneAny.fill(0);
  const on = chosenSchools();
  for (const s of meta.schools) {
    if (!on.has(s.name)) continue;
    const w = s.win, blob = s.far ? hsFar : hsBlob;
    if (blob) for (let r = 0; r < w.h; r++) {
      const o = (w.r0 + r) * cols + w.c0, b = w.off + r * w.w;
      for (let c = 0; c < w.w; c++) { const v = blob[b + c]; if (v < hsMin[o + c]) hsMin[o + c] = v; }
    }
    const z = s.zone;
    if (z) for (let r = 0; r < z.h; r++) {
      const o = (z.r0 + r) * cols + z.c0, b = z.off + r * z.w;
      for (let c = 0; c < z.w; c++) if (zoneBlob[b + c]) zoneAny[o + c] = 1;
    }
  }
}
function cellPass(l, i) {
  if (l.away) return l.arrs[0][i] >= l.q;
  if (l.sub) { const v = l.sub[G.loc[i]]; return v > 0 && v <= l.q; }
  if (l.hs) {
    const d = hsMin[i] <= l.q;
    return l.mode === 'dist' ? d : l.mode === 'zone' ? zoneAny[i] === 1 : d && zoneAny[i] === 1;
  }
  for (let k = 0; k < l.arrs.length; k++) { const v = l.arrs[k][i]; if (v <= l.q) return true; }
  return false;
}

/* ---------- compute + render ---------- */
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; compute(); }); };
const RGBA = (r, g, b, a) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
const C_MATCH = RGBA(11, 122, 92, 255), C_SEL = RGBA(230, 110, 0, 255), C_SMALL = RGBA(11, 122, 92, 90);
// Near-misses lean towards the full-match green, so 5 of 6 reads as almost there rather than as a warning.
const RAMP = [[252, 243, 207], [240, 228, 150], [196, 218, 120], [130, 200, 110]];
function rampColor(k, K) {
  const t = (K > 2 ? (k - 1) / (K - 2) : 1) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
  return RAMP[i].map((v, j) => Math.round(v + (RAMP[i + 1][j] - v) * f));
}

function compute() {
  const act = activeLayers(), K = act.length;
  const land = S.land, cum = new Float64Array(K + 1);
  px32.fill(0);
  labels.fill(0);
  const hit = new Uint8Array(N);
  let base = 0;
  const count = S.view === 'count' ? new Uint8Array(N) : null;
  for (let n = 0; n < cand.length; n++) {
    const i = cand[n];
    if (!land[G.res[i]]) continue;
    base++;
    let passed = 0, alive = true;
    for (let k = 0; k < K; k++) {
      if (cellPass(act[k], i)) { passed++; if (alive) cum[k]++; } else { alive = false; if (!count) break; }
    }
    if (alive) hit[i] = 1;
    if (count) count[i] = passed + 1;
  }
  findPockets(hit);
  if (S.view === 'all') {
    const keep = new Set(pockets.map((p) => p.id));
    for (let n = 0; n < cand.length; n++) {
      const i = cand[n];
      if (!hit[i]) continue;
      const l = labels[i];
      px32[i] = keep.has(l) ? (l === selPocket ? C_SEL : C_MATCH) : C_SMALL;
    }
  } else {
    for (let n = 0; n < cand.length; n++) {
      const i = cand[n], v = count[i];
      if (!v) continue;
      const k = v - 1;
      if (K === 0) continue;
      if (k === K) { px32[i] = C_MATCH; continue; }
      if (k === 0) continue;
      const t = rampColor(k, K);
      px32[i] = RGBA(t[0], t[1], t[2], 230);
    }
  }
  ctx.putImageData(img, 0, 0);
  renderFunnel(act, cum, base);
  renderPockets();
  renderLegend(K);
  if (isMobile() && !sheetDragging) setSheet(sheetState, false);
  saveState();
  if (S.showPoi) drawPois();
}

function findPockets(hit) {
  const stack = new Int32Array(N > 2000000 ? 2000000 : N);
  let id = 0; const out = [];
  const minCells = Math.max(1, S.minHa * 4);
  for (let n = 0; n < cand.length; n++) {
    const s0 = cand[n];
    if (!hit[s0] || labels[s0]) continue;
    id++;
    let sp = 0, size = 0, sr = 0, sc = 0, r0 = 1e9, r1 = -1, c0 = 1e9, c1 = -1;
    const locCount = new Map();
    stack[sp++] = s0; labels[s0] = id;
    while (sp) {
      const i = stack[--sp], r = (i / cols) | 0, c = i - r * cols;
      size++; sr += r; sc += c;
      if (r < r0) r0 = r; if (r > r1) r1 = r; if (c < c0) c0 = c; if (c > c1) c1 = c;
      const lc = G.loc[i]; if (lc) locCount.set(lc, (locCount.get(lc) || 0) + 1);
      if (c > 0 && hit[i - 1] && !labels[i - 1]) { labels[i - 1] = id; stack[sp++] = i - 1; }
      if (c < cols - 1 && hit[i + 1] && !labels[i + 1]) { labels[i + 1] = id; stack[sp++] = i + 1; }
      if (r > 0 && hit[i - cols] && !labels[i - cols]) { labels[i - cols] = id; stack[sp++] = i - cols; }
      if (r < rows - 1 && hit[i + cols] && !labels[i + cols]) { labels[i + cols] = id; stack[sp++] = i + cols; }
    }
    if (size >= minCells) {
      const subs = [...locCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: meta.locs[k - 1], share: v / size }));
      out.push({ id, cells: size, ha: size / 4, r: sr / size, c: sc / size, r0, r1, c0, c1, subs });
    }
  }
  out.sort((a, b) => b.cells - a.cells);
  pockets = out;
  if (!out.some((p) => p.id === selPocket)) selPocket = -1;
}

const cellLL = (r, c) => {
  const x = meta.mx0 + (c + 0.5) * meta.cell, y = meta.my1 - (r + 0.5) * meta.cell;
  const p = L.CRS.EPSG3857.unproject(L.point(x, y));
  return p;
};
function llCell(ll) {
  const p = L.CRS.EPSG3857.project(ll);
  const c = Math.floor((p.x - meta.mx0) / meta.cell), r = Math.floor((meta.my1 - p.y) / meta.cell);
  return r >= 0 && c >= 0 && r < rows && c < cols ? r * cols + c : -1;
}

/* ---------- UI ---------- */
function buildLayers() {
  const root = $('#layers'); root.textContent = '';
  const count = el('small', {});
  const more = el('details', { class: 'extras' }, el('summary', {}, 'More nearby things ', count));
  const showCount = () => { const n = LAYERS.filter((l) => l.extra && !l.away && S[l.id].on).length; count.textContent = n ? n + ' on' : 'optional'; };
  more.open = LAYERS.some((l) => l.extra && !l.away && S[l.id].on); showCount();
  for (const L_ of LAYERS) {
    if (L_.id === 'price' && !hasPrices) continue;
    const st = S[L_.id];
    const row = el('div', { class: 'layer', id: 'L-' + L_.id });
    const cb = el('input', { type: 'checkbox', 'aria-label': L_.label + ' layer' }); cb.checked = st.on;
    const val = el('span', { class: 'val' });
    const title = el('label', { class: 'title' }, cb, el('span', {}, L_.label), val);
    const body = el('div', { class: 'body' });
    const sl = el('input', { type: 'range', min: L_.min, max: L_.maxv, step: L_.step, 'aria-label': L_.label + (L_.away ? ' minimum straight-line distance' : ' max walking distance') }); sl.value = st.max;
    body.append(sl);
    const showVal = () => { val.textContent = !st.on ? 'off' : L_.away ? 'at least ' + fmtM(st.max) : L_.id === 'price' ? 'up to ' + fmtMoney(st.max) : L_.id === 'high' && st.mode === 'zone' ? 'in zone' : 'within ' + fmtM(st.max); row.classList.toggle('off', !st.on); };
    cb.onchange = async () => {
      st.on = cb.checked;
      if (L_.extra && st.on) {
        val.textContent = 'loading…'; cb.disabled = true;
        try { await ensureExtra(L_.id); } catch (e) { st.on = cb.checked = false; }
        cb.disabled = false;
      }
      if (L_.extra) showCount();
      showVal(); schedule(); if (S.showPoi) drawPois();
    };
    sl.oninput = () => { st.max = +sl.value; showVal(); schedule(); };
    if (L_.id === 'supermarket') {
      const ch = el('div', { class: 'chips' });
      for (const b in BRAND_LABEL) {
        const i = el('input', { type: 'checkbox' }); i.checked = st.brands[b];
        i.onchange = () => { st.brands[b] = i.checked; schedule(); };
        ch.append(el('label', {}, i, BRAND_LABEL[b]));
      }
      body.append(ch);
    }
    if (L_.away) body.append(el('p', { class: 'note' }, 'Every school counts here, ranked or not, public or private. Measured in a straight line, since this is about noise and traffic rather than the walk.'));
    if (L_.id === 'price') {
      const s = el('select', { 'aria-label': 'Property type for the budget' });
      s.append(new Option('Median house price', 'house', false, st.kind === 'house'));
      s.append(new Option('Median unit price', 'unit', false, st.kind === 'unit'));
      s.onchange = () => { st.kind = s.value; schedule(); };
      body.append(s, el('p', { class: 'note' }, 'Uses the 2025 suburb median across all home sizes, so a 3 to 4 bedroom home will often cost more, and a suburb above budget can still have cheaper homes. Suburbs with no published median don’t pass.'));
    }
    if (L_.id === 'park') {
      const s = el('select', { 'aria-label': 'What counts as a decent park' });
      for (const k in TIERS) s.append(new Option(TIERS[k], k, false, k === st.tier));
      s.onchange = () => { st.tier = s.value; schedule(); drawParks(); };
      body.append(s);
    }
    if (L_.id === 'primary') {
      const s = el('select', { 'aria-label': 'Which primary schools count' });
      s.append(new Option('Any primary school', 'any', false, st.sector === 'any'));
      s.append(new Option('Government primary only', 'gov', false, st.sector === 'gov'));
      s.onchange = () => { st.sector = s.value; schedule(); };
      body.append(s);
    }
    if (L_.id === 'gym') {
      const ch = el('div', { class: 'stack' });
      for (const k in GYM_KINDS) {
        const i = el('input', { type: 'checkbox' }); i.checked = st.kinds[k];
        i.onchange = () => { st.kinds[k] = i.checked; schedule(); };
        ch.append(el('label', {}, i, el('span', {}, GYM_KINDS[k].label, el('small', {}, GYM_KINDS[k].hint))));
      }
      body.append(ch);
    }
    if (L_.id === 'train') {
      const ch = el('div', { class: 'chips' });
      for (const [k, lab] of [['metro', 'Metro'], ['vline', 'V/Line only stations']]) {
        const i = el('input', { type: 'checkbox' }); i.checked = st.lines[k];
        i.onchange = () => { st.lines[k] = i.checked; schedule(); };
        ch.append(el('label', {}, i, lab));
      }
      body.append(ch);
    }
    if (L_.id === 'high') {
      const seg = el('div', { class: 'seg small', role: 'group', 'aria-label': 'High school test' });
      const modes = { dist: 'Walk distance', zone: 'In its zone', both: 'Both' };
      const note = el('p', { class: 'note' });
      const setNote = () => {
        note.textContent = st.mode === 'dist' ? 'Living near a school doesn’t guarantee a place: zoned schools enrol by address and selective schools by exam.'
          : 'Uses 2027 zones. Private, selective and audition schools have no zone, so they don’t count here.';
      };
      for (const m in modes) {
        const b = el('button', { type: 'button' }, modes[m]);
        b.setAttribute('aria-pressed', st.mode === m);
        b.onclick = () => { st.mode = m; [...seg.children].forEach((x) => x.setAttribute('aria-pressed', x === b)); setNote(); showVal(); schedule(); };
        seg.append(b);
      }
      setNote();
      body.append(seg, note, schoolPicker());
    }
    body.append(el('div', { class: 'funnel' }, el('i', { id: 'bar-' + L_.id })), el('div', { class: 'fn', id: 'fn-' + L_.id }));
    row.append(title, body); (L_.extra && !L_.away ? more : root).append(row); showVal();
  }
  root.append(more);
}
function buildLand() {
  const lu = $('#landuse'); lu.textContent = '';
  for (const k in LAND) {
    const i = el('input', { type: 'checkbox' }); i.checked = S.land[k];
    i.onchange = () => { S.land[k] = i.checked; schedule(); };
    lu.append(el('label', { class: 'row' }, i, LAND[k]));
  }
}
/* A persona is the original defaults plus its changes, so switching never inherits leftovers from the last one. */
const personaState = (p) => merge(structuredClone(DEFAULTS), p.set);
const filterKey = (st) => JSON.stringify([LAYERS.map((l) => { const { schools, privTicked, ...x } = st[l.id]; return x; }), st.land]);
function showPersona() {
  const now = filterKey(S); let hit = null;
  for (const p of PERSONAS) { const on = filterKey(personaState(p)) === now; if (on) hit = p; document.getElementById('P-' + p.id).setAttribute('aria-pressed', on); }
  $('#personaHint').textContent = hit ? hit.hint : 'Your own mix. Pick a persona to start again from one.';
}
async function applyPersona(p) {
  const next = personaState(p);
  await Promise.all(LAYERS.filter((l) => l.extra && next[l.id].on).map((l) => ensureExtra(l.id).catch(() => { next[l.id].on = false; })));
  for (const k of ['view', 'opacity', 'minHa', 'showPoi', 'showParks', 'showZones']) next[k] = S[k];
  next.high.schools = S.high.schools; next.high.privTicked = S.high.privTicked;
  S = next; selPocket = -1;
  buildLayers(); buildLand(); schedule();
  if (S.showPoi) drawPois();
}
function buildPersonas() {
  const box = $('#personaBtns');
  for (const p of PERSONAS) { const b = el('button', { type: 'button', id: 'P-' + p.id }, p.label); b.onclick = () => applyPersona(p); box.append(b); }
}
function buildUI() {
  buildPersonas(); buildLayers(); buildLand();
  document.querySelectorAll('#view button').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.view === S.view);
    b.onclick = () => { S.view = b.dataset.view; document.querySelectorAll('#view button').forEach((x) => x.setAttribute('aria-pressed', x === b)); schedule(); };
  });
  const bind = (id, key, fn) => { const e = $(id); e.checked = S[key]; e.onchange = () => { S[key] = e.checked; fn(); saveState(); }; };
  bind('#showPoi', 'showPoi', () => { if (S.showPoi) drawPois(); else poiLayer.clearLayers(); });
  bind('#showParks', 'showParks', drawParks);
  bind('#showZones', 'showZones', drawZones);
  const op = $('#opacity'); op.value = S.opacity;
  op.oninput = () => { S.opacity = +op.value; map._grid.setOpacity(S.opacity / 100); saveState(); };
  const mh = $('#minHa'); mh.value = S.minHa; const mo = $('#minHaOut'); mo.textContent = S.minHa + ' ha';
  mh.oninput = () => { S.minHa = +mh.value; mo.textContent = S.minHa + ' ha'; schedule(); };
  $('#reset').onclick = () => { localStorage.removeItem('pocketfinder'); location.reload(); };
  $('#exportCsv').onclick = exportCsv;
  initSheet();
  if (S.showZones) drawZones();
  if (S.showParks) drawParks();
}

function schoolPicker() {
  const st = S.high; const wrap = el('div');
  const list = el('div', { id: 'schools' });
  const checks = new Map(), rows = new Map();
  const shown = (s) => st.sector === 'both' || isPublic(s) === (st.sector === 'public');
  const ticked = () => { const n = meta.schools.filter(shown).length; return chosenSchools().size + ' of ' + n + ' schools ticked'; };
  const apply = async () => {
    count.textContent = 'Loading schools…';
    try { await ensureFar(); count.textContent = ticked(); } catch (e) { count.textContent = 'Couldn’t load every school. Check your connection and try again.'; }
    rebuildSchools(); schedule(); if (S.showZones) drawZones(); if (S.showPoi) drawPois();
  };
  // A quick button only resets ticks within its own sector, so public and private choices stay independent.
  const setGroup = (inGroup, f) => {
    const keep = st.schools.filter((n) => !inGroup(schoolByName.get(n) || {}));
    st.schools = [...keep, ...meta.schools.filter((s) => inGroup(s) && f(s)).map((s) => s.name)];
    const on = new Set(st.schools); checks.forEach((c, n) => { c.checked = on.has(n); }); apply();
  };
  const seg = el('div', { class: 'seg small', role: 'group', 'aria-label': 'Public or private schools' });
  const qPub = el('div', { class: 'quick' }), qPriv = el('div', { class: 'quick' });
  const pub = { 'Top 10': (s) => s.rank <= 10, 'Top 30': (s) => s.on, 'Top 30, non-selective': (s) => s.on && !s.selective && !s.audition, 'Selective only': (s) => s.selective, 'All public': () => true };
  const priv = { 'All private': () => true, 'Catholic only': (s) => s.sector === 'Catholic', 'Independent only': (s) => s.sector === 'Independent' };
  for (const k in pub) { const b = el('button', { type: 'button' }, k); b.onclick = () => setGroup(isPublic, pub[k]); qPub.append(b); }
  for (const k in priv) { const b = el('button', { type: 'button' }, k); b.onclick = () => setGroup((s) => s.sector && !isPublic(s), priv[k]); qPriv.append(b); }
  const find = el('input', { type: 'search', class: 'schoolFind', placeholder: 'Find a school or suburb', 'aria-label': 'Find a school or suburb' });
  const filterRows = () => { const t = find.value.trim().toLowerCase(); rows.forEach((r, s) => { r.hidden = !shown(s) || !r.dataset.q.includes(t); }); };
  const showSector = () => {
    [...seg.children].forEach((x) => x.setAttribute('aria-pressed', x.dataset.v === st.sector));
    qPub.hidden = st.sector === 'private'; qPriv.hidden = st.sector === 'public'; filterRows();
  };
  for (const [v, lab] of [['public', 'Public'], ['private', 'Private'], ['both', 'Both']]) {
    const b = el('button', { type: 'button', 'data-v': v }, lab);
    b.onclick = () => { st.sector = v; showSector(); apply(); };
    seg.append(b);
  }
  for (const s of meta.schools) {
    const cb = el('input', { type: 'checkbox', 'aria-label': s.name }); cb.checked = st.schools.includes(s.name); checks.set(s.name, cb);
    cb.onchange = () => { const set = new Set(st.schools); if (cb.checked) set.add(s.name); else set.delete(s.name); st.schools = [...set]; apply(); };
    const badges = [];
    if (s.selective) badges.push(el('span', { class: 'badge sel' }, 'selective'));
    if (s.audition) badges.push(el('span', { class: 'badge sel' }, 'audition'));
    if (!isPublic(s)) badges.push(el('span', { class: 'badge' }, s.sector.toLowerCase()));
    if (s.gender !== 'co-ed') badges.push(el('span', { class: 'badge' }, s.gender));
    if (s.k9) badges.push(el('span', { class: 'badge' }, 'to Yr 9 only'));
    const vce = s.median ? ' · VCE median ' + s.median : '';
    const row = el('label', { class: 'sch', 'data-q': (s.name + ' ' + s.town).toLowerCase() }, cb, el('span', { class: 'rk' }, s.rank || '–'),
      el('span', { class: 'nm' }, s.name.replace(' Secondary College', ' SC').replace(' High School', ' HS'), ...badges, el('br'), el('span', { class: 'town' }, s.town + vce)));
    rows.set(s, row); list.append(row);
  }
  const count = el('p', { class: 'note' }, ticked());
  find.oninput = filterRows;
  wrap.append(seg, qPub, qPriv, find, list, count);
  showSector();
  return wrap;
}

function renderFunnel(act, cum, base) {
  LAYERS.forEach((L_) => { const b = $('#bar-' + L_.id); if (b) { b.style.width = '0'; $('#fn-' + L_.id).textContent = ''; } });
  act.forEach((a, k) => {
    const pct = base ? cum[k] / base * 100 : 0;
    $('#bar-' + a.id).style.width = pct.toFixed(1) + '%';
    $('#fn-' + a.id).textContent = (k === 0 ? 'Leaves ' : 'Still leaves ') + pct.toFixed(pct < 10 ? 1 : 0) + '% of residential land (' + (cum[k] / 400).toFixed(1) + ' km²)';
  });
  const left = act.length ? cum[act.length - 1] : base;
  const ha = pockets.reduce((t, p) => t + p.ha, 0);
  const sub = new Set(pockets.flatMap((p) => p.subs.filter((s) => s.share > 0.15).map((s) => s.name)));
  showPersona();
  $('#summary').innerHTML = `<b>${pockets.length.toLocaleString()} pockets</b><small>${(ha / 100).toFixed(1)} km² across ${sub.size} suburbs · ${base ? (left / base * 100).toFixed(1) : 0}% of residential land meets all ${act.length} layers</small>`;
}

/* Rough price for a pocket: suburb medians weighted by how much of the pocket is in each suburb. */
function pocketPrice(p, kind) {
  let v = 0, w = 0;
  for (const s of p.subs) { const d = subs.suburbs[meta.locs.indexOf(s.name)]; if (d && d[kind]) { v += d[kind] * s.share; w += s.share; } }
  return w >= 0.5 ? v / w : 0;
}
function renderPockets() {
  const ol = $('#pockets'); ol.textContent = '';
  $('#pocketCount').textContent = pockets.length ? `(${pockets.length})` : '';
  if (!pockets.length) { ol.append(el('li', { class: 'empty' }, 'No pockets at these settings. Relax a slider or lower the minimum size.')); return; }
  pockets.slice(0, 60).forEach((p, i) => {
    const names = p.subs.filter((s, j) => j === 0 || s.share > 0.2).slice(0, 3).map((s) => s.name).join(', ') || 'Unnamed';
    const li = el('li', { class: p.id === selPocket ? 'sel' : '' }, el('span', { class: 'n' }, i + 1), el('span', { class: 's' }, names, ...priceTag(p)), el('span', { class: 'a' }, p.ha >= 100 ? (p.ha / 100).toFixed(1) + ' km²' : Math.round(p.ha) + ' ha'));
    li.onclick = () => focusPocket(p);
    ol.append(li);
  });
  if (pockets.length > 60) ol.append(el('li', { class: 'empty' }, `…and ${pockets.length - 60} smaller pockets. Export CSV for the full list.`));
}
function priceTag(p) {
  const h = pocketPrice(p, 'house'), u = pocketPrice(p, 'unit');
  const t = [h && 'house ~' + fmtMoney(h), u && 'unit ~' + fmtMoney(u)].filter(Boolean).join(' · ');
  return t ? [el('small', { class: 'pr' }, t)] : [];
}
function focusPocket(p) {
  selPocket = p.id;
  if (isMobile()) setSheet('peek');
  map.fitBounds(L.latLngBounds(cellLL(p.r1 + 2, p.c0 - 2), cellLL(p.r0 - 2, p.c1 + 2)), { maxZoom: 15, paddingTopLeft: [30, 30], paddingBottomRight: [30, isMobile() ? $('#grab').offsetHeight + 30 : 30] });
  schedule();
  // popup at the member cell nearest the pocket's centre
  let best = -1, bd = 1e18;
  for (let r = p.r0; r <= p.r1; r++) for (let c = p.c0; c <= p.c1; c++) {
    const i = r * cols + c;
    if (labels[i] !== p.id) continue;
    const d = (r - p.r) ** 2 + (c - p.c) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0) setTimeout(() => openPopup(cellLL((best / cols) | 0, best % cols)), 350);
}
function renderLegend(K) {
  const lg = $('#legend'); if (!lg) return;
  if (S.view === 'all') {
    lg.innerHTML = `<div><i style="background:#0b7a5c"></i>Meets all layers</div><div><i style="background:rgba(11,122,92,.35)"></i>Smaller than ${S.minHa} ha</div><div><i style="background:#e66e00"></i>Selected pocket</div>`;
  } else {
    let h = '<div><i style="background:#0b7a5c"></i>All ' + K + ' layers</div>';
    for (let k = K - 1; k >= 1; k--) { const t = rampColor(k, K); h += `<div><i style="background:rgb(${t})"></i>${k} of ${K}</div>`; }
    lg.innerHTML = h;
  }
}

/* ---------- map extras ---------- */
function drawPois() {
  poiLayer.clearLayers();
  if (!S.showPoi) return;
  const b = map.getBounds().pad(0.1), z = map.getZoom();
  const add = (p, color, r, label) => {
    if (!b.contains([p.lat, p.lon])) return;
    L.circleMarker([p.lat, p.lon], { radius: r, color: '#fff', weight: 1, fillColor: color, fillOpacity: 1, interactive: true }).bindTooltip(esc(label)).addTo(poiLayer);
  };
  if (S.supermarket.on) for (const k in BRAND_LABEL) if (S.supermarket.brands[k]) pois[k].forEach((p) => add(p, BRAND_COLOR[k], 6, p.name || BRAND_LABEL[k]));
  if (z >= 12) {
    if (S.primary.on) { pois.primary_gov.forEach((p) => add(p, '#1971c2', 4, p.name)); if (S.primary.sector === 'any') pois.primary_nongov.forEach((p) => add(p, '#74a9e0', 4, p.name)); }
    if (S.gym.on) for (const k in GYM_KINDS) if (S.gym.kinds[k]) pois[k].forEach((p) => add(p, GYM_KINDS[k].color, 5, p.name));
    if (S.train.on) for (const k in TRAIN_KEYS) if (S.train.lines[k]) pois[TRAIN_KEYS[k]].forEach((p) => add(p, '#0b7285', 6, p.name));
  }
  if (z >= 14) for (const l of LAYERS) if (l.extra && S[l.id].on && pois[l.id]) pois[l.id].forEach((p) => add(p, l.color, 4, p.name || l.label));
  if (S.high.on) { const on = chosenSchools(); meta.schools.forEach((s) => { if (on.has(s.name)) add(s, '#7048e8', 7, schoolLabel(s)); }); }
}
async function drawParks() {
  if (parkLayer) { map.removeLayer(parkLayer); parkLayer = null; }
  if (!S.showParks || map.getZoom() < 13) return;
  if (!parksData) parksData = await (await getData('data/parks.geojson')).json();
  const t = S.park.tier, minHa = { park_05: 0.5, park_1: 1, park_green: 1, park_3: 3, park_10: 10, park_20: 20, park_play: 1 }[t];
  const fits = (p) => (t === 'park_play' ? p.play : t === 'park_green' || t === 'park_20' ? !p.sport : true);
  parkLayer = L.geoJSON(parksData, { filter: (f) => f.properties.ha >= minHa && fits(pois.parks[f.properties.i]), style: { color: '#2b8a3e', weight: 1, fillColor: '#2b8a3e', fillOpacity: 0.12 }, interactive: false }).addTo(map);
}
async function drawZones() {
  if (zoneLayer) { map.removeLayer(zoneLayer); zoneLayer = null; }
  if (!S.showZones) return;
  if (!zonesData) zonesData = await (await getData('data/zones.geojson')).json();
  const on = chosenSchools();
  zoneLayer = L.geoJSON(zonesData, { filter: (f) => on.has(f.properties.name), style: { color: '#7048e8', weight: 1.5, fillOpacity: 0.04, dashArray: '4 3' }, interactive: false, onEachFeature: undefined }).addTo(map);
}

/* ---------- inspect ---------- */
function nearest(keys, idxOf, i, labelFn) {
  let best = null;
  for (const k of keys) {
    const v = G[k][i];
    if (v === meta.nodata) continue;
    if (!best || v < best.v) best = { v, k };
  }
  if (!best) return null;
  const list = idxOf(best.k), id = SRC[best.k] ? SRC[best.k][i] : 0, p = id ? list[id - 1] : null;
  return { m: best.v * meta.step, capped: best.v >= meta.cap, name: p ? labelFn(p, best.k) : '', poi: p };
}
const schoolLabel = (s) => (s.rank ? `#${s.rank} ` : '') + s.name;
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
async function openPopup(ll) {
  const i = llCell(ll);
  if (i < 0) return;
  const st = S, on = (o) => Object.keys(o).filter((k) => o[k]);
  const brands = on(st.supermarket.brands), gyms = on(st.gym.kinds), trains = on(st.train.lines).map((k) => TRAIN_KEYS[k]);
  const prim = st.primary.sector === 'gov' ? ['primary_gov'] : ['primary_gov', 'primary_nongov'];
  const extrasOn = LAYERS.filter((l) => l.extra && st[l.id].on && pois[l.id]);
  await ensureSrc([...brands, ...gyms, ...trains, ...prim, st.park.tier, ...extrasOn.map((l) => l.id)]);
  const sub = G.loc[i] ? meta.locs[G.loc[i] - 1] : '';
  const rowsH = [];
  const line = (label, r, max, away) => {
    const ok = away ? !r || r.capped || r.m >= max : r && !r.capped && r.m <= max;
    let extra = '';
    if (r && r.name) extra += '<br><small>' + esc(r.name) + '</small>';
    if (r && r.poi && r.poi.addr) extra += '<br><small class="addr">' + esc(r.poi.addr) + '</small>';
    if (r && r.poi && safeUrl(r.poi.url)) extra += ` <small><a target="_blank" rel="noopener" href="${safeUrl(r.poi.url)}">website</a></small>`;
    rowsH.push(`<tr><td class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</td><td>${label}${extra}</td><td class="m">${r ? (r.capped ? '5 km+' : fmtM(r.m)) : 'n/a'}</td></tr>`);
  };
  line('Supermarket', nearest(brands, (k) => pois[k], i, (p, k) => p.name || BRAND_LABEL[k]), st.supermarket.max);
  line('Train station', nearest(trains, (k) => pois[k], i, (p) => p.name), st.train.max);
  line('Park', nearest([st.park.tier], () => pois.parks, i, (p) => (p.name || 'Unnamed reserve') + ` (${p.ha} ha${p.play ? ', playground' : p.sport ? ', sports ground' : ''})`), st.park.max);
  line('Primary school', nearest(prim, (k) => pois[k], i, (p) => p.name), st.primary.max);
  const r = (i / cols) | 0, c = i % cols, sel = chosenSchools();
  let hb = null; const zones = [];
  for (const s of meta.schools) {
    const w = s.win;
    if (sel.has(s.name) && r >= w.r0 && r < w.r0 + w.h && c >= w.c0 && c < w.c0 + w.w) {
      const blob = s.far ? hsFar : hsBlob;
      if (!blob) continue;
      const v = blob[w.off + (r - w.r0) * w.w + (c - w.c0)];
      if (v < meta.cap && (!hb || v < hb.v)) hb = { v, s };
    }
    const z = s.zone;
    if (z && r >= z.r0 && r < z.r0 + z.h && c >= z.c0 && c < z.c0 + z.w && zoneBlob[z.off + (r - z.r0) * z.w + (c - z.c0)]) zones.push(s);
  }
  line('High school', hb ? { m: hb.v * meta.step, name: schoolLabel(hb.s) + (hb.s.selective ? ' (selective)' : '') } : null, st.high.max);
  line('Gym', nearest(gyms, (k) => pois[k], i, (p, k) => `${p.name} · ${GYM_KINDS[k].label}`), st.gym.max);
  for (const l of extrasOn) line(l.label, nearest([l.id], (k) => pois[k], i, (p) => p.name || l.label), st[l.id].max, l.away);
  const sd = G.loc[i] ? subs.suburbs[G.loc[i] - 1] : null;
  const facts = [];
  if (sd && (sd.house || sd.unit)) facts.push(`<b>Median price, 2025:</b> ${[sd.house && 'house ' + fmtMoney(sd.house), sd.unit && 'unit ' + fmtMoney(sd.unit)].filter(Boolean).join(', ')}${sd.priceNote ? ' <small>(' + esc(sd.priceNote) + ')</small>' : ''}`);
  if (sd && (sd.houseQ || sd.unitQ)) facts.push(`<small>March quarter 2026: ${[sd.houseQ && `house ${fmtMoney(sd.houseQ)} (${sd.houseN} sales)`, sd.unitQ && `unit ${fmtMoney(sd.unitQ)} (${sd.unitN} sales)`].filter(Boolean).join(', ')}</small>`);
  if (sd && (sd.r3h || sd.r2f)) facts.push(`<b>Median weekly rent:</b> ${[sd.r3h && '3-bed house $' + sd.r3h, sd.r2f && '2-bed flat $' + sd.r2f].filter(Boolean).join(', ')}`);
  const zoneTxt = zones.length ? 'In the 2027 zone of: ' + zones.map((s) => esc(schoolLabel(s))).join(', ') : 'Not in a public high school zone';
  const q = encodeURIComponent(sub.toLowerCase()).replace(/%20/g, '+');
  const lat = ll.lat.toFixed(5), lon = ll.lng.toFixed(5);
  const html = `<div class="pop"><h3>${esc(sub || 'Unknown suburb')}</h3><table>${rowsH.join('')}</table><div class="facts">${facts.join('<br>')}</div><div class="z">${zoneTxt}</div>
    <div class="links"><a target="_blank" rel="noopener" href="https://www.realestate.com.au/buy/in-${q},+vic/list-1">Homes for sale</a>
    <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}">Google Maps</a>
    <a target="_blank" rel="noopener" href="https://www.findmyschool.vic.gov.au/">Check zone</a></div></div>`;
  const mobile = isMobile();
  L.popup({ maxWidth: Math.min(340, window.innerWidth - 36), minWidth: Math.min(270, window.innerWidth - 60), autoPanPaddingTopLeft: [8, 8], autoPanPaddingBottomRight: [8, mobile ? sheetVisible() + 8 : 8] }).setLatLng(ll).setContent(html).openOn(map);
}

/* ---------- phone bottom sheet ---------- */
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
const sheetVisible = () => { const p = $('#panel'); return Math.max(0, window.innerHeight - p.getBoundingClientRect().top); };
function sheetStops() { const h = window.innerHeight; return { peek: h - $('#grab').offsetHeight, half: Math.round(h * 0.45), full: Math.round(h * 0.08) }; }
let sheetState = 'peek', sheetDragging = false;
function setSheet(state, animate = true) {
  const p = $('#panel');
  if (!isMobile()) { p.style.transform = ''; return; }
  sheetState = state;
  p.classList.toggle('drag', !animate);
  p.style.transform = `translateY(${sheetStops()[state]}px)`;
  p.dataset.state = state;
  $('#grab').setAttribute('aria-expanded', state !== 'peek');
}
function initSheet() {
  const grab = $('#grab'), p = $('#panel');
  let y0 = null, t0 = 0, moved = false;
  grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; t0 = p.getBoundingClientRect().top; moved = false; grab.setPointerCapture(e.pointerId); sheetDragging = true; p.classList.add('drag'); });
  grab.addEventListener('pointermove', (e) => {
    if (y0 === null || !isMobile()) return;
    const d = e.clientY - y0;
    if (Math.abs(d) > 6) moved = true;
    const st = sheetStops();
    p.style.transform = `translateY(${Math.min(st.peek, Math.max(st.full, t0 + d))}px)`;
  });
  const end = () => {
    if (y0 === null) return;
    y0 = null;
    sheetDragging = false;
    p.classList.remove('drag');
    if (!isMobile()) return;
    if (!moved) { setSheet(sheetState === 'peek' ? 'half' : 'peek'); return; }
    const st = sheetStops(), top = p.getBoundingClientRect().top;
    setSheet(Object.keys(st).sort((a, b) => Math.abs(st[a] - top) - Math.abs(st[b] - top))[0]);
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
  grab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheet(sheetState === 'peek' ? 'half' : 'peek'); } });
  window.addEventListener('resize', () => { setSheet(sheetState, false); map.invalidateSize(); });
  setSheet('peek', false);
}

function exportCsv() {
  const lines = ['rank,suburbs,hectares,lat,lon,approx_median_house,approx_median_unit'];
  pockets.forEach((p, i) => {
    const ll = cellLL(p.r, p.c);
    lines.push([i + 1, '"' + p.subs.filter((s, j) => j === 0 || s.share > 0.2).map((s) => s.name).join('; ') + '"', p.ha.toFixed(1), ll.lat.toFixed(5), ll.lng.toFixed(5), Math.round(pocketPrice(p, 'house')) || '', Math.round(pocketPrice(p, 'unit')) || ''].join(','));
  });
  const a = el('a', { href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })), download: 'pockets.csv' });
  a.click();
}

init().catch((e) => { console.error(e); const l = $('#loading'); l.classList.add('err'); l.textContent = 'Could not load map data: ' + e.message; });
