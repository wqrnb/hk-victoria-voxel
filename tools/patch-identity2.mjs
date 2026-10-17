import fs from 'node:fs';
let lay = fs.readFileSync('js/layout.js','utf8');
const palettes = {
  central: "['#8fb4c4', '#7ea3b8', '#bccfd8', '#6b8fa4', '#a9c1cc', '#5d8096', '#c9d6d8']",
  admiralty: "['#97b8c6', '#7fa5b8', '#c4d6de', '#6f93a8', '#aec4cc']",
  wanchai: "['#9bb8c2', '#b3a78f', '#7fa3b4', '#c9b59a', '#c4cdca', '#86a4b0']",
  causeway: "['#c2b198', '#a9bfb9', '#d0c2a8', '#8fa8b0', '#c6b49a', '#9bb4ae']",
  northpoint: "['#b8ad96', '#9fb5b1', '#c9bda6', '#8ca4ae', '#b2c0ba', '#cdc0a8']",
  quarrybay: "['#9fbac1', '#c2b49b', '#a7bec3', '#cbbda6', '#8fa8b2']",
  sheungwan: "['#aa9c87', '#9fb4b2', '#c1b59f', '#8b9fa8', '#cabfa9', '#a9bbb8']",
  kennedy: "['#b0a38d', '#c0b29c', '#96a8a3', '#c6bba4', '#a2b1ac']",
  tst: "['#b39383', '#9fb7b0', '#c3ac97', '#8fa3aa', '#c8b79e', '#a6b8b0', '#b59b9e']",
  jordan: "['#ab9a83', '#bfae95', '#93a7a2', '#c6b795', '#a5b2a4', '#cdbfa5']",
  mongkok: "['#b49f86', '#c4b298', '#97a89d', '#cbbd9c', '#a8b3a2', '#d0c2a5']",
  hunghom: "['#b3a48e', '#a3b7b1', '#c4b59f', '#93a9ac', '#cbbca4']",
  westkowloon: "['#9fbac2', '#bcc9c9', '#d0cec3', '#8fa8b2', '#bdb8ac', '#aac3c8']",
  westkl: "['#b3a78f', '#c0b59d', '#97a9a6', '#c9bca1', '#a2b2ae']",
  kaitak: "['#aebfc1', '#c6bca8', '#9fb3b8', '#cfc4af', '#96adb1']",
  kowloonbay: "['#a5b3b1', '#b6af9e', '#99a6a5', '#bfb6a2', '#8b9d9f']",
  kwuntong: "['#a4b0a9', '#b7ac97', '#93a3a2', '#c2b8a1', '#88999a']",
  shamshuipo: "['#aa9d86', '#bcb098', '#92a3a0', '#c5b79b', '#9eafa8']",
  token: null
};
let n=0;
for (const [id,pal] of Object.entries(palettes)) {
  if(!pal) continue;
  const re = new RegExp("(id: '"+id+"'[^\\n]*?colors: )\\[[^\\]]*\\]");
  if(re.test(lay)){ lay = lay.replace(re, '$1'+pal); n++; } else console.log('miss color', id);
}
fs.writeFileSync('js/layout.js', lay);
console.log('palettes', n);

let hk = fs.readFileSync('js/landmarks-hk.js','utf8'); let miss=0;
function rep(a,b){const before=hk;hk=hk.replace(a,b);if(hk===before){miss++;console.log('MISS',JSON.stringify(a.slice(0,60)));}}
// BOC: bolder white structural expression
rep("kk.brace([A[0] - offx * 0.92, A[1], A[2] - offz * 0.92], [A[0] + offx * 0.92, A[1] + (B[1] - A[1]) * 0.98, A[2] + offz * 0.92], 0.85, [nx, 0, nz], { color: '#ece7d8', style: F.PURE });",
    "kk.brace([A[0] - offx * 0.92, A[1], A[2] - offz * 0.92], [A[0] + offx * 0.92, A[1] + (B[1] - A[1]) * 0.98, A[2] + offz * 0.92], 2.1, [nx, 0, nz], { color: '#f2ecdc', style: F.PURE });");
rep("kk.brace([A[0] + offx * 0.92, A[1], A[2] + offz * 0.92], [A[0] - offx * 0.92, A[1] + (B[1] - A[1]) * 0.98, A[2] - offz * 0.92], 0.85, [nx, 0, nz], { color: '#ece7d8', style: F.PURE });",
    "kk.brace([A[0] + offx * 0.92, A[1], A[2] + offz * 0.92], [A[0] - offx * 0.92, A[1] + (B[1] - A[1]) * 0.98, A[2] - offz * 0.92], 2.1, [nx, 0, nz], { color: '#f2ecdc', style: F.PURE });");
rep("kk.boxC(cx + nx * 0.8, cz + nz * 0.8, Math.abs(offx) * 2.04, 0.5, g + tr.h * 0.66, g + tr.h * 0.66 + 0.7, { color: '#ece7d8', style: F.PURE, collide: false });",
    "kk.boxC(cx + nx * 0.8, cz + nz * 0.8, Math.abs(offx) * 2.04, 1.6, g + tr.h * 0.62, g + tr.h * 0.62 + 1.7, { color: '#f2ecdc', style: F.PURE, collide: false });");
// IFC crown stronger
rep("k2.boxC(cx, cz, 21, 21, top, top + 6, { style: F.GLASS_SILVER, color: '#c9d3d6', roofColor: '#5a6061' });",
    "k2.boxC(cx, cz, 21, 21, top, top + 6, { style: F.GLASS_SILVER, color: '#dbe4e6', roofColor: '#5a6061' });");
rep("k2.boxC(cx + sx, cz + sz, 3.2, 3.2, top + 6, top + 12, { style: F.PURE, color: '#dbe1e0', collide: false });",
    "k2.boxC(cx + sx, cz + sz, 4.6, 4.6, top + 6, top + 13, { style: F.PURE, color: '#eef3f2', collide: false });");
// HSBC bolder trusses
rep("kk.boxC(cx + xs[t] + s * (ws[t] / 2), cz + 12.2, 0.9, 0.9, g + 6.5, g + 6.5 + hs[t], { color: '#c9cdce', style: F.PURE, collide: false });",
    "kk.boxC(cx + xs[t] + s * (ws[t] / 2), cz + 12.2, 1.7, 1.7, g + 6.5, g + 6.5 + hs[t], { color: '#d2d6d6', style: F.PURE, collide: false });");
rep("kk.brace([cx + xs[t] - ws[t] / 2, g + 8, cz + 13.1], [cx + xs[t] + ws[t] / 2, g + hs[t] * 0.9, cz + 13.1], 0.65, [0, 0, 1], { color: '#d4d8d8', style: F.PURE });",
    "kk.brace([cx + xs[t] - ws[t] / 2, g + 8, cz + 13.1], [cx + xs[t] + ws[t] / 2, g + hs[t] * 0.9, cz + 13.1], 1.5, [0, 0, 1], { color: '#e2e6e4', style: F.PURE });");
rep("kk.brace([cx + xs[t] + ws[t] / 2, g + 8, cz + 13.1], [cx + xs[t] - ws[t] / 2, g + hs[t] * 0.9, cz + 13.1], 0.65, [0, 0, 1], { color: '#d4d8d8', style: F.PURE });",
    "kk.brace([cx + xs[t] + ws[t] / 2, g + 8, cz + 13.1], [cx + xs[t] - ws[t] / 2, g + hs[t] * 0.9, cz + 13.1], 1.5, [0, 0, 1], { color: '#e2e6e4', style: F.PURE });");
// Central Plaza gold ribs bolder
rep("k.boxC(pts[c][0], pts[c][1], 1.3, 1.3, g + 7, g + 180, { color: '#d8c07a', style: F.PURE, collide: false });",
    "k.boxC(pts[c][0], pts[c][1], 2.0, 2.0, g + 7, g + 182, { color: '#e2c97d', style: F.PURE, collide: false });");
// HKCEC white roof ridges
rep("    // signature roof fins\n",
    "    // luminous white roof ridges visible from across the harbour\n    for (var rr = 0; rr < 5; rr++) {\n      var t2 = rr / 4, rx2 = cx - span / 2 + (rr + 0.5) * span / 5;\n      var rh2 = 7 + Math.pow(Math.sin(t2 * Math.PI), 0.7) * 10;\n      k.boxC(rx2, cz, span / 5 - 1, 47, g + 10 + rh2, g + 10 + rh2 + 0.5, { color: '#f0f4f2', style: F.PURE, collide: false });\n    }\n    // signature roof fins\n");
fs.writeFileSync('js/landmarks-hk.js', hk);
console.log('HK landmark bold patch', miss?miss+' misses':'ok');
