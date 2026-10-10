"""Cut the realistic hero sprite sheet (assets/char/real/src/sheet.jpg, figures on a baked-in grey/black checkerboard) into frames.
Output: assets/char/real/<name>.png (RGBA, feet at the bottom edge) + assets/char/real/frames.json.   Usage: python3 tools/cut_real_sprites.py [--debug out.png]"""
import sys, json, os
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'assets/char/real/src/sheet.jpg'; OUT = 'assets/char/real'
im = Image.open(SRC).convert('RGB'); A = np.array(im).astype(np.int16); H, W = A.shape[:2]
v = A.mean(2); sat = A.max(2) - A.min(2)
# baked checkerboard: neutral pixels at one of the two checker levels are background; JPEG-blurred pixels between the two levels are background
# only where a dark AND a grey checker pixel are both within 2 px (a square edge) - so dark-grey shoes next to a black square stay
neutral = sat < 9
dk = neutral & (v < 24); gr = neutral & (v > 84) & (v < 122)
def dil(m, n): return np.array(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(n))) > 127
edge = neutral & (v >= 24) & (v <= 84) & dil(dk, 5) & dil(gr, 5)
bg = dk | gr | edge
fg = ~bg
# clean: open (remove checker noise), close (heal bites), fill holes (grey shirt patches / dark shoes inside the body)
def mf(mask, f, n): return np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(f(n))) > 127
fg = mf(mf(fg, ImageFilter.MinFilter, 3), ImageFilter.MaxFilter, 3)
fg = mf(mf(fg, ImageFilter.MaxFilter, 5), ImageFilter.MinFilter, 5)
holes = Image.fromarray(((~fg) * 255).astype(np.uint8)).copy(); ImageDraw.floodfill(holes, (0, 0), 128)
fg = fg | (np.array(holes) == 255)
# connected components
lab = np.zeros((H, W), np.int32); comps = []; n = 0
ys, xs = np.nonzero(fg)
for y0, x0 in zip(ys, xs):
    if lab[y0, x0]: continue
    n += 1; q = deque([(y0, x0)]); lab[y0, x0] = n; x_0 = x_1 = x0; y_0 = y_1 = y0; cnt = 0
    while q:
        y, x = q.popleft(); cnt += 1
        x_0 = min(x_0, x); x_1 = max(x_1, x); y_0 = min(y_0, y); y_1 = max(y_1, y)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and fg[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; q.append((yy, xx))
    comps.append({'id': n, 'box': [int(x_0), int(y_0), int(x_1) + 1, int(y_1) + 1], 'n': cnt})
bodies = [c for c in comps if c['n'] > 900 and (c['box'][3] - c['box'][1]) > 60]
print(len(comps), 'components,', len(bodies), 'figures')
json.dump([c['box'] for c in sorted(bodies, key=lambda c: (c['box'][1] // 120, c['box'][0]))], open('/tmp/claude-0/-home-user-Bambul-game-/15896bcf-4a64-5ae7-b6bc-cb0dc4c4a85d/scratchpad/boxes.json', 'w'))
for c in sorted(bodies, key=lambda c: (c['box'][1] // 120, c['box'][0])): print(c['box'], c['n'])
np.save('/tmp/claude-0/-home-user-Bambul-game-/15896bcf-4a64-5ae7-b6bc-cb0dc4c4a85d/scratchpad/lab.npy', lab)
if '--debug' in sys.argv:
    d = np.zeros((H, W, 3), np.uint8); d[:] = (255, 0, 255); m = fg; d[m] = np.array(im)[m]
    Image.fromarray(d).save(sys.argv[sys.argv.index('--debug') + 1])

# ---------------------------------------------------------------- export
# each body = its main component + small parts fully inside its box (fingers, a shoe cut off by the checker); split figures are merged by hand below.
NAMES = {  # (row, index in row) -> frame name; rows are ordered by y, see the sheet labels
    'A': ['walk_%d' % i for i in range(7)], 'B': ['run_%d' % i for i in range(8)],
    'C': ['crouch', 'crouch2', 'jump', 'air', 'reach', 'side'],
    'D': ['lift_0', 'lift_1', 'carry_front', 'phone_0', 'phone_1', 'carry_0', 'carry_1', 'carry_2'],
    'E': ['call_0', 'call_1', 'call_2', 'call_3', 'call_4'], 'F': ['idle_%d' % i for i in range(4)]}
ROWS = [('A', 0, 220), ('B', 220, 420), ('C', 420, 600), ('D', 630, 800), ('E', 820, 1000), ('F', 1020, H)]
# body height in px of a standing figure of that row -> all rows share one cm scale (175 cm hero)
STAND = {'A': 163, 'B': 163, 'C': 142, 'D': 130, 'E': 143, 'F': 138}
UP = 4                          # output px per source px for row A; other rows are rescaled to match
bodies = sorted(bodies, key=lambda c: c['box'][1])
def rowof(c):
    cy = c['box'][3]
    for r, a, b in ROWS:
        if a <= cy < b: return r
groups = {}
for c in bodies:
    r = rowof(c)
    if r is None or (r == 'D' and c['box'][3] - c['box'][1] < 70 and c['box'][1] > 700): continue   # lower half of the split carry figure, merged below
    if c['box'][2] - c['box'][0] > 300: continue            # separator line
    groups.setdefault(r, []).append(c)
for r in groups: groups[r].sort(key=lambda c: c['box'][0])
def comps_in(box, pad):
    x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
    return [c for c in comps if c['n'] >= 25 and c['box'][0] >= x0 and c['box'][1] >= y0 and c['box'][2] <= x1 and c['box'][3] <= y1]
def merged(c):
    box = list(c['box']); ids = {c['id']}
    # glue a body part split off by the checkerboard (a component right under / beside the body, overlapping it horizontally)
    for o in bodies:
        if o['id'] == c['id']: continue
        b = o['box']; hov = min(b[2], box[2]) - max(b[0], box[0])
        if hov > 10 and 0 <= b[1] - box[3] <= 8: ids.add(o['id']); box = [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
    for o in comps_in(box, 1): ids.add(o['id'])
    return box, ids
if '--export' in sys.argv:
    sys.path.insert(0, os.path.dirname(__file__))
    net = None
    try:
        import esrgan; net = esrgan.load(sys.argv[sys.argv.index('--export') + 1])
    except Exception as e: print('Real-ESRGAN unavailable, Lanczos only:', e)
    meta = {'cmPerPx': {}, 'frames': {}}
    rgb = np.array(im)
    for r, lst in groups.items():
        names = NAMES[r]
        if len(lst) != len(names): print('row', r, 'has', len(lst), 'figures, expected', len(names)); continue
        sc = UP * STAND['A'] / STAND[r]                                   # output px per source px in this row
        for c, name in zip(lst, names):
            box, ids = merged(c); P = 4
            x0, y0, x1, y1 = max(0, box[0] - P), max(0, box[1] - P), min(W, box[2] + P), min(H, box[3] + P)
            m = np.isin(lab[y0:y1, x0:x1], list(ids))
            # checker leftovers: neutral grey/black blobs far from any coloured body pixel (skin, shirt, shorts); shoes and phone sit close to skin, so they stay
            cs = sat[y0:y1, x0:x1]; neu = m & (cs < 11)
            col = Image.fromarray(((m & ~neu) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(17))
            m = m & ~(neu & ~(np.array(col) > 127))
            # keep only pieces of real size, then fill pinholes again
            ml = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)); m = np.array(ml) > 127
            crop = rgb[y0:y1, x0:x1].copy().astype(np.float32)
            # replace the checker behind the figure with nearby body colour, so neither upscaler smears black/grey into the edge
            fill = crop.copy(); mm = m.copy()
            for _ in range(6):
                acc = np.zeros_like(fill); cnt = np.zeros(mm.shape, np.float32)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    sh = np.roll(np.roll(fill * mm[..., None], dy, 0), dx, 1); cm = np.roll(np.roll(mm, dy, 0), dx, 1)
                    acc += sh; cnt += cm
                new = (~mm) & (cnt > 0); fill[new] = acc[new] / cnt[new][:, None]; mm = mm | new
            fill[~mm] = crop[m].mean(0)
            src = Image.fromarray(fill.clip(0, 255).astype(np.uint8))
            ow, oh = round(src.width * sc), round(src.height * sc)
            lz = src.resize((ow, oh), Image.LANCZOS)
            if net is not None:
                es = esrgan.upscale(net, src).resize((ow, oh), Image.LANCZOS)
                out = Image.blend(es, lz, .45)          # Real-ESRGAN edges + Lanczos texture (ESRGAN alone smooths the face to plastic)
            else: out = lz
            # alpha: mask eroded by 1 source px (JPEG halo of the checker), upscaled smoothly
            am = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).resize((ow, oh), Image.BICUBIC).filter(ImageFilter.GaussianBlur(sc * .35))
            a = np.array(am).astype(np.float32); a = ((a - 70) / (200 - 70) * 255).clip(0, 255).astype(np.uint8)
            o = np.dstack([np.array(out), a]); ys_, xs_ = np.nonzero(a > 20)
            o = o[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]
            al = o[..., 3] > 128
            # anchors: feet = lowest opaque row; x = centre of the torso band (35..60 % of the figure height from the top)
            hh = al.shape[0]; band = al[int(hh * .35):int(hh * .6)]
            cols = np.nonzero(band.any(0))[0]; xs2 = np.nonzero(band)[1]
            ax = float(xs2.mean()) if len(xs2) else al.shape[1] / 2
            Image.fromarray(o).save(os.path.join(OUT, name + '.webp'), quality=90, method=6)
            meta['frames'][name] = {'w': int(o.shape[1]), 'h': int(o.shape[0]), 'ax': round(ax, 1), 'ay': int(o.shape[0])}
            print(name, o.shape[1], 'x', o.shape[0])
    meta['cmPerPx'] = round(175 / (STAND['A'] * UP), 5)
    json.dump(meta, open(os.path.join(OUT, 'frames.json'), 'w'), indent=1)
    open('js/real_frames.js', 'w').write('/* generated by tools/cut_real_sprites.py - frame sizes and feet/torso anchors of assets/char/real/*.webp */\nwindow.BB = window.BB || {}; window.BB.REAL_META = ' + json.dumps(meta) + ';\n')
