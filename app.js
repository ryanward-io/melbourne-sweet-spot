'use strict';
/* Melbourne Sweet Spot. All filtering runs in the browser over precomputed walking-distance grids. */

/* The full filter set. On its own this is Ryan's house-hunting brief (type "walker" to get it); everyone else starts from a persona below. */
const DEFAULTS = {
  view: 'all', opacity: 75, minHa: 3, showPoi: false, showParks: false, showZones: false,
  land: { 1: true, 2: true, 3: true, 4: true },
  supermarket: { on: true, max: 800, brands: { woolworths: true, coles: true, aldi: true } },
  park: { on: true, max: 800, tier: 'park_1' },
  primary: { on: true, max: 1000, sector: 'any' },
  high: { on: true, max: 2000, mode: 'dist', schools: null, sector: 'public', privTicked: false },
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
  { id: 'price', label: 'Budget', min: 400000, maxv: 5000000, step: 50000, color: '#2f9e44', more: true },
];
// Optional filters: off to start, and only downloaded when switched on.
const EXTRAS = [
  ['cafe', 'Café', '#a0522d'], ['restaurant', 'Restaurant', '#e67700'], ['pub_bar', 'Pub or bar', '#9c36b5'],
  ['gp', 'GP clinic', '#e03131'], ['pharmacy', 'Pharmacy', '#0ca678'], ['childcare', 'Childcare or kinder', '#f59f00'],
  ['library', 'Public library', '#4263eb'], ['tram', 'Tram stop', '#66a80f'], ['pool', 'Public pool', '#1098ad'], ['beach', 'Beach', '#d4a017'],
];
for (const [id, label, color] of EXTRAS) { DEFAULTS[id] = { on: false, max: 1500 }; LAYERS.push({ id, label, color, extra: true, more: true, min: 200, maxv: 3000, step: 50 }); }
// Keep-away filters pass when the nearest place is at least this far, in a straight line.
DEFAULTS.away_school = { on: false, max: 500 };
LAYERS.push({ id: 'away_school', label: 'Away from schools', color: '#868e96', extra: true, more: true, away: true, min: 200, maxv: 1500, step: 50 });
const LAYER = Object.fromEntries(LAYERS.map((l) => [l.id, l]));

// Personas are changes from DEFAULTS. Anything a persona doesn't mention stays as DEFAULTS has it.
const PERSONAS = [
  { id: 'all', label: 'All-rounder', hint: 'A supermarket, train station and decent park, all within walking distance.', set: {
    primary: { on: false }, high: { on: false }, gym: { on: false } } },
  { id: 'family', label: 'Young family', hint: 'Playground, primary school, childcare and a GP nearby. High schools can wait.', set: {
    high: { on: false }, gym: { on: false }, train: { max: 1000 }, park: { tier: 'park_play' }, childcare: { on: true }, gp: { on: true } } },
  { id: 'teens', label: 'Family with teens', hint: 'In a top high school’s zone, with a train and library nearby.', set: {
    primary: { on: false }, high: { mode: 'zone' }, library: { on: true } } },
  { id: 'dinks', label: 'Couple, no kids', hint: 'At least 500 m from any school. Cafés, restaurants, a pub, a gym and a train.', set: {
    primary: { on: false }, high: { on: false }, park: { tier: 'park_05' }, gym: { max: 800 }, cafe: { on: true, max: 800 }, restaurant: { on: true, max: 800 }, pub_bar: { on: true, max: 800 }, away_school: { on: true } } },
  { id: 'nature', label: 'Nature lovers', hint: 'A 20 ha park or reserve within 500 m, and nothing else matters.', set: {
    supermarket: { on: false }, train: { on: false }, primary: { on: false }, high: { on: false }, gym: { on: false }, park: { tier: 'park_20', max: 500 } } },
  { id: 'downsizers', label: 'Downsizers', hint: 'GP, pharmacy, café and library close by, at least 500 m from any school.', set: {
    primary: { on: false }, high: { on: false }, gym: { on: false }, gp: { on: true, max: 800 }, pharmacy: { on: true, max: 800 }, cafe: { on: true, max: 800 }, library: { on: true }, away_school: { on: true } } },
  { id: 'beach', label: 'Beach life', hint: 'The beach within 800 m, with a coffee and a train not far away.', set: {
    primary: { on: false }, high: { on: false }, gym: { on: false }, park: { on: false }, train: { max: 1500 }, supermarket: { max: 1500 }, beach: { on: true, max: 800 }, cafe: { on: true, max: 800 } } },
];
// Easter egg: typing "walker" (or opening #walker) loads Ryan's own brief.
const WALKER = { id: 'walker', hint: 'You found it. These are the settings I used for my own house hunt.', set: {} };

const LAND = { 1: 'Residential zones', 2: 'Low-density / rural living', 3: 'Commercial & activity centres (apartments)', 4: 'Urban growth (new estates)' };
const TIERS = { park_05: 'Any park 0.5 ha or more', park_1: 'Park 1 ha or more (about 1.5 soccer pitches)', park_green: 'Park 1 ha or more, not just sports grounds', park_3: 'Park 3 ha or more', park_10: 'Big park 10 ha or more', park_20: 'Very big park 20 ha or more, not just sports grounds', park_play: 'Park 1 ha or more with a playground' };
const TIER_SHORT = { park_05: '0.5 ha+', park_1: '1 ha+', park_green: '1 ha+, not sports grounds', park_3: '3 ha+', park_10: '10 ha+', park_20: '20 ha+', park_play: '1 ha+ with a playground' };
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
const HIGH_MODES = { dist: 'Walk distance', zone: 'In its zone', both: 'Both' };

let S, meta, pois, N, cols, rows;
const G = {};            // decoded rasters
const SRC = {};          // nearest-source rasters, loaded when something is tapped
let cand, hsMin, zoneAny, hsBlob, hsFar, zoneBlob;
let labels, pockets = [], selPocket = -1, subs, SUB, hasPrices = false;
let canvas, ctx, img, px32, map, poiLayer, zoneLayer, parkLayer, selLayer, parksData, zonesData;
const valFns = {};       // per-layer refresh for the value label
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (s) => document.querySelector(s);
const el = (t, a = {}, ...kids) => { const e = document.createElement(t); for (const k in a) { if (k === 'class') e.className = a[k]; else e.setAttribute(k, a[k]); } e.append(...kids); return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMoney = (v) => (v >= 1e6 ? '$' + (v / 1e6).toFixed(2).replace(/0$/, '') + 'm' : '$' + Math.round(v / 1000) + 'k');
const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1) + ' km' : m + ' m');
const plural = (n, one, many) => n.toLocaleString() + ' ' + (n === 1 ? one : many);

/* ---------- settings ---------- */
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const merge = (to, from) => { for (const k of Object.keys(from)) { if (BAD_KEYS.has(k)) continue; if (isObj(to[k]) && isObj(from[k])) merge(to[k], from[k]); else to[k] = from[k]; } return to; };
/* Copy saved values over the defaults, but only for keys the defaults know and only with the same type, so stored junk can't leak into the page. */
function adopt(d, saved) {
  for (const k of Object.keys(saved)) {
    if (BAD_KEYS.has(k) || !Object.hasOwn(d, k)) continue;
    const a = d[k], b = saved[k];
    if (isObj(a)) { if (isObj(b)) adopt(a, b); }
    else if (a === null || Array.isArray(a)) { if (b === null || (Array.isArray(b) && b.every((x) => typeof x === 'string'))) d[k] = b; }
    else if (typeof a === typeof b && (typeof b !== 'number' || Number.isFinite(b))) d[k] = b;
  }
}
const personaState = (p) => merge(structuredClone(DEFAULTS), p.set);
function loadState() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('pocketfinder') || '{}'); } catch (e) { /* ignore corrupt or blocked storage */ }
  const d = personaState(PERSONAS[0]);
  if (isObj(saved)) adopt(d, saved);
  return d;
}
const saveState = () => { try { localStorage.setItem('pocketfinder', JSON.stringify(S)); } catch (e) { /* storage may be blocked */ } };

/* ---------- loading ---------- */
/* Static hosts occasionally drop a request with a 5xx; retry twice so one blip doesn't stop the map loading. */
async function getData(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status < 500 || attempt >= 2) return r;
    } catch (e) { if (attempt >= 2) throw e; }
    await new Promise((ok) => setTimeout(ok, 700 * (attempt + 1)));
  }
}
async function getJSON(url) { const r = await getData(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
async function gz(path) {
  const r = await getData('data/' + path);
  if (!r.ok) throw new Error(path + ' ' + r.status);
  const st = r.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(st).arrayBuffer();
}
const once = (cache, key, fn) => (cache[key] ||= fn().catch((e) => { delete cache[key]; throw e; }));

const rasterLoading = {};
const ensureRaster = (k) => (G[k] ? Promise.resolve() : once(rasterLoading, k, () => gz(k + '.u8.gz').then((b) => { G[k] = new Uint8Array(b); })));
const extraLoading = {};
const ensureExtra = (id) => once(extraLoading, id, () => Promise.all([ensureRaster(id), getJSON('data/poi_' + id + '.json').then((p) => { pois[id] = p; })]));
const highLoading = {};
const ensureHigh = () => once(highLoading, 'base', () => Promise.all([
  gz('highschools.u8.gz').then((b) => { hsBlob = new Uint8Array(b); }),
  gz('zones.u8.gz').then((b) => { zoneBlob = new Uint8Array(b); }),
]).then(() => rebuildSchools()));
/* Only the top schools ship in the main file. Picking any other school fetches the rest. */
const needFar = () => [...chosenSchools()].some((n) => schoolByName.get(n).far);
const ensureFar = () => (hsFar || !needFar() ? Promise.resolve() : once(highLoading, 'far', () => gz('highschools_all.u8.gz').then((b) => { hsFar = new Uint8Array(b); })));

/* Which grids a filter needs with its current options. Only these get downloaded. */
function rasterKeys(id) {
  const st = S[id], on = (o) => Object.keys(o).filter((k) => o[k]);
  if (id === 'supermarket') return on(st.brands);
  if (id === 'train') return on(st.lines).map((k) => TRAIN_KEYS[k]);
  if (id === 'park') return [st.tier];
  if (id === 'primary') return st.sector === 'gov' ? ['primary_gov'] : ['primary_gov', 'primary_nongov'];
  if (id === 'gym') return on(st.kinds);
  return [];
}
function ready(id) {
  if (LAYER[id].extra) return !!G[id] && !!pois[id];
  if (id === 'high') return !!hsBlob && !!zoneBlob && (hsFar || !needFar());
  return rasterKeys(id).every((k) => G[k]);
}
async function ensureLayer(id) {
  if (LAYER[id].extra) return ensureExtra(id);
  if (id === 'high') { await ensureHigh(); if (needFar()) { await ensureFar(); rebuildSchools(); } return; }
  await Promise.all(rasterKeys(id).map(ensureRaster));
}
function failLayer(id) {
  S[id].on = false;
  const row = document.getElementById('L-' + id);
  if (row) { row.querySelector('.title input').checked = false; document.getElementById('err-' + id).textContent = 'Couldn’t load this one. Tick it again to retry.'; }
}
async function ensureActive() {
  const need = LAYERS.filter((l) => S[l.id].on && !ready(l.id));
  if (!need.length) return;
  busy(true);
  need.forEach((l) => valFns[l.id]?.());
  await Promise.all(need.map((l) => ensureLayer(l.id).catch(() => failLayer(l.id))));
  busy(false);
  LAYERS.forEach((l) => valFns[l.id]?.());
}
let busyN = 0;
function busy(on) {
  busyN += on ? 1 : -1;
  const b = $('#loading');
  if (!b || b.classList.contains('err') || b.dataset.boot) return;
  b.hidden = busyN <= 0;
  b.firstElementChild.textContent = 'Loading…';
}
function showLoadError() {
  const l = $('#loading'); l.hidden = false; l.classList.add('err'); delete l.dataset.boot;
  const retry = el('button', { type: 'button', class: 'link' }, 'Try again');
  retry.onclick = () => location.reload();
  l.textContent = '';
  l.append(el('span', {}, 'Couldn’t load the map data. Check your connection and '), retry, '.');
}

const schoolByName = new Map();
const isPublic = (s) => s.sector === 'Government';
/* Ticks are kept for every school; the public/private switch decides which of them count. */
function chosenSchools() {
  const sec = S.high.sector;
  return new Set(S.high.schools.filter((n) => { const s = schoolByName.get(n); return s && (sec === 'both' || isPublic(s) === (sec === 'public')); }));
}

async function init() {
  meta = await getJSON('data/meta.json');
  ({ cols, rows } = meta); N = cols * rows;
  meta.schools.forEach((s) => schoolByName.set(s.name, s));
  S = loadState();
  if (location.hash === '#walker') S = walkerState();
  if (!S.high.schools) S.high.schools = meta.schools.filter((s) => s.on).map((s) => s.name);
  // Private schools aren't ranked, so all of them start ticked; the switch keeps them out until chosen.
  if (!S.high.privTicked) { S.high.schools = [...new Set([...S.high.schools, ...meta.schools.filter((s) => !isPublic(s)).map((s) => s.name)])]; S.high.privTicked = true; }
  initMap();   // show the base map straight away while the grids download

  let done = 0; const total = 4;
  const tick = () => { $('#loadPct').textContent = Math.round(++done / total * 100) + '%'; };
  const [sb, p, res, loc] = await Promise.all([
    getJSON('data/suburbs.json').finally(tick), getJSON('data/pois.json').finally(tick),
    gz('res.u8.gz').finally(tick), gz('loc.u16.gz').finally(tick),
  ]);
  subs = sb; pois = p; G.res = new Uint8Array(res); G.loc = new Uint16Array(loc);
  const subArr = (k) => Int32Array.from([0, ...subs.suburbs.map((d) => d[k] || 0)]);
  SUB = { house: subArr('house'), unit: subArr('unit') };
  hasPrices = SUB.house.some((v) => v > 0);

  const c = []; for (let i = 0; i < N; i++) if (G.res[i]) c.push(i);
  cand = Int32Array.from(c);
  hsMin = new Uint8Array(N).fill(meta.cap); zoneAny = new Uint8Array(N); labels = new Int32Array(N);

  buildUI();
  $('#loadMsg').textContent = 'Loading filters…'; $('#loadPct').textContent = '';
  await ensureActive();
  const l = $('#loading'); delete l.dataset.boot; l.hidden = true;
  schedule();
  const [y, m, d] = meta.built.split('-').map(Number);
  $('#built').textContent = 'Data built ' + new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* Nearest-place lookups are only needed when something is tapped, so they load on demand to spare phone memory. */
const srcLoading = {};
const ensureSrc = (keys) => Promise.all(keys.map((k) => once(srcLoading, k, () => gz(k + '.src.gz').then((b) => { SRC[k] = new Uint16Array(b); })).catch(() => {})));

function initMap() {
  map = L.map('map', { zoomControl: !L.Browser.mobile, maxZoom: 18, minZoom: 9, preferCanvas: true, zoomAnimation: !reduceMotion, fadeAnimation: !reduceMotion, markerZoomAnimation: !reduceMotion }).setView([-37.84, 145.05], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
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
  map.on('click', (e) => { if (cand) openPopup(e.latlng); });
  map.on('zoomend moveend', () => { if (S.showPoi && pois) drawPois(); });
  map.on('zoomend', drawParks);
  // Enter on the focused map opens the details for its centre, so the map works without a mouse.
  map.getContainer().addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === map.getContainer() && cand) { e.preventDefault(); openPopup(map.getCenter(), true); }
  });
  map.getContainer().setAttribute('aria-label', 'Map. Press Enter for what’s close to the centre.');
  map.on('popupclose', () => {
    if (!returnFocus) return;
    const b = document.querySelector(`#pockets button[data-id="${returnFocus}"]`); returnFocus = null;
    if (b) b.focus(); else map.getContainer().focus();
  });
  const legendCtl = L.control({ position: 'bottomright' });
  legendCtl.onAdd = () => {
    const box = el('div', { class: 'legend' });
    const seg = el('div', { class: 'seg mini', role: 'group', 'aria-label': 'Map view', id: 'view' });
    for (const [v, lab] of [['all', 'Ticks all'], ['count', 'Ticks some']]) {
      const b = el('button', { type: 'button', 'data-view': v }, lab);
      b.setAttribute('aria-pressed', S.view === v);
      b.onclick = () => { S.view = v; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); schedule(); };
      seg.append(b);
    }
    box.append(seg, el('div', { id: 'legend' }));
    L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box);
    return box;
  };
  legendCtl.addTo(map);
}

/* ---------- criteria ---------- */
function activeLayers() {
  const a = [];
  for (const L_ of LAYERS) {
    const st = S[L_.id];
    if (!st.on || !ready(L_.id)) continue;
    const q = Math.round(st.max / meta.step);
    if (L_.id === 'price') { if (hasPrices) a.push({ id: L_.id, sub: SUB[st.kind], q: st.max }); continue; }
    if (L_.id === 'high') { a.push({ id: L_.id, hs: true, mode: st.mode, q }); continue; }
    a.push({ id: L_.id, arrs: (L_.extra ? [L_.id] : rasterKeys(L_.id)).map((k) => G[k]), q, away: L_.away });
  }
  return a;
}
function rebuildSchools() {
  if (!hsMin) return;
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
    if (z && zoneBlob) for (let r = 0; r < z.h; r++) {
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
let queued = false;
/* Load whatever the current filters need, then redraw on the next frame. */
function schedule() {
  if (queued || !cand) return;
  queued = true;
  ensureActive().finally(() => requestAnimationFrame(() => { queued = false; compute(); }));
}
const RGBA = (r, g, b, a) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
const C_MATCH = RGBA(11, 122, 92, 255), C_SEL = RGBA(230, 110, 0, 255), C_SMALL = RGBA(11, 122, 92, 90);
// Near-misses run from amber to teal, dark enough to read against the grey base map, ending next to the full-match green.
const RAMP = [[196, 120, 0], [150, 130, 0], [80, 135, 50], [30, 120, 110]];
function rampColor(k, K) {
  const t = (K > 2 ? (k - 1) / (K - 2) : 1) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
  return RAMP[i].map((v, j) => Math.round(v + (RAMP[i + 1][j] - v) * f));
}

function compute() {
  if (LAYERS.some((l) => S[l.id].on && !ready(l.id))) { schedule(); return; }
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
      if (!v || K === 0) continue;
      const k = v - 1;
      if (k === K) { px32[i] = C_MATCH; continue; }
      if (k === 0) continue;
      const t = rampColor(k, K);
      px32[i] = RGBA(t[0], t[1], t[2], 235);
    }
  }
  ctx.putImageData(img, 0, 0);
  renderFunnel(act, cum, base);
  renderSummary(act, base);
  renderPockets();
  renderLegend(K);
  drawSelection();
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
  return L.CRS.EPSG3857.unproject(L.point(x, y));
};
function llCell(ll) {
  const p = L.CRS.EPSG3857.project(ll);
  const c = Math.floor((p.x - meta.mx0) / meta.cell), r = Math.floor((meta.my1 - p.y) / meta.cell);
  return r >= 0 && c >= 0 && r < rows && c < cols ? r * cols + c : -1;
}

/* ---------- UI ---------- */
function valText(L_) {
  const st = S[L_.id];
  if (!st.on) return 'off';
  if (!ready(L_.id)) return 'loading…';
  if (L_.away) return 'at least ' + fmtM(st.max);
  if (L_.id === 'price') return 'up to ' + fmtMoney(st.max);
  if (L_.id === 'high' && st.mode === 'zone') return 'in zone';
  return 'within ' + fmtM(st.max);
}
/* The one-line summary shown next to "Options", so the current choice is visible without opening it. */
function optText(id) {
  const st = S[id], on = (o) => Object.keys(o).filter((k) => o[k]);
  if (id === 'supermarket') { const b = on(st.brands); return b.length === 3 ? 'any of the big three' : b.map((k) => BRAND_LABEL[k]).join(', ') || 'none'; }
  if (id === 'train') return st.lines.metro && st.lines.vline ? 'Metro and V/Line' : st.lines.metro ? 'Metro only' : st.lines.vline ? 'V/Line only' : 'none';
  if (id === 'park') return TIER_SHORT[st.tier];
  if (id === 'primary') return st.sector === 'gov' ? 'government only' : 'any';
  if (id === 'gym') return plural(on(st.kinds).length, 'type', 'types');
  if (id === 'high') return HIGH_MODES[st.mode].toLowerCase() + ' · ' + chosenSchools().size + ' schools';
  if (id === 'price') return st.kind === 'house' ? 'houses' : 'units';
  return '';
}
function buildLayers() {
  const root = $('#layers'); root.textContent = '';
  const count = el('small', {});
  const more = el('details', { class: 'extras' }, el('summary', {}, 'More filters ', count));
  const showCount = () => { const n = LAYERS.filter((l) => l.more && S[l.id].on).length; count.textContent = n ? n + ' on' : 'budget, cafés, GPs, beaches…'; };
  more.open = LAYERS.some((l) => l.more && S[l.id].on); showCount();
  for (const L_ of LAYERS) {
    if (L_.id === 'price' && !hasPrices) continue;
    const st = S[L_.id];
    const row = el('div', { class: 'layer', id: 'L-' + L_.id, role: 'group', 'aria-labelledby': 't-' + L_.id });
    const cb = el('input', { type: 'checkbox' }); cb.checked = st.on;
    const val = el('span', { class: 'val' });
    const title = el('h3', { class: 'title' }, el('label', { id: 't-' + L_.id }, cb, el('span', {}, L_.label), val));
    const err = el('p', { class: 'note warn', id: 'err-' + L_.id });
    const body = el('div', { class: 'body' });
    const sl = el('input', { type: 'range', min: L_.min, max: L_.maxv, step: L_.step, 'aria-label': L_.label + (L_.away ? ' minimum straight-line distance' : L_.id === 'price' ? ' budget' : ' maximum walking distance'), 'aria-describedby': 'fn-' + L_.id }); sl.value = st.max;
    body.append(sl, el('div', { class: 'funnel' }, el('i', { id: 'bar-' + L_.id })), el('div', { class: 'fn', id: 'fn-' + L_.id }));
    const opts = el('div', { class: 'optbody' });
    const optSum = el('small', {});
    const showOpt = () => { optSum.textContent = optText(L_.id); };
    const changed = () => { showOpt(); schedule(); };
    const showVal = () => { val.textContent = valText(L_); sl.setAttribute('aria-valuetext', val.textContent); row.classList.toggle('off', !st.on); showOpt(); };
    valFns[L_.id] = showVal;
    cb.onchange = () => {
      st.on = cb.checked; err.textContent = '';
      showCount(); showVal(); schedule(); if (S.showPoi) drawPois();
    };
    sl.oninput = () => { st.max = +sl.value; showVal(); schedule(); };
    if (L_.id === 'supermarket') {
      const ch = el('div', { class: 'chips' });
      for (const b in BRAND_LABEL) {
        const i = el('input', { type: 'checkbox' }); i.checked = st.brands[b];
        i.onchange = () => { st.brands[b] = i.checked; changed(); };
        ch.append(el('label', {}, i, BRAND_LABEL[b]));
      }
      opts.append(el('fieldset', { class: 'plain' }, el('legend', { class: 'sr-only' }, 'Supermarket brands'), ch));
    }
    if (L_.away) body.append(el('p', { class: 'note' }, 'Straight-line distance to any school, public or private, since this is about noise and traffic.'));
    if (L_.id === 'price') {
      const s = el('select', { 'aria-label': 'Property type for the budget' });
      s.append(new Option('Median house price', 'house', false, st.kind === 'house'));
      s.append(new Option('Median unit price', 'unit', false, st.kind === 'unit'));
      s.onchange = () => { st.kind = s.value; changed(); };
      body.append(s, el('p', { class: 'note' }, '2025 suburb median across all home sizes, so a family home will often cost more. Suburbs with no median don’t pass.'));
    }
    if (L_.id === 'park') {
      const s = el('select', { 'aria-label': 'What counts as a decent park' });
      for (const k in TIERS) s.append(new Option(TIERS[k], k, false, k === st.tier));
      s.onchange = () => { st.tier = s.value; changed(); drawParks(); };
      opts.append(s);
    }
    if (L_.id === 'primary') {
      const s = el('select', { 'aria-label': 'Which primary schools count' });
      s.append(new Option('Any primary school', 'any', false, st.sector === 'any'));
      s.append(new Option('Government primary only', 'gov', false, st.sector === 'gov'));
      s.onchange = () => { st.sector = s.value; changed(); };
      opts.append(s);
    }
    if (L_.id === 'gym') {
      const ch = el('div', { class: 'stack' });
      for (const k in GYM_KINDS) {
        const i = el('input', { type: 'checkbox' }); i.checked = st.kinds[k];
        i.onchange = () => { st.kinds[k] = i.checked; changed(); };
        ch.append(el('label', {}, i, el('span', {}, GYM_KINDS[k].label, el('small', {}, GYM_KINDS[k].hint))));
      }
      opts.append(el('fieldset', { class: 'plain' }, el('legend', { class: 'sr-only' }, 'Kinds of gym'), ch));
    }
    if (L_.id === 'train') {
      const ch = el('div', { class: 'chips' });
      for (const [k, lab] of [['metro', 'Metro'], ['vline', 'Regional (V/Line) stations']]) {
        const i = el('input', { type: 'checkbox' }); i.checked = st.lines[k];
        i.onchange = () => { st.lines[k] = i.checked; changed(); };
        ch.append(el('label', {}, i, lab));
      }
      opts.append(el('fieldset', { class: 'plain' }, el('legend', { class: 'sr-only' }, 'Train lines'), ch));
    }
    if (L_.id === 'high') {
      const seg = el('div', { class: 'seg small', role: 'group', 'aria-label': 'High school test' });
      const note = el('p', { class: 'note' });
      const setNote = () => {
        note.textContent = st.mode === 'dist' ? 'Living nearby doesn’t guarantee a place: zoned schools enrol by address, selective ones by exam.'
          : 'Uses 2027 zones. Private, selective and audition schools have no zone, so they don’t count here.';
      };
      for (const m in HIGH_MODES) {
        const b = el('button', { type: 'button' }, HIGH_MODES[m]);
        b.setAttribute('aria-pressed', st.mode === m);
        b.onclick = () => { st.mode = m; [...seg.children].forEach((x) => x.setAttribute('aria-pressed', x === b)); setNote(); showVal(); schedule(); };
        seg.append(b);
      }
      setNote();
      body.append(note);
      opts.append(seg, schoolPicker(showOpt));
    }
    if (opts.childElementCount) body.append(el('details', { class: 'opts' }, el('summary', {}, 'Options ', optSum), opts));
    row.append(title, err, body); (L_.more ? more : root).append(row); showVal();
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
const walkerState = () => personaState(WALKER);
const filterKey = (st) => JSON.stringify([LAYERS.map((l) => { const { schools, privTicked, sector, ...x } = st[l.id]; return l.id === 'primary' ? { ...x, sector } : x; }), st.land]);
function showPersona() {
  const now = filterKey(S); let hit = null;
  for (const p of PERSONAS) { const on = filterKey(personaState(p)) === now; if (on) hit = p; document.getElementById('P-' + p.id).setAttribute('aria-pressed', on); }
  if (!hit && filterKey(walkerState()) === now) hit = WALKER;
  $('#personaHint').textContent = hit ? hit.hint : 'Your own mix. Tap a persona to go back to it.';
}
function applyPersona(p) {
  const next = personaState(p);
  for (const k of ['view', 'opacity', 'minHa', 'showPoi', 'showParks', 'showZones']) next[k] = S[k];
  next.high.schools = S.high.schools; next.high.privTicked = S.high.privTicked; next.high.sector = S.high.sector;
  S = next; selPocket = -1;
  buildLayers(); buildLand(); schedule();
  if (S.showPoi) drawPois();
}
function buildPersonas() {
  const box = $('#personaBtns');
  for (const p of PERSONAS) { const b = el('button', { type: 'button', id: 'P-' + p.id }, p.label); b.onclick = () => applyPersona(p); box.append(b); }
}
function initEasterEgg() {
  let typed = '';
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.target.closest('input, select, textarea')) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === 'walker') { typed = ''; applyPersona(WALKER); announce('Walker settings loaded.'); }
  });
  window.addEventListener('hashchange', () => { if (location.hash === '#walker') applyPersona(WALKER); });
}
function startOver() {
  if (!confirm('Start over with the default filters? Your current settings will be cleared.')) return;
  try { localStorage.removeItem('pocketfinder'); } catch (e) { /* storage may be blocked */ }
  location.hash = ''; location.reload();
}
function buildUI() {
  buildPersonas(); buildLayers(); buildLand();
  const bind = (id, key, fn) => { const e = $(id); e.checked = S[key]; e.onchange = () => { S[key] = e.checked; fn(); saveState(); }; };
  bind('#showPoi', 'showPoi', () => { if (S.showPoi) drawPois(); else poiLayer.clearLayers(); });
  bind('#showParks', 'showParks', drawParks);
  bind('#showZones', 'showZones', drawZones);
  const op = $('#opacity'); op.value = S.opacity;
  op.oninput = () => { S.opacity = +op.value; map._grid.setOpacity(S.opacity / 100); saveState(); };
  const mh = $('#minHa'); mh.value = S.minHa; const mo = $('#minHaOut'); mo.textContent = S.minHa + ' ha';
  mh.oninput = () => { S.minHa = +mh.value; mo.textContent = S.minHa + ' ha'; mh.setAttribute('aria-valuetext', S.minHa + ' hectares'); schedule(); };
  $('#reset').onclick = startOver;
  $('#exportCsv').onclick = exportCsv;
  initSheet(); initEasterEgg();
  if (S.showZones) drawZones();
  if (S.showParks) drawParks();
}

function schoolPicker(onChange) {
  const st = S.high;
  const list = el('div', { id: 'schools', role: 'group', 'aria-label': 'Schools' });
  const checks = new Map(), rows = new Map();
  const shown = (s) => st.sector === 'both' || isPublic(s) === (st.sector === 'public');
  const ticked = () => chosenSchools().size + ' of ' + meta.schools.filter(shown).length + ' ticked';
  const sum = el('small', {}, ticked());
  const apply = async () => {
    count.textContent = 'Loading schools…';
    try { await ensureFar(); count.textContent = ''; } catch (e) { count.textContent = 'Couldn’t load every school. Check your connection and try again.'; }
    sum.textContent = ticked(); onChange();
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
    const cb = el('input', { type: 'checkbox' }); cb.checked = st.schools.includes(s.name); checks.set(s.name, cb);
    cb.onchange = () => { const set = new Set(st.schools); if (cb.checked) set.add(s.name); else set.delete(s.name); st.schools = [...set]; apply(); };
    const badges = [];
    if (s.selective) badges.push(el('span', { class: 'badge sel' }, 'selective'));
    if (s.audition) badges.push(el('span', { class: 'badge sel' }, 'audition'));
    if (!isPublic(s)) badges.push(el('span', { class: 'badge' }, s.sector.toLowerCase()));
    if (s.gender !== 'co-ed') badges.push(el('span', { class: 'badge' }, s.gender));
    if (s.k9) badges.push(el('span', { class: 'badge' }, 'to Yr 9 only'));
    const vce = s.median ? ' · VCE median ' + s.median : '';
    const row = el('label', { class: 'sch', 'data-q': (s.name + ' ' + s.town).toLowerCase() }, cb, el('span', { class: 'rk' }, s.rank ? '#' + s.rank : '–'),
      el('span', { class: 'nm' }, s.name.replace(' Secondary College', ' SC').replace(' High School', ' HS'), ...badges, el('br'), el('span', { class: 'town' }, s.town + vce)));
    rows.set(s, row); list.append(row);
  }
  const count = el('p', { class: 'note', role: 'status' });
  find.oninput = filterRows;
  const box = el('details', { class: 'schoolsBox' }, el('summary', {}, 'Choose schools ', sum),
    seg, qPub, qPriv, el('p', { class: 'note' }, '# is Better Education’s 2025 rank for public schools. It’s their own score, not a VCE ranking.'), find, list, count);
  showSector();
  return box;
}

function renderFunnel(act, cum, base) {
  LAYERS.forEach((L_) => { const b = document.getElementById('bar-' + L_.id); if (b) { b.style.width = '0'; document.getElementById('fn-' + L_.id).textContent = ''; } });
  act.forEach((a, k) => {
    const pct = base ? cum[k] / base * 100 : 0;
    const bar = document.getElementById('bar-' + a.id); if (!bar) return;
    bar.style.width = pct.toFixed(1) + '%';
    document.getElementById('fn-' + a.id).textContent = pct.toFixed(pct < 10 ? 1 : 0) + '% left';
  });
}
/* When nothing matches, name the filter that rules out the most land on its own. */
function tightestFilter(act) {
  let worst = null, least = Infinity;
  for (const a of act) {
    let n = 0;
    for (let j = 0; j < cand.length; j++) { const i = cand[j]; if (S.land[G.res[i]] && cellPass(a, i)) n++; }
    if (n < least) { least = n; worst = a; }
  }
  return worst ? LAYER[worst.id].label : null;
}
let announceT = 0;
const announce = (msg) => { clearTimeout(announceT); announceT = setTimeout(() => { $('#status').textContent = msg; }, 700); };
function renderSummary(act) {
  showPersona();
  const box = $('#summary'); box.textContent = '';
  if (!pockets.length) {
    const worst = act.length ? tightestFilter(act) : null;
    const again = el('button', { type: 'button', class: 'link' }, 'start over'); again.onclick = startOver;
    box.append(el('b', {}, 'No sweet spots'), el('small', {}, worst ? worst + ' rules out the most. Try relaxing it, or ' : 'Try relaxing a filter, or ', again, '.'));
    announce('No sweet spots at these settings.');
    return;
  }
  const sub = new Set(pockets.flatMap((p) => p.subs.filter((s) => s.share > 0.15).map((s) => s.name))).size;
  const head = plural(pockets.length, 'sweet spot', 'sweet spots');
  box.append(el('b', {}, head), el('small', {}, 'across ' + plural(sub, 'suburb', 'suburbs') + ' · ', el('span', { class: 'hint-desk' }, 'tap a green area to see what’s close'), el('span', { class: 'hint-phone' }, 'tap one, or drag up for filters')));
  announce(head + ' across ' + plural(sub, 'suburb', 'suburbs') + '.');
}

/* Rough price for a sweet spot: suburb medians weighted by how much of it is in each suburb. */
function pocketPrice(p, kind) {
  let v = 0, w = 0;
  for (const s of p.subs) { const d = subs.suburbs[meta.locs.indexOf(s.name)]; if (d && d[kind]) { v += d[kind] * s.share; w += s.share; } }
  return w >= 0.5 ? v / w : 0;
}
let returnFocus = null;
function renderPockets() {
  const ol = $('#pockets'); ol.textContent = '';
  $('#pocketCount').textContent = pockets.length ? `(${pockets.length})` : '';
  if (!pockets.length) { ol.append(el('li', { class: 'empty' }, 'No sweet spots at these settings. Relax a slider or lower the minimum size.')); return; }
  pockets.slice(0, 60).forEach((p, i) => {
    const names = p.subs.filter((s, j) => j === 0 || s.share > 0.2).slice(0, 3).map((s) => s.name).join(', ') || 'Unnamed';
    const size = p.ha >= 100 ? (p.ha / 100).toFixed(1) + ' km²' : Math.round(p.ha) + ' ha';
    const b = el('button', { type: 'button', 'data-id': p.id, 'aria-current': p.id === selPocket ? 'true' : 'false' },
      el('span', { class: 'n' }, i + 1), el('span', { class: 's' }, names, ...priceTag(p)), el('span', { class: 'a' }, size));
    b.onclick = (e) => focusPocket(p, e.detail === 0);
    ol.append(el('li', { class: p.id === selPocket ? 'sel' : '' }, b));
  });
  if (pockets.length > 60) ol.append(el('li', { class: 'empty' }, `…and ${pockets.length - 60} smaller sweet spots. Export CSV for the full list.`));
}
function priceTag(p) {
  const h = pocketPrice(p, 'house'), u = pocketPrice(p, 'unit');
  const t = [h && 'house ~' + fmtMoney(h), u && 'unit ~' + fmtMoney(u)].filter(Boolean).join(' · ');
  return t ? [el('small', { class: 'pr' }, 'Median ' + t)] : [];
}
function focusPocket(p, keyboard) {
  selPocket = p.id;
  if (isMobile()) setSheet('peek');
  map.fitBounds(L.latLngBounds(cellLL(p.r1 + 2, p.c0 - 2), cellLL(p.r0 - 2, p.c1 + 2)), { animate: !reduceMotion, maxZoom: 15, paddingTopLeft: [30, 30], paddingBottomRight: [30, isMobile() ? $('#top').offsetHeight + 30 : 30] });
  schedule();
  // popup at the member cell nearest the centre
  let best = -1, bd = 1e18;
  for (let r = p.r0; r <= p.r1; r++) for (let c = p.c0; c <= p.c1; c++) {
    const i = r * cols + c;
    if (labels[i] !== p.id) continue;
    const d = (r - p.r) ** 2 + (c - p.c) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0) setTimeout(async () => { await openPopup(cellLL((best / cols) | 0, best % cols), keyboard); if (keyboard) returnFocus = p.id; }, reduceMotion ? 0 : 350);
}
function drawSelection() {
  if (selLayer) { map.removeLayer(selLayer); selLayer = null; }
  const p = pockets.find((x) => x.id === selPocket);
  if (!p || S.view !== 'all') return;
  // An outline as well as the colour, so the selection doesn't rely on telling orange from green.
  selLayer = L.rectangle(L.latLngBounds(cellLL(p.r1 + 1, p.c0 - 1), cellLL(p.r0 - 1, p.c1 + 1)), { color: '#1d2a2e', weight: 2, dashArray: '6 4', fill: false, interactive: false }).addTo(map);
}
function renderLegend(K) {
  const lg = $('#legend'); if (!lg) return;
  const row = (bg, text) => `<div><i style="background:${bg}"></i>${esc(text)}</div>`;
  if (S.view === 'all') {
    lg.innerHTML = row('#0b7a5c', 'Ticks every box') + row('rgba(11,122,92,.35)', 'Smaller than ' + Number(S.minHa) + ' ha') + row('#e66e00', 'Selected (dashed box)');
  } else {
    let h = row('#0b7a5c', 'Ticks all ' + K);
    for (let k = K - 1; k >= 1; k--) h += row(`rgb(${rampColor(k, K)})`, k + ' of ' + K);
    lg.innerHTML = h;
  }
}

/* ---------- map extras ---------- */
function drawPois() {
  poiLayer.clearLayers();
  if (!S.showPoi || !pois) return;
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
  if (!S.showParks || map.getZoom() < 13 || !pois) return;
  if (!parksData) parksData = await getJSON('data/parks.geojson');
  const t = S.park.tier, minHa = { park_05: 0.5, park_1: 1, park_green: 1, park_3: 3, park_10: 10, park_20: 20, park_play: 1 }[t];
  const fits = (p) => (t === 'park_play' ? p.play : t === 'park_green' || t === 'park_20' ? !p.sport : true);
  parkLayer = L.geoJSON(parksData, { filter: (f) => f.properties.ha >= minHa && fits(pois.parks[f.properties.i]), style: { color: '#2b8a3e', weight: 1, fillColor: '#2b8a3e', fillOpacity: 0.12 }, interactive: false }).addTo(map);
}
async function drawZones() {
  if (zoneLayer) { map.removeLayer(zoneLayer); zoneLayer = null; }
  if (!S.showZones) return;
  if (!zonesData) zonesData = await getJSON('data/zones.geojson');
  const on = chosenSchools();
  zoneLayer = L.geoJSON(zonesData, { filter: (f) => on.has(f.properties.name), style: { color: '#7048e8', weight: 1.5, fillOpacity: 0.04, dashArray: '4 3' }, interactive: false }).addTo(map);
}

/* ---------- inspect ---------- */
function nearest(keys, idxOf, i, labelFn) {
  let best = null;
  for (const k of keys) {
    if (!G[k]) continue;
    const v = G[k][i];
    if (v === meta.nodata) continue;
    if (!best || v < best.v) best = { v, k };
  }
  if (!best) return null;
  const list = idxOf(best.k), id = SRC[best.k] ? SRC[best.k][i] : 0, p = id && list ? list[id - 1] : null;
  return { m: best.v * meta.step, capped: best.v >= meta.cap, name: p ? labelFn(p, best.k) : '', poi: p };
}
const schoolLabel = (s) => s.name + (s.rank ? ` (#${s.rank} public)` : '');
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
/* The popup only lists filters that are switched on, so its ticks always agree with the map. */
async function openPopup(ll, focus = false) {
  const i = llCell(ll);
  if (i < 0) return;
  const st = S;
  const lay = (id) => st[id].on && ready(id);
  const extrasOn = LAYERS.filter((l) => l.extra && lay(l.id));
  const keys = [];
  for (const id of ['supermarket', 'train', 'park', 'primary', 'gym']) if (lay(id)) keys.push(...rasterKeys(id));
  await Promise.all([ensureSrc([...keys, ...extrasOn.map((l) => l.id)]), ensureHigh().catch(() => {})]);
  const sub = G.loc[i] ? meta.locs[G.loc[i] - 1] : '';
  const rowsH = [];
  const line = (label, r, max, opt = {}) => {
    const ok = opt.ok ?? (opt.away ? !r || r.capped || r.m >= max : r && !r.capped && r.m <= max);
    let extra = '';
    if (r && r.name) extra += '<br><small>' + esc(r.name) + '</small>';
    if (r && r.poi && r.poi.addr) extra += '<br><small class="addr">' + esc(r.poi.addr) + '</small>';
    if (r && r.poi && safeUrl(r.poi.url)) extra += ` <small><a target="_blank" rel="noopener" href="${safeUrl(r.poi.url)}">website</a></small>`;
    const dist = opt.text ?? (r ? (r.capped ? '5 km+' : fmtM(r.m)) : 'n/a');
    rowsH.push(`<tr><td class="${ok ? 'ok' : 'no'}"><span aria-hidden="true">${ok ? '✓' : '✗'}</span><span class="sr-only">${ok ? 'Passes' : 'Fails'}</span></td><td>${esc(label)}${extra}</td><td class="m">${esc(dist)}</td></tr>`);
  };
  if (lay('supermarket')) line('Supermarket', nearest(rasterKeys('supermarket'), (k) => pois[k], i, (p, k) => p.name || BRAND_LABEL[k]), st.supermarket.max);
  if (lay('train')) line('Train station', nearest(rasterKeys('train'), (k) => pois[k], i, (p) => p.name), st.train.max);
  if (lay('park')) line('Park', nearest([st.park.tier], () => pois.parks, i, (p) => (p.name || 'Unnamed reserve') + ` (${p.ha} ha${p.play ? ', playground' : p.sport ? ', sports ground' : ''})`), st.park.max);
  if (lay('primary')) line('Primary school', nearest(rasterKeys('primary'), (k) => pois[k], i, (p) => p.name), st.primary.max);
  const r = (i / cols) | 0, c = i % cols, sel = chosenSchools();
  let hb = null; const zones = [];
  if (zoneBlob) for (const s of meta.schools) {
    const w = s.win;
    if (sel.has(s.name) && r >= w.r0 && r < w.r0 + w.h && c >= w.c0 && c < w.c0 + w.w) {
      const blob = s.far ? hsFar : hsBlob;
      if (blob) {
        const v = blob[w.off + (r - w.r0) * w.w + (c - w.c0)];
        if (v < meta.cap && (!hb || v < hb.v)) hb = { v, s };
      }
    }
    const z = s.zone;
    if (z && r >= z.r0 && r < z.r0 + z.h && c >= z.c0 && c < z.c0 + z.w && zoneBlob[z.off + (r - z.r0) * z.w + (c - z.c0)]) zones.push(s);
  }
  if (lay('high')) {
    const near = hb ? { m: hb.v * meta.step, name: schoolLabel(hb.s) + (hb.s.selective ? ', selective' : '') } : null;
    const inZone = zones.some((s) => sel.has(s.name));
    const distOk = !!near && near.m <= st.high.max;
    const mode = st.high.mode;
    if (mode === 'zone') line('High school zone', inZone ? { name: zones.filter((s) => sel.has(s.name)).map(schoolLabel).join(', ') } : null, 0, { ok: inZone, text: inZone ? 'in zone' : 'no' });
    else line('High school', near, st.high.max, { ok: mode === 'dist' ? distOk : distOk && inZone });
  }
  if (lay('gym')) line('Gym', nearest(rasterKeys('gym'), (k) => pois[k], i, (p, k) => `${p.name} · ${GYM_KINDS[k].label}`), st.gym.max);
  for (const l of extrasOn) line(l.label, nearest([l.id], (k) => pois[k], i, (p) => p.name || l.label), st[l.id].max, { away: l.away });
  const sd = G.loc[i] ? subs.suburbs[G.loc[i] - 1] : null;
  if (lay('price') && hasPrices) {
    const v = sd && sd[st.price.kind];
    line('Budget', null, 0, { ok: !!v && v <= st.price.max, text: v ? 'median ' + fmtMoney(v) : 'no median' });
  }
  const facts = [];
  if (sd && (sd.house || sd.unit)) facts.push(`<b>Median price, 2025:</b> ${[sd.house && 'house ' + fmtMoney(sd.house), sd.unit && 'unit ' + fmtMoney(sd.unit)].filter(Boolean).join(', ')}${sd.priceNote ? ' <small>(' + esc(sd.priceNote) + ')</small>' : ''}`);
  if (sd && (sd.houseQ || sd.unitQ)) facts.push(`<small>March quarter 2026: ${[sd.houseQ && `house ${fmtMoney(sd.houseQ)} (${sd.houseN} sales)`, sd.unitQ && `unit ${fmtMoney(sd.unitQ)} (${sd.unitN} sales)`].filter(Boolean).join(', ')}</small>`);
  if (sd && (sd.r3h || sd.r2f)) facts.push(`<b>Median weekly rent</b> <small>(Homes Victoria, by rental area)</small>: ${[sd.r3h && '3-bed house $' + sd.r3h, sd.r2f && '2-bed flat $' + sd.r2f].filter(Boolean).join(', ')}`);
  const zoneTxt = !zoneBlob ? '' : zones.length ? 'In the 2027 zone of: ' + zones.map((s) => esc(schoolLabel(s))).join(', ') : 'No zone found here, so check Find My School';
  const q = encodeURIComponent(sub.toLowerCase()).replace(/%20/g, '+');
  const lat = ll.lat.toFixed(5), lon = ll.lng.toFixed(5);
  const html = `<div class="pop"><h3 tabindex="-1">${esc(sub || 'Unknown suburb')}</h3>${rowsH.length ? `<table>${rowsH.join('')}</table>` : ''}<div class="facts">${facts.join('<br>')}</div><div class="z">${zoneTxt}</div>
    <div class="links"><a target="_blank" rel="noopener" href="https://www.realestate.com.au/buy/in-${q},+vic/list-1">Homes for sale</a>
    <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}">Google Maps</a>
    <a target="_blank" rel="noopener" href="https://www.findmyschool.vic.gov.au/">Check zone</a></div></div>`;
  const mobile = isMobile();
  const pop = L.popup({ maxWidth: Math.min(340, window.innerWidth - 36), minWidth: Math.min(270, window.innerWidth - 60), autoPanPaddingTopLeft: [8, 8], autoPanPaddingBottomRight: [8, mobile ? sheetVisible() + 8 : 8] }).setLatLng(ll).setContent(html).openOn(map);
  // Leaflet only closes on Escape when the map itself has focus, so handle it inside the popup too.
  pop.getElement()?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); map.closePopup(); } });
  if (focus) { pop.getElement()?.querySelector('h3')?.focus({ preventScroll: true }); if (!returnFocus) returnFocus = 'map'; }
  return pop;
}

/* ---------- phone bottom sheet ---------- */
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
const sheetVisible = () => { const p = $('#panel'); return Math.max(0, window.innerHeight - p.getBoundingClientRect().top); };
function sheetStops() { const h = window.innerHeight; return { peek: h - $('#top').offsetHeight, half: Math.round(h * 0.45), full: Math.round(h * 0.08) }; }
let sheetState = 'peek', sheetDragging = false;
function setSheet(state, animate = true) {
  const p = $('#panel');
  if (!isMobile()) { p.style.transform = ''; return; }
  sheetState = state;
  p.classList.toggle('drag', !animate || reduceMotion);
  p.style.transform = `translateY(${sheetStops()[state]}px)`;
  p.dataset.state = state;
  const g = $('#grab');
  g.setAttribute('aria-expanded', state !== 'peek');
  g.setAttribute('aria-label', state === 'peek' ? 'Show filters' : 'Hide filters');
}
function initSheet() {
  const top = $('#top'), grab = $('#grab'), p = $('#panel');
  let y0 = null, t0 = 0, moved = false;
  top.addEventListener('pointerdown', (e) => {
    if (!isMobile() || e.target.closest('a, button:not(#grab)')) return;
    y0 = e.clientY; t0 = p.getBoundingClientRect().top; moved = false; top.setPointerCapture(e.pointerId); sheetDragging = true; p.classList.add('drag');
  });
  top.addEventListener('pointermove', (e) => {
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
    const st = sheetStops(), t = p.getBoundingClientRect().top;
    setSheet(Object.keys(st).sort((a, b) => Math.abs(st[a] - t) - Math.abs(st[b] - t))[0]);
  };
  top.addEventListener('pointerup', end);
  top.addEventListener('pointercancel', end);
  // Pointer taps on the handle are handled above; this covers keyboard and screen-reader activation.
  grab.addEventListener('click', (e) => { if (e.detail === 0) setSheet(sheetState === 'peek' ? 'half' : 'peek'); });
  // Tabbing into the filters while the sheet is down would put focus off screen, so lift it.
  $('#scroll').addEventListener('focusin', () => { if (isMobile() && sheetState === 'peek') setSheet('half'); });
  window.addEventListener('resize', () => { setSheet(sheetState, false); map.invalidateSize(); });
  setSheet('peek', false);
}

function exportCsv() {
  const lines = ['rank,suburbs,hectares,lat,lon,approx_median_house,approx_median_unit'];
  pockets.forEach((p, i) => {
    const ll = cellLL(p.r, p.c);
    lines.push([i + 1, '"' + p.subs.filter((s, j) => j === 0 || s.share > 0.2).map((s) => s.name).join('; ') + '"', p.ha.toFixed(1), ll.lat.toFixed(5), ll.lng.toFixed(5), Math.round(pocketPrice(p, 'house')) || '', Math.round(pocketPrice(p, 'unit')) || ''].join(','));
  });
  const a = el('a', { href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })), download: 'sweet-spots.csv' });
  a.click();
}

init().catch((e) => { console.error(e); showLoadError(); });
