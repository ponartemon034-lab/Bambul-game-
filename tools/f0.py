import sys, subprocess, numpy as np, glob, random
def f0(path):
    raw = subprocess.run(['ffmpeg','-v','error','-i',path,'-f','s16le','-ac','1','-ar','16000','-'],capture_output=True).stdout
    x = np.frombuffer(raw, dtype='<i2').astype(float); x /= 32768; fr=800; hop=400; out=[]
    for i in range(0, len(x)-fr, hop):
        s = x[i:i+fr]; 
        if np.sqrt((s**2).mean()) < .02: continue
        s = s - s.mean(); ac = np.correlate(s, s, 'full')[fr-1:]; lo, hi = 16000//300, 16000//70
        k = lo + int(np.argmax(ac[lo:hi])); 
        if ac[k] / (ac[0]+1e-9) > .4: out.append(16000/k)
    return np.median(out) if out else None
if __name__ == '__main__':
    random.seed(1)
    for who in ['bamboul','dan','landlord']:
        g_ = glob.glob(f'assets/voice/{who}/*.mp3'); fs = random.sample(g_, min(25, len(g_))); v=[f0(f) for f in fs]; v=[a for a in v if a]
        print(who, 'median F0 %.0f Hz (n=%d)' % (np.median(v), len(v)))
