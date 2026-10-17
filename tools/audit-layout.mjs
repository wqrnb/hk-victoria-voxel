// Layout sanity audit: every road / walk path / tram / landmark must be on land.
import fs from 'node:fs';
import vm from 'node:vm';
global.window = global;
global.THREE = { ColorManagement: { legacyMode: true } };
vm.runInThisContext(fs.readFileSync('js/core.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/layout.js', 'utf8'));
const HK = global.HK, L = HK.Layout, U = HK.Util;

function samplePolyline(pts, step) {
  step = step || 2;
  const total = L.polylineLength(pts);
  const out = [];
  for (let d = 0; d <= total; d += step) out.push(L.polylinePointAtDistance(pts, d));
  return out;
}
function wetStats(pts) {
  const samples = samplePolyline(pts);
  let wet = 0, worst = 0, worstAt = null;
  for (const p of samples) {
    if (L.isWater(p.x, p.z)) { wet++; const d = L.shoreDistance(p.x, p.z); if (d > worst) { worst = d; worstAt = [p.x.toFixed(0), p.z.toFixed(0)]; } }
  }
  return { total: samples.length, wet, pct: samples.length ? (wet / samples.length * 100) : 0, worst, worstAt };
}
const problems = [];
console.log('=== ROADS ===');
for (const r of L.ROADS) {
  if (r.type === 'tunnel') continue;
  const st = wetStats(r.pts);
  if (st.pct > 2) problems.push(['road', r.en || r.name, st]);
  if (st.pct > 0) console.log(`${r.en || r.name}: ${st.pct.toFixed(1)}% wet worst=${st.worst.toFixed(0)}u at ${st.worstAt}`);
}
console.log('=== TRAM ===');
{ const st = wetStats(L.TRAM_ROUTE); if (st.pct > 1) problems.push(['tram', 'TRAM', st]); console.log(st); }
console.log('=== WALK PATHS ===');
L.WALK_PATHS.forEach((p, i) => { const st = wetStats(p, 1); if (st.pct > 5) problems.push(['walk', i, st]); console.log(i, st.pct.toFixed(1) + '% wet'); });
console.log('=== FERRY ROUTES (expected water) ===');
for (const r of L.FERRY_ROUTES) {
  if (r.a && r.b) {
    const pts = [[r.a[0], r.a[1]], [r.b[0], r.b[1]]];
    const st = wetStats(pts, 2);
    console.log(r.en || r.id, 'wet', st.pct.toFixed(0) + '%');
  }
}
console.log('=== LANDMARKS ===');
for (const [k, lm] of Object.entries(L.LANDMARKS)) {
  if (lm.w <= 2) continue;
  const xs = [lm.x - lm.w / 2, lm.x + lm.w / 2], zs = [lm.z - lm.d / 2, lm.z + lm.d / 2];
  let wet = 0, n = 0;
  for (const x of xs) for (const z of zs) { n++; if (L.isWater(x, z)) wet++; }
  if (L.isWater(lm.x, lm.z) || wet > 0) {
    const msg = `${k} ${lm.x},${lm.z} centerWet=${L.isWater(lm.x, lm.z)} cornerWet=${wet}/${n}`;
    console.log(msg);
    if (L.isWater(lm.x, lm.z)) problems.push(['landmark-center-water', k, msg]);
  }
}
console.log('=== PIERS (deck centres, may sit over water) ===');
for (const [k, p] of Object.entries(L.FERRY_PIERS)) {
  console.log(k, 'centreWet=' + L.isWater(p.x, p.z), 'shoreDist=' + L.shoreDistance(p.x, p.z).toFixed(0));
}
console.log('=== POIS SPAWN (walk) ===');
for (const p of L.POIS) if (p.kind === 'walk') console.log(p.id, 'wet=' + L.isWater(p.spawn.x, p.spawn.z), 'h=' + L.terrainHeight(p.spawn.x, p.spawn.z));
console.log('\n=== PROBLEMS ===');
if (!problems.length) console.log('none 🎉');
for (const [type, id, st] of problems) console.log(type, id, typeof st === 'object' ? JSON.stringify(st) : st);
