/* ==========================================================================
   BB.fx - small game-feel effects: dust puffs, sparks, floating texts, haptics.
   World coordinates (cm) on the gameplay lane, drawn in the engine's post hook (after lighting).
     BB.fx.puff(x, y, n, {r, a, col, vx})   dust / smoke
     BB.fx.spark(x, y, n, col)              little confetti-like bits
     BB.fx.pop(text, x, y, {col, size, dur}) floating text
     BB.haptic(ms | [pattern], strength)     phone vibration + gamepad rumble (honours BB.CFG.haptics)
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const parts = [], pops = [];
  let lastT = null;
  const rnd = Math.random;
  const MAXP = 160;

  BB.haptic = function (pat, strength) {
    if (BB.CFG && BB.CFG.haptics === false) return;
    try { if (navigator.vibrate && (BB.In && BB.In.usedTouch || /Android|iPhone|Mobile/i.test(navigator.userAgent))) navigator.vibrate(pat); } catch (e) { }
    try {
      const gp = BB.In && BB.In.gpActive && (navigator.getGamepads ? navigator.getGamepads() : [])[BB.In.gpActive.index];
      const act = gp && (gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0]));
      if (act && act.playEffect) { const d = Array.isArray(pat) ? pat.reduce((a, b) => a + b, 0) : pat; act.playEffect('dual-rumble', { duration: Math.min(400, d * 2), strongMagnitude: strength == null ? .5 : strength, weakMagnitude: (strength == null ? .5 : strength) * .6 }).catch(() => { }); }
    } catch (e) { }
  };

  const fx = BB.fx = {
    puff(x, y, n, o) {
      o = o || {};
      for (let i = 0; i < (n || 6) && parts.length < MAXP; i++) parts.push({ k: 'p', x: x + (rnd() - .5) * 14, y: (y || 0) + 1 + rnd() * 3, vx: (o.vx || 0) + (rnd() - .5) * 70, vy: 18 + rnd() * 34, r: (o.r || 5) * (.6 + rnd() * .8), a: o.a == null ? .38 : o.a, life: .55 + rnd() * .35, t: 0, col: o.col || '196,176,150' });
    },
    spark(x, y, n, col) {
      const cols = col ? [col] : ['255,210,90', '255,150,70', '150,230,150', '120,200,255'];
      for (let i = 0; i < (n || 10) && parts.length < MAXP; i++) parts.push({ k: 's', x: x + (rnd() - .5) * 20, y: y + rnd() * 10, vx: (rnd() - .5) * 220, vy: 90 + rnd() * 170, r: 1.6 + rnd() * 1.8, a: 1, life: .7 + rnd() * .5, t: 0, col: cols[i % cols.length] });
    },
    pop(text, x, y, o) { o = o || {}; pops.push({ text, x, y, t: 0, dur: o.dur || 1.5, col: o.col || '#ffd35a', size: o.size || 20 }); if (pops.length > 8) pops.shift(); },
    shake(a) { if (BB.cam) BB.cam.shake = Math.max(BB.cam.shake || 0, a); },
    clear() { parts.length = 0; pops.length = 0; },
    _count: () => parts.length + pops.length
  };

  function step(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt; if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'p') { p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.2 * dt; p.r += 7 * dt; } else { p.vy -= 520 * dt; if (p.y < 0) { p.y = 0; p.vy *= -.35; p.vx *= .6; } }
    }
    for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.t += dt; if (q.t >= q.dur) pops.splice(i, 1); }
  }

  BB.hooks.post.push(function (g, t) {
    if (lastT == null) lastT = t; const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t;
    if (!BB.paused) step(dt);
    if (!parts.length && !pops.length) return;
    g.save();
    for (const p of parts) {
      const k = BB.pxPerCm(0), x = BB.sx(p.x, 0), y = BB.sy(p.y, 0), f = 1 - p.t / p.life;
      if (x < -20 || x > BB.view.W + 20) continue;
      if (p.k === 'p') { g.globalAlpha = p.a * f * f; g.fillStyle = 'rgb(' + p.col + ')'; g.beginPath(); g.arc(x, y, p.r * k, 0, 7); g.fill(); }
      else { g.globalAlpha = Math.min(1, f * 1.6); g.fillStyle = 'rgb(' + p.col + ')'; g.fillRect(x - p.r * k / 2, y - p.r * k / 2, p.r * k, p.r * k); }
    }
    g.globalAlpha = 1; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const q of pops) {
      const f = q.t / q.dur, x = BB.sx(q.x, 0), y = BB.sy(q.y + 30 * f * f + 70 * Math.min(1, f * 3) * 0.4, 0) - 28 * f;
      g.globalAlpha = f < .15 ? f / .15 : f > .7 ? Math.max(0, 1 - (f - .7) / .3) : 1;
      g.font = '800 ' + q.size + 'px "Golos Text",system-ui,sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(10,6,4,.85)'; g.strokeText(q.text, x, y); g.fillStyle = q.col; g.fillText(q.text, x, y);
    }
    g.restore();
  });

  /* world events -> feedback */
  BB.on('task:done', d => {
    const P = BB.P; if (!P || !d || d.id === 'all') return;
    fx.pop('✔ ' + (d.label || 'Готово'), P.x + 95, P.y + 120, { col: '#9be37a', size: 20, dur: 2.2 }); fx.spark(P.x, P.y + 120, 16); BB.haptic([30, 40, 30], .5);
  });
  BB.on('task:done', d => { if (d && d.id === 'all') { const P = BB.P; if (P) { fx.pop('ВСЁ УБРАНО!', P.x + 95, P.y + 130, { col: '#ffd35a', size: 28, dur: 2.8 }); fx.spark(P.x, P.y + 120, 40); BB.haptic([40, 50, 40, 50, 80], .8); } } });
})();
