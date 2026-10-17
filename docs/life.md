# HK VOXEL HARBOUR — LIFE LAYER (`js/life.js`)

The "living city" layer of the Victoria Harbour digital sandbox: road traffic,
double-decker trams, Star Ferries / Aqua Luna junk / cargo barges / yachts,
pedestrians, seagull flocks, a patrolling helicopter and the nightly
**A Symphony of Lights** laser + firework show.

Classic script (classic `<script>` tag, no modules, no external assets) built on
the vendored THREE r149 UMD at `vendor/three.min.js`.

| File | Purpose |
| --- | --- |
| `js/life.js` | Everything below. Owned by the life layer. |
| `qa/life.html` | Standalone QA harness: three + core + layout + life, placeholder terrain, URL params, `window.__READY__`. |
| `docs/life.md` | This document. |

Units: 1 world unit = 1 voxel = 2 m, sea level `y = 0`, `+X` east, `-Z` north.
Ground height always comes from `HK.Layout.terrainHeight(x, z)` (`< 0` = water).

---

## API (contract)

```js
var life = HK.Life.create({ scene, renderer, quality, layout });
// scene     THREE.Scene (life adds its own group to it; also available as life.group)
// renderer  THREE.WebGLRenderer (used for point-size scaling; optional but recommended)
// quality   'low'|'medium'|'high'|'ultra' (defaults to 'medium'; safe with an unknown value)
// layout    HK.Layout (defaults to the global, pass it explicitly for clarity)

life.update(dt, state, camera, env);   // call every frame, BEFORE render()
life.setQuality(q);                    // 'low'|'medium'|'high'|'ultra'
life.setLayer(name, on);               // traffic|ferries|people|aircraft|show (aliases below)
life.triggerShow();                    // start "A Symphony of Lights" now (if layer on)
life.setNight(v);                      // optional hack/QA override of 0..1 night factor
life.getStats();                       // { traffic, trams, people, boats, birds, lights, wakes, beams, fireworks, night, ... }
life.dispose();                        // removes group from scene + disposes GPU resources
life.group;                            // THREE.Group (already added to scene by create)
```

* `state` = `HK.app.state` (`{ timeHours, night, weather, paused, layers:{traffic,ferries,people,neon,labels,aircraft}, quality }`).
  Missing fields are tolerated; `state` may be omitted entirely.
* `env` = `HK.Sky.env` (`{ night, sunDir, sunColor, fogColor, cityGlow, weather, ... }`).
  `env.night` is authoritative; if it is undefined the layer derives night from
  `state.night` then from `state.timeHours`. It is safe to call while `HK.Sky`
  does not exist yet (`env` undefined).
* `state.paused === true` freezes all motion (values like night/weather/layers
  still update).
* `state.layers.show` (if present) or `state.layers.neon` toggles the light
  show; `life.setLayer('show', bool)` / `life.setLayer('neon', bool)` does the
  same. Traffic/ferries/people/aircraft map 1:1 to `state.layers`.
* `life.group` is added to the scene inside `create()`. If main.js adds it again
  it is harmless (three removes then re-adds the same child).

Recommended main.js wiring:

```js
var life = HK.Life.create({ scene: scene, renderer: renderer, quality: state.quality, layout: HK.Layout });
// in the render loop, after HK.Sky.update()/HK.Water.update():
life.update(dt, state, camera, HK.Sky && HK.Sky.env);
// quality changes:
app.actions.setQuality = function (q) { HK.Life.setQuality(...) } // call life.setQuality(q)
// layer toggle: app.actions.setLayer(name, on) -> life.setLayer(name, on)
```

---

## What it draws

### 1. Road traffic — `js/life.js`
* Vehicles come from every `HK.Layout.ROADS` entry except `type: 'tunnel'` and
  `type: 'track'`; each polyline is resampled every 6 units and split into
  contiguous **land spans** using `terrainHeight()` (water = `-1`). Vehicles only
  ever exist inside those spans, so the layer automatically re-fits when the
  geography owner moves a shoreline or road.
* Five instanced fleets share one vertex-coloured Lambert material:
  sedans (mixed colours), **red HK taxis** (roof sign), double-decker buses,
  green/cream minibuses, light trucks. 1 draw call each.
* Two directions per road, each in its own lane (`road.width * 0.22` from the
  centreline), **left-hand traffic** (Hong Kong convention).
* Per-vehicle speed/phase jitter; positions wrap at span ends (road ends are
  usually far outside the fog / camera focus).
* At night every visible vehicle contributes 2 white headlight + 2 red tail-light
  additive glow points to a single shared `THREE.Points` cloud (1 draw call for
  the whole layer's lights: traffic, boats, helicopter).

### 2. Trams
* 2/3/4/5 trams (low→ultra) on `HK.Layout.TRAM_ROUTE`, both directions, with
  green/cream double-decker bodies, destination plate, trolley pole, end lamps.
* Slow (≈3 u/s), optional dwell of ~2–4 s at stop points spaced ≈215 units,
  wrapping at land-span ends.
* Overhead wire is one merged `LineSegments` draw; catenary poles are one merged
  mesh. Both are built only over land spans.

### 3. Boats
* **Star Ferries** — 5 instanced double-ended ferries (2× central–TST,
  2× Wan Chai–TST, 1× Hung Hom–Wan Chai from `layout.FERRY_ROUTES` counts).
  ~42 units long, green hull/white two-deck saloon, wheelhouses at both ends,
  railings, life rafts. They berth alongside the real pier decks
  (`layout.FERRY_PIERS`) when the route id is one of the three ferry routes and
  otherwise use the route endpoints. Slow bob/roll/pitch, white foam wake.
* **Aqua Luna junk** — red battened sails on `FERRY_ROUTES[junk].spline`, bobbing.
* **Cargo barges** — 3 on the east lane + 2 on the west lane, stacked containers,
  wheelhouse, slow crossing (layout `cargo-*` routes).
* **Yachts** — 2 on the CWB loop.
* **Wakes** — a single dynamic merged mesh (quads) trailing every moving boat,
  additive + fading, updated on CPU (≈117 quads at all times).
* Boat route points are validated with `isWater()`/`shoreDistance()` and nudged
  toward the harbour centreline if a data point is on land or too close to shore
  (protects the yacht loop and any future route edits).
* At night: masthead + deck + red/green navigation lights via the shared point
  cloud; Star Ferries also get three warm "saloon window" glows per vessel and
  cargo barges a couple of deck lights, which read nicely across the water.
* All life meshes share one Lambert material; at night a whisper of emissive
  city-glow (`0.016/0.020/0.030 * night`) is added so vehicles/boats never go
  pitch black before `HK.Sky`'s night fill light is in place.

### 4. Pedestrians
* Up to 120/260/400/560 blocky people (low→ultra) on `HK.Layout.WALK_PATHS`
  (land spans only), walking both directions with lateral offset, speed jitter,
  a per-instance walk bob and clothing-tint variety (12 colours).
* In `weather === 'rain'` only ~38% are drawn and they walk faster; the rest
  "take shelter". 1 instanced draw call.

### 5. Air
* **Seagulls** — 10/20/32/44 birds in 6 flocks over the harbour, one
  `InstancedBufferGeometry` + custom vertex shader: each bird orbits its flock,
  banks with the tangent and flaps its wings (wing-tip vertex attribute). Hidden
  at night (`night > 0.55`) and in rain.
* **Helicopter** — voxel body + spinning main rotor (2 draw calls) on a slow
  elliptical patrol over the harbour; blinking red beacon + white belly light in
  the shared point cloud. `layers.aircraft` toggles birds + helicopter.

### 6. A Symphony of Lights
* Toggled by `layers.show`/`layers.neon`; only visible once `night > 0.12`.
* **Real-show window**: the automatic schedule is gated to wall-clock
  **19.8–24:00 and 00:00–01:30** *and* night > 0.5 (mirrors the real
  20:00–22:00 Symphony of Lights). `life.triggerShow()` is gated to the same
  window; pass `life.triggerShow(true)` to force a show for hero screenshots.
  If the clock jumps into the morning/dawn while a show is running, all
  beams/bursts are cleared immediately and the schedule re-arms for the next
  night window.
* **Laser beams** — 10 instanced crossed tapered quads from the rooftops of
  Two IFC, BOC Tower, Cheung Kong Center, The Center, Central Plaza, One Island
  East, ICC, Rosewood, K11 and Tamar; coloured cyan/magenta/green/amber/violet,
  independently sweeping; fade-in/out envelope. 1 draw call.
* **Fireworks** — GPU point cloud (max 900 particles) simulated on the CPU,
  7 bursts per show over the water between the shores (x ±340 / z ±100 so they
  stay over the harbour and inside typical cinematic framing; 110–185 units up,
  30–46 u/s, gravity + drag, additive twinkle). 1 draw call.
* Auto schedule: once night > 0.5 and the clock is inside the window, a show
  starts ~8–22 s after the layer is created, then every ~40 s;
  `life.triggerShow()` (or `triggerShow(true)` to force) starts one on demand.
  A show lasts 17.5 s (beams ramp 1.6 s, bursts at 2.2/3.5/4.8/6.3/7.6/9.1/10.8 s,
  fade over the last 3 s).

---

## Quality tiers

| tier | traffic | trams | people | birds | shadow casters | notes |
| --- | --- | --- | --- | --- | --- | --- |
| low | 110 | 2 | 120 | 10 | off | 4 beams |
| medium | 220 | 3 | 260 | 20 | on | |
| high | 340 | 4 | 400 | 32 | on | |
| ultra | 460 | 5 | 560 | 44 | on | |

Counts come from `HK.QUALITY[q].traffic` / `.people` (see `js/core.js`); trams,
birds and beam count add their own small tables. Instance buffers are allocated
once at the **ultra** size, so `setQuality()` is a cheap count change — no
geometry rebuilds, no GC churn. Boats keep their layout counts at every tier.

## Draw calls / triangles (life layer only)

Measured in `qa/life.html` (`window.__STATS__`, medium tier, day):

* traffic 5 instanced meshes + light points → **6**
* trams 1 + wire 1 + poles 1 → **3**
* boats: star/junk/cargo/yacht 4 + wakes 1 → **5**
* people **1**, seagulls **1**, helicopter body+rotor **2**
* show: beams **1** + fireworks **1**
* shared light points are counted above (traffic)

≈ **20 draw calls** at day, ≈ **22** at night with the show running
(shadow pass adds one call per casting mesh, ≤ 10, when `renderer.shadowMap` is
enabled — total still well under the ~40 budget). Triangles added by the layer:
≈ **47 k at medium**, ≈ 76 k at high, ≈ 95 k at ultra (dominated by instanced
cars ≈ 110 tri and people ≈ 70 tri each; ferries are only ≈ 170–230 tri each;
wakes add ≈ 230 tri). All meshes are `frustumCulled = false` where they are
instanced/dynamic; the geometry itself is tiny.

## Known limitations / notes for integration

* **Crossing traffic is not collision-aware.** Cargo lanes cross ferry routes,
  ferries cross the junk loop; that mirrors the harbour's visual busyness and is
  intentional at this scale. Boats do not wake-steer.
* Wakes are straight-line approximations behind the current heading (they bend
  only as the boat turns); cheap and fine at harbour scale.
* Traffic wraps at the ends of its land spans. After the layout fix all main
  roads are fully on land, so wraparound happens at the road ends which are
  normally outside the frame/fog. On *partially* wet roads the wrap can be
  visible while geometry is mid-fix — the spans are recomputed at create time.
* Some layout main roads (e.g. Argyle Street / Prince Edward Road West) climb
  the Kowloon hills in the current terrain function; vehicles follow
  `terrainHeight()` there, so they drive up the slope rather than floating.
  If that's undesired it is a layout/terrain decision, not a life bug.
* Pedestrians are point-capped and evenly distributed; they are not
  camera-aware (no LOD spawning near the camera). On the promenade views they
  read well; from a high orbit they are small speckles by design.
* Seagulls/helicopter are decorative: they do not avoid buildings or each
  other, and the helicopter altitude (≈104–120 m) is below the tallest towers
  while it circles the harbour, so it may clip a rooftop at the extreme ends of
  the orbit if a very tall tower is built there.
* The show is deliberately restrained: 10 beams + ≤ 900 firework particles,
  additive, no shadow casting, no render-target work. It does not touch
  `HK.Post`; bloom from the post pipeline will make it read stronger.
* Boat lights and traffic lights are one shared `THREE.Points` cloud
  (≈ 1 860 points max at ultra, 2 600 allocated). The cloud is hidden in
  daylight. Max point size is clamped (30 px) so it never becomes a blob at
  close range.
* `life.dispose()` is provided for hot-reload but the layer is intended to be
  created once; re-creating it after dispose is safe (all state is per-instance).
* Debug handles used by QA only: `life._boats`, `life._show`, `life._fw`,
  `life._lights`, `life._beams`, `life._vehTypes`, `life._tramType`,
  `life._tramRoute`, `life._boatRoutes`, `life._time()`. Not part of the contract.
* `life.auditGeometry()` — debug/QA helper: scans every geometry and instance
  buffer owned by the life group plus the dynamic point/wake/firework buffers and
  returns `{ nan: [...], meshes, instances }`. It returns an empty `nan` array in
  normal operation; useful to prove the layer never feeds NaN geometry to three.
* Robustness: all route sampling validates finite values and falls back to the
  previous sample; every per-frame matrix/point push guards non-finite values (an
  invalid instance is parked at y = -1000 instead of poisoning the batch); point
  buffers are initialised to finite values at creation; zero-length routes/cycles
  are guarded.

## QA page — `qa/life.html`

Standalone harness with a cheap placeholder terrain (heightfield from
`HK.Layout.terrainHeight`), simple shore strip, road ribbons from `ROADS`,
block-out landmark boxes for scale, ambient/directional/hemisphere lights and a
sky-ish background. **The placeholder ground is QA-only** — the real terrain
comes from `js/terrain.js`; life placements themselves always read
`HK.Layout.terrainHeight`.

URL params:

```
qa/life.html?quality=medium&time=21&view=harbour&show=1&layer=traffic,ferries
```

* `quality` = low|medium|high|ultra
* `time` = hours 0..24 (drives the QA env night factor)
* `view` = `harbour` (default), `tst`, `peak`, `street`, `boats`, `ferry`,
  `overview`, `tram`, `tramclose`, `walk`, `close`, `prom`, `ferryclose`, `skyline`
* `show=1` triggers the Symphony of Lights after the page is ready
* `layer=a,b` disables all `state.layers` except those named
* `fov=<deg>` override

`window.__READY__` becomes true after 5 rendered frames; `window.__STATS__` is
refreshed every 10 frames with draw calls/triangles/points and life counts;
`window.__QA__` exposes `{ life, scene, camera, renderer, env, state, setTime(h),
setView(name), triggerShow(), stats() }` for `tools/shot.mjs --eval` probing.

Screenshot recipe:

```
node tools/shot.mjs --port 9490 --url "qa/life.html?quality=medium&time=21&view=harbour&show=1" \
  --out tmp/life-night.png --w 1600 --h 900 --ready "window.__READY__" --wait 7000
```

(Headless SwiftShader runs at a few fps; long `--wait` is needed for the show
timeline and for time-ramped night factors. Always pass a unique `--port 9490+`
to avoid collisions with other agents' headless Chrome.)

## Layout audit (geography dependency)

Traffic/tram/pedestrian placement is driven by `terrainHeight()` land spans, so a
road in water simply carries no vehicles. The initial layout had systematic
shoreline mismatches (TST promenade 99% wet, Hung Hom Bypass / Kwun Tong Road /
Kai Tak Road entirely in water, the whole Causeway Bay tram section inside the
typhoon-shelter inlet, etc.). Those were reported to the geography owner and
fixed in layout.js; re-running the audit (`node tmp/audit2.js`, a throwaway
script under `tmp/`) now reports **0% wet for every ROADS / TRAM_ROUTE / WALK_PATH**
entry, with only the intentional offshore pier decks remaining in water.
Ferry routes are checked against `isLand()` too — all are clear; the yacht loop's
closest pass is ~11 units off shore and is nudged by the route sanitiser.
