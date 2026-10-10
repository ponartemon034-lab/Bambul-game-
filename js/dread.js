/* ==========================================================================
   BB.dread - "pressure" meter 0..1 and everything it drives.
   dread grows with elapsed time (stronger when the flat is still dirty) plus short
   "shocks" (fails, explosions, missed calls).  Level 1..5: irritation, anxiety, panic,
   despair, hysteria.  It drives:
     - random breakdown tirades (pool 'breakdown:lN', js/lines_despair.js)
     - walking barks (pool 'move' is gated by level)
     - red vignette / pulse and camera tremor (post hook), optional: BB.CFG.dread
   Owner: gameplay.  No state is saved: dread is recomputed from the saved run.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const D = BB.dread = { v: 0, level: 1, shock: 0, target: 0, forced: null, breakdowns: 0, _t: 0, _prog: 50, _progT: 0 };
  const EDGES = [.2, .4, .65, .85];
  const levelOf = v => { let l = 1; for (const e of EDGES) if (v >= e) l++; return l; };
  const SHOCK = { fail: .05, boom: .12, oops: .04, landlordMissed: .08, 'vac:snag': .04, 'faucet:wrong': .03, 'toilet:flushFail': .04, 'printer:setback': .04, spam: .02 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const on = () => !(BB.CFG && BB.CFG.dread === false);

  D.set = function (v) { D.forced = v == null ? null : clamp(v, 0, 1); };           // tests / debug
  D.addShock = n => { D.shock = Math.min(.35, D.shock + n); };
  D.reset = function () { D.v = D.target = 0; D.level = 1; D.shock = 0; D.breakdowns = 0; D._t = rnd(40, 70); };

  function progress(S, dt) {
    D._progT -= dt;
    if (D._progT <= 0) { D._progT = .5; try { const p = BB.tasks && BB.tasks.progress ? BB.tasks.progress(S) : null; if (p) D._prog = p.score; } catch (e) { } }
    return D._prog;
  }
  function compute(S, dt) {
    if (D.forced != null) return D.forced;
    const total = S.total > 0 ? S.total : 480, tp = clamp(1 - S.time / total, 0, 1);
    const dirt = 1 - clamp(progress(S, dt) / 100, 0, 1);
    return clamp(Math.pow(tp, 1.3) * (.45 + .55 * dirt) + D.shock * .5, 0, 1);
  }

  /* a breakdown is a long bark that interrupts ordinary chatter, plus a pose and a tremor */
  function breakdown(S) {
    const lv = clamp(D.level, 2, 5), dlg = BB.dlg; if (!dlg) return false;
    const r = dlg.bark('breakdown:l' + lv, { S }, { prio: 4, force: false });
    if (!r) return false;
    D.breakdowns++;
    try { if (BB.player) BB.player.mood(lv >= 5 ? 'panic' : lv === 4 ? 'fail' : lv === 3 ? 'angry' : 'tired', lv >= 4 ? 2.6 : 1.8); } catch (e) { }
    if (lv >= 4 && BB.cam && on()) BB.cam.shake = Math.max(BB.cam.shake, lv >= 5 ? .5 : .3);
    if (BB.emit) try { BB.emit('dread:breakdown', { level: lv }); } catch (e) { }
    return true;
  }
  D.breakdown = () => breakdown(BB.S);

  BB.hooks.update.push(function (dt, S) {
    if (!S || S.mode !== 'play' || BB.paused || !S._st || !S._st.introDone) return;
    if (S.time >= (S.total > 0 ? S.total : 480) - 1) D.reset();             // fresh run
    D.shock = Math.max(0, D.shock - dt * .01);
    D.target = compute(S, dt);
    D.v += (D.target - D.v) * Math.min(1, dt * .8);
    D.level = levelOf(D.v);
    // random breakdowns: more frequent as dread rises; never while a dialogue / minigame is open
    if (D.level < 2) return;
    const busy = BB.ui && BB.ui.busy && BB.ui.busy();
    if (busy || (BB.mini && BB.mini.active)) return;
    D._t -= dt;
    if (D._t <= 0) D._t = breakdown(S) ? rnd(28, 60) * (1 - .5 * D.v) : 3;
    // level 5: now and then the whole room trembles
    if (D.level >= 5 && on() && BB.cam && Math.random() < dt * .12) BB.cam.shake = Math.max(BB.cam.shake, .22);
  });

  /* shocks: wrap the bark entry point once so gameplay modules need no changes */
  (function wrap() {
    const dlg = BB.dlg; if (!dlg || !dlg.bark || dlg.bark._dread) return;
    const prev = dlg.bark;
    dlg.bark = function (cat, ctx, opts) { const r = prev.apply(this, arguments); if (r && SHOCK[cat]) D.addShock(SHOCK[cat]); return r; };
    dlg.bark._dread = true;
  })();

  /* red vignette + heartbeat pulse; drawn before the final colour grade */
  BB.hooks.post.push(function (g, t, S) {
    if (!on() || D.v < .25 || !S || S.mode !== 'play') return;
    const V = BB.view, a = clamp((D.v - .25) / .75, 0, 1);
    const pulse = D.level >= 4 ? .5 + .5 * Math.sin(t * (2.2 + 3 * a)) : 0;
    const edge = .16 + .34 * a + .16 * a * pulse;
    const gr = g.createRadialGradient(V.W / 2, V.H * .52, V.H * (.55 - .2 * a), V.W / 2, V.H * .52, V.W * .72);
    gr.addColorStop(0, 'rgba(120,8,8,0)'); gr.addColorStop(1, 'rgba(120,8,8,' + edge.toFixed(3) + ')');
    g.save(); g.fillStyle = gr; g.fillRect(0, 0, V.W, V.H); g.restore();
  });
})();
