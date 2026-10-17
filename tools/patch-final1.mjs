import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8'); let miss = 0;
  for (const [a,b] of pairs) { const before=s; s=s.replace(a,b); if (s===before){miss++;console.log('MISS',file,JSON.stringify(a.slice(0,60)));} }
  fs.writeFileSync(file,s); console.log(file, miss?miss+' misses':'ok');
}
// FPS spawns face the harbour / street properly
patch('js/layout.js', [
  ["spawn: { x: 10, z: -326, yaw: 0.15, pitch: -0.02 }", "spawn: { x: 10, z: -326, yaw: 3.02, pitch: -0.01 }"],
  ["spawn: { x: -260, z: 372, yaw: 0.6, pitch: -0.03 }", "spawn: { x: -260, z: 372, yaw: 2.45, pitch: -0.02 }"],
  ["spawn: { x: -282, z: 706, yaw: -0.6, pitch: -0.08 }", "spawn: { x: -282, z: 706, yaw: -0.25, pitch: -0.06 }"]
]);
// higher street-level density (more towers + fabric)
patch('js/buildings.js', [
  ["      var step = dist.density > 0.9 ? 6 : (dist.density > 0.7 ? 7 : 9);", "      var step = dist.density > 0.9 ? 5 : (dist.density > 0.7 ? 6 : 8);"],
  ["      var scale = 1.72 + (1 - dist.density) * 0.5;", "      var scale = 1.58 + (1 - dist.density) * 0.45;"]
]);
// paving seams at street level
patch('js/terrain.js', [
  ["        'diffuseColor.rgb *= (0.92 + tn*0.09 + tn2*0.06);\\n'",
   "        'diffuseColor.rgb *= (0.92 + tn*0.09 + tn2*0.06);\\n' +\n        'float urban = step(vTerrPos.y, 12.0);\\n' +\n        'vec2 seamBig = abs(fract(tp * 0.125) - 0.5);\\n' +\n        'vec2 seamSmall = abs(fract(tp * 0.5) - 0.5);\\n' +\n        'float sl = smoothstep(0.43, 0.5, max(seamBig.x, seamBig.y)) * 0.055 + smoothstep(0.45, 0.5, max(seamSmall.x, seamSmall.y)) * 0.035;\\n' +\n        'diffuseColor.rgb *= 1.0 - sl * urban;\\n'"]
]);
