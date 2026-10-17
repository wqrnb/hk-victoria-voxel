/* ============================================================================
 * HK VOXEL HARBOUR — LAYOUT / GEOGRAPHY
 * The map of Victoria Harbour: coastlines, reclamations, hills, districts,
 * roads, ferry routes, landmark anchors, parks, POIs.
 * Pure data + fast sampling functions (no THREE objects).
 * Coordinates: x -2000..2000 east, z -1000..1000 (north -z, HK Island +z).
 * 1 unit = 2 m.
 * ==========================================================================*/
(function () {
  'use strict';
  var HK = window.HK, U = HK.Util;
  var L = {};

  /* ------------------------------------------------------------ facade ids */
  HK.FACADE = {
    GLASS_BLUE: 0, GLASS_TEAL: 1, GLASS_SILVER: 2, GLASS_BRONZE: 3,
    CURTAIN_DARK: 4, PUNCHED: 5, BANDED: 6, RESI: 7, RESI_OLD: 8,
    PORTHOLE: 9, STONE: 10, METAL: 11, LED: 12, PURE: 13, INDUSTRIAL: 14,
    HERITAGE: 15, DIAGONAL: 16
  };
  var F = HK.FACADE;

  /* -------------------------------------------------------------- bounds */
  L.BOUNDS = { minX: -2000, maxX: 2000, minZ: -1000, maxZ: 1000 };
  L.WATER_Y = 0;

  /* ---------------------------------------------------------- shoreline data
   * North shore = Kowloon (land is z < shore).  South shore = HK Island
   * (land is z > shore). Water lies between the two.
   * ---------------------------------------------------------------------- */
  L.NORTH_SHORE = [
    [-2000, -360], [-1800, -350], [-1650, -345], [-1500, -335], [-1400, -322],
    [-1300, -305], [-1200, -285], [-1100, -268], [-1000, -256], [-900, -252],
    [-800, -258], [-700, -264], [-620, -272], [-560, -282], [-500, -292],
    [-450, -302], [-400, -312], [-330, -319], [-260, -322], [-190, -321],
    [-120, -319], [-50, -317], [20, -314], [90, -311], [150, -307],
    [190, -306], [230, -310], [260, -330], [300, -352], [340, -380],
    [380, -400], [420, -408], [460, -400], [500, -382], [540, -355],
    [580, -335], [620, -326], [660, -322], [700, -320], [740, -326],
    [780, -340], [820, -356], [860, -370], [900, -380], [940, -388],
    [980, -398], [1020, -408], [1060, -418], [1100, -428], [1150, -438],
    [1200, -446], [1260, -454], [1320, -460], [1400, -466], [1480, -472],
    [1560, -478], [1640, -484], [1720, -490], [1800, -500], [1900, -512], [2000, -525]
  ];
  L.SOUTH_SHORE = [
    [-2000, 425], [-1800, 410], [-1650, 400], [-1500, 390], [-1400, 372],
    [-1300, 356], [-1200, 346], [-1100, 340], [-1000, 333], [-900, 326],
    [-800, 319], [-700, 313], [-600, 307], [-500, 301], [-400, 296],
    [-300, 292], [-200, 290], [-100, 288], [0, 288], [80, 290],
    [140, 294], [200, 300], [260, 308], [310, 318], [350, 331],
    [380, 350], [400, 376], [420, 404], [432, 438], [450, 462],
    [480, 471], [510, 471], [540, 466], [565, 455], [592, 432],
    [612, 402], [628, 374], [645, 352], [668, 336], [700, 326],
    [740, 321], [790, 319], [850, 318], [910, 318], [970, 320],
    [1030, 325], [1090, 333], [1150, 342], [1210, 352], [1270, 364],
    [1330, 377], [1400, 391], [1480, 406], [1560, 422], [1650, 440],
    [1750, 458], [1850, 478], [1950, 497], [2000, 515]
  ];

  // integer LUTs for fast shore lookups (1 unit resolution)
  var MNX = -2000, MXX = 2000;
  var northLUT = new Float32Array(MXX - MNX + 1);
  var southLUT = new Float32Array(MXX - MNX + 1);
  (function buildShoreLUTs() {
    function fill(pts, arr) {
      for (var x = MNX; x <= MXX; x++) {
        var i = 0;
        while (i < pts.length - 2 && pts[i + 1][0] < x) i++;
        var a = pts[i], b = pts[i + 1];
        var t = U.clamp((x - a[0]) / (b[0] - a[0] || 1), 0, 1);
        arr[x - MNX] = a[1] + (b[1] - a[1]) * t;
      }
    }
    fill(L.NORTH_SHORE, northLUT);
    fill(L.SOUTH_SHORE, southLUT);
  })();
  L.northShoreZ = function (x) {
    var i = U.clamp(Math.round(x) - MNX, 0, northLUT.length - 1);
    return northLUT[i];
  };
  L.southShoreZ = function (x) {
    var i = U.clamp(Math.round(x) - MNX, 0, southLUT.length - 1);
    return southLUT[i];
  };

  /* ------------------------------------------------------- land overrides */
  // Kai Tak runway: a narrow reclaimed spur into the harbour.
  var RUNWAY_A = [800, -390], RUNWAY_B = [1022, -226];
  var _rvx = RUNWAY_B[0] - RUNWAY_A[0], _rvz = RUNWAY_B[1] - RUNWAY_A[1];
  var _rlen2 = _rvx * _rvx + _rvz * _rvz;
  function runwayTest(x, z, extraHalf) {
    var wx = x - RUNWAY_A[0], wz = z - RUNWAY_A[1];
    var t = (wx * _rvx + wz * _rvz) / _rlen2;
    if (t < -0.03 || t > 1.03) return false;
    var px = wx - _rvx * t, pz = wz - _rvz * t;
    var half = 10 + (extraHalf || 0);
    return (px * px + pz * pz) < half * half;
  }
  L.isRunway = function (x, z) { return runwayTest(x, z, 0); };
  L.runwayA = RUNWAY_A; L.runwayB = RUNWAY_B;

  // Causeway Bay typhoon shelter breakwater
  function breakwaterTest(x, z) {
    if (x > 430 && x < 572 && z > 427 && z < 439) return true;
    if (x >= 560 && x < 580 && z > 415 && z < 440) return true;
    return false;
  }
  L.isBreakwater = breakwaterTest;

  // Green Island
  function greenIslandTest(x, z) {
    var dx = (x + 1480) / 27, dz = (z - 78) / 21;
    return dx * dx + dz * dz < 1;
  }
  L.isGreenIsland = greenIslandTest;

  L.landOverride = function (x, z) {
    // cruise terminal apron at the harbour tip of the runway
    var cdx = x - 980, cdz = z + 255;
    if (cdx * cdx + cdz * cdz < 40 * 40) return { h: 1, type: 'runway' };
    if (runwayTest(x, z, 0)) return { h: 1, type: 'runway' };
    if (breakwaterTest(x, z)) return { h: 3, type: 'breakwater' };
    if (greenIslandTest(x, z)) {
      var dx = (x + 1480) / 27, dz = (z - 78) / 21;
      var t = 1 - (dx * dx + dz * dz);
      return { h: 2 + Math.round(12 * Math.pow(Math.max(0, t), 0.55)), type: 'island' };
    }
    return null;
  };

  L.isWater = function (x, z) {
    if (L.landOverride(x, z)) return false;
    var n = L.northShoreZ(x), s = L.southShoreZ(x);
    return z > n && z < s;
  };
  L.isLand = function (x, z) { return !L.isWater(x, z); };

  // distance to nearest shore (units, approximate; used for promenades)
  L.shoreDistance = function (x, z) {
    var d = Math.abs(z - L.northShoreZ(x));
    var s = Math.abs(z - L.southShoreZ(x));
    return Math.min(d, s);
  };
  L.onKowloon = function (z) { return z < 0; };

  /* ---------------------------------------------------------------- hills */
  L.PEAKS_HK = [
    { x: -280, z: 790, h: 276, rx: 420, rz: 300, name: '太平山 Victoria Peak' },
    { x: 10, z: 860, h: 239, rx: 300, rz: 240, name: '金馬倫山 Mount Cameron' },
    { x: 330, z: 835, h: 215, rx: 270, rz: 230, name: '聶高信山 Mount Nicholson' },
    { x: 525, z: 782, h: 217, rx: 235, rz: 200, name: '渣甸山 Jardine\'s Lookout' },
    { x: 690, z: 845, h: 218, rx: 250, rz: 230, name: '畢拿山 Mount Butler' },
    { x: 945, z: 885, h: 265, rx: 350, rz: 285, name: '柏架山 Mount Parker' },
    { x: 1160, z: 895, h: 174, rx: 225, rz: 205, name: '歌連臣山 Mount Collinson' },
    { x: -540, z: 742, h: 180, rx: 190, rz: 170, name: '西高山 High West' },
    { x: -985, z: 770, h: 133, rx: 230, rz: 210, name: '摩星嶺 Mount Davis' },
    { x: -1500, z: 780, h: 200, rx: 320, rz: 260, name: '西區山巒' }
  ];
  L.PEAKS_KL = [
    { x: -170, z: -878, h: 247, rx: 285, rz: 225, name: '獅子山 Lion Rock' },
    { x: -440, z: -872, h: 228, rx: 225, rz: 200, name: '筆架山 Beacon Hill' },
    { x: -665, z: -930, h: 200, rx: 270, rz: 225, name: '鷹巢山 Eagle\'s Nest' },
    { x: 250, z: -800, h: 150, rx: 205, rz: 165, name: '慈雲山 Temple Hill' },
    { x: 635, z: -895, h: 301, rx: 335, rz: 270, name: '飛鵝山 Kowloon Peak' },
    { x: 930, z: -900, h: 288, rx: 315, rz: 255, name: '大老山 Tate\'s Cairn' },
    { x: 1280, z: -855, h: 210, rx: 280, rz: 235, name: '平山秀嶺' },
    { x: 1680, z: -820, h: 190, rx: 320, rz: 250, name: '東九龍山巒' }
  ];
  function field(peaks, x, z, ridgeScale) {
    var m = 0;
    for (var i = 0; i < peaks.length; i++) {
      var p = peaks[i];
      var dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz;
      var g = p.h * Math.exp(-(dx * dx + dz * dz) * 1.9);
      if (g > m) m = g;
    }
    m += (U.ridge2(x * 0.0085 + 3.1, z * 0.0085 - 2.3, 4) - 0.35) * (ridgeScale || 26);
    return m;
  }
  L.hkHillField = function (x, z) { return field(L.PEAKS_HK, x, z, 30); };
  L.klHillField = function (x, z) { return field(L.PEAKS_KL, x, z, 26); };

  L.islandSlopeFactor = function (z) { return U.smoothstep(438, 585, z); };
  L.klSlopeFactor = function (z) { return U.smoothstep(-635, -770, z); };

  /* ------------------------------------------------------- continuous height */
  L.baseHeight = function (x, z) {
    if (L.isWater(x, z)) return 0;
    var ov = L.landOverride(x, z);
    if (ov) {
      if (ov.type === 'island') return ov.h;
      if (ov.type === 'breakwater') return ov.h;
      return 1;
    }
    var h = 1.0;
    // gentle undulation on the flat city so it never feels like paper
    h += (U.vnoise2(x * 0.013, z * 0.013) - 0.5) * 0.6;
    var ti = L.islandSlopeFactor(z);
    if (ti > 0) {
      var hi = L.hkHillField(x, z);
      h += ti * Math.max(0, hi) + ti * 4;
    }
    var tk = L.klSlopeFactor(z);
    if (tk > 0) {
      var hk = L.klHillField(x, z);
      h += tk * Math.max(0, hk) + tk * 3;
    }
    // far south-east / north-west hills spill in from the edges
    h += U.smoothstep(660, 920, Math.abs(z)) * (U.ridge2(x * 0.004, z * 0.004, 3) - 0.3) * 14;
    return h;
  };

  /// quantised (voxel terrace) height, suitable for collision + geometry
  L.terrainHeight = function (x, z) {
    if (L.isWater(x, z)) return -1;
    var h = L.baseHeight(x, z);
    if (h <= 0) return 0;
    var step = h > 190 ? 4 : h > 100 ? 3 : h > 26 ? 2 : 1;
    return Math.max(1, Math.round(h / step) * step);
  };

  /* ------------------------------------------------------------- districts */
  // rect: [minX, minZ, maxX, maxZ]
  L.DISTRICTS = [
    { id: 'kennedy', name: '堅尼地城', en: 'KENNEDY TOWN', side: 'hk', rect: [-1250, 285, -790, 570], minH: 12, maxH: 64, density: 0.72, lot: [5, 11], styles: [F.RESI, F.RESI_OLD, F.PUNCHED, F.BANDED], colors: ['#b0a38d', '#c0b29c', '#96a8a3', '#c6bba4', '#a2b1ac'], neon: 0.25 },
    { id: 'sheungwan', name: '上環 · 西營盤', en: 'SHEUNG WAN · SAI YING PUN', side: 'hk', rect: [-800, 282, -380, 560], minH: 14, maxH: 86, density: 0.82, lot: [4, 10], styles: [F.RESI_OLD, F.PUNCHED, F.BANDED, F.GLASS_SILVER, F.RESI], colors: ['#aa9c87', '#9fb4b2', '#c1b59f', '#8b9fa8', '#cabfa9', '#a9bbb8'], neon: 0.4 },
    { id: 'central', name: '中環', en: 'CENTRAL', side: 'hk', rect: [-380, 280, 85, 555], minH: 24, maxH: 140, density: 0.9, lot: [5, 13], styles: [F.GLASS_BLUE, F.GLASS_TEAL, F.GLASS_SILVER, F.CURTAIN_DARK, F.BANDED, F.STONE], colors: ['#8fb4c4', '#7ea3b8', '#bccfd8', '#6b8fa4', '#a9c1cc', '#5d8096', '#c9d6d8'], neon: 0.5 },
    { id: 'admiralty', name: '金鐘', en: 'ADMIRALTY', side: 'hk', rect: [85, 282, 225, 555], minH: 22, maxH: 128, density: 0.86, lot: [5, 12], styles: [F.GLASS_BLUE, F.GLASS_SILVER, F.CURTAIN_DARK, F.BANDED], colors: ['#97b8c6', '#7fa5b8', '#c4d6de', '#6f93a8', '#aec4cc'], neon: 0.35 },
    { id: 'wanchai', name: '灣仔', en: 'WAN CHAI', side: 'hk', rect: [225, 282, 425, 560], minH: 18, maxH: 118, density: 0.9, lot: [4, 11], styles: [F.GLASS_BLUE, F.GLASS_TEAL, F.PUNCHED, F.GLASS_SILVER, F.RESI_OLD, F.BANDED], colors: ['#9bb8c2', '#b3a78f', '#7fa3b4', '#c9b59a', '#c4cdca', '#86a4b0'], neon: 0.55 },
    { id: 'causeway', name: '銅鑼灣', en: 'CAUSEWAY BAY', side: 'hk', rect: [425, 292, 720, 560], minH: 15, maxH: 96, density: 0.94, lot: [4, 10], styles: [F.RESI, F.BANDED, F.PUNCHED, F.GLASS_TEAL, F.CURTAIN_DARK, F.RESI_OLD], colors: ['#c2b198', '#a9bfb9', '#d0c2a8', '#8fa8b0', '#c6b49a', '#9bb4ae'], neon: 0.85 },
    { id: 'northpoint', name: '北角 · 鰂魚涌', en: 'NORTH POINT · QUARRY BAY', side: 'hk', rect: [720, 285, 1000, 560], minH: 16, maxH: 108, density: 0.92, lot: [4, 10], styles: [F.RESI, F.PUNCHED, F.BANDED, F.GLASS_SILVER, F.RESI_OLD], colors: ['#b8ad96', '#9fb5b1', '#c9bda6', '#8ca4ae', '#b2c0ba', '#cdc0a8'], neon: 0.4 },
    { id: 'quarrybay', name: '鰂魚涌 · 太古', en: 'QUARRY BAY · TAIKOO', side: 'hk', rect: [1000, 285, 1250, 570], minH: 18, maxH: 118, density: 0.9, lot: [4, 11], styles: [F.GLASS_TEAL, F.GLASS_SILVER, F.RESI, F.BANDED, F.PUNCHED], colors: ['#9fbac1', '#c2b49b', '#a7bec3', '#cbbda6', '#8fa8b2'], neon: 0.35 },
    { id: 'saikeiwan', name: '西灣河 · 筲箕灣', en: 'SAI WAN HO · SHAU KEI WAN', side: 'hk', rect: [1250, 310, 1600, 590], minH: 12, maxH: 80, density: 0.78, lot: [4, 11], styles: [F.RESI, F.PUNCHED, F.RESI_OLD, F.BANDED], colors: ['#c2b6a5', '#aebbb7', '#cbbda9', '#99a8a9', '#d0c6b5'], neon: 0.25 },
    { id: 'chaiwan', name: '柴灣', en: 'CHAI WAN', side: 'hk', rect: [1600, 330, 2000, 620], minH: 10, maxH: 72, density: 0.66, lot: [5, 12], styles: [F.RESI, F.PUNCHED, F.INDUSTRIAL, F.BANDED], colors: ['#bfb4a3', '#a9b6b2', '#c9bcaa', '#9cabad', '#d1c5b4'], neon: 0.2 },
    { id: 'peakmid', name: '山頂 · 半山', en: 'VICTORIA PEAK · MID-LEVELS', side: 'hk', rect: [-900, 540, 1250, 1000], minH: 8, maxH: 45, density: 0.34, lot: [4, 10], styles: [F.RESI, F.PUNCHED, F.GLASS_SILVER, F.STONE], colors: ['#d8d2c4', '#c4c9c2', '#b8b4a6', '#d9cbb2', '#a9b5b0'], neon: 0.12, hill: true },

    { id: 'westkl', name: '西九龍 · 南昌', en: 'WEST KOWLOON · NAM CHEONG', side: 'kl', rect: [-2000, -760, -1250, -270], minH: 12, maxH: 86, density: 0.7, lot: [5, 12], styles: [F.RESI, F.PUNCHED, F.GLASS_SILVER, F.INDUSTRIAL, F.BANDED], colors: ['#b3a78f', '#c0b59d', '#97a9a6', '#c9bca1', '#a2b2ae'], neon: 0.3 },
    { id: 'westkowloon', name: '西九文化區 · 九龍站', en: 'WEST KOWLOON CULTURAL DISTRICT', side: 'kl', rect: [-1250, -610, -560, -250], minH: 16, maxH: 170, density: 0.62, lot: [5, 12], styles: [F.GLASS_TEAL, F.GLASS_SILVER, F.GLASS_BLUE, F.CURTAIN_DARK, F.RESI], colors: ['#9fbac2', '#bcc9c9', '#d0cec3', '#8fa8b2', '#bdb8ac', '#aac3c8'], neon: 0.35 },
    { id: 'tst', name: '尖沙咀', en: 'TSIM SHA TSUI', side: 'kl', rect: [-560, -540, 180, -282], minH: 14, maxH: 78, density: 0.94, lot: [4, 10], styles: [F.GLASS_BLUE, F.RESI, F.PUNCHED, F.GLASS_BRONZE, F.BANDED, F.GLASS_SILVER], colors: ['#b39383', '#9fb7b0', '#c3ac97', '#8fa3aa', '#c8b79e', '#a6b8b0', '#b59b9e'], neon: 1.0 },
    { id: 'jordan', name: '佐敦 · 油麻地', en: 'JORDAN · YAU MA TEI', side: 'kl', rect: [-560, -762, 180, -540], minH: 12, maxH: 62, density: 0.95, lot: [4, 9], styles: [F.RESI_OLD, F.PUNCHED, F.RESI, F.BANDED], colors: ['#ab9a83', '#bfae95', '#93a7a2', '#c6b795', '#a5b2a4', '#cdbfa5'], neon: 0.95 },
    { id: 'mongkok', name: '旺角 · 太子', en: 'MONG KOK · PRINCE EDWARD', side: 'kl', rect: [-460, -945, 300, -762], minH: 12, maxH: 72, density: 0.97, lot: [4, 9], styles: [F.RESI_OLD, F.RESI, F.PUNCHED, F.BANDED, F.INDUSTRIAL], colors: ['#b49f86', '#c4b298', '#97a89d', '#cbbd9c', '#a8b3a2', '#d0c2a5'], neon: 1.2 },
    { id: 'shamshuipo', name: '深水埗 · 長沙灣', en: 'SHAM SHUI PO · CHEUNG SHA WAN', side: 'kl', rect: [-950, -980, -460, -600], minH: 10, maxH: 60, density: 0.9, lot: [4, 10], styles: [F.RESI_OLD, F.PUNCHED, F.INDUSTRIAL, F.RESI], colors: ['#aa9d86', '#bcb098', '#92a3a0', '#c5b79b', '#9eafa8'], neon: 0.55 },
    { id: 'homantin', name: '何文田 · 九龍塘', en: 'HO MAN TIN · KOWLOON TONG', side: 'kl', rect: [180, -780, 470, -520], minH: 8, maxH: 62, density: 0.62, lot: [5, 12], styles: [F.RESI, F.PUNCHED, F.BANDED, F.STONE], colors: ['#c9bda7', '#b8c1ba', '#d3c8b2', '#a9b4ac', '#c1b8a4'], neon: 0.15 },
    { id: 'hunghom', name: '紅磡 · 黃埔', en: 'HUNG HOM · WHAMPOA', side: 'kl', rect: [180, -540, 640, -250], minH: 14, maxH: 88, density: 0.82, lot: [4, 11], styles: [F.RESI, F.PUNCHED, F.GLASS_SILVER, F.BANDED], colors: ['#b3a48e', '#a3b7b1', '#c4b59f', '#93a9ac', '#cbbca4'], neon: 0.35 },
    { id: 'tokwawan', name: '土瓜灣 · 馬頭角', en: 'TO KWA WAN', side: 'kl', rect: [640, -580, 820, -300], minH: 10, maxH: 58, density: 0.88, lot: [4, 10], styles: [F.RESI_OLD, F.PUNCHED, F.INDUSTRIAL], colors: ['#b4a68f', '#c3b59d', '#9ba7a3', '#cbbda2', '#a6b0a9'], neon: 0.4 },
    { id: 'kaitak', name: '啟德', en: 'KAI TAK', side: 'kl', rect: [820, -660, 1270, -250], minH: 10, maxH: 82, density: 0.6, lot: [5, 13], styles: [F.GLASS_SILVER, F.RESI, F.GLASS_TEAL, F.BANDED], colors: ['#aebfc1', '#c6bca8', '#9fb3b8', '#cfc4af', '#96adb1'], neon: 0.25 },
    { id: 'kowloonbay', name: '九龍灣', en: 'KOWLOON BAY', side: 'kl', rect: [1270, -780, 1600, -360], minH: 12, maxH: 82, density: 0.66, lot: [5, 13], styles: [F.INDUSTRIAL, F.GLASS_SILVER, F.RESI, F.BANDED], colors: ['#a5b3b1', '#b6af9e', '#99a6a5', '#bfb6a2', '#8b9d9f'], neon: 0.2 },
    { id: 'kwuntong', name: '觀塘', en: 'KWUN TONG', side: 'kl', rect: [1600, -900, 2000, -380], minH: 10, maxH: 90, density: 0.6, lot: [5, 13], styles: [F.INDUSTRIAL, F.RESI, F.GLASS_SILVER, F.PUNCHED], colors: ['#a4b0a9', '#b7ac97', '#93a3a2', '#c2b8a1', '#88999a'], neon: 0.25 },
    { id: 'klhills', name: '九龍群山', en: 'KOWLOON RIDGES', side: 'kl', rect: [-1000, -1000, 2000, -640], minH: 8, maxH: 34, density: 0.12, lot: [5, 12], styles: [F.RESI, F.STONE], colors: ['#c5bdab', '#b3bcb2', '#d2c7b4'], neon: 0, hill: true }
  ];
  L.DISTRICT_BY_ID = {};
  L.DISTRICTS.forEach(function (d) { L.DISTRICT_BY_ID[d.id] = d; });

  L.districtAt = function (x, z) {
    if (L.isWater(x, z)) return null;
    var best = null, bestArea = Infinity;
    for (var i = 0; i < L.DISTRICTS.length; i++) {
      var d = L.DISTRICTS[i], r = d.rect;
      if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) {
        var area = (r[2] - r[0]) * (r[3] - r[1]);
        if (area < bestArea) { best = d; bestArea = area; }
      }
    }
    if (best) return best;
    // outside the districts: the side decides
    return (z < L.northShoreZ(x) ? L.DISTRICT_BY_ID.klhills : L.DISTRICT_BY_ID.peakmid);
  };
  L.districtLabel = function (x, z) {
    var d = L.districtAt(x, z);
    return d ? d.name + ' · ' + d.en : '維多利亞港 · VICTORIA HARBOUR';
  };

  /* ---------------------------------------------------------------- parks */
  L.PARKS = [
    { name: '維多利亞公園', en: 'VICTORIA PARK', poly: [[560, 485], [725, 485], [725, 600], [560, 600]], type: 'park' },
    { name: '香港公園', en: 'HONG KONG PARK', poly: [[-30, 430], [85, 430], [85, 505], [-30, 505]], type: 'park' },
    { name: '添馬公園', en: 'TAMAR PARK', poly: [[90, 302], [190, 302], [190, 372], [90, 372]], type: 'lawn' },
    { name: '九龍公園', en: 'KOWLOON PARK', poly: [[-455, -430], [-320, -430], [-320, -540], [-455, -540]], type: 'park' },
    { name: '西九藝術公園', en: 'WEST KOWLOON ART PARK', poly: [[-1250, -292], [-760, -292], [-760, -355], [-1250, -355]], type: 'lawn' },
    { name: '中山紀念公園', en: 'SUN YAT SEN PARK', poly: [[-720, 288], [-610, 288], [-610, 360], [-720, 360]], type: 'lawn' },
    { name: '訊號山公園', en: 'SIGNAL HILL', poly: [[215, 368], [270, 368], [270, 425], [215, 425]], type: 'park' },
    { name: '遮打花園', en: 'CHATER GARDEN', poly: [[-140, 355], [-95, 355], [-95, 390], [-140, 390]], type: 'lawn' },
    { name: '皇后像廣場', en: 'STATUE SQUARE', poly: [[-175, 350], [-145, 350], [-145, 385], [-175, 385]], type: 'plaza' },
    { name: '鰂魚涌公園', en: 'QUARRY BAY PARK', poly: [[980, 292], [1080, 292], [1080, 345], [980, 345]], type: 'park' },
    { name: '愛秩序灣公園', en: 'ALDRICH BAY PARK', poly: [[1290, 322], [1380, 322], [1380, 380], [1290, 380]], type: 'park' },
    { name: '啟德跑道公園', en: 'KAI TAK RUNWAY PARK', poly: [[850, -354], [860, -346], [1004, -236], [994, -244]], type: 'lawn' },
    { name: '海濱長廊', en: 'TSIM SHA TSUI PROMENADE', poly: [[-430, -334], [220, -334], [220, -318], [-430, -318]], type: 'promenade' },
    { name: '星光大道', en: 'AVENUE OF STARS', poly: [[-60, -330], [210, -330], [210, -318], [-60, -318]], type: 'promenade' },
    { name: '中環海濱', en: 'CENTRAL HARBOURFRONT', poly: [[-330, 300], [10, 300], [10, 320], [-330, 320]], type: 'promenade' }
  ];
  L.isPark = function (x, z) {
    for (var i = 0; i < L.PARKS.length; i++) {
      if (U.pointInPoly(x, z, L.PARKS[i].poly)) return L.PARKS[i];
    }
    return null;
  };

  /* ------------------------------------------------------------ landmark anchors */
  L.LANDMARKS = {
    // Hong Kong Island
    ifc2: { x: -318, z: 352, w: 30, d: 30, h: 207, name: '國際金融中心二期', en: 'TWO IFC' },
    ifc1: { x: -252, z: 404, w: 24, d: 24, h: 105, name: '國際金融中心一期', en: 'ONE IFC' },
    ifcMall: { x: -292, z: 386, w: 90, d: 56, h: 12, name: '國際金融中心商場', en: 'IFC MALL' },
    boc: { x: -28, z: 408, w: 34, d: 34, h: 184, name: '中銀大廈', en: 'BANK OF CHINA TOWER' },
    hsbc: { x: -120, z: 424, w: 44, d: 32, h: 92, name: '滙豐總行大廈', en: 'HSBC MAIN BUILDING' },
    cheungkong: { x: -62, z: 468, w: 26, d: 26, h: 142, name: '長江集團中心', en: 'CHEUNG KONG CENTER' },
    jardine: { x: -222, z: 442, w: 26, d: 24, h: 90, name: '怡和大廈', en: 'JARDINE HOUSE' },
    center: { x: -92, z: 512, w: 28, d: 28, h: 173, name: '中環中心', en: 'THE CENTER' },
    exchange: { x: -190, z: 430, w: 40, d: 28, h: 95, name: '交易廣場', en: 'EXCHANGE SQUARE' },
    cityhall: { x: -152, z: 338, w: 38, d: 22, h: 13, name: '香港大會堂', en: 'CITY HALL' },
    cenotaph: { x: -162, z: 372, w: 12, d: 8, h: 7, name: '和平紀念碑', en: 'CENOTAPH' },
    legco: { x: -132, z: 380, w: 26, d: 18, h: 14, name: '立法會綜合大樓', en: 'LEGCO' },
    lippo: { x: 70, z: 455, w: 24, d: 30, h: 94, name: '力寶中心', en: 'LIPPO CENTRE' },
    pacific: { x: 52, z: 505, w: 30, d: 42, h: 115, name: '太古廣場', en: 'PACIFIC PLACE' },
    tamar: { x: 168, z: 388, w: 42, d: 30, h: 62, name: '政府總部', en: 'TAMAR CENTRAL GOVERNMENT OFFICES' },
    wheel: { x: -34, z: 318, w: 26, d: 26, h: 32, name: '香港摩天輪', en: 'HONG KONG OBSERVATION WHEEL' },
    centralPiers: { x: -178, z: 292, w: 70, d: 34, h: 6, name: '中環碼頭', en: 'CENTRAL PIER' },
    peakTower: { x: -282, z: 688, w: 26, d: 24, h: 20, name: '山頂凌霄閣', en: 'THE PEAK TOWER' },
    peakTramLower: { x: -150, z: 330, w: 12, d: 10, h: 8, name: '山頂纜車總站', en: 'PEAK TRAM LOWER TERMINUS' },
    hkcec: { x: 246, z: 322, w: 78, d: 46, h: 26, name: '香港會議展覽中心', en: 'HKCEC' },
    goldenBauhinia: { x: 236, z: 320, w: 14, d: 14, h: 12, name: '金紫荊廣場', en: 'GOLDEN BAUHINIA SQUARE' },
    centralPlaza: { x: 300, z: 392, w: 30, d: 30, h: 187, name: '中環廣場', en: 'CENTRAL PLAZA' },
    hopewell: { x: 322, z: 452, w: 26, d: 26, h: 108, name: '合和中心', en: 'HOPEWELL CENTRE' },
    wanchaiFerry: { x: 252, z: 294, w: 34, d: 28, h: 6, name: '灣仔渡輪碼頭', en: 'WAN CHAI FERRY PIER' },
    timesSquare: { x: 760, z: 500, w: 34, d: 30, h: 97, name: '時代廣場', en: 'TIMES SQUARE' },
    victoriaPark: { x: 610, z: 480, w: 1, d: 1, h: 1, name: '維多利亞公園', en: 'VICTORIA PARK' },
    oneIslandEast: { x: 1092, z: 418, w: 30, d: 28, h: 149, name: '港島東中心', en: 'ONE ISLAND EAST' },
    monsterBuilding: { x: 1070, z: 470, w: 34, d: 28, h: 58, name: '怪獸大廈', en: 'MONSTER BUILDING' },
    // Kowloon
    culturalCentre: { x: -132, z: -356, w: 88, d: 54, h: 17, name: '香港文化中心', en: 'HK CULTURAL CENTRE' },
    clockTower: { x: -182, z: -336, w: 12, d: 12, h: 21, name: '前九廣鐵路鐘樓', en: 'CLOCK TOWER' },
    spaceMuseum: { x: -20, z: -364, w: 30, d: 26, h: 24, name: '香港太空館', en: 'HK SPACE MUSEUM' },
    museumArt: { x: 50, z: -358, w: 32, d: 22, h: 22, name: '香港藝術館', en: 'HK MUSEUM OF ART' },
    peninsula: { x: -286, z: -386, w: 42, d: 28, h: 26, name: '半島酒店', en: 'THE PENINSULA' },
    heritage1881: { x: -198, z: -352, w: 32, d: 26, h: 12, name: '1881 公館', en: '1881 HERITAGE' },
    chungking: { x: -352, z: -368, w: 34, d: 30, h: 48, name: '重慶大廈', en: 'CHUNGKING MANSIONS' },
    k11musea: { x: 130, z: -356, w: 46, d: 26, h: 16, name: 'K11 MUSEA', en: 'K11 MUSEA' },
    rosewood: { x: 172, z: -378, w: 30, d: 28, h: 140, name: '瑰麗酒店', en: 'ROSEWOOD' },
    k11: { x: 46, z: -384, w: 30, d: 26, h: 62, name: 'K11', en: 'K11' },
    isquare: { x: -158, z: -392, w: 26, d: 24, h: 52, name: 'iSQUARE', en: 'iSQUARE' },
    theOne: { x: -268, z: -436, w: 24, d: 24, h: 56, name: 'The ONE', en: 'THE ONE' },
    avenueStars: { x: 64, z: -330, w: 1, d: 1, h: 1, name: '星光大道', en: 'AVENUE OF STARS' },
    starFerryTST: { x: -216, z: -296, w: 34, d: 52, h: 6, name: '尖沙咀天星碼頭', en: 'TSIM SHA TSUI STAR FERRY PIER' },
    oceanTerminal: { x: -438, z: -274, w: 52, d: 64, h: 10, name: '海運大廈', en: 'OCEAN TERMINAL' },
    harbourCity: { x: -424, z: -356, w: 54, d: 52, h: 60, name: '海港城', en: 'HARBOUR CITY' },
    icc: { x: -962, z: -424, w: 34, d: 34, h: 242, name: '環球貿易廣場', en: 'INTERNATIONAL COMMERCE CENTRE' },
    mplus: { x: -1122, z: -304, w: 66, d: 28, h: 26, name: 'M+博物館', en: 'M+ MUSEUM' },
    xiqu: { x: -1234, z: -344, w: 34, d: 34, h: 42, name: '戲曲中心', en: 'XIOU CENTRE' },
    palaceMuseum: { x: -1184, z: -422, w: 42, d: 34, h: 28, name: '香港故宮文化博物館', en: 'HK PALACE MUSEUM' },
    kowloonStation: { x: -968, z: -514, w: 60, d: 60, h: 120, name: '九龍站上蓋', en: 'KOWLOON STATION' },
    coliseum: { x: 396, z: -438, w: 40, d: 40, h: 34, name: '香港體育館', en: 'HONG KONG COLISEUM' },
    hungHomStation: { x: 384, z: -516, w: 44, d: 30, h: 18, name: '紅磡站', en: 'HUNG HOM STATION' },
    whampoa: { x: 520, z: -392, w: 52, d: 26, h: 24, name: '黃埔號', en: 'THE WHAMPOA' },
    crossTunnel: { x: 330, z: -390, w: 26, d: 26, h: 8, name: '紅磡海底隧道', en: 'CROSS-HARBOUR TUNNEL' },
    kaiTakCruise: { x: 980, z: -255, w: 46, d: 26, h: 18, name: '啟德郵輪碼頭', en: 'KAI TAK CRUISE TERMINAL' },
    kaiTakSports: { x: 1062, z: -524, w: 50, d: 40, h: 26, name: '啟德體育園', en: 'KAI TAK SPORTS PARK' },
    langham: { x: 24, z: -842, w: 26, d: 26, h: 130, name: '朗豪坊', en: 'LANGHAM PLACE' },
    nathanRoad: { x: -96, z: -600, w: 1, d: 1, h: 1, name: '彌敦道', en: 'NATHAN ROAD' },
    templeStreet: { x: -300, z: -636, w: 1, d: 1, h: 1, name: '廟街', en: 'TEMPLE STREET' },
    ladiesMarket: { x: 80, z: -800, w: 1, d: 1, h: 1, name: '女人街', en: 'LADIES MARKET' },
    lionRock: { x: -170, z: -856, w: 1, d: 1, h: 1, name: '獅子山', en: 'LION ROCK' }
  };

  /* --------------------------------------------------- landmark reservations
   * [x0, z0, x1, z1, kind]  Procedural buildings stay out. Plaza dressing.
   * ---------------------------------------------------------------------- */
  L.RESERVED = [];
  function reserve(x, z, w, d, pad, kind) {
    pad = pad == null ? 6 : pad;
    L.RESERVED.push([x - w / 2 - pad, z - d / 2 - pad, x + w / 2 + pad, z + d / 2 + pad, kind || 'plaza']);
  }
  // every landmark footprint gets a dressed plaza pad so procedural buildings
  // never crowd the hand-crafted architecture
  var LM_PAD = { ifc2: 14, ifc1: 10, ifcMall: 4, boc: 14, hsbc: 12, cheungkong: 8, center: 8,
    icc: 20, mplus: 14, xiqu: 10, palaceMuseum: 10, kowloonStation: 14, hkcec: 14,
    culturalCentre: 14, spaceMuseum: 10, clockTower: 8, peninsula: 12, coliseum: 12,
    kaiTakCruise: 12, kaiTakSports: 12, langham: 8, monsterBuilding: 8, harbourCity: 8 };
  for (var lmk in L.LANDMARKS) {
    var lm = L.LANDMARKS[lmk];
    if (!lm || lm.w <= 2) continue;
    var lpad = LM_PAD[lmk] != null ? LM_PAD[lmk] : 5;
    reserve(lm.x, lm.z, lm.w, lm.d, lpad, 'plaza');
  }
  // landmark clusters / plazas / promenades that deserve extra breathing room
  reserve(-292, 386, 170, 110, 0, 'plaza');      // IFC / Central waterfront
  reserve(-120, 424, 70, 60, 0, 'plaza');        // HSBC / Statue Square
  reserve(246, 322, 130, 90, 0, 'plaza');        // HKCEC / Golden Bauhinia
  reserve(-132, -356, 170, 100, 0, 'plaza');     // Cultural Centre waterfront
  reserve(-968, -514, 120, 110, 0, 'plaza');     // Kowloon Station / ICC
  reserve(64, -330, 320, 34, 0, 'promenade');    // Avenue of Stars
  reserve(-1040, -322, 360, 80, 0, 'park');      // WKCD Art Park
  reserve(610, 480, 190, 140, 0, 'park');        // Victoria Park
  reserve(-282, 694, 80, 70, 0, 'plaza');        // Peak Tower lookout
  reserve(1070, 470, 70, 60, 0, 'plaza');        // Monster Building square
  reserve(-1480, 78, 46, 40, 4, 'plaza');        // Green Island lighthouse

  L.isReserved = function (x, z) {
    for (var i = 0; i < L.RESERVED.length; i++) {
      var r = L.RESERVED[i];
      if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return r;
    }
    return null;
  };

  /* ---------------------------------------------------------------- roads
   * Main roads are used for vehicles and wide terrain avenues.
   * [x,z] polylines. width in units (1u = 2m).
   * -------------------------------------------------------------------- */
  function shoreRoad(side, offset, x0, x1, step) {
    var pts = [];
    step = step || 40;
    for (var x = x0; x <= x1; x += step) {
      var z = (side === 'kl') ? L.northShoreZ(x) - offset : L.southShoreZ(x) + offset;
      pts.push([x, z]);
    }
    return pts;
  }
  L.ROADS = [
    // HK Island east-west arteries
    { name: '干諾道中 · 夏慤道', en: 'CONNAUGHT ROAD · HARCOURT ROAD', width: 15, type: 'main', pts: shoreRoad('hk', 15, -1250, 460) },
    { name: '德輔道中', en: 'DES VOEUX ROAD CENTRAL', width: 12, type: 'main', pts: shoreRoad('hk', 24, -1250, 430) },
    { name: '皇后大道中', en: 'QUEEN\'S ROAD CENTRAL', width: 10, type: 'street', pts: shoreRoad('hk', 36, -1250, 450) },
    { name: '軒尼詩道', en: 'HENNESSY ROAD', width: 12, type: 'main', pts: [[250, 345], [300, 355], [350, 362], [380, 368], [395, 392], [410, 430], [430, 480], [460, 505], [520, 520], [580, 520], [632, 505], [680, 472], [720, 435], [760, 405], [800, 388], [840, 378]] },
    { name: '告士打道', en: 'GLOUCESTER ROAD', width: 14, type: 'main', pts: shoreRoad('hk', 34, 220, 390) },
    { name: '堅拿道天橋', en: 'CANAL ROAD FLYOVER', width: 9, type: 'main', pts: [[390, 398], [405, 430], [420, 470], [445, 495]] },
    { name: '英皇道', en: 'KING\'S ROAD', width: 12, type: 'main', pts: [[820, 356], [900, 350], [980, 352], [1060, 358], [1140, 366], [1220, 378], [1300, 392]] },
    { name: '筲箕灣道', en: 'SHAU KEI WAN ROAD', width: 11, type: 'main', pts: [[1300, 392], [1380, 404], [1460, 418], [1540, 436], [1620, 452]] },
    { name: '柴灣道', en: 'CHAI WAN ROAD', width: 10, type: 'street', pts: [[1620, 452], [1700, 470], [1780, 492], [1850, 512]] },
    { name: '高士威道 / 維園道', en: 'CAUSEWAY ROAD', width: 12, type: 'main', pts: [[390, 392], [405, 425], [420, 465], [450, 495], [510, 512], [570, 514], [620, 500], [660, 470], [700, 435]] },
    { name: '花園道', en: 'GARDEN ROAD', width: 10, type: 'street', pts: [[-140, 350], [-160, 390], [-190, 430], [-220, 460]] },
    // HK Island north-south streets
    { name: '德己立街', en: 'D\'AGUILAR STREET', width: 8, type: 'street', pts: [[-180, 330], [-190, 380], [-200, 430]] },
    { name: '砵典乍街', en: 'POTTINGER STREET', width: 8, type: 'street', pts: [[-250, 315], [-260, 360], [-270, 410]] },
    { name: '域多利皇后街', en: 'QUEEN VICTORIA ST', width: 8, type: 'street', pts: [[-320, 310], [-330, 360], [-340, 410]] },
    { name: '金鐘道', en: 'QUEENSWAY', width: 14, type: 'main', pts: [[85, 380], [120, 378], [160, 376], [200, 374], [240, 372], [280, 370]] },
    { name: '堅尼地道', en: 'KENNEDY ROAD', width: 9, type: 'street', pts: [[-350, 470], [-200, 472], [-50, 476], [100, 482], [250, 490], [400, 500]] },
    // Peak tram alignment (drawn as a narrow track; also used by tram cars)
    { name: '山頂纜車', en: 'PEAK TRAM', width: 3, type: 'track', pts: [[-150, 330], [-165, 370], [-190, 420], [-215, 480], [-235, 540], [-255, 600], [-275, 660], [-282, 688]] },
    // Kowloon east-west
    { name: '梳士巴利道', en: 'SALISBURY ROAD', width: 13, type: 'main', pts: shoreRoad('kl', 6, -560, 230, 30) },
    { name: '佐敦道', en: 'JORDAN ROAD', width: 11, type: 'main', pts: [[-600, -560], [-450, -558], [-300, -556], [-150, -554], [0, -552], [130, -552]] },
    { name: '柯士甸道', en: 'AUSTIN ROAD', width: 10, type: 'street', pts: [[-620, -512], [-450, -512], [-300, -514], [-160, -516], [-20, -518]] },
    { name: '亞皆老街', en: 'ARGYLE STREET', width: 11, type: 'main', pts: [[-620, -778], [-450, -780], [-300, -782], [-150, -784], [0, -786], [160, -790], [300, -792]] },
    { name: '太子道西', en: 'PRINCE EDWARD ROAD WEST', width: 10, type: 'street', pts: [[-620, -838], [-450, -840], [-300, -842], [-150, -844], [0, -846], [150, -850], [290, -852]] },
    { name: '西九龍公路', en: 'WEST KOWLOON HIGHWAY', width: 14, type: 'main', pts: shoreRoad('kl', 22, -1400, -580, 40) },
    { name: '紅磡繞道', en: 'HUNG HOM BYPASS', width: 12, type: 'main', pts: shoreRoad('kl', 14, 230, 650, 30) },
    { name: '漆咸道北', en: 'CHATHAM ROAD NORTH', width: 11, type: 'main', pts: [[185, -330], [185, -380], [190, -460], [200, -540], [240, -600], [310, -640]] },
    { name: '觀塘道', en: 'KWUN TONG ROAD', width: 13, type: 'main', pts: [[1230, -470], [1320, -480], [1420, -490], [1520, -500], [1640, -515], [1760, -530], [1880, -545]] },
    { name: '啟德承啟道', en: 'KAI TAK ROAD', width: 10, type: 'street', pts: [[820, -400], [900, -420], [1000, -436], [1100, -450], [1200, -466]] },
    // Kowloon north-south
    { name: '彌敦道', en: 'NATHAN ROAD', width: 14, type: 'main', pts: [[-96, -326], [-96, -380], [-96, -460], [-96, -540], [-96, -620], [-96, -700], [-96, -780], [-96, -860], [-96, -940]] },
    { name: '廣東道', en: 'CANTON ROAD', width: 12, type: 'main', pts: [[-390, -318], [-390, -380], [-390, -460], [-390, -540], [-380, -620], [-360, -700], [-350, -780]] },
    { name: '漆咸道南', en: 'CHATHAM ROAD SOUTH', width: 10, type: 'street', pts: [[120, -318], [125, -380], [130, -440], [140, -500], [160, -560]] },
    // cross-harbour tunnel alignment (rendered as an underwater hint for life)
    { name: '海底隧道', en: 'CROSS-HARBOUR TUNNEL', width: 9, type: 'tunnel', pts: [[340, -390], [343, -250], [346, -120], [349, 10], [352, 140], [355, 260], [356, 300]] }
  ];

  // tram route (HK Island): Central -> Causeway Bay (inland around typhoon
  // shelter) -> North Point. Generated from the shore so it always stays dry.
  L.TRAM_ROUTE = (function () {
    var pts = [];
    for (var x = -1120; x <= 380; x += 30) pts.push([x, L.southShoreZ(x) + 22]);
    pts = pts.concat([
      [400, 400], [415, 440], [430, 480], [460, 505], [520, 520], [580, 520],
      [632, 505], [680, 470], [720, 432], [760, 402], [800, 382], [840, 370], [900, 368], [960, 374]
    ]);
    return pts;
  })();

  // walkable promenade paths for pedestrians / POIs. Generated from shorelines
  // so every segment sits on terra firma.
  function shoreWalk(side, offset, x0, x1, step) {
    var pts = [];
    step = step || 24;
    for (var x = x0; x <= x1; x += step) {
      var z = (side === 'kl') ? L.northShoreZ(x) - offset : L.southShoreZ(x) + offset;
      pts.push([x, z]);
    }
    return pts;
  }
  L.WALK_PATHS = [
    shoreWalk('kl', 5, -520, 225, 24),                 // TST waterfront promenade
    shoreWalk('kl', 5, 320, 640, 24),                  // Hung Hom waterfront
    [[-1150, -316], [-1050, -318], [-950, -320], [-850, -322], [-760, -324]], // WKCD art park
    shoreWalk('hk', 5, -720, 380, 24),                 // HK Island north promenade (west/central)
    shoreWalk('hk', 5, 640, 1080, 24),                 // North Point / Quarry Bay promenade
    [[430, 432], [480, 432], [530, 432], [568, 432]],   // CWB breakwater
    [[-282, 694], [-278, 704], [-260, 714], [-240, 710], [-228, 700]], // Peak trail
    shoreWalk('kl', 5, 650, 1000, 26)                  // Kai Tak / To Kwa Wan waterfront
  ];

  /* ------------------------------------------------------- ferry operations */
  L.FERRY_ROUTES = [
    { id: 'central-tst', name: '中環 — 尖沙咀', en: 'CENTRAL — TSIM SHA TSUI', a: [-164, 258], b: [-200, -258], width: 30, speed: 4.4, turnaround: 2.5, count: 2, color: 'star' },
    { id: 'wanchai-tst', name: '灣仔 — 尖沙咀', en: 'WAN CHAI — TSIM SHA TSUI', a: [250, 258], b: [-186, -254], width: 26, speed: 4.0, turnaround: 2.2, count: 2, color: 'star' },
    { id: 'hunghom-wanchai', name: '紅磡 — 灣仔', en: 'HUNG HOM — WAN CHAI', a: [352, -244], b: [252, 262], width: 24, speed: 3.8, turnaround: 2.0, count: 1, color: 'star' },
    { id: 'junk', name: '張保仔號', en: 'AQUAL LUNA JUNK', spline: [[-620, 160], [-380, 190], [-120, 180], [180, 150], [420, 120], [600, 150], [460, 210], [180, 230], [-120, 240], [-380, 230], [-620, 200]], speed: 2.4, count: 1, color: 'junk' },
    { id: 'cargo-east', name: '貨輪航道', en: 'CARGO LANE', a: [-2000, -60], b: [2000, 40], width: 26, speed: 2.2, turnaround: 0, count: 3, color: 'cargo' },
    { id: 'cargo-west', name: '貨輪航道', en: 'CARGO LANE', a: [2000, 120], b: [-2000, 30], width: 26, speed: 1.8, turnaround: 0, count: 2, color: 'cargo' },
    { id: 'yacht', name: '遊艇', en: 'YACHT', spline: [[480, 330], [600, 300], [720, 280], [820, 300], [750, 310], [620, 350], [500, 345]], speed: 2.0, count: 2, color: 'yacht' }
  ];

  /* ------------------------------------------------------------------ POIs */
  L.POIS = [
    {
      id: 'central', name: '中環天際線', en: 'CENTRAL SKYLINE', district: '中環 · CENTRAL', kind: 'orbit',
      cam: { pos: [-60, 128, -520], target: [-140, 62, 330], fov: 42 }, blurb: '國際金融中心、中銀大廈與滙豐總行組成的世界級天際線。',
      tags: ['skyline', 'architecture']
    },
    {
      id: 'tst', name: '尖沙咀海濱', en: 'TSIM SHA TSUI WATERFRONT', district: '尖沙咀 · TSIM SHA TSUI', kind: 'orbit',
      cam: { pos: [-430, 76, 120], target: [-150, 30, -292], fov: 46 }, blurb: '文化中心、鐘樓與太空館，望向港島的經典百萬夜景。',
      tags: ['promenade', 'heritage']
    },
    {
      id: 'peak', name: '太平山頂', en: 'VICTORIA PEAK', district: '山頂 · THE PEAK', kind: 'orbit',
      cam: { pos: [-330, 315, 880], target: [-110, 42, 240], fov: 40 }, blurb: '從海拔 552 米的太平山俯瞰維多利亞港兩岸。',
      tags: ['viewpoint', 'iconic']
    },
    {
      id: 'westk', name: '西九文化區', en: 'WEST KOWLOON CULTURAL DISTRICT', district: '西九龍 · WEST KOWLOON', kind: 'orbit',
      cam: { pos: [-1430, 120, 120], target: [-1020, 72, -380], fov: 44 }, blurb: 'M+、戲曲中心、故宮文化博物館與環球貿易廣場。',
      tags: ['culture', 'architecture']
    },
    {
      id: 'hkcec', name: '會展與金紫荊', en: 'HKCEC & GOLDEN BAUHINIA', district: '灣仔 · WAN CHAI', kind: 'orbit',
      cam: { pos: [420, 62, -90], target: [240, 20, 300], fov: 46 }, blurb: '飛鳥展翅的會展中心，回歸紀念的金紫荊廣場。',
      tags: ['landmark', 'harbour']
    },
    {
      id: 'cwb', name: '銅鑼灣避風塘', en: 'CAUSEWAY BAY TYPHOON SHELTER', district: '銅鑼灣 · CAUSEWAY BAY', kind: 'orbit',
      cam: { pos: [880, 98, 130], target: [540, 10, 390], fov: 44 }, blurb: '遊艇與漁船停泊的避風塘，霓虹與海風交織。',
      tags: ['harbour', 'nightlife']
    },
    {
      id: 'kaitak', name: '啟德跑道', en: 'KAI TAK RUNWAY', district: '啟德 · KAI TAK', kind: 'orbit',
      cam: { pos: [1370, 92, 160], target: [940, 12, -230], fov: 46 }, blurb: '伸入維港的舊機場跑道與郵輪碼頭，城市記憶的延伸。',
      tags: ['aviation', 'harbour']
    },
    {
      id: 'hunghom', name: '紅磡 · 黃埔', en: 'HUNG HOM & WHAMPOA', district: '紅磡 · HUNG HOM', kind: 'orbit',
      cam: { pos: [800, 92, -40], target: [430, 26, -350], fov: 45 }, blurb: '倒金字塔體育館、黃埔號與過海隧道。',
      tags: ['landmark', 'district']
    },
    {
      id: 'ocean', name: '海港城與海運', en: 'OCEAN TERMINAL', district: '尖沙咀 · TSIM SHA TSUI', kind: 'orbit',
      cam: { pos: [-620, 72, 60], target: [-430, 24, -330], fov: 45 }, blurb: '維港西翼的郵輪泊岸與購物長廊。',
      tags: ['harbour', 'shopping']
    },
    {
      id: 'monster', name: '怪獸大廈', en: 'MONSTER BUILDING', district: '鰂魚涌 · QUARRY BAY', kind: 'orbit',
      cam: { pos: [1180, 78, 330], target: [1070, 32, 470], fov: 48 }, blurb: 'E 形密集住宅，香港垂直城市的最佳隱喻。',
      tags: ['architecture', 'density']
    },
    {
      id: 'walk-avenue', name: '星光大道漫遊', en: 'WALK THE AVENUE OF STARS', district: '尖沙咀 · TSIM SHA TSUI', kind: 'walk',
      spawn: { x: 10, z: -318, yaw: 3.02, pitch: -0.01 }, blurb: '沿海濱長廊以第一人稱漫步，仰望港島天際線。',
      tags: ['walk', 'promenade']
    },
    {
      id: 'walk-central', name: '中環街頭漫遊', en: 'WALK CENTRAL STREETS', district: '中環 · CENTRAL', kind: 'walk',
      spawn: { x: -260, z: 372, yaw: 2.45, pitch: -0.02 }, blurb: '在摩天樓群與老街道之間穿行，感受城市尺度。',
      tags: ['walk', 'street']
    },
    {
      id: 'walk-peak', name: '山頂環迴漫步', en: 'WALK THE PEAK', district: '山頂 · THE PEAK', kind: 'walk',
      spawn: { x: -282, z: 706, yaw: -0.25, pitch: -0.06 }, blurb: '沿山頂步道散步，俯瞰維港全景。',
      tags: ['walk', 'nature']
    }
  ];

  /* --------------------------------------------------- cinematic shot list */
  L.CINEMATIC = [
    {
      id: 'skyline', title: '中環天際線', en: 'CENTRAL SKYLINE', duration: 20,
      time: 18.62, weather: 'clear',
      path: [[-540, 90, -240], [-400, 120, -180], [-260, 155, -110], [-130, 180, -40], [-20, 200, 20]],
      target: [[-230, 55, 340], [-230, 65, 350], [-220, 75, 360], [-210, 80, 370], [-200, 85, 380]],
      fov: 40
    },
    {
      id: 'starferry', title: '天星小輪', en: 'STAR FERRY CROSSING', duration: 19,
      time: 19.1, weather: 'clear',
      path: [[-420, 12, -120], [-330, 14, -40], [-260, 16, 60], [-210, 18, 160], [-190, 20, 240]],
      target: [[-260, 30, -200], [-240, 24, -120], [-220, 18, -20], [-200, 12, 80], [-180, 10, 190]],
      fov: 44
    },
    {
      id: 'neon', title: '彌敦道霓虹', en: 'NEON NATHAN ROAD', duration: 18,
      time: 21.6, weather: 'clear',
      path: [[-60, 18, -420], [-85, 16, -500], [-80, 15, -580], [-70, 14, -660], [-90, 15, -740]],
      target: [[-140, 14, -480], [-150, 12, -560], [-120, 12, -640], [-130, 12, -720], [-100, 14, -800]],
      fov: 46
    },
    {
      id: 'peak', title: '太平山俯瞰', en: 'FROM THE PEAK', duration: 21,
      time: 17.9, weather: 'clear',
      path: [[120, 330, 760], [-40, 340, 700], [-180, 330, 640], [-300, 310, 580], [-380, 280, 520]],
      target: [[80, 40, 260], [0, 35, 250], [-80, 30, 240], [-140, 25, 230], [-200, 20, 230]],
      fov: 42
    },
    {
      id: 'kaitak', title: '啟德跑道黃昏', en: 'KAI TAK AT DUSK', duration: 20,
      time: 18.9, weather: 'clear',
      path: [[1500, 90, 60], [1300, 80, 10], [1120, 70, -40], [980, 60, -110], [870, 55, -180]],
      target: [[1050, 12, -220], [980, 10, -230], [900, 10, -240], [830, 8, -250], [780, 8, -260]],
      fov: 46
    },
    {
      id: 'wkcd', title: '西九文化海岸', en: 'WEST KOWLOON CULTURE', duration: 20,
      time: 19.5, weather: 'clear',
      path: [[-1600, 60, 60], [-1480, 70, 20], [-1340, 80, -50], [-1220, 90, -130], [-1120, 100, -210]],
      target: [[-1150, 20, -300], [-1080, 26, -320], [-1010, 34, -350], [-960, 46, -380], [-930, 60, -400]],
      fov: 44
    },
    {
      id: 'dawn2', title: '東方之珠', en: 'PEARL OF THE ORIENT', duration: 24,
      time: 21.8, weather: 'clear',
      path: [[-1300, 220, -600], [-900, 260, -650], [-400, 300, -700], [100, 340, -750], [600, 300, -700]],
      target: [[-100, 40, 300], [-80, 50, 310], [-40, 55, 320], [0, 55, 330], [40, 50, 330]],
      fov: 38
    }
  ];

  /* ---------------------------------------------------------- misc anchors */
  L.FERRY_PIERS = {
    central: { x: -164, z: 274, w: 54, d: 46, rot: 0, name: '中環天星碼頭' },
    wanchai: { x: 250, z: 290, w: 40, d: 40, rot: 0, name: '灣仔渡輪碼頭' },
    tst: { x: -200, z: -294, w: 46, d: 56, rot: 0, name: '尖沙咀天星碼頭' },
    hunghom: { x: 352, z: -364, w: 40, d: 56, rot: 0, name: '紅磡碼頭' },
    ocean: { x: -438, z: -276, w: 52, d: 66, rot: 0, name: '海運大廈碼頭' },
    kaitak: { x: 980, z: -255, w: 46, d: 26, rot: 0.6, name: '啟德郵輪碼頭' }
  };
  L.DISTRICT_LABELS = [
    { x: -980, z: 380, name: '堅尼地城' }, { x: -600, z: 400, name: '西營盤' },
    { x: -250, z: 390, name: '中環' }, { x: 60, z: 400, name: '金鐘' },
    { x: 300, z: 400, name: '灣仔' }, { x: 560, z: 400, name: '銅鑼灣' },
    { x: 850, z: 390, name: '北角' }, { x: 1100, z: 400, name: '鰂魚涌' },
    { x: 1450, z: 440, name: '筲箕灣' }, { x: 1800, z: 500, name: '柴灣' },
    { x: -250, z: 640, name: '山頂' },
    { x: -1000, z: -380, name: '西九文化區' }, { x: -380, z: -360, name: '尖沙咀' },
    { x: -250, z: -620, name: '油麻地' }, { x: 60, z: -820, name: '旺角' },
    { x: 380, z: -380, name: '紅磡' }, { x: 900, z: -340, name: '啟德' },
    { x: 1450, z: -500, name: '觀塘' }, { x: -170, z: -880, name: '獅子山' }
  ];

  /* ------------------------------------------------------------ utilities */
  L.samplePolyline = function (pts, t) {
    if (pts.length === 1) return [pts[0][0], pts[0][1]];
    var total = 0, lens = [], i;
    for (i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
      var l = Math.sqrt(dx * dx + dz * dz);
      lens.push(l); total += l;
    }
    var d = U.clamp(t, 0, 1) * total, acc = 0;
    for (i = 0; i < lens.length; i++) {
      if (acc + lens[i] >= d) {
        var f = (d - acc) / (lens[i] || 1);
        return [U.lerp(pts[i][0], pts[i + 1][0], f), U.lerp(pts[i][1], pts[i + 1][1], f)];
      }
      acc += lens[i];
    }
    return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  };
  L.polylineLength = function (pts) {
    var total = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
      total += Math.sqrt(dx * dx + dz * dz);
    }
    return total;
  };
  L.polylinePointAtDistance = function (pts, d) {
    var total = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
      var l = Math.sqrt(dx * dx + dz * dz);
      if (total + l >= d) {
        var f = (d - total) / (l || 1);
        return { x: U.lerp(pts[i][0], pts[i + 1][0], f), z: U.lerp(pts[i][1], pts[i + 1][1], f), dx: dx / (l || 1), dz: dz / (l || 1), seg: i };
      }
      total += l;
    }
    var last = pts[pts.length - 1], prev = pts[pts.length - 2];
    var lx = last[0] - prev[0], lz = last[1] - prev[1], ll = Math.sqrt(lx * lx + lz * lz) || 1;
    return { x: last[0], z: last[1], dx: lx / ll, dz: lz / ll, seg: pts.length - 2 };
  };
  L.isOnMainRoad = function (x, z) {
    for (var i = 0; i < L.ROADS.length; i++) {
      var r = L.ROADS[i];
      if (Math.abs(x - r.pts[0][0]) > 2500) continue;
      if (U.distToPolyline(x, z, r.pts) < r.width * 0.5 + 2) return r;
    }
    return null;
  };
  L.POI_BY_ID = {};
  L.POIS.forEach(function (p) { L.POI_BY_ID[p.id] = p; });
  L.LANDMARK_STATS = { total: Object.keys(L.LANDMARKS).length };

  HK.Layout = L;
})();
