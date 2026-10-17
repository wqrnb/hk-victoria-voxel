import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8'); let miss = 0;
  for (const [a,b] of pairs) { const before=s; s=s.replace(a,b); if (s===before){miss++;console.log('MISS',file,JSON.stringify(a.slice(0,60)));} }
  fs.writeFileSync(file,s); console.log(file, miss?miss+' misses':'ok');
}
patch('js/controls.js', [
  ["      theta: 2.95, phi: 1.41, radius: 950,\n      dTheta: 2.95, dPhi: 1.40, dRadius: 950,",
   "      theta: 2.82, phi: 1.33, radius: 620,\n      dTheta: 2.82, dPhi: 1.33, dRadius: 620,"],
  ["    this.setCamera(new THREE.Vector3(80, 215, -600), new THREE.Vector3(-140, 55, 335));",
   "    this.setCamera(new THREE.Vector3(40, 140, -120), new THREE.Vector3(-150, 55, 338));"]
]);
patch('js/landmarkkit.js', [
  ["    lit = step(0.56, rnd);", "    lit = step(0.68, rnd);"],
  ["    lit = step(0.64, rnd);", "    lit = step(0.72, rnd);"],
  ["    lit = step(0.62, rnd);\n    emis += fWindowsLit(id, seed, 3.0)", "    lit = step(0.7, rnd);\n    emis += fWindowsLit(id, seed, 3.0)"],
  ["    lit = step(0.6, rnd);\n    emis += fWindowsLit(id, seed, 5.0)", "    lit = step(0.66, rnd);\n    emis += fWindowsLit(id, seed, 5.0)"],
  ["    lit = step(0.56, rnd);\n    emis += fWindowsLit(id, seed, 7.0)", "    lit = step(0.62, rnd);\n    emis += fWindowsLit(id, seed, 7.0)"]
]);
