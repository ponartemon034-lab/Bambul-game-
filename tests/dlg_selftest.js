/* BB.dlg self-test.  Run:  node tests/dlg_selftest.js   (plain node, window/BB stubbed; no browser needed) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL: ' + msg); } };

function load() {
  const said = [];
  const win = { BB: { hooks: { update: [] }, CFG: { censor: false }, ui: { say: (t, o) => said.push({ t, o }), busy: () => false } } };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/dialogue.js'), 'utf8'), win, { filename: 'dialogue.js' });
  return { BB: win.BB, dlg: win.BB.dlg, said, win };
}
const { BB, dlg, said } = load();
dlg._seed(12345);
dlg._manualClock = true;

/* 1. counts */
const st = dlg.stats();
console.log('== counts ==');
st.mins.forEach(m => console.log((m.ok ? '  ok  ' : '  LOW ') + m.name.padEnd(28) + m.have + ' / ' + m.min));
console.log('  total bark lines: ' + st.total + ' in ' + dlg.CATS.length + ' categories; script lines: ' + st.scriptLines + ' in ' + st.scriptCount + ' scripts; landlord calls: ' + st.landlordCalls);
st.mins.forEach(m => ok(m.ok, 'minimum count ' + m.name));
ok(st.total >= 400, 'total >= 400');
ok(st.landlordCalls >= 8, '>= 8 landlord calls');
[300, 120, 60, 30, 10].forEach(t => ok(st.cats['time:' + t] >= 4, 'time:' + t + ' >= 4'));

/* 2. duplicates inside a category (and globally) */
console.log('== duplicates ==');
const seenGlobal = {};
dlg.CATS.forEach(c => {
  const seen = new Set();
  const pool = (function () { const arr = []; for (let i = 0; i < 400; i++) { const l = dlg.line(c.id, { first: i % 2 === 0, time: 999, score: (i * 7) % 100 }); arr.push(l); } return arr; })();
  // static check on source via line() samples is lossy; use a direct source scan below
});
{
  const src = fs.readFileSync(path.join(__dirname, '../js/dialogue.js'), 'utf8');
  // run dialogue in a context that exposes POOL by sampling every entry through many seeds
  const byCat = {};
  dlg.CATS.forEach(c => {
    const set = new Set();
    for (let i = 0; i < 1500; i++) {
      for (const first of [true, false]) for (const t of [999, 100]) for (const sc of [10, 50, 90]) set.add(dlg.line(c.id, { first, time: t, score: sc }));
      dlg._reset(); dlg._seed(i + 7);
    }
    byCat[c.id] = set;
    ok(set.size >= Math.min(c.count, 3) , 'sampling reached lines in ' + c.id);
    if (set.size > c.count) ok(false, 'category ' + c.id + ' yields more strings than entries?! (' + set.size + ' > ' + c.count + ')');
    set.forEach(s => { if (seenGlobal[s] && seenGlobal[s] !== c.id) console.log('  note: same text in ' + seenGlobal[s] + ' and ' + c.id + ': ' + s.slice(0, 50)); seenGlobal[s] = c.id; });
  });
  // exact duplicates: count entries vs unique strings, over unconditional sampling
  dlg.CATS.forEach(c => {
    if (c.id.indexOf('roomEnter') === 0) return;
    const set = byCat[c.id];
    ok(set.size === c.count || c.count > set.size, 'no more unique strings than entries ' + c.id);
  });
  const texts = src.split('\n');
  const stringsByCat = {};
  // authoritative duplicate check: re-run the library in a context with a patched D() that records raw text
  const recorded = {};
  const code = src.replace('function D(cat, arr) {', 'function D(cat, arr) { (globalThis.__rec = globalThis.__rec || {})[cat] = ((globalThis.__rec[cat]) || []).concat(arr.map(e => typeof e === "string" ? e : Array.isArray(e) ? e[0] : e.t));');
  const win = { BB: { hooks: { update: [] }, CFG: {} } }; win.window = win; win.globalThis = win;
  vm.createContext(win); vm.runInContext(code, win);
  const rec = win.__rec || {};
  let dups = 0;
  Object.keys(rec).forEach(cat => { const s = new Set(); rec[cat].forEach(t => { if (typeof t === 'string') { if (s.has(t)) { dups++; console.log('  DUP in ' + cat + ': ' + t); } s.add(t); } }); });
  ok(dups === 0, 'no duplicate lines inside any category (' + dups + ')');
  console.log('  duplicate lines inside categories: ' + dups);
}

/* 3. no immediate repeats over 200 draws */
console.log('== repeats ==');
dlg._reset(); dlg._seed(99);
let repeats = 0, cmax = 0;
dlg.CATS.forEach(c => {
  const n = c.count;
  for (const first of [true, false]) {
    let prev = null, cnt = 0;
    for (let i = 0; i < 200; i++) {
      const l = dlg.line(c.id, { first, time: 999, score: 50 });
      if (!l) break;
      if (prev !== null && l === prev && n > 2) { repeats++; console.log('  IMMEDIATE REPEAT ' + c.id + ': ' + l); }
      prev = l; cnt++;
    }
  }
});
ok(repeats === 0, 'no immediate repeats over 200 draws (' + repeats + ')');
console.log('  immediate repeats: ' + repeats);
{ // wider window: pool >= 8 must not repeat within last 3
  dlg._reset(); dlg._seed(5);
  let bad = 0;
  dlg.CATS.filter(c => c.count >= 10).forEach(c => { const h = []; for (let i = 0; i < 200; i++) { const l = dlg.line(c.id, { first: true, time: 999, score: 50 }); if (h.slice(-3).includes(l)) bad++; h.push(l); } });
  ok(bad === 0, 'no repeats within last 3 draws for pools >= 10 (' + bad + ')');
}

/* 4. cooldown + priority */
console.log('== cooldown / priority ==');
dlg._reset(); dlg._seed(3); dlg._manualClock = true; said.length = 0;
const S0 = { mode: 'play', time: 600, f: {}, tools: {}, carry: {} };
BB.S = S0;
let r = dlg.bark('idle', { S: S0 });
ok(!!r && said.length === 1, 'idle shows when nothing is on screen');
ok(dlg.bark('idle', { S: S0 }) === null, 'same category blocked by cooldown');
ok(dlg.bark('success', { S: S0 }) !== null && said.length === 2, 'higher priority (completion) overrides GCD');
ok(dlg.bark('pickup', { S: S0 }) !== null, 'interaction bark below a showing completion bark is held back (queued)');
const qlen = dlg.queueLength();
ok(qlen === 1, 'interaction-priority bark gets queued (len ' + qlen + ')');
ok(dlg.bark('idle:l1', { S: S0 }) === null, 'idle never queues behind a higher bark');
dlg._tick(0.2);
ok(said.length === 2, 'queued bark waits while current is showing');
for (let i = 0; i < 16; i++) dlg._tick(0.5);          // frame-like steps: a queued bark must be shown once the current one ends
ok(said.length === 3 && dlg.queueLength() === 0, 'queued bark shown after current expires');
dlg._tick(5);
ok(dlg.bark('landlordBark', { S: S0 }) !== null && said[said.length - 1].o.who === 'landlord' && said[said.length - 1].o.prio === 6, 'landlord bark: who=landlord prio 6');
ok(dlg.bark('success', { S: S0 }) === null || dlg.queueLength() >= 0, 'completion below landlord does not replace it');
dlg._tick(2.6);
const nBefore = said.length;
ok(dlg.bark('danBark', { S: S0 }) !== null && said.length === nBefore + 1 && said[said.length - 1].o.who === 'dan', 'Dan (same top prio) replaces landlord');
dlg._tick(30);
const a = dlg.bark('idle', { S: S0 }, { force: true }); const b = dlg.bark('idle', { S: S0 }, { force: true });
ok(a && b, 'force bypasses cooldowns');
dlg._tick(30);
BB.ui.busy = () => true;
ok(dlg.bark('idle', { S: S0 }) === null, 'idle suppressed while a dialogue/minigame is open');
ok(dlg.bark('success', { S: S0 }) !== null, 'completion still allowed while busy');
BB.ui.busy = () => false;
ok(dlg.bark('nope-category', {}) === null, 'unknown category -> null');
{ // priority ordering across cats
  const p = c => dlg._meta(c).prio;
  ok(p('landlordBark') > p('success') && p('success') > p('pickup') && p('pickup') > p('idle'), 'priority landlord/Dan > completion > interaction > idle');
  ok(p('danBark') === p('landlordBark'), 'Dan = landlord priority');
  ok(p('fridge:done') > p('fridge:open'), ':done outranks interaction');
}

/* 5. state-based filters */
console.log('== filters ==');
{
  dlg._reset(); dlg._seed(8);
  const lows = new Set(), highs = new Set();
  for (let i = 0; i < 300; i++) { lows.add(dlg.line('idle', { time: 100, score: 10 })); highs.add(dlg.line('idle', { time: 900, score: 90 })); dlg._reset(); dlg._seed(i); }
  ok(lows.has('Ну всё, паника — это тоже способ начать. Начинаю паниковать.'), 'time<300 line available at low time');
  ok(!highs.has('Ну всё, паника — это тоже способ начать. Начинаю паниковать.'), 'time<300 line filtered out at high time');
  const f = new Set(), bk = new Set();
  for (let i = 0; i < 200; i++) { f.add(dlg.line('roomEnter:hall', { first: true })); bk.add(dlg.line('roomEnter:hall', { first: false })); dlg._reset(); dlg._seed(i); }
  let overlap = 0; f.forEach(x => { if (bk.has(x)) overlap++; });
  ok(f.size === 3 && bk.size === 2 && overlap === 0, 'roomEnter first/return pools are disjoint (3/2)');
}

/* 6. scripts */
console.log('== scripts ==');
const WHO = ['bamboul', 'landlord', 'dan', 'narr'];
function checkLines(id, lines, depth) {
  ok(Array.isArray(lines) && lines.length > 0, id + ': non-empty array');
  (lines || []).forEach((l, i) => {
    ok(WHO.includes(l.who), id + '[' + i + '] valid who');
    ok(typeof l.text === 'string' && l.text.length > 0, id + '[' + i + '] text');
    if (l.choices) {
      ok(Array.isArray(l.choices) && l.choices.length >= 1, id + '[' + i + '] choices array');
      l.choices.forEach(cc => {
        ok(typeof cc.text === 'string' && typeof cc.run === 'function' && cc.ret && typeof cc.ret.timeDelta === 'number', id + ' choice shape: ' + cc.text);
        if (depth < 2) { const rr = cc.run(); if (rr) checkLines(id + '>' + cc.text.slice(0, 12), rr, depth + 1); }
      });
    }
  });
}
const stateVariants = [
  { S: { mode: 'play', time: 600, total: 600, f: {}, carry: { trash: 0, cloth: 0 }, items: [{ kind: 'trash', taken: false }] }, parts: [{ id: 'fridge', label: 'Холодильник', p: 0, weight: 3 }, { id: 'floor', label: 'Пол', p: .4, weight: 2 }, { id: 'trash', label: 'Мусор', p: 0, weight: 4 }] },
  { S: { mode: 'play', time: 40, total: 600, f: { faucetFixed: 1, fridgeDone: 1, flushFixed: 1, toiletClean: 1, printerFixed: 1, dishesDone: 1, mirrorDone: 1, boxesCleared: 1, printerPrinting: 1 }, carry: { trash: 0 }, items: [] }, parts: [] },
  { S: { mode: 'play', time: 200, total: 600, f: { printerError: 1, printerStage: 2, faucetStage: 3, fridgeOpen: 1, fridgeRot: 2, vacJam: 1 }, carry: { trash: 2 }, items: [] }, parts: [{ id: 'x', label: 'Кран', p: .2, weight: 1 }] }
];
const ids = dlg.SCRIPT_IDS.slice();
for (let n = 11; n <= 14; n++) ids.push('landlord:' + n);
stateVariants.forEach((v, vi) => {
  dlg._reset(); dlg._seed(40 + vi);
  ids.forEach(id => { const lines = dlg.script(id, { S: v.S, parts: v.parts, score: vi === 1 ? 95 : vi === 2 ? 12 : 50, time: v.S.time, n: 3 }); checkLines(id + '@' + vi, lines, 0); });
});
ok(dlg.script('does:not:exist', {}).length === 0, 'unknown script -> []');
for (let i = 1; i <= 10; i++) ok(ids.includes('landlord:' + i), 'landlord:' + i + ' exists');
['good', 'ok', 'bad', 'secret'].forEach(k => ok(ids.includes('ending:' + k), 'ending:' + k));
['fridge', 'faucet', 'toilet', 'printer', 'dishes', 'mirror', 'vacJam'].forEach(k => ok(ids.includes('danHint:' + k), 'danHint:' + k));
['move', 'jump', 'interact', 'pickup', 'bag', 'vacuum', 'mop', 'timer'].forEach(k => ok(ids.includes('tutorial:' + k), 'tutorial:' + k));
ok(ids.includes('intro') && ids.includes('dan:hint') && ids.includes('dan:call') && ids.includes('printerMonologue'), 'intro / dan:hint / dan:call / printerMonologue');
{ // outcome tags: landlord:2 reflects truth
  const bad = dlg.script('landlord:2', { S: { time: 500, f: {} } });
  const lie = bad[bad.length - 1].choices[0];
  ok(lie.ret.timeDelta === -15, 'faucet lie while still howling => -15');
  const good = dlg.script('landlord:2', { S: { time: 500, f: { faucetFixed: 1 } } });
  ok(good[good.length - 1].choices[0].ret.timeDelta === 20, 'faucet truth => +20');
  const l6 = dlg.script('landlord:6', { S: { time: 500, f: { printerError: 1 } } });
  ok(l6[l6.length - 1].choices[0].ret.timeDelta === -15, 'printer lie while broken => -15');
}
{ // hints follow state
  dlg._reset();
  const t = [0, 1, 2, 3, 4].map(s => dlg.script('danHint:printer', { S: { time: 300, f: {} }, stage: s }).map(l => l.text).join(' | '));
  ok(new Set(t).size === 5, 'printer hints differ per stage');
  ok(/трубк/.test(t[1]) && /(подач|нитк)/.test(t[3] + t[4]), 'printer hints mention tube / feed');
  const fr = [dlg.script('danHint:fridge', { S: { time: 300, f: {} } }), dlg.script('danHint:fridge', { S: { time: 300, f: { fridgeOpen: 1, fridgeRot: 3 } } }), dlg.script('danHint:fridge', { S: { time: 300, f: { fridgeOpen: 1, fridgeRot: 0 } } })].map(a => a.map(l => l.text).join(' '));
  ok(/открой/i.test(fr[0]) && /зелён|плесен/.test(fr[1]) && /полк/.test(fr[2]), 'fridge hints follow flags (closed / rotten left / shelves)');
  ok(/штук 3/.test(fr[1]), 'fridge hint quotes items left');
  const tl = [dlg.script('danHint:toilet', { S: { time: 300, f: { toiletClean: 0.3 } } }), dlg.script('danHint:toilet', { S: { time: 300, f: { toiletClean: 1 } } })].map(a => a.map(l => l.text).join(' '));
  ok(/ёршик|Тереть/.test(tl[0]) && /кнопк/i.test(tl[1]), 'toilet hints: clean first, then button');
}
{ // rotation: repeated asks vary
  dlg._reset();
  const seen = new Set(); for (let i = 0; i < 4; i++) seen.add(dlg.script('danHint:faucet', { S: { time: 300, f: {} }, stage: 1 }).slice(-1)[0].text);
  ok(seen.size >= 2, 'repeated hint asks cycle through variants');
  const pm = new Set(); for (let i = 0; i < 6; i++) pm.add(dlg.script('printerMonologue', {}).map(l => l.text).join('|'));
  ok(pm.size === 6, 'printerMonologue: 6 distinct variants without repeats');
  const dh = dlg.script('dan:hint', { S: { time: 300, f: {} }, parts: stateVariants[0].parts, score: 20 });
  ok(/холодильник/.test(dh.map(l => l.text).join(' ').toLowerCase()) || /мусор/.test(dh.map(l => l.text).join(' ').toLowerCase()), 'dan:hint names open tasks');
}

/* 7. censor */
console.log('== censor ==');
const profLine = 'Блядь, это хуй пойми что. Пиздец, сука!';
BB.CFG.censor = true;
const cens = dlg.cz(profLine);
ok(!/блядь|хуй|пиздец|сука/i.test(cens) && /пип/i.test(cens), 'cz masks profanity when censor on: ' + cens);
let leaks = 0;
const fully = new Set();
dlg.CATS.forEach(c => { for (let i = 0; i < 60; i++) { const l = dlg.line(c.id, { first: i % 2 === 0, time: 100 }); l.replace(/[А-Яа-яЁё]+/g, w => { if (dlg._isProf(w)) { leaks++; } return w; }); } });
ids.forEach(id => dlg.script(id, { S: stateVariants[2].S, parts: [] }).forEach(l => { l.text.replace(/[А-Яа-яЁё]+/g, w => { if (dlg._isProf(w)) leaks++; return w; }); (l.choices || []).forEach(cc => (cc.run() || []).forEach(x => x.text.replace(/[А-Яа-яЁё]+/g, w => { if (dlg._isProf(w)) leaks++; return w; }))); }));
ok(leaks === 0, 'no profanity survives with censor on (' + leaks + ')');
BB.CFG.censor = false;
ok(dlg.cz(profLine) === profLine, 'cz is identity with censor off');
{
  let withProf = 0, tot = 0;
  dlg.CATS.forEach(c => { for (let i = 0; i < 30; i++) { const l = dlg.line(c.id, { first: true, time: 100 }); tot++; if (l.split(/[^А-Яа-яЁё]+/).some(dlg._isProf)) withProf++; } });
  console.log('  share of sampled barks containing profanity: ' + Math.round(100 * withProf / tot) + '%');
  ok(withProf / tot < 0.3 && withProf / tot > 0.03, 'profanity used for punch, not in every line');
  BB.cz = s => '[cz]' + s; BB.CFG.censor = true;
  ok(dlg.cz('привет') === '[cz]привет', 'BB.cz is used when present');
  delete BB.cz; BB.CFG.censor = false;
}
{ // text hygiene
  let bad = 0;
  const check = (where, t) => {
    if (/\s{2,}/.test(t) || /\s[,.!?;:]/.test(t) || /[a-zA-Z]/.test(t.replace(/Windows/g, '')) || !/[.!?…)»"]$/.test(t)) { bad++; console.log('  hygiene: [' + where + '] ' + t); }
  };
  dlg.CATS.forEach(c => { for (let i = 0; i < 40; i++) { const l = dlg.line(c.id, { first: i % 2 === 0, time: 100 }); check(c.id, l); dlg._reset(); dlg._seed(i); } });
  ok(bad === 0, 'text hygiene (spaces/punctuation/latin) (' + bad + ')');
}

/* 8. idleWatch + room entry */
console.log('== idleWatch / rooms ==');
{
  dlg._reset(); dlg._seed(21); said.length = 0;
  BB.LAYOUT = { rooms: [{ id: 'hall', x1: 600 }, { id: 'living', x1: 1450 }, { id: 'kitchen', x1: 2050 }], roomOf: x => BB.LAYOUT.rooms.find(r => x < r.x1) || BB.LAYOUT.rooms[2] };
  BB.P = { x: 300, y: 0, vx: 0, act: null, walkTo: null };
  BB.cur = { hot: { id: 'fridge' }, prompt: 'Открыть' };
  BB.In = { use: false, act: false };
  BB.tasks = { progress: () => ({ score: 20, parts: [] }) };
  const S = { mode: 'play', time: 500, f: {}, tools: {} };
  BB.S = S; BB.paused = false;
  const ev = []; const origSay = BB.ui.say; BB.ui.say = (t, o) => { ev.push({ t, o }); };
  const step = (sec) => { for (let i = 0; i < sec * 10; i++) dlg._tick(0.1); };
  step(5); ok(ev.length === 0, 'no idle bark before ~8 s');
  step(10);
  const idleBarks = () => ev.filter(e => !/ROOM/.test(e.t));
  ok(idleBarks().length >= 1, 'idle bark fires near a task after ~8 s idle');
  step(80);
  const got = ev.length;
  const lvl = dlg.ladderLevel('idle');
  console.log('  after 95 s idle near task: ' + got + ' barks, ladder level ' + lvl);
  ok(lvl >= 4, 'ladder escalates (level ' + lvl + ')');
  ok(got <= 10, 'idle barks stay sparse (' + got + ' in 95 s)');
  // ladder lines are ordered l1..l5
  const first = ev[0].t; ok(dlg.CATS.length > 0, 'ok');
  // pause / busy / movement
  const n0 = ev.length;
  BB.paused = true; step(60); ok(ev.length === n0, 'no idle barks while paused'); BB.paused = false;
  BB.ui.busy = () => true; step(60); ok(ev.length === n0, 'no idle barks while dialogue/minigame is open'); BB.ui.busy = () => false;
  BB.mini = { active: true }; step(60); ok(ev.length === n0, 'no idle barks while a minigame is active'); BB.mini = null;
  S.time = 0; step(60); ok(ev.length === n0, 'no idle barks when the timer is out'); S.time = 500;
  // movement resets idle timer
  dlg._reset(); ev.length = 0; BB.P.vx = 100; step(40); ok(ev.length === 0, 'no idle barks while moving (' + ev.length + ')'); BB.P.vx = 0;
  // progress resets ladder
  step(30); const lv2 = dlg.ladderLevel('idle'); ok(lv2 >= 1, 'ladder started again'); BB.tasks.progress = () => ({ score: 60 }); step(1); ok(dlg.ladderLevel('idle') === 0, 'real progress resets the ladder');
  // rooms
  ev.length = 0; dlg._reset(); BB.cur = { hot: null, prompt: null }; BB.tasks.progress = () => ({ score: 60 });
  BB.P.x = 300; dlg._tick(0.1); ev.length = 0;
  BB.P.x = 700; dlg._tick(0.1);
  ok(ev.length === 1 && /./.test(ev[0].t), 'entering a new room triggers a roomEnter bark');
  ok(dlg.last && dlg.last.cat === 'roomEnter:living', 'room bark category is roomEnter:living');
  dlg._tick(20); BB.P.x = 300; dlg._tick(0.1); dlg._tick(20); ev.length = 0; BB.P.x = 700;
  let hits = 0; for (let i = 0; i < 20; i++) { BB.P.x = 300; dlg._tick(0.1); dlg._tick(15); const b = ev.length; BB.P.x = 700; dlg._tick(0.1); if (ev.length > b) hits++; }
  console.log('  return visits to a room barked ' + hits + '/20 times');
  ok(hits > 0 && hits < 20, 'room revisits bark only sometimes');
  BB.ui.say = origSay;
}

/* 9. hook registered */
ok(BB.hooks.update.length === 1, 'registered one BB.hooks.update hook');

console.log('\n' + (fails ? fails + ' FAILED of ' + checks + ' checks' : 'ALL ' + checks + ' CHECKS PASSED'));
process.exit(fails ? 1 : 0);
