/* In-page self test for js/tasks.js.  Run: node tools/test_tasks.js   (or tools/shot.js --eval "…" with this file's source).
   Drives the REAL game page: new state, teleports, E / hold-F, interact, save/restore.  Returns {pass, fail, log}. */
window.__tasksSelfTest = async function () {
  const log = [], fails = []; let pass = 0;
  const ok = (c, m) => { if (c) pass++; else { fails.push(m); } log.push((c ? 'ok   ' : 'FAIL ') + m); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms, step) => { const t0 = performance.now(); while (performance.now() - t0 < (ms || 4000)) { if (fn()) return true; await sleep(step || 30); } return !!fn(); };
  const B = BB, P = BB.P, T = BB.tasks;
  B.timeScale = 3;
  // isolate gameplay from the story clock / phone ringing while testing
  if (B.story && B.story._hook) { const i = B.hooks.update.indexOf(B.story._hook); if (i >= 0) B.hooks.update.splice(i, 1); }
  if (B.ui && B.ui.busy) await until(() => !B.ui.busy(), 8000);
  await sleep(300);
  const fresh = () => { B.S = B.newState(480); B.S.mode = 'play'; B.paused = false; P.force = null; P.locked = false; P.x = 300; P.y = 0; B.In.reset(); return B.S; };
  const free = () => until(() => !P.act && !P.walkTo, 6000);
  const hs = id => ({ id, ax: 0, r: 50 });
  const at = x => { __bb.teleport(x); };
  const lastScore = { v: -1 }; const scores = []; const rec = () => { const s = T.progress(B.S).score; scores.push(s); return s; };

  /* 1. world data */
  let S = fresh();
  const tr = S.items.filter(i => i.kind === 'trash'), cl = S.items.filter(i => i.kind === 'cloth');
  ok(tr.length >= 24, 'trash >= 24 (' + tr.length + ')');
  ok(new Set(tr.map(i => i.v)).size >= 14, 'trash variants >= 14 (' + new Set(tr.map(i => i.v)).size + ')');
  ok(cl.length >= 6, 'clothes >= 6 (' + cl.length + ')');
  ok(['hall', 'living', 'kitchen', 'bath', 'work'].every(r => tr.some(i => i.room === r)), 'trash in all five rooms');
  ok(['hall', 'living', 'kitchen', 'bath', 'work'].every(r => S.stains.some(i => i.room === r && i.kind === 'grime')) , 'grime in every room');
  ok(S.stains.length >= 8, 'stains >= 8 (' + S.stains.length + ')');
  ok(S.dust.length >= 8 && S.dust.every(d => ['hall', 'living', 'work'].includes(d.room)) && ['hall', 'living', 'work'].every(r => S.dust.some(d => d.room === r)), 'dust >= 8 in hall/living/work (' + S.dust.length + ')');
  ok(S.stains.some(s => s.kind === 'water' && s.leak), 'leak puddle exists');
  const parts = [0, 600, 1450, 2050, 2600, 3300];
  const awayFromWalls = a => parts.every(p => Math.abs(a - p) >= 45);
  ok(S.items.every(i => awayFromWalls(i.ax) && i.z >= -25 && i.z <= 55), 'items clear of partitions, z in -25..55');
  ok(!S.items.some(i => i.room === 'hall' && i.ax > 345 && i.ax < 425), 'no item under hall boxes');
  ok(S.dust.concat(S.stains).every(o => awayFromWalls(o.ax)), 'stains/dust clear of partitions');
  ok(!S.tools.vac && !S.tools.mop && !S.tools.box && S.active === 'hand', 'tools start unowned');
  const pr0 = T.progress(S); ok(pr0.score === 0 && pr0.total === 11 && pr0.parts.reduce((a, p) => a + p.weight, 0) === 100, 'progress: 11 parts, weights sum to 100, score 0');
  ok(T.checklist(S).length === 11 && T.checklist(S).every(c => c.hint && c.where), 'checklist has hints/locations');

  /* 2. prompts / availability */
  ok(T.prompt(hs('bagStand'), S) === null && T.prompt(hs('bin'), S) === null && T.prompt(hs('washer'), S) === null, 'dump points unavailable with empty hands');
  ok(/пылесос/i.test(T.prompt(hs('closet'), S)) && /швабр/i.test(T.prompt(hs('mopStand'), S)) && /ящик/i.test(T.prompt(hs('toolbox'), S)), 'tool prompts present');
  ok(/нужен ящик/.test(T.prompt(hs('faucet'), S)) && /нужен ящик/.test(T.prompt(hs('printer'), S)), 'missing toolbox shown in prompt');
  ok(T.prompt(hs('fridge'), S) && !/нужен/.test(T.prompt(hs('fridge'), S)), 'fridge needs nothing');
  ok(T.prompt(hs('boxes'), S) && T.prompt(hs('sofa'), S) && T.prompt(hs('tv'), S) && T.prompt(hs('pc'), S), 'boxes/sofa/tv/pc prompts');
  ok(T.prompt(hs('nonexistent'), S) === null, 'unknown hotspot -> null');

  /* 3. pickup + hotspot hook + real hero control */
  const t0 = S.items.find(i => i.id === 't01'); at(t0.ax); await sleep(120);
  const hsList = B.hooks.hotspots.map(f => f(S)).flat();
  ok(hsList.some(h => h.id === 'item:t01' && h.low), 'item hotspot exposed by hooks.hotspots');
  ok(B.cur.hot && B.cur.hot.id.startsWith('item:'), 'hero picks item hotspot via main.js (' + (B.cur.hot && B.cur.hot.id) + ' can=' + B.player.canControl() + ' busy=' + (B.ui && B.ui.busy && B.ui.busy()) + ' act=' + JSON.stringify(P.act && P.act.type) + ' x=' + P.x + ' ax=' + t0.ax + ')');
  ok(/Подобрать/.test(B.cur.prompt || ''), 'prompt shows pickup text');
  B.In.act = true; await sleep(250); await free();
  ok(S.carry.trash === 1 && S.items.filter(i => i.taken).length === 1, 'E picks up one piece with animation (carry=' + S.carry.trash + ')');
  await until(() => P.held === 'bag', 2500);
  ok(P.held === 'bag', 'held=bag while carrying (held=' + P.held + ' act=' + JSON.stringify(P.act && P.act.type) + ' busy=' + !!(B.ui && B.ui.busy && B.ui.busy()) + ' st=' + P.st + ')');
  await until(() => S.slow < 1, 1500);
  ok(S.slow < 1, 'carrying slows hero (slow=' + S.slow.toFixed(2) + ')');
  // fill hand bag to cap, then block
  for (const it of tr.slice(1, 6)) { at(it.ax); await sleep(80); T.interact({ id: 'item:' + it.id }, S); await free(); }
  ok(S.carry.trash === T.CFG.handCap, 'bag capacity ' + T.CFG.handCap + ' reached');
  const blocked = tr[6]; at(blocked.ax); await sleep(80); T.interact({ id: 'item:' + blocked.id }, S); await free();
  ok(!blocked.taken && S.carry.trash === T.CFG.handCap, 'pickup refused at full bag');
  ok(/полон/i.test(T.prompt({ id: 'item:' + blocked.id }, S)), 'prompt explains full bag');
  rec();
  /* bagStand dump */
  const sc1 = T.progress(S).score; at(B.abs('hall', 465)); await sleep(80);
  T.interact(hs('bagStand'), S); await free();
  ok(S.carry.trash === 0 && S.bag.n === 5 && S.f.bagFill > 0, 'bagStand takes the carried trash (bag.n=' + S.bag.n + ', bagFill=' + S.f.bagFill + ')');
  ok(T.progress(S).score > sc1, 'progress rises after dumping'); rec();
  await sleep(150);
  ok(P.held === null, 'hands empty after dump (held=' + P.held + ')');
  // fill the stand until full
  let guard = 0; const rest = tr.filter(i => !i.taken);
  for (const it of rest) {
    if (S.bag.n >= S.bag.cap) break;
    at(it.ax); await sleep(60); T.interact({ id: 'item:' + it.id }, S); await free();
    if (S.carry.trash >= T.CFG.handCap || it === rest[rest.length - 1] || S.bag.n + S.carry.trash >= S.bag.cap) { at(B.abs('hall', 465)); await sleep(60); T.interact(hs('bagStand'), S); await free(); }
    if (++guard > 40) break;
  }
  ok(S.bag.n === S.bag.cap && S.f.bagFill === 5, 'stand bag full (n=' + S.bag.n + ', bagFill=' + S.f.bagFill + ')');
  ok(/полный мешок/i.test(T.prompt(hs('bagStand'), S)), 'stand offers to take the full bag');
  T.interact(hs('bagStand'), S); await free();
  ok(S.carry.haul === S.bag.cap || S.carry.haul > 0, 'full bag hauled (haul=' + S.carry.haul + ')');
  ok(S.bag.n === 0 && S.f.bagFill === 0, 'stand reset after haul');
  await until(() => S.slow <= 0.8, 2500);
  ok(S.slow <= 0.8, 'hauling slows hero (slow=' + S.slow.toFixed(2) + ')');
  ok(/мешок/i.test(T.prompt(hs('bin'), S)), 'bin prompt for hauled bag');
  const before = T.progress(S).score; at(B.abs('kitchen', 520)); await sleep(80); T.interact(hs('bin'), S); await free();
  ok(S.carry.haul === 0 && S.bin.n > 0 && S.f.binFill > 0, 'bin takes hauled bag (bin.n=' + S.bin.n + ', binFill=' + S.f.binFill + ')');
  ok(T.progress(S).score > before, 'progress rises after bin'); rec();
  ok(Math.abs(S.items.filter(i => i.kind === 'trash' && i.taken).length - (S.carry.trash + S.carry.haul + S.bag.n + S.bin.n)) === 0, 'trash conservation holds');

  /* 4. tools */
  S = fresh();
  at(B.abs('hall', 545)); await sleep(80); T.interact(hs('closet'), S); await free(); await sleep(100);
  ok(S.tools.vac === 1 && S.f.closetOpen === 1 && S.active === 'vac', 'closet gives vacuum, closetOpen=1');
  ok(T.prompt(hs('closet'), S) === null, 'closet unavailable after taking');
  at(B.abs('bath', 150)); await sleep(80); T.interact(hs('mopStand'), S); await free(); await sleep(100);
  ok(S.tools.mop === 1, 'mop taken');
  at(B.abs('work', 405)); await sleep(80); T.interact(hs('toolbox'), S); await free(); await sleep(100);
  ok(S.tools.box === 1, 'toolbox taken');

  // minigames have their own real-input suite (tools/test_mini.js); here the opened run is won programmatically
  const autoWin = setInterval(() => { const R = B.mini && B.mini._R; if (R && !R.won) { R.won = true; try { R.close('win'); } catch (e) { } } }, 250);
  /* 5. vacuum (hold F) */
  S.active = 'hand';
  const d0 = S.dust[0]; at(d0.ax); await sleep(100);
  B.In.keys.KeyF = true; await sleep(200);
  ok(B.overrideAnim && B.overrideAnim() === 'vac', 'vac animation override active');
  ok(P.st === 'vac', 'hero state is vac (' + P.st + ')');
  ok(S.f.vacOn === 1, 'vacOn flag set');
  const pStill = d0.p;
  await sleep(800);
  ok(d0.p > 0.3, 'standing still does not clean the whole patch (p=' + d0.p.toFixed(2) + ')');
  // sweep
  let prev = d0.p, mono = true;
  for (let k = 0; k < 3 && d0.p > 0; k++) for (let x = d0.ax - d0.w / 2; x <= d0.ax + d0.w / 2; x += 8) { at(x); await sleep(70); if (d0.p > prev + 1e-9) mono = false; prev = d0.p; if (d0.p <= 0) break; }
  ok(d0.p === 0, 'dust patch fully cleaned by sweeping');
  ok(mono, 'dust progress monotonic');
  ok(S.f.vacN === 1, 'vacN counted (' + S.f.vacN + ')');
  await sleep(300); const keep = d0.p; await sleep(500); ok(d0.p === keep && keep === 0, 'no farming: cleaned patch stays clean');
  B.In.keys.KeyF = false; await sleep(200);
  ok(!B.overrideAnim || B.overrideAnim() !== 'vac', 'override released');
  // clean two more -> snag
  for (const d of S.dust.slice(1, 3)) { at(d.ax); B.In.keys.KeyF = true; for (let k = 0; k < 4 && d.p > 0; k++) for (let x = d.ax - d.w / 2; x <= d.ax + d.w / 2; x += 8) { at(x); await sleep(65); if (d.p <= 0) break; } B.In.keys.KeyF = false; await sleep(120); }
  ok(S.f.vacN >= 3 && S.f.vacJam === 1, 'cord snag after 3 patches (vacN=' + S.f.vacN + ', jam=' + S.f.vacJam + ')');
  await sleep(2500); await free();
  if (S.f.vacJam) { // no minigame module: use the E-fallback
    ok(/носок/.test(T.prompt(hs('vacJam'), S) || ''), 'jam prompt');
    const d3 = S.dust.find(d => d.p > 0); at(d3.ax); B.In.keys.KeyF = true; const before3 = d3.p; await sleep(400); B.In.keys.KeyF = false;
    ok(d3.p === before3, 'cannot vacuum while jammed');
    T.interact(hs('vacJam'), S); await until(() => !S.f.vacJam, 8000);
  }
  ok(S.f.vacJam === 0 && S.f.vacJamN >= 1, 'jam cleared');
  rec();

  /* 6. mop */
  const s0 = S.stains.find(s => !s.leak); at(s0.ax); await sleep(100); B.In.keys.KeyF = true;
  for (let k = 0; k < 4 && s0.p > 0; k++) for (let x = s0.ax - s0.w / 2; x <= s0.ax + s0.w / 2; x += 8) { at(x); await sleep(70); if (s0.p <= 0) break; }
  ok(P.st === 'mop' || s0.p === 0, 'mop animation / completion');
  B.In.keys.KeyF = false; await sleep(150);
  ok(s0.p === 0 && s0.wet > 0, 'stain mopped, wet shine set (wet=' + s0.wet.toFixed(2) + ')');
  B.In.keys.KeyF = true; await sleep(500); B.In.keys.KeyF = false; ok(s0.p === 0, 'mopped stain stays clean');
  rec();
  // no tool feedback: take away tools temporarily
  const sv = S.tools.mop; S.tools.mop = 0; const s1 = S.stains.find(s => !s.leak && s.p > 0); at(s1.ax); await sleep(100); B.In.keys.KeyF = true; await sleep(400); B.In.keys.KeyF = false; ok(s1.p === 1, 'no mop -> no cleaning'); S.tools.mop = sv;

  /* 7. leak */
  S = fresh(); const lp = S.stains.find(s => s.leak); const w0 = lp.w; S.leak.t = S.leak.every - 0.2; await sleep(1500);
  ok(lp.w > w0, 'leak puddle grows while faucet is broken (' + w0 + ' -> ' + lp.w.toFixed(1) + ')');
  ok(S.stains.filter(s => s.leak).length === 2 && S.leak.spawned === 2, 'new puddle spawned');
  for (let i = 0; i < 6; i++) { S.leak.t = S.leak.every + 1; await sleep(120); }
  ok(S.stains.filter(s => s.leak).length === S.leak.max, 'leak puddle count limited to ' + S.leak.max);
  S.f.faucetFixed = 1; const wf = lp.w; await sleep(500); ok(lp.w === wf, 'growth stops once faucet fixed');

  /* 8. boxes, procrastination, washer, stations */
  S = fresh(); at(B.abs('hall', 385)); await sleep(80);
  const tm = S.time; T.interact(hs('boxes'), S); await free(); await sleep(60);
  ok(S.f.boxesCleared === 1 && S.time < tm, 'boxes cleared with time cost (' + (tm - S.time).toFixed(1) + 's)');
  ok(T.prompt(hs('boxes'), S) === null, 'boxes prompt gone');
  const tm2 = S.time, lz = S.lazy; at(B.abs('living', 195)); await sleep(80); T.interact(hs('sofa'), S); await free(); await sleep(60);
  ok(S.lazy === lz + 1 && S.time < tm2, 'sofa: lazy++ and time lost');
  T.interact(hs('tv'), S); await free(); await sleep(60); ok(S.f.tvOn === 1, 'tv toggles on'); T.interact(hs('tv'), S); await free(); await sleep(60); ok(S.f.tvOn === 0, 'tv toggles off');
  T.interact(hs('pc'), S); await free(); await sleep(60); ok(S.lazy === lz + 3, 'pc counts as procrastination');
  // washer
  const c1 = S.items.find(i => i.kind === 'cloth'); at(c1.ax); await sleep(80); T.interact({ id: 'item:' + c1.id }, S); await free();
  await until(() => P.held === 'clothes', 2500);
  ok(S.carry.cloth === 1 && P.held === 'clothes', 'cloth picked, held=clothes (' + P.held + ')');
  at(B.abs('bath', 65)); await sleep(80); T.interact(hs('washer'), S); await free(); await sleep(60);
  ok(S.wash.n === 1 && S.carry.cloth === 0 && S.f.washerOn === 1, 'washer takes clothes and shakes');
  const clothP = T.progress(S).parts.find(p => p.id === 'clothes'); ok(clothP.p > 0, 'clothes part rises');
  // stations: missing toolbox
  const fl0 = JSON.stringify(S.f); at(B.abs('bath', 250)); await sleep(80); T.interact(hs('faucet'), S); await sleep(300); await free();
  ok(S.f.faucetFixed === 0 && S.active !== 'box', 'faucet refuses without toolbox');
  S.tools.box = 1;
  for (const [id, rel, room, flag] of [['faucet', 250, 'bath'], ['toilet', 505, 'bath'], ['printer', 245, 'work'], ['fridge', 65, 'kitchen'], ['dishes', 250, 'kitchen']]) {
    at(B.abs(room, rel)); await sleep(80); T.interact(hs(id), S); await until(() => !P.act && !P.walkTo, 500); await sleep(100);
    await until(() => ({ faucet: S.f.faucetFixed, toilet: S.f.flushFixed, printer: S.f.printerFixed, fridge: S.f.fridgeDone, dishes: S.f.dishesDone })[id], 15000, 80);
    ok(!!({ faucet: S.f.faucetFixed, toilet: S.f.flushFixed, printer: S.f.printerFixed, fridge: S.f.fridgeDone, dishes: S.f.dishesDone })[id], id + ' task completes (mini or fallback)'); rec();
  }
  ok(S.f.faucetHowl === 0 && S.f.printerError === 0 && S.f.toiletClean === 1 && S.f.fridgeOpen === 0, 'world flags updated consistently');
  ok(/зеркало/i.test(T.prompt(hs('faucet'), S) || ''), 'faucet hotspot chains to mirror');
  at(B.abs('bath', 250)); await sleep(80); T.interact(hs('faucet'), S); await until(() => S.f.mirrorDone, 15000, 80); ok(S.f.mirrorDone === 1, 'mirror cleaned'); rec();

  /* 9. full playthrough -> 100 and monotonic */
  S = fresh(); S.tools.vac = S.tools.mop = S.tools.box = 1; scores.length = 0; rec();
  const all = S.items.slice();
  for (const it of all) { it.taken = 1; if (it.kind === 'trash') S.bin.n++; else S.wash.n++; } rec();
  for (const o of S.stains.concat(S.dust)) { o.p = 0; o.seg.fill(1); } rec();
  Object.assign(S.f, { boxesCleared: 1, dishesDone: 1, fridgeDone: 1, faucetFixed: 1, toiletClean: 1, flushFixed: 1, printerFixed: 1, mirrorDone: 1 });
  T.repair(S); S.done = {}; let ev = []; const h1 = d => ev.push(d.id); B.on('task:done', h1); T.check(S); B.off('task:done', h1);
  ok(T.progress(S).score === 100 && T.progress(S).done === 11, 'all tasks done -> score 100');
  ok(ev.includes('all') && ev.length === 12, 'task:done emitted once per task + all (' + ev.length + ')');
  rec(); ok(scores.every((v, i) => i === 0 || v >= scores[i - 1]), 'scores monotonic: ' + scores.join(','));

  /* 10. save / restore */
  S = fresh(); S.items[0].taken = 1; S.bin.n = 1; S.f.faucetFixed = 1; S.stains[0].p = 0.3; S.stains[0].seg.fill(0.7); S.time = 123; S.calls.x = 1;
  const js = JSON.stringify(T.serialize(S)); const R = T.restore(JSON.parse(js));
  ok(R.time === 123 && R.items[0].taken === 1 && R.bin.n === 1 && R.f.faucetFixed === 1 && R.calls.x === 1, 'serialize -> restore roundtrip');
  ok(R.f.faucetHowl === 0, 'restore repairs faucetHowl vs faucetFixed');
  const bad = T.serialize(S); bad.carry.trash = 99; bad.bag.n = -4; bad.f.fridgeDone = 1; bad.f.fridgeOpen = 1; bad.items[5].taken = 1; bad.wash.n = 40; bad.stains[1].p = 7; bad.tools.vac = 1; bad.f.closetOpen = 0; bad.time = NaN;
  const R2 = T.restore(bad);
  ok(R2.carry.trash <= 5 && R2.bag.n >= 0 && R2.f.fridgeOpen === 0 && R2.wash.n <= R2.count.cloth && R2.f.closetOpen === 1 && isFinite(R2.time), 'restore repairs contradictory/corrupt state');
  const takenT = R2.items.filter(i => i.kind === 'trash' && i.taken).length;
  ok(takenT === R2.carry.trash + R2.carry.haul + R2.bag.n + R2.bin.n, 'restore keeps trash conserved');
  ok(T.restore(null) && T.restore({}).items.length === S.items.length, 'restore tolerates empty input');

  /* 11. spam / nothing here */
  S = fresh(); at(B.abs('hall', 110)); await sleep(60); let thrown = null; try { for (let i = 0; i < 20; i++) { T.nothingHere(); T.interact(hs('bin'), S); T.interact(hs('closet'), S); } } catch (e) { thrown = e; }
  await free(); ok(!thrown, 'spam does not throw'); ok(S.tools.vac === 1, 'spam closet gives tool exactly once');
  clearInterval(autoWin);
  return { pass, fail: fails.length, fails, log };
};
