#!/usr/bin/env python3
"""Bake Victoria Harbour texture atlases into assets/*.png.

Deterministic, offline, no network. Re-run with:

    python3 tools/bake-textures.py

tools/build.mjs packs the PNGs into dist/VictoriaHarbour.html so the
single-file build still works from file://.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
CJK = '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'


def enc(v):
    v = 0.0 if v < 0 else (1.0 if v > 1 else float(v))
    return int(round((v ** (1.0 / 2.2)) * 255.0))


def enc3(r, g, b, a=255):
    return enc(r), enc(g), enc(b), a


def srgb_u8(lin):
    lin = np.clip(lin, 0.0, 1.0)
    return np.round((lin ** (1.0 / 2.2)) * 255.0).astype(np.uint8)


def hash2(x, y):
    x = np.asarray(x, dtype=np.int32)
    y = np.asarray(y, dtype=np.int32)
    n = (x * np.int32(374761393) + y * np.int32(668265263)).astype(np.uint32)
    n = (n ^ (n >> np.uint32(13))) * np.uint32(1274126177)
    n = n ^ (n >> np.uint32(16))
    return n.astype(np.float64) / 4294967295.0


# style id matches HK.FACADE 0..15
# kind drives the window cutter. Multipliers are linear (1 = vertex colour).
STYLES = [
    dict(kind='curtain', bays=8, floors=4, mull=0.07, glass=(0.58, 0.66, 0.70), frame=(1.00, 0.99, 0.97), lit=0.66, warm=0.35),
    dict(kind='curtain', bays=8, floors=4, mull=0.055, glass=(0.50, 0.70, 0.66), frame=(0.96, 1.00, 0.98), lit=0.62, warm=0.28),
    dict(kind='curtain', bays=8, floors=4, mull=0.08, glass=(0.72, 0.76, 0.78), frame=(1.00, 1.00, 0.99), lit=0.58, warm=0.22),
    dict(kind='curtain', bays=8, floors=4, mull=0.06, glass=(0.72, 0.62, 0.46), frame=(0.98, 0.94, 0.86), lit=0.60, warm=0.72),
    dict(kind='curtain', bays=10, floors=5, mull=0.11, glass=(0.28, 0.32, 0.36), frame=(0.78, 0.82, 0.84), lit=0.70, warm=0.40),
    dict(kind='punched', bays=8, floors=5, mull=0.28, glass=(0.22, 0.24, 0.26), frame=(0.96, 0.93, 0.88), lit=0.64, warm=0.78),
    dict(kind='banded', bays=6, floors=4, mull=0.16, glass=(0.40, 0.48, 0.52), frame=(0.94, 0.95, 0.96), lit=0.55, warm=0.45),
    dict(kind='resi', bays=8, floors=5, mull=0.18, glass=(0.34, 0.40, 0.44), frame=(0.98, 0.97, 0.94), lit=0.68, warm=0.80),
    dict(kind='old', bays=8, floors=6, mull=0.22, glass=(0.30, 0.32, 0.30), frame=(0.96, 0.90, 0.80), lit=0.74, warm=0.86),
    dict(kind='porthole', bays=8, floors=5, mull=0.0, glass=(0.46, 0.50, 0.48), frame=(0.98, 0.98, 0.96), lit=0.52, warm=0.35),
    dict(kind='stone', bays=6, floors=4, mull=0.30, glass=(0.16, 0.17, 0.16), frame=(0.98, 0.96, 0.90), lit=0.48, warm=0.85),
    dict(kind='metal', bays=8, floors=6, mull=0.22, glass=(0.26, 0.30, 0.32), frame=(0.86, 0.88, 0.90), lit=0.40, warm=0.30),
    dict(kind='led', bays=10, floors=8, mull=0.04, glass=(0.9, 0.9, 0.9), frame=(0.15, 0.16, 0.18), lit=0.92, warm=0.5),
    dict(kind='plain', bays=4, floors=4, mull=0.0, glass=(1, 1, 1), frame=(0.98, 0.98, 0.97), lit=0.0, warm=0.5),
    dict(kind='industrial', bays=6, floors=4, mull=0.34, glass=(0.24, 0.26, 0.27), frame=(0.82, 0.84, 0.82), lit=0.35, warm=0.55),
    dict(kind='heritage', bays=6, floors=4, mull=0.26, glass=(0.18, 0.16, 0.13), frame=(0.95, 0.90, 0.82), lit=0.5, warm=0.9),
]


def paint_facade(style_id):
    S = 512
    st = STYLES[style_id]
    yy, xx = np.mgrid[0:S, 0:S]
    # y-up inside the tile so floor 0 sits on the bottom edge
    y_up = (S - 1 - yy).astype(np.float64)
    x = xx.astype(np.float64)
    bays = st['bays']
    floors = st['floors']
    bw = S / bays
    fh = S / floors
    bay = np.floor(x / bw).astype(np.int32)
    floor = np.floor(y_up / fh).astype(np.int32)
    fx = (x % bw) / bw
    fy = (y_up % fh) / fh
    h = hash2(bay + style_id * 17, floor + 3)
    h2 = hash2(bay + 9, floor * 3 + style_id)

    frame = np.array(st['frame'], dtype=np.float64)
    glass = np.array(st['glass'], dtype=np.float64)
    rgb = np.ones((S, S, 3), dtype=np.float64) * frame
    mask = np.zeros((S, S), dtype=np.float64)
    kind = st['kind']

    # fine grain so flat walls are not plastic
    grain = (hash2(xx // 2, yy // 2) - 0.5) * 0.035
    rgb *= (1.0 + grain[..., None])

    if kind == 'plain':
        seam_x = (fx < 0.015) | (fx > 0.985)
        seam_y = (fy < 0.012) | (fy > 0.988)
        rgb *= np.where((seam_x | seam_y)[..., None], 0.90, 1.0)
    elif kind == 'led':
        # media wall: saturated cells, vertex colour is dark so this is mostly night
        pal = np.array([
            [0.15, 0.55, 1.0],
            [1.0, 0.25, 0.55],
            [1.0, 0.78, 0.25],
            [0.25, 0.9, 0.75],
            [0.95, 0.95, 1.0],
        ])
        idx = (np.floor(h * pal.shape[0])).astype(np.int32) % pal.shape[0]
        cell = pal[idx]
        inset = (fx > 0.06) & (fx < 0.94) & (fy > 0.08) & (fy < 0.92)
        rgb = np.where(inset[..., None], cell, frame)
        mask = np.where(inset, 1.0, 0.0)
    elif kind == 'porthole':
        cx = (bay + 0.5) * bw
        cy = (floor + 0.46) * fh
        # distance in y-up space
        dy = y_up - cy
        dx = x - cx
        rad = bw * 0.30
        inside = (dx * dx + dy * dy) < (rad * rad)
        ring = (dx * dx + dy * dy) < ((rad + 2.2) ** 2)
        shade = 0.72 + 0.28 * np.clip((dy / rad + 1) * 0.5, 0, 1)
        rgb = np.where(inside[..., None], glass * shade[..., None], rgb)
        rgb = np.where((ring & ~inside)[..., None], frame * 0.82, rgb)
        mask = np.where(inside, 1.0, 0.0)
    else:
        mull = st['mull']
        if kind == 'banded':
            win = (fy > 0.18) & (fy < 0.72) & (fx > 0.04) & (fx < 0.96)
            # vertical mullions every bay, thinner
            win = win & (fx > mull * 0.35) & (fx < 1.0 - mull * 0.35)
        elif kind == 'punched':
            win = (fx > 0.30) & (fx < 0.70) & (fy > 0.28) & (fy < 0.78)
        elif kind == 'resi':
            win = (fx > 0.22) & (fx < 0.78) & (fy > 0.30) & (fy < 0.82)
        elif kind == 'old':
            win = (fx > 0.26) & (fx < 0.74) & (fy > 0.34) & (fy < 0.80)
        elif kind == 'stone' or kind == 'heritage':
            win = (fx > 0.32) & (fx < 0.68) & (fy > 0.22) & (fy < 0.78)
            if kind == 'heritage':
                # round the head of the window
                cx = 0.5
                arch = (fy > 0.62) & (((fx - cx) ** 2) / (0.18 ** 2) + ((fy - 0.62) ** 2) / (0.20 ** 2) > 1.0)
                win = win & ~arch
        elif kind == 'industrial':
            win = (fx > 0.36) & (fx < 0.64) & (fy > 0.38) & (fy < 0.74)
            corrug = (np.floor(x / 6.0).astype(np.int32) & 1) == 0
            rgb *= np.where(corrug[..., None], 0.94, 1.03)
        else:
            # curtain wall
            win = (fx > mull) & (fx < 1.0 - mull) & (fy > 0.10 + mull) & (fy < 0.86)
            # spandrel band
            spandrel = (fy >= 0.86) & (fy < 0.98)
            rgb = np.where(spandrel[..., None], frame * 0.78, rgb)

        # sky gradient inside the pane (top lighter)
        grad = 0.78 + 0.28 * fy
        # blinds / closed curtain on some panes
        blind = h2 > 0.82
        pane = np.where(blind[..., None], glass * 0.45, glass * grad[..., None])
        # a thin highlight on the left jamb
        highlight = win & (fx < mull + 0.035)
        rgb = np.where(win[..., None], pane, rgb)
        rgb = np.where(highlight[..., None], np.minimum(rgb * 1.25, 1.0), rgb)
        mask = np.where(win & ~blind, 1.0, 0.0)

        if kind == 'resi':
            balcony = (fy > 0.84) & (fy < 0.93)
            rgb = np.where(balcony[..., None], frame * 0.72, rgb)
            mask = np.where(balcony, 0.0, mask)
        if kind == 'old':
            # air-con boxes under a subset of windows
            ac = (h > 0.72) & (fy < 0.16) & (fx > 0.30) & (fx < 0.70)
            rgb = np.where(ac[..., None], np.array([0.55, 0.58, 0.60]), rgb)
            # laundry flecks
            cloth = (h2 > 0.88) & (fy > 0.16) & (fy < 0.30) & (fx > 0.55) & (fx < 0.72)
            colors = np.array([0.85, 0.25, 0.30])
            rgb = np.where(cloth[..., None], colors, rgb)
        if kind == 'stone':
            joint = (fy < 0.04) | ((np.floor(x / (bw / 2)).astype(np.int32) % 2 == 0) & (fy < 0.045) & (floor % 2 == 1))
            # coursing lines
            course = fy < 0.03
            rgb = np.where(course[..., None], frame * 0.82, rgb)

    # clamp and encode
    rgb = np.clip(rgb, 0.0, 1.0)
    out = np.zeros((S, S, 4), dtype=np.uint8)
    out[..., 0] = srgb_u8(rgb[..., 0])
    out[..., 1] = srgb_u8(rgb[..., 1])
    out[..., 2] = srgb_u8(rgb[..., 2])
    out[..., 3] = np.clip(mask * 255.0, 0, 255).astype(np.uint8)
    return out


def paint_night(style_id):
    S = 512
    st = STYLES[style_id]
    yy, xx = np.mgrid[0:S, 0:S]
    y_up = (S - 1 - yy).astype(np.float64)
    x = xx.astype(np.float64)
    bays = st['bays']
    floors = st['floors']
    bw = S / bays
    fh = S / floors
    bay = np.floor(x / bw).astype(np.int32)
    floor = np.floor(y_up / fh).astype(np.int32)
    fx = (x % bw) / bw
    fy = (y_up % fh) / fh
    h = hash2(bay + style_id * 13, floor + 11)
    floor_cluster = hash2(floor * 5 + style_id, 19)
    kind = st['kind']
    rgb = np.zeros((S, S, 3), dtype=np.float64)
    if st['lit'] <= 0.01 or kind == 'plain':
        out = np.zeros((S, S, 4), dtype=np.uint8)
        out[..., 3] = 255
        return out

    if kind == 'porthole':
        cx = (bay + 0.5) * bw
        cy = (floor + 0.46) * fh
        inside = ((x - cx) ** 2 + (y_up - cy) ** 2) < (bw * 0.28) ** 2
        win = inside
    elif kind == 'banded':
        win = (fy > 0.22) & (fy < 0.68) & (fx > 0.06) & (fx < 0.94)
    elif kind == 'punched':
        win = (fx > 0.32) & (fx < 0.68) & (fy > 0.32) & (fy < 0.74)
    elif kind == 'led':
        win = (fx > 0.06) & (fx < 0.94) & (fy > 0.08) & (fy < 0.92)
    elif kind == 'resi':
        win = (fx > 0.24) & (fx < 0.76) & (fy > 0.34) & (fy < 0.78)
    elif kind == 'old':
        win = (fx > 0.28) & (fx < 0.72) & (fy > 0.36) & (fy < 0.76)
    elif kind in ('stone', 'heritage'):
        win = (fx > 0.34) & (fx < 0.66) & (fy > 0.26) & (fy < 0.74)
    elif kind == 'industrial':
        win = (fx > 0.38) & (fx < 0.62) & (fy > 0.40) & (fy < 0.70)
    else:
        win = (fx > st['mull'] + 0.02) & (fx < 1.0 - st['mull'] - 0.02) & (fy > 0.16) & (fy < 0.82)

    lit = (h > (1.0 - st['lit'])) & (floor_cluster > 0.22)
    warm_amt = st['warm']
    # per-window colour
    warm_col = np.array([1.0, 0.62, 0.28])
    cool_col = np.array([0.55, 0.78, 1.0])
    use_warm = hash2(bay + 4, floor + style_id) < warm_amt
    col = np.where(use_warm[..., None], warm_col, cool_col)
    brightness = 0.45 + 0.55 * hash2(bay * 3 + 1, floor * 7 + style_id)
    if kind == 'led':
        pal = np.array([
            [0.20, 0.65, 1.0],
            [1.0, 0.22, 0.55],
            [1.0, 0.72, 0.18],
            [0.20, 1.0, 0.75],
        ])
        idx = (np.floor(h * 4).astype(np.int32)) % 4
        col = pal[idx]
        brightness = np.full(h.shape, 0.85)
        lit = np.ones(h.shape, dtype=bool)
    glow = col * brightness[..., None]
    # soft falloff toward the pane edge so lights are not hard rectangles
    edge = np.clip(np.minimum(np.minimum(fx, 1 - fx), np.minimum(fy, 1 - fy)) * 6.0, 0, 1)
    rgb = np.where((win & lit)[..., None], glow * (0.65 + 0.35 * edge[..., None]), rgb)
    rgb = np.clip(rgb, 0, 1)
    out = np.zeros((S, S, 4), dtype=np.uint8)
    out[..., 0] = srgb_u8(rgb[..., 0])
    out[..., 1] = srgb_u8(rgb[..., 1])
    out[..., 2] = srgb_u8(rgb[..., 2])
    out[..., 3] = 255
    return out


def stack_atlas(painter):
    atlas = np.zeros((2048, 2048, 4), dtype=np.uint8)
    for s in range(16):
        tile = painter(s)
        tx = s % 4
        ty = s // 4  # 0 = bottom row
        y0 = 2048 - (ty + 1) * 512
        x0 = tx * 512
        atlas[y0:y0 + 512, x0:x0 + 512] = tile
    return atlas


# Generated facade studies. They grade the procedural tiles (which stay
# tileable and aligned to the floor grid) toward real glass, bronze, stone
# and neon colour. Missing files leave the procedural atlas unchanged.
PHOTO_STYLES = {
    0: 'facade-glass-curtain.jpg',
    1: 'facade-glass-curtain.jpg',
    3: 'facade-bronze-glass.jpg',
    4: 'facade-glass-curtain.jpg',
    5: 'facade-granite-punched.jpg',
    7: 'facade-granite-punched.jpg',
    8: 'facade-neon-street.jpg',
}


def _photo_linear(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    m = 0.18
    im = im.crop((int(w * m), int(h * 0.28), int(w * (1 - m)), int(h * (1 - m))))
    im = im.resize((512, 512), Image.BICUBIC)
    arr = np.asarray(im).astype(np.float64) / 255.0
    return np.clip(arr, 0, 1) ** 2.2


def grade_facades(day, night):
    src_dir = os.path.join(ROOT, 'tools', 'gen-facades')
    if not os.path.isdir(src_dir):
        print('facade grades: no tools/gen-facades, procedural only')
        return day, night
    for style, name in PHOTO_STYLES.items():
        path = os.path.join(src_dir, name)
        if not os.path.exists(path):
            continue
        photo = _photo_linear(path)
        blur = np.array(
            Image.fromarray(srgb_u8(photo)).filter(ImageFilter.GaussianBlur(16)),
            dtype=np.float64,
        ) / 255.0
        blur = np.clip(blur, 1e-4, 1) ** 2.2
        detail = np.clip(photo - blur, -0.25, 0.25)
        tx, ty = style % 4, style // 4
        y0 = 2048 - (ty + 1) * 512
        x0 = tx * 512
        src = np.clip(day[y0:y0 + 512, x0:x0 + 512, :3].astype(np.float64) / 255.0, 1e-4, 1) ** 2.2
        mean_src = src.reshape(-1, 3).mean(axis=0)
        target = blur / blur.mean(axis=(0, 1)) * mean_src
        mixed = np.clip(src * 0.48 + target * 0.52 + detail * 0.45, 0, 1)
        day[y0:y0 + 512, x0:x0 + 512, 0] = srgb_u8(mixed[..., 0])
        day[y0:y0 + 512, x0:x0 + 512, 1] = srgb_u8(mixed[..., 1])
        day[y0:y0 + 512, x0:x0 + 512, 2] = srgb_u8(mixed[..., 2])
        if style == 8:
            # neon study drives the night tile's warm window glow
            luma = photo.mean(axis=2)
            glow = np.clip((luma - 0.25) / 0.55, 0, 1)[..., None] * np.array([1.0, 0.72, 0.38])
            nsrc = np.clip(night[y0:y0 + 512, x0:x0 + 512, :3].astype(np.float64) / 255.0, 0, 1) ** 2.2
            nm = np.clip(nsrc * 0.55 + glow * 0.85, 0, 1)
            night[y0:y0 + 512, x0:x0 + 512, 0] = srgb_u8(nm[..., 0])
            night[y0:y0 + 512, x0:x0 + 512, 1] = srgb_u8(nm[..., 1])
            night[y0:y0 + 512, x0:x0 + 512, 2] = srgb_u8(nm[..., 2])
        print('graded style', style, name)
    return day, night


def bake_facades():
    day = stack_atlas(paint_facade)
    night = stack_atlas(paint_night)
    day, night = grade_facades(day, night)
    Image.fromarray(day, 'RGBA').save(os.path.join(OUT, 'facade-atlas.png'), optimize=True)
    Image.fromarray(night, 'RGBA').save(os.path.join(OUT, 'facade-night.png'), optimize=True)
    print('facade', os.path.getsize(os.path.join(OUT, 'facade-atlas.png')),
          'night', os.path.getsize(os.path.join(OUT, 'facade-night.png')))


def fbm(n, seed):
    rng = np.random.RandomState(seed)
    acc = np.zeros((n, n), dtype=np.float64)
    amp = 1.0
    tot = 0.0
    for octv in range(5):
        size = max(2, n // (2 ** octv))
        grid = rng.rand(size, size)
        up = np.array(Image.fromarray((grid * 255).astype(np.uint8), 'L').resize((n, n), Image.BICUBIC), dtype=np.float64) / 255.0
        acc += up * amp
        tot += amp
        amp *= 0.5
    return acc / tot


def bake_foam():
    n = 512
    a = fbm(n, 11)
    b = fbm(n, 29)
    # domain warp
    ang = b * math.tau
    warp = a * 0.65 + (1 - a) * 0.35 * np.roll(np.roll(b, 17, 0), -11, 1)
    lace = np.clip((warp - 0.42) * 3.2, 0, 1) ** 1.4
    # break into streaks so it reads as foam, not clouds
    streaks = np.clip((a - 0.55) * 4.0, 0, 1) * np.clip((b - 0.35) * 2.0, 0, 1)
    foam = np.clip(lace * 0.75 + streaks * 0.55, 0, 1)
    img = Image.fromarray((foam * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.6))
    foam = np.array(img, dtype=np.float64) / 255.0
    rgb = np.zeros((n, n, 4), dtype=np.uint8)
    # warm-white foam; R also carries the mask so the shader can sample .r
    col = srgb_u8(0.93 * foam + 0.04)
    rgb[..., 0] = col
    rgb[..., 1] = srgb_u8(0.90 * foam + 0.05)
    rgb[..., 2] = srgb_u8(0.82 * foam + 0.06)
    rgb[..., 3] = np.clip(foam * 255, 0, 255).astype(np.uint8)
    Image.fromarray(rgb, 'RGBA').save(os.path.join(OUT, 'water-foam.png'), optimize=True)
    print('foam', os.path.getsize(os.path.join(OUT, 'water-foam.png')))


def bake_ground():
    n = 512
    rng = np.random.RandomState(5)
    grain = rng.rand(n, n)
    # two scales of speckle
    fine = np.array(Image.fromarray((rng.rand(128, 128) * 255).astype(np.uint8), 'L').resize((n, n), Image.BILINEAR), dtype=np.float64) / 255.0
    v = 0.90 + grain * 0.08 + (fine - 0.5) * 0.06
    yy, xx = np.mgrid[0:n, 0:n]
    # 1 m joints if the shader samples at 0.5 world units per tile of 64 px (8 joints across 512)
    joint = ((xx % 64) < 2) | ((yy % 64) < 2)
    slab = ((xx // 64 + yy // 64) & 1) == 0
    v = np.where(slab, v * 1.02, v * 0.97)
    v = np.where(joint, v * 0.68, v)
    # slight warm granite
    rgb = np.zeros((n, n, 3), dtype=np.uint8)
    rgb[..., 0] = srgb_u8(np.clip(v * 1.02, 0, 1))
    rgb[..., 1] = srgb_u8(np.clip(v * 0.99, 0, 1))
    rgb[..., 2] = srgb_u8(np.clip(v * 0.94, 0, 1))
    Image.fromarray(rgb, 'RGB').save(os.path.join(OUT, 'ground-atlas.png'), optimize=True)
    print('ground', os.path.getsize(os.path.join(OUT, 'ground-atlas.png')))


SIGNS = [
    ('茶餐廳', 'TEA HOUSE'), ('金行', 'GOLD'), ('藥房', 'PHARMACY'), ('酒家', 'BANQUET'),
    ('大廈', 'MANSION'), ('酒店', 'HOTEL'), ('海鮮', 'SEAFOOD'), ('冰室', 'BING SUTT'),
    ('涼茶', 'HERBAL TEA'), ('夜總會', 'NIGHT CLUB'), ('銀行', 'BANK'), ('火鍋', 'HOTPOT'),
    ('糖水', 'DESSERT'), ('麵家', 'NOODLES'), ('珠寶', 'JEWELS'), ('時裝', 'FASHION'),
    ('電器', 'ELECTRIC'), ('找換', 'EXCHANGE'), ('戲院', 'CINEMA'), ('燒臘', 'SIU MEI'),
    ('賓館', 'GUEST HOUSE'), ('麻雀', 'MAHJONG'), ('中醫', 'HERBAL'), ('酒吧', 'BAR'),
    ('鐘樓', 'CLOCK'), ('星光', 'STARS'), ('維港', 'HARBOUR'), ('天星', 'STAR FERRY'),
    ('山頂', 'THE PEAK'), ('中環', 'CENTRAL'), ('尖沙咀', 'TST'), ('霓虹', 'NEON'),
]

PALETTES = [
    ((255, 45, 85), (255, 209, 102), (18, 6, 10)),
    ((34, 230, 255), (255, 79, 216), (4, 16, 24)),
    ((255, 225, 77), (255, 107, 45), (18, 10, 4)),
    ((124, 255, 107), (34, 230, 255), (4, 18, 10)),
    ((255, 79, 216), (255, 255, 255), (16, 4, 18)),
    ((255, 138, 61), (255, 233, 176), (20, 10, 4)),
    ((255, 255, 255), (255, 45, 85), (8, 8, 14)),
    ((93, 139, 255), (179, 240, 255), (5, 8, 22)),
]


def _glow_text(base, xy, text, font, fill, blur=7):
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text(xy, text, font=font, fill=fill + (255,), anchor='mm')
    glow = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(glow)
    base.alpha_composite(glow)
    core = tuple(min(255, c + 80) for c in fill) + (255,)
    ImageDraw.Draw(base).text(xy, text, font=font, fill=core, anchor='mm')


def bake_neon():
    cells, cell = 8, 256
    size = cells * cell
    atlas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    font_v = ImageFont.truetype(CJK, 62, index=0)
    font_h = ImageFont.truetype(CJK, 54, index=0)
    font_en = ImageFont.truetype(SANS, 20)
    for i, (zh, en) in enumerate(SIGNS):
        # two orientations occupy a pair of tiles: vertical then horizontal
        for orient, slot in (('v', i), ('h', i + 32)):
            cx = slot % cells
            cy = slot // cells
            pal = PALETTES[(cx + cy * 3) % len(PALETTES)]
            tile = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
            d = ImageDraw.Draw(tile)
            bg = pal[2] + (150,)
            d.rounded_rectangle((14, 14, cell - 14, cell - 14), radius=8, fill=bg)
            # neon frame
            frame = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
            ImageDraw.Draw(frame).rounded_rectangle((16, 16, cell - 16, cell - 16), radius=8, outline=pal[0] + (255,), width=6)
            tile.alpha_composite(frame.filter(ImageFilter.GaussianBlur(5)))
            tile.alpha_composite(frame)
            if orient == 'v':
                chars = list(zh)[:5]
                n = max(1, len(chars))
                for k, ch in enumerate(chars):
                    y = 46 + k * ((cell - 78) / n) + ((cell - 78) / n) * 0.5
                    col = pal[1] if k == 0 else pal[0]
                    _glow_text(tile, (cell / 2, y), ch, font_v, col, blur=6)
            else:
                _glow_text(tile, (cell / 2, cell / 2 - 16), zh[:4], font_h, pal[1], blur=6)
                _glow_text(tile, (cell / 2, cell - 42), en, font_en, pal[0], blur=4)
            atlas.paste(tile, (cx * cell, cy * cell))
    atlas.save(os.path.join(OUT, 'neon-atlas.png'), optimize=True)
    print('neon', os.path.getsize(os.path.join(OUT, 'neon-atlas.png')))


def bake_accents():
    """1024 atlas. Clock face occupies the bottom-left 512 (texture v 0–0.5)."""
    S = 1024
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # draw the clock in a 512 box then paste at the bottom-left
    C = 512
    clock = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    d = ImageDraw.Draw(clock)
    cx = cy = C / 2
    r = 228
    # soft outer glow so the face lifts off the brick at night
    glow = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8), fill=(255, 236, 190, 180))
    clock.alpha_composite(glow.filter(ImageFilter.GaussianBlur(10)))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(244, 236, 214, 255))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(42, 36, 28, 255), width=10)
    d.ellipse((cx - r + 16, cy - r + 16, cx + r - 16, cy + r - 16), outline=(120, 96, 64, 255), width=3)
    # ticks
    for i in range(60):
        ang = math.radians(i * 6 - 90)
        inner = r - (28 if i % 5 == 0 else 14)
        outer = r - 18
        x0 = cx + math.cos(ang) * inner
        y0 = cy + math.sin(ang) * inner
        x1 = cx + math.cos(ang) * outer
        y1 = cy + math.sin(ang) * outer
        w = 5 if i % 5 == 0 else 2
        d.line((x0, y0, x1, y1), fill=(28, 24, 18, 255), width=w)
    font = ImageFont.truetype(SERIF, 42)
    romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
    for i, label in enumerate(romans):
        ang = math.radians(i * 30 - 90)
        rad = r - 62
        d.text((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad), label, font=font, fill=(28, 22, 16, 255), anchor='mm')
    # hands at 10:10 — the postcard time
    def hand(minutes_from_12, length, width, color):
        ang = math.radians(minutes_from_12 / 60.0 * 360.0 - 90)
        x1 = cx + math.cos(ang) * length
        y1 = cy + math.sin(ang) * length
        x2 = cx - math.cos(ang) * (length * 0.18)
        y2 = cy - math.sin(ang) * (length * 0.18)
        d.line((x2, y2, x1, y1), fill=color, width=width)
    hand(10 * 60 / 12, 118, 10, (32, 26, 20, 255))   # hour toward 10
    hand(10, 168, 7, (32, 26, 20, 255))               # minute toward 2? 10:10 minute is at 2
    # 10:10 → hour near 10, minute at 2 (10 minutes)
    # redo minute: 10 min = 60 degrees. hand() treats minutes_from_12 as minutes on a 60 clock.
    # I passed 10 which is 10 minutes = the 2. Good.
    # hour at 10: the hour hand is at 10 * 5 minutes = 50, plus a nudge. hand(50, ...)
    # I passed 10*60/12 = 50. Yes that's the 10. Good.
    d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=(176, 132, 48, 255))
    d.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(40, 32, 20, 255))
    # paste at bottom-left of the 1024 image (high PIL y)
    im.paste(clock, (0, S - C))

    # small gold bauhinia-like rosette, top-left, used as a harbour accent decal if wanted
    # keep the rest of the atlas empty/transparent
    im.save(os.path.join(OUT, 'landmark-accents.png'), optimize=True)
    print('accent', os.path.getsize(os.path.join(OUT, 'landmark-accents.png')))


def main():
    os.makedirs(OUT, exist_ok=True)
    bake_facades()
    bake_foam()
    bake_ground()
    bake_neon()
    bake_accents()
    print('wrote', OUT)


if __name__ == '__main__':
    main()
