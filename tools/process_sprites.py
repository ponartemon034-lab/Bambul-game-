"""Cut the baked checkerboard out of the user's reference hero renders -> transparent PNG frames."""
import sys, glob, os, numpy as np
from PIL import Image
from collections import deque
src = 'assets/char/src'; out = 'assets/char'
def clean(path):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(int); h, w, _ = a.shape
    mx = a.max(2); mn = a.min(2); neutral = (mx - mn) < 9; grey = neutral & (mx > 92) & (mx < 148)
    bg = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if grey[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if grey[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and grey[yy, xx] and not bg[yy, xx]: bg[yy, xx] = True; q.append((yy, xx))
    # enclosed checker pockets: neutral-grey pixels with checker-sized flat regions
    from itertools import product
    pocket = grey & ~bg
    # grow bg by 1px to eat anti-aliased fringe
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    fr = bg.copy(); 
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.roll(np.roll(bg, dy, 0), dx, 1); fr |= sh & (mx > 80) & neutral
    alpha = np.where(fr, 0, 255).astype(np.uint8)
    rgba = np.dstack([a.astype(np.uint8), alpha]); return Image.fromarray(rgba, 'RGBA'), int(pocket.sum())

from collections import deque
def largest(im):
    a=np.asarray(im.getchannel('A'))>0; h,w=a.shape; lab=np.zeros((h,w),int); n=0; sizes=[0]
    for y in range(h):
        for x in range(w):
            if a[y,x] and not lab[y,x]:
                n+=1; q=deque([(y,x)]); lab[y,x]=n; c=0
                while q:
                    yy,xx=q.popleft(); c+=1
                    for dy in (-1,0,1):
                        for dx in (-1,0,1):
                            y2,x2=yy+dy,xx+dx
                            if 0<=y2<h and 0<=x2<w and a[y2,x2] and not lab[y2,x2]: lab[y2,x2]=n; q.append((y2,x2))
                sizes.append(c)
    keep=[i for i in range(1,n+1) if sizes[i]>=.15*max(sizes)]
    m=np.isin(lab,keep); arr=np.array(im); arr[...,3]=np.where(m,arr[...,3],0); return Image.fromarray(arr,'RGBA')
from PIL import ImageFilter
def finish(im):
    a=im.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.6))
    im=im.copy(); im.putalpha(a); return im.crop(im.getchannel('A').point(lambda v:255 if v>30 else 0).getbbox())
SCALE=1.9  # px per cm (head ~45px ~ 24cm; standing figure 338px = 178cm)
names={'ref_0':'hero_idle','ref_3':'hero_closeup'}
runorder=['ref_4','ref_8','ref_5','ref_6','ref_1','ref_7','ref_2']
meta={'pxPerCm':SCALE,'frames':{}}
for p in sorted(glob.glob(src+'/ref_*')):
    n=os.path.splitext(os.path.basename(p))[0]; im,_=clean(p); im=finish(largest(im))
    out_n=names.get(n) or 'hero_run_%d'%runorder.index(n); im.save(f'{out}/{out_n}.png'); meta['frames'][out_n]=list(im.size); print(out_n,im.size)
    if os.path.exists(f'{out}/{n}.png'): os.remove(f'{out}/{n}.png')
import json; json.dump(meta,open(f'{out}/hero_sprites.json','w'),indent=1)
