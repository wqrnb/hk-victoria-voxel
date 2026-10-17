import fs from 'node:fs';
let s = fs.readFileSync('js/layout.js','utf8');
s = s.replace("spawn: { x: 10, z: -326, yaw: 3.02, pitch: -0.01 }", "spawn: { x: 10, z: -318, yaw: 3.02, pitch: -0.01 }");
fs.writeFileSync('js/layout.js', s);
console.log('spawn deck patched');
