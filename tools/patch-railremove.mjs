import fs from 'node:fs';
let s = fs.readFileSync('js/props.js','utf8');
const start = s.indexOf("      // continuous rails (cheap: long thin boxes between points)");
const end = s.indexOf("    }\n    return count;\n  }\n\n  function buildTrees");
if (start < 0 || end < 0) { console.log('MISS rail block'); process.exit(1); }
s = s.slice(0, start) + "      // (continuous rails removed: thin distant lines caused skyline moire) \n" + s.slice(end);
fs.writeFileSync('js/props.js', s);
console.log('continuous rails removed');
