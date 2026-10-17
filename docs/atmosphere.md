# HK VOXEL HARBOUR — ATMOSPHERE / WATER / POST

Owner: **skyward** · files: `js/sky.js`, `js/water.js`, `js/post.js`, `qa/atmo.html`
Contract: `docs/INTERFACES.md` (HK.Sky / HK.Water / HK.Post). Classic scripts only,
Three.js r149 UMD, zero external assets — every texture in this subsystem is generated
procedurally on a 2-D canvas at init time.

---

## 0. TL;DR integration

```js
// once, after the world is built (main.js already does exactly this)
app.sky   = HK.Sky.create({ scene, renderer, quality: state.quality });
app.water = HK.Water.create({ scene, renderer, quality: state.quality });
if (world.shoreMask) app.water.setShoreMask(world.shoreMask.canvas, world.shoreMask.bounds);
app.post  = HK.Post.create({ renderer, scene, camera, quality: state.quality, env: app.sky.env });
app.post.resize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());

// every frame (order matters — lights/fog must be fresh before post renders)
app.sky.update(dt, state);
var env = app.sky.env;
app.sky.setShadowFocus(focus.x, focus.z, focus.radius);
app.water.update(dt, state, focus, env);
app.post.setEnv(env);
app.post.setPhoto(!!state.photo);
app.post.setCinematic(state.mode === 'cinematic');
app.post.render(dt);              // instead of renderer.render(scene, camera)
```

Renderer setup expected by this subsystem (main.js already matches):

```js
renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance',
                                     stencil:false, preserveDrawingBuffer:true });
// Post takes over tone mapping internally:
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputEncoding = THREE.LinearEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

`HK.Post` re-applies `NoToneMapping` / `LinearEncoding` defensively every frame and
restores the previous renderer state in `dispose()` / `setEnabled(false)`.

Optional: `renderer.info.autoReset = false; renderer.info.reset()` at frame start if the HUD
should show total draws (Post issues ~9 passes: 1 scene + bright + (mips-1) downs + (mips-1)
ups + composite; at high ≈ 12).

---

## 1. Colour-space contract (IMPORTANT)

The whole pipeline is **linear light** until the last pass of HK.Post.

* `HK.Util.hexRgb(hex)` returns raw sRGB 0..1. Sky/Water convert authored hex with
  `pow(c, 2.2)` (`linHex`) at module load — **all colours in `env` are LINEAR**:
  `sunColor, moonColor, zenithColor, horizonColor, horizonCool, cloudColor, fogColor,
  cityGlow, waterDeep, waterShallow, foamColor`.
* Custom materials (sky dome, water, rain, QA city) write **linear HDR radiance**; values
  above 1.0 are legal and are what bloom picks up (sun disc ≈ 10–20, neon ≈ 2–3).
* `HK.Post` renders the scene into a half-float (fallback byte) MSAA target and applies the
  **exact r149 ACESFilmicToneMapping math + sRGB encode** in its composite pass. A built-in
  material therefore looks the same with Post on or off — only bloom/grade/vignette differ.
* Fog: `scene.fog` is `THREE.FogExp2`; its colour is set from the linear `env.fogColor`, so
  built-in materials fade into the same linear haze the sky/water shaders use. Change of fog
  object/colour is picked up by three.js every frame (uniform refresh on material switch).

---

## 2. `HK.Sky` — `js/sky.js`

```js
var sky = HK.Sky.create({ scene, renderer, quality });
sky.update(dt, state)          // state = HK.app.state; writes state.night
sky.setTime(hours)             // direct override (kept until next update)
sky.setWeather('clear'|'mist'|'rain')
sky.setShadowFocus(x, z, radius)   // radius clamped 250..2600
sky.setQuality(q)              // shadow map size + cloud octaves + rain count
sky.sunLight  sky.moonLight  sky.hemiLight  sky.ambientLight  sky.group  sky.env  sky.dispose()
HK.Sky.env                     // last created env (same object as sky.env)
```

### env contract (THREE objects, mutated in place)

| field | type | meaning |
|---|---|---|
| `sunDir`, `moonDir` | Vector3 | unit vector **from the world towards** the body |
| `sunColor`, `moonColor` | Color | linear light colour |
| `zenithColor`, `horizonColor`, `horizonCool`, `cloudColor`, `fogColor`, `cityGlow` | Color | linear sky palette |
| `waterDeep`, `waterShallow`, `foamColor` | Color | linear water palette consumed by Water |
| `night` | number | 0 day … 1 full night (also written to `state.night`) |
| `timeHours`, `weather` | number / string | current state |
| `exposure` | number | linear exposure multiplier used by Post (≈0.96 day … 1.45 night) |
| `sunIntensity`, `moonIntensity` | number | directional light intensities |
| `fogDensity` | number | FogExp2 density (0.00024 clear … 0.00088 mist … 0.00052 rain, + night) |
| `mist`, `rain` | number | smoothed 0..1 weather amounts (useful for cross-fades) |
| `sunAlt`, `sunAz` | degrees | solar altitude / compass azimuth |
| `sunWarmth` | number | 0..1 how warm the horizon is towards the sun |
| `flash` | number | lightning flash envelope 0..1 |
| `colorsLinear` | set by main | `true` (main.js adds this; Buildings expects it) |

`env.weather` follows `state.weather`. Weather transitions are smoothed inside Sky over
~0.5 s (`env.mist` / `env.rain`), so water/post can cross-fade for free.

### Sky model

* Solar model tuned for **Hong Kong mid-October**: sunrise 05:57, sunset 18:51, max
  altitude 57°, azimuth sweep 94° → 266° (rises east, sets just north of west).
  App presets line up nicely: golden 18.55 (sun +6°), blue 19.35 (sun −7°), night 21.4.
* Moon is artistic: roughly anti-solar height (`−sunAlt·0.62`) and `sunAz−70°`, so it sits
  in the harbour view at night instead of formally opposite the sun. Documented in code.
* Palette is a table of **9 stops keyed by sun altitude** (70°…−70°) interpolated with a
  smoothstep. Each stop carries zenith / horizon / cool-horizon / haze / cloud lit / cloud
  shade / fog / city glow / water deep / water shallow / foam / sun colours plus
  `sunI, scatter, hemi, exposure, moonI, cloudCover`.
* The dome shader (one `SphereGeometry(9000,32,20)`, BackSide, no depth write, drawn first)
  computes per-fragment: vertical gradient (humid, compressed near horizon), azimuth-aware
  warm/cool horizon, Mie-ish forward scattering + HDR sun disc, moon disc + halo,
  procedural star field (twinkle, moon/cloud/rain masking), two-layer FBM clouds with
  sun-side lighting + night city-glow underlight + lightning strobe, cloud occlusion of
  sun/moon, below-horizon haze, night city-glow band, lightning wash.
* Clouds drift with time; quality controls FBM octaves (`HK.QUALITY[q].cloudDetail`).
* Rain: GPU-wrapped `LineSegments` streaks around the camera in the vertex shader (no JS
  camera dependency, ~1000/1900/2600 streaks for low/medium/high+). Additive, colour lerps
  from pale daylight to warm city-glow at night.
* Lightning: optional, only in `rain` when `night > 0.3`; double-stroke envelope adds
  `env.flash` which the shader, hemisphere light and Water all read. Disable for
  deterministic QA screenshots with `?lightning=0`.
* Lights: shadow-casting `DirectionalLight` sun (map size from `HK.QUALITY[q].shadowMap`,
  ortho extents/near/far derived from `setShadowFocus`, follows the focus, disabled when the
  sun is below the horizon), non-shadow `DirectionalLight` moon, `HemisphereLight` sky fill.
  Nothing ever goes pitch black thanks to the hemisphere fill. An extra non-shadowing
  AmbientLight (sky.ambientLight, warm horizon tint) adds a gentle golden-hour bounce so
  shadowed facades keep colour; its intensity peaks at low sun and is faint/cool at night.
  Golden-hour sun azimuth is WNW (~288°) so HK Island's harbour-facing north-west facades catch
  warm light for the default TST→Central postcard view.
* `scene.fog = FogExp2`, `scene.background` = darkened fog colour (dome covers everything,
  the background only matters for safety).

---

## 3. `HK.Water` — `js/water.js`

```js
var water = HK.Water.create({ scene, renderer, quality });
water.update(dt, state, focus, env);      // focus: camera Vector3 / {x,z} / {position}
water.setShoreMask(canvasOrTexture, { minX, maxX, minZ, maxZ }, opts?)
water.setQuality(q); water.uniforms; water.mesh; water.dispose()
```

Plane: 4800 × 3200 at y = 0, one merged mesh, custom `ShaderMaterial` (opaque, linear HDR).

### Procedural assets (generated once at init, no external files)

* **Normal map** 256²: sum of 60 integer-frequency waves → seamless tiling normal map
  (`LinearMipmapLinear`, max anisotropy). Three samples at different scales/rotations.
* **Noise map** 256² with **R = FBM A**, **G = FBM B**, **B = grain**. R/G drive a
  two-dimensional UV domain warp that hides tiling; R also breaks glitter/foam; G is spare.
* **Skyline light field** 1024×4: wrapped 1-D city light ring — warm window speckle,
  cool office glow, 16 coloured neon columns around the horizon ring (cyan/pink/magenta/
  amber/red/green/white) clustered where Hong Kong Island / Kowloon sit in world azimuth.
* **Shore mask**: external (see below). The shader now derives the shoreline from a
  multi-tap blurred land mask instead of the 8-bit distance channels, so foam is irregular
  salt-and-pepper with no circumferential contour banding or 'painted lane' stripes.

### Shading model

`fresnel` mix of jade/ink body colour and analytic sky reflection
(`horizonCool ↔ horizon` toward the sun, `zenith`, fog below horizon), sun/moon reflection
halo, broken sun-glitter path (sparkle noise + `pow(dot(R,sun),90)` with raw-normal
capture so the path survives distance), night **vertical neon streaks** sampled from the
skyline light field by the *unperturbed* reflection azimuth (stable streaks, not boiling
noise) with noise breakup, shore foam from the mask, rain ripples/darkening, mist flattening,
lightning flash on the surface, and `FogExp2`-matching haze that forces full fog at the plane
edge so the world edge never shows.

### Shore mask conventions (auto-detected)

`bounds` = world rect covered by the mask; canvas row 0 corresponds to `minZ`
(the module forces `flipY = false` for canvas masks).

* **Default contract** (docs/INTERFACES.md, QA page): `R = land`, `G = shore distance`
  (0 at shoreline → 1 ≈ 60 world units offshore), B unused.
* **layout/terrain.js mask** is also accepted: `R = land`, `G = shore proximity`
  (255 near shore), `B = offshore distance` (0 at shore → 1 far). `setShoreMask` samples the
  canvas once at init (≤48×48 probe) and auto-selects B with a 2.2 scale when B carries the
  distance. You can override with the 3rd argument:
  `water.setShoreMask(canvas, bounds, { shoreChannel:'g'|'b', shoreScale:1.0 })`.
  This means `main.js`'s existing call with `world.shoreMask` needs no change.

### Weather / time reactivity

Driven entirely from `env`: colours, `sunIntensity`, `moonIntensity`, `night`, `mist`,
`rain`, `flash`, `fogDensity`, `sunDir`/`moonDir`, `sunWarmth`. Glitter is suppressed by
mist/rain, waves flatten in mist and get choppier in rain, fog matches the sky.

---

## 4. `HK.Post` — `js/post.js`

```js
var post = HK.Post.create({ renderer, scene, camera, quality, env });
post.render(dt)            // replaces renderer.render(scene, camera)
post.resize(w, h, pr)      // pass CSS size + renderer.getPixelRatio()
post.setQuality(q)         // rebuild mip chain / MSAA
post.setEnv(env)           // env reference (mutated in place by Sky)
post.setPhoto(bool)        // cleaner photo grade
post.setCinematic(bool)    // stronger vignette/CA/grain/contrast + letterbox-ish darkening
post.uniforms              // composite uniforms (exposure, bloom, grade tints…)
post.bloomEnabled = false  // debug / low-spec switch
post.setEnabled(false)     // bypass Post, restores renderer ACES+sRGB
post.dispose()
```

### Pipeline

1. Scene → **MSAA half-float render target** (`WebGL2`; samples from
   `HK.QUALITY[q].msaa` capped by `MAX_SAMPLES`; capability probe falls back to no-MSAA
   and then byte targets; `sceneRT` is linear HDR).
2. Threshold bright pass (4-tap box, firefly clamp, night lowers the threshold) into the
   first bloom mip (`bloomScale` 0.5 × resolution).
3. `bloomMips` (4/5/6) downsample chain (4-tap) then tent-filtered additive upsample back to
   mip 0 — soft, wide, cheap (2N fullscreen half-res passes total).
4. Composite: `scene·exposure + bloom·amount` → exact r149 ACES → sRGB encode → display-space
   filmic grade (teal shadow / warm highlight split tone, contrast, saturation, gentle toe
   lift) → radial chromatic aberration → vignette → optional letterbox-ish darkening →
   fine animated grain (quality-gated) → value dither against 8-bit sky banding.

Bloom amount/intensity per frame: `0.50 + night·0.26 (+mist 0.07)`, photo ×0.88,
cinematic ×1.10. Threshold ≈ 1.50 − night·0.48 so day bloom is reserved for the sun/glints
and night blooms neon/windows.

Renderer state: Post sets `NoToneMapping` + `LinearEncoding` in `create`, re-asserts them
during render (defensive if other code touches the renderer), restores saved state in
`dispose()`/`setEnabled(false)`. `renderer.toneMappingExposure` is also mirrored from
`env.exposure` for anything that reads it.

### Quality mapping (`HK.QUALITY`)

| knob | low | medium | high | ultra |
|---|---|---|---|---|
| MSAA | 0 | 2 | 4 | 4 |
| bloom mips | 4 | 5 | 6 | 6 |
| grain | off (qcfg.grain) | on | on | on |
| target type | half-float when available | same | same | same |

`resize()` can be omitted in practice: `render()` compares the renderer drawing-buffer size
each frame and rebuilds targets if it changed (still call `resize` for clarity).

---

## 5. QA scene `qa/atmo.html`

Standalone page (vendor/three + core + sky + water + post only) with a cheap merged
placeholder skyline (two shores, stepped hills, ~90 towers + landmark silhouettes, neon
signs, 3 ferries, procedural shore mask), one camera, and URL parameters:

```
qa/atmo.html?quality=low|medium|high|ultra
             &time=18.62            (hours; defaults per view)
             &weather=clear|mist|rain
             &view=postcard|low|night|peak|harbour|sunpath|blue|dawn|midday
             &pr=1                  (renderer pixel ratio, capped 2 — QA defaults to 1)
             &bloom=0               (disable bloom for debugging)
             &hide=water,city,land,sky,neon,rain
             &lightning=0           (deterministic screenshots)
             &hud=0
```

`window.__READY__ = true` after 5 rendered frames; `window.__QA.report()` returns a
machine-readable state snapshot (time, night, sun dirs, exposure, fog, RT type, samples,
draws, triangles, fps). Body font/HUD is QA-only.

### Verified screenshots (`tmp/`)

| file | content |
|---|---|
| `tmp/atmo-golden-hero.png` | 1280×720 high, golden hour postcard (sun over harbour, glitter path, silhouettes) |
| `tmp/atmo-night-hero.png` | 1280×720 high, neon night along the harbour, moon + stars + vertical reflections |
| `tmp/atmo-golden.png` | 960×540 medium golden hour |
| `tmp/atmo-blue.png` | blue hour afterglow, first city lights, stars |
| `tmp/atmo-night.png` | neon night |
| `tmp/atmo-rain.png` | golden hour + rain streaks + wet haze |
| `tmp/atmo-night-rain.png` | night rain, moon, lit city against rain |
| `tmp/atmo-mist.png` | heavy humid mist over the harbour |
| `tmp/atmo-mist-low.png` | eye-level mist view |
| `tmp/atmo-lowview.png` | eye-level golden hour (skyline + water detail) |
| `tmp/atmo-lowq.png` | low quality golden hour |
| `tmp/atmo-night-rain.png`, `tmp/atmo-golden-sunpath.png` | earlier iteration references |

All captured with `node tools/shot.mjs --url qa/atmo.html?... --ready "window.__READY__"
--port <unique>` (unique CDP port — shared 9333 collides with other agents).

---

## 6. Performance notes

* Sky: 1 dome draw, ~2 FBM × `cloudDetail` octaves (2–5), no textures. Rain is 1 line-list
  draw only while raining.
* Water: 1 draw, ~8–11 texture samples + analytic sky (designed cheap for fragment-heavy
  full-screen coverage). Distance LOD: detail normals fade with `farFade`, reflection normals
  are damped to flat at distance, night streak breakup is smoothed with distance.
* Post: scene + bright + (2N−2) half-res mip passes + composite. N=5–6.
* Half-float + MSAA render targets are probed at runtime (`EXT_color_buffer_float`,
  `MAX_SAMPLES`), with graceful fallbacks so SwiftShader / old GPUs still render.
* On headless SwiftShader expect ~10–17 fps at 960×540 for this QA scene (software raster);
  on a real GPU the subsystem is far below typical frame budgets.

## 7. Known limitations / future polish

* No true planar reflections (by design/perf): sunrise/sunset sheen, skyline neon and glitter
  are analytic + procedural. The skyline light ring is a generic HK band, not per-building.
* Sun/moon reflections read best at grazing angles; from a top-down (3000-unit) camera the
  water is mostly body colour + glitter, by design.
* Rain is a camera-centred volume (~240 units); it does not occlude itself against the city.
* No volumetric light shafts / god rays (bloom + fog only). Possible future addition.
* Cloud layer is a 2-D screen-space FBM projection; no cloud shadows on the city.
* The QA placeholder city is intentionally crude — real `layout.js`/`buildings.js` geometry
  is what ships; the atmosphere is tuned to be judged against that.
* `env.exposure` is owned by Sky per time-of-day; if a UI exposure slider is added, scale it
  in Post (`post.uniforms.uExposure.value` is overwritten each frame from env, so add a
  `post.exposureBias` field instead).
* Keyboard/UI integration is not in this subsystem (UI teammate owns it); QA hooks are
  QA-only and should not be relied on by main.

## 8. Tuning cheat-sheet

* Time-of-day look: `STOPS` table + `STOP_EXTRA` at the top of `js/sky.js`
  (altitude-keyed palette, light intensities, exposure, cloud cover, sun warmth).
* Sky contrast: `scat` coefficients in the dome fragment; sun disc size
  `uSunDiscSize`/`uSunDiscI`; haze mix `hz * 0.44`.
* Night look: `cityGlow` stop colour, `uCityGlow` terms in the dome shader, neon field
  texture generator `makeSkylineTexture` + `uNeonStrength` in `js/water.js`.
* Water: `waveStr`/`slope` weights per normal layer, `farFade` LOD distances,
  `glint`/`sparkle` amplitudes, foam thresholds (`shoreBand`/`foam`), `uNeonStrength`.
* Grade: `_updateCompositeStyle()` in `js/post.js` (CA, vignette, grain, letterbox,
  saturation, contrast, split-tone tints) and `uBloom` / bright-pass thresholds in `render()`.
