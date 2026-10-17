#!/usr/bin/env python3
"""Download OpenStreetMap building footprints for Victoria Harbour and
project them into the voxel model's coordinates.

Source: OpenStreetMap (ODbL). https://www.openstreetmap.org/copyright
The map API is queried in small tiles. Output is js/footprints.js, which
the city builder extrudes. No network at runtime.

    python3 tools/fetch-footprints.py
"""
import json
import math
import os
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'footprints.js')
CACHE = os.path.join(ROOT, 'data', 'osm-tiles')
UA = 'hk-victoria-voxel/1.2 (research voxel harbour; local educational sandbox)'

# (south, west, north, east) — waterfront bands that read from the ferry
REGIONS = [
    (22.2770, 114.1480, 22.2905, 114.1900),  # Central → Causeway Bay
    (22.2905, 114.1580, 22.3065, 114.1880),  # TST → Hung Hom
    (22.2960, 114.1480, 22.3105, 114.1660),  # West Kowloon / ICC
]
STEP = 0.004

# name fragments → model anchor (x, z). Used only to fit the projection.
ANCHORS = [
    (['two international finance', '國際金融中心二期'], -318, 352),
    (['one international finance', '國際金融中心一期'], -252, 404),
    (['bank of china tower', '中銀大廈'], -28, 408),
    (['cheung kong center', 'cheung kong centre', '長江集團中心'], -62, 468),
    (['jardine house', '怡和大廈'], -222, 442),
    (['the center', '中環中心'], -92, 512),
    (['hsbc main', '滙豐總行大廈', '滙豐銀行總行'], -120, 424),
    (['international commerce centre', '環球貿易廣場'], -962, -424),
    (['convention and exhibition centre', '香港會議展覽中心'], 246, 322),
    (['central plaza', '中環廣場'], 300, 392),
    (['hopewell centre', '合和中心'], 322, 452),
    (['the peninsula', '半島酒店'], -286, -386),
    (['lippo centre', '力寶中心'], 70, 455),
    (['pacific place', '太古廣場'], 52, 505),
    (['exchange square', '交易廣場'], -190, 430),
    (['clock tower', '前九廣鐵路鐘樓', '尖沙咀鐘樓'], -182, -336),
    (['harbour city', '海港城'], -424, -356),
    (['hong kong cultural centre', '香港文化中心'], -132, -356),
    (['1881 heritage', '前水警總部'], -198, -352),
    (['k11 musea'], 130, -356),
]

# Hand-authored spots that do not follow the real plan. They are relocated
# onto the fitted map instead of being used as control points.
EXCLUDE_ANCHOR = ('the center', '中環中心')

# Roof heights in metres for named towers OSM often leaves untagged.
# Landmarks already modelled by hand are skipped when they overlap a reservation;
# these still help the mid-rise neighbours that are only in OSM.
KNOWN_H = [
    ('two international finance', 415),
    ('國際金融中心二期', 415),
    ('one international finance', 210),
    ('國際金融中心一期', 210),
    ('bank of china tower', 367),
    ('中銀大廈', 367),
    ('cheung kong', 283),
    ('長江集團中心', 283),
    ('jardine house', 178),
    ('怡和大廈', 178),
    ('the center', 346),
    ('中環中心', 346),
    ('hsbc main', 179),
    ('滙豐總行', 179),
    ('international commerce centre', 484),
    ('環球貿易廣場', 484),
    ('central plaza', 374),
    ('中環廣場', 374),
    ('hopewell', 216),
    ('合和中心', 216),
    ('lippo centre', 186),
    ('力寶中心', 186),
    ('exchange square', 188),
    ('交易廣場', 188),
    ('one island east', 298),
    ('港島東中心', 298),
    ('the henderson', 190),
    ('aia central', 185),
    ('citibank plaza', 205),
    ('champion tower', 205),
    ('entertainment building', 147),
    ('man yee', 146),
    ('萬宜大廈', 146),
    ('chater house', 137),
    ('遮打大廈', 137),
    ('sun hung kai centre', 215),
    ('新鴻基中心', 215),
    ('great eagle centre', 197),
    ('鷹君中心', 197),
    ('convention plaza', 180),
    ('revenue tower', 182),
    ('稅務大樓', 182),
    ('immigration tower', 181),
    ('入境事務大樓', 181),
    ('wanchai tower', 180),
    ('灣仔政府大樓', 180),
    ('times square', 194),
    ('時代廣場', 194),
    ('windsor house', 160),
    ('皇室堡', 160),
    ('world trade centre', 152),
    ('世貿中心', 152),
    ('sino plaza', 185),
    ('信和廣場', 185),
    ('langham place', 255),
    ('朗豪坊', 255),
    ('the one', 140),
    ('isquare', 155),
    ('國際廣場', 155),
    ('victoria dockside', 110),
    ('k11 musea', 40),
    ('harbour city', 30),
    ('海港城', 30),
    ('ocean terminal', 20),
    ('海運大廈', 20),
    ('chungking mansions', 55),
    ('重慶大廈', 55),
    ('miramar', 80),
    ('美麗華', 80),
    ('the masterpiece', 257),
    ('名鑄', 257),
    ('the harbourfront landmark', 233),
    ('海名軒', 233),
    ('the arch', 231),
    ('凱旋門', 231),
    ('the cullinan', 270),
    ('天璽', 270),
    ('sorrent', 256),
    ('擎天半島', 256),
    ('the waterfront', 142),
    ('港景匯', 142),
    ('shun tak centre', 160),
    ('信德中心', 160),
    ('cosmopolitan hotel', 100),
]


def tiles():
    seen = set()
    out = []
    for south, west, north, east in REGIONS:
        lat = south
        while lat < north - 1e-9:
            lon = west
            lat2 = min(north, lat + STEP)
            while lon < east - 1e-9:
                lon2 = min(east, lon + STEP)
                key = (round(lat, 5), round(lon, 5))
                if key not in seen:
                    seen.add(key)
                    out.append((lat, lon, lat2, lon2))
                lon = lon2
            lat = lat2
    return out


def cache_path(bbox):
    s, w, n, e = bbox
    name = 's%.4f_w%.4f_n%.4f_e%.4f.xml' % (s, w, n, e)
    return os.path.join(CACHE, name)


def fetch(bbox, depth=0):
    path = cache_path(bbox)
    if os.path.exists(path) and os.path.getsize(path) > 500:
        return [path]
    s, w, n, e = bbox
    url = 'https://api.openstreetmap.org/api/0.6/map?bbox=%.5f,%.5f,%.5f,%.5f' % (w, s, e, n)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = resp.read()
    except Exception as ex:
        msg = str(ex)
        if depth < 2 and ('400' in msg or '509' in msg or 'too many' in msg.lower()):
            ms, mw = (s + n) / 2, (w + e) / 2
            acc = []
            for sub in ((s, w, ms, mw), (s, mw, ms, e), (ms, w, n, mw), (ms, mw, n, e)):
                acc.extend(fetch(sub, depth + 1))
            return acc
        print('  fail', bbox, msg[:160])
        return []
    text = data[:400].decode('utf-8', 'replace').lower()
    if b'<osm' not in data[:200] or 'too many' in text or '<error' in text:
        if depth < 2 and (n - s) > 0.0015:
            ms, mw = (s + n) / 2, (w + e) / 2
            acc = []
            for sub in ((s, w, ms, mw), (s, mw, ms, e), (ms, w, n, mw), (ms, mw, n, e)):
                time.sleep(0.4)
                acc.extend(fetch(sub, depth + 1))
            return acc
        print('  bad tile', bbox, data[:120])
        return []
    os.makedirs(CACHE, exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)
    return [path]


def parse_height(tags, name):
    h = tags.get('height') or tags.get('building:height')
    if h:
        h = h.replace('m', '').replace(',', '.').strip()
        try:
            v = float(h)
            if 4 < v < 520:
                return v
        except ValueError:
            pass
    lv = tags.get('building:levels')
    if lv:
        try:
            v = float(lv)
            if 1 < v < 130:
                return v * 3.35
        except ValueError:
            pass
    lname = (name or '').lower()
    for frag, meters in KNOWN_H:
        if frag in lname:
            return float(meters)
    return None


def parse_file(path):
    nodes = {}
    buildings = []
    # iterparse keeps memory flat on multi-megabyte tiles
    for ev, elem in ET.iterparse(path, events=('end',)):
        if elem.tag == 'node':
            nodes[elem.get('id')] = (float(elem.get('lat')), float(elem.get('lon')))
            elem.clear()
        elif elem.tag == 'way':
            tags = {t.get('k'): t.get('v') for t in elem.findall('tag')}
            kind = tags.get('building')
            part = tags.get('building:part')
            if kind and kind != 'no':
                nds = [n.get('ref') for n in elem.findall('nd')]
                buildings.append((elem.get('id'), tags, nds, False))
            elif part and part != 'no':
                nds = [n.get('ref') for n in elem.findall('nd')]
                buildings.append((elem.get('id'), tags, nds, True))
            elem.clear()
        elif elem.tag == 'relation':
            elem.clear()
    out = []
    for wid, tags, nds, is_part in buildings:
        pts = [nodes[i] for i in nds if i in nodes]
        if len(pts) < 3:
            continue
        lats = [p[0] for p in pts]
        lons = [p[1] for p in pts]
        name = tags.get('name') or tags.get('name:en') or ''
        h = parse_height(tags, name)
        out.append({
            'id': int(wid),
            'name': name,
            'lat': sum(lats) / len(lats),
            'lon': sum(lons) / len(lons),
            'minlat': min(lats), 'maxlat': max(lats),
            'minlon': min(lons), 'maxlon': max(lons),
            'h': h,
            'part': is_part,
            'levels': tags.get('building:levels') or '',
        })
    return out


def fit_affine(pairs):
    """x = a*lon + b*lat + c ; z = d*lon + e*lat + f"""
    import numpy as np
    A = []
    bx = []
    bz = []
    for lon, lat, x, z in pairs:
        A.append([lon, lat, 1.0])
        bx.append(x)
        bz.append(z)
    A = np.array(A, dtype=np.float64)
    cx, *_ = np.linalg.lstsq(A, np.array(bx), rcond=None)
    cz, *_ = np.linalg.lstsq(A, np.array(bz), rcond=None)
    return cx, cz


def project(lon, lat, cx, cz):
    x = cx[0] * lon + cx[1] * lat + cx[2]
    z = cz[0] * lon + cz[1] * lat + cz[2]
    return float(x), float(z)


def main():
    todo = tiles()
    print('tiles', len(todo))
    paths = []
    # polite pool: the public map API is shared
    with ThreadPoolExecutor(max_workers=3) as pool:
        futs = []
        for i, bbox in enumerate(todo):
            futs.append(pool.submit(fetch, bbox))
            if i % 3 == 2:
                time.sleep(0.15)
        done = 0
        for fut in as_completed(futs):
            paths.extend(fut.result())
            done += 1
            if done % 10 == 0:
                print('  fetched', done, '/', len(todo))
    print('files', len(paths))

    raw = []
    seen = set()
    for p in paths:
        try:
            rows = parse_file(p)
        except ET.ParseError as ex:
            print('  parse', p, ex)
            continue
        for b in rows:
            if b['id'] in seen:
                continue
            seen.add(b['id'])
            raw.append(b)
    print('raw footprints', len(raw), 'parts', sum(1 for b in raw if b['part']))

    # drop building:parts whose centre sits inside a real building outline
    outlines = [b for b in raw if not b['part']]
    kept = list(outlines)
    for b in raw:
        if not b['part']:
            continue
        inside = False
        for o in outlines:
            if o['minlat'] <= b['lat'] <= o['maxlat'] and o['minlon'] <= b['lon'] <= o['maxlon']:
                inside = True
                break
        if not inside and (b['h'] or 0) >= 30:
            kept.append(b)
    print('kept', len(kept))

    # anchor fit — one affine per shore. A single plane cannot describe both,
    # because the model stretches West Kowloon much further west than the island.
    bad_name = ('停車場', 'car park', 'parking', '車場')
    pairs = []
    for frags, ax, az in ANCHORS:
        if any(f in frags for f in EXCLUDE_ANCHOR):
            continue
        cands = []
        for b in kept:
            if b['part'] or not b['name']:
                continue
            raw = b['name']
            low = raw.lower()
            if any(s in raw or s in low for s in bad_name):
                continue
            if not any((f in low) or (f in raw) for f in frags):
                continue
            area = (b['maxlat'] - b['minlat']) * (b['maxlon'] - b['minlon'])
            cands.append(((b['h'] or 0) * 10 + area * 1e6, b, area))
        if not cands:
            print('  missing anchor', frags[0])
            continue
        cands.sort(key=lambda t: -t[0])
        b = cands[0][1]
        pairs.append((b['lon'], b['lat'], ax, az, b['name'], az >= 0))
    print('anchors', len(pairs))
    for lon, lat, ax, az, name, island in pairs:
        print('  %-32s lon %.5f lat %.5f -> %d,%d %s' % (name[:32], lon, lat, ax, az, 'HK' if island else 'KL'))
    island_pairs = [p for p in pairs if p[5]]
    kowloon_pairs = [p for p in pairs if not p[5]]
    if len(island_pairs) < 4:
        raise SystemExit('not enough island anchors')

    def refit(group, thresh):
        cx, cz = fit_affine([(p[0], p[1], p[2], p[3]) for p in group])
        scored = []
        for p in group:
            x, z = project(p[0], p[1], cx, cz)
            scored.append((math.hypot(x - p[2], z - p[3]), p))
        inliers = [p for err, p in scored if err <= thresh]
        if len(inliers) >= 4 and len(inliers) < len(group):
            cx, cz = fit_affine([(p[0], p[1], p[2], p[3]) for p in inliers])
        elif len(inliers) < 4:
            inliers = group
        return cx, cz, inliers

    cx_i, cz_i, in_i = refit(island_pairs, 70)
    print('island affine x', [round(v, 2) for v in cx_i])
    print('island affine z', [round(v, 2) for v in cz_i])
    inlier_ids = set(id(p) for p in in_i)
    for p in island_pairs:
        x, z = project(p[0], p[1], cx_i, cz_i)
        flag = 'IN' if id(p) in inlier_ids else 'OUT'
        print('  HK %-22s %s dx %6.1f dz %6.1f' % (p[4][:22], flag, x - p[2], z - p[3]))

    if len(kowloon_pairs) >= 4:
        cx_k, cz_k, in_k = refit(kowloon_pairs, 80)
    elif len(kowloon_pairs) >= 2:
        cx_k, cz_k = fit_affine([(p[0], p[1], p[2], p[3]) for p in kowloon_pairs])
        in_k = kowloon_pairs
    else:
        cx_k, cz_k, in_k = cx_i, cz_i, []
    print('kowloon anchors used', len(in_k))
    for p in kowloon_pairs:
        x, z = project(p[0], p[1], cx_k, cz_k)
        print('  KL %-22s dx %6.1f dz %6.1f' % (p[4][:22], x - p[2], z - p[3]))

    # where the excluded icons actually fall, so the hand models can move
    print('relocate:')
    for b in kept:
        if b['part'] or not b['name']:
            continue
        low = b['name'].lower()
        if '中環中心' in b['name'] or 'the center' in low or 'henderson' in low or 'the henderson' in b['name'].lower():
            shore_x = cx_i if b['lat'] < 22.2905 else cx_k
            shore_z = cz_i if b['lat'] < 22.2905 else cz_k
            x, z = project(b['lon'], b['lat'], shore_x, shore_z)
            print('  %-28s -> %.1f, %.1f  h=%s' % (b['name'][:28], x, z, b['h']))

    m_lon = 111320.0 * math.cos(math.radians(22.29))
    m_lat = 110540.0

    def scale_of(cx, cz):
        east = math.hypot(cx[0] / m_lon, cz[0] / m_lon)
        north = math.hypot(cx[1] / m_lat, cz[1] / m_lat)
        return east, north

    sx_i, sz_i = scale_of(cx_i, cz_i)
    sx_k, sz_k = scale_of(cx_k, cz_k)
    print('island units/m  east %.4f north %.4f' % (sx_i, sz_i))
    print('kowloon units/m east %.4f north %.4f' % (sx_k, sz_k))

    def place_xz(lon, lat):
        if lat < 22.2905:
            cx, cz, inliers = cx_i, cz_i, in_i
        else:
            cx, cz, inliers = cx_k, cz_k, in_k
        x, z = project(lon, lat, cx, cz)
        numx = numz = den = 0.0
        for p in inliers:
            d2 = ((lon - p[0]) * m_lon) ** 2 + ((lat - p[1]) * m_lat) ** 2
            if d2 > 700.0 * 700.0:
                continue
            ax, az = project(p[0], p[1], cx, cz)
            wgt = 1.0 / (d2 / (180.0 * 180.0) + 0.04)
            numx += wgt * (p[2] - ax)
            numz += wgt * (p[3] - az)
            den += wgt
        if den > 0:
            x += numx / den
            z += numz / den
        return x, z

    # central cluster, used to lift untagged commercial plots
    def estimate_h(b, x, z):
        if b['h']:
            return b['h']
        w_m = (b['maxlon'] - b['minlon']) * m_lon
        d_m = (b['maxlat'] - b['minlat']) * m_lat
        area = max(40.0, w_m * d_m)
        rnd = (b['id'] * 1103515245 + 12345) & 0x7fffffff
        u = (rnd % 1000) / 1000.0
        base = 12.0 + min(70.0, area / 90.0) + u * 10.0
        # Central / Admiralty core runs taller than the raw footprint implies
        if -360 < x < 360 and 300 < z < 560:
            base *= 1.35
        elif -1100 < x < -560 and -560 < z < -280:
            base *= 1.15
        return max(10.0, min(160.0, base))

    rows = []
    for b in kept:
        if b['part'] and not b['h']:
            continue
        w_m = (b['maxlon'] - b['minlon']) * m_lon
        d_m = (b['maxlat'] - b['minlat']) * m_lat
        if w_m < 8 or d_m < 8 or w_m > 280 or d_m > 280:
            continue
        x, z = place_xz(b['lon'], b['lat'])
        if x < -1900 or x > 1900 or z < -980 or z > 980:
            continue
        sx, sz = (sx_i, sz_i) if b['lat'] < 22.2905 else (sx_k, sz_k)
        # map metres through the fitted scale, but never a needle and never
        # fatter than the true 2 m per unit the landmarks are drawn at
        w = w_m * sx
        d = d_m * sz
        true_w = w_m * 0.5
        true_d = d_m * 0.5
        w = min(true_w, max(w, true_w * 0.62))
        d = min(true_d, max(d, true_d * 0.62))
        w = max(2.5, min(36.0, w))
        d = max(2.5, min(36.0, d))
        # snap to 1 m (0.5 unit)
        w = round(w * 2) / 2
        d = round(d * 2) / 2
        h_m = estimate_h(b, x, z)
        h = max(4.0, min(250.0, h_m * 0.5))
        h = round(h * 2) / 2
        x = round(x * 2) / 2
        z = round(z * 2) / 2
        rows.append((x, z, w, d, h, 1 if b['h'] else 0))

    # taller footprint wins when two outlines share a centre
    rows.sort(key=lambda r: -r[4])
    placed = []
    for r in rows:
        ok = True
        for p in placed:
            if abs(r[0] - p[0]) < (r[2] + p[2]) * 0.35 and abs(r[1] - p[1]) < (r[3] + p[3]) * 0.35:
                ok = False
                break
        if ok:
            placed.append(r)
    print('projected', len(placed), 'measured-height', sum(1 for r in placed if r[5]))

    # pack x,z,w,d,h — drop the measured flag (height is already in units)
    flat = []
    for x, z, w, d, h, _flag in placed:
        flat.extend((x, z, w, d, h))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('/* ============================================================================\n')
        f.write(' * HK VOXEL HARBOUR — OSM BUILDING FOOTPRINTS\n')
        f.write(' * Building outlines for the Central, Admiralty, Wan Chai, Causeway Bay,\n')
        f.write(' * Tsim Sha Tsui, West Kowloon and Hung Hom waterfronts.\n')
        f.write(' *\n')
        f.write(' * Source: OpenStreetMap contributors, ODbL 1.0.\n')
        f.write(' * https://www.openstreetmap.org/copyright\n')
        f.write(' * Heights: OSM height / building:levels where present, otherwise a\n')
        f.write(' * district-scaled estimate. Regenerated by tools/fetch-footprints.py.\n')
        f.write(' * Each record is x, z, w, d, h in model units (1 unit = 2 m, 0.5 = 1 m).\n')
        f.write(' * ==========================================================================*/\n')
        f.write('(function () {\n')
        f.write('  window.HK = window.HK || {};\n')
        f.write('  HK.FOOTPRINTS = {\n')
        f.write("    source: 'OpenStreetMap contributors, ODbL',\n")
        f.write('    count: %d,\n' % len(placed))
        f.write('    b: [\n')
        line = []
        for i, v in enumerate(flat):
            line.append(('%g' % v))
            if len(line) == 20:
                f.write('      ' + ','.join(line) + ',\n')
                line = []
        if line:
            f.write('      ' + ','.join(line) + '\n')
        f.write('    ]\n')
        f.write('  };\n')
        f.write('})();\n')
    print('wrote', OUT, 'buildings', len(placed))


if __name__ == '__main__':
    main()
