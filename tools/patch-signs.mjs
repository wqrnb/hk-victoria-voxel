import fs from 'node:fs';
let s = fs.readFileSync('js/props.js','utf8'); let miss=0;
function rep(a,b){const before=s;s=s.replace(a,b);if(s===before){miss++;console.log('MISS',JSON.stringify(a.slice(0,70)));}}
// transparent sign atlas: no more opaque black panels blooming at dawn
rep("    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);", "    ctx.clearRect(0, 0, size, size);");
rep("        var bg = Math.random() < 0.45 ? pal[2] : '#0b0b0e';\n        ctx.fillStyle = bg; ctx.fillRect(x, y, cell, cell);",
    "        var bg = Math.random() < 0.45 ? pal[2] : '#0b0b0e';\n        ctx.globalAlpha = 0.55; ctx.fillStyle = bg; ctx.fillRect(x + 16, y + 16, cell - 32, cell - 32); ctx.globalAlpha = 1.0;");
// day signs much dimmer; clamp hot pixels
rep("        '  float glow = mix(0.62, 1.35, uNight) * flick;',", "        '  float glow = mix(0.32, 1.28, uNight) * flick;',");
rep("        '  vec3 c = t.rgb * vColor * glow;',", "        '  vec3 c = min(t.rgb * vColor * glow, vec3(2.0));',");
rep("        '  if (t.a < 0.16) discard;',", "        '  if (t.a < 0.12) discard;',");
fs.writeFileSync('js/props.js', s);
console.log('sign atlas patch', miss?miss+' misses':'ok');
