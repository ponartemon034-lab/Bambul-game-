// Dialogue wiring self-test (Playwright): authored lines mapped onto situations, landlord calls that develop. Usage: node tools/test_lines.js
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
srv.listen(0, async () => {
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] }); const pg = await br.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart=1&q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(1200);

  // 1. every ambient bark is one of the authored lines (or a despair line for the last seconds)
  const amb = await pg.evaluate(() => {
    const U = new Set(); for (const g of Object.values(BB.dlg.USER)) if (Array.isArray(g)) g.forEach(r => U.add(r[0])); else for (const h of Object.values(g)) h.forEach(r => U.add(r[0]));
    const DS = new Set(); for (const g of Object.values(BB.dlg.DESPAIR)) g.forEach(r => DS.add(r[0]));
    const hang = new Set(BB.dlg._POOL['phone:hangup'].map(e => e.t));
    const cats = ['pickup', 'toss', 'bagFull', 'cloth', 'laundry:start', 'vac:start', 'vac:snag', 'mop:start', 'mop:done', 'faucet:open', 'faucet:done', 'fridge:open', 'toilet:scrub', 'printer:error', 'dishes', 'idle', 'idle:l1', 'idle:l3', 'idle:l5', 'roomEnter:kitchen', 'sofa', 'jump', 'success', 'fail', 'cleanLow', 'time:300', 'time:120', 'time:60', 'time:30', 'time:10', 'phone:ring', 'phone:hangup', 'chore:avoid', 'owner:comes'];
    const bad = [], empty = [];
    for (const c of cats) { const p = BB.dlg._POOL[c]; if (!p || !p.length) { empty.push(c); continue; } for (const e of p) if (!U.has(e.t) && !DS.has(e.t) && !hang.has(e.t)) bad.push(c + ': ' + e.t.slice(0, 40)); }
    const walk = BB.dlg._POOL.move.filter(e => !e.when).filter(e => !U.has(e.t)).map(e => e.t.slice(0, 40));
    return { n: cats.length, bad: bad.slice(0, 5), empty, walk: walk.slice(0, 5), moveSize: BB.dlg._POOL.move.length };
  });
  ok('situations use only the authored lines', amb.bad.length === 0 && amb.empty.length === 0, amb);
  ok('walking pool has only authored lines (+ gated despair)', amb.walk.length === 0, amb.walk);
  // 2. situations: the right group for the right event
  const ctx = await pg.evaluate(() => {
    const has = (cat, ...grps) => { const g = [].concat(...grps.map(x => BB.dlg.USER[x].map(r => r[0]))); return BB.dlg._POOL[cat].every(e => g.indexOf(e.t) >= 0); };
    return { pickup: has('pickup', 'trash'), faucet: has('faucet:open', 'faucet'), mop: has('mop:start', 'chore', 'tired'), time300: has('time:300', 'owner'), wait: has('idle', 'wait', 'chore') };
  });
  ok('pickup=rubbish, faucet=tap, mop=cleaning, time=boss, idle=waiting groups', ctx.pickup && ctx.faucet && ctx.mop && ctx.time300 && ctx.wait, ctx);
  // 3. landlord calls
  const calls = await pg.evaluate(() => {
    const out = {}; for (let n = 1; n <= 5; n++) { BB.dlg._seed(1); const c = { S: BB.S, f: BB.S.f, time: 120, minutes: 2, score: 30 }; out[n] = BB.dlg.script('landlord:' + n, c).filter(l => l.who === 'landlord').map(l => l.text); }
    BB.dlg._unseed(); return out;
  });
  const first = [1, 2, 3, 4, 5].map(n => calls[n][0]);
  ok('landlord calls 1..5 open differently', new Set(first).size === 5, first.map(x => x.slice(0, 30)));
  ok('call 2: level crossing between Leninsk and Volzhsky', /Ленинск/.test(calls[2].join(' ')) && /Волжск/.test(calls[2].join(' ')));
  ok('call 3: jam / road works in Volzhsky', /Волжск/.test(calls[3].join(' ')) && /ремонт/.test(calls[3].join(' ')));
  ok('calls 2..5 tell the minutes left', [2, 3, 4, 5].every(n => /осталось две минуты/.test(calls[n].join(' '))), [2, 3, 4, 5].map(n => /осталось две минуты/.test(calls[n].join(' '))));
  ok('calls 2..5 threaten about the mess', [2, 3, 4, 5].every(n => /срач|соринк|свалка/.test(calls[n].join(' '))));
  const mins = await pg.evaluate(() => [1, 2, 5, 9].map(m => { BB.dlg._seed(1); return BB.dlg.script('landlord:2', { S: BB.S, f: BB.S.f, minutes: m, time: m * 60, score: 30 }).filter(l => l.who === 'landlord')[1].text; }));
  ok('minute wording follows the clock', /одна минута/.test(mins[0]) && /две минуты/.test(mins[1]) && /пять минут/.test(mins[2]) && /девять минут/.test(mins[3]), mins.map(m => m.slice(60, 110)));
  // 4. after the call Bamboul wishes the landlord stuck in traffic
  const hang = await pg.evaluate(() => { BB.dlg._reset(); const t = BB.dlg.bark('afterCall', { S: BB.S }, { force: true }); return { t, inPool: BB.dlg._POOL['phone:hangup'].some(e => e.t === t) }; });
  ok('after a call: hang-up line from the dedicated pool', hang.inPool, hang);
  // 5. in the real flow: first reactive call is NOT the intro text
  const flow = await pg.evaluate(() => { const S = BB.S, id = x => BB.dlg.script('landlord:' + x, { S, f: S.f, time: 200, minutes: 3, score: 20 })[0].text; return { intro: id(1), next: id(2) }; });
  ok('intro and the next call differ', flow.intro !== flow.next, flow);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log(pass + ' passed, ' + fail + ' failed'); await br.close(); srv.close(); process.exit(fail ? 1 : 0);
});
