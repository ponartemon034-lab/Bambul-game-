"""Generate spoken lines with Piper (offline Russian TTS) -> assets/voice/<who>/<hash>.mp3 + manifest.json.
Usage: /tmp/pv/bin/python tools/gen_voice.py /tmp/lines.json  (voices in /tmp/voices)"""
import sys, json, hashlib, os, re, subprocess, wave, io
from piper import PiperVoice, SynthesisConfig
lines = json.load(open(sys.argv[1])); out = 'assets/voice'; os.makedirs(out, exist_ok=True)
V = {'bamboul': 'denis', 'dan': 'dmitri', 'landlord': 'ruslan'}
voices = {k: PiperVoice.load(f'/tmp/voices/ru_RU-{v}-medium.onnx') for k, v in V.items()}
FX = {'bamboul': 'asetrate=22050*0.97,aresample=22050,atempo=1.03', 'dan': 'asetrate=22050*1.04,aresample=22050,atempo=0.96', 'landlord': 'asetrate=22050*0.86,aresample=22050,atempo=1.16,acompressor=threshold=0.1:ratio=4'}
def norm(t): return re.sub(r'\s+', ' ', t.strip().lower().replace('ё', 'е'))
def key(who, t): return hashlib.sha1((who + '|' + norm(t)).encode()).hexdigest()[:12]
manifest = {}
mpath = out + '/manifest.json'
if os.path.exists(mpath): manifest = json.load(open(mpath))
n = 0
for i, l in enumerate(lines):
    who, text = l['who'], re.sub(r'[*]+', '', l['text'])
    if who not in voices: continue
    k = key(who, l['text'])
    if k in manifest and os.path.exists(f'{out}/{who}/{k}.mp3'): continue
    os.makedirs(f'{out}/{who}', exist_ok=True)
    letters = re.sub(r'[^А-Яа-яЁёA-Za-z]', '', text); caps = len(re.sub(r'[^А-ЯЁA-Z]', '', text)) / max(1, len(letters))
    shout = caps > .55 or text.count('!') >= 2
    cfg = SynthesisConfig(length_scale=.84 if shout else (.95 if text.endswith('!') else 1.02), noise_scale=.75, noise_w_scale=.9)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf: voices[who].synthesize_wav(text.lower() if caps > .55 else text, wf, syn_config=cfg)
    af = FX[who] + (',volume=1.25' if shout else '')
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'pipe:0', '-af', af, '-ac', '1', '-ar', '22050', '-b:a', '24k', f'{out}/{who}/{k}.mp3'], input=buf.getvalue())
    if p.returncode == 0: manifest[k] = f'{who}/{k}.mp3'; n += 1
    if i % 25 == 0: print(i, len(lines), n, flush=True); json.dump(manifest, open(mpath, 'w'))
json.dump(manifest, open(mpath, 'w'), ensure_ascii=False)
print('done', n, 'new,', len(manifest), 'total')
