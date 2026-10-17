/* ============================================================================
 * HK VOXEL HARBOUR — POST PROCESSING                        (owner: skyward)
 * ----------------------------------------------------------------------------
 * HDR-ish pipeline for a voxel Victoria Harbour:
 *
 *   1. scene is rendered LINEAR (renderer.toneMapping = NoToneMapping,
 *      outputEncoding = LinearEncoding) into an MSAA half-float render target
 *   2. threshold bright-pass -> multi-mip dual-filter bloom (down + tent up)
 *   3. composite: scene*exposure + bloom, ACES filmic curve (exact r149
 *      ACESFilmicToneMapping math), sRGB encode, teal-shadow / warm-highlight
 *      grade, vignette, chromatic aberration, letterbox-ish darkening, grain,
 *      ordered dither to kill gradient banding.
 *
 * Because the final composite implements ACES + sRGB itself, turning bloom
 * off or comparing with a plain renderer.render() keeps the same colour
 * response (only the glow changes).
 *
 * Public API (docs/INTERFACES.md):
 *   var post = HK.Post.create({ renderer, scene, camera, quality, env });
 *   post.render(dt)  post.resize(w, h, pixelRatio)  post.setQuality(q)
 *   post.setEnv(env)  post.setCinematic(b)  post.setPhoto(b)
 *   post.uniforms    post.dispose()          post.setEnabled(b)
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, T = window.THREE;
  if (!HK || !T) { console.error('[HK.Post] requires core.js and three.js'); return; }
  var U = HK.Util;

  var QUAD_VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var BRIGHT_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform vec2 uTexel;',
    'uniform float uThreshold, uKnee, uClamp;',
    'void main() {',
    '  vec3 c = texture2D(tDiffuse, vUv + uTexel * vec2(-0.5, -0.5)).rgb;',
    '  c += texture2D(tDiffuse, vUv + uTexel * vec2(0.5, -0.5)).rgb;',
    '  c += texture2D(tDiffuse, vUv + uTexel * vec2(-0.5, 0.5)).rgb;',
    '  c += texture2D(tDiffuse, vUv + uTexel * vec2(0.5, 0.5)).rgb;',
    '  c *= 0.25;',
    '  c = min(c, vec3(uClamp));',
    '  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  float w = smoothstep(uThreshold, uThreshold + uKnee, lum);',
    '  gl_FragColor = vec4(c * w, 1.0);',
    '}'
  ].join('\n');

  var DOWN_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform vec2 uTexel;',
    'void main() {',
    '  vec3 c = texture2D(tDiffuse, vUv + uTexel * vec2(-0.5, -0.5)).rgb;',
    '  c += texture2D(tDiffuse, vUv + uTexel * vec2(0.5, -0.5)).rgb;',
    '  c += texture2D(tDiffuse, vUv + uTexel * vec2(-0.5, 0.5)).rgb;',
    '  c += texture2D(tDiffuse, vUv + uTexel * vec2(0.5, 0.5)).rgb;',
    '  gl_FragColor = vec4(c * 0.25, 1.0);',
    '}'
  ].join('\n');

  var UP_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform vec2 uTexel;',
    'void main() {',
    '  vec3 c = texture2D(tDiffuse, vUv).rgb * 4.0;',
    '  c += texture2D(tDiffuse, vUv + vec2(-uTexel.x, 0.0)).rgb * 2.0;',
    '  c += texture2D(tDiffuse, vUv + vec2( uTexel.x, 0.0)).rgb * 2.0;',
    '  c += texture2D(tDiffuse, vUv + vec2(0.0, -uTexel.y)).rgb * 2.0;',
    '  c += texture2D(tDiffuse, vUv + vec2(0.0,  uTexel.y)).rgb * 2.0;',
    '  c += texture2D(tDiffuse, vUv + vec2(-uTexel.x, -uTexel.y)).rgb;',
    '  c += texture2D(tDiffuse, vUv + vec2( uTexel.x, -uTexel.y)).rgb;',
    '  c += texture2D(tDiffuse, vUv + vec2(-uTexel.x,  uTexel.y)).rgb;',
    '  c += texture2D(tDiffuse, vUv + vec2( uTexel.x,  uTexel.y)).rgb;',
    '  gl_FragColor = vec4(c * 0.0625, 1.0);',
    '}'
  ].join('\n');

  var COMPOSITE_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D tScene, tBloom;',
    'uniform vec2 uResolution;',
    'uniform float uExposure, uBloom, uVignette, uGrain, uCA, uNight, uLetterbox;',
    'uniform float uSaturation, uContrast, uPhoto, uTime, uFlash, uLift, uShadowLift;',
    'uniform vec3 uGradeShadow, uGradeHigh;',

    // --- exact three.js r149 ACES filmic tone mapping
    'vec3 RRTAndODTFit(vec3 v) {',
    '  vec3 a = v * (v + 0.0245786) - 0.000090537;',
    '  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;',
    '  return a / b;',
    '}',
    'vec3 acesFilmic(vec3 color) {',
    '  const mat3 ACESInputMat = mat3(',
    '    vec3(0.59719, 0.07600, 0.02840),',
    '    vec3(0.35458, 0.90834, 0.13383),',
    '    vec3(0.04823, 0.01566, 0.83777)',
    '  );',
    '  const mat3 ACESOutputMat = mat3(',
    '    vec3( 1.60475, -0.10208, -0.00327),',
    '    vec3(-0.53108,  1.10813, -0.07276),',
    '    vec3(-0.07367, -0.00605,  1.07602)',
    '  );',
    '  color = ACESInputMat * color;',
    '  color = RRTAndODTFit(color);',
    '  color = ACESOutputMat * color;',
    '  return clamp(color, 0.0, 1.0);',
    '}',
    'vec3 linearToSRGB(vec3 v) {',
    '  return mix(pow(v, vec3(0.41666)) * 1.055 - vec3(0.055), v * 12.92,',
    '             vec3(lessThanEqual(v, vec3(0.0031308))));',
    '}',

    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 cen = uv - 0.5;',
    // chromatic aberration (radial, stronger toward the corners)
    '  vec2 caOff = cen * uCA * (0.35 + dot(cen, cen) * 2.4);',
    '  vec3 scene;',
    '  scene.r = texture2D(tScene, uv + caOff).r;',
    '  scene.g = texture2D(tScene, uv).g;',
    '  scene.b = texture2D(tScene, uv - caOff).b;',
    '  vec3 bloom = texture2D(tBloom, uv).rgb;',
    '  vec3 hdr = scene * uExposure + bloom * uBloom;',
    '  vec3 col = acesFilmic(hdr);',
    '  col = linearToSRGB(col);',
    // ---- filmic grade in display space
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  float shMask = 1.0 - smoothstep(0.015, 0.42, lum);',
    '  float hiMask = smoothstep(0.32, 0.95, lum);',
    '  col += uGradeShadow * shMask;',
    '  col += uGradeHigh * hiMask;',
    '  col = mix(vec3(lum), col, uSaturation);',
    '  col = (col - 0.5) * uContrast + 0.5;',
    '  col = max(col, vec3(0.0));',
    // gentle toe lift so night shadows read without crushing detail
    '  col = pow(max(col, vec3(0.0)), vec3(1.0 - uShadowLift));',
    '  col = mix(col, vec3(uLift), (1.0 - smoothstep(0.0, 0.20, lum)) * uLift * 3.0);',
    // gentle highlight rolloff so bright sky/glitter never clips to flat white
    '  vec3 hi = max(col - 0.86, vec3(0.0));',
    '  col -= hi * 0.30;',
    // vignette
    '  float vr = length(cen * vec2(1.0, 0.94)) * 1.30;',
    '  float vig = 1.0 - uVignette * smoothstep(0.20, 1.02, vr);',
    '  col *= vig;',
    // cinematic letterbox-ish darkening (UI may draw real bars on top)
    '  if (uLetterbox > 0.001) {',
    '    float edge = smoothstep(0.0, 0.135, uv.y) * smoothstep(0.0, 0.135, 1.0 - uv.y);',
    '    col *= mix(1.0, edge, uLetterbox);',
    '  }',
    // lightning wash
    '  col += uFlash * vec3(0.55, 0.62, 0.80) * 0.045;',
    // film grain (display space, very fine)
    '  if (uGrain > 0.0001) {',
    '    float n = fract(sin(dot(uv * uResolution + vec2(uTime * 61.7, uTime * 37.3), vec2(12.9898, 78.233))) * 43758.5453);',
    '    float n2 = fract(sin(dot(uv * uResolution * 0.5 + vec2(uTime * 13.1), vec2(39.3468, 11.135))) * 24634.6345);',
    '    col += ((n - 0.5) * 0.7 + (n2 - 0.5) * 0.3) * uGrain;',
    '  }',
    '  col = clamp(col, 0.0, 1.0);',
    // ordered-ish dither against 8-bit banding in sky gradients
    '  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (d - 0.5) * (1.0 / 255.0);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function Post(opts) {
    opts = opts || {};
    this.renderer = opts.renderer;
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.quality = HK.QUALITY[opts.quality] ? opts.quality : 'high';
    this.qcfg = HK.QUALITY[this.quality];
    this._env = opts.env || null;
    this._cinematic = false;
    this._photo = false;
    this._enabled = true;
    this.bloomEnabled = true;
    this._time = 0;
    this._w = 0; this._h = 0; this._pr = 1;
    this._mips = [];
    this._samples = 0;
    this._rtType = T.UnsignedByteType;
    this._fakeEnv = null;

    var r = this.renderer;
    this._saved = {
      toneMapping: r.toneMapping,
      outputEncoding: r.outputEncoding,
      autoClear: r.autoClear,
      exposure: r.toneMappingExposure
    };
    r.toneMapping = T.NoToneMapping;
    r.outputEncoding = T.LinearEncoding;

    /* ---- fullscreen quad ---- */
    this._quadScene = new T.Scene();
    this._quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._quadGeo = new T.PlaneGeometry(2, 2);
    this._quad = new T.Mesh(this._quadGeo, null);
    this._quad.frustumCulled = false;
    this._quadScene.add(this._quad);

    /* ---- materials ---- */
    this.brightMat = new T.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, uTexel: { value: new T.Vector2() },
        uThreshold: { value: 0.85 }, uKnee: { value: 0.55 }, uClamp: { value: 48.0 }
      },
      vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false
    });
    this.downMat = new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new T.Vector2() } },
      vertexShader: QUAD_VERT, fragmentShader: DOWN_FRAG, depthTest: false, depthWrite: false
    });
    this.upMat = new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new T.Vector2() } },
      vertexShader: QUAD_VERT, fragmentShader: UP_FRAG,
      depthTest: false, depthWrite: false,
      blending: T.AdditiveBlending, transparent: true
    });
    this.compositeMat = new T.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null },
        uResolution: { value: new T.Vector2(1, 1) },
        uExposure: { value: 1.05 }, uBloom: { value: 0.6 },
        uVignette: { value: 0.22 }, uGrain: { value: 0.016 }, uCA: { value: 0.0009 },
        uNight: { value: 0 }, uLetterbox: { value: 0 }, uSaturation: { value: 1.05 },
        uContrast: { value: 1.045 }, uPhoto: { value: 0 }, uTime: { value: 0 },
        uFlash: { value: 0 }, uLift: { value: 0.012 }, uShadowLift: { value: 0.05 },
        uGradeShadow: { value: new T.Color(-0.012, 0.008, 0.024) },
        uGradeHigh: { value: new T.Color(0.022, 0.010, -0.016) }
      },
      vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false
    });
    this.uniforms = this.compositeMat.uniforms;

    /* ---- sizes + capability detection + targets ---- */
    var size = r.getDrawingBufferSize(new T.Vector2());
    this._w = Math.max(1, size.x);
    this._h = Math.max(1, size.y);
    this._pr = r.getPixelRatio();
    this._detectFormat();
    this._makeTargets();
    this._updateCompositeStyle();
  }

  /* Probe half-float + MSAA render target support (SwiftShader, old GPUs). */
  Post.prototype._detectFormat = function () {
    var r = this.renderer;
    var gl = r.getContext();
    var isWebGL2 = !!(r.capabilities && r.capabilities.isWebGL2);
    var hasFloat = isWebGL2 && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    var maxSamples = isWebGL2 ? Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0) : 0;
    var wantSamples = Math.min(maxSamples, this.qcfg.msaa || 0);
    var cam = new T.PerspectiveCamera(50, 1, 0.1, 10);
    var scn = new T.Scene();
    scn.background = new T.Color(0.4, 0.5, 0.6);
    var candidates = [];
    if (hasFloat) {
      if (wantSamples > 0) candidates.push({ type: T.HalfFloatType, samples: wantSamples });
      candidates.push({ type: T.HalfFloatType, samples: 0 });
    }
    if (wantSamples > 0) candidates.push({ type: T.UnsignedByteType, samples: wantSamples });
    candidates.push({ type: T.UnsignedByteType, samples: 0 });
    var chosen = candidates[candidates.length - 1];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var ok = false;
      try {
        var rt = new T.WebGLRenderTarget(16, 16, {
          type: c.type, format: T.RGBAFormat, samples: c.samples,
          depthBuffer: true, stencilBuffer: false,
          minFilter: T.LinearFilter, magFilter: T.LinearFilter
        });
        r.setRenderTarget(rt);
        r.clear(true, true, true);
        gl.getError();
        r.render(scn, cam);
        ok = gl.getError() === 0;
        r.setRenderTarget(null);
        rt.dispose();
      } catch (e) { ok = false; r.setRenderTarget(null); }
      if (ok) { chosen = c; break; }
    }
    this._rtType = chosen.type;
    this._samples = chosen.samples;
    if (this._samples === 0 && (this.qcfg.msaa || 0) > 0) {
      // MSAA unavailable: keep low-cost FXAA-ish edge softening? none — rely on resolution.
    }
  };

  Post.prototype._makeTargets = function () {
    var r = this.renderer;
    this._disposeTargets();
    var w = Math.max(2, Math.floor(this._w));
    var h = Math.max(2, Math.floor(this._h));
    var maxTex = r.capabilities ? r.capabilities.maxTextureSize : 4096;
    w = Math.min(w, maxTex); h = Math.min(h, maxTex);
    this._tw = w; this._th = h;
    var rtOpts = {
      type: this._rtType, format: T.RGBAFormat,
      minFilter: T.LinearFilter, magFilter: T.LinearFilter,
      depthBuffer: true, stencilBuffer: false, generateMipmaps: false
    };
    this.sceneRT = new T.WebGLRenderTarget(w, h, rtOpts);
    if (this._samples > 0) {
      this.sceneRT.samples = this._samples;
      this.sceneRT.texture.minFilter = T.LinearFilter;
    }
    this.sceneRT.texture.name = 'hkSceneRT';

    var scale = this.qcfg.bloomScale || 0.5;
    var bw = Math.max(2, Math.floor(w * scale));
    var bh = Math.max(2, Math.floor(h * scale));
    var count = Math.max(2, this.qcfg.bloomMips || 5);
    while (count > 2 && (bw >> (count - 1)) < 2) count--;
    this._mips = [];
    for (var i = 0; i < count; i++) {
      var mw = Math.max(2, bw >> i), mh = Math.max(2, bh >> i);
      var mrt = new T.WebGLRenderTarget(mw, mh, {
        type: this._rtType, format: T.RGBAFormat,
        minFilter: T.LinearFilter, magFilter: T.LinearFilter,
        depthBuffer: false, stencilBuffer: false, generateMipmaps: false
      });
      mrt.texture.name = 'hkBloom' + i;
      this._mips.push(mrt);
    }
  };

  Post.prototype._disposeTargets = function () {
    if (this.sceneRT) { this.sceneRT.dispose(); this.sceneRT = null; }
    if (this._mips) { for (var i = 0; i < this._mips.length; i++) this._mips[i].dispose(); }
    this._mips = [];
  };

  Post.prototype._syncSize = function () {
    var r = this.renderer;
    var db = r.getDrawingBufferSize(new T.Vector2());
    var w = Math.max(2, Math.floor(db.x)), h = Math.max(2, Math.floor(db.y));
    if (w !== this._tw || h !== this._th) {
      this._w = w; this._h = h;
      this._makeTargets();
    }
  };

  Post.prototype.setQuality = function (q) {
    if (!HK.QUALITY[q] || q === this.quality) return;
    this.quality = q;
    this.qcfg = HK.QUALITY[q];
    this._detectFormat();
    this._makeTargets();
  };

  Post.prototype.resize = function (w, h, pixelRatio) {
    if (pixelRatio == null) pixelRatio = this.renderer.getPixelRatio();
    this._pr = pixelRatio;
    this._w = Math.max(2, Math.floor((w || 1) * pixelRatio));
    this._h = Math.max(2, Math.floor((h || 1) * pixelRatio));
    this._makeTargets();
  };

  Post.prototype.setEnv = function (env) { this._env = env || null; };
  Post.prototype.setCinematic = function (b) { this._cinematic = !!b; this._updateCompositeStyle(); };
  Post.prototype.setPhoto = function (b) { this._photo = !!b; this._updateCompositeStyle(); };

  Post.prototype.setEnabled = function (b) {
    b = !!b;
    if (b === this._enabled) return;
    this._enabled = b;
    var r = this.renderer;
    if (!b) {
      r.toneMapping = this._saved.toneMapping;
      r.outputEncoding = this._saved.outputEncoding;
      r.toneMappingExposure = this._saved.exposure;
    } else {
      r.toneMapping = T.NoToneMapping;
      r.outputEncoding = T.LinearEncoding;
    }
  };

  Post.prototype._updateCompositeStyle = function () {
    var u = this.uniforms;
    var cinematic = this._cinematic, photo = this._photo;
    u.uCA.value = photo ? 0.00025 : (cinematic ? 0.0016 : 0.0009);
    u.uVignette.value = photo ? 0.10 : (cinematic ? 0.34 : 0.22);
    u.uGrain.value = photo ? 0.0 : (this.qcfg.grain === false ? 0.0 : (cinematic ? 0.030 : 0.017));
    u.uLetterbox.value = cinematic ? 0.85 : 0.0;
    u.uSaturation.value = photo ? 1.14 : (cinematic ? 1.10 : 1.19);
    u.uContrast.value = photo ? 1.02 : (cinematic ? 1.12 : 1.10);
    u.uLift.value = photo ? 0.005 : (cinematic ? 0.016 : 0.010);
    u.uPhoto.value = photo ? 1 : 0;
    u.uGradeShadow.value.setRGB(photo ? -0.008 : -0.034, photo ? 0.002 : 0.006, photo ? 0.010 : 0.052);
    u.uGradeHigh.value.setRGB(photo ? 0.014 : 0.048, photo ? 0.007 : 0.019, photo ? -0.008 : -0.034);
  };

  Post.prototype._fallbackEnv = function () {
    if (!this._fakeEnv) {
      this._fakeEnv = {
        exposure: 1.05, night: 0, weather: 'clear', mist: 0, rain: 0, flash: 0
      };
    }
    return this._fakeEnv;
  };

  Post.prototype._drawQuad = function (mat, target) {
    this.renderer.setRenderTarget(target || null);
    this._quad.material = mat;
    this.renderer.render(this._quadScene, this._quadCam);
  };

  Post.prototype.render = function (dt) {
    dt = U.clamp(dt || 0.016, 0, 0.1);
    this._time += dt;
    var r = this.renderer;
    if (!this._enabled || !this.scene || !this.camera) {
      var savedTM = r.toneMapping;
      r.setRenderTarget(null);
      r.toneMapping = T.ACESFilmicToneMapping;
      r.outputEncoding = T.sRGBEncoding;
      if (this._env) r.toneMappingExposure = this._env.exposure != null ? this._env.exposure : 1;
      r.render(this.scene, this.camera);
      r.toneMapping = savedTM;
      return;
    }
    this._syncSize();

    var env = this._env || this._fallbackEnv();
    var u = this.uniforms;
    var night = env.night != null ? env.night : 0;

    /* ---- 1. scene -> linear HDR/MSAA target ---- */
    r.autoClear = false;
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);

    /* ---- 2. bright pass + bloom mip chain ---- */
    var b = this.brightMat.uniforms;
    b.tDiffuse.value = this.sceneRT.texture;
    b.uTexel.value.set(1 / this.sceneRT.width, 1 / this.sceneRT.height);
    b.uThreshold.value = 1.55 - night * 0.36;
    b.uKnee.value = 0.90 - night * 0.35;
    b.uClamp.value = 48.0;
    this._drawQuad(this.brightMat, this._mips[0]);

    var i, m;
    for (i = 1; i < this._mips.length; i++) {
      var prev = this._mips[i - 1];
      var d = this.downMat.uniforms;
      d.tDiffuse.value = prev.texture;
      d.uTexel.value.set(1 / prev.width, 1 / prev.height);
      this._drawQuad(this.downMat, this._mips[i]);
    }
    for (i = this._mips.length - 2; i >= 0; i--) {
      var src = this._mips[i + 1];
      var up = this.upMat.uniforms;
      up.tDiffuse.value = src.texture;
      up.uTexel.value.set(1 / src.width, 1 / src.height);
      this._drawQuad(this.upMat, this._mips[i]);
    }

    /* ---- 3. composite to screen ---- */
    var c = this.compositeMat.uniforms;
    c.tScene.value = this.sceneRT.texture;
    c.tBloom.value = this._mips[0].texture;
    c.uResolution.value.set(this._tw, this._th);
    c.uExposure.value = env.exposure != null ? env.exposure : 1.05;
    var bloomAmt = 0.50 + night * 0.20;
    if (env.mist) bloomAmt += env.mist * 0.07;
    if (this._photo) bloomAmt *= 0.88;
    if (this._cinematic) bloomAmt *= 1.10;
    if (!this.bloomEnabled) bloomAmt = 0;
    c.uBloom.value = bloomAmt;
    c.uNight.value = night;
    if (c.uShadowLift) c.uShadowLift.value = (this._photo ? 0.032 : (this._cinematic ? 0.075 : 0.058)) + night * 0.05;
    c.uFlash.value = env.flash || 0;
    c.uTime.value = this._time;
    r.toneMappingExposure = env.exposure != null ? env.exposure : 1.05;

    r.setRenderTarget(null);
    r.clear(true, true, true);
    this._drawQuad(this.compositeMat, null);
    r.autoClear = true;
  };

  Post.prototype.dispose = function () {
    var r = this.renderer;
    this._disposeTargets();
    this._quadGeo.dispose();
    this.brightMat.dispose(); this.downMat.dispose(); this.upMat.dispose(); this.compositeMat.dispose();
    r.toneMapping = this._saved.toneMapping;
    r.outputEncoding = this._saved.outputEncoding;
    r.autoClear = this._saved.autoClear;
    r.toneMappingExposure = this._saved.exposure;
  };

  HK.Post = {
    create: function (opts) { return new Post(opts); },
    version: '1.0.0'
  };
})();
