/* ============================================================================
 * HK VOXEL HARBOUR — PROCEDURAL CITY
 * Places tens of thousands of voxel building volumes across both shores using
 * the terrain land-use grid, then merges them into chunked facade geometry.
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util, L = HK.Layout, T = HK.Terrain.TYPE, F = HK.FACADE;
  var B = HK.Buildings = {};
  var _material = null, _uniforms = null;

  B.createMaterial = function () {
    if (_material) return _material;
    _material = HK.FacadeMaterial.create();
    _uniforms = _material.userData.uniforms;
    return _material;
  };
  B.getUniforms = function () { return _uniforms; };
  B.update = function (dt, env) {
    if (!_uniforms) return;
    _uniforms.uTime.value += dt;
    var night = env && env.night != null ? env.night : (HK.app ? HK.app.state.night : 0);
    _uniforms.uNight.value = night;
    var qn = (HK.app && HK.app.state && HK.app.state.quality) || 'high';
    var qcfg = HK.QUALITY[qn];
    if (qcfg && _uniforms.uFacadeScale) _uniforms.uFacadeScale.value = qcfg.facadeScale || 1;
    var tint = env && (env.horizonColor || env.skyHorizon);
    var zen = env && (env.zenithColor || env.skyZenith);
    if (zen && tint) {
      _uniforms.uSkyTint.value.copy(zen);
      _uniforms.uSkyTint.value.lerp(tint, 0.28);
      if (!env.colorsLinear) _uniforms.uSkyTint.value.convertSRGBToLinear();
    } else if (tint) {
      _uniforms.uSkyTint.value.copy(tint);
      if (!env.colorsLinear) _uniforms.uSkyTint.value.convertSRGBToLinear();
    } else {
      _uniforms.uSkyTint.value.setRGB(0.62, 0.76, 0.85).multiplyScalar(1 - night * 0.8);
    }
  };

  /* --------------------------------------------------------- height field */
  var NODES = [
    { x: -170, z: 400, amp: 1.00, r: 330 },   // Central
    { x: 60, z: 420, amp: 0.90, r: 260 },     // Admiralty
    { x: 300, z: 420, amp: 0.82, r: 270 },    // Wan Chai
    { x: 560, z: 450, amp: 0.62, r: 250 },    // Causeway Bay
    { x: 860, z: 400, amp: 0.72, r: 270 },    // North Point
    { x: 1100, z: 430, amp: 1.00, r: 300 },   // Quarry Bay
    { x: 150, z: -380, amp: 1.00, r: 300 },   // TST
    { x: -250, z: -400, amp: 0.82, r: 290 },  // TST west / Peninsula
    { x: -930, z: -430, amp: 1.05, r: 320 },  // West Kowloon / ICC
    { x: 430, z: -400, amp: 0.55, r: 260 },   // Hung Hom
    { x: 20, z: -820, amp: 0.48, r: 300 },    // Mong Kok
    { x: -650, z: 430, amp: 0.4, r: 260 },    // Sheung Wan / Sai Ying Pun
    { x: 1350, z: -500, amp: 0.45, r: 300 },  // Kowloon Bay / Kwun Tong
    { x: 1050, z: -400, amp: 0.5, r: 240 }    // Kai Tak
  ];
  B.heightField = function (x, z) {
    var m = 0;
    for (var i = 0; i < NODES.length; i++) {
      var n = NODES[i];
      var dx = (x - n.x) / n.r, dz = (z - n.z) / n.r;
      var g = n.amp * Math.exp(-(dx * dx + dz * dz) * 2.0);
      if (g > m) m = g;
    }
    return m;
  };

  /* ---------------------------------------------------------- style picks */
  var GLASSY = [F.GLASS_BLUE, F.GLASS_TEAL, F.GLASS_SILVER, F.CURTAIN_DARK, F.GLASS_BRONZE, F.BANDED, F.LED];
  var OLD = [F.RESI_OLD, F.PUNCHED, F.RESI, F.BANDED, F.INDUSTRIAL];
  function richColor(hex, rng) {
    var c = U.hexRgb(hex);
    var l = U.lum(c);
    c = [l + (c[0] - l) * 1.22, l + (c[1] - l) * 1.22, l + (c[2] - l) * 1.22];
    c = U.shadeRgb(c, rng.float(0.92, 1.08));
    return c;
  }
  function pickStyle(dist, h, rng) {
    var oldTown = dist.id === 'tst' || dist.id === 'jordan' || dist.id === 'mongkok' || dist.id === 'shamshuipo' || dist.id === 'hunghom' || dist.id === 'tokwawan' || dist.id === 'kennedy' || dist.id === 'sheungwan';
    if (oldTown && rng.chance(0.5)) return rng.pick(dist.styles);
    if (h > 95 && rng.chance(0.72)) return rng.pick(GLASSY);
    if (h > 55 && rng.chance(0.45)) return rng.pick(GLASSY);
    if (h < 18) return rng.pick([F.PUNCHED, F.RESI_OLD, F.INDUSTRIAL, F.RESI]);
    return rng.pick(dist.styles);
  }
  B.pickStyle = pickStyle;

  /* ------------------------------------------------------------ placement */
  function placeAll(world, layout, city, opts) {
    var W = world.W, H = world.H, MINX = world.bounds.minX, MINZ = world.bounds.minZ;
    var occ = new Uint8Array(W * H);
    var heightArr = world.height, typeArr = world.type, flagArr = world.flags;
    var RESERVED = HK.Terrain.FLAGS.RESERVED;
    var placed = 0, attempts = 0;
    var maxX = world.bounds.maxX, maxZ = world.bounds.maxZ;
    var qname = (HK.app && HK.app.state && HK.app.state.quality) || 'high';
    var qcfg = HK.QUALITY[qname] || HK.QUALITY.high;
    var stepMul = qcfg.cityStep || 1;
    var doFront = !!qcfg.waterfront;
    var doPil = !!qcfg.pilasters;

    function idx(x, z) {
      var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);
      if (i < 0 || i >= W || j < 0 || j >= H) return -1;
      return j * W + i;
    }
    function sampleH(x, z) { var n = idx(x, z); if (n < 0) return -1; if (typeArr[n] === T.WATER) return -1; return heightArr[n]; }

    function footprintOK(x0, z0, w, d, allowTerrace, minH, maxH2) {
      if (w < 4 || d < 4) return false;
      if (x0 < MINX + 2 || z0 < MINZ + 2 || x0 + w > maxX - 2 || z0 + d > maxZ - 2) return false;
      var lo = 999, hi = -1;
      var step = (w * d > 90) ? 2 : 1;
      for (var z = z0; z <= z0 + d; z += step) {
        for (var x = x0; x <= x0 + w; x += step) {
          var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);
          if (i < 1 || i >= W - 1 || j < 1 || j >= H - 1) return false;
          var n = j * W + i;
          var t = typeArr[n];
          if (t !== T.PLOT && (!allowTerrace || t !== T.TERRACE)) return false;
          if (flagArr[n] & RESERVED) return false;
          if (occ[n]) return false;
          var hh = heightArr[n];
          if (hh < lo) lo = hh;
          if (hh > hi) hi = hh;
          if (hi - lo > 3) return false;
        }
      }
      // 1-cell breathing ring (alleys / no party walls with neighbours)
      for (var zz = z0 - 1; zz <= z0 + d + 1; zz++) {
        for (var xx = x0 - 1; xx <= x0 + w + 1; xx++) {
          if (xx > x0 && xx < x0 + w && zz > z0 && zz < z0 + d) continue;
          var ni = idx(xx, zz);
          if (ni >= 0 && occ[ni]) return false;
        }
      }
      minH.v = lo; maxH2.v = hi;
      return true;
    }

    var minBox = { v: 0 }, maxBox = { v: 0 };

    function markOcc(x0, z0, w, d) {
      var i0 = Math.floor(x0 - MINX), j0 = Math.floor(z0 - MINZ);
      for (var j = j0; j <= j0 + d; j++) {
        for (var i = i0; i <= i0 + w; i++) {
          if (i >= 0 && i < W && j >= 0 && j < H) occ[j * W + i] = 1;
        }
      }
    }

    /* Real OSM footprints may share a party wall, and they may sit on the
       artistic road grid. Water, rock and an existing volume still reject. */
    var LAND_OK = {};
    LAND_OK[T.PLOT] = 1; LAND_OK[T.ROAD] = 1; LAND_OK[T.ROAD_MAIN] = 1; LAND_OK[T.ROAD_MARK] = 1;
    LAND_OK[T.SIDEWALK] = 1; LAND_OK[T.PLAZA] = 1; LAND_OK[T.PROMENADE] = 1;
    LAND_OK[T.PARK] = 1; LAND_OK[T.LAWN] = 1; LAND_OK[T.TERRACE] = 1;
    function measuredOK(x0, z0, w, d) {
      if (w < 2 || d < 2) return false;
      if (x0 < MINX + 2 || z0 < MINZ + 2 || x0 + w > maxX - 2 || z0 + d > maxZ - 2) return false;
      var lo = 999, hi = -1, step = (w * d > 140) ? 2 : 1;
      for (var z = z0; z <= z0 + d; z += step) {
        for (var x = x0; x <= x0 + w; x += step) {
          var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);
          if (i < 1 || i >= W - 1 || j < 1 || j >= H - 1) return false;
          var n = j * W + i;
          if (!LAND_OK[typeArr[n]]) return false;
          if (occ[n]) return false;
          var hh = heightArr[n];
          if (hh < lo) lo = hh;
          if (hh > hi) hi = hh;
          if (hi - lo > 10) return false;
        }
      }
      minBox.v = lo; maxBox.v = hi;
      return true;
    }
    function districtAt(x, z) {
      for (var i = 0; i < L.DISTRICTS.length; i++) {
        var d = L.DISTRICTS[i];
        var r = d.rect;
        if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return d;
      }
      return null;
    }
    function coveredByLandmark(x, z, h) {
      var keys = L.LANDMARKS;
      for (var k in keys) {
        var lm = keys[k];
        if (!lm || lm.w <= 2) continue;
        var dx = x - lm.x, dz = z - lm.z;
        if (lm.h >= 40 && h >= 40 && Math.abs(h - lm.h) < Math.max(20, lm.h * 0.22) && dx * dx + dz * dz < 55 * 55) return true;
        if (Math.abs(dx) < lm.w / 2 + 3 && Math.abs(dz) < lm.d / 2 + 3 && h < lm.h + 28) return true;
      }
      return false;
    }
    function makeMeasured(x, z, w, d, lo, hi, dist, rng, Hh) {
      Hh = Math.max(4, Math.min(250, Hh));
      var fine = (qcfg.footStep || 1) <= 0.5;
      var lip = fine ? 0.5 : 1;
      var style = pickStyle(dist, Hh, rng);
      var colorHex = dist.colors[Math.floor(rng.next() * dist.colors.length) % dist.colors.length];
      var seed = rng.int(1, 99999);
      var colorRgb = richColor(colorHex, rng);
      var K = new HK.Kit(city, { style: style, color: colorRgb, seed: seed, glow: 1 });
      var plinthTop = hi + 0.15;
      K.boxC(x, z, w + 0.2, d + 0.2, Math.min(lo, hi) - 1.1, plinthTop, { color: '#7d786f', style: F.PURE, collide: true, jitter: 0.02 });
      if (Hh < 16) {
        K.boxC(x, z, w, d, plinthTop, plinthTop + Hh, { color: colorRgb, style: style, seed: seed, collide: true });
        city.frontage.push({ x: x, z: z, w: w, d: d, base: plinthTop, top: plinthTop + Hh, district: dist.id, neon: dist.neon, seed: seed, style: style, h: Hh });
        return;
      }
      var y = plinthTop;
      var cw = w, cd = d;
      if (Hh > 28) {
        var podH = Math.min(Hh * 0.18, rng.float(3.5, 7));
        K.boxC(x, z, cw, cd, y, y + podH, { color: U.shadeRgb(colorRgb, 0.86), style: Hh > 70 ? style : F.PUNCHED, seed: seed + 1, collide: true });
        y += podH;
        cw = Math.max(2.5, cw - lip);
        cd = Math.max(2.5, cd - lip);
      }
      var remain = Math.max(3, Hh - (y - plinthTop));
      var cuts = remain > 70 ? 3 : (remain > 28 ? 2 : 1);
      for (var s = 0; s < cuts; s++) {
        var frac = s === cuts - 1 ? 1 : (s === 0 ? 0.62 : 0.24);
        var seg = s === cuts - 1 ? Math.max(2, (plinthTop + Hh) - y) : remain * frac;
        K.boxC(x, z, cw, cd, y, y + seg, { color: colorRgb, style: style, seed: seed + s, collide: true });
        if (fine && Hh > 24 && seg > 8) {
          var belt = y + 6;
          var topSeg = y + seg - 0.4;
          while (belt < topSeg) {
            K.boxC(x, z, cw + 0.45, cd + 0.45, belt, belt + 0.28, { color: U.shadeRgb(colorRgb, 1.08), style: F.PURE, collide: false, jitter: 0 });
            belt += 14;
          }
        }
        y += seg;
        if (s < cuts - 1) {
          cw = Math.max(2.5, cw - lip);
          cd = Math.max(2.5, cd - lip);
        }
      }
      if (Hh > 36) {
        K.boxC(x, z, Math.max(2, cw - lip), Math.max(2, cd - lip), y, y + rng.float(1.2, 2.4), { color: U.shadeRgb(colorRgb, 0.7), style: F.PURE, collide: false });
        y += 1.6;
      }
      if (Hh > 48 && rng.chance(0.45)) K.roofClutter(x, z, Math.max(3, cw - 1), Math.max(3, cd - 1), y, seed + 9);
      if (doPil && fine && Hh > 28 && Math.min(w, d) >= 6) {
        var shoreZ = z > 0 ? L.southShoreZ(x) : L.northShoreZ(x);
        if (Math.abs(z - shoreZ) < 90) {
          var face = z > 0 ? -1 : 1;
          var finCol = U.shadeRgb(colorRgb, 0.78);
          for (var px = -w / 2 + 1.6; px < w / 2 - 0.8; px += 3) {
            K.boxC(x + px, z + face * (d / 2 + 0.22), 0.35, 0.42, plinthTop + 0.4, plinthTop + Hh * 0.9, {
              color: finCol, style: F.PURE, collide: false, jitter: 0
            });
          }
        }
      }
      city.frontage.push({ x: x, z: z, w: w, d: d, base: plinthTop, top: plinthTop + Hh, district: dist.id, neon: dist.neon, seed: seed, style: style, h: Hh });
      if (dist.neon > 0.35 && Hh > 10) city.signs.push({ x: x, z: z, w: w, d: d, base: plinthTop, top: plinthTop + Hh, district: dist.id, seed: seed, neon: dist.neon });
    }
    function fitMeasured(x, z, w, d) {
      function okAt(xx, zz, ww, dd) {
        return ww >= 2 && dd >= 2 && measuredOK(xx - ww / 2, zz - dd / 2, ww, dd);
      }
      if (okAt(x, z, w, d)) return [x, z, w, d];
      var inland = z > 0 ? 1 : -1;
      for (var s = 1; s <= 3; s++) {
        var ww = Math.max(2, Math.round((w - s * 0.5) * 2) / 2);
        var dd = Math.max(2, Math.round((d - s * 0.5) * 2) / 2);
        if (okAt(x, z + inland * s * 2, ww, dd)) return [x, z + inland * s * 2, ww, dd];
        if (okAt(x, z, ww, dd)) return [x, z, ww, dd];
      }
      return null;
    }
    var OSM_SHORE = { central: 1, admiralty: 1, wanchai: 1, causeway: 1, northpoint: 1, quarrybay: 1, sheungwan: 1, tst: 1, jordan: 1, westkowloon: 1, hunghom: 1, kaitak: 1, tokwawan: 1 };
    function placeFootprints() {
      var fp = HK.FOOTPRINTS;
      if (!fp || !fp.b || !qcfg.footprints) return 0;
      var minH = qcfg.footMin || 6;
      var data = fp.b, n = 0, skipped = 0;
      var genericHK = { id: 'osm', minH: 12, maxH: 120, styles: GLASSY, colors: ['#9eb4c0', '#c8bfae', '#8ea6b0', '#d5d0c6'], neon: 0.35, hill: false };
      var genericKL = { id: 'osm', minH: 12, maxH: 90, styles: OLD.concat(GLASSY), colors: ['#c2b49a', '#a9b8b2', '#d0c4ae', '#8fa3a8'], neon: 0.6, hill: false };
      for (var i = 0; i < data.length; i += 5) {
        var x = data[i], z = data[i + 1], w = data[i + 2], d = data[i + 3], h = data[i + 4];
        if (h < minH) { skipped++; continue; }
        if (coveredByLandmark(x, z, h)) { skipped++; continue; }
        var fit = fitMeasured(x, z, w, d);
        if (!fit) { skipped++; continue; }
        x = fit[0]; z = fit[1]; w = fit[2]; d = fit[3];
        markOcc(x - w / 2, z - d / 2, w, d);
        var dist = districtAt(x, z) || (z > 0 ? genericHK : genericKL);
        var seed = ((Math.round(x * 2) * 73856093) ^ (Math.round(z * 2) * 19349663)) >>> 0;
        makeMeasured(x, z, w, d, minBox.v, maxBox.v, dist, new HK.Rng(seed || 1), h);
        n++;
      }
      HK.log('city: osm footprints', n, 'skipped', skipped, 'of', data.length / 5);
      return n;
    }

    /* ---------------------------------------------------- one building */
    function makeBuilding(x, z, w, d, lo, hi, dist, rng) {
      var baseY = hi;
      var Hh = dist.minH + (dist.maxH - dist.minH) * Math.pow(rng.next(), 1.65) * (0.46 + B.heightField(x, z) * 0.78);
      if (rng.chance(0.008 + B.heightField(x, z) * 0.01)) Hh *= 1.3;
      Hh = Math.round(U.clamp(Hh, dist.minH, Math.min(196, dist.maxH * 1.05)));
      if (dist.hill) Hh = Math.min(Hh, 34);
      var style = pickStyle(dist, Hh, rng);
      var colorHex = dist.colors[Math.floor(rng.next() * dist.colors.length) % dist.colors.length];
      var seed = rng.int(1, 99999);
      var colorRgb = richColor(colorHex, rng);
      var K = new HK.Kit(city, { style: style, color: colorRgb, seed: seed, glow: 1 });
      var wallCol = colorRgb;
      var darkWall = U.shadeRgb(wallCol, 0.72);

      // plinth to deal with uneven terrain
      var plinthTop = baseY + 0.15;
      if (baseY - lo > 0.5) {
        K.boxC(x, z, w + 0.2, d + 0.2, lo - 1.5, plinthTop, { color: '#7d786f', style: F.PURE, collide: true, jitter: 0.02 });
      } else {
        K.boxC(x, z, w + 0.2, d + 0.2, lo - 1.2, plinthTop, { color: '#7d786f', style: F.PURE, collide: true, jitter: 0.02 });
      }

      var y = plinthTop;
      var topY = y + Hh;
      var cw = w, cd = d;

      // podium
      if (Hh > 24 && rng.chance(0.55)) {
        var podH = Math.min(Hh * 0.24, rng.float(2.5, 6.5));
        K.boxC(x, z, cw, cd, y, y + podH, { color: U.shadeRgb(wallCol, 0.84), style: rng.chance(0.5) ? F.PUNCHED : style, seed: seed + 1, collide: true });
        // shop awnings on two sides
        var awn = rng.pick([HK.PALETTE.neonCyan, HK.PALETTE.neonPink, HK.PALETTE.neonAmber, '#e8e0cf', HK.PALETTE.tramGreen]);
        K.boxC(x, z - cd / 2 - 0.5, cw * 0.86, 1.0, y + 1.3, y + 1.9, { color: awn, style: F.PURE, collide: false, jitter: 0.05 });
        if (rng.chance(0.5)) K.boxC(x, z + cd / 2 + 0.5, cw * 0.7, 1.0, y + 1.3, y + 1.9, { color: awn, style: F.PURE, collide: false, jitter: 0.05 });
        y += podH;
        if (Hh > 60 && cw > 8 && rng.chance(0.75)) { cw -= rng.int(1, 2); cd -= rng.int(1, 2); }
      }

      var remaining = Hh - (y - plinthTop);
      if (remaining < 3) remaining = 3;
      // vertical form: 1-3 stacked sections
      var sections = [];
      if (remaining < 16) {
        sections.push([cw, cd, remaining]);
      } else if (remaining < 50) {
        sections.push([cw, cd, remaining * 0.76]);
        sections.push([Math.max(4, cw - rng.int(0, 2)), Math.max(4, cd - rng.int(0, 2)), remaining * 0.24]);
      } else {
        var s1 = remaining * rng.float(0.48, 0.62);
        var s2 = remaining * rng.float(0.22, 0.3);
        var s3 = remaining - s1 - s2;
        sections.push([cw, cd, s1]);
        sections.push([Math.max(4, cw - rng.int(1, 3)), Math.max(4, cd - rng.int(1, 3)), s2]);
        sections.push([Math.max(3, cw - rng.int(3, 5)), Math.max(3, cd - rng.int(3, 5)), s3]);
      }
      var topBox = null;
      for (var si = 0; si < sections.length; si++) {
        var sec = sections[si];
        var sh = Math.max(1.2, sec[2]);
        var col = si === 0 ? wallCol : U.shadeRgb(wallCol, si === 1 ? 0.96 : 0.9);
        K.boxC(x, z, sec[0], sec[1], y, y + sh, { color: col, style: style, seed: seed + si, collide: true });
        y += sh;
        topBox = sec;
      }
      var topY2 = y;
      var tw = topBox[0], td = topBox[1];

      // harbour-facing fins so mid-distance towers read as ribbed glass, not boxes
      var skyline = dist.id === 'central' || dist.id === 'admiralty' || dist.id === 'wanchai' || dist.id === 'tst' || dist.id === 'westkowloon' || dist.id === 'quarrybay';
      if (doPil && skyline && Hh > 48 && w >= 7) {
        var nzs = dist.side === 'hk' ? -1 : 1;
        var fins = w > 12 ? 4 : 3;
        for (var fi = 0; fi < fins; fi++) {
          var fx = x + (fi - (fins - 1) / 2) * (w * 0.22);
          var fz = z + nzs * (d * 0.5 + 0.2);
          K.box(fx - 0.22, fz - 0.2, fx + 0.22, fz + 0.2, plinthTop + 1.4, plinthTop + Hh * 0.96, {
            color: U.shadeRgb(wallCol, 1.08), style: F.PURE, collide: false, jitter: 0
          });
        }
      }

      // crown / roof architecture
      var crownR = rng.next();
      if (Hh > 55 && crownR < 0.22) {
        // lit LED crown / media facade
        var crH = rng.float(3, 8);
        K.boxC(x, z, tw + 0.3, td + 0.3, topY2, topY2 + crH, { color: rng.pick(['#26343f', '#1e2a34', '#2f3d47']), style: F.LED, seed: seed + 5, glow: 1.6, collide: true });
        topY2 += crH;
      } else if (Hh > 40 && crownR < 0.4) {
        // stepped crown
        var crownS = 2;
        for (var c = 0; c < crownS; c++) {
          var cwid = Math.max(2, tw * (0.8 - c * 0.22));
          var chei = rng.float(0.8, 2.2);
          K.boxC(x, z, cwid, Math.max(2, td * (0.8 - c * 0.22)), topY2, topY2 + chei, { color: U.shadeRgb(wallCol, 0.8 - c * 0.05), style: F.PURE, collide: true });
          topY2 += chei;
        }
      } else if (Hh > 70 && crownR < 0.5) {
        // pyramid roof
        var pw = tw * 0.86, pd = td * 0.86, ph = rng.float(4, Math.min(14, tw * 0.8));
        K.pyramid(x, z, pw, pd, topY2, topY2 + ph, { roofColor: rng.pick(['#4a5a5e', '#52605e', '#5a5145']), style: F.PURE });
        topY2 += ph;
      } else if (Hh > 95 && crownR < 0.58) {
        // spire
        var spH = rng.float(6, 18);
        K.spire(x, z, Math.max(0.6, tw * 0.12), topY2, topY2 + spH, { color: '#8b9296', style: F.PURE, collide: false });
        topY2 += spH;
      }

      // roof detail
      if (Hh > 18) {
        var clutter = Hh > 60 || rng.chance(0.42);
        if (clutter) K.roofClutter(x, z, Math.max(4, tw - 1), Math.max(4, td - 1), topY2, seed + 11);
        else if (rng.chance(0.55)) {
          K.boxC(x + rng.float(-1, 1), z + rng.float(-1, 1), rng.float(0.8, 2), rng.float(0.8, 2), topY2, topY2 + rng.float(0.4, 1.1), { color: '#5b5e60', style: F.PURE, collide: false });
        }
        if (Hh > 58) K.beacon(x + tw * 0.32, topY2 + 1.2, z + td * 0.32);
        if (Hh > 110 && rng.chance(0.3)) {
          // rooftop helipad
          K.cyl(x, z, Math.min(tw, td) * 0.3, topY2 + 0.02, topY2 + 0.22, 16, { color: '#5f6365', style: F.PURE, collide: false, top: true });
        }
      }

      // record for props (signage etc.)
      city.frontage.push({
        x: x, z: z, w: w, d: d, base: plinthTop, top: topY2,
        district: dist.id, neon: dist.neon, seed: seed, style: style, h: Hh
      });
      if (dist.neon > 0.2 && topY2 - baseY > 12) {
        city.signs.push({ x: x, z: z, w: w, d: d, base: plinthTop, top: topY2, district: dist.id, seed: seed, neon: dist.neon });
      }
      placed++;
    }

    /* real footprints claim their plots before procedural fill and shore shops */
    var footN = placeFootprints();
    placed += footN;
    var frontN = placeWaterfront();
    placed += frontN;

    /* ----------------------------------------------------- scan districts */
    for (var di = 0; di < L.DISTRICTS.length; di++) {
      var dist = L.DISTRICTS[di];
      if (dist.id === 'klhills' && !opts.hills) { /* still allow sparse */ }
      var allowTerrace = !!dist.hill;
      var rect = dist.rect;
      var step = dist.density > 0.9 ? 5 : (dist.density > 0.7 ? 6 : 8);
      if (allowTerrace) step = 11;
      step = Math.max(4, Math.round(step * stepMul));
      var rng = new HK.Rng((U.hashStr(dist.id) ^ 0x5f3759df) >>> 0);
      var scale = 1.58 + (1 - dist.density) * 0.45;
      for (var gz = rect[1] + 2; gz < rect[3] - 4; gz += step) {
        var rowOff = (Math.floor((gz - rect[1]) / step) % 2) * Math.round(step * 0.5);
        for (var gx = rect[0] + 2 + rowOff; gx < rect[2] - 4; gx += step) {
          var x = gx + rng.float(-2.5, 2.5), z = gz + rng.float(-2.5, 2.5);
          var n = idx(x, z);
          if (n < 0) continue;
          var t = typeArr[n];
          if (t !== T.PLOT && !(allowTerrace && t === T.TERRACE)) continue;
          if (flagArr[n] & RESERVED) continue;
          if (occ[n]) continue;
          if (qcfg.footprints && OSM_SHORE[dist.id] && !rng.chance(0.28)) continue;
          if (!rng.chance(0.9 * dist.density)) continue;
          attempts++;
          var w = Math.round(rng.float(dist.lot[0], dist.lot[1]) * scale);
          var d = Math.round(rng.float(dist.lot[0], dist.lot[1]) * scale);
          if (allowTerrace) { w = Math.round(w * 0.7); d = Math.round(d * 0.7); }
          var ok = false;
          for (var att = 0; att < 3; att++) {
            var x0 = Math.round(x - w / 2), z0 = Math.round(z - d / 2);
            if (footprintOK(x0, z0, w, d, allowTerrace, minBox, maxBox)) {
              markOcc(x0, z0, w, d);
              makeBuilding(x0 + w / 2, z0 + d / 2, w, d, minBox.v, maxBox.v, dist, rng);
              ok = true; break;
            }
            w = Math.max(4, w - 2); d = Math.max(4, d - 2);
          }
        }
      }
    }
    // ---- second pass: low-rise street fabric fills the gaps between towers
    var lowRng = new HK.Rng(0x51ED270B);
    var lowPlaced = 0;
    function lowRiseOK(x0, z0, w, d, allowTerrace, minH, maxH2) {
      if (w < 3 || d < 3) return false;
      if (x0 < MINX + 2 || z0 < MINZ + 2 || x0 + w > maxX - 2 || z0 + d > maxZ - 2) return false;
      for (var z = z0; z <= z0 + d; z += 1) {
        for (var x = x0; x <= x0 + w; x += 1) {
          var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);
          var n = j * W + i;
          var t = typeArr[n];
          if (t !== T.PLOT && (!allowTerrace || t !== T.TERRACE)) return false;
          if (flagArr[n] & RESERVED) return false;
          if (occ[n]) return false;
        }
      }
      return true;
    }
    for (var di2 = 0; di2 < L.DISTRICTS.length; di2++) {
      var dist2 = L.DISTRICTS[di2];
      var rect2 = dist2.rect;
      if (dist2.density < 0.55) continue;
      var r2 = new HK.Rng((U.hashStr(dist2.id) ^ 0x9e3779b9) >>> 0);
      var step2 = dist2.density > 0.9 ? 4 : 5;
      step2 = Math.max(3, Math.round(step2 * stepMul));
      for (var gz2 = rect2[1] + 2; gz2 < rect2[3] - 4; gz2 += step2) {
        for (var gx2 = rect2[0] + 2; gx2 < rect2[2] - 4; gx2 += step2) {
          var x2 = gx2 + r2.float(-1.5, 1.5), z2 = gz2 + r2.float(-1.5, 1.5);
          var n2 = idx(x2, z2);
          if (n2 < 0) continue;
          var t2 = typeArr[n2];
          if (t2 !== T.PLOT && t2 !== T.TERRACE) continue;
          if (occ[n2] || (flagArr[n2] & RESERVED)) continue;
          if (!r2.chance(qcfg.footprints && OSM_SHORE[dist2.id] ? 0.34 : 0.62)) continue;
          var lw = r2.int(4, 10), ld = r2.int(4, 10);
          var x0b = Math.round(x2 - lw / 2), z0b = Math.round(z2 - ld / 2);
          if (!lowRiseOK(x0b, z0b, lw, ld, false, null, null)) continue;
          markOcc(x0b, z0b, lw, ld);
          var lowH = r2.int(3, 11);
          var lowSeed = r2.int(1, 99999);
          var lowCol = richColor(dist2.colors[r2.int(0, dist2.colors.length - 1)], r2);
          var lowStyle = r2.pick([F.PUNCHED, F.RESI_OLD, F.RESI, F.INDUSTRIAL, F.BANDED]);
          var lk = new HK.Kit(city, { style: lowStyle, color: lowCol, seed: lowSeed });
          var gy = Math.max(1, world.heightAt(x2, z2));
          lk.boxC(x2, z2, lw, ld, gy - 0.8, gy + lowH, { style: lowStyle, color: lowCol, roofColor: U.shadeRgb(lowCol, 0.62), seed: lowSeed });
          if (r2.chance(0.6)) lk.boxC(x2, z2, lw - 1.5, ld - 1.5, gy + lowH, gy + lowH + 0.8, { color: U.shadeRgb(lowCol, 0.55), style: F.PURE, collide: false });
          if (r2.chance(0.35)) city.signs.push({ x: x2, z: z2, w: lw, d: ld, base: gy, top: gy + lowH, district: dist2.id, seed: lowSeed, neon: dist2.neon });
          city.frontage.push({ x: x2, z: z2, w: lw, d: ld, base: gy, top: gy + lowH, district: dist2.id, neon: dist2.neon, seed: lowSeed, style: lowStyle, h: lowH });
          lowPlaced++;
        }
      }
    }
    placed += lowPlaced;

    function placeWaterfront() {
    /* waterfront ribbon: small shop blocks along both shores */
    var frontN = 0;
    if (doFront && L.southShoreZ && L.northShoreZ) {
      var fr = new HK.Rng(0xA11CE);
      var RESERVE = HK.Terrain.FLAGS.RESERVED;
      for (var sx = -1500; sx <= 1600; sx += 10) {
        var shores = [
          { shore: L.southShoreZ(sx), dir: 1, side: 'hk' },
          { shore: L.northShoreZ(sx), dir: -1, side: 'kl' }
        ];
        for (var si = 0; si < shores.length; si++) {
          var zHit = null;
          for (var stepZ = 6; stepZ <= 70; stepZ += 3) {
            var zz = shores[si].shore + shores[si].dir * stepZ;
            var ntry = idx(sx, zz);
            if (ntry < 0) continue;
            if (typeArr[ntry] === T.PLOT && !(flagArr[ntry] & RESERVE) && !occ[ntry]) { zHit = zz; break; }
          }
          if (zHit == null) continue;
          var sz = zHit;
          var distF = null;
          for (var di3 = 0; di3 < L.DISTRICTS.length; di3++) {
            var dd = L.DISTRICTS[di3];
            if (sx >= dd.rect[0] && sx <= dd.rect[2] && sz >= dd.rect[1] && sz <= dd.rect[3]) { distF = dd; break; }
          }
          if (!distF || distF.hill || distF.density < 0.55) continue;
          if (!fr.chance(0.78)) continue;
          var fw = 4, fd = 4, x0f = 0, z0f = 0, fitted = false;
          var sizes = [6, 5, 4, 3];
          for (var szi = 0; szi < sizes.length && !fitted; szi++) {
            fw = fd = sizes[szi];
            for (var nudge = 0; nudge <= 10 && !fitted; nudge += 2) {
              var zTry = sz + shores[si].dir * nudge;
              x0f = Math.round(sx - fw / 2);
              z0f = Math.round(zTry - fd / 2);
              if (footprintOK(x0f, z0f, fw, fd, false, minBox, maxBox)) { sz = zTry; fitted = true; }
            }
          }
          if (!fitted) continue;
          markOcc(x0f, z0f, fw, fd);
          var fH = fr.int(5, Math.min(18, Math.max(8, distF.minH)));
          var fSeed = fr.int(1, 99999);
          var fCol = richColor(distF.colors[fr.int(0, distF.colors.length - 1)], fr);
          var fStyle = fr.pick(distF.styles);
          var fk = new HK.Kit(city, { style: fStyle, color: fCol, seed: fSeed });
          var gy = Math.max(1, world.heightAt(sx, sz));
          fk.boxC(sx, sz, fw, fd, gy - 0.6, gy + fH, { style: fStyle, color: fCol, seed: fSeed });
          if (fr.chance(0.55)) {
            fk.boxC(sx, sz, Math.max(3, fw - 1.4), Math.max(3, fd - 1.4), gy + fH, gy + fH + fr.float(1.4, 3.6), {
              color: U.shadeRgb(fCol, 0.9), style: fStyle, seed: fSeed + 1
            });
          }
          var nzF = shores[si].side === 'hk' ? -1 : 1;
          fk.boxC(sx, sz + nzF * (fd / 2 + 0.12), fw * 0.9, 0.32, gy + 0.3, gy + Math.min(fH, 5.5), {
            color: U.shadeRgb(fCol, 0.78), style: F.PURE, collide: false, jitter: 0
          });
          city.frontage.push({ x: sx, z: sz, w: fw, d: fd, base: gy, top: gy + fH, district: distF.id, neon: distF.neon, seed: fSeed, style: fStyle, h: fH });
          if (distF.neon > 0.35) city.signs.push({ x: sx, z: sz, w: fw, d: fd, base: gy, top: gy + fH, district: distF.id, seed: fSeed, neon: distF.neon });
          frontN++;
        }
      }
    }
    return frontN;
    }
    HK.log('city: buildings', placed, '(osm', footN + ', low-rise', lowPlaced + ', waterfront', frontN + ')', 'attempts', attempts, 'detail', qname);
    B.stats = { placed: placed, attempts: attempts, colliders: city.colliders.length };
  }

  B.build = function (world, layout, opts) {
    opts = opts || {};
    B.createMaterial();
    var city = world.city || (world.city = new HK.CityBuilder({ chunkSize: 480 }));
    placeAll(world, layout, city, opts);
    return city;
  };

  B.finalize = function (world) {
    if (!world.city) return null;
    var mat = B.createMaterial();
    var group = world.city.buildGroup(mat, { name: 'CityBuildings' });
    world.cityGroup = group;
    return group;
  };
})();
