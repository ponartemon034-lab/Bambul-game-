// Headless story-flow test.  Usage: node tools/test_story.js
// Boots index.html, drives BB.story (intro, calls, thresholds, endings, save/load) and prints PASS/FAIL per check.
const { chromium } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end('nf'); return; } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }); s.listen(0, () => res(s)); }); }

let pass = 0, fail = 0;
const check = (name, ok, info) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); };

(async () => {
  const srv = await serve(), port = srv.address().port;
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  pg.on('console', m => { const t = m.text(); if (['error', 'warning'].includes(m.type()) && !/Failed to load resource|fonts\.g|net::ERR/.test(t)) logs.push(m.type() + ': ' + t); });
  pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await pg.goto('http://localhost:' + port + '/index.html?q=low&enhance=0', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.BB && BB.built, { timeout: 90000 });
  const ev = (f, a) => pg.evaluate(f, a);
  const wait = ms => pg.waitForTimeout(ms);
  const until = async (f, ms = 15000, a) => { try { await pg.waitForFunction(f, a, { timeout: ms, polling: 50 }); return true; } catch (e) { return false; } };
  const modules = await ev(() => ({ tasks: !!BB.tasks, ui: !!BB.ui, dlg: !!BB.dlg, audio: !!BB.audio, char: !!BB.char, mini: !!BB.mini, story: !!BB.story, npc: !!(BB.npc && BB.npc.landlord) }));
  console.log('modules present:', JSON.stringify(modules));
  check('BB.story exists', modules.story);

  // helper: push dialog forward (real UI if present) until it closes; pick = choice index (0-based)
  async function talk(pick = 0, maxSteps = 80) {
    for (let i = 0; i < maxSteps; i++) {
      const s = await ev(() => { const d = BB.ui && BB.ui.state && BB.ui.state.dlg; return { dlg: !!d, choice: !!(d && d.line && d.line.choices && d.line.choices.length), typing: !!(d && d.typing), fb: !!BB.story.debug.R.fb, talk: BB.story.talking }; });
      if (!s.dlg && !s.fb && !s.talk) return true;
      if (s.dlg) { if (s.choice && !s.typing) await pg.keyboard.press('Digit' + (pick + 1)); else await pg.keyboard.press('Space'); }
      await wait(s.fb ? 300 : 60);
    }
    return false;
  }

  /* ---------------------------------------------------------------- 1. intro */
  await ev(() => { BB.timeScale = 1; BB.ui ? BB.ui.newGame(120) : BB.story.start(120); });
  const s1 = await ev(() => ({ mode: BB.S.mode, total: BB.S.total, time: BB.S.time, x: Math.round(BB.P.x), sofa: BB.abs('living', 195), force: BB.P.force, st: !!BB.S._st }));
  check('start(120): play mode, 120 s, hero on sofa lying', s1.mode === 'play' && s1.total === 120 && s1.time === 120 && s1.force === 'sit' && Math.abs(s1.x - s1.sofa) < 5, s1);
  await wait(500);
  check('phone not ringing during the first sleep seconds', await ev(() => BB.S.f.phoneRing === 0));
  check('intro: wall phone rings (S.f.phoneRing=1)', await until(() => BB.S.f.phoneRing === 1, 6000));
  const t0 = await ev(() => BB.S.time); await wait(1500);
  check('countdown frozen until the phone is answered', (await ev(() => BB.S.time)) === t0 && t0 === 120, t0);
  await pg.keyboard.down('KeyA'); await wait(700); await pg.keyboard.up('KeyA');
  check('moving wakes the hero (force cleared)', await ev(() => BB.P.force === null && BB.story.debug.R.lying === false));
  check('tutorial toast for the phone', await until(() => BB.story.debug.log.some(l => l.n === 'tutorial') , 9000));
  await ev(() => __bb.teleport(BB.abs('hall', 250)));
  await wait(300);
  const hot = await ev(() => BB.cur.hot && BB.cur.hot.id);
  check('phone hotspot in range', hot === 'phone', hot);
  await ev(() => { __bb.In.act = true; }); await wait(200);
  let talking = await until(() => BB.story.talking || BB.story.debug.R.fb, 4000);
  if (!talking) { await ev(() => BB.story.phone()); talking = await until(() => BB.story.talking, 4000); }
  check('answering opens the dialogue', talking);
  const intro1 = await ev(() => JSON.stringify(BB.story.debug.R.dialogs[BB.story.debug.R.dialogs.length - 1]).slice(0, 160));
  console.log('   intro dialogue starts:', intro1);
  await talk(0); await wait(1200);
  const s2 = await ev(() => ({ done: BB.S._st.introDone, ring: BB.S.f.phoneRing, up: BB.S.f.phoneUp, intro: BB.S.intro, locked: BB.P.locked, held: BB.P.held }));
  check('intro finished: countdown running, phone hung up, player free', s2.done === 1 && s2.ring === 0 && s2.up === 0 && !s2.locked && s2.held == null, s2);
  await wait(1500);
  check('clock now runs (real time)', (await ev(() => BB.S.time)) < 119.5);

  /* ---------------------------------------------------- 2. time rule: dialog slows */
  const rate = await ev(() => { BB.story.debug.R.talk = true; const a = BB.story.debug.timeRate(); BB.story.debug.R.talk = false; return [a, BB.story.debug.timeRate()]; });
  check('time rate 0.3 during talk, 1 otherwise', rate[0] === 0.3 && rate[1] === 1, rate);
  const pz = await ev(async () => { BB.paused = true; const t = BB.S.time; await new Promise(r => setTimeout(r, 600)); const d = t - BB.S.time; BB.paused = false; return d; });
  check('clock stops while BB.paused', pz === 0, pz);

  /* ---------------------------------------------------------- 3. thresholds once */
  await ev(() => { BB.timeScale = 3; BB.S.time = 60.6; });
  await wait(600);
  await ev(() => { BB.S.time = 30.6; }); await wait(600);
  await ev(() => { BB.S.time = 10.6; }); await wait(500);
  await ev(() => { BB.timeScale = 1; BB.story.debug.R.callGap = 999; });
  const th = await ev(() => BB.story.debug.log.filter(l => l.n === 'threshold').map(l => l.d));
  check('total 120: thresholds 60/30/10 fired exactly once each, 300/120 never', JSON.stringify(th) === '[60,30,10]', th);
  check('threshold feedback produced (toast or ui)', await ev(() => !!document.querySelector('.toast') || BB.story.debug.R.toasts.length > 0));

  /* --------------------------------------------------------------- 4. calls */
  await ev(() => { BB.ui && BB.ui.newGame(120); BB.timeScale = 1; const S = BB.S; S._st.introDone = 1; S.intro = 0; BB.player.force(null); BB.story.debug.R.lying = false; BB.story.debug.R.intro = null; S._st.reactive = 99; S.time = 91; BB.story.debug.R.callGap = 0; });
  await wait(300);
  await ev(() => { BB.S.time = 89.5; });
  const l1ok = await until(() => BB.story.ringing === 'l1', 4000);
  check('scheduled call l1 rings at 75 %', l1ok, l1ok ? undefined : await ev(() => { const R = BB.story.debug.R; return { gap: R.callGap, talk: R.talk, pend: R.pendingEnd, busy: BB.ui.busy(), t: BB.S.time, mode: BB.S.mode, calls: BB.S._st.calls, paused: BB.paused, menu: BB.ui.menuKind(), th: BB.timeScale }; }));
  check('ring: S.f.phoneRing=1 and UI ring pill (if UI)', await ev(() => BB.S.f.phoneRing === 1 && (!BB.ui || !!BB.ui.state.ring)));
  const before = await ev(() => BB.S.time);
  await ev(() => BB.story.answer());
  check('answering from the ring pill starts a dialogue', await until(() => BB.story.talking || BB.story.debug.R.fb, 4000));
  const lines = await ev(() => BB.story.debug.R.dialogs[BB.story.debug.R.dialogs.length - 1]);
  const choiceLine = lines && lines.find(l => l.choices);
  check('call has a choice question (claim / honest / joke)', !!choiceLine && choiceLine.choices.length === 3, choiceLine && choiceLine.text);
  await talk(0);                      // pick "Да, всё готово!" while nothing is fixed -> lie
  const after = await ev(() => ({ t: BB.S.time, lies: BB.S._st.lies, d: BB.story.lastDelta }));
  check('lying about an unfinished task costs ~15 s', after.lies === 1 && before - after.t > 13 && before - after.t < 20, { before, after });
  await until(() => !BB.story.talking && BB.S.f.phoneUp === 0, 5000);
  // ignored ring
  await ev(() => { BB.S.time = 57; BB.story.debug.R.callGap = 0; });
  { const ok2 = await until(() => BB.story.ringing === 'l2' || BB.story.ringing === 'd1', 6000); check('call l2 rings at 50 %', ok2, ok2 ? undefined : await ev(() => { const R = BB.story.debug.R; return { ringing: BB.story.ringing, gap: R.callGap, t: BB.S.time, calls: BB.S._st.calls, busy: BB.ui.busy(), talk: R.talk, scale: BB.timeScale }; })); }
  const tb = await ev(() => BB.S.time); await ev(() => { BB.timeScale = 6; });
  const missed = await until(() => BB.story.ringing === null, 8000); await ev(() => { BB.timeScale = 1; });
  const tm = await ev(() => ({ t: BB.S.time, missed: BB.S._st.missed, ring: BB.S.f.phoneRing }));
  check('ignored ring stops after the timeout, small fixed penalty, no endless ring', missed && tm.missed === 1 && tm.ring === 0 && tb - tm.t >= 7 && tb - tm.t < 30, { tb, tm });
  // Dan hint
  await ev(() => { BB.S._st.danCd = 0; BB.story.debug.R.callGap = 999; });
  check('callDan() starts a hint dialogue', await ev(() => BB.story.callDan() === true));
  await until(() => BB.story.talking || BB.story.debug.R.fb, 3000);
  const dl = await ev(() => JSON.stringify(BB.story.debug.R.dialogs[BB.story.debug.R.dialogs.length - 1]));
  console.log('   dan hint:', dl.slice(0, 230));
  await talk(0);
  const cd = await ev(() => BB.story.danCooldown());
  check('Dan cooldown 35 s, second call refused', cd.left > 30 && (await ev(() => BB.story.callDan())) === false, cd);
  const dan = await ev(() => { const l = BB.story.debug.R.dialogs[BB.story.debug.R.dialogs.length - 1]; return l.some(x => x.who === 'dan'); });
  check('Dan hint lines come from Dan', dan);

  /* ------------------------------------------------------ 5. early door ending */
  await ev(() => { BB.S.f.faucetFixed = 1; BB.S.f.fridgeDone = 1; BB.S.time = 70; BB.story.debug.R.callGap = 999; __bb.teleport(BB.abs('hall', 95)); });
  await wait(200);
  await ev(() => BB.story.askDoor());
  const door = await ev(() => ({ menu: BB.ui ? BB.ui.menuKind() : 'door', paused: BB.paused, locked: BB.P.locked }));
  check('askDoor() shows the door confirmation (clock paused by UI)', door.menu === 'door' && door.paused === true, door);
  // cancel path
  await ev(() => { BB.ui.state.menu.arg.onNo(); BB.ui.closeMenu(); });
  check('cancel resumes play and unlocks the hero', await ev(() => !BB.paused && !BB.P.locked && BB.S.mode === 'play'));
  await ev(() => BB.story.askDoor());
  await ev(() => { const a = BB.ui.state.menu.arg; BB.ui.closeMenu(); a.onYes(); });
  await ev(() => { BB.timeScale = 4; });
  check('early ending: mode becomes ending', await until(() => BB.S.mode === 'ending', 3000));
  const expected = await ev(() => BB.story.progress(BB.S).score);
  let guard = 0;
  while (guard++ < 120 && !(await ev(() => !!BB.story.lastResult))) { await talk(0, 3); await wait(150); }
  const res = await ev(() => ({ r: BB.story.lastResult && { score: BB.story.lastResult.score, ending: BB.story.lastResult.ending.id, early: BB.story.lastResult.stats.early, parts: BB.story.lastResult.parts.length }, final: BB.story.progress(BB.S).score, menu: BB.ui ? BB.ui.menuKind() : null, door: BB.S.f.doorOpen, ph: BB.story.phase, npc: BB.npc && BB.npc.landlord ? { hidden: BB.npc.landlord.hidden, x: Math.round(BB.npc.landlord.x) } : null }));
  check('early ending produced a result from real progress', !!res.r && res.r.score === res.final && res.r.early === true && res.r.parts > 3, res);
  check('door opened and result screen shown', res.door === 1 && (!modules.ui || res.menu === 'result'), res.menu);
  console.log('   expected-before-tour score', expected, '-> final', res.final, 'ending', res.r && res.r.ending);
  const sv = await ev(() => localStorage.getItem('bamboul.save'));
  check('save cleared after ending', sv === null);

  /* ------------------------------------------------------ 6. timeout ending */
  await ev(() => { BB.timeScale = 1; BB.ui.closeMenu(); BB.story.restart(); const S = BB.S; S._st.introDone = 1; S.intro = 0; BB.player.force(null); BB.story.debug.R.intro = null; BB.story.debug.R.lying = false; BB.story.debug.R.callGap = 999; S.time = 1.2; });
  await ev(() => { BB.timeScale = 4; });
  check('time 0 triggers the landlord arrival (ending mode, door opens)', await until(() => BB.S.mode === 'ending' && BB.S.f.doorOpen === 1, 8000));
  guard = 0; while (guard++ < 160 && !(await ev(() => !!BB.story.lastResult && BB.story.lastResult.stats.left === 0))) { await talk(0, 3); await wait(150); }
  const res2 = await ev(() => ({ r: BB.story.lastResult && { score: BB.story.lastResult.score, ending: BB.story.lastResult.ending.id, early: BB.story.lastResult.stats.early, title: BB.story.lastResult.ending.title }, final: BB.story.progress(BB.S).score }));
  check('timeout ending: result with real score, not early', !!res2.r && res2.r.early === false && res2.r.score === res2.final && ['museum', 'sofa'].includes(res2.r.ending), res2);
  await ev(() => { BB.timeScale = 1; });

  /* ----------------------------------------------------------- 7. save / load */
  await ev(() => { BB.ui.closeMenu && BB.ui.closeMenu(); BB.ui.newGame(300); const S = BB.S; S._st.introDone = 1; S.intro = 0; BB.player.force(null); BB.story.debug.R.intro = null; BB.story.debug.R.lying = false;
    S.f.faucetFixed = 1; S.f.faucetHowl = 0; S.time = 211.5; S.items[0].taken = 1; S._st.lies = 2; S._st.lcount = 2; S._st.calls.l1 = 2; __bb.teleport(BB.abs('kitchen', 200)); BB.story.debug.R.callGap = 999; });
  const sres = await ev(() => BB.story.save());
  const raw = await ev(() => localStorage.getItem('bamboul.save'));
  check('save() writes bamboul.save', sres === true && !!raw && JSON.parse(raw).v === 2);
  check('hasSave()', await ev(() => BB.story.hasSave()));
  const cantTalk = await ev(() => { BB.story.debug.R.talk = true; const r = BB.story.save(); BB.story.debug.R.talk = false; return r; });
  check('no save while a dialogue is open (consistency)', cantTalk === false);
  await ev(r => { BB.story.start(600); localStorage.setItem('bamboul.save', r); }, raw);
  check('new run with other settings really differs', await ev(() => BB.S.total === 600 && !BB.S.f.faucetFixed));
  const cont = await ev(() => BB.story.continue());
  const rs = await ev(() => ({ total: BB.S.total, time: Math.round(BB.S.time), fixed: BB.S.f.faucetFixed, howl: BB.S.f.faucetHowl, taken: BB.S.items[0].taken, lies: BB.S._st.lies, l1: BB.S._st.calls.l1, x: Math.round(BB.P.x), kx: BB.abs('kitchen', 200), mode: BB.S.mode, ring: BB.S.f.phoneRing, intro: BB.S._st.introDone }));
  check('continue(): state restored consistently', cont === true && rs.total === 300 && Math.abs(rs.time - 211) <= 3 && rs.fixed === 1 && rs.howl === 0 && rs.taken === 1 && rs.lies === 2 && rs.l1 === 2 && Math.abs(rs.x - rs.kx) < 3 && rs.mode === 'play' && rs.ring === 0 && rs.intro === 1, rs);
  check('corrupt save is rejected', await ev(() => { localStorage.setItem('bamboul.save', '{"v":2,"time":-4}'); const a = BB.story.hasSave(); localStorage.setItem('bamboul.save', 'xx'); return !a && !BB.story.hasSave() && BB.story.continue() === false; }));

  /* -------------------------------------------- 8. restart / toTitle / re-entrancy */
  const hooks0 = await ev(() => BB.hooks.update.filter(f => f === BB.story._hook).length);
  await ev(() => { BB.story.restart(); BB.story.restart(); });
  const re = await ev(() => ({ hooks: BB.hooks.update.filter(f => f === BB.story._hook).length, time: BB.S.time, mode: BB.S.mode, ph: BB.story.phase }));
  check('restart twice: one update hook, clean intro state', hooks0 === 1 && re.hooks === 1 && re.time === re.time && re.mode === 'play' && /intro/.test(re.ph), re);
  await ev(() => BB.story.toTitle());
  check('toTitle(): menu mode, nothing paused', await ev(() => BB.S.mode === 'menu' && !BB.paused));

  const errs = await ev(() => BB.story.debug.errs.slice());
  check('no swallowed foreign-call errors', errs.length === 0, errs);
  check('no console errors/warnings', logs.length === 0, logs.slice(0, 6));
  console.log(`\n${pass} passed, ${fail} failed`);
  await br.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
