# UI / UX — HK VOXEL HARBOUR

Owner: **atelier** (UI/UX designer-engineer). Write scope: `index.html`, `css/style.css`,
`js/ui.js`, `js/audio.js`, `qa/ui-demo.html`, `docs/ui.md`.

Deep-ink glass, hairline rules, bilingual Traditional Chinese + English typography,
restrained neon (cyan `#3de0ff` / magenta `#ff4fa3` / amber `#ffb547`). Classic scripts
only, system fonts only, inline SVG icons only, zero external assets.

---

## 1. Files

| file | purpose |
| --- | --- |
| `index.html` | Whole DOM shell (stage, HUD, loader, intro, cinema, help, toasts, flash) + canonical script order |
| `css/style.css` | Complete art direction, all screen states, responsive down to 1280×720, reduced-motion |
| `js/ui.js` | `HK.UI` — loader, intro, all controls → `app.actions`, state/event → DOM, toasts, screenshot, audio bridge |
| `js/audio.js` | `HK.Audio` — procedural WebAudio ambience (waves / rumble / neon hum / rain / gull / ferry horn / clicks) |
| `qa/ui-demo.html` | Standalone stub-app page for every overlay, URL-parameter driven, `window.__READY__` |
| `docs/ui.md` | This document |

`ui.js` / `audio.js` do **not** require Three.js and no-op gracefully when `app` is absent.

---

## 2. Boot sequence (what `js/main.js` should do)

```js
// 1) earliest — UI is already visible from first paint; this wires it up.
HK.UI.initLoader();                       // idempotent, also auto-called on DOMContentLoaded

// 2) during world build
HK.UI.progress(12, { zh: '正在重塑海岸線…', en: 'RESHAPING THE COASTLINE' });
HK.UI.progress(46, '正在點亮中環… / LIGHTING UP CENTRAL');   // string or {zh,en}
HK.UI.progress({ pct: 82, label: { zh: '正在調校暮色…', en: 'GRADING THE GOLDEN HOUR' } });

// 3) when scene + renderer + all builders are ready
document.getElementById('hk-stage').appendChild(renderer.domElement);
//   (or provide the same node as app.container)
HK.UI.init(app);                          // fades loader at 100 %, then shows the intro title card

// 4) per frame — optional (UI self-ticks at ~10 Hz for clock/FPS/compass)
HK.UI.update(dt);

// 5) any time
HK.UI.toast({ zh: '已切換至第一人稱', en: 'FIRST PERSON MODE' });
```

Rules of engagement:

* **Never** toggle UI classes/`data-*` attributes directly from main / controls. Set
  `app.state` and emit events; the UI owns the DOM.
* The intro card is shown by `init()` (per contract). To skip it, either call
  `HK.UI.hideIntro()` right after `init()`, or set `HK.UI.skippedIntro = true` before `init()`.
* Intro buttons call `app.actions.startExperience()`, hide the intro with a cinematic
  fade, then call `app.actions.setMode(...)` for WALK (orbit is the default).
* `HK.UI.init(app)` may be called before `DOMContentLoaded` — the shell markup precedes
  the script tags.

---

## 3. Mount structure / layers

```
#hk-stage      z 0   main appends `renderer.domElement` here (fixed, inset 0)
#hk-vignette   z 2   CSS cinematic grade over the render (passive)
#hk-hud        z 10  topbar, side panel, mode dock, FPS HUD, tool rail,
                     pointer-lock prompt, photo frame, toasts
#hk-cinema     z 20  letterbox + shot title + ticks + prev/next
#hk-intro      z 30  title card over the live render
#hk-help       z 40  field-guide modal
#hk-toasts     z 45
#hk-flash      z 50  screenshot flash (sibling of #hk-hud so it works in cinema/photo)
#hk-loader     z 60  always topmost until faded
```

`renderer` must keep `preserveDrawingBuffer: true` (see docs/INTERFACES.md) because
`HK.UI.screenshot()` reads the canvas with `toDataURL('image/png')`.

Runtime state is reflected on `<html>` as data attributes (owned by the UI):

```
data-phase="loading|intro|sandbox"
data-mode="orbit|fps|cinematic"
data-panel="open|closed"
data-photo="on|off"
data-audio="on|off"
data-quality="low|medium|high|ultra"
data-weather="clear|mist|rain"
data-night="0|1"
data-pointerlock="on|off"
```

---

## 4. What the UI consumes

### `app.state`

| field | use |
| --- | --- |
| `mode` | dock active state, HUD visibility, cinema overlay |
| `timeHours` | clock (HH:MM), day-phase label, time continuum thumb, active preset |
| `timeAuto`, `timeSpeed` | auto-cycle button state, speed chip |
| `weather` | topbar label + icon, weather selector |
| `quality` | quality badge, quality selector |
| `layers` | layer toggle states (`traffic, ferries, people, neon, labels, aircraft`) |
| `audio` | sound toggle / `HK.Audio` |
| `photo` | photo-mode frame; hides all other HUD |
| `paused` | audio ducking |
| `night` | `data-night`, audio mix |
| `fps` | FPS badge + sparkline |
| `player` *(optional)* | `{x,y,z, headingRad|headingDeg, altitudeM|altitude|y, districtZh, districtEn}` — compass / altitude / district / POI distances |

### `app.meta`

* `version` — shown in panel footer + help (fallback `1.0.0`).
* `pois` — array from `HK.Layout.POIS`. Accepted per item:
  `{ id, name|zh, en, district|districtZh/districtEn, x, z }` where `x/z` may also be
  read from `spawn{x,z}` or `cam{x,z}`. Clicking a row calls `app.actions.teleport(id)`.
* `districts` — array or count used in the help stats.
* `landmarkCount` — help stats.
* `credits` — string/array shown in help.
* `shots` *(optional)* — cinematic shot list `[{titleZh|title, titleEn|en, caption?}]` or strings.
  If omitted the UI uses its own 9-shot Hong Kong list.

### `app.actions` (called by the UI)

| action | args | trigger |
| --- | --- | --- |
| `startExperience()` | — | ENTER SANDBOX / WALK THE CITY / any mode key on the intro |
| `setMode(mode, opts)` | `'orbit'|'fps'|'cinematic'` | mode dock, 1/2/3 keys, M (map), cinema exit |
| `setTime(hours)` | 0–24 | time continuum drag/click, presets, keyboard on the slider |
| `setTimeAuto(bool)` | — | AUTO CYCLE button |
| `setTimeSpeed(hoursPerSec)` | — | speed chip cycles `0.06 / 0.12 / 0.25 / 0.5 / 1.0` |
| `setWeather(w)` | `clear|mist|rain` | weather selector |
| `setQuality(q)` | `low|medium|high|ultra` | quality selector |
| `setLayer(name, bool)` | layer key | layer toggles |
| `setAudio(bool)` | — | topbar sound button |
| `teleport(poiId)` | POI id | POI list rows |
| `togglePhoto()` | — | photo tool / P |
| `togglePause()` | — | reserved (UI never calls it) |
| `nextCinematic()`, `prevCinematic()` | — | cinema NEXT/PREV / N |
| `resetCamera()` | — | tool rail reset |
| `requestPointerLock()` | — | pointer-lock prompt / entering FPS interactively |
| `screenshot()` | — | Reserved for main's own input path. **UI's CAPTURE button and `HK.UI.screenshot()` do the capture themselves** (flash + `renderer.domElement.toDataURL` + download) so there is never a double save. Main may implement `screenshot: function () { HK.UI.screenshot(); }` if it wants the action to work from elsewhere. |

All calls are guarded: missing actions are silent no-ops.

### `app.events` (consumed, tolerant payloads)

| event | payload the UI accepts |
| --- | --- |
| `mode` | `'fps'` or `{mode}` |
| `time` | `{hours}` / `{timeHours}` / number |
| `weather` | `'rain'` or `{weather}` / `{value}` |
| `quality` | `'high'` or `{quality}` / `{value}` |
| `fps` | number or `{fps}` / `{value}` |
| `player` | `{x,y,z,headingRad|headingDeg|heading, altitudeM?|altitude?|y, districtZh?|district?, districtEn?}` or `{player:{…}}` |
| `photo` | `{photo:bool}` / bool |
| `audio` | `{audio:bool}` / bool |
| `paused` | `{paused:bool}` / bool |
| `cinematic` | `{index, total?, titleZh?|title?, titleEn?|en?, caption?}` — keeps shot titles in sync with main's camera path. `HK.UI.updateCinema(payload)` is exposed for `main.js` to call directly; duplicate UI/main listeners are de-duplicated. |
| `layer` | `{name, on}` — syncs a layer toggle if main changes it |
| `pointerlock` | any — re-syncs the `MOUSE LOCKED` indicators |
| `toast` | string or `{zh,en,type?}` |

The UI also **polls** `app.state` at ~10 Hz, so a main that only mutates state (no events)
still works. Events are preferred for instant feedback.

`HK.UI.toast()` de-duplicates against main's `toast` events for ~1.8 s (substring match)
so action toasts are not doubled.

---

## 5. Screen states

| state | trigger | what is visible |
| --- | --- | --- |
| **loading** | first paint → `init()` | deep-ink loading stage: procedurally assembled voxel skyline, scan line, bilingual title, rotating status pair, 0–100 % track |
| **intro** | `init()` after loader fades | title card over live render: serif `維多利亞港` char-by-char reveal, spaced caps, `數碼孿生`, primary `進入沙盤 / ENTER SANDBOX`, secondary `直接漫遊 / WALK THE CITY`, drag/zoom hint, corner meta |
| **sandbox (orbit)** | after intro / `setMode('orbit')` | topbar, left panel (time, weather, quality, layers, POI list), mode dock, tool rail |
| **fps (walk)** | `setMode('fps')` / key `2` | everything above minus panel (auto-collapsed; re-open tab at left edge), plus crosshair, compass strip, district/altitude/clock block, control hint bar, pointer-lock prompt while unlocked |
| **cinematic** | `setMode('cinematic')` / key `3` | HUD hidden; 9.5 vh letterbox bars slide in, lower-left `02 — 中環幻彩 / CENTRAL SPECTRUM` + eyebrow + caption, progress ticks, PREV / NEXT / ESC EXIT |
| **photo** | `P` / photo tool / `togglePhoto()` | all HUD hidden; corner frame, `攝影模式 · PHOTO MODE`, exposure metadata, `P / ESC 退出` |
| **help** | `H` / `?` / help button | field-guide modal: explore/camera/modes shortcut tables, about + build stats, credits, focus trap, close on ESC/backdrop |
| **overlays** | transient | toasts bottom-right (above tool rail), mode banner, screenshot flash |

`HK.UI.isOverlayOpen()` returns `true` while the help modal, photo mode or cinematic
overlay is open. `controls.js` should ignore its own Esc handling in that case; the UI
handles Esc only for those overlays. Do **not** bind Escape for pointer-lock release —
the browser does that.

---

## 6. Keyboard / pointer ownership

UI-owned keys (controls.js must not handle these; check `e.defaultPrevented` at the top
of its handler and skip when the event target is an input/textarea/select or
`contenteditable`):

| key | action |
| --- | --- |
| `1` / `2` / `3` | sandbox / walk / cinema mode (also from the intro) |
| `H` or `?` | help modal |
| `P` | photo mode on/off |
| `M` | map toggle — orbit ⇄ walk (exits cinema to orbit) |
| `N` | next cinematic shot (cinema only) |
| `Esc` | only: close help → leave photo → exit cinematic. Never pause, never pointer-lock |
| `Enter` | on the intro only: enter sandbox |

`controls.js` keeps WASD / Shift / Space / F / C / V / Esc-pause.

Pointer lock: UI shows a centred `點擊鎖定視角 / CLICK TO CAPTURE MOUSE` prompt while
`app.state.mode === 'fps'` and the document is not locked; clicking it calls
`requestPointerLock()` (or the canvas directly). Lock state also flips
`data-pointerlock` and the `MOUSE LOCKED` label in the FPS HUD.

---

## 7. Procedural audio (`js/audio.js`)

No files, no network. Built lazily on the first user gesture:

* harbour swell (filtered noise + slow LFO), deep water, city rumble, neon hum
  (100 Hz + detuned fifth + tremolo), humid wind bed, rain bed (weather),
* scheduled ferry horn (17–43 s), gull calls (daytime only), distant traffic wash,
  thunder in rain at night,
* UI click ticks, smooth master fade, compressor/limiter, tab-hidden suspend.

API (`HK.Audio`):

```js
HK.Audio.setEnabled(bool);           // master fade in/out; creates ctx on first enable
HK.Audio.userGesture();              // call from a real click/keydown (UI does)
HK.Audio.update({ audio, night, weather, mode, photo, paused, timeHours, phase });
HK.Audio.click();                    // UI tick
HK.Audio.isEnabled();
```

The UI drives it from `app.state.audio` (sound button → `actions.setAudio`) and from
`HK.UI.update` at 2 Hz. Audio is muted by default (`DEFAULT_STATE.audio = false`) and
**never** starts without a user gesture; disabling suspends the AudioContext.

---

## 8. Screenshot capture

* Tool rail `截圖 / CAPTURE` (and `HK.UI.screenshot()`) fires the white flash and saves
  `hk-victoria_YYYYMMDD-HHMMSS.png` directly from `renderer.domElement.toDataURL('image/png')`.
* Requires `preserveDrawingBuffer: true` on the renderer (already in the contract).
* If no canvas exists (e.g. QA page), a warning toast is shown and nothing is saved.
* `main.actions.screenshot` should delegate to `HK.UI.screenshot()` if it needs the
  action to work (UI does not call the action, to avoid a duplicate download).

---

## 9. QA harness

`qa/ui-demo.html` is a standalone stub: fake app + state, fake POIs
(中環 / 尖沙咀 / 太平山頂 / 西九文化區 / 紅磡 / 銅鑼灣 / 啟德 / 天星碼頭), fake FPS / player
updates, simulated ticking time, event path exercised, and `window.__READY__` once
transitions settle. It loads `../js/core.js`, `../js/ui.js`, `../js/audio.js` only
(Three is not required — a tiny shim satisfies core.js) and paints a CSS-only
golden-hour harbour behind the overlays so screenshots read like the live render.

```
qa/ui-demo.html?state=loader|intro|sandbox|fps|cinema|help|photo
                &quality=low|medium|high|ultra
                &time=18.62&weather=clear|mist|rain
                &shot=0..8            (cinema starting shot)
```

Snapshot command (use a unique CDP port to avoid collisions between agents):

```
node tools/shot.mjs --url "qa/ui-demo.html?state=intro" --out tmp/ui-intro.png \
  --w 1600 --h 900 --ready "window.__READY__" --wait 800 --timeout 120000 --port 9410
```

Screenshots produced during development (1600×900 and 1280×720) live in `tmp/`:

* QA page states: `ui-loader.png`, `ui-intro.png`, `ui-sandbox.png`, `ui-fps.png`,
  `ui-cinema.png`, `ui-help.png`, `ui-photo.png`, `ui-toast.png`, `ui-night-rain.png`
  and the `ui-1280-*.png` counterparts.
* Real-app integration shots (live WebGL render under the UI): `real-intro.png`,
  `real-sandbox.png`, `real-fps.png`, `real-cinema.png`, `real-help.png`,
  `real-photo.png`, `real-enter2.png`.
* The QA page is generated from the `index.html` shell markers so both stay identical;
  the generator/stub scratch files are under `tmp/` and are **not** part of the build.

The real app was exercised via `index.html` with main.js' deep links
(`?intro=0&mode=orbit|fps|cinematic&time=…&quality=…&poi=…&photo=1`).
At verification time `js/props.js` returned a `THREE.Group` from `HK.Props.build`,
while `main.js` expects an object with `update/setQuality/setLayer`; a **temporary
dev-only bridge** in `tmp/integration.html` was used to finish the UI integration pass
(no deliverable contains that bridge). Everything else booted cleanly:
loader → intro → ENTER SANDBOX transition (phase `sandbox`, `app.state.started`),
FPS HUD in Tsim Sha Tsui (district/altitude/clock/compass/pointer-lock prompt),
cinematic shots with live shot payloads, help modal, photo mode, and
`HK.UI.screenshot()` returned `true` against the real `preserveDrawingBuffer` canvas.

---

## 10. Typography & tokens

```css
--ink:#05070c; --paper:#eae6dc; --muted:#9aa4ad;
--cyan:#3de0ff; --magenta:#ff4fa3; --amber:#ffb547; --red:#ff4b3e;
--serif: "Noto Serif TC","Songti TC","PMingLiU","MingLiU",Georgia,serif;
--sans:  "Segoe UI","Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif;
--mono:  "Consolas","SFMono-Regular",monospace;
```

Chinese display type is serif with generous tracking; English metadata is spaced caps
mono, 6–10 px; data values use tabular figures. Hairlines are
`rgba(234,230,220,.08–.30)`; panels are `linear-gradient(...)` ink glass with one
`backdrop-filter` each (topbar, panel, dock, tool rail, help modal) to keep the CSS
cheap. Motion is transform/opacity only; `prefers-reduced-motion` disables it.

---

## 11. Known limitations

* Pointer lock and audio unlock require real user gestures; headless screenshots show
  the pointer-lock prompt but can't verify lock/audio output.
* Fonts are system fonts only, so the serif weight/shape depends on the machine
  (`PMingLiU` on Windows, `Songti TC`/`Noto Serif TC` elsewhere). No webfont fallback.
* QA page's CSS backdrop is not the real render; contrast decisions were made against
  a busy golden-hour scene rather than the final HDR frame.
* POI distances and the FPS compass need `app.state.player` / `player` events; without
  them the panel shows `— m` and the compass sits at north.
* Cinematic shot titles fall back to a built-in 9-shot list if `app.meta.shots` is
  missing; pass shots (or emit `cinematic` payloads) for exact main.js titles.
* Entering photo mode while in cinematic is refused with a warning toast (togglePhoto
  runs only in sandbox).
* Below ~980 px width the topbar drops secondary labels and layer/weather micro-labels
  hide their English; the target floor is 1280×720.
* The loader self-creeps to 90 % if main never calls `progress()` (graceful fallback);
  `HK.UI.progress(100)`/`init()` completes it.
* No swipe/touch-specific gestures; not a mobile-first experience.
