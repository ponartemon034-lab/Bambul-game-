// Usage: node tools/test_pain.js  - checks the "боль Бамбуля" dialogue pack: pools, phases, walking chatter, censor mode.
const { chromium } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r));
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart=1&q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(1500);
  let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
  const ev = (f, a) => pg.evaluate(f, a);

  const info = await ev(() => {
    const cats = Object.keys(BB.dlg._POOL).filter(c => c.startsWith('pain:')); const per = {}; let total = 0, dups = 0, empty = 0;
    for (const c of cats) { const seen = new Set(); for (const e of BB.dlg._POOL[c]) { total++; if (!e.t || e.t.length < 8) empty++; if (seen.has(e.t)) dups++; seen.add(e.t); } per[c] = BB.dlg._POOL[c].length; }
    const all = new Set(); for (const c in BB.dlg._POOL) for (const e of BB.dlg._POOL[c]) if (typeof e.t === 'string') all.add(e.t);
    return { cats: cats.length, per, total, dups, empty, uniqueAll: all.size, mat: [...all].filter(t => /бля|хуй|хуе|хуи|пизд|ёб|еб[аеиуо]|сука|мудак|мудил/i.test(t)).length };
  });
  ok(info.cats === 12, 'pain pools registered', info.cats);
  ok(info.total >= 400, 'at least 400 own lines in pain pools', info.total);
  ok(info.dups === 0 && info.empty === 0, 'no duplicates / empty lines inside pools', { dups: info.dups, empty: info.empty });
  ok(Object.entries(info.per).filter(([k]) => /walk/.test(k)).every(([, n]) => n >= 50), 'each walk phase has >= 50 lines', Object.fromEntries(Object.entries(info.per).filter(([k]) => /walk/.test(k))));
  console.log('   unique lines in the whole game:', info.uniqueAll, '  with profanity:', info.mat);

  // phase choice follows the clock
  const ph = await ev(() => { const S = { time: 400, total: 480 }; const a = BB.dlg._pain.pick(S, 'hall'); S.time = 90; const b = BB.dlg._pain.pick(S, 'hall'); S.time = 20; const out = {}; for (let i = 0; i < 400; i++) { const c = BB.dlg._pain.pick(S, 'kitchen'); out[c] = (out[c] || 0) + 1; } return { a, b, late: out }; });
  ok((ph.late['pain:walk:late'] || 0) > 160 && !ph.late['pain:drink'], 'late phase is panic-heavy and has no "want to drink" mumble', ph.late);

  // walking really triggers chatter
  await ev(() => { const S = BB.S; S._st.introDone = 1; S.intro = 0; S.countdown = 1; BB.P.force = null; BB.P.act = null; BB.P.x = 700; BB.snapCamera(); BB.dlg._pain.n = 0; BB.dlg._pain.gap = 0; BB.dlg._pain.dist = 0; });
  const seen = new Set();
  await pg.keyboard.down('ShiftLeft');
  for (let k = 0; k < 14; k++) {
    await pg.keyboard.down(k % 2 ? 'KeyA' : 'KeyD'); await pg.waitForTimeout(1900); await pg.keyboard.up(k % 2 ? 'KeyA' : 'KeyD');
    const t = await ev(() => BB.dlg.last && BB.dlg.last.cat.startsWith('pain:') && BB.dlg.last.text); if (t) seen.add(t);
  }
  await pg.keyboard.up('ShiftLeft');
  const n = await ev(() => BB.dlg._pain.n);
  ok(n >= 3, 'walking about 27 s produces several phase barks', n);
  ok(seen.size >= 3, 'barks differ from each other', [...seen].slice(0, 4));

  // censor on: no profane word survives
  const cz = await ev(() => { BB.CFG.censor = true; let left = 0, shown = 0; const bad = []; for (const c of Object.keys(BB.dlg._POOL).filter(c => c.startsWith('pain:'))) for (const e of BB.dlg._POOL[c]) { const out = BB.cz(e.t); shown++; for (const w of out.match(/[А-Яа-яЁё]+/g) || []) if (BB.dlg._isProf(w)) { left++; if (bad.length < 5) bad.push(w); } } BB.CFG.censor = false; return { left, shown, bad }; });
  ok(cz.left === 0, 'censor mode leaves no profane word in pain lines', cz);
  ok(errs.length === 0, 'no console/page errors', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await br.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
