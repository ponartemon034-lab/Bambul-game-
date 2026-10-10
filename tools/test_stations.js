// Usage: node tools/test_stations.js   - plays dishes/mirror/faucet/toilet/printer/vacJam end-to-end with REAL pointer input.
const { chromium } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..'), OUT = process.env.MINI_OUT || path.join(os.tmpdir(), 'st_shots'); fs.mkdirSync(OUT, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart&q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(1200);
  let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const wait = ms => pg.waitForTimeout(ms), ev = (f, a) => pg.evaluate(f, a);
  const box = () => ev(() => { const b = BB.mini._R.dom.cv.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const pt = async (lx, ly) => { const b = await box(); return [b.x + lx / 760 * b.w, b.y + ly / 400 * b.h]; };
  const stage = () => ev(() => BB.mini._R && BB.mini._R.stageId);
  const shot = n => pg.screenshot({ path: path.join(OUT, n + '.png') });
  async function waitStage(s, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if ((await stage()) === s) return true; await wait(80); } return false; }
  async function scrubAll(rect, maxMs = 40000) {
    const t0 = Date.now(), st0 = await stage();
    const [x0, y0] = await pt(rect[0], rect[1]); await pg.mouse.move(x0, y0); await pg.mouse.down();
    while (Date.now() - t0 < maxMs) {
      for (let j = 0; j <= 10; j++) { const [xa, ya] = await pt(rect[0], rect[1] + j / 10 * rect[3]); const [xb, yb] = await pt(rect[0] + rect[2], rect[1] + j / 10 * rect[3]); await pg.mouse.move(xa, ya, { steps: 6 }); await pg.mouse.move(xb, yb, { steps: 45 }); }
      if (process.env.DBG) console.log('prog', await ev(() => { const e = document.querySelector('.mn-prog i'); return e ? e.style.width : null; }));
      if (!(await ev(() => !!BB.mini._R)) || (await stage()) !== st0 || (await ev(() => BB.mini._R.won))) break;
    }
    await pg.mouse.up();
  }
  async function clickTarget(id) { const ts = await ev(() => BB.mini._R.targets().map(t => ({ id: t.id, x: t.x, y: t.y, w: t.w, h: t.h }))); const t = ts.find(t => t.id === id); const [x, y] = await pt(t.x + t.w / 2, t.y + t.h / 2); await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.up(); await wait(150); }
  async function holdUntilStageChange(st) {
    const t0 = Date.now(); const [x, y] = await pt(380, 200); await pg.mouse.move(x, y); let down = false; await ev(() => { BB.timeScale = .1; });
    while (Date.now() - t0 < 30000 && (await stage()) === st) { const d = await ev(() => BB.mini._R.stage.dbg && BB.mini._R.stage.dbg()); const inZ = d && d.pos > d.zone[0] + .02 && d.pos < d.zone[1] - .02; if (inZ && !down) { await pg.mouse.down(); down = true; } if (!inZ && down) { await pg.mouse.up(); down = false; } await wait(25); }
    if (down) await pg.mouse.up(); await ev(() => { BB.timeScale = 1; });
  }
  async function actionClick() { for (let k = 0; k < 4; k++) { try { const els = await pg.$$('.mn-actions .mn-btn'); if (els.length) { await els[0].click({ timeout: 1500 }); await wait(100); } return; } catch (e) { await wait(150); } } }
  async function winBtn() { const t0 = Date.now(); while (Date.now() - t0 < 4000) { const w = await ev(() => BB.mini._R && BB.mini._R.won); if (w) { await actionClick(); return; } await wait(100); } }
  async function begin(id) { await ev(id => { window.__res = null; BB.S = BB.newState(480); BB.S.mode = 'play'; BB.P.force = null; if (id === 'vacJam') BB.S.f.vacJam = 1; BB.mini.start(id, BB.S, r => { window.__res = r; }); }, id); await wait(300); }
  const plan = {
    dishes: async () => { await scrubAll([120, 170, 400, 60]); await winBtn(); },
    mirror: async () => { await scrubAll([150, 60, 440, 250]); await winBtn(); },
    faucet: async () => { await clickTarget('hose'); await clickTarget('nut'); ok(await waitStage('tighten'), 'faucet -> tighten'); await holdUntilStageChange('tighten'); ok(await waitStage('test'), 'faucet -> test'); await actionClick(); await winBtn(); },
    toilet: async () => { await scrubAll([220, 110, 320, 180]); ok(await waitStage('button'), 'toilet -> button'); await clickTarget('cap'); await clickTarget('spring'); ok(await waitStage('flush'), 'toilet -> flush'); await actionClick(); await winBtn(); },
    printer: async () => { await actionClick(); ok(await waitStage('pull'), 'printer -> pull'); for (const i of [0, 1, 2]) await clickTarget('f' + i); ok(await waitStage('feed'), 'printer -> feed'); await holdUntilStageChange('feed'); await winBtn(); },
    fridge: async () => {
      await actionClick(); ok(await waitStage('sort', 8000), 'fridge -> sort');
      for (let k = 0; k < 14; k++) {
        const bad = await ev(() => { const R = BB.mini._R; if (!R || R.stageId !== 'sort') return null; const b = R.targets().find(x => x.it && x.it.bad); return b ? b.id : null; });
        if (!bad) break; await clickTarget(bad);
        if (await ev(() => BB.mini._R && BB.mini._R.acts && BB.mini._R.acts.length && BB.mini._R.stageId === 'sort')) { /* bag full: carry out and reopen */ await actionClick(); await wait(600); if (!(await ev(() => !!BB.mini._R))) await ev(() => BB.mini.start('fridge', BB.S, r => { window.__res = r; })); }
      }
      ok(await waitStage('scrub', 8000), 'fridge -> scrub'); await scrubAll([60, 40, 600, 340], 220000); ok(await waitStage('close', 8000), 'fridge -> close'); await actionClick(); await wait(1500); await winBtn();
    },
    vacJam: async () => { await clickTarget('cable'); await clickTarget('sock'); await winBtn(); }
  };
  for (const id of Object.keys(plan)) { if (process.env.ONLY && !process.env.ONLY.split(',').includes(id)) continue;
    const t0 = Date.now(); await begin(id); ok(await ev(() => !!BB.mini._R), id + ' opens'); await shot(id + '_1');
    try { await plan[id](); } catch (e) { ok(false, id + ' exception ' + e.message); }
    await wait(500); const res = await ev(() => window.__res); await shot(id + '_end');
    console.log('   [' + id + ' took ' + ((Date.now() - t0) / 1000).toFixed(0) + 's, frame ' + (await ev(() => BB.frameStats && BB.frameStats.drawn)) + ' drawn, hooks ' + (await ev(() => BB.hooks.update.length)) + ', fx ' + (await ev(() => BB.fx._count())) + ']');
    ok(res && res.win, id + ' wins (res=' + JSON.stringify(res && { win: res.win, time: res.timeCost }) + ')');
    if (await ev(() => !!BB.mini._R)) await ev(() => BB.mini.abort());
  }
  console.log(errs.length ? 'console errors:\n' + errs.join('\n') : 'no console errors'); console.log('PASS ' + pass + ' FAIL ' + fail + '  shots: ' + OUT);
  await br.close(); srv.close(); process.exit(fail || errs.length ? 1 : 0);
})();
