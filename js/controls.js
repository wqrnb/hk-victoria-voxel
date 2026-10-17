/* ============================================================================
 * HK VOXEL HARBOUR — CAMERA / CONTROLS
 * Three ways to experience the sandbox:
 *   orbit      — cinematic sand-table camera (drag / wheel / pan)
 *   fps        — first-person walk with collisions, jump, fly, sprint
 *   cinematic  — scripted camera tours along hand-authored paths
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util, L = HK.Layout;

  function Controls(opts) {
    this.camera = opts.camera;
    this.renderer = opts.renderer;
    this.scene = opts.scene;
    this.world = opts.world;
    this.layout = opts.layout;
    this.sky = opts.sky;
    this.app = opts.app;
    this.state = opts.app.state;
    this.dom = opts.domElement || this.renderer.domElement;
    this.mode = 'orbit';
    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
    this.introDrift = true;
    this.started = false;
    this.photo = false;
    this._t = 0;

    this.orbit = {
      target: new THREE.Vector3(-140, 70, 380),
      desiredTarget: new THREE.Vector3(-140, 70, 380),
      theta: 2.965, phi: 1.525, radius: 570,
      dTheta: 2.965, dPhi: 1.525, dRadius: 570,
      minRadius: 35, maxRadius: 4200, minPhi: 0.10, maxPhi: 1.55
    };
    this._applyOrbitCamera(true);

    this.fps = {
      pos: new THREE.Vector3(10, 2.4, -324),
      feet: 2.0, vy: 0, yaw: 0.15, pitch: -0.02,
      fly: false, onGround: false, crouch: false, keys: {},
      eye: 0.86, eyeCrouch: 0.6, radius: 0.34,
      walk: 1.7, sprint: 3.8, flySpeed: 9.0, jumpV: 2.7, gravity: 5.4, maxStep: 1.3
    };
    this.colliderGrid = this._buildColliderGrid();
    this._initSpawn();

    this.cine = { shots: (L.CINEMATIC || []).map(this._prepShot), index: 0, t: 0, active: false, fov: 44 };
    this._bindEvents();
  }

  /* ------------------------------------------------------------ colliders */
  Controls.prototype._buildColliderGrid = function () {
    var colliders = (this.world.city && this.world.city.colliders) ? this.world.city.colliders : [];
    var cell = 48, grid = {};
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var x0 = Math.floor(c.x0 / cell), x1 = Math.floor(c.x1 / cell);
      var z0 = Math.floor(c.z0 / cell), z1 = Math.floor(c.z1 / cell);
      for (var gx = x0; gx <= x1; gx++) {
        for (var gz = z0; gz <= z1; gz++) {
          var key = gx + ':' + gz;
          (grid[key] = grid[key] || []).push(c);
        }
      }
    }
    return { cell: cell, grid: grid, count: colliders.length };
  };
  Controls.prototype._nearColliders = function (x, z) {
    var g = this.colliderGrid, key = Math.floor(x / g.cell) + ':' + Math.floor(z / g.cell);
    return g.grid[key] || null;
  };

  Controls.prototype._terrainAt = function (x, z) {
    var h = this.world.heightAt(x, z);
    return h < 0 ? -1 : h;
  };

  Controls.prototype._circleHitsRect = function (x, z, r, c) {
    var nx = U.clamp(x, c.x0, c.x1), nz = U.clamp(z, c.z0, c.z1);
    var dx = x - nx, dz = z - nz;
    return dx * dx + dz * dz < r * r;
  };

  /* highest walkable support at (x,z) at or below feet+step */
  Controls.prototype._supportAt = function (x, z, feet, maxUp) {
    var f = this.fps;
    var ground = this._terrainAt(x, z);
    var best = ground; // may be -1 (water)
    var list = this._nearColliders(x, z);
    if (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c.walk) continue;
        if (c.y1 > feet + maxUp) continue;
        if (this._circleHitsRect(x, z, f.radius * 0.9, c)) {
          if (c.y1 > best) best = c.y1;
        }
      }
    }
    return best;
  };

  /** true if the player can't stand/move at this horizontal position */
  Controls.prototype._blockedAt = function (x, z, feet) {
    var f = this.fps;
    var head = feet + f.eye + 0.08;
    var ground = this._terrainAt(x, z);
    if (!f.fly) {
      if (ground < 0) {
        // over water: only allowed while supported by a deck/pier collider
        var supp = this._supportAt(x, z, feet, 1.4);
        if (supp < 0) return true;
      } else if (ground > feet + f.maxStep + 0.05) {
        return true;
      }
    }
    var list = this._nearColliders(x, z);
    if (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (feet + 0.16 >= c.y1) continue;   // can stand / step onto it
        if (head <= c.y0 + 0.06) continue;   // passes underneath
        if (this._circleHitsRect(x, z, f.radius, c)) return true;
      }
    }
    return false;
  };

  /* ----------------------------------------------------------------- orbit */
  Controls.prototype._applyOrbitCamera = function (immediate) {
    var o = this.orbit;
    if (immediate) {
      o.target.copy(o.desiredTarget);
      o.theta = o.dTheta; o.phi = o.dPhi; o.radius = o.dRadius;
    }
    var sp = Math.sin(o.phi), cp = Math.cos(o.phi);
    this.camera.position.set(
      o.target.x + o.radius * sp * Math.sin(o.theta),
      o.target.y + o.radius * cp,
      o.target.z + o.radius * sp * Math.cos(o.theta)
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(o.target);
    this.camera.fov = 46;
    this.camera.updateProjectionMatrix();
  };
  Controls.prototype._orbitUpdate = function (dt) {
    var o = this.orbit;
    if (this.introDrift) {
      o.dTheta += dt * 0.012;
      if (o.dRadius > 1080) o.dRadius -= dt * 6;
    }
    var k = 1 - Math.exp(-dt * 7.5);
    o.theta += (o.dTheta - o.theta) * k;
    o.phi += (o.dPhi - o.phi) * k;
    o.radius += (o.dRadius - o.radius) * k;
    o.target.lerp(o.desiredTarget, 1 - Math.exp(-dt * 6));
    o.dTheta = o.dTheta % (Math.PI * 2);
    o.theta = o.theta % (Math.PI * 2);
    this._applyOrbitCamera();
  };
  Controls.prototype.focusPoi = function (poi, immediate) {
    if (!poi || !poi.cam) return;
    var c = poi.cam;
    var target = new THREE.Vector3(c.target[0], c.target[1], c.target[2]);
    var pos = new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]);
    this.setCamera(pos, target, immediate);
    this.introDrift = false;
    this.app.state.poi = poi.id;
  };
  Controls.prototype.setCamera = function (pos, target, immediate) {
    var o = this.orbit;
    o.desiredTarget.set(target.x, target.y, target.z);
    var dx = pos.x - target.x, dy = pos.y - target.y, dz = pos.z - target.z;
    var r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    o.dRadius = U.clamp(r, o.minRadius, o.maxRadius);
    o.dPhi = U.clamp(Math.acos(U.clamp(dy / (r || 1), -1, 1)), o.minPhi, o.maxPhi);
    o.dTheta = Math.atan2(dx, dz);
    if (immediate) this._applyOrbitCamera(true);
  };
  Controls.prototype.resetToDefault = function () {
    this.setCamera(new THREE.Vector3(-40, 95, -180), new THREE.Vector3(-140, 70, 380));
    this.introDrift = false;
  };

  /* ------------------------------------------------------------------- FPS */
  Controls.prototype._initSpawn = function () {
    var f = this.fps;
    var spawn = { x: 10, z: -324, yaw: 0.15 };
    var pois = L.POIS;
    for (var i = 0; i < pois.length; i++) if (pois[i].kind === 'walk') { spawn = pois[i].spawn; break; }
    f.pos.set(spawn.x, 0, spawn.z);
    var supp = this._supportAt(spawn.x, spawn.z, 8, 8);
    f.feet = supp < 0 ? 2 : supp + 0.02;
    f.yaw = spawn.yaw || 0;
    f.pitch = spawn.pitch || 0;
    f.pos.y = f.feet + f.eye;
  };
  Controls.prototype.spawnAt = function (poi) {
    if (!poi || !poi.spawn) return;
    var f = this.fps, s = poi.spawn;
    f.pos.set(s.x, 0, s.z);
    var supp = this._supportAt(s.x, s.z, 8, 8);
    f.feet = supp < 0 ? 2 : supp + 0.02;
    f.vy = 0; f.onGround = true;
    f.yaw = s.yaw || 0; f.pitch = s.pitch || 0;
    f.pos.y = f.feet + f.eye;
    this._applyFpsCamera();
  };
  Controls.prototype._fpsUpdate = function (dt) {
    var f = this.fps, st = this.state;
    var paused = st.paused;
    var sprint = !!(f.keys['shift']), crouch = !!(f.keys['c']);
    f.crouch = crouch;
    var speed = (f.fly ? f.flySpeed : (sprint ? f.sprint : f.walk)) * (crouch ? 0.55 : 1);
    var mx = 0, mz = 0;
    if (!paused) {
      if (f.keys['w'] || f.keys['arrowup']) mz -= 1;
      if (f.keys['s'] || f.keys['arrowdown']) mz += 1;
      if (f.keys['a'] || f.keys['arrowleft']) mx -= 1;
      if (f.keys['d'] || f.keys['arrowright']) mx += 1;
    }
    var len = Math.sqrt(mx * mx + mz * mz) || 1;
    mx /= len; mz /= len;
    var cy = Math.cos(f.yaw), sy = Math.sin(f.yaw);
    // forward = (-sin yaw, 0, -cos yaw) ; right = (cos yaw, 0, -sin yaw)
    var wx = (-sy * -mz + cy * mx) * speed * dt;
    var wz = (-cy * -mz - sy * mx) * speed * dt;
    if (f.fly) {
      this._moveFly(wx, wz, dt);
    } else {
      this._moveWalk(wx, wz, dt);
    }
    // head bob
    var moving = (mx !== 0 || mz !== 0) && !paused;
    this._bob = (this._bob || 0) + (moving ? dt * (sprint ? 13 : 9) : dt * 2);
    var bobY = moving && !f.fly ? Math.sin(this._bob) * 0.035 : 0;
    var eye = (crouch ? f.eyeCrouch : f.eye) + bobY;
    this.camera.position.set(f.pos.x, f.feet + eye, f.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(f.pitch, f.yaw, 0);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    f.pos.y = f.feet + eye;
  };
  Controls.prototype._moveWalk = function (wx, wz, dt) {
    var f = this.fps;
    var feet = f.feet;
    // horizontal, axis separated for sliding
    if (wx !== 0 && !this._blockedAt(f.pos.x + wx, f.pos.z, feet)) f.pos.x += wx;
    if (wz !== 0 && !this._blockedAt(f.pos.x, f.pos.z + wz, feet)) f.pos.z += wz;
    // ground support
    var supp = this._supportAt(f.pos.x, f.pos.z, feet, f.maxStep + 0.1);
    if (f.onGround) {
      if (supp > feet + 0.01 && supp <= feet + f.maxStep + 0.1) feet = supp; // step up
      else if (supp < feet - 0.02) { f.onGround = false; f.vy = 0; }
      else feet = supp >= 0 ? supp : feet;
    }
    // jumping
    if (f.keys['space'] && f.onGround) { f.vy = f.jumpV; f.onGround = false; }
    if (!f.onGround) {
      f.vy -= f.gravity * dt;
      feet += f.vy * dt;
      if (feet <= supp) { feet = supp; f.vy = 0; f.onGround = true; }
      if (feet < -5) { this._initSpawn(); return; }
    }
    f.feet = feet;
    f.pos.y = feet + f.eye;
  };
  Controls.prototype._moveFly = function (wx, wz, dt) {
    var f = this.fps;
    if (!this._blockedAt(f.pos.x + wx, f.pos.z, f.feet) || f.fly) { f.pos.x += wx; f.pos.z += wz; }
    var rise = 0;
    if (f.keys['space']) rise += f.flySpeed * dt;
    if (f.keys['c']) rise -= f.flySpeed * dt;
    f.feet = U.clamp(f.feet + rise, 0.3, 360);
    f.pos.y = f.feet + f.eye;
  };
  Controls.prototype._applyFpsCamera = function () {
    var f = this.fps;
    this.camera.position.set(f.pos.x, f.feet + f.eye, f.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(f.pitch, f.yaw, 0);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
  };

  /* -------------------------------------------------------------- cinematic */
  Controls.prototype._prepShot = function (s) {
    return {
      id: s.id, title: s.title, en: s.en, caption: s.title + ' · ' + s.en,
      duration: s.duration || 20, fov: s.fov || 44,
      time: s.time, weather: s.weather,
      path: s.path.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }),
      target: s.target.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); })
    };
  };
  Controls.prototype._startShot = function (i) {
    var c = this.cine;
    c.index = ((i % c.shots.length) + c.shots.length) % c.shots.length;
    c.t = 0;
    var s = c.shots[c.index];
    if (!s) return;
    if (this.sky) {
      if (s.time != null) { this.app.state.timeHours = s.time; this.sky.setTime(s.time); this.app.events.emit('time', { hours: s.time }); }
      if (s.weather) { this.app.state.weather = s.weather; this.sky.setWeather(s.weather); this.app.events.emit('weather', { weather: s.weather }); }
    }
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.app.events.emit('cinematic', {
      index: c.index, total: c.shots.length,
      titleZh: s.title, titleEn: s.en, caption: s.title + ' · ' + s.en, duration: s.duration
    });
    this._sampleShot(0);
  };
  Controls.prototype._sampleShot = function (u) {
    var s = this.cine.shots[this.cine.index];
    if (!s) return;
    u = U.clamp(u, 0, 1);
    var n = s.path.length;
    var f = u * (n - 1);
    var i = Math.min(n - 2, Math.floor(f));
    var t = f - i;
    var p0 = s.path[Math.max(0, i - 1)], p1 = s.path[i], p2 = s.path[Math.min(n - 1, i + 1)], p3 = s.path[Math.min(n - 1, i + 2)];
    var pos = new THREE.Vector3(),
      tgt = new THREE.Vector3();
    for (var k = 0; k < 3; k++) {
      var a = p0.getComponent(k), b = p1.getComponent(k), c2 = p2.getComponent(k), d2 = p3.getComponent(k);
      pos.setComponent(k, U.catmullRom(a, b, c2, d2, t));
    }
    var m = s.target.length;
    var f2 = u * (m - 1);
    var i2 = Math.min(m - 2, Math.floor(f2));
    var t2 = f2 - i2;
    var q0 = s.target[Math.max(0, i2 - 1)], q1 = s.target[i2], q2 = s.target[Math.min(m - 1, i2 + 1)], q3 = s.target[Math.min(m - 1, i2 + 2)];
    for (var k2 = 0; k2 < 3; k2++) {
      var a2 = q0.getComponent(k2), b2 = q1.getComponent(k2), c3 = q2.getComponent(k2), d3 = q3.getComponent(k2);
      tgt.setComponent(k2, U.catmullRom(a2, b2, c3, d3, t2));
    }
    this.camera.position.copy(pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(tgt);
    this._cineTarget = tgt;
  };
  Controls.prototype._cinematicUpdate = function (dt) {
    var c = this.cine;
    if (!c.active || !c.shots.length) return;
    c.t += this.state.paused ? 0 : dt;
    var s = c.shots[c.index];
    var u = c.t / s.duration;
    if (u >= 1) {
      this._startShot(c.index + 1);
      return;
    }
    this._sampleShot(u);
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
  };
  Controls.prototype.nextCinematic = function () { if (this.mode !== 'cinematic') return; this._startShot(this.cine.index + 1); };
  Controls.prototype.prevCinematic = function () { if (this.mode !== 'cinematic') return; this._startShot(this.cine.index - 1); };

  /* ------------------------------------------------------------- mode switch */
  Controls.prototype.setMode = function (mode, opts) {
    opts = opts || {};
    if (!mode || mode === this.mode) return;
    if (this.mode === 'fps') this._exitPointerLock();
    var prev = this.mode;
    this.mode = mode;
    this.state.mode = mode;
    if (mode === 'orbit') {
      this.cine.active = false;
      if (prev === 'fps') {
        var f = this.fps;
        var target = new THREE.Vector3(f.pos.x - Math.sin(f.yaw) * 240, 20, f.pos.z - Math.cos(f.yaw) * 240);
        this.setCamera(new THREE.Vector3(f.pos.x, f.feet + 160, f.pos.z + 60), target);
      }
      this._applyOrbitCamera();
    } else if (mode === 'fps') {
      this.cine.active = false;
      if (opts.spawn) this.spawnAt(opts.spawn);
      this._applyFpsCamera();
      if (opts.pointerLock !== false) this.requestPointerLock();
    } else if (mode === 'cinematic') {
      this.cine.active = true;
      this._startShot(0);
    }
    this.app.events.emit('mode', { mode: mode });
  };

  Controls.prototype.requestPointerLock = function () {
    if (this.mode !== 'fps') return;
    var d = this.dom;
    if (!d.requestPointerLock) return;
    try {
      var p = d.requestPointerLock();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  };
  Controls.prototype._exitPointerLock = function () {
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
  };

  /* ------------------------------------------------------------------ input */
  Controls.prototype._bindEvents = function () {
    var self = this;
    var d = this.dom;
    var drag = { on: false, button: 0, x: 0, y: 0 };

    d.addEventListener('pointerdown', function (e) {
      if (self.mode === 'fps' && !document.pointerLockElement) { self.requestPointerLock(); }
      if (self.mode !== 'orbit') return;
      drag.on = true; drag.button = e.button; drag.x = e.clientX; drag.y = e.clientY;
      d.setPointerCapture && d.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    window.addEventListener('pointermove', function (e) {
      if (self.mode === 'fps' && document.pointerLockElement) {
        var sens = 0.0022;
        self.fps.yaw -= e.movementX * sens;
        self.fps.pitch = U.clamp(self.fps.pitch - e.movementY * sens, -1.35, 1.2);
        return;
      }
      if (!drag.on || self.mode !== 'orbit') return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      self.introDrift = false;
      if (drag.button === 2 || e.shiftKey) {
        // pan on ground plane
        var o = self.orbit;
        var scale = o.radius * 0.0016;
        var sy = Math.sin(o.theta), cy = Math.cos(o.theta);
        o.desiredTarget.x -= (cy * dx - 0 * dy) * scale;
        o.desiredTarget.z += (sy * dx) * scale;
        o.desiredTarget.y += dy * scale * 0.35;
        o.desiredTarget.x = U.clamp(o.desiredTarget.x, -1600, 1600);
        o.desiredTarget.z = U.clamp(o.desiredTarget.z, -850, 850);
        o.desiredTarget.y = U.clamp(o.desiredTarget.y, 5, 260);
      } else {
        self.orbit.dTheta -= dx * 0.0042;
        self.orbit.dPhi = U.clamp(self.orbit.dPhi - dy * 0.0035, self.orbit.minPhi, self.orbit.maxPhi);
      }
    });
    window.addEventListener('pointerup', function () { drag.on = false; });
    d.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    d.addEventListener('wheel', function (e) {
      if (self.mode !== 'orbit') return;
      e.preventDefault();
      self.introDrift = false;
      var o = self.orbit;
      o.dRadius = U.clamp(o.dRadius * Math.exp(e.deltaY * 0.001), o.minRadius, o.maxRadius);
    }, { passive: false });
    d.addEventListener('dblclick', function () {
      if (self.mode === 'orbit') self.resetToDefault();
    });

    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      var overlay = (HK.UI && HK.UI.isOverlayOpen) ? HK.UI.isOverlayOpen() : false;
      var key = e.key ? e.key.toLowerCase() : '';
      if (overlay) return;
      if (key === 'escape') {
        if (self.mode === 'fps') { self._exitPointerLock(); self.setMode('orbit'); }
        return;
      }
      if (self.mode === 'fps') {
        if (key === 'f' && !e.repeat) {
          self.fps.fly = !self.fps.fly;
          if (!self.fps.fly) { self.fps.vy = 0; }
          self.app.events.emit('toast', { zh: self.fps.fly ? '自由飛行模式' : '步行模式', en: self.fps.fly ? 'FLY MODE' : 'WALK MODE' });
        }
        if (key === 'c') self.fps.keys['c'] = true;
        if (key === 'shift') self.fps.keys['shift'] = true;
        if (key === ' ') { self.fps.keys['space'] = true; e.preventDefault(); }
        if (key === 'w' || key === 'a' || key === 's' || key === 'd') self.fps.keys[key] = true;
        if (key.indexOf('arrow') === 0) self.fps.keys[key] = true;
      }
    });
    document.addEventListener('keyup', function (e) {
      var key = e.key ? e.key.toLowerCase() : '';
      if (key === 'shift') self.fps.keys['shift'] = false;
      if (key === ' ') self.fps.keys['space'] = false;
      if (key === 'c') self.fps.keys['c'] = false;
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') self.fps.keys[key] = false;
      if (key.indexOf('arrow') === 0) self.fps.keys[key] = false;
    });
    window.addEventListener('blur', function () { self.fps.keys = {}; });
  };

  /* ---------------------------------------------------------------- update */
  Controls.prototype.update = function (dt) {
    this._t += dt;
    if (this.mode === 'orbit') this._orbitUpdate(dt);
    else if (this.mode === 'fps') this._fpsUpdate(dt);
    else if (this.mode === 'cinematic') this._cinematicUpdate(dt);
  };

  Controls.prototype.getFocus = function () {
    if (this.mode === 'fps') return { x: this.fps.pos.x, y: this.fps.feet, z: this.fps.pos.z, radius: 300 };
    if (this.mode === 'cinematic' && this._cineTarget) return { x: this._cineTarget.x, y: this._cineTarget.y, z: this._cineTarget.z, radius: 760 };
    var o = this.orbit;
    return { x: o.target.x, y: o.target.y, z: o.target.z, radius: U.clamp(o.radius * 1.25, 340, 2600) };
  };

  Controls.prototype.getPlayerInfo = function () {
    var f = this.fps, x, y, z, heading;
    if (this.mode === 'fps') {
      x = f.pos.x; z = f.pos.z; y = f.feet + f.eye;
      heading = ((-f.yaw) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    } else {
      x = this.camera.position.x; z = this.camera.position.z; y = this.camera.position.y;
      var dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      heading = Math.atan2(dir.x, -dir.z);
    }
    var d = this.world.districtOf ? this.world.districtOf(x, z) : null;
    var label = d ? { zh: d.name, en: d.en } : { zh: '維多利亞港', en: 'VICTORIA HARBOUR' };
    return {
      x: x, y: y, z: z,
      headingRad: heading, headingDeg: heading * 180 / Math.PI,
      altitudeM: y * HK.VOX,
      districtZh: label.zh, districtEn: label.en,
      fly: this.mode === 'fps' ? f.fly : false
    };
  };

  Controls.prototype.getMode = function () { return this.mode; };
  Controls.prototype.isPointerLocked = function () { return !!document.pointerLockElement; };
  Controls.prototype.startExperience = function () {
    this.introDrift = false;
    this.started = true;
    this.resetToDefault();
  };
  Controls.prototype.setPhoto = function (on) { this.photo = !!on; };

  HK.Controls = {
    create: function (opts) { return new Controls(opts); }
  };
})();
