// Dumps every spoken line (who + text) from BB.dlg pools and scripts -> /tmp/lines.json
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); const pg = await br.newPage();
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart=1'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(2500);
  const out = await pg.evaluate(() => {
    const res = new Map(), add = (who, t) => { if (!t || typeof t !== 'string') return; const k = who + '|' + t; if (!res.has(k)) res.set(k, { who, text: t }); };
    const whoOf = cat => { const m = BB.dlg._meta ? BB.dlg._meta(cat) : null; return (m && m.who) || 'bamboul'; };
    for (const cat in BB.dlg._POOL) for (const e of BB.dlg._POOL[cat]) add(whoOf(cat), e.t);
    const S = BB.S, base = JSON.parse(JSON.stringify(S));
    const ctxs = [];
    for (const time of [660, 480, 300, 180, 90, 40]) for (const done of [0, 1]) {
      const f = Object.assign({}, S.f); for (const k of ['faucetFixed', 'flushFixed', 'fridgeDone', 'printerFixed', 'dishesDone', 'mirrorDone', 'boxesCleared']) f[k] = done; f.toiletClean = done;
      ctxs.push({ S: Object.assign({}, S, { f }), f, time, total: 600, progress: done ? 92 : 12, score: done ? 92 : 12, stage: done ? 3 : 1, n: 1, touch: 0 });
    }
    const ids = BB.dlg.SCRIPT_IDS.slice(); for (let i = 1; i <= 12; i++) ids.push('landlord:' + i);
    for (const id of ids) for (const c of ctxs) {
      for (const seed of [1, 2]) { try { BB.dlg._seed(seed); const lines = BB.dlg.script(id, c); for (const l of lines || []) { add(l.who, l.text); for (const ch of (l.choices || [])) { add('bamboul', ch.text); try { const more = ch.run && ch.run(); for (const m of (more || [])) add(m.who, m.text); } catch (e) { } } } } catch (e) { } }
    }
    BB.dlg._unseed(); return [...res.values()].filter(x => x.who !== 'narr');
  });
  fs.writeFileSync('/tmp/lines.json', JSON.stringify(out)); const by = {}; out.forEach(o => by[o.who] = (by[o.who] || 0) + 1); console.log(out.length, JSON.stringify(by), 'chars', out.reduce((a, o) => a + o.text.length, 0));
  await br.close(); srv.close();
});
