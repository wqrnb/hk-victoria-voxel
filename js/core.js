/* ============================================================================
 * HK VOXEL HARBOUR — CORE
 * Shared namespace, math, noise, palettes, geometry batching, quality config.
 * Units: 1 world unit = 1 voxel = 2 metres.  Sea level = y 0.
 * High and cinema snap footprint lips and fins to 0.5 unit (1 metre).
 * A true 1 m terrain grid would be four times the cells across the 8 km map
 * and drops the desktop frame rate, so the base lattice stays 2 m.
 * +X = east, -Z = north (Kowloon), +Z = south (Hong Kong Island).
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK = window.HK || {};

  HK.VERSION = '1.3.0';
  HK.VOX = 2;                     // metres per unit; 0.5 unit = 1 m detail on high/cinema
  HK.WORLD = { minX: -1500, maxX: 1500, minZ: -1000, maxZ: 1000, sea: 0, maxY: 320 };
  HK.SEA = 0;
  HK.CAMERA_FAR = 16000;

  /* ---------------------------------------------------------------- quality */
  HK.QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];
  HK.QUALITY = {
    /* cityStep < 1 packs the street grid tighter. facadeScale < 1 draws finer
       bays on the atlas (live, no rebuild). pilasters / waterfront add
       skyline fins and a shore infill pass; they are chosen at boot. */
    /* footMin is the shortest OSM footprint extruded, in model units (1 unit = 2 m).
       footStep 0.5 snaps skyline massing to 1 m on high / cinema. */
    low:    { name: '低',   pixelRatio: 1.0,  msaa: 0, bloomScale: 0.5, bloomMips: 4, shadowMap: 1024, shadows: true,  trees: 3800,  traffic: 110, people: 120, aa: false, grain: false, waterSeg: 0,  cloudDetail: 2, cityStep: 1.16, facadeScale: 1.05, pilasters: 0, waterfront: 0, footprints: 0, footMin: 80, footStep: 1 },
    medium: { name: '中',   pixelRatio: 1.35, msaa: 2, bloomScale: 0.5, bloomMips: 5, shadowMap: 2048, shadows: true,  trees: 8000,  traffic: 220, people: 260, aa: true,  grain: true,  waterSeg: 0,  cloudDetail: 3, cityStep: 1.0,  facadeScale: 0.96, pilasters: 0, waterfront: 1, footprints: 1, footMin: 40, footStep: 1 },
    high:   { name: '高',   pixelRatio: 1.75, msaa: 4, bloomScale: 0.5, bloomMips: 6, shadowMap: 4096, shadows: true,  trees: 14000, traffic: 340, people: 400, aa: true,  grain: true,  waterSeg: 0,  cloudDetail: 4, cityStep: 0.88, facadeScale: 0.92, pilasters: 1, waterfront: 1, footprints: 1, footMin: 3,  footStep: 0.5 },
    ultra:  { name: '電影', pixelRatio: 2.0,  msaa: 4, bloomScale: 0.5, bloomMips: 6, shadowMap: 4096, shadows: true,  trees: 20000, traffic: 460, people: 560, aa: true,  grain: true,  waterSeg: 0,  cloudDetail: 5, cityStep: 0.8,  facadeScale: 1.0,  pilasters: 1, waterfront: 1, footprints: 1, footMin: 3,  footStep: 0.5 }
  };

  HK.DEFAULT_STATE = {
    mode: 'orbit',            // orbit | fps | cinematic
    timeHours: 18.62,         // golden hour over Victoria Harbour
    timeAuto: false,
    timeSpeed: 0.12,          // hours per second when auto
    weather: 'clear',         // clear | mist | rain
    quality: 'high',
    photo: false,
    paused: false,
    night: 0,
    fps: 0,
    audio: false,
    layers: { traffic: true, ferries: true, people: true, neon: true, labels: true, aircraft: true }
  };

  HK.TIME_PRESETS = [
    { id: 'dawn',    label: '黎明',  en: 'DAWN',      hours: 5.9 },
    { id: 'morning', label: '早晨',  en: 'MORNING',   hours: 8.2 },
    { id: 'noon',    label: '正午',  en: 'MIDDAY',    hours: 12.6 },
    { id: 'golden',  label: '黃昏',  en: 'GOLDEN HOUR', hours: 18.55 },
    { id: 'blue',    label: '藍調',  en: 'BLUE HOUR', hours: 19.35 },
    { id: 'night',   label: '夜景',  en: 'NIGHT',     hours: 21.4 },
    { id: 'late',    label: '深夜',  en: 'LATE',      hours: 1.8 }
  ];

  /* ------------------------------------------------------------------ utils */
  var U = HK.Util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    invLerp: function (a, b, v) { return a === b ? 0 : (v - a) / (b - a); },
    smoothstep: function (a, b, v) { var t = U.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
    smootherstep: function (a, b, v) { var t = U.clamp((v - a) / (b - a), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); },
    step: function (a, v) { return v < a ? 0 : 1; },
    easeInOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    easeOutCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    easeInOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    dist2: function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); },
    dist2sq: function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; },
    angleLerp: function (a, b, t) { var d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; return a + d * t; },
    deg: Math.PI / 180,
    // stable string hash
    hashStr: function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
    pad: function (n, l) { var s = '' + n; while (s.length < l) s = '0' + s; return s; },
    formatInt: function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); },
    urlParams: function () {
      var out = {};
      try {
        new URLSearchParams(location.search).forEach(function (v, k) { out[k] = v; });
      } catch (e) {}
      return out;
    },
    isMobile: function () { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); }
  };

  /* --------------------------------------------------------------- color */
  var colorCache = {};
  U.srgbToLinear = function (c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  U.linearToSrgb = function (c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  U.hexRgb = function (hex) {
    if (typeof hex !== 'string') return [hex[0], hex[1], hex[2]];
    if (colorCache[hex]) return colorCache[hex];
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    colorCache[hex] = c;
    return c;
  };
  U.linRgb = function (hexOrRgb) {
    var c = U.hexRgb(hexOrRgb);
    return [U.srgbToLinear(c[0]), U.srgbToLinear(c[1]), U.srgbToLinear(c[2])];
  };
  U.rgbHex = function (rgb) {
    return (U.clamp(Math.round(rgb[0] * 255), 0, 255) << 16) | (U.clamp(Math.round(rgb[1] * 255), 0, 255) << 8) | U.clamp(Math.round(rgb[2] * 255), 0, 255);
  };
  U.css = function (rgb, a) { return 'rgba(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ',' + (a == null ? 1 : a) + ')'; };
  U.mixRgb = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  U.scaleRgb = function (a, f) { return [a[0] * f, a[1] * f, a[2] * f]; };
  U.addRgb = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  U.jitterRgb = function (a, amt, rng) {
    var f = 1 + (rng ? rng.float(-amt, amt) : (Math.random() * 2 - 1) * amt);
    var tint = (rng ? rng.float(-amt, amt) : (Math.random() * 2 - 1) * amt) * 0.18;
    return [U.clamp(a[0] * f + tint, 0, 1), U.clamp(a[1] * f, 0, 1), U.clamp(a[2] * f - tint, 0, 1)];
  };
  U.shadeRgb = function (a, f) { return [a[0] * f, a[1] * f, a[2] * f]; };
  U.lum = function (a) { return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722; };
  U.hsl = function (h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')'; };

  /* ------------------------------------------------------------------- rng */
  function Rng(seed) {
    this.s = (seed === undefined ? (Math.random() * 0xffffffff) : seed) >>> 0;
  }
  Rng.prototype.next = function () {
    var t = this.s += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.float = function (a, b) { return a + (b - a) * this.next(); };
  Rng.prototype.int = function (a, b) { return Math.floor(this.next() * (b - a + 1)) + a; };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; };
  Rng.prototype.sign = function () { return this.next() < 0.5 ? -1 : 1; };
  Rng.prototype.gauss = function (mean, sd) {
    var u = 1 - this.next(), v = this.next();
    return (mean || 0) + (sd || 1) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  /// weight table: [[value, weight], ...] or [{v:...,w:...}]
  Rng.prototype.weighted = function (list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += (list[i][1] !== undefined ? list[i][1] : list[i].w);
    var r = this.next() * total;
    for (i = 0; i < list.length; i++) {
      var w = (list[i][1] !== undefined ? list[i][1] : list[i].w);
      if ((r -= w) <= 0) return (list[i][0] !== undefined ? list[i][0] : list[i].v);
    }
    var last = list[list.length - 1];
    return last[0] !== undefined ? last[0] : last.v;
  };
  HK.Rng = Rng;
  HK.rng = new Rng(0xBEEF);

  /* ----------------------------------------------------------------- noise */
  U.hash2 = function (x, y) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  U.hash3 = function (x, y, z) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  U.vnoise2 = function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = U.hash2(xi, yi), b = U.hash2(xi + 1, yi), c = U.hash2(xi, yi + 1), d = U.hash2(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  U.fbm2 = function (x, y, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2.03; gain = gain || 0.5;
    var s = 0, a = 1, n = 0;
    for (var i = 0; i < oct; i++) { s += a * U.vnoise2(x, y); n += a; a *= gain; x *= lac; y *= lac; x += 13.7; y += 7.3; }
    return s / n;
  };
  U.ridge2 = function (x, y, oct) {
    var s = 0, a = 1, n = 0;
    for (var i = 0; i < (oct || 4); i++) { var v = U.vnoise2(x, y); v = 1 - Math.abs(v * 2 - 1); s += a * v * v; n += a; a *= 0.5; x = x * 2.07 + 5.1; y = y * 2.07 - 3.7; }
    return s / n;
  };

  /* ---------------------------------------------------------------- events */
  function Emitter() { this._h = {}; }
  Emitter.prototype.on = function (name, fn) { (this._h[name] = this._h[name] || []).push(fn); return this; };
  Emitter.prototype.off = function (name, fn) { var a = this._h[name]; if (a) { var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } return this; };
  Emitter.prototype.emit = function (name, data) {
    var a = this._h[name];
    if (a) { for (var i = 0; i < a.length; i++) { try { a[i](data); } catch (e) { console.error('event handler', name, e); } } }
    var all = this._h['*'];
    if (all) for (var j = 0; j < all.length; j++) { try { all[j](name, data); } catch (e) {} }
    return this;
  };
  HK.Emitter = Emitter;

  /* ------------------------------------------------------------ geometry batch
   * Batch collects triangles/quads with vertex colour + optional custom
   * attributes. Buildings use the facade attribute set:
   *   aUv (vec2)  : facade-local coordinate in world units (pattern grid)
   *   aStyle (f)  : facade style id
   *   aSeed (f)   : per-building random seed
   *   aGlow (f)   : emissive multiplier for window/crown lights
   */
  HK.ATTRS_FACADE = [{ name: 'aUv', size: 2 }, { name: 'aStyle', size: 1 }, { name: 'aSeed', size: 1 }, { name: 'aGlow', size: 1 }];
  HK.ATTRS_COLOR = [];

  function Batch(attrDef) {
    this.attrs = attrDef || HK.ATTRS_FACADE;
    this.attrPos = {};
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.idx = [];
    this.vcount = 0;
    for (var i = 0; i < this.attrs.length; i++) {
      this.attrPos[this.attrs[i].name] = [];
    }
  }
  Batch.prototype.addVertex = function (x, y, z, nx, ny, nz, rgb, extra) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.col.push(rgb[0], rgb[1], rgb[2]);
    for (var i = 0; i < this.attrs.length; i++) {
      var a = this.attrs[i], arr = this.attrPos[a.name], e = extra ? extra[a.name] : undefined;
      if (a.size === 1) arr.push(e === undefined ? 0 : e);
      else for (var k = 0; k < a.size; k++) arr.push(e ? (e[k] === undefined ? 0 : e[k]) : 0);
    }
    return this.vcount++;
  };
  /// uvs = [u0,v0, u1,v1, u2,v2, u3,v3]; extra = { aStyle:.., aSeed:.., aGlow:.. }
  Batch.prototype.addQuad = function (p0, p1, p2, p3, nx, ny, nz, rgb, uvs, extra) {
    var b = this.vcount;
    var e0 = extra, e1 = extra, e2 = extra, e3 = extra;
    if (uvs && this.attrs.length) {
      e0 = extraWithUv(extra, uvs[0], uvs[1]);
      e1 = extraWithUv(extra, uvs[2], uvs[3]);
      e2 = extraWithUv(extra, uvs[4], uvs[5]);
      e3 = extraWithUv(extra, uvs[6], uvs[7]);
    }
    this.addVertex(p0[0], p0[1], p0[2], nx, ny, nz, rgb, e0);
    this.addVertex(p1[0], p1[1], p1[2], nx, ny, nz, rgb, e1);
    this.addVertex(p2[0], p2[1], p2[2], nx, ny, nz, rgb, e2);
    this.addVertex(p3[0], p3[1], p3[2], nx, ny, nz, rgb, e3);
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  function extraWithUv(extra, u, v) {
    var o = { aUv: [u, v] };
    if (extra) { for (var k in extra) if (k !== 'aUv') o[k] = extra[k]; }
    return o;
  }
  Batch.prototype.addTri = function (p0, p1, p2, nx, ny, nz, rgb, uvs, extra) {
    var b = this.vcount;
    this.addVertex(p0[0], p0[1], p0[2], nx, ny, nz, rgb, extra ? extraWithUv(extra, uvs ? uvs[0] : 0, uvs ? uvs[1] : 0) : undefined);
    this.addVertex(p1[0], p1[1], p1[2], nx, ny, nz, rgb, extra ? extraWithUv(extra, uvs ? uvs[2] : 0, uvs ? uvs[3] : 0) : undefined);
    this.addVertex(p2[0], p2[1], p2[2], nx, ny, nz, rgb, extra ? extraWithUv(extra, uvs ? uvs[4] : 0, uvs ? uvs[5] : 0) : undefined);
    this.idx.push(b, b + 1, b + 2);
  };
  Batch.prototype.addTriangleF = Batch.prototype.addTri;
  Batch.prototype.isEmpty = function () { return this.vcount === 0; };
  Batch.prototype.build = function (target) {
    var g = target || new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    for (var i = 0; i < this.attrs.length; i++) {
      var a = this.attrs[i];
      g.setAttribute(a.name, new THREE.Float32BufferAttribute(this.attrPos[a.name], a.size));
    }
    g.setIndex((this.vcount > 65535) ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  };
  Batch.prototype.mergeFrom = function (other) {
    var base = this.vcount;
    var i;
    for (i = 0; i < other.pos.length; i++) this.pos.push(other.pos[i]);
    for (i = 0; i < other.nrm.length; i++) this.nrm.push(other.nrm[i]);
    for (i = 0; i < other.col.length; i++) this.col.push(other.col[i]);
    for (i = 0; i < this.attrs.length; i++) {
      var name = this.attrs[i].name, a = this.attrPos[name], b = other.attrPos[name];
      if (!b) continue;
      for (var k = 0; k < b.length; k++) a.push(b[k]);
    }
    for (i = 0; i < other.idx.length; i++) this.idx.push(other.idx[i] + base);
    this.vcount += other.vcount;
    return this;
  };
  HK.Batch = Batch;

  /* ----------------------------------------------------------------- palette */
  HK.PALETTE = {
    asphalt: '#2b2e33', asphaltWarm: '#33343a', pavement: '#8f8c85', pavementLight: '#a9a49a',
    promenade: '#b8a98f', promenadeDark: '#8c8171', plaza: '#9a958c', concrete: '#b0aca3',
    granite: '#77746e', seawall: '#6d6a64', rock: '#6f6b60', grass: '#4c6b3f', grassDry: '#6b7446',
    forest: '#2f4a2e', forestDeep: '#263d27', sand: '#c8b48a', soil: '#5a4a36',
    roof: '#4a4c50', roofWarm: '#6b5f52', metalDark: '#3a3d42', rust: '#7a4a33',
    roadWhite: '#d8d6cc', roadAmber: '#d4a548', laneYellow: '#c9a83f',
    windowWarm: '#ffd9a0', windowCool: '#cfe4ff', windowTeal: '#a8d8d8',
    neonPink: '#ff4fa3', neonCyan: '#3de0ff', neonMagenta: '#d24fff', neonAmber: '#ffb547', neonGreen: '#4dff9e', neonRed: '#ff4b3e',
    hkRed: '#d7263d', taxiRed: '#c92a2a', tramGreen: '#1f6b4f', junkRed: '#b0261f',
    starFerryGreen: '#2f6b4c', starFerryWhite: '#e8e3d7'
  };

  /* -------------------------------------------------------------- math extras */
  U.pointInPoly = function (x, z, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  };
  U.distToPolyline = function (x, z, pts, closed) {
    var best = Infinity, n = pts.length;
    for (var i = 0; i < n - (closed ? 0 : 1); i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var vx = b[0] - a[0], vz = b[1] - a[1];
      var wx = x - a[0], wz = z - a[1];
      var L2 = vx * vx + vz * vz;
      var t = L2 > 0 ? U.clamp((wx * vx + wz * vz) / L2, 0, 1) : 0;
      var dx = x - (a[0] + vx * t), dz = z - (a[1] + vz * t);
      var d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
  U.polyBBox = function (poly) {
    var b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i];
      if (p[0] < b.minX) b.minX = p[0]; if (p[0] > b.maxX) b.maxX = p[0];
      if (p[1] < b.minZ) b.minZ = p[1]; if (p[1] > b.maxZ) b.maxZ = p[1];
    }
    return b;
  };
  U.catmullRom = function (p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
  U.seeded = function (seed) { return new Rng(seed); };
  U.TWO_PI = Math.PI * 2;

  /* ---------------------------------------------------------- misc helpers */
  U.makeCanvas = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  U.textTexture = function (text, opts) {
    opts = opts || {};
    var c = U.makeCanvas(opts.w || 512, opts.h || 128);
    var ctx = c.getContext('2d');
    if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, c.width, c.height); }
    else { ctx.clearRect(0, 0, c.width, c.height); }
    ctx.font = (opts.weight || '700') + ' ' + (opts.size || 64) + 'px ' + (opts.font || '"Microsoft JhengHei","Noto Sans TC",sans-serif');
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = opts.blur || 12; }
    ctx.fillStyle = opts.color || '#fff';
    ctx.fillText(text, c.width * (opts.x == null ? 0.5 : opts.x), c.height * (opts.y == null ? 0.5 : opts.y));
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    if (opts.encoding !== false) tex.encoding = THREE.sRGBEncoding;
    return tex;
  };

  /* ------------------------------------------------------- boot helpers */
  HK.reg = [];              // modules register builders here
  HK.register = function (name, fn) { HK.reg.push({ name: name, fn: fn }); };
  HK.startedAt = performance.now();
  HK.log = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('%cHK', 'color:#3de0ff;font-weight:bold');
    console.log.apply(console, args);
  };

  // three legacy colour handling: keep hex values as authored
  if (THREE.ColorManagement) {
    if (THREE.ColorManagement.legacyMode !== undefined) THREE.ColorManagement.legacyMode = true;
  }
})();
