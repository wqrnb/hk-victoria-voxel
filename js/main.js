/* ============================================================================
 * HK VOXEL HARBOUR — MAIN
 * Boots the renderer, builds the world in staged async steps, wires the HUD,
 * atmosphere, water, post-processing, dynamic life and controls together.
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util;
  var app = window.HK.app = window.HK.app || {};
  var params = U.urlParams();
  var QA = params.qa === '1';
  var booted = false;

  app.state = Object.assign({}, HK.DEFAULT_STATE);
  app.state.layers = Object.assign({}, HK.DEFAULT_STATE.layers, { show: true });
  app.state.quality = HK.QUALITY[params.quality] ? params.quality : (U.isMobile() ? 'medium' : 'high');
  if (params.time != null && !isNaN(parseFloat(params.time))) app.state.timeHours = ((parseFloat(params.time) % 24) + 24) % 24;
  if (params.weather) app.state.weather = params.weather;
  app.events = new HK.Emitter();
  app.meta = {
    version: HK.VERSION,
    title: '維多利亞港 · VICTORIA HARBOUR',
    pois: (HK.Layout.POIS || []).slice(),
    districts: HK.Layout.DISTRICTS,
    landmarkCount: Object.keys(HK.Layout.LANDMARKS || {}).length,
    credits: 'VOXEL DIGITAL TWIN · HONG KONG',
    shots: (HK.Layout.CINEMATIC || []).map(function (s) { return { titleZh: s.title, titleEn: s.en, caption: '' }; })
  };
  if (QA) {
    // QA-only NaN geometry tracer (intermittent computeBoundingSphere warning)
    try {
      var _origCBS = THREE.BufferGeometry.prototype.computeBoundingSphere;
      THREE.BufferGeometry.prototype.computeBoundingSphere = function () {
        var r = _origCBS.apply(this, arguments);
        try {
          if (this.boundingSphere && !isFinite(this.boundingSphere.radius)) {
            var pos = this.attributes && this.attributes.position;
            var rec = { type: this.type, count: pos ? pos.count : 0, stack: (new Error()).stack };
            (window.__NAN_STACK__ = window.__NAN_STACK__ || []).push(rec);
            console.warn('NAN GEOMETRY', this.type, pos ? pos.count : 0, rec.stack);
          }
        } catch (e) {}
        return r;
      };
    } catch (e) {}
  }
  app.world = null; app.sky = null; app.water = null; app.post = null;
  app.life = null; app.controls = null; app.props = null; app.cityGroup = null;

  function nextFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { requestAnimationFrame(resolve); });
    });
  }
  function progress(pct, zh, en) {
    try { if (HK.UI && HK.UI.progress) HK.UI.progress(pct, zh ? { zh: zh, en: en || '' } : undefined); } catch (e) {}
  }
  function toast(zh, en) {
    app.events.emit('toast', { zh: zh, en: en });
    try { if (HK.UI && HK.UI.toast) HK.UI.toast({ zh: zh, en: en }); } catch (e) {}
  }

  function parseVec3(s) {
    if (!s) return null;
    var p = String(s).split(',').map(parseFloat);
    if (p.length < 3 || p.some(isNaN)) return null;
    return new THREE.Vector3(p[0], p[1], p[2]);
  }

  async function boot() {
    if (booted) return;
    booted = true;
    var state = app.state;
    var quality = HK.QUALITY[state.quality];

    /* ---- renderer / scene / camera ------------------------------------- */
    progress(1, '正在初始化渲染管線…', 'INITIALISING RENDER PIPELINE');
    var renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: true
    });
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 1);
    renderer.shadowMap.enabled = !!quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    var pr = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);
    renderer.setPixelRatio(pr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    var container = document.getElementById('hk-stage') || document.body;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, HK.CAMERA_FAR);
    app.renderer = renderer; app.scene = scene; app.camera = camera; app.container = container;

    if (QA) {
      var st = document.createElement('style');
      st.id = 'hk-qa-style';
      st.textContent = '#hk-hud,#hk-loader,#hk-intro,#hk-cinema,#hk-help,#hk-toasts,#hk-vignette,#hk-flash,#hk-stage::after{display:none!important}html{background:#000}';
      document.head.appendChild(st);
      try { HK.UI && (HK.UI.skippedIntro = true); } catch (e) {}
    }

    try { if (HK.UI && HK.UI.initLoader) HK.UI.initLoader(); } catch (e) {}

    /* ---- terrain ------------------------------------------------------- */
    progress(4, '正在重塑海岸線…', 'RESHAPING THE COASTLINE');
    await nextFrame();
    var world = await HK.Terrain.build(HK.Layout, {}, function (p, label) {
      progress(4 + p * 0.47, label || '正在重塑海岸線…');
    });
    app.world = world;
    scene.add(world.group);
    progress(52, '正在堆疊城市…', 'STACKING THE CITY');
    await nextFrame();

    /* ---- city + landmarks ---------------------------------------------- */
    HK.Buildings.build(world, HK.Layout);
    progress(58, '正在豎立摩天樓群…', 'RAISING THE TOWERS');
    await nextFrame();
    var landmarkCount = 0;
    try { if (HK.LandmarksHK) { var r1 = HK.LandmarksHK.build(world, HK.Layout); landmarkCount += (r1 && r1.count) || 0; } } catch (e) { console.error('LandmarksHK', e); }
    try { if (HK.LandmarksKL) { var r2 = HK.LandmarksKL.build(world, HK.Layout); landmarkCount += (r2 && r2.count) || 0; } } catch (e) { console.error('LandmarksKL', e); }
    app.meta.landmarkCount = (app.meta.landmarkCount || 0) + landmarkCount;
    progress(70, '正在點亮霓虹與街燈…', 'LIGHTING THE NEON');
    await nextFrame();

    try {
      if (HK.Props) { var pg = HK.Props.build(world, HK.Layout); if (pg) scene.add(pg); app.props = HK.Props; app.propsGroup = pg; }
    } catch (e) { console.error('Props', e); }
    var cityGroup = null;
    try { cityGroup = HK.Buildings.finalize(world); if (cityGroup) { scene.add(cityGroup); app.cityGroup = cityGroup; } } catch (e) { console.error('city finalize', e); }
    progress(84, '正在引水入港…', 'FLOODING THE HARBOUR');
    await nextFrame();

    /* ---- sky / water / life ------------------------------------------- */
    try {
      if (HK.Sky) { app.sky = HK.Sky.create({ scene: scene, renderer: renderer, quality: state.quality }); }
    } catch (e) { console.error('Sky', e); }
    try {
      if (HK.Water) {
        app.water = HK.Water.create({ scene: scene, renderer: renderer, quality: state.quality });
        if (world.shoreMask && app.water.setShoreMask) app.water.setShoreMask(world.shoreMask.canvas, world.shoreMask.bounds);
      }
    } catch (e) { console.error('Water', e); }
    if (app.sky) {
      try { app.sky.setTime(state.timeHours); } catch (e) {}
      try { app.sky.setWeather(state.weather); } catch (e) {}
    }
    try {
      if (HK.Life) {
        app.life = HK.Life.create({ scene: scene, renderer: renderer, quality: state.quality, layout: HK.Layout });
        if (app.life.group && app.life.group.parent !== scene) scene.add(app.life.group);
      }
    } catch (e) { console.error('Life', e); }
    progress(92, '正在編排車流與渡輪…', 'CHOREOGRAPHING THE HARBOUR');
    await nextFrame();

    /* ---- post processing ---------------------------------------------- */
    try {
      if (HK.Post && app.sky) {
        app.post = HK.Post.create({ renderer: renderer, scene: scene, camera: camera, quality: state.quality, env: app.sky.env });
        if (app.post) app.post.resize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
      }
    } catch (e) { console.error('Post', e); app.post = null; }

    /* ---- boot visual state -------------------------------------------- */
    if (app.sky) {
      app.sky.update(0.016, state);
      var env0 = app.sky.env;
      if (env0) env0.colorsLinear = true;
      if (app.water) app.water.update(0.016, state, { x: -130, y: 55, z: 330, radius: 900 }, env0);
      if (app.life) app.life.update(0.016, state, camera, env0);
      if (app.props) app.props.update(0.016, state, env0);
      try { HK.Buildings.update(0.016, { night: env0.night, horizonColor: (env0.glassTint || env0.horizonColor), zenithColor: env0.zenithColor, colorsLinear: true }); } catch (e) {}
    }

    /* ---- controls ------------------------------------------------------ */
    try {
      app.controls = HK.Controls.create({
        camera: camera, renderer: renderer, scene: scene, world: world,
        layout: HK.Layout, sky: app.sky, app: app, domElement: renderer.domElement
      });
    } catch (e) { console.error('Controls', e); }

    setupActions();
    setupEvents();
    app.state.started = false;
    progress(100, '維多利亞港已就緒', 'VICTORIA HARBOUR READY');
    await nextFrame();

    /* ---- UI ----------------------------------------------------------- */
    try { if (HK.UI && HK.UI.init) HK.UI.init(app); } catch (e) { console.error('UI init', e); }

    /* ---- QA / deep-link setup ----------------------------------------- */
    await nextFrame();
    applyDeepLink();

    /* ---- render loop --------------------------------------------------- */
    startLoop();
    if (QA || params.intro === '0') {
      try { if (HK.UI && HK.UI.hideIntro) HK.UI.hideIntro(); } catch (e) {}
    }
    setTimeout(function () {
      app.events.emit('ready', { version: HK.VERSION });
      if (HK.UI && HK.UI.progress) HK.UI.progress(100);
    }, 300);
    HK.log('boot complete', 'buildings', HK.Buildings.stats && HK.Buildings.stats.placed, 'landmarks', landmarkCount);
  }

  /* ------------------------------------------------------------- actions */
  function setupActions() {
    var state = app.state;
    var actions = app.actions = {};

    function applyQuality(qn) {
      if (!HK.QUALITY[qn]) return;
      state.quality = qn;
      var q = HK.QUALITY[qn];
      var pr2 = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
      app.renderer.setPixelRatio(pr2);
      app.renderer.setSize(window.innerWidth, window.innerHeight);
      if (app.post) { app.post.setQuality(qn); app.post.resize(window.innerWidth, window.innerHeight, pr2); }
      if (app.sky && app.sky.setQuality) app.sky.setQuality(qn);
      if (app.water && app.water.setQuality) app.water.setQuality(qn);
      if (app.life && app.life.setQuality) app.life.setQuality(qn);
      if (app.props && app.props.setQuality) app.props.setQuality(qn);
      app.renderer.shadowMap.enabled = !!q.shadows;
      app.camera.aspect = window.innerWidth / window.innerHeight;
      app.camera.updateProjectionMatrix();
      app.events.emit('quality', { quality: qn });
    }
    app._applyQuality = applyQuality;

    actions.startExperience = function () {
      if (app.controls) app.controls.startExperience();
      state.started = true;
      try { if (HK.Audio) { HK.Audio.userGesture && HK.Audio.userGesture(); } } catch (e) {}
      toast('歡迎來到維多利亞港', 'WELCOME TO VICTORIA HARBOUR');
    };
    actions.setMode = function (mode, opts) {
      if (!app.controls) return;
      app.controls.setMode(mode, opts || {});
      state.mode = mode;
    };
    actions.setTime = function (h) {
      h = ((Number(h) % 24) + 24) % 24;
      state.timeHours = h;
      if (app.sky) { try { app.sky.setTime(h); } catch (e) {} }
      app.events.emit('time', { hours: h });
    };
    actions.setTimeAuto = function (v) { state.timeAuto = !!v; };
    actions.setTimeSpeed = function (v) { state.timeSpeed = Number(v) || 0.12; };
    actions.setWeather = function (w) {
      state.weather = w;
      if (app.sky) { try { app.sky.setWeather(w); } catch (e) {} }
      app.events.emit('weather', { weather: w });
      toast(w === 'rain' ? '雨夜維港' : w === 'mist' ? '薄霧維港' : '晴朗維港', w === 'rain' ? 'RAIN OVER THE HARBOUR' : w === 'mist' ? 'HARBOUR MIST' : 'CLEAR SKIES');
    };
    actions.setQuality = function (qn) {
      if (!HK.QUALITY[qn]) return;
      applyQuality(qn);
      toast('畫質：' + HK.QUALITY[qn].name, 'QUALITY: ' + qn.toUpperCase());
    };
    actions.setLayer = function (name, on) {
      state.layers[name] = !!on;
      if (app.life) { try { app.life.setLayer(name, !!on); } catch (e) {} }
      if (app.props && app.props.setLayer) { try { app.props.setLayer(name, !!on); } catch (e) {} }
      app.events.emit('layer', { name: name, on: !!on });
    };
    actions.setAudio = function (on) {
      state.audio = !!on;
      try {
        if (HK.Audio) {
          if (on) { HK.Audio.userGesture && HK.Audio.userGesture(); HK.Audio.setEnabled(true); }
          else HK.Audio.setEnabled(false);
        }
      } catch (e) {}
      app.events.emit('audio', { audio: state.audio });
    };
    actions.teleport = function (id) {
      var poi = HK.Layout.POI_BY_ID[id];
      if (!poi) return;
      if (poi.kind === 'walk' || poi.spawn) {
        if (state.mode === 'cinematic') actions.setMode('orbit');
        actions.setMode('fps', { spawn: poi });
        if (app.controls) app.controls.spawnAt(poi);
      } else {
        if (state.mode === 'fps') actions.setMode('orbit');
        if (app.controls && app.controls.focusPoi) app.controls.focusPoi(poi);
      }
      state.poi = id;
      toast(poi.name, poi.en);
    };
    actions.togglePhoto = function () {
      if (state.mode === 'cinematic') { toast('電影模式中不可使用攝影模式', 'PHOTO MODE UNAVAILABLE IN CINEMA'); return; }
      state.photo = !state.photo;
      if (app.controls) app.controls.setPhoto(state.photo);
      if (app.post) app.post.setPhoto(state.photo);
      app.events.emit('photo', { photo: state.photo });
    };
    actions.screenshot = function () {
      try { if (HK.UI && HK.UI.screenshot) HK.UI.screenshot(); } catch (e) {}
    };
    actions.togglePause = function () {
      state.paused = !state.paused;
      app.events.emit('paused', { paused: state.paused });
    };
    actions.nextCinematic = function () { if (app.controls) app.controls.nextCinematic(); };
    actions.prevCinematic = function () { if (app.controls) app.controls.prevCinematic(); };
    actions.resetCamera = function () { if (app.controls) app.controls.resetToDefault(); if (state.mode !== 'orbit') actions.setMode('orbit'); };
    actions.requestPointerLock = function () { if (app.controls) app.controls.requestPointerLock(); };
    actions.openPOI = actions.teleport;
  }

  /* --------------------------------------------------------------- events */
  function setupEvents() {
    var state = app.state;
    document.addEventListener('pointerlockchange', function () {
      app.events.emit('pointerlock', { locked: !!document.pointerLockElement });
    });
    window.addEventListener('resize', function () {
      var w = window.innerWidth, h = window.innerHeight;
      app.camera.aspect = w / h;
      app.camera.updateProjectionMatrix();
      app.renderer.setSize(w, h);
      if (app.post) app.post.resize(w, h, app.renderer.getPixelRatio());
    });
    app.events.on('cinematic', function (p) { try { if (HK.UI && HK.UI.updateCinema) HK.UI.updateCinema(p); } catch (e) {} });
  }

  /* --------------------------------------------------------------- render */
  var fps = { acc: 0, frames: 0 }, playerAcc = 0, timeAcc = 0, last = performance.now();
  var infoAcc = 0;
  function startLoop() {
    var started = false;
    function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.06, Math.max(0.0001, (now - last) / 1000));
      last = now;
      var state = app.state;
      var camera = app.camera;
      if (!app.renderer) return;

      // time of day
      if (state.timeAuto && !state.paused) {
        state.timeHours = (state.timeHours + dt * state.timeSpeed) % 24;
        if (app.sky) app.sky.setTime(state.timeHours);
        timeAcc += dt;
        if (timeAcc > 0.5) { timeAcc = 0; app.events.emit('time', { hours: state.timeHours }); }
      }

      var env = null;
      if (app.controls) app.controls.update(dt);
      if (app.sky) {
        try {
          app.sky.update(dt, state);
          env = app.sky.env;
          if (env) env.colorsLinear = true;
          var focus = app.controls ? app.controls.getFocus() : { x: 0, z: 0, radius: 900 };
          app.sky.setShadowFocus(focus.x, focus.z, focus.radius);
        } catch (e) { if (!window.__SKY_ERR__) { console.error('sky update', e); window.__SKY_ERR__ = 1; } }
      }
      if (app.water && env) { try { app.water.update(dt, state, app.controls ? app.controls.getFocus() : { x: 0, z: 0 }, env); } catch (e) {} }
      if (app.life && env) { try { app.life.update(dt, state, camera, env); } catch (e) { if (!window.__LIFE_ERR__) { console.error('life update', e); window.__LIFE_ERR__ = 1; } } }
      if (app.props) { try { app.props.update(dt, state, env); } catch (e) {} }
      if (env) {
        try { HK.Buildings.update(dt, { night: env.night, horizonColor: (env.glassTint || env.horizonColor), zenithColor: env.zenithColor, colorsLinear: true }); } catch (e) {}
      }
      app.renderer.info.reset();
      if (app.post) {
        try {
          if (env) app.post.setEnv(env);
          app.post.setPhoto(!!state.photo);
          app.post.setCinematic(state.mode === 'cinematic');
          app.post.render(dt);
        } catch (e) {
          if (!window.__POST_ERR__) { console.error('post render', e); window.__POST_ERR__ = 1; }
          app.renderer.render(app.scene, app.camera);
        }
      } else {
        app.renderer.render(app.scene, app.camera);
      }
      var info = app.renderer.info.render;
      app._drawCalls = info.calls;
      app._triangles = info.triangles;

      // HUD data
      playerAcc += dt;
      if (app.controls) {
        state.player = app.controls.getPlayerInfo();
        if (playerAcc > 0.16) { playerAcc = 0; app.events.emit('player', state.player); }
      }
      fps.acc += dt; fps.frames++;
      if (fps.acc > 0.5) {
        state.fps = Math.round(fps.frames / fps.acc);
        app.events.emit('fps', { fps: state.fps });
        fps.acc = 0; fps.frames = 0;
      }
      try { if (HK.UI && HK.UI.update) HK.UI.update(dt); } catch (e) {}

      if (!started) { started = true; app.events.emit('firstframe', {}); }
      if ((QA || window.__CAPTURE_READY__) && !window.__READY__ && info.calls > 0) {
        window.__READY_FRAMES__ = (window.__READY_FRAMES__ || 0) + 1;
        if (window.__READY_FRAMES__ >= 6) {
          window.__INFO__ = {
            drawCalls: info.calls, triangles: info.triangles,
            buildings: HK.Buildings.stats ? HK.Buildings.stats.placed : 0,
            colliders: app.world && app.world.city ? app.world.city.colliders.length : 0,
            quality: state.quality, mode: state.mode, time: state.timeHours,
            landmarks: app.meta.landmarkCount
          };
          window.__READY__ = true;
        }
      }
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------- deep link */
  function applyDeepLink() {
    var state = app.state;
    var c = app.controls;
    if (!c) return;
    if (params.timeAuto === '0') state.timeAuto = false;
    if (params.weather && app.sky) app.sky.setWeather(params.weather);
    if (params.mode === 'fps') {
      c.setMode('fps', { pointerLock: false });
      if (params.poi && HK.Layout.POI_BY_ID[params.poi]) c.spawnAt(HK.Layout.POI_BY_ID[params.poi]);
      if (params.spawn) {
        var sp = String(params.spawn).split(',').map(parseFloat);
        if (sp.length >= 2 && !isNaN(sp[0])) {
          c.fps.pos.set(sp[0], 0, sp[1]);
          var hh = c._terrainAt(sp[0], sp[1]); c.fps.feet = hh < 0 ? 2 : hh + 0.02;
          c.fps.yaw = sp[2] || 0; c.fps.pitch = sp[3] || 0;
          c._applyFpsCamera();
        }
      }
      state.mode = 'fps';
    } else if (params.mode === 'cinematic') {
      c.setMode('cinematic');
      if (params.shot) c._startShot(parseInt(params.shot, 10) || 0);
      state.mode = 'cinematic';
    } else if (params.poi && HK.Layout.POI_BY_ID[params.poi]) {
      c.focusPoi(HK.Layout.POI_BY_ID[params.poi], true);
    }
    if (params.cam) {
      var pos = parseVec3(params.cam), look = parseVec3(params.look) || new THREE.Vector3(0, 40, 0);
      if (pos) {
        if (state.mode !== 'orbit') { c.setMode('orbit'); state.mode = 'orbit'; }
        c.setCamera(pos, look, true);
      }
    }
    if (params.still === '1') state.paused = true;
    if (params.show === '1' && app.life) { try { app.life.triggerShow(); } catch (e) {} }
    if (params.photo === '1') { state.photo = true; if (app.post) app.post.setPhoto(true); }
  }

  /* ------------------------------------------------------------------ go */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot().catch(onError); });
  } else {
    boot().catch(onError);
  }
  function onError(e) {
    console.error('BOOT FAILED', e);
    window.__BOOT_ERROR__ = String(e && (e.stack || e.message || e));
    try {
      var el = document.querySelector('.hk-loader__status, #hk-loader');
      if (el) el.textContent = 'BOOT ERROR: ' + (e && e.message || e);
    } catch (err) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) last = performance.now();
    if (app.state) app.state.paused = false;
  });
})();
