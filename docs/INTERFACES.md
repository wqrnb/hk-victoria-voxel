# HK VOXEL HARBOUR — Interface Contract & Art Direction

> Read this before touching code. The app is intentionally **zero-dependency, classic-script JavaScript** so the final deliverable can be a single HTML file that runs from `file://`.
> No ES modules, no npm packages, no external textures/fonts/network at runtime. Three.js r149 is vendored at `vendor/three.min.js`.

## World facts

- **1 world unit = 1 voxel = 2 metres.** Sea level `y = 0`.
- Axes: `+X` east, `-Z` north (Kowloon), `+Z` south (Hong Kong Island). `+Y` up.
- World bounds `HK.WORLD`: x `[-1500,1500]`, z `[-1000,1000]`, peaks up to y≈300 (Victoria Peak 276 units = 552 m).
- Victoria Harbour water sits between the Kowloon north shore (`z ≈ -320…-250`) and the HK Island south shore (`z ≈ +290…+380`) plus inlets/typhoon shelters/runway cuts.
- Camera far plane `HK.CAMERA_FAR = 16000`, scene fog fades the world edge and distant New Territories ranges.
- Runtime state lives in `HK.app.state` (see below). Render loop in `js/main.js`.

## Renderer setup (owned by main.js)

```js
renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance', stencil:false, preserveDrawingBuffer:true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// main sets renderer.setPixelRatio() from HK.QUALITY[name].pixelRatio
```

Post-processing (**HK.Post**) may render the scene into offscreen targets; in that case it is responsible for tone-mapping/encoding/presenting the final frame. Main loop calls `post.render(dt)` when a post object exists, otherwise `renderer.render(scene, camera)`.
`HK.Post` may adjust `renderer.toneMappingExposure` per time-of-day/weather.

## Load order (index.html script tags)

```
vendor/three.min.js
js/core.js
js/layout.js
js/terrain.js
js/buildings.js
js/landmarkkit.js
js/landmarks-hk.js
js/landmarks-kl.js
js/props.js
js/sky.js
js/water.js
js/post.js
js/life.js
js/controls.js
js/ui.js
js/audio.js
js/main.js
```
UI teammate may edit `index.html` freely **but keep this script order intact** and do not add dependencies. The production build inlines CSS + all scripts into one HTML.

Tools: `node tools/shot.mjs --url <path-or-url> --out tmp/x.png --w 1600 --h 900 --ready "window.__READY__" --wait 1500`. It drives headless Chrome (SwiftShader WebGL2), prints console/errors, and writes a PNG. Use it for visual iteration; keep test QA pages under `qa/`.

---

## HK.Sky (owner: atmosphere teammate)

`js/sky.js`

```js
HK.Sky = {
  create(opts) -> sky
}
opts = { scene, renderer, quality }        // adds its objects/lights/fog to scene itself

sky = {
  env,                    // see below, updated every frame, read by Water/Post/main
  update(dt, state),      // state = HK.app.state (timeHours, weather, paused, mode, photo)
  setQuality(q),
  setTime(hours),         // optional direct set
  setWeather(w),
  setShadowFocus(x, z, radius),   // shadow camera follows camera focus (units); radius 250..2600
  sunLight, moonLight, hemiLight,  // THREE lights (sun casts shadows)
  group,
  dispose()
}
```

Requirements:
- Sky dome/gradient with sun disc, moon, stars, moon glow, drifting layered clouds (procedural FBM in shader or geometry), horizon haze, city-glow on the underside of clouds at night.
- Hong Kong humid atmosphere: gold at sunset, teal/indigo blue hour, warm sodium glow at night, pale haze midday.
- Lighting rig: one shadow-casting directional sun, one moon directional (no shadow or faint), hemisphere ambient. Shadow camera must be sized from `setShadowFocus` and follow the focus point; quality tier chooses map size (`HK.QUALITY[q].shadowMap`). Handle time-of-day sun colours/intensities convincingly (no black shadows — sky fill).
- Weather: `clear | mist | rain`. Mist increases haze, reduces sun, softens horizon. Rain adds animated rain streaks around the camera, darkening, ripples/puddles mood (water handled by Water), optional distant lightning flash in rain after dark.
- `state.night` must be computed by Sky each update and stored in `sky.env.night` and `HK.app.state.night` (0 day, 1 full night). Use smooth transitions around sunrise/sunset.
- Update `scene.fog` (THREE.FogExp2 or Fog) and `scene.background`/sky dome; sky must never rely on external textures.
- `HK.Sky.env` contract (THREE.Color/Vector3 objects, updated in place):
  `{ sunDir, moonDir, sunColor, zenithColor, horizonColor, cloudColor, fogColor, cityGlow, night, timeHours, exposure, weather, sunIntensity, moonIntensity }`.

## HK.Water (owner: atmosphere teammate)

`js/water.js`

```js
HK.Water = { create(opts) -> water }
opts = { scene, renderer, quality }

water = {
  mesh,                        // added to scene by Water itself
  setShoreMask(canvasOrTexture, bounds),  // mask: R=land, G=shore distance (0..1 over ~60 units)
  update(dt, state, focus, env),
  setQuality(q),
  uniforms,
  addWake? (optional)
  dispose()
}
```

Requirements:
- Big water plane covering x`[-2400,2400]`, z`[-1600,1600]`, y=0, high-quality water shader: animated wave normals, fresnel sky reflection from `env`, sun/moon glitter path, depth-graded harbour colours (Victoria Harbour jade-teal by day, ink + neon reflections at night), shore foam driven by the mask, subtle foam sparkle.
- Night: broken vertical streaks of city light reflected on the water; buildings/neon colours may be approximated with a skyline glow band + noise; must look cinematic from high and from eye level.
- Weather modifiers: rain ripples + dimmer reflections, mist flattens waves, storm choppier.
- No reflections of the actual geometry required (performance), but the impression of the skyline reflection is essential at night.
- `update()` receives the camera/focus position to keep wave detail centred; use cheap fragment shader.

## HK.Post (owner: atmosphere teammate)

`js/post.js`

```js
HK.Post = { create(opts) -> post }
opts = { renderer, scene, camera, quality, env }

post = {
  render(dt),
  resize(w, h, pixelRatio),
  setQuality(q),
  setEnv(env),
  setCinematic(bool),
  setPhoto(bool),
  uniforms,
  dispose()
}
```

Requirements:
- WebGL2 HDR-ish pipeline: render scene to target (MSAA samples from quality, fall back gracefully), threshold bloom (multi-mip, quality-scaled), composite pass with ACES-style tone curve applied consistently, subtle teal-shadow/warm-highlight grade, vignette, fine film grain, very subtle chromatic aberration, optional letterbox-ish darkening for cinematic mode, photo mode cleaner grade.
- Good performance: no more than ~8 fullscreen passes at high; bloom at half res. Handle pixel ratio and resize.
- Must present correct colours: the canvas should look identical in spirit whether bloom is on or off; avoid washed out grey. Renderer has tone mapping ACES + sRGB output. If you choose to disable renderer tone mapping inside Post, implement an equivalent filmic curve in the final pass and document it.
- Provide `setEnv` values use `env.night`, `env.exposure`, `env.weather`.

## HK.UI (owner: UI teammate)

`js/ui.js`, `js/audio.js`, `css/style.css`, `index.html`

```js
HK.UI = {
  initLoader(),                 // called very early (DOM exists); shows cinematic loader
  progress(pct, label),         // 0..100 + bilingual status label
  init(app),                    // after world ready: build UI, fade loader, show intro
  update(dt),                   // optional per-frame HUD updates
  toast(msg, opts)
}
```

`app` (created by main) gives:

```js
app = {
  state,                        // HK.DEFAULT_STATE shape, mutated by main/controls
  scene, camera, renderer, container,
  meta: { version, pois, districts, landmarkCount, credits },
  actions: {
    startExperience(), setMode(mode,opts), setTime(hours), setTimeAuto(bool),
    setTimeSpeed(v), setWeather(w), setQuality(q), setLayer(name,bool),
    setAudio(bool), teleport(poiId), togglePhoto(), screenshot(), togglePause(),
    nextCinematic(), prevCinematic(), resetCamera(), requestPointerLock()
  },
  events,                       // HK.Emitter: 'mode','time','quality','weather','fps','player','toast','photo','ready'
  util: HK.Util
}
```

UI must deliver:
- **Loader** (visible immediately): deep-ink background with a slowly assembling voxel skyline silhouette / scanning grid, bilingual title `維多利亞港` / `VICTORIA HARBOUR`, subtitle `體素數字孿生 · VOXEL DIGITAL TWIN`, progress bar with %, rotating status lines (`正在重塑海岸線…`, `正在點亮中環…`, etc.). Must be beautiful and not block rendering.
- **Title / intro**: after loading, an elegant title card over the live cinematic render: big serif Chinese title, English spaced caps, hint `拖曳探索 · 滾輪縮放`, primary button `進入沙盤 / ENTER SANDBOX`, secondary `直接漫遊 / WALK THE CITY` maybe. On click: call `app.actions.startExperience()`; hide intro with cinematic transition.
- **Top bar**: brand mark (small), live clock derived from `state.timeHours` (`HH:MM` 24h), weather label bilingual, quality badge, FPS, audio toggle, help button.
- **Mode dock** (bottom center): `沙盤 / SAND TABLE`, `漫遊 / WALK`, `電影 / CINEMA`; active state with glowing underline; numeric hotkeys; responsive.
- **Side panel** (left, collapsible): 
  - time strip with gradient day continuum, 7 presets, play/pause auto cycle;
  - weather selector `晴朗 CLEAR / 薄霧 MIST / 雨夜 RAIN`;
  - quality selector `低/中/高/電影`;
  - layer toggles `車流 TRAFFIC`, `渡輪 FERRIES`, `人群 CROWD`, `霓虹 NEON`, `地標 LABELS`;
  - POI list (scrollable) with bilingual names + district + distance, click = fly/teleport.
- **FPS HUD**: crosshair, compass strip/heading, district + altitude + clock, subtle hint bar (`WASD 移動 · SHIFT 奔跑 · SPACE 跳躍 · F 飛行 · M 地圖 · ESC 暫停`), photo-mode hotkey.
- **Cinematic UI**: letterbox feel (CSS bars optional; Post also grades), shot title lower-left (`01 — 維港晨曦 / HARBOUR DAWN`), progress ticks, `下一鏡 / NEXT` button, `ESC 退出`.
- **Help modal** with all shortcuts, short context about the build, credits.
- **Toasts** for actions (`已切換至第一人稱`, `畫質：高`, etc.). Screenshot flash + saves a PNG via renderer canvas `toDataURL`.
- **Audio** (`js/audio.js`): WebAudio procedural ambience only (no files): harbour waves, city rumble, distant ferry horn, gull calls, neon hum; master gain, mute toggle, smooth fade; starts only after a user gesture. Keep CPU tiny. Expose `HK.Audio.setEnabled(bool)`, `HK.Audio.update(state)`, `HK.Audio.click()`.
- **Typography**: system fonts only. Display: serif stack (`"Noto Serif TC","Songti TC","PMingLiU",Georgia,serif`); UI sans (`"Segoe UI","Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif`); data mono (`"Consolas","SFMono-Regular",monospace`). Bilingual Traditional Chinese + English. Avoid generic dashboards: use generous negative space, thin hairlines, filmic letter spacing, layered translucent ink panels, restrained neon accents.
- **Palette tokens**: ink `#05070c`, ink2 `rgba(10,16,24,.72)`, paper `#eae6dc`, muted `#9aa4ad`, cyan `#3de0ff`, magenta `#ff4fa3`, amber `#ffb547`, red `#ff4b3e`.
- Performance: no expensive CSS blur storms; animations on transform/opacity; no external libs.
- Must remain usable down to 1280×720 and degrade gracefully on smaller widths; pointer-lock banner when entering FPS.
- Provide a mock page `qa/ui-demo.html` using stub `app` data so the UI can be reviewed standalone, and snapshot it with `tools/shot.mjs`.

## Art direction (shared)

- Reference feel: *Blade Runner 2049* haze + *GTA V* readability + *Teardown* voxel tactility + real Hong Kong geography. Cinematic, humid, neon-warm, deep teal shadows.
- Default view: golden hour from above Kowloon looking south-west across Victoria Harbour to the Hong Kong Island skyline with Victoria Peak behind; sun low in the west, haze layers, long shadows, water glitter.
- Voxel language: crisp stepped masses, 2 m facade cells, merged flat faces (no visible per-voxel grid lines), chunky skyline silhouettes, tiny blocky props at street level. Avoid Minecraft look: no grass blocks, no uniform cube lattices, rich colours, PBR-ish shading.
- Landmarks must be recognisable: Two IFC, Bank of China Tower, HSBC, Central Plaza, The Center, Jardine House, HKCEC, IFC, ICC, M+, Xiqu Centre, Palace Museum, TST Clock Tower, Cultural Centre, Space Museum, Peninsula, Kai Tak Cruise Terminal, Peak Tower, Observation Wheel, Star Ferry, etc.
- Camera never goes below the water plane; no visible world edge (fog/mountains).
