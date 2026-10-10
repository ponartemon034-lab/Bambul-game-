// Usage: node tools/test_extras.js - gamepad, game-feel (jump), medals, daily run, new settings/menus
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
  // fake standard gamepad driven from the test
  await pg.addInitScript(() => {
    window.__pad = { on: false, axes: [0, 0, 0, 0], btn: {} };
    navigator.getGamepads = () => { const p = window.__pad; if (!p.on) return [null]; const buttons = []; for (let i = 0; i < 17; i++) { const d = !!p.btn[i]; buttons.push({ pressed: d, touched: d, value: d ? 1 : 0 }); } return [{ index: 0, id: 'Fake Pad (STANDARD GAMEPAD)', connected: true, mapping: 'standard', axes: p.axes.slice(), buttons, timestamp: performance.now() }]; };
  });
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart=1&q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(1500);
  let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  await ev(() => { const S = BB.S; S._st.introDone = 1; S.intro = 0; BB.P.force = null; BB.P.act = null; __bb.teleport(900); });
  await wait(600);

  // --- gamepad: stick walks, A jumps, hold stops short hop, X acts
  await ev(() => { __pad.on = true; __pad.axes = [0, 0, 0, 0]; }); await wait(300);
  ok(await ev(() => !!BB.pad.active), 'gamepad detected');
  const x0 = await ev(() => BB.P.x); await ev(() => { __pad.axes = [1, 0, 0, 0]; }); await wait(900); await ev(() => { __pad.axes = [0, 0, 0, 0]; });
  const x1 = await ev(() => BB.P.x); ok(x1 - x0 > 80, 'left stick right walks the hero', Math.round(x1 - x0));
  await wait(300);
  let peak = await ev(() => new Promise(res => { let pk = 0; const iv = setInterval(() => { pk = Math.max(pk, BB.P.y); }, 4); __pad.btn[0] = true; setTimeout(() => { __pad.btn[0] = false; }, 450); setTimeout(() => { clearInterval(iv); res(Math.round(pk)); }, 1400); }));
  ok(peak > 40, 'A button jumps (held = full jump)', peak);
  await wait(400);
  const before = await ev(() => BB.dlg._T ? 1 : 1);
  await ev(() => { __pad.axes = [0, 0, 0, 0]; __pad.btn[7] = true; }); await wait(250);
  ok(await ev(() => BB.In.use === true), 'RT is hold-to-clean (In.use)'); await ev(() => { __pad.btn[7] = false; }); await wait(200);
  ok(await ev(() => BB.In.use === false), 'releasing RT stops cleaning');
  // Start pauses (menu), B closes it again
  await ev(() => { __pad.btn[9] = true; }); await wait(200); await ev(() => { __pad.btn[9] = false; }); await wait(400);
  const paused = await ev(() => BB.paused || !!(BB.ui.menuKind && BB.ui.menuKind()));
  ok(paused, 'Start opens the pause menu', paused);
  await ev(() => { __pad.btn[1] = true; }); await wait(200); await ev(() => { __pad.btn[1] = false; }); await wait(500);
  ok(await ev(() => !BB.paused), 'B closes the pause menu'); await wait(800);
  // tool cycling: give the vacuum, RB selects it
  await ev(() => { BB.S.tools.vac = 1; BB.S.active = 'hand'; }); await ev(() => { __pad.btn[5] = true; }); await wait(120); await ev(() => { __pad.btn[5] = false; }); await wait(300);
  ok(await ev(() => BB.S.active === 'vac'), 'RB selects the next owned tool');
  await ev(() => { __pad.on = false; }); await wait(300);
  ok(await ev(() => !BB.pad.active && BB.In.gpAx === 0), 'unplugging releases the pad');

  // --- coyote time / jump buffer
  await ev(() => { BB.P.x = 900; BB.P.y = 0; BB.P.vy = 0; BB.In.reset(); }); await wait(200);
  const cy = await ev(() => new Promise(res => { const P = BB.P; P.y = 30; P.vy = 0; P.coy = .08; BB.In.jump = true; setTimeout(() => res({ vy: P.vy }), 40); }));
  ok(cy.vy > 100 || cy.vy < -1000, 'coyote time: jump still works just after leaving the ground', cy);
  // --- medals & daily
  const m = await ev(() => {
    BB.ach.reset(); const S = BB.S; S.chaos = { n: 3 }; S.daily = 20261010;
    const r1 = BB.ach.judge({ score: 93, ending: { id: 'shine' }, stats: { total: 480, early: true, lies: 0, missed: 0, answered: 4, hints: 0, lazy: 0 } }, S);
    const r2 = BB.ach.judge({ score: 93, ending: { id: 'shine' }, stats: { total: 480, early: false, lies: 0, missed: 0, answered: 4, hints: 0, lazy: 0 } }, S);
    return { n1: r1.earned.map(x => x.id), fresh1: r1.fresh.length, fresh2: r2.fresh.length, html: BB.ach.html().includes('Медали'), all: BB.ach.allHtml().includes('из ' + BB.ach.MEDALS.length), dailyBest: r2.dailyBest, seedStable: BB.ach.dailySeed() === BB.ach.dailySeed() };
  });
  ok(['shine', 'ok', 'early', 'honest', 'solo', 'flood', 'iron', 'daily'].every(id => m.n1.includes(id)), 'a clean early run earns the expected medals', m.n1);
  ok(m.fresh1 === m.n1.length && m.fresh2 === 0, 'medals are "new" only the first time', { f1: m.fresh1, f2: m.fresh2 });
  ok(m.html && m.all && m.dailyBest === 93 && m.seedStable, 'medal panel, medal list, daily best and stable daily seed');
  const dl = await ev(() => { BB.nextSeed = BB.ach.dailySeed(); BB.nextDaily = BB.ach.dailyId(); BB.story.start(480); const a = BB.S; const out = { seed: a.seed === BB.ach.dailySeed(), daily: a.daily === BB.ach.dailyId(), consumed: BB.nextSeed == null }; BB.story.start(480); out.next = BB.S.seed !== a.seed; return out; });
  ok(dl.seed && dl.daily && dl.consumed && dl.next, 'daily start uses the daily seed once, the next run is random again', dl);
  // menus
  await ev(() => { BB.ui.toMenu ? BB.ui.toMenu() : null; }); await wait(500);
  await ev(() => BB.ui.showMenu('medals')); await wait(300);
  ok(await ev(() => !!document.querySelector('.medal-all li')), 'medals menu renders');
  await ev(() => BB.ui.showMenu('settings')); await wait(300);
  ok(await ev(() => /Вибрация/.test(document.querySelector('#ui').innerText)), 'settings has the vibration switch');
  await ev(() => BB.ui.showMenu('new')); await wait(300);
  ok(await ev(() => /Ежедневный забег/.test(document.querySelector('#ui').innerText)), 'new-game menu offers the daily run');
  ok(errs.length === 0, 'no console/page errors', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await br.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
