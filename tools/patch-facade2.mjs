import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file,'utf8'); let miss=0;
  for(const [a,b] of pairs){const before=s;s=s.replace(a,b);if(s===before){miss++;console.log('MISS',file,JSON.stringify(a.slice(0,70)));}}
  fs.writeFileSync(file,s); console.log(file,miss?miss+' misses':'ok');
}
patch('js/buildings.js', [
  ["    var tint = env && (env.horizonColor || env.skyHorizon);\n    if (tint) {\n      _uniforms.uSkyTint.value.copy(tint);\n      if (!env.colorsLinear) _uniforms.uSkyTint.value.convertSRGBToLinear();\n    } else {\n      _uniforms.uSkyTint.value.setRGB(0.62, 0.76, 0.85).multiplyScalar(1 - night * 0.8);\n    }",
   "    var tint = env && (env.horizonColor || env.skyHorizon);\n    var zen = env && (env.zenithColor || env.skyZenith);\n    if (zen && tint) {\n      _uniforms.uSkyTint.value.copy(zen);\n      _uniforms.uSkyTint.value.lerp(tint, 0.28);\n      if (!env.colorsLinear) _uniforms.uSkyTint.value.convertSRGBToLinear();\n    } else if (tint) {\n      _uniforms.uSkyTint.value.copy(tint);\n      if (!env.colorsLinear) _uniforms.uSkyTint.value.convertSRGBToLinear();\n    } else {\n      _uniforms.uSkyTint.value.setRGB(0.62, 0.76, 0.85).multiplyScalar(1 - night * 0.8);\n    }"]
]);
patch('js/landmarkkit.js', [
  ['  // screen-space distance fade: distant facades dissolve into their average\n',
   '  // low-frequency floor rhythm survives at skyline distance\n  float floorRhythm = step(0.5, fract(uv.y / (floorH * 5.0)));\n  albedo *= 0.955 + 0.045 * floorRhythm;\n\n  // screen-space distance fade: distant facades dissolve into their average\n']
]);
