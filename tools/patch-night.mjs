import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8'); let miss = 0;
  for (const [a,b] of pairs) { const before=s; s=s.replace(a,b); if (s===before){miss++;console.log('MISS',file,JSON.stringify(a.slice(0,60)));} }
  fs.writeFileSync(file,s); console.log(file, miss?miss+' misses':'ok');
}
// distant ranges react to light/fog (no more glowing cardboard at night)
patch('js/terrain.js', [
  ["    var mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });\n    var mesh = new THREE.Mesh(geo, mat);",
   "    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, fog: true, roughness: 1.0, metalness: 0.0 });\n    var mesh = new THREE.Mesh(geo, mat);"]
]);
// night window density clusters + slightly less uniform
patch('js/landmarkkit.js', [
  ['  // ground grime + facade noise\n',
   '  // cluster some whole floors dark, and calm the overall window density at night\n  float floorCluster = fHash2(vec2(floor(uv.y / (floorH * 4.0)), seed * 1.7), 19.0);\n  emis *= 0.82 * (0.35 + 0.9 * smoothstep(0.18, 0.5, floorCluster));\n\n  // ground grime + facade noise\n'],
  ['    lit = step(0.44, rnd);', '    lit = step(0.56, rnd);'],
  ['    lit = step(0.5, rnd);\n    emis += fWindowsLit(id, seed, 1.0)', '    lit = step(0.62, rnd);\n    emis += fWindowsLit(id, seed, 1.0)'],
  ['    lit = step(0.55, rnd);\n    emis += fWindowsLit(id, seed, 2.0)', '    lit = step(0.64, rnd);\n    emis += fWindowsLit(id, seed, 2.0)'],
  ['    lit = step(0.5, rnd);\n    emis += fWindowsLit(id, seed, 3.0)', '    lit = step(0.62, rnd);\n    emis += fWindowsLit(id, seed, 3.0)'],
  ['    lit = step(0.45, rnd);\n    emis += fWindowsLit(id, seed, 5.0)', '    lit = step(0.6, rnd);\n    emis += fWindowsLit(id, seed, 5.0)'],
  ['    lit = step(0.42, rnd);\n    emis += fWindowsLit(id, seed, 7.0)', '    lit = step(0.56, rnd);\n    emis += fWindowsLit(id, seed, 7.0)'],
  ['    lit = step(0.4, rnd);\n    emis += fWindowsLit(id, seed, 8.0)', '    lit = step(0.54, rnd);\n    emis += fWindowsLit(id, seed, 8.0)']
]);
// default postcard camera closer and over the harbour
patch('js/controls.js', [
  ["      target: new THREE.Vector3(-130, 55, 330),\n      desiredTarget: new THREE.Vector3(-130, 55, 330),\n      theta: 2.70, phi: 1.43, radius: 1250,\n      dTheta: 2.70, dPhi: 1.40, dRadius: 1250,",
   "      target: new THREE.Vector3(-140, 55, 335),\n      desiredTarget: new THREE.Vector3(-140, 55, 335),\n      theta: 2.95, phi: 1.41, radius: 950,\n      dTheta: 2.95, dPhi: 1.40, dRadius: 950,"],
  ["    this.setCamera(new THREE.Vector3(390, 205, -790), new THREE.Vector3(-140, 55, 330));",
   "    this.setCamera(new THREE.Vector3(80, 215, -600), new THREE.Vector3(-140, 55, 335));"]
]);
