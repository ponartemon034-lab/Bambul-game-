/* ==========================================================================
   BB.rigV - the experimental vector hero (setting: «Векторная модель героя»).  A fully articulated 2D body drawn with Canvas paths (no cut-up sprites, so no seams, no source-resolution limit):
     legs, arms: tapered tubes that follow the bent skeleton (smooth knee / elbow), shorts and sleeve are separate layers on top
     torso: tee + open patterned shirt (the print is cut from the user's photo) + belt + belly, with soft-body extras
            (shirt hem, belly, belt tail swing on springs)
     head: the painted profile (assets/char/hero), upper head + jaw: the jaw opens when he talks / shouts, blink, brows
   Motion is procedural: planted feet (phase = distance travelled), two-bone IK, hip height from the legs, every angle through a damped spring,
   pose targets from js/character.js (arms, lean, crouch, head) so all states use the same skeleton, plus idle behaviours.
   Draw space: centimetres, origin at the FEET, up = -y, facing +x.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const PI = Math.PI, TAU = PI * 2;
  const R = { ready: false, img: {}, meta: null };

  /* ---------------------------------------------------------------- geometry (cm) */
  const G = { thigh: 40, shin: 36, ankleH: 8, uarm: 29, farm: 26, torso: 58, neck: 9, headCm: 29, shoulder: [-1.2, -51.5], neckBase: [0.2, -60.5], legRoot: [[1.2, 1], [-2.6, 1]] };
  const PAL = {
    skin: [216, 154, 120], skinD: [150, 96, 72], skinL: [236, 184, 150],
    shorts: [196, 174, 130], shortsD: [148, 126, 92], shortsL: [218, 198, 156],
    tee: [238, 234, 226], teeD: [188, 182, 172], belt: [56, 40, 32], ink: [32, 22, 17],
    shoe: [240, 236, 228], shoeD: [186, 178, 162], sole: [214, 206, 190], accent: [160, 142, 112]
  };
  const css = (c, a, k) => { k = k == null ? 1 : k; return 'rgba(' + Math.round(c[0] * k) + ',' + Math.round(c[1] * k) + ',' + Math.round(c[2] * k) + ',' + (a == null ? 1 : a) + ')'; };

  /* ---------------------------------------------------------------- loading */
  let shirtPat = null, shirtSize = [1, 1];
  (function load() {
    if (typeof Image === 'undefined' || typeof fetch === 'undefined') return;
    fetch('assets/char/hero/hero.json').then(r => r.ok ? r.json() : null).then(meta => {
      if (!meta) return; R.meta = meta; let left = 3;
      const done = () => { if (--left === 0 && R.img.head_up.width && R.img.shirt.width) finish(); };
      for (const n of ['head_up', 'head_jaw', 'shirt']) { const im = new Image(); im.onload = done; im.onerror = () => { left = -99; }; im.src = 'assets/char/hero/' + n + '.png'; R.img[n] = im; }
    }).catch(() => { });
  })();
  function finish() {
    const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d');
    shirtPat = g.createPattern(R.img.shirt, 'repeat'); shirtSize = [R.img.shirt.width, R.img.shirt.height];
    R.ready = true;
  }
  let noisePat = null;
  function grain(g, pathFn, a) {                                 // fine painted grain over the cloth / skin so the flat colours do not look like vector clip-art
    if (!noisePat) { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'), id = x.createImageData(96, 96); for (let i = 0; i < id.data.length; i += 4) { const v = 110 + Math.random() * 70; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); noisePat = x.createPattern(c, 'repeat'); if (noisePat.setTransform) noisePat.setTransform(new DOMMatrix().scale(.16, .16)); }
    g.save(); pathFn(g); g.clip(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = a; g.fillStyle = noisePat; g.fillRect(-120, -220, 300, 260); g.restore();
  }
  function patternAt(g, x, y, ang, sc) {         // the print moves with the garment it is painted on
    if (!shirtPat) return css(PAL.shorts);
    if (shirtPat.setTransform) shirtPat.setTransform(new DOMMatrix().translate(x, y).rotate(ang * 180 / PI).scale(sc, sc));
    return shirtPat;
  }

  /* ------------------------------------------------------------ spring (2nd order) */
  function spring(v0, w, z) { return { x: v0, v: 0, w, z }; }
  function stepSpring(s, target, dt) {
    const n = Math.max(1, Math.ceil(dt / .008)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = s.w * s.w * (target - s.x) - 2 * s.z * s.w * s.v; s.v += a * h; s.x += s.v * h; }
    return s.x;
  }
  const ease = u => u * u * (3 - 2 * u);

  /* ---------------------------------------------------------------- gait */
  const MODE = {
    walk: { D: .6, Lc: 104, hip: 73.5, bob: 1.5, lift: 9, lean: .06, aSw: .42, aFlex: .5, aFlexK: .45, hipSign: 1 },
    carry: { D: .6, Lc: 104, hip: 73.5, bob: 1.4, lift: 8, lean: .10, aSw: .12, aFlex: 1.05, aFlexK: .1, hipSign: 1 },
    run: { D: .38, Lc: 124, hip: 72, bob: 3.4, lift: 19, lean: .28, aSw: .78, aFlex: 1.5, aFlexK: .35, hipSign: -1 },
    stumble: { D: .45, Lc: 96, hip: 73, bob: 2.4, lift: 15, lean: .34, aSw: 1.0, aFlex: .7, aFlexK: .5, hipSign: -1 }
  };
  const LIFT = { v: 9 };
  const m0lift = (m, u) => LIFT.v * Math.sin(PI * u) * (1 + .35 * (1 - u));
  function targetsCycle(m, c) {
    LIFT.v = m.lift; const D = m.D, half = D * m.Lc / 2, AH = G.ankleH;
    const leg = ph => {                       // ph in [0,1): 0 = heel strike
      const q = ((ph % 1) + 1) % 1;
      if (q < D) {                              // stance: planted, the foot goes from +half to -half under the hip
        const u = q / D, x = half - 2 * half * u; let ang = PI / 2, y = AH;
        if (u < .25) ang = PI / 2 + .22 * (1 - u / .25);                         // heel strike, toe up
        const ts = D < .5 ? .35 : .72; if (u > ts) { const d = ease((u - ts) / (1 - ts)); ang = PI / 2 - .75 * d; y += 15 * Math.sin(.75 * d); }   // heel lifts, toe-off
        return { x, y, ang };
      }
      const u = (q - D) / (1 - D);
      // swing foot: cubic Hermite whose end velocities equal the ground speed (lifts off and lands moving like the floor)
      const mm = -2 * half * (1 - D) / D, u2 = u * u, u3 = u2 * u;
      const x = (2 * u3 - 3 * u2 + 1) * -half + (u3 - 2 * u2 + u) * mm + (-2 * u3 + 3 * u2) * half + (u3 - u2) * mm;
      const toe = lerp(-.75, .22, ease(clamp((u - .15) / .85, 0, 1)));
      return { x, y: AH + 15 * Math.sin(.75) * (1 - ease(clamp(u * 2.2, 0, 1))) + m0lift(mm, u), ang: PI / 2 + toe };
    };
    const N = leg(c), F = leg(c + .5), sw = Math.cos(TAU * c);
    const armN = { u: -m.aSw * sw, f: 0 }, armF = { u: m.aSw * sw * .8, f: 0 };
    armN.f = m.aFlex + m.aFlexK * armN.u; armF.f = m.aFlex + m.aFlexK * armF.u;
    const hip = m.hip + m.hipSign * m.bob * Math.cos(2 * TAU * (c - D / 2));
    const lean = m.lean + .03 * Math.sin(2 * TAU * c) * (m === MODE.run ? 1.4 : .6);
    return { hip, lean, head: -lean * .55 + .03 * Math.sin(2 * TAU * c + .8), N, F, armN, armF };
  }
  function targetsPose(pose, arm, t) {
    const cr = clamp(pose.crouch || 0, -6, 44), lift = pose.lift || 0, wide = 7 + cr * .16;
    return { hip: 83.8 - cr * 1.0 + lift + Math.sin(t * 2) * .22, lean: .03 + clamp(pose.lean || 0, -.5, .75) * .85 + Math.sin(t * .9) * .008, head: (arm && arm.head || 0),
      N: { x: wide, y: G.ankleH + lift, ang: PI / 2 }, F: { x: -wide - 2, y: G.ankleH + lift, ang: PI / 2 },
      armN: arm ? { u: -arm.aB, f: -arm.eB } : { u: .1, f: .35 }, armF: arm ? { u: -arm.aA, f: -arm.eA } : { u: -.08, f: .3 } };
  }
  function targetsAir(rising) {
    const up = rising;
    return { hip: 74, lean: up ? .16 : .08, head: up ? -.1 : 0,
      N: { x: up ? 16 : 11, y: up ? 36 : 16, ang: PI / 2 - (up ? .1 : .25) }, F: { x: up ? -20 : -9, y: up ? 22 : 11, ang: PI / 2 - (up ? .9 : .5) },
      armN: { u: up ? 1.9 : 1.2, f: .5 }, armF: { u: up ? -.55 : -.8, f: .7 } };
  }
  function targetsSit(t) {
    return { hip: 43, lean: -.42 + Math.sin(t * 1.5) * .01, head: .16, N: { x: 43, y: G.ankleH, ang: PI / 2 + .12 }, F: { x: 37, y: G.ankleH, ang: PI / 2 + .15 },
      armN: { u: .55, f: 1.3 }, armF: { u: .35, f: 1.5 } };
  }

  /* ---------------------------------------------------------------- instance */
  R.create = function () {
    const S = {}, P = { hem: [], bellyX: spring(0, 15, .22), bellyY: spring(0, 18, .25), tail: spring(0, 10, .22), jaw: spring(0, 40, .8), lid: 0, lastSpd: 0, accX: 0, idleT: 4, idleAct: null, idleA: 0, lookS: spring(0, 6, .8) };
    for (let i = 0; i < 5; i++) P.hem.push({ x: spring(0, 14 + i, .3), y: spring(0, 16 + i, .3) });
    const ch = (name, v, w, z) => { S[name] = spring(v, w, z); };
    const inst = {
      S, P, init: false, mode: 'stand', out: null, t: 0,
      update(dt, ctl, st, held, pose, arm) {
        if (!R.ready) return;
        dt = Math.min(dt, .05); inst.t = ctl.t != null ? ctl.t : inst.t + dt;
        let tg, kind = 'stand';
        if (st === 'walk' || st === 'run' || st === 'carry') { const m = MODE[st]; kind = st; let c = ctl.phase / TAU; c -= Math.floor(c); tg = targetsCycle(m, c); }
        else if (st === 'jump' || st === 'fall') { kind = 'air'; tg = targetsAir(st === 'jump' && (ctl.vy == null || ctl.vy > 60)); }
        else if (st === 'stumble') { kind = 'stumble'; tg = targetsCycle(MODE.stumble, (inst.t * 3.2) % 1); }
        else if (st === 'sit') { kind = 'sit'; tg = targetsSit(inst.t); }
        else { tg = pose ? targetsPose(pose, arm, inst.t) : targetsPose({}, null, inst.t); idleBehaviours(inst, dt, st, tg); }
        if (inst.init && inst.mode !== kind) inst.blend = .3;           // mode change: soften the springs for a moment so the pose blends instead of jumping
        emotion(inst, tg, st, kind);
        inst.mode = kind; inst.blend = Math.max(0, (inst.blend || 0) - dt);
        const bl = .3 + .7 * (1 - inst.blend / .3);
        if (!inst.init) {
          ch('hip', tg.hip, 30, .9); ch('lean', tg.lean, 14, .8); ch('head', tg.head, 12, .55);
          for (const L of ['N', 'F']) { ch('x' + L, tg[L].x, 55, 1); ch('y' + L, tg[L].y, 55, 1); ch('a' + L, tg[L].ang, 45, .9); }
          for (const L of ['N', 'F']) { const a = tg['arm' + L]; ch('u' + L, a.u, 17, .62); ch('f' + L, a.f, 14, .5); }
          inst.init = true;
        }
        const soft = ((kind === 'air' || kind === 'stand' || kind === 'sit') ? .55 : 1) * bl;
        S.hip.w = 30 * bl; S.lean.w = 14 * Math.max(.5, bl); stepSpring(S.hip, tg.hip, dt); stepSpring(S.lean, tg.lean, dt); stepSpring(S.head, tg.head, dt);
        for (const L of ['N', 'F']) {
          const f = tg[L]; S['x' + L].w = 55 * soft; S['y' + L].w = 55 * soft; S['a' + L].w = 45 * soft;
          stepSpring(S['x' + L], f.x, dt); stepSpring(S['y' + L], f.y, dt); stepSpring(S['a' + L], f.ang, dt);
          const a = tg['arm' + L]; S['u' + L].w = 17 * Math.max(.45, bl); S['f' + L].w = 14 * Math.max(.45, bl); stepSpring(S['u' + L], a.u, dt); stepSpring(S['f' + L], a.f, dt);
        }
        softBody(inst, dt, ctl, pose);
        inst.out = solve(inst);
      },
      draw(g, held, drawHeld, p, t) { if (R.ready && inst.out) return drawRig(inst, g, held, drawHeld, p, t); }
    };
    return inst;
  };

  /* body language: the dread meter (js/dread.js) bends the posture, talking makes him gesture */
  function emotion(inst, tg, st, kind) {
    const P = inst.P, t = inst.t, D = BB.dread, v = D && D.v > 0 ? D.v : 0, lv = D ? D.level : 1;
    if (v > .1 && st !== 'sit') {
      tg.lean += .1 * v; tg.head += .12 * v; tg.hip -= 1.6 * v * (kind === 'stand' ? 1 : .3);
      if (lv >= 5) { const tr = Math.sin(t * 41) * .035 + Math.sin(t * 27) * .02; tg.armN.u += tr; tg.armF.u -= tr; tg.head += Math.sin(t * 33) * .012; }
      else if (lv >= 4) tg.head += Math.sin(t * 5.3) * .02;
    }
    P.speaking = false;
    try { P.speaking = !!(BB.voice && BB.voice.isSpeaking && BB.voice.isSpeaking() && !(BB.CFG && BB.CFG.voice === false)); } catch (e) { }
    if (P.speaking && (kind === 'stand') && (st === 'idle' || st === 'idleBored' || st === 'wait')) {         // talking hands
      const k = .5 + .5 * Math.sin(t * 3.3), k2 = .5 + .5 * Math.sin(t * 2.1 + 1);
      tg.armN = { u: tg.armN.u + .35 + .5 * k, f: tg.armN.f + .6 + .5 * k2 }; tg.head += .05 * Math.sin(t * 6.2); tg.lean += .02 * k;
    }
  }

  /* idle behaviours: weight shift, look around, scratch head, check the time, yawn.  They only add small offsets to the pose targets. */
  function idleBehaviours(inst, dt, st, tg) {
    const P = inst.P; if (st !== 'idle') { P.idleAct = null; return; }
    P.idleT -= dt;
    if (!P.idleAct && P.idleT <= 0) { const acts = ['shift', 'look', 'scratch', 'watch', 'yawn', 'look']; P.idleAct = acts[Math.floor(Math.random() * acts.length)]; P.idleA = 0; P.idleDur = P.idleAct === 'yawn' ? 2.6 : P.idleAct === 'shift' ? 2.4 : 2.2; }
    if (P.idleAct) {
      P.idleA += dt; const k = Math.sin(clamp(P.idleA / P.idleDur, 0, 1) * PI);
      switch (P.idleAct) {
        case 'shift': tg.N.x += 5 * k; tg.F.x -= 2 * k; tg.lean += .03 * k; tg.hip -= 1.2 * k; break;
        case 'look': tg.head += .22 * Math.sin(clamp(P.idleA / P.idleDur, 0, 1) * TAU); break;
        case 'scratch': tg.armN = { u: 2.4 * k + (1 - k) * tg.armN.u, f: 2.2 * k + (1 - k) * tg.armN.f }; tg.head -= .08 * k; break;
        case 'watch': tg.armF = { u: .9 * k + (1 - k) * tg.armF.u, f: 1.9 * k + (1 - k) * tg.armF.f }; tg.head += .12 * k; break;
        case 'yawn': tg.armN = { u: 2.7 * k + (1 - k) * tg.armN.u, f: .4 * k + (1 - k) * tg.armN.f }; tg.armF = { u: 2.5 * k + (1 - k) * tg.armF.u, f: .5 * k + (1 - k) * tg.armF.f }; tg.lean -= .09 * k; tg.head -= .2 * k; P.yawn = k; break;
      }
      if (P.idleA >= P.idleDur) { P.idleAct = null; P.idleT = 4 + Math.random() * 6; P.yawn = 0; }
    }
  }

  /* soft-body extras: shirt hem, belly, belt tail, jaw, blink */
  function softBody(inst, dt, ctl, pose) {
    const P = inst.P, S = inst.S;
    const spd = ctl.speed || 0, acc = clamp((spd - P.lastSpd) / Math.max(dt, 1e-3), -900, 900); P.lastSpd = spd;
    P.accX += (acc - P.accX) * Math.min(1, dt * 14);
    const vy = S.hip.v;                                   // vertical velocity of the body (cm/s)
    const ay = clamp(-vy * .015, -3, 3);
    for (let i = 0; i < P.hem.length; i++) {
      const k = .5 + i * .12;
      stepSpring(P.hem[i].x, clamp(-P.accX * .004 * k - spd * .008 * (i / 4), -5, 3), dt);
      stepSpring(P.hem[i].y, clamp(vy * .02 * k, -2.5, 2.5), dt);
    }
    stepSpring(P.bellyX, clamp(-P.accX * .0016, -1.5, 1.5), dt); stepSpring(P.bellyY, clamp(ay * .6, -1.6, 1.6), dt);
    stepSpring(P.tail, clamp(-P.accX * .0016 - S.lean.v * .2, -1.1, 1.1), dt);
    // face: talking, shouting, blink
    let open = 0;
    try { if (BB.voice && BB.voice.isSpeaking && BB.voice.isSpeaking() && !(BB.CFG && BB.CFG.voice === false)) open = .35 + .4 * Math.abs(Math.sin(inst.t * 13.5)) * (.6 + .4 * Math.sin(inst.t * 4.1 + 1)); } catch (e) { }
    if (pose && pose.mouth > .4) open = Math.max(open, clamp(pose.mouth * .55, 0, .8));
    if (inst.P.yawn) open = Math.max(open, .95 * inst.P.yawn);
    stepSpring(P.jaw, open, dt);
    const blinkPose = pose && pose.eye != null ? pose.eye : 1; P.lid = clamp(1 - blinkPose / .9, 0, 1);
  }

  /* two-bone IK in canvas coordinates (y down), knee forward (+x) */
  function ik(hx, hy, ax, ay, l1, l2) {
    let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
    const mx = l1 + l2 - .4, k0 = .97 * mx;                                   // soft reach limit: the leg straightens smoothly instead of snapping at full extension
    if (d > k0) { const de = k0 + (mx - k0) * Math.tanh((d - k0) / (mx - k0)); ax = hx + dx / d * de; ay = hy + dy / d * de; dx = ax - hx; dy = ay - hy; d = de; }
    if (d < 6) d = 6;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
    return { kx: hx + ux * a + uy * h, ky: hy + uy * a - ux * h, ax, ay };
  }
  function solve(inst) {
    const S = inst.S, hipY = -S.hip.x, out = { T: [0, hipY] };
    const al = S.lean.x; out.torso = al;
    const ca = Math.cos(al), sa = Math.sin(al), rot = v => [v[0] * ca - v[1] * sa, v[0] * sa + v[1] * ca];
    const nk = rot(G.neckBase), sh = rot(G.shoulder);
    out.neck = [nk[0], hipY + nk[1]]; out.sh = [sh[0], hipY + sh[1]];
    out.headRot = al + S.head.x;
    for (let i = 0; i < 2; i++) {
      const L = i ? 'F' : 'N', rr = rot(G.legRoot[i]), rx = rr[0], ry = hipY + rr[1];
      const ax = S['x' + L].x + rx, ay = -S['y' + L].x;
      const k = ik(rx, ry, ax, ay, G.thigh, G.shin);
      out['hip' + L] = [rx, ry]; out['knee' + L] = [k.kx, k.ky]; out['ankle' + L] = [k.ax, k.ay];
      out['footRot' + L] = PI / 2 - S['a' + L].x;
      const u = S['u' + L].x, f = S['f' + L].x, tf = u + f;
      const s0 = i ? [out.sh[0] - 3.2, out.sh[1] + .8] : out.sh;
      const e = [s0[0] + Math.sin(u) * G.uarm, s0[1] + Math.cos(u) * G.uarm];
      out['sh' + L] = s0; out['elbow' + L] = e; out['wrist' + L] = [e[0] + Math.sin(tf) * G.farm, e[1] + Math.cos(tf) * G.farm]; out['fAng' + L] = tf;
    }
    return out;
  }

  /* ---------------------------------------------------------------- drawing helpers */
  function chaikin(pts, it) {
    for (let k = 0; k < it; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } o.push(pts[pts.length - 1]); pts = o; }
    return pts;
  }
  function curve(ctrl, n) {                              // smooth centre line, resampled uniformly: [{x,y,tx,ty,s}]
    const p = chaikin(ctrl, 3), cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const L = cum[cum.length - 1], out = []; let j = 1;
    for (let i = 0; i < n; i++) {
      const s = L * i / (n - 1); while (j < p.length - 1 && cum[j] < s) j++;
      const t = (s - cum[j - 1]) / Math.max(cum[j] - cum[j - 1], 1e-6), x = lerp(p[j - 1][0], p[j][0], t), y = lerp(p[j - 1][1], p[j][1], t);
      const a = p[Math.max(0, j - 2)], b = p[Math.min(p.length - 1, j + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      out.push({ x, y, tx: dx / l, ty: dy / l, s: i / (n - 1), d: s });
    }
    out.L = L; return out;
  }
  function wAt(prof, d) { if (d <= prof[0][0]) return prof[0][1]; for (let i = 1; i < prof.length; i++) if (d <= prof[i][0]) { const t = (d - prof[i - 1][0]) / Math.max(prof[i][0] - prof[i - 1][0], 1e-6); return lerp(prof[i - 1][1], prof[i][1], t); } return prof[prof.length - 1][1]; }
  /* a tube: edges of a tapered strip around the centre line (profile = [[cm from the start, width]]).  Closures so layers can stroke all outlines first */
  function tube(cv, prof, d0, d1, cap) {
    const pts = cv.filter(p => p.d >= d0 - 1e-6 && p.d <= d1 + 1e-6), Lf = [], Rt = [], Cn = [];
    for (const p of pts) { const w = wAt(prof, p.d), nx = p.ty, ny = -p.tx; Lf.push([p.x - nx * w / 2, p.y - ny * w / 2]); Rt.push([p.x + nx * w / 2, p.y + ny * w / 2]); Cn.push([p.x, p.y, nx, ny, w]); }
    return {
      Lf, Rt, Cn,
      path(g, nocap) { g.beginPath(); g.moveTo(Lf[0][0], Lf[0][1]); for (let i = 1; i < Lf.length; i++) g.lineTo(Lf[i][0], Lf[i][1]); for (let i = Rt.length - 1; i >= 0; i--) g.lineTo(Rt[i][0], Rt[i][1]); g.closePath();
        if (cap && !nocap) { const c = Cn[0]; g.moveTo(c[0] + c[4] / 2, c[1]); g.arc(c[0], c[1], c[4] / 2, 0, TAU); } },
      strip(g, a, b) { g.beginPath(); for (let i = 0; i < Cn.length; i++) { const c = Cn[i]; g[i ? 'lineTo' : 'moveTo'](c[0] + c[2] * c[4] * a, c[1] + c[3] * c[4] * a); } for (let i = Cn.length - 1; i >= 0; i--) { const c = Cn[i]; g.lineTo(c[0] + c[2] * c[4] * b, c[1] + c[3] * c[4] * b); } g.closePath(); }
    };
  }
  const SHADE_X = []; (function () { for (let i = 0; i <= 14; i++) SHADE_X.push(-.5 + i / 14); })();
  const shadeA = x => Math.max(0, .62 * Math.pow(clamp((.02 - x) / .52, 0, 1), 1.5));                 // dark back
  const lightA = x => .26 * Math.exp(-Math.pow((x - .2) / .1, 2)) + .18 * Math.max(0, (x - .38) / .12) * 0;   // soft highlight stripe on the front third
  function paintTube(g, T, base, shade, light, dark) {     // round shading: smooth falloff built from 14 thin strips (no visible bands)
    T.path(g); g.fillStyle = css(base, 1, dark); g.fill();
    g.save(); T.path(g); g.clip();
    for (let i = 0; i < SHADE_X.length - 1; i++) {
      const a = SHADE_X[i], b = SHADE_X[i + 1] + .002, m = (a + b) / 2, sa = shadeA(m), la = lightA(m);
      if (sa > .01) { T.strip(g, a, b); g.fillStyle = css(shade, sa, dark); g.fill(); }
      if (la > .01) { T.strip(g, a, b); g.fillStyle = css(light, la, dark); g.fill(); }
    }
    T.strip(g, .44, .52); g.fillStyle = css(shade, .22, dark); g.fill();                                 // turning edge
    g.restore();
  }
  function outlineAll(g, items, wd) { g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = css(PAL.ink, .8); g.lineWidth = wd; for (const it of items) { it(g); g.stroke(); } g.restore(); }

  const LEG_EXT = 7, ARM_EXT = 5;                          // the tubes start a little above the joint so the top is hidden inside the body
  const LEG_SKIN = [[0, 19], [LEG_EXT, 20.5], [LEG_EXT + 17, 19], [LEG_EXT + 34, 15.6], [LEG_EXT + 40, 16.6], [LEG_EXT + 46, 15.6], [LEG_EXT + 53, 16], [LEG_EXT + 66, 11.6], [LEG_EXT + 76, 8.4]];
  const SHORTS_PROF = [[0, 26], [LEG_EXT, 29.6], [LEG_EXT + 11, 28.2], [LEG_EXT + 25, 25.6], [LEG_EXT + 31, 26.8]];
  const SHORTS_END = LEG_EXT + 31;
  const ARM_SKIN = [[0, 12], [ARM_EXT, 12.8], [ARM_EXT + 14, 11.4], [ARM_EXT + 29, 10], [ARM_EXT + 38, 9.6], [ARM_EXT + 55, 6.8]];
  const SLEEVE_PROF = [[0, 15], [ARM_EXT, 17.4], [ARM_EXT + 7, 17], [ARM_EXT + 13, 18]];
  const SLEEVE_END = ARM_EXT + 13;

  /* ---------------------------------------------------------------- body parts */
  function legParts(o, far) {
    const L = far ? 'F' : 'N', dark = far ? .8 : 1;
    const h = o['hip' + L], kn = o['knee' + L], dx = kn[0] - h[0], dy = kn[1] - h[1], dl = Math.hypot(dx, dy) || 1;
    const cv = curve([[h[0] - dx / dl * LEG_EXT, h[1] - dy / dl * LEG_EXT], h, kn, o['ankle' + L]], 34);
    const skin = tube(cv, LEG_SKIN, 0, 1e9), shorts = tube(cv, SHORTS_PROF, 0, SHORTS_END);
    return {
      outline: [g => skin.path(g), g => shorts.path(g)],
      paint(g) {
        paintTube(g, skin, PAL.skin, PAL.skinD, PAL.skinL, dark);
        paintTube(g, shorts, PAL.shorts, PAL.shortsD, PAL.shortsL, dark); grain(g, gg => shorts.path(gg), .2);
        // folds and hem of the shorts
        g.save(); shorts.path(g); g.clip(); g.strokeStyle = css(PAL.shortsD, .55, dark); g.lineWidth = .7; g.lineCap = 'round';
        for (const f of [.2, .42, .66]) { const c = shorts.Cn[Math.min(shorts.Cn.length - 1, Math.round(f * (shorts.Cn.length - 1)))]; g.beginPath(); g.moveTo(c[0] - c[2] * c[4] * .3, c[1] - c[3] * c[4] * .3); g.quadraticCurveTo(c[0] + c[2] * 1.2, c[1] + c[3] * 1.2 + 1.5, c[0] + c[2] * c[4] * .45, c[1] + c[3] * c[4] * .45 + 1); g.stroke(); }
        g.restore();
        const e = shorts.Cn[shorts.Cn.length - 1]; g.save(); g.strokeStyle = css(PAL.shortsD, .9, dark); g.lineWidth = 1.1; g.beginPath(); g.moveTo(e[0] - e[2] * e[4] / 2, e[1] - e[3] * e[4] / 2); g.lineTo(e[0] + e[2] * e[4] / 2, e[1] + e[3] * e[4] / 2); g.stroke();
        g.strokeStyle = css(PAL.shortsL, .6, dark); g.lineWidth = .7; g.beginPath(); g.moveTo(e[0] - e[2] * e[4] / 2, e[1] - e[3] * e[4] / 2 - .9); g.lineTo(e[0] + e[2] * e[4] / 2, e[1] + e[3] * e[4] / 2 - .9); g.stroke(); g.restore();
      }
    };
  }
  function shoePath(g) {                                  // origin at the ankle joint, +x forward, +y down, sole at y = ankleH
    const H = G.ankleH;
    g.beginPath(); g.moveTo(-6.4, -2.6); g.lineTo(3.6, -3.2);                              // collar
    g.quadraticCurveTo(6.2, -.2, 9, 1.2);                                                    // tongue / lace area
    g.quadraticCurveTo(15, 2.2, 18.6, 5.2); g.quadraticCurveTo(20.4, 6.6, 19.6, H - .6);   // toe cap
    g.lineTo(18.2, H); g.lineTo(-6.2, H); g.quadraticCurveTo(-7.8, H - 2, -7.2, 2); g.closePath();
  }
  function shoeParts(o, far) {
    const L = far ? 'F' : 'N', a = o['ankle' + L], rot = o['footRot' + L], dark = far ? .8 : 1;
    const tr = g => { g.translate(a[0], a[1]); g.rotate(rot); };
    return {
      outline: [g => { g.save(); tr(g); shoePath(g); g.restore(); }],
      paint(g) {
        g.save(); tr(g); shoePath(g); g.fillStyle = css(PAL.shoe, 1, dark); g.fill(); g.clip();
        const H = G.ankleH; g.fillStyle = css(PAL.sole, 1, dark); g.fillRect(-9, H - 3.1, 31, 3.4);                  // sole
        g.fillStyle = css(PAL.shoeD, .7, dark); g.fillRect(-9, H - 3.1, 31, .8);
        g.fillStyle = css(PAL.accent, .85, dark); g.beginPath(); g.moveTo(-6, 1.8); g.quadraticCurveTo(4, 3.2, 12, 5.6); g.lineTo(11.2, 6.6); g.quadraticCurveTo(3, 4.4, -6, 3.2); g.fill();   // side stripe
        g.strokeStyle = css(PAL.shoeD, .9, dark); g.lineWidth = .55; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(3.2 + i * 1.6, -1.6 + i * .5); g.lineTo(4.6 + i * 1.6, 1 + i * .5); g.stroke(); }   // laces
        g.fillStyle = css(PAL.shoeD, .35, dark); g.fillRect(-9, -4, 8, 7);                                            // heel shadow
        g.restore();
      }
    };
  }
  function armParts(o, far) {
    const L = far ? 'F' : 'N', dark = far ? .8 : 1;
    const sh = o['sh' + L], el = o['elbow' + L], dx = el[0] - sh[0], dy = el[1] - sh[1], dl = Math.hypot(dx, dy) || 1;
    const cv = curve([[sh[0] - dx / dl * ARM_EXT, sh[1] - dy / dl * ARM_EXT], sh, el, o['wrist' + L]], 30);
    const skin = tube(cv, ARM_SKIN, ARM_EXT + 8, 1e9), slv = tube(cv, SLEEVE_PROF, 0, SLEEVE_END, true);
    const ang = Math.atan2(cv[3].ty, cv[3].tx);
    return {
      outline: [g => skin.path(g), g => slv.path(g, true)],
      paint(g) {
        paintTube(g, skin, PAL.skin, PAL.skinD, PAL.skinL, dark);
        // sleeve with the real print
        slv.path(g); g.fillStyle = patternAt(g, o['sh' + L][0], o['sh' + L][1], ang, .22, 30, 190); g.fill();
        g.save(); slv.path(g); g.clip(); slv.strip(g, -.62, -.04); g.fillStyle = css([40, 28, 20], .38 * (far ? 1.4 : 1)); g.fill(); slv.strip(g, .12, .34); g.fillStyle = 'rgba(255,240,210,.14)'; g.fill();
        const e = slv.Cn[slv.Cn.length - 1]; g.strokeStyle = 'rgba(40,28,20,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(e[0] - e[2] * e[4] / 2, e[1] - e[3] * e[4] / 2); g.lineTo(e[0] + e[2] * e[4] / 2, e[1] + e[3] * e[4] / 2); g.stroke();
        if (far) { slv.path(g); g.fillStyle = 'rgba(20,14,10,.28)'; g.fill(); }
        g.restore();
      }
    };
  }
  function handPaint(g, o, far) {                          // a fist at the wrist, pointing along the forearm
    const L = far ? 'F' : 'N', w = o['wrist' + L], a = o['fAng' + L], dark = far ? .8 : 1;
    g.save(); g.translate(w[0], w[1]); g.rotate(PI / 2 - a); g.scale(1.18, 1.18);                           // +x along the forearm after this
    const p = () => { g.beginPath(); g.moveTo(-1.4, -3.9); g.quadraticCurveTo(4.5, -5.6, 8.4, -3.4); g.quadraticCurveTo(10.4, -1.2, 9.6, 2.4); g.quadraticCurveTo(8, 5.2, 4.6, 5.4); g.lineTo(-1.4, 4.2); g.closePath(); };
    g.lineJoin = 'round'; g.strokeStyle = css(PAL.ink, .95); g.lineWidth = 1.7; p(); g.stroke();
    p(); g.fillStyle = css(PAL.skin, 1, dark); g.fill(); g.save(); p(); g.clip(); g.fillStyle = css(PAL.skinD, .5, dark); g.fillRect(-3, 1.4, 16, 6); g.restore();
    g.strokeStyle = css(PAL.skinD, .9, dark); g.lineWidth = .6; for (const x of [3.2, 5.6, 8]) { g.beginPath(); g.moveTo(x, -4.6 + (x > 6 ? 1.2 : 0)); g.lineTo(x + .4, .6); g.stroke(); }   // finger lines
    g.beginPath(); g.ellipse(1.8, -4.4, 3.1, 1.7, -.2, 0, TAU); g.fillStyle = css(PAL.skinL, 1, dark); g.fill(); g.lineWidth = .9; g.strokeStyle = css(PAL.ink, .9); g.stroke();   // thumb
    g.restore();
  }

  function torsoPaint(inst, g, o) {
    const P = inst.P, bx = P.bellyX.x, by = P.bellyY.x, hem = P.hem, H0 = 8;
    g.save(); g.translate(o.T[0], o.T[1]); g.rotate(o.torso);
    const breathe = Math.sin(inst.t * 2.1) * .35;
    // silhouette (tee body), local cm, origin at the pelvis, up = -y
    const body = () => { g.beginPath(); g.moveTo(-11.2, 3); g.bezierCurveTo(-12.6, -10, -12.6, -26, -13.4, -38); g.bezierCurveTo(-14.6, -47, -14.8, -53, -9, -58); g.lineTo(-2.2, -61); g.lineTo(5.4, -60);
      g.bezierCurveTo(12.5, -56, 16.5 + breathe, -49, 17.6 + breathe + bx, -41); g.bezierCurveTo(20.8 + bx, -33, 23 + bx * 1.3, -22 + by, 20.4 + bx, -11 + by); g.bezierCurveTo(18, -4, 15, 0, 13.6, 4); g.closePath(); };
    // shirt panel: open at the front, hem hangs on springs
    const hx = [-12.8, -6.5, 0, 6.5, 12.6], hy = [H0 + 2.5, H0 + 3.2, H0 + 3.8, H0 + 3.2, H0 + 1.4];
    const shirt = () => {
      g.beginPath(); g.moveTo(-9, -58); g.bezierCurveTo(-15.4, -52, -15.6, -44, -14.8, -36); g.bezierCurveTo(-14, -22, -13.6, -10, -13.4, H0 + 2.5 + 0);
      for (let i = 0; i < 5; i++) { const px = hx[i] + hem[i].x.x, py = hy[i] + hem[i].y.x; if (i === 0) g.lineTo(px, py); else { const qx = (hx[i - 1] + hem[i - 1].x.x + px) / 2, qy = (hy[i - 1] + hem[i - 1].y.x + py) / 2 + 1.1; g.quadraticCurveTo(qx, qy, px, py); } }
      g.bezierCurveTo(16.4 + bx, 3, 19 + bx, -8, 19.4 + bx, -20 + by); g.bezierCurveTo(18.6, -32, 15.4, -43, 8.4, -52); g.lineTo(4.5, -59.5); g.closePath();
    };
    // outline of the whole torso block first (tee + shirt + shorts waist)
    g.lineJoin = 'round'; g.strokeStyle = css(PAL.ink, .85); g.lineWidth = 1.4; body(); g.stroke(); shirt(); g.stroke();
    // tee
    body(); g.fillStyle = css(PAL.tee); g.fill();
    g.save(); body(); g.clip(); g.fillStyle = css(PAL.teeD, .55); g.fillRect(-16, -62, 12, 70); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(14, -62, 10, 70); g.restore();
    // belt line + shorts waist
    g.fillStyle = css(PAL.belt); g.fillRect(-12, -4.6, 27.4 + bx, 3.4);
    // shirt with the print
    shirt(); g.fillStyle = patternAt(g, -16, -66, 0, .2); g.fill(); grain(g, shirt, .16);
    g.save(); shirt(); g.clip();
    const gr = g.createLinearGradient(-15, 0, 17, 0); gr.addColorStop(0, 'rgba(24,16,10,.42)'); gr.addColorStop(.5, 'rgba(24,16,10,.05)'); gr.addColorStop(1, 'rgba(255,238,205,.14)'); g.fillStyle = gr; g.fillRect(-18, -62, 40, 76);
    const gv = g.createLinearGradient(0, -62, 0, 12); gv.addColorStop(0, 'rgba(255,240,210,.12)'); gv.addColorStop(1, 'rgba(24,16,10,.14)'); g.fillStyle = gv; g.fillRect(-18, -62, 40, 76);
    g.strokeStyle = 'rgba(26,18,12,.42)'; g.lineWidth = .6; for (const q of [[-8, -42, -10, -14], [-2, -46, -4, -10], [4, -30, 3, -6]]) { g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[0] + 2.4, (q[1] + q[3]) / 2, q[2], q[3]); g.stroke(); }   // folds
    g.restore();
    // armhole shadow + collar
    g.fillStyle = 'rgba(26,18,12,.35)'; g.beginPath(); g.ellipse(-1.6, -48, 3.3, 7.5, .1, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-9, -58.4); g.lineTo(-2, -62.4); g.lineTo(5.4, -61); g.lineTo(8, -55.4); g.lineTo(3.6, -57.2); g.lineTo(-3.4, -57); g.closePath(); g.fillStyle = patternAt(g, 0, -60, .3, .22); g.fill(); g.strokeStyle = css(PAL.ink, .9); g.lineWidth = 1; g.stroke();
    // belt tail hanging from the buckle
    const ta = P.tail.x; g.save(); g.translate(15.6 + bx, -3); g.rotate(ta); g.beginPath(); g.moveTo(-1.1, 0); g.lineTo(1.4, 0); g.lineTo(1.5, 11.5); g.lineTo(-.6, 12.4); g.closePath(); g.fillStyle = css(PAL.belt); g.fill(); g.strokeStyle = css(PAL.ink, .9); g.lineWidth = .8; g.stroke(); g.restore();
    g.fillStyle = '#c9a94a'; g.fillRect(14, -4.7, 3.6, 4.2); g.strokeStyle = css(PAL.ink, .8); g.lineWidth = .6; g.strokeRect(14, -4.7, 3.6, 4.2);
    g.restore();
  }

  function headPaint(inst, g, o) {
    const M = R.meta, k = G.headCm / (M.headH), P = inst.P;
    g.save(); g.translate(o.neck[0], o.neck[1]); g.rotate(o.headRot);
    // neck
    g.lineWidth = 1.1; g.strokeStyle = css(PAL.ink, .85); g.beginPath(); g.moveTo(-4.8, 9); g.lineTo(5.6, 9); g.lineTo(4.6, -4.5); g.lineTo(-3.8, -4.5); g.closePath(); g.stroke();
    g.fillStyle = css(PAL.skinD); g.fill(); g.fillStyle = css(PAL.skin, .55); g.beginPath(); g.moveTo(.4, 9); g.lineTo(5.6, 9); g.lineTo(4.6, -4.5); g.lineTo(1.5, -4.5); g.closePath(); g.fill();
    g.scale(k, k); g.translate(-M.neck[0], -M.neck[1]);
    const jaw = P.jaw.x;
    // mouth interior (visible when the jaw drops)
    if (jaw > .09) {
      const mx = M.mouth[0], my = M.mouthY; g.save(); g.fillStyle = 'rgb(58,22,20)'; g.beginPath(); g.moveTo(mx - 14, my - 1); g.quadraticCurveTo(mx - 2, my + 3 + jaw * 28, mx + 7, my - 1.5); g.lineTo(mx + 7, my + 2); g.lineTo(mx - 14, my + 2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(240,236,228,.9)'; g.fillRect(mx - 9, my - 1.4, 14, 2.6); g.restore();
    }
    g.drawImage(R.img.head_up, 0, 0);
    g.save(); g.translate(M.hinge[0], M.hinge[1]); g.rotate(jaw * .42); g.translate(-M.hinge[0], -M.hinge[1]); g.drawImage(R.img.head_jaw, 0, 0); g.restore();
    // eyelid (blink) and brows
    if (P.lid > .1) { g.save(); g.fillStyle = css(PAL.skin, 1); g.beginPath(); g.ellipse(M.eye[0] + 1, M.eye[1], 7.5, 4.2 * P.lid, .08, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,24,16,.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(M.eye[0] - 6.5, M.eye[1] + 1); g.lineTo(M.eye[0] + 8, M.eye[1] + .6); g.stroke(); g.restore(); }
    g.restore();
  }

  /* ---------------------------------------------------------------- the whole figure */
  function drawRig(inst, g, held, drawHeld, p, t) {
    const o = inst.out;
    const farArm = armParts(o, true), farLeg = legParts(o, true), farShoe = shoeParts(o, true), nLeg = legParts(o, false), nShoe = shoeParts(o, false), nArm = armParts(o, false);
    // far arm, far leg, near leg (the shirt hem hangs over the shorts, so the legs go first), body, head, near arm
    outlineAll(g, farArm.outline, 1.25); farArm.paint(g); handPaint(g, o, true);
    outlineAll(g, farLeg.outline.concat(farShoe.outline), 1.25); farLeg.paint(g); farShoe.paint(g);
    outlineAll(g, nLeg.outline.concat(nShoe.outline), 1.25); nLeg.paint(g); nShoe.paint(g);
    torsoPaint(inst, g, o);
    headPaint(inst, g, o);
    outlineAll(g, nArm.outline, 1.25); nArm.paint(g); handPaint(g, o, false);
    if (held === 'bag' || held === 'clothes') drawHeld(g, held, o.wristN[0] - 2, o.wristN[1] + 2, p, t);
    return [o.wristN[0], o.wristN[1]];
  }
  R.ankleH = () => G.ankleH;
  R.geom = G;
  BB.rigV = R;
})();
