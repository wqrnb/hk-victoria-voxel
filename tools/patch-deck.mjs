import fs from 'node:fs';
let s=fs.readFileSync('js/props.js','utf8');
const insertBefore = "  /* ---------------------------------------------------------------- build */";
const fn = `  /* boardwalk plank detail for the Tsim Sha Tsui Avenue of Stars deck */
  function buildBoardwalkDetails(world, cbMatte) {
    var cols = world.city && world.city.colliders;
    if (!cols) return 0;
    var wood = U.hexRgb('#8a7356'), dark = U.hexRgb('#685239');
    var n = 0;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (c.y1 < 2.0 || c.y1 > 2.4) continue;
      var w = c.x1 - c.x0, d = c.z1 - c.z0;
      if (w < 6 || w > 44 || d < 4 || d > 14) continue;
      if (c.z0 < -345 || c.z1 > -285) continue;
      var y = c.y1 + 0.015, cx = (c.x0 + c.x1) / 2;
      for (var zz = c.z0 + 0.55; zz < c.z1 - 0.2; zz += 1.15) {
        cbMatte.box(cx, y, zz, w - 0.5, 0.03, 0.06, dark);
      }
      cbMatte.box(cx, c.y1 + 0.03, c.z0 + 0.22, w - 0.2, 0.06, 0.22, wood);
      cbMatte.box(cx, c.y1 + 0.03, c.z1 - 0.22, w - 0.2, 0.06, 0.22, wood);
      n++;
    }
    return n;
  }

`;
s = s.replace(insertBefore, fn + insertBefore);
s = s.replace("    buildFlags(world, cbMatte);\n    buildPublicDetails", "    buildFlags(world, cbMatte);\n    var deck = buildBoardwalkDetails(world, cbMatte);\n    buildPublicDetails");
s = s.replace("billboards: boardCount, beacons: beaconCount, quads: cbMatte.v / 4 + cbGlow.v / 4", "billboards: boardCount, beacons: beaconCount, decks: deck, quads: cbMatte.v / 4 + cbGlow.v / 4");
fs.writeFileSync('js/props.js', s);
console.log('boardwalk detail added');
