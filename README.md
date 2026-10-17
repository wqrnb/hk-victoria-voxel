# 維多利亞港 · VOXEL VICTORIA HARBOUR
### 香港維多利亞港體素數字沙盤 — 藝術級、遊戲級的維港體素世界

A hand-crafted voxel digital twin of Hong Kong's Victoria Harbour: both shores,
Central's iconic skyline, Kowloon's neon canyons, the Peak, the harbour itself,
cinematic golden-hour lighting, living traffic and ferries, and a fully
walkable first-person mode. Built with a bespoke voxel engine on top of
Three.js r149 — no build step, no network, no external assets.

> **單一檔案 (Single file)**: `dist/VictoriaHarbour.html` — double click.
> Works offline from `file://`. Everything (shaders, textures, signage, audio) is procedural.

---

## Quick start 快速開始

| what | how |
| --- | --- |
| **Play the finished sandbox** | double-click `dist/VictoriaHarbour.html` (or run `start.bat`) |
| Rebuild the single file | `node tools/build.mjs` |
| Preview the source version | `start-server.bat` → http://127.0.0.1:8000/ |
| Headless screenshot / QA | `node tools/shot.mjs --url "dist/VictoriaHarbour.html?qa=1&quality=medium&time=18.6" --out tmp/shot.png --w 1600 --h 900 --ready "window.__READY__"` |

Use a desktop Chrome/Edge (WebGL2) with a dedicated GPU for the best experience.
Quality auto-selects **高 (HIGH)** on desktop; use the quality selector for **電影 (CINEMA/ULTRA)**.

---

## Experience 體驗

### 1. 沙盤 · SAND TABLE (orbit)
Cinematic aerial camera over the harbour. Drag to orbit, scroll to zoom,
right-drag / Shift-drag to pan, double-click to reset.
The left panel controls time of day, weather, quality, layers and 13 POIs
(中環, 尖沙咀, 太平山頂, 西九文化區, 會展, 銅鑼灣避風塘, 啟德, 紅磡, 海港城, 怪獸大廈…).

### 2. 漫遊 · WALK (first person)
`WASD` move · `Shift` sprint · `Space` jump · `F` fly/drone · `C` crouch ·
mouse look (click to lock). Collisions against terrain, buildings, piers and
promenade furniture. Start at the Avenue of Stars promenade with the HK Island
skyline across the water, or teleport to any walk POI.

### 3. 電影 · CINEMA
Seven scripted camera journeys through the Central skyline,
a Star Ferry crossing, Nathan Road neon, the Peak, Kai Tak at dusk, West
Kowloon culture and the night harbour. `N` next shot, `←/→` prev/next, `Esc` exit.

### Environment 環境
- 一日光影 : 7 time presets + continuous slider + auto cycle (0.06–1.0 h/s)
- 天氣 : clear / mist / rain (rain brings wet reflective water, darker grade, rain streaks)
- Night brings lit windows, neon signage, street-lamp pools, headlights and
  *幻彩詠香江 A Symphony of Lights* (rooftop laser beams + fireworks over the harbour)
- Photo mode (`P`), PNG capture, procedural ambience audio (waves, city rumble, gulls, ferry horns, neon hum)

---

## World 世界

- **Scale**: 4 km × 2 km of harbour and both shores, 1 voxel = 2 m, sea level y=0.
- **Geography**: real Victoria Harbour topology — Kowloon / Tsim Sha Tsui / Hung Hom Bay /
  Kai Tak runway spur / Kwun Tong on the north; Central / Admiralty / Wan Chai /
  Causeway Bay typhoon shelter / Quarry Bay / Victoria Peak and the southern ridges on the south.
- **Architecture**: 4,000+ procedural voxel buildings with a custom facade shader
  (per-style windows, mullions, spandrels, shopfronts, rooftop clutter, LED media walls)
  plus 50+ hand-authored landmarks:
  - *HK Island*: Two IFC, Bank of China Tower, HSBC, Cheung Kong Center, Jardine House,
    The Center, Exchange Square, Lippo Centre, Pacific Place, Tamar CGO, HKCEC,
    Central Plaza, Hopewell Centre, Times Square, One Island East, Monster Building,
    Central piers, Observation Wheel, Peak Tower & Peak Tram.
  - *Kowloon*: ICC (West Kowloon), M+, Xiqu Centre, Palace Museum, Kowloon Station,
    TST Cultural Centre / Clock Tower / Space Museum / Museum of Art / Peninsula /
    1881 / Chungking Mansions / K11 Musea / Rosewood, Star Ferry pier, Ocean Terminal,
    Hung Hom Coliseum, Whampoa, Kai Tak Cruise Terminal, Kai Tak Sports Park.
- **Street life**: 570 street lamps, 3,800 trees, 440 railing runs, 400+ procedural neon
  signs (custom canvas atlas), animated billboards, market stalls on Temple Street and
  Ladies Market, construction cranes, MTR entrances, the Peak Tram, Bruce Lee statue,
  Green Island lighthouse; traffic fleets, trams, Star Ferries, Aqua Luna junk, cargo
  barges, yachts, pedestrians, seagulls and a patrolling helicopter.
- **Atmosphere**: dynamic sun/moon path, procedural clouds & stars, humid haze, rain,
  shore foam, sun glitter, neon water reflections, ACES filmic grading, bloom, grain,
  vignette and subtle chromatic aberration.

---

## Technical notes

- Zero dependencies. Classic `<script>` files, Three.js r149 vendored.
- Custom voxel meshing: greedy-merged terrain top faces + merged wall runs; city
  buildings merged per 480-unit chunk; custom facade material with per-vertex
  `aUv / aStyle / aSeed / aGlow` driving procedural windows and night lighting.
- HDR-ish post pipeline: linear scene render (MSAA half-float) → bright pass →
  dual-filter bloom → ACES + sRGB + grade. Renderer stays `NoToneMapping/LinearEncoding`.
- Debug/QA URL parameters: `?qa=1&quality=low|medium|high|ultra&time=18.62&weather=clear|mist|rain&mode=orbit|fps|cinematic&poi=<id>&cam=x,y,z&look=x,y,z&shot=0..6`
  (QA hides the HUD and exposes `window.__READY__`, `window.__INFO__`, `window.HK.app`).

### File map

```
index.html                  source shell (classic script order)
css/style.css               full cinematic HUD / loader / intro / UI
js/core.js                  namespace, math, noise, palette, batch, quality tiers
js/layout.js                geography: coasts, districts, roads, anchors, POIs, cinematic shots
js/terrain.js               heightfield, land use, roads, greedy terrain mesh, shoreline mask
js/landmarkkit.js           HK.CityBuilder + HK.Kit + facade material shader
js/buildings.js             procedural city generator
js/landmarks-hk.js          hand-built Hong Kong Island landmarks
js/landmarks-kl.js          hand-built Kowloon landmarks
js/props.js                 lamps, trees, neon atlas, billboards, Peak Tram, street props
js/sky.js                   sky dome, sun/moon, stars, clouds, fog, rain, shadows
js/water.js                 Victoria Harbour water shader
js/post.js                  bloom + ACES + cinematic grade
js/life.js                  traffic, trams, ferries, boats, people, birds, light show
js/controls.js              orbit / first-person collision / cinematic cameras
js/ui.js                    loader, intro, HUD, panels, toasts, screenshots
js/audio.js                 procedural WebAudio ambience
js/main.js                  boot sequence + integration + render loop
tools/build.mjs             single-file builder
tools/shot.mjs              headless Chrome screenshot/QA driver
tools/audit-layout.mjs      coastline/road/landmark sanity audit
qa/                         standalone QA scenes for terrain/city/atmosphere/UI/life
dist/VictoriaHarbour.html   final self-contained deliverable
```

### QA
Independent final QA (headless Chrome, offline ile://, 94 job records) lives in docs/FINALQA.md: PASS on boot, all modes/deep links/UI states, zero console errors on the frozen build; 4,294 buildings / 10,654 colliders / 114 landmarks / 34 merged city chunks. Final screenshots are in screenshots/.

### Credits
Procedural voxel world, architecture, signage and UI built for this project.
Geography, landmarks and street layouts are artistic interpretations of Hong Kong.
