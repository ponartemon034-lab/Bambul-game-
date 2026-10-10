"""Assets for the vector hero (js/rig.js): head (from the painted profile, cleaned, upper head + jaw), shirt print (from the user's photo).
Run: python3 tools/build_hero_assets.py   (needs assets/char/rig/head.png from tools/build_rig.py and assets/source/shirt_print.png)"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
OUT = 'assets/char/hero'; os.makedirs(OUT, exist_ok=True)
S = 3                                                       # upsample factor for the head
head = Image.open('assets/char/rig/head.png').convert('RGBA'); W, H = head.size
# remove the shirt-collar fragments at the lower left: keep only the head and the front of the neck
keep = Image.new('L', (W, H), 0)
ImageDraw.Draw(keep).polygon([(9, 0), (W, 0), (W, H), (32, H), (28, 44), (22, 39), (14, 35), (9, 24), (8, 10)], fill=255)
a = np.array(head); m = np.array(keep) > 0; a[..., 3] = np.where(m, a[..., 3], 0)
head = Image.fromarray(a)
big = head.resize((W * S, H * S), Image.LANCZOS)
rgb = big.convert('RGB').filter(ImageFilter.UnsharpMask(radius=2.2, percent=90, threshold=2)); rgb.putalpha(big.getchannel('A').filter(ImageFilter.GaussianBlur(.7)))
big = rgb
# upper head / jaw split at the mouth line (face-front region only)
MOUTH_Y = 35.6 * S; HINGE = (27 * S, 34 * S)
ys, xs = np.mgrid[0:H * S, 0:W * S]
jaw_m = (ys >= MOUTH_Y + (xs - 26 * S) * -0.02) & (xs >= 24 * S)
A = np.array(big); up = A.copy(); jw = A.copy()
up[..., 3] = np.where(jaw_m, 0, A[..., 3]); jw[..., 3] = np.where(jaw_m, A[..., 3], 0)
# soften the seam of both parts a little (overlap of 2 px)
jaw_o = (ys >= MOUTH_Y - 2 * S) & (xs >= 24 * S); jw[..., 3] = np.where(jaw_o, A[..., 3], 0)
Image.fromarray(up).save(OUT + '/head_up.png'); Image.fromarray(jw).save(OUT + '/head_jaw.png')
meta = {'S': S, 'size': [W * S, H * S], 'neck': [27 * S, 44 * S], 'hinge': list(HINGE), 'mouthY': MOUTH_Y,
        'eye': [43.5 * S, 24.6 * S], 'brow': [43 * S, 21.5 * S], 'mouth': [45.5 * S, 36.2 * S], 'nose': [49 * S, 31 * S], 'headH': 46.0 * S}
# shirt print: the real fabric from the photo, levels stretched to a readable beige / mustard / grey-brown print (the photo is dark and warm)
from PIL import ImageOps
sp = Image.open('assets/source/shirt_print.png').convert('RGB')
sp = ImageOps.autocontrast(sp, cutoff=1.0)
arr = np.array(sp).astype(np.float32) / 255.0
lum = arr.mean(axis=2, keepdims=True)
arr = np.clip(lum + (arr - lum) * 1.9, 0, 1)                  # the photo is nearly colourless in the shade: bring the beige / mustard back
arr = arr * np.array([1.16, 1.0, .74], np.float32)             # warm grade: beige, ochre, brown-grey print with dark line art
arr = np.clip(arr ** 0.78, 0, 1)
beige = np.array([.80, .70, .52], np.float32); arr = arr * .74 + beige * .26        # soften the heavy dark shapes of the crop: a printed viscose shirt, not leather
sp = Image.fromarray((arr * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.5))
sp.save(OUT + '/shirt.png'); meta['shirt'] = list(sp.size)
json.dump(meta, open(OUT + '/hero.json', 'w'), indent=1); print(meta)
