import fs from 'node:fs';
let s = fs.readFileSync('js/props.js', 'utf8'); let miss = 0;
function rep(a,b){ const before=s; s=s.replace(a,b); if(s===before){miss++;console.log('MISS',JSON.stringify(a.slice(0,60)));} }
// street lamps: human scale
rep("cbMatte.box(x, y + 3.6, z, 0.3, 7.2, 0.3, lampCol);", "cbMatte.box(x, y + 2.3, z, 0.24, 4.6, 0.24, lampCol);");
rep("cbMatte.box(x + ca * 1.2, y + 7.1, z + sa * 1.2, Math.abs(ca) * 2.4 + 0.3, 0.25, Math.abs(sa) * 2.4 + 0.3, lampCol);", "cbMatte.box(x + ca * 0.85, y + 4.45, z + sa * 0.85, Math.abs(ca) * 1.7 + 0.24, 0.18, Math.abs(sa) * 1.7 + 0.24, lampCol);");
rep("cbGlow.box(x + ca * 2.3, y + 7.0, z + sa * 2.3, 0.9, 0.28, 0.9, headCol);", "cbGlow.box(x + ca * 1.65, y + 4.36, z + sa * 1.65, 0.6, 0.2, 0.6, headCol);");
rep("pools.push({ x: x + ca * 2.3, z: z + sa * 2.3, y: gy + 0.06, s: 10 });", "pools.push({ x: x + ca * 1.65, z: z + sa * 1.65, y: gy + 0.05, s: 5.5 });");
// promenade railings: waist height
rep("cbMatte.box(px, y + 0.7, pz, 0.18, 1.4, 0.18, railCol);", "cbMatte.box(px, y + 0.28, pz, 0.12, 0.56, 0.12, railCol);");
rep("yawBox(cbMatte, mx + nx3, mz + nz3, len, 0.12, gy3 + 1.15, gy3 + 1.32, yaw, railCol);", "yawBox(cbMatte, mx + nx3, mz + nz3, len, 0.09, gy3 + 0.46, gy3 + 0.56, yaw, railCol);");
// promenade furniture
rep("yawBox(cbMatte, p.x + nx * 4.2, p.z + nz * 4.2, 3.2, 0.9, gy + 0.35, gy + 0.7, yaw, U.hexRgb('#8a7a63'));", "yawBox(cbMatte, p.x + nx * 3.1, p.z + nz * 3.1, 1.7, 0.5, gy + 0.2, gy + 0.36, yaw, U.hexRgb('#8a7a63'));");
rep("cbMatte.box(p.x + nx * 4.2, gy + 0.55, p.z + nz * 4.2, 1.8, 1.1, 1.8, U.hexRgb('#8c8f86'));", "cbMatte.box(p.x + nx * 3.1, gy + 0.3, p.z + nz * 3.1, 1.05, 0.55, 1.05, U.hexRgb('#8c8f86'));");
rep("cbMatte.box(p.x + nx * 4.2, gy + 1.3, p.z + nz * 4.2, 1.3, 0.7, 1.3, U.hexRgb('#4f6b3e'));", "cbMatte.box(p.x + nx * 3.1, gy + 0.78, p.z + nz * 3.1, 0.8, 0.42, 0.8, U.hexRgb('#4f6b3e'));");
// flags
rep("cbMatte.box(x, g + 3.4, z, 0.18, 6.8, 0.18, U.hexRgb('#c8c4b6'));", "cbMatte.box(x, g + 2.1, z, 0.13, 4.2, 0.13, U.hexRgb('#c8c4b6'));");
rep("cbMatte.box(x + 0.9, g + 5.6, z, 1.8, 1.1, 0.08, U.hexRgb('#c22b2b'));", "cbMatte.box(x + 0.65, g + 3.45, z, 1.25, 0.8, 0.06, U.hexRgb('#c22b2b'));");
// market stalls
rep("cbMatte.box(x, g + 1.2, z, 4.2, 0.2, 3.0, U.hexRgb('#6b5f4e'));", "cbMatte.box(x, g + 0.72, z, 2.2, 0.16, 1.55, U.hexRgb('#6b5f4e'));");
rep("cbMatte.box(x, g + 2.5, z, 4.6, 0.18, 3.4, col);", "cbMatte.box(x, g + 1.55, z, 2.4, 0.14, 1.75, col);");
rep("cbMatte.box(x - 1.7, g + 1.25, z - 1.2, 0.12, 2.5, 0.12, U.hexRgb('#5b5b56'));", "cbMatte.box(x - 0.95, g + 0.78, z - 0.65, 0.09, 1.55, 0.09, U.hexRgb('#5b5b56'));");
rep("cbMatte.box(x + 1.7, g + 1.25, z + 1.2, 0.12, 2.5, 0.12, U.hexRgb('#5b5b56'));", "cbMatte.box(x + 0.95, g + 0.78, z + 0.65, 0.09, 1.55, 0.09, U.hexRgb('#5b5b56'));");
// MTR entrances
rep("cbMatte.box(m.x, g + 1.6, m.z, 4.5, 3.2, 3.2, U.hexRgb('#8f1f1f'));", "cbMatte.box(m.x, g + 1.0, m.z, 2.8, 1.9, 2.2, U.hexRgb('#8f1f1f'));");
rep("cbMatte.box(m.x, g + 3.3, m.z, 5.2, 0.35, 3.8, U.hexRgb('#c22b2b'));", "cbMatte.box(m.x, g + 2.0, m.z, 3.2, 0.25, 2.6, U.hexRgb('#c22b2b'));");
rep("cbGlow.box(m.x, g + 2.4, m.z + 1.8, 2.4, 0.6, 0.12, U.hexRgb('#fff0d0'));", "cbGlow.box(m.x, g + 1.4, m.z + 1.2, 1.5, 0.35, 0.1, U.hexRgb('#fff0d0'));");
// bus stop shelters
rep("cbMatte.box(s[0], g2 + 1.6, s[1], 6, 0.16, 2.4, U.hexRgb('#c7c3b7'));", "cbMatte.box(s[0], g2 + 1.45, s[1], 3.6, 0.12, 1.4, U.hexRgb('#c7c3b7'));");
rep("cbMatte.box(s[0] - 2.8, g2 + 1.2, s[1], 0.2, 2.4, 0.2, U.hexRgb('#8b8b84'));", "cbMatte.box(s[0] - 1.65, g2 + 0.72, s[1], 0.14, 1.45, 0.14, U.hexRgb('#8b8b84'));");
rep("cbMatte.box(s[0] + 2.8, g2 + 1.2, s[1], 0.2, 2.4, 0.2, U.hexRgb('#8b8b84'));", "cbMatte.box(s[0] + 1.65, g2 + 0.72, s[1], 0.14, 1.45, 0.14, U.hexRgb('#8b8b84'));");
rep("cbMatte.box(s[0] + 1.2, g2 + 1.0, s[1], 0.8, 2.0, 0.15, U.hexRgb('#3d4a55'));", "cbMatte.box(s[0] + 1.0, g2 + 0.7, s[1], 0.5, 1.2, 0.1, U.hexRgb('#3d4a55'));");
// lighthouse scale
rep("for (var i = 0; i < 5; i++) {\n      var r = 2.5 - i * 0.35;\n      cbMatte.box(x, g + i * 2.2 + 1.1, z, r * 2, 2.2, r * 2, U.hexRgb('#d7d3c6'));\n    }\n    cbMatte.box(x, g + 12.3, z, 2.0, 1.6, 2.0, U.hexRgb('#a83b32'));\n    cbGlow.box(x, g + 13.3, z, 1.2, 0.9, 1.2, U.hexRgb('#fff3c8'));", "for (var i = 0; i < 4; i++) {\n      var r = 1.2 - i * 0.18;\n      cbMatte.box(x, g + i * 1.2 + 0.6, z, r * 2, 1.2, r * 2, U.hexRgb('#d7d3c6'));\n    }\n    cbMatte.box(x, g + 5.5, z, 1.0, 0.9, 1.0, U.hexRgb('#a83b32'));\n    cbGlow.box(x, g + 6.15, z, 0.62, 0.5, 0.62, U.hexRgb('#fff3c8'));");
// billboards ~half size
rep("      { x: 142, z: -308, y: 20, w: 26, h: 13, ny: 0, nz: 1, seed: 1 },", "      { x: 142, z: -308, y: 14, w: 14, h: 7, ny: 0, nz: 1, seed: 1 },");
rep("      { x: 470, z: 458, y: 18, w: 22, h: 12, ny: 0, nz: -1, seed: 2 },", "      { x: 470, z: 458, y: 12, w: 12, h: 6.5, ny: 0, nz: -1, seed: 2 },");
rep("      { x: -80, z: 542, y: 24, w: 20, h: 11, ny: 0, nz: -1, seed: 3 },", "      { x: -80, z: 542, y: 16, w: 11, h: 6, ny: 0, nz: -1, seed: 3 },");
rep("      { x: -60, z: -700, y: 22, w: 18, h: 14, ny: 1, nz: 0, seed: 4 },", "      { x: -60, z: -700, y: 14, w: 10, h: 8, ny: 1, nz: 0, seed: 4 },");
rep("      { x: 300, z: 330, y: 18, w: 24, h: 12, ny: 0, nz: -1, seed: 5 },", "      { x: 300, z: 330, y: 12, w: 13, h: 6.5, ny: 0, nz: -1, seed: 5 },");
rep("      { x: 760, z: 468, y: 16, w: 20, h: 11, ny: 0, nz: -1, seed: 6 }", "      { x: 760, z: 468, y: 11, w: 11, h: 6, ny: 0, nz: -1, seed: 6 }");
// peak tram car and rails
rep("          beam3D(cbMatte, [prev.x + prev.nx * 0.7 * r, prev.y, prev.z + prev.nz * 0.7 * r], [cur.x + nx * 0.7 * r, y, cur.z + nz * 0.7 * r], 0.14, 0.14, rail);", "          beam3D(cbMatte, [prev.x + prev.nx * 0.45 * r, prev.y, prev.z + prev.nz * 0.45 * r], [cur.x + nx * 0.45 * r, y, cur.z + nz * 0.45 * r], 0.1, 0.1, rail);");
rep("        if (s % 2 === 0) beam3D(cbMatte, [prev.x - prev.nx * 0.7, prev.y, prev.z - prev.nz * 0.7], [cur.x + nx * 0.7, y, cur.z + nz * 0.7], 0.12, 0.12, U.hexRgb('#5a554a'));", "        if (s % 2 === 0) beam3D(cbMatte, [prev.x - prev.nx * 0.45, prev.y, prev.z - prev.nz * 0.45], [cur.x + nx * 0.45, y, cur.z + nz * 0.45], 0.08, 0.08, U.hexRgb('#5a554a'));");
rep("    yawBox(cbMatte, mid.x, mid.z, 5.5, 2.4, mgy + 0.5, mgy + 3.4, yaw, U.hexRgb('#2c6b4f'));", "    yawBox(cbMatte, mid.x, mid.z, 2.4, 1.35, mgy + 0.3, mgy + 1.9, yaw, U.hexRgb('#2c6b4f'));");
rep("    yawBox(cbMatte, mid.x, mid.z, 5.0, 2.2, mgy + 3.4, mgy + 4.2, yaw, U.hexRgb('#e6e0d2'));", "    yawBox(cbMatte, mid.x, mid.z, 2.2, 1.25, mgy + 1.9, mgy + 2.3, yaw, U.hexRgb('#e6e0d2'));");
// cranes scale
rep("      { x: -560, z: 560, h: 120 }, { x: 380, z: 520, h: 150 }, { x: -780, z: -560, h: 95 },\n      { x: 1000, z: -560, h: 110 }, { x: 900, z: 420, h: 90 }", "      { x: -560, z: 560, h: 68 }, { x: 380, z: 520, h: 86 }, { x: -780, z: -560, h: 54 },\n      { x: 1000, z: -560, h: 64 }, { x: 900, z: 420, h: 52 }");
rep("        var sx = (k % 2 === 0 ? -1 : 1) * 1.3, sz = (k < 2 ? -1 : 1) * 1.3;", "        var sx = (k % 2 === 0 ? -1 : 1) * 0.8, sz = (k < 2 ? -1 : 1) * 0.8;");
rep("      var jibLen = 34;", "      var jibLen = 21;");
rep("      cbMatte.box(d.x - 6, top, d.z, 12, 0.35, 0.35, steel);", "      cbMatte.box(d.x - 3.5, top, d.z, 7, 0.3, 0.3, steel);");
rep("      cbMatte.box(d.x - 10, top - 2.5, d.z, 3.5, 5, 2.2, U.hexRgb('#5e5e5a'));", "      cbMatte.box(d.x - 6, top - 1.6, d.z, 2.2, 3.2, 1.4, U.hexRgb('#5e5e5a'));");
rep("      beam3D(cbMatte, c0, c1, 0.12, 0.12, U.hexRgb('#8f908c'));", "      beam3D(cbMatte, c0, c1, 0.09, 0.09, U.hexRgb('#8f908c'));");
rep("      beam3D(cbMatte, [d.x, top + 1, d.z], [d.x + 10, top - 3, d.z], 0.1, 0.1, U.hexRgb('#8f908c'));", "      beam3D(cbMatte, [d.x, top + 1, d.z], [d.x + 6, top - 2, d.z], 0.08, 0.08, U.hexRgb('#8f908c'));");
fs.writeFileSync('js/props.js', s);
console.log('props scale patch', miss ? miss + ' misses' : 'ok');
