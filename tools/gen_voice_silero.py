"""Generate spoken lines with Silero TTS v4 (Russian) -> assets/voice/<who>/<hash>.mp3 + manifest.json (sha keys; run tools/finalize_voice.py after).
Usage: /tmp/sv/bin/python tools/gen_voice_silero.py /tmp/lines.json  (model: /tmp/silero/v4_ru.pt)"""
import sys, json, hashlib, os, re, subprocess, io, wave
import numpy as np, torch
torch.set_num_threads(4)
lines = json.load(open(sys.argv[1])); out = 'assets/voice'; os.makedirs(out, exist_ok=True)
model = torch.package.PackageImporter(os.environ.get('SILERO_MODEL', '/tmp/silero/v4_ru.pt')).load_pickle('tts_models', 'model'); model.to('cpu')
SPK = {'bamboul': 'eugene', 'dan': 'aidar', 'landlord': 'aidar'}
FX = {'bamboul': 'asetrate=48000*1.2,aresample=24000,atempo=0.833', 'dan': 'asetrate=48000*1.04,aresample=24000,atempo=0.96', 'landlord': 'asetrate=48000*0.88,aresample=24000,atempo=1.136,acompressor=threshold=0.1:ratio=3'}
ONES = 'ноль один два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать тринадцать четырнадцать пятнадцать шестнадцать семнадцать восемнадцать девятнадцать'.split()
TENS = 'x x двадцать тридцать сорок пятьдесят шестьдесят семьдесят восемьдесят девяносто'.split()
def num(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if n < 1000: return ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'][n // 100] + ('' if n % 100 == 0 else ' ' + num(n % 100))
    return str(n)
def clean(t):
    t = re.sub(r'[*]+', '', t); t = re.sub(r'\d+', lambda m: num(int(m.group())), t)
    t = t.replace('%', ' процентов').replace('°C', ' градусов').replace('—', ' - ').replace('…', '...').replace('ё', 'ё')
    t = re.sub(r'[^А-Яа-яЁёA-Za-z .,!?:;\-]', ' ', t); t = re.sub(r'\s+', ' ', t).strip()
    return t
def norm(t): return re.sub(r'\s+', ' ', t.strip().lower().replace('ё', 'е'))
def key(who, t): return hashlib.sha1((who + '|' + norm(t)).encode()).hexdigest()[:12]
PROS = {'tired': ('medium', 'slow', -1), 'grumble': ('medium', 'medium', 0), 'annoyed': ('high', 'fast', 0), 'angry': ('high', 'fast', 2), 'surprise': ('x-high', 'fast', 1), 'relief': ('high', 'medium', 0), 'panic': ('high', 'x-fast', 2), 'dry': ('medium', 'medium', 0)}
def emo_of(l):
    e = l.get('emo')
    if e in PROS: return e
    if l['who'] == 'landlord': return 'angry'
    if l['who'] == 'dan': return 'dry'
    t = l['text']; letters = re.sub(r'[^А-Яа-яЁё]', '', t); caps = len(re.sub(r'[^А-ЯЁ]', '', t)) / max(1, len(letters))
    if caps > .5 or t.count('!') >= 2: return 'angry'
    if '?!' in t: return 'surprise'
    if '…' in t or '...' in t: return 'tired'
    if t.endswith('!'): return 'annoyed'
    return 'grumble'
def ssml(chunk, emo):
    pitch, rate, _ = PROS[emo]
    c = chunk.replace('&', ' и ').replace('<', ' ').replace('>', ' ')
    c = re.sub(r'(\.\.\.|…)', ' <break time="520ms"/> ', c); c = re.sub(r',\s', ', <break time="130ms"/> ', c); c = re.sub(r'\s[-—]\s', ' <break time="200ms"/> ', c)
    return '<speak><prosody pitch="%s" rate="%s">%s</prosody></speak>' % (pitch, rate, c)
def synth(text, who, emo):
    parts = [p.strip() for p in re.split(r'(?<=[.!?])\s+', text) if p.strip()]; chunks = []; cur = ''
    for p in parts:
        if len(cur) + len(p) < 400: cur = (cur + ' ' + p).strip()
        else: chunks.append(cur); cur = p
    if cur: chunks.append(cur)
    L = re.sub(r'[^А-Яа-яЁё]', '', text); caps = len(re.sub(r'[^А-ЯЁ]', '', text)) / max(1, len(L))
    wav = []
    for c in chunks:
        if not re.search('[А-Яа-я]', c): continue
        if caps > .5: c = c[0] + c[1:].lower()
        c = c if c[-1] in '.!?' else c + '.'
        try: wav.append(model.apply_tts(ssml_text=ssml(c, emo), speaker=SPK[who], sample_rate=48000, put_accent=True, put_yo=True).numpy())
        except Exception: wav.append(model.apply_tts(text=c, speaker=SPK[who], sample_rate=48000, put_accent=True, put_yo=True).numpy())
    return np.concatenate(wav) if wav else None
def fnv(s):
    h = 0x811c9dc5
    for ch in s: h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h
# incremental: keep the existing (fnv-keyed) manifest and add only new clips; set REGEN=1 to redo everything
mpath = out + '/manifest.json'
manifest = json.load(open(mpath)) if os.path.exists(mpath) and not os.environ.get('REGEN') else {}
n = 0
for i, l in enumerate(lines):
    who = l['who']
    if who not in SPK: continue
    fk = fnv(who + '|' + norm(l['text']))
    if fk in manifest and os.path.exists(f'{out}/' + manifest[fk]): continue
    k = key(who, l['text']); os.makedirs(f'{out}/{who}', exist_ok=True); fp = f'{out}/{who}/{k}.mp3'
    text = clean(l['text'])
    if not re.search('[А-Яа-я]', text): continue
    emo = emo_of(l)
    try: a = synth(text, who, emo)
    except Exception as e: print('ERR', i, e, text[:60], flush=True); continue
    if a is None: continue
    pcm = (np.clip(a, -1, 1) * 32767).astype('<i2').tobytes()
    caps = len(re.sub(r'[^А-ЯЁ]', '', l['text'])) / max(1, len(re.sub(r'[^А-Яа-яЁё]', '', l['text'])))
    af = FX[who] + ',loudnorm=I=-18:TP=-1.5:LRA=9,volume=%ddB,alimiter=limit=0.95' % (PROS[emo][2] + (1 if caps > .55 else 0))
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', '48000', '-ac', '1', '-i', 'pipe:0', '-af', af, '-ac', '1', '-ar', '24000', '-b:a', '28k', fp], input=pcm)
    if p.returncode == 0: manifest[fk] = f'{who}/{k}.mp3'; n += 1
    if i % 25 == 0: print(i, len(lines), n, flush=True); json.dump(manifest, open(mpath, 'w'))
json.dump(manifest, open(mpath, 'w'), ensure_ascii=False); print('done', n, 'clips')
