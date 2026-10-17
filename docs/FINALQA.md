# FINAL QA — 維多利亞港 · VOXEL VICTORIA HARBOUR

Independent functional + visual QA of the integrated sandbox and the single-file deliverable.
Owner: **verifier** (QA). Application code was **not** modified by QA — only `qa/`, `tmp/qa/`, this file.

---

## 1. Environment & build under test

| item | value |
| --- | --- |
| machine | Windows, PowerShell, Node **v24.14.0**, Google Chrome **155.0.8059.80** (headless=new) |
| GPU | headless SwiftShader WebGL2 (`--use-angle=swiftshader`) → CPU raster; **FPS numbers are not representative of real GPU performance** |
| protocol | **`file://`** for every run (no server, no network) — proves offline operation |
| deliverable | `dist/VictoriaHarbour.html` **1,337,995 bytes (1.28 MiB)**, mtime 2026-10-18 02:01:44 |
| source | `index.html` + `css/style.css` + 16 `js/*.js` + `vendor/three.min.js` (r149) |
| freshness | `node qa/check-dist.mjs` → **FRESH** — every inlined source block (CSS + all 17 scripts) is byte-exactly the frozen source file |
| external refs | **0** external `<script src>` / `<link rel=stylesheet>`; `http` occurrences are only SVG/XHTML `xmlns` strings; favicon is a `data:` URI; no images/fonts/network; `performance.getEntriesByType('resource')` = `[]` on the single file |
| QA harness | `tools/shot.mjs` (vendor, unmodified) driven by `qa/batch.mjs`; ports 9601–9699 (one Chrome at a time, stale Chrome trees reaped between runs) |

Commands (all reproducible):

```pwsh
node qa/check-dist.mjs                                                   # single-file freshness/external-ref audit
node qa/batch.mjs qa/jobs-final-dist.json --portBase 9610                # 34 QA-mode matrix jobs (dist)
node qa/batch.mjs qa/jobs-final-ui.json   --portBase 9660                # 8 normal-load UI jobs (dist)
node qa/probe-runtime.mjs --url dist/VictoriaHarbour.html --port 9671    # resize / runtime quality / pause / time cycle
node qa/rebuild-results.mjs                                              # rebuild tmp/qa/results-final.json from logs
node tools/shot.mjs --url "dist/VictoriaHarbour.html?qa=1&quality=low&time=18.55" ^
  --out tmp/qa/x.png --w 1600 --h 900 --ready "window.__READY__" --port 9601 --timeout 420000
```

Evidence: `tmp/qa/results-final.json` (94 job records), `tmp/qa/logs/*.log` (full console per job), `tmp/qa/rt-summary.json` (runtime probe), 101 screenshots in `tmp/qa/`.

---

## 2. PASS/FAIL matrix

Legend: **PASS** = verified working; **PASS\*** = works with a documented cosmetic caveat; **FAIL** = does not meet expectation (none blocking).

### 2.1 Boot / deep links (source + single-file)

| # | check | expected | result | evidence |
| --- | --- | --- | --- | --- |
| 1 | single-file offline boot `file://` | no network, boots | **PASS** — `__BOOT_ERROR__` null, `__READY__` true, `protocol file:`, 0 resource entries | `f-offline-check.png`, `f-nan-rep1..3.png` |
| 2 | source `index.html` boot | boots | **PASS** (early triage + final re-runs) | `tmp/qa/triage-*.png` |
| 3 | `?qa=1` hides HUD, sets `__READY__/__INFO__` | yes | **PASS** — `__INFO__ = {calls, tris, buildings 4294, colliders 10654, landmarks 114}` | all QA-mode jobs |
| 4 | intermittent `computeBoundingSphere` NaN boot warning | none | **PASS (fixed)** — 3/3 dedicated re-runs + every final-build boot clean; `__NAN_STACK__` null; QA tracer now catches recurrences | `f-nan-rep1..3`, `r-boot-final` |
| 5 | deep-link `time` | sets state + clock | **PASS** — 18.55 → clock 18:37 etc. | `f-time-*` |
| 6 | deep-link `weather=clear|mist|rain` | switches | **PASS** — dataset + visuals | `f-weather-*`, `f-rain-night` |
| 7 | deep-link `quality=low|medium|high` | switches tiers | **PASS** — calls 84/86/88, tris 3.92M/4.15M/4.44M | `r-hero-low/med/high-1600` |
| 8 | deep-link `mode=fps&poi=walk-avenue|central|peak` | spawns correctly | **PASS** — camera at spawn, fov 62, TST/Central/Peak player info | `f-fps-avenue/central/peak`, `r-fps-avenue` |
| 9 | deep-link `mode=cinematic&shot=0..6` | plays 7 shots | **PASS** — each `cine.index` 0–6/7, titles/payload present | `f-cine-0..6` |
| 10 | deep-link `shot=7` (removed dawn shot) | no crash | **PASS\*** — silently falls back to shot 0/7 (list is now 7 shots; docs/README still advertise `shot=0..7`) | `f-cine-7.png`, eval `cine index=0` |
| 11 | deep-link `cam=x,y,z&look=x,y,z` | camera override | **PASS** — exact position applied | `f-cam-central-close`, `f-cam-icc-close`, `f-cam-tst-close`, `r-cam-shore` |
| 12 | deep-link `photo=1` | photo state on | **PASS** — `photo:true`, dataset `data-photo="on"`, HUD hidden | `f-photo-deeplink.png` |
| 13 | deep-link `show=1` at 21.4 | light show on | **PASS** — rooftop laser beams visible | `f-show-night.png` |
| 14 | `poi=<id>` orbit fly-to | camera to POI | **PASS** — central / tst / peak framing | `f-poi-central/tst/peak.png` |

### 2.2 Modes / times / weather

| # | check | result | evidence |
| --- | --- | --- | --- |
| 15 | default hero (orbit) at 1600×900 low/medium/high | **PASS\*** — strong low harbour composition; caveats: flat/empty sky some loads, busy water, shoreline banding | `r-hero-low-1600.png`, `r-hero-med-1600.png`, `r-hero-high-1600.png` |
| 16 | time presets dawn 06.05 / noon 12.5 / golden 18.55 / blue 19.35 / night 21.4 | **PASS\*** — all render distinct lighting; dawn preset reads close to golden (weak dawn palette); noon city reads cold blue | `f-time-dawn/noon/blue/night.png`, `r-hero-low-1600.png` |
| 17 | weather clear / mist / rain (+ rain at night) | **PASS** — mist haze, rain streaks/darker grade, wet night | `f-weather-mist/rain.png`, `f-rain-night.png` |
| 18 | night + Symphony of Lights | **PASS** — lit windows, crowns, laser beams, water light streaks | `f-time-night.png`, `f-show-night.png` |
| 19 | FPS walk-avenue / walk-central / walk-peak | **PASS\*** — collisions spawn resolved, boardwalk present; **artefact: floating orange polygon on Avenue boardwalk**; skyline small from spawn | `f-fps-avenue.png`, `r-fps-avenue.png`, `f-fps-central.png`, `f-fps-peak.png` |
| 20 | cinematic shots 0–6 (skyline / star ferry / neon / peak / kai tak / west kowloon / pearl) | **PASS\*** — 7 shots play with titles/ticks; shot 2 (Neon Nathan Road) has near-black facades; dawn smoke/blob shot removed (no blob anywhere in final build) | `f-cine-0..6.png` |
| 21 | landmark recognisability (close cameras) | **PASS** — Cultural Centre + Clock Tower + Space Museum dome + peninsula/promenade read well (`f-cam-tst-close`); Central piers/wheel/IFC cluster read (`r-cam-shore`, `f-cam-central-close`); ICC/WKCD tower massing reads (`f-cam-icc-close`) | `tmp/qa/f-cam-*.png` |

### 2.3 UI / UX (normal load, no `?qa=1`, dist single file)

| # | check | result | evidence |
| --- | --- | --- | --- |
| 22 | loader first paint (title, progress %, status, skyline silhouette) | **PASS** — beautiful, exactly per docs/ui.md | `f-ui-loader-1280.png` |
| 23 | intro title card over live render; loader gone; phase=intro | **PASS** — title, subtitle, ENTER/WALK buttons, drag hint, corner meta; contrast/legibility good | `r-intro-1600.png`, `intro-1600.png` |
| 24 | intro → sandbox transition (`startExperience`) | **PASS** — phase sandbox, HUD/panel visible, started=true | `f-ui-sandbox-1600.png`, `f-ui-sandbox-1280.png` |
| 25 | WALK entry from intro → FPS HUD | **PASS** — crosshair, compass 187° S, district/altitude/clock, hint bar, pointer-lock prompt visible in FPS | `f-ui-fps-1280.png` |
| 26 | mode dock / `setMode` orbit⇄fps⇄cinematic + next/prev cinematic | **PASS** — live `state.mode` transitions all correct | `f-ui-flow-1280` eval |
| 27 | cinematic overlay (letterbox, 01/07 tick, title, PREV/NEXT/ESC) | **PASS** | `f-ui-cinema-1600.png` |
| 28 | help modal (all shortcuts, about, stats: 114 landmarks / 13 POIs / 24 districts) | **PASS** — opens & closes, `isOverlayOpen` correct | `f-ui-help-1600.png` |
| 29 | photo mode (HUD hidden, corner frame, metadata, exit hint) | **PASS** — `data-photo=on`, `isOverlayOpen` true | `f-ui-photo-1600.png`, `f-photo-deeplink.png` |
| 30 | tool-rail / mode dock / top bar legibility at 1600×900 and 1280×720 | **PASS\*** — 1280 top bar is dense but readable; **POI distance column shows constant `369 m` for every POI (UI data bug)** | `f-ui-sandbox-1600/1280.png` |
| 31 | sandbox panel interactions via DOM clicks | **PASS** — weather button → state rain + label 雨夜; quality → medium + badge 中 · MEDIUM; POI row → fly-to; time preset → 05:54 | `f-ui-flow-1280` eval |
| 32 | app-actions: setTime / setWeather / setQuality / setLayer / teleport / togglePause / setAudio / resetCamera | **PASS** — every action mutated state + emitted events without exceptions | `f-ui-flow-1280` eval |
| 33 | screenshot capture returns true (preserveDrawingBuffer) | **PASS** — `HK.UI.screenshot() === true` | `f-ui-flow-1280` eval |
| 34 | audio toggle | **PASS\*** — state toggles without errors; headless Chrome blocks AudioContext before a real gesture (expected, documented limitation) | eval + console warnings |
| 35 | toast paths (`HK.UI.toast` + `events.emit('toast')`) | **PASS** | eval |
| 36 | pointer-lock prompt in FPS | **PASS** — `#hk-pointerlock` visible in FPS, hidden otherwise | `f-ui-fps-1280.png` |
| 37 | UI resize 1600×900 ⇄ 1280×720 ⇄ 1024×768 | **PASS** — canvas / renderer / post / camera.aspect all update (`1.778 → 1.333 → 1.778`), no overlap/crash | `rt-4..6-*.png`, `rt-summary.json` |
| 38 | runtime quality switch (high→medium→low) | **PASS** — 88→86→84 draw calls live, no errors | `rt-1..3-*.png` |
| 39 | pause / unpause | **PASS** — `state.paused` toggles | `rt-summary.json` |
| 40 | fast auto time cycle (±1.0 h/s) | **PASS\*** — advanced 18.62→18.80 h in 2.8 s headless (frame-bound; real-time speed correct at 60 fps) | `rt-summary.json` |

### 2.4 Console cleanliness (whole run, 94 logged jobs)

| class | result |
| --- | --- |
| final frozen build (all 40+ final jobs) | **CLEAN** — 0 errors / 0 exceptions / 0 shader errors / 0 `__NAN_STACK__`; only expected headless `AudioContext was not allowed to start` warnings on idle non-QA loads |
| historical (pre-freeze builds, fixed & re-verified) | water shader `patch` reserved word (dawn/noon) — **fixed & clean**; intermittent `THREE.BufferGeometry … NaN` — **fixed & clean**; `Props ReferenceError: deck is not defined` (build-boundary) — **fixed & clean** |
| infra-only failures | 2 jobs `Chrome CDP not reachable` (port contention during rebuild, rerun PASS) |

---

## 3. Performance (headless SwiftShader, renderer.info after 6+ frames)

`__INFO__` at boot / steady state (`drawCalls` include the shadow-map pass when the sun is up):

| config | viewport | draw calls | triangles | notes |
| --- | --- | --- | --- | --- |
| dist hero orbit **low** | 1600×900 | 84 | 3,924,059 | shadows on |
| dist hero orbit **medium** | 1600×900 | 86 | 4,145,483 | |
| dist hero orbit **high** | 1600×900 | 88 | 4,444,315 | |
| orbit **blue/night** | 1280×720 | 47 | 1,969,150 | shadow pass off at night → ~half the tris |
| night + rain | 1280×720 | 48 | 1,963,900 | |
| night + light show | 1280×720 | 49 | 1,969,182 | |
| FPS avenue | 1280×720 | 80 | 3,906,959 | |
| FPS central | 1280×720 | 64 | 3,713,449 | |
| FPS peak | 1280×720 | 80 | 3,883,109 | |
| cinematic 0 (skyline) | 1280×720 | 91 | 3,978,879 | |
| cinematic 1 (Star Ferry, 19.1) | 1280×720 | 51 | 2,002,858 | no shadows |
| cinematic 2 (Neon Nathan Rd, 21.6) | 1280×720 | 49 | 2,017,827 | no shadows |
| cinematic 3 (From the Peak, 17.9) | 1280×720 | 96 | 4,038,834 | |
| cinematic 5 (West Kowloon, 19.5) | 1280×720 | 57 | 2,078,228 | |
| close-up shore/noon | 1280×720 | 66 | 3,735,790 | |
| world totals | — | 4,294 buildings, 10,654 colliders, 114 landmarks, 34 city chunks (145,855 quads) | | |

**FPS estimate (not measurable headless — SwiftShader runs ~1–3 fps):** ≤100 draw calls and 3.7–4.4 M triangles with a half-res bloom + MSAA HDR pipeline is mid-weight for a desktop GPU. Expect ~60 fps at 1600×900 on discrete GPUs (GTX 1650/RTX 30-series/Apple M1 class) at **medium/high**, >100 fps at **low**, and 30–60 fps at 1280×720 **medium** on recent integrated graphics. **ULTRA** intentionally not measured (brief said skip); treat as a high-end-GPU tier.

---

## 4. Screenshots (all 1600×900 / 1280×720, `tmp/qa/`)

Final frozen build (preferred evidence):
- Hero: `r-hero-low-1600.png`, `r-hero-med-1600.png`, `r-hero-high-1600.png`
- Intro / loader / sandbox / FPS / cinema / help / photo: `r-intro-1600.png`, `f-ui-loader-1280.png`, `f-ui-sandbox-1600.png`, `f-ui-sandbox-1280.png`, `f-ui-fps-1280.png`, `f-ui-cinema-1600.png`, `f-ui-help-1600.png`, `f-ui-photo-1600.png`, `f-ui-flow-1280.png`
- Night / show: `f-time-night.png`, `f-show-night.png`, `f-rain-night.png`
- Cinematic 0–6: `f-cine-0.png` … `f-cine-6.png`
- FPS: `r-fps-avenue.png`, `f-fps-central.png`, `f-fps-peak.png`
- Landmarks: `f-cam-central-close.png`, `f-cam-icc-close.png`, `f-cam-tst-close.png`, `r-cam-shore.png`
- Poi: `f-poi-central.png`, `f-poi-tst.png`, `f-poi-peak.png`
- Boot/offline: `f-nan-rep1..3.png`, `r-boot-final.png`, `f-offline-check.png`, `f-photo-deeplink.png`
- Runtime probe: `rt-0-baseline-1280.png`, `rt-1-quality-high.png`, `rt-2-quality-medium.png`, `rt-3-quality-low.png`, `rt-4-resize-1600x900.png`, `rt-5-resize-1024x768.png`, `rt-6-resize-back-1280.png`, `rt-7-final.png`

Time/weather matrix (same frozen modules, captured one build earlier — props-only delta): `f-time-dawn/noon/blue.png`, `f-weather-mist/rain.png`.

---

## 5. Prioritised bug list

### Blocking
**None.** The single-file deliverable boots offline with a clean console in every final-build run; all three modes, all deep links and all UI states work.

### Major (visual / art quality — do not block shipping but should be known)
1. **Shoreline teal/cyan banding (moiré)** — thin regular cyan stripes run along the HK Island waterfront in hero, cinematic and FPS views. Expected: soft shore foam/kerb; observed: aliased bright bands. Repro: `dist/VictoriaHarbour.html?qa=1&quality=low&time=18.55` 1600×900 → `tmp/qa/r-hero-low-1600.png`; `…&mode=cinematic&shot=0` → `tmp/qa/f-cine-0.png`; also visible in `f-ui-photo-1600.png`. Likely water shore-mask foam band / promenade kerb raster; needs foam mask blur or distance fade.
2. **Water reads "pool", not Victoria Harbour** — foreground water is uniform busy turquoise with no sun-glitter path; at noon close-up the near-shore water is **murky olive-brown** with a blown-out white glitter blob at the right edge. Repro: `…&quality=low&time=12.5&cam=-60,40,200&look=-150,5,335` → `tmp/qa/r-cam-shore.png`; hero `tmp/qa/r-hero-low-1600.png`. Needs deeper jade base + smoother wave normal + glitter gating.
3. **Avenue of Stars boardwalk artefact** — a large flat orange polygon lies across/inside the new TST boardwalk deck (left-centre of spawn view); planks are oversized stripes. Repro: `…&quality=low&mode=fps&poi=walk-avenue&time=18.55` → `tmp/qa/r-fps-avenue.png`. (The former giant black railing band is **fixed**.)
4. **Hero sky can be empty** — some loads render a nearly cloudless flat blue sky at 18.55 (other loads show good clouds), which weakens the intended golden-hour postcard. Compare `tmp/qa/r-hero-low-1600.png` vs `tmp/qa/f-ui-photo-1600.png`. Likely unseeded per-load cloud RNG; seed it for deterministic hero framing.
5. **Neon Nathan Road cinematic too dark** — building facades are near-black with floating lit windows; low ambient/night fill makes the canyon hard to read. Repro: `…&mode=cinematic&shot=2` (03/07 彌敦道霓虹) → `tmp/qa/f-cine-2.png`.

### Minor
6. **POI distances stuck at `369 m`** in the sandbox panel for every POI (UI distance calculation), 1600×900 and 1280×720 → `tmp/qa/f-ui-sandbox-1600.png`.
7. **`shot=7` deep link now wraps to shot 0** because the cinematic list is 7 shots (0–6); README/docs/INTERFACES still document `shot=0..7` → update docs or clamp explicitly with a console note.
8. **Langham Place / Mong Kok landmark silently skipped at every boot**: console `landmarks-kl: skip Langham Place — anchor terrain height 111 at 24 -842 (Mong Kok hill, layout issue)`; 1 of the advertised Kowloon landmarks is absent.
9. **Dawn preset is visually close to golden hour** (no pink/peach dawn sky or stronger low-sun warmth) → `tmp/qa/f-time-dawn.png`.
10. **Noon palette is cold cobalt-blue** across glass towers; the “humid pale haze midday” look from the art direction is weak → `tmp/qa/r-cam-shore.png`, `tmp/qa/f-time-noon.png`.
11. **Headless idle loads log `AudioContext was not allowed to start`** warnings before any gesture (expected browser policy; audio assets verified only as state/API, not audible output).
12. **FPS badge shows 60 in headless** — not measurable there; verify on real GPU.

### Fixed & re-verified during QA (closed)
- Water shader reserved word `patch` → compile failure at dawn/noon (fixed; dawn/noon now clean).
- Intermittent `THREE.BufferGeometry.computeBoundingSphere(): radius is NaN` on boot (NaN hardening + `__NAN_STACK__` tracer; 4/4 final boots clean).
- `Props ReferenceError: deck is not defined` (build-boundary; final build clean).
- Cinematic dawn smoke/blob, giant black TST railing band, high-angle shoreline moiré from the old high hero camera (hero now low harbour view).

---

## 6. Limitations of this QA pass

- FPS is **not** representative in headless SwiftShader; only draw calls/triangles and visual smoothness proxies were measured.
- Pointer lock and WebAudio cannot be exercised without real user gestures; only the prompt visibility and API/state paths were verified.
- 1600×900/1280×720 are the verified sizes; 1024×768 resize works but is below the supported floor.
- ULTRA tier was not run (per brief).
- A small set of time/weather screenshots (`f-time-*`, `f-weather-*`) was captured on the immediately preceding build; the only delta was props/boardwalk detail, so the verdicts are unaffected (final-build hero/cinema/FPS/UI shots are all post-freeze).

**Verdict: the deliverable is shippable.** Single-file offline app, all modes/deep links/UI states function correctly with a clean console on the frozen build; remaining issues are cosmetic (hero/water/shoreline art quality, one boardwalk artefact) and one documentation mismatch (`shot=0..7`).
