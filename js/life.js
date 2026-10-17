/* ============================================================================
 * HK VOXEL HARBOUR — LIFE
 * The dynamic layer of Victoria Harbour: traffic, trams, Star Ferries, junk,
 * cargo barges, yachts, pedestrians, seagulls, a helicopter and the nightly
 * "A Symphony of Lights" laser/firework show.
 *
 * Classic script, THREE r149 UMD. No external assets.
 * Units: 1 world unit = 2 m, sea level y = 0.
 *
 * API (see docs/life.md):
 *   HK.Life.create({ scene, renderer, quality, layout }) -> life
 *   life.update(dt, state, camera, env)
 *   life.setQuality(q), life.setLayer(name,on), life.triggerShow(),
 *   life.setNight(v)            // optional override, useful for QA
 *   life.getStats(), life.dispose(), life.group
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util, L = HK.Layout;
  var PI = Math.PI, TAU = PI * 2;
  var PAL = HK.PALETTE || {};
  var QUALITY = HK.QUALITY, QUALITY_ORDER = HK.QUALITY_ORDER || ['low', 'medium', 'high', 'ultra'];

  /* ======================================================== small helpers */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function shade(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
  function hex(h) { return U.hexRgb(h); }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

  // counts are authored against the "ultra" tier and scaled down by quality
  function tierCount(q, map) {
    var t = map[q];
    return t === undefined ? map.medium : t;
  }

  /* ================================================= geometry batch helpers */
  var ATTRS_COLOR = HK.ATTRS_COLOR || [];   // vertex-colour batch (position/normal/color)
  function newBatch() { return new HK.Batch(ATTRS_COLOR); }

  /// axis-aligned box, `baseY` is the bottom face; face shading baked into
  /// vertex colours so flat-shaded Lambert reads as chunky voxel volumes.
  function addBox(b, cx, baseY, cz, sx, sy, sz, col, opt) {
    opt = opt || {};
    var x0 = cx - sx * 0.5, x1 = cx + sx * 0.5;
    var y0 = baseY, y1 = baseY + sy;
    var z0 = cz - sz * 0.5, z1 = cz + sz * 0.5;
    var s = opt.face || 0.86;
    var cTop = opt.top ? shade(col, opt.top) : shade(col, 1.0);
    b.addQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, cTop);
    b.addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, shade(col, s * 1.02));
    b.addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, shade(col, s * 0.94));
    b.addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, shade(col, s * 1.0));
    b.addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, shade(col, s * 0.88));
    if (opt.bottom) b.addQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, shade(col, 0.5));
  }

  var DISPOSABLES = [];
  function trackMaterial(m) { DISPOSABLES.push(m); return m; }
  function trackGeometry(g) { DISPOSABLES.push(g); return g; }

  var MAT_SOLID = null;     // shared vertex-colour Lambert (lit, fogged)
  function solidMaterial() {
    if (!MAT_SOLID) MAT_SOLID = trackMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }));
    return MAT_SOLID;
  }

  function buildSolid(batch, name, cast) {
    var geo = trackGeometry(batch.build());
    var mesh = new THREE.Mesh(geo, solidMaterial());
    mesh.name = name || 'life-solid';
    mesh.castShadow = !!cast;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  function makeInstanced(geo, mat, maxCount, name, cast) {
    var m = new THREE.InstancedMesh(geo, mat, maxCount);
    m.name = name || 'life-inst';
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    m.castShadow = !!cast;
    m.receiveShadow = true;
    return m;
  }
  function instGeo(batch) { return trackGeometry(batch.build()); }

  function makeColorArray(mesh, maxCount, colors, rng) {
    var c = new THREE.Color();
    for (var i = 0; i < maxCount; i++) {
      var arr = colors[i % colors.length];
      var f = 0.88 + rng.next() * 0.24;
      c.setRGB(clamp(arr[0] * f, 0, 1), clamp(arr[1] * f, 0, 1), clamp(arr[2] * f, 0, 1));
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /* ====================================================== route utilities
   * A "route" is a resampled polyline with per-sample ground height and a
   * list of contiguous land spans (arc-length intervals). Layout data is
   * probed with terrainHeight(): -1 means water -> traffic/trams/pedestrians
   * are only ever placed on land, which keeps the layer robust against
   * shoreline tweaks by the geography owner.
   * ---------------------------------------------------------------------- */
  function buildRoute(pts, step, minSpan) {
    var total = L.polylineLength(pts);
    if (!isFinite(total) || total < 8) return null;
    var n = Math.max(2, Math.floor(total / step) + 1);
    var sx = new Float32Array(n), sz = new Float32Array(n);
    var sy = new Float32Array(n), ok = new Uint8Array(n);
    var i, p;
    for (i = 0; i < n; i++) {
      p = L.polylinePointAtDistance(pts, Math.min(total, i * step));
      var px = (p && isFinite(p.x)) ? p.x : (i > 0 ? sx[i - 1] : 0);
      var pz = (p && isFinite(p.z)) ? p.z : (i > 0 ? sz[i - 1] : 0);
      sx[i] = px; sz[i] = pz;
      var h = L.terrainHeight(px, pz);
      if (!isFinite(h)) h = -1;
      ok[i] = h >= 0 ? 1 : 0;
      sy[i] = h >= 0 ? h : 1;
    }
    // smoothed unit tangents (central difference) so headings don't snap at joints
    var dx = new Float32Array(n), dz = new Float32Array(n);
    for (i = 0; i < n; i++) {
      var a = Math.max(0, i - 2), b2 = Math.min(n - 1, i + 2);
      var vx = sx[b2] - sx[a], vz = sz[b2] - sz[a], vl = Math.sqrt(vx * vx + vz * vz);
      if (!isFinite(vl) || vl < 1e-6) { dx[i] = 1; dz[i] = 0; }
      else { dx[i] = vx / vl; dz[i] = vz / vl; }
    }
    var spans = [], cur = null;
    for (i = 0; i < n; i++) {
      var d = i * step;
      if (ok[i]) {
        if (!cur) cur = { d0: d, d1: d };
        cur.d1 = d;
      } else if (cur) {
        if (cur.d1 - cur.d0 >= minSpan) spans.push(cur);
        cur = null;
      }
    }
    if (cur && cur.d1 - cur.d0 >= minSpan) spans.push(cur);
    var validLen = 0;
    for (i = 0; i < spans.length; i++) validLen += spans[i].d1 - spans[i].d0;
    return {
      pts: pts, total: total, step: step, n: n,
      sx: sx, sz: sz, sy: sy, ok: ok, dx: dx, dz: dz,
      spans: spans, validLen: validLen
    };
  }

  /// O(1) sample: position, tangent and ground height at arc distance d
  function routeAt(rt, d, out) {
    var f = clamp(d / rt.step, 0, rt.n - 1.0001);
    if (!isFinite(f)) f = 0;
    var k = Math.floor(f), t = f - k;
    var k1 = Math.min(k + 1, rt.n - 1);
    out.x = rt.sx[k] + (rt.sx[k1] - rt.sx[k]) * t;
    out.z = rt.sz[k] + (rt.sz[k1] - rt.sz[k]) * t;
    out.y = rt.sy[t < 0.5 ? k : k1];
    out.dx = rt.dx[k] + (rt.dx[k1] - rt.dx[k]) * t;
    out.dz = rt.dz[k] + (rt.dz[k1] - rt.dz[k]) * t;
    if (!isFinite(out.x)) out.x = rt.sx[k];
    if (!isFinite(out.z)) out.z = rt.sz[k];
    if (!isFinite(out.y)) out.y = 1;
    var fl = Math.sqrt(out.dx * out.dx + out.dz * out.dz);
    if (!isFinite(fl) || fl < 1e-6) { out.dx = 1; out.dz = 0; }
    else { out.dx /= fl; out.dz /= fl; }
    return out;
  }

  // finite-number helpers used by the per-frame update paths
  function fin(v, fb) { return (typeof v === 'number' && isFinite(v)) ? v : fb; }
  var DEG_SAFE = 0.0001;

  function spanPick(rt, rng) {
    // weighted random land span, then a random d inside it
    var total = rt.validLen || 1, r = rng.next() * total, i, acc = 0;
    for (i = 0; i < rt.spans.length; i++) {
      var s = rt.spans[i], len = s.d1 - s.d0;
      if (acc + len >= r) {
        return { d: s.d0 + (s.d1 - s.d0) * (0.03 + rng.next() * 0.94), span: s };
      }
      acc += len;
    }
    var last = rt.spans[rt.spans.length - 1];
    return { d: (last.d0 + last.d1) * 0.5, span: last };
  }

  /* ================================================================ palette */
  var C = {
    wheel: hex('#1a1a1d'),
    glass: hex('#16232b'),
    glassWarm: hex('#2a3038'),
    headlight: hex('#fff0c8'),
    taillight: hex('#ff2a1a'),
    tramGreen: hex('#1f6b4f'),
    tramCream: hex('#e8e2cf'),
    starGreen: hex('#2f6b4c'),
    starWhite: hex('#e8e3d7'),
    junkRed: hex('#b0261f'),
    junkWood: hex('#5c3a28'),
    barge: hex('#4b4e52'),
    bargeDeck: hex('#6a6a66'),
    yachtWhite: hex('#f0efe9'),
    yachtBlue: hex('#27445e'),
    heli: hex('#333b44'),
    heliGlass: hex('#22303a'),
    pole: hex('#4a4d50'),
    skin: hex('#c9a383'),
    headDark: hex('#1e1b18'),
    trouser: hex('#2b3340')
  };

  var CAR_COLORS = [
    [0.86, 0.87, 0.89], [0.55, 0.57, 0.60], [0.10, 0.10, 0.12],
    [0.22, 0.28, 0.42], [0.68, 0.70, 0.74], [0.34, 0.39, 0.42],
    [0.52, 0.16, 0.15], [0.72, 0.74, 0.72], [0.16, 0.22, 0.20]
  ];
  var BUS_COLORS = [
    [0.72, 0.16, 0.14], [0.86, 0.86, 0.83], [0.10, 0.34, 0.58],
    [0.82, 0.62, 0.12]
  ];
  var MINIBUS_COLORS = [
    [0.88, 0.90, 0.82], [0.62, 0.80, 0.66], [0.93, 0.91, 0.84]
  ];
  var TRUCK_COLORS = [
    [0.85, 0.85, 0.83], [0.55, 0.60, 0.66], [0.80, 0.78, 0.70]
  ];
  var TAXI_COLORS = [[0.80, 0.13, 0.14], [0.86, 0.18, 0.16], [0.72, 0.11, 0.13]];
  var PEOPLE_COLORS = [
    [0.18, 0.22, 0.30], [0.78, 0.76, 0.70], [0.55, 0.18, 0.18],
    [0.22, 0.35, 0.30], [0.85, 0.82, 0.74], [0.12, 0.12, 0.15],
    [0.38, 0.30, 0.45], [0.70, 0.46, 0.18], [0.90, 0.88, 0.82],
    [0.18, 0.36, 0.48], [0.62, 0.62, 0.66], [0.80, 0.30, 0.40]
  ];
  var BEAM_COLORS = [
    [0.24, 0.88, 1.00], [1.00, 0.31, 0.64], [0.30, 1.00, 0.62],
    [1.00, 0.71, 0.28], [0.71, 0.42, 1.00], [0.55, 0.92, 1.00],
    [0.40, 0.60, 1.00], [1.00, 0.55, 0.85]
  ];

  /* ====================================================== geometry factories */
  function sedanGeometry(withSign) {
    var b = newBatch();
    var whiteB = [1, 1, 1];
    var W = 0.92, L0 = 2.16;
    addBox(b, 0, 0.22, 0, L0, 0.34, W, whiteB, { face: 0.9 });
    addBox(b, -0.10, 0.54, 0, 1.12, 0.30, 0.78, whiteB, { face: 0.92 });
    addBox(b, -0.10, 0.62, 0, 0.98, 0.18, 0.80, C.glass);
    // wheels
    addBox(b, 0.68, 0, 0.34, 0.30, 0.23, 0.16, C.wheel);
    addBox(b, 0.68, 0, -0.34, 0.30, 0.23, 0.16, C.wheel);
    addBox(b, -0.68, 0, 0.34, 0.30, 0.23, 0.16, C.wheel);
    addBox(b, -0.68, 0, -0.34, 0.30, 0.23, 0.16, C.wheel);
    // lamps
    addBox(b, 1.09, 0.34, 0.26, 0.05, 0.11, 0.22, C.headlight);
    addBox(b, 1.09, 0.34, -0.26, 0.05, 0.11, 0.22, C.headlight);
    addBox(b, -1.10, 0.34, 0.26, 0.05, 0.11, 0.22, C.taillight);
    addBox(b, -1.10, 0.34, -0.26, 0.05, 0.11, 0.22, C.taillight);
    if (withSign) addBox(b, -0.10, 0.84, 0, 0.28, 0.13, 0.34, [1, 0.94, 0.75]);
    return instGeo(b);
  }

  function busGeometry() {
    var b = newBatch();
    var whiteB = [0.97, 0.97, 0.95];
    var L0 = 5.5, W = 1.24;
    addBox(b, -0.05, 0.30, 0, L0, 0.95, W, whiteB, { face: 0.9 });
    addBox(b, -0.05, 0.62, 0, L0 - 0.7, 0.34, W + 0.04, C.glass);
    addBox(b, -0.05, 1.25, 0, L0, 0.85, W, whiteB, { face: 0.9 });
    addBox(b, -0.05, 1.44, 0, L0 - 0.7, 0.46, W + 0.04, C.glass);
    addBox(b, -0.05, 2.10, 0, L0 - 0.1, 0.09, W - 0.06, shade(whiteB, 0.88));
    // windshield / rear
    addBox(b, 2.70, 0.75, 0, 0.07, 1.25, W - 0.16, C.glass);
    addBox(b, -2.78, 0.75, 0, 0.07, 1.25, W - 0.2, C.glass);
    // wheels
    addBox(b, 1.75, 0, 0.52, 0.44, 0.30, 0.20, C.wheel);
    addBox(b, 1.75, 0, -0.52, 0.44, 0.30, 0.20, C.wheel);
    addBox(b, -1.75, 0, 0.52, 0.44, 0.30, 0.20, C.wheel);
    addBox(b, -1.75, 0, -0.52, 0.44, 0.30, 0.20, C.wheel);
    addBox(b, 2.74, 0.36, 0.42, 0.06, 0.16, 0.28, C.headlight);
    addBox(b, 2.74, 0.36, -0.42, 0.06, 0.16, 0.28, C.headlight);
    return instGeo(b);
  }

  function minibusGeometry() {
    var b = newBatch();
    var whiteB = [0.96, 0.95, 0.90];
    var L0 = 3.4, W = 1.04;
    addBox(b, 0, 0.42, 0, L0, 0.86, W, whiteB, { face: 0.9 });
    addBox(b, 0, 0.64, 0, L0 - 0.6, 0.34, W + 0.04, C.glass);
    addBox(b, 0, 1.28, 0, L0 - 0.1, 0.08, W - 0.04, shade(whiteB, 0.86));
    addBox(b, 1.68, 0.52, 0, 0.06, 0.62, W - 0.14, C.glass);
    addBox(b, 0.95, 0, 0.45, 0.32, 0.26, 0.18, C.wheel);
    addBox(b, 0.95, 0, -0.45, 0.32, 0.26, 0.18, C.wheel);
    addBox(b, -0.95, 0, 0.45, 0.32, 0.26, 0.18, C.wheel);
    addBox(b, -0.95, 0, -0.45, 0.32, 0.26, 0.18, C.wheel);
    addBox(b, 1.70, 0.34, 0.34, 0.05, 0.12, 0.2, C.headlight);
    addBox(b, 1.70, 0.34, -0.34, 0.05, 0.12, 0.2, C.headlight);
    return instGeo(b);
  }

  function truckGeometry() {
    var b = newBatch();
    var whiteB = [0.88, 0.88, 0.86];
    var boxCol = hex('#b9b6ab');
    addBox(b, -0.80, 0.55, 0, 3.0, 1.18, 1.12, boxCol, { face: 0.92 });
    addBox(b, 1.35, 0.28, 0, 1.5, 1.15, 1.08, whiteB, { face: 0.9 });
    addBox(b, 2.08, 0.62, 0, 0.07, 0.72, 0.92, C.glass);
    addBox(b, -2.28, 0.6, 0, 0.06, 1.0, 1.0, shade(boxCol, 0.8));
    addBox(b, 1.35, 0, 0.50, 0.34, 0.28, 0.20, C.wheel);
    addBox(b, 1.35, 0, -0.50, 0.34, 0.28, 0.20, C.wheel);
    addBox(b, -1.55, 0, 0.50, 0.34, 0.28, 0.20, C.wheel);
    addBox(b, -1.55, 0, -0.50, 0.34, 0.28, 0.20, C.wheel);
    addBox(b, 2.12, 0.34, 0.36, 0.05, 0.12, 0.22, C.headlight);
    addBox(b, 2.12, 0.34, -0.36, 0.05, 0.12, 0.22, C.headlight);
    return instGeo(b);
  }

  function tramGeometry() {
    var b = newBatch();
    var L0 = 8.6, W = 1.32;
    // dark underframe + wheels
    addBox(b, 0, 0.05, 0, L0 - 0.6, 0.3, W - 0.1, C.wheel);
    addBox(b, 2.8, 0.02, 0.58, 0.6, 0.26, 0.16, C.wheel);
    addBox(b, 2.8, 0.02, -0.58, 0.6, 0.26, 0.16, C.wheel);
    addBox(b, -2.8, 0.02, 0.58, 0.6, 0.26, 0.16, C.wheel);
    addBox(b, -2.8, 0.02, -0.58, 0.6, 0.26, 0.16, C.wheel);
    addBox(b, 0, 0.34, 0, L0, 0.52, W, C.tramGreen, { face: 0.92 });
    addBox(b, 0, 0.86, 0, L0 - 0.3, 0.40, W + 0.04, C.glass);
    addBox(b, 0, 1.26, 0, L0, 0.12, W, C.tramCream, { face: 0.95 });
    addBox(b, 0, 1.38, 0, L0, 0.26, W, C.tramCream, { face: 0.95 });
    addBox(b, 0, 1.64, 0, L0 - 0.3, 0.42, W + 0.04, C.glass);
    addBox(b, 0, 2.06, 0, L0 - 0.2, 0.16, W - 0.06, C.tramGreen, { top: 1.05 });
    addBox(b, 0, 2.22, 0, L0 - 0.5, 0.09, W - 0.2, shade(C.tramCream, 0.9));
    // windscreens at both ends (double-ended tram)
    addBox(b, L0 * 0.5 - 0.02, 0.95, 0, 0.08, 0.9, W - 0.2, C.glass);
    addBox(b, -L0 * 0.5 + 0.02, 0.95, 0, 0.08, 0.9, W - 0.2, C.glass);
    // destination plate
    addBox(b, L0 * 0.5 - 0.02, 1.72, 0, 0.07, 0.22, 0.9, [0.95, 0.9, 0.75]);
    // trolley pole + base
    addBox(b, -1.2, 2.22, 0, 0.10, 0.74, 0.10, C.pole);
    addBox(b, -1.2, 2.16, 0, 0.5, 0.08, 0.3, C.pole);
    // head/tail lamps both ends
    addBox(b, L0 * 0.5 + 0.02, 0.52, 0.36, 0.05, 0.12, 0.22, C.headlight);
    addBox(b, L0 * 0.5 + 0.02, 0.52, -0.36, 0.05, 0.12, 0.22, C.headlight);
    addBox(b, -L0 * 0.5 - 0.02, 0.52, 0.36, 0.05, 0.12, 0.22, C.taillight);
    addBox(b, -L0 * 0.5 - 0.02, 0.52, -0.36, 0.05, 0.12, 0.22, C.taillight);
    return instGeo(b);
  }

  function starFerryGeometry() {
    var b = newBatch();
    var L0 = 42, W = 11.5;
    // hull (green) with white boot stripe and stepped double-ended bows
    addBox(b, 0, 0.15, 0, L0 - 4, 1.30, W, C.starGreen, { face: 0.9 });
    addBox(b, 0, 1.00, 0, L0 - 3.6, 0.34, W + 0.12, C.starWhite, { face: 0.95 });
    addBox(b, L0 * 0.5 - 1.9, 0.15, 0, 2.2, 1.2, W - 2.6, C.starGreen, { face: 0.9 });
    addBox(b, -L0 * 0.5 + 1.9, 0.15, 0, 2.2, 1.2, W - 2.6, C.starGreen, { face: 0.9 });
    addBox(b, L0 * 0.5 - 0.8, 0.15, 0, 1.2, 1.05, W - 5.4, C.starGreen, { face: 0.9 });
    addBox(b, -L0 * 0.5 + 0.8, 0.15, 0, 1.2, 1.05, W - 5.4, C.starGreen, { face: 0.9 });
    // main deck salon
    addBox(b, 0, 1.5, 0, 36, 1.1, 9.0, C.starWhite, { face: 0.94 });
    addBox(b, 0, 1.7, 0, 33, 0.52, 9.2, C.glass);
    // upper deck
    addBox(b, 0, 2.6, 0, 32, 1.0, 8.4, C.starWhite, { face: 0.94 });
    addBox(b, 0, 2.76, 0, 29, 0.46, 8.6, C.glass);
    // roof
    addBox(b, 0, 3.6, 0, 33, 0.14, 8.8, shade(C.starWhite, 0.92), { top: 1.06 });
    // wheelhouses at both ends
    addBox(b, 15.5, 1.55, 0, 5, 1.85, 7, C.starWhite, { face: 0.95 });
    addBox(b, 15.5, 1.85, 0, 4.4, 0.6, 7.2, C.glass);
    addBox(b, -15.5, 1.55, 0, 5, 1.85, 7, C.starWhite, { face: 0.95 });
    addBox(b, -15.5, 1.85, 0, 4.4, 0.6, 7.2, C.glass);
    // masts
    addBox(b, 19.5, 3.7, 0, 0.26, 1.3, 0.26, C.pole);
    addBox(b, -19.5, 3.7, 0, 0.26, 1.3, 0.26, C.pole);
    // upper-deck railings + roof furniture (reads at a distance)
    addBox(b, 0, 3.74, 4.15, 32, 0.22, 0.1, C.starWhite);
    addBox(b, 0, 3.74, -4.15, 32, 0.22, 0.1, C.starWhite);
    addBox(b, 15.4, 3.74, 0, 0.1, 0.22, 7.0, C.starWhite);
    addBox(b, -15.4, 3.74, 0, 0.1, 0.22, 7.0, C.starWhite);
    // orange life-rafts + little green trim on the roof
    var raft = [0.85, 0.38, 0.16];
    addBox(b, 9, 3.74, 2.8, 0.7, 0.28, 0.5, raft);
    addBox(b, -9, 3.74, -2.8, 0.7, 0.28, 0.5, raft);
    addBox(b, 5, 3.74, -3.2, 0.7, 0.28, 0.5, raft);
    addBox(b, -5, 3.74, 3.2, 0.7, 0.28, 0.5, raft);
    // small green bow/stern caps
    addBox(b, 20.6, 1.45, 0, 0.6, 0.5, 2.0, C.starGreen);
    addBox(b, -20.6, 1.45, 0, 0.6, 0.5, 2.0, C.starGreen);
    return instGeo(b);
  }

  function junkGeometry() {
    var b = newBatch();
    var L0 = 19, W = 5;
    addBox(b, 0, 0.2, 0, L0 - 3, 1.35, W, C.junkWood, { face: 0.9 });
    addBox(b, L0 * 0.5 - 1.4, 0.2, 0, 2.8, 1.1, W - 1.4, C.junkWood, { face: 0.9 });
    addBox(b, -L0 * 0.5 + 1.4, 0.2, 0, 2.8, 1.2, W - 1.2, C.junkWood, { face: 0.9 });
    addBox(b, 0, 1.55, 0, L0 - 5, 0.28, W - 0.4, shade(C.junkWood, 1.15));
    addBox(b, -3.5, 1.8, 0, 5, 1.0, 3.2, shade(C.junkWood, 0.85), { face: 0.9 });
    // three masts + battened red sails
    var mastX = [-6.2, -0.6, 5.0];
    var sailW = [4.6, 4.2, 3.4];
    var sailH = [5.4, 6.2, 4.8];
    for (var i = 0; i < 3; i++) {
      addBox(b, mastX[i], 1.8, 0, 0.22, sailH[i] + 1.0, 0.22, C.pole);
      addBox(b, mastX[i] + 0.6, 2.4, 0, sailW[i], sailH[i], 0.22, C.junkRed);
      for (var k = 0; k < 4; k++) {
        addBox(b, mastX[i] + 0.6, 2.6 + k * (sailH[i] / 4), 0, sailW[i] * 1.06, 0.12, 0.34, shade(C.junkRed, 0.55));
      }
    }
    return instGeo(b);
  }

  function cargoGeometry() {
    var b = newBatch();
    var L0 = 34, W = 10;
    addBox(b, 0, 0.15, 0, L0, 1.35, W, C.barge, { face: 0.9 });
    addBox(b, 0, 1.5, 0, L0 - 0.6, 0.14, W - 0.3, C.bargeDeck, { top: 1.05 });
    // container stacks
    var contCols = [hex('#a03830'), hex('#2c5a86'), hex('#3f6a4a'), hex('#b7b0a2'), hex('#6b4a2f'), hex('#2f3f4d')];
    var rng = new HK.Rng(0x51F7);
    for (var ix = 0; ix < 7; ix++) {
      for (var iz = 0; iz < 2; iz++) {
        if (rng.chance(0.18)) continue;
        var cx = -13 + ix * 4.1;
        var cz = (iz === 0 ? -2.6 : 2.6);
        var h = rng.chance(0.45) ? 2 : 1;
        for (var iy = 0; iy < h; iy++) {
          addBox(b, cx, 1.64 + iy * 1.05, cz, 3.9, 1.0, 2.3, contCols[rng.int(0, 5)], { face: 0.94 });
        }
      }
    }
    // wheelhouse
    addBox(b, 13.5, 1.64, 0, 4.5, 2.1, 5.2, shade(C.barge, 1.5), { face: 0.95 });
    addBox(b, 13.5, 2.4, 0, 3.9, 0.7, 5.4, C.glass);
    return instGeo(b);
  }

  function yachtGeometry() {
    var b = newBatch();
    var L0 = 9, W = 2.8;
    addBox(b, 0, 0.2, 0, L0, 0.9, W, C.yachtWhite, { face: 0.94 });
    addBox(b, 0, 0.66, 0, L0 + 0.15, 0.16, W + 0.05, C.yachtBlue);
    addBox(b, -0.3, 1.1, 0, 3.8, 0.82, 2.2, C.yachtWhite, { face: 0.94 });
    addBox(b, -0.3, 1.34, 0, 3.1, 0.34, 2.24, C.glass);
    addBox(b, -0.3, 1.92, 0, 4.0, 0.1, 2.3, shade(C.yachtWhite, 0.92));
    addBox(b, 1.9, 1.1, 0, 0.9, 0.3, 1.6, C.yachtWhite, { face: 0.94 });
    addBox(b, -1.6, 2.0, 0, 0.12, 1.5, 0.12, C.pole);
    return instGeo(b);
  }

  function personGeometry() {
    var b = newBatch();
    var shirt = [1, 1, 1];         // tinted per instance
    var legL = 0.34, legW = 0.13, gap = 0.03;
    addBox(b, -gap, 0, 0, legW, 0.34, 0.14, C.trouser);
    addBox(b, gap + legW, 0, 0, legW, 0.34, 0.14, C.trouser);
    addBox(b, 0, 0.34, 0, 0.34, 0.30, 0.22, shirt, { face: 0.94 });
    // arms
    addBox(b, -0.22, 0.38, 0, 0.11, 0.26, 0.13, shade(shirt, 1.02));
    addBox(b, 0.22, 0.38, 0, 0.11, 0.26, 0.13, shade(shirt, 1.02));
    // head + hair
    addBox(b, 0, 0.64, 0, 0.17, 0.18, 0.17, C.skin);
    addBox(b, 0, 0.80, 0, 0.18, 0.07, 0.18, C.headDark);
    return instGeo(b);
  }

  function helicopterGeometry() {
    var b = newBatch();
    addBox(b, 0, 0.35, 0, 3.6, 1.35, 1.5, C.heli, { face: 0.92, top: 1.08 });
    addBox(b, 1.5, 0.75, 0, 1.1, 0.65, 1.3, C.heliGlass);
    addBox(b, -2.9, 0.85, 0, 3.0, 0.42, 0.5, C.heli);
    addBox(b, -4.6, 0.82, 0, 1.4, 0.9, 0.3, C.heli);
    addBox(b, 0, 1.7, 0, 0.5, 0.2, 0.5, shade(C.heli, 0.8));
    // skids
    addBox(b, 0.2, -0.25, 0.75, 2.6, 0.1, 0.12, C.heli);
    addBox(b, 0.2, -0.25, -0.75, 2.6, 0.1, 0.12, C.heli);
    addBox(b, 0.2, -0.25, 0, 0.1, 0.5, 1.6, shade(C.heli, 0.8));
    // tail rotor blur
    addBox(b, -5.2, 0.7, 0.4, 0.08, 1.1, 0.5, shade(C.heli, 1.3));
    return instGeo(b);
  }

  function rotorGeometry() {
    var b = newBatch();
    var c = shade(C.heli, 0.55);
    addBox(b, 0, 0, 0, 13, 0.07, 0.45, c);
    addBox(b, 0, 0, 0, 0.45, 0.07, 13, c);
    addBox(b, 0, -0.06, 0, 0.7, 0.18, 0.7, shade(C.heli, 0.7));
    return instGeo(b);
  }

  /* ================================================== light points system */
  var LIGHT_MAX = 2600;
  function createLightPoints(renderer) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(LIGHT_MAX * 3);
    var col = new Float32Array(LIGHT_MAX * 3);
    var size = new Float32Array(LIGHT_MAX);
    var alpha = new Float32Array(LIGHT_MAX);
    // keep every slot finite from frame 0 (three computes bounds lazily and
    // a single NaN would poison the *whole* draw batch)
    for (var li = 0; li < LIGHT_MAX; li++) { col[li * 3] = 1; col[li * 3 + 1] = 1; col[li * 3 + 2] = 1; size[li] = 1; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uNight: { value: 1.0 },
        uPxScale: { value: 900.0 },
        uMinPx: { value: 1.8 },
        uMaxPx: { value: 30.0 }
      },
      vertexShader: [
        'attribute vec3 aColor;',
        'attribute float aSize;',
        'attribute float aAlpha;',
        'varying vec3 vColor;',
        'varying float vAlpha;',
        'uniform float uNight;',
        'uniform float uPxScale;',
        'uniform float uMinPx;',
        'uniform float uMaxPx;',
        'void main() {',
        '  vColor = aColor;',
        '  vAlpha = aAlpha * uNight;',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float ps = aSize * uPxScale / max(1.0, -mv.z);',
        '  gl_PointSize = clamp(ps, uMinPx, uMaxPx);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor;',
        'varying float vAlpha;',
        'void main() {',
        '  vec2 d = gl_PointCoord - vec2(0.5);',
        '  float r = length(d) * 2.0;',
        '  if (r > 1.0) discard;',
        '  float a = 1.0 - r;',
        '  a = a * a * vAlpha;',
        '  gl_FragColor = vec4(vColor * a, 1.0);',
        '}'
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true
    });
    trackMaterial(mat);
    var pts = new THREE.Points(geo, mat);
    pts.name = 'life-light-points';
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    return {
      points: pts, geo: geo, mat: mat,
      pos: pos, col: col, size: size, alpha: alpha,
      n: 0,
      clear: function () { this.n = 0; },
      push: function (x, y, z, c, sz, al) {
        if (this.n >= LIGHT_MAX) return;
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return;
        var i = this.n++;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.col[i * 3] = fin(c && c[0], 1); this.col[i * 3 + 1] = fin(c && c[1], 1); this.col[i * 3 + 2] = fin(c && c[2], 1);
        this.size[i] = fin(sz, 1); this.alpha[i] = clamp(fin(al, 1), 0, 2);
      },
      flush: function () {
        var g = this.geo;
        g.setDrawRange(0, this.n);
        g.attributes.position.needsUpdate = true;
        g.attributes.aColor.needsUpdate = true;
        g.attributes.aSize.needsUpdate = true;
        g.attributes.aAlpha.needsUpdate = true;
      }
    };
  }

  /* ============================================================== create */
  function create(opts) {
    opts = opts || {};
    var scene = opts.scene;
    var renderer = opts.renderer;
    var rng = new HK.Rng(0xC0FFEE);
    var layout = opts.layout || L;

    var group = new THREE.Group();
    group.name = 'Life';
    var gTraffic = new THREE.Group(); gTraffic.name = 'LifeTraffic';
    var gFerries = new THREE.Group(); gFerries.name = 'LifeFerries';
    var gPeople = new THREE.Group(); gPeople.name = 'LifePeople';
    var gAir = new THREE.Group(); gAir.name = 'LifeAir';
    var gShow = new THREE.Group(); gShow.name = 'LifeShow';
    group.add(gTraffic, gFerries, gPeople, gAir, gShow);
    if (scene) scene.add(group);

    var qualityName = opts.quality && QUALITY[opts.quality] ? opts.quality : 'medium';
    var Q = QUALITY[qualityName] || QUALITY.medium;
    var layers = { traffic: true, ferries: true, people: true, aircraft: true, show: true };

    var timeAcc = 0;
    var nightF = 0;             // smoothed 0..1
    var forcedNight = -1;
    var envRef = null;
    var sunDir = new THREE.Vector3(0.5, 0.4, 0.3).normalize();

    /* ------------------------------------------------------- traffic setup */
    var trafficRoads = [];
    (function buildTrafficRoads() {
      for (var i = 0; i < L.ROADS.length; i++) {
        var r = L.ROADS[i];
        if (r.type === 'tunnel' || r.type === 'track') continue;
        var rt = buildRoute(r.pts, 6, 46);
        if (!rt || !rt.spans.length) continue;
        rt.road = r;
        trafficRoads.push(rt);
      }
    })();

    var VEH_TYPES = {
      sedan: { geo: sedanGeometry(false), share: 0.52, len: 2.2, colors: CAR_COLORS, speed: [6.0, 9.5], n: 0, mesh: null, items: [] },
      taxi: { geo: sedanGeometry(true), share: 0.24, len: 2.2, colors: TAXI_COLORS, speed: [6.5, 10.0], n: 0, mesh: null, items: [] },
      bus: { geo: busGeometry(), share: 0.08, len: 5.5, colors: BUS_COLORS, speed: [3.8, 5.2], n: 0, mesh: null, items: [] },
      minibus: { geo: minibusGeometry(), share: 0.08, len: 3.6, colors: MINIBUS_COLORS, speed: [4.5, 6.5], n: 0, mesh: null, items: [] },
      truck: { geo: truckGeometry(), share: 0.08, len: 4.6, colors: TRUCK_COLORS, speed: [4.2, 6.2], n: 0, mesh: null, items: [] }
    };
    var TRAFFIC_MAX = 460;      // ultra tier total
    var trafficTotalRoadLen = 0;
    for (var ri = 0; ri < trafficRoads.length; ri++) trafficTotalRoadLen += trafficRoads[ri].validLen;
    var vehTypes = [];
    (function buildTraffic() {
      if (!trafficRoads.length) return;
      var dummyMat = solidMaterial();
      var names = ['sedan', 'taxi', 'bus', 'minibus', 'truck'];
      for (var t = 0; t < names.length; t++) {
        var vt = VEH_TYPES[names[t]];
        vt.kind = names[t];
        var maxCount = Math.round(TRAFFIC_MAX * vt.share);
        var mesh = makeInstanced(vt.geo, dummyMat, maxCount, 'traffic-' + names[t], true);
        makeColorArray(mesh, maxCount, vt.colors, rng);
        gTraffic.add(mesh);
        vt.mesh = mesh;
        vt.max = maxCount;
        vt.items = [];
        for (var i = 0; i < maxCount; i++) {
          var rt = trafficRoads[rng.int(0, trafficRoads.length - 1)];
          var pick = spanPick(rt, rng);
          var dir = rng.chance(0.5) ? 1 : -1;
          vt.items.push({
            rt: rt,
            d: pick.d,
            span: pick.span,
            dir: dir,
            speed: rng.float(vt.speed[0], vt.speed[1]),
            lane: rt.road.width * 0.22 * (0.92 + rng.next() * 0.16),
            ph: rng.float(0, TAU)
          });
        }
        vehTypes.push(vt);
      }
    })();

    var trafficCount = 0;
    function allocTraffic(n) {
      var total = 0, t;
      for (t = 0; t < vehTypes.length; t++) {
        var vt = vehTypes[t];
        var c = Math.round(n * vt.share);
        c = Math.min(c, vt.max, vt.items.length);
        vt.n = c;
        vt.mesh.count = c;
        total += c;
      }
      trafficCount = total;
      configLights();
    }

    /* ---------------------------------------------------- light points obj */
    var lights = createLightPoints(renderer);
    group.add(lights.points);      // shared by traffic / boats / aircraft
    var MAX_CAR_LIGHTS = TRAFFIC_MAX * 4 + 40;
    var carLightBase = 0;

    // Traffic light points come first; boat lights are appended after a fixed
    // reservation so their indices don't shift when the vehicle count changes.
    function configLights() {
      carLightBase = 0;
    }

    /* ------------------------------------------------------------ trams */
    var tramRoute = buildRoute(L.TRAM_ROUTE, 6, 40);
    var tramType = { max: 5, n: 0, speed: 3.2, items: [], mesh: null, stops: [] };
    (function buildTrams() {
      tramType.geo = tramGeometry();
      var mesh = makeInstanced(tramType.geo, solidMaterial(), tramType.max, 'trams', true);
      // trams are green/cream: slight per-instance variation only
      var c = new THREE.Color();
      for (var i = 0; i < tramType.max; i++) {
        var f = 0.92 + rng.next() * 0.16;
        c.setRGB(f, f * (0.98 + rng.next() * 0.04), f * 0.95);
        mesh.setColorAt(i, c);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      gTraffic.add(mesh);
      tramType.mesh = mesh;
      // stops every ~230 units of valid route
      if (tramRoute) {
        for (var s = 0; s < tramRoute.spans.length; s++) {
          var sp = tramRoute.spans[s];
          for (var d = sp.d0 + 60; d < sp.d1 - 40; d += 215) tramType.stops.push(d);
        }
        var dirs = [1, -1];
        for (var k = 0; k < tramType.max; k++) {
          var rt = tramRoute;
          var pick = spanPick(rt, rng);
          tramType.items.push({ d: pick.d, span: pick.span, dir: dirs[k % 2] * (k < 2 ? 1 : -1), speed: 2.9 + rng.next() * 0.7, dwell: 0, nextStop: 0, ph: rng.float(0, TAU) });
        }
      }
    })();

    // overhead wire + poles (static, built along land spans only)
    (function buildTramWires() {
      if (!tramRoute || !tramRoute.spans.length) return;
      var positions = [];
      var i, k;
      for (k = 0; k < tramRoute.n - 1; k++) {
        if (!tramRoute.ok[k] || !tramRoute.ok[k + 1]) continue;
        var y0 = tramRoute.sy[k] + 3.05, y1 = tramRoute.sy[k + 1] + 3.05;
        positions.push(tramRoute.sx[k], y0, tramRoute.sz[k], tramRoute.sx[k + 1], y1, tramRoute.sz[k + 1]);
      }
      var wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      var wireMat = trackMaterial(new THREE.LineBasicMaterial({ color: 0x1e2124, transparent: true, opacity: 0.85 }));
      var wire = new THREE.LineSegments(wg, wireMat);
      wire.name = 'tram-wire';
      wire.frustumCulled = false;
      gTraffic.add(wire);
      // poles
      var b = newBatch();
      for (i = 0; i < tramRoute.n; i += 8) {
        if (!tramRoute.ok[i]) continue;
        var px = tramRoute.sx[i] + tramRoute.dz[i] * 1.6;
        var pz = tramRoute.sz[i] - tramRoute.dx[i] * 1.6;
        var py = tramRoute.sy[i];
        addBox(b, px, py, pz, 0.14, 3.1, 0.14, C.pole);
        addBox(b, px, py + 3.0, pz, 0.12, 0.12, 1.6, C.pole);
      }
      if (b.vcount) {
        var poles = buildSolid(b, 'tram-poles', false);
        gTraffic.add(poles);
      }
    })();

    /* ------------------------------------------------------------ boats */
    var boatRoutes = [];
    var boats = [];
    var BOAT_MAX = { star: 5, junk: 1, cargo: 5, yacht: 2 };
    var boatMeshes = {};

    function waterPoint(x, z, minShore) {
      var guard = 0;
      while (guard++ < 48) {
        if (L.isWater(x, z) && L.shoreDistance(x, z) >= minShore) return [x, z];
        z += (-16 - z) * 0.09;   // drift toward the harbour centreline
      }
      return [x, z];
    }

    (function buildBoatRoutes() {
      // berth line routes alongside their real pier decks when the layout
      // exposes them (piers are intentional offshore decks).
      var PIER_MAP = {
        'central-tst': ['central', 'tst'],
        'wanchai-tst': ['wanchai', 'tst'],
        'hunghom-wanchai': ['hunghom', 'wanchai']
      };
      function pierBerth(id) {
        var p = L.FERRY_PIERS && L.FERRY_PIERS[id];
        if (!p) return null;
        return [p.x, p.z + (p.z > 0 ? -11 : 11)];
      }
      for (var i = 0; i < L.FERRY_ROUTES.length; i++) {
        var fr = L.FERRY_ROUTES[i];
        var route = { def: fr, kind: fr.color || 'star', items: [] };
        if (fr.spline) {
          var pts = [];
          for (var k = 0; k < fr.spline.length; k++) {
            var p = fr.spline[k];
            var q = waterPoint(p[0], p[1], 12);
            pts.push(q);
          }
          // close loop
          if (fr.id === 'yacht' || fr.id === 'junk') pts.push(pts[0]);
          route.type = 'loop';
          route.data = buildWaterRoute(pts);
        } else {
          var ids = PIER_MAP[fr.id];
          var pa = ids ? pierBerth(ids[0]) : null;
          var pb = ids ? pierBerth(ids[1]) : null;
          var a = waterPoint((pa || fr.a)[0], (pa || fr.a)[1], 6);
          var b = waterPoint((pb || fr.b)[0], (pb || fr.b)[1], 6);
          route.type = 'line';
          route.a = a; route.b = b;
          route.len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          route.speed = fr.speed || 4;
          route.turn = fr.turnaround == null ? 2 : fr.turnaround;
          route.travel = route.len / route.speed;
          route.cycle = route.travel * 2 + route.turn * 2;
        }
        boatRoutes.push(route);
      }
    })();

    function buildWaterRoute(pts) {
      var rt = buildRoute(pts, 6, 4);
      if (!rt) return null;
      rt.total = L.polylineLength(pts);
      rt.n = Math.max(2, Math.floor(rt.total / 6) + 1);
      return rt;
    }

    (function buildBoats() {
      var starGeo = starFerryGeometry();
      boatMeshes.star = makeInstanced(starGeo, solidMaterial(), BOAT_MAX.star, 'star-ferry', true);
      var junkGeo = junkGeometry();
      boatMeshes.junk = makeInstanced(junkGeo, solidMaterial(), BOAT_MAX.junk, 'junk', true);
      var cargoGeo = cargoGeometry();
      boatMeshes.cargo = makeInstanced(cargoGeo, solidMaterial(), BOAT_MAX.cargo, 'cargo', true);
      var yachtGeo = yachtGeometry();
      boatMeshes.yacht = makeInstanced(yachtGeo, solidMaterial(), BOAT_MAX.yacht, 'yacht', true);
      var names = ['star', 'junk', 'cargo', 'yacht'];
      for (var i = 0; i < names.length; i++) {
        boatMeshes[names[i]].count = 0;
        gFerries.add(boatMeshes[names[i]]);
      }
      // per-boat tint variation for cargo/yacht
      var c = new THREE.Color();
      var k;
      for (k = 0; k < BOAT_MAX.cargo; k++) { c.setRGB(0.95 + rng.next() * 0.1, 0.95 + rng.next() * 0.1, 0.95 + rng.next() * 0.1); boatMeshes.cargo.setColorAt(k, c); }
      for (k = 0; k < BOAT_MAX.yacht; k++) { c.setRGB(1, 1, 1); boatMeshes.yacht.setColorAt(k, c); }
      for (k = 0; k < BOAT_MAX.star; k++) { c.setRGB(1, 1, 1); boatMeshes.star.setColorAt(k, c); }
      if (boatMeshes.cargo.instanceColor) boatMeshes.cargo.instanceColor.needsUpdate = true;
      if (boatMeshes.yacht.instanceColor) boatMeshes.yacht.instanceColor.needsUpdate = true;

      var r = 0, i2;
      for (i2 = 0; i2 < boatRoutes.length; i2++) {
        var route = boatRoutes[i2];
        if (route.type === 'loop' && !route.data) continue;
        var count = route.def.count || 1;
        for (var j = 0; j < count; j++) {
          if (r >= 40) break;
          var kind = route.kind === 'star' ? 'star' : (route.kind === 'junk' ? 'junk' : (route.kind === 'yacht' ? 'yacht' : 'cargo'));
          var safeSpeed = route.speed;
          if (!isFinite(safeSpeed) || safeSpeed <= 0) safeSpeed = route.def.speed || 2;
          if (!isFinite(safeSpeed) || safeSpeed <= 0) safeSpeed = 2;
          var boat = {
            kind: kind,
            route: route,
            offset: 0,
            speed: safeSpeed,
            beam: kind === 'star' ? 11.5 : (kind === 'junk' ? 5 : (kind === 'yacht' ? 2.8 : 10)),
            len: kind === 'star' ? 42 : (kind === 'junk' ? 19 : (kind === 'yacht' ? 9 : 34)),
            slot: 0,
            x: 0, z: 0, y: 0, heading: 0, pitch: 0, roll: 0,
            ph: rng.float(0, TAU)
          };
          if (route.type === 'line') {
            boat.offset = (j / count) * route.cycle + rng.float(0, 6);
            if (!isFinite(boat.offset) || route.cycle <= 0) boat.offset = 0;
          } else {
            boat.offset = (j / count) * (route.data.total || 100) + rng.float(0, 20);
            if (!isFinite(boat.offset)) boat.offset = 0;
          }
          boat.slot = boats.filter(function (bb) { return bb.kind === kind; }).length;
          if (boat.slot >= BOAT_MAX[kind]) continue;
          boats.push(boat);
        }
      }
      for (var n = 0; n < boats.length; n++) {
        var m = boatMeshes[boats[n].kind];
        if (m) m.count = Math.max(m.count, boats[n].slot + 1);
      }
    })();

    /* wakes: one dynamic merged mesh for all boats */
    var WAKE_SEGS = 9;
    var wake = (function buildWakes() {
      var maxQuads = 40 * WAKE_SEGS;
      var posArr = new Float32Array(maxQuads * 4 * 3);
      var colArr = new Float32Array(maxQuads * 4 * 3);
      var idx = new Uint16Array(maxQuads * 6);
      for (var q = 0; q < maxQuads; q++) {
        var v = q * 4;
        idx[q * 6] = v; idx[q * 6 + 1] = v + 1; idx[q * 6 + 2] = v + 2;
        idx[q * 6 + 3] = v; idx[q * 6 + 4] = v + 2; idx[q * 6 + 5] = v + 3;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(colArr, 3).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setDrawRange(0, 0);
      var mat = trackMaterial(new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false
      }));
      var mesh = new THREE.Mesh(g, mat);
      mesh.name = 'boat-wakes';
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      gTraffic.parent; // no-op
      gFerries.add(mesh);
      return { mesh: mesh, geo: g, pos: posArr, col: colArr, quads: 0 };
    })();

    /* ---------------------------------------------------------- people */
    var peopleRoute = [];
    (function buildPeopleRoutes() {
      for (var i = 0; i < L.WALK_PATHS.length; i++) {
        var rt = buildRoute(L.WALK_PATHS[i], 4, 30);
        if (rt && rt.spans.length) peopleRoute.push(rt);
      }
    })();
    var PEOPLE_MAX = 560;
    var peopleType = { max: PEOPLE_MAX, n: 0, items: [], mesh: null, geo: null };
    (function buildPeople() {
      peopleType.geo = personGeometry();
      var mesh = makeInstanced(peopleType.geo, solidMaterial(), PEOPLE_MAX, 'people', true);
      makeColorArray(mesh, PEOPLE_MAX, PEOPLE_COLORS, rng);
      gPeople.add(mesh);
      peopleType.mesh = mesh;
      // distribute: weighted by route length
      var totalLen = 0, i;
      for (i = 0; i < peopleRoute.length; i++) totalLen += peopleRoute[i].validLen;
      if (!peopleRoute.length) return;
      for (i = 0; i < PEOPLE_MAX; i++) {
        var r = rng.next() * totalLen, acc = 0, chosen = peopleRoute[0];
        for (var k = 0; k < peopleRoute.length; k++) {
          acc += peopleRoute[k].validLen;
          if (r <= acc) { chosen = peopleRoute[k]; break; }
        }
        var pick = spanPick(chosen, rng);
        peopleType.items.push({
          rt: chosen, d: pick.d, span: pick.span,
          dir: rng.chance(0.5) ? 1 : -1,
          speed: rng.float(0.42, 0.78),
          lat: rng.float(-0.9, 0.9),
          ph: rng.float(0, TAU),
          scale: rng.float(0.88, 1.1)
        });
      }
    })();

    /* ------------------------------------------------- birds + helicopter */
    var BIRD_MAX = 44;
    var birdMesh = null, birdGeo = null;
    function buildBirds() {
      var base = new THREE.InstancedBufferGeometry();
      // one gull, forward +X, wings along +-Z
      var pos = new Float32Array([
        // body (2 tris)
        0.16, 0.02, 0.0, -0.02, 0.03, 0.055, -0.02, 0.03, -0.055,
        -0.02, 0.03, 0.055, -0.16, 0.02, 0.0, -0.02, 0.03, -0.055,
        // left wing
        0.06, 0.01, 0.05, -0.08, 0.01, 0.05, -0.02, 0.0, 0.42,
        // right wing
        0.06, 0.01, -0.05, -0.02, 0.0, -0.42, -0.08, 0.01, -0.05
      ]);
      var col = [];
      var tint = [0.93, 0.94, 0.95], dark = [0.28, 0.30, 0.32], mid = [0.72, 0.74, 0.76];
      var cols = [tint, dark, tint, tint, dark, tint, tint, dark, [0.98, 0.98, 1.0], tint, [0.98, 0.98, 1.0], dark];
      for (var i = 0; i < 12; i++) col.push(cols[i][0], cols[i][1], cols[i][2]);
      var wing = new Float32Array([0, 0, 0, 0, 0, 0, 1, 1, 1, -1, -1, -1]);
      base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      base.setAttribute('aTint', new THREE.Float32BufferAttribute(col, 3));
      base.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
      // instanced attributes
      var centers = new Float32Array(BIRD_MAX * 2);
      var orbit = new Float32Array(BIRD_MAX * 3);
      var phase = new Float32Array(BIRD_MAX);
      var scale = new Float32Array(BIRD_MAX);
      var flap = new Float32Array(BIRD_MAX);
      var flockCenters = [
        [-320, 60], [420, 180], [-120, -60], [680, 40], [-700, 200], [120, 250]
      ];
      for (i = 0; i < BIRD_MAX; i++) {
        var fc = flockCenters[rng.int(0, flockCenters.length - 1)];
        centers[i * 2] = fc[0] + rng.float(-60, 60);
        centers[i * 2 + 1] = fc[1] + rng.float(-40, 40);
        orbit[i * 3] = rng.float(14, 58);          // radius
        orbit[i * 3 + 1] = rng.float(7, 26);       // height
        orbit[i * 3 + 2] = rng.float(0.16, 0.42) * (rng.chance(0.5) ? 1 : -1); // angular speed
        phase[i] = rng.float(0, TAU);
        scale[i] = rng.float(0.75, 1.25);
        flap[i] = rng.float(0.6, 1.4);
      }
      base.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 2));
      base.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(orbit, 3));
      base.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
      base.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 1));
      base.setAttribute('aFlap', new THREE.InstancedBufferAttribute(flap, 1));
      base.instanceCount = 0;
      var mat = trackMaterial(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
        vertexShader: [
          'attribute vec3 aTint;',
          'attribute float aWing;',
          'attribute vec2 aCenter;',
          'attribute vec3 aOrbit;',
          'attribute float aPhase;',
          'attribute float aScale;',
          'attribute float aFlap;',
          'uniform float uTime;',
          'varying vec3 vColor;',
          'void main() {',
          '  float ang = aPhase + uTime * aOrbit.z;',
          '  vec3 local = position * aScale;',
          '  float flapT = uTime * (5.0 + aFlap * 5.0) + aPhase * 6.0;',
          '  float wf = abs(aWing);',
          '  local.y += sin(flapT) * 0.42 * wf * abs(position.z) / 0.42;',
          '  local.z *= 1.0 - 0.12 * abs(sin(flapT)) * wf;',
          '  float yaw = -ang - 1.5707963;',
          '  float c = cos(yaw), s = sin(yaw);',
          '  vec3 wp;',
          '  wp.x = aCenter.x + cos(ang) * aOrbit.x + local.x * c + local.z * s;',
          '  wp.z = aCenter.y + sin(ang) * aOrbit.x - local.x * s + local.z * c;',
          '  wp.y = aOrbit.y + sin(uTime * 0.6 + aPhase * 4.0) * 1.6 + local.y;',
          '  vColor = aTint;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying vec3 vColor;',
          'void main() { gl_FragColor = vec4(vColor, 1.0); }'
        ].join('\n'),
        side: THREE.DoubleSide
      }));
      birdGeo = base;
      birdMesh = new THREE.Mesh(base, mat);
      birdMesh.frustumCulled = false;
      birdMesh.name = 'seagulls';
      gAir.add(birdMesh);
    }
    buildBirds();
    var birdMat = birdMesh ? birdMesh.material : null;

    var heli = { mesh: null, rotor: null, x: -100, z: 0, y: 55, heading: 0, t: 0 };
    (function buildHeli() {
      var body = new THREE.Mesh(helicopterGeometry(), solidMaterial());
      body.name = 'helicopter';
      body.castShadow = true;
      body.frustumCulled = false;
      var rot = new THREE.Mesh(rotorGeometry(), solidMaterial());
      rot.name = 'helicopter-rotor';
      rot.frustumCulled = false;
      gAir.add(body); gAir.add(rot);
      heli.mesh = body; heli.rotor = rot;
      heli.mesh.visible = false; heli.rotor.visible = false;
    })();

    /* ----------------------------------------------------- light-show rig */
    var beams = null;
    var beamItems = [];
    (function buildBeams() {
      var b = newBatch();
      var baseW = 1.2, tipW = 9.5;
      function quad(axisSign) {
        var c0 = shade([1, 1, 1], 1.0), c1 = shade([1, 1, 1], 0.16);
        // a tapered triangle-ish fan: two triangles from base to tip
        var x0 = -baseW * 0.5, x1 = baseW * 0.5, tx0 = -tipW * 0.5, tx1 = tipW * 0.5;
        if (axisSign === 0) {
          b.addTri([x0, 0, 0], [x1, 0, 0], [tx1, 1, 0], 0, 0, 1, c0);
          b.addTri([x0, 0, 0], [tx1, 1, 0], [tx0, 1, 0], 0, 0, 1, c1);
        } else {
          b.addTri([0, 0, x0], [0, 0, x1], [0, 1, tx1], 1, 0, 0, c0);
          b.addTri([0, 0, x0], [0, 1, tx1], [0, 1, tx0], 1, 0, 0, c1);
        }
      }
      quad(0); quad(1);
      var geo = trackGeometry(b.build());
      var mat = trackMaterial(new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 1.0,
        blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide, fog: false
      }));
      var mesh = new THREE.InstancedMesh(geo, mat, 12);
      mesh.name = 'symphony-beams';
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.renderOrder = 4;
      gShow.add(mesh);
      beams = { mesh: mesh, mat: mat, items: beamItems };
      var c = new THREE.Color();
      var anchorIds = ['ifc2', 'boc', 'cheungkong', 'center', 'centralPlaza', 'oneIslandEast', 'icc', 'rosewood', 'k11', 'tamar'];
      for (var i = 0; i < anchorIds.length && i < 10; i++) {
        var lm = L.LANDMARKS[anchorIds[i]];
        if (!lm || !isFinite(lm.x) || !isFinite(lm.z) || !isFinite(lm.h)) continue;
        var gy = L.terrainHeight(lm.x, lm.z);
        if (!isFinite(gy) || gy < 0) gy = 1;
        var col = BEAM_COLORS[i % BEAM_COLORS.length];
        c.setRGB(col[0], col[1], col[2]);
        mesh.setColorAt(beamItems.length, c);
        beamItems.push({
          x: lm.x, z: lm.z, y: gy + lm.h + 1.5,
          phase: rng.float(0, TAU),
          speed: rng.float(0.22, 0.48),
          tilt: rng.float(0.42, 0.95),
          len: rng.float(150, 330),
          hue: col
        });
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.count = 0;
    })();

    /* fireworks: GPU points, CPU simulated */
    var FW_MAX = 900;
    var fw = (function buildFireworks() {
      var geo = new THREE.BufferGeometry();
      var pos = new Float32Array(FW_MAX * 3);
      var col = new Float32Array(FW_MAX * 3);
      var size = new Float32Array(FW_MAX);
      var alpha = new Float32Array(FW_MAX);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
      geo.setDrawRange(0, 0);
      var mat = trackMaterial(new THREE.ShaderMaterial({
        uniforms: { uPxScale: { value: 900.0 }, uMinPx: { value: 2.0 }, uMaxPx: { value: 30.0 } },
        vertexShader: [
          'attribute vec3 aColor;',
          'attribute float aSize;',
          'attribute float aAlpha;',
          'varying vec3 vColor;',
          'varying float vAlpha;',
          'uniform float uPxScale;',
          'uniform float uMinPx;',
          'uniform float uMaxPx;',
          'void main() {',
          '  vColor = aColor;',
          '  vAlpha = aAlpha;',
          '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
          '  gl_PointSize = clamp(aSize * uPxScale / max(1.0, -mv.z), uMinPx, uMaxPx);',
          '  gl_Position = projectionMatrix * mv;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying vec3 vColor;',
          'varying float vAlpha;',
          'void main() {',
          '  vec2 d = gl_PointCoord - vec2(0.5);',
          '  float r = length(d) * 2.0;',
          '  if (r > 1.0) discard;',
          '  float a = (1.0 - r); a = a * a * vAlpha;',
          '  gl_FragColor = vec4(vColor * a, 1.0);',
          '}'
        ].join('\n'),
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, depthTest: true
      }));
      var pts = new THREE.Points(geo, mat);
      pts.name = 'fireworks';
      pts.frustumCulled = false;
      pts.renderOrder = 5;
      gShow.add(pts);
      var particles = [];
      for (var fp = 0; fp < FW_MAX; fp++) particles.push({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, c: [1, 1, 1], size: 1, live: false });
      for (var fa = 0; fa < FW_MAX; fa++) { col[fa * 3] = 1; col[fa * 3 + 1] = 1; col[fa * 3 + 2] = 1; size[fa] = 1; }
      return { pts: pts, geo: geo, mat: mat, pos: pos, col: col, size: size, alpha: alpha, particles: particles, drawN: 0, cursor: 0 };
    })();

    var show = {
      active: false, forced: false, t: 0, duration: 17.5, intensity: 0,
      timer: 14 + rng.next() * 12,
      burstTimes: [2.2, 3.5, 4.8, 6.3, 7.6, 9.1, 10.8],
      nextBurst: 0,
      fx: []
    };

    /* ============================================================== update */
    var dummy = new THREE.Object3D();
    var UP_AXIS = new THREE.Vector3(0, 1, 0);
    var Z_AXIS = new THREE.Vector3(0, 0, 1);

    function readNight(state, env) {
      if (forcedNight >= 0) return forcedNight;
      if (env && typeof env.night === 'number' && isFinite(env.night)) return clamp(env.night, 0, 1);
      if (state && typeof state.night === 'number' && isFinite(state.night) && state.night > 0.001) return clamp(state.night, 0, 1);
      var h = hourOf(state, env);
      if (h >= 20.2 || h <= 5.1) return 1;
      if (h > 13) return smoothstep(18.1, 20.2, h);
      return 1 - smoothstep(5.1, 7.3, h);
    }

    /// wall-clock hours from state (authoritative) then env, with a sane fallback
    function hourOf(state, env) {
      if (state && typeof state.timeHours === 'number' && isFinite(state.timeHours)) return state.timeHours;
      if (env && typeof env.timeHours === 'number' && isFinite(env.timeHours)) return env.timeHours;
      return 21;
    }

    function readWeather(state, env) {
      if (env && env.weather) return env.weather;
      if (state && state.weather) return state.weather;
      return 'clear';
    }

    function readLayers(state) {
      if (!state || !state.layers) return;
      var sl = state.layers;
      if (typeof sl.traffic === 'boolean') layers.traffic = sl.traffic;
      if (typeof sl.ferries === 'boolean') layers.ferries = sl.ferries;
      if (typeof sl.people === 'boolean') layers.people = sl.people;
      if (typeof sl.aircraft === 'boolean') layers.aircraft = sl.aircraft;
      if (typeof sl.show === 'boolean') layers.show = sl.show;
      else if (typeof sl.neon === 'boolean') layers.show = sl.neon;
    }

    function applyLayerVisibility() {
      gTraffic.visible = layers.traffic;
      gFerries.visible = layers.ferries;
      gPeople.visible = layers.people;
      gAir.visible = layers.aircraft;
      gShow.visible = layers.show && nightF > 0.12;
    }

    /* ------------------------------------------------------ traffic update */
    var _f = { x: 0, z: 0, y: 0, dx: 0, dz: 0 };
    function updateTraffic(dt, speedMul) {
      if (!layers.traffic) return;
      var t, i, vt, item, rt, mesh;
      for (t = 0; t < vehTypes.length; t++) {
        vt = vehTypes[t];
        mesh = vt.mesh;
        var arr = mesh.instanceMatrix.array;
        for (i = 0; i < vt.n; i++) {
          item = vt.items[i];
          rt = item.rt;
          item.d += item.dir * item.speed * speedMul * dt;
          if (item.d > item.span.d1) { item.d = item.span.d0 + 1.5; }
          else if (item.d < item.span.d0) { item.d = item.span.d1 - 1.5; }
          routeAt(rt, item.d, _f);
          // Hong Kong drives on the left: offset to the left of travel direction
          var px = _f.x + (_f.dz) * item.lane * item.dir;
          var pz = _f.z - (_f.dx) * item.lane * item.dir;
          var py = _f.y + 0.04;
          var yaw = Math.atan2(-(_f.dz * item.dir), _f.dx * item.dir);
          if (!isFinite(px) || !isFinite(pz) || !isFinite(py) || !isFinite(yaw)) { px = 0; py = -1000; pz = 0; yaw = 0; }
          // matrix compose (column major): yaw + translation
          var c = Math.cos(yaw), s = Math.sin(yaw);
          var o = i * 16;
          arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -s; arr[o + 3] = 0;
          arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
          arr[o + 8] = s; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
          arr[o + 12] = px; arr[o + 13] = py; arr[o + 14] = pz; arr[o + 15] = 1;
          // stash world pos for lights
          item._x = px; item._y = py; item._z = pz; item._yaw = yaw;
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    function pushTrafficLights(nightV) {
      if (nightV < 0.03) return;
      var t, i, vt, item;
      var white = [1.0, 0.92, 0.72], redL = [1.0, 0.10, 0.06];
      for (t = 0; t < vehTypes.length; t++) {
        vt = vehTypes[t];
        var halfL = vt.len * 0.5;
        for (i = 0; i < vt.n; i++) {
          item = vt.items[i];
          var c = Math.cos(item._yaw), s = Math.sin(item._yaw);
          var fx = c, fz = -s;        // forward in world
          var sx2 = s, sz2 = c;       // local +z on road
          var hx = item._x + fx * (halfL - 0.08), hz = item._z + fz * (halfL - 0.08);
          var bx = item._x - fx * (halfL - 0.08), bz = item._z - fz * (halfL - 0.08);
          var y = item._y + 0.38;
          lights.push(hx + sx2 * 0.34, y, hz + sz2 * 0.34, white, 1.05, 1.0);
          lights.push(hx - sx2 * 0.34, y, hz - sz2 * 0.34, white, 1.05, 1.0);
          lights.push(bx + sx2 * 0.32, y, bz + sz2 * 0.32, redL, 0.85, 0.9);
          lights.push(bx - sx2 * 0.32, y, bz - sz2 * 0.32, redL, 0.85, 0.9);
          // Hong Kong details: taxi roof sign glow, lit bus/minibus interiors
          if (vt.kind === 'taxi') {
            lights.push(item._x, item._y + 0.98, item._z, [1.0, 0.82, 0.42], 0.85, 0.9);
          } else if (vt.kind === 'bus' || vt.kind === 'minibus') {
            lights.push(item._x + fx * vt.len * 0.18, item._y + (vt.kind === 'bus' ? 1.55 : 0.85), item._z + fz * vt.len * 0.18, [1.0, 0.78, 0.5], 0.9, 0.5);
            lights.push(item._x - fx * vt.len * 0.18, item._y + (vt.kind === 'bus' ? 1.55 : 0.85), item._z - fz * vt.len * 0.18, [1.0, 0.78, 0.5], 0.9, 0.5);
          }
        }
      }
    }

    /* --------------------------------------------------------- tram update */
    function updateTrams(dt) {
      if (!tramRoute || !layers.traffic) return;
      var mesh = tramType.mesh;
      var arr = mesh.instanceMatrix.array;
      for (var i = 0; i < tramType.n; i++) {
        var tr = tramType.items[i];
        var spd = tr.speed;
        if (tr.dwell > 0) {
          tr.dwell -= dt;
          spd = 0;
        } else {
          var prevD = tr.d;
          tr.d += tr.dir * spd * dt;
          // stop at next stop point
          if (tramType.stops.length) {
            for (var s = 0; s < tramType.stops.length; s++) {
              var sd = tramType.stops[s];
              if ((prevD - sd) * (tr.d - sd) < 0 && tr.d !== prevD) {
                tr.d = sd;
                tr.dwell = 2.2 + rng.next() * 1.8;
                break;
              }
            }
          }
          if (tr.d > tr.span.d1) tr.d = tr.span.d0 + 2;
          else if (tr.d < tr.span.d0) tr.d = tr.span.d1 - 2;
        }
        routeAt(tramRoute, tr.d, _f);
        var px = _f.x + (_f.dz) * 0.72 * tr.dir;
        var pz = _f.z - (_f.dx) * 0.72 * tr.dir;
        var py = _f.y + 0.04;
        var yaw = Math.atan2(-(_f.dz * tr.dir), _f.dx * tr.dir);
        if (!isFinite(px) || !isFinite(pz) || !isFinite(py) || !isFinite(yaw)) { px = 0; py = -1000; pz = 0; yaw = 0; }
        var c = Math.cos(yaw), s2 = Math.sin(yaw), o = i * 16;
        arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -s2; arr[o + 3] = 0;
        arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
        arr[o + 8] = s2; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
        arr[o + 12] = px; arr[o + 13] = py; arr[o + 14] = pz; arr[o + 15] = 1;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    /* --------------------------------------------------------- boat update */
    function updateBoats(dt) {
      if (!layers.ferries) return;
      var countByKind = { star: 0, junk: 0, cargo: 0, yacht: 0 };
      var k;
      for (k = 0; k < boats.length; k++) {
        var b = boats[k];
        var pos = { x: 0, z: 0, heading: 0 };
        if (b.route.type === 'line') {
          var cycle = b.route.cycle;
          if (!isFinite(cycle) || cycle <= 0) cycle = 1;
          var s = ((timeAcc + b.offset) % cycle + cycle) % cycle;
          var travel = b.route.travel, turn = b.route.turn;
          if (!isFinite(travel) || travel <= 0) travel = 1;
          if (!isFinite(turn) || turn < 0) turn = 0;
          var f;
          if (s < travel) {
            f = s / travel;
            pos.x = lerp(b.route.a[0], b.route.b[0], f);
            pos.z = lerp(b.route.a[1], b.route.b[1], f);
            pos.heading = Math.atan2(-(b.route.b[1] - b.route.a[1]), b.route.b[0] - b.route.a[0]);
          } else if (s < travel + turn) {
            pos.x = b.route.b[0]; pos.z = b.route.b[1];
            pos.heading = Math.atan2(-(b.route.b[1] - b.route.a[1]), b.route.b[0] - b.route.a[0]);
          } else if (s < travel * 2 + turn) {
            f = (s - travel - turn) / travel;
            pos.x = lerp(b.route.b[0], b.route.a[0], f);
            pos.z = lerp(b.route.b[1], b.route.a[1], f);
            pos.heading = Math.atan2(-(b.route.a[1] - b.route.b[1]), b.route.a[0] - b.route.b[0]);
          } else {
            pos.x = b.route.a[0]; pos.z = b.route.a[1];
            pos.heading = Math.atan2(-(b.route.b[1] - b.route.a[1]), b.route.b[0] - b.route.a[0]);
          }
        } else if (b.route.data) {
          var data = b.route.data;
          var total = data.total || 1;
          var ds = ((timeAcc * b.speed + b.offset) % total + total) % total;
          routeAt(data, ds, _f);
          pos.x = _f.x; pos.z = _f.z;
          pos.heading = Math.atan2(-_f.dz, _f.dx);
        }
        b.x = fin(pos.x, b.x || 0);
        b.z = fin(pos.z, b.z || 0);
        var bob = Math.sin(timeAcc * 1.15 + b.ph) * (b.kind === 'star' ? 0.10 : 0.16);
        var rollA = Math.sin(timeAcc * 0.9 + b.ph * 1.3) * 0.012;
        var pitchA = Math.sin(timeAcc * 1.4 + b.ph * 0.7) * 0.008;
        if (!isFinite(bob)) bob = 0;
        if (!isFinite(rollA)) rollA = 0;
        if (!isFinite(pitchA)) pitchA = 0;
        b.y = bob;
        b.heading = fin(pos.heading, b.heading || 0);
        b.pitch = pitchA; b.roll = rollA;
        dummy.position.set(b.x, bob, b.z);
        dummy.rotation.set(pitchA, b.heading, rollA, 'YXZ');
        dummy.scale.set(1, 1 + bob * 0.02, 1);
        if (!isFinite(dummy.scale.y) || dummy.scale.y < 0.2) dummy.scale.y = 1;
        dummy.updateMatrix();
        var mesh = boatMeshes[b.kind];
        if (mesh) {
          var idx = b.slot;
          if (idx < mesh.count) {
            mesh.setMatrixAt(idx, dummy.matrix);
          }
        }
        countByKind[b.kind]++;
      }
      for (var kind in boatMeshes) {
        if (boatMeshes[kind]) boatMeshes[kind].instanceMatrix.needsUpdate = true;
      }
      updateWakes();
    }

    function updateWakes() {
      var arr = wake.pos, col = wake.col;
      var q = 0;
      var i, k, b;
      for (i = 0; i < boats.length; i++) {
        b = boats[i];
        var okBoat = isFinite(b.x) && isFinite(b.z) && isFinite(b.y) && isFinite(b.heading);
        var fx = okBoat ? Math.cos(b.heading) : 1, fz = okBoat ? -Math.sin(b.heading) : 0;
        var bx = okBoat ? Math.sin(b.heading) : 0, bz = okBoat ? Math.cos(b.heading) : 1;
        var halfL = b.len * 0.5;
        var baseY = 0.22 + (okBoat ? b.y : 0);
        var spacing = b.len / 7;
        var w0 = b.beam * 0.10;
        var grow = b.beam * 0.055;
        var bright = b.kind === 'star' ? 0.42 : (b.kind === 'cargo' ? 0.26 : 0.36);
        for (k = 0; k < WAKE_SEGS; k++) {
          var d0 = halfL + k * spacing;
          var d1 = halfL + (k + 1) * spacing;
          var wA = w0 + grow * k;
          var wB = w0 + grow * (k + 1);
          var x0, z0, x1, z1;
          if (okBoat) {
            x0 = b.x - fx * d0; z0 = b.z - fz * d0;
            x1 = b.x - fx * d1; z1 = b.z - fz * d1;
          } else {
            // degenerate off-screen quad: finite and invisible
            x0 = x1 = 0; z0 = z1 = 0; baseY = -1000;
          }
          var fade = bright * Math.pow(1 - k / WAKE_SEGS, 2.1);
          var o = q * 12;
          arr[o] = x0 + bx * wA; arr[o + 1] = baseY; arr[o + 2] = z0 + bz * wA;
          arr[o + 3] = x0 - bx * wA; arr[o + 4] = baseY; arr[o + 5] = z0 - bz * wA;
          arr[o + 6] = x1 - bx * wB; arr[o + 7] = baseY; arr[o + 8] = z1 - bz * wB;
          arr[o + 9] = x1 + bx * wB; arr[o + 10] = baseY; arr[o + 11] = z1 + bz * wB;
          for (var v = 0; v < 4; v++) {
            var oo = (q * 4 + v) * 3;
            col[oo] = 0.72 * fade; col[oo + 1] = 0.88 * fade; col[oo + 2] = 0.95 * fade;
          }
          q++;
        }
      }
      wake.quads = q;
      wake.geo.setDrawRange(0, q * 6);
      wake.geo.attributes.position.needsUpdate = true;
      wake.geo.attributes.color.needsUpdate = true;
      wake.mesh.visible = q > 0;
    }

    function pushBoatLights(nightV) {
      if (nightV < 0.03) return;
      var i, b;
      for (i = 0; i < boats.length; i++) {
        b = boats[i];
        var fx = Math.cos(b.heading), fz = -Math.sin(b.heading);
        var bx = Math.sin(b.heading), bz = Math.cos(b.heading);
        var topY = b.y + (b.kind === 'star' ? 4.2 : (b.kind === 'junk' ? 7.0 : (b.kind === 'cargo' ? 4.4 : 3.0)));
        var white = [1.0, 0.95, 0.85], red = [1.0, 0.12, 0.1], green = [0.12, 1.0, 0.4], warm = [1.0, 0.7, 0.3];
        lights.push(b.x, topY, b.z, white, 2.4, 1.0);
        lights.push(b.x + fx * b.len * 0.3, topY - 1.0, b.z + fz * b.len * 0.3, white, 1.5, 0.85);
        // navigation sidelights
        var sy = b.y + (b.kind === 'star' ? 1.7 : 1.2);
        lights.push(b.x + bx * b.beam * 0.35 - fx * b.len * 0.28, sy, b.z + bz * b.beam * 0.35 - fz * b.len * 0.28, red, 0.95, 0.9);
        lights.push(b.x - bx * b.beam * 0.35 - fx * b.len * 0.28, sy, b.z - bz * b.beam * 0.35 - fz * b.len * 0.28, green, 0.95, 0.9);
        if (b.kind === 'junk') lights.push(b.x, b.y + 2.2, b.z, warm, 2.6, 0.9);
        if (b.kind === 'star') {
          // warm saloon windows read across the harbour at night
          for (var w = -1; w <= 1; w++) {
            lights.push(b.x + fx * w * 13, b.y + 2.25, b.z + fz * w * 13, [1.0, 0.72, 0.42], 3.4, 0.5);
          }
        } else if (b.kind === 'cargo') {
          lights.push(b.x + fx * 12, b.y + 2.6, b.z + fz * 12, [1.0, 0.8, 0.55], 2.6, 0.7);
          lights.push(b.x - fx * 10, b.y + 2.2, b.z - fz * 10, [1.0, 0.85, 0.6], 2.2, 0.55);
        }
      }
    }

    /* -------------------------------------------------------- people update */
    function updatePeople(dt, nightV, weather) {
      if (!layers.people || !peopleType.mesh) return;
      var mesh = peopleType.mesh;
      var active = weather === 'rain' ? Math.floor(peopleType.n * 0.38) : peopleType.n;
      mesh.count = Math.min(active, peopleType.items.length);
      var arr = mesh.instanceMatrix.array;
      var speedMul = weather === 'rain' ? 1.4 : 1.0;
      for (var i = 0; i < mesh.count; i++) {
        var p = peopleType.items[i];
        p.d += p.dir * p.speed * speedMul * dt;
        if (p.d > p.span.d1) p.d = p.span.d0 + 0.5;
        else if (p.d < p.span.d0) p.d = p.span.d1 - 0.5;
        routeAt(p.rt, p.d, _f);
        var px = _f.x + (-_f.dz) * p.lat;
        var pz = _f.z + (_f.dx) * p.lat;
        var yaw = Math.atan2(-(_f.dz * p.dir), _f.dx * p.dir);
        var bob = Math.abs(Math.sin(timeAcc * p.speed * 3.4 + p.ph)) * 0.035;
        var py = _f.y + 0.04 + bob;
        var c = Math.cos(yaw), s = Math.sin(yaw);
        var sc = p.scale;
        if (!isFinite(px) || !isFinite(pz) || !isFinite(py) || !isFinite(yaw) || !isFinite(sc)) { px = 0; py = -1000; pz = 0; yaw = 0; }
        var o = i * 16;
        arr[o] = c * sc; arr[o + 1] = 0; arr[o + 2] = -s * sc; arr[o + 3] = 0;
        arr[o + 4] = 0; arr[o + 5] = sc; arr[o + 6] = 0; arr[o + 7] = 0;
        arr[o + 8] = s * sc; arr[o + 9] = 0; arr[o + 10] = c * sc; arr[o + 11] = 0;
        arr[o + 12] = px; arr[o + 13] = py; arr[o + 14] = pz; arr[o + 15] = 1;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    /* ---------------------------------------------------------- air update */
    function updateAir(dt, nightV, weather) {
      var showBirds = layers.aircraft && nightV < 0.55 && weather !== 'rain';
      if (birdMesh) birdMesh.visible = showBirds;
      if (birdMat) {
        birdMat.uniforms.uTime.value = timeAcc;
        birdMat.uniforms.uNight.value = nightV;
      }
      // helicopter circles the harbour
      heli.t += dt * 0.018;
      var ang = heli.t;
      heli.x = -120 + Math.cos(ang) * 760;
      heli.z = -20 + Math.sin(ang) * 300;
      heli.y = 52 + Math.sin(ang * 2.3) * 8;
      var hx = heli.x, hz = heli.z;
      var nx = -120 + Math.cos(ang + 0.02) * 760;
      var nz = -20 + Math.sin(ang + 0.02) * 300;
      heli.heading = Math.atan2(-(nz - hz), nx - hx);
      var visible = layers.aircraft && !(weather === 'rain' && nightV < 0.2);
      if (heli.mesh) {
        heli.mesh.visible = visible; heli.rotor.visible = visible;
        heli.mesh.position.set(hx, heli.y, hz);
        heli.mesh.rotation.set(0.04, heli.heading, Math.sin(ang * 2.3) * 0.06, 'YXZ');
        heli.rotor.position.set(hx, heli.y + 1.78, hz);
        heli.rotor.rotation.y = timeAcc * 26;
      }
      if (visible && nightV > 0.25) {
        var blink = (Math.sin(timeAcc * 4.0) > 0.1) ? 1.0 : 0.0;
        lights.push(hx, heli.y + 1.0, hz, [1.0, 0.1, 0.08], 1.4, blink);
        lights.push(hx - Math.cos(heli.heading) * 5.0, heli.y + 0.9, hz + Math.sin(heli.heading) * 5.0, [1.0, 0.95, 0.85], 0.9, 0.85);
      }
    }

    /* ----------------------------------------------------------- show update
     * Real "A Symphony of Lights" runs 20:00-22:00.  The automatic schedule is
     * therefore gated to 19.8-24 and 0-1.5 wall-clock hours *and* deep night;
     * life.triggerShow() stays a forced trigger for hero screenshots / QA. */
    var SHOW_WINDOW_START = 19.8, SHOW_WINDOW_END = 1.5;
    var lastHours = 21;
    function showWindowOK(h) {
      return isFinite(h) && (h >= SHOW_WINDOW_START || h <= SHOW_WINDOW_END);
    }
    function clearShowNow() {
      show.active = false;
      show.forced = false;
      show.t = 0;
      show.intensity = 0;
      show.nextBurst = 0;
      if (beams) { beams.mat.opacity = 0; beams.mesh.count = 0; }
      for (var i = 0; i < fw.particles.length; i++) fw.particles[i].live = false;
      fw.drawN = 0;
      fw.geo.setDrawRange(0, 0);
      fw.geo.attributes.aAlpha.needsUpdate = true;
    }
    /// Public trigger.  Explicit calls are gated to the real show window
    /// (19.8-01.5) so a day/dawn deep-link can never paint fireworks; pass
    /// `true` to force it for hero screenshots.
    function triggerShow(force) {
      if (!layers.show) return false;
      if (force !== true && !showWindowOK(lastHours)) return false;
      show.active = true;
      show.forced = force === true;
      show.t = 0;
      show.nextBurst = 0;
      show.fx.length = 0;
      show.timer = 38 + rng.next() * 12;
      show.intensity = 0;
      return true;
    }

    function spawnBurst(x, y, z, col, n, speed) {
      if (!isFinite(x) || !isFinite(y) || !isFinite(z) || !isFinite(speed)) return;
      var idx;
      for (var i = 0; i < n; i++) {
        var p = null;
        for (var k = 0; k < fw.particles.length; k++) {
          idx = (fw.cursor = (fw.cursor + 1) % fw.particles.length);
          if (!fw.particles[idx].live) { p = fw.particles[idx]; break; }
        }
        if (!p) p = fw.particles[fw.cursor];
        // random direction on a sphere
        var u = rng.float(-1, 1), th = rng.float(0, TAU);
        var r = Math.sqrt(Math.max(0, 1 - u * u));
        var sp = speed * rng.float(0.55, 1.0);
        p.x = x; p.y = y; p.z = z;
        p.vx = Math.cos(th) * r * sp;
        p.vy = u * sp * 1.05;
        p.vz = Math.sin(th) * r * sp;
        p.max = rng.float(2.2, 3.4);
        p.life = p.max;
        p.c = [col[0], col[1], col[2]];
        p.size = rng.float(3.5, 6.5);
        p.live = true;
      }
    }

    function updateShow(dt, nightV, hours) {
      var active = layers.show && nightV > 0.12;
      gShow.visible = active;
      if (!active) {
        if (show.active || fw.drawN > 0 || (beams && beams.mesh.count > 0)) clearShowNow();
        return;
      }
      var inWindow = showWindowOK(hours);
      // dawn / morning: hard clear anything running (even a forced show) and
      // arm the schedule for the next night window
      if (!inWindow) {
        if (show.active || fw.drawN > 0 || (beams && beams.mesh.count > 0)) clearShowNow();
        if (show.timer <= 0) show.timer = 8 + rng.next() * 8;
        return;
      }
      var autoOK = nightV > 0.5;
      if (!show.active) {
        // automatic scheduling only inside the window and in deep night
        if (!autoOK && !show.forced) {
          if (show.timer <= 0) show.timer = 8 + rng.next() * 8;
          return;
        }
        show.timer -= dt;
        if (show.timer <= 0) {
          triggerShow(true);
          show.forced = false;         // auto show obeys the night gate below
          show.timer = 40 + rng.next() * 10;
        }
      }
      if (show.active) {
        show.t += dt;
        var dur = show.duration;
        if (show.t > dur) { show.active = false; show.intensity = 0; show.forced = false; }
        show.intensity = smoothstep(0, 1.6, show.t) * (1 - smoothstep(dur - 3.2, dur, show.t));
        // beams
        if (beams) {
          var bm = beams.mesh;
          var count = Math.min(beamItems.length, qualityName === 'low' ? 4 : beamItems.length);
          bm.count = count;
          var inten = show.intensity * nightV;
          beams.mat.opacity = clamp(inten * 0.85, 0, 1);
          for (var i = 0; i < count; i++) {
            var it = beamItems[i];
            var az = Math.sin(timeAcc * it.speed + it.phase) * 1.15;
            var tilt = it.tilt + Math.sin(timeAcc * it.speed * 0.7 + it.phase) * 0.18;
            // yaw around Y, then lean outward around Z
            var qy = new THREE.Quaternion().setFromAxisAngle(UP_AXIS, az);
            var qz = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -tilt);
            dummy.quaternion.copy(qy).multiply(qz);
            dummy.scale.set(1, it.len, 1);
            dummy.position.set(it.x, it.y, it.z);
            dummy.updateMatrix();
            bm.setMatrixAt(i, dummy.matrix);
          }
          bm.instanceMatrix.needsUpdate = true;
        }
        // bursts
        while (show.nextBurst < show.burstTimes.length && show.t >= show.burstTimes[show.nextBurst]) {
          var bi = show.nextBurst++;
          var bx = rng.float(-340, 340);
          var bz = rng.float(-100, 100);
          if (!L.isWater(bx, bz)) { bx = rng.float(-240, 240); bz = rng.float(-70, 70); }
          var palette = [[1.0, 0.72, 0.25], [1.0, 0.25, 0.45], [0.35, 0.85, 1.0], [0.45, 1.0, 0.55], [1.0, 0.85, 0.5], [0.8, 0.4, 1.0]];
          spawnBurst(bx, rng.float(110, 185), bz, palette[bi % palette.length], 90 + Math.floor(rng.next() * 40), rng.float(30, 46));
        }
      } else {
        if (beams) { beams.mat.opacity = 0; beams.mesh.count = 0; }
      }
      // ---- simulate fireworks ----
      var posA = fw.pos, colA = fw.col, sizeA = fw.size, alphaA = fw.alpha;
      var nDraw = 0;
      for (var p = 0; p < fw.particles.length; p++) {
        var pp = fw.particles[p];
        if (!pp.live) continue;
        pp.life -= dt;
        if (pp.life <= 0) { pp.live = false; continue; }
        pp.vy -= 7.5 * dt;
        var drag = Math.max(0, 1 - 1.05 * dt);
        pp.vx *= drag; pp.vy *= drag; pp.vz *= drag;
        pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.z += pp.vz * dt;
        if (pp.y < 0.5) { pp.live = false; continue; }
        if (!isFinite(pp.x) || !isFinite(pp.y) || !isFinite(pp.z)) { pp.live = false; continue; }
        var lf = pp.life / pp.max;
        posA[nDraw * 3] = pp.x; posA[nDraw * 3 + 1] = pp.y; posA[nDraw * 3 + 2] = pp.z;
        var twinkle = 0.65 + 0.35 * Math.sin(pp.life * 42.0 + p * 1.7);
        colA[nDraw * 3] = pp.c[0] * twinkle;
        colA[nDraw * 3 + 1] = pp.c[1] * twinkle;
        colA[nDraw * 3 + 2] = pp.c[2] * twinkle;
        sizeA[nDraw] = pp.size * (0.6 + 0.7 * lf);
        alphaA[nDraw] = Math.pow(lf, 1.4) * (1.8 * nightV);
        nDraw++;
      }
      fw.drawN = nDraw;
      fw.geo.setDrawRange(0, nDraw);
      fw.geo.attributes.position.needsUpdate = true;
      fw.geo.attributes.aColor.needsUpdate = true;
      fw.geo.attributes.aSize.needsUpdate = true;
      fw.geo.attributes.aAlpha.needsUpdate = true;
    }

    /* ============================================================ update() */
    function update(dt, state, camera, env) {
      dt = (typeof dt === 'number' && isFinite(dt)) ? clamp(dt, 0, 0.1) : 0;
      if (state && state.paused) dt = 0;
      envRef = env || envRef;
      readLayers(state);
      var targetNight = readNight(state, env);
      // smooth the exposure of night-dependent glows
      nightF += (targetNight - nightF) * clamp(dt * 3.5, 0, 1);
      if (Math.abs(targetNight - nightF) < 0.002) nightF = targetNight;
      var weather = readWeather(state, env);
      var hours = hourOf(state, env);
      lastHours = hours;
      var speedMul = weather === 'rain' ? 0.85 : 1.0;
      timeAcc += dt;

      if (layers.traffic) {
        updateTraffic(dt, speedMul);
        updateTrams(dt);
      }
      if (layers.ferries) updateBoats(dt);
      if (layers.people) updatePeople(dt, nightF, weather);
      updateAir(dt, nightF, weather);

      // ---- lights (shared point cloud) ------------------------------------
      lights.clear();
      if (MAT_SOLID) {
        // a whisper of city-glow self-illumination keeps vehicles/boats from
        // going pitch black under the night sky before HK.Sky's fill light.
        MAT_SOLID.emissive.setRGB(0.016 * nightF, 0.020 * nightF, 0.030 * nightF);
      }
      if (nightF > 0.03 && layers.traffic) pushTrafficLights(nightF);
      if (nightF > 0.03 && layers.ferries) pushBoatLights(nightF);
      lights.points.visible = lights.n > 0;
      lights.flush();
      lights.mat.uniforms.uNight.value = clamp(nightF * 1.25, 0, 1.2);
      if (camera && renderer) {
        var h = (renderer.getDrawingBufferSize ? renderer.getDrawingBufferSize(new THREE.Vector2()).y : (renderer.domElement ? renderer.domElement.height : 900)) || 900;
        var proj = camera.projectionMatrix ? camera.projectionMatrix.elements[5] : 2.4;
        lights.mat.uniforms.uPxScale.value = proj * h * 0.5;
      }

      // ---- night show ------------------------------------------------------
      updateShow(dt, nightF, hours);
      if (fw.mat && camera && renderer) {
        var fh = (renderer.getDrawingBufferSize ? renderer.getDrawingBufferSize(new THREE.Vector2()).y : (renderer.domElement ? renderer.domElement.height : 900)) || 900;
        fw.mat.uniforms.uPxScale.value = camera.projectionMatrix.elements[5] * fh * 0.5;
      }

      applyLayerVisibility();
      if (tramType.mesh) tramType.mesh.count = tramType.n;
      return;
    }
    /* ============================================================ quality */
    function setQuality(q) {
      if (!QUALITY[q]) q = 'medium';
      qualityName = q;
      Q = QUALITY[q] || QUALITY.medium;
      var nTraffic = Q.traffic || 220;
      allocTraffic(nTraffic);
      var nPeople = Q.people || 260;
      peopleType.n = Math.min(PEOPLE_MAX, Math.round(nPeople), peopleType.items.length || PEOPLE_MAX);
      if (peopleType.mesh) peopleType.mesh.count = peopleType.n;
      var nTrams = tierCount(q, { low: 2, medium: 3, high: 4, ultra: 5 });
      tramType.n = tramRoute ? Math.min(tramType.max, Math.min(nTrams, tramType.items.length)) : 0;
      if (tramType.mesh) tramType.mesh.count = tramType.n;
      var nBirds = tierCount(q, { low: 10, medium: 20, high: 32, ultra: 44 });
      if (birdGeo) birdGeo.instanceCount = layers.aircraft ? nBirds : 0;
      // shadow casting by tier
      var shadows = !!Q.shadows;
      var i;
      for (i = 0; i < vehTypes.length; i++) vehTypes[i].mesh.castShadow = shadows;
      if (tramType.mesh) tramType.mesh.castShadow = shadows;
      if (peopleType.mesh) peopleType.mesh.castShadow = shadows;
      for (var k in boatMeshes) if (boatMeshes[k]) boatMeshes[k].castShadow = shadows;
      if (heli.mesh) heli.mesh.castShadow = shadows;
      if (birdMat) birdMesh.visible = layers.aircraft;
    }

    /* ============================================================ layers */
    function setLayer(name, on) {
      on = !!on;
      if (name === 'traffic' || name === 'cars' || name === 'trams') { layers.traffic = on; }
      else if (name === 'ferries' || name === 'boats') { layers.ferries = on; }
      else if (name === 'people' || name === 'crowd') { layers.people = on; }
      else if (name === 'aircraft' || name === 'birds' || name === 'helicopter') { layers.aircraft = on; if (birdGeo) birdGeo.instanceCount = on ? birdCount : 0; }
      else if (name === 'show' || name === 'neon' || name === 'lights') { layers.show = on; }
      applyLayerVisibility();
    }

    var birdCount = 24;
    function setNight(v) { forcedNight = (typeof v === 'number') ? clamp(v, 0, 1) : -1; }

    function getStats() {
      return {
        traffic: trafficCount,
        trams: tramType.n,
        people: peopleType.n,
        boats: boats.length,
        birds: birdGeo ? birdGeo.instanceCount : 0,
        lights: lights.n,
        wakes: wake.quads,
        beams: beams && beams.mesh.count,
        fireworks: fw.drawN,
        showActive: show.active,
        night: nightF,
        quality: qualityName,
        objects: group.children.length
      };
    }

    /// Debug/QA helper: scan every geometry + instance buffer owned by the life
    /// group for non-finite values.  Returns { nan: [...], meshes, instances }.
    function auditGeometry() {
      var report = { nan: [], meshes: 0, instances: 0 };
      function scan(name, arr, stride, kind) {
        if (!arr) return;
        for (var i = 0; i < arr.length; i++) {
          if (!isFinite(arr[i])) {
            report.nan.push({ name: name, attr: kind, index: i, value: String(arr[i]) });
            if (report.nan.length > 40) return;
          }
        }
      }
      group.traverse(function (o) {
        if (o.geometry) {
          report.meshes++;
          var a = o.geometry.attributes || {};
          for (var key in a) {
            if (a[key] && a[key].array) scan(o.name || o.type, a[key].array, a[key].itemSize, key);
          }
        }
        if (o.isInstancedMesh && o.instanceMatrix) {
          report.instances++;
          scan(o.name, o.instanceMatrix.array, 16, 'instanceMatrix');
        }
        if (o.isInstancedBufferGeometry && o._maxInstanceCount) report.instances++;
      });
      // dynamic buffers that are not geometry attributes
      scan('light-points', lights.pos, 3, 'position');
      scan('light-points', lights.col, 3, 'aColor');
      scan('light-points', lights.size, 1, 'aSize');
      scan('light-points', lights.alpha, 1, 'aAlpha');
      scan('fireworks', fw.pos, 3, 'position');
      scan('wakes', wake.pos, 3, 'position');
      report.nan = report.nan.slice(0, 40);
      return report;
    }

    function dispose() {
      if (scene) scene.remove(group);
      group.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) { for (var i = 0; i < o.material.length; i++) o.material[i].dispose(); }
          else o.material.dispose();
        }
      });
      for (var i = 0; i < DISPOSABLES.length; i++) {
        if (DISPOSABLES[i] && DISPOSABLES[i].dispose) { try { DISPOSABLES[i].dispose(); } catch (e) {} }
      }
      DISPOSABLES.length = 0;
      MAT_SOLID = null;
    }

    // initialise counts
    var api = {
      group: group,
      update: update,
      setQuality: setQuality,
      setLayer: setLayer,
      setNight: setNight,
      triggerShow: triggerShow,
      getStats: getStats,
      auditGeometry: auditGeometry,
      dispose: dispose,
      // debug hooks
      _boats: boats,
      _show: show,
      _fw: fw,
      _lights: lights,
      _beams: beams,
      _vehTypes: vehTypes,
      _tramType: tramType,
      _tramRoute: tramRoute,
      _boatRoutes: boatRoutes,
      _boatMeshes: boatMeshes,
      _time: function () { return timeAcc; }
    };
    setQuality(qualityName);
    // birds default count for the current tier
    birdCount = tierCount(qualityName, { low: 10, medium: 20, high: 32, ultra: 44 });
    if (birdGeo) birdGeo.instanceCount = birdCount;
    // first show should not fire instantly in the app, but keep it snappy at night
    show.timer = 12 + rng.next() * 10;
    applyLayerVisibility();
    return api;
  }

  HK.Life = { create: create };
})();
