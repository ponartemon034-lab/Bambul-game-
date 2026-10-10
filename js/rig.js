/* ==========================================================================
   BB.rig - physical skeleton for the realistic hero (side view).
   The painted body is cut into 10 rigid parts (tools/build_rig.py -> assets/char/rig/):
     head, torso(+pelvis), upper arm, forearm(+hand), thigh/shin/foot for each leg; the far arm is a darker copy.
   Motion is procedural, not frame swapping:
     - feet are planted: the stance foot moves back at exactly ground speed (phase = distance travelled),
       the swing foot follows an arc; two-bone IK solves the knee, so legs bend like legs
     - hip height follows the legs (walk: inverted pendulum, run: spring)
     - every joint angle goes through a damped spring (second order): arms and head lag and overshoot a bit,
       transitions between walk / run / jump are smooth instead of snapping between poses
   Draw space: centimetres, origin at the FEET, up = -y, facing +x (same as js/character.js).
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const PI = Math.PI, TAU = PI * 2;
  const R = { ready: false, img: {}, rig: null, PX: 1.39 };

  /* ---------------------------------------------------------------- loading */
  (function load() {
    if (typeof Image === 'undefined' || typeof fetch === 'undefined') return;
    fetch('assets/char/rig/rig.json').then(r => r.ok ? r.json() : null).then(rig => {
      if (!rig || !rig.leg) return; R.rig = rig; R.PX = rig.pxPerCm || 1.39;
      const names = Object.keys(rig.parts).concat(['leg', 'legB', 'shoeB']); let left = names.length, bad = 0;
      names.forEach(n => {
        const im = new Image();
        im.onload = () => { if (--left === 0 && !bad) finish(); };
        im.onerror = () => { bad++; left--; };
        im.src = 'assets/char/rig/' + n + '.png'; R.img[n] = im;
      });
    }).catch(() => { });
  })();
  let G = null;     // geometry in cm, built once
  function finish() {
    const J = R.rig.joints, k = 1 / R.PX, L = R.rig.leg, rel = (a, b) => [(J[b][0] - J[a][0]) * k, (J[b][1] - J[a][1]) * k];
    G = {
      thigh: (L.sK - L.sH) * k, shin: (L.sA - L.sK) * k, extUp: L.sH * k, extDn: (L.L - L.sA) * k, halfW: L.half * k,
      ankleH: R.rig.ankleH * k, uarm: Math.hypot(J.elbow[0] - J.shoulder[0], J.elbow[1] - J.shoulder[1]) * k,
      farm: Math.hypot(J.wrist[0] - J.elbow[0], J.wrist[1] - J.elbow[1]) * k,
      neck: rel('T', 'neck'), sh: rel('T', 'shoulder'), eb: rel('shoulder', 'elbow'),
      bindLean: Math.atan2(143 - J.T[0], -(24 - J.T[1])),            // visual lean of the painted torso (hip -> head centre): lean 0 = upright
      bindU: Math.atan2(J.elbow[0] - J.shoulder[0], J.elbow[1] - J.shoulder[1]),
      bindF: Math.atan2(J.wrist[0] - J.elbow[0], J.wrist[1] - J.elbow[1]),
      bindFoot: R.rig.parts.shoe.bind
    };
    G.legMax = G.thigh + G.shin - .4;
    R.ready = true;
  }

  /* ------------------------------------------------------------ spring (2nd order, exact-ish semi-implicit) */
  function spring(v0, w, z) { return { x: v0, v: 0, w, z }; }
  function stepSpring(s, target, dt) {
    const n = Math.max(1, Math.ceil(dt / .008)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = s.w * s.w * (target - s.x) - 2 * s.z * s.w * s.v; s.v += a * h; s.x += s.v * h; }
    return s.x;
  }
  function wrapPi(a) { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; }
  const ease = u => u * u * (3 - 2 * u);

  /* ---------------------------------------------------------------- gait */
  const MODE = {
    walk: { D: .6, Lc: 104, hip: 76, bob: 1.5, lift: 9, lean: .07, aSw: .42, aFlex: .55, aFlexK: .45, hipSign: 1 },
    carry: { D: .6, Lc: 104, hip: 75.5, bob: 1.4, lift: 8, lean: .10, aSw: .12, aFlex: 1.05, aFlexK: .1, hipSign: 1 },
    run: { D: .38, Lc: 124, hip: 72, bob: 3.2, lift: 19, lean: .3, aSw: .78, aFlex: 1.5, aFlexK: .35, hipSign: -1 },
    stumble: { D: .45, Lc: 96, hip: 73, bob: 2.4, lift: 15, lean: .34, aSw: 1.0, aFlex: .7, aFlexK: .5, hipSign: -1 }
  };

  const LIFT = { v: 9 };
  function m0lift(m, u) { return LIFT.v * Math.sin(PI * u) * (1 + .35 * (1 - u)); }
  function targetsCycle(m, c, ctl) {
    LIFT.v = m.lift;
    const D = m.D, half = D * m.Lc / 2;
    const leg = ph => {                       // ph in [0,1): 0 = heel strike
      const q = ((ph % 1) + 1) % 1;
      if (q < D) {                              // stance: planted, foot goes from +half to -half under the hip
        const u = q / D, x = half - 2 * half * u;
        let ang = PI / 2, y = G.ankleH;
        if (u < .25) ang = PI / 2 + .22 * (1 - u / .25);                         // heel strike, toe up
        const ts = D < .5 ? .35 : .72; if (u > ts) { const d = ease((u - ts) / (1 - ts)); ang = PI / 2 - .75 * d; y += 17 * Math.sin(.75 * d); }   // heel lifts, toe-off
        return { x, y, ang, stance: true };
      }
      const u = (q - D) / (1 - D);
      // swing foot: cubic Hermite from -half to +half whose end velocities equal the ground speed, so the foot lifts off and lands
      // moving exactly like the floor (no braking / sliding at heel strike)
      const m = -2 * half * (1 - D) / D, u2 = u * u, u3 = u2 * u;
      const x = (2 * u3 - 3 * u2 + 1) * -half + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * half + (u3 - u2) * m;
      const lift = m0lift(m, u), toe = lerp(-.75, .22, ease(clamp((u - .15) / .85, 0, 1)));
      return { x, y: G.ankleH + 17 * Math.sin(.75) * (1 - ease(clamp(u * 2.2, 0, 1))) + lift, ang: PI / 2 + toe, stance: false };
    };
    const N = leg(c), F = leg(c + .5);
    const sw = Math.cos(TAU * c);
    const armN = { u: -m.aSw * sw, f: 0 }, armF = { u: m.aSw * sw * .8, f: 0 };
    armN.f = m.aFlex + m.aFlexK * armN.u; armF.f = m.aFlex + m.aFlexK * armF.u;
    const hip = m.hip + m.hipSign * m.bob * Math.cos(2 * TAU * (c - D / 2));
    const lean = m.lean + .03 * Math.sin(2 * TAU * c) * (m === MODE.run ? 1.4 : .6);
    return { hip, lean, head: -lean * .55 + .03 * Math.sin(2 * TAU * c + .8), N, F, armN, armF };
  }
  function targetsStand() {
    return { hip: 86, lean: .03, head: 0, N: { x: 5, y: G.ankleH, ang: PI / 2 }, F: { x: -9, y: G.ankleH, ang: PI / 2 }, armN: { u: .1, f: .35 }, armF: { u: -.08, f: .3 } };
  }
  /* any other state: the pose parameters of js/character.js (crouch, lean, head, arm angles) drive the same skeleton.
     Puppet arm angles are canvas rotations (clockwise +) of a hanging arm; the rig measures forward swing as +, hence the sign flip. */
  function targetsPose(pose, arm, t) {
    const cr = clamp(pose.crouch || 0, -6, 44), lift = pose.lift || 0, wide = 7 + cr * .16;
    const breathe = Math.sin(t * 2) * .45;
    return { hip: 86 - cr * 1.0 + lift + breathe * .5, lean: .03 + clamp(pose.lean || 0, -.5, .75) * .85 + Math.sin(t * .9) * .008, head: (arm && arm.head || 0) * 1.0,
      N: { x: wide, y: G.ankleH + lift, ang: PI / 2 }, F: { x: -wide - 2, y: G.ankleH + lift, ang: PI / 2 },
      armN: arm ? { u: -arm.aB, f: -arm.eB } : { u: .1, f: .35 }, armF: arm ? { u: -arm.aA, f: -arm.eA } : { u: -.08, f: .3 } };
  }
  function targetsAir(rising, ctl) {
    const up = rising;
    return { hip: 72, lean: up ? .16 : .08, head: up ? -.1 : 0,
      N: { x: up ? 16 : 11, y: up ? 34 : 14, ang: PI / 2 - (up ? .1 : .25) }, F: { x: up ? -20 : -9, y: up ? 20 : 9, ang: PI / 2 - (up ? .9 : .5) },
      armN: { u: up ? 1.9 : 1.2, f: .5 }, armF: { u: up ? -.55 : -.8, f: .7 } };
  }

  /* ---------------------------------------------------------------- instance */
  R.create = function () {
    const S = {};
    const ch = (name, v, w, z) => { S[name] = spring(v, w, z); };
    const inst = {
      S, init: false, mode: 'stand', cycle: 0, out: null,
      update(dt, ctl, st, held, pose, arm) {
        if (!R.ready) return;
        dt = Math.min(dt, .05);
        let tg, kind = 'stand';
        if (st === 'walk' || st === 'run' || st === 'carry') {
          const m = MODE[st]; kind = st;
          let c = (ctl.phase / TAU); c = c - Math.floor(c);
          tg = targetsCycle(m, c, ctl);
        } else if (st === 'jump' || st === 'fall') { kind = 'air'; tg = targetsAir(st === 'jump' && (!ctl || ctl.vy == null || ctl.vy > 60), ctl); }
        else if (st === 'stumble') { kind = 'stumble'; tg = targetsCycle(MODE.stumble, (ctl.t * 3.2) % 1, ctl); }
        else tg = pose ? targetsPose(pose, arm, ctl.t || 0) : targetsStand();
        if (inst.init && inst.mode !== kind) inst.blend = .3;           // mode change: soften the springs for a moment so the pose blends instead of jumping
        inst.mode = kind; inst.blend = Math.max(0, (inst.blend || 0) - dt);
        const bl = .3 + .7 * (1 - inst.blend / .3);
        const fresh = !inst.init;
        if (fresh) {
          ch('hip', tg.hip, 30, .9); ch('lean', tg.lean, 14, .8); ch('head', tg.head, 12, .55);
          for (const L of ['N', 'F']) { ch('x' + L, tg[L].x, 55, 1); ch('y' + L, tg[L].y, 55, 1); ch('a' + L, tg[L].ang, 45, .9); }
          for (const L of ['N', 'F']) { const a = tg['arm' + L]; ch('u' + L, a.u, 17, .62); ch('f' + L, a.f, 14, .5); }
          inst.init = true;
        }
        // stance feet and flight: stiff springs (they must stay planted); airborne / state changes: softer, so poses blend
        const soft = ((kind === 'air' || kind === 'stand') ? .55 : 1) * bl;
        S.hip.w = 30 * bl; S.lean.w = 14 * Math.max(.5, bl); stepSpring(S.hip, tg.hip, dt); stepSpring(S.lean, tg.lean, dt); stepSpring(S.head, tg.head, dt);
        for (const L of ['N', 'F']) {
          const f = tg[L]; S['x' + L].w = 55 * soft; S['y' + L].w = 55 * soft; S['a' + L].w = 45 * soft;
          stepSpring(S['x' + L], f.x, dt); stepSpring(S['y' + L], f.y, dt); stepSpring(S['a' + L], f.ang, dt);
          const a = tg['arm' + L]; S['u' + L].w = 17 * Math.max(.45, bl); S['f' + L].w = 14 * Math.max(.45, bl); stepSpring(S['u' + L], a.u, dt); stepSpring(S['f' + L], a.f, dt);
        }
        inst.out = solve(inst);
      },
      draw(g, held, drawHeld, p, t) { if (R.ready && inst.out) return drawRig(g, inst.out, held, drawHeld, p, t); }
    };
    return inst;
  };

  /* two-bone IK in canvas coordinates (y down), knee forward (+x) */
  function ik(hx, hy, ax, ay, l1, l2) {
    let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
    const mx = l1 + l2 - .4; if (d > mx) { ax = hx + dx / d * mx; ay = hy + dy / d * mx; dx = ax - hx; dy = ay - hy; d = mx; }
    if (d < 6) d = 6;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
    return { kx: hx + ux * a + uy * h, ky: hy + uy * a - ux * h, ax, ay };
  }
  function solve(inst) {
    const S = inst.S, hipY = -S.hip.x, out = { T: [0, hipY] };
    const al = S.lean.x - G.bindLean;                       // torso rotation (canvas, clockwise = forward)
    out.torso = al;
    const ca = Math.cos(al), sa = Math.sin(al), rot = (v) => [v[0] * ca - v[1] * sa, v[0] * sa + v[1] * ca];
    const nk = rot(G.neck), sh = rot(G.sh), far = rot([-5, 0]);
    out.neck = [nk[0], hipY + nk[1]]; out.sh = [sh[0], hipY + sh[1]];
    out.headRot = al + S.head.x;
    for (const L of ['N', 'F']) {
      const rx = L === 'F' ? far[0] : 0, ry = hipY + (L === 'F' ? far[1] : 0);
      const ax = S['x' + L].x + rx, ay = -S['y' + L].x;
      const k = ik(rx, ry, ax, ay, G.thigh, G.shin);
      out['hip' + L] = [rx, ry]; out['knee' + L] = [k.kx, k.ky]; out['ankle' + L] = [k.ax, k.ay];
      out['footRot' + L] = G.bindFoot - S['a' + L].x;
      const u = S['u' + L].x, f = S['f' + L].x, tf = u + f;
      if (L === 'N') {                                                    // near arm: the sleeve turns with the shoulder, the forearm hangs from the hem
        const rs = .36 * (G.bindU - u), cs = Math.cos(rs), ss = Math.sin(rs);
        out.sleeveRot = rs;
        const e = [G.eb[0] * cs - G.eb[1] * ss, G.eb[0] * ss + G.eb[1] * cs];
        out.elbowN = [out.sh[0] + e[0], out.sh[1] + e[1]];
        out.wristN = [out.elbowN[0] + Math.sin(tf) * G.farm, out.elbowN[1] + Math.cos(tf) * G.farm];
        out.fRotN = G.bindF - tf;
      } else {
        const sx = out.sh[0] - 4, sy = out.sh[1] + 1;
        out.shF = [sx, sy]; out.elbowF = [sx + Math.sin(u) * G.uarm, sy + Math.cos(u) * G.uarm]; out.fRotF = G.bindF - tf;
      }
    }
    return out;
  }

  function part(g, name, jx, jy, rot) {
    const P = R.rig.parts[name.replace(/B$/, '')] || R.rig.parts[name], im = R.img[name]; if (!im || !im.width) return;
    const k = 1 / R.PX;
    g.save(); g.translate(jx, jy); g.rotate(rot); g.scale(k, k); g.drawImage(im, -P.pivot[0], -P.pivot[1]); g.restore();
  }

  /* leg ribbon: the unrolled leg texture is bent along hip-knee-ankle slice by slice (no seams at the knee) */
  const CURVE = { x: new Float32Array(256), y: new Float32Array(256), c: new Float32Array(256), n: 0 };
  function buildCurve(h, kn, an) {
    const d1x = kn[0] - h[0], d1y = kn[1] - h[1], l1 = Math.hypot(d1x, d1y) || 1, d2x = an[0] - kn[0], d2y = an[1] - kn[1], l2 = Math.hypot(d2x, d2y) || 1;
    const pts = [[h[0] - d1x / l1 * G.extUp, h[1] - d1y / l1 * G.extUp], h, kn, an, [an[0] + d2x / l2 * G.extDn, an[1] + d2y / l2 * G.extDn]];
    const raw = []; let acc = [];
    for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let j = 0; j < n; j++) raw.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
    raw.push(pts[4]);
    const K = 6, N = raw.length, xs = CURVE.x, ys = CURVE.y; CURVE.n = Math.min(N, 255);
    for (let i = 0; i < CURVE.n; i++) { let sx = 0, sy = 0, c = 0; for (let j = -K; j <= K; j++) { const q = raw[Math.min(N - 1, Math.max(0, i + j))]; sx += q[0]; sy += q[1]; c++; } xs[i] = sx / c; ys[i] = sy / c; }
    CURVE.c[0] = 0; for (let i = 1; i < CURVE.n; i++) CURVE.c[i] = CURVE.c[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    const near = p => { let b = 0, bd = 1e9; for (let i = 0; i < CURVE.n; i++) { const d = Math.hypot(xs[i] - p[0], ys[i] - p[1]); if (d < bd) { bd = d; b = i; } } return CURVE.c[b]; };
    return { rH: near(h), rK: near(kn), rA: near(an), total: CURVE.c[CURVE.n - 1] };
  }
  function curveAt(r) {                                      // position + unit tangent at arclength r
    const c = CURVE.c, n = CURVE.n; r = clamp(r, 0, c[n - 1]);
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= r) lo = m; else hi = m; }
    const t = (r - c[lo]) / Math.max(c[hi] - c[lo], 1e-6), x = CURVE.x[lo] + (CURVE.x[hi] - CURVE.x[lo]) * t, y = CURVE.y[lo] + (CURVE.y[hi] - CURVE.y[lo]) * t;
    const a = Math.max(0, lo - 2), b = Math.min(n - 1, hi + 2), dx = CURVE.x[b] - CURVE.x[a], dy = CURVE.y[b] - CURVE.y[a], l = Math.hypot(dx, dy) || 1;
    return [x, y, dx / l, dy / l];
  }
  const OS = 2.2;
  function drawLeg(g, name, h, kn, an) {
    const im = R.img[name], L = R.rig.leg; if (!im || !im.width) return;
    const key = [h[0], h[1], kn[0], kn[1], an[0], an[1]].map(v => Math.round(v * 20)).join(',');       // same pose as last frame (standing still): reuse the offscreen result
    const hit = OFFKEY[name] === key && OFFBOX[name];
    if (hit && OFF[name]) { const b = OFFBOX[name]; g.drawImage(OFF[name], 0, 0, b.bw, b.bh, b.x0, b.y0, b.bw / OS, b.bh / OS); return; }
    const m = buildCurve(h, kn, an), k = 1 / R.PX;
    const rs = [0, m.rH - (m.rH > 0 ? 0 : 0), m.rK, m.rA, m.total], ts = [0, L.sH, L.sK, L.sA, L.L];
    // knots: texture arc (source px) -> curve arclength (cm)
    const ra = [0, m.rH, m.rK, m.rA, m.total];
    const map = s => { for (let i = 0; i < 4; i++) if (s <= ts[i + 1] || i === 3) { const t = (s - ts[i]) / Math.max(ts[i + 1] - ts[i], 1e-6); return ra[i] + (ra[i + 1] - ra[i]) * t; } return m.total; };
    const step = 1.7, hw = G.halfW;
    // the ribbon is drawn into a small offscreen canvas at a fixed 3 px/cm and blitted once: the result does not depend on the screen
    // scale (dynamic resolution!) and the slice seams can never show up as translucent hairlines
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < CURVE.n; i += 2) { x0 = Math.min(x0, CURVE.x[i]); x1 = Math.max(x1, CURVE.x[i]); y0 = Math.min(y0, CURVE.y[i]); y1 = Math.max(y1, CURVE.y[i]); }
    x0 -= hw + 3; y0 -= hw + 3; x1 += hw + 3; y1 += hw + 3;
    const bw = Math.ceil((x1 - x0) * OS), bh = Math.ceil((y1 - y0) * OS);
    const oc = OFF[name] || (OFF[name] = document.createElement('canvas'));
    if (oc.width < bw || oc.height < bh) { oc.width = Math.max(oc.width, bw); oc.height = Math.max(oc.height, bh); }
    const og = oc.getContext('2d'); og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, bw, bh);
    og.setTransform(OS, 0, 0, OS, -x0 * OS, -y0 * OS);
    for (let s0 = 0; s0 < L.L - .5; s0 += step) {
      let s1 = Math.min(L.L, s0 + step), r0 = map(s0), r1 = map(s1);
      const a = curveAt(r0), b = curveAt(r1), dth = Math.abs(Math.atan2(a[2] * b[3] - a[3] * b[2], a[2] * b[2] + a[3] * b[3]));
      const per = (s1 - s0) / Math.max(r1 - r0, 1e-4);                       // texture px per cm along this slice
      s1 = Math.min(L.L, s1 + 1.0 + hw * dth * per);                          // overlap: also covers the wedge that opens on the outer side of a bend
      r1 = map(s1);
      const rc = (r0 + r1) / 2, len = Math.max(.05, r1 - r0), p = curveAt(rc), nx = p[3], ny = -p[2];
      og.save(); og.transform(nx, ny, p[2], p[3], p[0], p[1]);
      og.drawImage(im, 0, s0 * L.res, L.w, Math.max(1, (s1 - s0) * L.res), -hw, -len / 2, 2 * hw, len); og.restore();
    }
    OFFKEY[name] = key; OFFBOX[name] = { bw, bh, x0, y0 };
    g.drawImage(oc, 0, 0, bw, bh, x0, y0, bw / OS, bh / OS);
  }
  const OFF = {}, OFFKEY = {}, OFFBOX = {};

  function drawRig(g, o, held, drawHeld, p, t) {
    // far arm and far leg behind the body
    { const ex = o.elbowF[0], ey = o.elbowF[1];
      g.save(); g.lineCap = 'round'; g.strokeStyle = '#20180f'; g.lineWidth = 11.5; g.beginPath(); g.moveTo(o.shF[0], o.shF[1]); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = '#7a6a48'; g.lineWidth = 9.2; g.stroke(); g.restore();
      part(g, 'forearmB', ex, ey, o.fRotF); }
    drawLeg(g, 'legB', o.hipF, o.kneeF, o.ankleF); part(g, 'shoeB', o.ankleF[0], o.ankleF[1], o.footRotF);
    part(g, 'torso', o.T[0], o.T[1], o.torso);
    part(g, 'head', o.neck[0], o.neck[1], o.headRot);
    drawLeg(g, 'leg', o.hipN, o.kneeN, o.ankleN); part(g, 'shoe', o.ankleN[0], o.ankleN[1], o.footRotN);
    part(g, 'forearm', o.elbowN[0], o.elbowN[1], o.fRotN);
    part(g, 'sleeve', o.sh[0], o.sh[1], o.sleeveRot);
    if (held === 'bag' || held === 'clothes') drawHeld(g, held, o.wristN[0] - 2, o.wristN[1] + 2, p, t);
    return [o.wristN[0], o.wristN[1]];
  }
  R.ankleH = () => G ? G.ankleH : 16;
  BB.rig = R;
})();
