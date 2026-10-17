// One-shot layout corrections (kept for reproducibility / audit trail).
import fs from 'node:fs';
const P = 'js/layout.js';
let s = fs.readFileSync(P, 'utf8');
let misses = 0;
function rep(from, to) {
  const before = s;
  s = s.replace(from, to);
  if (s === before) { misses++; console.log('MISS:', JSON.stringify(from.slice(0, 90))); }
}

// ---- landmark anchors that were on the water side of their shore ----------
rep(
  "    culturalCentre: { x: -132, z: 0, w: 88, d: 54, h: 17, name: '香港文化中心', en: 'HK CULTURAL CENTRE' },",
  "    culturalCentre: { x: -132, z: -356, w: 88, d: 54, h: 17, name: '香港文化中心', en: 'HK CULTURAL CENTRE' },"
);
rep("clockTower: { x: -182, z: -294,", "clockTower: { x: -182, z: -336,");
rep("spaceMuseum: { x: -20, z: -318,", "spaceMuseum: { x: -20, z: -364,");
rep("museumArt: { x: 50, z: -304,", "museumArt: { x: 50, z: -358,");
rep("k11musea: { x: 130, z: -304,", "k11musea: { x: 130, z: -356,");
rep("avenueStars: { x: 64, z: -276,", "avenueStars: { x: 64, z: -330,");
rep(
  "    starFerryTST: { x: -216, z: -288, w: 34, d: 34, h: 6, name: '尖沙咀天星碼頭', en: 'TSIM SHA TSUI STAR FERRY PIER' },",
  "    starFerryTST: { x: -216, z: -296, w: 34, d: 52, h: 6, name: '尖沙咀天星碼頭', en: 'TSIM SHA TSUI STAR FERRY PIER' },"
);
rep(
  "    oceanTerminal: { x: -438, z: -252, w: 52, d: 58, h: 10, name: '海運大廈', en: 'OCEAN TERMINAL' },",
  "    oceanTerminal: { x: -438, z: -274, w: 52, d: 64, h: 10, name: '海運大廈', en: 'OCEAN TERMINAL' },"
);
rep(
  "    goldenBauhinia: { x: 238, z: 296, w: 14, d: 14, h: 12, name: '金紫荊廣場', en: 'GOLDEN BAUHINIA SQUARE' },",
  "    goldenBauhinia: { x: 236, z: 320, w: 14, d: 14, h: 12, name: '金紫荊廣場', en: 'GOLDEN BAUHINIA SQUARE' },"
);
rep(
  "    kaiTakCruise: { x: 1008, z: -187, w: 46, d: 26, h: 18, name: '啟德郵輪碼頭', en: 'KAI TAK CRUISE TERMINAL' },",
  "    kaiTakCruise: { x: 980, z: -255, w: 46, d: 26, h: 18, name: '啟德郵輪碼頭', en: 'KAI TAK CRUISE TERMINAL' },"
);
rep(
  "    whampoa: { x: 496, z: -292, w: 52, d: 26, h: 24, name: '黃埔號', en: 'THE WHAMPOA' },",
  "    whampoa: { x: 520, z: -392, w: 52, d: 26, h: 24, name: '黃埔號', en: 'THE WHAMPOA' },"
);
rep(
  "    crossTunnel: { x: 336, z: -286, w: 26, d: 26, h: 8, name: '紅磡海底隧道', en: 'CROSS-HARBOUR TUNNEL' },",
  "    crossTunnel: { x: 330, z: -390, w: 26, d: 26, h: 8, name: '紅磡海底隧道', en: 'CROSS-HARBOUR TUNNEL' },"
);
rep("    lionRock: { x: -170, z: -856, w: 1, d: 1, h: 1, name: '獅子山', en: 'LION ROCK' },\n    clockTowerNo: { x: 0, z: 0, w: 1, d: 1, h: 1 }",
  "    lionRock: { x: -170, z: -856, w: 1, d: 1, h: 1, name: '獅子山', en: 'LION ROCK' }");
rep("  // fix the cultural centre waterfront position (north shore is around z=-312)\n  L.LANDMARKS.culturalCentre.z = -308;\n", "");

// ---- regenerated landmark reservations from the corrected anchors ---------
const reserveStart = s.indexOf('  L.RESERVED = [];');
const reserveEnd = s.indexOf('  L.isReserved = function (x, z) {');
if (reserveStart < 0 || reserveEnd < 0 || reserveEnd < reserveStart) { misses++; console.log('MISS: reserved block'); }
else {
  const newReserved = `  L.RESERVED = [];
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

`;
  s = s.slice(0, reserveStart) + newReserved + s.slice(reserveEnd);
}

// ---- roads rerouted inland ------------------------------------------------
rep(
  "{ name: '告士打道', en: 'GLOUCESTER ROAD', width: 14, type: 'main', pts: shoreRoad('hk', 34, 220, 640) },",
  "{ name: '告士打道', en: 'GLOUCESTER ROAD', width: 14, type: 'main', pts: shoreRoad('hk', 34, 220, 390) },\n    { name: '堅拿道天橋', en: 'CANAL ROAD FLYOVER', width: 9, type: 'main', pts: [[390, 398], [405, 430], [420, 470], [445, 495]] },"
);
rep(
  "{ name: '軒尼詩道', en: 'HENNESSY ROAD', width: 12, type: 'main', pts: [[430, 365], [520, 375], [600, 378], [680, 372], [760, 360], [830, 352]] },",
  "{ name: '軒尼詩道', en: 'HENNESSY ROAD', width: 12, type: 'main', pts: [[250, 345], [300, 355], [350, 362], [380, 368], [395, 392], [410, 430], [430, 480], [460, 505], [520, 520], [580, 520], [632, 505], [680, 472], [720, 435], [760, 405], [800, 388], [840, 378]] },"
);
rep(
  "{ name: '高士威道 / 維園道', en: 'CAUSEWAY ROAD', width: 12, type: 'main', pts: [[430, 365], [470, 390], [500, 418], [520, 450], [540, 480], [570, 500]] },",
  "{ name: '高士威道 / 維園道', en: 'CAUSEWAY ROAD', width: 12, type: 'main', pts: [[390, 392], [405, 425], [420, 465], [450, 495], [510, 512], [570, 514], [620, 500], [660, 470], [700, 435]] },"
);
rep(
  "{ name: '梳士巴利道', en: 'SALISBURY ROAD', width: 13, type: 'main', pts: [[-560, -296], [-450, -296], [-330, -294], [-220, -294], [-120, -295], [-20, -296], [80, -298], [160, -302], [230, -310]] },",
  "{ name: '梳士巴利道', en: 'SALISBURY ROAD', width: 13, type: 'main', pts: shoreRoad('kl', 6, -560, 230, 30) },"
);
rep(
  "{ name: '西九龍公路', en: 'WEST KOWLOON HIGHWAY', width: 14, type: 'main', pts: [[-1400, -300], [-1250, -282], [-1100, -268], [-950, -262], [-820, -268], [-720, -282], [-640, -300], [-580, -318]] },",
  "{ name: '西九龍公路', en: 'WEST KOWLOON HIGHWAY', width: 14, type: 'main', pts: shoreRoad('kl', 22, -1400, -580, 40) },"
);
rep(
  "{ name: '紅磡繞道', en: 'HUNG HOM BYPASS', width: 12, type: 'main', pts: [[230, -286], [300, -272], [390, -276], [470, -290], [540, -312], [610, -330]] },",
  "{ name: '紅磡繞道', en: 'HUNG HOM BYPASS', width: 12, type: 'main', pts: shoreRoad('kl', 14, 230, 650, 30) },"
);
rep(
  "{ name: '啟德承啟道', en: 'KAI TAK ROAD', width: 10, type: 'street', pts: [[840, -340], [900, -360], [980, -380], [1060, -400], [1140, -414], [1220, -424]] },",
  "{ name: '啟德承啟道', en: 'KAI TAK ROAD', width: 10, type: 'street', pts: [[820, -400], [900, -420], [1000, -436], [1100, -450], [1200, -466]] },"
);
rep(
  "{ name: '觀塘道', en: 'KWUN TONG ROAD', width: 13, type: 'main', pts: [[1230, -380], [1320, -384], [1420, -394], [1520, -404], [1640, -420], [1760, -438], [1880, -458]] },",
  "{ name: '觀塘道', en: 'KWUN TONG ROAD', width: 13, type: 'main', pts: [[1230, -470], [1320, -480], [1420, -490], [1520, -500], [1640, -515], [1760, -530], [1880, -545]] },"
);
rep("pts: [[-96, -310], [-96, -380],", "pts: [[-96, -326], [-96, -380],");
rep("pts: [[-390, -296], [-390, -380],", "pts: [[-390, -318], [-390, -380],");
rep("pts: [[180, -312], [185, -380],", "pts: [[185, -330], [185, -380],");
rep(
  "pts: [[336, -286], [340, -180], [345, -60], [350, 60], [355, 180], [358, 286], [360, 300]]",
  "pts: [[340, -390], [343, -250], [346, -120], [349, 10], [352, 140], [355, 260], [356, 300]]"
);
rep(
  "{ id: 'yacht', name: '遊艇', en: 'YACHT', spline: [[480, 330], [600, 300], [720, 280], [820, 300], [740, 340], [600, 350], [500, 345]], speed: 2.0, count: 2, color: 'yacht' }",
  "{ id: 'yacht', name: '遊艇', en: 'YACHT', spline: [[480, 330], [600, 300], [720, 280], [820, 300], [750, 310], [620, 350], [500, 345]], speed: 2.0, count: 2, color: 'yacht' }"
);

// ---- ferry pier decks ------------------------------------------------------
const piersStart = s.indexOf('  L.FERRY_PIERS = {');
const piersEnd = s.indexOf('  L.DISTRICT_LABELS = [');
if (piersStart < 0 || piersEnd < 0 || piersEnd < piersStart) { misses++; console.log('MISS: piers block'); }
else {
  const newPiers = `  L.FERRY_PIERS = {
    central: { x: -164, z: 274, w: 54, d: 46, rot: 0, name: '中環天星碼頭' },
    wanchai: { x: 250, z: 290, w: 40, d: 40, rot: 0, name: '灣仔渡輪碼頭' },
    tst: { x: -200, z: -294, w: 46, d: 56, rot: 0, name: '尖沙咀天星碼頭' },
    hunghom: { x: 352, z: -364, w: 40, d: 56, rot: 0, name: '紅磡碼頭' },
    ocean: { x: -438, z: -276, w: 52, d: 66, rot: 0, name: '海運大廈碼頭' },
    kaitak: { x: 980, z: -255, w: 46, d: 26, rot: 0.6, name: '啟德郵輪碼頭' }
  };
`;
  s = s.slice(0, piersStart) + newPiers + s.slice(piersEnd);
}

fs.writeFileSync(P, s);
console.log(misses ? ('DONE with ' + misses + ' misses') : 'DONE all replacements applied');
