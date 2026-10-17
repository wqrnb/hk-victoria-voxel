/* ============================================================================
 * HK VOXEL HARBOUR — KOWLOON LANDMARKS (kowloon teammate)
 * Hand-crafted landmarks of the Kowloon shore: West Kowloon Cultural District,
 * Tsim Sha Tsui waterfront & streets, Hung Hom and Kai Tak.
 * All geometry goes through HK.Kit into world.city (merged facade material).
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util, L = HK.Layout, F = HK.FACADE;

  /* ================================================================ helpers */

  function kit(city, style, color, seed, glow, jitter) {
    return new HK.Kit(city, {
      style: style, color: color,
      seed: seed == null ? 7.3 : seed,
      glow: glow == null ? 1 : glow,
      jitter: jitter == null ? 0.03 : jitter
    });
  }
  function ground(world, x, z) { var h = world.heightAt(x, z); return h < 0 ? 0 : h; }

  /* thin emissive strip (LED) */
  function ledStrip(K, x0, z0, x1, z1, y, h, color, glow) {
    K.box(x0, z0, x1, z1, y, y + h, { color: color || '#2a3b47', style: F.LED, glow: glow == null ? 2.0 : glow, collide: false, jitter: 0 });
  }
  /* thin horizontal architectural band around a tower footprint */
  function bandBox(K, cx, cz, w, d, y, h, color, pad) {
    pad = pad == null ? 0.25 : pad;
    K.box(cx - w / 2 - pad, cz - d / 2 - pad, cx + w / 2 + pad, cz + d / 2 + pad, y, y + h,
      { color: color, style: F.PURE, collide: false, jitter: 0 });
  }

  function rail(K, pts, y, color, postGap, h) {
    postGap = postGap || 8;
    color = color || '#cfd5d3';
    h = h == null ? 0.62 : h;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.5) continue;
      var yaw = Math.atan2(dz, dx);
      K.rotBox((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, len, 0.08, yaw, y + h - 0.07, y + h + 0.01,
        { color: color, style: F.PURE, collide: false, jitter: 0 });
      var n = Math.max(1, Math.round(len / postGap));
      for (var j = 0; j <= n; j++) {
        var t = j / n, px = a[0] + dx * t, pz = a[1] + dz * t;
        K.box(px - 0.08, pz - 0.08, px + 0.08, pz + 0.08, y, y + h,
          { color: color, style: F.PURE, collide: false, jitter: 0 });
      }
    }
  }

  function palm(K, x, z, y, h, seed) {
    var rng = new HK.Rng(seed || 7);
    var ty = y + h * 0.7;
    K.cyl(x, z, 0.22, y, ty, 6, { color: '#7a6a52', style: F.PURE, collide: false, top: false, jitter: 0.03 });
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2 + rng.float(-0.25, 0.25);
      K.beam([x, ty, z], [x + Math.cos(a) * h * 0.46, ty - h * 0.16, z + Math.sin(a) * h * 0.46], 0.6, 0.15,
        { color: i % 2 ? '#3f6b3a' : '#4e7d43', style: F.PURE });
    }
    K.box(x - 0.35, z - 0.35, x + 0.35, z + 0.35, ty, ty + 0.28, { color: '#3f6b3a', style: F.PURE, collide: false, jitter: 0 });
  }
  function palmRow(K, x0, x1, z, y, h, n, seed) {
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      palm(K, U.lerp(x0, x1, t), z, y, h, (seed || 5) + i * 13);
    }
  }

  function steps(K, cx, cz, w, d, y0, y1, n, color, alongX, collide) {
    var dy = (y1 - y0) / n, dd = d / n;
    for (var i = 0; i < n; i++) {
      if (alongX) {
        K.box(cx - w / 2, cz + d / 2 - dd * (i + 1), cx + w / 2, cz + d / 2 - dd * i, y0, y0 + dy * (i + 1) + 0.001,
          { color: color, style: F.PURE, collide: collide && i === 0, jitter: 0 });
      }
    }
  }

  function beaconTower(K, cx, cz, w, d, y, h, style, color, seed, crownType, glow) {
    var K2 = kit(K.b, style, color, seed, glow == null ? 1 : glow);
    K2.boxC(cx, cz, w, d, y, y + h, { color: color, style: style, seed: seed, collide: true });
    if (crownType === 'stepped') {
      K2.boxC(cx, cz, w * 0.8, d * 0.8, y + h, y + h + 2.2, { color: U.rgbHex(U.shadeRgb(U.hexRgb(color), 0.82)), style: F.PURE, collide: true });
      K2.boxC(cx, cz, w * 0.58, d * 0.58, y + h + 2.2, y + h + 3.6, { color: U.rgbHex(U.shadeRgb(U.hexRgb(color), 0.72)), style: F.PURE, collide: false });
      h += 3.6;
    } else if (crownType === 'led') {
      K2.boxC(cx, cz, w * 0.94, d * 0.94, y + h, y + h + 3.2, { color: '#26343f', style: F.LED, glow: 1.9, collide: false });
      K2.boxC(cx, cz, w * 0.7, d * 0.7, y + h + 3.2, y + h + 4.4, { color: U.rgbHex(U.shadeRgb(U.hexRgb(color), 0.8)), style: F.PURE, collide: false });
      h += 4.4;
    }
    K2.roofClutter(cx, cz, Math.max(4, w - 2), Math.max(4, d - 2), y + h, (seed || 3) + 7);
    if (h > 55) K2.beacon(cx + w * 0.3, y + h + 1.2, cz + d * 0.3);
    return y + h;
  }

  /* ===================================================== 1. WEST KOWLOON */

  /* ---------------- ICC — 484 m tapered glass tower + LED crown ----------- */
  function buildICC(world, city) {
    var X = -962, Z = -424, G = ground(world, X, Z);
    var K = kit(city, F.CURTAIN_DARK, '#6d7c86', 211, 1, 0.02);

    /* podium (Elements mall / transport interchange) */
    K.box(X - 34, Z - 40, X + 34, Z + 20, G, G + 7.2, { color: '#6d7c86', style: F.CURTAIN_DARK, seed: 211, collide: true });
    K.box(X - 34, Z - 40, X + 34, Z + 20, G + 7.2, G + 8.4, { color: '#c9d1d0', style: F.PURE, collide: true });
    /* green roof gardens on podium */
    K.box(X - 30, Z - 36, X - 18, Z - 24, G + 8.4, G + 9.1, { color: '#4c6b3f', style: F.PURE, collide: false, jitter: 0.06 });
    K.box(X + 12, Z - 34, X + 26, Z - 20, G + 8.4, G + 9.1, { color: '#557547', style: F.PURE, collide: false, jitter: 0.06 });
    /* glazed mall front, harbour side */
    K.box(X - 32, Z + 18.6, X + 32, Z + 20.2, G + 1.4, G + 4.2, { color: '#bcd8e0', style: F.GLASS_SILVER, glow: 1.2, collide: false, jitter: 0 });
    K.box(X - 30, Z + 20.2, X + 30, Z + 21.2, G + 4.2, G + 5.6, { color: '#d9dfdd', style: F.PURE, collide: false });
    /* entrance canopy + blue LED underlight */
    K.box(X - 26, Z + 20, X + 26, Z + 27, G + 5.6, G + 6.4, { color: '#e8e6dc', style: F.PURE, collide: false, jitter: 0 });
    ledStrip(K, X - 25, Z + 25.6, X + 25, Z + 26.4, G + 5.45, 0.28, '#9fe8ff', 1.4);
    K.sign({ x: X, z: Z + 20.6, y: G + 4.6, w: 26, h: 3.2, rotY: 0, kind: 'led', palette: ['#3de0ff', '#eae6dc'], text: '環球貿易廣場 ICC' });

    /* the tower itself — subtle 34 → 21.5 unit taper over 218 units */
    var Y0 = G + 8.4, YTOP = G + 8.4 + 218;
    function tw(y) { return 34 + (21.5 - 34) * U.clamp((y - Y0) / (YTOP - Y0), 0, 1); }
    var KT = kit(city, F.GLASS_SILVER, '#a9c4d6', 213, 1, 0.012);
    KT.taper(X, Z, 34, 34, 21.5, 21.5, Y0, YTOP, 9, { style: F.GLASS_SILVER, color: '#a9c4d6', seed: 213, collide: true });
    /* chamfered corner reveals — ICC reads as a faceted obelisk at mid distance */
    var stepH0 = (YTOP - Y0) / 9;
    for (var ch = 0; ch < 9; ch++) {
      var cy0 = Y0 + stepH0 * ch, cy1 = cy0 + stepH0;
      var chw = tw(cy0) / 2;
      for (var cc2 = 0; cc2 < 4; cc2++) {
        var csx = (cc2 < 2) ? -1 : 1, csz = (cc2 % 2 === 0) ? -1 : 1;
        var inset = chw - Math.max(1.5, chw * 0.08);
        KT.box(X + csx * inset - 0.38, Z + csz * inset - 0.38, X + csx * inset + 0.38, Z + csz * inset + 0.38,
          cy0, cy1, { color: '#6e7e88', style: F.CURTAIN_DARK, collide: false, jitter: 0 });
      }
    }
    /* horizontal facade bands (the ICC reads as stacked silver bands) */
    for (var b = 1; b <= 8; b++) {
      var by = Y0 + (YTOP - Y0) * b / 9;
      var bw = tw(by);
      bandBox(KT, X, Z, bw, bw, by - 0.18, 0.5, '#c9d8df', 0.2);
    }
    /* four crisp corner lines following the taper */
    for (var ci = 0; ci < 4; ci++) {
      var sx = (ci < 2) ? -1 : 1, sz = (ci % 2 === 0) ? -1 : 1;
      KT.beam([X + sx * 17, Y0, Z + sz * 17], [X + sx * 10.75, YTOP, Z + sz * 10.75], 1.15, 1.15,
        { color: '#d8e4e8', style: F.PURE, glow: 0 });
    }
    /* upper media facade: two taper steps carry giant LED screens per face */
    var stepH = (YTOP - Y0) / 9;
    for (var ms = 7; ms <= 8; ms++) {
      var my0 = Y0 + stepH * ms, my1 = Y0 + stepH * (ms + 1);
      var mw = 34 + (21.5 - 34) * ms / 9;
      var mh = mw / 2;
      KT.box(X - 9.5, Z + mh - 0.1, X + 9.5, Z + mh + 0.4, my0 + 1.0, my1 - 1.0, { color: '#22313a', style: F.LED, glow: 2.0, collide: false, jitter: 0 });
      KT.box(X - 9.5, Z - mh - 0.4, X + 9.5, Z - mh + 0.1, my0 + 1.0, my1 - 1.0, { color: '#22313a', style: F.LED, glow: 2.0, collide: false, jitter: 0 });
      KT.box(X + mh - 0.1, Z - 9.5, X + mh + 0.4, Z + 9.5, my0 + 1.0, my1 - 1.0, { color: '#22313a', style: F.LED, glow: 2.0, collide: false, jitter: 0 });
      KT.box(X - mh - 0.4, Z - 9.5, X - mh + 0.1, Z + 9.5, my0 + 1.0, my1 - 1.0, { color: '#22313a', style: F.LED, glow: 2.0, collide: false, jitter: 0 });
    }
    /* four lit corner lines running up the tower */
    for (var cl = 0; cl < 4; cl++) {
      var clsx = (cl < 2) ? -1 : 1, clsz = (cl % 2 === 0) ? -1 : 1;
      for (var cli = 0; cli < 4; cli++) {
        var cly0 = Y0 + 55 + cli * 42, cly1 = cly0 + 36;
        var clh = tw(cly0) / 2 - 0.35;
        KT.box(X + clsx * clh - 0.5, Z + clsz * clh - 0.5, X + clsx * clh + 0.5, Z + clsz * clh + 0.5,
          cly0, cly1, { color: '#dff2ff', style: F.LED, glow: 1.5, collide: false, jitter: 0 });
      }
    }
    /* sky100 observation band near the top */
    var skyW = tw(G + 196);
    KT.box(X - skyW / 2 - 0.3, Z - skyW / 2 - 0.3, X + skyW / 2 + 0.3, Z + skyW / 2 + 0.3, G + 193.5, G + 195.3,
      { color: '#1e2b35', style: F.LED, glow: 1.7, collide: false, jitter: 0 });
    /* LED crown — the tower lantern (three glowing stages) */
    var cwA = tw(YTOP - 30) + 0.35, cwB = tw(YTOP - 20) + 0.2, cwC = tw(YTOP - 8) + 0.1;
    KT.box(X - cwA / 2, Z - cwA / 2, X + cwA / 2, Z + cwA / 2, YTOP - 30, YTOP - 21, { color: '#22303b', style: F.LED, glow: 2.9, collide: false, jitter: 0 });
    KT.box(X - cwB / 2, Z - cwB / 2, X + cwB / 2, Z + cwB / 2, YTOP - 21, YTOP - 20.4, { color: '#c9d8df', style: F.PURE, collide: false, jitter: 0 });
    KT.box(X - cwB / 2, Z - cwB / 2, X + cwB / 2, Z + cwB / 2, YTOP - 20.4, YTOP - 8, { color: '#26343f', style: F.LED, glow: 2.6, collide: false, jitter: 0 });
    KT.box(X - cwC / 2, Z - cwC / 2, X + cwC / 2, Z + cwC / 2, YTOP - 8, YTOP - 1.2, { color: '#2b3a46', style: F.LED, glow: 2.2, collide: false, jitter: 0 });
    /* parapet + crown corners + roof */
    var pw2 = tw(YTOP - 1.2) + 0.15;
    KT.box(X - pw2 / 2, Z - pw2 / 2, X + pw2 / 2, Z + pw2 / 2, YTOP - 1.2, YTOP + 0.9, { color: '#c3ced3', style: F.METAL, collide: true });
    for (var cc = 0; cc < 4; cc++) {
      var cx = (cc < 2) ? -1 : 1, cz = (cc % 2 === 0) ? -1 : 1;
      KT.box(X + cx * 9.4 - 0.55, Z + cz * 9.4 - 0.55, X + cx * 9.4 + 0.55, Z + cz * 9.4 + 0.55, YTOP + 0.9, YTOP + 3.4,
        { color: '#d3dde1', style: F.METAL, collide: false });
      KT.beacon(X + cx * 9.4, YTOP + 3.9, Z + cz * 9.4);
    }
    KT.box(X - 5, Z - 5, X + 5, Z + 5, YTOP + 0.9, YTOP + 2.8, { color: '#5b666c', style: F.METAL, collide: false });
    KT.roofClutter(X, Z, 15, 15, YTOP + 2.8, 219, { collide: false });
    KT.beacon(X, YTOP + 5.6, Z);

    return 1;
  }

  /* ---------------- M+ museum — horizontal bar + LED media facade --------- */
  function buildMPlus(world, city) {
    var X = -1122, Z = -304, G = ground(world, X, Z);
    var W = 60, D = 22, Z0 = Z - 20, Z1 = Z0 + D;   /* z -324 .. -302 (clear of WK highway) */
    var K = kit(city, F.CURTAIN_DARK, '#3f474c', 311, 1, 0.02);

    /* ground floor with the colourful M+ artwork strip */
    K.box(X - W / 2, Z0, X + W / 2, Z1, G, G + 4.6, { color: '#2b3236', style: F.CURTAIN_DARK, collide: true });
    var artCols = ['#ff4fa3', '#3de0ff', '#ffb547', '#4dff9e', '#d24fff', '#eae6dc', '#ff4b3e', '#7fd0ff', '#ffe08a', '#a98bff'];
    for (var i = 0; i < 10; i++) {
      var ax = X - W / 2 + 1 + i * (W - 2) / 10;
      K.box(ax, Z1 + 0.02, ax + (W - 2) / 10 - 0.5, Z1 + 0.42, G + 0.7, G + 3.6,
        { color: artCols[i % artCols.length], style: F.PURE, collide: false, jitter: 0 });
    }
    /* deep dark soffit + floating gallery bar */
    K.box(X - W / 2 - 2, Z0 - 3, X + W / 2 + 2, Z1 + 2.5, G + 4.6, G + 6.4, { color: '#23282b', style: F.PURE, collide: true });
    K.box(X - W / 2 - 1, Z0 - 1, X + W / 2 + 1, Z1 + 0.5, G + 6.4, G + 25.2, { color: '#3f474c', style: F.CURTAIN_DARK, seed: 311, collide: true });
    /* vertical ceramic fins on the harbour face */
    for (var f = 0; f < 30; f++) {
      var fx = X - W / 2 + f * (W / 30);
      K.box(fx, Z1 + 0.2, fx + 0.38, Z1 + 0.75, G + 6.8, G + 24.6, { color: '#566166', style: F.PURE, collide: false, jitter: 0 });
    }
    /* LED media screen facing the harbour */
    K.box(X - W / 2 + 4, Z1 + 0.8, X - 4, Z1 + 1.35, G + 8.6, G + 21.4, { color: '#22313a', style: F.LED, glow: 2.4, collide: false, jitter: 0 });
    /* west tower slab (the M+ tower/board) */
    K.box(X - W / 2 - 1.2, Z0 - 2.5, X - W / 2 + 11.5, Z1 + 0.5, G, G + 33, { color: '#394146', style: F.CURTAIN_DARK, seed: 313, collide: true });
    for (var f2 = 0; f2 < 6; f2++) {
      K.box(X - W / 2 + f2 * 2.4, Z1 + 0.55, X - W / 2 + f2 * 2.4 + 0.35, Z1 + 1.0, G + 6, G + 32.4,
        { color: '#4f595e', style: F.PURE, collide: false, jitter: 0 });
    }
    K.box(X - W / 2 - 1.4, Z0 - 2.7, X - W / 2 + 11.7, Z1 + 0.7, G + 33, G + 34.2, { color: '#b6bdbd', style: F.PURE, collide: true });
    K.roofClutter(X - W / 2 + 5, Z0 + 8, 9, 14, G + 34.2, 315, { collide: false });
    K.beacon(X - W / 2 + 5, G + 35.6, Z0 + 8);
    /* roof clutter on the gallery bar */
    K.roofClutter(X - 6, Z0 + 9, 40, 16, G + 25.2, 317, { collide: false });
    K.sign({ x: X - W / 2 + 6, z: Z1 + 1.5, y: G + 23, w: 9, h: 2.2, rotY: 0, kind: 'led', palette: ['#ff4fa3', '#3de0ff'], text: 'M+' });
    return 1;
  }

  /* ---------------- Xiqu Centre — ribbed lantern drum + grand arch -------- */
  function buildXiqu(world, city) {
    var X = -1234, Z = -344, G = ground(world, X, Z);
    var K = kit(city, F.PURE, '#9c9c96', 411, 1, 0.02);

    /* stone skirt */
    K.cyl(X, Z, 17.2, G, G + 4.4, 24, { color: '#8d8c86', style: F.STONE, collide: true });
    K.collideBox(X - 16.5, Z - 16.5, X + 16.5, Z + 16.5, G, G + 4.4, true);
    /* ribbed metal drum: alternate radius panels */
    for (var i = 0; i < 24; i++) {
      var a = i / 24 * Math.PI * 2;
      var r = 16.3 + (i % 2) * 0.35;
      var px = X + Math.cos(a + Math.PI / 24) * r, pz = Z + Math.sin(a + Math.PI / 24) * r;
      K.rotBox(px, pz, 4.4, 1.3, a + Math.PI / 2, G + 4.2, G + 32.2,
        { color: i % 2 ? '#a3a29b' : '#96958f', style: F.PURE, collide: false, jitter: 0.012 });
    }
    /* top rim + lattice dome */
    K.cyl(X, Z, 16.8, G + 31.6, G + 33.4, 24, { color: '#b0afa8', style: F.METAL, collide: false });
    K.dome(X, Z, 16.5, G + 33.2, G + 43.4, 8, { color: '#8f9297', style: F.METAL, collide: false });
    for (var r2 = 0; r2 < 8; r2++) {
      var a2 = r2 / 8 * Math.PI * 2;
      K.beam([X + Math.cos(a2) * 16.3, G + 33.4, Z + Math.sin(a2) * 16.3], [X, G + 43.6, Z], 0.55, 0.55,
        { color: '#a4a8ac', style: F.METAL, glow: 0 });
    }
    K.cyl(X, Z, 13.2, G + 35.0, G + 35.9, 24, { color: '#74777b', style: F.METAL, collide: false, top: false });
    K.cyl(X, Z, 8.4, G + 39.6, G + 40.3, 20, { color: '#74777b', style: F.METAL, collide: false, top: false });
    K.spire(X, Z, 0.45, G + 43.4, G + 45.2, { color: '#b8bcbc', style: F.PURE, collide: false });
    /* warm lantern wash around the drum + roof rim */
    for (var ul = 0; ul < 10; ul++) {
      var ua = ul / 10 * Math.PI * 2;
      var ux = X + Math.cos(ua) * 15.6, uz = Z + Math.sin(ua) * 15.6;
      K.box(ux - 0.8, uz - 0.8, ux + 0.8, uz + 0.8, G + 4.6, G + 6.8, { color: '#ffb060', style: F.LED, glow: 0.75, collide: false, jitter: 0 });
      var rx = X + Math.cos(ua + 0.15) * 16.2, rz = Z + Math.sin(ua + 0.15) * 16.2;
      K.box(rx - 0.9, rz - 0.9, rx + 0.9, rz + 0.9, G + 32.0, G + 32.8, { color: '#ffd9a0', style: F.LED, glow: 0.7, collide: false, jitter: 0 });
    }

    /* grand arches (south + west + east) */
    function arch(fx, fz, halfW, h, nx, nz) {
      /* fx,fz = face centre point on the drum skin, (nx,nz) outward normal */
      var alongX = Math.abs(nz) > 0.5;
      var x0, z0, x1, z1;
      if (alongX) { x0 = fx - halfW; x1 = fx + halfW; z0 = fz - 0.7; z1 = fz + 0.7; }
      else { x0 = fx - 0.7; x1 = fx + 0.7; z0 = fz - halfW; z1 = fz + halfW; }
      /* dark recessed opening + warm lantern glow */
      K.box(x0 + 0.7, z0 + 0.15, x1 - 0.7, z1 - 0.15, G + 0.4, G + h, { color: '#151a1c', style: F.CURTAIN_DARK, collide: false, jitter: 0 });
      K.box(x0 + 1.5, z0 + 0.15, x1 - 1.5, z1 - 0.15, G + 0.9, G + h * 0.42, { color: '#ffb060', style: F.LED, glow: 1.8, collide: false, jitter: 0 });
      var fw = 0.9, fd = 0.9;
      /* vertical jambs */
      if (alongX) {
        K.box(x0, z0, x0 + fw, z1, G, G + h, { color: '#ccc9bf', style: F.PURE, collide: false });
        K.box(x1 - fw, z0, x1, z1, G, G + h, { color: '#ccc9bf', style: F.PURE, collide: false });
        K.beam([x0 + fw / 2, G + h - 0.6, fz], [fx, G + h + 4.2, fz], 1.2, 1.1, { color: '#ccc9bf', style: F.PURE });
        K.beam([x1 - fw / 2, G + h - 0.6, fz], [fx, G + h + 4.2, fz], 1.2, 1.1, { color: '#ccc9bf', style: F.PURE });
        K.box(fx - 1.0, fz - 0.8, fx + 1.0, fz + 0.8, G + h + 3.6, G + h + 5.4, { color: '#ccc9bf', style: F.PURE, collide: false });
      } else {
        K.box(x0, z0, x1, z0 + fd, G, G + h, { color: '#ccc9bf', style: F.PURE, collide: false });
        K.box(x0, z1 - fd, x1, z1, G, G + h, { color: '#ccc9bf', style: F.PURE, collide: false });
        K.beam([fx, G + h - 0.6, z0 + fd / 2], [fx, G + h + 4.2, fz], 1.2, 1.1, { color: '#ccc9bf', style: F.PURE });
        K.beam([fx, G + h - 0.6, z1 - fd / 2], [fx, G + h + 4.2, fz], 1.2, 1.1, { color: '#ccc9bf', style: F.PURE });
        K.box(fx - 0.8, fz - 1.0, fx + 0.8, fz + 1.0, G + h + 3.6, G + h + 5.4, { color: '#ccc9bf', style: F.PURE, collide: false });
      }
    }
    arch(X, Z + 16.9, 7.4, 14.5, 0, 1);
    arch(X - 16.9, Z, 5.2, 11.8, -1, 0);
    arch(X + 16.9, Z, 5.2, 11.8, 1, 0);
    K.sign({ x: X, z: Z + 17.6, y: G + 7.4, w: 7, h: 2.0, rotY: 0, kind: 'neon', palette: ['#ffb547', '#ff4fa3'], text: '戲曲中心 Xiqu Centre' });
    return 1;
  }

  /* ---------------- Palace Museum — bronze ribbed blocks + glass court ---- */
  function buildPalaceMuseum(world, city) {
    var X = -1184, Z = -422, G = ground(world, X, Z);
    var K = kit(city, F.STONE, '#cfc9bb', 511, 1, 0.025);

    /* podium + entrance canopy */
    K.box(X - 21, Z - 17, X + 21, Z + 17, G, G + 5.2, { color: '#cfc9bb', style: F.STONE, collide: true });
    K.box(X - 16, Z + 17, X + 16, Z + 23, G + 4.0, G + 5.4, { color: '#e6e1d4', style: F.PURE, collide: true });
    for (var pc = 0; pc < 4; pc++) {
      var pxx = X - 12 + pc * 8;
      K.box(pxx - 0.6, Z + 20.5, pxx + 0.6, Z + 21.7, G, G + 4.0, { color: '#d8d2c4', style: F.STONE, collide: false });
    }
    /* podium roof garden */
    K.box(X - 19, Z - 15, X - 9, Z - 6, G + 5.2, G + 5.9, { color: '#4c6b3f', style: F.PURE, collide: false, jitter: 0.08 });

    var blocks = [[X - 20, X - 4], [X + 4, X + 20]];
    for (var bi = 0; bi < blocks.length; bi++) {
      var x0 = blocks[bi][0], x1 = blocks[bi][1];
      K.box(x0, Z - 16, x1, Z + 16, G + 5.2, G + 25.8, { color: '#a78f6c', style: F.PURE, collide: true, jitter: 0.02 });
      /* horizontal bronze ridges */
      for (var ry = G + 6.4; ry < G + 25.4; ry += 1.55) {
        K.box(x0 - 0.1, Z + 16, x1 + 0.1, Z + 16.55, ry, ry + 0.48, { color: '#c2a97f', style: F.PURE, collide: false, jitter: 0 });
        K.box(x0 - 0.1, Z - 16.55, x1 + 0.1, Z - 16, ry + 0.3, ry + 0.78, { color: '#b79e75', style: F.PURE, collide: false, jitter: 0 });
      }
      /* vertical end spines */
      K.box(x0 - 0.4, Z - 16.4, x0 + 0.6, Z + 16.4, G + 5.2, G + 26.2, { color: '#b8a17a', style: F.PURE, collide: false });
      K.box(x1 - 0.6, Z - 16.4, x1 + 0.4, Z + 16.4, G + 5.2, G + 26.2, { color: '#b8a17a', style: F.PURE, collide: false });
      K.box(x0 - 0.4, Z - 16.4, x1 + 0.4, Z + 16.4, G + 25.8, G + 26.8, { color: '#8f7a58', style: F.PURE, collide: true });
      K.roofClutter((x0 + x1) / 2, Z, x1 - x0 - 3, 26, G + 26.8, 521 + bi, { collide: false });
    }
    /* recessed glass atrium between the blocks */
    K.box(X - 4.4, Z - 15, X + 4.4, Z + 13.4, G + 5.2, G + 23.2, { color: '#2e3d45', style: F.GLASS_BLUE, collide: true });
    for (var rf = 0; rf < 3; rf++) {
      K.box(X - 4.0 + rf * 2.7, Z + 13.4, X - 3.2 + rf * 2.7, Z + 13.9, G + 6, G + 14, { color: '#a83a30', style: F.PURE, collide: false, jitter: 0 });
    }
    /* projecting glazed lantern box */
    K.box(X - 9, Z - 1, X + 9, Z + 14.5, G + 14, G + 21, { color: '#4a6c7a', style: F.GLASS_BLUE, collide: false });
    K.box(X - 9.4, Z - 1.4, X + 9.4, Z + 14.9, G + 21, G + 22, { color: '#b8b2a4', style: F.METAL, collide: false });
    K.sign({ x: X, z: Z + 17.2, y: G + 8.5, w: 10, h: 2.2, rotY: 0, kind: 'led', palette: ['#ffb547', '#eae6dc'], text: '香港故宮文化博物館' });
    return 1;
  }

  /* ---------------- Kowloon Station cluster (Sorrento/Arch/W/Harbourside) */
  function buildKowloonStation(world, city) {
    var X = -968, Z = -514, G = ground(world, X, Z);
    var K = kit(city, F.CURTAIN_DARK, '#7f888d', 611, 1, 0.02);
    /* shared podium (Elements / station / transport interchange) */
    K.box(X - 61, Z - 55, X + 61, Z + 46, G, G + 7, { color: '#7f888d', style: F.CURTAIN_DARK, seed: 611, collide: true });
    K.box(X - 61, Z - 55, X + 61, Z + 46, G + 7, G + 8.2, { color: '#c4cbc9', style: F.PURE, collide: true });
    /* circulation cores on the podium roof */
    K.box(X - 14, Z - 40, X - 6, Z - 32, G + 8.2, G + 13.5, { color: '#9aa3a4', style: F.PURE, collide: true });
    K.box(X + 20, Z - 20, X + 30, Z - 8, G + 8.2, G + 12.5, { color: '#9aa3a4', style: F.PURE, collide: true });
    K.roofClutter(X - 30, Z + 20, 28, 16, G + 8.2, 613, { collide: false });

    var T = G + 8.2;
    /* --- The Arch: twin towers joined by a high bridge --- */
    var archK = kit(city, F.GLASS_SILVER, '#aec5d2', 621, 1, 0.015);
    K.boxC(-1016, Z - 34, 13, 13, T, T + 100, { color: '#aec5d2', style: F.GLASS_SILVER, seed: 621, collide: true });
    K.boxC(-996, Z - 34, 13, 13, T, T + 100, { color: '#aec5d2', style: F.GLASS_SILVER, seed: 623, collide: true });
    /* sky bridge between the twins (the "arch") */
    archK.box(-1009.5, Z - 40, -1002.5, Z - 20, T + 87, T + 96, { color: '#bccfd8', style: F.GLASS_SILVER, seed: 625, collide: false });
    archK.box(-1010.2, Z - 40.7, -1001.8, Z - 19.3, T + 95.5, T + 97.2, { color: '#d3dfe3', style: F.PURE, collide: false });
    /* crowns */
    for (var ai = 0; ai < 2; ai++) {
      var ax = ai ? -996 : -1016;
      archK.boxC(ax, Z - 34, 11, 11, T + 100, T + 103, { color: '#8fa5b3', style: F.PURE, collide: false });
      archK.boxC(ax, Z - 34, 9, 9, T + 103, T + 105, { color: '#26343f', style: F.LED, glow: 2.0, collide: false });
      archK.beacon(ax, T + 107, Z - 34);
      archK.roofClutter(ax, Z - 34, 9, 9, T + 105, 627 + ai, { collide: false });
    }
    /* --- Sorrento: four residential towers --- */
    var sor = [['#c9c4b8', 84], ['#c3beb2', 88], ['#cdc8bc', 80], ['#c6c1b5', 86]];
    for (var si = 0; si < 4; si++) {
      var sx = -1020 + si * 17;
      beaconTower(K, sx, Z - 6, 12, 13, T, sor[si][1], F.RESI, sor[si][0], 631 + si, 'stepped', 1.0);
    }
    /* --- The Harbourside: two glassy slabs on the harbour side --- */
    beaconTower(K, -1014, Z + 28, 14, 12, T, 76, F.GLASS_SILVER, '#b7c8ce', 641, 'stepped', 1.0);
    beaconTower(K, -992, Z + 28, 14, 12, T, 72, F.GLASS_SILVER, '#b2c3c9', 643, 'stepped', 1.0);
    /* --- W Hotel tower + LED crown --- */
    var wTop = beaconTower(K, -944, Z - 26, 14, 14, T, 84, F.GLASS_BRONZE, '#8a7a63', 651, 'led', 1.4);
    K.boxC(-944, Z - 34, 10, 1.0, wTop + 0.5, wTop + 6.5, { color: '#ff4fa3', style: F.LED, glow: 2.2, collide: false, jitter: 0 });
    K.sign({ x: -944, z: Z - 20, y: wTop + 2, w: 5, h: 5, rotY: 0, kind: 'neon', palette: ['#ff4fa3', '#eae6dc'], text: 'W' });
    /* --- The Waterfront tower --- */
    beaconTower(K, -938, Z + 20, 12, 12, T, 70, F.RESI, '#c2bdb0', 661, 'stepped', 1.0);
    return 1;
  }

  /* ---------------- West Kowloon Art Park waterfront edge ---------------- */
  function buildArtPark(world, city) {
    var K = kit(city, F.PURE, '#b8ad97', 711, 1, 0.03);
    var pts = [], wall = [], i, x;
    for (x = -1250; x <= -870; x += 26) {
      pts.push([x, L.northShoreZ(x) - 7]);
      wall.push([x, L.northShoreZ(x) - 2.6]);
    }
    /* sea wall + promenade railing along the water */
    for (i = 0; i < wall.length - 1; i++) {
      var a = wall[i], b = wall[i + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1], len = Math.sqrt(dx * dx + dz * dz);
      K.rotBox((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, len + 0.6, 1.4, Math.atan2(dz, dx), 0.2, 1.9,
        { color: '#8f8b82', style: F.PURE, collide: true });
    }
    rail(K, pts, 1.0, '#d8d6cc', 9);
    /* palms + sculpture trail on the 9-unit waterfront strip */
    for (x = -1236; x <= -884; x += 44) {
      palm(K, x, L.northShoreZ(x) - 6.2, 1, 4.4, 713 + x);
    }
    var sculp = [[-1160, '#e8e3d4', 4.5], [-1085, '#ffb547', 3.2], [-1010, '#3de0ff', 5.0], [-935, '#eae6dc', 3.6], [-1185, '#ff4fa3', 3.0]];
    for (i = 0; i < sculp.length; i++) {
      var sx = sculp[i][0], sz = L.northShoreZ(sx) - 8.4;
      K.box(sx - 1.6, sz - 1.6, sx + 1.6, sz + 1.6, 1.0, 1.6, { color: '#8f8b82', style: F.PURE, collide: true });
      K.box(sx - 0.8, sz - 0.8, sx + 0.8, sz + 0.8, 1.6, 1.6 + sculp[i][2], { color: sculp[i][1], style: F.PURE, collide: false, jitter: 0 });
      K.box(sx - 0.3, sz - 0.3, sx + 1.5, sz + 0.3, 1.6 + sculp[i][2] * 0.5, 1.6 + sculp[i][2] * 0.5 + 1.2, { color: sculp[i][1], style: F.PURE, collide: false, jitter: 0 });
    }
    /* benches along the rail */
    for (x = -1200; x <= -900; x += 60) {
      var bz = L.northShoreZ(x) - 6.8;
      K.box(x - 1.8, bz - 0.5, x + 1.8, bz + 0.5, 1.0, 1.5, { color: '#7a6a52', style: F.PURE, collide: false });
    }
    K.sign({ x: -1060, z: L.northShoreZ(-1060) - 7.8, y: 4.2, w: 14, h: 2.0, rotY: 0, kind: 'led', palette: ['#eae6dc', '#3de0ff'], text: '西九文化區 WKCD' });
    return 1;
  }

  function buildWKCD(world, city) {
    var n = 0;
    n += buildICC(world, city);
    n += buildMPlus(world, city);
    n += buildXiqu(world, city);
    n += buildPalaceMuseum(world, city);
    n += buildKowloonStation(world, city);
    n += buildArtPark(world, city);
    return n;
  }

  /* ================================================== 2. TST WATERFRONT */

  /* ---------------- HK Cultural Centre — big windowless sloped roof -------- */
  function buildCulturalCentre(world, city) {
    var G = ground(world, -132, -356);
    var K = kit(city, F.PURE, '#cdb6a8', 811, 1, 0.015);
    var X0 = -174, X1 = -100, ZS = -336, ZE = -360, ZW = -356, ZN = -380;

    /* body / arcade under the sloping halls */
    K.box(X0, ZN, X1, ZS, G, G + 5.8, { color: '#c4b3a6', style: F.STONE, collide: true });
    K.box(X0 - 1.5, ZS - 3.2, X1 + 1.5, ZS + 1.4, G + 5.8, G + 6.5, { color: '#ddcfc1', style: F.PURE, collide: true });
    for (var ci = 0; ci < 9; ci++) {
      var cx = X0 + 2.5 + ci * (X1 - X0 - 5) / 8;
      K.box(cx - 0.75, ZS - 2.1, cx + 0.75, ZS - 0.5, G, G + 5.8, { color: '#d6ccc0', style: F.STONE, collide: false });
    }
    /* west foyer block (low flat volume on the Clock Tower side) */
    K.box(X0 + 1, -344, X0 + 17, ZS + 1.0, G, G + 8.6, { color: '#c9b8aa', style: F.PURE, collide: true });
    K.box(X0 + 3, ZS - 0.3, X0 + 15, ZS + 1.2, G + 1.4, G + 7.6, { color: '#33474f', style: F.CURTAIN_DARK, collide: false });
    K.box(X0 + 1, -345, X0 + 17, ZS + 2.0, G + 8.6, G + 9.3, { color: '#ded1c4', style: F.PURE, collide: true });

    /* a hall: steep stepped tiled slope facing the harbour + taller rear block */
    function hall(xa, xb, zs, ze, zn, ys, yr, yrear, n, seed) {
      var K2 = kit(city, F.PURE, '#cdb6a8', seed, 1, 0.012);
      var dz = (zs - ze) / n;
      for (var i = 0; i < n; i++) {
        var z0 = zs - dz * i, z1 = zs - dz * (i + 1);
        var top = ys + (yr - ys) * (i + 1) / n;
        K2.box(xa, z1, xb, z0, G, G + top, { color: i % 3 === 2 ? '#d2bcae' : '#cdb6a8', style: F.PURE, seed: seed + i, collide: i < 2, jitter: 0.012 });
      }
      /* tile ridge lines running up the slope */
      for (var r = 0; r < 5; r++) {
        var rx = xa + (xb - xa) * (r + 1) / 6;
        K2.beam([rx, G + ys + 0.15, zs - 0.6], [rx, G + yr + 0.2, ze + 0.4], 0.34, 0.36, { color: '#b59f92', style: F.PURE, glow: 0 });
      }
      /* dark eave fascia + ridge cap */
      K2.box(xa, zs - 1.7, xb, zs + 0.05, G + ys - 1.1, G + ys + 0.12, { color: '#8b7668', style: F.PURE, collide: false, jitter: 0 });
      K2.box(xa, ze - 0.7, xb, ze + 0.7, G + yr - 0.35, G + yr + 0.65, { color: '#b7a294', style: F.PURE, collide: false, jitter: 0 });
      K2.box(xa, ze - 0.45, xb, ze + 0.45, G + yr + 0.65, G + yr + 0.85, { color: '#ffd9a0', style: F.LED, glow: 0.55, collide: false, jitter: 0 });
      /* rear volume behind the slope (fly tower / stage house) */
      K2.box(xa, ze, xb, zn, G, G + yrear, { color: '#c2b0a2', style: F.PURE, seed: seed + 40, collide: true });
      K2.box(xa + 1, ze - 0.2, xb - 1, zn + 1, G + yrear, G + yrear + 0.8, { color: '#d8c8ba', style: F.PURE, collide: false });
      /* warm floodlight strip washing the slope */
      K2.box(xa, zs - 1.85, xb, zs - 1.55, G + ys - 0.2, G + ys + 0.25, { color: '#ffd9a0', style: F.LED, glow: 0.75, collide: false, jitter: 0 });
    }
    hall(-172, -140, ZS, ZW, ZN, 6.5, 13.2, 13.9, 16, 813);
    hall(-136, X1 - 0.6, ZS, ZE, ZN, 6.5, 16.2, 17.4, 18, 817);

    /* glazed valley / studio theatre between the two halls */
    K.box(-140.2, ZN, -135.8, ZS, G, G + 9.2, { color: '#b6a495', style: F.PURE, collide: true });
    K.box(-139.6, ZN + 2, -136.4, ZS - 2, G + 9.2, G + 9.9, { color: '#3a4d55', style: F.CURTAIN_DARK, collide: false });
    /* east vertical end wall ribs following the slope */
    for (var er = 0; er < 7; er++) {
      var ez = ZS - 2 - er * 3.4;
      K.box(X1 - 0.3, ez, X1 + 0.35, ez + 0.9, G + 6, G + 6.4 + er * 1.5, { color: '#b7a294', style: F.PURE, collide: false, jitter: 0 });
    }
    /* roof skylight slots on the rear stage house */
    for (var sk = 0; sk < 3; sk++) {
      K.box(-128 + sk * 8, -377, -124 + sk * 8, -363, G + 17.4, G + 17.9, { color: '#2c3d43', style: F.PURE, collide: false, jitter: 0 });
    }
    /* warm strip lighting in the arcade */
    for (var lc = 0; lc < 8; lc++) {
      var lx = X0 + 4 + lc * 9;
      ledStrip(K, lx, ZS - 1.4, lx + 3.6, ZS - 1.0, G + 5.35, 0.22, '#ffd9a0', 0.9);
    }
    K.sign({ x: -137, z: ZS + 2.0, y: G + 5.2, w: 15, h: 2.2, rotY: 0, kind: 'led', palette: ['#ffd9a0', '#eae6dc'], text: '香港文化中心 HK Cultural Centre' });
    /* forecourt strip between the arcade and Salisbury Road */
    K.box(X0 - 4, ZS + 1.4, X1 + 4, -333, G, G + 0.32, { color: '#b8ac96', style: F.PURE, collide: false });
    palmRow(K, X0 + 4, X1 - 6, ZS + 3.6, G, 4.4, 6, 819);
    return 1;
  }

  /* ---------------- Clock Tower — red brick + stone + copper dome --------- */
  function buildClockTower(world, city) {
    var X = -182, Z = -340, G = ground(world, X, Z);
    var K = kit(city, F.STONE, '#d9d3c3', 821, 1, 0.01);

    /* circular fountain pool around the tower */
    K.cyl(X, Z, 10.2, G, G + 0.42, 26, { color: '#c2b6a0', style: F.PURE, collide: false });
    K.cyl(X, Z, 9.3, G + 0.28, G + 0.5, 26, { color: '#4f7d80', style: F.PURE, collide: false });
    K.cyl(X, Z, 1.5, G + 0.3, G + 1.8, 10, { color: '#8fb4b2', style: F.PURE, collide: false });
    /* plinth */
    K.box(X - 6.2, Z - 6.2, X + 6.2, Z + 6.2, G, G + 2.4, { color: '#d9d3c3', style: F.STONE, collide: true });
    K.box(X - 5.4, Z - 5.4, X + 5.4, Z + 5.4, G + 2.4, G + 2.8, { color: '#e6e0d0', style: F.PURE, collide: true });
    /* brick shaft */
    K.box(X - 4.7, Z - 4.7, X + 4.7, Z + 4.7, G + 2.8, G + 12.6, { color: '#9a5642', style: F.PURE, collide: true, jitter: 0.018 });
    /* white stone quoins + string courses */
    for (var q = 0; q < 4; q++) {
      var qx = X + (q < 2 ? -4.5 : 4.5), qz = Z + (q % 2 === 0 ? -4.5 : 4.5);
      K.box(qx - 0.5, qz - 0.5, qx + 0.5, qz + 0.5, G + 2.8, G + 12.6, { color: '#e2dccc', style: F.PURE, collide: false, jitter: 0 });
    }
    for (var bb = 0; bb < 4; bb++) {
      var by = G + 4.4 + bb * 2.15;
      K.box(X - 4.9, Z - 4.9, X + 4.9, Z + 4.9, by, by + 0.4, { color: '#e2dccc', style: F.PURE, collide: false, jitter: 0 });
    }
    /* clock stage */
    K.box(X - 5.6, Z - 5.6, X + 5.6, Z + 5.6, G + 12.6, G + 15.7, { color: '#e6e0d0', style: F.STONE, collide: true });
    for (var f = 0; f < 4; f++) {
      var nx = f === 0 ? -1 : (f === 1 ? 1 : 0);
      var nz = f === 2 ? -1 : (f === 3 ? 1 : 0);
      var fx = X + nx * 5.75, fz = Z + nz * 5.75;
      if (nx !== 0) {
        K.box(fx - 0.22, fz - 2.15, fx + 0.22, fz + 2.15, G + 12.9, G + 15.3, { color: '#26261f', style: F.PURE, collide: false, jitter: 0 });
        K.decal({ x: fx + nx * 0.42, y: G + 14.15, z: fz, w: 3.35, h: 3.35, nx: nx, nz: 0, u0: 0.02, v0: 0.02, u1: 0.48, v1: 0.48 });
      } else {
        K.box(fx - 2.15, fz - 0.22, fx + 2.15, fz + 0.22, G + 12.9, G + 15.3, { color: '#26261f', style: F.PURE, collide: false, jitter: 0 });
        K.decal({ x: fx, y: G + 14.15, z: fz + nz * 0.42, w: 3.35, h: 3.35, nx: 0, nz: nz, u0: 0.02, v0: 0.02, u1: 0.48, v1: 0.48 });
      }
    }
    K.box(X - 6.1, Z - 6.1, X + 6.1, Z + 6.1, G + 15.7, G + 16.2, { color: '#efe9da', style: F.PURE, collide: false });
    /* belfry */
    K.box(X - 4.3, Z - 4.3, X + 4.3, Z + 4.3, G + 16.2, G + 18.2, { color: '#e6e0d0', style: F.STONE, collide: true });
    for (var bf = 0; bf < 4; bf++) {
      var bx2 = bf === 0 ? -4.35 : (bf === 1 ? 4.35 : 0);
      var bz2 = bf === 2 ? -4.35 : (bf === 3 ? 4.35 : 0);
      if (bx2 !== 0) K.box(X + bx2 - 0.15, Z + bz2 - 1.4, X + bx2 + 0.15, Z + bz2 + 1.4, G + 16.5, G + 18.0, { color: '#23231d', style: F.PURE, collide: false, jitter: 0 });
      else K.box(X + bx2 - 1.4, Z + bz2 - 0.15, X + bx2 + 1.4, Z + bz2 + 0.15, G + 16.5, G + 18.0, { color: '#23231d', style: F.PURE, collide: false, jitter: 0 });
    }
    K.box(X - 4.9, Z - 4.9, X + 4.9, Z + 4.9, G + 18.2, G + 18.7, { color: '#efe9da', style: F.PURE, collide: false });
    /* stone drum + copper pyramidal cap (the Kowloon station clock tower roof) */
    K.cyl(X, Z, 3.4, G + 18.7, G + 19.5, 12, { color: '#e6e0d0', style: F.STONE, collide: false });
    K.pyramid(X, Z, 8.4, 8.4, G + 19.3, G + 23.8, { roofColor: '#5f8674', style: F.METAL, collide: false });
    K.spire(X, Z, 0.26, G + 23.8, G + 26.0, { color: '#c5a35a', style: F.PURE, collide: false });
    /* palms + lamps around the pool */
    palm(K, X - 11, Z + 7, G, 4.6, 823);
    palm(K, X + 11, Z + 7, G, 4.6, 824);
    palm(K, X - 11, Z - 7, G, 4.2, 825);
    palm(K, X + 11, Z - 7, G, 4.2, 826);
    for (var lp = 0; lp < 4; lp++) {
      var la = lp / 4 * Math.PI * 2 + 0.6;
      var lx2 = X + Math.cos(la) * 12.4, lz2 = Z + Math.sin(la) * 12.4;
      K.spire(lx2, lz2, 0.18, G, G + 3.6, { color: '#8c9092', style: F.PURE, collide: false });
      K.box(lx2 - 0.5, lz2 - 0.5, lx2 + 0.5, lz2 + 0.5, G + 3.6, G + 4.1, { color: '#ffe9b0', style: F.PURE, glow: 0.5, collide: false, jitter: 0 });
    }
    /* warm floodlighting on the brick shaft */
    for (var up = 0; up < 4; up++) {
      var ux2 = X + (up < 2 ? -5.0 : 5.0), uz2 = Z + (up % 2 === 0 ? -5.0 : 5.0);
      K.box(ux2 - 0.55, uz2 - 0.55, ux2 + 0.55, uz2 + 0.55, G + 2.85, G + 3.45, { color: '#ffe9b0', style: F.LED, glow: 0.55, collide: false, jitter: 0 });
    }
    K.sign({ x: X, z: Z + 6.9, y: G + 10.4, w: 6, h: 2.6, rotY: 0, kind: 'led', palette: ['#ffe9b0', '#eae6dc'], text: '前九廣鐵路鐘樓' });
    return 1;
  }

  /* ---------------- Space Museum — silver egg dome + ribbed wing ---------- */
  function buildSpaceMuseum(world, city) {
    var X = -20, Z = -364, G = ground(world, X, Z);
    var K = kit(city, F.STONE, '#d8cfc0', 831, 1, 0.02);
    var DCX = -31, DCZ = -365;

    /* podium + entrance steps */
    K.box(X - 16, Z - 14, X + 16, Z + 14, G, G + 5.6, { color: '#d8cfc0', style: F.STONE, collide: true });
    K.box(X - 15, Z + 12, X + 15, Z + 14.6, G + 2.6, G + 5.6, { color: '#e2dccd', style: F.PURE, collide: false });
    /* silver planetarium egg */
    K.cyl(DCX, DCZ, 11.2, G + 5.6, G + 7.2, 24, { color: '#2c3f45', style: F.GLASS_BLUE, collide: false });
    K.dome(DCX, DCZ, 11.4, G + 7.2, G + 23.2, 9, { color: '#dfe3e2', style: F.METAL, collide: false });
    K.cyl(DCX, DCZ, 11.5, G + 9.8, G + 10.7, 24, { color: '#b9c4c4', style: F.METAL, collide: false, top: false });
    K.cyl(DCX, DCZ, 2.2, G + 23.0, G + 23.8, 10, { color: '#a8b4b4', style: F.METAL, collide: false });
    K.spire(DCX, DCZ, 0.22, G + 23.8, G + 25.6, { color: '#8c9092', style: F.PURE, collide: false });
    K.box(DCX - 0.6, DCZ - 0.6, DCX + 0.6, DCZ + 0.6, G + 23.6, G + 24.1, { color: '#ff4b3e', style: F.LED, glow: 0.9, collide: false, jitter: 0 });
    /* ribbed wing block (the exhibition wing) */
    K.box(X + 2, Z - 14, X + 16, Z + 10, G, G + 12.6, { color: '#d8cfc0', style: F.PURE, collide: true });
    for (var r = 0; r < 7; r++) {
      K.box(X + 2, Z + 10, X + 16, Z + 10.5, G + 2.2 + r * 1.4, G + 2.6 + r * 1.4, { color: '#c3b9a8', style: F.PURE, collide: false, jitter: 0 });
    }
    K.box(X + 4, Z + 9.4, X + 14, Z + 10.2, G, G + 3.6, { color: '#26363c', style: F.CURTAIN_DARK, collide: false });
    /* little tower + antenna */
    K.box(X + 13, Z - 14, X + 17, Z - 10, G + 12.6, G + 17.6, { color: '#d8cfc0', style: F.PURE, collide: true });
    K.spire(X + 15, Z - 12, 0.16, G + 17.6, G + 20.4, { color: '#8c9092', style: F.PURE, collide: false });
    /* entrance canopy + sign */
    K.box(X - 8, Z + 14, X + 6, Z + 17.5, G + 4.2, G + 4.9, { color: '#efece2', style: F.PURE, collide: false });
    K.sign({ x: X + 6, z: Z + 14.6, y: G + 5.6, w: 7, h: 1.8, rotY: 0, kind: 'led', palette: ['#cfe4ff', '#eae6dc'], text: '香港太空館' });
    return 1;
  }

  /* ---------------- Museum of Art — layered ribbed gallery ---------------- */
  function buildMuseumOfArt(world, city) {
    var X = 50, Z = -358, G = ground(world, X, Z);
    var K = kit(city, F.BANDED, '#c8c1b0', 841, 1, 0.02);

    K.box(X - 15, Z - 11, X + 15, Z + 11, G, G + 8.2, { color: '#c8c1b0', style: F.BANDED, collide: true });
    for (var c = 0; c < 4; c++) {
      var px = X - 13 + c * 9;
      K.box(px - 0.8, Z + 9.4, px + 0.8, Z + 10.8, G, G + 8.2, { color: '#4a4640', style: F.PURE, collide: false });
    }
    /* teal glass ribbon */
    K.box(X - 14, Z - 10.4, X + 14, Z + 9.4, G + 8.2, G + 10.6, { color: '#2c3a3f', style: F.CURTAIN_DARK, collide: true });
    /* upper layered gallery */
    K.box(X - 13, Z - 9, X + 13, Z + 9, G + 10.6, G + 17.6, { color: '#d2cbbb', style: F.BANDED, collide: true });
    for (var l = 0; l < 8; l++) {
      K.box(X - 13, Z + 8.8, X + 13, Z + 9.4, G + 11.2 + l * 0.75, G + 11.55 + l * 0.75, { color: '#b9b2a2', style: F.PURE, collide: false, jitter: 0 });
    }
    K.box(X - 10, Z - 7, X + 10, Z + 7, G + 17.6, G + 22.6, { color: '#cfc8b8', style: F.BANDED, collide: true });
    K.box(X - 7, Z - 5, X + 7, Z + 5, G + 22.6, G + 25.4, { color: '#a8a49a', style: F.METAL, collide: true });
    K.roofClutter(X, Z, 12, 8, G + 25.4, 843, { collide: false });
    /* white lower harbour-side wing */
    K.box(X - 15, Z + 1, X - 5, Z + 11, G, G + 5.6, { color: '#e6e3da', style: F.PURE, collide: true });
    K.box(X - 13.5, Z + 9.4, X - 6.5, Z + 10.8, G + 2.4, G + 5.2, { color: '#2c5a55', style: F.GLASS_BLUE, collide: false });
    K.sign({ x: X, z: Z + 11, y: G + 5.2, w: 10, h: 2.0, rotY: 0, kind: 'led', palette: ['#cfe4ff', '#eae6dc'], text: '香港藝術館 HKMoA' });
    return 1;
  }

  /* ---------------- Star Ferry TST pier — green/white + walkable deck ----- */
  function buildStarPier(world, city) {
    var X = -216, Z = -296;
    var K = kit(city, F.PURE, '#b8b5a8', 851, 1, 0.03);

    /* piles + walkable deck over the harbour */
    for (var ix = 0; ix < 5; ix++) {
      for (var iz = 0; iz < 6; iz++) {
        var px = X - 15 + ix * 7.5, pz = -320 + iz * 9.4;
        if (L.isWater(px, pz)) K.cyl(px, pz, 0.42, -1.6, 1.1, 6, { color: '#6d6a64', style: F.PURE, collide: false, top: false });
      }
    }
    K.box(X - 17, -321.5, X + 17, -270.5, 1.0, 2.3, { color: '#b8b5a8', style: F.PURE, collide: true });
    K.box(X - 17.3, -271.0, X + 17.3, -270.2, 2.3, 2.95, { color: '#2f6b4c', style: F.PURE, collide: false });
    /* ferry terminal pavilion (seaward half) */
    K.box(X - 16, -292, X + 16, -272, 2.3, 7.6, { color: '#e8e3d7', style: F.PURE, collide: true });
    K.box(X - 16.4, -292.4, X + 16.4, -271.6, 2.3, 3.4, { color: '#2f6b4c', style: F.PURE, collide: false });
    K.box(X - 17, -293, X + 17, -271, 7.6, 8.6, { color: '#2f6b4c', style: F.PURE, collide: false });
    K.box(X - 17.2, -293.2, X + 17.2, -270.8, 8.6, 9.05, { color: '#f0ece2', style: F.PURE, collide: false });
    K.box(X - 10, -286, X + 10, -278, 9.05, 9.8, { color: '#f2efe6', style: F.PURE, collide: false });
    for (var ci = 0; ci < 6; ci++) {
      var cx = X - 15 + ci * 6;
      K.box(cx - 0.35, -291.6, cx + 0.35, -290.9, 2.3, 7.6, { color: '#f2efe6', style: F.PURE, collide: false });
      K.box(cx - 0.35, -273.1, cx + 0.35, -272.4, 2.3, 7.6, { color: '#f2efe6', style: F.PURE, collide: false });
    }
    /* covered shore-half concourse */
    K.box(X - 15.5, -318.5, X + 15.5, -293.5, 5.9, 6.4, { color: '#efece2', style: F.PURE, collide: false });
    for (var pc = 0; pc < 6; pc++) {
      var pcx = X - 14 + pc * 5.6;
      K.box(pcx - 0.28, -315.8, pcx + 0.28, -315.1, 2.3, 5.9, { color: '#f2efe6', style: F.PURE, collide: false });
    }
    /* ticket booths */
    K.box(X - 9, -299, X - 3, -294, 2.3, 4.8, { color: '#e2ddcf', style: F.PURE, collide: true });
    K.box(X + 3, -299, X + 9, -294, 2.3, 4.8, { color: '#e2ddcf', style: F.PURE, collide: true });
    /* gangways down to the ferry berth */
    K.beam([X - 8, 2.3, -271.8], [X - 8, 1.05, -265.6], 4.2, 0.34, { color: '#8f8b82', style: F.PURE, glow: 0 });
    K.beam([X + 8, 2.3, -271.8], [X + 8, 1.05, -265.6], 4.2, 0.34, { color: '#8f8b82', style: F.PURE, glow: 0 });
    rail(K, [[X - 10.2, -271.2], [X - 10.2, -265.6]], 1.05, '#2f6b4c', 6);
    rail(K, [[X - 5.8, -271.2], [X - 5.8, -265.6]], 1.05, '#2f6b4c', 6);
    rail(K, [[X + 5.8, -271.2], [X + 5.8, -265.6]], 1.05, '#2f6b4c', 6);
    rail(K, [[X + 10.2, -271.2], [X + 10.2, -265.6]], 1.05, '#2f6b4c', 6);
    /* deck railings */
    rail(K, [[X - 17, -320.5], [X - 17, -271.5]], 2.3, '#2f6b4c', 7);
    rail(K, [[X + 17, -320.5], [X + 17, -271.5]], 2.3, '#2f6b4c', 7);
    rail(K, [[X - 13, -271], [X - 1.5, -271]], 2.3, '#2f6b4c', 6);
    rail(K, [[X + 1.5, -271], [X + 13, -271]], 2.3, '#2f6b4c', 6);
    /* signage + lamps */
    K.sign({ x: X, z: -271.4, y: 5.0, w: 12, h: 1.9, rotY: 0, kind: 'neon', palette: ['#4dff9e', '#eae6dc'], text: '天星碼頭 STAR FERRY' });
    ledStrip(K, X - 15, -271.6, X + 15, -271.2, 7.3, 0.22, '#ffe9b0', 0.8);
    ledStrip(K, X - 16.5, -291.8, X - 16.1, -272.2, 7.3, 0.22, '#ffe9b0', 0.7);
    ledStrip(K, X + 16.1, -291.8, X + 16.5, -272.2, 7.3, 0.22, '#ffe9b0', 0.7);
    K.box(X - 14, -318.4, X + 14, -318.1, 5.85, 6.05, { color: '#ffe9b0', style: F.LED, glow: 0.7, collide: false, jitter: 0 });
    for (var lp = 0; lp < 4; lp++) {
      var lpx = X - 12 + lp * 8;
      K.spire(lpx, -318, 0.16, 2.3, 5.6, { color: '#8c9092', style: F.PURE, collide: false });
      K.box(lpx - 0.45, -318.45, lpx + 0.45, -317.55, 5.6, 6.05, { color: '#ffe9b0', style: F.PURE, glow: 0.5, collide: false, jitter: 0 });
    }
    return 1;
  }

  /* ---------------- Avenue of Stars — raised harbour promenade ------------ */
  function buildAvenueOfStars(world, city) {
    var K = kit(city, F.PURE, '#b8ad97', 861, 1, 0.03);
    var pts = [], out = [], i, x;
    for (x = -96; x <= 224; x += 16) {
      pts.push([x, L.northShoreZ(x)]);
      out.push([x, L.northShoreZ(x) + 3.5]);
    }
    /* raised deck straddling the sea wall — walkable top exactly y=2.2 */
    for (i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1], len = Math.sqrt(dx * dx + dz * dz);
      var yaw = Math.atan2(dz, dx);
      var mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      K.rotBox(mx, mz - 1.2, len + 0.5, 7.6, yaw, 1.0, 2.2, { color: '#c9bfa9', style: F.PURE, collide: true });
      /* piles under the seaward overhang */
      K.cyl(mx + dx * 0.2, mz - 3.2, 0.38, -0.6, 1.05, 6, { color: '#6d6a64', style: F.PURE, collide: false, top: false });
      K.cyl(mx - dx * 0.2, mz - 3.2, 0.38, -0.6, 1.05, 6, { color: '#6d6a64', style: F.PURE, collide: false, top: false });
    }
    /* human-scale thin railing (top 0.55 above deck = well below the 3.06 eye line)
       + warm LED handrail strip (Avenue of Stars at night) */
    rail(K, out, 2.2, '#cfd5d3', 8, 0.55);
    for (i = 0; i < out.length - 1; i++) {
      var oa = out[i], ob = out[i + 1];
      var odx = ob[0] - oa[0], odz = ob[1] - oa[1], olen = Math.sqrt(odx * odx + odz * odz);
      K.rotBox((oa[0] + ob[0]) / 2, (oa[1] + ob[1]) / 2, olen, 0.08, Math.atan2(odz, odx), 2.76, 2.84,
        { color: '#ffe9b0', style: F.LED, glow: 0.85, collide: false, jitter: 0 });
    }
    /* star plaques inlaid flush along the harbour edge of the deck */
    for (x = -84; x <= 204; x += 24) {
      var pz = L.northShoreZ(x) + 1.6;
      K.box(x - 0.7, pz - 0.7, x + 0.7, pz + 0.7, 2.2, 2.24, { color: '#c9a55a', style: F.PURE, glow: 0.6, collide: false, jitter: 0 });
    }
    /* Bruce Lee statue on the inner side of the boardwalk (grounded pedestal) */
    var bx = 150, bz = L.northShoreZ(bx) - 3.6, by = 2.2;
    K.box(bx - 1.3, bz - 1.0, bx + 1.3, bz + 1.0, by, by + 0.28, { color: '#4a4a46', style: F.PURE, collide: true });
    K.box(bx - 1.0, bz - 0.8, bx + 1.0, bz + 0.8, by + 0.28, by + 0.72, { color: '#5c5c58', style: F.PURE, collide: true });
    K.collideBox(bx - 1.3, bz - 1.0, bx + 1.3, bz + 1.0, by, by + 0.72, true);
    var fy = by + 0.72;
    /* legs */
    K.box(bx - 0.42, bz - 0.28, bx - 0.06, bz + 0.28, fy, fy + 0.62, { color: '#4f4634', style: F.PURE, collide: false, jitter: 0 });
    K.box(bx + 0.06, bz - 0.28, bx + 0.42, bz + 0.28, fy, fy + 0.62, { color: '#4f4634', style: F.PURE, collide: false, jitter: 0 });
    /* torso + head */
    K.box(bx - 0.42, bz - 0.3, bx + 0.42, bz + 0.3, fy + 0.62, fy + 1.28, { color: '#6b5a3c', style: F.PURE, collide: false, jitter: 0 });
    K.box(bx - 0.24, bz - 0.2, bx + 0.24, bz + 0.2, fy + 1.28, fy + 1.58, { color: '#7a6844', style: F.PURE, collide: false, jitter: 0 });
    /* outstretched arms */
    K.beam([bx - 0.35, fy + 1.2, bz], [bx - 1.25, fy + 0.92, bz + 0.1], 0.2, 0.2, { color: '#6b5a3c', style: F.PURE, glow: 0 });
    K.beam([bx + 0.35, fy + 1.2, bz], [bx + 1.25, fy + 0.92, bz - 0.1], 0.2, 0.2, { color: '#6b5a3c', style: F.PURE, glow: 0 });
    K.sign({ x: bx, z: bz + 1.1, y: fy + 0.2, w: 2.6, h: 0.7, rotY: 0, kind: 'led', palette: ['#eae6dc'], text: '李小龍 BRUCE LEE' });
    /* broad access stairs from the promenade up to the boardwalk */
    function avenueStairs(x0, x1) {
      var zs = L.northShoreZ((x0 + x1) / 2) - 5.0;
      for (var s = 0; s < 3; s++) {
        var za = zs - (3 - s) * 0.9, zb = zs - (2 - s) * 0.9;
        var top = 1.0 + (s + 1) * 0.4;
        K.box(x0, za, x1, zb, 1.0, top, { color: '#c9bfa9', style: F.PURE, collide: false, jitter: 0 });
        K.collideBox(x0, za, x1, zb, 1.0, top, true);
      }
      /* cheek walls */
      K.box(x0 - 0.4, zs - 2.8, x0, zs + 0.2, 1.0, 2.3, { color: '#b0a58f', style: F.PURE, collide: false });
      K.box(x1, zs - 2.8, x1 + 0.4, zs + 0.2, 1.0, 2.3, { color: '#b0a58f', style: F.PURE, collide: false });
    }
    avenueStairs(4, 14);
    avenueStairs(114, 124);
    avenueStairs(178, 188);
    /* avenue sign wall + lamps + benches */
    K.box(-66, L.northShoreZ(-66) - 4.6, -46, L.northShoreZ(-66) - 3.6, 2.2, 3.95, { color: '#9a958c', style: F.STONE, collide: true });
    K.sign({ x: -56, z: L.northShoreZ(-56) - 3.5, y: 3.2, w: 16, h: 1.6, rotY: 0, kind: 'led', palette: ['#ffb547', '#eae6dc'], text: '星光大道 AVENUE OF STARS' });
    for (x = -80; x <= 200; x += 40) {
      var lz = L.northShoreZ(x) + 1.2;
      K.spire(x, lz, 0.16, 2.2, 5.2, { color: '#8c9092', style: F.PURE, collide: false });
      K.box(x - 0.45, lz - 0.45, x + 0.45, lz + 0.45, 5.2, 5.62, { color: '#ffe9b0', style: F.PURE, glow: 0.55, collide: false, jitter: 0 });
      var bzx = L.northShoreZ(x + 10) - 4.6;
      K.box(x + 10, bzx + 0.15, x + 13, bzx + 1.05, 2.2, 2.56, { color: '#7a6a52', style: F.PURE, collide: false });
      K.box(x + 10, bzx - 0.1, x + 13, bzx + 0.16, 2.2, 2.9, { color: '#6a5a44', style: F.PURE, collide: false });
    }
    return 1;
  }

  /* ---------------- Ocean Terminal pier + Harbour City mall -------------- */
  function buildOceanTerminal(world, city) {
    var X = -438, Z = -274, G = 0;
    var K = kit(city, F.PURE, '#b0ada2', 871, 1, 0.03);
    /* piles */
    for (var ix = 0; ix < 5; ix++) {
      for (var iz = 0; iz < 5; iz++) {
        var px = -462 + ix * 12.5, pz = -302 + iz * 14.5;
        if (L.isWater(px, pz)) K.cyl(px, pz, 0.45, -1.8, 1.1, 6, { color: '#6d6a64', style: F.PURE, collide: false, top: false });
      }
    }
    /* pier deck (walkable) */
    K.box(-464, -305, -412, -244, 1.0, 2.4, { color: '#b0ada2', style: F.PURE, collide: true });
    K.box(-464.3, -244.6, -411.7, -243.8, 2.4, 3.0, { color: '#8f8b82', style: F.PURE, collide: false });
    /* cruise terminal shed (west side) */
    K.box(-462, -300, -440, -250, 2.4, 7.8, { color: '#d5d2c8', style: F.INDUSTRIAL, collide: true });
    K.box(-463, -301, -439, -249, 7.8, 8.6, { color: '#e8e8e2', style: F.METAL, collide: false });
    for (var rb = 0; rb < 10; rb++) {
      K.box(-462.6, -299 + rb * 5, -439.4, -297.8 + rb * 5, 8.6, 9.1, { color: '#cfd2cf', style: F.PURE, collide: false, jitter: 0 });
    }
    /* long canopy over the open cruise deck */
    K.box(-440, -296, -414, -252, 6.6, 7.0, { color: '#f0eee6', style: F.PURE, collide: false });
    for (var cc = 0; cc < 4; cc++) {
      for (var c2 = 0; c2 < 5; c2++) {
        var cxp = -435 + cc * 6.5, czp = -292 + c2 * 9.5;
        K.box(cxp - 0.3, czp - 0.3, cxp + 0.3, czp + 0.3, 2.4, 6.6, { color: '#e6e1d4', style: F.PURE, collide: false });
      }
    }
    /* railings + bollards */
    rail(K, [[-464, -244.5], [-412, -244.5]], 2.4, '#cfd5d3', 9);
    rail(K, [[-464, -305], [-464, -244.5]], 2.4, '#cfd5d3', 9);
    rail(K, [[-412, -305], [-412, -244.5]], 2.4, '#cfd5d3', 9);
    for (var bo = 0; bo < 6; bo++) {
      K.cyl(-460 + bo * 9, -245.5, 0.5, 2.4, 3.1, 8, { color: '#4a4a45', style: F.PURE, collide: false });
    }
    K.sign({ x: -426, z: -243.4, y: 5.2, w: 16, h: 2.0, rotY: 0, kind: 'led', palette: ['#3de0ff', '#eae6dc'], text: '海運大廈 OCEAN TERMINAL' });
    ledStrip(K, -463, -249.2, -439, -248.8, 8.7, 0.24, '#3de0ff', 0.8);
    ledStrip(K, -440, -252.6, -414, -252.2, 6.62, 0.2, '#ffe9b0', 0.7);
    ledStrip(K, -464, -244.8, -412, -244.4, 3.0, 0.2, '#ffe9b0', 0.6);
    return 1;
  }

  function buildHarbourCity(world, city) {
    var X = -424, Z = -356, G = ground(world, X, Z);
    var K = kit(city, F.GLASS_SILVER, '#a8bcc0', 881, 1, 0.02);
    /* stepped shopping complex */
    K.box(X - 27, Z - 26, X + 27, Z + 26, G, G + 15, { color: '#a8bcc0', style: F.GLASS_SILVER, seed: 881, collide: true });
    K.box(X - 27, Z - 26, X + 27, Z + 26, G + 15, G + 16.4, { color: '#cfd6d4', style: F.PURE, collide: true });
    K.box(X - 23, Z - 22, X + 23, Z + 22, G + 16.4, G + 21, { color: '#b4c4c6', style: F.GLASS_SILVER, seed: 883, collide: true });
    /* glazed harbour-front atrium */
    K.box(X - 26, Z + 24, X + 26, Z + 29, G, G + 13, { color: '#5f8e96', style: F.GLASS_BLUE, collide: true });
    K.box(X - 26.5, Z + 28.5, X + 26.5, Z + 29.6, G + 13, G + 14, { color: '#d9dfdd', style: F.PURE, collide: false });
    /* Ocean Centre tower */
    K.box(X - 24, Z - 24, X - 4, Z - 4, G + 21, G + 45, { color: '#b0c3c9', style: F.GLASS_SILVER, seed: 885, collide: true });
    K.box(X - 23, Z - 23, X - 5, Z - 5, G + 45, G + 47.6, { color: '#26343f', style: F.LED, glow: 1.8, collide: false });
    K.box(X - 19, Z - 19, X - 9, Z - 9, G + 47.6, G + 49.4, { color: '#c3ced3', style: F.METAL, collide: false });
    K.roofClutter(X - 14, Z - 14, 14, 14, G + 49.4, 887, { collide: false });
    K.beacon(X - 14, G + 52, Z - 14);
    /* second hotel/office block */
    K.box(X + 2, Z - 22, X + 22, Z - 2, G + 21, G + 36, { color: '#c8c2b2', style: F.BANDED, seed: 889, collide: true });
    K.box(X + 3, Z - 21, X + 21, Z - 3, G + 36, G + 37.6, { color: '#cfc8b8', style: F.PURE, collide: true });
    K.roofClutter(X + 12, Z - 12, 14, 14, G + 37.6, 891, { collide: false });
    /* green roof terraces */
    K.box(X - 24, Z + 2, X - 10, Z + 16, G + 21, G + 21.8, { color: '#4c6b3f', style: F.PURE, collide: false, jitter: 0.08 });
    K.box(X + 4, Z + 2, X + 18, Z + 14, G + 21, G + 21.8, { color: '#557547', style: F.PURE, collide: false, jitter: 0.08 });
    K.sign({ x: X, z: Z + 29.8, y: G + 8.5, w: 24, h: 3.0, rotY: 0, kind: 'led', palette: ['#ff4fa3', '#3de0ff'], text: '海港城 HARBOUR CITY' });
    ledStrip(K, X - 26, Z + 29.15, X + 26, Z + 29.55, G + 13.3, 0.24, '#3de0ff', 0.95);
    K.box(X - 23.6, Z - 24, X - 4.4, Z - 23.7, G + 21.4, G + 21.8, { color: '#ffe9b0', style: F.LED, glow: 0.7, collide: false, jitter: 0 });
    K.box(X + 2.4, Z - 22, X + 21.6, Z - 21.7, G + 21.4, G + 21.8, { color: '#ffe9b0', style: F.LED, glow: 0.7, collide: false, jitter: 0 });
    palmRow(K, X - 22, X + 22, Z + 31.5, G, 4.2, 5, 893);
    return 1;
  }

  function buildTSTWaterfront(world, city) {
    var n = 0;
    n += buildCulturalCentre(world, city);
    n += buildClockTower(world, city);
    n += buildSpaceMuseum(world, city);
    n += buildMuseumOfArt(world, city);
    n += buildStarPier(world, city);
    n += buildAvenueOfStars(world, city);
    n += buildOceanTerminal(world, city);
    n += buildHarbourCity(world, city);
    return n;
  }

  /* ==================================================== 3. TST STREETS */

  /* ---------------- The Peninsula — H-plan heritage + tower -------------- */
  function buildPeninsula(world, city) {
    var X = -286, Z = -386, G = ground(world, X, Z);
    var K = kit(city, F.STONE, '#e4ded0', 891, 1, 0.012);

    /* main north block with cornices */
    K.box(X - 21, Z - 14, X + 21, Z - 4, G, G + 14.2, { color: '#e4ded0', style: F.STONE, collide: true });
    for (var b = 0; b < 3; b++) {
      K.box(X - 21.4, Z - 14.4, X + 21.4, Z - 3.6, G + 3.5 + b * 3.5, G + 3.95 + b * 3.5, { color: '#f2eee4', style: F.PURE, collide: false, jitter: 0 });
    }
    K.box(X - 21.4, Z - 14.4, X + 21.4, Z - 3.6, G + 14.2, G + 14.9, { color: '#f2eee4', style: F.PURE, collide: false });
    /* two south-projecting heritage wings (the H plan) */
    K.box(X - 21, Z - 4, X - 8, Z + 11, G, G + 13.2, { color: '#e4ded0', style: F.STONE, collide: true });
    K.box(X + 8, Z - 4, X + 21, Z + 11, G, G + 13.2, { color: '#e4ded0', style: F.STONE, collide: true });
    for (var wb = 0; wb < 2; wb++) {
      var wx = wb === 0 ? X - 21 : X + 8;
      K.box(wx, Z + 10.4, wx + 13, Z + 11.4, G + 13.2, G + 13.8, { color: '#f2eee4', style: F.PURE, collide: false });
      for (var wf = 0; wf < 3; wf++) {
        K.box(wx, Z + 10.6, wx + 13, Z + 11.2, G + 3.6 + wf * 3.4, G + 3.95 + wf * 3.4, { color: '#f2eee4', style: F.PURE, collide: false, jitter: 0 });
      }
    }
    /* central recessed block + blue-and-white awnings */
    K.box(X - 8, Z - 4, X + 8, Z + 2, G, G + 15.0, { color: '#ded8ca', style: F.STONE, collide: true });
    K.box(X - 8, Z + 1.8, X + 8, Z + 3.2, G + 14.4, G + 15.2, { color: '#f1ede2', style: F.PURE, collide: false });
    for (var aw = 0; aw < 7; aw++) {
      K.box(X - 8 + aw * 2.3, Z + 2, X - 5.9 + aw * 2.3, Z + 2.9, G + 2.9, G + 3.9,
        { color: aw % 2 ? '#e8e3d7' : '#3c6ea5', style: F.PURE, collide: false, jitter: 0 });
    }
    /* green copper hipped roofs */
    K.pyramid(X - 14.5, Z + 3.5, 13.2, 15, G + 13.2, G + 15.1, { roofColor: '#4f7f6a', style: F.METAL, collide: true });
    K.pyramid(X + 14.5, Z + 3.5, 13.2, 15, G + 13.2, G + 15.1, { roofColor: '#4f7f6a', style: F.METAL, collide: true });
    K.pyramid(X, Z - 9, 42, 10, G + 14.9, G + 16.4, { roofColor: '#4f7f6a', style: F.METAL, collide: true });
    /* the tower annex behind */
    var TX = X, TZ = -404;
    K.box(TX - 10, TZ - 8, TX + 10, TZ + 8, G, G + 40, { color: '#efeade', style: F.RESI, collide: true });
    for (var s = 0; s < 5; s++) {
      var px = TX - 8 + s * 4;
      K.box(px, TZ + 7.6, px + 1.8, TZ + 8.4, G + 4, G + 38, { color: '#3a4a52', style: F.GLASS_BRONZE, collide: false, jitter: 0 });
      K.box(px, TZ - 8.4, px + 1.8, TZ - 7.6, G + 4, G + 38, { color: '#3a4a52', style: F.GLASS_BRONZE, collide: false, jitter: 0 });
    }
    for (var hb = 0; hb < 4; hb++) {
      K.box(TX - 10.3, TZ - 8.3, TX + 10.3, TZ + 8.3, G + 8 + hb * 8, G + 8.35 + hb * 8, { color: '#f5f1e6', style: F.PURE, collide: false, jitter: 0 });
    }
    K.box(TX - 10.4, TZ - 8.4, TX + 10.4, TZ + 8.4, G + 40, G + 41.7, { color: '#f5f1e6', style: F.PURE, collide: true });
    K.box(TX - 8, TZ - 6, TX + 8, TZ + 6, G + 41.7, G + 44.4, { color: '#efeade', style: F.RESI, collide: true });
    K.box(TX - 5, TZ - 4, TX + 5, TZ + 4, G + 44.4, G + 45.3, { color: '#f5f1e6', style: F.PURE, collide: false });
    K.box(TX - 8.2, TZ + 5.6, TX + 8.2, TZ + 6.3, G + 42, G + 44, { color: '#2b2b28', style: F.PURE, collide: false, jitter: 0 });
    K.roofClutter(TX, TZ, 11, 8, G + 45.3, 895, { collide: false });
    /* warm facade lighting (the Peninsula glows amber at night) */
    for (var up = 0; up < 6; up++) {
      var upx = X - 20 + up * 8;
      K.box(upx, Z + 11.2, upx + 3.4, Z + 11.5, G + 1.4, G + 2.1, { color: '#ffd9a0', style: F.LED, glow: 0.65, collide: false, jitter: 0 });
    }
    K.box(TX - 8.3, TZ - 6.3, TX + 8.3, TZ + 6.3, G + 41.9, G + 42.3, { color: '#ffe9b0', style: F.LED, glow: 0.8, collide: false, jitter: 0 });
    K.sign({ x: X, z: Z + 3.4, y: G + 8.4, w: 12, h: 2.2, rotY: 0, kind: 'led', palette: ['#eae6dc', '#ffd9a0'], text: 'THE PENINSULA 半島酒店' });
    /* forecourt: driveway, fountain, palms, flags */
    K.box(X - 22, Z + 12, X + 22, Z + 26, G, G + 0.22, { color: '#4a4a46', style: F.PURE, collide: false });
    K.cyl(X, Z + 18.5, 5.6, G, G + 0.55, 8, { color: '#cfc6b6', style: F.PURE, collide: false });
    K.cyl(X, Z + 18.5, 4.8, G + 0.3, G + 0.6, 8, { color: '#5b8c8a', style: F.PURE, collide: false });
    K.cyl(X, Z + 18.5, 0.8, G + 0.4, G + 2.4, 6, { color: '#8fb4b2', style: F.PURE, collide: false });
    palm(K, X - 17, Z + 22, G, 4.8, 897);
    palm(K, X + 17, Z + 22, G, 4.8, 898);
    palm(K, X - 17, Z + 13, G, 4.4, 899);
    palm(K, X + 17, Z + 13, G, 4.4, 900);
    for (var fl = 0; fl < 3; fl++) {
      K.spire(X - 6 + fl * 6, Z + 24.5, 0.14, G, G + 8.5, { color: '#c9c4b8', style: F.PURE, collide: false });
      K.box(X - 5.6 + fl * 6, Z + 24.2, X - 4.2 + fl * 6, Z + 24.8, G + 7.4, G + 8.9, { color: '#c0392b', style: F.PURE, collide: false, jitter: 0 });
    }
    return 1;
  }

  /* ---------------- 1881 Heritage — colonial stone block + terraces ------ */
  function buildHeritage1881(world, city) {
    var X = -198, Z = -352, G = ground(world, X, Z);
    var K = kit(city, F.HERITAGE, '#e6e0d2', 901, 1, 0.012);

    K.box(X - 16, Z - 12, X + 2, Z + 9, G, G + 12.6, { color: '#e6e0d2', style: F.HERITAGE, collide: true });
    K.box(X - 16.3, Z - 12.3, X + 2.3, Z + 9.3, G + 12.6, G + 13.3, { color: '#f2eee4', style: F.PURE, collide: false });
    /* arcaded ground floor along the south plaza */
    for (var a = 0; a < 7; a++) {
      var ax = X - 15 + a * 2.5;
      K.box(ax, Z + 8.6, ax + 1.5, Z + 9.8, G, G + 4.0, { color: '#f2eee4', style: F.PURE, collide: false });
    }
    K.box(X - 16, Z + 8.9, X + 2, Z + 10.2, G + 4.0, G + 4.5, { color: '#f2eee4', style: F.PURE, collide: false });
    /* stepped terraces toward the Clock Tower */
    K.box(X + 2, Z - 10, X + 9, Z + 9, G, G + 1.8, { color: '#d8cfc0', style: F.PURE, collide: true });
    K.box(X + 2, Z - 10, X + 9, Z + 9, G + 1.8, G + 2.15, { color: '#c9bfae', style: F.PURE, collide: false });
    K.box(X + 9, Z - 8, X + 14, Z + 9, G, G + 1.1, { color: '#d8cfc0', style: F.PURE, collide: true });
    /* courtyard fountain */
    K.cyl(X - 6, Z + 4, 3.4, G, G + 0.5, 8, { color: '#cfc6b6', style: F.PURE, collide: false });
    K.cyl(X - 6, Z + 4, 2.7, G + 0.3, G + 0.55, 8, { color: '#5b8c8a', style: F.PURE, collide: false });
    /* 1881 sign pillar */
    K.box(X + 4, Z + 2, X + 7.5, Z + 5.5, G, G + 7.6, { color: '#e6e0d2', style: F.STONE, collide: true });
    K.box(X + 4.3, Z + 2.3, X + 7.2, Z + 5.2, G + 4.4, G + 7.2, { color: '#2b2b28', style: F.PURE, collide: false, jitter: 0 });
    K.sign({ x: X + 5.75, z: Z + 5.7, y: G + 5.8, w: 3.8, h: 2.4, rotY: 0, kind: 'led', palette: ['#eae6dc', '#ffd9a0'], text: '1881 HERITAGE' });
    palm(K, X - 13, Z + 6, G, 4.4, 903);
    palm(K, X - 4, Z + 8, G, 4.6, 904);
    palm(K, X + 11, Z + 2, G, 4.2, 905);
    return 1;
  }

  /* ---------------- Chungking Mansions — dense old block + neon ---------- */
  function buildChungking(world, city) {
    var X = -352, Z = -368, G = ground(world, X, Z);
    var K = kit(city, F.RESI_OLD, '#b3a48e', 911, 1, 0.03);

    K.box(X - 17, Z - 15, X + 17, Z + 15, G, G + 43.5, { color: '#b3a48e', style: F.RESI_OLD, seed: 911, collide: true });
    /* top laundry canopy / roof structures */
    K.box(X - 17.4, Z - 15.4, X + 17.4, Z + 15.4, G + 43.5, G + 44.6, { color: '#a89a85', style: F.PURE, collide: true });
    K.box(X - 12, Z - 9, X + 12, Z + 9, G + 44.6, G + 47.6, { color: '#b3a48e', style: F.RESI_OLD, seed: 912, collide: true });
    K.roofClutter(X, Z, 20, 18, G + 47.6, 913, { collide: false });
    K.cyl(X + 9, Z - 6, 1.3, G + 47.6, G + 50.2, 8, { color: '#9aa0a2', style: F.PURE, collide: false });
    K.spire(X - 10, Z - 8, 0.16, G + 47.6, G + 52.5, { color: '#8c9092', style: F.PURE, collide: false });
    /* market podium / awnings on the street side */
    var awnCols = ['#ff4fa3', '#3de0ff', '#ffb547', '#4dff9e', '#d24fff', '#ff4b3e'];
    for (var aw = 0; aw < 7; aw++) {
      K.box(X - 16 + aw * 4.6, Z + 15.2, X - 12 + aw * 4.6, Z + 16.1, G + 2.6, G + 3.6,
        { color: awnCols[aw % awnCols.length], style: F.PURE, collide: false, jitter: 0 });
      K.box(X - 16 + aw * 4.6, Z + 15.0, X - 12 + aw * 4.6, Z + 15.5, G, G + 2.6,
        { color: '#7d7466', style: F.PURE, collide: false, jitter: 0 });
    }
    /* window AC units + balcony slabs (dense Kowloon texture) */
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < 6; c++) {
        var acx = X - 15 + c * 5.6, acy = G + 6 + r * 6.2;
        K.box(acx, Z + 15.45, acx + 1.3, Z + 16.0, acy, acy + 0.7, { color: r % 2 ? '#8d8f8f' : '#a0a2a0', style: F.PURE, collide: false, jitter: 0.05 });
        if (c % 2 === 0) K.box(acx - 0.3, Z + 15.3, acx + 3.2, Z + 16.2, acy + 1.2, acy + 1.55, { color: '#b8ad9a', style: F.PURE, collide: false, jitter: 0 });
      }
    }
    for (var re = 0; re < 5; re++) {
      for (var ce = 0; ce < 4; ce++) {
        var aez = Z - 13 + ce * 6.4, aey = G + 7 + re * 7;
        K.box(X + 17.1, aez, X + 17.7, aez + 1.2, aey, aey + 0.65, { color: '#9a9c9a', style: F.PURE, collide: false, jitter: 0.05 });
      }
    }
    /* rooftop billboards + vertical neon requests */
    K.sign({ x: X - 8, z: Z + 16.6, y: G + 12, w: 4.5, h: 12, rotY: 0, kind: 'vertical', palette: ['#ff4fa3', '#ffb547'], text: '重慶大廈 CHUNGKING' });
    K.sign({ x: X + 6, z: Z + 16.6, y: G + 20, w: 4.0, h: 10, rotY: 0, kind: 'vertical', palette: ['#3de0ff', '#ff4b3e'], text: '咖喱王 CURRY' });
    K.sign({ x: X - 14, z: Z + 16.6, y: G + 26, w: 4.0, h: 9, rotY: 0, kind: 'vertical', palette: ['#4dff9e', '#d24fff'], text: '找換店 MONEY' });
    return 1;
  }

  /* ---------------- K11 MUSEA — sculptural mall over Chatham Road ------- */
  function buildK11Musea(world, city) {
    var G = ground(world, 130, -356);
    var K = kit(city, F.PURE, '#b9a894', 921, 1, 0.02);

    /* west + east ground blocks leave a ground-level corridor for the road */
    K.box(104, -374, 119, -347, G, G + 6, { color: '#a8926f', style: F.PURE, collide: true });
    K.box(129, -374, 153, -347, G, G + 6, { color: '#a8926f', style: F.PURE, collide: true });
    /* glass shopfronts under the bridge */
    K.box(119, -373.6, 129, -372.8, G, G + 5.6, { color: '#2b3a40', style: F.CURTAIN_DARK, collide: false });
    /* the sculptural mall volume spans the road above */
    K.box(102, -374, 154, -346, G + 6, G + 15.6, { color: '#b9a894', style: F.PURE, seed: 921, collide: true });
    K.box(104, -372, 152, -348, G + 15.6, G + 17.2, { color: '#cbbba6', style: F.PURE, seed: 923, collide: true });
    /* stepped green roof terraces */
    K.box(104, -372, 121, -359, G + 17.2, G + 18.2, { color: '#4c6b3f', style: F.PURE, collide: false, jitter: 0.08 });
    K.box(132, -368, 150, -352, G + 17.2, G + 18.2, { color: '#557547', style: F.PURE, collide: false, jitter: 0.08 });
    K.box(121, -365, 130, -357, G + 17.2, G + 18.6, { color: '#c9b6a0', style: F.PURE, collide: false });
    /* copper/terracotta fins + big LED screen on the harbour face */
    for (var f = 0; f < 14; f++) {
      var fx = 103 + f * 3.6;
      K.box(fx, -346.5, fx + 0.55, -345.7, G + 7, G + 15.2, { color: '#c9a55a', style: F.PURE, collide: false, jitter: 0 });
    }
    K.box(134, -346.9, 150, -346.2, G + 8.4, G + 14.2, { color: '#22313a', style: F.LED, glow: 2.2, collide: false, jitter: 0 });
    /* glazed prow pointing at the harbour */
    K.box(106, -346, 120, -340, G, G + 11, { color: '#6f9aa6', style: F.GLASS_BLUE, collide: true });
    K.box(106, -340, 120, -339.2, G + 11, G + 12, { color: '#d9dfdd', style: F.PURE, collide: false });
    /* rooftop mast + planters */
    K.spire(146, -360, 0.2, G + 17.2, G + 23.5, { color: '#8c9092', style: F.PURE, collide: false });
    for (var pl = 0; pl < 4; pl++) {
      K.box(106 + pl * 11, -368, 110 + pl * 11, -364, G + 17.2, G + 18.0, { color: '#557547', style: F.PURE, collide: false, jitter: 0.08 });
    }
    K.sign({ x: 142, z: -345.8, y: G + 15.6, w: 12, h: 2.6, rotY: 0, kind: 'led', palette: ['#c9a55a', '#ff4fa3'], text: 'K11 MUSEA' });
    K.sign({ x: 112, z: -339.2, y: G + 9.0, w: 10, h: 1.8, rotY: 0, kind: 'led', palette: ['#eae6dc', '#3de0ff'], text: 'Victoria Dockside' });
    return 1;
  }

  /* ---------------- Rosewood — tall bronze hotel ------------------------ */
  function buildRosewood(world, city) {
    var X = 165, Z = -377, G = ground(world, X, Z);
    var K = kit(city, F.GLASS_BRONZE, '#8a7a63', 931, 1, 0.02);

    K.box(X - 13, Z - 13, X + 13, Z + 13, G, G + 9, { color: '#a48d6e', style: F.GLASS_BRONZE, seed: 931, collide: true });
    K.box(X - 13.3, Z - 13.3, X + 13.3, Z + 13.3, G + 9, G + 10.2, { color: '#d3c6b4', style: F.PURE, collide: true });
    K.taper(X, Z, 26, 26, 22, 22, G + 10.2, G + 124, 4, { style: F.GLASS_BRONZE, color: '#8a7a63', seed: 933, collide: true });
    for (var ci = 0; ci < 4; ci++) {
      var sx = (ci < 2) ? -1 : 1, sz = (ci % 2 === 0) ? -1 : 1;
      K.beam([X + sx * 13, G + 10.2, Z + sz * 13], [X + sx * 11, G + 124, Z + sz * 11], 0.9, 0.9,
        { color: '#c9b6a0', style: F.PURE, glow: 0 });
    }
    K.box(X - 11.4, Z - 11.4, X + 11.4, Z + 11.4, G + 124, G + 130, { color: '#26343f', style: F.LED, glow: 2.2, collide: false, jitter: 0 });
    K.box(X - 11.2, Z - 11.2, X + 11.2, Z + 11.2, G + 130, G + 131.0, { color: '#c9a55a', style: F.PURE, collide: false });
    K.box(X - 9.4, Z - 9.4, X + 9.4, Z + 9.4, G + 131, G + 133.6, { color: '#a48d6e', style: F.PURE, collide: true });
    K.roofClutter(X, Z, 14, 14, G + 133.6, 935, { collide: false });
    K.beacon(X, G + 136.5, Z);
    K.sign({ x: X, z: Z + 13.4, y: G + 118, w: 9, h: 2.4, rotY: 0, kind: 'led', palette: ['#c9a55a', '#eae6dc'], text: '瑰麗酒店 ROSEWOOD' });
    return 1;
  }

  /* ---------------- K11 tower ------------------------------------------- */
  function buildK11(world, city) {
    var X = 46, Z = -384, G = ground(world, X, Z);
    var K = kit(city, F.GLASS_SILVER, '#aec5d2', 941, 1, 0.02);
    K.box(X - 15, Z - 12, X + 15, Z + 12, G, G + 9, { color: '#a9c3d4', style: F.GLASS_SILVER, seed: 941, collide: true });
    K.box(X - 15.3, Z - 12.3, X + 15.3, Z + 12.3, G + 9, G + 10.2, { color: '#cfd9dd', style: F.PURE, collide: true });
    K.box(X - 13, Z - 10, X + 13, Z + 10, G + 10.2, G + 52, { color: '#aec5d2', style: F.GLASS_SILVER, seed: 943, collide: true });
    K.box(X - 11, Z - 9, X + 11, Z + 9, G + 52, G + 56.5, { color: '#b7ccd6', style: F.GLASS_SILVER, seed: 945, collide: true });
    K.box(X - 9.5, Z - 7.5, X + 9.5, Z + 7.5, G + 56.5, G + 58.0, { color: '#26343f', style: F.LED, glow: 1.9, collide: false });
    K.box(X - 8, Z - 6, X + 8, Z + 6, G + 58, G + 59.4, { color: '#c3ced3', style: F.METAL, collide: false });
    K.roofClutter(X, Z, 10, 8, G + 59.4, 947, { collide: false });
    K.beacon(X, G + 61.5, Z);
    K.sign({ x: X, z: Z + 10.2, y: G + 8.5, w: 7, h: 2.2, rotY: 0, kind: 'led', palette: ['#eae6dc', '#3de0ff'], text: 'K11' });
    return 1;
  }

  /* ---------------- iSQUARE --------------------------------------------- */
  function buildISquare(world, city) {
    var X = -158, Z = -392, G = ground(world, X, Z);
    var K = kit(city, F.GLASS_SILVER, '#b8c8cd', 951, 1, 0.02);
    K.box(X - 13, Z - 12, X + 13, Z + 12, G, G + 10, { color: '#bccdd2', style: F.GLASS_SILVER, seed: 951, collide: true });
    K.taper(X, Z, 26, 24, 20, 19, G + 10, G + 48, 4, { style: F.GLASS_SILVER, color: '#b8c8cd', seed: 953, collide: true });
    K.box(X - 10.4, Z - 9.8, X + 10.4, Z + 9.8, G + 48, G + 52, { color: '#26343f', style: F.LED, glow: 1.9, collide: false, jitter: 0 });
    K.box(X - 8, Z - 7.5, X + 8, Z + 7.5, G + 52, G + 53.4, { color: '#c3ced3', style: F.METAL, collide: false });
    K.roofClutter(X, Z, 9, 8, G + 53.4, 955, { collide: false });
    K.beacon(X, G + 55.4, Z);
    K.sign({ x: X + 6, z: Z + 12.2, y: G + 22, w: 3.2, h: 14, rotY: 0, kind: 'vertical', palette: ['#ff4fa3', '#eae6dc'], text: 'iSQUARE' });
    return 1;
  }

  /* ---------------- The ONE --------------------------------------------- */
  function buildTheOne(world, city) {
    var X = -268, Z = -436, G = ground(world, X, Z);
    var K = kit(city, F.GLASS_BRONZE, '#c9b6a0', 961, 1, 0.02);
    K.box(X - 12, Z - 12, X + 12, Z + 12, G, G + 12, { color: '#c9b6a0', style: F.GLASS_BRONZE, seed: 961, collide: true });
    K.taper(X, Z, 24, 24, 20, 20, G + 12, G + 52, 3, { style: F.GLASS_BRONZE, color: '#c9b6a0', seed: 963, collide: true });
    K.box(X - 10.4, Z - 10.4, X + 10.4, Z + 10.4, G + 52, G + 56, { color: '#26343f', style: F.LED, glow: 1.8, collide: false, jitter: 0 });
    K.box(X - 8, Z - 8, X + 8, Z + 8, G + 56, G + 57.4, { color: '#d3c6b4', style: F.METAL, collide: false });
    K.roofClutter(X, Z, 9, 9, G + 57.4, 965, { collide: false });
    K.beacon(X, G + 59.4, Z);
    K.sign({ x: X + 8, z: Z + 12.2, y: G + 30, w: 3.0, h: 12, rotY: 0, kind: 'vertical', palette: ['#ffb547', '#eae6dc'], text: 'The ONE' });
    return 1;
  }

  /* ---------------- TST / Jordan / Mong Kok neon sign requests ----------- */
  function buildStreetNeon(world, city) {
    var rng = new HK.Rng(0x7a5f);
    var picks = [];
    var front = city.frontage;
    for (var i = 0; i < front.length; i++) {
      var f = front[i];
      if (!f || !f.w) continue;
      var d = f.district || '';
      var keep = (d === 'tst' && f.neon > 0.6) || (d === 'jordan' && f.neon > 0.7) || (d === 'mongkok' && f.neon > 0.9);
      if (!keep) continue;
      if (f.h < 18) continue;
      var dz = f.z + f.d / 2 + 0.3;
      var palettes = [
        ['#ff4fa3', '#eae6dc'], ['#3de0ff', '#eae6dc'], ['#ffb547', '#ff4b3e'],
        ['#4dff9e', '#d24fff'], ['#ff4b3e', '#eae6dc'], ['#d24fff', '#3de0ff']
      ];
      picks.push({ f: f, dz: dz, pal: palettes[Math.floor(rng.next() * palettes.length)] });
      if (picks.length >= 54) break;
    }
    for (var p = 0; p < picks.length; p++) {
      var pick = picks[p], ff = pick.f;
      var vertical = (p % 3) !== 0;
      if (vertical) {
        city.signs.push({
          x: ff.x + ff.w * 0.18, z: pick.dz, y: ff.base + Math.min(ff.h * 0.55, 26),
          w: 2.4 + rng.float(0, 1.2), h: 7 + rng.float(0, 9), rotY: 0, kind: 'vertical',
          palette: pick.pal, seed: ff.seed, text: ''
        });
      } else {
        city.signs.push({
          x: ff.x, z: pick.dz, y: ff.base + Math.min(ff.h * 0.72, 30),
          w: Math.min(ff.w * 0.66, 8), h: 4 + rng.float(0, 3), rotY: 0, kind: 'neon',
          palette: pick.pal, seed: ff.seed, text: ''
        });
      }
    }
    return 0;
  }

  function buildTSTStreets(world, city) {
    var n = 0;
    n += buildPeninsula(world, city);
    n += buildHeritage1881(world, city);
    n += buildChungking(world, city);
    n += buildK11Musea(world, city);
    n += buildRosewood(world, city);
    n += buildK11(world, city);
    n += buildISquare(world, city);
    n += buildTheOne(world, city);
    buildStreetNeon(world, city);
    return n;
  }

  /* ======================================================= 4. HUNG HOM */

  /* ---------------- Hong Kong Coliseum — inverted pyramid ---------------- */
  function buildColiseum(world, city) {
    var X = 396, Z = -438, G = ground(world, X, Z);
    var K = kit(city, F.PURE, '#e2e2de', 971, 1, 0.015);

    /* red-brick plaza apron */
    K.box(X - 22, Z - 22, X + 22, Z + 22, G, G + 0.26, { color: '#a8756a', style: F.PURE, collide: false, jitter: 0.05 });
    /* lobby / foyer block (white bands + glass) */
    K.box(X - 12, Z - 12, X + 12, Z + 12, G, G + 13, { color: '#e6e6e0', style: F.PURE, collide: true });
    K.box(X - 12.4, Z - 12.4, X + 12.4, Z + 12.4, G + 2.6, G + 3.1, { color: '#f2f2ee', style: F.PURE, collide: false });
    K.box(X - 12.4, Z - 12.4, X + 12.4, Z + 12.4, G + 6.2, G + 6.7, { color: '#f2f2ee', style: F.PURE, collide: false });
    K.box(X - 11, Z + 11.4, X + 11, Z + 12.4, G + 3.2, G + 6.1, { color: '#2b3a3f', style: F.CURTAIN_DARK, collide: false });
    K.box(X - 11, Z - 12.4, X + 11, Z - 11.4, G + 3.2, G + 6.1, { color: '#2b3a3f', style: F.CURTAIN_DARK, collide: false });
    /* inverted pyramid: narrow at the bottom, wide at the roof */
    var steps = 6;
    for (var s = 0; s < steps; s++) {
      var w0 = 26 + (44 - 26) * s / steps;
      var w1 = 26 + (44 - 26) * (s + 1) / steps;
      var y0 = G + 13 + s * 3.0, y1 = G + 13 + (s + 1) * 3.0;
      K.box(X - w1 / 2, Z - w1 / 2, X + w1 / 2, Z + w1 / 2, y0, y1 + 0.01,
        { color: s % 2 ? '#e6e6e2' : '#deded9', style: F.PURE, seed: 973 + s, collide: true, jitter: 0.012 });
    }
    /* slim roof rim + flat roof */
    K.box(X - 22.2, Z - 22.2, X + 22.2, Z + 22.2, G + 31, G + 31.45, { color: '#9a9c9a', style: F.METAL, collide: true });
    K.box(X - 21, Z - 21, X + 21, Z + 21, G + 31.45, G + 32.2, { color: '#e0e0dc', style: F.PURE, collide: true });
    /* LED trim on the roof edge + stepped corner light lines */
    for (var lr = 0; lr < 4; lr++) {
      if (lr < 2) K.box(X - 22, Z + (lr === 0 ? -22 : 21.8), X + 22, Z + (lr === 0 ? -21.8 : 22), G + 31.45, G + 31.7, { color: '#ffe9b0', style: F.LED, glow: 0.75, collide: false, jitter: 0 });
      else K.box(X + (lr === 2 ? -22 : 21.8), Z - 22, X + (lr === 2 ? -21.8 : 22), Z + 22, G + 31.45, G + 31.7, { color: '#ffe9b0', style: F.LED, glow: 0.75, collide: false, jitter: 0 });
    }
    for (var cst = 0; cst < 6; cst++) {
      var cw = 26 + (44 - 26) * (cst + 1) / 6, cy = G + 13 + cst * 3;
      for (var cn = 0; cn < 4; cn++) {
        var csx = (cn < 2) ? -1 : 1, csz = (cn % 2 === 0) ? -1 : 1;
        K.box(X + csx * cw / 2 - 0.22, Z + csz * cw / 2 - 0.22, X + csx * cw / 2 + 0.22, Z + csz * cw / 2 + 0.22, cy, cy + 2.6,
          { color: '#ffe9b0', style: F.LED, glow: 0.8, collide: false, jitter: 0 });
      }
    }
    K.roofClutter(X, Z, 30, 30, G + 32.4, 975, { collide: false });
    K.spire(X, Z, 0.35, G + 32.4, G + 39, { color: '#8c9092', style: F.PURE, collide: false });
    K.beacon(X, G + 39.6, Z);
    /* white structural "trees" on the east flank */
    for (var t = 0; t < 3; t++) {
      var tz = Z - 8 + t * 8;
      K.beam([X + 20, G, tz], [X + 15, G + 30, tz + 2], 0.9, 0.9, { color: '#f0f0ec', style: F.PURE, glow: 0 });
      K.beam([X + 20, G + 8, tz + 1], [X + 22, G + 31, tz + 2], 0.5, 0.5, { color: '#f0f0ec', style: F.PURE, glow: 0 });
    }
    K.sign({ x: X, z: Z + 12.6, y: G + 8.4, w: 12, h: 2.2, rotY: 0, kind: 'led', palette: ['#ffd9a0', '#3de0ff'], text: '香港體育館 HONG KONG COLISEUM' });
    return 1;
  }

  /* ---------------- Hung Hom Station ------------------------------------ */
  function buildHungHomStation(world, city) {
    var X = 384, Z = -516, G = ground(world, X, Z);
    var K = kit(city, F.BANDED, '#c5c9c6', 981, 1, 0.02);

    K.box(X - 22, Z - 15, X + 22, Z + 15, G, G + 13.5, { color: '#c5c9c6', style: F.BANDED, seed: 981, collide: true });
    K.box(X - 22, Z + 14, X + 22, Z + 15.2, G + 1.4, G + 10.5, { color: '#2c3a3f', style: F.CURTAIN_DARK, collide: false });
    /* large metal canopy with ribs */
    K.box(X - 25, Z - 18, X + 25, Z + 17, G + 13.5, G + 14.6, { color: '#8f9294', style: F.METAL, collide: true });
    for (var rb = 0; rb < 12; rb++) {
      K.box(X - 24.5, Z - 17 + rb * 3, X + 24.5, Z - 15.8 + rb * 3, G + 14.6, G + 15.3, { color: '#a8acac', style: F.PURE, collide: false, jitter: 0 });
    }
    /* island platforms behind */
    K.box(X - 28, Z - 42, X + 28, Z - 20, G, G + 9, { color: '#b9bebc', style: F.BANDED, seed: 983, collide: true });
    K.box(X - 28, Z - 42, X + 28, Z - 20, G + 9, G + 10.1, { color: '#8f9294', style: F.METAL, collide: true });
    for (var pr = 0; pr < 7; pr++) {
      K.box(X - 27, Z - 40 + pr * 3, X + 27, Z - 39 + pr * 3, G + 10.1, G + 10.8, { color: '#a8acac', style: F.PURE, collide: false, jitter: 0 });
    }
    K.sign({ x: X, z: Z + 15.4, y: G + 6.4, w: 14, h: 2.0, rotY: 0, kind: 'led', palette: ['#3de0ff', '#eae6dc'], text: '紅磡站 HUNG HOM STATION' });
    return 1;
  }

  /* ---------------- The Whampoa — ship-shaped mall ---------------------- */
  function buildWhampoa(world, city) {
    var CX = 518, CZ = -396, G = ground(world, CX, CZ);
    var yaw = 0.633, ca = Math.cos(yaw), sa = Math.sin(yaw);
    function L2W(lx, lz) { return [CX + lx * ca - lz * sa, CZ + lx * sa + lz * ca]; }
    var K = kit(city, F.PURE, '#eae7dd', 991, 1, 0.02);

    /* quay podium */
    K.rotBox(CX, CZ, 58, 24, yaw, G, G + 2.2, { color: '#b8b5a8', style: F.PURE, collide: true });
    /* hull with a pointed bow (prism by plan polygon) */
    var planLoc = [[-26, -8], [20, -8], [27, -4], [31, 0], [27, 4], [20, 8], [-26, 8]];
    var poly = [];
    for (var i = 0; i < planLoc.length; i++) poly.push(L2W(planLoc[i][0], planLoc[i][1]));
    K.prism(poly, G + 2.2, G + 11.2, { color: '#eae7dd', style: F.PURE, seed: 991, collide: true });
    /* blue waterline band + porthole rows */
    K.rotBox(CX, CZ, 52.6, 16.6, yaw, G + 2.4, G + 3.6, { color: '#2c4a63', style: F.PURE, collide: false, jitter: 0 });
    var rowA = L2W(-2, 8.4), rowB = L2W(-2, -8.4);
    K.rotBox(rowA[0], rowA[1], 44, 0.5, yaw, G + 5.2, G + 7.4, { color: '#4a5a62', style: F.PORTHOLE, collide: false, jitter: 0 });
    K.rotBox(rowB[0], rowB[1], 44, 0.5, yaw, G + 5.2, G + 7.4, { color: '#4a5a62', style: F.PORTHOLE, collide: false, jitter: 0 });
    /* superstructure decks */
    K.rotBox(CX, CZ, 42, 12.5, yaw, G + 11.2, G + 14.6, { color: '#f2f0e8', style: F.PURE, collide: true });
    K.rotBox(CX, CZ, 35, 10.5, yaw, G + 14.6, G + 17.4, { color: '#f2f0e8', style: F.PURE, collide: true });
    K.rotBox(CX, CZ, 26, 9, yaw, G + 17.4, G + 20.0, { color: '#efece2', style: F.PURE, collide: true });
    /* bridge */
    var bpos = L2W(9, 0);
    K.rotBox(bpos[0], bpos[1], 9, 8, yaw, G + 20.0, G + 23.2, { color: '#f2f0e8', style: F.PURE, collide: true });
    K.rotBox(bpos[0], bpos[1], 9.4, 4.4, yaw, G + 21.6, G + 22.8, { color: '#2c3a3f', style: F.CURTAIN_DARK, collide: false });
    /* funnel (red + white band) */
    var fpos = L2W(-9, 0);
    K.rotBox(fpos[0], fpos[1], 5.2, 8, yaw, G + 20.0, G + 25.6, { color: '#c8452f', style: F.PURE, collide: true });
    K.rotBox(fpos[0], fpos[1], 5.6, 8.4, yaw, G + 23.4, G + 24.4, { color: '#f2f0e8', style: F.PURE, collide: false });
    /* masts + lifeboats + deck rails */
    var m1 = L2W(22, 0), m2 = L2W(-20, 0);
    K.spire(m1[0], m1[1], 0.22, G + 20.0, G + 30.0, { color: '#c9c4b8', style: F.PURE, collide: false });
    K.spire(m2[0], m2[1], 0.22, G + 17.4, G + 26.0, { color: '#c9c4b8', style: F.PURE, collide: false });
    for (var lb = 0; lb < 3; lb++) {
      var lp = L2W(2 + lb * 6, 6.4);
      K.rotBox(lp[0], lp[1], 3.4, 1.3, yaw, G + 14.8, G + 16.0, { color: '#e07a3c', style: F.PURE, collide: false, jitter: 0 });
    }
    for (var dk = 0; dk < 3; dk++) {
      var dy = G + 11.2 + dk * 3.2, dw = 42 - dk * 7, dd = 12.5 - dk * 1.6;
      var p1 = L2W(-dw / 2, dd / 2), p2 = L2W(dw / 2, dd / 2);
      rail(K, [[p1[0], p1[1]], [p2[0], p2[1]]], dy, '#d8d4c8', 6);
    }
    /* roofline sign */
    K.rotBox(CX, CZ, 30, 1.0, yaw, G + 17.6, G + 20.4, { color: '#26343f', style: F.LED, glow: 1.6, collide: false, jitter: 0 });
    K.sign({ x: CX, z: CZ, y: G + 22.0, w: 20, h: 3.2, rotY: yaw, kind: 'led', palette: ['#ffb547', '#eae6dc'], text: '黃埔號 THE WHAMPOA' });
    return 1;
  }

  /* ---------------- Cross-Harbour Tunnel portal -------------------------- */
  function buildCrossTunnel(world, city) {
    var X = 334, Z = -400, G = ground(world, X, Z);
    var K = kit(city, F.PURE, '#a8a49a', 1001, 1, 0.02);

    /* portal block with two dark tunnel mouths facing the harbour */
    K.box(X - 14, Z - 9, X + 14, Z + 1, G, G + 8.6, { color: '#a8a49a', style: F.PURE, collide: true });
    K.box(X - 14.3, Z - 9.3, X + 14.3, Z + 1.3, G + 8.6, G + 9.6, { color: '#cfcac0', style: F.PURE, collide: true });
    K.box(X - 11.5, Z + 0.8, X - 3.0, Z + 1.5, G, G + 5.4, { color: '#0c0f11', style: F.PURE, collide: false, jitter: 0 });
    K.box(X + 3.0, Z + 0.8, X + 11.5, Z + 1.5, G, G + 5.4, { color: '#0c0f11', style: F.PURE, collide: false, jitter: 0 });
    K.box(X - 2.6, Z + 0.8, X + 2.6, Z + 1.5, G, G + 8.6, { color: '#8f8b82', style: F.PURE, collide: false });
    /* retaining wing walls + approach ramp markings */
    K.box(X - 14, Z - 30, X - 12, Z - 9, G, G + 4.0, { color: '#9a958c', style: F.PURE, collide: true });
    K.box(X + 12, Z - 30, X + 14, Z - 9, G, G + 4.0, { color: '#9a958c', style: F.PURE, collide: true });
    for (var m = 0; m < 6; m++) {
      K.box(X - 10, Z - 16 - m * 4.6, X + 10, Z - 14.4 - m * 4.6, G + 0.05, G + 0.13, { color: '#d8d6cc', style: F.PURE, collide: false, jitter: 0 });
    }
    /* overhead sign gantry */
    K.box(X - 16, Z - 4.5, X - 14.6, Z - 3.1, G, G + 11, { color: '#8c9092', style: F.PURE, collide: false });
    K.box(X + 14.6, Z - 4.5, X + 16, Z - 3.1, G, G + 11, { color: '#8c9092', style: F.PURE, collide: false });
    K.box(X - 16, Z - 5.2, X + 16, Z - 2.8, G + 9.6, G + 11.4, { color: '#2b3a3f', style: F.LED, glow: 1.4, collide: false, jitter: 0 });
    K.sign({ x: X, z: -391, y: G + 10.5, w: 20, h: 2.4, rotY: 0, kind: 'led', palette: ['#ff4b3e', '#eae6dc'], text: '海底隧道 CROSS-HARBOUR TUNNEL' });
    K.sign({ x: X - 7, z: -391.5, y: G + 6.5, w: 5, h: 1.4, rotY: 0, kind: 'neon', palette: ['#ff4b3e', '#eae6dc'], text: '1' });
    K.sign({ x: X + 7, z: -391.5, y: G + 6.5, w: 5, h: 1.4, rotY: 0, kind: 'neon', palette: ['#4dff9e', '#eae6dc'], text: '2' });
    return 1;
  }

  function buildHungHom(world, city) {
    var n = 0;
    n += buildColiseum(world, city);
    n += buildHungHomStation(world, city);
    n += buildWhampoa(world, city);
    n += buildCrossTunnel(world, city);
    return n;
  }

  /* ========================================================= 5. KAI TAK */

  /* ---------------- Kai Tak Cruise Terminal — wavy roof + ring ---------- */
  function buildKaiTakCruise(world, city) {
    var CX = 980, CZ = -255, yaw = 0.637, ca = Math.cos(yaw), sa = Math.sin(yaw);
    function L2W(lx, lz) { return [CX + lx * ca - lz * sa, CZ + lx * sa + lz * ca]; }
    var K = kit(city, F.PURE, '#b8b5a8', 1011, 1, 0.02);

    /* pier deck on piles (walkable) */
    K.rotBox(CX, CZ, 68, 36, yaw, 0.8, 2.6, { color: '#b8b5a8', style: F.PURE, collide: true });
    for (var ix = -3; ix <= 3; ix++) {
      for (var iz = -2; iz <= 2; iz++) {
        var wp = L2W(ix * 9, iz * 7);
        if (L.isWater(wp[0], wp[1])) K.cyl(wp[0], wp[1], 0.45, -1.6, 1.0, 6, { color: '#6d6a64', style: F.PURE, collide: false, top: false });
      }
    }
    /* dark glazed terminal volume */
    K.rotBox(CX, CZ, 56, 26, yaw, 2.6, 11.0, { color: '#2c3f48', style: F.CURTAIN_DARK, collide: true });
    /* LED welcome banner along the face */
    var lp = L2W(0, 13.4);
    K.rotBox(lp[0], lp[1], 30, 0.6, yaw, 4.4, 6.2, { color: '#2c7ff0', style: F.LED, glow: 1.8, collide: false, jitter: 0 });
    /* wavy swooping roof: ribs across the width + skin beams along the length */
    var N = 12;
    var ribTops = [];
    for (var i = 0; i <= N; i++) {
      var lx = -28 + i * (56 / N);
      var t = i / N;
      var ry = 11.0 + 7.2 * (0.5 + 0.5 * Math.sin(t * Math.PI * 1.45 - 0.55));
      var p0 = L2W(lx, -14.5), p1 = L2W(lx, 14.5);
      K.beam([p0[0], ry, p0[1]], [p1[0], ry, p1[1]], 1.5, 1.5, { color: '#e8ecec', style: F.METAL, glow: 0 });
      ribTops.push({ lx: lx, y: ry });
    }
    for (var s = 0; s < N; s++) {
      var a = ribTops[s], b = ribTops[s + 1];
      var q0 = L2W(a.lx, 14.6), q1 = L2W(b.lx, 14.6);
      K.beam([q0[0], a.y, q0[1]], [q1[0], b.y, q1[1]], 0.9, 0.9, { color: '#dfe4e4', style: F.METAL, glow: 0 });
      var r0 = L2W(a.lx, -14.6), r1 = L2W(b.lx, -14.6);
      K.beam([r0[0], a.y, r0[1]], [r1[0], b.y, r1[1]], 0.9, 0.9, { color: '#dfe4e4', style: F.METAL, glow: 0 });
    }
    /* wavy roof skin: longitudinal purlins that close the surface */
    var skinZ = [-10.5, -6.3, -2.1, 2.1, 6.3, 10.5];
    for (var sz = 0; sz < skinZ.length; sz++) {
      for (var ss = 0; ss < N; ss++) {
        var aa = ribTops[ss], bb = ribTops[ss + 1];
        var rpA = L2W(aa.lx, skinZ[sz]), rpB = L2W(bb.lx, skinZ[sz]);
        K.beam([rpA[0], aa.y - 0.25, rpA[1]], [rpB[0], bb.y - 0.25, rpB[1]], 0.5, 0.35, { color: '#eef2f2', style: F.METAL, glow: 0 });
      }
    }
    /* the big circular aperture at the east end */
    var ringC = L2W(27, 0), ringR = 7.6, ringY = 13.4;
    var prev = null;
    for (var rr = 0; rr <= 16; rr++) {
      var ang = rr / 16 * Math.PI * 2;
      var lz = Math.cos(ang) * ringR;
      var py = ringY + Math.sin(ang) * ringR;
      var pw = L2W(27, lz);
      if (prev) K.beam([prev[0], prev[1], prev[2]], [pw[0], py, pw[1]], 1.5, 1.5, { color: '#eef2f2', style: F.METAL, glow: 0 });
      prev = [pw[0], py, pw[1]];
    }
    /* mushroom control tower */
    var tw = L2W(-10, -14);
    K.cyl(tw[0], tw[1], 1.1, 2.6, 21.0, 8, { color: '#cfd4d4', style: F.METAL, collide: true });
    K.cyl(tw[0], tw[1], 3.4, 21.0, 23.4, 12, { color: '#dfe3e3', style: F.PURE, collide: true });
    K.cyl(tw[0], tw[1], 2.4, 23.4, 24.4, 10, { color: '#c5cbcb', style: F.METAL, collide: false });
    K.spire(tw[0], tw[1], 0.18, 24.4, 26.6, { color: '#8c9092', style: F.PURE, collide: false });
    K.beacon(tw[0], 26.9, tw[1]);
    K.roofClutter(CX - 4, CZ + 2, 20, 10, 11.0, 1013, { collide: false });
    K.sign({ x: CX, z: CZ, y: 8.0, w: 18, h: 2.6, rotY: yaw, kind: 'led', palette: ['#3de0ff', '#eae6dc'], text: '啟德郵輪碼頭 KAI TAK CRUISE TERMINAL' });
    return 1;
  }

  /* ---------------- Kai Tak runway markings ----------------------------- */
  function buildRunway(world, city) {
    var A = L.runwayA, B = L.runwayB;
    var dx = B[0] - A[0], dz = B[1] - A[1];
    var len = Math.sqrt(dx * dx + dz * dz), ux = dx / len, uz = dz / len;
    var nx = -uz, nz = ux;
    var yaw = Math.atan2(uz, ux);
    var K = kit(city, F.PURE, '#d8d6cc', 1021, 1, 0.02);
    var i, t, px, pz;

    /* centreline dashes */
    for (i = 0; i < 22; i++) {
      t = 0.06 + i * 0.04;
      px = A[0] + ux * len * t; pz = A[1] + uz * len * t;
      K.rotBox(px, pz, 3.4, 0.55, yaw, 1.02, 1.12, { color: '#d8d6cc', style: F.PURE, collide: false, jitter: 0 });
    }
    /* continuous edge lines */
    for (i = 0; i < 20; i++) {
      t = 0.04 + i * 0.046;
      px = A[0] + ux * len * t + nx * 10.5; pz = A[1] + uz * len * t + nz * 10.5;
      K.rotBox(px, pz, len * 0.048 + 0.2, 0.7, yaw, 1.02, 1.12, { color: '#e2e0d6', style: F.PURE, collide: false, jitter: 0 });
      px = A[0] + ux * len * t - nx * 10.5; pz = A[1] + uz * len * t - nz * 10.5;
      K.rotBox(px, pz, len * 0.048 + 0.2, 0.7, yaw, 1.02, 1.12, { color: '#e2e0d6', style: F.PURE, collide: false, jitter: 0 });
    }
    /* threshold bars at the harbour end */
    for (i = 0; i < 8; i++) {
      px = A[0] + ux * len * 0.93 + nx * (-6.5 + i * 1.9);
      pz = A[1] + uz * len * 0.93 + nz * (-6.5 + i * 1.9);
      K.rotBox(px, pz, 1.2, 2.6, yaw, 1.02, 1.16, { color: '#eceade', style: F.PURE, collide: false, jitter: 0 });
    }
    /* runway edge lights */
    for (i = 0; i < 9; i++) {
      t = 0.08 + i * 0.1;
      px = A[0] + ux * len * t + nx * 10.5; pz = A[1] + uz * len * t + nz * 10.5;
      K.box(px - 0.35, pz - 0.35, px + 0.35, pz + 0.35, 1.1, 1.6, { color: '#ffe9b0', style: F.LED, glow: 1.3, collide: false, jitter: 0 });
      px = A[0] + ux * len * t - nx * 10.5; pz = A[1] + uz * len * t - nz * 10.5;
      K.box(px - 0.35, pz - 0.35, px + 0.35, pz + 0.35, 1.1, 1.6, { color: '#ffe9b0', style: F.LED, glow: 1.3, collide: false, jitter: 0 });
    }
    return 1;
  }

  /* ---------------- Kai Tak Sports Park — pearl stadium ------------------ */
  function buildKaiTakSports(world, city) {
    var X = 1062, Z = -524, G = ground(world, X, Z);
    var K = kit(city, F.PURE, '#9aaec6', 1031, 1, 0.02);
    function oval(rx, rz, n) {
      var p = [];
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2;
        p.push([X + Math.cos(a) * rx, Z + Math.sin(a) * rz]);
      }
      return p;
    }
    /* plaza + stepped base */
    K.prism(oval(35, 28, 24), G, G + 0.4, { color: '#b8ac96', style: F.PURE, collide: false });
    K.prism(oval(33, 26.4, 24), G + 0.4, G + 5.0, { color: '#b0aca3', style: F.PURE, collide: true });
    /* pearl/silver-blue shell with a glass band */
    K.prism(oval(32, 25, 24), G + 5.0, G + 9.0, { color: '#9aaec6', style: F.PURE, seed: 1031, collide: true });
    K.prism(oval(32, 25, 24), G + 9.0, G + 13.4, { color: '#2c3f48', style: F.CURTAIN_DARK, collide: true });
    K.prism(oval(32, 25, 24), G + 13.4, G + 19.0, { color: '#a8b8d0', style: F.PURE, seed: 1033, collide: true });
    /* white segmented roof ring + open pitch */
    K.prism(oval(30.4, 23.4, 24), G + 19.0, G + 20.2, { color: '#e8ecec', style: F.METAL, collide: true });
    for (var lr2 = 0; lr2 < 16; lr2++) {
      var la2 = lr2 / 16 * Math.PI * 2;
      var lx2 = X + Math.cos(la2) * 30.4, lz2 = Z + Math.sin(la2) * 23.4;
      K.box(lx2 - 1.0, lz2 - 1.0, lx2 + 1.0, lz2 + 1.0, G + 19.06, G + 19.5,
        { color: '#cfe4ff', style: F.LED, glow: 0.85, collide: false, jitter: 0 });
    }
    K.prism(oval(21, 15.5, 20), G + 20.2, G + 20.9, { color: '#4c7a3f', style: F.PURE, collide: false });
    /* sliding roof panels */
    K.rotBox(X - 9, Z - 4, 24, 13, 0.08, G + 21.3, G + 22.8, { color: '#f0f2f2', style: F.METAL, collide: false });
    K.rotBox(X + 11, Z + 3, 22, 12, -0.12, G + 21.3, G + 22.8, { color: '#e4e8e8', style: F.METAL, collide: false });
    /* radial white ribs on the roof */
    for (var rb = 0; rb < 10; rb++) {
      var a = rb / 10 * Math.PI * 2;
      K.beam([X + Math.cos(a) * 12, G + 20.4, Z + Math.sin(a) * 9], [X + Math.cos(a) * 29, G + 20.3, Z + Math.sin(a) * 22.5],
        0.7, 0.9, { color: '#f2f4f4', style: F.METAL, glow: 0 });
    }
    /* floodlight masts */
    for (var fm = 0; fm < 4; fm++) {
      var fa = fm / 4 * Math.PI * 2 + 0.5;
      var mx = X + Math.cos(fa) * 30, mz = Z + Math.sin(fa) * 23;
      K.spire(mx, mz, 0.35, G + 19, G + 31, { color: '#b8bebc', style: F.PURE, collide: false });
      K.box(mx - 2.6, mz - 0.6, mx + 2.6, mz + 0.6, G + 29.4, G + 31.2, { color: '#dfe4e4', style: F.METAL, collide: false });
      K.box(mx - 2.2, mz + 0.6, mx + 2.2, mz + 1.0, G + 29.6, G + 30.9, { color: '#fff2cc', style: F.LED, glow: 1.2, collide: false, jitter: 0 });
    }
    /* indoor sports centre beside the stadium */
    K.box(X - 38, Z + 2, X - 18, Z + 22, G, G + 11, { color: '#dfe4e4', style: F.PURE, collide: true });
    K.box(X - 38.4, Z + 1.6, X - 17.6, Z + 22.4, G + 11, G + 12.4, { color: '#c5cbcb', style: F.METAL, collide: true });
    for (var sr = 0; sr < 7; sr++) {
      K.box(X - 37.6, Z + 3 + sr * 2.6, X - 18.4, Z + 4.2 + sr * 2.6, G + 12.4, G + 13.1, { color: '#aeb4b4', style: F.PURE, collide: false, jitter: 0 });
    }
    K.box(X - 37, Z + 21.4, X - 19, Z + 22.4, G + 1.2, G + 8.4, { color: '#2c3a3f', style: F.CURTAIN_DARK, collide: false });
    K.sign({ x: X, z: Z + 25.4, y: G + 16, w: 16, h: 2.6, rotY: 0, kind: 'led', palette: ['#3de0ff', '#eae6dc'], text: '啟德體育園 KAI TAK SPORTS PARK' });
    return 1;
  }

  /* ---------------- Kai Tak residential towers (free frontage spots) ---- */
  function freeSpot(city, x, z, w, d, margin) {
    margin = margin || 4;
    var front = city.frontage;
    for (var i = 0; i < front.length; i++) {
      var f = front[i];
      if (!f || !f.w) continue;
      if (x + w / 2 + margin < f.x - f.w / 2) continue;
      if (x - w / 2 - margin > f.x + f.w / 2) continue;
      if (z + d / 2 + margin < f.z - f.d / 2) continue;
      if (z - d / 2 - margin > f.z + f.d / 2) continue;
      return false;
    }
    if (L.isWater(x, z) || L.isWater(x + w / 2, z + d / 2) || L.isWater(x - w / 2, z - d / 2)) return false;
    return true;
  }

  function buildKaiTakTowers(world, city) {
    var spots = [[1180, -540, 14, 14, 78], [1200, -460, 14, 14, 70], [1100, -440, 14, 14, 64]];
    var n = 0;
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      if (!freeSpot(city, s[0], s[1], s[2], s[3], 4)) continue;
      var G = ground(world, s[0], s[1]);
      beaconTower(kit(city, F.RESI, '#c7c2b6', 1041 + i), s[0], s[1], s[2], s[3], G, s[4], F.RESI, '#c7c2b6', 1041 + i, 'stepped', 1.0);
      n++;
    }
    return n;
  }

  function buildKaiTak(world, city) {
    var n = 0;
    n += buildKaiTakCruise(world, city);
    n += buildRunway(world, city);
    n += buildKaiTakSports(world, city);
    n += buildKaiTakTowers(world, city);
    return n;
  }

  /* ========================================================= 6. MONG KOK */
  function buildMongKok(world, city) {
    var X = 24, Z = -842;
    var G = ground(world, X, Z);
    if (G > 26) {
      HK.log('landmarks-kl: skip Langham Place — anchor terrain height', G, 'at', X, Z, '(Mong Kok hill, layout issue)');
      return 0;
    }
    var K = kit(city, F.GLASS_BLUE, '#a9c3d4', 1051, 1, 0.02);
    K.box(X - 17, Z - 15, X + 17, Z + 15, G, G + 12, { color: '#b9c2c2', style: F.BANDED, seed: 1051, collide: true });
    K.box(X - 15, Z - 14, X + 15, Z + 14, G + 12, G + 14, { color: '#c4cccb', style: F.PURE, collide: true });
    K.taper(X, Z, 26, 26, 22, 22, G + 14, G + 118, 4, { style: F.GLASS_BLUE, color: '#a9c3d4', seed: 1053, collide: true });
    K.box(X - 11.2, Z - 11.2, X + 11.2, Z + 11.2, G + 118, G + 124, { color: '#26343f', style: F.LED, glow: 2.1, collide: false, jitter: 0 });
    K.box(X - 9, Z - 9, X + 9, Z + 9, G + 124, G + 126.4, { color: '#b9c6cc', style: F.METAL, collide: false });
    K.roofClutter(X, Z, 12, 12, G + 126.4, 1055, { collide: false });
    K.beacon(X, G + 130, Z);
    K.sign({ x: X, z: Z + 15.4, y: G + 9.4, w: 14, h: 2.6, rotY: 0, kind: 'led', palette: ['#ff4fa3', '#3de0ff'], text: '朗豪坊 LANGHAM PLACE' });
    return 1;
  }

  /* ===================================================== registration */
  var KL = HK.LandmarksKL = {
    build: function (world, layout) {
      var city = world.city || (world.city = new HK.CityBuilder({ chunkSize: 480 }));
      var q0 = city.stats.quads, b0 = city.stats.boxes;
      var c0 = city.colliders.length, s0 = city.signs.length, be0 = city.beacons.length;
      var count = 0;
      count += buildWKCD(world, city);
      count += buildTSTWaterfront(world, city);
      count += buildTSTStreets(world, city);
      count += buildHungHom(world, city);
      count += buildKaiTak(world, city);
      count += buildMongKok(world, city);
      var out = {
        count: count,
        quads: city.stats.quads - q0,
        boxes: city.stats.boxes - b0,
        colliders: city.colliders.length - c0,
        signs: city.signs.length - s0,
        beacons: city.beacons.length - be0
      };
      HK.log('landmarks-kl:', JSON.stringify(out));
      return out;
    }
  };
})();
