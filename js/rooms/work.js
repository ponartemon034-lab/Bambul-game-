/* ==========================================================================
   WORKSHOP / HOBBY CORNER  (room id 'work', width 700, world x 2600..3300)
   Cool techy mess: painted brick, steel, rubber mat, monitor glow, filament colours.
   Hero prop: enclosed desktop 3D printer + AMS (original design, no logos).
   Exports BB.work.printerPortrait(g,w,h,stage,t,opt) for the minigame UI.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const A = BB.art, { clamp, lerp, srand } = BB.U;
  const W = BB.work = BB.work || {};
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------ tiny helpers */
  const RC = A.rect, RR = A.rrect, EL = A.ell, PO = A.poly, LN = A.line;
  const flags = S => (S && S.f) || {};
  const hsl = (h, s, l, a) => 'hsla(' + (h % 360 | 0) + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';
  const FIL = ['#2fc267', '#f08a2c', '#e8e8e2', '#2f6fe0', '#d63a3a', '#f2cf3a', '#8a4fd0', '#e86aa6', '#1e1f24', '#33c3c9', '#9aa3a8', '#b5651d', '#7ad04a', '#f5f0d0'];

  /* ---------------------------------------------------------- printer state */
  function pstate(S) {
    const f = flags(S), stage = clamp((f.printerStage | 0), 0, 4), fixed = !!f.printerFixed;
    const err = !fixed && (!!f.printerError || stage > 0);
    const printing = !err && !!f.printerPrinting;
    return {
      stage, fixed, err, printing,
      idle: !err && !printing && !fixed,
      done: fixed && !printing,
      door: err && stage >= 1 && stage <= 3,
      tubeOff: err && (stage === 2 || stage === 3),
      jam: err && stage <= 2,
      blob: err && stage <= 2,
      led: err ? (stage <= 2 ? 'red' : stage === 3 ? 'amber' : 'green') : (printing || fixed) ? 'green' : 'idle'
    };
  }
  W.state = pstate;
  const LEDC = { red: '255,60,45', amber: '255,176,40', green: '70,255,130', idle: '150,210,255' };
  function ledOn(st, t) {
    if (st.led === 'red') return st.stage === 0 ? (Math.sin(t * 9) > -.2) : (Math.sin(t * 4) > 0);
    return true;
  }

  /* ---------------------------------------------------------------- spools */
  function spool(g, cx, cy, R, col, seed, o) {
    o = o || {};
    const r = srand(seed || 1), Ri = R * .44, Ro = R * .9;
    g.save();
    // flange (translucent plastic)
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = o.flange || '#c9ced1'; g.fill();
    g.fillStyle = A.rg(g, cx - R * .3, cy - R * .35, 0, R * 1.1, ['rgba(255,255,255,.55)', 'rgba(0,0,0,.28)']); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    if (!o.empty) {
      g.beginPath(); g.arc(cx, cy, Ro, 0, TAU); g.arc(cx, cy, Ri, 0, TAU, true); g.fillStyle = col; g.fill('evenodd');
      g.lineWidth = .35;
      for (let rr = Ri + .5; rr < Ro; rr += .85) { g.strokeStyle = r() < .5 ? 'rgba(255,255,255,.17)' : 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); }
      g.fillStyle = A.rg(g, cx, cy, Ri, Ro, ['rgba(0,0,0,.42)', 'rgba(0,0,0,0)', 'rgba(255,255,255,.12)']); g.beginPath(); g.arc(cx, cy, Ro, 0, TAU); g.arc(cx, cy, Ri, 0, TAU, true); g.fill('evenodd');
    } else { g.beginPath(); g.arc(cx, cy, Ro, 0, TAU); g.arc(cx, cy, Ri, 0, TAU, true); g.fillStyle = 'rgba(40,40,44,.35)'; g.fill('evenodd'); }
    // hub (cardboard core) + hole
    EL(g, cx, cy, Ri, Ri, '#b9976a'); EL(g, cx, cy, Ri * .5, Ri * .5, '#1b1b1f');
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .3; g.beginPath(); g.arc(cx, cy, Ri, 0, TAU); g.stroke();
    // flange spokes cut-outs
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + .3; g.fillStyle = 'rgba(30,32,36,.28)'; g.beginPath(); g.ellipse(cx + Math.cos(a) * R * .66, cy + Math.sin(a) * R * .66, R * .09, R * .06, a, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = .45; g.beginPath(); g.arc(cx, cy, R - .25, -2.6, -1.3); g.stroke();
    g.restore();
  }
  W.spool = spool;

  /* ================================================================ PRINTER
     local space 70 x 88 cm: body x 13..57, y 42..88 (44 x 46); AMS x 15..55, y 8..41 (40 x 33) */
  const PW = 70, PH = 88, PS = 1.12;   // PS: slight cartoon enlargement of the hero prop for readability
  const CH = { x0: 16.5, x1: 53.5, y0: 46.5, y1: 78 };           // chamber window
  const BED_Y = 69.5, BED_X0 = 19.5, BED_X1 = 50.5, CX = 35;
  const AMS_COL = [FIL[0], FIL[1], FIL[2], FIL[3]];
  const HUB = { x: 59.5, y: 36 };

  // pre-built spaghetti (Path2D, cm)
  let SPAG = null;
  function spaghetti() {
    if (SPAG) return SPAG;
    const r = srand(77); SPAG = [];
    for (let i = 0; i < 46; i++) {
      const p = new Path2D(); let x = 24 + r() * 22, y = BED_Y - .5; p.moveTo(x, y);
      const n = 5 + (r() * 6 | 0);
      for (let k = 0; k < n; k++) { const nx = clamp(x + (r() - .5) * 15, 20, 50), ny = clamp(y - 1 - r() * 5, 54, BED_Y); p.bezierCurveTo(x + (r() - .5) * 12, y - r() * 5, nx + (r() - .5) * 12, ny + r() * 3, nx, ny); x = nx; y = ny; }
      SPAG.push({ p, c: r() < .5 ? '#2fc267' : r() < .6 ? '#27a85a' : '#5fe08c', w: .5 + r() * .55 });
    }
    return SPAG;
  }

  function printerShell(g) {
    A.contact(g, 35, 87.4, 56, .55);
    // body
    g.fillStyle = A.lg(g, 13, 0, 57, 0, ['#4a5057', '#2a2e33', '#202328', '#1a1d21']); g.beginPath(); g.roundRect(13, 42, 44, 46, 1.6); g.fill();
    RC(g, 13.4, 42.4, 43.2, .7, 'rgba(255,255,255,.28)'); RC(g, 13.4, 42.4, .7, 45, 'rgba(255,255,255,.14)'); RC(g, 56.2, 42.4, .6, 45, 'rgba(0,0,0,.4)');
    // top plate with handle recess
    RR(g, 12, 40.6, 46, 4.2, 1.4, A.lg(g, 0, 40, 0, 45, ['#5a6169', '#33383e']));
    RC(g, 12.4, 40.8, 45, .6, 'rgba(255,255,255,.35)');
    RR(g, 28, 41.6, 14, 1.3, .6, 'rgba(0,0,0,.45)');
    // chamber back wall
    RC(g, CH.x0 - 1, CH.y0 - 1, CH.x1 - CH.x0 + 2, CH.y1 - CH.y0 + 2, '#101215');
    RC(g, CH.x0, CH.y0, CH.x1 - CH.x0, CH.y1 - CH.y0, A.lg(g, 0, CH.y0, 0, CH.y1, ['#3b4148', '#23272c']));
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = .3; for (let x = CH.x0 + 3; x < CH.x1; x += 3.4) { g.beginPath(); g.moveTo(x, CH.y0); g.lineTo(x, CH.y1); g.stroke(); }
    RC(g, CH.x0, CH.y0, CH.x1 - CH.x0, 1, '#ece8da');                        // chamber LED strip
    RC(g, CH.x0, CH.y1 - 8, CH.x1 - CH.x0, 8, 'rgba(0,0,0,.18)');
    // left/right pillars shading
    RC(g, CH.x0 - 1, CH.y0, 1, CH.y1 - CH.y0, 'rgba(0,0,0,.5)'); RC(g, CH.x1, CH.y0, 1, CH.y1 - CH.y0, 'rgba(0,0,0,.5)');
    // front base panel
    RR(g, 13.6, 78.6, 42.8, 9, .8, A.lg(g, 0, 78, 0, 88, ['#3a3f45', '#1c1f23']));
    RC(g, 14, 78.7, 42, .7, 'rgba(255,255,255,.2)');
    RR(g, 18, 85.2, 11, 1.1, .5, 'rgba(255,255,255,.1)');                      // vent slit
    RR(g, 18, 82.8, 5, 1, .5, 'rgba(0,0,0,.5)');                               // usb slot
    // screen bezel
    RR(g, 34.4, 79.3, 20, 8, 1, '#0b0c0e'); RC(g, 34.8, 79.6, 19.2, .4, 'rgba(255,255,255,.12)');
    // knob / button
    EL(g, 30, 83.6, 1.5, 1.5, '#15171a'); EL(g, 29.7, 83.3, .5, .5, 'rgba(255,255,255,.4)');
    // feet
    RC(g, 15, 87.2, 5, .8, '#0c0d0f'); RC(g, 50, 87.2, 5, .8, '#0c0d0f');
    // rear spool-holder bracket under AMS (shadow)
    RC(g, 14, 41, 42, 1.4, 'rgba(0,0,0,.5)');

    // ---- AMS (multi-spool feeder) -----------------------------------------
    RR(g, 14.5, 7.5, 41, 33.6, 2, A.lg(g, 14, 0, 56, 0, ['#4c525a', '#2f3338', '#272a2f']));
    RC(g, 15, 7.9, 40, .8, 'rgba(255,255,255,.3)');
    RC(g, 15.5, 38.2, 39, 2.6, '#1b1d21'); RC(g, 15.5, 38.2, 39, .4, 'rgba(255,255,255,.12)');
    // smoked window
    RR(g, 16.4, 10, 37.2, 27, 1.2, '#0d0f12');
    for (let i = 0; i < 4; i++) {
      const x = 17.2 + i * 9.1, w = 8.5, col = AMS_COL[i];
      RR(g, x, 11.2, w, 24.8, 1.6, '#25282c');
      // wound filament on the spool, seen edge-on between two flanges
      g.fillStyle = A.lg(g, x, 0, x + w, 0, [A.shade(col.length === 7 ? col : '#888888', .55), col, A.shade(col, .7)]); g.fillRect(x + 1, 12, w - 2, 23.2);
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = .25; for (let y = 13; y < 35; y += 1.6) { g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + w - 1, y); g.stroke(); }
      RC(g, x, 11.4, 1.1, 24.4, 'rgba(210,216,220,.55)'); RC(g, x + w - 1.1, 11.4, 1.1, 24.4, 'rgba(210,216,220,.4)');   // flanges
      RC(g, x + w / 2 - .3, 12, .6, 23, 'rgba(255,255,255,.14)');
      EL(g, x + w / 2, 11.6, w * .38, .7, 'rgba(255,255,255,.28)');
      // slot dot
      EL(g, x + w / 2, 37.2, .55, .55, '#d7dde0');
    }
    // lid reflection
    PO(g, [16.4, 10, 30, 10, 21, 37, 16.4, 37], 'rgba(255,255,255,.07)');
    PO(g, [36, 10, 40, 10, 31, 37, 27, 37], 'rgba(255,255,255,.05)');
    RR(g, 16.4, 10, 37.2, 27, 1.2, null || 'rgba(0,0,0,0)');
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .5; g.strokeRect(16.4, 10, 37.2, 27);
    // lid handle
    RR(g, 29, 8.2, 12, 1.2, .6, 'rgba(0,0,0,.45)');
    // AMS-to-hub colour tubes along the top plate gap
    for (let i = 0; i < 4; i++) {
      const x = 21.4 + i * 9.1, yy = 38.9 + (i % 2) * .65 + (i > 1 ? .2 : 0);
      g.strokeStyle = 'rgba(15,17,20,.8)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x, 37.2); g.lineTo(x, yy); g.lineTo(56, yy); g.stroke();
      g.strokeStyle = AMS_COL[i]; g.lineWidth = .6; g.beginPath(); g.moveTo(x, 37.2); g.lineTo(x, yy); g.lineTo(56, yy); g.stroke();
    }
    // hub block at the right side of the AMS
    RR(g, HUB.x - 2.6, HUB.y - 3.6, 5.2, 7.2, 1, A.lg(g, HUB.x - 3, 0, HUB.x + 3, 0, ['#8d949b', '#4c5258']));
    EL(g, HUB.x, HUB.y + 3.7, 1.1, .8, '#15171a');
    RC(g, 55, 36.6, 3, 3, 'rgba(0,0,0,.35)');
    // small hot-end warning sticker on the body
    RR(g, 14.5, 80.2, 3.6, 3.6, .6, '#d9b13a'); PO(g, [16.3, 80.8, 17.6, 83.2, 15, 83.2], '#222');
  }

  // path of the PTFE tube (outside part)
  function tubeOut(g) { g.moveTo(HUB.x, HUB.y + 4); g.bezierCurveTo(HUB.x + 3.4, HUB.y + 7, 63.6, 44, 63.4, 50); g.bezierCurveTo(63.4, 55, 60.5, 57, 56.5, 57); }
  function headPos(st, t, o) {
    let prog = o.prog != null ? o.prog : ((t * .025) % 1);
    if (st.done) prog = 1;
    let ph = 0, hx = 30, ry;
    const Hh = st.printing || st.done ? 1.5 + prog * 8.5 : st.idle ? 2 : 0;
    ry = BED_Y - Hh - 10.8;
    if (st.printing) hx = CX - 1 + Math.sin(t * 2.7) * 7 + Math.sin(t * 6.1) * 1.7;
    else if (st.err) hx = st.stage <= 2 ? 40 + Math.sin(t * 25) * (st.stage === 0 ? .15 : 0) : st.stage === 3 ? 27 : 34;
    else if (st.done) hx = 46;
    else hx = 24;
    if (st.err && st.stage <= 2) ry = 55.5;                        // head sunk into the spaghetti
    if (st.err && st.stage >= 3) ry = 51.5;
    return { hx, ry, prog, Hh };
  }
  W.tubePoints = function (st, t) { // approximate polyline for highlight (printer local cm)
    const hp = headPos(st, t || 0, {}), pts = [[AMS_COL.length, 0]];
    return hp;
  };

  function drawTube(g, st, t, hp, o) {
    const hx = hp.hx, ry = hp.ry;
    const col = st.jam || (!st.err) || st.stage === 4 ? '#2fc267' : null;      // filament inside
    const seg = (fn, w1, c1) => { g.beginPath(); fn(); g.lineWidth = w1; g.strokeStyle = c1; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); };
    const inner = () => { g.moveTo(54, 57); g.bezierCurveTo(50, 57 + 4.5, hx + 3, ry - 3, hx, ry - .6); };
    const hl = o.highlight;
    if (hl) {                                                       // glowing route for the minigame
      const pul = .55 + .45 * Math.sin(t * 5);
      g.save(); g.lineCap = 'round'; g.globalAlpha = .5 * pul + .25;
      seg(() => { tubeOut(g); }, 4.6, 'rgba(255,214,70,.55)');
      if (!st.tubeOff) { g.save(); g.beginPath(); g.rect(CH.x0, CH.y0, CH.x1 - CH.x0 + 1, CH.y1 - CH.y0); g.clip(); seg(inner, 4.2, 'rgba(255,214,70,.55)'); g.restore(); }
      g.restore();
    }
    if (!st.tubeOff) {
      seg(() => { tubeOut(g); }, 2.3, 'rgba(10,12,14,.8)'); seg(() => { tubeOut(g); }, 1.8, 'rgba(228,236,240,.62)');
      if (col) seg(() => { tubeOut(g); }, .8, st.stage === 4 ? '#3ee283' : col);
      g.save(); g.beginPath(); g.rect(CH.x0, CH.y0, CH.x1 - CH.x0 + 1, CH.y1 - CH.y0); g.clip();
      seg(inner, 2.3, 'rgba(10,12,14,.8)'); seg(inner, 1.8, 'rgba(228,236,240,.62)');
      if (col) seg(inner, .8, col);
      g.restore();
      if (st.stage === 4 || st.printing) {                         // feeding sparkle moving along
        const u = (t * .9) % 1; g.fillStyle = 'rgba(210,255,225,.85)';
        const px = lerp(HUB.x, 63.4, Math.min(1, u * 2)), py = lerp(HUB.y + 4, 50, Math.min(1, u * 2)); g.beginPath(); g.arc(px, py, .55, 0, TAU); g.fill();
      }
      // frayed green bulge stuck in the tube
      if (st.jam) {
        g.save(); g.translate(63.4, 47.5);
        EL(g, 0, 0, 1.45, 3.2, 'rgba(30,150,80,.95)'); EL(g, -.2, -.4, .8, 2.3, '#43dc84');
        g.strokeStyle = '#3fd882'; g.lineWidth = .28;
        for (let i = 0; i < 6; i++) { const a = -2.5 + i * .9; g.beginPath(); g.moveTo(Math.cos(a) * .9, Math.sin(a) * 2.2); g.bezierCurveTo(Math.cos(a) * 2.5, Math.sin(a) * 3.6, Math.cos(a + .8) * 3.8, Math.sin(a) * 3, Math.cos(a) * 3 + (i % 2 ? 1.2 : -1.4), Math.sin(a) * 3.6 + 1); g.stroke(); }
        g.restore();
        // ring marking the clog while highlighted
        if (hl) { g.strokeStyle = 'rgba(255,90,70,' + (.5 + .5 * Math.sin(t * 6)) + ')'; g.lineWidth = .5; g.beginPath(); g.arc(63.4, 47.5, 4.6, 0, TAU); g.stroke(); }
      }
    } else {
      // detached: tube end hangs down the right side and lies in a loose coil on the bench
      const hang = () => { g.moveTo(HUB.x, HUB.y + 4); g.bezierCurveTo(HUB.x + 3.4, HUB.y + 7, 63.6, 44, 63.4, 52); g.bezierCurveTo(63.2, 62, 62.6, 70, 63.5, 78); };
      const coil = () => { g.moveTo(63.5, 78); g.bezierCurveTo(68, 79.5, 69.5, 84, 65, 86); g.bezierCurveTo(60.5, 87.4, 59.5, 83, 63.5, 82.4); g.bezierCurveTo(66.2, 82.1, 66.6, 84.3, 64.6, 84.6); };
      seg(hang, 2.3, 'rgba(10,12,14,.8)'); seg(hang, 1.8, 'rgba(228,236,240,.62)');
      seg(coil, 2.3, 'rgba(10,12,14,.8)'); seg(coil, 1.8, 'rgba(228,236,240,.66)');
      if (st.stage === 2) { seg(hang, .8, '#2fc267'); seg(coil, .8, '#2fc267'); }
      // metal collet at the free end
      RR(g, 63.4, 84, 2.4, 1.6, .5, '#aeb6bd'); RC(g, 63.4, 84, 2.4, .4, '#e5eaee');
      if (hl) { g.strokeStyle = 'rgba(255,214,70,' + (.55 + .45 * Math.sin(t * 5)) + ')'; g.lineWidth = .5; g.beginPath(); g.arc(64.2, 84.8, 3.4, 0, TAU); g.stroke(); }
    }
    // removed green clog lying on the bench (stage 3)
    if (st.err && st.stage === 3) {
      g.strokeStyle = '#2fc267'; g.lineWidth = .7; g.lineCap = 'round'; g.beginPath(); g.moveTo(2.5, 87); g.bezierCurveTo(4, 84.2, 5.4, 88.3, 7, 85.6); g.bezierCurveTo(8.2, 83.6, 9.4, 87.6, 11, 86.3); g.stroke();
    }
  }

  function drawScreen(g, st, t, big) {
    const x = 35.2, y = 80.1, w = 18.6, h = 6.4;
    let bg = '#142230', fg = '#cfe9ff';
    if (st.err) bg = st.stage <= 2 ? '#3a1013' : st.stage === 3 ? '#352607' : '#0f2a1a';
    else if (st.printing || st.done) bg = '#0f2a1a';
    RC(g, x, y, w, h, bg);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (st.err && st.stage <= 2) {
      const on = Math.sin(t * 6) > -.3;
      RC(g, x, y, w, 1.5, on ? '#ff3b30' : '#7a1d1a');
      EL(g, x + 3, y + 3.9, 1.7, 1.7, '#ff3b30'); RC(g, x + 2.65, y + 2.9, .7, 1.3, '#fff'); RC(g, x + 2.65, y + 4.5, .7, .6, '#fff');
      RC(g, x + 6, y + 2.7, 9, .7, 'rgba(255,255,255,.7)'); RC(g, x + 6, y + 4, 6.5, .7, 'rgba(255,255,255,.4)');
    } else if (st.err && st.stage === 3) {
      RC(g, x, y, w, 1.5, '#f0a020'); RC(g, x + 2, y + 2.8, 12, .8, 'rgba(255,255,255,.6)'); RC(g, x + 2, y + 4.4, 9, .8, 'rgba(255,255,255,.35)');
    } else if (st.err) {
      RC(g, x, y, w, 1.5, '#2fc267'); RC(g, x + 2, y + 2.8, 14, .8, 'rgba(255,255,255,.6)'); EL(g, x + 15.4, y + 4.5, 1.2, 1.2, '#3ee283');
    } else if (st.printing) {
      RC(g, x, y, w, 1.4, '#2fc267'); const p = (performance.now() / 40000) % 1; RC(g, x + 1.5, y + 3.2, 12, 1.2, 'rgba(255,255,255,.2)'); RC(g, x + 1.5, y + 3.2, 12 * p, 1.2, '#3ee283'); RC(g, x + 14, y + 2.8, 3.5, 1.8, 'rgba(255,255,255,.6)');
    } else if (st.done) {
      RC(g, x, y, w, 1.4, '#2fc267'); RC(g, x + 1.5, y + 3.2, 12, 1.2, '#3ee283'); g.strokeStyle = '#fff'; g.lineWidth = .55; g.beginPath(); g.moveTo(x + 14.5, y + 3.7); g.lineTo(x + 15.6, y + 4.8); g.lineTo(x + 17.2, y + 2.6); g.stroke();
    } else {
      RC(g, x, y, w, 1.4, '#2b6fa8'); EL(g, x + 4, y + 4.2, 1.6, 1.6, 'rgba(160,210,255,.7)'); RC(g, x + 7, y + 3.4, 8, .7, 'rgba(255,255,255,.4)'); RC(g, x + 7, y + 4.8, 5, .7, 'rgba(255,255,255,.25)');
    }
    if (big) {
      g.fillStyle = fg; g.font = '700 1.7px sans-serif'; g.textBaseline = 'top';
      const txt = st.err ? (st.stage <= 2 ? 'ОШИБКА ПОДАЧИ' : st.stage === 3 ? 'ТРУБКА ЧИСТАЯ' : 'ГОТОВ К ТЕСТУ') : st.printing ? 'ПЕЧАТЬ…' : st.done ? 'ГОТОВО' : 'ОЖИДАНИЕ';
      g.fillText(txt, x + 5.8, y + 2.3);
    }
    g.restore();
    g.fillStyle = A.lg(g, x, y, x + w, y + h, ['rgba(255,255,255,.14)', 'rgba(255,255,255,0)', 'rgba(255,255,255,.06)']); g.fillRect(x, y, w, h);
  }

  function drawPrintChamber(g, st, t, hp) {
    g.save(); g.beginPath(); g.rect(CH.x0, CH.y0, CH.x1 - CH.x0, CH.y1 - CH.y0); g.clip();
    // X gantry (two rails) -- drawn behind head
    const ry = hp.ry;
    RC(g, CH.x0, ry + 2.6, CH.x1 - CH.x0, 1.1, 'rgba(0,0,0,.4)');
    RC(g, CH.x0, ry + 1.2, CH.x1 - CH.x0, .8, A.lg(g, 0, ry + 1, 0, ry + 2, ['#e3e8ec', '#7d868d']));
    RC(g, CH.x0, ry + 3.3, CH.x1 - CH.x0, .8, A.lg(g, 0, ry + 3, 0, ry + 4, ['#cfd5da', '#6d767d']));
    // Z lift screws / sides
    RC(g, CH.x0 + .5, CH.y0, 1.2, CH.y1 - CH.y0, '#585f66'); RC(g, CH.x1 - 1.7, CH.y0, 1.2, CH.y1 - CH.y0, '#585f66');
    // heated bed (edge-on slab) + build plate
    RC(g, BED_X0 - 1.5, BED_Y + 2.3, BED_X1 - BED_X0 + 3, 6, '#14161a');
    RC(g, BED_X0 - 1, BED_Y + 1.4, BED_X1 - BED_X0 + 2, 1.6, '#3a4046');
    RC(g, BED_X0, BED_Y - .1, BED_X1 - BED_X0, 1.6, A.lg(g, 0, BED_Y, 0, BED_Y + 1.6, ['#d6b560', '#9a7f3c']));      // textured plate
    RC(g, BED_X0, BED_Y - .1, BED_X1 - BED_X0, .35, 'rgba(255,255,255,.6)');
    // contents on the plate
    const pw = 12.5;
    if (st.blob) {
      for (const s of spaghetti()) { g.strokeStyle = s.c; g.lineWidth = s.w; g.lineCap = 'round'; g.stroke(s.p); }
      EL(g, 35, BED_Y - 1.2, 11, 2.2, 'rgba(25,120,66,.9)');
      g.strokeStyle = '#43dc84'; g.lineWidth = .35; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(25 + i * 2.2, BED_Y - 1); g.lineTo(27 + i * 2.2 - (i % 3), BED_Y - 4 - (i * 7 % 5)); g.stroke(); }
      // failed base layers peeling away from the plate
      PO(g, [22, BED_Y, 26, BED_Y - 2.2, 24, BED_Y - .2], '#1b7a45');
    } else if (st.printing || st.done) {
      const h = hp.Hh;
      if (h > 0) {
        g.save(); g.beginPath();
        const n = 14; const prof = y => 4.3 + 1.7 * Math.sin(y * .75) + (y < 1 ? 1.2 : 0);
        g.moveTo(CX - prof(0), BED_Y);
        for (let i = 1; i <= n; i++) { const yy = h * i / n; g.lineTo(CX - prof(yy), BED_Y - yy); }
        for (let i = n; i >= 0; i--) { const yy = h * i / n; g.lineTo(CX + prof(yy), BED_Y - yy); }
        g.closePath(); g.fillStyle = A.lg(g, CX - 7, 0, CX + 7, 0, ['#1d9b53', '#43dc84', '#27b564', '#17753d']); g.fill();
        g.clip(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = .18; for (let y = BED_Y - h; y < BED_Y; y += .5) { g.beginPath(); g.moveTo(CX - 10, y); g.lineTo(CX + 10, y); g.stroke(); }
        g.restore();
      }
    } else if (st.idle) {
      RC(g, CX - 2.5, BED_Y - 4.6, 5, 4.6, '#e8e8e2'); RC(g, CX - 2.5, BED_Y - 4.6, 5, .6, 'rgba(255,255,255,.9)'); RC(g, CX + 2.2, BED_Y - 4.6, .6, 4.6, 'rgba(0,0,0,.2)');
    }
    // toolhead
    const hx = hp.hx;
    if (!(st.err && st.stage <= 2 && false)) {
      RR(g, hx - 4.1, ry - .2, 8.2, 8.2, 1.2, A.lg(g, hx - 4, 0, hx + 4, 0, ['#8d959c', '#4d555c', '#2c3238']));
      RC(g, hx - 3.6, ry + 4.2, 7.2, 3, '#14171a');                                  // fan duct
      EL(g, hx, ry + 3.2, 1.9, 1.9, '#111317'); g.strokeStyle = 'rgba(160,170,180,.5)'; g.lineWidth = .22; g.beginPath(); g.arc(hx, ry + 3.2, 1.6, 0, TAU); g.stroke();
      const sp = st.printing ? t * 30 : 0; g.strokeStyle = 'rgba(200,210,220,.5)'; g.beginPath(); g.moveTo(hx + Math.cos(sp) * 1.5, ry + 3.2 + Math.sin(sp) * 1.5); g.lineTo(hx - Math.cos(sp) * 1.5, ry + 3.2 - Math.sin(sp) * 1.5); g.stroke();
      RC(g, hx - 1.7, ry + 7.8, 3.4, 2.1, '#c98a3a'); RC(g, hx - 1.7, ry + 7.8, 3.4, .5, '#f0c070');   // heater block
      PO(g, [hx - 1, ry + 9.9, hx + 1, ry + 9.9, hx, ry + 11.1], '#d6a24a');                              // nozzle tip
      RC(g, hx - 1.1, ry - 1.3, 2.2, 1.5, st.tubeOff ? '#2a8cf0' : '#2a8cf0');                          // push-fit collet
      RC(g, hx - 1.1, ry - 1.3, 2.2, .4, 'rgba(255,255,255,.5)');
      if (st.tubeOff) { g.strokeStyle = 'rgba(255,214,70,.0)'; }
      RR(g, hx - 4.1, ry - .2, 8.2, 8.2, 1.2, 'rgba(0,0,0,0)');
      if (st.err && st.stage <= 2) {                                                 // green wad glued to the nozzle
        EL(g, hx, ry + 11.2, 3.2, 2.2, '#1f9c55'); EL(g, hx - .6, ry + 10.8, 1.8, 1.1, '#43dc84');
        g.strokeStyle = '#3fd882'; g.lineWidth = .3; g.beginPath(); g.moveTo(hx + 2, ry + 11); g.bezierCurveTo(hx + 5, ry + 9, hx + 6, ry + 14, hx + 9, ry + 13); g.stroke();
      }
    }
    g.restore();
    drawTube(g, st, t, hp, W._o || {});
    g.save(); g.beginPath(); g.rect(CH.x0, CH.y0, CH.x1 - CH.x0, CH.y1 - CH.y0); g.clip();
    // steam / smoke from the hot nozzle
    if (st.err && st.stage <= 2) {
      for (let i = 0; i < 6; i++) {
        const u = ((t * .33 + i / 6) % 1), x = hx + Math.sin(t * 1.7 + i * 2.1) * (1.4 + u * 4), y = ry + 8 - u * (st.door ? 56 : 14);
        g.fillStyle = 'rgba(205,210,216,' + (.34 * (1 - u)) + ')'; g.beginPath(); g.arc(x, y, 1 + u * 3.6, 0, TAU); g.fill();
      }
    }
    g.restore();
    // glass door
    drawDoor(g, st, t);
  }

  function drawDoor(g, st, t) {
    const x0 = CH.x0 - 1, x1 = CH.x1 + 1, y0 = CH.y0 - 1, y1 = CH.y1 + 1;
    if (!st.door) {
      g.save();
      g.fillStyle = 'rgba(150,185,215,.10)'; g.fillRect(CH.x0, CH.y0, CH.x1 - CH.x0, CH.y1 - CH.y0);
      PO(g, [CH.x0 + 3, CH.y0, CH.x0 + 11, CH.y0, CH.x0 + 4, CH.y1, CH.x0 - 2, CH.y1], 'rgba(255,255,255,.10)');
      PO(g, [CH.x0 + 14, CH.y0, CH.x0 + 17, CH.y0, CH.x0 + 10, CH.y1, CH.x0 + 7, CH.y1], 'rgba(255,255,255,.07)');
      g.restore();
      g.strokeStyle = 'rgba(8,9,11,.95)'; g.lineWidth = 1.1; g.strokeRect(x0 + .3, y0 + .3, x1 - x0 - .6, y1 - y0 - .6);
      RC(g, x1 - 3.3, CH.y0 + 12, .7, 9, '#aeb6bd');                              // door pull
      RC(g, x0, y0, x1 - x0, .5, 'rgba(255,255,255,.3)');
    } else {
      // door swung open toward the viewer: foreshortened strip left of the hinge, frame empty
      g.strokeStyle = 'rgba(8,9,11,.95)'; g.lineWidth = 1.1; g.strokeRect(x0 + .3, y0 + .3, x1 - x0 - .6, y1 - y0 - .6);
      g.save(); g.fillStyle = 'rgba(150,200,235,.22)';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(2.6, y0 - 3); g.lineTo(2.6, y1 + 3.2); g.lineTo(x0, y1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,24,28,.95)'; g.lineWidth = .9; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x0 - 2, y0 - .5); g.lineTo(x0 - 5, y0 - 1.6); g.lineTo(x0 - 7, y1 + 1.2); g.lineTo(x0 - 3.5, y1 - .3); g.fill();
      RC(g, 2.6, y0 - 3, .9, y1 - y0 + 6.2, '#a4acb3'); g.restore();
    }
  }

  /* full live layer: chamber + screen + LEDs (used by room dyn and portrait) */
  function drawPrinterLive(g, S, t, o) {
    o = o || {}; const st = o.st || pstate(S);
    W._o = o;
    const hp = headPos(st, t, o);
    drawPrintChamber(g, st, t, hp);
    drawScreen(g, st, t, !!o.big);
    // status LED on the base
    const on = ledOn(st, t), c = LEDC[st.led];
    EL(g, 20.4, 85.1, .9, .9, on ? 'rgb(' + c + ')' : '#2a1010');
    W._o = null;
    return { st, hp, on };
  }

  /* ---------------------------------------------- portrait for the minigame */
  const pcache = {};
  W.printerPortrait = function (g, w, h, stage, t, opt) {
    opt = opt || {}; t = t || 0;
    let S;
    if (stage && typeof stage === 'object') S = stage;
    else {
      const f = {};
      if (stage === 'done' || stage === 5) f.printerFixed = 1;
      else if (stage === 'print') f.printerPrinting = 1;
      else if (stage === 'idle') { }
      else { f.printerError = 1; f.printerStage = clamp(stage | 0, 0, 4); }
      S = { f };
    }
    const st = pstate(S);
    const k = Math.min(w / (PW + 4), h / (PH + 8)) * (opt.zoom || 1), ox = (w - PW * k) / 2, oy = h - 4 * k - PH * k + (opt.dy || 0) * k;
    g.save();
    if (opt.bg !== false) {                                             // backdrop: dark bench-wall with soft glow
      g.fillStyle = A.lg(g, 0, 0, 0, h, ['#1b2530', '#10161c']); g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,150,170,.07)'; for (let y = 6; y < h; y += 16 * k * .35) for (let x = 6; x < w; x += 16 * k * .35) g.fillRect(x, y, 1.3, 1.3);
      g.fillStyle = A.lg(g, 0, h - 5 * k, 0, h, ['#6d5436', '#3b2c1c']); g.fillRect(0, h - 4 * k, w, 4 * k);
      g.fillStyle = A.rg(g, w / 2, h * .45, 0, h * .8, ['rgba(120,200,255,.14)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, h);
    }
    g.translate(ox, oy); g.scale(k, k);
    let sh = pcache[w + 'x' + h + 'x' + (opt.zoom || 1)];
    if (!sh && BB.mk) {
      const B = Math.max(1, k * (window.devicePixelRatio || 1)), c = BB.mk(PW * B, PH * B), cg = c.getContext('2d'); cg.scale(B, B); printerShell(cg); c.B = B; sh = pcache[w + 'x' + h + 'x' + (opt.zoom || 1)] = c;
    }
    if (sh) g.drawImage(sh, 0, 0, PW, PH); else printerShell(g);
    opt.big = k > 4; opt.st = st; opt.highlight = opt.highlight !== false;
    drawPrinterLive(g, S, t, opt);
    // glow on top
    drawPrinterGlow(g, st, t);
    g.restore();
    g.restore && 0;
  };

  function drawPrinterGlow(g, st, t) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const on = ledOn(st, t), c = LEDC[st.led];
    if (on) { g.fillStyle = A.rg(g, 20.4, 85.1, 0, 7, ['rgba(' + c + ',.55)', 'rgba(' + c + ',0)']); g.fillRect(13, 78, 15, 10); }
    // chamber light
    g.fillStyle = A.lg(g, 0, CH.y0, 0, CH.y1, ['rgba(255,250,235,.20)', 'rgba(255,250,235,0)']); g.fillRect(CH.x0, CH.y0, CH.x1 - CH.x0, CH.y1 - CH.y0);
    if (st.led === 'red') { g.fillStyle = A.rg(g, 40, 62, 0, 20, ['rgba(255,50,30,' + (ledOn(st, t) ? .2 : .06) + ')', 'rgba(255,50,30,0)']); g.fillRect(16, 46, 40, 32); }
    // screen emission
    g.fillStyle = A.rg(g, 44.5, 83.3, 0, 12, ['rgba(' + (st.err && st.stage <= 2 ? '255,70,60' : '90,180,255') + ',.28)', 'rgba(0,0,0,0)']); g.fillRect(30, 76, 28, 12);
    // hot nozzle ember during errors
    if (st.err && st.stage <= 2) { const hp = headPos(st, t, {}); g.fillStyle = A.rg(g, hp.hx, hp.ry + 11, 0, 3.4, ['rgba(255,140,40,.7)', 'rgba(255,140,40,0)']); g.fillRect(hp.hx - 4, hp.ry + 7, 8, 8); }
    g.restore();
  }

  /* ===================================================================== ROOM */
  const sprites = [];
  function add(o) { sprites.push(o); return o; }

  /* ---- generic prop painters ---- */
  function woodTop(g, x, y, w, h, c1, c2, seed) {
    RC(g, x, y, w, h, A.lg(g, 0, y, 0, y + h, [c1, c2]));
    const r = srand(seed || 5); for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(0,0,0,' + (.05 + r() * .08) + ')'; g.fillRect(x + r() * w, y + r() * h, 6 + r() * 30, .35); }
    RC(g, x, y, w, .7, 'rgba(255,255,255,.28)'); RC(g, x, y + h - .6, w, .6, 'rgba(0,0,0,.35)');
  }
  function steelLeg(g, x, y, w, h) { RC(g, x, y, w, h, A.lg(g, x, 0, x + w, 0, ['#8c949b', '#c4cbd0', '#6c747b'])); RC(g, x, y, w, h, 'rgba(0,0,0,.18)'); }
  function box(g, x, y, w, h, col, seed, label) {
    RC(g, x, y, w, h, A.lg(g, 0, y, 0, y + h, [A.shade(col, 1.12), A.shade(col, .86)]));
    RC(g, x, y, w, .6, 'rgba(255,255,255,.25)'); RC(g, x + w - .8, y, .8, h, 'rgba(0,0,0,.2)');
    RC(g, x + w * .42, y, w * .16, h, 'rgba(210,190,140,.28)');                  // tape
    if (label) { RC(g, x + 1.5, y + h * .45, w * .36, h * .3, 'rgba(240,236,220,.85)'); g.fillStyle = 'rgba(30,30,40,.7)'; g.fillRect(x + 2, y + h * .52, w * .26, .5); g.fillRect(x + 2, y + h * .62, w * .18, .5); }
  }
  const CARD = '#a98655';

  /* ----------------------- spool wall / filament rack (x 80) */
  add({
    id: 'filamentRack', x: 80, z: 118, w: 126, h: 106, depth: 26, zBias: 10, reflect: .3,
    topRGB: [120, 98, 70], sideRGB: [80, 66, 50],
    bake(g, w, h) {
      // plywood board + steel frame
      RC(g, 3, 4, w - 6, h - 4, A.lg(g, 0, 0, 0, h, ['#a98a5e', '#8c6f48']));
      A.grain(g, 3, 4, w - 6, h - 4, .16); A.blotches(g, 3, 4, w - 6, h - 4, 3, 7, 'rgba(40,25,10,.18)', 6, 20);
      RC(g, 0, 0, w, 4, A.lg(g, 0, 0, 0, 4, ['#5a626a', '#363b41'])); RC(g, 0, 0, 3, h, '#40464d'); RC(g, w - 3, 0, 3, h, '#40464d'); RC(g, 0, 0, w, .6, 'rgba(255,255,255,.3)');
      RC(g, 0, h - 3, w, 3, '#2d3237');
      // dowel pegs shelves: three rows
      const rows = [[5, 20], [5, 52], [4, 83]];
      let n = 0;
      rows.forEach(([cnt, cy], ri) => {
        RC(g, 3, cy + 11.4, w - 6, 1.6, '#5b4630');
        for (let i = 0; i < cnt; i++) {
          const cx = 14 + i * 24.2 + (ri === 2 ? 12 : 0);
          EL(g, cx + 1.1, cy + 1.8, 9.6, 9.6, 'rgba(0,0,0,.28)');          // peg shadow on the board
          spool(g, cx, cy, 10, FIL[n % FIL.length], n * 7 + 3); n++;
        }
        if (ri === 2) { EL(g, 14, cy, 10, 10, 'rgba(0,0,0,.4)'); spool(g, 14, cy, 10, '', 9, { empty: true }); EL(g, 14, cy, 10, 10, 'rgba(0,0,0,0)'); }
        // label tape strips
        RC(g, 5, cy + 12.8, 18, 2.2, 'rgba(235,230,200,.85)'); g.fillStyle = 'rgba(30,30,40,.7)'; g.fillRect(6, cy + 13.6, 11, .5);
      });
      A.contact(g, w / 2, h - .5, w * .9, .5);
    }
  });
  // stack of filament boxes and a dry box on top of the rack
  add({
    id: 'rackTop', x: 78, y: 106, z: 120, w: 100, h: 34, zBias: 0,
    bake(g, w, h) {
      box(g, 4, 14, 38, 20, CARD, 1, true); box(g, 44, 18, 30, 16, '#9c7a4a', 2, true); box(g, 8, 2, 30, 12, '#b49060', 3, true);
      // transparent dry box with a spool
      RR(g, 66, 6, 32, 28, 2, 'rgba(180,215,230,.35)'); spool(g, 82, 22, 10, FIL[5], 21); g.strokeStyle = 'rgba(210,235,245,.8)'; g.lineWidth = .7; g.beginPath(); g.roundRect(66, 6, 32, 28, 2); g.stroke(); RC(g, 66, 5, 32, 2, '#2f6a8a');
      RC(g, 84, 8, 5, 2.4, '#2fc267');
    }
  });
  // floor: box of empty cores + a bin of failed prints
  add({
    id: 'failBin', x: 160, z: 36, w: 26, h: 32, depth: 22, zBias: 4, reflect: .3,
    bake(g, w, h) {
      RR(g, 1, 8, w - 2, h - 8, 1.5, A.lg(g, 0, 8, 0, h, ['#3a4047', '#23272c'])); RC(g, 0, 6, w, 3, '#4b525a');
      // failed prints sticking out (green, orange, white)
      PO(g, [4, 9, 8, 0, 13, 7, 10, 10], '#2fc267'); PO(g, [10, 9, 16, 1, 21, 9], '#f08a2c'); PO(g, [14, 9, 18, 3, 24, 8, 22, 10], '#e8e8e2');
      g.strokeStyle = '#2fc267'; g.lineWidth = .6; g.beginPath(); g.moveTo(6, 8); g.bezierCurveTo(3, 3, 11, 1, 9, 6); g.stroke(); g.strokeStyle = '#f08a2c'; g.beginPath(); g.moveTo(17, 7); g.bezierCurveTo(21, 2, 24, 5, 19, 7); g.stroke();
      RC(g, 0, 6, w, .7, 'rgba(255,255,255,.2)'); A.contact(g, w / 2, h, w, .5);
    }
  });

  /* ----------------------------- pegboard with tools (z 154 against the wall) */
  add({
    id: 'pegboard', x: 100, y: 118, z: 153, w: 144, h: 112, shadow: false,
    bake(g, w, h) {
      RC(g, 0, 0, w, h, A.lg(g, 0, 0, 0, h, ['#b8a07a', '#9a8260']));
      g.fillStyle = 'rgba(40,28,12,.55)'; for (let y = 3; y < h; y += 4) for (let x = 3; x < w; x += 4) { g.beginPath(); g.arc(x, y, .45, 0, TAU); g.fill(); }
      A.grain(g, 0, 0, w, h, .18); A.blotches(g, 0, 0, w, h, 8, 8, 'rgba(60,40,15,.14)', 8, 24);
      g.strokeStyle = '#2b2f34'; g.lineWidth = 1.6; g.strokeRect(.8, .8, w - 1.6, h - 1.6);
      RC(g, 0, 0, w, .8, 'rgba(255,255,255,.2)');
      const sh = (fn) => { g.save(); g.translate(1.6, 1.4); g.globalAlpha = .35; fn(true); g.restore(); fn(false); };
      // painted outlines (silhouettes) of tools, some missing
      g.strokeStyle = 'rgba(30,24,16,.22)'; g.lineWidth = .8; g.setLineDash([2, 1.6]);
      g.strokeRect(100, 20, 6, 36); g.beginPath(); g.arc(122, 26, 7, 0, TAU); g.stroke(); g.setLineDash([]);
      // hammer
      sh(s => { const c = s ? '#000' : '#7a4a22'; RC(g, 10, 12, 3.4, 30, s ? '#000' : '#8b5a2b'); RC(g, 5, 8, 14, 6, s ? '#000' : '#6c737b'); if (!s) RC(g, 5, 8, 14, 1.2, '#c9d0d6'); });
      // wrenches
      for (let i = 0; i < 4; i++) sh(s => { const x = 28 + i * 6.2, L = 26 + i * 3; RR(g, x, 10, 3.2, L, 1, s ? '#000' : A.mix('#9aa2a9', '#5d656c', i / 4)); EL(g, x + 1.6, 10, 3, 3, s ? '#000' : '#9aa2a9'); if (!s) EL(g, x + 1.6, 10, 1.3, 1.3, '#4e555a'); });
      // pliers red handles
      sh(s => { RR(g, 58, 14, 3, 20, 1, s ? '#000' : '#c93a2d'); RR(g, 62.5, 14, 3, 20, 1, s ? '#000' : '#c93a2d'); PO(g, [58, 14, 65.5, 14, 64, 6, 59.5, 6], s ? '#000' : '#8c949b'); });
      // side cutters yellow
      sh(s => { RR(g, 72, 16, 3, 18, 1, s ? '#000' : '#e0b92a'); RR(g, 76.5, 16, 3, 18, 1, s ? '#000' : '#e0b92a'); PO(g, [72, 16, 79.5, 16, 78, 8, 73.5, 8], s ? '#000' : '#8c949b'); });
      // screwdrivers
      for (let i = 0; i < 4; i++) sh(s => { const x = 88 + i * 5; RR(g, x, 8, 3.2, 12, 1.4, s ? '#000' : ['#e0b92a', '#c93a2d', '#2f6fe0', '#2fc267'][i]); RC(g, x + 1.2, 20, .8, 14, s ? '#000' : '#9aa2a9'); });
      // hex keys on a hook ring
      sh(s => { g.strokeStyle = s ? '#000' : '#d0d6db'; g.lineWidth = .7; g.beginPath(); g.arc(131, 14, 3, 0, TAU); g.stroke(); for (let i = 0; i < 5; i++) { g.strokeStyle = s ? '#000' : '#2a2e33'; g.lineWidth = 1; g.beginPath(); g.moveTo(129 + i * 1, 16); g.lineTo(129 + i * 1.2, 30 + i * 2); g.lineTo(134 + i * 2, 30 + i * 2); g.stroke(); } });
      // second row: scissors, spatula, calipers, wire cutters, tape rolls, snips
      sh(s => { g.strokeStyle = s ? '#000' : '#9aa2a9'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(12, 60); g.lineTo(22, 84); g.moveTo(22, 60); g.lineTo(12, 84); g.stroke(); g.strokeStyle = s ? '#000' : '#e0572a'; g.lineWidth = 2.2; g.beginPath(); g.arc(11, 87, 2.6, 0, TAU); g.arc(23, 87, 2.6, 0, TAU); g.stroke(); });
      sh(s => { RR(g, 32, 80, 2.6, 20, 1, s ? '#000' : '#2a2e33'); PO(g, [29, 62, 38, 62, 36.5, 82, 30.5, 82], s ? '#000' : '#c4ccd2'); });   // spatula
      sh(s => { RC(g, 46, 56, 3, 40, s ? '#000' : '#d3d9de'); RC(g, 49, 56, 8, 6, s ? '#000' : '#2a2e33'); RC(g, 49, 66, 6, 5, s ? '#000' : '#2a2e33'); if (!s) { RC(g, 50, 57, 5, 2.5, '#3a8d52'); RC(g, 46, 56, .6, 40, '#8c949b'); } });   // calipers
      for (let i = 0; i < 3; i++) sh(s => { g.strokeStyle = s ? '#000' : ['#e0b92a', '#2f6fe0', '#e8e8e2'][i]; g.lineWidth = 3.4; g.beginPath(); g.arc(72 + i * 11, 70, 4.4, 0, TAU); g.stroke(); if (!s) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .4; g.beginPath(); g.arc(72 + i * 11, 70, 4.4, 0, TAU); g.stroke(); } });  // tape rolls
      sh(s => { g.strokeStyle = s ? '#000' : '#2a2e33'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(112, 62); g.bezierCurveTo(100, 72, 126, 82, 114, 96); g.stroke(); });    // coiled cable
      sh(s => { RR(g, 124, 56, 4, 30, 1, s ? '#000' : '#2f6fe0'); PO(g, [124, 56, 128, 56, 126, 50], s ? '#000' : '#c4ccd2'); });   // deburring tool
      // small shelf with bins at the bottom of the pegboard
      RC(g, 4, h - 14, w - 8, 2, '#2d3237');
      for (let i = 0; i < 5; i++) { RC(g, 8 + i * 18, h - 24, 14, 10, ['#d9b13a', '#c93a2d', '#2f6fe0', '#e8e8e2', '#2fc267'][i]); RC(g, 8 + i * 18, h - 24, 14, 1, 'rgba(255,255,255,.3)'); RC(g, 10 + i * 18, h - 20, 10, 3, 'rgba(0,0,0,.3)'); }
    }
  });

  /* --------------------------------------------- WORKBENCH 90 cm + clutter */
  add({
    id: 'bench', x: 245, z: 34, w: 146, h: 90, depth: 62, zBias: 42, reflect: .4,
    topRGB: [150, 118, 78], sideRGB: [70, 76, 82],
    bake(g, w, h) {
      woodTop(g, 0, 0, w, 5.2, '#b88f58', '#8b6a40', 3);
      RC(g, 0, 5.2, w, 2, '#2b2f34');                                      // frame rail
      // left: drawer cabinet
      RC(g, 4, 7.2, 46, 70, '#3a4047'); RC(g, 4, 7.2, 46, 1, 'rgba(255,255,255,.2)');
      for (let i = 0; i < 3; i++) {
        const y = 9 + i * 22.6; RC(g, 6, y, 42, 20.6, A.lg(g, 0, y, 0, y + 20.6, ['#5a626a', '#434a51'])); RC(g, 6, y, 42, .7, 'rgba(255,255,255,.22)');
        RR(g, 20, y + 6, 14, 2.2, 1, '#14161a'); RC(g, 20, y + 6, 14, .5, 'rgba(255,255,255,.3)');
        RC(g, 10, y + 12, 12, 4, 'rgba(235,230,200,.85)'); g.fillStyle = 'rgba(30,30,40,.7)'; g.fillRect(11, y + 13.4, 8, .5);
      }
      // right: open steel shelves with bins
      steelLeg(g, 52, 7.2, 3, 82); steelLeg(g, w - 8, 7.2, 3, 82); steelLeg(g, 4, 77, 3, 13); steelLeg(g, 47, 77, 3, 13);
      RC(g, 52, 50, w - 58, 2.4, '#59616a'); RC(g, 52, 50, w - 58, .5, 'rgba(255,255,255,.3)'); RC(g, 52, 84, w - 58, 2.4, '#59616a');
      // middle shelf: PSU box, parts bins, dry cabinet
      box(g, 58, 36, 22, 14, '#5b6f86', 5, true); box(g, 82, 38, 16, 12, '#a98655', 6, true);
      for (let i = 0; i < 3; i++) { RR(g, 101 + i * 10, 40, 9, 10, 1, ['#2f6fe0', '#d9b13a', '#c93a2d'][i]); RC(g, 102 + i * 10, 42, 7, 1.4, 'rgba(255,255,255,.35)'); }
      // lower shelf: extension reel, spare spool tubes, rolled cables
      EL(g, 70, 75, 9, 9, '#c93a2d'); EL(g, 70, 75, 3.5, 3.5, '#2a2e33'); g.strokeStyle = '#1a1c20'; g.lineWidth = .7; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(70, 75, 5 + i * 1.1, 0, TAU); g.stroke(); }
      box(g, 86, 68, 26, 16, '#59606a', 9, true); box(g, 112, 72, 18, 12, '#8e7650', 10, true);
      A.contact(g, w / 2, h - .5, w - 6, .55);
      A.contact(g, 15, h - .3, 14, .5); A.contact(g, w - 8, h - .3, 14, .5);
      A.grain(g, 0, 0, w, h, .07);
    }
  });
  // printer on the bench
  add({
    id: 'printer', x: 245, y: 90, z: 44, w: PW * PS, h: PH * PS, depth: 30, shadow: false, reflect: 0,
    topRGB: [74, 80, 86], sideRGB: [52, 57, 63],
    bake(g) { g.scale(PS, PS); printerShell(g); },
    dyn(g, t, S) { g.save(); g.scale(PS, PS); drawPrinterLive(g, S, t, {}); g.restore(); }
  });
  add({   // self-lit glow of printer LEDs / screen / chamber
    id: 'printerGlow', x: 245, y: 90, z: 43, w: PW * PS, h: PH * PS, post: true, postMode: 'lighter', shadow: false,
    dyn(g, t, S) { g.save(); g.scale(PS, PS); drawPrinterGlow(g, pstate(S), t); g.restore(); }
  });
  // bench clutter left / right of the printer
  add({
    id: 'benchL', x: 190, y: 90, z: 50, w: 44, h: 22, shadow: false,
    bake(g, w, h) {
      // soldering station + helping hands + nozzle tin + calipers
      RR(g, 2, 10, 14, 12, 1.5, '#2a2e33'); RC(g, 2, 10, 14, 1.2, 'rgba(255,255,255,.25)'); EL(g, 6, 16, 2.2, 2.2, '#c93a2d'); RC(g, 10, 14, 4, 3, '#1c9b53');
      g.strokeStyle = '#9aa2a9'; g.lineWidth = .8; g.beginPath(); g.moveTo(9, 10); g.lineTo(11, 1); g.stroke(); RC(g, 10.2, 0, 1.6, 4, '#c98a3a');
      RR(g, 20, 14, 8, 8, 1, '#c9a227'); EL(g, 24, 14.5, 4, 1.2, '#e6c452'); RC(g, 21, 17, 6, 2.5, '#8a6c12');
      RR(g, 31, 18, 10, 4, 1, '#d3d9de'); RC(g, 32, 19, 5, 1, '#2a2e33');
      A.contact(g, 22, h, 42, .35);
    }
  });
  add({
    id: 'benchR', x: 312, y: 90, z: 52, w: 36, h: 26, shadow: false,
    bake(g, w, h) {
      // little filament box + dryer with a half spool and a mug
      box(g, 2, 8, 14, 18, CARD, 4, true); box(g, 3, 1, 12, 8, '#8c7248', 3, false);
      RR(g, 20, 14, 12, 12, 1.5, '#d8d2c6'); RC(g, 20, 14, 12, 1.4, 'rgba(255,255,255,.5)'); RC(g, 21.5, 19, 9, 6, 'rgba(0,0,0,.12)'); EL(g, 31.5, 19, 2, 3, 'rgba(0,0,0,.3)');
      g.strokeStyle = '#d8d2c6'; g.lineWidth = 1; g.beginPath(); g.arc(32.4, 20, 2.6, -1.4, 1.4); g.stroke();
      A.contact(g, 18, h, 34, .35);
    }
  });
  // scattered filament scraps on the bench top and a loose spool leaning on the printer
  add({
    id: 'benchSpoolLoose', x: 292, y: 90, z: 66, w: 22, h: 22, shadow: false,
    bake(g, w, h) { spool(g, 11, 11, 10.5, FIL[4], 33); }
  });

  /* ---------------------------------------------------------- shelf over bench */
  add({
    id: 'shelfA', x: 240, y: 196, z: 148, w: 128, h: 36, shadow: false,
    bake(g, w, h) {
      // wall shelf with brackets, failed prints, parts bins
      RC(g, 0, h - 4, w, 4, A.lg(g, 0, h - 4, 0, h, ['#8d6b44', '#5f4629'])); RC(g, 0, h - 4, w, .6, 'rgba(255,255,255,.3)');
      steelLeg(g, 8, h - 4, 2.6, 4); steelLeg(g, w - 11, h - 4, 2.6, 4);
      // failed print: green blob with stringy tail, a warped cube, a dented benchy-ish boat (generic)
      PO(g, [10, h - 4, 14, h - 14, 20, h - 18, 27, h - 13, 30, h - 4], '#2fc267'); g.strokeStyle = '#43dc84'; g.lineWidth = .4; for (let y = h - 6; y > h - 17; y -= 1.4) { g.beginPath(); g.moveTo(11 + (h - 4 - y) * .2, y); g.lineTo(29 - (h - 4 - y) * .2, y); g.stroke(); }
      g.strokeStyle = '#2fc267'; g.lineWidth = .7; g.beginPath(); g.moveTo(30, h - 6); g.bezierCurveTo(36, h - 16, 38, h - 2, 42, h - 9); g.stroke();
      PO(g, [48, h - 4, 66, h - 4, 64, h - 12, 55, h - 13, 50, h - 9], '#f08a2c'); RC(g, 54, h - 20, 4, 8, '#f08a2c'); RC(g, 54, h - 20, 4, 1, 'rgba(255,255,255,.4)'); PO(g, [52, h - 4, 66, h - 4, 66, h - 7], 'rgba(0,0,0,.18)');
      RC(g, 74, h - 13, 9, 9, '#e8e8e2'); PO(g, [74, h - 13, 83, h - 13, 85, h - 15, 76, h - 15], '#fff'); RC(g, 83, h - 13, 2, 9, 'rgba(0,0,0,.2)');
      // parts boxes
      for (let i = 0; i < 4; i++) { RR(g, 92 + i * 8, h - 12, 7, 8, .8, ['#2f6fe0', '#d9b13a', '#c93a2d', '#e8e8e2'][i]); RC(g, 93 + i * 8, h - 9.5, 5, 1, 'rgba(0,0,0,.25)'); }
      EL(g, 123, h - 9, 4.5, 4.5, '#2a2e33');
    }
  });

  /* --------------------------------------------------- window sill + plant */
  add({
    id: 'sill', x: 369, y: 146, z: 152, w: 80, h: 22, shadow: false,
    bake(g, w, h) {
      RC(g, 0, h - 3, w, 3, '#6f7479'); RC(g, 0, h - 3, w, .6, 'rgba(255,255,255,.35)');
      // dead cactus in a mug + tape dispenser + screwdriver
      RR(g, 12, h - 9, 8, 6, 1, '#d8d2c6'); EL(g, 16, h - 12, 3.2, 5, '#4b7a42'); EL(g, 16, h - 14, 1.2, 2, '#6d9b5a'); EL(g, 13.4, h - 13, 1.2, 2.4, '#3d6a37'); LN(g, 16, h - 18, 16, h - 16, '#e86aa6', .9);
      RR(g, 44, h - 8, 12, 5, 1.2, '#c93a2d'); EL(g, 49, h - 9, 4, 4, '#d3d9de'); RC(g, 54, h - 6.5, 6, 2, '#c4ccd2');
      RR(g, 64, h - 6, 10, 3, 1, '#2a2e33'); RC(g, 66, h - 5.4, 6, 1, '#9aa2a9');
    }
  });

  /* ----------------------------------------------- wall posters / calendar / signs */
  const poster = (id, x, y, w, h, fn) => add({ id, x, y, z: 156, w, h, shadow: false, bake(g, w, h) { fn(g, w, h); RC(g, 0, 0, w, h, 'rgba(0,0,0,0)'); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .7; g.strokeRect(.3, .3, w - .6, h - .6); RC(g, 0, h - 2, w, 2, 'rgba(0,0,0,.14)'); A.grain(g, 0, 0, w, h, .1); } });
  poster('posterCube', 497, 150, 42, 58, (g, w, h) => {
    RC(g, 0, 0, w, h, '#1d2a3a'); RC(g, 0, 0, w, 14, '#f2cf3a'); g.fillStyle = '#1d2a3a'; g.font = '800 7px sans-serif'; g.fillText('ПЕЧАТАЙ', 3.5, 10);
    // calibration cube iso
    PO(g, [w / 2, 22, w / 2 + 12, 28, w / 2, 34, w / 2 - 12, 28], '#2fc267'); PO(g, [w / 2 - 12, 28, w / 2, 34, w / 2, 48, w / 2 - 12, 42], '#1d9b53'); PO(g, [w / 2 + 12, 28, w / 2, 34, w / 2, 48, w / 2 + 12, 42], '#3ee283');
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '800 4.4px sans-serif'; g.fillText('X', w / 2 - 8, 42); g.fillText('Y', w / 2 + 4, 42);
    RC(g, 4, 51, w - 8, 1, 'rgba(255,255,255,.5)'); RC(g, 4, 54, w - 16, 1, 'rgba(255,255,255,.3)');
  });
  poster('posterRobot', 548, 160, 38, 50, (g, w, h) => {
    RC(g, 0, 0, w, h, '#c9b88a'); RC(g, 0, 0, w, h, A.lg(g, 0, 0, 0, h, ['rgba(255,255,255,.2)', 'rgba(60,40,10,.25)']));
    RC(g, 9, 10, 20, 17, '#5a6a78'); RC(g, 12, 14, 5, 5, '#d9453a'); RC(g, 21, 14, 5, 5, '#d9453a'); RC(g, 14, 22, 10, 2, '#222'); RC(g, 17, 3, 4, 7, '#5a6a78'); EL(g, 19, 3, 2, 2, '#d9453a');
    RC(g, 11, 28, 16, 12, '#7a8896'); RC(g, 4, 29, 6, 3, '#7a8896'); RC(g, 28, 29, 6, 3, '#7a8896');
    g.fillStyle = '#6a2a1e'; g.font = '800 5px sans-serif'; g.fillText('СДЕЛАЙ САМ', 3.5, 47);
  });
  poster('calendar', 596, 152, 22, 32, (g, w, h) => {
    RC(g, 0, 0, w, h, '#efe6d0'); RC(g, 0, 0, w, 9, '#c0392b'); g.fillStyle = '#fff'; g.font = '800 4.4px sans-serif'; g.fillText('СЕНТ.', 3.5, 6.6);
    g.fillStyle = 'rgba(30,30,30,.7)'; for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) g.fillRect(2.4 + c * 3, 12 + r * 4.6, 1.8, 2.2);
    g.strokeStyle = '#c0392b'; g.lineWidth = .6; for (let c = 0; c < 4; c++) { g.beginPath(); g.moveTo(2.2 + c * 3, 11.6); g.lineTo(4.4 + c * 3, 14.4); g.moveTo(4.4 + c * 3, 11.6); g.lineTo(2.2 + c * 3, 14.4); g.stroke(); }
    EL(g, 17, 25, 3, 3, 'rgba(192,57,43,.8)'); g.strokeStyle = '#c0392b'; g.lineWidth = .5; g.beginPath(); g.arc(17, 25, 3, 0, TAU); g.stroke();
    EL(g, w / 2, -.5, 1, 1, '#555');
  });
  add({ // yellow hot-end sign over the toolbox
    id: 'signHot', x: 390, y: 98, z: 156, w: 24, h: 24, shadow: false, bake(g, w, h) {
      RR(g, 0, 0, w, h, 2, '#e0b92a'); g.strokeStyle = '#1b1b1b'; g.lineWidth = 1; g.beginPath(); g.roundRect(1, 1, w - 2, h - 2, 1.6); g.stroke();
      PO(g, [12, 3.4, 21.4, 19.8, 2.6, 19.8], '#1b1b1b'); PO(g, [12, 6.6, 18.6, 18.2, 5.4, 18.2], '#e0b92a'); RC(g, 11.2, 9.6, 1.6, 5, '#1b1b1b'); EL(g, 12, 16.4, 1, 1, '#1b1b1b');
    }
  });
  add({ // wall clock, stopped at the wrong time
    id: 'clock', x: 455, y: 214, z: 156, w: 22, h: 22, shadow: false, bake(g, w, h) {
      EL(g, 11, 11, 11, 11, '#2a2e33'); EL(g, 11, 11, 9.4, 9.4, '#e9e5d6'); g.strokeStyle = '#222'; g.lineWidth = .5;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(11 + Math.cos(a) * 8.2, 11 + Math.sin(a) * 8.2); g.lineTo(11 + Math.cos(a) * 9.1, 11 + Math.sin(a) * 9.1); g.stroke(); }
      LN(g, 11, 11, 11 + 4, 11 - 4, '#222', .9); LN(g, 11, 11, 11 - 1, 11 - 6.4, '#222', .6); EL(g, 11, 11, .9, .9, '#c0392b');
      PO(g, [3, 5, 12, 3, 8, 12], 'rgba(255,255,255,.12)');
    }
  });

  /* ---------------------------------------------------------- TOOLBOX (hotspot) */
  add({
    id: 'toolbox', x: 405, z: 6, w: 48, h: 29, depth: 24, zBias: 8, reflect: .55,
    topRGB: [150, 38, 32], sideRGB: [120, 28, 24],
    hidden: S => !!(S && S.tools && S.tools.box),
    bake(g, w, h) {
      // tray body
      RR(g, 0, 8, w, h - 8, 2, A.lg(g, 0, 8, 0, h, ['#d6483b', '#9c2a22'])); RC(g, 0, 8, w, 1, 'rgba(255,255,255,.35)');
      RC(g, 1, h - 7, w - 2, 1.2, 'rgba(0,0,0,.28)');
      // lid with ridges
      RR(g, 1, 4, w - 2, 7, 1.5, A.lg(g, 0, 4, 0, 11, ['#e5584a', '#b13227'])); RC(g, 1, 4, w - 2, .8, 'rgba(255,255,255,.4)');
      for (let x = 6; x < w - 4; x += 5) RC(g, x, 5.4, .8, 4, 'rgba(0,0,0,.18)');
      // handle
      g.strokeStyle = '#1b1d21'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 4.6); g.lineTo(14, 1.8); g.lineTo(w - 14, 1.8); g.lineTo(w - 14, 4.6); g.stroke();
      g.strokeStyle = '#555b61'; g.lineWidth = .6; g.beginPath(); g.moveTo(15, 1); g.lineTo(w - 15, 1); g.stroke();
      // latches and badge, scuffs
      RC(g, 7, 9.5, 5, 4, '#b8bfc5'); RC(g, 7, 9.5, 5, .7, '#f0f3f5'); RC(g, w - 12, 9.5, 5, 4, '#b8bfc5'); RC(g, w - 12, 9.5, 5, .7, '#f0f3f5');
      RR(g, w / 2 - 7, 15, 14, 5, 1, '#e8e2cf'); RC(g, w / 2 - 5, 16.6, 10, .7, '#333'); RC(g, w / 2 - 5, 18.3, 7, .7, '#555');
      A.specks(g, 0, 8, w, h - 8, 5, 24, 'rgba(0,0,0,.25)', 1.3); A.specks(g, 0, 8, w, h - 8, 6, 14, 'rgba(255,255,255,.14)', 1);
      A.contact(g, w / 2, h, w, .5);
    }
  });

  /* -------------------------------------------------------------- PC DESK */
  add({
    id: 'desk', x: 560, z: 54, w: 132, h: 75, depth: 62, zBias: 56, reflect: .4,
    topRGB: [44, 48, 56], sideRGB: [38, 42, 48],
    bake(g, w, h) {
      RC(g, 0, 0, w, 4.4, A.lg(g, 0, 0, 0, 4.4, ['#3b414a', '#1f2328'])); RC(g, 0, 0, w, .7, 'rgba(255,255,255,.3)');
      RC(g, 0, 4.4, w, 1.4, '#14161a');
      // drawer pedestal on the right + steel leg on the left
      steelLeg(g, 4, 5.8, 4, h - 5.8); RC(g, 2, h - 2, 8, 2, '#14161a');
      RC(g, w - 38, 5.8, 36, h - 9, '#30353c'); RC(g, w - 38, 5.8, 36, .8, 'rgba(255,255,255,.2)');
      for (let i = 0; i < 3; i++) { const y = 7.4 + i * 21.2; RC(g, w - 36.6, y, 33.2, 19.6, A.lg(g, 0, y, 0, y + 19.6, ['#454b54', '#343a41'])); RC(g, w - 36.6, y, 33.2, .6, 'rgba(255,255,255,.22)'); RR(g, w - 26, y + 6, 12, 2, 1, '#14161a'); }
      RC(g, w - 38, h - 3.4, 36, 3.4, '#14161a');
      // cable tray under the desk top + dangling cables
      RC(g, 10, 6, w - 52, 1.8, '#1a1d21'); A.cable(g, [[16, 7], [24, 11], [34, 8], [46, 12], [60, 8], [74, 10]], .9, '#111'); A.cable(g, [[20, 7], [28, 13], [40, 9]], .7, '#2f6fe0');
      A.contact(g, w / 2, h - .5, w, .55);
      A.grain(g, 0, 0, w, 6, .1);
    }
  });
  add({
    id: 'monitor', x: 566, y: 75, z: 96, w: 68, h: 52, shadow: false,
    bake(g, w, h) {
      // stand
      PO(g, [30, 38, 38, 38, 40, 46, 28, 46], '#23272c'); RR(g, 20, 46, 28, 3, 1.4, A.lg(g, 0, 46, 0, 49, ['#4a5057', '#1c1f23'])); RC(g, 20.5, 46, 27, .5, 'rgba(255,255,255,.3)');
      // bezel
      RR(g, 1, 0, 66, 40, 1.8, '#111316'); RC(g, 1.5, .3, 65, .6, 'rgba(255,255,255,.18)');
      RC(g, 3, 2, 62, 35.2, '#05070a');
      EL(g, 34, 38.6, .5, .5, '#33d17a');
      A.contact(g, 34, h - .2, 36, .4);
    },
    dyn(g, t, S) {
      const f = flags(S), st = pstate(S), fl = .93 + .07 * Math.sin(t * 31) * Math.sin(t * 2.3) + (Math.sin(t * .9) > .985 ? -.2 : 0);
      g.save(); g.beginPath(); g.rect(3, 2, 62, 35.2); g.clip();
      // slicer UI
      RC(g, 3, 2, 62, 35.2, '#161d28');
      RC(g, 3, 2, 62, 3.2, '#222c3b'); for (let i = 0; i < 5; i++) RC(g, 5 + i * 5, 3, 3.5, 1.2, 'rgba(150,180,220,.55)');
      RC(g, 3, 5.2, 12, 32, '#1b2431'); for (let i = 0; i < 7; i++) { RC(g, 4.5, 7 + i * 4.2, 9, 1.4, i === 2 ? '#2fc267' : 'rgba(150,180,220,.4)'); RC(g, 4.5, 9.2 + i * 4.2, 6, .8, 'rgba(150,180,220,.2)'); }
      RC(g, 15, 5.2, 36, 25, '#0c1119');
      // iso bed grid + model
      g.strokeStyle = 'rgba(80,140,200,.25)'; g.lineWidth = .25; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(22 + i * 2.4, 27); g.lineTo(26 + i * 3.1, 14); g.stroke(); g.beginPath(); g.moveTo(21 + i * .9, 27 - i * 1.3); g.lineTo(45 + i * .9, 27 - i * 1.3); g.stroke(); }
      const ang = t * .8; g.save(); g.translate(34, 21);
      PO(g, [-5, 3, 0, 5, 5, 3, 0, 1], '#27b564'); PO(g, [-5, 3, 0, 5, 0, -2, -5, -4], '#1d9b53'); PO(g, [5, 3, 0, 5, 0, -2, 5, -4], '#43dc84'); PO(g, [-5, -4, 0, -2, 5, -4, 0, -6], '#7af0ac');
      g.restore();
      // timeline + props panel
      RC(g, 15, 31, 36, 5.6, '#1b2431'); const p = st.err ? .38 : (t * .02) % 1; RC(g, 16.5, 33.2, 33, 1.2, 'rgba(255,255,255,.12)'); RC(g, 16.5, 33.2, 33 * p, 1.2, st.err ? '#ff5a4d' : '#3ee283');
      for (let i = 0; i < 20; i++) RC(g, 16.5 + i * 1.65, 31.8 + (i * 7 % 4) * .3, 1, .9, 'rgba(120,170,230,.5)');
      RC(g, 52, 5.2, 13, 32, '#1b2431'); for (let i = 0; i < 6; i++) { RC(g, 53.4, 7 + i * 5, 10, 1, 'rgba(150,180,220,.45)'); RC(g, 53.4, 9 + i * 5, 6 + (i * 3 % 4), 1.4, i % 2 ? '#2f6fe0' : '#2fc267'); }
      // printer error toast
      if (st.err && st.stage <= 2) {
        const on = Math.sin(t * 5) > -.4; RR(g, 17, 8, 32, 12, 1.4, 'rgba(34,10,12,.95)'); RC(g, 17, 8, 32, 2.8, on ? '#ff3b30' : '#a02620');
        EL(g, 22, 15, 2.2, 2.2, '#ff3b30'); RC(g, 21.5, 13.4, 1, 2.2, '#fff'); RC(g, 21.5, 16, 1, 1, '#fff'); RC(g, 26, 13.4, 19, 1.1, 'rgba(255,255,255,.75)'); RC(g, 26, 16, 14, 1.1, 'rgba(255,255,255,.4)');
      }
      // scanline flicker
      g.fillStyle = 'rgba(0,0,0,' + (1 - fl) * 1.4 + ')'; g.fillRect(3, 2, 62, 35.2);
      const sy = ((t * 11) % 40); g.fillStyle = 'rgba(160,200,255,.05)'; g.fillRect(3, sy - 2, 62, 3);
      g.restore();
    }
  });
  add({   // monitor glow: self lit halo
    id: 'monitorGlow', x: 566, y: 75, z: 95, w: 68, h: 52, post: true, postMode: 'lighter', shadow: false,
    dyn(g, t, S) {
      const st = pstate(S), a = .82 + .18 * Math.sin(t * 3.1);
      g.fillStyle = A.rg(g, 34, 20, 0, 60, ['rgba(130,180,255,' + .26 * a + ')', 'rgba(130,180,255,0)']); g.fillRect(-30, -40, 130, 120);
      g.fillStyle = A.lg(g, 0, 2, 0, 37, ['rgba(160,200,255,.10)', 'rgba(120,160,255,.02)']); g.fillRect(3, 2, 62, 35.2);
      if (st.err && st.stage <= 2) { g.fillStyle = A.rg(g, 33, 14, 0, 22, ['rgba(255,60,50,' + (.1 + .06 * Math.sin(t * 5)) + ')', 'rgba(255,60,50,0)']); g.fillRect(8, 0, 52, 30); }
    }
  });
  add({   // keyboard + mouse
    id: 'keyboard', x: 560, y: 75, z: 70, w: 52, h: 6, shadow: false,
    bake(g, w, h) {
      RR(g, 1, 2.4, 42, 3.4, 1, '#1b1e22'); RC(g, 2, 2.4, 40, .5, 'rgba(255,255,255,.25)');
      for (let r = 0; r < 2; r++) for (let i = 0; i < 24; i++) RC(g, 2.4 + i * 1.65, 3 + r * 1.1, 1.2, .7, 'rgba(150,160,175,.55)');
      RR(g, 46, 3.2, 4, 2.6, 1.2, '#1b1e22'); RC(g, 46.5, 3.3, 3, .4, 'rgba(255,255,255,.3)');
      A.contact(g, 26, h, 50, .3);
    }
  });
  add({
    id: 'keyboardGlow', x: 560, y: 75, z: 69, w: 52, h: 6, post: true, postMode: 'lighter', shadow: false,
    dyn(g, t) { for (let i = 0; i < 24; i++) { g.fillStyle = hsl(t * 50 + i * 15, 90, 55, .55); g.fillRect(2.4 + i * 1.65, 5.2, 1.3, .6); } g.fillStyle = A.rg(g, 22, 6, 0, 20, ['rgba(120,100,255,.14)', 'rgba(0,0,0,0)']); g.fillRect(0, -6, 46, 20); }
  });
  add({   // energy drinks on the desk (a fallen one)
    id: 'drinks', x: 607, y: 75, z: 78, w: 30, h: 17, shadow: false,
    bake(g, w, h) {
      const can = (x, y, col, rot) => { g.save(); g.translate(x, y); g.rotate(rot || 0); RR(g, -2.9, -12.4, 5.8, 12.4, 1, A.lg(g, -3, 0, 3, 0, [A.shade(col, 1.3), col, A.shade(col, .6)])); RC(g, -2.9, -9, 5.8, 3, 'rgba(255,255,255,.7)'); RC(g, -2.9, -5.4, 5.8, .8, 'rgba(0,0,0,.45)'); RC(g, -2.9, -12.4, 5.8, .8, '#cfd3d6'); g.restore(); };
      can(4, 17, '#1e9bd7'); can(10, 17, '#d63a3a'); can(21, 16.4, '#7ad04a'); can(26, 14.4, '#e0b92a', .15);
      g.save(); g.translate(8, 10); g.rotate(-1.35); RR(g, -2.9, -6.2, 5.8, 12.4, 1, '#d63a3a'); RC(g, -2.9, -2, 5.8, 2.4, 'rgba(255,255,255,.6)'); g.restore();     // fallen can
      EL(g, 16, 16.8, 2.6, .6, 'rgba(60,20,10,.5)');      // sticky ring
      A.contact(g, 15, h, 28, .35);
    }
  });
  add({   // desk lamp (warm)
    id: 'deskLamp', x: 620, y: 75, z: 80, w: 24, h: 40, shadow: false,
    bake(g, w, h) {
      EL(g, 6, 39, 6, 1.2, 'rgba(0,0,0,.4)'); RR(g, 1, 36, 10, 3.4, 1.4, '#23272c');
      g.strokeStyle = '#2f343a'; g.lineWidth = 1.2; g.lineJoin = 'round'; g.beginPath(); g.moveTo(6, 36); g.lineTo(9, 18); g.lineTo(16, 8); g.stroke();
      g.strokeStyle = '#6a7279'; g.lineWidth = .4; g.beginPath(); g.moveTo(5.7, 36); g.lineTo(8.7, 18); g.lineTo(15.7, 8); g.stroke();
      EL(g, 9, 18, 1.4, 1.4, '#14161a');
      g.save(); g.translate(17, 8); g.rotate(.5); PO(g, [-1, 0, 10, 0, 7, 6, 2, 6], '#e0a63a'); RC(g, -1, 0, 11, .8, '#f6d27a'); g.restore();
    }
  });
  add({
    id: 'deskLampGlow', x: 620, y: 75, z: 79, w: 24, h: 40, post: true, postMode: 'lighter', shadow: false,
    dyn(g, t) { g.fillStyle = A.rg(g, 20, 17, 0, 26, ['rgba(255,196,110,.55)', 'rgba(255,170,80,0)']); g.fillRect(-8, -10, 60, 60); g.fillStyle = A.rg(g, 20, 14, 0, 4, ['rgba(255,240,200,.9)', 'rgba(255,220,150,0)']); g.fillRect(14, 8, 12, 12); }
  });
  add({   // PC tower beside the desk, RGB fans
    id: 'tower', x: 479, z: 74, w: 22, h: 46, depth: 38, zBias: 6, reflect: .4,
    topRGB: [40, 44, 50], sideRGB: [30, 33, 38],
    bake(g, w, h) {
      RR(g, 0, 0, w, h, 1.4, A.lg(g, 0, 0, w, 0, ['#2c3138', '#181b1f'])); RC(g, 0, 0, w, .7, 'rgba(255,255,255,.25)');
      RC(g, 2, 3, w - 4, h - 12, '#0b0c0e'); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = .3; for (let y = 4; y < h - 10; y += 1.6) { g.beginPath(); g.moveTo(2, y); g.lineTo(w - 2, y); g.stroke(); }
      RC(g, 2, h - 7, w - 4, 3.4, '#101215'); EL(g, 17, h - 5.3, .8, .8, '#2fc267'); RR(g, 4, h - 6.2, 6, 1.4, .6, '#050607');
      A.contact(g, w / 2, h - .3, w + 6, .5);
    },
    dyn(g, t) { for (let i = 0; i < 3; i++) { const cx = 11, cy = 10 + i * 9; g.strokeStyle = hsl(t * 60 + i * 80, 90, 58, .95); g.lineWidth = .9; g.beginPath(); g.arc(cx, cy, 3.6, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = .35; for (let k = 0; k < 4; k++) { const a = t * 6 + k * 1.57; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 3.2, cy + Math.sin(a) * 3.2); g.stroke(); } } }
  });
  add({
    id: 'towerGlow', x: 479, z: 73, w: 22, h: 46, post: true, postMode: 'lighter', shadow: false,
    dyn(g, t) { for (let i = 0; i < 3; i++) { g.fillStyle = A.rg(g, 11, 10 + i * 9, 0, 9, [hsl(t * 60 + i * 80, 90, 55, .28), hsl(t * 60 + i * 80, 90, 55, 0)]); g.fillRect(0, i * 9, 22, 20); } }
  });
  add({   // gaming chair, side view facing the desk
    id: 'chair', x: 508, z: 30, w: 52, h: 96, depth: 8, zBias: 0, reflect: .45,
    topRGB: [30, 32, 36], sideRGB: [28, 30, 34], shadow: { w: 22, d: 14, a: .4 },
    bake(g, w, h) {
      // star base, gas lift
      RC(g, 25, 56, 3.2, 28, '#1b1d21'); RC(g, 25, 56, 1, 28, 'rgba(255,255,255,.2)');
      PO(g, [8, 86, 44, 86, 46, 89, 6, 89], '#1b1d21'); for (const x of [10, 26, 42]) { EL(g, x, 92, 2.8, 2.8, '#101113'); EL(g, x, 92, 1.2, 1.2, '#555b61'); }
      // seat
      RR(g, 8, 48, 40, 9, 4, A.lg(g, 0, 48, 0, 57, ['#2d3238', '#14161a'])); RC(g, 10, 48, 34, .8, 'rgba(255,255,255,.2)'); RC(g, 14, 52, 28, 1.2, '#c0392b');
      // backrest (leaning back)
      g.save(); g.translate(10, 52); g.rotate(-.1);
      RR(g, -4, -48, 11, 52, 5, A.lg(g, -4, 0, 7, 0, ['#14161a', '#2d3238', '#14161a'])); RC(g, -1, -44, 4, 40, '#c0392b'); RC(g, -1, -44, 1, 40, 'rgba(255,255,255,.2)');
      RR(g, -3.4, -52, 10, 8, 3.5, '#1b1d21');           // headrest
      g.restore();
      // armrest
      RR(g, 20, 40, 18, 2.4, 1, '#1b1d21'); RC(g, 28, 42, 2.4, 6, '#1b1d21');
      A.contact(g, 26, h - 3, 50, .45);
    }
  });
  add({   // hoodie thrown on the chair + cables to the floor
    id: 'hoodie', x: 500, y: 52, z: 26, w: 26, h: 30, shadow: false,
    bake(g, w, h) {
      g.fillStyle = A.lg(g, 0, 0, w, h, ['#4b5563', '#2a313a']); g.beginPath(); g.moveTo(2, 4); g.bezierCurveTo(8, -2, 16, 0, 22, 6); g.lineTo(24, 22); g.bezierCurveTo(18, 30, 8, 28, 4, 24); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .5; g.beginPath(); g.moveTo(8, 8); g.bezierCurveTo(10, 14, 9, 20, 11, 25); g.moveTo(16, 6); g.bezierCurveTo(14, 12, 17, 18, 15, 24); g.stroke();
      RC(g, 11, 3, 1, 8, '#d9d2c0');
    }
  });

  /* ----------------------------------------------- mini fridge + shelving */
  add({
    id: 'shelfUnit', x: 660, z: 120, w: 62, h: 206, depth: 30, zBias: 6, reflect: .3,
    topRGB: [60, 66, 72], sideRGB: [50, 56, 62],
    bake(g, w, h) {
      steelLeg(g, 1, 0, 3, h); steelLeg(g, w - 4, 0, 3, h);
      const ys = [30, 78, 126, 170];
      ys.concat([h - 2]).forEach((y, i) => { RC(g, 0, y, w, 2.6, '#59616a'); RC(g, 0, y, w, .5, 'rgba(255,255,255,.3)'); });
      // contents
      box(g, 6, 8, 22, 22, CARD, 1, true); box(g, 29, 14, 18, 16, '#8e7650', 2, true); box(g, 47, 6, 12, 24, '#5b6f86', 3, true);                     // top (y 8..30)
      box(g, 5, 52, 25, 26, '#a98655', 4, true); RR(g, 33, 58, 24, 20, 2, 'rgba(120,170,200,.45)'); RC(g, 33, 56.5, 24, 2, '#2f6a8a'); spool(g, 45, 68, 8, FIL[8], 5);                 // y 52..78
      box(g, 6, 104, 20, 22, '#7d6a4a', 6, true); box(g, 27, 108, 28, 18, CARD, 7, true); box(g, 39, 92, 16, 16, '#b49060', 8, true);           // y 104..126
      // tipped failed print + tangled filament
      PO(g, [8, 170, 16, 150, 26, 160, 22, 170], '#e86aa6'); g.strokeStyle = '#33c3c9'; g.lineWidth = .8; g.beginPath(); g.moveTo(30, 170); g.bezierCurveTo(34, 150, 46, 168, 50, 156); g.stroke();
      for (let i = 0; i < 3; i++) spool(g, 38 + i * 6, 176, 5, FIL[(i + 5) % 14], i + 20, { empty: i === 1 });
      EL(g, 40, 160, 3.6, 3.6, '#2a2e33');
      // lower: empty crates
      RR(g, 5, 130, 52, 20, 1.5, '#2f3a46'); for (let x = 9; x < 54; x += 6) RC(g, x, 134, 3, 12, 'rgba(0,0,0,.35)');
      A.contact(g, w / 2, h - .3, w, .5);
    }
  });
  add({
    id: 'miniFridge', x: 664, z: 82, w: 48, h: 54, depth: 40, zBias: 4, reflect: .55,
    topRGB: [170, 175, 178], sideRGB: [150, 156, 160],
    bake(g, w, h) {
      RR(g, 0, 0, w, h, 2.4, A.lg(g, 0, 0, w, 0, ['#c9cfd3', '#a7aeb3', '#8a9298'])); RC(g, 0, 0, w, .8, 'rgba(255,255,255,.55)');
      RC(g, 1, 17, w - 2, .7, 'rgba(0,0,0,.45)');          // freezer seam
      RC(g, w - 8, 4, 1.8, 9, '#3a3f45'); RC(g, w - 8, 21, 1.8, 20, '#3a3f45');
      // magnets and sticky notes
      RC(g, 8, 24, 8, 8, '#f2cf3a'); RC(g, 9, 26, 6, .6, 'rgba(0,0,0,.5)'); RC(g, 9, 28, 4, .6, 'rgba(0,0,0,.4)');
      EL(g, 20, 36, 2.2, 2.2, '#d63a3a'); RC(g, 14, 33, 8, 5, 'rgba(255,255,255,.8)'); EL(g, 29, 28, 1.6, 1.6, '#2f6fe0');
      A.streaks(g, 2, 2, w - 4, h - 4, 4, 6, 'rgba(90,80,50,.28)'); A.specks(g, 0, 0, w, h, 3, 20, 'rgba(60,50,30,.28)', 1);
      A.contact(g, w / 2, h - .3, w, .5);
    }
  });

  /* ------------------------------------------------- floor clutter (decor) */
  add({   // trash bag? no: box of failed prints + coils of cable by the bench
    id: 'cableCoil', x: 355, z: 22, w: 30, h: 8, depth: 14, zBias: 3, shadow: { w: 14, a: .3 },
    bake(g, w, h) {
      for (let i = 0; i < 5; i++) { g.strokeStyle = i % 2 ? '#15171b' : '#242830'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(15, 4.5, 13 - i * 1.5, 3 - i * .1, 0, 0, TAU); g.stroke(); }
      A.cable(g, [[28, 5], [34, 7]], 1.4, '#15171b');
    }
  });
  add({
    id: 'scrapPile', x: 205, z: 8, w: 40, h: 8, shadow: false,
    bake(g, w, h) {
      const r = srand(11); for (let i = 0; i < 26; i++) { g.strokeStyle = FIL[(r() * FIL.length) | 0]; g.lineWidth = .5 + r() * .4; g.lineCap = 'round'; const x = r() * 36, y = 2 + r() * 5; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 4, y - 4, x + 9, y + 3, x + 12 + r() * 6, y); g.stroke(); }
    }
  });
  add({   // waste bin full of filament offcuts and bubble wrap
    id: 'wasteBin', x: 640, z: 28, w: 24, h: 34, depth: 20, zBias: 6, reflect: .4,
    bake(g, w, h) {
      PO(g, [1, 6, 23, 6, 20, 34, 4, 34], A.lg(g, 0, 6, w, 6, ['#454b53', '#2a2e33'])); RC(g, 0, 4, w, 3, '#59616a'); RC(g, 0, 4, w, .6, 'rgba(255,255,255,.3)');
      const r = srand(13); for (let i = 0; i < 12; i++) { g.strokeStyle = FIL[(r() * FIL.length) | 0]; g.lineWidth = .7; g.beginPath(); g.moveTo(3 + r() * 18, 5); g.bezierCurveTo(3 + r() * 18, -3, 3 + r() * 18, 0, 3 + r() * 18, 5); g.stroke(); }
      EL(g, 12, 3, 8, 1.6, 'rgba(230,240,245,.5)');
      A.contact(g, w / 2, h - .2, w + 4, .5);
    }
  });

  /* --------------------------------- ceiling: LED strip, track lights */
  add({
    id: 'ledStrip', x: 350, y: 252, z: 108, w: 560, h: 4, post: true, postMode: 'lighter', shadow: false,
    dyn(g, t, S) { const f = .92 + .08 * Math.sin(t * 60) * Math.sin(t * 3.7); g.fillStyle = 'rgba(215,235,255,' + .85 * f + ')'; g.fillRect(0, .6, 560, 2.6); g.fillStyle = A.lg(g, 0, 3, 0, 22, ['rgba(180,215,255,.22)', 'rgba(180,215,255,0)']); g.fillRect(0, 3, 560, 22); }
  });
  add({
    id: 'ledChannel', x: 350, y: 252, z: 108, w: 568, h: 6, shadow: false,
    bake(g, w, h) { RC(g, 0, 0, w, h, A.lg(g, 0, 0, 0, h, ['#8c949b', '#4f565d'])); RC(g, 0, 0, w, .6, 'rgba(255,255,255,.4)'); for (let x = 20; x < w; x += 62) RC(g, x, 0, 1.4, h, '#2a2e33'); }
  });
  [150, 330, 520].forEach((x, i) => {
    add({
      id: 'track' + i, x, y: 232, z: 52, w: 14, h: 28, shadow: false,
      bake(g, w, h) {
        RC(g, 6, 0, 2, 7, '#1b1d21'); g.save(); g.translate(7, 7); g.rotate(i === 1 ? 0 : (i === 0 ? .25 : -.25));
        PO(g, [-3, 0, 3, 0, 5, 12, -5, 12], A.lg(g, -5, 0, 5, 0, ['#4b5158', '#23272b'])); RC(g, -3, 0, 6, .6, 'rgba(255,255,255,.3)'); EL(g, 0, 12.3, 4.8, 1, i === 2 ? '#ffe9c4' : '#dfeeff'); g.restore();
      }
    });
    add({
      id: 'trackGlow' + i, x, y: 232, z: 51, w: 14, h: 28, post: true, postMode: 'lighter', shadow: false,
      dyn(g, t) { g.fillStyle = A.rg(g, 7, 19, 0, 16, [i === 2 ? 'rgba(255,220,170,.4)' : 'rgba(200,225,255,.4)', 'rgba(200,225,255,0)']); g.fillRect(-12, 5, 38, 30); }
    });
  });

  /* ------------------------------------------------- FOREGROUND (blurred) */
  const fgDark = (g, w, h) => { g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(8,12,18,.5)'; g.fillRect(0, 0, w, h); g.restore(); };
  add({   // low stool with a spool + crate, passes in front
    id: 'fgStool', x: 322, z: -78, w: 38, h: 60, blur: 3.2, alpha: .92, shadow: false,
    bake(g, w, h) {
      RR(g, 2, 8, 34, 5, 2, '#2a2e33'); RC(g, 4, 13, 3, 46, '#1b1d21'); RC(g, 31, 13, 3, 46, '#1b1d21'); RC(g, 5, 36, 28, 2, '#1b1d21');
      spool(g, 19, 3, 9, FIL[0], 4); RC(g, 8, 0, 22, 2, 'rgba(0,0,0,0)');
      box(g, 8, 20, 22, 14, CARD, 3, true); fgDark(g, w, h);
    }
  });
  add({   // hanging cable loop from the ceiling
    id: 'fgCables', x: 470, y: 160, z: -92, w: 44, h: 100, blur: 4, alpha: .9, shadow: false,
    bake(g, w, h) {
      g.lineCap = 'round'; g.strokeStyle = '#111317'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(10, 0); g.bezierCurveTo(8, 50, 30, 80, 24, 98); g.stroke();
      g.strokeStyle = '#2f6fe0'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(20, 0); g.bezierCurveTo(24, 40, 10, 66, 16, 96); g.stroke();
      g.strokeStyle = '#c93a2d'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(30, 0); g.bezierCurveTo(34, 30, 38, 60, 32, 90); g.stroke(); fgDark(g, w, h);
    }
  });
  add({   // stacked boxes at far left front
    id: 'fgBoxes', x: 130, z: -118, w: 70, h: 52, blur: 5, alpha: .9, shadow: false,
    bake(g, w, h) { box(g, 2, 22, 40, 30, CARD, 1, true); box(g, 44, 30, 24, 22, '#8e7650', 2, true); box(g, 8, 4, 28, 18, '#b49060', 3, true); spool(g, 56, 24, 8, FIL[1], 7); fgDark(g, w, h); }
  });
  add({   // thin vertical conduit/pipe at right foreground edge
    id: 'fgPipe', x: 600, z: -140, w: 14, h: 260, blur: 6, alpha: .85, shadow: false,
    bake(g, w, h) { RC(g, 3, 0, 8, h, A.lg(g, 3, 0, 11, 0, ['#2a2e33', '#59616a', '#1a1c20'])); RC(g, 1, 80, 12, 4, '#14161a'); RC(g, 1, 170, 12, 4, '#14161a'); fgDark(g, w, h); }
  });

  /* ================================================================== room */
  BB.defineRoom({
    id: 'work',
    wallColor: ['#566a73', '#364249'],
    partitionFace: '#4f626a',
    floorColor: ['#55565c', '#34353a'],
    gloss: .08,
    ambient: { color: [86, 94, 108] },
    ambientNow(S, t) { return [86, 94, 108]; },

    wall(g, w, h, room) {
      const r = srand(41);
      RC(g, 0, 0, w, h, '#2f383d');
      const bw = 21, bh = 7.3, y0 = 24;
      for (let row = 0, y = y0; y < h; row++, y += bh) {
        const off = (row % 2) * bw / 2;
        for (let x = -off; x < w; x += bw) {
          const v = r(), k = (y - y0) / (h - y0);
          g.fillStyle = A.mix('#6a8088', '#4a5c64', clamp(v * .75 + k * .3, 0, 1));
          g.fillRect(x + .6, y + .6, bw - 1.2, bh - 1.2);
          g.fillStyle = 'rgba(255,255,255,' + (.05 + r() * .06) + ')'; g.fillRect(x + .6, y + .6, bw - 1.2, 1);
          g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + .6, y + bh - 1.7, bw - 1.2, 1.1);
          if (r() < .05) { g.fillStyle = 'rgba(150,70,50,.55)'; g.beginPath(); g.moveTo(x + 2 + r() * 4, y + 1); g.lineTo(x + 8 + r() * 8, y + 1.5); g.lineTo(x + 6 + r() * 8, y + bh - 1.5); g.lineTo(x + 3, y + bh - 2); g.fill(); }  // chipped paint
        }
      }
      A.blotches(g, 0, y0, w, h - y0, 17, 22, 'rgba(10,20,25,.16)', 12, 46);
      A.grain(g, 0, y0, w, h - y0, .12, .8);
      // concrete beam at the top
      RC(g, 0, 0, w, y0, A.lg(g, 0, 0, 0, y0, ['#6b6d70', '#505357'])); A.grain(g, 0, 0, w, y0, .2, .9);
      g.fillStyle = 'rgba(0,0,0,.22)'; for (let x = 70; x < w; x += 118) g.fillRect(x, 0, .9, y0);
      for (let x = 20; x < w; x += 59) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 10, 1.6, 1.6); }
      RC(g, 0, y0 - 1, w, 1.2, 'rgba(0,0,0,.5)');
      // cable tray along the beam
      const ty = 27, th = 11;
      RC(g, 0, ty + th, w, 3, 'rgba(0,0,0,.28)');
      RC(g, 0, ty, w, th, A.lg(g, 0, ty, 0, ty + th, ['#8d959c', '#4d555c'])); RC(g, 0, ty, w, .8, 'rgba(255,255,255,.4)');
      g.fillStyle = 'rgba(15,18,22,.8)'; for (let x = 3; x < w; x += 7) { g.beginPath(); g.roundRect(x, ty + 4, 4, 3, 1.4); g.fill(); }
      const cr = srand(9); for (let i = 0; i < 5; i++) { g.strokeStyle = ['#111317', '#2f6fe0', '#c93a2d', '#e0b92a', '#e8e8e2'][i]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, ty - 1.5 - i * .9); for (let x = 0; x < w; x += 30) g.lineTo(x + 30, ty - 1.5 - i * .9 + (cr() - .5) * 1.3); g.stroke(); }
      for (let x = 38; x < w; x += 96) { RC(g, x, ty - 1, 1.6, th + 1, '#2a2e33'); }
      // conduits dropping from the tray to outlets
      const drop = (x, y1, c) => { RC(g, x - 1.4, ty + th, 2.8, y1 - ty - th, A.lg(g, x - 1.4, 0, x + 1.4, 0, [c || '#7a8289', '#caced2', '#5a6269'])); for (let y = ty + th + 18; y < y1; y += 28) RC(g, x - 2, y, 4, 1.6, '#2a2e33'); };
      drop(176, 150); drop(316, 150); drop(520, 150); drop(655, 110);
      const outlet = (x, y) => { RR(g, x - 5, y - 5, 10, 10, 1.2, '#d6d9d6'); RC(g, x - 5, y - 5, 10, .8, 'rgba(255,255,255,.7)'); EL(g, x - 2, y, .7, .7, '#2a2a2a'); EL(g, x + 2, y, .7, .7, '#2a2a2a'); RC(g, x - 5, y + 4, 10, 1, 'rgba(0,0,0,.2)'); };
      outlet(176, 152); outlet(316, 152); outlet(520, 152); outlet(655, 112);
      // power strip with a blinking switch glow baked as plastic
      RR(g, 166, 166, 28, 5, 1.4, '#e8e8e2'); RC(g, 168, 168, 3, 2, '#d63a3a'); for (let i = 0; i < 4; i++) RC(g, 173 + i * 5, 168, 3.4, 2.2, '#2a2e33');
      // window: transparent hole + steel frame
      A.hole(g, 337, 52, 64, 52);
      g.fillStyle = '#23282d'; g.fillRect(333, 48, 72, 4.6); g.fillRect(333, 104, 72, 4.6); g.fillRect(333, 48, 4.6, 61); g.fillRect(400.4, 48, 4.6, 61);
      g.fillRect(366, 52, 2.6, 52); g.fillRect(337, 76, 64, 2.2);
      g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(333, 48, 72, .8); g.fillRect(337, 52, 29, .5);
      PO(g, [340, 54, 356, 54, 345, 74, 340, 74], 'rgba(255,255,255,.07)');
      RC(g, 328, 108.6, 82, 4, '#7a7f84'); RC(g, 328, 108.6, 82, .8, 'rgba(255,255,255,.4)'); RC(g, 331, 112.6, 76, 6, 'rgba(0,0,0,.28)');
      g.strokeStyle = 'rgba(180,200,220,.5)'; g.lineWidth = .5; g.beginPath(); g.moveTo(337, 90); g.lineTo(366, 78); g.stroke();
      // stains, drips, paint splashes
      A.streaks(g, 0, ty + th + 2, w, 90, 6, 18, 'rgba(15,20,22,.28)'); A.streaks(g, 330, 112, 80, 60, 3, 6, 'rgba(160,170,180,.14)');
      A.blotches(g, 560, 100, 90, 80, 4, 6, 'rgba(20,10,5,.22)', 6, 18);
      // shadows where the printer / bench stand (soft baked AO behind)
      g.fillStyle = A.rg(g, 245, 120, 10, 100, ['rgba(0,0,0,.30)', 'rgba(0,0,0,0)']); g.fillRect(120, 20, 250, 230);
      g.fillStyle = A.rg(g, 560, 160, 10, 110, ['rgba(0,0,0,.25)', 'rgba(0,0,0,0)']); g.fillRect(440, 40, 240, 220);
      A.wallAO(g, w, h);
      // rubber skirting
      RC(g, 0, h - 10, w, 10, '#17191c'); RC(g, 0, h - 10, w, .9, 'rgba(255,255,255,.18)'); RC(g, 0, h - 1.6, w, 1.6, 'rgba(0,0,0,.6)');
      // taped outline marks on the wall (where something used to hang), a zip-tied cable bundle
      g.strokeStyle = 'rgba(232,210,110,.65)'; g.lineWidth = 1.1; g.setLineDash([5, 3]); g.strokeRect(444, 120, 40, 36); g.setLineDash([]);
    },

    floor(g, w, d, room) {
      // plan view: y = distance from back wall (0) -> viewer (d); lane z=0 at y=160
      RC(g, 0, 0, w, d, A.lg(g, 0, 0, 0, d, ['#464851', '#585a63']));
      A.blotches(g, 0, 0, w, d, 21, 80, 'rgba(0,0,0,.2)', 14, 60);
      A.blotches(g, 0, 0, w, d, 22, 40, 'rgba(255,255,255,.04)', 20, 70);
      A.grain(g, 0, 0, w, d, .2, .8);
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; for (const x of [150, 380, 600, 820]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, d); g.stroke(); }     // expansion joints
      g.beginPath(); g.moveTo(0, 190); g.lineTo(w, 196); g.stroke();
      const cr = srand(5); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .8; for (let i = 0; i < 7; i++) { let x = cr() * w, y = cr() * d; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (cr() - .5) * 26; y += (cr() - .2) * 14; g.lineTo(x, y); } g.stroke(); }
      // oil / epoxy stains
      A.glow(g, 410, 170, 34, 'rgba(10,8,6,.5)'); A.glow(g, 230, 150, 40, 'rgba(10,8,6,.28)'); A.glow(g, 120, 100, 26, 'rgba(30,60,40,.2)');
      // rubber mat under the printer bench (coin pattern), and an anti-fatigue strip in front of it
      const matx = 165, maty = 34, matw = 190, math = 92;
      RC(g, matx - 2, maty - 2, matw + 4, math + 4, 'rgba(0,0,0,.35)');
      RC(g, matx, maty, matw, math, A.lg(g, 0, maty, 0, maty + math, ['#1d1f23', '#2a2d32']));
      g.fillStyle = 'rgba(255,255,255,.07)'; for (let x = matx + 4; x < matx + matw; x += 7) for (let y = maty + 4; y < maty + math; y += 7) { g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
      RC(g, matx, maty, matw, 1.4, 'rgba(255,255,255,.16)'); RC(g, matx, maty + math - 1.4, matw, 1.4, 'rgba(0,0,0,.4)');
      // desk mat (blue-grey carpet tile area)
      const dx = 470, dy = 34, dw = 200, dh = 112;
      RC(g, dx, dy, dw, dh, A.lg(g, 0, dy, 0, dy + dh, ['#2b3340', '#202733'])); A.grain(g, dx, dy, dw, dh, .22, .6);
      RC(g, dx, dy + dh - 1.4, dw, 1.4, 'rgba(0,0,0,.4)'); RC(g, dx, dy, 1.3, dh, 'rgba(255,255,255,.08)');
      // hazard tape square around the toolbox spot
      g.save(); g.beginPath(); g.rect(372, 144, 66, 40); g.rect(374.6, 146.6, 60.8, 34.8); g.clip('evenodd');
      for (let x = 360; x < 450; x += 8) { g.fillStyle = '#d4b02a'; g.beginPath(); g.moveTo(x, 190); g.lineTo(x + 4, 190); g.lineTo(x + 14, 140); g.lineTo(x + 10, 140); g.fill(); }
      g.restore();
      // filament scraps and cable runs
      const sr = srand(31);
      for (let i = 0; i < 70; i++) { g.strokeStyle = FIL[(sr() * FIL.length) | 0]; g.lineWidth = .5 + sr() * .5; g.lineCap = 'round'; const x = sr() * w * .72, y = 20 + sr() * 300; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 5, y - 5, x + 11, y + 5, x + 10 + sr() * 12, y + (sr() - .5) * 6); g.stroke(); }
      A.cable(g, [[180, 70], [210, 120], [300, 150], [380, 140], [430, 170], [520, 150], [560, 120]], 1.6, '#101215');
      A.cable(g, [[330, 50], [350, 110], [420, 190], [470, 200], [560, 150]], 1.2, '#2f6fe0');
      A.cable(g, [[600, 130], [630, 170], [690, 150], [760, 190]], 1.4, '#c93a2d');
      // wood chips / packaging foam crumbs
      A.specks(g, 0, 0, w, d, 12, 200, 'rgba(210,190,150,.4)', 1.6);
      // strip of light spill under the window (moonlight on floor)
      PO(g, [338, 0, 398, 0, 430, 60, 310, 60], 'rgba(150,180,230,.05)');
    },

    ceil(g, w, d, room) {
      RC(g, 0, 0, w, d, A.lg(g, 0, 0, 0, d, ['#33363a', '#4a4d52'])); A.grain(g, 0, 0, w, d, .22, .9);
      A.blotches(g, 0, 0, w, d, 4, 24, 'rgba(0,0,0,.2)', 10, 40);
      // transverse concrete beams
      for (let x = 20; x < w; x += 190) { RC(g, x, 0, 18, d, 'rgba(0,0,0,.2)'); RC(g, x, 0, 1.2, d, 'rgba(255,255,255,.07)'); }
      // LED channel and track rail
      RC(g, 70, 49, 570, 8, '#2a2e33'); RC(g, 70, 49, 570, 1, 'rgba(255,255,255,.2)');
      RC(g, 70, 108, 570, 3, '#1b1d21'); RC(g, 70, 108, 570, .6, 'rgba(255,255,255,.2)');
      g.strokeStyle = '#14161a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, 35); g.lineTo(w, 35); g.stroke();
      // sprinkler pipe, cable trunking to the printer
      RC(g, 0, 150, w, 3.2, '#6b2a22'); RC(g, 0, 150, w, .8, 'rgba(255,255,255,.2)');
    },

    objects: sprites,

    lights: [
      { id: 'shopA', x: 330, y: 244, z: 52, r: 380, color: '200,222,255', i: .95, flicker: .02, bloom: .06 },
      { id: 'shopB', x: 120, y: 244, z: 60, r: 300, color: '205,228,255', i: .8, bloom: .05 },
      { id: 'shopC', x: 560, y: 244, z: 52, r: 280, color: '255,224,190', i: .5, bloom: .05 },
      { id: 'monitor', x: 566, y: 110, z: 84, r: 240, color: '130,180,255', i: .95, flicker: .05, bloom: .14 },
      { id: 'lamp', x: 618, y: 105, z: 72, r: 150, color: '255,190,110', i: .9, bloom: .14 },
      { id: 'chamber', x: 245, y: 135, z: 45, r: 105, color: '255,248,235', i: .8, bloom: .1 },
      { id: 'ledGreen', x: 228, y: 98, z: 30, r: 78, color: '70,255,130', i: .95, bloom: .14, on: S => pstate(S).led === 'green' },
      { id: 'ledRed', x: 228, y: 98, z: 30, r: 90, color: '255,60,45', i: .95, flicker: .7, bloom: .16, on: S => pstate(S).led === 'red' },
      { id: 'ledAmber', x: 228, y: 98, z: 30, r: 80, color: '255,176,40', i: .85, bloom: .12, on: S => pstate(S).led === 'amber' },
      { id: 'ledIdle', x: 228, y: 98, z: 30, r: 70, color: '150,210,255', i: .55, bloom: .08, on: S => pstate(S).led === 'idle' },
      { id: 'tower', x: 479, y: 40, z: 60, r: 70, color: '170,120,255', i: .55, bloom: .05 },
      { id: 'moon', x: 369, y: 180, z: 140, r: 210, color: '120,150,230', i: .35, bloom: .08 }
    ],

    hotspots: [
      { id: 'printer', x: 245, r: 80, h: 110 },
      { id: 'toolbox', x: 405, r: 45, h: 40 },
      { id: 'pc', x: 560, r: 80, h: 120 }
    ],
    solids: []
  });
})();
