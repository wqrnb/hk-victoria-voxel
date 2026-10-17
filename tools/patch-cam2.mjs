import fs from 'node:fs';
let s=fs.readFileSync('js/controls.js','utf8'); let miss=0;
function rep(a,b){const before=s;s=s.replace(a,b);if(s===before){miss++;console.log('MISS',JSON.stringify(a.slice(0,70)));}}
rep("      target: new THREE.Vector3(-140, 55, 335),\n      desiredTarget: new THREE.Vector3(-140, 55, 335),\n      theta: 2.82, phi: 1.33, radius: 620,\n      dTheta: 2.82, dPhi: 1.33, dRadius: 620,\n      minRadius: 35, maxRadius: 4200, minPhi: 0.10, maxPhi: 1.48",
    "      target: new THREE.Vector3(-140, 70, 380),\n      desiredTarget: new THREE.Vector3(-140, 70, 380),\n      theta: 2.965, phi: 1.525, radius: 570,\n      dTheta: 2.965, dPhi: 1.525, dRadius: 570,\n      minRadius: 35, maxRadius: 4200, minPhi: 0.10, maxPhi: 1.55");
rep("    this.setCamera(new THREE.Vector3(40, 140, -120), new THREE.Vector3(-150, 55, 338));",
    "    this.setCamera(new THREE.Vector3(-40, 95, -180), new THREE.Vector3(-140, 70, 380));");
fs.writeFileSync('js/controls.js',s);
console.log('default camera patch', miss?miss+' misses':'ok');
