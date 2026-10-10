"""Generate spoken lines with Coqui XTTS-v2 (multilingual, Russian) and check every clip with Whisper (speech -> text),
re-rolling clips that do not come out intelligible. Output: assets/voice/<who>/<hash>.mp3 + assets/voice/manifest.json (merged, fnv keys),
progress in <workdir>/xtts_done_<shard>.json (resumable); each shard writes manifest_part_<shard>.json.
Usage: COQUI_TOS_AGREED=1 [WHO=bamboul] [SHARD=0/2] python tools/gen_voice_xtts.py lines.json [workdir]   then: python tools/merge_voice_manifest.py workdir
Licence note: XTTS-v2 weights are under the Coqui Public Model License (non-commercial).
"""
import os, sys, json, re, hashlib, subprocess, time, warnings, difflib
warnings.filterwarnings('ignore')
os.environ.setdefault('COQUI_TOS_AGREED', '1')
import numpy as np, soundfile as sf, torch, torchaudio
torch.set_num_threads(int(os.environ.get('TORCH_THREADS', '2')))
from TTS.api import TTS
from faster_whisper import WhisperModel

lines = json.load(open(sys.argv[1])); work = sys.argv[2] if len(sys.argv) > 2 else '/tmp/xtts'; os.makedirs(work, exist_ok=True)
out = 'assets/voice'; os.makedirs(out, exist_ok=True)
SPK = {'bamboul': 'Baldur Sanjin', 'landlord': 'Damien Black', 'dan': 'Andrew Chipper'}
SPEED = {'tired': .93, 'grumble': .98, 'annoyed': 1.04, 'angry': 1.1, 'surprise': 1.07, 'relief': .98, 'panic': 1.14, 'dry': 1.0}
GAIN = {'angry': 2, 'panic': 2, 'surprise': 1, 'tired': -1}
ONES = 'ноль один два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать тринадцать четырнадцать пятнадцать шестнадцать семнадцать восемнадцать девятнадцать'.split()
TENS = 'x x двадцать тридцать сорок пятьдесят шестьдесят семьдесят восемьдесят девяносто'.split()
def num(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    return str(n)
def norm(t): return re.sub(r'\s+', ' ', t.strip().lower().replace('ё', 'е'))
def sha(who, t): return hashlib.sha1((who + '|' + norm(t)).encode()).hexdigest()[:12]
def fnv(s):
    h = 0x811c9dc5
    for ch in s: h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h
def clean(t):
    t = re.sub(r'[*]+', '', t); t = re.sub(r'\d+', lambda m: num(int(m.group())), t)
    t = t.replace('…', '...').replace('—', ' - ').replace('«', '"').replace('»', '"').replace('(', '').replace(')', '')
    t = re.sub(r'\s+', ' ', t).strip()
    letters = re.sub(r'[^А-Яа-яЁё]', '', t); caps = len(re.sub(r'[^А-ЯЁ]', '', t)) / max(1, len(letters))
    if caps > .5:                                       # shouted line: XTTS would spell all-caps words letter by letter
        t = re.sub(r'[А-ЯЁ]{2,}', lambda m: m.group().lower(), t); t = t[0].upper() + t[1:]
    return t
def squash(t):                                              # Whisper writes "блять", "впадлу" etc. differently: compare letters only
    t = re.sub(r'[^а-я]', '', norm(t)); return t.replace('блять', 'блядь').replace('бляд', 'бля').replace('ться', 'тся').replace('тся', 'ца')
def wer(a, b):
    a, b = squash(a), squash(b); return 1 - difflib.SequenceMatcher(None, a, b).ratio() if a else 0

WHO = os.environ.get('WHO', '').split(',') if os.environ.get('WHO') else list(SPK)
SH, NSH = (int(x) for x in os.environ.get('SHARD', '0/1').split('/'))
tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2', progress_bar=False)
asr = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=int(os.environ.get('ASR_THREADS', '1')), download_root=os.environ.get('HF_HOME', work))
def transcribe(w):
    a = torchaudio.functional.resample(torch.from_numpy(w.astype(np.float32)), 24000, 16000).numpy()
    seg, _ = asr.transcribe(a, language='ru'); return ' '.join(s.text for s in seg)

mpath = work + '/manifest_part_%d.json' % SH; manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
dpath = work + '/xtts_done_%d.json' % SH; done = json.load(open(dpath)) if os.path.exists(dpath) else {}
order = {'bamboul': 0, 'landlord': 1, 'dan': 2}
todo = sorted([l for l in lines if l['who'] in SPK and l['who'] in WHO], key=lambda l: order[l['who']])
todo = [l for j, l in enumerate(todo) if j % NSH == SH]
t0 = time.time(); n = 0; bad = []
for i, l in enumerate(todo):
    who, text = l['who'], l['text']; k = sha(who, text)
    if done.get(k) is not None: continue
    emo = l.get('emo') or ('angry' if who == 'landlord' else 'dry' if who == 'dan' else 'grumble')
    src = clean(text); best = None
    for attempt in range(3):
        try:
            torch.manual_seed(1000 * attempt + i)
            wav = np.array(tts.tts(text=src, speaker=SPK[who], language='ru', speed=SPEED.get(emo, 1.0), temperature=[.75, .65, .55][attempt],
                                   repetition_penalty=5.0, top_k=50, top_p=.85), dtype=np.float32)
        except Exception as e:
            print('ERR', i, e, flush=True); continue
        dur = len(wav) / 24000; exp = max(.8, len(src) / 14.0)            # ~14 chars per second of Russian speech
        w = wer(src, transcribe(wav)); bad_len = dur > exp * 2.2 or dur < exp * .35
        score = w + (1 if bad_len else 0)
        if best is None or score < best[0]: best = (score, wav, w)
        if score < .22: break
    if best is None: continue
    score, wav, w = best
    if score >= .35: bad.append((i, who, round(w, 2), src[:50]))
    pcm = (np.clip(wav, -1, 1) * 32767).astype('<i2').tobytes()
    os.makedirs('%s/%s' % (out, who), exist_ok=True); fp = '%s/%s/%s.mp3' % (out, who, k)
    af = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-18:TP=-1.5:LRA=9,volume=%ddB,alimiter=limit=0.95' % GAIN.get(emo, 0)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0', '-af', af, '-ac', '1', '-ar', '24000', '-b:a', '40k', fp], input=pcm)
    if p.returncode == 0:
        manifest[fnv(who + '|' + norm(text))] = '%s/%s.mp3' % (who, k); done[k] = round(w, 3); n += 1
    if n % 10 == 0:
        json.dump(manifest, open(mpath, 'w'), ensure_ascii=False); json.dump(done, open(dpath, 'w'))
        print('%d/%d done, %.0f min, worst so far %s' % (len(done), len(todo), (time.time() - t0) / 60, bad[-1:] ), flush=True)
json.dump(manifest, open(mpath, 'w'), ensure_ascii=False); json.dump(done, open(dpath, 'w'))
json.dump(bad, open(work + '/xtts_bad_%d.json' % SH, 'w'), ensure_ascii=False)
print('finished', n, 'clips', len(bad), 'doubtful', flush=True)
