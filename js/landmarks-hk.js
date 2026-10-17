/* ============================================================================
 * HK VOXEL HARBOUR — HONG KONG ISLAND LANDMARKS
 * Hand-authored voxel architecture: Central, Admiralty, Wan Chai, Causeway Bay,
 * Quarry Bay, Victoria Peak. Uses the shared HK.Kit / HK.CityBuilder.
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util, L = HK.Layout, F = HK.FACADE;

  function G(world, x, z, fallback) {
    var h = world.heightAt(x, z);
    return h < 0 ? (fallback == null ? 1 : fallback) : h;
  }
  function K(city, style, color, seed, glow) {
    return new HK.Kit(city, { style: style, color: color, seed: seed == null ? 1 : seed, glow: glow == null ? 1 : glow });
  }
  function shade(hex, f) { return U.shadeRgb(U.hexRgb(hex), f); }
  function beacons(K1, x, top, z, r) {
    K1.beacon(x - (r || 2), top + 0.6, z - (r || 2));
    K1.beacon(x + (r || 2), top + 0.6, z + (r || 2));
  }

  /* ---------------------------------------------------------------- IFC */
  function buildIFC(world, city) {
    var cx = -204, cz = 404, g = G(world, cx, cz);
    // IFC Mall podium spans One IFC (west) and Two IFC (east, on the water)
    var M = K(city, F.BANDED, '#c5cccc', 1101);
    M.boxC(-228, 378, 112, 68, g - 1.2, g + 9, { color: '#c2cac9', style: F.BANDED, roofColor: '#767f7b', collide: true });
    M.boxC(-228, 378, 100, 58, g + 9, g + 9.9, { color: '#6f885f', style: F.PURE, roofColor: '#5c7650', collide: false, jitter: 0.04 });
    M.boxC(-228, 378, 64, 18, g + 9.2, g + 10.6, { color: '#cdd5d2', style: F.GLASS_SILVER, collide: false });
    M.boxC(-228, 378, 22, 10, g + 4, g + 9.2, { color: '#b5c0c0', style: F.GLASS_SILVER, collide: false });
    // steps toward the harbour
    M.boxC(-228, 338, 48, 16, g - 1.2, g + 0.6, { color: '#9a9891', style: F.PURE, collide: false });

    // IFC1
    var k1 = K(city, F.GLASS_SILVER, '#b8c6cc', 1102);
    var y1 = g, h1 = 105, w1 = 26;
    for (var i = 0; i < 8; i++) {
      var t0 = i / 8, t1 = (i + 1) / 8;
      var ww = U.lerp(w1, w1 - 4, t0);
      k1.boxC(-252, 404, ww, ww, y1 + h1 * t0, y1 + h1 * t1 + 0.02, { style: F.GLASS_SILVER, color: shade('#b8c6cc', 0.94 + i * 0.012), seed: 1102 + i });
    }
    k1.boxC(-252, 404, 20, 20, y1 + h1, y1 + h1 + 3.2, { style: F.GLASS_SILVER, color: '#cdd7da' });
    k1.boxC(-252, 404, 12, 12, y1 + h1 + 3.2, y1 + h1 + 5, { style: F.PURE, color: '#d7dedf' });
    beacons(k1, -252, y1 + h1 + 5, 404, 5);

    // IFC2 — 415m icon
    var k2 = K(city, F.GLASS_SILVER, '#b4c4cb', 1103);
    k2.boxC(cx, cz, 38, 38, g - 1.2, g + 7, { style: F.GLASS_SILVER, color: '#c3ccce', roofColor: '#777f7e' });
    k2.boxC(cx, cz, 34, 34, g + 7, g + 11, { style: F.BANDED, color: '#c7cfd0', roofColor: '#737a79' });
    var y = g + 11, H = 207 - 11, W0 = 30, W1 = 25.5;
    for (var s = 0; s < 12; s++) {
      var a0 = s / 12, a1 = (s + 1) / 12;
      var w2 = U.lerp(W0, W1, a0);
      var yA = y + H * a0, yB = y + H * a1;
      k2.boxC(cx, cz, w2, w2, yA, yB + 0.03, {
        style: F.GLASS_SILVER,
        color: shade('#b4c4cb', 0.93 + (s % 3) * 0.025),
        roofColor: '#7c8484', seed: 1103 + s
      });
      // floor-plate lips and re-entrant corners — Two IFC reads as a notched prism, not a taper
      k2.boxC(cx, cz, w2 + 0.5, w2 + 0.5, yB - 0.22, yB + 0.1, { style: F.PURE, color: '#e7eef0', collide: false, jitter: 0 });
      var notch = Math.max(1.45, w2 * 0.075);
      for (var nc = 0; nc < 4; nc++) {
        var nsx = (nc % 2 === 0 ? -1 : 1), nsz = (nc < 2 ? -1 : 1);
        k2.boxC(cx + nsx * (w2 / 2 - notch * 0.32), cz + nsz * (w2 / 2 - notch * 0.32), notch, notch, yA, yB, {
          style: F.CURTAIN_DARK, color: '#667478', collide: false, jitter: 0
        });
      }
    }
    // skybridge between One IFC and Two IFC
    k2.beam([-252, g + 36, 404], [cx, g + 36, cz], 2.6, 1.5, { color: '#d5e0e2', style: F.GLASS_SILVER, collide: false });
    k2.beam([-252, g + 38.2, 404], [cx, g + 38.2, cz], 2.8, 0.35, { color: '#eef3f4', style: F.PURE, collide: false });
    var top = y + H;
    // crown: the distinctive IFC notched crown
    k2.boxC(cx, cz, 21, 21, top, top + 6, { style: F.GLASS_SILVER, color: '#dbe4e6', roofColor: '#5a6061' });
    k2.boxC(cx, cz, 13, 13, top + 6, top + 9.5, { style: F.PURE, color: '#d8dede', roofColor: '#5a6061' });
    for (var c = 0; c < 4; c++) {
      var sx = (c % 2 === 0 ? -1 : 1) * 7, sz = (c < 2 ? -1 : 1) * 7;
      k2.boxC(cx + sx, cz + sz, 4.6, 4.6, top + 6, top + 13, { style: F.PURE, color: '#eef3f2', collide: false });
    }
    beacons(k2, cx, top + 12, cz, 7);
    k2.boxC(cx, cz, 21.6, 21.6, top + 9.2, top + 10.4, { style: F.LED, color: '#ffffff', glow: 2.6, collide: false });
    for (var lc = 0; lc < 4; lc++) {
      var lx = (lc % 2 === 0 ? -1 : 1) * 10, lz = (lc < 2 ? -1 : 1) * 10;
      k2.boxC(cx + lx, cz + lz, 0.9, 0.9, top + 6, top + 13.5, { style: F.LED, color: '#e8f6ff', glow: 2.2, collide: false });
    }
    // vertical light slots at night
    k2.boxC(cx, cz, 1.6, 1.6, top + 9.5, top + 14, { style: F.LED, color: '#dfe6e4', glow: 1.2, collide: false });
    // harbourfront footbridge from mall
    M.boxC(-228, 338, 64, 4, g + 5, g + 6.2, { style: F.PURE, color: '#cfd4d1', collide: false });
  }

  /* ------------------------------------------------------- Bank of China */
  function buildBOC(world, city) {
    var cx = -28, cz = 408, g = G(world, cx, cz);
    var k = K(city, F.GLASS_BRONZE, '#cfc6ae', 1201);
    var r = 17;
    // podium / plaza
    k.boxC(cx, cz, 46, 46, g - 1.2, g + 5.5, { style: F.GLASS_BRONZE, color: '#b9b3a2', roofColor: '#6c675c' });
    k.boxC(cx, cz, 30, 30, g + 5.5, g + 7, { style: F.STONE, color: '#c7bfae', roofColor: '#8a8374' });
    // four triangular shafts
    var tris = [
      { pts: [[cx, cz], [cx + r, cz - r], [cx + r, cz + r]], h: 184, seed: 1202 }, // east
      { pts: [[cx, cz], [cx - r, cz - r], [cx - r, cz + r]], h: 148, seed: 1203 }, // west
      { pts: [[cx, cz], [cx - r, cz - r], [cx + r, cz - r]], h: 118, seed: 1204 }, // north
      { pts: [[cx, cz], [cx - r, cz + r], [cx + r, cz + r]], h: 92, seed: 1205 }   // south
    ];
    for (var t = 0; t < tris.length; t++) {
      var tr = tris[t];
      var kk = K(city, F.GLASS_BRONZE, '#d3cbb6', tr.seed, 1);
      kk.prism(tr.pts, g + 6, g + tr.h, { style: F.GLASS_BRONZE, color: '#d0c8b3', roofColor: '#6f6a5e' });
      // roof cap
      kk.prism(tr.pts.map(function (p) { return [cx + (p[0] - cx) * 0.82, cz + (p[1] - cz) * 0.82]; }), g + tr.h, g + tr.h + 2.2, { style: F.PURE, color: '#d9d1bf', roofColor: '#5f5a50', collide: false });
      // X bracing on the two outer faces of this shaft
      var facePts = [tr.pts[1], tr.pts[2]];
      var mid = [(facePts[0][0] + facePts[1][0]) / 2, (facePts[0][1] + facePts[1][1]) / 2];
      var nx = mid[0] - cx, nz = mid[1] - cz;
      var nl = Math.sqrt(nx * nx + nz * nz) || 1; nx /= nl; nz /= nl;
      var A = [cx + nx * 0.6, g + 6, cz + nz * 0.6];
      var offx = (facePts[1][0] - facePts[0][0]) / 2, offz = (facePts[1][1] - facePts[0][1]) / 2;
      // stacked diamonds — the diagrid has to read at harbour distance, not as one giant X
      var segN = 5;
      for (var sg = 0; sg < segN; sg++) {
        var yA = g + 8 + (tr.h - 10) * sg / segN;
        var yB = g + 8 + (tr.h - 10) * (sg + 1) / segN;
        kk.brace([A[0] - offx * 0.9, yA, A[2] - offz * 0.9], [A[0] + offx * 0.9, yB, A[2] + offz * 0.9], 1.25, [nx, 0, nz], { color: '#f4efe2', style: F.PURE });
        kk.brace([A[0] + offx * 0.9, yA, A[2] + offz * 0.9], [A[0] - offx * 0.9, yB, A[2] - offz * 0.9], 1.25, [nx, 0, nz], { color: '#f4efe2', style: F.PURE });
        kk.boxC(cx + nx * 0.95, cz + nz * 0.95, Math.abs(offx) * 1.92, 1.05, yA - 0.28, yA + 0.45, { color: '#f7f2e6', style: F.PURE, collide: false });
      }
    }
    // corner columns + masts
    for (var c = 0; c < 4; c++) {
      var sx = (c % 2 === 0 ? -1 : 1) * r, sz = (c < 2 ? -1 : 1) * r;
      k.boxC(cx + sx, cz + sz, 1.2, 1.2, g + 6, g + 30, { style: F.PURE, color: '#ddd7c8', collide: false });
    }
    k.beam([cx + r, g + 184, cz], [cx + r, g + 196, cz], 0.8, 0.8, { color: '#d8d2c4', style: F.PURE, collide: false });
    k.beam([cx - r, g + 148, cz], [cx - r, g + 158, cz], 0.7, 0.7, { color: '#d8d2c4', style: F.PURE, collide: false });
    k.beacon(cx + r, g + 197, cz);
    k.beacon(cx - r, g + 159, cz);
    k.beacon(cx, g + 186, cz);
    // lit crown trusses at night
    for (var bt = 0; bt < 4; bt++) {
      var bx = (bt % 2 === 0 ? -1 : 1) * r, bz = (bt < 2 ? -1 : 1) * r;
      k.boxC(cx + bx, cz + bz, 1.6, 1.6, g + 30, g + 32, { style: F.LED, color: '#fff4d8', glow: 2.0, collide: false });
    }
    // plaza edge
    k.boxC(cx, cz, 52, 2, g - 1, g + 0.5, { color: '#999488', style: F.PURE, collide: false });
  }

  /* ---------------------------------------------------------- HSBC main */
  function buildHSBC(world, city) {
    var cx = -120, cz = 424, g = G(world, cx, cz);
    var k = K(city, F.METAL, '#5c6264', 1301);
    // podium and public plaza
    k.boxC(cx, cz, 52, 38, g - 1.2, g + 4.5, { style: F.STONE, color: '#a5a29a', roofColor: '#6a6862' });
    k.boxC(cx, cz, 50, 36, g + 4.5, g + 6.5, { style: F.METAL, color: '#767c7e', roofColor: '#565b5d' });
    var xs = [-14, 0, 14], hs = [72, 92, 76], ws = [12, 16, 12];
    for (var t = 0; t < 3; t++) {
      var kk = K(city, F.CURTAIN_DARK, '#7e8a8e', 1302 + t);
      kk.boxC(cx + xs[t], cz, ws[t], 26, g + 6.5, g + 6.5 + hs[t], { style: F.CURTAIN_DARK, color: '#7e8a8e', roofColor: '#4a5052' });
      // exposed structural frame: columns + X braces on south face
      for (var s = -1; s <= 1; s += 2) {
        kk.boxC(cx + xs[t] + s * (ws[t] / 2), cz + 12.2, 1.7, 1.7, g + 6.5, g + 6.5 + hs[t], { color: '#d2d6d6', style: F.PURE, collide: false });
        kk.boxC(cx + xs[t] + s * (ws[t] / 2), cz - 12.2, 0.9, 0.9, g + 6.5, g + 6.5 + hs[t], { color: '#c9cdce', style: F.PURE, collide: false });
      }
      kk.brace([cx + xs[t] - ws[t] / 2, g + 8, cz + 13.1], [cx + xs[t] + ws[t] / 2, g + hs[t] * 0.9, cz + 13.1], 1.5, [0, 0, 1], { color: '#e2e6e4', style: F.PURE });
      kk.brace([cx + xs[t] + ws[t] / 2, g + 8, cz + 13.1], [cx + xs[t] - ws[t] / 2, g + hs[t] * 0.9, cz + 13.1], 1.5, [0, 0, 1], { color: '#e2e6e4', style: F.PURE });
      // rooftop
      kk.boxC(cx + xs[t], cz, ws[t] - 1, 25, g + 6.5 + hs[t], g + 6.5 + hs[t] + 2, { style: F.METAL, color: '#8d9394', roofColor: '#555a5c' });
    }
    // suspension / truss bridges between the towers
    for (var b = 0; b < 3; b++) {
      k.beam([cx - 20, g + 30 + b * 20, cz + 13], [cx + 20, g + 30 + b * 20, cz + 13], 1.4, 1.0, { color: '#b9bfc0', style: F.PURE, collide: false });
    }
    // stacked harbour trusses — the HSBC elevation is a Meccano frame
    for (var tb = 0; tb < 5; tb++) {
      var ty = g + 16 + tb * 15;
      k.beam([cx - 22, ty, cz + 13.5], [cx + 22, ty, cz + 13.5], 1.2, 1.45, { color: '#e7ebe9', style: F.PURE, collide: false });
      k.beam([cx - 22, ty + 3.4, cz + 13.3], [cx + 22, ty, cz + 13.3], 0.65, 0.65, { color: '#d5dbda', style: F.PURE, collide: false });
    }
    k.boxC(cx - 16.5, cz + 13.8, 1.25, 1.25, g + 6.5, g + 100, { color: '#f2f4f3', style: F.PURE, collide: false });
    k.boxC(cx + 16.5, cz + 13.8, 1.25, 1.25, g + 6.5, g + 104, { color: '#f2f4f3', style: F.PURE, collide: false });
    k.beacon(cx - 14, g + 6.5 + 72 + 4, cz);
    k.beacon(cx, g + 6.5 + 92 + 4, cz);
    k.beacon(cx + 14, g + 6.5 + 76 + 4, cz);
    // HSBC lions plaza hint / steps
    k.boxC(cx, cz + 20, 30, 6, g - 1, g + 0.4, { color: '#a7a399', style: F.PURE, collide: false });
  }

  /* ------------------------------------------------------ Cheung Kong */
  function buildCheungKong(world, city) {
    var cx = -68, cz = 431, g = G(world, cx, cz);
    var k = K(city, F.GLASS_SILVER, '#c9d3d6', 1401);
    k.boxC(cx, cz, 32, 32, g - 1.2, g + 7, { style: F.BANDED, color: '#b6c0c2', roofColor: '#6d7373' });
    k.boxC(cx, cz, 26, 26, g + 7, g + 142, { style: F.GLASS_SILVER, color: '#c9d3d6', roofColor: '#6f7677' });
    // vertical glass fins — the CK signature
    for (var f = 0; f < 4; f++) {
      var side = f % 2 === 0, sign = f < 2 ? -1 : 1;
      for (var i = 0; i < 13; i++) {
        var off = -12 + i * 2;
        var x = cx + (side ? off : sign * 13.4);
        var z = cz + (side ? sign * 13.4 : off);
        k.boxC(x, z, side ? 0.5 : 0.8, side ? 0.8 : 0.5, g + 9, g + 141, { style: F.PURE, color: '#e2e7e6', collide: false });
      }
    }
    k.boxC(cx, cz, 20, 20, g + 142, g + 147, { style: F.GLASS_SILVER, color: '#d6dcdc' });
    k.boxC(cx, cz, 8, 8, g + 147, g + 152, { style: F.PURE, color: '#c3c9c8' });
    beacons(k, cx, g + 152, cz, 6);
  }

  /* -------------------------------------------------------- Jardine House */
  function buildJardine(world, city) {
    var cx = -222, cz = 442, g = G(world, cx, cz);
    var k = K(city, F.PORTHOLE, '#d4d7d2', 1501);
    k.boxC(cx, cz, 34, 32, g - 1.2, g + 6, { style: F.BANDED, color: '#b9bdb8', roofColor: '#73776f' });
    k.boxC(cx, cz, 27, 24, g + 6, g + 90, { style: F.PORTHOLE, color: '#d4d7d2', roofColor: '#8c908a' });
    k.boxC(cx, cz, 23, 20, g + 90, g + 94, { style: F.PURE, color: '#c9ccc6' });
    k.spire(cx, cz, 0.4, g + 94, g + 108, { color: '#c9ccc6', style: F.PURE, collide: false });
    k.beacon(cx, g + 108, cz);
    // podium canopy
    k.boxC(cx, cz, 38, 2, g + 5, g + 5.7, { color: '#c3c6c0', style: F.PURE, collide: false });
  }

  /* ----------------------------------------------------------- The Center */
  function buildTheCenter(world, city) {
    var cx = -318, cz = 424, g = G(world, cx, cz);
    var k = K(city, F.CURTAIN_DARK, '#43505a', 1601);
    k.boxC(cx, cz, 36, 36, g - 1.2, g + 8, { style: F.BANDED, color: '#7b858a', roofColor: '#4d5457' });
    k.boxC(cx, cz, 28, 28, g + 8, g + 173, { style: F.CURTAIN_DARK, color: '#48555f', roofColor: '#3d444a' });
    // neon vertical edges
    for (var c = 0; c < 4; c++) {
      var sx = (c % 2 === 0 ? -1 : 1) * 14.2, sz = (c < 2 ? -1 : 1) * 14.2;
      k.boxC(cx + sx, cz + sz, 0.7, 0.7, g + 10, g + 171, { style: F.LED, color: '#66e6ff', glow: 2.0, collide: false });
    }
    // neon crown bands
    for (var i = 0; i < 3; i++) {
      k.boxC(cx, cz, 28.6, 28.6, g + 168 + i * 3.2, g + 169.4 + i * 3.2, { style: F.LED, color: i === 1 ? '#ff7bd5' : '#6ce7ff', glow: 2.2, collide: false });
    }
    k.boxC(cx, cz, 22, 22, g + 176, g + 179, { style: F.PURE, color: '#3b4247', roofColor: '#3b4247' });
    k.boxC(cx, cz, 27, 27, g + 175, g + 176.2, { style: F.LED, color: '#ff7bd5', glow: 2.6, collide: false });
    k.spire(cx, cz, 0.5, g + 179, g + 190, { color: '#9ea7ab', style: F.PURE, collide: false });
    k.beacon(cx, g + 190, cz);
    // pink lit crown ring for night
    k.boxC(cx, cz, 26, 26, g + 173, g + 175, { style: F.LED, color: '#ff7bd5', glow: 1.8, collide: false });
  }

  /* ------------------------------------------------------ Exchange Square */
  function buildExchange(world, city) {
    var g = G(world, -190, 430);
    var k = K(city, F.GLASS_SILVER, '#b7c6cb', 1701);
    k.boxC(-190, 430, 44, 30, g - 1.2, g + 8, { style: F.BANDED, color: '#b9c4c5', roofColor: '#6b7372' });
    k.boxC(-202, 436, 16, 22, g + 8, g + 95, { style: F.GLASS_SILVER, color: '#b7c6cb', roofColor: '#6d7576' });
    k.boxC(-178, 436, 16, 22, g + 8, g + 88, { style: F.GLASS_SILVER, color: '#aec0c5', roofColor: '#6d7576' });
    k.boxC(-190, 414, 18, 18, g + 8, g + 74, { style: F.GLASS_SILVER, color: '#c1cdd0', roofColor: '#6d7576' });
    k.boxC(-202, 436, 14, 20, g + 95, g + 98, { style: F.PURE, color: '#cbd4d4', roofColor: '#5c6363' });
    k.boxC(-178, 436, 14, 20, g + 88, g + 91, { style: F.PURE, color: '#cbd4d4', roofColor: '#5c6363' });
    k.beacon(-202, g + 98, 436); k.beacon(-178, g + 91, 436);
  }

  /* --------------------------------------------------- civic Central */
  function buildCivic(world, city) {
    var g = G(world, -152, 338);
    // City Hall
    var k = K(city, F.BANDED, '#d7d4ca', 1801);
    k.boxC(-152, 340, 40, 22, g - 1.2, g + 7, { style: F.STONE, color: '#cfc9bc', roofColor: '#8b857a' });
    k.boxC(-152, 340, 42, 24, g + 7, g + 8.2, { style: F.PURE, color: '#e0ddd3', roofColor: '#a7a296' });
    k.boxC(-152, 333, 24, 6, g + 4.2, g + 5.4, { style: F.PURE, color: '#e5e2d9', collide: false });
    // Cenotaph
    var c = K(city, F.STONE, '#cfc9bb', 1802);
    c.boxC(-162, 372, 13, 9, g - 1.2, g + 1, { style: F.STONE, color: '#c6c0b2', roofColor: '#a09a8c' });
    c.boxC(-162, 372, 7, 7, g + 1, g + 7.5, { style: F.STONE, color: '#d2ccbe', roofColor: '#b1ab9d' });
    c.boxC(-162, 372, 8.5, 8.5, g + 7.5, g + 8.2, { style: F.PURE, color: '#dbd5c7' });
    // LegCo
    var l = K(city, F.STONE, '#d3cec2', 1803);
    l.boxC(-132, 380, 28, 20, g - 1.2, g + 9, { style: F.STONE, color: '#d0cabd', roofColor: '#8b857a' });
    l.boxC(-132, 380, 24, 16, g + 9, g + 12, { style: F.PURE, color: '#d9d4c8', roofColor: '#a39d90' });
    for (var i = 0; i < 6; i++) {
      l.boxC(-142 + i * 4, 371, 1, 1.4, g, g + 8, { color: '#e0dbcf', style: F.PURE, collide: false });
    }
    // Statue Square fountain
    var f = K(city, F.PURE, '#a9a69c', 1804);
    f.cyl(-160, 370, 5, g - 1, g + 1.1, 14, { color: '#9d9a91', style: F.PURE });
    f.cyl(-160, 370, 2.2, g + 1.1, g + 2.4, 10, { color: '#b9c7c9', style: F.PURE, collide: false });
  }

  /* ------------------------------------------------------------- Lippo */
  function buildLippo(world, city) {
    var g = G(world, 70, 455);
    var k = K(city, F.GLASS_BRONZE, '#8c8a78', 1901);
    k.boxC(70, 455, 36, 40, g - 1.2, g + 8, { style: F.BANDED, color: '#a09d8b', roofColor: '#6c695c' });
    // two towers with the "koala" pods
    var towers = [{ x: 60, z: 446, h: 94, w: 18 }, { x: 80, z: 466, h: 88, w: 16 }];
    for (var t = 0; t < 2; t++) {
      var tt = towers[t];
      var kk = K(city, F.GLASS_BRONZE, '#8f8d7b', 1902 + t);
      kk.boxC(tt.x, tt.z, tt.w, tt.w + 6, g + 8, g + 8 + tt.h, { style: F.GLASS_BRONZE, color: '#8f8d7b', roofColor: '#5f5d52' });
      for (var p = 0; p < 3; p++) {
        var py = g + 8 + tt.h * (0.45 + p * 0.16);
        kk.boxC(tt.x - tt.w / 2 - 1.6, tt.z, 3.4, 7, py, py + 5, { style: F.GLASS_BRONZE, color: '#a3a18d', collide: false });
        kk.boxC(tt.x + tt.w / 2 + 1.6, tt.z, 3.4, 7, py + 2, py + 7, { style: F.GLASS_BRONZE, color: '#a3a18d', collide: false });
      }
      kk.boxC(tt.x, tt.z, tt.w - 2, tt.w + 4, g + 8 + tt.h, g + 10 + tt.h, { style: F.PURE, color: '#b4b2a0', roofColor: '#5c5a4f' });
      k.beacon(tt.x, g + 10 + tt.h, tt.z);
    }
  }

  /* ------------------------------------------------------ Pacific Place */
  function buildPacific(world, city) {
    var g = G(world, 52, 505);
    var k = K(city, F.GLASS_SILVER, '#b3c3c8', 2001);
    k.boxC(52, 505, 44, 50, g - 1.2, g + 10, { style: F.GLASS_SILVER, color: '#c0cdd0', roofColor: '#737b7b' });
    var towers = [[42, 512, 16, 18, 115], [62, 516, 14, 16, 102], [52, 494, 15, 14, 88]];
    for (var t = 0; t < towers.length; t++) {
      var tw = towers[t];
      var kk = K(city, F.GLASS_SILVER, '#b3c3c8', 2002 + t);
      kk.boxC(tw[0], tw[1], tw[2], tw[3], g + 10, g + 10 + tw[4], { style: F.GLASS_SILVER, color: '#b3c3c8', roofColor: '#6f7777' });
      kk.boxC(tw[0], tw[1], tw[2] - 2, tw[3] - 2, g + 10 + tw[4], g + 12 + tw[4], { style: F.PURE, color: '#cdd5d5', roofColor: '#5f6767' });
    }
    k.beacon(42, g + 129, 512);
  }

  /* --------------------------------------------------------------- Tamar */
  function buildTamar(world, city) {
    var g = G(world, 168, 388);
    var k = K(city, F.GLASS_SILVER, '#a8bcc4', 2101);
    k.boxC(168, 388, 50, 36, g - 1.2, g + 8, { style: F.BANDED, color: '#b2bfc2', roofColor: '#6d7474' });
    k.boxC(154, 388, 16, 26, g + 8, g + 62, { style: F.GLASS_SILVER, color: '#a8bcc4', roofColor: '#6a7375' });
    k.boxC(182, 388, 16, 26, g + 8, g + 62, { style: F.GLASS_SILVER, color: '#a8bcc4', roofColor: '#6a7375' });
    k.boxC(168, 388, 14, 26, g + 50, g + 58, { style: F.GLASS_SILVER, color: '#b9c8cc', roofColor: '#6a7375' });
    k.boxC(154, 388, 14, 24, g + 62, g + 65, { style: F.PURE, color: '#c6d0d1' });
    k.boxC(182, 388, 14, 24, g + 62, g + 65, { style: F.PURE, color: '#c6d0d1' });
    k.boxC(168, 388, 44, 2, g + 4, g + 5, { color: '#c9d1d0', style: F.PURE, collide: false });
    // lawn apron
    k.boxC(168, 366, 56, 16, g - 1.2, g + 0.3, { color: '#5b7a4e', style: F.PURE, collide: false, jitter: 0.04 });
    k.beacon(154, g + 65, 388); k.beacon(182, g + 65, 388);
  }

  /* ------------------------------------------------------ Central piers */
  function buildCentralPiers(world, city) {
    var deckY = 2.4;
    var k = K(city, F.PURE, '#c9c2b1', 2201);
    // main deck over the water
    k.boxC(-178, 282, 96, 38, deckY - 1.2, deckY, { color: '#b9b09b', style: F.PURE, roofColor: '#8e8675', collide: true, jitter: 0.03 });
    k.boxC(-178, 282, 96, 3, deckY - 1.2, deckY - 0.4, { color: '#7b7364', style: F.PURE, collide: false });
    for (var i = 0; i < 4; i++) {
      var px = -226 + i * 32;
      var pk = K(city, F.PURE, '#e3e0d4', 2202 + i);
      // pier pavilion: green skirt, white roof
      pk.boxC(px, 282, 18, 22, deckY, deckY + 5.5, { style: F.PURE, color: '#e6e1d3', roofColor: '#5d7a62' });
      pk.boxC(px, 282, 20, 24, deckY + 5.5, deckY + 6.4, { style: F.PURE, color: '#5d7a62', roofColor: '#46604c' });
      pk.boxC(px, 282, 18.5, 22.5, deckY + 6.4, deckY + 7.1, { style: F.PURE, color: '#ece8db', roofColor: '#c9c4b5' });
      pk.boxC(px, 294, 8, 10, deckY, deckY + 0.2, { color: '#b1a992', style: F.PURE, collide: false });
      // gangway toward land
      pk.boxC(px, 300, 6, 14, deckY - 0.1, deckY + 0.2, { color: '#a79f8c', style: F.PURE, collide: false });
      // flag pole
      pk.spire(px - 7, 272, 0.12, deckY, deckY + 8, { color: '#d9d5c8', style: F.PURE, collide: false });
    }
    // footbridge to IFC mall (over Connaught Road)
    var M = K(city, F.PURE, '#c9cfcd', 2203);
    M.boxC(-250, 346, 12, 34, 7.2, 8.6, { style: F.PURE, color: '#c4cbca', collide: false });
    M.boxC(-250, 346, 0.8, 34, 5.8, 7.2, { color: '#aeb5b3', style: F.PURE, collide: false });
    M.boxC(-250, 333, 10, 3, 7.2, 8.6, { color: '#bcc4c1', style: F.PURE, collide: false });
  }

  /* ------------------------------------------------------ Observation Wheel */
  function buildWheel(world, city) {
    var cx = -34, cz = 318, g = G(world, cx, cz);
    var y = g + 26; // hub height
    var k = K(city, F.PURE, '#d9dbd4', 2301);
    // support A-frame
    k.beam([cx - 13, g, cz], [cx, y, cz], 1.1, 1.1, { color: '#c9ccc6', style: F.PURE, collide: false });
    k.beam([cx + 13, g, cz], [cx, y, cz], 1.1, 1.1, { color: '#c9ccc6', style: F.PURE, collide: false });
    k.beam([cx, g, cz - 10], [cx, y, cz], 0.9, 0.9, { color: '#c9ccc6', style: F.PURE, collide: false });
    k.beam([cx, g, cz + 10], [cx, y, cz], 0.9, 0.9, { color: '#c9ccc6', style: F.PURE, collide: false });
    var R = 16, N = 20;
    for (var i = 0; i < N; i++) {
      var a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
      var p0 = [cx + Math.cos(a0) * R, y + Math.sin(a0) * R, cz];
      var p1 = [cx + Math.cos(a1) * R, y + Math.sin(a1) * R, cz];
      k.beam(p0, p1, 0.55, 0.55, { color: '#e4e5df', style: F.PURE, collide: false });
      k.beam([cx, y, cz], [cx + Math.cos(a0) * R, y + Math.sin(a0) * R, cz], 0.18, 0.18, { color: '#ced2cd', style: F.PURE, collide: false });
      if (i % 2 === 0) {
        var cab = [cx + Math.cos(a0) * R, y + Math.sin(a0) * R, cz];
        k.boxC(cab[0], cab[2], 2.2, 2.6, cab[1] - 1.2, cab[1] + 1.2, { color: i % 4 === 0 ? '#c94e69' : '#4e7fc9', style: F.PURE, collide: false });
      }
    }
    k.cyl(cx, cz, 1.4, y - 1.2, y + 1.2, 12, { color: '#b9bdb8', style: F.PURE, collide: false });
    // boarding platform
    k.boxC(cx, cz + 8, 16, 10, g - 1, g + 1.2, { color: '#a8a79e', style: F.PURE, collide: true });
  }

  /* ------------------------------------------------------------ HKCEC */
  function buildHKCEC(world, city) {
    var cx = 246, cz = 322, g = G(world, 238, 320);
    var k = K(city, F.METAL, '#9aa3a4', 2401);
    // podium on reclaimed land
    k.boxC(cx, cz, 92, 56, g - 1.5, g + 7, { style: F.BANDED, color: '#aab2b1', roofColor: '#747b7a' });
    k.boxC(cx, cz + 6, 92, 40, g + 7, g + 13, { style: F.GLASS_SILVER, color: '#b8c7c8', roofColor: '#6f7776' });
    // sweeping bird-wing roof (stepped arc)
    var segs = 13, span = 92;
    for (var i = 0; i < segs; i++) {
      var t = i / (segs - 1);
      var x = cx - span / 2 + (i + 0.5) * span / segs;
      var arc = Math.sin(t * Math.PI);
      var hh = 7 + Math.pow(arc, 0.7) * 10;
      k.boxC(x, cz, span / segs + 0.2, 46, g + 10, g + 10 + hh, {
        color: i % 2 === 0 ? '#c3cac7' : '#b7bfbc',
        style: F.PURE, roofColor: '#8d9692', collide: false
      });
    }
    // glazed north face columns
    for (var c = 0; c < 9; c++) {
      k.boxC(cx - 40 + c * 10, cz - 22, 1.2, 1.2, g, g + 24, { color: '#d3d8d4', style: F.PURE, collide: false });
    }
    // luminous white roof ridges visible from across the harbour
    for (var rr = 0; rr < 5; rr++) {
      var t2 = rr / 4, rx2 = cx - span / 2 + (rr + 0.5) * span / 5;
      var rh2 = 7 + Math.pow(Math.sin(t2 * Math.PI), 0.7) * 10;
      k.boxC(rx2, cz, span / 5 - 1, 47, g + 10 + rh2, g + 10 + rh2 + 0.5, { color: '#f0f4f2', style: F.PURE, collide: false });
    }
    // signature roof fins
    for (var f = 0; f < 5; f++) {
      k.boxC(cx - 30 + f * 15, cz + 20, 1.2, 27, g + 12, g + 12 + 5 + f * 0.6, { color: '#d7dad5', style: F.PURE, collide: false });
    }
    // Golden Bauhinia Square
    var b = K(city, F.PURE, '#c9a33c', 2402);
    b.cyl(236, 314, 7, g - 1.2, g + 1.8, 18, { color: '#b9b4a7', style: F.STONE, collide: true });
    b.cyl(236, 314, 4.2, g + 1.8, g + 3.2, 12, { color: '#8f8b80', style: F.PURE, collide: false });
    for (var p = 0; p < 5; p++) {
      var ang = p / 5 * Math.PI * 2;
      b.beam([236, g + 3.4, 314], [236 + Math.cos(ang) * 5.2, g + 8.6, 314 + Math.sin(ang) * 5.2], 1.5, 0.5, { color: '#d9b13f', style: F.PURE, collide: false });
      b.beam([236 + Math.cos(ang) * 2.6, g + 9.5, 314 + Math.sin(ang) * 2.6], [236 + Math.cos(ang) * 6.2, g + 10.3, 314 + Math.sin(ang) * 6.2], 1.0, 0.4, { color: '#e8c45a', style: F.PURE, collide: false });
    }
    b.cyl(236, 314, 1.2, g + 8.6, g + 10.6, 8, { color: '#f0d070', style: F.PURE, collide: false });
    // flag poles
    for (var fp = 0; fp < 3; fp++) {
      b.spire(228 + fp * 5, 306, 0.12, g, g + 9, { color: '#d6d3c8', style: F.PURE, collide: false });
      b.boxC(228 + fp * 5, 306, 0.15, 3.2, g + 6.2, g + 8.6, { color: '#b5382f', style: F.PURE, collide: false });
    }
  }

  /* -------------------------------------------------------- Central Plaza */
  function buildCentralPlaza(world, city) {
    var cx = 300, cz = 392, g = G(world, cx, cz);
    var pts = [];
    for (var i = 0; i < 3; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 3;
      pts.push([cx + Math.cos(a) * 19, cz + Math.sin(a) * 19]);
    }
    var k = K(city, F.GLASS_TEAL, '#b9a76a', 2501);
    k.boxC(cx, cz, 46, 42, g - 1.2, g + 7, { style: F.BANDED, color: '#b0b3a4', roofColor: '#71746a' });
    k.prism(pts, g + 7, g + 171, { style: F.GLASS_TEAL, color: '#b9a76a', roofColor: '#6d6650' });
    var pts2 = pts.map(function (p) { return [cx + (p[0] - cx) * 0.86, cz + (p[1] - cz) * 0.86]; });
    k.prism(pts2, g + 171, g + 180, { style: F.GLASS_TEAL, color: '#c4b276', roofColor: '#6d6650' });
    // gold ribs on corners
    for (var c = 0; c < 3; c++) {
      k.boxC(pts[c][0], pts[c][1], 2.0, 2.0, g + 7, g + 182, { color: '#e2c97d', style: F.PURE, collide: false });
    }
    // pyramid crown + mast
    k.prism(pts.map(function (p) { return [cx + (p[0] - cx) * 0.6, cz + (p[1] - cz) * 0.6]; }), g + 180, g + 186, { style: F.PURE, color: '#d6c285', roofColor: '#a8975d' });
    k.spire(cx, cz, 1.4, g + 186, g + 200, { color: '#c9b77c', style: F.PURE, collide: false });
    k.beacon(cx, g + 200, cz);
    k.beacon(pts[0][0], g + 180, pts[0][1]);
    k.beacon(pts[1][0], g + 180, pts[1][1]);
    for (var gp = 0; gp < 3; gp++) {
      k.box(cx + (pts[gp][0] - cx) * 0.75 - 0.9, cz + (pts[gp][1] - cz) * 0.75 - 0.9, cx + (pts[gp][0] - cx) * 0.75 + 0.9, cz + (pts[gp][1] - cz) * 0.75 + 0.9, g + 182, g + 184, { style: F.LED, color: '#ffd98a', glow: 2.4, collide: false });
    }
  }

  /* ------------------------------------------------------- Hopewell Centre */
  function buildHopewell(world, city) {
    var cx = 322, cz = 452, g = G(world, cx, cz);
    var k = K(city, F.GLASS_SILVER, '#c0c8c5', 2601);
    k.boxC(cx, cz, 42, 40, g - 1.2, g + 8, { style: F.BANDED, color: '#b4bab2', roofColor: '#6f746c' });
    k.cyl(cx, cz, 14, g + 8, g + 96, 24, { style: F.GLASS_SILVER, color: '#c0c8c5', roofColor: '#777d78' });
    k.cyl(cx, cz, 18, g + 96, g + 103, 24, { style: F.CURTAIN_DARK, color: '#87908c', roofColor: '#656b67' });
    k.cyl(cx, cz, 15, g + 103, g + 107, 20, { style: F.PURE, color: '#ccd2cc', roofColor: '#7b817a' });
    k.cyl(cx, cz, 2, g + 107, g + 118, 8, { color: '#b9c0ba', style: F.PURE, collide: false });
    k.beacon(cx, g + 118, cz);
  }

  /* ------------------------------------------------------ Wan Chai pier */
  function buildWanChaiPier(world, city) {
    var deckY = 2.6, cx = 250, cz = 286;
    var k = K(city, F.PURE, '#e0ddd0', 2701);
    k.boxC(cx, cz, 46, 44, deckY - 1.2, deckY, { color: '#b3aa96', style: F.PURE, collide: true });
    k.boxC(cx, cz, 26, 26, deckY, deckY + 6, { style: F.PURE, color: '#e4e1d4', roofColor: '#5d7a62' });
    k.boxC(cx, cz, 28, 28, deckY + 6, deckY + 7, { color: '#5d7a62', style: F.PURE, roofColor: '#46604c' });
    k.boxC(cx, cz, 24, 24, deckY + 7, deckY + 8, { color: '#ece8db', style: F.PURE, roofColor: '#c5c0b0' });
    k.boxC(cx, cz + 20, 8, 10, deckY - 0.1, deckY + 0.2, { color: '#a9a08c', style: F.PURE, collide: false });
    for (var i = 0; i < 4; i++) k.spire(cx - 12 + i * 8, cz - 14, 0.12, deckY, deckY + 8.5, { color: '#d9d5c8', style: F.PURE, collide: false });
  }

  /* ------------------------------------------------------------ Times Sq */
  function buildTimesSquare(world, city) {
    var cx = 760, cz = 500, g = G(world, cx, cz);
    var k = K(city, F.GLASS_SILVER, '#b6c5ca', 2801);
    k.boxC(cx, cz, 46, 42, g - 1.2, g + 14, { style: F.BANDED, color: '#aeb6b5', roofColor: '#6b7271' });
    k.boxC(cx, cz, 26, 26, g + 14, g + 97, { style: F.GLASS_SILVER, color: '#b6c5ca', roofColor: '#6f7777' });
    // giant LED screen on the podium
    k.boxC(cx, cz - 21.5, 26, 0.7, g + 6, g + 13, { style: F.LED, color: '#88d8ff', glow: 2.0, collide: false });
    k.boxC(cx + 23.5, cz, 0.7, 22, g + 5, g + 12, { style: F.LED, color: '#ff8ad8', glow: 2.0, collide: false });
    k.boxC(cx, cz, 24, 24, g + 97, g + 100, { style: F.PURE, color: '#ccd4d4', roofColor: '#5e6666' });
    k.beacon(cx, g + 100, cz);
  }

  /* ------------------------------------------------- One Island East */
  function buildOneIslandEast(world, city) {
    var cx = 1092, cz = 418, g = G(world, cx, cz);
    var k = K(city, F.GLASS_TEAL, '#a9c0c2', 2901);
    k.boxC(cx, cz, 38, 34, g - 1.2, g + 10, { style: F.BANDED, color: '#aebcbc', roofColor: '#6b7372' });
    for (var i = 0; i < 9; i++) {
      var t = i / 9;
      var w = U.lerp(28, 22, t);
      k.boxC(cx, cz, w, w - 2, g + 10 + 149 * t, g + 10 + 149 * (i + 1) / 9 + 0.02, { style: F.GLASS_TEAL, color: shade('#a9c0c2', 0.93 + (i % 3) * 0.03) });
    }
    k.boxC(cx, cz, 21, 19, g + 159, g + 162, { style: F.GLASS_TEAL, color: '#b9cdcd', roofColor: '#6b7372' });
    k.boxC(cx, cz, 15, 13, g + 162, g + 164, { style: F.PURE, color: '#c8d6d4', roofColor: '#6b7372' });
    k.beacon(cx, g + 164, cz);
  }

  /* ----------------------------------------------------- Monster Building */
  function buildMonster(world, city) {
    var cx = 1070, cz = 470, g = G(world, cx, cz);
    var cols = ['#c9a58c', '#b7a6b8', '#a8b8a6'];
    // three slabs forming the E, plus a back block
    var k = K(city, F.RESI_OLD, '#c9a58c', 3001);
    k.boxC(cx, cz + 10, 42, 12, g - 1.2, g + 58, { style: F.RESI_OLD, color: '#b8ad9d', roofColor: '#6e685e' });
    for (var s = 0; s < 3; s++) {
      var kk = K(city, F.RESI_OLD, cols[s], 3002 + s);
      kk.boxC(cx - 14 + s * 14, cz - 4, 10, 24, g - 1.2, g + 58, { style: F.RESI_OLD, color: cols[s], roofColor: '#6e685e' });
      // AC boxes / balconies grid
      for (var f = 0; f < 8; f++) for (var c = 0; c < 4; c++) {
        kk.boxC(cx - 14 + s * 14 - 3.4 + c * 2.3, cz - 16.2, 0.9, 0.7, g + 5 + f * 6.3, g + 6.1 + f * 6.3, { color: '#5d6060', style: F.PURE, collide: false, jitter: 0 });
      }
      kk.boxC(cx - 14 + s * 14, cz - 4, 10.4, 24.4, g + 58, g + 60, { style: F.PURE, color: '#8c887e', roofColor: '#6b665d' });
    }
    k.roofClutter(cx - 14, cz + 8, 30, 8, g + 58, 3009);
    k.roofClutter(cx + 14, cz + 8, 30, 8, g + 58, 3010);
    // dense signage requests
    for (var i = 0; i < 5; i++) {
      k.sign({ x: cx - 20 + i * 10, z: cz - 16.5, y: g + 18 + i * 6, w: 6, h: 10, rotY: 0, palette: i });
    }
  }

  /* --------------------------------------------------------- Peak Tower */
  function buildPeakTower(world, city) {
    var cx = -282, cz = 688, g = G(world, cx, cz, 240);
    var k = K(city, F.PURE, '#e3e3dc', 3101);
    // lower station terraces
    k.boxC(cx, cz + 12, 34, 30, g - 1.5, g + 7, { style: F.STONE, color: '#c9c5b9', roofColor: '#8d897e' });
    // neck, then the anvil / wok disc — the Peak Tower silhouette from the harbour
    var base = g + 7;
    k.cyl(cx, cz, 8.2, base, base + 7.2, 18, { style: F.PURE, color: '#d7d8d2', roofColor: '#8e908a' });
    k.cyl(cx, cz, 11.5, base + 7.2, base + 8.8, 20, { style: F.PURE, color: '#e4e4dc', collide: false });
    k.cyl(cx, cz, 17, base + 8.8, base + 10.2, 22, { style: F.PURE, color: '#ecece4', collide: false });
    k.cyl(cx, cz, 23, base + 10.2, base + 12.0, 26, { style: F.GLASS_SILVER, color: '#b7c4c8', collide: false });
    k.cyl(cx, cz, 27.2, base + 12.0, base + 16.6, 28, { style: F.GLASS_SILVER, color: '#c9d4d6', roofColor: '#6a7274' });
    k.cyl(cx, cz, 28.0, base + 16.2, base + 17.3, 28, { style: F.LED, color: '#eaf6ff', glow: 2.3, collide: false });
    k.cyl(cx, cz, 24.5, base + 17.3, base + 18.8, 24, { style: F.PURE, color: '#f3f3eb', roofColor: '#b0b0a6', collide: false });
    k.spire(cx, cz, 0.42, base + 18.8, base + 30, { color: '#e4e6e0', style: F.PURE, collide: false });
    k.beacon(cx, base + 30, cz);
    // viewing platform rails around the disc
    for (var i = 0; i < 24; i++) {
      var ang = i / 24 * Math.PI * 2;
      k.boxC(cx + Math.cos(ang) * 27.4, cz + Math.sin(ang) * 27.4, 0.32, 0.32, base + 16.6, base + 18.2, { color: '#d5d8d2', style: F.PURE, collide: false });
    }
    // Peak Tram upper terminus
    k.boxC(cx + 20, cz + 20, 18, 22, g - 1.4, g + 9, { style: F.PURE, color: '#d8d4c8', roofColor: '#6f6b60' });
    k.boxC(cx + 20, cz + 20, 20, 24, g + 9, g + 10.2, { color: '#5a6f58', style: F.PURE, roofColor: '#475b46' });
  }

  /* --------------------------------------------------- Peak Tram lower */
  function buildPeakTramLower(world, city) {
    var g = G(world, -150, 330);
    var k = K(city, F.PURE, '#d9d5c8', 3201);
    k.boxC(-150, 330, 18, 14, g - 1.2, g + 6, { style: F.PURE, color: '#d9d5c8', roofColor: '#6c7364' });
    k.boxC(-150, 330, 20, 16, g + 6, g + 7.2, { color: '#5f705c', style: F.PURE, roofColor: '#475b46' });
    k.boxC(-150, 322, 6, 10, g + 0.2, g + 0.4, { color: '#8c8474', style: F.PURE, collide: false });
    k.spire(-157, 326, 0.1, g, g + 7, { color: '#d5d1c4', style: F.PURE, collide: false });
  }

  /* ------------------------------------------------------------- build */
  HK.LandmarksHK = {
    build: function (world, layout) {
      var city = world.city;
      var list = [
        buildIFC, buildBOC, buildHSBC, buildCheungKong, buildJardine, buildTheCenter,
        buildExchange, buildCivic, buildLippo, buildPacific, buildTamar,
        buildCentralPiers, buildWheel, buildHKCEC, buildCentralPlaza, buildHopewell,
        buildWanChaiPier, buildTimesSquare, buildOneIslandEast, buildMonster,
        buildPeakTower, buildPeakTramLower
      ];
      for (var i = 0; i < list.length; i++) {
        try { list[i](world, city); } catch (e) { console.error('landmark HK failed', i, e); }
      }
      HK.log('landmarks HK: built', list.length, 'quads total', city.stats.quads);
      return { count: list.length };
    }
  };
})();
