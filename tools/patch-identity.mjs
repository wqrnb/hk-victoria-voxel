import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8'); let miss=0;
  for (const [a,b] of pairs){const before=s;s=s.replace(a,b);if(s===before){miss++;console.log('MISS',file,JSON.stringify(a.slice(0,70)));}}
  fs.writeFileSync(file,s); console.log(file, miss?miss+' misses':'ok');
}
// cap procedural heights so landmarks dominate the skyline
let lay = fs.readFileSync('js/layout.js','utf8'); let n=0;
const heights = { central:[24,140], admiralty:[22,128], wanchai:[18,118], causeway:[15,96], northpoint:[16,108], quarrybay:[18,118], sheungwan:[14,86], kennedy:[12,64], westkowloon:[16,170], tst:[14,78], hunghom:[14,88], jordan:[12,62], mongkok:[12,72], shamshuipo:[10,60], tokwawan:[10,58], kaitak:[10,82], kowloonbay:[12,82], kwuntong:[10,90], westkl:[12,86], homantin:[8,62], peakmid:[8,45] };
for (const [id,[minH,maxH]] of Object.entries(heights)) { const re=new RegExp("(id: '"+id+"'[^\\n]*?minH: )\\d+(, maxH: )\\d+"); if(re.test(lay)){lay=lay.replace(re,'$1'+minH+'$2'+maxH);n++;} else console.log('miss',id); }
fs.writeFileSync('js/layout.js',lay); console.log('district caps',n);

// landmark crown LEDs for night readability
patch('js/landmarks-hk.js', [
  ["    beacons(k2, cx, top + 12, cz, 7);",
   "    beacons(k2, cx, top + 12, cz, 7);\n    k2.boxC(cx, cz, 21.6, 21.6, top + 9.2, top + 10.4, { style: F.LED, color: '#ffffff', glow: 2.6, collide: false });\n    for (var lc = 0; lc < 4; lc++) {\n      var lx = (lc % 2 === 0 ? -1 : 1) * 10, lz = (lc < 2 ? -1 : 1) * 10;\n      k2.boxC(cx + lx, cz + lz, 0.9, 0.9, top + 6, top + 13.5, { style: F.LED, color: '#e8f6ff', glow: 2.2, collide: false });\n    }"],
  ["    k.beacon(cx + r, g + 197, cz);\n    k.beacon(cx - r, g + 159, cz);\n    k.beacon(cx, g + 186, cz);",
   "    k.beacon(cx + r, g + 197, cz);\n    k.beacon(cx - r, g + 159, cz);\n    k.beacon(cx, g + 186, cz);\n    // lit crown trusses at night\n    for (var bt = 0; bt < 4; bt++) {\n      var bx = (bt % 2 === 0 ? -1 : 1) * r, bz = (bt < 2 ? -1 : 1) * r;\n      k.boxC(cx + bx, cz + bz, 1.6, 1.6, g + 30, g + 32, { style: F.LED, color: '#fff4d8', glow: 2.0, collide: false });\n    }"],
  ["    k.boxC(cx, cz, 26, 26, g + 142, g + 147, { style: F.GLASS_SILVER, color: '#d6dcdc' });",
   "    k.boxC(cx, cz, 26, 26, g + 142, g + 147, { style: F.GLASS_SILVER, color: '#d6dcdc' });\n    k.boxC(cx, cz, 26.5, 26.5, g + 146, g + 147.2, { style: F.LED, color: '#ffffff', glow: 2.2, collide: false });"],
  ["    k.boxC(cx, cz, 22, 22, g + 176, g + 179, { style: F.PURE, color: '#3b4247', roofColor: '#3b4247' });",
   "    k.boxC(cx, cz, 22, 22, g + 176, g + 179, { style: F.PURE, color: '#3b4247', roofColor: '#3b4247' });\n    k.boxC(cx, cz, 27, 27, g + 175, g + 176.2, { style: F.LED, color: '#ff7bd5', glow: 2.6, collide: false });"],
  ["    k.beacon(cx, g + 200, cz);\n    k.beacon(pts[0][0], g + 180, pts[0][1]);\n    k.beacon(pts[1][0], g + 180, pts[1][1]);",
   "    k.beacon(cx, g + 200, cz);\n    k.beacon(pts[0][0], g + 180, pts[0][1]);\n    k.beacon(pts[1][0], g + 180, pts[1][1]);\n    for (var gp = 0; gp < 3; gp++) {\n      k.box(cx + (pts[gp][0] - cx) * 0.75 - 0.9, cz + (pts[gp][1] - cz) * 0.75 - 0.9, cx + (pts[gp][0] - cx) * 0.75 + 0.9, cz + (pts[gp][1] - cz) * 0.75 + 0.9, g + 182, g + 184, { style: F.LED, color: '#ffd98a', glow: 2.4, collide: false });\n    }"],
  ["    k.boxC(cx, cz, 20, 20, g + 90, g + 94, { style: F.PURE, color: '#c9ccc6' });",
   "    k.boxC(cx, cz, 20, 20, g + 90, g + 94, { style: F.PURE, color: '#c9ccc6' });\n    k.boxC(cx, cz, 24, 24, g + 93.4, g + 94.4, { style: F.LED, color: '#fff2cc', glow: 2.0, collide: false });"],
  ["    k.cyl(cx, cz, 24, base + 16.4, base + 19.6, 24, { style: F.GLASS_SILVER, color: '#a8b4b8', roofColor: '#5f6668' });",
   "    k.cyl(cx, cz, 24, base + 16.4, base + 19.6, 24, { style: F.GLASS_SILVER, color: '#a8b4b8', roofColor: '#5f6668' });\n    k.cyl(cx, cz, 25.8, base + 18.8, base + 19.8, 24, { style: F.LED, color: '#eaf6ff', glow: 2.4, collide: false });"]
]);
