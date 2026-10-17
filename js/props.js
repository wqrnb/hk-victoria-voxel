/* ============================================================================
 * HK VOXEL HARBOUR — STREET PROPS & SIGNAGE
 * Street lights, promenade railings, trees, neon sign atlas, animated LED
 * billboards, beacons, piers dressing, Peak Tram, market stalls, statues.
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util, L = HK.Layout, F = HK.FACADE;

  /* ------------------------------------------------------------ color batch */
  function CB() { this.pos = []; this.nrm = []; this.col = []; this.idx = []; this.v = 0; }
  CB.prototype.quad = function (p0, p1, p2, p3, nx, ny, nz, rgb) {
    rgb = [U.srgbToLinear(rgb[0]), U.srgbToLinear(rgb[1]), U.srgbToLinear(rgb[2])];
    var ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    var bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * nx + cy * ny + cz * nz < 0) { var t = p1; p1 = p3; p3 = t; }
    var b = this.v;
    this.pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
    for (var i = 0; i < 4; i++) { this.nrm.push(nx, ny, nz); this.col.push(rgb[0], rgb[1], rgb[2]); }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.v += 4;
  };
  CB.prototype.tri = function (p0, p1, p2, nx, ny, nz, rgb) {
    rgb = [U.srgbToLinear(rgb[0]), U.srgbToLinear(rgb[1]), U.srgbToLinear(rgb[2])];
    var b = this.v;
    this.pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    for (var i = 0; i < 3; i++) { this.nrm.push(nx, ny, nz); this.col.push(rgb[0], rgb[1], rgb[2]); }
    this.idx.push(b, b + 1, b + 2); this.v += 3;
  };
  CB.prototype.box = function (cx, cy, cz, w, h, d, rgb, topRgb, skipTop) {
    var x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    var c = rgb, dark = U.shadeRgb(c, 0.86), light = U.shadeRgb(c, 1.03);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], 0, 0, -1, c);
    this.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], 0, 0, 1, light);
    this.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], -1, 0, 0, dark);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], 1, 0, 0, c);
    if (!skipTop) this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 0, 1, 0, topRgb || U.shadeRgb(c, 1.08));
  };
  CB.prototype.build = function (material) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    var mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  };
  function beam3D(cb, p0, p1, w, h, rgb) {
    var fx = p1[0] - p0[0], fy = p1[1] - p0[1], fz = p1[2] - p0[2];
    var len = Math.sqrt(fx * fx + fy * fy + fz * fz); if (len < 1e-4) return;
    fx /= len; fy /= len; fz /= len;
    var rx = 0, ry = 1, rz = 0;
    if (Math.abs(fy) > 0.94) { rx = 1; ry = 0; rz = 0; }
    var rX = fy * rz - fz * ry, rY = fz * rx - fx * rz, rZ = fx * ry - fy * rx;
    var rl = Math.sqrt(rX * rX + rY * rY + rZ * rZ) || 1; rX /= rl; rY /= rl; rZ /= rl;
    var uX = rY * fz - rZ * fy, uY = rZ * fx - rX * fz, uZ = rX * fy - rY * fx;
    var hw = w / 2, hh = h / 2;
    function C(p, sr, su) { return [p[0] + rX * hw * sr + uX * hh * su, p[1] + rY * hw * sr + uY * hh * su, p[2] + rZ * hw * sr + uZ * hh * su]; }
    var A0 = C(p0, -1, -1), A1 = C(p0, 1, -1), A2 = C(p0, 1, 1), A3 = C(p0, -1, 1);
    var B0 = C(p1, -1, -1), B1 = C(p1, 1, -1), B2 = C(p1, 1, 1), B3 = C(p1, -1, 1);
    cb.quad(A2, B2, B3, A3, uX, uY, uZ, rgb);
    cb.quad(A0, B0, B1, A1, -uX, -uY, -uZ, U.shadeRgb(rgb, 0.9));
    cb.quad(A1, B1, B2, A2, rX, rY, rZ, rgb);
    cb.quad(A3, B3, B0, A0, -rX, -rY, -rZ, U.shadeRgb(rgb, 0.94));
    cb.quad(A0, A1, A2, A3, -fx, -fy, -fz, U.shadeRgb(rgb, 0.85));
    cb.quad(B0, B1, B2, B3, fx, fy, fz, U.shadeRgb(rgb, 1.04));
  }
  function yawBox(cb, cx, cz, len, wid, y0, y1, yaw, rgb) {
    var ca = Math.cos(yaw), sa = Math.sin(yaw);
    function pt(lx, lz) { return [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca]; }
    var A = pt(-len / 2, -wid / 2), B = pt(len / 2, -wid / 2), C = pt(len / 2, wid / 2), D = pt(-len / 2, wid / 2);
    cb.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], sa, 0, -ca, U.shadeRgb(rgb, 0.96));
    cb.quad([C[0], y0, C[1]], [D[0], y0, D[1]], [D[0], y1, D[1]], [C[0], y1, C[1]], -sa, 0, ca, rgb);
    cb.quad([B[0], y0, B[1]], [C[0], y0, C[1]], [C[0], y1, C[1]], [B[0], y1, B[1]], ca, 0, sa, rgb);
    cb.quad([A[0], y0, A[1]], [D[0], y0, D[1]], [D[0], y1, D[1]], [A[0], y1, A[1]], -ca, 0, -sa, U.shadeRgb(rgb, 0.92));
    cb.quad([A[0], y1, A[1]], [D[0], y1, D[1]], [C[0], y1, C[1]], [B[0], y1, B[1]], 0, 1, 0, U.shadeRgb(rgb, 1.07));
  }

  /* ------------------------------------------------------------ materials */
  var B = HK.Props = {};
  var nightUniforms = {
    uNight: { value: 0 },
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(0x8fa4b0) },
    uFogDensity: { value: 0.00018 }
  };
  B.uniforms = nightUniforms;
  B.group = null;
  B.state = { lampMat: null, poolMat: null, beaconMat: null, treeMeshes: [], billboards: [], signMat: null, quality: 'high' };
  B.stats = {};

  B.update = function (dt, state, env) {
    nightUniforms.uTime.value += dt;
    var night = state ? state.night : (env && env.night != null ? env.night : 0);
    nightUniforms.uNight.value = night;
    if (env && env.fogColor) { nightUniforms.uFogColor.value.copy(env.fogColor); if (!env.colorsLinear) nightUniforms.uFogColor.value.convertSRGBToLinear(); }
    var fog = HK.app && HK.app.scene && HK.app.scene.fog;
    if (fog) nightUniforms.uFogDensity.value = fog.density || 0.00018;
    var s = B.state;
    if (s.lampMat) {
      var on = U.smoothstep(0.25, 0.85, night);
      s.lampMat.color.setRGB(0.35 + on * 1.6, 0.3 + on * 1.15, 0.22 + on * 0.6);
    }
    if (s.poolMat) s.poolMat.opacity = 0.55 * U.smoothstep(0.3, 0.9, night);
    if (s.beaconMat) {
      var pulse = (Math.sin(nightUniforms.uTime.value * 2.2) * 0.5 + 0.5) > 0.45 ? 1.0 : 0.12;
      s.beaconMat.color.setRGB(pulse, pulse * 0.12, pulse * 0.08);
    }
    for (var i = 0; i < s.billboards.length; i++) {
      s.billboards[i].material.uniforms.uNight.value = night;
      s.billboards[i].material.uniforms.uTime.value = nightUniforms.uTime.value;
    }
    if (s.signMat) s.signMat.uniforms.uNight.value = night;
  };

  /* --------------------------------------------------------- neon sign atlas */
  var SIGN_TEXTS = [
    '茶餐廳', '金行', '藥房', '酒家', '麻雀', '押', '大廈', '酒店', '海鮮', '燒臘',
    '珠寶', '時裝', '電器', '冰室', '找換', '涼茶', '眼鏡', '髮型', '錶行', '旅館',
    '夜總會', '戲院', '超市', '銀行', '中醫', '牙科', '五金', '餐廳', '火鍋', '酒吧',
    '書局', '糖水', '麵家', '粥品', '燒味', '藥行', '金舖', '賓館', '桑拿', '卡啦OK'
  ];
  var SIGN_EN = ['HOTEL', 'GOLD', 'PHARMACY', 'NOODLES', 'BAR', 'CLUB', 'MARKET', 'TEA', 'JEWEL', 'SAUNA'];
  function buildSignAtlas() {
    var cells = 8, cell = 256, size = cells * cell;
    var canvas = U.makeCanvas(size, size);
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    var tiles = [];
    var palettes = [
      ['#ff2d55', '#ffd166', '#15060a'], ['#22e6ff', '#ff4fd8', '#04121a'],
      ['#ffe14d', '#ff6b2d', '#150c04'], ['#7cff6b', '#22e6ff', '#04140a'],
      ['#ff4fd8', '#ffffff', '#120414'], ['#ff8a3d', '#ffe9b0', '#160b04'],
      ['#ffffff', '#ff2d55', '#0b0b10'], ['#5d8bff', '#b3f0ff', '#050a18']
    ];
    for (var cy = 0; cy < cells; cy++) {
      for (var cx = 0; cx < cells; cx++) {
        var x = cx * cell, y = cy * cell;
        var pal = palettes[(cx + cy * 3) % palettes.length];
        var vertical = ((cx * 7 + cy * 5) % 3) !== 0;
        // frame / background
        var bg = Math.random() < 0.45 ? pal[2] : '#0b0b0e';
        ctx.globalAlpha = 0.55; ctx.fillStyle = bg; ctx.fillRect(x + 16, y + 16, cell - 32, cell - 32); ctx.globalAlpha = 1.0;
        ctx.strokeStyle = pal[0]; ctx.lineWidth = 8 + Math.random() * 8;
        ctx.shadowColor = pal[0]; ctx.shadowBlur = 26;
        ctx.strokeRect(x + 12, y + 12, cell - 24, cell - 24);
        ctx.shadowBlur = 0;
        var text = SIGN_TEXTS[Math.floor(Math.random() * SIGN_TEXTS.length)];
        var chars = text.split('');
        var glow = pal[0];
        ctx.shadowColor = glow; ctx.shadowBlur = 28;
        if (vertical) {
          var n = Math.min(chars.length, 5);
          var fs = Math.min(72, Math.floor((cell - 66) / n));
          ctx.font = '700 ' + fs + 'px "Microsoft JhengHei","Noto Sans TC",sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (var i = 0; i < n; i++) {
            ctx.fillStyle = i === 0 ? pal[1] : pal[0];
            ctx.fillText(chars[i], x + cell / 2, y + 52 + i * ((cell - 94) / n) + ((cell - 94) / n) / 2);
          }
        } else {
          var fs2 = Math.min(64, Math.floor((cell - 60) / Math.max(2, chars.length)));
          ctx.font = '700 ' + fs2 + 'px "Microsoft JhengHei","Noto Sans TC",sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = pal[1];
          ctx.fillText(text.slice(0, 4), x + cell / 2, y + cell / 2 - 8);
          ctx.font = '600 22px "Segoe UI",sans-serif';
          ctx.fillStyle = pal[0];
          ctx.fillText(SIGN_EN[Math.floor(Math.random() * SIGN_EN.length)], x + cell / 2, y + cell - 36);
        }
        ctx.shadowBlur = 0;
        var u0 = cx / cells, u1 = (cx + 1) / cells, v0 = 1 - (cy + 1) / cells, v1 = 1 - cy / cells;
        tiles.push({ u0: u0, v0: v0, u1: u1, v1: v1, vertical: vertical });
      }
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    tex.encoding = THREE.sRGBEncoding;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { texture: tex, tiles: tiles };
  }
  function makeSignMaterial(tex) {
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex },
        uNight: nightUniforms.uNight,
        uTime: nightUniforms.uTime,
        uFogColor: nightUniforms.uFogColor,
        uFogDensity: nightUniforms.uFogDensity
      },
      vertexShader: [
        'attribute vec3 color; varying vec2 vUv; varying vec3 vColor; varying float vFog;',
        'void main(){ vUv = uv; vColor = color;',
        '  vec4 mv = modelViewMatrix * vec4(position,1.0); vFog = -mv.z;',
        '  gl_Position = projectionMatrix * mv; }'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D map; uniform float uNight; uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity;',
        'varying vec2 vUv; varying vec3 vColor; varying float vFog;',
        'void main(){',
        '  vec4 t = texture2D(map, vUv);',
        '  if (t.a < 0.12) discard;',
        '  float flick = 0.92 + 0.08 * sin(uTime * 17.0 + floor(vUv.y * 40.0));',
        '  float glow = mix(0.32, 1.28, uNight) * flick;',
        '  vec3 c = min(t.rgb * vColor * glow, vec3(2.0));',
        '  float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);',
        '  c = mix(c, uFogColor, clamp(f, 0.0, 1.0));',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n'),
      side: THREE.DoubleSide
    });
    return mat;
  }
  function signGeometry() {
    return { pos: [], uv: [], col: [], idx: [], v: 0 };
  }
  function addSignQuad(g, p0, p1, p2, p3, uv, tint) {
    var b = g.v;
    g.pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
    g.uv.push(uv[0], uv[1], uv[2], uv[3], uv[4], uv[5], uv[6], uv[7]);
    for (var i = 0; i < 4; i++) g.col.push(tint[0], tint[1], tint[2]);
    g.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); g.v += 4;
  }
  function signQuadFacing(g, cx, cz, y0, y1, w, nx, nz, uv, tint, noOffset) {
    // plane centred at cx,cz, vertical, facing (nx,0,nz)
    var tx = -nz, tz = nx;
    var off = noOffset ? 0 : 0.32;
    var px = cx + nx * off, pz = cz + nz * off;
    var hw = w / 2;
    var A = [px - tx * hw, y0, pz - tz * hw];
    var B = [px + tx * hw, y0, pz + tz * hw];
    var C = [px + tx * hw, y1, pz + tz * hw];
    var D = [px - tx * hw, y1, pz - tz * hw];
    addSignQuad(g, A, B, C, D, uv, tint);
  }

  /* -------------------------------------------------------------- road helpers */
  function distToRoads(x, z) {
    var best = 1e9, bestRoad = null;
    for (var i = 0; i < L.ROADS.length; i++) {
      var r = L.ROADS[i];
      if (r.type === 'tunnel' || r.type === 'track') continue;
      var bb = r._bb;
      if (!bb) { bb = r._bb = U.polyBBox(r.pts); }
      if (x < bb.minX - 40 || x > bb.maxX + 40 || z < bb.minZ - 40 || z > bb.maxZ + 40) continue;
      var d = U.distToPolyline(x, z, r.pts);
      if (d < best) { best = d; bestRoad = r; }
    }
    return { d: best, road: bestRoad };
  }

  function nearestFacade(x, z, w, d) {
    var sides = [
      { px: x, pz: z - d / 2, nx: 0, nz: -1 },
      { px: x, pz: z + d / 2, nx: 0, nz: 1 },
      { px: x - w / 2, pz: z, nx: -1, nz: 0 },
      { px: x + w / 2, pz: z, nx: 1, nz: 0 }
    ];
    var best = null;
    for (var i = 0; i < sides.length; i++) {
      var s = sides[i];
      var rr = distToRoads(s.px, s.pz);
      if (!best || rr.d < best.d) best = { d: rr.d, side: s };
    }
    return best;
  }

  /* --------------------------------------------------------------- builders */
  function buildStreetLights(world, cbMatte, cbGlow, pools) {
    var lampCol = U.hexRgb('#5d6163');
    var headCol = U.hexRgb('#fff3d6');
    function placeLamp(x, z, yaw) {
      var gy = world.heightAt(x, z);
      if (gy < 0) return false;
      var y = gy + 0.1;
      var ca = Math.cos(yaw), sa = Math.sin(yaw);
      cbMatte.box(x, y + 2.3, z, 0.24, 4.6, 0.24, lampCol);
      cbMatte.box(x + ca * 0.85, y + 4.45, z + sa * 0.85, Math.abs(ca) * 1.7 + 0.24, 0.18, Math.abs(sa) * 1.7 + 0.24, lampCol);
      cbGlow.box(x + ca * 1.65, y + 4.36, z + sa * 1.65, 0.6, 0.2, 0.6, headCol);
      pools.push({ x: x + ca * 1.65, z: z + sa * 1.65, y: gy + 0.05, s: 5.5 });
      return true;
    }
    var lampCount = 0;
    for (var i = 0; i < L.ROADS.length; i++) {
      var r = L.ROADS[i];
      if (r.type === 'tunnel' || r.type === 'track') continue;
      var total = L.polylineLength(r.pts);
      var step = r.type === 'main' ? 34 : 46;
      for (var dd = 20; dd < total - 10; dd += step) {
        var p = L.polylinePointAtDistance(r.pts, dd);
        var nx = -p.dz, nz = p.dx;
        var side = ((dd / step) | 0) % 2 === 0 ? 1 : -1;
        placeLamp(p.x + nx * (r.width / 2 + 1.6) * side, p.z + nz * (r.width / 2 + 1.6) * side, Math.atan2(p.dx, p.dz));
        lampCount++;
      }
    }
    // promenade lamps
    for (var w = 0; w < L.WALK_PATHS.length; w++) {
      var pts = L.WALK_PATHS[w];
      var tot = L.polylineLength(pts);
      for (var d2 = 12; d2 < tot; d2 += 30) {
        var q = L.polylinePointAtDistance(pts, d2);
        var nx2 = -q.dz, nz2 = q.dx;
        placeLamp(q.x + nx2 * 2.2, q.z + nz2 * 2.2, Math.atan2(q.dx, q.dz));
        lampCount++;
      }
    }
    return lampCount;
  }

  function buildRailings(world, cbMatte) {
    var railCol = U.hexRgb('#7d827f');
    var count = 0;
    for (var w = 0; w < L.WALK_PATHS.length; w++) {
      var pts = L.WALK_PATHS[w];
      var total = L.polylineLength(pts);
      if (total < 20) continue;
      for (var d = 0; d < total - 4; d += 8) {
        var p = L.polylinePointAtDistance(pts, d);
        var gy = world.heightAt(p.x, p.z);
        if (gy < 0) continue;
        var side = 1;
        var nx = -p.dz, nz = p.dx;
        var px = p.x + nx * 2.6, pz = p.z + nz * 2.6;
        var gy2 = world.heightAt(px, pz);
        if (gy2 < 0) { px = p.x - nx * 2.6; pz = p.z - nz * 2.6; gy2 = world.heightAt(px, pz); if (gy2 < 0) continue; }
        var y = Math.max(gy, gy2);
        cbMatte.box(px, y + 0.28, pz, 0.12, 0.56, 0.12, railCol);
        count++;
      }
      // (continuous rails removed: thin distant lines caused skyline moire) 
    }
    return count;
  }

  function buildTrees(world, layout, quality, group) {
    var R = new HK.Rng(9091);
    var trunkGeo = new THREE.BoxGeometry(0.42, 1.9, 0.42);
    trunkGeo.translate(0, 0.95, 0);
    var trunkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(U.srgbToLinear(0.25), U.srgbToLinear(0.18), U.srgbToLinear(0.12)), roughness: 0.95 });
    var canopyBatch = new CB();
    canopyBatch.box(0, 2.6, 0, 1.8, 1.1, 1.8, U.hexRgb('#3f6b34'));
    canopyBatch.box(0.3, 3.3, -0.2, 1.35, 0.9, 1.35, U.hexRgb('#4c7a3c'));
    canopyBatch.box(-0.35, 2.2, 0.3, 1.1, 0.8, 1.1, U.hexRgb('#365c2c'));
    var canopyGeo = new THREE.BufferGeometry();
    canopyGeo.setAttribute('position', new THREE.Float32BufferAttribute(canopyBatch.pos, 3));
    canopyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(canopyBatch.nrm, 3));
    canopyGeo.setAttribute('color', new THREE.Float32BufferAttribute(canopyBatch.col, 3));
    canopyGeo.setIndex(new THREE.Uint32BufferAttribute(canopyBatch.idx, 1));
    var canopyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    var positions = [];
    var maxTrees = quality.trees;
    // hill trees
    var step = 7;
    for (var z = L.BOUNDS.minZ + 5; z < L.BOUNDS.maxZ - 5 && positions.length < maxTrees; z += step) {
      for (var x = L.BOUNDS.minX + 5; x < L.BOUNDS.maxX - 5 && positions.length < maxTrees; x += step) {
        var t = world.typeAt(x, z);
        if (t !== HK.Terrain.TYPE.FOREST) continue;
        if (R.chance(0.28)) continue;
        var h = world.heightAt(x, z);
        if (h < 3) continue;
        positions.push([x + R.float(-2, 2), h, z + R.float(-2, 2), R.float(0.7, 1.5)]);
      }
    }
    // street trees on promenades & parks
    var streetWanted = Math.min(900, Math.floor(maxTrees * 0.12));
    var added = 0;
    for (var w = 0; w < L.WALK_PATHS.length && added < streetWanted; w++) {
      var pts = L.WALK_PATHS[w];
      var total = L.polylineLength(pts);
      for (var d = 14; d < total && added < streetWanted; d += 20) {
        var p = L.polylinePointAtDistance(pts, d);
        var nx = -p.dz, nz = p.dx;
        for (var sside = -1; sside <= 1; sside += 2) {
          var px = p.x + nx * 5.5 * sside, pz = p.z + nz * 5.5 * sside;
          var hh = world.heightAt(px, pz);
          if (hh < 0) continue;
          var typ = world.typeAt(px, pz);
          if (typ === HK.Terrain.TYPE.ROAD || typ === HK.Terrain.TYPE.ROAD_MAIN) continue;
          positions.push([px, hh, pz, R.float(0.8, 1.2)]);
          added++;
        }
      }
    }
    var count = Math.min(positions.length, maxTrees);
    var trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    var canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    trunkMesh.castShadow = false; canopyMesh.castShadow = false;
    trunkMesh.receiveShadow = false; canopyMesh.receiveShadow = false;
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    var col = new THREE.Color();
    for (var i = 0; i < count; i++) {
      var p2 = positions[i];
      pos.set(p2[0], p2[1], p2[2]);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R.float(0, Math.PI * 2));
      sc.set(p2[3], p2[3] * R.float(0.8, 1.25), p2[3]);
      m.compose(pos, q, sc);
      trunkMesh.setMatrixAt(i, m);
      canopyMesh.setMatrixAt(i, m);
      col.setHSL(0.24 + R.float(-0.03, 0.04), 0.38 + R.float(-0.08, 0.1), 0.32 + R.float(-0.06, 0.08));
      canopyMesh.setColorAt(i, col);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
    group.add(trunkMesh);
    group.add(canopyMesh);
    B.state.treeMeshes = [trunkMesh, canopyMesh];
    return count;
  }

  function buildPools(list, group) {
    if (!list.length) return null;
    var canvas = U.makeCanvas(128, 128);
    var ctx = canvas.getContext('2d');
    var grd = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,230,190,0.95)');
    grd.addColorStop(0.4, 'rgba(255,200,130,0.35)');
    grd.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffc98a, side: THREE.DoubleSide });
    var geo = new THREE.PlaneGeometry(1, 1);
    var mesh = new THREE.InstancedMesh(geo, mat, list.length);
    var m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (var i = 0; i < list.length; i++) {
      var l = list[i];
      p.set(l.x, l.y, l.z); sc.set(l.s, l.s, 1); m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    B.state.poolMat = mat;
    return mesh;
  }

  function buildBeacons(world, group, extra) {
    var beacons = (world.city ? world.city.beacons : []).concat(extra || []);
    if (!beacons.length) return 0;
    var geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    var mat = new THREE.MeshBasicMaterial({ color: 0xff3322, fog: true });
    var mesh = new THREE.InstancedMesh(geo, mat, beacons.length);
    var m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (var i = 0; i < beacons.length; i++) {
      var b = beacons[i];
      p.set(b.x, b.y, b.z); sc.set(1, 1, 1); m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    B.state.beaconMat = mat;
    return beacons.length;
  }

  /* ------------------------------------------------------------ billboards */
  var BILLBOARD_FRAG = [
    'uniform float uTime; uniform float uNight; uniform float uSeed;',
    'varying vec2 vUv;',
    'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
    'void main(){',
    '  vec2 uv = vUv;',
    '  float t = uTime * 0.35 + uSeed * 10.0;',
    '  vec3 col = mix(vec3(0.05,0.08,0.12), vec3(0.1,0.35,0.5), uv.y);',
    '  float bars = smoothstep(0.45,0.55, fract(uv.x * 7.0 - t));',
    '  float scan = smoothstep(0.0, 0.08, abs(fract(uv.y * 12.0 - uTime * 0.9) - 0.5));',
    '  vec3 c1 = 0.5 + 0.5 * cos(6.2831 * (t * 0.2 + vec3(0.0,0.33,0.67)));',
    '  col = mix(col, c1, bars * 0.75);',
    '  col += vec3(0.2,0.5,0.8) * scan * 0.15;',
    '  float line = step(0.92, fract(uv.y * 20.0));',
    '  col = mix(col, vec3(1.0), line * 0.3);',
    '  col *= mix(0.8, 1.7, uNight);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');
  function buildBillboards(world, group) {
    var defs = [
      { x: 142, z: -308, y: 14, w: 14, h: 7, ny: 0, nz: 1, seed: 1 },   // TST / Victoria Dockside
      { x: 470, z: 458, y: 12, w: 12, h: 6.5, ny: 0, nz: -1, seed: 2 },   // Causeway Bay
      { x: -80, z: 542, y: 16, w: 11, h: 6, ny: 0, nz: -1, seed: 3 },   // Central
      { x: -60, z: -700, y: 14, w: 10, h: 8, ny: 1, nz: 0, seed: 4 },   // Nathan Road
      { x: 300, z: 330, y: 12, w: 13, h: 6.5, ny: 0, nz: -1, seed: 5 },   // Wan Chai
      { x: 760, z: 468, y: 11, w: 11, h: 6, ny: 0, nz: -1, seed: 6 }    // North Point
    ];
    var list = [];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uSeed: { value: d.seed } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: BILLBOARD_FRAG,
        side: THREE.DoubleSide
      });
      var geo = new THREE.PlaneGeometry(d.w, d.h);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(d.x, world.heightAt(d.x, d.z) + d.y, d.z);
      if (d.nz === 1) mesh.rotation.y = 0;
      else if (d.nz === -1) mesh.rotation.y = Math.PI;
      else if (d.nx === 1) mesh.rotation.y = Math.PI / 2;
      else mesh.rotation.y = -Math.PI / 2;
      mesh.castShadow = false;
      group.add(mesh);
      list.push(mesh);
    }
    B.state.billboards = list;
    return list.length;
  }

  /* ---------------------------------------------------------------- signs */
  function buildSigns(world, group) {
    var atlas = buildSignAtlas();
    var mat = makeSignMaterial(atlas.texture);
    B.state.signMat = mat;
    var g = signGeometry();
    var rng = new HK.Rng(0x5eEDBEEF);
    var reqs = (world.city && world.city.signs) ? world.city.signs.slice() : [];
    // prioritise neon districts
    reqs.sort(function (a, b) { return (b.neon || 0) - (a.neon || 0); });
    var cap = 420;
    var placed = 0;
    for (var i = 0; i < reqs.length && placed < cap; i++) {
      var r = reqs[i];
      if (r.w < 3 || r.d < 3) continue;
      var nf = nearestFacade(r.x, r.z, r.w, r.d);
      if (!nf || nf.d > 32) continue;
      var tiles = atlas.tiles;
      var tile = tiles[Math.floor(rng.next() * tiles.length)];
      var s = nf.side;
      var tint = [rng.float(0.85, 1.1), rng.float(0.85, 1.1), rng.float(0.85, 1.1)];
      var uv = [tile.u0, tile.v0, tile.u1, tile.v0, tile.u1, tile.v1, tile.u0, tile.v1];
      var countSigns = rng.chance(0.55) ? 2 : 1;
      for (var k = 0; k < countSigns; k++) {
        var sw = rng.float(2.6, Math.min(9, r.w * 0.65));
        var sh = rng.float(4.2, Math.min(13, r.top - r.base - 2));
        var y0 = r.base + rng.float(2.5, Math.max(3.2, Math.min(r.top - r.base - sh - 1, 26)));
        var along = rng.float(-r.w * 0.32, r.w * 0.32);
        var tx = -s.nz, tz = s.nx;
        var cx2 = s.px + tx * along + s.nx * 0.35;
        var cz2 = s.pz + tz * along + s.nz * 0.35;
        signQuadFacing(g, cx2, cz2, y0, y0 + sh, sw, s.nx, s.nz, uv, tint, true);
        placed++;
        if (rng.chance(0.28) && r.top - r.base > 24) {
          // vertical blade sign sticking out of the facade
          var bh = rng.float(7, Math.min(20, r.top - r.base - 4));
          var by = r.base + rng.float(6, Math.max(7, Math.min(r.top - r.base - bh - 2, 34)));
          var bx = s.px + s.nx * rng.float(1.6, 2.6);
          var bz = s.pz + s.nz * rng.float(1.6, 2.6);
          var n2x = tx, n2z = tz;
          signQuadFacing(g, bx, bz, by, by + bh, 2.2, n2x, n2z, uv, tint, true);
          placed++;
        }
      }
    }
    if (!placed) return 0;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
    geo.setIndex(new THREE.Uint32BufferAttribute(g.idx, 1));
    geo.computeBoundingSphere();
    var mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = true;
    group.add(mesh);
    return placed;
  }

  /* ---------------------------------------------------------- special props */
  function buildBruceLee(world, cbMatte) {
    var x = -20, z = -326;
    var g = world.heightAt(x, z); if (g < 0) return;
    var bronze = U.hexRgb('#7c5a3a'), dark = U.hexRgb('#3b2d20');
    cbMatte.box(x, g + 0.5, z + 1.2, 4, 1.0, 4, U.hexRgb('#8b877d'));
    cbMatte.box(x, g + 1.4, z, 0.55, 1.5, 0.55, bronze);   // legs
    cbMatte.box(x - 0.3, g + 1.1, z, 0.25, 1.2, 0.3, bronze);
    cbMatte.box(x, g + 2.55, z, 1.0, 1.1, 0.6, bronze);   // torso
    cbMatte.box(x, g + 3.35, z, 0.55, 0.55, 0.55, bronze); // head
    beam3D(cbMatte, [x - 0.4, g + 2.9, z], [x - 1.9, g + 3.6, z - 0.2], 0.24, 0.24, bronze);
    beam3D(cbMatte, [x + 0.4, g + 2.9, z], [x + 1.2, g + 2.0, z + 0.3], 0.24, 0.24, bronze);
    beam3D(cbMatte, [x - 0.2, g + 1.9, z], [x - 0.55, g + 0.7, z + 0.4], 0.26, 0.26, bronze);
    beam3D(cbMatte, [x + 0.2, g + 1.9, z], [x + 0.5, g + 0.7, z - 0.3], 0.26, 0.26, bronze);
  }

  function buildLighthouse(world, cbMatte, cbGlow) {
    var x = -1480, z = 78;
    var g = world.heightAt(x, z); if (g < 0) g = 12;
    for (var i = 0; i < 4; i++) {
      var r = 1.2 - i * 0.18;
      cbMatte.box(x, g + i * 1.2 + 0.6, z, r * 2, 1.2, r * 2, U.hexRgb('#d7d3c6'));
    }
    cbMatte.box(x, g + 5.5, z, 1.0, 0.9, 1.0, U.hexRgb('#a83b32'));
    cbGlow.box(x, g + 6.15, z, 0.62, 0.5, 0.62, U.hexRgb('#fff3c8'));
  }

  function buildCranes(world, cbMatte, cbGlow, beaconsExtra) {
    var defs = [
      { x: -560, z: 560, h: 68 }, { x: 380, z: 520, h: 86 }, { x: -780, z: -560, h: 54 },
      { x: 1000, z: -560, h: 64 }, { x: 900, z: 420, h: 52 }
    ];
    var steel = U.hexRgb('#c79c3a');
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var g = world.heightAt(d.x, d.z); if (g < 0) continue;
      var top = g + d.h;
      // tower
      for (var k = 0; k < 4; k++) {
        var sx = (k % 2 === 0 ? -1 : 1) * 0.8, sz = (k < 2 ? -1 : 1) * 0.8;
        cbMatte.box(d.x + sx, g + d.h / 2, d.z + sz, 0.22, d.h, 0.22, steel);
      }
      for (var yy = 6; yy < d.h; yy += 10) {
        cbMatte.box(d.x, g + yy, d.z + 1.3, 2.9, 0.16, 0.16, steel);
        cbMatte.box(d.x, g + yy, d.z - 1.3, 2.9, 0.16, 0.16, steel);
        cbMatte.box(d.x + 1.3, g + yy, d.z, 0.16, 0.16, 2.9, steel);
        cbMatte.box(d.x - 1.3, g + yy, d.z, 0.16, 0.16, 2.9, steel);
      }
      // jib
      var jibLen = 21;
      cbMatte.box(d.x + jibLen / 2 - 4, top, d.z, jibLen, 0.35, 0.35, steel);
      cbMatte.box(d.x - 3.5, top, d.z, 7, 0.3, 0.3, steel);
      cbMatte.box(d.x - 6, top - 1.6, d.z, 2.2, 3.2, 1.4, U.hexRgb('#5e5e5a'));
      var cxTip = d.x + jibLen - 4;
      var c0 = [d.x, top + 1, d.z], c1 = [cxTip, top - 5, d.z];
      beam3D(cbMatte, c0, c1, 0.09, 0.09, U.hexRgb('#8f908c'));
      beam3D(cbMatte, [d.x, top + 1, d.z], [d.x + 6, top - 2, d.z], 0.08, 0.08, U.hexRgb('#8f908c'));
      cbGlow.box(cxTip, top - 5.6, d.z, 0.6, 0.6, 0.6, U.hexRgb('#ff4b3e'));
      beaconsExtra.push({ x: cxTip, y: top - 5.6, z: d.z });
      beaconsExtra.push({ x: d.x, y: top + 1.2, z: d.z });
    }
  }

  function buildPeakTram(world, layout, cbMatte) {
    var road = null;
    for (var i = 0; i < L.ROADS.length; i++) if (L.ROADS[i].name === '山頂纜車') road = L.ROADS[i];
    if (!road) return 0;
    var pts = road.pts;
    var total = L.polylineLength(pts);
    var rail = U.hexRgb('#6f6a5e');
    var prev = null;
    var steps = Math.ceil(total / 5);
    for (var s = 0; s <= steps; s++) {
      var p = L.polylinePointAtDistance(pts, total * s / steps);
      var gy = world.heightAt(p.x, p.z); if (gy < 0) gy = 1;
      var nx = -p.dz, nz = p.dx;
      var y = gy + 0.22;
      var cur = { x: p.x, z: p.z, y: y };
      if (prev) {
        for (var r = -1; r <= 1; r += 2) {
          beam3D(cbMatte, [prev.x + prev.nx * 0.45 * r, prev.y, prev.z + prev.nz * 0.45 * r], [cur.x + nx * 0.45 * r, y, cur.z + nz * 0.45 * r], 0.1, 0.1, rail);
        }
        if (s % 2 === 0) beam3D(cbMatte, [prev.x - prev.nx * 0.45, prev.y, prev.z - prev.nz * 0.45], [cur.x + nx * 0.45, y, cur.z + nz * 0.45], 0.08, 0.08, U.hexRgb('#5a554a'));
      }
      cur.nx = nx; cur.nz = nz;
      prev = cur;
    }
    // tram car midway
    var mid = L.polylinePointAtDistance(pts, total * 0.55);
    var mgy = world.heightAt(mid.x, mid.z); if (mgy < 0) mgy = 40;
    var yaw = Math.atan2(mid.dx, mid.dz) - Math.PI / 2;
    yawBox(cbMatte, mid.x, mid.z, 2.4, 1.35, mgy + 0.3, mgy + 1.9, yaw, U.hexRgb('#2c6b4f'));
    yawBox(cbMatte, mid.x, mid.z, 2.2, 1.25, mgy + 1.9, mgy + 2.3, yaw, U.hexRgb('#e6e0d2'));
    // track cable
    return 1;
  }

  function buildMarket(world, cbMatte) {
    var stalls = [
      { x0: -338, z0: -616, dx: 10, dz: 0, n: 9, dir: 'x' },     // Temple Street
      { x0: -338, z0: -632, dx: 10, dz: 0, n: 9, dir: 'x' },
      { x0: 58, z0: -786, dx: 0, dz: 9, n: 8, dir: 'z' },        // Ladies Market
      { x0: 74, z0: -786, dx: 0, dz: 9, n: 8, dir: 'z' }
    ];
    var cols = ['#c94b3a', '#2f6f9f', '#d8a43a', '#3d8a64'];
    var n = 0;
    for (var s = 0; s < stalls.length; s++) {
      var st = stalls[s];
      for (var i = 0; i < st.n; i++) {
        var x = st.x0 + st.dx * i, z = st.z0 + st.dz * i;
        var g = world.heightAt(x, z); if (g < 0) continue;
        var col = U.hexRgb(cols[(i + s) % cols.length]);
        cbMatte.box(x, g + 0.72, z, 2.2, 0.16, 1.55, U.hexRgb('#6b5f4e'));
        cbMatte.box(x, g + 1.55, z, 2.4, 0.14, 1.75, col);
        cbMatte.box(x - 0.95, g + 0.78, z - 0.65, 0.09, 1.55, 0.09, U.hexRgb('#5b5b56'));
        cbMatte.box(x + 0.95, g + 0.78, z + 0.65, 0.09, 1.55, 0.09, U.hexRgb('#5b5b56'));
        n++;
      }
    }
    return n;
  }

  function buildPromenadeFurniture(world, cbMatte) {
    var rng = new HK.Rng(3311);
    var benches = 0, planters = 0;
    for (var w = 0; w < L.WALK_PATHS.length; w++) {
      var pts = L.WALK_PATHS[w];
      var total = L.polylineLength(pts);
      for (var d = 24; d < total - 10; d += 46) {
        var p = L.polylinePointAtDistance(pts, d);
        var gy = world.heightAt(p.x, p.z); if (gy < 0) continue;
        var nx = -p.dz, nz = p.dx;
        var yaw = Math.atan2(p.dx, p.dz);
        if (rng.chance(0.5)) {
          yawBox(cbMatte, p.x + nx * 3.1, p.z + nz * 3.1, 1.7, 0.5, gy + 0.2, gy + 0.36, yaw, U.hexRgb('#8a7a63'));
          benches++;
        } else {
          cbMatte.box(p.x + nx * 3.1, gy + 0.3, p.z + nz * 3.1, 1.05, 0.55, 1.05, U.hexRgb('#8c8f86'));
          cbMatte.box(p.x + nx * 3.1, gy + 0.78, p.z + nz * 3.1, 0.8, 0.42, 0.8, U.hexRgb('#4f6b3e'));
          planters++;
        }
      }
    }
    return benches + planters;
  }

  function buildFlags(world, cbMatte) {
    var spots = [
      [-320, 306], [-286, 306], [-60, 300], [70, 304], [180, 312], [260, 320],
      [-40, -326], [40, -324], [120, -322], [210, -318]
    ];
    for (var i = 0; i < spots.length; i++) {
      var x = spots[i][0], z = spots[i][1];
      var g = world.heightAt(x, z); if (g < 0) continue;
      cbMatte.box(x, g + 2.1, z, 0.13, 4.2, 0.13, U.hexRgb('#c8c4b6'));
      cbMatte.box(x + 0.65, g + 3.45, z, 1.25, 0.8, 0.06, U.hexRgb('#c22b2b'));
    }
  }

  function buildPublicDetails(world, layout, cbMatte, cbGlow) {
    // MTR entrances (simple red canopies and stair holes)
    var mtr = [
      { x: -205, z: 392 }, { x: 118, z: 402 }, { x: -210, z: -348 },
      { x: 590, z: 452 }, { x: -90, z: -760 }
    ];
    for (var i = 0; i < mtr.length; i++) {
      var m = mtr[i];
      var g = world.heightAt(m.x, m.z); if (g < 0) continue;
      cbMatte.box(m.x, g + 1.0, m.z, 2.8, 1.9, 2.2, U.hexRgb('#8f1f1f'));
      cbMatte.box(m.x, g + 2.0, m.z, 3.2, 0.25, 2.6, U.hexRgb('#c22b2b'));
      cbGlow.box(m.x, g + 1.4, m.z + 1.2, 1.5, 0.35, 0.1, U.hexRgb('#fff0d0'));
    }
    // bus stop shelters along main roads
    var busSpots = [[-180, 372], [310, 360], [-96, -520], [430, -300], [780, 380], [1100, 390]];
    for (var b = 0; b < busSpots.length; b++) {
      var s = busSpots[b];
      var g2 = world.heightAt(s[0], s[1]); if (g2 < 0) continue;
      cbMatte.box(s[0], g2 + 1.45, s[1], 3.6, 0.12, 1.4, U.hexRgb('#c7c3b7'));
      cbMatte.box(s[0] - 1.65, g2 + 0.72, s[1], 0.14, 1.45, 0.14, U.hexRgb('#8b8b84'));
      cbMatte.box(s[0] + 1.65, g2 + 0.72, s[1], 0.14, 1.45, 0.14, U.hexRgb('#8b8b84'));
      cbMatte.box(s[0] + 1.0, g2 + 0.7, s[1], 0.5, 1.2, 0.1, U.hexRgb('#3d4a55'));
    }
  }

  /* boardwalk plank detail for the Tsim Sha Tsui Avenue of Stars deck */
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

  /* ---------------------------------------------------------------- build */
  B.build = function (world, layout, opts) {
    opts = opts || {};
    var quality = HK.QUALITY[HK.app ? HK.app.state.quality : 'high'] || HK.QUALITY.high;
    var group = new THREE.Group();
    group.name = 'StreetProps';
    var cbMatte = new CB();
    var cbGlow = new CB();
    var pools = [];
    var beaconsExtra = [];
    var stats = {};

    var skipStreet = /skipstreet=1/.test(location.search);
    var lampCount = skipStreet ? 0 : buildStreetLights(world, cbMatte, cbGlow, pools);
    var railCount = skipStreet ? 0 : buildRailings(world, cbMatte);
    var treeCount = buildTrees(world, layout, quality, group);
    var signCount = buildSigns(world, group);
    var boardCount = buildBillboards(world, group);
    buildBruceLee(world, cbMatte);
    buildLighthouse(world, cbMatte, cbGlow);
    buildCranes(world, cbMatte, cbGlow, beaconsExtra);
    buildPeakTram(world, layout, cbMatte);
    buildMarket(world, cbMatte);
    if (!skipStreet) { buildPromenadeFurniture(world, cbMatte); buildFlags(world, cbMatte); buildPublicDetails(world, layout, cbMatte, cbGlow); }
    var deck = buildBoardwalkDetails(world, cbMatte);
    var beaconCount = buildBeacons(world, group, beaconsExtra);
    buildPools(pools, group);

    var matteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.12 });
    var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffd9a0, fog: true });
    var matteMesh = cbMatte.build(matteMat);
    matteMesh.name = 'propsMatte';
    group.add(matteMesh);
    var glowMesh = cbGlow.build(glowMat);
    glowMesh.name = 'propsGlow';
    glowMesh.castShadow = false;
    group.add(glowMesh);
    B.state.lampMat = glowMat;
    B.group = group;
    B.stats = {
      lamps: lampCount, railings: railCount, trees: treeCount, signs: signCount,
      billboards: boardCount, beacons: beaconCount, decks: deck, quads: cbMatte.v / 4 + cbGlow.v / 4
    };
    HK.log('props:', JSON.stringify(B.stats));
    return group;
  };

  B.setQuality = function (q) {
    var quality = HK.QUALITY[q] || HK.QUALITY.high;
    if (B.state.treeMeshes && B.state.treeMeshes.length) {
      var cap = quality.trees;
      for (var i = 0; i < B.state.treeMeshes.length; i++) {
        var mesh = B.state.treeMeshes[i];
        mesh.count = Math.min(mesh.instanceMatrix.count, cap);
      }
    }
  };

  B.setLayer = function (name, on) {
    if (name === 'neon') {
      if (B.state.signMat) B.state.signMat.visible = on;
      for (var i = 0; i < B.state.billboards.length; i++) B.state.billboards[i].visible = on;
    }
  };
})();
