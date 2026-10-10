/* ==========================================================================
   BB.chaos - the chaos director. While the run is on, the apartment keeps breaking by itself:
   a pipe bursts, the washer leaks, beer gets knocked over, the bin spills, the neighbours bang the ceiling.
   Events are seeded (S.seed) so a daily run produces the same disasters for everybody.
     BB.chaos.CFG      timing / caps          BB.chaos.EVENTS  id -> { weight, can(S), run(S) }
     BB.chaos.fire(id) force an event (tests / debug)
   State lives in S.chaos = { n, next, log[] } and is saved with the run.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const U = BB.U || { clamp: (v, a, b) => v < a ? a : v > b ? b : v, srand: s => () => (s = (s * 16807) % 2147483647) / 2147483647 };
  const CFG = { first: .2, gap: [.13, .2], minLeft: 40, max: { 300: 2, 480: 3, 600: 4 }, enabled: true };
  const segCount = w => U.clamp(Math.ceil(w / 22), 3, 8);
  const room = id => BB.roomById(id);
  const ab = (id, x) => BB.abs(id, x);

  function nextId(S, p) { let i = 1; const used = new Set(S.stains.map(s => s.id).concat(S.items.map(s => s.id))); while (used.has(p + i)) i++; return p + i; }
  function addStain(S, rid, relX, z, w, kind, seed) {
    const o = { id: nextId(S, 'sc'), room: rid, ax: ab(rid, relX), z, w, wmax: w, p: 1, kind, leak: 0, wet: 0, seed, seg: new Array(segCount(w)).fill(0), chaos: 1 };
    S.stains.push(o); return o;
  }
  function say(id, S) { try { BB.dlg && BB.dlg.bark('chaos:' + id, { S }, { force: true }); } catch (e) { } }
  function alarm(S, o) {
    o = o || {}; if (BB.cam) BB.cam.shake = Math.max(BB.cam.shake || 0, o.shake == null ? .45 : o.shake);
    if (BB.audio && BB.audio.sfx) { try { BB.audio.sfx(o.sfx || 'bad'); } catch (e) { } }
    BB.haptic && BB.haptic([60, 40, 90], .7);
    if (o.toast && BB.ui && BB.ui.toast) { try { BB.ui.toast(o.toast); } catch (e) { } }
    if (BB.fx && BB.P) BB.fx.pop(o.pop || '!!!', BB.P.x + 100, BB.P.y + 125, { col: '#ff7a5a', size: 26, dur: 2 });
    BB.emit && BB.emit('chaos', { id: o.id });
  }
  const hasMop = S => !!(S.tools && S.tools.mop);

  const EVENTS = {
    pipe: {
      weight: 3, can: S => !S.stains.some(s => s.chaos && s.room === 'kitchen' && s.p > .02),
      run(S, rng) { addStain(S, 'kitchen', 235 + rng() * 40, 14, 96, 'water', 500 + S.chaos.n); alarm(S, { id: 'pipe', sfx: 'faucetHowl', toast: 'Лопнул шланг под раковиной: лужа на кухне. Нужна швабра!', pop: 'ПОТОП НА КУХНЕ' }); say('pipe', S); }
    },
    washer: {
      weight: 2, can: S => !S.stains.some(s => s.chaos && s.room === 'bath' && s.p > .02),
      run(S, rng) { addStain(S, 'bath', 60 + rng() * 30, 22, 88, 'water', 520 + S.chaos.n); alarm(S, { id: 'washer', sfx: 'water', toast: 'Стиралка протекла: мыльная лужа в ванной', pop: 'СТИРАЛКА ТЕЧЁТ' }); say('washer', S); }
    },
    spill: {
      weight: 3, can: S => !S.stains.some(s => s.chaos && s.room === 'living' && s.p > .02),
      run(S, rng) { addStain(S, 'living', 380 + rng() * 120, 22, 84, 'grime', 540 + S.chaos.n); alarm(S, { id: 'spill', sfx: 'bad', shake: .2, toast: 'Пиво по ковру: новое пятно в гостиной', pop: 'ПИВО РАЗЛИТО' }); say('spill', S); }
    },
    trash: {
      weight: 3, can: S => S.items.filter(i => i.kind === 'trash' && !i.taken && i.chaos).length < 6,
      run(S, rng) {
        const k = 3 + (rng() * 2 | 0), rid = rng() < .5 ? 'kitchen' : 'hall', base = rid === 'kitchen' ? 470 : 470;
        for (let i = 0; i < k; i++) S.items.push({ id: nextId(S, 'xc'), kind: 'trash', v: Math.floor(rng() * 16), room: rid, ax: ab(rid, base + (i - k / 2) * 26 + rng() * 14), z: -12 + (i % 3) * 20, taken: 0, extra: 1, chaos: 1 });
        if (S.count) S.count.trash += k; if (S.bin) S.bin.cap += k;
        alarm(S, { id: 'trash', sfx: 'bagFull', toast: 'Мусор вывалился обратно: ещё ' + k + ' штук', pop: 'МУСОР ВЫВАЛИЛСЯ' }); say('trash', S);
      }
    },
    neighbor: {
      weight: 2, can: S => true,
      run(S) { S.f.lampFlicker = 1; S.chaos.flickerT = 14; alarm(S, { id: 'neighbor', sfx: 'doorKnock', shake: .25, toast: 'Сосед долбит в потолок, свет моргает', pop: 'СТУК В ПОТОЛОК' }); say('neighbor', S); }
    },
    owner: {
      weight: 2, can: S => true,
      run(S) { alarm(S, { id: 'owner', sfx: 'phoneRing', shake: .15, toast: 'Хозяин прислал эсэмэску', pop: 'ХОЗЯИН ПИШЕТ' }); say('owner', S); }
    }
  };

  const max = S => CFG.max[S.total] != null ? CFG.max[S.total] : Math.max(1, Math.round(S.total / 160));
  const busy = () => !!((BB.ui && BB.ui.busy && BB.ui.busy()) || (BB.mini && BB.mini._R) || BB.paused);
  function pick(S, rng, forceId) {
    if (forceId) return EVENTS[forceId] ? forceId : null;
    const last = S.chaos.log[S.chaos.log.length - 1], ok = Object.keys(EVENTS).filter(id => EVENTS[id].can(S) && id !== last);
    let tot = 0; for (const id of ok) tot += EVENTS[id].weight; if (!tot) return null;
    let r = rng() * tot; for (const id of ok) { r -= EVENTS[id].weight; if (r <= 0) return id; } return ok[ok.length - 1];
  }
  function schedule(S, rng) { const g = CFG.gap; S.chaos.next = (S.total - S.time) + S.total * (g[0] + rng() * (g[1] - g[0])); }
  function fire(id) {
    const S = BB.S; if (!S) return null; S.chaos = S.chaos || { n: 0, next: null, log: [] };
    const rng = U.srand(((S.seed || 1) >>> 0) + S.chaos.n * 977 + 13), pid = pick(S, rng, id); if (!pid) return null;
    EVENTS[pid].run(S, rng); S.chaos.n++; S.chaos.log.push(pid); schedule(S, rng); return pid;
  }
  function update(dt, S) {
    if (!S || S.mode !== 'play' || !S._st || !S._st.introDone || !CFG.enabled) return;
    const C = S.chaos = S.chaos || { n: 0, next: null, log: [] };
    if (C.flickerT > 0) { C.flickerT -= dt; if (C.flickerT <= 0) S.f.lampFlicker = 0; }
    if (C.next == null) { const rng = U.srand(((S.seed || 1) >>> 0) + 7); C.next = S.total * (CFG.first + rng() * .06); }
    if (C.n >= max(S) || S.time < CFG.minLeft || (S.total - S.time) < C.next || busy() || S.f.phoneRing || S.f.phoneUp) return;
    fire();
  }
  BB.hooks.update.push(update);
  BB.chaos = { CFG, EVENTS, fire, update, max };
})();
