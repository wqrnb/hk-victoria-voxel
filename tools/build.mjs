// Build a fully self-contained single-file deliverable:
//   dist/VictoriaHarbour.html   (works from file:// — no server, no network)
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// inline css
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/, '<style>\n' + css + '\n</style>');

// inline all script tags
const scriptRe = /<script src="([^"]+)"><\/script>/g;
const inlined = [];
let totalScript = 0;
html = html.replace(scriptRe, (m, src) => {
  const file = path.join(root, src);
  if (!fs.existsSync(file)) { console.warn('MISSING SCRIPT', src); inlined.push(m); return m; }
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
console.log('  total      :', (size / 1024 / 1024).toFixed(2), 'MB');
console.log('  external refs remaining:', external);
if (external) process.exitCode = 1;
