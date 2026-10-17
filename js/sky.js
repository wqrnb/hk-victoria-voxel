/* ============================================================================
 * HK VOXEL HARBOUR — SKY / ATMOSPHERE                       (owner: skyward)
 * ----------------------------------------------------------------------------
 * Golden-hour / blue-hour / neon-night Victoria Harbour sky with humid haze,
 * procedural clouds, stars, moon, rain streaks and lightning.
 *
 * Colour-space contract (important for integration):
 *   The renderer is expected to run HK.Post, which renders the scene linear
 *   (NoToneMapping / LinearEncoding) into an HDR target, applies ACES + sRGB
 *   itself. Therefore every colour this module writes into THREE objects is
 *   LINEAR light, not display sRGB. Authored hex values are sRGB and are
 *   converted with pow(2.2) internally.
 *
 * Direction contract:
 *   env.sunDir / env.moonDir point FROM the world TOWARDS the sun / moon
 *   (i.e. the position offset direction). Light objects are placed at
 *   focus + dir * distance.
 *
 * Public API (docs/INTERFACES.md):
 *   var sky = HK.Sky.create({ scene, renderer, quality });
 *   sky.update(dt, HK.app.state)
 *   sky.setQuality(q)  sky.setTime(h)  sky.setWeather(w)
 *   sky.setShadowFocus(x, z, radius)
 *   sky.sunLight, sky.moonLight, sky.hemiLight, sky.group, sky.env
 *   sky.dispose()
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, T = window.THREE;
  if (!HK || !T) { console.error('[HK.Sky] requires core.js and three.js'); return; }
  var U = HK.Util;
  var DEG = Math.PI / 180;
  var GAMMA = 2.2;

  function linHex(hex) {
    var c = U.hexRgb(hex);
    return new T.Color(Math.pow(c[0], GAMMA), Math.pow(c[1], GAMMA), Math.pow(c[2], GAMMA));
  }
  function mk(hex) { return linHex(hex); }

  var WHITE = mk('#ffffff');
  var MIST_HORIZON = mk('#c6ced2');
  var MIST_ZENITH = mk('#7f95a4');
  var MIST_HAZE = mk('#d6dde0');
  var MIST_CLOUD = mk('#e7ebec');
  var MIST_FOG = mk('#c3cdd1');
  var RAIN_HORIZON = mk('#3c4650');
  var RAIN_ZENITH = mk('#1a2530');
  var RAIN_HAZE = mk('#4a555f');
  var RAIN_CLOUD = mk('#59626b');
  var RAIN_FOG = mk('#39424b');
  var MOON_COLOR = mk('#b9cdf5');
  var GROUND_DAY = mk('#5a4c3c');
  var GROUND_NIGHT = mk('#06080c');

  /* --------------------------------------------------------------------------
   * Time-of-day palette stops, keyed by SUN ALTITUDE (degrees).
   * Between adjacent stops everything is linearly interpolated.
   * ------------------------------------------------------------------------ */
  var STOPS = [
    { alt: 70, zenith: '#3d7cb8', horizon: '#cfe2e6', haze: '#dae7e8', cloudLit: '#ffffff', cloudShade: '#aab8c2',
      fog: '#cfdde1', cityGlow: '#6b5a3d', waterDeep: '#13484b', waterShallow: '#3b7d6c', foam: '#e6efe9',
      sun: '#fff2dc', sunI: 3.1, scatter: 0.62, hemi: 1.55, exposure: 0.94, moonI: 0.0, cloudCover: 0.36 },
    { alt: 34, zenith: '#3f7fb9', horizon: '#d8e4e4', haze: '#e0e8e6', cloudLit: '#fff8ee', cloudShade: '#a8b6c4',
      fog: '#d2dfe2', cityGlow: '#6b5a3d', waterDeep: '#134a4c', waterShallow: '#3c7f6e', foam: '#e6efe9',
      sun: '#fff0d4', sunI: 3.1, scatter: 0.62, hemi: 1.55, exposure: 0.94, moonI: 0.0, cloudCover: 0.36 },
    { alt: 12, zenith: '#2f628f', horizon: '#f6cf9a', haze: '#f3d2a4', cloudLit: '#ffe3bb', cloudShade: '#8b7f92',
      fog: '#dcc0a2', cityGlow: '#7a5c3b', waterDeep: '#164446', waterShallow: '#3f7a63', foam: '#f0e2cc',
      sun: '#ffd8ae', sunI: 3.0, scatter: 0.92, hemi: 1.55, exposure: 1.02, moonI: 0.0, cloudCover: 0.40 },
    { alt: 3, zenith: '#2a5688', horizon: '#ffb470', haze: '#ffc78e', cloudLit: '#ffd7a3', cloudShade: '#7e7191',
      fog: '#e3b48b', cityGlow: '#8a5e37', waterDeep: '#153f42', waterShallow: '#3f7a62', foam: '#f3e3cd',
      sun: '#ffc286', sunI: 2.9, scatter: 1.18, hemi: 1.62, exposure: 1.10, moonI: 0.02, cloudCover: 0.44 },
    { alt: -2, zenith: '#1d3963', horizon: '#ff9455', haze: '#ffa768', cloudLit: '#ffb27c', cloudShade: '#5c5375',
      fog: '#c98d68', cityGlow: '#a06a3c', waterDeep: '#123740', waterShallow: '#356b5c', foam: '#f2d6bb',
      sun: '#ff8f4a', sunI: 1.9, scatter: 1.45, hemi: 1.00, exposure: 1.08, moonI: 0.06, cloudCover: 0.46 },
    { alt: -6, zenith: '#12294d', horizon: '#d9754f', haze: '#dc8b62', cloudLit: '#e0906a', cloudShade: '#3c3a58',
      fog: '#8d6658', cityGlow: '#c08a52', waterDeep: '#0c2530', waterShallow: '#254c46', foam: '#e6cdb5',
      sun: '#ff8a55', sunI: 0.75, scatter: 1.22, hemi: 0.85, exposure: 1.20, moonI: 0.16, cloudCover: 0.48 },
    { alt: -10, zenith: '#0a1730', horizon: '#33506d', haze: '#3d5a76', cloudLit: '#4d5c74', cloudShade: '#131c2d',
      fog: '#1e3046', cityGlow: '#c98a52', waterDeep: '#071219', waterShallow: '#102530', foam: '#93a5ad',
      sun: '#ff7a44', sunI: 0.14, scatter: 0.70, hemi: 0.62, exposure: 1.30, moonI: 0.24, cloudCover: 0.44 },
    { alt: -16, zenith: '#070d1c', horizon: '#16263f', haze: '#1d2f4a', cloudLit: '#34405a', cloudShade: '#0d1422',
      fog: '#101c30', cityGlow: '#ff9d5c', waterDeep: '#04080f', waterShallow: '#0a1622', foam: '#7f8f9a',
      sun: '#000000', sunI: 0.0, scatter: 0.16, hemi: 0.62, exposure: 1.58, moonI: 0.62, cloudCover: 0.40 },
    { alt: -70, zenith: '#060a14', horizon: '#122036', haze: '#1a2a42', cloudLit: '#303c52', cloudShade: '#0b1220',
      fog: '#0d1728', cityGlow: '#ff9d5c', waterDeep: '#03060c', waterShallow: '#091420', foam: '#7a8894',
      sun: '#000000', sunI: 0.0, scatter: 0.10, hemi: 0.60, exposure: 1.62, moonI: 0.64, cloudCover: 0.40 }
  ];
  // extra per-stop atmosphere fields (same order as STOPS):
  // cool horizon colour away from the sun + how strongly the horizon warms toward the sun
  var STOP_EXTRA = [
    { cool: '#c9dde3', warmth: 0.25 },
    { cool: '#c9dde3', warmth: 0.30 },
    { cool: '#a7bcc6', warmth: 0.75 },
    { cool: '#8ca3b2', warmth: 1.00 },
    { cool: '#5d7690', warmth: 0.95 },
    { cool: '#3d5773', warmth: 0.80 },
    { cool: '#26374f', warmth: 0.50 },
    { cool: '#111c2e', warmth: 0.30 },
    { cool: '#101a2b', warmth: 0.28 }
  ];
  // pre-convert stop colours to linear THREE.Color
  for (var si = 0; si < STOPS.length; si++) {
    var st = STOPS[si];
    st.c = {
      zenith: mk(st.zenith), horizon: mk(st.horizon), haze: mk(st.haze), cloudLit: mk(st.cloudLit),
      cloudShade: mk(st.cloudShade), fog: mk(st.fog), cityGlow: mk(st.cityGlow), waterDeep: mk(st.waterDeep),
      waterShallow: mk(st.waterShallow), foam: mk(st.foam), sun: mk(st.sun)
    };
    var ex = STOP_EXTRA[si] || STOP_EXTRA[STOP_EXTRA.length - 1];
    st.c.cool = mk(ex.cool);
    st.warmth = ex.warmth;
  }

  /* Noon/sunset azimuth + max solar altitude tuned for Hong Kong mid-October. */
  var SUNRISE = 5.95, SUNSET = 18.85, MAX_ALT = 57, AZ_START = 70, AZ_END = 292;

  function celestial(hours) {
    var t = ((hours % 24) + 24) % 24;
    var p = (t - SUNRISE) / (SUNSET - SUNRISE);           // may exceed 1 at night
    var sunAlt = Math.sin(p * Math.PI) * MAX_ALT;
    var sunAz = AZ_START + (AZ_END - AZ_START) * p;
    var moonAlt = -sunAlt * 0.62;
    var moonAz = sunAz - 70;   // artistic: keeps the moon in the harbour view at night
    return {
      sunAlt: sunAlt, sunAz: sunAz,
      moonAlt: U.clamp(moonAlt, -88, 88), moonAz: moonAz
    };
  }
  function dirFromAltAz(altDeg, azDeg, out) {
    var alt = altDeg * DEG, az = azDeg * DEG, ca = Math.cos(alt);
    return out.set(Math.sin(az) * ca, Math.sin(alt), -Math.cos(az) * ca).normalize();
  }

  /* -------------------------------------------------------------------------
   * Sky dome shader
   * ----------------------------------------------------------------------- */
  var SKY_VERT = [
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorldPos = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var SKY_FRAG = [
    'precision highp float;',
    'varying vec3 vWorldPos;',
    'uniform vec3 uSunDir, uMoonDir;',
    'uniform vec3 uZenith, uHorizon, uHorizonCool, uHazeColor, uFogColor;',
    'uniform vec3 uCloudLit, uCloudShade, uCityGlow;',
    'uniform vec3 uSunScatter, uSunDiscColor, uMoonColor;',
    'uniform float uSunDiscSize, uSunDiscI, uSunWarmth;',
    'uniform float uNight, uTime, uMist, uRain, uCloudCover, uCloudOpacity, uStarAmount, uFlash;',
    'uniform vec2 uWind;',
    'uniform int uCloudOct;',

    'float hash21(vec2 p) {',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i);',
    '  float b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0));',
    '  float d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    'float fbm(vec2 p, int oct) {',
    '  float s = 0.0; float a = 0.5;',
    '  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);',
    '  for (int i = 0; i < 6; i++) {',
    '    if (i >= oct) break;',
    '    s += a * vnoise(p);',
    '    p = rot * p * 2.03 + vec2(13.7, 7.3);',
    '    a *= 0.5;',
    '  }',
    '  return s;',
    '}',

    'void main() {',
    '  vec3 dir = normalize(vWorldPos - cameraPosition);',
    '  float h = dir.y;',
    '  float up = clamp(h, 0.0, 1.0);',
    // --- horizon colour is warm toward the sun, cool blue-grey away from it
    '  vec3 hdir = normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0001, 0.0, 0.0001));',
    '  vec3 sdirXZ = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(0.0001, 0.0, 0.0001));',
    '  float alignSun = max(dot(hdir, sdirXZ), 0.0);',
    '  float warm = pow(alignSun, 4.2) * uSunWarmth;',
    '  vec3 horizonC = mix(uHorizonCool, uHorizon, clamp(warm, 0.0, 1.0));',
    '  vec3 hazeC = mix(uHorizonCool, uHazeColor, clamp(warm * 0.85 + 0.15, 0.0, 1.0));',
    // --- base vertical gradient (humid, slightly compressed near horizon)
    '  float grad = pow(up, 0.42);',
    '  vec3 col = mix(horizonC, uZenith, grad);',
    '  float hz = exp(-up * 16.0);',
    '  col = mix(col, hazeC, hz * 0.44);',
    // --- sun forward scattering (Mie-ish halo, strongest when sun is low)
    '  float sd = max(dot(dir, uSunDir), 0.0);',
    '  float scat = pow(sd, 5.0) * 0.075 + pow(sd, 36.0) * 0.22 + pow(sd, 320.0) * 0.85;',
    '  col += uSunScatter * scat;',
    // --- moon halo
    '  float md = max(dot(dir, uMoonDir), 0.0);',
    '  col += uMoonColor * (pow(md, 1200.0) * 0.16 + pow(md, 60.0) * 0.020) * uNight;',
    // --- stars
    '  if (uStarAmount > 0.002 && h > 0.005) {',
    '    vec2 sp = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0))) * vec2(118.0, 92.0);',
    '    vec2 cell = floor(sp);',
    '    vec2 f = fract(sp);',
    '    float rnd = hash21(cell);',
    '    if (rnd > 0.955) {',
    '      vec2 off = vec2(hash21(cell + 11.3), hash21(cell + 5.7)) * 0.66 + 0.17;',
    '      float d = length(f - off);',
    '      float tw = 0.72 + 0.28 * sin(uTime * (1.4 + rnd * 4.0) + rnd * 41.0);',
    '      float amp = (step(0.993, rnd) * 1.55 + step(0.955, rnd) * step(rnd, 0.993) * 0.42) * tw;',
    '      float br = smoothstep(0.145, 0.0, d) * amp;',
    '      vec3 tint = mix(vec3(0.62, 0.76, 1.0), vec3(1.0, 0.86, 0.65), hash21(cell + 9.9));',
    '      col += tint * br * uStarAmount * (0.55 + 0.45 * smoothstep(0.0, 0.25, h));',
    '    }',
    '  }',
    // --- moon disc (before clouds so clouds occlude it)
    '  float mAng = 1.0 - md;',
    '  float moonDisc = 1.0 - smoothstep(0.0000135, 0.0000270, mAng);',
    '  col += uMoonColor * moonDisc * 7.5 * uNight;',
    // --- sun disc
    '  float sAng = 1.0 - sd;',
    '  float sunDisc = 1.0 - smoothstep(uSunDiscSize * 0.72, uSunDiscSize * 1.28, sAng);',
    '  col += uSunDiscColor * sunDisc * uSunDiscI;',
    // --- clouds (two drifting FBM layers; warm underlit at golden hour)
    '  if (uCloudCover > 0.01 && uCloudOpacity > 0.01) {',
    '    vec2 cuv = dir.xz / max(dir.y + 0.11, 0.045);',
    '    vec2 drift = uWind * uTime;',
    '    float n1 = fbm(cuv * 0.42 + drift * 0.26, uCloudOct);',
    '    float n2 = fbm(cuv * 1.55 - drift * 0.17 + vec2(9.2, 4.7), uCloudOct);',
    '    float dens = n1 * 0.68 + n2 * 0.32;',
    '    float cov = uCloudCover;',
    '    float c = smoothstep(cov - 0.02, cov + 0.11, dens);',
    '    c *= smoothstep(0.010, 0.075, h);',
    '    float lit = smoothstep(0.10, 0.72, n1 * 0.90 + n2 * 0.38);',
    '    vec3 cc = mix(uCloudShade, uCloudLit, lit);',
    '    cc += uSunScatter * pow(sd, 9.0) * 0.75;',
    '    cc += (uCityGlow * 0.55 + uHorizonCool * 0.8) * (1.0 - smoothstep(0.0, 0.40, h)) * uNight * 0.20;',
    '    cc += vec3(0.62, 0.74, 0.96) * uFlash * (0.55 + n2);',
    // darken the undersides so cloud shapes read against the bright horizon
    '    cc *= mix(0.72, 1.0, smoothstep(0.0, 0.35, h));',
    '    col = mix(col, cc, c * uCloudOpacity);',
    '  }',
    // --- below-horizon fade into marine haze / city glow blanket
    '  float below = 1.0 - smoothstep(-0.035, 0.05, h);',
    '  col = mix(col, uFogColor, below * 0.97);',
    '  col += (uCityGlow * 0.62 + uHorizonCool * 0.55) * exp(-max(h, 0.0) * 30.0) * uNight * (0.30 + 0.14 * uMist);',
    '  col += vec3(0.52, 0.65, 0.92) * uFlash * 0.30;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* -------------------------------------------------------------------------
   * Rain streak shader (GPU-wrapped around the camera — no JS camera needed)
   * ----------------------------------------------------------------------- */
  var RAIN_VERT = [
    'attribute float aTail;',
    'attribute float aSeed;',
    'uniform float uTime, uRain, uWind;',
    'varying float vA;',
    'void main() {',
    '  const float BOX = 240.0;',
    '  const float BOXY = 170.0;',
    '  vec3 fall = vec3(uWind * 2.6, -1.0, uWind * 1.1);',
    '  float speed = 52.0 + aSeed * 46.0;',
    '  vec3 p = position + fall * (uTime * speed);',
    '  vec3 rel = p - cameraPosition;',
    '  rel.xz = mod(rel.xz + BOX * 0.5, BOX) - BOX * 0.5;',
    '  rel.y = mod(rel.y + BOXY * 0.42, BOXY) - BOXY * 0.42;',
    '  vec3 wp = cameraPosition + rel + fall * (aTail * 1.9);',
    '  float dist = length(rel.xz);',
    '  float dy = abs(rel.y);',
    '  vA = (1.0 - smoothstep(58.0, 118.0, dist)) * (1.0 - smoothstep(48.0, 84.0, dy)) * uRain;',
    '  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);',
    '}'
  ].join('\n');

  var RAIN_FRAG = [
    'precision highp float;',
    'uniform vec3 uRainColor;',
    'varying float vA;',
    'void main() {',
    '  if (vA <= 0.002) discard;',
    '  gl_FragColor = vec4(uRainColor * vA, vA * 0.55);',
    '}'
  ].join('\n');

  var RAIN_MAX = 3200;

  function makeRainMaterial(uniforms) {
    return new T.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: T.AdditiveBlending,
      fog: false
    });
  }

  /* -------------------------------------------------------------------------
   * Sky instance
   * ----------------------------------------------------------------------- */
  function Sky(opts) {
    opts = opts || {};
    this.scene = opts.scene;
    this.renderer = opts.renderer;
    this.quality = opts.quality || (HK.DEFAULT_STATE && HK.DEFAULT_STATE.quality) || 'high';
    this.quality = HK.QUALITY[this.quality] ? this.quality : 'high';
    this.qcfg = HK.QUALITY[this.quality];

    this.group = new T.Group();
    this.group.name = 'sky';
    this.group.matrixAutoUpdate = true;

    this._time = (HK.app && HK.app.state && HK.app.state.timeHours) || HK.DEFAULT_STATE.timeHours;
    this._pendingTime = null;
    this._weatherOverride = null;
    this._elapsed = 0;
    this._first = true;
    this._flash = null;
    this._flashTimer = 9;
    this._focus = { x: 0, z: 0, radius: 1600 };
    this._shadowDirty = true;

    /* ---- env contract (THREE objects, mutated in place every frame) ---- */
    this.env = {
      sunDir: new T.Vector3(0, 0.1, -1).normalize(),
      moonDir: new T.Vector3(0, 0.6, 1).normalize(),
      sunColor: new T.Color(),
      moonColor: new T.Color(),
      zenithColor: new T.Color(),
      horizonColor: new T.Color(),
      cloudColor: new T.Color(),
      fogColor: new T.Color(),
      cityGlow: new T.Color(),
      waterDeep: new T.Color(),
      waterShallow: new T.Color(),
      foamColor: new T.Color(),
      night: 0,
      timeHours: this._time,
      exposure: 1.0,
      weather: 'clear',
      sunIntensity: 0,
      moonIntensity: 0,
      sunAlt: 0,
      sunAz: 0,
      horizonCool: new T.Color(),
      sunWarmth: 0.3,
      glassTint: new T.Color(),   // cool linear tint for building glass (albedo/reflection)
      fogDensity: 0.00022,
      mist: 0,
      rain: 0,
      flash: 0
    };
    HK.Sky.env = this.env;
    this._initEnvFromDefaults();

    /* ---- lights ---- */
    this.sunLight = new T.DirectionalLight(0xffffff, 2.6);
    this.sunLight.name = 'sun';
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    var sc = this.sunLight.shadow.camera;
    sc.near = 10; sc.far = 6000; sc.left = -1600; sc.right = 1600; sc.top = 1600; sc.bottom = -1600;
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.7;
    this.sunLight.target.name = 'sunTarget';

    this.moonLight = new T.DirectionalLight(0xb9cdf5, 0.0);
    this.moonLight.name = 'moon';
    this.moonLight.castShadow = false;
    this.moonLight.target.name = 'moonTarget';

    this.hemiLight = new T.HemisphereLight(0x9db6d0, 0x3a3028, 0.7);
    this.hemiLight.name = 'hemi';

    // broad warm sky/bounce fill: keeps shadowed facades readable (no shadows)
    this.ambientLight = new T.AmbientLight(0xffc9a0, 0.0);
    this.ambientLight.name = 'ambientBounce';

    this.group.add(this.sunLight, this.sunLight.target, this.moonLight, this.moonLight.target, this.hemiLight, this.ambientLight);
    if (this.scene) this.scene.add(this.group);

    /* ---- sky dome ---- */
    this.uniforms = {
      uSunDir: { value: this.env.sunDir },
      uMoonDir: { value: this.env.moonDir },
      uZenith: { value: new T.Color() },
      uHorizon: { value: new T.Color() },
      uHorizonCool: { value: new T.Color() },
      uSunWarmth: { value: 0.3 },
      uHazeColor: { value: new T.Color() },
      uFogColor: { value: new T.Color() },
      uCloudLit: { value: new T.Color() },
      uCloudShade: { value: new T.Color() },
      uCityGlow: { value: new T.Color() },
      uSunScatter: { value: new T.Color() },
      uSunDiscColor: { value: new T.Color() },
      uMoonColor: { value: new T.Color() },
      uSunDiscSize: { value: 1 - Math.cos(0.62 * DEG) },
      uSunDiscI: { value: 20 },
      uNight: { value: 0 },
      uTime: { value: 0 },
      uMist: { value: 0 },
      uRain: { value: 0 },
      uCloudCover: { value: 0.4 },
      uCloudOpacity: { value: 0.8 },
      uStarAmount: { value: 0 },
      uFlash: { value: 0 },
      uWind: { value: new T.Vector2(0.18, 0.06) },
      uCloudOct: { value: this.qcfg.cloudDetail || 3 }
    };
    this.domeMat = new T.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: T.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false
    });
    this.dome = new T.Mesh(new T.SphereGeometry(9000, 32, 20), this.domeMat);
    this.dome.name = 'skyDome';
    this.dome.renderOrder = -1000;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    /* ---- rain ---- */
    this._makeRain();

    /* ---- fog ---- */
    this._fog = new T.FogExp2(0x0a1220, 0.00022);
    if (this.scene) this.scene.fog = this._fog;
    this._bg = new T.Color(0.02, 0.03, 0.05);
    if (this.scene) this.scene.background = this._bg;

    /* ---- scratch targets (avoid per-frame allocations) ---- */
    this._tg = {
      zenith: new T.Color(), horizon: new T.Color(), haze: new T.Color(), cloudLit: new T.Color(),
      cloudShade: new T.Color(), fog: new T.Color(), cityGlow: new T.Color(), waterDeep: new T.Color(),
      waterShallow: new T.Color(), foam: new T.Color(), sun: new T.Color(), moonC: new T.Color(), cool: new T.Color(),
      warmth: 0.3
    };

    /* shadow focus defaults */
    this.setShadowFocus(0, 0, this._focus.radius);
    this._applyShadowCamera();
  }

  Sky.prototype._initEnvFromDefaults = function () {
    var e = this.env;
    e.zenithColor.copy(STOPS[2].c.zenith);
    e.horizonColor.copy(STOPS[2].c.horizon);
    e.cloudColor.copy(STOPS[2].c.cloudLit);
    e.fogColor.copy(STOPS[2].c.fog);
    e.cityGlow.copy(STOPS[2].c.cityGlow);
    e.sunColor.copy(STOPS[2].c.sun);
    e.moonColor.copy(MOON_COLOR);
    e.waterDeep.copy(STOPS[2].c.waterDeep);
    e.waterShallow.copy(STOPS[2].c.waterShallow);
    e.foamColor.copy(STOPS[2].c.foam);
    e.horizonCool.copy(STOPS[2].c.cool);
    e.glassTint.copy(STOPS[2].c.zenith).lerp(STOPS[2].c.cool, 0.30);
    e.sunWarmth = STOPS[2].warmth;
  };

  Sky.prototype._makeRain = function () {
    var count = RAIN_MAX;
    var pos = new Float32Array(count * 2 * 3);
    var tail = new Float32Array(count * 2);
    var seed = new Float32Array(count * 2);
    var rng = new HK.Rng(0x5EED1);
    for (var i = 0; i < count; i++) {
      var x = rng.float(-120, 120), y = rng.float(-60, 110), z = rng.float(-120, 120);
      var s = rng.next();
      for (var k = 0; k < 2; k++) {
        var o = (i * 2 + k) * 3;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        tail[i * 2 + k] = k;
        seed[i * 2 + k] = s;
      }
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('aTail', new T.BufferAttribute(tail, 1));
    g.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    g.setDrawRange(0, this._rainCount() * 2);
    this.rainUniforms = {
      uTime: { value: 0 },
      uRain: { value: 0 },
      uWind: { value: 0.18 },
      uRainColor: { value: new T.Color(0.7, 0.78, 0.9) }
    };
    this.rainMat = makeRainMaterial(this.rainUniforms);
    this.rain = new T.LineSegments(g, this.rainMat);
    this.rain.name = 'rain';
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.renderOrder = 20;
    this.group.add(this.rain);
  };

  Sky.prototype._rainCount = function () {
    switch (this.quality) {
      case 'low': return 1000;
      case 'medium': return 1900;
      case 'high': return 2600;
      default: return RAIN_MAX;
    }
  };

  /* ------------------------------------------------------------------ time */
  Sky.prototype.setTime = function (hours) {
    this._pendingTime = hours;
    if (HK.app && HK.app.state) HK.app.state.timeHours = hours;
  };
  Sky.prototype.setWeather = function (w) {
    this._weatherOverride = w;
    if (HK.app && HK.app.state) HK.app.state.weather = w;
  };
  Sky.prototype.setShadowFocus = function (x, z, radius) {
    this._focus.x = x || 0;
    this._focus.z = z || 0;
    this._focus.radius = U.clamp(radius == null ? 1600 : radius, 250, 2600);
    this._shadowDirty = true;
  };
  Sky.prototype.setQuality = function (q) {
    if (!HK.QUALITY[q] || q === this.quality) return;
    this.quality = q;
    this.qcfg = HK.QUALITY[q];
    this.uniforms.uCloudOct.value = this.qcfg.cloudDetail || 3;
    if (this.sunLight.shadow.map) { this.sunLight.shadow.map.dispose(); this.sunLight.shadow.map = null; }
    var ms = Math.min(this.qcfg.shadowMap || 2048, this.renderer ? this.renderer.capabilities.maxTextureSize : 4096);
    this.sunLight.shadow.mapSize.set(ms, ms);
    this.rain.geometry.setDrawRange(0, this._rainCount() * 2);
    this._shadowDirty = true;
  };

  Sky.prototype._applyShadowCamera = function () {
    var f = this._focus;
    var cam = this.sunLight.shadow.camera;
    var r = f.radius;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 10;
    cam.far = r * 2.8 + 1400;
    cam.updateProjectionMatrix();
    this._shadowDirty = false;
  };

  /* --------------------------------------------------------- atmosphere mix */
  var _t = 0, _t2 = 0;
  function sampleStops(altDeg, tg) {
    var s = STOPS;
    var a, b, t;
    if (altDeg >= s[0].alt) { a = s[0]; b = s[0]; t = 0; }
    else if (altDeg <= s[s.length - 1].alt) { a = s[s.length - 1]; b = a; t = 0; }
    else {
      for (var i = 0; i < s.length - 1; i++) {
        if (altDeg <= s[i].alt && altDeg >= s[i + 1].alt) {
          a = s[i]; b = s[i + 1];
          t = (s[i].alt - altDeg) / (s[i].alt - s[i + 1].alt);
          t = t * t * (3 - 2 * t);
          break;
        }
      }
    }
    tg.zenith.copy(a.c.zenith).lerp(b.c.zenith, t);
    tg.horizon.copy(a.c.horizon).lerp(b.c.horizon, t);
    tg.haze.copy(a.c.haze).lerp(b.c.haze, t);
    tg.cloudLit.copy(a.c.cloudLit).lerp(b.c.cloudLit, t);
    tg.cloudShade.copy(a.c.cloudShade).lerp(b.c.cloudShade, t);
    tg.fog.copy(a.c.fog).lerp(b.c.fog, t);
    tg.cityGlow.copy(a.c.cityGlow).lerp(b.c.cityGlow, t);
    tg.waterDeep.copy(a.c.waterDeep).lerp(b.c.waterDeep, t);
    tg.waterShallow.copy(a.c.waterShallow).lerp(b.c.waterShallow, t);
    tg.foam.copy(a.c.foam).lerp(b.c.foam, t);
    tg.cool.copy(a.c.cool).lerp(b.c.cool, t);
    tg.warmth = U.lerp(a.warmth, b.warmth, t);
    tg.sun.copy(a.c.sun).lerp(b.c.sun, t);
    tg.sunI = U.lerp(a.sunI, b.sunI, t);
    tg.scatter = U.lerp(a.scatter, b.scatter, t);
    tg.hemi = U.lerp(a.hemi, b.hemi, t);
    tg.exposure = U.lerp(a.exposure, b.exposure, t);
    tg.moonI = U.lerp(a.moonI, b.moonI, t);
    tg.cloudCover = U.lerp(a.cloudCover, b.cloudCover, t);
  }

  /* ---------------------------------------------------------------- update */
  Sky.prototype.update = function (dt, state) {
    dt = U.clamp(dt || 0.016, 0, 0.1);
    this._elapsed += dt;
    state = state || (HK.app && HK.app.state) || {};

    var timeHours;
    if (this._pendingTime != null) {
      timeHours = this._pendingTime;
      this._pendingTime = null;
      this._time = timeHours;
      if (state) state.timeHours = timeHours;
    } else if (state.timeHours != null) {
      timeHours = state.timeHours;
      this._time = timeHours;
    } else {
      timeHours = this._time;
    }

    var weather = this._weatherOverride || state.weather || 'clear';
    if (typeof weather !== 'string') weather = weather.id || weather.name || 'clear';
    this._weatherOverride = null;
    var targetMist = weather === 'mist' ? 1 : 0;
    var targetRain = weather === 'rain' ? 1 : 0;

    var env = this.env;
    env.timeHours = timeHours;
    env.weather = weather;

    var cel = celestial(timeHours);
    dirFromAltAz(cel.sunAlt, cel.sunAz, env.sunDir);
    dirFromAltAz(cel.moonAlt, cel.moonAz, env.moonDir);
    env.sunAlt = cel.sunAlt;
    env.sunAz = cel.sunAz;

    /* smooth weather amounts */
    var wk = this._first ? 1 : 1 - Math.exp(-dt * 2.2);
    env.mist += (targetMist - env.mist) * wk;
    env.rain += (targetRain - env.rain) * wk;
    if (env.mist < 0.001) env.mist = 0;
    if (env.rain < 0.001) env.rain = 0;

    /* ---- target atmosphere ---- */
    var tg = this._tg;
    sampleStops(cel.sunAlt, tg);
    tg.cloudCover = U.clamp(tg.cloudCover + env.mist * 0.16 + env.rain * 0.34, 0, 0.92);
    tg.sunI *= 1 - env.mist * 0.55 - env.rain * 0.72;
    tg.scatter *= 1 - env.mist * 0.55 - env.rain * 0.65;
    tg.exposure *= 1 + env.mist * 0.08 + env.rain * 0.14;
    tg.hemi *= 1 - env.mist * 0.20 - env.rain * 0.30;
    tg.moonI *= 1 - env.mist * 0.45 - env.rain * 0.60;

    if (env.mist > 0.001) {
      var m = env.mist;
      tg.zenith.lerp(MIST_ZENITH, m * 0.38);
      tg.horizon.lerp(MIST_HORIZON, m * 0.62);
      tg.haze.lerp(MIST_HAZE, m * 0.75);
      tg.cloudLit.lerp(MIST_CLOUD, m * 0.35);
      tg.fog.lerp(MIST_FOG, m * 0.68);
      tg.cool.lerp(MIST_HORIZON, m * 0.55);
      tg.cityGlow.multiplyScalar(1 + m * 0.25);
    }
    if (env.rain > 0.001) {
      var rn = env.rain;
      tg.zenith.lerp(RAIN_ZENITH, rn * 0.55);
      tg.horizon.lerp(RAIN_HORIZON, rn * 0.60);
      tg.haze.lerp(RAIN_HAZE, rn * 0.65);
      tg.cloudLit.lerp(RAIN_CLOUD, rn * 0.55);
      tg.cloudShade.lerp(RAIN_ZENITH, rn * 0.5);
      tg.fog.lerp(RAIN_FOG, rn * 0.62);
      tg.cool.lerp(RAIN_HORIZON, rn * 0.55);
      tg.cityGlow.multiplyScalar(1 + rn * 0.35);
      tg.exposure *= 1 + rn * 0.05;
    }

    /* night factor from solar altitude (0 day .. 1 full night) */
    var nightTarget = U.smootherstep(6, -12, cel.sunAlt);
    var nightI = U.smoothstep(-2.5, 2.5, cel.sunAlt);

    /* ---- smooth into env ---- */
    var k = this._first ? 1 : 1 - Math.exp(-dt * 7.0);
    env.zenithColor.lerp(tg.zenith, k);
    env.horizonColor.lerp(tg.horizon, k);
    env.horizonCool.lerp(tg.cool, k);
    // cool, slightly bright tint handed to Buildings so glass reads teal instead of sandstone
    this._glassT && 0;
    if (!this._glassT) this._glassT = new T.Color();
    this._glassT.copy(env.zenithColor).lerp(env.horizonCool, 0.30).multiplyScalar(1.35);
    env.glassTint.lerp(this._glassT, k);
    env.sunWarmth += (tg.warmth - env.sunWarmth) * k;
    env.cloudColor.lerp(tg.cloudLit, k);
    env.fogColor.lerp(tg.fog, k);
    env.cityGlow.lerp(tg.cityGlow, k);
    env.sunColor.lerp(tg.sun, k);
    env.moonColor.lerp(tg.moonC.copy(MOON_COLOR), k);
    env.waterDeep.lerp(tg.waterDeep, k);
    env.waterShallow.lerp(tg.waterShallow, k);
    env.foamColor.lerp(tg.foam, k);
    env.night += (nightTarget - env.night) * k;
    env.exposure += (tg.exposure - env.exposure) * k;
    env.sunIntensity += (tg.sunI - env.sunIntensity) * k;
    env.moonIntensity += (tg.moonI - env.moonIntensity) * k;

    /* fog density */
    var fogTarget = 0.000250 + env.night * 0.00011;
    fogTarget = U.lerp(fogTarget, 0.00088, env.mist);
    fogTarget = U.lerp(fogTarget, 0.00052, env.rain);
    env.fogDensity += (fogTarget - env.fogDensity) * k;

    /* ---- lightning ---- */
    if (env.rain > 0.5 && env.night > 0.30) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        this._flash = { t: 0, strength: 0.45 + Math.random() * 0.85 };
        this._flashTimer = 7 + Math.random() * 15;
      }
    }
    if (this._flash) {
      var f = this._flash;
      f.t += dt;
      var e = Math.exp(-f.t * 11.0) * (1 - U.smoothstep(0.55, 1.0, f.t));
      if (f.t > 0.16) e += 0.6 * Math.exp(-(f.t - 0.16) * 8.0) * (1 - U.smoothstep(0.7, 1.1, f.t));
      env.flash = e * f.strength;
      if (f.t > 1.4) this._flash = null;
    } else {
      env.flash = Math.max(0, env.flash - dt * 5);
    }

    /* ---- apply to lights ---- */
    var sunI = env.sunIntensity;
    this.sunLight.color.copy(env.sunColor);
    this.sunLight.intensity = sunI;
    this.sunLight.visible = sunI > 0.005;
    this.sunLight.castShadow = !!(this.qcfg.shadows) && sunI > 0.06 && env.sunAlt > -0.8;
    var moonUp = U.smoothstep(-0.02, 0.10, env.moonDir.y);
    this.moonLight.color.copy(env.moonColor);
    this.moonLight.intensity = env.moonIntensity * moonUp * 1.25;
    this.moonLight.visible = this.moonLight.intensity > 0.002;

    this.hemiLight.color.copy(env.zenithColor).lerp(env.horizonColor, U.clamp(0.40 + env.sunWarmth * 0.14, 0, 0.55));
    this.hemiLight.groundColor.copy(GROUND_DAY).lerp(GROUND_NIGHT, env.night);
    this.hemiLight.intensity = U.lerp(this.hemiLight.intensity, tg.hemi, k) + env.flash * 1.6 + env.night * 0.02;
    // warm ambient bounce: strongest at golden hour, cool and faint at night
    var ambT = U.lerp(U.lerp(0.16, 0.40, U.smoothstep(-8, 14, env.sunAlt)), 0.28, env.night);
    var ambI = this._ambI == null ? ambT : this._ambI + (ambT - this._ambI) * k;
    this._ambI = ambI;
    this.ambientLight.color.copy(env.horizonColor).lerp(env.zenithColor, 0.50 + env.night * 0.20).lerp(env.cityGlow, env.night * 0.30);
    this.ambientLight.intensity = ambI;

    /* directional shadows follow the focus */
    var off = this._focus.radius * 1.9 + 900;
    var fx = this._focus.x, fz = this._focus.z;
    this.sunLight.target.position.set(fx, 0, fz);
    this.sunLight.position.set(fx + env.sunDir.x * off, env.sunDir.y * off + 40, fz + env.sunDir.z * off);
    if (this._shadowDirty) this._applyShadowCamera();
    this.moonLight.target.position.set(fx, 0, fz);
    this.moonLight.position.set(fx + env.moonDir.x * 1600, Math.max(env.moonDir.y, 0.2) * 1600, fz + env.moonDir.z * 1600);

    /* ---- fog + background ---- */
    this._fog.color.copy(env.fogColor).lerp(env.horizonCool, 0.18);
    this._fog.density = env.fogDensity;
    if (this.scene) {
      this._bg.copy(env.fogColor).multiplyScalar(0.82);
      if (this.scene.background === null || this.scene.background === undefined) this.scene.background = this._bg;
    }

    /* ---- uniforms ---- */
    var u = this.uniforms;
    u.uZenith.value.copy(env.zenithColor);
    u.uHorizon.value.copy(env.horizonColor);
    u.uHorizonCool.value.copy(env.horizonCool);
    u.uSunWarmth.value = env.sunWarmth;
    u.uHazeColor.value.copy(env.horizonColor).lerp(env.fogColor, 0.55).lerp(WHITE, env.mist * 0.12);
    u.uFogColor.value.copy(env.fogColor);
    u.uCloudLit.value.copy(env.cloudColor);
    u.uCloudShade.value.copy(env.cloudColor).multiplyScalar(0.30).lerp(env.zenithColor, 0.35);
    u.uCityGlow.value.copy(env.cityGlow);
    var scatter = tg.scatter * (1 - env.night * 0.55);
    u.uSunScatter.value.copy(env.sunColor).multiplyScalar(scatter);
    var discI = (7 + 13 * U.smoothstep(-1, 5, env.sunAlt)) * U.smoothstep(-1.4, 0.9, env.sunAlt) * (1 - env.mist * 0.75 - env.rain * 0.85);
    u.uSunDiscColor.value.copy(env.sunColor).multiplyScalar(1.30);
    u.uSunDiscI.value = discI * (0.6 + 0.4 * nightI);
    u.uMoonColor.value.copy(env.moonColor);
    u.uNight.value = env.night;
    u.uTime.value = this._elapsed;
    u.uMist.value = env.mist;
    u.uRain.value = env.rain;
    u.uCloudCover.value = tg.cloudCover;
    u.uCloudOpacity.value = U.clamp(0.90 + env.rain * 0.08 - env.mist * 0.05, 0, 0.99);
    u.uStarAmount.value = env.night * env.night * (1 - env.rain * 0.85) * (1 - env.mist * 0.65) * 1.15;
    u.uFlash.value = env.flash;
    u.uWind.value.set(0.20 + env.rain * 0.28, 0.07 + env.rain * 0.05);

    /* ---- rain ---- */
    this.rainUniforms.uTime.value = this._elapsed;
    this.rainUniforms.uRain.value = U.clamp(env.rain * 1.1, 0, 1);
    this.rainUniforms.uWind.value = 0.18 + env.rain * 0.30;
    var rc = this.rainUniforms.uRainColor.value;
    rc.copy(env.horizonColor).lerp(WHITE, 0.48).multiplyScalar(0.85 + env.rain);
    rc.lerp(env.cityGlow, env.night * 0.30).multiplyScalar(1 - env.night * 0.25);
    this.rain.visible = env.rain > 0.01;
    if (this.rain.visible) this.rainUniforms.uRain.value = Math.min(1, env.rain * 1.2);

    /* ---- contract: night in state ---- */
    if (state) state.night = env.night;
    if (state && state.paused) { /* nothing extra: main freezes dt */ }

    this._first = false;
    return env;
  };

  Sky.prototype.dispose = function () {
    if (this.dome) { this.dome.geometry.dispose(); this.domeMat.dispose(); }
    if (this.rain) { this.rain.geometry.dispose(); this.rainMat.dispose(); }
    if (this.sunLight.shadow.map) { this.sunLight.shadow.map.dispose(); this.sunLight.shadow.map = null; }
    if (this.group.parent) this.group.parent.remove(this.group);
    if (this.scene && this.scene.fog === this._fog) this.scene.fog = null;
    this.group.traverse(function (o) { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  };

  HK.Sky = {
    create: function (opts) { return new Sky(opts); },
    env: null,
    version: '1.0.0'
  };
})();
