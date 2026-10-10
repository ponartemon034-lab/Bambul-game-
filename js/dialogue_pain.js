/* ==========================================================================
   dialogue_pain.js - "боль Бамбуля": он бормочет, ругается и ноет, пока ходит по хате.
   Тексты лежат в js/dialogue_pain_data.js (BB.painData). Здесь только проводка:
   - новые пулы для BB.dlg (с эмоциями для озвучки),
   - добавки к существующим пулам (подбор мусора, пылесос, швабра, холодильник, кран, ...),
   - частые реплики при ходьбе, которые зависят от оставшегося времени и комнаты.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const dlg = BB.dlg, D = BB.painData;
  if (!dlg || !dlg.add || !D) { console.warn('[dialogue_pain] BB.dlg or BB.painData missing'); return; }
  const EMO = dlg.EMO = dlg.EMO || {};
  const add = (cat, rows, w) => { if (!rows || !rows.length) return; dlg.add(cat, rows.map(r => ({ t: r[0], w: w || 1 }))); rows.forEach(r => { EMO[r[0]] = r[1]; }); };

  /* ---- own pools ---- */
  add('pain:walk:early', D.walkEarly); add('pain:walk:mid', D.walkMid); add('pain:walk:late', D.walkLate);
  add('pain:drink', D.drink); add('pain:owner', D.owner); add('pain:lazy', D.lazy); add('pain:pain', D.pain);
  for (const id in D.room) add('pain:room:' + id, D.room[id]);
  for (const id in D.chaos) add('chaos:' + id, D.chaos[id]);

  /* ---- additions to the existing pools (same ids the gameplay already barks with) ---- */
  add('pickup', D.pickup); add('toss', D.toss);
  add('vac:start', D.vacuum.slice(0, 6)); add('vac:run', D.vacuum.slice(6)); add('mop:start', D.mop.slice(0, 6)); add('mop:run', D.mop.slice(6));
  add('fridge:open', D.fridge.slice(0, 5)); add('fridge:disgust', D.fridge.slice(5));
  add('faucet:open', D.faucet.slice(0, 4)); add('faucet:tighten', D.faucet.slice(4));
  add('toilet:inspect', D.toilet.slice(0, 4)); add('toilet:scrub', D.toilet.slice(4, 6)); add('toilet:flush', D.toilet.slice(6));
  add('printer:error', D.printer.slice(0, 4)); add('printer:wrong', D.printer.slice(4));
  add('sofa', D.sofa); add('tv:on', D.tv); add('pc', D.pc);
  add('time:300', D.time300); add('time:120', D.time120); add('time:60', D.time60); add('time:30', D.time30); add('time:10', D.time10);
  add('success', D.success); add('fail', D.fail); add('owner:comes', D.ownerComes, 2); add('idle', D.idle, 2);

  /* ---- bark metadata: flavour priority, short cooldown (the walk hook below paces them) ---- */
  const META = dlg._META;
  for (const c of ['pain:walk:early', 'pain:walk:mid', 'pain:walk:late', 'pain:drink', 'pain:owner', 'pain:lazy', 'pain:pain', 'pain:room:hall', 'pain:room:living', 'pain:room:kitchen', 'pain:room:bath', 'pain:room:work']) META[c] = { prio: 2, cd: 4 };

  for (const id in D.chaos) META['chaos:' + id] = { prio: 5, cd: 0 };

  /* ---- the old 'move' mutter is replaced by the phase-aware one ---- */
  const prevBark = dlg.bark;
  dlg.bark = function (cat, ctx, opts) { if (cat === 'move') return null; return prevBark.call(dlg, cat, ctx, opts); };

  const rnd = Math.random;

  /* ---- extra phone-call variants: each landlord call (and Dan's opener) now has several authored versions ---- */
  const SC = dlg._SC, WHO = { b: 'bamboul', l: 'landlord', d: 'dan' };
  const asLines = v => v.map(x => ({ who: WHO[x[0]], text: x[1] }));
  dlg._variants = {};
  for (const id in D.variants) {
    const prev = SC[id]; if (!prev) continue; const vs = D.variants[id];
    dlg._variants[id] = vs.map(asLines);
    SC[id] = function (c) {
      const base = prev(c) || [], r = rnd(); if (r < .34) return base;                     // the original stays in the rotation
      const tail = base.filter(l => l && l.choices), v = dlg._variants[id][Math.floor(rnd() * vs.length)];
      return v.map(l => Object.assign({}, l)).concat(tail.length ? [tail[tail.length - 1]] : []);
    };
  }
  { const prev = SC['dan:hint'];
    if (prev) SC['dan:hint'] = function (c) {
      const base = prev(c) || [], skip = base.findIndex(l => l.who === 'dan'); if (skip < 0 || rnd() < .3) return base;   // keep the state-aware hint lines, swap the opening exchange
      return [{ who: 'bamboul', text: D.danOpen[Math.floor(rnd() * D.danOpen.length)] }, { who: 'dan', text: D.danGreet[Math.floor(rnd() * D.danGreet.length)] }].concat(base.slice(skip + 1));
    };
    dlg._variants.danOpen = [D.danOpen.map(t => ({ who: 'bamboul', text: t }))]; dlg._variants.danGreet = [D.danGreet.map(t => ({ who: 'dan', text: t }))]; }

  const PAIN = dlg._pain = { dist: 0, gap: 0, last: { x: null }, n: 0, cfg: { distance: 380, minGap: 5.5 } };
  function phaseOf(S) { const f = S && S.total ? S.time / S.total : 1; return f > .6 ? 'early' : f > .25 ? 'mid' : 'late'; }
  PAIN.pick = function (S, room) {
    const ph = phaseOf(S), r = rnd();
    if (ph === 'late') return r < .62 ? 'pain:walk:late' : r < .8 ? 'pain:owner' : r < .92 ? 'pain:room:' + room : 'pain:lazy';
    if (ph === 'mid') return r < .42 ? 'pain:walk:mid' : r < .56 ? 'pain:owner' : r < .72 ? 'pain:room:' + room : r < .84 ? 'pain:drink' : r < .94 ? 'pain:lazy' : 'pain:pain';
    return r < .38 ? 'pain:walk:early' : r < .5 ? 'pain:drink' : r < .62 ? 'pain:room:' + room : r < .74 ? 'pain:owner' : r < .86 ? 'pain:lazy' : 'pain:pain';
  };
  BB.hooks.update.push(function (dt, S) {
    const P = BB.P; if (!S || S.mode !== 'play' || BB.paused || !P || !(S.time > 0)) return;
    PAIN.gap += dt;
    const dx = PAIN.last.x == null ? 0 : Math.abs(P.x - PAIN.last.x); PAIN.last.x = P.x; if (dx < 40) PAIN.dist += dx;
    if (PAIN.dist < PAIN.cfg.distance || PAIN.gap < PAIN.cfg.minGap) return;
    if (BB.ui && BB.ui.busy && BB.ui.busy()) return;
    if (S._st && !S._st.introDone) return;
    const room = BB.LAYOUT.roomOf(P.x).id, cat = PAIN.pick(S, room);
    if (dlg.bark(cat, { S, room })) { PAIN.dist = 0; PAIN.gap = 0; PAIN.n++; }
  });
})();
