// Gamma-correct authored colours + city density / low-rise fabric + hero QA views.
import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  let miss = 0;
  for (const [a, b] of pairs) { const before = s; s = s.replace(a, b); if (s === before) { miss++; console.log('MISS', file, JSON.stringify(a.slice(0, 70))); } }
  fs.writeFileSync(file, s);
  console.log(file, miss ? miss + ' misses' : 'ok');
}

// --- core: authored sRGB -> linear working space (renderer outputs sRGB) ----
patch('js/core.js', [
  [
    '  var colorCache = {};\n  U.hexRgb = function (hex) {\n    if (typeof hex !== \'string\') return [hex[0], hex[1], hex[2]];\n    if (colorCache[hex]) return colorCache[hex];\n    var h = hex.replace(\'#\', \'\');\n    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];\n    var n = parseInt(h, 16);\n    var c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];\n    colorCache[hex] = c;\n    return c;\n  };',
    '  var colorCache = {};\n  U.srgbToLinear = function (c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };\n  U.linearToSrgb = function (c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };\n  U.hexRgb = function (hex) {\n    if (typeof hex !== \'string\') return [hex[0], hex[1], hex[2]];\n    if (colorCache[hex]) return colorCache[hex];\n    var h = hex.replace(\'#\', \'\');\n    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];\n    var n = parseInt(h, 16);\n    var c = [U.srgbToLinear(((n >> 16) & 255) / 255), U.srgbToLinear(((n >> 8) & 255) / 255), U.srgbToLinear((n & 255) / 255)];\n    colorCache[hex] = c;\n    return c;\n  };'
  ]
]);

// --- buildings: calibrated palettes, density, low-rise street fabric --------
patch('js/buildings.js', [
  [
    '    c = U.shadeRgb(c, rng.float(0.8, 0.94));\n    return c;',
    '    c = U.shadeRgb(c, rng.float(0.92, 1.08));\n    return c;'
  ],
  [
    '    var tint = env && (env.horizonColor || env.skyHorizon);\n    if (tint) _uniforms.uSkyTint.value.copy(tint);\n    else _uniforms.uSkyTint.value.setRGB(0.62, 0.76, 0.85).multiplyScalar(1 - night * 0.8);',
    '    var tint = env && (env.horizonColor || env.skyHorizon);\n    if (tint) {\n      _uniforms.uSkyTint.value.copy(tint);\n      if (!env.colorsLinear) _uniforms.uSkyTint.value.convertSRGBToLinear();\n    } else {\n      _uniforms.uSkyTint.value.setRGB(0.62, 0.76, 0.85).multiplyScalar(1 - night * 0.8);\n    }'
  ],
  [
    '      var step = dist.density > 0.9 ? 7 : (dist.density > 0.7 ? 8 : 10);',
    '      var step = dist.density > 0.9 ? 6 : (dist.density > 0.7 ? 7 : 9);'
  ],
  [
    '      var scale = 1.95 + (1 - dist.density) * 0.55;',
    '      var scale = 1.72 + (1 - dist.density) * 0.5;'
  ],
  [
    '    HK.log(\'city: buildings\', placed, \'attempts\', attempts);',
    '    // ---- second pass: low-rise street fabric fills the gaps between towers\n' +
    '    var lowRng = new HK.Rng(0x51ED270B);\n' +
    '    var lowPlaced = 0;\n' +
    '    function lowRiseOK(x0, z0, w, d, allowTerrace, minH, maxH2) {\n' +
    '      if (w < 3 || d < 3) return false;\n' +
    '      if (x0 < MINX + 2 || z0 < MINZ + 2 || x0 + w > maxX - 2 || z0 + d > maxZ - 2) return false;\n' +
    '      for (var z = z0; z <= z0 + d; z += 1) {\n' +
    '        for (var x = x0; x <= x0 + w; x += 1) {\n' +
    '          var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);\n' +
    '          var n = j * W + i;\n' +
    '          var t = typeArr[n];\n' +
    '          if (t !== T.PLOT && (!allowTerrace || t !== T.TERRACE)) return false;\n' +
    '          if (flagArr[n] & RESERVED) return false;\n' +
    '          if (occ[n]) return false;\n' +
    '        }\n' +
    '      }\n' +
    '      return true;\n' +
    '    }\n' +
    '    for (var di2 = 0; di2 < L.DISTRICTS.length; di2++) {\n' +
    '      var dist2 = L.DISTRICTS[di2];\n' +
    '      var rect2 = dist2.rect;\n' +
    '      if (dist2.density < 0.55) continue;\n' +
    '      var r2 = new HK.Rng((U.hashStr(dist2.id) ^ 0x9e3779b9) >>> 0);\n' +
    '      var step2 = dist2.density > 0.9 ? 4 : 5;\n' +
    '      for (var gz2 = rect2[1] + 2; gz2 < rect2[3] - 4; gz2 += step2) {\n' +
    '        for (var gx2 = rect2[0] + 2; gx2 < rect2[2] - 4; gx2 += step2) {\n' +
    '          var x2 = gx2 + r2.float(-1.5, 1.5), z2 = gz2 + r2.float(-1.5, 1.5);\n' +
    '          var n2 = idx(x2, z2);\n' +
    '          if (n2 < 0) continue;\n' +
    '          var t2 = typeArr[n2];\n' +
    '          if (t2 !== T.PLOT && t2 !== T.TERRACE) continue;\n' +
    '          if (occ[n2] || (flagArr[n2] & RESERVED)) continue;\n' +
    '          if (!r2.chance(0.62)) continue;\n' +
    '          var lw = r2.int(4, 10), ld = r2.int(4, 10);\n' +
    '          var x0b = Math.round(x2 - lw / 2), z0b = Math.round(z2 - ld / 2);\n' +
    '          if (!lowRiseOK(x0b, z0b, lw, ld, false, null, null)) continue;\n' +
    '          markOcc(x0b, z0b, lw, ld);\n' +
    '          var lowH = r2.int(3, 11);\n' +
    '          var lowSeed = r2.int(1, 99999);\n' +
    '          var lowCol = richColor(dist2.colors[r2.int(0, dist2.colors.length - 1)], r2);\n' +
    '          var lowStyle = r2.pick([F.PUNCHED, F.RESI_OLD, F.RESI, F.INDUSTRIAL, F.BANDED]);\n' +
    '          var lk = new HK.Kit(city, { style: lowStyle, color: lowCol, seed: lowSeed });\n' +
    '          var gy = Math.max(1, world.heightAt(x2, z2));\n' +
    '          lk.boxC(x2, z2, lw, ld, gy - 0.8, gy + lowH, { style: lowStyle, color: lowCol, roofColor: U.shadeRgb(lowCol, 0.62), seed: lowSeed });\n' +
    '          if (r2.chance(0.6)) lk.boxC(x2, z2, lw - 1.5, ld - 1.5, gy + lowH, gy + lowH + 0.8, { color: U.shadeRgb(lowCol, 0.55), style: F.PURE, collide: false });\n' +
    '          if (r2.chance(0.35)) city.signs.push({ x: x2, z: z2, w: lw, d: ld, base: gy, top: gy + lowH, district: dist2.id, seed: lowSeed, neon: dist2.neon });\n' +
    '          city.frontage.push({ x: x2, z: z2, w: lw, d: ld, base: gy, top: gy + lowH, district: dist2.id, neon: dist2.neon, seed: lowSeed, style: lowStyle, h: lowH });\n' +
    '          lowPlaced++;\n' +
    '        }\n' +
    '      }\n' +
    '    }\n' +
    '    placed += lowPlaced;\n' +
    '    HK.log(\'city: buildings\', placed, \'(low-rise\', lowPlaced + \')\', \'attempts\', attempts);'
  ]
]);

// --- QA views + light calibration -----------------------------------------
patch('qa/hk.html', [
  [
    "  } else if (view === 'top') {",
    "  } else if (view === 'hero') {\n    camera.position.set(30, 22, -344);\n    camera.lookAt(-120, 82, 392);\n  } else if (view === 'hero2') {\n    camera.position.set(-60, 150, -700);\n    camera.lookAt(-150, 70, 380);\n  } else if (view === 'top') {"
  ],
  [
    'night ? 0x8fa8d0 : 0xffe0b2, night ? 0.3 : 1.55',
    'night ? 0x8fa8d0 : 0xffe0b2, night ? 0.45 : 3.1'
  ],
  [
    'night ? 0x22334a : 0xb4cad8, night ? 0x090b0e : 0x403a32, night ? 0.55 : 0.62',
    'night ? 0x22334a : 0xb4cad8, night ? 0x090b0e : 0x403a32, night ? 0.7 : 1.0'
  ]
]);
