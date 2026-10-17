// One-shot visual tuning pass: facade AA, richer colours, proportions, palettes.
import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  let miss = 0;
  for (const [a, b] of pairs) {
    const before = s;
    s = s.replace(a, b);
    if (s === before) { miss++; console.log('MISS', file, JSON.stringify(a.slice(0, 80))); }
  }
  fs.writeFileSync(file, s);
  console.log(file, miss ? miss + ' misses' : 'ok');
}

patch('js/landmarkkit.js', [
  [
    '    var mat = new THREE.MeshStandardMaterial({\n      vertexColors: true,\n      roughness: 0.6,\n      metalness: 0.25\n    });\n    mat.onBeforeCompile = function (shader) {',
    '    var mat = new THREE.MeshStandardMaterial({\n      vertexColors: true,\n      roughness: 0.6,\n      metalness: 0.25\n    });\n    mat.extensions = { derivatives: true };\n    mat.onBeforeCompile = function (shader) {'
  ],
  [
    '  vec3 glass = baseCol * 0.12 + uSkyTint * 0.4;',
    '  vec3 glass = baseCol * 0.26 + uSkyTint * 0.34;'
  ],
  [
    '    glass = mix(baseCol * 0.16, uSkyTint * 0.62, 0.5) + fres * uSkyTint * 0.38;\n    frame = baseCol * 0.72;',
    '    glass = mix(baseCol * 0.30, uSkyTint * 0.74, 0.55) + fres * uSkyTint * 0.30;\n    frame = baseCol * 0.84;'
  ],
  [
    '    glass = mix(baseCol * 0.18, uSkyTint * vec3(0.52, 0.82, 0.78), 0.55) + fres * vec3(0.5, 0.8, 0.8) * 0.4;',
    '    glass = mix(baseCol * 0.3, uSkyTint * vec3(0.55, 0.84, 0.8), 0.55) + fres * vec3(0.5, 0.8, 0.8) * 0.32;'
  ],
  [
    '    glass = baseCol * 0.18 + uSkyTint * 0.16 + fres * 0.35;',
    '    glass = baseCol * 0.32 + uSkyTint * 0.3 + fres * 0.28;'
  ],
  [
    '    albedo = mix(baseCol, glass * 0.7, win);',
    '    albedo = mix(baseCol, glass, win);'
  ],
  [
    '    glass = baseCol * 0.25 + uSkyTint * 0.15;',
    '    glass = baseCol * 0.3 + uSkyTint * 0.22;'
  ],
  [
    '    glass = baseCol * 0.32 + uSkyTint * 0.22;',
    '    glass = baseCol * 0.34 + uSkyTint * 0.26;'
  ],
  [
    '  // ground grime + facade noise\n',
    '  // screen-space distance fade: distant facades dissolve into their average\n  // tone instead of aliasing into black-and-white moiré at skyline distance\n  float winAA = 1.0 - smoothstep(0.22, 1.15, max(fwidth(uv.x), fwidth(uv.y)));\n  vec3 facadeAvg = mix(frame, glass, 0.38);\n  albedo = mix(facadeAvg, albedo, winAA);\n  rough = mix(0.55, rough, winAA);\n  metal = mix(0.22, metal, winAA);\n  emis *= mix(0.4, 1.0, winAA);\n\n  // ground grime + facade noise\n'
  ]
]);

patch('js/buildings.js', [
  [
    '  function pickStyle(dist, h, rng) {',
    '  function richColor(hex, rng) {\n    var c = U.hexRgb(hex);\n    var l = U.lum(c);\n    c = [l + (c[0] - l) * 1.22, l + (c[1] - l) * 1.22, l + (c[2] - l) * 1.22];\n    c = U.shadeRgb(c, rng.float(0.8, 0.94));\n    return c;\n  }\n  function pickStyle(dist, h, rng) {'
  ],
  [
    '      var style = pickStyle(dist, Hh, rng);\n      var colorHex = dist.colors[Math.floor(rng.next() * dist.colors.length) % dist.colors.length];\n      var seed = rng.int(1, 99999);\n      var K = new HK.Kit(city, { style: style, color: colorHex, seed: seed, glow: 1 });\n      var wallCol = U.hexRgb(colorHex);',
    '      var style = pickStyle(dist, Hh, rng);\n      var colorHex = dist.colors[Math.floor(rng.next() * dist.colors.length) % dist.colors.length];\n      var seed = rng.int(1, 99999);\n      var colorRgb = richColor(colorHex, rng);\n      var K = new HK.Kit(city, { style: style, color: colorRgb, seed: seed, glow: 1 });\n      var wallCol = colorRgb;'
  ],
  [
    '      var Hh = dist.minH + (dist.maxH - dist.minH) * Math.pow(rng.next(), 1.45) * (0.5 + B.heightField(x, z) * 0.85);\n      if (rng.chance(0.02 + B.heightField(x, z) * 0.02)) Hh *= 1.35;\n      Hh = Math.round(U.clamp(Hh, dist.minH, dist.maxH * 1.2));',
    '      var Hh = dist.minH + (dist.maxH - dist.minH) * Math.pow(rng.next(), 1.65) * (0.46 + B.heightField(x, z) * 0.78);\n      if (rng.chance(0.008 + B.heightField(x, z) * 0.01)) Hh *= 1.3;\n      Hh = Math.round(U.clamp(Hh, dist.minH, Math.min(196, dist.maxH * 1.05)));'
  ],
  [
    '      var scale = 1.5 + (1 - dist.density) * 0.7;',
    '      var scale = 1.95 + (1 - dist.density) * 0.55;'
  ]
]);

patch('js/terrain.js', [
  ["TYPE_PAL[T.PLOT] = pal('#4b4741', 1, 0.04);", "TYPE_PAL[T.PLOT] = pal('#3e3c37', 1, 0.04);"],
  ["TYPE_PAL[T.ROAD] = pal('#34373c', 1, 0.03);", "TYPE_PAL[T.ROAD] = pal('#2b2d31', 1, 0.03);"],
  ["TYPE_PAL[T.ROAD_MAIN] = pal('#303339', 1, 0.03);", "TYPE_PAL[T.ROAD_MAIN] = pal('#26282c', 1, 0.03);"],
  ["TYPE_PAL[T.SIDEWALK] = pal('#8e8b83', 1, 0.04);", "TYPE_PAL[T.SIDEWALK] = pal('#75726b', 1, 0.04);"],
  ["TYPE_PAL[T.PROMENADE] = pal('#b1a38b', 2, 0.04);", "TYPE_PAL[T.PROMENADE] = pal('#968770', 2, 0.04);"],
  ["TYPE_PAL[T.PLAZA] = pal('#a19c92', 1, 0.035);", "TYPE_PAL[T.PLAZA] = pal('#8a867f', 1, 0.035);"],
  ["TYPE_PAL[T.TERRACE] = pal('#8b8880', 1, 0.04);", "TYPE_PAL[T.TERRACE] = pal('#79766f', 1, 0.04);"],
  ["TYPE_PAL[T.PARK] = pal('#526d42', 3, 0.06);", "TYPE_PAL[T.PARK] = pal('#49623a', 3, 0.06);"],
  ["TYPE_PAL[T.LAWN] = pal('#6c804d', 3, 0.05);", "TYPE_PAL[T.LAWN] = pal('#5f7444', 3, 0.05);"],
  ["TYPE_PAL[T.FOREST] = pal('#2f4a2e', 4, 0.07);", "TYPE_PAL[T.FOREST] = pal('#293f28', 4, 0.07);"],
  ["TYPE_PAL[T.WALL] = pal('#747169', 2, 0.04);", "TYPE_PAL[T.WALL] = pal('#68655e', 2, 0.04);"]
]);

// QA lighting more representative of final exposure
for (const f of ['qa/hk.html', 'qa/city.html']) {
  patch(f, [
    ['new THREE.HemisphereLight(night ? 0x22334a : 0xbfd4e0, night ? 0x090b0e : 0x4a443a, night ? 0.7 : 1.0)',
     'new THREE.HemisphereLight(night ? 0x22334a : 0xb4cad8, night ? 0x090b0e : 0x403a32, night ? 0.55 : 0.62)'],
    ['night ? 0x8fa8d0 : 0xffe2b8, night ? 0.35 : 2.0', 'night ? 0x8fa8d0 : 0xffe0b2, night ? 0.3 : 1.55'],
    ['renderer.toneMappingExposure = 1.0;', 'renderer.toneMappingExposure = 0.92;']
  ]);
}
