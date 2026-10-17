import fs from 'node:fs';
let s = fs.readFileSync('js/props.js','utf8');
s = s.replace("    var lampCount = buildStreetLights(world, cbMatte, cbGlow, pools);\n    var railCount = buildRailings(world, cbMatte);",
  "    var skipStreet = /skipstreet=1/.test(location.search);\n    var lampCount = skipStreet ? 0 : buildStreetLights(world, cbMatte, cbGlow, pools);\n    var railCount = skipStreet ? 0 : buildRailings(world, cbMatte);");
s = s.replace("    buildPromenadeFurniture(world, cbMatte);\n    buildFlags(world, cbMatte);\n    buildPublicDetails(world, layout, cbMatte, cbGlow);",
  "    if (!skipStreet) { buildPromenadeFurniture(world, cbMatte); buildFlags(world, cbMatte); buildPublicDetails(world, layout, cbMatte, cbGlow); }");
fs.writeFileSync('js/props.js', s);
console.log('skipstreet flag added');
