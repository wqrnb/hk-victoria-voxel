/* ============================================================================
 * HK VOXEL HARBOUR — WATER                                 (owner: skyward)
 * ----------------------------------------------------------------------------
 * One large animated harbour plane (y = 0) with:
 *   - animated tiling-wave normals (procedural normal map, no external assets)
 *   - fresnel analytic sky reflection matching HK.Sky colours
 *   - sun / moon glitter paths, broken-sparkle highlight
 *   - jade-teal harbour body colour, depth graded through the shore mask
 *   - night: broken vertical neon streaks inferred from a procedural skyline
 *     light field (no real reflections required)
 *   - shore foam from an optional shore mask, rain ripples, mist flattening
 *
 * Colour space: all colours passed through env are LINEAR; this shader writes
 * linear HDR radiance and lets HK.Post tone-map. Textures generated here are
 * procedural and stored as linear data (no sRGB encoding).
 *
 * Public API (docs/INTERFACES.md):
 *   var water = HK.Water.create({ scene, renderer, quality });
 *   water.update(dt, state, focus, env);
 *   water.setShoreMask(canvasOrTexture, { minX, maxX, minZ, maxZ });
 *   water.setQuality(q); water.uniforms; water.mesh; water.dispose();
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, T = window.THREE;
  if (!HK || !T) { console.error('[HK.Water] requires core.js and three.js'); return; }
  var U = HK.Util;
  var GAMMA = 2.2;

  function linHex(hex) {
    var c = U.hexRgb(hex);
    return new T.Color(Math.pow(c[0], GAMMA), Math.pow(c[1], GAMMA), Math.pow(c[2], GAMMA));
  }

  /* ==========================================================================
   * Procedural textures
   * ========================================================================*/

  /** Tiling water normal map from a sum of integer-frequency waves. */
  function makeNormalTexture(size) {
    var canvas = U.makeCanvas(size, size);
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(size, size);
    var data = img.data;
    var rng = new HK.Rng(0x0CEA11);
    var waves = [];
    var tries = 0;
    while (waves.length < 60 && tries < 600) {
      tries++;
      var kx = rng.int(-13, 13), ky = rng.int(-13, 13);
      if (kx === 0 && ky === 0) continue;
      var k = Math.sqrt(kx * kx + ky * ky);
      if (k > 13) continue;
      waves.push({ kx: kx, ky: ky, a: 1 / Math.pow(k, 1.42), ph: rng.float(0, Math.PI * 2) });
    }
    var total = 0, i;
    for (i = 0; i < waves.length; i++) total += waves[i].a;
    for (i = 0; i < waves.length; i++) waves[i].a /= total;

    var gx = new Float32Array(size * size);
    var gy = new Float32Array(size * size);
    var maxAbs = 1e-6;
    var TWO_PI = Math.PI * 2;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var sx = 0, sy = 0;
        for (i = 0; i < waves.length; i++) {
          var w = waves[i];
          var ang = TWO_PI * (w.kx * x / size + w.ky * y / size) + w.ph;
          var c = Math.cos(ang) * w.a;
          sx += c * w.kx;
          sy += c * w.ky;
        }
        var idx = y * size + x;
        gx[idx] = sx;
        gy[idx] = sy;
        var a1 = Math.abs(sx), a2 = Math.abs(sy);
        if (a1 > maxAbs) maxAbs = a1;
        if (a2 > maxAbs) maxAbs = a2;
      }
    }
    var slopeScale = 0.62 / maxAbs;
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        var id2 = y * size + x;
        var nx = -gx[id2] * slopeScale;
        var nz = -gy[id2] * slopeScale;
        var inv = 1 / Math.sqrt(nx * nx + nz * nz + 1);
        nx *= inv; nz *= inv;
        var o = id2 * 4;
        data[o] = Math.round((nx * 0.5 + 0.5) * 255);
        data[o + 1] = Math.round((nz * 0.5 + 0.5) * 255);
        data[o + 2] = Math.round((inv * 0.5 + 0.5) * 255);
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var tex = new T.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.encoding = T.LinearEncoding;
    return tex;
  }

  /** Tiling fractal noise used for foam breakup / sparkle / neon shatter. */
  function makeNoiseTexture(size, seed) {
    var canvas = U.makeCanvas(size, size);
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(size, size);
    var data = img.data;
    function h(ix, iy, P, s) {
      ix = ((ix % P) + P) % P;
      iy = ((iy % P) + P) % P;
      return U.hash2(ix + s * 131, iy + s * 719);
    }
    function pnoise(x, y, P, s) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = h(xi, yi, P, s), b = h(xi + 1, yi, P, s), c = h(xi, yi + 1, P, s), d = h(xi + 1, yi + 1, P, s);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var n = 0, nb = 0, amp = 0.55, f = 3, o;
        for (o = 0; o < 4; o++) {
          n += amp * pnoise(x / size * f, y / size * f, f, seed + o);
          nb += amp * pnoise(x / size * f + 5.3, y / size * f + 2.7, f, seed + 31 + o);
          f *= 2; amp *= 0.5;
        }
        var v2 = U.clamp((n - 0.30) * 2.1, 0, 1);
        v2 = U.clamp(v2 * 0.82 + U.hash2(x + seed * 17, y * 7 + seed) * 0.22, 0, 1);
        var v3 = U.clamp((nb - 0.30) * 2.1, 0, 1);
        var v4 = U.hash2(x * 3 + 11, y * 3 + seed);
        var idx = (y * size + x) * 4;
        data[idx] = Math.round(v2 * 255);
        data[idx + 1] = Math.round(v3 * 255);
        data[idx + 2] = Math.round(v4 * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var tex = new T.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.encoding = T.LinearEncoding;
    return tex;
  }

  /** 1-D (wrapped) skyline light field: warm windows + coloured neon columns. */
  function makeSkylineTexture(w, seed) {
    w = w || 1024;
    var hgt = 4;
    var canvas = U.makeCanvas(w, hgt);
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(w, hgt);
    var data = img.data;
    var rng = new HK.Rng(seed || 0x5C17);
    function gauss1(u, c, s) {
      var d = Math.abs(u - c);
      if (d > 0.5) d = 1 - d;
      return Math.exp(-(d * d) / (2 * s * s));
    }
    var clusters = [
      [0.250, 0.075, 1.0], [0.750, 0.075, 1.0],
      [0.045, 0.045, 0.55], [0.445, 0.055, 0.6], [0.945, 0.05, 0.6],
      [0.155, 0.035, 0.35], [0.845, 0.04, 0.45], [0.345, 0.03, 0.3], [0.655, 0.03, 0.3]
    ];
    var neon = [
      [0.2350, 0.0045, '#3de0ff', 1.0], [0.2460, 0.0030, '#ff4fa3', 0.95],
      [0.2590, 0.0055, '#ffb547', 0.9], [0.7290, 0.0040, '#d24fff', 0.95],
      [0.7405, 0.0055, '#3de0ff', 1.0], [0.7530, 0.0030, '#ffffff', 1.0],
      [0.7640, 0.0045, '#ff4b3e', 0.9], [0.7770, 0.0030, '#ffb547', 0.85],
      [0.0510, 0.0035, '#ff4b3e', 0.7], [0.4380, 0.0040, '#4dff9e', 0.7],
      [0.9320, 0.0030, '#3de0ff', 0.7], [0.1980, 0.0025, '#ffffff', 0.75],
      [0.8060, 0.0025, '#ff4fa3', 0.7], [0.6820, 0.0020, '#ffb547', 0.6],
      [0.3100, 0.0025, '#3de0ff', 0.6], [0.5750, 0.0020, '#ffffff', 0.55]
    ];
    for (var x = 0; x < w; x++) {
      var u = (x + 0.5) / w;
      var dens = 0.14;
      for (var c = 0; c < clusters.length; c++) dens += clusters[c][2] * gauss1(u, clusters[c][0], clusters[c][1]);
      dens = U.clamp(dens, 0, 1.35);
      var base = dens * (0.09 + 0.15 * rng.next());
      var r = base * 1.0, g = base * 0.68, b = base * 0.40;
      // warm window speckle
      if (rng.next() < 0.55 * dens) {
        var wb = (0.35 + 0.65 * rng.next()) * dens;
        var warm = rng.next() < 0.72;
        if (warm) { r += wb * 1.0; g += wb * 0.62; b += wb * 0.26; }
        else { r += wb * 0.55; g += wb * 0.72; b += wb * 0.95; }
      }
      // broad cool office towers
      if (rng.next() < 0.10 * dens) { var cb = (0.3 + 0.5 * rng.next()) * dens; r += cb * 0.5; g += cb * 0.66; b += cb * 0.9; }
      // neon columns (wrapped gaussians)
      for (var n = 0; n < neon.length; n++) {
        var ne = neon[n];
        var g1 = gauss1(u, ne[0], ne[1]) * ne[3];
        var g2 = gauss1(u, ne[0], ne[1] * 7.0) * ne[3] * 0.22;
        var cc = U.hexRgb(ne[2]);
        var inten = Math.min(1, g1 * 1.0 + g2);
        r += cc[0] * inten; g += cc[1] * inten; b += cc[2] * inten;
      }
      r = Math.min(1, r); g = Math.min(1, g); b = Math.min(1, b);
      for (var row = 0; row < hgt; row++) {
        var o = (row * w + x) * 4;
        // subtle row variation so a future 2-D sample still reads as lights
        var rv = 1 - row * 0.04;
        data[o] = Math.round(r * rv * 255);
        data[o + 1] = Math.round(g * rv * 255);
        data[o + 2] = Math.round(b * rv * 255);
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var tex = new T.CanvasTexture(canvas);
    tex.wrapS = T.RepeatWrapping;
    tex.wrapT = T.ClampToEdgeWrapping;
    tex.minFilter = T.LinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = false;
    tex.encoding = T.LinearEncoding;
    return tex;
  }

  /* ==========================================================================
   * Shaders
   * ========================================================================*/
  var WATER_VERT = [
    'varying vec3 vWorld;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorld = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var WATER_FRAG = [
    'precision highp float;',
    'varying vec3 vWorld;',
    'uniform sampler2D uNormalTex, uNoiseTex, uSkylineTex, uMaskTex;',
    'uniform vec3 uSunDir, uMoonDir;',
    'uniform vec3 uSunColor, uMoonColor, uZenith, uHorizon, uHorizonCool, uFogColor, uCityGlow;',
    'uniform vec3 uDeep, uShallow, uFoamColor;',
    'uniform float uSunI, uMoonI, uNight, uMist, uRain, uFlash, uFogDensity, uSunWarmth;',
    'uniform float uMaskOn, uDetail, uNeonStrength, uTime, uMaskShoreB, uMaskScale;',
    'uniform sampler2D uFoamTex;',
    'uniform float uFoamOn;',
    'uniform vec4 uMaskBounds;',
    'uniform vec2 uFocus, uWind;',

    'float hash21(vec2 p) {',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',

    'void main() {',
    '  vec3 toEye = cameraPosition - vWorld;',
    '  float dist = length(toEye);',
    '  vec3 V = toEye / max(dist, 0.0001);',
    '  vec2 p = vWorld.xz;',
    '  float t = uTime;',
    '  float farFade = smoothstep(420.0, 2100.0, dist);',
    '  float midFade = smoothstep(1300.0, 4200.0, dist);',

    // --- animated normals from a tiling wave normal map (3 scales)
    '  float waveStr = mix(0.78, 0.24, uMist * 0.85) * (1.0 + uRain * 0.30 - uNight * 0.12);',
    '  vec2 wind = uWind;',
    '  vec2 warpUv = p * 0.0016 + vec2(t * 0.0030, -t * 0.0022);',
    '  vec2 warp = (texture2D(uNoiseTex, warpUv).rg - 0.5) * vec2(155.0, 125.0);',
    '  vec2 pw = p + warp;',
    '  vec2 qp = vec2(pw.x - pw.y, pw.x + pw.y) * 0.7071;',
    '  vec3 n1 = texture2D(uNormalTex, pw * 0.0068 + wind * t * 0.0034).xyz * 2.0 - 1.0;',
    '  vec3 n2 = texture2D(uNormalTex, qp * 0.0132 - vec2(wind.y, wind.x) * t * 0.0062 + vec2(0.31, 0.17)).xyz * 2.0 - 1.0;',
    '  vec2 slope = n1.xy * 0.42 + n2.xy * 0.22;',
    '  if (uDetail > 1.5) {',
    '    vec3 n3 = texture2D(uNormalTex, qp * 0.0460 + vec2(wind.y, -wind.x) * t * 0.016 + vec2(0.71, 0.43)).xyz * 2.0 - 1.0;',
    '    slope += n3.xy * 0.12 * (1.0 - midFade);',
    '  }',
    '  slope *= waveStr * (1.0 - farFade * 0.82);',
    // --- rain: fine choppy ripples + a second detail layer
    '  if (uRain > 0.01) {',
    '    vec3 nr = texture2D(uNormalTex, pw * 0.34 + vec2(0.0, t * 0.55)).xyz * 2.0 - 1.0;',
    '    slope += nr.xy * 0.16 * uRain * (1.0 - farFade);',
    '  }',
    '  vec3 Nraw = normalize(vec3(-slope.x, 1.0, -slope.y));',
    '  vec3 N = Nraw;',
    '  N = normalize(mix(N, vec3(0.0, 1.0, 0.0), clamp(farFade * 1.7, 0.0, 0.95)));',
    '  vec3 Rg = reflect(-V, Nraw);',
    '  float ndv = clamp(dot(N, V), 0.0, 1.0);',
    '  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);',
    '  fres = clamp(fres * (1.0 + uRain * 0.20), 0.0, 1.0);',

    // --- shore mask
    '  float shallow = 0.18;',
    '  float shoreG = 1.0;',
    '  float land = 0.0;',
    '  if (uMaskOn > 0.5) {',
    '    vec2 mwarp = (texture2D(uNoiseTex, p * 0.0105 + vec2(t * 0.002, -t * 0.0015)).rg - 0.5) * 0.006;',
    '    vec2 muv = (p - uMaskBounds.xy) * uMaskBounds.zw + mwarp;',
    '    if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) {',
    // Multi-tap blurred land mask: gives a smooth shoreline factor with no 8-bit
    // distance-band contouring (the old G/B distance channels could band into
    // "painted lane" stripes along the coast).
    '      float l0 = texture2D(uMaskTex, muv).r;',
    '      float l1 = texture2D(uMaskTex, muv + vec2(0.0045, 0.0)).r;',
    '      float l2 = texture2D(uMaskTex, muv - vec2(0.0045, 0.0)).r;',
    '      float l3 = texture2D(uMaskTex, muv + vec2(0.0, 0.0045)).r;',
    '      float l4 = texture2D(uMaskTex, muv - vec2(0.0, 0.0045)).r;',
    '      float l5 = texture2D(uMaskTex, muv + vec2(0.014, 0.008)).r;',
    '      float l6 = texture2D(uMaskTex, muv + vec2(-0.014, -0.008)).r;',
    '      float l7 = texture2D(uMaskTex, muv + vec2(0.014, -0.008)).r;',
    '      float l8 = texture2D(uMaskTex, muv + vec2(-0.014, 0.008)).r;',
    '      float landAvg = (l0 + l1 + l2 + l3 + l4) * 0.2;',
    '      float farAvg = (l5 + l6 + l7 + l8) * 0.25;',
    '      land = l0;',
    '      float shoreSmooth = clamp((1.0 - landAvg) * landAvg * 5.0, 0.0, 1.0);',
    '      shoreG = 1.0 - shoreSmooth;',
    '      float shoreNess = clamp(landAvg * 1.35 + farAvg * 0.85, 0.0, 1.0);',
    '      shallow = clamp(shoreNess * 1.55 - 0.10 + (texture2D(uNoiseTex, p * 0.021 + vec2(t * 0.004)).g - 0.5) * 0.26, 0.0, 1.0);',
    '    }',
    '  }',
    '  shallow *= (1.0 - uNight * 0.35);',

    // --- sky reflection
    '  vec3 R = reflect(-V, N);',
    '  float upR = clamp(R.y, 0.0, 1.0);',
    '  vec3 hdir = normalize(vec3(R.x, 0.0, R.z) + vec3(0.0001, 0.0, 0.0001));',
    '  vec3 sdirXZ = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(0.0001, 0.0, 0.0001));',
    '  float warmR = pow(max(dot(hdir, sdirXZ), 0.0), 2.6) * uSunWarmth;',
    '  vec3 horizonC = mix(uHorizonCool, uHorizon, clamp(warmR, 0.0, 1.0));',
    '  vec3 sky = mix(horizonC, uZenith, pow(upR, 0.55));',
    '  float hzR = 1.0 - smoothstep(0.0, 0.35, upR);',
    '  sky = mix(sky, horizonC, hzR * 0.25);',
    '  sky = mix(uFogColor, sky, smoothstep(-0.06, 0.045, R.y));',
    '  float sunR = max(dot(R, uSunDir), 0.0);',
    '  sky += uSunColor * (pow(sunR, 18.0) * 0.30 + pow(sunR, 220.0) * 1.4) * uSunI * 0.16;',
    '  float moonR = max(dot(R, uMoonDir), 0.0);',
    '  sky += uMoonColor * (pow(moonR, 80.0) * 0.8 + pow(moonR, 700.0) * 3.2) * uNight;',

    // --- water body colour
    '  vec3 body = mix(uDeep, uShallow, shallow * 0.72 + 0.10);',
    '  body += uShallow * 0.22 * pow(1.0 - ndv, 3.0) * (1.0 - uNight);',
    '  body *= 0.82 * (1.0 - uRain * 0.15 - uMist * 0.10);',

    // --- compose
    '  vec3 col = mix(body, sky, fres);',

    // --- sun glitter (sharp broken sparkle path)
    '  float sparkA = texture2D(uNoiseTex, p * 0.145 + vec2(t * 0.020, -t * 0.014)).r;',
    '  float sparkB = texture2D(uNoiseTex, p * 0.31 - vec2(t * 0.031, t * 0.023)).g;',
    '  float sparkle = smoothstep(0.60, 0.98, sparkA * 0.58 + sparkB * 0.62);',
    '  float sunRg = max(dot(Rg, uSunDir), 0.0);',
    '  float glint = pow(sunRg, 90.0);',
    '  float moonRg = max(dot(Rg, uMoonDir), 0.0);',
    '  float moonGlint = pow(moonRg, 480.0);',
    '  col += uSunColor * uSunI * glint * (0.05 + sparkle * 0.55) * (1.0 - midFade * 0.80) * (1.0 - uMist * 0.7 - uRain * 0.35);',
    '  col += uSunColor * uSunI * (pow(sunRg, 4.0) * 0.075 + pow(sunRg, 2.0) * 0.028) * (1.0 - uMist * 0.6);',
    '  col += uMoonColor * moonGlint * (0.08 + sparkle * 0.30) * 0.50 * uNight * (1.0 - midFade * 0.75);',

    // --- night neon reflection streaks (procedural skyline light field)
    '  if (uNight > 0.01) {',
    // stable unperturbed reflection direction -> long vertical streaks that do not boil
    '    vec3 R0 = reflect(-V, vec3(0.0, 1.0, 0.0));',
    '    float az = atan(R0.z, R0.x);',
    '    float u = az * 0.15915494 + 0.5;',
    '    vec3 lights = texture2D(uSkylineTex, vec2(u, 0.5)).rgb;',
    '    float ry = max(R0.y, 0.0);',
    '    float band = exp(-ry * 10.0) * smoothstep(-0.02, 0.02, R0.y);',
    '    vec2 rxz = normalize(R0.xz + vec2(0.0001));',
    '    float shoreDir = smoothstep(0.04, 0.62, abs(rxz.y));',
    '    float wob = texture2D(uNoiseTex, vec2(u * 5.0 + t * 0.004, p.x * 0.0045 + p.y * 0.0045 + t * 0.012)).r;',
    '    float wob2 = texture2D(uNoiseTex, vec2(u * 14.0, p.x * 0.016 + p.y * 0.013 - t * 0.02)).r;',
    '    float breakup = smoothstep(0.24, 0.68, wob * 0.72 + wob2 * 0.28 + 0.20);',
    '    breakup = mix(0.82, breakup, clamp(1.0 - farFade * 1.15, 0.0, 1.0));',
    '    vec3 neon = lights * band * shoreDir * breakup * uNight * uNeonStrength;',
    '    col += neon * (0.32 + fres * 1.55) + neon * 0.10;',
    '    col += uCityGlow * band * shoreDir * uNight * 0.16;',
    '  }',

    // --- shore foam
    '  if (uMaskOn > 0.5) {',
    '    float shoreBand = smoothstep(0.15, 0.008, shoreG) * (1.0 - land);',
    '    if (shoreBand > 0.001) {',
    // domain-warped fine noise -> salt-and-pepper foam, plus a large-scale patch mask
    '      vec2 fw = (texture2D(uNoiseTex, p * 0.0063 + vec2(t * 0.004, -t * 0.003)).rg - 0.5) * 26.0;',
    '      float fn = texture2D(uNoiseTex, (p + fw) * 0.052 + vec2(t * 0.013, -t * 0.009)).r;',
    '      float fn2 = texture2D(uNoiseTex, (p + fw) * 0.173 + vec2(-t * 0.020, t * 0.012)).g;',
    '      float patchN = texture2D(uNoiseTex, p * 0.0039 + vec2(t * 0.002, t * 0.0012)).g;',
    '      float speck = smoothstep(0.50, 0.82, fn * 0.55 + fn2 * 0.55 + patchN * 0.22);',
    '      if (uFoamOn > 0.5) {',
    '        float lace = texture2D(uFoamTex, p * 0.020 + vec2(t * 0.004, -t * 0.003)).r;',
    '        float lace2 = texture2D(uFoamTex, p * 0.011 + vec2(-t * 0.002, t * 0.0025)).r;',
    '        speck = max(speck, smoothstep(0.28, 0.62, lace * 0.62 + lace2 * 0.5) * (1.0 - farFade));',
    '      }',
    '      float foam = speck * shoreBand * shoreBand;',
    '      vec3 fc = uFoamColor * (0.42 + 0.30 * (1.0 - uNight));',
    '      col = mix(col, fc, clamp(foam, 0.0, 0.42));',
    '    }',
    '  }',

    // --- mist films the surface, rain darkens it
    '  col = mix(col, uFogColor, uMist * 0.16 * smoothstep(300.0, 2600.0, dist));',
    '  col *= 1.0 - uRain * 0.16;',

    // --- lightning flash reflects across the harbour
    '  col += uFlash * (uCityGlow * 0.55 + vec3(0.55, 0.62, 0.78)) * (0.30 + fres * 0.6);',

    // --- exponential squared fog to the horizon (matches THREE.FogExp2)
    '  float fd = dist * uFogDensity;',
    '  float fogF = 1.0 - exp(-fd * fd);',
    '  fogF = max(clamp(fogF, 0.0, 1.0), smoothstep(2400.0, 4200.0, dist));',
    '  col = mix(col, uFogColor, fogF);',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ==========================================================================
   * Water instance
   * ========================================================================*/
  function Water(opts) {
    opts = opts || {};
    this.scene = opts.scene;
    this.renderer = opts.renderer;
    this.quality = HK.QUALITY[opts.quality] ? opts.quality : 'high';
    this._elapsed = 0;
    this._maskTex = null;
    this._ownsMask = false;

    var maxAniso = 4;
    try { if (this.renderer) maxAniso = this.renderer.capabilities.getMaxAnisotropy(); } catch (e) {}

    this.normalTex = makeNormalTexture(256);
    this.normalTex.anisotropy = maxAniso;
    this.noiseTex = makeNoiseTexture(256, 29);
    this.noiseTex.anisotropy = maxAniso;
    this.skylineTex = makeSkylineTexture(1024, 0x5C17);

    var fallbackSun = linHex('#ffab5e');
    var fallbackHorizon = linHex('#ffb470');
    var fallbackZenith = linHex('#2a5688');

    this.uniforms = {
      uNormalTex: { value: this.normalTex },
      uNoiseTex: { value: this.noiseTex },
      uSkylineTex: { value: this.skylineTex },
      uMaskTex: { value: makeSkylineTexture(4, 1) }, // replaced only when a mask is set
      uFoamTex: { value: (HK.Textures && HK.Textures.foam) ? HK.Textures.foam : makeNoiseTexture(4, 1) },
      uFoamOn: { value: (HK.Textures && HK.Textures.foam) ? 1 : 0 },
      uMaskOn: { value: 0 },
      uMaskShoreB: { value: 0 },
      uMaskScale: { value: 1 },
      uMaskBounds: { value: new T.Vector4(-1500, -1000, 1 / 3000, 1 / 2000) },
      uSunDir: { value: new T.Vector3(0, 0.1, -1) },
      uMoonDir: { value: new T.Vector3(0, 0.6, 1) },
      uSunColor: { value: fallbackSun.clone() },
      uMoonColor: { value: new T.Color(0.5, 0.6, 0.9) },
      uZenith: { value: fallbackZenith },
      uHorizon: { value: fallbackHorizon },
      uHorizonCool: { value: linHex('#8ca3b2') },
      uSunWarmth: { value: 1.0 },
      uFogColor: { value: fallbackHorizon.clone() },
      uCityGlow: { value: new T.Color(0.15, 0.1, 0.06) },
      uDeep: { value: linHex('#164446') },
      uShallow: { value: linHex('#3f7a63') },
      uFoamColor: { value: linHex('#f0e2cc') },
      uSunI: { value: 2.7 },
      uMoonI: { value: 0.0 },
      uNight: { value: 0.0 },
      uMist: { value: 0.0 },
      uRain: { value: 0.0 },
      uFlash: { value: 0.0 },
      uFogDensity: { value: 0.00022 },
      uDetail: { value: 2 },
      uNeonStrength: { value: 1.0 },
      uTime: { value: 0 },
      uFocus: { value: new T.Vector2(0, 0) },
      uWind: { value: new T.Vector2(0.25, 0.10) }
    };

    this.material = new T.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      fog: false,
      toneMapped: false,
      side: T.FrontSide
    });

    var geo = new T.PlaneGeometry(4800, 3200, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new T.Mesh(geo, this.material);
    this.mesh.name = 'harbourWater';
    this.mesh.position.set(0, 0, 0);
    this.mesh.frustumCulled = false;
    if (this.scene) this.scene.add(this.mesh);
    this.setQuality(this.quality);
  }

  Water.prototype.setQuality = function (q) {
    if (!HK.QUALITY[q]) q = 'high';
    this.quality = q;
    var detailMap = { low: 1, medium: 2, high: 3, ultra: 3 };
    this.uniforms.uDetail.value = detailMap[q] || 2;
  };

  /**
   * mask: canvas / Image / Texture.  R channel = land (1) / water (0).
   *       G channel = shore distance, 0 at the shoreline, rising to >=1 at ~60
   *       world units offshore.
   * bounds: { minX, maxX, minZ, maxZ } world-space rectangle covered by mask.
   */
  Water.prototype.setShoreMask = function (mask, bounds, opts) {
    if (this._ownsMask && this._maskTex && this._maskTex !== this.uniforms.uMaskTex.value) {
      this._maskTex.dispose();
    }
    this._ownsMask = false;
    if (!mask) {
      this.uniforms.uMaskOn.value = 0;
      this._maskTex = null;
      return;
    }
    opts = opts || {};
    var shoreChannel = opts.shoreChannel || null;   // 'g' (default contract) or 'b' (terrain.js layout)
    var shoreScale = opts.shoreScale != null ? opts.shoreScale : null;
    // Auto-detect the mask convention from a 2-D canvas: some layout generators store
    // the offshore distance in B (0 at shore -> 1 far) and shore proximity in G.
    if (!shoreChannel && mask && mask.getContext && mask.width > 4) {
      try {
        var ctx = mask.getContext('2d');
        var img = ctx.getImageData(0, 0, mask.width, mask.height).data;
        var n = 0, gSum = 0, bSum = 0;
        var stepX = Math.max(1, Math.floor(mask.width / 48));
        var stepY = Math.max(1, Math.floor(mask.height / 48));
        for (var yy = 0; yy < mask.height; yy += stepY) {
          for (var xx = 0; xx < mask.width; xx += stepX) {
            var o = (yy * mask.width + xx) * 4;
            if (img[o] > 128) continue;           // water pixels only
            gSum += img[o + 1]; bSum += img[o + 2]; n++;
          }
        }
        if (n > 50) {
          var gAvg = gSum / n, bAvg = bSum / n;
          if (bAvg > gAvg + 12) { shoreChannel = 'b'; shoreScale = shoreScale || 2.2; }
          else { shoreChannel = 'g'; shoreScale = shoreScale || 1.0; }
        }
      } catch (e) { /* tainted canvas or no 2d context: keep defaults */ }
    }
    if (!shoreChannel) shoreChannel = 'g';
    if (shoreScale == null) shoreScale = 1.0;
    this.uniforms.uMaskShoreB.value = shoreChannel === 'b' ? 1 : 0;
    this.uniforms.uMaskScale.value = shoreScale;
    var tex;
    if (mask.isTexture) {
      tex = mask;
      if (mask.flipY !== false) mask.flipY = false;
      mask.needsUpdate = true;
    } else {
      tex = new T.CanvasTexture(mask);
      tex.flipY = false;                    // canvas row 0 == minZ edge
      tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
      tex.minFilter = T.LinearFilter;
      tex.magFilter = T.LinearFilter;
      tex.generateMipmaps = false;
      tex.encoding = T.LinearEncoding;
      this._ownsMask = true;
      this._maskTex = tex;
    }
    this.uniforms.uMaskTex.value = tex;
    this.uniforms.uMaskOn.value = 1;
    if (bounds) {
      var minX = bounds.minX != null ? bounds.minX : -1500;
      var maxX = bounds.maxX != null ? bounds.maxX : 1500;
      var minZ = bounds.minZ != null ? bounds.minZ : -1000;
      var maxZ = bounds.maxZ != null ? bounds.maxZ : 1000;
      this.uniforms.uMaskBounds.value.set(minX, minZ, 1 / Math.max(1e-6, maxX - minX), 1 / Math.max(1e-6, maxZ - minZ));
    }
  };

  Water.prototype._focusXZ = function (focus) {
    var fx = 0, fz = 0;
    if (focus) {
      if (focus.isVector3 || (focus.x !== undefined && focus.z !== undefined)) {
        fx = focus.x || 0; fz = focus.z || 0;
      } else if (focus.position) {
        fx = focus.position.x || 0; fz = focus.position.z || 0;
      }
    }
    return [fx, fz];
  };

  Water.prototype.update = function (dt, state, focus, env) {
    dt = U.clamp(dt || 0.016, 0, 0.1);
    this._elapsed += dt;
    var u = this.uniforms;
    u.uTime.value = this._elapsed;

    var f = this._focusXZ(focus);
    u.uFocus.value.set(f[0], f[1]);
    u.uWind.value.set(0.25 + (env && env.rain ? env.rain * 0.35 : 0), 0.10);

    if (env) {
      if (env.sunDir) u.uSunDir.value.copy(env.sunDir);
      if (env.moonDir) u.uMoonDir.value.copy(env.moonDir);
      if (env.sunColor) u.uSunColor.value.copy(env.sunColor);
      if (env.moonColor) u.uMoonColor.value.copy(env.moonColor);
      if (env.zenithColor) u.uZenith.value.copy(env.zenithColor);
      if (env.horizonColor) u.uHorizon.value.copy(env.horizonColor);
      if (env.horizonCool) u.uHorizonCool.value.copy(env.horizonCool);
      if (env.sunWarmth != null) u.uSunWarmth.value = env.sunWarmth;
      if (env.fogColor) u.uFogColor.value.copy(env.fogColor);
      if (env.cityGlow) u.uCityGlow.value.copy(env.cityGlow);
      if (env.waterDeep) u.uDeep.value.copy(env.waterDeep);
      if (env.waterShallow) u.uShallow.value.copy(env.waterShallow);
      if (env.foamColor) u.uFoamColor.value.copy(env.foamColor);
      if (env.sunIntensity != null) u.uSunI.value = env.sunIntensity;
      if (env.moonIntensity != null) u.uMoonI.value = env.moonIntensity;
      if (env.night != null) u.uNight.value = env.night;
      if (env.mist != null) u.uMist.value = env.mist;
      else u.uMist.value = env.weather === 'mist' ? 1 : 0;
      if (env.rain != null) u.uRain.value = env.rain;
      else u.uRain.value = env.weather === 'rain' ? 1 : 0;
      if (env.flash != null) u.uFlash.value = env.flash;
      if (env.fogDensity != null) u.uFogDensity.value = env.fogDensity;
      u.uNeonStrength.value = 0.9 + u.uNight.value * 1.7;
    }
    if (state && state.photo) {
      // cleaner photo look: slightly stronger glitter, fewer ripples handled by Post
      u.uNeonStrength.value *= 1.0;
    }
    return u;
  };

  Water.prototype.dispose = function () {
    if (this.scene && this.mesh.parent) this.scene.remove(this.mesh);
    if (this.mesh) this.mesh.geometry.dispose();
    if (this.material) this.material.dispose();
    if (this.normalTex) this.normalTex.dispose();
    if (this.noiseTex) this.noiseTex.dispose();
    if (this.skylineTex) this.skylineTex.dispose();
    if (this._ownsMask && this._maskTex) this._maskTex.dispose();
    if (this.uniforms.uMaskTex.value && this.uniforms.uMaskTex.value !== this._maskTex) this.uniforms.uMaskTex.value.dispose();
  };

  HK.Water = {
    create: function (opts) { return new Water(opts); },
    makeNormalTexture: makeNormalTexture,
    makeNoiseTexture: makeNoiseTexture,
    makeSkylineTexture: makeSkylineTexture,
    version: '1.1.0'
  };
})();
