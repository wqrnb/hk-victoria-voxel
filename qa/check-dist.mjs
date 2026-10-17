// Single-file dist sanity check: external refs + exact inlined-source freshness.
import fs from 'node:fs';
const h = fs.readFileSync('dist/VictoriaHarbour.html', 'utf8');
const http = [...h.matchAll(/https?:\/\/[^\s'"<)>{}\]]{0,160}/g)].map(x => x[0]);
console.log('dist bytes:', Buffer.byteLength(h));
console.log('http refs:', http.length);
http.forEach(u => console.log('  ', u));
console.log('<script> tags:', (h.match(/<script/g) || []).length);
console.log('<link> tags:', (h.match(/<link/g) || []).length);
console.log('<img> tags:', (h.match(/<img/g) || []).length);
console.log('url( refs:', (h.match(/url\(/g) || []).length, ' (data: urls:', (h.match(/url\(["']?data:/g) || []).length, ')');
console.log('@import:', (h.match(/@import/g) || []).length, ' @font-face:', (h.match(/@font-face/g) || []).length);
console.log('external <script src> remaining:', (h.match(/<script[^>]*\bsrc=/g) || []).length);
console.log('external stylesheet <link rel=stylesheet>:', (h.match(/<link[^>]*stylesheet/g) || []).length);

// CSS block: index.html has <link rel="stylesheet" href="css/style.css"> replaced by <style>
const css = fs.readFileSync('css/style.css', 'utf8');
const cssOk = h.includes(css.trim());
console.log((cssOk ? 'IN    ' : 'STALE ') + 'css/style.css'.padEnd(24) + ' srcBytes=' + Buffer.byteLength(css));

const files = ['vendor/three.min.js', 'js/core.js', 'js/textures.js', 'js/layout.js', 'js/footprints.js', 'js/terrain.js', 'js/landmarkkit.js', 'js/buildings.js', 'js/landmarks-hk.js', 'js/landmarks-kl.js', 'js/props.js', 'js/sky.js', 'js/water.js', 'js/post.js', 'js/life.js', 'js/controls.js', 'js/ui.js', 'js/audio.js', 'js/main.js'];
let stale = 0;
for (const f of files) {
  const marker = '/* ==== ' + f + ' ==== */\n';
  const i = h.indexOf(marker);
  if (i < 0) { stale++; console.log('MISSING ' + f); continue; }
  const start = i + marker.length;
  const end = h.indexOf('\n</script>', start);
  let block = h.slice(start, end);
  let src = fs.readFileSync(f, 'utf8');
  // builder escapes closing script tags inside js
  block = block.replace(/<\\\/script/g, '</script');
  src = src.replace(/<\\\/script/g, '</script');
  const a = block.trim(), b = src.trim();
  const ok = a === b;
  if (!ok) {
    stale++;
    let d = 0; while (d < Math.min(a.length, b.length) && a[d] === b[d]) d++;
    const sa = a.slice(Math.max(0, d - 60), d + 80).replace(/\n/g, '\\n');
    const sb = b.slice(Math.max(0, d - 60), d + 80).replace(/\n/g, '\\n');
    console.log('STALE ' + f.padEnd(24) + ' firstDiff@' + d + '\n   dist: ...' + sa + '\n   src : ...' + sb);
  } else {
    console.log('IN    ' + f.padEnd(24) + ' bytes=' + Buffer.byteLength(src));
  }
}
console.log(stale === 0 ? 'FRESH: dist embeds current sources exactly' : `STALE: ${stale} embedded source(s) differ from current files`);
process.exitCode = stale ? 3 : 0;
