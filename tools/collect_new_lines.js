// Dumps spoken lines that have no clip yet -> <out.json> (default /tmp/lines_new.json). Usage: node tools/collect_new_lines.js [out.json]
// Then: SILERO_MODEL=/path/v4_ru.pt python tools/gen_voice_silero.py <out.json>   (incremental, merges into assets/voice/manifest.json)
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const man = JSON.parse(fs.readFileSync(path.join(root, 'assets/voice/manifest.json'), 'utf8'));
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] }); const pg = await br.newPage();
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart=1'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(1500);
  const all = await pg.evaluate(() => {
    const res = new Map();
    for (const cat in BB.dlg._POOL) {
      const m = BB.dlg._meta(cat), who = m.who || 'bamboul';
      for (const e of BB.dlg._POOL[cat]) if (typeof e.t === 'string') { const k = who + '|' + e.t; if (!res.has(k)) res.set(k, { who, text: e.t, emo: (BB.dlg.EMO && BB.dlg.EMO[e.t]) || (BB.dlg.EMO_CAT && BB.dlg.EMO_CAT[cat]) || null, key: BB.voice._key(who, e.t) }); }
    }
    // scripted phone calls (landlord / Dan / replies) under many states: the lines depend on minutes left, repairs done, score ...
    const add = (who, t) => { if (!t || typeof t !== 'string' || who === 'narr') return; const k = who + '|' + t; if (!res.has(k)) res.set(k, { who, text: t, emo: (BB.dlg.EMO && BB.dlg.EMO[t]) || (who === 'landlord' ? 'angry' : who === 'dan' ? 'dry' : null), key: BB.voice._key(who, t) }); };
    const S = BB.S, ctxs = [];
    for (let m = 1; m <= 10; m++) for (const done of [0, 1]) {
      const f = Object.assign({}, S.f); for (const k of ['faucetFixed', 'flushFixed', 'fridgeDone', 'printerFixed', 'dishesDone', 'mirrorDone', 'boxesCleared']) f[k] = done; f.toiletClean = done;
      ctxs.push({ S: Object.assign({}, S, { f }), f, time: m * 60, minutes: m, total: 600, progress: done ? 92 : 12, score: done ? 92 : 12, stage: done ? 3 : 1, n: 1, touch: 0 });
    }
    const ids = BB.dlg.SCRIPT_IDS.slice(); for (let i = 1; i <= 12; i++) ids.push('landlord:' + i);
    for (const id of ids) for (const c of ctxs) for (const seed of [1, 2]) {
      try {
        BB.dlg._seed(seed); const lines = BB.dlg.script(id, c);
        for (const l of lines || []) { add(l.who, l.text); for (const ch of (l.choices || [])) { add('bamboul', ch.text); try { const more = ch.run && ch.run(); if (Array.isArray(more)) for (const x of more) add(x.who, x.text); } catch (e) { } } }
      } catch (e) { }
    }
    BB.dlg._unseed();
    return [...res.values()];
  });
  const every = process.argv.includes('--all');
  const miss = all.filter(x => every || !man[x.key]).map(({ key, ...r }) => r);
  const out = process.argv.slice(2).find(a => !a.startsWith('--')) || '/tmp/lines_new.json'; fs.writeFileSync(out, JSON.stringify(miss));
  console.log('pool lines', all.length, 'missing clips', miss.length, '->', out);
  await br.close(); srv.close();
});
