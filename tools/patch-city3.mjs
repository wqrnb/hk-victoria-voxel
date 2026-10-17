// Layout height realism, facade style mix, distant range calm-down.
import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  let miss = 0;
  for (const [a, b] of pairs) { const before = s; s = s.replace(a, b); if (s === before) { miss++; console.log('MISS', file, JSON.stringify(a.slice(0, 70))); } }
  fs.writeFileSync(file, s);
  console.log(file, miss ? miss + ' misses' : 'ok');
}

// district heights
let layoutSrc = fs.readFileSync('js/layout.js', 'utf8');
const heights = {
  kennedy: [12, 70], sheungwan: [14, 95], central: [24, 205], admiralty: [22, 180],
  wanchai: [18, 150], causeway: [15, 110], northpoint: [16, 125], quarrybay: [18, 130],
  saikeiwan: [12, 80], chaiwan: [10, 72], peakmid: [8, 55], westkl: [12, 95],
  westkowloon: [16, 200], tst: [14, 95], jordan: [12, 70], mongkok: [12, 85],
  shamshuipo: [10, 72], homantin: [8, 70], hunghom: [14, 105], tokwawan: [10, 65],
  kaitak: [10, 95], kowloonbay: [12, 90], kwuntong: [10, 100], klhills: [8, 34]
};
let n = 0;
for (const [id, [minH, maxH]] of Object.entries(heights)) {
  const re = new RegExp("(id: '" + id + "'[^\\n]*?minH: )\\d+(, maxH: )\\d+");
  if (re.test(layoutSrc)) { layoutSrc = layoutSrc.replace(re, '$1' + minH + '$2' + maxH); n++; }
  else console.log('MISS district', id);
}
fs.writeFileSync('js/layout.js', layoutSrc);
console.log('layout districts patched', n);

patch('js/buildings.js', [
  [
    '  function pickStyle(dist, h, rng) {\n    if (h > 95 && rng.chance(0.72)) return rng.pick(GLASSY);',
    '  function pickStyle(dist, h, rng) {\n    var oldTown = dist.id === \'tst\' || dist.id === \'jordan\' || dist.id === \'mongkok\' || dist.id === \'shamshuipo\' || dist.id === \'hunghom\' || dist.id === \'tokwawan\' || dist.id === \'kennedy\' || dist.id === \'sheungwan\';\n    if (oldTown && rng.chance(0.5)) return rng.pick(dist.styles);\n    if (h > 95 && rng.chance(0.72)) return rng.pick(GLASSY);'
  ]
]);

patch('js/terrain.js', [
  [
    "    var far = U.hexRgb('#3c4a4d'), far2 = U.hexRgb('#334248'), far3 = U.hexRgb('#465459');\n    ridge(-2800, 2800, -2700, -1060, 60, 150, 520, far);\n    ridge(-2800, 2800, 1060, 2700, 60, 170, 560, far2);\n    ridge(-2800, -2050, -1400, 1400, 60, 120, 420, far3);\n    ridge(2050, 2800, -1400, 1400, 60, 120, 380, far3);\n    ridge(-4600, 4600, -4600, -2800, 96, 260, 760, U.hexRgb('#2c3a40'));\n    ridge(-4600, 4600, 2800, 4600, 96, 280, 800, U.hexRgb('#2a373d'));",
    "    var far = U.hexRgb('#7d939e'), far2 = U.hexRgb('#889ca6'), far3 = U.hexRgb('#93a5ad');\n    ridge(-3400, 3400, -3400, -1800, 76, 120, 340, far);\n    ridge(-3400, 3400, 1800, 3400, 76, 135, 360, far2);\n    ridge(-3400, -2400, -2300, 2300, 76, 100, 280, far3);\n    ridge(2400, 3400, -2300, 2300, 76, 100, 260, far3);\n    ridge(-5600, 5600, -5400, -3400, 120, 220, 560, U.hexRgb('#6c838f'));\n    ridge(-5600, 5600, 3400, 5400, 120, 240, 600, U.hexRgb('#677e8a'));"
  ]
]);
