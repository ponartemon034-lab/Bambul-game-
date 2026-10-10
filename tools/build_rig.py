"""Cut the painted side-view hero frame (assets/char/hero_run_1.png) into the parts of the physical rig (js/rig.js).

v2: no pixel-voronoi cutting. Every part has a clean region:
  head      rigid, polygon above the collar
  torso     rigid: shirt + shorts waist (y <= 134); sleeve and the area behind the forearm are painted out of it
  sleeve    rigid chunk of the shirt sleeve (feathered on the shirt side)
  forearm   rigid skin part (+ a few pixels of extension that hide under the sleeve)
  leg       ONE ribbon texture for the whole near leg (shorts + shin, unrolled along hip-knee-ankle).  It is bent at run time
            slice by slice, so the knee has no seam and no gap. Both legs use it (the far one is darkened).
  shoe      rigid shoe (non-skin pixels of the foot), both feet use it
Output: assets/char/rig/*.png + rig.json   Usage: python3 tools/build_rig.py [--debug]
"""
import sys, json, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'assets/char/hero_run_1.png'; OUT = 'assets/char/rig'
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.png'): os.remove(os.path.join(OUT, f))
im = Image.open(SRC).convert('RGBA'); A = np.array(im); H, W = A.shape[:2]
alpha = A[..., 3] > 24
yy, xx = np.mgrid[0:H, 0:W]
R_, G_, B_ = [A[..., i].astype(int) for i in range(3)]
skin = ((R_ - G_) > 44) & (G_ >= B_ - 4) & alpha

def poly(pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255); return np.array(m) > 0

# ---- regions (source px) ---------------------------------------------------------------------------------------
HEAD = poly([(112, 0), (172, 0), (172, 44), (152, 48), (130, 46), (113, 41)])
FARARM = poly([(60, 50), (97, 50), (99, 74), (93, 102), (64, 102)])
SLEEVE = poly([(121, 50), (151, 54), (154, 84), (156, 90), (145, 94), (133, 97), (127, 91), (122, 72)])
NEARLEG = poly([(128, 112), (150, 112), (148, 132), (151, 150), (152, 162), (156, 175), (160, 195), (164, 210), (163, 221), (152, 228),
                (140, 226), (139, 212), (135, 198), (134, 184), (133, 172), (126, 166), (115, 162), (112, 156), (118, 146), (125, 135)])
FOREARM = poly([(135, 78), (200, 72), (200, 112), (135, 112)])
HANDZONE = poly([(147, 70), (200, 70), (200, 114), (147, 114)])
SHOE = poly([(146, 217), (200, 217), (200, 249), (146, 249)])
HEM = 134                                             # torso ends here (soft), the leg ribbon covers the rest

head = HEAD & alpha
luma = (R_ * 299 + G_ * 587 + B_ * 114) // 1000
fore = FOREARM & alpha & (skin | (luma < 105)) & ~HEAD & ~SLEEVE | (HANDZONE & alpha)
sleeve = SLEEVE & alpha & ~skin & ~HEAD
shoe = SHOE & alpha & ~skin & (yy >= 221)
leg = NEARLEG & alpha & ~shoe
torso = alpha & ~(HEAD & ~((yy >= 36) & (xx <= 136))) & ~FARARM & ~fore & ~HANDZONE & (yy <= HEM + 8) & ~poly([(0, 40), (97, 40), (97, 62), (0, 62)]) & ~((xx < 108) & (yy > 126))
# keep the (small) skin pixels of the neck/ear region inside the torso: they are not part of fore because fore is limited to x>=133,y>=76

def fill_holes(img, have, hole, iters=60):
    img = img.astype(np.float32).copy(); have = have.copy()
    for _ in range(iters):
        todo = hole & ~have
        if not todo.any(): break
        p = np.pad(have.astype(np.float32), 1); pi = np.pad(img, ((1, 1), (1, 1), (0, 0)))
        cnt = np.zeros((H, W), np.float32); acc = np.zeros_like(img)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0: continue
                h = p[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]; cnt += h; acc += pi[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] * h[..., None]
        ok = todo & (cnt > 0); img[ok] = acc[ok] / cnt[ok][:, None]; have = have | ok
    return img.astype(np.uint8), have

def opened(m, n=1):
    m = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * n + 1)).filter(ImageFilter.MaxFilter(2 * n + 1)); return np.array(m) > 127
def save_crop(name, rgba, mask, pivot, soften=0.0, extra=None):
    ys, xs = np.where(mask); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out = rgba.copy(); out[..., 3] = np.where(mask, rgba[..., 3], 0)
    if extra is not None: out[..., 3] = (out[..., 3] * extra).astype(np.uint8)
    crop = Image.fromarray(out[y0:y1, x0:x1])
    if soften:
        a = crop.getchannel('A').filter(ImageFilter.GaussianBlur(soften)); crop.putalpha(a)
    crop.save('%s/%s.png' % (OUT, name))
    return {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0), 'pivot': [pivot[0] - int(x0), pivot[1] - int(y0)]}

J = {'T': (126, 128), 'neck': (124, 46), 'shoulder': (133, 60), 'elbow': (143, 94), 'wrist': (184, 86), 'toe': (194, 235),
     'legTop': (121, 118), 'hip': (126, 128), 'knee': (143, 168), 'ankle': (157, 224), 'ankleEnd': (158, 229)}
rig = {'src': SRC, 'pxPerCm': 1.39, 'joints': J, 'parts': {}}

# ---- torso: sleeve and forearm area painted out, soft hem ----------------------------------------------------
base = A.copy()
hole = (fore & (xx <= 150)) & ~HEAD
light = luma >= 120
img, have = fill_holes(base, torso & ~sleeve & ~fore & light, hole, 80)
torso_m = torso | hole | sleeve
hem = np.where(xx >= 112, np.clip((HEM + 8 - yy) / 10.0, 0, 1), np.clip((HEM + 4 - yy) / 3.0, 0, 1))
rig['parts']['torso'] = save_crop('torso', img, torso_m, J['T'], 0.45, hem)

# ---- head ------------------------------------------------------------------------------------------------------
rig['parts']['head'] = save_crop('head', base, head, J['neck'], 0.4)

# ---- sleeve (feather the left/top edge that lies inside the shirt) ---------------------------------------------
feather = np.clip((xx - 123) / 5.0, 0, 1) * np.clip((yy - 51) / 4.0, 0, 1)
rig['parts']['sleeve'] = save_crop('sleeve', base, sleeve, J['shoulder'], 0.4, feather)

# ---- forearm + hand, extended left under the sleeve ---------------------------------------------------------
ys, xs = np.where(fore); x0 = xs.min()
ext = 9; fr = base.copy(); fm = fore.copy()
for y in range(H):
    row = np.where(fore[y])[0]
    if len(row):
        xl = row.min(); good = [x for x in row if base[y, x, 3] > 200 and x >= xl + 4]; col = base[y, good[0] if good else row.max()].copy(); col[3] = 255
        for k in range(1, ext + 1):
            if xl - k >= 0: fr[y, xl - k] = col; fm[y, xl - k] = True
fm = fm & ~(yy < 76)
rig['parts']['forearm'] = save_crop('forearm', fr, fm, J['elbow'], 0.4)
c = np.array(Image.open(OUT + '/forearm.png').convert('RGBA')).astype(np.float32); c[..., :3] *= 0.72
Image.fromarray(c.astype(np.uint8)).save(OUT + '/forearmB.png'); rig['parts']['forearmB'] = dict(rig['parts']['forearm'])

# ---- shoe ------------------------------------------------------------------------------------------------------
shoe = opened(shoe, 1) & shoe
rig['parts']['shoe'] = save_crop('shoe', base, shoe, J['ankle'], 0.4)
rig['parts']['shoe']['bind'] = math.atan2(J['toe'][0] - J['ankle'][0], J['toe'][1] - J['ankle'][1])
c = np.array(Image.open(OUT + '/shoe.png').convert('RGBA')).astype(np.float32); c[..., :3] *= 0.8
Image.fromarray(c.astype(np.uint8)).save(OUT + '/shoeB.png')
rig['ankleH'] = float(249 - J['ankle'][1] - 2)

# ---- leg ribbon: unroll the near leg along legTop -> hip -> knee -> ankle -> ankleEnd ----------------------------
RES = 2.0; HALF = 24.0
pts = [J['legTop'], J['hip'], J['knee'], J['ankle'], J['ankleEnd']]
dense = []                                           # dense polyline of the leg axis
for a, b in zip(pts[:-1], pts[1:]):
    n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1])));
    for i in range(n): dense.append((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n))
dense.append(pts[-1]); P = np.array(dense, np.float32)
k = 9                                                # moving-average rounds the knee (so the unrolled strip does not tear there)
Ps = np.stack([np.convolve(np.pad(P[:, i], (k, k), mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), mode='valid') for i in (0, 1)], 1)
seg = np.hypot(*np.diff(Ps, axis=0).T); cum = np.concatenate([[0], np.cumsum(seg)])
def arc_of(pt):                                      # arc length of the dense point nearest to a joint
    return float(cum[np.argmin(np.hypot(Ps[:, 0] - pt[0], Ps[:, 1] - pt[1]))])
sH, sK, sA = arc_of(J['hip']), arc_of(J['knee']), arc_of(J['ankle']); L = float(cum[-1])
nrows = int(L * RES); ncols = int(2 * HALF * RES)
tex = np.zeros((nrows, ncols, 4), np.float32)
def bilinear(img, x, y):
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = (x - x0)[..., None]; fy = (y - y0)[..., None]
    def g(xi, yi): return img[np.clip(yi, 0, H - 1), np.clip(xi, 0, W - 1)].astype(np.float32)
    return (g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy)
# premultiplied sampling so the fringe does not turn blue
pm = A.astype(np.float32); pm[..., :3] *= (pm[..., 3:4] / 255.0)
legmask = (leg.astype(np.float32) * 255)
for r in range(nrows):
    s = (r + .5) / RES; i = int(np.searchsorted(cum, s)); i = min(max(i, 1), len(Ps) - 1)
    t = (s - cum[i - 1]) / max(cum[i] - cum[i - 1], 1e-6); p = Ps[i - 1] * (1 - t) + Ps[i] * t
    d = Ps[min(i + 3, len(Ps) - 1)] - Ps[max(i - 4, 0)]; d = d / (np.hypot(*d) + 1e-6); n = np.array([d[1], -d[0]])
    ws = (np.arange(ncols) + .5) / RES - HALF
    sx = p[0] + n[0] * ws; sy = p[1] + n[1] * ws
    c4 = bilinear(pm, sx, sy); m = bilinear(legmask[..., None].repeat(4, 2), sx, sy)[..., 0] / 255.0
    a = c4[..., 3] / 255.0 * m
    rgb = np.where(c4[..., 3:4] > 1, c4[..., :3] / np.maximum(c4[..., 3:4] / 255.0, 1e-3), 0)
    tex[r, :, :3] = rgb; tex[r, :, 3] = a * 255
tex[..., 3] *= np.clip(np.arange(nrows)[:, None] / RES / 9.0, 0, 1)          # soft top: the leg fades in over the torso
tex = np.clip(tex, 0, 255).astype(np.uint8)
Image.fromarray(tex).save(OUT + '/leg.png')
t2 = tex.astype(np.float32); t2[..., :3] *= 0.74; Image.fromarray(t2.astype(np.uint8)).save(OUT + '/legB.png')
rig['leg'] = {'res': RES, 'half': HALF, 'w': ncols, 'h': nrows, 'sH': sH, 'sK': sK, 'sA': sA, 'L': L}
json.dump(rig, open(OUT + '/rig.json', 'w'), indent=1)
print({n: (p['w'], p['h']) for n, p in rig['parts'].items()}, 'leg', ncols, nrows, 'knots', round(sH), round(sK), round(sA), round(L))
