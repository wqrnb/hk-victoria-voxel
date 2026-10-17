// Build a fully self-contained single-file deliverable:
//   dist/VictoriaHarbour.html   (works from file:// — no server, no network)
// Texture atlases in assets/ are packed as data URIs on window.HK_ASSETS.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const ASSETS = {
  facade: 'assets/facade-atlas.png',
  night: 'assets/facade-night.png',
  neon: 'assets/neon-atlas.png',
  foam: 'assets/water-foam.png',
  ground: 'assets/ground-atlas.png',
  accent: 'assets/landmark-accents.png'
};

const packed = {};
let assetBytes = 0;
for (const [key, rel] of Object.entries(ASSETS)) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.warn('MISSING ATLAS', rel, '— run: python3 tools/bake-textures.py');
    continue;
  }
  const buf = fs.readFileSync(file);
  assetBytes += buf.length;
  packed[key] = 'data:image/png;base64,' + buf.toString('base64');
}
if (Object.keys(packed).length) {
  const payload = JSON.stringify(packed).replace(/</g, '\\u003c');
  const tag = '<script>window.HK_ASSETS=' + payload + ';</script>\n';
  html = html.replace('<script src="vendor/three.min.js"></script>', tag + '<script src="vendor/three.min.js"></script>');
}

// inline css
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/, '<style>\n' + css + '\n</style>');

// inline all script tags
const scriptRe = /<script src="([^"]+)"><\/script>/g;
let totalScript = 0;
html = html.replace(scriptRe, (m, src) => {
  const file = path.join(root, src);
  if (!fs.existsSync(file)) { console.warn('MISSING SCRIPT', src); return m; }
  let js = fs.readFileSync(file, 'utf8');
  totalScript += js.length;
  js = js.replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ==== ' + src + ' ==== */\n' + js + '\n</script>';
});

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'VictoriaHarbour.html');
fs.writeFileSync(out, html);

const external = (html.match(/<script src=/g) || []).length + (html.match(/<link rel="stylesheet"/g) || []).length;
const size = fs.statSync(out).size;
console.log('Built', out);
console.log('  html bytes :', html.length);
console.log('  js inlined :', (totalScript / 1024 / 1024).toFixed(2), 'MB');
console.log('  atlases    :', (assetBytes / 1024 / 1024).toFixed(2), 'MB raw /', Object.keys(packed).length, 'packed');
console.log('  total      :', (size / 1024 / 1024).toFixed(2), 'MB');
console.log('  external refs remaining:', external);
if (external) process.exitCode = 1;
if (Object.keys(packed).length < Object.keys(ASSETS).length) process.exitCode = 1;
