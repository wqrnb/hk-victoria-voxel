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

    /* ----------------------------------------------------- scan districts */
    for (var di = 0; di < L.DISTRICTS.length; di++) {
      var dist = L.DISTRICTS[di];
      if (dist.id === 'klhills' && !opts.hills) { /* still allow sparse */ }
      var allowTerrace = !!dist.hill;
      var rect = dist.rect;
      var step = dist.density > 0.9 ? 5 : (dist.density > 0.7 ? 6 : 8);
      if (allowTerrace) step = 11;
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
      for (var gz2 = rect2[1] + 2; gz2 < rect2[3] - 4; gz2 += step2) {
        for (var gx2 = rect2[0] + 2; gx2 < rect2[2] - 4; gx2 += step2) {
          var x2 = gx2 + r2.float(-1.5, 1.5), z2 = gz2 + r2.float(-1.5, 1.5);
          var n2 = idx(x2, z2);
          if (n2 < 0) continue;
          var t2 = typeArr[n2];
          if (t2 !== T.PLOT && t2 !== T.TERRACE) continue;
          if (occ[n2] || (flagArr[n2] & RESERVED)) continue;
          if (!r2.chance(0.62)) continue;
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
    HK.log('city: buildings', placed, '(low-rise', lowPlaced + ')', 'attempts', attempts);
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
