# HK VOXEL HARBOUR — LANDMARK KIT & CONTENT GUIDE
> Read `docs/INTERFACES.md`, `js/layout.js`, `js/landmarkkit.js` and `js/buildings.js` first.
> Classic scripts, THREE r149, no external assets. World units: 1 unit = 2 m, sea level y=0, +X east, −Z north (Kowloon), +Z south (HK Island).

## Integration contract

The Lead builds the world in this order and calls your module once:

```js
world = await HK.Terrain.build(HK.Layout, {}, progress)
city  = HK.Buildings.build(world, HK.Layout)     // world.city = HK.CityBuilder (already exists!)
HK.LandmarksHK.build(world, HK.Layout)           // Lead
HK.LandmarksKL.build(world, HK.Layout)           // YOU
HK.Props.build(world, HK.Layout)                 // Lead
material = HK.Buildings.createMaterial()         // shared facade material
scene.add(world.city.buildGroup(material))       // all landmarks + city merged here (done by Lead)
```

**Add all your geometry to `world.city` using `HK.Kit`.** Do not create your own meshes/materials/textures. Everything you add becomes part of the merged city chunks. Register signatures exactly:

```js
HK.LandmarksKL = {
  build: function (world, layout) { ... return { count: n } }
};
```

Use the same `world.city` instance (`new HK.Kit(world.city, {...})`). Landmarks sit on terrain; call `world.heightAt(x, z)` for the ground (returns −1 on water). The landmark reservation zones in `layout.RESERVED` have already been cleared of procedural buildings, so your footprints are safe. Keep buildings inside/near their anchors.

## HK.Kit API (js/landmarkkit.js)

```js
var K = new HK.Kit(world.city, { style: HK.FACADE.GLASS_BLUE, color: '#9fb6c6', seed: 1234, glow: 1 });
K.spawn({...overrides}) // returns a derived Kit (color/style/seed per sub-part)

K.box(x0, z0, x1, z1, y0, y1, opts)         // axis-aligned; opts: {color, style, seed, glow, roofColor, collide, faces, jitter}
K.boxC(cx, cz, w, d, y0, y1, opts)          // centred
K.rotBox(cx, cz, w, d, yaw, y0, y1, opts)   // yaw radians, plan-rotated box
K.prism([[x,z],...], y0, y1, opts)          // extruded convex plan (triangle plans, podiums)
K.cyl(cx, cz, r, y0, y1, sides, opts)       // cylinder/drum
K.taper(cx, cz, w0, d0, w1, d1, y0, y1, steps, opts) // stepped tapered tower
K.pyramid(cx, cz, w, d, y0, y1, opts)       // pyramidal roof (BOC-like crowns)
K.dome(cx, cz, r, y0, y1, steps, opts)      // stepped dome (Space Museum)
K.spire(cx, cz, r, y0, y1, opts)            // mast / spire
K.beam([x,y,z], [x,y,z], w, h, opts)        // oriented structural beam / truss member / sloped roof rib
K.brace([x,y,z], [x,y,z], width, [nx,ny,nz], opts) // flat diagonal facade brace (BOC X, trusses)
K.panel(p0, p1, p2, p3, normal, opts)       // single quad (glass fins, canopies)
K.roofClutter(cx, cz, w, d, y, seed, opts)  // AC units, tanks, antennas, parapet — call on big roofs
K.sign({x, z, y, w, h, rotY, kind, palette}) // optional neon sign request (props renders them)
K.beacon(x, y, z)                            // blinking red aircraft light (props renders them)
K.collideBox(x0, z0, x1, z1, y0, y1, walk)  // walkable decks / invisible barriers
```

Every `box/boxC/rotBox/prism/cyl/taper` auto-registers a collider unless `opts.collide === false`. Set `collide:false` on decorative boxes, low awnings, canopies, antennas, roof clutter. Decks that people should walk on need colliders (auto via box is fine; `walk:true`).

## Facade styles (`HK.FACADE.*`) — the shared window shader generates the detail

| id | name | use for |
|---|---|---|
| GLASS_BLUE 0 | blue curtain glass | modern towers (IFC/ICC/K11) |
| GLASS_TEAL 1 | teal glass | Central Plaza / One Island East |
| GLASS_SILVER 2 | silver/white glass | West Kowloon, luxury |
| GLASS_BRONZE 3 | bronze glass | hotels, M+ neighbours |
| CURTAIN_DARK 4 | dark curtain wall | M+, premium towers |
| PUNCHED 5 | punched windows | old concrete |
| BANDED 6 | ribbon windows | 60s–80s offices |
| RESI 7 | residential tower | Hong Kong housing |
| RESI_OLD 8 | old dense residential | Chungking/TST/Mong Kok |
| PORTHOLE 9 | round windows | Jardine House |
| STONE 10 | stone / heritage | 1881, Peninsula base, Clock Tower |
| METAL 11 | metal/structural | HSBC, masts, shed roofs |
| LED 12 | animated LED media facade | ICC crown, M+ screen, The Center crown |
| PURE 13 | plain material, panel seams | roofs, trusses, sculptures, piers, decks |
| INDUSTRIAL 14 | industrial cladding | piers, sheds, cargo |
| HERITAGE 15 | warm stone arches | heritage buildings |
| DIAGONAL 16 | glass with diagonal truss | BOC Tower body |

Colours are hex strings; every Kit has a default colour. Facade pattern UV is in world units, so window scale is consistent. Use `PURE` for structural details and coloured roofs.

## Landmark anchors (layout.LANDMARKS, may be slightly adjusted; use these)

Kowloon set:
`icc (-962,-424) h242`, `mplus (-1122,-304)`, `xiqu (-1234,-344)`, `palaceMuseum (-1184,-422)`, `kowloonStation (-968,-514)`, `harbourCity (-424,-356)`, `oceanTerminal (-438,-274)` (pier), `starFerryTST (-200,-294)` (pier), `culturalCentre (-132,-356) w88 d54`, `clockTower (-182,-336)`, `spaceMuseum (-20,-364)`, `museumArt (50,-358)`, `peninsula (-286,-386)`, `heritage1881 (-198,-352)`, `chungking (-352,-368)`, `k11musea (130,-356)`, `rosewood (172,-378)`, `k11 (46,-384)`, `isquare (-158,-392)`, `theOne (-268,-436)`, `avenueStars (64,-330)`, `coliseum (396,-438)`, `hungHomStation (384,-516)`, `whampoa (520,-392)`, `crossTunnel (330,-390)`, `kaiTakCruise (980,-255)`, `kaiTakSports (1062,-524)`, `langham (24,-842)`.

Also useful: `layout.FERRY_PIERS`, `layout.LANDMARKS`, `layout.terrainHeight`, `layout.TRAM_ROUTE`, `layout.POIS`.

## Required Kowloon content (priority order)

1. **West Kowloon Cultural District + Station**: ICC (484 m = 242 u; tapered square glass tower with a bright LED crown; world-recognisable), M+ (horizontal bar + tower with LED media screen), Xiqu Centre (lantern-like curved volume with a giant arch opening), Palace Museum (bronze/gold box with layered roof), Kowloon Station towers (Sorrento/The Arch/W Hotel around the anchor), waterfront Art Park edge.
2. **TST waterfront**: Cultural Centre (low, wide, sloping windowless roof, warm pink tile), Clock Tower (red-brick square tower + spire, 21 u), Space Museum (white dome), Museum of Art (blocky gallery), Star Ferry TST pier (green/white pier pavilion, gangways, walkable deck), Avenue of Stars promenade edge, Ocean Terminal + Harbour City (long pier sheds + mall block).
3. **TST streets**: Peninsula (H-plan + green roof + forecourt fountain), 1881 Heritage (low colonial stone block), Chungking Mansions (dense old block with many AC boxes/signs), K11 Musea (low sculptural mall), Rosewood (tall hotel), K11, iSQUARE, The One, plus a few TST neon-vertical blocks (fake signs via K.sign).
4. **Hung Hom**: Hong Kong Coliseum (inverted pyramid), Hung Hom Station, Whampoa (ship-shaped mall "THE WHAMPOA" on the bay shore; the hull can overhang water), Cross-Harbour Tunnel portal.
5. **Kai Tak**: Cruise Terminal (long wavy roof over the runway tip), Kai Tak Sports Park (large low stadium mass + white roof), a couple of new residential towers, runway edge marking boxes (PURE white, low).
6. **Mong Kok / Yau Ma Tei** (optional if time): Langham Place (tall tower + podiums) at (24,-842), a few dense old blocks along Nathan Road; signs via K.sign.

Do not duplicate HK Island landmarks (Central etc.) — that is the Lead's file.

## Quality bar / style

- Recognisable silhouette first, detail second. BOC/Central Plaza-level landmarks on the HK side set the standard: stepped voxel massing, strong crowns, glowing LED/neon accents at night, visible structure (trusses, bracing, masts), rooftop clutter, real proportions from the anchors.
- Everything is voxel-blocky: use Kit shapes, no smooth sculpted geometry except dozens-of-faces cylinders/domes.
- The facade shader provides windows; use styles deliberately (e.g. Cultural Centre = PURE/STONE low sheen, Museum of Art = BANDED, ICC = GLASS_SILVER + LED crown, Xiqu = PURE/STONE with warm interior glow, M+ = CURTAIN_DARK + LED).
- Add `K.beacon(...)` on top of tall towers; add LED strips/crowns with `style: HK.FACADE.LED, glow: 1.5-2.5`.
- Keep total added cost reasonable: ≤ ~25k quads, ≤ ~2.5k extra colliders.
- QA page: make `qa/kl.html` that loads three, core, layout, terrain, landmarkkit, buildings, and your file; renders the scene with a normal directional+hemisphere light and an optional simple water plane; camera params `?view=wkcd|tst|hunghom|kaitak|top&night=1`; set `window.__READY__` after ~4 frames and `window.__INFO__` with your landmark count and quad count. Use `node tools/shot.mjs --url qa/kl.html --out tmp/kl-*.png --w 1600 --h 900 --ready "window.__READY__" --port 9410 --timeout 300000` and inspect with read_image. **Use a unique CDP port (9400+); other agents are using 9333 and ports collide.**
- Work only in `js/landmarks-kl.js` and `qa/kl.html` (plus tmp screenshots). Report when integration-ready: list of landmarks, screenshot paths, quad/collider count, known compromises.
- Coordinate bugs: run `node tools/audit-layout.mjs` (checks layout roads/landmarks against water) and mention exact coordinates to the Lead if something is in water.
