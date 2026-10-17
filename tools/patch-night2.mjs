import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8'); let miss = 0;
  for (const [a,b] of pairs) { const before=s; s=s.replace(a,b); if (s===before){miss++;console.log('MISS',file,JSON.stringify(a.slice(0,60)));} }
  fs.writeFileSync(file,s); console.log(file, miss?miss+' misses':'ok');
}
patch('js/terrain.js', [
  ['    group.add(mesh);\n    group.add(buildDistantRanges());', '    group.add(mesh);\n    // distant terrain-edge ranges disabled: HK.Sky owns the horizon haze/fog']
]);
patch('js/landmarkkit.js', [
  ['  emis *= 0.82 * (0.35 + 0.9 * smoothstep(0.18, 0.5, floorCluster));', '  emis *= (0.5 + 0.85 * smoothstep(0.18, 0.5, floorCluster));'],
  ['  emis *= mix(0.4, 1.0, winAA);', '  emis *= mix(0.78, 1.0, winAA);\n  emis *= (1.0 + night * 0.5);']
]);
