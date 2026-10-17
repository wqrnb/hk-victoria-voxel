// Align colour-space semantics with skyward/post/water: core U.hexRgb is raw
// sRGB again; geometry authoring converts to linear at the point of writing.
import fs from 'node:fs';
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  let miss = 0;
  for (const [a, b] of pairs) { const before = s; s = s.replace(a, b); if (s === before) { miss++; console.log('MISS', file, JSON.stringify(a.slice(0, 70))); } }
  fs.writeFileSync(file, s);
  console.log(file, miss ? miss + ' misses' : 'ok');
}

patch('js/core.js', [
  [
    '  U.hexRgb = function (hex) {\n    if (typeof hex !== \'string\') return [hex[0], hex[1], hex[2]];\n    if (colorCache[hex]) return colorCache[hex];\n    var h = hex.replace(\'#\', \'\');\n    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];\n    var n = parseInt(h, 16);\n    var c = [U.srgbToLinear(((n >> 16) & 255) / 255), U.srgbToLinear(((n >> 8) & 255) / 255), U.srgbToLinear((n & 255) / 255)];\n    colorCache[hex] = c;\n    return c;\n  };',
    '  U.hexRgb = function (hex) {\n    if (typeof hex !== \'string\') return [hex[0], hex[1], hex[2]];\n    if (colorCache[hex]) return colorCache[hex];\n    var h = hex.replace(\'#\', \'\');\n    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];\n    var n = parseInt(h, 16);\n    var c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];\n    colorCache[hex] = c;\n    return c;\n  };\n  U.linRgb = function (hexOrRgb) {\n    var c = U.hexRgb(hexOrRgb);\n    return [U.srgbToLinear(c[0]), U.srgbToLinear(c[1]), U.srgbToLinear(c[2])];\n  };'
  ]
]);

patch('js/terrain.js', [
  [
    "  function pal(hex, variants, vAmt) {\n    var base = U.hexRgb(hex), ids = [];",
    "  function pal(hex, variants, vAmt) {\n    var base = U.linRgb(hex), ids = [];"
  ]
]);

patch('js/landmarkkit.js', [
  [
    "  Kit.prototype._res = function (o) {\n    o = o || {};\n    var color = o.color !== undefined ? U.hexRgb(o.color) : U.hexRgb(this.color);",
    "  function lin3(c) { return [U.srgbToLinear(c[0]), U.srgbToLinear(c[1]), U.srgbToLinear(c[2])]; }\n  Kit.prototype._res = function (o) {\n    o = o || {};\n    var color = o.color !== undefined ? U.hexRgb(o.color) : U.hexRgb(this.color);"
  ],
  [
    "    var roof = o.roofColor !== undefined ? U.hexRgb(o.roofColor) : (this.roofColor ? U.hexRgb(this.roofColor) : U.shadeRgb(color, 0.62));\n    return {\n      color: color,\n      roof: roof,",
    "    var roof = o.roofColor !== undefined ? U.hexRgb(o.roofColor) : (this.roofColor ? U.hexRgb(this.roofColor) : U.shadeRgb(color, 0.62));\n    color = lin3(color); roof = lin3(roof);\n    return {\n      color: color,\n      roof: roof,"
  ]
]);

patch('js/props.js', [
  [
    '  CB.prototype.quad = function (p0, p1, p2, p3, nx, ny, nz, rgb) {',
    '  CB.prototype.quad = function (p0, p1, p2, p3, nx, ny, nz, rgb) {\n    rgb = [U.srgbToLinear(rgb[0]), U.srgbToLinear(rgb[1]), U.srgbToLinear(rgb[2])];'
  ],
  [
    '  CB.prototype.tri = function (p0, p1, p2, nx, ny, nz, rgb) {',
    '  CB.prototype.tri = function (p0, p1, p2, nx, ny, nz, rgb) {\n    rgb = [U.srgbToLinear(rgb[0]), U.srgbToLinear(rgb[1]), U.srgbToLinear(rgb[2])];'
  ],
  [
    '      var soft = [Math.pow(col[0], 2.2), Math.pow(col[1], 2.2), Math.pow(col[2], 2.2)];',
    '      var soft = [Math.pow(col[0], 2.2), Math.pow(col[1], 2.2), Math.pow(col[2], 2.2)];'
  ]
]);
