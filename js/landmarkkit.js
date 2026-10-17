/* ============================================================================
 * HK VOXEL HARBOUR — CITY BUILDER + LANDMARK KIT
 * A tiny voxel-architecture authoring kit used by the procedural city and by
 * the hand-crafted landmarks. All geometry is merged per spatial chunk into a
 * single facade material (per-vertex colour + facade UV + style + seed).
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util;

  /* ============================================================== BUILDER */
  function CityBuilder(opts) {
    opts = opts || {};
    this.chunkSize = opts.chunkSize || 480;
    this.batches = {};
    this.chunkKeys = [];
    this.colliders = [];   // {x0,z0,x1,z1,y0,y1,walk}
    this.frontage = [];    // building frontage hints for props (signs etc.)
    this.signs = [];       // sign requests for props
    this.beacons = [];     // blinking aircraft warning lights
    this.stats = { quads: 0, boxes: 0 };
  }
  CityBuilder.prototype._batch = function (x, z) {
    var cx = Math.floor(x / this.chunkSize), cz = Math.floor(z / this.chunkSize);
    var key = cx + ':' + cz;
    var b = this.batches[key];
    if (!b) {
      b = new HK.Batch(HK.ATTRS_FACADE);
      b.hkKey = key;
      this.batches[key] = b;
      this.chunkKeys.push(key);
    }
    return b;
  };
  CityBuilder.prototype.addQuad = function (p0, p1, p2, p3, nx, ny, nz, rgb, uvs, extra) {
    // fix winding so the quad faces the provided normal
    var ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    var bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz2 = ax * by - ay * bx;
    var dot = cx * nx + cy * ny + cz2 * nz;
    if (dot < 0) {
      var tp = p1; p1 = p3; p3 = tp;
      if (uvs) { var tu = [uvs[2], uvs[3]]; uvs[2] = uvs[6]; uvs[3] = uvs[7]; uvs[6] = tu[0]; uvs[7] = tu[1]; }
    }
    var cxw = (p0[0] + p1[0] + p2[0] + p3[0]) * 0.25;
    var czw = (p0[2] + p1[2] + p2[2] + p3[2]) * 0.25;
    var batch = this._batch(cxw, czw);
    batch.addQuad(p0, p1, p2, p3, nx, ny, nz, rgb, uvs, extra);
    this.stats.quads++;
  };
  CityBuilder.prototype.addTri = function (p0, p1, p2, nx, ny, nz, rgb, uvs, extra) {
    var ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    var bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz2 = ax * by - ay * bx;
    if (cx * nx + cy * ny + cz2 * nz < 0) {
      var tp = p1; p1 = p2; p2 = tp;
      if (uvs) { var tu = [uvs[2], uvs[3]]; uvs[2] = uvs[4]; uvs[3] = uvs[5]; uvs[4] = tu[0]; uvs[5] = tu[1]; }
    }
    var cxw = (p0[0] + p1[0] + p2[0]) / 3, czw = (p0[2] + p1[2] + p2[2]) / 3;
    this._batch(cxw, czw).addTri(p0, p1, p2, nx, ny, nz, rgb, uvs, extra);
    this.stats.quads++;
  };
  CityBuilder.prototype.collider = function (x0, z0, x1, z1, y0, y1, walk) {
    if (x0 > x1) { var t = x0; x0 = x1; x1 = t; }
    if (z0 > z1) { var t2 = z0; z0 = z1; z1 = t2; }
    this.colliders.push({ x0: x0, z0: z0, x1: x1, z1: z1, y0: y0, y1: y1, walk: walk !== false });
  };
  CityBuilder.prototype.buildGroup = function (material, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    group.name = opts.name || 'CityBuildings';
    var chunks = 0, verts = 0;
    for (var i = 0; i < this.chunkKeys.length; i++) {
      var key = this.chunkKeys[i];
      var batch = this.batches[key];
      if (!batch || batch.isEmpty()) continue;
      var geo = batch.build();
      var mesh = new THREE.Mesh(geo, material);
      mesh.name = 'chunk-' + key;
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = opts.receiveShadow !== false;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      chunks++;
      verts += batch.vcount;
    }
    HK.log('city: chunks', chunks, 'quads', this.stats.quads, 'verts', verts, 'colliders', this.colliders.length);
    return group;
  };

  /* ================================================================== KIT */
  function Kit(builder, defaults) {
    this.b = builder;
    defaults = defaults || {};
    this.style = defaults.style !== undefined ? defaults.style : HK.FACADE.PURE;
    this.color = defaults.color || '#9a9a9a';
    this.roofColor = defaults.roofColor || null;
    this.seed = defaults.seed !== undefined ? defaults.seed : 7.3;
    this.glow = defaults.glow !== undefined ? defaults.glow : 1;
    this.solid = defaults.solid !== undefined ? defaults.solid : true;
    this.collide = defaults.collide !== undefined ? defaults.collide : true;
    this.jitter = defaults.jitter !== undefined ? defaults.jitter : 0.03;
  }
  Kit.prototype.spawn = function (o) {
    var k = Object.create(Kit.prototype);
    k.b = this.b;
    k.style = this.style; k.color = this.color; k.roofColor = this.roofColor;
    k.seed = this.seed; k.glow = this.glow; k.solid = this.solid; k.collide = this.collide;
    k.jitter = this.jitter;
    if (o) for (var key in o) k[key] = o[key];
    return k;
  };
  function lin3(c) { return [U.srgbToLinear(c[0]), U.srgbToLinear(c[1]), U.srgbToLinear(c[2])]; }
  Kit.prototype._res = function (o) {
    o = o || {};
    var color = o.color !== undefined ? U.hexRgb(o.color) : U.hexRgb(this.color);
    if (o.jitter !== undefined ? o.jitter : this.jitter) {
      var j = (o.jitter !== undefined ? o.jitter : this.jitter);
      color = U.jitterRgb(color, j, new HK.Rng(Math.floor((o.seed !== undefined ? o.seed : this.seed) * 997)));
    }
    var roof = o.roofColor !== undefined ? U.hexRgb(o.roofColor) : (this.roofColor ? U.hexRgb(this.roofColor) : U.shadeRgb(color, 0.62));
    color = lin3(color); roof = lin3(roof);
    return {
      color: color,
      roof: roof,
      style: o.style !== undefined ? o.style : this.style,
      seed: o.seed !== undefined ? o.seed : this.seed,
      glow: o.glow !== undefined ? o.glow : this.glow,
      solid: o.solid !== undefined ? o.solid : this.solid,
      collide: o.collide !== undefined ? o.collide : this.collide,
      top: o.top !== false,
      bottom: !!o.bottom,
      faces: o.faces || 0xFF
    };
  };
  Kit.prototype._faceCol = function (rgb, f) { return [U.clamp(rgb[0] * f, 0, 1), U.clamp(rgb[1] * f, 0, 1), U.clamp(rgb[2] * f, 0, 1)]; };
  Kit.prototype._ex = function (res, style, glow) {
    return { aStyle: style !== undefined ? style : res.style, aSeed: res.seed, aGlow: glow !== undefined ? glow : res.glow };
  };

  /* axis aligned box from bounds */
  Kit.prototype.box = function (x0, z0, x1, z1, y0, y1, o) {
    if (x0 > x1) { var t = x0; x0 = x1; x1 = t; }
    if (z0 > z1) { var t2 = z0; z0 = z1; z1 = t2; }
    if (y0 > y1) { var t3 = y0; y0 = y1; y1 = t3; }
    var res = this._res(o);
    var w = x1 - x0, d = z1 - z0, h = y1 - y0;
    if (w <= 0 || d <= 0 || h <= 0) return this;
    var c = res.color;
    var shade = [0.955, 1.0, 0.93, 1.03];
    var ex = this._ex(res);
    var faces = res.faces;
    // -Z
    if (faces & 1) this.b.addQuad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], 0, 0, -1, this._faceCol(c, shade[0]), [0, 0, w, 0, w, h, 0, h], ex);
    // +Z
    if (faces & 2) this.b.addQuad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], 0, 0, 1, this._faceCol(c, shade[1]), [0, 0, w, 0, w, h, 0, h], ex);
    // -X
    if (faces & 4) this.b.addQuad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], -1, 0, 0, this._faceCol(c, shade[2]), [0, 0, d, 0, d, h, 0, h], ex);
    // +X
    if (faces & 8) this.b.addQuad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], 1, 0, 0, this._faceCol(c, shade[3]), [0, 0, d, 0, d, h, 0, h], ex);
    // top
    if (res.top) this.b.addQuad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 0, 1, 0, res.roof, [0, 0, 0, d, w, d, w, 0], this._ex(res, HK.FACADE.PURE, 0));
    // bottom (rarely needed)
    if (res.bottom) this.b.addQuad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], 0, -1, 0, U.shadeRgb(res.roof, 0.55), [0, 0, 0, d, w, d, w, 0], this._ex(res, HK.FACADE.PURE, 0));
    if (res.solid && res.collide && h > 1 && (w * d) > 2) this.b.collider(x0, z0, x1, z1, y0, y1);
    this.b.stats.boxes++;
    return this;
  };
  Kit.prototype.boxC = function (cx, cz, w, d, y0, y1, o) {
    return this.box(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, y0, y1, o);
  };
  Kit.prototype.slab = function (cx, cz, w, d, y, o) {
    return this.box(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, y - 0.12, y, Object.assign({ collide: false, style: HK.FACADE.PURE }, o || {}));
  };

  /* rotated box (yaw only) */
  Kit.prototype.rotBox = function (cx, cz, w, d, yaw, y0, y1, o) {
    var res = this._res(o);
    var ca = Math.cos(yaw), sa = Math.sin(yaw);
    function pt(lx, lz) { return [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca]; }
    var hw = w / 2, hd = d / 2;
    var A = pt(-hw, -hd), B = pt(hw, -hd), C = pt(hw, hd), D = pt(-hw, hd);
    var c = res.color, ex = this._ex(res);
    var h = y1 - y0;
    var n0 = [-sa, 0, -ca]; // -Z local normal
    this.b.addQuad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], n0[0], 0, n0[2], this._faceCol(c, 0.96), [0, 0, w, 0, w, h, 0, h], ex);
    this.b.addQuad([C[0], y0, C[1]], [D[0], y0, D[1]], [D[0], y1, D[1]], [C[0], y1, C[1]], -n0[0], 0, -n0[2], this._faceCol(c, 1.01), [0, 0, w, 0, w, h, 0, h], ex);
    var n1 = [ca, 0, -sa]; // +X local normal
    this.b.addQuad([B[0], y0, B[1]], [C[0], y0, C[1]], [C[0], y1, C[1]], [B[0], y1, B[1]], n1[0], 0, n1[2], this._faceCol(c, 1.03), [0, 0, d, 0, d, h, 0, h], ex);
    this.b.addQuad([A[0], y0, A[1]], [D[0], y0, D[1]], [D[0], y1, D[1]], [A[0], y1, A[1]], -n1[0], 0, -n1[2], this._faceCol(c, 0.94), [0, 0, d, 0, d, h, 0, h], ex);
    this.b.addQuad([A[0], y1, A[1]], [D[0], y1, D[1]], [C[0], y1, C[1]], [B[0], y1, B[1]], 0, 1, 0, res.roof, [0, 0, 0, d, w, d, w, 0], this._ex(res, HK.FACADE.PURE, 0));
    if (res.solid && res.collide) {
      var minX = Math.min(A[0], B[0], C[0], D[0]), maxX = Math.max(A[0], B[0], C[0], D[0]);
      var minZ = Math.min(A[1], B[1], C[1], D[1]), maxZ = Math.max(A[1], B[1], C[1], D[1]);
      this.b.collider(minX, minZ, maxX, maxZ, y0, y1);
    }
    this.b.stats.boxes++;
    return this;
  };

  /* extruded polygon */
  Kit.prototype.prism = function (poly, y0, y1, o) {
    var res = this._res(o);
    var pts = poly.slice();
    var area = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    if (area < 0) pts.reverse();
    var c = res.color, ex = this._ex(res), h = y1 - y0;
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var e = 0; e < pts.length; e++) {
      var a = pts[e], b2 = pts[(e + 1) % pts.length];
      var dx = b2[0] - a[0], dz = b2[1] - a[1];
      var len = Math.sqrt(dx * dx + dz * dz);
      if (len < 1e-5) continue;
      var nx = dz / len, nz = -dx / len;
      var mx = (a[0] + b2[0]) / 2 + nx * 0.05, mz = (a[1] + b2[1]) / 2 + nz * 0.05;
      if (U.pointInPoly(mx, mz, pts)) { nx = -nx; nz = -nz; }
      this.b.addQuad([a[0], y0, a[1]], [b2[0], y0, b2[1]], [b2[0], y1, b2[1]], [a[0], y1, a[1]], nx, 0, nz, c, [0, 0, len, 0, len, h, 0, h], ex);
      minX = Math.min(minX, a[0]); maxX = Math.max(maxX, a[0]);
      minZ = Math.min(minZ, a[1]); maxZ = Math.max(maxZ, a[1]);
    }
    // top fan (works for convex / near-convex plans)
    for (var t = 1; t < pts.length - 1; t++) {
      this.b.addTri([pts[0][0], y1, pts[0][1]], [pts[t][0], y1, pts[t][1]], [pts[t + 1][0], y1, pts[t + 1][1]], 0, 1, 0, res.roof, [0, 0, 1, 0, 1, 1], this._ex(res, HK.FACADE.PURE, 0));
    }
    if (res.solid && res.collide) this.b.collider(minX, minZ, maxX, maxZ, y0, y1);
    this.b.stats.boxes++;
    return this;
  };

  /* cylinder / stepped drum */
  Kit.prototype.cyl = function (cx, cz, r, y0, y1, sides, o) {
    var res = this._res(o);
    sides = sides || 20;
    var c = res.color, ex = this._ex(res), h = y1 - y0;
    var circ = 2 * Math.PI * r / sides;
    for (var i = 0; i < sides; i++) {
      var a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
      var x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r;
      var x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
      var nx = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2);
      this.b.addQuad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], nx, 0, nz, this._faceCol(c, 0.97 + (i % 2) * 0.03), [0, 0, circ, 0, circ, h, 0, h], ex);
    }
    if (res.top) {
      for (var t = 0; t < sides; t++) {
        var b0 = t / sides * Math.PI * 2, b1 = (t + 1) / sides * Math.PI * 2;
        this.b.addTri([cx, y1, cz], [cx + Math.cos(b0) * r, y1, cz + Math.sin(b0) * r], [cx + Math.cos(b1) * r, y1, cz + Math.sin(b1) * r], 0, 1, 0, res.roof, [0, 0, 1, 0, 1, 1], this._ex(res, HK.FACADE.PURE, 0));
      }
    }
    if (res.solid && res.collide) this.b.collider(cx - r, cz - r, cx + r, cz + r, y0, y1);
    this.b.stats.boxes++;
    return this;
  };

  /* tapered stack (frustum approximated by stepped boxes) */
  Kit.prototype.taper = function (cx, cz, w0, d0, w1, d1, y0, y1, steps, o) {
    steps = steps || 4;
    var res = this._res(o);
    for (var s = 0; s < steps; s++) {
      var t0 = s / steps, t1 = (s + 1) / steps;
      var w = U.lerp(w0, w1, t0), d = U.lerp(d0, d1, t0);
      this.box(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, U.lerp(y0, y1, t0), U.lerp(y0, y1, t1) + 0.01, Object.assign({}, o || {}, { collide: res.collide && s === 0, jitter: 0 }));
    }
    return this;
  };

  /* 4-sided pyramid roof (pyramidal crown) */
  Kit.prototype.pyramid = function (cx, cz, w, d, y0, y1, o) {
    var res = this._res(o);
    var hw = w / 2, hd = d / 2;
    var A = [cx - hw, y0, cz - hd], B = [cx + hw, y0, cz - hd], C = [cx + hw, y0, cz + hd], D = [cx - hw, y0, cz + hd];
    var apex = [cx, y1, cz];
    var ex = this._ex(res, HK.FACADE.PURE, 0);
    this.b.addTri(A, B, apex, 0, 0.6, -0.8, res.roof, [0, 0, 1, 0, 0.5, 1], ex);
    this.b.addTri(B, C, apex, 0.8, 0.6, 0, res.roof, [0, 0, 1, 0, 0.5, 1], ex);
    this.b.addTri(C, D, apex, 0, 0.6, 0.8, res.roof, [0, 0, 1, 0, 0.5, 1], ex);
    this.b.addTri(D, A, apex, -0.8, 0.6, 0, res.roof, [0, 0, 1, 0, 0.5, 1], ex);
    return this;
  };

  /* dome / stepped dome */
  Kit.prototype.dome = function (cx, cz, r, y0, y1, steps, o) {
    steps = steps || 5;
    for (var s = 0; s < steps; s++) {
      var t = (s + 1) / steps;
      var rr = r * Math.cos(t * Math.PI / 2) * 0.98 + 0.01;
      var ya = y0 + (y1 - y0) * Math.pow(s / steps, 0.8);
      var yb = y0 + (y1 - y0) * Math.pow((s + 1) / steps, 0.8);
      this.cyl(cx, cz, rr, ya, yb, Math.max(8, Math.round(18 * (1 - t * 0.5))), Object.assign({}, o || {}, { collide: s === 0 }));
    }
    return this;
  };

  /* spires / masts */
  Kit.prototype.spire = function (cx, cz, r, y0, y1, o) {
    var steps = 4;
    for (var s = 0; s < steps; s++) {
      var t = s / steps;
      var rr = r * (1 - t * 0.75);
      this.cyl(cx, cz, rr, U.lerp(y0, y1, t), U.lerp(y0, y1, (s + 1) / steps) + 0.02, 8, Object.assign({}, o || {}, { collide: false }));
    }
    return this;
  };

  /* oriented box beam between two 3D points */
  Kit.prototype.beam = function (p0, p1, w, h, o) {
    var res = this._res(o);
    var fx = p1[0] - p0[0], fy = p1[1] - p0[1], fz = p1[2] - p0[2];
    var len = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (len < 1e-4) return this;
    fx /= len; fy /= len; fz /= len;
    var refx = 0, refy = 1, refz = 0;
    if (Math.abs(fy) > 0.94) { refx = 1; refy = 0; refz = 0; }
    var rx = fy * refz - fz * refy, ry = fz * refx - fx * refz, rz = fx * refy - fy * refx;
    var rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    var ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    var hw = w / 2, hh = h / 2;
    function corner(p, sr, su) { return [p[0] + rx * hw * sr + ux * hh * su, p[1] + ry * hw * sr + uy * hh * su, p[2] + rz * hw * sr + uz * hh * su]; }
    var A0 = corner(p0, -1, -1), A1 = corner(p0, 1, -1), A2 = corner(p0, 1, 1), A3 = corner(p0, -1, 1);
    var B0 = corner(p1, -1, -1), B1 = corner(p1, 1, -1), B2 = corner(p1, 1, 1), B3 = corner(p1, -1, 1);
    var c = res.color, ex = this._ex(res, HK.FACADE.PURE, 0);
    // +u side, -u side, +r side, -r side, caps
    this.b.addQuad(A2, B2, B3, A3, ux, uy, uz, c, [0, 0, len, 0, len, w, 0, w], ex);
    this.b.addQuad(A0, B0, B1, A1, -ux, -uy, -uz, this._faceCol(c, 0.9), [0, 0, len, 0, len, w, 0, w], ex);
    this.b.addQuad(A1, B1, B2, A2, rx, ry, rz, this._faceCol(c, 1.02), [0, 0, len, 0, len, h, 0, h], ex);
    this.b.addQuad(A3, B3, B0, A0, -rx, -ry, -rz, this._faceCol(c, 0.94), [0, 0, len, 0, len, h, 0, h], ex);
    this.b.addQuad(A0, A1, A2, A3, -fx, -fy, -fz, this._faceCol(c, 0.85), [0, 0, w, 0, w, h, 0, h], ex);
    this.b.addQuad(B0, B1, B2, B3, fx, fy, fz, this._faceCol(c, 1.05), [0, 0, w, 0, w, h, 0, h], ex);
    return this;
  };

  /* flat diagonal brace (for structural expression on facades) */
  Kit.prototype.brace = function (p0, p1, width, planeN, o) {
    var res = this._res(o);
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-4) return this;
    var nx = planeN[0], ny = planeN[1], nz = planeN[2];
    var px = dy * nz - dz * ny, py = dz * nx - dx * nz, pz = dx * ny - dy * nx;
    var pl = Math.sqrt(px * px + py * py + pz * pz) || 1; px /= pl; py /= pl; pz /= pl;
    var hw = width / 2;
    var off = 0.04;
    var ox = nx * off, oy = ny * off, oz = nz * off;
    var A = [p0[0] + px * hw + ox, p0[1] + py * hw + oy, p0[2] + pz * hw + oz];
    var B = [p0[0] - px * hw + ox, p0[1] - py * hw + oy, p0[2] - pz * hw + oz];
    var C = [p1[0] - px * hw + ox, p1[1] - py * hw + oy, p1[2] - pz * hw + oz];
    var D = [p1[0] + px * hw + ox, p1[1] + py * hw + oy, p1[2] + pz * hw + oz];
    this.b.addQuad(A, B, C, D, nx, ny, nz, this._faceCol(res.color, 1), [0, 0, width, 0, width, len, 0, len], this._ex(res, res.style, res.glow));
    return this;
  };

  /* thin facade plate / panel */
  Kit.prototype.panel = function (p0, p1, p2, p3, normal, o) {
    var res = this._res(o);
    this.b.addQuad(p0, p1, p2, p3, normal[0], normal[1], normal[2], res.color, [0, 0, 1, 0, 1, 1, 0, 1], this._ex(res, HK.FACADE.PURE, 0));
    return this;
  };

  /* roof clutter: AC units, water tanks, antennas, parapet */
  Kit.prototype.roofClutter = function (cx, cz, w, d, y, seed, o) {
    var rng = new HK.Rng(seed || 13);
    var metal = '#6a6d70', dark = '#3a3c3e';
    this.box(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2 + 0.35, y, y + 0.6, { color: dark, style: HK.FACADE.PURE, collide: false, jitter: 0 });
    this.box(cx - w / 2, cz + d / 2 - 0.35, cx + w / 2, cz + d / 2, y, y + 0.6, { color: dark, style: HK.FACADE.PURE, collide: false, jitter: 0 });
    this.box(cx - w / 2, cz - d / 2, cx - w / 2 + 0.35, cz + d / 2, y, y + 0.6, { color: dark, style: HK.FACADE.PURE, collide: false, jitter: 0 });
    var n = 2 + Math.floor(rng.next() * 4);
    for (var i = 0; i < n; i++) {
      var bw = rng.float(0.8, 2.2), bd = rng.float(0.8, 2.2), bh = rng.float(0.4, 1.4);
      var px = cx + rng.float(-w / 2 + 1.2, w / 2 - 1.2), pz = cz + rng.float(-d / 2 + 1.2, d / 2 - 1.2);
      this.box(px - bw / 2, pz - bd / 2, px + bw / 2, pz + bd / 2, y, y + bh, { color: rng.chance(0.6) ? metal : '#8d8f8f', style: HK.FACADE.PURE, collide: false, jitter: 0.06 });
    }
    if (rng.chance(0.3)) this.cyl(cx + rng.float(-w / 3, w / 3), cz + rng.float(-d / 3, d / 3), rng.float(0.7, 1.4), y, y + rng.float(1.2, 2.4), 10, { color: '#9aa0a2', style: HK.FACADE.PURE, collide: false });
    if (rng.chance(0.45)) {
      var ax = cx + rng.float(-w / 3, w / 3), az = cz + rng.float(-d / 3, d / 3);
      this.spire(ax, az, 0.14, y, y + rng.float(3, 9), { color: '#8c9092', style: HK.FACADE.PURE, collide: false });
    }
    return this;
  };

  /* aircraft warning beacon request */
  Kit.prototype.beacon = function (x, y, z, color) {
    this.b.beacons.push({ x: x, y: y, z: z, color: color || '#ff3322' });
    return this;
  };

  /* neon / signage request (built by props) */
  Kit.prototype.sign = function (req) {
    this.b.signs.push(req);
    return this;
  };

  /* register a collider not tied to a visual box (piers, terrain platforms) */
  Kit.prototype.collideBox = function (x0, z0, x1, z1, y0, y1, walk) {
    this.b.collider(x0, z0, x1, z1, y0, y1, walk);
    return this;
  };

  /* ======================================================= facade material */
  var FACADE_HELPERS = `
uniform float uNight;
uniform float uTime;
uniform vec3 uSkyTint;
varying vec2 vFacadeUv;
varying float vStyle;
varying float vSeed;
varying float vGlow;
varying vec3 vWNormal;
varying vec3 vWPos;

float fHash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}
float fHash2(vec2 p, float s) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + s) * 43758.5453);
}
vec3 fWindowsLit(vec2 id, float seed, float style) {
  float warm = fHash2(id * 1.13, seed + 1.7);
  vec3 warmCol = mix(vec3(1.0, 0.66, 0.32), vec3(1.0, 0.82, 0.55), warm);
  vec3 coolCol = mix(vec3(0.62, 0.8, 1.0), vec3(0.85, 0.94, 1.0), smoothstep(0.0, 1.0, warm));
  return mix(warmCol, coolCol, step(0.72, warm));
}

void facadeShade(vec3 baseCol, vec2 uv, float styleRaw, float seed, float glow, float roof, float isBottom,
                 out vec3 albedo, out float rough, out float metal, out vec3 emis) {
  float night = uNight;
  vec3 V = normalize(cameraPosition - vWPos);
  float fres = pow(1.0 - clamp(abs(dot(V, normalize(vWNormal))), 0.0, 1.0), 4.0);
  float st = floor(styleRaw + 0.5);
  albedo = baseCol;
  rough = 0.62;
  metal = 0.1;
  emis = vec3(0.0);

  if (roof > 0.5) {
    float rn = fHash(floor(vWPos.xz * 0.9) + seed);
    albedo = baseCol * (0.84 + rn * 0.2);
    rough = 0.92; metal = 0.02;
    // thin gravelled edge shading
    albedo *= 0.96 + 0.04 * smoothstep(0.0, 2.0, abs(uv.x));
    return;
  }
  if (isBottom > 0.5) { albedo = baseCol * 0.4; rough = 0.95; return; }

  float floorH = 1.9;
  float cellW = 1.05;
  float win = 0.0;
  vec3 glass = baseCol * 0.26 + uSkyTint * 0.34;
  vec3 frame = baseCol;
  float lit = 0.0;
  float acUnit = 0.0;

  if (st < 0.5) {                 /* 0 glass blue */
    floorH = 1.9; cellW = 1.05;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 1.7, seed * 0.37);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.07, f.x) * step(f.x, 0.94) * step(0.15, f.y) * step(f.y, 0.86);
    float rnd = fHash2(id, seed * 2.3 + 4.0);
    glass = mix(baseCol * 0.30, uSkyTint * 0.74, 0.55) + fres * uSkyTint * 0.30;
    frame = baseCol * 0.84;
    albedo = mix(frame, glass, win);
    rough = mix(0.62, 0.08, win); metal = mix(0.2, 0.82, win);
    lit = step(0.68, rnd);
    emis += fWindowsLit(id, seed, 0.0) * win * lit * (0.35 + 0.9 * night) * glow;
  } else if (st < 1.5) {          /* 1 glass teal */
    floorH = 1.85; cellW = 1.0;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 2.1, seed * 0.71);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.06, f.x) * step(f.x, 0.95) * step(0.18, f.y) * step(f.y, 0.82);
    float rnd = fHash2(id, seed * 1.9 + 2.0);
    glass = mix(baseCol * 0.3, uSkyTint * vec3(0.55, 0.84, 0.8), 0.55) + fres * vec3(0.5, 0.8, 0.8) * 0.32;
    frame = baseCol * 0.7;
    float band = step(0.82, f.y);
    albedo = mix(frame, glass, win) * mix(1.0, 0.9, band);
    rough = mix(0.5, 0.07, win); metal = mix(0.25, 0.85, win);
    lit = step(0.62, rnd);
    emis += fWindowsLit(id, seed, 1.0) * win * lit * (0.3 + 0.9 * night) * glow;
  } else if (st < 2.5) {          /* 2 glass silver */
    floorH = 1.8; cellW = 0.95;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 3.3, seed * 1.1);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.1, f.x) * step(f.x, 0.9) * step(0.22, f.y) * step(f.y, 0.8);
    float rnd = fHash2(id, seed + 9.0);
    glass = mix(baseCol * 0.35, uSkyTint * 0.78, 0.65) + fres * 0.4;
    albedo = mix(baseCol, glass, win);
    rough = mix(0.42, 0.05, win); metal = mix(0.55, 0.95, win);
    lit = step(0.72, rnd);
    emis += fWindowsLit(id, seed, 2.0) * win * lit * (0.3 + 0.7 * night) * glow;
  } else if (st < 3.5) {          /* 3 bronze */
    floorH = 1.75; cellW = 1.15;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 1.3, seed * 2.7);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.05, f.x) * step(f.x, 0.95) * step(0.3, f.y) * step(f.y, 0.78);
    float rnd = fHash2(id, seed * 0.7 + 3.0);
    glass = mix(baseCol * 0.2, vec3(0.55, 0.45, 0.3), 0.35) + uSkyTint * 0.25 + fres * 0.3;
    albedo = mix(baseCol * 0.8, glass, win);
    rough = mix(0.55, 0.09, win); metal = mix(0.4, 0.9, win);
    lit = step(0.7, rnd);
    emis += fWindowsLit(id, seed, 3.0) * win * lit * (0.35 + 0.8 * night) * glow;
  } else if (st < 4.5) {          /* 4 dark curtain */
    floorH = 1.9; cellW = 0.75;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 2.9, seed * 0.5);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.16, f.x) * step(f.x, 0.84) * step(0.1, f.y) * step(f.y, 0.9);
    float rnd = fHash2(id, seed + 21.0);
    glass = baseCol * 0.32 + uSkyTint * 0.3 + fres * 0.28;
    albedo = mix(baseCol * 0.55, glass, win);
    rough = mix(0.45, 0.06, win); metal = mix(0.4, 0.9, win);
    lit = step(0.62, rnd);
    emis += vec3(1.0, 0.75, 0.45) * win * lit * (0.25 + 0.8 * night) * glow;
  } else if (st < 5.5) {          /* 5 punched windows (concrete) */
    floorH = 1.65; cellW = 0.95;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 1.1, seed * 2.2);
    vec2 id = floor(cell); vec2 f = fract(cell);
    float ww = step(0.3, f.x) * step(f.x, 0.7);
    float wh = step(0.28, f.y) * step(f.y, 0.72);
    win = ww * wh;
    float rnd = fHash2(id, seed * 2.0 + 5.0);
    float frameM = step(0.26, f.x) * step(f.x, 0.74) * step(0.24, f.y) * step(f.y, 0.76) - win;
    albedo = mix(baseCol, glass, win);
    albedo = mix(albedo, baseCol * 0.8, clamp(frameM, 0.0, 1.0));
    rough = mix(0.88, 0.35, win); metal = mix(0.03, 0.35, win);
    // air conditioners / laundry below windows
    acUnit = step(0.84, fHash2(id + 7.3, seed));
    albedo = mix(albedo, vec3(0.35, 0.37, 0.38), acUnit * (1.0 - win) * step(f.y, 0.26));
    lit = step(0.66, rnd);
    emis += fWindowsLit(id, seed, 5.0) * win * lit * (0.55 + 1.2 * night) * glow;
  } else if (st < 6.5) {          /* 6 horizontal bands */
    floorH = 1.65; cellW = 1.2;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 1.9, seed * 0.9);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.2, f.y) * step(f.y, 0.72) * (1.0 - step(0.05, fract(uv.x / cellW) * (1.0 - step(0.05, fract(uv.x / cellW)))));
    float rnd = fHash2(id, seed + 6.0);
    glass = baseCol * 0.25 + uSkyTint * 0.28 + fres * 0.2;
    albedo = mix(baseCol, glass, win);
    rough = mix(0.8, 0.2, win); metal = mix(0.05, 0.5, win);
    lit = step(0.48, rnd);
    emis += fWindowsLit(id, seed, 6.0) * win * lit * (0.4 + 1.0 * night) * glow;
  } else if (st < 7.5) {          /* 7 residential towers */
    floorH = 1.55; cellW = 0.9;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 2.3, seed * 1.7);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.82);
    float rnd = fHash2(id, seed * 1.3 + 8.0);
    float balcony = step(0.82, f.y);
    glass = baseCol * 0.3 + uSkyTint * 0.2;
    albedo = mix(baseCol, glass, win);
    albedo = mix(albedo, baseCol * 0.72, balcony);
    rough = mix(0.85, 0.3, win); metal = mix(0.04, 0.3, win);
    lit = step(0.62, rnd);
    emis += fWindowsLit(id, seed, 7.0) * win * lit * (0.5 + 1.1 * night) * glow;
  } else if (st < 8.5) {          /* 8 old dense residential */
    floorH = 1.5; cellW = 0.82;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 3.1, seed * 0.3);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.28, f.x) * step(f.x, 0.72) * step(0.32, f.y) * step(f.y, 0.78);
    float rnd = fHash2(id, seed * 0.9 + 12.0);
    glass = baseCol * 0.3 + uSkyTint * 0.22;
    albedo = mix(baseCol * 1.02, glass, win);
    // grimy streaks
    float streak = fHash2(vec2(floor(uv.x / 0.9), floor(seed * 3.0)), 3.0);
    albedo *= 0.9 + 0.1 * smoothstep(0.0, 3.0, uv.y) + streak * 0.05;
    rough = mix(0.92, 0.45, win); metal = 0.03;
    lit = step(0.54, rnd);
    emis += fWindowsLit(id, seed, 8.0) * win * lit * (0.55 + 1.2 * night) * glow;
  } else if (st < 9.5) {          /* 9 porthole (Jardine House) */
    floorH = 1.75; cellW = 1.0;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 1.4, seed * 2.5);
    vec2 id = floor(cell); vec2 f = fract(cell);
    float d = length(f - 0.5);
    win = 1.0 - smoothstep(0.24, 0.27, d);
    float rnd = fHash2(id, seed + 4.0);
    glass = baseCol * 0.34 + uSkyTint * 0.26;
    albedo = mix(baseCol, glass, win);
    rough = mix(0.75, 0.12, win); metal = mix(0.1, 0.6, win);
    lit = step(0.5, rnd);
    emis += fWindowsLit(id, seed, 9.0) * win * lit * (0.5 + 1.0 * night) * glow;
  } else if (st < 10.5) {         /* 10 stone / heritage */
    floorH = 2.0; cellW = 1.3;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 0.8, seed * 2.0);
    vec2 id = floor(cell); vec2 f = fract(cell);
    float ww = step(0.34, f.x) * step(f.x, 0.66);
    float wh = step(0.3, f.y) * step(f.y, 0.82);
    win = ww * wh;
    float arch = step(0.66, f.x) * step(f.x, 0.34) * 0.0;
    float rnd = fHash2(id, seed * 2.0 + 7.0);
    float joint = step(0.94, f.y);
    albedo = mix(baseCol, baseCol * 0.82, joint);
    albedo = mix(albedo, vec3(0.11, 0.13, 0.14), win);
    albedo = mix(albedo, baseCol * 1.06, step(0.28, f.x) * step(f.x, 0.32) * wh + step(0.68, f.x) * step(f.x, 0.72) * wh);
    rough = mix(0.9, 0.5, win); metal = 0.02;
    lit = step(0.62, rnd);
    emis += vec3(1.0, 0.72, 0.4) * win * lit * (0.6 + 1.3 * night) * glow;
  } else if (st < 11.5) {         /* 11 metal / industrial */
    floorH = 1.2; cellW = 1.6;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 2.6, seed * 0.4);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.3, f.x) * step(f.x, 0.7) * step(0.35, f.y) * step(f.y, 0.8);
    float rnd = fHash2(id, seed + 31.0);
    float corrug = step(0.5, fract(uv.x * 3.0)) * 0.06;
    albedo = mix(baseCol * (0.92 + corrug), baseCol * 0.2, win);
    rough = 0.72; metal = 0.45;
    lit = step(0.6, rnd);
    emis += vec3(1.0, 0.8, 0.5) * win * lit * (0.3 + 0.9 * night) * glow;
  } else if (st < 12.5) {         /* 12 LED media facade */
    floorH = 1.6; cellW = 0.8;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 1.2, seed * 0.6);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.08, f.x) * step(f.x, 0.92) * step(0.15, f.y) * step(f.y, 0.85);
    albedo = mix(baseCol * 0.4, baseCol * 0.14, win);
    rough = mix(0.5, 0.08, win); metal = mix(0.3, 0.85, win);
    float wave = sin(uv.y * 0.55 - uTime * 1.7 + seed * 4.0);
    float band = smoothstep(0.2, 0.95, wave);
    vec3 ledCol = mix(vec3(0.1, 0.55, 1.0), vec3(1.0, 0.25, 0.6), 0.5 + 0.5 * sin(uTime * 0.4 + seed));
    emis += ledCol * win * night * glow * (0.4 + 1.6 * band);
    lit = 0.0;
  } else if (st < 13.5) {         /* 13 pure / structure */
    float seam = step(0.97, fract(uv.x * 0.8)) + step(0.97, fract(uv.y * 0.8));
    albedo = baseCol * (1.0 - seam * 0.12) * (0.94 + 0.06 * fHash(floor(uv * 1.5) + seed));
    rough = 0.55; metal = 0.35;
  } else if (st < 14.5) {         /* 14 industrial cladding */
    floorH = 1.5; cellW = 1.8;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 1.5, seed * 2.8);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.38, f.x) * step(f.x, 0.62) * step(0.4, f.y) * step(f.y, 0.72);
    float corrug = step(0.5, fract(uv.x * 4.0)) * 0.05;
    albedo = mix(baseCol * (0.9 + corrug), baseCol * 0.25, win);
    rough = 0.8; metal = 0.2;
    lit = step(0.7, fHash2(id, seed + 17.0));
    emis += vec3(1.0, 0.85, 0.6) * win * lit * (0.4 + 1.0 * night) * glow;
  } else {                        /* 15 heritage stone / 16 diagonal truss */
    floorH = 1.9; cellW = 1.1;
    vec2 cell = vec2(uv.x / cellW, uv.y / floorH) + vec2(seed * 1.6, seed * 1.2);
    vec2 id = floor(cell); vec2 f = fract(cell);
    win = step(0.18, f.x) * step(f.x, 0.82) * step(0.2, f.y) * step(f.y, 0.82);
    float rnd = fHash2(id, seed + 27.0);
    float diag = step(0.07, abs(fract((uv.x + uv.y) * 0.9) - 0.5)) * 0.0;
    float truss = smoothstep(0.02, 0.05, abs(fract((uv.x + uv.y) * 0.42 + seed * 0.01) - 0.5));
    albedo = mix(baseCol, baseCol * 0.16, win);
    if (st > 15.5) albedo = mix(vec3(0.88, 0.88, 0.84), albedo, truss * 0.85);
    rough = mix(0.85, 0.2, win); metal = mix(0.05, 0.6, win);
    lit = step(0.55, rnd);
    emis += fWindowsLit(id, seed, 15.0) * win * lit * (0.45 + 1.0 * night) * glow;
  }

  // low-frequency floor rhythm survives at skyline distance
  float floorRhythm = step(0.5, fract(uv.y / (floorH * 5.0)));
  albedo *= 0.955 + 0.045 * floorRhythm;

  // screen-space distance fade: distant facades dissolve into their average
  // tone instead of aliasing into black-and-white moiré at skyline distance
  float winAA = 1.0 - smoothstep(0.22, 1.15, max(fwidth(uv.x), fwidth(uv.y)));
  vec3 facadeAvg = mix(frame, glass, 0.38);
  albedo = mix(facadeAvg, albedo, winAA);
  rough = mix(0.55, rough, winAA);
  metal = mix(0.22, metal, winAA);
  emis *= mix(0.78, 1.0, winAA);
  emis *= (1.0 + night * 0.5);

  // cluster some whole floors dark, and calm the overall window density at night
  float floorCluster = fHash2(vec2(floor(uv.y / (floorH * 4.0)), seed * 1.7), 19.0);
  emis *= (0.5 + 0.85 * smoothstep(0.18, 0.5, floorCluster));

  // ground grime + facade noise
  float grime = 0.94 + 0.06 * fHash(floor(vWPos.xz * 0.4) + seed);
  albedo *= grime * (0.88 + 0.12 * smoothstep(0.0, 3.0, uv.y));
  emis *= smoothstep(0.0, 0.15, night) * glow;
}
`;

  function createFacadeMaterial() {
    var uniforms = {
      uNight: { value: 0 },
      uTime: { value: 0 },
      uSkyTint: { value: new THREE.Color(0x9fc0d0) }
    };
    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.25
    });
    mat.extensions = { derivatives: true };
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uNight = uniforms.uNight;
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uSkyTint = uniforms.uSkyTint;
      shader.vertexShader =
        'attribute vec2 aUv;\nattribute float aStyle;\nattribute float aSeed;\nattribute float aGlow;\n' +
        'varying vec2 vFacadeUv;\nvarying float vStyle;\nvarying float vSeed;\nvarying float vGlow;\n' +
        'varying vec3 vWNormal;\nvarying vec3 vWPos;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        'vFacadeUv = aUv; vStyle = aStyle; vSeed = aSeed; vGlow = aGlow;\n' +
        'vWNormal = normalize(mat3(modelMatrix) * normal);\n' +
        'vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
      shader.fragmentShader = FACADE_HELPERS + '\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n' +
        'vec3 facadeAlbedo; float facadeRough; float facadeMetal; vec3 facadeEmis;\n' +
        'float fRoof = step(0.5, vWNormal.y); float fBottom = step(vWNormal.y, -0.5);\n' +
        'facadeShade(diffuseColor.rgb, vFacadeUv, vStyle, vSeed, vGlow, fRoof, fBottom, facadeAlbedo, facadeRough, facadeMetal, facadeEmis);\n' +
        'diffuseColor.rgb = facadeAlbedo;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = facadeRough;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = facadeMetal;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += facadeEmis;'
      );
    };
    mat.customProgramCacheKey = function () { return 'hk-facade-v3'; };
    mat.userData.uniforms = uniforms;
    return mat;
  }

  HK.CityBuilder = CityBuilder;
  HK.Kit = Kit;
  HK.FacadeMaterial = { create: createFacadeMaterial };
})();
