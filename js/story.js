/* ==========================================================================
   BAMBOUL - story / game flow: run lifecycle, intro + tutorial, countdown,
   landlord & Dan phone calls, time-pressure thresholds, endings, save/load.
   Owner: game-flow programmer.  Rules and tuning are documented in docs/STORY.md.
   Every call into another module goes through ext()/guards, so the module
   works while BB.ui / BB.dlg / BB.tasks / BB.mini / BB.audio / BB.char are
   unfinished (tiny Russian fallbacks are inlined below).
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const KEY = 'bamboul.save';

  /* ------------------------------------------------------------------ config */
  const CFG = {
    totals: [600, 480, 300], defaultTotal: 480,
    thresholds: [300, 120, 60, 30, 10],          // seconds left -> one bark/UI/audio event each
    callAt: { l1: .75, l2: .5, l3: .3, l4: .12 }, // landlord calls: value <=1 = fraction of total LEFT, >1 = seconds left
    danOwnAt: .55,                                // Dan phones once on his own (fraction left)
    callGap: 30,                                  // min game seconds between two incoming calls
    ringTimeout: 12,                              // how long an ordinary call rings
    missPenalty: 8, declinePenalty: 6,            // landlord call ignored / declined (s)
    truthGain: 20, honestGain: 8, lieLoss: 15,    // call choice consequences (s)
    bonusCapFrac: .25,                            // all time gained from calls/Dan <= 25 % of total
    danStall: 40,                                 // Dan stalls the landlord
    danCooldown: 35, statusCooldown: 60,
    dialogRate: .3,                               // clock speed while a dialogue / phone talk is open
    introWake: 2.2,                               // seconds of sleep before the first ring
    lazyCall: 5, lazyEnding: 9,                   // S.lazy needed for the reactive call / the sofa ending
    reactiveMax: 2,
    endTiers: { good: 90, ok: 60 },
    mortgage: { score: 97, timeFrac: .2 },        // hidden ending: score, arrival at least this much of the time early
    autosave: 5,
    tutorial: true
  };

  const CALLS = [   // authored schedule (reactive calls are built on the fly)
    { id: 'intro', who: 'landlord', intro: true },
    { id: 'l1', who: 'landlord', at: 'l1' },
    { id: 'l2', who: 'landlord', at: 'l2' },
    { id: 'l3', who: 'landlord', at: 'l3' },
    { id: 'l4', who: 'landlord', at: 'l4' },
    { id: 'd1', who: 'dan', dan: true }
  ];

  const ENDINGS = {
    good: { id: 'shine', tier: 'good', title: 'Хозяин пришёл — квартира сияет', titleCensored: 'Хозяин пришёл — квартира сияет', blurb: 'Аркадий Семёнович не нашёл, к чему придраться. Аренду не поднимают.' },
    ok: { id: 'ok', tier: 'ok', title: 'Ну… жить можно', titleCensored: 'Ну… жить можно', blurb: 'Хозяин ушёл, ворча. До пятницы доделать то, что не доделано.' },
    bad: { id: 'museum', tier: 'bad', title: 'Блядский музей катастроф', titleCensored: 'Б***ский музей катастроф', blurb: 'Хозяин ушёл за участковым и грузчиками. Диван у Дэна, кажется, занят.' },
    mortgage: { id: 'mortgage', tier: 'mortgage', hidden: true, title: 'Ипотека на квартиру', titleCensored: 'Ипотека на квартиру', blurb: 'Чисто, рано, с братом на подхвате. Хозяин предложил купить квартиру. В рассрочку. На шаурму.' },
    sofa: { id: 'sofa', tier: 'sofa', hidden: true, title: 'Диванный стратег', titleCensored: 'Диванный стратег', blurb: 'Бамбуль так и не встал. Хозяин присел рядом. Квартира осталась как есть.' }
  };

  /* ------------------------------------------------------------ run-time (not saved) */
  let gen = 0;                         // bumped on every reset: stale callbacks are ignored
  let R = blankRuntime();
  const errs = [];                     // swallowed errors from foreign modules (visible in tests)
  const logEv = [];                    // story event log (tests / debugging)
  function blankRuntime() {
    return { ring: null, call: null, talk: false, talkT: 0, timers: [], fb: null, callGap: 0, deferT: 0, intro: null, lying: false,
      end: null, pendingEnd: null, doorAsk: false, doorT: 0, saveT: 0, progT: 0, prog: null, tutT: 0, tutShow: {}, tickSec: -1,
      musT: 0, said: [], toasts: [], dialogs: [], hold: 0, passedBoxes: false, lastDelta: null, startX: 0, stuckT: 0, stuckX: 0 };
  }
  function log(n, d) { logEv.push({ n, d, t: BB.S ? +(BB.S.time || 0).toFixed(1) : 0 }); if (logEv.length > 400) logEv.shift(); }

  /* ------------------------------------------------------- safe foreign calls */
  function ext(path, ...a) {
    try {
      const parts = path.split('.'); let o = BB;
      for (let i = 0; i < parts.length - 1; i++) { o = o && o[parts[i]]; if (!o) return { ok: false }; }
      const fn = o[parts[parts.length - 1]];
      if (typeof fn === 'function') return { ok: true, v: fn.apply(o, a) };
    } catch (e) { errs.push(path + ': ' + (e && e.message)); }
    return { ok: false };
  }
  const sfx = (n, o) => ext('audio.sfx', n, o);
  const P = () => BB.P || (BB.player && BB.player.P) || { x: 0, y: 0, dir: 1 };
  const SS = () => BB.S;
  const abs = (id, x) => { try { return BB.abs(id, x); } catch (e) { return x; } };
  const phoneX = () => abs('hall', 255);

  function say(text, o) { if (!ext('ui.say', text, o || {}).ok) { R.said.push(text); if (R.said.length > 60) R.said.shift(); } }
  function toast(text) { if (!ext('ui.toast', text).ok) { R.toasts.push(text); if (R.toasts.length > 60) R.toasts.shift(); } }
  function script(id, ctx, fb) { const r = ext('dlg.script', id, ctx); return (r.ok && Array.isArray(r.v) && r.v.length) ? r.v : fb; }
  function lineOf(cat, ctx, fb) { const r = ext('dlg.line', cat, ctx); return (r.ok && typeof r.v === 'string' && r.v) ? r.v : fb; }
  function bark(cat, ctx, fb, o) { const r = ext('dlg.bark', cat, ctx, o); if (!r.ok && fb) say(fb, { who: 'bamboul', dur: 2.6 }); }
  function after(sec, fn) { R.timers.push({ t: sec, fn, g: gen }); }

  /* ------------------------------------------------------------------ state */
  function freshSt() {
    return { v: 2, introDone: 0, calls: {}, lcount: 0, th: {}, tut: {}, danCd: 0, danOffer: 0, danStall: 0, owes: 0, hints: 0, lies: 0,
      answered: 0, missed: 0, declined: 0, statusCalls: 0, statusCd: 0, bonus: 0, penalty: 0, reactive: 0, startX: 0 };
  }
  function minimalState(total) {
    return { mode: 'menu', total, time: total, lazy: 0, slow: 1,
      f: { lightHall: 0, tvOn: 0, doorOpen: 0, phoneRing: 0, phoneUp: 0, bagFill: 0, binFill: 0, faucetOn: 1, faucetHowl: 1, printerError: 1, fridgeRot: 4 },
      tools: { vac: 0, mop: 0, box: 0 }, active: 'hand', items: [], stains: [], dust: [], carry: { trash: 0, cloth: 0 }, calls: {} };
  }
  function ensureSt(S) {
    if (!S._st) { S._st = freshSt(); S._st.introDone = 1; log('st-created-late'); }
    return S._st;
  }

  /* -------------------------------------------------- progress (real or fallback) */
  const F = S => (S && S.f) || {};
  const PART = { faucet: 'faucet', fridge: 'fridge', toilet: 'toilet', printer: 'printer', dishes: 'dishes', trash: 'garbage', boxes: 'boxes' };
  function topicDone(S, k) {         // real progress part when tasks.js provides it, flag fallback otherwise
    const pr = progress(S), id = PART[k], part = id && pr.parts.find(p => p.id === id);
    return part ? clamp(part.p, 0, 1) : clamp(TOPICS[k].done(S), 0, 1);
  }
  const TOPICS = {
    faucet: { label: 'кран', done: S => F(S).faucetFixed ? 1 : 0, room: 'bath', x: 250 },
    fridge: { label: 'холодильник', done: S => F(S).fridgeDone ? 1 : 0, room: 'kitchen', x: 65 },
    toilet: { label: 'унитаз', done: S => (F(S).flushFixed ? .5 : 0) + clamp(+F(S).toiletClean || 0, 0, 1) * .5, room: 'bath', x: 505 },
    printer: { label: 'принтер', done: S => F(S).printerFixed ? 1 : 0, room: 'work', x: 245 },
    dishes: { label: 'посуда', done: S => F(S).dishesDone ? 1 : 0, room: 'kitchen', x: 250 },
    trash: { label: 'мусор', done: S => { const it = (S.items || []).filter(i => i.kind === 'trash'); return it.length ? it.filter(i => i.taken).length / it.length : 1; }, room: 'living', x: 450 },
    boxes: { label: 'ящики', done: S => F(S).boxesCleared ? 1 : 0, room: 'hall', x: 385 }
  };
  function stainClean(S) { const a = S.stains || []; if (!a.length) return 1; return a.reduce((s, x) => s + (1 - clamp(x.p, 0, 1)), 0) / a.length; }
  function fallbackProgress(S) {
    const w = { faucet: 3, fridge: 3, toilet: 2, printer: 2, dishes: 1.5, trash: 2, boxes: .5 };
    const parts = []; let sw = 0, sp = 0;
    for (const k in w) { const p = clamp(TOPICS[k].done(S), 0, 1); parts.push({ id: k, label: TOPICS[k].label[0].toUpperCase() + TOPICS[k].label.slice(1), p, weight: w[k], text: p >= 1 ? 'готово' : 'не сделано' }); sw += w[k]; sp += w[k] * p; }
    const sc = stainClean(S); parts.push({ id: 'floor', label: 'Пятна', p: sc, weight: 1.5, text: Math.round(sc * 100) + '%' }); sw += 1.5; sp += 1.5 * sc;
    return { score: Math.round(sp / sw * 100), parts, done: parts.filter(p => p.p >= .999).length, total: parts.length };
  }
  function progress(S) {
    S = S || SS(); if (!S) return { score: 0, parts: [], done: 0, total: 0 };
    const r = ext('tasks.progress', S);
    if (r.ok && r.v && typeof r.v.score === 'number' && Array.isArray(r.v.parts)) return r.v;
    return fallbackProgress(S);
  }
  function topTodo(n, prog) {
    prog = prog || progress();
    return prog.parts.filter(p => p.p < .999).sort((a, b) => b.weight * (1 - b.p) - a.weight * (1 - a.p)).slice(0, n || 3).map(p => String(p.label || p.id).toLowerCase());
  }
  function ctxBase(extra) {
    const S = SS(), prog = progress(S);
    return Object.assign({ progress: prog, S, left: S ? S.time : 0, elapsed: S ? S.total - S.time : 0, frac: S ? S.time / S.total : 1, todo: topTodo(3, prog) }, extra || {});
  }

  /* ------------------------------------------------------------ time rules */
  function dialogOpen() { const d = BB.ui && BB.ui.dialogActive; return R.talk || !!(typeof d === 'function' ? d() : d); }
  function timeRate() { return dialogOpen() ? CFG.dialogRate : 1; }
  function bonusRoom(S) { return Math.max(0, CFG.bonusCapFrac * S.total - S._st.bonus); }
  function addTime(dt, why) {
    const S = SS(); if (!S || !dt) return 0;
    let d = dt;
    if (d > 0) { d = Math.min(d, bonusRoom(S), S.total - S.time); if (d < 0) d = 0; S._st.bonus += d; }
    else { d = -Math.min(-d, Math.max(0, S.time - Math.min(S.time, 6))); S._st.penalty -= d; }   // fair: never punish below 6 s left
    S.time = clamp(S.time + d, 0, S.total);
    R.lastDelta = { dt: d, why, at: BB.t || 0 }; log('time' + (d >= 0 ? '+' : '') + Math.round(d), why);
    if (Math.abs(d) >= 1) toast((d > 0 ? '+' : '−') + Math.round(Math.abs(d)) + ' с' + (why ? ' — ' + why : ''));
    return d;
  }

  /* ============================================================== LIFECYCLE */
  function resetRun() {
    gen++; R = blankRuntime();
    const b = BB;
    try { if (b.paused) b.paused = false; } catch (e) { }
    if (b.cam) b.cam.focus = null;
    const p = b.player;
    if (p) { p.lock(false); const PP = p.P; PP.act = null; PP.walkTo = null; PP.force = null; PP.mood = null; PP.held = null; PP.locked = false; }
    if (b.In && b.In.reset) b.In.reset();
    ext('mini.abort'); ext('ui.closeDialog'); ext('ui.closePanel');
    ext('audio.loop', 'phoneRing', false); ext('audio.stopAll');
    if (b.npc) for (const k in b.npc) if (b.npc[k]) { b.npc[k].hidden = true; b.npc[k].state = 'idle'; }
  }

  function start(total) {
    total = CFG.totals.includes(+total) ? +total : (+total > 0 ? clamp(+total, 60, 1800) : CFG.defaultTotal);
    resetRun();
    let S = null;
    if (typeof BB.newState === 'function') { try { S = BB.newState(total); } catch (e) { errs.push('newState: ' + e.message); } }
    if (!S) S = minimalState(total);
    S.total = total; S.time = total; S.mode = 'play'; S.lazy = S.lazy || 0; S.f = S.f || {}; S.calls = S.calls || {};
    S._st = freshSt(); S.intro = 1; S.countdown = 0;
    for (const th of CFG.thresholds) if (th >= total) S._st.th[th] = 1;   // thresholds at/above the start value never fire
    BB.S = S;
    S.f.phoneRing = 0; S.f.phoneUp = 0; S.f.doorOpen = 0; S.f.tvOn = 1; if (S.f.lightHall == null) S.f.lightHall = 0;
    try { localStorage.removeItem(KEY); } catch (e) { }
    const sofa = abs('living', 195);
    BB.player.teleport(sofa); BB.P.dir = 1; BB.P.face = 1; BB.P.vx = 0;
    BB.player.force('sit'); R.lying = true; S._st.startX = sofa; R.startX = sofa;
    R.intro = { phase: 'wake', t: 0 };
    ext('audio.init'); ext('audio.music', true, 0);
    log('start', total);
    BB.emit && BB.emit('story:start', { total });
    return S;
  }

  /* ---------------------------------------------------------------- intro */
  function wakeHero(reason) {
    if (!R.lying) return; R.lying = false;
    BB.player.force(null); BB.player.mood('tired', 1.2); log('wake', reason);
  }
  function introTick(S, dt) {
    const I = R.intro; if (!I) return; I.t += dt;
    const inp = BB.In && (Math.abs(BB.In.ax) > .1 || BB.In.jump || BB.In.act);
    if (I.phase === 'wake') {
      if (inp && I.t > .8) wakeHero('input');
      if (I.t > CFG.introWake) {
        I.phase = 'ring'; I.t = 0; startRing(CALLS[0]);
        bark('phoneRing', ctxBase({ intro: true }), 'Кто звонит? Кто вообще звонит на стену?');
      }
    } else if (I.phase === 'ring') {
      if (R.lying && (inp || I.t > 9)) wakeHero(inp ? 'input' : 'timeout');
    }
  }

  /* ============================================================== CALLS */
  function ringOff() {
    const S = SS(); if (S) S.f.phoneRing = 0;
    ext('audio.loop', 'phoneRing', false);
    if (R.ringH) { try { R.ringH.close(); } catch (e) { } R.ringH = null; }
  }
  function startRing(c, reason) {
    const S = SS(); if (!S || R.ring) return;
    S._st.calls[c.id] = 1; R.ring = { c, t: 0, who: c.who, reason };
    S.f.phoneRing = 1; ext('audio.loop', 'phoneRing', true, { x: phoneX() });
    if (!c.intro) { const h = ext('ui.ring', c.who, () => answerRing('ui'), () => declineRing()); R.ringH = h.ok ? h.v : null; }
    log('ring', c.id);
  }
  function missRing() {
    const S = SS(), r = R.ring; if (!r) return; R.ring = null; ringOff();
    S._st.missed++; R.callGap = 20;
    if (r.who === 'landlord') {
      addTime(-CFG.missPenalty, 'хозяин: «Трубку не берём?»');
      say(lineOf('missedCall', ctxBase(), 'Трубку не берём? Потороплюсь, Бамбуль!'), { who: 'landlord', dur: 3 });
    } else toast('Дэн бросил трубку. Обиделся.');
    log('miss', r.c.id);
  }
  function declineRing() {
    const S = SS(), r = R.ring; if (!r) return; R.ring = null; ringOff();
    S._st.declined++; R.callGap = 20;
    if (r.who === 'landlord') addTime(-CFG.declinePenalty, 'сбросил хозяина'); else toast('Дэн: «Ну и хер с тобой».');
    log('decline', r.c.id);
  }
  function answerRing(src) {
    if (!R.ring || R.talk) return false;
    const r = R.ring; R.ring = null; ringOff();
    beginCall(r.c, src, r.reason); return true;
  }

  /* hero picks up the phone, talks (dialog), hangs up */
  function phoneAnim(cb) {
    const x = phoneX(), near = Math.abs(P().x - x) < 140, S = SS();
    R.call = R.call || {};
    if (near) { BB.player.face(x); S.f.phoneUp = 1; }
    sfx('pickupPhone'); BB.player.lock(true);
    BB.player.doAct('phoneUse', .8, () => { BB.player.setHeld('phone'); BB.player.force('phone'); cb(); });
  }
  function hangUp(reaction) {
    const S = SS(); if (!S) return;
    R.talk = false; sfx('hangup'); S.f.phoneUp = 0; BB.player.force(null); BB.player.setHeld(null);
    BB.player.doAct('phoneUse', .6, () => { BB.player.lock(false); if (reaction) BB.player.mood(reaction, 1.5); });
    R.call = null; R.callGap = Math.max(R.callGap, 6);
  }
  function runDialog(lines, onEnd, opt) {
    const g = gen; R.talk = true; R.talkT = 0; R.dialogs.push(lines); if (R.dialogs.length > 30) R.dialogs.shift();
    const done = () => { if (g !== gen) return; R.talk = false; R.fb = null; onEnd && onEnd(); };
    if (ext('ui.dialog', lines, done, opt || {}).ok) return;
    R.fb = { lines, i: -1, t: 0, done };            // fallback runner (see update)
  }
  function fbTick(dt) {
    const f = R.fb; if (!f) return; f.t -= dt;
    if (f.t > 0) return; f.i++;
    if (f.i >= f.lines.length) { f.done(); return; }
    const l = f.lines[f.i];
    if (l.choices && l.choices.length) { try { l.choices[0].run && l.choices[0].run(); } catch (e) { errs.push('choice: ' + e.message); } }
    say(l.text, { who: l.who, dur: 2.4 }); f.t = 2.2;
  }

  function pickTopic(S, n, reason) {
    if (reason && TOPICS[reason]) return reason;
    const und = ['faucet', 'fridge', 'toilet', 'printer', 'trash'].filter(k => topicDone(S, k) < .99);
    return und.length ? und[(n - 1) % und.length] : 'all';
  }
  const ASK = {
    faucet: 'Кран починил? Соседи снизу звонят — воет на весь стояк.', fridge: 'В холодильник заглядывал? Там у тебя, по слухам, биологическое оружие.',
    toilet: 'Унитаз смывает? Или ты по-прежнему ведром?', printer: 'А эта твоя коробка с пластиком — не дымится?',
    trash: 'Мусор вынес? Или переставил в другую комнату?', all: 'Ну что, у тебя там чисто?'
  };
  const LAND_FB = [
    m => [{ who: 'landlord', text: 'Бамбуль? Аркадий Семёнович беспокоит. Сегодня заеду посмотреть квартиру.' }, { who: 'bamboul', text: 'Сегодня — это типа на неделе?' },
      { who: 'landlord', text: 'Сегодня — это сегодня. Минут через ' + m + ' буду. Чтоб у тебя, блядь, было чисто.' }, { who: 'bamboul', text: 'Да-да, конечно… (кладёт трубку) Пиздец. Хлама на семь лет, а у меня минуты.' }],
    () => [{ who: 'landlord', text: 'Я уже выезжаю. И если я увижу там филиал помойки — будем разговаривать.' }],
    m => [{ who: 'landlord', text: 'Через ' + m + ' мин буду. Это не философская величина, Бамбуль.' }],
    () => [{ who: 'landlord', text: 'Я поднимаюсь по району. У тебя там не квартира, а археологические раскопки.' }],
    () => [{ who: 'landlord', text: 'Только не говори, что ты опять ничего не сделал.' }],
    () => [{ who: 'landlord', text: 'Я у подъезда. Не заставляй меня знакомиться с твоей грязью лично.' }]
  ];
  const REPLY = {
    claimTrue: [{ who: 'landlord', text: 'Ну надо же. Молодец. Тогда я ещё в «Магнит» заскочу, не спеши.' }],
    claimPartial: [{ who: 'landlord', text: 'Ну-ну. «Почти» — это не «сделал». Проверю лично.' }],
    claimLie: [{ who: 'landlord', text: 'Что-то ты темнишь. Я отсюда слышу, как там у тебя. Потороплюсь-ка.' }, { who: 'bamboul', text: '(шёпотом) Бля.' }],
    honest: [{ who: 'landlord', text: 'Хоть не врёшь. Уважаю. Даю тебе ещё пару минут — но не больше.' }],
    joke: [{ who: 'landlord', text: 'Алло? Бамбуль? Тьфу ты…' }, { who: 'bamboul', text: 'Фух. Пронесло. Наверное.' }],
    all: [{ who: 'landlord', text: 'Посмотрим, посмотрим. Я человек недоверчивый.' }]
  };

  function beginCall(c, src, reason) {
    const S = SS(); if (!S) return;
    if (c.dan) return beginDanOffer(c, src);
    phoneAnim(() => {
      if (S !== SS()) return;
      const n = c.intro ? 0 : ++S._st.lcount;
      const topic = c.intro ? null : pickTopic(S, n, reason);
      const ctx = ctxBase({ n, id: c.id, reason, topic, intro: !!c.intro, src, minutes: Math.max(1, Math.round(S.time / 60)) });
      const fbLines = (LAND_FB[n] || LAND_FB[1 + (n % 5)])(ctx.minutes);
      let lines = script('landlord:' + n, ctx, fbLines).slice();
      let pick = null, hasChoice = lines.some(l => l.choices);
      if (!c.intro && !hasChoice) {
        lines.push({ who: 'landlord', text: ASK[topic] || ASK.all, choices: [
          { text: topic === 'all' ? 'Да, всё идеально!' : 'Да, всё готово!', run: () => { pick = 'claim'; } },
          { text: 'Нет, ещё работаю', run: () => { pick = 'honest'; } },
          { text: 'Алло? Связь плохая…', run: () => { pick = 'joke'; } }] });
      }
      log('call', c.id + ':' + n);
      runDialog(lines, () => {
        let reply = null, rk = null;
        if (pick) {
          const d = topic === 'all' ? clamp(progress(S).score / 100, 0, 1) : topicDone(S, topic);
          if (pick === 'claim') {
            if (d >= .99 || (topic === 'all' && d >= .85)) { rk = 'claimTrue'; addTime(CFG.truthGain, 'правда окупилась'); }
            else if (d >= .5) { rk = 'claimPartial'; }
            else { rk = 'claimLie'; S._st.lies++; addTime(-CFG.lieLoss, 'враньё не прошло'); }
          } else if (pick === 'honest') { rk = 'honest'; addTime(d >= .99 ? 5 : CFG.honestGain, 'честность'); }
          else rk = 'joke';
          reply = script('landlordReply:' + rk, ctxBase({ topic, pick, d }), REPLY[rk]);
        }
        const fin = () => {
          S._st.calls[c.id] = 2; S._st.answered++;
          if (c.intro) { S._st.introDone = 1; S.intro = 0; S.countdown = 1; BB.cam.shake = .35; toast('Таймер пошёл. Хозяин едет!'); ext('audio.music', true, 0); R.intro = null; }
          hangUp(rk === 'claimLie' ? 'shock' : 'nervous');
          bark('afterCall', ctxBase({ outcome: rk }), c.intro ? 'Так. Мусор, пятна, кран, холодильник. Погнали.' : null);
          save();
        };
        if (reply && reply.length) runDialog(reply, fin); else fin();
      }, { phone: true });
    });
  }

  /* Dan phones himself: offers to stall the landlord (optional, once) */
  function beginDanOffer(c, src) {
    const S = SS(); let pick = null;
    phoneAnim(() => {
      S._st.danOffer = 1;
      const ctx = ctxBase({ id: c.id, offer: true });
      const lines = script('dan:offer', ctx, [{ who: 'dan', text: 'Я мимо твоего дома еду. Хочешь, задержу твоего Семёныча у подъезда? Спрошу про ЖКХ — он на час заведётся.', choices: [
        { text: 'Давай! Должен шаурму', run: () => { pick = 'yes'; } }, { text: 'Не надо, я сам', run: () => { pick = 'no'; } }] }]).slice();
      if (!lines.some(l => l.choices)) lines.push({ who: 'dan', text: 'Ну так что? Задерживать?', choices: [{ text: 'Давай! Должен шаурму', run: () => { pick = 'yes'; } }, { text: 'Не надо, я сам', run: () => { pick = 'no'; } }] });
      runDialog(lines, () => {
        let reply;
        if (pick === 'yes') { S._st.danStall = 1; S._st.owes = 1; addTime(CFG.danStall, 'Дэн тянет время'); reply = script('dan:stall', ctxBase(), [{ who: 'dan', text: 'С тебя ящик шаурмы. И ты моешь мне машину. Всё, пошёл его грузить.' }]); }
        else reply = script('dan:nostall', ctxBase(), [{ who: 'dan', text: 'Гордый. Ну-ну. Тогда не ной потом.' }]);
        const fin = () => { S._st.calls[c.id] = 2; S._st.answered++; hangUp(pick === 'yes' ? 'cheer' : null); save(); };
        runDialog(reply, fin);
      }, { phone: true });
    });
  }

  /* reactive landlord calls after real events; schedule check */
  const REACT = [
    { id: 'r:faucet', topic: 'faucet', when: (S, fr) => !F(S).faucetFixed && F(S).faucetHowl && fr > .22, why: 'соседи пожаловались на вой' },
    { id: 'r:fridge', topic: 'fridge', when: (S, fr) => !F(S).fridgeDone && fr > .4 && (F(S).fridgeOpen || fr > .55), why: 'запах на лестнице' },
    { id: 'r:lazy', topic: 'all', when: S => (S.lazy || 0) >= CFG.lazyCall, why: 'слышит телевизор' }
  ];
  function remaining(at, S) { return at <= 1 ? at * S.total : at; }
  function scheduleCheck(S, dt) {
    const st = S._st;
    if (!st.introDone) return;
    if (R.callGap > 0) R.callGap -= dt;
    if (R.ring || R.talk || R.callGap > 0 || R.pendingEnd || S.time < 9) return;
    const busy = ext('ui.busy'); if (busy.ok && busy.v && R.deferT < 25) { R.deferT += dt; return; }
    R.deferT = 0;
    const left = S.time, fr = left / S.total;
    let due = null;
    for (const c of CALLS) {
      if (c.intro || st.calls[c.id]) continue;
      const at = c.dan ? CFG.danOwnAt : CFG.callAt[c.at];
      if (at != null && left <= remaining(at, S)) { if (due) st.calls[due.id] = -1; due = c; }   // several overdue: play the latest, skip older
    }
    if (due) { startRing(due); return; }
    if (st.reactive < CFG.reactiveMax && st.lcount < 6) {
      for (const r of REACT) if (!st.calls[r.id] && r.when(S, 1 - fr)) {   // fr passed as ELAPSED fraction
        st.calls[r.id] = 1; st.reactive++; startRing({ id: r.id, who: 'landlord', reactive: true }, r.topic); log('reactive', r.id); return;
      }
    }
  }

  /* ------------------------------------------------------------------ Dan */
  const MINI_IDS = ['fridge', 'faucet', 'toilet', 'printer', 'dishes', 'mirror', 'vacJam'];
  function currentMini() {
    const m = BB.mini; let id = null;
    if (m) { const a = m.active || m.cur || m.current; id = typeof a === 'string' ? a : (a && a.id) || null; }
    if (!id && BB.cur && BB.cur.hot && MINI_IDS.includes(BB.cur.hot.id)) id = BB.cur.hot.id;
    return id;
  }
  function danHintLines(S) {
    const id = currentMini(), prog = progress(S), todo = topTodo(3, prog);
    const ctx = ctxBase({ id, hint: true });
    let lines = null;
    if (id) lines = script('danHint:' + id, ctx, null);
    if (!lines) lines = script('danHint:general', ctx, null);
    if (!lines) lines = [{ who: 'bamboul', text: 'Дэн, быстро: что мне делать?' },
      { who: 'dan', text: todo.length ? 'Опять я за тебя думаю. Осталось самое жирное: ' + todo.join(', ') + '. Шевели булками.' : 'Да у тебя всё чисто, идиот. Открывай дверь и не звони мне.' }];
    return lines;
  }
  function callDan() {
    const S = SS();
    if (!S || S.mode !== 'play' || R.talk) return false;
    if (BB.paused || R.pendingEnd) return false;
    if (!S._st.introDone) { toast('Дэн: «Сначала возьми трубку, которая звонит».'); return false; }
    if (S._st.danCd > 0) { toast('Дэн не берёт трубку. Обиделся (' + Math.ceil(S._st.danCd) + ' с).'); return false; }
    S._st.danCd = CFG.danCooldown; S._st.hints++;
    const lines = danHintLines(S); log('danHint', currentMini() || 'general');
    sfx('pickupPhone'); BB.player.lock(true);
    BB.player.doAct('phoneUse', .6, () => { BB.player.setHeld('phone'); BB.player.force('phone');
      runDialog(lines, () => { BB.player.force(null); BB.player.setHeld(null); BB.player.lock(false); R.talk = false; sfx('hangup'); });
    });
    return true;
  }

  /* ------------------------------------------------------- wall phone hotspot */
  function phone() {
    const S = SS(); if (!S || S.mode !== 'play' || R.talk || BB.paused) return;
    if (R.ring) { answerRing('wall'); return; }
    if (!S._st.introDone) { toast('Пока молчит. Подожди звонка.'); return; }
    let pick = null;
    phoneAnim(() => {
      const lines = [{ who: 'narr', text: 'Гудки. Кому звоним?', choices: [
        { text: 'Дэну — спросить, что делать', run: () => { pick = 'dan'; } },
        { text: 'Хозяину — узнать, где он', run: () => { pick = 'land'; } },
        { text: 'Положить трубку', run: () => { pick = 'none'; } }] }];
      runDialog(lines, () => {
        if (pick === 'dan') {
          R.talk = false; BB.player.force(null); BB.player.setHeld(null); S.f.phoneUp = 0; BB.player.lock(false);
          if (!callDan()) hangUp(null);
        } else if (pick === 'land') {
          const m = Math.max(1, Math.round(S.time / 60)), free = S._st.statusCalls === 0 && S._st.statusCd <= 0;
          S._st.statusCalls++;
          const lines2 = script('landlordStatus', ctxBase({ minutes: m, free }), [
            { who: 'bamboul', text: 'Аркадий Семёнович, а вы где?' },
            { who: 'landlord', text: 'В пробке на Ленинском, ' + m + ' мин осталось. И не звони мне по пустякам, у меня давление.' }]);
          runDialog(lines2, () => { if (!free) addTime(-5, 'хозяин психует'); S._st.statusCd = CFG.statusCooldown; hangUp('nervous'); });
        } else hangUp(null);
      }, { phone: true });
    });
  }

  /* ============================================================== THRESHOLDS */
  const TH_TEXT = {
    300: ['Пять минут до приезда хозяина!', 'Пять минут. Нормально. Нормально же?'],
    120: ['Две минуты до хозяина!', 'Две минуты?! Я только разогрелся!'],
    60: ['Минута! Хозяин у метро!', 'Минута. Всё. Это не обучение.'],
    30: ['30 секунд! Хозяин во дворе!', 'Тридцать секунд!! Где мой мусор?!'],
    10: ['10 секунд!', 'Он на лестнице!!']
  };
  function fireThreshold(S, th) {
    S._st.th[th] = 1; log('threshold', th);
    const tx = TH_TEXT[th] || [th + ' с до хозяина!', 'Время!'];
    toast(tx[0]);
    bark('panic', ctxBase({ t: th }), tx[1]);
    sfx(th <= 60 ? 'urgent' : 'tick');
    if (th <= 30) BB.cam.shake = Math.max(BB.cam.shake || 0, th <= 10 ? .9 : .5);
    BB.player.mood(th <= 30 ? 'panic' : 'shock', 1.6);
    BB.emit && BB.emit('story:threshold', { t: th });
  }
  function thresholds(S, dt) {
    const ths = CFG.thresholds.slice().sort((a, b) => b - a);
    let fired = null;
    for (const th of ths) if (S.time <= th && !S._st.th[th]) { if (fired != null) S._st.th[fired] = 1; fired = th; }  // several crossed: play the lowest, mark others
    if (fired != null) fireThreshold(S, fired);
    if (S.time <= 10 && S.time > 0) { const sec = Math.ceil(S.time); if (sec !== R.tickSec) { R.tickSec = sec; sfx('tick'); } }
    R.musT -= dt; if (R.musT <= 0) { R.musT = 2; ext('audio.music', true, clamp(1 - S.time / S.total, 0, 1)); }
  }

  /* ============================================================== TUTORIAL */
  const touch = () => !!(BB.CFG && BB.CFG.touch) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
  const hallX = x => abs('hall', x);
  function takenCount(S) { return (S.items || []).filter(i => i.taken).length; }
  const STEPS = [
    { id: 'move', text: () => touch() ? 'Стик — идти. Быстро отклони — бежать' : 'A / D или ← → — идти. Shift — бежать', when: S => true, done: S => Math.abs(P().x - R.startX) > 90 },
    { id: 'phone', text: () => 'Звонит телефон на стене в прихожей — это налево. Подойди и нажми ' + (touch() ? 'кнопку действия' : 'E'), when: S => !S._st.introDone && S.f.phoneRing && !R.lying, done: S => S._st.introDone },
    { id: 'jump', text: () => (touch() ? 'Ящики мешают: кнопка прыжка' : 'Ящики мешают: Пробел — прыжок') + ', перепрыгни', when: S => !S.f.boxesCleared && P().x > hallX(425) && P().x < hallX(560), done: S => R.passedBoxes || S.f.boxesCleared },
    { id: 'timer', text: () => 'Вверху таймер: столько осталось до приезда хозяина', when: S => S._st.introDone, done: S => false },
    { id: 'trash', text: () => 'Мусор на полу: подойди и нажми ' + (touch() ? 'действие' : 'E') + ', чтобы подобрать', when: S => S._st.introDone, done: S => R.takenBase != null && (takenCount(S) > R.takenBase || (S.carry && S.carry.trash > 0)) },
    { id: 'bag', text: () => 'Мусор — в мешок у стены прихожей (' + (touch() ? 'действие' : 'E') + ')', when: S => S._st.introDone, done: S => (+S.f.bagFill || 0) > R.bagBase || (+S.f.binFill || 0) > R.binBase },
    { id: 'tool', text: () => 'Пылесос — в шкафу в прихожей, швабра — в ванной (' + (touch() ? 'действие' : 'E') + ')', when: S => S._st.introDone, done: S => S.tools && (S.tools.vac || S.tools.mop) },
    { id: 'hold', text: () => touch() ? 'Держи кнопку F — пылесосить / мыть' : 'Держи F — пылесосить / мыть. Отпустил — стоп', when: S => S._st.introDone && S.tools && (S.tools.vac || S.tools.mop), done: S => R.hold > .8 }
  ];
  function tutorial(S, dt) {
    const st = S._st; if (!CFG.tutorial) return;
    const p = P();
    if (R.takenBase == null) { R.takenBase = takenCount(S); R.bagBase = +S.f.bagFill || 0; R.binBase = +S.f.binFill || 0; }
    if (p.y > 0 && p.x < hallX(430) && p.x > hallX(330)) R.passedBoxes = true;
    if (R.sawBoxes && p.x < hallX(340)) R.passedBoxes = true;
    if (p.x > hallX(430) && p.x < hallX(520)) R.sawBoxes = true;
    if (BB.In && BB.In.use && S.active && S.active !== 'hand') R.hold += dt; else R.hold = Math.max(0, R.hold - dt * .5);
    R.tutT -= dt; if (R.tutT > 0 || dialogOpen() || (ext('ui.busy').v)) return;
    for (const s of STEPS) {
      if (st.tut[s.id] === 'done') continue;
      if (s.done(S)) { st.tut[s.id] = 'done'; continue; }
      if (!s.when(S)) continue;
      const sh = R.tutShow[s.id] || (R.tutShow[s.id] = { n: 0, at: -99 });
      const now = (BB.t || 0);
      if (sh.n >= 3 || now - sh.at < 28) { return; }
      sh.n++; sh.at = now; R.tutT = 2; toast(s.text()); if (s.id === 'timer') st.tut.timer = 'done'; log('tutorial', s.id); return;
    }
  }

  /* ================================================================ UPDATE */
  function update(dt, S) {
    if (S !== BB.S || !S) return;
    runTimers(dt);
    if (S.mode === 'ending') { endingTick(S, dt); return; }
    if (S.mode !== 'play') return;
    const st = ensureSt(S);
    if (R.fb) fbTick(dt);
    if (R.talk) { R.talkT += dt; if (R.talkT > 180) { R.talk = false; R.fb = null; BB.player.lock(false); log('talk-watchdog'); } }
    if (st.danCd > 0) st.danCd -= dt; if (st.statusCd > 0) st.statusCd -= dt;
    if (R.doorAsk) { R.doorT += dt; if (R.doorT > 25) resume(); }
    S.intro = st.introDone ? 0 : 1;
    if (R.intro) introTick(S, dt);
    if (R.ring) { if (!R.talk) R.ring.t += dt; if (!R.ring.c.intro && R.ring.t > CFG.ringTimeout) missRing(); }
    // the clock
    if (st.introDone && !R.pendingEnd) {
      S.time = Math.max(0, S.time - dt * timeRate());
      thresholds(S, dt);
      scheduleCheck(S, dt);
      if (S.time <= 0) { R.pendingEnd = { early: false, w: 0 }; log('timeout'); }
    }
    if (R.pendingEnd) {
      R.pendingEnd.w += dt;
      if (!dialogOpen() || R.pendingEnd.w > 6) { const e = R.pendingEnd.early; R.pendingEnd = null; beginEnding(e); return; }
    }
    // progress poll + autosave
    R.progT -= dt; if (R.progT <= 0) { R.progT = 1; const pr = progress(S); const k = pr.done + ':' + Math.round(pr.score); if (R.prog != null && k !== R.prog) save(); R.prog = k; }
    R.saveT += dt; if (R.saveT >= CFG.autosave) { R.saveT = 0; save(); }
    tutorial(S, dt);
  }
  function runTimers(dt) {
    if (!R.timers.length) return;
    const keep = [], fire = [];
    for (const t of R.timers) { t.t -= dt; (t.t <= 0 ? fire : keep).push(t); }
    R.timers = keep;
    for (const t of fire) if (t.g === gen) { try { t.fn(); } catch (e) { errs.push('timer: ' + e.message); } }
  }

  /* ============================================================== ENDINGS */
  function askDoor() {
    const S = SS(); if (!S || S.mode !== 'play' || R.doorAsk) return;
    if (!S._st || !S._st.introDone) { toast('Рано открывать. Сначала телефон.'); return; }
    if (R.talk || R.pendingEnd) return;
    BB.player.face(abs('hall', 95));
    R.doorAsk = true; R.doorT = 0; BB.player.lock(true);
    const arg = { onYes: () => { R.doorAsk = false; ending(true); }, onNo: () => resume() };
    if (!ext('ui.showMenu', 'door', arg).ok) { resume(); ending(true); }
  }
  function ending(early) {
    const S = SS(); if (!S || S.mode !== 'play') return false;
    R.doorAsk = false; R.pendingEnd = { early: !!early, w: 0 };
    return true;
  }
  const FINDINGS_FB = {
    boxes: 'Что за картонный Стоунхендж в прихожей?', trash: 'Я на что-то наступил. Оно хрустнуло. Я не хочу знать, что это.',
    stains: 'Пол липкий. Я прилип. Это не метафора.', tv: 'Телевизор тёплый. Ты тут что, работал?',
    fridge: '(открывает холодильник) Матерь божья… Закрой. Закрой немедленно.', dishes: 'Посуда — это экспонаты для музея?',
    faucet: 'Кран воет на весь подъезд! Я его ещё с лестницы услышал.', toilet: 'Смыв не работает? Ты как тут живёшь вообще?',
    printer: 'А эта коробка в комнате дымится — так и надо?', ok_kitchen: 'Кухня… нормальная. Подозрительно нормальная.', ok_bath: 'Кран молчит. Надо же. Чудеса.'
  };
  function findings(S) {
    const f = F(S), out = [];
    const add = (room, id, x, bad) => out.push({ room, id, x: abs(room, x), bad });
    add('hall', 'boxes', 385, !f.boxesCleared);
    const itemsLeft = (S.items || []).filter(i => i.kind === 'trash' && !i.taken);
    if (itemsLeft.length) { const it = itemsLeft[0]; out.push({ room: BB.LAYOUT ? BB.LAYOUT.roomOf(it.ax).id : 'living', id: 'trash', x: it.ax, bad: true }); }
    if (stainClean(S) < .6) add('living', 'stains', 450, true);
    if ((S.lazy || 0) >= 4 && f.tvOn) add('living', 'tv', 650, true);
    add('kitchen', 'fridge', 65, !f.fridgeDone); add('kitchen', 'dishes', 250, !f.dishesDone);
    add('bath', 'faucet', 250, !f.faucetFixed); add('bath', 'toilet', 505, !(f.flushFixed && (+f.toiletClean || 0) >= .8));
    add('work', 'printer', 245, !f.printerFixed);
    return out;
  }
  function pickEnding(S, prog, early) {
    const st = S._st, fr = S.time / S.total;
    if (prog.score >= CFG.mortgage.score && early && fr >= CFG.mortgage.timeFrac && st.danStall && st.lies === 0) return ENDINGS.mortgage;
    if ((S.lazy || 0) >= CFG.lazyEnding && prog.score < CFG.endTiers.ok) return ENDINGS.sofa;
    return prog.score >= CFG.endTiers.good ? ENDINGS.good : prog.score >= CFG.endTiers.ok ? ENDINGS.ok : ENDINGS.bad;
  }
  function verdictFallback(end, S) {
    const L = [], f = F(S);
    if (end.tier === 'mortgage') return [{ who: 'landlord', text: 'Бамбуль… Чисто, рано, с братом на подхвате. Ты случайно не продаёшься?' }, { who: 'bamboul', text: 'Я? Нет. Ну, смотря за сколько.' },
      { who: 'landlord', text: 'Слушай, купи у меня эту квартиру. Ипотека — четыре процента, первый взнос — шаурма.' }, { who: 'bamboul', text: '…Дэн, ты слышишь? Нас повысили до собственников.' }];
    if (end.tier === 'sofa') return [{ who: 'landlord', text: 'Бамбуль, ты лежишь. Телевизор работает. Мусор — тоже. Ты вообще хоть что-то делал?' }, { who: 'bamboul', text: 'Я стратегически восстанавливался.' },
      { who: 'landlord', text: '…Подвинься. У меня тоже была тяжёлая неделя.' }, { who: 'narr', text: 'Хозяин сел на диван. Квартира осталась как есть. Аренда — тоже.' }];
    if (end.tier === 'good') L.push({ who: 'landlord', text: 'Бамбуль… Я, признаться, шёл тебя выселять. А тут… Ты что, клининг вызывал?' }, { who: 'bamboul', text: 'Сам, Аркадий Семёныч. Вот этими руками.' }, { who: 'landlord', text: 'Ну, раз так — аренду в этом году не подниму. Живи.' });
    else if (end.tier === 'ok') L.push({ who: 'landlord', text: 'Ну… жить можно. Но что не доделал — доделай до пятницы. Я проверю.' }, { who: 'bamboul', text: 'Конечно. До пятницы. Какого года — не уточняем.' });
    else L.push({ who: 'landlord', text: 'Это что за свинарник? Штраф из залога. Собирай вещи — до воскресенья духу твоего тут не будет.' }, { who: 'bamboul', text: 'Дэн, привет. Слушай, а у тебя диван свободен?' }, { who: 'dan', text: 'Нет.' });
    return L;
  }

  function npc() { return BB.npc && BB.npc.landlord; }
  function beginEnding(early) {
    const S = SS(); if (!S || S.mode !== 'play') return;
    log('ending-begin', early ? 'early' : 'timeout');
    ringOff(); R.ring = null; R.call = null; R.talk = false; R.fb = null; R.doorAsk = false;
    ext('mini.abort'); ext('ui.closeDialog'); ext('ui.closePanel');
    if (BB.In && BB.In.reset) BB.In.reset();
    ext('audio.loop', 'phoneRing', false); ext('audio.music', false);
    try { localStorage.removeItem(KEY); } catch (e) { }
    S.mode = 'ending'; S.early = early ? Math.round(S.time) : 0; S.intro = 0;
    BB.player.lock(true); BB.player.setHeld(null); BB.player.force(null); BB.player.P.act = null; R.lying = false;
    S.f.phoneUp = 0;
    const prog = progress(S), end = pickEnding(S, prog, early);
    R.end = { phase: 'knock', t: 0, pt: 0, early, prog, end, stops: [], si: 0, fast: false, done: false, lx: 20, wait: 0 };
    enterPhase('knock');
  }
  function enterPhase(ph) {
    const E = R.end, S = SS(); E.phase = ph; E.pt = 0; log('phase', ph);
    const p = P(), n = npc();
    if (ph === 'knock') {
      if (!E.early) { sfx('doorKnock'); sfx('doorBell'); toast('ДЗЫНЬ. Хозяин пришёл.'); BB.cam.shake = .7; BB.player.mood('shock', 1.8); }
      BB.cam.focus = { x: p.x, zoom: 1.05 };
      E.knockDur = E.early ? .6 : 2;
    } else if (ph === 'open') {
      sfx('doorOpen'); S.f.doorOpen = 1;
      const hx = hallX(250);
      if (Math.abs(p.x - hx) > 600) BB.player.teleport(hx); else BB.player.walkTo(hx, null, true);
      if (n) { n.hidden = false; n.x = 20; n.y = 0; n.dir = 1; n.state = 'walk'; }
      E.lx = 20; BB.cam.focus = { x: hx - 60, zoom: 1.1 };
    } else if (ph === 'greet') {
      if (n) { n.state = 'idle'; n.dir = 1; }
      BB.player.face(E.lx); BB.player.force('nervous');
      const ctx = ctxBase({ early: E.early, tier: E.end.tier, end: E.end, score: E.prog.score });
      say(E.early ? lineOf('endEarly', ctx, 'Ты чего так рано? Я только на этаж поднялся. Ну, показывай.') : lineOf('endLate', ctx, 'Время вышло, Бамбуль. Показывай, что у тебя тут.'), { who: 'landlord', dur: 3.2 });
      E.stops = makeStops(S, E.end);
    } else if (ph === 'tour') {
      E.si = 0; E.stopPhase = 'walk';
    } else if (ph === 'verdict') {
      if (n) { n.state = E.end.tier === 'bad' ? 'angry' : 'idle'; n.dir = p.x < E.lx ? -1 : 1; }
      BB.player.face(E.lx);
      BB.player.force(({ good: 'cheer', mortgage: 'cheer', ok: 'shrug', bad: 'fail', sofa: 'sit' })[E.end.tier]);
      const ctx = ctxBase({ tier: E.end.tier, end: E.end, score: E.prog.score, early: E.early, findings: findings(S), lies: S._st.lies, stalled: S._st.danStall, lazy: S.lazy || 0 });
      const lines = script('ending:' + E.end.tier, ctx, verdictFallback(E.end, S));
      E.verdict = true;
      runDialog(lines, () => enterPhase('result'), {});
    } else if (ph === 'result') {
      finish();
    }
  }
  function makeStops(S, end) {
    if (end.tier === 'sofa') return [{ x: abs('living', 195) - 90, id: 'sofa', bad: true, tv: true }];
    const all = findings(S).filter(f => f.bad).sort((a, b) => a.x - b.x);
    let stops = all.length > 4 ? pickSpread(all, 4) : all.slice();
    if (stops.length < 2) {   // everything is clean: two admiring stops
      stops = [{ id: 'ok_kitchen', x: abs('kitchen', 250), bad: false }, { id: 'ok_bath', x: abs('bath', 250), bad: false }];
    }
    return stops.map(s => ({ x: s.x - 80, id: s.id, bad: s.bad, fx: s.x }));
  }
  function pickSpread(a, n) { const out = []; for (let i = 0; i < n; i++) out.push(a[Math.round(i * (a.length - 1) / (n - 1))]); return out; }

  function heroFollow(E, tx) {
    const p = P(), now = BB.t || 0;
    if (BB.P.walkTo) {
      if (Math.abs(p.x - R.stuckX) < 1.5) R.stuckT += 1 / 60; else { R.stuckT = 0; R.stuckX = p.x; }
      if (R.stuckT > 2.5) { BB.player.teleport(tx); BB.P.walkTo = null; R.stuckT = 0; }
      return;
    }
    if (Math.abs(p.x - tx) > 14) {
      let from = p.x; const boxesUp = !F(SS()).boxesCleared;
      if (Math.abs(p.x - tx) > 450) { let nx = tx - Math.sign(tx - p.x) * 460; if (boxesUp && p.x < hallX(345) && tx > hallX(440)) nx = Math.max(nx, hallX(450)); BB.player.teleport(nx); from = nx; }
      if (boxesUp && from < hallX(345) && tx > hallX(440)) { BB.player.teleport(tx); return; }
      BB.player.walkTo(tx, null, false);
    }
  }
  function endingTick(S, dt) {
    const E = R.end; if (!E || E.done) return;
    E.t += dt; E.pt += dt;
    if (R.fb) fbTick(dt);
    const p = P(), n = npc();
    if (BB.In && (BB.In.act || BB.In.jump)) E.fast = true;
    const sp = E.fast ? 420 : 150;
    if (E.t > 150 && E.phase !== 'result') { log('ending-watchdog'); R.talk = false; R.fb = null; ext('ui.closeDialog'); enterPhase('result'); return; }
    if (E.phase === 'knock') { if (E.pt >= E.knockDur) enterPhase('open'); }
    else if (E.phase === 'open') {
      E.lx = Math.min(E.lx + sp * dt, hallX(140)); if (n) { n.x = E.lx; n.state = 'walk'; }
      BB.cam.focus.x = (E.lx + p.x) / 2;
      if (E.pt > 7 && Math.abs(p.x - hallX(250)) > 20) { BB.player.teleport(hallX(250)); BB.P.walkTo = null; }
      if (E.lx >= hallX(140) - 1 && !BB.P.walkTo) enterPhase('greet');
    } else if (E.phase === 'greet') {
      BB.cam.focus.x = (E.lx + p.x) / 2;
      if (E.pt > (E.fast ? 1 : 3.4)) enterPhase('tour');
    } else if (E.phase === 'tour') {
      const stop = E.stops[E.si];
      if (!stop) { enterPhase('verdict'); return; }
      if (E.stopPhase === 'walk') {
        const d = stop.x - E.lx;
        if (Math.abs(d) <= sp * dt) { E.lx = stop.x; E.stopPhase = 'look'; E.pt = 0; if (n) { n.state = 'inspect'; n.dir = 1; } stopEffects(S, stop, E); }
        else { E.lx += Math.sign(d) * sp * dt; if (n) { n.state = 'walk'; n.dir = Math.sign(d); } }
        heroFollow(E, E.lx - 130);
      } else if (E.stopPhase === 'look') {
        heroFollow(E, E.lx - 130);
        if (E.pt > (E.fast ? 1 : 3.6)) { E.si++; E.stopPhase = 'walk'; E.pt = 0; if (n) n.state = 'walk'; }
      }
      if (n) { n.x = E.lx; n.y = 0; }
      BB.cam.focus.x = E.lx - 40;
    } else if (E.phase === 'verdict') {
      BB.cam.focus.x = (E.lx + p.x) / 2;
    }
  }
  function stopEffects(S, stop, E) {
    const ctx = ctxBase({ finding: stop.id, tier: E.end.tier, bad: stop.bad });
    const text = lineOf('endInspect:' + stop.id, ctx, FINDINGS_FB[stop.id] || 'Так-так-так…');
    say(text, { who: 'landlord', dur: 3.4 });
    if (stop.id === 'fridge') { S.f.fridgeOpen = 1; sfx('fridgeOpen'); BB.player.mood('shock', 1.4); }
    if (stop.id === 'faucet') sfx('faucetHowl');
    if (stop.id === 'sofa') { BB.player.teleport(abs('living', 195)); BB.player.force('sit'); S.f.tvOn = 1; }
    if (stop.bad) BB.player.mood('shock', 1.2);
    log('inspect', stop.id);
  }
  function stats(S) {
    const st = S._st, E = R.end || {};
    return { total: S.total, left: Math.round(S.time), used: Math.round(S.total - S.time), early: !!E.early, answered: st.answered, missed: st.missed, declined: st.declined,
      lies: st.lies, hints: st.hints, danStall: !!st.danStall, lazy: S.lazy || 0, bonus: Math.round(st.bonus), penalty: Math.round(st.penalty), score: E.prog ? E.prog.score : progress(S).score };
  }
  function finish() {
    const S = SS(), E = R.end; if (!E || E.done) return; E.done = true;
    const prog = progress(S);                                  // re-evaluate: the final number is what the screen shows
    E.prog = prog; const res = { score: prog.score, parts: prog.parts, ending: E.end, stats: stats(S) };
    BB.story.lastResult = res; log('result', E.end.id + ':' + prog.score);
    ext('audio.stopAll');
    BB.emit && BB.emit('story:end', res);
    const sc = { score: res.score, title: E.end.title, text: E.end.blurb, ending: E.end.id, left: Math.round(S.time), stats: res.stats };
    const opts = { ending: E.end, stats: res.stats, onAgain: () => start(S.total), onMenu: () => toTitle() };
    if (!ext('ui.result', sc, res.parts, opts).ok) toast(E.end.title + ' — ' + res.score + '%');
  }

  /* ============================================================ SAVE / LOAD */
  let mem = null;
  function lsGet() { try { return localStorage.getItem(KEY); } catch (e) { return mem; } }
  function lsSet(v) { mem = v; try { localStorage.setItem(KEY, v); } catch (e) { } }
  function canSave() {
    const S = SS(); return !!(S && S.mode === 'play' && S._st && S._st.introDone && !R.talk && !R.ring && !R.pendingEnd && !R.end && !R.doorAsk && S.time > 3);
  }
  function save() {
    if (!canSave()) return false;
    const S = SS();
    try {
      const r = ext('tasks.serialize', S);
      let tasks;
      if (r.ok) tasks = r.v; else { const c = Object.assign({}, S); delete c.st; tasks = JSON.parse(JSON.stringify(c)); }
      const p = P(), blob = { v: 2, ts: Date.now(), total: S.total, time: S.time, px: p.x, dir: p.dir, lazy: S.lazy || 0, tasks, story: JSON.parse(JSON.stringify(S._st)) };
      lsSet(JSON.stringify(blob)); log('save'); return true;
    } catch (e) { errs.push('save: ' + e.message); return false; }
  }
  function readSave() {
    try { const raw = lsGet(); if (!raw) return null; const b = JSON.parse(raw); if (!b || b.v !== 2 || !(b.time > 3) || !(b.total >= 60) || b.time > b.total + .5 || !b.story || b.tasks == null) return null; return b; } catch (e) { return null; }
  }
  function hasSave() { return !!readSave(); }
  function continueRun() {
    const b = readSave(); if (!b) return false;
    resetRun();
    let S = null;
    try { S = typeof BB.newState === 'function' ? BB.newState(b.total) : minimalState(b.total); } catch (e) { S = minimalState(b.total); }
    BB.S = S;
    const r = ext('tasks.restore', b.tasks);
    if (r.ok && r.v && typeof r.v === 'object') S = BB.S = r.v;
    else if (!r.ok && b.tasks && typeof b.tasks === 'object') {       // no tasks module: merge the plain blob
      const t = JSON.parse(JSON.stringify(b.tasks)); const keepF = S.f; Object.assign(S, t); S.f = Object.assign(keepF, t.f || {});
    }
    // consistency pass: story data wins for the clock; transient flags cannot survive a load
    S.total = b.total; S.time = clamp(b.time, 1, b.total); S.mode = 'play'; S.lazy = S.lazy != null ? S.lazy : b.lazy;
    S.f = S.f || {}; S.f.phoneRing = 0; S.f.phoneUp = 0; S.f.doorOpen = 0; S.f.toiletFlush = 0; S.f.faucetStage = S.f.faucetStage || 0;
    if (S.f.faucetFixed) { S.f.faucetHowl = 0; }
    if (S.f.fridgeDone) { S.f.fridgeRot = 0; }
    if (S.f.printerFixed) S.f.printerError = 0;
    S._st = Object.assign(freshSt(), b.story); S._st.introDone = 1; S.intro = 0; S.countdown = 1;
    for (const k in S._st.calls) if (S._st.calls[k] === 1) delete S._st.calls[k];          // a call that was ringing at save time may ring again
    BB.player.teleport(clamp(b.px, 60, BB.LAYOUT ? BB.LAYOUT.worldW - 60 : 3200)); BB.P.dir = b.dir || 1;
    R.startX = S._st.startX || BB.P.x; R.callGap = 10;
    ext('audio.init'); ext('audio.music', true, clamp(1 - S.time / S.total, 0, 1));
    say('Так, на чём я остановился…', { who: 'bamboul', dur: 2.4 }); log('continue');
    BB.emit && BB.emit('story:start', { total: S.total, cont: true });
    return true;
  }

  /* ======================================================= PAUSE / RESTART */
  function pause() {
    const S = SS(); if (!S || S.mode !== 'play' || BB.paused) return;
    BB.paused = true; if (BB.In && BB.In.reset) BB.In.reset();
    ext('audio.loop', 'phoneRing', false); save();
  }
  function resume() {
    BB.paused = false; R.doorAsk = false;
    const S = SS(); if (S && S.mode === 'play' && !R.talk) BB.player.lock(false);
    if (R.ring) ext('audio.loop', 'phoneRing', true, { x: phoneX() });
  }
  function restart() { const S = SS(); return start((S && S.total) || CFG.defaultTotal); }
  function toTitle() {
    const S = SS(); if (S && S.mode === 'play') save();
    resetRun();
    BB.S = Object.assign({}, BB.DEFAULT_S, { f: {}, items: [], stains: [], dust: [], tools: {}, mode: 'menu' });
    ext('audio.music', false);
    if (!ext('ui.showMenu', 'title').ok) log('title-no-ui');
  }

  /* ------------------------------------------------------------------ events */
  if (BB.on) {
    BB.on('task:done', () => { const S = SS(); if (S && S.mode === 'play') { R.saveT = Math.max(R.saveT, CFG.autosave - .5); } });
    BB.on('mini:done', () => { R.saveT = Math.max(R.saveT, CFG.autosave - .5); });
  }

  /* ---------------------------------------------------------------- export */
  if (BB.story && BB.story._hook) { const i = BB.hooks.update.indexOf(BB.story._hook); if (i >= 0) BB.hooks.update.splice(i, 1); }
  BB.hooks.update.push(update);
  BB.story = {
    CFG, CALLS, ENDINGS, TOPICS, _hook: update,
    start, restart, toTitle, continue: continueRun, hasSave, save, pause, resume,
    phone, callDan, askDoor, ending, progress, findings,
    answer: () => answerRing('api'), decline: declineRing,
    event(name, data) { log('event:' + name, data); if (name === 'taskDone') R.saveT = Math.max(R.saveT, CFG.autosave - .5); },
    addTime, topTodo,
    danCooldown() { const S = SS(); return { left: Math.max(0, (S && S._st && S._st.danCd) || 0), max: CFG.danCooldown }; },
    skip() { if (R.end) R.end.fast = true; },
    get lastDelta() { return R.lastDelta; },
    get ringing() { return R.ring ? R.ring.c.id : null; },
    get talking() { return dialogOpen(); },
    get phase() { return R.end ? R.end.phase : (R.intro ? 'intro:' + R.intro.phase : (SS() ? SS().mode : null)); },
    // test / debug handles
    debug: { get R() { return R; }, errs, log: logEv, timeRate }
  };
  BB.story.lastResult = null;
})();
