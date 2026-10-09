"""Re-key manifest: sha1-keys (generator) -> fnv1a keys used by js/voice.js."""
import json, re, hashlib
def norm(t): return re.sub(r'\s+', ' ', t.strip().lower().replace('ё', 'е'))
def sha(who, t): return hashlib.sha1((who + '|' + norm(t)).encode()).hexdigest()[:12]
def fnv(s):
    h = 0x811c9dc5
    for ch in s: h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h
lines = json.load(open('/tmp/lines.json')); man = json.load(open('assets/voice/manifest.json')); out = {}
for l in lines:
    k = sha(l['who'], l['text'])
    if k in man: out[fnv(l['who'] + '|' + norm(l['text']))] = man[k]
json.dump(out, open('assets/voice/manifest.json', 'w'), ensure_ascii=False); print(len(out), 'clips keyed')
