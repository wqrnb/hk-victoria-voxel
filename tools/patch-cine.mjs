import fs from 'node:fs';
let s=fs.readFileSync('js/layout.js','utf8');
const start = s.indexOf("    {\n      id: 'dawn', title: '維港晨曦'");
const endMarker = "    {\n      id: 'skyline', title: '中環天際線'";
const end = s.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) { console.log('MISS dawn block', start, end); process.exit(1); }
s = s.slice(0, start) + s.slice(end);
fs.writeFileSync('js/layout.js', s);
console.log('dawn cinematic shot removed');
const L = fs.readFileSync('docs/INTERFACES.md','utf8');
console.log('ok');
