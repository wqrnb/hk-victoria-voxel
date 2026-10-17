/* ============================================================================
 * HK VOXEL HARBOUR — TERRAIN
 * Voxel heightfield, land-use / roads, greedy-meshed geometry (top faces +
 * merged wall runs), distant mountain ranges and a shoreline mask texture.
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util, L = HK.Layout;

  var T = HK.TERRAIN_TYPE = {
    WATER: 0, PLOT: 1, ROAD: 2, ROAD_MAIN: 3, ROAD_MARK: 4, SIDEWALK: 5,
    PROMENADE: 6, PLAZA: 7, PARK: 8, LAWN: 9, FOREST: 10, ROCK: 11,
    TERRACE: 12, RUNWAY: 13, BREAKWATER: 14, ISLAND_ROCK: 15, ISLAND_FOREST: 16,
    WALL: 17, SAND: 18
  };
  var FLAG_RESERVED = 1, FLAG_PARK = 2, FLAG_PROMENADE = 4, FLAG_PLOT = 8;
  var WATER_BOTTOM = -4;

  /* --------------------------------------------------------------- palette */
  var PAL = [];
  function pal(hex, variants, vAmt) {
    var base = U.linRgb(hex), ids = [];
    variants = variants || 1; vAmt = vAmt == null ? 0.035 : vAmt;
    for (var i = 0; i < variants; i++) {
      var f = 1 + (i - (variants - 1) / 2) * vAmt * 2;
      PAL.push(U.shadeRgb(base, f));
      ids.push(PAL.length - 1);
    }
    return ids;
  }
  var TYPE_PAL = {};
  TYPE_PAL[T.PLOT] = pal('#3e3c37', 1, 0.04);
  TYPE_PAL[T.ROAD] = pal('#2b2d31', 1, 0.03);
  TYPE_PAL[T.ROAD_MAIN] = pal('#26282c', 1, 0.03);
  TYPE_PAL[T.ROAD_MARK] = pal('#d6d3c4', 1, 0.04);
  TYPE_PAL[T.SIDEWALK] = pal('#75726b', 1, 0.04);
  TYPE_PAL[T.PROMENADE] = pal('#968770', 2, 0.04);
  TYPE_PAL[T.PLAZA] = pal('#8a867f', 1, 0.035);
  TYPE_PAL[T.PARK] = pal('#49623a', 3, 0.06);
  TYPE_PAL[T.LAWN] = pal('#5f7444', 3, 0.05);
  TYPE_PAL[T.FOREST] = pal('#293f28', 4, 0.07);
  TYPE_PAL[T.ROCK] = pal('#6d6960', 3, 0.05);
  TYPE_PAL[T.TERRACE] = pal('#79766f', 1, 0.04);
  TYPE_PAL[T.RUNWAY] = pal('#2c2e31', 1, 0.02);
  TYPE_PAL[T.BREAKWATER] = pal('#6e6b63', 1, 0.04);
  TYPE_PAL[T.ISLAND_ROCK] = pal('#605c53', 2, 0.05);
  TYPE_PAL[T.ISLAND_FOREST] = pal('#34482f', 2, 0.06);
  TYPE_PAL[T.SAND] = pal('#c2ae84', 2, 0.04);
  TYPE_PAL[T.WALL] = pal('#68655e', 2, 0.04);
  var HIGH_ROCK = pal('#7d786e', 2, 0.05);
  var HIGH_FOREST = pal('#3a5231', 2, 0.06);

  /* ------------------------------------------------------------ grid data */
  var W, H, MINX, MINZ, N;
  var heightArr, typeArr, flagArr, colorArr, roadArr, districtArr;
  var HW, HH, HSTEP = 4, heightLUT;

  function idx(x, z) {
    var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);
    if (i < 0 || i >= W || j < 0 || j >= H) return -1;
    return j * W + i;
  }
  function hash2(i, j, s) { return U.hash3(i, j, s || 0); }

  function chooseColor(i, j, type) {
    var list = TYPE_PAL[type] || TYPE_PAL[T.PLOT];
    if (list.length === 1) return list[0];
    var block = (type === T.FOREST || type === T.ROCK || type === T.PARK || type === T.LAWN || type === T.ISLAND_FOREST) ? 4 : 2;
    var r = U.hash3(i >> block, j >> block, 7 + type);
    return list[Math.floor(r * list.length) % list.length];
  }

  function buildCoarseHeightLUT() {
    HW = Math.ceil(W / HSTEP); HH = Math.ceil(H / HSTEP);
    heightLUT = new Int16Array(HW * HH);
    for (var j = 0; j < HH; j++) {
      for (var i = 0; i < HW; i++) {
        var x = MINX + (i + 0.5) * HSTEP;
        var z = MINZ + (j + 0.5) * HSTEP;
        var v = -1;
        if (!L.isWater(x, z)) v = Math.max(1, L.terrainHeight(x, z));
        heightLUT[j * HW + i] = v;
      }
    }
  }

  function sampleCoarseHeight(x, z) {
    var i = Math.floor((x - MINX) / HSTEP), j = Math.floor((z - MINZ) / HSTEP);
    i = U.clamp(i, 0, HW - 1); j = U.clamp(j, 0, HH - 1);
    var v = heightLUT[j * HW + i];
    return v < 1 ? 1 : v;
  }

  /* ---------------------------------------------------------------- pass 1 */
  function buildHeightAndWater(onProgress) {
    MINX = L.BOUNDS.minX; MINZ = L.BOUNDS.minZ;
    W = L.BOUNDS.maxX - MINX;
    H = L.BOUNDS.maxZ - MINZ;
    N = W * H;
    heightArr = new Int16Array(N);
    typeArr = new Uint8Array(N);
    flagArr = new Uint8Array(N);
    colorArr = new Uint8Array(N);
    roadArr = new Uint8Array(N);
    districtArr = new Uint8Array(N);

    buildCoarseHeightLUT();

    return new Promise(function (resolve) {
      var j = 0, chunk = 80;
      function step() {
        var end = Math.min(H, j + chunk);
        for (; j < end; j++) {
          var z = MINZ + j + 0.5;
          for (var i = 0; i < W; i++) {
            var x = MINX + i + 0.5;
            var n = j * W + i;
            if (L.isWater(x, z)) {
              heightArr[n] = -1; typeArr[n] = T.WATER; continue;
            }
            var ov = L.landOverride(x, z);
            var h;
            if (ov) {
              h = ov.h;
            } else {
              var hillF = z > 0 ? L.islandSlopeFactor(z) : L.klSlopeFactor(z);
              if (hillF > 0.001) {
                h = sampleCoarseHeight(x, z);
              } else {
                h = 1;
              }
            }
            if (h < 1) h = 1;
            heightArr[n] = h;
            if (ov) {
              typeArr[n] = ov.type === 'runway' ? T.RUNWAY : (ov.type === 'breakwater' ? T.BREAKWATER : (h > 8 ? T.ISLAND_ROCK : T.ISLAND_FOREST));
            } else if (h > 26) {
              var veg = U.fbm2(x * 0.011 + 41, z * 0.011 - 17, 3);
              typeArr[n] = (h > 205 || (h > 150 && veg < 0.44) || veg < 0.3) ? T.ROCK : T.FOREST;
            } else if (h > 12) {
              var builtUp = (z > 0 && z < 700) || (z < 0 && z > -790);
              typeArr[n] = builtUp ? T.TERRACE : T.FOREST;
            } else {
              typeArr[n] = T.PLOT;
            }
          }
        }
        if (onProgress) onProgress(Math.floor(j / H * 30), '正在塑造海岸線…');
        if (j < H) setTimeout(step, 0); else resolve();
      }
      step();
    });
  }

  /* ---------------------------------------------------------- districts */
  function rasterDistricts() {
    var order = L.DISTRICTS.slice().sort(function (a, b) {
      return (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]) - (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]);
    });
    var index = {};
    for (var i = 0; i < L.DISTRICTS.length; i++) index[L.DISTRICTS[i].id] = i + 1;
    for (var d = 0; d < order.length; d++) {
      var dd = order[d], r = dd.rect;
      var i0 = Math.max(0, Math.floor(r[0] - MINX)), i1 = Math.min(W - 1, Math.ceil(r[2] - MINX));
      var j0 = Math.max(0, Math.floor(r[1] - MINZ)), j1 = Math.min(H - 1, Math.ceil(r[3] - MINZ));
      var id = index[dd.id];
      for (var j = j0; j <= j1; j++) {
        var z = MINZ + j + 0.5;
        for (var i = i0; i <= i1; i++) {
          var x = MINX + i + 0.5;
          if (x < r[0] || x > r[2] || z < r[1] || z > r[3]) continue;
          var n = j * W + i;
          if (typeArr[n] !== T.WATER) districtArr[n] = id;
        }
      }
    }
  }

  /* ------------------------------------------------------------- parks etc */
  function rasterParks() {
    for (var p = 0; p < L.PARKS.length; p++) {
      var park = L.PARKS[p], poly = park.poly;
      var bb = U.polyBBox(poly);
      var i0 = Math.max(0, Math.floor(bb.minX - MINX)), i1 = Math.min(W - 1, Math.ceil(bb.maxX - MINX));
      var j0 = Math.max(0, Math.floor(bb.minZ - MINZ)), j1 = Math.min(H - 1, Math.ceil(bb.maxZ - MINZ));
      var pt = park.type === 'plaza' ? T.PLAZA : (park.type === 'lawn' ? T.LAWN : (park.type === 'promenade' ? T.PROMENADE : T.PARK));
      for (var j = j0; j <= j1; j++) {
        for (var i = i0; i <= i1; i++) {
          var n = j * W + i;
          if (typeArr[n] === T.WATER || typeArr[n] === T.RUNWAY) continue;
          var x = MINX + i + 0.5, z = MINZ + j + 0.5;
          if (!U.pointInPoly(x, z, poly)) continue;
          typeArr[n] = pt;
          flagArr[n] |= FLAG_PARK;
          if (park.type === 'promenade') flagArr[n] |= FLAG_PROMENADE;
        }
      }
    }
  }

  function rasterReserved() {
    for (var r = 0; r < L.RESERVED.length; r++) {
      var rr = L.RESERVED[r];
      var kind = rr[4] || 'plaza';
      var i0 = Math.max(0, Math.floor(rr[0] - MINX)), i1 = Math.min(W - 1, Math.ceil(rr[2] - MINX));
      var j0 = Math.max(0, Math.floor(rr[1] - MINZ)), j1 = Math.min(H - 1, Math.ceil(rr[3] - MINZ));
      for (var j = j0; j <= j1; j++) {
        for (var i = i0; i <= i1; i++) {
          var n = j * W + i;
          if (typeArr[n] === T.WATER || typeArr[n] === T.RUNWAY || typeArr[n] === T.BREAKWATER) continue;
          flagArr[n] |= FLAG_RESERVED;
          if (kind === 'plaza') typeArr[n] = T.PLAZA;
          else if (kind === 'park') { typeArr[n] = T.PARK; flagArr[n] |= FLAG_PARK; }
          else if (kind === 'promenade') { typeArr[n] = T.PROMENADE; flagArr[n] |= FLAG_PROMENADE; }
        }
      }
    }
  }

  function rasterPromenade() {
    for (var j = 0; j < H; j++) {
      var z = MINZ + j + 0.5;
      for (var i = 0; i < W; i++) {
        var n = j * W + i;
        if (typeArr[n] === T.WATER) continue;
        if (flagArr[n] & FLAG_RESERVED) continue;
        if (typeArr[n] === T.RUNWAY || typeArr[n] === T.BREAKWATER || typeArr[n] === T.ISLAND_ROCK || typeArr[n] === T.ISLAND_FOREST) continue;
        var x = MINX + i + 0.5;
        if (L.shoreDistance(x, z) < 9) {
          typeArr[n] = T.PROMENADE;
          flagArr[n] |= FLAG_PROMENADE;
        }
      }
    }
  }

  /* ---------------------------------------------------------------- roads */
  function brush(x, z, radius, type) {
    var i0 = Math.floor(x - MINX - radius), i1 = Math.ceil(x - MINX + radius);
    var j0 = Math.floor(z - MINZ - radius), j1 = Math.ceil(z - MINZ + radius);
    i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(W - 1, i1); j1 = Math.min(H - 1, j1);
    var r2 = (radius + 0.4) * (radius + 0.4);
    for (var j = j0; j <= j1; j++) {
      var dz = (MINZ + j + 0.5) - z;
      for (var i = i0; i <= i1; i++) {
        var dx = (MINX + i + 0.5) - x;
        if (dx * dx + dz * dz > r2) continue;
        var n = j * W + i;
        if (typeArr[n] === T.WATER) continue;
        if (flagArr[n] & FLAG_RESERVED) continue;
        if (flagArr[n] & FLAG_PARK) continue;
        typeArr[n] = type;
        roadArr[n] = (type === T.ROAD_MAIN) ? 2 : 1;
      }
    }
  }

  function rasterRoadsPolyline(pts, width, type, markDash) {
    var total = L.polylineLength(pts);
    if (total < 1) return;
    for (var d = 0; d <= total; d += 1.3) {
      var p = L.polylinePointAtDistance(pts, d);
      brush(p.x, p.z, width * 0.5, type);
      if (markDash && (d % 9) < 4.2) {
        var n = idx(p.x, p.z);
        if (n >= 0 && (typeArr[n] === T.ROAD_MAIN || typeArr[n] === T.ROAD || typeArr[n] === T.ROAD_MARK)) typeArr[n] = T.ROAD_MARK;
      }
    }
  }

  var GRID_ANGLES = {
    central: 0.02, admiralty: 0.02, sheungwan: 0.05, kennedy: 0.08,
    wanchai: 0.05, causeway: -0.04, northpoint: 0.02, quarrybay: 0.04,
    saikeiwan: 0.12, chaiwan: 0.14, peakmid: 0.1,
    tst: 0.0, jordan: 0.0, mongkok: 0.02, shamshuipo: 0.03,
    westkl: 0.12, westkowloon: 0.18, homantin: 0.2, hunghom: 0.35,
    tokwawan: 0.3, kaitak: 0.52, kowloonbay: 0.42, kwuntong: 0.5
  };

  function generateStreetGrids(onProgress) {
    var districts = L.DISTRICTS;
    for (var di = 0; di < districts.length; di++) {
      var d = districts[di];
      if (d.hill) continue;
      var r = d.rect;
      var cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
      var angle = GRID_ANGLES[d.id] || 0;
      var ca = Math.cos(angle), sa = Math.sin(angle);
      var halfW = (r[2] - r[0]) / 2, halfD = (r[3] - r[1]) / 2;
      var diag = Math.sqrt(halfW * halfW + halfD * halfD) + 4;
      var spacing = 44 + (1 - d.density) * 26;
      var streetW = d.density > 0.85 ? 6.4 : 5.8;

      for (var pass = 0; pass < 2; pass++) {
        for (var a = -diag; a <= diag; a += spacing) {
          for (var b = -diag; b <= diag; b += 2.6) {
            var u = pass === 0 ? b : a;
            var v = pass === 0 ? a : b;
            var x = cx + u * ca - v * sa;
            var z = cz + u * sa + v * ca;
            if (x < r[0] + 2 || x > r[2] - 2 || z < r[1] + 2 || z > r[3] - 2) continue;
            var n = idx(x, z);
            if (n < 0) continue;
            if (typeArr[n] === T.WATER || (flagArr[n] & FLAG_RESERVED) || (flagArr[n] & FLAG_PARK)) continue;
            if (heightArr[n] > 16) continue;
            brush(x, z, streetW * 0.5, T.ROAD);
          }
        }
      }
      if (onProgress) onProgress(44 + Math.floor(di / districts.length * 12), '正在鋪設街道…');
    }
  }

  function rasterMainRoads(onProgress) {
    for (var i = 0; i < L.ROADS.length; i++) {
      var r = L.ROADS[i];
      if (r.type === 'track' || r.type === 'tunnel') continue;
      var type = (r.type === 'main') ? T.ROAD_MAIN : T.ROAD;
      rasterRoadsPolyline(r.pts, r.width, type, r.type === 'main');
      if (onProgress && i % 5 === 0) onProgress(58 + Math.floor(i / L.ROADS.length * 8), '正在開闢主幹道…');
    }
  }

  function markSidewalks(onProgress) {
    var out = new Uint8Array(N);
    for (var j = 2; j < H - 2; j++) {
      for (var i = 2; i < W - 2; i++) {
        var n = j * W + i;
        if (!roadArr[n]) continue;
        for (var dj = -2; dj <= 2; dj++) {
          for (var di = -2; di <= 2; di++) {
            var m = (j + dj) * W + (i + di);
            if (roadArr[m]) continue;
            var t = typeArr[m];
            if (t === T.PLOT || t === T.PLAZA || t === T.TERRACE) out[m] = 1;
          }
        }
      }
      if (j % 400 === 0 && onProgress) onProgress(68 + Math.floor(j / H * 8), '正在修建行人路…');
    }
    for (var k = 0; k < N; k++) if (out[k]) typeArr[k] = T.SIDEWALK;
  }

  function finalizeColors() {
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        var n = j * W + i;
        var type = typeArr[n];
        if (type === T.WATER) continue;
        var h = heightArr[n];
        var ci;
        if (type === T.ROCK && h > 185) ci = HIGH_ROCK[Math.floor(hash2(i, j, 11) * HIGH_ROCK.length)];
        else if (type === T.FOREST && h > 120) ci = HIGH_FOREST[Math.floor(hash2(i, j, 13) * HIGH_FOREST.length)];
        else ci = chooseColor(i, j, type);
        colorArr[n] = ci;
        if (type === T.PLOT || type === T.PLAZA || type === T.TERRACE) flagArr[n] |= FLAG_PLOT;
      }
    }
  }

  /* --------------------------------------------------------- mesh builder */
  function buildTerrainGeometry(onProgress) {
    var pos = [], nrm = [], col = [], idxs = [];
    var vcount = 0, quads = 0, wallQuads = 0;
    function pushQuad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, rgb) {
      var base = vcount;
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
      col.push(rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2]);
      idxs.push(base, base + 1, base + 2, base, base + 2, base + 3);
      vcount += 4; quads++;
    }
    var visited = new Uint8Array(N);
    var j, i, n;

    // --- top faces (greedy rectangles)
    for (j = 0; j < H; j++) {
      for (i = 0; i < W; i++) {
        n = j * W + i;
        if (visited[n] || typeArr[n] === T.WATER) continue;
        var h = heightArr[n], c = colorArr[n];
        var w = 1;
        while (i + w < W) {
          var nn = n + w;
          if (visited[nn] || typeArr[nn] === T.WATER || heightArr[nn] !== h || colorArr[nn] !== c) break;
          w++;
        }
        var d = 1;
        outer: while (j + d < H) {
          var row = (j + d) * W + i;
          for (var k = 0; k < w; k++) {
            var mm = row + k;
            if (visited[mm] || typeArr[mm] === T.WATER || heightArr[mm] !== h || colorArr[mm] !== c) break outer;
          }
          d++;
        }
        for (var jj = 0; jj < d; jj++) {
          var baseN = (j + jj) * W + i;
          for (var ii = 0; ii < w; ii++) visited[baseN + ii] = 1;
        }
        var x0 = MINX + i, x1 = x0 + w, z0 = MINZ + j, z1 = z0 + d;
        pushQuad(x0, h, z0, x0, h, z1, x1, h, z1, x1, h, z0, 0, 1, 0, PAL[c]);
      }
      if ((j & 255) === 0 && onProgress) onProgress(76 + Math.floor(j / H * 8), '正在堆疊地勢…');
    }

    // --- wall colours
    function wallColorFor(type, toWater) {
      var palId;
      if (toWater) palId = TYPE_PAL[T.BREAKWATER][0];
      else if (type === T.FOREST || type === T.PARK || type === T.LAWN) palId = TYPE_PAL[T.FOREST][0];
      else if (type === T.ROCK || type === T.ISLAND_ROCK) palId = TYPE_PAL[T.ROCK][0];
      else if (type === T.RUNWAY) palId = TYPE_PAL[T.RUNWAY][0];
      else palId = TYPE_PAL[T.TERRACE][0];
      return palId;
    }
    function emitWallRun(i, jStart, jEnd, dir) {
      // dir 0:+X 1:-X 2:+Z 3:-Z ; jStart..jEnd-1 cells along run axis
      var n0 = jStart * W + i;
      var hTop = heightArr[n0];
      var top = hTop;
      var bottom;
      var colId;
      var x0 = MINX + i, z0 = MINZ + jStart, x1 = x0 + 1, z1 = MINZ + jEnd;
      if (dir === 0) {
        var en = i + 1 < W ? n0 + 1 : -1;
        bottom = (en < 0 || typeArr[en] === T.WATER) ? WATER_BOTTOM : heightArr[en];
        colId = wallColorFor(typeArr[n0], en < 0 || typeArr[en] === T.WATER);
        pushQuad(x1, bottom, z0, x1, top, z0, x1, top, z1, x1, bottom, z1, 1, 0, 0, PAL[colId]);
      } else if (dir === 1) {
        var wn = i > 0 ? n0 - 1 : -1;
        bottom = (wn < 0 || typeArr[wn] === T.WATER) ? WATER_BOTTOM : heightArr[wn];
        colId = wallColorFor(typeArr[n0], wn < 0 || typeArr[wn] === T.WATER);
        pushQuad(x0, bottom, z1, x0, top, z1, x0, top, z0, x0, bottom, z0, -1, 0, 0, PAL[colId]);
      } else if (dir === 2) {
        // wall on +Z side, run along X: (iStart..iEnd, fixed j)
        var sn = (jStart + 1) < H ? n0 + W : -1;
        bottom = (sn < 0 || typeArr[sn] === T.WATER) ? WATER_BOTTOM : heightArr[sn];
        colId = wallColorFor(typeArr[n0], sn < 0 || typeArr[sn] === T.WATER);
        pushQuad(x1, bottom, z1, x1, top, z1, x0, top, z1, x0, bottom, z1, 0, 0, 1, PAL[colId]);
      } else {
        var nn2 = (jStart - 1) >= 0 ? n0 - W : -1;
        bottom = (nn2 < 0 || typeArr[nn2] === T.WATER) ? WATER_BOTTOM : heightArr[nn2];
        colId = wallColorFor(typeArr[n0], nn2 < 0 || typeArr[nn2] === T.WATER);
        pushQuad(x0, bottom, z0, x0, top, z0, x1, top, z0, x1, bottom, z0, 0, 0, -1, PAL[colId]);
      }
      wallQuads++;
    }

    // --- merged wall runs (4 directions)
    // +X and -X walls: runs along z (j)
    for (i = 0; i < W; i++) {
      for (var dirX = 0; dirX < 2; dirX++) {
        j = 0;
        while (j < H) {
          n = j * W + i;
          var lower = false, bottomH = WATER_BOTTOM, toWater = false;
          if (typeArr[n] !== T.WATER) {
            if (dirX === 0) {
              if (i + 1 >= W) { lower = true; toWater = true; }
              else { var e = n + 1; if (typeArr[e] === T.WATER) { lower = true; toWater = true; } else if (heightArr[e] < heightArr[n]) { lower = true; bottomH = heightArr[e]; } }
            } else {
              if (i <= 0) { lower = true; toWater = true; }
              else { var ww = n - 1; if (typeArr[ww] === T.WATER) { lower = true; toWater = true; } else if (heightArr[ww] < heightArr[n]) { lower = true; bottomH = heightArr[ww]; } }
            }
          }
          if (!lower) { j++; continue; }
          var hTop = heightArr[n];
          var cid = wallColorFor(typeArr[n], toWater);
          var jEnd = j + 1;
          while (jEnd < H) {
            var n2 = jEnd * W + i;
            if (typeArr[n2] === T.WATER) break;
            if (heightArr[n2] !== hTop) break;
            var lb = false, bb = WATER_BOTTOM, tw = false;
            if (dirX === 0) {
              if (i + 1 >= W) { lb = true; tw = true; }
              else { var e2 = n2 + 1; if (typeArr[e2] === T.WATER) { lb = true; tw = true; } else if (heightArr[e2] < hTop) { lb = true; bb = heightArr[e2]; } }
            } else {
              if (i <= 0) { lb = true; tw = true; }
              else { var w2 = n2 - 1; if (typeArr[w2] === T.WATER) { lb = true; tw = true; } else if (heightArr[w2] < hTop) { lb = true; bb = heightArr[w2]; } }
            }
            if (!lb || bb !== bottomH || tw !== toWater) break;
            if (wallColorFor(typeArr[n2], tw) !== cid) break;
            jEnd++;
          }
          emitWallRun(i, j, jEnd, dirX);
          j = jEnd;
        }
      }
    }
    // +Z and -Z walls: runs along x (i)
    for (j = 0; j < H; j++) {
      for (var dirZ = 0; dirZ < 2; dirZ++) {
        i = 0;
        while (i < W) {
          n = j * W + i;
          var lowerZ = false, bottomZ = WATER_BOTTOM, toWaterZ = false;
          if (typeArr[n] !== T.WATER) {
            if (dirZ === 0) {
              if (j + 1 >= H) { lowerZ = true; toWaterZ = true; }
              else { var s = n + W; if (typeArr[s] === T.WATER) { lowerZ = true; toWaterZ = true; } else if (heightArr[s] < heightArr[n]) { lowerZ = true; bottomZ = heightArr[s]; } }
            } else {
              if (j <= 0) { lowerZ = true; toWaterZ = true; }
              else { var no = n - W; if (typeArr[no] === T.WATER) { lowerZ = true; toWaterZ = true; } else if (heightArr[no] < heightArr[n]) { lowerZ = true; bottomZ = heightArr[no]; } }
            }
          }
          if (!lowerZ) { i++; continue; }
          var hTopZ = heightArr[n];
          var cidZ = wallColorFor(typeArr[n], toWaterZ);
          var iEnd = i + 1;
          while (iEnd < W) {
            var n3 = j * W + iEnd;
            if (typeArr[n3] === T.WATER) break;
            if (heightArr[n3] !== hTopZ) break;
            var lz = false, bz = WATER_BOTTOM, twz = false;
            if (dirZ === 0) {
              if (j + 1 >= H) { lz = true; twz = true; }
              else { var s2 = n3 + W; if (typeArr[s2] === T.WATER) { lz = true; twz = true; } else if (heightArr[s2] < hTopZ) { lz = true; bz = heightArr[s2]; } }
            } else {
              if (j <= 0) { lz = true; twz = true; }
              else { var n4 = n3 - W; if (typeArr[n4] === T.WATER) { lz = true; twz = true; } else if (heightArr[n4] < hTopZ) { lz = true; bz = heightArr[n4]; } }
            }
            if (!lz || bz !== bottomZ || twz !== toWaterZ) break;
            if (wallColorFor(typeArr[n3], twz) !== cidZ) break;
            iEnd++;
          }
          // emit run along x: adapt helper by swapping axes
          var xA = MINX + i, xB = MINX + iEnd, zEdge = MINZ + (dirZ === 0 ? j + 1 : j);
          var bottomE = bottomZ, topE = hTopZ;
          var colE = PAL[cidZ];
          if (dirZ === 0) {
            pushQuad(xB, bottomE, zEdge, xB, topE, zEdge, xA, topE, zEdge, xA, bottomE, zEdge, 0, 0, 1, colE);
          } else {
            pushQuad(xA, bottomE, zEdge, xA, topE, zEdge, xB, topE, zEdge, xB, bottomE, zEdge, 0, 0, -1, colE);
          }
          wallQuads++;
          i = iEnd;
        }
      }
      if ((j & 255) === 0 && onProgress) onProgress(86 + Math.floor(j / H * 8), '正在刻劃懸崖與海堤…');
    }

    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(idxs, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return { geometry: g, quads: quads, wallQuads: wallQuads, vertices: vcount };
  }

  /* --------------------------------------------------- distant mountain ring */
  function buildDistantRanges() {
    var group = new THREE.Group();
    var batch = new HK.Batch(HK.ATTRS_COLOR);
    var rng = new HK.Rng(7713);
    function ridge(x0, x1, z0, z1, step, baseH, amp, color) {
      var nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
      var hs = new Float32Array((nx + 1) * (nz + 1));
      for (var j = 0; j <= nz; j++) {
        for (var i = 0; i <= nx; i++) {
          var x = x0 + i * step, z = z0 + j * step;
          var n = U.ridge2(x * 0.0016 + 100, z * 0.0016 - 50, 4);
          var n2 = U.fbm2(x * 0.004 + 33, z * 0.004 + 11, 3);
          hs[j * (nx + 1) + i] = baseH + (n * 0.8 + n2 * 0.2) * amp * (0.55 + 0.45 * U.vnoise2(x * 0.002, z * 0.002));
        }
      }
      for (var jj = 0; jj < nz; jj++) {
        for (var ii = 0; ii < nx; ii++) {
          var xA = x0 + ii * step, xB = xA + step, zA = z0 + jj * step, zB = zA + step;
          var hA = hs[jj * (nx + 1) + ii], hB = hs[jj * (nx + 1) + ii + 1], hC = hs[(jj + 1) * (nx + 1) + ii + 1], hD = hs[(jj + 1) * (nx + 1) + ii];
          var c = U.jitterRgb(color, 0.08, rng);
          batch.addQuad([xA, hA, zA], [xA, hD, zB], [xB, hC, zB], [xB, hB, zA], 0, 1, 0, c);
        }
      }
    }
    var far = U.hexRgb('#7d939e'), far2 = U.hexRgb('#889ca6'), far3 = U.hexRgb('#93a5ad');
    ridge(-3400, 3400, -3400, -1800, 76, 120, 340, far);
    ridge(-3400, 3400, 1800, 3400, 76, 135, 360, far2);
    ridge(-3400, -2400, -2300, 2300, 76, 100, 280, far3);
    ridge(2400, 3400, -2300, 2300, 76, 100, 260, far3);
    ridge(-5600, 5600, -5400, -3400, 120, 220, 560, U.hexRgb('#6c838f'));
    ridge(-5600, 5600, 3400, 5400, 120, 240, 600, U.hexRgb('#677e8a'));
    var geo = batch.build();
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, fog: true, roughness: 1.0, metalness: 0.0 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'distantRanges';
    group.add(mesh);
    return group;
  }

  /* ------------------------------------------------------ shoreline mask */
  function buildShoreMask() {
    var mw = 512, mh = 256;
    var canvas = U.makeCanvas(mw, mh);
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(mw, mh);
    var land = new Uint8Array(mw * mh);
    var i, j;
    for (j = 0; j < mh; j++) {
      for (i = 0; i < mw; i++) {
        var x = MINX + (i + 0.5) / mw * W;
        var z = MINZ + (j + 0.5) / mh * H;
        land[j * mw + i] = L.isWater(x, z) ? 0 : 1;
      }
    }
    var INF = 1e6, w1 = 1, w2 = 1.414;
    var dist = new Float32Array(mw * mh);
    for (i = 0; i < dist.length; i++) dist[i] = land[i] ? 0 : INF;
    for (j = 0; j < mh; j++) {
      for (i = 0; i < mw; i++) {
        var n = j * mw + i;
        if (dist[n] === 0) continue;
        var d = dist[n];
        if (i > 0) d = Math.min(d, dist[n - 1] + w1);
        if (j > 0) d = Math.min(d, dist[n - mw] + w1);
        if (i > 0 && j > 0) d = Math.min(d, dist[n - mw - 1] + w2);
        if (i < mw - 1 && j > 0) d = Math.min(d, dist[n - mw + 1] + w2);
        dist[n] = d;
      }
    }
    for (j = mh - 1; j >= 0; j--) {
      for (i = mw - 1; i >= 0; i--) {
        var n2 = j * mw + i;
        if (dist[n2] === 0) continue;
        var d2 = dist[n2];
        if (i < mw - 1) d2 = Math.min(d2, dist[n2 + 1] + w1);
        if (j < mh - 1) d2 = Math.min(d2, dist[n2 + mw] + w1);
        if (i < mw - 1 && j < mh - 1) d2 = Math.min(d2, dist[n2 + mw + 1] + w2);
        if (i > 0 && j < mh - 1) d2 = Math.min(d2, dist[n2 + mw - 1] + w2);
        dist[n2] = d2;
      }
    }
    for (i = 0; i < mw * mh; i++) {
      var px = i * 4;
      var isLand = land[i];
      var prox = 1 - U.clamp(dist[i] / 9, 0, 1);
      img.data[px] = isLand ? 255 : 0;
      img.data[px + 1] = Math.round(prox * 255);
      img.data[px + 2] = isLand ? 0 : Math.round(U.clamp(dist[i] / 40, 0, 1) * 255);
      img.data[px + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return { canvas: canvas, texture: tex, width: mw, height: mh, bounds: { minX: MINX, maxX: MINX + W, minZ: MINZ, maxZ: MINZ + H } };
  }

  /* ----------------------------------------------------------------- build */
  async function build(layout, opts, onProgress) {
    opts = opts || {};
    onProgress = onProgress || function () {};
    onProgress(0, '正在重塑海岸線…');
    await buildHeightAndWater(onProgress);
    onProgress(30, '正在填海造地…');
    await new Promise(function (r) { setTimeout(r, 0); });
    rasterDistricts();
    rasterParks();
    rasterReserved();
    rasterPromenade();
    onProgress(42, '正在規劃市區…');
    await new Promise(function (r) { setTimeout(r, 0); });
    generateStreetGrids(onProgress);
    rasterMainRoads(onProgress);
    onProgress(67, '正在劃設街道網絡…');
    markSidewalks(onProgress);
    finalizeColors();
    onProgress(76, '正在塑造山巒…');
    await new Promise(function (r) { setTimeout(r, 0); });

    var geo = buildTerrainGeometry(onProgress);
    onProgress(96, '正在鋪設地磚…');
    await new Promise(function (r) { setTimeout(r, 0); });

    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.01 });
    mat.onBeforeCompile = function (shader) {
      shader.vertexShader = 'varying vec3 vTerrPos;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTerrPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
      shader.fragmentShader = 'varying vec3 vTerrPos;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n' +
        'vec2 tp = vTerrPos.xz;\n' +
        'float tn = fract(sin(dot(floor(tp*0.55), vec2(12.9898,78.233)))*43758.5453);\n' +
        'float tn2 = fract(sin(dot(floor(tp*0.13), vec2(39.346,11.135)))*24634.6345);\n' +
        'diffuseColor.rgb *= (0.92 + tn*0.09 + tn2*0.06);\n' +
        'float urban = step(vTerrPos.y, 12.0);\n' +
        'vec2 seamBig = abs(fract(tp * 0.125) - 0.5);\n' +
        'vec2 seamSmall = abs(fract(tp * 0.5) - 0.5);\n' +
        'float sl = smoothstep(0.43, 0.5, max(seamBig.x, seamBig.y)) * 0.055 + smoothstep(0.45, 0.5, max(seamSmall.x, seamSmall.y)) * 0.035;\n' +
        'diffuseColor.rgb *= 1.0 - sl * urban;\n'
      );
    };
    mat.customProgramCacheKey = function () { return 'terrain-v2'; };
    var mesh = new THREE.Mesh(geo.geometry, mat);
    mesh.name = 'terrain';
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    var group = new THREE.Group();
    group.name = 'Terrain';
    group.add(mesh);
    // distant terrain-edge ranges disabled: HK.Sky owns the horizon haze/fog

    var shore = buildShoreMask();
    onProgress(99, '海岸線完成');

    var world = {
      group: group,
      mesh: mesh,
      shoreMask: shore,
      bounds: { minX: MINX, minZ: MINZ, maxX: MINX + W, maxZ: MINZ + H, W: W, H: H },
      W: W, H: H,
      height: heightArr,
      type: typeArr,
      district: districtArr,
      color: colorArr,
      flags: flagArr,
      road: roadArr,
      quads: geo.quads,
      wallQuads: geo.wallQuads,
      vertices: geo.vertices,
      heightAt: function (x, z) {
        var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);
        if (i < 0 || i >= W || j < 0 || j >= H) return -1;
        var n = j * W + i;
        if (typeArr[n] === T.WATER) return -1;
        return heightArr[n];
      },
      typeAt: function (x, z) {
        var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);
        if (i < 0 || i >= W || j < 0 || j >= H) return T.WATER;
        return typeArr[j * W + i];
      },
      isLandAt: function (x, z) { return this.heightAt(x, z) >= 0; },
      slopeAt: function (x, z) {
        var h0 = this.heightAt(x, z);
        if (h0 < 0) return 99;
        var h1 = this.heightAt(x + 2, z), h2 = this.heightAt(x - 2, z), h3 = this.heightAt(x, z + 2), h4 = this.heightAt(x, z - 2);
        var vals = [h0];
        if (h1 >= 0) vals.push(h1); if (h2 >= 0) vals.push(h2);
        if (h3 >= 0) vals.push(h3); if (h4 >= 0) vals.push(h4);
        return Math.max.apply(null, vals) - Math.min.apply(null, vals);
      },
      inWorld: function (x, z) { return x >= MINX && x <= MINX + W && z >= MINZ && z <= MINZ + H; },
      districtOf: function (x, z) {
        var i = Math.floor(x - MINX), j = Math.floor(z - MINZ);
        if (i < 0 || i >= W || j < 0 || j >= H) return null;
        var di = districtArr[j * W + i];
        return di ? L.DISTRICTS[di - 1] : null;
      }
    };
    HK.log('terrain: quads', geo.quads, 'walls', geo.wallQuads, 'verts', geo.vertices);
    return world;
  }

  HK.Terrain = {
    build: build, TYPE: T,
    FLAGS: { RESERVED: FLAG_RESERVED, PARK: FLAG_PARK, PROMENADE: FLAG_PROMENADE, PLOT: FLAG_PLOT }
  };
})();
