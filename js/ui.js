/* ============================================================================
 * HK VOXEL HARBOUR — UI CONTROLLER
 * Cinematic digital-twin chrome: loader, intro title card, sandbox panel,
 * mode dock, FPS HUD (compass / district / altitude), cinematic overlay,
 * field-guide modal, toasts, screenshot capture, procedural-audio bridge.
 *
 *   HK.UI.initLoader()          early, DOM exists
 *   HK.UI.progress(pct,label)   pct 0..100, label string or {zh,en}
 *   HK.UI.init(app)             after world ready -> fade loader, show intro
 *   HK.UI.update(dt)            optional per-frame (self-ticking otherwise)
 *   HK.UI.toast(msg, opts)      string or {zh,en,type}
 *
 * Everything no-ops gracefully when app / actions / events are absent.
 * Never touches the 3D world; consumes app.state + app.events only.
 * ==========================================================================*/
(function () {
  'use strict';

  var HK = window.HK = window.HK || {};
  var UI = HK.UI = HK.UI || {};
  var doc = document;
  var root = doc.documentElement;

  var VERSION = '1.0.0';

  /* -------------------------------------------------------------- constants */
  var MODES = ['orbit', 'fps', 'cinematic'];
  var MODE_LABEL = {
    orbit: ['沙盤', 'SAND TABLE'],
    fps: ['漫遊', 'WALK THE CITY'],
    cinematic: ['電影', 'CINEMA']
  };
  var SPEEDS = [0.06, 0.12, 0.25, 0.5, 1.0];

  var WEATHERS = [
    { id: 'clear', zh: '晴朗', en: 'CLEAR', icon: 'sun' },
    { id: 'mist', zh: '薄霧', en: 'MIST', icon: 'mist' },
    { id: 'rain', zh: '雨夜', en: 'RAIN', icon: 'rain' }
  ];
  var QUALITY_EN = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH', ultra: 'CINEMA' };
  var QUALITY_ORDER = (HK.QUALITY_ORDER && HK.QUALITY_ORDER.length) ? HK.QUALITY_ORDER.slice() : ['low', 'medium', 'high', 'ultra'];

  var LAYERS = [
    { key: 'traffic', zh: '車流', en: 'TRAFFIC' },
    { key: 'ferries', zh: '渡輪', en: 'FERRIES' },
    { key: 'people', zh: '人群', en: 'CROWD' },
    { key: 'neon', zh: '霓虹', en: 'NEON' },
    { key: 'labels', zh: '地標', en: 'LABELS' },
    { key: 'aircraft', zh: '航機', en: 'AIRCRAFT' }
  ];

  var STATUS_ROTATION = [
    { zh: '正在重塑海岸線…', en: 'RESHAPING THE COASTLINE' },
    { zh: '正在點亮中環…', en: 'LIGHTING UP CENTRAL' },
    { zh: '正在鋪設維港水面…', en: 'POURING THE HARBOUR' },
    { zh: '正在堆疊太平山…', en: 'RAISING VICTORIA PEAK' },
    { zh: '正在編排天星小輪…', en: 'CHOREOGRAPHING THE FERRIES' },
    { zh: '正在編織車流與霓虹…', en: 'WEAVING TRAFFIC & NEON' },
    { zh: '正在調校黃昏色溫…', en: 'GRADING THE GOLDEN HOUR' },
    { zh: '數字孿生即將就緒…', en: 'THE DIGITAL TWIN IS ALMOST READY' }
  ];

  var DISTRICT_EN = {
    '中西區': 'CENTRAL & WESTERN', '灣仔': 'WAN CHAI', '東區': 'EASTERN', '南區': 'SOUTHERN',
    '油尖旺': 'YAU TSIM MONG', '深水埗': 'SHAM SHUI PO', '九龍城': 'KOWLOON CITY',
    '黃大仙': 'WONG TAI SIN', '觀塘': 'KWUN TONG', '葵青': 'KWAI TSING', '荃灣': 'TSUEN WAN',
    '屯門': 'TUEN MUN', '元朗': 'YUEN LONG', '北區': 'NORTH', '大埔': 'TAI PO',
    '沙田': 'SHA TIN', '西貢': 'SAI KUNG', '離島': 'ISLANDS',
    'Central & Western': 'CENTRAL & WESTERN', 'Wan Chai': 'WAN CHAI', 'Yau Tsim Mong': 'YAU TSIM MONG'
  };

  var COMPASS_POINTS = [
    ['N', '北', 0], ['NE', '', 45], ['E', '東', 90], ['SE', '', 135],
    ['S', '南', 180], ['SW', '', 225], ['W', '西', 270], ['NW', '', 315]
  ];
  var COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  var DEFAULT_POIS = [
    { id: 'central', zh: '中環', en: 'CENTRAL', districtZh: '中西區', x: 40, z: 350 },
    { id: 'tst', zh: '尖沙咀', en: 'TSIM SHA TSUI', districtZh: '油尖旺', x: -60, z: -270 },
    { id: 'peak', zh: '太平山頂', en: 'VICTORIA PEAK', districtZh: '中西區', x: -300, z: 540 },
    { id: 'wkc', zh: '西九文化區', en: 'WEST KOWLOON', districtZh: '油尖旺', x: -520, z: -210 },
    { id: 'hunghom', zh: '紅磡', en: 'HUNG HOM', districtZh: '九龍城', x: 300, z: -120 },
    { id: 'cwb', zh: '銅鑼灣', en: 'CAUSEWAY BAY', districtZh: '灣仔', x: 400, z: 300 },
    { id: 'kaitak', zh: '啟德', en: 'KAI TAK', districtZh: '九龍城', x: 720, z: -380 },
    { id: 'starferry', zh: '天星碼頭', en: 'STAR FERRY PIER', districtZh: '油尖旺', x: -30, z: -250 }
  ];

  var DEFAULT_SHOTS = [
    { titleZh: '維港晨曦', titleEn: 'HARBOUR DAWN', caption: '城市在潮聲中醒來 · THE CITY WAKES WITH THE TIDE' },
    { titleZh: '中環幻彩', titleEn: 'CENTRAL SPECTRUM', caption: '玻璃與鋼鐵的森林 · A FOREST OF GLASS AND STEEL' },
    { titleZh: '天星擺渡', titleEn: 'STAR FERRY CROSSING', caption: '百年航線，仍在擺渡 · A CENTURY OF CROSSINGS' },
    { titleZh: '尖沙咀鐘樓', titleEn: 'TST CLOCK TOWER', caption: '九廣鐵路的記憶 · MEMORY OF THE RAILWAY' },
    { titleZh: '山頂暮色', titleEn: 'PEAK AT DUSK', caption: '城市在腳下亮起 · THE CITY LIGHTS BENEATH' },
    { titleZh: '西九龍日落', titleEn: 'WEST KOWLOON SUNSET', caption: '填海地上的文化海岸 · CULTURE ON RECLAIMED LAND' },
    { titleZh: '雨夜霓虹', titleEn: 'NEON IN THE RAIN', caption: '濕漉漉的霓虹倒影 · NEON ON WET ASPHALT' },
    { titleZh: '啟德跑道', titleEn: 'KAI TAK RUNWAY', caption: '舊機場的漫長夜色 · NIGHTFALL ON THE OLD RUNWAY' },
    { titleZh: '最後一班渡輪', titleEn: 'THE LAST FERRY', caption: '海港入睡之前 · BEFORE THE HARBOUR SLEEPS' }
  ];

  var ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="4.1"/><path d="M12 2.4v2.3M12 19.3v2.3M21.6 12h-2.3M4.7 12H2.4M18.7 5.3 17.1 6.9M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"/></svg>',
    mist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 15h18M5.5 10.8h13M2.5 19h12.2"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M7.2 15.4a4 4 0 0 1 .5-7.96A5.3 5.3 0 0 1 18 9.2a3.6 3.6 0 0 1-.6 6.2"/><path d="M7.6 18.2v2M11.6 17.6v2.6M15.6 18.2v2"/></svg>'
  };

  /* ------------------------------------------------------------------ state */
  var S = {
    app: null,
    phase: 'loading',
    inited: false,
    loaderInited: false,
    loaderExternal: false,
    loaderDone: false,
    loaderProgress: 0,
    autoProgressTimer: 0,
    statusIndex: 0,
    statusTimer: 0,
    statusPinnedUntil: 0,
    tickerRunning: false,
    lastFrame: 0,
    lastSlowTick: 0,
    lastAudio: 0,
    lastSpark: 0,
    mode: 'orbit',
    panelOpen: true,
    panelBeforeCinema: true,
    helpOpen: false,
    cinemaOpen: false,
    photo: false,
    audio: false,
    paused: false,
    quality: 'high',
    weather: 'clear',
    timeHours: 18.62,
    timeAuto: false,
    timeSpeed: 0.12,
    night: 0,
    fps: 60,
    spark: [60, 60, 60, 60, 60, 60, 60, 60],
    headingSmooth: 0,
    headingTarget: 0,
    player: { x: 0, y: 0, z: 0, altitudeM: null, districtZh: '', districtEn: '' },
    playerDirty: false,
    layers: {},
    pois: [],
    shots: DEFAULT_SHOTS.slice(),
    shotIndex: 0,
    shotTotal: DEFAULT_SHOTS.length,
    version: VERSION,
    landmarkCount: null,
    districts: null,
    eventsBound: null,
    skippedIntro: false,
    introHidden: false,
    lastFocus: null,
    bannerTimer: 0,
    toastKeys: {},
    compassReady: false
  };
  S.layers = cloneLayers((HK.DEFAULT_STATE && HK.DEFAULT_STATE.layers) || { traffic: true, ferries: true, people: true, neon: true, labels: true, aircraft: true });

  var E = { bound: false };

  /* ---------------------------------------------------------------- helpers */
  function $(id) { return doc.getElementById(id); }
  function qs(sel, ctx) { try { return (ctx || doc).querySelector(sel); } catch (e) { return null; } }
  function qsa(sel, ctx) { try { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); } catch (e) { return []; } }
  function on(t, ev, fn, opt) { if (t && t.addEventListener) t.addEventListener(ev, fn, opt || false); }
  function off(t, ev, fn, opt) { if (t && t.removeEventListener) t.removeEventListener(ev, fn, opt || false); }
  function ce(tag, cls) { var e = doc.createElement(tag); if (cls) e.className = cls; return e; }
  function add(e, c) { if (e && e.classList) e.classList.add(c); }
  function rem(e, c) { if (e && e.classList) e.classList.remove(c); }
  function has(e, c) { return !!(e && e.classList && e.classList.contains(c)); }
  function toggle(e, c, force) { if (e && e.classList) e.classList.toggle(c, !!force); }
  function setText(e, v) { if (e && e.__t !== v) { e.__t = v; e.textContent = v; } }
  function setHTML(e, v) { if (e && e.__h !== v) { e.__h = v; e.innerHTML = v; } }
  function setAttr(e, n, v) { if (e && e.getAttribute(n) !== v) e.setAttribute(n, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function toNum(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }
  function pad2(n) { n = Math.round(n); return n < 10 ? '0' + n : '' + n; }
  function pad3(n) { n = Math.round(n); return (n < 10 ? '00' : (n < 100 ? '0' : '')) + n; }
  function nowMs() { return (window.performance && window.performance.now) ? window.performance.now() : Date.now(); }
  function warn() {
    if (window.console && console.warn) {
      var a = Array.prototype.slice.call(arguments);
      a.unshift('[HK.UI]');
      console.warn.apply(console, a);
    }
  }
  function cloneLayers(src) {
    var o = {};
    for (var k in src) if (src.hasOwnProperty(k)) o[k] = !!src[k];
    return o;
  }
  function fmtInt(n) {
    if (HK.Util && HK.Util.formatInt) return HK.Util.formatInt(n);
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function normMode(m) {
    m = (typeof m === 'string') ? m : (m && (m.mode || m.value));
    m = String(m || '').toLowerCase();
    if (m === 'walk' || m === 'firstperson' || m === 'first-person') m = 'fps';
    if (m === 'cinema') m = 'cinematic';
    if (m === 'sandtable' || m === 'sand') m = 'orbit';
    return (MODES.indexOf(m) >= 0) ? m : 'orbit';
  }
  function wrapAngle(a) {
    a = a % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a;
  }
  function distAngle(a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function act(name) {
    var app = S.app, args = Array.prototype.slice.call(arguments, 1);
    if (!app || !app.actions || typeof app.actions[name] !== 'function') return false;
    try { app.actions[name].apply(app.actions, args); return true; }
    catch (e) { warn('action "' + name + '" failed', e); return false; }
  }
  function splitLabel(v) {
    if (v == null) return { zh: '', en: '' };
    if (typeof v === 'object') {
      return {
        zh: v.zh != null ? v.zh : (v.zhText != null ? v.zhText : (v.label != null ? v.label : '')),
        en: v.en != null ? v.en : (v.enText != null ? v.enText : '')
      };
    }
    var s = String(v).replace(/\s+/g, ' ').trim();
    var i = s.indexOf('·');
    if (i < 0) i = s.indexOf(' / ');
    if (i < 0) i = s.indexOf('/');
    if (i > 0) return { zh: s.slice(0, i).trim(), en: s.slice(i + 1).trim() };
    return { zh: s, en: '' };
  }
  function districtEN(d) {
    if (!d) return '';
    if (typeof d === 'object') return d.en || d.enName || districtEN(d.zh || d.name || '');
    return DISTRICT_EN[d] || '';
  }
  function getCanvas() {
    if (S.app && S.app.renderer && S.app.renderer.domElement) return S.app.renderer.domElement;
    return qs('#hk-stage canvas');
  }
  function hasPointerLock() {
    return !!(doc.pointerLockElement || doc.mozPointerLockElement || doc.webkitPointerLockElement);
  }

  /* =========================================================================
   * LOADER
   * =======================================================================*/
  function initLoader() {
    if (S.loaderInited) return;
    S.loaderInited = true;
    bindElements();
    setPhase('loading');
    buildSkyline();
    startStatusRotation();
    startAutoProgress();
    renderProgress(0);
    applyStatus(STATUS_ROTATION[0]);
  }

  function bindElements() {
    if (E.bound) return;
    E.bound = true;

    E.loader = $('hk-loader');
    E.ldFill = $('ld-fill');
    E.ldPct = $('ld-pct');
    E.ldStatusZh = $('ld-status-zh');
    E.ldStatusEn = $('ld-status-en');
    E.ldTrack = qs('#hk-loader .ld-track');
    E.ldDot = qs('#hk-loader .ld-dot');

    E.intro = $('hk-intro');
    E.hud = $('hk-hud');
    E.topbar = $('hk-topbar');
    E.clock = $('hk-clock');
    E.clock2 = $('hk-clock2');
    E.phaseZh = $('hk-phase-zh');
    E.phaseEn = $('hk-phase-en');
    E.weatherZh = $('hk-weather-zh');
    E.weatherEn = $('hk-weather-en');
    E.weIcon = $('hk-weather-icon');
    E.qualityBadge = $('hk-quality-badge');
    E.fpsNum = $('hk-fps');
    E.fpsWrap = qs('.tb-fps');
    E.sparkWrap = $('hk-fps-spark');
    E.sparkBars = E.sparkWrap ? qsa('i', E.sparkWrap) : [];
    E.audioBtn = $('hk-audio-btn');

    E.panel = $('hk-panel');
    E.panelClock = $('hk-panel-clock');
    E.panelMeta = $('hk-panel-meta');
    E.panelTab = $('hk-panel-tab');
    E.panelCollapse = qs('.panel-collapse');
    E.timebar = $('hk-timebar');
    E.tbThumb = $('hk-timebar-thumb');
    E.tbMark = $('hk-timebar-mark');
    E.tbTicks = $('hk-timebar-ticks');
    E.presets = $('hk-presets');
    E.weatherRow = $('hk-weather');
    E.qualityRow = $('hk-quality');
    E.layersRow = $('hk-layers');
    E.pois = $('hk-pois');
    E.poiCount = $('hk-poi-count');
    E.speed = $('hk-speed');
    E.autoBtn = qs('.auto-btn');
    E.version = $('hk-version');

    E.dock = $('hk-dock');
    E.dockBtns = qsa('.dock-item', E.dock);

    E.compass = qs('.compass');
    E.compassWindow = qs('.compass-window');
    E.compassTrack = $('hk-compass-track');
    E.compassRead = $('hk-compass-read');
    E.crosshair = $('hk-crosshair');
    E.districtZh = $('hk-district-zh');
    E.districtEn = $('hk-district-en');
    E.alt = $('hk-alt');
    E.lockState = $('hk-lock-state');

    E.pointerlock = $('hk-pointerlock');
    E.photoEl = $('hk-photo');
    E.modebanner = $('hk-modebanner');
    E.mbZh = $('hk-modebanner-zh');
    E.mbEn = $('hk-modebanner-en');
    E.toasts = $('hk-toasts');
    E.flash = $('hk-flash');
    E.toolBtns = qsa('.tool');

    E.cinema = $('hk-cinema');
    E.cineIndex = $('cine-index');
    E.cineTotal = $('cine-total');
    E.cineShotno = $('cine-shotno');
    E.cineEyebrow = $('cine-eyebrow');
    E.cineTitleZh = $('cine-title-zh');
    E.cineTitleEn = $('cine-title-en');
    E.cineCaption = $('cine-caption');
    E.cineTicks = $('cine-ticks');
    E.cineTitlewrap = qs('.cine-titlewrap');

    E.help = $('hk-help');
    E.helpVersion = $('hk-help-version');
    E.helpCredits = $('hk-help-credits');
    E.statLandmarks = $('hk-stat-landmarks');
    E.statPois = $('hk-stat-pois');
    E.statDistricts = $('hk-stat-districts');
  }

  /* ------------------------------------------------ procedural voxel skyline */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attrs) {
    var e = doc.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function addRoof(parent, x, y, w, color) {
    parent.appendChild(svgNode('rect', { x: x, y: y, width: w, height: 1.5, fill: color }));
  }
  function addWindows(parent, x, y, w, h, rand, count, front) {
    var cols = Math.max(1, Math.floor((w - 6) / 7));
    for (var i = 0; i < count; i++) {
      var col = Math.floor(rand() * cols);
      var row = Math.floor(rand() * Math.max(1, Math.floor((h - 10) / 9)));
      var wx = x + 3 + col * 7 + rand() * 2;
      var wy = y + 6 + row * 9 + rand() * 2;
      var ww = 2 + rand() * 2.6;
      var wh = 1.6 + rand() * 1.8;
      var useCyan = rand() < (front ? 0.22 : 0.35);
      var rect = svgNode('rect', {
        x: wx.toFixed(1), y: wy.toFixed(1), width: ww.toFixed(1), height: wh.toFixed(1),
        fill: useCyan ? '#67e9ff' : '#ffc879',
        opacity: (0.35 + rand() * 0.6).toFixed(2),
        'class': 'ld-win'
      });
      rect.style.setProperty('--wd', (rand() * 4.8).toFixed(2) + 's');
      parent.appendChild(rect);
    }
  }
  function addBuilding(parent, x, y, w, h, rand, windows, front) {
    var g = svgNode('g', { 'class': 'ld-bld' });
    g.style.setProperty('--d', (0.18 + (x + 80) / 1760 * (front ? 1.45 : 1.0)).toFixed(2) + 's');
    g.appendChild(svgNode('rect', {
      x: x.toFixed(1), y: y.toFixed(1), width: w.toFixed(1), height: h.toFixed(1),
      fill: front ? '#04070c' : '#0a1421'
    }));
    addRoof(g, x, y, w, front ? 'rgba(255,181,71,.5)' : 'rgba(61,224,255,.24)');
    if (front && rand() < 0.28) {
      var ah = 8 + rand() * 26;
      g.appendChild(svgNode('rect', { x: (x + w * 0.5).toFixed(1), y: (y - ah).toFixed(1), width: 1, height: ah.toFixed(1), fill: '#0a1421' }));
      var beacon = svgNode('rect', { x: (x + w * 0.5 - 1).toFixed(1), y: (y - ah - 2).toFixed(1), width: 2, height: 2, fill: '#ff6b5a', 'class': 'ld-win' });
      beacon.style.setProperty('--wd', (1 + rand() * 3).toFixed(2) + 's');
      g.appendChild(beacon);
    }
    addWindows(g, x, y, w, h, rand, windows, front);
    parent.appendChild(g);
    return g;
  }
  function addSteppedTower(parent, x, baseY, w, h, rand, steps, front) {
    var g = svgNode('g', { 'class': 'ld-bld' });
    g.style.setProperty('--d', (0.3 + (x + 80) / 1760 * 1.5).toFixed(2) + 's');
    var segH = h / steps;
    for (var i = 0; i < steps; i++) {
      var sw = w * (1 - i * 0.13);
      var sx = x + (w - sw) / 2;
      g.appendChild(svgNode('rect', {
        x: sx.toFixed(1), y: (baseY - segH * (i + 1)).toFixed(1),
        width: sw.toFixed(1), height: (segH + 0.6).toFixed(1),
        fill: front ? '#05080e' : '#0b1523'
      }));
      addRoof(g, sx, baseY - segH * (i + 1), sw, front ? 'rgba(255,196,120,.55)' : 'rgba(61,224,255,.2)');
    }
    addWindows(g, x, baseY - h, w, h, rand, front ? 9 : 4, front);
    parent.appendChild(g);
    return g;
  }
  function buildSkyline() {
    var back = $('ld-build-back'), front = $('ld-build-front');
    if (!back || !front) return;
    var rand = rng(0x51F05EA);
    var x, i;

    back.appendChild(svgNode('rect', { x: 0, y: 470, width: 1600, height: 50, fill: '#070e17' }));
    x = -34;
    while (x < 1640) {
      var bw = 24 + rand() * 46;
      var bh = 24 + Math.pow(rand(), 1.7) * 156;
      addBuilding(back, x, 520 - bh, bw, bh, rand, Math.floor(rand() * 3), false);
      x += bw + 3 + rand() * 12;
    }

    front.appendChild(svgNode('rect', { x: 0, y: 512, width: 1600, height: 8, fill: '#03060a' }));
    x = -30;
    while (x < 1650) {
      var fw = 30 + rand() * 52;
      var fh = 54 + Math.pow(rand(), 1.55) * 214;
      addBuilding(front, x, 520 - fh, fw, fh, rand, Math.floor(4 + rand() * 7), true);
      x += fw + 4 + rand() * 14;
    }

    /* landmark silhouettes, roughly in Victoria Harbour order */
    addSteppedTower(front, 232, 520, 40, 260, rand, 4, true);          // Two IFC
    addSteppedTower(front, 286, 520, 30, 214, rand, 3, true);          // One IFC
    addSteppedTower(front, 372, 520, 30, 196, rand, 5, true);          // Bank of China
    addSteppedTower(front, 470, 520, 24, 236, rand, 4, true);          // Central Plaza
    addSteppedTower(front, 566, 520, 30, 224, rand, 3, true);          // The Center
    addSteppedTower(front, 760, 520, 40, 250, rand, 4, true);          // ICC
    addSteppedTower(front, 872, 520, 26, 180, rand, 2, true);          // HSBC-ish
    addBuilding(front, 930, 520 - 26, 82, 26, rand, 2, true);          // HKCEC
    addSteppedTower(front, 1120, 520, 28, 200, rand, 3, true);
    addSteppedTower(front, 1230, 520, 34, 168, rand, 4, true);
    addSteppedTower(front, 1400, 520, 30, 148, rand, 3, true);

    /* promenade glint along the waterline */
    var glint = svgNode('rect', { x: 0, y: 519, width: 1600, height: 1, fill: 'rgba(255,196,140,.42)' });
    front.appendChild(glint);
    var glint2 = svgNode('rect', { x: 0, y: 517, width: 1600, height: 1, fill: 'rgba(61,224,255,.20)' });
    front.appendChild(glint2);
  }

  function startStatusRotation() {
    if (S.statusTimer) return;
    S.statusTimer = window.setInterval(function () {
      if (S.loaderDone) return;
      if (S.statusPinnedUntil > Date.now()) return;
      S.statusIndex = (S.statusIndex + 1) % STATUS_ROTATION.length;
      applyStatus(STATUS_ROTATION[S.statusIndex]);
    }, 2200);
  }
  function stopStatusRotation() {
    if (S.statusTimer) { window.clearInterval(S.statusTimer); S.statusTimer = 0; }
  }
  function applyStatus(pair, pin) {
    if (!pair) return;
    setText(E.ldStatusZh, pair.zh || '');
    setText(E.ldStatusEn, pair.en || '');
    if (pin) S.statusPinnedUntil = Date.now() + 2600;
  }

  function startAutoProgress() {
    if (S.autoProgressTimer) return;
    S.autoProgressTimer = window.setInterval(function () {
      if (S.loaderExternal || S.loaderDone) {
        window.clearInterval(S.autoProgressTimer);
        S.autoProgressTimer = 0;
        return;
      }
      S.loaderProgress = Math.min(90, S.loaderProgress + (90 - S.loaderProgress) * 0.030 + 0.22);
      renderProgress(S.loaderProgress);
    }, 190);
  }

  function renderProgress(pct) {
    var n = clamp(pct, 0, 100);
    if (E.ldFill) E.ldFill.style.width = n.toFixed(2) + '%';
    setText(E.ldPct, pad3(Math.floor(n)) + '%');
    if (E.ldTrack) setAttr(E.ldTrack, 'aria-valuenow', String(Math.round(n)));
  }

  function progress(pctOrObj, label) {
    bindElements();
    var pctArg = pctOrObj;
    if (pctOrObj && typeof pctOrObj === 'object') {
      var o = pctOrObj;
      if (label == null) label = (o.label != null ? o.label : ((o.zh || o.en) ? o : null));
      pctArg = (o.pct != null ? o.pct : (o.percent != null ? o.percent : o.value));
    }
    S.loaderExternal = true;
    if (S.autoProgressTimer) { window.clearInterval(S.autoProgressTimer); S.autoProgressTimer = 0; }
    var pct = clamp(toNum(pctArg, S.loaderProgress), 0, 100);
    S.loaderProgress = pct;
    renderProgress(pct);
    if (label != null) applyStatus(splitLabel(label), true);
    if (pct >= 99.5) {
      if (!S.statusPinnedUntil) applyStatus({ zh: '數字孿生就緒', en: 'DIGITAL TWIN READY' });
      if (E.ldDot) add(E.ldDot, 'is-ready');
      stopStatusRotation();
    }
  }

  function finishLoader() {
    if (S.loaderDone) return;
    S.loaderDone = true;
    stopStatusRotation();
    if (E.loader) {
      add(E.loader, 'is-leaving');
      window.setTimeout(function () {
        if (E.loader) {
          add(E.loader, 'is-gone');
          setAttr(E.loader, 'aria-hidden', 'true');
        }
      }, 1000);
    }
  }

  function hideLoader(immediate) {
    S.loaderDone = true;
    stopStatusRotation();
    if (!E.loader) return;
    add(E.loader, 'is-leaving');
    if (immediate) {
      add(E.loader, 'is-gone');
      setAttr(E.loader, 'aria-hidden', 'true');
    } else {
      window.setTimeout(function () {
        add(E.loader, 'is-gone');
        setAttr(E.loader, 'aria-hidden', 'true');
      }, 1000);
    }
  }

  /* =========================================================================
   * INIT
   * =======================================================================*/
  function init(app) {
    bindElements();
    if (!S.inited) {
      S.inited = true;
      S.app = app || null;
      readAppMeta();
      bindGlobalEvents();
      bindAppEvents();
      buildControls();
      initTimebarDrag();
      buildCompassTicks();
      applyInitialState();
      startTicker();
    } else if (app) {
      S.app = app;
      readAppMeta();
      bindAppEvents();
      updateMetaTexts();
      rebuildPoiList();
    }

    UI.ready = true;

    /* fade loader -> reveal intro */
    S.loaderExternal = true;
    progress(100);
    finishLoader();
    if (S.skippedIntro || UI.skippedIntro || !E.intro) {
      setPhase('sandbox');
      hideIntro(true);
    } else {
      window.setTimeout(function () {
        if (!S.introHidden) showIntro();
      }, 430);
    }
  }

  function readAppMeta() {
    var meta = (S.app && S.app.meta) || {};
    S.version = meta.version || VERSION;
    S.landmarkCount = (meta.landmarkCount != null) ? meta.landmarkCount : null;
    S.districts = meta.districts || null;
    S.pois = normalizePois(meta.pois);
    S.shots = normalizeShots(meta.shots);
    S.shotTotal = S.shots.length;
    if (S.shotIndex >= S.shots.length) S.shotIndex = 0;
  }

  function normalizePois(list) {
    if (!list) return [];
    var arr;
    if (Array.isArray(list)) {
      arr = list;
    } else if (typeof list === 'object') {
      arr = [];
      for (var k in list) {
        if (!list.hasOwnProperty(k)) continue;
        var v = list[k];
        if (v && typeof v === 'object') {
          if (v.id == null) {
            try { v.id = k; } catch (e) {}
          }
          arr.push(v);
        }
      }
    } else {
      return [];
    }
    if (!arr.length) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i] || {};
      if (typeof p === 'string') p = { id: p, name: p, en: '' };
      var d = p.district;
      var dZh = p.districtZh || (typeof d === 'string' ? d : (d && (d.zh || d.name)) || '');
      var dEn = p.districtEn || (d && typeof d === 'object' ? (d.en || d.enName) : '') || districtEN(dZh);
      var x = p.x, z = p.z;
      if (!isNum(x) && p.spawn && isNum(p.spawn.x)) x = p.spawn.x;
      if (!isNum(z) && p.spawn && isNum(p.spawn.z)) z = p.spawn.z;
      if (!isNum(x) && p.cam && isNum(p.cam.x)) x = p.cam.x;
      if (!isNum(z) && p.cam && isNum(p.cam.z)) z = p.cam.z;
      if (!isNum(x)) x = 0;
      if (!isNum(z)) z = 0;
      out.push({
        id: p.id != null ? String(p.id) : ('poi-' + i),
        zh: p.name || p.zh || p.label || p.id || ('地點 ' + (i + 1)),
        en: p.en || p.enName || p.nameEn || '',
        districtZh: dZh,
        districtEn: dEn,
        x: x, z: z,
        kind: p.kind || ''
      });
    }
    return out;
  }

  function normalizeShots(list) {
    if (!list || !list.length) return DEFAULT_SHOTS.slice();
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (typeof s === 'string') { out.push({ titleZh: s, titleEn: '', caption: '' }); continue; }
      s = s || {};
      out.push({
        titleZh: s.titleZh || s.title || s.zh || s.name || ('鏡頭 ' + (i + 1)),
        titleEn: s.titleEn || s.en || s.enName || '',
        caption: s.caption || s.desc || s.blurb || ''
      });
    }
    return out;
  }

  var FALLBACK_PRESETS = [
    { id: 'dawn', zh: '黎明', en: 'DAWN', hours: 5.9 },
    { id: 'morning', zh: '早晨', en: 'MORNING', hours: 8.2 },
    { id: 'noon', zh: '正午', en: 'MIDDAY', hours: 12.6 },
    { id: 'golden', zh: '黃昏', en: 'GOLDEN HOUR', hours: 18.55 },
    { id: 'blue', zh: '藍調', en: 'BLUE HOUR', hours: 19.35 },
    { id: 'night', zh: '夜景', en: 'NIGHT', hours: 21.4 },
    { id: 'late', zh: '深夜', en: 'LATE', hours: 1.8 }
  ];
  function getPresets() {
    if (HK.TIME_PRESETS && HK.TIME_PRESETS.length) {
      var out = [];
      for (var i = 0; i < HK.TIME_PRESETS.length; i++) {
        var p = HK.TIME_PRESETS[i];
        out.push({ id: p.id || ('t' + i), zh: p.label || p.zh || p.en || '', en: p.en || '', hours: p.hours });
      }
      return out;
    }
    return FALLBACK_PRESETS.slice();
  }

  function buildControls() {
    buildPresets();
    buildWeather();
    buildQuality();
    buildLayers();
    rebuildPoiList();
    updateMetaTexts();
    buildCinemaTicks(S.shotTotal);
    if (E.cineTotal) setText(E.cineTotal, pad2(S.shotTotal));
  }

  function buildPresets() {
    if (!E.presets) return;
    var presets = getPresets();
    E.presets.innerHTML = '';
    E.presetBtns = [];
    for (var i = 0; i < presets.length; i++) {
      var p = presets[i];
      var b = ce('button', 'preset');
      b.type = 'button';
      b.setAttribute('data-act', 'time-preset');
      b.setAttribute('data-hours', String(p.hours));
      b.setAttribute('aria-pressed', 'false');
      var zh = ce('span', 'preset-zh'); zh.textContent = p.zh;
      var en = ce('span', 'preset-en mono'); en.textContent = p.en;
      b.appendChild(zh); b.appendChild(en);
      E.presets.appendChild(b);
      E.presetBtns.push(b);
    }
    if (E.tbTicks) {
      E.tbTicks.innerHTML = '';
      for (var j = 0; j < presets.length; j++) {
        var t = ce('i');
        t.style.left = clamp(presets[j].hours / 24 * 100, 0, 100) + '%';
        E.tbTicks.appendChild(t);
      }
    }
  }

  function buildWeather() {
    if (!E.weatherRow) return;
    E.weatherRow.innerHTML = '';
    E.weatherBtns = [];
    for (var i = 0; i < WEATHERS.length; i++) {
      var w = WEATHERS[i];
      var b = ce('button', 'seg');
      b.type = 'button';
      b.setAttribute('data-act', 'weather');
      b.setAttribute('data-value', w.id);
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', w.zh + ' ' + w.en);
      var ic = ce('span', 'seg-ico'); ic.innerHTML = ICONS[w.icon];
      var zh = ce('span', 'seg-zh'); zh.textContent = w.zh;
      var en = ce('span', 'seg-en mono'); en.textContent = w.en;
      b.appendChild(ic); b.appendChild(zh); b.appendChild(en);
      E.weatherRow.appendChild(b);
      E.weatherBtns.push(b);
    }
  }

  function buildQuality() {
    if (!E.qualityRow) return;
    E.qualityRow.innerHTML = '';
    E.qualityBtns = [];
    var names = (HK.QUALITY) || {};
    for (var i = 0; i < QUALITY_ORDER.length; i++) {
      var q = QUALITY_ORDER[i];
      var zh = (names[q] && names[q].name) ? names[q].name : q;
      var en = QUALITY_EN[q] || String(q).toUpperCase();
      var b = ce('button', 'seg');
      b.type = 'button';
      b.setAttribute('data-act', 'quality');
      b.setAttribute('data-value', q);
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', zh + ' ' + en);
      var z = ce('span', 'seg-zh'); z.textContent = zh;
      var e = ce('span', 'seg-en mono'); e.textContent = en;
      b.appendChild(z); b.appendChild(e);
      E.qualityRow.appendChild(b);
      E.qualityBtns.push(b);
    }
  }

  function buildLayers() {
    if (!E.layersRow) return;
    E.layersRow.innerHTML = '';
    E.layerBtns = [];
    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      var b = ce('button', 'layer');
      b.type = 'button';
      b.setAttribute('data-act', 'layer');
      b.setAttribute('data-value', L.key);
      b.setAttribute('aria-pressed', 'false');
      var chk = ce('span', 'layer-check');
      var label = ce('span', 'layer-label');
      var zh = ce('span', 'layer-zh'); zh.textContent = L.zh;
      var en = ce('span', 'layer-en mono'); en.textContent = L.en;
      label.appendChild(zh); label.appendChild(en);
      var st = ce('span', 'layer-state mono'); st.textContent = 'ON';
      b.appendChild(chk); b.appendChild(label); b.appendChild(st);
      E.layersRow.appendChild(b);
      E.layerBtns.push(b);
    }
  }

  function rebuildPoiList() {
    if (!E.pois) return;
    var list = S.pois && S.pois.length ? S.pois : DEFAULT_POIS;
    E.pois.innerHTML = '';
    E.poiBtns = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var b = ce('button', 'poi');
      b.type = 'button';
      b.setAttribute('data-act', 'poi');
      b.setAttribute('data-id', p.id);
      b.setAttribute('data-x', String(p.x));
      b.setAttribute('data-z', String(p.z));
      b.setAttribute('role', 'listitem');
      var no = ce('span', 'poi-no mono'); no.textContent = pad2(i + 1);
      if (i === 0) add(b, 'is-active');
      var main = ce('span', 'poi-main');
      var zh = ce('span', 'poi-zh'); zh.textContent = p.zh;
      var en = ce('span', 'poi-en mono'); en.textContent = p.en;
      main.appendChild(zh); main.appendChild(en);
      var meta = ce('span', 'poi-meta');
      var d = ce('span', 'poi-district mono');
      d.textContent = p.districtZh || p.districtEn || '—';
      var dist = ce('span', 'poi-dist mono');
      dist.setAttribute('data-dist', '');
      dist.innerHTML = '—';
      meta.appendChild(d); meta.appendChild(dist);
      b.appendChild(no); b.appendChild(main); b.appendChild(meta);
      E.pois.appendChild(b);
      E.poiBtns.push(b);
    }
    if (E.poiCount) setText(E.poiCount, pad2(list.length));
    S.playerDirty = true;
  }

  function updateMetaTexts() {
    setText(E.version, S.version || VERSION);
    setText(E.helpVersion, S.version || VERSION);
    var landmarks = S.landmarkCount != null ? fmtInt(S.landmarkCount) : '—';
    if (E.statLandmarks) setText(E.statLandmarks, landmarks);
    if (E.statPois) setText(E.statPois, fmtInt((S.pois && S.pois.length) || (DEFAULT_POIS.length)));
    var districts = S.districts && S.districts.length ? S.districts.length : uniqueDistricts();
    setText(E.statDistricts, districts ? fmtInt(districts) : '—');
    var credits = (S.app && S.app.meta && S.app.meta.credits) || 'THREE.JS r149 · PROCEDURAL WORLD · PROCEDURAL AUDIO';
    if (typeof credits !== 'string') {
      try { credits = Array.isArray(credits) ? credits.join(' · ') : String(credits); } catch (e) { credits = String(credits); }
    }
    setText(E.helpCredits, credits);
  }
  function uniqueDistricts() {
    var map = {}, n = 0, list = (S.pois && S.pois.length) ? S.pois : DEFAULT_POIS;
    for (var i = 0; i < list.length; i++) {
      var d = list[i].districtZh || '';
      if (d && !map[d]) { map[d] = 1; n++; }
    }
    return n || (S.districts ? S.districts.length : 0);
  }

  function applyInitialState() {
    var st = (S.app && S.app.state) || {};
    S.layers = cloneLayers(st.layers || S.layers);
    applyMode(normMode(st.mode || 'orbit'), { silent: true });
    applyTime(isNum(st.timeHours) ? st.timeHours : S.timeHours);
    applyWeather(st.weather || S.weather, { silent: true });
    applyQuality(st.quality || S.quality, { silent: true });
    applyAudio(!!st.audio, { silent: true });
    if (st.photo) applyPhoto(true, { silent: true });
    applyTimeAuto(!!st.timeAuto, true);
    applyTimeSpeed(isNum(st.timeSpeed) ? st.timeSpeed : S.timeSpeed);
    syncAllLayers();
    setPanel(true, true);
    setShot(S.shotIndex);
    syncPointerLock();
    if (isNum(st.fps)) setFps(st.fps);
    if (isNum(st.night)) S.night = st.night;
  }

  /* =========================================================================
   * STATE -> DOM
   * =======================================================================*/
  function setPhase(p) {
    S.phase = p;
    root.setAttribute('data-phase', p);
  }

  function showIntro() {
    if (!E.intro || S.introHidden) return;
    setPhase('intro');
    setAttr(E.intro, 'aria-hidden', 'false');
    add(E.intro, 'is-in');
  }

  function hideIntro(immediate) {
    setPhase('sandbox');
    if (!E.intro || S.introHidden) return;
    S.introHidden = true;
    if (immediate) {
      rem(E.intro, 'is-in');
      rem(E.intro, 'is-leaving');
      add(E.intro, 'is-gone');
      setAttr(E.intro, 'aria-hidden', 'true');
      return;
    }
    add(E.intro, 'is-leaving');
    window.setTimeout(function () {
      if (!E.intro) return;
      rem(E.intro, 'is-in');
      rem(E.intro, 'is-leaving');
      add(E.intro, 'is-gone');
      setAttr(E.intro, 'aria-hidden', 'true');
    }, 950);
  }

  function enterFromIntro(mode) {
    audioGesture();
    act('startExperience');
    hideIntro();
    if (mode && mode !== 'orbit') {
      act('setMode', mode);
      applyMode(mode);
    }
    if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (e) {} }
  }

  function applyMode(mode, opts) {
    opts = opts || {};
    mode = normMode(mode);
    var prev = S.mode;
    if (mode === S.mode && !opts.force) {
      updateDock();
      if (mode === 'fps') syncPointerLock();
      return;
    }
    S.mode = mode;
    root.setAttribute('data-mode', mode);
    updateDock();

    if (!opts.silent && !opts.fromPoll) showModeBanner(mode);

    if (mode === 'cinematic') {
      if (prev !== 'cinematic') S.panelBeforeCinema = S.panelOpen;
      setCinemaOpen(true);
      if (S.photo) applyPhoto(false, { silent: true });
    } else {
      setCinemaOpen(false);
      if (prev === 'cinematic' && S.panelBeforeCinema) setPanel(true);
      if (!opts.silent) {
        if (mode === 'fps') setPanel(false);
        else if (mode === 'orbit') setPanel(true);
      }
      syncPointerLock();
    }
    if (mode === 'fps') S.headingSmooth = S.headingTarget;
    if (mode !== 'fps') root.setAttribute('data-pointerlock', 'off');
  }

  function updateDock() {
    if (!E.dockBtns) return;
    for (var i = 0; i < E.dockBtns.length; i++) {
      var b = E.dockBtns[i];
      var active = b.getAttribute('data-value') === S.mode;
      toggle(b, 'is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function showModeBanner(mode) {
    var label = MODE_LABEL[mode];
    if (!label || !E.modebanner) return;
    setText(E.mbZh, label[0]);
    setText(E.mbEn, label[1]);
    add(E.modebanner, 'is-show');
    if (S.bannerTimer) window.clearTimeout(S.bannerTimer);
    S.bannerTimer = window.setTimeout(function () { rem(E.modebanner, 'is-show'); }, 1500);
  }

  function setPanel(open, silent) {
    open = !!open;
    if (S.panelOpen !== open) {
      S.panelOpen = open;
      root.setAttribute('data-panel', open ? 'open' : 'closed');
    }
    if (E.panel) setAttr(E.panel, 'aria-hidden', open ? 'false' : 'true');
    if (E.panelCollapse) setAttr(E.panelCollapse, 'aria-expanded', open ? 'true' : 'false');
    if (E.panelTab) setAttr(E.panelTab, 'aria-expanded', open ? 'true' : 'false');
  }

  function applyTime(hours) {
    if (!isNum(hours)) return;
    hours = ((hours % 24) + 24) % 24;
    if (Math.abs(hours - S.timeHours) < 0.0005 && S.timeInit) return;
    S.timeHours = hours;
    S.timeInit = true;
    syncTimeUI();
  }

  function syncTimeUI() {
    var h = ((S.timeHours % 24) + 24) % 24;
    var hh = Math.floor(h);
    var mm = Math.floor((h - hh) * 60);
    if (mm >= 60) { mm = 0; hh = (hh + 1) % 24; }
    var clock = pad2(hh) + ':' + pad2(mm);
    setText(E.clock, clock);
    setText(E.clock2, clock);
    setText(E.panelClock, clock);
    var phase = phaseFor(h);
    setText(E.phaseZh, phase[0]);
    setText(E.phaseEn, phase[1]);

    var pct = h / 24 * 100;
    if (E.tbThumb) E.tbThumb.style.left = pct.toFixed(3) + '%';
    if (E.tbMark) E.tbMark.style.left = pct.toFixed(3) + '%';
    if (E.timebar) {
      setAttr(E.timebar, 'aria-valuenow', h.toFixed(2));
      setAttr(E.timebar, 'aria-valuetext', clock);
    }
    if (E.presetBtns) {
      var nearest = -1, nearestD = 1e9;
      for (var i = 0; i < E.presetBtns.length; i++) {
        var ph = toNum(E.presetBtns[i].getAttribute('data-hours'), -1);
        if (ph < 0) continue;
        var dd = Math.abs(h - ph);
        dd = Math.min(dd, 24 - dd);
        if (dd < 0.85 && dd < nearestD) { nearestD = dd; nearest = i; }
      }
      for (var j = 0; j < E.presetBtns.length; j++) {
        var active = j === nearest;
        toggle(E.presetBtns[j], 'is-active', active);
        E.presetBtns[j].setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    }
  }

  function phaseFor(h) {
    if (h < 4.6) return ['深夜', 'LATE NIGHT'];
    if (h < 7.0) return ['黎明', 'DAWN'];
    if (h < 10.5) return ['早晨', 'MORNING'];
    if (h < 15.0) return ['正午', 'MIDDAY'];
    if (h < 17.6) return ['午後', 'AFTERNOON'];
    if (h < 18.9) return ['黃昏', 'GOLDEN HOUR'];
    if (h < 20.0) return ['藍調', 'BLUE HOUR'];
    if (h < 23.0) return ['夜景', 'NIGHT'];
    return ['深夜', 'LATE NIGHT'];
  }

  function applyTimeAuto(on, silent) {
    S.timeAuto = !!on;
    if (E.autoBtn) E.autoBtn.setAttribute('aria-pressed', S.timeAuto ? 'true' : 'false');
    if (!silent && S.timeAuto) UI.toast({ zh: '時間自動流逝', en: 'TIME AUTO CYCLE' });
  }
  function applyTimeSpeed(v) {
    if (!isNum(v)) return;
    S.timeSpeed = v;
    setText(E.speed, (Math.round(v * 100) / 100).toFixed(2));
  }

  function applyWeather(id, opts) {
    opts = opts || {};
    var found = null;
    for (var i = 0; i < WEATHERS.length; i++) if (WEATHERS[i].id === id) found = WEATHERS[i];
    if (!found) found = WEATHERS[0];
    S.weather = found.id;
    root.setAttribute('data-weather', found.id);
    setText(E.weatherZh, found.zh);
    setText(E.weatherEn, found.en);
    if (E.weIcon) setHTML(E.weIcon, ICONS[found.icon]);
    if (E.weatherBtns) {
      for (var j = 0; j < E.weatherBtns.length; j++) {
        var active = E.weatherBtns[j].getAttribute('data-value') === found.id;
        toggle(E.weatherBtns[j], 'is-active', active);
        E.weatherBtns[j].setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    }
  }

  function qualityLabel(q) {
    var names = HK.QUALITY || {};
    return {
      zh: (names[q] && names[q].name) ? names[q].name : q,
      en: QUALITY_EN[q] || String(q).toUpperCase()
    };
  }
  function applyQuality(q, opts) {
    opts = opts || {};
    if (QUALITY_ORDER.indexOf(q) < 0) q = 'high';
    S.quality = q;
    root.setAttribute('data-quality', q);
    var lab = qualityLabel(q);
    setText(E.qualityBadge, lab.zh + ' · ' + lab.en);
    if (E.qualityBtns) {
      for (var i = 0; i < E.qualityBtns.length; i++) {
        var active = E.qualityBtns[i].getAttribute('data-value') === q;
        toggle(E.qualityBtns[i], 'is-active', active);
        E.qualityBtns[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    }
  }

  function applyAudio(on, opts) {
    opts = opts || {};
    S.audio = !!on;
    root.setAttribute('data-audio', on ? 'on' : 'off');
    if (E.audioBtn) E.audioBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (HK.Audio && typeof HK.Audio.setEnabled === 'function') {
      try {
        if (on) audioGesture();
        HK.Audio.setEnabled(!!on);
      } catch (e) { warn('audio', e); }
    }
  }

  function applyPhoto(on, opts) {
    opts = opts || {};
    S.photo = !!on;
    root.setAttribute('data-photo', on ? 'on' : 'off');
    if (E.toolBtns) {
      for (var i = 0; i < E.toolBtns.length; i++) {
        if (E.toolBtns[i].getAttribute('data-act') === 'photo') {
          E.toolBtns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      }
    }
    if (on && S.helpOpen) closeHelp();
    if (!opts.silent) {
      UI.toast(on ? { zh: '攝影模式', en: 'PHOTO MODE' } : { zh: '已離開攝影模式', en: 'PHOTO MODE OFF' });
    }
  }

  function syncAllLayers() {
    if (!E.layerBtns) return;
    for (var i = 0; i < E.layerBtns.length; i++) {
      var key = E.layerBtns[i].getAttribute('data-value');
      applyLayerUI(key, S.layers[key] !== false);
    }
  }
  function applyLayerUI(key, on) {
    S.layers[key] = !!on;
    if (!E.layerBtns) return;
    for (var i = 0; i < E.layerBtns.length; i++) {
      var b = E.layerBtns[i];
      if (b.getAttribute('data-value') !== key) continue;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var st = qs('.layer-state', b);
      if (st) setText(st, on ? 'ON' : 'OFF');
    }
  }
  function syncLayersFrom(obj) {
    if (!obj) return;
    for (var key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      var on = !!obj[key];
      if (S.layers[key] !== on) applyLayerUI(key, on);
    }
  }

  /* =========================================================================
   * TICKER
   * =======================================================================*/
  function startTicker() {
    if (S.tickerRunning) return;
    S.tickerRunning = true;
    S.lastFrame = nowMs();
    requestFrame();
  }
  function requestFrame() {
    if (window.requestAnimationFrame) window.requestAnimationFrame(onFrame);
    else window.setTimeout(function () { onFrame(nowMs()); }, 33);
  }
  function onFrame(t) {
    if (!S.tickerRunning) return;
    requestFrame();
    var last = S.lastFrame || t;
    var dt = Math.min(0.12, Math.max(0, (t - last) / 1000));
    S.lastFrame = t;
    frameTick(t, dt);
  }
  function frameTick(t, dt) {
    if (S.mode === 'fps' && dt > 0) smoothHeading(dt);
    if (t - S.lastSlowTick >= 100) {
      S.lastSlowTick = t;
      slowTick(t);
    }
  }

  function slowTick(t) {
    if (S.app && S.app.state) pollState(S.app.state);
    syncTimeUI();
    updateFpsUI();
    if (S.mode === 'fps') { updateCompass(); updateFpsInfo(); }
    if (t - S.lastAudio > 500) {
      S.lastAudio = t;
      updateAudio();
    }
    if (S.playerDirty) { updatePoiDistances(); S.playerDirty = false; }
  }

  function pollState(st) {
    if (st.mode && normMode(st.mode) !== S.mode) applyMode(st.mode, { silent: true, fromPoll: true });
    if (st.photo != null && (!!st.photo) !== S.photo) applyPhoto(!!st.photo, { silent: true });
    if (st.audio != null && (!!st.audio) !== S.audio) applyAudio(!!st.audio, { silent: true });
    if (st.weather && st.weather !== S.weather) applyWeather(st.weather, { silent: true });
    if (st.quality && st.quality !== S.quality) applyQuality(st.quality, { silent: true });
    if (isNum(st.timeHours) && !S.draggingTime && Math.abs(st.timeHours - S.timeHours) > 0.0015) applyTime(st.timeHours);
    if (st.timeAuto != null && (!!st.timeAuto) !== S.timeAuto) applyTimeAuto(!!st.timeAuto, true);
    if (isNum(st.timeSpeed) && Math.abs(st.timeSpeed - S.timeSpeed) > 1e-6) applyTimeSpeed(st.timeSpeed);
    if (isNum(st.fps) && st.fps > 0) setFps(st.fps);
    if (isNum(st.night)) {
      S.night = st.night;
      var n = st.night >= 0.5 ? '1' : '0';
      if (root.getAttribute('data-night') !== n) root.setAttribute('data-night', n);
    }
    if (st.layers) syncLayersFrom(st.layers);
    if (st.player) normalizePlayer(st.player);
    if (st.paused != null) S.paused = !!st.paused;
  }

  function setFps(v) {
    if (!isNum(v) || v <= 0) return;
    S.fps = S.fps ? (S.fps * 0.55 + v * 0.45) : v;
  }

  function updateFpsUI() {
    var fps = Math.round(S.fps);
    setText(E.fpsNum, String(fps));
    if (E.fpsWrap) {
      toggle(E.fpsWrap, 'is-low', fps < 42 && fps >= 26);
      toggle(E.fpsWrap, 'is-critical', fps < 26);
    }
    var t = nowMs();
    if (t - S.lastSpark > 620 && E.sparkBars && E.sparkBars.length) {
      S.lastSpark = t;
      S.spark.push(clamp(fps, 0, 140));
      if (S.spark.length > E.sparkBars.length) S.spark.shift();
      for (var i = 0; i < E.sparkBars.length; i++) {
        var v = S.spark[i] != null ? S.spark[i] : fps;
        var frac = clamp(v / 110, 0.12, 1);
        E.sparkBars[i].style.height = (frac * 100).toFixed(0) + '%';
      }
    }
    if (E.panelMeta) {
      var pm = fps + ' FPS · ' + String(S.quality).toUpperCase();
      if (E.panelMeta.__t !== pm) { E.panelMeta.__t = pm; E.panelMeta.textContent = pm; }
    }
  }

  function smoothHeading(dt) {
    var d = distAngle(S.headingSmooth, S.headingTarget);
    if (Math.abs(d) < 0.0002) { S.headingSmooth = S.headingTarget; return; }
    S.headingSmooth = wrapAngle(S.headingSmooth + d * Math.min(1, dt * 14));
  }

  function normalizePlayer(d) {
    if (!d || typeof d !== 'object') return;
    var p = S.player;
    if (isNum(d.x)) p.x = d.x;
    if (isNum(d.y)) p.y = d.y;
    if (isNum(d.z)) p.z = d.z;
    var hRad = null;
    if (isNum(d.headingRad)) hRad = d.headingRad;
    else if (isNum(d.headingDeg)) hRad = d.headingDeg * Math.PI / 180;
    else if (isNum(d.heading)) hRad = (Math.abs(d.heading) > Math.PI * 2 + 0.001) ? d.heading * Math.PI / 180 : d.heading;
    else if (isNum(d.yaw)) hRad = d.yaw;
    if (hRad != null) S.headingTarget = wrapAngle(hRad);
    if (isNum(d.altitudeM)) p.altitudeM = d.altitudeM;
    else if (isNum(d.altitude)) p.altitudeM = d.altitude;
    else if (isNum(d.y)) p.altitudeM = d.y * (HK.VOX || 2);
    var dzh = d.districtZh || (typeof d.district === 'string' ? d.district : (d.district && d.district.zh));
    var den = d.districtEn || (d.district && d.district.en) || (dzh ? districtEN(dzh) : '');
    if (dzh) p.districtZh = dzh;
    if (den) p.districtEn = den;
    S.playerDirty = true;
    if (S.inited) { updateFpsInfo(); updateCompass(); }
  }

  function updateCompass() {
    if (!E.compassTrack) return;
    var deg = wrapAngle(S.headingSmooth) * 180 / Math.PI;
    var w = (E.compassWindow && E.compassWindow.clientWidth) || 340;
    var x = w / 2 - (deg + 360) * 1.5;
    E.compassTrack.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    var bearing = ((Math.round(deg) % 360) + 360) % 360;
    if (S.__bear !== bearing) {
      S.__bear = bearing;
      setText(E.compassRead, pad3(bearing) + '° ' + COMPASS_8[Math.round(bearing / 45) % 8]);
    }
  }

  function updateFpsInfo() {
    var p = S.player;
    var dzh = p.districtZh || '維多利亞港';
    var den = p.districtEn || districtEN(dzh) || 'VICTORIA HARBOUR';
    setText(E.districtZh, dzh);
    setText(E.districtEn, den);
    var alt = p.altitudeM;
    if (!isNum(alt)) alt = isNum(p.y) ? p.y * (HK.VOX || 2) : 0;
    var altTxt = (alt >= 0 ? '+' : '') + fmtInt(Math.abs(Math.round(alt))) + ' m';
    setText(E.alt, altTxt);
    var locked = hasPointerLock();
    setText(E.lockState, locked ? '視角已鎖定 · MOUSE LOCKED' : '自由視角 · FREE LOOK');
  }

  function updatePoiDistances() {
    if (!E.poiBtns) return;
    var p = S.player;
    for (var i = 0; i < E.poiBtns.length; i++) {
      var b = E.poiBtns[i];
      var x = toNum(b.getAttribute('data-x'), 0);
      var z = toNum(b.getAttribute('data-z'), 0);
      var dx = p.x - x, dz = p.z - z;
      var units = Math.sqrt(dx * dx + dz * dz);
      var km = units * (HK.VOX || 2) / 1000;
      var txt,
        el = qs('.poi-dist', b);
      if (km < 0.995) txt = Math.round(km * 1000) + '<em>m</em>';
      else txt = km.toFixed(km < 10 ? 1 : 0) + '<em>km</em>';
      if (el && el.__h !== txt) { el.__h = txt; el.innerHTML = txt; }
    }
  }

  function updateAudio() {
    if (!HK.Audio || typeof HK.Audio.update !== 'function') return;
    try {
      HK.Audio.update({
        audio: S.audio, night: S.night, weather: S.weather, timeHours: S.timeHours,
        mode: S.mode, photo: S.photo, paused: S.paused, phase: S.phase
      });
    } catch (e) { /* audio must never break UI */ }
  }

  /* =========================================================================
   * APP EVENTS
   * =======================================================================*/
  function bindAppEvents() {
    var app = S.app;
    if (!app || !app.events || typeof app.events.on !== 'function') return;
    if (S.eventsBound === app.events) return;
    S.eventsBound = app.events;
    var ev = app.events;
    ev.on('mode', function (d) { applyMode(normMode(d)); });
    ev.on('time', function (d) {
      var h = isNum(d) ? d : (d && (d.hours != null ? d.hours : d.timeHours));
      if (isNum(h)) applyTime(h);
    });
    ev.on('weather', function (d) { applyWeather(typeof d === 'string' ? d : (d && (d.weather || d.value))); });
    ev.on('quality', function (d) { applyQuality(typeof d === 'string' ? d : (d && (d.quality || d.value))); });
    ev.on('fps', function (d) { setFps(isNum(d) ? d : (d && (d.fps || d.value))); });
    ev.on('player', function (d) {
      if (d && typeof d === 'object') {
        if (d.player) d = d.player;
        normalizePlayer(d);
      }
    });
    ev.on('toast', function (d) { UI.toast(d); });
    ev.on('photo', function (d) {
      var on = (d == null) ? true : (typeof d === 'object' ? !!d.photo : !!d);
      applyPhoto(on, { silent: true });
    });
    ev.on('audio', function (d) {
      var on = (typeof d === 'object') ? !!d.audio : !!d;
      applyAudio(on, { silent: true });
    });
    ev.on('cinematic', onCinematicEvent);
    ev.on('layer', function (d) {
      if (d && d.name) applyLayerUI(d.name, d.on !== false ? !!d.on : false);
    });
    ev.on('pointerlock', syncPointerLock);
    ev.on('paused', function (d) { S.paused = !!(d && d.paused != null ? d.paused : d); });
  }

  function onCinematicEvent(d) {
    d = d || {};
    var index = isNum(d.index) ? d.index : S.shotIndex;
    var total = isNum(d.total) ? d.total : S.shotTotal;
    if (!S.cinemaOpen) { S.shotIndex = index; return; }
    var zh = d.titleZh || d.title || d.zh;
    var en = d.titleEn || d.en || d.enName;
    var caption = d.caption || d.desc || '';
    // already showing this shot (main + UI can both listen) -> avoid re-animation
    if (index === S.shotIndex && zh != null && E.cineTitleZh && E.cineTitleZh.__t === zh &&
        (en == null || !E.cineTitleEn || E.cineTitleEn.__t === en)) {
      if (isNum(total) && total !== S.shotTotal) { S.shotTotal = total; setText(E.cineTotal, pad2(total)); }
      return;
    }
    setShot(index, {
      titleZh: zh,
      titleEn: en,
      caption: caption,
      total: total
    });
  }

  /* =========================================================================
   * CINEMA
   * =======================================================================*/
  function setCinemaOpen(open) {
    if (!E.cinema || S.cinemaOpen === open) return;
    S.cinemaOpen = open;
    toggle(E.cinema, 'is-in', open);
    setAttr(E.cinema, 'aria-hidden', open ? 'false' : 'true');
    if (open) {
      if (S.helpOpen) closeHelp();
      if (S.photo) applyPhoto(false, { silent: true });
      setShot(S.shotIndex);
    }
  }

  function buildCinemaTicks(total) {
    if (!E.cineTicks) return;
    E.cineTicks.innerHTML = '';
    E.cineTickEls = [];
    total = Math.max(1, total || S.shotTotal || 1);
    for (var i = 0; i < total; i++) {
      var t = ce('i', 'cine-tick');
      E.cineTicks.appendChild(t);
      E.cineTickEls.push(t);
    }
    updateCinemaTicks(S.shotIndex);
  }
  function updateCinemaTicks(index) {
    if (!E.cineTickEls) return;
    for (var i = 0; i < E.cineTickEls.length; i++) {
      toggle(E.cineTickEls[i], 'is-active', i === index);
    }
  }
  function setShot(index, meta) {
    if (!S.shots || !S.shots.length) S.shots = DEFAULT_SHOTS.slice();
    var n = S.shots.length;
    index = (index == null) ? S.shotIndex : index;
    index = ((index % n) + n) % n;
    S.shotIndex = index;
    var total = (meta && isNum(meta.total)) ? meta.total : S.shotTotal || n;
    S.shotTotal = total;
    var shot = meta || S.shots[index] || {};
    var zh = shot.titleZh || (S.shots[index] && S.shots[index].titleZh) || '';
    var en = shot.titleEn || (S.shots[index] && S.shots[index].titleEn) || '';
    var caption = shot.caption != null ? shot.caption : ((S.shots[index] && S.shots[index].caption) || '');
    // avoid repeating the title in the caption when a payload only echoes it
    if (caption && zh && en && caption.indexOf(zh) >= 0 && caption.indexOf(en) >= 0) caption = '';
    setText(E.cineIndex, pad2(index + 1));
    setText(E.cineTotal, pad2(total));
    setText(E.cineShotno, pad2(index + 1));
    setText(E.cineTitleZh, zh);
    setText(E.cineTitleEn, en);
    setText(E.cineCaption, caption);
    setText(E.cineEyebrow, '維多利亞港 · VICTORIA HARBOUR');
    updateCinemaTicks(index);
    if (E.cineTitlewrap) {
      rem(E.cineTitlewrap, 'is-swap');
      void E.cineTitlewrap.offsetWidth;
      add(E.cineTitlewrap, 'is-swap');
    }
  }
  function nextShot(dir) {
    if (S.mode !== 'cinematic') return;
    var n = S.shots.length || 1;
    var idx = ((S.shotIndex + (dir || 1)) % n + n) % n;
    setShot(idx);
    if (dir < 0) act('prevCinematic'); else act('nextCinematic');
    if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (e) {} }
  }
  function exitCinema() {
    audioGesture();
    act('setMode', 'orbit');
    applyMode('orbit');
    if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (e) {} }
  }

  /* =========================================================================
   * OVERLAYS / HELP
   * =======================================================================*/
  function isOverlayOpen() {
    return !!(S.helpOpen || S.photo || S.mode === 'cinematic');
  }

  function openHelp() {
    if (!E.help || S.helpOpen) return;
    if (S.phase !== 'sandbox') return;
    S.helpOpen = true;
    S.lastFocus = doc.activeElement;
    add(E.help, 'is-open');
    setAttr(E.help, 'aria-hidden', 'false');
    var c = qs('.help-close', E.help);
    if (c && c.focus) { try { c.focus({ preventScroll: true }); } catch (e) { try { c.focus(); } catch (e2) {} } }
    if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (e) {} }
  }
  function closeHelp() {
    if (!E.help || !S.helpOpen) return;
    S.helpOpen = false;
    rem(E.help, 'is-open');
    setAttr(E.help, 'aria-hidden', 'true');
    if (S.lastFocus && S.lastFocus.focus) {
      try { S.lastFocus.focus({ preventScroll: true }); } catch (e) { try { S.lastFocus.focus(); } catch (e2) {} }
    }
    S.lastFocus = null;
  }

  function trapHelpFocus(e) {
    if (!S.helpOpen || e.key !== 'Tab') return false;
    var els = qsa('button, [href], [tabindex]:not([tabindex="-1"])', E.help).filter(function (el) {
      return el.getClientRects().length > 0;
    });
    if (!els.length) return false;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey && (doc.activeElement === first || doc.activeElement === E.help)) {
      e.preventDefault(); last.focus();
      return true;
    }
    if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault(); first.focus();
      return true;
    }
    return false;
  }

  /* =========================================================================
   * TOASTS
   * =======================================================================*/
  function normalizeToast(msg, opts) {
    opts = opts || {};
    var out = { zh: '', en: '', type: opts.type || 'info' };
    if (msg && typeof msg === 'object') {
      out.zh = msg.zh || msg.zhText || msg.text || msg.message || msg.label || '';
      out.en = msg.en || msg.enText || msg.sub || '';
      out.type = msg.type || out.type;
    } else {
      var pair = splitLabel(msg);
      out.zh = pair.zh;
      out.en = pair.en;
    }
    return out;
  }
  function toast(msg, opts) {
    if (!E.toasts) bindElements();
    if (!E.toasts) return;
    var n = normalizeToast(msg, opts);
    if (!n.zh && !n.en) return;
    var key = n.zh + '|' + n.en;
    var t = Date.now();
    var recent = S.toastKeys;
    for (var k in recent) {
      if (!recent.hasOwnProperty(k)) continue;
      if (t - recent[k] > 1800) { delete recent[k]; continue; }
      var prevZh = k.split('|')[0];
      if (prevZh && n.zh && (prevZh.indexOf(n.zh) >= 0 || n.zh.indexOf(prevZh) >= 0)) {
        recent[k] = t;
        return;
      }
    }
    recent[key] = t;

    while (E.toasts.children.length >= 4) {
      var old = E.toasts.firstChild;
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }

    var box = ce('div', 'toast' + (n.type === 'warn' ? ' is-warn' : (n.type === 'ok' ? ' is-ok' : '')));
    var zh = ce('span', 'toast-zh'); zh.textContent = n.zh;
    box.appendChild(zh);
    if (n.en) {
      var en = ce('span', 'toast-en mono'); en.textContent = n.en;
      box.appendChild(en);
    }
    E.toasts.appendChild(box);
    void box.offsetWidth;
    add(box, 'is-in');
    window.setTimeout(function () {
      rem(box, 'is-in');
      add(box, 'is-out');
      window.setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 420);
    }, Math.max(1200, (opts && opts.duration) || 2600));
  }

  /* =========================================================================
   * SCREENSHOT
   * =======================================================================*/
  function fireFlash() {
    var f = E.flash || $('hk-flash');
    if (!f) return;
    rem(f, 'is-firing');
    void f.offsetWidth;
    add(f, 'is-firing');
    window.setTimeout(function () { rem(f, 'is-firing'); }, 700);
  }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  }
  function screenshot() {
    fireFlash();
    var canvas = getCanvas();
    var data = null;
    if (canvas && canvas.toDataURL) {
      try { data = canvas.toDataURL('image/png'); } catch (e) { warn('toDataURL failed', e); }
    }
    if (data && /^data:image/.test(data)) {
      try {
        var a = doc.createElement('a');
        a.href = data;
        a.download = 'hk-victoria_' + stamp() + '.png';
        a.style.display = 'none';
        doc.body.appendChild(a);
        a.click();
        window.setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 250);
      } catch (e) { warn('download failed', e); }
      UI.toast({ zh: '畫面已擷取', en: 'FRAME CAPTURED' }, { type: 'ok' });
    } else {
      UI.toast({ zh: '畫面尚未就緒', en: 'CAPTURE UNAVAILABLE' }, { type: 'warn' });
    }
    if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (e) {} }
    return !!data;
  }

  /* =========================================================================
   * AUDIO BRIDGE
   * =======================================================================*/
  function audioGesture() {
    if (!HK.Audio) return;
    try {
      if (typeof HK.Audio.userGesture === 'function') HK.Audio.userGesture();
      if (S.audio && typeof HK.Audio.setEnabled === 'function') HK.Audio.setEnabled(true);
    } catch (e) { /* never break UI */ }
  }

  /* =========================================================================
   * POINTER LOCK
   * =======================================================================*/
  function syncPointerLock() {
    var locked = hasPointerLock();
    root.setAttribute('data-pointerlock', locked ? 'on' : 'off');
    setText(E.lockState, locked ? '視角已鎖定 · MOUSE LOCKED' : '自由視角 · FREE LOOK');
  }
  function tryPointerLock() {
    audioGesture();
    if (hasPointerLock()) return;
    var ok = act('requestPointerLock');
    if (!ok) {
      var c = getCanvas();
      if (c && c.requestPointerLock) {
        try { c.requestPointerLock(); ok = true; } catch (e) { warn('pointer lock', e); }
      }
    }
    if (!ok) UI.toast({ zh: '點擊場景以鎖定視角', en: 'CLICK THE SCENE TO CAPTURE MOUSE' }, { type: 'warn' });
    window.setTimeout(syncPointerLock, 60);
  }

  /* =========================================================================
   * ACTION DELEGATION
   * =======================================================================*/
  function attachClickDelegation() {
    on(doc, 'click', function (e) {
      var t = e.target;
      var el = (t && t.closest) ? t.closest('[data-act]') : null;
      if (!el) return;
      var action = el.getAttribute('data-act');
      if (!action) return;
      handleAction(action, el, e);
    }, false);
  }

  function handleAction(action, el, e) {
    var dataVal = el ? el.getAttribute('data-value') : null;
    switch (action) {
      case 'enter':
        enterFromIntro('orbit');
        break;
      case 'walk':
        enterFromIntro('fps');
        break;
      case 'mode':
        enterMode(dataVal);
        break;
      case 'panel':
        setPanel(!S.panelOpen);
        if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (ex) {} }
        break;
      case 'time-preset': {
        var hours = toNum(el.getAttribute('data-hours'), 18.62);
        applyTime(hours);
        act('setTime', hours);
        if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (ex) {} }
        break;
      }
      case 'time-auto': {
        var auto = !S.timeAuto;
        applyTimeAuto(auto, true);
        act('setTimeAuto', auto);
        UI.toast(auto ? { zh: '時間流逝：開', en: 'TIME CYCLE ON' } : { zh: '時間流逝：關', en: 'TIME CYCLE OFF' });
        break;
      }
      case 'time-speed': {
        var idx = 0;
        for (var i = 0; i < SPEEDS.length; i++) if (Math.abs(SPEEDS[i] - S.timeSpeed) < 0.001) idx = i;
        var next = SPEEDS[(idx + 1) % SPEEDS.length];
        applyTimeSpeed(next);
        act('setTimeSpeed', next);
        UI.toast({ zh: '時間流速 ' + next.toFixed(2) + ' h/s', en: 'TIME SPEED ' + next.toFixed(2) + ' H/S' });
        break;
      }
      case 'weather': {
        var w = dataVal;
        if (w === S.weather) break;
        applyWeather(w);
        var wHandled = act('setWeather', w);
        var wl = null;
        for (var wi = 0; wi < WEATHERS.length; wi++) if (WEATHERS[wi].id === w) wl = WEATHERS[wi];
        /* main.js emits its own bilingual toast for weather; avoid a double */
        if (!wHandled && wl) UI.toast({ zh: '天氣：' + wl.zh, en: wl.en });
        break;
      }
      case 'quality': {
        var q = dataVal;
        if (q === S.quality) break;
        applyQuality(q);
        act('setQuality', q);
        var ql = qualityLabel(q);
        UI.toast({ zh: '畫質：' + ql.zh, en: ql.en });
        break;
      }
      case 'layer': {
        var key = dataVal;
        var onL = !(S.layers[key] !== false);
        applyLayerUI(key, onL);
        act('setLayer', key, onL);
        var def = null;
        for (var li = 0; li < LAYERS.length; li++) if (LAYERS[li].key === key) def = LAYERS[li];
        if (def) UI.toast({ zh: '圖層：' + def.zh + (onL ? ' 開' : ' 關'), en: def.en + (onL ? ' ON' : ' OFF') });
        break;
      }
      case 'poi': {
        var id = el.getAttribute('data-id');
        markActivePoi(id);
        act('teleport', id);
        if (S.mode === 'fps') setPanel(false);
        if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (ex) {} }
        break;
      }
      case 'audio': {
        var want = !S.audio;
        applyAudio(want);
        act('setAudio', want);
        UI.toast(want ? { zh: '音效：開', en: 'SOUND ON' } : { zh: '音效：關', en: 'SOUND OFF' });
        if (want && HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (ex) {} }
        break;
      }
      case 'photo':
        togglePhoto();
        break;
      case 'screenshot':
        UI.screenshot();
        break;
      case 'reset':
        act('resetCamera');
        UI.toast({ zh: '視角已重置', en: 'CAMERA RESET' });
        if (HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (ex) {} }
        break;
      case 'help':
        if (S.helpOpen) closeHelp(); else openHelp();
        break;
      case 'help-close':
        closeHelp();
        break;
      case 'pointerlock':
        tryPointerLock();
        break;
      case 'next':
        nextShot(1);
        break;
      case 'prev':
        nextShot(-1);
        break;
      case 'cinema-exit':
        exitCinema();
        break;
      default:
        break;
    }
  }

  function enterMode(mode) {
    mode = normMode(mode);
    if (S.phase === 'intro') {
      act('startExperience');
      hideIntro();
    }
    if (S.helpOpen) closeHelp();
    audioGesture();
    var changed = mode !== S.mode;
    act('setMode', mode, { ui: true });
    applyMode(mode);
    if (changed && mode === 'cinematic' && HK.Audio && HK.Audio.click) { try { HK.Audio.click(); } catch (e) {} }
  }

  function markActivePoi(id) {
    if (!E.poiBtns) return;
    for (var i = 0; i < E.poiBtns.length; i++) {
      toggle(E.poiBtns[i], 'is-active', E.poiBtns[i].getAttribute('data-id') === String(id));
    }
  }

  function togglePhoto(force) {
    if (S.phase !== 'sandbox') return;
    var want = (force === undefined) ? !S.photo : !!force;
    if (want && S.mode === 'cinematic') {
      UI.toast({ zh: '電影模式中無法攝影', en: 'NOT AVAILABLE IN CINEMA' }, { type: 'warn' });
      return;
    }
    act('togglePhoto');
    applyPhoto(want);
    if (want) closeHelp();
  }

  /* =========================================================================
   * GLOBAL EVENTS
   * =======================================================================*/
  function bindGlobalEvents() {
    bindKeyboard();
    attachClickDelegation();

    on(doc, 'pointerdown', function () { audioGesture(); }, { capture: true, passive: true });
    on(doc, 'keydown', function () { audioGesture(); }, { capture: true, passive: true });

    on(doc, 'pointerlockchange', function () {
      syncPointerLock();
      if (S.mode === 'fps') updateFpsInfo();
    });
    if (!doc.onpointerlockchange) {
      on(doc, 'mozpointerlockchange', syncPointerLock);
      on(doc, 'webkitpointerlockchange', syncPointerLock);
    }
    on(doc, 'pointerlockerror', function () {
      UI.toast({ zh: '滑鼠鎖定失敗', en: 'MOUSE LOCK FAILED' }, { type: 'warn' });
    });

    on(window, 'resize', function () {
      if (E.compassWindow) S.__compassW = E.compassWindow.clientWidth;
      updateCompass();
    });
  }

  function bindKeyboard() {
    on(doc, 'keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;

      if (S.helpOpen) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeHelp(); return; }
        if (e.key === 'Tab') { trapHelpFocus(e); return; }
        if (e.key === 'h' || e.key === 'H' || e.key === '?') { e.preventDefault(); closeHelp(); return; }
        if (e.key === 'Enter') { return; }
        // keep game hotkeys from leaking through the modal
        if (['p', 'P', 'm', 'M', 'n', 'N', '1', '2', '3'].indexOf(e.key) >= 0) { e.preventDefault(); return; }
      }

      if (e.key === 'Escape') {
        if (S.helpOpen) { e.preventDefault(); closeHelp(); return; }
        if (S.photo) { e.preventDefault(); togglePhoto(false); return; }
        if (S.mode === 'cinematic') { e.preventDefault(); exitCinema(); return; }
        return; /* pause / pointer-lock release is owned by controls.js + browser */
      }

      if (S.phase === 'intro') {
        if (e.key === 'Enter') { e.preventDefault(); enterFromIntro('orbit'); return; }
        if (e.key === '1' || e.key === '2' || e.key === '3') {
          e.preventDefault();
          enterFromIntro(MODES[+e.key - 1]);
          return;
        }
        return;
      }
      if (S.phase !== 'sandbox') return;

      if (e.key === 'h' || e.key === 'H' || e.key === '?') { e.preventDefault(); if (S.helpOpen) closeHelp(); else openHelp(); return; }
      if (e.key === '1') { e.preventDefault(); enterMode('orbit'); return; }
      if (e.key === '2') { e.preventDefault(); enterMode('fps'); return; }
      if (e.key === '3') { e.preventDefault(); enterMode('cinematic'); return; }
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePhoto(); return; }
      if (e.key === 'n' || e.key === 'N') {
        if (S.mode === 'cinematic') { e.preventDefault(); nextShot(1); }
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (S.mode === 'cinematic') exitCinema();
        else enterMode(S.mode === 'fps' ? 'orbit' : 'fps');
        return;
      }
    }, true);
  }

  /* =========================================================================
   * TIMEBAR
   * =======================================================================*/
  function initTimebarDrag() {
    var bar = E.timebar;
    if (!bar) return;
    var track = qs('.timebar-track', bar);
    var dragging = false;
    var lastCommit = 0;

    function hoursAt(clientX) {
      if (!track) return S.timeHours;
      var r = track.getBoundingClientRect();
      if (!r.width) return S.timeHours;
      return clamp((clientX - r.left) / r.width, 0, 1) * 24;
    }
    function commit(h, force) {
      var t = Date.now();
      if (!force && t - lastCommit < 90) return;
      lastCommit = t;
      act('setTime', h);
    }
    function begin(e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      S.draggingTime = true;
      try { bar.setPointerCapture(e.pointerId); } catch (ex) {}
      var h = hoursAt(e.clientX);
      applyTime(h);
      commit(h, true);
      e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      var h = hoursAt(e.clientX);
      applyTime(h);
      commit(h);
      e.preventDefault();
    }
    function end(e) {
      if (!dragging) return;
      dragging = false;
      S.draggingTime = false;
      commit(S.timeHours, true);
      try { bar.releasePointerCapture(e.pointerId); } catch (ex) {}
    }
    bar.addEventListener('pointerdown', begin);
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);

    bar.addEventListener('keydown', function (e) {
      var h = S.timeHours;
      var handled = true;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h -= (e.shiftKey ? 1 : 0.25);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h += (e.shiftKey ? 1 : 0.25);
      else if (e.key === 'Home') h = 0;
      else if (e.key === 'End') h = 23.99;
      else if (e.key === 'PageDown') h -= 1;
      else if (e.key === 'PageUp') h += 1;
      else handled = false;
      if (!handled) return;
      e.preventDefault();
      h = ((h % 24) + 24) % 24;
      applyTime(h);
      act('setTime', h);
    });
  }

  function buildCompassTicks() {
    if (!E.compassTrack) return;
    var frag = doc.createDocumentFragment();
    for (var deg = -180; deg <= 540; deg += 5) {
      var tick = ce('span', 'ctick');
      tick.style.left = ((deg + 360) * 1.5).toFixed(1) + 'px';
      if (deg % 45 === 0) {
        add(tick, 'ctick-major');
        if (deg % 90 === 0) add(tick, 'ctick-cardinal');
        var pt = null;
        for (var i = 0; i < COMPASS_POINTS.length; i++) {
          var pdeg = COMPASS_POINTS[i][2];
          if (((deg % 360) + 360) % 360 === pdeg) { pt = COMPASS_POINTS[i]; break; }
        }
        if (pt) {
          var lab = ce('span', 'ctick-label' + (pt[1] ? ' ctick-label-cardinal' : ''));
          lab.style.left = ((deg + 360) * 1.5).toFixed(1) + 'px';
          if (pt[1]) {
            var zh = ce('span', 'ctick-zh'); zh.textContent = pt[1];
            lab.appendChild(zh);
          }
          lab.appendChild(doc.createTextNode(pt[0]));
          frag.appendChild(lab);
        }
      }
      frag.appendChild(tick);
    }
    E.compassTrack.appendChild(frag);
    S.compassReady = true;
  }

  /* =========================================================================
   * PUBLIC API
   * =======================================================================*/
  UI.VERSION = VERSION;
  UI.initLoader = initLoader;
  UI.progress = progress;
  UI.init = init;
  UI.update = function (dt) {
    if (!S.inited) return;
    var t = nowMs();
    frameTick(t, Math.min(0.12, isNum(dt) ? dt : 0.016));
  };
  UI.toast = toast;
  UI.showIntro = showIntro;
  UI.hideIntro = hideIntro;
  UI.hideLoader = hideLoader;
  UI.finishLoader = finishLoader;
  UI.setPhase = setPhase;
  UI.enterMode = enterMode;
  UI.setMode = function (mode) { applyMode(normMode(mode)); };
  UI.setPlayer = normalizePlayer;
  UI.setShot = setShot;
  UI.updateCinema = onCinematicEvent;
  UI.openHelp = openHelp;
  UI.closeHelp = closeHelp;
  UI.isOverlayOpen = isOverlayOpen;
  UI.togglePhoto = togglePhoto;
  UI.screenshot = screenshot;
  UI.audioGesture = audioGesture;
  UI.progressState = function () { return S; };
  UI.ready = false;

  /* auto-init the loader as early as possible */
  function autoBoot() {
    try { initLoader(); } catch (e) { warn('initLoader failed', e); }
  }
  if (doc.readyState === 'loading') on(doc, 'DOMContentLoaded', autoBoot);
  else autoBoot();
})();
