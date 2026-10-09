/* ==========================================================================
   BAMBOUL - main loop, input, player controller, camera, interaction picking.
   Owner: lead.  Other modules talk to this file only through the BB.* API
   documented in docs/ARCHITECTURE.md (BB.player, BB.In, BB.cur, BB.hooks...).
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const { clamp, lerp } = BB.U;
  const L = BB.LAYOUT;
  const $ = s => document.querySelector(s);
  const qs = new URLSearchParams(location.search);

  /* ------------------------------------------------------------------ input */
  const In = BB.In = {
    keys: {}, tAx: 0, tUse: false, jump: false, act: false, useEdge: false, usedTouch: false,
    reset() { this.keys = {}; this.tAx = 0; this.tUse = false; this.jump = this.act = this.useEdge = false; },
    get ax() { let a = this.tAx; if (this.keys.KeyA || this.keys.ArrowLeft) a -= 1; if (this.keys.KeyD || this.keys.ArrowRight) a += 1; return clamp(a, -1, 1); },
    get run() { return !!(this.keys.ShiftLeft || this.keys.ShiftRight) || Math.abs(this.tAx) > .92; },
    get use() { return !!this.keys.KeyF || this.tUse; }
  };

  /* ------------------------------------------------------------ player state */
  const P = BB.P = {
    x: 300, y: 0, vx: 0, vy: 0, dir: 1, face: 1, st: 'idle', act: null, locked: false, mood: null, moodT: 0, landT: 0, stopT: 0,
    walkTo: null, height: L.playerH, held: null, ph: 0, accel: 0, idleT: 10, force: null
  };
  const SPEED = { walk: 170, run: 310 }, JUMP_V = 395, GRAV = 1350;
  let hero = null;      // character instance (js/character.js) or the placeholder

  const actor = {
    id: 'bamboul', x: 0, y: 0, z: 0, draw: (g, t, k) => { hero && hero.draw(g, t, k); }, reflect: .55, shadowW: 36, height: L.playerH, zBias: -.02
  };

  /* -------------------------------------------------------------- player API */
  const player = BB.player = {
    P,
    /* block input & play a one-shot animation. cb fires at the end. */
    doAct(type, dur, cb) { P.act = { type, t: 0, dur: dur || .6, cb }; P.vx = 0; },
    mood(name, dur) { P.mood = name; P.moodT = dur || 1.2; },
    face(x) { if (Math.abs(x - P.x) > 4) P.dir = x > P.x ? 1 : -1; },
    teleport(x) { P.x = x; P.y = 0; P.vx = P.vy = 0; BB.snapCamera && BB.snapCamera(); },
    walkTo(x, cb, run) { P.walkTo = { x, cb, run: !!run }; },
    setHeld(h) { P.held = h; },
    lock(b) { P.locked = !!b; },
    isBusy() { return !!(P.act || P.walkTo); },
    canControl() { return !!(BB.S && BB.S.mode === 'play' && !BB.paused && !P.locked && !P.act && !P.walkTo && !(BB.ui && BB.ui.busy && BB.ui.busy())); },
    force(st) { P.force = st; }
  };

  /* ------------------------------------------------------------- collisions */
  function solidsActive() { const S = BB.S || BB.DEFAULT_S; return BB.world.solids.filter(s => !s.active || s.active(S)); }
  function groundAt(x, y) { let g = 0; for (const s of solidsActive()) if (x > s.ax0 - 14 && x < s.ax1 + 14 && s.top <= y + 12 && s.top > g) g = s.top; return g; }
  function doorLimit(x) { // head room under door lintels
    for (const px of L.partitions) if (Math.abs(x - px) < L.partT / 2 + 18) return L.doorH - L.playerH - 3;
    return 9999;
  }

  /* ---------------------------------------------------------------- update */
  let tGlobal = 0;
  function updatePlayer(dt) {
    const S = BB.S;
    let ax = 0; const ctl = player.canControl();
    if (P.act) { P.act.t += dt; if (P.act.t >= P.act.dur) { const cb = P.act.cb; P.act = null; cb && cb(); } }
    let run = false;
    if (ctl) { ax = In.ax; run = In.run; }
    else if (P.walkTo && !P.act) {
      const dx = P.walkTo.x - P.x;
      if (Math.abs(dx) < 6) { const cb = P.walkTo.cb; P.walkTo = null; P.vx = 0; cb && cb(); } else { ax = Math.sign(dx); run = P.walkTo.run; }
    }
    const speed = (run ? SPEED.run : SPEED.walk) * (S && S.slow ? S.slow : 1);
    const target = ax * speed, acc = (Math.abs(target) > Math.abs(P.vx) ? 1500 : 2600) * dt;
    P.accel = target - P.vx;
    P.vx = Math.abs(target - P.vx) <= acc ? target : P.vx + Math.sign(target - P.vx) * acc;
    if (ax > .05) P.dir = 1; else if (ax < -.05) P.dir = -1;
    if (ctl && In.jump && P.y <= groundAt(P.x, P.y) + .5) { P.vy = JUMP_V; BB.audio && BB.audio.sfx && BB.audio.sfx('jump'); }
    // horizontal with solid blocking
    let nx = P.x + P.vx * dt;
    for (const s of solidsActive()) {
      if (P.y < s.top - 4) {
        if (P.x <= s.ax0 - 14 && nx > s.ax0 - 14) { nx = s.ax0 - 14; P.vx = 0; }
        else if (P.x >= s.ax1 + 14 && nx < s.ax1 + 14) { nx = s.ax1 + 14; P.vx = 0; }
      }
    }
    P.x = clamp(nx, 40, L.worldW - 40);
    // vertical
    const gnd = groundAt(P.x, P.y), cap = doorLimit(P.x);
    if (P.y > gnd || P.vy > 0) {
      P.vy -= GRAV * dt; P.y += P.vy * dt;
      if (P.y > cap && P.vy > 0) { P.y = cap; P.vy = 0; }
      if (P.y <= gnd) { P.y = gnd; if (P.vy < -220) { P.landT = .18; BB.audio && BB.audio.sfx && BB.audio.sfx('land'); } P.vy = 0; }
    } else P.y = gnd;
    if (!isFinite(P.x) || !isFinite(P.y)) { P.x = 300; P.y = 0; P.vx = P.vy = 0; }
    // animation state
    const moving = Math.abs(P.vx) > 14, air = P.y > gnd + 1;
    if (P.landT > 0) P.landT -= dt; if (P.moodT > 0) P.moodT -= dt; else P.mood = null;
    if (moving) P.stopT = .16; else if (P.stopT > 0) P.stopT -= dt;
    let st;
    if (P.force) st = P.force;
    else if (P.act) st = P.act.type;
    else if (BB.overrideAnim && BB.overrideAnim()) st = BB.overrideAnim();
    else if (air) st = P.vy > 0 ? 'jump' : 'fall';
    else if (P.landT > 0) st = 'land';
    else if (moving) st = Math.abs(P.vx) > 230 ? 'run' : (P.held === 'bag' || P.held === 'clothes' ? 'carry' : 'walk');
    else if (P.stopT > 0 && Math.abs(P.accel) > 40) st = 'stop';
    else if (P.mood) st = P.mood;
    else st = 'idle';
    P.st = st;
    const cyc = st === 'walk' || st === 'run' || st === 'carry';
    if (cyc) { const prev = P.ph; P.ph += Math.abs(P.vx) / (st === 'run' ? 62 : 52) * dt * Math.PI; if (Math.floor(prev / Math.PI) !== Math.floor(P.ph / Math.PI)) BB.audio && BB.audio.step && BB.audio.step(L.roomOf(P.x).id, st === 'run'); }
    P.face = lerp(P.face, P.dir, 1 - Math.exp(-dt * 20));
    actor.x = P.x; actor.y = P.y;
    if (hero && hero.update) hero.update(dt, { state: st, phase: P.ph, speed: Math.abs(P.vx), dir: P.dir, face: P.face, held: P.held, t: tGlobal, actT: P.act ? P.act.t / P.act.dur : 0, air, vy: P.vy, ax });
  }

  /* ---------------------------------------------------- interaction picking */
  const cur = BB.cur = { hot: null, prompt: null, ax: 0 };
  function pickHotspot() {
    cur.hot = null; cur.prompt = null;
    if (!player.canControl()) return;
    const S = BB.S; let best = null, bd = 1e9;
    const all = BB.world.hotspots.concat(...BB.hooks.hotspots.map(f => f(S) || []));
    for (const h of all) {
      const ax = h.ax != null ? h.ax : h.x, d = Math.abs(ax - P.x);
      if (d >= h.r || d - (h.low ? 14 : 0) >= bd) continue;
      if (h.minY != null && P.y < h.minY) continue;
      const p = BB.tasks && BB.tasks.prompt ? BB.tasks.prompt(h, S) : h.label || h.id;
      if (!p) continue;
      bd = d - (h.low ? 14 : 0); best = { h, p };
    }
    if (best) { cur.hot = best.h; cur.prompt = best.p; cur.ax = best.h.ax != null ? best.h.ax : best.h.x; }
  }
  function interact() {
    if (!cur.hot) { BB.tasks && BB.tasks.nothingHere && BB.tasks.nothingHere(); return; }
    const h = cur.hot; player.face(cur.ax);
    BB.tasks && BB.tasks.interact && BB.tasks.interact(h, BB.S);
  }

  /* ------------------------------------------------------------------ camera */
  const cam = BB.cam; cam.focus = null;
  function camTarget() {
    if (cam.focus) return cam.focus.x;
    return P.x + P.dir * 55;
  }
  BB.snapCamera = () => { const [a, b] = BB.camLimits(); cam.x = clamp(camTarget(), a, b); };
  function updateCamera(dt) {
    const [a, b] = BB.camLimits(), tx = clamp(camTarget(), a, b);
    // dead zone so tiny steps do not jiggle the world, then smooth follow
    const dz = cam.focus ? 0 : 30, dx = tx - cam.x;
    const want = Math.abs(dx) > dz ? tx - Math.sign(dx) * dz : cam.x;
    cam.x = lerp(cam.x, want, 1 - Math.exp(-dt * (cam.focus ? 3 : 4.2)));
    const zt = cam.focus && cam.focus.zoom ? cam.focus.zoom : 1;
    BB.view.zoom = lerp(BB.view.zoom, zt, 1 - Math.exp(-dt * 3));
  }

  /* ----------------------------------------------------------- placeholder hero */
  function placeholderHero() {
    return {
      update() {}, draw(g, t) {
        g.save(); g.scale(P.face < 0 ? -1 : 1, 1);
        const H = 178; g.fillStyle = '#c9a37d'; g.beginPath(); g.ellipse(0, -H + 12, 11, 13, 0, 0, 7); g.fill();
        g.fillStyle = '#d0b87a'; g.fillRect(-20, -H + 26, 40, 66); g.fillStyle = '#c9b48a'; g.fillRect(-18, -H + 90, 36, 34);
        g.fillStyle = '#e6c9a6'; g.fillRect(-14, -H + 122, 10, 90 - 36); g.fillRect(4, -H + 122, 10, 54); g.fillStyle = '#333'; g.fillRect(-18, -8, 14, 8); g.fillRect(4, -8, 14, 8);
        g.fillStyle = '#fff'; g.font = '10px monospace'; g.fillText('PLACEHOLDER 178cm', -40, -H - 6); g.restore();
      }
    };
  }

  /* ------------------------------------------------------------------- loop */
  let last = 0, running = false, cv, g;
  BB.paused = false; BB.timeScale = 1;
  /* adaptive quality: if the device cannot keep up, switch off the expensive effects step by step (only in 'auto' mode) */
  const AQ = { ema: 16, step: 0, t: 0, order: ['high', 'med', 'low'] };
  function adaptQuality(rawMs, now) {
    if (!BB.autoQ || document.hidden || BB.paused) return;
    AQ.ema = AQ.ema * .96 + Math.min(rawMs, 120) * .04;
    if (now - AQ.t > 3500 && AQ.ema > 34 && BB.gl && BB.gl.on && (BB.renderScaleWanted || 1) > .68) { // dynamic resolution first (cheap, keeps effects)
      AQ.t = now; AQ.ema = 22; BB.renderScaleWanted = Math.max(.65, (BB.renderScaleWanted || 1) - .15); BB.renderScale = BB.renderScaleWanted; BB.fit && BB.fit(); console.info('[quality] render scale ->', BB.renderScale.toFixed(2)); return;
    }
    if (now - AQ.t > 3500 && AQ.ema > 34 && AQ.step < 2) { AQ.step++; AQ.t = now; AQ.ema = 20; BB.setQuality(AQ.order[AQ.step]); BB.fit && BB.fit(); console.info('[quality] auto ->', AQ.order[AQ.step]); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (last) adaptQuality(now - last, now);
    let dt = Math.min(.05, (now - last) / 1000 || 0); last = now; dt *= BB.timeScale; tGlobal += dt;
    if (!BB.built) return;
    const S = BB.S;
    if (!BB.paused) {
      if (S && (S.mode === 'play' || S.mode === 'ending')) { for (const f of BB.hooks.update) f(dt, S, tGlobal); }
      updatePlayer(dt);
      pickHotspot();
      if (S && S.mode === 'play' && !BB.paused && In.act && player.canControl()) interact();
      if (BB.cur.hot === null) { /* nothing */ }
    }
    In.act = In.jump = In.useEdge = false;
    updateCamera(dt);
    BB.t = tGlobal;
    BB.render(g, S, tGlobal, dt);
    if (BB.gl && BB.gl.on) BB.gl.present();
    if (BB.ui && BB.ui.frame) BB.ui.frame(dt, tGlobal);
  }
  BB.start = () => { if (running) return; running = true; requestAnimationFrame(frame); };

  /* ------------------------------------------------------------ keyboard */
  function onKey(e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const c = e.code;
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(c)) e.preventDefault();
    if (c === 'F3') { BB.debug.on = !BB.debug.on; e.preventDefault(); return; }
    if (e.repeat) return;
    BB.audio && BB.audio.init && BB.audio.init();
    if (BB.ui && BB.ui.onKey && BB.ui.onKey(e, true)) return;      // UI (menus / dialogue / minigames) may consume keys
    const S = BB.S; if (!S || S.mode !== 'play' || BB.paused) return;
    In.keys[c] = true;
    if (c === 'KeyE' || c === 'Enter') In.act = true;
    else if (c === 'KeyF') In.useEdge = true;
    else if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') In.jump = true;
  }
  addEventListener('keydown', onKey);
  addEventListener('keyup', e => { delete In.keys[e.code]; BB.ui && BB.ui.onKey && BB.ui.onKey(e, false); });
  addEventListener('blur', () => { In.reset(); BB.ui && BB.ui.onBlur && BB.ui.onBlur(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { In.reset(); BB.ui && BB.ui.onBlur && BB.ui.onBlur(); } });

  /* -------------------------------------------------------------- resize */
  BB.fit = () => { const r = $('#app').getBoundingClientRect(); if (r.width < 10) return; BB.resize(cv, r.width, r.height); BB.snapCamera && BB.snapCamera(); };

  /* -------------------------------------------------------------- boot */
  BB.boot = async function () {
    cv = $('#cv'); g = cv.getContext('2d');
    const q = qs.get('q') || (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'med' : 'high'); BB.setQuality(q);
    BB.autoQ = !qs.get('q') && (!BB.CFG || !BB.CFG.quality || BB.CFG.quality === 'auto'); AQ.step = q === 'high' ? 0 : q === 'med' ? 1 : 2;
    if (qs.has('debug')) BB.debug.on = true;
    BB.fit(); if (BB.gl) { const on = !BB.CFG || BB.CFG.enhance !== false; if (!/low/.test(q) || qs.get('enhance')) BB.gl.enable(cv, on && qs.get('enhance') !== '0'); BB.fit(); } addEventListener('resize', BB.fit); addEventListener('orientationchange', () => setTimeout(BB.fit, 200));
    const bar = $('#loadBar'), txt = $('#loadTxt');
    await BB.buildWorld(p => { if (bar) bar.style.width = (p * 100 | 0) + '%'; });
    hero = (BB.char && BB.char.create) ? BB.char.create('bamboul') : placeholderHero();
    BB.hero = hero; BB.actors.length = 0; BB.actors.push(actor);
    if (BB.char && BB.char.createNpcs) BB.char.createNpcs();
    const ld = $('#loading'); if (ld) ld.hidden = true;
    P.x = qs.has('x') ? +qs.get('x') : (qs.has('room') ? BB.abs(qs.get('room'), 200) : 300);
    BB.snapCamera();
    BB.start();
    if (BB.ui && BB.ui.onReady) BB.ui.onReady(qs);
    else { BB.S = BB.newState ? BB.newState(480) : Object.assign({}, BB.DEFAULT_S, { mode: 'play' }); BB.S.mode = 'play'; }
  };
  window.addEventListener('DOMContentLoaded', () => BB.boot());
  /* handles for tests / QA */
  window.__bb = { BB, P, In, get S() { return BB.S; }, teleport: x => player.teleport(x), cur };
})();
