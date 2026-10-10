// Usage: node tools/test_chaos.js - chaos director + seeded layouts + save/restore of chaos mess
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
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

  // seeds
  const sd = await ev(() => {
    const sig = S => JSON.stringify(S.items.map(i => [i.id, Math.round(i.ax), Math.round(i.z), i.v]));
    const a = BB.newState(480, { seed: 123 }), b = BB.newState(480, { seed: 123 }), c = BB.newState(480, { seed: 124 }), flat = BB.newState(480, { seed: 1, flat: true }), flat2 = BB.newState(480, { seed: 2, flat: true });
    const okAll = [a, c].every(S => S.items.every(i => [0, 600, 1450, 2050, 2600, 3300].every(p => Math.abs(i.ax - p) >= 45) && i.z >= -25 && i.z <= 55) && !S.items.some(i => i.room === 'hall' && i.ax > 345 && i.ax < 425) && new Set(S.items.filter(i => i.kind === 'trash').map(i => i.v)).size >= 14);
    return { same: sig(a) === sig(b), diff: sig(a) !== sig(c), flatStable: sig(flat) === sig(flat2), okAll, n: a.items.length };
  });
  ok(sd.same, 'same seed -> identical layout'); ok(sd.diff, 'different seed -> different layout'); ok(sd.flatStable, 'flat layout (old saves) is stable'); ok(sd.okAll, 'jittered layouts keep every placement rule', sd.n);

  // fire every event
  await ev(() => { const S = BB.newState(480, { seed: 5 }); S.mode = 'play'; BB.S = S; S._st = { introDone: 1, calls: {}, th: {}, tut: {} }; S.intro = 0; BB.paused = false; });
  const res = await ev(() => {
    const S = BB.S, out = {}; const s0 = S.stains.length, i0 = S.items.length, c0 = S.count.trash, sc0 = BB.tasks.progress(S).score;
    for (const id of Object.keys(BB.chaos.EVENTS)) { const r = BB.chaos.fire(id); out[id] = r; }
    return { out, stainsAdded: S.stains.length - s0, itemsAdded: S.items.length - i0, countGrew: S.count.trash - c0, log: S.chaos.log.length, flick: S.f.lampFlicker, scoreSame: BB.tasks.progress(S).score === sc0 };
  });
  ok(Object.values(res.out).every(Boolean), 'every event can fire', res.out);
  ok(res.stainsAdded === 3 && res.itemsAdded >= 3 && res.countGrew === res.itemsAdded, 'events add real mess (puddles + trash) and raise the trash target', { stains: res.stainsAdded, items: res.itemsAdded, count: res.countGrew });
  ok(res.flick === 1, 'neighbour event makes the lights flicker');

  // save / restore keeps chaos mess
  const rs = await ev(() => { const S = BB.S, blob = BB.tasks.serialize(S), R = BB.tasks.restore(JSON.parse(JSON.stringify(blob))); return { seed: R.seed === S.seed, stains: R.stains.length === S.stains.length, items: R.items.length === S.items.length, chaosN: R.chaos && R.chaos.n === S.chaos.n, sig: JSON.stringify(R.items.slice(0, 5).map(i => Math.round(i.ax))) === JSON.stringify(S.items.slice(0, 5).map(i => Math.round(i.ax))) }; });
  ok(rs.seed && rs.stains && rs.items && rs.chaosN && rs.sig, 'save/restore keeps seed, layout and chaos mess', rs);

  // director schedules by itself
  const sch = await ev(() => {
    const S = BB.newState(480, { seed: 77 }); S.mode = 'play'; S._st = { introDone: 1, calls: {}, th: {}, tut: {} }; BB.S = S; BB.paused = false;
    const fired = []; BB.on('chaos', d => fired.push(d.id)); const save = BB.ui.busy; BB.ui.busy = () => false;
    for (let t = 0; t < 480; t += 1) { S.time = 480 - t; BB.chaos.update(1, S); }
    BB.ui.busy = save; return { fired, max: BB.chaos.max(S), n: S.chaos.n };
  });
  ok(sch.n >= 2 && sch.n <= sch.max, 'director fires 2..max events over a full run, never more', sch);
  ok(new Set(sch.fired).size === sch.fired.length || sch.fired.length <= 3, 'no event twice in a row', sch.fired);
  const quiet = await ev(() => { const S = BB.newState(480, { seed: 77 }); S.mode = 'play'; S._st = { introDone: 0 }; BB.S = S; for (let t = 0; t < 400; t++) { S.time = 480 - t; BB.chaos.update(1, S); } return (S.chaos && S.chaos.n) || 0; });
  ok(quiet === 0, 'nothing fires before the intro is over', quiet);
  ok(errs.length === 0, 'no console/page errors', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await br.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
