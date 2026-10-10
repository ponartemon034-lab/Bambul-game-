"""Merge the manifest_part_*.json files written by tools/gen_voice_xtts.py shards into assets/voice/manifest.json.
Usage: python tools/merge_voice_manifest.py <workdir>"""
import glob, json, sys, os
work = sys.argv[1]; mp = 'assets/voice/manifest.json'
man = json.load(open(mp)) if os.path.exists(mp) else {}
n = 0
for f in sorted(glob.glob(work + '/manifest_part_*.json')):
    part = json.load(open(f)); man.update(part); n += len(part)
json.dump(man, open(mp, 'w'), ensure_ascii=False); print('merged', n, 'entries ->', len(man), 'total')
