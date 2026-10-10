/* ==========================================================================
   BB.char - 2D skeletal rig for Bamboul (from the supplied photo), Dan and the landlord.
   Draw space: centimetres, origin at the FEET, up = -y, facing +x (flipped by ctl.face).
   Hero is 178 cm tall in every pose (feet at y=0, top of hair ~ -178).
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const S_ = Math.sin, C_ = Math.cos;
  const INK = '#1c1511';

  /* ---- looks (palette measured from assets/source/hero_photo.png) ---- */
  const LOOKS = {
    bamboul: { h: 178, skin: '#efc3a8', skinD: '#d39d83', skinL: '#f8d9c4', hair: '#b79c74', hairD: '#8a7352', hairL: '#d9c7a0', beard: 'rgba(158,116,82,.62)', brow: '#9a825c', eye: '#56708f',
      top: 'pattern', tee: '#f4f1e8', teeD: '#d9d4c6', pants: '#cdb98f', pantsD: '#a8946a', belt: '#4a3222', shoe: '#e8e6e0', shoeD: '#a9a8a2', sole: '#8d8a84', shorts: true, belly: 1, width: 1 },
    dan: { h: 183, skin: '#e6b99c', skinD: '#c99a80', skinL: '#f2d0b8', hair: '#2a211c', hairD: '#17110e', hairL: '#4a3a30', beard: 'rgba(40,30,25,.45)', brow: '#2a211c', eye: '#3b2c20',
      top: '#27272d', topD: '#17171b', tee: '#8a8a92', teeD: '#6a6a72', pants: '#3b4a68', pantsD: '#2a3650', belt: '#222', shoe: '#2d2d33', shoeD: '#1a1a1e', sole: '#e6e6e6', shorts: false, belly: .35, width: .9, hood: true },
    landlord: { h: 172, skin: '#e2ae92', skinD: '#c28d73', skinL: '#efc6ae', hair: '#8f8f93', hairD: '#6c6c70', hairL: '#b8b8bc', beard: 'rgba(0,0,0,0)', brow: '#6c6c70', eye: '#3a3a3a', bald: true, stache: true,
      top: '#6b4f36', topD: '#4a3523', tee: '#e8e2d0', teeD: '#c8c2b0', tie: '#8a1f1f', pants: '#3a3a44', pantsD: '#26262e', belt: '#111', shoe: '#1a1512', shoeD: '#0d0a08', sole: '#000', shorts: false, belly: 1.45, width: 1.18, jacket: true }
  };

  /* ---- shirt pattern tile (beige / ochre / olive / navy line shapes) ---- */
  let patTile = null;
  function pattern(g) {
    if (!patTile) {
      const c = BB.mk(96, 96), p = c.getContext('2d');
      p.fillStyle = '#cdb583'; p.fillRect(0, 0, 96, 96);
      p.fillStyle = '#e4d6a8'; p.fillRect(0, 0, 38, 30); p.fillRect(50, 44, 46, 36);
      p.fillStyle = '#a89358'; p.fillRect(38, 0, 28, 44); p.fillRect(0, 60, 32, 36);
      p.fillStyle = '#7d7a46'; p.fillRect(68, 0, 28, 26); p.fillRect(30, 70, 24, 26);
      p.fillStyle = '#3c3a52'; p.fillRect(40, 62, 8, 8); p.fillRect(4, 28, 8, 8); p.fillRect(80, 40, 6, 10);
      p.strokeStyle = '#2f2f4a'; p.lineWidth = 2.2; p.lineJoin = 'round';
      p.strokeRect(8, 8, 18, 14); p.strokeRect(56, 54, 14, 14); p.strokeRect(60, 58, 6, 6);
      p.beginPath(); p.arc(80, 14, 9, 0, 7); p.stroke(); p.beginPath(); p.arc(80, 14, 3.5, 0, 7); p.stroke();
      p.beginPath(); p.moveTo(0, 44); p.lineTo(30, 36); p.lineTo(44, 60); p.lineTo(26, 92); p.stroke();
      p.beginPath(); p.moveTo(38, 4); p.lineTo(64, 18); p.lineTo(52, 42); p.lineTo(88, 40); p.stroke();
      p.beginPath(); p.ellipse(14, 76, 9, 12, .4, 0, 7); p.stroke(); p.beginPath(); p.moveTo(70, 78); p.lineTo(92, 90); p.stroke();
      p.fillStyle = 'rgba(40,40,70,.55)'; p.beginPath(); p.ellipse(60, 30, 7, 4, .6, 0, 7); p.fill();
      patTile = c;
    }
    return g.createPattern(patTile, 'repeat');
  }

  /* ---- primitives with ink outline ---- */
  function ink(g, w) { g.strokeStyle = INK; g.lineWidth = w || 1.3; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function limb(g, x0, y0, x1, y1, w, fill, outline) {
    g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = w + (outline == null ? 2.4 : outline); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = fill; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  function blob(g, x, y, rx, ry, fill, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, 7); g.fillStyle = fill; g.fill(); ink(g, 1.2); }
  function ik(ax, ay, bx, by, l1, l2) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy); const m = l1 + l2 - .5;
    if (d > m) { bx = ax + dx / d * m; by = ay + dy / d * m; d = m } if (d < 4) d = 4;
    const base = Math.atan2(by - ay, bx - ax), A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), ang = base - A;
    return [ax + Math.cos(ang) * l1, ay + Math.sin(ang) * l1, bx, by];
  }

  /* ---- poses ---- */
  const BASE = { crouch: 0, lean: 0, head: 0, lift: 0, bx: -9, by: 0, fx: 9, fy: 0, aB0: -.12, aB1: .2, aF0: .12, aF1: .25, eye: 1, brow: 0, mouth: 0, tool: 80, sway: 0 };
  function poseFor(st, t, ph, k, ctl) {
    const p = Object.assign({}, BASE), s = S_, c = C_;
    p.eye = (t % 3.9) < .12 ? .1 : 1;
    switch (st) {
      case 'idle': p.crouch = s(t * 2) * 1.2 + 1; p.aF0 = .1 + s(t * 2) * .03; p.aB0 = -.1 - s(t * 2) * .03; p.head = s(t * .7) * .04; break;
      case 'idleBored': p.head = s(t * 1.3) * .22; p.crouch = 1.5; p.aF0 = .2; p.aB0 = -.2; p.brow = -.4; p.mouth = -.4; p.eye = .6; break;
      case 'walk': case 'run': case 'carry': {
        const run = st === 'run', A = run ? 31 : 26, lf = run ? 17 : 9;
        p.fx = s(ph) * A; p.fy = Math.max(0, c(ph)) * lf; p.bx = -s(ph) * A; p.by = Math.max(0, -c(ph)) * lf;
        p.crouch = 1 + Math.abs(s(ph)) * (run ? 5 : 3); p.lean = run ? .2 : .06;
        p.aF0 = -s(ph) * (run ? .9 : .5); p.aF1 = run ? 1.2 : .35; p.aB0 = s(ph) * (run ? .9 : .5); p.aB1 = run ? 1.2 : .35;
        if (st === 'carry') { p.aF0 = .12; p.aF1 = .1; p.lean = -.04 } if (run) p.mouth = .6; break
      }
      case 'stop': p.lean = -.12; p.fx = 16; p.bx = -12; p.crouch = 3; p.aF0 = .4; p.aB0 = -.4; break;
      case 'turn': p.head = .3; p.lean = .05; break;
      case 'jump': p.fy = 16; p.by = 26; p.fx = 12; p.bx = -8; p.aF0 = 2.4; p.aF1 = .3; p.aB0 = 2.0; p.aB1 = .3; p.lean = .08; p.eye = 1.2; break;
      case 'fall': p.fy = 3; p.by = 12; p.fx = 14; p.bx = -14; p.aF0 = 1.6; p.aF1 = .2; p.aB0 = -1.4; p.aB1 = -.2; p.eye = 1.3; p.mouth = .7; break;
      case 'land': p.crouch = 22; p.lean = .25; p.fx = 17; p.bx = -15; p.aF0 = .6; p.aB0 = .3; break;
      case 'reach': p.lean = .12; p.aF0 = 1.9; p.aF1 = .1; p.aB0 = -.2; p.fx = 12; p.bx = -10; break;
      case 'inspect': p.lean = .22; p.head = .12; p.aF0 = .5; p.aF1 = 2.25; p.aB0 = -.2; p.aB1 = .9; p.brow = -.4; p.crouch = 3; break;
      case 'inspectLow': p.crouch = 30; p.lean = .42; p.head = -.2; p.aF0 = 1.1; p.aF1 = .5; p.aB0 = .6; p.aB1 = .6; p.fx = 22; p.bx = -16; p.brow = -.5; break;
      case 'pickup': { const u = s(clamp(k, 0, 1) * Math.PI); p.crouch = 36 * u; p.lean = .85 * u; p.aF0 = .2 + .2 * u; p.aF1 = .1; p.aB0 = .1; p.head = -.3 * u; p.fx = 21; p.bx = -15; break }
      case 'putBag': case 'toss': { const u = clamp(k, 0, 1); p.aF0 = u < .4 ? lerp(.2, -2.4, u / .4) : lerp(-2.4, 1.5, (u - .4) / .6); p.aF1 = .3; p.lean = u < .4 ? -.15 : .3; p.fx = 22; p.bx = -16; break }
      case 'open': p.aF0 = 1.35; p.aF1 = .25; p.lean = .14; p.fx = 16; p.bx = -14; p.brow = .5; break;
      case 'openFridge': { const u = clamp(k, 0, 1); p.aF0 = 1.2 + u * .5; p.aF1 = .3; p.lean = -.1 * u; p.brow = .6 * u; p.eye = 1.3; p.mouth = u > .5 ? 1 : 0; p.fx = 15; p.bx = -12; break }
      case 'disgust': p.lean = -.28; p.head = -.25; p.aF0 = 1.3; p.aF1 = 1.9; p.aB0 = .3; p.brow = -1; p.eye = .35; p.mouth = -1; p.fx = 14; p.bx = -14; break;
      case 'door': p.aF0 = 1.3; p.aF1 = .1; p.lean = .1; p.head = .1; p.brow = .6; p.eye = 1.3; break;
      case 'scrub': case 'scrubFridge': p.aF0 = 1.45 + s(t * 11) * .3; p.aF1 = .5 + c(t * 11) * .3; p.aB0 = .5; p.aB1 = 1; p.lean = .16; p.fx = 16; p.bx = -16; p.brow = -.5; p.mouth = -.6; break;
      case 'scrubToilet': p.crouch = 20; p.lean = .5; p.aF0 = 1.2 + s(t * 10) * .35; p.aF1 = .6; p.aB0 = .8; p.aB1 = .6; p.fx = 20; p.bx = -16; p.brow = -.7; p.mouth = -.6; break;
      case 'flush': p.aF0 = 1.2; p.aF1 = .2; p.lean = .1; p.mouth = .5; break;
      case 'mop': p.lean = .34; p.crouch = 6; p.aF0 = .75 + s(t * 7) * .2; p.aF1 = .55; p.aB0 = 1 + s(t * 7) * .2; p.aB1 = .5; p.fx = 24; p.bx = -22; p.tool = 80 + s(t * 7) * 24; p.brow = -.5; p.mouth = -.5; break;
      case 'vac': p.lean = .22; p.aF0 = .8 + s(t * 4) * .15; p.aF1 = .4; p.aB0 = .2; p.aB1 = .5; p.fx = 20; p.bx = -18; p.tool = 84 + s(t * 4) * 18; p.crouch = 2 + s(t * 30) * .6; break;
      case 'repair': p.crouch = 42; p.lean = .5; p.aF0 = 1 + s(t * 9) * .18; p.aF1 = .7; p.aB0 = .8; p.aB1 = .6; p.fx = 28; p.bx = -20; p.head = -.25; p.brow = -.7; p.mouth = -.5; break;
      case 'tinker': p.lean = .2; p.aF0 = 1.25 + s(t * 8) * .12; p.aF1 = .5 + c(t * 8) * .15; p.aB0 = 1.1 - s(t * 8) * .1; p.aB1 = .55; p.brow = -.6; p.head = .08; p.fx = 16; p.bx = -14; break;
      case 'phoneUse': p.aF0 = lerp(.2, .55, clamp(k, 0, 1)); p.aF1 = lerp(.3, 2.45, clamp(k, 0, 1)); p.head = -.05; break;
      case 'phone': p.aF0 = .55; p.aF1 = 2.45; p.head = -.08; p.aB0 = -.15 + s(t * 1.5) * .1; p.aB1 = .5; p.mouth = (t * 3 % 1) < .5 ? .5 : 0; p.crouch = 1 + s(t * 2); break;
      case 'listen': p.aF0 = .55; p.aF1 = 2.45; p.head = -.14; p.aB0 = .3; p.aB1 = 1.9; p.brow = -.8; p.eye = .55; p.mouth = -.6; break;
      case 'nervous': p.aF0 = .55; p.aF1 = 2.45; p.head = .05; p.aB0 = -.5 + s(t * 9) * .08; p.aB1 = .4; p.brow = 1; p.eye = 1.45; p.mouth = .3; p.crouch = 3 + s(t * 14); break;
      case 'shock': p.lean = -.2; p.aF0 = .75; p.aF1 = 2.25; p.aB0 = .55; p.aB1 = 2.3; p.eye = 1.7; p.brow = 1; p.mouth = 1; p.fx = 16; p.bx = -16; p.head = -.1; break;
      case 'panic': p.lean = .1; p.crouch = 4 + s(t * 18); p.aF0 = 2.6 + s(t * 14) * .4; p.aF1 = .4; p.aB0 = 2.5 - s(t * 14) * .4; p.aB1 = .4; p.eye = 1.6; p.brow = 1; p.mouth = 1.3; p.head = s(t * 12) * .1; break;
      case 'angry': p.lean = .1; p.head = .25; p.aF0 = .35; p.aF1 = 2.5; p.aB0 = -.5; p.aB1 = -.3; p.brow = -1; p.eye = .25; p.mouth = -1; break;
      case 'shrug': { const u = s(clamp(k, 0, 1) * Math.PI); p.aF0 = .3 + .5 * u; p.aF1 = 1.2 * u; p.aB0 = -.3 - .5 * u; p.aB1 = 1.2 * u; p.crouch = -3 * u; p.head = .1 * u; p.mouth = -.5; break }
      case 'tired': p.lean = .55; p.crouch = 12 + s(t * 5) * 2; p.aF0 = .5; p.aF1 = .1; p.aB0 = .45; p.aB1 = .1; p.head = .3; p.mouth = .9; p.eye = .5; p.fx = 18; p.bx = -18; break;
      case 'cheer': { const h = Math.abs(s(t * 8)); p.lift = h * 18; p.fy = h * 8; p.by = h * 10; p.aF0 = 2.75 + s(t * 16) * .2; p.aF1 = .2; p.aB0 = 2.55 - s(t * 16) * .2; p.aB1 = .2; p.mouth = 2; p.brow = .6; break }
      case 'fail': p.lean = .3; p.head = .45; p.aF0 = .2; p.aF1 = .05; p.aB0 = .1; p.aB1 = .05; p.mouth = -1; p.brow = .4; p.eye = .5; p.crouch = 6; break;
      case 'sit': p.crouch = 40; p.lean = -.4; p.fx = 34; p.bx = 28; p.aF0 = .7; p.aF1 = .5; p.aB0 = .5; p.aB1 = .6; p.head = .25; p.eye = .15; p.mouth = .3 + s(t * 2) * .2; break;
      case 'haul': p.crouch = 20 + s(t * 6) * 5; p.lean = .5; p.aF0 = 1.1; p.aF1 = .4; p.aB0 = 1; p.aB1 = .4; p.fx = 22; p.bx = -20; p.brow = -.8; p.mouth = .7; break;
      case 'stumble': p.lean = .5 + s(t * 14) * .1; p.aF0 = 2; p.aB0 = -1.5; p.fx = 24; p.bx = -6; p.eye = 1.4; p.mouth = 1; break;
      case 'point': p.aF0 = 1.55; p.aF1 = 0; p.aB0 = .1; p.lean = .08; p.brow = -.4; p.mouth = .5; break;
      case 'wave': p.aF0 = 2.6 + s(t * 8) * .35; p.aF1 = .3; p.mouth = 1; break;
      default: break;
    }
    return p;
  }
  const STATES = ['idle', 'idleBored', 'walk', 'run', 'stop', 'turn', 'jump', 'fall', 'land', 'reach', 'pickup', 'carry', 'putBag', 'open', 'openFridge', 'disgust', 'scrubFridge', 'phoneUse', 'phone', 'listen', 'nervous', 'inspect', 'inspectLow', 'repair', 'tinker', 'vac', 'mop', 'scrub', 'scrubToilet', 'flush', 'cheer', 'fail', 'panic', 'shrug', 'shock', 'angry', 'tired', 'sit', 'haul', 'door', 'stumble', 'point', 'wave', 'toss'];
  const LOOPING = { idle: 1, idleBored: 1, walk: 1, run: 1, carry: 1, phone: 1, listen: 1, nervous: 1, vac: 1, mop: 1, scrub: 1, scrubFridge: 1, scrubToilet: 1, repair: 1, tinker: 1, cheer: 1, panic: 1, sit: 1, tired: 1, haul: 1 };

  /* ---- head (3/4 view, facing +x) ---- */
  function drawHead(g, L, p, big) {
    const bald = L.bald;
    // ear (far) + neck handled by caller
    blob(g, -11, 2, 3.4, 5, L.skinD);
    // face base: round, wide cheeks, soft jaw
    g.beginPath(); g.moveTo(-13, -4); g.bezierCurveTo(-14, -16, -4, -19, 4, -18.5); g.bezierCurveTo(13, -18, 17, -10, 16.5, -2);
    g.bezierCurveTo(16.8, 6, 14, 12, 7, 15.5); g.bezierCurveTo(1, 17.5, -7, 15.5, -11.5, 9); g.bezierCurveTo(-13.5, 5, -13.5, 0, -13, -4); g.closePath();
    g.fillStyle = L.skin; g.fill();
    g.save(); g.clip();
    g.fillStyle = L.skinD; g.globalAlpha = .55; g.fillRect(-16, -20, 8, 40); g.globalAlpha = 1;         // back shade
    g.fillStyle = L.skinL; g.globalAlpha = .5; g.beginPath(); g.ellipse(8, -8, 6, 5, .3, 0, 7); g.fill(); g.globalAlpha = 1; // forehead/cheek highlight
    g.fillStyle = 'rgba(232,130,110,.28)'; g.beginPath(); g.ellipse(9, 4, 5, 3.4, 0, 0, 7); g.fill();     // flushed cheek
    if (L.beard && L.beard !== 'rgba(0,0,0,0)') { // jaw + chin beard (ring), leaving cheeks and mouth area
      g.fillStyle = L.beard; g.beginPath(); g.moveTo(-13, -1); g.bezierCurveTo(-10, 0, -8, 3, -4, 5); g.bezierCurveTo(1, 5.5, 5, 6.5, 12, 6); g.bezierCurveTo(15, 5.5, 16.5, 3, 17, -1);
      g.lineTo(18, 14); g.lineTo(-14, 16); g.closePath(); g.fill();
      g.fillStyle = 'rgba(70,45,28,.2)'; for (let i = 0; i < 46; i++) { const a = i * 12.9898, x = -11 + ((S_(a) * 43758.5) % 1 + 1) % 1 * 28, y = 5 + ((S_(a * 1.7) * 9731.1) % 1 + 1) % 1 * 11; g.fillRect(x, y, .7, .7); }
      g.fillStyle = L.beard; g.beginPath(); g.ellipse(9.5, 6.4, 5.2, 1.7, .05, 0, 7); g.fill();            // thin moustache
    }
    g.restore();
    g.beginPath(); g.moveTo(-13, -4); g.bezierCurveTo(-14, -16, -4, -19, 4, -18.5); g.bezierCurveTo(13, -18, 17, -10, 16.5, -2);
    g.bezierCurveTo(16.8, 6, 14, 12, 7, 15.5); g.bezierCurveTo(1, 17.5, -7, 15.5, -11.5, 9); g.bezierCurveTo(-13.5, 5, -13.5, 0, -13, -4); ink(g, 1.3);
    // hair
    if (!bald) {
      g.beginPath(); g.moveTo(-15, 2); g.bezierCurveTo(-18, -12, -12, -24, -1, -25); g.bezierCurveTo(8, -27.5, 18, -23, 19, -13);
      g.bezierCurveTo(14, -17, 9, -16.5, 5, -15); g.bezierCurveTo(-1, -14, -6, -13.5, -9, -9); g.bezierCurveTo(-10, -4, -10.5, 0, -13, 3); g.closePath();
      g.fillStyle = L.hair; g.fill(); ink(g, 1.3);
      g.strokeStyle = L.hairD; g.lineWidth = .9; g.beginPath(); g.moveTo(-9, -12); g.quadraticCurveTo(-3, -24, 10, -23); g.moveTo(-5, -14); g.quadraticCurveTo(2, -22, 15, -20); g.moveTo(-12, -6); g.quadraticCurveTo(-11, -20, -2, -24); g.stroke();
      g.strokeStyle = L.hairL; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-1, -19); g.quadraticCurveTo(7, -26, 16, -22); g.stroke();
    } else { // balding with grey sides
      g.beginPath(); g.moveTo(-14, 3); g.bezierCurveTo(-18, -6, -14, -12, -9, -12); g.bezierCurveTo(-10, -4, -10.5, 0, -13, 5); g.closePath(); g.fillStyle = L.hair; g.fill(); ink(g, 1.1);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(2, -15, 6, 2.3, -.1, 0, 7); g.fill();
    }
    // face features
    const ey = -4.2, eo = clamp(p.eye, .08, 1.7), br = p.brow;
    // eyes (near eye bigger: 3/4)
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(6.2, ey, 3.2, 2.6 * eo, 0, 0, 7); g.fill(); ink(g, .9);
    g.beginPath(); g.ellipse(14, ey + .2, 2.4, 2.3 * eo, 0, 0, 7); g.fillStyle = '#fff'; g.fill(); ink(g, .9);
    if (eo > .28) { g.fillStyle = L.eye; g.beginPath(); g.arc(7, ey, 1.8 * Math.min(1, eo), 0, 7); g.fill(); g.beginPath(); g.arc(14.6, ey + .2, 1.5 * Math.min(1, eo), 0, 7); g.fill(); g.fillStyle = '#111'; g.fillRect(6.6, ey - .7, 1, 1.4); g.fillRect(14.2, ey - .5, .9, 1.2); }
    g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(2.8, ey - 2.4 * eo); g.quadraticCurveTo(6.2, ey - 3.4 * eo, 9.5, ey - 2.2 * eo); g.stroke();
    // brows
    g.strokeStyle = L.brow; g.lineWidth = 1.9; g.lineCap = 'round'; const bI = -9.2 - br * 1.2, bO = -9.2 + br * (br < 0 ? -.9 : .6);
    g.beginPath(); g.moveTo(2.2, br < 0 ? bI + 1.6 : bI); g.lineTo(9.8, br < 0 ? bI - .3 : bI - .9); g.moveTo(11.8, br < 0 ? bI - .2 : bO - .5); g.lineTo(17.2, br < 0 ? bI + .6 : bO + .6); g.stroke();
    // nose
    g.strokeStyle = L.skinD; g.lineWidth = 1.4; g.beginPath(); g.moveTo(11.5, -3); g.quadraticCurveTo(15.5, 2.5, 12.2, 3.8); g.stroke();
    g.fillStyle = L.skinL; g.beginPath(); g.ellipse(13.6, 3, 2, 1.5, .2, 0, 7); g.fill();
    if (L.stache) { g.fillStyle = L.hairD; g.beginPath(); g.ellipse(10, 6.6, 7, 2.5, .05, 0, 7); g.fill(); ink(g, .8); }
    // mouth
    const my = 10.2; g.strokeStyle = '#7a3f35'; g.lineWidth = 1.2;
    g.beginPath();
    if (p.mouth > 1.5) { g.moveTo(4, my - 1); g.quadraticCurveTo(10, my + 6, 16, my - 1); g.closePath(); g.fillStyle = '#5a2a26'; g.fill(); g.stroke(); }
    else if (p.mouth > .4) { g.ellipse(10, my + 1, 3.6, 3.6 * Math.min(1, p.mouth), 0, 0, 7); g.fillStyle = '#5a2a26'; g.fill(); g.stroke(); }
    else if (p.mouth < -.4) { g.moveTo(5, my + 2); g.quadraticCurveTo(10, my - 2.4, 15.5, my + 2); g.stroke(); }
    else { g.moveTo(6, my); g.quadraticCurveTo(10.5, my + .8, 15, my - .2); g.stroke(); }
    if (L.hood) { g.strokeStyle = L.topD; g.lineWidth = 3; g.beginPath(); g.moveTo(-13, 8); g.quadraticCurveTo(-4, 18, 8, 20); g.stroke(); }
  }

  /* ---- held items ---- */
  function drawHeld(g, held, hx, hy, p, t) {
    g.save(); g.translate(hx, hy);
    switch (held) {
      case 'bag': { g.beginPath(); g.moveTo(-3, 4); g.bezierCurveTo(-18, 24, -16, 50, -6, 58); g.bezierCurveTo(6, 64, 20, 56, 20, 42); g.bezierCurveTo(20, 26, 6, 14, 3, 4); g.closePath(); g.fillStyle = '#23232b'; g.fill(); ink(g, 1.2);
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-8, 24); g.quadraticCurveTo(-12, 40, -6, 52); g.stroke(); g.fillStyle = '#d9a93a'; g.fillRect(-3, 0, 6, 5); break }
      case 'clothes': blob(g, 0, 10, 14, 9, '#35506b'); blob(g, 6, 14, 9, 6, '#d9d2c0'); break;
      case 'phone': g.rotate(-.3); g.fillStyle = '#17171c'; g.beginPath(); g.roundRect(-3, -9, 6, 13, 1.5); g.fill(); ink(g, .8); g.fillStyle = '#6a8fb8'; g.fillRect(-2, -7.5, 4, 8); break;
      case 'wrench': g.rotate(p.aF0 + p.aF1 - 1.3 + S_(t * 12) * .3); g.fillStyle = '#b9bec4'; g.fillRect(-1.6, -30, 3.2, 32); g.strokeStyle = '#b9bec4'; g.lineWidth = 3.2; g.beginPath(); g.arc(0, -34, 5, .9, 5.4); g.stroke(); break;
      case 'cloth': blob(g, 0, 2, 9, 6.5, '#d9a93a'); break;
      case 'brush': g.rotate(.4); limb(g, 0, 0, 0, -26, 2.6, '#3b6fa0', 1.4); blob(g, 0, -29, 4, 3, '#e8e2d0'); break;
      case 'spool': blob(g, 0, 0, 10, 10, '#2c9a52'); blob(g, 0, 0, 3.6, 3.6, '#1a1a20'); break;
      case 'tube': g.strokeStyle = '#e8e8ea'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, 9, 0, 5.4); g.stroke(); break;
      case 'beer': g.fillStyle = '#c9a23a'; g.beginPath(); g.roundRect(-3.2, -14, 6.4, 18, 2); g.fill(); ink(g, .9); g.fillStyle = '#f3efe0'; g.fillRect(-3, -9, 6, 5); break;
      case 'box': g.fillStyle = '#c2512f'; g.beginPath(); g.roundRect(-20, 6, 40, 26, 3); g.fill(); ink(g, 1.2); g.fillStyle = '#8a2f1c'; g.fillRect(-20, 16, 40, 4); g.strokeStyle = '#2a2a30'; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, 6); g.lineTo(-8, -1); g.lineTo(8, -1); g.lineTo(10, 6); g.stroke(); break;
      case 'folder': g.fillStyle = '#6b4f2a'; g.beginPath(); g.roundRect(-8, -2, 22, 28, 2); g.fill(); ink(g, 1); break;
    }
    g.restore();
  }
  function drawTool(g, held, p, hx, hy) { // long tools behind the body
    const tx = p.tool;
    if (held === 'mop') { limb(g, hx - 14, hy - 46, tx, -6, 3.6, '#b58a52', 1.4); g.save(); g.fillStyle = '#4a6f8a'; g.beginPath(); g.roundRect(tx - 22, -12, 44, 12, 3); g.fill(); ink(g, 1.2); g.strokeStyle = '#9fc0d8'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(tx - 20 + i * 5, -2); g.lineTo(tx - 21 + i * 5.2, 5); g.stroke(); } g.restore(); }
    else if (held === 'vac') { limb(g, hx - 10, hy - 30, tx, -10, 4.4, '#55555e', 1.4); g.beginPath(); g.roundRect(tx - 18, -12, 40, 11, 3); g.fillStyle = '#c2512f'; g.fill(); ink(g, 1.2);
      g.strokeStyle = '#30303a'; g.lineWidth = 4; g.beginPath(); g.moveTo(hx - 10, hy - 30); g.quadraticCurveTo(-60, -90, -66, -30); g.stroke();
      g.beginPath(); g.roundRect(-96, -40, 60, 36, 12); g.fillStyle = '#c2512f'; g.fill(); ink(g, 1.3); g.fillStyle = '#30303a'; g.fillRect(-88, -28, 40, 6); blob(g, -84, -4, 8, 8, '#22222a'); blob(g, -50, -4, 8, 8, '#22222a'); }
  }


  /* ---- realistic painted sprite set for Bamboul (from the user's reference renders; see tools/process_sprites.py) ---- */
  const HS = { px: 1.9, ready: false, img: {}, names: ['idle', 'closeup', 'run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5', 'run_6'] };
  (function loadHeroSprites() {
    if (typeof Image === 'undefined') return; let left = HS.names.length;
    HS.names.forEach(n => { const im = new Image(); im.onload = () => { if (--left === 0) { HS.ready = !!(HS.img.idle && HS.img.idle.width); if (BB.char) BB.char.spritesReady = HS.ready; } }; im.onerror = () => { left--; }; im.src = 'assets/char/hero_' + n + '.png'; HS.img[n] = im; });
  })();

  /* ---- full cartoon animation set (from the second prototype; assets/char/toon, 240x288, feet at (120,280)) ---- */
  const TOON = { ready: false, img: {}, PX: 1.528, cx: 120, fy: 280, counts: { idle: 4, walk: 8, run: 8, carry: 4, mop: 4, tool: 3, pickup: 2, throw: 2, panic: 4, victory: 2, jump: 3, pant: 1, skid: 1 } };
  (function loadToon() {
    if (typeof Image === 'undefined') return; const all = []; for (const k in TOON.counts) for (let i = 0; i < TOON.counts[k]; i++) all.push(k + '_' + i);
    let left = all.length; all.forEach(n => { const im = new Image(); im.onload = () => { if (--left === 0) TOON.ready = true; }; im.onerror = () => { left--; if (!left) TOON.ready = !!TOON.img.idle_0; }; im.src = 'assets/char/toon/' + n + '.png'; TOON.img[n] = im; });
  })();
  function toonPick(inst) {
    const st = inst.state, t = inst.t, held = inst.held, ph = (((inst.phase / (2 * Math.PI)) % 1) + 1) % 1, a = clamp(inst.actT || 0, 0, .999), moving = inst.ctl && inst.ctl.speed > 14;
    const loop = (n, c, fps) => n + '_' + (Math.floor(t * fps) % c);
    if (held === 'mop' && st !== 'mop') return moving ? 'mop_' + Math.floor(ph * 4) % 4 : 'mop_0';
    switch (st) {
      case 'walk': return 'walk_' + Math.floor(ph * 8) % 8;
      case 'run': return 'run_' + Math.floor(ph * 8) % 8;
      case 'carry': return 'carry_' + Math.floor(ph * 4) % 4;
      case 'jump': return inst.ctl && inst.ctl.vy > 120 ? 'jump_0' : 'jump_1';
      case 'fall': return 'jump_2';
      case 'land': return 'pant_0';
      case 'stop': return 'skid_0';
      case 'mop': return loop('mop', 4, 8);
      case 'repair': case 'tinker': case 'scrub': case 'scrubFridge': case 'scrubToilet': case 'inspectLow': case 'flush': return loop('tool', 3, 7);
      case 'pickup': return 'pickup_' + (a < .5 ? 0 : 1);
      case 'putBag': case 'toss': return 'throw_' + (a < .45 ? 0 : 1);
      case 'panic': case 'shock': case 'nervous': case 'disgust': case 'angry': case 'fail': case 'stumble': return loop('panic', 4, 9);
      case 'cheer': return loop('victory', 2, 5);
      case 'tired': case 'sit': return 'pant_0';
      case 'open': case 'openFridge': case 'reach': case 'door': case 'haul': return 'pickup_0';
      default: return held === 'bag' ? loop('carry', 4, 3) : loop('idle', 4, 3.5);
    }
  }
  function drawToon(inst, g) {
    const p = inst.pose, st = inst.state, held = inst.held, t = inst.t, k = 1 / TOON.PX, name = toonPick(inst), im = TOON.img[name] || TOON.img.idle_0;
    g.save(); const fc = Math.abs(inst.face) < .12 ? .12 * Math.sign(inst.face || 1) : inst.face; g.scale(fc, 1);
    const w = im.width * k, h = im.height * k, ox = -TOON.cx * k, oy = -TOON.fy * k;
    let sq = 1, lean = 0, lift = 0;
    if (st === 'sit') { sq = .8; lean = -.35; } else if (st === 'tired') { lean = .12; } else if (st === 'idle' || st === 'idleBored') sq = 1 + S_(t * 2.2) * .006;
    if (st === 'sit') g.translate(-6, 0);
    g.translate(0, -92); g.rotate(lean); g.scale(1 / sq, sq); g.translate(0, 92);
    g.drawImage(im, ox, oy, w, h);
    // props that are not baked into the frames
    const hasBag = name.indexOf('carry') === 0, hasMop = name.indexOf('mop') === 0;
    if (held === 'vac') drawTool(g, 'vac', p, 26, -84);
    else if (held && held !== 'bag' && held !== 'mop' && held !== 'clothes') { const hp = handPos(st, p); drawHeld(g, held, hp[0], hp[1], p, t); }
    else if (held === 'clothes') drawHeld(g, 'clothes', 24, -80, p, t);
    else if (held === 'bag' && !hasBag && (st === 'pickup' || st === 'toss' || st === 'putBag')) drawHeld(g, 'bag', 26, -82, p, t);
    g.restore();
  }

  /* ---- cut-out puppet built from the idle sprite: head + torso + two articulated arms (shoulder/elbow) ---- */
  const PUP = { built: false, part: {}, SH: { A: [24, 74], B: [102, 72] }, EL: { A: [20, 130], B: [112, 130] }, HD: { A: [24, 196], B: [115, 192] }, NECK: [64, 62] };
  const POLY = {
    uA: [[0, 64], [30, 56], [38, 70], [38, 100], [34, 132], [6, 138], [0, 100]], fA: [[2, 126], [34, 124], [34, 150], [30, 178], [30, 208], [4, 212], [2, 170]],
    uB: [[96, 64], [128, 66], [132, 100], [124, 134], [100, 134], [96, 100]], fB: [[104, 124], [132, 126], [132, 208], [109, 204], [109, 150], [104, 140]],
    head: [[0, 0], [132, 0], [132, 61], [0, 61]]
  };
  function clipCopy(im, poly) { const c = BB.mk(im.width, im.height), g = c.getContext('2d'); g.beginPath(); poly.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.save(); g.clip(); g.drawImage(im, 0, 0); g.restore(); return c; }
  function buildPuppet(im) {
    const W = im.width, H = im.height, part = {};
    for (const k of ['uA', 'fA', 'uB', 'fB']) part[k] = clipCopy(im, POLY[k]);
    part.head = clipCopy(im, POLY.head);
    const base = BB.mk(W, H), g = base.getContext('2d'); g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (const k of ['uA', 'fA', 'uB', 'fB']) { g.beginPath(); POLY[k].forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    const patch = (sx, dx, w, y0, y1) => { g.save(); g.beginPath(); g.rect(dx, y0, w, y1 - y0); g.clip(); g.translate(dx + w, 0); g.scale(-1, 1); g.drawImage(im, sx, 0, w, H, 0, 0, w, H); g.restore(); };
    patch(36, 26, 12, 68, 182); patch(84, 94, 12, 68, 182);
    part.base = base; PUP.part = part; PUP.built = true;
  }
  function rotAround(g, px, py, a) { g.translate(px, py); g.rotate(a); g.translate(-px, -py); }
  function fk(side, a, e) { const sh = PUP.SH[side], el = PUP.EL[side], hd = PUP.HD[side], c = Math.cos(a), s = Math.sin(a); const ex = sh[0] + (el[0] - sh[0]) * c - (el[1] - sh[1]) * s, ey = sh[1] + (el[0] - sh[0]) * s + (el[1] - sh[1]) * c, t = a + e, ct = Math.cos(t), st = Math.sin(t); return [ex + (hd[0] - el[0]) * ct - (hd[1] - el[1]) * st, ey + (hd[0] - el[0]) * st + (hd[1] - el[1]) * ct]; }
  function armTargets(st, t, a, held) {
    const so = Math.sin(t * 1.7) * .03, r = { aA: .05 + so, eA: 0, aB: -.05 - so, eB: 0, head: 0 };
    const set = (A, B, h) => { if (A) { r.aA = A[0]; r.eA = A[1]; } if (B) { r.aB = B[0]; r.eB = B[1]; } if (h != null) r.head = h; };
    const u = Math.sin(clamp(a, 0, 1) * Math.PI);
    switch (st) {
      case 'idle': case 'idleBored': if (held === 'bag') set(null, [-.3, -.12]); r.head = st === 'idleBored' ? Math.sin(t * 1.3) * .14 : Math.sin(t * .6) * .03; break;
      case 'pickup': set([-.5 * u - .1, -.3], [-.6 * u - .2, -.3], .1 * u); break;
      case 'putBag': case 'toss': { const q = clamp(a, 0, 1); set(null, [q < .4 ? .6 : -2.1, q < .4 ? -.2 : -.3], 0); break; }
      case 'open': case 'openFridge': case 'reach': case 'door': case 'haul': set([.12, 0], [-1.45, -.1], st === 'openFridge' ? -.08 : 0); break;
      case 'disgust': set([-.6, -2.2], [-.8, -2.5], -.2); break;
      case 'scrub': case 'scrubFridge': set([-.6, -.8], [-1.25 + Math.sin(t * 11) * .3, -.5], .06); break;
      case 'scrubToilet': set([-.6, -.8], [-1.1 + Math.sin(t * 10) * .35, -.6], .1); break;
      case 'mop': set([-.8, -.5], [-.85 + Math.sin(t * 7) * .12, -.5], .05); break;
      case 'vac': set([-.9, -.4], [-.9 + Math.sin(t * 4) * .1, -.4]); break;
      case 'phoneUse': set([.12, 0], [-.5 - a * .1, -2.6 * clamp(a * 1.4, 0, 1)], -.05); break;
      case 'phone': set([.12, 0], [-.5, -2.55], -.08 + Math.sin(t * 3) * .02); break;
      case 'listen': set([.4, -1.0], [-.5, -2.55], -.14); break;
      case 'nervous': set([-.3 + Math.sin(t * 9) * .08, -.9], [-.5, -2.55], .05); break;
      case 'inspect': set([.1, 0], [-.55, -2.0], .12); break;
      case 'inspectLow': set([-.5, -.5], [-1.0, -.4], -.12); break;
      case 'repair': case 'tinker': case 'flush': set([-1.0, -.7], [-1.1 + Math.sin(t * 9) * .18, -.7 + Math.cos(t * 9) * .15], -.1); break;
      case 'cheer': set([-2.7 + Math.sin(t * 16) * .2, -.2], [-2.55 - Math.sin(t * 16) * .2, -.2], Math.sin(t * 8) * .06); break;
      case 'panic': case 'shock': set([-2.2 + Math.sin(t * 20) * .12, -.8], [-2.3 - Math.sin(t * 20) * .12, -.8], Math.sin(t * 22) * (st === 'panic' ? .1 : .02)); break;
      case 'angry': set([-.35, -1.5], [-.35, -1.5], .1); break;
      case 'shrug': set([-.55 * u, -1.3 * u], [-.55 * u, -1.3 * u], .1 * u); break;
      case 'fail': case 'tired': set([.18, .12], [.18, .12], .28); break;
      case 'point': set([.1, 0], [-1.5, 0]); break;
      case 'wave': set(null, [-2.6, Math.sin(t * 8) * .5]); break;
      case 'stumble': set([-1.4, -.2], [-1.6, -.2]); break;
      default: break;
    }
    return r;
  }
  function drawPuppet(inst, g, k, held) {
    const P_ = PUP.part, im = HS.img.idle, w = im.width, h = im.height, A = inst.arm;
    g.save(); g.translate(-w * k / 2, -h * k); g.scale(k, k);
    g.drawImage(P_.base, 0, 0);
    g.save(); rotAround(g, PUP.NECK[0], PUP.NECK[1], A.head); g.drawImage(P_.head, 0, 0); g.restore();
    for (const side of ['A', 'B']) {
      const a = side === 'A' ? A.aA : A.aB, e = side === 'A' ? A.eA : A.eB, sh = PUP.SH[side], el = PUP.EL[side];
      g.save(); rotAround(g, sh[0], sh[1], a); g.drawImage(P_['u' + side], 0, 0);
      rotAround(g, el[0], el[1], e); g.drawImage(P_['f' + side], 0, 0); g.restore();
    }
    g.restore();
    const hand = fk('B', A.aB, A.eB); return [(hand[0] - w / 2) * k, (hand[1] - h) * k];
  }

  /* rim light: thin bright edge on the side facing the nearest lamp (baked once per sprite image) */
  const RIMS = new WeakMap();
  function rimOf(im, side) {
    let r = RIMS.get(im); if (!r) { r = {}; RIMS.set(im, r); } if (r[side]) return r[side];
    const W = im.width, H = im.height, c = BB.mk(W, H), g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffe9c4'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out'; g.drawImage(im, -side * 2.2, 0); g.drawImage(im, -side * 1.1, side * 0);
    const o = BB.mk(W, H), og = o.getContext('2d'); if ('filter' in og) og.filter = 'blur(.7px)'; og.drawImage(c, 0, 0); return r[side] = o;
  }
  function drawRim(g, im, dx, dy, w, h, fc) {
    const info = BB.lightInfoAt && BB.lightInfoAt(BB.P ? BB.P.x : 0); if (!info || info.i < .12) return;
    const side = info.side * (fc < 0 ? -1 : 1);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(info.i * .5, 0, .45); g.drawImage(rimOf(im, side), dx, dy, w, h); g.restore();
  }
  function handPos(st, p) {
    if (st === 'phone' || st === 'phoneUse' || st === 'listen' || st === 'nervous') return [13, -150];
    if (st === 'mop' || st === 'vac') return [26, -88 + S_(p.tool * .05) * 2];
    if (st === 'scrub' || st === 'scrubFridge' || st === 'scrubToilet' || st === 'repair' || st === 'tinker' || st === 'inspectLow') return [30, -78];
    return [22, -86];
  }
  function drawHeroSprite(inst, g) {
    const p = inst.pose, st = inst.state, held = inst.held, t = inst.t, k = 1 / HS.px, I = HS.img;
    const cyc = st === 'walk' || st === 'run' || st === 'carry';
    g.save(); const fc = Math.abs(inst.face) < .12 ? .12 * Math.sign(inst.face || 1) : inst.face; g.scale(fc, 1);
    const draw = (im, ox, oy, sc) => { const w = im.width * k * (sc || 1), h = im.height * k * (sc || 1); g.drawImage(im, -w / 2 + (ox || 0), -h + (oy || 0), w, h); };
    if (st === 'sit') {                                   // sprawled on the sofa: torso thrown back, legs stretched out forward
      const im = I.idle, w = im.width * k, h = im.height * k, hipY = h * .5, br = S_(t * 1.6) * .012, hip = 38;
      g.translate(-4, (h - hipY) - hip);
      const part = (y0, y1, ang, px, py) => { g.save(); g.translate(px, py); g.rotate(ang); g.translate(-px, -py); g.beginPath(); g.rect(-w, -h + y0, w * 2, y1 - y0); g.clip(); g.drawImage(im, -w / 2, -h, w, h); g.restore(); };
      const hy = -h + hipY + 2;                          // hip height in sprite space
      part(hipY - 2, h + 4, -1.2 + br, 0, hy);          // legs: swung forward (feet end up on the right)
      part(-2, hipY + 2, -.78 + br * 2 + S_(t * .7) * .02, 0, hy);   // torso: reclined back
      if (held) drawHeld(g, held, 18, -86, p, t);
      g.restore(); return;
    }
    if (BB.rig && BB.rig.ready && inst.rigI && inst.rigI.out) {   // physical skeleton
      const shake = st === 'panic' ? S_(t * 40) * 1.2 : 0; g.translate(shake, 0);
      const hp = inst.rigI.draw(g, held, drawHeld, p, t) || [22, -86];
      if (held === 'mop' || held === 'vac') drawTool(g, held, p, hp[0], hp[1]);
      else if (held && held !== 'bag' && held !== 'clothes') drawHeld(g, held, hp[0], hp[1], p, t);
      g.restore(); return;
    }
    if ((cyc || st === 'jump' || st === 'fall' || st === 'stumble')) {
      let idx = 0, sc = 1.2;
      if (cyc) idx = Math.floor((((inst.phase / (2 * Math.PI)) % 1) + 1) % 1 * 5) % 5; else { idx = st === 'jump' ? 4 : 3; sc = 1.15; }
      const im = I['run_' + idx], bob = cyc ? Math.abs(S_(inst.phase)) * 3 : 0;
      draw(im, 0, (st === 'jump' || st === 'fall' ? -4 : 0) - bob, sc); { const ww = im.width * k * sc, hh = im.height * k * sc; drawRim(g, im, -ww / 2, -hh + ((st === 'jump' || st === 'fall' ? -4 : 0) - bob), ww, hh, fc); }
      if (held === 'bag' || held === 'clothes') drawHeld(g, held, 34, -100 + (idx % 2) * 3, p, t);
    } else {
      // standing sprite deformed by the pose parameters (lean, crouch, bounce, breathing, weight shift)
      const im = I.idle, crouch = clamp(p.crouch, -6, 44), hip = -92, idleish = st === 'idle' || st === 'idleBored';
      const breathe = idleish ? S_(t * 2) * .006 : 0, sy = (1 - crouch / 215) * (1 + breathe), sx = 1 + crouch / 520 - breathe * .5;
      const lean = clamp(p.lean, -.5, .75) * .85 + (idleish ? S_(t * .9) * .014 : 0), shake = (st === 'panic' ? S_(t * 40) * 1.2 : 0), hop = p.lift || 0;
      g.translate(shake + (idleish ? S_(t * .9) * .8 : 0), -hop); g.translate(0, hip); g.rotate(lean); g.scale(sx, sy); g.translate(0, -hip);
      if (!PUP.built && im.width) buildPuppet(im);
      let hp;
      if (PUP.built && inst.arm) hp = drawPuppet(inst, g, k, held); else { draw(im, 0, 0); hp = handPos(st, p); }
      if (held === 'mop' || held === 'vac') drawTool(g, held, p, hp[0], hp[1]);
      else if (held) drawHeld(g, held, hp[0], hp[1], p, t);
    }
    g.restore();
  }

  /* ---- the rig ---- */
  function createRig(kind) {
    const L = LOOKS[kind], sc = L.h / 178;
    const inst = { kind, L, pose: Object.assign({}, BASE), state: 'idle', held: null, face: 1, t: 0, phase: 0, actT: 0, width: 55 * L.width * sc, height: L.h };
    inst.update = function (dt, ctl) {
      ctl = ctl || {}; inst.t = ctl.t != null ? ctl.t : inst.t + dt; inst.state = ctl.state || inst.state; inst.phase = ctl.phase != null ? ctl.phase : inst.phase;
      inst.face = ctl.face != null ? ctl.face : inst.face; inst.held = ctl.held !== undefined ? ctl.held : inst.held; inst.actT = ctl.actT || 0; inst.ctl = ctl;
      const cyc = inst.state === 'walk' || inst.state === 'run' || inst.state === 'carry';
      { const at = armTargets(inst.state, inst.t, inst.actT, inst.held); inst.arm = inst.arm || Object.assign({}, at); const ka = 1 - Math.exp(-dt * 16); for (const q in at) inst.arm[q] = lerp(inst.arm[q], at[q], ka); }
      const tg = poseFor(inst.state, inst.t, inst.phase, inst.actT, ctl);
      const a = 1 - Math.exp(-dt * (cyc ? 40 : 15)); for (const k in tg) inst.pose[k] = inst.pose[k] === undefined ? tg[k] : lerp(inst.pose[k], tg[k], k === 'eye' ? Math.min(1, a * 3) : a);
      if (kind === 'bamboul' && BB.rig && BB.rig.ready) {          // physical skeleton (js/rig.js): drives every state except the sofa sprawl
        inst.rigI = inst.rigI || BB.rig.create();
        inst.rigI.update(dt, { phase: inst.phase, t: inst.t, vy: ctl.vy }, inst.state, inst.held, inst.pose, inst.arm);
      }
    };
    inst.draw = function (g, t) {
      if (kind === 'bamboul' && TOON.ready && (BB.CFG && BB.CFG.realHero === false)) return drawToon(inst, g);
      if (kind === 'bamboul' && HS.ready) return drawHeroSprite(inst, g);
      const p = inst.pose, held = inst.held, st = inst.state;
      g.save(); g.scale(sc, sc);
      const fc = Math.abs(inst.face) < .12 ? .12 * Math.sign(inst.face || 1) : inst.face;
      g.scale(fc, 1);
      const HIP = -92, hipY = HIP + p.crouch - p.lift;
      const sin = S_(p.lean), cos = C_(p.lean), tp = (x, y) => [x * cos - y * sin, hipY + x * sin + y * cos];
      const arm = (sx, sy, a0, a1) => { const ex = sx + S_(a0) * 30, ey = sy + C_(a0) * 30, hx = ex + S_(a0 + a1) * 28, hy = ey + C_(a0 + a1) * 28; return [sx, sy, ex, ey, hx, hy]; };
      const sB = tp(-4, -50), sF = tp(7, -50);
      const aB = arm(sB[0], sB[1], p.aB0, p.aB1), aF = arm(sF[0], sF[1], p.aF0, p.aF1);
      const top = L.top === 'pattern' ? pattern(g) : L.top;
      const drawArm = (a, back) => {
        const sk = back ? L.skinD : L.skin;
        if (L.shorts) { // short sleeve: bare forearm
          limb(g, a[2], a[3], a[4], a[5], 9.5, sk); const mx = lerp(a[0], a[2], .55), my = lerp(a[1], a[3], .55);
          limb(g, a[0], a[1], mx, my, 17, back ? '#a8915a' : top);
          limb(g, mx, my, a[2], a[3], 11, sk);
        } else { limb(g, a[0], a[1], a[2], a[3], 13, back ? L.topD : L.top); limb(g, a[2], a[3], a[4], a[5], 11, back ? L.topD : L.top); }
        blob(g, a[4], a[5], 5.8, 6, sk);
      };
      const drawLeg = (fx, fy, back) => {
        const hx = back ? -6 : 7, kn = ik(hx, hipY, fx, -fy - 5, 44, 44), sk = back ? L.skinD : L.skin, pc = back ? L.pantsD : L.pants;
        if (L.shorts) { limb(g, kn[0], kn[1], kn[2], kn[3], 13, sk); blob(g, kn[0], kn[1], 7.2, 7.2, sk); limb(g, hx, hipY, lerp(hx, kn[0], .78), lerp(hipY, kn[1], .78), 25, pc); }
        else { limb(g, hx, hipY, kn[0], kn[1], 23, pc); limb(g, kn[0], kn[1], kn[2], kn[3], 19, pc); }
        const fxw = kn[2], fyw = kn[3];
        g.beginPath(); g.moveTo(fxw - 8, fyw - 5); g.lineTo(fxw + 5, fyw - 7); g.quadraticCurveTo(fxw + 14, fyw - 5, fxw + 19, fyw + 3); g.lineTo(fxw + 19, fyw + 6); g.lineTo(fxw - 9, fyw + 6); g.closePath();
        g.fillStyle = back ? L.shoeD : L.shoe; g.fill(); ink(g, 1.2); g.fillStyle = L.sole; g.fillRect(fxw - 9, fyw + 3.2, 28, 3); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(fxw - 8, fyw - 1, 26, 1.2);
      };
      // shadowed back limbs first; long tools behind
      if (held === 'mop' || held === 'vac') drawTool(g, held, p, (aF[4] + aB[4]) / 2, (aF[5] + aB[5]) / 2);
      drawArm(aB, true); drawLeg(p.bx, p.by, true); drawLeg(p.fx, p.fy, false);
      // torso
      g.save(); g.translate(0, hipY); g.rotate(p.lean);
      const b = L.belly, w = L.width, sway = S_(inst.t * 2) * .4;
      // pelvis / shorts / trousers
      g.beginPath(); g.roundRect(-24 * w, -20, 48 * w, 30, 11); g.fillStyle = L.pants; g.fill(); ink(g, 1.3);
      // torso (tee base)
      const tors = () => { g.beginPath(); g.moveTo(-22 * w, -6); g.bezierCurveTo(-28 * w, -34, -23 * w, -62, -14 * w, -74); g.bezierCurveTo(-2, -82, 12 * w, -80, 19 * w, -72); g.bezierCurveTo((27 + 9 * b) * w, -46, (25 + 11 * b) * w, -14, (14 + 3 * b) * w, -2); g.bezierCurveTo(4, 4, -12, 3, -22 * w, -6); g.closePath(); };
      tors(); g.fillStyle = L.tee; g.fill();
      g.save(); tors(); g.clip();
      // open shirt / jacket: back panel + front panels leaving a tee strip
      g.fillStyle = L.top === 'pattern' ? pattern(g) : L.top; g.fillRect(-34, -90, 38, 100);
      g.fillStyle = L.top === 'pattern' ? pattern(g) : L.top;
      g.beginPath(); g.moveTo(16 * w, -80); g.lineTo(60, -80); g.lineTo(60, 10); g.lineTo((18 + 4 * b) * w, 10); g.quadraticCurveTo((14 + 2 * b) * w, -30, 16 * w, -80); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(-34, -90, 38, 100); // back shade
      g.fillStyle = L.tee; g.fillRect(4, -80, 12 * w, 90);
      g.fillStyle = L.teeD; g.globalAlpha = .55; g.beginPath(); g.ellipse(10, -30 + sway, 6, 22, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      if (L.jacket) { g.fillStyle = L.tie; g.beginPath(); g.moveTo(7, -76); g.lineTo(13, -76); g.lineTo(14, -34); g.lineTo(10, -28); g.lineTo(6, -34); g.closePath(); g.fill(); }
      g.fillStyle = L.top === 'pattern' ? 'rgba(40,36,60,.5)' : 'rgba(0,0,0,.35)'; g.fillRect(14 * w, -78, 1.4, 86); // placket line
      // rim light along belly
      g.strokeStyle = 'rgba(255,240,210,.22)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo((26 + 8 * b) * w, -52); g.quadraticCurveTo((27 + 11 * b) * w, -30, (15 + 3 * b) * w, -4); g.stroke();
      g.restore(); tors(); ink(g, 1.4);
      // collar flaps + belt
      if (L.top === 'pattern') { g.beginPath(); g.moveTo(4, -80); g.lineTo(14, -74); g.lineTo(8, -64); g.closePath(); g.fillStyle = '#b9a268'; g.fill(); ink(g, 1); g.beginPath(); g.moveTo(22 * w, -76); g.lineTo(13, -72); g.lineTo(21 * w, -62); g.closePath(); g.fillStyle = '#d8c690'; g.fill(); ink(g, 1); for (let i = 0; i < 4; i++) blob(g, 16 * w, -56 + i * 14, 1.3, 1.3, '#f3ecd8'); }
      g.fillStyle = L.belt; g.fillRect(-22 * w, -8, (40 + 8 * b) * w, 5.5); g.fillStyle = '#c9a94a'; g.fillRect(14 * w, -8, 6, 5.5);
      // neck + head
      g.beginPath(); g.roundRect(-4, -88, 15, 16, 4); g.fillStyle = L.skinD; g.fill(); ink(g, 1.2);
      g.translate(6 * w, -98); g.rotate(p.head); drawHead(g, L, p); g.restore();
      // front hand items and arm
      drawArm(aF, false);
      if (held && held !== 'mop' && held !== 'vac') drawHeld(g, held, aF[4], aF[5], p, inst.t);
      g.restore();
    };
    return inst;
  }

  /* ---- portraits ---- */
  const portraitCache = {};
  let photoImg = null, photoReady = false;
  function loadPhoto() { if (photoImg) return; photoImg = new Image(); photoImg.onload = () => { photoReady = true; for (const k in portraitCache) if (k.indexOf('bamboul') === 0) paintPhotoPortrait(portraitCache[k], k.split(':')[1]); }; photoImg.onerror = () => {}; photoImg.src = 'assets/source/hero_photo.png'; }
  function paintRigPortrait(c, kind, mood) {
    const g = c.getContext('2d'), L = LOOKS[kind], W = c.width, p = Object.assign({}, BASE);
    const m = { angry: { brow: -1, eye: .5, mouth: -1 }, shock: { brow: 1, eye: 1.6, mouth: 1 }, smug: { brow: -.3, eye: .6, mouth: -.5 }, neutral: {} }[mood] || {};
    Object.assign(p, m);
    g.fillStyle = kind === 'landlord' ? '#5a2a22' : kind === 'dan' ? '#25324d' : '#4a3f2b'; g.fillRect(0, 0, W, W);
    g.save(); g.translate(W * .42, W * .52); const s = W / 50; g.scale(s, s); drawHead(g, L, p, true); g.restore();
  }
  function paintPhotoPortrait(c, mood) {
    if (!photoReady) return; const g = c.getContext('2d'), W = c.width;
    const t = BB.mk(W, W), tg = t.getContext('2d'); tg.drawImage(photoImg, 130, 160, 270, 300, 0, 0, W, W);
    try {
      const d = tg.getImageData(0, 0, W, W), a = d.data, lv = 6, tint = { angry: [1.12, .9, .9], shock: [1.05, 1.05, 1.1], smug: [1.05, 1, .92] }[mood] || [1, 1, 1];
      for (let i = 0; i < a.length; i += 4) for (let j = 0; j < 3; j++) { let v = a[i + j] / 255; v = (v - .5) * 1.18 + .52; v = clamp(v * tint[j], 0, 1); a[i + j] = Math.round(Math.round(v * lv) / lv * 255); }
      tg.putImageData(d, 0, 0);
    } catch (e) { /* tainted canvas on file:// - keep rig portrait */ return; }
    g.drawImage(t, 0, 0);
    const gr = g.createRadialGradient(W / 2, W / 2, W * .3, W / 2, W / 2, W * .75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,12,6,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, W);
  }

  BB.char = {
    LOOKS, STATES: STATES.map(id => ({ id, label: id, loop: !!LOOPING[id] })), poseFor,
    create: kind => createRig(kind || 'bamboul'),
    portrait(kind, mood) {
      kind = LOOKS[kind] ? kind : 'bamboul'; mood = mood || 'neutral'; const key = kind + ':' + mood;
      if (portraitCache[key]) return portraitCache[key];
      const c = BB.mk(160, 160); portraitCache[key] = c; paintRigPortrait(c, kind, mood);
      const useImg = kind !== 'bamboul' || /shock|panic|angry|scared/.test(mood);
      if (useImg && typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { const g = c.getContext('2d'); g.clearRect(0, 0, 160, 160); g.drawImage(im, 0, 0, 160, 160); }; im.src = 'assets/portraits/' + kind + '.jpg'; if (kind !== 'bamboul') return c; }
      if (kind === 'bamboul') { const im = HS.img.closeup; const paint = () => { const g = c.getContext('2d'); g.fillStyle = '#4a3f2b'; g.fillRect(0, 0, 160, 160); g.drawImage(im, 0, 0, 128, 128, 10, 14, 140, 140); const tn = { angry: 'rgba(200,40,30,.28)', shock: 'rgba(255,255,255,.18)', smug: 'rgba(240,190,60,.16)' }[mood]; if (tn) { g.fillStyle = tn; g.fillRect(0, 0, 160, 160); } }; if (im && im.complete && im.width) paint(); else if (im) im.addEventListener('load', paint); }
      return c;
    },
    createNpcs() {
      BB.npc = BB.npc || {};
      for (const kind of ['landlord', 'dan']) {
        const inst = createRig(kind), n = { id: kind, kind, x: 0, y: 0, z: 0, dir: 1, face: 1, hidden: true, state: 'idle', held: kind === 'landlord' ? 'folder' : null, inst, ph: 0, shadowW: 36, reflect: .4, height: LOOKS[kind].h, zBias: -.01 };
        n.draw = (g, t, k) => inst.draw(g, t, k);
        BB.npc[kind] = n; BB.actors.push(n);
      }
      let last = 0;
      BB.hooks.update.push((dt, S, t) => {
        for (const kind in BB.npc) {
          const n = BB.npc[kind]; if (n.hidden) { n.lastX = n.x; continue; }
          const moving = n.lastX != null && Math.abs(n.x - n.lastX) > .05; n.lastX = n.x;
          if (moving) n.ph += Math.abs(n.x - (n._px != null ? n._px : n.x)) / 52 * Math.PI; n._px = n.x;
          n.face = lerp(n.face, n.dir, 1 - Math.exp(-dt * 14));
          n.inst.update(dt, { state: n.state, phase: n.ph, dir: n.dir, face: n.face, held: n.held, t });
        }
      });
    }
  };
})();
