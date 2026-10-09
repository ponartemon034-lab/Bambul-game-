/* ==========================================================================
   BB.tasks - world tasks & cleaning mechanics (owner: gameplay agent).
   Owns BB.newState, items / stains / dust, tools, hold-F cleaning loop,
   scoring, checklist, save helpers.  Everything in BB.S is JSON-serialisable;
   all caches live in module scope.  Fields are documented in docs/STATE.md.
   Every call into another module (dlg/ui/audio/mini/story/props) is guarded.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const U = BB.U || { clamp: (v, a, b) => v < a ? a : v > b ? b : v, srand: s => () => (s = (s * 16807) % 2147483647) / 2147483647 };
  const clamp = U.clamp;

  /* ------------------------------------------------------------------ tuning */
  const CFG = {
    handCap: 5,            // loose pieces of trash carried at once (the bag in hand)
    standCap: 12,          // pieces the hall bag stand holds before the bag must be hauled out
    clothCap: 4,
    cost: { boxes: 8, sofa: 10, pc: 9, tvOn: 5, tvOff: 2 },      // seconds of S.time
    dwell: { vac: 0.55, mop: 0.75 },     // seconds a 20 cm segment needs to be covered
    reach: 26,             // half-width of the tool footprint (cm)
    useSlow: 0.42,         // walk speed multiplier while a tool is running
    jamAt: [3, 7],         // vacuum cord snags after this many patches are finished
    leak: { every: 38, max: 3, grow: 1.1 },   // seconds between new puddles / max puddles / cm per sec growth
    wetSlipCost: 2, toolIdleRevert: 5
  };

  /* ------------------------------------------------------------ world layout */
  // [roomRelX, z] ; stains [relX, z, w, kind] ; dust [relX, z, w].  Nothing inside +-45 cm of a partition, nothing under the hall boxes.
  const PLAN = {
    hall:    { trash: [[140, 20], [230, -10], [300, 35], [450, 15], [515, -8]], cloth: [[290, 28]],
               stains: [[120, 8, 70, 'grime'], [505, 20, 60, 'grime']], dust: [[165, 10, 90], [300, 30, 100], [480, 0, 110]] },
    living:  { trash: [[150, 50], [250, 54], [335, 10], [405, 30], [500, -12], [585, 22], [720, 8]], cloth: [[70, 20], [120, 40], [560, 12]],
               stains: [[300, 20, 80, 'grime'], [455, 30, 90, 'grime'], [650, 10, 70, 'grime']], dust: [[180, 25, 100], [330, 0, 90], [540, 20, 110], [760, 12, 100]] },
    kitchen: { trash: [[120, 18], [185, -6], [330, 28], [400, 8], [470, 34], [555, -10]], cloth: [[300, 22]],
               stains: [[250, 15, 80, 'grime'], [415, 20, 70, 'grime'], [530, 30, 60, 'grime']], dust: [] },
    bath:    { trash: [[100, 12], [205, -8], [330, 26], [490, 30]], cloth: [[110, 30], [330, 5]],
               stains: [[170, 18, 60, 'grime'], [250, 12, 70, 'water', 1], [395, 25, 80, 'grime'], [505, 28, 55, 'grime']], dust: [] },
    work:    { trash: [[70, 18], [150, -10], [300, 34], [360, 0], [480, 24], [620, 10]], cloth: [[540, 26]],
               stains: [[150, 20, 60, 'grime'], [470, 12, 80, 'grime']], dust: [[190, 14, 90], [340, 28, 100], [610, 6, 100]] }
  };
  const ROOM_ORDER = ['hall', 'living', 'kitchen', 'bath', 'work'];
  const ROOM_RU = { hall: 'Прихожая', living: 'Гостиная', kitchen: 'Кухня', bath: 'Ванная', work: 'Мастерская' };
  const pad2 = n => (n < 10 ? '0' : '') + n;

  function segCount(w) { return clamp(Math.ceil(w / 22), 3, 8); }

  /* ------------------------------------------------------------- newState */
  BB.newState = function (total) {
    total = total > 0 ? +total : 480;
    const items = [], stains = [], dust = [];
    let ti = 0, ci = 0, si = 0, di = 0;
    for (const rid of ROOM_ORDER) {
      const P = PLAN[rid];
      for (const [x, z] of P.trash) { items.push({ id: 't' + pad2(++ti), kind: 'trash', v: (ti * 7 + 2) % 16, room: rid, ax: BB.abs(rid, x), z, taken: 0 }); }
      for (const [x, z] of P.cloth) { items.push({ id: 'c' + pad2(++ci), kind: 'cloth', v: (ci * 2 + 1) % 5, room: rid, ax: BB.abs(rid, x), z, taken: 0 }); }
      for (const a of P.stains) {
        const w = a[2], leak = !!a[4];
        stains.push({ id: 's' + pad2(++si), room: rid, ax: BB.abs(rid, a[0]), z: a[1], w, wmax: leak ? 140 : w, p: 1, kind: a[3], leak: leak ? 1 : 0, wet: 0, seed: si * 37 + 11, seg: new Array(segCount(leak ? 140 : w)).fill(0) });
      }
      for (const a of P.dust) dust.push({ id: 'd' + pad2(++di), room: rid, ax: BB.abs(rid, a[0]), z: a[1], w: a[2], p: 1, seed: di * 53 + 5, seg: new Array(segCount(a[2])).fill(0) });
    }
    const nT = items.filter(i => i.kind === 'trash').length, nC = items.filter(i => i.kind === 'cloth').length;
    return {
      v: 1, mode: 'play', total, time: total, lazy: 0, slow: 1, slowExt: 1, slowTask: 1,
      f: {
        lightHall: 0, tvOn: 0, doorOpen: 0, phoneRing: 0, phoneUp: 0, boxesCleared: 0, closetOpen: 0, closetStash: 0,
        fridgeOpen: 0, fridgeDone: 0, fridgeStage: 0, fridgeRot: 6, dishesDone: 0, binFill: 0, bagFill: 0,
        washerOn: 0, mirrorDone: 0, faucetOn: 1, faucetHowl: 1, faucetFixed: 0, faucetStage: 0,
        toiletClean: 0, flushFixed: 0, toiletFlush: 0, printerError: 1, printerStage: 0, printerFixed: 0, printerPrinting: 0,
        vacJam: 0, vacN: 0, vacJamN: 0, vacOn: 0, mopOn: 0, lampFlicker: 0, wetSlips: 0, mopN: 0
      },
      tools: { vac: 0, mop: 0, box: 0 }, active: 'hand',
      items, stains, dust,
      carry: { trash: 0, cloth: 0, haul: 0 },
      bag: { n: 0, cap: CFG.standCap, out: 0 }, bin: { n: 0, cap: nT }, wash: { n: 0, t: 0 },
      count: { trash: nT, cloth: nC },
      leak: { t: 0, every: CFG.leak.every, spawned: 1, max: CFG.leak.max },
      calls: {}, done: {}, stats: { pickups: 0, hauls: 0, cleaned: 0, penalty: 0 }
    };
  };

  /* ----------------------------------------------------------- local runtime */
  const L = {
    S: null, now: 0, said: {}, using: null, useT: 0, sfxT: 0, vacLoop: false, howlOn: null, idleT: 0, checkT: 0, lastScore: -1,
    cd: {}, items: null, hs: {}, hsOut: [], spr: {}, jamPending: 0, lastHeldSet: null, propsDead: false, warned: {}, tut: {}, doneInit: false, guard: 0
  };
  const P = () => BB.P || { x: 0, y: 0, vx: 0 };
  const warnOnce = (k, msg) => { if (!L.warned[k]) { L.warned[k] = 1; console.warn('[tasks] ' + msg); } };

  /* guarded helpers to other modules ------------------------------------------------ */
  const FB = {
    garbage: ['Мусор. Опять мусор.', 'Это не мусор, это слои моей личности.', 'Ещё один фантик — и я герой труда.'],
    vacuum: ['Пыль исчезает. Смысл жизни — нет.', 'Ненавижу пылесос.'],
    mop: ['Это пятно старше некоторых государств.', 'Пол мыть? Я что, клининг?'],
    tools: ['Мне нужен ящик с инструментами. Он в мастерской.', 'Без инструмента тут делать нечего.'],
    sofa: ['Я не ленивый. Я в режиме энергосбережения.'], tv: ['Одну серию. Ну максимум две.'], pc: ['Пять минут. Ага.'],
    idle: ['Тут ничего.', 'Нечего здесь делать.'], success: ['Готово!'], failure: ['Блин.'],
    fridge: ['Оно там живое.'], faucet: ['Кран воет, как моя совесть.'], toilet: ['Не смотри, не смотри.'], printer: ['Принтер. Опять он.'], door: ['Дверь.']
  };
  function say(cat, ctx, cd, force) {
    const key = cat + (ctx && ctx.k ? ctx.k : ''), c = cd == null ? 3 : cd;
    if (!force && L.said[key] != null && L.now - L.said[key] < c) return false;
    L.said[key] = L.now;
    if (BB.dlg && BB.dlg.bark) { try { BB.dlg.bark(cat, ctx || {}, force ? { force: true } : undefined); return true; } catch (e) { console.error('[tasks.bark]', e); } }
    const a = FB[cat]; if (a && BB.ui && BB.ui.say) { try { BB.ui.say(a[Math.random() * a.length | 0], { who: 'bamboul', dur: 2.4 }); } catch (e) { } }
    return true;
  }
  const toast = t => { if (BB.ui && BB.ui.toast) { try { BB.ui.toast(t); } catch (e) { } } };
  const sfx = (n, o) => { if (BB.audio && BB.audio.sfx) { try { BB.audio.sfx(n, o); } catch (e) { } } };
  const act = (type, dur, cb) => { if (BB.player && BB.player.doAct) BB.player.doAct(type, dur, cb); else setTimeout(() => cb && cb(), dur * 1000); };
  const faceTo = x => { if (BB.player && BB.player.face) BB.player.face(x); };
  const mood = (m, d) => { if (BB.player && BB.player.mood) BB.player.mood(m, d); };
  function addTime(S, sec, why) {
    if (!sec) return; S.time = Math.max(0, S.time - sec); S.stats = S.stats || {}; S.stats.penalty = (S.stats.penalty || 0) + sec;
    if (why) BB.emit('time:cost', { sec, why });
  }
  function cooling(id, sec) { const t = L.cd[id]; if (t != null && L.now - t < sec) return true; L.cd[id] = L.now; return false; }

  /* item index ---------------------------------------------------------------------- */
  function idx(S) { if (L.S !== S || !L.items || L.items.size !== S.items.length) { L.items = new Map(); for (const it of S.items) L.items.set(it.id, it); L.S = S; } return L.items; }
  const hasTool = (S, k) => !!(S.tools && S.tools[k]);

  /* ---------------------------------------------------------------- sprites */
  function norm(r) {
    if (!r) return null;
    if (r.img && (r.w || r.img.cmW)) return { img: r.img, w: r.w || r.img.cmW, h: r.h || r.img.cmH };
    if (r.getContext) { const B = r.B || 2; return { img: r, w: r.cmW || r.width / B, h: r.cmH || r.height / B }; }
    return null;
  }
  const PAL = ['#8a6a3a', '#3f7a4a', '#a33a2a', '#c9b24a', '#4a6ea8', '#7d7d86', '#b5733a', '#5a8a8a'];
  function fallbackSprite(kind, v) {
    const col = PAL[v % PAL.length];
    if (kind === 'cloth') {
      const w = 30, h = 12;
      const c = BB.bake(w, h, (g) => { g.fillStyle = col; g.beginPath(); g.moveTo(2, h); g.quadraticCurveTo(4, 2, 14, 4); g.quadraticCurveTo(24, 0, 28, h); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(8, 5, 10, 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(2, h - 2, 26, 2); }, { B: 2 });
      return { img: c, w, h, fb: 1 };
    }
    const shape = v % 4, w = shape === 2 ? 30 : 14, h = shape === 2 ? 6 : shape === 1 ? 12 : 14;
    const c = BB.bake(w, h, (g) => {
      g.fillStyle = col;
      if (shape === 0) { g.fillRect(2, 3, 10, h - 3); g.fillStyle = '#ddd'; g.fillRect(2, 1.5, 10, 2); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(3, 4, 2, h - 6); }
      else if (shape === 1) { g.beginPath(); g.ellipse(7, 7, 6, 5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(9, 8, 3, 2.5, 0, 0, 7); g.fill(); }
      else if (shape === 2) { g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 1.4, w, 1.4); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, w, 1); }
      else { g.beginPath(); g.moveTo(1, 9); g.lineTo(4, 2); g.lineTo(10, 4); g.lineTo(13, 10); g.lineTo(7, 13); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(4, 5, 4, 1.5); }
    }, { B: 2 });
    return { img: c, w, h, fb: 1 };
  }
  const sprCache = {};
  function propSprite(kind, v) {
    const hp = !!(BB.props && !L.propsDead), key = kind + ':' + v + ':' + (hp ? 1 : 0);
    if (sprCache[key]) return sprCache[key];
    let r = null;
    if (hp) { try { r = norm(BB.props.get ? BB.props.get(kind, v) : null) || norm(BB.props[kind] ? BB.props[kind](v) : null); } catch (e) { console.warn('[tasks] props sprite failed', e); } }
    return sprCache[key] = r || fallbackSprite(kind, v);
  }

  /* ----------------------------------------------------------------- progress */
  const frac = (a, n) => n > 0 ? clamp(a / n, 0, 1) : 1;
  function progress(S) {
    S = S || BB.S; if (!S || !S.items || !S.bag || !S.bin || !S.wash) return { score: 0, parts: [], done: 0, total: 11 };
    const f = S.f, c = S.count || { trash: 1, cloth: 1 };
    const gT = (S.bag.n + S.bin.n + .6 * Math.min(4, S.f.closetStash || 0)), garb = frac(gT, c.trash), cloth = frac(S.wash.n, c.cloth);
    let sSum = 0; for (const s of S.stains) sSum += 1 - clamp(s.p, 0, 1); const stain = S.stains.length ? sSum / S.stains.length : 1;
    let dSum = 0; for (const d of S.dust) dSum += 1 - clamp(d.p, 0, 1); const dust = S.dust.length ? dSum / S.dust.length : 1;
    const nStain = S.stains.filter(s => s.p <= 0.001).length;
    const fr = f.fridgeDone ? 1 : clamp((6 - (f.fridgeRot == null ? 6 : f.fridgeRot)) / 6, 0, 1) * 0.6;
    const fa = f.faucetFixed ? 1 : clamp((f.faucetStage || 0) / 4, 0, 1) * 0.8;
    const pr = f.printerFixed ? 1 : clamp((f.printerStage || 0) / 4, 0, 1) * 0.8;
    const toi = ((clamp(f.toiletClean || 0, 0, 1)) + (f.flushFixed ? 1 : 0)) / 2;
    const mk = (id, label, p, weight, text, room) => ({ id, label, p: clamp(p, 0, 1), weight, text, room });
    const parts = [
      mk('garbage', 'Мусор в мешках и баке', garb, 20, gT + '/' + c.trash, 'all'),
      mk('clothes', 'Шмотки в стирку', cloth, 6, S.wash.n + '/' + c.cloth, 'bath'),
      mk('stains', 'Пятна и лужи', stain, 14, nStain + '/' + S.stains.length, 'all'),
      mk('dust', 'Пыль', dust, 10, Math.round(dust * 100) + '%', 'all'),
      mk('boxes', 'Завал из коробок', f.boxesCleared ? 1 : 0, 4, f.boxesCleared ? 'разобран' : 'завал', 'hall'),
      mk('dishes', 'Посуда', f.dishesDone ? 1 : 0, 8, f.dishesDone ? 'вымыта' : 'гора', 'kitchen'),
      mk('fridge', 'Холодильник', fr, 10, f.fridgeDone ? 'чистый' : 'вонь', 'kitchen'),
      mk('faucet', 'Кран в ванной', fa, 10, f.faucetFixed ? 'не течёт' : 'воет', 'bath'),
      mk('toilet', 'Унитаз и смыв', toi, 10, (f.toiletClean >= 1 ? 'чист' : 'грязный') + ', ' + (f.flushFixed ? 'смыв работает' : 'смыв сломан'), 'bath'),
      mk('printer', '3D-принтер', pr, 6, f.printerFixed ? 'печатает' : 'в ошибке', 'work'),
      mk('mirror', 'Зеркало', f.mirrorDone ? 1 : 0, 2, f.mirrorDone ? 'блестит' : 'мутное', 'bath')
    ];
    let sc = 0, done = 0; for (const p of parts) { sc += p.p * p.weight; if (p.p >= 0.999) done++; }
    return { score: Math.round(sc * 10) / 10 > 99.5 && done < parts.length ? 99 : Math.round(sc), parts, done, total: parts.length };
  }
  const WHERE = {
    garbage: 'везде; мешок в прихожей, бак на кухне', clothes: 'по комнатам → стиралка в ванной', stains: 'пятна на полу (швабра в ванной), лужа у крана',
    dust: 'прихожая, гостиная, мастерская (пылесос в шкафу в прихожей)', boxes: 'прихожая у мешка', dishes: 'кухня, раковина', fridge: 'кухня, слева',
    faucet: 'ванная, раковина (ящик в мастерской)', toilet: 'ванная, справа (ящик в мастерской)', printer: 'мастерская (ящик в мастерской)', mirror: 'ванная, над раковиной'
  };
  function hintFor(S, p) {
    const f = S.f, id = p.id;
    switch (id) {
      case 'garbage': if (S.carry.haul > 0) return 'Полный мешок — неси в бак на кухне'; if (S.carry.trash >= CFG.handCap) return 'Руки полны — вынеси в мешок/бак'; return 'Подбирай мусор (E) и неси в мешок в прихожей или бак на кухне';
      case 'clothes': return S.carry.cloth ? 'Неси шмотки в стиралку (ванная)' : 'Подбирай шмотки (E) → стиралка';
      case 'stains': return hasTool(S, 'mop') ? 'Держи F на пятне и води шваброй' : 'Швабра в ванной (E)';
      case 'dust': return hasTool(S, 'vac') ? 'Держи F на пыли и води пылесосом' : 'Пылесос в шкафу в прихожей (E)';
      case 'faucet': case 'toilet': case 'printer': return hasTool(S, 'box') ? WHERE[id] : 'Сначала ящик с инструментами (мастерская)';
      default: return WHERE[id];
    }
  }
  function checklist(S) {
    S = S || BB.S; const pr = progress(S);
    return pr.parts.map(p => ({ id: p.id, label: p.label, p: p.p, done: p.p >= 0.999, weight: p.weight, text: p.text, room: p.room, where: WHERE[p.id], hint: p.p >= 0.999 ? 'Готово' : hintFor(S, p) }));
  }

  /* -------------------------------------------------------------- consistency */
  function repair(S) {
    const f = S.f, clampI = (v, a, b) => Math.round(clamp(+v || 0, a, b));
    S.time = clamp(+S.time || 0, 0, 1e6); S.lazy = Math.max(0, S.lazy | 0);
    for (const k in f) if (typeof f[k] === 'number' && !isFinite(f[k])) f[k] = 0;
    const cT = S.count.trash, cC = S.count.cloth;
    // items
    const taken = { trash: 0, cloth: 0 };
    for (const it of S.items) { it.taken = it.taken ? 1 : 0; if (it.taken) taken[it.kind]++; }
    S.carry.trash = clampI(S.carry.trash, 0, CFG.handCap); S.carry.cloth = clampI(S.carry.cloth, 0, CFG.clothCap);
    S.carry.haul = clampI(S.carry.haul, 0, CFG.standCap);
    S.bag.cap = CFG.standCap; S.bag.n = clampI(S.bag.n, 0, S.bag.cap); S.bin.cap = cT; S.bin.n = clampI(S.bin.n, 0, cT);
    S.wash.n = clampI(S.wash.n, 0, cC);
    // trash conservation: taken = hand + hauled + stand + bin
    let have = S.carry.trash + S.carry.haul + S.bag.n + S.bin.n;
    if (have > taken.trash) {                                // too many pieces: mark nearest untaken items as taken
      const need = have - taken.trash; let k = 0;
      for (const it of S.items) if (it.kind === 'trash' && !it.taken && k < need) { it.taken = 1; k++; taken.trash++; }
      have = S.carry.trash + S.carry.haul + S.bag.n + S.bin.n;
      if (have > taken.trash) { let ex = have - taken.trash; const cut = (o, key) => { const d = Math.min(ex, o[key]); o[key] -= d; ex -= d; }; cut(S.bin, 'n'); cut(S.bag, 'n'); cut(S.carry, 'haul'); cut(S.carry, 'trash'); }
    } else if (have < taken.trash) { S.bin.n = Math.min(cT, S.bin.n + (taken.trash - have)); have = S.carry.trash + S.carry.haul + S.bag.n + S.bin.n; if (have < taken.trash) { let d = taken.trash - have; for (const it of S.items) if (it.kind === 'trash' && it.taken && d > 0) { it.taken = 0; d--; } } }
    let hc = S.carry.cloth + S.wash.n;
    if (hc > taken.cloth) { let k = hc - taken.cloth; for (const it of S.items) if (it.kind === 'cloth' && !it.taken && k > 0) { it.taken = 1; k--; } }
    else if (hc < taken.cloth) { S.wash.n = Math.min(cC, S.wash.n + taken.cloth - hc); hc = S.carry.cloth + S.wash.n; if (hc < taken.cloth) { let d = taken.cloth - hc; for (const it of S.items) if (it.kind === 'cloth' && it.taken && d > 0) { it.taken = 0; d--; } } }
    // stains & dust
    for (const o of S.stains.concat(S.dust)) {
      const n = o.seg ? o.seg.length : segCount(o.wmax || o.w); if (!o.seg) o.seg = new Array(n).fill(1 - clamp(o.p, 0, 1));
      for (let i = 0; i < o.seg.length; i++) o.seg[i] = clamp(+o.seg[i] || 0, 0, 1);
      let m = 0; for (const v of o.seg) m += v; o.p = clamp(1 - m / o.seg.length, 0, 1); if (o.p < .02) { o.p = 0; o.seg.fill(1); }
      o.w = clamp(+o.w || 60, 20, 200); o.wet = clamp(+o.wet || 0, 0, 1);
    }
    // derived flags
    f.bagFill = S.bag.n <= 0 ? 0 : clampI(Math.ceil(5 * S.bag.n / S.bag.cap), 1, 5);
    f.binFill = S.bin.n <= 0 ? 0 : clampI(Math.ceil(5 * S.bin.n / Math.max(1, S.bin.cap)), 1, 5);
    S.slowExt = S.slowExt > 0 ? S.slowExt : 1;
    if (f.fridgeDone) { f.fridgeOpen = 0; f.fridgeRot = 0; f.fridgeStage = Math.max(f.fridgeStage | 0, 4); }
    if (f.faucetFixed) { f.faucetHowl = 0; f.faucetOn = 1; f.faucetStage = 4; }
    if (!f.faucetFixed) { f.faucetOn = 1; }
    f.toiletClean = clamp(+f.toiletClean || 0, 0, 1);
    if (f.printerFixed) { f.printerError = 0; f.printerPrinting = f.printerPrinting ? 1 : 0; f.printerStage = 4; }
    f.printerStage = clampI(f.printerStage, 0, 4); f.faucetStage = clampI(f.faucetStage, 0, 4); f.fridgeRot = clampI(f.fridgeRot, 0, 6);
    if (S.tools.vac) f.closetOpen = 1;
    if (!S.tools[S.active] && S.active !== 'hand') S.active = 'hand';
    if (S.active !== 'hand' && !S.tools[S.active]) S.active = 'hand';
    f.vacOn = 0; f.mopOn = 0; f.vacJam = f.vacJam ? 1 : 0;
    if (S.leak) { S.leak.spawned = clampI(S.leak.spawned, 0, S.leak.max); }
    // done-set follows the real state (no re-announcing on load)
    const pr = progress(S); S.done = {}; for (const p of pr.parts) if (p.p >= 0.999) S.done[p.id] = 1;
    return S;
  }
  const strip = (k, v) => (k[0] === '_' ? undefined : v);
  function serialize(S) { S = S || BB.S; return JSON.parse(JSON.stringify(S, strip)); }
  function restore(obj) {
    const base = BB.newState(obj && obj.total || 480), o = obj || {};
    const S = base;
    for (const k of ['mode', 'total', 'time', 'lazy', 'active', 'slowExt']) if (o[k] != null) S[k] = o[k];
    if (o.mode === 'ending' || o.mode === 'menu') S.mode = 'play';
    for (const k in (o.f || {})) if (k in S.f || typeof o.f[k] === 'number') S.f[k] = +o.f[k] || 0;
    for (const k in (o.tools || {})) if (k in S.tools) S.tools[k] = o.tools[k] ? 1 : 0;
    const byId = {}; for (const it of (o.items || [])) byId[it.id] = it;
    for (const it of S.items) if (byId[it.id]) it.taken = byId[it.id].taken ? 1 : 0;
    const mergeList = (list, src) => { const m = {}; for (const a of (src || [])) m[a.id] = a; for (const a of list) { const b = m[a.id]; if (b) { a.p = +b.p; a.seg = Array.isArray(b.seg) ? b.seg.slice(0, a.seg.length) : a.seg; while (a.seg.length < segCount(a.wmax || a.w)) a.seg.push(0); if (b.w) a.w = +b.w; a.wet = +b.wet || 0; } } };
    mergeList(S.dust, o.dust); mergeList(S.stains, o.stains);
    // leak puddles that were spawned after the start
    for (const b of (o.stains || [])) if (b.leak && !S.stains.some(s => s.id === b.id)) S.stains.push(Object.assign({}, b));
    for (const k of ['carry', 'bag', 'bin', 'wash', 'leak', 'stats']) if (o[k]) Object.assign(S[k], o[k]);
    if (o.calls) S.calls = JSON.parse(JSON.stringify(o.calls));
    for (const k in o) if (!(k in S) && k[0] !== '_' && typeof o[k] !== 'function') S[k] = o[k];     // keep fields other agents add
    return repair(S);
  }

  /* ------------------------------------------------------------- hotspot logic */
  const NEED_BOX = ' (нужен ящик с инструментами)';
  function canCarryMore(S, kind) { return kind === 'trash' ? S.carry.trash < CFG.handCap : S.carry.cloth < CFG.clothCap; }
  function prompt(h, S) {
    S = S || BB.S; if (!S || !S.items || !h) return null;
    const id = h.id, f = S.f;
    if (id.charCodeAt(0) === 105 && id.startsWith('item:')) {
      const it = idx(S).get(id.slice(5)); if (!it || it.taken) return null;
      if (!canCarryMore(S, it.kind)) return it.kind === 'trash' ? 'Мешок полон — неси в бак' : 'Руки полны — неси в стиралку';
      return it.kind === 'trash' ? 'Подобрать мусор' : 'Подобрать шмотку';
    }
    switch (id) {
      case 'frontDoor': return 'Открыть хозяину';
      case 'switchHall': return f.lightHall ? 'Выключить свет' : 'Включить свет';
      case 'phone': return f.phoneRing ? 'Снять трубку' : f.phoneUp ? 'Положить трубку' : 'Телефон';
      case 'boxes': return f.boxesCleared ? null : 'Разобрать завал (или перепрыгни)';
      case 'bagStand':
        if (S.carry.haul > 0) return 'Мешок уже у тебя — неси на кухню';
        if (S.bag.n >= S.bag.cap) return 'Взять полный мешок';
        return S.carry.trash > 0 ? 'Закинуть мусор в мешок (' + S.carry.trash + ')' : null;
      case 'bin': return S.carry.haul > 0 ? 'Выкинуть мешок в бак' : S.carry.trash > 0 ? 'Выкинуть мусор в бак (' + S.carry.trash + ')' : null;
      case 'closet': return !S.tools.vac ? 'Достать пылесос' : (S.carry.trash > 0 ? 'Затолкать мусор в шкаф (с глаз долой)' : null);
      case 'mopStand': return S.tools.mop ? null : 'Взять швабру';
      case 'toolbox': return S.tools.box ? null : 'Взять ящик с инструментами';
      case 'washer': return S.carry.cloth > 0 ? 'Закинуть шмотки в стиралку (' + S.carry.cloth + ')' : null;
      case 'sofa': return 'Полежать на диване';
      case 'tv': return f.tvOn ? 'Выключить телик' : 'Включить телик';
      case 'pc': return 'Залипнуть в компе';
      case 'stove': return 'Осмотреть плиту';
      case 'laundry': return 'Посмотреть на гору шмоток';
      case 'tub': return 'Заглянуть в ванну';
      case 'window': return 'Выглянуть в окно';
      case 'fridge': return f.fridgeDone ? null : (f.fridgeStage > 0 ? 'Продолжить разбор холодильника' : 'Открыть холодильник');
      case 'dishes': return f.dishesDone ? null : 'Помыть посуду';
      case 'faucet':
        if (!f.faucetFixed) return 'Починить кран' + (S.tools.box ? '' : NEED_BOX);
        if (!f.mirrorDone && !BB.world.hot('mirror')) return 'Протереть зеркало';
        return null;
      case 'mirror': return f.mirrorDone ? null : 'Протереть зеркало';
      case 'toilet': return (f.toiletClean >= 1 && f.flushFixed) ? null : 'Починить смыв и отдраить унитаз' + (S.tools.box ? '' : NEED_BOX);
      case 'printer': return f.printerFixed ? null : 'Чинить принтер' + (S.tools.box ? '' : NEED_BOX);
      case 'vacJam': return f.vacJam ? 'Выдернуть носок из пылесоса' : null;
      default: return h.label || null;
    }
  }

  /* --------------------------------------------------------------- mini games */
  const DONE = {
    fridge: f => { f.fridgeDone = 1; f.fridgeOpen = 0; f.fridgeRot = 0; f.fridgeStage = 4; },
    dishes: f => { f.dishesDone = 1; },
    faucet: f => { f.faucetFixed = 1; f.faucetHowl = 0; f.faucetOn = 1; f.faucetStage = 4; },
    toilet: f => { f.toiletClean = 1; f.flushFixed = 1; },
    printer: f => { f.printerFixed = 1; f.printerError = 0; f.printerStage = 4; },
    mirror: f => { f.mirrorDone = 1; },
    vacJam: f => { f.vacJam = 0; f.vacJamN = (f.vacJamN | 0) + 1; }
  };
  const MINI_ANIM = { fridge: 'openFridge', dishes: 'inspect', faucet: 'inspectLow', toilet: 'inspect', printer: 'inspect', mirror: 'inspect', vacJam: 'pickup' };
  const MINI_FALLBACK = { fridge: [4.5, 'scrubFridge', 12], dishes: [4, 'scrub', 10], faucet: [4, 'repair', 10], toilet: [4.5, 'scrubToilet', 10], printer: [5, 'tinker', 12], mirror: [2.5, 'scrub', 4], vacJam: [1.2, 'pickup', 1] };
  let miniBusy = 0;
  function finishMini(id, S, res) {
    miniBusy = 0; if (BB.S !== S) return;
    res = res || {};
    if (res.timeCost) addTime(S, res.timeCost, id);
    if (res.win) {
      if (!DONE[id]) return; DONE[id](S.f);
      sfx('taskDone'); say(id === 'vacJam' ? 'vacuum' : id, { done: 1, k: 'd' }, 1, true);
    } else say(id === 'vacJam' ? 'vacuum' : id, { fail: 1, k: 'f' }, 4);
    check(S, true);
  }
  function startMini(id, S, needBox) {
    if (miniBusy && L.now - miniBusy < 1) return; miniBusy = L.now;
    if (needBox && !S.tools.box) {
      say('tools', { need: 'box', for: id, k: id }, 2.5, true); toast('Нужен ящик с инструментами — он в мастерской'); mood('inspect', 1.2); miniBusy = 0; return;
    }
    if (needBox) { S.active = 'box'; L.idleT = 0; }
    if (id === 'fridge') S.f.fridgeOpen = 1;
    act(MINI_ANIM[id] || 'inspect', 0.5, () => {
      if (BB.S !== S) return;
      let started = false;
      if (BB.mini && BB.mini.start) { try { started = !!BB.mini.start(id, S, r => finishMini(id, S, r)); } catch (e) { console.error('[tasks.mini]', id, e); } }
      if (!started) {                                 // fallback while minigames are not ready: a short timed job, still real state change
        warnOnce('mini', 'BB.mini missing - using timed fallback');
        const fb = MINI_FALLBACK[id] || [3, 'inspect', 8];
        act(fb[1], fb[0], () => finishMini(id, S, { win: true, timeCost: fb[2] }));
      }
    });
  }

  /* ----------------------------------------------------------------- interact */
  function pickItem(S, it) {
    if (!canCarryMore(S, it.kind)) {
      if (it.kind === 'trash') { sfx('bagFull'); say('garbage', { bagFull: 1, k: 'bf' }, 3, true); toast('Мешок полон (' + CFG.handCap + '/' + CFG.handCap + ') — неси в мешок в прихожей или в бак на кухне'); }
      else { say('garbage', { clothesFull: 1, k: 'cf' }, 3); toast('Руки полны шмоток — неси в стиралку'); }
      mood('tired', 1.1); return;
    }
    faceTo(it.ax);
    act('pickup', 0.45, () => {
      if (BB.S !== S || it.taken || !canCarryMore(S, it.kind)) return;
      it.taken = 1; S.stats.pickups++;
      if (it.kind === 'trash') { S.carry.trash++; sfx('pickup'); if (S.carry.trash === CFG.handCap) { sfx('bagFull'); say('garbage', { bagFull: 1, k: 'bf' }, 3, true); } else say('garbage', { pickup: S.carry.trash, k: 'p' }, 7); }
      else { S.carry.cloth++; sfx('pickup'); say('garbage', { clothes: 1, k: 'c' }, 9); }
      check(S);
    });
  }
  function syncFill(S) {
    const f = S.f; f.bagFill = S.bag.n <= 0 ? 0 : clamp(Math.ceil(5 * S.bag.n / S.bag.cap), 1, 5);
    f.binFill = S.bin.n <= 0 ? 0 : clamp(Math.ceil(5 * S.bin.n / Math.max(1, S.bin.cap)), 1, 5);
  }
  function takeTool(S, key, openFlag) {
    act(openFlag ? 'open' : 'pickup', openFlag ? 0.6 : 0.5, () => {
      if (BB.S !== S) return;
      if (openFlag) { S.f.closetOpen = 1; sfx('doorOpen'); }
      act('pickup', 0.5, () => {
        if (BB.S !== S) return;
        S.tools[key] = 1; S.active = key; L.idleT = 0; sfx('pickup'); if (key === 'mop') sfx('bucket');
        say('tools', { tool: key, k: key }, 1, true);
        if (key === 'vac') toast('Пылесос взят: держи F над пылью и води туда-сюда');
        if (key === 'mop') toast('Швабра взята: держи F над пятном и води туда-сюда');
        BB.emit('tool:get', { tool: key });
      });
    });
  }
  function interact(h, S) {
    S = S || BB.S; if (!S || !S.items || !h) return;
    const id = h.id, f = S.f, ax = h.ax != null ? h.ax : h.x;
    if (id.startsWith('item:')) { const it = idx(S).get(id.slice(5)); if (it && !it.taken) pickItem(S, it); return; }
    if (!prompt(h, S) && id !== 'faucet') { return nothingHere(); }
    const spam = (sec) => cooling('i:' + id, sec);
    switch (id) {
      case 'frontDoor': faceTo(ax); if (BB.story && BB.story.askDoor) BB.story.askDoor(); else { toast('Хозяина пока нет — не мешай дверь'); say('door', { k: 'd' }, 4); } break;
      case 'phone': faceTo(ax); if (BB.story && BB.story.phone) BB.story.phone(); else { toast('Телефон молчит'); say('idle', { phone: 1, k: 'ph' }, 4); } break;
      case 'switchHall': faceTo(ax); act('reach', 0.3, () => { if (BB.S !== S) return; f.lightHall = f.lightHall ? 0 : 1; sfx('button'); }); break;
      case 'boxes':
        faceTo(ax); say('garbage', { boxes: 1, k: 'bx' }, 2);
        act('haul', 1.8, () => { if (BB.S !== S) return; f.boxesCleared = 1; addTime(S, CFG.cost.boxes, 'boxes'); sfx('toss'); say('garbage', { boxesDone: 1, k: 'bxd' }, 1, true); check(S); });
        break;
      case 'bagStand': {
        faceTo(ax);
        if (S.carry.haul > 0) { say('garbage', { haulHint: 1, k: 'hh' }, 3); toast('Мешок уже в руках — неси в бак на кухне'); return; }
        if (S.bag.n >= S.bag.cap) {
          act('pickup', 0.6, () => { if (BB.S !== S) return; S.carry.haul = S.bag.n; S.bag.n = 0; S.bag.out++; syncFill(S); sfx('bag'); S.stats.hauls++; say('garbage', { haul: 1, k: 'hl' }, 2, true); toast('Полный мешок тяжёлый — неси в бак на кухне'); });
          return;
        }
        const room = S.bag.cap - S.bag.n, n = Math.min(room, S.carry.trash);
        act('putBag', 0.7, () => {
          if (BB.S !== S) return; S.carry.trash -= n; S.bag.n += n; syncFill(S); sfx('toss'); sfx('bag');
          if (S.bag.n >= S.bag.cap) { sfx('bagFull'); say('garbage', { standFull: 1, k: 'sf' }, 2, true); toast('Мешок на стойке полный — возьми его (E) и неси в бак на кухне'); }
          else say('garbage', { toss: n, k: 't' }, 5);
          check(S);
        });
        break;
      }
      case 'bin': {
        faceTo(ax);
        act('putBag', 0.7, () => {
          if (BB.S !== S) return; const n = S.carry.haul + S.carry.trash, can = Math.min(n, S.bin.cap - S.bin.n);
          S.bin.n += can; const fromH = Math.min(S.carry.haul, can); S.carry.haul -= fromH; S.carry.trash -= (can - fromH);
          syncFill(S); sfx('toss'); sfx('bagFull', { vol: .5 }); say('garbage', { toss: can, bin: 1, k: 't' }, 4, true); check(S);
        });
        break;
      }
      case 'closet': {
        faceTo(ax); if (!S.tools.vac) { takeTool(S, 'vac', true); break; }
        act('putBag', 0.7, () => {
          if (BB.S !== S || S.carry.trash <= 0) return; const n = S.carry.trash; S.carry.trash = 0; S.f.closetStash = (S.f.closetStash || 0) + n; sfx('toss'); sfx('doorOpen'); syncFill(S);
          if (S.f.closetStash >= 5) {              // the wardrobe cannot take any more: boom
            const k = S.f.closetStash; S.f.closetStash = 0; sfx('bad'); if (BB.cam) BB.cam.shake = 1; addTime(S, 8, 'closetBoom');
            for (let i = 0; i < k; i++) S.items.push({ id: 'x' + Math.floor(Math.random() * 1e6), kind: 'trash', v: (i * 5 + 3) % 16, room: 'hall', ax: BB.abs('hall', 470 + i * 14), z: -10 + (i % 3) * 22, taken: 0 });
            say('boom', { k: 'boom' }, 9, true); toast('Шкаф не выдержал! Весь мусор вывалился обратно, −8 сек');
          } else { say('stash', { k: 'stash' }, 6, true); toast('Мусор спрятан в шкафу: ' + S.f.closetStash + '/4. Хозяин туда лазить не будет... наверное'); }
          check(S);
        });
        break;
      }
      case 'mopStand': faceTo(ax); takeTool(S, 'mop', false); break;
      case 'toolbox': faceTo(ax); takeTool(S, 'box', false); break;
      case 'washer':
        faceTo(ax);
        act('open', 0.5, () => {
          if (BB.S !== S) return; const n = S.carry.cloth; S.wash.n = Math.min(S.count.cloth, S.wash.n + n); S.carry.cloth = 0; S.wash.t = 7; f.washerOn = 1; sfx('toss'); sfx('bucket');
          say('garbage', { clothesIn: n, k: 'ci' }, 3, true); check(S);
        });
        break;
      case 'sofa':
        if (spam(3)) return; faceTo(ax);
        act('sit', 2.6, () => { if (BB.S !== S) return; S.lazy++; addTime(S, CFG.cost.sofa, 'sofa'); sfx('sofa'); say('sofa', { lazy: S.lazy, k: 'so' }, 0, true); });
        break;
      case 'tv':
        faceTo(ax);
        act('open', 0.4, () => {
          if (BB.S !== S) return; f.tvOn = f.tvOn ? 0 : 1; sfx('button'); addTime(S, f.tvOn ? CFG.cost.tvOn : CFG.cost.tvOff, 'tv'); if (f.tvOn) S.lazy++;
          say('tv', { on: f.tvOn, lazy: S.lazy, k: 'tv' }, 0, true);
        });
        break;
      case 'pc':
        if (spam(3)) return; faceTo(ax);
        act('tinker', 1.4, () => { if (BB.S !== S) return; S.lazy++; addTime(S, CFG.cost.pc, 'pc'); say('pc', { lazy: S.lazy, k: 'pc' }, 0, true); mood('angry', 1.2); });
        break;
      case 'stove': faceTo(ax); mood('inspect', 1.6); say('idle', { stove: 1, k: 'st' }, 2, true); break;
      case 'laundry': faceTo(ax); mood('inspect', 1.4); say('idle', { laundry: 1, k: 'ln' }, 2, true); { const left = S.items.filter(i => i.kind === 'cloth' && !i.taken).length; toast(left ? 'Шмотки на полу ещё лежат: ' + left : 'Шмотки собраны'); } break;
      case 'tub': faceTo(ax); mood('inspect', 1.5); say('idle', { tub: 1, k: 'tb' }, 2, true); break;
      case 'window': faceTo(ax); mood('inspect', 1.5); say('idle', { window: 1, k: 'wn' }, 2, true); break;
      case 'fridge': faceTo(ax); startMini('fridge', S, false); break;
      case 'dishes': faceTo(ax); startMini('dishes', S, false); break;
      case 'faucet': faceTo(ax); if (!f.faucetFixed) startMini('faucet', S, true); else if (!f.mirrorDone) startMini('mirror', S, false); else nothingHere(); break;
      case 'mirror': faceTo(ax); startMini('mirror', S, false); break;
      case 'toilet': faceTo(ax); startMini('toilet', S, true); break;
      case 'printer': faceTo(ax); startMini('printer', S, true); break;
      case 'vacJam': startMini('vacJam', S, false); break;
      default: faceTo(ax); mood('inspect', 1); say('idle', { id, k: 'x' + id }, 3);
    }
  }
  const DONE_MSG = {
    boxes: 'Завал уже разобран', closet: 'Пылесос уже у тебя', mopStand: 'Швабра уже у тебя', toolbox: 'Ящик уже у тебя', fridge: 'Холодильник уже чистый',
    dishes: 'Посуда уже вымыта', faucet: 'С краном и зеркалом всё готово', toilet: 'Унитаз уже в порядке', printer: 'Принтер уже печатает', mirror: 'Зеркало уже блестит',
    bagStand: 'Нечего кидать в мешок', bin: 'Нечего выкидывать', washer: 'В стиралку нечего класть'
  };
  function nothingHere() {
    const S = BB.S; if (!S || !S.items) return;
    if (cooling('nothing', 1.2)) return;
    const px = P().x; let best = null, bd = 1e9;
    for (const h of (BB.world && BB.world.hotspots || [])) { const d = Math.abs(h.ax - px); if (d < h.r && d < bd) { bd = d; best = h; } }
    if (best && DONE_MSG[best.id]) {
      toast(DONE_MSG[best.id]);
      if (best.id === 'bagStand' || best.id === 'bin' || best.id === 'washer') say('garbage', { nothing: 1, k: 'nt' }, 4);
      else say('success', { already: best.id, k: 'al' }, 5);
    } else if (best) say('idle', { id: best.id, k: 'nh' }, 3);
    else say('idle', { nothing: 1, k: 'no' }, 4);
  }

  /* --------------------------------------------------------- cleaning (hold F) */
  function findTarget(S) {
    const x = P().x; let best = null, bd = 1e9;
    for (const d of S.dust) { if (d.p <= 0) continue; const dx = Math.abs(d.ax - x); if (dx < d.w / 2 + 30 && dx < bd) { bd = dx; best = { tool: 'vac', o: d }; } }
    for (const s of S.stains) { if (s.p <= 0) continue; const dx = Math.abs(s.ax - x); if (dx < s.w / 2 + 30 && dx < bd) { bd = dx; best = { tool: 'mop', o: s }; } }
    return best;
  }
  function sweep(S, o, tool, dt) {
    const n = o.seg.length, w = o.w, x = P().x, dw = CFG.dwell[tool], r = CFG.reach + w / (2 * n);
    for (let i = 0; i < n; i++) {
      const c = o.ax - w / 2 + (i + 0.5) * w / n;
      if (Math.abs(c - x) < r && o.seg[i] < 1) o.seg[i] = Math.min(1, o.seg[i] + dt / dw);
    }
    let m = 0; for (let i = 0; i < n; i++) m += o.seg[i];
    o.p = clamp(1 - m / n, 0, 1);
    if (o.p < 0.02) { o.p = 0; o.seg.fill(1); return true; }
    return false;
  }
  function stopUse() {
    if (L.vacLoop) { L.vacLoop = false; if (BB.audio && BB.audio.loop) try { BB.audio.loop('vacOn', false); } catch (e) { } sfx('vacOff'); }
    L.using = null;
  }
  const myAnim = () => L.using;
  function cleaning(dt, S) {
    const I = BB.In, pl = BB.player;
    const can = I && I.use && pl && pl.canControl() && P().y <= 1;
    let tg = null;
    if (can) tg = findTarget(S);
    if (tg && !hasTool(S, tg.tool)) {
      if (I.useEdge) {
        say(tg.tool === 'vac' ? 'vacuum' : 'mop', { need: 1, k: 'need' + tg.tool }, 3, true);
        toast(tg.tool === 'vac' ? 'Нужен пылесос — в шкафу в прихожей' : 'Нужна швабра — в ванной'); mood('inspect', 1.1);
      }
      tg = null;
    }
    if (tg && tg.tool === 'vac' && S.f.vacJam) { if (I.useEdge) { say('vacuum', { jam: 1, k: 'jw' }, 3, true); toast('Пылесос заклинило — выдерни носок (E)'); } tg = null; }
    if (can && !tg && I.useEdge && !L.using) {
      if (!S.tools.vac && !S.tools.mop) say('idle', { useNothing: 1, k: 'un' }, 5);
      else say('idle', { useNothing: 1, k: 'un' }, 6);
    }
    if (!tg) { if (L.using) { stopUse(); S.f.vacOn = S.f.mopOn = 0; } return; }
    const tool = tg.tool, o = tg.o;
    if (L.using !== tool) {
      if (L.using) stopUse();
      L.using = tool; L.useT = 0; S.active = tool; L.idleT = 0;
      if (tool === 'vac') { S.f.vacOn = 1; if (BB.audio && BB.audio.loop) try { BB.audio.loop('vacOn', true); } catch (e) { } L.vacLoop = true; sfx('vacOn'); say('vacuum', { start: 1, k: 'vs' }, 12); }
      else { S.f.mopOn = 1; sfx('bucket'); say('mop', { start: 1, k: 'ms' }, 12); }
      if (!L.tut[tool]) { L.tut[tool] = 1; toast('Води ' + (tool === 'vac' ? 'пылесосом' : 'шваброй') + ' по всему пятну, пока оно не исчезнет'); }
    }
    L.useT += dt; L.idleT = 0;
    S.f[tool === 'vac' ? 'mopOn' : 'vacOn'] = 0;
    if (tool === 'mop') { L.sfxT -= dt; if (L.sfxT <= 0) { L.sfxT = 0.55; sfx('mop', { x: P().x }); } }
    const was = o.p;
    if (sweep(S, o, tool, dt)) {
      o.wet = tool === 'mop' ? 1 : 0; S.stats.cleaned++; sfx('taskDone', { vol: .5 });
      if (tool === 'vac') {
        S.f.vacN = (S.f.vacN | 0) + 1;
        const left = S.dust.filter(d => d.p > 0).length;
        say('vacuum', { done: 1, left, k: 'vd' }, 2, left === 0);
        if (CFG.jamAt.indexOf(S.f.vacN) >= 0 && left > 0 && !S.f.vacJam) { snag(S); }
      } else {
        S.f.mopN = (S.f.mopN | 0) + 1;
        const left = S.stains.filter(d => d.p > 0).length; say('mop', { done: 1, left, k: 'md' }, 2, left === 0);
      }
      check(S);
    }
    void was;
  }
  function snag(S) {
    S.f.vacJam = 1; stopUse(); sfx('vacSnag'); say('vacuum', { jam: 1, k: 'jm' }, 0, true); mood('angry', 1.4); toast('Шнур зажевало! Выдерни носок (E)');
    L.jamPending = 0.9;
  }

  /* ------------------------------------------------------------ leak + timers */
  function leak(dt, S) {
    const lk = S.leak; if (!lk || S.f.faucetFixed) return;
    for (const s of S.stains) if (s.leak && s.p > 0 && s.w < s.wmax) s.w = Math.min(s.wmax, s.w + CFG.leak.grow * dt);
    lk.t += dt;
    if (lk.t >= lk.every) {
      lk.t = 0;
      if (lk.spawned < lk.max) {
        const r = U.srand(977 + lk.spawned * 131), id = 's' + pad2(S.stains.length + 1 + lk.spawned * 7), fx = BB.abs('bath', 250);
        S.stains.push({ id, room: 'bath', ax: fx + (r() - .5) * 220, z: r() * 40 - 5, w: 46, wmax: 120, p: 1, kind: 'water', leak: 1, wet: 0, seed: 400 + lk.spawned, seg: new Array(segCount(120)).fill(0) });
        lk.spawned++; if (Math.abs(P().x - fx) < 900) { say('faucet', { leak: 1, k: 'lk' }, 10); }
      }
    }
  }
  function howlAudio(S) {
    const fx = BB.abs('bath', 250), on = !S.f.faucetFixed && S.f.faucetHowl && Math.abs(P().x - fx) < 650;
    if (on !== L.howlOn) { L.howlOn = on; if (BB.audio && BB.audio.loop) try { BB.audio.loop('faucetHowl', !!on, { x: fx }); } catch (e) { } }
  }

  /* ----------------------------------------------------------- held / slowdown */
  const MINE = { bag: 1, clothes: 1, vac: 1, mop: 1, wrench: 1 };
  function syncHeld(S, dt) {
    const pl = BB.player; if (!pl) return;
    if (!L.using) { L.idleT += dt; if (L.idleT > CFG.toolIdleRevert && S.active !== 'hand') S.active = 'hand'; }
    let want = null;
    if (L.using) want = L.using;
    else if (S.carry.haul > 0 || S.carry.trash > 0) want = 'bag';
    else if (S.carry.cloth > 0) want = 'clothes';
    else if (S.active === 'vac' || S.active === 'mop') want = S.active;
    else if (S.active === 'box') want = 'wrench';
    const p = P();
    if (BB.ui && BB.ui.busy && BB.ui.busy()) return;
    if (p.act || p.held === 'phone') return;
    if (p.held !== want && (want || MINE[p.held])) pl.setHeld(want);
    const sl = 1 - 0.03 * S.carry.trash - 0.02 * S.carry.cloth - (S.carry.haul > 0 ? 0.26 : 0);
    S.slowTask = L.using ? Math.max(.3, sl) * CFG.useSlow : Math.max(.55, sl);
    S.slow = S.slowTask * (S.slowExt || 1);
  }
  function unstick(S) {
    if (S.f.boxesCleared) return; const x = P().x, y = P().y;
    for (const s of BB.world.solids) { if (!s.active || s.active(S)) { if (x > s.ax0 - 6 && x < s.ax1 + 6 && y < s.top - 6) { P().x = x < (s.ax0 + s.ax1) / 2 ? s.ax0 - 16 : s.ax1 + 16; } } }
  }

  /* ------------------------------------------------------------------ check */
  function check(S, force) {
    const pr = progress(S); S.done = S.done || {};
    for (const p of pr.parts) {
      if (p.p >= 0.999 && !S.done[p.id]) {
        S.done[p.id] = 1; sfx('taskDone'); BB.emit('task:done', { id: p.id, label: p.label });
      }
    }
    if (pr.done === pr.total && !S.done.all) { S.done.all = 1; BB.emit('task:done', { id: 'all' }); say('success', { all: 1, k: 'all' }, 0, true); mood('cheer', 1.8); }
    if (pr.score !== L.lastScore) { L.lastScore = pr.score; BB.emit('progress', pr.score); }
    return pr;
  }

  /* ------------------------------------------------------------------ update */
  function update(dt, S) {
    if (!S || !S.items || !S.carry) return;
    if (L.S !== S) { stopUse(); L.S = S; L.items = null; L.lastScore = -1; L.cd = {}; L.said = {}; L.jamPending = 0; L.howlOn = null; }
    L.now += dt;
    if (S.mode !== 'play') { if (L.using) { stopUse(); } return; }
    // vacuum cord jam: hand over to the minigame once, shortly after the snag
    if (L.jamPending > 0) { L.jamPending -= dt; if (L.jamPending <= 0 && S.f.vacJam && BB.mini && BB.mini.start && BB.player.canControl()) { startMini('vacJam', S, false); } else if (L.jamPending <= 0) L.jamPending = 0; }
    cleaning(dt, S);
    if (L.using) { if (!BB.overrideAnim || BB.overrideAnim === myAnim) BB.overrideAnim = myAnim; } else if (BB.overrideAnim === myAnim) BB.overrideAnim = null;
    leak(dt, S);
    // timers: wet shine, washer shake
    for (const s of S.stains) if (s.wet > 0) {
      s.wet = Math.max(0, s.wet - dt / 25);
      if (s.wet > .35 && s.p <= 0 && Math.abs(P().x - s.ax) < s.w / 2 && Math.abs(P().vx) > 230 && BB.player.canControl() && !cooling('slip' + s.id, 20)) {
        s.wet = 0; S.f.wetSlips++; addTime(S, CFG.wetSlipCost, 'slip'); sfx('land'); act('stumble', 0.7); say('mop', { slip: 1, k: 'sl' }, 0, true);
      }
    }
    if (S.wash && S.wash.t > 0) { S.wash.t -= dt; if (S.wash.t <= 0) S.f.washerOn = 0; }
    syncHeld(S, dt); howlAudio(S); unstick(S);
    L.checkT -= dt; if (L.checkT <= 0) { L.checkT = 0.3; check(S); }
  }

  /* ------------------------------------------------- hooks: hotspots, sprites */
  function hsFor(it) {
    let h = L.hs[it.id]; if (!h) h = L.hs[it.id] = { id: 'item:' + it.id, ax: it.ax, r: 38, h: 30, low: true, z: 0, room: it.room };
    return h;
  }
  const jamHs = { id: 'vacJam', ax: 0, r: 60, h: 40, z: 0 };
  function hotspotsHook(S) {
    const out = L.hsOut; out.length = 0;
    if (!S || !S.items || S.mode !== 'play') return out;
    const x = P().x;
    for (const it of S.items) if (!it.taken && Math.abs(it.ax - x) < 90) out.push(hsFor(it));
    if (S.f.vacJam) { jamHs.ax = x; out.push(jamHs); }
    return out;
  }
  const drawOut = [];
  function itemGlow(g, t, S, o) {
    const c = BB.cur; if (!c || !c.hot || c.hot.id !== o.hid) return;
    const a = .35 + .2 * Math.sin(t * 6); g.fillStyle = 'rgba(255,240,170,' + a + ')'; g.beginPath(); g.ellipse(o.w / 2, o.h, o.w * .8, 4, 0, 0, 7); g.fill();
  }
  function drawablesHook(S, t) {
    drawOut.length = 0;
    if (!S || !S.items) return drawOut;
    const cx = BB.cam.x;
    for (const it of S.items) {
      if (it.taken || Math.abs(it.ax - cx) > 900) continue;
      const sp = propSprite(it.kind, it.v);
      let o = L.spr[it.id];
      if (!o) o = L.spr[it.id] = { id: 'itm_' + it.id, hid: 'item:' + it.id, x: it.ax, ax: it.ax, y: 0, z: it.z, zs: it.z, shadow: { w: 7, a: .3, d: 5 }, dyn: itemGlow, img: { _: sp.img }, w: sp.w, h: sp.h };
      o.img._ = sp.img; o.w = sp.w; o.h = sp.h; o.ax = it.ax; o.x = it.ax; o.z = it.z; o.zs = it.z;
      drawOut.push(o);
    }
    return drawOut;
  }

  /* ----------------------------------------------------------------- decals */
  function dirtyEllipses(g, o, rgba, rzK, a0) {
    const n = o.seg.length, sw = o.w / n;
    for (let i = 0; i < n; i++) {
      const a = (1 - o.seg[i]) * a0; if (a < .02) continue;
      BB.floorEllipse(g, o.ax - o.w / 2 + (i + .5) * sw, o.z, sw * .95, o.w * rzK, rgba + a.toFixed(3) + ')');
    }
  }
  function decalsHook(g, t, S) {
    if (!S || !S.stains) return;
    const cx = BB.cam.x, pp = BB.props, usable = pp && !L.propsDead;
    for (const s of S.stains) {
      if (Math.abs(s.ax - cx) > 1000) continue;
      if (s.p > 0.001) {
        let ok = false;
        if (usable) {
          try {
            if (s.kind === 'water' && pp.puddle) { pp.puddle(g, s.ax, s.z, s.w, s.p, t); ok = true; }
            else if (pp.stainDecal) { pp.stainDecal(g, s.ax, s.z, s.w, s.p, s.kind, s.seed); ok = true; }
          } catch (e) { L.propsDead = true; console.warn('[tasks] props decals failed, using fallback', e); }
        }
        if (!ok) {
          if (s.kind === 'water') {
            dirtyEllipses(g, s, 'rgba(70,115,150,', .30, .6);
            const k = .5 + .5 * Math.sin(t * 2 + s.seed); BB.floorEllipse(g, s.ax, s.z, s.w * .3, s.w * .1, 'rgba(210,235,255,' + (.28 * s.p * (.6 + .4 * k)).toFixed(3) + ')');
          } else { dirtyEllipses(g, s, 'rgba(38,26,14,', .26, .6); BB.floorEllipse(g, s.ax + 6, s.z + 3, s.w * .3, s.w * .08, 'rgba(10,6,2,' + (.35 * s.p).toFixed(3) + ')'); }
        }
      }
      if (s.wet > 0.02 && s.p <= 0.001) BB.floorEllipse(g, s.ax, s.z, s.w * .55, s.w * .2, 'rgba(210,232,255,' + (.34 * s.wet).toFixed(3) + ')');
    }
    for (const d of S.dust) {
      if (d.p <= 0.001 || Math.abs(d.ax - cx) > 1000) continue;
      let ok = false;
      if (usable && pp.dustDecal) { try { pp.dustDecal(g, d.ax, d.z, d.w, d.p, d.seed); ok = true; } catch (e) { L.propsDead = true; console.warn('[tasks] dustDecal failed', e); } }
      if (!ok) {
        dirtyEllipses(g, d, 'rgba(150,140,122,', .24, .5);
        const r = U.srand(d.seed); g.fillStyle = 'rgba(95,88,76,.6)';
        for (let i = 0; i < 14; i++) { const fx = d.ax + (r() - .5) * d.w, fz = d.z + (r() - .5) * d.w * .3, seg = Math.min(d.seg.length - 1, Math.max(0, ((fx - (d.ax - d.w / 2)) / d.w * d.seg.length) | 0)); if (d.seg[seg] > .6) continue; g.fillRect(BB.sx(fx, fz), BB.sy(0, fz) - 1, 2, 1.5); }
      }
    }
    fxHook(g, t, S);
  }
  // vacuum suction streaks / mop suds around the hero while a tool runs
  function fxHook(g, t, S) {
    if (!L.using) return;
    const p = P(), z = 0, dir = p.dir || 1;
    if (L.using === 'vac') {
      g.save(); g.fillStyle = 'rgba(190,180,160,.55)';
      for (let i = 0; i < 9; i++) { const ph = (t * 2.2 + i * .13) % 1, x = p.x + dir * (70 - ph * 55) + Math.sin(i * 7 + t * 9) * 10; g.globalAlpha = (1 - ph) * .8; g.fillRect(BB.sx(x, z), BB.sy(3 + ph * 18 + (i % 3) * 3, z), 2.2, 2.2); }
      g.restore();
    } else {
      BB.floorEllipse(g, p.x + dir * 50, z, 38, 12, 'rgba(225,240,255,.30)');
      g.save(); g.fillStyle = 'rgba(230,245,255,.7)';
      for (let i = 0; i < 5; i++) { const ph = (t * 1.8 + i * .21) % 1, x = p.x + dir * (35 + i * 10) + Math.sin(i * 5 + t * 6) * 6; g.globalAlpha = (1 - ph) * .7; g.beginPath(); g.arc(BB.sx(x, z), BB.sy(2 + ph * 12, z), 1.6, 0, 7); g.fill(); }
      g.restore();
    }
  }

  /* ---------------------------------------------------------------- exports */
  BB.tasks = {
    CFG, prompt, interact, nothingHere, progress, checklist, serialize, restore, repair, check,
    penalty: (sec, why) => { if (BB.S) addTime(BB.S, sec, why); },
    hotspotFor: id => BB.world && BB.world.hot ? BB.world.hot(id) : null,
    PLAN, ROOM_RU, _L: L
  };
  BB.hooks.update.push(update);
  BB.hooks.decals.push(decalsHook);
  BB.hooks.drawables.push(drawablesHook);
  BB.hooks.hotspots.push(hotspotsHook);
  // once-per-load sanity warning for the hotspot contract
  setTimeout(() => {
    if (!BB.world || !BB.world.hot) return;
    ['frontDoor', 'switchHall', 'phone', 'boxes', 'bagStand', 'closet', 'sofa', 'tv', 'laundry', 'fridge', 'dishes', 'stove', 'bin', 'washer', 'mopStand', 'faucet', 'tub', 'toilet', 'printer', 'toolbox', 'pc']
      .forEach(id => { if (BB.built && !BB.world.hot(id)) warnOnce('hot:' + id, 'hotspot "' + id + '" missing in world'); });
  }, 6000);
})();
