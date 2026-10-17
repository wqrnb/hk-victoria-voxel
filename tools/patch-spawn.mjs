import fs from 'node:fs';
let s = fs.readFileSync('js/controls.js','utf8'); let miss=0;
function rep(a,b){const before=s;s=s.replace(a,b);if(s===before){miss++;console.log('MISS',JSON.stringify(a.slice(0,70)));}}
rep("      eye: 0.86, eyeCrouch: 0.6, radius: 0.34,\n      walk: 1.7, sprint: 3.8, flySpeed: 9.0, jumpV: 2.7, gravity: 5.4, maxStep: 1.15\n    };\n    this._initSpawn();",
    "      eye: 0.86, eyeCrouch: 0.6, radius: 0.34,\n      walk: 1.7, sprint: 3.8, flySpeed: 9.0, jumpV: 2.7, gravity: 5.4, maxStep: 1.3\n    };\n    this.colliderGrid = this._buildColliderGrid();\n    this._initSpawn();");
rep("    this.cine = { shots: (L.CINEMATIC || []).map(this._prepShot), index: 0, t: 0, active: false, fov: 44 };\n    this.colliderGrid = this._buildColliderGrid();\n    this._bindEvents();",
    "    this.cine = { shots: (L.CINEMATIC || []).map(this._prepShot), index: 0, t: 0, active: false, fov: 44 };\n    this._bindEvents();");
rep("    f.pos.set(spawn.x, 0, spawn.z);\n    var h = this._terrainAt(spawn.x, spawn.z);\n    f.feet = h < 0 ? 2 : h + 0.02;",
    "    f.pos.set(spawn.x, 0, spawn.z);\n    var supp = this._supportAt(spawn.x, spawn.z, 8, 8);\n    f.feet = supp < 0 ? 2 : supp + 0.02;");
rep("    f.pos.set(s.x, 0, s.z);\n    var h = this._terrainAt(s.x, s.z);\n    f.feet = h < 0 ? 2 : h + 0.02;",
    "    f.pos.set(s.x, 0, s.z);\n    var supp = this._supportAt(s.x, s.z, 8, 8);\n    f.feet = supp < 0 ? 2 : supp + 0.02;");
fs.writeFileSync('js/controls.js', s);
console.log('controls spawn patch', miss?miss+' misses':'ok');
