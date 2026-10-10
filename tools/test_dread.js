// Dread / despair system self-test (Playwright). Usage: node tools/test_dread.js
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
srv.listen(0, async () => {
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await br.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart=1&q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const S = BB.S; S._st.introDone = 1; S.intro = 0; S.countdown = 1; BB.P.force = null; });
  ok('BB.dread exists and starts calm', await pg.evaluate(() => !!BB.dread && BB.dread.level >= 1 && BB.dread.v < .1));

  // level mapping follows the forced value (the meter eases towards it)
  const lv = await pg.evaluate(async () => { const out = []; for (const v of [.1, .3, .5, .75, .95]) { BB.dread.set(v); await new Promise(r => setTimeout(r, 4500)); out.push(BB.dread.level); } BB.dread.set(null); return out; });
  ok('levels climb 1..5 with dread', lv.join() === '1,2,3,4,5', lv);

  // natural growth: time runs out -> dread grows; a clean flat grows it slower
  const nat = await pg.evaluate(async () => { const S = BB.S; const tot = S.total; S.time = tot * .9; await new Promise(r => setTimeout(r, 3000)); const early = BB.dread.target; S.time = tot * .1; await new Promise(r => setTimeout(r, 3000)); return { early, late: BB.dread.target }; });
  ok('dread grows as time runs out', nat.late > nat.early + .3, nat);

  // pools: every despair line exists, is gated by level, and has a voice clip
  const pools = await pg.evaluate(async () => {
    const m = await (await fetch('assets/voice/manifest.json')).json(); const miss = [];
    let n = 0; for (const c of ['breakdown:l2', 'breakdown:l3', 'breakdown:l4', 'breakdown:l5']) for (const e of BB.dlg._POOL[c]) { n++; if (!m[BB.voice._key('bamboul', e.t)]) miss.push(e.t.slice(0, 30)); }
    const gated = BB.dlg._POOL.move.filter(e => e.when).length;
    return { n, miss, gated };
  });
  ok('breakdown pools: 22+ tirades, all voiced', pools.n >= 22 && pools.miss.length === 0, pools);
  ok('walking pool has level-gated despair lines', pools.gated >= 48, pools.gated);

  // walking barks by level: calm level never says hysteria lines, level 5 does
  const gate = await pg.evaluate(() => {
    const S5 = new Set(BB.dlg._POOL.move.filter(e => e.when && /ААААА|Мама, забери/.test(e.t)).map(e => e.t));
    const sample = lvl => { BB.dread.level = lvl; const seen = []; for (let i = 0; i < 400; i++) { BB.dlg._reset(); seen.push(BB.dlg.line('move', {})); } return seen.filter(t => S5.has(t)).length; };
    const calm = sample(1), hyst = sample(5); BB.dread.level = 1; return { calm, hyst };
  });
  ok('hysteria walking lines only at level 5', gate.calm === 0 && gate.hyst > 0, gate);

  // breakdown fires, shows a tirade of the right level, plays a clip and sets a pose
  const bd = await pg.evaluate(async () => {
    BB.dread.set(.95); await new Promise(r => setTimeout(r, 5000)); BB.dlg._reset();
    const before = BB.voice.stats.clip; const ok1 = BB.dread.breakdown(); await new Promise(r => setTimeout(r, 500));
    return { ok1, text: BB.dlg.last && BB.dlg.last.text, cat: BB.dlg.last && BB.dlg.last.cat, mood: BB.P.mood, clip: BB.voice.stats.clip - before, level: BB.dread.level };
  });
  ok('breakdown shows a level-5 tirade with a voice clip', bd.ok1 && /^breakdown:l5$/.test(bd.cat || '') && bd.clip >= 1, bd);

  // random scheduler: at level 4+ breakdowns come by themselves
  const auto = await pg.evaluate(async () => { BB.dread.set(.9); const n0 = BB.dread.breakdowns; BB.dread._t = 1; await new Promise(r => setTimeout(r, 6000)); return BB.dread.breakdowns - n0; });
  ok('scheduler fires a breakdown by itself', auto >= 1, auto);

  // shocks: failing raises dread; effects can be switched off
  const sh = await pg.evaluate(() => { BB.dread.set(null); BB.dread.shock = 0; BB.dlg._reset(); BB.dlg.bark('fail', {}, { force: true }); const a = BB.dread.shock; BB.CFG.dread = false; BB.cam.shake = 0; BB.dread.set(1); BB.dread.level = 5; return { a }; });
  ok('a failure adds a shock', sh.a > 0, sh);
  await pg.waitForTimeout(1500);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log(pass + ' passed, ' + fail + ' failed'); await br.close(); srv.close(); process.exit(fail ? 1 : 0);
});
