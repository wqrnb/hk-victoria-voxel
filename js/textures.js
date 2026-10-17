/* ============================================================================
 * HK VOXEL HARBOUR — TEXTURE ATLASES
 * Loads the baked atlases in assets/ (dev server) or window.HK_ASSETS
 * (single-file build). No network. Procedural facades remain the fallback.
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK;
  var FILES = {
    facade: 'assets/facade-atlas.png',
    night: 'assets/facade-night.png',
    neon: 'assets/neon-atlas.png',
    foam: 'assets/water-foam.png',
    ground: 'assets/ground-atlas.png',
    accent: 'assets/landmark-accents.png'
  };
  var REPEAT = { foam: 1, ground: 1 };
  var T = HK.Textures = {
    ready: false,
    facade: null,
    night: null,
    neon: null,
    foam: null,
    ground: null,
    accent: null
  };

  function loadOne(key) {
    var packed = (typeof window.HK_ASSETS === 'object' && window.HK_ASSETS) ? window.HK_ASSETS[key] : '';
    var src = packed || FILES[key];
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var tex = new THREE.Texture(img);
        tex.name = 'hk-' + key;
        tex.needsUpdate = true;
        tex.wrapS = tex.wrapT = REPEAT[key] ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        tex.anisotropy = 8;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        T[key] = tex;
        resolve(tex);
      };
      img.onerror = function () {
        console.warn('[HK.Textures] missing', key);
        resolve(null);
      };
      img.src = src;
    });
  }

  T.preload = function () {
    var keys = Object.keys(FILES);
    return Promise.all(keys.map(loadOne)).then(function () {
      T.ready = !!(T.facade && T.night);
      HK.log('textures', T.ready ? 'atlases ready' : 'procedural fallback',
        T.neon ? 'neon' : '', T.foam ? 'foam' : '', T.ground ? 'ground' : '', T.accent ? 'accent' : '');
      return T.ready;
    });
  };

  T.attachFacade = function (uniforms) {
    if (!uniforms) return;
    if (T.facade) uniforms.uFacadeMap.value = T.facade;
    if (T.night) uniforms.uFacadeNight.value = T.night;
    if (uniforms.uAtlasOn) uniforms.uAtlasOn.value = T.ready ? 1 : 0;
    var qn = (HK.app && HK.app.state && HK.app.state.quality) || 'high';
    var q = HK.QUALITY[qn];
    if (q && uniforms.uFacadeScale) uniforms.uFacadeScale.value = q.facadeScale || 1;
  };
})();
