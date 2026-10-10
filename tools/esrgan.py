"""Minimal Real-ESRGAN x4 (RRDBNet) for upscaling the hero sprites.  Weights: RealESRGAN_x4.pth (ai-forever/Real-ESRGAN on HuggingFace).
Usage (as a module): up = load(path); out = upscale(up, pil_rgb)"""
import torch, torch.nn as nn, torch.nn.functional as F
import numpy as np
from PIL import Image
class RDB5(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1); s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1); s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); s.lrelu = nn.LeakyReLU(.2, True)
    def forward(s, x):
        x1 = s.lrelu(s.conv1(x)); x2 = s.lrelu(s.conv2(torch.cat((x, x1), 1))); x3 = s.lrelu(s.conv3(torch.cat((x, x1, x2), 1)))
        x4 = s.lrelu(s.conv4(torch.cat((x, x1, x2, x3), 1))); x5 = s.conv5(torch.cat((x, x1, x2, x3, x4), 1)); return x5 * .2 + x
class RRDB(nn.Module):
    def __init__(s, nf=64, gc=32): super().__init__(); s.rdb1 = RDB5(nf, gc); s.rdb2 = RDB5(nf, gc); s.rdb3 = RDB5(nf, gc)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * .2 + x
class RRDBNet(nn.Module):
    def __init__(s, nb=23, nf=64, gc=32):
        super().__init__()
        s.conv_first = nn.Conv2d(3, nf, 3, 1, 1); s.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)]); s.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_last = nn.Conv2d(nf, 3, 3, 1, 1); s.lrelu = nn.LeakyReLU(.2, True)
    def forward(s, x):
        f = s.conv_first(x); f = f + s.conv_body(s.body(f))
        f = s.lrelu(s.conv_up1(F.interpolate(f, scale_factor=2, mode='nearest'))); f = s.lrelu(s.conv_up2(F.interpolate(f, scale_factor=2, mode='nearest')))
        return s.conv_last(s.lrelu(s.conv_hr(f)))
def load(path):
    net = RRDBNet(); sd = torch.load(path, map_location='cpu')
    if 'params_ema' in sd: sd = sd['params_ema']
    elif 'params' in sd: sd = sd['params']
    sd = {k.replace('RDB', 'rdb').replace('trunk_conv', 'conv_body').replace('RRDB_trunk', 'body').replace('upconv1', 'conv_up1').replace('upconv2', 'conv_up2').replace('HRconv', 'conv_hr'): v for k, v in sd.items()}
    net.load_state_dict(sd, strict=True); net.eval(); return net
@torch.no_grad()
def upscale(net, img):
    x = torch.from_numpy(np.array(img.convert('RGB')).astype(np.float32) / 255.).permute(2, 0, 1)[None]
    y = net(x).clamp(0, 1)[0].permute(1, 2, 0).numpy()
    return Image.fromarray((y * 255 + .5).astype(np.uint8))
